(function() {
  function normalizeDate(d) { return d ? d.replace(/-/g, '') : ''; }
  function formatDate(s) { var d = normalizeDate(s); return parseInt(d.substring(4,6)) + '月' + parseInt(d.substring(6,8)) + '日'; }
  function formatWeekday(s) { var d = normalizeDate(s); return ['周日','周一','周二','周三','周四','周五','周六'][new Date(parseInt(d.substring(0,4)), parseInt(d.substring(4,6))-1, parseInt(d.substring(6,8))).getDay()]; }

  function generateShapes(topic) {
    var geo = topic ? (topic.geoStyle || '') : '';
    if (!geo) geo = 'circles';
    var container = document.getElementById('fixedShapes');
    if (!container) return;
    container.innerHTML = '';
    var placed = [];
    function getPos() {
      var r, t, overlaps, tries = 0;
      do { r = 5 + Math.random() * 90; t = 5 + Math.random() * 80; overlaps = false;
        for (var j = 0; j < placed.length; j++) { if (Math.abs(placed[j].r - r) < 12 && Math.abs(placed[j].t - t) < 10) { overlaps = true; break; } }
        tries++;
      } while (overlaps && tries < 50);
      placed.push({ r: r, t: t }); return { r: r, t: t };
    }
    var shapeCount = window.innerWidth <= 768 ? 3 : 8;
        for (var i = 0; i < shapeCount; i++) {
      var pos = getPos();
      var el = document.createElement('div');
      var size = Math.round(80 + Math.random() * 120);
      var opacity = (0.05 + Math.random() * 0.15).toFixed(2);
      var rotation = Math.round((Math.random() - 0.5) * 120);
      el.style.cssText = 'position:absolute;right:' + pos.r + '%;top:' + pos.t + '%;width:' + size + 'px;height:' + size + 'px;opacity:' + opacity + ';transform:rotate(' + rotation + 'deg);pointer-events:none;';
      if (geo === 'circles') {
        if (i < 5) { el.style.border = '2px solid #ffffff'; el.style.borderRadius = '50%'; }
        else { el.style.border = '1.5px dashed #ffffff'; el.style.borderRadius = '50%'; }
      } else if (geo === 'diamonds') {
        el.style.border = i < 5 ? '1.5px solid #ffffff' : '1px dotted #ffffff';
        el.style.transform = 'rotate(' + (rotation + 45) + 'deg)';
      } else if (geo === 'hexagons') {
        el.innerHTML = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,3 93,25 93,75 50,97 7,75 7,25" fill="none" stroke="#ffffff" stroke-width="2"/></svg>';
        if (i >= 5) { var poly = el.querySelector('polygon'); if (poly) poly.setAttribute('stroke-dasharray', '6,4'); }
      } else if (geo === 'triangles') {
        el.innerHTML = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,8 93,88 7,88" fill="none" stroke="#ffffff" stroke-width="2"/></svg>';
        if (i >= 5) { var tri = el.querySelector('polygon'); if (tri) tri.setAttribute('stroke-dasharray', '5,5'); }
      } else if (geo === 'stars') {
        el.innerHTML = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,2 61,37 98,37 68,59 79,96 50,74 21,96 32,59 2,37 39,37" fill="none" stroke="#ffffff" stroke-width="1.5"/></svg>';
      }
      container.appendChild(el);
    }
  }

  var { createApp, ref, computed, onMounted } = Vue;
  createApp({
    setup: function() {
      var topic = ref(null);
      var articles = ref([]);
      var loading = ref(true);
      var error = ref(null);
      var params = new URLSearchParams(window.location.search);
      var topicId = params.get('id');

      var dayCount = computed(function() {
        var s = new Set();
        articles.value.forEach(function(a) { s.add(normalizeDate(a.date)); });
        return s.size;
      });
      var dateRange = computed(function() {
        if (!articles.value.length) return '';
        var dates = [];
        articles.value.forEach(function(a) { var nd = normalizeDate(a.date); if (dates.indexOf(nd) === -1) dates.push(nd); });
        dates.sort();
        return dates.length === 1 ? formatDate(dates[0]) : formatDate(dates[0]) + ' — ' + formatDate(dates[dates.length - 1]);
      });
      var groupedArticles = computed(function() {
        var groups = {};
        articles.value.forEach(function(a) {
          var nd = normalizeDate(a.date);
          if (!groups[nd]) groups[nd] = { date: nd, label: formatDate(nd), articles: [] };
          groups[nd].articles.push(a);
        });
        var keys = Object.keys(groups).sort(function(a, b) { return b.localeCompare(a); });
        return keys.map(function(k) { var g = groups[k]; g.label = g.label + '(' + formatWeekday(g.date) + ')'; return g; });
      });

      function scrollToDay(date) {
        var el = document.getElementById('day-' + date);
        if (el) { var top = el.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top: top, behavior: 'smooth' }); }
      }

      onMounted(function() {
        (async function() {
          if (!topicId) { error.value = '缺少专题参数'; loading.value = false; return; }
          try {
            var res = await Promise.all([
              fetch('../data/meta/topics.json?t=' + Date.now()),
              fetch('../data/meta/search-index.json?t=' + Date.now()),
              fetch('../data/meta/editions.json?t=' + Date.now())
            ]);
            var tData = await res[0].json();
            var iData = await res[1].json();
            var eData = res[2].ok ? await res[2].json() : { editions: [] };
            var found = null;
            var topics = tData.topics || [];
            for (var i = 0; i < topics.length; i++) { if (topics[i].id === topicId) { found = topics[i]; break; } }
            if (!found) throw new Error('找不到专题: ' + topicId);
            topic.value = found;

            var fileMap = {};
            (eData.editions || []).forEach(function(ed) { fileMap[ed.id] = ed.file; });

            var matched = (iData.articles || []).filter(function(a) {
              var text = [a.title, a.preview, a.comment, a.category].join(' ');
              return found.keywords.some(function(kw) { try { return new RegExp(kw, 'i').test(text); } catch(e) { return text.includes(kw); } });
            });
            matched.sort(function(a, b) { return normalizeDate(a.date).localeCompare(normalizeDate(b.date)); });
            articles.value = matched.map(function(a) {
              return { ...a, date: normalizeDate(a.date), editionUrl: fileMap[a.editionId] ? '../' + fileMap[a.editionId] : null };
            });

            document.title = found.emoji + ' ' + found.title + ' | 茉霓专题';

            if (found.coverColor) {
              var hexes = found.coverColor.match(/#[a-fA-F0-9]{6}/g);
              if (hexes && hexes.length > 0) {
                function toLum(h) { return 0.299*parseInt(h.substr(1,2),16)+0.587*parseInt(h.substr(3,2),16)+0.114*parseInt(h.substr(5,2),16); }
                hexes.sort(function(a, b) { return toLum(b) - toLum(a); });
                document.body.style.background = 'linear-gradient(180deg, ' + hexes[0] + ' 0%, #0c0c0c 100%)';
                document.body.style.backgroundAttachment = 'fixed';
              }
            }

            generateShapes(found);
          } catch(e) { error.value = e.message; }
          finally { loading.value = false; }
        })();
      });

      return { topic: topic, articles: articles, loading: loading, error: error, dayCount: dayCount, dateRange: dateRange, groupedArticles: groupedArticles, scrollToDay: scrollToDay };
    }
  }).mount('#app');

  window.addEventListener('scroll', function() {
    var el = document.querySelector('.topbar');
    if (el) { if (window.scrollY > 60) el.classList.add('scrolled'); else el.classList.remove('scrolled'); }
  });
})();