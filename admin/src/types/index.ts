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

/** 新建商品入参（CreateAdminProductDto；商品 ID 由服务端自动生成，无需提交） */
export interface CreateProductPayload {
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

/** 退款单账本条目（复审 R04/R05：受理≠到账，status=success 才是终态） */
export interface AdminRefundItem {
  refundNo: string
  amountFen: number
  status: string
  channel: string
  reason: string | null
  succeededAt: string | null
  createdAt: string
}

/** 管理端订单详情（AdminOrderDetail，phone/idcard 服务端已脱敏） */
export interface AdminOrderDetail extends AdminOrderListItem {
  userId: string
  requestId: string
  items: { productId: string; name: string; spec: string; priceFen: number; quantity: number; img: string; themeLight: string }[]
  address: { name: string; phone: string; line: string }
  idName: string
  idcard: string
  /** 累计已到账退款（分） */
  refundFen: number | null
  refundedAt: string | null
  /** 剩余可退（分）= 实付 - 已到账 - 在途占用 */
  refundableFen: number
  refunds: AdminRefundItem[]
  cancelledAt: string | null
  /** 海关申报回执状态（null = 未申报，待履约收敛/人工重推） */
  customsDeclareStatus: string | null
  customsDeclaredAt: string | null
  statusEvents: { fromStatus: string | null; toStatus: string; source: string; remark: string | null; createdAt: string }[]
}

/** 报关状态查询结果（海关应答原始字段见 detail，排查 EXCEPT 异常用） */
export interface AdminCustomsDeclarationResult {
  orderNo: string
  transactionId: string
  state: string
  certCheckResult: string
  detail: Record<string, string>
}

/** 后台用户列表项（AdminUserListItem）：手机号服务端已脱敏，无身份证号字段 */
export interface AdminUserListItem {
  id: string
  phoneMasked: string
  nickname: string
  wechatBound: boolean
  realnamed: boolean
  disabled: boolean
  orderCount: number
  /** 累计消费（分）= 已支付口径（paid/refunding/refunded）订单总额 */
  paidTotalFen: number
  createdAt: string
}

/** 年度跨境额度卡（个人年度交易限值 26000 元） */
export interface YearlyQuota {
  year: number
  occupiedFen: number
  remainingFen: number
  limitFen: number
}

/** 后台用户详情（AdminUserDetail） */
export interface AdminUserDetail extends AdminUserListItem {
  /** 实名姓名脱敏（姓氏 + *），未实名为 null */
  realnameNameMasked: string | null
  addressCount: number
  yearlyQuota: YearlyQuota
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
