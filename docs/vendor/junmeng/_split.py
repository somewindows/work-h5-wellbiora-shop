# -*- coding: utf-8 -*-
"""一次性脚本：把 _full.md 按接口拆分为独立文件。运行后可删除。"""
import os
import re

SRC = "docs/vendor/junmeng/_full.md"
BASE = "docs/vendor/junmeng"

with open(SRC, encoding="utf-8") as f:
    text = f.read()

# 去掉开头目录（第一个真正的标题「# 更新记录」之前的 TOC 噪音）
text = text[text.index("# 更新记录"):]

# 一级切分点（「## 接口」需整行匹配，避免命中「## 接口规范」）
m_api = re.search(r"(?m)^## 接口$", text).start()
m_sign = text.index("## 加签代码示例")
m_platform = text.index("# 电商平台")
m_pay = text.index("# 支付公司列表")
m_logi = text.index("# 物流编码")

common = text[:m_api].strip()
sign_example = text[m_sign:m_platform].strip()
api_block = text[m_api:m_sign]
platform = text[m_platform:m_pay].strip()
pay = text[m_pay:m_logi].strip()
logistics = text[m_logi:].strip()

os.makedirs(f"{BASE}/api", exist_ok=True)
os.makedirs(f"{BASE}/reference", exist_ok=True)

# 拆分各接口
sections = re.split(r"(?m)^### ", api_block)[1:]
index_rows = []
for sec in sections:
    name_end = sec.index("\n")
    title = sec[:name_end].strip()
    body = sec[name_end:].strip()
    m = re.search(r"Method[:：]\s*(\S+)", body)
    method = m.group(1) if m else ""
    safe = re.sub(r'[\\/:*?"<>|（）()]', "", title).replace(" ", "")
    fname = f"{method}-{safe}.md" if method.startswith("jm.") else f"{safe}.md"
    with open(f"{BASE}/api/{fname}", "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n> 来源：君梦 openApi2.0 文档（docs/vendor/junmeng/君梦openApi2.0文档.docx）\n\n{body}\n")
    index_rows.append((title, method, f"api/{fname}"))
    print("api:", fname)

# 接入指南 = 公共部分 + 加签示例，补上图片引用
common = common.replace(
    "# 公共参数\n",
    "# 公共参数\n\n![获取 appId/appSecret](images/image1.png)\n\n![开放平台查看正式参数](images/image2.png)\n",
    1,
)
common = common.replace(
    "# 推单参数（shopId/warehouseNo）\n",
    "# 推单参数（shopId/warehouseNo）\n\n![店铺列表获取推单参数](images/image3.png)\n\n![添加店铺查看 warehouseNo/shopId](images/image4.png)\n",
    1,
)
# 加签示例是 Java 代码，包上代码块便于阅读
sign_example = sign_example.replace(
    "## 加签代码示例\n\n", "## 加签代码示例\n\n```java\n", 1
) + "\n```"
guide = common + "\n\n" + sign_example + "\n"
with open(f"{BASE}/00-接入指南.md", "w", encoding="utf-8") as f:
    f.write(guide)
print("guide: 00-接入指南.md")

for name, content in (("电商平台", platform), ("支付公司列表", pay), ("物流编码", logistics)):
    with open(f"{BASE}/reference/{name}.md", "w", encoding="utf-8") as f:
        f.write(content + "\n")
    print("reference:", name)

# 生成 README 索引
lines = [
    "# 君梦 OMS OpenAPI 2.0 — 开发索引",
    "",
    "> 由 `君梦openApi2.0文档.docx` 拆分生成（2026-08-26），供日常开发直接查阅，避免每次解析 docx。",
    "> docx 原文档保留在本目录；若官方更新文档，重跑 `_extract_docx.py` + `_split.py` 重新生成本目录。",
    "",
    "## 阅读顺序",
    "",
    "1. [00-接入指南.md](00-接入指南.md)：环境地址、公共参数、签名规则（含示例代码）、推单参数 shopId/warehouseNo 获取位置截图。",
    "2. 按下表找到对应接口文件，含完整请求/返回字段表。",
    "3. 枚举值查 `reference/`：电商平台备案编码、支付公司海关备案号、物流编码。",
    "",
    "## 速查",
    "",
    "- 请求方式：一律 `POST application/json`",
    "- 测试环境：`https://api.jmcompany.cn/test/test/api/openapi_v2/main`",
    "- 生产环境：`https://api.jmcompany.cn/#server/#mechanism/api/openapi_v2/main`（占位符到君梦客户端开放平台获取）",
    "- 签名：去除 sign/params 后按 key 排序拼 `k=v&`，末尾追加 appSecret，MD5 后转大写；timestamp 5 分钟内有效",
    "- 通用返回：`code`（0 成功）/ `msg` / `time` / `logId` / `data`",
    "",
    "## 接口清单",
    "",
    "| 接口 | Method | 文件 |",
    "|---|---|---|",
]
for title, method, path in index_rows:
    lines.append(f"| {title} | `{method}` | [{path}]({path}) |")
lines += [
    "",
    "## 本项目对接提示（H5-shop）",
    "",
    "- 商城主链路用到的接口：`jm.goods.get`（商品同步）、`jm.inventory.get`（库存）、`jm.order.bonded.add`（下单）、`jm.order.bonded.get`（订单查询）、`jm.order.bonded.cancel`（取消）。",
    "- 金二（金关二期）出入库接口为保税仓内部账册管理，H5 商城一般不直接调用。",
    "- 发货接口文档标注「需要平台提供发货地址」，即物流回传地址由我方提供 —— 待与君梦确认。",
    "- 电商平台备案编码见 `reference/电商平台.md`，我方 H5 自建商城用哪个编码待确认（文档示例用的是有赞 `3301961SWG`）。",
    "- 支付走微信：支付公司海关备案号 `4403169D3W`（财付通），见 `reference/支付公司列表.md`。",
    "- 文档内 appId/appSecret 为官方示例参数，正式参数须从君梦客户端「账号 → 君梦API接口对接」获取（见接入指南截图）。",
    "",
]
with open(f"{BASE}/README.md", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("README done")
