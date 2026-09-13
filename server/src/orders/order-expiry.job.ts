import { Inject, Injectable, Logger } from '@nestjs/common'

import { TaskSchedulerService } from '../common/task-scheduler.service'

import { PAYMENT_ADAPTER, type PaymentAdapter } from './local-payment.adapter'
import { ORDER_REPOSITORY, type OrderRepository } from './order.repository'

/** 解析正数 env：非数字/非正数回落默认值，防止 NaN 阈值失效或 setInterval(1ms) 自旋 */
function positiveEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** 超时关单阈值：与 H5 订单详情文案「请在 24 小时内完成支付，超时订单将自动取消」对齐 */
const EXPIRE_HOURS = positiveEnv('ORDER_EXPIRE_HOURS', 24)
const CHECK_INTERVAL_MS = positiveEnv('ORDER_EXPIRE_CHECK_INTERVAL_MS', 5 * 60_000)
const BATCH_SIZE = 50

/**
 * 超时关单任务（复审 R09/报告第五节「24 小时自动取消承诺未实现」）：
 * 扫描 24 小时前创建、仍待支付的订单，本地取消 + best-effort 关微信交易。
 * 竞态安全：取消走条件更新（仍 pay+pending 才生效），扫描后支付回调先登记支付的订单
 * 影响 0 行自动让位，不用扫描时的旧对象覆盖写；任务可安全反复执行。
 */
@Injectable()
export class OrderExpiryJob {
  private readonly logger = new Logger(OrderExpiryJob.name)

  constructor(
    scheduler: TaskSchedulerService,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(PAYMENT_ADAPTER) private readonly paymentAdapter: PaymentAdapter,
  ) {
    scheduler.register('order-expiry', CHECK_INTERVAL_MS, async () => { await this.runOnce() })
  }

  /** 单轮执行（公开以便测试直接调用）；返回本轮取消的订单数。 */
  async runOnce(): Promise<number> {
    const cutoff = new Date(Date.now() - EXPIRE_HOURS * 3600_000)
    const expired = await this.orderRepository.findPendingExpired(cutoff, BATCH_SIZE)
    let cancelled = 0
    for (const order of expired) {
      // 条件更新取消：扫描后回调已登记支付的订单此处影响 0 行，跳过让位（R09 并发窗口的竞态安全处理）
      const done = await this.orderRepository.cancelIfPendingPayment(order.id, new Date())
      if (!done) continue
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: 'pay', toStatus: 'cancelled', source: 'system',
        remark: `超时未支付（>${EXPIRE_HOURS} 小时），系统自动取消`,
      })
      cancelled += 1
      if (this.paymentAdapter.closePayment) {
        try {
          await this.paymentAdapter.closePayment(order.orderNo)
        } catch (error) {
          this.logger.warn(`超时关单后关闭微信交易失败（订单 ${order.orderNo}）：${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    if (cancelled > 0) this.logger.log(`超时关单：本轮取消 ${cancelled} 笔超过 ${EXPIRE_HOURS} 小时未支付的订单`)
    return cancelled
  }
}
