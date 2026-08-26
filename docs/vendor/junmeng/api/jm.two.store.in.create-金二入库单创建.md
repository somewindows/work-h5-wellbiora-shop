# 金二入库单创建

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

创建金二入库单。

请求方式: POST

Content-Type: application/json

Method:jm.two.store.in.create

请求参数说明

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.two.store.in.create | 方法名 |
| params | object | Y | body |  |  |
| type | string | Y | params | 1 | 业务单据类型 一线入库:1 区间调入:2 区内调入:4 其他入库:5 |
| warehouseNo | String | Y | params | test | 仓库编码 |
| billLadeNo | String | N | params |  | （一线入库必填） |
| departureCountry | String | N | params |  | 启运国 （一线入库必填） |
| departureCountryCode | String | N | params |  | 启运国代码（一线入库必填） |
| destinationCountry | String | N | params |  | 目的国（一线入库必填） |
| destinationCountryCode | String | N | params |  | 目的国代码（一线入库必填） |
| departurePort | String | N | params |  | 启运港（一线入库必填） |
| destinationPort | String | N | params |  | 目的港（一线入库必填） |
| arrivPortType | String | N | params |  | 到港方式（一线入库必填） |
| arrivePort | String | N | params |  | 抵达港口（一线入库必填） |
| expectArrivePortTime | String | N | params |  | 预计到港时间（一线入库必填） |
| productNumber | Number | Y | params |  | 件数/箱数/托数（其他入库非必填） |
| productType | String | Y | params |  | 件数/箱数/托数（其他入库非必填） |
| trayMaterial | String | Y | params |  | 托盘材质（其他入库非必填） |
| grossWeight | Double | Y | params |  | 毛重，单位千克（其他入库非必填） |
| outWarehouseName | String | N |  |  | 转出仓名称（区间入库和区内入库必填） |
| outWarehouseCustomsNo | String | N |  |  | 转出仓10位编码（区间入库和区内入库必填） |
| outWarehouseBookNo | String | N |  |  | 转出仓账册号（区间入库和区内入库必填） |
| outWarehousePortNo | String | N |  |  | 转出仓关区代码（区间入库和区内入库必填） |
| outWarehouseEngName | String | N |  |  | 转出仓英文名称（区间入库和区内入库必填） |
| outWarehouseCreditCode | String | N |  |  | 转出仓经营单位社会信用代码（区间入库和区内入库必填） |
| outWarehouseAddress | String | N |  |  | 转出仓地址（区间入库和区内入库必填） |
| outWarehouseContact | String | N |  |  | 转出仓联系人（区间入库和区内入库必填） |
| outWarehouseContact | String | N |  |  | 转出仓联系人（区间入库和区内入库必填） |
| outWarehouseContactMobile | String | N |  |  | 转出仓电话（区间入库和区内入库必填） |
| outWarehouseCustomsContact | String | N |  |  | 转出仓报关联系人（区间入库和区内入库必填） |
| outWarehouseCustomsContactMobile | String | N |  |  | 转出仓报关联系电话（区间入库和区内入库必填） |
| remark | String | Y | params |  | 备注 |
| file | String | Y | params |  | 凭证文件url |
| addFrontStorageGoodsBOList | array | Y |  |  | 商品信息 |
| goodsId | Number | Y | params[array[]] |  | 商品库存id |
| goodsNo | String | N | params[array[]] |  | 商品编码 |
| importantId | Number | N | params[array[]] |  | 重要序号 |
| barcode | String | N | params[array[]] |  | 条码 |
| currency | String | Y | params[array[]] |  | 币制 |
| totalPrice | Double | N | params[array[]] |  | 金额 |
| unitPrice | Double | Y | params[array[]] |  | 成本单价 |
| planQty | Number | Y | params[array[]] |  | 理论数量 |
| handlingType | Number | Y | params[array[]] |  | 理货方式 按箱、按拖、按件理论数量 |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 1230774 | 接口日志记录（目前暂不支持） |
| data | object |  |  |  |
| tradeNo | String | data |  | 业务单据号 |
