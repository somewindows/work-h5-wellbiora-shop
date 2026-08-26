# 订单取消接口

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

针对未申报清单的订单可直接取消，如果已申报清单的须联系仓库，线下取消。

请求方式: POST

Content-Type: application/json

Method:jm.order.bonded.cancel

请求参数

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.order.bonded.cancel | 方法名 |
| params | object | Y | body |  |  |
| orderNo(弃用) | String | Y | params |  | 平台单号(弃用) |
| batchNo | String | Y | params |  | 平台单号 |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 1230774 | 接口日志记录（目前暂不支持） |
| data | object |  |  |  |
