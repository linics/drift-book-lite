# AGENTS.md

这个仓库的协作规则，供 Codex、Claude 或其他代码代理执行任务时遵守。

## 基本流程

- 开始任务前先确认当前分支、工作区状态和相关需求编号。
- 每个需求使用独立分支处理，分支名优先使用需求编号，例如 `r003`。
- 不要覆盖或回滚用户已有改动；遇到无关改动时保持原样。
- 修改代码前先阅读现有实现和测试，遵循当前项目风格。

## 需求记录

- 完成需求后必须同步更新 `REQUIREMENTS.md`。
- 需求列表中的状态要从“待处理”改为“已完成”，备注写清楚实际行为和关键边界。
- 同时在“变更记录”里追加日期和完成内容。
- 如果任务只是修复 review 反馈，也要检查是否影响需求备注。

## 测试与验证

- 涉及后端行为时运行：

```bash
cd drift-book-lite/backend && npm test
```

- 涉及管理端前端时运行：

```bash
cd drift-book-lite/admin-frontend && npm test
```

- 涉及学生端前端时运行：

```bash
cd drift-book-lite/frontend && npm test
```

- 不能只凭代码阅读声称完成；最终答复必须写明实际运行过的验证命令和结果。

## 本地环境设置

- 本地开发/部署端口以当前模板为准：后端 `8080`，学生端 `5174`，管理端 `5175`。
- 根目录 `.env.example` 用于 Docker Compose 或整机部署；三个应用目录下的 `.env.example` 用于单独本地运行。
- 后端本地 `.env` 的关键变量包括：
  - `DATABASE_URL="file:./dev.db"`
  - `PORT=8080`
  - `JWT_SECRET`、`ADMIN_USERNAMES`、`ADMIN_PASSWORD`
  - `APP_BASE_URL=http://localhost:5174`
  - `ADMIN_APP_BASE_URL=http://localhost:5175`
  - `DEFAULT_SITE_ASSETS_DIR`
  - `DEFAULT_SENSITIVE_WORDS_DIR`
  - `STUDENT_ROSTER_PATH`
  - `TEACHER_ROSTER_PATH`
  - `UPLOADS_DIR`
- 学生端和管理端都通过 `VITE_API_BASE_URL` 指向后端 API；局域网部署时不要使用浏览器所在设备的 `localhost`，要写部署机 IP，例如 `http://192.168.1.50:8080/api`。
- 生产或外部可访问环境禁止使用 `change-this-secret`、`change-this-password` 等默认值。
- 修改环境模板、Docker Compose、Windows 部署脚本或资源目录后，要同步检查 `README.md`、`CLAUDE.md` 和相关部署配置测试。

## 提交与收尾

- 提交前检查：

```bash
git status --short --branch
git diff --check
```

- 提交信息使用简洁英文，例如 `feat: allow deleting carousel assets`。
- 合并到 `main` 后，需要在 `main` 上重新运行相关测试。
- 推送成功后再删除功能分支；删除分支前确认 `main` 已同步到远端。

## 项目注意事项

- 后端位于 `drift-book-lite/backend`，管理端位于 `drift-book-lite/admin-frontend`，学生端位于 `drift-book-lite/frontend`。
- 默认首页素材源文件位于 `drift-book-lite/resources/default-site-assets`，功能代码不得误删这些源文件。
- 默认敏感词源文件位于 `drift-book-lite/resources/default-sensitive-words`。
- 默认教师名册源文件位于 `drift-book-lite/resources/default-teacher-roster/2025-teachers.txt`，用于 R-009 一次性清理名单导入。
- 学生名册是部署数据，不应放入 `data/`；默认可使用项目根目录 `2025学年学生信息.xls` 或 Windows 打包目录 `package-data/student-roster.xls`。
- 上传文件副本位于后端配置的 `UPLOADS_DIR`，清理上传副本前必须确认没有其他配置继续引用。
