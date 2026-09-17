import { Logger } from '@nestjs/common'

import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { AuditLogService } from '../admin/audit-log.service'
import { InMemoryAuditLogRepository } from '../admin/audit-log.repository'

import { AdminOrderService, ORDER_EXPORT_ROW_LIMIT } from './admin-order.service'
import { LocalPaymentAdapter, type PaymentAdapter } from './local-payment.adapter'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { OrderFulfillmentService } from './order-fulfillment.service'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'
import type { OrderService, WechatPaidInput } from './order.service'
import { InMemoryRefundRepository } from './refund.repository'
import { RefundService } from './refund.service'
import type { WechatCustomsService } from '../payments/wechat-customs.service'

describe('AdminOrderService', () => {
  const actor = { id: 'admin-1', username: 'operator', role: 'super' as const, mustChangePassword: false }
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let orders: InMemoryOrderRepository
  let warehouse: LocalWarehouseAdapter
  let payment: LocalPaymentAdapter
  let auditLogs: InMemoryAuditLogRepository
  let refundService: RefundService
  let orderService: { handleWechatPaid: jest.Mock }
  let fulfillment: OrderFulfillmentService
  let service: AdminOrderService
  let seq = 0

  const createOrder = async (overrides: Partial<OrderRecord> = {}): Promise<OrderRecord> => {
    seq += 1
    const order = orders.createOrder({
      orderNo: `WB20260901000${seq}`, userId: 'user-1', requestId: `req-${seq}`,
      status: 'pay', paymentStatus: 'pending', warehouseStatus: null, totalFen: 32900,
      realnameName: '张三', idcardEncrypted: crypto.encrypt('110101199001011234'), idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: '浙江省 金华市 义乌市', receiverDetail: '稠城街道 1 号',
      paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
      customsDeclareStatus: null, customsDeclaredAt: null, payerTotalFen: null, payCurrency: null,
      ...overrides,
    })
    return orders.saveOrder(order)
  }
  const createPaidOrder = async (warehouseStatus: string | null = 'local-accepted'): Promise<OrderRecord> => {
    const order = await createOrder({ status: 'ship', paymentStatus: 'paid', warehouseStatus, paidAt: new Date() })
    if (warehouseStatus) await warehouse.pushOrder(order.orderNo)
    return order
  }

  beforeEach(async () => {
    const catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    orders = new InMemoryOrderRepository()
    warehouse = new LocalWarehouseAdapter(catalog)
    payment = new LocalPaymentAdapter()
    auditLogs = new InMemoryAuditLogRepository()
    // OrderService 桩：仅模拟 handleWechatPaid 的落库效果，完整回调链路由其自身测试覆盖
    orderService = {
      handleWechatPaid: jest.fn(async (input: WechatPaidInput) => {
        const order = await orders.findOneByOrderNo(input.orderNo)
        if (order) await orders.saveOrder({ ...order, status: 'ship', paymentStatus: 'paid', paidAt: input.paidAt, wechatTransactionId: input.transactionId })
      }),
    }
    refundService = new RefundService(new InMemoryRefundRepository(), orders, payment)
    fulfillment = new OrderFulfillmentService(orders, warehouse, crypto)
    service = new AdminOrderService(orders, warehouse, payment, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, refundService, fulfillment)
  })

  it('取消待支付订单：仅关单，无资金动作', async () => {
    const order = await createOrder()

    const detail = await service.cancel(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ status: 'cancelled', paymentStatus: 'pending', refundFen: null })
    expect(payment.listRefunds()).toHaveLength(0)
    expect(payment.closedOrders).toContain(order.orderNo) // 复审 R09：取消同步关闭支付通道交易
    expect(detail.statusEvents).toEqual([expect.objectContaining({ fromStatus: 'pay', toStatus: 'cancelled', source: 'admin' })])
  })

  it('取消后收到扣款的订单（cancelled + paid）可走人工退款（复审 R09）', async () => {
    const order = await createOrder({
      status: 'cancelled', paymentStatus: 'paid', paidAt: new Date(), cancelledAt: new Date(),
      wechatTransactionId: '4200000123456789012345678901', systemRemark: '订单取消后收到微信扣款，需人工退款处理',
    })

    const detail = await service.refund(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundFen: 32900 })
    expect(payment.listRefunds()).toMatchObject([{ orderNo: order.orderNo, amountFen: 32900 }])
  })

  it('缺少二次确认时拒绝取消与退款', async () => {
    const order = await createOrder()

    await expect(service.cancel(order.orderNo, {} as never, actor)).rejects.toMatchObject({ code: 40003 })
    await expect(service.refund(order.orderNo, { confirm: false }, actor)).rejects.toMatchObject({ code: 40003 })
  })

  it('已支付未申报订单取消：撤单 + 全额原路退款', async () => {
    const order = await createPaidOrder()

    const detail = await service.cancel(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundFen: 32900 })
    expect(payment.listRefunds()).toMatchObject([{ orderNo: order.orderNo, amountFen: 32900 }])
    await expect(warehouse.getOrderStatus(order.orderNo)).resolves.toMatchObject({ status: '50' })
  })

  it('已申报（清关中）订单不可取消', async () => {
    const order = await createPaidOrder('15')

    await expect(service.cancel(order.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })
    expect(payment.listRefunds()).toHaveLength(0)
  })

  it('已取消订单不能重复取消', async () => {
    const order = await createOrder({ status: 'cancelled', cancelledAt: new Date() })

    await expect(service.cancel(order.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })
  })

  it('取消待支付订单与支付回调竞态落败：转已支付分支撤仓退款（复审 R09）', async () => {
    const order = await createOrder()
    // 模拟竞态：cancel 前置检查读到旧快照（待支付），但支付回调在条件写库前已登记支付并推仓
    const stale = { ...order }
    await orders.saveOrder({ ...order, status: 'ship', paymentStatus: 'paid', paidAt: new Date(), warehouseStatus: 'local-accepted' })
    await warehouse.pushOrder(order.orderNo)
    jest.spyOn(orders, 'findOneByOrderNo').mockResolvedValueOnce(stale)

    const detail = await service.cancel(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundFen: 32900 })
    expect(payment.listRefunds()).toMatchObject([{ orderNo: order.orderNo, amountFen: 32900 }])
    await expect(warehouse.getOrderStatus(order.orderNo)).resolves.toMatchObject({ status: '50' })
    // 审计快照 = 管理员发起时所见的待支付订单
    await expect(auditLogs.findByTarget('order', order.orderNo)).resolves.toMatchObject([
      { action: 'cancel_order', beforeData: { status: 'pay', paymentStatus: 'pending' }, afterData: { status: 'cancelled', paymentStatus: 'refunded' } },
    ])
  })

  it('取消条件更新落败且订单仍待支付：抛 40002 不改单（复审 R09）', async () => {
    const order = await createOrder()
    jest.spyOn(orders, 'cancelIfPendingPayment').mockResolvedValueOnce(false)

    await expect(service.cancel(order.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })

    expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ status: 'pay', paymentStatus: 'pending' })
    expect(payment.closedOrders).toHaveLength(0)
  })

  it('取消条件更新落败且订单已被并发取消：抛「订单已取消」（复审 R09）', async () => {
    const order = await createOrder()
    // 模拟竞态：另一取消在条件写库前已获胜
    const stale = { ...order }
    await orders.cancelIfPendingPayment(order.id, new Date())
    jest.spyOn(orders, 'findOneByOrderNo').mockResolvedValueOnce(stale)

    await expect(service.cancel(order.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002, message: '订单已取消' })
  })

  it('未支付订单不能退款，已退款订单不能重复退款，超额退款被拒绝', async () => {
    const unpaid = await createOrder()
    await expect(service.refund(unpaid.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })

    const paid = await createPaidOrder()
    await expect(service.refund(paid.orderNo, { confirm: true, amountFen: 32901 }, actor)).rejects.toMatchObject({ code: 40003 })

    const detail = await service.refund(paid.orderNo, { confirm: true }, actor)
    expect(detail).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900 })

    await expect(service.refund(paid.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })
    expect(payment.listRefunds()).toHaveLength(1)
  })

  it('通道受理在途（PROCESSING）时订单置退款中，回调到账后收敛为已退款（复审 R04）', async () => {
    const processingAdapter = {
      createPayParams: jest.fn(),
      refund: jest.fn((_no: string, _amount: number, _total: number, outRefundNo: string) =>
        Promise.resolve({ refundNo: outRefundNo, refundId: '5030000001', status: 'PROCESSING' })),
    } as unknown as PaymentAdapter
    const refunds = new RefundService(new InMemoryRefundRepository(), orders, processingAdapter)
    const svc = new AdminOrderService(orders, warehouse, processingAdapter, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, refunds, fulfillment)
    const order = await createPaidOrder()

    const detail = await svc.refund(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ paymentStatus: 'refunding', refundFen: null })
    expect(detail.refunds).toMatchObject([{ refundNo: `R${order.orderNo}01`, amountFen: 32900, status: 'processing', channel: 'admin' }])

    await refunds.applyRefundStatus({ orderNo: order.orderNo, refundNo: `R${order.orderNo}01`, refundStatus: 'SUCCESS' })
    const settled = await svc.detail(order.orderNo)
    expect(settled).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900, refundableFen: 0 })
  })

  it('部分退款到账后可再退剩余金额；在途同额重复退款收敛到同一笔（复审 R04/R05）', async () => {
    const order = await createPaidOrder()

    const first = await service.refund(order.orderNo, { confirm: true, amountFen: 10000 }, actor)
    expect(first).toMatchObject({ paymentStatus: 'paid', refundFen: 10000, refundableFen: 22900 })

    const second = await service.refund(order.orderNo, { confirm: true, amountFen: 22900 }, actor)
    expect(second).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900, refundableFen: 0 })
    expect(second.refunds.map((refund) => refund.amountFen)).toEqual([10000, 22900])
    // 全额到账后退款入口关闭
    await expect(service.refund(order.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })
    expect(payment.listRefunds()).toHaveLength(2)
  })

  it('在途退款未完成时重复退款（同额）幂等收敛，不产生新退款单（复审 R05）', async () => {
    const processingAdapter = {
      createPayParams: jest.fn(),
      refund: jest.fn((_no: string, _amount: number, _total: number, outRefundNo: string) =>
        Promise.resolve({ refundNo: outRefundNo, status: 'PROCESSING' })),
    } as unknown as PaymentAdapter
    const svc = new AdminOrderService(orders, warehouse, processingAdapter, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, new RefundService(new InMemoryRefundRepository(), orders, processingAdapter), fulfillment)
    const order = await createPaidOrder()

    await svc.refund(order.orderNo, { confirm: true }, actor)
    const repeat = await svc.refund(order.orderNo, { confirm: true }, actor)

    expect(processingAdapter.refund).toHaveBeenCalledTimes(1)
    expect(repeat.refunds).toHaveLength(1)
    expect(repeat.statusEvents.some((event) => event.remark?.includes('收敛到在途退款单'))).toBe(true)
  })

  it('已部分退款的订单取消：按剩余可退发起退款（退款校验先于撤仓，复审 R04）', async () => {
    const order = await createPaidOrder()
    await service.refund(order.orderNo, { confirm: true, amountFen: 10000 }, actor)

    const detail = await service.cancel(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundFen: 32900 })
    expect(payment.listRefunds().map((refund) => refund.amountFen)).toEqual([10000, 22900])
    expect(detail.statusEvents.some((event) => event.remark?.includes('发起退款 22900 分'))).toBe(true)
  })

  it('有在途部分退款时取消被拒绝（先等退款结果），仓储不撤单', async () => {
    const processingAdapter = {
      createPayParams: jest.fn(),
      refund: jest.fn((_no: string, _amount: number, _total: number, outRefundNo: string) =>
        Promise.resolve({ refundNo: outRefundNo, status: 'PROCESSING' })),
    } as unknown as PaymentAdapter
    const svc = new AdminOrderService(orders, warehouse, processingAdapter, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, new RefundService(new InMemoryRefundRepository(), orders, processingAdapter), fulfillment)
    const order = await createPaidOrder()
    await svc.refund(order.orderNo, { confirm: true, amountFen: 10000 }, actor)

    await expect(svc.cancel(order.orderNo, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 })
    // 退款校验在撤仓之前：仓储侧不受影响
    await expect(warehouse.getOrderStatus(order.orderNo)).resolves.toMatchObject({ status: 'local-accepted' })
  })

  it('同步仓储状态：出库映射为待收货，终止状态收敛为已取消并带海关退单标记', async () => {
    const order = await createPaidOrder()
    warehouse.mockOrderStatus(order.orderNo, '40')

    const shipped = await service.sync(order.orderNo, actor)
    expect(shipped).toMatchObject({ status: 'receive', warehouseStatus: '40', customsRejected: false })

    warehouse.mockOrderStatus(order.orderNo, '91', '海关退单：超出个人年度交易限值')
    const rejected = await service.sync(order.orderNo, actor)
    expect(rejected).toMatchObject({ status: 'cancelled', warehouseStatus: '91', customsRejected: true, systemRemark: '海关退单：超出个人年度交易限值' })
    await expect(auditLogs.findByTarget('order', order.orderNo)).resolves.toMatchObject([{ action: 'sync_order' }, { action: 'sync_order' }])
  })

  it('仓储侧无记录时同步返回业务错误', async () => {
    const order = await createOrder()

    await expect(service.sync(order.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
  })

  it('列表按状态与关键字过滤，身份证不明文出现在详情', async () => {
    await createOrder()
    const paid = await createPaidOrder()
    await createOrder()

    const byStatus = await service.list({ page: 1, pageSize: 20, status: 'ship' } as never)
    expect(byStatus.total).toBe(1)
    expect(byStatus.list[0]).toMatchObject({ orderNo: paid.orderNo, status: 'ship', paymentStatus: 'paid', warehouseStatus: 'local-accepted' })

    const byKeyword = await service.list({ page: 1, pageSize: 20, keyword: paid.orderNo.slice(-4) } as never)
    expect(byKeyword.total).toBe(1)

    const detail = await service.detail(paid.orderNo)
    expect(detail.idcard).toBe('110***********1234')
    expect(JSON.stringify(detail)).not.toContain('110101199001011234')
  })

  describe('exportCsv（订单导出，R08 对账）', () => {
    it('导出与列表同筛选口径：BOM + 中文表头 + 中文状态 + 金额元化 + 手机号脱敏 + 审计留痕', async () => {
      const paid = await createPaidOrder()
      await createOrder() // 待支付，不应出现在 ship 导出里

      const { csv, count } = await service.exportCsv({ status: 'ship' } as never, actor)

      expect(count).toBe(1)
      // 与列表筛选结果一致
      const page = await service.list({ page: 1, pageSize: 20, status: 'ship' } as never)
      expect(page.list.map((order) => order.orderNo)).toEqual([paid.orderNo])
      // BOM 前缀 + 中文表头 + 唯一数据行
      expect(csv.charCodeAt(0)).toBe(0xfeff)
      const lines = csv.slice(1).trim().split('\r\n')
      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe('订单号,订单状态,支付状态,订单总额(元),用户实付(元),优惠额(元),币种,支付时间,微信交易号,收件人姓名,收件人手机号(脱敏),创建时间')
      expect(lines[1]).toContain(paid.orderNo)
      expect(lines[1]).toContain('待发货')
      expect(lines[1]).toContain('已支付')
      expect(lines[1]).toContain('329.00')
      expect(lines[1]).toContain('138****0000')
      expect(lines[1]).not.toContain('13800000000')
      // 导出含脱敏个人信息，审计留痕（actor + 筛选条件 + 行数）
      await expect(auditLogs.findByTarget('order', 'batch')).resolves.toMatchObject([
        { action: 'export_orders', adminUsername: 'operator', beforeData: { filters: { status: 'ship' } }, afterData: { count: 1, truncated: false } },
      ])
    })

    it('导出封顶截断：仓储只取最近 limit 条（按创建时间倒序），服务层固定传 ORDER_EXPORT_ROW_LIMIT', async () => {
      const base = Date.now() - 3000
      await createOrder({ createdAt: new Date(base) })
      await createOrder({ createdAt: new Date(base + 1000) })
      const newest = await createOrder({ createdAt: new Date(base + 2000) })

      const rows = await orders.findAdminExport({}, 2)
      expect(rows).toHaveLength(2)
      expect(rows[0].orderNo).toBe(newest.orderNo)

      const spy = jest.spyOn(orders, 'findAdminExport')
      await service.exportCsv({} as never, actor)
      expect(spy).toHaveBeenCalledWith(expect.anything(), ORDER_EXPORT_ROW_LIMIT)
      expect(ORDER_EXPORT_ROW_LIMIT).toBe(10000)
    })

    it('CSV 转义：含逗号/引号/换行的字段双引号包裹且内部引号翻倍', async () => {
      await createOrder({ receiverName: '张,"三\n四"' })

      const { csv } = await service.exportCsv({} as never, actor)

      expect(csv).toContain('"张,""三\n四"""')
    })

    it('公式注入防护：以 = + @ 开头的收件人姓名导出时前缀单引号（M1），- 后接纯数字不误伤', async () => {
      await createOrder({ receiverName: '=cmd|/c calc' })
      await createOrder({ receiverName: '+8613800000000' })
      await createOrder({ receiverName: '-abc' }) // - 后非纯数字 → 防护
      await createOrder({ receiverName: '-123' }) // - 后纯数字 → 不加前缀（与负数金额同一豁免）

      const { csv } = await service.exportCsv({} as never, actor)

      expect(csv).toContain("'=cmd|/c calc")
      expect(csv).toContain("'+8613800000000")
      expect(csv).toContain("'-abc")
      expect(csv).toContain(',-123,')
    })

    it('导出达到封顶行数：审计标记 truncated 并告警（结果可能截断）', async () => {
      const order = await createPaidOrder()
      const spy = jest.spyOn(orders, 'findAdminExport').mockResolvedValue(Array.from({ length: ORDER_EXPORT_ROW_LIMIT }, () => ({ ...order })))
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

      const { count } = await service.exportCsv({} as never, actor)

      expect(count).toBe(ORDER_EXPORT_ROW_LIMIT)
      await expect(auditLogs.findByTarget('order', 'batch')).resolves.toMatchObject([
        { action: 'export_orders', afterData: { count: ORDER_EXPORT_ROW_LIMIT, truncated: true } },
      ])
      expect(warn.mock.calls.some((args) => String(args[0]).includes('截断'))).toBe(true)
      spy.mockRestore()
      warn.mockRestore()
    })

    it('未支付/历史订单实付为空时实付与优惠额留空、订单总额仍元化', async () => {
      const pending = await createOrder()

      const { csv } = await service.exportCsv({ keyword: pending.orderNo } as never, actor)

      const line = csv.slice(1).trim().split('\r\n')[1]
      expect(line).toContain(',329.00,,,,') // 总额 329.00，实付/优惠额/币种/支付时间留空
    })
  })

  describe('syncPayment（主动查单补状态）', () => {
    const buildService = (queryPayment: jest.Mock): AdminOrderService => {
      const adapter = { createPayParams: jest.fn(), refund: jest.fn(), queryPayment } as unknown as PaymentAdapter
      return new AdminOrderService(orders, warehouse, adapter, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, new RefundService(new InMemoryRefundRepository(), orders, adapter), fulfillment)
    }

    it('微信侧已支付：补登记支付结果、订单转已支付并写审计', async () => {
      const order = await createOrder()
      const svc = buildService(jest.fn().mockResolvedValue({ tradeState: 'SUCCESS', transactionId: 'tx-1', paidTotalFen: 32900, paidAt: new Date() }))

      const detail = await svc.syncPayment(order.orderNo, actor)

      expect(detail).toMatchObject({ status: 'ship', paymentStatus: 'paid' })
      expect(orderService.handleWechatPaid).toHaveBeenCalledWith(expect.objectContaining({ orderNo: order.orderNo, transactionId: 'tx-1', paidTotalFen: 32900 }))
      await expect(auditLogs.findByTarget('order', order.orderNo)).resolves.toMatchObject([{ action: 'sync_payment' }])
    })

    it('微信侧未支付或查无此单：拒绝且不登记', async () => {
      const order = await createOrder()
      const notPaid = buildService(jest.fn().mockResolvedValue({ tradeState: 'NOTPAY' }))
      const notFound = buildService(jest.fn().mockResolvedValue(null))

      await expect(notPaid.syncPayment(order.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
      await expect(notFound.syncPayment(order.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
      expect(orderService.handleWechatPaid).not.toHaveBeenCalled()
      await expect(service.detail(order.orderNo)).resolves.toMatchObject({ paymentStatus: 'pending' })
    })

    it('本地 mock 支付通道不支持查单', async () => {
      const order = await createOrder()

      await expect(service.syncPayment(order.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
    })

    it('已支付订单直接返回，不重复登记（幂等）', async () => {
      const order = await createPaidOrder()
      const svc = buildService(jest.fn())

      const detail = await svc.syncPayment(order.orderNo, actor)

      expect(detail.paymentStatus).toBe('paid')
      expect(orderService.handleWechatPaid).not.toHaveBeenCalled()
    })
  })

  describe('queryCustomsDeclaration（报关状态查询）', () => {
    const buildCustoms = (queryDeclaration: jest.Mock, enabled = true) =>
      ({ isEnabled: () => enabled, queryDeclaration }) as unknown as WechatCustomsService
    const buildService = (customs?: WechatCustomsService): AdminOrderService =>
      new AdminOrderService(orders, warehouse, payment, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, refundService, fulfillment, customs)

    it('已支付订单：回传申报状态与海关原始回执字段并写审计', async () => {
      const order = await createPaidOrder()
      await orders.saveOrder({ ...(await orders.findOneByOrderNo(order.orderNo))!, wechatTransactionId: 'tx-customs-1' })
      const customs = buildCustoms(jest.fn().mockResolvedValue({ state: 'EXCEPT', certCheckResult: 'SAME', detail: { state: 'EXCEPT', explanation: '电商企业备案信息不存在' } }))

      const result = await buildService(customs).queryCustomsDeclaration(order.orderNo, actor)

      expect(result).toMatchObject({ orderNo: order.orderNo, transactionId: 'tx-customs-1', state: 'EXCEPT', certCheckResult: 'SAME' })
      expect(result.detail).toMatchObject({ explanation: '电商企业备案信息不存在' })
      expect(customs.queryDeclaration).toHaveBeenCalledWith(order.orderNo, 'tx-customs-1')
      await expect(auditLogs.findByTarget('order', order.orderNo)).resolves.toMatchObject([{ action: 'query_customs' }])
    })

    it('无微信交易号（未支付/本地 mock 支付）：拒绝', async () => {
      const order = await createOrder()
      const customs = buildCustoms(jest.fn())

      await expect(buildService(customs).queryCustomsDeclaration(order.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
      expect(customs.queryDeclaration).not.toHaveBeenCalled()
    })

    it('报关能力未启用（缺少密钥或本地环境）：拒绝并给出清晰提示', async () => {
      const order = await createPaidOrder()
      await orders.saveOrder({ ...(await orders.findOneByOrderNo(order.orderNo))!, wechatTransactionId: 'tx-customs-2' })
      const disabled = buildCustoms(jest.fn(), false)

      await expect(buildService(disabled).queryCustomsDeclaration(order.orderNo, actor)).rejects.toMatchObject({ code: 40002, message: expect.stringContaining('报关能力未启用') })
      await expect(buildService(undefined).queryCustomsDeclaration(order.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
      expect(disabled.queryDeclaration).not.toHaveBeenCalled()
    })

    it('微信侧业务错误（如签名错误）：透传错误文案而不是 500', async () => {
      const order = await createPaidOrder()
      await orders.saveOrder({ ...(await orders.findOneByOrderNo(order.orderNo))!, wechatTransactionId: 'tx-customs-3' })
      const failing = buildCustoms(jest.fn().mockRejectedValue(new Error('报关失败：SIGNERROR 签名错误')))

      await expect(buildService(failing).queryCustomsDeclaration(order.orderNo, actor)).rejects.toMatchObject({ code: 40002, message: expect.stringContaining('SIGNERROR') })
    })
  })

  describe('R10 推仓解耦适配', () => {
    it('取消已支付但未推仓的订单：跳过撤仓、备注注明，履约收敛不会再推（复审 R10）', async () => {
      const order = await createPaidOrder(null) // 已支付、warehouseStatus=null（回调已登记、推仓尚未发生/失败待重试）
      const cancelSpy = jest.spyOn(warehouse, 'cancelOrder')

      const detail = await service.cancel(order.orderNo, { confirm: true }, actor)

      expect(detail.status).toBe('cancelled')
      expect(cancelSpy).not.toHaveBeenCalled()
      const events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark?.includes('订单尚未推仓，无需撤单'))).toBe(true)
    })

    it('retryFulfillment：已支付待发货订单重跑推仓并写审计（人工恢复入口）', async () => {
      const order = await createOrder({ status: 'ship', paymentStatus: 'paid', paidAt: new Date(), wechatTransactionId: 'tx-retry-1' })

      const detail = await service.retryFulfillment(order.orderNo, actor)

      expect(detail.warehouseStatus).toBe('local-accepted')
      await expect(auditLogs.findByTarget('order', order.orderNo)).resolves.toMatchObject([{ action: 'retry_fulfillment' }])
    })

    it('retryFulfillment：待支付/已取消订单拒绝', async () => {
      const pending = await createOrder()
      const cancelled = await createOrder({ status: 'cancelled', cancelledAt: new Date() })

      await expect(service.retryFulfillment(pending.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
      await expect(service.retryFulfillment(cancelled.orderNo, actor)).rejects.toMatchObject({ code: 40002 })
    })

    it('retryFulfillment：申报终态（EXCEPT）先条件重置再真实重申报（评审 B3）', async () => {
      const order = await createOrder({
        status: 'ship', paymentStatus: 'paid', paidAt: new Date(), warehouseStatus: 'local-accepted',
        wechatTransactionId: 'tx-retry-2', customsDeclareStatus: 'EXCEPT', customsDeclaredAt: new Date(),
      })
      const customs = {
        isEnabled: () => true,
        submitDeclaration: jest.fn().mockResolvedValue({ state: 'SUBMITTED', certCheckResult: 'SAME' }),
        queryDeclaration: jest.fn().mockResolvedValue({ state: 'SUBMITTED', certCheckResult: 'SAME', detail: {} }),
      } as unknown as WechatCustomsService
      const svc = new AdminOrderService(
        orders, warehouse, payment, crypto, new AuditLogService(auditLogs), orderService as unknown as OrderService, refundService,
        new OrderFulfillmentService(orders, warehouse, crypto, customs),
      )

      const detail = await svc.retryFulfillment(order.orderNo, actor)

      expect(customs.submitDeclaration).toHaveBeenCalledTimes(1)
      expect(detail.customsDeclareStatus).toBe('SUBMITTED')
      const events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark?.includes('重置报关终态（EXCEPT）'))).toBe(true)
      // 重复点击：申报已在途（SUBMITTED），不再重置也不再重复申报
      await svc.retryFulfillment(order.orderNo, actor)
      expect(customs.submitDeclaration).toHaveBeenCalledTimes(1)
    })

    it('retryFulfillment：申报终态但报关能力未启用时拒绝重置（防订单卡在中间态）', async () => {
      const order = await createOrder({
        status: 'ship', paymentStatus: 'paid', paidAt: new Date(), warehouseStatus: 'local-accepted',
        wechatTransactionId: 'tx-retry-3', customsDeclareStatus: 'EXCEPT', customsDeclaredAt: new Date(),
      })

      await expect(service.retryFulfillment(order.orderNo, actor)).rejects.toMatchObject({ code: 40002, message: expect.stringContaining('报关能力未启用') })
      // 终态未被重置
      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ customsDeclareStatus: 'EXCEPT' })
    })
  })
})
