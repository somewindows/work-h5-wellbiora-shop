# WELLBIORA 运营后台（admin/）

跨境电商 H5 商城的桌面端运营后台：商品档案与详情内容块编辑、订单管理（同步/取消/退款）、操作日志查看。与同仓库 `server/`（NestJS）共用服务与数据库，接口前缀 `/api/v1/admin/`。

## 技术栈

Vue 3 + Vite + TypeScript + Element Plus（全量引入，中文语言包 zh-cn）+ Pinia + Vue Router + Axios + Vitest。

## 启动

```bash
cd admin
npm install
npm run dev        # http://localhost:5174
```

- dev 通过 vite proxy 把 `/api` 转发到 `http://localhost:3000`，**无需改动服务端 CORS**。
- 需先启动服务端（见 `server/README.md`；本地无 Docker 可用 `LOCAL_TEST_MODE=1` 内存模式）。

其他脚本：

```bash
npm run type-check # vue-tsc --noEmit
npm run build      # 产物在 dist/
npm run test       # vitest run（utils 单测）
```

## 管理员账号

首次启动服务端时按 `server/.env` 的 `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD` 播种（密码至少 12 位，只播种一次）。本地联调可参考 `server/.env.local-test.example` 中的 operator 账号（仅供本地，勿用于生产）。

## 功能清单（P0）

- **登录**：账号密码登录（`POST /admin/auth/login`），密码框支持显隐；token 存 sessionStorage，关闭标签页即失效；401/40101 自动清会话并回跳登录页。
- **商品管理**：列表（关键字/上下架筛选/分页）、新建对话框（含合规声明，仅创建时可设）、编辑页基础信息表单（保存即生效，含价格元↔分转换、主题色取色器、goods_no/仓库编码、上下架开关）。
- **内容块编辑**：草稿/线上双态；块卡片列表支持上移/下移/禁用（hidden）/删除（二次确认）/按 15 种已登记 type 添加；右侧按 type 出表单（stats 行编辑、nutrition 表格编辑、cert_wall 行编辑、productIds 商品多选等）；带 `*` 宣称的脚注字段有合规必填提示；保存草稿 / 发布（二次确认，展示服务端校验错误）/ 回滚上一版（二次确认，警告覆盖线上）；JSON 只读预览抽屉；未知 type 兜底原始 JSON 编辑。
- **订单管理**：状态 Tab、关键字、日期范围、分页；海关退单（customsRejected）红色标记 + systemRemark 摘要；详情页三层状态并排、商品明细、脱敏收货/实名信息、状态事件时间线；同步仓储状态、取消订单（说明后果后 confirm:true）、退款（金额校验 0<金额≤实付，confirm:true + amountFen）。
- **操作日志**：action 筛选、日期范围、分页；beforeData/afterData 对话框格式化 JSON 查看（`<pre>` 文本渲染，防 XSS）。

## 安全约定

- token 只存 sessionStorage，代码任何位置不打印 token。
- 全项目禁用 `v-html`；日志 JSON、systemRemark 等一律文本/`<pre>` 渲染。
- 取消/退款/发布/回滚均为二次确认对话框触发，`confirm:true` 不做默认勾选。
- 金额一律以分与后端交互，界面层用 `Math.round(元 * 100)` 转换。
- 本工程不包含任何密钥；`.env` 类文件仅提供 `.env.example` 示例。

## 目录结构

```
admin/
├── src/
│   ├── api/             # axios 封装（401 拦截、统一响应壳）+ auth/products/orders/audit
│   ├── components/blocks/  # 内容块编辑器：BlockEditor / BlockForm / blockSchemas
│   ├── layout/          # AdminLayout（侧边菜单 + 顶栏）
│   ├── router/          # 路由与登录守卫
│   ├── stores/          # Pinia auth（sessionStorage 会话）
│   ├── types/           # 与服务端 DTO 对齐的类型
│   ├── utils/           # format（金额/日期）、status（状态映射）、block（块工具）、session；含 vitest 单测
│   └── views/           # Login / products / orders / AuditLog
├── vite.config.ts       # 端口 5174，/api → localhost:3000，@ → src，vitest 配置
└── tsconfig.json
```
