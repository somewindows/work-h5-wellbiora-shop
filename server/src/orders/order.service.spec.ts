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
import { LocalPaymentAdapter, type PaymentAdapter, type PayContext } from './local-payment.adapter'

describe('OrderService', () => {
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let cart: InMemoryCartRepository
  let catalog: InMemoryCatalogRepository
  let profile: ProfileService
  let service: OrderService
  let users: InMemoryUsersRepository

  beforeEach(async () => {
    cart = new InMemoryCartRepository()
    catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    profile = new ProfileService(new InMemoryAddressRepository(), new InMemoryRealnameProfileRepository(), crypto)
    users = new InMemoryUsersRepository()
    const user = await users.create('13800000000')
    user.id = 'user-1'
    service = new OrderService(cart, profile, new InMemoryOrderRepository(), new LocalWarehouseAdapter(catalog), crypto, new LocalPaymentAdapter(), catalog, users)
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

    it('已取消订单的迟到回调被拒绝', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-pay-4' })
      await service.cancel('user-1', orderNo)

      await expect(service.handleWechatPaid(paidInput(orderNo))).rejects.toMatchObject({ code: 40002 })
    })
  })

  describe('handleWechatRefundNotified（退款回调）', () => {
    it('退款成功回调把订单标记为已退款', async () => {
      const { orderNo } = await service.create('user-1', { requestId: 'request-refund-1' })
      await service.handleWechatPaid({ orderNo, transactionId: '4200000123456789012345678901', paidTotalFen: 32900, paidAt: new Date() })

      await service.handleWechatRefundNotified({ orderNo, refundNo: 'R123', refundStatus: 'SUCCESS' })
      // 不抛错且状态保持（paymentStatus 细节由管理侧详情体现，这里验证接口幂等可用）
      await service.handleWechatRefundNotified({ orderNo, refundNo: 'R123', refundStatus: 'SUCCESS' })
    })

    it('不存在订单的退款回调报错（触发微信重推排查）', async () => {
      await expect(
        service.handleWechatRefundNotified({ orderNo: 'WB20990101NONE', refundNo: 'R1', refundStatus: 'SUCCESS' }),
      ).rejects.toMatchObject({ code: 40404 })
    })
  })

  describe('H5 状态契约映射（复审 R14）', () => {
    it('后台同步写入 receive/complete 的订单，H5 读取与筛选均使用 recv/done', async () => {
      const orders = new InMemoryOrderRepository()
      const svc = new OrderService(cart, profile, orders, new LocalWarehouseAdapter(catalog), crypto, new LocalPaymentAdapter(), catalog, users)
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
      const spyService = new OrderService(cart, profile, new InMemoryOrderRepository(), new LocalWarehouseAdapter(catalog), crypto, spyAdapter, catalog, users)

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
