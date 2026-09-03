import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { MemorySmsProvider, SMS_PROVIDER } from '../src/auth/sms-provider'

describe('订单接口（e2e）', () => {
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    await app.init()
    const smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)
    await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: '13600000000' }).expect(200)
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone: '13600000000', code: smsProvider.lastCode }).expect(200)
    token = login.body.data.token
  })

  afterAll(async () => app?.close())

  it('完成预检、创建、查询和取消待支付订单', async () => {
    const agent = request(app.getHttpServer())
    const auth = { Authorization: `Bearer ${token}` }
    await agent.post('/api/v1/cart/items').set(auth).send({ productId: 'WB10001', quantity: 1 }).expect(201)
    await agent.post('/api/v1/addresses').set(auth).send({ name: '王五', phone: '13600000000', region: '浙江省 金华市 义乌市', detail: '北苑街道 1 号' }).expect(201)
    await agent.post('/api/v1/realname').set(auth).send({ name: '王五', idcard: '110101199001011234' }).expect(201)

    const precheck = await agent.post('/api/v1/orders/precheck').set(auth).send({})
    expect(precheck.body).toMatchObject({ code: 0 })
    expect(precheck.status).toBe(201)
    expect(precheck.body.data).toMatchObject({ payableFen: 32900 })

    const created = await agent.post('/api/v1/orders').set(auth).send({ requestId: 'e2e-order-1' }).expect(201)
    const orderNo = created.body.data.orderNo as string
    const duplicate = await agent.post('/api/v1/orders').set(auth).send({ requestId: 'e2e-order-1' }).expect(201)
    expect(duplicate.body.data.orderNo).toBe(orderNo)

    const order = await agent.get(`/api/v1/orders/${orderNo}`).set(auth).expect(200)
    expect(order.body.data).toMatchObject({ orderNo, status: 'pay', idName: '王五' })
    await agent.post(`/api/v1/orders/${orderNo}/cancel`).set(auth).send({}).expect(201)
    const cancelled = await agent.get(`/api/v1/orders/${orderNo}`).set(auth).expect(200)
    expect(cancelled.body.data).toMatchObject({ status: 'cancelled' })
  })
})
