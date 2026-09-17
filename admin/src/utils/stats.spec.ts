import { describe, expect, it } from 'vitest'

import { buildTrendBars, formatMonthDay } from './stats'

describe('趋势柱状图数据（buildTrendBars）', () => {
  it('最大值归一为 100，其余按比例取整', () => {
    const bars = buildTrendBars([
      { date: '2026-09-15', orderCount: 2 },
      { date: '2026-09-16', orderCount: 1 },
      { date: '2026-09-17', orderCount: 4 },
    ])

    expect(bars.map((bar) => bar.heightPercent)).toEqual([50, 25, 100])
    expect(bars.map((bar) => bar.label)).toEqual(['9-15', '9-16', '9-17'])
    expect(bars[2]).toMatchObject({ date: '2026-09-17', orderCount: 4 })
  })

  it('全零与空数组高度全 0（空显不报错）', () => {
    const bars = buildTrendBars([
      { date: '2026-09-16', orderCount: 0 },
      { date: '2026-09-17', orderCount: 0 },
    ])
    expect(bars.every((bar) => bar.heightPercent === 0)).toBe(true)
    expect(buildTrendBars([])).toEqual([])
  })

  it('零单日期保持 0，不被最大值带起', () => {
    const bars = buildTrendBars([
      { date: '2026-09-16', orderCount: 0 },
      { date: '2026-09-17', orderCount: 10 },
    ])
    expect(bars[0].heightPercent).toBe(0)
    expect(bars[1].heightPercent).toBe(100)
  })
})

describe('短日期标签（formatMonthDay）', () => {
  it('YYYY-MM-DD → M-D（去掉前导零）', () => {
    expect(formatMonthDay('2026-09-17')).toBe('9-17')
    expect(formatMonthDay('2026-12-03')).toBe('12-3')
  })

  it('非法输入原样返回', () => {
    expect(formatMonthDay('')).toBe('')
    expect(formatMonthDay('2026/09/17')).toBe('2026/09/17')
    expect(formatMonthDay('2026-13-40')).toBe('2026-13-40')
  })
})
