# H5 跨境电商商城（WELLBIORA 海外旗舰店）— AGENTS.md

> 本文件供 AI 编码助手在每次会话中读取，作为项目长期上下文。
> 修改业务规则、目录结构或设计规范时，请同步更新本文件。
> 本文内容由 `AGENTS1.md`（早期版本）迁移并核对当前实际文件后更新。

## 一、项目背景

- 跨境电商 **H5 商城**：移动端网页（**不是**微信小程序），销售海外保健品。
- 品牌：**WELLBIORA™**，主打「脂质体包裹技术」，欧洲制造。
- 清关模式：**1210 保税备货**（义乌保税仓，未来可能扩展成都保税仓）。
- 后端对接：**君梦 OMS OpenAPI 2.0**，JSON + MD5 签名（参数按 key 排序拼接 + appSecret 后转大写）。
- 支付：**微信支付**（含海关报关接口）。
- 在售商品 4 款（p1 谷胱甘肽饮 / p2 维C饮 / p3 睡眠喷雾 / p4 D3+K2+Q10饮），目前价格均为示例占位价。

## 二、当前仓库状态（重要）

- **前端工程已建立（2026-08-27，T7）**：`frontend/`（Vue 3 + Vite + TS + Vant 4 + Tailwind 3 + Pinia + hash 路由），MVP 9 页已按 V3 原型 1:1 实现，走 mock 数据。T9 的登录路由守卫和详情图库 `themeLight` 底色透传已于 2026-08-30 完成并补充 Vitest 回归测试，剩余视觉走查。启动：`cd frontend && npm install && npm run dev`（mock 开关在 `.env.development` 的 `VITE_USE_MOCK=1`）。
- **后端本地联调闭环已建立（2026-08-30，T8）**：`server/`（NestJS + TypeScript + TypeORM + MySQL 8），已实现统一 `/api/v1` 响应层、认证（开发短信验证码/JWT/`GET /users/me`）、首页商品、购物车、地址实名和订单预检/创建/查询/取消；验证码与限频存 MySQL，不使用 Redis。身份证号 AES-256-GCM 密文保存、HMAC 指纹用于年度额度查询；已实名用户编辑地址时仅回显脱敏号码、可留空保留原密文，局部地址更新会保留未提交字段与默认标记。支付和仓库均为仅本地的 mock 适配器，真实微信/君梦待接入。`LOCAL_TEST_MODE=1` 时全模块转为内存仓储并保留开发验证码日志，供无 Docker 的浏览器测试（重启清空数据）；该模式已与前端 `VITE_USE_MOCK=0` 代理实际启动验证，并实际跑通登录、加购、地址实名、地址修改、下单及取消订单的 API 冒烟。服务端单元 30/30、e2e 9/9、lint 和生产构建已验证通过。`admin/` 桌面端尚未创建；后台管理服务端（管理员登录+限频、商品目录持久化、内容块草稿/发布/回滚、审计日志，下单链路已接通 catalog）在分支 `feat/admin-init` 推进中，进展见 `docs/tasks/TODO.md` T8。
- **已是 Git 仓库**（2026-08-25 初始化，默认分支 `main`），有 `.gitignore`（忽略 node_modules/dist/日志/.env 等）。
- 仓库内容：设计/需求文档（`docs/`）、静态 HTML 高保真原型（`prototype/app/`，**V3 统一版**）、前端工程（`frontend/`）、产品图片素材、方法论沉淀（`docs/methodology/`）、一个打包归档（`H5商城原型与文档/H5商城原型与文档.zip`）。
- 原型页直接用浏览器打开 `prototype/app/index-v2.html` 即可预览。
- 已安装 `.agents/skills/baoyu-design/`（vendored，源自 github.com/JimLiu/baoyu-design）：高保真原型设计 skill。skill 自带的 `agents/*.mjs` 记账/编译脚本不可运行，跳过即可。
- **原型已统一收口到 `prototype/app/`（V3）**：MVP 9 页（原 8 页 + 登录页 login.html，2026-08-26 验收时补）全部完成且互链可点，后续新页面原型直接放 `prototype/app/`；`designs/` 目录已废弃。V1 三页（index/products/product.html）为历史版本，冻结勿改。

