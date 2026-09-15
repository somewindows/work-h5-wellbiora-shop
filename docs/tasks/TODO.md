# 待办任务（TODO）

> 本文件是当前活跃任务清单，AI 助手每次会话开工前读这里。
> 任务完成后：把该任务条目**剪切**到 `archive/` 下按日期归档，并从本文件删除。
> `archive/` 里的内容**不需要读**（节省上下文），除非用户明确要求回溯。

## 活跃任务

- **T13 · 项目复审修复**（2026-09-12 立项）：依据 `docs/project-review/2026.09.12-project-review.md`（R01~R17）+ `2026.09.12-deepseek-verification.md`（核实 + 严重性重排 + 4.1~4.5 新增发现）。两份文档结论可信，但**行号/路径有约十处偏移，修每条前按描述重新定位真实代码**。修支付/退款/回调必须过「支付链路评审关」（派子代理对抗性评审）+ 先读 `docs/pitfalls/2026-09-12-微信支付联调避坑.md`
  - **跨机器交接速览（2026-09-15 更新）**：第 0/1/2 批全部完成（**R09 并发窗口遗留 09-15 已关，纯条件更新无迁移**），第 3 批完成 4.3 + R06 年度额度预占（剩 R10/R15，R07 依赖 OMS——负责人透露可能换 OMS 服务商，适配层设计使换仓代码零返工，OMS 侧代码暂停），第 4 批杂项未动。换电脑后 `git pull` 即可继续。服务器部署已完成（含 refunds 迁移），**真实退款链路 2026-09-14 已验收**：商户基本账户充值后重试，RWB202609149E1AB1A5536701 ¥0.01 三秒到账、订单自动收敛「已退款」（首笔因账户零余额 NOT_ENOUGH 失败，坑已沉淀进 pitfalls）。**R09+R06 部署：pull → `cd server && npm run build` → 重启 NSSM 服务（无新表不用迁移）；部署后做一次真实冒烟：同证件并发两单应一成一败（验证 GET_LOCK 锁路径，测试环境覆盖不到）**
  - **第 0 批 · 立即（风险正在发生）**
    - [x] 服务器 .env 移除 `SMS_DEV_CONSOLE=1`（2026-09-12 负责人已注释）；历史日志验证码清理降级为**顺手项**（码已过期、开关已关且守卫强制，无实时风险；下次清理/轮转旧日志时删除即可，注意勿把含码日志打包外发）
    - [x] 生产启动守卫：production 下 `LOCAL_TEST_MODE=1`/`SMS_DEV_CONSOLE=1` 拒绝启动（覆盖 R07 一部分）
    - [x] 联调期登录过渡工具 `server/scripts/mint-dev-token.js`（真实短信接入前手工签测试 token；2026-09-13 升级为输出 `?dev_token=` 登录链接，微信/手机点开即登录——新版微信 4.x 已砍掉 X5 调试注入，此为其替代）
    - [x] 公钥模式终验（= T12 待办 ①③）：2026-09-13 20:33 真实 0.01 单（WB20260913693E2B244374）**回调不修自通**，未点补单状态自动转待发货；服务器日志确认「回调验签模式：微信支付公钥（PUB_KEY_ID_0111…）」+ JSAPI 下单成功。WB10005 已决定保留不下架（见第 2 批/T12 待办④）
  - **第 1 批 · 上线阻塞（正常使用即触发）**：~~R16 trust proxy/正确取客户端 IP~~（2026-09-12 已修：只信 loopback 来源 XFF + e2e）；~~R14 订单状态键统一~~（2026-09-12 已修：API 边界双向映射 recv/done + 前端未知状态兜底；遗留：仓库同步防旧状态覆盖 complete/receive 未做）；~~R02 首单无 openid 必断~~（2026-09-12 已修：建单/取参分离 + 结算稳定幂等键 + 40003 幂等恢复，过支付链路对抗性评审；2026-09-13 真机验收通过：授权→支付→回调全链自通）；~~R01 验证码计数回滚 + 登录限流~~（2026-09-12 已修：事务提交后才抛业务异常 + 手机号/IP 双维限速 SMS_LOGIN_MAX_FAILURES=10/LOCK_MINUTES=10；遗留：真实 MySQL 复测持久化计数）
  - **第 2 批 · 资金正确性**：~~R08 金额校验改用 `amount.total`~~（2026-09-12 已修：回调/查单均取 amount.total 校验，payer_total 不一致仅 warn；遗留：**用户实付/优惠额不落库、currency 未核验**——对账缺持久化依据，正式收款前补）；~~R03 下单事务化~~（2026-09-12 已修：主单+明细+删购物车+事件包进 runInTransaction，ER_DUP_ENTRY 精确捕获后重读幂等返回；遗留：真实 MySQL 复测回滚语义）；~~R09 取消与支付协调~~（2026-09-12 已修：取消时 best-effort 关微信交易；已取消订单的迟到扣款**登记支付事实**（paymentStatus=paid+systemRemark+事件+logger.error）不推仓不报关，转人工退款，后台因此解锁退款入口；过支付链路对抗性评审；**并发窗口 2026-09-15 已关**：handleWechatPaid/cancel/confirmMockPayment/refund settleOrder 全部改条件更新（`WHERE status='pay' AND payment_status='pending'` 等，复用 cancelIfPendingPayment 模式，无迁移）——落败方重读分流：取消晚于支付抛 40002、回调晚于取消撤孤儿推仓+登记支付事实不复活订单、重复回调幂等；admin cancel 待支付落败自动转 paid 分支撤仓+退款；settleOrder 重读+定向更新三列不再整体覆盖；新增 8 个竞态用例，单测 177/177、e2e 43/43，对抗性评审 PASS；遗留记录项：① 并发重复回调会在写库前重复 pushOrder（mock 幂等无害，**真实 OMS 推单幂等性待确认，并入 R10**）② 事件与主单非原子（原实现既有，可观测性缺口，可用 runInTransaction 包一层）③ admin cancel paid 分支仍是整体写小窗口（毫秒级，可覆盖并发 sync 的 warehouseStatus/systemRemark）；另 systemRemark 复用导致后台误显「海关拦截」标签，后续拆字段或改文案）；**R04+R05 退款单状态机 + 稳定退款单号**（2026-09-13 已修：refunds 账本表（迁移 1710000010000）+ RefundService 状态机——受理只置在途、到账以回调/查退款收敛；订单按账本重算 paymentStatus（全额=refunded/在途=refunding/部分成功=paid），支持部分退款再退；稳定退款单号 R+订单号+序号发起前落库，重复点击/重试/并发/网络异常全部收敛到一笔，通道报错先 queryRefund 按原单号查真实状态；商户平台发起的退款回调补登；admin 取消改按剩余可退发起且退款校验先于撤仓；降级护栏防旧单复活；后台详情加退款记录表+「退款中」状态+剩余可退口径；过两轮对抗性评审；**遗留：取消+退款事件与账本更新非原子（仅影响可观测性）**；~~迁移铁律~~已兑现：服务器真实 MySQL 跑过 migration:run，2026-09-14 真实退款 ¥0.01 三秒到账全链路验收通过）
  - **第 3 批 · 合规与设施**：~~4.3 后台任务调度设施~~（2026-09-13 已修：`TaskSchedulerService`（进程内 setInterval + 启动 5 秒补偿轮 + 异常隔离 + unref，刻意不引入持久化队列，任务全部「扫库+幂等收敛」）+ **超时关单 job**（24h 待支付自动取消，兑现 H5 文案；取消走条件更新 `WHERE status='pay' AND payment_status='pending'` 竞态安全——回调先登记支付的订单影响 0 行自动让位，不回滚支付事实）+ **退款在途收敛 job**（回调丢失按原单号 queryRefund 收敛；超 1h 查无置 failed 释放额度允许重发；本地 mock 无 queryRefund 时空转）；env 新增 `ORDER_EXPIRE_HOURS=24`/`ORDER_EXPIRE_CHECK_INTERVAL_MS`/`REFUND_SETTLE_CHECK_INTERVAL_MS`（NaN/非正数回落默认）；单测 169/169、e2e 43/43、lint/build 过，两轮对抗性评审（阻断项=旧对象覆盖写已改条件更新）；遗留：多实例部署会重复扫描（当前单实例无影响，扩容前需加锁/选主）、取消+事件非原子（仅影响可观测性，可用已有 runInTransaction 包一层））；~~R06 年度额度预占~~（2026-09-15 已修：下单即预占（负责人确认口径）——`sumOccupiedYearlyFen` 占用集合改为 (pending+pay) 或 paid/refunding，取消（含 24h 超时关单）与全额退款随查询语义自动释放、部分退款不释放；年度归属=创建年（注释写明，海关口径上线前与服务商确认）；并发原子化用 `withYearlyQuotaLock`（MySQL GET_LOCK 按实名指纹命名锁，不同账号同证件共享额度；锁内重查 requestId 幂等；锁超时转业务码 40001；InMemory 用 Promise 链互斥镜像语义）；预检仍查做 UX 提示、支付回调不复查（创建已占住）；新增 7 用例，单测 184/184、e2e 43/43，对抗性评审 PASS；**强制遗留：GET_LOCK 锁路径测试零覆盖（测试全走 InMemory），部署后必须在真实 MySQL 冒烟：同证件并发两单一成一败 + 锁超时路径**；记录项：锁连接≠业务写连接（临界区占 2 条池连接）、Between 边界包含性概率级发散、单库前提（读写分离/多实例锁失效））；R10 推仓/报关解耦；R15 商品编号并发 + 发布竞态；R07 剩余（真实仓储/实名核验，依赖 OMS 服务商确定）
  - **第 4 批 · 收尾**：R17 备份改 `--result-file` + 恢复演练；R11/R12 剩余加固；报告第五节杂项（401 自动登出、v-html 协议等；~~24h 自动取消文案~~已随 4.3 超时关单兑现）；qs 升级、Swiper 未使用可移除

