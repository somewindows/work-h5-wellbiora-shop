import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { MemorySmsProvider, SMS_PROVIDER } from '../src/auth/sms-provider'
import { LocalWarehouseAdapter } from '../src/orders/local-warehouse.adapter'
import { WAREHOUSE_ADAPTER } from '../src/orders/warehouse.adapter'

describe('后台订单管理（e2e）', () => {
  let app: INestApplication
  let adminToken: string
  let userToken: string
  let warehouse: LocalWarehouseAdapter
  let seq = 0

  beforeAll(async () => {
    process.env.ADMIN_INITIAL_USERNAME = 'operator'
    process.env.ADMIN_INITIAL_PASSWORD = 'AdminPass!2026'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
    warehouse = app.get<LocalWarehouseAdapter>(WAREHOUSE_ADAPTER)

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'operator', password: 'AdminPass!2026' })
      .expect(200)
    adminToken = adminLogin.body.data.token

    const smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)
    await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: '13400000000' }).expect(200)
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '13400000000', code: smsProvider.lastCode })
      .expect(200)
    userToken = userLogin.body.data.token

    const auth = { Authorization: `Bearer ${userToken}` }
    await request(app.getHttpServer()).post('/api/v1/addresses').set(auth)
      .send({ name: '孙八', phone: '13400000000', region: '浙江省 金华市 义乌市', detail: '北苑街道 8 号' }).expect(201)
    await request(app.getHttpServer()).post('/api/v1/realname').set(auth)
      .send({ name: '孙八', idcard: '110101199001011234' }).expect(201)
  })

  afterAll(async () => {
    await app.close()
  })

  const admin = () => ({ Authorization: `Bearer ${adminToken}` })
  const user = () => ({ Authorization: `Bearer ${userToken}` })

  /** 用户侧造一单（待支付）并返回订单号 */
  const createOrder = async (): Promise<string> => {
    seq += 1
    await request(app.getHttpServer()).post('/api/v1/cart/items').set(user()).send({ productId: 'WB10003', quantity: 1 }).expect(201)
    const created = await request(app.getHttpServer()).post('/api/v1/orders').set(user()).send({ requestId: `admin-orders-e2e-${seq}` }).expect(201)
    return created.body.data.orderNo as string
  }
  const createPaidOrder = async (): Promise<string> => {
    const orderNo = await createOrder()
    await request(app.getHttpServer()).post(`/api/v1/orders/${orderNo}/mock-pay`).set(user()).expect(201)
    return orderNo
  }

  it('未登录访问后台订单接口返回 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/orders').expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('普通用户 token 访问后台订单接口被拒绝', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/orders').set(user()).expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('订单列表支持状态与关键字过滤，并排展示本地/支付/仓储状态', async () => {
    const orderNo = await createOrder()
    await createPaidOrder()

    const payOnly = await request(app.getHttpServer()).get('/api/v1/admin/orders?status=pay').set(admin()).expect(200)
    expect(payOnly.body.data.total).toBeGreaterThanOrEqual(1)
    expect(payOnly.body.data.list.every((order: { status: string }) => order.status === 'pay')).toBe(true)

    const byKeyword = await request(app.getHttpServer()).get(`/api/v1/admin/orders?keyword=${orderNo}`).set(admin()).expect(200)
    expect(byKeyword.body.data).toMatchObject({ total: 1 })
    expect(byKeyword.body.data.list[0]).toMatchObject({
      orderNo, status: 'pay', paymentStatus: 'pending', warehouseStatus: null,
      customsRejected: false, receiverPhone: '134****0000',
    })

    const byPhone = await request(app.getHttpServer()).get('/api/v1/admin/orders?keyword=1340000').set(admin()).expect(200)
    expect(byPhone.body.data.total).toBeGreaterThanOrEqual(2)
  })

  it('订单详情含商品行、脱敏身份证与状态历史', async () => {
    const orderNo = await createOrder()

    const detail = await request(app.getHttpServer()).get(`/api/v1/admin/orders/${orderNo}`).set(admin()).expect(200)
    expect(detail.body.data).toMatchObject({
      orderNo, status: 'pay', idName: '孙八', idcard: '110***********1234',
      items: [expect.objectContaining({ productId: 'WB10003' })],
      statusEvents: [expect.objectContaining({ toStatus: 'pay', source: 'user' })],
    })
    expect(JSON.stringify(detail.body)).not.toContain('110101199001011234')
  })

  it('仓储侧无记录时手动同步返回业务错误', async () => {
    const orderNo = await createOrder()

    const response = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/sync`).set(admin()).expect(400)
    expect(response.body).toMatchObject({ code: 40002 })
  })

  it('支付后同步拉取仓储状态并记录状态历史与审计日志', async () => {
    const orderNo = await createPaidOrder()
    warehouse.mockOrderStatus(orderNo, '40') // 君梦：订单出库

    const synced = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/sync`).set(admin()).expect(200)
    expect(synced.body.data).toMatchObject({ status: 'receive', warehouseStatus: '40' })
    expect(synced.body.data.statusEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ fromStatus: 'ship', toStatus: 'receive', source: 'sync' })]),
    )

    const logs = await request(app.getHttpServer()).get('/api/v1/admin/audit-logs?action=sync_order').set(admin()).expect(200)
    expect(logs.body.data.list.some((log: { targetId: string }) => log.targetId === orderNo)).toBe(true)
  })

  it('海关退单（systemRemark）同步后有醒目标记', async () => {
    const orderNo = await createPaidOrder()
    warehouse.mockOrderStatus(orderNo, '91', '海关退单：超出个人年度交易限值')

    const synced = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/sync`).set(admin()).expect(200)
    expect(synced.body.data).toMatchObject({ status: 'cancelled', warehouseStatus: '91', customsRejected: true, systemRemark: '海关退单：超出个人年度交易限值' })
  })

  it('取消缺少二次确认时被拒绝', async () => {
    const orderNo = await createOrder()

    const response = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/cancel`).set(admin()).send({}).expect(400)
    expect(response.body).toMatchObject({ code: 40003 })
  })

  it('管理员取消待支付订单：关单不退款', async () => {
    const orderNo = await createOrder()

    const cancelled = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/cancel`).set(admin()).send({ confirm: true }).expect(200)
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'pending', refundFen: null })

    const repeat = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/cancel`).set(admin()).send({ confirm: true }).expect(400)
    expect(repeat.body).toMatchObject({ code: 40002 })
  })

  it('管理员取消已支付未申报订单：撤单并全额退款', async () => {
    const orderNo = await createPaidOrder()

    const cancelled = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/cancel`).set(admin()).send({ confirm: true }).expect(200)
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', refundFen: 28900 })
  })

  it('已申报（清关中）订单不可取消', async () => {
    const orderNo = await createPaidOrder()
    warehouse.mockOrderStatus(orderNo, '15') // 君梦：清关中
    await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/sync`).set(admin()).expect(200)

    const response = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${orderNo}/cancel`).set(admin()).send({ confirm: true }).expect(400)
    expect(response.body).toMatchObject({ code: 40002 })
  })

  it('未支付订单不能退款，已退款订单不能重复退款', async () => {
    const unpaid = await createOrder()
    const rejected = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${unpaid}/refund`).set(admin()).send({ confirm: true }).expect(400)
    expect(rejected.body).toMatchObject({ code: 40002 })

    const paid = await createPaidOrder()
    const refunded = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${paid}/refund`).set(admin()).send({ confirm: true }).expect(200)
    expect(refunded.body.data).toMatchObject({ paymentStatus: 'refunded', refundFen: 28900, status: 'ship' })

    const repeat = await request(app.getHttpServer()).post(`/api/v1/admin/orders/${paid}/refund`).set(admin()).send({ confirm: true }).expect(400)
    expect(repeat.body).toMatchObject({ code: 40002 })
  })
})
