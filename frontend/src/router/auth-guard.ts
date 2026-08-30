/** 路由鉴权的纯决策逻辑，便于脱离浏览器环境回归测试。 */
interface GuardRoute {
  fullPath: string
  matched: ReadonlyArray<{ meta: Record<string, unknown> }>
}

interface LoginRedirect {
  name: 'login'
  query: { from: string }
}

/** 未登录访问需鉴权页面时，返回登录页及原始站内路径。 */
export function getAuthRedirect(route: GuardRoute, isLoggedIn: boolean): LoginRedirect | undefined {
  const requiresAuth = route.matched.some((record) => record.meta.requiresAuth === true)

  if (!requiresAuth || isLoggedIn) return undefined

  return {
    name: 'login',
    query: { from: route.fullPath },
  }
}
