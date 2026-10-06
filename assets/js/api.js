window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   API 接入层（真实 HTTP）· 对应参考实现的 api-router.ts / useApiRouter.ts
   —— 主 API：跑剧情（<maintext>/<option>）
   —— 次 API：跑总结与变量（<sum>/<vars>），可指向更便宜的模型
   —— 支持 OpenAI 兼容端点（OpenAI / DeepSeek / LM Studio / Ollama / vLLM / one-api…）
   —— 流式 SSE 解析、任务路由、失败回退（次→主→本地引擎）、请求审计
   ═══════════════════════════════════════════════════════════════ */
ES.api = (function () {
  'use strict';
  const U = ES.util;
  const KEY = 'apex-corridor.api.v1';

  const DEFAULTS = {
    mode: 'local',                 /* local | single | dual */
    proxyPrefix: '',               /* 可选：CORS 代理前缀，如 https://my-proxy.example.com/ */
    fallbackLocal: true,           /* API 失败时回退到本地叙事引擎 */
    primary: {
      baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini',
      temperature: 0.85, maxTokens: 1200, timeout: 90000, stream: true, headers: ''
    },
    secondary: {
      enabled: false, baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat',
      temperature: 0.3, maxTokens: 400, timeout: 60000, stream: false, headers: ''
    }
  };

  let cfg = null;
  let audit = [];
  let lastError = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      cfg = raw ? Object.assign(clone(DEFAULTS), JSON.parse(raw)) : clone(DEFAULTS);
      cfg.primary = Object.assign(clone(DEFAULTS.primary), cfg.primary || {});
      cfg.secondary = Object.assign(clone(DEFAULTS.secondary), cfg.secondary || {});
    } catch (e) { cfg = clone(DEFAULTS); }
    return cfg;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }
  function reset() { cfg = clone(DEFAULTS); audit = []; save(); return cfg; }
  function config() { if (!cfg) load(); return cfg; }
  function setConfig(patch) { cfg = Object.assign(config(), patch); save(); return cfg; }
  function clearKeys() { cfg.primary.apiKey = ''; cfg.secondary.apiKey = ''; save(); }
  function getAudit() { return audit.slice(0, 30); }
  function getLastError() { return lastError; }

  /** 是否走真实 HTTP（模式为 single/dual 且主 API 填了地址） */
  function isEnabled() {
    const c = config();
    return (c.mode === 'single' || c.mode === 'dual') && !!c.primary.baseUrl;
  }
  function mode() { return config().mode; }

  function headersFor(t) {
    const h = { 'Content-Type': 'application/json' };
    if (t.apiKey) h['Authorization'] = 'Bearer ' + t.apiKey;
    if (t.headers) {
      try { const extra = JSON.parse(t.headers); Object.keys(extra).forEach(function (k) { h[k] = extra[k]; }); } catch (e) {}
    }
    return h;
  }
  function urlFor(t) {
    const base = String(t.baseUrl || '').replace(/\/+$/, '');
    const prefix = String(config().proxyPrefix || '');
    return prefix + base + '/chat/completions';
  }
  function bodyFor(t, messages, stream) {
    const b = { model: t.model, messages: messages, temperature: Number(t.temperature), stream: !!stream };
    if (t.maxTokens) b.max_tokens = Number(t.maxTokens);
    return b;
  }

  /* ── SSE 解析（OpenAI 兼容：data: {...}\n\n，结束标记 [DONE]） ── */
  function parseSseChunk(buffer) {
    const out = { deltas: [], done: false, rest: '', errors: [] };
    const parts = String(buffer).split('\n');
    out.rest = parts.pop();
    parts.forEach(function (line) {
      const s = line.trim();
      if (!s || s.charAt(0) === ':') return;
      if (s.indexOf('data:') !== 0) return;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') { out.done = true; return; }
      try {
        const json = JSON.parse(payload);
        if (json.error) { out.errors.push(json.error.message || 'API error'); return; }
        const ch = (json.choices || [])[0] || {};
        const d = ch.delta || ch.message || {};
        const piece = d.content !== undefined ? d.content : (typeof ch.text === 'string' ? ch.text : '');
        if (piece) out.deltas.push(piece);
      } catch (e) { /* 忽略半包 */ }
    });
    return out;
  }
  function extractText(json) {
    const ch = (json.choices || [])[0] || {};
    if (ch.message && typeof ch.message.content === 'string') return ch.message.content;
    if (typeof ch.text === 'string') return ch.text;
    if (json.output_text) return json.output_text;
    return '';
  }

  /* ── 单次请求 ── */
  function chatOnce(target, t, messages, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, t.timeout || 90000);
    const started = Date.now();
    return fetch(urlFor(t), {
      method: 'POST', headers: headersFor(t), signal: ctrl.signal,
      body: JSON.stringify(bodyFor(t, messages, false))
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        return res.text().then(function (txt) {
          throw new Error('HTTP ' + res.status + ' ' + (txt || '').slice(0, 200));
        });
      }
      return res.json();
    }).then(function (json) {
      return { text: extractText(json), target: target, ms: Date.now() - started, usage: json.usage || null, streamed: false };
    }).catch(function (e) { clearTimeout(timer); throw e; });
  }

  /* ── 流式请求 ── */
  function chatStream(target, t, messages, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, t.timeout || 90000);
    const started = Date.now();
    let full = '';
    let buffer = '';
    const onDelta = (opts && opts.onDelta) || function () {};
    return fetch(urlFor(t), {
      method: 'POST', headers: headersFor(t), signal: ctrl.signal,
      body: JSON.stringify(bodyFor(t, messages, true))
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) { throw new Error('HTTP ' + res.status + ' ' + (txt || '').slice(0, 200)); });
      }
      if (!res.body || !res.body.getReader) return res.json().then(function (json) { const x = extractText(json); onDelta(x); return x; });
      const reader = res.body.getReader();
      const dec = new TextDecoder('utf-8');
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            const tail = parseSseChunk(buffer + '\n');
            tail.deltas.forEach(function (d) { full += d; onDelta(d); });
            if (tail.errors.length) throw new Error(tail.errors[0]);
            clearTimeout(timer);
            return full;
          }
          buffer += dec.decode(r.value, { stream: true });
          const ev = parseSseChunk(buffer);
          buffer = ev.rest;
          ev.deltas.forEach(function (d) { full += d; onDelta(d); });
          if (ev.errors.length) throw new Error(ev.errors[0]);
          return pump();
        });
      }
      return pump();
    }).then(function (text) {
      return { text: text || full, target: target, ms: Date.now() - started, streamed: true };
    }).catch(function (e) { clearTimeout(timer); throw e; });
  }

  /* ── 任务路由（story → 主；summary/vars → 次，失败回退主，再回退本地） ── */
  function routeFor(task) {
    const c = config();
    if (task === 'story') return { target: 'primary', t: c.primary };
    if (c.mode === 'dual' && c.secondary.enabled && c.secondary.baseUrl) return { target: 'secondary', t: c.secondary };
    return { target: 'primary', t: c.primary };
  }
  function friendlyError(e) {
    const m = String((e && e.message) || e);
    if (e && e.name === 'AbortError') return '请求超时或被取消';
    if (/Failed to fetch|NetworkError|load failed/i.test(m)) {
      return '网络不可达或被 CORS 拦截（浏览器直连第三方 API 常被拦）。建议改用本地 OpenAI 兼容服务（LM Studio / Ollama / vLLM），或填写代理前缀。';
    }
    if (/HTTP 401/.test(m)) return '鉴权失败（401）：请检查 API Key。';
    if (/HTTP 403/.test(m)) return '被拒绝（403）：Key 权限或地区限制。';
    if (/HTTP 404/.test(m)) return '端点不存在（404）：请检查 Base URL 是否为 …/v1。';
    if (/HTTP 429/.test(m)) return '限流（429）：稍后重试或降低频率。';
    if (/HTTP 5\d\d/.test(m)) return '服务端错误：' + m;
    return m;
  }
  function pushAudit(rec) {
    audit.unshift(rec);
    if (audit.length > 30) audit.length = 30;
  }

  /** 统一入口：按任务路由，带回退链 */
  function chat(opts) {
    const task = opts.task || 'story';
    const messages = opts.messages || [];
    const chain = [];
    const primary = { target: 'primary', t: config().primary };
    const secondary = { target: 'secondary', t: config().secondary };
    const r = routeFor(task);
    chain.push(r);
    if (r.target === 'secondary') chain.push(primary);
    else if (task !== 'story' && config().secondary.enabled && config().secondary.baseUrl) chain.push(secondary);

    function attempt(i) {
      if (i >= chain.length) return Promise.resolve({ local: true, target: 'local', text: '', ms: 0 });
      const step = chain[i];
      const useStream = !!step.t.stream && task === 'story';
      const runner = useStream ? chatStream : chatOnce;
      const started = Date.now();
      return runner(step.target, step.t, messages, opts).then(function (res) {
        pushAudit({ ts: Date.now(), task: task, target: res.target, model: step.t.model, ok: true, ms: res.ms, streamed: !!res.streamed, chars: (res.text || '').length });
        lastError = null;
        return res;
      }).catch(function (e) {
        const msg = friendlyError(e);
        pushAudit({ ts: Date.now(), task: task, target: step.target, model: step.t.model, ok: false, ms: Date.now() - started, error: msg });
        lastError = { task: task, target: step.target, message: msg };
        if (i + 1 < chain.length) {
          if (ES.util && ES.util.toast) U.toast({ tone: 'warn', title: (step.target === 'primary' ? '主 API' : '次 API') + ' 调用失败', msg: msg + ' → 自动切换备用通道。', duration: 6000 });
          return attempt(i + 1);
        }
        if (config().fallbackLocal) {
          U.toast({ tone: 'error', title: 'API 全部失败，回退本地引擎', msg: msg, duration: 8000 });
          return { local: true, target: 'local', text: '', ms: Date.now() - started, error: msg };
        }
        throw new Error(msg);
      });
    }
    return attempt(0);
  }

  /* ── 连接测试 ── */
  function test(target) {
    const t = target === 'secondary' ? config().secondary : config().primary;
    const started = Date.now();
    return chatOnce(target || 'primary', t, [{ role: 'user', content: 'ping' }], {}).then(function (res) {
      pushAudit({ ts: Date.now(), task: 'test', target: target || 'primary', model: t.model, ok: true, ms: res.ms, chars: (res.text || '').length });
      return { ok: true, ms: res.ms, model: t.model, sample: String(res.text || '').slice(0, 80) };
    }).catch(function (e) {
      const msg = friendlyError(e);
      pushAudit({ ts: Date.now(), task: 'test', target: target || 'primary', model: t.model, ok: false, ms: Date.now() - started, error: msg });
      return { ok: false, ms: Date.now() - started, error: msg };
    });
  }

  /* ── 次 API：从剧情文本里抽取 <sum> 与 <vars> 的专用提示词 ── */
  function summaryPrompt(storyText, stateVars) {
    return [
      { role: 'system', content: '你是游戏状态结算器。只输出两行标签，不要任何解释：\n<sum>本回合一句话总结</sum>\n<vars>{"属性.枪法":1,"状态.竞技状态":-6}</vars>\n键名规则见下，数值为正负整数（增量）。' },
      { role: 'user', content: '【当前状态】\n' + Object.keys(stateVars).map(function (k) { return k + ': ' + stateVars[k]; }).join('\n') +
          '\n\n【本回合剧情】\n' + storyText + '\n\n请给出 <sum> 与 <vars>。' }
    ];
  }

  load();

  return {
    KEY: KEY, DEFAULTS: DEFAULTS,
    config: config, setConfig: setConfig, save: save, reset: reset, clearKeys: clearKeys,
    isEnabled: isEnabled, mode: mode, routeFor: routeFor, chat: chat, test: test,
    parseSseChunk: parseSseChunk, summaryPrompt: summaryPrompt,
    getAudit: getAudit, getLastError: getLastError, friendlyError: friendlyError,
    urlFor: urlFor, bodyFor: bodyFor, headersFor: headersFor
  };
})();
