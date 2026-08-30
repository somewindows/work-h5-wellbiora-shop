import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'

import { CurrentUserId } from '../common/current-user.decorator'
import { JwtAuthGuard } from '../common/jwt-auth.guard'

import { CreateAddressDto, SaveRealnameDto, UpdateAddressDto } from './profile.dto'
import { ProfileService, type RealnameResponse } from './profile.service'
import type { AddressRecord } from './profile.repository'

@UseGuards(JwtAuthGuard)
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('addresses')
  getAddresses(@CurrentUserId() userId: string): Promise<AddressRecord[]> {
    return this.profileService.getAddresses(userId)
  }

  @Get('addresses/:id')
  getAddress(@CurrentUserId() userId: string, @Param('id') id: string): Promise<AddressRecord> {
    return this.profileService.getAddress(userId, id)
  }

  @Post('addresses')
  createAddress(@CurrentUserId() userId: string, @Body() dto: CreateAddressDto): Promise<AddressRecord> {
    return this.profileService.createAddress(userId, dto)
  }

  @Patch('addresses/:id')
  updateAddress(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateAddressDto): Promise<AddressRecord> {
    return this.profileService.updateAddress(userId, id, dto)
  }

  @Delete('addresses/:id')
  removeAddress(@CurrentUserId() userId: string, @Param('id') id: string): Promise<null> {
    return this.profileService.removeAddress(userId, id)
  }

  @Get('realname')
  getRealname(@CurrentUserId() userId: string): Promise<RealnameResponse | null> {
    return this.profileService.getRealname(userId)
  }

  @Post('realname')
  saveRealname(@CurrentUserId() userId: string, @Body() dto: SaveRealnameDto): Promise<RealnameResponse> {
    return this.profileService.saveRealname(userId, dto)
  }
}
