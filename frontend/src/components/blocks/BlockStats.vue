<script setup lang="ts">
/**
 * 数据网格块（4 宫格）：数字 + 单位 + 中文说明 + 英文小字，note 为数据宣称脚注
 * 两种布局：
 *  - page：首页页级网格（白卡圆角 12px，原型 .stats）
 *  - card：详情页卡片内嵌（1px 分割线网格，原型 .stats-in，带块头）
 * 视觉来源：style-v2.css .stats/.stat 与 .stats-in
 */
import type { StatsBlock } from '@/types'
import BlockCard from './BlockCard.vue'
import SectionHead from '../SectionHead.vue'

withDefaults(defineProps<{ block: StatsBlock; layout?: 'page' | 'card' }>(), { layout: 'page' })
</script>

<template>
  <!-- 详情页卡片内嵌版 -->
  <BlockCard v-if="layout === 'card'" kick="Key Numbers" cn="核心数据">
    <div class="stats-in">
      <div v-for="(s, i) in block.items" :key="i" class="stat">
        <div class="n">{{ s.n }}<small v-if="s.unit">{{ s.unit }}</small></div>
        <div class="l">{{ s.l }}</div>
        <div class="d">{{ s.d }}</div>
      </div>
    </div>
    <p v-if="block.note" class="note">{{ block.note }}</p>
  </BlockCard>

  <!-- 首页页级网格版（可选模块标题） -->
  <div v-else>
    <SectionHead v-if="block.title" :kick="block.en ?? ''" :cn="block.title" />
    <div class="stats">
      <div v-for="(s, i) in block.items" :key="i" class="stat">
        <div class="n">{{ s.n }}<small v-if="s.unit">{{ s.unit }}</small></div>
        <div class="l">{{ s.l }}</div>
        <div class="d">{{ s.d }}</div>
      </div>
    </div>
    <p v-if="block.note" class="note page-note">{{ block.note }}</p>
  </div>
</template>

<style scoped>
/* 页级网格（首页） */
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 12px;
}
.stat {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
}
.n {
  font-size: 25px;
  font-weight: 700;
  color: #033b3c;
  font-family: var(--font-serif);
  letter-spacing: -0.01em;
}
.n small {
  font-size: 12px;
  font-weight: 600;
  margin-left: 2px;
}
.l {
  font-size: 12px;
  color: #6b6660;
  margin-top: 4px;
}
.d {
  font-size: 10px;
  color: #a8a29a;
  margin-top: 2px;
  font-family: var(--font-serif);
  letter-spacing: 0.06em;
}
/* 详情页卡片内嵌：1px 分割线网格 */
.stats-in {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: #eae6df;
  border-radius: 10px;
  overflow: hidden;
}
.stats-in .stat {
  border-radius: 0;
}
/* 数据宣称脚注（带 * 时必填） */
.note {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 10px;
  line-height: 1.7;
  white-space: pre-line;
}
.page-note {
  padding: 0 12px;
}
</style>
