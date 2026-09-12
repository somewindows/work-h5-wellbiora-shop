import { describe, expect, it } from 'vitest'

import { fenToPrice, fenToYuan, formatDateTime } from './format'

describe('fenToYuan / fenToPrice', () => {
  it('整元不带小数，零头保留两位', () => {
    expect(fenToYuan(32900)).toBe('329')
    expect(fenToYuan(29950)).toBe('299.50')
    expect(fenToPrice(1)).toBe('¥0.01')
  })
})

describe('formatDateTime', () => {
  it('ISO 串转本地 YYYY-MM-DD HH:mm', () => {
    // 用本地时间构造，避免时区差异导致断言不稳
    const iso = new Date(2026, 8, 12, 19, 30, 45).toISOString()
    expect(formatDateTime(iso)).toBe('2026-09-12 19:30')
  })

  it('空值返回空串', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('')).toBe('')
  })

  it('解析不了的输入原样返回（mock 数据兜底）', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