- **T12 · 微信支付模块**（2026-09-10 开发中；参数已全部就绪：AppID/AppSecret/mchid 1117333649/v3 密钥/证书）
  - [x] 服务端 `src/payments/`：V3 签名/验签/AES-256-GCM 解密（node:crypto 手写，零新依赖）、平台证书下载缓存、JSAPI 下单适配器（未配置自动回落 local mock）、退款（v3）、支付/退款回调控制器（验签 + 5 分钟时间窗防重放 + 金额比对 + 幂等）、自助清关报关封装（v2 XML MD5，含三单对碰身份校验字段；自助清关未开通，仅代码 + 单测）
  - [x] openid 获取：`GET /auth/wechat/authorize-url`（snsapi_base，redirect 限站内）+ `POST /auth/wechat/openid`（code 换 openid 写 users.wechat_open_id，列早已预留）
  - [x] 订单联动：`handleWechatPaid`/`handleWechatRefundNotified`、orders 新列 `wechat_transaction_id`（迁移 1710000009000）、支付成功自动推仓库 + 触发报关（失败不阻塞主流程）
  - [x] 前端：`src/composables/useWechatPay.ts` 编排（40007 → 静默授权跳转 → 回跳绑定 openid 自动续付；WeixinJSBridge 调起；微信外弹「复制链接去微信打开」）；Checkout 下单后 `?autopay=1` 直达拉起；request.ts 透传业务码
  - [x] 全量测试 + 真 MySQL `migration:run` 验证（2026-09-10，kt02 便携 Node 22 + 便携 MySQL 8.4：单测 106/106、e2e 39/39（含微信支付回调全链路）、lint/build、前端 vitest 17/17 + type-check + build、迁移 run/revert/run 全过）
  - [ ] 真实联调（部署后，**进行中，2026-09-11 已跑到真实支付成功**）：
    - 已完成：服务器 .env 配齐 WXPAY_* → build/migration/restart 全过、回调端点 401 验签拒绝正常；公众号「网页授权域名」已配 `wellbiora.com.cn`（强制 https 已开，校验文件在 `D:\www\wellbiora\site\h5\MP_verify_QuZJZ925foVf0pSh.txt`）；18:00:58 微信内 0.01 元真实支付**成功**（微信交易单号 4500000380202609119885896489，商户单号 WB20260911FAD273D2E482，openid 绑定与 JSAPI 下单已通）
    - 当日修复 4 个：SMS_DEV_CONSOLE 生产联调逃生门（34367ac）、前端非 2xx 业务码透传修 40007 不跳转（2bdb51b）、支付链路服务端关键节点日志（fb6ad9c）、**微信回跳 code 在 # 前真实 query 里导致绑定静默失败的修复**（a11944a）
    - **「支付成功但订单状态仍待付款」根因已定位并修复（09.11 晚）**：Node 全局 fetch（undici）默认自动补 `Accept-Language: *`，微信 V3 网关不认，GET /v3/certificates 回 `PARAM_ERROR 传入了不支持的Accept-Language` → 平台证书永远拉不下来 → 回调验签全部失败（微信按 30分/30分/1h… 节奏持续重推，server-out.log 可见）。修复 = `wechat-pay.client.ts` 请求头显式 `Accept-Language: zh-CN`（本机实测 undici 默认头行为确认；单测 114/114、e2e 39/39、lint/build 全过）
    - 同时新增**主动查单补单**：`POST /admin/orders/:orderNo/sync-payment`（WechatPaymentAdapter.queryPayment 走 V3 查单，微信侧 SUCCESS 则复用 handleWechatPaid 登记，幂等 + 审计；404 按查无此单处理）+ admin 订单详情页「查单补状态」按钮（仅待支付订单显示）
    - **待办（下次上服务器）**：拉取部署后 ① ~~盯 server-out/server-err.log 确认 /v3/certificates 不再报 PARAM_ERROR~~（09.12 确认：PARAM_ERROR 已消失，但改报 `RESOURCE_NOT_EXISTS 无可用的平台证书，请在商户平台-API安全申请使用微信支付公钥`——该商户号是**微信支付公钥模式**，已加 `WXPAY_PUBLIC_KEY_PATH`/`WXPAY_PUBLIC_KEY_ID` 支持：验签改用本地微信支付公钥、不再拉平台证书；**需在商户平台-API安全-微信支付公钥 下载 pub_key.pem 并复制 PUB_KEY_ID_ 到服务器 .env 后重启**）② ~~对订单 WB20260911FAD273D2E482 用「查单补状态」补单~~（09.11 23:01 已补单成功：支付时间回写 18:00:58、金额比对通过、已推仓 local-accepted，审计 sync_payment 已记录）③ ~~再下一笔 0.01 真实单，验证回调不修自通~~（2026-09-13 已通：WB20260913693E2B244374 未点补单自动转待发货，公钥验签模式工作正常）④ ~~联调用测试商品 WB10005「支付联调测试（勿拍）」验收后记得下架~~（2026-09-13 负责人决定保留：网站未对外宣传，仅域名可访问，无真实客流）
    - 真实退款链路已验收（2026-09-14）：后台发起退款 → 微信回调/收敛 → 订单「已退款」、退款单「已到账」，¥0.01 三秒到账；首笔因商户基本账户零余额 NOT_ENOUGH 失败（充值后重试即通，坑已入 pitfalls）
    - 自助清关**已开通**（2026-09-15 商户平台确认：产品中心显示「关闭产品」= 已签约；海关信息杭州总署版已添加）；**剩最后一步：API 安全里「商户APIv2密钥」还未设置**——设置 32 位密钥（自行留存，微信不保存明文）后填服务器 .env：`WXPAY_API_V2_KEY` + `WXPAY_CUSTOMS_CODE=HANGZHOU_ZS` + `WXPAY_MCH_CUSTOMS_NO=5101960X8F`，重启后下一笔支付自动申报，商户平台「清关信息查询」可看申报状态
    - 注意：服务器 .env 目前 `SMS_DEV_CONSOLE=1`（验证码打日志的联调开关），**需尽快移除并清理已有日志中的验证码**（2026-09-12 起生产启动守卫已强制：production 下置 1 直接拒绝启动）；登录 JWT 有效期 7 天；服务器日志中文乱码是 PowerShell 5.1 按 GBK 解码 UTF-8 所致，`[Console]::OutputEncoding=[Text.Encoding]::UTF8` 后正常；文件名时间戳是 UTC（+8 换算）

