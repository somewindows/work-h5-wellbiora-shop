import { Inject, Injectable, Logger } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'

import { PAYMENT_ADAPTER, type PaymentAdapter } from './local-payment.adapter'
import { ORDER_REPOSITORY, type OrderRecord, type OrderRepository } from './order.repository'
import { REFUND_REPOSITORY, type RefundRecord, type RefundRepository } from './refund.repository'

/** 退款单在途状态（占用可退额度） */
const PROCESSING_STATUS = 'processing'

export interface RefundSummary {
  /** 累计已到账退款（分） */
  refundedFen: number
  /** 在途退款占用（分） */
  processingFen: number
  /** 剩余可退（分） */
  refundableFen: number
  /** 在途退款单（同一订单同时只允许一笔） */
  processing: RefundRecord | null
}

export interface RefundNotifyInput {
  orderNo: string
  refundNo: string
  refundStatus: string
  refundId?: string
  amountFen?: number
  succeededAt?: Date
}

/**
 * 退款状态机（复审 R04/R05）：
 * - R04：受理（PROCESSING）只置「在途」，到账以回调/查退款结果收敛；订单按累计成功退款
 *   计算 paymentStatus（全额=refunded / 有在途=refunding / 部分成功无在途=paid），支持部分退款后再退。
 * - R05：退款单号发起前生成并落库、终身复用；微信对同一 out_refund_no 重发幂等；
 *   网络异常后先按原单号查询确认未受理才允许换新号，禁止凭网络错误重复发起。
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name)

  constructor(
    @Inject(REFUND_REPOSITORY) private readonly refundRepository: RefundRepository,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(PAYMENT_ADAPTER) private readonly paymentAdapter: PaymentAdapter,
  ) {}

  async listByOrder(orderId: string): Promise<RefundRecord[]> {
    return this.refundRepository.findByOrderId(orderId)
  }

  async summarize(order: OrderRecord): Promise<RefundSummary> {
    const refunds = await this.refundRepository.findByOrderId(order.id)
    const refundedFen = refunds.filter((refund) => refund.status === 'success').reduce((sum, refund) => sum + refund.amountFen, 0)
    const processing = refunds.find((refund) => refund.status === PROCESSING_STATUS) ?? null
    return {
      refundedFen,
      processingFen: processing?.amountFen ?? 0,
      refundableFen: order.totalFen - refundedFen - (processing?.amountFen ?? 0),
      processing,
    }
  }

  /**
   * 发起退款。返回 reused=true 表示本次请求收敛到已有在途退款单（重复点击/重试幂等）。
   * 顺序铁律：先落退款单（processing）→ 再调通道；通道报错先按原单号查询，确认未受理才置 failed。
   */
  async requestRefund(order: OrderRecord, amountFen: number, reason: string): Promise<{ refund: RefundRecord; reused: boolean }> {
    const summary = await this.summarize(order)
    if (summary.processing) {
      if (summary.processing.amountFen === amountFen) return { refund: summary.processing, reused: true }
      throw new BusinessException(40002, `该订单有一笔处理中的退款（${summary.processing.amountFen} 分），请等待其结果后再发起`)
    }
    if (amountFen <= 0 || amountFen > summary.refundableFen) {
      throw new BusinessException(40003, `退款金额需在 1 与剩余可退 ${summary.refundableFen} 分之间`)
    }

    const seq = (await this.refundRepository.findByOrderId(order.id)).length + 1
    const refundNo = `R${order.orderNo}${String(seq).padStart(2, '0')}`
    let record: RefundRecord
    try {
      record = await this.refundRepository.save(this.refundRepository.create({
        refundNo, orderId: order.id, orderNo: order.orderNo, amountFen, totalFen: order.totalFen,
        status: PROCESSING_STATUS, wechatRefundId: null, channel: 'admin', reason, succeededAt: null,
      }))
    } catch (error) {
      // 并发同序号撞 refund_no 唯一索引：收敛到先提交的在途退款单，同一意图只出现一笔
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        const winner = await this.summarize(order)
        if (winner.processing) return { refund: winner.processing, reused: true }
      }
      throw error
    }

    try {
      const result = await this.paymentAdapter.refund(order.orderNo, amountFen, order.totalFen, refundNo)
      record = await this.applyRemoteStatus(order, record, result.status, result.refundId)
      return { refund: record, reused: false }
    } catch (error) {
      // 网络/通道异常不代表未受理：先按原退款单号查询微信侧真实状态
      const settled = await this.recoverAfterRequestError(order, record, error)
      if (settled) return { refund: settled, reused: false }
      throw error
    }
  }

  /** 退款回调/查退款结果收敛入口：本地无单（商户平台发起）则补登，重复通知幂等。 */
  async applyRefundStatus(input: RefundNotifyInput): Promise<void> {
    const order = await this.orderRepository.findOneByOrderNo(input.orderNo)
    if (!order) throw new BusinessException(40404, '订单不存在', 404)

    let refund = await this.refundRepository.findByRefundNo(input.refundNo)
    if (!refund) {
      this.logger.warn(`退款回调未匹配本地退款单，按商户平台发起补登：${input.orderNo} / ${input.refundNo}`)
      refund = await this.refundRepository.save(this.refundRepository.create({
        refundNo: input.refundNo, orderId: order.id, orderNo: order.orderNo,
        amountFen: input.amountFen ?? 0, totalFen: order.totalFen,
        status: PROCESSING_STATUS, wechatRefundId: input.refundId ?? null, channel: 'platform',
        // 回调缺 amount.refund 时按 0 补登：不虚增已退，但剩余可退会被高估，标注待人工核对
        reason: input.amountFen == null ? '商户平台发起（回调补登，金额待人工核对）' : '商户平台发起（回调补登）',
        succeededAt: null,
      }))
    }
    if (refund.status === 'success') return
    await this.applyRemoteStatus(order, refund, input.refundStatus, input.refundId, input.succeededAt)
  }

  /** 按通道状态更新退款单并收敛订单支付状态；返回更新后的退款单。 */
  private async applyRemoteStatus(order: OrderRecord, refund: RefundRecord, remoteStatus: string, refundId?: string, succeededAt?: Date): Promise<RefundRecord> {
    const status = mapRefundStatus(remoteStatus)
    const saved = await this.refundRepository.save({
      ...refund, status, wechatRefundId: refundId ?? refund.wechatRefundId,
      succeededAt: status === 'success' ? succeededAt ?? new Date() : refund.succeededAt,
    })
    if (status === 'success') {
      await this.settleOrder(order)
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'payment',
        remark: `退款到账（退款单 ${refund.refundNo}，${refund.amountFen} 分）`,
      })
    } else if (status === 'abnormal' || status === 'closed') {
      await this.settleOrder(order)
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'payment',
        remark: `退款单 ${refund.refundNo} 状态异常（${remoteStatus}），需人工跟进`,
      })
      this.logger.warn(`退款单 ${refund.refundNo}（订单 ${order.orderNo}）状态 ${remoteStatus}，需人工跟进`)
    } else if (status === 'failed') {
      // 未受理（发起方查询确认 404 或收敛任务判定长期查无）：释放占用额度，允许人工重新发起
      await this.settleOrder(order)
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'payment',
        remark: `退款单 ${refund.refundNo} 未被支付通道受理，额度已释放，可重新发起`,
      })
      this.logger.warn(`退款单 ${refund.refundNo}（订单 ${order.orderNo}）未被通道受理，额度已释放`)
    } else {
      // processing 及未知态：只按账本重算订单状态，不产生事件噪音
      await this.settleOrder(order)
    }
    return saved
  }

  /** 按退款单账本重算订单支付状态：全额=refunded / 有在途=refunding / 其余=paid。 */
  private async settleOrder(order: OrderRecord): Promise<void> {
    // 复审 R09：调用方传入的订单对象可能陈旧，先重读最新状态再结算——护栏判断与金额口径都以新鲜快照为准
    const fresh = await this.orderRepository.findOneByOrderNo(order.orderNo)
    if (!fresh) return
    const refunds = await this.refundRepository.findByOrderId(fresh.id)
    // 旧数据兼容：已置 refunded 但无账本记录（迁移前退的款），不重算以免"复活"为可退款
    if (refunds.length === 0 && fresh.paymentStatus === 'refunded') return
    const succeeded = refunds.filter((refund) => refund.status === 'success')
    const refundedFen = succeeded.reduce((sum, refund) => sum + refund.amountFen, 0)
    const hasProcessing = refunds.some((refund) => refund.status === PROCESSING_STATUS)
    const latest = succeeded.reduce<Date | null>((max, refund) => (refund.succeededAt && (!max || refund.succeededAt > max) ? refund.succeededAt : max), null)
    // 降级护栏：已全额退款的订单，账本重算不足额（如旧退款单补登缺金额）时只告警不降级回可退
    if (fresh.paymentStatus === 'refunded' && refundedFen < fresh.totalFen) {
      this.logger.error(`订单 ${fresh.orderNo} 已全额退款但账本重算仅 ${refundedFen} 分，拒绝降级，请人工核对退款账本`)
      return
    }
    const paymentStatus = refundedFen >= fresh.totalFen ? 'refunded' : hasProcessing ? 'refunding' : 'paid'
    // 复审 R09：定向更新三列替代整体覆盖写，不覆盖并发路径改动的其他字段（如仓储状态/备注）
    await this.orderRepository.updateRefundSettlement(fresh.id, {
      paymentStatus,
      refundFen: refundedFen > 0 ? refundedFen : null,
      refundedAt: latest,
    })
  }

  /** 退款请求报错后的恢复：查微信侧该退款单真实状态；确认未受理置 failed 允许换新号重试。 */
  private async recoverAfterRequestError(order: OrderRecord, refund: RefundRecord, requestError: unknown): Promise<RefundRecord | null> {
    if (!this.paymentAdapter.queryRefund) return null
    let queried: { status: string; refundId?: string } | null
    try {
      queried = await this.paymentAdapter.queryRefund(refund.refundNo)
    } catch (queryError) {
      this.logger.error(
        `退款请求异常且查询退款状态失败（退款单 ${refund.refundNo}），保持处理中待回调/人工收敛：${formatError(requestError)}；查询错误：${formatError(queryError)}`,
      )
      return null
    }
    if (queried) {
      this.logger.warn(`退款请求异常但微信侧已受理（退款单 ${refund.refundNo} 状态 ${queried.status}），按查询结果收敛`)
      return this.applyRemoteStatus(order, refund, queried.status, queried.refundId)
    }
    // 微信侧查无此退款单 = 未受理，置 failed 后调用方可安全换新单号重试
    const failed = await this.refundRepository.save({ ...refund, status: 'failed' })
    await this.settleOrder(order)
    this.logger.warn(`退款未被微信受理（退款单 ${refund.refundNo}）：${formatError(requestError)}，已置 failed 可重新发起`)
    return failed
  }
}

/** 通道退款状态 → 本地退款单状态（微信：PROCESSING/SUCCESS/ABNORMAL/CLOSED；未知态原样小写落库便于排查） */
export function mapRefundStatus(remoteStatus: string): string {
  switch (remoteStatus) {
    case 'SUCCESS': return 'success'
    case 'PROCESSING': return 'processing'
    case 'ABNORMAL': return 'abnormal'
    case 'CLOSED': return 'closed'
    default: return remoteStatus.toLowerCase()
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
