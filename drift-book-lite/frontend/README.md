# Student Frontend

学生端前端，面向馆内读者提供活动首页、图书搜索、图书详情和评语提交能力。

## 职责范围

- 获取并展示站点 Logo、轮播图和活动流程说明
- 按书名关键词搜索图书
- 展示图书详情与已审核评语
- 提交新的阅读评语

## 技术栈

- React 19
- Vite 8
- React Router 7
- Axios
- Framer Motion
- Tailwind CSS 4

## 本地开发

```bash
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认地址：`http://127.0.0.1:5174`

## 环境变量

`.env.example`：

```env
VITE_API_BASE_URL=/api
```

说明：

- 开发模式下建议保持 `/api`
- `vite.config.js` 已将 `/api` 和 `/uploads` 代理到 `http://127.0.0.1:8080`
- 如果学生端与后端分离部署，请在构建前写入完整后端地址

示例：

```bash
VITE_API_BASE_URL=http://localhost:8080/api npm run build
```

## 常用脚本

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## 联调说明

- 默认依赖后端 `http://127.0.0.1:8080`
- 图像资源通过 `/uploads` 提供
- 当 `VITE_API_BASE_URL` 为完整 URL 时，前端会自动按该域名推导上传资源地址
