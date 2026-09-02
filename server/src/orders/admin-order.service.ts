import { HttpStatus, Inject, Injectable } from '@nestjs/common'

import { type AdminActor, AuditLogService } from '../admin/audit-log.service'
import { BusinessException } from '../common/business.exception'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'

import type { AdminOrderQueryDto, AdminOrderConfirmDto, AdminOrderRefundDto } from './admin-order.dto'
import { PAYMENT_ADAPTER, type PaymentAdapter } from './local-payment.adapter'
import { ORDER_REPOSITORY, type OrderRecord, type OrderRepository, type OrderStatusEventRecord } from './order.repository'
import { WAREHOUSE_ADAPTER, type WarehouseAdapter } from './warehouse.adapter'

/**
 * 取消窗口（order-flow.md 第三节）：按本地记录的君梦履约状态判断，不按时间猜。
 * null = 未推君梦；local-accepted = 本地 mock 已推未申报；君梦码 0/3/10 = OMS 内部流转未申报。
 */
const WAREHOUSE_CANCELLABLE_CODES = new Set([0, 3, 10])

export function isWarehouseCancellable(warehouseStatus: string | null): boolean {
  if (!warehouseStatus || warehouseStatus === 'local-accepted') return true
  return WAREHOUSE_CANCELLABLE_CODES.has(Number(warehouseStatus))
}

/** 君梦原始状态码 → 本地主状态（order-flow.md 第 2.2 节映射表）；null 表示保持本地状态不变 */
export function mapWarehouseStatusToLocal(status: string): string | null {
  if (status === 'local-accepted') return 'ship'
  const code = Number(status)
  if (!Number.isInteger(code)) return null
  if (code === 40 || code === 70) return 'receive'
  if (code === 100) return 'complete'
  if (code === 50 || code === 81 || code === 91) return 'cancelled'
  return 'ship'
}

export interface AdminOrderListItem {
  orderNo: string
  status: string
  paymentStatus: string
  warehouseStatus: string | null
  /** 海关退单醒目标记：仓储/海关侧有拦截信息即 true */
  customsRejected: boolean
  systemRemark: string | null
  totalFen: number
  receiverName: string
  receiverPhone: string
  createdAt: string
  paidAt: string | null
}

export interface AdminOrderDetail extends AdminOrderListItem {
  userId: string
  requestId: string
  items: { productId: string; name: string; spec: string; priceFen: number; quantity: number; img: string; themeLight: string }[]
  address: { name: string; phone: string; line: string }
  idName: string
  idcard: string
  refundFen: number | null
  refundedAt: string | null
  cancelledAt: string | null
  statusEvents: { fromStatus: string | null; toStatus: string; source: string; remark: string | null; createdAt: string }[]
}

