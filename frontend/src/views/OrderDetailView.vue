<script setup lang="ts">
/**
 * 订单详情页（路由 /order/:id，:id 即订单号 orderNo）
 * 视觉来源：prototype/app/order.html
 * 内容：状态头 / 物流卡（有则显示）/ 收货信息（含脱敏实名）/ 商品清单 / 金额明细 / 订单信息 / 底部操作栏
 * 说明：mock 阶段不做强制登录拦截（路由守卫后续统一加）
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { cancelOrder as requestCancelOrder, getOrder } from '@/api'
import type { Order, OrderStatus } from '@/types'
import { ORDER_STATUS_MAP } from '../../mock/orders'
import { fenToYuan } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const order = ref<Order | null>(null)
const notFound = ref(false)

/* 状态头描述文案（同原型 HEAD_DESC） */
const HEAD_DESC: Record<OrderStatus, string> = {
  pay: '请在 24 小时内完成支付，超时订单将自动取消',
  ship: '订单已提交海关申报，保税仓拣货打包中；如需取消请联系人工客服',
  recv: '海关已放行，包裹正在派送途中',
  done: '交易完成，感谢购买 WELLBIORA 产品',
  cancelled: '订单已取消',
}

const statusInfo = computed(() => (order.value ? ORDER_STATUS_MAP[order.value.status] : null))

/** 状态头描述：已取消订单拼接取消原因 */
const headDesc = computed(() => {
  const o = order.value
  if (!o) return ''
  const base = HEAD_DESC[o.status]
  return o.status === 'cancelled' && o.cancelledReason ? `${base}：${o.cancelledReason}` : base
})

/** 订单合计金额（分） */
const totalFen = computed(() =>
  order.value ? order.value.items.reduce((sum, i) => sum + i.priceFen * i.quantity, 0) : 0,
)

/* ---- 底部操作（按原型各状态主操作；mock 阶段均为演示动作） ---- */
function payOrder() {
  showToast('拉起微信支付（mock）')
}

async function cancelOrder() {
  const current = order.value
  if (!current) return
  try {
    order.value = await requestCancelOrder(current.orderNo)
    showToast('订单已取消')
  } catch (e) {
    showToast(e instanceof Error ? e.message : '取消订单失败')
  }
}

function remindShip() {
  showToast('已提醒仓库优先打包（演示）')
}

function contactKefu() {
  showToast('请联系人工客服（我的 → 联系客服）')
}

function confirmRecv() {
  showToast('确认收货（演示）')
}

function buyAgain() {
  const o = order.value
  if (o) router.push(`/product/${o.items[0].productId}`)
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/orders')
}

onMounted(async () => {
  const orderNo = String(route.params.id || '')
  try {
    order.value = await getOrder(orderNo)
  } catch {
    notFound.value = true
  }
})
</script>

