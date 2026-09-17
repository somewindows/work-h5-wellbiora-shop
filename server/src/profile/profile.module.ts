import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { SecurityModule } from '../security/security.module'
import { isInMemoryStorage } from '../common/runtime-mode'

import { AddressEntity } from './address.entity'
import { ProfileController } from './profile.controller'
import {
  ADDRESS_REPOSITORY,
  InMemoryAddressRepository,
  InMemoryRealnameProfileRepository,
  REALNAME_PROFILE_REPOSITORY,
  TypeOrmAddressRepository,
  TypeOrmRealnameProfileRepository,
} from './profile.repository'
import { RealnameProfileEntity } from './realname-profile.entity'
import { ProfileService } from './profile.service'

@Module({})
export class ProfileModule {
  /**
   * 记忆化：OrdersModule 与 AdminUsersModule 都会引入档案模块，
   * 返回同一个 DynamicModule 引用让 Nest 模块去重，避免控制器重复注册。
   */
  private static dynamicModule: DynamicModule | null = null

  static register(): DynamicModule {
    if (this.dynamicModule) return this.dynamicModule

    const isTest = isInMemoryStorage()
    this.dynamicModule = {
      module: ProfileModule,
      imports: isTest
        ? [AuthModule, SecurityModule]
        : [AuthModule, SecurityModule, TypeOrmModule.forFeature([AddressEntity, RealnameProfileEntity])],
      controllers: [ProfileController],
      providers: [
        ProfileService,
        { provide: ADDRESS_REPOSITORY, useClass: isTest ? InMemoryAddressRepository : TypeOrmAddressRepository },
        { provide: REALNAME_PROFILE_REPOSITORY, useClass: isTest ? InMemoryRealnameProfileRepository : TypeOrmRealnameProfileRepository },
      ],
      // 仓储导出给后台用户管理等模块复用（实名状态/地址数聚合）
      exports: [ProfileService, ADDRESS_REPOSITORY, REALNAME_PROFILE_REPOSITORY],
    }
    return this.dynamicModule
  }
}
