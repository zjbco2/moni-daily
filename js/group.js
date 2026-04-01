const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const data = ref(null);
    const loading = ref(true);
    const error = ref(null);

    const avatarColors = {
      '🌍': '#e3f2fd', '🤖': '#f3e5f5', '💰': '#e8f5e9',
      '⚡': '#fff3e0', '📢': '#fce4ec'
    };

    const emojiMap = {
      '国际风云': '🌍', '科技前沿': '🤖', '国内财经': '💰', '娱乐快讯': '⚡'
    };

    function avatarBg(emoji) { return avatarColors[emoji] || '#e0e0e0'; }
    function normalizeEmoji(sec) { return emojiMap[sec.name] || sec.emoji || '💬'; }

    function scrollToTop() {
      document.getElementById('chatDetail').scrollTo({ top: 0, behavior: 'smooth' });
    }

    onMounted(async () => {
      const date = getUrlParam('date');
      if (!date) { error.value = '缺少日期参数'; loading.value = false; return; }
      try {
        const resp = await fetch(`../data/${date}.json?t=${Date.now()}`);
        if (!resp.ok) throw new Error(`找不到 ${date} 的数据`);
        data.value = await resp.json();
        document.title = `🌸 ${data.value.issue} · ${formatDate(date)}`;
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; initBackToTop(); }
    });

    return { data, loading, error, avatarBg, normalizeEmoji, scrollToTop, formatDate, speak, openPanel, closePanel };
  }
}).mount('#app');
