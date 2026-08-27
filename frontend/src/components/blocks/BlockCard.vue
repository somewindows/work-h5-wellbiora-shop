<script setup lang="ts">
/**
 * 详情页内容块通用卡片容器：白卡圆角 + 块头（英文 kick / 中文 cn / 说明 meta）
 * 视觉来源：prototype/app/style-v2.css .blk / .blk-h
 */
defineProps<{
  kick?: string // 英文衬线小标题
  cn?: string // 中文标题
  meta?: string // 标题下说明小字
}>()
</script>

<template>
  <section class="blk">
    <div v-if="kick || cn" class="blk-h">
      <div v-if="kick" class="kick">{{ kick }}</div>
      <div v-if="cn" class="cn">{{ cn }}</div>
      <div v-if="meta" class="meta">{{ meta }}</div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.blk {
  margin: 14px 12px 0;
  background: #ffffff;
  border-radius: 16px;
  padding: 18px 16px;
}
.blk-h {
  margin-bottom: 12px;
}
.kick {
  font-family: Georgia, serif;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.cn {
  font-size: 17px;
  font-weight: 700;
  margin-top: 5px;
  color: #022829;
}
.meta {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 6px;
}
</style>
