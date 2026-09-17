<script setup lang="ts">
// 修改密码页：任何登录管理员可用；强制改密（首登/被重置）时由路由守卫重定向到此
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { changePassword } from '@/api/auth'
import { getErrorMessage } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const rules: FormRules<typeof form> = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 12, max: 128, message: '新密码长度需为 12-128 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== form.newPassword) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await changePassword(form.oldPassword, form.newPassword)
    // 清除强制改密标记，解除路由守卫限制
    auth.markPasswordChanged()
    ElMessage.success('密码已修改')
    void router.push('/products')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-card password-page">
    <el-alert
      v-if="auth.mustChangePassword"
      type="warning"
      show-icon
      :closable="false"
      class="force-hint"
      title="当前使用的是一次性临时密码，为保障账号安全，请先设置新密码后再使用其他功能。"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="password-form">
      <el-form-item label="当前密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password autocomplete="current-password" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" placeholder="12-128 位" />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" show-password autocomplete="new-password" @keyup.enter="submit" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="submitting" @click="submit">确认修改</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.password-page {
  max-width: 520px;
}

.force-hint {
  margin-bottom: 16px;
}

.password-form {
  margin-top: 8px;
}
</style>