@Injectable()
export class AdminOrderService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(WAREHOUSE_ADAPTER) private readonly warehouse: WarehouseAdapter,
    @Inject(PAYMENT_ADAPTER) private readonly paymentAdapter: PaymentAdapter,
    private readonly crypto: PersonalDataCryptoService,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: AdminOrderQueryDto): Promise<{ total: number; list: AdminOrderListItem[] }> {
    const page = await this.orderRepository.findAdminPage({
      status: query.status,
      keyword: query.keyword,
      from: query.from,
      to: query.to,
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    })
    return { total: page.total, list: page.list.map((order) => this.toListItem(order)) }
  }

  async detail(orderNo: string): Promise<AdminOrderDetail> {
    const order = await this.requireOrder(orderNo)
    const items = await this.orderRepository.findItems(order.id)
    const events = await this.orderRepository.findStatusEvents(order.id)
    const idcard = this.crypto.decrypt(order.idcardEncrypted)
    return {
      ...this.toListItem(order),
      userId: order.userId,
      requestId: order.requestId,
      items: items.map((item) => ({ productId: item.productId, name: item.name, spec: item.spec, priceFen: item.priceFen, quantity: item.quantity, img: item.img, themeLight: item.themeLight })),
      address: { name: order.receiverName, phone: maskPhone(order.receiverPhone), line: `${order.receiverRegion} ${order.receiverDetail}` },
      idName: order.realnameName,
      idcard: `${idcard.slice(0, 3)}***********${idcard.slice(-4)}`,
      refundFen: order.refundFen,
      refundedAt: order.refundedAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      statusEvents: events.map((event) => this.toEventResponse(event)),
    }
  }

  async sync(orderNo: string, actor: AdminActor): Promise<AdminOrderDetail> {
    const order = await this.requireOrder(orderNo)
    const remote = await this.warehouse.getOrderStatus(orderNo)
    if (!remote) throw new BusinessException(40002, '仓储侧暂无该订单记录（订单可能尚未推送）')

    const nextStatus = mapWarehouseStatusToLocal(remote.status) ?? order.status
    const saved = await this.orderRepository.saveOrder({
      ...order,
      status: order.status === 'cancelled' ? order.status : nextStatus,
      warehouseStatus: remote.status,
      systemRemark: remote.systemRemark ?? order.systemRemark,
    })
    if (saved.status !== order.status || saved.warehouseStatus !== order.warehouseStatus) {
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: saved.status,
        source: 'sync', remark: `仓储状态 ${order.warehouseStatus ?? '无'} → ${remote.status}`,
      })
    }
    await this.audit.record(actor, 'sync_order', 'order', orderNo, this.toAuditOrder(order), this.toAuditOrder(saved))
    return this.detail(orderNo)
  }

  async cancel(orderNo: string, dto: AdminOrderConfirmDto, actor: AdminActor): Promise<AdminOrderDetail> {
    this.requireConfirm(dto)
    const order = await this.requireOrder(orderNo)
    if (order.status === 'cancelled') throw new BusinessException(40002, '订单已取消')

    const now = new Date()
    let saved: OrderRecord
    if (order.paymentStatus === 'pending') {
      // 待支付：直接关闭本地订单，无资金动作
      saved = await this.orderRepository.saveOrder({ ...order, status: 'cancelled', cancelledAt: now })
      await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: 'cancelled', source: 'admin', remark: '管理员取消待支付订单' })
    } else if (order.paymentStatus === 'paid') {
      // 已支付：按取消窗口校验，可取消则撤单 + 原路全额退款
      if (!isWarehouseCancellable(order.warehouseStatus)) {
        throw new BusinessException(40002, '订单已申报清关，不可线上取消，请走人工拦截/拒收流程')
      }
      await this.warehouse.cancelOrder(orderNo)
      const refund = await this.paymentAdapter.refund(orderNo, order.totalFen)
      saved = await this.orderRepository.saveOrder({
        ...order, status: 'cancelled', paymentStatus: 'refunded', refundFen: order.totalFen, refundedAt: now, cancelledAt: now,
      })
      await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: 'cancelled', source: 'admin', remark: `管理员取消并全额退款（退款单 ${refund.refundNo}）` })
    } else {
      throw new BusinessException(40002, '当前订单状态不支持取消')
    }
    await this.audit.record(actor, 'cancel_order', 'order', orderNo, this.toAuditOrder(order), this.toAuditOrder(saved))
    return this.detail(orderNo)
  }

  async refund(orderNo: string, dto: AdminOrderRefundDto, actor: AdminActor): Promise<AdminOrderDetail> {
    this.requireConfirm(dto)
    const order = await this.requireOrder(orderNo)
    if (order.paymentStatus === 'pending') throw new BusinessException(40002, '订单未支付，不能退款')
    if (order.paymentStatus === 'refunded') throw new BusinessException(40002, '订单已退款，请勿重复退款')

    const amountFen = dto.amountFen ?? order.totalFen
    if (amountFen > order.totalFen) throw new BusinessException(40003, '退款金额不能超过实付金额')

    const result = await this.paymentAdapter.refund(orderNo, amountFen)
    const saved = await this.orderRepository.saveOrder({
      ...order, paymentStatus: 'refunded', refundFen: amountFen, refundedAt: new Date(),
    })
    await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'admin', remark: `管理员退款 ${amountFen} 分（退款单 ${result.refundNo}）` })
    await this.audit.record(actor, 'refund_order', 'order', orderNo, this.toAuditOrder(order), this.toAuditOrder(saved))
    return this.detail(orderNo)
  }

  private requireConfirm(dto: AdminOrderConfirmDto): void {
    if (dto.confirm !== true) throw new BusinessException(40003, '该操作需要二次确认，请设置 confirm=true')
  }

  private async requireOrder(orderNo: string): Promise<OrderRecord> {
    const order = await this.orderRepository.findOneByOrderNo(orderNo)
    if (!order) throw new BusinessException(40404, '订单不存在', HttpStatus.NOT_FOUND)
    return order
  }

  private toListItem(order: OrderRecord): AdminOrderListItem {
    return {
      orderNo: order.orderNo,
      status: order.status,
      paymentStatus: order.paymentStatus,
      warehouseStatus: order.warehouseStatus,
      customsRejected: Boolean(order.systemRemark),
      systemRemark: order.systemRemark,
      totalFen: order.totalFen,
      receiverName: order.receiverName,
      receiverPhone: maskPhone(order.receiverPhone),
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
    }
  }

  private toEventResponse(event: OrderStatusEventRecord): AdminOrderDetail['statusEvents'][number] {
    return { fromStatus: event.fromStatus, toStatus: event.toStatus, source: event.source, remark: event.remark, createdAt: event.createdAt.toISOString() }
  }

  private toAuditOrder(order: OrderRecord): Record<string, unknown> {
    const { orderNo, status, paymentStatus, warehouseStatus, totalFen, systemRemark, refundFen } = order
    return { orderNo, status, paymentStatus, warehouseStatus, totalFen, systemRemark, refundFen }
  }
}

function maskPhone(phone: string): string { return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') }
