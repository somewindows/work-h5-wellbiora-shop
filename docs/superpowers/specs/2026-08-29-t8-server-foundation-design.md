# T8 服务端首期设计

## 目标与范围

在 `server/` 建立 WELLBIORA H5 商城的 NestJS 服务端，先交付 `auth`、`home` 与 `products` 三个模块，供前端由 mock 切换到 `/api/v1` 后联调。`admin/`、购物车、地址实名、订单、微信支付和君梦 OMS 均不属于本期实现范围。

本期实现严格遵循 `docs/tech/api-contract.md`、`auth-and-account.md` 与 `content-blocks.md`：金额为分、时间使用 ISO 8601、登录使用 Bearer JWT，详情与首页均返回内容块数组。

## 运行架构

- NestJS 应用监听 `PORT`（默认 `3000`），全局前缀为 `/api/v1`；CORS 来源通过 `CORS_ORIGIN` 配置。
- 成功响应统一为 `{ code: 0, data }`；业务异常由全局过滤器转换为 `{ code, message, data: null }`。未知商品返回 HTTP 404 与业务码 `40404`；未认证/失效返回 HTTP 401 与 `40101`。
- `@nestjs/config` 读取 `.env`，仓库只提交 `.env.example`。启动时验证生产环境的 JWT、MySQL、Redis 配置；真实密钥不落库、不提交。
- MySQL 8 用 TypeORM 管理。首期仅建 `users` 表及迁移，保留 `union_id`、`wechat_open_id` 字段；手机号保存为唯一值。生产环境禁止 `synchronize`，仅执行迁移。
- Redis 存放短信验证码、验证码失败次数和手机号/IP 发送窗口。键统一以前缀 `wellbiora:` 命名并带 TTL。开发环境可用 console 短信提供商打印验证码；响应始终不泄露验证码。正式短信服务商未确认前不接真实供应商。
- Docker Compose 仅提供本地 MySQL 8 与 Redis 7；应用既可本地 `npm run start:dev`，也可用 Dockerfile 构建。

## 模块与接口

### AuthModule

`POST /auth/sms-code` 接收 `{ phone }`。只接受中国大陆 11 位手机号；对同手机号及同 IP 做 Redis 限频，生成 6 位随机验证码，5 分钟有效、最多 5 次校验。发送成功返回 `null`。

`POST /auth/login` 接收 `{ phone, code }`。验证码正确后按手机号查询或新建用户，清除验证码记录，签发 JWT，并返回 `{ token, user }`。`user.phone` 必须脱敏，绝不返回验证码或任何实名字段。

`GET /auth/wechat-silent` 暂以 `50101` 明确返回“微信静默授权尚未配置”；服务号认证、OAuth 回调域名与环境策略均是尚未确认的外部条件，因此不得伪造登录态。

### HomeModule / ProductsModule

`GET /home` 返回固定首页内容块数组；`GET /products` 返回 4 个商品卡片；`GET /products/:id` 返回相同商品基础字段、内容块数组与固定合规声明。数据独立存放在服务端 seed 模块，字段值与 `frontend/mock/` 保持一致，方便下一阶段迁入 MySQL JSON 内容块。

这些读取接口无需登录。数据中包含的数据宣称及脚注必须原样保留，合规声明必须在每一个商品详情响应中存在。

## 测试与验收

- 单元测试覆盖响应包装、异常映射、商品详情/不存在商品，以及验证码登录的成功、无效、限频与新用户创建路径。
- e2e 测试覆盖 `/api/v1/home`、商品列表与详情、商品 404、短信登录成功后的 JWT 受保护探针。
- 所有单元测试使用内存仓库和内存验证码存储，不依赖本机 MySQL/Redis；运行时适配器才连接真实基础设施。
- 完成时运行 `npm run lint`、`npm test`、`npm run test:e2e`、`npm run build`；并执行前端 `npm run build` 证明新增服务端不影响既有工程。

## 非目标与后续边界

- 不调用微信、短信供应商或君梦；所有凭证只在服务端环境变量中预留。
- 不实现订单，因此不提前伪造限额、三单对碰、支付回调或仓库推单。后续订单模块必须依赖 `WarehouseAdapter`，并实施实名、单笔 5000 元、年度 26000 元与三单对碰硬校验。
- 后台 `admin/` 在服务端启动后作为独立任务实现，使用同一套 API/数据库而不混入 H5 路由。
