import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'

describe('商品与首页接口（e2e）', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('返回首页内容块数组', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/home').expect(200)

    expect(response.body).toMatchObject({
      code: 0,
      data: expect.arrayContaining([expect.objectContaining({ type: 'hero' })]),
    })
  })

  it('返回四个商品和完整详情', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/products').expect(200)
    const detail = await request(app.getHttpServer()).get('/api/v1/products/WB10002').expect(200)

    expect(list.body.data).toHaveLength(4)
    expect(detail.body.data).toMatchObject({
      id: 'WB10002',
      complianceText: expect.any(String),
      blocks: expect.arrayContaining([expect.objectContaining({ type: 'gallery' })]),
    })
  })

  it('以 40404 响应不存在的商品', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/products/missing').expect(404)

    expect(response.body).toEqual({ code: 40404, message: '商品不存在', data: null })
  })
})
