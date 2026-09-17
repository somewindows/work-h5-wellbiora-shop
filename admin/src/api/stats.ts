import type { StatsOverview } from '@/types'

import { request } from './request'

/** 数据概览：今日/昨日订单与支付、待发货、退款中、近 7 天订单趋势（只读聚合） */
export function getStatsOverview(): Promise<StatsOverview> {
  return request.get('/admin/stats/overview')
}
