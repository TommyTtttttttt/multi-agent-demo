#!/bin/bash

# =============================================================================
# Git Worktree 清理脚本
#
# 移除所有 worktrees 并清理分支
# =============================================================================

set -e

WORKTREE_BASE="../worktrees"

echo "🧹 清理 Git Worktrees"
echo "========================================"
echo ""

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 错误: 当前目录不是 git 仓库"
    exit 1
fi

# 获取所有 worktrees
echo "当前 worktrees:"
git worktree list
echo ""

# 确认
read -p "确定要移除所有 feature/* worktrees 吗? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "移除 worktrees..."

# 移除 worktrees
if [ -d "$WORKTREE_BASE" ]; then
    for dir in "$WORKTREE_BASE"/*; do
        if [ -d "$dir" ]; then
            component=$(basename "$dir")
            echo -n "   $component: "
            git worktree remove "$dir" --force 2>/dev/null && echo "已移除 ✅" || echo "跳过 ⏭️"
        fi
    done
fi

# 清理 worktree 引用
git worktree prune

echo ""
echo "========================================"

# 询问是否删除分支
read -p "是否也删除 feature/* 分支? (y/N) " delete_branches
if [[ "$delete_branches" == "y" || "$delete_branches" == "Y" ]]; then
    echo ""
    echo "删除分支..."
    for branch in $(git branch | grep "feature/"); do
        branch_name=$(echo "$branch" | tr -d ' ')
        echo -n "   $branch_name: "
        git branch -D "$branch_name" 2>/dev/null && echo "已删除 ✅" || echo "跳过 ⏭️"
    done
fi

# 删除空的 worktree 目录
if [ -d "$WORKTREE_BASE" ]; then
    rmdir "$WORKTREE_BASE" 2>/dev/null || true
fi

echo ""
echo "✅ 清理完成！"
echo ""
echo "当前 worktrees:"
git worktree list
