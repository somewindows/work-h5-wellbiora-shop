import type { AdminOrderDetail, AdminOrderListItem, PageResult } from '@/types'

import { request } from './request'

export interface OrderQueryParams {
  status?: string
  keyword?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export function listOrders(params: OrderQueryParams): Promise<PageResult<AdminOrderListItem>> {
  return request.get('/admin/orders', { params })
}

export function getOrder(orderNo: string): Promise<AdminOrderDetail> {
  return request.get(`/admin/orders/${orderNo}`)
}

/** 手动同步仓储（君梦）状态 */
export function syncOrder(orderNo: string): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/sync`)
}

/** 取消订单：confirm:true 只能由二次确认对话框触发，服务端缺省会 40003 拒绝 */
export function cancelOrder(orderNo: string): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/cancel`, { confirm: true })
}

/** 退款：amountFen 缺省全额，不得超过实付 */
export function refundOrder(orderNo: string, amountFen?: number): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/refund`, { confirm: true, ...(amountFen === undefined ? {} : { amountFen }) })
}
