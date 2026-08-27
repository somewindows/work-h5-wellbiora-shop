<script setup lang="ts">
/**
 * 购物车页（路由 /cart）
 * 视觉 1:1 来源：prototype/app/cart.html（样式令牌见 scoped CSS）
 * 数据走 cart store（mock / 真实接口由 API 层按 VITE_USE_MOCK 切换）
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, Stepper as VanStepper, SwipeCell as VanSwipeCell } from 'vant'
import TabBar from '@/components/TabBar.vue'
import PriceText from '@/components/PriceText.vue'
import { useCartStore } from '@/stores/cart'
import type { CartItem } from '@/types'

const router = useRouter()
const cart = useCartStore()

onMounted(() => {
  cart.refresh()
})

/** 跨境电商零售进口单笔订单限值（分），超限禁止结算 */
const LIMIT_FEN = 500000

/** 管理模式：结算按钮切换为「删除所选」 */
const managing = ref(false)

const allChecked = computed(() => cart.items.length > 0 && cart.items.every((i) => i.checked))
const checkedCount = computed(() => cart.checkedItems.reduce((s, i) => s + i.quantity, 0))
const overLimit = computed(() => cart.checkedTotalFen > LIMIT_FEN)

async function toggleItem(item: CartItem) {
  await cart.update(item.id, { checked: !item.checked })
}

async function toggleAll() {
  const target = !allChecked.value
  for (const item of cart.items) {
    if (item.checked !== target) await cart.update(item.id, { checked: target })
  }
}

/** vant Stepper 变更数量（min=1，不会出现 0） */
async function onStep(item: CartItem, val: number | string) {
  await cart.update(item.id, { quantity: Number(val) })
}

/** 左滑删除单个商品 */
async function onRemove(item: CartItem) {
  await cart.remove(item.id)
  showToast('已删除')
}

/** 管理模式：删除所有勾选商品 */
async function onDeleteSelected() {
  if (!cart.checkedItems.length) return
  for (const item of [...cart.checkedItems]) {
    await cart.remove(item.id)
  }
  showToast('已删除所选商品')
}

function onGo() {
  if (managing.value) {
    onDeleteSelected()
    return
  }
  // 未勾选或超限额时按钮已禁用，这里双保险
  if (!cart.checkedItems.length || overLimit.value) return
  router.push('/checkout')
}
</script>

<template>
  <div class="page">
    <!-- 页头（杂志式：英文 kicker + 中文大标题） -->
    <div class="cart-head">
      <div>
        <div class="kick">Shopping Cart</div>
        <div class="cn">购物车</div>
      </div>
      <button v-if="cart.items.length" class="manage" @click="managing = !managing">
        {{ managing ? '完成' : '管理' }}
      </button>
    </div>

    <!-- 跨境提示（与首页公告条同式） -->
    <div class="notice">义乌保税仓直发 · 下单需实名申报 · 单笔限 ¥5000</div>

    <!-- 商品列表（左滑删除） -->
    <VanSwipeCell v-for="item in cart.items" :key="item.id" class="citem-swipe">
      <div class="citem">
        <button
          class="ck"
          :class="{ on: item.checked }"
          aria-label="选择"
          @click="toggleItem(item)"
        >
          <i>
            <svg viewBox="0 0 24 24" fill="none" stroke-width="3.4"><path d="M4 12.5l5 5L20 6.5" /></svg>
          </i>
        </button>
        <div class="pic" :style="{ background: item.themeLight }">
          <img :src="item.img" :alt="item.name" />
        </div>
        <div class="info">
          <div class="name">{{ item.name }}</div>
          <div class="meta">{{ item.spec }}</div>
          <div class="row">
            <PriceText :price-fen="item.priceFen" />
            <VanStepper
              :model-value="item.quantity"
              min="1"
              theme="round"
              class="stepper"
              @change="(val: number | string) => onStep(item, val)"
            />
          </div>
        </div>
      </div>
      <template #right>
        <button class="del-btn" @click="onRemove(item)">删除</button>
      </template>
    </VanSwipeCell>

    <!-- 空态 -->
    <div v-if="!cart.items.length" class="empty">
      <div class="e-ico">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
          <path d="M3 3h2l2.4 12.2A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.95-1.55L21.5 8H6" />
          <circle cx="9.5" cy="20.5" r="1.3" />
          <circle cx="17.5" cy="20.5" r="1.3" />
        </svg>
      </div>
      <div class="e-t">购物车还是空的</div>
      <div class="e-s">去挑选适合你的脂质体营养吧</div>
      <RouterLink class="e-btn" to="/products">去逛逛</RouterLink>
    </div>
  </div>

  <!-- 超限警示条（结算栏上方） -->
  <div v-if="overLimit" class="limit-warn">已超出跨境电商单笔订单限值 ¥5000，请分单购买</div>

  <!-- 底部结算栏 -->
  <div v-if="cart.items.length" class="checkbar">
    <div class="all">
      <button class="ck" :class="{ on: allChecked }" aria-label="全选" @click="toggleAll">
        <i>
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3.4"><path d="M4 12.5l5 5L20 6.5" /></svg>
        </i>
      </button>
      全选
    </div>
    <div v-if="!managing" class="total">
      <div>
        <span class="t">合计：</span>
        <PriceText :price-fen="cart.checkedTotalFen" />
      </div>
      <div class="n">{{ checkedCount ? `共 ${checkedCount} 件` : '未选择商品' }}</div>
    </div>
    <div v-else class="total" />
    <button
      class="go"
      :class="{
        del: managing,
        dis: managing ? !cart.checkedItems.length : overLimit || !checkedCount,
      }"
      @click="onGo"
    >
      {{ managing ? '删除' : overLimit ? '已超限额' : '去结算' }}
    </button>
  </div>

  <TabBar />
