import { Controller, Get, Param } from '@nestjs/common'

import type { Product, ProductDetail } from '../catalog/catalog.types'

import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductDetail> {
    return this.productsService.findOne(id)
  }
}
