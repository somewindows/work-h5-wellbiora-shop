import { PersonalDataCryptoService } from '../security/personal-data-crypto.service'

import { ProfileService } from './profile.service'
import { InMemoryAddressRepository, InMemoryRealnameProfileRepository } from './profile.repository'

describe('ProfileService', () => {
  const crypto = new PersonalDataCryptoService(Buffer.alloc(32, 9).toString('base64'))
  let service: ProfileService

  beforeEach(() => {
    service = new ProfileService(new InMemoryAddressRepository(), new InMemoryRealnameProfileRepository(), crypto)
  })

  it('首个地址自动设为默认地址，之后地址可显式切换默认', async () => {
    const first = await service.createAddress('user-1', address('张三'))
    const second = await service.createAddress('user-1', { ...address('李四'), isDefault: true })
    const addresses = await service.getAddresses('user-1')

    expect(first.isDefault).toBe(true)
    expect(second.isDefault).toBe(true)
    expect(addresses).toMatchObject([{ id: first.id, isDefault: false }, { id: second.id, isDefault: true }])
  })

  it('实名查询只返回脱敏身份证号', async () => {
    await service.saveRealname('user-1', { name: '张三', idcard: '110101199001011234' })
    const profile = await service.getRealname('user-1')

    expect(profile).toEqual({ name: '张三', idcard: '110***********1234' })
    expect(JSON.stringify(profile)).not.toContain('110101199001011234')
  })

  it('已有实名资料时省略身份证号会保留原加密值', async () => {
    await service.saveRealname('user-1', { name: '张三', idcard: '110101199001011234' })

    const saved = await service.saveRealname('user-1', { name: '张三', idcard: '' } as never)

    expect(saved).toEqual({ name: '张三', idcard: '110***********1234' })
  })
})

function address(name: string) {
  return {
    name,
    phone: '13800000000',
    region: '浙江省 金华市 义乌市',
    detail: '稠城街道 1 号',
  }
}
