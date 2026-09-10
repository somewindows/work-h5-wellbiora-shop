import { generateKeyPairSync } from 'node:crypto'

import type { WechatPayClient } from './wechat-pay.client'
import { WechatPaymentAdapter } from './wechat-payment.adapter'
import type { WechatPayConfig } from './wechat-pay.config'
import { buildV3Message, verifyV3 } from './wechat-pay.crypto'

describe('WechatPaymentAdapter', () => {
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()

  const config: WechatPayConfig = {
    appId: 'wx2591892b548a6565',
    appSecret: 'secret',
    mchId: '1117333649',
    serialNo: 'SERIAL',
    privateKeyPem,
    apiV3Key: '12345678901234567890123456789012',
    apiV2Key: null,
    notifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/notify',
    refundNotifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/refund-notify',
    customsCode: null,
    mchCustomsNo: null,
  }

  function stubClient(postImpl: (path: string, payload: unknown) => Promise<unknown>): WechatPayClient {
    return { post: jest.fn(postImpl) } as unknown as WechatPayClient
  }

  describe('createPayParams（JSAPI 下单）', () => {
    it('缺少 openid 时抛 40007 引导前端走授权', async () => {
      const adapter = new WechatPaymentAdapter(stubClient(() => Promise.resolve({})), config)
      await expect(adapter.createPayParams('WB20260910ABCDEF', { totalFen: 100 })).rejects.toMatchObject({ code: 40007 })
    })

    it('下单报文符合 V3 JSAPI 契约，返回二次签名的调起参数', async () => {
      let capturedPayload: Record<string, unknown> | null = null
      const client = stubClient((path, payload) => {
        expect(path).toBe('/v3/pay/transactions/jsapi')
        capturedPayload = payload as Record<string, unknown>
        return Promise.resolve({ prepay_id: 'wx-prepay-001' })
      })
      const adapter = new WechatPaymentAdapter(client, config)

      const params = await adapter.createPayParams('WB20260910ABCDEF', {
        openid: 'openid-1', totalFen: 32900, description: 'WELLBIORA 谷胱甘肽饮',
      })

      expect(capturedPayload).toMatchObject({
        appid: 'wx2591892b548a6565',
        mchid: '1117333649',
        out_trade_no: 'WB20260910ABCDEF',
        notify_url: config.notifyUrl,
        amount: { total: 32900, currency: 'CNY' },
        payer: { openid: 'openid-1' },
      })
      expect(params).toMatchObject({
        provider: 'wechat',
        appId: 'wx2591892b548a6565',
        package: 'prepay_id=wx-prepay-001',
        signType: 'RSA',
      })
      // paySign 可被商户公钥验出（JSAPI 调起签名串：appId\ntimeStamp\nnonceStr\npackage\n）
      const message = buildV3Message([params.appId, params.timeStamp, params.nonceStr, params.package])
      expect(verifyV3(publicKeyPem, message, params.paySign)).toBe(true)
    })
  })

  describe('refund（原路退款）', () => {
    it('退款报文符合 V3 契约，返回商户退款单号', async () => {
      let capturedPayload: Record<string, unknown> | null = null
      const client = stubClient((path, payload) => {
        expect(path).toBe('/v3/refund/domestic/refunds')
        capturedPayload = payload as Record<string, unknown>
        return Promise.resolve({ refund_id: '5030', out_refund_no: (payload as { out_refund_no: string }).out_refund_no, status: 'PROCESSING' })
      })
      const adapter = new WechatPaymentAdapter(client, config)

      const result = await adapter.refund('WB20260910ABCDEF', 10000, 32900)

      expect(result.refundNo).toMatch(/^RWB20260910ABCDEF/)
      expect(result.refundNo.length).toBeLessThanOrEqual(32)
      expect(capturedPayload).toMatchObject({
        out_trade_no: 'WB20260910ABCDEF',
        notify_url: config.refundNotifyUrl,
        amount: { refund: 10000, total: 32900, currency: 'CNY' },
      })
    })

    it('缺少原订单金额时拒绝发起退款', async () => {
      const adapter = new WechatPaymentAdapter(stubClient(() => Promise.resolve({})), config)
      await expect(adapter.refund('WB20260910ABCDEF', 10000)).rejects.toThrow(/totalFen/)
    })
  })
})
