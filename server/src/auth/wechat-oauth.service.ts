import { Inject, Injectable, Logger } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'
import { WECHAT_PAY_CONFIG, type WechatPayConfig } from '../payments/wechat-pay.config'
import { USERS_REPOSITORY, type UsersRepository } from '../users/users.repository'

interface WechatOAuthTokenResponse {
  openid?: string
  errcode?: number
  errmsg?: string
}

/**
 * 公众号网页授权（snsapi_base 静默授权）：换取支付所需的 openid。
 * 仅在 WXPAY_* 配置齐全时启用；openid 只写库不回显给前端。
 */
@Injectable()
export class WechatOAuthService {
  private readonly logger = new Logger(WechatOAuthService.name)
  /** 单测可覆写；生产用全局 fetch */
  fetchImpl: typeof fetch = fetch

  constructor(
    @Inject(WECHAT_PAY_CONFIG) private readonly config: WechatPayConfig | null,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  isEnabled(): boolean {
    return this.config !== null
  }

  /**
   * 生成微信授权链接。redirect 只允许站内相对路径（防开放重定向），
   * 回跳地址复用 WXPAY_NOTIFY_URL 的站点源。
   */
  buildAuthorizeUrl(redirect: string): string {
    const config = this.requireConfig()
    if (!redirect.startsWith('/') || redirect.startsWith('//')) {
      throw new BusinessException(40003, 'redirect 只允许站内相对路径')
    }
    const origin = new URL(config.notifyUrl).origin
    const redirectUri = encodeURIComponent(`${origin}${redirect}`)
    return (
      `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${config.appId}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=wb#wechat_redirect`
    )
  }

  /** 用授权 code 换 openid 并绑定到当前登录用户（幂等）。 */
  async bindOpenId(userId: string, code: string): Promise<void> {
    const config = this.requireConfig()
    const url =
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.appId}` +
      `&secret=${config.appSecret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`
    const response = await this.fetchImpl(url)
    const body = (await response.json()) as WechatOAuthTokenResponse
    if (!body.openid) {
      this.logger.warn(`code 换 openid 失败：errcode=${body.errcode ?? '无'} errmsg=${body.errmsg ?? '无'}`)
      throw new BusinessException(40002, `微信授权失败：${body.errmsg ?? `errcode=${body.errcode ?? '未知'}`}`)
    }
    await this.users.updateWechatOpenId(userId, body.openid)
    this.logger.log(`已绑定微信 openid（用户 ${userId}）`)
  }

  private requireConfig(): WechatPayConfig {
    if (!this.config) throw new BusinessException(40404, '微信支付未配置', 404)
    return this.config
  }
}
