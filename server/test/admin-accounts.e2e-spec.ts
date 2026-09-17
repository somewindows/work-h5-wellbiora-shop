import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'

describe('后台管理员账号管理（e2e）', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.ADMIN_INITIAL_USERNAME = 'operator'
    process.env.ADMIN_INITIAL_PASSWORD = 'AdminPass!2026'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  async function login(username: string, password: string): Promise<{ token: string; admin: { id: string; username: string; role: string; mustChangePassword: boolean } }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username, password })
      .expect(200)
    return response.body.data
  }

  it('完整链路：超管建号 → 临时密码首登强制改密 → 改密后正常使用；禁用后登录与旧 token 失效', async () => {
    // 1. 播种账号是超级管理员，登录响应带角色与改密标记
    const root = await login('operator', 'AdminPass!2026')
    expect(root.admin).toMatchObject({ username: 'operator', role: 'super', mustChangePassword: false })
    const rootHeaders = { Authorization: `Bearer ${root.token}` }

    // 2. 超管列表可访问，且能看到自己
    const list = await request(app.getHttpServer()).get('/api/v1/admin/accounts').set(rootHeaders).expect(200)
    expect(list.body.data).toEqual([expect.objectContaining({ username: 'operator', role: 'super', disabled: false })])
    expect(JSON.stringify(list.body.data)).not.toContain('passwordHash')

    // 3. 新建管理员：缺二次确认 40003；确认后返回一次性临时密码
    await request(app.getHttpServer()).post('/api/v1/admin/accounts').set(rootHeaders).send({ username: 'reviewer' }).expect(400).expect(({ body }) => {
      expect(body.code).toBe(40003)
    })
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/accounts')
      .set(rootHeaders)
      .send({ username: 'reviewer', confirm: true })
      .expect(200)
    const tempPassword = created.body.data.tempPassword as string
    const reviewerId = created.body.data.account.id as string
    expect(tempPassword).toMatch(/^[0-9a-f]{16}$/)
    expect(created.body.data.account).toMatchObject({ username: 'reviewer', role: 'admin', mustChangePassword: true })

    // 重名 40002
    await request(app.getHttpServer()).post('/api/v1/admin/accounts').set(rootHeaders).send({ username: 'reviewer', confirm: true }).expect(400).expect(({ body }) => {
      expect(body.code).toBe(40002)
    })

    // 4. 新管理员用临时密码登录：响应标记强制改密
    const reviewer = await login('reviewer', tempPassword)
    expect(reviewer.admin).toMatchObject({ role: 'admin', mustChangePassword: true })
    const reviewerHeaders = { Authorization: `Bearer ${reviewer.token}` }

    // 5. 未改密前访问其他接口被 40302 拦截；改密接口本身放行
    await request(app.getHttpServer()).get('/api/v1/admin/products').set(reviewerHeaders).expect(403).expect(({ body }) => {
      expect(body.code).toBe(40302)
    })
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/change-password')
      .set(reviewerHeaders)
      .send({ oldPassword: tempPassword, newPassword: 'short' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe(40003))
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/change-password')
      .set(reviewerHeaders)
      .send({ oldPassword: tempPassword, newPassword: 'Reviewer!2026ok' })
      .expect(200)

    // 6. 改密后正常访问；但普通管理员访问账号管理仍 40302
    await request(app.getHttpServer()).get('/api/v1/admin/products').set(reviewerHeaders).expect(200)
    await request(app.getHttpServer()).get('/api/v1/admin/accounts').set(reviewerHeaders).expect(403).expect(({ body }) => {
      expect(body.code).toBe(40302)
    })

    // 7. 超管禁用该管理员：此后登录 40301、旧 token 40101
    await request(app.getHttpServer()).post(`/api/v1/admin/accounts/${reviewerId}/disable`).set(rootHeaders).send({ confirm: true }).expect(200)
    await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'reviewer', password: 'Reviewer!2026ok' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe(40301))
    await request(app.getHttpServer()).get('/api/v1/admin/products').set(reviewerHeaders).expect(401).expect(({ body }) => {
      expect(body.code).toBe(40101)
    })

    // 8. 启用 + 重置密码：新临时密码可登录且仍强制改密，旧密码失效
    await request(app.getHttpServer()).post(`/api/v1/admin/accounts/${reviewerId}/enable`).set(rootHeaders).send({ confirm: true }).expect(200)
    const reset = await request(app.getHttpServer())
      .post(`/api/v1/admin/accounts/${reviewerId}/reset-password`)
      .set(rootHeaders)
      .send({ confirm: true })
      .expect(200)
    const newTempPassword = reset.body.data.tempPassword as string
    expect(reset.body.data.account.mustChangePassword).toBe(true)
    await request(app.getHttpServer()).post('/api/v1/admin/auth/login').send({ username: 'reviewer', password: 'Reviewer!2026ok' }).expect(401)
    const relogin = await login('reviewer', newTempPassword)
    expect(relogin.admin.mustChangePassword).toBe(true)
  })

  it('超管不能禁用/重置自己', async () => {
    const root = await login('operator', 'AdminPass!2026')
    const rootHeaders = { Authorization: `Bearer ${root.token}` }

    await request(app.getHttpServer()).post(`/api/v1/admin/accounts/${root.admin.id}/disable`).set(rootHeaders).send({ confirm: true }).expect(400).expect(({ body }) => {
      expect(body.code).toBe(40002)
    })
    await request(app.getHttpServer())
      .post(`/api/v1/admin/accounts/${root.admin.id}/reset-password`)
      .set(rootHeaders)
      .send({ confirm: true })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe(40002))
  })
})
