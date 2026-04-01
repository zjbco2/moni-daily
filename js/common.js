/* common.js — 聊天室公共方法 */

/**
 * 语音播报
 * @param {HTMLElement} iconEl - 点击的 🔥 图标元素
 */
function speak(iconEl) {
  const bubble = iconEl.closest('.msg-bubble');
  const textEl = bubble.querySelector('.comment-text');
  if (!textEl) { showToast('❌ 没找到文本'); return; }
  let text = textEl.textContent.replace(/📢 \)\)/g, '').trim();
  if (!text) { showToast('❌ 文本为空'); return; }
  if (typeof speechSynthesis === 'undefined') { showToast('❌ 浏览器不支持'); return; }

  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = 1.1; u.pitch = 1.15;

  const voices = speechSynthesis.getVoices();
  const zh = voices.filter(v => v.lang && v.lang.startsWith('zh'));
  const female = zh.find(v => /female|女|xiaoxiao|yaoyao/i.test(v.name)) || zh[0];
  if (female) u.voice = female;

  u.onstart = () => showToast('🔊 播放中...');
  u.onend = () => showToast('✅ 播放完成');
  u.onerror = (e) => showToast('❌ 语音错误: ' + e.error);
  speechSynthesis.speak(u);
}

/**
 * Toast 提示
 * @param {string} msg
 */
function showToast(msg) {
  let el = document.getElementById('speakToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'speakToast';
    el.className = 'speak-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 3000);
}

/**
 * 打开新闻弹窗
 * @param {string} url
 */
function openPanel(url) {
  document.getElementById('panelIframe').src = url;
  document.getElementById('panelOverlay').classList.add('active');
  document.getElementById('sidePanel').classList.add('active');
}

/**
 * 关闭新闻弹窗
 */
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

// 语音 voices 预加载
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  speechSynthesis.getVoices();
}

/**
 * 日期格式化：2026-03-31 或 20260331 → 2026年3月31日
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(/-/g, '').replace(/-\d+$/, '');
  const y = s.substring(0, 4);
  const m = parseInt(s.substring(4, 6));
  const d = parseInt(s.substring(6, 8));
  return `${y}年${m}月${d}日`;
}

/**
 * 日期简写：2026-03-31 或 20260331 → 03/31
 */
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(/-/g, '').replace(/-\d+$/, '');
  return s.substring(4, 6) + '/' + s.substring(6, 8);
}

/**
 * 获取 URL 参数
 */
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * 回到顶部按钮初始化
 */
function initBackToTop() {
  const detail = document.getElementById('chatDetail');
  const btn = document.getElementById('backToTop');
  if (!detail || !btn) return;
  detail.addEventListener('scroll', () => {
    btn.classList.toggle('visible', detail.scrollTop > 200);
  });
}
