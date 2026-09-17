import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { AdminAccountEntity } from './admin-account.entity'

export const ADMIN_ACCOUNTS_REPOSITORY = Symbol('ADMIN_ACCOUNTS_REPOSITORY')

export type AdminRole = 'super' | 'admin'

export interface AdminAccountRecord {
  id: string
  username: string
  passwordHash: string
  role: AdminRole
  disabled: boolean
  mustChangePassword: boolean
  createdAt: Date
  updatedAt: Date
}

/** create 时除用户名/密码哈希外均可省略（省略即按默认：role=admin、未禁用、无需改密） */
export type CreateAdminAccountInput = Pick<AdminAccountRecord, 'username' | 'passwordHash'> &
  Partial<Pick<AdminAccountRecord, 'role' | 'disabled' | 'mustChangePassword'>>

export type UpdateAdminAccountPatch = Partial<Pick<AdminAccountRecord, 'passwordHash' | 'role' | 'disabled' | 'mustChangePassword'>>

export interface AdminAccountsRepository {
  findByUsername(username: string): Promise<AdminAccountRecord | null>
  findById(id: string): Promise<AdminAccountRecord | null>
  /** 全量列表，按创建时间升序（管理员数量小，不分页） */
  listAll(): Promise<AdminAccountRecord[]>
  create(input: CreateAdminAccountInput): Promise<AdminAccountRecord>
  update(id: string, patch: UpdateAdminAccountPatch): Promise<void>
}

@Injectable()
export class TypeOrmAdminAccountsRepository implements AdminAccountsRepository {
  constructor(@InjectRepository(AdminAccountEntity) private readonly repository: Repository<AdminAccountEntity>) {}

  findByUsername(username: string): Promise<AdminAccountEntity | null> {
    return this.repository.findOneBy({ username })
  }

  findById(id: string): Promise<AdminAccountEntity | null> {
    return this.repository.findOneBy({ id })
  }

  listAll(): Promise<AdminAccountEntity[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } })
  }

  create(input: CreateAdminAccountInput): Promise<AdminAccountEntity> {
    return this.repository.save(this.repository.create(input))
  }

  async update(id: string, patch: UpdateAdminAccountPatch): Promise<void> {
    await this.repository.update({ id }, patch)
  }
}

export class InMemoryAdminAccountsRepository implements AdminAccountsRepository {
  private readonly accounts = new Map<string, AdminAccountRecord>()

  async findByUsername(username: string): Promise<AdminAccountRecord | null> {
    return this.accounts.get(username) ?? null
  }

  async findById(id: string): Promise<AdminAccountRecord | null> {
    for (const account of this.accounts.values()) {
      if (account.id === id) return account
    }
    return null
  }

  async listAll(): Promise<AdminAccountRecord[]> {
    return [...this.accounts.values()].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
  }

  async create(input: CreateAdminAccountInput): Promise<AdminAccountRecord> {
    const now = new Date()
    const account: AdminAccountRecord = {
      id: randomUUID(),
      role: 'admin',
      disabled: false,
      mustChangePassword: false,
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    this.accounts.set(account.username, account)
    return account
  }

  async update(id: string, patch: UpdateAdminAccountPatch): Promise<void> {
    for (const [username, account] of this.accounts) {
      if (account.id === id) {
        this.accounts.set(username, { ...account, ...patch, updatedAt: new Date() })
        return
      }
    }
  }
}
