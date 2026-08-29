import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import type { UserEntity } from '../users/user.entity'
import { USERS_REPOSITORY, type UsersRepository } from '../users/users.repository'

import { SMS_CODE_STORE, type SmsCodeStore } from './sms-code.store'
import { SMS_PROVIDER, type SmsProvider } from './sms-provider'

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
    private readonly jwtService: JwtService,
  ) {}

  async sendSmsCode(phone: string, ip: string): Promise<void> {
    const code = await this.smsCodeStore.issue(phone, ip)
    await this.smsProvider.send(phone, code)
  }

  async login(phone: string, code: string): Promise<{ token: string; user: PublicUser }> {
    await this.smsCodeStore.verify(phone, code)
    const user = (await this.usersRepository.findByPhone(phone)) ?? (await this.usersRepository.create(phone))

    return {
      token: await this.jwtService.signAsync({ sub: user.id, phone: user.phone }),
      user: this.toPublicUser(user),
    }
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return { id: user.id, phone: `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`, nickname: user.nickname }
  }
}
