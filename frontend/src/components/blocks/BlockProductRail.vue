<script setup lang="ts">
/**
 * 产品速览票卡（首页，横向滑动）：模块标题 + 横滑 ticket 列表
 * 商品数据由 BlockRenderer 统一拉取后经 products prop 传入，按 productIds 过滤
 * 视觉来源：prototype/app/index-v2.html 票卡 + style-v2.css .rail/.ticket
 */
import { computed } from 'vue'
import type { Product, ProductRailBlock } from '@/types'
import { fenToYuan } from '@/utils/format'
import SectionHead from '../SectionHead.vue'

const props = defineProps<{
  block: ProductRailBlock
  products: Product[] // 全部商品（渲染器注入）
}>()

/** 按 productIds 顺序过滤出要展示的商品 */
const list = computed(() =>
  props.block.productIds
    .map((id) => props.products.find((p) => p.id === id))
    .filter((p): p is Product => !!p),
)
</script>

<template>
  <div>
    <SectionHead :kick="block.en" :cn="block.title" more-to="/products" />
    <div class="rail">
      <RouterLink
        v-for="p in list"
        :key="p.id"
        class="ticket"
        :style="{ background: p.themeLight }"
        :to="`/product/${p.id}`"
      >
        <div class="t-name">{{ p.name }}</div>
        <div class="t-en">{{ p.en }}</div>
        <div class="t-price">
          ¥{{ fenToYuan(p.priceFen) }} <span>示例价</span>
        </div>
        <div class="t-go">立即选购 ›</div>
        <img :src="p.cardImg" :alt="p.name" loading="lazy" />
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.rail {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  /* mandatory 吸附会把容器自动滚动到首卡 snap 点（吃掉 padding），
     必须用 scroll-padding 告诉吸附口留出同样的左距，首卡才能与模块标题对齐 */
  scroll-snap-type: x mandatory;
  padding: 2px 16px 6px;
  scroll-padding: 2px 16px 6px;
  scrollbar-width: none;
}
.rail::-webkit-scrollbar {
  display: none;
}
.ticket {
  flex: 0 0 236px;
  scroll-snap-align: start;
  border-radius: 16px;
  padding: 16px 16px 14px;
  position: relative;
  min-height: 148px;
  overflow: hidden;
  text-decoration: none;
  color: #1a1a1a;
  display: block;
}
.t-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  max-width: 60%;
}
.t-en {
  font-family: var(--font-serif);
  font-size: 10px;
  color: #6b6660;
  margin-top: 4px;
  letter-spacing: 0.06em;
}
.t-price {
  margin-top: 12px;
  color: #e6432d;
  font-weight: 700;
  font-size: 18px;
}
.t-price span {
  font-size: 10px;
  font-weight: 400;
  color: #a8a29a;
}
.ticket img {
  position: absolute;
  right: -14px;
  bottom: -8px;
  width: 108px;
  height: 108px;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.t-go {
  position: absolute;
  left: 16px;
  bottom: 14px;
  font-size: 11px;
  color: #033b3c;
  font-weight: 600;
}
</style>
