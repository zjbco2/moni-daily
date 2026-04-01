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

    window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768; });

    function switchTab(t) {
      tab.value = t;
      activeId.value = null;
      detailTitle.value = '';
      detailUrl.value = '';
      mobileDetail.value = false;
    }

    function goPaper() { location.href = '../index.html'; }

    function openGroup(ed) {
      activeId.value = ed.id;
      detailTitle.value = '茉霓日报 · ' + ed.issue;
      detailUrl.value = 'group.html?date=' + ed.file;
      if (isMobile.value) mobileDetail.value = true;
    }

    function openPrivate(sec) {
      activeId.value = sec.name;
      detailTitle.value = sec.name;
      detailUrl.value = 'private.html?section=' + encodeURIComponent(sec.name);
      if (isMobile.value) mobileDetail.value = true;
    }

    function closeDetail() {
      mobileDetail.value = false;
      activeId.value = null;
      detailTitle.value = '';
      setTimeout(() => { detailUrl.value = ''; }, 350);
    }

    onMounted(async () => {
      try {
        const resp = await fetch('../editions.json?t=' + Date.now());
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
              '头条': { emoji: '📢', color: '#fce4ec' },
              '国际风云': { emoji: '🌍', color: '#e3f2fd' },
              '科技前沿': { emoji: '🤖', color: '#f3e5f5' },
              '国内财经': { emoji: '💰', color: '#e8f5e9' },
              '娱乐快讯': { emoji: '⚡', color: '#fff3e0' }
            };

            const list = [];
            if (jData.headline) {
              list.push({
                name: '头条', emoji: '📢', color: '#fce4ec',
                time: formatDateShort(jData.date), preview: jData.headline.title
              });
            }
            for (const sec of (jData.sections || [])) {
              const info = secMap[sec.name] || { emoji: '💬', color: '#e0e0e0' };
              const first = (sec.articles || [])[0] || (sec.items || [])[0] || {};
              list.push({
                name: sec.name, emoji: info.emoji, color: info.color,
                time: formatDateShort(jData.date), preview: first.title || ''
              });
            }
            sections.value = list;
          }
        }
      } catch (e) { console.error('加载 editions 失败:', e); }
    });

    return {
      tab, editions, sections, activeId, detailTitle, detailUrl, mobileDetail, isMobile,
      switchTab, goPaper, openGroup, openPrivate, closeDetail, formatDateShort
    };
  }
}).mount('#app');
