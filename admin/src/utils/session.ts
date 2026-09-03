/**
 * 管理员会话存取：token 只存 sessionStorage（关闭标签页即失效），任何地方不打印 token
 */
const TOKEN_KEY = 'admin_token'
const USERNAME_KEY = 'admin_username'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getAdminUsername(): string {
  return sessionStorage.getItem(USERNAME_KEY) ?? ''
}

export function saveSession(token: string, username: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USERNAME_KEY, username)
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USERNAME_KEY)
}

export function isLoggedIn(): boolean {
  return Boolean(getToken())
}
