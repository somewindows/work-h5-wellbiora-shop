import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BusinessException } from './business.exception'

export interface AuthenticatedRequest {
  headers: { authorization?: string }
  user?: { id: string; phone: string }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new BusinessException(40101, '请先登录', HttpStatus.UNAUTHORIZED)

    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; phone?: string }>(token)
      if (!payload.sub || !payload.phone) throw new Error('JWT 载荷无效')
      request.user = { id: payload.sub, phone: payload.phone }
      return true
    } catch {
      throw new BusinessException(40101, '登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    }
  }
}
