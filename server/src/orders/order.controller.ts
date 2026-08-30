import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'

import { CurrentUserId } from '../common/current-user.decorator'
import { JwtAuthGuard } from '../common/jwt-auth.guard'

import { CreateOrderDto, OrdersQueryDto } from './order.dto'
import { OrderService, type OrderPrecheck, type OrderResponse } from './order.service'

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('precheck')
  precheck(@CurrentUserId() userId: string): Promise<OrderPrecheck> { return this.orderService.precheck(userId) }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateOrderDto): Promise<{ orderNo: string; payParams: Record<string, string> }> { return this.orderService.create(userId, dto) }

  @Get()
  list(@CurrentUserId() userId: string, @Query() query: OrdersQueryDto): Promise<{ total: number; list: OrderResponse[] }> { return this.orderService.list(userId, query.status) }

  @Get(':orderNo')
  get(@CurrentUserId() userId: string, @Param('orderNo') orderNo: string): Promise<OrderResponse> { return this.orderService.get(userId, orderNo) }

  @Post(':orderNo/cancel')
  cancel(@CurrentUserId() userId: string, @Param('orderNo') orderNo: string): Promise<OrderResponse> { return this.orderService.cancel(userId, orderNo) }

  @Get(':orderNo/pay-params')
  payParams(@CurrentUserId() userId: string, @Param('orderNo') orderNo: string): Promise<Record<string, string>> { return this.orderService.getPayParams(userId, orderNo) }

  @Post(':orderNo/mock-pay')
  confirmMockPayment(@CurrentUserId() userId: string, @Param('orderNo') orderNo: string): Promise<OrderResponse> { return this.orderService.confirmMockPayment(userId, orderNo) }
}
