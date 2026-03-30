#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/worktree-new.sh <branch-name> [base-branch]"
  exit 1
fi

branch_name="$1"
base_branch="${2:-main}"
root_dir="$(git rev-parse --show-toplevel)"
worktree_dir="$root_dir/.worktrees/$branch_name"

if [[ ! -d "$root_dir/.worktrees" ]]; then
  mkdir -p "$root_dir/.worktrees"
fi

if ! git check-ignore -q "$root_dir/.worktrees" && ! git check-ignore -q ".worktrees"; then
  echo "Error: .worktrees/ is not ignored by git."
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  git worktree add "$worktree_dir" "$branch_name"
else
  git worktree add "$worktree_dir" -b "$branch_name" "$base_branch"
fi

echo "Worktree created at: $worktree_dir"
