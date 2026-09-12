/**
 * 金额格式化工具：统一以「分」存储，展示时转元
 */

/** 分 → 元字符串，如 32900 → '329'，29950 → '299.50' */
export function fenToYuan(fen: number): string {
  const yuan = fen / 100
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2)
}

/** 分 → 带 ¥ 的展示文本 */
export function fenToPrice(fen: number): string {
  return `¥${fenToYuan(fen)}`
}

/**
 * 时间格式化：后端 ISO 串（UTC）→ 本地 'YYYY-MM-DD HH:mm'
 * 解析不了的输入（如 mock 的 'YYYY-MM-DD HH:mm'）原样返回
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
