# 商品档案查询

> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）

API描述

可查询客户的商品档案。

请求方式: POST

Content-Type: application/json

Method: jm.goods.get

请求参数说明

| 变量名称 | 变量类型 | 是否必填（Y/N） | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|---|
| appId | string | Y | body | mXyuigG3 | AppId |
| sign | string | Y | body | 0d66d544c78c18134fdc4d4a6fe94ea0 | 签名值 |
| timestamp | string | Y | body | 1732505563913 | 时间戳，允许5分钟内的请求 |
| method | string | Y | body | jm.goods.get | 方法名 |
| params | object | Y | body |  |  |
| warehouseId | string | N | params | test | 仓库编码 |
| customerId | string | N | params | kh01 | 客户编码 |
| barcode | string | N | params | abc123 | 商品理论条码 |
| trueBarcode | string | N | params | abc123 | 商品实物条码 |
| goodsNo | string | N | params | xuskq202418921 | 商品编码 |
| pageNo | number | N | params | 1 | barcode或trueBarcode或（pageNo和PageSize）必填一项 |
| pageSize | number | N | params | 20 | barcode或trueBarcode(pageNo和PageSize)必填一项 或页码条数不能大于200条 |
| updateTimeStart | date | N | params |  | 此时间修改之后的商品格式：yyyy-MM-dd HH:mm:ss（目前暂不支持） |
| updateEndTime | date | N | params |  | 此时间修改之前的商品格式：yyyy-MM-dd HH:mm:ss（目前暂不支持） |

返回参数说明

| 变量名称 | 变量类型 | 参数位置 | 示例值 | 描述 |
|---|---|---|---|---|
| code | number | root | 0 | 代码 0 成功 其它为失败 |
| msg | string | root | Success | 处理信息 |
| time | number | root | 200 | 接口耗时（单位：ms） |
| logId | number | root | 17829869135 | 接口日志记录（目前暂不支持） |
| data | object |  |  |  |
| total | number | page | 200 | 总条数 |
| pageNo | number | page | 1 | 查询页面 |
| pageSize | number | page | 20 | 查页码条数 |
| pageTotal | number | page | 100 | 总页数 |
| data | array |  |  |  |
| barcode | string | page.object[] | abc123 | 理论条码 |
| trueBarcode | string | page.object[] | abc123 | 实物条码 |
| goodsNo | string | page.object[] | atm202401 | 商品编码 |
| goodsName | string | page.object[] | 爱他美奶粉 | 商品名称 |
| createTime | string | page.object[] | 2024-01-01 00:00:00 | 创建时间 |
| updateTime | string | page.object[] | 2024-01-01 00:00:00 | 修改时间 |
| partNo | string | page.object[] | abc123 | 料号 |
| hsCode | string | page.object[] | 40000190 | HS编码 |
| bookType | number | page.object[] | 0 | 账册类型 0, "独立账册" 1 子账册 2 组合账册 3 赠品 |
| bookTypeCn | string | page.object[] | 独立账册 | 账册类型（中文） |
| goodsBrand | string | page.object[] | 爱他美 | 商品品牌 |
| goodsType | number | page.object[] | 1 | 值 = 1:效期下单 2:批次下单 |
| goodsTypeCn | string | page.object[] | 效期下单 | 商品类型 （中文） |
| importNumber | number | page.object[] | 102 | 重要序号 |
| goodsCategory | string | page.object[] | 母婴 | 商品类别 |
| bornCountry | string | page.object[] | 日本 | 原产国 |
| bornCountryCode | string | page.object[] | 日本 | 原产国代号 |
| customsUnit | string | page.object[] | 罐 | 海关申报单位 |
| customsUnitCode | string | page.object[] | 0000 | 海关申报单位编码 |
| customsUnitCodeNumber | BigDecimal | page.object[] | 1 | 海关申报数量 |
| firstComputeUnit | string | page.object[] | 罐 | 第一计量单位 |
| firstComputeUnitCode | string | page.object[] | 0000 | 第一计量单位编码 |
| firstComputeUnitCodeNumber | BigDecimal | page.object[] | 1 | 第一计量数量 |
| secondComputeUnit | string | page.object[] | 克 | 第二计量单位 |
| secondComputeUnitCode | string | page.object[] | 1000 | 第二一计量单位编码 |
| secondComputeUnitCodeNumber | BigDecimal | page.object[] | 1 | 第二计量数量 |
| weight | BigDecimal | page.object[] | 2 | 净重 |
| grossWeight | BigDecimal | page.object[] | 2.2 | 毛重 |
