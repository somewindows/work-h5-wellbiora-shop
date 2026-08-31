import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'admin_accounts' })
export class AdminAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 64, unique: true })
  username!: string

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
