<script setup lang="ts">
// 管理员账号列表（仅超级管理员可见，路由守卫 + 服务端双重校验）
// 新建/重置密码返回的一次性临时密码仅本次可见：结果对话框大号等宽展示 + 复制按钮，纯文本渲染（禁 v-html）
// 禁用/启用/重置均为二次确认对话框触发（confirm:true 不做默认勾选）
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { createAccount, disableAccount, enableAccount, listAccounts, resetPassword } from '@/api/accounts'
import { getErrorMessage } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import type { AdminAccount } from '@/types'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
const list = ref<AdminAccount[]>([])

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    list.value = await listAccounts()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

// ---------- 新增管理员（480px 确认对话框 → 临时密码结果对话框） ----------
const createVisible = ref(false)
const creating = ref(false)
const createForm = reactive({ username: '' })

function openCreate(): void {
  createForm.username = ''
  createVisible.value = true
}

async function confirmCreate(): Promise<void> {
  creating.value = true
  try {
    const result = await createAccount(createForm.username.trim())
    createVisible.value = false
    showTempPassword(result.account.username, result.tempPassword)
    await fetchList()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    creating.value = false
  }
}

// ---------- 禁用 / 启用（二次确认） ----------
const toggleVisible = ref(false)
const toggling = ref(false)
const toggleTarget = ref<AdminAccount | null>(null)

function openToggle(row: AdminAccount): void {
  toggleTarget.value = row
  toggleVisible.value = true
}

async function confirmToggle(): Promise<void> {
  const target = toggleTarget.value
  if (!target) return
  toggling.value = true
  try {
    if (target.disabled) {
      await enableAccount(target.id)
      ElMessage.success(`已启用管理员 ${target.username}`)
    } else {
      await disableAccount(target.id)
      ElMessage.success(`已禁用管理员 ${target.username}`)
    }
    toggleVisible.value = false
    await fetchList()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    toggling.value = false
  }
}

// ---------- 重置密码（二次确认 → 临时密码结果对话框） ----------
const resetVisible = ref(false)
const resetting = ref(false)
const resetTarget = ref<AdminAccount | null>(null)

function openReset(row: AdminAccount): void {
  resetTarget.value = row
  resetVisible.value = true
}

async function confirmReset(): Promise<void> {
  const target = resetTarget.value
  if (!target) return
  resetting.value = true
  try {
    const result = await resetPassword(target.id)
    resetVisible.value = false
    showTempPassword(result.account.username, result.tempPassword)
    await fetchList()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    resetting.value = false
  }
}

// ---------- 一次性临时密码结果对话框（新建/重置共用） ----------
const tempVisible = ref(false)
const tempInfo = reactive({ username: '', password: '' })

function showTempPassword(username: string, password: string): void {
  tempInfo.username = username
  tempInfo.password = password
  tempVisible.value = true
}

async function copyTempPassword(): Promise<void> {
  try {
    await navigator.clipboard.writeText(tempInfo.password)
    ElMessage.success('已复制临时密码')
  } catch {
    ElMessage.warning('复制失败，请手动选中密码复制')
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="page-card">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增管理员</el-button>
      <span class="toolbar-hint">新账号为普通管理员，凭一次性临时密码首次登录后强制改密</span>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="username" label="用户名" min-width="160" show-overflow-tooltip />
      <el-table-column label="角色" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super' ? 'warning' : 'info'" effect="plain">{{ row.role === 'super' ? '超级管理员' : '管理员' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.disabled ? 'danger' : 'success'">{{ row.disabled ? '已禁用' : '正常' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="改密标记" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.mustChangePassword" type="warning" effect="plain">首登待改密</el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <!-- 自己的账号不在此处操作（服务端同样拒绝），改密走顶栏「修改密码」 -->
          <template v-if="row.username !== auth.username">
            <el-button link :type="row.disabled ? 'success' : 'danger'" @click="openToggle(row)">{{ row.disabled ? '启用' : '禁用' }}</el-button>
            <el-button link type="primary" @click="openReset(row)">重置密码</el-button>
          </template>
          <span v-else class="muted">当前账号</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增管理员确认对话框 -->
    <el-dialog v-model="createVisible" title="新增管理员" width="480px" :close-on-click-modal="false">
      <el-alert type="info" show-icon :closable="false" title="创建成功后将生成一次性临时密码，仅显示一次，请当场复制给使用人。" />
      <el-form class="dialog-form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" placeholder="3-64 位字母、数字或 _ . -" maxlength="64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" :disabled="!createForm.username.trim()" @click="confirmCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 禁用/启用二次确认对话框 -->
    <el-dialog v-model="toggleVisible" :title="toggleTarget?.disabled ? '启用管理员' : '禁用管理员'" width="480px" :close-on-click-modal="false">
      <el-alert
        :type="toggleTarget?.disabled ? 'info' : 'warning'"
        show-icon
        :closable="false"
        :title="toggleTarget?.disabled ? '启用后该管理员恢复登录，历史登录态在有效期内恢复可用。' : '禁用后该管理员无法登录，已签发的登录态立即失效。'"
      />
      <p class="dialog-note">操作对象：{{ toggleTarget?.username }}。操作会写入审计日志。</p>
      <template #footer>
        <el-button @click="toggleVisible = false">再想想</el-button>
        <el-button :type="toggleTarget?.disabled ? 'primary' : 'danger'" :loading="toggling" @click="confirmToggle">
          {{ toggleTarget?.disabled ? '确认启用' : '确认禁用' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 重置密码二次确认对话框 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="480px" :close-on-click-modal="false">
      <el-alert type="warning" show-icon :closable="false" title="重置后原密码立即失效，将生成新的一次性临时密码（仅显示一次），该管理员首次登录后须强制改密。" />
      <p class="dialog-note">操作对象：{{ resetTarget?.username }}。操作会写入审计日志。</p>
      <template #footer>
        <el-button @click="resetVisible = false">再想想</el-button>
        <el-button type="danger" :loading="resetting" @click="confirmReset">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 一次性临时密码结果对话框（新建/重置共用） -->
    <el-dialog v-model="tempVisible" title="一次性临时密码" width="480px" :close-on-click-modal="false" :show-close="false" :close-on-press-escape="false">
      <el-alert type="error" show-icon :closable="false" title="临时密码仅显示这一次，关闭后无法再查看，请立即复制并妥善转交。" />
      <p class="dialog-note">账号：{{ tempInfo.username }}</p>
      <div class="temp-password">{{ tempInfo.password }}</div>
      <template #footer>
        <el-button @click="copyTempPassword">复制密码</el-button>
        <el-button type="primary" @click="tempVisible = false">我已妥善保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.toolbar-hint {
  font-size: 13px;
  color: #909399;
}

.muted {
  color: #c0c4cc;
  font-size: 13px;
}

.dialog-form {
  margin-top: 16px;
}

.dialog-note {
  font-size: 13px;
  color: #606266;
}

.temp-password {
  margin: 8px 0 4px;
  padding: 14px 16px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  background: #f7f8fa;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 22px;
  letter-spacing: 0.12em;
  text-align: center;
  user-select: all;
}
</style>
