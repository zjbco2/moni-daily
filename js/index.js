const container = document.getElementById('shelvesContainer');
const PER_SHELF = 4;

let allEditions = [];
let fsIndex = null;        // FlexSearch Document 索引
let articleMap = new Map(); // id → article
let currentEditions = [];
let groupedData = [];

// ============================
// 混合分词引擎（中文单字 + 二元组 + 英文单词）
// ============================

function extractChinese(text) {
  const result = [];
  const SEG = /[\u4e00-\u9fff]+/g;
  let m;
  while ((m = SEG.exec(text)) !== null) result.push(m[0]);
  return result;
}

function tokenizeChinese(text) {
  const chars = [], bigrams = [];
  for (const seg of extractChinese(text)) {
    for (let i = 0; i < seg.length; i++) chars.push(seg[i]);
    if (seg.length > 1) for (let i = 0; i < seg.length - 1; i++) bigrams.push(seg[i] + seg[i + 1]);
  }
  return { chars, bigrams };
}

function tokenizeEnglish(text) {
  return (text.match(/[a-zA-Z0-9]{2,}/g) || []).map(w => w.toLowerCase());
}

function tokenize(text) {
  if (!text) return { chars: [], bigrams: [], english: [] };
  text = text.toLowerCase();
  const { chars, bigrams } = tokenizeChinese(text);
  return { chars, bigrams, english: tokenizeEnglish(text) };
}

// ============================
// 数据分组
// ============================

function groupEditions(editions) {
  const months = {}, monthOrder = [];
  for (const ed of editions) {
    const ym = ed.date.substr(0, 7);
    const md = ed.date.substr(5);
    const dayNum = parseInt(ed.date.substr(8));
    if (!months[ym]) { months[ym] = {}; monthOrder.push(ym); }
    if (!months[ym][md]) months[ym][md] = { date: ed.date, dayLabel: `${dayNum}日`, editions: [] };
    months[ym][md].editions.push(ed);
  }
  return monthOrder.map(ym => ({
    month: ym,
    monthLabel: parseInt(ym.substr(5)) + '月',
    days: Object.values(months[ym])
  }));
}

// ============================
// FlexSearch 索引构建
// ============================

function buildIndex(articles) {
  const t0 = Date.now();

  // 用 3 个独立的 Index（不是 Document），避免 per-field encode 配置的兼容问题
  // encode:false → FlexSearch 不二次编码，直接存储我们预处理好的 bigram 字符串
  // tokenize:'forward' → 允许前缀匹配，bigram 查询如"伊朗"能命中"伊朗"token
  const makeIndex = () => new FlexSearch.Index({ tokenize: 'forward', encode: false });

  const titleIdx   = makeIndex();
  const previewIdx = makeIndex();
  const commentIdx = makeIndex();

  for (const a of articles) {
    articleMap.set(a.id, a);
    const titleT   = tokenize(a.title || '');
    const previewT = tokenize(a.preview || '');
    const commentT = tokenize(a.comment || '');

    // 把 bigram + char + english 合并成一个字符串，encode:false 保证 FlexSearch 不再二次分词
    const titleStr   = [titleT.bigrams.join(' '),   titleT.chars.join(' '),   titleT.english.join(' ')].filter(Boolean).join(' ');
    const previewStr = [previewT.bigrams.join(' '), previewT.chars.join(' '), previewT.english.join(' ')].filter(Boolean).join(' ');
    const commentStr = [commentT.bigrams.join(' '), commentT.chars.join(' '), commentT.english.join(' ')].filter(Boolean).join(' ');

    titleIdx.add(a.id,   titleStr);
    previewIdx.add(a.id, previewStr);
    commentIdx.add(a.id,  commentStr);
  }

  // 保存为数组，供 flexSearch() 函数使用
  fsIndex = [
    { idx: titleIdx,   weight: 3 },
    { idx: previewIdx, weight: 1 },
    { idx: commentIdx, weight: 2 },
  ];

  console.log(`[FlexSearch] 索引构建完成：${articles.length} 篇，${Date.now() - t0}ms`);
}

// ============================
// 搜索
// ============================

function flexSearch(query) {
  const tok = tokenize(query);
  const searchTokens = [...tok.bigrams, ...tok.chars, ...tok.english].filter(Boolean);
  if (!searchTokens.length) return [];

  const scores = new Map(); // id → {score, article}

  for (const { idx, weight } of fsIndex) {
    // 搜索 query 的每个 token
    const tokenScores = {};
    for (const t of searchTokens) {
      // 每个 Index.search 返回匹配的 id 数组
      const ids = idx.search(t, { limit: 200 });
      for (const id of ids) {
        tokenScores[id] = (tokenScores[id] || 0) + weight;
      }
    }
    for (const [id, s] of Object.entries(tokenScores)) {
      if (!scores.has(id)) {
        scores.set(id, { score: s, article: articleMap.get(parseInt(id)) || articleMap.get(id) });
      } else {
        scores.get(id).score += s;
      }
    }
  }

  // 按分数降序，按 editionId 去重
  const sorted = Array.from(scores.values())
    .filter(s => s.article)
    .sort((a, b) => b.score - a.score);

  const seen = new Set(), results = [];
  for (const { article } of sorted) {
    if (!seen.has(article.editionId)) {
      seen.add(article.editionId);
      results.push(article);
    }
  }
  return results;
}

