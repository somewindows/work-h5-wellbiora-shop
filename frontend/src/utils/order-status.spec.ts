import { describe, expect, it } from 'vitest'

import { ORDER_STATUS_MAP, orderStatusInfo } from './order-status'

describe('orderStatusInfo（复审 R14）', () => {
  it('五种契约状态都有文案', () => {
    for (const status of ['pay', 'ship', 'recv', 'done', 'cancelled'] as const) {
      expect(ORDER_STATUS_MAP[status].label).toBeTruthy()
      expect(orderStatusInfo(status).label).toBe(ORDER_STATUS_MAP[status].label)
    }
  })

  it('未知状态降级为「状态未知」而不是 undefined', () => {
    expect(orderStatusInfo('receive')).toEqual({ label: '状态未知', en: 'Unknown' })
    expect(orderStatusInfo('')).toEqual({ label: '状态未知', en: 'Unknown' })
  })
})
