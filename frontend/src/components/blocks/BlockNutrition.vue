<script setup lang="ts">
/**
 * 营养成分表块（详情页，结构化表格版）
 * 视觉来源：prototype/app/product-v2.html nutrition 渲染器 + style.css .nutri
 */
import type { NutritionBlock } from '@/types'
import BlockCard from './BlockCard.vue'

defineProps<{ block: NutritionBlock }>()
</script>

<template>
  <BlockCard kick="Nutrition Facts" :cn="block.title" :meta="block.meta">
    <table class="nutri">
      <thead>
        <tr>
          <th v-for="h in block.head" :key="h">{{ h }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in block.rows" :key="i">
          <td v-for="(c, j) in r" :key="j">{{ c }}</td>
        </tr>
      </tbody>
    </table>
    <!-- 脚注（† 说明 / 配料 / 过敏原），支持 \n 换行 -->
    <p v-if="block.note" class="nutri-note">{{ block.note }}</p>
  </BlockCard>
</template>

<style scoped>
.nutri {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.nutri th,
.nutri td {
  padding: 9px 4px;
  border-bottom: 1px solid #eae6df;
  text-align: left;
}
.nutri th {
  color: #6b6660;
  font-weight: 400;
  font-size: 12px;
}
/* 第 2、3 列右对齐 */
.nutri td:nth-child(2),
.nutri td:nth-child(3),
.nutri th:nth-child(2),
.nutri th:nth-child(3) {
  text-align: right;
}
.nutri-note {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 10px;
  line-height: 1.7;
  white-space: pre-line; /* \n 直接换行 */
}
</style>
