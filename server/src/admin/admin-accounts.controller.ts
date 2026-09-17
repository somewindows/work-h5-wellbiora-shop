import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'

import { AdminAccountsService, type AdminAccountView, type AdminAccountWithTempPassword } from './admin-accounts.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { type AdminActor } from './audit-log.service'
import { CurrentAdmin } from './current-admin.decorator'
import { AdminAccountConfirmDto, CreateAdminAccountDto } from './dto/admin-accounts.dto'

/** 管理员账号管理：全部接口仅超级管理员可用（service 内回查库校验） */
@Controller('admin/accounts')
@UseGuards(AdminJwtAuthGuard)
export class AdminAccountsController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Get()
  list(@CurrentAdmin() actor: AdminActor): Promise<AdminAccountView[]> {
    return this.adminAccountsService.list(actor)
  }

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateAdminAccountDto, @CurrentAdmin() actor: AdminActor): Promise<AdminAccountWithTempPassword> {
    return this.adminAccountsService.create(actor, dto)
  }

  @Post(':id/disable')
  @HttpCode(200)
  disable(@Param('id') id: string, @Body() dto: AdminAccountConfirmDto, @CurrentAdmin() actor: AdminActor): Promise<AdminAccountView> {
    return this.adminAccountsService.disable(actor, id, dto)
  }

  @Post(':id/enable')
  @HttpCode(200)
  enable(@Param('id') id: string, @Body() dto: AdminAccountConfirmDto, @CurrentAdmin() actor: AdminActor): Promise<AdminAccountView> {
    return this.adminAccountsService.enable(actor, id, dto)
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@Param('id') id: string, @Body() dto: AdminAccountConfirmDto, @CurrentAdmin() actor: AdminActor): Promise<AdminAccountWithTempPassword> {
    return this.adminAccountsService.resetPassword(actor, id, dto)
  }
}
