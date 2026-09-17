import { JwtService } from '@nestjs/jwt'

import { AdminAuthService } from './admin-auth.service'
import { AdminPasswordService } from './password.service'
import { InMemoryAdminLoginRateLimitStore } from './admin-login-rate-limit.store'
import type { AdminAccountRecord } from './admin-accounts.repository'

const baseRecord = (overrides: Partial<AdminAccountRecord> = {}): AdminAccountRecord => ({
  id: 'admin-1',
  username: 'operator',
  passwordHash: '',
  role: 'admin',
  disabled: false,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('AdminAuthService', () => {
  const passwordService = new AdminPasswordService()
  const createRateLimit = () => new InMemoryAdminLoginRateLimitStore(3, 60_000)

  it('仅在管理员不存在时以密码哈希创建初始账号，且角色为超级管理员', async () => {
    const created: Array<{ username: string; passwordHash: string; role?: 'super' | 'admin' }> = []
    const repository = {
      findByUsername: async () => null,
      create: async (input: { username: string; passwordHash: string; role?: 'super' | 'admin' }) => {
        created.push(input)
        return baseRecord({ ...input, role: input.role ?? 'admin' })
      },
      findById: async () => null,
      listAll: async () => [],
      update: async () => undefined,
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

    await expect(service.ensureInitialAdmin('operator', 'AdminPass!2026')).resolves.toEqual({ id: 'admin-1', username: 'operator' })
    expect(created).toHaveLength(1)
    expect(created[0].passwordHash).not.toContain('AdminPass!2026')
    expect(created[0].role).toBe('super')
  })

  it('用正确密码签发不含密码的管理员登录结果，响应带角色与改密标记', async () => {
    const passwordHash = await passwordService.hash('AdminPass!2026')
    const repository = {
      findByUsername: async () => baseRecord({ passwordHash, role: 'super', mustChangePassword: true }),
      create: async () => {
        throw new Error('不应创建管理员')
      },
      findById: async () => null,
      listAll: async () => [],
      update: async () => undefined,
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

    const result = await service.login('operator', 'AdminPass!2026', '127.0.0.1')

    expect(result.token).toEqual(expect.any(String))
    expect(result.admin).toEqual({ id: 'admin-1', username: 'operator', role: 'super', mustChangePassword: true })
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('已禁用账号即使密码正确也拒绝登录（40301）', async () => {
    const passwordHash = await passwordService.hash('AdminPass!2026')
    const repository = {
      findByUsername: async () => baseRecord({ passwordHash, disabled: true }),
      create: async () => {
        throw new Error('不应创建管理员')
      },
      findById: async () => null,
      listAll: async () => [],
      update: async () => undefined,
    }
    const service = new AdminAuthService(repository, passwordService, new JwtService({ secret: 'test-admin-jwt-secret' }), createRateLimit())

    await expect(service.login('operator', 'AdminPass!2026', '127.0.0.1')).rejects.toMatchObject({ code: 40301 })
  })

  it('连续失败达到上限后锁定账号与 IP，期间正确密码也被拒绝', async () => {
    const passwordHash = await passwordService.hash('AdminPass!2026')
    const repository = {
      findByUsername: async (username: string) => (username === 'operator' ? baseRecord({ passwordHash }) : null),
      create: async () => {
        throw new Error('不应创建管理员')
      },
      findById: async () => null,
      listAll: async () => [],
      update: async () => undefined,
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
      findByUsername: async () => baseRecord({ passwordHash }),
      create: async () => {
        throw new Error('不应创建管理员')
      },
      findById: async () => null,
      listAll: async () => [],
      update: async () => undefined,
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
