import type { ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { InMemoryAdminAccountsRepository } from './admin-accounts.repository'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'

describe('AdminJwtAuthGuard', () => {
  let accounts: InMemoryAdminAccountsRepository

  beforeEach(() => {
    accounts = new InMemoryAdminAccountsRepository()
  })

  function createGuard(payload: Record<string, unknown> | Error): AdminJwtAuthGuard {
    const jwt = {
      verifyAsync: payload instanceof Error ? jest.fn().mockRejectedValue(payload) : jest.fn().mockResolvedValue(payload),
    } as unknown as JwtService
    return new AdminJwtAuthGuard(jwt, accounts)
  }

  function requestOf(url = '/api/v1/admin/accounts'): { headers: Record<string, string>; url: string; admin?: unknown } {
    return { headers: { authorization: 'Bearer valid-token' }, url }
  }

  it('缺少 Bearer token 时返回未登录错误', async () => {
    const guard = createGuard({ sub: 'admin-1', username: 'operator', role: 'admin' })
    const request = { headers: {} as Record<string, string>, url: '/api/v1/admin/accounts' }

    await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ code: 40101 })
  })

  it('验证通过后回查库并把角色/改密标记挂到请求对象', async () => {
    const account = await accounts.create({ username: 'operator', passwordHash: 'scrypt$hash', role: 'super' })
    const guard = createGuard({ sub: account.id, username: 'operator', role: 'admin' })
    const request = requestOf()

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true)
    expect(request.admin).toEqual({ id: account.id, username: 'operator', role: 'super', mustChangePassword: false })
  })

  it('token 对应的管理员不存在时按登录过期处理（40101）', async () => {
    const guard = createGuard({ sub: 'ghost-admin', username: 'operator', role: 'admin' })

    await expect(guard.canActivate(httpContext(requestOf()))).rejects.toMatchObject({ code: 40101 })
  })

  it('已禁用管理员持有效 token 访问立即失效（40101）', async () => {
    const account = await accounts.create({ username: 'operator', passwordHash: 'scrypt$hash' })
    await accounts.update(account.id, { disabled: true })
    const guard = createGuard({ sub: account.id, username: 'operator', role: 'admin' })

    await expect(guard.canActivate(httpContext(requestOf()))).rejects.toMatchObject({ code: 40101 })
  })

  it('强制改密期间访问其他接口被拒绝（40302），仅放行修改密码', async () => {
    const account = await accounts.create({ username: 'operator', passwordHash: 'scrypt$hash', mustChangePassword: true })
    const guard = createGuard({ sub: account.id, username: 'operator', role: 'admin' })

    await expect(guard.canActivate(httpContext(requestOf('/api/v1/admin/accounts')))).rejects.toMatchObject({ code: 40302 })
    await expect(guard.canActivate(httpContext(requestOf('/api/v1/admin/auth/change-password')))).resolves.toBe(true)
  })
})

function httpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}
