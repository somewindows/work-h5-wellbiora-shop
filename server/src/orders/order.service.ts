import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

import { CATALOG_REPOSITORY, type CatalogProductRecord, type SellableProductSource } from '../catalog/catalog.repository'
import { BusinessException } from '../common/business.exception'
import { CART_REPOSITORY, type CartItemRecord, type CartRepository } from '../cart/cart.repository'
import { ProfileService } from '../profile/profile.service'
import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { USERS_REPOSITORY, type UsersRepository } from '../users/users.repository'
import { WechatCustomsService } from '../payments/wechat-customs.service'

import type { CreateOrderDto } from './order.dto'
import { PAYMENT_ADAPTER, type PayContext, type PaymentAdapter } from './local-payment.adapter'
import { ORDER_REPOSITORY, type OrderRecord, type OrderRepository } from './order.repository'
import { WAREHOUSE_ADAPTER, type WarehouseAdapter } from './warehouse.adapter'

const SINGLE_ORDER_LIMIT_FEN = 500000
const YEARLY_LIMIT_FEN = 2600000

/** 微信支付回调传入的已核验支付结果 */
export interface WechatPaidInput {
  orderNo: string
  transactionId: string
  paidTotalFen: number
  paidAt: Date
}

export interface WechatRefundNotifyInput {
  orderNo: string
  refundNo: string
  refundStatus: string
}

