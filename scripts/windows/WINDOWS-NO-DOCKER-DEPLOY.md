# Windows 无 Docker 部署说明

本文适用于以下场景：

- 新电脑上已经装好了 Node.js，但 Docker 拉镜像失败
- 希望先在 Windows 上把系统跑起来
- 后续以“能长期稳定使用”为目标，而不是只做本地开发

本文基于当前仓库结构：

- `drift-book-lite/backend`：后端，Express + Prisma + SQLite
- `drift-book-lite/frontend`：学生端，React + Vite
- `drift-book-lite/admin-frontend`：管理端，React + Vite

## 一句话结论

不用 Docker 也能部署。

如果你使用的是打包好的本地完整包，优先使用脚本：

1. 双击 `scripts\windows\deploy-local-with-data.bat` 完成首次部署
2. 后续双击 `scripts\windows\start-local-services.bat` 日常启动
3. 需要备份数据时双击 `scripts\windows\backup-local-data.bat`

最直接的方式是：

1. 在 `backend` 启动后端
2. 在 `frontend` 构建学生端并发布到 `5174`
3. 在 `admin-frontend` 构建管理端并发布到 `5175`

第一次部署时，确实需要分别进入 3 个目录执行命令。

## 先决条件

建议准备：

- Windows 10 / 11
- Node.js 22 LTS
- 已将 Node.js 加入系统 PATH
- 可正常运行 `node -v` 和 `npm -v`

建议用 `cmd` 或在 PowerShell 中显式使用 `npm.cmd` / `npx.cmd`。

如果 PowerShell 报错“在此系统上禁止运行脚本”，不要直接用：

```powershell
npm install
```

改用：

```powershell
npm.cmd install
npx.cmd prisma generate
```

## 先确认部署电脑 IP

在 Windows 执行：

```cmd
ipconfig
```

如果你看到多个网卡：

- 用真正连接学校宽带的那张物理网卡 IPv4
- 不要用 `vEthernet (WSL)`、`Hyper-V`、虚拟网卡的地址

例如真实地址是：

```text
10.11.23.45
```

后面文档里的示例都用这个地址。

## 目录 1：后端部署

进入后端目录：

```cmd
cd /d D:\your-path\library-management-system\drift-book-lite\backend
```

复制环境变量：

```cmd
copy .env.example .env
```

把 `.env` 改成类似这样：

```env
DATABASE_URL="file:./dev.db"
PORT=8080
JWT_SECRET="replace-with-a-long-random-string"
ADMIN_USERNAMES="admin1,admin2,admin3"
ADMIN_PASSWORD="replace-with-a-strong-password"
APP_BASE_URL="http://10.11.23.45:5174"
ADMIN_APP_BASE_URL="http://10.11.23.45:5175"
DEFAULT_SITE_ASSETS_DIR="D:/your-path/library-management-system/drift-book-lite/resources/default-site-assets"
DEFAULT_SENSITIVE_WORDS_DIR="D:/your-path/library-management-system/drift-book-lite/resources/default-sensitive-words"
```

说明：

- `DATABASE_URL`：SQLite 数据库文件
- `PORT`：后端端口，默认 `8080`
- `JWT_SECRET`：必须改成自己的随机字符串
- `ADMIN_PASSWORD`：必须改掉默认密码
- `APP_BASE_URL`：学生端访问地址
- `ADMIN_APP_BASE_URL`：管理端访问地址，后端默认会把它加入允许的 CORS 来源
- `DEFAULT_SITE_ASSETS_DIR`：指向 `drift-book-lite/resources/default-site-assets`
- `DEFAULT_SENSITIVE_WORDS_DIR`：指向 `drift-book-lite/resources/default-sensitive-words`

补充说明：

- 管理端“站点素材”页里显示的默认素材目录提示，来自后端当前运行环境，不是前端写死文案。
- 在 Windows 无 Docker 部署时，这里会显示你本机 `.env` 里配置的真实目录。
- 只要换电脑后把 `DEFAULT_SITE_ASSETS_DIR` 改成新机器上的实际路径，页面提示会自动跟着变化。

安装并初始化：

```cmd
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma db push
```

启动后端：

```cmd
npm.cmd run start
```

看到服务启动后，可在本机测试：

```cmd
curl http://127.0.0.1:8080/api/health
```

## 目录 2：学生端部署

进入学生端目录：

```cmd
cd /d D:\your-path\library-management-system\drift-book-lite\frontend
```

复制环境变量：

```cmd
copy .env.example .env
```

把 `.env` 改成：

```env
VITE_API_BASE_URL=http://10.11.23.45:8080/api
```

安装并构建：

```cmd
npm.cmd install
npm.cmd run build
```

临时发布：

```cmd
npm.cmd run preview -- --host 0.0.0.0 --port 5174
```

## 目录 3：管理端部署

进入管理端目录：

```cmd
cd /d D:\your-path\library-management-system\drift-book-lite\admin-frontend
```

复制环境变量：

```cmd
copy .env.example .env
```

把 `.env` 改成：

```env
VITE_API_BASE_URL=http://10.11.23.45:8080/api
```

安装并构建：

```cmd
npm.cmd install
npm.cmd run build
```

临时发布：

