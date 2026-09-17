import type { AdminOrderDetail, AdminCustomsDeclarationResult, AdminOrderListItem, PageResult } from '@/types'

import { request } from './request'

export interface OrderQueryParams {
  status?: string
  keyword?: string
  /** 用户详情页内嵌订单列表用：按下单用户过滤 */
  userId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export function listOrders(params: OrderQueryParams): Promise<PageResult<AdminOrderListItem>> {
  return request.get('/admin/orders', { params })
}

/** 订单导出 CSV（对账用）：复用列表筛选条件（忽略分页，服务端封顶截断）；返回原始 Blob 由页面触发下载 */
export function exportOrdersCsv(params: OrderQueryParams): Promise<Blob> {
  return request.get('/admin/orders/export', { params, responseType: 'blob' })
}

export function getOrder(orderNo: string): Promise<AdminOrderDetail> {
  return request.get(`/admin/orders/${orderNo}`)
}

/** 手动同步仓储（君梦）状态 */
export function syncOrder(orderNo: string): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/sync`)
}

/** 主动向微信查单补状态：支付回调漏单时兜底 */
export function syncOrderPayment(orderNo: string): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/sync-payment`)
}

/** 报关状态查询：只读拉取海关申报回执（含原始字段），排查申报异常原因 */
export function queryCustomsDeclaration(orderNo: string): Promise<AdminCustomsDeclarationResult> {
  return request.get(`/admin/orders/${orderNo}/customs-declaration`)
}

/** 人工重推履约：推仓/申报/申报状态收敛，各步幂等（R10 人工恢复入口） */
export function retryFulfillment(orderNo: string): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/retry-fulfillment`)
}

/** 取消订单：confirm:true 只能由二次确认对话框触发，服务端缺省会 40003 拒绝 */
export function cancelOrder(orderNo: string): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/cancel`, { confirm: true })
}

/** 退款：amountFen 缺省全额，不得超过实付 */
export function refundOrder(orderNo: string, amountFen?: number): Promise<AdminOrderDetail> {
  return request.post(`/admin/orders/${orderNo}/refund`, { confirm: true, ...(amountFen === undefined ? {} : { amountFen }) })
}
