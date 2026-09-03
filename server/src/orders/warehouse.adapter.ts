export const WAREHOUSE_ADAPTER = Symbol('WAREHOUSE_ADAPTER')

/** 仓储侧订单履约状态：status 原样保留君梦状态码（本地 mock 用 local-accepted 表示已接收未申报）。 */
export interface WarehouseOrderStatus {
  status: string
  systemRemark: string | null
}

/** 屏蔽不同保税仓库存与下单接口差异的最小业务端口。 */
export interface WarehouseAdapter {
  ensureInStock(productIds: string[]): Promise<void>
  /** 支付成功后推送订单到仓储 */
  pushOrder(orderNo: string): Promise<void>
  /** 查询仓储侧最新履约状态；未推送过的订单返回 null */
  getOrderStatus(orderNo: string): Promise<WarehouseOrderStatus | null>
  /** 请求仓储撤单（仅未申报前有效） */
  cancelOrder(orderNo: string): Promise<void>
}
