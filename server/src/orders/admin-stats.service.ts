import { Inject, Injectable } from '@nestjs/common'

import { ORDER_REPOSITORY, type OrderRepository } from './order.repository'

/** 单日统计：订单数按创建时间，支付数/金额按 paid_at（金额单位分） */
export interface AdminStatsDay {
  orderCount: number
  paidCount: number
  paidTotalFen: number
}

/** 数据概览聚合结果（GET /admin/stats/overview） */
export interface AdminStatsOverview {
  today: AdminStatsDay
  yesterday: AdminStatsDay
  /** 待发货订单数（status = ship） */
  pendingShipment: number
  /** 退款中笔数（paymentStatus = refunding） */
  refundingCount: number
  /** 近 7 天订单趋势（按创建时间，含今天，日期升序，零单日期补零） */
  trend: { date: string; orderCount: number }[]
}

/** 本地日期字符串（YYYY-MM-DD）——「今日」口径 = 服务器本地时区（生产服务器在国内，直接用本地时间即可） */
function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

@Injectable()
export class AdminStatsService {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  /** 聚合首页数据概览；now 可注入便于测试今日/昨日边界 */
  async overview(now: Date = new Date()): Promise<AdminStatsOverview> {
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const yesterday = new Date(todayStart)
    yesterday.setDate(yesterday.getDate() - 1)
    // 趋势区间 [六天前零点, 明天零点)：左闭右开，避免 23:59:59.999 精度丢单
    const trendStart = new Date(todayStart)
    trendStart.setDate(trendStart.getDate() - 6)
    const trendEnd = new Date(todayStart)
    trendEnd.setDate(trendEnd.getDate() + 1)

    const [todayOrderCount, yesterdayOrderCount, todayPaid, yesterdayPaid, pendingShipment, refundingCount, daily] =
      await Promise.all([
        this.orders.countCreatedBetween(todayStart, todayEnd),
        this.orders.countCreatedBetween(startOfDay(yesterday), endOfDay(yesterday)),
        this.orders.sumPaidBetween(todayStart, todayEnd),
        this.orders.sumPaidBetween(startOfDay(yesterday), endOfDay(yesterday)),
        this.orders.countByStatus('ship'),
        this.orders.countByPaymentStatus('refunding'),
        this.orders.countCreatedPerDay(trendStart, trendEnd),
      ])

    // 补零：仓储只返回有单日期，趋势固定 7 天连续（升序、含今天）
    const countByDate = new Map(daily.map((row) => [row.date, row.count]))
    const trend: { date: string; orderCount: number }[] = []
    for (let day = new Date(trendStart); day < trendEnd; day.setDate(day.getDate() + 1)) {
      trend.push({ date: localDateKey(day), orderCount: countByDate.get(localDateKey(day)) ?? 0 })
    }

    return {
      today: { orderCount: todayOrderCount, paidCount: todayPaid.count, paidTotalFen: todayPaid.totalFen },
      yesterday: { orderCount: yesterdayOrderCount, paidCount: yesterdayPaid.count, paidTotalFen: yesterdayPaid.totalFen },
      pendingShipment,
      refundingCount,
      trend,
    }
  }
}
