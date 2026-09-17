<script setup lang="ts">
// 数据概览首页：今日四张统计卡（今日订单/今日支付金额/待发货/退款中）+ 昨日对比小字 + 近 7 天订单趋势（纯 CSS 柱状图，不引图表库）
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { getErrorMessage } from '@/api/request'
import { getStatsOverview } from '@/api/stats'
import type { StatsOverview } from '@/types'
import { formatMoney } from '@/utils/format'
import { buildTrendBars } from '@/utils/stats'

const router = useRouter()
const loading = ref(false)
const overview = ref<StatsOverview | null>(null)

const trendBars = computed(() => buildTrendBars(overview.value?.trend ?? []))

async function fetchOverview(): Promise<void> {
  loading.value = true
  try {
    overview.value = await getStatsOverview()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(fetchOverview)
</script>

<template>
  <div v-loading="loading" class="page-card">
    <template v-if="overview">
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-card-title">今日订单</div>
          <div class="stat-card-value">{{ overview.today.orderCount }}</div>
          <div class="stat-card-sub">昨日 {{ overview.yesterday.orderCount }} 单</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">今日支付金额</div>
          <div class="stat-card-value">{{ formatMoney(overview.today.paidTotalFen) }}</div>
          <div class="stat-card-sub">昨日 {{ formatMoney(overview.yesterday.paidTotalFen) }}（{{ overview.yesterday.paidCount }} 笔）</div>
        </div>
        <!-- 待发货：点击跳订单列表并带状态筛选 -->
        <div class="stat-card stat-card-link" @click="router.push('/orders?status=ship')">
          <div class="stat-card-title">待发货</div>
          <div class="stat-card-value">{{ overview.pendingShipment }}</div>
          <div class="stat-card-sub">点击查看待发货订单 →</div>
        </div>
        <!-- 退款中：订单列表暂无支付状态筛选，直接跳列表 -->
        <div class="stat-card stat-card-link" @click="router.push('/orders')">
          <div class="stat-card-title">退款中</div>
          <div class="stat-card-value">{{ overview.refundingCount }}</div>
          <div class="stat-card-sub">点击查看订单列表 →</div>
        </div>
      </div>

      <div class="section-title">近 7 天订单趋势</div>
      <div class="trend-chart">
        <div v-for="bar in trendBars" :key="bar.date" class="trend-col">
          <div class="trend-count">{{ bar.orderCount }}</div>
          <div class="trend-bar-track">
            <div
              class="trend-bar"
              :class="{ 'trend-bar-zero': bar.orderCount === 0 }"
              :style="{ height: `${bar.heightPercent}%` }"
            />
          </div>
          <div class="trend-date">{{ bar.label }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat-cards {
  display: flex;
  gap: 16px;
}

.stat-card {
  flex: 1;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
}

.stat-card-link {
  cursor: pointer;
}

.stat-card-link:hover {
  border-color: #033b3c;
}

.stat-card-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-card-value {
  font-size: 26px;
  font-weight: 700;
  color: #033b3c;
}

.stat-card-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.section-title {
  margin: 24px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.trend-chart {
  display: flex;
  gap: 16px;
  align-items: stretch;
  height: 200px;
  padding: 8px 4px 0;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.trend-count {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.trend-bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.trend-bar {
  width: 40%;
  min-width: 24px;
  border-radius: 4px 4px 0 0;
  background-color: #033b3c;
}

/* 有单但归一后高度过小时保底可见；零单仅留底色细条 */
.trend-bar:not(.trend-bar-zero) {
  min-height: 4px;
}

.trend-bar-zero {
  height: 2px !important;
  background-color: #dcdfe6;
}

.trend-date {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
</style>
