# Drift Book Lite

“一本书的漂流”校园阅读活动系统交付仓库，包含学生端、管理端、后端服务，以及图书导入样例和站点素材。

这份 README 以“在一台全新电脑上完成部署，并让局域网内其他设备可访问”为主场景编写。  
如果你只是本地开发，可以直接跳到“本地开发”一节。

## 一句话结论

如果目标是在一台什么都没装的新电脑上尽快部署并在局域网访问，推荐只走这一条路径：

1. 安装 Docker Desktop 或 Docker Engine + Docker Compose
2. 把项目拷到部署电脑
3. 查出这台电脑的局域网 IP，例如 `192.168.1.50`
4. 修改根目录 `.env`，把前端 API 地址从 `localhost` 改成这台机器的局域网 IP
5. 执行 `docker compose up --build -d`
6. 在局域网其他设备访问：
   - 学生端：`http://192.168.1.50:5174`
   - 管理端：`http://192.168.1.50:5175`

最容易踩坑的一点：

- 如果 `FRONTEND_API_BASE_URL` 和 `ADMIN_FRONTEND_API_BASE_URL` 还写着 `http://localhost:8080/api`，那么只有部署机器自己能正常调用后端，局域网其他设备打开页面后会请求它们自己的 `localhost:8080`，结果就是页面能打开，但数据加载失败。
- 如果 `APP_BASE_URL` 和 `ADMIN_APP_BASE_URL` 还写着 `http://localhost:5174/5175`，后端默认 CORS 也会继续把局域网访问当成跨域拒绝，结果就是页面能打开，但登录、搜索、提交留言都会失败。

## 先确认一件事：学生留言数据不会随意丢

按当前实现，学生留言不是存在浏览器本地，也不是存在前端缓存，而是写入后端 SQLite 数据库中的 `BookReview` 表。

只要你是正常使用下面这些操作，留言通常不会丢：

- 正常提交学生留言
- 正常审核、隐藏、驳回留言
- 正常执行 `docker compose down`
- 正常执行 `docker compose up -d`
- 正常重启部署电脑
- 正常删除图书导入批次

为什么可以这样判断：

- 留言保存在后端数据库，不依赖浏览器本地存储
- `docker-compose.yml` 已把数据库挂到持久卷 `backend_data`
- 上传素材挂到持久卷 `backend_uploads`
- 后端测试已经覆盖“删除导入批次后仍保留留言/迁移留言”的场景

真正会导致数据丢失的高风险操作主要是这些：

- 手动删除 Docker volume
- 手动删除 SQLite 数据文件
- 迁移到新电脑时只拷代码，不迁移数据库和上传目录
- 在空环境上重新部署后，直接把它当成原系统继续使用
- 用清空数据的方式重建 Docker 数据目录

一句话理解：

- 正常停机、重启、重建容器，一般不会丢留言
- 删卷、删库、迁移不带数据，才会真的丢

## 系统组成

本项目分为 3 个运行模块：

- 学生端：读者搜索图书、查看详情、提交评语
- 管理端：管理员登录、导入书目、审核评语、维护站点素材
- 后端：提供 API、管理 SQLite 数据库、托管上传文件

## 目录结构

```text
.
├── drift-book-lite/
│   ├── frontend/         # 学生端 React + Vite
│   ├── admin-frontend/   # 管理端 React + Vite
│   ├── backend/          # Express + Prisma + SQLite
│   └── resources/
│       ├── default-site-assets/      # 默认首页图片（Logo、轮播图）
│       └── default-sensitive-words/  # 默认敏感词快照
├── docker-compose.yml    # 推荐部署方式
├── .env.example          # 根目录部署环境变量模板
├── 图书信息.csv
└── 图书馆7楼流通室数据.xlsx
```

## 功能概览

### 学生端

- 展示学校 Logo、轮播图和活动流程
- 按书名关键词搜索图书
- 查看图书详情和已审核评语
- 提交新的阅读评语

### 管理端

- 管理员账号登录
- 导入 CSV 或 XLSX 图书目录
- 查看导入批次、失败行和导入统计
- 修改图书信息
- 审核、隐藏、驳回评语
- 维护敏感词库并导入内置默认词条
- 上传 Logo、轮播图
- 重新载入默认首页图片

