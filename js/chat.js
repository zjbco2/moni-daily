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
    const channels = ref([]); // 茉霓说频道列表

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

    function openMoshuo(ch) {
      activeId.value = ch.key;
      detailTitle.value = ch.emoji + ' ' + ch.name;
      detailUrl.value = 'moshuo.html?section=' + encodeURIComponent(ch.key) + '&t=' + Date.now();
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

            // 并行加载所有板块索引
            const secEntries = Object.entries(secMap);
            const results = await Promise.all(
              secEntries.map(([name, info]) =>
                fetch(`../data/meta/${info.file}.json?t=${Date.now()}`)
                  .then(r => r.ok ? r.json() : null)
                  .catch(() => null)
              )
            );

            const list = [];
            for (let i = 0; i < secEntries.length; i++) {
              const [name, info] = secEntries[i];
              let preview = '', time = '';
              if (results[i]) {
                const arts = results[i].articles || [];
                if (arts.length > 0) {
                  preview = arts[0].title || '';
                  time = formatDateShort(arts[0].date);
                }
              }
              list.push({ name, emoji: info.emoji, color: info.color, time, preview });
            }
            sections.value = list;
          }
        }

        // 加载吵吵频道列表
        try {
          const chResp = await fetch('../data/meta/comments.json?t=' + Date.now());
          if (chResp.ok) {
            const chData = await chResp.json();
            const bySec = chData.by_section || {};
            const secEmoji = { '头条': '📢', '国际风云': '🌍', '科技前沿': '🤖', '国内财经': '💰', '娱乐快讯': '⚡' };
            const secColor = { '头条': '#fce4ec', '国际风云': '#e3f2fd', '科技前沿': '#f3e5f5', '国内财经': '#e8f5e9', '娱乐快讯': '#fff3e0' };

            channels.value = [
              { key: 'today', name: '吵啥呢今天', emoji: '📣', color: '#f4f0e4' },
              { key: '头条', name: '号外号外~', emoji: '📢', color: '#f4ece6' },
              { key: '国际风云', name: '地球要爆炸了！', emoji: '🌍', color: '#e8ecf2' },
              { key: '科技前沿', name: '咋又遥遥领先了', emoji: '🤖', color: '#ece8f0' },
              { key: '国内财经', name: '大A又搞事辣', emoji: '💰', color: '#e8efe6' },
              { key: '娱乐快讯', name: '震惊！Ta竟然...', emoji: '⚡', color: '#f2f0e0' },
              { key: 'comments', name: '茉霓有话说~', emoji: '🌸', color: '#f4e8ee' }
            ];
          }
        } catch (_) {}
      } catch (e) { console.error('加载 editions 失败:', e); }
    });

    return {
      tab, editions, sections, channels, activeId, detailTitle, detailUrl, mobileDetail, isMobile, isRead,
      switchTab, goPaper, openGroup, openPrivate, openMoshuo, closeDetail, closePanel, formatDateShort,
      avatarStyle, avatarText
    };
  }
}).mount('#app');
