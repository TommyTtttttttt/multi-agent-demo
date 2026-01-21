#!/bin/bash

# =============================================================================
# Git Worktree 设置脚本
#
# 为多智能体并行开发创建独立的工作树
# =============================================================================

set -e

# 配置
WORKTREE_BASE="../worktrees"
COMPONENTS=(
    "button"
    "input"
    "card"
    "header"
    "sidebar"
    "modal"
    "footer"
    "table"
)

echo "📁 设置 Git Worktrees"
echo "========================================"
echo ""

# 创建 worktree 基础目录
mkdir -p "$WORKTREE_BASE"

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 错误: 当前目录不是 git 仓库"
    echo "请先初始化 git: git init"
    exit 1
fi

# 确保至少有一个提交
if ! git rev-parse HEAD > /dev/null 2>&1; then
    echo "⚠️  没有发现提交，创建初始提交..."
    git add -A
    git commit -m "Initial commit" --allow-empty
fi

# 为每个组件创建 worktree
for component in "${COMPONENTS[@]}"; do
    branch_name="feature/$component"
    worktree_path="$WORKTREE_BASE/$component"

    echo -n "   $component: "

    # 创建分支（如果不存在）
    if ! git show-ref --verify --quiet "refs/heads/$branch_name"; then
        git branch "$branch_name" 2>/dev/null || true
    fi

    # 创建 worktree
    if [ -d "$worktree_path" ]; then
        echo "已存在 ⏭️"
    else
        git worktree add "$worktree_path" "$branch_name" 2>/dev/null
        echo "已创建 ✅"
    fi
done

echo ""
echo "========================================"
echo "📋 Worktree 列表:"
echo ""
git worktree list
echo ""
echo "✅ 设置完成！"
echo ""
echo "提示:"
echo "  - 每个 worktree 是独立的工作目录"
echo "  - Worker 智能体将在各自的 worktree 中工作"
echo "  - 完成后使用 ./scripts/clean-worktrees.sh 清理"
