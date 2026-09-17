import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'

import type { PaymentAdapter, PaymentQueryResult, PaymentRefundQueryResult, PaymentRefundResult, PayContext } from '../orders/local-payment.adapter'
import { buildV3Message, signV3 } from './wechat-pay.crypto'
import { WechatPayError, type WechatPayClient } from './wechat-pay.client'
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

/** V3 查退款（GET /v3/refund/domestic/refunds/{out_refund_no}）响应的关键字段 */
interface WechatRefundQuery {
  refund_id: string
  out_refund_no: string
  status: string
}

/** V3 查单（GET /v3/pay/transactions/out-trade-no）响应的关键字段 */
interface WechatTransaction {
  out_trade_no: string
  transaction_id?: string
  trade_state: string
  amount?: { total?: number; payer_total?: number; currency?: string }
  success_time?: string
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

  async refund(orderNo: string, amountFen: number, totalFen: number, outRefundNo: string): Promise<PaymentRefundResult> {
    if (!totalFen || totalFen <= 0) throw new Error('微信退款缺少原订单实付金额（totalFen）')
    // 复审 R05：out_refund_no 由服务层生成并先落库；重试复用同一号，微信侧幂等受理
    const result = await this.client.post<WechatRefundResponse>('/v3/refund/domestic/refunds', {
      out_trade_no: orderNo,
      out_refund_no: outRefundNo,
      notify_url: this.config.refundNotifyUrl,
      amount: { refund: amountFen, total: totalFen, currency: 'CNY' },
    })
    // 复审 R04：受理状态原样透传（通常 PROCESSING），由服务层按状态机收敛，禁止受理即终态
    return { refundNo: result.out_refund_no, refundId: result.refund_id, status: result.status }
  }

  /** 复审 R05：网络异常后按原退款单号查退款状态；微信侧未受理该单返回 404 → null。 */
  async queryRefund(outRefundNo: string): Promise<PaymentRefundQueryResult | null> {
    try {
      const result = await this.client.get<WechatRefundQuery>(`/v3/refund/domestic/refunds/${outRefundNo}`)
      return { status: result.status, refundId: result.refund_id }
    } catch (error) {
      if (error instanceof WechatPayError && error.httpStatus === 404) return null
      throw error
    }
  }

  /** 复审 R09：取消订单后关闭微信交易，防止用户取消后仍能完成支付。微信侧已支付/已关单会返回错误，由调用方 best-effort 捕获。 */
  async closePayment(orderNo: string): Promise<void> {
    await this.client.post(`/v3/pay/transactions/out-trade-no/${orderNo}/close`, { mchid: this.config.mchId })
    this.logger.log(`微信关单成功：${orderNo}`)
  }

  /** 主动查单（回调漏单兜底）；path 带 mchid 查询参数，V3 签名直接签完整 path。微信侧查无此单返回 null。 */
  async queryPayment(orderNo: string): Promise<PaymentQueryResult | null> {
    try {
      const result = await this.client.get<WechatTransaction>(`/v3/pay/transactions/out-trade-no/${orderNo}?mchid=${this.config.mchId}`)
      return {
        tradeState: result.trade_state,
        transactionId: result.transaction_id,
        // 复审 R08：金额比对口径是订单总额 amount.total；payer_total 是用户实付，优惠场景会更小
        paidTotalFen: result.amount?.total,
        payerTotalFen: result.amount?.payer_total,
        currency: result.amount?.currency,
        paidAt: result.success_time ? new Date(result.success_time) : undefined,
      }
    } catch (error) {
      // 微信侧查无此单（未调起支付或已关闭）时 V3 返回 404，按「查无此单」处理而非报错
      if (error instanceof WechatPayError && error.httpStatus === 404) return null
      throw error
    }
  }
}
