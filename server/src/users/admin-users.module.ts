import { Module } from '@nestjs/common'

import { OrdersModule } from '../orders/orders.module'
import { ProfileModule } from '../profile/profile.module'
import { AuthModule } from '../auth/auth.module'

import { AdminUsersController } from './admin-users.controller'
import { AdminUsersService } from './admin-users.service'
import { UsersModule } from './users.module'

/**
 * 后台用户（会员）管理模块。
 * 独立成模块而非挂进 UsersModule：需要 ORDER_REPOSITORY（OrdersModule 已反向依赖 UsersModule）
 * 与实名/地址仓储（ProfileModule 经 AuthModule 反向依赖 UsersModule），挂进 UsersModule 会造成模块循环依赖。
 * AuthModule 为 AdminJwtAuthGuard 提供 JwtService（与 OrdersModule 挂 AdminOrderController 同理）。
 */
@Module({
  imports: [AuthModule, UsersModule.register(), OrdersModule.register(), ProfileModule.register()],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
