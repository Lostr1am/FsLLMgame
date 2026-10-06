window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   建档向导（依据规则书第2章）
   11 步：难度 → 模式 → 出身 → 天赋觉醒(掷骰) → 基础档案 → 定位
          → 初始地点 → 时间线 → 俱乐部 → 开局导语 → 建档完成
   —— 天赋品质按 8.2 掷 1d100（白40/绿30/蓝18/紫9/金3）
   —— 俱乐部仅显示名称与文字信息（不使用任何图标/队标）
   ═══════════════════════════════════════════════════════════════ */
ES.creator = (function () {
  'use strict';
  const U = ES.util, D = ES.data;
  const TOTAL_STEPS = 11;
  const STEP_META = [
    { n: 1, name: '难度', icon: 'shield' }, { n: 2, name: '模式', icon: 'mask' }, { n: 3, name: '出身', icon: 'briefcase' },
    { n: 4, name: '天赋', icon: 'dna' }, { n: 5, name: '档案', icon: 'id' }, { n: 6, name: '定位', icon: 'crosshair' },
    { n: 7, name: '地点', icon: 'pin' }, { n: 8, name: '时间线', icon: 'calendar' }, { n: 9, name: '俱乐部', icon: 'building' },
    { n: 10, name: '导语', icon: 'scroll' }, { n: 11, name: '建档', icon: 'medal' }
  ];

  let step = 1;
  let setup = null;
  let rolling = false;
  let cityTab = 'cn';
  let clubRegion = 'CN';
  let clubTier = 'all';
  let maxSeenStep = 1;
  let pendingState = null;

  function blankSetup() {
    return {
      difficulty: null, mode: null, legendId: null, origin: null,
      talents: [], talentDirections: [], bodyId: null, ovrTarget: null, talentRollsLeft: 3,
      name: '', tag: '', gender: '男', age: 18, height: 175, look: 6,
      orientation: '尚未确定', loveStyle: '专一型', traits: [], catchphrase: '', sigil: 0, sign: '',
      positionId: null, city: null, timeline: null, clubId: null, openingChoice: null
    };
  }
  function diff() { return D.DIFFICULTIES.filter(function (d) { return d.id === setup.difficulty; })[0] || D.DIFFICULTIES[1]; }
  function origin() { return D.ORIGINS.filter(function (o) { return o.id === setup.origin; })[0] || null; }
  function position() { return D.POSITIONS.filter(function (p) { return p.id === setup.positionId; })[0] || null; }
  function legend() { return setup.mode === 'legend' ? D.LEGENDS.filter(function (l) { return l.id === setup.legendId; })[0] : null; }
  function clubDef() { return D.CLUBS.filter(function (c) { return c.id === setup.clubId; })[0] || null; }

  /* ── 选手印记（程序生成） ── */
  function sigilSvg(seed, color) {
    const rnd = U.makeRng(1000 + seed * 7919);
    const rot = Math.floor(rnd() * 90);
    const sides = 3 + Math.floor(rnd() * 4);
    const inner = 1 + Math.floor(rnd() * 2);
    const c = color || 'var(--accent)';
    let polys = '';
    for (let i = 0; i < inner; i++) {
      const r = 15 + i * 5.5;
      const pts = [];
      for (let s = 0; s < sides; s++) {
        const a = (Math.PI * 2 * s) / sides + (rot * Math.PI) / 180 + i * 0.4;
        pts.push((24 + Math.cos(a) * r).toFixed(1) + ',' + (24 + Math.sin(a) * r).toFixed(1));
      }
      polys += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="' + c + '" stroke-width="' + (1.6 - i * 0.4).toFixed(1) + '" opacity="' + (0.95 - i * 0.28).toFixed(2) + '"/>';
    }
    let dots = '';
    const dn = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < dn; i++) {
      const a = rnd() * Math.PI * 2, r = 4 + rnd() * 12;
      dots += '<circle cx="' + (24 + Math.cos(a) * r).toFixed(1) + '" cy="' + (24 + Math.sin(a) * r).toFixed(1) + '" r="' + (0.9 + rnd() * 1.3).toFixed(1) + '" fill="' + c + '"/>';
    }
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="none"/>' +
      '<polygon points="24,2 42,13 42,35 24,46 6,35 6,13" fill="none" stroke="' + c + '" stroke-width="1" opacity=".45"/>' +
      polys + dots + '</svg>';
  }

  /* ── 掷骰：天赋品质（8.2） ── */
  function rollQuality() {
    const r = U.randInt(1, 100);
    let acc = 0;
    for (let i = 0; i < D.QUALITY_ORDER.length; i++) {
      const q = D.QUALITIES[D.QUALITY_ORDER[i]];
      acc += q.pct;
      if (r <= acc) return { id: q.id, roll: r };
    }
    return { id: 'white', roll: r };
  }
  /* 体质觉醒（8.3 小概率） */
  function rollBody() {
    const r = U.randInt(1, 100);
    let acc = 0;
    for (let i = 0; i < D.BODIES.length; i++) {
      acc += D.BODIES[i].pct;
      if (r <= acc) return { id: D.BODIES[i].id, roll: r };
    }
    return null;
  }
  function rollTalents() {
    const count = U.randInt(3, 5);
    const dirs = setup.talentDirections.length ? setup.talentDirections.slice() : D.TALENT_DIRECTIONS.map(function (d) { return d.id; });
    const out = [];
    for (let i = 0; i < count; i++) {
      const dir = U.pick(dirs);
      let cands = D.TALENTS.filter(function (t) {
        return t.direction === dir && !out.some(function (o) { return o.id === t.id; });
      });
      if (!cands.length) cands = D.TALENTS.filter(function (t) { return !out.some(function (o) { return o.id === t.id; }); });
      const tpl = U.pick(cands);
      const q = rollQuality();
      out.push({ id: tpl.id, quality: q.id, roll: q.roll });
    }
    return out;
  }

  /* ── 属性预览（与 state.create 同口径，仅用于建档期展示） ── */
  function previewAttrs() {
    const tl = D.TIMELINES.filter(function (t) { return t.id === setup.timeline; })[0] || null;
    const lg = legend();
    const pos = position() || D.POSITIONS[0];
    const out = {};
    D.ATTRS.forEach(function (a) {
      let base;
      if (lg && lg.attrs[a.k] !== undefined) base = lg.attrs[a.k];
      else if (setup.mode === 'custom' && origin() && origin().attrs[a.k] !== undefined) base = origin().attrs[a.k];
      else base = 46;
      if (tl && tl.attrs && tl.attrs[a.k]) base += tl.attrs[a.k];
      if (setup.city && setup.city.attrs && setup.city.attrs[a.k]) base += setup.city.attrs[a.k];
      out[a.k] = base;
    });
    if (setup.origin && origin() && origin().ovrBonus) {
      Object.keys(pos.weights).forEach(function (k) { out[k] += Math.round(origin().ovrBonus / (pos.weights[k] * 5)); });
    }
    if (setup.mode === 'custom' && setup.ovrTarget) {
      const keyW = pos.key.reduce(function (a, k) { return a + pos.weights[k]; }, 0);
      const keyAvg = pos.key.reduce(function (a, k) { return a + out[k]; }, 0) / pos.key.length;
      const otherKeys = Object.keys(pos.weights).filter(function (k) { return pos.key.indexOf(k) < 0; });
      const otherAvg = otherKeys.length ? otherKeys.reduce(function (a, k) { return a + out[k]; }, 0) / otherKeys.length : keyAvg;
      const cur = keyAvg * keyW + otherAvg * (1 - keyW);
      const delta = setup.ovrTarget - cur;
      if (Math.abs(delta) > 0.5) Object.keys(pos.weights).forEach(function (k) { out[k] += delta; });
    }
    (setup.traits || []).forEach(function (tid) {
      const t = D.TRAITS.filter(function (x) { return x.id === tid; })[0];
      if (!t) return;
      Object.keys(t.mods).forEach(function (k) { if (out[k] !== undefined) out[k] += t.mods[k]; });
    });
    out.charisma += Math.round((setup.look - 5) * 1.4);
    out.luck = diff().mods.luck;
    let cap = 85;
    (setup.talents || []).forEach(function (t) {
      const q = D.QUALITIES[t.quality] || D.QUALITIES.white;
      cap = Math.max(cap, q.cap);
      const tpl = D.TALENTS.filter(function (x) { return x.id === t.id; })[0];
      if (tpl) Object.keys(tpl.eff).forEach(function (k) { if (out[k] !== undefined) out[k] += Math.round(tpl.eff[k] * q.mul); });
    });
    if (setup.bodyId) {
      const b = D.BODIES.filter(function (x) { return x.id === setup.bodyId; })[0];
      if (b) Object.keys(b.eff).forEach(function (k) { if (out[k] !== undefined) out[k] += b.eff[k]; });
      if (b && b.eff.reactionCap) cap = Math.max(cap, b.eff.reactionCap);
    }
    Object.keys(out).forEach(function (k) {
      const kCap = (setup.bodyId === 'radiant' && k === 'reaction') ? 99 : cap;
      out[k] = U.clamp(Math.round(out[k]), 5, kCap);
    });
    return { attrs: out, cap: cap };
  }
  function previewOvr() {
    const p = previewAttrs();
    const pos = position() || D.POSITIONS[0];
    const fake = {
      positionId: pos.id, attrs: p.attrs, statuses: [],
      res: { condition: 100, hand: 100 }, special: { cap: p.cap }, body: null
    };
    return ES.state.ovrDetail(fake);
  }

  /* ── 步骤渲染 ── */
  function renderSteps() {
    U.$('#creator-steps').innerHTML = STEP_META.map(function (s) {
      const state = s.n < step ? 'done' : s.n === step ? 'now' : (s.n <= maxSeenStep ? 'seen' : 'todo');
      return '<button type="button" class="step' + (state === 'now' ? ' is-active' : '') + (state === 'done' ? ' is-done' : '') +
        '" data-goto="' + s.n + '" aria-current="' + (state === 'now') + '" id="step-node-' + s.n + '"' + (state === 'todo' ? ' disabled' : '') + '>' +
        '<span class="step-no">' + U.pad2(s.n) + '</span><span class="step-name">' + U.esc(s.name) + '</span></button>';
    }).join('');
  }
  function renderMeta() {
    const d = setup.difficulty ? diff().name : '未选择';
    const m = setup.mode === 'legend' ? ('原著传奇 · ' + (legend() ? legend().name : '未选')) : setup.mode === 'custom' ? '自创角色' : '未选择';
    U.$('#creator-meta-diff').textContent = '难度 · ' + d;
    U.$('#creator-meta-mode').textContent = '模式 · ' + m;
    U.$('#creator-meta-diff').setAttribute('data-tone', setup.difficulty ? (setup.difficulty === 'cheat' ? 'red' : 'gold') : 'dim');
    U.$('#creator-meta-mode').setAttribute('data-tone', setup.mode ? 'cyan' : 'dim');
  }
  function renderFoot() {
    const err = validate(step);
    U.$('#btn-creator-prev').disabled = step <= 1;
    U.$('#btn-creator-next').innerHTML = step >= TOTAL_STEPS
      ? U.icon('check', 'icon-sm') + '进入主界面'
      : '下一步' + U.icon('arrow-r', 'icon-sm');
    U.$('#btn-creator-next').disabled = !!err;
    U.$('#creator-hint').textContent = err || stepHint(step);
    U.$('#creator-hint').setAttribute('data-tone', err ? 'red' : 'dim');
    U.$('#creator-step-label').textContent = '步骤 ' + step + ' / ' + TOTAL_STEPS + ' · ' + STEP_META[step - 1].name;
  }
  function stepHint(n) {
    const hints = {
      1: '难度决定初始总评区间、气运、天赋重掷次数与突破检定修正。',
      2: '原著传奇以现实选手的公开赛场形象开局，自创角色从零开始。',
      3: '出身决定初始属性结构、启动资金与开局人脉。',
      4: '天赋品质与数量由骰子决定（白 40% / 绿 30% / 蓝 18% / 紫 9% / 金 3%），不可自选。',
      5: '档案会出现在赛后采访、直播间弹幕、转会传闻与关系事件中。',
      6: '定位决定总评权重与关键属性：不同位置，同一套属性会算出不同的总评。',
      7: '地点提供训练环境系数（网吧 0.8 / 自租房 1.0 / 普通基地 1.15 / 顶级基地 1.25）。',
      8: '时间线决定起始年份、赛区格局与可触发的剧情节点（阵容以附录Q 年表为准）。',
      9: '选择你要加入（或试训）的俱乐部——只列名称与文字资料，不含任何队标。',
      10: '叙事引擎会依据档案生成开局导语与首批选项。',
      11: '总评、属性上限、身价与合同都由公式计算，面板与公式永远一致。'
    };
    return hints[n] || '';
  }
  function validate(n) {
    if (n >= 2 && !setup.difficulty) return '请先选择难度';
    if (n >= 3 && !setup.mode) return '请选择开局模式';
    if (n >= 3 && setup.mode === 'legend' && !setup.legendId) return '请选择要扮演的传奇选手';
    if (n >= 4 && !setup.origin) return '请选择出身';
    if (n >= 5 && !setup.talents.length) return '请先掷骰完成天赋觉醒';
    if (n >= 6) {
      if (!setup.name || setup.name.length < 2) return '请填写姓名（至少 2 字）';
      if (!/^[A-Za-z0-9_\-]{3,12}$/.test(setup.tag)) return '选手 ID 需为 3-12 位英文 / 数字 / 下划线';
      if (!setup.traits.length) return '请至少选择 1 项性格';
    }
    if (n >= 7 && !setup.positionId) return '请选择主位置（定位）';
    if (n >= 8 && !setup.city) return '请选择初始地点';
    if (n >= 9 && !setup.timeline) return '请选择时间线';
    if (n >= 10 && !setup.clubId) return '请选择俱乐部';
    return '';
  }

  /* ── 1 难度 ── */
  function renderDifficulty() {
    U.$('#grid-difficulty').innerHTML = D.DIFFICULTIES.map(function (d) {
      const on = setup.difficulty === d.id;
      return '<button type="button" class="card diff-card tilt' + (on ? ' is-selected' : '') + '" data-diff="' + d.id + '" role="radio" aria-checked="' + on + '" id="card-diff-' + d.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head">' +
        '<span class="card-glyph">' + U.icon(d.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + U.esc(d.tier) + '</div><div class="card-title">' + U.esc(d.name) + '</div></div>' +
        '<span class="diff-sigil" aria-hidden="true">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= d.sigil ? 'on' : '') + '"></i>'; }).join('') + '</span>' +
        '</div>' +
        '<div class="card-sub" style="margin-bottom:10px">' + U.esc(d.tagline) + '</div>' +
        '<div class="card-body">' + U.esc(d.desc) + '</div>' +
        '<div class="mod-list">' +
        d.pros.map(function (p) { return '<div class="mod-row"><span class="k">增益</span><span class="v pos">' + U.esc(p) + '</span></div>'; }).join('') +
        d.cons.map(function (p) { return '<div class="mod-row"><span class="k">代价</span><span class="v neg">' + U.esc(p) + '</span></div>'; }).join('') +
        '</div></button>';
    }).join('');
  }

  /* ── 2 模式 ── */
  function renderMode() {
    U.$('#grid-mode').innerHTML = D.MODES.map(function (m) {
      const on = setup.mode === m.id;
      return '<button type="button" class="card tilt' + (on ? ' is-selected' : '') + '" data-mode="' + m.id + '" role="radio" aria-checked="' + on + '" id="card-mode-' + m.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head"><span class="card-glyph">' + U.icon(m.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + U.esc(m.badge) + '</div><div class="card-title">' + U.esc(m.name) + '</div></div></div>' +
        '<div class="card-sub" style="margin-bottom:10px">' + U.esc(m.tagline) + '</div>' +
        '<div class="card-body">' + U.esc(m.desc) + '</div>' +
        '<div class="mod-list">' +
        m.pros.map(function (p) { return '<div class="mod-row"><span class="k">优势</span><span class="v pos">' + U.esc(p) + '</span></div>'; }).join('') +
        m.cons.map(function (p) { return '<div class="mod-row"><span class="k">限制</span><span class="v neg">' + U.esc(p) + '</span></div>'; }).join('') +
        '</div></button>';
    }).join('');

    const wrap = U.$('#legend-templates-wrap');
    wrap.classList.toggle('hidden', setup.mode !== 'legend');
    if (setup.mode !== 'legend') return;
    U.$('#grid-legend').innerHTML = D.LEGENDS.map(function (l) {
      const on = setup.legendId === l.id;
      return '<button type="button" class="card tilt' + (on ? ' is-selected' : '') + '" data-legend="' + l.id + '" role="radio" aria-checked="' + on + '" id="card-legend-' + l.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head"><span class="card-glyph">' + U.icon(l.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + U.esc(l.role) + ' · 巅峰 ' + l.peak + '</div><div class="card-title">' + U.esc(l.name) + '</div>' +
        '<div class="card-sub mono">' + U.esc(l.short) + '</div></div></div>' +
        '<div class="card-body">' + U.esc(l.desc) + '</div>' +
        '<div class="mod-list">' +
        '<div class="mod-row"><span class="k">本命</span><span class="v">' + U.esc(l.agent) + '</span></div>' +
        '<div class="mod-row"><span class="k">荣誉</span><span class="v">' + U.esc(l.honor) + '</span></div>' +
        '<div class="mod-row"><span class="k">随身</span><span class="v">' + U.esc(l.item) + '</span></div>' +
        '<div class="mod-row"><span class="k">标签</span><span class="v">' + U.esc(l.tags.join(' · ')) + '</span></div>' +
        '</div></button>';
    }).join('');
  }

  /* ── 3 出身 ── */
  function renderOrigin() {
    U.$('#grid-origin').innerHTML = D.ORIGINS.map(function (o) {
      const on = setup.origin === o.id;
      return '<button type="button" class="card origin-card tilt' + (on ? ' is-selected' : '') + '" data-origin="' + o.id + '" role="radio" aria-checked="' + on + '" id="card-origin-' + o.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head"><span class="card-glyph">' + U.icon(o.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + U.esc(o.tier) + '</div><div class="card-title">' + U.esc(o.name) + '</div></div></div>' +
        '<div class="card-sub" style="margin-bottom:8px">' + U.esc(o.tagline) + '</div>' +
        '<div class="card-body">' + U.esc(o.desc) + '</div>' +
        '</button>';
    }).join('');
    const o = origin();
    if (o) {
      U.$('#origin-compare-table').innerHTML =
        '<caption>出身对照 · ' + U.esc(o.name) + '</caption>' +
        '<thead><tr><th>项目</th><th>数值</th><th>说明</th></tr></thead><tbody>' +
        '<tr><td>启动资金</td><td class="num">¥' + U.fmtNum(o.money) + '</td><td>建档时的可用现金</td></tr>' +
        '<tr><td>初始粉丝</td><td class="num">' + o.fans + ' 万</td><td>影响人气系数与身价</td></tr>' +
        '<tr><td>竞技状态</td><td class="num">' + o.res.condition + '</td><td>低于 40 时全项判定减益</td></tr>' +
        '<tr><td>手部健康</td><td class="num">' + o.res.hand + '</td><td>低于 40 时枪法 / 反应 -5</td></tr>' +
        '<tr><td>总评加成</td><td class="num">' + (o.ovrBonus >= 0 ? '+' : '') + o.ovrBonus + '</td><td>直接计入五项评定属性</td></tr>' +
        '<tr><td>成长线</td><td colspan="2">' + U.esc(o.storyLine) + '</td></tr>' +
        '</tbody>';
    } else {
      U.$('#origin-compare-table').innerHTML = '<caption>出身对照</caption><tbody><tr><td class="dim">选择出身后显示对照数据</td></tr></tbody>';
    }
  }

  /* ── 4 天赋觉醒 ── */
  function renderTalentDirs() {
    U.$('#talent-directions').innerHTML = D.TALENT_DIRECTIONS.map(function (d) {
      const on = setup.talentDirections.indexOf(d.id) >= 0;
      return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" data-dir="' + d.id + '" aria-pressed="' + on + '" data-tip="' + U.esc(d.desc) + '" id="chip-dir-' + d.id + '">' +
        U.icon(d.icon, 'chip-ico') + U.esc(d.name) + '</button>';
    }).join('');
    U.$('#talent-rolls-left').textContent = '剩余重掷 ' + setup.talentRollsLeft;
    U.$('#talent-roll-readout').textContent = setup.talentDirections.length
      ? '已选倾向：' + setup.talentDirections.map(function (id) {
        const d = D.TALENT_DIRECTIONS.filter(function (x) { return x.id === id; })[0];
        return d ? d.name : id;
      }).join(' / ') + ' · 掷骰数量 3—5 个'
      : '品质权重组：白 40% / 绿 30% / 蓝 18% / 紫 9% / 金 3%（数量 3—5 个由骰子决定）';
    U.$('#btn-talent-roll-label').textContent = setup.talents.length ? '重新掷骰觉醒' : '掷骰觉醒天赋';
    U.$('#btn-talent-roll').disabled = rolling || (setup.talents.length > 0 && setup.talentRollsLeft <= 0);
    U.$('#talent-locked-tag').classList.toggle('hidden', !setup.talents.length);
  }
  function renderTalentPool() {
    const host = U.$('#talent-pool');
    if (!setup.talents.length) {
      host.innerHTML = '<div class="empty">' + U.icon('dna', 'icon-lg') + '<div>尚未觉醒天赋</div><div class="tiny dim">返回第 4 步掷骰，或使用「随机建档」自动生成。</div></div>';
      U.$('#talent-detail-host').innerHTML = '<div class="empty tiny dim" id="talent-detail-empty">天赋一经定型不可更改，但可通过剧情进化。</div>';
      return;
    }
    host.innerHTML = setup.talents.map(function (t, i) {
      const tpl = D.TALENTS.filter(function (x) { return x.id === t.id; })[0];
      const q = D.QUALITIES[t.quality];
      return '<button type="button" class="talent-item' + ' is-selected" data-rarity="' + t.quality + '" data-talent-idx="' + i + '" aria-pressed="true" id="talent-item-' + i + '">' +
        U.icon(tpl.icon, 'talent-ico') +
        '<span class="talent-body"><span class="talent-name">' + U.esc(tpl.name) + '</span>' +
        '<span class="talent-desc">' + U.esc(tpl.desc) + '</span></span>' +
        '<span class="talent-badge" data-rarity="' + t.quality + '">' + U.esc(q.name) + '</span></button>';
    }).join('');
    /* 体质 */
    const bodyHost = U.$('#talent-detail-host');
    if (setup.bodyId) {
      const b = D.BODIES.filter(function (x) { return x.id === setup.bodyId; })[0];
      bodyHost.innerHTML = '<div class="row-tight" style="align-items:flex-start;gap:12px">' + U.icon(b.icon, 'icon-lg') +
        '<div><div class="row-tight"><b>' + U.esc(b.name) + '</b><span class="tag" data-tone="gold">体质觉醒</span></div>' +
        '<div class="small dim-2" style="margin-top:6px">' + U.esc(b.desc) + '</div></div></div>';
    } else {
      bodyHost.innerHTML = '<div class="row-tight" style="gap:12px">' + U.icon('dna', 'icon-lg') +
        '<div><b>本次未觉醒特殊体质</b><div class="small dim-2" style="margin-top:6px">体质为骰子小概率觉醒（辐能亲和 2% / 比赛型 6% / 大心脏 6%…），不影响天赋品质。</div></div></div>';
    }
  }
  function rollTalent() {
    if (rolling) return;
    if (setup.talents.length && setup.talentRollsLeft <= 0) {
      U.toast({ tone: 'warn', title: '没有重掷机会了', msg: diff().name + '难度不提供额外重掷。' });
      return;
    }
    if (setup.talents.length) setup.talentRollsLeft--;
    rolling = true;
    ES.audio.play('dice');
    const num = U.$('#talent-dice-num'), core = U.$('#talent-dice-core');
    core.classList.add('is-rolling');
    let ticks = 0;
    const timer = setInterval(function () {
      num.textContent = U.randInt(1, 100);
      ticks++;
      if (ticks < 16) return;
      clearInterval(timer);
      core.classList.remove('is-rolling');
      const rolled = rollTalents();
      num.textContent = rolled.length + ' 个';
      setup.talents = rolled;
      setup.bodyId = rollBody() ? rollBodySafe() : null;
      rolling = false;
      ES.audio.play('levelup');
      renderTalentDirs(); renderTalentPool(); renderFoot(); updatePreview();
      const golds = rolled.filter(function (t) { return t.quality === 'gold'; }).length;
      const purples = rolled.filter(function (t) { return t.quality === 'purple'; }).length;
      U.toast({
        tone: golds ? 'gold' : purples ? 'info' : 'info',
        title: '天赋觉醒完成：' + rolled.length + ' 个天赋',
        msg: rolled.map(function (t) {
          const tpl = D.TALENTS.filter(function (x) { return x.id === t.id; })[0];
          return tpl.name + '（' + D.QUALITIES[t.quality].name + '）';
        }).join(' · ')
      });
    }, 55);
  }
  function rollBodySafe() {
    const r = U.randInt(1, 100);
    let acc = 0;
    for (let i = 0; i < D.BODIES.length; i++) {
      acc += D.BODIES[i].pct;
      if (r <= acc) return D.BODIES[i].id;
    }
    return null;
  }

  /* ── 5 档案 ── */
  function renderProfileStatics() {
    U.$('#profile-gender').innerHTML = D.GENDERS.map(function (g) {
      return '<button type="button" class="chip" data-gender="' + U.esc(g) + '" aria-pressed="' + (setup.gender === g) + '" id="chip-gender-' + g + '">' + U.esc(g) + '</button>';
    }).join('');
    U.$('#profile-orientation').innerHTML = D.ORIENTATIONS.map(function (g) {
      return '<button type="button" class="chip" data-orient="' + U.esc(g) + '" aria-pressed="' + (setup.orientation === g) + '" id="chip-orient-' + U.esc(g) + '">' + U.esc(g) + '</button>';
    }).join('');
    U.$('#profile-love').innerHTML = D.LOVE_STYLES.map(function (g) {
      return '<button type="button" class="chip" data-love="' + U.esc(g) + '" aria-pressed="' + (setup.loveStyle === g) + '" id="chip-love-' + U.esc(g) + '">' + U.esc(g) + '</button>';
    }).join('');
    U.$('#profile-traits').innerHTML = D.TRAITS.map(function (t) {
      const on = setup.traits.indexOf(t.id) >= 0;
      return '<button type="button" class="chip" data-trait="' + t.id + '" aria-pressed="' + on + '" id="chip-trait-' + t.id + '" data-tip="' + U.esc(t.desc) + '">' + U.icon(t.icon, 'chip-ico') + U.esc(t.name) + '</button>';
    }).join('');
    U.$('#profile-catchphrase').innerHTML = D.CATCHPHRASES.map(function (c) {
      return '<button type="button" class="chip" data-catch="' + U.esc(c) + '" aria-pressed="' + (setup.catchphrase === c) + '" id="chip-catch-' + U.esc(c) + '">' + U.esc(c) + '</button>';
    }).join('');
    U.$('#sigil-picker').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
      return '<button type="button" class="sigil-choice' + (setup.sigil === i ? ' is-selected' : '') + '" data-sigil="' + i + '" role="radio" aria-checked="' + (setup.sigil === i) + '" aria-label="选手印记 ' + (i + 1) + '" id="sigil-choice-' + i + '">' + sigilSvg(i) + '</button>';
    }).join('');

    /* 事件只绑定一次（本函数在 mount 与每次 goto 时都会执行） */
    if (U.$('#profile-traits').__esBound) return;
    U.$('#profile-traits').__esBound = true;
    U.$('#profile-gender').addEventListener('click', function (e) {
      const c = e.target.closest('[data-gender]'); if (!c) return;
      setup.gender = c.getAttribute('data-gender'); ES.audio.play('click');
      U.$$('#profile-gender .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      updatePreview();
    });
    U.$('#profile-orientation').addEventListener('click', function (e) {
      const c = e.target.closest('[data-orient]'); if (!c) return;
      setup.orientation = c.getAttribute('data-orient'); ES.audio.play('click');
      U.$$('#profile-orientation .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      updatePreview();
    });
    U.$('#profile-love').addEventListener('click', function (e) {
      const c = e.target.closest('[data-love]'); if (!c) return;
      setup.loveStyle = c.getAttribute('data-love'); ES.audio.play('click');
      U.$$('#profile-love .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
    });
    U.$('#profile-traits').addEventListener('click', function (e) {
      const c = e.target.closest('[data-trait]'); if (!c) return;
      const id = c.getAttribute('data-trait');
      const i = setup.traits.indexOf(id);
      if (i >= 0) setup.traits.splice(i, 1);
      else {
        if (setup.traits.length >= 3) { U.toast({ tone: 'warn', title: '最多选择 3 项性格', msg: '性格会相互叠加，也会相互冲突。' }); return; }
        setup.traits.push(id);
      }
      ES.audio.play('click');
      U.$$('#profile-traits .chip').forEach(function (x) { x.setAttribute('aria-pressed', setup.traits.indexOf(x.getAttribute('data-trait')) >= 0 ? 'true' : 'false'); });
      updatePreview();
    });
    U.$('#profile-catchphrase').addEventListener('click', function (e) {
      const c = e.target.closest('[data-catch]'); if (!c) return;
      const v = c.getAttribute('data-catch');
      setup.catchphrase = setup.catchphrase === v ? '' : v;
      U.$('#input-profile-catch').value = setup.catchphrase;
      ES.audio.play('click');
      U.$$('#profile-catchphrase .chip').forEach(function (x) { x.setAttribute('aria-pressed', setup.catchphrase === x.getAttribute('data-catch') ? 'true' : 'false'); });
    });
    U.$('#sigil-picker').addEventListener('click', function (e) {
      const c = e.target.closest('[data-sigil]'); if (!c) return;
      setup.sigil = parseInt(c.getAttribute('data-sigil'), 10);
      ES.audio.play('click');
      U.$$('#sigil-picker .sigil-choice').forEach(function (x) { x.classList.toggle('is-selected', x === c); });
      updatePreview();
    });
  }
  function validateId(v) { return /^[A-Za-z0-9_\-]{3,12}$/.test(v); }
  function checkIdField() {
    const node = U.$('#id-check'), input = U.$('#input-profile-id');
    if (!setup.tag) { node.textContent = ''; node.className = 'id-check'; input.classList.remove('input-ok', 'input-bad'); return; }
    if (validateId(setup.tag)) {
      node.className = 'id-check ok'; node.innerHTML = U.icon('check', 'icon-xs') + '可用';
      input.classList.add('input-ok'); input.classList.remove('input-bad');
    } else {
      node.className = 'id-check bad'; node.innerHTML = U.icon('warn', 'icon-xs') + '3-12 位英文 / 数字 / 下划线';
      input.classList.add('input-bad'); input.classList.remove('input-ok');
    }
  }
  function ageHint(v) {
    if (v <= 17) return v + ' 岁：天才少年的年龄，反应与悟性处于峰值，但受未成年人保护条款限制';
    if (v <= 19) return v + ' 岁：青训黄金年龄，手感与反应处于峰值';
    if (v <= 22) return v + ' 岁：巅峰区间，心态与意识开始成熟';
    if (v <= 25) return v + ' 岁：巅峰尾段，反应每年 -1—2，靠意识弥补';
    return v + ' 岁：老将阶段，反应明显下滑，但指挥与心理价值极高';
  }
  function updatePreview() {
    const p = previewAttrs();
    const lv = setup.positionId ? previewOvr() : null;
    U.$('#profile-sigil-preview').innerHTML = sigilSvg(setup.sigil);
    U.$('#profile-preview-name').textContent = setup.name || '待命名';
    const lg = legend();
    U.$('#profile-preview-meta').textContent = (setup.tag || 'ID') + ' · ' + setup.age + ' 岁 · ' + setup.height + ' cm · 外貌 ' + setup.look +
      (lg ? ' · ' + lg.short : '') + (clubDef() ? ' · ' + clubDef().short : '');
    const tags = [];
    if (setup.difficulty) tags.push('<span class="tag" data-tone="' + (setup.difficulty === 'cheat' ? 'red' : 'gold') + '">' + U.esc(diff().name) + '</span>');
    if (setup.mode) tags.push('<span class="tag" data-tone="cyan">' + U.esc(setup.mode === 'legend' ? '原著传奇' : '自创角色') + '</span>');
    if (setup.origin) tags.push('<span class="tag" data-tone="violet">' + U.esc(origin().name) + '</span>');
    if (setup.positionId) tags.push('<span class="tag" data-tone="cyan">' + U.esc(position().name) + '</span>');
    if (setup.city) tags.push('<span class="tag">' + U.esc(setup.city.name) + '</span>');
    if (setup.timeline) tags.push('<span class="tag">' + U.esc(setup.timeline.name) + '</span>');
    if (clubDef()) tags.push('<span class="tag">' + U.esc(clubDef().name) + '</span>');
    U.$('#profile-preview-tags').innerHTML = tags.join('');

    const mods = [];
    (setup.traits || []).forEach(function (tid) {
      const t = D.TRAITS.filter(function (x) { return x.id === tid; })[0];
      if (!t) return;
      const line = Object.keys(t.mods).map(function (k) {
        return ES.state.labelOf(k) + ' ' + (t.mods[k] > 0 ? '+' : '') + t.mods[k];
      }).join('、');
      mods.push('<div><b>' + U.esc(t.name) + '</b>：' + U.esc(line) + '</div>');
    });
    if (lv) {
      mods.push('<div style="margin-top:8px"><b>总评演算（' + U.esc(position().name) + '）</b>：' +
        lv.parts.map(function (x) { return U.esc(x.name) + ' ' + x.v + '×' + Math.round(x.w * 100) + '%'; }).join(' + ') +
        ' = ' + lv.base.toFixed(1) + (lv.bonus ? ' ＋加成 ' + lv.bonus : '') + (lv.penalty ? ' －短板 ' + lv.penalty : '') +
        ' → <b class="acc">总评 ' + lv.total + '（' + lv.level.name + '）</b></div>');
    }
    U.$('#profile-trait-mod').innerHTML = U.icon('info') + '<div>' + (mods.length ? mods.join('') : '性格与外貌会实时换算为初始属性修正，选择后在此预览。') + '</div>';
    /* 初始总评取点 */
    const ovrWrap = U.$('#ovr-target-wrap');
    if (ovrWrap) {
      const isCustom = setup.mode === 'custom';
      ovrWrap.classList.toggle('hidden', !isCustom);
      if (isCustom) {
        const d = diff();
        const input = U.$('#input-ovr-target');
        input.min = d.mods.ovrMin; input.max = d.mods.ovrMax;
        if (!setup.ovrTarget) setup.ovrTarget = Math.round((d.mods.ovrMin + d.mods.ovrMax) / 2);
        if (setup.ovrTarget < d.mods.ovrMin || setup.ovrTarget > d.mods.ovrMax) setup.ovrTarget = Math.round((d.mods.ovrMin + d.mods.ovrMax) / 2);
        input.value = setup.ovrTarget;
        U.$('#val-ovr-target').textContent = '总评 ' + setup.ovrTarget;
        U.$('#ovr-target-hint').textContent = '当前难度允许区间：' + d.mods.ovrMin + '—' + d.mods.ovrMax + '（其余成长靠训练与比赛）';
      }
    }
  }

  /* ── 6 定位 ── */
  function renderPosition() {
    U.$('#grid-position').innerHTML = D.POSITIONS.map(function (p) {
      const on = setup.positionId === p.id;
      return '<button type="button" class="card tilt' + (on ? ' is-selected' : '') + '" data-position="' + p.id + '" role="radio" aria-checked="' + on + '" id="card-position-' + p.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head"><span class="card-glyph">' + U.icon(p.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + U.esc(p.short) + ' · ' + U.esc(p.tag) + '</div><div class="card-title">' + U.esc(p.name) + '</div></div></div>' +
        '<div class="card-body">' + U.esc(p.desc) + '</div>' +
        '<div class="mod-list">' +
        Object.keys(p.weights).map(function (k) {
          const a = D.ATTRS.filter(function (x) { return x.k === k; })[0];
          const isKey = p.key.indexOf(k) >= 0;
          return '<div class="mod-row"><span class="k">' + U.esc(a.name) + (isKey ? ' ★' : '') + '</span><span class="v">' + Math.round(p.weights[k] * 100) + '%</span></div>';
        }).join('') +
        '<div class="mod-row"><span class="k">关键属性</span><span class="v">' + p.key.map(function (k) { return D.ATTRS.filter(function (x) { return x.k === k; })[0].name; }).join(' / ') + '</span></div>' +
        '</div>' +
        '<div class="tiny dim-2" style="margin-top:8px">可选特工：' + U.esc(p.agents.join('、')) + '</div>' +
        '</button>';
    }).join('');
    const p = position();
    U.$('#position-detail-host').innerHTML = p
      ? '<div class="inset corner-marks" style="padding:14px"><div class="row-tight" style="justify-content:space-between"><b>' + U.esc(p.name) + ' · 总评权重表</b>' +
      '<span class="tag" data-tone="cyan">' + U.esc(p.agents.join(' / ')) + '</span></div>' +
      '<div class="small dim-2" style="margin-top:8px">总评 = ' + Object.keys(p.weights).map(function (k) {
        const a = D.ATTRS.filter(function (x) { return x.k === k; })[0];
        return a.name + '×' + Math.round(p.weights[k] * 100) + '%';
      }).join(' ＋ ') + ' ＋ 关键属性加成 － 短板惩罚</div>' +
      '<div class="small dim-2" style="margin-top:6px">关键属性（' + p.key.map(function (k) { return D.ATTRS.filter(function (x) { return x.k === k; })[0].name; }).join('、') + '）双项 ≥85 加 +2 / ≥90 加 +3 / ≥95 加 +5；任一 <50 减 -1 / <40 减 -2 / <30 减 -3。</div></div>'
      : '<div class="inset tiny dim" style="padding:14px">选择后显示该位置的总评权重与关键属性规则。</div>';
  }

  /** 当前时间线对应的阵容年份（与 state.rosterYearFor 同口径） */
  function currentRosterYear() {
    const r = String((setup.timeline && setup.timeline.roster) || '2025');
    if (r.indexOf('2026') === 0) return '2026';
    if (r === '2023') return '2024（建队基准）';
    return r;
  }

  /* ── 7 地点 ── */
  function renderCities() {
    function card(c) {
      const on = setup.city && setup.city.id === c.id;
      return '<button type="button" class="card city-card tilt' + (on ? ' is-selected' : '') + '" data-city="' + c.id + '" role="radio" aria-checked="' + on + '" id="card-city-' + c.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head"><span class="card-glyph">' + U.icon(c.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + U.esc(c.region) + '</div><div class="card-title">' + U.esc(c.name) + '</div></div></div>' +
        '<div class="bar-list">' +
        [['生态', c.bars.eco], ['训练', c.bars.train], ['网络', c.bars.net], ['成本', c.bars.cost]].map(function (b) {
          return '<div class="bar-row"><span class="bar-k">' + b[0] + '</span><span class="bar"><i style="width:' + (b[1] * 10) + '%"></i></span></div>';
        }).join('') +
        '</div>' +
        '<div class="card-body" style="margin-top:8px">' + U.esc(c.perk) + '</div>' +
        '</button>';
    }
    U.$('#grid-city-cn').innerHTML = D.CITIES_CN.map(card).join('');
    U.$('#grid-city-global').innerHTML = D.CITIES_GLOBAL.map(card).join('');
    const c = setup.city;
    U.$('#city-detail-host').innerHTML = c
      ? '<div class="inset corner-marks" style="padding:16px"><div class="row-tight" style="justify-content:space-between">' +
      '<b>' + U.esc(c.name) + ' · ' + U.esc(c.region) + '</b><span class="tag" data-tone="cyan">环境系数 ' +
      ({ netcafe: '0.8', rent: '1.0', normal: '1.15', top: '1.25' }[diff().mods.envBase] || '1.0') + '</span></div>' +
      '<div class="small" style="margin-top:8px;color:var(--green)">优势 · ' + U.esc(c.perk) + '</div>' +
      '<div class="small" style="margin-top:6px;color:var(--red)">代价 · ' + U.esc(c.cons) + '</div>' +
      '<div class="tiny dim-2" style="margin-top:8px">属性修正：' + (Object.keys(c.attrs).length ? Object.keys(c.attrs).map(function (k) { return ES.state.labelOf(k) + ' ' + (c.attrs[k] > 0 ? '+' : '') + c.attrs[k]; }).join('、') : '无') +
      ' · 资金修正：' + (c.res.money ? (c.res.money > 0 ? '+' : '') + U.fmtNum(c.res.money) : '0') + '</div></div>'
      : '<div class="inset tiny dim" style="padding:16px">选择城市后显示属性修正、生活成本与训练环境系数。</div>';
  }

  /* ── 8 时间线 ── */
  function renderTimeline() {
    U.$('#grid-timeline').innerHTML = D.TIMELINES.map(function (t) {
      const on = setup.timeline && setup.timeline.id === t.id;
      return '<button type="button" class="card timeline-card tilt' + (on ? ' is-selected' : '') + '" data-timeline="' + t.id + '" role="radio" aria-checked="' + on + '" id="card-timeline-' + t.id + '">' +
        '<span class="card-select-mark">' + U.icon('check') + '</span>' +
        '<div class="card-head"><span class="card-glyph">' + U.icon(t.icon, 'icon-lg') + '</span>' +
        '<div class="grow"><div class="diff-tier">' + t.year + ' · ' + U.esc(t.season) + ' · ' + U.esc(t.tier) + '</div><div class="card-title">' + U.esc(t.name) + '</div></div></div>' +
        '<div class="card-sub" style="margin-bottom:8px">' + U.esc(t.tagline) + '</div>' +
        '<div class="card-body">' + U.esc(t.note) + '</div>' +
        '</button>';
    }).join('');
    const t = setup.timeline;
    U.$('#timeline-detail-host').innerHTML = t
      ? '<div class="inset corner-marks" style="padding:16px"><div class="row-tight" style="justify-content:space-between">' +
      '<b>' + U.esc(t.name) + ' · ' + t.year + ' 年 ' + U.pad2(t.month) + ' 月</b><span class="tag" data-tone="cyan">阵容基准 ' + U.esc(String(t.roster)) + '</span></div>' +
      '<div class="quote" style="margin-top:10px">' + U.esc(t.quote) + '</div>' +
      '<div class="tiny dim-2" style="margin-top:8px">起始节点：' + U.esc(t.startNode) + ' · 阶段：' + U.esc(t.phase) + ' · 属性修正：' +
      (Object.keys(t.attrs).length ? Object.keys(t.attrs).map(function (k) { return ES.state.labelOf(k) + ' ' + (t.attrs[k] > 0 ? '+' : '') + t.attrs[k]; }).join('、') : '无') + '</div></div>'
      : '<div class="inset tiny dim" style="padding:16px">选择时间线后显示起始年份、阵容基准与属性修正。</div>';
  }

  /* ── 9 俱乐部（仅名称，不含图标） ── */
  function renderClub() {
    const cur = clubDef();
    /* 选中的俱乐部若不在当前赛区页，自动切到它的赛区，避免「列表与详情对不上」 */
    if (cur && cur.region !== clubRegion) clubRegion = cur.region;
    const tabs = ['CN', '太平洋', '美洲', 'EMEA'];
    U.$('#club-region-tabs').innerHTML = tabs.map(function (r) {
      const n = D.CLUBS.filter(function (c) { return c.region === r; }).length;
      return '<button class="tab" type="button" role="tab" aria-selected="' + (clubRegion === r) + '" data-club-region="' + r + '" id="tab-club-' + r + '">' + r + ' · ' + n + ' 支</button>';
    }).join('');
    let list = D.CLUBS.filter(function (c) { return c.region === clubRegion; });
    if (clubTier !== 'all') list = list.filter(function (c) { return c.tier === clubTier; });
    U.$('#club-tier-filter').innerHTML = ['all', 'T0', 'T1'].map(function (x) {
      const on = clubTier === x;
      const label = { all: '全部', T0: 'T0 豪门', T1: 'T1 / 强队' }[x];
      return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" data-club-tier="' + x + '" aria-pressed="' + on + '" id="chip-club-tier-' + x + '">' + label + '</button>';
    }).join('');
    U.$('#club-name-list').innerHTML = list.map(function (c) {
      const on = setup.clubId === c.id;
      return '<button type="button" class="club-name' + (on ? ' is-selected' : '') + '" data-club="' + c.id + '" role="radio" aria-checked="' + on + '" id="club-name-' + c.id + '">' +
        '<span class="club-name-main">' + U.esc(c.name) + '</span>' +
        '<span class="club-name-meta">' + U.esc(c.short) + ' · ' + U.esc(c.city) + ' · ' + U.esc(c.tier) + '</span>' +
        '</button>';
    }).join('') || '<div class="empty tiny dim">该筛选下没有俱乐部</div>';
    const c = clubDef();
    U.$('#club-detail-host').innerHTML = c
      ? '<div class="inset corner-marks" style="padding:16px">' +
      '<div class="row-tight" style="justify-content:space-between;align-items:flex-start">' +
      '<div><b style="font-size:16px">' + U.esc(c.name) + '</b><div class="tiny dim-2 mono" style="margin-top:4px">' + U.esc(c.short) + ' · ' + U.esc(c.region) + ' 赛区 · ' + U.esc(c.city) + ' · ' + U.esc(c.tier) + ' · ' + U.esc(c.seat) + '</div></div>' +
      '<span class="tag" data-tone="' + (c.tier === 'T0' ? 'gold' : 'cyan') + '">' + U.esc(c.env) + '</span></div>' +
      '<div class="small" style="margin-top:10px">' + U.esc(c.style) + '</div>' +
      '<div class="small" style="margin-top:8px"><span class="dim">2025 阵容</span> · ' + U.esc(((c.rosters && c.rosters['2025']) || c.roster).join('、')) + '</div>' +
        '<div class="small" style="margin-top:4px"><span class="dim">逐年阵容</span> · ' + ['2024', '2025', '2026'].map(function (y) {
          const r = (c.rosters && c.rosters[y]) || [];
          return '<span class="tag" data-tone="dim" style="margin-right:4px">' + y + '：' + U.esc(r.slice(0, 5).join('、')) + '</span>';
        }).join('') + '</div>' +
        '<div class="tiny dim-2" style="margin-top:4px">当前时间线将采用 <b>' + U.esc(currentRosterYear()) + '</b> 年阵容（附录 Q.6）</div>' +
      '<div class="small" style="margin-top:6px"><span class="dim">战绩 / 荣誉</span> · ' + U.esc(c.honors || '—') + '</div>' +
      '<div class="small" style="margin-top:6px"><span class="dim">剧情线</span> · ' + U.esc(c.line) + '</div>' +
      '<div class="tiny dim-2" style="margin-top:8px">管理层与教练组为虚构 NPC（第25章）；选手以比赛 ID 出现（附录Q）。</div>' +
      '</div>'
      : '<div class="inset tiny dim" style="padding:16px">从左侧名单中选择一家俱乐部——仅显示名称与文字资料，没有队标与图标。</div>';
  }

  /* ── 10 导语 ── */
  function renderOpening() {
    const t = setup.timeline;
    U.$('#opening-scene-tag').textContent = '序幕 · ' + (t ? t.name : '待生成');
    U.$('#opening-time-tag').textContent = t ? (t.year + ' 年 ' + U.pad2(t.month) + ' 月 · ' + t.season) : '—';
    if (!setup.timeline || !setup.positionId) {
      U.$('#opening-lead').textContent = '选择时间线、定位与俱乐部后，叙事引擎将在此撰写你的开局。';
      U.$('#opening-story').innerHTML = '';
      U.$('#opening-choices').innerHTML = '';
      U.$('#opening-preview').innerHTML = '';
      return;
    }
    const lg = legend(), pos = position(), c = clubDef(), ct = setup.city;
    const lead = lg
      ? '你是 ' + lg.name + '。' + lg.honor + '。' + lg.line
      : ct.name + '，' + t.year + ' 年 ' + U.pad2(t.month) + ' 月。' + t.quote + '你是一个' + (origin() ? origin().name : '普通少年') + '，主位置' + pos.name + '，' +
      (c ? '手里拿着的是一份来自 ' + c.name + ' 的试训邀请' : '还没有任何一家俱乐部回复你') + '。';
    U.$('#opening-lead').textContent = lead;
    const node = D.SCENES[t.startNode] || D.SCENES.ch1_tryout;
    const blocks = (node.lines || []).map(function (l) {
      if (l.t === 'speak') return '<div class="story-line story-say"><span class="who">' + U.esc(l.who) + '</span>' + U.esc(l.text) + '</div>';
      if (l.t === 'sys') return '<div class="story-line story-sys">' + l.text + '</div>';
      return '<div class="story-line">' + U.esc(l.text) + '</div>';
    }).join('');
    U.$('#opening-story').innerHTML = blocks;
    U.$('#opening-choices').innerHTML = (node.choices || []).slice(0, 3).map(function (ch, i) {
      const check = ch.check
        ? '<span class="choice-check">' + U.icon('target', 'icon-xs') + U.esc(ch.check.tag || '') +
        (ch.check.kind === 'breakthrough' ? ' 1d100' : ' 成功线 ' + ch.check.dc) + '</span>'
        : '<span class="choice-check">无判定</span>';
      return '<button type="button" class="choice' + (setup.openingChoice === i ? ' is-selected' : '') + '" data-open-choice="' + i + '" data-risk="' + (ch.risk || 'normal') + '" id="open-choice-' + i + '">' +
        '<span class="choice-no">' + (i + 1) + '</span>' +
        '<span class="choice-main"><span class="choice-label">' + U.esc(ch.label) + '</span>' +
        '<span class="choice-desc">' + U.esc(ch.desc) + '</span>' + check + '</span>' +
        U.icon('chevron', 'choice-arrow') + '</button>';
    }).join('');
    const p = previewAttrs();
    const lv = previewOvr();
    U.$('#opening-preview').innerHTML =
      '<div class="lrow"><span class="lrow-k">主位置</span><span class="lrow-v acc">' + U.esc(pos.name) + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">初始总评</span><span class="lrow-v"><b>' + lv.total + '</b> · ' + U.esc(lv.level.name) + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">关键属性</span><span class="lrow-v">' + lv.keyVals.join(' / ') + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">俱乐部</span><span class="lrow-v">' + (c ? U.esc(c.name) + '（' + U.esc(c.tier) + '）' : '无') + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">气运</span><span class="lrow-v">' + p.attrs.luck + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">属性上限</span><span class="lrow-v">' + p.cap + '</span></div>';
  }

  /* ── 11 建档完成 ── */
  function buildState() {
    return ES.state.create({
      difficulty: setup.difficulty, mode: setup.mode, legendId: setup.legendId, origin: setup.origin,
      talents: setup.talents, bodyId: setup.bodyId, ovrTarget: setup.ovrTarget,
      name: setup.name, tag: setup.tag, gender: setup.gender, age: setup.age, height: setup.height,
      look: setup.look, orientation: setup.orientation, loveStyle: setup.loveStyle,
      traits: setup.traits, catchphrase: setup.catchphrase, sigil: setup.sigil, sign: setup.sign,
      positionId: setup.positionId,
      city: setup.city && setup.city.id ? setup.city.id : setup.city,
      timeline: setup.timeline && setup.timeline.id ? setup.timeline.id : setup.timeline,
      clubId: setup.clubId && setup.clubId.id ? setup.clubId.id : setup.clubId,
      openingChoice: setup.openingChoice
    });
  }
  function renderFinal() {
    if (!pendingState) pendingState = buildState();
    const S = pendingState;
    const d = ES.state.ovrDetail(S);
    const eff = ES.state.effective(S);
    U.$('#final-sigil').innerHTML = sigilSvg(S.profile.sigil);
    U.$('#final-name').textContent = S.profile.name;
    U.$('#final-tag').textContent = S.profile.tag;
    U.$('#final-badges').innerHTML =
      '<span class="tag" data-tone="' + (S.difficulty === 'cheat' ? 'red' : 'gold') + '">' + U.esc(S.difficultyName) + '</span>' +
      '<span class="tag" data-tone="cyan">' + U.esc(S.mode === 'legend' ? '原著传奇' : '自创角色') + '</span>' +
      '<span class="tag" data-tone="violet">' + U.esc(origin() ? origin().name : '') + '</span>' +
      '<span class="tag" data-tone="cyan">' + U.esc(d.pos.name) + '</span>' +
      '<span class="tag">' + U.esc(S.city.name) + '</span>' +
      (S.club ? '<span class="tag">' + U.esc(S.club.name) + '</span>' : '');
    U.$('#final-meta').textContent = [S.profile.gender, S.profile.age + ' 岁', S.profile.height + ' cm', '外貌 ' + S.profile.look,
      S.profile.loveStyle, S.time.year + ' 年 ' + U.pad2(S.time.month) + ' 月'].join(' · ');
    U.$('#final-ovr').textContent = d.total;
    U.$('#final-ovr-ring').style.setProperty('--val', d.total);
    U.$('#final-level').textContent = d.level.name + ' · ' + d.level.short;
    U.$('#final-level').setAttribute('data-tone', d.level.tone);
    U.$('#final-pa').textContent = ES.state.pa(S);
    U.$('#final-pa-label').textContent = ES.state.paLabel(ES.state.pa(S)).t;
    U.$('#final-value').textContent = '¥' + U.fmtNum(ES.state.marketValue(S));
    U.$('#final-ovr-calc').innerHTML = '<b>总评演算</b>（' + U.esc(d.pos.name) + '权重）：' +
      d.parts.map(function (x) { return U.esc(x.name) + ' ' + x.v + '×' + Math.round(x.w * 100) + '% = ' + x.score.toFixed(1); }).join(' ＋ ') +
      ' → 基础分 <b>' + d.base.toFixed(1) + '</b>' +
      (d.bonus ? ' ＋ 关键属性加成 <b>' + d.bonus + '</b>' : '') +
      (d.penalty ? ' － 短板惩罚 <b>' + d.penalty + '</b>' : '') +
      ' = <b class="acc">总评 ' + d.total + '（' + d.level.name + '）</b>';
    U.$('#final-attrs').innerHTML = D.ATTRS.map(function (a) {
      const v = eff.attrs[a.k];
      const isKey = d.key.indexOf(a.k) >= 0;
      return '<div class="stat-row"><span class="stat-k">' + U.icon(a.icon, 'icon-xs') + U.esc(a.name) + (isKey ? '<span class="tag tiny" data-tone="cyan">关键</span>' : '') +
        (a.group === 'luck' ? '<span class="tag tiny" data-tone="gold">不入总评</span>' : '') + '</span>' +
        '<span class="stat-bar"><i style="width:' + v + '%"></i></span><span class="stat-v mono">' + v + '</span></div>';
    }).join('');
    U.$('#final-talents').innerHTML = (S.talents || []).map(function (t) {
      const q = D.QUALITIES[t.quality];
      return '<div class="talent-item is-selected" data-rarity="' + t.quality + '" style="cursor:default">' + U.icon(t.icon, 'talent-ico') +
        '<span class="talent-body"><span class="talent-name">' + U.esc(t.name) + '</span>' +
        '<span class="talent-desc">' + t.lines.map(function (l) { return U.esc(l.name) + ' +' + l.v; }).join('、') + '</span></span>' +
        '<span class="talent-badge" data-rarity="' + t.quality + '">' + U.esc(q.name) + '</span></div>';
    }).join('') + (S.body ? '<div class="alert" data-tone="gold" style="margin-top:10px">' + U.icon('sparkle', 'icon-xs') + '<div><b>体质觉醒 · ' + U.esc(S.body.name) + '</b><div class="small dim-2" style="margin-top:4px">' + U.esc(S.body.desc) + '</div></div></div>' : '');
    U.$('#final-club').innerHTML = S.club
      ? '<div class="lrow"><span class="lrow-k">俱乐部</span><span class="lrow-v acc">' + U.esc(S.club.name) + '（' + U.esc(S.club.short) + '）</span></div>' +
      '<div class="lrow"><span class="lrow-k">赛区 / 城市</span><span class="lrow-v">' + U.esc(S.club.region) + ' · ' + U.esc(S.club.city) + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">资源分级</span><span class="lrow-v">' + U.esc(S.club.tier) + ' · ' + U.esc(S.club.seat) + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">年薪 / 合同</span><span class="lrow-v">¥' + U.fmtNum(S.club.salary) + ' · ' + S.club.years + ' 年</span></div>' +
      '<div class="lrow"><span class="lrow-k">违约金</span><span class="lrow-v">¥' + U.fmtNum(S.club.buyout) + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">阵容（' + U.esc(S.club.rosterYear || '—') + '）</span><span class="lrow-v">' + U.esc(S.club.roster.join('、')) + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">阵容说明</span><span class="lrow-v tiny dim-2">' + U.esc(S.club.rosterNote || '') + '</span></div>' +
      '<div class="lrow"><span class="lrow-k">队内定位</span><span class="lrow-v">' + U.esc(ES.state.lineupText(S)) + '</span></div>'
      : '<div class="empty tiny dim">未选择俱乐部</div>';
  }

  /* ── 总渲染 ── */
  function renderAll() {
    renderMeta(); renderSteps();
    renderDifficulty(); renderMode(); renderOrigin(); renderTalentDirs(); renderTalentPool();
    renderProfileStatics(); renderPosition(); renderCities(); renderTimeline(); renderClub(); renderOpening();
    if (step === TOTAL_STEPS) renderFinal();
    updatePreview(); renderFoot();
    U.$$('.step-panel', U.$('#creator-body')).forEach(function (p) {
      p.classList.toggle('is-active', parseInt(p.getAttribute('data-step'), 10) === step);
    });
  }
  function goto(n) {
    step = U.clamp(n, 1, TOTAL_STEPS);
    maxSeenStep = Math.max(maxSeenStep, step);
    if (step === TOTAL_STEPS) pendingState = null;
    renderAll();
    const body = U.$('#creator-body');
    if (body) body.scrollTop = 0;
    ES.audio.play('tab');
  }

  /* ── 随机建档 ── */
  function randomAll() {
    setup = blankSetup();
    setup.difficulty = U.pick(D.DIFFICULTIES.filter(function (d) { return !d.cheat; })).id;
    setup.mode = window.__DEV_LEGEND || window.__DEV_MODE === 'legend' ? 'legend' : (window.__DEV_MODE === 'custom' ? 'custom' : U.pick(D.MODES).id);
    if (setup.mode === 'legend') setup.legendId = window.__DEV_LEGEND || U.pick(D.LEGENDS).id;
    setup.origin = U.pick(D.ORIGINS).id;
    setup.talentDirections = U.pickMany(D.TALENT_DIRECTIONS, U.randInt(2, 3)).map(function (d) { return d.id; });
    setup.talents = rollTalents();
    setup.bodyId = rollBodySafe();
    const lg = setup.mode === 'legend' ? D.LEGENDS.filter(function (l) { return l.id === setup.legendId; })[0] : null;
    setup.name = lg ? lg.name.replace(/^.*·\s*/, '') : U.pick(D.SURNAMES) + U.pick(D.GIVEN);
    setup.tag = lg ? lg.short.split(' · ')[0] : U.pick(D.IDS) + U.pick(D.ID_SUFFIX);
    setup.gender = U.pick(D.GENDERS);
    setup.orientation = U.pick(D.ORIENTATIONS);
    setup.loveStyle = U.pick(D.LOVE_STYLES);
    setup.age = U.randInt(17, 24);
    setup.height = U.randInt(165, 190);
    setup.look = U.randInt(4, 9);
    setup.traits = U.pickMany(D.TRAITS, U.randInt(1, 3)).map(function (t) { return t.id; });
    setup.catchphrase = U.pick(D.CATCHPHRASES);
    setup.sigil = U.randInt(0, 7);
    setup.sign = U.pick(D.SIGNS);
    setup.positionId = setup.legendId
      ? D.LEGENDS.filter(function (l) { return l.id === setup.legendId; })[0].positionId
      : U.pick(D.POSITIONS).id;
    setup.city = U.pick(D.CITIES_CN.concat(D.CITIES_GLOBAL));
    setup.timeline = window.__DEV_TIMELINE
      ? (D.TIMELINES.filter(function (x) { return x.id === window.__DEV_TIMELINE; })[0] || U.pick(D.TIMELINES))
      : U.pick(D.TIMELINES);
    setup.clubId = window.__DEV_CLUB
      ? (D.CLUBS.filter(function (x) { return x.id === window.__DEV_CLUB; })[0] || U.pick(D.CLUBS)).id
      : U.pick(D.CLUBS).id;
    const d = D.DIFFICULTIES.filter(function (x) { return x.id === setup.difficulty; })[0];
    setup.ovrTarget = Math.round((d.mods.ovrMin + d.mods.ovrMax) / 2);
    setup.talentRollsLeft = d.mods.rerolls;
    maxSeenStep = TOTAL_STEPS;
    pendingState = null;
    ES.audio.play('success');
    U.toast({ tone: 'info', title: '已随机建档', msg: setup.name + ' · ' + setup.tag + ' · ' + D.CLUBS.filter(function (c) { return c.id === setup.clubId; })[0].name });
    renderAll();
  }

  function finish() {
    const err = validate(TOTAL_STEPS);
    if (err) { U.toast({ tone: 'warn', title: '建档未完成', msg: err }); return; }
    const state = pendingState || buildState();
    pendingState = null;
    state.scene.nodeId = setup.timeline ? setup.timeline.startNode : 'ch1_tryout';
    state.scene.chapterId = state.scene.nodeId;
    state.scene.openingChoice = setup.openingChoice;
    state.flags.pendingOpening = true;
    ES.app.startGame(state, true);
  }

  /* ── 交互绑定（一次性） ── */
  function bindOnce() {
    const next = U.$('#btn-creator-next');
    if (next.__esBound) return;
    next.__esBound = true;
    const app = ES.app;

    U.$('#btn-creator-prev').addEventListener('click', function () { ES.audio.play('click'); goto(step - 1); });
    next.addEventListener('click', function () {
      const err = validate(step + 1);
      if (step >= TOTAL_STEPS) { ES.audio.play('success'); finish(); return; }
      if (err) { U.toast({ tone: 'warn', title: '还不能继续', msg: err }); return; }
      ES.audio.play('click'); goto(step + 1);
    });
    U.$('#btn-creator-random-all').addEventListener('click', randomAll);
    U.$('#btn-talent-roll').addEventListener('click', rollTalent);
    U.$('#btn-random-name').addEventListener('click', function () {
      setup.name = U.pick(D.SURNAMES) + U.pick(D.GIVEN);
      setup.tag = U.pick(D.IDS) + U.pick(D.ID_SUFFIX);
      U.$('#input-profile-name').value = setup.name;
      U.$('#input-profile-id').value = setup.tag;
      checkIdField(); ES.audio.play('click'); updatePreview();
    });
    U.$('#creator-steps').addEventListener('click', function (e) {
      const b = e.target.closest('[data-goto]');
      if (!b || b.disabled) return;
      const target = parseInt(b.getAttribute('data-goto'), 10);
      if (target > step && validate(step + 1)) { U.toast({ tone: 'warn', title: '还不能跳转', msg: validate(step + 1) }); return; }
      goto(target);
    });

    /* 难度 */
    U.$('#grid-difficulty').addEventListener('click', function (e) {
      const c = e.target.closest('[data-diff]'); if (!c) return;
      const id = c.getAttribute('data-diff');
      const d = D.DIFFICULTIES.filter(function (x) { return x.id === id; })[0];
      const pickIt = function () {
        setup.difficulty = id;
        setup.talentRollsLeft = d.mods.rerolls;
        setup.ovrTarget = Math.round((d.mods.ovrMin + d.mods.ovrMax) / 2);
        ES.audio.play('click'); renderDifficulty(); renderMeta(); renderTalentDirs(); updatePreview(); renderFoot();
      };
      if (d.cheat) {
        U.confirmDialog({
          title: '开启作弊模式？', tone: 'red', okText: '我已了解，仍要开启',
          body: '作弊模式会提供无限元、任意总评与无敌状态。<b>本存档的所有成就都会标记为「作弊获得」</b>，且不参与正常结局评定。开启后不可关闭。',
          onOk: pickIt
        });
      } else pickIt();
    });
    /* 模式 */
    U.$('#grid-mode').addEventListener('click', function (e) {
      const c = e.target.closest('[data-mode]'); if (!c) return;
      setup.mode = c.getAttribute('data-mode');
      if (setup.mode === 'custom') setup.legendId = null; else setup.mode = 'legend';
      ES.audio.play('click'); renderMode(); renderMeta(); updatePreview(); renderFoot();
    });
    U.$('#grid-legend').addEventListener('click', function (e) {
      const c = e.target.closest('[data-legend]'); if (!c) return;
      setup.legendId = c.getAttribute('data-legend');
      const l = legend();
      if (l) {
        setup.positionId = l.positionId;
        setup.name = l.name.replace(/^.*·\s*/, '');
        setup.tag = l.short.split(' · ')[0];
        setup.sigil = U.randInt(0, 7);
        setup.traits = setup.traits.length ? setup.traits : [U.pick(D.TRAITS).id];
        if (!setup.city) setup.city = D.CITIES_CN.concat(D.CITIES_GLOBAL).filter(function (x) { return x.name === l.startCity; })[0] || null;
      }
      ES.audio.play('click'); renderMode(); renderPosition(); renderCities(); updatePreview(); renderFoot();
    });
    /* 出身 */
    U.$('#grid-origin').addEventListener('click', function (e) {
      const c = e.target.closest('[data-origin]'); if (!c) return;
      setup.origin = c.getAttribute('data-origin');
      ES.audio.play('click'); renderOrigin(); updatePreview(); renderFoot();
    });
    /* 天赋方向 */
    U.$('#talent-directions').addEventListener('click', function (e) {
      const c = e.target.closest('[data-dir]'); if (!c) return;
      const id = c.getAttribute('data-dir');
      const i = setup.talentDirections.indexOf(id);
      if (i >= 0) setup.talentDirections.splice(i, 1);
      else {
        if (setup.talentDirections.length >= 3) { U.toast({ tone: 'warn', title: '最多选择 3 个倾向', msg: '倾向只影响掷骰时的抽取权重。' }); return; }
        setup.talentDirections.push(id);
      }
      ES.audio.play('click');
      U.$$('#talent-directions .chip').forEach(function (x) {
        x.classList.toggle('is-selected', setup.talentDirections.indexOf(x.getAttribute('data-dir')) >= 0);
        x.setAttribute('aria-pressed', setup.talentDirections.indexOf(x.getAttribute('data-dir')) >= 0);
      });
      renderTalentDirs();
    });
    /* 定位 */
    U.$('#grid-position').addEventListener('click', function (e) {
      const c = e.target.closest('[data-position]'); if (!c) return;
      setup.positionId = c.getAttribute('data-position');
      const l = legend();
      if (l && l.positionId !== setup.positionId) setup.legendId = null;
      ES.audio.play('click'); renderPosition(); renderMode(); updatePreview(); renderFoot();
    });
    /* 城市 */
    U.$('#grid-city-cn').addEventListener('click', function (e) {
      const c = e.target.closest('[data-city]'); if (!c) return;
      setup.city = D.CITIES_CN.filter(function (x) { return x.id === c.getAttribute('data-city'); })[0];
      ES.audio.play('click'); renderCities(); updatePreview(); renderFoot();
    });
    U.$('#grid-city-global').addEventListener('click', function (e) {
      const c = e.target.closest('[data-city]'); if (!c) return;
      setup.city = D.CITIES_GLOBAL.filter(function (x) { return x.id === c.getAttribute('data-city'); })[0];
      ES.audio.play('click'); renderCities(); updatePreview(); renderFoot();
    });
    /* 时间线 */
    U.$('#grid-timeline').addEventListener('click', function (e) {
      const c = e.target.closest('[data-timeline]'); if (!c) return;
      setup.timeline = D.TIMELINES.filter(function (x) { return x.id === c.getAttribute('data-timeline'); })[0];
      ES.audio.play('click'); renderTimeline(); updatePreview(); renderFoot();
    });
    /* 俱乐部（仅名称） */
    U.$('#club-region-tabs').addEventListener('click', function (e) {
      const t = e.target.closest('[data-club-region]'); if (!t) return;
      clubRegion = t.getAttribute('data-club-region');
      ES.audio.play('tab'); renderClub();
    });
    U.$('#club-tier-filter').addEventListener('click', function (e) {
      const t = e.target.closest('[data-club-tier]'); if (!t) return;
      clubTier = t.getAttribute('data-club-tier');
      ES.audio.play('click'); renderClub();
    });
    U.$('#club-name-list').addEventListener('click', function (e) {
      const b = e.target.closest('[data-club]'); if (!b) return;
      setup.clubId = b.getAttribute('data-club');
      ES.audio.play('click'); renderClub(); updatePreview(); renderFoot();
    });
    /* 出身/城市/时间线 tab 按钮 */
    U.$$('[data-city-tab]').forEach(function (tab) {
      if (tab.classList.contains('tab')) tab.addEventListener('click', function () {
        cityTab = tab.getAttribute('data-city-tab');
        U.$$('[data-city-tab]').forEach(function (t) { if (t.classList.contains('tab')) t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
        U.$('#grid-city-cn').classList.toggle('hidden', cityTab !== 'cn');
        U.$('#grid-city-global').classList.toggle('hidden', cityTab !== 'global');
        U.$('#city-tab-hint').textContent = cityTab === 'cn' ? '按青训体系与薪资水平排序' : '出海意味着更高薪资与更孤独的夜晚';
        ES.audio.play('tab');
      });
    });
    /* 表单 */
    U.$('#input-profile-name').addEventListener('input', function (e) { setup.name = e.target.value.trim(); updatePreview(); renderFoot(); });
    U.$('#input-profile-id').addEventListener('input', function (e) { setup.tag = e.target.value.trim(); checkIdField(); updatePreview(); renderFoot(); });
    U.$('#input-profile-catch').addEventListener('input', function (e) { setup.catchphrase = e.target.value.trim(); });
    U.$('#input-profile-sign').addEventListener('input', function (e) { setup.sign = e.target.value.trim(); updatePreview(); });
    U.$('#input-profile-age').addEventListener('input', function (e) {
      setup.age = +e.target.value;
      U.$('#val-profile-age').textContent = setup.age + ' 岁';
      U.$('#age-hint').textContent = ageHint(setup.age);
      updatePreview();
    });
    U.$('#input-profile-height').addEventListener('input', function (e) { setup.height = +e.target.value; U.$('#val-profile-height').textContent = setup.height + ' cm'; updatePreview(); });
    U.$('#input-profile-look').addEventListener('input', function (e) { setup.look = +e.target.value; U.$('#val-profile-look').textContent = setup.look + ' / 10'; updatePreview(); });
    U.$('#input-ovr-target').addEventListener('input', function (e) {
      setup.ovrTarget = +e.target.value;
      U.$('#val-ovr-target').textContent = '总评 ' + setup.ovrTarget;
      updatePreview();
    });
    /* 导语选项 */
    U.$('#opening-choices').addEventListener('click', function (e) {
      const b = e.target.closest('[data-open-choice]'); if (!b) return;
      setup.openingChoice = parseInt(b.getAttribute('data-open-choice'), 10);
      ES.audio.play('click');
      U.$$('#opening-choices .choice').forEach(function (x) { x.classList.toggle('is-selected', x === b); });
    });
    /* 键盘 */
    document.addEventListener('keydown', function (e) {
      if (ES.app.currentScreen !== 'creator') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') goto(step + 1);
      else if (e.key === 'ArrowLeft') goto(step - 1);
      else if (e.key.toLowerCase() === 'r' && step === 4) rollTalent();
    });
  }

  /* ── 初始化 ── */
  function mount() {
    setup = blankSetup();
    step = 1;
    maxSeenStep = 1;
    pendingState = null;
    renderAll();
    bindOnce();
    U.$('#input-profile-name').value = '';
    U.$('#input-profile-id').value = '';
    U.$('#input-profile-catch').value = '';
    U.$('#input-profile-sign').value = '';
    U.$('#val-profile-age').textContent = setup.age + ' 岁';
    U.$('#val-profile-height').textContent = setup.height + ' cm';
    U.$('#val-profile-look').textContent = setup.look + ' / 10';
    U.$('#age-hint').textContent = ageHint(setup.age);
  }

  return {
    mount: mount, sigilSvg: sigilSvg, get setup() { return setup; }, goto: goto, randomAll: randomAll,
    TOTAL_STEPS: TOTAL_STEPS,
    devFinish: function () {
      if (!setup || !setup.difficulty) { if (!setup) setup = blankSetup(); randomAll(); }
      const err = validate(TOTAL_STEPS);
      if (err) { randomAll(); }
      finish();
    },
    devPrep: function () {
      if (!setup) setup = blankSetup();
      randomAll();
    },
    devRoll: function () {
      if (!setup) setup = blankSetup();
      setup.talentDirections = U.pickMany(D.TALENT_DIRECTIONS, 2).map(function (d) { return d.id; });
      renderTalentDirs();
      rollTalent();
      goto(4);
    }
  };
})();
