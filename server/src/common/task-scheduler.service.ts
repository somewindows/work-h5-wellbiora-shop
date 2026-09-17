import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'

interface ScheduledTask {
  name: string
  intervalMs: number
  run: () => Promise<void>
  /** 单任务重叠保护：上一轮未结束时跳过本轮，避免同一任务并发执行（R10 评审建议） */
  running?: boolean
}

/**
 * 后台任务调度设施（复审 4.3：全仓此前没有任何调度/队列，R09 超时关单、R04 退款收敛、
 * R10 履约重试的共同前置）。刻意用最小实现：进程内 setInterval + 启动补偿跑一轮，
 * 单次执行异常隔离不拖垮进程；定时器 unref，不阻碍进程退出/测试收尾。
 * 不引入持久化队列：任务全部设计为「扫库 + 幂等收敛」，进程重启不漏事。
 */
@Injectable()
export class TaskSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskSchedulerService.name)
  private readonly tasks: ScheduledTask[] = []
  private readonly timers: NodeJS.Timeout[] = []

  register(name: string, intervalMs: number, run: () => Promise<void>): void {
    this.tasks.push({ name, intervalMs, run })
  }

  onModuleInit(): void {
    for (const task of this.tasks) {
      // 启动 5 秒后先补偿跑一轮（覆盖停机期间的存量），之后按周期执行
      const boot = setTimeout(() => void this.runSafely(task), 5000)
      boot.unref()
      const timer = setInterval(() => void this.runSafely(task), task.intervalMs)
      timer.unref()
      this.timers.push(timer, boot)
      this.logger.log(`后台任务已注册：${task.name}（每 ${Math.round(task.intervalMs / 60000)} 分钟一轮）`)
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer)
    this.timers.length = 0
  }

  private async runSafely(task: ScheduledTask): Promise<void> {
    if (task.running) return
    task.running = true
    try {
      await task.run()
    } catch (error) {
      this.logger.error(`后台任务 ${task.name} 执行失败（下轮重试）`, error instanceof Error ? error.stack : String(error))
    } finally {
      task.running = false
    }
  }
}
