<script setup lang="ts">
/**
 * 认证墙（首页）：3 列图标 + 文字
 * 图标为内联 SVG（stroke 深墨绿），key 见 mock 数据：
 * leaf / dna / sugar-free / gluten-free / check-circle / clock
 * 视觉来源：prototype/app/index-v2.html .certs2
 */
import type { CertWallBlock } from '@/types'

defineProps<{ block: CertWallBlock }>()

/** 图标 key → SVG 内部片段（搬自原型 index-v2.html） */
const ICONS: Record<string, string> = {
  leaf: '<path d="M4 20C4 12 10 5 20 4c0 10-6 16-14 16"/><path d="M4 20c4-6 8-9 12-11"/>',
  dna: '<path d="M7 4c0 5 10 7 10 16M17 4c0 5-10 7-10 16M8 8h8M8 16h8"/>',
  'sugar-free': '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M4 4l16 16"/>',
  'gluten-free': '<path d="M12 3v18M7 6l5 3 5-3M7 18l5-3 5 3M7 12h10"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
}

/** 未知图标 key 兜底为 check-circle 并告警，不让块缺失 */
function iconOf(key: string): string {
  const svg = ICONS[key]
  if (!svg) {
    console.warn(`[BlockCertWall] 未知图标 key: ${key}，已回退为 check-circle`)
    return ICONS['check-circle']
  }
  return svg
}
</script>

<template>
  <div class="certs">
    <div v-for="(item, i) in block.items" :key="i" class="cert">
      <!-- 图标内容来自本地常量表，非用户输入，可用 v-html -->
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" v-html="iconOf(item.icon)" />
      {{ item.label }}
    </div>
  </div>
</template>

<style scoped>
.certs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 0 12px;
}
.cert {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #1a1a1a;
  text-align: center;
}
.cert svg {
  width: 26px;
  height: 26px;
  stroke: #033b3c;
}
</style>
