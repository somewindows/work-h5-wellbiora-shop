import { Controller, Get, UseGuards } from '@nestjs/common'

import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard'

import { AdminStatsService, type AdminStatsOverview } from './admin-stats.service'

@Controller('admin/stats')
@UseGuards(AdminJwtAuthGuard)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  /** 首页数据概览：今日/昨日订单与支付、待发货、退款中、近 7 天订单趋势（只读聚合） */
  @Get('overview')
  overview(): Promise<AdminStatsOverview> {
    return this.adminStatsService.overview()
  }
}
