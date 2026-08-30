import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { SecurityModule } from '../security/security.module'

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
  static register(): DynamicModule {
    const isTest = process.env.NODE_ENV === 'test'
    return {
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
      exports: [ProfileService],
    }
  }
}
