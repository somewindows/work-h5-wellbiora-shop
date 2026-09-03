import { defineStore } from 'pinia'

import { adminLogin } from '@/api/auth'
import { clearSession, getAdminUsername, isLoggedIn, saveSession } from '@/utils/session'

/** 管理员会话：token 仅存 sessionStorage，关闭标签页即失效 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    username: getAdminUsername(),
  }),
  getters: {
    loggedIn: () => isLoggedIn(),
  },
  actions: {
    async login(username: string, password: string): Promise<void> {
      const result = await adminLogin(username, password)
      saveSession(result.token, result.admin.username)
      this.username = result.admin.username
    },
    logout(): void {
      clearSession()
      this.username = ''
    },
  },
})
