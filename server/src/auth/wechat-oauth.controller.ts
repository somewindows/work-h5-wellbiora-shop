import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'

import { CurrentUserId } from '../common/current-user.decorator'
import { JwtAuthGuard } from '../common/jwt-auth.guard'

import { WechatOAuthService } from './wechat-oauth.service'

class WechatOpenIdDto {
  @IsString()
  @IsNotEmpty()
  code!: string
}

/** 公众号网页授权入口：配合微信支付 JSAPI 获取 openid。 */
@Controller('auth/wechat')
export class WechatOAuthController {
  constructor(private readonly wechatOAuth: WechatOAuthService) {}

  /** 生成静默授权链接；redirect 为站内相对路径（授权完成后回跳） */
  @Get('authorize-url')
  authorizeUrl(@Query('redirect') redirect: string): { url: string } {
    return { url: this.wechatOAuth.buildAuthorizeUrl(redirect || '/') }
  }

  /** 授权回跳后：code 换 openid 并绑定当前用户（需登录） */
  @UseGuards(JwtAuthGuard)
  @Post('openid')
  async bindOpenId(@CurrentUserId() userId: string, @Body() dto: WechatOpenIdDto): Promise<{ bound: true }> {
    await this.wechatOAuth.bindOpenId(userId, dto.code)
    return { bound: true }
  }
}
