import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { MemorySmsProvider, SMS_PROVIDER } from '../src/auth/sms-provider'

describe('后台用户管理（e2e）', () => {
  let app: INestApplication
  let adminToken: string
  let smsProvider: MemorySmsProvider
  let seq = 0

  beforeAll(async () => {
    process.env.ADMIN_INITIAL_USERNAME = 'operator'
    process.env.ADMIN_INITIAL_PASSWORD = 'AdminPass!2026'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
    smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'operator', password: 'AdminPass!2026' })
      .expect(200)
    adminToken = adminLogin.body.data.token
  })

  afterAll(async () => {
    await app.close()
  })

  const admin = () => ({ Authorization: `Bearer ${adminToken}` })

  /** 走真实 sms-code/login 流程造一个用户（唯一手机号隔离 spec 间数据），返回 { id, token, phone } */
  const createUser = async (): Promise<{ id: string; token: string; phone: string }> => {
    seq += 1
    const phone = `137${String(10000000 + seq).slice(-8)}`
    await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone }).expect(200)
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, code: smsProvider.lastCode })
      .expect(200)
    return { id: login.body.data.user.id as string, token: login.body.data.token as string, phone }
  }

  it('未登录访问后台用户接口返回 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('普通用户 token 访问后台用户接口被拒绝', async () => {
    const user = await createUser()
    const response = await request(app.getHttpServer()).get('/api/v1/admin/users').set({ Authorization: `Bearer ${user.token}` }).expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('用户列表返回且手机号脱敏，支持 keyword 过滤', async () => {
    const user = await createUser()

    const list = await request(app.getHttpServer()).get(`/api/v1/admin/users?keyword=${user.phone}`).set(admin()).expect(200)
    expect(list.body.data.total).toBe(1)
    expect(list.body.data.list[0]).toMatchObject({
      id: user.id,
      phoneMasked: `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`,
      nickname: 'WELLBIORA 会员',
      wechatBound: false, realnamed: false, disabled: false, orderCount: 0, paidTotalFen: 0,
    })
    expect(JSON.stringify(list.body)).not.toContain(user.phone)
  })

  it('用户详情含年度额度卡，未实名用户占用为 0', async () => {
    const user = await createUser()

    const detail = await request(app.getHttpServer()).get(`/api/v1/admin/users/${user.id}`).set(admin()).expect(200)
    expect(detail.body.data).toMatchObject({
      id: user.id,
      realnameNameMasked: null,
      addressCount: 0,
      yearlyQuota: { year: new Date().getFullYear(), occupiedFen: 0, remainingFen: 2600000, limitFen: 2600000 },
    })
  })

  it('不存在的用户返回 40404', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/users/missing-id').set(admin()).expect(404)
    expect(response.body).toMatchObject({ code: 40404 })
  })

  it('禁用缺少二次确认返回 40003', async () => {
    const user = await createUser()

    const response = await request(app.getHttpServer()).post(`/api/v1/admin/users/${user.id}/disable`).set(admin()).send({}).expect(400)
    expect(response.body).toMatchObject({ code: 40003 })
  })

  it('禁用后拒绝发验证码、旧 token 失效；启用后恢复；全程写审计', async () => {
    const user = await createUser()

    // 禁用
    const disabled = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/disable`).set(admin()).send({ confirm: true }).expect(200)
    expect(disabled.body.data.disabled).toBe(true)

    // 禁用后该手机号不再发验证码
    const sms = await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: user.phone }).expect(403)
    expect(sms.body).toMatchObject({ code: 40301 })

    // 已签发的旧 token 调用户接口被拒
    const me = await request(app.getHttpServer()).get('/api/v1/users/me').set({ Authorization: `Bearer ${user.token}` }).expect(403)
    expect(me.body).toMatchObject({ code: 40301 })

    // 重复禁用返回 40002
    const repeat = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/disable`).set(admin()).send({ confirm: true }).expect(400)
    expect(repeat.body).toMatchObject({ code: 40002 })

    // 审计日志有禁用记录
    const logs = await request(app.getHttpServer()).get('/api/v1/admin/audit-logs?action=disable_user').set(admin()).expect(200)
    expect(logs.body.data.list.some((log: { targetId: string }) => log.targetId === user.id)).toBe(true)

    // 启用后恢复：旧 token 立即可用；发码不再被禁用拦截（60s 冷却内返回 40005 而非 40301，证明已通过禁用检查）
    const enabled = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${user.id}/enable`).set(admin()).send({ confirm: true }).expect(200)
    expect(enabled.body.data.disabled).toBe(false)
    await request(app.getHttpServer()).get('/api/v1/users/me').set({ Authorization: `Bearer ${user.token}` }).expect(200)
    const smsAfter = await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: user.phone })
    expect(smsAfter.status).not.toBe(403)
    expect(smsAfter.body).toMatchObject({ code: 40005 })
  })

  it('后台订单列表支持按 userId 过滤（用户详情页内嵌订单用）', async () => {
    const user = await createUser()
    const auth = { Authorization: `Bearer ${user.token}` }
    await request(app.getHttpServer()).post('/api/v1/addresses').set(auth)
      .send({ name: '孙八', phone: user.phone, region: '浙江省 金华市 义乌市', detail: '北苑街道 8 号' }).expect(201)
    await request(app.getHttpServer()).post('/api/v1/realname').set(auth)
      .send({ name: '孙八', idcard: '110101199001011234' }).expect(201)
    await request(app.getHttpServer()).post('/api/v1/cart/items').set(auth).send({ productId: 'WB10003', quantity: 1 }).expect(201)
    await request(app.getHttpServer()).post('/api/v1/orders').set(auth).send({ requestId: `admin-users-e2e-${seq}` }).expect(201)

    const orders = await request(app.getHttpServer()).get(`/api/v1/admin/orders?userId=${user.id}`).set(admin()).expect(200)
    expect(orders.body.data.total).toBe(1)
    // 用户列表/详情聚合到这笔待支付订单：订单数 +1，累计消费不计待支付
    const detail = await request(app.getHttpServer()).get(`/api/v1/admin/users/${user.id}`).set(admin()).expect(200)
    expect(detail.body.data).toMatchObject({ orderCount: 1, paidTotalFen: 0, realnamed: true, realnameNameMasked: '孙*', addressCount: 1 })
  })
})
