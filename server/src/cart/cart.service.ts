import { Inject, Injectable } from '@nestjs/common'

import { PRODUCTS } from '../catalog/catalog.seed'
import type { Product } from '../catalog/catalog.types'
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
  constructor(@Inject(CART_REPOSITORY) private readonly repository: CartRepository) {}

  async list(userId: string): Promise<CartItemResponse[]> {
    const items = await this.repository.findByUser(userId)
    return items.flatMap((item) => {
      const product = this.findProduct(item.productId)
      return product ? [this.toResponse(item, product)] : []
    })
  }

  async add(userId: string, dto: AddCartItemDto): Promise<CartItemResponse[]> {
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BusinessException(40003, '商品数量必须大于 0')
    }
    const product = this.requireProduct(dto.productId)
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

  private requireProduct(productId: string): Product {
    const product = this.findProduct(productId)
    if (!product) throw new BusinessException(40404, '商品不存在', 404)
    return product
  }

  private findProduct(productId: string): Product | undefined {
    return PRODUCTS.find((product) => product.id === productId)
  }

  private toResponse(item: CartItemRecord, product: Product): CartItemResponse {
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
      inStock: true,
    }
  }
}
