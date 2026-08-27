<script setup lang="ts">
/**
 * 品牌区块（首页）：深绿底反白品牌故事，含 WELLBIORA™ 衬线水印字
 * 视觉来源：prototype/app/index-v2.html .brand2
 * title 中的 \n 通过 white-space: pre-line 换行
 */
import type { BrandBlock } from '@/types'

defineProps<{ block: BrandBlock }>()
</script>

<template>
  <section class="brand">
    <div class="kick">{{ block.kick }}</div>
    <div class="wm">WELLBIORA<sup>™</sup></div>
    <div class="cn">{{ block.title }}</div>
    <div class="desc">{{ block.desc }}</div>
    <div v-if="block.image" class="bimg">
      <img :src="block.image" alt="品牌故事配图" loading="lazy" />
    </div>
  </section>
</template>

<style scoped>
.brand {
  margin: 30px 12px 0;
  background: #022829; /* 深色底 */
  border-radius: 20px;
  padding: 30px 22px 0;
  color: #fff;
  overflow: hidden;
}
.kick {
  font-family: var(--font-serif);
  font-size: 11px;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
}
.wm {
  font-family: var(--font-serif);
  font-size: 24px;
  letter-spacing: 0.2em;
  margin-top: 10px;
}
.wm sup {
  font-size: 10px;
  letter-spacing: 0;
}
.cn {
  font-size: 17px; /* 品牌区标题收小一档，深绿底上更精致 */
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-top: 16px;
  line-height: 1.6;
  white-space: pre-line;
}
.desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.9;
  margin-top: 10px;
}
.bimg {
  margin: 18px -22px 0; /* 图片通栏到底 */
}
.bimg img {
  width: 100%;
  display: block;
}
</style>
