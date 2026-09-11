import { createCipheriv, generateKeyPairSync } from 'node:crypto'

import { WechatPayClient, WechatPayError } from './wechat-pay.client'
import type { WechatPayConfig } from './wechat-pay.config'
import { buildV3Message, signV3 } from './wechat-pay.crypto'

describe('微信支付 V3 客户端', () => {
  const merchantKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const merchantPrivateKeyPem = merchantKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const platformKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const platformPrivateKeyPem = platformKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const platformPublicKeyPem = platformKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const apiV3Key = 'client-apiv3-key-012345678901234'
  const platformSerial = 'PLATFORM_SERIAL_001'

  const config: WechatPayConfig = {
    appId: 'wx-test',
    appSecret: 'secret',
    mchId: '1117333649',
    serialNo: 'MERCHANT_SERIAL',
    privateKeyPem: merchantPrivateKeyPem,
    apiV3Key,
    apiV2Key: null,
    notifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/notify',
    refundNotifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/refund-notify',
    customsCode: null,
    mchCustomsNo: null,
  }

  function encryptWithApiV3Key(plaintext: string, nonce: string, associatedData: string): string {
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'))
    if (associatedData) cipher.setAAD(Buffer.from(associatedData, 'utf8'))
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return Buffer.concat([data, cipher.getAuthTag()]).toString('base64')
  }

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
  }

  it('请求带 WECHATPAY2-SHA256-RSA2048 签名头，且签名可被商户公钥验出', async () => {
    const captured: { url?: string; init?: RequestInit } = {}
    const fetchImpl: typeof fetch = (async (url: string | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.init = init ?? {}
      return jsonResponse({ prepay_id: 'wx-prepay-123' })
    }) as typeof fetch
    const client = new WechatPayClient(config, fetchImpl)

    await client.post('/v3/pay/transactions/jsapi', { appid: 'wx-test' })

    expect(captured.url).toBe('https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi')
    const authorization = String((captured.init?.headers as Record<string, string>).Authorization)
    expect(authorization).toContain('WECHATPAY2-SHA256-RSA2048')
    expect(authorization).toContain('mchid="1117333649"')
    expect(authorization).toContain('serial_no="MERCHANT_SERIAL"')

    // 用商户公钥还原验签，证明签名算法正确
    const parts = Object.fromEntries(
      [...authorization.replace('WECHATPAY2-SHA256-RSA2048 ', '').matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
    )
    const body = String(captured.init?.body ?? '')
    const message = buildV3Message(['POST', '/v3/pay/transactions/jsapi', parts.timestamp, parts.nonce_str, body])
    expect(signV3(merchantPrivateKeyPem, message)).toBe(parts.signature)
  })

  it('显式发送 Accept-Language，避免 undici 默认的 `*` 被微信网关拒绝', async () => {
    const captured: { url?: string; init?: RequestInit } = {}
    const fetchImpl: typeof fetch = (async (url: string | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.init = init ?? {}
      return jsonResponse({ data: [] })
    }) as typeof fetch
    const client = new WechatPayClient(config, fetchImpl)

    await client.get('/v3/certificates')

    expect(captured.url).toBe('https://api.mch.weixin.qq.com/v3/certificates')
    expect((captured.init?.headers as Record<string, string>)['Accept-Language']).toBe('zh-CN')
  })

  it('业务错误抛出带微信错误码的 WechatPayError', async () => {
    const fetchImpl: typeof fetch = (async () =>
      jsonResponse({ code: 'PARAM_ERROR', message: '订单号非法' }, 400)) as typeof fetch
    const client = new WechatPayClient(config, fetchImpl)
    await expect(client.post('/v3/pay/transactions/jsapi', {})).rejects.toMatchObject({
      name: 'WechatPayError',
      wechatCode: 'PARAM_ERROR',
      httpStatus: 400,
    })
    await expect(client.post('/v3/pay/transactions/jsapi', {})).rejects.toBeInstanceOf(WechatPayError)
  })

  it('下载平台证书：解密后按序列号缓存，可用于回调验签', async () => {
    const fetchImpl: typeof fetch = (async () =>
      jsonResponse({
        data: [
          {
            serial_no: platformSerial,
            effective_time: '2026-09-01T00:00:00+08:00',
            expire_time: '2031-09-01T00:00:00+08:00',
            encrypt_certificate: {
              algorithm: 'AEAD_AES_256_GCM',
              nonce: 'certnonce12',
              associated_data: 'certificate',
              ciphertext: encryptWithApiV3Key(platformPublicKeyPem, 'certnonce12', 'certificate'),
            },
          },
        ],
      })) as typeof fetch
    const client = new WechatPayClient(config, fetchImpl)

    // 用平台私钥伪造一份回调签名
    const rawBody = JSON.stringify({ id: 'notify-1' })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = 'notifynonce'
    const signature = signV3(platformPrivateKeyPem, buildV3Message([timestamp, nonce, rawBody]))

    const ok = await client.verifyNotification({ timestamp, nonce, signature, serial: platformSerial }, rawBody)
    expect(ok).toBe(true)
  })

  it('签名不符的回调被拒绝', async () => {
    const offlineFetch: typeof fetch = (() => Promise.reject(new Error('单测不触网'))) as typeof fetch
    const client = new WechatPayClient(config, offlineFetch)
    // 预置平台证书（等价于 refresh 之后的状态）
    ;(client as unknown as { platformCerts: Map<string, string> }).platformCerts.set(platformSerial, platformPublicKeyPem)

    const rawBody = '{"id":"notify-2"}'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const badSignature = signV3(merchantPrivateKeyPem, buildV3Message([timestamp, 'nonce', rawBody])) // 用错私钥签
    await expect(
      client.verifyNotification({ timestamp, nonce: 'nonce', signature: badSignature, serial: platformSerial }, rawBody),
    ).resolves.toBe(false)
  })

  it('回调时间戳超出容忍窗口直接拒绝（防重放）', async () => {
    const client = new WechatPayClient(config)
    ;(client as unknown as { platformCerts: Map<string, string> }).platformCerts.set(platformSerial, platformPublicKeyPem)

    const rawBody = '{"id":"notify-3"}'
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600)
    const signature = signV3(platformPrivateKeyPem, buildV3Message([staleTimestamp, 'nonce', rawBody]))
    await expect(
      client.verifyNotification({ timestamp: staleTimestamp, nonce: 'nonce', signature, serial: platformSerial }, rawBody),
    ).resolves.toBe(false)
  })

  it('解密回调 resource 得到明文 JSON', () => {
    const client = new WechatPayClient(config)
    const plaintext = JSON.stringify({ out_trade_no: 'WB20260910XYZ', trade_state: 'SUCCESS' })
    const resource = {
      ciphertext: encryptWithApiV3Key(plaintext, 'resourcenonce', 'transaction'),
      nonce: 'resourcenonce',
      associated_data: 'transaction',
    }
    expect(client.decryptNotifyResource(resource)).toEqual({ out_trade_no: 'WB20260910XYZ', trade_state: 'SUCCESS' })
  })
})
