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
  refunding: { label: '退款中', tagType: 'warning' },
  refunded: { label: '已退款', tagType: 'info' },
}

/** 退款单状态（复审 R04：受理≠到账，success 才是终态） */
const REFUND_STATUS_MAP: Record<string, StatusMeta> = {
  processing: { label: '处理中', tagType: 'warning' },
  success: { label: '已到账', tagType: 'success' },
  abnormal: { label: '异常', tagType: 'danger' },
  closed: { label: '已关闭', tagType: 'info' },
  failed: { label: '未受理', tagType: 'danger' },
}

/** 海关申报状态（微信自助清关 customdeclarequery 回执） */
const CUSTOMS_STATE_MAP: Record<string, StatusMeta> = {
  UNDECLARED: { label: '未申报', tagType: 'info' },
  SUBMITTED: { label: '已提交海关', tagType: 'primary' },
  PROCESSING: { label: '海关处理中', tagType: 'primary' },
  SUCCESS: { label: '申报成功', tagType: 'success' },
  FAIL: { label: '申报失败', tagType: 'danger' },
  EXCEPT: { label: '申报异常', tagType: 'danger' },
}

export function customsStateMeta(state: string): StatusMeta {
  return CUSTOMS_STATE_MAP[state] ?? { label: state || '未知', tagType: 'info' }
}

/** 订购人/支付人身份校验结果文案 */
export function certCheckLabel(result: string): string {
  if (result === 'SAME') return '一致'
  if (result === 'DIFFERENT') return '不一致（三单对碰会对不上，需排查）'
  return '未校验'
}

export function refundStatusMeta(status: string): StatusMeta {
  return REFUND_STATUS_MAP[status] ?? { label: status || '未知', tagType: 'info' }
}

/** 退款发起渠道文案 */
export function refundChannelLabel(channel: string): string {
  return channel === 'platform' ? '商户平台' : '后台'
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
  payment: '支付回调',
  system: '系统',
}

export function eventSourceLabel(source: string): string {
  return EVENT_SOURCE_MAP[source] ?? source
}
