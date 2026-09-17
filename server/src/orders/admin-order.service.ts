import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common'

import { type AdminActor, AuditLogService } from '../admin/audit-log.service'
import { BusinessException } from '../common/business.exception'
import { WechatCustomsService } from '../payments/wechat-customs.service'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'

import type { AdminOrderQueryDto, AdminOrderConfirmDto, AdminOrderRefundDto } from './admin-order.dto'
import { OrderFulfillmentService } from './order-fulfillment.service'
import { PAYMENT_ADAPTER, type PaymentAdapter } from './local-payment.adapter'
import { ORDER_REPOSITORY, type OrderRecord, type OrderRepository, type OrderStatusEventRecord } from './order.repository'
import { OrderService } from './order.service'
import { RefundService } from './refund.service'
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
  /** 累计已到账退款（分），口径 = 退款单账本 success 合计 */
  refundFen: number | null
  refundedAt: string | null
  /** 剩余可退（分）= 实付 - 已到账 - 在途占用 */
  refundableFen: number
  refunds: { refundNo: string; amountFen: number; status: string; channel: string; reason: string | null; succeededAt: string | null; createdAt: string }[]
  cancelledAt: string | null
  /** 复审 R10：海关申报回执状态（null = 未申报，待履约收敛/人工重推） */
  customsDeclareStatus: string | null
  customsDeclaredAt: string | null
  statusEvents: { fromStatus: string | null; toStatus: string; source: string; remark: string | null; createdAt: string }[]
}

export interface AdminCustomsDeclarationResult {
  orderNo: string
  transactionId: string
  /** UNDECLARED / SUBMITTED / PROCESSING / SUCCESS / FAIL / EXCEPT */
  state: string
  /** UNCHECKED / SAME / DIFFERENT：订购人与支付人身份一致性校验结果 */
  certCheckResult: string
  /** 海关应答全部原始字段（剔除签名），排查 EXCEPT 等异常原因用 */
  detail: Record<string, string>
}

