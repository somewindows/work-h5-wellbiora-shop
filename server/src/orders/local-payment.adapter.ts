import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

export const PAYMENT_ADAPTER = Symbol('PAYMENT_ADAPTER')

export interface PaymentRefundResult {
  refundNo: string
}

export interface PaymentAdapter {
  createPayParams(orderNo: string): Record<string, string>
  /** 原路退款；金额单位：分 */
  refund(orderNo: string, amountFen: number): Promise<PaymentRefundResult>
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

  createPayParams(orderNo: string): Record<string, string> {
    return { provider: 'mock', orderNo, message: '本地联调订单，请在测试接口确认支付' }
  }

  async refund(orderNo: string, amountFen: number): Promise<PaymentRefundResult> {
    const record: LocalRefundRecord = { refundNo: `RF${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`, orderNo, amountFen, createdAt: new Date() }
    this.refunds.push(record)
    return { refundNo: record.refundNo }
  }

  /** 测试/联调用：查看已记录的退款单。 */
  listRefunds(): LocalRefundRecord[] {
    return this.refunds.map((refund) => ({ ...refund }))
  }
}
