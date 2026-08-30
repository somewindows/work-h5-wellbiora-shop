import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { DataSource } from 'typeorm'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { MySqlSmsCodeStore } from './mysql-sms-code.store'
import { MemorySmsCodeStore, SMS_CODE_STORE } from './sms-code.store'
import { ConsoleSmsProvider, MemorySmsProvider, SMS_PROVIDER, UnconfiguredSmsProvider } from './sms-provider'
import { UsersModule } from '../users/users.module'
import { isInMemoryStorage } from '../common/runtime-mode'

@Module({
  imports: [
    UsersModule.register(),
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
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: SMS_CODE_STORE,
      inject: isInMemoryStorage() ? [] : [DataSource],
      useFactory: (dataSource?: DataSource) =>
        isInMemoryStorage()
          ? new MemorySmsCodeStore()
          : new MySqlSmsCodeStore(dataSource as DataSource),
    },
    {
      provide: SMS_PROVIDER,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') return new MemorySmsProvider()
        if (process.env.NODE_ENV === 'development' || process.env.LOCAL_TEST_MODE === '1') return new ConsoleSmsProvider()
        return new UnconfiguredSmsProvider()
      },
    },
  ],
  exports: [SMS_PROVIDER, JwtModule],
})
export class AuthModule {}
