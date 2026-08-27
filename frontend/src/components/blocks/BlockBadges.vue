<script setup lang="ts">
/**
 * 配方特点徽章块（详情页）
 * 视觉来源：prototype/app/product-v2.html badges 渲染器 + style.css .badges/.badge
 */
import type { BadgesBlock } from '@/types'
import BlockCard from './BlockCard.vue'

defineProps<{ block: BadgesBlock }>()
</script>

<template>
  <BlockCard kick="Clean Label" :cn="block.title">
    <div class="badges">
      <span v-for="t in block.items" :key="t" class="badge">{{ t }}</span>
    </div>
  </BlockCard>
</template>

<style scoped>
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.badge {
  border: 1px solid #eae6df;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  color: #1a1a1a;
  background: #fff;
}
</style>
