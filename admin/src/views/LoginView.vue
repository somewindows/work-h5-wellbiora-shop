<script setup lang="ts">
// 登录页：账号密码登录，错误原样展示服务端 message；已登录会被守卫重定向到首页
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'

import { getErrorMessage } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMessage = ref('')

const form = reactive({ username: '', password: '' })

// 与服务端 AdminLoginDto 一致的规则（用户名 3-64 位字母数字._-；密码 12-128 位）
const rules: FormRules = {
  username: [
    { required: true, message: '请输入管理员账号', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_.-]{3,64}$/, message: '账号为 3-64 位字母、数字或 _ . -', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 12, max: 128, message: '密码长度 12-128 位', trigger: 'blur' },
  ],
}

async function onSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.login(form.username, form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/products'
    await router.push(redirect)
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="brand">
        <div class="brand-name">WELLBIORA™</div>
        <div class="brand-sub">跨境电商 H5 商城 · 运营后台</div>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="onSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="管理员账号" autocomplete="username" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="false" class="login-error" />
        <el-button type="primary" native-type="submit" :loading="loading" class="login-button">登 录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #033b3c 0%, #022829 100%);
}

.login-card {
  width: 380px;
}

.brand {
  text-align: center;
  margin-bottom: 24px;
}

.brand-name {
  font-size: 22px;
  font-weight: 700;
  color: #033b3c;
  letter-spacing: 0.08em;
}

.brand-sub {
  margin-top: 6px;
  font-size: 13px;
  color: #909399;
}

.login-error {
  margin-bottom: 16px;
}

.login-button {
  width: 100%;
}
</style>
