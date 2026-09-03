import './common/environment'

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'PERSONAL_DATA_KEY', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
    const missing = required.filter((key) => !process.env[key])
    if (missing.length > 0) throw new Error(`生产环境缺少配置：${missing.join(', ')}`)
  }

  const app = await NestFactory.create(AppModule)
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

  // 默认 4000：本机 3000 端口曾被其他项目的 dev server 抢占导致代理打错服务，正式库可通过 PORT 覆盖
  await app.listen(Number(process.env.PORT ?? 4000))
}

void bootstrap()
