<script setup lang="ts">
/**
 * 两列网格商品卡：方图区（主题浅底）+ 标签 + 名称 + 英文名 + 规格 + 价格 + 加购按钮
 * 视觉来源：prototype/app/style-v2.css .pcard2（标签行按任务要求补充，样式取摘要卡 .tag）
 */
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import type { Product } from '@/types'
import { useCartStore } from '@/stores/cart'
import PriceText from './PriceText.vue'

const props = defineProps<{
  product: Product
}>()

const router = useRouter()
const cart = useCartStore()

function goDetail() {
  router.push(`/product/${props.product.id}`)
}

/** 右下角圆形 + 加购，阻止冒泡避免触发跳转 */
async function onAdd() {
  try {
    await cart.add(props.product.id, 1)
    showToast('已加入购物车')
  } catch {
    showToast('加入失败，请重试')
  }
}
</script>

<template>
  <div class="pcard" @click="goDetail">
    <div class="pic" :style="{ background: product.themeLight }">
      <img :src="product.cardImg" :alt="product.name" loading="lazy" />
    </div>
    <div class="body">
      <div v-if="product.tags.length" class="tags">
        <span v-for="t in product.tags.slice(0, 2)" :key="t" class="tag">{{ t }}</span>
      </div>
      <div class="name">{{ product.name }}</div>
      <div class="sub">{{ product.en }}</div>
      <div class="meta">{{ product.flavor ? `${product.flavor} · ` : '' }}{{ product.spec }}</div>
      <div class="row">
        <PriceText :price-fen="product.priceFen" hint="示例价" />
        <button class="addbtn" aria-label="加入购物车" @click.stop="onAdd">+</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 卡片无阴影，靠米白底 + 白卡区分层级 */
.pcard {
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
}
.pic {
  aspect-ratio: 1;
  padding: 10px;
  display: flex;
}
.pic img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  mix-blend-mode: multiply; /* 白底产品图融入主题浅底 */
}
.body {
  padding: 4px 14px 14px;
}
.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.tag {
  font-size: 10px;
  color: #033b3c;
  background: #d9ede2; /* 薄荷绿 */
  border-radius: 4px;
  padding: 3px 6px;
}
.name {
  font-size: 14px; /* 15px 时「脂质体D3+K2+Q10饮」在部分字体下会换行，14px 保证最长名称一行放下 */
  font-weight: 600;
  line-height: 1.35;
  color: #1a1a1a;
  white-space: nowrap;
}
.sub {
  font-family: var(--font-serif);
  font-size: 10px;
  color: #6b6660;
  letter-spacing: 0.06em;
  margin-top: 3px;
}
.meta {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 3px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.addbtn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #033b3c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  border: none;
  padding: 0;
  cursor: pointer;
}
</style>
