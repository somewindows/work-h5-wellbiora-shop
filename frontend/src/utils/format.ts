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
