import { HttpStatus, Inject, Injectable } from '@nestjs/common'

import { type AdminActor, AuditLogService } from '../admin/audit-log.service'
import { BusinessException } from '../common/business.exception'
import { ORDER_REPOSITORY, type OrderRepository } from '../orders/order.repository'
import { YEARLY_LIMIT_FEN } from '../orders/order.service'
import { ADDRESS_REPOSITORY, REALNAME_PROFILE_REPOSITORY, type AddressRepository, type RealnameProfileRepository } from '../profile/profile.repository'

import type { AdminUserConfirmDto, AdminUserQueryDto } from './admin-users.dto'
import type { UserEntity } from './user.entity'
import { USERS_REPOSITORY, type UsersRepository } from './users.repository'

/** 后台用户列表项：手机号已脱敏，绝不返回完整身份证号（不解密、不回显） */
export interface AdminUserListItem {
  id: string
  phoneMasked: string
  nickname: string
  wechatBound: boolean
  realnamed: boolean
  disabled: boolean
  orderCount: number
  /** 累计消费（分）= paymentStatus IN ('paid','refunding','refunded') 的订单总额 */
  paidTotalFen: number
  createdAt: string
}

/** 年度跨境额度卡（个人年度交易限值 26000 元，口径与下单预占一致） */
export interface YearlyQuota {
  year: number
  occupiedFen: number
  remainingFen: number
  limitFen: number
}

export interface AdminUserDetail extends AdminUserListItem {
  /** 实名姓名脱敏（姓氏 + *），未实名为 null */
  realnameNameMasked: string | null
  addressCount: number
  yearlyQuota: YearlyQuota
}

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepository,
    @Inject(REALNAME_PROFILE_REPOSITORY) private readonly realnameRepository: RealnameProfileRepository,
    @Inject(ADDRESS_REPOSITORY) private readonly addressRepository: AddressRepository,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: AdminUserQueryDto): Promise<{ total: number; list: AdminUserListItem[] }> {
    const page = await this.usersRepository.findAdminPage({
      keyword: query.keyword,
      from: query.from,
      to: query.to,
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 20)),
    })
    const summaries = await this.orderRepository.summarizeByUsers(page.list.map((user) => user.id))
    // 实名状态批量判断（pageSize ≤ 100，逐条查询可接受；仓储暂无批量接口）
    const list: AdminUserListItem[] = []
    for (const user of page.list) {
      const profile = await this.realnameRepository.findByUser(user.id)
      list.push(this.toListItem(user, summaries[user.id], Boolean(profile)))
    }
    return { total: page.total, list }
  }

  async detail(id: string): Promise<AdminUserDetail> {
    const user = await this.requireUser(id)
    const profile = await this.realnameRepository.findByUser(id)
    const summaries = await this.orderRepository.summarizeByUsers([id])
    const addressCount = (await this.addressRepository.findByUser(id)).length
    return {
      ...this.toListItem(user, summaries[id], Boolean(profile)),
      realnameNameMasked: profile ? maskRealname(profile.name) : null,
      addressCount,
      yearlyQuota: await this.buildYearlyQuota(profile?.idcardFingerprint ?? null),
    }
  }

  async disable(id: string, dto: AdminUserConfirmDto, actor: AdminActor): Promise<AdminUserDetail> {
    return this.setDisabled(id, true, dto, actor)
  }

  async enable(id: string, dto: AdminUserConfirmDto, actor: AdminActor): Promise<AdminUserDetail> {
    return this.setDisabled(id, false, dto, actor)
  }

  private async setDisabled(id: string, disabled: boolean, dto: AdminUserConfirmDto, actor: AdminActor): Promise<AdminUserDetail> {
    if (dto.confirm !== true) throw new BusinessException(40003, '该操作需要二次确认，请设置 confirm=true')
    const user = await this.requireUser(id)
    if (user.disabled === disabled) {
      throw new BusinessException(40002, disabled ? '该用户已处于禁用状态' : '该用户当前未禁用')
    }
    // 先取 before 快照再更新：内存仓储按引用存储，更新后再读会拿到新值
    const before = { disabled: user.disabled }
    await this.usersRepository.setDisabled(id, disabled)
    await this.audit.record(actor, disabled ? 'disable_user' : 'enable_user', 'user', id, before, { disabled })
    return this.detail(id)
  }

  private async requireUser(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id)
    if (!user) throw new BusinessException(40404, '用户不存在', HttpStatus.NOT_FOUND)
    return user
  }

  /** 年度额度：有实名按证件指纹统计占用（与下单预占同口径）；未实名占用为 0 */
  private async buildYearlyQuota(idcardFingerprint: string | null): Promise<YearlyQuota> {
    const now = new Date()
    let occupiedFen = 0
    if (idcardFingerprint) {
      const from = new Date(now.getFullYear(), 0, 1)
      const to = new Date(now.getFullYear() + 1, 0, 1)
      occupiedFen = await this.orderRepository.sumOccupiedYearlyFen(idcardFingerprint, from, to)
    }
    return { year: now.getFullYear(), occupiedFen, remainingFen: Math.max(0, YEARLY_LIMIT_FEN - occupiedFen), limitFen: YEARLY_LIMIT_FEN }
  }

  private toListItem(user: UserEntity, summary: { orderCount: number; paidTotalFen: number } | undefined, realnamed: boolean): AdminUserListItem {
    return {
      id: user.id,
      phoneMasked: maskPhone(user.phone),
      nickname: user.nickname,
      wechatBound: Boolean(user.wechatOpenId),
      realnamed,
      disabled: user.disabled,
      orderCount: summary?.orderCount ?? 0,
      paidTotalFen: summary?.paidTotalFen ?? 0,
      createdAt: user.createdAt.toISOString(),
    }
  }
}

function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/** 实名姓名脱敏：仅保留姓氏（如「张*」）；多字姓按首字处理 */
function maskRealname(name: string): string {
  return `${name.slice(0, 1)}*`
}
