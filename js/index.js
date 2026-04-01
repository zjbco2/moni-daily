  const container = document.getElementById('shelvesContainer');
  const PER_SHELF = 4;
  
  let allEditions = [];
  let searchIndex = [];
  let currentEditions = [];
  
  // ============================
  // 加载数据
  // ============================
  async function init() {
    try {
      const [edRes, siRes] = await Promise.all([
        fetch('editions.json?t=' + Date.now()),
        fetch('search-index.json?t=' + Date.now())
      ]);
      const edData = await edRes.json();
      const siData = await siRes.json();
      
      allEditions = edData.editions || [];
      searchIndex = siData.articles || [];
      
      document.getElementById('totalEditions').textContent = `累计 ${allEditions.length} 期`;
      updateCount(allEditions.length, false);
      renderShelves(allEditions);
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
  
  // 点击🔍图标展开
  document.querySelector('.search-icon').addEventListener('click', function() {
    if (!searchInput.classList.contains('expanded')) {
      searchInput.classList.add('expanded');
      searchInput.placeholder = '搜索关键词...';
    }
    searchInput.focus();
  });
  
  // 点击输入框（已展开时）
  searchInput.addEventListener('click', function() {
    if (!this.classList.contains('expanded')) {
      this.classList.add('expanded');
      this.placeholder = '搜索关键词...';
    }
  });

  // 失焦收起（延迟避免与 clear 按钮冲突）
  searchInput.addEventListener('blur', function() {
    const input = this;
    setTimeout(() => {
      // 检查当前焦点是否还在搜索区域内
      const active = document.activeElement;
      if (!active || (active !== input && !active.closest('.search-wrapper'))) {
        if (input.value.trim() === '') {
          input.classList.remove('expanded');
          input.placeholder = '';
        }
      }
    }, 250);
  });

  // Escape 收起
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      this.dispatchEvent(new Event('input'));
      this.classList.remove('expanded');
      this.placeholder = '';
      this.blur();
    }
  });
  
  // 实时搜索
  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', query.length > 0);
    
    if (query === '') {
      // 恢复全部
      updateCount(allEditions.length, false);
      renderShelves(allEditions);
      return;
    }
    
    // 在 search-index 中查找匹配的文章
    const matchedArticleEditionIds = new Set();
    searchIndex.forEach(article => {
      const text = [article.title, article.preview, article.comment, article.category, article.section].join(' ').toLowerCase();
      if (text.includes(query)) {
        matchedArticleEditionIds.add(article.editionId);
      }
    });
    
    // 只保留有匹配文章的期
    const filtered = allEditions.filter(ed => matchedArticleEditionIds.has(ed.id));
    
    updateCount(filtered.length, true);
    renderShelves(filtered);
  });
  
  // 清空按钮（不清空时收起搜索框）
  searchClear.addEventListener('click', function(e) {
    e.stopPropagation();
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    searchInput.focus();
  });
  
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
    
    for (let i = 0; i < list.length; i += PER_SHELF) {
      const rowPapers = list.slice(i, i + PER_SHELF);
      
      const shelfRow = document.createElement('div');
      shelfRow.className = 'shelf-row';
      
      let papersHtml = '<div class="papers-row">';
      rowPapers.forEach(ed => {
        const headlinesHtml = (ed.headlines || []).slice(0, 4).map(h => `<li>${h}</li>`).join('');
        papersHtml += `
          <div class="paper-card" data-file="${ed.file}">
            <div class="paper-inner">
              <div class="date-tab">
                <div class="year">${ed.year}</div>
                <div class="month">${ed.month}</div>
                <div class="day">${ed.day}</div>
                <div class="weekday">${ed.weekday}</div>
              </div>
              <div class="issue-badge">${ed.issue}</div>
              <div class="paper-content">
                <div class="mini-masthead">
                  <h2>茉<em class="neon">霓</em>日报</h2>
                  <div class="mini-subtitle">${ed.month}${ed.day}日 · ${ed.weekday} · ${ed.issue}</div>
                </div>
                <div class="paper-bottom">
                  <ul class="mini-headlines">${headlinesHtml}</ul>
                </div>
                <div class="expand-hint">▸ 点击展开阅读</div>
              </div>
            </div>
          </div>
        `;
      });
      papersHtml += '</div>';
      
      shelfRow.innerHTML = `${papersHtml}<div class="wood-plank"></div>`;
      container.appendChild(shelfRow);
    }
    
    // 入场动画
    animateCards();
  }
  
  // ============================
  // 入场动画
  // ============================
  function animateCards() {
    const cards = document.querySelectorAll('.paper-card');
    const observer = new IntersectionObserver((entries) => {
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
