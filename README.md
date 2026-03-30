# Drift Book Lite

`Drift Book Lite` 是“一本书的漂流”校园阅读接龙系统的轻量实现。

仓库包含三部分：

- `drift-book-lite/frontend`: React + Vite + Tailwind CSS 前端
- `drift-book-lite/backend`: Express + Prisma + SQLite 后端
- `materials`: 学校 logo 与论坛主页轮播原始素材

## Features

- 论坛主页，展示学校 logo、校园轮播与活动说明
- 每本书独立二维码书页
- 10 层单链接龙留言，先审核后公开
- 管理后台，支持登录、页面管理、待审核队列、素材中心、二维码下载、轮次重置
- 从 `materials/` 导入学校 logo 和校园轮播图

## Local Run

项目建议使用 `Node 20`。

### Backend

```bash
cd drift-book-lite/backend
cp .env.example .env
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm install
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run prisma:generate
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run prisma:push
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run dev
```

### Frontend

```bash
cd drift-book-lite/frontend
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm install
PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run dev -- --host 127.0.0.1
```

默认开发地址：

- Frontend: `http://127.0.0.1:5174`
- Backend: `http://127.0.0.1:8080`

默认管理员账号：

- username: `admin`
- password: `change-this-password`

## Notes

- `book-world/` 只是早期调研时克隆的参考项目，不属于当前交付代码。
- 运行时上传目录、SQLite 数据库、本地环境文件和构建产物均未纳入版本控制。
