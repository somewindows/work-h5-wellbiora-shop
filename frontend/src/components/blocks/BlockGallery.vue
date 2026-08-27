<script setup lang="ts">
/**
 * 详情页图廊块：vant Swipe 轮播 + 自定义圆点指示器
 * 视觉来源：prototype/app/product-v2.html gallery 渲染器 + style-v2.css .gwrap/.g-dots
 */
import { Swipe as VanSwipe, SwipeItem as VanSwipeItem } from 'vant'
import type { GalleryBlock } from '@/types'

defineProps<{
  block: GalleryBlock
  bg?: string // 图廊底色（一般传产品 themeLight），默认白色
}>()
</script>

<template>
  <div class="gwrap">
    <VanSwipe class="gallery" :style="{ background: bg || '#fff' }" :loop="block.images.length > 1" lazy-render>
      <VanSwipeItem v-for="(src, i) in block.images" :key="i">
        <img :src="src" :alt="`商品图 ${i + 1}`" />
      </VanSwipeItem>
      <!-- 自定义圆点：单图不显示 -->
      <template v-if="block.images.length > 1" #indicator="{ active }">
        <div class="g-dots">
          <i v-for="(_, i) in block.images" :key="i" :class="{ on: i === active }" />
        </div>
      </template>
    </VanSwipe>
  </div>
</template>

<style scoped>
.gwrap {
  position: relative;
}
.gallery img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  mix-blend-mode: multiply; /* 白底产品图融入底色 */
  display: block;
}
.g-dots {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  display: flex;
  gap: 5px;
  justify-content: center;
}
.g-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(3, 59, 60, 0.18);
}
.g-dots i.on {
  background: #033b3c;
}
</style>
