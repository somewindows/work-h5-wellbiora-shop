# WELLBIORA 服务端

## 本地启动

```powershell
cd server
Copy-Item .env.example .env
docker compose up -d mysql
npm run migration:run
npm run start:dev
```

服务端默认监听 `http://localhost:3000`，H5 接口前缀为 `/api/v1`。开发阶段验证码只写入服务端日志，HTTP 响应不会返回验证码；验证码、错误次数和发送限频均持久化在 MySQL。

## 校验

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```

不要提交 `.env`，也不要把短信、微信支付或君梦 OMS 的真实密钥写入源码。
