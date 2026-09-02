import { Inject, Injectable } from '@nestjs/common'

import { CATALOG_REPOSITORY, type SellableProductSource } from '../catalog/catalog.repository'
import { BusinessException } from '../common/business.exception'

import type { WarehouseAdapter, WarehouseOrderStatus } from './warehouse.adapter'

/** 本地联调仓库：以 catalog 当前记录为准，在售且上架的 SKU 视为库存充足，不发出任何外部请求。 */
@Injectable()
export class LocalWarehouseAdapter implements WarehouseAdapter {
  private readonly orderStatuses = new Map<string, WarehouseOrderStatus>()

  constructor(@Inject(CATALOG_REPOSITORY) private readonly products: SellableProductSource) {}

  async ensureInStock(productIds: string[]): Promise<void> {
    for (const productId of productIds) {
      const product = await this.products.findById(productId)
      if (!product || !product.isActive) throw new BusinessException(40003, '商品库存不足')
    }
  }

  async pushOrder(orderNo: string): Promise<void> {
    this.orderStatuses.set(orderNo, { status: 'local-accepted', systemRemark: null })
  }

  async getOrderStatus(orderNo: string): Promise<WarehouseOrderStatus | null> {
    const status = this.orderStatuses.get(orderNo)
    return status ? { ...status } : null
  }

  async cancelOrder(orderNo: string): Promise<void> {
    const status = this.orderStatuses.get(orderNo)
    if (status) status.status = '50' // 君梦状态：订单取消
  }

  /** 测试/联调用：模拟仓储侧履约状态（含海关退单的 systemRemark）。 */
  mockOrderStatus(orderNo: string, status: string, systemRemark: string | null = null): void {
    this.orderStatuses.set(orderNo, { status, systemRemark })
  }
}
