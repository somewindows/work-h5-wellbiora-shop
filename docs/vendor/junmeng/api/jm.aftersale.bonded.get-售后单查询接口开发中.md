# 售后单查询接口(开发中)

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

售后单查询。

请求方式: POST

Content-Type: application/json

Method:jm.aftersale.bonded.get

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
| orderNo | String | N | params |  | 君梦系统单号 |
| batchNo | String | N | params |  | 平台单号 |
| declaNo | String | N | params |  | 报关单号 |
| expressNo | String | N | params |  | 物流单号 |
| afterSaleNo | String | N | params |  | 售后单号 |
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
