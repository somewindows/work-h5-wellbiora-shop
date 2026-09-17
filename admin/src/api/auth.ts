import type { AdminRole } from '@/types'

import { request } from './request'

export interface AdminLoginResult {
  token: string
  admin: { id: string; username: string; role: AdminRole; mustChangePassword: boolean }
}

/** 管理员登录（唯一不需要 Bearer 的接口；限频/密码错误都在 message 里） */
export function adminLogin(username: string, password: string): Promise<AdminLoginResult> {
  return request.post('/admin/auth/login', { username, password })
}

/** 修改自己的密码（强制改密期间唯一可用的接口） */
export function changePassword(oldPassword: string, newPassword: string): Promise<{ changed: true }> {
  return request.post('/admin/auth/change-password', { oldPassword, newPassword })
}
