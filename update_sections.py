#!/usr/bin/env python3
"""自动更新板块索引文件：从所有日报JSON中提取各板块文章，生成独立索引文件。"""
import json, glob, os, sys

SECTIONS_DIR = 'data/meta'
DATA_GLOB = 'data/20*.json'

SECTION_MAP = {
    '国际风云': 'international',
    '科技前沿': 'tech',
    '国内财经': 'finance',
    '娱乐快讯': 'entertainment'
}

def update_sections():
    """从所有日报JSON生成板块索引文件"""
    sections = {
        'headline': [],
        'international': [],
        'tech': [],
        'finance': [],
        'entertainment': []
    }

    for f in sorted(glob.glob(DATA_GLOB)):
        try:
            data = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            print(f'⚠️ 跳过 {f}: {e}')
            continue

        date = data.get('date', '')
        weekday = data.get('weekday', '')
        issue = data.get('issue', '')

        # 头条
        h = data.get('headline')
        if h and h.get('title'):
            sections['headline'].append({
                'date': date, 'weekday': weekday, 'issue': issue,
                'title': h.get('title', ''),
                'content': h.get('content', ''),
                'comment': h.get('comment', ''),
                'url': h.get('url', ''),
                'category': h.get('category', '')
            })

        # 各板块
        for sec in data.get('sections', []):
            key = SECTION_MAP.get(sec.get('name', ''))
            if not key:
                continue
            for art in sec.get('articles', []):
                sections[key].append({
                    'date': date, 'weekday': weekday, 'issue': issue,
                    'title': art.get('title', ''),
                    'content': art.get('content', ''),
                    'comment': art.get('comment', ''),
                    'url': art.get('url', ''),
                    'category': art.get('category', '')
                })
            for item in sec.get('items', []):
                sections[key].append({
                    'date': date, 'weekday': weekday, 'issue': issue,
                    'title': item.get('title', ''),
                    'content': item.get('content', ''),
                    'comment': '',
                    'url': item.get('url', ''),
                    'category': '快讯'
                })

    # 写入文件
    os.makedirs(SECTIONS_DIR, exist_ok=True)
    for key in sections:
        sections[key].sort(key=lambda x: x['date'], reverse=True)
        output = {
            'section': key,
            'total': len(sections[key]),
            'articles': sections[key]
        }
        path = os.path.join(SECTIONS_DIR, f'{key}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f'✅ {key}.json: {len(sections[key])} 篇文章')

    print('\n✅ 板块索引更新完毕')

if __name__ == '__main__':
    update_sections()
