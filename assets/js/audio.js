window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   音效层：WebAudio 实时合成（不加载任何音频文件）
   ═══════════════════════════════════════════════════════════════ */
ES.audio = (function () {
  'use strict';

  let ctx = null;
  let master = null;
  let enabled = true;
  let volume = 0.45;
  const catOn = { ui: true, dice: true, notify: true };
  const CAT = { click: 'ui', hover: 'ui', tab: 'ui', open: 'ui', close: 'ui', type: 'ui', dice: 'dice', roll: 'dice', success: 'dice', fail: 'dice', notify: 'notify', achieve: 'notify', levelup: 'notify', cash: 'notify' };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch (e) { enabled = false; ctx = null; }
    return ctx;
  }

  function resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }

  function tone(opts) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const cat = CAT[opts.name] || 'ui';
    if (!catOn[cat === 'notify' ? 'notify' : cat]) return;
    const t0 = c.currentTime + (opts.delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t0 + (opts.dur || 0.12));
    const peak = (opts.gain === undefined ? 0.16 : opts.gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.12));
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + (opts.dur || 0.12) + 0.04);
  }

  function noise(dur, gainVal, filterFreq) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = filterFreq || 1200; filter.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = gainVal === undefined ? 0.08 : gainVal;
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start();
  }

  const LIB = {
    click: function () { tone({ name: 'click', freq: 520, to: 320, type: 'triangle', dur: 0.07, gain: 0.1 }); },
    hover: function () { tone({ name: 'hover', freq: 880, type: 'sine', dur: 0.035, gain: 0.028 }); },
    tab: function () { tone({ name: 'tab', freq: 660, to: 990, type: 'sine', dur: 0.08, gain: 0.06 }); },
    open: function () { tone({ name: 'open', freq: 300, to: 620, type: 'sine', dur: 0.16, gain: 0.07 }); },
    close: function () { tone({ name: 'close', freq: 620, to: 260, type: 'sine', dur: 0.14, gain: 0.06 }); },
    type: function () { tone({ name: 'type', freq: 1400 + Math.random() * 400, type: 'square', dur: 0.012, gain: 0.012 }); },
    roll: function () {
      noise(0.5, 0.06, 900);
      for (let i = 0; i < 7; i++) tone({ name: 'roll', freq: 220 + i * 60, type: 'square', dur: 0.035, gain: 0.035, delay: i * 0.055 });
    },
    dice: function () { noise(0.22, 0.07, 1500); tone({ name: 'dice', freq: 300, to: 720, type: 'triangle', dur: 0.2, gain: 0.1 }); },
    success: function () { [523.25, 659.25, 783.99].forEach(function (f, i) { tone({ name: 'success', freq: f, type: 'triangle', dur: 0.22, gain: 0.1, delay: i * 0.07 }); }); },
    fail: function () { [330, 262, 196].forEach(function (f, i) { tone({ name: 'fail', freq: f, type: 'sawtooth', dur: 0.24, gain: 0.07, delay: i * 0.09 }); }); },
    notify: function () { tone({ name: 'notify', freq: 784, to: 1046, type: 'sine', dur: 0.14, gain: 0.09 }); },
    achieve: function () { [659.25, 830.61, 987.77, 1318.5].forEach(function (f, i) { tone({ name: 'achieve', freq: f, type: 'triangle', dur: 0.3, gain: 0.09, delay: i * 0.08 }); }); },
    levelup: function () { [440, 554.37, 659.25, 880].forEach(function (f, i) { tone({ name: 'levelup', freq: f, type: 'sine', dur: 0.36, gain: 0.085, delay: i * 0.1 }); }); },
    cash: function () { tone({ name: 'cash', freq: 1046, type: 'square', dur: 0.06, gain: 0.05 }); tone({ name: 'cash', freq: 1568, type: 'square', dur: 0.1, gain: 0.05, delay: 0.07 }); }
  };

  function play(name) {
    if (!enabled) return;
    resume();
    const fn = LIB[name];
    if (fn) { try { fn(); } catch (e) {} }
  }
  function setEnabled(v) { enabled = !!v; if (enabled) resume(); }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume; }
  function setCategory(cat, on) { catOn[cat] = !!on; }
  function unlock() { resume(); }

  return { play: play, setEnabled: setEnabled, setVolume: setVolume, setCategory: setCategory, unlock: unlock, get enabled() { return enabled; } };
})();
