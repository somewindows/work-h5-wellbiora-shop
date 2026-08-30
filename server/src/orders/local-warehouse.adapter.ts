import { Injectable } from '@nestjs/common'

import { PRODUCTS } from '../catalog/catalog.seed'
import { BusinessException } from '../common/business.exception'

import type { WarehouseAdapter } from './warehouse.adapter'

/** 本地联调仓库：在售 SKU 视为库存充足，不发出任何外部请求。 */
@Injectable()
export class LocalWarehouseAdapter implements WarehouseAdapter {
  async ensureInStock(productIds: string[]): Promise<void> {
    const missing = productIds.find((productId) => !PRODUCTS.some((product) => product.id === productId))
    if (missing) throw new BusinessException(40003, '商品库存不足')
  }
}
