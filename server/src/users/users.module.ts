import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { UserEntity } from './user.entity'
import { isInMemoryStorage } from '../common/runtime-mode'
import { InMemoryUsersRepository, TypeOrmUsersRepository, USERS_REPOSITORY } from './users.repository'

@Module({})
export class UsersModule {
  static register(): DynamicModule {
    if (isInMemoryStorage()) {
      return {
        module: UsersModule,
        providers: [{ provide: USERS_REPOSITORY, useClass: InMemoryUsersRepository }],
        exports: [USERS_REPOSITORY],
      }
    }

    return {
      module: UsersModule,
      imports: [TypeOrmModule.forFeature([UserEntity])],
      providers: [{ provide: USERS_REPOSITORY, useClass: TypeOrmUsersRepository }],
      exports: [USERS_REPOSITORY],
    }
  }
}
