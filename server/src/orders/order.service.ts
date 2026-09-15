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
import { RefundService } from './refund.service'
import { WAREHOUSE_ADAPTER, type WarehouseAdapter } from './warehouse.adapter'

const SINGLE_ORDER_LIMIT_FEN = 500000
const YEARLY_LIMIT_FEN = 2600000

/** 微信支付回调传入的已核验支付结果 */
export interface WechatPaidInput {
  orderNo: string
  transactionId: string
  /** 订单总额（微信 amount.total），与本地订单金额比对 */
  paidTotalFen: number
  /** 用户实付（微信 amount.payer_total），优惠场景小于总额；仅记录日志供对账 */
  payerTotalFen?: number
  paidAt: Date
}

export interface WechatRefundNotifyInput {
  orderNo: string
  refundNo: string
  refundStatus: string
  /** 微信退款单号（refund_id） */
  refundId?: string
  /** 退款金额（分），商户平台发起的退款补登时用 */
  amountFen?: number
  succeededAt?: Date
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
    private readonly refundService: RefundService,
    @Optional() private readonly customs?: WechatCustomsService,
  ) {}

  async precheck(userId: string): Promise<OrderPrecheck> {
    const prepared = await this.prepare(userId)
    return { items: prepared.items, goodsFen: prepared.totalFen, taxFen: 0, payableFen: prepared.totalFen }
  }

  async create(userId: string, dto: CreateOrderDto): Promise<{ orderNo: string }> {
    const existing = await this.orderRepository.findByUserAndRequest(userId, dto.requestId)
    if (existing) return { orderNo: existing.orderNo }

    // 复审 R06：下单即预占年度额度。「额度检查 + 订单插入」必须放进同一证件指纹的命名锁内串行，
    // 否则并发创建各自按旧快照放行，可预建多笔待付款单绕过 26000 元年限额。
    // 锁按实名指纹而非用户：不同账号同证件共享额度。指纹先单独取一次进锁
    // （prepare 锁内会再查一次实名，多一次查询可接受，换来锁内逻辑无需改签名）
    const { idcardFingerprint } = await this.profileService.getRealnameForOrder(userId)
    return this.orderRepository.withYearlyQuotaLock(idcardFingerprint, async () => {
      // 锁内重查幂等键：排队期间同 requestId 的并发请求可能已先行提交（并清空购物车）
      const raced = await this.orderRepository.findByUserAndRequest(userId, dto.requestId)
      if (raced) return { orderNo: raced.orderNo }
      const prepared = await this.prepare(userId)
      const orderNo = `WB${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
      const order = this.orderRepository.createOrder({
        orderNo, userId, requestId: dto.requestId, status: 'pay', paymentStatus: 'pending', warehouseStatus: null,
        totalFen: prepared.totalFen, realnameName: prepared.realname.name, idcardEncrypted: prepared.realname.idcardEncrypted,
        idcardFingerprint: prepared.realname.idcardFingerprint, receiverName: prepared.address.name, receiverPhone: prepared.address.phone,
        receiverRegion: prepared.address.region, receiverDetail: prepared.address.detail, paidAt: null, cancelledAt: null,
        systemRemark: null, refundFen: null, refundedAt: null, wechatTransactionId: null,
      })
      // 复审 R03：主单 + 明细 + 购物车删除 + 状态事件同一事务提交，任一步失败整体回滚，
      // 不再出现空明细订单/部分清空购物车；订单存在即完整，幂等重进无需再校验明细
      try {
        await this.orderRepository.runInTransaction(async (manager) => {
          await this.orderRepository.saveOrder(order, manager)
          await this.orderRepository.saveItems(prepared.items.map((item) => this.orderRepository.createItem({ orderId: order.id, ...item })), manager)
          for (const cartItem of prepared.cartItems) await this.cartRepository.remove(cartItem, manager)
          await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: null, toStatus: 'pay', source: 'user', remark: '用户提交订单' }, manager)
        })
      } catch (error) {
        // 并发同幂等键撞 (userId, requestId) 唯一约束：本次事务已整体回滚，读取先提交的同一结果
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
          const winner = await this.orderRepository.findByUserAndRequest(userId, dto.requestId)
          if (winner) return { orderNo: winner.orderNo }
        }
        throw error
      }
      // 复审 R02：创建订单与获取支付参数分离。订单落库成功即返回订单号；
      // 支付参数由订单详情页经 GET pay-params 单独获取，缺 openid 走授权回跳续付，
      // 不再让「未授权」导致订单已建却返回错误、用户找不到待付款订单
      return { orderNo }
    })
  }

  async list(userId: string, status?: string): Promise<{ total: number; list: OrderResponse[] }> {
    const normalizedStatus = status ? (SERVER_STATUS_BY_H5[status] ?? status) : status
    const orders = await this.orderRepository.findByUser(userId, normalizedStatus)
    return { total: orders.length, list: await Promise.all(orders.map((order) => this.toResponse(order))) }
  }

  async get(userId: string, orderNo: string): Promise<OrderResponse> {
    return this.toResponse(await this.requireOrder(userId, orderNo))
  }

  async cancel(userId: string, orderNo: string): Promise<OrderResponse> {
    const order = await this.requireOrder(userId, orderNo)
    // 前置检查保留用于快速失败提示；真正的并发安全由下方条件更新保证
    if (order.status !== 'pay' || order.paymentStatus !== 'pending') {
      throw new BusinessException(40002, '当前订单状态不支持取消，请联系客服处理')
    }
    // 复审 R09：条件更新替代「读旧对象整体覆盖写」——与支付回调并发落败时受影响 0 行，让位不覆盖支付结果
    const cancelledAt = new Date()
    const cancelled = await this.orderRepository.cancelIfPendingPayment(order.id, cancelledAt)
    if (!cancelled) {
      const fresh = await this.requireOrder(userId, orderNo)
      this.logger.warn(`取消订单 ${orderNo} 竞态落败：当前状态 ${fresh.status}/${fresh.paymentStatus}，以支付结果为准`)
      throw new BusinessException(40002, '当前订单状态不支持取消，请联系客服处理')
    }
    await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: 'cancelled', source: 'user', remark: '用户取消订单' })
    // 复审 R09：本地取消后同步关闭微信交易，防止用户取消后仍能完成支付；
    // 关单失败不阻断取消——若微信侧实际已扣款，迟到回调会登记支付事实并转人工退款
    if (this.paymentAdapter.closePayment) {
      try {
        await this.paymentAdapter.closePayment(orderNo)
      } catch (error) {
        this.logger.warn(`取消订单后关闭微信交易失败（订单 ${orderNo}）：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return this.toResponse({ ...order, status: 'cancelled', cancelledAt })
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
    // 复审 R06：支付回调不复查年度额度——下单时已按「创建年」预占（含本单），支付只是确认；
    // 跨年支付（12 月创建、1 月支付）也不切换归属年，避免年底集中支付时额度口径漂移
    const order = await this.orderRepository.findOneByOrderNo(input.orderNo)
    if (!order) throw new BusinessException(40404, '订单不存在', 404)
    if (order.paymentStatus === 'paid') return
    if (order.paymentStatus !== 'pending') {
      throw new BusinessException(40002, '订单状态已变化，无法登记支付结果')
    }
    if (order.totalFen !== input.paidTotalFen) {
      this.logger.error(`支付回调金额与订单不符：订单 ${order.orderNo} 应付 ${order.totalFen}，实收 ${input.paidTotalFen}，需人工核对`)
      throw new BusinessException(40003, '支付金额与订单金额不一致')
    }
    if (input.payerTotalFen != null && input.payerTotalFen !== input.paidTotalFen) {
      this.logger.warn(`订单 ${order.orderNo} 用户实付 ${input.payerTotalFen} 与订单总额 ${input.paidTotalFen} 不一致（优惠/代金券等），财务对账留意`)
    }

    // 复审 R09：取消后收到的真实扣款必须登记支付事实——否则钱在微信侧、本地无痕，
    // 连后台人工退款入口都被「订单未支付」校验挡死。不推仓不报关，转人工退款。
    if (order.status === 'cancelled') {
      const registered = await this.registerLatePayment(order, input)
      if (!registered) {
        // 竞态落败：重读——并发重复回调已登记则幂等返回，否则状态异常报错触发微信重推
        const fresh = await this.orderRepository.findOneByOrderNo(input.orderNo)
        if (fresh?.paymentStatus === 'paid') return
        throw new BusinessException(40002, '订单状态已变化，无法登记支付结果')
      }
      return
    }
    if (order.status !== 'pay') {
      throw new BusinessException(40002, '订单状态已变化，无法登记支付结果')
    }

    // 顺序不变：先推仓再写库，推仓失败抛出让微信按节奏重推回调
    await this.warehouse.pushOrder(order.orderNo)
    // 复审 R09：条件更新替代整体覆盖写——与取消并发落败时受影响 0 行，不覆盖取消结果
    const marked = await this.orderRepository.markPaidIfPending(order.id, {
      paidAt: input.paidAt, wechatTransactionId: input.transactionId, warehouseStatus: 'local-accepted',
    })
    if (marked) {
      await this.orderRepository.recordStatusEvent({
        orderId: order.id, fromStatus: 'pay', toStatus: 'ship', source: 'payment', remark: '微信支付回调确认成功',
      })
      await this.declareCustoms(
        { ...order, status: 'ship', paymentStatus: 'paid', warehouseStatus: 'local-accepted', paidAt: input.paidAt, wechatTransactionId: input.transactionId },
        input.transactionId,
      )
      return
    }
    // 复审 R09：条件更新落败——重读订单按最新状态分支处理
    const fresh = await this.orderRepository.findOneByOrderNo(input.orderNo)
    if (!fresh) throw new BusinessException(40404, '订单不存在', 404)
    if (fresh.paymentStatus === 'paid') return // 并发重复回调已获胜，幂等
    if (fresh.status === 'cancelled' && fresh.paymentStatus === 'pending') {
      // 取消在推仓之后获胜，产生了孤儿推仓：best-effort 撤销（失败仅告警），再补登支付事实转人工退款
      try {
        await this.warehouse.cancelOrder(order.orderNo)
      } catch (error) {
        this.logger.warn(`订单 ${order.orderNo} 取消后撤销孤儿推仓失败，待人工核对仓储侧：${error instanceof Error ? error.message : String(error)}`)
      }
      const registered = await this.registerLatePayment(order, input)
      if (registered) return
      // 登记也落败：再重读，并发回调已登记则幂等
      const latest = await this.orderRepository.findOneByOrderNo(input.orderNo)
      if (latest?.paymentStatus === 'paid') return
    }
    throw new BusinessException(40002, '订单状态已变化，无法登记支付结果')
  }

  /** 复审 R09：取消后收到的迟到扣款补登支付事实（条件更新）+ 事件 + 告警；返回是否登记成功。 */
  private async registerLatePayment(order: OrderRecord, input: WechatPaidInput): Promise<boolean> {
    const registered = await this.orderRepository.registerLatePaymentIfCancelled(order.id, {
      paidAt: input.paidAt, wechatTransactionId: input.transactionId,
      systemRemark: '订单取消后收到微信扣款，需人工退款处理',
    })
    if (!registered) return false
    await this.orderRepository.recordStatusEvent({
      orderId: order.id, fromStatus: 'cancelled', toStatus: 'cancelled', source: 'payment',
      remark: `订单已取消但收到微信支付成功（交易单 ${input.transactionId}），已登记支付事实，待人工退款`,
    })
    this.logger.error(`订单 ${order.orderNo} 取消后收到真实扣款（交易单 ${input.transactionId}），需人工退款`)
    return true
  }

  /** 退款结果回调：退款终态确认；本地已在发起退款时落库，这里只补记事件。 */
  /**
   * 微信退款回调：委托退款状态机收敛（复审 R04/R05：受理≠到账；本地无单按商户平台发起补登；重复通知幂等）。
   */
  async handleWechatRefundNotified(input: WechatRefundNotifyInput): Promise<void> {
    await this.refundService.applyRefundStatus(input)
  }

  /** 组装支付参数：本地 mock 忽略上下文；微信 JSAPI 需要 openid（缺失时适配器抛 40007 引导前端授权）。 */
  private async createPayParams(userId: string, order: OrderRecord): Promise<Record<string, string>> {
    const user = await this.users.findById(userId)
    // 微信要求同一 out_trade_no 重复下单时参数必须一致：description 一律从落库订单明细取首个商品名，
    // 禁止各调用路径各自传参——否则续付/重试（pay-params、同 requestId 重进）再下单
    // 会被微信以「商户订单号重复，但下单参数不一致」拒绝
    const description = (await this.orderRepository.findItems(order.id))[0]?.name
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
    // 前置检查保留用于快速失败提示；真正的并发安全由下方条件更新保证
    if (order.status !== 'pay') throw new BusinessException(40002, '当前订单不能确认支付')
    await this.warehouse.pushOrder(order.orderNo)
    // 复审 R09：与支付回调同一条件更新，避免与取消/回调并发时旧对象覆盖对方结果
    const paidAt = new Date()
    const marked = await this.orderRepository.markPaidIfPending(order.id, { paidAt, wechatTransactionId: null, warehouseStatus: 'local-accepted' })
    if (!marked) throw new BusinessException(40002, '当前订单不能确认支付')
    await this.orderRepository.recordStatusEvent({ orderId: order.id, fromStatus: 'pay', toStatus: 'ship', source: 'system', remark: '本地 mock 支付成功' })
    return this.toResponse({ ...order, status: 'ship', paymentStatus: 'paid', warehouseStatus: 'local-accepted', paidAt })
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
    // 复审 R06：额度口径改为「下单即预占」——待支付单也计入占用（取消/超时/全额退款随查询语义自动释放）。
    // 预检仅作 UX 提示；权威校验在 create 的 withYearlyQuotaLock 锁内（同一查询、同一口径）
    const yearlyOccupiedFen = await this.orderRepository.sumOccupiedYearlyFen(realname.idcardFingerprint, from, to)
    if (yearlyOccupiedFen + totalFen > YEARLY_LIMIT_FEN) throw new BusinessException(40001, '个人年度交易不能超过 26000 元')
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
      orderNo: order.orderNo, status: H5_STATUS_BY_SERVER[order.status] ?? order.status, createdAt: order.createdAt.toISOString(),
      items: items.map((item) => ({ productId: item.productId, name: item.name, spec: item.spec, priceFen: item.priceFen, quantity: item.quantity, img: item.img, themeLight: item.themeLight })),
      address: { name: order.receiverName, phone: maskPhone(order.receiverPhone), line: `${order.receiverRegion} ${order.receiverDetail}` },
      idName: order.realnameName, idcard: `${idcard.slice(0, 3)}***********${idcard.slice(-4)}`,
      payTime: order.paidAt?.toISOString() ?? null, declareNo: null, logistics: null,
      ...(order.status === 'cancelled' ? { cancelledReason: '用户取消订单' } : {}),
    }
  }
}

function maskPhone(phone: string): string { return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') }

// 复审 R14：后台状态机（admin 手动同步）写入 receive/complete，H5 契约使用 recv/done，在 API 边界双向映射
const H5_STATUS_BY_SERVER: Record<string, string> = { receive: 'recv', complete: 'done' }
const SERVER_STATUS_BY_H5: Record<string, string> = { recv: 'receive', done: 'complete', cancel: 'cancelled' }
