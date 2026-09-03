import type { AuditLogRecord, PageResult } from '@/types'

import { request } from './request'

export interface AuditLogQueryParams {
  action?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export function listAuditLogs(params: AuditLogQueryParams): Promise<PageResult<AuditLogRecord>> {
  return request.get('/admin/audit-logs', { params })
}
