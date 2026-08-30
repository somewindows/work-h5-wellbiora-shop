import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'addresses' })
@Index(['userId'])
export class AddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', length: 36 })
  userId!: string

  @Column({ name: 'receiver_name', length: 20 })
  name!: string

  @Column({ length: 11 })
  phone!: string

  @Column({ length: 128 })
  region!: string

  @Column({ length: 255 })
  detail!: string

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
