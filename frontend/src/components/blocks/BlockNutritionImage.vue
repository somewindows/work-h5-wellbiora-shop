<script setup lang="ts">
/**
 * 营养成分表块（图片版，用于暂无文字资料的产品）
 * 视觉来源：prototype/app/product-v2.html nutrition_image 渲染器
 */
import type { NutritionImageBlock } from '@/types'
import BlockCard from './BlockCard.vue'

defineProps<{ block: NutritionImageBlock }>()
</script>

<template>
  <BlockCard kick="Nutrition Facts" cn="营养成分表">
    <img class="img" :src="block.src" :alt="block.alt || '营养成分表'" loading="lazy" />
  </BlockCard>
</template>

<style scoped>
.img {
  width: 100%;
  display: block;
  border-radius: 8px;
}
</style>
