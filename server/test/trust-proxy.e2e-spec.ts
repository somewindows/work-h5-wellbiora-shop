import { ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { configureTrustProxy } from '../src/common/trust-proxy'

describe('trust proxy 下按真实客户端 IP 限流（e2e，复审 R16）', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    process.env.ADMIN_INITIAL_USERNAME = 'tp-operator'
    process.env.ADMIN_INITIAL_PASSWORD = 'TrustProxy!2026'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    configureTrustProxy(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('不同 XFF 来源的限流桶相互独立，不共用反代地址', async () => {
    // 203.0.113.10 连续 5 次失败后，该 IP 被锁定
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ username: 'tp-ghost', password: 'WrongPass!2026' })
        .expect(401)
    }
    const locked = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ username: 'tp-ghost', password: 'WrongPass!2026' })
    expect(locked.body).toMatchObject({ code: 40005 })

    // 另一客户端 IP 不受影响，正确密码正常登录；
    // 若 trust proxy 未生效，两请求共用 127.0.0.1 桶，这里会同样被锁
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ username: 'tp-operator', password: 'TrustProxy!2026' })
      .expect(200)
  })
})