### 后端

- 提供公开接口 `/api/*`
- 提供受保护的管理接口 `/api/admin/*`
- 使用 Prisma 操作 SQLite
- 对外提供 `/uploads` 静态资源
- 首次启动自动初始化管理员账号和站点配置

## 推荐部署方式：Docker Compose

这是最适合“全新电脑、尽量少装依赖、方便搬迁”的方式。

如果学校网络导致 Docker 拉镜像困难，也可以改走 Windows 无 Docker 部署，见：

- [WINDOWS-NO-DOCKER-DEPLOY.md](/Users/linics/Documents/githubfiles/library-management-system/WINDOWS-NO-DOCKER-DEPLOY.md)

### 1. 部署电脑最低要求

建议准备：

- 一台能联网的电脑
- 64 位操作系统
- 至少 4 GB 内存
- 至少 5 GB 可用磁盘空间
- Docker Desktop
  - Windows / macOS：推荐直接安装 Docker Desktop
  - Linux：安装 Docker Engine 和 Docker Compose 插件

可选但推荐：

- Git
  - 如果不装 Git，也可以把整个项目目录复制过去，或下载 zip 后解压

### 2. 在新电脑安装 Docker

#### Windows / macOS

1. 安装 Docker Desktop
2. 启动 Docker Desktop
3. 确认状态为 Running

验证命令：

```bash
docker --version
docker compose version
```

#### Linux

安装 Docker Engine 和 Compose 插件后，验证：

```bash
docker --version
docker compose version
```

如果当前用户没有 Docker 权限，命令前加 `sudo`。

### 3. 国内网络建议：安装 Docker 和加速拉镜像是两件事

这两件事不要混在一起：

- 安装 Docker 本体：是把 Docker Desktop 或 Docker Engine 装到电脑上
- 配置镜像加速：是让后续 `docker pull` / `docker compose up --build` 拉镜像更快

推荐做法：

- Docker Desktop 安装包优先使用 Docker 官方下载地址
- 如果当前网络下载 Docker Desktop 本体困难，可以先在另一台能正常访问官方站点的电脑下载好安装包，再拷贝到部署电脑安装
- 国内更常见的“镜像加速”主要解决的是拉取容器镜像慢，不是 Docker 安装器本身的下载问题

### 4. 国内网络建议：给 Docker 配置镜像加速

Docker 官方支持通过 `registry-mirrors` 配置镜像加速。

#### Docker Desktop

Docker 官方文档说明，Docker Desktop 可以在设置里的 Docker Engine JSON 中配置守护进程；配置文件位置为：

- Docker Desktop：`$HOME/.docker/daemon.json`

你可以在 Docker Desktop 图形界面的 `Settings` -> `Docker Engine` 中直接编辑，也可以手动编辑对应 JSON。

示例：

```json
{
  "registry-mirrors": [
    "https://<your-mirror-host>"
  ]
}
```

修改后点击 `Apply` 或重启 Docker Desktop。

