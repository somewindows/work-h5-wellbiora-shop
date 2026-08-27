<script setup lang="ts">
/**
 * 纯文本块（详情页）：可选标题 + 正文，正文支持 \n 换行
 * 原型无直接对应块，样式取 style.css .block p.desc 的正文规格
 */
import type { TextBlock } from '@/types'
import BlockCard from './BlockCard.vue'

defineProps<{ block: TextBlock }>()
</script>

<template>
  <BlockCard :cn="block.title">
    <p class="body">{{ block.body }}</p>
  </BlockCard>
</template>

<style scoped>
.body {
  font-size: 14px;
  color: #6b6660;
  line-height: 1.7;
  margin: 0;
  white-space: pre-line;
}
</style>
