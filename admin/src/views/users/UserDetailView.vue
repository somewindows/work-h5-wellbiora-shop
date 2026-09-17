<script setup lang="ts">
// 用户详情页：年度额度卡、订单/消费/地址统计、基本信息（全部脱敏）、该用户订单列表、禁用/启用
// 禁用与启用必须经二次确认对话框，confirm:true 只能由对话框确认按钮触发
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

import { disableUser, enableUser, getUserDetail } from '@/api/users'
import { listOrders } from '@/api/orders'
import { getErrorMessage } from '@/api/request'
import type { AdminOrderListItem, AdminUserDetail } from '@/types'
import { formatDateTime, formatMoney } from '@/utils/format'
import { orderStatusMeta, paymentStatusMeta, userStatusMeta } from '@/utils/status'

const route = useRoute()
const userId = route.params.id as string

const loading = ref(false)
const user = ref<AdminUserDetail | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    user.value = await getUserDetail(userId)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

// ---------- 禁用 / 启用（二次确认：居中 el-dialog + el-alert 警告，confirm:true 由确认按钮触发） ----------
const toggleVisible = ref(false)
const toggling = ref(false)

const toggleAction = computed(() => (user.value?.disabled ? 'enable' : 'disable'))
const toggleHint = computed(() =>
  toggleAction.value === 'disable'
    ? '禁用后该用户将无法接收登录验证码、无法登录，已签发的登录态立即失效；已有订单与退款不受影响。'
    : '启用后该用户恢复接收验证码与登录，历史登录态在有效期内恢复可用。',
)

async function confirmToggle(): Promise<void> {
  toggling.value = true
  try {
    user.value = toggleAction.value === 'disable' ? await disableUser(userId) : await enableUser(userId)
    ElMessage.success(toggleAction.value === 'disable' ? '已禁用该用户' : '已启用该用户')
    toggleVisible.value = false
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    toggling.value = false
  }
}

// ---------- 该用户订单列表（复用后台订单接口的 userId 过滤，精简列） ----------
const ordersLoading = ref(false)
const orders = ref<AdminOrderListItem[]>([])
const ordersTotal = ref(0)
const ordersPage = ref(1)
const ORDERS_PAGE_SIZE = 10

async function loadOrders(): Promise<void> {
  ordersLoading.value = true
  try {
    const result = await listOrders({ userId, page: ordersPage.value, pageSize: ORDERS_PAGE_SIZE })
    orders.value = result.list
    ordersTotal.value = result.total
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    ordersLoading.value = false
  }
}

function onOrdersPageChange(page: number): void {
  ordersPage.value = page
  void loadOrders()
}

const quotaPercent = computed(() => {
  const quota = user.value?.yearlyQuota
  if (!quota || quota.limitFen <= 0) return 0
  return Math.min(100, Math.round((quota.occupiedFen / quota.limitFen) * 100))
})

onMounted(() => {
  void load()
  void loadOrders()
})
</script>

<template>
  <div v-loading="loading" class="page-card">
    <template v-if="user">
      <div class="detail-head">
        <el-button link @click="$router.back()">← 返回列表</el-button>
        <span class="user-phone">{{ user.phoneMasked }}</span>
        <el-tag :type="userStatusMeta(user.disabled).tagType">{{ userStatusMeta(user.disabled).label }}</el-tag>
        <div class="spacer" />
        <el-button size="small" type="danger" plain @click="toggleVisible = true">
          {{ user.disabled ? '启用用户' : '禁用用户' }}
        </el-button>
      </div>

      <div class="status-cards">
        <div class="status-card">
          <div class="status-card-title">{{ user.yearlyQuota.year }} 年度跨境额度</div>
          <div class="quota-line">已占 {{ formatMoney(user.yearlyQuota.occupiedFen) }} / 上限 {{ formatMoney(user.yearlyQuota.limitFen) }}</div>
          <el-progress :percentage="quotaPercent" :stroke-width="8" :show-text="false" />
          <div class="status-extra">剩余 {{ formatMoney(user.yearlyQuota.remainingFen) }}</div>
        </div>
        <div class="status-card">
          <div class="status-card-title">订单数</div>
          <div class="status-value">{{ user.orderCount }}</div>
        </div>
        <div class="status-card">
          <div class="status-card-title">累计消费</div>
          <div class="status-value">{{ formatMoney(user.paidTotalFen) }}</div>
        </div>
        <div class="status-card">
          <div class="status-card-title">地址数</div>
          <div class="status-value">{{ user.addressCount }}</div>
        </div>
      </div>

      <h3 class="section-title">基本信息（已脱敏）</h3>
      <el-descriptions :column="2" border class="info-block">
        <el-descriptions-item label="手机号">{{ user.phoneMasked }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ user.nickname }}</el-descriptions-item>
        <el-descriptions-item label="微信绑定">
          <el-tag :type="user.wechatBound ? 'success' : 'info'" effect="plain" size="small">{{ user.wechatBound ? '已绑定' : '未绑定' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="实名状态">
          <template v-if="user.realnamed">已实名（{{ user.realnameNameMasked }}）</template>
          <template v-else>未实名</template>
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ formatDateTime(user.createdAt) }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="section-title">订单记录</h3>
      <el-table v-loading="ordersLoading" :data="orders" border>
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column label="订单状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="orderStatusMeta(row.status).tagType">{{ orderStatusMeta(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="支付状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="paymentStatusMeta(row.paymentStatus).tagType" effect="plain">{{ paymentStatusMeta(row.paymentStatus).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.totalFen) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/orders/${row.orderNo}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pager"
        layout="total, prev, pager, next"
        :total="ordersTotal"
        :page-size="ORDERS_PAGE_SIZE"
        :current-page="ordersPage"
        @current-change="onOrdersPageChange"
      />

      <!-- 禁用/启用二次确认对话框 -->
      <el-dialog v-model="toggleVisible" :title="toggleAction === 'disable' ? '禁用用户' : '启用用户'" width="480px" :close-on-click-modal="false">
        <el-alert :type="toggleAction === 'disable' ? 'warning' : 'info'" show-icon :closable="false" :title="toggleHint" />
        <p class="dialog-note">操作对象：{{ user.phoneMasked }}。操作会写入审计日志。</p>
        <template #footer>
          <el-button @click="toggleVisible = false">再想想</el-button>
          <el-button :type="toggleAction === 'disable' ? 'danger' : 'primary'" :loading="toggling" @click="confirmToggle">
            {{ toggleAction === 'disable' ? '确认禁用' : '确认启用' }}
          </el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<style scoped>
.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-head .spacer {
  flex: 1;
}

.user-phone {
  font-size: 14px;
  font-weight: 600;
}

.status-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.status-card {
  flex: 1;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
}

.status-card-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.status-value {
  font-size: 20px;
  font-weight: 600;
}

.quota-line {
  font-size: 13px;
  margin-bottom: 8px;
}

.status-extra {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 15px;
}

.info-block {
  margin-bottom: 8px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.dialog-note {
  font-size: 13px;
  color: #606266;
}
</style>