如果你暂时没有云厂商控制台里的专属加速地址，可以先用一个公开可访问的 Docker Hub 镜像加速地址做应急验证：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
```

仓库里也提供了一个可直接参考的完整示例文件：

- `docker-daemon.daocloud.example.json`

说明：

- 这是 Docker Engine 的守护进程配置示例，不是项目 `.env`
- 该地址用于加速 `docker.io` 镜像拉取
- 公开镜像服务存在容量、限流、同步延迟等不确定性，更适合“先拉起部署验证”
- 如果学校网络后续长期使用，仍建议换成你自己的云厂商专属加速地址或内网缓存服务

#### Linux 上的 Docker Engine

Docker 官方文档说明，普通 Linux 安装的守护进程配置文件一般在：

- `/etc/docker/daemon.json`

示例：

```json
{
  "registry-mirrors": [
    "https://<your-mirror-host>"
  ]
}
```

然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

#### 国内常见镜像加速方式

你可以使用以下任一方式：

- 云厂商提供的个人镜像加速器
- 自建 Docker Hub pull-through cache
- 公司或学校内网已有的私有镜像缓存服务

如果你使用阿里云 ACR：

- 可以在控制台获取你自己的镜像加速地址，再填入 `registry-mirrors`
- 但阿里云当前文档已经明确提示：其官方镜像加速器已停止同步最新镜像，且更偏向个人开发场景
- 如果你对镜像新鲜度和稳定性要求高，建议优先考虑自建镜像缓存、企业镜像仓库，或其他更稳定的镜像获取方案

如果你不确定该填什么，最稳的做法是：

- 先不配镜像加速，直接验证是否能成功拉镜像
- 拉取过慢或失败时，再补充 `registry-mirrors`

### 5. 准备项目文件

把仓库放到目标电脑，例如：

```bash
git clone https://github.com/linics/drift-book-lite.git
cd drift-book-lite
```

如果仓库未来改为私有仓库，则有 3 种做法：

- 先登录 GitHub，再执行 `git clone`
- 使用带权限的 HTTPS / SSH 地址克隆
- 不依赖 Git，直接把整个项目目录复制到新电脑

如果新电脑完全不想安装 Git，也可以直接把项目目录整体拷过去，然后进入项目根目录。

### 6. 获取部署电脑的局域网 IP

这一步很关键，后面前端配置会用到。

#### Windows

```bash
ipconfig
```

找到当前网卡的 IPv4 地址，例如：

```text
IPv4 Address. . . . . . . . . . . : 192.168.1.50
```

#### macOS / Linux

可尝试：

```bash
ifconfig
```

或：

```bash
ip addr
```

找到当前局域网网卡的 IP，例如 `192.168.1.50`。

建议：

- 尽量给部署电脑固定 IP，或在路由器里做 DHCP 保留
- 因为前端的 API 地址是在构建时写进去的，如果部署电脑 IP 变了，需要改 `.env` 后重新构建前端容器

### 7. 配置根目录 `.env`

先复制模板：

```bash
cp .env.example .env
```

然后编辑根目录 `.env`。

如果部署电脑的局域网 IP 是 `192.168.1.50`，推荐这样写：

```env
BACKEND_PORT=8080
FRONTEND_PORT=5174
ADMIN_FRONTEND_PORT=5175

JWT_SECRET=please-change-this-to-a-long-random-string
ADMIN_USERNAMES=admin1,admin2,admin3
ADMIN_PASSWORD=please-change-this-password

APP_BASE_URL=http://192.168.1.50:5174
ADMIN_APP_BASE_URL=http://192.168.1.50:5175
FRONTEND_API_BASE_URL=http://192.168.1.50:8080/api
ADMIN_FRONTEND_API_BASE_URL=http://192.168.1.50:8080/api
```

说明：

- `BACKEND_PORT`：后端开放给浏览器访问的端口
- `FRONTEND_PORT`：学生端页面端口
- `ADMIN_FRONTEND_PORT`：管理端页面端口
- `JWT_SECRET`：必须改成你自己的随机字符串
- `ADMIN_USERNAMES` / `ADMIN_PASSWORD`：初始管理员账号列表和默认密码
- `APP_BASE_URL` / `ADMIN_APP_BASE_URL`：学生端、管理端页面本身的访问地址，后端默认会用它们生成允许的 CORS 来源
- `FRONTEND_API_BASE_URL`：学生端页面里写死的 API 地址，局域网部署时必须写成部署机 IP
- `ADMIN_FRONTEND_API_BASE_URL`：管理端页面里写死的 API 地址，局域网部署时也必须写成部署机 IP

### 8. 启动服务

在项目根目录执行：

```bash
docker compose up --build -d
```

首次启动会做这些事情：

- 构建后端镜像
- 构建学生端镜像
- 构建管理端镜像
- 初始化 SQLite 数据库
- 创建默认管理员账号
- 创建站点素材配置

查看运行状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

### 9. 访问地址

假设部署电脑 IP 为 `192.168.1.50`：

#### 在部署电脑自己访问

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端健康检查：`http://localhost:8080/api/health`

#### 在局域网其他电脑、平板、手机访问

- 学生端：`http://192.168.1.50:5174`
- 管理端：`http://192.168.1.50:5175`
- 后端健康检查：`http://192.168.1.50:8080/api/health`

默认管理员账号：

- 用户名：`admin`
- 密码：你在 `.env` 中配置的 `ADMIN_PASSWORD`

### 10. 放行防火墙端口

