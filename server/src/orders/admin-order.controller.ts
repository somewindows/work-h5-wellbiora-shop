import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'

import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard'
import { CurrentAdmin } from '../admin/current-admin.decorator'
import type { AdminActor } from '../admin/audit-log.service'

import { AdminOrderConfirmDto, AdminOrderQueryDto, AdminOrderRefundDto } from './admin-order.dto'
import { AdminOrderService, type AdminCustomsDeclarationResult, type AdminOrderDetail, type AdminOrderListItem } from './admin-order.service'

@Controller('admin/orders')
@UseGuards(AdminJwtAuthGuard)
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get()
  list(@Query() query: AdminOrderQueryDto): Promise<{ total: number; list: AdminOrderListItem[] }> {
    return this.adminOrderService.list(query)
  }

  /**
   * 订单导出 CSV（对账用）：复用列表筛选条件，不分页（服务端封顶截断）。
   * 必须声明在 @Get(':orderNo') 之前，否则 'export' 被当成订单号吞掉；
   * 必须 @Res() 直写响应，否则全局 ApiResponseInterceptor 会把 CSV 包进 JSON 壳。
   */
  @Get('export')
  async export(@Query() query: AdminOrderQueryDto, @CurrentAdmin() admin: AdminActor, @Res() response: Response): Promise<void> {
    const { csv } = await this.adminOrderService.exportCsv(query, admin)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    response.setHeader('Content-Type', 'text/csv; charset=utf-8')
    response.setHeader('Content-Disposition', `attachment; filename="orders-${stamp}.csv"`)
    response.send(csv)
  }

  @Get(':orderNo')
  detail(@Param('orderNo') orderNo: string): Promise<AdminOrderDetail> {
    return this.adminOrderService.detail(orderNo)
  }

  @Post(':orderNo/sync')
  @HttpCode(200)
  sync(@Param('orderNo') orderNo: string, @CurrentAdmin() admin: AdminActor): Promise<AdminOrderDetail> {
    return this.adminOrderService.sync(orderNo, admin)
  }

  /** 主动向微信查单补状态：支付回调漏单时的兜底，幂等、无资金动作，不需二次确认 */
  @Post(':orderNo/sync-payment')
  @HttpCode(200)
  syncPayment(@Param('orderNo') orderNo: string, @CurrentAdmin() admin: AdminActor): Promise<AdminOrderDetail> {
    return this.adminOrderService.syncPayment(orderNo, admin)
  }

  /** 报关状态查询：只读拉取海关申报回执（含原始字段），排查申报异常原因 */
  @Get(':orderNo/customs-declaration')
  queryCustomsDeclaration(@Param('orderNo') orderNo: string, @CurrentAdmin() admin: AdminActor): Promise<AdminCustomsDeclarationResult> {
    return this.adminOrderService.queryCustomsDeclaration(orderNo, admin)
  }

  /** 人工重推履约（复审 R10）：推仓/申报/申报状态收敛，各步幂等，不需二次确认 */
  @Post(':orderNo/retry-fulfillment')
  @HttpCode(200)
  retryFulfillment(@Param('orderNo') orderNo: string, @CurrentAdmin() admin: AdminActor): Promise<AdminOrderDetail> {
    return this.adminOrderService.retryFulfillment(orderNo, admin)
  }

  @Post(':orderNo/cancel')
  @HttpCode(200)
  cancel(@Param('orderNo') orderNo: string, @Body() dto: AdminOrderConfirmDto, @CurrentAdmin() admin: AdminActor): Promise<AdminOrderDetail> {
    return this.adminOrderService.cancel(orderNo, dto, admin)
  }

  @Post(':orderNo/refund')
  @HttpCode(200)
  refund(@Param('orderNo') orderNo: string, @Body() dto: AdminOrderRefundDto, @CurrentAdmin() admin: AdminActor): Promise<AdminOrderDetail> {
    return this.adminOrderService.refund(orderNo, dto, admin)
  }
}
