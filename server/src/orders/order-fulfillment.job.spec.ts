import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'
import { TaskSchedulerService } from '../common/task-scheduler.service'
import type { WechatCustomsService } from '../payments/wechat-customs.service'

import { OrderFulfillmentJob } from './order-fulfillment.job'
import { OrderFulfillmentService } from './order-fulfillment.service'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { InMemoryOrderRepository, type OrderRecord } from './order.repository'
import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import { PRODUCT_DETAILS } from '../catalog/catalog.seed'

describe('OrderFulfillmentJob（复审 R10：履约扫库收敛）', () => {
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 5).toString('base64'))
  let orders: InMemoryOrderRepository
  let warehouse: LocalWarehouseAdapter
  let seq = 0

  const createOrder = async (overrides: Partial<OrderRecord> = {}): Promise<OrderRecord> => {
    seq += 1
    const order = orders.createOrder({
      orderNo: `WB20260917JOB${String(seq).padStart(3, '0')}`, userId: 'user-1', requestId: `req-job-${seq}`,
      status: 'ship', paymentStatus: 'paid', warehouseStatus: null, totalFen: 32900,
      realnameName: '张三', idcardEncrypted: crypto.encrypt('110101199001011234'), idcardFingerprint: 'fp',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: 'r', receiverDetail: 'd',
      paidAt: new Date(), cancelledAt: null, systemRemark: null, refundFen: null, refundedAt: null,
      wechatTransactionId: '4200000123456789012345678901', customsDeclareStatus: null, customsDeclaredAt: null, payerTotalFen: null, payCurrency: null,
      ...overrides,
    })
    return orders.saveOrder(order)
  }

  const buildCustoms = (): WechatCustomsService =>
    ({
      isEnabled: () => true,
      submitDeclaration: jest.fn().mockResolvedValue({ state: 'SUBMITTED', certCheckResult: 'SAME' }),
      queryDeclaration: jest.fn().mockResolvedValue({ state: 'SUCCESS', certCheckResult: 'SAME', detail: {} }),
    }) as unknown as WechatCustomsService

  beforeEach(async () => {
    orders = new InMemoryOrderRepository()
    const catalog = new InMemoryCatalogRepository()
    await catalog.seed(Object.values(PRODUCT_DETAILS))
    warehouse = new LocalWarehouseAdapter(catalog)
  })

  const buildJob = (customs?: WechatCustomsService): OrderFulfillmentJob =>
    new OrderFulfillmentJob(new TaskSchedulerService(), orders, new OrderFulfillmentService(orders, warehouse, crypto, customs))

  it('一轮收敛：待推仓 + 待申报 + 在途申报查询各归各（当轮新申报的在途单同轮顺带收敛）', async () => {
    const pushOnly = await createOrder({ customsDeclareStatus: 'SUCCESS', customsDeclaredAt: new Date() }) // 只欠推仓
    const declareOnly = await createOrder({ warehouseStatus: 'local-accepted' }) // 只欠申报
    const converging = await createOrder({ warehouseStatus: 'local-accepted', customsDeclareStatus: 'SUBMITTED', customsDeclaredAt: new Date() })
    const done = await createOrder({ warehouseStatus: 'local-accepted', customsDeclareStatus: 'SUCCESS', customsDeclaredAt: new Date() })

    const result = await buildJob(buildCustoms()).runOnce()

    // declareOnly 当轮申报为 SUBMITTED 后进入在途集合，同轮被查询收敛为 SUCCESS
    expect(result).toEqual({ pushed: 1, declared: 1, converged: 2 })
    expect(await orders.findOneByOrderNo(pushOnly.orderNo)).toMatchObject({ warehouseStatus: 'local-accepted' })
    expect(await orders.findOneByOrderNo(declareOnly.orderNo)).toMatchObject({ customsDeclareStatus: 'SUCCESS' })
    expect(await orders.findOneByOrderNo(converging.orderNo)).toMatchObject({ customsDeclareStatus: 'SUCCESS' })
    expect(await orders.findOneByOrderNo(done.orderNo)).toMatchObject({ warehouseStatus: 'local-accepted', customsDeclareStatus: 'SUCCESS' })
  })

  it('超过 24h 重试窗口的订单不自动处理（转人工重推）', async () => {
    const stale = await createOrder({ paidAt: new Date(Date.now() - 25 * 3600_000) })
    const spy = jest.spyOn(warehouse, 'pushOrder')

    const result = await buildJob(buildCustoms()).runOnce()

    expect(result).toEqual({ pushed: 0, declared: 0, converged: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(await orders.findOneByOrderNo(stale.orderNo)).toMatchObject({ warehouseStatus: null })
  })

  it('单笔处理异常不拖垮整轮，其余订单照常收敛', async () => {
    const failing = await createOrder({ customsDeclareStatus: 'SUCCESS', customsDeclaredAt: new Date() })
    const normal = await createOrder({ customsDeclareStatus: 'SUCCESS', customsDeclaredAt: new Date() })
    const spy = jest.spyOn(warehouse, 'pushOrder').mockImplementation(async (orderNo: string) => {
      if (orderNo === failing.orderNo) throw new Error('仓储侧 500')
      return Promise.resolve()
    })

    const result = await buildJob(buildCustoms()).runOnce()

    expect(result.pushed).toBe(1)
    expect(await orders.findOneByOrderNo(normal.orderNo)).toMatchObject({ warehouseStatus: 'local-accepted' })
    expect(await orders.findOneByOrderNo(failing.orderNo)).toMatchObject({ warehouseStatus: null })
    spy.mockRestore()
  })

  it('报关能力未启用时申报扫描空转（不报错不计数）', async () => {
    await createOrder({ warehouseStatus: 'local-accepted' })

    const result = await buildJob(undefined).runOnce()

    expect(result.declared).toBe(0)
  })
})
