// session 会话工具单测：node 环境下用内存对象 stub sessionStorage
import { beforeEach, describe, expect, it } from 'vitest'

import { clearMustChangePassword, clearSession, getAdminRole, getAdminUsername, getMustChangePassword, getToken, isLoggedIn, saveSession } from './session'

class SessionStorageStub {
  private readonly store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).sessionStorage = new SessionStorageStub()
})

describe('session 会话存取', () => {
  it('保存会话后可读回 token/用户名/角色/改密标记', () => {
    saveSession('token-1', 'operator', 'super', true)

    expect(getToken()).toBe('token-1')
    expect(getAdminUsername()).toBe('operator')
    expect(getAdminRole()).toBe('super')
    expect(getMustChangePassword()).toBe(true)
    expect(isLoggedIn()).toBe(true)
  })

  it('改密标记为 false 时存 0，clearMustChangePassword 只清该标记', () => {
    saveSession('token-1', 'operator', 'admin', false)
    expect(getMustChangePassword()).toBe(false)

    saveSession('token-1', 'operator', 'admin', true)
    clearMustChangePassword()
    expect(getMustChangePassword()).toBe(false)
    expect(getToken()).toBe('token-1')
  })

  it('clearSession 清空全部会话字段', () => {
    saveSession('token-1', 'operator', 'super', true)
    clearSession()

    expect(getToken()).toBeNull()
    expect(getAdminUsername()).toBe('')
    expect(getAdminRole()).toBe('')
    expect(getMustChangePassword()).toBe(false)
    expect(isLoggedIn()).toBe(false)
  })
})
