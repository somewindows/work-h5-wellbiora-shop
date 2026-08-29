import { Injectable } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'
import { PRODUCT_DETAILS, PRODUCTS } from '../catalog/catalog.seed'
import type { Product, ProductDetail } from '../catalog/catalog.types'

@Injectable()
export class ProductsService {
  findAll(): Product[] {
    return PRODUCTS
  }

  findOne(id: string): ProductDetail {
    const product = PRODUCT_DETAILS[id]
    if (!product) {
      throw new BusinessException(40404, '商品不存在', 404)
    }
    return product
  }
}