export interface OrderItemResponse {
  productId: string; name: string; spec: string; priceFen: number; quantity: number; img: string; themeLight: string
}
export interface OrderResponse {
  orderNo: string; status: string; createdAt: string; items: OrderItemResponse[]
  address: { name: string; phone: string; line: string }; idName: string; idcard: string
  payTime: string | null; declareNo: string | null; logistics: null; cancelledReason?: string
}
export interface OrderPrecheck {
  items: OrderItemResponse[]; goodsFen: number; taxFen: number; payableFen: number
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name)

  constructor(
    @Inject(CART_REPOSITORY) private readonly cartRepository: CartRepository,
    private readonly profileService: ProfileService,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(WAREHOUSE_ADAPTER) private readonly warehouse: WarehouseAdapter,
    private readonly crypto: PersonalDataCryptoService,
    @Inject(PAYMENT_ADAPTER) private readonly paymentAdapter: PaymentAdapter,
    @Inject(CATALOG_REPOSITORY) private readonly products: SellableProductSource,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Optional() private readonly customs?: WechatCustomsService,
  ) {}

  async precheck(userId: string): Promise<OrderPrecheck> {
    const prepared = await this.prepare(userId)
    return { items: prepared.items, goodsFen: prepared.totalFen, taxFen: 0, payableFen: prepared.totalFen }
  }

  async create(userId: string, dto: CreateOrderDto): Promise<{ orderNo: string; payParams: Record<string, string> }> {
    const existing = await this.orderRepository.findByUserAndRequest(userId, dto.requestId)
    if (existing) return { orderNo: existing.orderNo, payParams: await this.createPayParams(userId, existing) }

    const prepared = await this.prepare(userId)
    const orderNo = `WB${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
    const order = this.orderRepository.createOrder({
      orderNo, userId, requestId: dto.requestId, status: 'pay', paymentStatus: 'pending', warehouseStatus: null,
      totalFen: prepared.totalFen, realnameName: prepared.realname.name, idcardEncrypted: prepared.realname.idcardEncrypted,
      idcardFingerprint: prepared.realname.idcardFingerprint, receiverName: prepared.address.name, receiverPhone: prepared.address.phone,
      receiverRegion: prepared.address.region, receiverDetail: prepared.address.detail, paidAt: null, cancelledAt: null,
      systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
    })
    await this.orderRepository.saveOrder(order)
    await this.orderRepository.saveItems(prepared.items.map((item) => this.orderRepository.createItem({ orderId: order.id, ...item })))
    for (const cartItem of prepared.cartItems) await this.cartRepository.remove(cartItem)
    await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: null, toStatus: 'pay', source: 'user', remark: '用户提交订单' })
    return { orderNo, payParams: await this.createPayParams(userId, order, prepared.items[0]?.name) }
  }

  async list(userId: string, status?: string): Promise<{ total: number; list: OrderResponse[] }> {
    const normalizedStatus = status === 'cancel' ? 'cancelled' : status
    const orders = await this.orderRepository.findByUser(userId, normalizedStatus)
    return { total: orders.length, list: await Promise.all(orders.map((order) => this.toResponse(order))) }
  }

  async get(userId: string, orderNo: string): Promise<OrderResponse> {
    return this.toResponse(await this.requireOrder(userId, orderNo))
  }

  async cancel(userId: string, orderNo: string): Promise<OrderResponse> {
    const order = await this.requireOrder(userId, orderNo)
    if (order.status !== 'pay' || order.paymentStatus !== 'pending') {
      throw new BusinessException(40002, '当前订单状态不支持取消，请联系客服处理')
    }
    const saved = await this.orderRepository.saveOrder({ ...order, status: 'cancelled', cancelledAt: new Date() })
    await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: 'cancelled', source: 'user', remark: '用户取消订单' })
    return this.toResponse(saved)
  }

  async getPayParams(userId: string, orderNo: string): Promise<Record<string, string>> {
    const order = await this.requireOrder(userId, orderNo)
    if (order.status !== 'pay') throw new BusinessException(40002, '当前订单无需支付')
    return this.createPayParams(userId, order)
  }

  /**
   * 微信支付回调（已验签解密后的可信数据）：唯一可信的支付成功来源。
   * 幂等：同一 transactionId 重复推送直接返回；金额与本地订单不符拒绝并告警。
   */
  async handleWechatPaid(input: WechatPaidInput): Promise<void> {
    const order = await this.orderRepository.findOneByOrderNo(input.orderNo)
    if (!order) throw new BusinessException(40404, '订单不存在', 404)
    if (order.paymentStatus === 'paid') return
    if (order.status !== 'pay' || order.paymentStatus !== 'pending') {
      throw new BusinessException(40002, '订单状态已变化，无法登记支付结果')
    }
    if (order.totalFen !== input.paidTotalFen) {
      this.logger.error(`支付回调金额与订单不符：订单 ${order.orderNo} 应付 ${order.totalFen}，实收 ${input.paidTotalFen}，需人工核对`)
      throw new BusinessException(40003, '支付金额与订单金额不一致')
    }

    await this.warehouse.pushOrder(order.orderNo)
    const saved = await this.orderRepository.saveOrder({
      ...order, status: 'ship', paymentStatus: 'paid', warehouseStatus: 'local-accepted',
      paidAt: input.paidAt, wechatTransactionId: input.transactionId,
    })
    await this.orderRepository.recordStatusEvent({
      orderId: order.id, fromStatus: 'pay', toStatus: 'ship', source: 'payment', remark: '微信支付回调确认成功',
    })
    await this.declareCustoms(saved, input.transactionId)
  }

  /** 退款结果回调：退款终态确认；本地已在发起退款时落库，这里只补记事件。 */
  async handleWechatRefundNotified(input: WechatRefundNotifyInput): Promise<void> {
    const order = await this.orderRepository.findOneByOrderNo(input.orderNo)
    if (!order) throw new BusinessException(40404, '订单不存在', 404)
    if (input.refundStatus !== 'SUCCESS') {
      this.logger.warn(`退款回调非成功态：${order.orderNo} 退款单 ${input.refundNo} 状态 ${input.refundStatus}`)
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status,
        source: 'payment', remark: `退款单 ${input.refundNo} 状态异常（${input.refundStatus}），需人工跟进`,
      })
      return
    }
    if (order.paymentStatus !== 'refunded') {
      const saved = await this.orderRepository.saveOrder({ ...order, paymentStatus: 'refunded', refundedAt: new Date() })
      await this.orderRepository.recordStatusEvent({
        orderId: saved.id, fromStatus: order.status, toStatus: saved.status,
        source: 'payment', remark: `退款回调确认成功（退款单 ${input.refundNo}）`,
      })
    }
  }

  /** 组装支付参数：本地 mock 忽略上下文；微信 JSAPI 需要 openid（缺失时适配器抛 40007 引导前端授权）。 */
  private async createPayParams(userId: string, order: OrderRecord, description?: string): Promise<Record<string, string>> {
    const user = await this.users.findById(userId)
    const ctx: PayContext = { openid: user?.wechatOpenId ?? null, totalFen: order.totalFen, description }
    return this.paymentAdapter.createPayParams(order.orderNo, ctx)
  }

  /** 支付成功后向海关申报支付单（自助清关）；失败只记录不阻塞主流程，丢单可重推。 */
  private async declareCustoms(order: OrderRecord, transactionId: string): Promise<void> {
    if (!this.customs?.isEnabled()) return
    try {
      const result = await this.customs.submitDeclaration({
        orderNo: order.orderNo,
        transactionId,
        realname: { name: order.realnameName, idcard: this.crypto.decrypt(order.idcardEncrypted) },
      })
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status,
        source: 'payment', remark: `支付单海关申报已提交（状态 ${result.state}，身份校验 ${result.certCheckResult}）`,
      })
      if (result.certCheckResult === 'DIFFERENT') {
        this.logger.warn(`订单 ${order.orderNo} 订购人与支付人身份不一致，需人工核对`)
      }
    } catch (error) {
      this.logger.error(`订单 ${order.orderNo} 海关申报提交失败，待重推`, error)
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: order.status, toStatus: order.status,
        source: 'payment', remark: '支付单海关申报提交失败，待重推',
      })
    }
  }

  async confirmMockPayment(userId: string, orderNo: string): Promise<OrderResponse> {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      throw new BusinessException(40404, '测试支付接口不可用', 404)
    }
    const order = await this.requireOrder(userId, orderNo)
    if (order.status !== 'pay') throw new BusinessException(40002, '当前订单不能确认支付')
    await this.warehouse.pushOrder(order.orderNo)
    const saved = await this.orderRepository.saveOrder({
      ...order, status: 'ship', paymentStatus: 'paid', warehouseStatus: 'local-accepted', paidAt: new Date(),
    })
    await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: 'pay', toStatus: 'ship', source: 'system', remark: '本地 mock 支付成功' })
    return this.toResponse(saved)
  }

  private async prepare(userId: string): Promise<{ cartItems: CartItemRecord[]; items: OrderItemResponse[]; totalFen: number; address: { name: string; phone: string; region: string; detail: string }; realname: { name: string; idcardEncrypted: string; idcardFingerprint: string } }> {
    const cartItems = (await this.cartRepository.findByUser(userId)).filter((item) => item.checked)
    if (!cartItems.length) throw new BusinessException(40003, '请先选择要结算的商品')
    const products: { cartItem: CartItemRecord; product: CatalogProductRecord }[] = []
    for (const cartItem of cartItems) products.push({ cartItem, product: await this.requireProduct(cartItem.productId) })
    await this.warehouse.ensureInStock(products.map(({ product }) => product.id))
    const addresses = await this.profileService.getAddresses(userId)
    const address = addresses.find((item) => item.isDefault)
    if (!address) throw new BusinessException(40002, '请先填写默认收货地址')
    const realname = await this.profileService.getRealnameForOrder(userId)
    if (address.name !== realname.name) throw new BusinessException(40002, '收货人与实名信息必须一致')
    const items = products.map(({ cartItem, product }) => this.toOrderItem(cartItem, product))
    const totalFen = items.reduce((sum, item) => sum + item.priceFen * item.quantity, 0)
    if (totalFen > SINGLE_ORDER_LIMIT_FEN) throw new BusinessException(40001, '单笔订单不能超过 5000 元')
    const from = new Date(new Date().getFullYear(), 0, 1)
    const to = new Date(new Date().getFullYear() + 1, 0, 1)
    const yearlyDeclaredFen = await this.orderRepository.sumDeclaredFen(realname.idcardFingerprint, from, to)
    if (yearlyDeclaredFen + totalFen > YEARLY_LIMIT_FEN) throw new BusinessException(40001, '个人年度交易不能超过 26000 元')
    return { cartItems, items, totalFen, address, realname }
  }

  private async requireOrder(userId: string, orderNo: string): Promise<OrderRecord> {
    const order = await this.orderRepository.findByOrderNo(userId, orderNo)
    if (!order) throw new BusinessException(40404, '订单不存在', 404)
    return order
  }

  private async requireProduct(productId: string): Promise<CatalogProductRecord> {
    const product = await this.products.findById(productId)
    if (!product) throw new BusinessException(40003, '商品库存不足')
    if (!product.isActive) throw new BusinessException(40006, '商品已下架，暂不可购买')
    return product
  }

  private toOrderItem(cartItem: CartItemRecord, product: CatalogProductRecord): OrderItemResponse {
    return { productId: product.id, name: product.name, spec: product.flavor ? `${product.spec} · ${product.flavor}` : product.spec, priceFen: product.priceFen, quantity: cartItem.quantity, img: product.cardImg, themeLight: product.themeLight }
  }

  private async toResponse(order: OrderRecord): Promise<OrderResponse> {
    const items = await this.orderRepository.findItems(order.id)
    const idcard = this.crypto.decrypt(order.idcardEncrypted)
    return {
      orderNo: order.orderNo, status: order.status, createdAt: order.createdAt.toISOString(),
      items: items.map((item) => ({ productId: item.productId, name: item.name, spec: item.spec, priceFen: item.priceFen, quantity: item.quantity, img: item.img, themeLight: item.themeLight })),
      address: { name: order.receiverName, phone: maskPhone(order.receiverPhone), line: `${order.receiverRegion} ${order.receiverDetail}` },
      idName: order.realnameName, idcard: `${idcard.slice(0, 3)}***********${idcard.slice(-4)}`,
      payTime: order.paidAt?.toISOString() ?? null, declareNo: null, logistics: null,
      ...(order.status === 'cancelled' ? { cancelledReason: '用户取消订单' } : {}),
    }
  }
}

function maskPhone(phone: string): string { return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') }
