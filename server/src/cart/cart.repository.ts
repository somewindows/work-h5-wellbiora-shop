import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { CartItemEntity } from './cart-item.entity'

export const CART_REPOSITORY = Symbol('CART_REPOSITORY')

export interface CartItemRecord {
  id: string
  userId: string
  productId: string
  quantity: number
  checked: boolean
}

export interface CartRepository {
  findByUser(userId: string): Promise<CartItemRecord[]>
  findByUserAndProduct(userId: string, productId: string): Promise<CartItemRecord | null>
  findByIdAndUser(id: string, userId: string): Promise<CartItemRecord | null>
  create(input: Omit<CartItemRecord, 'id'>): CartItemRecord
  save(item: CartItemRecord): Promise<CartItemRecord>
  remove(item: CartItemRecord): Promise<void>
}

@Injectable()
export class TypeOrmCartRepository implements CartRepository {
  constructor(@InjectRepository(CartItemEntity) private readonly repository: Repository<CartItemEntity>) {}

  findByUser(userId: string): Promise<CartItemEntity[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'ASC' } })
  }

  findByUserAndProduct(userId: string, productId: string): Promise<CartItemEntity | null> {
    return this.repository.findOneBy({ userId, productId })
  }

  findByIdAndUser(id: string, userId: string): Promise<CartItemEntity | null> {
    return this.repository.findOneBy({ id, userId })
  }

  create(input: Omit<CartItemRecord, 'id'>): CartItemEntity {
    return this.repository.create(input)
  }

  save(item: CartItemRecord): Promise<CartItemEntity> {
    return this.repository.save(item)
  }

  async remove(item: CartItemRecord): Promise<void> {
    await this.repository.delete(item.id)
  }
}

export class InMemoryCartRepository implements CartRepository {
  private readonly items = new Map<string, CartItemRecord>()

  async findByUser(userId: string): Promise<CartItemRecord[]> {
    return [...this.items.values()].filter((item) => item.userId === userId)
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<CartItemRecord | null> {
    return [...this.items.values()].find((item) => item.userId === userId && item.productId === productId) ?? null
  }

  async findByIdAndUser(id: string, userId: string): Promise<CartItemRecord | null> {
    const item = this.items.get(id)
    return item?.userId === userId ? item : null
  }

  create(input: Omit<CartItemRecord, 'id'>): CartItemRecord {
    return { id: randomUUID(), ...input }
  }

  async save(item: CartItemRecord): Promise<CartItemRecord> {
    this.items.set(item.id, { ...item })
    return item
  }

  async remove(item: CartItemRecord): Promise<void> {
    this.items.delete(item.id)
  }
}
