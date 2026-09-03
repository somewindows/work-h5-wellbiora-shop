import type { AdminProduct, ContentBlock, CreateProductPayload, PageResult, UpdateProductPayload } from '@/types'

import { request } from './request'

export interface ProductQueryParams {
  keyword?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

/** 商品分页列表（管理端视图，含草稿/版本等全部字段） */
export function listProducts(params: ProductQueryParams): Promise<PageResult<AdminProduct>> {
  return request.get('/admin/products', { params })
}

export function getProduct(id: string): Promise<AdminProduct> {
  return request.get(`/admin/products/${id}`)
}

export function createProduct(payload: CreateProductPayload): Promise<AdminProduct> {
  return request.post('/admin/products', payload)
}

/** 局部更新基础信息（保存即生效，不走发布；不能改 id / complianceText） */
export function updateProduct(id: string, payload: UpdateProductPayload): Promise<AdminProduct> {
  return request.patch(`/admin/products/${id}`, payload)
}

/** 保存草稿块（服务端只校验块结构，允许半成品） */
export function saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<AdminProduct> {
  return request.put(`/admin/products/${id}/draft-blocks`, { blocks })
}

/** 发布：草稿整体覆盖线上并记版本号；服务端完整校验不过会返回业务错误 message */
export function publishProduct(id: string): Promise<AdminProduct> {
  return request.post(`/admin/products/${id}/publish`)
}

/** 回滚到上一发布版本（会覆盖当前线上内容与草稿） */
export function rollbackProduct(id: string): Promise<AdminProduct> {
  return request.post(`/admin/products/${id}/rollback`)
}
