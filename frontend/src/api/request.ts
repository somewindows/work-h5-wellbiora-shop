import axios from 'axios'
import type { ApiResponse } from '@/types'

export function getBusinessErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiResponse<unknown>> | undefined
    if (typeof body?.message === 'string' && body.message) return body.message
  }
  return error instanceof Error ? error.message : '网络请求失败，请稍后重试'
}

/** 未登录或登录失效（HTTP 401）专用错误类型，页面可识别后引导去登录 */
export class UnauthorizedError extends Error {}

/** 把 axios 错误归一化为业务 Error；401 单独映射为 UnauthorizedError */
export function toRequestError(err: unknown): Error {
  const message = getBusinessErrorMessage(err)
  if (axios.isAxiosError(err) && err.response?.status === 401) {
    return new UnauthorizedError(message)
  }
  return new Error(message)
}

/**
 * Axios 实例：统一前缀 /api/v1，统一响应壳 { code, data, message }
 * 鉴权：登录后 JWT 放 Authorization 头
 */
export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse<unknown>
    if (body.code !== 0) {
      return Promise.reject(new Error(body.message || `请求失败（${body.code}）`))
    }
    return body.data as never
  },
  (err: unknown) => Promise.reject(toRequestError(err)),
)
