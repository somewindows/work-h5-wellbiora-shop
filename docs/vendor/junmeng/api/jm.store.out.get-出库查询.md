# 出库查询

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

可查询客户的出库单据。

请求方式: POST

Content-Type: application/json

Method:jm.store.out.get

请求参数说明

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.inventory.get | 方法名 |
| params | object | Y | body |  |  |
| tradeNo | string | N | params | test | 采购订单号 |
| stockOutNo | string | N | params | kh01 | 入库单号 |
| warehouseId | string | N | params | abc123 | 仓库ID |
| customerId | string | N | params | abc123 | 商品实物条码 |
| startDate | date | N | params | 2020-01-01 00:00:00 | 单据开始日期 |
| endDate | date | N | params | 2020-01-01 01:00:00 | 单据结束日期 |
| status | number | N | params | 20 | 单据状态：0:待处理 20:待出库 50:已取消 100:已处理 |
| pageNo | number | N | params |  | (pageNo和PageSize)必填 页码条数不能大于200条 |
| pageSize | number | N | params |  | (pageNo和PageSize)必填 页码条数不能大于200条 |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 1230774 | 接口日志记录（目前暂不支持） |
| data | object |  |  |  |
| total | number | page | 200 | 总条数 |
| pageNo | number | page | 1 | 查询页面 |
| pageSize | number | page | 20 | 查页码条数 |
| pageTotal | number | page | 100 | 总页数 |
| data | array |  |  |  |
| tradeNo | string | page.object[] | abc123 | 业务单号 |
| stockOutNo | string | page.object[] | abc123 | 出库单号 |
| warehouseId | string | page.object[] | goods001 | 仓库编码 |
| customerId | number | page.object[] | 100 | 客户编码 |
| remark | string | page.object[] | 出售给XX | 备注 |
| stockOutTime | number | page.object[] | 90 | 出库时间 |
| createTime | number | page.object[] | 2023:01:01 00:00:00 | 创建时间 |
| updateTime | number | page.object[] | 2023:01:01 00:00:00 | 更新时间 |
| stockOutStatus | string | page.object[] | 2025-01-01 | 出库状态0 未处理 50 已取消 80 处理中 85 待wms出库完成 90 待推送海关 10 待申报核放单 11 待核放入库成功 12 待核放审核通过 20 待出库 21 待过卡 51 取消中 100 已处理 |
| stockOutStatusCn | string | page.object[] |  | 出库状态（中文） |
| details | array | page.object[].details[] |  |  |
| barcode | string | page.object[].details[] | abc1234 | 条码 |
| stockOutNum | number | page.object[].details[] | 9 | 出库数量(正品数量+轻残数量) |
| num | number | page.object[].details[] | 10 | 正品数量 |
| defectNum | Integer | page.object[].details[] | 10 | 残次数量 |
| midDefectNum | Integer | page.object[].details[] | 10 | 轻残数量 |
| goodsNo | string | page.object[].details[] | bahd12 | 商品编码 |
| expireDate | string | page.object[].details[] | 2025-01-01 | 有效期 |
| productionDate | string | page.object[].details[] | 2024-01-01 | 批次号 |
