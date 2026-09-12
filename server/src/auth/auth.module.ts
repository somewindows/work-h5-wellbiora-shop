import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { DataSource } from 'typeorm'

import { AuthController } from './auth.controller'
import { CurrentUserController } from './current-user.controller'
import { WechatOAuthController } from './wechat-oauth.controller'
import { WechatOAuthService } from './wechat-oauth.service'
import { AuthService, SMS_LOGIN_RATE_LIMIT } from './auth.service'
import { MySqlSmsCodeStore } from './mysql-sms-code.store'
import { MemorySmsCodeStore, SMS_CODE_STORE } from './sms-code.store'
import { ConsoleSmsProvider, MemorySmsProvider, SMS_PROVIDER, UnconfiguredSmsProvider } from './sms-provider'
import { InMemoryAdminLoginRateLimitStore, MySqlAdminLoginRateLimitStore } from '../admin/admin-login-rate-limit.store'
import { UsersModule } from '../users/users.module'
import { isInMemoryStorage } from '../common/runtime-mode'
import { PaymentsModule } from '../payments/payments.module'

@Module({
  imports: [
    UsersModule.register(),
    PaymentsModule.register(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          process.env.NODE_ENV === 'test'
            ? (config.get<string>('JWT_SECRET') ?? 'test-only-jwt-secret')
            : config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController, CurrentUserController, WechatOAuthController],
  providers: [
    AuthService,
    WechatOAuthService,
    {
      provide: SMS_CODE_STORE,
      inject: isInMemoryStorage() ? [] : [DataSource],
      useFactory: (dataSource?: DataSource) =>
        isInMemoryStorage()
          ? new MemorySmsCodeStore()
          : new MySqlSmsCodeStore(dataSource as DataSource),
    },
    {
      // 复审 R01：H5 登录按手机号 + IP 限速；复用管理端通用限流存储（键前缀 sms-login- 与管理端隔离）
      provide: SMS_LOGIN_RATE_LIMIT,
      inject: isInMemoryStorage() ? [] : [DataSource],
      useFactory: (dataSource?: DataSource) => {
        const maxFailures = Math.max(1, Number(process.env.SMS_LOGIN_MAX_FAILURES) || 10)
        const lockMs = Math.max(1, Number(process.env.SMS_LOGIN_LOCK_MINUTES) || 10) * 60_000
        return isInMemoryStorage()
          ? new InMemoryAdminLoginRateLimitStore(maxFailures, lockMs)
          : new MySqlAdminLoginRateLimitStore(dataSource as DataSource, maxFailures, lockMs)
      },
    },
    {
      provide: SMS_PROVIDER,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') return new MemorySmsProvider()
        if (process.env.NODE_ENV === 'development' || process.env.LOCAL_TEST_MODE === '1') return new ConsoleSmsProvider()
        // 真实短信服务商接入前的联调逃生门：显式置 SMS_DEV_CONSOLE=1 才把验证码打到日志；
        // 生产环境由 main.ts 的生产启动守卫拦截（置 1 直接拒绝启动），该分支仅在非生产可达
        if (process.env.SMS_DEV_CONSOLE === '1') return new ConsoleSmsProvider()
        return new UnconfiguredSmsProvider()
      },
    },
  ],
  exports: [SMS_PROVIDER, JwtModule],
})
export class AuthModule {}
