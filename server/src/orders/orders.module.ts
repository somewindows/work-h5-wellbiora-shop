import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CartModule } from '../cart/cart.module'
import { ProfileModule } from '../profile/profile.module'
import { SecurityModule } from '../security/security.module'
import { UsersModule } from '../users/users.module'
import { isInMemoryStorage } from '../common/runtime-mode'
import { PaymentNotifyController } from '../payments/payment-notify.controller'
import { PaymentsModule } from '../payments/payments.module'
import { WechatPayClient } from '../payments/wechat-pay.client'
import { WechatPaymentAdapter } from '../payments/wechat-payment.adapter'
import { loadWechatPayConfig, WECHAT_PAY_CONFIG, type WechatPayConfig } from '../payments/wechat-pay.config'

import { AdminOrderController } from './admin-order.controller'
import { AdminOrderService } from './admin-order.service'
import { LocalPaymentAdapter, PAYMENT_ADAPTER } from './local-payment.adapter'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { OrderController } from './order.controller'
import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'
import { OrderStatusEventEntity } from './order-event.entity'
import { InMemoryOrderRepository, ORDER_REPOSITORY, TypeOrmOrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { WAREHOUSE_ADAPTER } from './warehouse.adapter'

@Module({})
export class OrdersModule {
  static register(): DynamicModule {
    const isTest = isInMemoryStorage()
    // 部分配置会在这里直接抛错（fail fast），完整配置与否决定是否挂载回调入口
    const wechatPayConfigured = loadWechatPayConfig() !== null
    return {
      module: OrdersModule,
      imports: isTest
        ? [AuthModule, CartModule.register(), ProfileModule.register(), SecurityModule, UsersModule.register(), PaymentsModule.register()]
        : [AuthModule, CartModule.register(), ProfileModule.register(), SecurityModule, UsersModule.register(), PaymentsModule.register(), TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, OrderStatusEventEntity])],
      controllers: wechatPayConfigured
        ? [OrderController, AdminOrderController, PaymentNotifyController]
        : [OrderController, AdminOrderController],
      providers: [
        OrderService,
        AdminOrderService,
        { provide: ORDER_REPOSITORY, useClass: isTest ? InMemoryOrderRepository : TypeOrmOrderRepository },
        { provide: WAREHOUSE_ADAPTER, useClass: LocalWarehouseAdapter },
        {
          provide: PAYMENT_ADAPTER,
          inject: [WECHAT_PAY_CONFIG, { token: WechatPayClient, optional: true }],
          useFactory: (config: WechatPayConfig | null, client?: WechatPayClient) =>
            config && client ? new WechatPaymentAdapter(client, config) : new LocalPaymentAdapter(),
        },
      ],
    }
  }
}
