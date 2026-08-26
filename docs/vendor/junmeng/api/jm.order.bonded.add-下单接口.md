# 下单接口

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

订单创建。

请求方式: POST

Content-Type: application/json

Method:jm.order.bonded.add

请求参数

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.two.store.in.trade.get | 方法名 |
| params | object | Y | body |  |  |
| warehouseNo | string | Y | params | 20250101000000 | 仓库编码 |
| shopId | String | Y | params | AP123456 | 店铺唯一标识 |
| orderNo(弃用) | String | Y | params |  | 平台单号 |
| batchNo | String | Y | params |  | 平台单号 |
| orderDeclaNo | String | Y | params |  | 报关单号 |
| plaformCode | String | Y | params |  | 平台编码（下单平台在海关总署的编码） |
| plaformName | String | N | params |  | 平台名称 |
| disCount | Integer | N | params |  | 总优惠（单位：分） |
| frightFee | Integer | N | params |  | 总运费（单位：分） |
| orderCustoms | Object |  | params |  | 支付信息 |
| idcard | String | Y | params[orderCustoms] |  | 身份证号 |
| idcardName | String |  | params[orderCustoms] |  | 身份证姓名 |
| payId | String | Y | params[orderCustoms] |  | 支付平台 |
| payNo | String | Y | params[orderCustoms] |  | 支付单号 |
| orderAddress | objcect |  |  |  | 收获人信息 |
| consignee | String | Y | params[orderAddress] |  | 收货人 |
| consigneePhone | String | Y | params[orderAddress] |  | 收货人电话 |
| province | String | Y | params[orderAddress] |  | 省 |
| city | String | Y | params[orderAddress] |  | 市 |
| area | String | Y | params[orderAddress] |  | 区 |
| address | String | Y | params[orderAddress] |  | 地址 |
| goods | Array |  |  |  | 商品信息 |
| goods_no | String | Y | params[goods] |  | 商品在仓库的编码，请联系仓库商务 |
| number | Integer | Y | params[goods] |  | 商品数量 |
| total | Integer | Y | params[goods] |  | 订单中每个单品的含税含优惠总金额（税+商品金额）*商品数量（单位：分） |
| expire | String | N | params[goods] |  | 效期，不填写默认先进先出 |
| production | String | N | params[goods] |  | 批次，不填写默认先进先出 |
| goodsDefecive | String | N | params[goods] |  | 库存类型，ZP表示发正品、CP表示发残次、QC表示发轻残；默认正品 |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 1230774 | 接口日志记录（目前暂不支持） |
| data | array |  |  |  |
| orderNo | String | data[] |  | 系统单号 |
| batchNo | String | data[] |  | 平台单号 |
| thridNo | String | data[] |  | 报关单号 |
