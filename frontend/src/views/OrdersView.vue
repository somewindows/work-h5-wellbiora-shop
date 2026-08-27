<script setup lang="ts">
/**
 * 订单列表页（路由 /orders，支持 ?tab=pay|ship|recv|done|cancelled 直达状态筛选）
 * 视觉来源：prototype/app/orders.html（状态 Tab + 订单卡 + 空态 + 页脚合规小字）
 * 说明：mock 阶段不做强制登录拦截（路由守卫后续统一加），未登录也能看 mock 数据
 */
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getOrders } from '@/api'
import type { Order, OrderStatus } from '@/types'
import { ORDER_STATUS_MAP } from '../../mock/orders'
import { fenToYuan } from '@/utils/format'

const route = useRoute()
const router = useRouter()

/* 状态 Tab：全部 + 五种订单状态（与原型 TABS 一致） */
const TABS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pay', label: '待付款' },
  { key: 'ship', label: '待发货' },
  { key: 'recv', label: '待收货' },
  { key: 'done', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

const curTab = ref<OrderStatus | 'all'>('all')
const orders = ref<Order[]>([])
const loading = ref(false)

/** 从 query 解析 tab（我的页快捷入口会带 ?tab=xxx） */
function tabFromQuery(): OrderStatus | 'all' {
  const t = route.query.tab
  return TABS.some((x) => x.key === t) ? (t as OrderStatus) : 'all'
}

async function load() {
  loading.value = true
  try {
    const res = await getOrders(curTab.value === 'all' ? undefined : curTab.value)
    orders.value = res.list
  } finally {
    loading.value = false
  }
}

function switchTab(key: OrderStatus | 'all') {
  if (key === curTab.value) return
  curTab.value = key
  // 同步到 query，便于返回时保留筛选（replace 不堆历史）
  router.replace({ query: key === 'all' ? {} : { tab: key } })
  load()
}

/* 外部带 tab 参数进入时响应（如我的页 → /orders?tab=pay） */
watch(
  () => route.query.tab,
  () => {
    const t = tabFromQuery()
    if (t !== curTab.value) {
      curTab.value = t
      load()
    }
  },
)

/** 状态文案样式：待付款警示橙 / 已取消灰 / 其他品牌绿 */
function statusClass(s: OrderStatus) {
  return { warn: s === 'pay', grey: s === 'cancelled' }
}

/** 订单合计金额（分）：Σ 单价 × 数量（运费免、税费商家承担） */
function orderTotalFen(o: Order) {
  return o.items.reduce((sum, i) => sum + i.priceFen * i.quantity, 0)
}

/** 订单商品总件数 */
function orderCount(o: Order) {
  return o.items.reduce((sum, i) => sum + i.quantity, 0)
}

/* ---- 卡片操作（按原型各状态主操作；mock 阶段均为演示动作） ---- */
function goDetail(o: Order) {
  router.push(`/order/${o.orderNo}`)
}

/** 去支付：mock 阶段直接 Toast，真实微信支付后续接入 */
function payOrder() {
  showToast('拉起微信支付（mock）')
}

function cancelOrder() {
  showToast('取消订单：需二次确认弹窗（后续迭代）')
}

function remindShip() {
  showToast('已提醒仓库优先打包（演示）')
}

function confirmRecv() {
  showToast('确认收货（演示）')
}

/** 再次/重新购买：跳第一件商品的详情页 */
function buyAgain(o: Order) {
  router.push(`/product/${o.items[0].productId}`)
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/mine')
}

onMounted(() => {
  curTab.value = tabFromQuery()
  load()
})
</script>

<template>
  <div class="page">
    <!-- 顶部导航 -->
    <div class="navbar">
      <button class="back" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div class="title">我的订单</div>
      <div class="gap"></div>
    </div>

    <!-- 状态 Tab（吸顶，可横滑） -->
    <div class="tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        :class="{ on: t.key === curTab }"
        @click="switchTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 订单列表 -->
    <div v-if="orders.length">
      <div
        v-for="o in orders"
        :key="o.orderNo"
        class="ocard"
        :class="{ cancelled: o.status === 'cancelled' }"
        @click="goDetail(o)"
      >
        <div class="o-head">
          <span class="o-no">{{ o.orderNo }}</span>
          <span class="o-status" :class="statusClass(o.status)">{{ ORDER_STATUS_MAP[o.status].label }}</span>
        </div>
        <div v-for="p in o.items" :key="p.productId" class="oitem">
          <div class="pic" :style="{ background: p.themeLight }"><img :src="p.img" :alt="p.name" /></div>
          <div class="info">
            <div class="name">{{ p.name }}</div>
            <div class="spec">{{ p.spec }}</div>
          </div>
          <div class="right">
            <div class="price"><span class="cur">¥</span>{{ fenToYuan(p.priceFen) }}</div>
            <div class="qty">×{{ p.quantity }}</div>
          </div>
        </div>
        <div class="o-sum">
          共 {{ orderCount(o) }} 件 · 实付
          <span class="price"><span class="cur">¥</span>{{ fenToYuan(orderTotalFen(o)) }}</span>
        </div>
        <!-- 操作按钮：阻止冒泡，不触发卡片跳详情 -->
        <div class="o-actions" @click.stop>
          <template v-if="o.status === 'pay'">
            <button class="btn-ghost" @click="cancelOrder">取消订单</button>
            <button class="btn-main" @click="payOrder">去支付</button>
          </template>
          <template v-else-if="o.status === 'ship'">
            <button class="btn-ghost" @click="remindShip">提醒发货</button>
          </template>
          <template v-else-if="o.status === 'recv'">
            <button class="btn-ghost" @click="goDetail(o)">查看物流</button>
            <button class="btn-main" @click="confirmRecv">确认收货</button>
          </template>
          <template v-else-if="o.status === 'done'">
            <button class="btn-ghost" @click="buyAgain(o)">再次购买</button>
          </template>
          <template v-else-if="o.status === 'cancelled'">
            <button class="btn-ghost" @click="buyAgain(o)">重新购买</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 空态 -->
    <div v-else-if="!loading" class="empty">
      <div class="e-ico">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M15 3v4h4" /></svg>
      </div>
      <div class="e-t">暂无相关订单</div>
      <div class="e-s">去挑选适合你的脂质体营养吧</div>
      <RouterLink class="e-btn" to="/products">去逛逛</RouterLink>
    </div>

    <!-- 页脚合规小字 -->
    <div class="foot">
      <div class="en">WELLBIORA™ LIPOSOMAL NUTRITION</div>
      <div>欧洲制造 · 义乌保税仓直发（1210 保税备货）</div>
    </div>
  </div>
</template>

<style scoped>
/* 样式搬自 prototype/app/orders.html（设计规范 v0.3 令牌） */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
}

