import { Logger } from '@nestjs/common'

import { InMemoryCartRepository } from '../cart/cart.repository'
import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { ProfileService } from '../profile/profile.service'
import { InMemoryAddressRepository, InMemoryRealnameProfileRepository } from '../profile/profile.repository'
import { InMemoryUsersRepository } from '../users/users.repository'

import { InMemoryOrderRepository, type OrderRecord } from './order.repository'
import { OrderFulfillmentService } from './order-fulfillment.service'
import { OrderService } from './order.service'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { LocalPaymentAdapter, type PaymentAdapter, type PaymentRefundResult, type PayContext } from './local-payment.adapter'
import { InMemoryRefundRepository } from './refund.repository'
import { RefundService } from './refund.service'

describe('OrderService', () => {
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let cart: InMemoryCartRepository
  let catalog: InMemoryCatalogRepository
  let profile: ProfileService
  let orders: InMemoryOrderRepository
  let payment: LocalPaymentAdapter
  let refundService: RefundService
  let service: OrderService
  let users: InMemoryUsersRepository

  const buildService = (ordersRepo: InMemoryOrderRepository, paymentAdapter: PaymentAdapter, warehouse?: LocalWarehouseAdapter): OrderService => {
    const wh = warehouse ?? new LocalWarehouseAdapter(catalog)
    return new OrderService(
      cart, profile, ordersRepo, wh, crypto, paymentAdapter, catalog, users,
      new RefundService(new InMemoryRefundRepository(), ordersRepo, paymentAdapter),
      new OrderFulfillmentService(ordersRepo, wh, crypto),
    )
  }

  beforeEach(async () => {
    cart = new InMemoryCartRepository()
    catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    profile = new ProfileService(new InMemoryAddressRepository(), new InMemoryRealnameProfileRepository(), crypto)
    users = new InMemoryUsersRepository()
    const user = await users.create('13800000000')
    user.id = 'user-1'
    orders = new InMemoryOrderRepository()
    payment = new LocalPaymentAdapter()
    refundService = new RefundService(new InMemoryRefundRepository(), orders, payment)
    service = new OrderService(cart, profile, orders, new LocalWarehouseAdapter(catalog), crypto, payment, catalog, users, refundService, new OrderFulfillmentService(orders, new LocalWarehouseAdapter(catalog), crypto))
    await cart.save(cart.create({ userId: 'user-1', productId: 'WB10001', quantity: 1, checked: true }))
    await profile.createAddress('user-1', { name: '张三', phone: '13800000000', region: '浙江省 金华市 义乌市', detail: '稠城街道 1 号' })
    await profile.saveRealname('user-1', { name: '张三', idcard: '110101199001011234' })
  })

  it('收货人与实名姓名不一致时拒绝预检', async () => {
    const [address] = await profile.getAddresses('user-1')
    await profile.updateAddress('user-1', address.id, { name: '李四' })

    await expect(service.precheck('user-1')).rejects.toMatchObject({ code: 40002 })
  })

  it('应付金额超过 500000 分时拒绝预检', async () => {
    const item = await cart.findByUserAndProduct('user-1', 'WB10001')
    await cart.save({ ...item!, quantity: 16 })

    await expect(service.precheck('user-1')).rejects.toMatchObject({ code: 40001 })
  })

  it('同一 requestId 重复创建时返回同一订单', async () => {
    const first = await service.create('user-1', { requestId: 'request-1' })
    const second = await service.create('user-1', { requestId: 'request-1' })

    expect(second.orderNo).toBe(first.orderNo)
  })

  it('并发同幂等键撞唯一约束时，读取先提交的订单返回一致结果（复审 R03）', async () => {
    const ordersRepo = new InMemoryOrderRepository()
    const svc = buildService(ordersRepo, new LocalPaymentAdapter())
    // 模拟并发请求先提交的订单（服务层预检时尚未提交）；findByUserAndRequest 前置 + 锁内重查（复审 R06）各返回一次空
    await ordersRepo.saveOrder(ordersRepo.createOrder({
      orderNo: 'WB20260912WINNER0001', userId: 'user-1', requestId: 'request-race', status: 'pay', paymentStatus: 'pending',
      warehouseStatus: null, totalFen: 32900, realnameName: '张三', idcardEncrypted: 'x', idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
      customsDeclareStatus: null, customsDeclaredAt: null, payerTotalFen: null, payCurrency: null,
    }))
    jest.spyOn(ordersRepo, 'findByUserAndRequest').mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    jest.spyOn(ordersRepo, 'runInTransaction').mockRejectedValueOnce(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }))

    await expect(svc.create('user-1', { requestId: 'request-race' })).resolves.toEqual({ orderNo: 'WB20260912WINNER0001' })
  })

  it('待支付订单可以取消，已模拟支付的订单不可取消', async () => {
    const first = await service.create('user-1', { requestId: 'request-1' })
    await expect(service.cancel('user-1', first.orderNo)).resolves.toMatchObject({ status: 'cancelled' })

    await cart.save(cart.create({ userId: 'user-1', productId: 'WB10001', quantity: 1, checked: true }))
    const second = await service.create('user-1', { requestId: 'request-2' })
    await service.confirmMockPayment('user-1', second.orderNo)
    await expect(service.cancel('user-1', second.orderNo)).rejects.toMatchObject({ code: 40002 })
  })

  it('取消与支付回调竞态落败：条件更新让位，抛 40002 且不覆盖支付结果（复审 R09）', async () => {
    const { orderNo } = await service.create('user-1', { requestId: 'request-race-cancel' })
    // 模拟竞态：cancel 前置检查读到旧快照（待支付），但支付回调在条件写库前已登记支付
    const stale = (await orders.findOneByOrderNo(orderNo))!
    await orders.saveOrder({ ...stale, status: 'ship', paymentStatus: 'paid', paidAt: new Date(), wechatTransactionId: 'tx-winner' })
    jest.spyOn(orders, 'findByOrderNo').mockResolvedValueOnce(stale)

    await expect(service.cancel('user-1', orderNo)).rejects.toMatchObject({ code: 40002 })

    // 支付结果未被旧对象覆盖
    expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ status: 'ship', paymentStatus: 'paid', wechatTransactionId: 'tx-winner' })
  })

  it('mock 支付确认与取消竞态落败：抛 40002 不复活已取消订单（复审 R09）', async () => {
    const { orderNo } = await service.create('user-1', { requestId: 'request-race-mock' })
    // 模拟竞态：confirmMockPayment 前置检查读到旧快照（待支付），但取消在条件写库前已获胜
    const stale = (await orders.findOneByOrderNo(orderNo))!
    await orders.cancelIfPendingPayment(stale.id, new Date())
    jest.spyOn(orders, 'findByOrderNo').mockResolvedValueOnce(stale)

    await expect(service.confirmMockPayment('user-1', orderNo)).rejects.toMatchObject({ code: 40002 })

    expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ status: 'cancelled', paymentStatus: 'pending' })
  })

  it('预检价格以 catalog 当前价为准', async () => {
    const product = await catalog.findById('WB10001')
    await catalog.save({ ...product!, priceFen: 12345 })

    await expect(service.precheck('user-1')).resolves.toMatchObject({ payableFen: 12345 })
  })

  it('商品下架后拒绝预检与下单', async () => {
    const product = await catalog.findById('WB10001')
    await catalog.save({ ...product!, isActive: false })

    await expect(service.precheck('user-1')).rejects.toMatchObject({ code: 40006 })
    await expect(service.create('user-1', { requestId: 'request-off' })).rejects.toMatchObject({ code: 40006 })
  })

  describe('handleWechatPaid（支付回调）', () => {
    const paidInput = (orderNo: string, totalFen = 32900) => ({
      orderNo, transactionId: '4200000123456789012345678901', paidTotalFen: totalFen, paidAt: new Date(),
    })

    it('回调成功后订单变为已支付并记录微信单号', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-1' })

      await service.handleWechatPaid(paidInput(orderNo))

      const order = await service.get('user-1', orderNo)
      expect(order.status).toBe('ship')
      expect(order.payTime).not.toBeNull()
    })

    it('同一回调重复推送幂等，不产生重复状态事件', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-2' })
      await service.handleWechatPaid(paidInput(orderNo))
      await service.handleWechatPaid(paidInput(orderNo))

      const order = await service.get('user-1', orderNo)
      expect(order.status).toBe('ship')
    })

    it('回调金额与订单不符时拒绝并告警', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-3' })

      await expect(service.handleWechatPaid(paidInput(orderNo, 1))).rejects.toMatchObject({ code: 40003 })
      const order = await service.get('user-1', orderNo)
      expect(order.status).toBe('pay')
    })

    it('已取消订单的迟到扣款登记支付事实、不推仓，转人工退款（复审 R09）', async () => {
      const ordersRepo = new InMemoryOrderRepository()
      const warehouse = new LocalWarehouseAdapter(catalog)
      const paymentAdapter = new LocalPaymentAdapter()
      const svc = new OrderService(
        cart, profile, ordersRepo, warehouse, crypto, paymentAdapter, catalog, users,
        new RefundService(new InMemoryRefundRepository(), ordersRepo, paymentAdapter),
        new OrderFulfillmentService(ordersRepo, warehouse, crypto),
      )
      const { orderNo } = await svc.create('user-1', { requestId: 'request-pay-4' })
      await svc.cancel('user-1', orderNo)

      await svc.handleWechatPaid({ ...paidInput(orderNo), currency: 'CNY' })

      const record = await ordersRepo.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({
        status: 'cancelled',
        paymentStatus: 'paid',
        wechatTransactionId: '4200000123456789012345678901',
        systemRemark: '订单取消后收到微信扣款，需人工退款处理',
        // R08：迟到扣款同样落对账依据（实付缺省按总额记）
        payerTotalFen: 32900,
        payCurrency: 'CNY',
      })
      // 已取消订单不推仓
      expect(await warehouse.getOrderStatus(orderNo)).toBeNull()
      const events = await ordersRepo.findStatusEvents(record!.id)
      expect(events.some((event) => event.remark?.includes('待人工退款'))).toBe(true)
    })

    it('已取消订单的迟到扣款金额不符仍拒绝登记', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-5' })
      await service.cancel('user-1', orderNo)

      await expect(service.handleWechatPaid(paidInput(orderNo, 1))).rejects.toMatchObject({ code: 40003 })
    })

    it('取消待支付订单时同步关闭支付通道交易（复审 R09）', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-close-1' })

      await service.cancel('user-1', orderNo)

      expect(payment.closedOrders).toContain(orderNo)
    })

    it('优惠支付（实付小于订单总额）按订单总额正常登记，实付与币种落库（复审 R08）', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-coupon' })

      await service.handleWechatPaid({ ...paidInput(orderNo), payerTotalFen: 32800, currency: 'CNY' })

      const order = await service.get('user-1', orderNo)
      expect(order.status).toBe('ship')
      // R08 对账依据落库：实付 32800 / 币种 CNY 随支付标记同一条件更新写入（优惠额 = 32900-32800 读取时派生）
      const record = await orders.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({ payerTotalFen: 32800, payCurrency: 'CNY' })
    })

    it('微信缺省 payer_total 时按订单总额记实付（优惠额自然为 0，R08）', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-nopayer' })

      await service.handleWechatPaid(paidInput(orderNo)) // 不传 payerTotalFen / currency

      const record = await orders.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({ paymentStatus: 'paid', payerTotalFen: 32900, payCurrency: null })
    })

    it('非 CNY 币种仅告警不拒绝，原样落库（R08）', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-currency' })
      const warn = jest.spyOn(Logger.prototype, 'warn')

      await service.handleWechatPaid({ ...paidInput(orderNo), currency: 'USD' })

      const record = await orders.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({ paymentStatus: 'paid', payerTotalFen: 32900, payCurrency: 'USD' })
      expect(warn.mock.calls.some((args) => String(args[0]).includes('币种异常'))).toBe(true)
      warn.mockRestore()
    })

    it('mock 支付确认落对账依据：实付=订单总额、币种 CNY（R08）', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-mock-pay' })

      await service.confirmMockPayment('user-1', orderNo)

      const record = await orders.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({ paymentStatus: 'paid', payerTotalFen: 32900, payCurrency: 'CNY' })
    })

    it('取消在回调标记支付前获胜：条件更新落败后登记支付事实、未推仓不复活订单（复审 R09/R10）', async () => {
      const ordersRepo = new InMemoryOrderRepository()
      const warehouse = new LocalWarehouseAdapter(catalog)
      const paymentAdapter = new LocalPaymentAdapter()
      const svc = new OrderService(
        cart, profile, ordersRepo, warehouse, crypto, paymentAdapter, catalog, users,
        new RefundService(new InMemoryRefundRepository(), ordersRepo, paymentAdapter),
        new OrderFulfillmentService(ordersRepo, warehouse, crypto),
      )
      const { orderNo } = await svc.create('user-1', { requestId: 'request-race-cb' })
      // 模拟竞态：取消在回调条件写库前获胜，markPaidIfPending 落败（R10 后推仓在标记之后，不再有孤儿推仓窗口）
      jest.spyOn(ordersRepo, 'markPaidIfPending').mockImplementationOnce(async () => {
        await svc.cancel('user-1', orderNo)
        return false
      })

      await svc.handleWechatPaid(paidInput(orderNo))

      const record = await ordersRepo.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({
        status: 'cancelled',
        paymentStatus: 'paid',
        wechatTransactionId: '4200000123456789012345678901',
        systemRemark: '订单取消后收到微信扣款，需人工退款处理',
      })
      // 推仓在支付登记之后，落败分支不再发生推仓
      expect(await warehouse.getOrderStatus(orderNo)).toBeNull()
      const events = await ordersRepo.findStatusEvents(record!.id)
      expect(events.some((event) => event.remark?.includes('待人工退款'))).toBe(true)
    })

    it('推仓故障不阻塞支付登记：订单正常转待发货，warehouseStatus 留空待履约收敛（复审 R10）', async () => {
      const ordersRepo = new InMemoryOrderRepository()
      const warehouse = new LocalWarehouseAdapter(catalog)
      const paymentAdapter = new LocalPaymentAdapter()
      const fulfillment = new OrderFulfillmentService(ordersRepo, warehouse, crypto)
      const svc = new OrderService(
        cart, profile, ordersRepo, warehouse, crypto, paymentAdapter, catalog, users,
        new RefundService(new InMemoryRefundRepository(), ordersRepo, paymentAdapter),
        fulfillment,
      )
      const { orderNo } = await svc.create('user-1', { requestId: 'request-push-fail' })
      const pushOrder = jest.spyOn(warehouse, 'pushOrder').mockRejectedValueOnce(new Error('仓储接口超时'))

      await svc.handleWechatPaid(paidInput(orderNo))

      // 支付事实已登记，推仓失败只留空待重试
      const record = await ordersRepo.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({ status: 'ship', paymentStatus: 'paid', warehouseStatus: null })
      const events = await ordersRepo.findStatusEvents(record!.id)
      expect(events.some((event) => event.remark?.includes('推仓失败'))).toBe(true)
      // 仓储恢复后重试收敛：warehouseStatus 落库且失败事件不重复
      await fulfillment.pushWarehouseIfNeeded(orderNo)
      expect(await ordersRepo.findOneByOrderNo(orderNo)).toMatchObject({ warehouseStatus: 'local-accepted' })
      const eventsAfter = await ordersRepo.findStatusEvents(record!.id)
      expect(eventsAfter.filter((event) => event.remark?.includes('推仓失败'))).toHaveLength(1)
      expect(eventsAfter.some((event) => event.remark === '订单已推送保税仓')).toBe(true)
      expect(pushOrder).toHaveBeenCalledTimes(2)
    })

    it('迟到扣款登记竞态落败：并发回调已登记则幂等返回，不重复记事件（复审 R09）', async () => {
      const ordersRepo = new InMemoryOrderRepository()
      const paymentAdapter = new LocalPaymentAdapter()
      const warehouse = new LocalWarehouseAdapter(catalog)
      const svc = new OrderService(
        cart, profile, ordersRepo, warehouse, crypto, paymentAdapter, catalog, users,
        new RefundService(new InMemoryRefundRepository(), ordersRepo, paymentAdapter),
        new OrderFulfillmentService(ordersRepo, warehouse, crypto),
      )
      const { orderNo } = await svc.create('user-1', { requestId: 'request-race-late' })
      await svc.cancel('user-1', orderNo)
      // 模拟并发回调先登记：本调用条件更新落败（返回 false），但订单实际已是 paid，且并发方已记事件
      const register = ordersRepo.registerLatePaymentIfCancelled.bind(ordersRepo)
      jest.spyOn(ordersRepo, 'registerLatePaymentIfCancelled').mockImplementation(async (orderId, fields) => {
        await register(orderId, fields)
        await ordersRepo.recordStatusEvent({
          orderId, fromStatus: 'cancelled', toStatus: 'cancelled', source: 'payment',
          remark: `订单已取消但收到微信支付成功（交易单 ${fields.wechatTransactionId}），已登记支付事实，待人工退款`,
        })
        return false
      })

      await svc.handleWechatPaid(paidInput(orderNo))

      const record = await ordersRepo.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({ status: 'cancelled', paymentStatus: 'paid' })
      const events = await ordersRepo.findStatusEvents(record!.id)
      expect(events.filter((event) => event.remark?.includes('待人工退款'))).toHaveLength(1) // 只有并发方记的一次
    })
  })

  describe('handleWechatRefundNotified（退款回调，复审 R04/R05）', () => {
    /** 通道受理但资金在途（微信真实通道的典型应答） */
    const processingAdapter = (): PaymentAdapter => ({
      createPayParams: jest.fn(),
      refund: jest.fn((_orderNo: string, _amountFen: number, _totalFen: number, outRefundNo: string): Promise<PaymentRefundResult> =>
        Promise.resolve({ refundNo: outRefundNo, refundId: '5030000001', status: 'PROCESSING' })),
    })
    /** 用同一订单/退款账本组装一套服务，返回发起退款并支付完成的订单号 */
    const setupProcessingRefund = async (requestId: string, amountFen: number) => {
      const refundRepo = new InMemoryRefundRepository()
      const adapter = processingAdapter()
      const refunds = new RefundService(refundRepo, orders, adapter)
      const svc = new OrderService(cart, profile, orders, new LocalWarehouseAdapter(catalog), crypto, adapter, catalog, users, refunds, new OrderFulfillmentService(orders, new LocalWarehouseAdapter(catalog), crypto))
      const { orderNo } = await svc.create('user-1', { requestId })
      await svc.handleWechatPaid({ orderNo, transactionId: '4200000123456789012345678901', paidTotalFen: 32900, paidAt: new Date() })
      const order = (await orders.findOneByOrderNo(orderNo))!
      const { refund } = await refunds.requestRefund(order, amountFen, '管理员退款')
      return { svc, refunds, orderNo, order, refund }
    }

    it('在途退款单收到 SUCCESS 回调后收敛到账：订单置已退款，重复回调幂等', async () => {
      const { svc, refunds, orderNo, order, refund } = await setupProcessingRefund('request-refund-1', 32900)
      expect(refund.status).toBe('processing')
      expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ paymentStatus: 'refunding' })

      await svc.handleWechatRefundNotified({ orderNo, refundNo: refund.refundNo, refundStatus: 'SUCCESS', refundId: '5030000001' })

      expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900 })
      expect((await refunds.listByOrder(order.id))[0]).toMatchObject({ status: 'success', wechatRefundId: '5030000001' })
      // 重复回调幂等：退款单仍一笔，累计不翻倍
      await svc.handleWechatRefundNotified({ orderNo, refundNo: refund.refundNo, refundStatus: 'SUCCESS' })
      expect(await refunds.listByOrder(order.id)).toHaveLength(1)
      expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900 })
    })

    it('部分退款到账后订单回 paid（剩余可退），再退剩余部分后全额终态', async () => {
      const { svc, refunds, orderNo, order, refund } = await setupProcessingRefund('request-refund-2', 10000)
      await svc.handleWechatRefundNotified({ orderNo, refundNo: refund.refundNo, refundStatus: 'SUCCESS' })

      expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ paymentStatus: 'paid', refundFen: 10000 })

      const fresh = (await orders.findOneByOrderNo(orderNo))!
      const second = await refunds.requestRefund(fresh, 22900, '管理员退款')
      expect(second.refund.refundNo).not.toBe(refund.refundNo)
      await svc.handleWechatRefundNotified({ orderNo, refundNo: second.refund.refundNo, refundStatus: 'SUCCESS' })
      expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900 })
      void order
    })

    it('本地无退款单的回调按商户平台发起补登并收敛订单', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-refund-3' })
      await service.handleWechatPaid({ orderNo, transactionId: '4200000123456789012345678901', paidTotalFen: 32900, paidAt: new Date() })

      await service.handleWechatRefundNotified({ orderNo, refundNo: 'RPLATFORM01', refundStatus: 'SUCCESS', refundId: '5030000002', amountFen: 32900 })

      const order = await orders.findOneByOrderNo(orderNo)
      expect(order).toMatchObject({ paymentStatus: 'refunded', refundFen: 32900 })
      const refunds = await refundService.listByOrder(order!.id)
      expect(refunds).toMatchObject([{ refundNo: 'RPLATFORM01', channel: 'platform', status: 'success', amountFen: 32900 }])
      // 重复通知幂等
      await service.handleWechatRefundNotified({ orderNo, refundNo: 'RPLATFORM01', refundStatus: 'SUCCESS' })
      expect(await refundService.listByOrder(order!.id)).toHaveLength(1)
    })

    it('ABNORMAL 回调记录异常事件，订单回到可退状态（不置终态）', async () => {
      const { svc, orderNo, order, refund } = await setupProcessingRefund('request-refund-4', 10000)

      await svc.handleWechatRefundNotified({ orderNo, refundNo: refund.refundNo, refundStatus: 'ABNORMAL' })

      expect(await orders.findOneByOrderNo(orderNo)).toMatchObject({ paymentStatus: 'paid', refundFen: null })
      const events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark?.includes('需人工跟进'))).toBe(true)
    })

    it('不存在订单的退款回调报错（触发微信重推排查）', async () => {
      await expect(
        service.handleWechatRefundNotified({ orderNo: 'WB20990101NONE', refundNo: 'R1', refundStatus: 'SUCCESS' }),
      ).rejects.toMatchObject({ code: 40404 })
    })
  })

  describe('H5 状态契约映射（复审 R14）', () => {
    it('后台同步写入 receive/complete 的订单，H5 读取与筛选均使用 recv/done', async () => {
      const svc = buildService(orders, new LocalPaymentAdapter())
      const { orderNo } = await svc.create('user-1', { requestId: 'request-status-1' })

      const [created] = await orders.findByUser('user-1')
      await orders.saveOrder({ ...created, status: 'receive' })
      expect((await svc.get('user-1', orderNo)).status).toBe('recv')
      expect((await svc.list('user-1', 'recv')).list.map((o) => o.orderNo)).toContain(orderNo)
      expect((await svc.list('user-1', 'done')).list).toHaveLength(0)

      await orders.saveOrder({ ...created, status: 'complete' })
      expect((await svc.get('user-1', orderNo)).status).toBe('done')
      expect((await svc.list('user-1', 'done')).list.map((o) => o.orderNo)).toContain(orderNo)
    })

    it('pay/ship/cancelled 原样透传，cancel 筛选仍归一为 cancelled', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-status-2' })
      expect((await service.list('user-1', 'pay')).list.map((o) => o.orderNo)).toContain(orderNo)
      await service.cancel('user-1', orderNo)
      expect((await service.list('user-1', 'cancel')).list.map((o) => o.orderNo)).toContain(orderNo)
    })
  })

  describe('支付参数 description 一致性', () => {
    it('重复取支付参数的 description 必须一致且一律来自落库订单明细，否则微信拒绝重复下单', async () => {
      const captured: (PayContext | undefined)[] = []
      const spyAdapter: PaymentAdapter = {
        createPayParams: jest.fn((_orderNo: string, ctx?: PayContext) => {
          captured.push(ctx)
          return Promise.resolve({ provider: 'mock' })
        }),
        refund: jest.fn(),
      }
      const spyService = buildService(orders, spyAdapter)

      const { orderNo } = await spyService.create('user-1', { requestId: 'request-desc' })
      expect(captured).toHaveLength(0) // 复审 R02：创建订单不再取支付参数
      await spyService.getPayParams('user-1', orderNo)
      await spyService.getPayParams('user-1', orderNo) // 续付重取
      await spyService.create('user-1', { requestId: 'request-desc' }) // 幂等重进也不再取参

      expect(captured).toHaveLength(2)
      const product = await catalog.findById('WB10001')
      for (const ctx of captured) expect(ctx?.description).toBe(product?.name)
    })
  })

  describe('年度额度预占（复审 R06：下单即占用，取消/超时/全额退款释放，年度归属=创建年）', () => {
    // 与 beforeEach 实名一致的证件指纹（不同账号同证件共享额度）
    const fingerprint = crypto.fingerprint('110101199001011234')
    let seedSeq = 0
    /** 直接往仓储播种订单（创建年/金额/指纹/状态可控），默认当年已支付 */
    const seedOrder = async (overrides: Partial<OrderRecord>): Promise<OrderRecord> => {
      seedSeq += 1
      const order = await orders.saveOrder(orders.createOrder({
        orderNo: `WB20260915QUOTA${String(seedSeq).padStart(3, '0')}`, userId: 'user-1', requestId: `req-quota-${seedSeq}`,
        status: 'ship', paymentStatus: 'paid', warehouseStatus: null, totalFen: 0,
        realnameName: '张三', idcardEncrypted: 'x', idcardFingerprint: fingerprint,
        receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
        paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
        customsDeclareStatus: null, customsDeclaredAt: null, payerTotalFen: null, payCurrency: null,
      }))
      return orders.saveOrder({ ...order, ...overrides })
    }
    const thisYear = (): { from: Date; to: Date } => ({ from: new Date(new Date().getFullYear(), 0, 1), to: new Date(new Date().getFullYear() + 1, 0, 1) })
    const setPrice = async (priceFen: number): Promise<void> => {
      const product = await catalog.findById('WB10001')
      await catalog.save({ ...product!, priceFen })
    }
    const refillCart = async (): Promise<void> => {
      // 失败的 create（如额度拒绝）不会清空购物车：同商品已存在时复位而不是重复添加
      const existing = await cart.findByUserAndProduct('user-1', 'WB10001')
      if (existing) { await cart.save({ ...existing, quantity: 1, checked: true }); return }
      await cart.save(cart.create({ userId: 'user-1', productId: 'WB10001', quantity: 1, checked: true }))
    }

    it('占用集合语义：待支付/已支付/退款中占用，未支付取消/全额退款释放', async () => {
      await seedOrder({ totalFen: 100, status: 'pay', paymentStatus: 'pending' }) // 待支付预占
      await seedOrder({ totalFen: 200, paidAt: new Date() }) // 已支付占用
      await seedOrder({ totalFen: 300, paymentStatus: 'refunding', paidAt: new Date() }) // 退款在途仍占用
      await seedOrder({ totalFen: 400, status: 'cancelled', paymentStatus: 'pending', cancelledAt: new Date() }) // pending+cancelled：取消/超时关单释放
      await seedOrder({ totalFen: 500, status: 'cancelled', paidAt: new Date(), cancelledAt: new Date() }) // 迟扣款已登记（paid），钱已收仍占用
      await seedOrder({ totalFen: 600, status: 'cancelled', paymentStatus: 'refunded', paidAt: new Date(), refundFen: 600 }) // 全额退款释放
      await seedOrder({ totalFen: 700, status: 'complete', paidAt: new Date() }) // 历史已成交占用
      await seedOrder({ totalFen: 800, idcardFingerprint: 'fp-other' }) // 其他证件不计入
      const lastYear = new Date().getFullYear() - 1
      await seedOrder({ totalFen: 900, createdAt: new Date(lastYear, 6, 1), paidAt: new Date(lastYear, 6, 2) }) // 上年创建不计入今年

      const { from, to } = thisYear()
      await expect(orders.sumOccupiedYearlyFen(fingerprint, from, to)).resolves.toBe(100 + 200 + 300 + 500 + 700)
    })

    it('顺序预建两单超限：已占用 25000 元时第一笔 1000 元创建成功（占满 26000），第二笔创建即拒', async () => {
      await setPrice(100000) // 1000 元
      await seedOrder({ totalFen: 2500000, paidAt: new Date() }) // 已占用 25000 元

      await expect(service.create('user-1', { requestId: 'quota-seq-1' })).resolves.toMatchObject({ orderNo: expect.any(String) })
      await refillCart()
      // 旧口径（只算已支付）会放行第二笔，支付后累计 27000 超限；预占口径在创建即拦截
      await expect(service.create('user-1', { requestId: 'quota-seq-2' })).rejects.toMatchObject({ code: 40001 })
    })

    it('取消待支付订单释放预占额度（超时关单同为 cancelled+pending，仓储语义已覆盖），释放后可再创建', async () => {
      await setPrice(100000)
      await seedOrder({ totalFen: 2500000, paidAt: new Date() })

      const first = await service.create('user-1', { requestId: 'quota-cancel-1' })
      await service.cancel('user-1', first.orderNo)
      await refillCart()
      await expect(service.create('user-1', { requestId: 'quota-cancel-2' })).resolves.toMatchObject({ orderNo: expect.any(String) })
    })

    it('全额退款释放额度，部分退款不释放（退款返还以海关为准，本地从简）', async () => {
      await setPrice(500000) // 5000 元（单笔上限）
      await seedOrder({ totalFen: 2100000, paidAt: new Date() }) // 已占用 21000 元

      const created = await service.create('user-1', { requestId: 'quota-refund-1' }) // 21000+5000=26000 恰好达标
      await service.handleWechatPaid({ orderNo: created.orderNo, transactionId: 'tx-quota-1', paidTotalFen: 500000, paidAt: new Date() })

      // 部分退款 1000 元：订单回到 paid 仍占用 → 再建单被拒
      await refundService.requestRefund((await orders.findOneByOrderNo(created.orderNo))!, 100000, '部分退款')
      expect(await orders.findOneByOrderNo(created.orderNo)).toMatchObject({ paymentStatus: 'paid', refundFen: 100000 })
      await refillCart()
      await expect(service.create('user-1', { requestId: 'quota-refund-2' })).rejects.toMatchObject({ code: 40001 })

      // 退剩余 4000 元：全额 refunded → 释放 → 可再建
      await refundService.requestRefund((await orders.findOneByOrderNo(created.orderNo))!, 400000, '剩余退款')
      expect(await orders.findOneByOrderNo(created.orderNo)).toMatchObject({ paymentStatus: 'refunded', refundFen: 500000 })
      await refillCart()
      await expect(service.create('user-1', { requestId: 'quota-refund-3' })).resolves.toMatchObject({ orderNo: expect.any(String) })
    })

    it('不同账号同一证件共享年度额度', async () => {
      const user2 = await users.create('13900000000')
      user2.id = 'user-2'
      await profile.createAddress('user-2', { name: '张三', phone: '13900000000', region: '浙江省 金华市 义乌市', detail: '稠城街道 2 号' })
      await profile.saveRealname('user-2', { name: '张三', idcard: '110101199001011234' }) // 同证件 → 同指纹
      await cart.save(cart.create({ userId: 'user-2', productId: 'WB10001', quantity: 1, checked: true }))
      await setPrice(500000)
      await seedOrder({ totalFen: 2100000, paidAt: new Date() })

      await expect(service.create('user-1', { requestId: 'quota-share-1' })).resolves.toMatchObject({ orderNo: expect.any(String) }) // 占满 26000
      await expect(service.create('user-2', { requestId: 'quota-share-2' })).rejects.toMatchObject({ code: 40001 }) // 换账号也绕不过
    })

    it('并发创建同指纹订单：命名锁排队，只有一笔能占满年限额', async () => {
      const user2 = await users.create('13900000000')
      user2.id = 'user-2'
      await profile.createAddress('user-2', { name: '张三', phone: '13900000000', region: '浙江省 金华市 义乌市', detail: '稠城街道 2 号' })
      await profile.saveRealname('user-2', { name: '张三', idcard: '110101199001011234' })
      await cart.save(cart.create({ userId: 'user-2', productId: 'WB10001', quantity: 1, checked: true }))
      await setPrice(500000)
      await seedOrder({ totalFen: 2100000, paidAt: new Date() })

      // 无锁时两笔都按「已占用 21000」的旧快照放行（合计 31000 超限）；有锁时后进锁者看到对方的待支付预占
      const results = await Promise.allSettled([
        service.create('user-1', { requestId: 'quota-cc-1' }),
        service.create('user-2', { requestId: 'quota-cc-2' }),
      ])

      const fulfilled = results.filter((result) => result.status === 'fulfilled')
      const rejected = results.filter((result) => result.status === 'rejected')
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 40001 })
    })

    it('跨年支付：额度归订单创建年（12 月创建、次年 1 月支付仍占创建年，不切换归属年）', async () => {
      const year = new Date().getFullYear()
      await seedOrder({ totalFen: 2500000, createdAt: new Date(year, 11, 20), paidAt: new Date(year + 1, 0, 5) })

      await expect(orders.sumOccupiedYearlyFen(fingerprint, new Date(year, 0, 1), new Date(year + 1, 0, 1))).resolves.toBe(2500000)
      await expect(orders.sumOccupiedYearlyFen(fingerprint, new Date(year + 1, 0, 1), new Date(year + 2, 0, 1))).resolves.toBe(0)
    })
  })
})
