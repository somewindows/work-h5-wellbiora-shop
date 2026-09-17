import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { USERS_REPOSITORY, type UsersRepository } from '../users/users.repository'

import { BusinessException } from './business.exception'

export interface AuthenticatedRequest {
  headers: { authorization?: string }
  user?: { id: string; phone: string }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new BusinessException(40101, '请先登录', HttpStatus.UNAUTHORIZED)

    let payload: { sub?: string; phone?: string }
    try {
      payload = await this.jwtService.verifyAsync<{ sub?: string; phone?: string }>(token)
      if (!payload.sub || !payload.phone) throw new Error('JWT 载荷无效')
    } catch {
      throw new BusinessException(40101, '登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    }

    // 已禁用用户持旧 token 访问一律拒绝（发码/登录之外的第三道拦截，覆盖所有用户侧接口）
    const user = await this.usersRepository.findById(payload.sub)
    if (!user) throw new BusinessException(40101, '登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    if (user.disabled) throw new BusinessException(40301, '账号已被禁用，请联系客服', HttpStatus.FORBIDDEN)

    request.user = { id: payload.sub, phone: payload.phone }
    return true
  }
}
