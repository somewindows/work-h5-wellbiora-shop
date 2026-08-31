import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { AuditLogEntity } from './audit-log.entity'

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY')

export interface AuditLogRecord {
  id: string
  adminId: string
  adminUsername: string
  action: string
  targetType: string
  targetId: string
  beforeData: Record<string, unknown> | Record<string, unknown>[] | null
  afterData: Record<string, unknown> | Record<string, unknown>[] | null
  createdAt: Date
}

export interface AuditLogRepository {
  save(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord>
  findByTarget(targetType: string, targetId: string): Promise<AuditLogRecord[]>
}

@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(@InjectRepository(AuditLogEntity) private readonly repository: Repository<AuditLogEntity>) {}
  save(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogEntity> { return this.repository.save(this.repository.create(input)) }
  findByTarget(targetType: string, targetId: string): Promise<AuditLogEntity[]> { return this.repository.find({ where: { targetType, targetId }, order: { createdAt: 'ASC' } }) }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly logs: AuditLogRecord[] = []
  async save(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord> {
    const saved: AuditLogRecord = { id: randomUUID(), createdAt: new Date(), ...structuredClone(input) }
    this.logs.push(saved)
    return structuredClone(saved)
  }
  async findByTarget(targetType: string, targetId: string): Promise<AuditLogRecord[]> {
    return this.logs.filter((log) => log.targetType === targetType && log.targetId === targetId).map((log) => structuredClone(log))
  }
}
