# 金二出库单创建

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

创建金二出库单。

请求方式: POST

Content-Type: application/json

Method:jm.two.store.out.create

请求参数说明

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.two.store.out.create | 方法名 |
| params | object | Y | body |  |  |
| type | string | Y | params | 1 | 业务单据类型 区间调出:1 区内调出:2 其他调出:3 |
| warehouseNo | String | Y | params | test | 仓库编码 |
| inWarehouseName | String | Y | params |  | 转入仓名称（区间出库或区内调出必填） |
| inWarehouseCustomsNo | String | Y | params |  | 转入仓10位编码（区间出库或区内调出必填） |
| inWarehouseBookNo | String | Y | params |  | 转入仓账册号（区间出库或区内调出必填） |
| inWarehousePortNo | String | Y | params |  | 转入仓关区代码（区间出库或区内调出必填） |
| inWarehouseEngName | String | Y | params |  | 转入仓英文名称（区间出库或区内调出必填） |
| inWarehouseCreditCode | String | Y | params |  | 转入仓经营单位社会信用代码（区间出库或区内调出必填） |
| inWarehouseAddress | String | Y | params |  | 转入仓地址（区间出库或区内调出必填） |
| inWarehouseContact | String | Y | params |  | 转入仓联系人（区间出库或区内调出必填） |
| inWarehouseContactMobile | String | Y | params |  | 转入仓电话（区间出库或区内调出必填） |
| inWarehouseCustomsContact | String | Y | params |  | 转入仓报关联系人（区间出库或区内调出必填） |
| inWarehouseCustomsContactMobile | Number | Y | params |  | 转入仓报关联系电话（区间出库或区内调出必填） |
| transfer | String | Y | params |  | 物流转入方（区间出库或区内调出必填） |
| arriveTime | String | Y | params |  | 到货时间（区间出库或区内调出必填） |
| grossWeight | Double | N | params |  | 毛重，单位千克 |
| productNumber | String | N |  |  | 件数/箱数/托数 |
| productType | String | N |  |  | 件数/箱数/托数 |
| trayMaterial | String | N |  |  | 托盘材质 |
| remark | String | N | params |  | 备注 |
| file | String | N | params |  | 凭证文件url |
| addSecondStorageGoodsBOS | array | Y |  |  | 商品信息 |
| goodsId | Number | Y | params[array[]] |  | 商品库存id |
| goodsNo | String | Y | params[array[]] |  | 商品编码 |
| expire | String | Y | params[array[]] |  | 效期 |
| barcode | String | Y | params[array[]] |  | 条码 |
| production | String | Y | params[array[]] |  | 批次 |
| goodsRemainBondedRemainId | Number | Y | params[array[]] |  | 效期批次库存id |
| currency | String | Y | params[array[]] |  | 币值 |
| unitPrice | Number | Y | params[array[]] |  | 单价 |
| zpNumber | Number | Y | params[array[]] |  | 正品数量（数量之和必须大于0） |
| ccNumber | Number | Y | params[array[]] |  | 残次数量（数量之和必须大于0） |
| cpNumber | Number | Y | params[array[]] |  | 轻残数量（数量之和必须大于0） |
| tallyingMethod | Number | N | params[array[]] |  | 理货方式（按件理货：1按箱理货： 2按托理货：3其它：4） |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 1230774 | 接口日志记录（目前暂不支持） |
| data | object |  |  |  |
| tradeNo | String | data |  | 业务单据号 |
