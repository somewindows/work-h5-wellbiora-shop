import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import { UserEntity } from '../users/user.entity'
import { SmsIpRateLimitEntity } from '../auth/sms-ip-rate-limit.entity'
import { SmsVerificationCodeEntity } from '../auth/sms-verification-code.entity'
import { CartItemEntity } from '../cart/cart-item.entity'
import { AddressEntity } from '../profile/address.entity'
import { RealnameProfileEntity } from '../profile/realname-profile.entity'
import { OrderEntity } from '../orders/order.entity'
import { OrderItemEntity } from '../orders/order-item.entity'
import { AdminAccountEntity } from '../admin/admin-account.entity'
import { CatalogProductEntity } from '../catalog/catalog-product.entity'
import { AuditLogEntity } from '../admin/audit-log.entity'
import { ContentVersionEntity } from '../admin/content-version.entity'
import { AdminLoginRateLimitEntity } from '../admin/admin-login-rate-limit.entity'
import { isInMemoryStorage } from '../common/runtime-mode'

@Module({})
export class DatabaseModule {
  static register(): DynamicModule {
    if (isInMemoryStorage()) return { module: DatabaseModule }

    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'mysql' as const,
            host: config.get<string>('MYSQL_HOST', '127.0.0.1'),
            port: config.get<number>('MYSQL_PORT', 3306),
            username: config.get<string>('MYSQL_USER', 'wellbiora'),
            password: config.get<string>('MYSQL_PASSWORD', ''),
            database: config.get<string>('MYSQL_DATABASE', 'wellbiora_shop'),
            entities: [UserEntity, SmsVerificationCodeEntity, SmsIpRateLimitEntity, CartItemEntity, AddressEntity, RealnameProfileEntity, OrderEntity, OrderItemEntity, AdminAccountEntity, CatalogProductEntity, AuditLogEntity, ContentVersionEntity, AdminLoginRateLimitEntity],
            synchronize: false,
          }),
        }),
      ],
    }
  }
}
