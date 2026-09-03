import { BusinessException } from '../common/business.exception'
import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'

import { CartService } from './cart.service'
import type { CartRepository } from './cart.repository'

describe('CartService', () => {
  const items: Array<{ id: string; userId: string; productId: string; quantity: number; checked: boolean }> = []
  const repository: CartRepository = {
    findByUser: jest.fn(async (userId) => items.filter((item) => item.userId === userId)),
    findByUserAndProduct: jest.fn(async (userId, productId) => items.find((item) => item.userId === userId && item.productId === productId) ?? null),
    findByIdAndUser: jest.fn(async (id, userId) => items.find((item) => item.id === id && item.userId === userId) ?? null),
    save: jest.fn(async (item) => {
      const index = items.findIndex((saved) => saved.id === item.id)
      if (index >= 0) items[index] = item
      else items.push(item)
      return item
    }),
    create: jest.fn((input) => ({ id: `cart-${items.length + 1}`, ...input })),
    remove: jest.fn(async (item) => {
      const index = items.findIndex((saved) => saved.id === item.id)
      if (index >= 0) items.splice(index, 1)
    }),
  }
  let catalog: InMemoryCatalogRepository
  let service: CartService

  beforeEach(async () => {
    items.splice(0)
    jest.clearAllMocks()
    catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    service = new CartService(repository, catalog)
  })

  it('同一用户再次加入相同 SKU 时合并数量', async () => {
    await service.add('user-1', { productId: 'WB10001', quantity: 1 })
    const result = await service.add('user-1', { productId: 'WB10001', quantity: 2 })

    expect(result).toMatchObject([{ productId: 'WB10001', quantity: 3 }])
  })

  it('数量小于一时拒绝加入购物车', async () => {
    await expect(service.add('user-1', { productId: 'WB10001', quantity: 0 })).rejects.toBeInstanceOf(BusinessException)
  })

  it('已下架商品不允许加入购物车', async () => {
    const product = await catalog.findById('WB10001')
    await catalog.save({ ...product!, isActive: false })

    await expect(service.add('user-1', { productId: 'WB10001', quantity: 1 })).rejects.toMatchObject({ code: 40006 })
  })

  it('购物车价格以 catalog 当前价为准', async () => {
    const product = await catalog.findById('WB10001')
    await catalog.save({ ...product!, priceFen: 12345 })

    const result = await service.add('user-1', { productId: 'WB10001', quantity: 1 })

    expect(result).toMatchObject([{ productId: 'WB10001', priceFen: 12345 }])
  })

  it('不能更新其他用户的购物车行', async () => {
    await service.add('user-1', { productId: 'WB10001', quantity: 1 })

    await expect(service.update('user-2', 'cart-1', { quantity: 2 })).rejects.toMatchObject({ code: 40404 })
  })
})
