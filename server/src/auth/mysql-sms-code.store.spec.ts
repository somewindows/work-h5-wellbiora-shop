import type { DataSource, EntityManager } from 'typeorm'

import { MySqlSmsCodeStore } from './mysql-sms-code.store'

describe('MySqlSmsCodeStore', () => {
  /** 无真实 MySQL 的内存替身：事务直接执行回调（无回滚语义），记录按手机号存取 */
  function createHarness() {
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
    return { records, store: new MySqlSmsCodeStore(dataSource) }
  }

  it('只持久化验证码哈希，并在验证成功后删除验证码记录', async () => {
    const { records, store } = createHarness()

    const code = await store.issue('13888888888', '127.0.0.1')
    const record = records.get('13888888888')

    expect(record?.codeHash).not.toBe(code)
    await expect(store.verify('13888888888', code)).resolves.toBeUndefined()
    expect(records.has('13888888888')).toBe(false)
  })

  // 复审 R01：失败计数必须先提交再抛业务异常；真实 MySQL 的持久化与行锁行为仍需按验收项在真库复测
  it('错误验证的计数在抛出业务异常后仍然保留，第五次后验证码作废', async () => {
    const { records, store } = createHarness()
    const code = await store.issue('13888888888', '127.0.0.1')

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(store.verify('13888888888', '000000')).rejects.toMatchObject({ code: 40004 })
      expect(records.get('13888888888')?.attempts).toBe(attempt)
    }
    await expect(store.verify('13888888888', '000000')).rejects.toMatchObject({ code: 40004 })
    expect(records.has('13888888888')).toBe(false)

    // 作废后即使输入正确验证码也不能登录
    await expect(store.verify('13888888888', code)).rejects.toMatchObject({ code: 40004 })
  })
})
