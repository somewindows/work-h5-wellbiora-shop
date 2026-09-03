import { describe, expect, it } from 'vitest'

import { fenToYuan, formatDateTime, formatMoney, yuanToFen } from './format'

describe('元 ↔ 分转换（浮点安全）', () => {
  it('分转元保留两位小数', () => {
    expect(fenToYuan(32900)).toBe('329.00')
    expect(fenToYuan(5)).toBe('0.05')
    expect(fenToYuan(0)).toBe('0.00')
  })

  it('元转分用 Math.round 避免浮点误差', () => {
    expect(yuanToFen(19.99)).toBe(1999) // 19.99 * 100 = 1998.9999... 的边界
    expect(yuanToFen(329)).toBe(32900)
    expect(yuanToFen(0.05)).toBe(5)
    expect(yuanToFen(0)).toBe(0)
  })

  it('元分互转往返一致', () => {
    expect(yuanToFen(Number(fenToYuan(25900)))).toBe(25900)
  })

  it('formatMoney 带 ¥ 前缀', () => {
    expect(formatMoney(29900)).toBe('¥299.00')
  })
})

describe('日期格式化', () => {
  it('ISO 串转本地时间', () => {
    const result = formatDateTime('2026-08-30T10:00:00.000Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('空值与非法串返回占位符', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime('not-a-date')).toBe('-')
  })
})
