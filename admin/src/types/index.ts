/**
 * 与服务端 server/src 对齐的类型定义（金额一律以分传输）
 * 来源：catalog.repository.ts / catalog.types.ts / admin-order.service.ts / audit-log.repository.ts
 */

/** 内容块：type + 各类型自有字段（content-blocks.md 定稿 16 种 type） */
export interface ContentBlock {
  type: string
  hidden?: boolean
  [key: string]: unknown
}

/** 管理端商品完整记录（CatalogProductRecord） */
export interface AdminProduct {
  id: string
  name: string
  en: string
  priceFen: number
  theme: string
  themeLight: string
  cardImg: string
  tags: string[]
  spec: string
  flavor?: string
  ingredients: string
  originCert: string
  usage?: string
  complianceText: string
  blocks: ContentBlock[]
  draftBlocks: ContentBlock[]
  contentVersion: number
  isActive: boolean
  goodsNo: string | null
  warehouseCode: string | null
  createdAt: string
  updatedAt: string
}

/** 新建商品入参（CreateAdminProductDto，全部字段） */
export interface CreateProductPayload {
  id: string
  name: string
  en: string
  priceFen: number
  theme: string
  themeLight: string
  cardImg: string
  tags?: string[]
  spec: string
  flavor?: string
  ingredients: string
  originCert: string
  usage?: string
  complianceText: string
}

/** 更新商品入参（UpdateAdminProductDto，全部可选；注意无 id / complianceText） */
export interface UpdateProductPayload {
  name?: string
  en?: string
  priceFen?: number
  theme?: string
  themeLight?: string
  cardImg?: string
  tags?: string[]
  spec?: string
  flavor?: string
  ingredients?: string
  originCert?: string
  usage?: string
  goodsNo?: string
  warehouseCode?: string
  isActive?: boolean
}

/** 管理端订单列表项（AdminOrderListItem） */
export interface AdminOrderListItem {
  orderNo: string
  status: string
  paymentStatus: string
  warehouseStatus: string | null
  customsRejected: boolean
  systemRemark: string | null
  totalFen: number
  receiverName: string
  receiverPhone: string
  createdAt: string
  paidAt: string | null
}

/** 管理端订单详情（AdminOrderDetail，phone/idcard 服务端已脱敏） */
export interface AdminOrderDetail extends AdminOrderListItem {
  userId: string
  requestId: string
  items: { productId: string; name: string; spec: string; priceFen: number; quantity: number; img: string; themeLight: string }[]
  address: { name: string; phone: string; line: string }
  idName: string
  idcard: string
  refundFen: number | null
  refundedAt: string | null
  cancelledAt: string | null
  statusEvents: { fromStatus: string | null; toStatus: string; source: string; remark: string | null; createdAt: string }[]
}

/** 操作日志记录（AuditLogRecord，createdAt 经 JSON 序列化为字符串） */
export interface AuditLogRecord {
  id: string
  adminId: string
  adminUsername: string
  action: string
  targetType: string
  targetId: string
  beforeData: Record<string, unknown> | Record<string, unknown>[] | null
  afterData: Record<string, unknown> | Record<string, unknown>[] | null
  createdAt: string
}

/** 分页响应壳内的 data 形状 */
export interface PageResult<T> {
  total: number
  list: T[]
}

/** 统一响应壳（api-response.interceptor / http-exception.filter） */
export interface ApiResponse<T> {
  code: number
  message?: string
  data: T | null
}
