# Windows Docker 工具说明

这些脚本适合把打包好的项目复制到另一台 Windows 电脑后使用。

## 使用顺序

1. 安装并启动 Docker Desktop。
2. 解压压缩包。
3. 双击 `scripts\windows-docker\deploy-with-data.bat`。
4. 首次部署时选择恢复打包数据。
5. 后续日常启动双击 `scripts\windows-docker\start-services.bat`。

## 脚本用途

- `deploy-with-data.bat`：首次部署，生成 `.env`，恢复打包数据库和上传文件，构建并启动服务。
- `start-services.bat`：日常启动，不覆盖已有数据。
- `stop-services.bat`：停止服务，不删除数据库和上传文件。
- `status-services.bat`：查看容器状态和访问地址。
- `backup-data.bat`：从 Docker 数据卷导出当前数据库和上传文件到 `backups\时间戳`。

## 访问地址

默认本机访问：

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端：`http://localhost:8080/api/health`

首次部署脚本会询问部署电脑的局域网 IP。填写后，局域网内其他设备可使用对应 IP 访问。

## 数据说明

首次部署脚本只在你确认时恢复 `package-data\backend-data\dev.db` 和 `drift-book-lite\uploads` 里的数据。日常启动脚本不会覆盖数据。

如果要迁移更新后的数据，请先在旧电脑运行 `backup-data.bat`，再把生成的备份目录保存好。
