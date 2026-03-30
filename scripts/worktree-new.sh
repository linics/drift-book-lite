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
project_name="$(basename "$root_dir")"
codex_home="${CODEX_HOME:-$HOME/.codex}"
global_root="$codex_home/worktrees/$project_name"
worktree_dir="$global_root/$branch_name"

mkdir -p "$global_root"

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  git worktree add "$worktree_dir" "$branch_name"
else
  git worktree add "$worktree_dir" -b "$branch_name" "$base_branch"
fi

echo "Worktree created at: $worktree_dir"
