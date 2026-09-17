import './common/environment'

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'

import { AppModule } from './app.module'
import { assertProductionConfig } from './common/production-guard'
import { configureTrustProxy } from './common/trust-proxy'
import { resolveUploadDir } from './common/upload-dir'

async function bootstrap(): Promise<void> {
  assertProductionConfig()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  configureTrustProxy(app)
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: origins, credentials: false })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )

  // 上传图片静态托管：本地开发由 Express 兜底出文件；
  // 生产环境 Nginx 的 `location ^~ /assets/uploads/` 先命中直接出文件，请求到不了这里
  app.useStaticAssets(resolveUploadDir(), { prefix: '/assets/uploads/' })

  // 默认 4000：本机 3000 端口曾被其他项目的 dev server 抢占导致代理打错服务，正式库可通过 PORT 覆盖
  await app.listen(Number(process.env.PORT ?? 4000))
}

void bootstrap()
