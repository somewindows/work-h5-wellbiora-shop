import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

import { AuthModule } from '../auth/auth.module'
import { isInMemoryStorage } from '../common/runtime-mode'

import { AdminAccountEntity } from './admin-account.entity'
import { AdminLoginRateLimitEntity } from './admin-login-rate-limit.entity'
import { AuditLogEntity } from './audit-log.entity'
import { AUDIT_LOG_REPOSITORY, InMemoryAuditLogRepository, TypeOrmAuditLogRepository } from './audit-log.repository'
import { AuditLogService } from './audit-log.service'
import { ContentVersionEntity } from './content-version.entity'
import { CONTENT_VERSION_REPOSITORY, InMemoryContentVersionRepository, TypeOrmContentVersionRepository } from './content-version.repository'
import { ADMIN_ACCOUNTS_REPOSITORY, InMemoryAdminAccountsRepository, TypeOrmAdminAccountsRepository } from './admin-accounts.repository'
import { ADMIN_LOGIN_RATE_LIMIT_STORE, InMemoryAdminLoginRateLimitStore, MySqlAdminLoginRateLimitStore } from './admin-login-rate-limit.store'
import { AdminAuditLogController } from './admin-audit-log.controller'
import { AdminAccountsController } from './admin-accounts.controller'
import { AdminAccountsService } from './admin-accounts.service'
import { AdminAuthController } from './admin-auth.controller'
import { AdminCatalogController } from './admin-catalog.controller'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminUploadsController } from './admin-uploads.controller'
import { ADMIN_JWT_SERVICE, createAdminJwtService } from './admin-jwt'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AdminAuthService } from './admin-auth.service'
import { InitialAdminBootstrapService } from './initial-admin-bootstrap.service'
import { AdminPasswordService } from './password.service'

@Global()
@Module({})
export class AdminModule {
  static register(): DynamicModule {
    const isTest = isInMemoryStorage()
    return {
      global: true,
      module: AdminModule,
      imports: isTest ? [AuthModule] : [AuthModule, TypeOrmModule.forFeature([AdminAccountEntity, AuditLogEntity, ContentVersionEntity, AdminLoginRateLimitEntity])],
      controllers: [AdminAuthController, AdminAccountsController, AdminCatalogController, AdminAuditLogController, AdminUploadsController],
      providers: [
        AdminPasswordService,
        AdminAuthService,
        AdminAccountsService,
        AdminCatalogService,
        AuditLogService,
        AdminJwtAuthGuard,
        InitialAdminBootstrapService,
        { provide: ADMIN_JWT_SERVICE, useFactory: createAdminJwtService },
        { provide: ADMIN_ACCOUNTS_REPOSITORY, useClass: isTest ? InMemoryAdminAccountsRepository : TypeOrmAdminAccountsRepository },
        { provide: AUDIT_LOG_REPOSITORY, useClass: isTest ? InMemoryAuditLogRepository : TypeOrmAuditLogRepository },
        { provide: CONTENT_VERSION_REPOSITORY, useClass: isTest ? InMemoryContentVersionRepository : TypeOrmContentVersionRepository },
        {
          provide: ADMIN_LOGIN_RATE_LIMIT_STORE,
          inject: isTest ? [ConfigService] : [ConfigService, DataSource],
          useFactory: (config: ConfigService, dataSource?: DataSource) => {
            const maxFailures = Math.max(1, Number(config.get('ADMIN_LOGIN_MAX_FAILURES')) || 5)
            const lockMs = Math.max(1, Number(config.get('ADMIN_LOGIN_LOCK_MINUTES')) || 10) * 60_000
            return isTest
              ? new InMemoryAdminLoginRateLimitStore(maxFailures, lockMs)
              : new MySqlAdminLoginRateLimitStore(dataSource as DataSource, maxFailures, lockMs)
          },
        },
      ],
      // 全局导出给订单/用户等模块复用（管理员鉴权守卫 + 审计日志 + 守卫回查库所需的账号仓储 + 后台专用 JWT）
      exports: [AuditLogService, AdminJwtAuthGuard, AUDIT_LOG_REPOSITORY, ADMIN_ACCOUNTS_REPOSITORY, ADMIN_JWT_SERVICE],
    }
  }
}
