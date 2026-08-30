import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { SMS_PROVIDER, MemorySmsProvider } from '../src/auth/sms-provider'

describe('认证接口（e2e）', () => {
  let app: INestApplication
  let smsProvider: MemorySmsProvider

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    await app.init()
    smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('发送验证码后可以登录，且响应不含验证码', async () => {
    const sendResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/sms-code')
      .send({ phone: '13900000000' })
      .expect(200)
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '13900000000', code: smsProvider.lastCode })
      .expect(200)

    expect(sendResponse.body).toEqual({ code: 0, data: null })
    expect(loginResponse.body).toMatchObject({
      code: 0,
      data: { token: expect.any(String), user: { phone: '139****0000' } },
    })
    expect(JSON.stringify(loginResponse.body)).not.toContain(smsProvider.lastCode)
  })

  it('登录后可通过 users/me 查询当前用户', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/sms-code')
      .send({ phone: '13700000000' })
      .expect(200)
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '13700000000', code: smsProvider.lastCode })
      .expect(200)

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .expect(200)

    expect(response.body).toMatchObject({
      code: 0,
      data: { phone: '137****0000', nickname: 'WELLBIORA 会员' },
    })
  })

  it('清晰表示微信静默授权尚未配置', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/wechat-silent').expect(501)

    expect(response.body).toEqual({ code: 50101, message: '微信静默授权尚未配置', data: null })
  })
})
