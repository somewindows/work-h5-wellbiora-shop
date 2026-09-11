import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'

import type { PaymentAdapter, PaymentRefundResult, PayContext } from '../orders/local-payment.adapter'
import { buildV3Message, signV3 } from './wechat-pay.crypto'
import type { WechatPayClient } from './wechat-pay.client'
import type { WechatPayConfig } from './wechat-pay.config'

/** 前端拿到 provider=wechat 的 payParams 后，用 WeixinJSBridge.invoke('getBrandWCPayRequest', ...) 调起支付。 */
interface JsapiPrepayResponse {
  prepay_id: string
}

interface WechatRefundResponse {
  refund_id: string
  out_refund_no: string
  status: string
}

/**
 * 微信支付 V3 适配器：JSAPI 下单 + 原路退款。
 * 仅在 .env 配齐 WXPAY_* 时由 OrdersModule 装配，未配置时回落 LocalPaymentAdapter。
 */
export class WechatPaymentAdapter implements PaymentAdapter {
  private readonly logger = new Logger(WechatPaymentAdapter.name)

  constructor(
    private readonly client: WechatPayClient,
    private readonly config: WechatPayConfig,
  ) {}

  async createPayParams(orderNo: string, ctx?: PayContext): Promise<Record<string, string>> {
    if (!ctx?.openid) throw new BusinessException(40007, '需要先完成微信授权才能支付')
    if (!ctx.totalFen || ctx.totalFen <= 0) throw new Error('微信支付下单缺少订单金额')
    const description = (ctx.description ?? 'WELLBIORA 海外旗舰店').slice(0, 127)

    const prepay = await this.client.post<JsapiPrepayResponse>('/v3/pay/transactions/jsapi', {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description,
      out_trade_no: orderNo,
      notify_url: this.config.notifyUrl,
      amount: { total: ctx.totalFen, currency: 'CNY' },
      payer: { openid: ctx.openid },
    })
    this.logger.log(`JSAPI 下单成功：${orderNo}`)

    // 二次签名生成 JSAPI 调起参数（paySign 用商户私钥签）
    const timeStamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = randomUUID().replaceAll('-', '')
    const packageValue = `prepay_id=${prepay.prepay_id}`
    const paySign = signV3(this.config.privateKeyPem, buildV3Message([this.config.appId, timeStamp, nonceStr, packageValue]))
    return {
      provider: 'wechat',
      appId: this.config.appId,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: 'RSA',
      paySign,
    }
  }

  async refund(orderNo: string, amountFen: number, totalFen?: number): Promise<PaymentRefundResult> {
    if (!totalFen || totalFen <= 0) throw new Error('微信退款缺少原订单实付金额（totalFen）')
    // out_refund_no ≤ 32 位：R + 订单号(22) + 9 位随机，支持同一单多次部分退款
    const outRefundNo = `R${orderNo}${randomUUID().replaceAll('-', '').slice(0, 9).toUpperCase()}`
    const result = await this.client.post<WechatRefundResponse>('/v3/refund/domestic/refunds', {
      out_trade_no: orderNo,
      out_refund_no: outRefundNo,
      notify_url: this.config.refundNotifyUrl,
      amount: { refund: amountFen, total: totalFen, currency: 'CNY' },
    })
    return { refundNo: result.out_refund_no }
  }
}
