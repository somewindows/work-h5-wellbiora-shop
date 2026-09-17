import { Body, Controller, HttpCode, Ip, Post, UseGuards } from '@nestjs/common'

import { AdminAccountsService } from './admin-accounts.service'
import { AdminAuthService, type AdminLoginResult } from './admin-auth.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { type AdminActor } from './audit-log.service'
import { CurrentAdmin } from './current-admin.decorator'
import { AdminChangePasswordDto } from './dto/admin-accounts.dto'
import { AdminLoginDto } from './dto/admin-login.dto'

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminAccountsService: AdminAccountsService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto, @Ip() ip: string): Promise<AdminLoginResult> {
    return this.adminAuthService.login(dto.username, dto.password, ip)
  }

  /** 修改自己的密码：任何登录管理员可用；强制改密期间守卫只放行此接口 */
  @Post('change-password')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(200)
  async changePassword(@Body() dto: AdminChangePasswordDto, @CurrentAdmin() actor: AdminActor): Promise<{ changed: true }> {
    await this.adminAccountsService.changePassword(actor, dto)
    return { changed: true }
  }
}
