import type { NestExpressApplication } from '@nestjs/platform-express'

/**
 * 复审 R16：部署拓扑为同机 Nginx 反代（见部署指南），只信任 loopback 来源的
 * X-Forwarded-For，登录/短信限流的 @Ip() 才能取到真实客户端 IP；
 * 不设时全站共用 Nginx 的 127.0.0.1 限流桶，直连后端端口伪造 XFF 也不生效。
 */
export function configureTrustProxy(app: NestExpressApplication): void {
  app.set('trust proxy', 'loopback')
}
