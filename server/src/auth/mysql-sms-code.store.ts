import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { DataSource } from 'typeorm'

import { BusinessException } from '../common/business.exception'

import type { SmsCodeStore } from './sms-code.store'
import { SmsIpRateLimitEntity } from './sms-ip-rate-limit.entity'
import { SmsVerificationCodeEntity } from './sms-verification-code.entity'

export class MySqlSmsCodeStore implements SmsCodeStore {
  constructor(private readonly dataSource: DataSource) {}

  async issue(phone: string, ip: string): Promise<string> {
    const now = new Date()
    const code = randomInt(100_000, 1_000_000).toString()

    return this.dataSource.transaction(async (manager) => {
      const codeRecord = await manager.findOne(SmsVerificationCodeEntity, {
        where: { phone },
        lock: { mode: 'pessimistic_write' },
      })
      if (codeRecord && codeRecord.cooldownUntil > now) {
        throw new BusinessException(40005, '请稍后再试')
      }

      const ipRecord = await manager.findOne(SmsIpRateLimitEntity, {
        where: { ip },
        lock: { mode: 'pessimistic_write' },
      })
      const inCurrentWindow = ipRecord && ipRecord.windowExpiresAt > now
      if (inCurrentWindow && ipRecord.sendCount >= 10) {
        throw new BusinessException(40005, '请稍后再试')
      }

      await manager.save(
        SmsIpRateLimitEntity,
        manager.create(SmsIpRateLimitEntity, {
          ...(ipRecord ?? {}),
          ip,
          sendCount: inCurrentWindow ? ipRecord.sendCount + 1 : 1,
          windowExpiresAt: new Date(now.getTime() + 60 * 60_000),
        }),
      )
      await manager.save(
        SmsVerificationCodeEntity,
        manager.create(SmsVerificationCodeEntity, {
          ...(codeRecord ?? {}),
          phone,
          codeHash: this.hash(code),
          attempts: 0,
          expiresAt: new Date(now.getTime() + 5 * 60_000),
          cooldownUntil: new Date(now.getTime() + 60_000),
        }),
      )
      return code
    })
  }

  async verify(phone: string, code: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const record = await manager.findOne(SmsVerificationCodeEntity, {
        where: { phone },
        lock: { mode: 'pessimistic_write' },
      })
      if (!record || record.expiresAt <= new Date()) {
        if (record) await manager.remove(SmsVerificationCodeEntity, record)
        throw new BusinessException(40004, '验证码错误或已过期')
      }

      if (this.hashesMatch(record.codeHash, this.hash(code))) {
        await manager.remove(SmsVerificationCodeEntity, record)
        return
      }

      record.attempts += 1
      if (record.attempts >= 5) {
        await manager.remove(SmsVerificationCodeEntity, record)
      } else {
        await manager.save(SmsVerificationCodeEntity, record)
      }
      throw new BusinessException(40004, '验证码错误或已过期')
    })
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex')
  }

  private hashesMatch(left: string, right: string): boolean {
    return timingSafeEqual(Buffer.from(left), Buffer.from(right))
  }
}
