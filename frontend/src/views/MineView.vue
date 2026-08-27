<script setup lang="ts">
/**
 * 个人中心「我的」页（路由 /mine）
 * 视觉来源：prototype/app/mine.html（品牌深墨绿用户头 + 我的订单五态 + 服务列表 + 为你推荐）
 * 说明：mock 阶段不做强制登录拦截（路由守卫后续统一加）；登录后 onMounted 拉取用户信息
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'
import { getProducts } from '@/api'
import type { Product } from '@/types'
import TabBar from '@/components/TabBar.vue'
import ProductCard from '@/components/ProductCard.vue'

const router = useRouter()
const userStore = useUserStore()

const products = ref<Product[]>([])

/* 底部弹层：kefu 客服 / doc 协议 */
const activeSheet = ref<'' | 'kefu' | 'doc'>('')

function openSheet(key: 'kefu' | 'doc') {
  activeSheet.value = key
}
function closeSheets() {
  activeSheet.value = ''
}

/** 复制客服微信号（演示） */
function copyKefu() {
  closeSheets()
  showToast('客服微信号已复制（演示）')
}

/** 协议正文页待设计，先 Toast 占位（同原型） */
function docTodo(name: string) {
  closeSheets()
  showToast(`${name}：正文页待设计`)
}

function goLogin() {
  // 登录成功后跳回本页
  router.push({ path: '/login', query: { from: '/mine' } })
}

onMounted(() => {
  // 已登录则拉取最新用户信息；未登录保持「点击登录」态
  if (userStore.isLogin) userStore.fetchUser()
  getProducts().then((list) => (products.value = list))
})
</script>

<template>
  <div class="page">
    <!-- 用户信息区（品牌深墨绿渐变） -->
    <div class="mine-head">
      <div class="kick">My Account</div>
      <div class="user">
        <div class="avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
        </div>
        <template v-if="userStore.isLogin && userStore.user">
          <div class="uinfo">
            <div class="uname">{{ userStore.user.nickname }}</div>
            <div class="usub">{{ userStore.user.phone }} · 已完成实名认证</div>
          </div>
        </template>
        <template v-else>
          <div class="uinfo">
            <div class="uname">未登录</div>
            <div class="usub">登录后查看订单与管理地址</div>
          </div>
          <button class="login-btn" @click="goLogin">立即登录</button>
        </template>
      </div>
    </div>

    <!-- 我的订单（叠卡上浮） -->
    <div class="mcard overlap">
      <div class="sec-head">
        <div class="t">我的订单</div>
        <button class="more" @click="router.push('/orders')">
          查看全部订单
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div class="order-grid">
        <button class="order-item" @click="router.push('/orders?tab=pay')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>
          待付款
        </button>
        <button class="order-item" @click="router.push('/orders?tab=ship')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 3l8 4v10l-8 4-8-4V7z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" /></svg>
          待发货
        </button>
        <button class="order-item" @click="router.push('/orders?tab=recv')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18.5" r="1.6" /><circle cx="17" cy="18.5" r="1.6" /></svg>
          待收货
        </button>
        <button class="order-item" @click="router.push('/orders?tab=done')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /><path d="M9 11.5l2 2 4-4.5" /></svg>
          待评价
        </button>
        <button class="order-item" aria-label="退款/售后，人工客服处理" @click="openSheet('kefu')">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" /></svg>
          退款/售后
        </button>
      </div>
    </div>

    <!-- 服务与支持 -->
    <div class="mcard svc">
      <button class="cell" @click="router.push('/address')">
        <span class="cico">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
        </span>
        <span class="cbody">
          <span class="ct">收货地址</span>
          <span class="cs">含跨境清关实名信息</span>
        </span>
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button class="cell" @click="openSheet('kefu')">
        <span class="cico">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 13a8 8 0 0 1 16 0" /><rect x="3" y="13" width="4" height="6" rx="2" /><rect x="17" y="13" width="4" height="6" rx="2" /><path d="M19 19a3 3 0 0 1-3 3h-3" /></svg>
        </span>
        <span class="cbody">
          <span class="ct">联系客服</span>
          <span class="cs">服务时间 9:00 – 23:00</span>
        </span>
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button class="cell" @click="openSheet('doc')">
        <span class="cico">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M15 3v4h4" /><path d="M9 12h6M9 16h6" /></svg>
        </span>
        <span class="cbody">
          <span class="ct">协议与规则</span>
          <span class="cs">用户协议 · 隐私政策 · 信息收集清单</span>
        </span>
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </div>

    <!-- 为你推荐（复用商品卡组件） -->
    <div v-if="products.length" class="rec">
      <div class="kick">Recommend</div>
      <div class="cn">为你推荐</div>
      <div class="rec-grid">
        <ProductCard v-for="p in products" :key="p.id" :product="p" />
      </div>
    </div>

    <!-- 页脚合规小字 -->
    <div class="mine-foot">
      <div class="en">WELLBIORA™ LIPOSOMAL NUTRITION</div>
      <div>欧洲制造 · 义乌保税仓直发（1210 保税备货）</div>
    </div>

    <!-- 底部 TabBar（我的选中态由组件按路由自动判断） -->
    <TabBar />

    <!-- 遮罩 -->
    <div class="mask" :class="{ show: activeSheet !== '' }" @click="closeSheets"></div>

    <!-- 客服弹层 -->
    <div class="sheet" :class="{ show: activeSheet === 'kefu' }">
      <div class="s-kick">Customer Service</div>
      <div class="s-title">联系客服</div>
      <div class="s-desc">服务时间 每日 9:00 – 23:00<br />添加客服微信，咨询订单与清关问题</div>
      <button class="s-btn" @click="copyKefu">复制客服微信号：WellbioraService</button>
      <button class="s-btn ghost" @click="closeSheets">取消</button>
    </div>

    <!-- 协议与规则弹层 -->
    <div class="sheet" :class="{ show: activeSheet === 'doc' }">
      <div class="s-kick">Terms &amp; Policies</div>
      <div class="s-title">协议与规则</div>
      <button class="doc-item" @click="docTodo('《用户服务协议》')">
        用户服务协议
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button class="doc-item" @click="docTodo('《隐私政策》')">
        隐私政策
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button class="doc-item" @click="docTodo('《个人信息收集清单》')">
        个人信息收集清单
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button class="s-btn ghost" @click="closeSheets">关闭</button>
    </div>
  </div>
