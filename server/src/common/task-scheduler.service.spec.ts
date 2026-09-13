import { TaskSchedulerService } from './task-scheduler.service'

/** 后台任务调度设施（复审 4.3）：注册收集、启动补偿、异常隔离、销毁清理。 */
describe('TaskSchedulerService', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('启动 5 秒后补偿跑一轮，之后按周期执行；单次异常隔离不阻断后续轮次', async () => {
    jest.useFakeTimers()
    const scheduler = new TaskSchedulerService()
    let calls = 0
    scheduler.register('boom', 60_000, () => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve()
    })

    scheduler.onModuleInit()
    await jest.advanceTimersByTimeAsync(5000) // 补偿轮
    expect(calls).toBe(1)
    await jest.advanceTimersByTimeAsync(60_000) // 第一轮周期
    expect(calls).toBe(2)
    scheduler.onModuleDestroy()
  })

  it('销毁后定时器全部清理，不再触发', async () => {
    jest.useFakeTimers()
    const scheduler = new TaskSchedulerService()
    let calls = 0
    scheduler.register('tick', 60_000, () => { calls += 1; return Promise.resolve() })

    scheduler.onModuleInit()
    scheduler.onModuleDestroy()
    await jest.advanceTimersByTimeAsync(10 * 60_000)

    expect(calls).toBe(0)
  })

  it('未初始化时销毁是安全的（测试进程收尾场景）', () => {
    expect(() => new TaskSchedulerService().onModuleDestroy()).not.toThrow()
  })
})
