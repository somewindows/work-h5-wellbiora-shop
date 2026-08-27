<script setup lang="ts">
/**
 * 底部 TabBar：首页 / 产品 / 购物车（带角标）/ 我的
 * 白底，选中深墨绿、未选中 #A8A29A，高 50px + iPhone 安全区
 * 视觉来源：prototype/app/style.css .tabbar + index-v2.html 内联 SVG
 */
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const cart = useCartStore()

// 进入页面时同步一次购物车，保证角标有数
onMounted(() => {
  cart.refresh()
})

/** 购物车角标文案，超过 99 显示 99+ */
const badge = computed(() => (cart.totalCount > 99 ? '99+' : String(cart.totalCount)))

/** 选中态判断：首页精确匹配，其余按路径前缀（/product 详情页也归入「产品」） */
function isActive(prefix: string) {
  if (prefix === '/') return route.path === '/'
  return route.path.startsWith(prefix)
}

const tabs = [
  { to: '/', label: '首页', prefix: '/' },
  { to: '/products', label: '产品', prefix: '/product' },
  { to: '/cart', label: '购物车', prefix: '/cart' },
  { to: '/mine', label: '我的', prefix: '/mine' },
] as const
</script>

<template>
  <nav class="tabbar">
    <RouterLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="tab"
      :class="{ on: isActive(t.prefix) }"
    >
      <span class="ico-wrap">
        <!-- 首页 -->
        <svg v-if="t.prefix === '/'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        </svg>
        <!-- 产品 -->
        <svg v-else-if="t.prefix === '/product'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        </svg>
        <!-- 购物车 -->
        <svg v-else-if="t.prefix === '/cart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 3h2l2.4 12.2A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.95-1.55L21.5 8H6" />
          <circle cx="9.5" cy="20.5" r="1.3" />
          <circle cx="17.5" cy="20.5" r="1.3" />
        </svg>
        <!-- 我的 -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
        </svg>
        <!-- 购物车数量角标 -->
        <span v-if="t.prefix === '/cart' && cart.totalCount > 0" class="badge">{{ badge }}</span>
      </span>
      {{ t.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  min-height: 50px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
  border-top: 1px solid #eae6df;
  display: flex;
  padding-bottom: env(safe-area-inset-bottom); /* iPhone 安全区 */
  z-index: 50;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 0 5px;
  font-size: 10px;
  color: #a8a29a; /* 未选中 */
  text-decoration: none;
  min-height: 44px; /* 可点区域 ≥ 44px */
}
.tab.on {
  color: #033b3c; /* 选中 深墨绿 */
  font-weight: 600;
}
.ico-wrap {
  position: relative;
  display: flex;
}
.tab svg {
  width: 22px;
  height: 22px;
  margin-bottom: 2px;
}
.badge {
  position: absolute;
  top: -4px;
  right: -10px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  background: #e6432d; /* 促销红角标 */
  color: #fff;
  font-size: 9px;
  line-height: 15px;
  text-align: center;
  font-weight: 400;
}
</style>