<template>
  <div class="page">
    <!-- 顶部导航 -->
    <div class="navbar">
      <button class="back" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div class="title">订单详情</div>
      <div class="gap"></div>
    </div>

    <template v-if="order && statusInfo">
      <!-- 状态头（杂志式：英文衬线小字 + 中文大标题） -->
      <div
        class="status-head"
        :class="{ warn: order.status === 'pay', grey: order.status === 'cancelled' }"
      >
        <div class="kick">{{ statusInfo.en }}</div>
        <div class="cn">{{ statusInfo.label }}</div>
        <div class="desc">{{ headDesc }}</div>
      </div>

      <!-- 物流卡（有待收货/已完成等物流信息才显示） -->
      <div v-if="order.logistics" id="logistics" class="card">
        <div class="c-head">
          <div>
            <div class="c-kick">Logistics</div>
            <div class="c-title">物流信息</div>
          </div>
        </div>
        <div class="logi">
          <span class="lico">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18.5" r="1.6" /><circle cx="17" cy="18.5" r="1.6" /></svg>
          </span>
          <div class="lbody">
            <div class="lnow">{{ order.logistics.traces[0]?.text }}</div>
            <div class="lmeta">{{ order.logistics.company }} · {{ order.logistics.trackNo }}</div>
          </div>
        </div>
        <div class="trace">
          <div v-for="(t, i) in order.logistics.traces" :key="i" class="trow">
            <span class="tdot"></span>
            <div class="tt">
              <div class="ttext">{{ t.text }}</div>
              <div class="ttime">{{ t.time }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 收货信息卡（含脱敏实名，清关三单对碰信息） -->
      <div class="card">
        <div class="c-head">
          <div>
            <div class="c-kick">Shipping Address</div>
            <div class="c-title">收货信息</div>
          </div>
        </div>
        <div class="addr">
          <span class="aico">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
          </span>
          <div>
            <div>
              <span class="aname">{{ order.address.name }}</span>
              <span class="aphone">{{ order.address.phone }}</span>
            </div>
            <div class="aline">{{ order.address.line }}</div>
            <div class="areal">实名认证：{{ order.idName }} {{ order.idcard }}</div>
          </div>
        </div>
      </div>

      <!-- 商品清单 -->
      <div class="card">
        <div class="c-head">
          <div>
            <div class="c-kick">Items</div>
            <div class="c-title">商品清单</div>
          </div>
        </div>
        <div
          v-for="p in order.items"
          :key="p.productId"
          class="gitem"
          @click="router.push(`/product/${p.productId}`)"
        >
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
      </div>

      <!-- 金额明细 -->
      <div class="card">
        <div class="c-head">
          <div>
            <div class="c-kick">Payment Details</div>
            <div class="c-title">金额明细</div>
          </div>
        </div>
        <div class="fee">
          <div class="frow"><span class="fl">商品金额</span><span class="fr">¥{{ fenToYuan(totalFen) }}</span></div>
          <div class="frow"><span class="fl">运费</span><span class="fr free">免运费</span></div>
          <div class="frow"><span class="fl">进口关税（跨境电商综合税）</span><span class="fr free">商家承担</span></div>
          <div class="frow total">
            <span class="fl">实付金额</span>
            <span class="price"><span class="cur">¥</span>{{ fenToYuan(totalFen) }}</span>
          </div>
        </div>
      </div>

      <!-- 订单信息 -->
      <div class="card">
        <div class="c-head">
          <div>
            <div class="c-kick">Order Info</div>
            <div class="c-title">订单信息</div>
          </div>
        </div>
        <div style="margin-top: 6px">
          <div class="inforow"><span class="k">订单编号</span><span class="v">{{ order.orderNo }}</span></div>
          <div class="inforow"><span class="k">下单时间</span><span class="v">{{ order.createdAt }}</span></div>
          <div v-if="order.payTime" class="inforow"><span class="k">支付时间</span><span class="v">{{ order.payTime }}</span></div>
          <div v-if="order.declareNo" class="inforow"><span class="k">海关申报单号</span><span class="v">{{ order.declareNo }}</span></div>
          <div class="inforow"><span class="k">清关模式</span><span class="v">1210 保税备货 · 义乌保税仓</span></div>
        </div>
      </div>

      <!-- 底部操作栏（按状态出主操作） -->
      <div class="opbar">
        <template v-if="order.status === 'pay'">
          <button class="btn-ghost" @click="cancelOrder">取消订单</button>
          <button class="btn-main" @click="payOrder">去支付</button>
        </template>
        <template v-else-if="order.status === 'ship'">
          <button class="btn-ghost" @click="remindShip">提醒发货</button>
          <button class="btn-ghost" @click="contactKefu">联系客服</button>
        </template>
        <template v-else-if="order.status === 'recv'">
          <button class="btn-main" @click="confirmRecv">确认收货</button>
        </template>
        <template v-else-if="order.status === 'done'">
          <button class="btn-main" @click="buyAgain">再次购买</button>
        </template>
        <template v-else-if="order.status === 'cancelled'">
          <button class="btn-main" @click="buyAgain">重新购买</button>
        </template>
      </div>
    </template>

    <!-- 订单不存在 -->
    <div v-else-if="notFound" class="empty">
      <div class="e-t">订单不存在或已删除</div>
      <RouterLink class="e-btn" to="/orders">返回订单列表</RouterLink>
    </div>
  </div>
</template>

<style scoped>
/* 样式搬自 prototype/app/order.html（设计规范 v0.3 令牌） */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 底部预留：操作栏 56px + 安全区 */
  padding-bottom: calc(64px + env(safe-area-inset-bottom) + 20px);
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

/* ---------- 状态头 ---------- */
.status-head {
  padding: 24px 16px 6px;
}
.status-head .kick {
  font-family: var(--font-serif);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.status-head .cn {
  font-size: 22px;
  font-weight: 700;
  margin-top: 6px;
}
.status-head .desc {
  font-size: 12px;
  color: #6b6660;
  margin-top: 8px;
  line-height: 1.7;
}
.status-head.warn .cn {
  color: #ed7b2f; /* 待付款警示色 */
}
.status-head.grey .cn {
  color: #a8a29a;
}

/* ---------- 卡片通用（白卡无阴影） ---------- */
.card {
  margin: 12px 12px 0;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
}
.card .c-kick {
  font-family: var(--font-serif);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.card .c-title {
  font-size: 15px;
  font-weight: 700;
  margin-top: 4px;
}
.card .c-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

/* ---------- 物流卡 ---------- */
.logi {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.logi .lico {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logi .lico svg {
  width: 17px;
  height: 17px;
  stroke: #033b3c;
}
.logi .lbody {
  flex: 1;
  min-width: 0;
}
.logi .lnow {
  font-size: 13px;
  font-weight: 600;
  color: #033b3c;
  line-height: 1.5;
}
.logi .lmeta {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 4px;
}
/* 物流时间线 */
.trace {
  margin-top: 14px;
  border-top: 1px solid #eae6df;
  padding-top: 4px;
}
.trace .trow {
  display: flex;
  gap: 10px;
  padding: 8px 0;
}
.trace .tdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #eae6df;
  margin-top: 5px;
  flex-shrink: 0;
}
.trace .trow:first-child .tdot {
  background: #033b3c;
}
.trace .tt {
  flex: 1;
}
.trace .ttext {
  font-size: 12px;
  color: #1a1a1a;
  line-height: 1.6;
}
.trace .trow:first-child .ttext {
  color: #033b3c;
  font-weight: 600;
}
.trace .ttime {
  font-size: 10px;
  color: #a8a29a;
  margin-top: 2px;
  font-family: var(--font-serif);
  letter-spacing: 0.03em;
}

/* ---------- 地址卡 ---------- */
.addr {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.addr .aico {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.addr .aico svg {
  width: 17px;
  height: 17px;
  stroke: #033b3c;
}
.addr .aname {
  font-size: 14px;
  font-weight: 700;
}
.addr .aphone {
  font-size: 12px;
  color: #6b6660;
  margin-left: 8px;
}
.addr .aline {
  font-size: 12px;
  color: #6b6660;
  line-height: 1.6;
  margin-top: 5px;
}
/* 实名认证行（灰色小字，清关三单对碰信息） */
.addr .areal {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 5px;
}

/* ---------- 商品行 ---------- */
.gitem {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
  cursor: pointer;
}
.gitem .pic {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.gitem .pic img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.gitem .info {
  flex: 1;
  min-width: 0;
}
.gitem .name {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}
.gitem .spec {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 3px;
}
.gitem .right {
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
.gitem .qty {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 6px;
}

/* ---------- 金额明细 ---------- */
.fee {
  margin-top: 10px;
}
.fee .frow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13px;
}
.fee .frow .fl {
  color: #6b6660;
}
.fee .frow .fr {
  font-weight: 600;
}
.fee .frow .fr.free {
  color: #033b3c;
  font-weight: 400;
}
.fee .frow.total {
  border-top: 1px solid #eae6df;
  margin-top: 6px;
  padding-top: 12px;
}
.fee .frow.total .fl {
  color: #1a1a1a;
  font-weight: 700;
  font-size: 14px;
}

/* ---------- 订单信息行 ---------- */
.inforow {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid #eae6df;
  font-size: 12px;
}
.inforow:last-child {
  border-bottom: none;
}
.inforow .k {
  color: #6b6660;
  flex-shrink: 0;
}
.inforow .v {
  text-align: right;
  color: #1a1a1a;
  line-height: 1.5;
  font-family: var(--font-serif);
  letter-spacing: 0.03em;
}

/* ---------- 底部操作栏（安全区适配） ---------- */
.opbar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-top: 1px solid #eae6df;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  z-index: 50;
}
.btn-ghost,
.btn-main {
  height: 40px;
  padding: 0 22px;
  border-radius: 999px;
  font-size: 14px;
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
  transform: scale(0.97);
}

/* ---------- 空态（订单不存在） ---------- */
.empty {
  padding: 72px 24px 40px;
  text-align: center;
}
.empty .e-t {
  font-size: 15px;
  font-weight: 600;
  margin-top: 18px;
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
</style>
