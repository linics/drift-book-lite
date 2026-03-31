# Student Frontend

学生端前端运行在 `5174` 端口，提供统一活动首页、图书搜索页和图书详情页。

## Development

```bash
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认情况下：

- `VITE_API_BASE_URL=/api`
- `/api` 通过 Vite 代理到 `http://127.0.0.1:8080`
- `/uploads` 通过 Vite 代理到 `http://127.0.0.1:8080`

如果学生端部署在与后端不同的域名或端口，请在构建前设置显式 API 地址，例如：

```bash
VITE_API_BASE_URL=http://localhost:8080/api npm run build
```
