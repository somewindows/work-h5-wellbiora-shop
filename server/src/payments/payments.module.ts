import { DynamicModule, Module } from '@nestjs/common'

import { loadWechatPayConfig, WECHAT_PAY_CONFIG, type WechatPayConfig } from './wechat-pay.config'
import { WechatPayClient } from './wechat-pay.client'
import { WechatCustomsService } from './wechat-customs.service'

/**
 * 微信支付能力模块：配置齐全时提供 WechatPayClient / WechatCustomsService；
 * 未配置时 WECHAT_PAY_CONFIG = null，其余 provider 不注册（消费方用 optional 注入）。
 */
@Module({})
export class PaymentsModule {
  static register(): DynamicModule {
    const config = loadWechatPayConfig()
    const providers: DynamicModule['providers'] = [{ provide: WECHAT_PAY_CONFIG, useValue: config }]
    const exports: DynamicModule['exports'] = [WECHAT_PAY_CONFIG]
    if (config) {
      providers.push({ provide: WechatPayClient, useFactory: () => new WechatPayClient(config as WechatPayConfig) }, WechatCustomsService)
      exports.push(WechatPayClient, WechatCustomsService)
    }
    return { module: PaymentsModule, providers, exports }
  }
}
