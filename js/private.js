const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const editions = ref([]);
    const sectionName = ref('');
    const loading = ref(true);
    const error = ref(null);
    const scrolled = ref(false);

    // 日历状态
    const showCal = ref(false);
    const today = new Date();
    const calYear = ref(today.getFullYear());
    const calMonth = ref(today.getMonth()); // 0-based
    const articleDates = ref([]); // 响应式日期数组

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

    // 在 iframe 内用 postMessage 通知父页面打开弹窗，否则本地打开
    function openPanel(url) {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'openPanel', url }, '*');
      } else {
        document.getElementById('panelIframe').src = url;
        document.getElementById('panelOverlay').classList.add('active');
        document.getElementById('sidePanel').classList.add('active');
      }
    }

    function closePanel() {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'closePanel' }, '*');
      } else {
        document.getElementById('panelOverlay').classList.remove('active');
        document.getElementById('sidePanel').classList.remove('active');
        setTimeout(() => {
          const iframe = document.getElementById('panelIframe');
          if (iframe) iframe.src = 'about:blank';
        }, 350);
      }
    }

    // 日历逻辑
    function toggleCalendar() { showCal.value = !showCal.value; }

    function prevMonth() {
      if (calMonth.value === 0) { calMonth.value = 11; calYear.value--; }
      else { calMonth.value--; }
    }
    function nextMonth() {
      if (calMonth.value === 11) { calMonth.value = 0; calYear.value++; }
      else { calMonth.value++; }
    }

    const calCells = computed(() => {
      const y = calYear.value;
      const m = calMonth.value;
      const dateSet = new Set(articleDates.value);
      const firstDay = new Date(y, m, 1).getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const todayStr = today.getFullYear() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');

      const cells = [];
      for (let i = 0; i < firstDay; i++) {
        cells.push({ day: 0, hasArticle: false, dateStr: '', isToday: false });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = y + String(m + 1).padStart(2, '0') + String(d).padStart(2, '0');
        cells.push({
          day: d,
          hasArticle: dateSet.has(ds),
          dateStr: ds,
          isToday: ds === todayStr
        });
      }
      return cells;
    });

    function jumpToDate(dateStr) {
      showCal.value = false;
      const el = document.querySelector(`[data-date="${dateStr}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

        // 填充有文章的日期数组
        articleDates.value = results.map(ed => ed.date);

        // 日历默认显示最新有文章的月份
        if (results.length > 0) {
          const raw = String(results[0].date).replace(/-/g, '');
          calYear.value = parseInt(raw.substring(0, 4));
          calMonth.value = parseInt(raw.substring(4, 6)) - 1;
        }
      } catch (e) { error.value = e.message; }
      finally {
        loading.value = false;
        // 消息入场动画 + 滚动监听
        Vue.nextTick(() => {
          document.querySelectorAll('.msg').forEach((el, i) => {
            el.style.animationDelay = (i * 0.06) + 's';
          });
          const detail = document.getElementById('chatDetail');
          if (detail) {
            detail.addEventListener('scroll', () => {
              scrolled.value = detail.scrollTop > 200;
            });
          }
        });
      }
    });

    return {
      editions, sectionName, avatar, avatarColor, loading, error, scrolled,
      scrollToTop, formatDate, speak, openPanel, closePanel,
      showCal, calYear, calMonth, calCells, toggleCalendar, jumpToDate,
      prevMonth, nextMonth
    };
  }
}).mount('#app');
