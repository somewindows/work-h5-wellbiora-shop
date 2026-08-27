<script setup lang="ts">
/**
 * 两列商品卡网格（首页/列表页）：可选模块标题 + ProductCard 网格
 * 商品数据由 BlockRenderer 统一拉取后经 products prop 传入，按 productIds 过滤
 * 视觉来源：prototype/app/style-v2.css .grid-v2
 */
import { computed } from 'vue'
import type { Product, ProductGridBlock } from '@/types'
import SectionHead from '../SectionHead.vue'
import ProductCard from '../ProductCard.vue'

const props = defineProps<{
  block: ProductGridBlock
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
    <SectionHead v-if="block.title" :kick="block.en" :cn="block.title" more-to="/products" />
    <div class="grid">
      <ProductCard v-for="p in list" :key="p.id" :product="p" />
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 12px;
}
</style>
