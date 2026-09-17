/**
 * 管理员会话存取：token 只存 sessionStorage（关闭标签页即失效），任何地方不打印 token
 * 角色与强制改密标记随登录响应一并保存，供路由守卫与菜单渲染判断（最终以服务端回查为准）
 */
const TOKEN_KEY = 'admin_token'
const USERNAME_KEY = 'admin_username'
const ROLE_KEY = 'admin_role'
const MUST_CHANGE_PASSWORD_KEY = 'admin_must_change_password'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getAdminUsername(): string {
  return sessionStorage.getItem(USERNAME_KEY) ?? ''
}

export function getAdminRole(): string {
  return sessionStorage.getItem(ROLE_KEY) ?? ''
}

export function getMustChangePassword(): boolean {
  return sessionStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === '1'
}

export function saveSession(token: string, username: string, role: string, mustChangePassword: boolean): void {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USERNAME_KEY, username)
  sessionStorage.setItem(ROLE_KEY, role)
  sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, mustChangePassword ? '1' : '0')
}

/** 改密成功后清除强制改密标记（不中断当前会话） */
export function clearMustChangePassword(): void {
  sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, '0')
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USERNAME_KEY)
  sessionStorage.removeItem(ROLE_KEY)
  sessionStorage.removeItem(MUST_CHANGE_PASSWORD_KEY)
}

export function isLoggedIn(): boolean {
  return Boolean(getToken())
}
