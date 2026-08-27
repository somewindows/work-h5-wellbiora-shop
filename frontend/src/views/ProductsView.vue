<script setup lang="ts">
/**
 * 产品列表页：顶部 logo 栏 + 模块标题 + 两列商品卡 + TabBar
 * 视觉来源：prototype/app/products-v2.html + style-v2.css（.grid-v2 / .sec-sub2）
 */
import { onMounted, ref } from 'vue'
import { getProducts } from '@/api'
import type { Product } from '@/types'
import SectionHead from '@/components/SectionHead.vue'
import ProductCard from '@/components/ProductCard.vue'
import TabBar from '@/components/TabBar.vue'

const products = ref<Product[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    products.value = await getProducts()
  } catch (e) {
    console.warn('[ProductsView] 商品列表加载失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <!-- 顶部：logo + 购物车入口 -->
    <div class="topbar">
      <img class="logo" src="/assets/logo-h.jpg" alt="WELLBIORA" />
      <RouterLink to="/cart" aria-label="购物车">
        <svg class="cart-ico" viewBox="0 0 24 24" fill="none" stroke="#033B3C" stroke-width="1.8">
          <path d="M3 3h2l2.4 12.2A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.95-1.55L21.5 8H6" />
          <circle cx="9.5" cy="20.5" r="1.3" />
          <circle cx="17.5" cy="20.5" r="1.3" />
        </svg>
      </RouterLink>
    </div>

    <SectionHead kick="All Products" cn="全部产品" />
    <p class="sec-sub2">四款脂质体配方，覆盖日间与夜间的不同需求</p>
    <div style="height: 12px"></div>

    <!-- 加载骨架屏：避免白屏 -->
    <div v-if="loading" class="grid-v2">
      <div v-for="i in 4" :key="i" class="sk-card" />
    </div>

    <!-- 两列商品卡 -->
    <div v-else class="grid-v2">
      <ProductCard v-for="p in products" :key="p.id" :product="p" />
    </div>

    <TabBar />
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 给固定 TabBar（50px + 安全区）留高度，原型列表底部另有 86px 空隙 */
  padding-bottom: calc(86px + env(safe-area-inset-bottom));
}

/* ---------- 顶部：logo 放大（style-v2.css .topbar-v2） ---------- */
.topbar {
  padding: 14px 16px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo {
  height: 30px;
  width: auto;
  mix-blend-mode: multiply;
}
.topbar a {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px; /* 可点区域 ≥ 44px */
  min-height: 44px;
  margin: -10px -8px -10px 0; /* 扩大热区但不改变视觉位置 */
}
.cart-ico {
  width: 24px;
  height: 24px;
}

/* ---------- 列表页小标题（style-v2.css .sec-sub2） ---------- */
.sec-sub2 {
  font-size: 12px;
  color: #a8a29a;
  padding: 0 16px;
  margin: -8px 0 0;
}

/* ---------- 两列网格（style-v2.css .grid-v2） ---------- */
.grid-v2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 12px;
}

/* 骨架卡片：与商品卡同比例 */
.sk-card {
  aspect-ratio: 0.62;
  background: #ece8e1;
  border-radius: 14px;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
