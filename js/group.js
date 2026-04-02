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

    function scrollToSection(name) {
      const el = document.querySelector(`[data-section="${name}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

    onMounted(async () => {
      const date = getUrlParam('date');
      if (!date) { error.value = '缺少日期参数'; loading.value = false; return; }
      try {
        const resp = await fetch(`../data/${date}.json?t=${Date.now()}`);
        if (!resp.ok) throw new Error(`找不到 ${date} 的数据`);
        data.value = await resp.json();
        document.title = `🌸 ${data.value.issue} · ${formatDate(date)}`;
      } catch (e) { error.value = e.message; }
      finally {
        loading.value = false;
        initBackToTop();
        // 消息入场动画：逐条延迟
        Vue.nextTick(() => {
          document.querySelectorAll('.msg').forEach((el, i) => {
            el.style.animationDelay = (i * 0.06) + 's';
          });
        });
      }
    });

    return { data, loading, error, avatarBg, normalizeEmoji, scrollToTop, scrollToSection, formatDate, speak, openPanel, closePanel };
  }
}).mount('#app');
