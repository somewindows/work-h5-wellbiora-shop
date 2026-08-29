# T8 Server Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初始化可运行、可测试的 NestJS 服务端，并实现与 H5 前端契约一致的认证、首页和商品接口。

**Architecture:** NestJS 以 `/api/v1` 为唯一 H5 接口前缀。全局响应/异常层规范化 API 输出；认证模块通过 MySQL 管理验证码与限频、TypeORM 保存用户并签发 JWT；首页和商品模块通过受版本控制的服务端 seed 数据提供固定内容块，后续可无缝替换为 MySQL 内容数据。

**Tech Stack:** Node.js 24、NestJS、TypeScript、Jest、TypeORM、MySQL 8、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-08-29-t8-server-foundation-design.md`

## Global Constraints

- 所有 H5 路由必须在 `/api/v1` 下，成功响应为 `{ code: 0, data }`。
- 金额使用整数分；内容页使用有序内容块数组，合规声明不可缺失。
- JWT、MySQL、短信以及未来的支付/OMS 密钥仅能来自服务端 `.env`，不得提交真实值。
- 本期不实现订单、支付、君梦、实名与 admin；后续订单必须遵守限额和三单对碰硬校验。
- `prototype/` 与 `frontend/.env.development` 不修改。

---

### Task 1: 服务端脚手架、运行配置与统一 API 层

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/main.ts`
- Create: `server/src/app.module.ts`
- Create: `server/src/common/api-response.interceptor.ts`
- Create: `server/src/common/business.exception.ts`
- Create: `server/src/common/http-exception.filter.ts`
- Create: `server/src/common/api-response.interceptor.spec.ts`
- Create: `server/.env.example`
- Create: `server/docker-compose.yml`
- Create: `server/Dockerfile`

**Interfaces:**
- Produces `ApiResponseInterceptor` that wraps successful controller values as `{ code: 0, data }`.
- Produces `HttpExceptionFilter` that maps `BusinessException(code, message, status)` to the documented error shell.

- [x] **Step 1: Write failing response and exception tests**

```ts
it('wraps a controller value in the API response shell', async () => {
  expect(await interceptValue({ id: 'p1' })).toEqual({ code: 0, data: { id: 'p1' } })
})

it('preserves the documented business code in an exception response', () => {
  expect(filterBusinessError(new BusinessException(40404, '商品不存在', 404))).toMatchObject({
    statusCode: 404,
    body: { code: 40404, message: '商品不存在', data: null },
  })
})
```

- [x] **Step 2: Run the focused test and verify it fails because the common API layer does not exist**

Run: `cd server && npm test -- api-response.interceptor.spec.ts`

- [x] **Step 3: Add Nest bootstrap, configuration validation, API response interceptor, business exception class and exception filter**

```ts
app.setGlobalPrefix('api/v1')
app.useGlobalInterceptors(new ApiResponseInterceptor())
app.useGlobalFilters(new HttpExceptionFilter())
```

- [x] **Step 4: Add Docker/local environment configuration and run the focused test**

Run: `cd server && npm test -- api-response.interceptor.spec.ts`
Expected: PASS.

### Task 2: 首页和商品内容契约

**Files:**
- Create: `server/src/catalog/catalog.types.ts`
- Create: `server/src/catalog/catalog.seed.ts`
- Create: `server/src/home/home.controller.ts`
- Create: `server/src/home/home.module.ts`
- Create: `server/src/products/products.controller.ts`
- Create: `server/src/products/products.service.ts`
- Create: `server/src/products/products.module.ts`
- Create: `server/src/products/products.service.spec.ts`
- Create: `server/test/catalog.e2e-spec.ts`

**Interfaces:**
- `ProductsService.findAll(): Product[]`
- `ProductsService.findOne(id: string): ProductDetail` throws `BusinessException(40404, '商品不存在', 404)`.
- `GET /home`, `GET /products`, `GET /products/:id` return the public API shells.

- [x] **Step 1: Write failing service tests for the four-product list, complete detail and absent product**

```ts
it('returns four public product cards', () => expect(service.findAll()).toHaveLength(4))
it('returns a product detail with blocks and compliance text', () => {
  expect(service.findOne('p2')).toMatchObject({ id: 'p2', complianceText: expect.any(String), blocks: expect.any(Array) })
})
it('rejects an unknown product with business code 40404', () => {
  expect(() => service.findOne('missing')).toThrow('商品不存在')
})
```

