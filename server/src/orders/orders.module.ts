import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CartModule } from '../cart/cart.module'
import { ProfileModule } from '../profile/profile.module'
import { SecurityModule } from '../security/security.module'

import { LocalPaymentAdapter, PAYMENT_ADAPTER } from './local-payment.adapter'
import { LocalWarehouseAdapter } from './local-warehouse.adapter'
import { OrderController } from './order.controller'
import { OrderEntity } from './order.entity'
import { OrderItemEntity } from './order-item.entity'
import { InMemoryOrderRepository, ORDER_REPOSITORY, TypeOrmOrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { WAREHOUSE_ADAPTER } from './warehouse.adapter'

@Module({})
export class OrdersModule {
  static register(): DynamicModule {
    const isTest = process.env.NODE_ENV === 'test'
    return {
      module: OrdersModule,
      imports: isTest
        ? [AuthModule, CartModule.register(), ProfileModule.register(), SecurityModule]
        : [AuthModule, CartModule.register(), ProfileModule.register(), SecurityModule, TypeOrmModule.forFeature([OrderEntity, OrderItemEntity])],
      controllers: [OrderController],
      providers: [
        OrderService,
        { provide: ORDER_REPOSITORY, useClass: isTest ? InMemoryOrderRepository : TypeOrmOrderRepository },
        { provide: WAREHOUSE_ADAPTER, useClass: LocalWarehouseAdapter },
        { provide: PAYMENT_ADAPTER, useClass: LocalPaymentAdapter },
      ],
    }
  }
}
