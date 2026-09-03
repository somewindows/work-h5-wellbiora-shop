import { DataSource } from 'typeorm'

import { BusinessException } from '../common/business.exception'

import { AdminLoginRateLimitEntity } from './admin-login-rate-limit.entity'

export const ADMIN_LOGIN_RATE_LIMIT_STORE = Symbol('ADMIN_LOGIN_RATE_LIMIT_STORE')

/**
 * 管理员登录失败限频：同一维度（IP 或账号）在窗口内连续失败达到上限后锁定一段时间。
 * 维度键形如 `account:<username>` / `ip:<ip>`。
 */
export interface AdminLoginRateLimitStore {
  /** 已锁定时抛出 40005 */
  assertAllowed(key: string): Promise<void>
  recordFailure(key: string): Promise<void>
  reset(key: string): Promise<void>
}

interface RateLimitEntry {
  failCount: number
  windowExpiresAt: number
  lockedUntil: number
}

export class InMemoryAdminLoginRateLimitStore implements AdminLoginRateLimitStore {
  private readonly entries = new Map<string, RateLimitEntry>()

  constructor(
    private readonly maxFailures = 5,
    private readonly lockMs = 10 * 60_000,
  ) {}

  async assertAllowed(key: string): Promise<void> {
    const entry = this.entries.get(key)
    if (entry && entry.lockedUntil > Date.now()) {
      throw new BusinessException(40005, '登录尝试次数过多，请稍后再试')
    }
  }

  async recordFailure(key: string): Promise<void> {
    const now = Date.now()
    const entry = this.entries.get(key)
    if (entry && entry.lockedUntil > now) return
    if (!entry || entry.windowExpiresAt <= now) {
      this.entries.set(key, { failCount: 1, windowExpiresAt: now + this.lockMs, lockedUntil: 0 })
      return
    }
    entry.failCount += 1
    if (entry.failCount >= this.maxFailures) {
      entry.lockedUntil = now + this.lockMs
      entry.windowExpiresAt = entry.lockedUntil
      entry.failCount = 0
    }
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key)
  }
}

export class MySqlAdminLoginRateLimitStore implements AdminLoginRateLimitStore {
  constructor(
    private readonly dataSource: DataSource,
    private readonly maxFailures = 5,
    private readonly lockMs = 10 * 60_000,
  ) {}

  async assertAllowed(key: string): Promise<void> {
    const record = await this.dataSource.getRepository(AdminLoginRateLimitEntity).findOneBy({ key })
    if (record?.lockedUntil && record.lockedUntil > new Date()) {
      throw new BusinessException(40005, '登录尝试次数过多，请稍后再试')
    }
  }

  async recordFailure(key: string): Promise<void> {
    const now = new Date()
    await this.dataSource.transaction(async (manager) => {
      const record = await manager.findOne(AdminLoginRateLimitEntity, {
        where: { key },
        lock: { mode: 'pessimistic_write' },
      })
      if (record?.lockedUntil && record.lockedUntil > now) return

      const inCurrentWindow = record && record.windowExpiresAt > now
      const failCount = inCurrentWindow ? record.failCount + 1 : 1
      const locked = failCount >= this.maxFailures
      const lockedUntil = locked ? new Date(now.getTime() + this.lockMs) : null
      const entity = Object.assign(record ?? manager.create(AdminLoginRateLimitEntity), {
        key,
        failCount: locked ? 0 : failCount,
        windowExpiresAt: lockedUntil ?? new Date(now.getTime() + this.lockMs),
        lockedUntil,
      })
      await manager.save(AdminLoginRateLimitEntity, entity)
    })
  }

  async reset(key: string): Promise<void> {
    await this.dataSource.getRepository(AdminLoginRateLimitEntity).delete({ key })
  }
}
