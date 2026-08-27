import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { UserInfo } from '@/types'
import { getUserInfo, login } from '@/api'

/** 用户 store：登录态（JWT）+ 用户信息 */
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<UserInfo | null>(null)

  const isLogin = computed(() => !!token.value)

  async function loginByCode(phone: string, code: string) {
    const res = await login(phone, code)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
  }

  async function fetchUser() {
    if (!token.value) return
    user.value = await getUserInfo()
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  return { token, user, isLogin, loginByCode, fetchUser, logout }
})
