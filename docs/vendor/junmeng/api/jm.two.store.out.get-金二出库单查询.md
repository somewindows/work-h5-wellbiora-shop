# 金二出库单查询

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

金二业务单据查询,如果出库单已创建，会有出库单数据，否则为空。

请求方式: POST

Content-Type: application/json

Method:jm.two.store.out.get

请求参数

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.two.store.out.get | 方法名 |
| params | object | Y | body |  |  |
| type | string | Y | params | 1 | 业务单据类型 一线入库:1 区间调入:2 区内调入:4 其他入库:5 |
| tradeNo | Array | Y | params | AP123456 | 业务单据号 |
| status | number | N | params | 100 | 100：已完成 |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 1230774 | 接口日志记录（目前暂不支持） |
| data | object |  |  |  |
| tradeNo | String | data |  | 业务单据号 |
| warehouseName | String | data |  | 仓库名称 |
| customerName | String | data |  | 客户名称 |
| BillLadeNo | String | data |  | 提运单号 |
| nuclearColumnList | String | data |  | 核柱清单号 |
| nuclearReleaseForm | String | data |  | 核放单号 |
| customsDeclaration | String | data |  | 报关单 |
| totalNumber | number | data |  | 理论数量 |
| remark | String | data |  | 备注 |
| systemRemark | String | data |  | 回执 |
| statusName | String | data |  | 单据状态 |
| createTime | String | data |  | 创建时间 |
| updateTime | String | data |  | 更新时间 |
| entryShowVo | array |  |  |  |
| tradeNo | String | data[entryShowVo] |  | 业务单单据号 |
| warehouseEntryNo | String | data[entryShowVo] |  | 出库单号 |
| totalNumber | number | data[entryShowVo] |  | 理货数量 |
| statusName | String | data[entryShowVo] |  | 状态 |
| createTime | String | data[entryShowVo] |  | 创建时间 |
| updateTime | String | data[entryShowVo] |  | 更新时间 |
| finishTime | String | data[entryShowVo] |  | 出库时间 |
| entryShowGoodsVos | array | data[entryShowVo.entryShowGoodsVos] |  | 出库单商品数据 |
| inboundOrderGoodsNumber | String | data[entryShowVo.entryShowGoodsVos] |  | 出库子单号 |
| importantNumber | number | data[entryShowVo.entryShowGoodsVos] |  | 重要序号 |
| goodsName | String | data[entryShowVo.entryShowGoodsVos] |  | 商品名称 |
| goodsNo | String | data[entryShowVo.entryShowGoodsVos] |  | 商品编码 |
| partNo | String | data[entryShowVo.entryShowGoodsVos] |  | 料号 |
| barcode | String | data[entryShowVo.entryShowGoodsVos] |  | 条码 |
| expire | String | data[entryShowVo.entryShowGoodsVos] |  | 效期 |
| production | String | data[entryShowVo.entryShowGoodsVos] |  | 批次 |
| zpNumber | number | data[entryShowVo.entryShowGoodsVos] |  | 正品数量 |
| ccNumber | number | data[entryShowVo.entryShowGoodsVos] |  | 残次数量 |
| cpNumber | number | data[entryShowVo.entryShowGoodsVos] |  | 轻残数量 |
| tallyingMethod | String | data[entryShowVo.entryShowGoodsVos] |  | 理货方式 |
