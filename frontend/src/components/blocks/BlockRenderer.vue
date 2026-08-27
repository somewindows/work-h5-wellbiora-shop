<script setup lang="ts">
/**
 * 内容块渲染器：按 block.type 分发到对应组件
 * - 未知 type 跳过并 console.warn，绝不让页面白屏
 * - 块列表含 product_rail / product_grid 时统一拉取一次商品数据并注入（页面也可经 products prop 直接传入）
 * - context="detail" 时 stats 块渲染为详情页卡片内嵌版，其余（默认 home）为页级网格版
 */
import { computed, ref, watch, type Component } from 'vue'
import type { ContentBlock, Product } from '@/types'
import { getProducts } from '@/api'
import BlockGallery from './BlockGallery.vue'
import BlockImage from './BlockImage.vue'
import BlockBadges from './BlockBadges.vue'
import BlockNutrition from './BlockNutrition.vue'
import BlockNutritionImage from './BlockNutritionImage.vue'
import BlockStats from './BlockStats.vue'
import BlockScenario from './BlockScenario.vue'
import BlockText from './BlockText.vue'
import BlockHero from './BlockHero.vue'
import BlockNoticeBar from './BlockNoticeBar.vue'
import BlockProductRail from './BlockProductRail.vue'
import BlockProductGrid from './BlockProductGrid.vue'
import BlockImageBanner from './BlockImageBanner.vue'
import BlockCertWall from './BlockCertWall.vue'
import BlockBrandBlock from './BlockBrandBlock.vue'

const props = withDefaults(
  defineProps<{
    blocks: ContentBlock[]
    products?: Product[] // 可选：页面已持有商品数据时直接传入，避免重复请求
    context?: 'home' | 'detail' // 仅影响 stats 块布局
  }>(),
  { context: 'home' },
)

/** type → 组件映射表 */
const BLOCK_MAP: Record<ContentBlock['type'], Component> = {
  gallery: BlockGallery,
  image: BlockImage,
  badges: BlockBadges,
  nutrition: BlockNutrition,
  nutrition_image: BlockNutritionImage,
  stats: BlockStats,
  scenario: BlockScenario,
  text: BlockText,
  hero: BlockHero,
  notice_bar: BlockNoticeBar,
  product_rail: BlockProductRail,
  product_grid: BlockProductGrid,
  image_banner: BlockImageBanner,
  cert_wall: BlockCertWall,
  brand_block: BlockBrandBlock,
}

/** 是否需要商品数据（含商品引用块才拉取） */
const needProducts = computed(() =>
  props.blocks.some((b) => b.type === 'product_rail' || b.type === 'product_grid'),
)

const fetchedProducts = ref<Product[]>([])

watch(
  needProducts,
  async (need) => {
    if (!need || props.products) return
    try {
      fetchedProducts.value = await getProducts()
    } catch (e) {
      // 商品数据拉取失败只影响商品引用块，不影响其他块渲染
      console.warn('[BlockRenderer] 商品数据拉取失败', e)
    }
  },
  { immediate: true },
)

const products = computed(() => props.products ?? fetchedProducts.value)

/** 预处理渲染清单：未知 type 在此告警并过滤，模板里不再做判断 */
const renderList = computed(() =>
  props.blocks.flatMap((block, i) => {
    const comp = BLOCK_MAP[block.type]
    if (!comp) {
      console.warn(`[BlockRenderer] 未知内容块类型: ${(block as ContentBlock).type}，已跳过`)
      return []
    }
    // 商品引用块注入商品数据；stats 按 context 决定布局
    const extra: Record<string, unknown> = {}
    if (block.type === 'product_rail' || block.type === 'product_grid') {
      extra.products = products.value
    }
    if (block.type === 'stats') {
      extra.layout = props.context === 'detail' ? 'card' : 'page'
    }
    return [{ key: `${block.type}-${i}`, block, comp, extra }]
  }),
)
</script>

<template>
  <component
    :is="item.comp"
    v-for="item in renderList"
    :key="item.key"
    :block="item.block"
    v-bind="item.extra"
  />
</template>
