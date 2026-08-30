import { DynamicModule, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CartController } from './cart.controller'
import { CartItemEntity } from './cart-item.entity'
import { CART_REPOSITORY, InMemoryCartRepository, TypeOrmCartRepository } from './cart.repository'
import { CartService } from './cart.service'

@Module({})
export class CartModule {
  static register(): DynamicModule {
    const isTest = process.env.NODE_ENV === 'test'
    return {
      module: CartModule,
      imports: isTest ? [AuthModule] : [AuthModule, TypeOrmModule.forFeature([CartItemEntity])],
      controllers: [CartController],
      providers: [
        CartService,
        { provide: CART_REPOSITORY, useClass: isTest ? InMemoryCartRepository : TypeOrmCartRepository },
      ],
      exports: [CART_REPOSITORY],
    }
  }
}
