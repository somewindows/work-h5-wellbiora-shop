# 本地下单联调闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 H5 能在本地 MySQL 上完成登录、加购、保存地址实名、订单预检、创建待支付订单、查询与取消。

**Architecture:** NestJS 新增 JWT 鉴权、购物车、地址实名、订单和本地仓库/支付适配器模块，业务数据均存 MySQL，商品仍来自既有目录种子。前端保持 mock 默认值，通过 Vite `/api` 代理与环境变量切换真实服务端；敏感身份证号只以 AES-256-GCM 密文持久化。

**Tech Stack:** NestJS 11、TypeORM、MySQL 8、Node `crypto`、Vue 3、Pinia、Axios、Vitest、Jest/Supertest。

**Spec:** `docs/superpowers/specs/2026-08-30-local-order-loop-design.md`

## Global Constraints

- 后端只能使用 NestJS、TypeScript、MySQL 8；不引入 Redis。
- 前端请求仍统一通过 `/api/v1`；金额一律为整数分。
- 身份证号只在服务端以 AES-256-GCM 密文保存和脱敏输出，密钥只在 `server/.env`。
- 下单服务端必须校验实名、收货人一致、单笔 500000 分、年度 2600000 分、库存与请求幂等。
- 仓库访问只能经 `WarehouseAdapter`；本阶段不得调用真实微信/君梦或写入真实密钥。
- 每个新增业务行为先写失败测试，再写最小实现。

---

### Task 1: 鉴权、敏感数据和数据库基础

**Files:**
- Create: `server/src/common/current-user.decorator.ts`, `server/src/common/jwt-auth.guard.ts`, `server/src/security/personal-data-crypto.service.ts`, `server/src/security/security.module.ts`, `server/src/database/migrations/1710000002000-create-commerce-tables.ts`
- Modify: `server/src/database/database.module.ts`, `server/src/main.ts`, `server/.env.example`, `server/src/app.module.ts`
- Test: `server/src/security/personal-data-crypto.service.spec.ts`, `server/src/common/jwt-auth.guard.spec.ts`

**Interfaces:**
- Produces `JwtAuthGuard`、`CurrentUser()`、`PersonalDataCryptoService.encrypt(value): string`、`decrypt(payload): string`。
- 所有后续模块通过 `@UseGuards(JwtAuthGuard)` 和 `CurrentUserId` 获取当前用户。

- [ ] 写加密往返、错误密钥与 JWT 缺失/有效令牌的失败测试。
- [ ] 运行 `npm test -- personal-data-crypto.service.spec.ts jwt-auth.guard.spec.ts`，确认测试因实现缺失而失败。
- [ ] 实现 AES-256-GCM、JWT 解析守卫、环境变量校验和 commerce 表迁移。
- [ ] 重新运行目标测试并提交 `feat(server): add commerce security foundation`。

### Task 2: 服务端购物车

**Files:**
- Create: `server/src/cart/cart-item.entity.ts`, `server/src/cart/cart.dto.ts`, `server/src/cart/cart.service.ts`, `server/src/cart/cart.controller.ts`, `server/src/cart/cart.module.ts`
- Modify: `server/src/app.module.ts`, commerce migration
- Test: `server/src/cart/cart.service.spec.ts`, `server/test/cart.e2e-spec.ts`

**Interfaces:**
- Consumes `Product` 目录和 `CurrentUserId`。
- Produces `GET /cart`、`POST /cart/items`、`PATCH /cart/items/:id`、`DELETE /cart/items/:id`，均返回 `CartItem[]`。

- [ ] 写“合并同 SKU”“数量必须大于零”“只能操作自己的购物车”的失败测试。
- [ ] 运行目标 Jest 测试，确认规则尚未实现。
- [ ] 实现实体、仓储、DTO、控制器和服务端商品快照映射。
- [ ] 运行单元与 e2e 测试并提交 `feat(server): add persistent cart APIs`。

### Task 3: 地址与实名档案

**Files:**
- Create: `server/src/profile/address.entity.ts`, `server/src/profile/realname-profile.entity.ts`, `server/src/profile/profile.dto.ts`, `server/src/profile/profile.service.ts`, `server/src/profile/profile.controller.ts`, `server/src/profile/profile.module.ts`
- Modify: commerce migration, `server/src/app.module.ts`
- Test: `server/src/profile/profile.service.spec.ts`, `server/test/profile.e2e-spec.ts`

