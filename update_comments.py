#!/usr/bin/env python3
"""从所有板块索引中提取辣评，生成 comments.json"""
import json, os, glob

META_DIR = 'data/meta'

SECTION_FILES = {
    'headline': '头条',
    'international': '国际风云',
    'tech': '科技前沿',
    'finance': '国内财经',
    'entertainment': '娱乐快讯',
}

def update_comments():
    comments = []
    seen = set()  # 去重

    for file_key, section_name in SECTION_FILES.items():
        path = os.path.join(META_DIR, f'{file_key}.json')
        if not os.path.exists(path):
            continue
        with open(path) as f:
            data = json.load(f)
        for art in data.get('articles', []):
            comment = art.get('comment', '').strip()
            if not comment:
                continue
            title = art.get('title', '')
            date = art.get('date', '')
            dedup_key = f'{date}|{title}|{comment}'
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            comments.append({
                'comment': comment,
                'title': title,
                'date': date,
                'section': section_name,
                'url': art.get('url', ''),
                'weekday': art.get('weekday', ''),
                'issue': art.get('issue', ''),
            })

    # 按日期倒序
    comments.sort(key=lambda x: x['date'], reverse=True)

    # 按板块统计
    by_section = {}
    for c in comments:
        sec = c['section']
        by_section[sec] = by_section.get(sec, 0) + 1

    output = {
        'total': len(comments),
        'by_section': by_section,
        'comments': comments,
    }

    out_path = os.path.join(META_DIR, 'comments.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f'✅ 已生成 {out_path}：{len(comments)} 条辣评')
    for sec, count in sorted(by_section.items()):
        print(f'   {sec}: {count} 条')

if __name__ == '__main__':
    update_comments()
