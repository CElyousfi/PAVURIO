/* Pavurio website: every interaction is optional (the page reads fine without JS). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var T = {}; try { T = JSON.parse(($('#pv') || {}).textContent || '{}'); } catch (e) {}
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (s, v) { return String(s || '').replace(/\{(\w+)\}/g, function (_, k) { return v[k]; }); };
  var buzz = function () { try { navigator.vibrate && navigator.vibrate(10); } catch (e) {} };

  // device classes: phones hide the QR; iPhones see "coming soon" first
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) document.body.classList.add('ios');
  if (ios || /Android|Mobile/.test(ua)) document.body.classList.add('mobile');

  // header: border on scroll, progress bar, burger, features menu, language picker
  var top = $('.top'), prog = $('.progress'), ticking = false;
  function onScroll() {
    ticking = false;
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (prog) prog.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
    if (top) top.classList.toggle('scrolled', h.scrollTop > 8);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  var burger = $('.burger');
  if (burger) burger.addEventListener('click', function () { var o = top.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
  $$('.dd').forEach(function (dd) {
    var b = $('button', dd);
    b.addEventListener('click', function (e) { e.stopPropagation(); var o = dd.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
  });
  document.addEventListener('click', function (e) { $$('.dd.open').forEach(function (d) { if (!d.contains(e.target)) { d.classList.remove('open'); $('button', d).setAttribute('aria-expanded', 'false'); } }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('.dd.open').forEach(function (d) { d.classList.remove('open'); }); });
  $$('.lang select').forEach(function (s) { s.addEventListener('change', function () { location.href = s.value; }); });
  $$('.top .nav a').forEach(function (a) { a.addEventListener('click', function () { top.classList.remove('open'); }); });

  // reveal on scroll
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else $$('.reveal').forEach(function (el) { el.classList.add('in'); });

  // toast, confetti, hearts
  var toastEl = $('.toast'), tt;
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { toastEl.classList.remove('on'); }, 2600); }
  var fx = $('.fx'), COLS = ['#14B8C4', '#FFD233', '#F07AB0', '#3DB86B', '#8E6CEB', '#38B6E8', '#FF9F43'];
  function confetti(el, n) {
    if (reduce || !fx || !el.animate) return;
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; n = n || 46;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i'); p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.background = COLS[i % COLS.length]; fx.appendChild(p);
      var a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * v + 'px,' + (Math.sin(a) * v + 300) + 'px) rotate(' + (Math.random() * 900 - 450) + 'deg)', opacity: 0 }],
        { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = (function (q) { return function () { q.remove(); }; })(p);
    }
  }
  function hearts(el, ch) {
    if (reduce || !fx || !el.animate) return;
    var r = el.getBoundingClientRect();
    for (var i = 0; i < 5; i++) {
      var h = document.createElement('b'); h.textContent = ch || '❤️'; h.style.left = (r.left + r.width / 2 - 10) + 'px'; h.style.top = (r.top + r.height / 3) + 'px'; fx.appendChild(h);
      h.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: 'translate(' + (Math.random() * 140 - 70) + 'px,' + (-80 - Math.random() * 80) + 'px) scale(1.1)', opacity: 0 }],
        { duration: 1000 + Math.random() * 500, easing: 'ease-out' }).onfinish = (function (q) { return function () { q.remove(); }; })(h);
    }
  }

  // rolling digits (the app's RollingNumber)
  function roll(el, text) {
    text = String(text);
    if (reduce) { el.textContent = text; return; }
    if (!el.classList.contains('roll')) { el.classList.add('roll'); el.textContent = ''; }
    var kids = el.children;
    while (kids.length > text.length) el.removeChild(el.firstChild);
    while (kids.length < text.length) {
      var d = document.createElement('span'); d.className = 'd';
      for (var k = 0; k <= 9; k++) { var s = document.createElement('span'); s.textContent = k; d.appendChild(s); }
      el.insertBefore(d, el.firstChild);
    }
    for (var i = 0; i < text.length; i++) {
      var c = text[i], node = kids[i];
      if (/\d/.test(c)) {
        if (!node.classList.contains('d')) { var nd = document.createElement('span'); nd.className = 'd'; for (var j = 0; j <= 9; j++) { var q = document.createElement('span'); q.textContent = j; nd.appendChild(q); } el.replaceChild(nd, node); node = nd; }
        node.style.transform = 'translateY(' + (-1.2 * +c) + 'em)';
      } else {
        if (!node.classList.contains('s')) { var ns = document.createElement('span'); ns.className = 's'; el.replaceChild(ns, node); node = ns; }
        node.textContent = c;
      }
    }
    el.setAttribute('aria-label', text);
  }

  // hero: tap cares, the pet colours in
  var demo = $('#demo');
  if (demo) {
    var cares = $$('.care', demo), n = 0, cnt = $('[data-n]', demo), sub = $('[data-sub]', demo), col = $('.pet .col', demo), again = $('.again', demo), hey = $('.hey');
    var paint = function () {
      var p = n / cares.length;
      col.style.clipPath = 'inset(' + (100 - p * 100) + '% 0 0 0)';
      roll(cnt, n);
      sub.textContent = n === cares.length ? T.try_done : fmt(T.try_logged, { n: n });
      again.hidden = n < cares.length;
    };
    cares.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('on')) return;
        b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); n++; paint(); hearts(b, '✨'); buzz();
        if (hey) hey.classList.add('gone');
        if (n === cares.length) { confetti($('.pet', demo), 70); var pet = $('.pet', demo); pet.classList.remove('jump'); void pet.offsetWidth; pet.classList.add('jump'); }
      });
    });
    again.addEventListener('click', function () { n = 0; cares.forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); paint(); });
    paint();
    var duo = $('.duo');
    if (duo) duo.addEventListener('click', function () { duo.classList.remove('jump'); void duo.offsetWidth; duo.classList.add('jump'); hearts(duo); buzz(); });
  }

  // tour: segmented control with a sliding thumb, screens cross-fade
  var tour = $('#tour');
  if (tour) {
    var tabs = $$('.seg button', tour), thumb = $('.seg .thumb', tour), shots = $$('.scr img', tour), cap = $('.cap', tour), ti = 0, tauto;
    var place = function () { var b = tabs[ti]; thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = 'translateX(' + b.offsetLeft + 'px)'; };
    var go = function (k) {
      ti = (k + tabs.length) % tabs.length;
      tabs.forEach(function (b, j) { b.setAttribute('aria-selected', j === ti); b.tabIndex = j === ti ? 0 : -1; });
      shots.forEach(function (s, j) { s.classList.toggle('on', j === ti); });
      cap.style.opacity = 0; setTimeout(function () { cap.textContent = T.tabs[ti][1]; cap.style.opacity = 1; }, 180);
      place();
    };
    var auto = function () { clearInterval(tauto); if (!reduce) tauto = setInterval(function () { go(ti + 1); }, 4200); };
    tabs.forEach(function (b, j) {
      b.addEventListener('click', function () { go(j); auto(); buzz(); });
      b.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(ti + (e.key === 'ArrowRight' ? 1 : -1)); tabs[ti].focus(); auto(); } });
    });
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    go(0);
    var seen = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) auto(); else clearInterval(tauto); }); });
    seen.observe(tour);
  }

  // reminders: slide to give
  var dose = $('#dose');
  if (dose) {
    var sl = $('.slide', dose), knob = $('.knob', dose), fill = $('.fill', dose), msg = $('.given span', dose), sx = null, max = 0, cur = 0;
    var setX = function (x) { cur = Math.max(0, Math.min(max, x)); knob.style.transform = 'translateX(' + cur + 'px)'; fill.style.width = (cur + 72) + 'px'; };
    var finish = function () {
      sl.classList.add('done'); buzz();
      var d = new Date(), hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, '0');
      msg.textContent = fmt(T.rem_given, { time: hh + ':' + mm });
      setTimeout(function () { dose.classList.add('ok'); confetti(dose, 50); }, 120);
    };
    var reset = function () { knob.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)'; fill.style.transition = 'width .45s cubic-bezier(.34,1.56,.64,1)'; setX(0); };
    knob.addEventListener('pointerdown', function (e) { max = sl.offsetWidth - 72; sx = e.clientX - cur; knob.setPointerCapture(e.pointerId); knob.style.transition = fill.style.transition = 'none'; });
    knob.addEventListener('pointermove', function (e) { if (sx !== null) setX(e.clientX - sx); });
    var up = function () { if (sx === null) return; sx = null; if (cur > max * 0.85) { setX(max); finish(); } else reset(); };
    knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
    knob.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); max = sl.offsetWidth - 72; knob.style.transition = fill.style.transition = 'transform .4s, width .4s'; setX(max); finish(); } });
    $('.given button', dose).addEventListener('click', function () { dose.classList.remove('ok'); sl.classList.remove('done'); reset(); });
  }

  // pantry: log meals, watch the forecast; restock
  var bag = $('#bag');
  if (bag) {
    var FULL = 12, PER = 0.25, DAY = 0.5, LEAD = 3, kg = 4.5;
    var left = $('[data-left]', bag), days = $('[data-days]', bag), order = $('[data-order]', bag), st = $('.status', bag), bar = $('.bar i', bag), c = $('.fillart .c', bag);
    var lang = document.documentElement.lang || 'en';
    var wd = function (n) { var d = new Date(); d.setDate(d.getDate() + n); try { return d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric' }); } catch (e) { return d.toDateString().slice(0, 10); } };
    var draw = function () {
      var p = kg / FULL, dl = Math.floor(kg / DAY + 1e-9);
      roll(left, (Math.round(kg * 100) / 100).toFixed(kg % 1 ? 2 : 0).replace(/0$/, '').replace(/\.$/, '').replace('.', lang === 'en' ? '.' : ','));
      roll(days, dl);
      order.textContent = dl - LEAD <= 0 ? (kg <= 0 ? '—' : T.pan_today || '!') : wd(dl - LEAD);
      bar.style.width = (p * 100) + '%';
      bar.style.background = kg <= 0 ? 'var(--red)' : dl <= LEAD + 7 ? 'var(--meal)' : 'var(--green)';
      c.style.clipPath = 'inset(' + (100 - p * 100) + '% 0 0 0)';
      st.className = 'status' + (kg <= 0 ? ' out' : dl - LEAD <= 7 ? ' soon' : '');
      st.textContent = kg <= 0 ? T.pan_out : dl - LEAD <= 7 ? fmt(T.pan_order, { day: dl - LEAD <= 0 ? (T.pan_today || '') : wd(dl - LEAD) }) : T.pan_ok;
    };
    $('[data-log]', bag).addEventListener('click', function (e) { if (kg <= 0) return; kg = Math.max(0, kg - PER); draw(); buzz(); hearts(e.currentTarget, '🍖'); if (kg <= 0) toast(T.pan_out); });
    $('[data-restock]', bag).addEventListener('click', function () { kg = FULL; draw(); confetti($('.fillart', bag), 40); buzz(); });
    draw();
  }

  // live activity: countdown to medicine time
  var la = $('#la');
  if (la) {
    var clk = $('.clk', la), end = Date.now() + 12 * 60 * 1000 + 4000, lt;
    var tick = function () { var s = Math.max(0, Math.round((end - Date.now()) / 1000)); clk.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    tick(); lt = setInterval(tick, 1000);
    $('button', la).addEventListener('click', function () { if (la.classList.contains('ok')) return; la.classList.add('ok'); clearInterval(lt); clk.textContent = '✓'; confetti(la, 40); buzz(); });
  }

  // walk timer
  var live = $('#walk');
  if (live) {
    var wc = $('.clock', live), ws = $('.s', live), start = Date.now() - (18 * 60 + 42) * 1000, pausedAt = 0, sub0 = ws.textContent;
    var wt = function () { var now = pausedAt || Date.now(), s = Math.floor((now - start) / 1000); wc.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
    wt(); setInterval(function () { if (!live.classList.contains('done')) wt(); }, 1000);
    var pb = $('.p', live);
    pb.addEventListener('click', function () {
      if (pausedAt) { start += Date.now() - pausedAt; pausedAt = 0; live.classList.remove('paused'); pb.textContent = T.walk_pause; ws.textContent = sub0; }
      else { pausedAt = Date.now(); live.classList.add('paused'); pb.textContent = T.walk_resume; ws.textContent = T.walk_paused; }
      wt(); buzz();
    });
    $('.f', live).addEventListener('click', function () { live.classList.add('done'); confetti(live, 50); toast(T.walk_saved); buzz(); });
    $('.n', live).addEventListener('click', function () { live.classList.remove('done', 'paused'); start = Date.now(); pausedAt = 0; pb.textContent = T.walk_pause; ws.textContent = sub0; wt(); });
  }

  // memory cards
  var mc = $$('.mcard');
  mc.forEach(function (m) {
    var act = function () { mc.forEach(function (x) { x.classList.toggle('front', x === m); }); hearts(m, '💛'); buzz(); };
    m.addEventListener('click', act);
    m.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });

  // footer: copy email
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      var m = b.getAttribute('data-copy');
      if (navigator.clipboard) { e.preventDefault(); navigator.clipboard.writeText(m).then(function () { toast(T.copied || m); }, function () { location.href = 'mailto:' + m; }); }
    });
  });
})();
