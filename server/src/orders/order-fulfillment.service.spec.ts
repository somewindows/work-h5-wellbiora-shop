import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import type { WechatCustomsService } from '../payments/wechat-customs.service'

import { OrderFulfillmentService } from './order-fulfillment.service'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'
import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'

describe('OrderFulfillmentService（复审 R10：推仓/报关解耦）', () => {
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let orders: InMemoryOrderRepository
  let warehouse: LocalWarehouseAdapter
  let seq = 0

  const createOrder = async (overrides: Partial<OrderRecord> = {}): Promise<OrderRecord> => {
    seq += 1
    const order = orders.createOrder({
      orderNo: `WB20260917FUL${String(seq).padStart(3, '0')}`, userId: 'user-1', requestId: `req-ful-${seq}`,
      status: 'ship', paymentStatus: 'paid', warehouseStatus: null, totalFen: 32900,
      realnameName: '张三', idcardEncrypted: crypto.encrypt('110101199001011234'), idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: new Date(), cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null,
      wechatTransactionId: '4200000123456789012345678901', customsDeclareStatus: null, customsDeclaredAt: null,
      ...overrides,
    })
    return orders.saveOrder(order)
  }

  const buildCustoms = (overrides: Partial<Record<'submitDeclaration' | 'queryDeclaration', jest.Mock>> = {}, enabled = true): WechatCustomsService =>
    ({
      isEnabled: () => enabled,
      submitDeclaration: jest.fn().mockResolvedValue({ state: 'SUBMITTED', certCheckResult: 'SAME' }),
      queryDeclaration: jest.fn().mockResolvedValue({ state: 'SUCCESS', certCheckResult: 'SAME', detail: {} }),
      ...overrides,
    }) as unknown as WechatCustomsService

  beforeEach(async () => {
    orders = new InMemoryOrderRepository()
    const catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    warehouse = new LocalWarehouseAdapter(catalog)
  })

  describe('pushWarehouseIfNeeded', () => {
    it('已支付待发货未推仓：推仓成功并条件回写 + 事件', async () => {
      const order = await createOrder()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto)

      await expect(svc.pushWarehouseIfNeeded(order.orderNo)).resolves.toBe(true)

      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ warehouseStatus: 'local-accepted' })
      const events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark === '订单已推送保税仓')).toBe(true)
    })

    it('守卫：非待发货/未支付/已推仓/订单不存在时不动仓储侧', async () => {
      const pushed = await createOrder({ warehouseStatus: 'local-accepted' })
      const pending = await createOrder({ status: 'pay', paymentStatus: 'pending', paidAt: null, wechatTransactionId: null })
      const svc = new OrderFulfillmentService(orders, warehouse, crypto)
      const spy = jest.spyOn(warehouse, 'pushOrder')

      await expect(svc.pushWarehouseIfNeeded(pushed.orderNo)).resolves.toBe(true)
      await expect(svc.pushWarehouseIfNeeded(pending.orderNo)).resolves.toBe(true)
      await expect(svc.pushWarehouseIfNeeded('WB-NONE')).resolves.toBe(true)
      expect(spy).not.toHaveBeenCalled()
    })

    it('推仓失败：不向调用方抛出，留空待重试，失败事件只记一次（不随重试刷事件流）', async () => {
      const order = await createOrder()
      jest.spyOn(warehouse, 'pushOrder').mockRejectedValue(new Error('仓储接口超时'))
      const svc = new OrderFulfillmentService(orders, warehouse, crypto)

      await expect(svc.pushWarehouseIfNeeded(order.orderNo)).resolves.toBe(false)
      await expect(svc.pushWarehouseIfNeeded(order.orderNo)).resolves.toBe(false) // 模拟 job 下一轮重试仍失败

      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ warehouseStatus: null })
      const events = await orders.findStatusEvents(order.id)
      expect(events.filter((event) => event.remark?.startsWith('推仓失败'))).toHaveLength(1)
    })

    it('推仓成功但条件回写落败（并发取消已赢）：撤销孤儿推仓并记事件', async () => {
      const order = await createOrder()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto)
      // 模拟并发：push 完成后、markWarehousePushed 前订单被取消
      jest.spyOn(orders, 'markWarehousePushed').mockImplementationOnce(async () => {
        await orders.saveOrder({ ...(await orders.findOneByOrderNo(order.orderNo))!, status: 'cancelled', cancelledAt: new Date() })
        return false
      })

      await expect(svc.pushWarehouseIfNeeded(order.orderNo)).resolves.toBe(true)

      await expect(warehouse.getOrderStatus(order.orderNo)).resolves.toMatchObject({ status: '50' }) // 君梦码 50 = 订单取消
      const record = await orders.findOneByOrderNo(order.orderNo)
      expect(record).toMatchObject({ status: 'cancelled', warehouseStatus: null })
      const events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark?.includes('已撤销本次推仓'))).toBe(true)
    })

    it('推仓成功但条件回写落败（并发执行者已先标记）：不误撤对方合法推仓（评审 B1）', async () => {
      const order = await createOrder()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto)
      // 模拟并发：另一方（job/重复回调/人工重推）先完成标记
      jest.spyOn(orders, 'markWarehousePushed').mockImplementationOnce(async () => {
        await orders.saveOrder({ ...(await orders.findOneByOrderNo(order.orderNo))!, warehouseStatus: 'local-accepted' })
        return false
      })
      const cancelSpy = jest.spyOn(warehouse, 'cancelOrder')

      await expect(svc.pushWarehouseIfNeeded(order.orderNo)).resolves.toBe(true)

      expect(cancelSpy).not.toHaveBeenCalled()
      // 仓储侧仍是并发方的合法推仓（local-accepted 未被置 50）
      await expect(warehouse.getOrderStatus(order.orderNo)).resolves.toMatchObject({ status: 'local-accepted' })
      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ status: 'ship', warehouseStatus: 'local-accepted' })
    })
  })

  describe('declareCustomsIfNeeded', () => {
    it('已支付未申报：提交申报并落库回执状态 + 事件', async () => {
      const order = await createOrder()
      const customs = buildCustoms()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await expect(svc.declareCustomsIfNeeded(order.orderNo)).resolves.toBe(true)

      const record = await orders.findOneByOrderNo(order.orderNo)
      expect(record).toMatchObject({ customsDeclareStatus: 'SUBMITTED' })
      expect(record!.customsDeclaredAt).not.toBeNull()
      expect(customs.submitDeclaration).toHaveBeenCalledWith(expect.objectContaining({
        orderNo: order.orderNo,
        transactionId: '4200000123456789012345678901',
        realname: { name: '张三', idcard: '110101199001011234' },
      }))
      const events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark?.includes('海关申报已提交'))).toBe(true)
    })

    it('守卫：无交易号/已申报/报关能力未启用时不申报', async () => {
      const noTx = await createOrder({ wechatTransactionId: null })
      const declared = await createOrder({ customsDeclareStatus: 'SUCCESS', customsDeclaredAt: new Date() })
      const normal = await createOrder()
      const customs = buildCustoms()
      const disabled = buildCustoms({}, false)
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)
      const svcDisabled = new OrderFulfillmentService(orders, warehouse, crypto, disabled)

      await expect(svc.declareCustomsIfNeeded(noTx.orderNo)).resolves.toBe(true)
      await expect(svc.declareCustomsIfNeeded(declared.orderNo)).resolves.toBe(true)
      await expect(svcDisabled.declareCustomsIfNeeded(normal.orderNo)).resolves.toBe(true)
      expect(customs.submitDeclaration).not.toHaveBeenCalled()
    })

    it('守卫：已取消+已支付（迟到扣款登记）的订单不自动报关（评审 B2）', async () => {
      const latePaid = await createOrder({ status: 'cancelled', cancelledAt: new Date(), systemRemark: '订单取消后收到微信扣款，需人工退款处理' })
      const customs = buildCustoms()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await expect(svc.declareCustomsIfNeeded(latePaid.orderNo)).resolves.toBe(true)
      expect(customs.submitDeclaration).not.toHaveBeenCalled()
      // 收敛 job 的扫描同样不覆盖它
      const pending = await orders.findPendingCustomsDeclare(new Date(Date.now() - 3600_000), 50)
      expect(pending.map((order) => order.orderNo)).not.toContain(latePaid.orderNo)
    })

    it('申报失败：不抛出，状态留 NULL 待重试，失败事件只记一次', async () => {
      const order = await createOrder()
      const customs = buildCustoms({ submitDeclaration: jest.fn().mockRejectedValue(new Error('SIGNERROR 签名错误')) })
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await expect(svc.declareCustomsIfNeeded(order.orderNo)).resolves.toBe(false)
      await expect(svc.declareCustomsIfNeeded(order.orderNo)).resolves.toBe(false)

      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ customsDeclareStatus: null })
      const events = await orders.findStatusEvents(order.id)
      expect(events.filter((event) => event.remark?.startsWith('支付单海关申报提交失败'))).toHaveLength(1)
    })

    it('回执为终态（EXCEPT）也落库，后续不再自动重推（守卫拦截）', async () => {
      const order = await createOrder()
      const customs = buildCustoms({ submitDeclaration: jest.fn().mockResolvedValue({ state: 'EXCEPT', certCheckResult: 'SAME' }) })
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await svc.declareCustomsIfNeeded(order.orderNo)
      await svc.declareCustomsIfNeeded(order.orderNo) // 终态守卫：不再调微信

      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ customsDeclareStatus: 'EXCEPT' })
      expect(customs.submitDeclaration).toHaveBeenCalledTimes(1)
    })
  })

  describe('convergeDeclaration', () => {
    it('在途状态查询后变化：落库新状态并记事件；不变则不写', async () => {
      const order = await createOrder({ customsDeclareStatus: 'SUBMITTED', customsDeclaredAt: new Date() })
      const customs = buildCustoms()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await expect(svc.convergeDeclaration(order.orderNo)).resolves.toBe(true)
      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ customsDeclareStatus: 'SUCCESS' })
      let events = await orders.findStatusEvents(order.id)
      expect(events.some((event) => event.remark?.includes('SUBMITTED → SUCCESS'))).toBe(true)

      // 再跑一轮：状态已 SUCCESS（终态），updateCustomsDeclaration 条件守卫拒绝覆盖，不再记事件
      await svc.convergeDeclaration(order.orderNo)
      events = await orders.findStatusEvents(order.id)
      expect(events.filter((event) => event.remark?.includes('申报状态收敛'))).toHaveLength(1)
    })

    it('查询失败：不抛出、不落库，下轮重试', async () => {
      const order = await createOrder({ customsDeclareStatus: 'PROCESSING', customsDeclaredAt: new Date() })
      const customs = buildCustoms({ queryDeclaration: jest.fn().mockRejectedValue(new Error('网络超时')) })
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await expect(svc.convergeDeclaration(order.orderNo)).resolves.toBe(false)
      expect(await orders.findOneByOrderNo(order.orderNo)).toMatchObject({ customsDeclareStatus: 'PROCESSING' })
    })

    it('守卫：未申报（NULL）不查询', async () => {
      const order = await createOrder()
      const customs = buildCustoms()
      const svc = new OrderFulfillmentService(orders, warehouse, crypto, customs)

      await expect(svc.convergeDeclaration(order.orderNo)).resolves.toBe(true)
      expect(customs.queryDeclaration).not.toHaveBeenCalled()
    })
  })
})
