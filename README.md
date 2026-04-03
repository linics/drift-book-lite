# Drift Book Lite

“一本书的漂流”校园阅读活动交付仓库，包含学生端、管理端、后端服务，以及用于初始化站点素材和导入图书目录的原始数据文件。

## 项目概览

这个仓库对应一个完整的馆内活动系统，分为 3 个运行模块：

- 学生端：面向读者的公开页面，支持搜索图书、查看详情、提交阅读评语
- 管理端：面向馆员或管理员，负责图书导入、图书修订、评语审核、站点素材维护
- 后端：提供公开接口、管理接口、文件上传、素材托管、图书导入与 SQLite 数据存储

## 目录结构

```text
.
├── drift-book-lite/
│   ├── frontend/         # 学生端 React + Vite
│   ├── admin-frontend/   # 管理端 React + Vite
│   └── backend/          # Express + Prisma + SQLite
├── materials/            # 学校 logo、轮播图等初始化素材
├── docker-compose.yml    # 三模块容器化编排
├── .env.example          # 根目录部署环境变量示例
├── 图书信息.csv
└── 图书馆7楼流通室数据.xlsx
```

## 功能说明

### 学生端

- 首页展示学校品牌信息、轮播图和活动流程说明
- 支持按书名关键词搜索图书
- 图书详情页展示作者、出版社、出版信息、馆藏册数等内容
- 读者可以提交阅读评语，评语进入待审核状态
- 仅展示管理员已审核通过的评语

### 管理端

- 管理员账号登录
- 导入 CSV 或 XLSX 图书目录
- 查看导入批次、失败行和导入统计
- 按页查询和修改图书信息
- 审核、隐藏、驳回读者评语
- 上传或替换学校 Logo、轮播图
- 从 `materials/` 目录一键初始化站点素材

### 后端

- 提供公开接口 `/api/*`
- 提供受保护的管理接口 `/api/admin/*`
- 使用 Prisma 操作 SQLite 数据库
- 托管 `/uploads` 静态资源
- 支持 CSV、XLSX 两类馆藏目录导入
- 首次启动自动初始化管理员账号和站点配置

## 技术栈

| 模块 | 技术 |
|------|------|
| 学生端 | React 19、Vite 8、Axios、React Router、Framer Motion、Tailwind CSS 4 |
| 管理端 | React 19、Vite 8、Axios、React Router、Tailwind CSS 4 |
| 后端 | Express 5、Prisma 6、SQLite、JWT、Multer、Zod、csv-parse、xlsx |
| 测试 | Vitest、Supertest |

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- Docker Desktop 或 Docker Engine + Docker Compose（容器部署时）

## 快速开始

### 方式一：本地开发

#### 1. 启动后端

```bash
cd drift-book-lite/backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

默认监听地址：`http://127.0.0.1:8080`

首次启动会自动完成：

- 创建或更新管理员账号
- 初始化站点素材配置
- 为后续上传创建运行所需目录

#### 2. 启动学生端

```bash
cd drift-book-lite/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认地址：`http://127.0.0.1:5174`

开发模式下默认代理：

- `/api` -> `http://127.0.0.1:8080`
- `/uploads` -> `http://127.0.0.1:8080`

#### 3. 启动管理端

```bash
cd drift-book-lite/admin-frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认地址：`http://127.0.0.1:5175`

#### 4. 默认管理员账号

- 用户名：`admin`
- 密码：`change-this-password`

强烈建议在正式环境通过环境变量覆盖默认密码。

### 方式二：Docker Compose 部署

#### 1. 准备根目录环境变量

```bash
cp .env.example .env
```

#### 2. 构建并启动

```bash
docker compose up --build
```

默认访问地址：

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端：`http://localhost:8080`

#### 3. 持久化说明

Compose 会自动创建两个卷：

- `backend_data`：持久化 SQLite 数据库
- `backend_uploads`：持久化上传后的站点素材

同时会把 `materials/` 以只读方式挂载到后端容器，用于初始化站点图片素材。

## 环境变量

