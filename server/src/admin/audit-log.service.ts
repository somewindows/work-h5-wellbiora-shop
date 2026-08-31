import { Inject, Injectable } from '@nestjs/common'

import { AUDIT_LOG_REPOSITORY, type AuditLogRecord, type AuditLogRepository } from './audit-log.repository'

export interface AdminActor { id: string; username: string }

@Injectable()
export class AuditLogService {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repository: AuditLogRepository) {}
  record(actor: AdminActor, action: string, targetType: string, targetId: string, beforeData: AuditLogRecord['beforeData'], afterData: AuditLogRecord['afterData']): Promise<AuditLogRecord> {
    return this.repository.save({ adminId: actor.id, adminUsername: actor.username, action, targetType, targetId, beforeData, afterData })
  }
}
