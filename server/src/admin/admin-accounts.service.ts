import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'

import { BusinessException } from '../common/business.exception'

import { ADMIN_ACCOUNTS_REPOSITORY, type AdminAccountRecord, type AdminAccountsRepository, type AdminRole } from './admin-accounts.repository'
import { type AdminActor, AuditLogService } from './audit-log.service'
import type { AdminAccountConfirmDto, AdminChangePasswordDto, CreateAdminAccountDto } from './dto/admin-accounts.dto'
import { AdminPasswordService } from './password.service'

/** 管理员账号对外视图（绝不含密码哈希） */
export interface AdminAccountView {
  id: string
  username: string
  role: AdminRole
  disabled: boolean
  mustChangePassword: boolean
  createdAt: Date
}

/** 新建/重置密码的响应：临时密码仅在本次响应可见，服务端不落明文 */
export interface AdminAccountWithTempPassword {
  account: AdminAccountView
  tempPassword: string
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,64}$/

@Injectable()
export class AdminAccountsService {
  constructor(
    @Inject(ADMIN_ACCOUNTS_REPOSITORY) private readonly repository: AdminAccountsRepository,
    private readonly passwordService: AdminPasswordService,
    private readonly audit: AuditLogService,
  ) {}

  /** 修改自己的密码：任何登录管理员可用；成功后清除强制改密标记。审计绝不记录密码或哈希 */
  async changePassword(actor: AdminActor, dto: AdminChangePasswordDto): Promise<void> {
    if (dto.newPassword.length < 12 || dto.newPassword.length > 128) {
      throw new BusinessException(40003, '新密码长度需为 12-128 位')
    }
    const account = await this.requireAccount(actor.id)
    if (!(await this.passwordService.verify(dto.oldPassword, account.passwordHash))) {
      throw new BusinessException(40101, '旧密码错误', HttpStatus.UNAUTHORIZED)
    }
    if (dto.oldPassword === dto.newPassword) {
      throw new BusinessException(40002, '新密码不能与旧密码相同')
    }
    const passwordHash = await this.passwordService.hash(dto.newPassword)
    await this.repository.update(account.id, { passwordHash, mustChangePassword: false })
    await this.audit.record(actor, 'change_password', 'admin_account', account.id, null, { changed: true })
  }

  /** 以下均为超级管理员专属操作 */

  async list(actor: AdminActor): Promise<AdminAccountView[]> {
    await this.requireSuper(actor)
    const accounts = await this.repository.listAll()
    return accounts.map((account) => this.toView(account))
  }

  async create(actor: AdminActor, dto: CreateAdminAccountDto): Promise<AdminAccountWithTempPassword> {
    await this.requireSuper(actor)
    this.requireConfirm(dto.confirm)
    if (!USERNAME_PATTERN.test(dto.username)) {
      throw new BusinessException(40003, '用户名需为 3-64 位字母、数字或 _ . -')
    }
    if (await this.repository.findByUsername(dto.username)) {
      throw new BusinessException(40002, '用户名已存在')
    }
    const tempPassword = this.generateTempPassword()
    const passwordHash = await this.passwordService.hash(tempPassword)
    const created = await this.repository.create({ username: dto.username, passwordHash, role: 'admin', mustChangePassword: true })
    await this.audit.record(actor, 'create_admin', 'admin_account', created.id, null, { username: created.username, role: created.role })
    return { account: this.toView(created), tempPassword }
  }

  async disable(actor: AdminActor, id: string, dto: AdminAccountConfirmDto): Promise<AdminAccountView> {
    return this.setDisabled(actor, id, true, dto)
  }

  async enable(actor: AdminActor, id: string, dto: AdminAccountConfirmDto): Promise<AdminAccountView> {
    return this.setDisabled(actor, id, false, dto)
  }

  /** 重置他人密码：生成新临时密码并强制改密；自己的密码必须走 change-password */
  async resetPassword(actor: AdminActor, id: string, dto: AdminAccountConfirmDto): Promise<AdminAccountWithTempPassword> {
    await this.requireSuper(actor)
    this.requireConfirm(dto.confirm)
    const target = await this.requireAccount(id)
    if (target.id === actor.id) {
      throw new BusinessException(40002, '不能重置自己的密码，请使用修改密码')
    }
    const tempPassword = this.generateTempPassword()
    const passwordHash = await this.passwordService.hash(tempPassword)
    await this.repository.update(target.id, { passwordHash, mustChangePassword: true })
    await this.audit.record(actor, 'reset_admin_password', 'admin_account', target.id, null, { username: target.username })
    const updated = await this.requireAccount(target.id)
    return { account: this.toView(updated), tempPassword }
  }

  private async setDisabled(actor: AdminActor, id: string, disabled: boolean, dto: AdminAccountConfirmDto): Promise<AdminAccountView> {
    await this.requireSuper(actor)
    this.requireConfirm(dto.confirm)
    const target = await this.requireAccount(id)
    if (target.id === actor.id) {
      throw new BusinessException(40002, disabled ? '不能禁用自己' : '不能启用自己')
    }
    if (target.disabled === disabled) {
      throw new BusinessException(40002, disabled ? '该管理员已处于禁用状态' : '该管理员当前未禁用')
    }
    if (disabled && target.role === 'super') {
      // 保底约束：至少保留一个可用超级管理员，否则后台将无人能管理账号
      const accounts = await this.repository.listAll()
      const activeSupers = accounts.filter((account) => account.role === 'super' && !account.disabled).length
      if (activeSupers <= 1) {
        throw new BusinessException(40002, '至少保留一个可用超级管理员')
      }
    }
    const before = { disabled: target.disabled }
    await this.repository.update(target.id, { disabled })
    await this.audit.record(actor, disabled ? 'disable_admin' : 'enable_admin', 'admin_account', target.id, before, { disabled })
    return this.toView({ ...target, disabled })
  }

  /** 超管校验：按 actor.id 回查库（不信任 JWT/会话缓存中的角色），禁用账号同样拒绝 */
  private async requireSuper(actor: AdminActor): Promise<AdminAccountRecord> {
    const account = await this.requireAccount(actor.id)
    if (account.role !== 'super' || account.disabled) {
      throw new BusinessException(40302, '仅超级管理员可执行该操作', HttpStatus.FORBIDDEN)
    }
    return account
  }

  private async requireAccount(id: string): Promise<AdminAccountRecord> {
    const account = await this.repository.findById(id)
    if (!account) throw new BusinessException(40404, '管理员不存在', HttpStatus.NOT_FOUND)
    return account
  }

  private requireConfirm(confirm: boolean | undefined): void {
    if (confirm !== true) throw new BusinessException(40003, '该操作需要二次确认，请设置 confirm=true')
  }

  /** 一次性临时密码：16 位十六进制，满足 12-128 位密码规则，仅本次响应可见 */
  private generateTempPassword(): string {
    return randomBytes(8).toString('hex')
  }

  private toView(account: AdminAccountRecord): AdminAccountView {
    return {
      id: account.id,
      username: account.username,
      role: account.role,
      disabled: account.disabled,
      mustChangePassword: account.mustChangePassword,
      createdAt: account.createdAt,
    }
  }
}
