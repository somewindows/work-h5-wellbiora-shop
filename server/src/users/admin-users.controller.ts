import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'

import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard'
import { CurrentAdmin } from '../admin/current-admin.decorator'
import type { AdminActor } from '../admin/audit-log.service'

import { AdminUserConfirmDto, AdminUserQueryDto } from './admin-users.dto'
import { AdminUsersService, type AdminUserDetail, type AdminUserListItem } from './admin-users.service'

@Controller('admin/users')
@UseGuards(AdminJwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminUserQueryDto): Promise<{ total: number; list: AdminUserListItem[] }> {
    return this.adminUsersService.list(query)
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.adminUsersService.detail(id)
  }

  @Post(':id/disable')
  @HttpCode(200)
  disable(@Param('id') id: string, @Body() dto: AdminUserConfirmDto, @CurrentAdmin() admin: AdminActor): Promise<AdminUserDetail> {
    return this.adminUsersService.disable(id, dto, admin)
  }

  @Post(':id/enable')
  @HttpCode(200)
  enable(@Param('id') id: string, @Body() dto: AdminUserConfirmDto, @CurrentAdmin() admin: AdminActor): Promise<AdminUserDetail> {
    return this.adminUsersService.enable(id, dto, admin)
  }
}
