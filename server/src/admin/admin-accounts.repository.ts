import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import type { AdminAccountRecord, AdminAccountsRepository } from './admin-auth.service'
import { AdminAccountEntity } from './admin-account.entity'

export const ADMIN_ACCOUNTS_REPOSITORY = Symbol('ADMIN_ACCOUNTS_REPOSITORY')

@Injectable()
export class TypeOrmAdminAccountsRepository implements AdminAccountsRepository {
  constructor(@InjectRepository(AdminAccountEntity) private readonly repository: Repository<AdminAccountEntity>) {}

  findByUsername(username: string): Promise<AdminAccountEntity | null> {
    return this.repository.findOneBy({ username })
  }

  create(input: Pick<AdminAccountRecord, 'username' | 'passwordHash'>): Promise<AdminAccountEntity> {
    return this.repository.save(this.repository.create(input))
  }
}

export class InMemoryAdminAccountsRepository implements AdminAccountsRepository {
  private readonly accounts = new Map<string, AdminAccountRecord>()

  async findByUsername(username: string): Promise<AdminAccountRecord | null> {
    return this.accounts.get(username) ?? null
  }

  async create(input: Pick<AdminAccountRecord, 'username' | 'passwordHash'>): Promise<AdminAccountRecord> {
    const now = new Date()
    const account: AdminAccountRecord = { id: randomUUID(), ...input, createdAt: now, updatedAt: now }
    this.accounts.set(account.username, account)
    return account
  }
}