## 三、技术栈约定（后续生成代码必须遵循，不要换框架）

### 前端（已建，`frontend/`）
- Vue 3 + Vite + TypeScript + Vant 4 + TailwindCSS + Pinia + Vue Router（**hash 模式**）+ Axios + Swiper
- px 用 `postcss-px-to-viewport-8-plugin` 转 vw，**375px 为设计基准**，最大展示宽度 480px
- 数据流：页面只调 `src/api/`，`VITE_USE_MOCK=1` 时走 `frontend/mock/`；内容块渲染器在 `src/components/blocks/`

### 后端（`server/` 已建，持续开发）
- Node.js + NestJS + TypeScript + MySQL 8（不使用 Redis）

### 部署
- 国内服务器 + Nginx + HTTPS + Docker

## 四、目录结构（以实际文件为准）

```
H5-shop/
├── AGENTS1.md                     # 本文件的早期版本（历史保留，内容已迁移到 AGENTS.md）
├── docs/
│   ├── H5商城设计规范_WELLBIORA_v0.2.md   # 注意：文件名是 v0.2，但内容已是 v0.3，为前端开发唯一设计依据
│   ├── WorkBuddy原型设计任务书.md          # 原型设计任务书（含 4 款产品信息表、验收清单）
│   ├── wellbiora资料夹/                   # 全部产品图与 Logo 素材（P1~P4 详情图 + 8 版 Logo）
│   ├── methodology/                     # 方法论沉淀（AI原生开发流程-宝玉.md、原型验收核查清单.md）
│   ├── 小程序参考/乐檬/                    # LemonBox 小程序参考（目前为空目录）
│   ├── vendor/junmeng/                  # 君梦 OMS OpenAPI 2.0：docx 原件 + 已拆分的 Markdown（查接口直接读这里的 md，勿解析 docx）
│   ├── tech/                            # 技术设计文档（阶段 B）：junmeng-integration-notes.md（君梦对接注意）、payment-and-funds.md（支付申请与资金流）、auth-and-account.md（登录与账号体系）
│   │                                    #   + T6 定稿（2026-08-26）：content-blocks.md（内容块 type 定稿）、order-flow.md（订单状态机/三单对碰/限额）、
│   │                                    #   oms-adapter.md（保税仓适配层）、api-contract.md（前后端契约+mock 策略）、admin-backend.md（后台管理系统）
│   ├── requirements/                    # 需求池（未排期候选需求，文件名前缀日期 YYYY-MM-DD-；决定启动时才转入 tasks/TODO.md）
│   └── tasks/                           # 任务管理：TODO.md（活跃）+ archive/（已归档，勿扫描）
├── prototype/app/                 # 静态 HTML 原型（纯 HTML+CSS+JS，无构建）—— V3 统一版，9 页互链
│   ├── index.html / products.html / product.html   # V1 版（历史冻结）
│   ├── index-v2.html / products-v2.html / product-v2.html  # 首页 / 产品列表 / 商品详情
│   ├── cart.html / checkout.html / address.html    # 购物车 / 结算页 / 地址+实名
│   ├── orders.html / order.html / mine.html        # 订单列表 / 订单详情 / 我的
│   ├── login.html                        # 登录/注册页（手机号验证码免密，2026-08-26 新增）
│   ├── style.css / style-v2.css
│   ├── data.js / data-v2.js       # 商品数据，采用「内容块数组」结构演示
│   ├── orders-data.js             # 订单 mock 数据（orders.html / order.html 共用）
│   └── assets/                    # 原型引用的产品与 Logo 图片（p1-* ~ p4-*, logo-*）
├── frontend/                      # H5 前端工程（T7 已建，MVP 9 页 mock 全链路）
│   ├── src/views/                 # 9 页：Home/Products/ProductDetail/Cart/Checkout/Address/Orders/OrderDetail/Mine/Login
│   ├── src/components/            # TabBar/ProductCard/SectionHead/PriceText + blocks/（BlockRenderer + 16 种块组件）
│   ├── src/api/                   # API 层（mock 开关）+ axios 封装（统一响应壳、JWT 头）
│   ├── src/stores/                # Pinia：cart / user
│   ├── src/types/                 # ContentBlock 联合类型、Product/Order 等（金额一律分）
│   ├── mock/                      # mock 数据（搬自原型 data.js/data-v2.js/orders-data.js）
│   └── public/assets/             # 产品与 Logo 图片（复制自 prototype/app/assets/）
├── server/                        # NestJS 服务端（T8 首期已建）
│   ├── src/auth/                  # 短信验证码/JWT 登录（MySQL 验证码、用户与限频）
│   ├── src/home/ + src/products/  # 首页内容块、商品列表/详情只读接口
│   ├── src/admin/ + src/catalog/  # 【feat/admin-init 分支】后台管理：管理员登录/限频、商品目录持久化、内容块发布/回滚、审计日志
│   ├── src/database/              # TypeORM 数据源与 users 初始化迁移
│   ├── test/                      # HTTP e2e 测试
│   └── .env.example / docker-compose.yml / Dockerfile / README.md
├── assets/                        # 根目录素材夹（目前为空；实际素材在 docs/wellbiora资料夹/）
├── .agents/skills/baoyu-design/   # vendored 原型设计 skill（勿改，升级用 npx skills update）
└── H5商城原型与文档/H5商城原型与文档.zip   # 文档+原型打包归档
```

