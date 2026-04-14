const container = document.getElementById('shelvesContainer');
const PER_SHELF = 4;

let allEditions = [];
let fsIndex = null;        // FlexSearch 索引（已废弃，保留兼容性
let articleMap = new Map(); // id → article
let currentEditions = [];
let groupedData = [];

// ============================
// 混合分词引擎（中文单字 + 二元组 + 英文单词）
// ============================

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
  // article id 并非全局唯一（不同期复用 art-lead/art-int-1 等）
  // 用复合 key 确保每篇文章独立存储
  for (const a of articles) {
    articleMap.set(a.id + '|' + a.editionId, a);
  }
}

// ============================
// 搜索
// ============================

function flexSearch(query) {
  const q = query.toLowerCase();

  const scores = new Map(); // id → {score, article}

  for (const [id, a] of articleMap) {
    const titleText   = (a.title || '').toLowerCase();
    const previewText = (a.preview || '').toLowerCase();
    const commentText = (a.comment || '').toLowerCase();

    let score = 0;
    // 标题命中最强，评论次之，摘要第三
    if (titleText.includes(q))   score += 3;
    if (commentText.includes(q)) score += 2;
    if (previewText.includes(q)) score += 1;

    if (score > 0) {
      scores.set(id, { score, article: a });
    }
  }

  // 按分数降序，按 editionId 去重
  const sorted = Array.from(scores.values())
    .filter(s => s.article)
    .sort((a, b) => b.score - a.score);

  const editionSeen = new Set();
  const results = [];
  for (const { article } of sorted) {
    if (!editionSeen.has(article.editionId)) {
      editionSeen.add(article.editionId);
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

    // 加载搜索索引到内存
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
// 搜索
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

  // 使用朴素 substring 搜索（516 篇文章总数据量 <1MB，线性扫描 <5ms）
  const results = flexSearch(query);
  const matchedEditionIds = new Set(results.map(r => r.editionId));
  const matchedEditions = allEditions.filter(ed => matchedEditionIds.has(ed.id));

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