// ============================
// 加载数据
// ============================

async function init() {
  try {
    const edRes = await fetch('data/meta/editions.json?t=' + Date.now());
    const edData = await edRes.json();
    allEditions = edData.editions || [];
    groupedData = groupEditions(allEditions);

    document.getElementById('totalEditions').textContent = `累计 ${allEditions.length} 期`;
    updateCount(allEditions.length, false);
    renderShelves(allEditions);
    renderDateIndex();

    // 加载搜索索引并建 FlexSearch 索引
    try {
      const idxRes = await fetch('data/meta/search-index.json?t=' + Date.now());
      const idxData = await idxRes.json();
      if (idxData.articles) buildIndex(idxData.articles);
    } catch (e) {
      console.warn('[搜索] 索引加载失败，搜索不可用', e);
    }

    initScrollSpy();
  } catch (e) {
    container.innerHTML = '<div class="empty-shelf"><div class="icon">😵</div><p>数据加载失败，请刷新重试</p></div>';
    console.error('加载失败:', e);
  }
}

// ============================
// 更新数量显示
// ============================

function updateCount(n, isSearch) {
  const el = document.getElementById('sectionTitleText');
  if (isSearch) {
    el.innerHTML = `📰 找到 <span id="visibleCount">${n}</span> 期`;
  } else {
    el.innerHTML = `📰 共 <span id="visibleCount">${n}</span> 期日报`;
  }
}

// ============================
// 搜索 UI 绑定
// ============================

const searchInput  = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const sectionActions = document.querySelector('.section-actions');

document.querySelector('.search-label').addEventListener('click', function() {
  if (!searchInput.classList.contains('expanded')) {
    searchInput.classList.add('expanded');
    searchInput.placeholder = '搜索关键词...';
    sectionActions.classList.add('mode-search');
  }
  searchInput.focus();
});

searchInput.addEventListener('click', function() {
  if (!this.classList.contains('expanded')) {
    this.classList.add('expanded');
    this.placeholder = '搜索关键词...';
  }
});

searchInput.addEventListener('blur', function() {
  const input = this;
  setTimeout(() => {
    const active = document.activeElement;
    if (!active || (active !== input && !active.closest('.search-wrapper'))) {
      if (input.value.trim() === '') {
        input.classList.remove('expanded');
        input.placeholder = '';
        sectionActions.classList.remove('mode-search');
      }
    }
  }, 250);
});

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    this.value = '';
    this.dispatchEvent(new Event('input'));
    this.classList.remove('expanded');
    this.placeholder = '';
    this.blur();
  }
});

// ============================
// 搜索入口（FlexSearch or 原生兜底）
// ============================

searchInput.addEventListener('input', function() {
  const query = this.value.trim();
  searchClear.classList.toggle('visible', query.length > 0);
  if (query.length > 0) sectionActions.classList.add('mode-search');

  if (query === '') {
    updateCount(allEditions.length, false);
    renderShelves(allEditions);
    return;
  }

  let matchedEditions = [];

  if (fsIndex) {
    // FlexSearch 搜索
    const results = flexSearch(query);
    matchedEditions = allEditions.filter(ed => results.some(r => r.editionId === ed.id));
  } else {
    // 兜底：原生 includes（索引未加载时）
    const q = query.toLowerCase();
    const matchedIds = new Set();
    articleMap.forEach(a => {
      const text = [a.title, a.preview, a.comment, a.category, a.section].join(' ').toLowerCase();
      if (text.includes(q)) matchedIds.add(a.editionId);
    });
    matchedEditions = allEditions.filter(ed => matchedIds.has(ed.id));
  }

  updateCount(matchedEditions.length, true);
  renderShelves(matchedEditions);
});

searchClear.addEventListener('click', function(e) {
  e.stopPropagation();
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.focus();
});

// ============================
// 日期索引渲染
// ============================

function renderDateIndex() {
  const el = document.getElementById('dateIndex');
  if (!groupedData.length) { el.innerHTML = ''; return; }

  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  let html = '';
  for (const mg of groupedData) {
    for (const day of mg.days) {
      const count = day.editions.length;
      const lastDate = day.editions[count - 1].date;
      let label;
      if (day.date === todayStr) {
        label = '今天';
      } else {
        label = parseInt(day.date.substr(5)) + '月' + parseInt(day.date.substr(8)) + '日';
      }
      html += '<a class="idx-day" data-target="' + lastDate + '">'
            + '<span class="day-num">' + label + '</span>'
            + '<span class="day-count">' + count + '</span>'
            + '</a>';
    }
  }
  el.innerHTML = html;

  el.querySelectorAll('.idx-day').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      scrollToDate(this.dataset.target);
    });
  });
}

