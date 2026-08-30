import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('购物车 mock 数据', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_USE_MOCK', '1')
  })

  it('修改数量时返回新数组，触发 Pinia 合计重新计算', async () => {
    const { getCart, updateCartItem } = await import('./index')
    const initial = await getCart()
    const updated = await updateCartItem('c2', { quantity: 3 })

    expect(initial.find((item) => item.id === 'c2')?.quantity).toBe(2)
    expect(updated).not.toBe(initial)
    expect(updated.find((item) => item.id === 'c2')?.quantity).toBe(3)
  })
})
