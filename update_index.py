#!/usr/bin/env python3
"""
自动更新 search-index.json：从今日日报JSON提取文章，追加到索引。
用法: python3 update_index.py data/20260331-2.json
"""
import json, sys, os
from datetime import datetime

def truncate(text, max_len=120):
    if not text:
        return ""
    return text[:max_len] + ("..." if len(text) > max_len else "")

def extract_articles(daily_json_path):
    """从日报JSON提取search-index格式的文章列表"""
    with open(daily_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    date_str = data['date']  # e.g. "20260331"
    # 格式化日期: 20260331 -> 2026-03-31
    formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    issue = data.get('issue', '')

    articles = []

    # 头条
    h = data.get('headline', {})
    if h and h.get('title'):
        articles.append({
            "id": h.get('id', 'art-lead'),
            "editionId": None,  # 后面填
            "date": formatted_date,
            "issue": issue,
            "section": "头条",
            "category": h.get('category', ''),
            "title": h.get('title', ''),
            "preview": truncate(h.get('content', '')),
            "comment": h.get('comment', ''),
            "target": h.get('id', 'art-lead')
        })

    # 板块文章
    for sec in data.get('sections', []):
        sec_name = sec.get('name', '')
        for art in sec.get('articles', []):
            if art.get('title'):
                articles.append({
                    "id": art.get('id', ''),
                    "editionId": None,
                    "date": formatted_date,
                    "issue": issue,
                    "section": sec_name,
                    "category": art.get('category', ''),
                    "title": art.get('title', ''),
                    "preview": truncate(art.get('content', '')),
                    "comment": art.get('comment', ''),
                    "target": art.get('id', '')
                })

        # 娱乐快讯 items
        if sec.get('isBrief'):
            for item in sec.get('items', []):
                if item.get('title'):
                    articles.append({
                        "id": item.get('id', ''),
                        "editionId": None,
                        "date": formatted_date,
                        "issue": issue,
                        "section": sec_name,
                        "category": "⚡ 快讯",
                        "title": item.get('title', ''),
                        "preview": truncate(item.get('content', '')),
                        "comment": "",
                        "target": item.get('id', '')
                    })

    return articles

def update_index(daily_json_path, index_path='data/meta/search-index.json'):
    """更新search-index.json"""
    # 读取现有索引
    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    # 确定editionId
    edition_id = index['totalArticles']  # 用当前总数作为新editionId起点不准确
    # 实际上editionId应该是editions的最新id，但更简单的方法：从editions.json读
    try:
        with open('data/meta/editions.json', 'r', encoding='utf-8') as f:
            editions = json.load(f)
        edition_id = editions['editions'][0]['id']  # 最新一期的id
    except:
        edition_id = 0

    # 提取新文章
    new_articles = extract_articles(daily_json_path)
    for a in new_articles:
        a['editionId'] = edition_id

    # 去重：跳过已有文章（按标题+日期匹配）
    existing_titles = {(a['title'], a['date']) for a in index['articles']}
    deduped = [a for a in new_articles if (a['title'], a['date']) not in existing_titles]
    skipped = len(new_articles) - len(deduped)

    # 追加到索引
    index['articles'].extend(deduped)
    index['totalArticles'] = len(index['articles'])
    index['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')

    # 写回
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    msg = f"✅ search-index.json 已更新: +{len(deduped)} 篇"
    if skipped:
        msg += f" (跳过 {skipped} 篇重复)"
    msg += f", 总计 {index['totalArticles']} 篇"
    print(msg)
    return len(new_articles)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python3 update_index.py data/20260331-2.json")
        sys.exit(1)
    update_index(sys.argv[1])
