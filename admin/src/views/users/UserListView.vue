<script setup lang="ts">
// 用户（会员）列表页：手机号关键字、注册时间范围、分页；状态与绑定/实名标记
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { listUsers } from '@/api/users'
import { getErrorMessage } from '@/api/request'
import type { AdminUserListItem } from '@/types'
import { formatDateTime, formatMoney } from '@/utils/format'
import { userStatusMeta } from '@/utils/status'

const router = useRouter()

const loading = ref(false)
const list = ref<AdminUserListItem[]>([])
const total = ref(0)
const query = reactive({ keyword: '', range: null as [string, string] | null, page: 1, pageSize: 20 })

async function fetchList(): Promise<void> {
  loading.value = true
  try {
    const result = await listUsers({
      keyword: query.keyword || undefined,
      from: query.range?.[0],
      // 结束日期补到当天 23:59:59，避免漏掉当天注册的用户
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
    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="手机号" clearable style="width: 200px" @keyup.enter="onSearch" @clear="onSearch" />
      <el-date-picker
        v-model="query.range"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="注册开始日期"
        end-placeholder="结束日期"
        @change="onSearch"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="phoneMasked" label="手机号" width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="140" show-overflow-tooltip />
      <el-table-column label="微信绑定" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.wechatBound ? 'success' : 'info'" effect="plain">{{ row.wechatBound ? '已绑定' : '未绑定' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="实名" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.realnamed ? 'success' : 'info'" effect="plain">{{ row.realnamed ? '已实名' : '未实名' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderCount" label="订单数" width="90" align="right" />
      <el-table-column label="累计消费" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.paidTotalFen) }}</template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="userStatusMeta(row.disabled).tagType">{{ userStatusMeta(row.disabled).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/users/${row.id}`)">详情</el-button>
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
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
