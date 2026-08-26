# 君梦 OMS OpenAPI 2.0 — 开发索引

> 由 `君梦openApi2.0文档.docx` 拆分生成（2026-08-26），供日常开发直接查阅，避免每次解析 docx。
> docx 原文档保留在本目录；若官方更新文档，重跑 `_extract_docx.py` + `_split.py` 重新生成本目录。

## 阅读顺序

1. [00-接入指南.md](00-接入指南.md)：环境地址、公共参数、签名规则（含示例代码）、推单参数 shopId/warehouseNo 获取位置截图。
2. 按下表找到对应接口文件，含完整请求/返回字段表。
3. 枚举值查 `reference/`：电商平台备案编码、支付公司海关备案号、物流编码。

## 速查

- 请求方式：一律 `POST application/json`
- 测试环境：`https://api.jmcompany.cn/test/test/api/openapi_v2/main`
- 生产环境：`https://api.jmcompany.cn/#server/#mechanism/api/openapi_v2/main`（占位符到君梦客户端开放平台获取）
- 签名：去除 sign/params 后按 key 排序拼 `k=v&`，末尾追加 appSecret，MD5 后转大写；timestamp 5 分钟内有效
- 通用返回：`code`（0 成功）/ `msg` / `time` / `logId` / `data`

## 接口清单

| 接口 | Method | 文件 |
|---|---|---|
| 商品档案查询 | `jm.goods.get` | [api/jm.goods.get-商品档案查询.md](api/jm.goods.get-商品档案查询.md) |
| 库存档案查询 | `jm.inventory.get` | [api/jm.inventory.get-库存档案查询.md](api/jm.inventory.get-库存档案查询.md) |
| 入库查询 | `jm.store.in.get` | [api/jm.store.in.get-入库查询.md](api/jm.store.in.get-入库查询.md) |
| 出库查询 | `jm.store.out.get` | [api/jm.store.out.get-出库查询.md](api/jm.store.out.get-出库查询.md) |
| 金二入库单创建 | `jm.two.store.in.create` | [api/jm.two.store.in.create-金二入库单创建.md](api/jm.two.store.in.create-金二入库单创建.md) |
| 金二入库单查询 | `jm.two.store.in.get` | [api/jm.two.store.in.get-金二入库单查询.md](api/jm.two.store.in.get-金二入库单查询.md) |
| 金二入库单查询（批量） | `jm.two.store.in.get.batch` | [api/jm.two.store.in.get.batch-金二入库单查询批量.md](api/jm.two.store.in.get.batch-金二入库单查询批量.md) |
| 金二出库单创建 | `jm.two.store.out.create` | [api/jm.two.store.out.create-金二出库单创建.md](api/jm.two.store.out.create-金二出库单创建.md) |
| 金二出库单查询 | `jm.two.store.out.get` | [api/jm.two.store.out.get-金二出库单查询.md](api/jm.two.store.out.get-金二出库单查询.md) |
| 金二出库单查询（批量） | `jm.two.store.out.get.batch` | [api/jm.two.store.out.get.batch-金二出库单查询批量.md](api/jm.two.store.out.get.batch-金二出库单查询批量.md) |
| 下单接口 | `jm.order.bonded.add` | [api/jm.order.bonded.add-下单接口.md](api/jm.order.bonded.add-下单接口.md) |
| 订单查询接口 | `jm.order.bonded.get` | [api/jm.order.bonded.get-订单查询接口.md](api/jm.order.bonded.get-订单查询接口.md) |
| 订单取消接口 | `jm.order.bonded.cancel` | [api/jm.order.bonded.cancel-订单取消接口.md](api/jm.order.bonded.cancel-订单取消接口.md) |
| 发货接口 | `需要平台提供发货地址` | [api/发货接口.md](api/发货接口.md) |
| 售后单查询接口(开发中) | `jm.aftersale.bonded.get` | [api/jm.aftersale.bonded.get-售后单查询接口开发中.md](api/jm.aftersale.bonded.get-售后单查询接口开发中.md) |

## 本项目对接提示（H5-shop）

- 商城主链路用到的接口：`jm.goods.get`（商品同步）、`jm.inventory.get`（库存）、`jm.order.bonded.add`（下单）、`jm.order.bonded.get`（订单查询）、`jm.order.bonded.cancel`（取消）。
- 金二（金关二期）出入库接口为保税仓内部账册管理，H5 商城一般不直接调用。
- 发货接口文档标注「需要平台提供发货地址」，即物流回传地址由我方提供 —— 待与君梦确认。
- 电商平台备案编码见 `reference/电商平台.md`，我方 H5 自建商城用哪个编码待确认（文档示例用的是有赞 `3301961SWG`）。
- 支付走微信：支付公司海关备案号 `4403169D3W`（财付通），见 `reference/支付公司列表.md`。
- 文档内 appId/appSecret 为官方示例参数，正式参数须从君梦客户端「账号 → 君梦API接口对接」获取（见接入指南截图）。
