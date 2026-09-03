<script setup lang="ts">
// 订单详情页：三层状态并排、商品明细、收货与实名信息（已脱敏）、状态事件流、同步/取消/退款操作
// 取消与退款必须经二次确认对话框，confirm:true 只能由对话框确认按钮触发
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import { cancelOrder, getOrder, refundOrder, syncOrder } from '@/api/orders'
import { getErrorMessage } from '@/api/request'
import type { AdminOrderDetail } from '@/types'
import { fenToYuan, formatDateTime, formatMoney, yuanToFen } from '@/utils/format'
import { eventSourceLabel, orderStatusMeta, paymentStatusMeta } from '@/utils/status'

const route = useRoute()
const orderNo = route.params.orderNo as string

const loading = ref(false)
const order = ref<AdminOrderDetail | null>(null)
const syncing = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    order.value = await getOrder(orderNo)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function onSync(): Promise<void> {
  syncing.value = true
  try {
    order.value = await syncOrder(orderNo)
    ElMessage.success('已同步仓储状态')
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    syncing.value = false
  }
}

// ---------- 取消订单（二次确认；待支付=直接关闭，已支付=撤单+全额原路退款） ----------
const cancelVisible = ref(false)
const canceling = ref(false)

const cancelHint = computed(() => {
  if (!order.value) return ''
  if (order.value.paymentStatus === 'pending') return '该订单尚未支付，取消将直接关闭订单，无资金动作。'
  if (order.value.paymentStatus === 'paid') return '该订单已支付，取消将撤回保税仓订单并全额原路退款；若已申报清关，服务端会拒绝并提示走人工流程。'
  return '该订单当前状态可能不支持取消，以服务端校验结果为准。'
})

async function confirmCancel(): Promise<void> {
  canceling.value = true
  try {
    order.value = await cancelOrder(orderNo)
    ElMessage.success('订单已取消')
    cancelVisible.value = false
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    canceling.value = false
  }
}

// ---------- 退款（二次确认 + 金额校验：0 < 金额 ≤ 实付，缺省全额） ----------
const refundVisible = ref(false)
const refunding = ref(false)
const refundYuan = ref(0)

function openRefund(): void {
  if (!order.value) return
  refundYuan.value = Number(fenToYuan(order.value.totalFen))
  refundVisible.value = true
}

async function confirmRefund(): Promise<void> {
  if (!order.value) return
  const amountFen = yuanToFen(refundYuan.value)
  if (amountFen <= 0 || amountFen > order.value.totalFen) {
    ElMessage.warning(`退款金额需在 0 与实付金额 ${formatMoney(order.value.totalFen)} 之间`)
    return
  }
  try {
    await ElMessageBox.confirm(`确认退款 ${formatMoney(amountFen)} 吗？退款将原路退回用户支付账户。`, '退款确认', {
      type: 'warning',
      confirmButtonText: '确认退款',
      cancelButtonText: '再想想',
    })
  } catch {
    return
  }
  refunding.value = true
  try {
    order.value = await refundOrder(orderNo, amountFen)
    ElMessage.success('退款成功')
    refundVisible.value = false
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    refunding.value = false
  }
}

