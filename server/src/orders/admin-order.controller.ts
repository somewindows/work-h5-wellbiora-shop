import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'

import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard'
import { CurrentAdmin } from '../admin/current-admin.decorator'
import type { AdminActor } from '../admin/audit-log.service'

import { AdminOrderConfirmDto, AdminOrderQueryDto, AdminOrderRefundDto } from './admin-order.dto'
import { AdminOrderService, type AdminOrderDetail, type AdminOrderListItem } from './admin-order.service'

@Controller('admin/orders')
@UseGuards(AdminJwtAuthGuard)
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get()
  list(@Query() query: AdminOrderQueryDto): Promise<{ total: number; list: AdminOrderListItem[] }> {
    return this.adminOrderService.list(query)
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
