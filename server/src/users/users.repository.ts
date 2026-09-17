import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { UserEntity } from './user.entity'

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY')

export interface AdminUserPageQuery {
  /** 手机号模糊匹配 */
  keyword?: string
  from?: Date
  to?: Date
  page: number
  pageSize: number
}

export interface UsersRepository {
  findById(id: string): Promise<UserEntity | null>
  findByPhone(phone: string): Promise<UserEntity | null>
  create(phone: string): Promise<UserEntity>
  /** 网页授权换到 openid 后幂等回写；值相同或无变化时静默成功 */
  updateWechatOpenId(id: string, wechatOpenId: string): Promise<void>
  /** 后台用户列表：按创建时间倒序分页，keyword 模糊匹配手机号，from/to 过滤注册时间 */
  findAdminPage(query: AdminUserPageQuery): Promise<{ list: UserEntity[]; total: number }>
  /** 后台禁用/启用（定向条件更新，不整体覆盖其他字段） */
  setDisabled(id: string, disabled: boolean): Promise<void>
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

  async updateWechatOpenId(id: string, wechatOpenId: string): Promise<void> {
    await this.repository.update({ id }, { wechatOpenId })
  }

  async findAdminPage(query: AdminUserPageQuery): Promise<{ list: UserEntity[]; total: number }> {
    const builder = this.repository.createQueryBuilder('user').orderBy('user.created_at', 'DESC')
    if (query.keyword) builder.andWhere('user.phone LIKE :keyword', { keyword: `%${query.keyword.trim()}%` })
    if (query.from) builder.andWhere('user.created_at >= :from', { from: query.from })
    if (query.to) builder.andWhere('user.created_at <= :to', { to: query.to })
    const [list, total] = await builder.skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount()
    return { list, total }
  }

  async setDisabled(id: string, disabled: boolean): Promise<void> {
    await this.repository.update({ id }, { disabled })
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
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.set(phone, user)
    return user
  }

  async updateWechatOpenId(id: string, wechatOpenId: string): Promise<void> {
    const user = await this.findById(id)
    if (user) {
      user.wechatOpenId = wechatOpenId
      user.updatedAt = new Date()
    }
  }

  async findAdminPage(query: AdminUserPageQuery): Promise<{ list: UserEntity[]; total: number }> {
    const keyword = query.keyword?.trim()
    const filtered = [...this.users.values()]
      .filter((user) =>
        (!keyword || user.phone.includes(keyword)) &&
        (!query.from || user.createdAt >= query.from) &&
        (!query.to || user.createdAt <= query.to))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    const start = (query.page - 1) * query.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + query.pageSize) }
  }

  async setDisabled(id: string, disabled: boolean): Promise<void> {
    const user = await this.findById(id)
    if (user) {
      user.disabled = disabled
      user.updatedAt = new Date()
    }
  }
}
