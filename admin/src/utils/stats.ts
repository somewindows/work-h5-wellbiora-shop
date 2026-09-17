/**
 * 数据概览趋势柱状图的纯逻辑：日期标签与高度归一（不引图表库，视图用纯 CSS/div 渲染）
 */

/** 趋势柱数据点：heightPercent 按区间最大值归一（0-100），供 div 高度百分比使用 */
export interface TrendBar {
  date: string
  /** 'M-D' 短日期标签 */
  label: string
  orderCount: number
  heightPercent: number
}

/** 'YYYY-MM-DD' → 'M-D'（非法输入原样返回，不抛错） */
export function formatMonthDay(date: string): string {
  const parts = date.split('-')
  if (parts.length !== 3) return date
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return date
  return `${month}-${day}`
}

/** 趋势数组 → 柱数据：最大值归一为 100；全零/空数组时高度全 0（空显不报错） */
export function buildTrendBars(trend: { date: string; orderCount: number }[]): TrendBar[] {
  const max = Math.max(0, ...trend.map((item) => item.orderCount))
  return trend.map((item) => ({
    date: item.date,
    label: formatMonthDay(item.date),
    orderCount: item.orderCount,
    heightPercent: max === 0 ? 0 : Math.round((item.orderCount / max) * 100),
  }))
}
