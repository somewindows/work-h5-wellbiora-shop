import { readdirSync, readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from '../src/app.module'
import { UPLOAD_MAX_FILE_SIZE } from '../src/admin/upload.utils'

/** 1x1 像素 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

describe('后台图片上传（e2e）', () => {
  let app: NestExpressApplication
  let adminToken: string
  let uploadDir: string

  const savedUploadDir = process.env.UPLOAD_DIR

  beforeAll(async () => {
    uploadDir = mkdtempSync(join(tmpdir(), 'wellbiora-uploads-'))
    process.env.UPLOAD_DIR = uploadDir
    process.env.ADMIN_INITIAL_USERNAME = 'uploader'
    process.env.ADMIN_INITIAL_PASSWORD = 'AdminPass!2026'

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    // 与 main.ts 一致：本地由 Express 托管上传目录（生产由 Nginx ^~ 直接出文件）
    app.useStaticAssets(uploadDir, { prefix: '/assets/uploads/' })
    await app.init()

    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ username: 'uploader', password: 'AdminPass!2026' })
      .expect(200)
    adminToken = login.body.data.token
  })

  afterAll(async () => {
    await app.close()
    // 恢复 env，避免 --runInBand 下同进程的其他 spec 读到残留
    if (savedUploadDir === undefined) delete process.env.UPLOAD_DIR
    else process.env.UPLOAD_DIR = savedUploadDir
    rmSync(uploadDir, { recursive: true, force: true })
  })

  const admin = () => ({ Authorization: `Bearer ${adminToken}` })

  it('上传 1x1 PNG 成功：返回 /assets/uploads/ 地址、文件落盘、静态可取回、记审计日志', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .set(admin())
      .attach('file', PNG_1X1, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(201)

    const url: string = response.body.data.url
    expect(url).toMatch(/^\/assets\/uploads\/[0-9a-f-]{36}\.png$/)

    // 文件确实落盘且内容与上传一致
    const filename = url.replace('/assets/uploads/', '')
    expect(readFileSync(join(uploadDir, filename))).toEqual(PNG_1X1)

    // 经 useStaticAssets 能取回（静态路径不走 /api/v1 全局前缀）
    const fetched = await request(app.getHttpServer()).get(url).expect(200)
    expect(fetched.headers['content-type']).toContain('image/png')

    // 审计日志记录 upload_image，且不包含用户提交的原始文件名
    const logs = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?action=upload_image&page=1&pageSize=10')
      .set(admin())
      .expect(200)
    expect(logs.body.data.total).toBe(1)
    expect(logs.body.data.list[0].afterData).toMatchObject({ url, mimetype: 'image/png', size: PNG_1X1.length })
    expect(JSON.stringify(logs.body.data.list[0])).not.toContain('pixel.png')
  })

  it('伪造 text/plain 类型被拒绝（40003）且不落盘', async () => {
    const before = readdirSync(uploadDir)
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .set(admin())
      .attach('file', PNG_1X1, { filename: 'fake.png', contentType: 'text/plain' })
      .expect(400)
    expect(response.body).toMatchObject({ code: 40003, message: '仅支持 JPG/PNG/WebP/GIF 图片' })
    expect(readdirSync(uploadDir)).toEqual(before)
  })

  it('未登录上传返回 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .attach('file', PNG_1X1, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(401)
    expect(response.body).toMatchObject({ code: 40101 })
  })

  it('超过 5MB 被拒绝（40003）且不落盘', async () => {
    const before = readdirSync(uploadDir)
    const oversized = Buffer.alloc(UPLOAD_MAX_FILE_SIZE + 1, 1)
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/uploads')
      .set(admin())
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' })
      .expect(400)
    expect(response.body).toMatchObject({ code: 40003, message: '图片大小不能超过 5MB' })
    expect(readdirSync(uploadDir)).toEqual(before)
  })
})
