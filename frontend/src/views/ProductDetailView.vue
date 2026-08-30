<script setup lang="ts">
/**
 * 商品详情页：/product/:id
 * 视觉 1:1 来源：prototype/app/product-v2.html + style-v2.css / style.css
 * 结构：悬浮返回条 → 图廊块 → 摘要卡 → 内容块序列 → 产品档案（基础字段）→ 合规声明（固定，不可删）→ 底部购买栏
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading as VanLoading, showToast } from 'vant'
import { getProduct } from '@/api'
import { useCartStore } from '@/stores/cart'
import { fenToYuan } from '@/utils/format'
import BlockRenderer from '@/components/blocks/BlockRenderer.vue'
import type { ProductDetail } from '@/types'

const route = useRoute()
const router = useRouter()
const cart = useCartStore()

const detail = ref<ProductDetail | null>(null)
const loading = ref(true)
const error = ref('')
const adding = ref(false) // 加购/购买进行中，防重复点击

/** 下滑后头部切换为玻璃拟态背景 */
const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > 24
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

/** 图廊单独渲染在摘要卡之前，其余块在其后（与原型组装顺序一致） */
const galleryBlocks = computed(() => detail.value?.blocks.filter((b) => b.type === 'gallery') ?? [])
const restBlocks = computed(() => detail.value?.blocks.filter((b) => b.type !== 'gallery') ?? [])

/** 副标题：风味可空，缺省只显示规格 */
const subText = computed(() => {
  const d = detail.value
  if (!d) return ''
  return d.flavor ? `${d.flavor} · ${d.spec}` : d.spec
})

/** 产品档案行：flavor / usage 可空，空则不渲染该行 */
const infoRows = computed(() => {
  const d = detail.value
  if (!d) return []
  return [
    { k: '产品规格', v: d.spec },
    d.flavor ? { k: '风味', v: d.flavor } : null,
    { k: '核心成分', v: d.ingredients },
    { k: '产地与认证', v: d.originCert },
    d.usage ? { k: '食用方法', v: d.usage } : null,
  ].filter((r): r is { k: string; v: string } => r !== null)
})

