<script setup lang="ts">
/**
 * 首页 Hero：杂志封面式（渐变薄荷底 + 大标题 + 标签 + 右下产品图）
 * 视觉来源：prototype/app/index-v2.html .hero2
 * title 中的 \n 通过 white-space: pre-line 换行
 */
import { useRouter } from 'vue-router'
import type { HeroBlock } from '@/types'

const props = defineProps<{ block: HeroBlock }>()
const router = useRouter()

/** 配置了 link 时整块可点（MVP 仅站内路由跳转） */
function go() {
  if (props.block.link) router.push(props.block.link)
}
</script>

<template>
  <section class="hero" :class="{ clickable: !!block.link }" @click="go">
    <div v-if="block.badge" class="h-badge">{{ block.badge }}</div>
    <div class="h-kick">{{ block.kick }}</div>
    <div class="h-title">{{ block.title }}</div>
    <div v-if="block.sub" class="h-sub">{{ block.sub }}</div>
    <div v-if="block.tags?.length" class="h-tags">
      <span v-for="t in block.tags" :key="t" class="h-tag">{{ t }}</span>
    </div>
    <img v-if="block.image" class="h-img" :src="block.image" alt="" />
  </section>
</template>

<style scoped>
.hero {
  margin: 6px 12px 0;
  border-radius: 20px;
  background: linear-gradient(155deg, #edf6f0 0%, #dfeee6 55%, #d9ede2 100%);
  padding: 24px 20px 0;
  position: relative;
  overflow: hidden;
  min-height: 330px;
}
.clickable {
  cursor: pointer;
}
.h-kick {
  font-family: Georgia, serif;
  font-size: 11px;
  letter-spacing: 0.22em;
  color: #033b3c;
  text-transform: uppercase;
}
.h-title {
  font-size: 27px;
  font-weight: 700;
  line-height: 1.32;
  margin-top: 8px;
  color: #022829;
  white-space: pre-line;
}
.h-sub {
  font-size: 12px;
  color: #6b6660;
  margin-top: 8px;
  line-height: 1.7;
  max-width: 58%;
}
.h-tags {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.h-tag {
  font-size: 10px;
  color: #033b3c;
  border: 1px solid rgba(3, 59, 60, 0.35);
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.5);
}
.h-img {
  position: absolute;
  right: -6%;
  bottom: -4%;
  width: 62%;
  mix-blend-mode: multiply; /* 白底产品图融入底色 */
}
.h-badge {
  position: absolute;
  top: 18px;
  right: 18px;
  background: #033b3c;
  color: #fff;
  font-size: 10px;
  padding: 5px 10px;
  border-radius: 999px;
}
</style>
