import { InMemoryAdminLoginRateLimitStore } from './admin-login-rate-limit.store'

describe('InMemoryAdminLoginRateLimitStore', () => {
  it('窗口内失败达到上限后锁定，锁定期满自动解除', async () => {
    const store = new InMemoryAdminLoginRateLimitStore(2, 50)

    await store.recordFailure('ip:1.1.1.1')
    await expect(store.assertAllowed('ip:1.1.1.1')).resolves.toBeUndefined()
    await store.recordFailure('ip:1.1.1.1')
    await expect(store.assertAllowed('ip:1.1.1.1')).rejects.toMatchObject({ code: 40005 })

    await new Promise((resolve) => setTimeout(resolve, 60))
    await expect(store.assertAllowed('ip:1.1.1.1')).resolves.toBeUndefined()
  })

  it('reset 清除失败计数', async () => {
    const store = new InMemoryAdminLoginRateLimitStore(2, 60_000)

    await store.recordFailure('account:root')
    await store.reset('account:root')
    await store.recordFailure('account:root')

    await expect(store.assertAllowed('account:root')).resolves.toBeUndefined()
  })
})
