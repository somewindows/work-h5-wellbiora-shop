import { Injectable } from '@nestjs/common'

export const PAYMENT_ADAPTER = Symbol('PAYMENT_ADAPTER')

export interface PaymentAdapter {
  createPayParams(orderNo: string): Record<string, string>
}

/** 本地联调支付：只返回展示参数，支付成功由测试 mock 入口模拟。 */
@Injectable()
export class LocalPaymentAdapter implements PaymentAdapter {
  createPayParams(orderNo: string): Record<string, string> {
    return { provider: 'mock', orderNo, message: '本地联调订单，请在测试接口确认支付' }
  }
}
