#!/usr/bin/env python3
"""
茉霓日报 JSON 校验修复脚本
cron 生成 JSON 后自动运行，修复常见格式问题。
用法: python3 validate_daily.py data/20260331.json [--fix-ticker]
  --fix-ticker  用文章实际标题重新生成 ticker（更准确）
"""
import json, sys, os, re

def collect_articles(data):
    """收集所有文章 {id: {title, category}}"""
    articles = {}
    h = data.get('headline', {})
    if h:
        h['id'] = h.get('id') or 'art-lead'
        articles[h['id']] = h
    
    prefixes = {'国际风云': 'int', '科技前沿': 'tech', '国内财经': 'fin', '娱乐快讯': 'ent'}
    for sec in data.get('sections', []):
        name = sec.get('name', '')
        prefix = prefixes.get(name, 'other')
        items = sec.get('items', []) if sec.get('isBrief') else sec.get('articles', [])
        for i, item in enumerate(items):
            aid = item.get('id') or f'art-{prefix}-{i+1}'
            item['id'] = aid
            articles[aid] = item
    return articles

def add_ids(data):
    """给所有文章补 id"""
    collect_articles(data)

def fix_section_name(data):
    """修复最后一个板块名"""
    sections = data.get('sections', [])
    if sections and sections[-1].get('isBrief') and sections[-1].get('name') != '娱乐快讯':
        sections[-1]['name'] = '娱乐快讯'
        return True
    return False

def fix_ticker_smart(data):
    """用文章标题智能匹配修复 ticker"""
    ticker = data.get('ticker', [])
    if not ticker:
        return False
    
    # 已经是正确格式？
    if ticker and isinstance(ticker[0], dict) and ticker[0].get('target'):
        return False
    
    articles = collect_articles(data)
    
    # 如果是纯字符串，转成对象
    texts = []
    for t in ticker:
        if isinstance(t, str):
            texts.append(t)
        elif isinstance(t, dict):
            texts.append(t.get('main', ''))
    
    new_ticker = []
    used_ids = set()
    
    for text in texts:
        # 按关键词匹配文章
        best_id = None
        best_score = 0
        for aid, art in articles.items():
            if aid in used_ids:
                continue
            title = art.get('title', '')
            score = 0
            # 关键词匹配：取标题中 2-4 字的关键词
            keywords = re.findall(r'[\u4e00-\u9fff]{2,4}', title)
            for kw in keywords:
                if kw in text:
                    score += len(kw)
            if score > best_score:
                best_score = score
                best_id = aid
        
        if best_id and best_score >= 2:
            used_ids.add(best_id)
        else:
            # 降级：分配第一个未使用的
            for aid in articles:
                if aid not in used_ids:
                    best_id = aid
                    used_ids.add(aid)
                    break
        
        if best_id:
            new_ticker.append({
                'main': text,
                'sub': '',
                'target': best_id
            })
    
    data['ticker'] = new_ticker
    return True

def regenerate_ticker(data):
    """用文章实际标题重新生成 ticker（更准确）"""
    articles = collect_articles(data)
    
    # 选择 8 篇不同的文章
    ticker_items = []
    # 头条优先
    if 'art-lead' in articles:
        h = articles['art-lead']
        ticker_items.append({
            'main': f"{h.get('category','📌')[:2]} {h.get('title','')[:30]}",
            'sub': '',
            'target': 'art-lead'
        })
    
    # 从各板块选文章
    section_ids = {'int': [], 'tech': [], 'fin': [], 'ent': []}
    for aid in articles:
        for prefix in section_ids:
            if aid.startswith(f'art-{prefix}-'):
                section_ids[prefix].append(aid)
    
    # 轮流从各板块取
    idx = {'int': 0, 'tech': 0, 'fin': 0, 'ent': 0}
    while len(ticker_items) < 8:
        added = False
        for prefix in ['int', 'tech', 'fin', 'ent']:
            if len(ticker_items) >= 8:
                break
            i = idx[prefix]
            if i < len(section_ids[prefix]):
                aid = section_ids[prefix][i]
                art = articles[aid]
                # 生成简短的 ticker 标题
                cat = art.get('category', '')
                emoji = cat[:2] if cat else '📌'
                title = art.get('title', '')[:30]
                ticker_items.append({
                    'main': f'{emoji} {title}',
                    'sub': '',
                    'target': aid
                })
                idx[prefix] += 1
                added = True
        if not added:
            break
    
    # 复制一份保证无缝循环
    data['ticker'] = ticker_items + ticker_items
    return True

def fix_quotes_in_string(s):
    """修复字符串中的英文半角引号"""
    if not isinstance(s, str):
        return s
    result = re.sub(
        r'(?<=[\u4e00-\u9fff\uff00-\uffef])"([^"]{1,30})"(?=[\u4e00-\u9fff\uff00-\uffef，。！？、；：…—\s\]\},\)\]，])',
        r'「\1」', s
    )
    return result

def fix_quotes(data):
    """递归修复所有字符串字段中的引号"""
    def walk(obj):
        if isinstance(obj, dict):
            return {k: walk(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [walk(v) for v in obj]
        elif isinstance(obj, str):
            return fix_quotes_in_string(obj)
        return obj
    return walk(data)

def validate(data):
    """校验，返回问题列表"""
    issues = []
    if not data.get('headline', {}).get('id'):
        issues.append('headline 缺少 id')
    
    for sec in data.get('sections', []):
        name = sec.get('name', '')
        items = sec.get('items', []) if sec.get('isBrief') else sec.get('articles', [])
        for item in items:
            if not item.get('id'):
                issues.append(f'{name}: 缺少 id')
    
    sections = data.get('sections', [])
    if sections and sections[-1].get('isBrief') and sections[-1].get('name') != '娱乐快讯':
        issues.append(f'板块名错误: {sections[-1].get("name")}')
    
    ticker = data.get('ticker', [])
    if ticker:
        if isinstance(ticker[0], str):
            issues.append('ticker 是字符串格式')
        elif isinstance(ticker[0], dict) and not ticker[0].get('target'):
            issues.append('ticker 缺少 target')
    
    if ticker and isinstance(ticker[0], dict):
        # 只检查前半部分的重复（后半是循环用的副本）
        half = len(ticker) // 2 or len(ticker)
        targets = [ticker[i].get('target') for i in range(half)]
        seen = set()
        for t in targets:
            if t in seen:
                issues.append(f'ticker 重复: {t}')
            seen.add(t)
    
    return issues

def main():
    if len(sys.argv) < 2:
        print('用法: python3 validate_daily.py <json_file> [--fix-ticker]')
        sys.exit(1)
    
    filepath = sys.argv[1]
    regenerate = '--fix-ticker' in sys.argv
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f'📄 校验: {filepath}')
    
    # 1. 补 id
    add_ids(data)
    
    # 2. 修复板块名
    if fix_section_name(data):
        print('  🔧 板块名 → 娱乐快讯')
    
    # 3. 修复 ticker
    if regenerate:
        regenerate_ticker(data)
        print('  🔧 重新生成 ticker')
    elif fix_ticker_smart(data):
        print('  🔧 修复 ticker 格式')
    
    # 4. 修复引号
    data = fix_quotes(data)
    
    # 保存
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('  💾 已保存')
    
    # 校验
    issues = validate(data)
    if issues:
        print('  ⚠️ 剩余问题:')
        for issue in issues:
            print(f'    - {issue}')
    else:
        print('  ✅ 全部通过！')
    
    return len(issues) == 0

if __name__ == '__main__':
    main()
