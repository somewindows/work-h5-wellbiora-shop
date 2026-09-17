/**
 * 后台图片上传的纯逻辑：MIME 白名单 → 扩展名映射。
 * 不信任客户端原始文件名（防路径穿越），落盘扩展名只从 MIME 推导。
 */

/** 允许上传的图片 MIME → 扩展名 */
export const IMAGE_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

/** 返回 MIME 对应的扩展名；不在白名单内返回 null */
export function extensionForMime(mimetype: string): string | null {
  return IMAGE_EXTENSION_BY_MIME[mimetype] ?? null
}

/** 上传大小上限：5MB */
export const UPLOAD_MAX_FILE_SIZE = 5 * 1024 * 1024
