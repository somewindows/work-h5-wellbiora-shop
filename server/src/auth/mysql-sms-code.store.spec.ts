import type { DataSource, EntityManager } from 'typeorm'

import { MySqlSmsCodeStore } from './mysql-sms-code.store'

describe('MySqlSmsCodeStore', () => {
  it('只持久化验证码哈希，并在验证成功后删除验证码记录', async () => {
    const records = new Map<string, Record<string, unknown>>()
    const manager = {
      findOne: jest.fn(async (_entity: unknown, options: { where: { phone?: string } }) => {
        const phone = options.where.phone
        return phone ? (records.get(phone) ?? null) : null
      }),
      create: jest.fn((_entity: unknown, value: Record<string, unknown>) => value),
      save: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => {
        records.set(value.phone as string, value)
        return value
      }),
      remove: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => {
        records.delete(value.phone as string)
        return value
      }),
    } as unknown as EntityManager
    const dataSource = {
      transaction: async <T>(callback: (transactionManager: EntityManager) => Promise<T>) => callback(manager),
    } as unknown as DataSource
    const store = new MySqlSmsCodeStore(dataSource)

    const code = await store.issue('13888888888', '127.0.0.1')
    const record = records.get('13888888888')

    expect(record?.codeHash).not.toBe(code)
    await expect(store.verify('13888888888', code)).resolves.toBeUndefined()
    expect(records.has('13888888888')).toBe(false)
  })
})
