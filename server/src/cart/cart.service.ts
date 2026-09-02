import { Inject, Injectable } from '@nestjs/common'

import { CATALOG_REPOSITORY, type CatalogProductRecord, type SellableProductSource } from '../catalog/catalog.repository'
import { BusinessException } from '../common/business.exception'

import type { AddCartItemDto, UpdateCartItemDto } from './cart.dto'
import { CART_REPOSITORY, type CartItemRecord, type CartRepository } from './cart.repository'

export interface CartItemResponse {
  id: string
  productId: string
  name: string
  spec: string
  priceFen: number
  quantity: number
  checked: boolean
  img: string
  themeLight: string
  inStock: boolean
}

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_REPOSITORY) private readonly repository: CartRepository,
    @Inject(CATALOG_REPOSITORY) private readonly products: SellableProductSource,
  ) {}

  async list(userId: string): Promise<CartItemResponse[]> {
    const items = await this.repository.findByUser(userId)
    const responses: CartItemResponse[] = []
    for (const item of items) {
      const product = await this.products.findById(item.productId)
      if (product) responses.push(this.toResponse(item, product))
    }
    return responses
  }

  async add(userId: string, dto: AddCartItemDto): Promise<CartItemResponse[]> {
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BusinessException(40003, '商品数量必须大于 0')
    }
    const product = await this.requireProduct(dto.productId)
    if (!product.isActive) throw new BusinessException(40006, '商品已下架，暂不可购买')
    const existing = await this.repository.findByUserAndProduct(userId, product.id)
    const item = existing
      ? { ...existing, quantity: existing.quantity + dto.quantity }
      : this.repository.create({ userId, productId: product.id, quantity: dto.quantity, checked: true })
    await this.repository.save(item)
    return this.list(userId)
  }

  async update(userId: string, id: string, dto: UpdateCartItemDto): Promise<CartItemResponse[]> {
    const item = await this.repository.findByIdAndUser(id, userId)
    if (!item) throw new BusinessException(40404, '购物车商品不存在', 404)
    if (dto.quantity !== undefined && (!Number.isInteger(dto.quantity) || dto.quantity < 1)) {
      throw new BusinessException(40003, '商品数量必须大于 0')
    }
    if (dto.quantity === undefined && dto.checked === undefined) {
      throw new BusinessException(40003, '请提供需要更新的购物车字段')
    }
    await this.repository.save({ ...item, ...dto })
    return this.list(userId)
  }

  async remove(userId: string, id: string): Promise<CartItemResponse[]> {
    const item = await this.repository.findByIdAndUser(id, userId)
    if (!item) throw new BusinessException(40404, '购物车商品不存在', 404)
    await this.repository.remove(item)
    return this.list(userId)
  }

  private async requireProduct(productId: string) {
    const product = await this.products.findById(productId)
    if (!product) throw new BusinessException(40404, '商品不存在', 404)
    return product
  }

  private toResponse(item: CartItemRecord, product: CatalogProductRecord): CartItemResponse {
    return {
      id: item.id,
      productId: product.id,
      name: product.name,
      spec: product.flavor ? `${product.spec} · ${product.flavor}` : product.spec,
      priceFen: product.priceFen,
      quantity: item.quantity,
      checked: item.checked,
      img: product.cardImg,
      themeLight: product.themeLight,
      inStock: product.isActive,
    }
  }
}
