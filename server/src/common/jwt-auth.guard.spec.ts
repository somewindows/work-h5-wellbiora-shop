import type { ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { JwtAuthGuard } from './jwt-auth.guard'

describe('JwtAuthGuard', () => {
  it('缺少 Bearer token 时返回未登录错误', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: jest.fn() } as unknown as JwtService)
    const request = { headers: {} as Record<string, string> }

    await expect(guard.canActivate(httpContext(request))).rejects.toMatchObject({ code: 40101 })
  })

  it('验证通过后把用户标识挂到请求对象', async () => {
    const guard = new JwtAuthGuard({ verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', phone: '13900000000' }) } as unknown as JwtService)
    const request = { headers: { authorization: 'Bearer valid-token' } as Record<string, string>, user: undefined as unknown }

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true)
    expect(request.user).toEqual({ id: 'user-1', phone: '13900000000' })
  })
})

function httpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}
