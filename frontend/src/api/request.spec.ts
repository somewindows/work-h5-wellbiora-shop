import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { getBusinessErrorMessage, toRequestError, UnauthorizedError } from './request'

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

describe('toRequestError', () => {
  it('HTTP 401 映射为 UnauthorizedError，页面可据此引导登录', () => {
    const response = {
      status: 401,
      data: { code: 40100, message: '请先登录', data: null },
    } as AxiosResponse
    const error = new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', undefined, undefined, response)

    expect(toRequestError(error)).toBeInstanceOf(UnauthorizedError)
  })

  it('其他 HTTP 错误保持为普通 Error', () => {
    const response = {
      status: 500,
      data: { code: 50000, message: '服务器繁忙', data: null },
    } as AxiosResponse
    const error = new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', undefined, undefined, response)

    const result = toRequestError(error)
    expect(result).toBeInstanceOf(Error)
    expect(result).not.toBeInstanceOf(UnauthorizedError)
    expect(result.message).toBe('服务器繁忙')
  })
})
