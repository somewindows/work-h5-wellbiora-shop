import { Controller, Get, Query, UseGuards } from '@nestjs/common'

import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AuditLogService } from './audit-log.service'
import type { AuditLogRecord } from './audit-log.repository'
import { AuditLogQueryDto } from './dto/audit-log-query.dto'

@Controller('admin/audit-logs')
@UseGuards(AdminJwtAuthGuard)
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: AuditLogQueryDto): Promise<{ total: number; list: AuditLogRecord[] }> {
    return this.auditLogService.list({
      action: query.action,
      from: query.from,
      to: query.to,
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    })
  }
}
