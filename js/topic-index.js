(function() {
  var { createApp, ref, onMounted } = Vue;
  createApp({
    setup: function() {
      var topics = ref([]);
      var bridgeText = ref('');
      var today = ref('');
      function normalizeDate(d) { return d ? d.replace(/-/g, '') : ''; }
      function formatDate(d) { var s = normalizeDate(d); return parseInt(s.substring(4,6)) + '月' + parseInt(s.substring(6,8)) + '日'; }

      function generateShapes() {
        var geo = topics.value[0] ? (topics.value[0].geoStyle || '') : '';
        if (!geo) geo = 'circles';
        var container = document.getElementById('fixedShapes');
        if (!container) return;
        container.innerHTML = '';
        var placed = [];
        function getPos() {
          var r, t, overlaps, tries = 0;
          do { r = 5 + Math.random() * 90; t = 5 + Math.random() * 80; overlaps = false;
            for (var j = 0; j < placed.length; j++) { if (Math.abs(placed[j].r - r) < 12 && Math.abs(placed[j].t - t) < 12) { overlaps = true; break; } }
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

      onMounted(function() {
        (async function() {
          try {
            var tData = await (await fetch('../data/meta/topics.json?t=' + Date.now())).json();
            var iData = await (await fetch('../data/meta/search-index.json?t=' + Date.now())).json();
            var all = iData.articles || [];
            var grand = 0;
            topics.value = (tData.topics || []).map(function(t) {
              var matched = all.filter(function(a) {
                var text = [a.title, a.preview, a.comment, a.category].join(' ');
                return t.keywords.some(function(kw) { try { return new RegExp(kw, 'i').test(text); } catch(e) { return text.includes(kw); } });
              });
              var dates = [];
              matched.forEach(function(a) { var nd = normalizeDate(a.date); if (dates.indexOf(nd) === -1) dates.push(nd); });
              dates.sort(); grand += matched.length;
              return { ...t, articleCount: matched.length, dayCount: dates.length,
                dateRange: dates.length > 1 ? formatDate(dates[0]) + '—' + formatDate(dates[dates.length - 1]) : dates.length === 1 ? formatDate(dates[0]) : '' };
            });
            bridgeText.value = '追踪持续发生的重大事件，把碎片化的日报串联成完整的叙事线。每个专题都是一本独立刊物。';
            today.value = new Date().getFullYear() + '年' + (new Date().getMonth()+1) + '月' + new Date().getDate() + '日';
            if (topics.value.length && topics.value[0].coverColor) {
              var hexes = topics.value[0].coverColor.match(/#[a-fA-F0-9]{6}/g);
              if (hexes && hexes.length > 0) {
                function toLum(h) { return 0.299*parseInt(h.substr(1,2),16)+0.587*parseInt(h.substr(3,2),16)+0.114*parseInt(h.substr(5,2),16); }
                hexes.sort(function(a, b) { return toLum(b) - toLum(a); });
                document.body.style.background = 'linear-gradient(180deg, ' + hexes[0] + ' 0%, #0c0c0c 100%)';
                document.body.style.backgroundAttachment = 'fixed';
              }
            }
            generateShapes();
          } catch(e) { console.error(e); }
        })();
      });

      return { topics: topics, bridgeText: bridgeText, today: today };
    }
  }).mount('#app');

  window.addEventListener('scroll', function() {
    document.querySelector('.topbar').classList.toggle('scrolled', window.scrollY > 60);
  });
})();