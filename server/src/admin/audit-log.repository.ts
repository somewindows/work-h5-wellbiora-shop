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

export interface AuditLogPageQuery {
  action?: string
  from?: Date
  to?: Date
  page: number
  pageSize: number
}

export interface AuditLogRepository {
  save(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogRecord>
  findByTarget(targetType: string, targetId: string): Promise<AuditLogRecord[]>
  findPage(query: AuditLogPageQuery): Promise<{ total: number; list: AuditLogRecord[] }>
}

@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(@InjectRepository(AuditLogEntity) private readonly repository: Repository<AuditLogEntity>) {}
  save(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<AuditLogEntity> { return this.repository.save(this.repository.create(input)) }
  findByTarget(targetType: string, targetId: string): Promise<AuditLogEntity[]> { return this.repository.find({ where: { targetType, targetId }, order: { createdAt: 'ASC' } }) }
  async findPage(query: AuditLogPageQuery): Promise<{ total: number; list: AuditLogEntity[] }> {
    const builder = this.repository.createQueryBuilder('log').orderBy('log.created_at', 'DESC')
    if (query.action) builder.andWhere('log.action = :action', { action: query.action })
    if (query.from) builder.andWhere('log.created_at >= :from', { from: query.from })
    if (query.to) builder.andWhere('log.created_at <= :to', { to: query.to })
    const [list, total] = await builder.skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount()
    return { total, list }
  }
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
  async findPage(query: AuditLogPageQuery): Promise<{ total: number; list: AuditLogRecord[] }> {
    const filtered = this.logs
      .filter((log) =>
        (!query.action || log.action === query.action) &&
        (!query.from || log.createdAt >= query.from) &&
        (!query.to || log.createdAt <= query.to))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    const start = (query.page - 1) * query.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + query.pageSize).map((log) => structuredClone(log)) }
  }
}
