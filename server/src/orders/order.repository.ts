import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Between, Repository } from 'typeorm'

import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'
import { OrderStatusEventEntity } from './order-event.entity'

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY')

export interface OrderRecord {
  id: string; orderNo: string; userId: string; requestId: string; status: string; paymentStatus: string
  warehouseStatus: string | null; totalFen: number; realnameName: string; idcardEncrypted: string; idcardFingerprint: string
  receiverName: string; receiverPhone: string; receiverRegion: string; receiverDetail: string
  paidAt: Date | null; cancelledAt: Date | null; systemRemark: string | null; refundFen: number | null; refundedAt: Date | null
  createdAt: Date; updatedAt: Date
}
export interface OrderItemRecord {
  id: string; orderId: string; productId: string; name: string; spec: string; priceFen: number; quantity: number; img: string; themeLight: string
}
export interface OrderStatusEventRecord {
  id: string; orderId: string; fromStatus: string | null; toStatus: string; source: string; remark: string | null; createdAt: Date
}
export interface AdminOrderPageQuery {
  status?: string
  keyword?: string
  from?: Date
  to?: Date
  page: number
  pageSize: number
}
type NewOrder = Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>
type NewOrderItem = Omit<OrderItemRecord, 'id'>
type NewStatusEvent = Omit<OrderStatusEventRecord, 'id' | 'createdAt'>

export interface OrderRepository {
  findByUserAndRequest(userId: string, requestId: string): Promise<OrderRecord | null>
  findByOrderNo(userId: string, orderNo: string): Promise<OrderRecord | null>
  /** 管理侧按订单号直接查询（不限用户） */
  findOneByOrderNo(orderNo: string): Promise<OrderRecord | null>
  findByUser(userId: string, status?: string): Promise<OrderRecord[]>
  findAdminPage(query: AdminOrderPageQuery): Promise<{ total: number; list: OrderRecord[] }>
  sumDeclaredFen(idcardFingerprint: string, from: Date, to: Date): Promise<number>
  createOrder(input: NewOrder): OrderRecord
  saveOrder(order: OrderRecord): Promise<OrderRecord>
  createItem(input: NewOrderItem): OrderItemRecord
  saveItems(items: OrderItemRecord[]): Promise<OrderItemRecord[]>
  findItems(orderId: string): Promise<OrderItemRecord[]>
  recordStatusEvent(input: NewStatusEvent): Promise<void>
  findStatusEvents(orderId: string): Promise<OrderStatusEventRecord[]>
}

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity) private readonly items: Repository<OrderItemEntity>,
    @InjectRepository(OrderStatusEventEntity) private readonly events: Repository<OrderStatusEventEntity>,
  ) {}
  findByUserAndRequest(userId: string, requestId: string): Promise<OrderEntity | null> { return this.orders.findOneBy({ userId, requestId }) }
  findByOrderNo(userId: string, orderNo: string): Promise<OrderEntity | null> { return this.orders.findOneBy({ userId, orderNo }) }
  findOneByOrderNo(orderNo: string): Promise<OrderEntity | null> { return this.orders.findOneBy({ orderNo }) }
  findByUser(userId: string, status?: string): Promise<OrderEntity[]> { return this.orders.find({ where: status ? { userId, status } : { userId }, order: { createdAt: 'DESC' } }) }
  async findAdminPage(query: AdminOrderPageQuery): Promise<{ total: number; list: OrderEntity[] }> {
    const builder = this.orders.createQueryBuilder('order').orderBy('order.created_at', 'DESC')
    if (query.status) builder.andWhere('order.status = :status', { status: query.status })
    if (query.keyword) {
      const keyword = `%${query.keyword.trim()}%`
      builder.andWhere('(order.order_no LIKE :keyword OR order.receiver_phone LIKE :keyword)', { keyword })
    }
    if (query.from) builder.andWhere('order.created_at >= :from', { from: query.from })
    if (query.to) builder.andWhere('order.created_at <= :to', { to: query.to })
    const [list, total] = await builder.skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount()
    return { total, list }
  }
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
  async recordStatusEvent(input: NewStatusEvent): Promise<void> { await this.events.save(this.events.create(input)) }
  findStatusEvents(orderId: string): Promise<OrderStatusEventEntity[]> { return this.events.find({ where: { orderId }, order: { createdAt: 'ASC' } }) }
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, OrderRecord>()
  private readonly items = new Map<string, OrderItemRecord>()
  private readonly events: OrderStatusEventRecord[] = []
  async findByUserAndRequest(userId: string, requestId: string): Promise<OrderRecord | null> { return [...this.orders.values()].find((order) => order.userId === userId && order.requestId === requestId) ?? null }
  async findByOrderNo(userId: string, orderNo: string): Promise<OrderRecord | null> { return [...this.orders.values()].find((order) => order.userId === userId && order.orderNo === orderNo) ?? null }
  async findOneByOrderNo(orderNo: string): Promise<OrderRecord | null> { const order = [...this.orders.values()].find((item) => item.orderNo === orderNo); return order ? { ...order } : null }
  async findByUser(userId: string, status?: string): Promise<OrderRecord[]> { return [...this.orders.values()].filter((order) => order.userId === userId && (!status || order.status === status)) }
  async findAdminPage(query: AdminOrderPageQuery): Promise<{ total: number; list: OrderRecord[] }> {
    const keyword = query.keyword?.trim()
    const filtered = [...this.orders.values()]
      .filter((order) =>
        (!query.status || order.status === query.status) &&
        (!keyword || order.orderNo.includes(keyword) || order.receiverPhone.includes(keyword)) &&
        (!query.from || order.createdAt >= query.from) &&
        (!query.to || order.createdAt <= query.to))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    const start = (query.page - 1) * query.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + query.pageSize).map((order) => ({ ...order })) }
  }
  async sumDeclaredFen(fingerprint: string, from: Date, to: Date): Promise<number> { return [...this.orders.values()].filter((order) => order.idcardFingerprint === fingerprint && order.paidAt && order.createdAt >= from && order.createdAt < to).reduce((sum, order) => sum + order.totalFen, 0) }
  createOrder(input: NewOrder): OrderRecord { const now = new Date(); return { id: randomUUID(), createdAt: now, updatedAt: now, ...input } }
  async saveOrder(order: OrderRecord): Promise<OrderRecord> { order.updatedAt = new Date(); this.orders.set(order.id, { ...order }); return order }
  createItem(input: NewOrderItem): OrderItemRecord { return { id: randomUUID(), ...input } }
  async saveItems(items: OrderItemRecord[]): Promise<OrderItemRecord[]> { items.forEach((item) => this.items.set(item.id, { ...item })); return items }
  async findItems(orderId: string): Promise<OrderItemRecord[]> { return [...this.items.values()].filter((item) => item.orderId === orderId) }
  async recordStatusEvent(input: NewStatusEvent): Promise<void> { this.events.push({ id: randomUUID(), createdAt: new Date(), ...input }) }
  async findStatusEvents(orderId: string): Promise<OrderStatusEventRecord[]> { return this.events.filter((event) => event.orderId === orderId).map((event) => ({ ...event })) }
}