function scrollToDate(date) {
  const row = container.querySelector('.shelf-row[data-date="' + date + '"]');
  const monthDiv = document.getElementById('month-' + date.substr(0, 7).replace('-', ''));
  const target = row || monthDiv;
  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ============================
// 滚动监听（高亮当前日期索引）
// ============================

function initScrollSpy() {
  const entries = [];
  document.querySelectorAll('.shelf-row[data-date]').forEach(function(row) {
    const d = row.dataset.date;
    if (!entries.find(e => e.date === d)) entries.push({ date: d, el: row });
  });
  if (!entries.length) return;

  function update() {
    const scrollY = window.scrollY + window.innerHeight * 0.4;
    let active = entries[0].date;
    for (const entry of entries) {
      if (entry.el.getBoundingClientRect().top + window.scrollY < scrollY) active = entry.date;
    }
    document.querySelectorAll('.date-index .idx-day').forEach(function(a) {
      a.classList.toggle('active', a.dataset.target === active);
    });
  }

  let ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(() => { update(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  setTimeout(update, 300);
}

// ============================
// 渲染报纸架
// ============================

function renderShelves(list) {
  container.innerHTML = '';
  currentEditions = list;

  if (list.length === 0) {
    container.innerHTML = '<div class="search-empty"><div class="icon">🔍</div><p>没有找到相关的日报</p></div>';
    return;
  }

  const monthGroups = buildMonthGroups(list);

  for (const mg of monthGroups) {
    const divider = document.createElement('div');
    divider.className = 'month-divider';
    divider.id = 'month-' + mg.month.replace('-', '');
    divider.innerHTML = '<span class="month-label">' + mg.monthLabel + '</span>';
    container.appendChild(divider);

    for (let i = 0; i < mg.editions.length; i += PER_SHELF) {
      const rowPapers = mg.editions.slice(i, i + PER_SHELF);
      const shelfRow = document.createElement('div');
      shelfRow.className = 'shelf-row';
      shelfRow.dataset.date = mg.editions[i].date;

      let papersHtml = '<div class="papers-row">';
      rowPapers.forEach(ed => {
        const headlinesHtml = (ed.headlines || []).slice(0, 4).map(h => '<li>' + h + '</li>').join('');
        papersHtml += '<div class="paper-card" data-file="' + ed.file + '">'
          + '<div class="paper-inner">'
            + '<div class="date-tab">'
              + '<div class="year">' + ed.year + '</div>'
              + '<div class="month">' + ed.month + '</div>'
              + '<div class="day">' + ed.day + '</div>'
              + '<div class="weekday">' + ed.weekday + '</div>'
            + '</div>'
            + '<div class="issue-badge">' + ed.issue + '</div>'
            + '<div class="paper-content">'
              + '<div class="mini-masthead">'
                + '<h2>茉<em class="neon">霓</em>日报</h2>'
                + '<div class="mini-subtitle">' + ed.month + ed.day + '日 · ' + ed.weekday + ' · ' + ed.issue + '</div>'
              + '</div>'
              + '<div class="paper-bottom">'
                + '<ul class="mini-headlines">' + headlinesHtml + '</ul>'
              + '</div>'
              + '<div class="expand-hint">▸ 点击展开阅读</div>'
            + '</div>'
          + '</div>'
        + '</div>';
      });
      papersHtml += '</div>';
      shelfRow.innerHTML = papersHtml + '<div class="wood-plank"></div>';
      container.appendChild(shelfRow);
    }
  }

  animateCards();
}

function buildMonthGroups(editions) {
  const groups = [];
  for (const ed of editions) {
    const ym = ed.date.substr(0, 7);
    let mg = groups.find(g => g.month === ym);
    if (!mg) { mg = { month: ym, monthLabel: parseInt(ed.date.substr(5)) + '月', editions: [] }; groups.push(mg); }
    mg.editions.push(ed);
  }
  return groups;
}

// ============================
// 入场动画
// ============================

function animateCards() {
  const cards = document.querySelectorAll('.paper-card');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        entry.target.addEventListener('transitionend', function handler() {
          entry.target.style.removeProperty('transform');
          entry.target.removeEventListener('transitionend', handler);
        }, { once: true });
      }
    });
  }, { threshold: 0.1 });

  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `opacity 0.6s ease ${i * 0.08}s, transform 0.6s ease ${i * 0.08}s`;
    observer.observe(card);
  });
}

// ============================
// 点击展开
// ============================

const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('closeBtn');
const frame = document.getElementById('paperFrame');

document.addEventListener('click', e => {
  const card = e.target.closest('.paper-card');
  if (card) {
    const url = card.dataset.file;
    frame.src = (url.includes('?') ? url + '&' : url + '?') + 't=' + Date.now();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
});

function closePaper() {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  frame.src = 'about:blank';
}

closeBtn.addEventListener('click', closePaper);
overlay.addEventListener('click', e => { if (e.target === overlay) closePaper(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePaper(); });

// ============================
// 启动
// ============================

init();
