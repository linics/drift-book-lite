# 本地干净部署包说明

这个包用于在一台新电脑上部署 Drift Book Lite，并在新系统里重新完成图书、学生、敏感词和站点素材等数据导入。

## 包含内容

- 当前项目源码和部署配置
- 默认图书目录：`drift-book-lite/resources/default-book-catalog/图书馆7楼流通室数据.xlsx`
- 默认敏感词词库：`drift-book-lite/resources/default-sensitive-words`
- 默认站点素材：`drift-book-lite/resources/default-site-assets`
- 默认教师名单：`drift-book-lite/resources/default-teacher-roster/2025-teachers.txt`
- 学生名单导入源：`drift-book-lite/resources/default-student-roster/2025学年学生信息.xls`
- `scripts/windows`：无 Docker 本地运行工具和说明

## 不包含内容

- 不包含本地 SQLite 数据库快照
- 不包含本地上传目录 `drift-book-lite/uploads`
- 不包含 `.env`、`node_modules`、前端 `dist`

新电脑首次部署时会创建空数据库。部署完成后，请在管理端重新导入图书、学生名单、敏感词和站点素材。

## 推荐部署方式

在新电脑上：

1. 安装 Node.js 22 LTS，并确认 `node -v`、`npm -v` 可用。
2. 解压本压缩包。
3. 双击 `开始部署.bat`，或双击 `deploy.bat`。
4. 首次部署完成后，双击 `start.bat` 启动系统。
5. 需要备份当前数据时，双击 `backup.bat`。

如果部署窗口异常退出或提示失败，先打开解压目录里的 `deploy-debug.log`，里面会记录入口脚本执行到哪一步。

## 从旧版本升级

如果这台电脑上已经有正在使用的旧系统，不要直接覆盖旧目录。

1. 先关闭旧系统的三个运行窗口。
2. 把新版压缩包解压到一个新目录。
3. 在新版目录双击 `upgrade.bat`。
4. 按提示输入旧系统目录。
5. 脚本会复制旧系统的 `dev.db*`、`uploads` 和 `.env`，并自动完成依赖安装、数据库同步和前端构建。
6. 脚本输出 `books=`、`reviews=` 后，确认 `reviews` 不是 0，再双击新版目录的 `start.bat`。

升级脚本只读取旧系统目录，不会修改旧系统目录。

## 默认访问地址

- 学生端：`http://localhost:5174`
- 管理端：`http://localhost:5175`
- 后端健康检查：`http://localhost:8080/api/health`

如果部署电脑要给局域网其他设备访问，首次部署脚本会询问部署电脑 IP，并写入 `.env`。

## 数据安全提醒

这个包包含学生名单。不要把它提交到公开 GitHub 仓库，也不要公开分享。

部署后产生的数据会保存在新电脑的 `drift-book-lite\backend\prisma\dev.db` 和 `drift-book-lite\uploads`。备份时请使用 `backup.bat` 或 `scripts\windows\backup-local-data.bat`。
