const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const tab = ref('group');
    const editions = ref([]);
    const sections = ref([]);
    const activeId = ref(null);
    const detailTitle = ref('');
    const detailUrl = ref('');
    const mobileDetail = ref(false);
    const isMobile = ref(window.innerWidth <= 768);

    // 已读状态（localStorage）
    let readEditions = {};
    try { readEditions = JSON.parse(localStorage.getItem('moni_read') || '{}'); } catch (_) {}
    function isRead(id) { return !!readEditions[id]; }
    function markRead(id) {
      readEditions[id] = Date.now();
      localStorage.setItem('moni_read', JSON.stringify(readEditions));
    }

    window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768; });

    function switchTab(t) {
      if (t === tab.value) return;
      const list = document.querySelector('.col-list');
      if (list) {
        list.classList.add('tab-fade-out');
        setTimeout(() => {
          tab.value = t;
          activeId.value = null;
          detailTitle.value = '';
          detailUrl.value = '';
          mobileDetail.value = false;
          setTimeout(() => list.classList.remove('tab-fade-out'), 20);
        }, 200);
      } else {
        tab.value = t;
        activeId.value = null;
        detailTitle.value = '';
        detailUrl.value = '';
        mobileDetail.value = false;
      }
    }

    function goPaper() { location.href = '../index.html'; }

    // 群聊头像：从日期哈希取色（连续日期色相差大）
    function dateHue(dateStr) {
      const s = String(dateStr).replace(/-/g, '');
      // 提取月日部分，乘以黄金角（137.5°）保证相邻日期色相拉开
      const dayOfYear = parseInt(s.substring(4, 8));
      return Math.round((dayOfYear * 137.508) % 360);
    }

    function avatarStyle(ed) {
      const hue = dateHue(ed.date);
      return {
        background: `hsl(${hue}, 35%, 90%)`,
        color: `hsl(${hue}, 60%, 30%)`
      };
    }

    function avatarText(ed) {
      const h = ed.headline || '';
      // 取头条前2-3个字（中文按字符算）
      const chars = [...h].filter(c => /[\u4e00-\u9fff]/.test(c));
      return chars.slice(0, 2).join('') || '📰';
    }

    function openGroup(ed) {
      activeId.value = ed.id;
      detailTitle.value = '茉霓日报 · ' + ed.issue;
      detailUrl.value = 'group.html?date=' + ed.file + '&t=' + Date.now();
      markRead(ed.id);
      if (isMobile.value) mobileDetail.value = true;
    }

    function openPrivate(sec) {
      activeId.value = sec.name;
      detailTitle.value = sec.name;
      detailUrl.value = 'private.html?section=' + encodeURIComponent(sec.name) + '&t=' + Date.now();
      if (isMobile.value) mobileDetail.value = true;
    }

    function closeDetail() {
      mobileDetail.value = false;
      activeId.value = null;
      detailTitle.value = '';
      setTimeout(() => { detailUrl.value = ''; }, 350);
    }

    function closePanel() {
      document.getElementById('panelOverlay').classList.remove('active');
      document.getElementById('sidePanel').classList.remove('active');
      setTimeout(() => {
        const iframe = document.getElementById('panelIframe');
        if (iframe) iframe.src = 'about:blank';
      }, 350);
    }

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

    onMounted(async () => {
      // 监听 iframe 内的 postMessage（打开新闻弹窗）
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'openPanel' && e.data.url) {
          document.getElementById('panelIframe').src = e.data.url;
          document.getElementById('panelOverlay').classList.add('active');
          document.getElementById('sidePanel').classList.add('active');
        }
        if (e.data && e.data.type === 'closePanel') {
          closePanel();
        }
      });
      try {
        const resp = await fetch('../data/meta/editions.json?t=' + Date.now());
        const data = await resp.json();
        const eds = data.editions || [];

        editions.value = eds.map(e => {
          const match = e.file ? e.file.match(/date=([\w-]+)/) : null;
          return {
            id: e.id,
            issue: e.issue,
            date: e.date,
            file: match ? match[1] : e.date,
            headline: (e.headlines && e.headlines[0]) || ''
          };
        });

        if (eds.length > 0) {
          const latest = eds[0];
          const fileMatch = latest.file.match(/date=([\w-]+)/);
          if (fileMatch) {
            const jResp = await fetch('../data/' + fileMatch[1] + '.json?t=' + Date.now());
            const jData = await jResp.json();

            const secMap = {
              '头条': { emoji: '📢', color: '#fce4ec', file: 'headline' },
              '国际风云': { emoji: '🌍', color: '#e3f2fd', file: 'international' },
              '科技前沿': { emoji: '🤖', color: '#f3e5f5', file: 'tech' },
              '国内财经': { emoji: '💰', color: '#e8f5e9', file: 'finance' },
              '娱乐快讯': { emoji: '⚡', color: '#fff3e0', file: 'entertainment' }
            };

            // 从板块索引文件取最近一条作为 preview
            const list = [];
            for (const [name, info] of Object.entries(secMap)) {
              let preview = '';
              let time = '';
              try {
                const idxResp = await fetch(`../data/meta/${info.file}.json?t=${Date.now()}`);
                if (idxResp.ok) {
                  const idxData = await idxResp.json();
                  const arts = idxData.articles || [];
                  if (arts.length > 0) {
                    preview = arts[0].title || '';
                    time = formatDateShort(arts[0].date);
                  }
                }
              } catch (_) {}
              list.push({ name, emoji: info.emoji, color: info.color, time, preview });
            }
            sections.value = list;
          }
        }
      } catch (e) { console.error('加载 editions 失败:', e); }
    });

    return {
      tab, editions, sections, activeId, detailTitle, detailUrl, mobileDetail, isMobile, isRead,
      switchTab, goPaper, openGroup, openPrivate, closeDetail, closePanel, formatDateShort,
      avatarStyle, avatarText
    };
  }
}).mount('#app');
