/**
 * 内容块相关工具：类型清单、草稿/线上差异对比、JSON 文本校验
 * 与服务端 AdminCatalogService.CONTENT_BLOCK_TYPES 保持一致
 */
import type { ContentBlock } from '@/types'

/** 服务端已登记的 16 种内容块 type（新增 type 需先在 content-blocks.md 登记） */
export const KNOWN_BLOCK_TYPES = [
  'gallery', 'image', 'badges', 'nutrition', 'nutrition_image', 'stats', 'scenario', 'text',
  'hero', 'notice_bar', 'product_rail', 'product_grid', 'image_banner', 'cert_wall', 'brand_block',
] as const

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  gallery: '顶部图廊',
  image: '素材图',
  badges: '特点徽章墙',
  nutrition: '营养成分表',
  nutrition_image: '营养表图片',
  stats: '数据网格',
  scenario: '适用场景',
  text: '文字段落',
  hero: '首页品牌区',
  notice_bar: '公告条',
  product_rail: '产品横滑票卡',
  product_grid: '产品卡片区',
  image_banner: '单图横幅',
  cert_wall: '认证图标墙',
  brand_block: '品牌专区',
}

export function isKnownBlockType(type: string): boolean {
  return (KNOWN_BLOCK_TYPES as readonly string[]).includes(type)
}

export function blockTypeLabel(type: string): string {
  return BLOCK_TYPE_LABELS[type] ?? `未知类型（${type}）`
}

/** 递归按键名排序后序列化，保证同内容不同键序的对象对比结果一致 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

/** 草稿与线上块数组是否有差异（发布前提示用） */
export function blocksEqual(a: ContentBlock[], b: ContentBlock[]): boolean {
  return stableStringify(a) === stableStringify(b)
}

/** 新块模板：添加块时给各 type 一个最小骨架，减少运营从零手填 */
export function createBlockTemplate(type: string): ContentBlock {
  switch (type) {
    case 'gallery': return { type, images: [''] }
    case 'image': return { type, src: '', alt: '' }
    case 'badges': return { type, title: '', items: [''] }
    case 'nutrition': return { type, title: '', meta: '', head: ['成分', '每份含量', 'NRV%'], rows: [['', '', '']], note: '' }
    case 'nutrition_image': return { type, src: '', alt: '' }
    case 'stats': return { type, items: [{ n: '', unit: '', l: '', d: '' }], note: '' }
    case 'scenario': return { type, title: '', items: [''] }
    case 'text': return { type, title: '', body: '' }
    case 'hero': return { type, badge: '', kick: '', title: '', sub: '', tags: [], image: '', link: '' }
    case 'notice_bar': return { type, text: '' }
    case 'product_rail': return { type, title: '', en: '', productIds: [] }
    case 'product_grid': return { type, title: '', en: '', productIds: [] }
    case 'image_banner': return { type, src: '', link: '', alt: '' }
    case 'cert_wall': return { type, title: '', en: '', items: [{ icon: '', label: '' }] }
    case 'brand_block': return { type, kick: '', title: '', desc: '', image: '' }
    default: return { type }
  }
}

export interface ParseBlocksResult {
  ok: boolean
  blocks?: ContentBlock[]
  error?: string
}

/** 校验 JSON 文本是否为合法的内容块数组（未知 type 编辑、JSON 预览回写时用） */
export function parseBlocksJson(text: string): ParseBlocksResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { ok: false, error: `JSON 语法错误：${error instanceof Error ? error.message : String(error)}` }
  }
  if (!Array.isArray(parsed)) return { ok: false, error: '内容必须是块数组（[...]）' }
  for (let i = 0; i < parsed.length; i += 1) {
    const block = parsed[i] as unknown
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      return { ok: false, error: `第 ${i + 1} 个块不是对象` }
    }
    if (typeof (block as { type?: unknown }).type !== 'string') {
      return { ok: false, error: `第 ${i + 1} 个块缺少 type 字段` }
    }
  }
  return { ok: true, blocks: parsed as ContentBlock[] }
}
