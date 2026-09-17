import { TaskSchedulerService } from '../common/task-scheduler.service'

import { LocalPaymentAdapter } from './local-payment.adapter'
import { OrderExpiryJob } from './order-expiry.job'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'

/** 超时关单任务（复审 4.3/R09）：兑现 H5「24 小时未支付自动取消」文案。 */
describe('OrderExpiryJob', () => {
  let orders: InMemoryOrderRepository
  let adapter: LocalPaymentAdapter
  let job: OrderExpiryJob

  const createOrder = async (overrides: Partial<OrderRecord>): Promise<OrderRecord> => {
    const order = await orders.saveOrder(orders.createOrder({
      orderNo: 'WB20260913EXPIRE0001', userId: 'user-1', requestId: `req-${Math.random()}`, status: 'pay', paymentStatus: 'pending',
      warehouseStatus: null, totalFen: 32900, realnameName: '张三', idcardEncrypted: 'x', idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
      customsDeclareStatus: null, customsDeclaredAt: null,
    }))
    return orders.saveOrder({ ...order, ...overrides })
  }

  beforeEach(() => {
    orders = new InMemoryOrderRepository()
    adapter = new LocalPaymentAdapter()
    job = new OrderExpiryJob(new TaskSchedulerService(), orders, adapter)
  })

  it('超过 24 小时未支付的订单被自动取消：状态/取消时间/事件流/关闭微信交易', async () => {
    const order = await createOrder({ createdAt: new Date(Date.now() - 25 * 3600_000) })

    const cancelled = await job.runOnce()

    expect(cancelled).toBe(1)
    const saved = await orders.findOneByOrderNo(order.orderNo)
    expect(saved).toMatchObject({ status: 'cancelled' })
    expect(saved?.cancelledAt).toBeInstanceOf(Date)
    const events = await orders.findStatusEvents(order.id)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ fromStatus: 'pay', toStatus: 'cancelled', source: 'system' })
    expect(events[0].remark).toContain('24')
    expect(adapter.closedOrders).toEqual([order.orderNo])
  })

  it('未满 24 小时的待支付订单不动', async () => {
    const order = await createOrder({ createdAt: new Date(Date.now() - 3600_000) })

    const cancelled = await job.runOnce()

    expect(cancelled).toBe(0)
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ status: 'pay', cancelledAt: null })
    expect(adapter.closedOrders).toEqual([])
  })

  it('超期但已支付的订单不动（扫描条件排除）', async () => {
    const order = await createOrder({ status: 'ship', paymentStatus: 'paid', paidAt: new Date(), createdAt: new Date(Date.now() - 48 * 3600_000) })

    const cancelled = await job.runOnce()

    expect(cancelled).toBe(0)
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ status: 'ship', paymentStatus: 'paid' })
  })

  it('扫描后支付回调先登记支付的订单不被取消（条件更新让位，不回滚支付事实）', async () => {
    const order = await createOrder({ createdAt: new Date(Date.now() - 25 * 3600_000) })
    // 模拟竞态：job 扫描拿到待支付快照后，支付回调先完成登记
    const staleSnapshot = await orders.findPendingExpired(new Date(), 50)
    await orders.saveOrder({ ...order, status: 'ship', paymentStatus: 'paid', paidAt: new Date(), wechatTransactionId: 'tx-race' })
    jest.spyOn(orders, 'findPendingExpired').mockResolvedValueOnce(staleSnapshot)

    const cancelled = await job.runOnce()

    expect(cancelled).toBe(0)
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ status: 'ship', paymentStatus: 'paid', wechatTransactionId: 'tx-race' })
    expect(await orders.findStatusEvents(order.id)).toHaveLength(0)
    expect(adapter.closedOrders).toEqual([])
  })

  it('关闭微信交易失败不阻断取消流程（best-effort）', async () => {
    const order = await createOrder({ createdAt: new Date(Date.now() - 25 * 3600_000) })
    jest.spyOn(adapter, 'closePayment').mockRejectedValueOnce(new Error('wx api down'))

    const cancelled = await job.runOnce()

    expect(cancelled).toBe(1)
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ status: 'cancelled' })
  })
})
