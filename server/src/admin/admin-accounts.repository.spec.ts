import { InMemoryAdminAccountsRepository } from './admin-accounts.repository'

describe('InMemoryAdminAccountsRepository', () => {
  it('按用户名保存并读取管理员账号', async () => {
    const repository = new InMemoryAdminAccountsRepository()

    const created = await repository.create({ username: 'operator', passwordHash: 'scrypt$hash' })

    await expect(repository.findByUsername('operator')).resolves.toEqual(created)
  })
})