- **T9 · 前端收尾与联调准备**（T7 遗留，详见 `archive/2026-08-27-T7-前端工程初始化.md` 遗留点）
  - 视觉走查：`npm run dev` 对照 `prototype/app/` 逐页目检
  - [x] 登录路由守卫：订单列表/详情、结算页、我的页面未登录时跳转 `/login`，并保留来源路径
  - [x] BlockRenderer 向 gallery 块透传产品 `themeLight` 底色（2026-08-30，含 Vitest 回归测试）
  - [x] 真实模式当前用户接口：`GET /users/me`；Axios 在 HTTP 错误时优先展示服务端业务文案（2026-08-30，前后端回归测试覆盖）
  - [x] 已实名用户修改地址时不再要求重填身份证号；页面只回显脱敏号码，首次实名仍强制填写完整号码（2026-08-30，前后端回归测试覆盖）
  - [x] 修复 mock 购物车数量更新后合计不刷新的响应式问题；mock API 统一返回不可变快照（2026-08-30，Vitest 回归测试覆盖）
  - [x] 修复真实 HTTP 局部更新地址时丢失手机号/默认标记的问题；已跑通登录→加购→地址实名→改地址→下单→取消订单 API 冒烟（2026-08-30）
  - 后端认证、首页、商品、购物车、地址实名和本地下单接口已完成并合并主干；前端可通过 `.env.development.local` 的 `VITE_USE_MOCK=0` 联调本机服务端（注意：Vite 优先级 `.env.development` > `.env.local`，用 `.env.local` 覆盖不生效，2026-09-03 已修正示例文件）。无 Docker 时复制 `server/.env.local-test.example` 为 `.env` 即可使用内存模式进行浏览器测试，默认 mock 开关不改
  - 仅剩视觉走查（需人工逐页目检），完成后 T9 即可归档