如果局域网其他设备打不开，多半是防火墙没有放行。

需要放行这些 TCP 端口：

- `5174`：学生端
- `5175`：管理端
- `8080`：后端 API

至少要确保局域网能访问这 3 个端口。

如果你只想让别人访问页面，不想直接暴露后端，也可以后续自行加反向代理做统一入口；但当前项目默认部署就是开放这 3 个端口。

### 11. 验证部署是否成功

在部署电脑上执行：

```bash
curl http://127.0.0.1:8080/api/health
```

预期返回类似：

```json
{"ok":true,"projectRoot":"..."}
```

然后在浏览器中验证：

- 学生端页面能打开
- 管理端页面能打开
- 管理端能登录
- 学生端搜索图书能返回结果
- 管理端能看到导入与素材管理页面

### 12. 常用运维命令

启动：

```bash
docker compose up -d
```

重建并启动：

```bash
docker compose up --build -d
```

停止：

```bash
docker compose down
```

查看日志：

```bash
docker compose logs -f
```

只重启后端：

```bash
docker compose restart backend
```

### 13. 数据持久化、备份与恢复

Docker Compose 会创建两个卷：

- `backend_data`：SQLite 数据库
- `backend_uploads`：上传后的站点素材

此外：

- `drift-book-lite/resources/default-site-assets/` 会只读挂载到后端容器，作为默认首页图片来源

备份时至少保留：

- 项目根目录下的 `.env`
- Docker 卷中的数据库和上传文件
- `drift-book-lite/resources/default-site-assets/` 目录

#### 哪些动作通常是安全的

- `docker compose down`
- `docker compose up -d`
- `docker compose up --build -d`
- `docker compose restart backend`
- 重启部署电脑

这些动作会停止、重建、重启容器，但默认不会清空 `backend_data` 和 `backend_uploads` 这两个卷。

#### 哪些动作有真实的数据丢失风险

- `docker compose down -v`
- 手动删除 Docker volume
- 手动清空 Docker 数据目录
- 新机器部署时只拷代码，不恢复旧卷数据
- 删除数据库文件后重新启动系统

`docker compose down -v` 会删除卷；如果你没有备份，这一步就可能把留言、导入记录和站点素材一起删掉。

#### 最小备份原则

如果你只想保证系统可恢复，至少备份这些内容：

- `.env`
- `backend_data`
- `backend_uploads`
- `drift-book-lite/resources/default-site-assets/`

#### 最小恢复原则

迁移到新电脑或系统恢复时，顺序建议是：

1. 恢复项目代码
2. 恢复 `.env`
3. 恢复数据库卷和上传卷
4. 确认局域网 IP 是否变化
5. 如 IP 变化，修改 `APP_BASE_URL`、`ADMIN_APP_BASE_URL`、`FRONTEND_API_BASE_URL` 和 `ADMIN_FRONTEND_API_BASE_URL`
6. 执行：

```bash
docker compose up -d
```

如果你改了前端 API 地址，则执行：

```bash
docker compose up --build -d
```

### 14. 升级或更换部署电脑

如果你以后要升级代码或把系统迁移到另一台电脑，建议顺序：

1. 备份数据库和上传目录
2. 备份 `.env`
3. 更新代码
4. 如果部署机 IP 变化，修改 `.env` 中这四个变量：
   - `APP_BASE_URL`
   - `ADMIN_APP_BASE_URL`
   - `FRONTEND_API_BASE_URL`
   - `ADMIN_FRONTEND_API_BASE_URL`
5. 重新执行：

```bash
docker compose up --build -d
```

## 环境变量说明

### 根目录 `.env`

| 变量 | 说明 | 示例 |
|------|------|------|
| `BACKEND_PORT` | 后端对外端口 | `8080` |
| `FRONTEND_PORT` | 学生端对外端口 | `5174` |
| `ADMIN_FRONTEND_PORT` | 管理端对外端口 | `5175` |
| `JWT_SECRET` | JWT 签名密钥 | `replace-with-random-secret` |
| `ADMIN_USERNAMES` | 管理员用户名列表 | `admin1,admin2,admin3` |
| `ADMIN_PASSWORD` | 管理员密码 | `replace-with-strong-password` |
| `APP_BASE_URL` | 学生端页面地址 | `http://192.168.1.50:5174` |
| `ADMIN_APP_BASE_URL` | 管理端页面地址 | `http://192.168.1.50:5175` |
| `FRONTEND_API_BASE_URL` | 学生端构建时写入的 API 地址 | `http://192.168.1.50:8080/api` |
| `ADMIN_FRONTEND_API_BASE_URL` | 管理端构建时写入的 API 地址 | `http://192.168.1.50:8080/api` |

