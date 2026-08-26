# work-h5-wellbiora-shop

WELLBIORA™ 海外旗舰店 —— 跨境电商 H5 商城（移动端网页，非小程序），销售海外保健品，1210 保税备货模式（义乌保税仓）。

## 当前状态

项目处于**原型与设计阶段**，尚无前后端工程代码。当前仓库内容：

- `docs/` —— 设计规范（v0.3，前端开发唯一设计依据）、原型设计任务书、产品与 Logo 素材、方法论沉淀（`docs/methodology/`）
- `prototype/app/` —— 静态 HTML 高保真原型 **V3 统一版**：MVP 8 页全部完成、互链可点（首页 / 产品列表 / 商品详情 / 购物车 / 结算 / 地址实名 / 订单列表与详情 / 我的）
- `.agents/skills/baoyu-design/` —— vendored 原型设计 skill

## 原型预览

无需构建，任选其一：

```bash
# 直接打开
prototype/app/index-v2.html

# 或本地起服务（推荐，体验与真机一致）
python -m http.server 4311
# 入口：http://localhost:4311/prototype/app/index-v2.html
# 全链路可点：首页 → 详情 → 购物车 → 结算 → 地址实名 → 支付（演示）→ 订单
```

## 规划技术栈

- **前端**：Vue 3 + Vite + TypeScript + Vant 4 + TailwindCSS + Pinia + Vue Router（hash 模式）+ Axios + Swiper；px → vw（375px 设计基准，最大宽度 480px）
- **后端**：Node.js + NestJS + TypeScript + MySQL 8 + Redis
- **对接**：君梦 OMS OpenAPI 2.0（保税仓）、微信支付（含海关报关）
- **部署**：国内服务器 + Nginx + HTTPS + Docker

## 关键业务约束

- 下单硬校验：实名认证；单笔订单 ≤ ¥5000；个人年度累计 ≤ ¥26000
- 三单对碰：订购人、支付人、收货人实名信息须一致（海关要求）
- 文案合规：保健品不得出现医疗术语，详见 `docs/H5商城设计规范_WELLBIORA_v0.2.md` 第九节
- 详情页/首页采用「内容块数组 + 前端渲染器」架构，禁止富文本堆砌

更多约定见 [AGENTS.md](AGENTS.md)。
