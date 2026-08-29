import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'sms_ip_rate_limits' })
export class SmsIpRateLimitEntity {
  @PrimaryColumn({ length: 45 })
  ip!: string

  @Column({ name: 'send_count', type: 'smallint', unsigned: true, default: 0 })
  sendCount!: number

  @Column({ name: 'window_expires_at', type: 'datetime' })
  windowExpiresAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
