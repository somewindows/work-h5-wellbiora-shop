import type { AdminAccountRecord, AdminAccountsRepository } from './admin-accounts.repository'
import { InMemoryAdminAccountsRepository } from './admin-accounts.repository'
import { AdminAccountsService } from './admin-accounts.service'
import type { AdminActor, AuditLogService } from './audit-log.service'
import { AdminPasswordService } from './password.service'

const superActor: AdminActor = { id: '', username: 'root', role: 'super', mustChangePassword: false }

describe('AdminAccountsService', () => {
  const passwordService = new AdminPasswordService()

  let accounts: InMemoryAdminAccountsRepository
  let audit: { record: jest.Mock }
  let service: AdminAccountsService
  let root: AdminAccountRecord

  beforeEach(async () => {
    accounts = new InMemoryAdminAccountsRepository()
    audit = { record: jest.fn().mockResolvedValue(undefined) }
    service = new AdminAccountsService(accounts, passwordService, audit as unknown as AuditLogService)
    root = await accounts.create({ username: 'root', passwordHash: await passwordService.hash('RootPass!2026'), role: 'super' })
    superActor.id = root.id
  })

  it('非超级管理员调用任何账号管理操作都被拒绝（40302）', async () => {
    const admin = await accounts.create({ username: 'ops', passwordHash: await passwordService.hash('OpsPass!2026') })
    const actor: AdminActor = { id: admin.id, username: 'ops', role: 'admin', mustChangePassword: false }

    await expect(service.list(actor)).rejects.toMatchObject({ code: 40302 })
    await expect(service.create(actor, { username: 'newbie', confirm: true })).rejects.toMatchObject({ code: 40302 })
    await expect(service.disable(actor, root.id, { confirm: true })).rejects.toMatchObject({ code: 40302 })
    await expect(service.resetPassword(actor, root.id, { confirm: true })).rejects.toMatchObject({ code: 40302 })
  })

  it('新建管理员返回一次性临时密码，账号强制首登改密，审计不含密码与哈希', async () => {
    const result = await service.create(superActor, { username: 'ops', confirm: true })

    expect(result.tempPassword).toMatch(/^[0-9a-f]{16}$/)
    expect(result.account).toMatchObject({ username: 'ops', role: 'admin', mustChangePassword: true, disabled: false })
    expect(result.account).not.toHaveProperty('passwordHash')
    // 临时密码确实可用于验证（哈希已落库）
    const stored = await accounts.findByUsername('ops')
    expect(stored && (await passwordService.verify(result.tempPassword, stored.passwordHash))).toBe(true)

    expect(audit.record).toHaveBeenCalledWith(superActor, 'create_admin', 'admin_account', result.account.id, null, { username: 'ops', role: 'admin' })
    const auditArgs = JSON.stringify(audit.record.mock.calls)
    expect(auditArgs).not.toContain(result.tempPassword)
    expect(auditArgs).not.toContain(stored?.passwordHash ?? 'no-hash')
  })

  it('新建时用户名重复（40002）、缺二次确认（40003）、用户名不合法（40003）', async () => {
    await expect(service.create(superActor, { username: 'ops', confirm: true })).resolves.toBeTruthy()
    await expect(service.create(superActor, { username: 'ops', confirm: true })).rejects.toMatchObject({ code: 40002 })
    await expect(service.create(superActor, { username: 'another' })).rejects.toMatchObject({ code: 40003 })
    await expect(service.create(superActor, { username: 'bad name!', confirm: true })).rejects.toMatchObject({ code: 40003 })
  })

  it('列表按创建时间升序且不包含密码哈希', async () => {
    await service.create(superActor, { username: 'ops', confirm: true })

    const list = await service.list(superActor)

    expect(list.map((item) => item.username)).toEqual(['root', 'ops'])
    for (const item of list) expect(item).not.toHaveProperty('passwordHash')
  })

  it('不能禁用/启用自己（40002）', async () => {
    await expect(service.disable(superActor, root.id, { confirm: true })).rejects.toMatchObject({ code: 40002 })
    await expect(service.enable(superActor, root.id, { confirm: true })).rejects.toMatchObject({ code: 40002 })
  })

  it('禁用后再启用恢复；重复状态操作报 40002；目标不存在报 40404', async () => {
    const admin = await accounts.create({ username: 'ops', passwordHash: 'scrypt$hash' })

    const disabled = await service.disable(superActor, admin.id, { confirm: true })
    expect(disabled.disabled).toBe(true)
    expect(audit.record).toHaveBeenLastCalledWith(superActor, 'disable_admin', 'admin_account', admin.id, { disabled: false }, { disabled: true })

    await expect(service.disable(superActor, admin.id, { confirm: true })).rejects.toMatchObject({ code: 40002 })

    const enabled = await service.enable(superActor, admin.id, { confirm: true })
    expect(enabled.disabled).toBe(false)
    expect(audit.record).toHaveBeenLastCalledWith(superActor, 'enable_admin', 'admin_account', admin.id, { disabled: true }, { disabled: false })

    await expect(service.enable(superActor, admin.id, { confirm: true })).rejects.toMatchObject({ code: 40002 })
    await expect(service.disable(superActor, 'missing-id', { confirm: true })).rejects.toMatchObject({ code: 40404 })
  })

  it('禁用最后一个可用超级管理员被拒绝（40002）', async () => {
    const otherSuper = await accounts.create({ username: 'super2', passwordHash: 'scrypt$hash', role: 'super' })
    // 模拟并发下 actor 已被禁用/降级但请求仍到达：listAll 中可用超管只剩目标一个
    const staleRepo: AdminAccountsRepository = {
      findById: async (id: string) => (id === root.id ? root : id === otherSuper.id ? otherSuper : null),
      findByUsername: async () => null,
      listAll: async () => [otherSuper],
      create: async () => {
        throw new Error('不应创建')
      },
      update: async () => undefined,
    }
    const staleService = new AdminAccountsService(staleRepo, passwordService, audit as unknown as AuditLogService)

    await expect(staleService.disable(superActor, otherSuper.id, { confirm: true })).rejects.toMatchObject({ code: 40002 })
  })

  it('重置他人密码返回新临时密码并强制改密；重置自己被拒绝（40002）', async () => {
    const admin = await accounts.create({ username: 'ops', passwordHash: await passwordService.hash('OldPass!2026') })

    const result = await service.resetPassword(superActor, admin.id, { confirm: true })

    expect(result.tempPassword).toMatch(/^[0-9a-f]{16}$/)
    expect(result.account.mustChangePassword).toBe(true)
    const stored = await accounts.findById(admin.id)
    expect(stored && (await passwordService.verify(result.tempPassword, stored.passwordHash))).toBe(true)
    expect(stored && (await passwordService.verify('OldPass!2026', stored.passwordHash))).toBe(false)

    const auditArgs = JSON.stringify(audit.record.mock.calls)
    expect(auditArgs).not.toContain(result.tempPassword)

    await expect(service.resetPassword(superActor, root.id, { confirm: true })).rejects.toMatchObject({ code: 40002 })
  })

  it('修改密码：旧密码错误 40101、新旧相同 40002、新密码太短 40003，成功后清除强制改密标记', async () => {
    const admin = await accounts.create({
      username: 'ops',
      passwordHash: await passwordService.hash('OldPass!2026'),
      mustChangePassword: true,
    })
    const actor: AdminActor = { id: admin.id, username: 'ops', role: 'admin', mustChangePassword: true }

    await expect(service.changePassword(actor, { oldPassword: 'WrongPass!2026', newPassword: 'NewPass!2026' })).rejects.toMatchObject({ code: 40101 })
    await expect(service.changePassword(actor, { oldPassword: 'OldPass!2026', newPassword: 'OldPass!2026' })).rejects.toMatchObject({ code: 40002 })
    await expect(service.changePassword(actor, { oldPassword: 'OldPass!2026', newPassword: 'short' })).rejects.toMatchObject({ code: 40003 })

    await service.changePassword(actor, { oldPassword: 'OldPass!2026', newPassword: 'NewPass!2026' })

    const stored = await accounts.findById(admin.id)
    expect(stored?.mustChangePassword).toBe(false)
    expect(stored && (await passwordService.verify('NewPass!2026', stored.passwordHash))).toBe(true)
    // 审计只记录事实，绝不记录密码或哈希
    expect(audit.record).toHaveBeenLastCalledWith(actor, 'change_password', 'admin_account', admin.id, null, { changed: true })
    const auditArgs = JSON.stringify(audit.record.mock.calls)
    expect(auditArgs).not.toContain('NewPass!2026')
    expect(auditArgs).not.toContain('OldPass!2026')
  })
})
