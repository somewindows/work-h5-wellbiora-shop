import type { AdminActor, AuditLogService } from '../admin/audit-log.service'
import { BusinessException } from '../common/business.exception'
import { InMemoryOrderRepository, type OrderRecord } from '../orders/order.repository'
import { YEARLY_LIMIT_FEN } from '../orders/order.service'
import { InMemoryAddressRepository, InMemoryRealnameProfileRepository } from '../profile/profile.repository'

import { AdminUsersService } from './admin-users.service'
import type { UserEntity } from './user.entity'
import { InMemoryUsersRepository } from './users.repository'

const actor: AdminActor = { id: 'admin-1', username: 'operator' }

describe('AdminUsersService', () => {
  let users: InMemoryUsersRepository
  let orders: InMemoryOrderRepository
  let realnames: InMemoryRealnameProfileRepository
  let addresses: InMemoryAddressRepository
  let audit: { record: jest.Mock }
  let service: AdminUsersService

  beforeEach(() => {
    users = new InMemoryUsersRepository()
    orders = new InMemoryOrderRepository()
    realnames = new InMemoryRealnameProfileRepository()
    addresses = new InMemoryAddressRepository()
    audit = { record: jest.fn().mockResolvedValue({}) }
    service = new AdminUsersService(users, orders, realnames, addresses, audit as unknown as AuditLogService)
  })

  /** 造一笔订单（默认已支付），paymentStatus 可覆盖 */
  async function createOrder(userId: string, paymentStatus = 'paid', totalFen = 10000): Promise<OrderRecord> {
    const order = orders.createOrder({
      orderNo: `WB20260917${Math.random().toString(36).slice(2, 10).toUpperCase()}`, userId, requestId: `req-${Math.random()}`,
      status: paymentStatus === 'pending' ? 'pay' : 'ship', paymentStatus, warehouseStatus: null,
      totalFen, realnameName: '张三', idcardEncrypted: 'enc', idcardFingerprint: 'fp-user',
      receiverName: '张三', receiverPhone: '13800000000', receiverRegion: '浙江省 金华市', receiverDetail: '北苑街道 1 号',
      paidAt: paymentStatus === 'pending' ? null : new Date(), cancelledAt: null, systemRemark: null,
      refundFen: null, refundedAt: null, wechatTransactionId: null, customsDeclareStatus: null, customsDeclaredAt: null,
    })
    return orders.saveOrder(order)
  }

  async function createUser(phone: string): Promise<UserEntity> {
    return users.create(phone)
  }

  describe('list', () => {
    it('返回分页列表，手机号脱敏，含订单聚合', async () => {
      const user = await createUser('13800000001')
      await createOrder(user.id, 'paid', 10000)
      await createOrder(user.id, 'pending', 20000) // 待支付不计入累计消费

      const result = await service.list({ page: 1, pageSize: 20 })

      expect(result.total).toBe(1)
      expect(result.list[0]).toMatchObject({
        phoneMasked: '138****0001', nickname: 'WELLBIORA 会员',
        wechatBound: false, realnamed: false, disabled: false,
        orderCount: 2, paidTotalFen: 10000,
      })
      expect(JSON.stringify(result)).not.toContain('13800000001')
    })

    it('keyword 按手机号模糊过滤，分页截断', async () => {
      await createUser('13800000001')
      await createUser('13900000002')
      await createUser('13900000003')

      const filtered = await service.list({ keyword: '13800', page: 1, pageSize: 20 })
      expect(filtered.total).toBe(1)

      const paged = await service.list({ page: 2, pageSize: 2 })
      expect(paged.total).toBe(3)
      expect(paged.list).toHaveLength(1)
    })

    it('from/to 按注册时间过滤', async () => {
      const old = await createUser('13800000001')
      old.createdAt = new Date('2020-01-01T00:00:00Z')
      await createUser('13900000002')

      const result = await service.list({ from: new Date('2021-01-01T00:00:00Z'), page: 1, pageSize: 20 })
      expect(result.total).toBe(1)
    })
  })

  describe('detail', () => {
    it('聚合订单数/累计消费/地址数/年度额度，实名姓名脱敏', async () => {
      const user = await createUser('13800000001')
      await realnames.save(realnames.create({ userId: user.id, name: '张伟', idcardEncrypted: 'enc', idcardFingerprint: 'fp-user' }))
      await addresses.save(addresses.create({ userId: user.id, name: '张伟', phone: '13800000001', region: '浙江省 金华市', detail: '北苑街道 1 号', isDefault: true }))
      // 已支付三口径（paid/refunding/refunded）全部计入累计消费
      await createOrder(user.id, 'paid', 10000)
      await createOrder(user.id, 'refunding', 20000)
      await createOrder(user.id, 'refunded', 5000)
      await createOrder(user.id, 'pending', 999999) // 不计入累计消费，但计入订单数与年度占用

      const detail = await service.detail(user.id)

      expect(detail).toMatchObject({
        phoneMasked: '138****0001', realnamed: true, realnameNameMasked: '张*',
        orderCount: 4, paidTotalFen: 35000, addressCount: 1,
      })
      expect(detail.yearlyQuota).toMatchObject({
        year: new Date().getFullYear(),
        // 年度占用口径 = 下单预占（待支付也占用），含 pending 单
        occupiedFen: 10000 + 20000 + 999999,
        limitFen: YEARLY_LIMIT_FEN,
      })
      expect(detail.yearlyQuota.remainingFen).toBe(YEARLY_LIMIT_FEN - detail.yearlyQuota.occupiedFen)
      expect(JSON.stringify(detail)).not.toContain('张伟')
    })

    it('未实名用户年度额度占用为 0、剩余等于上限', async () => {
      const user = await createUser('13800000001')

      const detail = await service.detail(user.id)

      expect(detail.realnameNameMasked).toBeNull()
      expect(detail.yearlyQuota).toEqual({ year: new Date().getFullYear(), occupiedFen: 0, remainingFen: YEARLY_LIMIT_FEN, limitFen: YEARLY_LIMIT_FEN })
    })

    it('用户不存在返回 40404', async () => {
      await expect(service.detail('missing-id')).rejects.toMatchObject({ code: 40404 } satisfies Partial<BusinessException>)
    })
  })

  describe('disable / enable', () => {
    it('缺少二次确认时拒绝（40003）', async () => {
      const user = await createUser('13800000001')

      await expect(service.disable(user.id, {}, actor)).rejects.toMatchObject({ code: 40003 } satisfies Partial<BusinessException>)
      await expect(service.enable(user.id, {}, actor)).rejects.toMatchObject({ code: 40003 } satisfies Partial<BusinessException>)
    })

    it('禁用成功：写审计并返回更新后详情', async () => {
      const user = await createUser('13800000001')

      const detail = await service.disable(user.id, { confirm: true }, actor)

      expect(detail.disabled).toBe(true)
      expect(audit.record).toHaveBeenCalledWith(actor, 'disable_user', 'user', user.id, { disabled: false }, { disabled: true })
    })

    it('重复禁用/重复启用返回 40002', async () => {
      const user = await createUser('13800000001')

      // 未禁用状态直接启用 = 重复操作
      await expect(service.enable(user.id, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 } satisfies Partial<BusinessException>)
      await service.disable(user.id, { confirm: true }, actor)
      await expect(service.disable(user.id, { confirm: true }, actor)).rejects.toMatchObject({ code: 40002 } satisfies Partial<BusinessException>)
    })

    it('启用成功：恢复 disabled=false 并写审计', async () => {
      const user = await createUser('13800000001')
      await service.disable(user.id, { confirm: true }, actor)

      const detail = await service.enable(user.id, { confirm: true }, actor)

      expect(detail.disabled).toBe(false)
      expect(audit.record).toHaveBeenLastCalledWith(actor, 'enable_user', 'user', user.id, { disabled: true }, { disabled: false })
    })

    it('操作不存在的用户返回 40404', async () => {
      await expect(service.disable('missing-id', { confirm: true }, actor)).rejects.toMatchObject({ code: 40404 } satisfies Partial<BusinessException>)
    })
  })
})
