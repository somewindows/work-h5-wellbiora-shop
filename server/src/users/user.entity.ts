import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 11, unique: true })
  phone!: string

  @Column({ name: 'nickname', length: 64, default: 'WELLBIORA 会员' })
  nickname!: string

  @Column({ name: 'wechat_open_id', length: 64, nullable: true, unique: true })
  wechatOpenId!: string | null

  @Column({ name: 'union_id', length: 64, nullable: true, unique: true })
  unionId!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
