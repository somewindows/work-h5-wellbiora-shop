import type { AdminAccount, AdminAccountWithTempPassword } from '@/types'

import { request } from './request'

/** 以下接口仅超级管理员可用（服务端回查角色，非超管 40302） */

export function listAccounts(): Promise<AdminAccount[]> {
  return request.get('/admin/accounts')
}

/**
 * 新建管理员：confirm:true 只能由二次确认对话框触发；
 * 返回的一次性临时密码仅本次响应可见，必须当场复制给使用人
 */
export function createAccount(username: string): Promise<AdminAccountWithTempPassword> {
  return request.post('/admin/accounts', { username, confirm: true })
}

/** 禁用管理员：confirm:true 只能由二次确认对话框触发；禁用后其登录与已签发 token 立即失效 */
export function disableAccount(id: string): Promise<AdminAccount> {
  return request.post(`/admin/accounts/${id}/disable`, { confirm: true })
}

/** 启用管理员：同禁用，二次确认对话框触发 */
export function enableAccount(id: string): Promise<AdminAccount> {
  return request.post(`/admin/accounts/${id}/enable`, { confirm: true })
}

/** 重置他人密码：返回新一次性临时密码（仅本次可见），该账号首登强制改密 */
export function resetPassword(id: string): Promise<AdminAccountWithTempPassword> {
  return request.post(`/admin/accounts/${id}/reset-password`, { confirm: true })
}
