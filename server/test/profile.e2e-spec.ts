import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { MemorySmsProvider, SMS_PROVIDER } from '../src/auth/sms-provider'

describe('地址与实名接口（e2e）', () => {
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    await app.init()
    const smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)
    await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: '13700000000' }).expect(200)
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone: '13700000000', code: smsProvider.lastCode }).expect(200)
    token = login.body.data.token
  })

  afterAll(async () => app?.close())

  it('登录后可保存地址和实名，且身份证号被脱敏', async () => {
    const agent = request(app.getHttpServer())
    await agent.post('/api/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      name: '张三', phone: '13700000000', region: '浙江省 金华市 义乌市', detail: '稠城街道 1 号',
    }).expect(201)
    await agent.post('/api/v1/realname').set('Authorization', `Bearer ${token}`).send({ name: '张三', idcard: '110101199001011234' }).expect(201)

    const addresses = await agent.get('/api/v1/addresses').set('Authorization', `Bearer ${token}`).expect(200)
    const realname = await agent.get('/api/v1/realname').set('Authorization', `Bearer ${token}`).expect(200)
    expect(addresses.body.data).toMatchObject([{ name: '张三', isDefault: true }])
    expect(realname.body).toEqual({ code: 0, data: { name: '张三', idcard: '110***********1234' } })
  })
})