const canOperate = computed(() => order.value && order.value.status !== 'cancelled')

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page-card">
    <template v-if="order">
      <div class="detail-head">
        <el-button link @click="$router.back()">← 返回列表</el-button>
        <span class="order-no">订单号：{{ order.orderNo }}</span>
        <el-tag v-if="order.customsRejected" type="danger">海关拦截</el-tag>
        <div class="spacer" />
        <el-button size="small" :loading="syncing" @click="onSync">同步仓储状态</el-button>
        <el-button size="small" type="danger" plain :disabled="!canOperate" @click="cancelVisible = true">取消订单</el-button>
        <el-button
          size="small"
          type="warning"
          plain
          :disabled="!canOperate || order.paymentStatus !== 'paid'"
          @click="openRefund"
        >退款</el-button>
      </div>

      <!-- 海关拦截信息醒目展示（文本渲染，不用 v-html） -->
      <el-alert v-if="order.customsRejected" type="error" show-icon :closable="false" class="reject-alert">
        <template #title>仓储/海关拦截信息：{{ order.systemRemark }}</template>
      </el-alert>

      <!-- 三层状态并排 -->
      <div class="status-cards">
        <div class="status-card">
          <div class="status-card-title">本地主状态</div>
          <el-tag :type="orderStatusMeta(order.status).tagType" size="large">{{ orderStatusMeta(order.status).label }}</el-tag>
        </div>
        <div class="status-card">
          <div class="status-card-title">支付状态</div>
          <el-tag :type="paymentStatusMeta(order.paymentStatus).tagType" size="large">{{ paymentStatusMeta(order.paymentStatus).label }}</el-tag>
          <div v-if="order.refundFen !== null" class="status-extra">已退款 {{ formatMoney(order.refundFen) }}（{{ formatDateTime(order.refundedAt) }}）</div>
        </div>
        <div class="status-card">
          <div class="status-card-title">仓储原始状态</div>
          <el-tag type="info" size="large">{{ order.warehouseStatus ?? '未推送' }}</el-tag>
        </div>
      </div>

      <el-descriptions :column="2" border class="info-block">
        <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ formatDateTime(order.paidAt) }}</el-descriptions-item>
        <el-descriptions-item label="取消时间">{{ formatDateTime(order.cancelledAt) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(order.createdAt) }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="section-title">商品明细</h3>
      <el-table :data="order.items" border>
        <el-table-column prop="productId" label="商品 ID" width="100" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="spec" label="规格" min-width="140" />
        <el-table-column label="单价" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.priceFen) }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" align="center" />
        <el-table-column label="小计" width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.priceFen * row.quantity) }}</template>
        </el-table-column>
      </el-table>
      <div class="total-line">合计：<span class="total-amount">{{ formatMoney(order.totalFen) }}</span></div>

      <h3 class="section-title">收货与实名信息（已脱敏）</h3>
      <el-descriptions :column="1" border class="info-block">
        <el-descriptions-item label="收货人">{{ order.address.name }}（{{ order.address.phone }}）</el-descriptions-item>
        <el-descriptions-item label="收货地址">{{ order.address.line }}</el-descriptions-item>
        <el-descriptions-item label="实名姓名">{{ order.idName }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ order.idcard }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="section-title">状态事件流</h3>
      <el-timeline class="event-timeline">
        <el-timeline-item v-for="(event, index) in order.statusEvents" :key="index" :timestamp="formatDateTime(event.createdAt)" placement="top">
          <div>
            <el-tag size="small" effect="plain">{{ eventSourceLabel(event.source) }}</el-tag>
            <span class="event-status">
              {{ event.fromStatus ? `${orderStatusMeta(event.fromStatus).label} → ` : '' }}{{ orderStatusMeta(event.toStatus).label }}
            </span>
          </div>
          <div v-if="event.remark" class="event-remark">{{ event.remark }}</div>
        </el-timeline-item>
      </el-timeline>

      <!-- 取消订单对话框 -->
      <el-dialog v-model="cancelVisible" title="取消订单" width="480px" :close-on-click-modal="false">
        <el-alert type="warning" show-icon :closable="false" :title="cancelHint" />
        <p class="dialog-note">取消操作不可撤销，确认后立即执行。</p>
        <template #footer>
          <el-button @click="cancelVisible = false">再想想</el-button>
          <el-button type="danger" :loading="canceling" @click="confirmCancel">确认取消订单</el-button>
        </template>
      </el-dialog>

      <!-- 退款对话框 -->
      <el-dialog v-model="refundVisible" title="订单退款" width="480px" :close-on-click-modal="false">
        <div class="refund-form">
          <span>退款金额（元）：</span>
          <el-input-number v-model="refundYuan" :min="0.01" :precision="2" style="width: 180px" />
          <span class="sub-text">实付 {{ formatMoney(order.totalFen) }}，默认全额</span>
        </div>
        <template #footer>
          <el-button @click="refundVisible = false">取消</el-button>
          <el-button type="warning" :loading="refunding" @click="confirmRefund">确认退款</el-button>
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

.order-no {
  font-size: 14px;
  font-weight: 600;
}

.reject-alert {
  margin-bottom: 16px;
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

.status-extra {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.info-block {
  margin-bottom: 8px;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 15px;
}

.total-line {
  margin-top: 12px;
  text-align: right;
}

.total-amount {
  color: #e6432d;
  font-weight: 700;
}

.event-timeline {
  padding-left: 4px;
}

.event-status {
  margin-left: 8px;
}

.event-remark {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.dialog-note {
  font-size: 13px;
  color: #606266;
}

.refund-form {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sub-text {
  font-size: 12px;
  color: #909399;
}
</style>