- [x] **Step 2: Run the focused test and verify it fails because the catalog service is absent**

Run: `cd server && npm test -- products.service.spec.ts`

- [x] **Step 3: Add typed server-side seed data copied from `frontend/mock/home.ts` and `frontend/mock/products.ts`, then implement controllers/services**

```ts
@Get(':id')
findOne(@Param('id') id: string): ProductDetail {
  return this.productsService.findOne(id)
}
```

- [x] **Step 4: Run unit and e2e catalog tests**

Run: `cd server && npm test -- products.service.spec.ts && npm run test:e2e -- catalog.e2e-spec.ts`
Expected: PASS, including the API response shell and 40404 body.

### Task 3: 用户持久化、短信验证码与 JWT 登录

**Files:**
- Create: `server/src/users/user.entity.ts`
- Create: `server/src/users/users.repository.ts`
- Create: `server/src/users/users.module.ts`
- Create: `server/src/database/migrations/1710000000000-create-users.ts`
- Create: `server/src/auth/auth.controller.ts`
- Create: `server/src/auth/auth.service.ts`
- Create: `server/src/auth/auth.module.ts`
- Create: `server/src/auth/dto/send-sms-code.dto.ts`
- Create: `server/src/auth/dto/login.dto.ts`
- Create: `server/src/auth/sms-code.store.ts`
- Create: `server/src/auth/sms-provider.ts`
- Create: `server/src/auth/auth.service.spec.ts`
- Create: `server/test/auth.e2e-spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- `SmsCodeStore.issue(phone, ip): Promise<void>` applies MySQL-persisted cooldown and send rate limits.
- `SmsCodeStore.verify(phone, code): Promise<void>` enforces expiry and five failed attempts.
- `AuthService.login(phone, code): Promise<{ token: string; user: PublicUser }>` creates a user if absent.

- [x] **Step 1: Write failing auth tests for code issue, successful new-user login, wrong-code rejection and per-phone rate limiting**

```ts
it('creates a user and returns a masked phone after a valid code', async () => {
  await store.issue('13888888888', '127.0.0.1')
  await expect(service.login('13888888888', store.lastCode)).resolves.toMatchObject({
    token: expect.any(String), user: { phone: '138****8888' },
  })
})
it('rejects a wrong code without issuing a JWT', async () => {
  await expect(service.login('13888888888', '000000')).rejects.toThrow('验证码错误')
})
```

- [x] **Step 2: Run the focused tests and verify they fail because AuthService is absent**

Run: `cd server && npm test -- auth.service.spec.ts`

- [x] **Step 3: Implement entity/migration, repository, MySQL-backed store with testable memory double, console SMS provider, DTO validation and JWT service**

```ts
return { token: this.jwtService.sign({ sub: user.id, phone: user.phone }), user: toPublicUser(user) }
```

- [x] **Step 4: Run auth unit and e2e tests**

Run: `cd server && npm test -- auth.service.spec.ts && npm run test:e2e -- auth.e2e-spec.ts`
Expected: PASS, including `{ code: 0, data }` login response and no exposed code. The e2e module supplies the in-memory `UsersRepository` and `SmsCodeStore`, issues a known test code through the store, and never opens MySQL or Redis connections.

### Task 4: 全量校验与项目交接

**Files:**
- Modify: `docs/tasks/TODO.md`
- Modify: `AGENTS.md`
- Create: `docs/tasks/archive/2026-08-29-T8-服务端首期.md`（仅在任务完成时）

- [x] **Step 1: Run server static checks, unit tests, e2e tests and production build**

Run: `cd server && npm run lint && npm test && npm run test:e2e && npm run build`
Expected: each command exits 0.

- [x] **Step 2: Build the existing frontend without changing its mock configuration**

Run: `cd frontend && npm run build`
Expected: exit 0.

- [x] **Step 3: Update active task state and project inventory only after verification is green**

Move the completed server-first-phase task out of `TODO.md`, record outputs and verification in the archive, and update `AGENTS.md` to list `server/` and its delivered modules.

- [x] **Step 4: Review the diff and commit the complete T8 server-first-phase change**

Run: `git diff --check && git status --short && git add server docs/superpowers docs/tasks/TODO.md docs/tasks/archive AGENTS.md && git commit -m "feat(server): initialize auth and catalog APIs"`
