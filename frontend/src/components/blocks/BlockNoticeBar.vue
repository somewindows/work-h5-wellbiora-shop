<script setup lang="ts">
/**
 * 公告条：薄荷绿胶囊（首页）
 * 视觉来源：prototype/app/style.css .notice
 */
import type { NoticeBarBlock } from '@/types'

defineProps<{ block: NoticeBarBlock }>()
</script>

<template>
  <div class="notice">{{ block.text }}</div>
</template>

<style scoped>
.notice {
  margin: 10px 12px 0;
  background: #d9ede2; /* 薄荷绿 */
  color: #033b3c;
  font-size: 12px;
  border-radius: 999px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}
</style>