### 根目录 `.env`

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BACKEND_PORT` | 后端对外端口 | `8080` |
| `FRONTEND_PORT` | 学生端对外端口 | `5174` |
| `ADMIN_FRONTEND_PORT` | 管理端对外端口 | `5175` |
| `JWT_SECRET` | JWT 签名密钥 | `change-this-secret` |
| `ADMIN_USERNAME` | 初始管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 初始管理员密码 | `change-this-password` |
| `FRONTEND_API_BASE_URL` | 学生端构建时写入的 API 地址 | `http://localhost:8080/api` |
| `ADMIN_FRONTEND_API_BASE_URL` | 管理端构建时写入的 API 地址 | `http://localhost:8080/api` |

### `drift-book-lite/backend/.env`

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Prisma 使用的 SQLite 地址 | `file:./dev.db` |
| `PORT` | 后端监听端口 | `8080` |
| `JWT_SECRET` | JWT 签名密钥 | `change-this-secret` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `change-this-password` |
| `APP_BASE_URL` | 学生端站点地址 | `http://localhost:5174` |
| `MATERIALS_DIR` | 素材目录路径；为空时使用默认路径推导 | 空 |

### 前端 `.env`

学生端和管理端都只需要一个变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | API 根地址 | `/api` |

开发模式建议保留 `/api`，交由 Vite 代理到本地后端；生产构建时可改为完整地址。

## 数据与素材

### 图书目录导入

后端支持两种导入格式：

- CSV：要求至少包含 `book_id`、`title`、`author`、`publisher`、`total_copies`、`available_copies`
- XLSX：支持中文列名和多种别名，如“控制号”“书名”“责任者”“出版社”“条形码”等

管理端导入支持两种模式：

- `create_only`：仅新增，不覆盖已有图书
- `upsert`：已存在时按主键更新

仓库根目录内的 [图书信息.csv](/Users/linics/Documents/githubfiles/library-management-system/图书信息.csv) 和 [图书馆7楼流通室数据.xlsx](/Users/linics/Documents/githubfiles/library-management-system/图书馆7楼流通室数据.xlsx) 可作为导入测试样例。

### 站点素材

- `materials/` 可存放学校 Logo 和首页轮播图原始文件
- 管理端可调用“从素材目录初始化”能力，将素材复制到运行期上传目录
- 运行中的静态资源通过 `/uploads` 暴露

## 主要接口

### 公开接口

- `GET /api/health`：健康检查
- `GET /api/site-assets`：获取站点素材和流程说明
- `GET /api/books/search?q=关键词`：搜索图书
- `GET /api/books/:bookId`：获取图书详情
- `GET /api/books/:bookId/reviews`：获取已公开评语
- `POST /api/books/:bookId/reviews`：提交评语

### 管理接口

- `POST /api/admin/login`：管理员登录
- `GET /api/admin/books`：分页查询图书
- `PATCH /api/admin/books/:bookId`：更新图书信息
- `POST /api/admin/imports`：上传并导入图书目录
- `GET /api/admin/imports`：获取导入批次
- `DELETE /api/admin/imports/:batchId`：删除导入批次
- `GET /api/admin/reviews`：获取评语列表
- `PATCH /api/admin/reviews/:reviewId`：审核或隐藏评语
- `GET /api/admin/assets`：获取站点素材
- `POST /api/admin/assets/bootstrap-from-materials`：从 `materials/` 初始化素材
- `POST /api/admin/assets/logo`：上传 Logo
- `POST /api/admin/assets/carousel`：上传轮播图
- `PATCH /api/admin/assets`：更新素材配置

## 测试与构建

### 后端测试

```bash
cd drift-book-lite/backend
npm install
npm test
```

`npm test` 会先执行 `prisma db push --accept-data-loss`，适合本地测试库，不建议直接对生产库运行。

### 前端构建

```bash
cd drift-book-lite/frontend
npm install
npm run build
```

```bash
cd drift-book-lite/admin-frontend
npm install
npm run build
```

## 开发建议

- 学生端和管理端是两个独立前端项目，不共享登录态
- 前端资源地址支持从 `VITE_API_BASE_URL` 自动推导 `/uploads` 资源域名
- 正式部署前请替换默认管理员密码和 JWT 密钥
- 如果需要重新初始化数据库，请清理 SQLite 文件或 Docker volume 后重新执行 `prisma db push`

## 模块文档

- [学生端说明](/Users/linics/Documents/githubfiles/library-management-system/drift-book-lite/frontend/README.md)
- [管理端说明](/Users/linics/Documents/githubfiles/library-management-system/drift-book-lite/admin-frontend/README.md)