/* ---------- 顶部导航栏 ---------- */
.navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  height: calc(48px + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 4px 0;
  background: #f7f5f0;
  border-bottom: 1px solid #eae6df;
}
.navbar .back {
  width: 44px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: #1a1a1a;
  padding: 0;
}
.navbar .back svg {
  width: 22px;
  height: 22px;
}
.navbar .title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
}
.navbar .gap {
  width: 44px;
  flex-shrink: 0;
}

/* ---------- 状态 Tab ---------- */
.tabs {
  position: sticky;
  top: calc(48px + env(safe-area-inset-top));
  z-index: 39;
  display: flex;
  gap: 4px;
  background: #f7f5f0;
  padding: 4px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tabs button {
  flex: 1;
  min-width: 64px;
  height: 40px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #6b6660;
  position: relative;
}
.tabs button.on {
  color: #033b3c;
  font-weight: 700;
}
.tabs button.on::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 2px;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  border-radius: 999px;
  background: #033b3c;
}

/* ---------- 订单卡（白卡无阴影） ---------- */
.ocard {
  margin: 12px 12px 0;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
}
.ocard .o-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid #eae6df;
}
.ocard .o-no {
  font-size: 11px;
  color: #a8a29a;
  font-family: var(--font-serif);
  letter-spacing: 0.04em;
}
.ocard .o-status {
  font-size: 13px;
  font-weight: 700;
  color: #033b3c;
}
.ocard .o-status.warn {
  color: #ed7b2f; /* 待付款警示色 */
}
.ocard .o-status.grey {
  color: #a8a29a;
}
/* 已取消订单整卡弱化 */
.ocard.cancelled .oitem .name {
  color: #a8a29a;
}
.ocard.cancelled .o-sum,
.ocard.cancelled .price {
  color: #a8a29a;
}

.oitem {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}
.oitem .pic {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.oitem .pic img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.oitem .info {
  flex: 1;
  min-width: 0;
}
.oitem .name {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}
.oitem .spec {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 3px;
}
.oitem .right {
  text-align: right;
  flex-shrink: 0;
}
.price {
  color: #e6432d;
  font-weight: 700;
  font-size: 16px;
  line-height: 1;
}
.price .cur {
  font-size: 11px;
  margin-right: 1px;
}
.oitem .qty {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 6px;
}

.ocard .o-sum {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eae6df;
  font-size: 12px;
  color: #6b6660;
}
.ocard .o-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.btn-ghost,
.btn-main {
  height: 34px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
}
.btn-ghost {
  background: #fff;
  border: 1px solid #eae6df;
  color: #6b6660;
}
.btn-main {
  background: #033b3c;
  border: 1px solid #033b3c;
  color: #fff;
  font-weight: 600;
}
.btn-ghost:active,
.btn-main:active {
  transform: scale(0.96);
}

/* ---------- 空态 ---------- */
.empty {
  padding: 72px 24px 40px;
  text-align: center;
}
.empty .e-ico {
  width: 88px;
  height: 88px;
  margin: 0 auto;
  border-radius: 50%;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty .e-ico svg {
  width: 38px;
  height: 38px;
  stroke: #033b3c;
}
.empty .e-t {
  font-size: 15px;
  font-weight: 600;
  margin-top: 18px;
}
.empty .e-s {
  font-size: 12px;
  color: #6b6660;
  margin-top: 6px;
}
.empty .e-btn {
  display: inline-block;
  margin-top: 22px;
  height: 48px;
  line-height: 48px;
  padding: 0 40px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-radius: 999px;
  text-decoration: none;
}

/* ---------- 页脚合规小字 ---------- */
.foot {
  margin-top: 24px;
  padding-bottom: 24px;
  text-align: center;
  font-size: 10px;
  color: #a8a29a;
  line-height: 1.8;
}
.foot .en {
  font-family: var(--font-serif);
  letter-spacing: 0.14em;
}
</style>
