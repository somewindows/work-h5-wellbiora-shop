<script setup lang="ts">
// 操作日志页：action 筛选、日期范围、分页；beforeData/afterData 用对话框格式化 JSON 查看
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { listAuditLogs } from '@/api/audit'
import { getErrorMessage } from '@/api/request'
import type { AuditLogRecord } from '@/types'
import { formatDateTime } from '@/utils/format'

const ACTION_OPTIONS = [
  { value: 'create_product', label: '新建商品' },
  { value: 'update_product', label: '更新商品' },
  { value: 'publish', label: '发布内容' },
  { value: 'rollback', label: '回滚内容' },
  { value: 'sync_order', label: '同步订单' },
  { value: 'cancel_order', label: '取消订单' },
  { value: 'refund_order', label: '订单退款' },
]

const ACTION_LABELS: Record<string, string> = Object.fromEntries(ACTION_OPTIONS.map((item) => [item.value, item.label]))

const TARGET_TYPE_LABELS: Record<string, string> = {
  catalog_product: '商品',
  order: '订单',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function targetTypeLabel(type: string): string {
  return TARGET_TYPE_LABELS[type] ?? type
}

const loading = ref(false)
const list = ref<AuditLogRecord[]>([])
const total = ref(0)
const query = reactive({ action: '', range: null as [string, string] | null, page: 1, pageSize: 20 })

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    const result = await listAuditLogs({
      action: query.action || undefined,
      from: query.range?.[0],
      // 结束日期补到当天 23:59:59，避免漏掉当天日志
      to: query.range ? `${query.range[1]}T23:59:59` : undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = result.list
    total.value = result.total
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void fetchList()
}

function onPageChange(page: number): void {
  query.page = page
  void fetchList()
}

// ---------- 改前/改后数据查看（对话框 pre 文本渲染，防 XSS） ----------
const detailVisible = ref(false)
const detailRecord = ref<AuditLogRecord | null>(null)

function formatJson(data: AuditLogRecord['beforeData']): string {
  return data === null ? '（无）' : JSON.stringify(data, null, 2)
}

function openDetail(record: AuditLogRecord): void {
  detailRecord.value = record
  detailVisible.value = true
}

onMounted(fetchList)
</script>

<template>
  <div class="page-card">
    <div class="toolbar">
      <el-select v-model="query.action" placeholder="操作类型" clearable style="width: 160px" @change="onSearch">
        <el-option v-for="option in ACTION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-date-picker
        v-model="query.range"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        @change="onSearch"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="adminUsername" label="操作人" width="120" />
      <el-table-column label="动作" width="120">
        <template #default="{ row }">{{ actionLabel(row.action) }}</template>
      </el-table-column>
      <el-table-column label="对象" min-width="160">
        <template #default="{ row }">{{ targetTypeLabel(row.targetType) }} · {{ row.targetId }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看数据</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="onPageChange"
    />

    <el-dialog v-model="detailVisible" title="变更数据（改前 → 改后）" width="760px">
      <template v-if="detailRecord">
        <h4 class="json-title">改前</h4>
        <pre class="json-view">{{ formatJson(detailRecord.beforeData) }}</pre>
        <h4 class="json-title">改后</h4>
        <pre class="json-view">{{ formatJson(detailRecord.afterData) }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.json-title {
  margin: 12px 0 6px;
  font-size: 13px;
  color: #606266;
}
</style>
