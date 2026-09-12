import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createCipheriv, generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'

import { buildV3Message, signV3 } from '../src/payments/wechat-pay.crypto'
import type { MemorySmsProvider } from '../src/auth/sms-provider'

/**
 * 微信支付全链路 e2e：真实装配 WXPAY_* 配置（临时密钥对）→ 授权换 openid → 下单拿 JSAPI 参数
 * → 伪造平台签名的支付回调 → 订单变已支付；覆盖验签失败拒绝与回调幂等。
 * global fetch 全程 mock，不触网。
 */
describe('微信支付回调（e2e）', () => {
  const merchantKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const platformKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const platformPublicKeyPem = platformKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const platformPrivateKeyPem = platformKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const apiV3Key = 'e2e-apiv3-key-012345678901234567'
  const platformSerial = 'E2E_PLATFORM_SERIAL'

  let app: INestApplication
  let token: string
  let workDir = ''
  let originalFetch: typeof fetch

  function encrypt(plaintext: string, nonce: string, associatedData: string): string {
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'))
    cipher.setAAD(Buffer.from(associatedData, 'utf8'))
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return Buffer.concat([data, cipher.getAuthTag()]).toString('base64')
  }

  function mockFetch(): typeof fetch {
    return (async (input: string | URL | Request) => {
      const url = String(input)
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
      if (url.includes('api.weixin.qq.com/sns/oauth2/access_token')) return json({ openid: 'openid-e2e-1' })
      if (url.includes('/v3/pay/transactions/jsapi')) return json({ prepay_id: 'prepay-e2e-1' })
      if (url.includes('/v3/certificates')) {
        return json({
          data: [{
            serial_no: platformSerial,
            encrypt_certificate: {
              algorithm: 'AEAD_AES_256_GCM', nonce: 'certnonce12', associated_data: 'certificate',
              ciphertext: encrypt(platformPublicKeyPem, 'certnonce12', 'certificate'),
            },
          }],
        })
      }
      throw new Error(`e2e 未预期的外部请求：${url}`)
    }) as typeof fetch
  }

  function signedNotifyRequest(resourcePlaintext: Record<string, unknown>, options?: { signWithMerchantKey?: boolean }) {
    const rawBody = JSON.stringify({
      id: 'e2e-notify-1',
      event_type: 'TRANSACTION.SUCCESS',
      resource_type: 'encrypt-resource',
      resource: {
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext: encrypt(JSON.stringify(resourcePlaintext), 'notifynonce', 'transaction'),
        nonce: 'notifynonce',
        associated_data: 'transaction',
      },
    })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = 'e2enonce'
    const privateKey = options?.signWithMerchantKey
      ? merchantKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
      : platformPrivateKeyPem
    return {
      rawBody,
      headers: {
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
        'Wechatpay-Serial': platformSerial,
        'Wechatpay-Signature': signV3(privateKey, buildV3Message([timestamp, nonce, rawBody])),
      },
    }
  }

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'wellbiora-wxpay-e2e-'))
    const keyPath = join(workDir, 'apiclient_key.pem')
    writeFileSync(keyPath, merchantKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), 'utf8')

    process.env.WXPAY_APPID = 'wx-e2e'
    process.env.WX_APPSECRET = 'e2e-secret'
    process.env.WXPAY_MCHID = '1117333649'
    process.env.WXPAY_SERIAL_NO = 'E2E_MERCHANT_SERIAL'
    process.env.WXPAY_PRIVATE_KEY_PATH = keyPath
    process.env.WXPAY_API_V3_KEY = apiV3Key
    process.env.WXPAY_NOTIFY_URL = 'https://wellbiora.com.cn/api/v1/payments/wechat/notify'
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch()

    const { AppModule } = await import('../src/app.module')
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api/v1')
    await app.init()

    const { SMS_PROVIDER } = await import('../src/auth/sms-provider')
    const smsProvider = app.get(SMS_PROVIDER) as MemorySmsProvider
    const agent = request(app.getHttpServer())
    await agent.post('/api/v1/auth/sms-code').send({ phone: '13600000001' }).expect(200)
    const login = await agent.post('/api/v1/auth/login').send({ phone: '13600000001', code: smsProvider.lastCode }).expect(200)
    token = login.body.data.token

    const auth = { Authorization: `Bearer ${token}` }
    await agent.post('/api/v1/cart/items').set(auth).send({ productId: 'WB10001', quantity: 1 }).expect(201)
    await agent.post('/api/v1/addresses').set(auth).send({ name: '张三', phone: '13600000001', region: '浙江省 金华市 义乌市', detail: '稠城街道 1 号' }).expect(201)
    await agent.post('/api/v1/realname').set(auth).send({ name: '张三', idcard: '110101199001011234' }).expect(201)
    // 绑定 openid（走 mock 的 sns/oauth2/access_token）
    await agent.post('/api/v1/auth/wechat/openid').set(auth).send({ code: 'e2e-code' }).expect(201)
  })

  afterAll(async () => {
    globalThis.fetch = originalFetch
    await app?.close()
    rmSync(workDir, { recursive: true, force: true })
    for (const key of ['WXPAY_APPID', 'WX_APPSECRET', 'WXPAY_MCHID', 'WXPAY_SERIAL_NO', 'WXPAY_PRIVATE_KEY_PATH', 'WXPAY_API_V3_KEY', 'WXPAY_NOTIFY_URL']) {
      delete process.env[key]
    }
  })

  it('下单返回订单号，支付参数经 pay-params 单独获取', async () => {
    const agent = request(app.getHttpServer())
    const created = await agent
      .post('/api/v1/orders')
      .set({ Authorization: `Bearer ${token}` })
      .send({ requestId: 'e2e-wxpay-order-1' })
      .expect(201)
    const orderNo = created.body.data.orderNo as string
    expect(orderNo).toMatch(/^WB/)

    const payParams = await agent
      .get(`/api/v1/orders/${orderNo}/pay-params`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200)
    expect(payParams.body.data).toMatchObject({
      provider: 'wechat',
      appId: 'wx-e2e',
      package: 'prepay_id=prepay-e2e-1',
      signType: 'RSA',
    })
    expect(payParams.body.data.paySign).toBeTruthy()
  })

  // 复审 R02：未绑定 openid 的新用户首单必须能创建成功，授权缺失只在取支付参数时暴露
  it('无 openid 用户创建订单成功返回订单号，取支付参数才返回 40007，且同 requestId 重进可恢复', async () => {
    const agent = request(app.getHttpServer())
    const { SMS_PROVIDER } = await import('../src/auth/sms-provider')
    const smsProvider = app.get(SMS_PROVIDER) as MemorySmsProvider
    await agent.post('/api/v1/auth/sms-code').send({ phone: '13600000002' }).expect(200)
    const login = await agent.post('/api/v1/auth/login').send({ phone: '13600000002', code: smsProvider.lastCode }).expect(200)
    const auth = { Authorization: `Bearer ${login.body.data.token as string}` }
    await agent.post('/api/v1/cart/items').set(auth).send({ productId: 'WB10001', quantity: 1 }).expect(201)
    await agent.post('/api/v1/addresses').set(auth).send({ name: '李四', phone: '13600000002', region: '浙江省 金华市 义乌市', detail: '稠城街道 2 号' }).expect(201)
    await agent.post('/api/v1/realname').set(auth).send({ name: '李四', idcard: '110101199001011235' }).expect(201)

    const created = await agent.post('/api/v1/orders').set(auth).send({ requestId: 'e2e-no-openid-1' }).expect(201)
    const orderNo = created.body.data.orderNo as string
    expect(orderNo).toMatch(/^WB/)

    const payParams = await agent.get(`/api/v1/orders/${orderNo}/pay-params`).set(auth)
    expect(payParams.body).toMatchObject({ code: 40007 })

    // 重试复用同一幂等键：返回同一订单（购物车已清空也不会再报 40003）
    const retried = await agent.post('/api/v1/orders').set(auth).send({ requestId: 'e2e-no-openid-1' }).expect(201)
    expect(retried.body.data.orderNo).toBe(orderNo)
  })

  it('合法回调驱动订单变为已支付，重复回调幂等', async () => {
    const agent = request(app.getHttpServer())
    await agent.post('/api/v1/cart/items').set({ Authorization: `Bearer ${token}` }).send({ productId: 'WB10002', quantity: 1 }).expect(201)
    const created = await agent
      .post('/api/v1/orders')
      .set({ Authorization: `Bearer ${token}` })
      .send({ requestId: 'e2e-wxpay-order-2' })
      .expect(201)
    const orderNo = created.body.data.orderNo as string

    const notify = signedNotifyRequest({
      out_trade_no: orderNo,
      transaction_id: '4200000999000111222333444555',
      trade_state: 'SUCCESS',
      amount: { total: 25900, payer_total: 25900, currency: 'CNY' },
      success_time: '2026-09-10T18:00:00+08:00',
    })
    await agent
      .post('/api/v1/payments/wechat/notify')
      .set(notify.headers)
      .set('Content-Type', 'application/json')
      .send(notify.rawBody)
      .expect(200)
      .expect((response) => expect(response.body).toEqual({ code: 'SUCCESS', message: '成功' }))

    // 微信重推同一回调：依然返回 SUCCESS，不报错不重复处理
    await agent
      .post('/api/v1/payments/wechat/notify')
      .set(notify.headers)
      .set('Content-Type', 'application/json')
      .send(notify.rawBody)
      .expect(200)

    const detail = await agent
      .get(`/api/v1/orders/${orderNo}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200)
    expect(detail.body.data.status).toBe('ship')
    expect(detail.body.data.payTime).not.toBeNull()
  })

  it('验签失败的回调返回 FAIL 且订单状态不变', async () => {
    const agent = request(app.getHttpServer())
    await agent.post('/api/v1/cart/items').set({ Authorization: `Bearer ${token}` }).send({ productId: 'WB10002', quantity: 1 }).expect(201)
    const created = await agent
      .post('/api/v1/orders')
      .set({ Authorization: `Bearer ${token}` })
      .send({ requestId: 'e2e-wxpay-order-3' })
    const orderNo = created.body.data.orderNo as string

    const notify = signedNotifyRequest(
      { out_trade_no: orderNo, transaction_id: '4200009999999999999999999999', trade_state: 'SUCCESS', amount: { total: 32900, payer_total: 32900 } },
      { signWithMerchantKey: true },
    )
    await agent
      .post('/api/v1/payments/wechat/notify')
      .set(notify.headers)
      .set('Content-Type', 'application/json')
      .send(notify.rawBody)
      .expect(400)
      .expect((response) => expect(response.body.code).toBe('FAIL'))

    const detail = await agent.get(`/api/v1/orders/${orderNo}`).set({ Authorization: `Bearer ${token}` }).expect(200)
    expect(detail.body.data.status).toBe('pay')
  })
})
