export const WAREHOUSE_ADAPTER = Symbol('WAREHOUSE_ADAPTER')

/** 屏蔽不同保税仓库存与下单接口差异的最小业务端口。 */
export interface WarehouseAdapter {
  ensureInStock(productIds: string[]): Promise<void>
}
