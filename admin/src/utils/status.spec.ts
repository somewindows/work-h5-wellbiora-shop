import { describe, expect, it } from 'vitest'

import { eventSourceLabel, ORDER_STATUS_TABS, orderStatusMeta, paymentStatusMeta } from './status'

describe('订单状态映射', () => {
  it('覆盖服务端全部五种本地主状态', () => {
    expect(orderStatusMeta('pay').label).toBe('待支付')
    expect(orderStatusMeta('ship').label).toBe('待发货')
    expect(orderStatusMeta('receive').label).toBe('待收货')
    expect(orderStatusMeta('complete').label).toBe('已完成')
    expect(orderStatusMeta('cancelled').label).toBe('已取消')
  })

  it('覆盖支付状态', () => {
    expect(paymentStatusMeta('pending').label).toBe('待支付')
    expect(paymentStatusMeta('paid').label).toBe('已支付')
    expect(paymentStatusMeta('refunded').label).toBe('已退款')
  })

  it('未知状态兜底为原始值，不崩溃', () => {
    expect(orderStatusMeta('weird').label).toBe('weird')
    expect(paymentStatusMeta('').label).toBe('未知')
  })

  it('Tab 选项含全部与五种状态', () => {
    expect(ORDER_STATUS_TABS.map((tab) => tab.key)).toEqual(['', 'pay', 'ship', 'receive', 'complete', 'cancelled'])
  })

  it('事件来源文案映射', () => {
    expect(eventSourceLabel('admin')).toBe('管理员操作')
    expect(eventSourceLabel('sync')).toBe('仓储同步')
    expect(eventSourceLabel('unknown-src')).toBe('unknown-src')
  })
})
