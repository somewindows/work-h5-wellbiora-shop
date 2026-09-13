import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Between, LessThan, type EntityManager, Repository } from 'typeorm'

import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'
import { OrderStatusEventEntity } from './order-event.entity'

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY')

export interface OrderRecord {
  id: string; orderNo: string; userId: string; requestId: string; status: string; paymentStatus: string
  warehouseStatus: string | null; totalFen: number; realnameName: string; idcardEncrypted: string; idcardFingerprint: string
  receiverName: string; receiverPhone: string; receiverRegion: string; receiverDetail: string
  paidAt: Date | null; cancelledAt: Date | null; systemRemark: string | null; refundFen: number | null; refundedAt: Date | null
  wechatTransactionId: string | null
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
  /** 超时关单任务用：查找 cutoff 之前创建、仍待支付的订单（按创建时间升序，限量防单轮过大） */
  findPendingExpired(cutoff: Date, limit: number): Promise<OrderRecord[]>
  /**
   * 超时关单任务用：仅当订单仍是 待支付（pay+pending）时才取消，返回是否取消成功。
   * 竞态安全（评审 4.3 阻断项）：扫描后支付回调先登记支付的订单，条件更新影响 0 行，让位不覆盖。
   */
  cancelIfPendingPayment(orderId: string, cancelledAt: Date): Promise<boolean>
  /** 复审 R03：把多个写操作放进同一数据库事务；内存实现直接执行（无事务语义） */
  runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T>
  createOrder(input: NewOrder): OrderRecord
  saveOrder(order: OrderRecord, manager?: EntityManager): Promise<OrderRecord>
  createItem(input: NewOrderItem): OrderItemRecord
  saveItems(items: OrderItemRecord[], manager?: EntityManager): Promise<OrderItemRecord[]>
  findItems(orderId: string): Promise<OrderItemRecord[]>
  recordStatusEvent(input: NewStatusEvent, manager?: EntityManager): Promise<void>
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
  findPendingExpired(cutoff: Date, limit: number): Promise<OrderEntity[]> {
    return this.orders.find({ where: { status: 'pay', paymentStatus: 'pending', createdAt: LessThan(cutoff) }, order: { createdAt: 'ASC' }, take: limit })
  }
  async cancelIfPendingPayment(orderId: string, cancelledAt: Date): Promise<boolean> {
    const result = await this.orders.update({ id: orderId, status: 'pay', paymentStatus: 'pending' }, { status: 'cancelled', cancelledAt })
    return (result.affected ?? 0) > 0
  }
  runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T> { return this.orders.manager.transaction(work) }
  saveOrder(order: OrderRecord, manager?: EntityManager): Promise<OrderEntity> {
    return manager ? manager.save(OrderEntity, order as OrderEntity) : this.orders.save(order)
  }
  createItem(input: NewOrderItem): OrderItemEntity { return this.items.create(input) }
  saveItems(items: OrderItemRecord[], manager?: EntityManager): Promise<OrderItemEntity[]> {
    return manager ? manager.save(OrderItemEntity, items as OrderItemEntity[]) : this.items.save(items)
  }
  findItems(orderId: string): Promise<OrderItemEntity[]> { return this.items.find({ where: { orderId } }) }
  async recordStatusEvent(input: NewStatusEvent, manager?: EntityManager): Promise<void> {
    const event = this.events.create(input)
    if (manager) await manager.save(OrderStatusEventEntity, event)
    else await this.events.save(event)
  }
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
  async findPendingExpired(cutoff: Date, limit: number): Promise<OrderRecord[]> {
    return [...this.orders.values()]
      .filter((order) => order.status === 'pay' && order.paymentStatus === 'pending' && order.createdAt < cutoff)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, limit)
  }
  async cancelIfPendingPayment(orderId: string, cancelledAt: Date): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order || order.status !== 'pay' || order.paymentStatus !== 'pending') return false
    this.orders.set(orderId, { ...order, status: 'cancelled', cancelledAt, updatedAt: new Date() })
    return true
  }
  async runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T> { return work() }
  async saveOrder(order: OrderRecord): Promise<OrderRecord> { order.updatedAt = new Date(); this.orders.set(order.id, { ...order }); return order }
  createItem(input: NewOrderItem): OrderItemRecord { return { id: randomUUID(), ...input } }
  async saveItems(items: OrderItemRecord[]): Promise<OrderItemRecord[]> { items.forEach((item) => this.items.set(item.id, { ...item })); return items }
  async findItems(orderId: string): Promise<OrderItemRecord[]> { return [...this.items.values()].filter((item) => item.orderId === orderId) }
  async recordStatusEvent(input: NewStatusEvent): Promise<void> { this.events.push({ id: randomUUID(), createdAt: new Date(), ...input }) }
  async findStatusEvents(orderId: string): Promise<OrderStatusEventRecord[]> { return this.events.filter((event) => event.orderId === orderId).map((event) => ({ ...event })) }
}
