# 保税仓适配层（OMS Adapter）设计

> 阶段 B 技术设计文档。对应 AGENTS.md 硬性规则第 5 条：
> **所有保税仓对接走统一适配层封装，前端只调我们自己的接口，方便未来扩展成都仓。**

## 一、为什么要有这一层

- 君梦只是当前（义乌仓）的 OMS 实现；成都仓的对接方未确定（待确认事项）。
- 君梦接口有自己的怪癖：MD5 签名且只签公共参数、`plaformCode`/`thridNo` 原始拼写、分页上限 200、状态枚举自己的一套。这些**全部关在适配层里**，业务代码永远不见。
- appSecret 等密钥只允许存在于适配层（服务端），符合硬性规则第 1 条。

## 二、接口抽象（NestJS provider）

```ts
// 每个保税仓一个实现类，实现同一接口
interface WarehouseAdapter {
  getGoods(goodsNo: string): Promise<GoodsInfo>;        // 商品档案（效期/批次）
  getInventory(goodsNos: string[]): Promise<Inventory>; // 可售库存
  pushOrder(order: LocalOrder): Promise<PushResult>;    // 推送订单（幂等）
  queryOrder(batchNo: string): Promise<OmsOrderStatus>;// 状态查询（轮询用）
  cancelOrder(batchNo: string): Promise<CancelResult>;  // 取消（申报前才可用）
}
```

- 业务层（订单模块）只依赖 `WarehouseAdapter` 接口，按订单商品所属仓库**路由**到对应实现。
- `OmsOrderStatus` 用君梦原始状态码透传 + 适配层打 `warehouse: 'junmeng-yiwu'` 标记，映射到展示态是业务层的事（见 order-flow.md）。
- 发货回传是每个仓各自的回调入口（URL 按仓区分），回调验签逻辑也在适配层内。

## 三、路由与数据模型

- 商品档案里每个 SKU 记 `warehouseCode`（如 `yiwu` / 未来 `chengdu`），**一个订单只允许一个仓的商品**（保税订单一单一仓一申报，混仓拆单后期再说，MVP 直接限制）。
- 适配器注册表：`{ yiwu: JunmengYiwuAdapter, chengdu: XxxAdapter }`，配置驱动，加新仓 = 新实现类 + 配置项，不动业务代码。

## 四、可靠性设计

- **签名与密钥**：每个适配器自持 appId/appSecret/shopId/warehouseNo（环境变量注入），签名实现私有，不外泄。
- **幂等**：`pushOrder` 以本地订单号为幂等键，重复推送返回首次结果；网络超时按「状态未知」处理，靠 `queryOrder` 收敛，不盲目重推造成重复申报。
- **重试**：推送失败指数退避重试（如 1/5/15 分钟），超限进人工队列 + 告警。
- **请求日志**：适配层所有出入请求落日志（脱敏），联调期排查签名问题全靠它。
- **测试环境隔离**：适配器按环境变量切换君梦测试/正式地址，签名联调先在测试环境跑通（接入指南见 `docs/vendor/junmeng/00-接入指南.md`）。

## 五、成都仓扩展点（预留，不实现）

- 若成都仓也是君梦：仅多一组配置 + warehouseNo 路由，成本极低。
- 若是另一家 OMS：新写一个 `WarehouseAdapter` 实现，业务层零改动——这就是这层存在的意义。
- 风险：对方字段语义（库存口径、状态枚举、取消规则）必然不同，接入时以「先跑通下单→申报→出库单链路」为验收标准。
