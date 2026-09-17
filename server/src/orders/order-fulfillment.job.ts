import { Inject, Injectable, Logger } from '@nestjs/common'

import { TaskSchedulerService } from '../common/task-scheduler.service'

import { OrderFulfillmentService } from './order-fulfillment.service'
import { ORDER_REPOSITORY, type OrderRepository } from './order.repository'

const CHECK_INTERVAL_MS = (() => {
  const parsed = Number(process.env.FULFILLMENT_CHECK_INTERVAL_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60_000
})()
/** 自动重试窗口：支付后 24h 内的订单由 job 收敛；超窗订单转人工（后台「重推推仓/报关」） */
const RETRY_WINDOW_HOURS = (() => {
  const parsed = Number(process.env.FULFILLMENT_RETRY_WINDOW_HOURS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24
})()
const BATCH_LIMIT = 50

/**
 * 履约收敛任务（复审 R10）：推仓/海关申报是支付落库后的可重试后续步骤——
 * 回调路径 best-effort 立即执行一次，失败的由本任务扫库幂等重试；
 * 申报在途（SUBMITTED/PROCESSING/UNDECLARED）定期向微信查询收敛状态。
 * EXCEPT/FAIL 为终态不自动重试（多为业务退单，需人工处理后后台重推）。
 */
@Injectable()
export class OrderFulfillmentJob {
  private readonly logger = new Logger(OrderFulfillmentJob.name)

  constructor(
    scheduler: TaskSchedulerService,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    private readonly fulfillment: OrderFulfillmentService,
  ) {
    scheduler.register('order-fulfillment', CHECK_INTERVAL_MS, async () => { await this.runOnce() })
  }

  /** 单轮执行（公开以便测试直接调用）；返回 { pushed, declared, converged } 处理计数。 */
  async runOnce(): Promise<{ pushed: number; declared: number; converged: number }> {
    const since = new Date(Date.now() - RETRY_WINDOW_HOURS * 3600_000)
    let pushed = 0
    let declared = 0
    let converged = 0

    for (const order of await this.orderRepository.findPendingWarehousePush(since, BATCH_LIMIT)) {
      try {
        if (await this.fulfillment.pushWarehouseIfNeeded(order.orderNo)) pushed += 1
      } catch (error) {
        this.logger.error(`履约收敛：订单 ${order.orderNo} 推仓处理异常（下轮重试）`, error instanceof Error ? error.stack : String(error))
      }
    }
    // 报关能力未启用（未配 APIv2 密钥等）时跳过申报类扫描，避免空转
    if (!this.fulfillment.customsEnabled()) return { pushed, declared, converged }
    for (const order of await this.orderRepository.findPendingCustomsDeclare(since, BATCH_LIMIT)) {
      try {
        if (await this.fulfillment.declareCustomsIfNeeded(order.orderNo)) declared += 1
      } catch (error) {
        this.logger.error(`履约收敛：订单 ${order.orderNo} 申报处理异常（下轮重试）`, error instanceof Error ? error.stack : String(error))
      }
    }
    for (const order of await this.orderRepository.findConvergingCustomsDeclare(since, BATCH_LIMIT)) {
      try {
        if (await this.fulfillment.convergeDeclaration(order.orderNo)) converged += 1
      } catch (error) {
        this.logger.error(`履约收敛：订单 ${order.orderNo} 申报查询异常（下轮重试）`, error instanceof Error ? error.stack : String(error))
      }
    }
    if (pushed + declared + converged > 0) {
      this.logger.log(`履约收敛：本轮推仓 ${pushed} 单、申报 ${declared} 单、申报状态查询 ${converged} 单`)
    }
    return { pushed, declared, converged }
  }
}
