import { describe, expect, it } from 'vitest'

import { extractDevToken } from './dev-token'

describe('extractDevToken', () => {
  it('从 query 中取出 dev_token', () => {
    expect(extractDevToken('?dev_token=abc.def.ghi&x=1')).toBe('abc.def.ghi')
  })

  it('无 dev_token 返回 null', () => {
    expect(extractDevToken('?x=1')).toBeNull()
    expect(extractDevToken('')).toBeNull()
  })
})
