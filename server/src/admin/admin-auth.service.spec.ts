import { JwtService } from '@nestjs/jwt'

import { AdminAuthService } from './admin-auth.service'
import { AdminPasswordService } from './password.service'
import { InMemoryAdminLoginRateLimitStore } from './admin-login-rate-limit.store'

describe('AdminAuthService', () => {
  const passwordService = new AdminPasswordService()
  const createRateLimit = () => new InMemoryAdminLoginRateLimitStore(3, 60_000)

  it('仅在管理员不存在时以密码哈希创建初始账号', async () => {
    const created: Array<{ username: string; passwordHash: string }> = []
    const repository = {
      findByUsername: async () => null,
      create: async (input: { username: string; passwordHash: string }) => {
        created.push(input)
        return { id: 'admin-1', ...input, createdAt: new Date(), updatedAt: new Date() }
      },
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

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
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

    const result = await service.login('operator', 'AdminPass!2026', '127.0.0.1')

    expect(result.token).toEqual(expect.any(String))
    expect(result.admin).toEqual({ id: 'admin-1', username: 'operator' })
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('连续失败达到上限后锁定账号与 IP，期间正确密码也被拒绝', async () => {
    const passwordHash = await passwordService.hash('AdminPass!2026')
    const repository = {
      findByUsername: async (username: string) =>
        username === 'operator' ? { id: 'admin-1', username, passwordHash, createdAt: new Date(), updatedAt: new Date() } : null,
      create: async () => {
        throw new Error('不应创建管理员')
      },
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.login('operator', 'WrongPass!2026', '10.0.0.1')).rejects.toMatchObject({ code: 40101 })
    }
    await expect(service.login('operator', 'AdminPass!2026', '10.0.0.1')).rejects.toMatchObject({ code: 40005 })
    // 账号维度与 IP 维度各自独立锁定
    await expect(service.login('operator', 'AdminPass!2026', '10.0.0.2')).rejects.toMatchObject({ code: 40005 })
  })

  it('登录成功后清空该账号与 IP 的失败计数', async () => {
    const passwordHash = await passwordService.hash('AdminPass!2026')
    const repository = {
      findByUsername: async () => ({ id: 'admin-1', username: 'operator', passwordHash, createdAt: new Date(), updatedAt: new Date() }),
      create: async () => {
        throw new Error('不应创建管理员')
      },
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

    await expect(service.login('operator', 'WrongPass!2026', '10.0.0.1')).rejects.toMatchObject({ code: 40101 })
    await expect(service.login('operator', 'WrongPass!2026', '10.0.0.1')).rejects.toMatchObject({ code: 40101 })
    await expect(service.login('operator', 'AdminPass!2026', '10.0.0.1')).resolves.toMatchObject({ admin: { username: 'operator' } })
    // 计数已重置：再失败两次仍不触发上限 3
    await expect(service.login('operator', 'WrongPass!2026', '10.0.0.1')).rejects.toMatchObject({ code: 40101 })
    await expect(service.login('operator', 'WrongPass!2026', '10.0.0.1')).rejects.toMatchObject({ code: 40101 })
    await expect(service.login('operator', 'AdminPass!2026', '10.0.0.1')).resolves.toMatchObject({ admin: { username: 'operator' } })
  })
})
