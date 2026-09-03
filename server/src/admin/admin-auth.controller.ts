import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common'

import { AdminAuthService } from './admin-auth.service'
import { AdminLoginDto } from './dto/admin-login.dto'

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto, @Ip() ip: string): Promise<{ token: string; admin: { id: string; username: string } }> {
    return this.adminAuthService.login(dto.username, dto.password, ip)
  }
}
