import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'sms_verification_codes' })
export class SmsVerificationCodeEntity {
  @PrimaryColumn({ length: 11 })
  phone!: string

  @Column({ name: 'code_hash', length: 64 })
  codeHash!: string

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  attempts!: number

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date

  @Column({ name: 'cooldown_until', type: 'datetime' })
  cooldownUntil!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
