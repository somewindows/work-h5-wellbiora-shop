<script setup lang="ts">
/**
 * 通栏 Banner 图块（首页）：可配 link 跳转（MVP 仅站内路由）
 * 样式与详情页 .blk.flush 一致：白卡圆角通栏图
 */
import { useRouter } from 'vue-router'
import type { ImageBannerBlock } from '@/types'

const props = defineProps<{ block: ImageBannerBlock }>()
const router = useRouter()

function go() {
  if (props.block.link) router.push(props.block.link)
}
</script>

<template>
  <div class="banner" :class="{ clickable: !!block.link }" @click="go">
    <img :src="block.src" :alt="block.alt || ''" loading="lazy" />
  </div>
</template>

<style scoped>
.banner {
  margin: 14px 12px 0;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
}
.clickable {
  cursor: pointer;
}
.banner img {
  width: 100%;
  display: block;
}
</style>