> 注意：设计规范文档中写的素材目录是 `assets/wellbiora/`，但实际文件在 `docs/wellbiora资料夹/`，引用时以实际路径为准。
> 君梦接口文档已拆分：`docs/vendor/junmeng/README.md` 是索引（环境地址/签名速查/接口清单），单个接口字段表在 `docs/vendor/junmeng/api/`，枚举值在 `docs/vendor/junmeng/reference/`。docx 更新后重跑该目录下 `_extract_docx.py` + `_split.py` 重新生成。
> 规划中（待建）：`server/`（NestJS 后端）、`admin/`（Vue 3 + Element Plus 运营后台，与 server 同服务，设计见 docs/tech/admin-backend.md）。

## 五、硬性规则（不可违反）

1. **密钥安全**：appSecret、支付密钥等敏感信息只允许在服务端，前端代码绝不出现。
2. **下单硬校验**（跨境电商零售进口限额）：
   - 实名认证（姓名 + 身份证号）
   - 单笔订单 ≤ 5000 元
   - 个人年度累计 ≤ 26000 元
3. **文案合规红线**：商品文案不得出现疾病治疗、预防、医疗术语（保健品广告合规）；「解毒/Detox」类表述谨慎使用；数据宣称（如「4x 吸收提升」）必须带 * 号和来源脚注；每个详情页固定展示合规声明折叠面板（不可删）。
4. **移动端优先**：适配 iPhone 安全区 `env(safe-area-inset-bottom)`，固定底部栏不被遮挡；页面容器高度用 `100dvh`；可点区域 ≥ 44px。
5. **保税仓统一适配层**：所有保税仓对接走统一适配层封装，前端只调我们自己的接口，方便未来扩展成都仓。
6. **三单对碰**：订购人、支付人、收货人实名信息必须一致的校验逻辑要保留（海关要求）。
7. **页面架构**：商品详情页和首页一律采用「内容块/模块数组 + 前端渲染器」架构，**禁止用富文本字段堆砌详情页**；新增内容块类型时先给出 type 定义和渲染组件，再写页面（原型 `prototype/app/data.js` 中已有 `gallery / image / badges / nutrition / nutrition_image` 等块类型示例）。
8. **设计规范**：所有页面样式以 `docs/H5商城设计规范_WELLBIORA_v0.2.md`（内容为 v0.3）为准（色值、圆角、间距、字号不得自行发挥）；产品图未提供前统一用占位图路径 `/assets/placeholder/`。

