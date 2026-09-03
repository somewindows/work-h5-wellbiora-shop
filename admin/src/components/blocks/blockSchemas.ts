/**
 * 内容块表单 schema：每种 type 声明字段清单，BlockForm 按此渲染通用控件
 * 必填标记与服务端发布校验（AdminCatalogService.validateRequiredFields）保持一致
 */

export type FieldKind =
  | 'string' // 单行文本
  | 'textarea' // 多行文本
  | 'stringArray' // 字符串数组（逐行编辑）
  | 'statsItems' // stats 的 {n, unit, l, d} 行编辑
  | 'iconLabelItems' // cert_wall 的 {icon, label} 行编辑
  | 'productIds' // 商品多选（从商品列表接口拉选项）

export interface BlockField {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  hint?: string
  /** 合规必填提示（带 * 宣称的脚注字段，醒目展示） */
  compliance?: boolean
}

export const BLOCK_SCHEMAS: Record<string, BlockField[]> = {
  gallery: [{ key: 'images', label: '图片地址', kind: 'stringArray', required: true, hint: '至少一张，轮播展示' }],
  image: [
    { key: 'src', label: '图片地址', kind: 'string', required: true },
    { key: 'alt', label: '替代文本', kind: 'string' },
  ],
  badges: [
    { key: 'title', label: '标题', kind: 'string', required: true },
    { key: 'items', label: '徽章项', kind: 'stringArray', required: true },
  ],
  nutrition_image: [
    { key: 'src', label: '图片地址', kind: 'string', required: true },
    { key: 'alt', label: '替代文本', kind: 'string' },
  ],
  stats: [
    { key: 'title', label: '模块标题（页级可选）', kind: 'string' },
    { key: 'en', label: '英文标题（页级可选）', kind: 'string' },
    { key: 'items', label: '数据项', kind: 'statsItems', required: true, hint: '每项含数字 n / 单位 unit / 说明 l / 英文 d' },
    { key: 'note', label: '脚注来源', kind: 'textarea', compliance: true, hint: '带 * 的数据宣称必须填写来源脚注，否则发布会被服务端拒绝' },
  ],
  scenario: [
    { key: 'title', label: '标题', kind: 'string', required: true },
    { key: 'items', label: '场景项', kind: 'stringArray', required: true },
  ],
  text: [
    { key: 'title', label: '标题（可选）', kind: 'string' },
    { key: 'body', label: '正文', kind: 'textarea', required: true, hint: '支持 \\n 分段' },
  ],
  hero: [
    { key: 'badge', label: '角标（可选）', kind: 'string' },
    { key: 'kick', label: '英文引导语', kind: 'string', required: true },
    { key: 'title', label: '标题', kind: 'string', required: true },
    { key: 'sub', label: '副文（可选）', kind: 'string' },
    { key: 'tags', label: '标签（可选）', kind: 'stringArray' },
    { key: 'image', label: '背景图（可选）', kind: 'string' },
    { key: 'link', label: '跳转链接（可选）', kind: 'string' },
  ],
  notice_bar: [{ key: 'text', label: '公告文案', kind: 'string', required: true }],
  product_rail: [
    { key: 'title', label: '标题', kind: 'string', required: true },
    { key: 'en', label: '英文标题', kind: 'string', required: true },
    { key: 'productIds', label: '商品', kind: 'productIds', required: true },
  ],
  product_grid: [
    { key: 'title', label: '标题（可选）', kind: 'string' },
    { key: 'en', label: '英文标题（可选）', kind: 'string' },
    { key: 'productIds', label: '商品', kind: 'productIds', required: true },
  ],
  image_banner: [
    { key: 'src', label: '图片地址', kind: 'string', required: true },
    { key: 'link', label: '跳转链接（可选）', kind: 'string' },
    { key: 'alt', label: '替代文本', kind: 'string' },
  ],
  cert_wall: [
    { key: 'title', label: '模块标题（可选）', kind: 'string' },
    { key: 'en', label: '英文标题（可选）', kind: 'string' },
    { key: 'items', label: '图标项', kind: 'iconLabelItems', required: true, hint: 'icon 为前端内置 SVG 图标 key，未知 key 回退默认图标' },
  ],
  brand_block: [
    { key: 'kick', label: '英文引导语', kind: 'string', required: true },
    { key: 'title', label: '标题', kind: 'string', required: true },
    { key: 'desc', label: '正文', kind: 'textarea', required: true },
    { key: 'image', label: '配图（可选）', kind: 'string' },
  ],
}
