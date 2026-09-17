import { TaskSchedulerService } from '../common/task-scheduler.service'

import type { PaymentAdapter, PaymentRefundResult } from './local-payment.adapter'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'
import { RefundSettleJob } from './refund-settle.job'
import { InMemoryRefundRepository, type RefundRecord } from './refund.repository'
import { RefundService } from './refund.service'

/** 退款在途收敛任务（复审 4.3/R04）：回调丢失时按原单号查微信侧真实状态收敛。 */
describe('RefundSettleJob', () => {
  let orders: InMemoryOrderRepository
  let refunds: InMemoryRefundRepository
  let order: OrderRecord

  const adapterWith = (overrides: Partial<PaymentAdapter>): PaymentAdapter => ({
    createPayParams: jest.fn(),
    refund: jest.fn((_orderNo: string, _amount: number, _total: number, outRefundNo: string): Promise<PaymentRefundResult> =>
      Promise.resolve({ refundNo: outRefundNo, refundId: '5030000001', status: 'PROCESSING' })),
    ...overrides,
  })

  /** 发起一笔在途退款并把退款单创建时间回拨（绕过任务 1 分钟宽限/模拟超期） */
  const createProcessingRefund = async (adapter: PaymentAdapter, ageMs: number): Promise<RefundRecord> => {
    const service = new RefundService(refunds, orders, adapter)
    const { refund } = await service.requestRefund(order, 10000, '管理员退款')
    return refunds.save({ ...refund, createdAt: new Date(Date.now() - ageMs) })
  }

  beforeEach(async () => {
    orders = new InMemoryOrderRepository()
    refunds = new InMemoryRefundRepository()
    order = await orders.saveOrder(orders.createOrder({
      orderNo: 'WB20260913SETTLE0001', userId: 'user-1', requestId: `req-${Math.random()}`, status: 'ship', paymentStatus: 'paid',
      warehouseStatus: 'local-accepted', totalFen: 32900, realnameName: '张三', idcardEncrypted: 'x', idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: new Date(), cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: 'tx-1',
      customsDeclareStatus: null, customsDeclaredAt: null, payerTotalFen: null, payCurrency: null,
    }))
  })

  it('回调丢失时在途单按查询结果收敛为已到账，订单重算支付状态', async () => {
    const adapter = adapterWith({ queryRefund: jest.fn().mockResolvedValue({ status: 'SUCCESS', refundId: '5030000001' }) })
    const refund = await createProcessingRefund(adapter, 10 * 60_000)
    const job = new RefundSettleJob(new TaskSchedulerService(), refunds, adapter, new RefundService(refunds, orders, adapter))

    const settled = await job.runOnce()

    expect(settled).toBe(1)
    expect(adapter.queryRefund).toHaveBeenCalledWith(refund.refundNo)
    expect(await refunds.findByRefundNo(refund.refundNo)).toMatchObject({ status: 'success' })
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ paymentStatus: 'paid', refundFen: 10000 })
  })

  it('微信侧查无且未满 1 小时：保持处理中不误判', async () => {
    const adapter = adapterWith({ queryRefund: jest.fn().mockResolvedValue(null) })
    const refund = await createProcessingRefund(adapter, 10 * 60_000)
    const job = new RefundSettleJob(new TaskSchedulerService(), refunds, adapter, new RefundService(refunds, orders, adapter))

    const settled = await job.runOnce()

    expect(settled).toBe(0)
    expect(await refunds.findByRefundNo(refund.refundNo)).toMatchObject({ status: 'processing' })
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ paymentStatus: 'refunding' })
  })

  it('微信侧查无且超 1 小时：按未受理置 failed 并释放占用额度，允许重新发起', async () => {
    const adapter = adapterWith({ queryRefund: jest.fn().mockResolvedValue(null) })
    const refund = await createProcessingRefund(adapter, 2 * 3600_000)
    const job = new RefundSettleJob(new TaskSchedulerService(), refunds, adapter, new RefundService(refunds, orders, adapter))

    const settled = await job.runOnce()

    expect(settled).toBe(1)
    expect(await refunds.findByRefundNo(refund.refundNo)).toMatchObject({ status: 'failed' })
    const saved = await orders.findOneByOrderNo(order.orderNo)
    expect(saved).toMatchObject({ paymentStatus: 'paid', refundFen: null })
    const events = await orders.findStatusEvents(order.id)
    expect(events.at(-1)?.remark).toContain('未被支付通道受理')
  })

  it('通道无 queryRefund（本地 mock）时任务空转', async () => {
    const adapter = adapterWith({})
    const refund = await createProcessingRefund(adapter, 2 * 3600_000)
    const job = new RefundSettleJob(new TaskSchedulerService(), refunds, adapter, new RefundService(refunds, orders, adapter))

    const settled = await job.runOnce()

    expect(settled).toBe(0)
    expect(await refunds.findByRefundNo(refund.refundNo)).toMatchObject({ status: 'processing' })
  })
})
