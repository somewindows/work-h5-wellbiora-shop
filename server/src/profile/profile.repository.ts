import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { AddressEntity } from './address.entity'
import { RealnameProfileEntity } from './realname-profile.entity'

export const ADDRESS_REPOSITORY = Symbol('ADDRESS_REPOSITORY')
export const REALNAME_PROFILE_REPOSITORY = Symbol('REALNAME_PROFILE_REPOSITORY')

export interface AddressRecord {
  id: string
  userId: string
  name: string
  phone: string
  region: string
  detail: string
  isDefault: boolean
}

export interface RealnameProfileRecord {
  id: string
  userId: string
  name: string
  idcardEncrypted: string
}

export interface AddressRepository {
  findByUser(userId: string): Promise<AddressRecord[]>
  findByIdAndUser(id: string, userId: string): Promise<AddressRecord | null>
  create(input: Omit<AddressRecord, 'id'>): AddressRecord
  save(item: AddressRecord): Promise<AddressRecord>
  clearDefault(userId: string): Promise<void>
  remove(item: AddressRecord): Promise<void>
}

export interface RealnameProfileRepository {
  findByUser(userId: string): Promise<RealnameProfileRecord | null>
  create(input: Omit<RealnameProfileRecord, 'id'>): RealnameProfileRecord
  save(item: RealnameProfileRecord): Promise<RealnameProfileRecord>
}

@Injectable()
export class TypeOrmAddressRepository implements AddressRepository {
  constructor(@InjectRepository(AddressEntity) private readonly repository: Repository<AddressEntity>) {}

  findByUser(userId: string): Promise<AddressEntity[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'ASC' } })
  }

  findByIdAndUser(id: string, userId: string): Promise<AddressEntity | null> {
    return this.repository.findOneBy({ id, userId })
  }

  create(input: Omit<AddressRecord, 'id'>): AddressEntity {
    return this.repository.create(input)
  }

  save(item: AddressRecord): Promise<AddressEntity> {
    return this.repository.save(item)
  }

  async clearDefault(userId: string): Promise<void> {
    await this.repository.update({ userId }, { isDefault: false })
  }

  async remove(item: AddressRecord): Promise<void> {
    await this.repository.delete(item.id)
  }
}

@Injectable()
export class TypeOrmRealnameProfileRepository implements RealnameProfileRepository {
  constructor(@InjectRepository(RealnameProfileEntity) private readonly repository: Repository<RealnameProfileEntity>) {}

  findByUser(userId: string): Promise<RealnameProfileEntity | null> {
    return this.repository.findOneBy({ userId })
  }

  create(input: Omit<RealnameProfileRecord, 'id'>): RealnameProfileEntity {
    return this.repository.create(input)
  }

  save(item: RealnameProfileRecord): Promise<RealnameProfileEntity> {
    return this.repository.save(item)
  }
}

export class InMemoryAddressRepository implements AddressRepository {
  private readonly items = new Map<string, AddressRecord>()

  async findByUser(userId: string): Promise<AddressRecord[]> {
    return [...this.items.values()].filter((item) => item.userId === userId)
  }

  async findByIdAndUser(id: string, userId: string): Promise<AddressRecord | null> {
    const item = this.items.get(id)
    return item?.userId === userId ? item : null
  }

  create(input: Omit<AddressRecord, 'id'>): AddressRecord {
    return { id: randomUUID(), ...input }
  }

  async save(item: AddressRecord): Promise<AddressRecord> {
    this.items.set(item.id, { ...item })
    return item
  }

  async clearDefault(userId: string): Promise<void> {
    for (const item of this.items.values()) {
      if (item.userId === userId) item.isDefault = false
    }
  }

  async remove(item: AddressRecord): Promise<void> {
    this.items.delete(item.id)
  }
}

export class InMemoryRealnameProfileRepository implements RealnameProfileRepository {
  private readonly items = new Map<string, RealnameProfileRecord>()

  async findByUser(userId: string): Promise<RealnameProfileRecord | null> {
    return this.items.get(userId) ?? null
  }

  create(input: Omit<RealnameProfileRecord, 'id'>): RealnameProfileRecord {
    return { id: randomUUID(), ...input }
  }

  async save(item: RealnameProfileRecord): Promise<RealnameProfileRecord> {
    this.items.set(item.userId, { ...item })
    return item
  }
}
