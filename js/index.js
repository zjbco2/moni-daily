const container = document.getElementById('shelvesContainer');
  const PER_SHELF = 4;
  
  let allEditions = [];
  let searchIndex = [];
  let currentEditions = [];
  let groupedData = [];  // [{month, monthLabel, days: [{date, dayLabel, editions: []}]}]
  
  // ============================
  // 数据分组
  // ============================
  function groupEditions(editions) {
    const months = {};
    const monthOrder = [];
    for (const ed of editions) {
      const ym = ed.date.substr(0, 7);
      const md = ed.date.substr(5);
      const dayNum = parseInt(ed.date.substr(8));
      if (!months[ym]) {
        months[ym] = {};
        monthOrder.push(ym);
      }
      if (!months[ym][md]) {
        months[ym][md] = { date: ed.date, dayLabel: `${dayNum}日`, editions: [] };
      }
      months[ym][md].editions.push(ed);
    }
    return monthOrder.map(ym => {
      const days = Object.values(months[ym]);
      return {
        month: ym,
        monthLabel: parseInt(ym.substr(5)) + '月',
        days: days
      };
    });
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
      
      fetch('data/meta/search-index.json?t=' + Date.now())
        .then(r => r.json())
        .then(d => { searchIndex = d.articles || []; })
        .catch(e => { /* 搜索未就绪 */ });
      
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
  // 搜索
  // ============================
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  
  var sectionActions = document.querySelector('.section-actions');
  
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
  
  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', query.length > 0);
    if (query.length > 0) sectionActions.classList.add('mode-search');
    
    if (query === '') {
      updateCount(allEditions.length, false);
      renderShelves(allEditions);
      return;
    }
    
    const matchedArticleEditionIds = new Set();
    searchIndex.forEach(article => {
      const text = [article.title, article.preview, article.comment, article.category, article.section].join(' ').toLowerCase();
      if (text.includes(query)) {
        matchedArticleEditionIds.add(article.editionId);
      }
    });
    
    const filtered = allEditions.filter(ed => matchedArticleEditionIds.has(ed.id));
    
    updateCount(filtered.length, true);
    renderShelves(filtered);
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
    var el = document.getElementById('dateIndex');
    if (!groupedData.length) { el.innerHTML = ''; return; }
    
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    
    var html = '';
    for (var m = 0; m < groupedData.length; m++) {
      var mg = groupedData[m];
      for (var d = 0; d < mg.days.length; d++) {
        var day = mg.days[d];
        var count = day.editions.length;
        var lastDate = day.editions[count - 1].date;
        
        // 中文日期
        var label;
        if (day.date === todayStr) {
          label = '今天';
        } else {
          var mm = parseInt(day.date.substr(5));
          var dd = parseInt(day.date.substr(8));
          label = mm + '月' + dd + '日';
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
    var row = container.querySelector('.shelf-row[data-date="' + date + '"]');
    var monthDiv = document.getElementById('month-' + date.substr(0, 7).replace('-', ''));
    var target = row || monthDiv;
    if (target) {
      var top = target.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }
  
  // ============================
  // 滚动监听（高亮当前日期索引）
  // ============================
  function initScrollSpy() {
    var entries = [];
    
    document.querySelectorAll('.shelf-row[data-date]').forEach(function(row) {
      var d = row.dataset.date;
      if (!entries.find(function(e) { return e.date === d; })) {
        entries.push({ date: d, el: row });
      }
    });
    
    if (!entries.length) return;
    
    function update() {
      var scrollY = window.scrollY + window.innerHeight * 0.4;
      var active = entries[0].date;
      
      for (var i = 0; i < entries.length; i++) {
        var y = entries[i].el.getBoundingClientRect().top + window.scrollY;
        if (y < scrollY) {
          active = entries[i].date;
        }
      }
      
      document.querySelectorAll('.date-index .idx-day').forEach(function(a) {
        a.classList.toggle('active', a.dataset.target === active);
      });
    }
    
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() { update(); ticking = false; });
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
    
    var monthGroups = buildMonthGroups(list);
    
    for (var mi = 0; mi < monthGroups.length; mi++) {
      var mg = monthGroups[mi];
      
      var divider = document.createElement('div');
      divider.className = 'month-divider';
      divider.id = 'month-' + mg.month.replace('-', '');
      divider.innerHTML = '<span class="month-label">' + mg.monthLabel + '</span>';
      container.appendChild(divider);
      
      for (var i = 0; i < mg.editions.length; i += PER_SHELF) {
        var rowPapers = mg.editions.slice(i, i + PER_SHELF);
        
        var shelfRow = document.createElement('div');
        shelfRow.className = 'shelf-row';
        shelfRow.dataset.date = mg.editions[i].date;
        
        var papersHtml = '<div class="papers-row">';
        rowPapers.forEach(function(ed) {
          var headlinesHtml = (ed.headlines || []).slice(0, 4).map(function(h) { return '<li>' + h + '</li>'; }).join('');
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
    var groups = [];
    for (var i = 0; i < editions.length; i++) {
      var ed = editions[i];
      var ym = ed.date.substr(0, 7);
      var mg = groups.find(function(g) { return g.month === ym; });
      if (!mg) {
        var m = parseInt(ed.date.substr(5));
        mg = { month: ym, monthLabel: m + '月', editions: [] };
        groups.push(mg);
      }
      mg.editions.push(ed);
    }
    return groups;
  }
  
  // ============================
  // 入场动画
  // ============================
  function animateCards() {
    var cards = document.querySelectorAll('.paper-card');
    var observer = new IntersectionObserver((entries) => {
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
  
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.paper-card');
    if (card) {
      const url = card.dataset.file;
      frame.src = url.includes('?') ? url + '&t=' + Date.now() : url + '?t=' + Date.now();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  });
  
  function closePaper() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('paperFrame').src = 'about:blank';
  }
  
  closeBtn.addEventListener('click', closePaper);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePaper(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePaper(); });
  
  // ============================
  // 启动
  // ============================
  init();
