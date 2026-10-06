/* ═══════════════════════════════════════════════════════════════
   工具层：DOM / 随机 / 数值动画 / 通知 / 模态 / 微交互
   ═══════════════════════════════════════════════════════════════ */
window.ES = window.ES || {};

ES.util = (function () {
  'use strict';

  /* ── DOM ── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function el(tag, attrs, html) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.indexOf('data-') === 0 || k === 'role' || k === 'aria-label' || k.indexOf('aria-') === 0) node.setAttribute(k, v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  function esc(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function frag() { return document.createDocumentFragment(); }

  /* ── 数值 ── */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function round(v, d) { const p = Math.pow(10, d || 0); return Math.round(v * p) / p; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function money(v) {
    const n = Math.round(v || 0);
    if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(2) + ' 亿';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + ' 万';
    return String(n);
  }
  function fmtNum(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ── 随机（可复现） ── */
  function makeRng(seed) {
    let s = seed >>> 0 || 88675123;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
  function rand() { return rng(); }
  function randInt(a, b) { return Math.floor(rand() * (b - a + 1)) + a; }
  function chance(p) { return rand() < p; }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function pickMany(arr, n) {
    const copy = arr.slice(); const out = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    return out;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function weightedPick(list, weightFn) {
    let total = 0; const ws = list.map(function (it) { const w = Math.max(0, weightFn(it)); total += w; return w; });
    let r = rand() * total;
    for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function uid(prefix) { return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8); }

  /* ── 数值动画 ── */
  function animateNumber(node, from, to, opts) {
    if (!node) return;
    opts = opts || {};
    const dur = opts.duration || 520;
    const dec = opts.decimals || 0;
    const suffix = opts.suffix || '';
    const prefix = opts.prefix || '';
    if (document.documentElement.getAttribute('data-motion') === 'reduced') {
      node.textContent = prefix + round(to, dec).toFixed(dec) + suffix; return;
    }
    const start = performance.now();
    const f = from === to ? 0 : from;
    cancelAnimationFrame(node.__animRaf || 0);
    function step(now) {
      const t = clamp((now - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      node.textContent = prefix + (f + (to - f) * e).toFixed(dec) + suffix;
      if (t < 1) node.__animRaf = requestAnimationFrame(step);
    }
    node.__animRaf = requestAnimationFrame(step);
  }

  /* ── 节流 ── */
  function debounce(fn, wait) {
    let t; return function () { const args = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, wait || 160); };
  }
  function rafThrottle(fn) {
    let queued = false, lastArgs = null;
    return function () {
      lastArgs = arguments;
      if (queued) return; queued = true;
      requestAnimationFrame(function () { queued = false; fn.apply(null, lastArgs); });
    };
  }

  /* ── 屏幕阅读器播报 ── */
  function announce(text) {
    const node = $('#sr-announcer');
    if (node) { node.textContent = ''; setTimeout(function () { node.textContent = text; }, 60); }
  }

  /* ── 通知（前端内置，非浏览器 alert） ── */
  const toastQueue = [];
  function toast(opts) {
    if (typeof opts === 'string') opts = { title: opts };
    opts = opts || {};
    const root = $('#toast-root');
    if (!root) return;
    const tone = opts.tone || 'info';
    const iconMap = { info: 'info', warn: 'warn', error: 'warn', success: 'check', gold: 'star', achieve: 'medal' };
    const node = el('div', { class: 'toast', 'data-tone': tone, role: 'status' });
    node.innerHTML =
      '<span class="toast-ico">' + icon(opts.icon || iconMap[tone] || 'info', 'icon-sm') + '</span>' +
      '<div class="grow">' +
        '<div class="toast-title">' + esc(opts.title || '系统通知') + '</div>' +
        (opts.msg ? '<div class="toast-msg">' + opts.msg + '</div>' : '') +
      '</div>' +
      '<button type="button" class="toast-close" aria-label="关闭通知">' + icon('x', 'icon-xs') + '</button>' +
      '<span class="toast-bar" style="animation-duration:' + (opts.duration || 5200) + 'ms"></span>';
    root.appendChild(node);
    toastQueue.push(node);
    while (toastQueue.length > 4) removeToast(toastQueue.shift());
    const timer = setTimeout(function () { removeToast(node); }, opts.duration || 5200);
    node.querySelector('.toast-close').addEventListener('click', function () { clearTimeout(timer); removeToast(node); });
    return node;
  }
  function removeToast(node) {
    if (!node || !node.parentNode) return;
    const i = toastQueue.indexOf(node); if (i >= 0) toastQueue.splice(i, 1);
    node.classList.add('is-out');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 300);
  }

  /* ── 模态框 ── */
  const modalStack = [];
  function openModal(id, opts) {
    const m = document.getElementById(id);
    if (!m || m.classList.contains('is-open')) return m;
    m.classList.remove('hidden');
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    modalStack.push(id);
    if (opts && opts.focus) {
      const target = m.querySelector(opts.focus);
      if (target) setTimeout(function () { target.focus(); }, 80);
    }
    document.body.setAttribute('data-modal', '1');
    m.__lastFocus = document.activeElement;
    return m;
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m || !m.classList.contains('is-open')) return;
    m.classList.add('is-closing');
    const idx = modalStack.indexOf(id); if (idx >= 0) modalStack.splice(idx, 1);
    setTimeout(function () {
      m.classList.remove('is-open', 'is-closing');
      m.classList.add('hidden');
      m.setAttribute('aria-hidden', 'true');
      if (!modalStack.length) document.body.removeAttribute('data-modal');
      if (m.__lastFocus && m.__lastFocus.focus) { try { m.__lastFocus.focus(); } catch (e) {} }
    }, 220);
  }
  function closeTop() {
    if (!modalStack.length) return false;
    closeModal(modalStack[modalStack.length - 1]);
    return true;
  }
  function topModal() { return modalStack.length ? document.getElementById(modalStack[modalStack.length - 1]) : null; }

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const m = $('#modal-confirm');
      $('#confirm-title').textContent = opts.title || '确认操作';
      $('#confirm-sub').textContent = opts.sub || '此操作需要二次确认';
      $('#confirm-body').innerHTML = opts.body || '<div class="alert" data-tone="warn">' + icon('warn') + '<div>' + esc(opts.message || '确定要继续吗？') + '</div></div>';
      $('#confirm-glyph').innerHTML = icon(opts.icon || 'warn', 'icon');
      const ok = $('#btn-confirm-ok');
      ok.className = 'btn btn-sm ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      ok.innerHTML = esc(opts.okText || '确认');
      const onOk = function () { cleanup(); closeModal('modal-confirm'); resolve(true); };
      const onCancel = function () { cleanup(); closeModal('modal-confirm'); resolve(false); };
      function cleanup() { ok.removeEventListener('click', onOk); m.querySelectorAll('[data-close="modal-confirm"]').forEach(function (b) { b.removeEventListener('click', onCancel); }); }
      ok.addEventListener('click', onOk);
      m.querySelectorAll('[data-close="modal-confirm"]').forEach(function (b) { b.addEventListener('click', onCancel); });
      openModal('modal-confirm', { focus: '#btn-confirm-ok' });
    });
  }

  /* ── 工具提示（内置，非浏览器 title） ── */
  function initTooltips() {
    const root = $('#tooltip-root');
    let node = null, current = null;
    function show(target) {
      const text = target.getAttribute('data-tip');
      if (!text) return;
      hide();
      current = target;
      node = el('div', { class: 'tip', html: text });
      root.appendChild(node);
      const r = target.getBoundingClientRect();
      const w = node.offsetWidth, h = node.offsetHeight;
      let left = r.left + r.width / 2 - w / 2;
      let top = r.top - h - 10;
      if (top < 8) top = r.bottom + 10;
      left = clamp(left, 8, window.innerWidth - w - 8);
      node.style.left = left + 'px';
      node.style.top = top + 'px';
    }
    function hide() { if (node && node.parentNode) node.parentNode.removeChild(node); node = null; current = null; }
    document.addEventListener('mouseover', function (e) {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t && t !== current) show(t);
      else if (!t) hide();
    });
    document.addEventListener('mouseout', function (e) {
      if (current && (!e.relatedTarget || !current.contains(e.relatedTarget))) hide();
    });
    window.addEventListener('scroll', hide, true);
    document.addEventListener('click', hide, true);
  }

  /* ── 涟漪与倾斜（事件委托） ── */
  function initRipples() {
    document.addEventListener('pointerdown', function (e) {
      const btn = e.target.closest && e.target.closest('.btn, .choice, .chip, .card, .quick-choice, .lrow');
      if (!btn) return;
      if (document.documentElement.getAttribute('data-motion') === 'reduced') return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.1;
      const span = el('span', { class: 'ripple' });
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left) + 'px';
      span.style.top = (e.clientY - r.top) + 'px';
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
      btn.appendChild(span);
      setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 640);
    });
  }
  function initTilt() {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    let current = null, raf = 0, tx = 0, ty = 0;
    function apply() {
      raf = 0;
      if (!current) return;
      current.style.transform = 'perspective(900px) rotateX(' + ty.toFixed(2) + 'deg) rotateY(' + tx.toFixed(2) + 'deg) translateY(-3px)';
    }
    document.addEventListener('mousemove', function (e) {
      const t = e.target.closest && e.target.closest('.tilt, .card[data-tilt="1"]');
      if (t !== current) {
        if (current) { current.style.transform = ''; }
        current = t;
      }
      if (!current) return;
      const r = current.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 6;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 6;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    document.addEventListener('mouseleave', function () { if (current) { current.style.transform = ''; current = null; } });
  }

  /* ── 光标光晕（桌面端） ── */
  function initCursorAura() {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    const aura = $('#cursor-aura');
    if (!aura) return;
    const move = rafThrottle(function (x, y) { aura.style.transform = 'translate3d(' + (x - 260) + 'px,' + (y - 260) + 'px,0)'; });
    document.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
  }

  /* ── 折叠面板 ── */
  function initAccordions() {
    document.addEventListener('click', function (e) {
      const head = e.target.closest && e.target.closest('.acc-head');
      if (!head) return;
      const item = head.closest('.acc-item');
      if (item) item.classList.toggle('is-open');
    });
  }

  /* ── 标签页（通用） ── */
  function initTabs() {
    // 为分页面板打上分组标记，供切换时成组显隐
    $$('[data-mtab]').forEach(function (tab) {
      const pane = document.getElementById(tab.getAttribute('data-pane'));
      if (pane) pane.setAttribute('data-group', tab.getAttribute('data-mtab'));
    });
    document.addEventListener('click', function (e) {
      const tab = e.target.closest && e.target.closest('[data-mtab]');
      if (!tab) return;
      const group = tab.getAttribute('data-mtab');
      const paneId = tab.getAttribute('data-pane');
      $$('[data-mtab="' + group + '"]').forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
      const container = tab.closest('.modal-shell') || document;
      $$('.tab-panel', container).forEach(function (p) {
        if (p.getAttribute('data-group') !== group) return;
        p.classList.toggle('is-active', p.id === paneId);
      });
      const target = document.getElementById(paneId);
      if (target && ES.audio) ES.audio.play('tab');
    });
  }

  /* ── 浮动数值 ── */
  function floatDelta(anchor, value, opts) {
    if (!anchor || !value) return;
    opts = opts || {};
    const node = el('span', { class: 'delta-float ' + (value > 0 ? 'pos' : 'neg'), text: (value > 0 ? '+' : '') + round(value, opts.decimals || 0) });
    if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
    anchor.appendChild(node);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1600);
  }

  /* ── 粒子爆发 ── */
  function burst(host, count, color, radius) {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return;
    count = count || 16; radius = radius || 130;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + rand() * 0.3;
      const dist = radius * (0.55 + rand() * 0.75);
      const p = el('span', { class: 'particle' });
      p.style.setProperty('--pc', color || 'var(--accent)');
      p.style.setProperty('--px', (Math.cos(ang) * dist).toFixed(1) + 'px');
      p.style.setProperty('--py', (Math.sin(ang) * dist).toFixed(1) + 'px');
      p.style.setProperty('--pdur', (0.8 + rand() * 0.9).toFixed(2) + 's');
      p.style.left = '50%'; p.style.top = '50%';
      host.appendChild(p);
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1800);
    }
  }

  return {
    $: $, $$: $$, el: el, icon: icon, esc: esc, clear: clear, frag: frag,
    clamp: clamp, lerp: lerp, round: round, pad2: pad2, money: money, fmtNum: fmtNum,
    rng: rand, makeRng: makeRng, randInt: randInt, chance: chance, pick: pick, pickMany: pickMany,
    shuffle: shuffle, weightedPick: weightedPick, uid: uid,
    animateNumber: animateNumber, debounce: debounce, rafThrottle: rafThrottle, announce: announce,
    toast: toast, openModal: openModal, closeModal: closeModal, closeTop: closeTop, topModal: topModal,
    confirmDialog: confirmDialog, floatDelta: floatDelta, burst: burst,
    initTooltips: initTooltips, initRipples: initRipples, initTilt: initTilt,
    initCursorAura: initCursorAura, initAccordions: initAccordions, initTabs: initTabs
  };
})();
