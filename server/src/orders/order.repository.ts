import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Between, Repository } from 'typeorm'

import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY')

export interface OrderRecord {
  id: string; orderNo: string; userId: string; requestId: string; status: string; paymentStatus: string
  warehouseStatus: string | null; totalFen: number; realnameName: string; idcardEncrypted: string; idcardFingerprint: string
  receiverName: string; receiverPhone: string; receiverRegion: string; receiverDetail: string
  paidAt: Date | null; cancelledAt: Date | null; createdAt: Date; updatedAt: Date
}
export interface OrderItemRecord {
  id: string; orderId: string; productId: string; name: string; spec: string; priceFen: number; quantity: number; img: string; themeLight: string
}
type NewOrder = Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>
type NewOrderItem = Omit<OrderItemRecord, 'id'>

export interface OrderRepository {
  findByUserAndRequest(userId: string, requestId: string): Promise<OrderRecord | null>
  findByOrderNo(userId: string, orderNo: string): Promise<OrderRecord | null>
  findByUser(userId: string, status?: string): Promise<OrderRecord[]>
  sumDeclaredFen(idcardFingerprint: string, from: Date, to: Date): Promise<number>
  createOrder(input: NewOrder): OrderRecord
  saveOrder(order: OrderRecord): Promise<OrderRecord>
  createItem(input: NewOrderItem): OrderItemRecord
  saveItems(items: OrderItemRecord[]): Promise<OrderItemRecord[]>
  findItems(orderId: string): Promise<OrderItemRecord[]>
}

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity) private readonly items: Repository<OrderItemEntity>,
  ) {}
  findByUserAndRequest(userId: string, requestId: string): Promise<OrderEntity | null> { return this.orders.findOneBy({ userId, requestId }) }
  findByOrderNo(userId: string, orderNo: string): Promise<OrderEntity | null> { return this.orders.findOneBy({ userId, orderNo }) }
  findByUser(userId: string, status?: string): Promise<OrderEntity[]> { return this.orders.find({ where: status ? { userId, status } : { userId }, order: { createdAt: 'DESC' } }) }
  async sumDeclaredFen(idcardFingerprint: string, from: Date, to: Date): Promise<number> {
    const result = await this.orders.createQueryBuilder('order').select('COALESCE(SUM(order.total_fen), 0)', 'total')
      .where('order.idcard_fingerprint = :idcardFingerprint', { idcardFingerprint }).andWhere('order.paid_at IS NOT NULL')
      .andWhere({ createdAt: Between(from, to) }).getRawOne<{ total: string }>()
    return Number(result?.total ?? 0)
  }
  createOrder(input: NewOrder): OrderEntity { return this.orders.create(input) }
  saveOrder(order: OrderRecord): Promise<OrderEntity> { return this.orders.save(order) }
  createItem(input: NewOrderItem): OrderItemEntity { return this.items.create(input) }
  saveItems(items: OrderItemRecord[]): Promise<OrderItemEntity[]> { return this.items.save(items) }
  findItems(orderId: string): Promise<OrderItemEntity[]> { return this.items.find({ where: { orderId } }) }
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, OrderRecord>()
  private readonly items = new Map<string, OrderItemRecord>()
  async findByUserAndRequest(userId: string, requestId: string): Promise<OrderRecord | null> { return [...this.orders.values()].find((order) => order.userId === userId && order.requestId === requestId) ?? null }
  async findByOrderNo(userId: string, orderNo: string): Promise<OrderRecord | null> { return [...this.orders.values()].find((order) => order.userId === userId && order.orderNo === orderNo) ?? null }
  async findByUser(userId: string, status?: string): Promise<OrderRecord[]> { return [...this.orders.values()].filter((order) => order.userId === userId && (!status || order.status === status)) }
  async sumDeclaredFen(fingerprint: string, from: Date, to: Date): Promise<number> { return [...this.orders.values()].filter((order) => order.idcardFingerprint === fingerprint && order.paidAt && order.createdAt >= from && order.createdAt < to).reduce((sum, order) => sum + order.totalFen, 0) }
  createOrder(input: NewOrder): OrderRecord { const now = new Date(); return { id: randomUUID(), createdAt: now, updatedAt: now, ...input } }
  async saveOrder(order: OrderRecord): Promise<OrderRecord> { order.updatedAt = new Date(); this.orders.set(order.id, { ...order }); return order }
  createItem(input: NewOrderItem): OrderItemRecord { return { id: randomUUID(), ...input } }
  async saveItems(items: OrderItemRecord[]): Promise<OrderItemRecord[]> { items.forEach((item) => this.items.set(item.id, { ...item })); return items }
  async findItems(orderId: string): Promise<OrderItemRecord[]> { return [...this.items.values()].filter((item) => item.orderId === orderId) }
}
