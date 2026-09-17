import { Inject, Injectable, Logger, Optional } from '@nestjs/common'

import { WechatCustomsService } from '../payments/wechat-customs.service'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'

import { ORDER_REPOSITORY, type OrderRepository } from './order.repository'
import { WAREHOUSE_ADAPTER, type WarehouseAdapter } from './warehouse.adapter'

/**
 * 订单履约服务（复审 R10：推仓/报关与支付落库解耦）。
 * 支付回调/确认只负责登记支付事实；推仓与海关申报是「立即 best-effort 一次 +
 * 履约收敛 job 扫库重试 + 超时转人工（后台重推按钮）」的可重试后续步骤。
 * 全部操作按订单幂等：重复执行/并发执行不产生重复副作用（条件更新兜底，
 * 微信侧重复申报幂等——重复申报状态为 SUBMITTED 更新同一条记录）。
 */
@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name)

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(WAREHOUSE_ADAPTER) private readonly warehouse: WarehouseAdapter,
    private readonly crypto: PersonalDataCryptoService,
    @Optional() private readonly customs?: WechatCustomsService,
  ) {}

  /**
   * 推仓（仅当 已支付待发货且未推仓）；不向调用方抛出异常——失败留 warehouseStatus=null 待收敛。
   * 返回 true = 本单已无需再推（已推过/本次成功）；false = 未推成功，需后续重试。
   */
  async pushWarehouseIfNeeded(orderNo: string): Promise<boolean> {
    const order = await this.orderRepository.findOneByOrderNo(orderNo)
    if (!order || order.status !== 'ship' || order.paymentStatus !== 'paid') return true
    if (order.warehouseStatus !== null) return true

    try {
      await this.warehouse.pushOrder(orderNo)
    } catch (error) {
      this.logger.error(`订单 ${orderNo} 推仓失败，待后台收敛重试`, error instanceof Error ? error.stack : String(error))
      await this.recordFailureEventOnce(order.id, order.status, 'system', '推仓失败', `推仓失败：${error instanceof Error ? error.message : String(error)}（待后台重试）`)
      return false
    }

    // 条件更新兜底并发：先重读区分落败原因——
    // ① 订单已非 ship+paid（并发取消获胜）→ 撤掉本次孤儿推仓；
    // ② 并发执行者已先标记（重复回调/job/人工重推同时推仓）→ 对方推仓合法，直接视为完成，绝不能误撤
    const marked = await this.orderRepository.markWarehousePushed(order.id, 'local-accepted')
    if (marked) {
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'system', remark: '订单已推送保税仓',
      })
      return true
    }
    const fresh = await this.orderRepository.findOneByOrderNo(orderNo)
    if (fresh?.status === 'ship' && fresh.paymentStatus === 'paid' && fresh.warehouseStatus !== null) {
      return true // 并发方已推仓并标记，本单推仓已完成
    }
    try {
      await this.warehouse.cancelOrder(orderNo)
      this.logger.warn(`订单 ${orderNo} 推仓后并发落败（订单已非待发货），已撤销孤儿推仓`)
    } catch (error) {
      this.logger.error(`订单 ${orderNo} 推仓后并发落败，撤销孤儿推仓失败，待人工核对仓储侧`, error instanceof Error ? error.stack : String(error))
    }
    await this.orderRepository.recordStatusEvent({
      orderId: order.id, fromStatus: order.status, toStatus: order.status, source: 'system', remark: '推仓与订单取消并发，已撤销本次推仓',
    })
    return true
  }

  /**
   * 海关申报（仅当 已支付、有微信交易号、未申报、报关能力已启用）；不向调用方抛出异常。
   * 返回 true = 本单无需再申报（已申报过/不可申报/能力未启用）；false = 申报失败待重试。
   */
  async declareCustomsIfNeeded(orderNo: string): Promise<boolean> {
    const order = await this.orderRepository.findOneByOrderNo(orderNo)
    // status='ship' 守卫：取消后补登记支付的订单（迟到扣款转人工退款）不报关
    if (!order || order.status !== 'ship' || order.paymentStatus !== 'paid' || !order.wechatTransactionId || order.customsDeclareStatus !== null) return true
    if (!this.customs?.isEnabled()) return true

    try {
      const result = await this.customs.submitDeclaration({
        orderNo: order.orderNo,
        transactionId: order.wechatTransactionId,
        realname: { name: order.realnameName, idcard: this.crypto.decrypt(order.idcardEncrypted) },
      })
      await this.orderRepository.updateCustomsDeclaration(order.id, { status: result.state || 'SUBMITTED', declaredAt: new Date() })
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status,
        source: 'payment', remark: `支付单海关申报已提交（状态 ${result.state}，身份校验 ${result.certCheckResult}）`,
      })
      if (result.certCheckResult === 'DIFFERENT') {
        this.logger.warn(`订单 ${order.orderNo} 订购人与支付人身份不一致，需人工核对`)
      }
      return true
    } catch (error) {
      this.logger.error(`订单 ${order.orderNo} 海关申报提交失败，待后台收敛重试`, error instanceof Error ? error.stack : String(error))
      await this.recordFailureEventOnce(order.id, order.status, 'payment', '支付单海关申报提交失败', '支付单海关申报提交失败，待后台重试')
      return false
    }
  }

  /** 失败事件去重：同前缀的失败事件只记一次，避免收敛 job 每轮重试刷事件流 */
  private async recordFailureEventOnce(orderId: string, status: string, source: string, remarkPrefix: string, remark: string): Promise<void> {
    const events = await this.orderRepository.findStatusEvents(orderId)
    if (events.some((event) => event.remark?.startsWith(remarkPrefix))) return
    await this.orderRepository.recordStatusEvent({ orderId, fromStatus: status, toStatus: status, source, remark })
  }

  /** 报关能力是否启用（job 据此跳过申报类扫描，避免空转计数） */
  customsEnabled(): boolean {
    return Boolean(this.customs?.isEnabled())
  }

  /** 申报在途（UNDECLARED/SUBMITTED/PROCESSING）状态查询收敛；仅在状态变化时落库 + 事件。 */
  async convergeDeclaration(orderNo: string): Promise<boolean> {
    const order = await this.orderRepository.findOneByOrderNo(orderNo)
    if (!order || !order.wechatTransactionId || !order.customsDeclareStatus) return true
    if (!this.customs?.isEnabled()) return true

    try {
      const result = await this.customs.queryDeclaration(order.orderNo, order.wechatTransactionId)
      if (result.state && result.state !== order.customsDeclareStatus) {
        await this.orderRepository.updateCustomsDeclaration(order.id, { status: result.state, declaredAt: new Date() })
        await this.orderRepository.recordStatusEvent({
          orderId: order.id, fromStatus: order.status, toStatus: order.status,
          source: 'system', remark: `海关申报状态收敛：${order.customsDeclareStatus} → ${result.state}（身份校验 ${result.certCheckResult}）`,
        })
      }
      return true
    } catch (error) {
      this.logger.warn(`订单 ${order.orderNo} 申报状态查询失败（下轮重试）：${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }
}
