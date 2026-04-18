# Drift Book Lite

"一本书的漂流"校园阅读活动系统交付仓库，包含学生端、管理端、后端服务，以及图书导入样例和站点素材。

这份 README 以"在一台全新 Windows 电脑上完成部署，并让局域网内其他设备可访问"为主场景编写。  
如果你只是本地开发，可以直接跳到"本地开发"一节。

## 一句话结论

1. 安装 [Node.js 22 LTS](https://nodejs.org/)
2. 把项目拷到部署电脑，双击 `deploy.bat` 完成首次部署（按提示输入局域网 IP 和管理员密码）
3. 后续每次启动双击 `start.bat`，备份数据双击 `backup.bat`

详细步骤见：[WINDOWS-NO-DOCKER-DEPLOY.md](scripts/windows/WINDOWS-NO-DOCKER-DEPLOY.md)

## 先确认一件事：学生留言数据不会随意丢

按当前实现，学生留言不是存在浏览器本地，也不是存在前端缓存，而是写入后端 SQLite 数据库中的 `BookReview` 表。

只要你是正常使用下面这些操作，留言通常不会丢：

- 正常提交学生留言
- 正常审核、隐藏、驳回留言
- 正常重启部署电脑
- 正常删除图书导入批次

为什么可以这样判断：

- 留言保存在后端数据库文件 `drift-book-lite/backend/prisma/dev.db`，不依赖浏览器本地存储
- 上传素材保存在 `drift-book-lite/uploads/` 目录
- 后端测试已经覆盖"删除导入批次后仍保留留言/迁移留言"的场景

真正会导致数据丢失的高风险操作主要是这些：

- 手动删除 `dev.db` 数据库文件
- 迁移到新电脑时只拷代码，不迁移数据库和上传目录
- 在空环境上重新部署后，直接把它当成原系统继续使用

一句话理解：

- 正常停机、重启，一般不会丢留言
- 删库、迁移不带数据，才会真的丢

## 系统组成

本项目分为 3 个运行模块：

- 学生端：读者搜索图书、查看详情、提交评语
- 管理端：管理员登录、导入书目、审核评语、维护站点素材
- 后端：提供 API、管理 SQLite 数据库、托管上传文件

## 目录结构

```text
.
├── deploy.bat            # 首次部署，双击运行
├── start.bat             # 日常启动，双击运行
├── backup.bat            # 备份数据，双击运行
├── drift-book-lite/
│   ├── frontend/         # 学生端 React + Vite
│   ├── admin-frontend/   # 管理端 React + Vite
│   ├── backend/          # Express + Prisma + SQLite
│   └── resources/
│       ├── default-site-assets/      # 默认首页图片（Logo、轮播图）
│       ├── default-sensitive-words/  # 默认敏感词快照
│       └── default-teacher-roster/   # 清理后的教师名册
├── scripts/
│   └── windows/          # 部署工具脚本（由根目录 bat 文件调用）
└── data/                 # 参考数据文件（gitignored，不随代码提交）
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

## Windows 一键部署

### 先决条件

- Windows 10 / 11
- [Node.js 22 LTS](https://nodejs.org/)（安装时勾选"Add to PATH"）

### 首次部署

双击仓库根目录的 `deploy.bat`，脚本会：

1. 检查 Node.js 是否安装
2. 询问是否恢复打包数据库（如有）
3. 询问本机局域网 IP 和管理员密码，自动生成 `.env` 文件
4. 安装依赖（`npm ci`）
5. 初始化 SQLite 数据库
6. 构建学生端和管理端

部署完成后，使用 `start.bat` 日常启动。

### 日常启动

双击 `start.bat`，会在三个独立窗口中分别启动：

- 后端 API（端口 8080）
- 学生端（端口 5174）
- 管理端（端口 5175）

### 访问地址

假设部署电脑局域网 IP 为 `192.168.1.50`：

| 服务 | 本机访问 | 局域网访问 |
|------|----------|------------|
| 学生端 | `http://localhost:5174` | `http://192.168.1.50:5174` |
| 管理端 | `http://localhost:5175` | `http://192.168.1.50:5175` |
| 后端健康检查 | `http://localhost:8080/api/health` | `http://192.168.1.50:8080/api/health` |

默认管理员账号：
- 用户名：`admin1`、`admin2`、`admin3`
- 初始密码：部署时输入的 `ADMIN_PASSWORD`
- 登录后可在管理端"账号设置"中修改当前账号密码

### 防火墙放行

如果局域网其他设备打不开，需放行 TCP 端口 `5174`、`5175`、`8080`。

### 备份数据

双击 `backup.bat`，会在 `backups/` 目录生成带时间戳的备份，包含数据库和上传文件。

### 换电脑或 IP 变化

再次双击 `deploy.bat`，选择重写 `.env` 文件，重新输入新 IP，脚本会自动重新构建前端。

详细手动操作说明：[WINDOWS-NO-DOCKER-DEPLOY.md](scripts/windows/WINDOWS-NO-DOCKER-DEPLOY.md)

## 环境变量说明

### `drift-book-lite/backend/.env`

由 `deploy.bat` 自动生成，也可手动编辑。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Prisma 使用的 SQLite 地址 | `file:./dev.db` |
| `PORT` | 后端监听端口 | `8080` |
| `JWT_SECRET` | JWT 密钥 | 部署时随机生成 |
| `ADMIN_USERNAMES` | 管理员用户名列表 | `admin1,admin2,admin3` |
| `ADMIN_PASSWORD` | 缺失管理员账号的初始密码 | 部署时输入 |
| `APP_BASE_URL` | 学生端地址（CORS 来源） | `http://<LAN_IP>:5174` |
| `ADMIN_APP_BASE_URL` | 管理端地址（CORS 来源） | `http://<LAN_IP>:5175` |
| `DEFAULT_SITE_ASSETS_DIR` | 默认首页图片目录路径 | 部署时自动填入绝对路径 |
| `DEFAULT_SENSITIVE_WORDS_DIR` | 默认敏感词目录路径 | 部署时自动填入绝对路径 |
| `STUDENT_ROSTER_PATH` | 学生名册路径 | 部署时自动填入 |
| `TEACHER_ROSTER_PATH` | 教师名册路径 | 部署时自动填入 |
| `UPLOADS_DIR` | 上传文件目录路径 | 部署时自动填入绝对路径 |

## 图书导入与素材

### 图书目录导入

后端支持两种导入格式：

- CSV：至少包含 `book_id`、`title`、`author`、`publisher`、`total_copies`、`available_copies`
- XLSX：支持中文列名和多种别名，如"控制号""书名""责任者""出版社""条形码"等

管理端支持两种导入模式：

- `create_only`：只新增，不覆盖已有图书
- `upsert`：已存在则更新

样例文件随本地工作目录附带，**不随代码提交**（`data/` 已被 gitignore）。全新克隆仓库后不包含这些文件；如需样例数据，请联系项目负责人获取或使用本地打包包中的副本：

- `data/图书信息.csv`（本地 `data/` 目录，仅本地存在）
- `data/图书馆7楼流通室数据.xlsx`（本地 `data/` 目录，仅本地存在）

### 站点素材

- `drift-book-lite/resources/default-site-assets/` 可以存放学校 Logo 和首页轮播原图
- 文件命名约定：`logo.*` 作为学校 Logo，`carousel-01.*`、`carousel-02.*` 按顺序作为首页轮播图
- 系统启动时会自动补齐缺失的 Logo 或轮播图
- 管理端可调用"重新载入默认素材"恢复默认首页图片
- 最终访问资源通过 `/uploads` 暴露

### 默认敏感词词库

- 项目内置默认词库目录：`drift-book-lite/resources/default-sensitive-words/`
- 当前默认快照采用中度扩容范围，共 7 类：广告、色情、涉枪涉爆、非法网址、暴恐、补充、贪腐
- 后端会读取该目录下所有 `.txt` 文件；导入时执行 `NFKC + trim + lowercase` 归一化并按归一化结果去重
- 管理端"敏感词库"页可调用"导入内置词库"把默认词条写入数据库
- 上游来源与快照说明见 [SOURCES.md](drift-book-lite/resources/default-sensitive-words/SOURCES.md)

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

### 1. 页面能打开，但数据加载失败

大概率是 `.env` 里 `APP_BASE_URL` / `ADMIN_APP_BASE_URL` 还写着 `localhost`。  
重新运行 `deploy.bat`，选择重写 `.env`，输入正确的局域网 IP，再重启服务。

### 2. 部署电脑自己能访问，局域网其他设备不能访问

通常是以下原因：

- 防火墙未放行 `5174`、`5175`、`8080`
- 部署电脑和访问设备不在同一局域网
- 部署机 IP 已变化（重新运行 `deploy.bat` 更新配置）
- 路由器开启了客户端隔离

### 3. 想改管理员账号或密码

修改 `drift-book-lite/backend/.env` 里的 `ADMIN_USERNAMES`，然后重启后端。后端启动时会创建缺失的管理员账号，但不会覆盖已有管理员密码。想修改当前管理员密码，请登录管理端并进入"账号设置"。

### 4. 留言数据什么时候会丢

正常停机、重启不会丢。危险操作：删除 `dev.db` 数据库文件、迁移电脑时不带走数据库和 `uploads/` 目录。

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

- [学生端说明](drift-book-lite/frontend/README.md)
- [管理端说明](drift-book-lite/admin-frontend/README.md)
- [Windows 部署详细说明](scripts/windows/WINDOWS-NO-DOCKER-DEPLOY.md)
