import { AdminStatsService } from './admin-stats.service'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'

describe('AdminStatsService（数据概览聚合）', () => {
  let orders: InMemoryOrderRepository
  let service: AdminStatsService
  let seq = 0

  // 固定「现在」为 2026-09-17 15:30（本地时间），今日/昨日边界可控
  const NOW = new Date(2026, 8, 17, 15, 30, 0)

  const createOrder = async (overrides: Partial<OrderRecord> = {}): Promise<OrderRecord> => {
    seq += 1
    const order = orders.createOrder({
      orderNo: `WB20260917000${seq}`, userId: 'user-1', requestId: `req-${seq}`,
      status: 'pay', paymentStatus: 'pending', warehouseStatus: null, totalFen: 32900,
      realnameName: '张三', idcardEncrypted: 'enc', idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: '浙江省 金华市 义乌市', receiverDetail: '稠城街道 1 号',
      paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
      customsDeclareStatus: null, customsDeclaredAt: null, payerTotalFen: null, payCurrency: null,
      ...overrides,
    })
    return orders.saveOrder(order)
  }

  beforeEach(() => {
    orders = new InMemoryOrderRepository()
    service = new AdminStatsService(orders)
  })

  it('空库：全部计数为 0，趋势仍返回连续 7 天（含今天，升序补零）', async () => {
    const result = await service.overview(NOW)

    expect(result).toMatchObject({
      today: { orderCount: 0, paidCount: 0, paidTotalFen: 0 },
      yesterday: { orderCount: 0, paidCount: 0, paidTotalFen: 0 },
      pendingShipment: 0,
      refundingCount: 0,
    })
    expect(result.trend).toHaveLength(7)
    expect(result.trend.map((day) => day.date)).toEqual([
      '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
    ])
    expect(result.trend.every((day) => day.orderCount === 0)).toBe(true)
  })

  it('今日/昨日边界：23:59:59.999 归当天，次日 00:00 归明天（不进今日）', async () => {
    await createOrder({ createdAt: new Date(2026, 8, 17, 23, 59, 59, 999) }) // 今日最后一毫秒
    await createOrder({ createdAt: new Date(2026, 8, 17, 0, 0, 0, 0) }) // 今日第一毫秒
    await createOrder({ createdAt: new Date(2026, 8, 16, 23, 59, 59, 999) }) // 昨日最后一毫秒
    await createOrder({ createdAt: new Date(2026, 8, 18, 0, 0, 0, 0) }) // 明天：今日/昨日/趋势均不含

    const result = await service.overview(NOW)

    expect(result.today.orderCount).toBe(2)
    expect(result.yesterday.orderCount).toBe(1)
    // 趋势含今天不含明天：今天 2 单，明天那单不计入
    expect(result.trend[6]).toEqual({ date: '2026-09-17', orderCount: 2 })
    expect(result.trend[5]).toEqual({ date: '2026-09-16', orderCount: 1 })
  })

  it('支付口径：按 paid_at 归日；待支付/未付款取消不计，退款中/已退款仍计入支付事实', async () => {
    // 昨天创建、今天支付：今日 paidCount +1，但今日 orderCount 不含它
    await createOrder({
      createdAt: new Date(2026, 8, 16, 10, 0, 0), paidAt: new Date(2026, 8, 17, 9, 0, 0),
      status: 'ship', paymentStatus: 'paid', payerTotalFen: 32900,
    })
    // 今天支付、随后全额退款：仍计入今日支付
    await createOrder({
      createdAt: new Date(2026, 8, 17, 10, 0, 0), paidAt: new Date(2026, 8, 17, 10, 5, 0),
      status: 'cancelled', paymentStatus: 'refunded', payerTotalFen: 10000,
    })
    // 今天创建待支付：不计支付
    await createOrder({ createdAt: new Date(2026, 8, 17, 11, 0, 0), status: 'pay', paymentStatus: 'pending' })
    // 昨天支付：只计昨日
    await createOrder({
      createdAt: new Date(2026, 8, 16, 8, 0, 0), paidAt: new Date(2026, 8, 16, 8, 30, 0),
      status: 'ship', paymentStatus: 'paid', payerTotalFen: 5000,
    })

    const result = await service.overview(NOW)

    expect(result.today).toEqual({ orderCount: 2, paidCount: 2, paidTotalFen: 42900 })
    expect(result.yesterday).toEqual({ orderCount: 2, paidCount: 1, paidTotalFen: 5000 })
  })

  it('实付口径优先 payer_total_fen，历史订单缺实付回落订单总额', async () => {
    await createOrder({
      createdAt: new Date(2026, 8, 17, 9, 0, 0), paidAt: new Date(2026, 8, 17, 9, 1, 0),
      status: 'ship', paymentStatus: 'paid', totalFen: 32900, payerTotalFen: 30000, // 有优惠：实付优先
    })
    await createOrder({
      createdAt: new Date(2026, 8, 17, 9, 30, 0), paidAt: new Date(2026, 8, 17, 9, 31, 0),
      status: 'ship', paymentStatus: 'paid', totalFen: 25900, payerTotalFen: null, // 历史订单：回落总额
    })

    const result = await service.overview(NOW)

    expect(result.today.paidTotalFen).toBe(55900)
  })

  it('待发货 = status ship，退款中 = paymentStatus refunding', async () => {
    await createOrder({ createdAt: NOW, status: 'ship', paymentStatus: 'paid', paidAt: NOW })
    await createOrder({ createdAt: NOW, status: 'ship', paymentStatus: 'refunding', paidAt: NOW })
    await createOrder({ createdAt: NOW, status: 'receive', paymentStatus: 'paid', paidAt: NOW })
    await createOrder({ createdAt: NOW, status: 'pay', paymentStatus: 'pending' })

    const result = await service.overview(NOW)

    expect(result.pendingShipment).toBe(2) // ship 与支付状态无关（含退款中的待发货单）
    expect(result.refundingCount).toBe(1)
  })

  it('趋势补零：只有部分日期有单，中间零单日期补 0 且含今天', async () => {
    await createOrder({ createdAt: new Date(2026, 8, 11, 12, 0, 0) }) // 6 天前（趋势第一天）
    await createOrder({ createdAt: new Date(2026, 8, 11, 18, 0, 0) })
    await createOrder({ createdAt: new Date(2026, 8, 17, 8, 0, 0) }) // 今天
    await createOrder({ createdAt: new Date(2026, 8, 10, 23, 59, 59, 999) }) // 7 天前：超出窗口不计

    const result = await service.overview(NOW)

    expect(result.trend).toEqual([
      { date: '2026-09-11', orderCount: 2 },
      { date: '2026-09-12', orderCount: 0 },
      { date: '2026-09-13', orderCount: 0 },
      { date: '2026-09-14', orderCount: 0 },
      { date: '2026-09-15', orderCount: 0 },
      { date: '2026-09-16', orderCount: 0 },
      { date: '2026-09-17', orderCount: 1 },
    ])
  })
})
