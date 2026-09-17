import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'admin_accounts' })
export class AdminAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 64, unique: true })
  username!: string

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string

  /** 角色：super=超级管理员（可管理其他管理员），admin=普通管理员 */
  @Column({ length: 16, default: 'admin' })
  role!: 'super' | 'admin'

  /** 禁用标记：禁用后拒绝登录、已签发 token 在守卫回查时立即失效 */
  @Column({ type: 'boolean', default: false })
  disabled!: boolean

  /** 首登/重置后强制改密标记：为 true 时守卫仅放行修改密码接口 */
  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
