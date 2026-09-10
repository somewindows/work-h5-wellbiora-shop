import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

import { buildV3Message, decryptResource, signV3, verifyV3 } from './wechat-pay.crypto'
import type { WechatPayConfig } from './wechat-pay.config'

const API_BASE = 'https://api.mch.weixin.qq.com'
/** 回调时间戳与服务器时钟允许的最大偏差（防重放） */
const NOTIFY_TIMESTAMP_TOLERANCE_SECONDS = 300

/** 微信 V3 业务错误：响应体形如 { code, message } */
export class WechatPayError extends Error {
  constructor(
    readonly wechatCode: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(`微信支付接口错误 ${wechatCode}：${message}`)
    this.name = 'WechatPayError'
  }
}

export interface WechatNotifyHeaders {
  timestamp: string
  nonce: string
  signature: string
  serial: string
}

interface PlatformCertificateItem {
  serial_no: string
  effective_time: string
  expire_time: string
  encrypt_certificate: { algorithm: string; nonce: string; associated_data: string; ciphertext: string }
}

/**
 * 微信支付 V3 API 客户端：请求签名、平台证书下载缓存、回调验签。
 * 用 Node 22 全局 fetch，不新增依赖。注入式 fetchImpl 便于单测。
 */
@Injectable()
export class WechatPayClient {
  private readonly logger = new Logger(WechatPayClient.name)
  /** 平台证书缓存：序列号 → 证书 PEM（验签回调用） */
  private readonly platformCerts = new Map<string, string>()

  constructor(
    private readonly config: WechatPayConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, payload: unknown): Promise<T> {
    return this.request<T>('POST', path, JSON.stringify(payload))
  }

  /**
   * 校验回调签名。验签通过返回 true；平台证书未命中会先拉取一次再重试。
   * 同时校验回调时间戳新鲜度，防重放。
   */
  async verifyNotification(headers: WechatNotifyHeaders, rawBody: string): Promise<boolean> {
    const timestampSeconds = Number(headers.timestamp)
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > NOTIFY_TIMESTAMP_TOLERANCE_SECONDS) {
      this.logger.warn('回调时间戳超出容忍窗口，拒绝处理')
      return false
    }
    const message = buildV3Message([headers.timestamp, headers.nonce, rawBody])
    const verifyWith = (certPem: string | undefined): boolean =>
      certPem ? verifyV3(certPem, message, headers.signature) : false

    let certPem = this.platformCerts.get(headers.serial)
    if (verifyWith(certPem)) return true

    // 未命中（或微信轮换了证书）：刷新平台证书后重试一次；刷新失败按验签失败处理，不让回调 500
    try {
      await this.refreshPlatformCertificates()
    } catch (error) {
      this.logger.error('刷新微信平台证书失败', error)
      return false
    }
    certPem = this.platformCerts.get(headers.serial)
    const ok = verifyWith(certPem)
    if (!ok) this.logger.warn(`回调验签失败（平台证书序列号 ${headers.serial}）`)
    return ok
  }

  /** 解密回调 body 中的 resource 段。 */
  decryptNotifyResource<T>(resource: { ciphertext: string; nonce: string; associated_data: string }): T {
    const plaintext = decryptResource(this.config.apiV3Key, resource.ciphertext, resource.nonce, resource.associated_data)
    return JSON.parse(plaintext) as T
  }

  /** 下载并解密平台证书（GET /v3/certificates），更新缓存。 */
  async refreshPlatformCertificates(): Promise<void> {
    const response = await this.get<{ data: PlatformCertificateItem[] }>('/v3/certificates')
    for (const item of response.data) {
      try {
        const certPem = decryptResource(
          this.config.apiV3Key,
          item.encrypt_certificate.ciphertext,
          item.encrypt_certificate.nonce,
          item.encrypt_certificate.associated_data,
        )
        this.platformCerts.set(item.serial_no, certPem)
      } catch (error) {
        this.logger.error(`平台证书解密失败（序列号 ${item.serial_no}）`, error)
      }
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body = ''): Promise<T> {
    const nonce = randomUUID().replaceAll('-', '')
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = signV3(this.config.privateKeyPem, buildV3Message([method, path, timestamp, nonce, body]))
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",` +
      `signature="${signature}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`

    const response = await this.fetchImpl(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body } : {}),
    })
    const text = await response.text()
    if (!response.ok) {
      let wechatCode = `HTTP_${response.status}`
      let message = text.slice(0, 200)
      try {
        const parsed = JSON.parse(text) as { code?: string; message?: string }
        wechatCode = parsed.code ?? wechatCode
        message = parsed.message ?? message
      } catch {
        // 非 JSON 错误响应，保留原始片段
      }
      throw new WechatPayError(wechatCode, message, response.status)
    }
    return (text ? JSON.parse(text) : {}) as T
  }
}