## 六、设计规范要点速查（详见 docs 内规范全文）

- 品牌主色深墨绿 `#033B3C`，深色 `#022829`，薄荷绿 `#D9EDE2`，页面底米白 `#F7F5F0`，价格/促销红 `#E6432D`（仅用于价格，不大面积使用）
- 产品主题色仅用于产品相关点缀：p1 `#88BDCB`、p2 `#F8A818`、p3 `#082068`、p4 `#702848`；页面骨架保持品牌绿体系
- 排版为杂志式：模块标题 = 英文衬线小字（Georgia、全大写、字距 .22em）+ 中文大标题
- 卡片无阴影，靠「米白底 + 白卡」区分层级；按钮全圆角 999px、高 48px
- MVP 页面清单共 9 页：首页 / 产品列表 / 商品详情 / 购物车 / 结算页 / 地址+实名 / 订单列表与详情 / 我的 / 登录（手机号验证码免密）

## 七、协作方式

- 全程用中文回答，代码注释用中文。
- 每个功能按「文件结构 → 完整可运行代码 → 要点说明」输出，标注每个文件的存放路径。
- 改已有代码时，只给改动部分并说明替换了什么，不要每次重发全量文件。
- 涉及君梦接口时，主动提醒：**测试环境先行、签名调试、`orderDeclaNo` 和 `plaformCode`（注意君梦文档原始拼写）等待确认项**。
- 不确定的需求，先向项目负责人确认再写代码，不要自行假设业务规则。

### 任务管理链路（跨会话记忆）

- **活跃任务**统一记录在 `docs/tasks/TODO.md`，每次会话开工前先读它。
- 任务**完成后**：把该任务条目从 TODO.md 剪切到 `docs/tasks/archive/YYYY-MM-DD-<任务名>.md`（简述产出、验证结果、遗留点）。
- `docs/tasks/archive/` 是冷存储，**日常不要读取/扫描**，仅当用户明确要求回溯时才打开（节省上下文）。
- **Git 策略**：不必每次任务状态变化都提交；由助手按阶段判断（一个完整任务、一批文档、一次原型迭代收尾时）执行 `commit + push`。提交信息统一为 `<类型>: <MM.DD>-<中文摘要>`，例如 `fix: 08.30-修复本地认证联调`；类型使用 `feat`、`fix`、`docs`、`refactor`、`test` 或 `chore`。每次 push 后必须在回复中明确告知 push 记录（commit hash + 内容摘要），保证用户知道远端已更新、其他机器 clone 能拿到最新状态。

## 八、待确认事项（碰到先问）

> 君梦相关细节问题已细化到 `docs/tech/junmeng-integration-notes.md` 第四节，联调前对照处理。

- [ ] 君梦 OMS 测试环境账号与正式参数（appId/appSecret/shopId/warehouseNo，客户端「账号 → 君梦API接口对接」获取）
- [x] 自建 H5 商城的 `plaformCode` = **5101960X8F**（成都泽芃铭贸易海关注册号，君梦已确认 2026-08-26）
- [ ] `orderDeclaNo` 报关单号由谁生成；`orderNo` 弃用字段的实际传值要求
- [ ] 发货回传：回调 method 名、验签规则、重推机制（需我方提供公网 HTTPS 回调地址）
- [ ] 4 款在售商品的仓库 `goods_no` 与效期/批次属性（联系仓库商务）
- [ ] 海关退单（超年度额度等）的状态码/拦截信息表现形式与资金退回路径
- [ ] 微信支付商户号、报关接口接入方式（服务商模式还是直连；支付备案号已确认：财付通 4403169D3W）
- [ ] 成都保税仓的 OMS 对接方是否也是君梦
- [ ] 登录方案已定为手机号验证码免密 + 微信静默授权（docs/tech/auth-and-account.md），待确认认证服务号与短信服务商
- [ ] 设计稿最终确认版本
