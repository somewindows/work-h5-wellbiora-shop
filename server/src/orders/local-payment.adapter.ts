import { Injectable } from '@nestjs/common'

export const PAYMENT_ADAPTER = Symbol('PAYMENT_ADAPTER')

export interface PaymentRefundResult {
  refundNo: string
  /** 通道侧退款单号（微信 refund_id），受理后用于对账 */
  refundId?: string
  /** 通道受理状态（微信：PROCESSING/SUCCESS/ABNORMAL/CLOSED；本地 mock 恒 SUCCESS）。复审 R04：受理≠到账，禁止据受理直接置终态 */
  status: string
}

/** 退款查询结果（按业务退款单号 out_refund_no 查）；null 表示通道侧未受理该退款单 */
export interface PaymentRefundQueryResult {
  status: string
  refundId?: string
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
  /**
   * 原路退款；金额单位：分；totalFen 为原订单实付（微信退款接口要求）。
   * 复审 R05：outRefundNo 由服务层生成并先落库（稳定退款单号），重试必须复用同一号，
   * 适配器不得自行生成——微信对同一 out_refund_no 的重发是幂等的。
   */
  refund(orderNo: string, amountFen: number, totalFen: number, outRefundNo: string): Promise<PaymentRefundResult>
  /** 主动查询支付结果（回调漏单兜底）；返回 null 表示通道侧查无此单。本地 mock 不实现 */
  queryPayment?(orderNo: string): Promise<PaymentQueryResult | null>
  /** 复审 R05：网络异常后按原退款单号查询退款状态，禁止凭网络错误创建新退款号 */
  queryRefund?(outRefundNo: string): Promise<PaymentRefundQueryResult | null>
  /** 复审 R09：关闭待支付交易（取消订单时调用，防止取消后用户仍能付款）；失败由调用方 best-effort 捕获 */
  closePayment?(orderNo: string): Promise<void>
}

export interface LocalRefundRecord {
  refundNo: string
  orderNo: string
  amountFen: number
  status: string
  createdAt: Date
}

/** 本地联调支付：只返回展示参数，支付成功由测试 mock 入口模拟；退款记录单据并视为即时到账（SUCCESS）。 */
@Injectable()
export class LocalPaymentAdapter implements PaymentAdapter {
  private readonly refunds: LocalRefundRecord[] = []

  createPayParams(orderNo: string): Promise<Record<string, string>> {
    return Promise.resolve({ provider: 'mock', orderNo, message: '本地联调订单，请在测试接口确认支付' })
  }

  refund(orderNo: string, amountFen: number, _totalFen: number, outRefundNo: string): Promise<PaymentRefundResult> {
    const existing = this.refunds.find((refund) => refund.refundNo === outRefundNo)
    if (existing) return Promise.resolve({ refundNo: existing.refundNo, status: existing.status })
    const record: LocalRefundRecord = { refundNo: outRefundNo, orderNo, amountFen, status: 'SUCCESS', createdAt: new Date() }
    this.refunds.push(record)
    return Promise.resolve({ refundNo: record.refundNo, status: record.status })
  }

  queryRefund(outRefundNo: string): Promise<PaymentRefundQueryResult | null> {
    const record = this.refunds.find((refund) => refund.refundNo === outRefundNo)
    return Promise.resolve(record ? { status: record.status } : null)
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