- **T8 · 后端与后台后续模块**（服务端首期已归档：`archive/2026-08-29-T8-服务端首期.md`）
  - [x] 购物车、地址和实名模块（身份证 AES-256-GCM 密文存储、脱敏展示与 HMAC 年度额度指纹）
  - [x] 订单预检、创建、查询、取消；服务端强制限额、实名收货人一致性和请求幂等校验（本地 mock 支付/仓库）
  - [x] 服务端本地联调闭环已合并主干（2026-08-30，`main` @ `d31f9b8` 已推送；单测 30/30、e2e 9/9、lint、构建、浏览器全流程冒烟通过）
  - [x] **后台管理服务端 P0 全部完成（2026-09-02，2026-09-03 随 `feat/admin-init` 合并回 main）**：管理员登录（scrypt 哈希 + IP/账号双维度失败锁定，阈值走 `ADMIN_LOGIN_MAX_FAILURES`/`ADMIN_LOGIN_LOCK_MINUTES`）+ `.env` 首次播种；商品目录持久化（新建/改价/上下架，初始未发布草稿）；内容块草稿（半成品可存）/发布（校验块类型、必填、带 `*` 宣称脚注）/版本快照/回滚上一版；订单管理（分页列表三状态并排 + 海关退单标记、详情身份证脱敏 + 状态事件流、手动 sync 按 order-flow.md 状态机收敛、取消/退款 confirm 二次确认 + 窗口校验：清关起拒 API 取消、退款≤实付不重复）；审计日志写入与分页查询；下单链路已接通 catalog 仓储（改价实时生效、下架拒单 40006）。单测 66/66、e2e 36/36、lint/build/LOCAL_TEST_MODE 冒烟全过。注意：新表 `admin_login_rate_limits`/`order_status_events` 及 orders 新字段上正式库需跑 migration:run。
  - 微信支付 sandbox → 君梦 OMS 测试环境；保税仓仅经 `WarehouseAdapter` 接入（卡在负责人并行事项的外部资质）
  - 上线前订单生产加固：MySQL 下单事务、库存预占/扣减、支付回调后仓库推送与状态补偿；同时评估 Nginx `trust proxy`、年度额度查询索引和生产密钥占位配置

