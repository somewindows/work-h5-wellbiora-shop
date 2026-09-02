import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'

describe('后台登录限频（e2e）', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.ADMIN_INITIAL_USERNAME = 'rl-operator'
    process.env.ADMIN_INITIAL_PASSWORD = 'RateLimit!2026'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('连续 5 次失败后锁定，期间正确密码也返回 40005', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .send({ username: 'rl-operator', password: 'WrongPass!2026' })
        .expect(401)
      expect(response.body).toMatchObject({ code: 40101 })
    }

    const locked = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'rl-operator', password: 'RateLimit!2026' })
      .expect(400)
    expect(locked.body).toMatchObject({ code: 40005 })
  })
})
