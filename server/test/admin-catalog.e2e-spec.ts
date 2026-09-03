import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { MemorySmsProvider, SMS_PROVIDER } from '../src/auth/sms-provider'

describe('后台商品目录管理（e2e）', () => {
  let app: INestApplication
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    process.env.ADMIN_INITIAL_USERNAME = 'operator'
    process.env.ADMIN_INITIAL_PASSWORD = 'AdminPass!2026'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    await app.init()

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'operator', password: 'AdminPass!2026' })
      .expect(200)
    adminToken = adminLogin.body.data.token

    const smsProvider = app.get<MemorySmsProvider>(SMS_PROVIDER)
    await request(app.getHttpServer()).post('/api/v1/auth/sms-code').send({ phone: '13500000000' }).expect(200)
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: '13500000000', code: smsProvider.lastCode })
      .expect(200)
    userToken = userLogin.body.data.token
  })

  afterAll(async () => {
    await app.close()
  })

  const admin = () => ({ Authorization: `Bearer ${adminToken}` })
  const user = () => ({ Authorization: `Bearer ${userToken}` })

  it('未登录访问后台接口返回 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/products').expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('普通用户 token 访问后台接口被拒绝', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set(user())
      .expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('新建商品初始为未发布草稿，公开列表与详情不可见', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set(admin())
      .send({
        id: 'p9', name: '新品测试饮', en: 'New Test Drink', priceFen: 9900,
        theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/p9-main.jpg',
        spec: '5ml × 10袋 / 盒', ingredients: '测试成分', originCert: '欧洲制造 · GMP 生产规范',
        complianceText: '固定合规声明',
      })
      .expect(201)
    expect(created.body.data).toMatchObject({ id: 'p9', isActive: false, contentVersion: 0, blocks: [], draftBlocks: [] })

    const list = await request(app.getHttpServer()).get('/api/v1/products').expect(200)
    expect(list.body.data.map((item: { id: string }) => item.id)).not.toContain('p9')
    await request(app.getHttpServer()).get('/api/v1/products/p9').expect(404)
  })

  it('重复 ID 新建商品被拒绝', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set(admin())
      .send({
        id: 'p9', name: '重复', en: 'Dup', priceFen: 100,
        theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/dup.jpg',
        spec: '1 件', ingredients: '成分', originCert: '产地', complianceText: '声明',
      })
      .expect(400)
    expect(response.body).toMatchObject({ code: 40002 })
  })

  it('改价后公开详情、购物车与预检都使用新价', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/WB10002')
      .set(admin())
      .send({ priceFen: 11111 })
      .expect(200)

    const detail = await request(app.getHttpServer()).get('/api/v1/products/WB10002').expect(200)
    expect(detail.body.data).toMatchObject({ priceFen: 11111 })

    const cart = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set(user())
      .send({ productId: 'WB10002', quantity: 1 })
      .expect(201)
    expect(cart.body.data).toMatchObject([{ productId: 'WB10002', priceFen: 11111 }])

    await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set(user())
      .send({ name: '赵六', phone: '13500000000', region: '浙江省 金华市 义乌市', detail: '稠城街道 2 号' })
      .expect(201)
    await request(app.getHttpServer())
      .post('/api/v1/realname')
      .set(user())
      .send({ name: '赵六', idcard: '110101199001011234' })
      .expect(201)

    const precheck = await request(app.getHttpServer()).post('/api/v1/orders/precheck').set(user()).send({}).expect(201)
    expect(precheck.body.data).toMatchObject({ payableFen: 11111 })
  })

  it('下架后禁止加购与下单', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/WB10002')
      .set(admin())
      .send({ isActive: false })
      .expect(200)

    const add = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set(user())
      .send({ productId: 'WB10002', quantity: 1 })
      .expect(400)
    expect(add.body).toMatchObject({ code: 40006 })

    const precheck = await request(app.getHttpServer()).post('/api/v1/orders/precheck').set(user()).send({}).expect(400)
    expect(precheck.body).toMatchObject({ code: 40006 })

    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set(user())
      .send({ requestId: 'admin-e2e-offline' })
      .expect(400)
    expect(created.body).toMatchObject({ code: 40006 })

    // 恢复上架，避免影响后续用例
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/WB10002')
      .set(admin())
      .send({ isActive: true, priceFen: 25900 })
      .expect(200)
  })

  it('非法块类型在保存草稿时即被拒绝', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/admin/products/p9/draft-blocks')
      .set(admin())
      .send({ blocks: [{ type: 'unknown_block' }] })
      .expect(422)
    expect(response.body).toMatchObject({ code: 42201 })
  })

  it('草稿可保存半成品，发布时才做完整校验', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/admin/products/p9/draft-blocks')
      .set(admin())
      .send({ blocks: [{ type: 'image' }] })
      .expect(200)

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products/p9/publish')
      .set(admin())
      .expect(422)
    expect(response.body).toMatchObject({ code: 42201 })
  })

  it('没有上一发布版时回滚报错', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products/WB10001/rollback')
      .set(admin())
      .expect(400)
    expect(response.body).toMatchObject({ code: 40002 })
  })

  it('发布两版后回滚恢复上一版内容并写审计日志', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/admin/products/p9/draft-blocks')
      .set(admin())
      .send({ blocks: [{ type: 'gallery', images: ['/assets/p9-v1.jpg'] }] })
      .expect(200)
    await request(app.getHttpServer()).post('/api/v1/admin/products/p9/publish').set(admin()).expect(200)
    await request(app.getHttpServer())
      .put('/api/v1/admin/products/p9/draft-blocks')
      .set(admin())
      .send({ blocks: [{ type: 'text', body: '第二版文案' }] })
      .expect(200)
    await request(app.getHttpServer()).post('/api/v1/admin/products/p9/publish').set(admin()).expect(200)

    const rolledBack = await request(app.getHttpServer())
      .post('/api/v1/admin/products/p9/rollback')
      .set(admin())
      .expect(200)
    expect(rolledBack.body.data).toMatchObject({
      contentVersion: 3,
      blocks: [{ type: 'gallery', images: ['/assets/p9-v1.jpg'] }],
    })

    const logs = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?action=rollback&page=1&pageSize=10')
      .set(admin())
      .expect(200)
    expect(logs.body.data.total).toBe(1)
    expect(logs.body.data.list[0]).toMatchObject({ action: 'rollback', targetId: 'p9', adminUsername: 'operator' })
  })

  it('操作日志支持分页与动作过滤', async () => {
    const created = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?action=create_product')
      .set(admin())
      .expect(200)
    expect(created.body.data.total).toBeGreaterThanOrEqual(1)
    expect(created.body.data.list.every((log: { action: string }) => log.action === 'create_product')).toBe(true)

    const all = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?page=1&pageSize=2')
      .set(admin())
      .expect(200)
    expect(all.body.data.list).toHaveLength(2)
    expect(all.body.data.total).toBeGreaterThan(2)
  })
})