```cmd
npm.cmd run preview -- --host 0.0.0.0 --port 5175
```

## 首次验证

启动完成后，在部署电脑本机访问：

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端健康检查：`http://localhost:8080/api/health`

在局域网其他设备访问：

- 学生端：`http://10.11.23.45:5174`
- 管理端：`http://10.11.23.45:5175`
- 后端健康检查：`http://10.11.23.45:8080/api/health`

如果本机能开，其他设备打不开，优先检查 Windows 防火墙是否放行：

- `8080`
- `5174`
- `5175`

首次进入管理端后，建议再验证两项：

- “站点素材”页能看到当前默认目录，并与 `.env` 中的 `DEFAULT_SITE_ASSETS_DIR` 一致
- “敏感词库”页可执行“导入内置词库”，把仓库内置的 7 类默认词条导入数据库

## 为什么需要 3 个窗口

因为现在不是 Docker 部署，而是 3 个独立进程：

- 后端：一个长期运行进程
- 学生端静态服务：一个长期运行进程
- 管理端静态服务：一个长期运行进程

所以首次部署时，最简单的方式就是开 3 个命令窗口分别运行。

## 长期稳定使用建议

如果只是先验证功能，直接开 3 个窗口就够。

如果要长期放在学校电脑上稳定使用，建议按下面做。

### 1. 不要用前端开发模式

不要长期使用：

```cmd
npm.cmd run dev
```

长期使用要坚持：

```cmd
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0 --port 5174
```

和：

```cmd
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0 --port 5175
```

原因：

- `vite dev` 适合开发，不适合正式长期运行
- `build + preview` 更稳定，也更接近正式部署

### 2. 给部署电脑固定 IP

前端写入的 API 地址是构建时固定进去的。

如果电脑 IP 从 `10.11.23.45` 变成别的地址，需要重新修改：

- `drift-book-lite/frontend/.env`
- `drift-book-lite/admin-frontend/.env`

然后重新执行：

```cmd
npm.cmd run build
```

### 3. 数据备份

不用 Docker 后，最关键的持久化数据通常在这些位置：

- `drift-book-lite/backend/dev.db`
- `drift-book-lite/backend/uploads/`
- `drift-book-lite/resources/default-site-assets/`
- 各目录下实际使用的 `.env`

至少要定期备份这些内容。

### 4. 不要随意删数据库文件

下面这些操作风险高：

- 删除 `drift-book-lite/backend/dev.db`
- 删除 `drift-book-lite/backend/uploads/`
- 换电脑时只复制代码，不复制数据库和上传文件

### 5. 建议固定 Node 版本

建议长期使用 `Node.js 22`。

不要今天用一个版本、过几天又换另一个版本，否则排查问题会更麻烦。

### 6. 如果以后要常驻运行，再引入进程托管

Windows 上如果要做到“关掉窗口后还能继续跑、重启后自动恢复”，就需要再加一层进程托管。

常见思路是：

- 用 PM2 做进程管理
- 或用 Windows 服务方式托管
- 或换到 Linux 服务器上再做正式部署

当前仓库先给出的是“无 Docker、先稳定跑起来”的最小路径；如果后续确定要长期常驻，再单独补进程托管方案会更稳。

## 常见问题

### 1. PowerShell 提示“在此系统上禁止运行脚本”

不要直接用：

```powershell
npm install
```

改用：

```powershell
npm.cmd install
npx.cmd prisma generate
```

或者直接使用 Windows `cmd`。

### 2. 页面能打开，但数据加载失败

大概率是前端 `.env` 里的：

```env
VITE_API_BASE_URL
```

还写成了 `localhost`。

应改成部署机真实 IP，例如：

```env
VITE_API_BASE_URL=http://10.11.23.45:8080/api
```

改完后要重新：

```cmd
npm.cmd run build
```

### 3. 本机能访问，其他设备不能访问

通常是以下原因：

- Windows 防火墙没有放行 `8080`、`5174`、`5175`
- 电脑 IP 变了
- 使用了虚拟网卡 IP
- 其他设备和部署电脑不在同一局域网

## 推荐启动顺序

日常开机后建议按这个顺序：

1. 启动后端
2. 启动学生端静态服务
3. 启动管理端静态服务
4. 在浏览器验证健康检查和两个前端页面

## 推荐维护顺序

以后如果你修改了后端代码：

1. 进入 `backend`
2. 重新启动后端

如果你修改了学生端或管理端：

1. 进入对应前端目录
2. 重新执行 `npm.cmd run build`
3. 重启对应静态服务

## 懒人启动方式

仓库根目录提供了 5 个 Windows 启动脚本：

- `start-all.bat`
- `start-backend.bat`
- `start-frontend.bat`
- `start-admin.bat`
- `build-frontends.bat`

用法：

1. 首次部署或前端代码有变更时，先双击 `build-frontends.bat`
2. 日常启动时，直接双击 `start-all.bat`
3. 如果只想单独重启某个服务，就双击对应的单独脚本

说明：

- 这些脚本都按仓库根目录的相对路径工作
- `start-all.bat` 会打开 3 个独立窗口
- 如果前端构建目录 `dist` 不存在，前端脚本会提示先执行 `build-frontends.bat`
