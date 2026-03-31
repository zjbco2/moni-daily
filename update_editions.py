#!/usr/bin/env python3
"""
自动更新 editions.json：从今日日报JSON提取元数据，插入到 editions 数组最前面。
用法: python3 update_editions.py data/20260331-2.json
"""
import json, sys, os
from datetime import datetime

WEEKDAYS = {'01': '周一', '02': '周二', '03': '周三', '04': '周四',
            '05': '周五', '06': '周六', '07': '周日', '08': '周一',
            '09': '周二', '10': '周三', '11': '周四', '12': '周五',
            '13': '周六', '14': '周日', '15': '周一', '16': '周二',
            '17': '周三', '18': '周四', '19': '周五', '20': '周六',
            '21': '周日', '22': '周一', '23': '周二', '24': '周三',
            '25': '周四', '26': '周五', '27': '周六', '28': '周日',
            '29': '周一', '30': '周二', '31': '周三'}

def extract_headlines(data):
    """从日报JSON提取所有标题"""
    headlines = []

    # 头条
    h = data.get('headline', {})
    if h.get('title'):
        headlines.append(h['title'])

    # 板块文章标题
    for sec in data.get('sections', []):
        for art in sec.get('articles', []):
            if art.get('title'):
                headlines.append(art['title'])
        # 娱乐快讯
        if sec.get('isBrief'):
            for item in sec.get('items', []):
                if item.get('title'):
                    headlines.append(item['title'])

    return headlines

def update_editions(daily_json_path, editions_path='editions.json'):
    """更新editions.json"""
    # 读取日报JSON
    with open(daily_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 读取现有editions
    with open(editions_path, 'r', encoding='utf-8') as f:
        editions = json.load(f)

    date_str = data['date']  # "20260331"
    issue_text = data.get('issue', '')

    # 检查是否已存在（去重：同日期+同期号不重复添加）
    date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    existing = [e for e in editions['editions']
                if e.get('date') == date_formatted and e.get('issue') == issue_text]
    if existing:
        print(f"⚠️ {issue_text} 已存在 (id={existing[0]['id']}), 跳过")
        return existing[0]['id']

    # 确定新id
    new_id = 1
    if editions['editions']:
        new_id = editions['editions'][0]['id'] + 1

    # 提取文件名（从daily_json_path推算）
    basename = os.path.basename(daily_json_path).replace('.json', '')
    file_name = f"daily-news.html?date={basename}"

    # 解析日期
    year = date_str[:4]
    month_num = date_str[4:6]
    day = date_str[6:8]
    weekday = data.get('weekday', WEEKDAYS.get(day, ''))

    # 提取标题
    headlines = extract_headlines(data)

    # 构建新edition
    new_edition = {
        "id": new_id,
        "date": f"{year}-{month_num}-{day}",
        "year": year,
        "month": f"{int(month_num)}月",
        "day": str(int(day)),
        "weekday": weekday,
        "issue": issue_text,
        "file": file_name,
        "headlines": headlines
    }

    # 插入到最前面
    editions['editions'].insert(0, new_edition)
    editions['lastUpdated'] = f"{year}-{month_num}-{day}"

    # 写回
    with open(editions_path, 'w', encoding='utf-8') as f:
        json.dump(editions, f, ensure_ascii=False, indent=2)

    print(f"✅ editions.json 已更新: {issue_text} (id={new_id}), 共 {len(headlines)} 条标题")
    return new_id

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python3 update_editions.py data/20260331-2.json")
        sys.exit(1)
    update_editions(sys.argv[1])
