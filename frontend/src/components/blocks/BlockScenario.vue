<script setup lang="ts">
/**
 * 适用场景块（详情页，✓ 列表）
 * 视觉来源：prototype/app/product-v2.html scenario 渲染器 + style-v2.css .scen
 */
import type { ScenarioBlock } from '@/types'
import BlockCard from './BlockCard.vue'

defineProps<{ block: ScenarioBlock }>()
</script>

<template>
  <BlockCard kick="For You If" :cn="block.title">
    <div class="scen">
      <div v-for="(s, i) in block.items" :key="i" class="s">
        <i>✓</i>
        <span>{{ s }}</span>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.scen {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.s {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.s i {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #d9ede2; /* 薄荷绿 */
  color: #033b3c;
  font-style: normal;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
