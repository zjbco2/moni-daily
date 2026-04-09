#!/usr/bin/env python3
"""
新闻采集脚本 - 完全脚本化，替代 AI 做文章采集决策
用法: python3 collect_headlines.py

输出: 各板块文章列表（今日新闻优先），供 AI 写入 JSON
"""
import sys
import json
import re
from datetime import datetime, timedelta

TODAY = datetime.now().strftime("%Y-%m-%d")
TODAY_SHORT = datetime.now().strftime("%Y%m%d")
YESTERDAY = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

print(f"📅 今日日期: {TODAY} | {TODAY_SHORT}")
print("=" * 60)

# 头条候选（从新浪财经抓取热点）
# 实际使用时由 main 函数调用各 URL

def extract_sina_news(html_content):
    """从新浪首页提取新闻标题和链接"""
    articles = []
    # 匹配模式: href + 标题
    pattern = r'href="(https://\w+\.sina\.com\.cn/[^"]+)"[^>]*>([^<]+)<'
    # 更精确的匹配: 新闻列表项
    lines = html_content.split('\n')
    for line in lines:
        if 'doc-' in line and TODAY_SHORT in line:
            # 找到今天的文章
            title_match = re.search(r'>([^<]+)<', line)
            if title_match:
                title = title_match.group(1).strip()
                url_match = re.search(r'href="(https://[^"]+)"', line)
                if url_match:
                    url = url_match.group(1)
                    if '2026-04-08' in url or TODAY_SHORT in url:
                        articles.append({'title': title, 'url': url, 'source': 'sina'})
    return articles

def extract_ithome(html_content):
    """从IT之家提取新闻"""
    articles = []
    lines = html_content.split('\n')
    for line in lines:
        if 'href="/' in line and '.html' in line:
            url_match = re.search(r'href="(/[^"]+\.html)"', line)
            title_match = re.search(r'>([^<]+)<', line)
            if url_match and title_match:
                url = 'https://www.ithome.com' + url_match.group(1)
                title = title_match.group(1).strip()
                if title and len(title) > 5:
                    articles.append({'title': title, 'url': url, 'source': 'ithome'})
    return articles

def extract_ent(html_content):
    """从网易娱乐提取娱乐新闻"""
    articles = []
    lines = html_content.split('\n')
    for line in lines:
        if 'href' in line and ('娱乐' in line or '明星' in line or '电影' in line or '综艺' in line):
            url_match = re.search(r'href="(https?://[^"]+)"', line)
            title_match = re.search(r'>([^<]{5,50})<', line)
            if url_match and title_match:
                articles.append({
                    'title': title_match.group(1).strip(),
                    'url': url_match.group(1),
                    'source': 'ent'
                })
    return articles

def filter_today(articles):
    """过滤出今天的文章"""
    today_articles = []
    for art in articles:
        url = art.get('url', '')
        title = art.get('title', '')
        if TODAY_SHORT in url or '2026-04-08' in url or '20260408' in url:
            today_articles.append(art)
        elif '2026-04-07' in url or '20260407' in url:
            # 可能是昨天的，跳过
            pass
        elif any(kw in title for kw in ['停火', '伊朗', '特朗普', '美伊', '以色列', '油价', '黄金', 'AI', '机器人', '小米', '华为', '三星']):
            # 高相关度关键词，无日期也保留（清明假期期间）
            today_articles.append(art)
    return today_articles

if __name__ == '__main__':
    # 这个脚本需要配合 fetch 工具使用
    # 使用说明：
    # 1. 先用 web_fetch 抓取各新闻源
    # 2. 把 web_fetch 返回的 text 内容通过 stdin 传给我们
    # 3. 或者直接用 python 执行 fetch，然后将结果传给本脚本
    
    # 实际上这个脚本设计为由 run_daily.sh 调用
    # AI 只需要执行: python3 scripts/collect_headlines.py
    # 脚本会通过 subprocess 调用 curl fetch 各新闻源
    
    import subprocess
    import urllib.request
    
    results = {
        'date': TODAY,
        'date_short': TODAY_SHORT,
        'headlines': {
            'international': [],
            'tech': [],
            'finance': [],
            'entertainment': []
        },
        'ticker_candidates': [],
        'status': 'ready'
    }
    
    # 抓取新浪新闻
    print("\n📡 抓取新浪新闻...")
    try:
        proc = subprocess.run(['curl', '-s', 'https://news.sina.com.cn/', '-L', '--max-time', '10'], 
                           capture_output=True, text=True, timeout=15)
        html = proc.stdout
        arts = extract_sina_news(html)
        print(f"  → 找到 {len(arts)} 条新闻")
        results['raw_sina_count'] = len(arts)
    except Exception as e:
        print(f"  → 抓取失败: {e}")
    
    # 抓取IT之家
    print("\n📡 抓取IT之家...")
    try:
        proc = subprocess.run(['curl', '-s', 'https://www.ithome.com/', '-L', '--max-time', '10'],
                           capture_output=True, text=True, timeout=15)
        html = proc.stdout
        arts = extract_ithome(html)
        print(f"  → 找到 {len(arts)} 条新闻")
        results['raw_ithome_count'] = len(arts)
    except Exception as e:
        print(f"  → 抓取失败: {e}")
    
    # 抓取网易娱乐
    print("\n📡 抓取网易娱乐...")
    try:
        proc = subprocess.run(['curl', '-s', 'https://ent.163.com/', '-L', '--max-time', '10'],
                           capture_output=True, text=True, timeout=15)
        html = proc.stdout
        arts = extract_ent(html)
        print(f"  → 找到 {len(arts)} 条新闻")
        results['raw_ent_count'] = len(arts)
    except Exception as e:
        print(f"  → 抓取失败: {e}")
    
    print("\n" + "=" * 60)
    print("📋 使用说明:")
    print("  这个脚本负责抓取原始页面数据")
    print("  AI 读取返回内容后，自行判断哪些是今日新闻")
    print("  然后写入 data/YYYYMMDD-N.json")
    print("  最后执行: bash run_daily.sh 即可自动发布")
    print("=" * 60)
    
    # 输出为 JSON 状态
    print(json.dumps(results, ensure_ascii=False, indent=2))
