import { defineStore } from 'pinia'

import { adminLogin } from '@/api/auth'
import { clearMustChangePassword, clearSession, getAdminRole, getAdminUsername, getMustChangePassword, isLoggedIn, saveSession } from '@/utils/session'

/** 管理员会话：token 仅存 sessionStorage，关闭标签页即失效 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    username: getAdminUsername(),
    role: getAdminRole(),
    mustChangePassword: getMustChangePassword(),
  }),
  getters: {
    loggedIn: () => isLoggedIn(),
    isSuper: (state) => state.role === 'super',
  },
  actions: {
    async login(username: string, password: string): Promise<void> {
      const result = await adminLogin(username, password)
      saveSession(result.token, result.admin.username, result.admin.role, result.admin.mustChangePassword)
      this.username = result.admin.username
      this.role = result.admin.role
      this.mustChangePassword = result.admin.mustChangePassword
    },
    /** 修改密码成功后清除强制改密标记 */
    markPasswordChanged(): void {
      this.mustChangePassword = false
      clearMustChangePassword()
    },
    logout(): void {
      clearSession()
      this.username = ''
      this.role = ''
      this.mustChangePassword = false
    },
  },
})
