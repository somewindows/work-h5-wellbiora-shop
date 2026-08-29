import { JwtService } from '@nestjs/jwt'

import { BusinessException } from '../common/business.exception'
import { InMemoryUsersRepository } from '../users/users.repository'

import { AuthService } from './auth.service'
import { MemorySmsCodeStore } from './sms-code.store'
import { MemorySmsProvider, UnconfiguredSmsProvider } from './sms-provider'

describe('AuthService', () => {
  let store: MemorySmsCodeStore
  let provider: MemorySmsProvider
  let service: AuthService

  beforeEach(() => {
    store = new MemorySmsCodeStore()
    provider = new MemorySmsProvider()
    service = new AuthService(
      new InMemoryUsersRepository(),
      store,
      provider,
      new JwtService({ secret: 'test-only-jwt-secret' }),
    )
  })

  it('验证正确验证码后创建用户，并返回脱敏手机号和 JWT', async () => {
    await service.sendSmsCode('13888888888', '127.0.0.1')
    const result = await service.login('13888888888', provider.lastCode)

    expect(result).toMatchObject({
      token: expect.any(String),
      user: { phone: '138****8888', nickname: 'WELLBIORA 会员' },
    })
  })

  it('拒绝错误验证码，且不创建用户', async () => {
    await service.sendSmsCode('13888888888', '127.0.0.1')

    await expect(service.login('13888888888', '000000')).rejects.toMatchObject({
      code: 40004,
      message: '验证码错误或已过期',
    } satisfies Partial<BusinessException>)
  })

  it('在冷却窗口内拒绝向同一手机号重复发送验证码', async () => {
    await service.sendSmsCode('13888888888', '127.0.0.1')

    await expect(service.sendSmsCode('13888888888', '127.0.0.1')).rejects.toMatchObject({
      code: 40005,
      message: '请稍后再试',
    } satisfies Partial<BusinessException>)
  })

  it('未配置短信服务商时不伪造发送成功', async () => {
    await expect(new UnconfiguredSmsProvider().send()).rejects.toMatchObject({
      code: 50001,
      message: '短信服务尚未配置',
    } satisfies Partial<BusinessException>)
  })
})
