import { request } from './request'

/** 上传商品图片：FormData POST（request 实例自动带 token、401 跳登录），返回可访问的图片地址 */
export function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/admin/uploads', formData)
}
