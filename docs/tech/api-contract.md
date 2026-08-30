# 前后端 API 契约（H5 商城）

> 阶段 B 技术设计文档。前端（Vue 3 H5）只调本文定义的自有接口；
> 君梦、微信支付的对接全部收敛在服务端（见 oms-adapter.md、payment-and-funds.md）。
> 协议：HTTPS + JSON，REST 风格，统一前缀 `/api/v1`。

## 一、通用约定

- **金额单位一律为「分」**（整数），字段名带 `Fen` 后缀（如 `priceFen`），杜绝元/分混用。
- 时间：ISO 8601 字符串（`2026-08-26T10:00:00+08:00`）。
- 鉴权：登录后签发 JWT（`Authorization: Bearer <token>`），登录方案见 auth-and-account.md（手机号验证码 + 微信静默授权）。
- 统一响应壳：

```jsonc
// 成功
{ "code": 0, "data": { /* ... */ } }
// 失败
{ "code": 40001, "message": "单笔订单不能超过 5000 元", "data": null }
```

- 业务错误码段（示例约定，实现时可扩充）：
  - `40001` 限额校验失败（单笔/年度）　`40002` 三单对碰失败　`40003` 库存不足
  - `40101` 未登录/登录过期　`40404` 资源不存在　`50001` 下游（君梦/微信）异常
- 分页：`pageNo`（从 1 起）+ `pageSize`，返回 `{ total, list }`。

## 二、接口清单（MVP）

### 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/auth/sms-code` | 发验证码 `{ phone }` |
| POST | `/api/v1/auth/login` | 验证码登录 `{ phone, code }` → `{ token, user }` |
| GET | `/api/v1/users/me` | 查询当前登录用户 |
| GET | `/api/v1/auth/wechat-silent` | 微信静默授权换登录态（服务号网页授权） |

### 商品与页面内容（只读，后台配置的数据从这里出）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/home` | 首页内容块数组（见 content-blocks.md） |
| GET | `/api/v1/products` | 商品列表（卡片信息：名称/价/图/标签） |
| GET | `/api/v1/products/{id}` | 商品详情：基础信息 + `blocks` 内容块数组 + 合规文案 |

### 购物车（服务端存储，多端一致）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/cart` | 我的购物车（含实时价格、库存状态回显） |
| POST | `/api/v1/cart/items` | 加入 `{ productId, quantity }` |
| PATCH | `/api/v1/cart/items/{id}` | 改数量 / 勾选 |
| DELETE | `/api/v1/cart/items/{id}` | 移除 |

### 地址与实名
| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/v1/addresses[/{id}]` | 收货地址 CRUD |
| GET/POST | `/api/v1/realname` | 查询返回脱敏身份证号；首次提交必须含姓名+身份证号（存密文），已有实名资料后可省略 `idcard` 以仅更新姓名 |

### 订单
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/orders/precheck` | 下单预检：限额/实名/库存/税费试算，返回应付金额（分） |
| POST | `/api/v1/orders` | 创建订单（幂等键 `requestId`）→ 返回订单号 + 微信支付参数 |
| GET | `/api/v1/orders` | 订单列表（`status` 过滤：pay/ship/recv/done/cancel） |
| GET | `/api/v1/orders/{orderNo}` | 订单详情（含状态时间线、物流单号） |
| POST | `/api/v1/orders/{orderNo}/cancel` | 取消（服务端按 order-flow.md 第三节窗口裁决） |
| GET | `/api/v1/orders/{orderNo}/pay-params` | 待支付订单重新拉起支付 |

### 回调（不对前端开放，仅列全）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/callbacks/wechat-pay` | 微信支付结果回调（验签+幂等） |
| POST | `/api/v1/callbacks/warehouse/{code}` | 保税仓发货回传（按仓区分，验签在适配层） |

## 三、Mock 策略（前后端并行开发的关键）

契约先行，两边不靠等：

1. 本文档即契约，字段有歧义先改文档再写码。
2. 前端工程内置 **mock 层**：`frontend/mock/` 按本文档返回假数据（数据直接搬原型 `data-v2.js`/`orders-data.js`），环境变量 `VITE_USE_MOCK=1` 切换，前端不等后端就能全链路开发。
3. 后端 NestJS 先实现** mock 控制器**（返回固定数据），再逐个模块替换成真实实现，接口路径不变。
4. 联调顺序：认证 → 商品 → 下单（mock 支付）→ 真微信沙箱 → 真君梦测试环境。

## 四、不做的事（MVP 明确排除）

- 优惠券/积分/分销等营销接口
- 售后工单接口（君梦侧售后接口开发中，MVP 走客服人工）
- 商品搜索（4 个 SKU 用不上）
