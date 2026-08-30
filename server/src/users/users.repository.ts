import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { UserEntity } from './user.entity'

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY')

export interface UsersRepository {
  findById(id: string): Promise<UserEntity | null>
  findByPhone(phone: string): Promise<UserEntity | null>
  create(phone: string): Promise<UserEntity>
}

@Injectable()
export class TypeOrmUsersRepository implements UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly repository: Repository<UserEntity>) {}

  findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ id })
  }

  findByPhone(phone: string): Promise<UserEntity | null> {
    return this.repository.findOneBy({ phone })
  }

  async create(phone: string): Promise<UserEntity> {
    return this.repository.save(this.repository.create({ phone }))
  }
}

export class InMemoryUsersRepository implements UsersRepository {
  private readonly users = new Map<string, UserEntity>()

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.users.get(phone) ?? null
  }

  async findById(id: string): Promise<UserEntity | null> {
    return [...this.users.values()].find((user) => user.id === id) ?? null
  }

  async create(phone: string): Promise<UserEntity> {
    const user: UserEntity = {
      id: randomUUID(),
      phone,
      nickname: 'WELLBIORA 会员',
      wechatOpenId: null,
      unionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.set(phone, user)
    return user
  }
}
