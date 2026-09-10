import { Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request, Response } from 'express'

import { OrderService } from '../orders/order.service'

import { WechatPayClient, type WechatNotifyHeaders } from './wechat-pay.client'

/** 支付回调解密后的关键字段（其余字段原样忽略） */
interface WechatPaidResource {
  out_trade_no: string
  transaction_id: string
  trade_state: string
  amount?: { total?: number; payer_total?: number }
  success_time?: string
}

interface WechatRefundResource {
  out_trade_no: string
  out_refund_no: string
  refund_status: string
}

interface WechatNotifyBody {
  id: string
  event_type: string
  resource_type: string
  resource: { algorithm: string; ciphertext: string; nonce: string; associated_data: string }
}

/**
 * 微信支付异步回调入口：无 JWT 守卫，信任边界 = V3 验签 + AES-GCM 解密 + 金额比对 + 幂等。
 * 仅当 WXPAY_* 配置齐全时由 OrdersModule 挂载；处理失败返回 FAIL 让微信重推。
 */
@Controller('payments/wechat')
export class PaymentNotifyController {
  private readonly logger = new Logger(PaymentNotifyController.name)

  constructor(
    private readonly client: WechatPayClient,
    private readonly orderService: OrderService,
  ) {}

  @Post('notify')
  @HttpCode(200)
  async handlePaidNotify(@Req() request: RawBodyRequest<Request>, @Res() response: Response): Promise<void> {
    const rawBody = this.extractRawBody(request)
    if (!rawBody || !(await this.verify(request, rawBody))) {
      this.respondFail(response, '验签失败')
      return
    }
    const notify = this.parseBody(rawBody)
    if (!notify) {
      this.respondFail(response, '报文格式非法')
      return
    }

    try {
      const resource = this.client.decryptNotifyResource<WechatPaidResource>(notify.resource)
      if (resource.trade_state !== 'SUCCESS') {
        // 非成功态（如 CLOSED/REVOKED）只记录不处理，回 SUCCESS 避免微信继续重推
        this.logger.warn(`支付回调非成功态：${resource.out_trade_no} ${resource.trade_state}`)
        response.json({ code: 'SUCCESS', message: '成功' })
        return
      }
      await this.orderService.handleWechatPaid({
        orderNo: resource.out_trade_no,
        transactionId: resource.transaction_id,
        paidTotalFen: resource.amount?.payer_total ?? resource.amount?.total ?? -1,
        paidAt: resource.success_time ? new Date(resource.success_time) : new Date(),
      })
      response.json({ code: 'SUCCESS', message: '成功' })
    } catch (error) {
      this.logger.error('支付回调处理失败', error)
      this.respondFail(response, '处理失败')
    }
  }

  @Post('refund-notify')
  @HttpCode(200)
  async handleRefundNotify(@Req() request: RawBodyRequest<Request>, @Res() response: Response): Promise<void> {
    const rawBody = this.extractRawBody(request)
    if (!rawBody || !(await this.verify(request, rawBody))) {
      this.respondFail(response, '验签失败')
      return
    }
    const notify = this.parseBody(rawBody)
    if (!notify) {
      this.respondFail(response, '报文格式非法')
      return
    }

    try {
      const resource = this.client.decryptNotifyResource<WechatRefundResource>(notify.resource)
      await this.orderService.handleWechatRefundNotified({
        orderNo: resource.out_trade_no,
        refundNo: resource.out_refund_no,
        refundStatus: resource.refund_status,
      })
      response.json({ code: 'SUCCESS', message: '成功' })
    } catch (error) {
      this.logger.error('退款回调处理失败', error)
      this.respondFail(response, '处理失败')
    }
  }

  private extractRawBody(request: RawBodyRequest<Request>): string | null {
    return request.rawBody?.toString('utf8') ?? null
  }

  private async verify(request: RawBodyRequest<Request>, rawBody: string): Promise<boolean> {
    const headers: WechatNotifyHeaders = {
      timestamp: String(request.headers['wechatpay-timestamp'] ?? ''),
      nonce: String(request.headers['wechatpay-nonce'] ?? ''),
      signature: String(request.headers['wechatpay-signature'] ?? ''),
      serial: String(request.headers['wechatpay-serial'] ?? ''),
    }
    if (!headers.timestamp || !headers.nonce || !headers.signature || !headers.serial) return false
    return this.client.verifyNotification(headers, rawBody)
  }

  private parseBody(rawBody: string): WechatNotifyBody | null {
    try {
      const parsed = JSON.parse(rawBody) as WechatNotifyBody
      if (!parsed.resource?.ciphertext || !parsed.resource?.nonce) return null
      return parsed
    } catch {
      return null
    }
  }

  private respondFail(response: Response, message: string): void {
    response.status(400).json({ code: 'FAIL', message })
  }
}
