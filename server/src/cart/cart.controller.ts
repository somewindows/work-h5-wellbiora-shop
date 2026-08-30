import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'

import { CurrentUserId } from '../common/current-user.decorator'
import { JwtAuthGuard } from '../common/jwt-auth.guard'

import { AddCartItemDto, UpdateCartItemDto } from './cart.dto'
import { CartService, type CartItemResponse } from './cart.service'

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<CartItemResponse[]> {
    return this.cartService.list(userId)
  }

  @Post('items')
  add(@CurrentUserId() userId: string, @Body() dto: AddCartItemDto): Promise<CartItemResponse[]> {
    return this.cartService.add(userId, dto)
  }

  @Patch('items/:id')
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateCartItemDto): Promise<CartItemResponse[]> {
    return this.cartService.update(userId, id, dto)
  }

  @Delete('items/:id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<CartItemResponse[]> {
    return this.cartService.remove(userId, id)
  }
}
