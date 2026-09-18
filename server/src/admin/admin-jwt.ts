import { Logger } from '@nestjs/common'
import { JwtService, type JwtSignOptions } from '@nestjs/jwt'

/** 后台管理员专用 JWT 服务令牌（与 H5 用户 JWT 隔离：独立密钥可配 + 更短有效期） */
export const ADMIN_JWT_SERVICE = Symbol('ADMIN_JWT_SERVICE')

/**
 * 复审第五节「管理员会话隔离较弱」：后台不再复用用户侧全局 JwtService（JWT_SECRET、7 天）。
 * - 密钥：优先 ADMIN_JWT_SECRET，缺省回落 JWT_SECRET 并告警（避免破坏已部署环境，建议生产配置独立密钥）
 * - 有效期：ADMIN_JWT_EXPIRES（默认 12h，远短于用户侧 7d）；禁用/改密的撤销由守卫回查库即时生效
 */
export function createAdminJwtService(): JwtService {
  const logger = new Logger('AdminJwt')
  let secret = process.env.ADMIN_JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      secret = 'test-only-admin-jwt-secret'
    } else {
      secret = process.env.JWT_SECRET
      if (!secret) throw new Error('缺少 JWT_SECRET（且未配置 ADMIN_JWT_SECRET）')
      logger.warn('未配置 ADMIN_JWT_SECRET，管理员 token 回落复用 JWT_SECRET——建议生产环境配置独立密钥')
    }
  }
  const expiresIn = (process.env.ADMIN_JWT_EXPIRES || '12h') as JwtSignOptions['expiresIn']
  return new JwtService({ secret, signOptions: { expiresIn } })
}
