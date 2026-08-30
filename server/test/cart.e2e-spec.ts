import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { MemorySmsProvider, SMS_PROVIDER } from '../src/auth/sms-provider'

describe('购物车接口（e2e）', () => {
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    await app.init()
    const smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)
    await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: '13800000000' }).expect(200)
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone: '13800000000', code: smsProvider.lastCode }).expect(200)
    token = login.body.data.token
  })

  afterAll(async () => app?.close())

  it('登录后可加入、修改和移除购物车商品', async () => {
    const agent = request(app.getHttpServer())
    const add = await agent.post('/api/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ productId: 'p1', quantity: 1 }).expect(201)
    const itemId = add.body.data[0].id as string

    await agent.patch(`/api/v1/cart/items/${itemId}`).set('Authorization', `Bearer ${token}`).send({ quantity: 2, checked: false }).expect(200)
    const list = await agent.get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200)
    expect(list.body.data).toMatchObject([{ id: itemId, productId: 'p1', quantity: 2, checked: false }])

    await agent.delete(`/api/v1/cart/items/${itemId}`).set('Authorization', `Bearer ${token}`).expect(200)
    await agent.get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect({ code: 0, data: [] })
  })
})
