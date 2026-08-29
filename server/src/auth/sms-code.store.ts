import { randomInt } from 'node:crypto'
import Redis from 'ioredis'
import type { RedisOptions } from 'ioredis'

import { BusinessException } from '../common/business.exception'

export const SMS_CODE_STORE = Symbol('SMS_CODE_STORE')

export interface SmsCodeStore {
  issue(phone: string, ip: string): Promise<string>
  verify(phone: string, code: string): Promise<void>
}

interface CodeEntry {
  code: string
  attempts: number
  expiresAt: number
}

export class MemorySmsCodeStore implements SmsCodeStore {
  private readonly codes = new Map<string, CodeEntry>()
  private readonly phoneCooldowns = new Map<string, number>()
  private readonly ipWindows = new Map<string, { count: number; expiresAt: number }>()

  async issue(phone: string, ip: string): Promise<string> {
    const now = Date.now()
    if ((this.phoneCooldowns.get(phone) ?? 0) > now) {
      throw new BusinessException(40005, '请稍后再试')
    }

    const window = this.ipWindows.get(ip)
    if (window && window.expiresAt > now && window.count >= 10) {
      throw new BusinessException(40005, '请稍后再试')
    }

    this.phoneCooldowns.set(phone, now + 60_000)
    this.ipWindows.set(ip, {
      count: window && window.expiresAt > now ? window.count + 1 : 1,
      expiresAt: now + 60 * 60_000,
    })
    const code = randomInt(100_000, 1_000_000).toString()
    this.codes.set(phone, { code, attempts: 0, expiresAt: now + 5 * 60_000 })
    return code
  }

  async verify(phone: string, code: string): Promise<void> {
    const entry = this.codes.get(phone)
    if (!entry || entry.expiresAt <= Date.now()) {
      this.codes.delete(phone)
      throw new BusinessException(40004, '验证码错误或已过期')
    }

    if (entry.code !== code) {
      entry.attempts += 1
      if (entry.attempts >= 5) this.codes.delete(phone)
      throw new BusinessException(40004, '验证码错误或已过期')
    }

    this.codes.delete(phone)
  }
}

export class RedisSmsCodeStore implements SmsCodeStore {
  private readonly client: Redis

  constructor(redisUrl: string, options?: RedisOptions) {
    this.client = new Redis(redisUrl, options ?? {})
  }

  async issue(phone: string, ip: string): Promise<string> {
    const cooldownKey = `wellbiora:sms:cooldown:${phone}`
    const cooldownSet = await this.client.set(cooldownKey, '1', 'EX', 60, 'NX')
    if (cooldownSet !== 'OK') {
      throw new BusinessException(40005, '请稍后再试')
    }

    const ipKey = `wellbiora:sms:ip:${ip}`
    const ipCount = await this.client.incr(ipKey)
    if (ipCount === 1) await this.client.expire(ipKey, 60 * 60)
    if (ipCount > 10) {
      throw new BusinessException(40005, '请稍后再试')
    }

    const code = randomInt(100_000, 1_000_000).toString()
    await this.client.set(`wellbiora:sms:code:${phone}`, JSON.stringify({ code, attempts: 0 }), 'EX', 5 * 60)
    return code
  }

  async verify(phone: string, code: string): Promise<void> {
    const key = `wellbiora:sms:code:${phone}`
    const serialized = await this.client.get(key)
    if (!serialized) throw new BusinessException(40004, '验证码错误或已过期')

    const entry = JSON.parse(serialized) as { code: string; attempts: number }
    if (entry.code === code) {
      await this.client.del(key)
      return
    }

    entry.attempts += 1
    if (entry.attempts >= 5) {
      await this.client.del(key)
    } else {
      const ttl = await this.client.ttl(key)
      if (ttl > 0) await this.client.set(key, JSON.stringify(entry), 'EX', ttl)
    }
    throw new BusinessException(40004, '验证码错误或已过期')
  }

  async close(): Promise<void> {
    await this.client.quit()
  }
}
