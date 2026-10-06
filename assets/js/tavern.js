window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   酒馆层（Taverlike）· 移植 SillyTavern 生态工程能力到纯前端原型
   参考：ariespo/tavernlike（Claude Code Skill：Integrate SillyTavern
        ecosystem into web projects）v3 游戏化扩展设计
   包含：
     ① lorebook-engine  关键词触发世界书（位置/常量/概率/选择性逻辑/递归扫描）
     ② prompt-assembler 按 prompt_order 组装上下文（预算裁剪 + 宏替换）
     ③ stream-parser    流式 XML 标签状态机（<maintext><option><sum><vars><thinking>）
     ④ vars-merger      JSON 深合并 + {{getvar}}/{{setvar}} 宏
     ⑤ floors          每楼层变量快照（回滚 / 分支 / 重新生成 / 继续）
     ⑥ importer         角色卡 V2 / 世界书 / 预设 的 SillyTavern 兼容导入导出
   本地叙事引擎扮演「主 API」，规则结算引擎扮演「次 API」。
   ═══════════════════════════════════════════════════════════════ */
ES.tavern = (function () {
  'use strict';
  const U = ES.util, D = ES.data;
  const KEY = 'apex-corridor.tavern.v1';

  /* ══════════ 常量（对齐 SKILL 默认值） ══════════ */
  const DEFAULT_TAGS = ['maintext', 'option', 'sum', 'vars', 'thinking', 'think'];
  const DEFAULT_OPAQUE = ['thinking', 'think'];
  const POSITIONS = ['before_char', 'after_char', 'before_example', 'after_example', 'at_depth', 'example_msg_top', 'example_msg_bottom', 'outlet'];
  const POS_LABEL = {
    before_char: '角色描述前', after_char: '角色描述后', before_example: '示例前',
    after_example: '示例后', at_depth: '按深度插入', example_msg_top: '示例消息顶',
    example_msg_bottom: '示例消息底', outlet: '输出槽（不注入）'
  };
  const DEFAULT_PROMPT_ORDER = [
    { identifier: 'main', name: '主提示词', role: 'system' },
    { identifier: 'worldInfoBefore', name: '世界书（前）', role: 'system' },
    { identifier: 'charDescription', name: '角色描述', role: 'system' },
    { identifier: 'charPersonality', name: '角色性格', role: 'system' },
    { identifier: 'scenario', name: '场景设定', role: 'system' },
    { identifier: 'personaDescription', name: '玩家设定', role: 'system' },
    { identifier: 'dialogueExamples', name: '对话示例', role: 'system' },
    { identifier: 'chatHistory', name: '对话历史', role: 'system' },
    { identifier: 'worldInfoAfter', name: '世界书（后）', role: 'system' },
    { identifier: 'jailbreak', name: '越狱/收尾指令', role: 'system' }
  ];
  const DEFAULT_FORMAT_PROMPT =
    '严格按照以下 XML 标签输出，不要使用 Markdown 包裹：\n' +
    '<thinking>…</thinking>   可选，思考过程，内部不再解析其它标签\n' +
    '<maintext>…</maintext>   必填，本回合剧情正文，可多段\n' +
    '<option>选项A\n选项B\n选项C</option>  必填，至少 2 项，每行一个\n' +
    '<sum>…</sum>             必填，本回合一句话总结\n' +
    '<vars>{ "属性.枪法": 1, "状态.竞技状态": -6 }</vars>  选填，JSON 深合并';

  /* ══════════ 工具 ══════════ */
  function uid(p) { return (p || 'id') + '-' + Math.random().toString(36).slice(2, 9); }
  /* 混合中英文字数估算（英文 ≈4 字符/token，中文 ≈1.6 字符/token） */
  function estimateTokens(text) {
    if (!text) return 0;
    const s = String(text);
    const cjk = (s.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    const rest = s.length - cjk;
    return Math.round(cjk / 1.6 + rest / 4);
  }
  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(patch).forEach(function (k) {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(out[k] || {}, v);
      else out[k] = v;
    });
    return out;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ══════════ ② 宏与变量 ══════════ */
  function replaceMacros(template, ctx) {
    let out = String(template || '')
      .replace(/\{\{user\}\}/g, ctx.userName || '玩家')
      .replace(/\{\{char\}\}/g, ctx.characterName || '联盟主持')
      .replace(/\{\{original\}\}/g, ctx.userInput || '');
    const vars = ctx.variables || {};
    out = out.replace(/\{\{getvar::([^}]+)\}\}/g, function (m, k) {
      const v = vars[k.trim()];
      return v === undefined ? '' : String(v);
    });
    out = out.replace(/\{\{([^{}:]+)\}\}/g, function (m, k) {
      const v = vars[k.trim()];
      return v === undefined ? m : String(v);
    });
    return out;
  }
  /** <vars> 解析：{"属性.枪法": 1} → { merge: {…} } */
  function parseVarsBlock(raw) {
    if (!raw || !String(raw).trim()) return { merge: {} };
    let txt = String(raw).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      const obj = JSON.parse(txt);
      return { merge: obj && typeof obj === 'object' ? obj : {} };
    } catch (e) {
      /* 宽松解析：允许 { "a": +1, "b": -2 } 这类带正号的数字 */
      const merge = {};
      const re = /"([^"]+)"\s*:\s*([+-]?\d+(?:\.\d+)?|true|false|null|"[^"]*")/g;
      let m;
      while ((m = re.exec(txt)) !== null) {
        let v = m[2];
        if (/^".*"$/.test(v)) v = v.slice(1, -1);
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v === 'null') v = null;
        else v = Number(v);
        merge[m[1]] = v;
      }
      return { merge: merge, parseError: true, raw: txt };
    }
  }
  function applyVarsPatch(base, patch) {
    return deepMerge(base || {}, (patch && patch.merge) || {});
  }
  function formatVariablesForPrompt(vars) {
    const keys = Object.keys(vars || {});
    if (!keys.length) return '';
    return '[当前状态]\n' + keys.map(function (k) { return k + ': ' + vars[k]; }).join('\n');
  }

  /* ══════════ ① 世界书引擎 ══════════ */
  function createLorebookEngine(book) {
    const cs = !!book.caseSensitive, whole = !!book.matchWholeWords;
    function norm(s) { return cs ? String(s) : String(s).toLowerCase(); }
    function has(text, kw) {
      const k = norm(kw);
      if (!k) return false;
      if (whole) return new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text);
      return text.indexOf(k) >= 0;
    }
    function entryMatch(entry, text, ctxText) {
      const keys = entry.keys || [];
      if (!keys.length) return false;
      const prim = keys.map(function (k) { return has(text, k); });
      const anyP = prim.some(Boolean), allP = prim.every(Boolean);
      let ok;
      switch (entry.selectiveLogic) {
        case 'not_all': ok = !allP; break;
        case 'not_any': ok = !anyP; break;
        default: ok = anyP;
      }
      if (!ok) return false;
      const sec = entry.secondaryKeys || [];
      if (!entry.selective || !sec.length) return true;
      const sm = sec.map(function (k) { return has(ctxText, k); });
      const anyS = sm.some(Boolean), allS = sm.every(Boolean);
      if (entry.selectiveLogic === 'and_all' || entry.selectiveLogic === 'not_all') return allS;
      return anyS;
    }
    function scan(text, ctxText) {
      const t = norm(text), c = ctxText !== undefined ? norm(ctxText) : t;
      const hit = [];
      (book.entries || []).forEach(function (e) {
        if (e.disable) return;
        if (e.constant) { hit.push({ entry: e, score: -9999, matchedKeywords: ['constant'] }); return; }
        if (e.useProbability !== false && e.probability !== undefined && e.probability < 100) {
          if (Math.random() * 100 >= e.probability) return;
        }
        if (entryMatch(e, t, c)) {
          hit.push({
            entry: e, score: e.order === undefined ? 100 : e.order,
            matchedKeywords: (e.keys || []).filter(function (k) { return has(t, k); })
          });
        }
      });
      return hit.sort(function (a, b) { return a.score - b.score; });
    }
    function recursiveScan(text, maxDepth, ctxText) {
      maxDepth = maxDepth || 3;
      if (!book.recursiveScanning || maxDepth <= 0) return scan(text, ctxText);
      const all = {}, order = [];
      let cur = text, depth = 0;
      while (depth < maxDepth) {
        const hits = scan(cur, ctxText);
        let fresh = false;
        hits.forEach(function (h) {
          if (!all[h.entry.id]) { all[h.entry.id] = h; order.push(h.entry.id); cur += ' ' + h.entry.content; fresh = true; }
        });
        if (!fresh) break;
        depth++;
      }
      return order.map(function (id) { return all[id]; }).sort(function (a, b) { return a.score - b.score; });
    }
    return { scan: scan, recursiveScan: recursiveScan, book: book };
  }

  /* ══════════ ③ 流式标签解析器 ══════════ */
  function StreamTagParser(tags, opaqueTags) {
    this.tags = tags || DEFAULT_TAGS;
    this.opaqueTags = opaqueTags || DEFAULT_OPAQUE;
    this.state = 'NORMAL';
    this.partial = '';
    this.currentTag = '';
    this.currentBuf = '';
    this.optionBuf = '';
    this.events = [];
    this.LIMIT = 64;
  }
  StreamTagParser.prototype.feed = function (chunk) {
    this.events = [];
    for (let i = 0; i < chunk.length; i++) this.consume(chunk[i]);
    return this.events;
  };
  StreamTagParser.prototype.finish = function () {
    this.events = [];
    if (this.state === 'BUFFER_TAG' && this.partial) { this.events.push({ type: 'raw', chunk: '<' + this.partial }); this.partial = ''; }
    if (this.state === 'TAGGED' || this.state === 'OPAQUE') {
      if (this.state === 'TAGGED' && this.currentTag === 'option' && this.optionBuf) { this.events.push({ type: 'option-line', line: this.optionBuf }); this.optionBuf = ''; }
      this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf });
      this.currentBuf = ''; this.currentTag = '';
    }
    this.state = 'NORMAL';
    return this.events;
  };
  StreamTagParser.prototype.consume = function (ch) {
    if (this.state === 'NORMAL') {
      if (ch === '<') { this.state = 'BUFFER_TAG'; this.partial = ''; }
      else this.events.push({ type: 'raw', chunk: ch });
      return;
    }
    if (this.state === 'BUFFER_TAG') {
      if (ch === '>') { this.flushTag(); return; }
      if (this.partial.length >= this.LIMIT) { this.events.push({ type: 'raw', chunk: '<' + this.partial + ch }); this.partial = ''; this.state = 'NORMAL'; return; }
      this.partial += ch;
      return;
    }
    if (this.state === 'OPAQUE') {
      this.currentBuf += ch;
      const close = '</' + this.currentTag + '>';
      if (this.currentBuf.slice(-close.length) === close) {
        this.events.push({ type: 'tag-chunk', tag: this.currentTag, chunk: ch });
        this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf.slice(0, -close.length) });
        this.state = 'NORMAL'; this.currentBuf = ''; this.currentTag = '';
      } else this.events.push({ type: 'tag-chunk', tag: this.currentTag, chunk: ch });
      return;
    }
    if (this.state === 'TAGGED') {
      if (ch === '<') { this.state = 'BUFFER_TAG'; this.partial = ''; return; }
      if (this.currentTag === 'option' && ch === '\n') { this.events.push({ type: 'option-line', line: this.optionBuf }); this.optionBuf = ''; }
      else if (this.currentTag === 'option') this.optionBuf += ch;
      this.currentBuf += ch;
      this.events.push({ type: 'tag-chunk', tag: this.currentTag, chunk: ch });
    }
  };
  StreamTagParser.prototype.flushTag = function () {
    const txt = this.partial; this.partial = '';
    const isClose = txt.charAt(0) === '/';
    const name = (isClose ? txt.slice(1) : txt).trim();
    if (isClose) {
      if (this.currentTag && this.currentTag === name) {
        if (this.currentTag === 'option' && this.optionBuf) { this.events.push({ type: 'option-line', line: this.optionBuf }); this.optionBuf = ''; }
        this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf });
        this.currentBuf = ''; this.currentTag = ''; this.state = 'NORMAL';
      } else {
        this.events.push({ type: 'raw', chunk: '</' + name + '>' });
        this.state = this.currentTag ? this.state : 'NORMAL';
      }
      return;
    }
    if (this.tags.indexOf(name) < 0) { this.events.push({ type: 'raw', chunk: '<' + name + '>' }); this.state = 'NORMAL'; return; }
    this.currentTag = name; this.currentBuf = ''; this.optionBuf = '';
    this.events.push({ type: 'tag-open', tag: name });
    this.state = this.opaqueTags.indexOf(name) >= 0 ? 'OPAQUE' : 'TAGGED';
  };
  function aggregate(events, parsed) {
    parsed = parsed || { thinking: '', maintext: '', options: [], sum: '', varsRaw: '', varsCommands: { merge: {} }, unknown: {} };
    events.forEach(function (ev) {
      if (ev.type === 'tag-close') {
        if (ev.tag === 'thinking' || ev.tag === 'think') parsed.thinking = ev.full;
        else if (ev.tag === 'maintext') parsed.maintext += (parsed.maintext ? '\n' : '') + ev.full;
        else if (ev.tag === 'sum') parsed.sum = ev.full;
        else if (ev.tag === 'vars') { parsed.varsRaw = ev.full; parsed.varsCommands = parseVarsBlock(ev.full); }
        else if (ev.tag !== 'option') parsed.unknown[ev.tag] = ev.full;
      } else if (ev.type === 'option-line') {
        const line = String(ev.line).trim().replace(/^\s*[-*\d]+[.、)）]\s*/, '');
        if (line) parsed.options.push(line);
      }
    });
    return parsed;
  }

  /* ══════════ ④ 提示词组装器 ══════════ */
  function assemblePrompt(opt) {
    const preset = opt.preset || defaultPreset();
    const settings = preset.settings || {};
    const userInput = opt.userInput || '';
    const history = opt.history || [];
    const books = (opt.lorebooks || []).filter(function (b) { return b && b.entries && b.entries.length; });
    const char = opt.character || {};

    /* 世界书扫描：最近 3 条历史 + 本次输入（对齐参考实现） */
    const scanText = userInput + ' ' + history.slice(-3).map(function (m) { return m.content || ''; }).join(' ');
    const matched = [];
    books.forEach(function (book) {
      createLorebookEngine(book).recursiveScan(scanText, 3).forEach(function (h) { matched.push(h); });
    });
    const uniq = {};
    matched.forEach(function (h) { const id = h.entry.bookId + '/' + h.entry.id; if (!uniq[id]) uniq[id] = h; });
    const entries = Object.keys(uniq).map(function (k) { return uniq[k]; }).sort(function (a, b) { return a.score - b.score; });
    const before = entries.filter(function (e) { return e.entry.position === 'before_char' || e.entry.position === 'before_example'; });
    const after = entries.filter(function (e) { return e.entry.position !== 'before_char' && e.entry.position !== 'before_example'; });

    /* 预算裁剪（默认 4096 上下文，占用 80%） */
    const maxCtx = settings.openai_max_context || settings.max_length || 4096;
    let used = 0;
    const recent = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (m.role === 'system') continue;
      const tk = estimateTokens(m.content);
      if (used + tk > maxCtx * 0.8) break;
      recent.unshift(m); used += tk;
    }

    const order = (settings.prompt_order || DEFAULT_PROMPT_ORDER).filter(function (p) { return p.enabled !== false; });
    const macroCtx = { userName: opt.userName || '玩家', characterName: char.name || '联盟主持', userInput: userInput, variables: opt.variables || {} };

    function resolve(id) {
      if (id === 'worldInfoBefore') return before.map(function (e) { return e.entry.content; }).join('\n\n') || null;
      if (id === 'worldInfoAfter') return after.map(function (e) { return e.entry.content; }).join('\n\n') || null;
      if (id === 'charDescription') return char.description || null;
      if (id === 'charPersonality') return char.personality || null;
      if (id === 'scenario') return char.scenario || settings.scenario || null;
      if (id === 'personaDescription') return char.persona || settings.persona_description || null;
      if (id === 'dialogueExamples') return char.mes_example || null;
      if (id === 'main') return settings.main || null;
      if (id === 'jailbreak') return settings.jailbreak || char.post_history_instructions || null;
      const custom = (settings.prompts || []).filter(function (p) { return p.identifier === id; })[0];
      if (custom && custom.content) return custom.content;
      const direct = settings[id];
      return typeof direct === 'string' && direct.trim() ? direct : null;
    }

    const messages = [];
    const blocks = [];   /* 上下文检视器用：逐块明细 */
    let sys = '';
    function pushBlock(identifier, name, content, kind) {
      blocks.push({ identifier: identifier, name: name, kind: kind, tokens: estimateTokens(content), content: content });
    }
    order.forEach(function (item) {
      if (item.identifier === 'chatHistory') {
        if (sys) { messages.push({ role: 'system', content: sys }); sys = ''; }
        recent.forEach(function (m) { messages.push({ role: m.role, content: m.content }); });
        pushBlock('chatHistory', '对话历史', recent.map(function (m) { return (m.role === 'user' ? '玩家：' : '主持：') + m.content; }).join('\n'), 'history');
        return;
      }
      const raw = resolve(item.identifier);
      if (!raw) return;
      const content = replaceMacros(raw, macroCtx);
      if (!content.trim()) return;
      pushBlock(item.identifier, item.name || item.identifier, content, 'prompt');
      if ((item.role || 'system') === 'system') sys += (sys ? '\n\n' : '') + content;
      else { if (sys) { messages.push({ role: 'system', content: sys }); sys = ''; } messages.push({ role: item.role, content: content }); }
    });

    const varBlock = formatVariablesForPrompt(opt.variables || {});
    if (varBlock) { sys += (sys ? '\n\n' : '') + varBlock; pushBlock('variables', '变量快照', varBlock, 'vars'); }
    const format = opt.formatPrompt === undefined ? DEFAULT_FORMAT_PROMPT : opt.formatPrompt;
    if (format) { sys += (sys ? '\n\n' : '') + format; pushBlock('formatPrompt', '输出格式约定', format, 'format'); }
    if (sys) messages.unshift({ role: 'system', content: sys });
    messages.push({ role: 'user', content: userInput });

    return {
      messages: messages, matchedEntries: entries, blocks: blocks,
      totalTokens: messages.reduce(function (a, m) { return a + estimateTokens(m.content); }, 0),
      budget: maxCtx, beforeCount: before.length, afterCount: after.length
    };
  }

  /* ══════════ 默认预设 ══════════ */
  function defaultPreset() {
    return {
      id: 'preset-local', name: '本地推演默认预设', description: 'SillyTavern 兼容字段（temp_openai / prompt_order / prompts…）',
      settings: {
        temp_openai: 0.95, top_p_openai: 0.95, top_k_openai: 0, freq_pen_openai: 0, pres_pen_openai: 0.3,
        openai_max_context: 4096, openai_max_tokens: 1024, stream_openai: true,
        chat_completion_source: 'local-engine', openai_model: 'apex-corridor-local',
        main: '你是《无畏契约》职业选手人生模拟器的「联盟主持」。玩家扮演 {{user}}，你是整个职业圈的裁决者与旁白。' +
          '必须遵守随附规则书：属性与总评按位置加权计算；一切判定掷骰并公开修正明细；NPC 出现在其合理位置；选手以比赛 ID 出现。' +
          '每次回复推进剧情并输出面板变化。',
        jailbreak: '记住：不作弊，不替玩家做选择，不虚构现实选手的私生活。「高自由 · 快节奏 · 永不作弊」。',
        style: (D.STORY_STYLE || []).join('\n'),
        option_rules: (D.OPTION_RULES || []).join('\n'),
        prompts: [], prompt_order: DEFAULT_PROMPT_ORDER.map(function (p) { return Object.assign({ enabled: true }, p); })
      }
    };
  }

  /* ══════════ ⑤ 会话状态：角色卡 / 世界书 / 预设 / 楼层 ══════════ */
  let S = null;                       /* 指向游戏状态 */
  let db = null;                      /* 酒馆数据（角色卡 + 世界书 + 预设 + 楼层） */
  let uiMode = 'narrative';           /* 'narrative' | 'tavern' */
  let lastContext = null;             /* 最近一次组装结果（上下文检视器） */
  let capture = null;                 /* 本轮捕获 */
  let streaming = false;
  let pollTimer = null;

  function blankDb() {
    return {
      v: 1,
      card: {
        name: '联盟主持', creator: '巅峰回廊原型', character_version: '2.3',
        description: '《无畏契约》职业选手人生模拟器的联盟主持：掌管全部设定、数值、随机、裁决与叙事。',
        personality: '冷静、克制、不作弊；对玩家的每一次抉择给出可追溯的判定与后果。',
        scenario: '现实 VCT 职业圈：四大赛区、12 支联赛队伍、13 张竞技地图、29 名特工。',
        first_mes: '「欢迎来到巅峰回廊。从今天开始，你的每一场比赛、每一次抉择都会被记录。」',
        mes_example: '{{user}}：我要在训练赛里试一套新战术。\n{{char}}：可以。但你得先说服教练——判定：沟通 成功线 13。',
        creator_notes: '角色卡字段遵循 Character Card V2 规范，可导出为 SillyTavern 兼容 JSON / PNG 角色卡。',
        system_prompt: '', post_history_instructions: '',
        alternate_greetings: [], tags: ['电竞', '模拟经营', '无畏契约', 'VCT'],
        character_book: null, extensions: {}
      },
      books: [], presets: [], activeBookIds: [], activePresetId: 'preset-local',
      settings: {
        tags: DEFAULT_TAGS.slice(), opaqueTags: DEFAULT_OPAQUE.slice(),
        formatPrompt: DEFAULT_FORMAT_PROMPT, thinkingDisplay: 'fold',
        streamSpeed: 12, autoScroll: true, lorebookScanDepth: 3, useSecondary: true, showVarsChips: true
      },
      floors: [], sessions: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      db = raw ? JSON.parse(raw) : blankDb();
    } catch (e) { db = blankDb(); }
    if (!db.books || !db.books.length) seedFromGame();
    if (!db.presets || !db.presets.length) db.presets = [defaultPreset()];
    if (!db.card) db.card = blankDb().card;
    return db;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
  }

  /* 从游戏数据自动生成四本世界书（条目即设定库） */
  function seedFromGame() {
    const books = [];
    /* ① 俱乐部资料（附录Q） */
    const clubBook = { id: 'book-clubs', name: 'VCT 俱乐部资料（附录Q）', description: '46 支联赛队伍：席位、城市、风格、2024—2026 逐年阵容、荣誉', recursiveScanning: false, caseSensitive: false, matchWholeWords: false, createdAt: Date.now(), updatedAt: Date.now(), entries: [] };
    D.CLUBS.forEach(function (c, i) {
      clubBook.entries.push(makeEntry({
        bookId: clubBook.id, keys: [c.name, c.short, c.city].filter(Boolean), content:
          '【' + c.name + '（' + c.short + '）】' + c.region + ' 赛区 · ' + c.city + ' · ' + c.tier + ' · ' + c.seat + '。\n风格：' + c.style +
          '\n2024 阵容：' + (((c.rosters || {})['2024']) || c.roster || []).join('、') +
          '\n2025 阵容：' + (((c.rosters || {})['2025']) || c.roster || []).join('、') +
          '\n2026 阵容：' + (((c.rosters || {})['2026']) || c.roster || []).join('、') +
          '\n荣誉：' + (c.honors || '—') + '\n剧情线：' + (c.line || '—'), order: i + 10
      }));
    });
    books.push(clubBook);

    /* ② 特工与地图（第35章 / 9.1） */
    const agentBook = { id: 'book-agents', name: '特工 · 地图 · 武器（第35章）', description: '29 名特工按四定位划分；13 张竞技地图；武器与护甲经济', recursiveScanning: false, caseSensitive: false, matchWholeWords: false, createdAt: Date.now(), updatedAt: Date.now(), entries: [] };
    Object.keys(D.AGENTS).forEach(function (role, i) {
      agentBook.entries.push(makeEntry({
        bookId: agentBook.id, keys: D.AGENTS[role].concat([role]), content:
          '【' + role + '】可选特工：' + D.AGENTS[role].join('、') + '\n定位说明：' + (D.POSITIONS.filter(function (p) { return p.name === role; })[0] || {}).desc, order: i + 10
      }));
    });
    D.MAPS.forEach(function (m, i) {
      agentBook.entries.push(makeEntry({ bookId: agentBook.id, keys: [m], content: '【竞技地图 · ' + m + '】13 张正式地图之一。攻防双方围绕 A/B 点与中路展开；经济局与强起的节奏差异在这张图上体现明显。', order: 60 + i, probability: 100 }));
    });
    agentBook.entries.push(makeEntry({
      bookId: agentBook.id, keys: ['经济', '购买', '经济局', '强起', '满配', '保枪'], content:
        '【购买与经济】手枪局 800 起手；经济局（<2200）保存经济；半起（<3400）；强起（<4400）；满配（≥4400）。' +
        '武器参考价：标配 0 / 鬼魅 500 / 追猎 800 / 正义 800 / 骇灵 1000 / 蜂刺 1100 / 判官 1500 / 戍卫 2250 / 飞将 2400 / 幻影 2900 / 狂徒 2900 / 奥丁 3200 / 战神 5500 / 冥驹 9500。', order: 90
    }));
    agentBook.entries.push(makeEntry({
      bookId: agentBook.id, keys: ['赛制', '13 分', '加时', 'BP', '禁用', '回合'], content:
        '【VCT 赛制】24 回合制，先到 13 分取胜；第 12 回合交换攻防；12:12 进入加时（净胜两回合）。' +
        'BP：每队禁 2 张图、禁 2 名特工，再交替选出 5 名特工。单局胜负：1d20 ＋ 队伍战力差修正 ≥ 10 获胜。', order: 95
    }));
    books.push(agentBook);

    /* ③ 人物档案（第25章 + 传奇选手库） */
    const npcBook = { id: 'book-npcs', name: '人物档案（第25章）', description: '教练组 / 分析师 / 医疗 / 管理 / 媒体 / 宿敌 / 情缘候选 / 传奇选手', recursiveScanning: false, caseSensitive: false, matchWholeWords: false, createdAt: Date.now(), updatedAt: Date.now(), entries: [] };
    let o = 10;
    Object.keys(D.NPCS).forEach(function (group) {
      D.NPCS[group].forEach(function (n) {
        npcBook.entries.push(makeEntry({ bookId: npcBook.id, keys: [n.name, n.tag].filter(Boolean), content: '【' + n.name + '】' + n.role + ' · ' + (n.trait || '') + '\n' + n.persona, order: o++ }));
      });
    });
    D.LEGENDS.forEach(function (l) {
      npcBook.entries.push(makeEntry({
        bookId: npcBook.id, keys: [l.name, l.short.split(' · ')[0], l.id], order: o++,
        content: '【' + l.name + '（' + l.short + '）】' + l.role + ' · 巅峰总评 ' + l.peak + '\n荣誉：' + l.honor + '\n本命：' + l.agent + '\n人物：' + l.desc + '\n标签：' + l.tags.join(' · ') + '\n随身之物：' + l.item
      }));
    });
    D.TEAMMATE_POOL.forEach(function (t) {
      npcBook.entries.push(makeEntry({ bookId: npcBook.id, keys: [t.name, t.tag], content: '【' + t.name + '】' + t.role + '（队友）\n' + t.persona, order: o++ }));
    });
    books.push(npcBook);

    /* ④ 规则与判定（第7章 / 附录X / 附录V） */
    const ruleBook = { id: 'book-rules', name: '规则与判定速查', description: '总评公式 / 骰子判定 / 突破检定 / 训练 / 伤病 / 身价', recursiveScanning: false, caseSensitive: false, matchWholeWords: false, createdAt: Date.now(), updatedAt: Date.now(), entries: [] };
    D.POSITIONS.forEach(function (p, i) {
      ruleBook.entries.push(makeEntry({
        bookId: ruleBook.id, keys: [p.name, p.short], order: 10 + i,
        content: '【' + p.name + '计算】总评 = ' + Object.keys(p.weights).map(function (k) {
          const a = D.ATTRS.filter(function (x) { return x.k === k; })[0];
          return a.name + '×' + Math.round(p.weights[k] * 100) + '%';
        }).join(' ＋ ') + ' ＋ 关键属性加成 － 短板惩罚。关键属性：' + p.key.map(function (k) { return D.ATTRS.filter(function (x) { return x.k === k; })[0].name; }).join('、') +
          '（双项 ≥85 +2 / ≥90 +3 / ≥95 +5；任一 <50 −1 / <40 −2 / <30 −3）。'
      }));
    });
    ruleBook.entries.push(makeEntry({ bookId: ruleBook.id, keys: ['总评', 'OVR', '等级', '明星', '传奇'], order: 30, content: '【总评等级】0—59 业余 ｜ 60—69 半职业 ｜ 70—79 职业 ｜ 80—89 明星 ｜ 90—99 传奇。总评按主位置加权，属性不变则总评不变；面板数字必须与公式一致。' }));
    ruleBook.entries.push(makeEntry({ bookId: ruleBook.id, keys: ['对枪', '判定', '骰子', '成功线', '爆头'], order: 31, content: '【判定】对枪 = 1d20 ＋ 枪法÷10 ＋ 反应÷10 ＋ 身法÷10 ＋ 状态修正 ＋ 装备修正 ＋ 先手(±5) − 对手防御；命中线 12—15 躯干 / 16—19 头部 / 20 完美爆头 / 1 大失误。其他判定 = 1d20 ＋ 属性÷10 ＋ 情境修正 ≥ 成功线。' }));
    ruleBook.entries.push(makeEntry({ bookId: ruleBook.id, keys: ['突破', '突破检定', '晋级'], order: 32, content: '【突破检定】成功率 = 40 ＋ 关键属性均值×0.3 ＋ 心态×0.15 ＋ 状态修正 ＋ 版本红利 ＋ 难度修正（天选 +30 / 简单 +10 / 困难 −20 / 地狱 −40）；掷 1d100 ≤ 成功率即成功。' }));
    ruleBook.entries.push(makeEntry({ bookId: ruleBook.id, keys: ['训练', '收益', '疲劳', '悟性'], order: 33, content: '【训练】收益 = 基础值 5 ＋ 悟性×0.3 ＋ 状态×0.1 ＋ 环境系数（网吧 0.8 / 自租房 1.0 / 基地 1.15 / 顶级 1.25）× 难度系数 ± 1d6。连续 5 回合触发疲劳预警，8 回合伤病检定概率翻倍。' }));
    ruleBook.entries.push(makeEntry({ bookId: ruleBook.id, keys: ['伤病', '手腕', '手术', '康复'], order: 34, content: '【伤病】轻伤 3—5 回合 ｜ 中伤 10—20 回合 ｜ 重伤 30+ 回合。部位：手腕 / 手肘 / 腰 / 颈椎 / 眼睛 / 心理。俱乐部理疗 +50% 恢复，专业康复中心 +100%，硬扛 −30% 且恶化风险翻倍。' }));
    ruleBook.entries.push(makeEntry({ bookId: ruleBook.id, keys: ['身价', '转会', '合同', '违约金'], order: 35, content: '【身价】身价 = 总评系数 × 人气系数 × 年龄系数 × 荣誉系数 × 合同剩余系数。总评系数：业余 0.5 万 / 半职业 2 万 / 职业 5 万 / 明星 30 万 / 传奇 200 万。' }));
    books.push(ruleBook);

    db.books = books;
    db.activeBookIds = books.map(function (b) { return b.id; });
  }

  function makeEntry(o) {
    return {
      id: uid('lb'), keys: o.keys || [], secondaryKeys: o.secondaryKeys || [], content: o.content || '',
      comment: o.comment || (o.keys && o.keys[0]) || '', order: o.order === undefined ? 100 : o.order,
      position: o.position || 'before_char', depth: o.depth || 4, role: 0,
      selective: !!o.selective, selectiveLogic: o.selectiveLogic || 'and_any',
      constant: !!o.constant, probability: o.probability === undefined ? 100 : o.probability,
      useProbability: o.useProbability !== false, disable: !!o.disable,
      scanDepth: o.scanDepth || (db && db.settings ? db.settings.lorebookScanDepth : 4), bookId: o.bookId
    };
  }

  /* ══════════ 变量投影：游戏状态 ⇄ 酒馆变量 ══════════ */
  function projectVars() {
    const v = {};
    v['玩家'] = S.profile.name + '（' + S.profile.tag + '）';
    v['位置'] = ES.state.positionOf(S).name;
    v['总评'] = ES.state.ovr(S);
    v['等级'] = ES.state.level(ES.state.ovr(S)).name;
    v['俱乐部'] = S.club ? S.club.short : '无';
    v['赛区'] = S.club ? S.club.region : '—';
    v['金钱'] = Math.round(S.res.money);
    v['粉丝'] = S.res.fans;
    v['竞技状态'] = Math.round(S.res.condition);
    v['手部健康'] = Math.round(S.res.hand);
    v['伤病风险'] = Math.round(S.res.injury);
    v['名声'] = Math.round(S.special.fame);
    v['舆论热度'] = Math.round(S.special.heat);
    v['教练信任'] = Math.round(S.special.coachTrust);
    v['队友信任'] = Math.round(S.special.teammateTrust);
    v['身价'] = ES.state.marketValue(S);
    D.ATTRS.forEach(function (a) { v['属性.' + a.name] = Math.round(S.attrs[a.k]); });
    return v;
  }
  function applyProjectedVars(patch) {
    /* 把 <vars> 补丁投影回游戏状态（属性.枪法 / 状态.竞技状态 / 资源.* 形式） */
    const attrs = {}, res = {}, special = {}, money = {};
    Object.keys(patch || {}).forEach(function (k) {
      const v = patch[k];
      if (typeof v !== 'number') return;
      if (k.indexOf('属性.') === 0) {
        const name = k.slice(3);
        const a = D.ATTRS.filter(function (x) { return x.name === name; })[0];
        if (a) attrs[a.k] = v;
      } else if (k.indexOf('状态.') === 0) {
        const map = { '竞技状态': 'condition', '手部健康': 'hand', '伤病风险': 'injury' };
        const key = map[k.slice(3)];
        if (key) res[key] = v;
      } else if (k.indexOf('资源.') === 0) {
        const map = { '金钱': 'money', '粉丝': 'fans' };
        const key = map[k.slice(3)];
        if (key === 'money') money[k.slice(3)] = v;
        else if (key) res[key] = v;
      } else if (k.indexOf('关系.') === 0) {
        const target = S.relations.filter(function (r) { return r.name === k.slice(3); })[0];
        if (target) { target.affection = U.clamp(target.affection + v, 0, 100); }
      } else if (k === '金钱') res.money = v;
      else if (k === '声望' || k === '名声') special.fame = v;
      else if (k === '舆论热度') special.heat = v;
    });
    if (Object.keys(attrs).length || Object.keys(res).length || Object.keys(special).length) {
      ES.state.apply(S, { attrs: attrs, res: res, special: special, money: money['金钱'] || 0 }, { silent: true });
    }
  }

  /* ══════════ 快照与回滚 ══════════ */
  function snapshot() {
    return {
      attrs: clone(S.attrs), res: clone(S.res), special: clone(S.special),
      relations: S.relations.map(function (r) { return { id: r.id, affection: r.affection, trust: r.trust }; }),
      money: S.res.money, fans: S.res.fans, turn: S.time.turn, level: ES.state.level(ES.state.ovr(S)).name,
      ovr: ES.state.ovr(S), honor: S.stats.honorList.slice(), statuses: clone(S.statuses)
    };
  }
  function restore(snap) {
    if (!snap) return;
    S.attrs = clone(snap.attrs); S.res = clone(snap.res); S.special = clone(snap.special);
    S.statuses = clone(snap.statuses || []);
    (snap.relations || []).forEach(function (r) {
      const t = S.relations.filter(function (x) { return x.id === r.id; })[0];
      if (t) { t.affection = r.affection; t.trust = r.trust; }
    });
    S.stats.honorList = (snap.honor || []).slice();
    ES.app.refreshUI();
  }

  /* ══════════ 桥接：本地引擎 → 标签文本 ══════════ */
  function captureBlocks(blocks) {
    if (!capture) return;
    (blocks || []).forEach(function (b) { capture.blocks.push(b); });
  }
  function captureDeltas(deltas) {
    if (!capture) return;
    (deltas || []).forEach(function (d) { capture.deltas.push(d); });
  }
  function captureDice(res) {
    if (!capture) return;
    capture.dice.push(res);
  }

  function blocksToMaintext(blocks) {
    const out = [];
    (blocks || []).forEach(function (b) {
      const text = String(b.text || '').replace(/<[^>]+>/g, '').trim();
      if (!text) return;
      if (b.t === 'speak') out.push('「' + text + '」　—— ' + (b.who || ''));
      else if (b.t === 'broadcast') out.push('【直播】' + text);
      else if (b.t === 'chapter') out.push('—— ' + text + ' ——');
      else if (b.t === 'sys') out.push('【系统】' + text);
      else out.push(text);
    });
    return out.join('\n\n');
  }
  function deltasToVars(deltas) {
    const patch = {};
    (deltas || []).forEach(function (d) {
      if (!d.delta) return;
      if (d.kind === 'attr') patch['属性.' + d.label] = d.delta;
      else if (d.kind === 'res') {
        const map = { condition: '竞技状态', hand: '手部健康', injury: '伤病风险', fans: '粉丝' };
        patch['状态.' + (map[d.k] || d.k)] = d.delta;
      } else if (d.kind === 'money') patch['金钱'] = d.delta;
      else if (d.kind === 'rel') patch['关系.' + d.label] = d.delta;
      else if (d.kind === 'special') patch['声望'] = d.delta;
    });
    return patch;
  }
  function thinkingTrace() {
    if (!capture) return '';
    const lines = [];
    capture.dice.forEach(function (r) {
      lines.push('判定：' + (r.tag || r.attrName) + ' ｜ ' + (r.dice === 100 ? '1d100=' + r.roll + ' / 成功率 ' + r.dc + '%' : '1d20=' + r.roll + ' ' +
        (r.terms || []).map(function (t) { return (t.v > 0 ? '+' : '') + t.v + '(' + t.label + ')'; }).join('') + ' = ' + Math.round(r.total) + ' vs 成功线 ' + r.dc) + ' → ' + r.label);
    });
    if (lastContext) {
      lines.push('世界书触发 ' + lastContext.matchedEntries.length + ' 条 ｜ 上下文 ' + lastContext.totalTokens + ' / ' + lastContext.budget + ' tokens');
    }
    const st = S.club ? '俱乐部 ' + S.club.name + '（' + S.club.tier + '）· 联赛第 ' + S.club.rank + ' 位' : '无俱乐部';
    lines.push(st + ' ｜ 总评 ' + ES.state.ovr(S) + '（' + ES.state.level(ES.state.ovr(S)).name + '）');
    return lines.join('\n');
  }

  /* ══════════ 楼层操作 ══════════ */
  function currentPreset() {
    return db.presets.filter(function (p) { return p.id === db.activePresetId; })[0] || db.presets[0];
  }
  function activeBooks() {
    return db.books.filter(function (b) { return db.activeBookIds.indexOf(b.id) >= 0; });
  }
  function charCard() {
    const c = db.card;
    return Object.assign({}, c, {
      persona: '玩家：' + S.profile.name + '（' + S.profile.tag + '）· ' + ES.state.positionOf(S).name + ' · ' + S.profile.age + ' 岁 · ' +
        (S.club ? S.club.name + '（' + S.club.region + '）' : '无俱乐部') + ' · 难度 ' + S.difficultyName +
        ' · 出身 ' + (D.ORIGINS.filter(function (o) { return o.id === S.origin; })[0] || {}).name +
        ' · 性格 ' + S.profile.traits.map(function (t) { return (D.TRAITS.filter(function (x) { return x.id === t; })[0] || {}).name; }).join('、')
    });
  }
  function buildContext(userInput) {
    const history = db.floors.map(function (f) { return { role: f.role, content: f.role === 'user' ? f.content : (f.parsed ? f.parsed.maintext : f.content) }; });
    lastContext = assemblePrompt({
      userInput: userInput, history: history, preset: currentPreset(), lorebooks: activeBooks(),
      userName: S.profile.name, characterName: db.card.name, character: charCard(),
      variables: projectVars(), formatPrompt: db.settings.formatPrompt
    });
    lastContext.scanDepth = db.settings.lorebookScanDepth;
    if (lastContext.matchedEntries.length) {
      lastContext.matchedEntries.forEach(function (m) { m.entry.lastHit = S.time.turn; });
    }
    return lastContext;
  }

  /** 生成一条 AI 回复：优先真实 API，未启用或失败时回退本地引擎 */
  function generate(text, opts) {
    opts = opts || {};
    capture = { blocks: [], deltas: [], dice: [] };
    buildContext(text);
    const floor = {
      id: uid('fl'), role: 'assistant', content: '', streaming: true,
      createdAt: Date.now(), tokens: 0, options: [], parsed: null, variablesAfter: null,
      meta: {
        lorebookEntries: lastContext.matchedEntries.map(function (m) { return m.entry.comment; }),
        promptTokens: lastContext.totalTokens, api: ES.api && ES.api.isEnabled() ? ES.api.mode() : 'local'
      }
    };
    db.floors.push(floor);
    renderFloors();

    if (ES.api && ES.api.isEnabled() && ES.narrative && ES.narrative.aiTurn) {
      /* 统一引擎：一颗大脑、一份历史、一套选项（叙事模式与酒馆模式看到的是同一条剧情） */
      streaming = true;
      floor.meta.model = ES.api.config().primary.model;
      const beforeOvr = ES.state.ovr(S);
      return ES.narrative.aiTurn(text, { fromTavern: true }).then(function () {
        streaming = false;
        finishFloor(floor, beforeOvr, text, opts);
      }).catch(function () { streaming = false; finishFloor(floor, beforeOvr, text, opts); });
    }
    return generateViaLocal(floor, text, opts);
  }

  /* ── 通道 A：真实 API（主 API 跑剧情，次 API 跑 <sum>/<vars>） ── */
  /* 旧通道保留为薄封装：统一委托叙事层引擎（历史/选项/变量单点） */
  /* 统一引擎：酒馆层不再自己调 API，全部委托叙事层（同一历史 / 同一选项 / 同一变量） */
  function generateViaApi(floor, text, opts) {
    const beforeOvr = ES.state.ovr(S);
    streaming = true;
    floor.meta.model = ES.api.config().primary.model;
    return ES.narrative.aiTurn(text, { fromTavern: true }).then(function () {
      streaming = false;
      finishFloor(floor, beforeOvr, text, opts);
    }).catch(function (e) {
      streaming = false;
      console.warn(e);
      finishFloor(floor, beforeOvr, text, opts);
    });
  }
  function finishApiFloor(floor) {
    const applied = ES.state.applyStoryVars
      ? ES.state.applyStoryVars(S, floor.parsed.varsCommands.merge)
      : (applyProjectedVars(floor.parsed.varsCommands.merge), null);
    if (applied && applied.notes && applied.notes.length) floor.meta.applied = applied.notes;
    if (applied && applied.advanced > 0) {
      U.toast({ tone: 'info', icon: 'calendar', title: '剧情推进了 ' + applied.advanced + ' 天', msg: applied.from.month + ' 月 ' + applied.from.day + ' 日 → ' + applied.to.month + ' 月 ' + applied.to.day + ' 日 · ' + S.time.phase, duration: 6000 });
    }
    floor.variablesAfter = snapshot();
    floor.options = floor.parsed.options || [];
    /* 把模型给出的选项交给叙事层，酒馆侧栏与主界面都能点 */
    if (ES.narrative.setChoices) ES.narrative.setChoices(floor.options);
    floor.meta.ovr = ES.state.ovr(S);
    streaming = false;
    save();
    renderFloors();
    if (ES.app.refreshUI) ES.app.refreshUI();
    renderAside();
  }

  /* ── 通道 B：本地叙事引擎（离线可用，行为与之前一致） ── */
  function generateViaLocal(floor, text, opts) {
    const before = ES.state.ovr(S);
    if (opts.choiceIndex !== undefined && opts.choiceIndex !== null) ES.narrative.choose(opts.choiceIndex);
    else if (opts.continueOnly) { /* 继续：不推进回合，只续写已捕获内容 */ }
    else ES.narrative.freeAction(text);

    const started = Date.now();
    const wait = setInterval(function () {
      const busy = ES.narrative.busyNow ? ES.narrative.busyNow() : false;
      if (busy && Date.now() - started < 40000) return;
      clearInterval(wait);
      finishFloor(floor, before, text, opts);
    }, 140);
  }

  function finishFloor(floor, beforeOvr, text, opts) {
    const ctx = lastContext || { matchedEntries: [] };
    const maintext = blocksToMaintext(capture.blocks) || '（本回合没有产生新的叙事文本）';
    /* 选项统一来自叙事层（模型生成或兜底），酒馆侧栏与主界面共用 */
    if (ES.narrative.setChoices && floor.parsed && (floor.parsed.options || []).length) {
      ES.narrative.setChoices(floor.parsed.options);
    }
    const choices = ES.narrative.currentChoices ? ES.narrative.currentChoices() : [];
    const varsPatch = deltasToVars(capture.deltas);
    const after = ES.state.ovr(S);
    const sum = (maintext.split('\n')[0] || '').slice(0, 60) + (after !== beforeOvr ? '（总评 ' + beforeOvr + ' → ' + after + '）' : '');

    const payload =
      '<thinking>' + thinkingTrace() + '</thinking>\n' +
      '<maintext>' + maintext + '</maintext>\n' +
      '<option>' + choices.map(function (c) { return c.label; }).join('\n') + '</option>\n' +
      '<sum>' + sum + '</sum>\n' +
      '<vars>' + JSON.stringify(varsPatch, null, 0) + '</vars>';

    streamInto(floor, payload, function () {
      floor.streaming = false;
      floor.variablesAfter = snapshot();
      floor.options = (floor.parsed && floor.parsed.options) || [];
      floor.meta.ovr = after;
      floor.content = payload;
      floor.tokens = ES.tavern.estimateTokens(payload);
      save();
      renderFloors();
      if (ES.app.refreshUI) ES.app.refreshUI();
      renderAside();
    });
  }

  /** 流式解析：把标签文本按块喂给解析器，实时更新楼层 */
  function streamInto(floor, payload, done) {
    streaming = true;
    const parser = new StreamTagParser(db.settings.tags, db.settings.opaqueTags);
    floor.parsed = { thinking: '', maintext: '', options: [], sum: '', varsRaw: '', varsCommands: { merge: {} }, unknown: {} };
    let i = 0;
    const step = Math.max(1, Math.round(db.settings.streamSpeed / 3));
    function tick() {
      if (i >= payload.length) {
        aggregate(parser.finish(), floor.parsed);
        streaming = false;
        applyProjectedVars(floor.parsed.varsCommands.merge);
        if (done) done();
        return;
      }
      const chunk = payload.slice(i, i + step);
      i += step;
      const evs = parser.feed(chunk);
      aggregate(evs, floor.parsed);
      renderFloorsLive(floor);
      setTimeout(tick, 16);
    }
    tick();
  }

  /* ══════════ 楼层操作对外入口 ══════════ */
  function send(text) {
    if (streaming || !S) return;
    const t = String(text || '').trim();
    if (!t) return;
    db.floors.push({ id: uid('fl'), role: 'user', content: t, createdAt: Date.now(), tokens: ES.tavern.estimateTokens(t) });
    save();
    renderFloors();
    generate(t, {});
  }
  function chooseOption(i) {
    if (streaming) return;
    const label = (ES.narrative.currentChoices() || [])[i];
    if (!label) return;
    db.floors.push({ id: uid('fl'), role: 'user', content: '（选择）' + label.label, createdAt: Date.now(), choiceIndex: i, tokens: 0 });
    save(); renderFloors();
    generate(label.label, { choiceIndex: i });
  }
  function regenerate(floorId) {
    if (streaming) return;
    const idx = db.floors.map(function (f) { return f.id; }).indexOf(floorId);
    if (idx < 0) return;
    /* 找到该 assistant 楼层之前的用户输入 */
    let userIdx = idx - 1;
    while (userIdx >= 0 && db.floors[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return;
    const user = db.floors[userIdx];
    const snap = db.floors[userIdx - 1] ? db.floors[userIdx - 1].variablesAfter : null;
    restore(snap);
    db.floors = db.floors.slice(0, idx);
    save(); renderFloors();
    generate(user.content.replace(/^（选择）/, ''), { choiceIndex: user.choiceIndex });
  }
  function continueFloor() {
    if (streaming) return;
    db.floors.push({ id: uid('fl'), role: 'user', content: '（继续）请继续推进剧情', createdAt: Date.now(), tokens: 0 });
    renderFloors();
    generate('（继续）', { continueOnly: true });
  }
  function editFloor(floorId, content) {
    const f = db.floors.filter(function (x) { return x.id === floorId; })[0];
    if (!f) return;
    f.content = content;
    if (f.role === 'assistant') { f.parsed = null; }
    save(); renderFloors();
  }
  function deleteFloor(floorId) {
    db.floors = db.floors.filter(function (f) { return f.id !== floorId; });
    save(); renderFloors(); renderAside();
  }
  function rollbackTo(floorId) {
    const idx = db.floors.map(function (f) { return f.id; }).indexOf(floorId);
    if (idx < 0) return;
    const snap = db.floors[idx].variablesAfter;
    restore(snap);
    db.floors = db.floors.slice(0, idx + 1);
    save(); renderFloors();
    U.toast({ tone: 'info', icon: 'refresh', title: '已回滚到该楼层', msg: '变量快照已恢复（属性 / 资源 / 关系 / 状态）。' });
  }
  function branchAt(floorId) {
    const idx = db.floors.map(function (f) { return f.id; }).indexOf(floorId);
    if (idx < 0) return;
    const branch = clone(db.floors.slice(0, idx + 1));
    db.sessions = db.sessions || [];
    db.sessions.push({ id: uid('ses'), name: '分支 · ' + (S.time.turn) + ' 回合', floors: clone(db.floors), createdAt: Date.now() });
    U.toast({ tone: 'gold', icon: 'layers', title: '已创建分支会话', msg: '当前会话已存档，可继续沿新分支推进。' });
    db.floors = branch; save(); renderFloors();
  }
  function resignSession(id) {
    const s = (db.sessions || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    db.sessions = db.sessions.map(function (x) { return x.id === id ? { id: x.id, name: x.name + '（备份）', floors: clone(db.floors), createdAt: x.createdAt } : x; });
    db.floors = clone(s.floors);
    save(); renderFloors();
    U.toast({ tone: 'info', title: '已切换到分支', msg: s.name });
  }
  function clearFloors() {
    U.confirmDialog({
      title: '清空全部楼层？', tone: 'red', okText: '清空',
      body: '将删除当前会话的全部楼层记录（不影响游戏存档与变量）。',
      onOk: function () { db.floors = []; save(); renderFloors(); renderAside(); }
    });
  }

  /* ══════════ 导入 / 导出（SillyTavern 兼容） ══════════ */
  function exportCardJson() {
    return JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data: db.card }, null, 2);
  }
  function importCardJson(text) {
    const obj = JSON.parse(text);
    const data = obj.data || obj;
    db.card = Object.assign(blankDb().card, {
      name: data.name || '联盟主持', description: data.description || '', personality: data.personality || '',
      scenario: data.scenario || '', first_mes: data.first_mes || '', mes_example: data.mes_example || '',
      creator_notes: data.creator_notes || '', system_prompt: data.system_prompt || '',
      post_history_instructions: data.post_history_instructions || '',
      alternate_greetings: data.alternate_greetings || [], tags: data.tags || [],
      creator: data.creator || '导入', character_version: data.character_version || '—',
      character_book: data.character_book || null
    });
    if (db.card.character_book && db.card.character_book.entries) convertEmbeddedBook();
    save(); renderAll();
    U.toast({ tone: 'success', icon: 'id', title: '角色卡已导入', msg: db.card.name });
  }
  function convertEmbeddedBook() {
    const b = db.card.character_book;
    db.books.push({
      id: uid('book'), name: (b.name || '内嵌世界书'), description: '来自角色卡 character_book',
      recursiveScanning: !!(b.extensions && b.extensions.recursive_scanning), caseSensitive: false, matchWholeWords: false,
      createdAt: Date.now(), updatedAt: Date.now(),
      entries: (b.entries || []).map(function (e) { return makeEntry({ keys: e.keys || [], content: e.content || '', order: e.insertion_order || 100 }); })
    });
  }
  function exportLorebook(bookId) {
    const b = db.books.filter(function (x) { return x.id === bookId; })[0];
    if (!b) return '';
    const entries = {};
    b.entries.forEach(function (e, i) {
      entries[String(i)] = {
        uid: i, key: e.keys, keysecondary: e.secondaryKeys || [], comment: e.comment || '', content: e.content,
        constant: !!e.constant, selective: !!e.selective,
        selectiveLogic: { and_any: 0, not_all: 1, not_any: 2, and_all: 3 }[e.selectiveLogic] || 0,
        addMemo: true, order: e.order, position: POSITIONS.indexOf(e.position), role: e.role || 0,
        disable: !!e.disable, probability: e.probability === undefined ? 100 : e.probability, depth: e.depth || 4,
        group: '', useProbability: e.useProbability !== false, excluded: false, sticky: 0, cooldown: 0, delay: 0,
        weight: 100, scanDepth: e.scanDepth || 4, caseSensitive: !!b.caseSensitive, matchWholeWords: !!b.matchWholeWords,
        excludeRecursion: false, preventRecursion: false, useGroupScoring: false,
        matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false,
        matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false,
        decorators: [], characterFilter: {}
      };
    });
    return JSON.stringify({
      name: b.name, description: b.description || '', entries: entries,
      settings: { recursive_scanning: !!b.recursiveScanning, case_sensitive: !!b.caseSensitive, match_whole_words: !!b.matchWholeWords }
    }, null, 2);
  }
  function importLorebookJson(text) {
    const obj = JSON.parse(text);
    const st = obj.settings || {};
    const book = {
      id: uid('book'), name: obj.name || '导入的世界书', description: obj.description || '导入自 SillyTavern',
      recursiveScanning: !!st.recursive_scanning, caseSensitive: !!st.case_sensitive, matchWholeWords: !!st.match_whole_words,
      createdAt: Date.now(), updatedAt: Date.now(), entries: []
    };
    const LOGIC = ['and_any', 'not_all', 'not_any', 'and_all'];
    Object.keys(obj.entries || {}).forEach(function (k) {
      const e = obj.entries[k];
      book.entries.push(makeEntry({
        keys: e.key || [], content: e.content || '', comment: e.comment || '', order: e.order === undefined ? 100 : e.order,
        position: POSITIONS[e.position] || 'before_char', selective: !!e.selective, selectiveLogic: LOGIC[e.selectiveLogic] || 'and_any',
        constant: !!e.constant, probability: e.probability === undefined ? 100 : e.probability, useProbability: e.useProbability !== false,
        disable: !!e.disable, depth: e.depth || 4
      }));
      const last = book.entries[book.entries.length - 1];
      last.secondaryKeys = e.keysecondary || [];
    });
    db.books.push(book); db.activeBookIds.push(book.id);
    save(); renderAll();
    U.toast({ tone: 'success', icon: 'globe', title: '世界书已导入', msg: book.name + ' · ' + book.entries.length + ' 条' });
  }
  function exportPresetJson() {
    const p = currentPreset();
    return JSON.stringify({ name: p.name, description: p.description, settings: p.settings }, null, 2);
  }
  function importPresetJson(text) {
    const obj = JSON.parse(text);
    const p = { id: uid('preset'), name: obj.name || '导入预设', description: obj.description || '', settings: obj.settings || {}, createdAt: Date.now(), updatedAt: Date.now() };
    db.presets.push(p); db.activePresetId = p.id;
    save(); renderAll();
    U.toast({ tone: 'success', icon: 'sliders', title: '预设已导入', msg: p.name });
  }
  function download(name, text, mime) {
    try {
      const blob = new Blob([text], { type: mime || 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { U.toast({ tone: 'error', title: '导出失败', msg: String(e.message || e) }); }
  }

  /* ══════════ 界面渲染 ══════════ */
  function applyModeChrome() {
    const panel = U.$('#tavern-panel');
    if (panel) panel.classList.toggle('hidden', uiMode !== 'tavern');
    const lbl = U.$('#ui-mode-label');
    if (lbl) lbl.textContent = uiMode === 'tavern' ? '叙事模式' : '酒馆模式';
    const screen = U.$('#screen-main');
    if (screen) screen.setAttribute('data-ui', uiMode);
  }

  function greeting() {
    const card = db.card;
    const text = (card.first_mes || '「我们开始吧。」') + '\n\n' +
      '【场景】' + (card.scenario || '') + '\n【你的身份】' + (S.profile.name + '（' + S.profile.tag + '）· ' +
        ES.state.positionOf(S).name + ' · ' + (S.club ? S.club.name + '（' + S.club.tier + '）' : '无俱乐部'));
    const choices = ES.narrative.currentChoices ? ES.narrative.currentChoices() : [];
    db.floors.push({
      id: uid('fl'), role: 'assistant', content: text, streaming: false, createdAt: Date.now(),
      parsed: {
        thinking: '开场楼层：由角色卡 first_mes / scenario 生成。\n世界书触发 ' + (lastContext ? lastContext.matchedEntries.length : 0) + ' 条。',
        maintext: text, options: choices.map(function (c) { return c.label; }), sum: '生涯开始。',
        varsRaw: '{}', varsCommands: { merge: {} }, unknown: {}
      },
      options: choices.map(function (c) { return c.label; }),
      variablesAfter: snapshot(), meta: { lorebookEntries: [], ovr: ES.state.ovr(S) }, tokens: estimateTokens(text)
    });
    save();
  }

  function renderAll() {
    applyModeChrome();
    const screen = U.$('#screen-main');
    if (screen) screen.setAttribute('data-ui', uiMode);
    const host = U.$('#tavern-panel');
    if (!host || !S) return;
    host.innerHTML =
      '<aside class="tv-side scroll-y" id="tavern-side"></aside>' +
      '<div class="tv-main">' +
        '<div class="tv-stream scroll-y" id="tavern-stream" aria-live="polite"></div>' +
        '<div class="tv-inputbar glass-panel">' +
          '<div class="tv-opts" id="tavern-opts"></div>' +
          '<div class="tv-input-row">' +
            '<textarea class="input tv-input" id="tavern-input" rows="1" placeholder="自由行动 / 对话（Enter 发送，Shift+Enter 换行）" aria-label="酒馆输入"></textarea>' +
            '<button type="button" class="btn btn-primary" id="btn-tv-send">' + U.icon('send', 'icon-sm') + '发送</button>' +
            '<button type="button" class="btn btn-ghost" id="btn-tv-continue" data-tip="继续推演（不推进回合）">' + U.icon('play', 'icon-sm') + '继续</button>' +
            '<button type="button" class="btn btn-ghost" id="btn-tv-regen" data-tip="重新生成上一条">' + U.icon('refresh', 'icon-sm') + '重roll</button>' +
          '</div>' +
          '<div class="tv-hint tiny dim" id="tavern-hint">SillyTavern 楼层模式 · 世界书注入 · 变量快照回溯 · 标签流式解析</div>' +
        '</div>' +
      '</div>';
    renderSide();
    bindPanel();
    renderFloors();
  }

  function renderSide() {
    const host = U.$('#tavern-side');
    if (!host) return;
    const ctx = lastContext;
    const p = currentPreset();
    host.innerHTML =
      '<div class="tv-card glass-panel corner-marks">' +
        '<div class="tv-card-head">' +
          '<div class="sigil" style="--sig:44px">' + ES.creator.sigilSvg(S.profile.sigil) + '</div>' +
          '<div class="grow"><div class="tv-card-name">' + U.esc(db.card.name) + '</div>' +
          '<div class="tiny dim-2">' + U.esc(db.card.character_version || '—') + ' · 角色卡 V2</div></div>' +
          '<button type="button" class="btn btn-icon btn-ghost" id="btn-tv-card" data-tip="角色卡编辑">' + U.icon('id') + '</button>' +
        '</div>' +
        '<div class="tiny dim-2" style="margin-top:6px">' + U.esc(charCard().persona) + '</div>' +
      '</div>' +
      '<div class="tv-card glass-panel corner-marks">' +
        '<div class="tv-sec">' + U.icon('globe', 'icon-xs') + '世界书 <span class="cnt">' + db.activeBookIds.length + '/' + db.books.length + '</span>' +
          '<button type="button" class="btn btn-icon btn-ghost" id="btn-tv-books" data-tip="世界书管理">' + U.icon('note') + '</button></div>' +
        db.books.map(function (b) {
          const on = db.activeBookIds.indexOf(b.id) >= 0;
          const hits = ctx ? ctx.matchedEntries.filter(function (m) { return m.entry.bookId === b.id; }).length : 0;
          return '<label class="tv-book' + (on ? ' is-on' : '') + '" data-book="' + b.id + '">' +
            '<input type="checkbox"' + (on ? ' checked' : '') + ' data-book-toggle="' + b.id + '">' +
            '<span class="tv-book-name">' + U.esc(b.name) + '</span>' +
            '<span class="tv-book-meta mono">' + b.entries.length + ' 条' + (hits ? ' · 触发 ' + hits : '') + '</span></label>';
        }).join('') +
      '</div>' +
      '<div class="tv-card glass-panel corner-marks">' +
        '<div class="tv-sec">' + U.icon('sliders', 'icon-xs') + '预设' +
          '<button type="button" class="btn btn-icon btn-ghost" id="btn-tv-preset" data-tip="预设与提示词顺序">' + U.icon('terminal') + '</button></div>' +
        '<select class="input tv-select" id="tv-preset-select">' + db.presets.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === db.activePresetId ? ' selected' : '') + '>' + U.esc(x.name) + '</option>';
        }).join('') + '</select>' +
        '<div class="tv-kv"><span>温度</span><span class="mono">' + (p.settings.temp_openai !== undefined ? p.settings.temp_openai : 0.85) + '</span></div>' +
        '<div class="tv-kv"><span>上下文预算</span><span class="mono">' + (ctx ? ctx.totalTokens : 0) + ' / ' + (p.settings.openai_max_context || 4096) + '</span></div>' +
        '<div class="tv-budget"><i style="width:' + U.clamp(ctx ? (ctx.totalTokens / (p.settings.openai_max_context || 4096)) * 100 : 0, 0, 100) + '%"></i></div>' +
        '<div class="row-tight wrap" style="margin-top:8px">' +
          '<button type="button" class="btn btn-sm btn-line" id="btn-tv-ctx">' + U.icon('layers', 'icon-xs') + '上下文</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-tv-vars">' + U.icon('chart', 'icon-xs') + '变量</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-tv-history">' + U.icon('hourglass', 'icon-xs') + '历史</button>' +
          '<button type="button" class="btn btn-sm ' + (ES.api && ES.api.isEnabled() ? 'btn-line' : 'btn-ghost') + '" id="btn-tv-api">' +
            U.icon('link', 'icon-xs') + 'API 接入' +
            '<span class="tag" data-tone="' + (!ES.api || !ES.api.isEnabled() ? 'dim' : ES.api.mode() === 'dual' ? 'gold' : 'cyan') + '" style="margin-left:6px">' +
            U.esc(!ES.api || !ES.api.isEnabled() ? '本地' : (ES.api.mode() === 'dual' ? '双 API' : '单 API')) + '</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="tv-card glass-panel corner-marks">' +
        '<div class="tv-sec">' + U.icon('layers', 'icon-xs') + '会话</div>' +
        '<div class="tv-kv"><span>楼层</span><span class="mono">' + db.floors.length + '</span></div>' +
        '<div class="tv-kv"><span>分支</span><span class="mono">' + ((db.sessions || []).length) + '</span></div>' +
        '<div class="tv-kv"><span>思考显示</span><span class="mono">' + ({ fold: '折叠', hide: '隐藏', inline: '展开' }[db.settings.thinkingDisplay]) + '</span></div>' +
        '<div class="row-tight wrap" style="margin-top:8px">' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-tv-export">' + U.icon('save', 'icon-xs') + '导出</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-tv-clear">' + U.icon('trash', 'icon-xs') + '清空</button>' +
        '</div>' +
      '</div>';
  }

  function floorHtml(f, live) {
    if (f.role === 'user') {
      return '<article class="tv-floor" data-role="user" data-floor="' + f.id + '">' +
        '<div class="tv-floor-body"><div class="tv-bubble">' + U.esc(f.content) + '</div>' +
        '<div class="tv-tools">' +
          '<button type="button" data-tv-act="edit" data-id="' + f.id + '" data-tip="编辑">' + U.icon('note', 'icon-xs') + '</button>' +
          '<button type="button" data-tv-act="branch" data-id="' + f.id + '" data-tip="从此处分支">' + U.icon('layers', 'icon-xs') + '</button>' +
          '<button type="button" data-tv-act="del" data-id="' + f.id + '" data-tip="删除">' + U.icon('trash', 'icon-xs') + '</button>' +
        '</div></div></article>';
    }
    const p = f.parsed || { thinking: '', maintext: f.content, options: [], sum: '', varsCommands: { merge: {} } };
    const thinkMode = db.settings.thinkingDisplay;
    const think = (thinkMode === 'hide' || !p.thinking) ? '' :
      '<details class="tv-think"' + (thinkMode === 'inline' ? ' open' : '') + '><summary>' + U.icon('cpu', 'icon-xs') + '思考 / 判定轨迹</summary><pre>' + U.esc(p.thinking) + '</pre></details>';
    const opts = (p.options && p.options.length && !f.streaming) ?
      '<div class="tv-options">' + p.options.map(function (o, i) {
        return '<button type="button" class="tv-opt" data-tv-opt="' + i + '"><span class="tv-opt-no">' + (i + 1) + '</span>' + U.esc(o) + '</button>';
      }).join('') + '</div>' : '';
    let vars = '';
    if (db.settings.showVarsChips) {
      const keys = Object.keys((p.varsCommands && p.varsCommands.merge) || {});
      if (keys.length) vars = '<div class="tv-vars">' + keys.map(function (k) {
        const v = p.varsCommands.merge[k];
        return '<span class="tag" data-tone="' + (v > 0 ? 'cyan' : v < 0 ? 'red' : 'dim') + '">' + U.esc(k) + ' ' + (v > 0 ? '+' : '') + v + '</span>';
      }).join('') + '</div>';
    }
    const meta = f.meta || {};
    const APILABEL = { local: '本地引擎', primary: '主 API', 'primary+secondary': '主 + 次 API', error: 'API 错误' };
    const apiTag = '<span class="tag" data-tone="' + (meta.api === 'local' ? 'dim' : meta.api === 'error' ? 'red' : 'cyan') + '">' +
      U.esc(APILABEL[meta.api] || '本地引擎') + (meta.model && meta.api !== 'local' ? ' · ' + U.esc(meta.model) : '') +
      (meta.ms ? ' · ' + meta.ms + 'ms' : '') + '</span>';
    return '<article class="tv-floor" data-role="assistant" data-floor="' + f.id + '">' +
      '<div class="tv-floor-body">' +
        think +
        '<div class="tv-maintext"' + (f.streaming ? ' data-streaming="1"' : '') + '>' + (p.maintext || (f.streaming ? '<span class="tv-caret"></span>' : '')) + (f.streaming ? '<span class="tv-caret"></span>' : '') + '</div>' +
        (p.sum && !f.streaming ? '<div class="tv-sum">' + U.icon('check', 'icon-xs') + U.esc(p.sum) + '</div>' : '') +
        opts + vars +
        (f.streaming ? '' :
          '<div class="tv-meta tiny dim-2">' +
            '<span class="mono">' + (f.tokens || 0) + ' tk</span>' +
            '<span>总评 ' + (meta.ovr !== undefined ? meta.ovr : ES.state.ovr(S)) + '</span>' +
            '<span>世界书 ' + ((meta.lorebookEntries || []).length) + '</span>' +
            apiTag +
            '<span>' + new Date(f.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
          '</div>' +
          '<div class="tv-tools">' +
            '<button type="button" data-tv-act="regen" data-id="' + f.id + '" data-tip="重新生成">' + U.icon('refresh', 'icon-xs') + '</button>' +
            '<button type="button" data-tv-act="continue" data-id="' + f.id + '" data-tip="继续">' + U.icon('play', 'icon-xs') + '</button>' +
            '<button type="button" data-tv-act="edit" data-id="' + f.id + '" data-tip="编辑">' + U.icon('note', 'icon-xs') + '</button>' +
            '<button type="button" data-tv-act="copy" data-id="' + f.id + '" data-tip="复制">' + U.icon('copy', 'icon-xs') + '</button>' +
            '<button type="button" data-tv-act="rollback" data-id="' + f.id + '" data-tip="回滚到此楼（恢复变量快照）">' + U.icon('hourglass', 'icon-xs') + '</button>' +
            '<button type="button" data-tv-act="branch" data-id="' + f.id + '" data-tip="分支">' + U.icon('layers', 'icon-xs') + '</button>' +
            '<button type="button" data-tv-act="del" data-id="' + f.id + '" data-tip="删除">' + U.icon('trash', 'icon-xs') + '</button>' +
          '</div>') +
      '</div></article>';
  }

  function renderFloors() {
    const host = U.$('#tavern-stream');
    if (!host) return;
    host.innerHTML = '<div class="tv-end tiny dim">— 会话起点 —</div>' +
      db.floors.map(function (f) { return floorHtml(f); }).join('') +
      '<div class="tv-end tiny dim">— 最新 —</div>';
    renderOpts();
    if (db.settings.autoScroll) host.scrollTop = host.scrollHeight;
  }
  function renderFloorsLive(floor) {
    const host = U.$('#tavern-stream');
    if (!host) return;
    const node = host.querySelector('[data-floor="' + floor.id + '"]');
    if (!node) { renderFloors(); return; }
    const tmp = document.createElement('div');
    tmp.innerHTML = floorHtml(floor);
    node.replaceWith(tmp.firstElementChild);
    if (db.settings.autoScroll) host.scrollTop = host.scrollHeight;
  }
  function renderOpts() {
    const host = U.$('#tavern-opts');
    if (!host) return;
    const choices = ES.narrative.currentChoices ? ES.narrative.currentChoices() : [];
    host.innerHTML = choices.length
      ? choices.map(function (c, i) {
        return '<button type="button" class="chip tv-opt-chip" data-tv-opt="' + i + '" aria-label="选项 ' + (i + 1) + '">' +
          U.icon('chevron', 'chip-ico') + U.esc(c.label) + (c.check ? '<span class="tiny dim">' + (c.check.kind === 'breakthrough' ? ' 1d100' : ' 成功线 ' + c.check.dc) + '</span>' : '') + '</button>';
      }).join('')
      : '<span class="tiny dim">当前没有可执行选项，直接输入你的行动。</span>';
  }
  function renderAside() { renderSide(); }

  /* ══════════ 事件绑定 ══════════ */
  function bindPanel() {
    const stream = U.$('#tavern-stream');
    const opts = U.$('#tavern-opts');
    const input = U.$('#tavern-input');

    stream.addEventListener('click', function (e) {
      const opt = e.target.closest('[data-tv-opt]');
      if (opt) { chooseOption(parseInt(opt.getAttribute('data-tv-opt'), 10)); return; }
      const act = e.target.closest('[data-tv-act]');
      if (!act) return;
      const id = act.getAttribute('data-id');
      const kind = act.getAttribute('data-tv-act');
      const f = db.floors.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      if (kind === 'regen') regenerate(id);
      else if (kind === 'continue') continueFloor();
      else if (kind === 'copy') {
        try { navigator.clipboard.writeText((f.parsed && f.parsed.maintext) || f.content); } catch (err) {}
        U.toast({ tone: 'info', title: '已复制楼层文本' });
      } else if (kind === 'rollback') rollbackTo(id);
      else if (kind === 'branch') branchAt(id);
      else if (kind === 'del') deleteFloor(id);
      else if (kind === 'edit') openEdit(f);
    });
    opts.addEventListener('click', function (e) {
      const opt = e.target.closest('[data-tv-opt]');
      if (opt) chooseOption(parseInt(opt.getAttribute('data-tv-opt'), 10));
    });
    U.$('#btn-tv-send').addEventListener('click', function () { send(input.value); input.value = ''; });
    U.$('#btn-tv-continue').addEventListener('click', continueFloor);
    U.$('#btn-tv-regen').addEventListener('click', function () {
      const last = db.floors.slice().reverse().filter(function (f) { return f.role === 'assistant'; })[0];
      if (last) regenerate(last.id);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); input.value = ''; }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(140, input.scrollHeight) + 'px';
    });
    U.$('#btn-tv-card').addEventListener('click', openCardModal);
    U.$('#btn-tv-api').addEventListener('click', openApiModal);
    U.$('#btn-tv-books').addEventListener('click', openLorebookModal);
    U.$('#btn-tv-preset').addEventListener('click', openPresetModal);
    U.$('#btn-tv-ctx').addEventListener('click', function () { buildContext('（预览）'); openContextModal(); });
    U.$('#btn-tv-vars').addEventListener('click', openVarsModal);
    U.$('#btn-tv-history').addEventListener('click', openHistoryModal);
    U.$('#btn-tv-clear').addEventListener('click', clearFloors);
    U.$('#btn-tv-export').addEventListener('click', function () { exportBundle(); });
    U.$('#tv-preset-select').addEventListener('change', function (e) {
      db.activePresetId = e.target.value; save(); renderSide();
    });
    U.$('#tavern-side').addEventListener('change', function (e) {
      const b = e.target.closest('[data-book-toggle]');
      if (!b) return;
      const id = b.getAttribute('data-book-toggle');
      const i = db.activeBookIds.indexOf(id);
      if (b.checked && i < 0) db.activeBookIds.push(id);
      else if (!b.checked && i >= 0) db.activeBookIds.splice(i, 1);
      save(); renderSide();
    });
  }

  /* ══════════ 通用酒馆模态 ══════════ */
  function openModal(title, sub, body, foot) {
    U.$('#tavern-modal-title').textContent = title;
    U.$('#tavern-modal-sub').textContent = sub || '';
    U.$('#tavern-modal-body').innerHTML = body;
    U.$('#tavern-modal-foot').innerHTML = foot || '<div class="spacer"></div><button type="button" class="btn btn-sm btn-primary" data-close="modal-tavern">关闭</button>';
    U.openModal('modal-tavern');
  }
  function openEdit(f) {
    openModal('编辑楼层', f.role === 'user' ? '玩家输入' : '主持回复', 
      '<textarea class="input" id="tv-edit-text" rows="10" style="width:100%">' + U.esc(f.role === 'assistant' ? ((f.parsed && f.parsed.maintext) || f.content) : f.content) + '</textarea>',
      '<span class="tiny dim">编辑后该楼层的解析结果会重新生成。</span><div class="spacer"></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-close="modal-tavern">取消</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btn-tv-edit-save">保存</button>');
    U.$('#btn-tv-edit-save').onclick = function () {
      const v = U.$('#tv-edit-text').value;
      editFloor(f.id, v);
      if (f.role === 'assistant') {
        f.parsed = f.parsed || { thinking: '', options: [], sum: '', varsRaw: '', varsCommands: { merge: {} }, unknown: {} };
        f.parsed.maintext = v;
      }
      save(); renderFloors(); U.closeModal('modal-tavern');
    };
  }

  function openCardModal() {
    const c = db.card;
    const field = function (id, label, val, rows) {
      return '<div class="field span-2"><span class="field-label">' + U.esc(label) + '</span>' +
        '<textarea class="input" id="' + id + '" rows="' + (rows || 3) + '" style="width:100%">' + U.esc(val || '') + '</textarea></div>';
    };
    openModal('角色卡（Character Card V2）', '字段与 SillyTavern 一致，可导入导出 JSON',
      '<div class="tv-form">' +
        '<div class="field"><span class="field-label">名称</span><input class="input" id="cc-name" value="' + U.esc(c.name) + '"></div>' +
        '<div class="field"><span class="field-label">作者 / 版本</span><input class="input" id="cc-creator" value="' + U.esc((c.creator || '') + ' / ' + (c.character_version || '')) + '"></div>' +
        field('cc-desc', 'Description · 角色描述', c.description, 4) +
        field('cc-pers', 'Personality · 角色性格', c.personality, 3) +
        field('cc-scen', 'Scenario · 场景设定', c.scenario, 3) +
        field('cc-first', 'First Message · 开场白', c.first_mes, 3) +
        field('cc-ex', 'Example Dialogue · 对话示例', c.mes_example, 4) +
        field('cc-notes', 'Creator Notes · 作者注', c.creator_notes, 2) +
        field('cc-sys', 'System Prompt · 系统提示（覆盖主提示词）', c.system_prompt, 2) +
        field('cc-post', 'Post-History Instructions · 历史后指令', c.post_history_instructions, 2) +
        '<div class="field span-2"><span class="field-label">Alternate Greetings · 备用开场白（每行一条）</span>' +
        '<textarea class="input" id="cc-alt" rows="2" style="width:100%">' + U.esc((c.alternate_greetings || []).join('\n')) + '</textarea></div>' +
        '<div class="field span-2"><span class="field-label">Tags · 标签（逗号分隔）</span>' +
        '<input class="input" id="cc-tags" value="' + U.esc((c.tags || []).join(', ')) + '"></div>' +
      '</div>',
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-cc-export">' + U.icon('save', 'icon-xs') + '导出 JSON</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-cc-import">' + U.icon('upload', 'icon-xs') + '导入 JSON</button>' +
      '<div class="spacer"></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-close="modal-tavern">取消</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btn-cc-save">保存</button>');
    U.$('#btn-cc-save').onclick = function () {
      db.card.name = U.$('#cc-name').value || '联盟主持';
      const cr = U.$('#cc-creator').value.split(' / ');
      db.card.creator = cr[0] || ''; db.card.character_version = cr[1] || '';
      db.card.description = U.$('#cc-desc').value;
      db.card.personality = U.$('#cc-pers').value;
      db.card.scenario = U.$('#cc-scen').value;
      db.card.first_mes = U.$('#cc-first').value;
      db.card.mes_example = U.$('#cc-ex').value;
      db.card.creator_notes = U.$('#cc-notes').value;
      db.card.system_prompt = U.$('#cc-sys').value;
      db.card.post_history_instructions = U.$('#cc-post').value;
      db.card.alternate_greetings = U.$('#cc-alt').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      db.card.tags = U.$('#cc-tags').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      save(); renderAll(); U.closeModal('modal-tavern');
      U.toast({ tone: 'success', icon: 'id', title: '角色卡已更新', msg: db.card.name });
    };
    U.$('#btn-cc-export').onclick = function () { download('character-card-' + db.card.name + '.json', exportCardJson()); };
    U.$('#btn-cc-import').onclick = function () { pickFile('.json', importCardJson); };
  }

  function openLorebookModal() {
    const renderBody = function (bookId) {
      const b = db.books.filter(function (x) { return x.id === bookId; })[0];
      if (!b) return '<div class="empty tiny dim">选择一本世界书</div>';
      return '<div class="tv-lb-editor">' +
        '<div class="tv-kv"><span>条目</span><span class="mono">' + b.entries.length + '</span></div>' +
        '<div class="tv-kv"><span>递归扫描</span><span class="mono">' + (b.recursiveScanning ? '开' : '关') + '</span></div>' +
        '<div class="tv-lb-list">' + b.entries.slice(0, 60).map(function (e) {
          return '<div class="tv-lb-item" data-entry="' + e.id + '">' +
            '<div class="grow"><b>' + U.esc(e.comment || (e.keys || [])[0] || '未命名') + '</b>' +
            '<div class="tiny dim-2 mono">' + U.esc((e.keys || []).join(' / ')) + ' · ' + POS_LABEL[e.position] + ' · 序 ' + e.order + (e.constant ? ' · 常量' : '') + '</div>' +
            '<div class="tiny dim-2 tv-clamp">' + U.esc(e.content) + '</div></div>' +
            '<button type="button" class="btn btn-icon btn-ghost" data-lb-del="' + bookId + '|' + e.id + '" data-tip="删除条目">' + U.icon('trash', 'icon-xs') + '</button>' +
            '</div>';
        }).join('') + '</div>' +
        '<div class="hairline" style="margin:12px 0"></div>' +
        '<div class="row-tight wrap">' +
          '<input class="input" id="lb-new-keys" placeholder="关键词（逗号分隔）" style="flex:1;min-width:180px">' +
          '<input class="input" id="lb-new-order" type="number" value="100" style="width:90px" aria-label="插入顺序">' +
          '<button type="button" class="btn btn-sm btn-line" id="btn-lb-add">' + U.icon('plus', 'icon-xs') + '新增条目</button>' +
        '</div>' +
        '<textarea class="input" id="lb-new-content" rows="3" style="width:100%;margin-top:8px" placeholder="条目内容（命中关键词时注入上下文）"></textarea>' +
      '</div>';
    };
    openModal('世界书管理', '关键词触发的设定条目 · 支持 SillyTavern JSON 导入导出',
      '<div class="tv-lb">' +
        '<div class="tv-lb-books">' + db.books.map(function (b) {
          return '<button type="button" class="tv-lb-book' + (b.id === db.books[0].id ? ' is-on' : '') + '" data-lb-book="' + b.id + '">' +
            U.esc(b.name) + '<span class="tiny dim mono">' + b.entries.length + '</span></button>';
        }).join('') + '</div>' +
        '<div class="tv-lb-body" id="tv-lb-body">' + renderBody(db.books[0] ? db.books[0].id : '') + '</div>' +
      '</div>',
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-lb-import">' + U.icon('upload', 'icon-xs') + '导入</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-lb-export">' + U.icon('save', 'icon-xs') + '导出当前书</button>' +
      '<div class="spacer"></div><button type="button" class="btn btn-sm btn-primary" data-close="modal-tavern">完成</button>');

    let cur = db.books[0] ? db.books[0].id : '';
    const body = U.$('#tavern-modal-body');
    body.addEventListener('click', function (e) {
      const bk = e.target.closest('[data-lb-book]');
      if (bk) {
        cur = bk.getAttribute('data-lb-book');
        U.$$('.tv-lb-book', body).forEach(function (x) { x.classList.toggle('is-on', x === bk); });
        U.$('#tv-lb-body').innerHTML = renderBody(cur);
        return;
      }
      const del = e.target.closest('[data-lb-del]');
      if (del) {
        const parts = del.getAttribute('data-lb-del').split('|');
        const b = db.books.filter(function (x) { return x.id === parts[0]; })[0];
        if (b) {
          b.entries = b.entries.filter(function (x) { return x.id !== parts[1]; });
          save(); U.$('#tv-lb-body').innerHTML = renderBody(cur); renderSide();
        }
        return;
      }
      if (e.target.closest('#btn-lb-add')) {
        const keys = (U.$('#lb-new-keys').value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        const content = U.$('#lb-new-content').value.trim();
        if (!keys.length || !content) { U.toast({ tone: 'warn', title: '需要关键词与内容' }); return; }
        const b = db.books.filter(function (x) { return x.id === cur; })[0];
        b.entries.push(makeEntry({ bookId: b.id, keys: keys, content: content, order: parseInt(U.$('#lb-new-order').value, 10) || 100 }));
        save(); U.$('#tv-lb-body').innerHTML = renderBody(cur); renderSide();
        U.toast({ tone: 'success', title: '条目已添加', msg: keys.join(' / ') });
      }
    });
    U.$('#btn-lb-export').onclick = function () { download('lorebook.json', exportLorebook(cur)); };
    U.$('#btn-lb-import').onclick = function () { pickFile('.json', importLorebookJson); };
  }

  function openPresetModal() {
    const p = currentPreset();
    const s = p.settings;
    openModal('预设与提示词顺序', p.name + ' · prompt_order ' + (s.prompt_order || []).length + ' 项',
      '<div class="tv-preset">' +
        '<div class="tv-form">' +
          '<div class="field"><span class="field-label">温度 temp_openai</span><input class="range" id="ps-temp" type="range" min="0" max="2" step="0.05" value="' + (s.temp_openai || 0.85) + '"><span class="range-val mono" id="ps-temp-v">' + (s.temp_openai || 0.85) + '</span></div>' +
          '<div class="field"><span class="field-label">top_p</span><input class="range" id="ps-topp" type="range" min="0" max="1" step="0.01" value="' + (s.top_p_openai || 0.92) + '"><span class="range-val mono" id="ps-topp-v">' + (s.top_p_openai || 0.92) + '</span></div>' +
          '<div class="field"><span class="field-label">上下文上限 openai_max_context</span><input class="input" id="ps-ctx" type="number" value="' + (s.openai_max_context || 4096) + '"></div>' +
          '<div class="field"><span class="field-label">输出上限 openai_max_tokens</span><input class="input" id="ps-max" type="number" value="' + (s.openai_max_tokens || 1024) + '"></div>' +
        '</div>' +
        '<div class="field span-2"><span class="field-label">Main Prompt · 主提示词（支持 {{user}} / {{char}} / {{变量}}）</span>' +
        '<textarea class="input" id="ps-main" rows="4" style="width:100%">' + U.esc(s.main || '') + '</textarea></div>' +
        '<div class="field span-2"><span class="field-label">Jailbreak · 收尾指令</span>' +
        '<textarea class="input" id="ps-jb" rows="2" style="width:100%">' + U.esc(s.jailbreak || '') + '</textarea></div>' +
        '<div class="field span-2"><span class="field-label">输出格式约定（formatPromptTemplate）</span>' +
        '<textarea class="input" id="ps-format" rows="5" style="width:100%">' + U.esc(db.settings.formatPrompt) + '</textarea></div>' +
        '<div class="tv-order"><div class="tv-sec">' + U.icon('layers', 'icon-xs') + '提示词顺序（prompt_order）</div>' +
        (s.prompt_order || []).map(function (o, i) {
          return '<div class="tv-order-row" data-order="' + i + '">' +
            '<span class="tv-order-no mono">' + (i + 1) + '</span>' +
            '<span class="grow">' + U.esc(o.name || o.identifier) + '<span class="tiny dim-2 mono"> ' + o.identifier + '</span></span>' +
            '<label class="tiny dim"><input type="checkbox" data-order-toggle="' + i + '"' + (o.enabled === false ? '' : ' checked') + '> 启用</label>' +
            '<button type="button" class="btn btn-icon btn-ghost" data-order-up="' + i + '" aria-label="上移">' + U.icon('trend-up', 'icon-xs') + '</button>' +
            '<button type="button" class="btn btn-icon btn-ghost" data-order-down="' + i + '" aria-label="下移">' + U.icon('trend-down', 'icon-xs') + '</button>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>',
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-ps-import">' + U.icon('upload', 'icon-xs') + '导入预设</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-ps-export">' + U.icon('save', 'icon-xs') + '导出预设</button>' +
      '<div class="spacer"></div><button type="button" class="btn btn-sm btn-ghost" data-close="modal-tavern">取消</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btn-ps-save">保存</button>');

    const body = U.$('#tavern-modal-body');
    U.$('#ps-temp').addEventListener('input', function (e) { U.$('#ps-temp-v').textContent = e.target.value; });
    U.$('#ps-topp').addEventListener('input', function (e) { U.$('#ps-topp-v').textContent = e.target.value; });
    body.addEventListener('click', function (e) {
      const up = e.target.closest('[data-order-up]'), down = e.target.closest('[data-order-down]');
      const order = s.prompt_order || [];
      if (up) { const i = +up.getAttribute('data-order-up'); if (i > 0) { const t = order[i - 1]; order[i - 1] = order[i]; order[i] = t; save(); openPresetModal(); } }
      else if (down) { const i = +down.getAttribute('data-order-down'); if (i < order.length - 1) { const t = order[i + 1]; order[i + 1] = order[i]; order[i] = t; save(); openPresetModal(); } }
      else if (e.target.closest('[data-order-toggle]')) {
        const i = +e.target.getAttribute('data-order-toggle');
        order[i].enabled = e.target.checked; save();
      }
    });
    U.$('#btn-ps-save').onclick = function () {
      s.temp_openai = parseFloat(U.$('#ps-temp').value);
      s.top_p_openai = parseFloat(U.$('#ps-topp').value);
      s.openai_max_context = parseInt(U.$('#ps-ctx').value, 10) || 4096;
      s.openai_max_tokens = parseInt(U.$('#ps-max').value, 10) || 1024;
      s.main = U.$('#ps-main').value; s.jailbreak = U.$('#ps-jb').value;
      db.settings.formatPrompt = U.$('#ps-format').value;
      p.updatedAt = Date.now(); save(); renderSide(); U.closeModal('modal-tavern');
      U.toast({ tone: 'success', icon: 'sliders', title: '预设已保存' });
    };
    U.$('#btn-ps-export').onclick = function () { download('preset.json', exportPresetJson()); };
    U.$('#btn-ps-import').onclick = function () { pickFile('.json', importPresetJson); };
  }

  function openVarsModal() {
    const vars = projectVars();
    const snap = (db.floors.slice().reverse().filter(function (f) { return f.variablesAfter; })[0] || {}).variablesAfter;
    openModal('变量与宏', '游戏状态 ⇄ 酒馆变量（{{变量名}} / {{getvar::x}} 可在提示词中使用）',
      '<div class="tv-vars-grid">' + Object.keys(vars).map(function (k) {
        return '<div class="tv-var-row"><span class="k">' + U.esc(k) + '</span>' +
          '<input class="input tv-var-in" data-var="' + U.esc(k) + '" value="' + U.esc(String(vars[k])) + '"></div>';
      }).join('') + '</div>' +
      '<div class="inset" style="padding:12px;margin-top:12px"><div class="sub-title">最近楼层快照</div>' +
      '<div class="tiny dim-2 mono">' + (snap ? ('总评 ' + snap.ovr + '（' + snap.level + '）· 竞技状态 ' + Math.round(snap.res.condition) +
        ' · 手部健康 ' + Math.round(snap.res.hand) + ' · 金钱 ¥' + Math.round(snap.res.money) + ' · 回合 ' + snap.turn) : '暂无快照') + '</div>' +
      '<div class="row-tight wrap" style="margin-top:8px">' +
        '<button type="button" class="btn btn-sm btn-line" id="btn-var-restore">' + U.icon('hourglass', 'icon-xs') + '恢复该快照</button>' +
      '</div></div>',
      '<span class="tiny dim">仅数值型变量会被写回游戏状态。</span><div class="spacer"></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-close="modal-tavern">取消</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btn-var-save">应用</button>');
    U.$('#btn-var-save').onclick = function () {
      const patch = {};
      U.$$('.tv-var-in').forEach(function (inp) {
        const k = inp.getAttribute('data-var');
        const n = Number(inp.value);
        if (!isNaN(n) && n !== vars[k]) {
          if (k.indexOf('属性.') === 0) patch['属性.' + k.slice(3)] = n - vars[k];
          else if (k === '竞技状态') patch['状态.竞技状态'] = n - vars[k];
          else if (k === '手部健康') patch['状态.手部健康'] = n - vars[k];
          else if (k === '伤病风险') patch['状态.伤病风险'] = n - vars[k];
          else if (k === '金钱') patch['金钱'] = n - vars[k];
          else if (k === '粉丝') patch['资源.粉丝'] = n - vars[k];
          else if (k === '名声') patch['名声'] = n;
          else if (k === '舆论热度') patch['舆论热度'] = n;
        }
      });
      applyProjectedVars(patch);
      save(); ES.app.refreshUI(); U.closeModal('modal-tavern');
      U.toast({ tone: 'success', icon: 'chart', title: '变量已写回游戏状态' });
    };
    U.$('#btn-var-restore').onclick = function () { restore(snap); U.closeModal('modal-tavern'); U.toast({ tone: 'info', title: '已恢复快照' }); };
  }

  function openContextModal() {
    const ctx = lastContext || buildContext('（预览）');
    openModal('上下文检视器', '按 prompt_order 组装的完整提示词 · ' + ctx.totalTokens + ' / ' + ctx.budget + ' tokens',
      '<div class="tv-ctx">' +
        '<div class="tv-ctx-blocks">' + ctx.blocks.map(function (b) {
          return '<details class="tv-ctx-block" data-kind="' + b.kind + '"><summary>' +
            '<span class="tv-ctx-name">' + U.esc(b.name) + '</span>' +
            '<span class="tiny dim-2 mono">' + b.identifier + ' · ' + b.tokens + ' tk</span>' +
            '</summary><pre>' + U.esc(b.content) + '</pre></details>';
        }).join('') + '</div>' +
        '<div class="inset" style="padding:12px"><div class="sub-title">本次触发世界书 ' + ctx.matchedEntries.length + ' 条</div>' +
        (ctx.matchedEntries.length ? ctx.matchedEntries.map(function (m) {
          return '<div class="tv-ctx-entry"><b>' + U.esc(m.entry.comment || (m.entry.keys || [])[0]) + '</b>' +
            '<span class="tiny dim-2 mono"> ' + U.esc((m.matchedKeywords || []).join(' / ')) + ' · ' + POS_LABEL[m.entry.position] + '</span></div>';
        }).join('') : '<div class="tiny dim">无条目命中：输入中出现关键词才会注入。</div>') +
        '</div>' +
        '<div class="inset" style="padding:12px;margin-top:10px"><div class="sub-title">最终消息序列（' + ctx.messages.length + ' 条）</div>' +
        '<div class="tiny dim-2 mono">' + ctx.messages.map(function (m, i) {
          return (i + 1) + '. [' + m.role + '] ' + U.esc(String(m.content).slice(0, 90).replace(/\n/g, ' ')) + '…';
        }).join('<br>') + '</div></div>' +
      '</div>',
      '<span class="tiny dim">本地叙事引擎即「主 API」；规则结算引擎即「次 API」。</span><div class="spacer"></div>' +
      '<button type="button" class="btn btn-sm btn-primary" data-close="modal-tavern">关闭</button>');
  }

  function openHistoryModal() {
    openModal('历史楼层', '点击任意楼层可回滚（恢复变量快照）或创建分支',
      '<div class="tv-history">' + db.floors.map(function (f, i) {
        const snap = f.variablesAfter;
        return '<div class="tv-hist-row" data-hist="' + f.id + '">' +
          '<span class="tv-hist-no mono">' + (i + 1) + '</span>' +
          '<span class="tv-hist-role" data-role="' + f.role + '">' + (f.role === 'user' ? '玩家' : '主持') + '</span>' +
          '<span class="grow tv-clamp">' + U.esc(f.role === 'assistant' && f.parsed ? f.parsed.maintext : f.content) + '</span>' +
          '<span class="tiny dim-2 mono">' + (snap ? '总评 ' + snap.ovr : '—') + '</span>' +
          '<button type="button" class="btn btn-icon btn-ghost" data-hist-jump="' + f.id + '" data-tip="回滚">' + U.icon('hourglass', 'icon-xs') + '</button>' +
          '<button type="button" class="btn btn-icon btn-ghost" data-hist-branch="' + f.id + '" data-tip="分支">' + U.icon('layers', 'icon-xs') + '</button>' +
        '</div>';
      }).join('') + '</div>' +
      ((db.sessions || []).length ? '<div class="inset" style="padding:12px;margin-top:12px"><div class="sub-title">分支会话</div>' +
        db.sessions.map(function (s) {
          return '<div class="tv-hist-row"><span class="grow">' + U.esc(s.name) + ' <span class="tiny dim-2 mono">' + s.floors.length + ' 楼</span></span>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-ses="' + s.id + '">切换</button></div>';
        }).join('') + '</div>' : ''),
      '<div class="spacer"></div><button type="button" class="btn btn-sm btn-primary" data-close="modal-tavern">关闭</button>');
    const body = U.$('#tavern-modal-body');
    body.addEventListener('click', function (e) {
      const jump = e.target.closest('[data-hist-jump]');
      const branch = e.target.closest('[data-hist-branch]');
      const ses = e.target.closest('[data-ses]');
      if (jump) { rollbackTo(jump.getAttribute('data-hist-jump')); U.closeModal('modal-tavern'); }
      else if (branch) { branchAt(branch.getAttribute('data-hist-branch')); U.closeModal('modal-tavern'); }
      else if (ses) { resignSession(ses.getAttribute('data-ses')); U.closeModal('modal-tavern'); }
    });
  }

  /* ── API 接入面板（主 / 次 API 配置 · 连接测试 · 请求审计） ── */
  function openApiModal() {
    const c = ES.api.config();
    const field = function (id, label, val, type, ph) {
      return '<div class="field"><span class="field-label">' + U.esc(label) + '</span>' +
        '<input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + U.esc(val === undefined || val === null ? '' : String(val)) + '" placeholder="' + U.esc(ph || '') + '"' + (type === 'password' ? ' autocomplete="off"' : '') + '></div>';
    };
    const audit = ES.api.getAudit();
    const lastErr = ES.api.getLastError();

    function targetBlock(prefix, t, title, note, extra) {
      return '<div class="tv-api-block">' +
        '<div class="tv-sec">' + U.icon('link', 'icon-xs') + U.esc(title) + '<span class="cnt mono">' + U.esc(t.model || '—') + '</span></div>' +
        '<div class="tv-form">' +
          field(prefix + '-base', 'Base URL（需以 /v1 结尾）', t.baseUrl, 'text', 'https://api.openai.com/v1') +
          field(prefix + '-model', '模型名', t.model, 'text', 'gpt-4o-mini') +
          field(prefix + '-key', 'API Key（仅存本机 localStorage）', t.apiKey, 'password', 'sk-...') +
          field(prefix + '-temp', '温度', t.temperature) +
          field(prefix + '-max', 'max_tokens', t.maxTokens) +
          field(prefix + '-timeout', '超时(ms)', t.timeout) +
          '<div class="field"><span class="field-label">思考模式</span>' +
            '<label class="chip"><input type="checkbox" id="' + prefix + '-nothink"' + (t.noThinking ? ' checked' : '') + '> 关闭思考（仅输出正文，推理模型建议开）</label></div>' +
          '<div class="field"><span class="field-label">流式 SSE</span>' +
            '<label class="chip"><input type="checkbox" id="' + prefix + '-stream"' + (t.stream ? ' checked' : '') + '> 启用流式输出</label></div>' +
          '<div class="field"><span class="field-label">自定义请求头（JSON）</span>' +
            '<input class="input" id="' + prefix + '-headers" value="' + U.esc(t.headers || '') + '" placeholder=\'{"X-Api-Version":"1"}\'></div>' +
        '</div>' +
        (extra || '') +
        '<div class="tiny dim-2" style="margin-top:6px">' + U.esc(note) + '</div>' +
      '</div>';
    }

    openModal('API 接入', '真实 HTTP · OpenAI 兼容端点 · 主 API 跑剧情、次 API 跑 <sum>/<vars>',
      '<div class="tv-api">' +
        '<div class="row-tight wrap" style="margin-bottom:12px">' +
          ['local', 'single', 'dual'].map(function (m) {
            const on = c.mode === m;
            const label = { local: '本地引擎（离线）', single: '单 API', dual: '双 API' }[m];
            return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" data-api-mode="' + m + '" aria-pressed="' + on + '">' +
              U.icon(m === 'local' ? 'cpu' : m === 'single' ? 'link' : 'layers', 'chip-ico') + label + '</button>';
          }).join('') +
        '</div>' +
        '<div class="alert" data-tone="cyan">' + U.icon('info') + '<div>' +
          '<b>路由规则</b>：剧情（story）始终走主 API；总结与变量（summary/vars）在双 API 模式下走次 API，可用更便宜的模型。' +
          '次 API 失败自动回退主 API，两者都失败且开启回退时使用本地叙事引擎。</div></div>' +
        (lastErr ? '<div class="alert" data-tone="red">' + U.icon('warn') + '<div><b>最近一次错误（' + U.esc(lastErr.target) + '）</b>：' + U.esc(lastErr.message) + '</div></div>' : '') +
        targetBlock('api-p', c.primary, '主 API · 剧情', 'OpenAI / DeepSeek / LM Studio / Ollama / vLLM / one-api 等任意 OpenAI 兼容端点均可。') +
        targetBlock('api-s', c.secondary, '次 API · 总结与变量', '启用后，<sum> 与 <vars> 由该模型生成（建议 temperature 0.3 以下、max_tokens 400 左右）。',
          '<div class="field"><span class="field-label">启用次 API</span><label class="chip"><input type="checkbox" id="api-s-enabled"' + (c.secondary.enabled ? ' checked' : '') + '> 在双 API 模式下启用</label></div>') +
        '<div class="tv-form">' +
          field('api-proxy', '代理前缀（可选，解决 CORS）', c.proxyPrefix, 'text', 'https://your-proxy.example.com/') +
          '<div class="field"><span class="field-label">失败回退本地引擎</span><label class="chip"><input type="checkbox" id="api-fallback"' + (c.fallbackLocal ? ' checked' : '') + '> 开启</label></div>' +
        '</div>' +
        '<div class="alert" data-tone="warn" style="margin-top:10px">' + U.icon('shield') + '<div>' +
          '<b>浏览器直连提醒</b>：从 <span class="mono">file://</span> 或纯静态站点直连第三方 API 常被 CORS 拦截，且 Key 会出现在浏览器里。' +
          '推荐指向本地服务（LM Studio <span class="mono">http://127.0.0.1:1234/v1</span> / Ollama <span class="mono">http://127.0.0.1:11434/v1</span> / vLLM），或填写自己的代理前缀。' +
          'Key 仅保存在本机 localStorage，不上传任何地方。</div></div>' +
        '<div class="inset" style="padding:12px;margin-top:12px">' +
          '<div class="sub-title">请求审计（最近 ' + audit.length + ' 条）</div>' +
          (audit.length ? '<div class="tv-audit">' + audit.map(function (a) {
            return '<div class="tv-audit-row" data-ok="' + a.ok + '">' +
              '<span class="mono">' + new Date(a.ts).toLocaleTimeString('zh-CN', { hour12: false }) + '</span>' +
              '<span class="tv-audit-task">' + U.esc(a.task) + '</span>' +
              '<span class="tv-audit-target">' + U.esc(a.target) + '</span>' +
              '<span class="mono tv-clamp">' + U.esc(a.model || '') + '</span>' +
              '<span class="mono">' + a.ms + 'ms</span>' +
              '<span class="' + (a.ok ? 'up' : 'down') + '">' + (a.ok ? '✓ ' + (a.chars || 0) + ' 字符' : '✗ ' + U.esc((a.error || '').slice(0, 40))) + '</span>' +
            '</div>';
          }).join('') + '</div>' : '<div class="tiny dim">暂无请求记录。</div>') +
        '</div>' +
      '</div>',
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-api-test-p">' + U.icon('bolt', 'icon-xs') + '测试主 API</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-api-test-s">' + U.icon('bolt', 'icon-xs') + '测试次 API</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-api-clear">' + U.icon('trash', 'icon-xs') + '清空密钥</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="btn-api-reset">重置默认</button>' +
      '<div class="spacer"></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-close="modal-tavern">取消</button>' +
      '<button type="button" class="btn btn-sm btn-primary" id="btn-api-save">保存并应用</button>');

    let curMode = c.mode;
    const body = U.$('#tavern-modal-body');
    body.addEventListener('click', function (e) {
      const m = e.target.closest('[data-api-mode]');
      if (!m) return;
      curMode = m.getAttribute('data-api-mode');
      U.$$('[data-api-mode]', body).forEach(function (x) { x.classList.toggle('is-selected', x === m); x.setAttribute('aria-pressed', x === m); });
    });
    function collect() {
      ES.api.setConfig({
        mode: curMode,
        proxyPrefix: U.$('#api-proxy').value.trim(),
        fallbackLocal: U.$('#api-fallback').checked,
        primary: {
          baseUrl: U.$('#api-p-base').value.trim(), model: U.$('#api-p-model').value.trim(),
          apiKey: U.$('#api-p-key').value.trim(), temperature: parseFloat(U.$('#api-p-temp').value) || 0.85,
          maxTokens: parseInt(U.$('#api-p-max').value, 10) || 1200, timeout: parseInt(U.$('#api-p-timeout').value, 10) || 90000,
          stream: U.$('#api-p-stream').checked, headers: U.$('#api-p-headers').value.trim(),
          noThinking: U.$('#api-p-nothink') ? U.$('#api-p-nothink').checked : false
        },
        secondary: {
          enabled: U.$('#api-s-enabled').checked,
          baseUrl: U.$('#api-s-base').value.trim(), model: U.$('#api-s-model').value.trim(),
          apiKey: U.$('#api-s-key').value.trim(), temperature: parseFloat(U.$('#api-s-temp').value) || 0.3,
          maxTokens: parseInt(U.$('#api-s-max').value, 10) || 400, timeout: parseInt(U.$('#api-s-timeout').value, 10) || 60000,
          stream: U.$('#api-s-stream').checked, headers: U.$('#api-s-headers').value.trim(),
          noThinking: U.$('#api-s-nothink') ? U.$('#api-s-nothink').checked : false
        }
      });
    }
    U.$('#btn-api-save').onclick = function () {
      collect(); ES.api.save(); renderSide(); U.closeModal('modal-tavern');
      if (ES.narrative.refreshEngineTag) ES.narrative.refreshEngineTag();
      U.toast({
        tone: ES.api.isEnabled() ? 'success' : 'info', icon: 'link',
        title: ES.api.isEnabled() ? 'API 已启用（' + (curMode === 'dual' ? '双 API' : '单 API') + '）' : '已切回本地引擎',
        msg: ES.api.isEnabled() ? '剧情走 ' + ES.api.config().primary.model + (curMode === 'dual' && ES.api.config().secondary.enabled ? ' · 结算走 ' + ES.api.config().secondary.model : '') : '不发起任何网络请求。'
      });
    };
    U.$('#btn-api-test-p').onclick = function () {
      collect(); ES.api.save();
      U.toast({ tone: 'info', title: '正在测试主 API…', msg: ES.api.urlFor(ES.api.config().primary) });
      ES.api.test('primary').then(function (r) {
        U.toast({ tone: r.ok ? 'success' : 'error', title: r.ok ? '主 API 可用 · ' + r.ms + 'ms' : '主 API 不可用', msg: r.ok ? ('返回样本：' + r.sample) : r.error, duration: 9000 });
        openApiModal();
      });
    };
    U.$('#btn-api-test-s').onclick = function () {
      collect(); ES.api.save();
      if (!ES.api.config().secondary.baseUrl) { U.toast({ tone: 'warn', title: '请先填写次 API 的 Base URL' }); return; }
      U.toast({ tone: 'info', title: '正在测试次 API…', msg: ES.api.urlFor(ES.api.config().secondary) });
      ES.api.test('secondary').then(function (r) {
        U.toast({ tone: r.ok ? 'success' : 'error', title: r.ok ? '次 API 可用 · ' + r.ms + 'ms' : '次 API 不可用', msg: r.ok ? ('返回样本：' + r.sample) : r.error, duration: 9000 });
        openApiModal();
      });
    };
    U.$('#btn-api-clear').onclick = function () {
      ES.api.clearKeys(); U.toast({ tone: 'info', title: '已清空本机保存的密钥' }); openApiModal();
    };
    U.$('#btn-api-reset').onclick = function () {
      ES.api.reset(); ES.api.save(); renderSide(); U.toast({ tone: 'info', title: '已重置为默认配置' }); openApiModal();
    };
  }

  function pickFile(accept, cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = function () {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = function () { try { cb(String(fr.result)); } catch (e) { U.toast({ tone: 'error', title: '导入失败', msg: String(e.message || e) }); } };
      fr.readAsText(f);
    };
    inp.click();
  }
  function exportBundle() {
    const bundle = {
      exportedAt: new Date().toISOString(),
      character: JSON.parse(exportCardJson()),
      lorebooks: db.books.map(function (b) { return JSON.parse(exportLorebook(b.id)); }),
      preset: JSON.parse(exportPresetJson()),
      floors: db.floors,
      variables: projectVars()
    };
    download('tavern-session.json', JSON.stringify(bundle, null, 2));
    U.toast({ tone: 'success', icon: 'save', title: '会话已导出', msg: '角色卡 + 世界书 + 预设 + 楼层 + 变量' });
  }


  /* ══════════ 对外 API ══════════ */
  return {
    mount: function (state) {
      S = state; load();
      if (!db.floors.length) greeting();
      try { buildContext('（会话开始）'); } catch (e) {}
      renderAll();
    },
    get state() { return db; },
    get uiMode() { return uiMode; },
    setMode: function (m) { uiMode = m; renderAll(); },
    isStreaming: function () { return streaming; },
    openLorebook: openLorebookModal, openApi: openApiModal, openPreset: openPresetModal, openCard: openCardModal,
    openContext: openContextModal, openVars: openVarsModal, openHistory: openHistoryModal,
    projectVars: projectVars, snapshot: snapshot, restore: restore,
    send: send, chooseOption: chooseOption, regenerate: regenerate, continueFloor: continueFloor,
    editFloor: editFloor, deleteFloor: deleteFloor, rollbackTo: rollbackTo, branchAt: branchAt, resignSession: resignSession, clearFloors: clearFloors,
    captureBlocks: captureBlocks, captureDeltas: captureDeltas, captureDice: captureDice,
    buildContext: buildContext, charCard: charCard, currentPreset: currentPreset, activeBooks: activeBooks,
    createLorebookEngine: createLorebookEngine, assemblePrompt: assemblePrompt,
    exportCardJson: exportCardJson, importCardJson: importCardJson,
    exportLorebook: exportLorebook, importLorebookJson: importLorebookJson,
    exportPresetJson: exportPresetJson, importPresetJson: importPresetJson, download: download,
    makeEntry: makeEntry, save: save,
    get lastContext() { return lastContext; },
    get floors() { return db.floors; },
    /* 引擎层导出（供联调与外部复用） */
    KEY: KEY, uid: uid, clone: clone, deepMerge: deepMerge, estimateTokens: estimateTokens,
    DEFAULT_TAGS: DEFAULT_TAGS, DEFAULT_OPAQUE: DEFAULT_OPAQUE, DEFAULT_FORMAT_PROMPT: DEFAULT_FORMAT_PROMPT,
    DEFAULT_PROMPT_ORDER: DEFAULT_PROMPT_ORDER, POSITIONS: POSITIONS, POS_LABEL: POS_LABEL,
    replaceMacros: replaceMacros, parseVarsBlock: parseVarsBlock, applyVarsPatch: applyVarsPatch,
    formatVariablesForPrompt: formatVariablesForPrompt, StreamTagParser: StreamTagParser, aggregate: aggregate,
    defaultPreset: defaultPreset
  };
})();

