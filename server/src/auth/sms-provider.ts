import { Logger } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'

export const SMS_PROVIDER = Symbol('SMS_PROVIDER')

export interface SmsProvider {
  send(phone: string, code: string): Promise<void>
}

export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name)

  async send(phone: string, code: string): Promise<void> {
    this.logger.warn(`开发短信验证码：${phone} ${code}`)
  }
}

export class MemorySmsProvider implements SmsProvider {
  lastCode = ''

  async send(_phone: string, code: string): Promise<void> {
    this.lastCode = code
  }
}

export class UnconfiguredSmsProvider implements SmsProvider {
  async send(): Promise<void> {
    throw new BusinessException(50001, '短信服务尚未配置', 503)
  }
}
