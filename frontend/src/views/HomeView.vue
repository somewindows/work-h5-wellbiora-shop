<script setup lang="ts">
/**
 * 首页：顶部 logo 栏 + 内容块渲染（getHome）+ 合规页脚 + TabBar
 * 视觉来源：prototype/app/index-v2.html + style-v2.css（.topbar-v2 / .footer2）
 */
import { onMounted, ref } from 'vue'
import { getHome } from '@/api'
import type { ContentBlock } from '@/types'
import BlockRenderer from '@/components/blocks/BlockRenderer.vue'
import TabBar from '@/components/TabBar.vue'

const blocks = ref<ContentBlock[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    blocks.value = await getHome()
  } catch (e) {
    console.warn('[HomeView] 首页内容块加载失败', e)
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

    <!-- 加载骨架屏：避免白屏 -->
    <div v-if="loading" class="skeleton">
      <div class="sk sk-hero" />
      <div class="sk sk-line" />
      <div class="sk sk-block" />
      <div class="sk sk-block" />
    </div>

    <!-- 内容块：hero / notice_bar / product_rail / stats / product_grid / cert_wall / brand_block -->
    <BlockRenderer v-else :blocks="blocks" />

    <!-- 页脚（页面固定元素，非内容块） -->
    <div class="footer2">
      <div class="f-logo">WELLBIORA™</div>
      <div class="f-note">
        本站商品为跨境电商保税进口商品，仅限个人自用<br />
        单笔交易限值 5000 元 · 个人年度交易限值 26000 元<br />
        本产品为膳食补充剂，并非药品，不能替代药物
      </div>
    </div>

    <TabBar />
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 给固定 TabBar（50px + 安全区）留高度，原型 footer 后另有 16px 空隙 */
  padding-bottom: calc(66px + env(safe-area-inset-bottom));
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

/* ---------- 加载骨架屏 ---------- */
.skeleton {
  padding: 6px 12px 0;
}
.sk {
  background: #ece8e1;
  border-radius: 12px;
  animation: pulse 1.2s ease-in-out infinite;
}
.sk-hero {
  height: 330px;
  border-radius: 20px;
}
.sk-line {
  height: 18px;
  margin-top: 14px;
}
.sk-block {
  height: 220px;
  margin-top: 14px;
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

/* ---------- 页脚（style-v2.css .footer2） ---------- */
.footer2 {
  padding: 28px 16px 20px;
  text-align: center;
}
.f-logo {
  font-family: Georgia, serif;
  letter-spacing: 0.25em;
  font-size: 14px;
  color: #6b6660;
}
.f-note {
  font-size: 10px;
  color: #a8a29a;
  line-height: 1.9;
  margin-top: 10px;
}
</style>