### `drift-book-lite/backend/.env`

这是本地开发后端时使用的配置，Docker Compose 部署通常不需要你单独编辑它。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Prisma 使用的 SQLite 地址 | `file:./dev.db` |
| `PORT` | 后端监听端口 | `8080` |
| `JWT_SECRET` | JWT 密钥 | `change-this-secret` |
| `ADMIN_USERNAMES` | 管理员用户名列表 | `admin1,admin2,admin3` |
| `ADMIN_PASSWORD` | 管理员密码 | `change-this-password` |
| `APP_BASE_URL` | 学生端地址 | `http://localhost:5174` |
| `ADMIN_APP_BASE_URL` | 管理端地址 | `http://localhost:5175` |
| `DEFAULT_SITE_ASSETS_DIR` | 默认首页图片目录路径 | `drift-book-lite/resources/default-site-assets` |
| `DEFAULT_SENSITIVE_WORDS_DIR` | 默认敏感词目录路径 | `drift-book-lite/resources/default-sensitive-words` |

## 图书导入与素材

### 图书目录导入

后端支持两种导入格式：

- CSV：至少包含 `book_id`、`title`、`author`、`publisher`、`total_copies`、`available_copies`
- XLSX：支持中文列名和多种别名，如“控制号”“书名”“责任者”“出版社”“条形码”等

管理端支持两种导入模式：

- `create_only`：只新增，不覆盖已有图书
- `upsert`：已存在则更新

仓库自带样例文件：

- [图书信息.csv](/Users/linics/Documents/githubfiles/library-management-system/图书信息.csv)
- [图书馆7楼流通室数据.xlsx](/Users/linics/Documents/githubfiles/library-management-system/图书馆7楼流通室数据.xlsx)

### 站点素材

- `drift-book-lite/resources/default-site-assets/` 可以存放学校 Logo 和首页轮播原图
- 文件命名约定：`logo.*` 作为学校 Logo，`carousel-01.*`、`carousel-02.*` 按顺序作为首页轮播图
- 系统启动时会自动补齐缺失的 Logo 或轮播图
- 管理端可调用“重新载入默认素材”恢复默认首页图片
- 管理端显示的“当前默认目录”来自后端运行环境：Docker Compose 下通常是容器内路径 `/app/resources/default-site-assets`，无 Docker 部署时显示本机实际目录
- 只要 `DEFAULT_SITE_ASSETS_DIR` 配置正确，其他部署电脑会自动显示各自环境中的路径提示
- 最终访问资源通过 `/uploads` 暴露

### 默认敏感词词库

- 项目内置默认词库目录：`drift-book-lite/resources/default-sensitive-words/`
- 当前默认快照采用中度扩容范围，共 7 类：广告、色情、涉枪涉爆、非法网址、暴恐、补充、贪腐
- 后端会读取该目录下所有 `.txt` 文件；导入时执行 `NFKC + trim + lowercase` 归一化并按归一化结果去重
- 管理端“敏感词库”页可调用“导入内置词库”把默认词条写入数据库
- 管理端敏感词列表支持搜索与分页加载，避免词库扩大后一次性加载全部词条
- 内置快照随项目代码一起部署，不依赖目标机器在运行时访问 GitHub
- 默认快照不包含政治类型、反动词库、民生词库、新思想启蒙、GFW 补充、零时-Tencent、网易前端过滤敏感词库等高误判或大杂包类别
- 如需替换默认目录，可在后端设置 `DEFAULT_SENSITIVE_WORDS_DIR`
- 上游来源与快照说明见 [SOURCES.md](/Users/linics/Documents/githubfiles/library-management-system/drift-book-lite/resources/default-sensitive-words/SOURCES.md)

## 主要接口

### 公开接口

