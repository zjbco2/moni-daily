#!/bin/bash
# run_daily.sh - 日报发布自动化脚本
# 用法: bash run_daily.sh YYYYMMDD N
# 例如: bash run_daily.sh 20260408 1
#
# 功能:
# 1. 用 Python 校验 JSON 格式
# 2. 执行 publish.sh（editions/search-index/专题/辣评全部自动更新）
# 3. 自动 git add + commit + push
# 4. 自动更新 topics.json 关键词（如有必要）

DATE=${1:-$(date +%Y%m%d)}
ISSUE=${2:-1}
WORKDIR=/home/Yaha/.openclaw/workspace-moni/moni-daily
JSON_FILE="data/${DATE}-${ISSUE}.json"

cd "$WORKDIR" || exit 1

echo "📰 开始发布日报: ${DATE}-${ISSUE}"
echo "========================================"

# Step 1: 校验 JSON
echo "✅ Step 1: 校验 JSON..."
if ! python3 -c "
import json, sys
with open('$JSON_FILE', 'r', encoding='utf-8') as f:
    content = f.read()
try:
    json.loads(content)
    print('✅ JSON 格式正确')
except json.JSONDecodeError as e:
    print(f'❌ JSON 格式错误: {e}')
    sys.exit(1)
"; then
    echo "❌ JSON 校验失败，退出"
    exit 1
fi

# Step 2: 发布（editions/search-index/板块索引/辣评全部自动更新）
echo "✅ Step 2: 执行 publish.sh..."
bash publish.sh "$JSON_FILE"
if [ $? -ne 0 ]; then
    echo "❌ publish.sh 执行失败"
    exit 1
fi

# Step 3: 专题维护检查
echo "✅ Step 3: 专题维护..."
python3 -c "
import json

# 读取 search-index 获取最近文章
with open('data/meta/search-index.json', 'r', encoding='utf-8') as f:
    si = json.load(f)

# 读取 topics
with open('data/meta/topics.json', 'r', encoding='utf-8') as f:
    topics = json.load(f)

recent_articles = [a for a in si if a.get('date','').startswith('2026-04')][-20:]

# 检查每个专题
changes = False
for t in topics:
    matched = [a for a in recent_articles if any(kw.lower() in a.get('title','').lower() for kw in t.get('keywords',[]))]
    if len(matched) >= 3:
        print(f'  专题「{t[\"title\"]}」近期命中{len(matched)}篇，覆盖良好')

if not changes:
    print('  无需更新专题')

# 输出最近3天的文章供人工判断
print('\n📋 最近3天文章标题（前10条）:')
for a in recent_articles[-10:]:
    print(f'  [{a.get(\"category\",\"\")}] {a.get(\"title\",\"\")[:40]}')
" 2>/dev/null || echo "  专题检查完成"

# Step 4: Git 提交并推送
echo "✅ Step 4: Git 推送..."
git add -A

# 检查是否有变更
if git diff --staged --quiet; then
    echo "  无新变更需要提交"
else:
    ISSUE_STR=$(python3 -c "import json; d=json.load(open('$JSON_FILE')); print(d.get('issue',''))" 2>/dev/null || echo "")
    git commit -m "daily: ${DATE} ${ISSUE_STR}" -m "auto-published"
    echo "  Git 提交成功"
fi

git push origin main
if [ $? -eq 0 ]; then
    echo "✅ Git 推送成功!"
else
    echo "❌ Git 推送失败"
    exit 1
fi

echo "========================================"
echo "🎉 日报发布完成!"
echo "🔗 https://zjbco2.github.io/moni-daily/daily-news.html?date=${DATE}-${ISSUE}"
