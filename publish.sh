#!/bin/bash
# 茉霓日报一键发布脚本
# 用法: bash publish.sh data/20260331-2.json
#
# 流程: validate → update editions → update search-index → git push
# 子代理只需要跑这一行命令，不用手动编辑任何JSON

set -e  # 任何步骤失败立即退出

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

DATA_FILE="$1"

if [ -z "$DATA_FILE" ]; then
    echo "❌ 用法: bash publish.sh data/20260331-2.json"
    exit 1
fi

if [ ! -f "$DATA_FILE" ]; then
    echo "❌ 文件不存在: $DATA_FILE"
    exit 1
fi

echo "========================================="
echo "🌸 茉霓日报发布流程"
echo "========================================="

# Step 1: 校验+修复
echo ""
echo "📋 Step 1/4: 校验JSON格式..."
python3 validate_daily.py "$DATA_FILE" --fix-ticker
if [ $? -ne 0 ]; then
    echo "❌ 校验失败！"
    exit 1
fi

# Step 2: 更新editions.json
echo ""
echo "📋 Step 2/4: 更新 editions.json..."
python3 update_editions.py "$DATA_FILE"
if [ $? -ne 0 ]; then
    echo "❌ editions更新失败！"
    exit 1
fi

# Step 3: 更新search-index.json
echo ""
echo "📋 Step 3/4: 更新 search-index.json..."
python3 update_index.py "$DATA_FILE"
if [ $? -ne 0 ]; then
    echo "❌ search-index更新失败！"
    exit 1
fi

# Step 4: Git push
echo ""
echo "📋 Step 4/4: Git push..."

# 从文件名提取日期和期数
BASENAME=$(basename "$DATA_FILE" .json)
DATE_PART=$(echo "$BASENAME" | grep -oP '^\d{8}')
FORMATTED_DATE="${DATE_PART:0:4}-${DATE_PART:4:2}-${DATE_PART:6:2}"

# 从JSON读取issue
ISSUE=$(python3 -c "import json; d=json.load(open('$DATA_FILE')); print(d.get('issue',''))")

git add -A
git commit -m "daily: ${FORMATTED_DATE} ${ISSUE}" 2>/dev/null || echo "⚠️ 没有变更需要提交"
git push origin main

if [ $? -ne 0 ]; then
    echo "❌ Git push失败！"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ ${ISSUE} 已发布！"
echo "🔗 https://zjbco2.github.io/moni-daily/"
echo "========================================="