## 下一步计划（开发顺序）

1. ~~T10 · 管理员桌面端 `admin/`~~ **已完成**（2026-09-03，见 `archive/2026-09-03-T10-管理员桌面端.md`）：登录、商品管理、内容块编辑器、订单管理、操作日志全部就绪，对接 `/api/v1/admin/*`；type-check/单测 21/21/build 与 LOCAL_TEST_MODE API 冒烟全过
2. ~~`feat/admin-init` 合并回主干~~ **已完成**（2026-09-03）；待做：admin 与 H5 前端的浏览器视觉走查（人工逐页目检）
3. 微信支付 sandbox 接入（等商户号核实）
4. 君梦 OMS 测试环境接入（等 appId/appSecret/shopId/warehouseNo + 商品 goods_no）
5. 上线加固：发布事务化、admin JWT 独立 secret、MySQL 自动备份、生产密钥配置

## 已归档

- T11 已完成归档（2026-09-07）：生产环境部署上线（Windows Server 2019 + HTTPS + 备案号），见 archive/
- T10 已完成归档（2026-09-03）：`admin/` 管理员桌面端（登录/商品/内容块编辑器/订单/操作日志），见 archive/
- T7 已完成归档（2026-08-27）：`frontend/` 工程搭建 + MVP 9 页 mock 全链路，见 archive/
- T6 已完成归档（2026-08-26）：技术设计 5 份文档在 `docs/tech/`
- T8 服务端首期已完成归档（2026-08-29）：`server/` NestJS 基础、认证、首页和商品接口，见 archive/
- T8 本地下单联调闭环已完成（2026-08-30）：购物车、地址实名、订单及前端真实模式接入；真实微信/君梦/后台仍待外部参数与后续开发
- 本地浏览器真实模式已验证（2026-08-30）：`LOCAL_TEST_MODE=1` 服务端与 `VITE_USE_MOCK=0` 前端代理均启动成功；无 Docker 可测试，数据重启即清空

