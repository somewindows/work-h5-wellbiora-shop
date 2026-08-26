# 库存档案查询

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

可查询客户的库存详情。

请求方式: POST

Content-Type: application/json

Method:jm.inventory.get

请求参数说明

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.inventory.get | 方法名 |
| params | object | Y | body |  |  |
| warehouseNo | string | N | params | test | 仓库编码 |
| barcode | string | N | params | abc123 | 商品理论条码 |
| trueBarcode | string | N | params | abc123 | 商品实物条码 |
| goodsNo | string | N | params | xuskq202418921 | 商品编码 |
| partNo | string | N | params | 202418921 | 料号 |
| pageNo | number | N | params | 1 | barcode或trueBarcode或（pageNo和PageSize）必填一项 |
| pageSize | number | N | params | 20 | barcode或trueBarcode或(pageNo和PageSize)必填一项 或页码条数不能大于200条 |
| updateTimeStart | date | N | params |  | 此时间修改之后的商品格式：yyyy-MM-dd HH:mm:ss（目前暂不支持） |
| updateEndTime | date | N | params |  | 此时间修改之前的商品格式：yyyy-MM-dd HH:mm:ss（目前暂不支持） |

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
| barcode | string | page.object[] | abc123 | 实物条码 |
| trueBarcode | string | page.object[] | abc123 | 理论条码 |
| goodsNo | string | page.object[] | goods001 | 商品编码 |
| stockDetail | object |  |  | 库存详细信息 |
| OccupyNum | number | page.object[].stockDetail | 90 | 正品占用数 |
| defectOccupyNum | number | page.object[].stockDetail | 0 | 残品占用数量 |
| middleDefectOccupyNum | number | page.object[].stockDetail | 0 | 轻残品占用数量 |
| AvailableNum | number | page.object[].stockDetail | 5 | 正品可用数量 |
| defectAvailableNum | number | page.object[].stockDetail | 0 | 残品可用数量 |
| middleDefectAvailableNum | number | page.object[].stockDetail | 1 | 轻残品可用数量 |
| stockNum | number | page.object[] | 100 | 库存总数量(正品库存数+轻残库存数+残次库存数) |
| occupyNum | number | page.object[] | 90 | 占用数量(正品占用数量+轻残占用数量+残次占用数量) |
| availableNum | number | page.object[] | 10 | 可用数量(正品可用库存数量+轻残可用库存数量) |
| defectNum | number | page.object[] | 5 | 残品数量(残可用数量+残次占用数量) |
| expireDate | string | page.object[] | 2025-01-01 | 有效期 |
| updateTime | string | page.object[] | 2023:01:01 00:00:00 | 修改时间 |