- `GET /api/health`
- `GET /api/site-assets`
- `GET /api/books/search?q=关键词`
- `GET /api/books/:bookId`
- `GET /api/books/:bookId/reviews`
- `POST /api/books/:bookId/reviews`

### 管理接口

- `POST /api/admin/login`
- `GET /api/admin/books`
- `GET /api/admin/sensitive-words`
- `POST /api/admin/sensitive-words/import-defaults`
- `PATCH /api/admin/books/:bookId`
- `POST /api/admin/imports`
- `GET /api/admin/imports`
- `GET /api/admin/imports/:batchId`
- `DELETE /api/admin/imports/:batchId`
- `GET /api/admin/reviews`
- `PATCH /api/admin/reviews/:reviewId`
- `GET /api/admin/assets`
- `POST /api/admin/assets/reload-default-assets`
- `POST /api/admin/assets/logo`
- `POST /api/admin/assets/carousel`
- `PATCH /api/admin/assets`

## 常见问题

### 1. 留言数据什么时候会丢

正常情况下，这些操作不会导致留言丢失：

- 正常提交留言
- 正常审核留言
- 正常 `docker compose down`
- 正常 `docker compose up -d`
- 正常删除图书导入批次

真正危险的是这些操作：

- `docker compose down -v`
- 删除 Docker volume
- 删除数据库文件
- 换机器但不恢复旧数据库

所以如果你的目标是“留言不能随意丢”，重点不是避免重启，而是：

- 不要删卷
- 做好备份
- 迁移机器时把数据库一起带走

### 2. 页面能打开，但数据加载失败

大概率是前端 API 地址写成了 `localhost`。

检查根目录 `.env`：

```env
FRONTEND_API_BASE_URL=http://192.168.1.50:8080/api
ADMIN_FRONTEND_API_BASE_URL=http://192.168.1.50:8080/api
APP_BASE_URL=http://192.168.1.50:5174
ADMIN_APP_BASE_URL=http://192.168.1.50:5175
```

修改后重新构建：

```bash
docker compose up --build -d
```

### 3. 部署电脑自己能访问，局域网其他设备不能访问

通常是以下原因：

- 防火墙未放行 `5174`、`5175`、`8080`
- 部署电脑和访问设备不在同一局域网
- 部署机 IP 已变化
- 路由器开启了客户端隔离

### 4. 改了 `.env` 但页面还是旧地址

因为前端是静态构建，必须重新构建镜像：

```bash
docker compose up --build -d
```

### 5. 国内网络拉 Docker 镜像太慢

可以按上面的“国内网络建议：给 Docker 配置镜像加速”章节配置 `registry-mirrors`。

如果你使用云厂商镜像加速器，注意两点：

- 镜像加速器地址需要你自己从对应控制台获取
- 某些加速器不保证最新镜像实时同步，不建议把它当成强一致的生产镜像源

### 6. 想改管理员账号或密码

修改根目录 `.env` 里的：

- `ADMIN_USERNAMES`
- `ADMIN_PASSWORD`

然后重启后端：

```bash
docker compose up --build -d backend
```

后端启动时会自动更新管理员账号。

## 本地开发

如果你是开发而不是部署，使用下面方式更方便。

### 1. 后端

```bash
cd drift-book-lite/backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

默认地址：`http://127.0.0.1:8080`

### 2. 学生端

```bash
cd drift-book-lite/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认地址：`http://127.0.0.1:5174`

### 3. 管理端

```bash
cd drift-book-lite/admin-frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认地址：`http://127.0.0.1:5175`

## 测试与构建

### 后端测试

```bash
cd drift-book-lite/backend
npm install
npm test
```

注意：

- `npm test` 会先执行 `prisma db push --accept-data-loss`
- 只建议在本地测试库使用，不要直接对生产数据库执行

### 学生端构建

```bash
cd drift-book-lite/frontend
npm install
npm run build
```

### 管理端构建

```bash
cd drift-book-lite/admin-frontend
npm install
npm run build
```

## 子模块文档

- [学生端说明](/Users/linics/Documents/githubfiles/library-management-system/drift-book-lite/frontend/README.md)
- [管理端说明](/Users/linics/Documents/githubfiles/library-management-system/drift-book-lite/admin-frontend/README.md)
