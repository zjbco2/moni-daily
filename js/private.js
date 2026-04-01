const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const editions = ref([]);
    const sectionName = ref('');
    const loading = ref(true);
    const error = ref(null);

    const sectionFileMap = {
      '头条': 'headline',
      '国际风云': 'international',
      '科技前沿': 'tech',
      '国内财经': 'finance',
      '娱乐快讯': 'entertainment'
    };

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
        const fileKey = sectionFileMap[section];
        if (!fileKey) { error.value = '未知板块: ' + section; loading.value = false; return; }

        // 1 个请求搞定！
        const resp = await fetch(`../data/meta/${fileKey}.json?t=${Date.now()}`);
        if (!resp.ok) throw new Error(`加载 ${fileKey}.json 失败`);
        const data = await resp.json();
        const allArticles = data.articles || [];

        // 按日期分组
        const grouped = {};
        for (const art of allArticles) {
          if (!grouped[art.date]) {
            grouped[art.date] = { date: art.date, weekday: art.weekday, issue: art.issue, articles: [] };
          }
          grouped[art.date].articles.push(art);
        }

        // 按日期倒序
        const results = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
        editions.value = results;
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; initBackToTop(); }
    });

    return { editions, sectionName, avatar, avatarColor, loading, error, scrollToTop, formatDate, speak, openPanel, closePanel };
  }
}).mount('#app');
