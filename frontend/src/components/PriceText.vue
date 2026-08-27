<script setup lang="ts">
/**
 * 价格展示组件：¥ 符号 12px + 数字 20px/700，促销红
 * 金额单位一律为「分」，内部转元展示
 */
import { computed } from 'vue'
import { fenToYuan } from '@/utils/format'

const props = defineProps<{
  priceFen: number // 金额（分）
  hint?: string // 价格右侧小字，如「示例价」
}>()

const yuan = computed(() => fenToYuan(props.priceFen))
</script>

<template>
  <span class="price">
    <span class="cur">¥</span>{{ yuan }}<span v-if="hint" class="hint">{{ hint }}</span>
  </span>
</template>

<style scoped>
.price {
  color: #e6432d; /* 价格/促销红，仅用于价格 */
  font-weight: 700;
  font-size: 20px;
  line-height: 1;
}
.cur {
  font-size: 12px;
  margin-right: 1px;
}
.hint {
  font-size: 10px;
  font-weight: 400;
  color: #a8a29a;
  margin-left: 2px;
}
</style>
