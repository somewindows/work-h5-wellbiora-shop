import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 11, unique: true })
  phone!: string

  @Column({ name: 'nickname', length: 64, default: 'WELLBIORA 会员' })
  nickname!: string

  @Column({ name: 'wechat_open_id', type: 'varchar', length: 64, nullable: true, unique: true })
  wechatOpenId!: string | null

  @Column({ name: 'union_id', type: 'varchar', length: 64, nullable: true, unique: true })
  unionId!: string | null

  /** 后台禁用标记：禁用后拒绝发验证码/登录，已签发 token 由 JwtAuthGuard 拦截 */
  @Column({ name: 'disabled', type: 'boolean', default: false })
  disabled!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
