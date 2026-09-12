import type { OrderStatus } from '../types'

/** 订单状态文案（H5 契约状态机：pay 待付款 → ship 待发货 → recv 待收货 → done 已完成 / cancelled 已取消） */
export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; en: string }> = {
  pay: { label: '待付款', en: 'Awaiting Payment' },
  ship: { label: '待发货', en: 'Preparing' },
  recv: { label: '待收货', en: 'In Transit' },
  done: { label: '已完成', en: 'Completed' },
  cancelled: { label: '已取消', en: 'Cancelled' },
}

/** 复审 R14：后端状态机新增状态未同步到前端时降级展示，不让整个页面渲染中断 */
export function orderStatusInfo(status: string): { label: string; en: string } {
  return ORDER_STATUS_MAP[status as OrderStatus] ?? { label: '状态未知', en: 'Unknown' }
}
