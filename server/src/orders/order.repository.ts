import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Between, Brackets, In, IsNull, LessThan, MoreThanOrEqual, Not, type EntityManager, Repository } from 'typeorm'

import { BusinessException } from '../common/business.exception'

import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'
import { OrderStatusEventEntity } from './order-event.entity'

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY')

/** 海关申报在途状态（非终态）：job 定期按 customdeclarequery 收敛；EXCEPT/FAIL/SUCCESS 为终态不自动重试 */
export const CUSTOMS_CONVERGING_STATES = ['UNDECLARED', 'SUBMITTED', 'PROCESSING']

export interface OrderRecord {
  id: string; orderNo: string; userId: string; requestId: string; status: string; paymentStatus: string
  warehouseStatus: string | null; totalFen: number; realnameName: string; idcardEncrypted: string; idcardFingerprint: string
  receiverName: string; receiverPhone: string; receiverRegion: string; receiverDetail: string
  paidAt: Date | null; cancelledAt: Date | null; systemRemark: string | null; refundFen: number | null; refundedAt: Date | null
  wechatTransactionId: string | null
  /** 复审 R10：海关申报回执状态；NULL = 未申报（待履约收敛） */
  customsDeclareStatus: string | null
  customsDeclaredAt: Date | null
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
  /** 后台用户详情页内嵌订单列表用：按下单用户过滤 */
  userId?: string
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
  /**
   * 后台用户列表/详情聚合：按用户统计 订单数（全部订单 COUNT）与累计消费
   * （paymentStatus IN ('paid','refunding','refunded') 的 total_fen 合计——已支付口径，含退款中/已退款）。
   * 空数组直接返回 {}，不发起 SQL。
   */
  summarizeByUsers(userIds: string[]): Promise<Record<string, { orderCount: number; paidTotalFen: number }>>
  /**
   * 复审 R06：年度额度预占查询——「占用中」订单在统计区间（创建年）内的总额（分）。
   * 占用 = (paymentStatus='pending' 且 status='pay') 或 paymentStatus IN ('paid','refunding')；
   * 释放 = 未支付已取消（pending+cancelled，含 24h 超时关单） 或 全额退款（refunded）；
   * 部分退款不释放（退款后额度是否返还最终以海关为准，本地从简）。
   * 年度归属 = 订单创建年（与预占时点一致；跨年支付不再切换归属年）。
   */
  sumOccupiedYearlyFen(idcardFingerprint: string, from: Date, to: Date): Promise<number>
  /**
   * 复审 R06：年度额度「检查 + 插入」原子化——按实名指纹维度取 MySQL 命名锁（GET_LOCK），
   * 锁内执行 work（额度查询 + 订单创建），同证件并发创建排队而非各自按旧快照放行。
   * 锁的是证件指纹而非用户：不同账号同证件共享年度额度（海关按证件统计）。
   * 内存实现用 per-key Promise 链串行，语义一致。
   */
  withYearlyQuotaLock<T>(idcardFingerprint: string, work: () => Promise<T>): Promise<T>
  /** 超时关单任务用：查找 cutoff 之前创建、仍待支付的订单（按创建时间升序，限量防单轮过大） */
  findPendingExpired(cutoff: Date, limit: number): Promise<OrderRecord[]>
  /**
   * 超时关单任务用：仅当订单仍是 待支付（pay+pending）时才取消，返回是否取消成功。
   * 竞态安全（评审 4.3 阻断项）：扫描后支付回调先登记支付的订单，条件更新影响 0 行，让位不覆盖。
   */
  cancelIfPendingPayment(orderId: string, cancelledAt: Date): Promise<boolean>
  /**
   * 复审 R09：支付回调登记支付用——仅当订单仍是 待支付（pay+pending）时才置 已支付+待发货，
   * 返回是否写入成功。纯条件更新消除「读旧对象整体覆盖写」窗口：与取消并发落败时受影响 0 行，
   * 让位不覆盖，由调用方重读按最新状态分支处理。
   * 复审 R10：不再顺带写 warehouseStatus——推仓解耦为可重试的后续步骤，推仓成功才由 markWarehousePushed 写入。
   */
  markPaidIfPending(orderId: string, fields: { paidAt: Date; wechatTransactionId: string | null }): Promise<boolean>
  /**
   * 复审 R10：推仓成功回写——仅当订单 已支付待发货且尚未推仓 时才写 warehouseStatus，返回是否写入成功。
   * 落败 = 并发取消已赢（订单不再 ship/paid 或已被推过），调用方负责撤掉本次孤儿推仓。
   */
  markWarehousePushed(orderId: string, warehouseStatus: string): Promise<boolean>
  /**
   * 复审 R10：海关申报回执落库——仅在 未申报/在途（UNDECLARED/SUBMITTED/PROCESSING）时写入，
   * 不覆盖 SUCCESS/FAIL/EXCEPT 终态；返回是否写入成功。
   */
  updateCustomsDeclaration(orderId: string, fields: { status: string; declaredAt: Date }): Promise<boolean>
  /**
   * 人工重推报关前置：仅当当前为终态 EXCEPT/FAIL 时重置为未申报（NULL），返回是否重置成功。
   * 并发两个人工重推只有一个能重置，避免重复申报（微信侧重复申报本身幂等，此处收敛事件噪音）。
   */
  resetCustomsDeclarationIfTerminal(orderId: string): Promise<boolean>
  /** 履约收敛 job：查 已支付待发货但未推仓 的订单（paid_at >= since，按支付时间升序，限量） */
  findPendingWarehousePush(since: Date, limit: number): Promise<OrderRecord[]>
  /** 履约收敛 job：查 已支付待发货、有微信交易号但未申报 的订单（paid_at >= since，按支付时间升序，限量） */
  findPendingCustomsDeclare(since: Date, limit: number): Promise<OrderRecord[]>
  /** 履约收敛 job：查 待发货订单中 申报在途（UNDECLARED/SUBMITTED/PROCESSING）需查询收敛的订单 */
  findConvergingCustomsDeclare(since: Date, limit: number): Promise<OrderRecord[]>
  /**
   * 复审 R09：取消后收到的迟到扣款补登支付事实——仅当订单仍是 已取消且未登记支付（cancelled+pending）
   * 时才写入，返回是否写入成功；并发重复回调落败时返回 false，由调用方重读幂等收敛。
   */
  registerLatePaymentIfCancelled(orderId: string, fields: { paidAt: Date; wechatTransactionId: string; systemRemark: string }): Promise<boolean>
  /** 复审 R09：退款结算定向更新 paymentStatus/refundFen/refundedAt 三列，不整体覆盖订单其他字段 */
  updateRefundSettlement(orderId: string, fields: { paymentStatus: string; refundFen: number | null; refundedAt: Date | null }): Promise<void>
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
    if (query.userId) builder.andWhere('order.user_id = :userId', { userId: query.userId })
    if (query.from) builder.andWhere('order.created_at >= :from', { from: query.from })
    if (query.to) builder.andWhere('order.created_at <= :to', { to: query.to })
    const [list, total] = await builder.skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount()
    return { total, list }
  }
  async summarizeByUsers(userIds: string[]): Promise<Record<string, { orderCount: number; paidTotalFen: number }>> {
    if (userIds.length === 0) return {}
    const rows = await this.orders.createQueryBuilder('order')
      .select('order.user_id', 'userId')
      .addSelect('COUNT(*)', 'orderCount')
      // 累计消费只计已支付口径（paid/refunding/refunded），待支付/未付款取消不计
      .addSelect("COALESCE(SUM(CASE WHEN order.payment_status IN ('paid','refunding','refunded') THEN order.total_fen ELSE 0 END), 0)", 'paidTotalFen')
      .where('order.user_id IN (:...userIds)', { userIds })
      .groupBy('order.user_id')
      .getRawMany<{ userId: string; orderCount: string; paidTotalFen: string }>()
    const result: Record<string, { orderCount: number; paidTotalFen: number }> = {}
    for (const row of rows) result[row.userId] = { orderCount: Number(row.orderCount), paidTotalFen: Number(row.paidTotalFen) }
    return result
  }
  async sumOccupiedYearlyFen(idcardFingerprint: string, from: Date, to: Date): Promise<number> {
    const result = await this.orders.createQueryBuilder('order').select('COALESCE(SUM(order.total_fen), 0)', 'total')
      .where('order.idcard_fingerprint = :idcardFingerprint', { idcardFingerprint })
      // 占用集合见接口注释；OR 组合必须用 Brackets 包裹，避免与外层 AND 条件串味
      .andWhere(new Brackets((qb) => {
        qb.where("order.payment_status = 'pending' AND order.status = 'pay'")
          .orWhere("order.payment_status IN ('paid', 'refunding')")
      }))
      .andWhere({ createdAt: Between(from, to) }).getRawOne<{ total: string }>()
    return Number(result?.total ?? 0)
  }
  async withYearlyQuotaLock<T>(idcardFingerprint: string, work: () => Promise<T>): Promise<T> {
    // MySQL 命名锁名称上限 64 字符：前缀 + sha256 指纹（64 位）超长，截断到 55 位（220 bit 抗碰撞足够）
    const lockName = `wb_quota:${idcardFingerprint.slice(0, 55)}`
    return this.orders.manager.transaction(async (manager) => {
      // GET_LOCK 是连接级会话锁：当前事务连接持有期间，其他连接的同名锁请求排队（锁超时 10 秒）。
      // 命名锁不随事务提交/回滚自动释放，必须 finally 显式 RELEASE_LOCK
      const rows = await manager.query<{ locked: number | string | null }[]>('SELECT GET_LOCK(?, 10) AS locked', [lockName])
      if (Number(rows?.[0]?.locked) !== 1) throw new BusinessException(40001, '操作繁忙，请稍后重试')
      try {
        return await work()
      } finally {
        // 释放失败不覆盖业务结果：连接断开时命名锁随会话自动释放
        await manager.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined)
      }
    })
  }
  createOrder(input: NewOrder): OrderEntity { return this.orders.create(input) }
  findPendingExpired(cutoff: Date, limit: number): Promise<OrderEntity[]> {
    return this.orders.find({ where: { status: 'pay', paymentStatus: 'pending', createdAt: LessThan(cutoff) }, order: { createdAt: 'ASC' }, take: limit })
  }
  async cancelIfPendingPayment(orderId: string, cancelledAt: Date): Promise<boolean> {
    const result = await this.orders.update({ id: orderId, status: 'pay', paymentStatus: 'pending' }, { status: 'cancelled', cancelledAt })
    return (result.affected ?? 0) > 0
  }
  async markPaidIfPending(orderId: string, fields: { paidAt: Date; wechatTransactionId: string | null }): Promise<boolean> {
    const result = await this.orders.update(
      { id: orderId, status: 'pay', paymentStatus: 'pending' },
      { status: 'ship', paymentStatus: 'paid', ...fields },
    )
    return (result.affected ?? 0) > 0
  }
  async markWarehousePushed(orderId: string, warehouseStatus: string): Promise<boolean> {
    const result = await this.orders.update(
      { id: orderId, status: 'ship', paymentStatus: 'paid', warehouseStatus: IsNull() },
      { warehouseStatus },
    )
    return (result.affected ?? 0) > 0
  }
  async updateCustomsDeclaration(orderId: string, fields: { status: string; declaredAt: Date }): Promise<boolean> {
    const result = await this.orders.createQueryBuilder().update()
      .set({ customsDeclareStatus: fields.status, customsDeclaredAt: fields.declaredAt })
      .where('id = :orderId', { orderId })
      .andWhere('(customs_declare_status IS NULL OR customs_declare_status IN (:...states))', { states: CUSTOMS_CONVERGING_STATES })
      .execute()
    return (result.affected ?? 0) > 0
  }
  async resetCustomsDeclarationIfTerminal(orderId: string): Promise<boolean> {
    const result = await this.orders.update(
      { id: orderId, customsDeclareStatus: In(['EXCEPT', 'FAIL']) },
      { customsDeclareStatus: null, customsDeclaredAt: null },
    )
    return (result.affected ?? 0) > 0
  }
  findPendingWarehousePush(since: Date, limit: number): Promise<OrderEntity[]> {
    return this.orders.find({
      where: { status: 'ship', paymentStatus: 'paid', warehouseStatus: IsNull(), paidAt: MoreThanOrEqual(since) },
      order: { paidAt: 'ASC' }, take: limit,
    })
  }
  findPendingCustomsDeclare(since: Date, limit: number): Promise<OrderEntity[]> {
    // status='ship' 守卫：取消后补登记支付（迟到扣款转人工退款）的订单不自动报关
    return this.orders.find({
      where: { status: 'ship', paymentStatus: 'paid', wechatTransactionId: Not(IsNull()), customsDeclareStatus: IsNull(), paidAt: MoreThanOrEqual(since) },
      order: { paidAt: 'ASC' }, take: limit,
    })
  }
  findConvergingCustomsDeclare(since: Date, limit: number): Promise<OrderEntity[]> {
    return this.orders.find({
      where: { status: 'ship', paymentStatus: 'paid', customsDeclareStatus: In(CUSTOMS_CONVERGING_STATES), paidAt: MoreThanOrEqual(since) },
      order: { paidAt: 'ASC' }, take: limit,
    })
  }
  async registerLatePaymentIfCancelled(orderId: string, fields: { paidAt: Date; wechatTransactionId: string; systemRemark: string }): Promise<boolean> {
    const result = await this.orders.update(
      { id: orderId, status: 'cancelled', paymentStatus: 'pending' },
      { paymentStatus: 'paid', ...fields },
    )
    return (result.affected ?? 0) > 0
  }
  async updateRefundSettlement(orderId: string, fields: { paymentStatus: string; refundFen: number | null; refundedAt: Date | null }): Promise<void> {
    await this.orders.update({ id: orderId }, fields)
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
        (!query.userId || order.userId === query.userId) &&
        (!keyword || order.orderNo.includes(keyword) || order.receiverPhone.includes(keyword)) &&
        (!query.from || order.createdAt >= query.from) &&
        (!query.to || order.createdAt <= query.to))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    const start = (query.page - 1) * query.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + query.pageSize).map((order) => ({ ...order })) }
  }
  async summarizeByUsers(userIds: string[]): Promise<Record<string, { orderCount: number; paidTotalFen: number }>> {
    const result: Record<string, { orderCount: number; paidTotalFen: number }> = {}
    if (userIds.length === 0) return result
    const included = new Set(userIds)
    for (const order of this.orders.values()) {
      if (!included.has(order.userId)) continue
      const summary = (result[order.userId] ??= { orderCount: 0, paidTotalFen: 0 })
      summary.orderCount += 1
      if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunding' || order.paymentStatus === 'refunded') {
        summary.paidTotalFen += order.totalFen
      }
    }
    return result
  }
  async sumOccupiedYearlyFen(idcardFingerprint: string, from: Date, to: Date): Promise<number> {
    return [...this.orders.values()]
      .filter((order) => order.idcardFingerprint === idcardFingerprint && order.createdAt >= from && order.createdAt < to &&
        ((order.paymentStatus === 'pending' && order.status === 'pay') || order.paymentStatus === 'paid' || order.paymentStatus === 'refunding'))
      .reduce((sum, order) => sum + order.totalFen, 0)
  }
  private readonly quotaLocks = new Map<string, Promise<void>>()
  async withYearlyQuotaLock<T>(idcardFingerprint: string, work: () => Promise<T>): Promise<T> {
    // per-key Promise 链互斥：后来者接续在前者之后执行，镜像 GET_LOCK 的排队语义；
    // 前序 work 抛错只保留时序不传播错误（各自的业务错误各自抛）
    const previous = this.quotaLocks.get(idcardFingerprint) ?? Promise.resolve()
    let release!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    const tail = previous.catch(() => undefined).then(() => held)
    this.quotaLocks.set(idcardFingerprint, tail)
    await previous.catch(() => undefined)
    try {
      return await work()
    } finally {
      release()
      // 无后继排队时清扫链尾，避免 Map 滞留
      if (this.quotaLocks.get(idcardFingerprint) === tail) this.quotaLocks.delete(idcardFingerprint)
    }
  }
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
  async markPaidIfPending(orderId: string, fields: { paidAt: Date; wechatTransactionId: string | null }): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order || order.status !== 'pay' || order.paymentStatus !== 'pending') return false
    this.orders.set(orderId, { ...order, status: 'ship', paymentStatus: 'paid', ...fields, updatedAt: new Date() })
    return true
  }
  async markWarehousePushed(orderId: string, warehouseStatus: string): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order || order.status !== 'ship' || order.paymentStatus !== 'paid' || order.warehouseStatus !== null) return false
    this.orders.set(orderId, { ...order, warehouseStatus, updatedAt: new Date() })
    return true
  }
  async updateCustomsDeclaration(orderId: string, fields: { status: string; declaredAt: Date }): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order) return false
    if (order.customsDeclareStatus !== null && !CUSTOMS_CONVERGING_STATES.includes(order.customsDeclareStatus)) return false
    this.orders.set(orderId, { ...order, customsDeclareStatus: fields.status, customsDeclaredAt: fields.declaredAt, updatedAt: new Date() })
    return true
  }
  async resetCustomsDeclarationIfTerminal(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order || (order.customsDeclareStatus !== 'EXCEPT' && order.customsDeclareStatus !== 'FAIL')) return false
    this.orders.set(orderId, { ...order, customsDeclareStatus: null, customsDeclaredAt: null, updatedAt: new Date() })
    return true
  }
  async findPendingWarehousePush(since: Date, limit: number): Promise<OrderRecord[]> {
    return [...this.orders.values()]
      .filter((order) => order.status === 'ship' && order.paymentStatus === 'paid' && order.warehouseStatus === null && order.paidAt !== null && order.paidAt >= since)
      .sort((left, right) => left.paidAt!.getTime() - right.paidAt!.getTime())
      .slice(0, limit)
  }
  async findPendingCustomsDeclare(since: Date, limit: number): Promise<OrderRecord[]> {
    // status='ship' 守卫：取消后补登记支付（迟到扣款转人工退款）的订单不自动报关
    return [...this.orders.values()]
      .filter((order) => order.status === 'ship' && order.paymentStatus === 'paid' && order.wechatTransactionId !== null && order.customsDeclareStatus === null && order.paidAt !== null && order.paidAt >= since)
      .sort((left, right) => left.paidAt!.getTime() - right.paidAt!.getTime())
      .slice(0, limit)
  }
  async findConvergingCustomsDeclare(since: Date, limit: number): Promise<OrderRecord[]> {
    return [...this.orders.values()]
      .filter((order) => order.status === 'ship' && order.paymentStatus === 'paid' && order.customsDeclareStatus !== null && CUSTOMS_CONVERGING_STATES.includes(order.customsDeclareStatus) && order.paidAt !== null && order.paidAt >= since)
      .sort((left, right) => left.paidAt!.getTime() - right.paidAt!.getTime())
      .slice(0, limit)
  }
  async registerLatePaymentIfCancelled(orderId: string, fields: { paidAt: Date; wechatTransactionId: string; systemRemark: string }): Promise<boolean> {
    const order = this.orders.get(orderId)
    if (!order || order.status !== 'cancelled' || order.paymentStatus !== 'pending') return false
    this.orders.set(orderId, { ...order, paymentStatus: 'paid', ...fields, updatedAt: new Date() })
    return true
  }
  async updateRefundSettlement(orderId: string, fields: { paymentStatus: string; refundFen: number | null; refundedAt: Date | null }): Promise<void> {
    const order = this.orders.get(orderId)
    if (!order) return
    this.orders.set(orderId, { ...order, ...fields, updatedAt: new Date() })
  }
  async runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T> { return work() }
  async saveOrder(order: OrderRecord): Promise<OrderRecord> { order.updatedAt = new Date(); this.orders.set(order.id, { ...order }); return order }
  createItem(input: NewOrderItem): OrderItemRecord { return { id: randomUUID(), ...input } }
  async saveItems(items: OrderItemRecord[]): Promise<OrderItemRecord[]> { items.forEach((item) => this.items.set(item.id, { ...item })); return items }
  async findItems(orderId: string): Promise<OrderItemRecord[]> { return [...this.items.values()].filter((item) => item.orderId === orderId) }
  async recordStatusEvent(input: NewStatusEvent): Promise<void> { this.events.push({ id: randomUUID(), createdAt: new Date(), ...input }) }
  async findStatusEvents(orderId: string): Promise<OrderStatusEventRecord[]> { return this.events.filter((event) => event.orderId === orderId).map((event) => ({ ...event })) }
}
