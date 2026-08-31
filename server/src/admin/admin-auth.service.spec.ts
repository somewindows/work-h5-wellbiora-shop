import { JwtService } from '@nestjs/jwt'

import { AdminAuthService } from './admin-auth.service'
import { AdminPasswordService } from './password.service'

describe('AdminAuthService', () => {
  const passwordService = new AdminPasswordService()

  it('仅在管理员不存在时以密码哈希创建初始账号', async () => {
    const created: Array<{ username: string; passwordHash: string }> = []
    const repository = {
      findByUsername: async () => null,
      create: async (input: { username: string; passwordHash: string }) => {
        created.push(input)
        return { id: 'admin-1', ...input, createdAt: new Date(), updatedAt: new Date() }
      },
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }))

    await expect(service.ensureInitialAdmin('operator', 'AdminPass!2026')).resolves.toEqual({ id: 'admin-1', username: 'operator' })
    expect(created).toHaveLength(1)
    expect(created[0].passwordHash).not.toContain('AdminPass!2026')
  })

  it('用正确密码签发不含密码的管理员登录结果', async () => {
    const passwordHash = await passwordService.hash('AdminPass!2026')
    const repository = {
      findByUsername: async () => ({ id: 'admin-1', username: 'operator', passwordHash, createdAt: new Date(), updatedAt: new Date() }),
      create: async () => {
        throw new Error('不应创建管理员')
      },
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }))

    const result = await service.login('operator', 'AdminPass!2026')

    expect(result.token).toEqual(expect.any(String))
    expect(result.admin).toEqual({ id: 'admin-1', username: 'operator' })
    expect(result).not.toHaveProperty('passwordHash')
  })
})
