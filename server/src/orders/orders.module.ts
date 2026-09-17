import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CartModule } from '../cart/cart.module'
import { ProfileModule } from '../profile/profile.module'
import { SecurityModule } from '../security/security.module'
import { UsersModule } from '../users/users.module'
import { isInMemoryStorage } from '../common/runtime-mode'
import { TaskSchedulerService } from '../common/task-scheduler.service'
import { PaymentNotifyController } from '../payments/payment-notify.controller'
import { PaymentsModule } from '../payments/payments.module'
import { WechatPayClient } from '../payments/wechat-pay.client'
import { WechatPaymentAdapter } from '../payments/wechat-payment.adapter'
import { loadWechatPayConfig, WECHAT_PAY_CONFIG, type WechatPayConfig } from '../payments/wechat-pay.config'

import { AdminOrderController } from './admin-order.controller'
import { AdminOrderService } from './admin-order.service'
import { AdminStatsController } from './admin-stats.controller'
import { AdminStatsService } from './admin-stats.service'
import { LocalPaymentAdapter, PAYMENT_ADAPTER } from './local-payment.adapter'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { OrderExpiryJob } from './order-expiry.job'
import { OrderFulfillmentJob } from './order-fulfillment.job'
import { OrderFulfillmentService } from './order-fulfillment.service'
import { OrderController } from './order.controller'
import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'
import { OrderStatusEventEntity } from './order-event.entity'
import { InMemoryOrderRepository, ORDER_REPOSITORY, TypeOrmOrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { RefundEntity } from './refund.entity'
import { RefundSettleJob } from './refund-settle.job'
import { InMemoryRefundRepository, REFUND_REPOSITORY, TypeOrmRefundRepository } from './refund.repository'
import { RefundService } from './refund.service'
import { WAREHOUSE_ADAPTER } from './warehouse.adapter'

@Module({})
export class OrdersModule {
  /**
   * 记忆化：AppModule 与 AdminUsersModule 都会引入订单模块，
   * 返回同一个 DynamicModule 引用让 Nest 模块去重，避免控制器/定时任务重复注册。
   */
  private static dynamicModule: DynamicModule | null = null

  static register(): DynamicModule {
    if (this.dynamicModule) return this.dynamicModule

    const isTest = isInMemoryStorage()
    // 部分配置会在这里直接抛错（fail fast），完整配置与否决定是否挂载回调入口
    const wechatPayConfigured = loadWechatPayConfig() !== null
    this.dynamicModule = {
      module: OrdersModule,
      imports: isTest
        ? [AuthModule, CartModule.register(), ProfileModule.register(), SecurityModule, UsersModule.register(), PaymentsModule.register()]
        : [AuthModule, CartModule.register(), ProfileModule.register(), SecurityModule, UsersModule.register(), PaymentsModule.register(), TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, OrderStatusEventEntity, RefundEntity])],
      controllers: wechatPayConfigured
        ? [OrderController, AdminOrderController, AdminStatsController, PaymentNotifyController]
        : [OrderController, AdminOrderController, AdminStatsController],
      providers: [
        TaskSchedulerService,
        OrderExpiryJob,
        OrderFulfillmentJob,
        OrderFulfillmentService,
        RefundSettleJob,
        OrderService,
        AdminOrderService,
        AdminStatsService,
        RefundService,
        { provide: ORDER_REPOSITORY, useClass: isTest ? InMemoryOrderRepository : TypeOrmOrderRepository },
        { provide: REFUND_REPOSITORY, useClass: isTest ? InMemoryRefundRepository : TypeOrmRefundRepository },
        { provide: WAREHOUSE_ADAPTER, useClass: LocalWarehouseAdapter },
        {
          provide: PAYMENT_ADAPTER,
          inject: [WECHAT_PAY_CONFIG, { token: WechatPayClient, optional: true }],
          useFactory: (config: WechatPayConfig | null, client?: WechatPayClient) =>
            config && client ? new WechatPaymentAdapter(client, config) : new LocalPaymentAdapter(),
        },
      ],
      // 导出给后台用户管理等模块复用（用户订单聚合统计）
      exports: [ORDER_REPOSITORY],
    }
    return this.dynamicModule
  }
}
