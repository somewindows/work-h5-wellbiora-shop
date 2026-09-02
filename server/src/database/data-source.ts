import 'reflect-metadata'
import { DataSource } from 'typeorm'

import { UserEntity } from '../users/user.entity'
import { SmsIpRateLimitEntity } from '../auth/sms-ip-rate-limit.entity'
import { SmsVerificationCodeEntity } from '../auth/sms-verification-code.entity'
import { AdminAccountEntity } from '../admin/admin-account.entity'
import { CatalogProductEntity } from '../catalog/catalog-product.entity'
import { AuditLogEntity } from '../admin/audit-log.entity'
import { ContentVersionEntity } from '../admin/content-version.entity'
import { AdminLoginRateLimitEntity } from '../admin/admin-login-rate-limit.entity'

export default new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  username: process.env.MYSQL_USER ?? 'wellbiora',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'wellbiora_shop',
  entities: [UserEntity, SmsVerificationCodeEntity, SmsIpRateLimitEntity, AdminAccountEntity, CatalogProductEntity, AuditLogEntity, ContentVersionEntity, AdminLoginRateLimitEntity],
  migrations: [`${__dirname}/migrations/*.{js,ts}`],
  synchronize: false,
})
