import type { AdminUserDetail, AdminUserListItem, PageResult } from '@/types'

import { request } from './request'

export interface UserQueryParams {
  /** 手机号模糊匹配 */
  keyword?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export function listUsers(params: UserQueryParams): Promise<PageResult<AdminUserListItem>> {
  return request.get('/admin/users', { params })
}

export function getUserDetail(id: string): Promise<AdminUserDetail> {
  return request.get(`/admin/users/${id}`)
}

/** 禁用用户：confirm:true 只能由二次确认对话框触发，服务端缺省会 40003 拒绝 */
export function disableUser(id: string): Promise<AdminUserDetail> {
  return request.post(`/admin/users/${id}/disable`, { confirm: true })
}

/** 启用用户：同禁用，二次确认对话框触发 */
export function enableUser(id: string): Promise<AdminUserDetail> {
  return request.post(`/admin/users/${id}/enable`, { confirm: true })
}
