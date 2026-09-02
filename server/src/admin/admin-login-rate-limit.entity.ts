import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'admin_login_rate_limits' })
export class AdminLoginRateLimitEntity {
  /** 限流维度键：`account:<用户名>` 或 `ip:<IP>` */
  @PrimaryColumn({ name: 'rate_key', length: 80 })
  key!: string

  @Column({ name: 'fail_count', type: 'smallint', unsigned: true, default: 0 })
  failCount!: number

  @Column({ name: 'window_expires_at', type: 'datetime' })
  windowExpiresAt!: Date

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil!: Date | null

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
