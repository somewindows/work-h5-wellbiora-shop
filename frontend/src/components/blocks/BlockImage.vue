<script setup lang="ts">
/**
 * 整幅素材图块（详情页）：白卡通栏图，无内边距
 * 视觉来源：prototype/app/style-v2.css .blk.flush
 */
import type { ImageBlock } from '@/types'

defineProps<{ block: ImageBlock }>()
</script>

<template>
  <section class="blk-flush">
    <img :src="block.src" :alt="block.alt || ''" loading="lazy" />
  </section>
</template>

<style scoped>
.blk-flush {
  margin: 14px 12px 0;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
}
.blk-flush img {
  width: 100%;
  display: block;
}
</style>
