import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BusinessException } from '../common/business.exception'

import { ADMIN_ACCOUNTS_REPOSITORY, type AdminAccountsRepository, type AdminRole } from './admin-accounts.repository'

export interface AuthenticatedAdminRequest {
  headers: { authorization?: string }
  /** 原始请求路径（含全局前缀 /api/v1），用于强制改密白名单判断 */
  url?: string
  admin?: { id: string; username: string; role: AdminRole; mustChangePassword: boolean }
}

/** 强制改密期间唯一放行的接口（路径后缀匹配，兼容全局前缀 /api/v1） */
const CHANGE_PASSWORD_PATH = '/admin/auth/change-password'

@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(ADMIN_ACCOUNTS_REPOSITORY) private readonly accountsRepository: AdminAccountsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedAdminRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new BusinessException(40101, '请先登录后台', HttpStatus.UNAUTHORIZED)

    let payload: { sub?: string; username?: string; role?: string }
    try {
      payload = await this.jwtService.verifyAsync<{ sub?: string; username?: string; role?: string }>(token)
      if (!payload.sub || !payload.username || payload.role !== 'admin') throw new Error('JWT 载荷无效')
    } catch {
      throw new BusinessException(40101, '后台登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    }

    // 回查库：账号被删除或禁用后，已签发的 token 立即失效（与过期同等处理）
    const account = await this.accountsRepository.findById(payload.sub)
    if (!account || account.disabled) {
      throw new BusinessException(40101, '后台登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    }
    // 强制改密：仅放行修改密码接口，其余一律拒绝
    if (account.mustChangePassword && !(request.url ?? '').endsWith(CHANGE_PASSWORD_PATH)) {
      throw new BusinessException(40302, '请先修改密码', HttpStatus.FORBIDDEN)
    }
    request.admin = { id: account.id, username: account.username, role: account.role, mustChangePassword: account.mustChangePassword }
    return true
  }
}
