import { PersonalDataCryptoService } from './personal-data-crypto.service'

describe('PersonalDataCryptoService', () => {
  const key = Buffer.alloc(32, 7).toString('base64')

  it('加密后可以还原身份证号，且密文不包含明文', () => {
    const service = new PersonalDataCryptoService(key)
    const idcard = '110101199001011234'
    const encrypted = service.encrypt(idcard)

    expect(encrypted).not.toContain(idcard)
    expect(service.decrypt(encrypted)).toBe(idcard)
  })

  it('密钥长度不符合 AES-256 要求时拒绝初始化', () => {
    expect(() => new PersonalDataCryptoService(Buffer.alloc(16).toString('base64'))).toThrow('PERSONAL_DATA_KEY')
  })

  it('为同一身份证生成稳定且不可逆的查询指纹', () => {
    const service = new PersonalDataCryptoService(key)
    const fingerprint = service.fingerprint('110101199001011234')

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(fingerprint).toBe(service.fingerprint('110101199001011234'))
    expect(fingerprint).not.toContain('110101199001011234')
  })
})
