import { Controller, Get, HttpCode, Ip, Post, Body } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'

import { AuthService, type PublicUser } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { SendSmsCodeDto } from './dto/send-sms-code.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sms-code')
  @HttpCode(200)
  async sendSmsCode(@Body() dto: SendSmsCodeDto, @Ip() ip: string): Promise<null> {
    await this.authService.sendSmsCode(dto.phone, ip)
    return null
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<{ token: string; user: PublicUser }> {
    return this.authService.login(dto.phone, dto.code)
  }

  @Get('wechat-silent')
  wechatSilent(): never {
    throw new BusinessException(50101, '微信静默授权尚未配置', 501)
  }
}
