# Drift Book Lite

`Drift Book Lite` 是“`一本书的漂流`”校园阅读活动网站的交付仓库，包含学生端、管理端和后端三部分。

## 项目结构

- `drift-book-lite/frontend`: 学生端 React + Vite 前端
- `drift-book-lite/admin-frontend`: 管理端 React + Vite 前端
- `drift-book-lite/backend`: Express + Prisma + SQLite 后端
- `materials`: 学校 logo 与首页轮播原始素材

## 主要能力

- 学生端首页按书名搜索图书，并进入图书详情页查看基础信息
- 学生可提交阅读评语，管理员审核后公开展示
- 管理端支持书目导入、批次删除、图书信息修订、评语审核和轮播图上传
- 后端支持 CSV/XLSX 书目导入、站点素材维护和静态上传资源访问

## 环境要求

- Node.js 20
- npm 10+
- Docker Desktop 或 Docker Engine + Docker Compose（容器部署时）

## 本地开发

### 1. 启动后端

```bash
cd drift-book-lite/backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

默认后端地址：`http://127.0.0.1:8080`

### 2. 启动学生端

```bash
cd drift-book-lite/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认学生端地址：`http://127.0.0.1:5174`

开发模式下默认通过 Vite 代理访问后端：

- `/api` -> `http://127.0.0.1:8080`
- `/uploads` -> `http://127.0.0.1:8080`

### 3. 启动管理端

```bash
cd drift-book-lite/admin-frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认管理端地址：`http://127.0.0.1:5175`

### 本地默认管理员账号

- 用户名：`admin`
- 密码：`change-this-password`

## Docker Compose 部署

### 1. 准备环境变量

```bash
cp .env.example .env
```

可按需修改：

- `BACKEND_PORT`
- `FRONTEND_PORT`
- `ADMIN_FRONTEND_PORT`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `FRONTEND_API_BASE_URL`
- `ADMIN_FRONTEND_API_BASE_URL`

默认情况下，两个前端都会访问 `http://localhost:8080/api`。

### 2. 构建并启动

```bash
docker compose up --build
```

启动后默认访问地址：

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端：`http://localhost:8080`

### 3. 持久化数据

Compose 会自动创建两个卷：

- `backend_data`: 持久化 SQLite 数据库
- `backend_uploads`: 持久化上传的站点素材

`materials/` 会只读挂载到后端容器，用于初始化学校素材。

## 关键环境变量

### 根目录 `.env`

- `BACKEND_PORT`: 后端对外端口
- `FRONTEND_PORT`: 学生端对外端口
- `ADMIN_FRONTEND_PORT`: 管理端对外端口
- `FRONTEND_API_BASE_URL`: 学生端构建时写入的 API 地址
- `ADMIN_FRONTEND_API_BASE_URL`: 管理端构建时写入的 API 地址
- `JWT_SECRET`: JWT 密钥
- `ADMIN_USERNAME`: 初始管理员用户名
- `ADMIN_PASSWORD`: 初始管理员密码

### `drift-book-lite/backend/.env`

- `DATABASE_URL`: Prisma 使用的 SQLite 数据库地址
- `PORT`: 后端监听端口
- `JWT_SECRET`: JWT 密钥
- `ADMIN_USERNAME`: 初始管理员用户名
- `ADMIN_PASSWORD`: 初始管理员密码
- `APP_BASE_URL`: 学生端地址
- `MATERIALS_DIR`: 素材目录路径

## 测试与构建

### 后端测试

```bash
cd drift-book-lite/backend
npm test
```

### 学生端构建

```bash
cd drift-book-lite/frontend
npm run build
```

### 管理端构建

```bash
cd drift-book-lite/admin-frontend
npm run build
```

## 说明

- 运行时数据库、上传目录、本地 `.env` 文件和依赖目录不纳入版本控制
- 学生端与管理端为两个独立前端，不共享登录态
- 站点图片资源由后端 `/uploads` 提供，前端支持通过 `VITE_API_BASE_URL` 自动推导资源域名
