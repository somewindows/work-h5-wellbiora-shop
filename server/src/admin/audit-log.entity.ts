import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'admin_audit_logs' })
@Index(['targetType', 'targetId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'admin_id', length: 36 }) adminId!: string
  @Column({ name: 'admin_username', length: 64 }) adminUsername!: string
  @Column({ length: 32 }) action!: string
  @Column({ name: 'target_type', length: 32 }) targetType!: string
  @Column({ name: 'target_id', length: 64 }) targetId!: string
  @Column({ name: 'before_data', type: 'json', nullable: true }) beforeData!: Record<string, unknown> | Record<string, unknown>[] | null
  @Column({ name: 'after_data', type: 'json', nullable: true }) afterData!: Record<string, unknown> | Record<string, unknown>[] | null
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date
}
