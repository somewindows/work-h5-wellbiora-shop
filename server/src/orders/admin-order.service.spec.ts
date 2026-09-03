import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { AuditLogService } from '../admin/audit-log.service'
import { InMemoryAuditLogRepository } from '../admin/audit-log.repository'

import { AdminOrderService } from './admin-order.service'
import { LocalPaymentAdapter } from './local-payment.adapter'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'

describe('AdminOrderService', () => {
  const actor = { id: 'admin-1', username: 'operator' }
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let orders: InMemoryOrderRepository
  let warehouse: LocalWarehouseAdapter
  let payment: LocalPaymentAdapter
  let auditLogs: InMemoryAuditLogRepository
  let service: AdminOrderService
  let seq = 0

  const createOrder = async (overrides: Partial<OrderRecord> = {}): Promise<OrderRecord> => {
    seq += 1
    const order = orders.createOrder({
      orderNo: `WB20260901000${seq}`, userId: 'user-1', requestId: `req-${seq}`,
      status: 'pay', paymentStatus: 'pending', warehouseStatus: null, totalFen: 32900,
      realnameName: '张三', idcardEncrypted: crypto.encrypt('110101199001011234'), idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: '浙江省 金华市 义乌市', receiverDetail: '稠城街道 1 号',
      paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null,
      ...overrides,
    })
    return orders.saveOrder(order)
  }
  const createPaidOrder = async (warehouseStatus: string | null = 'local-accepted'): Promise<OrderRecord> => {
    const order = await createOrder({ status: 'ship', paymentStatus: 'paid', warehouseStatus, paidAt: new Date() })
    await warehouse.pushOrder(order.orderNo)
    return order
  }

  beforeEach(async () => {
    const catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    orders = new InMemoryOrderRepository()
    warehouse = new LocalWarehouseAdapter(catalog)
    payment = new LocalPaymentAdapter()
    auditLogs = new InMemoryAuditLogRepository()
    service = new AdminOrderService(orders, warehouse, payment, crypto, new AuditLogService(auditLogs))
  })

  it('取消待支付订单：仅关单，无资金动作', async () => {
    const order = await createOrder()

    const detail = await service.cancel(order.orderNo, { confirm: true }, actor)

    expect(detail).toMatchObject({ status: 'cancelled', paymentStatus: 'pending', refundFen: null })
    expect(payment.listRefunds()).toHaveLength(0)
    expect(detail.statusEvents).toEqual([expect.objectContaining({ fromStatus: 'pay', toStatus: 'cancelled', source: 'admin' })])
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
})