**Interfaces:**
- Produces地址 CRUD 与 `GET/POST /realname`；`POST /realname` 接受 `{ name, idcard }`，读取仅返回 `{ name, idcard }` 的脱敏值。
- 后续订单通过 `getDefaultAddress(userId)`、`getRealname(userId)` 读取不可变输入。

- [ ] 写“首地址自动默认”“跨用户地址隔离”“身份证永不以明文返回”的失败测试。
- [ ] 运行测试，确认失败原因是模块不存在。
- [ ] 实现地址与实名实体、加密持久化、DTO、控制器和业务错误处理。
- [ ] 运行单元与 e2e 测试并提交 `feat(server): add address and realname APIs`。

### Task 4: 订单和本地外部适配器

**Files:**
- Create: `server/src/orders/order.entity.ts`, `server/src/orders/order-item.entity.ts`, `server/src/orders/order.dto.ts`, `server/src/orders/order.service.ts`, `server/src/orders/order.controller.ts`, `server/src/orders/orders.module.ts`, `server/src/orders/local-warehouse.adapter.ts`, `server/src/orders/warehouse.adapter.ts`, `server/src/orders/local-payment.adapter.ts`
- Modify: commerce migration, `server/src/app.module.ts`
- Test: `server/src/orders/order.service.spec.ts`, `server/test/orders.e2e-spec.ts`

**Interfaces:**
- Produces `POST /orders/precheck`、`POST /orders`、`GET /orders`、`GET /orders/:orderNo`、`POST /orders/:orderNo/cancel`。
- `WarehouseAdapter.getInventory(productIds)` 仅由订单服务调用；`LocalWarehouseAdapter` 返回在售 SKU 有库存。

- [ ] 写“实名/收货人不一致拒单”“500000 分限额拒单”“相同 requestId 返回原订单”“待支付可取消、其他状态不可取消”的失败测试。
- [ ] 运行订单单元测试，确认尚未实现。
- [ ] 以事务实现预检、订单快照、幂等键、购物车清理、列表/详情和取消窗口；添加仅开发环境可用的 mock 支付确认入口供 e2e 使用。
- [ ] 运行订单单元/e2e 与完整 `npm test && npm run test:e2e`，提交 `feat(server): add local order workflow`。

### Task 5: 前端真实接口与结算接入

**Files:**
- Modify: `frontend/src/api/index.ts`, `frontend/src/types/index.ts`, `frontend/src/views/AddressView.vue`, `frontend/src/views/CheckoutView.vue`, `frontend/src/views/OrdersView.vue`, `frontend/src/views/OrderDetailView.vue`, `frontend/vite.config.ts`, `frontend/.env.local.example`
- Test: `frontend/src/api/*.spec.ts`、现有路由/内容块测试

**Interfaces:**
- 前端 API 新增 `createAddress`、`updateAddress`、`saveRealname`、`precheckOrder`、`cancelOrder`，路径和 Task 2–4 完全一致。
- `VITE_USE_MOCK=0` 时 `/api` 代理到 `http://localhost:3000`；默认开发环境仍为 mock。

- [ ] 写“真实模式向订单预检传递空请求体”“地址页按地址后实名的顺序保存”“结算页预检失败不创建订单”的失败测试。
- [ ] 运行 Vitest，确认失败原因对应接口/页面逻辑缺失。
- [ ] 实现 API、地址保存、预检、取消交互和 Vite 代理；保持视觉规范不变。
- [ ] 运行 `npm test && npm run type-check && npm run build`，提交 `feat(frontend): connect checkout to local APIs`。

### Task 6: 本地运行验收与交接

**Files:**
- Modify: `server/README.md`, `docs/tasks/TODO.md`, `AGENTS.md`
- Test: 全部 server 与 frontend 校验命令；本地 HTTP 冒烟脚本或 Supertest e2e。

- [ ] 在 README 写明复制 `.env`、启动 MySQL、执行迁移、启动 server、切换 `VITE_USE_MOCK=0`、获取控制台验证码、完成下单的步骤。
- [ ] 运行 `server` 的 lint/test/e2e/build 及 `frontend` 的 test/type-check/build；检查 `git diff --check`。
- [ ] 更新任务状态，只保留需要真实微信/君梦/后台凭据的后续项。
- [ ] 提交并推送验收与文档变更。
