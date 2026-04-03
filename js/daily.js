const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const data = ref(null);
    const loading = ref(true);
    const error = ref(null);

    // 读取 URL 参数
    const params = new URLSearchParams(window.location.search);
    const date = params.get('date');

    // 滚动条重复（无缝循环）
    const tickerDuplicated = computed(() => {
      if (!data.value || !data.value.ticker) return [];
      const doubled = [...data.value.ticker, ...data.value.ticker];
      return doubled;
    });

    // 天气整体概况
    const weatherEmojiClass = computed(() => {
      if (!data.value) return '🌧️';
      const map = { sunny: '☀️', cloudy: '⛅', rainy: '🌧️', stormy: '⛈️', hot: '🔥', cold: '❄️' };
      return map[data.value.weatherClass] || '🌧️';
    });
    const weatherLabelClass = computed(() => {
      if (!data.value) return '天气概况';
      const map = { sunny: '晴空万里', cloudy: '多云转晴', rainy: '小雨淅沥', stormy: '暴雨来袭', hot: '高温预警', cold: '寒潮来袭' };
      return map[data.value.weatherClass] || '天气概况';
    });

    // 滚动条点击跳转
    function scrollTo(target) {
      if (!target) return;
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 🔊 语音播报辣评（移动端兼容）
    let cachedVoices = [];

    function loadVoices() {
      if (typeof speechSynthesis === 'undefined') return;
      const v = speechSynthesis.getVoices();
      if (v.length > 0) cachedVoices = v;
    }

    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1500);
      setTimeout(loadVoices, 3000);
    }

    function toast(msg) {
      let el = document.getElementById('speakToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'speakToast';
        el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;z-index:99999;max-width:90%;word-break:break-all;transition:opacity 0.3s;font-family:"Noto Sans SC",sans-serif;';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      clearTimeout(el._timer);
      el._timer = setTimeout(() => { el.style.opacity = '0'; }, 5000);
    }

    function speak(text) {
      if (!text) { toast('❌ 文本为空'); return; }

      // 诊断信息
      const info = [];

      if (typeof speechSynthesis === 'undefined') {
        toast('❌ 浏览器不支持语音合成');
        return;
      }

      // 获取最新 voices（用户点击触发时，Chrome 应该已加载）
      let voices = speechSynthesis.getVoices();
      
      // 如果 voices 为空，触发一次空 speak 强制加载
      if (voices.length === 0) {
        speechSynthesis.cancel();
        const dummy = new SpeechSynthesisUtterance('');
        dummy.volume = 0;
        speechSynthesis.speak(dummy);
        speechSynthesis.cancel();
        // 短暂延迟后重新获取
        setTimeout(() => {
          const retry = speechSynthesis.getVoices();
          if (retry.length > 0) cachedVoices = retry;
        }, 100);
      }
      
      if (voices.length > 0) cachedVoices = voices;
      
      const allVoices = cachedVoices.length > 0 ? cachedVoices : voices;
      const zhVoices = allVoices.filter(v => v.lang && v.lang.startsWith('zh'));
      info.push('中文voice: ' + zhVoices.length);

      speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1.1;
      u.pitch = 1.15;

      if (allVoices.length > 0) {
        cachedVoices = allVoices;
        const female = zhVoices.find(v => /yaoyao|婷婷|xiaoxiao|xiaoyi|female|女/i.test(v.name))
          || zhVoices.find(v => /google.*chinese/i.test(v.name))
          || zhVoices[0];
        if (female) {
          u.voice = female;
          info.push('选中voice: ' + female.name);
        } else {
          info.push('选中voice: 系统默认');
        }
      } else {
        info.push('选中voice: 系统默认（无可用列表）');
      }

      // 事件监听
      u.onstart = () => toast('🔊 播放中...');
      u.onend = () => toast('✅ 播放完成');
      u.onerror = (e) => toast('❌ 语音错误: ' + e.error + '\n' + info.join('\n'));
      u.onpause = () => toast('⏸️ 暂停');
      u.onresume = () => toast('▶️ 恢复');

      speechSynthesis.speak(u);

      // 500ms 后检查是否真的开始播放了
      setTimeout(() => {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          toast('⚠️ speak()已调用但未开始播放\n' + info.join('\n'));
        }
      }, 500);
    }

    // 📤 分享卡片
    async function shareArticle(evt, category, title, content, comment) {
      const btn = evt.target;
      btn.textContent = '生成中...';
      btn.disabled = true;
      try {
        // 填充卡片数据
        document.getElementById('scDate').textContent = formatDate(data.value.date) + ' · ' + data.value.weekday + ' · ' + data.value.issue;
        document.getElementById('scCategory').textContent = category;
        document.getElementById('scTitle').textContent = title;
        // 截取前4句话
        const sentences = content ? content.split(/[。！？；]/).filter(s => s.trim()).slice(0, 4).join('。') + '。' : '';
        document.getElementById('scContent').textContent = sentences;
        document.getElementById('scCommentText').textContent = comment || '';

        // 生成二维码（qrcodejs）— 指向当期日报
        const qrContainer = document.getElementById('scQR');
        qrContainer.innerHTML = '';
        const pageUrl = `https://zjbco2.github.io/moni-daily/daily-news.html?date=${date}`;
        new QRCode(qrContainer, { text: pageUrl, width: 72, height: 72, colorDark: '#1a1a2e', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });

        // 移到视口外（html2canvas 需要渲染后的 DOM，但不需要用户看到）
        const card = document.getElementById('shareCard');
        card.style.left = '0';
        card.style.top = '-10000px';
        card.style.position = 'fixed';
        card.style.zIndex = '-1';

        await document.fonts.ready;
        await new Promise(r => setTimeout(r, 300));

        // 截图
        const canvas = await html2canvas(card.querySelector('.sc-card'), {
          scale: 2,
          useCORS: true,
          backgroundColor: '#f5f0e8',
          logging: false
        });

        // 恢复隐藏
        card.style.left = '-99999px';
        card.style.top = '0';
        card.style.position = 'fixed';

        // 下载
        const link = document.createElement('a');
        link.download = `茉霓日报-${data.value.date}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // 复制链接到剪贴板（双保险：clipboard API + execCommand 降级）
        let copied = false;
        try {
          await navigator.clipboard.writeText(pageUrl);
          copied = true;
        } catch (_) {
          // 降级：execCommand
          try {
            const ta = document.createElement('textarea');
            ta.value = pageUrl;
            ta.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
          } catch (_) {}
        }
        btn.textContent = copied ? '✅ 已保存图片+链接' : '✅ 已保存图片';
        setTimeout(() => { btn.textContent = '分享👉'; btn.disabled = false; }, 2000);
      } catch (e) {
        console.error('分享卡片生成失败:', e);
        btn.textContent = '❌ 失败';
        setTimeout(() => { btn.textContent = '分享👉'; btn.disabled = false; }, 2000);
      }
    }

    // 日期格式化：20260330 → 2026年3月30日
    function formatDate(dateStr) {
      if (!dateStr) return '';
      const s = String(dateStr);
      const y = s.substring(0, 4);
      const m = parseInt(s.substring(4, 6));
      const d = s.substring(6, 8);
      return `${y}年${m}月${d}日`;
    }

    // 天气标签日期
    function formatWeatherTag(dateStr) {
      if (!dateStr) return '';
      const s = String(dateStr);
      const m = parseInt(s.substring(4, 6));
      const d = parseInt(s.substring(6, 8));
      return `${m}月${d}日`;
    }

    // 天气城市 emoji
    function weatherEmoji(key) {
      const map = { zhuhai: '🌊', shenzhen: '🏙️', shantou: '🏖️' };
      return map[key] || '📍';
    }
    function weatherLabel(key) {
      const map = { zhuhai: '珠海', shenzhen: '深圳', shantou: '汕头' };
      return map[key] || key;
    }

    // 加载数据
    onMounted(async () => {
      if (!date) {
        error.value = '缺少日期参数，请从报纸架进入';
        loading.value = false;
        return;
      }
      try {
        // 加时间戳防缓存，确保每次打开都重新加载
        const resp = await fetch(`data/${date}.json?t=${Date.now()}`);
        if (!resp.ok) throw new Error(`找不到 ${date} 的报纸数据`);
        data.value = await resp.json();
        document.title = `🌸 茉霓日报 | ${formatDate(date)} ${data.value.weekday}`;
      } catch (e) {
        error.value = e.message;
      } finally {
        loading.value = false;
      }

      // 从专题跳转进来时自动滚动到指定文章
      var hash = window.location.hash.replace('#', '');
      if (hash) {
        Vue.nextTick(() => {
          var el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    });

    return { data, loading, error, tickerDuplicated, formatDate, formatWeatherTag, weatherEmoji, weatherLabel, weatherEmojiClass, weatherLabelClass, scrollTo, speak, shareArticle };
  }
}).mount('#app');
