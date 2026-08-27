# 内容块（Content Blocks）设计定稿

> 阶段 B 技术设计文档。本文是 AGENTS.md 硬性规则第 7 条的落地：
> **商品详情页和首页一律采用「内容块/模块数组 + 前端渲染器」架构，禁止富文本堆砌。**
> 目的：让运营后期改产品详情、调首页，只动后台数据，不改前端代码、不发版。
> 数据形态已在原型中验证：`prototype/app/data.js`、`data-v2.js`。

## 一、核心模型

一个页面（商品详情 / 首页）= 一个**有序的内容块数组**，每个块有 `type` + 该类型自己的字段：

```jsonc
{
  "pageId": "product:p1",
  "blocks": [
    { "type": "gallery", "images": ["..."] },
    { "type": "info_rows", "rows": [{ "k": "产品规格", "v": "5ml × 30袋 / 盒" }] }
  ]
}
```

- 前端渲染器 = `type → 渲染组件` 的映射表，按数组顺序逐个渲染。
- **未知 type 的块：渲染器跳过并打警告日志，绝不让整个页面白屏**（前后台版本不同步时的兜底）。
- 块只有「纵向堆叠」一种布局，不做嵌套、不做自由拖拽定位——保持简单，移动端不出错。

## 二、块类型定稿（v1）

### 2.1 商品详情页块（原型已验证）

| type | 用途 | 字段 | 原型出处 |
|---|---|---|---|
| `gallery` | 顶部图廊（轮播） | `images: string[]` | data.js |
| `image` | 全宽素材图（详情长图） | `src, alt?` | data.js |
| `badges` | 特点徽章墙 | `title, items: string[]` | data.js |
| `nutrition` | 营养成分表（结构化表格） | `title, meta, head: string[], rows: string[][], note` | data.js |
| `nutrition_image` | 营养表图片版（无结构化数据时用） | `src, alt?` | data.js |
| `stats` | 数据网格（4 宫格数字卖点） | `items: [{n, unit, l, d}]`，带 `*` 宣称时脚注 `note` 必填；页级使用可选 `title?/en?` 模块标题 | data-v2.js |
| `scenario` | 适用场景清单 | `title, items: string[]` | data-v2.js |
| `text` | 纯文字段落（新增，备用） | `title?, body`（支持 `\n` 分段） | — |

> ~~`info_rows`（产品档案）已不在块列表中~~：**2026-08-27 起升级为商品基础字段**，见第 2.3 节。原型 data-v2.js 里的 `info_rows` 是其数据原型。

### 2.2 首页 / 列表页块

| type | 用途 | 字段 |
|---|---|---|
| `hero` | 首页顶部品牌区（大标题+副文+背景图） | `badge?, kick, title, sub?, tags?, image?, link?` |
| `notice_bar` | 公告/活动条 | `text` |
| `product_rail` | 产品速览横滑票卡 | `title, en, productIds: string[]`（引用商品，不内嵌数据） |
| `product_grid` | 产品卡片区（两列网格） | `title?, en?, productIds: string[]`（引用商品，不内嵌数据） |
| `image_banner` | 单图横幅（可带跳转） | `src, link?, alt?` |
| `stats` | 数据网格（复用 2.1 定义） | 同 2.1 |
| `cert_wall` | 认证/品质承诺图标墙 | `items: [{ icon, label }]`，可选 `title?/en?` 模块标题（icon 为前端内置 SVG 图标 key，未知 key 回退默认图标） |
| `brand_block` | 品牌专区（深绿底反白） | `kick, title, desc, image?` |
| `text` | 同 2.1，品牌故事等段落复用 | 同上 |

> 2026-08-27 补充：`notice_bar / product_rail / cert_wall / brand_block` 为实现 V3 原型首页（index-v2.html）登记的新类型，已随 T7 前端落地渲染组件。页脚（WELLBIORA™ + 合规小字）为页面固定元素，不进 blocks。

> 首页不需要的块先不实现（如视频、倒计时、优惠券）。**新增 type 的流程：先在本文档登记 type 定义 → 写前端渲染组件 → 后台才能配置。** 顺序反过来必返工。

### 2.3 产品档案：商品基础字段，不是内容块（2026-08-27 定）

「PRODUCT INFO / 产品档案」模块格式固定、每款产品都有，且字段（规格/成分/产地/食用方法）属于**产品本身的属性**，后期可能复用到订单、申报、清单等场景。因此升级为商品表的结构化字段，前端固定渲染，**不出现在块编辑器里，运营不可删、不可调序**：

| 字段 | 必填 | 示例 |
|---|---|---|
| `spec` 产品规格 | 是 | 5ml × 30袋 / 盒 |
| `flavor` 风味 | 否（喷雾类等可空） | 香橙味 |
| `ingredients` 核心成分 | 是 | 谷胱甘肽、大豆卵磷脂 |
| `originCert` 产地与认证 | 是 | 欧洲制造 · GMP 生产规范 |
| `usage` 食用方法 | 否 | 每日 1 袋，直接饮用或加入饮品 |

- 后台更新路径：商品管理 → 基础信息表单 → 保存即生效（记操作日志），**不走草稿/发布流程**。
- 与内容块的分工判断标准：**格式固定 + 产品固有属性 → 基础字段（路径 A）；营销表达 + 版式灵活 → 内容块（路径 B）**。

## 三、固定注入、不进数据的块

- **合规声明折叠面板**：由前端在每个商品详情页末尾固定渲染，文案存在服务端配置表（`compliance_text`，现文案见 `prototype/app/data.js` 末尾 `COMPLIANCE_TEXT`）。**不进入 blocks 数组，运营不可删、不可改顺序**，只能由管理员改文案。
- 带 `*` 的数据宣称（如 stats 里的「4x 吸收提升*」）：脚注跟块走，写在块自己的字段里（如 `stats.items[].d` 或 `note`），后台编辑该块时强制提示填写来源。

## 四、后台编辑与存储

- 存储：MySQL 里 `blocks` 字段存 **JSON 数组**（MySQL 8 JSON 类型），不做块级拆表——块没有跨页面复用需求，JSON 足够，查询就是整页读出。
- 后台编辑器（MVP）：块列表 = 可排序的卡片列表，每块按 type 出对应表单（图片块给素材库选择器，营养表给表格编辑器），支持增/删/上下移/禁用（`hidden: true`，比删除安全）。**不做**可视化拖拽预览版，先看 JSON 预览够用。
- 发布机制：草稿（`draft_blocks`）+ 线上（`blocks`）两份，「发布」时整体覆盖并记版本号，可回滚到上一版。防呆：发布前服务端校验所有 type 合法、必填字段齐全、图片 URL 存在。
- 图片统一走**素材库**（对象存储 + CDN），块里只存 URL，不存 base64。

## 五、前端渲染约定

- 渲染器组件放 `frontend/src/components/blocks/`，一块一组件，`BlockRenderer.vue` 做 type 分发。
- 样式必须遵循 `docs/H5商城设计规范_WELLBIORA_v0.2.md`（内容 v0.3），块组件不写死色值，用 CSS 变量。
- 商品主题色（`theme/themeLight`，见 data.js）属于**商品基础信息**，不是内容块，详情页骨架用它做点缀色。
- 缓存：详情页数据可 CDN/Redis 缓存，以后台「发布」动作主动失效，不设短 TTL 轮询。
