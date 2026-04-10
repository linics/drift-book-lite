# Admin Frontend

管理端前端，面向馆员或活动管理员提供图书导入、图书维护、评语审核和站点素材管理能力。

## 职责范围

- 管理员登录
- 图书目录导入与导入批次查看
- 图书分页查询和字段修订
- 评语审核、隐藏、驳回
- Logo 与轮播图上传
- 从 `resources/default-site-assets/` 重新载入默认首页图片

## 技术栈

- React 19
- Vite 8
- React Router 7
- Axios
- Tailwind CSS 4

## 本地开发

```bash
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

默认地址：`http://127.0.0.1:5175`

## 环境变量

`.env.example`：

```env
VITE_API_BASE_URL=/api
```

说明：

- 开发模式下建议保持 `/api`
- `vite.config.js` 已将 `/api` 代理到 `http://127.0.0.1:8080`
- 生产构建时可以替换为完整后端地址

示例：

```bash
VITE_API_BASE_URL=http://localhost:8080/api npm run build
```

## 常用脚本

```bash
npm run dev
npm run build
npm run preview
```

## 默认账号

- 用户名：`admin1`、`admin2`、`admin3`
- 密码：`change-this-password`

这些账号由后端在启动时自动创建或更新。正式环境请通过后端环境变量覆盖默认密码。
