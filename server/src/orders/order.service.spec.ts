import { InMemoryCartRepository } from '../cart/cart.repository'
import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { ProfileService } from '../profile/profile.service'
import { InMemoryAddressRepository, InMemoryRealnameProfileRepository } from '../profile/profile.repository'
import { InMemoryUsersRepository } from '../users/users.repository'

import { InMemoryOrderRepository } from './order.repository'
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

  const buildService = (ordersRepo: InMemoryOrderRepository, paymentAdapter: PaymentAdapter): OrderService =>
    new OrderService(
      cart, profile, ordersRepo, new LocalWarehouseAdapter(catalog), crypto, paymentAdapter, catalog, users,
      new RefundService(new InMemoryRefundRepository(), ordersRepo, paymentAdapter),
    )

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
    service = new OrderService(cart, profile, orders, new LocalWarehouseAdapter(catalog), crypto, payment, catalog, users, refundService)
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
    // 模拟并发请求先提交的订单（服务层预检时尚未提交）
    await ordersRepo.saveOrder(ordersRepo.createOrder({
      orderNo: 'WB20260912WINNER0001', userId: 'user-1', requestId: 'request-race', status: 'pay', paymentStatus: 'pending',
      warehouseStatus: null, totalFen: 32900, realnameName: '张三', idcardEncrypted: 'x', idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: null, cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
    }))
    jest.spyOn(ordersRepo, 'findByUserAndRequest').mockResolvedValueOnce(null)
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
      )
      const { orderNo } = await svc.create('user-1', { requestId: 'request-pay-4' })
      await svc.cancel('user-1', orderNo)

      await svc.handleWechatPaid(paidInput(orderNo))

      const record = await ordersRepo.findOneByOrderNo(orderNo)
      expect(record).toMatchObject({
        status: 'cancelled',
        paymentStatus: 'paid',
        wechatTransactionId: '4200000123456789012345678901',
        systemRemark: '订单取消后收到微信扣款，需人工退款处理',
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

    it('优惠支付（实付小于订单总额）按订单总额正常登记（复审 R08）', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-coupon' })

      await service.handleWechatPaid({ ...paidInput(orderNo), payerTotalFen: 32800 })

      const order = await service.get('user-1', orderNo)
      expect(order.status).toBe('ship')
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
      const svc = new OrderService(cart, profile, orders, new LocalWarehouseAdapter(catalog), crypto, adapter, catalog, users, refunds)
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
})
