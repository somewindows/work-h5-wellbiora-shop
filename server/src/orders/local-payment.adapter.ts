import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

export const PAYMENT_ADAPTER = Symbol('PAYMENT_ADAPTER')

export interface PaymentRefundResult {
  refundNo: string
}

/** 发起支付时的上下文：微信 JSAPI 需要 openid 与订单金额/描述；本地 mock 全部忽略。 */
export interface PayContext {
  openid?: string | null
  totalFen?: number
  description?: string
}

/** 主动查单结果（回调漏单时的补单依据）；tradeState 为支付通道原始状态（微信侧如 SUCCESS/NOTPAY/CLOSED） */
export interface PaymentQueryResult {
  tradeState: string
  transactionId?: string
  /** 订单总金额（amount.total）：与本地订单金额比对的口径（复审 R08：不能用 payer_total，优惠场景实付小于总额） */
  paidTotalFen?: number
  /** 用户实付（amount.payer_total）：优惠信息，仅供对账参考 */
  payerTotalFen?: number
  paidAt?: Date
}

export interface PaymentAdapter {
  createPayParams(orderNo: string, ctx?: PayContext): Promise<Record<string, string>>
  /** 原路退款；金额单位：分；totalFen 为原订单实付（微信退款接口要求） */
  refund(orderNo: string, amountFen: number, totalFen?: number): Promise<PaymentRefundResult>
  /** 主动查询支付结果（回调漏单兜底）；返回 null 表示通道侧查无此单。本地 mock 不实现 */
  queryPayment?(orderNo: string): Promise<PaymentQueryResult | null>
  /** 复审 R09：关闭待支付交易（取消订单时调用，防止取消后用户仍能付款）；失败由调用方 best-effort 捕获 */
  closePayment?(orderNo: string): Promise<void>
}

export interface LocalRefundRecord {
  refundNo: string
  orderNo: string
  amountFen: number
  createdAt: Date
}

/** 本地联调支付：只返回展示参数，支付成功由测试 mock 入口模拟；退款仅记录退款单。 */
@Injectable()
export class LocalPaymentAdapter implements PaymentAdapter {
  private readonly refunds: LocalRefundRecord[] = []

  createPayParams(orderNo: string): Promise<Record<string, string>> {
    return Promise.resolve({ provider: 'mock', orderNo, message: '本地联调订单，请在测试接口确认支付' })
  }

  refund(orderNo: string, amountFen: number): Promise<PaymentRefundResult> {
    const record: LocalRefundRecord = { refundNo: `RF${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, orderNo, amountFen, createdAt: new Date() }
    this.refunds.push(record)
    return Promise.resolve({ refundNo: record.refundNo })
  }

  /** 本地 mock 无真实交易可关：记录调用便于测试断言。 */
  readonly closedOrders: string[] = []

  closePayment(orderNo: string): Promise<void> {
    this.closedOrders.push(orderNo)
    return Promise.resolve()
  }

  /** 测试/联调用：查看已记录的退款单。 */
  listRefunds(): LocalRefundRecord[] {
    return this.refunds.map((refund) => ({ ...refund }))
  }
}
