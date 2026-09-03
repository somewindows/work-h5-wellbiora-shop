import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'

describe('后台管理员认证（e2e）', () => {
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

  it('使用首次启动播种的管理员账号登录', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'operator', password: 'AdminPass!2026' })
      .expect(200)

    expect(response.body).toMatchObject({
      code: 0,
      data: { token: expect.any(String), admin: { username: 'operator' } },
    })
  })

  it('发布详情草稿后，H5 商品详情读取新的已发布内容', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'operator', password: 'AdminPass!2026' })
      .expect(200)
    const token = login.body.data.token as string
    const blocks = [{ type: 'gallery', images: ['/assets/admin-p1.jpg'] }]

    await request(app.getHttpServer())
      .put('/api/v1/admin/products/WB10001/draft-blocks')
      .set('Authorization', `Bearer ${token}`)
      .send({ blocks })
      .expect(200)
    await request(app.getHttpServer())
      .post('/api/v1/admin/products/WB10001/publish')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const detail = await request(app.getHttpServer()).get('/api/v1/products/WB10001').expect(200)
    expect(detail.body.data).toMatchObject({ blocks })
  })

  it('管理员可修改商品基础信息并查询商品列表', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'operator', password: 'AdminPass!2026' })
      .expect(200)
    const token = login.body.data.token as string

    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/WB10001')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceFen: 31900, isActive: false })
      .expect(200)
      .expect(({ body }) => expect(body.data).toMatchObject({ id: 'WB10001', priceFen: 31900, isActive: false }))

    await request(app.getHttpServer())
      .get('/api/v1/admin/products?isActive=false')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.data).toMatchObject({ total: 1, list: [expect.objectContaining({ id: 'WB10001', isActive: false })] }))
  })
})
