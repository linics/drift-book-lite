# 本地完整包说明

这个包用于把当前电脑上的 Drift Book Lite 项目迁移到另一台电脑。

## 包含内容

- 当前项目源码和部署配置。
- `package-data/backend-data/dev.db`：本地 SQLite 数据库快照。
- `drift-book-lite/uploads`：本地上传素材快照。
- `2025学年学生信息.xls`：学生名单文件，用于后端启动时导入或校验学生信息。
- `scripts/windows-docker`：Windows Docker 首次部署、日常启动、停止、状态查看、备份工具。
- `scripts/windows`：无 Docker 本地运行工具和说明。

## 推荐部署方式：无 Docker

在新电脑上：

1. 安装 Node.js 22 LTS，并确认 `node -v`、`npm -v` 可用。
2. 解压本压缩包。
3. 双击 `scripts\windows\deploy-local-with-data.bat`。
4. 首次部署完成后，双击 `scripts\windows\start-local-services.bat` 启动系统。
5. 需要备份当前数据时，双击 `scripts\windows\backup-local-data.bat`。

如果另一台电脑可以使用 Docker，也可以改用 `scripts\windows-docker\deploy-with-data.bat`。

## 默认访问地址

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端健康检查：`http://localhost:8080/api/health`

如果部署电脑要给局域网其他设备访问，首次部署脚本会询问部署电脑 IP，并写入 `.env`。

## 数据安全提醒

这个包包含学生名单、数据库和上传素材。不要把它提交到公开 GitHub 仓库，也不要公开分享。

无 Docker 部署会直接使用 `drift-book-lite\backend\prisma\dev.db` 和 `drift-book-lite\uploads`。
如果包里包含 `package-data\backend-data\dev.db`，首次部署脚本会在目标库不存在时自动恢复；目标库已存在时会先询问，避免覆盖已有数据。

Docker 日常启动脚本不会覆盖数据。只有 Docker 版 `deploy-with-data.bat` 在你确认恢复打包数据时，才会把 `package-data\backend-data\dev.db` 和 `drift-book-lite\uploads` 里的数据复制到 Docker 数据卷。