@Injectable()
export class AdminOrderService {
  private readonly logger = new Logger(AdminOrderService.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(WAREHOUSE_ADAPTER) private readonly warehouse: WarehouseAdapter,
    @Inject(PAYMENT_ADAPTER) private readonly paymentAdapter: PaymentAdapter,
    private readonly crypto: PersonalDataCryptoService,
    private readonly audit: AuditLogService,
    private readonly orderService: OrderService,
    private readonly refundService: RefundService,
    private readonly fulfillment: OrderFulfillmentService,
    @Optional() private readonly customs?: WechatCustomsService,
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
    const refunds = await this.refundService.listByOrder(order.id)
    const summary = await this.refundService.summarize(order)
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
      refundableFen: summary.refundableFen,
      refunds: refunds.map((refund) => ({
        refundNo: refund.refundNo, amountFen: refund.amountFen, status: refund.status, channel: refund.channel,
        reason: refund.reason, succeededAt: refund.succeededAt?.toISOString() ?? null, createdAt: refund.createdAt.toISOString(),
      })),
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      customsDeclareStatus: order.customsDeclareStatus,
      customsDeclaredAt: order.customsDeclaredAt?.toISOString() ?? null,
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

  /**
   * 主动查单补状态：支付回调漏单/失败时的兜底入口。
   * 幂等：已支付/已退款直接返回详情；微信侧已支付则复用回调同一套登记逻辑（金额比对 + 推仓 + 报关）。
   */
  async syncPayment(orderNo: string, actor: AdminActor): Promise<AdminOrderDetail> {
    const order = await this.requireOrder(orderNo)
    if (order.paymentStatus !== 'pending') return this.detail(orderNo)
    if (!this.paymentAdapter.queryPayment) throw new BusinessException(40002, '当前支付通道不支持主动查单')

    const remote = await this.paymentAdapter.queryPayment(orderNo)
    if (!remote) throw new BusinessException(40002, '微信侧查无该订单（可能未调起支付）')
    if (remote.tradeState !== 'SUCCESS') throw new BusinessException(40002, `微信侧订单未支付成功（交易状态 ${remote.tradeState}）`)

    await this.orderService.handleWechatPaid({
      orderNo,
      transactionId: remote.transactionId ?? '',
      paidTotalFen: remote.paidTotalFen ?? -1,
      payerTotalFen: remote.payerTotalFen,
      paidAt: remote.paidAt ?? new Date(),
    })
    const saved = await this.requireOrder(orderNo)
    await this.audit.record(actor, 'sync_payment', 'order', orderNo, this.toAuditOrder(order), this.toAuditOrder(saved))
    return this.detail(orderNo)
  }

  /** 报关状态查询：只读拉取微信侧海关申报回执（含全部原始字段），排查申报异常（EXCEPT）原因 */
  async queryCustomsDeclaration(orderNo: string, actor: AdminActor): Promise<AdminCustomsDeclarationResult> {
    const order = await this.requireOrder(orderNo)
    if (!order.wechatTransactionId) throw new BusinessException(40002, '订单未支付或无微信交易号，无申报记录可查')
    if (!this.customs?.isEnabled()) throw new BusinessException(40002, '报关能力未启用（缺少 WXPAY_API_V2_KEY / WXPAY_CUSTOMS_CODE / WXPAY_MCH_CUSTOMS_NO）')

    let result
    try {
      result = await this.customs.queryDeclaration(orderNo, order.wechatTransactionId)
    } catch (error) {
      // 微信侧业务错误（err_code_des 往往正是排查线索），透传给管理员而不是落成 500
      throw new BusinessException(40002, `报关查询失败：${error instanceof Error ? error.message : String(error)}`)
    }
    await this.audit.record(actor, 'query_customs', 'order', orderNo, null, { state: result.state, certCheckResult: result.certCheckResult })
    return { orderNo, transactionId: order.wechatTransactionId, ...result }
  }

  /**
   * 人工重推履约（复审 R10 人工恢复入口）：对已支付待发货订单重跑推仓/申报/申报状态收敛。
   * 推仓与在途收敛幂等；申报终态（EXCEPT/FAIL，业务问题已人工处理后）先重置为未申报再重推——
   * 重置是条件更新，并发重推只有一个生效，微信侧重复申报本身幂等。
   */
  async retryFulfillment(orderNo: string, actor: AdminActor): Promise<AdminOrderDetail> {
    const order = await this.requireOrder(orderNo)
    if (order.paymentStatus !== 'paid' || order.status !== 'ship') {
      throw new BusinessException(40002, '仅已支付待发货的订单支持重推履约')
    }
    await this.fulfillment.pushWarehouseIfNeeded(orderNo)
    if (order.customsDeclareStatus === 'EXCEPT' || order.customsDeclareStatus === 'FAIL') {
      // 报关能力未启用时拒绝重置：否则终态被清回未申报却无法重推，订单卡在中间态
      if (!this.fulfillment.customsEnabled()) {
        throw new BusinessException(40002, '报关能力未启用（缺少 APIv2 密钥等配置），无法重推申报')
      }
      const reset = await this.orderRepository.resetCustomsDeclarationIfTerminal(order.id)
      if (reset) {
        await this.orderRepository.recordStatusEvent({
          orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'admin',
          remark: `管理员重置报关终态（${order.customsDeclareStatus}）并重新发起申报`,
        })
      }
    }
    await this.fulfillment.declareCustomsIfNeeded(orderNo)
    await this.fulfillment.convergeDeclaration(orderNo)
    const saved = await this.requireOrder(orderNo)
    await this.audit.record(actor, 'retry_fulfillment', 'order', orderNo, this.toAuditOrder(order), this.toAuditOrder(saved))
    return this.detail(orderNo)
  }

  async cancel(orderNo: string, dto: AdminOrderConfirmDto, actor: AdminActor): Promise<AdminOrderDetail> {    this.requireConfirm(dto)
    const order = await this.requireOrder(orderNo)
    if (order.status === 'cancelled') throw new BusinessException(40002, '订单已取消')

    const now = new Date()
    // 复审 R09：待支付分支用条件更新替代整体覆盖写；落败时重读，已 paid 则转 paid 分支继续处理
    let target = order
    let pendingCancelled = false
    if (order.paymentStatus === 'pending') {
      pendingCancelled = await this.orderRepository.cancelIfPendingPayment(order.id, now)
      if (!pendingCancelled) {
        target = await this.requireOrder(orderNo)
        if (target.status === 'cancelled') throw new BusinessException(40002, '订单已取消')
        if (target.paymentStatus === 'pending') throw new BusinessException(40002, '当前订单状态不支持取消')
      }
    }

    let saved: OrderRecord
    if (pendingCancelled) {
      // 待支付：直接关闭本地订单，无资金动作
      saved = { ...order, status: 'cancelled', cancelledAt: now }
      await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: 'cancelled', source: 'admin', remark: '管理员取消待支付订单' })
      // 复审 R09：同步关闭微信交易；关单失败不阻断——迟到扣款会登记支付事实并转人工退款
      if (this.paymentAdapter.closePayment) {
        try {
          await this.paymentAdapter.closePayment(orderNo)
        } catch (error) {
          this.logger.warn(`管理员取消订单后关闭微信交易失败（订单 ${orderNo}）：${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } else if (target.paymentStatus === 'paid') {
      // 已支付：按取消窗口校验，可取消则撤单 + 原路退款（复审 R04/R05：走退款状态机，受理≠到账）
      if (!isWarehouseCancellable(target.warehouseStatus)) {
        throw new BusinessException(40002, '订单已申报清关，不可线上取消，请走人工拦截/拒收流程')
      }
      // 退款前置到撤仓之前：已部分退款的订单按剩余可退发起，校验失败则不会留下「仓储已撤、本地未取消」的夹缝态
      const summary = await this.refundService.summarize(target)
      let refundRemark = '退款已全部到账，无资金动作'
      if (summary.refundableFen > 0) {
        const { refund } = await this.refundService.requestRefund(target, summary.refundableFen, '取消订单退款')
        refundRemark = `发起退款 ${refund.amountFen} 分（退款单 ${refund.refundNo}，${refundStatusText(refund.status)}）`
      } else if (summary.processing) {
        refundRemark = `在途退款单 ${summary.processing.refundNo}（${summary.processing.amountFen} 分）处理中`
      }
      // 复审 R10：推仓已解耦为可重试后续步骤——尚未推仓（null）时无仓可撤；
      // 履约收敛只推 ship+paid 的订单，本单随后落 cancelled 即自动排除。
      // 撤仓决策必须用退款后重读的 fresh：退款网络往返期间履约 job 可能已完成推仓（评审 B4）
      const fresh = await this.requireOrder(orderNo)
      let warehouseRemark = '已通知保税仓撤单'
      if (fresh.warehouseStatus === null) {
        warehouseRemark = '订单尚未推仓，无需撤单'
      } else {
        await this.warehouse.cancelOrder(orderNo)
      }
      saved = await this.orderRepository.saveOrder({ ...fresh, status: 'cancelled', cancelledAt: now })
      await this.orderRepository.recordStatusEvent({ orderId: target.id, fromStatus: target.status, toStatus: 'cancelled', source: 'admin', remark: `管理员取消，${refundRemark}；${warehouseRemark}` })
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
    if (order.paymentStatus === 'refunded') throw new BusinessException(40002, '订单已全额退款，请勿重复退款')

    // 复审 R04/R05：金额口径 = 剩余可退（实付 - 已到账 - 在途占用），支持部分退款后再退；
    // 有在途退款时收敛到同一笔（重复点击/重试幂等，R05），不同金额明确拒绝
    const summary = await this.refundService.summarize(order)
    if (summary.processing) {
      if (dto.amountFen != null && dto.amountFen !== summary.processing.amountFen) {
        throw new BusinessException(40002, `该订单有一笔处理中的退款（${summary.processing.amountFen} 分），请等待其结果后再发起`)
      }
      const { refund } = await this.refundService.requestRefund(order, summary.processing.amountFen, '管理员退款')
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'admin',
        remark: `重复退款请求已收敛到在途退款单 ${refund.refundNo}（${refund.amountFen} 分）`,
      })
      return this.detail(orderNo)
    }
    const amountFen = dto.amountFen ?? summary.refundableFen
    if (amountFen <= 0 || amountFen > summary.refundableFen) {
      throw new BusinessException(40003, `退款金额需在 1 与剩余可退金额之间（剩余可退 ${summary.refundableFen} 分）`)
    }
    const { refund } = await this.refundService.requestRefund(order, amountFen, '管理员退款')
    await this.orderRepository.recordStatusEvent({
      orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'admin',
      remark: `管理员发起退款 ${refund.amountFen} 分（退款单 ${refund.refundNo}，${refundStatusText(refund.status)}）`,
    })
    const saved = await this.requireOrder(orderNo)
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

/** 退款单状态文案（事件流/提示用） */
function refundStatusText(status: string): string {
  const map: Record<string, string> = { processing: '已受理，退款处理中', success: '已到账', abnormal: '异常，需人工跟进', closed: '已关闭', failed: '通道未受理，可重新发起' }
  return map[status] ?? status
}
