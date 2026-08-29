import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'REDIS_URL']
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

  await app.listen(Number(process.env.PORT ?? 3000))
}

void bootstrap()
