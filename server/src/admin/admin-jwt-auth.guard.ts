import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BusinessException } from '../common/business.exception'

export interface AuthenticatedAdminRequest {
  headers: { authorization?: string }
  admin?: { id: string; username: string }
}

@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedAdminRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new BusinessException(40101, '请先登录后台', HttpStatus.UNAUTHORIZED)

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; username?: string; role?: string }>(token)
      if (!payload.sub || !payload.username || payload.role !== 'admin') throw new Error('JWT 载荷无效')
      request.admin = { id: payload.sub, username: payload.username }
      return true
    } catch {
      throw new BusinessException(40101, '后台登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    }
  }
}
