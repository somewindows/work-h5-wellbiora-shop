<script setup lang="ts">
// 订单列表页：状态 Tab、关键字（订单号/手机号）、日期范围、分页；海关退单醒目标记
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { listOrders } from '@/api/orders'
import { getErrorMessage } from '@/api/request'
import type { AdminOrderListItem } from '@/types'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ORDER_STATUS_TABS, orderStatusMeta, paymentStatusMeta } from '@/utils/status'

const router = useRouter()

const loading = ref(false)
const list = ref<AdminOrderListItem[]>([])
const total = ref(0)
const query = reactive({ status: '', keyword: '', range: null as [string, string] | null, page: 1, pageSize: 20 })

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    const result = await listOrders({
      status: query.status || undefined,
      keyword: query.keyword || undefined,
      from: query.range?.[0],
      // 结束日期补到当天 23:59:59，避免漏掉当天订单
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

onMounted(fetchList)
</script>

<template>
  <div class="page-card">
    <el-tabs v-model="query.status" @tab-change="onSearch">
      <el-tab-pane v-for="tab in ORDER_STATUS_TABS" :key="tab.key" :label="tab.label" :name="tab.key" />
    </el-tabs>

    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="订单号 / 收货手机号" clearable style="width: 240px" @keyup.enter="onSearch" @clear="onSearch" />
      <el-date-picker
        v-model="query.range"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="创建开始日期"
        end-placeholder="结束日期"
        @change="onSearch"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="orderNo" label="订单号" min-width="180" />
      <el-table-column label="收货人" width="160">
        <template #default="{ row }">
          <div>{{ row.receiverName }}</div>
          <div class="sub-text">{{ row.receiverPhone }}</div>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.totalFen) }}</template>
      </el-table-column>
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
      <el-table-column label="海关/仓储" min-width="160">
        <template #default="{ row }">
          <template v-if="row.customsRejected">
            <el-tag type="danger">海关拦截</el-tag>
            <div class="reject-remark">{{ row.systemRemark }}</div>
          </template>
          <span v-else class="sub-text">{{ row.warehouseStatus ?? '未推送' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/orders/${row.orderNo}`)">详情</el-button>
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
  </div>
</template>

<style scoped>
.sub-text {
  font-size: 12px;
  color: #909399;
}

.reject-remark {
  margin-top: 4px;
  font-size: 12px;
  color: #e6432d;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
