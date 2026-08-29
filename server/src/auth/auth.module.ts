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
      inject: process.env.NODE_ENV === 'test' ? [] : [DataSource],
      useFactory: (dataSource?: DataSource) =>
        process.env.NODE_ENV === 'test'
          ? new MemorySmsCodeStore()
          : new MySqlSmsCodeStore(dataSource as DataSource),
    },
    {
      provide: SMS_PROVIDER,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') return new MemorySmsProvider()
        if (process.env.NODE_ENV === 'development') return new ConsoleSmsProvider()
        return new UnconfiguredSmsProvider()
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class AuthModule {}
