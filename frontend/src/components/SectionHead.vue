<script setup lang="ts">
/**
 * 杂志式模块标题：英文衬线小字（kick）+ 中文大标题（cn）+ 可选「查看全部 ›」
 * 视觉来源：prototype/app/style-v2.css .sec2
 */
withDefaults(
  defineProps<{
    kick?: string // 英文衬线小标题（全大写、字距 .22em）
    cn: string // 中文大标题
    moreTo?: string // 「查看全部」路由路径，不传则不显示
    moreText?: string
  }>(),
  { moreText: '查看全部 ›' },
)
</script>

<template>
  <div class="sec-head">
    <div>
      <div v-if="kick" class="kick">{{ kick }}</div>
      <div class="cn">{{ cn }}</div>
    </div>
    <RouterLink v-if="moreTo" class="more" :to="moreTo">{{ moreText }}</RouterLink>
  </div>
</template>

<style scoped>
.sec-head {
  padding: 30px 16px 14px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.kick {
  font-family: var(--font-serif);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.cn {
  font-size: 22px;
  font-weight: 700;
  margin-top: 6px;
  line-height: 1.3;
  color: #022829;
}
.more {
  font-size: 12px;
  color: #a8a29a;
  padding-bottom: 4px;
  text-decoration: none;
}
</style>
