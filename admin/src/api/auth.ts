import { request } from './request'

/** 管理员登录（唯一不需要 Bearer 的接口；限频/密码错误都在 message 里） */
export function adminLogin(username: string, password: string): Promise<{ token: string; admin: { id: string; username: string } }> {
  return request.post('/admin/auth/login', { username, password })
}
