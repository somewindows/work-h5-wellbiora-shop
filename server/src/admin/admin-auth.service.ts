import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BusinessException } from '../common/business.exception'

import { AdminPasswordService } from './password.service'
import { ADMIN_ACCOUNTS_REPOSITORY } from './admin-accounts.repository'
import { ADMIN_LOGIN_RATE_LIMIT_STORE, type AdminLoginRateLimitStore } from './admin-login-rate-limit.store'

export interface AdminAccountRecord {
  id: string
  username: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export interface AdminAccountsRepository {
  findByUsername(username: string): Promise<AdminAccountRecord | null>
  create(input: Pick<AdminAccountRecord, 'username' | 'passwordHash'>): Promise<AdminAccountRecord>
}

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(ADMIN_ACCOUNTS_REPOSITORY) private readonly repository: AdminAccountsRepository,
    private readonly passwordService: AdminPasswordService,
    private readonly jwtService: JwtService,
    @Inject(ADMIN_LOGIN_RATE_LIMIT_STORE) private readonly rateLimit: AdminLoginRateLimitStore,
  ) {}

  async ensureInitialAdmin(username: string, password: string): Promise<{ id: string; username: string }> {
    const existing = await this.repository.findByUsername(username)
    if (existing) return this.toPublicAdmin(existing)

    const passwordHash = await this.passwordService.hash(password)
    return this.toPublicAdmin(await this.repository.create({ username, passwordHash }))
  }

  async login(username: string, password: string, ip: string): Promise<{ token: string; admin: { id: string; username: string } }> {
    const rateLimitKeys = [`account:${username}`, `ip:${ip || 'unknown'}`]
    for (const key of rateLimitKeys) await this.rateLimit.assertAllowed(key)

    const admin = await this.repository.findByUsername(username)
    if (!admin || !(await this.passwordService.verify(password, admin.passwordHash))) {
      for (const key of rateLimitKeys) await this.rateLimit.recordFailure(key)
      throw new BusinessException(40101, '管理员账号或密码错误', HttpStatus.UNAUTHORIZED)
    }

    for (const key of rateLimitKeys) await this.rateLimit.reset(key)
    return {
      token: await this.jwtService.signAsync({ sub: admin.id, username: admin.username, role: 'admin' }),
      admin: this.toPublicAdmin(admin),
    }
  }

  private toPublicAdmin(admin: AdminAccountRecord): { id: string; username: string } {
    return { id: admin.id, username: admin.username }
  }
}
