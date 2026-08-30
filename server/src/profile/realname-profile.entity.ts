import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'realname_profiles' })
@Index(['userId'], { unique: true })
export class RealnameProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', length: 36 })
  userId!: string

  @Column({ length: 20 })
  name!: string

  @Column({ name: 'idcard_encrypted', type: 'text' })
  idcardEncrypted!: string

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
