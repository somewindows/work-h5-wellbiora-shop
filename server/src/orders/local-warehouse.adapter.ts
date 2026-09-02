import { Inject, Injectable } from '@nestjs/common'

import { CATALOG_REPOSITORY, type SellableProductSource } from '../catalog/catalog.repository'
import { BusinessException } from '../common/business.exception'

import type { WarehouseAdapter } from './warehouse.adapter'

/** 本地联调仓库：以 catalog 当前记录为准，在售且上架的 SKU 视为库存充足，不发出任何外部请求。 */
@Injectable()
export class LocalWarehouseAdapter implements WarehouseAdapter {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly products: SellableProductSource) {}

  async ensureInStock(productIds: string[]): Promise<void> {
    for (const productId of productIds) {
      const product = await this.products.findById(productId)
      if (!product || !product.isActive) throw new BusinessException(40003, '商品库存不足')
    }
  }
}
