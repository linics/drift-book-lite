# Git Worktrees

本仓库的工作树统一放在项目内的隐藏目录：

`/.worktrees/`

## 约定

- `.worktrees/` 只作为本地工作目录，不纳入版本控制
- 每个工作树对应一个分支，目录名默认与分支名一致
- 默认从 `main` 派生新工作树

## 创建工作树

使用仓库内脚本：

```bash
./scripts/worktree-new.sh <branch-name>
```

例如：

```bash
./scripts/worktree-new.sh feature/homepage-refresh
```

如果要从其他基线分支创建：

```bash
./scripts/worktree-new.sh feature/admin-audit main
```

## 查看工作树

```bash
git worktree list
```

## 删除工作树

先移除工作树，再按需删除分支：

```bash
git worktree remove .worktrees/<branch-name>
git branch -d <branch-name>
```

## 说明

- 当前主仓库仍然保留在项目根目录
- `book-world/` 是参考项目，不参与当前工作树流程