</template>

<style scoped>
/* ===== 样式移植自 prototype/app/cart.html（设计规范 v0.3）===== */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 底部预留：结算栏 64px + tabbar 50px + 安全区 */
  padding-bottom: calc(64px + 50px + env(safe-area-inset-bottom) + 20px);
}

/* ---------- 页头 ---------- */
.cart-head {
  padding: calc(18px + env(safe-area-inset-top)) 16px 14px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.kick {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.cn {
  font-size: 22px;
  font-weight: 700;
  margin-top: 6px;
  line-height: 1.3;
}
.manage {
  font-size: 13px;
  color: #033b3c;
  font-weight: 600;
  padding: 10px 4px; /* 扩大点击区域 ≥44px */
  background: none;
  border: none;
  cursor: pointer;
}

/* ---------- 公告条 ---------- */
.notice {
  margin: 0 12px;
  background: #d9ede2;
  color: #033b3c;
  font-size: 12px;
  border-radius: 999px;
  padding: 8px 14px;
  white-space: nowrap;
  overflow: hidden;
}

/* ---------- 商品行卡片 ---------- */
.citem-swipe {
  margin: 12px 12px 0;
  border-radius: 16px;
  overflow: hidden;
}
.citem {
  background: #fff;
  padding: 14px 12px;
  display: flex;
  gap: 10px;
  align-items: center;
}
/* 勾选：视觉 20px，触摸区 44px */
.ck {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -10px;
  background: none;
  border: none;
  cursor: pointer;
}
.ck i {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #a8a29a;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-out;
}
.ck.on i {
  background: #033b3c;
  border-color: #033b3c;
}
.ck i svg {
  width: 11px;
  height: 11px;
  stroke: #fff;
  opacity: 0;
  transition: opacity 0.15s;
}
.ck.on i svg {
  opacity: 1;
}
/* 产品图：产品浅底色 + 白底图 multiply 融合 */
.pic {
  width: 76px;
  height: 76px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pic img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  mix-blend-mode: multiply;
  display: block;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}
.meta {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 2px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

/* 数量步进器：vant Stepper 覆盖为原型样式（视觉 26px 薄荷绿圆钮） */
.stepper :deep(.van-stepper__minus),
.stepper :deep(.van-stepper__plus) {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #d9ede2;
  color: #033b3c;
  border: none;
}
.stepper :deep(.van-stepper__minus--disabled),
.stepper :deep(.van-stepper__plus--disabled) {
  background: #f7f5f0;
  color: #a8a29a;
}
.stepper :deep(.van-stepper__input) {
  width: 30px;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 2px;
}

/* 左滑删除按钮 */
.del-btn {
  height: 100%;
  width: 72px;
  border: none;
  background: #d54941;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* ---------- 空态 ---------- */
.empty {
  padding: 72px 24px 40px;
  text-align: center;
}
.e-ico {
  width: 88px;
  height: 88px;
  margin: 0 auto;
  border-radius: 50%;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.e-ico svg {
  width: 38px;
  height: 38px;
  stroke: #033b3c;
}
.e-t {
  font-size: 15px;
  font-weight: 600;
  margin-top: 18px;
}
.e-s {
  font-size: 12px;
  color: #6b6660;
  margin-top: 6px;
}
.e-btn {
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

/* ---------- 底部结算栏 ---------- */
.checkbar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(50px + env(safe-area-inset-bottom));
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-top: 1px solid #eae6df;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  z-index: 50;
}
.all {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #6b6660;
}
.all .ck {
  margin-left: 0;
}
.total {
  flex: 1;
  text-align: right;
  line-height: 1.2;
}
.total .t {
  font-size: 11px;
  color: #6b6660;
}
.total .n {
  font-size: 10px;
  color: #a8a29a;
}
.go {
  width: 118px;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.go:active {
  transform: scale(0.97);
}
.go.dis {
  background: #e5e1db;
  color: #a8a29a;
}
/* 管理模式：删除按钮 */
.go.del {
  background: #fff;
  border: 1px solid #d54941;
  color: #d54941;
}
.go.del.dis {
  border-color: #e5e1db;
  color: #a8a29a;
}

/* 超限警示条（结算栏上方） */
.limit-warn {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(50px + 64px + env(safe-area-inset-bottom));
  width: 100%;
  max-width: 480px;
  background: #fdf3ec;
  color: #ed7b2f;
  font-size: 11px;
  padding: 7px 16px;
  border-top: 1px solid #eae6df;
  z-index: 50;
}
</style>
