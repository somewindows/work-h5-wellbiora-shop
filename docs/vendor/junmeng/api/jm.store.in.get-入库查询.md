# 入库查询

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

可查询客户的入库单据。

请求方式: POST

Content-Type: application/json

Method:jm.store.in.get

请求参数说明

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.inventory.get | 方法名 |
| params | object | Y | body |  |  |
| tradeNo | string | N | params | test | 采购订单号 |
| stockInNo | string | N | params | kh01 | 入库单号 |
| warehouseId | string | N | params | abc123 | 仓库ID |
| customerId | string | N | params | abc123 | 商品实物条码 |
| startDate | date | N | params | xuskq202418921 | 单据开始日期 |
| endDate | date | N | params | 1 | 单据结束日期 |
| status | number | N | params | 20 | 单据状态：0:待处理 50:已取消 80:处理中 100:已处理 |
| pageNo | number | N | params |  | (pageNo和PageSize)必填 页码条数不能大于200条 |
| pageSize | number | N | params |  | (pageNo和PageSize)必填 页码条数不能大于200条 |
| businessType | number | N | params | 1 | 业务类型：1:采购入库 2:调拨入库 3:退货入库 4:其他入库 7:二线入库 8:奇门入库 |

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
| stockInNo | string | page.object[] | abc123 | 入库单号 |
| warehouseId | string | page.object[] | goods001 | 仓库编码 |
| customerId | number | page.object[] | 100 | 客户编码 |
| remark | string | page.object[] | 货主A转入 | 备注 |
| stockInTime | number | page.object[] | 90 | 入库时间 |
| createTime | number | page.object[] | 2023:01:01 00:00:00 | 创建时间 |
| updateTime | number | page.object[] | 2023:01:01 00:00:00 | 更新时间 |
| stockInStatus | string | page.object[] | 2025-01-01 | 入库状态0 待处理 50 已取消 80 处理中 100 已处理 |
| businessType | number | page.object[] | 1 | 业务类型1:采购入库 2:调拨入库 3:退货入库 4:其他入库 7:二线入库 8:奇门入库 |
| businessTypeCn | string | page.object[] | 采购入库 | 业务类型（中文） |
| stockInStatusCn | string | page.object[] |  | 入库状态（中文） |
| details | array | page.object[].detail[] |  |  |
| trueBarcode | string | page.object[].detail[] | abc1234 | 实物条码 |
| num | number | page.object[].detail[] | 11 | 正品数量 |
| stockInNum | number | page.object[].detail[] | 9 | 入库数量(正品数量+轻残数量) |
| defectNum | number | page.object[].detail[] | 1 | 残次数量 |
| midDefectNum | number | page.object[].detail[] | 1 | 轻残数量 |
| goodsNo | string | page.object[].detail[] | bahd12 | 商品编码 |
| batchNo | string | page.object[].detail[] | aba123 | 批次号 |
| expireDate | string | page.object[].detail[] | 2025-01-01 | 有效期 |
| productionDate | string | page.object[].detail[] | 2024-01-01 | 批次 |