## 项目负责人并行推进事项（非开发，周期长，越早启动越好）

> 2026-08-27 确认：**前期只做微信支付，支付宝暂不接入**（后期要接再评估：需单独申请支付宝商户 + 「手机网站支付」产品 + 支付宝报关接口，后端支付层已按适配层设计，届时不动业务代码）。

- [x] ICP 备案（**已完成**，2026-09-02 负责人确认）
- [x] 微信服务号「泽芃铭Zevon」（gh_75de7e368f9b，主体成都泽芃铭贸易有限公司）已注册且**已做微信认证**（2026-09-10 微信开发者平台确认）；AppID = `wx2591892b548a6565`，AppSecret 已启用（负责人离线保存）
- [x] 微信支付商户号 **mchid = 1117333649**（2026-09-10 确认）：JSAPI 支付已开通、AppID 已关联、支付授权目录已配 `https://wellbiora.com.cn/`、API v3 密钥已设置、API 证书已申请（序列号 3EE4E7FE…D72A，2031-09 到期，证书文件在 `server/certs/wechatpay/` 已 gitignore）——参数齐了，可启动微信支付开发
- [ ] 商户平台提交**海关备案信息** + 开通「自助清关」（报关前置，详见 docs/tech/payment-and-funds.md 第四节）
- [ ] 君梦 OMS 参数（appId / appSecret / shopId / warehouseNo）：登录**君梦客户端**获取——appId/appSecret 在「账号 → 君梦API接口对接」，shopId/warehouseNo 在「店铺管理 → 添加店铺」（文档截图见 `docs/vendor/junmeng/00-接入指南.md`）。测试环境地址与示例参数已在 `docs/vendor/junmeng/README.md`，签名算法与读接口（商品/库存查询）可先用文档示例参数联调，不必等正式账号
- [ ] 4 款在售商品的仓库 `goods_no` 与效期/批次属性（联系仓库商务；流程 = 商品海关备案 → 备货入保税仓 → OMS 建商品档案，已与君梦客服确认 2026-09-02）
- [ ] 综合税缴纳模式与君梦/义乌保税仓商务确认（代缴还是自缴、是否预存税金）
- [ ] 短信服务：申请**签名 + 模板**（阿里云/腾讯云，用已备案域名提交，审核 1~3 天）+ 买小额测试包；后端已抽象验证码通道，届时只实现一个 adapter
- [x] ~~远程 MySQL（部署前准备）~~ → 2026-09-07 实际方案变更：生产直接用**同机本地 MySQL 8.4**（不走远程实例），已随 T11 部署完成；每日自动备份待配置（指南 17.3）
- [x] ~~设计稿最终确认版本~~ → 2026-08-27 降级：**不阻塞开发**；首页/详情页内容后期随运营调整，走内容块数据层即可；设计规范 v0.3（色值/圆角/字号/间距）已定稿不变
