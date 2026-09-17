import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import type { AdminLoginRateLimitStore } from '../admin/admin-login-rate-limit.store'
import type { UserEntity } from '../users/user.entity'
import { USERS_REPOSITORY, type UsersRepository } from '../users/users.repository'

import { SMS_CODE_STORE, type SmsCodeStore } from './sms-code.store'
import { SMS_PROVIDER, type SmsProvider } from './sms-provider'
import { BusinessException } from '../common/business.exception'

export const SMS_LOGIN_RATE_LIMIT = Symbol('SMS_LOGIN_RATE_LIMIT')

export interface PublicUser {
  id: string
  phone: string
  nickname: string
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(SMS_CODE_STORE) private readonly smsCodeStore: SmsCodeStore,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(SMS_LOGIN_RATE_LIMIT) private readonly rateLimit: AdminLoginRateLimitStore,
    private readonly jwtService: JwtService,
  ) {}

  async sendSmsCode(phone: string, ip: string): Promise<void> {
    // 已禁用账号直接拒绝发码（新手机号不存在用户记录，不受影响）
    const existing = await this.usersRepository.findByPhone(phone)
    if (existing?.disabled) throw new BusinessException(40301, '账号已被禁用，请联系客服', HttpStatus.FORBIDDEN)
    const code = await this.smsCodeStore.issue(phone, ip)
    await this.smsProvider.send(phone, code)
  }

  async login(phone: string, code: string, ip = ''): Promise<{ token: string; user: PublicUser }> {
    // 复审 R01：单码 5 次尝试之外，再按手机号 + 来源 IP 双维度限速，防在线猜测
    const rateLimitKeys = [`sms-login-phone:${phone}`, `sms-login-ip:${ip || 'unknown'}`]
    for (const key of rateLimitKeys) await this.rateLimit.assertAllowed(key)
    try {
      await this.smsCodeStore.verify(phone, code)
    } catch (error) {
      if (error instanceof BusinessException && error.code === 40004) {
        for (const key of rateLimitKeys) await this.rateLimit.recordFailure(key)
      }
      throw error
    }
    // 双保险：禁用后旧验证码也不能换 token（发码环节已拦截，这里挡禁用前已发出的验证码）
    const existing = await this.usersRepository.findByPhone(phone)
    if (existing?.disabled) throw new BusinessException(40301, '账号已被禁用，请联系客服', HttpStatus.FORBIDDEN)
    const user = existing ?? (await this.usersRepository.create(phone))
    for (const key of rateLimitKeys) await this.rateLimit.reset(key)

    return {
      token: await this.jwtService.signAsync({ sub: user.id, phone: user.phone }),
      user: this.toPublicUser(user),
    }
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(userId)
    if (!user) throw new BusinessException(40101, '登录已过期，请重新登录', HttpStatus.UNAUTHORIZED)
    return this.toPublicUser(user)
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return { id: user.id, phone: `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`, nickname: user.nickname }
  }
}
