import axios from 'axios'

import { router } from '@/router'
import type { ApiResponse } from '@/types'
import { clearSession, getToken } from '@/utils/session'

/**
 * Axios 实例：统一前缀 /api/v1，统一响应壳 { code, data, message }
 * 鉴权：登录后 token 放 Authorization: Bearer 头（token 存 sessionStorage）
 */
export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** 401 / 40101：清会话并跳登录页（带 redirect 回跳参数） */
function handleUnauthorized(): void {
  clearSession()
  const current = router.currentRoute.value
  if (current.path !== '/login') {
    void router.push({ path: '/login', query: { redirect: current.fullPath } })
  }
}

/** 从错误中提取服务端 message（HTTP 错误也优先展示服务端 message） */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiResponse<unknown>> | undefined
    if (typeof body?.message === 'string' && body.message) return body.message
  }
  return error instanceof Error ? error.message : '网络请求失败，请稍后重试'
}

request.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse<unknown>
    if (body.code !== 0) {
      if (body.code === 40101) handleUnauthorized()
      return Promise.reject(new Error(body.message || `请求失败（${body.code}）`))
    }
    return body.data as never
  },
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) handleUnauthorized()
    return Promise.reject(new Error(getErrorMessage(err)))
  },
)
