import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'

import { AuthModule } from './auth/auth.module'
import { CartModule } from './cart/cart.module'
import { ApiResponseInterceptor } from './common/api-response.interceptor'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { DatabaseModule } from './database/database.module'
import { HomeModule } from './home/home.module'
import { ProductsModule } from './products/products.module'
import { ProfileModule } from './profile/profile.module'
import { SecurityModule } from './security/security.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.register(),
    AuthModule,
    CartModule.register(),
    SecurityModule,
    HomeModule,
    ProductsModule,
    ProfileModule.register(),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
