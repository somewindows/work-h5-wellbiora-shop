import type { ContentBlock, Product } from '@/types'

/**
 * 为内容块补充渲染所需的非 CMS 参数。
 * 商品图廊使用产品的浅色主题底，图片本身通过 mix-blend-mode 融入该底色。
 */
export function getBlockExtra(
  block: ContentBlock,
  context: 'home' | 'detail',
  products: Product[],
  themeLight?: string,
): Record<string, unknown> {
  const extra: Record<string, unknown> = {}

  if (block.type === 'product_rail' || block.type === 'product_grid') {
    extra.products = products
  }
  if (block.type === 'stats') {
    extra.layout = context === 'detail' ? 'card' : 'page'
  }
  if (block.type === 'gallery' && themeLight) {
    extra.bg = themeLight
  }

  return extra
}
