/**
 * 订单/支付状态文案与标签样式映射（语义对齐 docs/tech/order-flow.md 状态机）
 * 本地主状态：pay 待支付 / ship 待发货 / receive 待收货 / complete 已完成 / cancelled 已取消
 */

export interface StatusMeta {
  label: string
  /** Element Plus Tag 的 type */
  tagType: 'success' | 'info' | 'warning' | 'danger' | 'primary'
}

const ORDER_STATUS_MAP: Record<string, StatusMeta> = {
  pay: { label: '待支付', tagType: 'warning' },
  ship: { label: '待发货', tagType: 'primary' },
  receive: { label: '待收货', tagType: 'primary' },
  complete: { label: '已完成', tagType: 'success' },
  cancelled: { label: '已取消', tagType: 'info' },
}

const PAYMENT_STATUS_MAP: Record<string, StatusMeta> = {
  pending: { label: '待支付', tagType: 'warning' },
  paid: { label: '已支付', tagType: 'success' },
  refunded: { label: '已退款', tagType: 'info' },
}

/** 订单状态 Tab 选项（全部 = 不传 status） */
export const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'pay', label: '待支付' },
  { key: 'ship', label: '待发货' },
  { key: 'receive', label: '待收货' },
  { key: 'complete', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

export function orderStatusMeta(status: string): StatusMeta {
  return ORDER_STATUS_MAP[status] ?? { label: status || '未知', tagType: 'info' }
}

export function paymentStatusMeta(status: string): StatusMeta {
  return PAYMENT_STATUS_MAP[status] ?? { label: status || '未知', tagType: 'info' }
}

/** 状态事件来源文案 */
export const EVENT_SOURCE_MAP: Record<string, string> = {
  user: '用户操作',
  admin: '管理员操作',
  sync: '仓储同步',
  system: '系统',
}

export function eventSourceLabel(source: string): string {
  return EVENT_SOURCE_MAP[source] ?? source
}
