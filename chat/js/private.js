const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const editions = ref([]);
    const sectionName = ref('');
    const loading = ref(true);
    const error = ref(null);

    const avatarMap = {
      '头条': { emoji: '📢', color: '#fce4ec' },
      '国际风云': { emoji: '🌍', color: '#e3f2fd' },
      '科技前沿': { emoji: '🤖', color: '#f3e5f5' },
      '国内财经': { emoji: '💰', color: '#e8f5e9' },
      '娱乐快讯': { emoji: '⚡', color: '#fff3e0' }
    };

    const avatar = computed(() => {
      const info = avatarMap[sectionName.value];
      return info ? info.emoji : '💬';
    });

    const avatarColor = computed(() => {
      const info = avatarMap[sectionName.value];
      return info ? info.color : '#e0e0e0';
    });

    function scrollToTop() {
      document.getElementById('chatDetail').scrollTo({ top: 0, behavior: 'smooth' });
    }

    onMounted(async () => {
      const section = getUrlParam('section');
      if (!section) { error.value = '缺少板块参数'; loading.value = false; return; }
      sectionName.value = section;

      try {
        const edResp = await fetch('../editions.json?t=' + Date.now());
        const edData = await edResp.json();
        const files = [...new Set(edData.editions.map(e => {
          const match = e.file.match(/date=([\w-]+)/);
          return match ? match[1] + '.json' : null;
        }))].filter(Boolean);

        const results = [];
        for (const file of files) {
          try {
            const resp = await fetch('../data/' + file + '?t=' + Date.now());
            if (!resp.ok) continue;
            const json = await resp.json();
            const sec = json.sections ? json.sections.find(s => s.name === section) : null;
            if (sec) {
              results.push({
                date: json.date, issue: json.issue, weekday: json.weekday,
                articles: sec.articles || [],
                items: sec.isBrief ? (sec.items || []) : []
              });
            }
          } catch (e) { /* skip */ }
        }

        // 头条特殊处理
        if (section === '头条') {
          for (const file of files) {
            try {
              const resp = await fetch('../data/' + file + '?t=' + Date.now());
              if (!resp.ok) continue;
              const json = await resp.json();
              if (json.headline) {
                const existing = results.find(r => r.date === json.date);
                if (existing) { existing.articles.unshift(json.headline); }
                else {
                  results.push({
                    date: json.date, issue: json.issue, weekday: json.weekday,
                    articles: [json.headline], items: []
                  });
                }
              }
            } catch (e) { /* skip */ }
          }
        }

        results.sort((a, b) => b.date.localeCompare(a.date));
        editions.value = results;
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; initBackToTop(); }
    });

    return { editions, sectionName, avatar, avatarColor, loading, error, scrollToTop, formatDate, speak, openPanel, closePanel };
  }
}).mount('#app');
