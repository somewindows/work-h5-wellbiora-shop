import type { ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { InMemoryUsersRepository } from '../users/users.repository'

import { JwtAuthGuard } from './jwt-auth.guard'

describe('JwtAuthGuard', () => {
  let users: InMemoryUsersRepository

  beforeEach(() => {
    users = new InMemoryUsersRepository()
  })

  function createGuard(payload: Record<string, unknown> | Error): JwtAuthGuard {
    const jwt = {
      verifyAsync: payload instanceof Error ? jest.fn().mockRejectedValue(payload) : jest.fn().mockResolvedValue(payload),
    } as unknown as JwtService
    return new JwtAuthGuard(jwt, users)
  }

  it('缺少 Bearer token 时返回未登录错误', async () => {
    const guard = createGuard({ sub: 'user-1', phone: '13900000000' })
    const request = { headers: {} as Record<string, string> }

    await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ code: 40101 })
  })

  it('验证通过后把用户标识挂到请求对象', async () => {
    const user = await users.create('13900000000')
    const guard = createGuard({ sub: user.id, phone: '13900000000' })
    const request = { headers: { authorization: 'Bearer valid-token' } as Record<string, string>, user: undefined as unknown }

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true)
    expect(request.user).toEqual({ id: user.id, phone: '13900000000' })
  })

  it('token 对应的用户不存在时按登录过期处理', async () => {
    const guard = createGuard({ sub: 'ghost-user', phone: '13900000000' })
    const request = { headers: { authorization: 'Bearer valid-token' } as Record<string, string> }

    await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ code: 40101 })
  })

  it('已禁用用户持有效 token 访问被拒绝（40301）', async () => {
    const user = await users.create('13900000000')
    await users.setDisabled(user.id, true)
    const guard = createGuard({ sub: user.id, phone: '13900000000' })
    const request = { headers: { authorization: 'Bearer valid-token' } as Record<string, string> }

    await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ code: 40301 })
  })
})

function httpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}
