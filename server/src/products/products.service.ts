import { Inject, Injectable } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'
import { PRODUCT_DETAILS, PRODUCTS } from '../catalog/catalog.seed'
import type { Product, ProductDetail } from '../catalog/catalog.types'

export const PUBLISHED_PRODUCTS_SOURCE = Symbol('PUBLISHED_PRODUCTS_SOURCE')

export interface PublishedProductsSource {
  findAllPublished(): Promise<Product[]>
  findPublishedById(id: string): Promise<ProductDetail | null>
}

export const seedProductsSource: PublishedProductsSource = {
  findAllPublished: async () => PRODUCTS,
  findPublishedById: async (id) => PRODUCT_DETAILS[id] ?? null,
}

@Injectable()
export class ProductsService {
  constructor(@Inject(PUBLISHED_PRODUCTS_SOURCE) private readonly publishedProductsSource: PublishedProductsSource = seedProductsSource) {}

  findAll(): Promise<Product[]> {
    return this.publishedProductsSource.findAllPublished()
  }

  async findOne(id: string): Promise<ProductDetail> {
    const product = await this.publishedProductsSource.findPublishedById(id)
    if (!product) {
      throw new BusinessException(40404, '商品不存在', 404)
    }
    return product
  }
}
