import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { UserEntity } from './user.entity'
import { InMemoryUsersRepository, TypeOrmUsersRepository, USERS_REPOSITORY } from './users.repository'

@Module({})
export class UsersModule {
  static register(): DynamicModule {
    if (process.env.NODE_ENV === 'test') {
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
