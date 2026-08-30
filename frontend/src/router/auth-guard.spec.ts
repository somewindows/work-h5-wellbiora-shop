import { describe, expect, it } from 'vitest'
import { getAuthRedirect } from './auth-guard'

describe('getAuthRedirect', () => {
  it('未登录访问受保护路由时跳转登录页并保留完整来源路径', () => {
    const result = getAuthRedirect(
      {
        fullPath: '/orders?status=ship',
        matched: [{ meta: { requiresAuth: true } }],
      },
      false,
    )

    expect(result).toEqual({
      name: 'login',
      query: { from: '/orders?status=ship' },
    })
  })

  it('已登录或访问公开路由时不重定向', () => {
    const protectedRoute = {
      fullPath: '/mine',
      matched: [{ meta: { requiresAuth: true } }],
    }
    const publicRoute = {
      fullPath: '/cart',
      matched: [{ meta: {} }],
    }

    expect(getAuthRedirect(protectedRoute, true)).toBeUndefined()
    expect(getAuthRedirect(publicRoute, false)).toBeUndefined()
  })
})
