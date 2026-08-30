import { describe, expect, it } from 'vitest'

import { validateIdcardForSave } from './address-realname'

describe('地址页实名信息校验', () => {
  it('已有实名资料时允许不重新填写身份证号', () => {
    expect(validateIdcardForSave('', true)).toBeNull()
  })

  it('首次实名时仍要求填写完整身份证号', () => {
    expect(validateIdcardForSave('', false)).toBe('请填写身份证号')
    expect(validateIdcardForSave('123', false)).toBe('身份证号格式不正确（18 位，末位可为 X）')
  })
})