</template>

<style scoped>
/* 样式搬自 prototype/app/mine.html（设计规范 v0.3 令牌） */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 底部预留：tabbar 50px + 安全区 */
  padding-bottom: calc(50px + env(safe-area-inset-bottom) + 20px);
}

/* ---------- 用户信息区（品牌深墨绿） ---------- */
.mine-head {
  background: linear-gradient(180deg, #033b3c 0%, #022829 100%);
  padding: calc(20px + env(safe-area-inset-top)) 16px 44px;
  color: #fff;
}
.mine-head .kick {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(217, 237, 226, 0.65);
}
.mine-head .user {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  min-height: 56px;
}
.mine-head .avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.35);
}
.mine-head .avatar svg {
  width: 28px;
  height: 28px;
  stroke: #033b3c;
}
.mine-head .uinfo {
  flex: 1;
  min-width: 0;
}
.mine-head .uname {
  font-size: 19px;
  font-weight: 700;
  line-height: 1.3;
}
.mine-head .usub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 3px;
}
.mine-head .login-btn {
  height: 36px;
  padding: 0 20px;
  background: #fff;
  color: #033b3c;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.mine-head .login-btn:active {
  transform: scale(0.96);
}

/* ---------- 卡片通用 ---------- */
.mcard {
  margin: 12px 12px 0;
  background: #fff;
  border-radius: 16px;
  padding: 16px 14px;
}
.mcard.overlap {
  margin-top: -28px;
  position: relative;
  z-index: 1;
}

/* ---------- 我的订单 ---------- */
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sec-head .t {
  font-size: 15px;
  font-weight: 700;
}
.sec-head .more {
  font-size: 12px;
  color: #a8a29a;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 0 8px 8px;
  background: none;
  border: none;
  cursor: pointer;
}
.sec-head .more svg {
  width: 12px;
  height: 12px;
  stroke: #a8a29a;
}
.order-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-top: 12px;
}
.order-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  min-height: 44px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: #6b6660;
}
.order-item:active {
  opacity: 0.6;
}
.order-item svg {
  width: 24px;
  height: 24px;
  stroke: #1a1a1a;
}

/* ---------- 服务列表（cell） ---------- */
.svc {
  padding: 4px 14px;
}
.cell {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 8px 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #1a1a1a;
}
.cell + .cell {
  border-top: 1px solid #eae6df;
}
.cell:active {
  opacity: 0.6;
}
.cell .cico {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cell .cico svg {
  width: 17px;
  height: 17px;
  stroke: #033b3c;
}
.cell .cbody {
  flex: 1;
  min-width: 0;
}
.cell .ct {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  display: block;
}
.cell .cs {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 2px;
  display: block;
}
.cell .arrow {
  width: 14px;
  height: 14px;
  stroke: #a8a29a;
  flex-shrink: 0;
}

/* ---------- 为你推荐 ---------- */
.rec {
  margin-top: 20px;
  padding: 0 12px;
}
.rec .kick {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
  text-align: center;
}
.rec .cn {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-top: 6px;
}
.rec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

/* ---------- 页脚合规小字 ---------- */
.mine-foot {
  margin-top: 24px;
  text-align: center;
  font-size: 10px;
  color: #a8a29a;
  line-height: 1.8;
}
.mine-foot .en {
  font-family: Georgia, serif;
  letter-spacing: 0.14em;
}

/* ---------- 遮罩 + 底部弹层 ---------- */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
  z-index: 80;
}
.mask.show {
  opacity: 1;
  pointer-events: auto;
}
.sheet {
  position: fixed;
  left: 50%;
  transform: translate(-50%, 100%);
  bottom: 0;
  width: 100%;
  max-width: 480px;
  background: #f7f5f0;
  border-radius: 20px 20px 0 0;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  transition: transform 0.3s ease-out;
  z-index: 81;
}
.sheet.show {
  transform: translate(-50%, 0);
}
.sheet .s-kick {
  font-family: Georgia, serif;
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
  text-align: center;
}
.sheet .s-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-top: 5px;
}
.sheet .s-desc {
  font-size: 12px;
  color: #6b6660;
  text-align: center;
  margin-top: 10px;
  line-height: 1.7;
}
.sheet .s-btn {
  display: block;
  width: 100%;
  height: 48px;
  margin-top: 16px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.sheet .s-btn:active {
  transform: scale(0.98);
}
.sheet .s-btn.ghost {
  background: none;
  color: #6b6660;
  font-weight: 400;
  margin-top: 4px;
}
.sheet .doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #fff;
  border: none;
  cursor: pointer;
  border-radius: 12px;
  padding: 14px;
  margin-top: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}
.sheet .doc-item:active {
  opacity: 0.6;
}
.sheet .doc-item svg {
  width: 14px;
  height: 14px;
  stroke: #a8a29a;
}
</style>
