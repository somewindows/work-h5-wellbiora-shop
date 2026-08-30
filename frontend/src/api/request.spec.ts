import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { getBusinessErrorMessage } from './request'

describe('getBusinessErrorMessage', () => {
  it('优先返回服务端统一响应壳中的业务错误信息', () => {
    const response = {
      data: { code: 40004, message: '验证码错误或已过期', data: null },
    } as AxiosResponse
    const error = new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined, response)

    expect(getBusinessErrorMessage(error)).toBe('验证码错误或已过期')
  })

  it('服务端没有业务信息时保留原始错误信息', () => {
    expect(getBusinessErrorMessage(new Error('网络连接失败'))).toBe('网络连接失败')
  })
})
