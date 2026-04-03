#!/bin/bash
# 茉霓日报一键发布脚本
# 用法: bash publish.sh data/20260331-2.json
#
# 流程: validate → update editions → update search-index → update sections → update comments → git push
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
echo "📋 Step 1/6: 校验JSON格式..."
python3 validate_daily.py "$DATA_FILE" --fix-ticker
if [ $? -ne 0 ]; then
    echo "❌ 校验失败！"
    exit 1
fi

# Step 2: 更新editions.json
echo ""
echo "📋 Step 2/6: 更新 data/meta/editions.json..."
python3 update_editions.py "$DATA_FILE"
if [ $? -ne 0 ]; then
    echo "❌ editions更新失败！"
    exit 1
fi

# Step 3: 更新search-index.json
echo ""
echo "📋 Step 3/6: 更新 data/meta/search-index.json..."
python3 update_index.py "$DATA_FILE"
if [ $? -ne 0 ]; then
    echo "❌ search-index更新失败！"
    exit 1
fi

# Step 4: 更新板块索引
echo ""
echo "📋 Step 4/6: 更新板块索引文件..."
python3 update_sections.py
if [ $? -ne 0 ]; then
    echo "❌ 板块索引更新失败！"
    exit 1
fi

# Step 5: 更新辣评索引
echo ""
echo "📋 Step 5/6: 更新辣评索引..."
python3 update_comments.py
if [ $? -ne 0 ]; then
    echo "❌ 辣评索引更新失败！"
    exit 1
fi


echo ""
echo "========================================="
echo "✅ 数据已更新完成（共6步校验/索引更新）"
echo "🔗 接下来由 cron 任务统一 git 提交推送"
echo "========================================="
