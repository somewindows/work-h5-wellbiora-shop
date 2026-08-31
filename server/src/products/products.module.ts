import { Module } from '@nestjs/common'

import { ProductsController } from './products.controller'
import { CATALOG_REPOSITORY } from '../catalog/catalog.repository'

import { PUBLISHED_PRODUCTS_SOURCE, ProductsService } from './products.service'

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, { provide: PUBLISHED_PRODUCTS_SOURCE, useExisting: CATALOG_REPOSITORY }],
})
export class ProductsModule {}
