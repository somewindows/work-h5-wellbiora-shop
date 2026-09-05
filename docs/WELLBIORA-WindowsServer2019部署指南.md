# WELLBIORA H5 商城 · Windows Server 2019 部署指南

> 适用对象：全新安装的 Windows Server 2019（未装任何环境）。
> 部署内容：H5 商城前端（`frontend`）+ NestJS 后端（`server`）+ 管理后台（`admin`）+ MySQL 数据库 + Nginx。
> 部署方式：原生安装（非 Docker），全部软件独立安装，出问题好排查。
>
> 文档中所有命令均在 **PowerShell** 中执行（开始菜单搜 PowerShell）。标注「⚠️」的是容易踩坑的点。

---

## 目录

1. [架构总览](#一架构总览)
2. [软件下载清单](#二软件下载清单)
3. [前置准备](#三前置准备)
4. [安装 Node.js](#四安装-nodejs)
5. [安装 Git](#五安装-git)
6. [安装 MySQL 8.4](#六安装-mysql-84)
7. [安装 Nginx](#七安装-nginx)
8. [安装 NSSM（把程序注册成 Windows 服务）](#八安装-nssm把程序注册成-windows-服务)
9. [获取项目代码](#九获取项目代码)
10. [部署后端 server](#十部署后端-server)
11. [构建前端 frontend 和管理后台 admin](#十一构建前端-frontend-和管理后台-admin)
12. [配置 Nginx 站点](#十二配置-nginx-站点)
13. [注册 Windows 服务并设置开机自启](#十三注册-windows-服务并设置开机自启)
14. [防火墙开放端口](#十四防火墙开放端口)
15. [上线验证清单](#十五上线验证清单)
16. [HTTPS 部署（后期切换教程）](#十六https-部署后期切换教程)
17. [日常运维手册](#十七日常运维手册)

---

## 一、架构总览

```
                        用户浏览器
                            │
                    http://wellbiora.com.cn（80 端口）
                            │
                    ┌───────▼────────┐
                    │  Nginx（80）   │  ← 静态文件 + 反向代理
                    └───┬────┬────┬──┘
          /            /api/         /admin/
           │             │              │
   site\h5\静态文件   127.0.0.1:4000   site\admin\静态文件
       （H5商城）      NestJS 后端      （管理后台）
                          │
                    ┌─────▼─────┐
                    │ MySQL 8.4 │  （仅本机 127.0.0.1 可访问）
                    └───────────┘
```

| 端 | 说明 | 运行形态 |
|---|---|---|
| H5 商城前端 | Vue 3 构建出的纯静态文件 | Nginx 直接托管 |
| 后端 server | NestJS，监听 **4000** 端口，接口前缀 `/api/v1` | NSSM 注册为 Windows 服务 |
| 管理后台 admin | Vue 3 构建出的纯静态文件，挂在 `/admin/` 路径 | Nginx 直接托管 |
| MySQL 8.4 | 数据库名 `wellbiora_shop` | MySQL 官方 MSI 安装时自带服务 |

**端口占用规划**（避免冲突）：80 = Nginx；4000 = 后端（只允许本机访问，不对外）；3306 = MySQL（只允许本机访问，不对外）；443 = HTTPS（后期启用）。

---

## 二、软件下载清单

共 5 个必装 + 1 个选装。都可以在本地电脑下载后通过远程桌面复制到服务器。

| # | 软件 | 版本 | 用途 | 下载地址 |
|---|---|---|---|---|
| 1 | **Node.js** | **v22.23.2 LTS**（x64 MSI 安装包） | 运行 NestJS 后端、构建前端 | https://nodejs.org/zh-cn |
| 2 | **Git** | 最新版（64-bit Setup） | 拉取项目代码 | https://git-scm.com/download/win |
| 3 | **MySQL Community Server** | **8.4.11 LTS**（x64 MSI 安装包，约 130M） | 数据库 | https://dev.mysql.com/downloads/mysql/ |
| 4 | **Nginx for Windows** | Stable 稳定版（**zip 包，不要下源码包**） | 静态托管 + 反向代理 | https://nginx.org/en/download.html |
| 5 | **NSSM** | 2.24（zip 包） | 把后端和 Nginx 注册成 Windows 服务、开机自启 | https://nssm.cc/download |
| 6 | 7-Zip（选装） | 最新 x64 | 解压 zip（系统自带能力也够用） | https://www.7-zip.org/ |

**版本说明**：

- Node.js 选 **v22.23.2（22 线最新 LTS）**：与项目 `@types/node ^22` 及所有依赖版本匹配，本指南 NSSM 服务路径、验证命令也按 22 系编写。官网下载页版本下拉框里选带蓝色 **LTS** 标签的 v22.23.2（⚠️ 不要选 Current 线的 v26.x，也不要选已 EOL 的 23/25），然后在页面底部「Windows x64」区域点 **「Windows 安装程序(.msi)」** 下载，得到 `node-v22.23.2-x64.msi`。
- MySQL 选 **8.4**：与项目开发时用的 Docker 镜像 `mysql:8.4` 完全一致，避免版本差异。⚠️ 下载地址是 **https://dev.mysql.com/downloads/mysql/**（MySQL Server 的下载页），**不是** `/downloads/installer/` 那个统一安装器页——统一安装器最高只出到 8.0 系列，8.1 起官方已停止提供，页面上永远看不到 8.4。进入 Server 下载页后：`Select Version` 下拉选 **8.4.11 LTS** → `Select Operating System` 选 **Microsoft Windows** → 下载第一行 **「Windows (x86, 64-bit), MSI Installer」**（129.9M，`mysql-8.4.11-winx64.msi`；不要下 ZIP Archive 和 758.9M 的 debug-test 包）→ 中途弹出登录页点 **「No thanks, just start my download.」** 直接下载，无需注册。
- Nginx 下载 **nginx/Windows-x.x.x** 的 zip，例如 `nginx-1.28.0.zip`。

---

## 三、前置准备

### 3.1 远程桌面连上服务器

本地电脑 `Win + R` 输入 `mstsc`，输入服务器公网 IP + 管理员账号密码连接。以下所有操作都在服务器的远程桌面里进行。

### 3.2 规划目录

在服务器 D 盘建一个统一目录，后面所有东西都放这里。PowerShell 执行：

```powershell
mkdir D:\www\wellbiora\repo
mkdir D:\www\wellbiora\site\h5
mkdir D:\www\wellbiora\site\admin
mkdir D:\www\wellbiora\logs
```

最终结构：

```
D:\www\wellbiora\
├── repo\        # git 仓库（源码）
├── site\
│   ├── h5\      # H5 商城构建产物（Nginx 托管）
│   └── admin\   # 管理后台构建产物（Nginx 托管）
└── logs\        # 后端与 Nginx 日志
```

### 3.3 域名 ICP 备案（✅ 已完成：wellbiora.com.cn，2026-09-04 确认）

域名 `wellbiora.com.cn` 已注册且 **ICP 备案已完成**，80/443 端口可合规对外开放，本节仅作背景保留。

背景：国内服务器按监管要求，**域名必须完成 ICP 备案才能开放 80/443 端口的 Web 服务**，否则运营商会封端口。正式对外（尤其后期接微信支付——微信支付强制要求**已备案域名 + HTTPS**）必须备案完成。本站已满足该前提；后续上线时记得在页面底部展示备案号并链接至工信部备案查询站。

### 3.4 确认 80 端口空闲

Server 2019 全新系统默认没有装 IIS，但保险起见检查一下：

```powershell
netstat -ano | findstr ":80 "
```

- 没有任何输出 → 正常，继续。
- 有输出且 PID 对应 `System`（PID 4）→ 说明启用了 IIS 或 HTTP.sys，先关闭：`dism /online /disable-feature /featurename:IIS-WebServerRole` 后重启。

---

## 四、安装 Node.js

### 4.0 确认：服务器一律用官网 .msi 安装包（不用 winget / nvm / Docker）

Node.js 在 Windows 上有多种安装方式，**本指南统一用官网 `.msi` 安装包**（即第二节下载的 `node-v22.23.2-x64.msi`）。原因：

| 方式 | 服务器上用不用 | 理由 |
|---|---|---|
| **官网 .msi** | ✅ **用这个** | 确定性安装：装完路径固定为 `C:\Program Files\nodejs\`、自动写好 PATH 环境变量，与本文 NSSM 注册服务时填的路径完全一致，排查问题、网上搜答案都能直接对上 |
| winget | ❌ 不用 | **Windows Server 2019 默认没有 winget**（只预装在 Win10/11 桌面版和 Server 2025）。强行装需手动补 .msixbundle + VCLibs + UI.Xaml 三个依赖，多出多个安装失败点，为一个 Node.js 不值得 |
| nvm-windows | ❌ 不用 | 多版本切换适合开发机多项目场景；生产服务器只跑本项目、版本固定 22 LTS，多一层 `nvm use` 忘执行、服务指向错版本的风险 |
| Docker（node:xx-alpine） | ❌ 不用 | 本项目整体为原生安装方案（非容器化），引入 Docker 需 Hyper-V，架构不匹配 |

一句话原则：**开发机装 Node 随意，生产服务器用 MSI**。

### 4.1 安装

1. 双击下载好的 `node-v22.23.2-x64.msi`。
2. 勾选「I accept the terms…」→ **Next**。
3. 安装路径保持默认 `C:\Program Files\nodejs\` → **Next**。
4. ⚠️ 中间出现「Tools for Native Modules」页面（问是否自动装 chocolatey 和编译工具）→ **不用勾选**，直接 Next。本项目全部是纯 JS 依赖，不需要编译工具。
5. 点 **Install** → 完成后 **Finish**。
6. ⚠️ 安装完**关闭所有已打开的 PowerShell 窗口，重新开一个**（否则环境变量不生效）。

### 4.2 验证

```powershell
node -v      # 应输出 v22.23.2
npm -v       # 应输出 10.x.x
```

### 4.3 （推荐）配置国内镜像加速

服务器在国内的话，装依赖会快很多：

```powershell
npm config set registry https://registry.npmmirror.com
npm config get registry    # 确认生效
```

---

## 五、安装 Git

### 5.1 安装

1. 双击 `Git-x.x.x-64-bit.exe`。
2. 一路默认 **Next** 即可。仅有两页建议留意：
   - 「Choosing the default editor」→ 保持默认 Vim 也行，不影响（我们只用命令行 git，不用它编辑）。
   - 「Adjusting your PATH environment」→ 必须保持默认的 **「Git from the command line and also from 3rd-party software」**（已是默认）。
3. **Install** → **Finish**。
4. ⚠️ 重开一个 PowerShell 窗口再验证。

### 5.2 验证

```powershell
git --version    # 应输出 git version 2.x.x
```

---

## 六、安装 MySQL 8.4

### 6.1 安装

1. 双击 `mysql-8.4.11-winx64.msi`。
2. ⚠️ 如果提示缺少「Visual C++ 2019 Redistributable」，安装器界面会提供下载按钮，点它装好再继续。
3. Choosing a Setup Type → 选 **「Server only」**（只装数据库服务器，不需要 Workbench 等工具）→ Next。
4. Check Requirements → 若有黄条提示点「Execute」补齐 → Next。
5. Installation → **Execute** → 等待完成 → Next。安装结束后会自动弹出 **MySQL Configurator**（8.1 起官方用这个配置工具替代了老统一安装器的配置环节），以下步骤 6~10 在 Configurator 界面中完成。
6. Type and Networking：
   - Config Type: **Standalone MySQL Server**
   - 端口保持 **3306**
   - ⚠️ 不要勾选「Open Windows Firewall port for network access」——MySQL 只给本机后端用，**不需要**对外开端口（更安全）。
   - Next。
7. Authentication Method → 保持默认 **「Use Strong Password Encryption (Caching SHA2)」** → Next。
8. ⚠️ **Accounts and Roles：设置 root 密码**。设一个强密码（大小写+数字+符号，建议 16 位以上），**抄到你的密码本里**，丢了只能重置。→ Next。
9. Windows Service：
   - Windows Service Name: 保持默认 `MySQL84`
   - ✅ 勾选 **「Start the MySQL Server at System Startup」**（开机自启，默认已勾）
   - ⚠️ 「Run MySQL Server as... Standard System Account」保持默认（不需要 NT service 账户）。
   - Next。
10. Apply Configuration → **Execute**，全部打绿勾 → Finish → Next 到安装器退出。

### 6.2 把 mysql 命令加入 PATH（方便以后操作）

```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\MySQL\MySQL Server 8.4\bin", "Machine")
```

⚠️ 执行后**重开 PowerShell** 生效。如果以后安装的 MySQL 小版本路径不同，用 `dir "C:\Program Files\MySQL"` 确认实际目录名。

### 6.3 验证

```powershell
mysql -u root -p
# 输入你刚设置的 root 密码，看到 mysql> 提示符即成功
```

### 6.4 创建项目数据库和账号

⚠️ **不要让后端直接用 root**。在 `mysql>` 提示符下执行（先把示例密码换成你自己的强密码）：

```sql
-- 1. 创建数据库（字符集必须是 utf8mb4，支持中文和 emoji）
CREATE DATABASE wellbiora_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 创建专用账号（只允许本机 localhost 登录）
CREATE USER 'wellbiora'@'localhost' IDENTIFIED BY '换成你的强密码';

-- 3. 授权（含 CREATE/ALTER/DROP，因为数据库初始化要跑迁移建表）
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON wellbiora_shop.* TO 'wellbiora'@'localhost';
FLUSH PRIVILEGES;

-- 4. 验证
SHOW DATABASES;            -- 应能看到 wellbiora_shop
SHOW GRANTS FOR 'wellbiora'@'localhost';
EXIT;
```

> 数据库表不用手工建——后面第十节跑 `npm run migration:run` 会自动创建全部 10 张表（用户、验证码、购物车、订单、管理员、审计日志等）。

---

## 七、安装 Nginx

### 7.1 解压

1. 把 `nginx-1.28.0.zip` 复制到 `C:\` 根目录。
2. 右键 → 全部解压（或用 7-Zip），最终得到 `C:\nginx-1.28.0\`。
3. 重命名为 `C:\nginx\`。

⚠️ **路径必须无空格、无中文**，所以放 `C:\nginx\`，不要放「Program Files」或桌面。

### 7.2 首次启动测试

```powershell
cd C:\nginx
.\nginx.exe          # 启动（窗口一闪而过是正常的，它在后台运行）
```

在服务器浏览器（Edge）打开 `http://127.0.0.1`，看到「Welcome to nginx!」即成功。

### 7.3 停止（测试完先停掉，后面配好再启）

```powershell
cd C:\nginx
.\nginx.exe -s quit    # 优雅停止
```

### 7.4 常用命令备查

```powershell
.\nginx.exe -t                 # 检查配置文件语法（改完配置先跑这个）
.\nginx.exe -s reload          # 平滑重载配置（改完配置不用重启服务）
.\nginx.exe -s quit            # 停止
```

---

## 八、安装 NSSM（把程序注册成 Windows 服务）

NSSM（Non-Sucking Service Manager）是个单文件小工具，用来把 `node.exe` 和 `nginx.exe` 注册成 **Windows 服务**，实现：开机自启、崩溃自动拉起、服务器管理器里可启停。

1. 下载 `nssm-2.24.zip` 并解压。
2. 进入 `nssm-2.24\win64\`，把 `nssm.exe` 复制到 `C:\nssm\`（没有这个文件夹就新建一个）。
3. 验证：

```powershell
C:\nssm\nssm.exe version    # 应输出 2.24
```

> MySQL 不需要 NSSM——MSI 安装时已经自带了 Windows 服务（`MySQL84`）。

---

## 九、获取项目代码

### 方式 A：git clone（推荐，以后更新方便）

```powershell
cd D:\www\wellbiora\repo
git clone <你的仓库地址> .
```

仓库地址在你本地开发机上查：`git remote -v`，取 `origin` 后面的 URL（远程仓库名 work-h5-wellbiora-shop）。如果需要账号密码/token，按你托管平台的提示输入。

### 方式 B：直接拷贝（无法联网到 git 仓库时）

在本地开发机把整个 `H5-shop` 文件夹压缩，远程桌面直接拖拽/复制粘贴到服务器 `D:\www\wellbiora\repo\`。
⚠️ 拷贝时**不要**带 `node_modules`、`.env`（本地测试配置）和 `dist`，服务器上会重新安装和构建。另外确认拷贝过来的 `server\.env`、`frontend\.env.local` 等本地配置文件**不要**留在服务器仓库里（第十节会重建生产配置）。

### 验证

```powershell
dir D:\www\wellbiora\repo       # 应能看到 frontend、server、admin、docs 等目录
```

---

## 十、部署后端 server

### 10.1 安装依赖并构建

```powershell
cd D:\www\wellbiora\repo\server
npm ci
npm run build
```

⚠️ 用 `npm ci` 而不是 `npm install --production`：数据库迁移要用到开发依赖（ts-node），依赖必须装全。`npm ci` 严格按照 package-lock 安装，速度更快也更确定。

### 10.2 创建生产配置 .env

⚠️ **`.env` 是敏感文件，绝不提交 git、绝不让前端出现**。新建 `D:\www\wellbiora\repo\server\.env`，内容如下（每项都要替换）：

```ini
# 应用
NODE_ENV=production
PORT=4000
# 跨域来源：前期 HTTP 用 http://wellbiora.com.cn，上 HTTPS 后改成 https://wellbiora.com.cn
CORS_ORIGIN=http://wellbiora.com.cn

# 密钥（下面 10.3 教你生成，必须替换）
JWT_SECRET=<第1条命令生成的随机串>
PERSONAL_DATA_KEY=<第2条命令生成的Base64串>

# 首个管理员：只在 admin_accounts 表为空时自动创建一次
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=<至少12位随机强密码，记到密码本>

# MySQL（对应 6.4 节创建的库和账号）
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=wellbiora
MYSQL_PASSWORD=<6.4节设置的wellbiora账号密码>
MYSQL_DATABASE=wellbiora_shop

# 管理后台登录限频：连续失败5次锁10分钟
ADMIN_LOGIN_MAX_FAILURES=5
ADMIN_LOGIN_LOCK_MINUTES=10
```

⚠️ 三个「不要」：
- **不要**设置 `LOCAL_TEST_MODE=1`（那是无数据库的内存测试模式，重启丢数据）；
- **不要**沿用 `.env.example` 里的占位密钥（后端启动时会直接报错拦截，这是代码里故意做的生产校验）；
- **不要**把 `.env` 权限放开给非管理员用户。

### 10.3 生成两个密钥

在服务器 PowerShell 里执行，把输出值粘贴进 `.env`：

```powershell
# 生成 JWT_SECRET（长随机字符串）
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"

# 生成 PERSONAL_DATA_KEY（32字节密钥的Base64，用于身份证号AES加密）
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

⚠️ `PERSONAL_DATA_KEY` 一旦投入使用就**永远不能换**（换了之后历史身份证密文全部无法解密），生成后请同时抄进线下密码本妥善保存。

### 10.4 初始化数据库（跑迁移建表）

```powershell
cd D:\www\wellbiora\repo\server
npm run migration:run
```

成功标志：输出显示 `10 migrations` 全部 `executed`（create-users、create-sms-verification-tables……admin-order-management）。

⚠️ 此命令会自动读取当前目录的 `.env` 连接数据库，所以必须在 `server` 目录下执行。以后代码有新迁移时重跑这个命令即可，已执行过的不会重复执行。

### 10.5 手动冒烟测试（正式服务化之前先跑通一次）

```powershell
cd D:\www\wellbiora\repo\server
node dist\main.js
```

- 看到类似 `Nest application successfully started` 且无报错 → 保持此窗口，另开一个 PowerShell 测试接口：

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/v1/home
```

能返回 JSON（首页内容块数据）即成功。

- 测试完回到第一个窗口 `Ctrl + C` 停止。

⚠️ 如果报「生产环境缺少配置：xxx」→ 说明 `.env` 有漏填或拼错了变量名；如果数据库连不上 → 检查 6.4 节账号密码。**手动跑通再进入下一步。**

---

## 十一、构建前端 frontend 和管理后台 admin

### 11.1 admin 挂 /admin/ 子路径的代码调整（已于 2026-09-04 内置进仓库，无需再手动改）

管理后台要挂在 `https://wellbiora.com.cn/admin/` 下运行，所需的两处改动**已提交到仓库**，`git pull` 拿到最新代码后直接构建即可：

**① `admin/vite.config.ts`** —— 已加 `base`：

```ts
export default defineConfig({
  base: '/admin/',   // 构建产物所有资源引用自动带上 /admin/ 前缀
  plugins: [vue()],
  // ……以下保持不变
})
```

**② `admin/src/router/index.ts`** —— 路由基路径跟随 vite base：

```ts
// 原来：history: createWebHistory(),
history: createWebHistory(import.meta.env.BASE_URL),   // BASE_URL 即 vite 的 base
```

> 对本地开发的影响：dev server 访问地址变为 `http://localhost:5174/admin/`（根路径会自动跳转过去）。
> H5 商城（frontend）**不需要**改：它用的是 hash 路由（`/#/products` 这种），放根路径直接可用。

### 11.2 构建 H5 商城

```powershell
cd D:\www\wellbiora\repo\frontend
# 显式声明生产环境走真实接口（防止任何环境误开 mock）
Set-Content -Path .env.production -Value "VITE_USE_MOCK=0" -Encoding ascii
npm ci
npm run build
```

> 说明：前端接口地址默认是相对路径 `/api/v1`，由 Nginx 反代到后端 4000，所以**不需要**配置 API 域名。

### 11.3 构建管理后台

```powershell
cd D:\www\wellbiora\repo\admin
npm ci
npm run build
```

### 11.4 把构建产物复制到站点目录

```powershell
# 清空旧文件再复制（-Recurse -Force 直接覆盖同名文件）
Copy-Item D:\www\wellbiora\repo\frontend\dist\* D:\www\wellbiora\site\h5\ -Recurse -Force
Copy-Item D:\www\wellbiora\repo\admin\dist\* D:\www\wellbiora\site\admin\ -Recurse -Force

# 验证
dir D:\www\wellbiora\site\h5       # 应有 index.html、assets\ 等
dir D:\www\wellbiora\site\admin    # 应有 index.html、assets\ 等
```

> 以后每次更新版本，重复 11.2~11.4 即可（见第十七节运维手册）。

---

## 十二、配置 Nginx 站点

### 12.1 编辑配置文件

用记事本打开（PowerShell）：

```powershell
notepad C:\nginx\conf\nginx.conf
```

找到文件里默认的 `server { ... }` 块（`listen 80;` 那个），**整个替换**为下面内容（域名已填好 `wellbiora.com.cn`，直接可用）：

```nginx
    server {
        listen       80;
        server_name  wellbiora.com.cn;

        # ── H5 商城（根路径） ─────────────────────────────
        root  D:/www/wellbiora/site/h5;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # ── 管理后台（/admin/ 子路径） ─────────────────────
        # ⚠️ 必须用 ^~ 前缀匹配：下方静态资源缓存规则是正则匹配，
        #    优先级高于普通前缀，不加 ^~ 会导致 /admin/ 的 js/css 全部 404
        location ^~ /admin/ {
            alias D:/www/wellbiora/site/admin/;
            try_files $uri $uri/ /admin/index.html;
        }

        # ── 后端 API（反向代理到本机 4000） ────────────────
        location ^~ /api/ {
            proxy_pass http://127.0.0.1:4000;
            proxy_set_header Host              $host;
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }

        # 上传体积限制（后台将来传图片用）
        client_max_body_size 10m;

        # 静态资源缓存（带 hash 的文件名可以长缓存）
        location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public";
        }

        # 访问日志
        access_log  logs/wellbiora.access.log;
        error_log   logs/wellbiora.error.log;
    }
```

⚠️ 注意事项：
- Windows 下路径写**正斜杠** `D:/www/...`（如上）。
- `/admin/` 和 `/api/` 两处必须带 **`^~`**（原因见配置内注释）。
- 替换后，文件里原有的默认 `server` 块（含 `location /` 示例和 `50x.html`）要整体删掉，别留下两个 `listen 80` 的 server。

### 12.2 检查并启动

```powershell
cd C:\nginx
.\nginx.exe -t       # 必须显示 syntax is ok / test is successful
.\nginx.exe          # 启动
```

### 12.3 临时验证（还没跑后端服务时的预期表现）

- `http://127.0.0.1/` → H5 首页能打开（此时接口数据可能报错，因为后端还没跑，正常）。
- `http://127.0.0.1/admin/` → 管理后台登录页能打开。
- `http://127.0.0.1/api/v1/home` → 502 Bad Gateway（后端未启动，正常）。

验证完先不停 Nginx，直接进入第十三节。

---

## 十三、注册 Windows 服务并设置开机自启

### 13.1 注册后端服务

⚠️ 关键点：**工作目录必须设为 server 目录**，因为后端通过 dotenv 从当前目录读取 `.env`。

```powershell
# 1. 安装服务（服务名、程序、启动参数）
C:\nssm\nssm.exe install WellbioraServer "C:\Program Files\nodejs\node.exe" "D:\www\wellbiora\repo\server\dist\main.js"

# 2. 设置工作目录（读取 .env 的关键）
C:\nssm\nssm.exe set WellbioraServer AppDirectory D:\www\wellbiora\repo\server

# 3. 日志输出到文件（出问题看这里）
C:\nssm\nssm.exe set WellbioraServer AppStdout D:\www\wellbiora\logs\server-out.log
C:\nssm\nssm.exe set WellbioraServer AppStderr D:\www\wellbiora\logs\server-err.log
C:\nssm\nssm.exe set WellbioraServer AppRotateFiles 1

# 4. 崩溃自动重启
C:\nssm\nssm.exe set WellbioraServer AppExit Default Restart
C:\nssm\nssm.exe set WellbioraServer AppRestartDelay 5000

# 5. 启动
C:\nssm\nssm.exe start WellbioraServer
```

### 13.2 注册 Nginx 服务

```powershell
C:\nssm\nssm.exe install WellbioraNginx "C:\nginx\nginx.exe"
C:\nssm\nssm.exe start WellbioraNginx
```

### 13.3 验证服务

```powershell
# 查看状态（STATE 应为 RUNNING）
Get-Service WellbioraServer, WellbioraNginx, MySQL84
```

三个服务全部 `Running` 即成功。也可以打开「services.msc（服务）」图形界面查看，今后可在图形界面启停。

### 13.4 服务的日常管理

```powershell
C:\nssm\nssm.exe restart WellbioraServer    # 重启后端（更新代码后用）
C:\nssm\nssm.exe stop    WellbioraServer    # 停止
C:\nssm\nssm.exe start   WellbioraServer    # 启动
# Nginx 改完配置只需重载，不用重启服务：
C:\nginx\nginx.exe -s reload
```

---

## 十四、防火墙开放端口

只对外开 80（和后期的 443）。**4000 和 3306 不开**（只允许本机访问，这是安全底线）。

```powershell
# 用管理员 PowerShell 执行
netsh advfirewall firewall add rule name="WELLBIORA-HTTP-80"  dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="WELLBIORA-HTTPS-443" dir=in action=allow protocol=TCP localport=443
```

另外确认云厂商的**安全组**也放行了 80/443（在云控制台网页操作，与系统防火墙是两道独立的门）。

再补一条加固：显式拒绝外网访问数据库和后端端口（双保险）：

```powershell
netsh advfirewall firewall add rule name="BLOCK-3306" dir=in action=block protocol=TCP localport=3306
netsh advfirewall firewall add rule name="BLOCK-4000" dir=in action=block protocol=TCP localport=4000
```

---

## 十五、上线验证清单

备案通过、域名解析生效后，逐项打勾：

| # | 验证项 | 操作 | 预期 |
|---|---|---|---|
| 1 | H5 首页 | 手机/浏览器打开 `http://wellbiora.com.cn` | 首页正常渲染，商品数据加载 |
| 2 | 接口链路 | 首页能出商品即代表 `/api/v1/home` 通了 | 无 Network 报错 |
| 3 | 登录 | 「我的」→ 手机号获取验证码 | ⚠️ 验证码会打印在后端日志（见下方命令），生产短信服务接入前先这样登录测试 |
| 4 | 加购下单 | 详情页加购 → 结算 → 填地址实名 → 创建订单 | 全链路跑通 |
| 5 | 管理后台 | 打开 `http://wellbiora.com.cn/admin/` | 登录页正常 |
| 6 | 管理员登录 | 用 `.env` 里 `ADMIN_INITIAL_*` 登录 | 进入后台 |
| 7 | 后台改价/上下架 | 商品管理里编辑并发布 | H5 端刷新后生效 |
| 8 | 服务自启 | 服务器重启一次，什么都不动 | 三个服务自动 Running，网站直接可用 |

查看后端日志（验证码、报错都在这）：

```powershell
Get-Content D:\www\wellbiora\logs\server-out.log -Tail 50
Get-Content D:\www\wellbiora\logs\server-err.log -Tail 50
```

---

## 十六、HTTPS 部署（后期切换教程）

> 前期用 HTTP 完全可以跑通整站验证。但注意：**接入微信支付前必须上 HTTPS**（微信支付回调地址强制 HTTPS + 备案域名），所以切换要赶在支付联调之前完成。

### 16.1 购买并下载证书

在云厂商（阿里云/腾讯云）或证书品牌商购买 **DV 单域名证书**（几百元/年；各云厂商也提供免费 DV 证书，一年期，可先用免费版过渡）。购买时域名填 `wellbiora.com.cn`，按流程完成 DNS 验证后签发。

下载证书时选择 **Nginx 类型**，得到两个文件：

- `wellbiora.com.cn.pem`（证书链）
- `wellbiora.com.cn.key`（私钥）

### 16.2 放置证书文件

```powershell
mkdir C:\nginx\ssl
# 把两个文件复制进 C:\nginx\ssl\
```

### 16.3 修改 Nginx 配置

编辑 `C:\nginx\conf\nginx.conf`，把原 `server` 块（80）的 `server_name` 部分下方**新增**一个 443 块，并把 80 改为跳转。最终两个块长这样（域名与证书文件名均已按 `wellbiora.com.cn` 填好；若证书下载下来的文件名不同，改成实际文件名即可）：

```nginx
    # ── HTTP：全部跳转到 HTTPS ──
    server {
        listen       80;
        server_name  wellbiora.com.cn;
        return 301 https://$host$request_uri;
    }

    # ── HTTPS：正式站点 ──
    server {
        listen       443 ssl;
        http2        on;
        # ⚠️ `http2 on;` 需要 nginx 1.25.1+（本文推荐的 1.28 稳定版支持）。
        #    如果你的 nginx 较旧，删掉上面这行，把 listen 改成：listen 443 ssl http2;
        server_name  wellbiora.com.cn;

        ssl_certificate      C:/nginx/ssl/wellbiora.com.cn.pem;
        ssl_certificate_key  C:/nginx/ssl/wellbiora.com.cn.key;
        ssl_protocols        TLSv1.2 TLSv1.3;
        ssl_ciphers          HIGH:!aNULL:!MD5;
        ssl_session_cache    shared:SSL:10m;
        ssl_session_timeout  10m;

        # ……以下与原 80 块的 root/try_files/admin/api 配置完全相同，整段复制过来 ……
        root  D:/www/wellbiora/site/h5;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location ^~ /admin/ {
            alias D:/www/wellbiora/site/admin/;
            try_files $uri $uri/ /admin/index.html;
        }

        location ^~ /api/ {
            proxy_pass http://127.0.0.1:4000;
            proxy_set_header Host              $host;
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }

        client_max_body_size 10m;

        location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public";
        }

        access_log  logs/wellbiora.access.log;
        error_log   logs/wellbiora.error.log;
    }
```

### 16.4 生效并收尾

```powershell
cd C:\nginx
.\nginx.exe -t          # 语法检查
.\nginx.exe -s reload   # 平滑重载，不断线
```

然后**别忘了改后端跨域配置**：

```powershell
# 编辑 D:\www\wellbiora\repo\server\.env，把
# CORS_ORIGIN=http://wellbiora.com.cn
# 改为
# CORS_ORIGIN=https://wellbiora.com.cn
C:\nssm\nssm.exe restart WellbioraServer
```

验证：浏览器打开 `https://wellbiora.com.cn`，地址栏出现锁图标；`http://` 访问会自动跳到 `https://`。

### 16.5 证书每年到期续办

证书有效期 1 年，到期前云厂商会短信/邮件提醒。续签后下载新文件覆盖 `C:\nginx\ssl\` 里的两个文件，执行 `.\nginx.exe -s reload` 即可，其他都不用动。

---

## 十七、日常运维手册

### 17.1 版本更新发布流程（最常用）

后端有改动时：

```powershell
cd D:\www\wellbiora\repo
git pull
cd server
npm ci
npm run build
npm run migration:run          # 有新迁移时执行，没有则自动跳过
C:\nssm\nssm.exe restart WellbioraServer
```

前端/后台有改动时：

```powershell
cd D:\www\wellbiora\repo
git pull
cd frontend ; npm ci ; npm run build
Copy-Item dist\* D:\www\wellbiora\site\h5\ -Recurse -Force
cd ..\admin ; npm ci ; npm run build
Copy-Item dist\* D:\www\wellbiora\site\admin\ -Recurse -Force
# 静态文件即改即生效，无需重启任何服务
```

### 17.2 日志排查

```powershell
# 后端日志（报错、开发验证码）
Get-Content D:\www\wellbiora\logs\server-err.log -Tail 100

# Nginx 访问/错误日志
Get-Content C:\nginx\logs\wellbiora.error.log -Tail 100
Get-Content C:\nginx\logs\wellbiora.access.log -Tail 100
```

### 17.3 数据库备份（每天，强烈建议）

手动备份一次：

```powershell
mysqldump -u wellbiora -p --single-transaction wellbiora_shop > D:\www\wellbiora\logs\backup-$(Get-Date -Format "yyyyMMdd").sql
```

自动每天备份：打开「任务计划程序」→ 创建基本任务 → 名称 `MySQL每日备份` → 每天 03:00 → 启动程序：
- 程序：`C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe`
- 参数：`-uwellbiora -p你的密码 --single-transaction wellbiora_shop > D:\www\wellbiora\logs\backup.sql`（⚠️ 密码明文出现在参数里，仅限内网测试期临时用；正式运营建议改用 mysql_config_editor 或至少把备份脚本放受限目录）

更好的做法是写一个 `backup.ps1` 脚本（备份后压缩、保留最近 30 份、下载到本地一份异地存放——**身份证号虽是密文存储，但备份文件同样要当敏感数据保管**）。

### 17.4 服务状态速查

```powershell
Get-Service WellbioraServer, WellbioraNginx, MySQL84
netstat -ano | findstr ":80 :4000 :3306"     # 端口监听检查
```

---

## 附：上线前待办提醒（来自项目文档的非环境事项）

环境装好后，以下事项属于业务对接，别漏：

1. ~~域名 ICP 备案~~（✅ 已完成：wellbiora.com.cn，见 3.3）。
2. 微信支付商户号申请 + 报关接口确认（付费证书与 HTTPS 需在此之前完成）。
3. 君梦 OMS 测试环境参数（appId/appSecret/shopId/warehouseNo）。
4. 生产短信服务商接入（当前验证码只打印在服务端日志，仅供内部测试，不能对外运营）。
5. 4 款商品的真实价格、仓库 goods_no 与效期/批次信息。
6. `PERSONAL_DATA_KEY` 与 root 密码等抄录线下密码本。

---

*文档版本：2026-09-05 v1.2 · 依据仓库当前 main 分支配置编写（server 端口 4000 / 接口前缀 /api/v1 / MySQL 8.4 / 10 个数据库迁移）。v1.1：填入真实域名 wellbiora.com.cn；ICP 备案标记已完成；11.1 节 admin 子路径改动已内置进仓库代码。v1.2：修正 MySQL 下载入口——统一安装器页只到 8.0，改为 MySQL Server 下载页（dev.mysql.com/downloads/mysql/）的 8.4.11 LTS x64 MSI（mysql-8.4.11-winx64.msi）*