async function load(id: string) {
  loading.value = true
  error.value = ''
  detail.value = null
  try {
    detail.value = await getProduct(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '商品加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => String(route.params.id ?? ''), (id) => load(id), { immediate: true })

function goBack() {
  // 有历史记录则返回上一页，否则回产品列表（直接打开详情页的场景）
  if (window.history.length > 1) router.back()
  else router.push('/products')
}

async function onAddCart() {
  if (!detail.value || adding.value) return
  adding.value = true
  try {
    await cart.add(detail.value.id, 1)
    showToast('已加入购物车')
  } catch {
    showToast('加入购物车失败，请重试')
  } finally {
    adding.value = false
  }
}

async function onBuyNow() {
  if (!detail.value || adding.value) return
  adding.value = true
  try {
    await cart.add(detail.value.id, 1)
    router.push('/checkout')
  } catch {
    showToast('操作失败，请重试')
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="page">
    <!-- 悬浮返回条：下滑后切换玻璃拟态 -->
    <div class="backbar" :class="{ glass: scrolled }">
      <button class="circle" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="#033B3C" stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <img class="logo" src="/assets/logo-h.jpg" alt="WELLBIORA" />
      <router-link class="circle" to="/cart" aria-label="购物车">
        <svg viewBox="0 0 24 24" fill="none" stroke="#033B3C" stroke-width="1.8">
          <path d="M3 3h2l2.4 12.2A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.95-1.55L21.5 8H6" />
          <circle cx="9.5" cy="20.5" r="1.3" />
          <circle cx="17.5" cy="20.5" r="1.3" />
        </svg>
      </router-link>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="state">
      <VanLoading color="#033B3C">加载中…</VanLoading>
    </div>

    <!-- 错误态：商品不存在等 -->
    <div v-else-if="error" class="state">
      <p class="err-text">{{ error }}</p>
      <button class="err-btn" @click="goBack">返回上一页</button>
    </div>

    <template v-else-if="detail">
      <!-- 图廊块 -->
      <BlockRenderer :blocks="galleryBlocks" context="detail" :theme-light="detail.themeLight" />

      <!-- 摘要卡 -->
      <section class="summary">
        <div class="tags"><span v-for="t in detail.tags" :key="t" class="tag">{{ t }}</span></div>
        <h1 class="name">{{ detail.name }}</h1>
        <div class="en-name">{{ detail.en }}</div>
        <div class="sub">{{ subText }}</div>
        <div class="prow">
          <span class="price"><span class="cur">¥</span>{{ fenToYuan(detail.priceFen) }}<span class="hint">示例价</span></span>
          <span class="sold">保税仓直发 · 满 2 件包邮</span>
        </div>
        <div class="cross">跨境进口商品 · 1210 保税备货 · 下单需实名清关</div>
      </section>

      <!-- 内容块序列（stats/scenario/badges/image/nutrition 等） -->
      <BlockRenderer :blocks="restBlocks" context="detail" />

      <!-- 产品档案：商品基础字段，非内容块 -->
      <section class="blk">
        <div class="blk-h">
          <div class="kick">Product Info</div>
          <div class="cn">产品档案</div>
        </div>
        <div v-for="r in infoRows" :key="r.k" class="inforow">
          <span class="k">{{ r.k }}</span>
          <span class="v">{{ r.v }}</span>
        </div>
      </section>

      <!-- 合规声明：固定渲染在页面末尾，不可删（硬性合规要求） -->
      <details class="collapse">
        <summary>跨境购买须知与合规说明</summary>
        <div class="c-body">{{ detail.complianceText }}</div>
      </details>

      <!-- 底部悬浮购买栏的占位 -->
      <div style="height: 96px" />
    </template>

    <!-- 底部购买栏（图标列 + 双按钮，同原型 product-v2.html） -->
    <div v-if="detail" class="buybar">
      <router-link class="ic" to="/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
        首页
      </router-link>
      <router-link class="ic" to="/cart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3h2l2.4 12.2A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.95-1.55L21.5 8H6" /><circle cx="9.5" cy="20.5" r="1.3" /><circle cx="17.5" cy="20.5" r="1.3" /></svg>
        购物车
      </router-link>
      <button class="btn cart" :disabled="adding" @click="onAddCart">加入购物车</button>
      <button class="btn buy" :disabled="adding" @click="onBuyNow">立即购买</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  background: #f7f5f0;
}

/* ===== 悬浮返回条（style.css .backbar） ===== */
.backbar {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  z-index: 50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  transition:
    background 0.25s ease-out,
    box-shadow 0.25s ease-out;
}
/* 玻璃拟态：下滑后激活，半透明白 + 背景模糊 */
.backbar.glass {
  background: rgba(255, 255, 255, 0.65);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: 0 1px 0 rgba(3, 59, 60, 0.06);
}
.circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.circle svg {
  width: 18px;
  height: 18px;
}
.logo {
  height: 22px;
  width: auto;
  mix-blend-mode: multiply;
}

/* ===== 加载 / 错误态 ===== */
.state {
  min-height: 60dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.err-text {
  font-size: 14px;
  color: #6b6660;
}
.err-btn {
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 999px;
  background: #033b3c;
  color: #fff;
  font-size: 14px;
}

/* ===== 摘要卡（style.css .summary + style-v2.css .summary-v2） ===== */
.summary {
  background: #fff;
  border-radius: 16px 16px 0 0;
  margin-top: -16px;
  position: relative;
  padding: 16px 16px 14px;
}
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.tag {
  font-size: 10px;
  color: #033b3c;
  background: #d9ede2;
  border-radius: 4px;
  padding: 3px 6px;
}
.name {
  font-family: var(--font-serif-cn); /* 商品名用思源宋体 */
  font-size: 20px;
  font-weight: 700;
}
.sub {
  font-size: 12px;
  color: #6b6660;
  margin-top: 4px;
}
.en-name {
  font-size: 13px;
  color: #6b6660;
  margin-top: 2px;
}
.prow {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 10px;
}
.price {
  color: #e6432d;
  font-weight: 700;
  font-size: 24px;
  line-height: 1;
}
.price .cur {
  font-size: 12px;
  margin-right: 1px;
}
.price .hint {
  font-size: 10px;
  font-weight: 400;
  color: #a8a29a;
  margin-left: 2px;
}
.sold {
  font-size: 11px;
  color: #a8a29a;
}
.cross {
  margin-top: 12px;
  font-size: 11px;
  color: #6b6660;
  background: #f7f5f0;
  border-radius: 8px;
  padding: 8px 10px;
}

/* ===== 产品档案卡片（style-v2.css .blk / .blk-h / .inforow） ===== */
.blk {
  margin: 14px 12px 0;
  background: #fff;
  border-radius: 16px;
  padding: 18px 16px;
}
.blk-h {
  margin-bottom: 12px;
}
.blk-h .kick {
  font-family: var(--font-serif);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.blk-h .cn {
  font-size: 17px;
  font-weight: 700;
  margin-top: 5px;
}
.inforow {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #eae6df;
  font-size: 13px;
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
  font-weight: 500;
  line-height: 1.5;
}

/* ===== 合规声明折叠面板（style.css .collapse） ===== */
.collapse {
  margin: 14px 12px 0;
  background: #fff;
  border-radius: 16px;
}
.collapse summary {
  list-style: none;
  cursor: pointer;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.collapse summary::after {
  content: '›';
  color: #a8a29a;
  font-size: 16px;
  transition: transform 0.2s;
}
.collapse[open] summary::after {
  transform: rotate(90deg);
}
.collapse .c-body {
  padding: 0 16px 14px;
  font-size: 13px;
  font-weight: 400;
  color: #6b6660;
  line-height: 1.8;
}

/* ===== 底部购买栏（style.css .buybar，按钮按设计规范 48px 高） ===== */
.buybar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-top: 1px solid #eae6df;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  z-index: 50;
}
.buybar .ic {
  width: 44px;
  text-align: center;
  font-size: 10px;
  color: #6b6660;
  text-decoration: none;
  flex-shrink: 0;
}
.buybar .ic svg {
  width: 20px;
  height: 20px;
  display: block;
  margin: 0 auto 2px;
}
.buybar .btn {
  flex: 1;
  height: 48px;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
}
.buybar .btn:disabled {
  opacity: 0.6;
}
.buybar .btn.cart {
  background: #d9ede2;
  color: #033b3c;
}
.buybar .btn.buy {
  background: #033b3c;
  color: #fff;
}
</style>
