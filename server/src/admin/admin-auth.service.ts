import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BusinessException } from '../common/business.exception'

import { AdminPasswordService } from './password.service'
import { ADMIN_ACCOUNTS_REPOSITORY, type AdminAccountRecord, type AdminAccountsRepository, type AdminRole } from './admin-accounts.repository'
import { ADMIN_JWT_SERVICE } from './admin-jwt'
import { ADMIN_LOGIN_RATE_LIMIT_STORE, type AdminLoginRateLimitStore } from './admin-login-rate-limit.store'

export { type AdminAccountRecord, type AdminAccountsRepository } from './admin-accounts.repository'

/** 登录成功的管理员公开信息（绝不含密码哈希） */
export interface AdminLoginResult {
  token: string
  admin: { id: string; username: string; role: AdminRole; mustChangePassword: boolean }
}

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(ADMIN_ACCOUNTS_REPOSITORY) private readonly repository: AdminAccountsRepository,
    private readonly passwordService: AdminPasswordService,
    @Inject(ADMIN_JWT_SERVICE) private readonly jwtService: JwtService,
    @Inject(ADMIN_LOGIN_RATE_LIMIT_STORE) private readonly rateLimit: AdminLoginRateLimitStore,
  ) {}

  /** 播种初始管理员：始终是超级管理员（否则无人能管理其他管理员账号） */
  async ensureInitialAdmin(username: string, password: string): Promise<{ id: string; username: string }> {
    const existing = await this.repository.findByUsername(username)
    if (existing) return { id: existing.id, username: existing.username }

    const passwordHash = await this.passwordService.hash(password)
    const created = await this.repository.create({ username, passwordHash, role: 'super' })
    return { id: created.id, username: created.username }
  }

  async login(username: string, password: string, ip: string): Promise<AdminLoginResult> {
    const rateLimitKeys = [`account:${username}`, `ip:${ip || 'unknown'}`]
    for (const key of rateLimitKeys) await this.rateLimit.assertAllowed(key)

    const admin = await this.repository.findByUsername(username)
    if (!admin || !(await this.passwordService.verify(password, admin.passwordHash))) {
      for (const key of rateLimitKeys) await this.rateLimit.recordFailure(key)
      throw new BusinessException(40101, '管理员账号或密码错误', HttpStatus.UNAUTHORIZED)
    }
    if (admin.disabled) {
      throw new BusinessException(40301, '账号已被禁用，请联系超级管理员', HttpStatus.FORBIDDEN)
    }

    for (const key of rateLimitKeys) await this.rateLimit.reset(key)
    return {
      // JWT 载荷只作身份标识，角色/状态以守卫回查库为准（禁用立即生效）
      token: await this.jwtService.signAsync({ sub: admin.id, username: admin.username, role: 'admin' }),
      admin: this.toPublicAdmin(admin),
    }
  }

  private toPublicAdmin(admin: AdminAccountRecord): AdminLoginResult['admin'] {
    return { id: admin.id, username: admin.username, role: admin.role, mustChangePassword: admin.mustChangePassword }
  }
}
