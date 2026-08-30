# WELLBIORA 服务端

## 本地启动与 H5 联调

> 需要 Docker Desktop（或已运行的 MySQL 8）。当前仓库不使用 Redis。

### 无 Docker 的快速浏览器测试

用于原型、交互与全链路手工验收；所有用户、购物车、地址和订单数据只在内存中保存，重启服务后自动清空，不能用于真实支付或部署。

```powershell
cd server
Copy-Item .env.local-test.example .env
npm run build
npm run start
```

再打开另一个终端：

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm run dev
```

访问 `http://127.0.0.1:5173`。点击获取验证码后，从第一个终端的“开发短信验证码”日志中复制验证码登录；随后可完成加购、地址实名、预检、创建和取消待支付订单。

测试完成后删除本地 `.env` 与 `frontend/.env.local`，或分别改回 MySQL 和 mock 配置。

### MySQL 持久化联调

```powershell
cd server
Copy-Item .env.example .env
docker compose up -d mysql
npm run migration:run
npm run start:dev
```

服务端默认监听 `http://localhost:3000`，H5 接口前缀为 `/api/v1`。开发阶段验证码只写入服务端日志，HTTP 响应不会返回验证码；验证码、错误次数和发送限频均持久化在 MySQL。

### 浏览器手工验证路径

另开一个终端启动 H5，并显式关闭前端 mock：

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

打开终端显示的 `http://localhost:5173` 后，按以下顺序操作：

1. 访问「我的」并输入任意中国大陆测试手机号，点击获取验证码。
2. 从 `server` 的启动终端复制“开发短信验证码”，完成登录。
3. 从商品详情加入购物车，进入结算；首次结算会要求填写地址和实名信息。
4. 地址保存后返回结算，勾选跨境购买协议并创建订单。
5. 在订单详情中可取消待支付订单；本地支付确认入口仅给自动化测试使用，前端不会伪造支付成功。

`frontend/.env.development` 仍保持 `VITE_USE_MOCK=1`，删除 `.env.local` 即可恢复静态 mock 演示。

## 校验

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```

不要提交 `.env`，也不要把短信、微信支付或君梦 OMS 的真实密钥写入源码。
