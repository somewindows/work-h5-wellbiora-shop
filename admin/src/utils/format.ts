/**
 * 金额与日期格式化工具：后端金额一律为分，界面层负责 元↔分 转换
 */

/** 分 → 元字符串（保留两位小数，如 32900 → "329.00"） */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

/** 元 → 分（浮点安全：先四舍五入再取整，如 19.99 → 1999） */
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}

/** 带 ¥ 前缀的展示用金额 */
export function formatMoney(fen: number): string {
  return `¥${fenToYuan(fen)}`
}

/** ISO 时间串 → "YYYY-MM-DD HH:mm:ss" 本地时间展示 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
