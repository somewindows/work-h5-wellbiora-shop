import { JwtService } from '@nestjs/jwt'

import { InMemoryAdminLoginRateLimitStore } from '../admin/admin-login-rate-limit.store'
import { BusinessException } from '../common/business.exception'
import { InMemoryUsersRepository } from '../users/users.repository'

import { AuthService } from './auth.service'
import { MemorySmsCodeStore } from './sms-code.store'
import { MemorySmsProvider, UnconfiguredSmsProvider } from './sms-provider'

describe('AuthService', () => {
  let store: MemorySmsCodeStore
  let provider: MemorySmsProvider
  let users: InMemoryUsersRepository
  let service: AuthService

  beforeEach(() => {
    store = new MemorySmsCodeStore()
    provider = new MemorySmsProvider()
    users = new InMemoryUsersRepository()
    service = new AuthService(
      users,
      store,
      provider,
      new InMemoryAdminLoginRateLimitStore(),
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

  it('同一手机号连续输错达到上限后锁定，正确验证码也返回 40005（复审 R01）', async () => {
    const strictService = new AuthService(
      new InMemoryUsersRepository(),
      store,
      provider,
      new InMemoryAdminLoginRateLimitStore(3, 10 * 60_000),
      new JwtService({ secret: 'test-only-jwt-secret' }),
    )
    await strictService.sendSmsCode('13888888888', '127.0.0.1')

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(strictService.login('13888888888', '000000', '127.0.0.1')).rejects.toMatchObject({ code: 40004 })
    }
    await expect(strictService.login('13888888888', provider.lastCode, '127.0.0.1')).rejects.toMatchObject({
      code: 40005,
    } satisfies Partial<BusinessException>)
  })

  it('未配置短信服务商时不伪造发送成功', async () => {
    await expect(new UnconfiguredSmsProvider().send()).rejects.toMatchObject({
      code: 50001,
      message: '短信服务尚未配置',
    } satisfies Partial<BusinessException>)
  })

  it('已禁用用户拒绝发送验证码（40301），新手机号不受影响', async () => {
    const disabledUser = await users.create('13666666666')
    await users.setDisabled(disabledUser.id, true)

    await expect(service.sendSmsCode('13666666666', '127.0.0.1')).rejects.toMatchObject({
      code: 40301,
      message: '账号已被禁用，请联系客服',
    } satisfies Partial<BusinessException>)
    // 未注册的新手机号照常发码
    await expect(service.sendSmsCode('13777777777', '127.0.0.1')).resolves.toBeUndefined()
  })

  it('已禁用用户持旧验证码登录被拒绝（双保险）', async () => {
    await users.create('13666666666')
    await service.sendSmsCode('13666666666', '127.0.0.1')
    const user = await users.findByPhone('13666666666')
    await users.setDisabled(user!.id, true)

    await expect(service.login('13666666666', provider.lastCode)).rejects.toMatchObject({
      code: 40301,
    } satisfies Partial<BusinessException>)
  })
})
