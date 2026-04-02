const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const bubbles = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const playingIdx = ref(-1);
    const isPlaying = ref(false);
    const activeChar = ref(-1);
    let _playGen = 0;
    let _keyCounter = 0;
    let _allVoices = [];

    // 版块底色（纸张底色 #f0ebe2 微调）
    const sectionBgMap = {
      'today': '#f4f0e4',
      '头条': '#f4ece6',
      '国际风云': '#e8ecf2',
      '科技前沿': '#ece8f0',
      '国内财经': '#e8efe6',
      '娱乐快讯': '#f2f0e0',
      'comments': '#f4e8ee'
    };
    const sectionKey = getUrlParam('section') || 'today';
    const sectionBg = ref(sectionBgMap[sectionKey] || '#f0ebe2');

    // 画布拖拽
    const canvasW = ref(2000);
    const canvasH = ref(2000);
    const offsetX = ref(0);
    const offsetY = ref(0);
    let dragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragStartOffsetX = 0, dragStartOffsetY = 0;
    let dragMoved = false;

    const canvasStyle = computed(() => ({
      width: canvasW.value + 'px',
      height: canvasH.value + 'px',
      transform: `translate(${offsetX.value}px, ${offsetY.value}px)`
    }));

    // 数据源
    const sectionFileMap = {
      '国际风云': 'international',
      '科技前沿': 'tech',
      '国内财经': 'finance',
      '娱乐快讯': 'entertainment'
    };

    // ========== 数据加载 ==========
    async function loadItems(channelKey) {
      const now = new Date();
      const today = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');

      function daysAgo(n) {
        const d = new Date(now);
        d.setDate(d.getDate() - n);
        return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      }

      const sevenDaysAgo = daysAgo(7);
      const threeDaysAgo = daysAgo(3);
      let items = [];

      async function loadSection(fileKey, secName, dateFilter) {
        try {
          const resp = await fetch('../data/meta/' + fileKey + '.json?t=' + Date.now());
          if (!resp.ok) return;
          const data = await resp.json();
          for (const a of (data.articles || [])) {
            if (dateFilter(a.date)) {
              items.push({ text: a.title, section: secName, date: a.date });
            }
          }
        } catch (_) {}
      }

      if (channelKey === 'today') {
        // 今日吵吵：今日所有版块标题
        const isToday = (d) => d === today;
        await loadSection('headline', '头条', isToday);
        for (const [secName, fileKey] of Object.entries(sectionFileMap)) {
          await loadSection(fileKey, secName, isToday);
        }

      } else if (channelKey === 'comments') {
        // 茉霓有话说：最近 3 天辣评
        try {
          const resp = await fetch('../data/meta/comments.json?t=' + Date.now());
          if (resp.ok) {
            const data = await resp.json();
            for (const c of (data.comments || [])) {
              if (c.date >= threeDaysAgo) {
                items.push({ text: c.comment, section: c.section, date: c.date });
              }
            }
          }
        } catch (_) {}

      } else if (channelKey === '头条') {
        await loadSection('headline', '头条', (d) => d >= sevenDaysAgo);
      } else if (sectionFileMap[channelKey]) {
        await loadSection(sectionFileMap[channelKey], channelKey, (d) => d >= sevenDaysAgo);
      }

      return items;
    }

    // 随机抽 50 个
    function pickRandom(items, max) {
      if (items.length <= max) return [...items];
      return [...items].sort(() => Math.random() - 0.5).slice(0, max);
    }

    // ========== 随机位置 ==========
    function generatePositions(count) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw <= 768;
      const bubbleW = isMobile ? 150 : 200;
      const bubbleH = isMobile ? 80 : 100;

      const area = count * bubbleW * bubbleH * (isMobile ? 4 : 2.5);
      const side = Math.ceil(Math.sqrt(area));
      canvasW.value = Math.max(side, vw);
      canvasH.value = Math.max(side, vh - 60);

      const positions = [];
      const placed = [];

      for (let i = 0; i < count; i++) {
        let x, y, attempts = 0, overlap = true;
        while (overlap && attempts < 50) {
          x = Math.random() * (canvasW.value - bubbleW);
          y = Math.random() * (canvasH.value - bubbleH);
          overlap = placed.some(p =>
            x < p.x + p.w && x + bubbleW > p.x &&
            y < p.y + p.h && y + bubbleH > p.y
          );
          attempts++;
        }
        placed.push({ x, y, w: bubbleW, h: bubbleH });
        const rotate = (Math.random() - 0.5) * 16; // ±8度
        const delay = Math.random() * 500; // 0~500ms 随机延迟
        positions.push({
          left: x + 'px',
          top: y + 'px',
          transform: 'rotate(' + rotate + 'deg)',
          '--rot': rotate + 'deg',
          animationDelay: delay + 'ms'
        });
      }

      offsetX.value = -(canvasW.value - vw) / 2;
      offsetY.value = -(canvasH.value - vh + 60) / 2;

      return positions;
    }

    // ========== 随机重排 ==========
    let _rawPool = [];

    function shuffle() {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      isPlaying.value = false;
      activeChar.value = -1;
      playingIdx.value = -1;

      // 已有气泡：缩小消失
      const existing = document.querySelectorAll('.speech-bubble');
      if (existing.length > 0) {
        existing.forEach(el => el.classList.add('sb-shrinking'));
        setTimeout(() => doShuffle(), 250);
      } else {
        doShuffle();
      }
    }

    function doShuffle() {
      const picked = pickRandom(_rawPool, 50);
      const pos = generatePositions(picked.length);
      bubbles.value = picked.map((item, i) => ({
        ...item,
        chars: [...item.text],
        posStyle: pos[i] || {},
        _key: _keyCounter++
      }));
    }

    // ========== 移动画布到气泡位置 ==========
    function panToBubble(idx) {
      if (idx < 0 || idx >= bubbles.value.length) return;
      const b = bubbles.value[idx];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 解析 left/top 值
      const bx = parseFloat(b.posStyle.left);
      const by = parseFloat(b.posStyle.top);
      // 移动画布使气泡居中
      offsetX.value = -(bx - vw / 2 + 100);
      offsetY.value = -(by - vh / 2 + 50);
    }

    // ========== 拖拽 ==========
    function initDrag() {
      const vp = document.getElementById('bubbleViewport');
      if (!vp) return;

      function onStart(cx, cy) {
        dragging = true;
        dragMoved = false;
        dragStartX = cx;
        dragStartY = cy;
        dragStartOffsetX = offsetX.value;
        dragStartOffsetY = offsetY.value;
        vp.style.cursor = 'grabbing';
      }

      function onMove(cx, cy) {
        if (!dragging) return;
        const dx = cx - dragStartX;
        const dy = cy - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
        offsetX.value = dragStartOffsetX + dx;
        offsetY.value = dragStartOffsetY + dy;
      }

      function onEnd() {
        dragging = false;
        vp.style.cursor = 'grab';
      }

      vp.addEventListener('mousedown', e => { if (e.target === vp || e.target.closest('.bubble-canvas')) onStart(e.clientX, e.clientY); });
      window.addEventListener('mousemove', e => { if (dragging) onMove(e.clientX, e.clientY); });
      window.addEventListener('mouseup', onEnd);
      vp.addEventListener('touchstart', e => {
        if (e.target === vp || e.target.closest('.bubble-canvas')) { const t = e.touches[0]; onStart(t.clientX, t.clientY); }
      }, { passive: true });
      vp.addEventListener('touchmove', e => {
        if (dragging) { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }
      }, { passive: false });
      vp.addEventListener('touchend', onEnd);

      vp.style.cursor = 'grab';
    }

    // ========== 播放 ==========
    // ========== 语音随机选色 ==========
    function getRandomVoice() {
      if (typeof speechSynthesis === 'undefined') return null;
      if (!_allVoices.length) _allVoices = speechSynthesis.getVoices();
      const zh = _allVoices.filter(v => v.lang && v.lang.startsWith('zh') && v.localService === true);
      return zh.length > 0 ? zh[Math.floor(Math.random() * zh.length)] : null;
    }

    // ========== 播放 ==========
    function doPlay(idx) {
      if (idx < 0 || idx >= bubbles.value.length) return;
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();

      // 视觉效果正常执行
      playingIdx.value = idx;
      isPlaying.value = true;
      activeChar.value = -1;
      panToBubble(idx);

      // 语音播报（不支持则提示但不拦截）
      if (typeof speechSynthesis === 'undefined') {
        showToast('❌ 当前浏览器不支持语音');
        setTimeout(() => { isPlaying.value = false; }, 2000);
        return;
      }

      const text = bubbles.value[idx].text;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.6 + Math.random() * 0.8;   // 0.6~1.4
      u.pitch = 0.5 + Math.random() * 1.1;  // 0.5~1.6

      const voice = getRandomVoice();
      if (voice) u.voice = voice;

      const gen = ++_playGen;
      u.onboundary = (e) => { if (gen !== _playGen) return; activeChar.value = e.charIndex; };
      u.onend = () => {
        if (gen !== _playGen) return;
        activeChar.value = -1;
        isPlaying.value = false;
      };
      u.onerror = () => {
        if (gen !== _playGen) return;
        activeChar.value = -1;
        isPlaying.value = false;
      };
      speechSynthesis.speak(u);
    }

    // 点击气泡 → 播放该条
    function playBubble(idx) {
      if (dragMoved) return;
      doPlay(idx);
    }

    // 点击"我听听看" → 随机播放
    function playRandom() {
      if (bubbles.value.length === 0) return;
      let idx;
      do { idx = Math.floor(Math.random() * bubbles.value.length); }
      while (idx === playingIdx.value && bubbles.value.length > 1);
      doPlay(idx);
    }

    // ========== 初始化 ==========
    onMounted(async () => {
      const section = getUrlParam('section');
      if (!section) { error.value = '缺少频道参数'; loading.value = false; return; }

      try {
        _rawPool = await loadItems(section);
        if (_rawPool.length === 0) { error.value = '暂无内容'; loading.value = false; return; }
        shuffle();
      } catch (e) { error.value = e.message; }
      finally {
        loading.value = false;
        // 预加载语音列表
        if (typeof speechSynthesis !== 'undefined') {
          try {
            _allVoices = speechSynthesis.getVoices();
            speechSynthesis.onvoiceschanged = () => { _allVoices = speechSynthesis.getVoices(); };
          } catch (_) {}
        }
        Vue.nextTick(() => { initDrag(); });
      }
    });

    return {
      bubbles, loading, error, playingIdx, isPlaying, activeChar, canvasStyle, sectionBg,
      shuffle, playBubble, playRandom
    };
  }
}).mount('#app');
