import { InMemoryCartRepository } from '../cart/cart.repository'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { ProfileService } from '../profile/profile.service'
import { InMemoryAddressRepository, InMemoryRealnameProfileRepository } from '../profile/profile.repository'

import { InMemoryOrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { LocalPaymentAdapter } from './local-payment.adapter'

describe('OrderService', () => {
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let cart: InMemoryCartRepository
  let profile: ProfileService
  let service: OrderService

  beforeEach(async () => {
    cart = new InMemoryCartRepository()
    profile = new ProfileService(new InMemoryAddressRepository(), new InMemoryRealnameProfileRepository(), crypto)
    service = new OrderService(cart, profile, new InMemoryOrderRepository(), new LocalWarehouseAdapter(), crypto, new LocalPaymentAdapter())
    await cart.save(cart.create({ userId: 'user-1', productId: 'p1', quantity: 1, checked: true }))
    await profile.createAddress('user-1', { name: '张三', phone: '13800000000', region: '浙江省 金华市 义乌市', detail: '稠城街道 1 号' })
    await profile.saveRealname('user-1', { name: '张三', idcard: '110101199001011234' })
  })

  it('收货人与实名姓名不一致时拒绝预检', async () => {
    const [address] = await profile.getAddresses('user-1')
    await profile.updateAddress('user-1', address.id, { name: '李四' })

    await expect(service.precheck('user-1')).rejects.toMatchObject({ code: 40002 })
  })

  it('应付金额超过 500000 分时拒绝预检', async () => {
    const item = await cart.findByUserAndProduct('user-1', 'p1')
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

    await cart.save(cart.create({ userId: 'user-1', productId: 'p1', quantity: 1, checked: true }))
    const second = await service.create('user-1', { requestId: 'request-2' })
    await service.confirmMockPayment('user-1', second.orderNo)
    await expect(service.cancel('user-1', second.orderNo)).rejects.toMatchObject({ code: 40002 })
  })
})
