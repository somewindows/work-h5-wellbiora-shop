# 订单查询接口

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

订单查询。

请求方式: POST

Content-Type: application/json

Method:jm.order.bonded.get

请求参数

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.order.bonded.get | 方法名 |
| params | object | Y | body |  |  |
| warehouseNo | string | N | params | 20250101000000 | 仓库编码 |
| shopId | String | N | params | AP123456 | 店铺唯一标识 |
| orderNo(弃用) | String | N | params |  | 平台单号(弃用) |
| batchNo | String | N | params |  | 平台单号 |
| declaNo | String | N | params |  | 报关单号 |
| expressNo | String | N | params |  | 物流单号 |
| status | Integer | N | params | 100 | 0:待审核 3:待支付 10:处理中 15:清关中 20:清关完成 30:已下发仓库 35:已打单 40:订单出库 50:订单取消 70:揽收 80:待撤单 81:已撤单 90:待退货入区 91:已退货入区 100:签收 |
| createTimeStart | String | N | params | 2025-09-01 00:00:00 | 创建时间开始 |
| createTimeEnd | String | N | params | 2025-09-01 02:00:00 | 创建时间结束 |
| updateTimeStart | String | N | params | 2025-09-01 00:00:00 | 更新时间开始 |
| updateTimeEnd | String | N | params | 2025-09-01 02:00:00 | 更新时间结束 |
| sendTimeStart | String | N | params | 2025-09-01 00:00:00 | 出库时间开始 |
| sendTimeEnd | String | N | params | 2025-09-01 02:00:00 | 出库时间结束 |
| pageNo | Number | Y | params | 1 | 页码 页码不能下小于1 |
| pageSize | Number | Y | params | 10 | 分页大小 每页最大条数200条 |

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
| orderNo | string | page.data[] | 1 | 平台单号 |
| thridNo | string | page.data[] | 1 | 报关单号 |
| systemNo | string | page.data[] | 1 | 系统单号 |
| invtNo | string | page.data[] | 1 | 清单号 |
| orderInfoStatus | string | page.data[] | 1 | 订单状态 |
| orderInfoStatusDesc | string | page.data[] | 1 | 订单状态描述 |
| expressId | string | page.data[] | 1 | 快递编码 |
| expressName | string | page.data[] |  | 物流名称 |
| expressNo | string | page.data[] |  | 物流单号 |
| warehouseName | string | page.data[] |  | 仓库名称 |
| shopNo | string | page.data[] |  | 店铺编号 |
| shopName | string | page.data[] |  | 店铺名称 |
| thirdShopNo | string | page.data[] |  | 三点店铺编号 |
| thirdShopName | string | page.data[] |  | 三方店铺名称 |
| accountTime | string | page.data[] |  | 清关完成时间 |
| warehouseTime | string | page.data[] |  | 下发仓库时间 |
| sendTime | string | page.data[] |  | 出库时间 |
| cancelTime | string | page.data[] |  | 取消时间 |
| systemRemark | string | page.data[] |  | 拦截信息 |
| orderWeight | number | page.data[] |  | 订单重量 |
| cartonNo | string | page.data[] |  | 纸箱编号 |
| intercept | number | page.data[] |  | 锁单状态（非0代表锁单） |
| consignee | string | page.data[] |  | 收货人（密文） |
| collectingTime | string | page.data[] |  | 揽收时间 |
| finishTime | string | page.data[] |  | 完成时间 |
| discount | number | page.data[] |  | 优惠金额 |
| totalPrice | number | page.data[] |  | 订单总金额 |
| addedPrice | number | page.data[] |  | 增值税 |
| consumptionPrice | number | page.data[] |  | 消费税 |
| orderGoods | array | page.data[] | 1 | 订单商品信息 |
| barcode | string | data[orderGoods[]] | 1 | 条码 |
| partNo | string | data[orderGoods[]] | 1 | 料号 |
| goodsNo | string | data[orderGoods[]] | 1 | 商品编码 |
| goodsName | string | data[orderGoods[]] | 1 | 商品名称 |
| expire | string | data[orderGoods[]] | 1 | 效期 |
| production | string | data[orderGoods[]] | 1 | 批次 |
| number | number | data[orderGoods[]] | 1 | 数量 |
| tax | number | data[orderGoods[]] | 1 | 税价（分） |
| goodsPrice | number | data[orderGoods[]] | 1 | 商品未税价（分） |
