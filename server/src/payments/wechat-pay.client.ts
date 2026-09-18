import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

import { buildV3Message, decryptResource, signV3, verifyV3 } from './wechat-pay.crypto'
import type { WechatPayConfig } from './wechat-pay.config'

const API_BASE = 'https://api.mch.weixin.qq.com'
/** 回调时间戳与服务器时钟允许的最大偏差（防重放） */
const NOTIFY_TIMESTAMP_TOLERANCE_SECONDS = 300
/** V3 接口默认请求超时：undici 默认约 300s，主动查单/退款挂太久会拖垮兜底任务 */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
/** 平台证书刷新最小间隔（复审 R11）：伪造回调风暴时不能每次都去拉证书 */
const CERT_REFRESH_MIN_INTERVAL_MS = 60_000
/** 证书刷新失败退避上限 */
const CERT_REFRESH_MAX_BACKOFF_MS = 15 * 60_000
const CERTIFICATES_PATH = '/v3/certificates'

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

/** V3 应答验签失败（复审 R12）：拒绝采信该响应，调用方按请求失败处理 */
export class WechatPayResponseSignatureError extends Error {
  constructor(message: string) {
    super(`微信支付应答验签失败：${message}`)
    this.name = 'WechatPayResponseSignatureError'
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
  /** 复审 R11：证书刷新防护——并发伪造回调共用同一次刷新（single-flight） */
  private refreshInFlight: Promise<void> | null = null
  private lastRefreshStartedAt = 0
  private refreshConsecutiveFailures = 0
  private refreshBlockedUntil = 0

  constructor(
    private readonly config: WechatPayConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    // 启动即亮明验签模式：排障时看第一屏日志就知道配置是否生效
    this.logger.log(
      config.publicKeyPem
        ? `回调验签模式：微信支付公钥（${config.publicKeyId}），不拉平台证书`
        : '回调验签模式：平台证书（/v3/certificates）。新商户号没有平台证书，若回调验签持续失败请配置 WXPAY_PUBLIC_KEY_PATH / WXPAY_PUBLIC_KEY_ID',
    )
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, payload: unknown): Promise<T> {
    return this.request<T>('POST', path, JSON.stringify(payload))
  }

  /**
   * 校验回调签名。验签通过返回 true。
   * 配置了微信支付公钥（publicKeyPem）时用公钥直接验签，不拉平台证书——
   * 新商户号没有平台证书（/v3/certificates 回 RESOURCE_NOT_EXISTS），回调的
   * Wechatpay-Serial 此时是公钥 ID（PUB_KEY_ID_ 开头）。未配置公钥则走平台证书缓存，
   * 未命中会先拉取一次再重试。同时校验回调时间戳新鲜度，防重放。
   */
  async verifyNotification(headers: WechatNotifyHeaders, rawBody: string): Promise<boolean> {
    const timestampSeconds = Number(headers.timestamp)
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > NOTIFY_TIMESTAMP_TOLERANCE_SECONDS) {
      this.logger.warn('回调时间戳超出容忍窗口，拒绝处理')
      return false
    }
    const message = buildV3Message([headers.timestamp, headers.nonce, rawBody])

    if (this.config.publicKeyPem) {
      if (headers.serial !== this.config.publicKeyId) {
        this.logger.warn(`回调验签失败（公钥 ID 不匹配：收到 ${headers.serial}，期望 ${this.config.publicKeyId}）`)
        return false
      }
      const ok = verifyV3(this.config.publicKeyPem, message, headers.signature)
      if (!ok) this.logger.warn('回调验签失败（微信支付公钥模式）')
      return ok
    }

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

  /**
   * 下载并解密平台证书（GET /v3/certificates），更新缓存。
   * 复审 R11 加固：single-flight（并发伪造回调只触发一次真实刷新）+ 最小间隔 + 失败退避，
   * 防止伪造回调风暴把 /v3/certificates 打成洪水；合法证书轮换在限流窗口过后仍可恢复。
   */
  async refreshPlatformCertificates(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight
    const now = Date.now()
    if (now - this.lastRefreshStartedAt < CERT_REFRESH_MIN_INTERVAL_MS || now < this.refreshBlockedUntil) {
      this.logger.warn('平台证书刷新被限流（最小间隔/失败退避），本次跳过，回调按验签失败处理并等待微信重推')
      return
    }
    this.lastRefreshStartedAt = now
    this.refreshInFlight = (async () => {
      try {
        await this.doRefreshPlatformCertificates()
        this.refreshConsecutiveFailures = 0
        this.refreshBlockedUntil = 0
      } catch (error) {
        this.refreshConsecutiveFailures += 1
        const backoffMs = Math.min(
          CERT_REFRESH_MIN_INTERVAL_MS * 2 ** (this.refreshConsecutiveFailures - 1),
          CERT_REFRESH_MAX_BACKOFF_MS,
        )
        this.refreshBlockedUntil = Date.now() + backoffMs
        throw error
      } finally {
        this.refreshInFlight = null
      }
    })()
    return this.refreshInFlight
  }

  private async doRefreshPlatformCertificates(): Promise<void> {
    let response: { data: PlatformCertificateItem[] }
    try {
      response = await this.get<{ data: PlatformCertificateItem[] }>(CERTIFICATES_PATH)
    } catch (error) {
      // 新商户号没有平台证书（公钥模式）：这个报错的意思是要去商户平台下载微信支付公钥并配置环境变量
      if (error instanceof WechatPayError && error.wechatCode === 'RESOURCE_NOT_EXISTS') {
        this.logger.error(
          '该商户号无平台证书（微信支付公钥模式）。请到商户平台-API安全下载微信支付公钥，' +
            '并在 .env 配置 WXPAY_PUBLIC_KEY_PATH 与 WXPAY_PUBLIC_KEY_ID（PUB_KEY_ID_ 开头）后重启服务',
        )
      }
      throw error
    }
    let imported = 0
    for (const item of response.data) {
      try {
        const certPem = decryptResource(
          this.config.apiV3Key,
          item.encrypt_certificate.ciphertext,
          item.encrypt_certificate.nonce,
          item.encrypt_certificate.associated_data,
        )
        this.platformCerts.set(item.serial_no, certPem)
        imported += 1
      } catch (error) {
        this.logger.error(`平台证书解密失败（序列号 ${item.serial_no}）`, error)
      }
    }
    // 评审建议：一张证书都没能入库（典型原因：APIv3 密钥配错）要按刷新失败处理，
    // 否则失败退避永不生效，伪造回调可以维持每 60s 一次真实刷新
    if (response.data.length > 0 && imported === 0) {
      throw new Error('微信平台证书全部解密失败，请检查 WXPAY_API_V3_KEY 是否配置正确')
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body = ''): Promise<T> {
    const nonce = randomUUID().replaceAll('-', '')
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = signV3(this.config.privateKeyPem, buildV3Message([method, path, timestamp, nonce, body]))
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",` +
      `signature="${signature}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`

    // 复审 R12：请求超时兜底。undici 默认 headers/body 超时约 300s，主动查单挂太久会拖垮兜底任务；
    // signal 对 body 流同样生效，因此 response.text() 读完之前不能 clearTimeout（评审建议：慢滴漏 body 也要被超时覆盖）
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    let text: string
    try {
      response = await this.fetchImpl(`${API_BASE}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          // Node 全局 fetch（undici）默认会补一个 `Accept-Language: *`，微信 V3 网关不认这个值，
          // /v3/certificates 直接回 PARAM_ERROR 传入了不支持的Accept-Language——平台证书因此永远拉不下来、
          // 回调全部验签失败。显式给一个合法语言标签覆盖掉默认值。
          'Accept-Language': 'zh-CN',
          // 公钥模式下按微信指引在请求头带上公钥 ID，微信应答会用该公钥签名
          // （见 https://pay.weixin.qq.com/doc/v3/partner/4012925323 「请求-应答场景」）
          ...(this.config.publicKeyId ? { 'Wechatpay-Serial': this.config.publicKeyId } : {}),
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body } : {}),
      })
      text = await response.text()
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`微信支付接口请求超时（${timeoutMs}ms）：${method} ${path}`)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
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
      this.logger.warn(`微信支付接口请求失败 ${method} ${path}：${wechatCode} ${message}`)
      throw new WechatPayError(wechatCode, message, response.status)
    }
    // 复审 R12：成功应答必须验签后才采信——主动查单的应答是补记资金状态的依据
    await this.verifyResponseSignature(path, response.headers, text)
    return (text ? JSON.parse(text) : {}) as T
  }

  /**
   * 应答验签（复审 R12）：验签串 = Wechatpay-Timestamp\nWechatpay-Nonce\n应答体\n。
   * 公钥模式用微信支付公钥验（Wechatpay-Serial 应为公钥 ID）；平台证书模式用缓存证书验，
   * 未命中先刷新一次再验。例外：拉平台证书本身的应答在本地无对应证书时无法自证，
   * 按微信官方指引跳过验签（证书内容另有 APIv3 密钥解密兜底）。
   */
  private async verifyResponseSignature(path: string, headers: Headers, body: string): Promise<void> {
    const timestamp = headers.get('Wechatpay-Timestamp')
    const nonce = headers.get('Wechatpay-Nonce')
    const signature = headers.get('Wechatpay-Signature')
    const serial = headers.get('Wechatpay-Serial')

    if (!this.config.publicKeyPem && path === CERTIFICATES_PATH && (!serial || !this.platformCerts.has(serial))) {
      this.logger.warn('平台证书下载应答无法验签（本地无对应序列号证书），按微信指引跳过本次验签')
      return
    }
    if (!timestamp || !nonce || !signature || !serial) {
      throw new WechatPayResponseSignatureError('应答缺少验签头（Wechatpay-Timestamp/Nonce/Signature/Serial）')
    }
    const message = buildV3Message([timestamp, nonce, body])

    if (this.config.publicKeyPem) {
      if (serial !== this.config.publicKeyId || !verifyV3(this.config.publicKeyPem, message, signature)) {
        throw new WechatPayResponseSignatureError(`公钥模式验签不通过（serial=${serial}，期望 ${this.config.publicKeyId}）`)
      }
      return
    }

    let certPem = this.platformCerts.get(serial)
    if (!certPem) {
      // 可能正值证书轮换：刷新一次再验；刷新被限流或失败时按验签失败处理
      try {
        await this.refreshPlatformCertificates()
      } catch {
        // 统一走下面的验签失败抛错
      }
      certPem = this.platformCerts.get(serial)
    }
    if (!certPem || !verifyV3(certPem, message, signature)) {
      throw new WechatPayResponseSignatureError(`平台证书模式验签不通过（serial=${serial}）`)
    }
  }
}
