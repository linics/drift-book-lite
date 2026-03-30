#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
cd "$root_dir"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Error: $root_dir is not a git repository."
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/worktree-new.sh <branch-name> [base-branch]"
  exit 1
fi

branch_name="$1"
base_branch="${2:-main}"
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
