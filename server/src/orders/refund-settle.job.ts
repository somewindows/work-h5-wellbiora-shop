import { Inject, Injectable, Logger } from '@nestjs/common'

import { TaskSchedulerService } from '../common/task-scheduler.service'

import { PAYMENT_ADAPTER, type PaymentAdapter } from './local-payment.adapter'
import { REFUND_REPOSITORY, type RefundRepository } from './refund.repository'
import { RefundService } from './refund.service'

const CHECK_INTERVAL_MS = (() => {
  const parsed = Number(process.env.REFUND_SETTLE_CHECK_INTERVAL_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60_000
})()
/** 发起 1 分钟内的在途单让发起方请求自己收敛，任务不抢 */
const GRACE_MS = 60_000
/** 微信侧超 1 小时仍查无此退款单 = 未受理，置 failed 释放额度允许人工重新发起 */
const NOT_ACCEPTED_AFTER_MS = 3600_000

/**
 * 退款在途收敛任务（复审 4.3/R04）：退款到账以回调为准，回调可能丢失——
 * 定期按原退款单号查微信侧真实状态收敛；长期查无的按未受理置 failed 释放占用额度。
 * 本地 mock 通道无 queryRefund 时任务空转（本地退款即时 SUCCESS，不会在途）。
 */
@Injectable()
export class RefundSettleJob {
  private readonly logger = new Logger(RefundSettleJob.name)

  constructor(
    scheduler: TaskSchedulerService,
    @Inject(REFUND_REPOSITORY) private readonly refundRepository: RefundRepository,
    @Inject(PAYMENT_ADAPTER) private readonly paymentAdapter: PaymentAdapter,
    private readonly refundService: RefundService,
  ) {
    scheduler.register('refund-settle', CHECK_INTERVAL_MS, async () => { await this.runOnce() })
  }

  /** 单轮执行（公开以便测试直接调用）；返回本轮收敛的退款单数。 */
  async runOnce(): Promise<number> {
    if (!this.paymentAdapter.queryRefund) return 0
    const graceCutoff = new Date(Date.now() - GRACE_MS)
    const stuck = await this.refundRepository.findProcessing(graceCutoff)
    let settled = 0
    for (const refund of stuck) {
      const remote = await this.paymentAdapter.queryRefund(refund.refundNo)
      if (remote) {
        await this.refundService.applyRefundStatus({
          orderNo: refund.orderNo, refundNo: refund.refundNo, refundStatus: remote.status, refundId: remote.refundId,
        })
        settled += 1
      } else if (Date.now() - refund.createdAt.getTime() > NOT_ACCEPTED_AFTER_MS) {
        // 置 failed + 释放额度 + 事件流均由退款状态机完成
        await this.refundService.applyRefundStatus({ orderNo: refund.orderNo, refundNo: refund.refundNo, refundStatus: 'FAILED' })
        settled += 1
      }
    }
    if (settled > 0) this.logger.log(`退款收敛：本轮处理 ${settled} 笔在途退款单`)
    return settled
  }
}
