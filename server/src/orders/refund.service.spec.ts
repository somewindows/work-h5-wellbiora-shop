import type { PaymentAdapter, PaymentRefundResult } from './local-payment.adapter'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'
import { InMemoryRefundRepository } from './refund.repository'
import { RefundService } from './refund.service'

/** 退款状态机（复审 R04/R05）：稳定退款单号、受理≠到账、异常恢复路径。 */
describe('RefundService', () => {
  let orders: InMemoryOrderRepository
  let refunds: InMemoryRefundRepository
  let order: OrderRecord

  const adapterWith = (overrides: Partial<PaymentAdapter>): PaymentAdapter => ({
    createPayParams: jest.fn(),
    refund: jest.fn((_orderNo: string, _amount: number, _total: number, outRefundNo: string): Promise<PaymentRefundResult> =>
      Promise.resolve({ refundNo: outRefundNo, refundId: '5030000001', status: 'PROCESSING' })),
    ...overrides,
  })

  beforeEach(async () => {
    orders = new InMemoryOrderRepository()
    refunds = new InMemoryRefundRepository()
    order = await orders.saveOrder(orders.createOrder({
      orderNo: 'WB20260913REFUND0001', userId: 'user-1', requestId: 'req-refund', status: 'ship', paymentStatus: 'paid',
      warehouseStatus: 'local-accepted', totalFen: 32900, realnameName: '张三', idcardEncrypted: 'x', idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: new Date(), cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: 'tx-1',
    }))
  })

  it('发起退款：先落库稳定退款单号（R+订单号+序号），通道受理 PROCESSING 时订单置退款中', async () => {
    const adapter = adapterWith({})
    const service = new RefundService(refunds, orders, adapter)

    const { refund, reused } = await service.requestRefund(order, 10000, '管理员退款')

    expect(reused).toBe(false)
    expect(refund).toMatchObject({ refundNo: `R${order.orderNo}01`, status: 'processing', wechatRefundId: '5030000001', channel: 'admin' })
    expect(adapter.refund).toHaveBeenCalledWith(order.orderNo, 10000, 32900, `R${order.orderNo}01`)
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ paymentStatus: 'refunding' })
    expect((await service.summarize(order)).refundableFen).toBe(22900) // 10000 在途占用
  })

  it('同一意图重复发起（在途同额）收敛到同一退款单，通道只调用一次（R05）', async () => {
    const adapter = adapterWith({})
    const service = new RefundService(refunds, orders, adapter)

    const first = await service.requestRefund(order, 10000, '管理员退款')
    const second = await service.requestRefund(order, 10000, '管理员退款')

    expect(second.reused).toBe(true)
    expect(second.refund.refundNo).toBe(first.refund.refundNo)
    expect(adapter.refund).toHaveBeenCalledTimes(1)
    expect(await refunds.findByOrderId(order.id)).toHaveLength(1)
  })

  it('在途退款未完结时发起不同金额被拒绝', async () => {
    const service = new RefundService(refunds, orders, adapterWith({}))
    await service.requestRefund(order, 10000, '管理员退款')

    await expect(service.requestRefund(order, 5000, '管理员退款')).rejects.toMatchObject({ code: 40002 })
  })

  it('部分退款到账后按剩余可退口径校验，超额拒绝（R04）', async () => {
    const service = new RefundService(refunds, orders, adapterWith({}))
    const first = await service.requestRefund(order, 10000, '管理员退款')
    await service.applyRefundStatus({ orderNo: order.orderNo, refundNo: first.refund.refundNo, refundStatus: 'SUCCESS' })

    const summary = await service.summarize(order)
    expect(summary).toMatchObject({ refundedFen: 10000, refundableFen: 22900 })
    await expect(service.requestRefund(order, 22901, '管理员退款')).rejects.toMatchObject({ code: 40003 })
  })

  it('通道报错但微信侧已受理：按原单号查询收敛为在途，不新建退款单（R05）', async () => {
    const adapter = adapterWith({
      refund: jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT')),
      queryRefund: jest.fn().mockResolvedValue({ status: 'PROCESSING', refundId: '5030000009' }),
    })
    const service = new RefundService(refunds, orders, adapter)

    const { refund } = await service.requestRefund(order, 10000, '管理员退款')

    expect(refund).toMatchObject({ refundNo: `R${order.orderNo}01`, status: 'processing', wechatRefundId: '5030000009' })
    expect(adapter.queryRefund).toHaveBeenCalledWith(`R${order.orderNo}01`)
    expect(await refunds.findByOrderId(order.id)).toHaveLength(1)
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ paymentStatus: 'refunding' })
  })

  it('通道报错且微信侧未受理：退款单置 failed，重试换新单号成功（R05）', async () => {
    const adapter = adapterWith({
      refund: jest.fn()
        .mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
        .mockImplementation((_orderNo: string, _amount: number, _total: number, outRefundNo: string): Promise<PaymentRefundResult> =>
          Promise.resolve({ refundNo: outRefundNo, status: 'PROCESSING' })),
      queryRefund: jest.fn().mockResolvedValue(null),
    })
    const service = new RefundService(refunds, orders, adapter)

    const first = await service.requestRefund(order, 10000, '管理员退款')
    expect(first.refund.status).toBe('failed')

    const second = await service.requestRefund(order, 10000, '管理员退款')
    expect(second.refund.refundNo).toBe(`R${order.orderNo}02`)
    expect(second.refund.status).toBe('processing')
    // failed 单不占用可退额度
    expect((await service.summarize(order)).processingFen).toBe(10000)
  })

  it('通道报错且查询也失败：保持处理中待回调收敛，向上抛出原错误', async () => {
    const adapter = adapterWith({
      refund: jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT')),
      queryRefund: jest.fn().mockRejectedValue(new Error('query failed too')),
    })
    const service = new RefundService(refunds, orders, adapter)

    await expect(service.requestRefund(order, 10000, '管理员退款')).rejects.toThrow('connect ETIMEDOUT')
    const [record] = await refunds.findByOrderId(order.id)
    expect(record.status).toBe('processing') // 未置 failed，避免误判未受理而重复退款
  })

  it('并发撞 refund_no 唯一索引：收敛到先提交的在途退款单（R05）', async () => {
    const adapter = adapterWith({})
    const service = new RefundService(refunds, orders, adapter)
    // 模拟并发：检查时无在途，落库时撞唯一键（对方已提交同序号退款单），重读出现 winner
    const winner = await refunds.save(refunds.create({
      refundNo: `R${order.orderNo}01`, orderId: order.id, orderNo: order.orderNo, amountFen: 10000, totalFen: 32900,
      status: 'processing', wechatRefundId: null, channel: 'admin', reason: '管理员退款', succeededAt: null,
    }))
    let findCalls = 0
    jest.spyOn(refunds, 'findByOrderId').mockImplementation(async (orderId: string) => {
      findCalls += 1
      // 前两次（summarize + 取序号）伪装成无记录，之后返回真实数据
      return findCalls <= 2 ? [] : InMemoryRefundRepository.prototype.findByOrderId.call(refunds, orderId)
    })
    jest.spyOn(refunds, 'save').mockRejectedValueOnce(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }))

    const result = await service.requestRefund(order, 10000, '管理员退款')

    expect(result.reused).toBe(true)
    expect(result.refund.refundNo).toBe(winner.refundNo)
    expect(adapter.refund).not.toHaveBeenCalled()
  })

  it('退款到账后再次收到 CLOSED 回调不翻案（成功是终态）', async () => {
    const service = new RefundService(refunds, orders, adapterWith({}))
    const { refund } = await service.requestRefund(order, 10000, '管理员退款')
    await service.applyRefundStatus({ orderNo: order.orderNo, refundNo: refund.refundNo, refundStatus: 'SUCCESS' })

    await service.applyRefundStatus({ orderNo: order.orderNo, refundNo: refund.refundNo, refundStatus: 'CLOSED' })

    const [record] = await refunds.findByOrderId(order.id)
    expect(record.status).toBe('success')
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ refundFen: 10000 })
  })

  it('旧订单（迁移前已全额退款、无账本）收到缺金额补登回调时拒绝降级回可退', async () => {
    await orders.saveOrder({ ...order, paymentStatus: 'refunded', refundFen: 32900, refundedAt: new Date() })
    const service = new RefundService(refunds, orders, adapterWith({}))

    // 老代码发起的退款回调部署后才到达，且未带 amount.refund → 补登 0 元单
    await service.applyRefundStatus({ orderNo: order.orderNo, refundNo: 'RLEGACY01', refundStatus: 'SUCCESS' })

    // 账本重算 0 < 32900，护栏拒绝把 refunded 降级为 paid（防止退款按钮复活二次退款）
    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900 })
    const [record] = await refunds.findByOrderId(order.id)
    expect(record.reason).toContain('金额待人工核对')
  })
})
