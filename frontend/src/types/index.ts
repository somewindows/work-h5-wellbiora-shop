/**
 * 全局类型定义
 * 契约依据：docs/tech/api-contract.md + docs/tech/content-blocks.md
 * 金额单位一律为「分」（字段名带 Fen 后缀）
 */

/* ===== 统一响应壳 ===== */
export interface ApiResponse<T> {
  code: number
  data: T
  message?: string
}

/* ===== 内容块（Content Blocks）===== */
// 详情页块
export interface GalleryBlock { type: 'gallery'; images: string[] }
export interface ImageBlock { type: 'image'; src: string; alt?: string }
export interface BadgesBlock { type: 'badges'; title: string; items: string[] }
export interface NutritionBlock {
  type: 'nutrition'
  title: string
  meta: string
  head: string[]
  rows: string[][]
  note: string
}
export interface NutritionImageBlock { type: 'nutrition_image'; src: string; alt?: string }
export interface StatsBlock {
  type: 'stats'
  items: { n: string; unit: string; l: string; d: string }[]
  note?: string // 带 * 宣称时脚注必填
}
export interface ScenarioBlock { type: 'scenario'; title: string; items: string[] }
export interface TextBlock { type: 'text'; title?: string; body: string }

// 首页块
export interface HeroBlock {
  type: 'hero'
  badge?: string
  kick: string // 英文衬线小标题
  title: string
  sub?: string
  tags?: string[]
  image?: string
  link?: string
}
export interface NoticeBarBlock { type: 'notice_bar'; text: string }
export interface ProductRailBlock { type: 'product_rail'; title: string; en: string; productIds: string[] }
export interface ProductGridBlock { type: 'product_grid'; title?: string; en?: string; productIds: string[] }
export interface ImageBannerBlock { type: 'image_banner'; src: string; link?: string; alt?: string }
export interface CertWallBlock { type: 'cert_wall'; items: { icon: string; label: string }[] }
export interface BrandBlock {
  type: 'brand_block'
  kick: string
  title: string
  desc: string
  image?: string
}

export type ContentBlock =
  | GalleryBlock
  | ImageBlock
  | BadgesBlock
  | NutritionBlock
  | NutritionImageBlock
  | StatsBlock
  | ScenarioBlock
  | TextBlock
  | HeroBlock
  | NoticeBarBlock
  | ProductRailBlock
  | ProductGridBlock
  | ImageBannerBlock
  | CertWallBlock
  | BrandBlock

/* ===== 商品 ===== */
export interface Product {
  id: string
  name: string
  en: string
  priceFen: number
  theme: string // 产品主题色（点缀）
  themeLight: string // 产品浅色底
  cardImg: string
  tags: string[]
  // 产品档案基础字段（content-blocks.md 2.3，非内容块）
  spec: string
  flavor?: string
  ingredients: string
  originCert: string
  usage?: string
}

export interface ProductDetail extends Product {
  blocks: ContentBlock[]
  complianceText: string // 合规声明（固定注入，运营不可删）
}

/* ===== 购物车 ===== */
export interface CartItem {
  id: string // 购物车行 id
  productId: string
  name: string
  spec: string
  priceFen: number
  quantity: number
  checked: boolean
  img: string
  themeLight: string
  inStock: boolean
}

/* ===== 地址与实名 ===== */
export interface Address {
  id: string
  name: string
  phone: string
  region: string // 省市区
  detail: string
  isDefault: boolean
}

export interface RealnameInfo {
  name: string // 脱敏展示由服务端处理；提交时为明文
  idcard: string
}

/* ===== 订单 ===== */
export type OrderStatus = 'pay' | 'ship' | 'recv' | 'done' | 'cancelled'

export interface OrderItem {
  productId: string
  name: string
  spec: string
  priceFen: number
  quantity: number
  img: string
  themeLight: string
}

export interface OrderLogistics {
  company: string
  trackNo: string
  traces: { time: string; text: string }[]
}

export interface Order {
  orderNo: string
  status: OrderStatus
  createdAt: string
  items: OrderItem[]
  address: { name: string; phone: string; line: string }
  idName: string // 实名姓名（脱敏）
  idcard: string // 实名身份证号（脱敏）
  payTime: string | null
  declareNo: string | null // 海关申报单号
  logistics: OrderLogistics | null
  cancelledReason?: string
}

/* ===== 用户 ===== */
export interface UserInfo {
  id: string
  phone: string // 脱敏
  nickname: string
}
