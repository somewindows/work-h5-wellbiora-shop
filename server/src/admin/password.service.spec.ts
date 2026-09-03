import { AdminPasswordService } from './password.service'

describe('AdminPasswordService', () => {
  const service = new AdminPasswordService()

  it('生成不可逆且可验证的密码哈希', async () => {
    const encodedHash = await service.hash('AdminPass!2026')

    expect(encodedHash).not.toContain('AdminPass!2026')
    await expect(service.verify('AdminPass!2026', encodedHash)).resolves.toBe(true)
  })

  it('拒绝错误密码', async () => {
    const encodedHash = await service.hash('AdminPass!2026')

    await expect(service.verify('NotThePassword!2026', encodedHash)).resolves.toBe(false)
  })
})
