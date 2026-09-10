import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { UserEntity } from './user.entity'
import { isInMemoryStorage } from '../common/runtime-mode'
import { InMemoryUsersRepository, TypeOrmUsersRepository, USERS_REPOSITORY } from './users.repository'

@Module({})
export class UsersModule {
  /**
   * 记忆化：AuthModule 与 OrdersModule 都会引入用户仓储，
   * 返回同一个 DynamicModule 引用让 Nest 模块去重，保证内存模式下两处拿到同一份用户数据。
   */
  private static dynamicModule: DynamicModule | null = null

  static register(): DynamicModule {
    if (this.dynamicModule) return this.dynamicModule

    if (isInMemoryStorage()) {
      this.dynamicModule = {
        module: UsersModule,
        providers: [{ provide: USERS_REPOSITORY, useClass: InMemoryUsersRepository }],
        exports: [USERS_REPOSITORY],
      }
      return this.dynamicModule
    }

    this.dynamicModule = {
      module: UsersModule,
      imports: [TypeOrmModule.forFeature([UserEntity])],
      providers: [{ provide: USERS_REPOSITORY, useClass: TypeOrmUsersRepository }],
      exports: [USERS_REPOSITORY],
    }
    return this.dynamicModule
  }
}
