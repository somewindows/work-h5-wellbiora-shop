import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { isInMemoryStorage } from '../common/runtime-mode'

import { AdminAccountEntity } from './admin-account.entity'
import { AuditLogEntity } from './audit-log.entity'
import { AUDIT_LOG_REPOSITORY, InMemoryAuditLogRepository, TypeOrmAuditLogRepository } from './audit-log.repository'
import { AuditLogService } from './audit-log.service'
import { ContentVersionEntity } from './content-version.entity'
import { CONTENT_VERSION_REPOSITORY, InMemoryContentVersionRepository, TypeOrmContentVersionRepository } from './content-version.repository'
import { ADMIN_ACCOUNTS_REPOSITORY, InMemoryAdminAccountsRepository, TypeOrmAdminAccountsRepository } from './admin-accounts.repository'
import { AdminAuthController } from './admin-auth.controller'
import { AdminCatalogController } from './admin-catalog.controller'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AdminAuthService } from './admin-auth.service'
import { InitialAdminBootstrapService } from './initial-admin-bootstrap.service'
import { AdminPasswordService } from './password.service'

@Module({})
export class AdminModule {
  static register(): DynamicModule {
    const isTest = isInMemoryStorage()
    return {
      module: AdminModule,
      imports: isTest ? [AuthModule] : [AuthModule, TypeOrmModule.forFeature([AdminAccountEntity, AuditLogEntity, ContentVersionEntity])],
      controllers: [AdminAuthController, AdminCatalogController],
      providers: [
        AdminPasswordService,
        AdminAuthService,
        AdminCatalogService,
        AuditLogService,
        AdminJwtAuthGuard,
        InitialAdminBootstrapService,
        { provide: ADMIN_ACCOUNTS_REPOSITORY, useClass: isTest ? InMemoryAdminAccountsRepository : TypeOrmAdminAccountsRepository },
        { provide: AUDIT_LOG_REPOSITORY, useClass: isTest ? InMemoryAuditLogRepository : TypeOrmAuditLogRepository },
        { provide: CONTENT_VERSION_REPOSITORY, useClass: isTest ? InMemoryContentVersionRepository : TypeOrmContentVersionRepository },
      ],
    }
  }
}
