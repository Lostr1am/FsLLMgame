window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   面板层：变量状态栏 / 变量看板 / 档案 / 任务 / 成就 / 快讯 / 关系 /
           合同 / 情缘 / 日程 / 日历 / 舆论 / 图表
   ═══════════════════════════════════════════════════════════════ */
ES.panels = (function () {
  'use strict';
  const U = ES.util, D = ES.data;
  let S = null;                 // 当前状态引用
  let dashTab = 'character';
  let newsFilter = 'all';
  let newsSelected = null;
  let questFilter = 'main';
  let achFilter = 'all';
  let mediaTab = 'hot';
  let calOffset = 0;
  let railSig = '';             // 变化指纹，避免无谓重绘

  ES.panels = ES.panels || {};

  /* ══════════ 通用片段 ══════════ */
  const SPECIAL_META = [
    { k: 'condition', name: '竞技状态', icon: 'pulse' }, { k: 'hand', name: '手部健康', icon: 'hand' },
    { k: 'injury', name: '伤病风险', icon: 'warn' }, { k: 'fans', name: '粉丝（万）', icon: 'users' },
    { k: 'fame', name: '名声', icon: 'star' }, { k: 'heat', name: '舆论热度', icon: 'flame' },
    { k: 'standing', name: '队内地位', icon: 'rank' }, { k: 'coachTrust', name: '教练信任', icon: 'briefcase' },
    { k: 'teammateTrust', name: '队友信任', icon: 'link' }, { k: 'fanLoyalty', name: '粉丝忠诚', icon: 'heart' },
    { k: 'antiThreat', name: '黑粉威胁', icon: 'warn' }, { k: 'versionBonus', name: '版本红利', icon: 'layers' },
    { k: 'clutch', name: '关键局加成', icon: 'target' }, { k: 'cap', name: '属性上限', icon: 'chart' },
    { k: 'money', name: '元', icon: 'coin' }
  ];
  function metaOf(k) {
    return D.ATTRS.filter(function (x) { return x.k === k; })[0] || SPECIAL_META.filter(function (x) { return x.k === k; })[0] || null;
  }
  function attrName(k) { const a = metaOf(k); return a ? a.name : k; }
  function attrIcon(k) { const a = metaOf(k); return a ? a.icon : "chart"; }
  function meterRow(label, icon, value, max, tone, note) {
    const pct = U.clamp((value / (max || 100)) * 100, 0, 100);
    return '<div class="meter" data-tone="' + (tone || 'cyan') + '" data-meter="' + label + '">' +
      '<div class="meter-top"><span class="meter-name">' + U.icon(icon, 'icon-xs') + U.esc(label) + '</span>' +
      '<span class="meter-val" data-meter-val="' + label + '">' + Math.round(value) + (note || '') + '</span></div>' +
      '<div class="meter-track"><span class="meter-fill" data-meter-fill="' + label + '" style="width:' + pct + '%"></span><span class="meter-ticks"></span></div>' +
    '</div>';
  }
  function attrRow(k, v, tone) {
    return '<div class="attr-row" data-attr-row="' + k + '">' +
      '<span class="k">' + U.icon(attrIcon(k), 'icon-xs') + ' ' + U.esc(attrName(k)) + '</span>' +
      '<span class="t"><i' + (tone ? ' data-tone="' + tone + '"' : '') + (v < 38 ? ' class="low"' : '') + ' style="width:' + U.clamp(v, 2, 100) + '%"></i></span>' +
      '<span class="v" data-attr-val="' + k + '">' + Math.round(v) + '</span></div>';
  }

  /* ══════════ 雷达图 ══════════ */
  function radarSvg(state, opts) {
    opts = opts || {};
    const keys = opts.keys || ['aim', 'reaction', 'gameSense', 'mentality', 'comms', 'movement', 'stamina', 'insight'];
    const size = opts.size || 260;
    const cx = size / 2, cy = size / 2, R = size / 2 - 52;
    const eff = ES.state.effective(state).attrs;
    const n = keys.length;
    function pt(i, ratio) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(ang) * R * ratio, cy + Math.sin(ang) * R * ratio];
    }
    let grid = '';
    [0.25, 0.5, 0.75, 1].forEach(function (r) {
      const pts = [];
      for (let i = 0; i < n; i++) { const p = pt(i, r); pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      grid += '<polygon class="radar-grid" points="' + pts.join(' ') + '"' + (r === 1 ? '' : ' opacity=".55"') + '/>';
    });
    let axes = '', labels = '';
    for (let i = 0; i < n; i++) {
      const p = pt(i, 1), lp = pt(i, 1.13);
      axes += '<line class="radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>';
      const anchor = lp[0] > cx + 4 ? 'start' : (lp[0] < cx - 4 ? 'end' : 'middle');
      labels += '<text class="radar-label" x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3).toFixed(1) + '" text-anchor="' + anchor + '">' + U.esc(attrName(keys[i])) + '</text>';
    }
    const pts = keys.map(function (k, i) { const p = pt(i, U.clamp(eff[k] / 100, 0.05, 1)); return p[0].toFixed(1) + ',' + p[1].toFixed(1); });
    let compare = '';
    if (opts.compare) {
      const cpts = keys.map(function (k, i) { const base = U.clamp((state.special.cap || 85) / 100, 0.05, 1); const p = pt(i, base); return p[0].toFixed(1) + ',' + p[1].toFixed(1); });
      compare = '<polygon class="radar-area-2" points="' + cpts.join(' ') + '"/>';
    }
    let dots = keys.map(function (k, i) { const p = pt(i, U.clamp(eff[k] / 100, 0.05, 1)); return '<circle class="radar-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4"><title>' + attrName(k) + ' ' + eff[k] + '</title></circle>'; }).join('');
    return '<div class="radar-wrap"><svg class="radar-svg" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="核心属性雷达图">' +
      grid + axes + '<polygon class="radar-area" points="' + pts.join(' ') + '"/>' + compare + dots + labels + '</svg></div>';
  }

  /* ══════════ 折线图 ══════════ */
  let sparkSeq = 0;
  function sparklineSvg(values, opts) {
    opts = opts || {};
    const w = opts.width || 300, h = opts.height || 44;
    const min = opts.min !== undefined ? opts.min : Math.min.apply(null, values);
    const max = opts.max !== undefined ? opts.max : Math.max.apply(null, values);
    const span = (max - min) || 1;
    const id = 'spark' + (++sparkSeq);
    const pts = values.map(function (v, i) {
      const x = (i / Math.max(1, values.length - 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / span) * (h - 10);
      return [x, y];
    });
    const line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    const area = line + ' L' + (w - 2) + ' ' + (h - 2) + ' L2 ' + (h - 2) + ' Z';
    const last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="趋势图">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + (opts.color || 'var(--accent)') + '" stop-opacity=".38"/>' +
      '<stop offset="100%" stop-color="' + (opts.color || 'var(--accent)') + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path class="spark-line" d="' + line + '"/>' +
      '<circle class="spark-dot" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3"/>' +
      '</svg>';
  }
  function trendValues(state, key, count) {
    const base = state.attrs[key] !== undefined ? state.attrs[key] : (state.special[key] || 50);
    const rnd = U.makeRng(Math.round(base * 977) + (key.length * 31));
    const out = [];
    let v = base - 8;
    for (let i = 0; i < (count || 14); i++) {
      v += (rnd() - 0.42) * 5;
      v = U.clamp(v, base - 16, base + 8);
      out.push(v);
    }
    out[out.length - 1] = base;
    return out;
  }

  /* ══════════ 变量状态栏 ══════════ */
  function renderRail() {
    const host = U.$("#status-rail");
    if (!host || !S) return;
    const d = ES.state.ovrDetail(S);
    const ovr = d.total, pa = ES.state.pa(S), paInfo = ES.state.paLabel(pa);
    const bond = ES.state.bondOf(S);
    const sig = [S.time.turn, S.res.condition, S.res.hand, S.res.injury, S.res.money, S.res.fans, ovr, S.statuses.length,
      S.special.fame, S.special.heat, S.special.antiThreat, S.special.coachTrust, S.special.teammateTrust, S.club ? S.club.rank : 0].join("|");
    if (sig === railSig) return;
    const prev = railSig ? railSig.split("|") : null;
    railSig = sig;
    const phaseInfo = ES.state.phaseOf(S.time.month);
    const phasePct = Math.round(((S.time.month - phaseInfo.from + 1) / (phaseInfo.to - phaseInfo.from + 1)) * 100);

    host.innerHTML =
      '<div class="rail-block glass-panel corner-marks">' +
        '<div class="rail-title">' + U.icon("clock") + '时间与地点</div>' +
        '<div class="rail-clock">' +
          '<span class="rc-time">' + U.pad2(S.time.month) + '月' + U.pad2(S.time.day) + '日 ' + S.time.clock + '</span>' +
          '<span class="rc-phase">' + U.icon("pulse", "icon-xs") + S.time.phase + ' · 第 ' + S.time.week + ' 周</span>' +
          '<span class="tiny dim">' + S.time.season + ' 赛季 · ' + S.time.year + ' 年 · 回合 ' + S.time.turn + '</span>' +
          '<span class="rc-phase-bar"><i style="width:' + phasePct + '%"></i></span>' +
        '</div>' +
        '<div class="hairline"></div>' +
        '<div class="rail-title">' + U.icon("pin") + '所在地</div>' +
        '<div class="row-tight">' + U.icon("building", "icon-sm") + '<span class="small">' + U.esc(S.city ? S.city.name : "未定") + '</span>' +
        '<span class="tag" data-tone="dim" style="margin-left:auto">' + U.esc(S.city ? S.city.region : "") + '</span></div>' +
        '<div class="row-tight">' + U.icon("briefcase", "icon-sm") + '<span class="small">' + U.esc(S.club ? S.club.name : "无俱乐部") + '</span></div>' +
        '<div class="row-tight">' + U.icon("crosshair", "icon-sm") + '<span class="small">' + U.esc(d.pos.name) + ' · ' + U.esc(S.club ? S.club.league : "—") + '</span></div>' +
      '</div>' +

      '<div class="rail-block glass-panel corner-marks">' +
        '<div class="rail-title">' + U.icon("chart") + '总评（位置加权）</div>' +
        '<div class="row" style="gap:14px">' +
          '<div class="ring ovr-ring" id="rail-ovr-ring">' +
            '<svg viewBox="0 0 100 100" aria-hidden="true">' +
              '<circle class="ring-bg" cx="50" cy="50" r="42"></circle>' +
              '<circle class="ring-val" cx="50" cy="50" r="42" id="rail-ovr-arc"></circle>' +
              '<circle class="ring-val-2" cx="50" cy="50" r="36" id="rail-pa-arc"></circle>' +
            '</svg>' +
            '<div class="ring-core"><span class="ring-num" id="rail-ovr-num">' + ovr + '</span><span class="ring-lab">总评</span></div>' +
          '</div>' +
          '<div class="col" style="gap:4px;min-width:0">' +
            '<div class="row-tight"><span class="tiny dim">等级</span><span class="mono acc">' + U.esc(d.level.name) + ' · ' + U.esc(d.level.short) + '</span></div>' +
            '<div class="row-tight"><span class="tiny dim">位置</span><span class="mono">' + U.esc(d.pos.name) + '</span></div>' +
            '<div class="row-tight"><span class="tiny dim">潜力</span><span class="mono">' + U.esc(paInfo.t.split(" · ")[0]) + ' / 上限 ' + (S.special.cap || 85) + '</span></div>' +
            '<div class="row-tight"><span class="tiny dim">联赛</span><span class="mono">第 ' + (S.club ? S.club.rank : "—") + ' 位</span></div>' +
            '<div class="row-tight"><span class="tiny dim">羁绊</span><span class="mono">' + U.esc(bond.level.name) + ' +' + Math.round(bond.level.bonus * 100) + '%</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="hairline"></div>' +
        '<div class="rail-title">' + U.icon("coin") + '资金与身价</div>' +
        '<div class="rail-money">' + U.icon("bank", "icon-sm") + '<span class="v">¥' + U.money(S.res.money) + '</span></div>' +
        '<div class="rail-mini-grid">' +
          '<div class="rail-mini"><div class="k">年薪</div><div class="v">' + (S.club && S.club.signed ? "¥" + U.money(S.club.salary) : "无合同") + '</div></div>' +
          '<div class="rail-mini"><div class="k">身价</div><div class="v">¥' + U.money(ES.state.marketValue(S)) + '</div></div>' +
          '<div class="rail-mini"><div class="k">粉丝</div><div class="v">' + U.fmtNum(S.res.fans) + ' 万</div></div>' +
          '<div class="rail-mini"><div class="k">气运</div><div class="v">' + Math.round(S.attrs.luck) + '</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="rail-block glass-panel corner-marks">' +
        '<div class="rail-title">' + U.icon("pulse") + '状态与处境</div>' +
        '<div class="rail-vitals">' +
          vital("竞技状态", "flame", S.res.condition, "condition", S.res.condition < 20 ? "bad" : S.res.condition < 40 ? "warn" : S.res.condition >= 90 ? "good" : "cyan") +
          vital("手部健康", "hand", S.res.hand, "hand", S.res.hand < 40 ? "bad" : S.res.hand < 65 ? "warn" : "good") +
          vital("伤病风险", "warn", S.res.injury, "injury", S.res.injury > 60 ? "bad" : S.res.injury > 30 ? "warn" : "good") +
        '</div>' +
        '<div class="hairline"></div>' +
        '<div class="rail-mini-grid">' +
          '<div class="rail-mini"><div class="k">名声</div><div class="v">' + Math.round(S.special.fame) + '</div></div>' +
          '<div class="rail-mini"><div class="k">舆论热度</div><div class="v" style="color:' + (S.special.heat > 60 ? "var(--red)" : "var(--txt-2)") + '">' + Math.round(S.special.heat) + '</div></div>' +
          '<div class="rail-mini"><div class="k">黑粉威胁</div><div class="v" style="color:' + (S.special.antiThreat > 60 ? "var(--red)" : "var(--txt-2)") + '">' + Math.round(S.special.antiThreat) + '</div></div>' +
          '<div class="rail-mini"><div class="k">粉丝忠诚</div><div class="v">' + Math.round(S.special.fanLoyalty) + '</div></div>' +
          '<div class="rail-mini"><div class="k">教练信任</div><div class="v">' + Math.round(S.special.coachTrust) + '</div></div>' +
          '<div class="rail-mini"><div class="k">队友信任</div><div class="v">' + Math.round(S.special.teammateTrust) + '</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="rail-block glass-panel corner-marks">' +
        '<div class="rail-title">' + U.icon("flame") + '当前状态 <span class="cnt mono" style="margin-left:auto">' + S.statuses.length + '</span></div>' +
        (S.statuses.length ? '<div class="status-list">' + S.statuses.map(function (st) {
          return '<div class="status-pill" data-tone="' + st.tone + '" data-tip="' + U.esc(st.desc) + '">' + U.icon(st.icon) +
            '<div><div class="sp-name">' + U.esc(st.name) + '</div><div class="sp-desc">' + U.esc(st.desc) + '</div></div>' +
            '<span class="sp-turns">' + Math.ceil(st.turns) + ' 回合</span></div>';
        }).join('') + '</div>'
          : '<div class="tiny dim">状态良好，无异常效果。</div>') +
        (S.res.condition < 40 ? '<div class="alert" data-tone="danger" style="margin-top:6px">' + U.icon("warn") + '<div>竞技状态低于 40：全项判定减益，关键局心态受压制。</div></div>' : "") +
        (S.res.hand < 40 ? '<div class="alert" data-tone="warn" style="margin-top:6px">' + U.icon("hand") + '<div>手部健康低于 40：枪法与反应各 -5。</div></div>' : "") +
      '</div>' +

      '<div class="rail-block glass-panel corner-marks">' +
        '<div class="rail-title">' + U.icon("trend-up") + '总评趋势</div>' +
        sparklineSvg(trendValues(S, "aim", 16), { height: 40 }) +
        '<div class="row-tight small dim"><span class="up">' + U.icon("trend-up", "icon-xs") + '突破检定成功率 ' + ES.state.breakthroughRate(S).rate + '%</span><span style="margin-left:auto" class="mono">' + ovr + '</span></div>' +
      '</div>';
    animateRail(prev);
  }
  function vital(label, icon, value, key, tone) {
    return '<div class="vital" data-tone="' + tone + '" data-vital="' + key + '">' +
      '<div class="vital-top"><span class="vital-name">' + U.icon(icon, 'icon-xs') + label + '</span>' +
      '<span class="vital-val" data-vital-val="' + key + '">' + Math.round(value) + '</span></div>' +
      '<div class="vital-track"><span class="vital-fill" data-vital-fill="' + key + '" style="width:' + U.clamp(value, 0, 100) + '%"></span></div>' +
    '</div>';
  }

  function animateRail(prev) {
    const ovr = ES.state.ovr(S), pa = ES.state.pa(S);
    const arc = U.$('#rail-ovr-arc'), paArc = U.$('#rail-pa-arc');
    const C = 2 * Math.PI * 42;
    if (arc) {
      arc.style.strokeDasharray = C;
      arc.style.strokeDashoffset = C * (1 - ovr / 100);
    }
    if (paArc) {
      const C2 = 2 * Math.PI * 36;
      paArc.style.strokeDasharray = C2;
      paArc.style.strokeDashoffset = C2 * (1 - pa / 100);
    }
    if (prev) {
      const map = { 1: 'condition', 2: 'hand', 3: 'injury' };
      Object.keys(map).forEach(function (i) {
        const from = parseFloat(prev[i]), to = S.res[map[i]];
        if (Math.abs(from - to) >= 1) {
          const node = U.$('[data-vital-val="' + map[i] + '"]');
          if (node) {
            U.floatDelta(node.parentNode, to - from);
            node.classList.remove('flash-pos', 'flash-neg');
            void node.offsetWidth;
            node.classList.add(to > from ? 'flash-pos' : 'flash-neg');
          }
          ES.audio.play(to > from ? 'notify' : 'fail');
        }
      });
    }
  }

  /* ══════════ 变量看板 ══════════ */
  const DASH_TABS = [
    { id: 'character', name: '角色卡', icon: 'id' },
    { id: 'attrs', name: '核心属性', icon: 'radar' },
    { id: 'state', name: '状态与处境', icon: 'pulse' },
    { id: 'agents', name: '特工池', icon: 'layers' },
    { id: 'status', name: '伤病与效果', icon: 'flame' },
    { id: 'resource', name: '资源', icon: 'coin' },
    { id: 'club', name: '俱乐部与合同', icon: 'briefcase' },
    { id: 'quests', name: '任务列表', icon: 'tasks' },
    { id: 'relations', name: '关系列表', icon: 'link' },
    { id: 'romance', name: '情缘状态', icon: 'heart' },
    { id: 'news', name: '世界快讯', icon: 'globe' },
    { id: 'achievements', name: '最近成就', icon: 'medal' }
  ];

  function mountDashboard() {
    const tabs = U.$('#dash-tabs');
    tabs.innerHTML = DASH_TABS.map(function (t) {
      const badge = t.id === 'quests' ? S.quests.filter(function (q) { return ES.state.questProgress(S, q) >= q.target; }).length
        : t.id === 'achievements' ? S.achievements.length
          : t.id === 'status' ? S.statuses.length : '';
      return '<button class="tab" type="button" role="tab" data-dash="' + t.id + '" aria-selected="' + (dashTab === t.id) + '" id="dash-tab-' + t.id + '">' +
        U.icon(t.icon) + '<span>' + t.name + '</span>' + (badge !== '' ? '<span class="tab-badge">' + badge + '</span>' : '') + '</button>';
    }).join('');
    U.$$('[data-dash]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        dashTab = btn.getAttribute('data-dash');
        U.$$('[data-dash]').forEach(function (b) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
        renderPanes();
        ES.audio.play('tab');
      });
    });
    renderPanes();
  }

  function paneShell(title, icon, body, cnt) {
    return '<div class="pane-title">' + U.icon(icon) + U.esc(title) + (cnt !== undefined ? '<span class="cnt">' + cnt + '</span>' : '') + '</div>' + body;
  }

  function panesHtml() {
    const ovr = ES.state.ovr(S), pa = ES.state.pa(S), paInfo = ES.state.paLabel(pa);
    const eff = ES.state.effective(S).attrs;
    const out = {};

    /* 角色卡 */
    const d = ES.state.ovrDetail(S);
    const bond = ES.state.bondOf(S);
    out.character =
      paneShell('选手角色卡', 'id',
        '<div class="pane-block inset corner-marks">' +
          '<div class="charcard">' +
            '<div class="sigil" style="--sig:62px">' + ES.creator.sigilSvg(S.profile.sigil) + '</div>' +
            '<div class="cc-main">' +
              '<div class="cc-name">' + U.esc(S.profile.name) + '<span class="tag" data-tone="cyan">' + U.esc(S.profile.tag) + '</span></div>' +
              '<div class="cc-meta">' + U.esc(S.profile.gender) + ' · ' + S.profile.age + ' 岁 · ' + S.profile.height + 'cm · 外貌 ' + S.profile.look + '</div>' +
              '<div class="cc-meta">' + U.icon("crosshair", "icon-xs") + U.esc(d.pos.name) + ' · ' + U.icon("pin", "icon-xs") + U.esc(S.city ? S.city.name : "") + ' · ' + U.esc(S.club ? S.club.short : "") + '</div>' +
            '</div>' +
            '<div class="cc-ovr">' +
              '<div class="ring ovr-ring">' +
                '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="42"></circle>' +
                '<circle class="ring-val" cx="50" cy="50" r="42" style="stroke-dasharray:' + (2 * Math.PI * 42).toFixed(1) + ';stroke-dashoffset:' + (2 * Math.PI * 42 * (1 - d.total / 100)).toFixed(1) + '"></circle></svg>' +
                '<div class="ring-core"><span class="ring-num">' + d.total + '</span><span class="ring-lab">总评</span></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hairline"></div>' +
          '<div class="row-tight wrap">' +
            '<span class="tag" data-tone="' + (S.cheat ? "red" : "gold") + '">' + U.esc(S.difficultyName) + '</span>' +
            '<span class="tag" data-tone="cyan">' + U.esc(S.mode === "legend" ? "原著传奇" : "自创角色") + '</span>' +
            '<span class="tag" data-tone="' + d.level.tone + '">' + U.esc(d.level.name) + ' · ' + U.esc(d.level.short) + '</span>' +
            '<span class="tag" data-tone="violet">' + U.esc(d.pos.name) + '</span>' +
            '<span class="tag" data-tone="dim">属性上限 ' + (S.special.cap || 85) + '</span>' +
            '<span class="tag" data-tone="dim">气运 ' + Math.round(S.attrs.luck) + '</span>' +
          '</div>' +
          '<div class="hairline"></div>' +
          '<div class="col" style="gap:5px">' +
            '<div class="row-tight small"><span class="dim">性格</span><span>' + (S.profile.traits.map(function (x) { const o = D.TRAITS.filter(function (y) { return y.id === x; })[0]; return o ? o.name : x; }).join(" · ") || "—") + '</span></div>' +
            '<div class="row-tight small"><span class="dim">口头禅</span><span>' + (S.profile.catchphrase ? "「" + U.esc(S.profile.catchphrase) + "」" : "—") + '</span></div>' +
            '<div class="row-tight small"><span class="dim">性向 / 态度</span><span>' + U.esc(S.profile.orientation) + ' · ' + U.esc(S.profile.loveStyle || "—") + '</span></div>' +
            '<div class="row-tight small"><span class="dim">签名</span><span>' + (S.profile.sign ? U.esc(S.profile.sign) : "—") + '</span></div>' +
            '<div class="row-tight small"><span class="dim">本命特工</span><span>' + U.esc((S.agents && S.agents[0]) ? S.agents[0].name : "—") + '</span></div>' +
            '<div class="row-tight small"><span class="dim">队伍羁绊</span><span>' + U.esc(bond.level.name) + ' · 团队战力 +' + Math.round(bond.level.bonus * 100) + '%（' + bond.value + '/100）</span></div>' +
          '</div>' +
          '<div class="hairline"></div>' +
          '<div class="row-tight">' +
            '<button type="button" class="btn btn-sm btn-line" data-open="modal-dossier">' + U.icon("scroll", "icon-xs") + '完整档案</button>' +
            ((S.talents || []).length ? '<button type="button" class="btn btn-sm btn-ghost" data-open="modal-talent">' + U.icon("dna", "icon-xs") + '天赋解析</button>' : "") +
          '</div>' +
        '</div>' +
        ((S.talents || []).length ? '<div class="pane-block inset corner-marks">' + (S.talents || []).map(function (tl) {
          const q = D.QUALITIES[tl.quality] || D.QUALITIES.white;
          return '<div class="talent-item is-selected" data-rarity="' + tl.quality + '" style="cursor:default">' +
            U.icon(tl.icon, "talent-ico") +
            '<span class="talent-body"><span class="talent-name">' + U.esc(tl.name) + '</span>' +
            '<span class="talent-desc">' + tl.lines.map(function (l) { return U.esc(l.name) + " +" + l.v; }).join("、") + '</span></span>' +
            '<span class="talent-badge" data-rarity="' + tl.quality + '">' + U.esc(q.name) + '</span></div>';
        }).join("") + (S.body ? '<div class="alert" data-tone="gold" style="margin-top:8px">' + U.icon("sparkle", "icon-xs") + '<div><b>体质 · ' + U.esc(S.body.name) + '</b><div class="tiny dim-2" style="margin-top:4px">' + U.esc(S.body.desc) + '</div></div></div>' : "") + '</div>' : ""));

    /* 核心属性（五项评定 + 四项辅助 + 气运，附总评演算） */
    const rated = D.ATTRS.filter(function (a) { return a.group === "rated"; });
    const support = D.ATTRS.filter(function (a) { return a.group === "support"; });
    const luckAttr = D.ATTRS.filter(function (a) { return a.group === "luck"; })[0];
    out.attrs = paneShell("核心属性 · 总评演算", "radar",
      radarSvg(S, { size: 300, compare: true }) +
      '<div class="pane-block inset corner-marks">' +
        '<div class="attr-group-lab">评定属性（参与总评）</div>' +
        rated.map(function (a) {
          const isKey = d.key.indexOf(a.k) >= 0;
          const w = d.parts.filter(function (x) { return x.k === a.k; })[0];
          return '<div class="attr-row" data-attr-row="' + a.k + '">' +
            '<span class="k">' + U.icon(a.icon, "icon-xs") + " " + U.esc(a.name) + (isKey ? ' <span class="tag" data-tone="cyan" style="font-size:9px">关键</span>' : "") + '</span>' +
            '<span class="v mono" style="min-width:26px">' + eff[a.k] + '</span>' +
            '<span class="t"><i style="width:' + U.clamp(eff[a.k], 2, 100) + '%"></i></span>' +
            '<span class="v mono dim" style="min-width:44px;text-align:right">×' + Math.round((w ? w.w : 0) * 100) + '%</span></div>';
        }).join("") +
        '<div class="attr-group-lab" style="margin-top:8px">辅助属性（不入总评）</div>' +
        support.map(function (a) { return attrRow(a.k, eff[a.k], "violet"); }).join("") +
        attrRow(luckAttr.k, eff[luckAttr.k], "gold") +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">总评演算（附录N.3 四步）</div>' +
        '<div class="tiny dim-2" style="line-height:2">' +
          '① 基础分 = ' + d.parts.map(function (x) { return U.esc(x.name) + " " + x.v + "×" + Math.round(x.w * 100) + "%"; }).join(" ＋ ") + ' = <b class="acc">' + d.base.toFixed(1) + '</b><br>' +
          '② 关键属性（' + d.key.map(function (k) { return attrName(k); }).join("、") + '）当前 ' + d.keyVals.join(" / ") + ' → 加成 <b class="acc">+' + d.bonus + '</b>，短板惩罚 <b class="warnc">-' + d.penalty + '</b><br>' +
          '③ 最终总评 = clamp(round(' + d.base.toFixed(1) + ' + ' + d.bonus + ' − ' + d.penalty + '), 0, 99) = <b class="acc">' + d.total + '（' + d.level.name + '）</b>' +
        '</div>' +
        '<div class="tiny dim" style="margin-top:8px">等级门槛：0—59 业余 ｜ 60—69 半职业 ｜ 70—79 职业 ｜ 80—89 明星 ｜ 90—99 传奇。加成与惩罚只取最高/最低一档，不叠加。</div>' +
      '</div>' +
      '<div class="alert" data-tone="cyan">' + U.icon("info") + '<div>虚线为<b>属性上限 ' + (S.special.cap || 85) + '</b>（由天赋品质决定）：达到上限后训练只能维持状态，无法继续加值。</div></div>');

    /* 状态与处境 */
    const br = ES.state.breakthroughRate(S);
    out.state = paneShell("状态与处境", "pulse",
      '<div class="pane-block inset corner-marks">' +
        '<div class="col" style="gap:12px">' +
          meterRow("竞技状态", "flame", S.res.condition, 100, S.res.condition < 20 ? "bad" : S.res.condition < 40 ? "warn" : S.res.condition >= 90 ? "good" : "cyan") +
          meterRow("手部健康", "hand", S.res.hand, 100, S.res.hand < 40 ? "bad" : S.res.hand < 65 ? "warn" : "good") +
          meterRow("伤病风险", "warn", S.res.injury, 100, S.res.injury > 60 ? "bad" : S.res.injury > 30 ? "warn" : "good") +
          meterRow("名声", "star", S.special.fame, 100, "gold") +
          meterRow("舆论热度", "message", S.special.heat, 100, S.special.heat > 60 ? "bad" : "cyan") +
        '</div>' +
      '</div>' +
      '<div class="pane-block inset corner-marks">' +
        '<div class="stat-grid">' +
          '<div class="stat-tile" data-tone="cyan"><div class="k">' + U.icon("briefcase", "icon-xs") + '教练信任</div><div class="v">' + Math.round(S.special.coachTrust) + '</div></div>' +
          '<div class="stat-tile" data-tone="cyan"><div class="k">' + U.icon("link", "icon-xs") + '队友信任</div><div class="v">' + Math.round(S.special.teammateTrust) + '</div></div>' +
          '<div class="stat-tile" data-tone="cyan"><div class="k">' + U.icon("heart", "icon-xs") + '粉丝忠诚</div><div class="v">' + Math.round(S.special.fanLoyalty) + '</div></div>' +
          '<div class="stat-tile" data-tone="' + (S.special.antiThreat > 60 ? "bad" : "violet") + '"><div class="k">' + U.icon("warn", "icon-xs") + '黑粉威胁</div><div class="v">' + Math.round(S.special.antiThreat) + '</div></div>' +
          '<div class="stat-tile" data-tone="cyan"><div class="k">' + U.icon("rank", "icon-xs") + '队内地位</div><div class="v">' + Math.round(S.special.standing) + '</div></div>' +
          '<div class="stat-tile" data-tone="gold"><div class="k">' + U.icon("layers", "icon-xs") + '版本红利</div><div class="v">' + Math.round(S.special.versionBonus) + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">突破检定（7.13）</div>' +
        '<div class="small" style="line-height:2">' +
          '当前总评 <b class="acc">' + d.total + '（' + d.level.name + '）</b>' + (ES.state.nextLevel(d.total) ? ' → 下一等级门槛 <b>' + ES.state.nextLevel(d.total) + '</b>' : ' · 已达最高等级') + '<br>' +
          '成功率 = 40 ＋ 关键属性均值 ' + br.keyAvg.toFixed(1) + '×0.3 ＋ 心态×0.15 ＋ 状态修正 ' + br.condMod + ' ＋ 版本红利 ' + br.vBonus + ' ＋ 难度修正 ' + br.diffMod + ' = <b class="acc">' + br.rate + '%</b>' +
        '</div>' +
        '<div class="tiny dim" style="margin-top:8px">掷 1d100 ≤ 成功率即突破成功；失败按轻损 / 心态受挫 / 撞墙期 / 总评下滑 / 心魔发作分级处理。</div>' +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">训练收益（附录AW.1）</div>' +
        '<div class="tiny dim-2" style="line-height:2">收益 = 基础值 5 ＋ 悟性 ' + eff.insight + '×0.3 ＋ 状态 ' + Math.round(S.res.condition) + '×0.1 ＋ 环境系数 × 难度系数 ± 1d6<br>' +
        '环境：' + U.esc((ES.state.effective(S).trainMul < 1 ? "受限" : "正常")) + ' · 连训 ' + (S.metrics.trainStreak || 0) + ' 回合（连续 5 回合触发疲劳预警，8 回合伤病检定概率翻倍）</div>' +
      '</div>');

    /* 特工池（第9章） */
    const AGENT_LEVELS = [[81, "本命"], [61, "专精"], [41, "精通"], [21, "熟练"], [0, "入门"]];
    function agentLevel(m) { for (let i = 0; i < AGENT_LEVELS.length; i++) { if (m >= AGENT_LEVELS[i][0]) return AGENT_LEVELS[i][1]; } return "入门"; }
    out.agents = paneShell("特工池", "layers",
      '<div class="pane-block inset corner-marks">' +
        '<div class="tiny dim" style="margin-bottom:10px">熟练度 0—100：入门 0—20 ｜ 熟练 21—40 ｜ 精通 41—60 ｜ 专精 61—80 ｜ 本命 81—100。本命特工单局使用可叠加「本命加成」。</div>' +
        (S.agents || []).sort(function (a, b) { return b.mastery - a.mastery; }).map(function (a) {
          return '<div class="attr-row" data-attr-row="agent-' + U.esc(a.name) + '">' +
            '<span class="k">' + U.icon("crosshair", "icon-xs") + " " + U.esc(a.name) + (a.signature ? ' <span class="tag" data-tone="gold" style="font-size:9px">本命</span>' : "") + '</span>' +
            '<span class="t"><i style="width:' + U.clamp(a.mastery, 2, 100) + '%"></i></span>' +
            '<span class="v" style="min-width:52px;text-align:right">' + a.mastery + ' <span class="tiny dim">' + agentLevel(a.mastery) + '</span></span></div>';
        }).join("") +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">队伍羁绊（9.4）</div>' +
        '<div class="col" style="gap:8px">' + D.BONDS.map(function (b) {
          const on = bond.level.id === b.id;
          return '<div class="between small" style="opacity:' + (on ? 1 : 0.6) + '"><span>' + (on ? "<b class=\"acc\">" + b.name + "</b>" : b.name) + ' <span class="tiny dim">' + b.desc + '</span></span><span class="mono">+' + Math.round(b.bonus * 100) + '% · 需 ' + b.need + '</span></div>';
        }).join("") + '</div>' +
        (bond.next ? '<div class="tiny dim" style="margin-top:8px">距离「' + bond.next.name + '」还需羁绊 +' + Math.max(0, bond.next.need - bond.value) + '（训练赛、团队合练与共患难可提升）</div>' : "") +
      '</div>');

    /* 状态效果与伤病 */
    out.status = paneShell("伤病与状态效果", "flame",
      '<div class="pane-block inset corner-marks">' +
        (S.statuses.length
          ? '<div class="status-list">' + S.statuses.map(function (st) {
            return '<div class="status-pill" data-tone="' + st.tone + '">' + U.icon(st.icon) +
              '<div><div class="sp-name">' + U.esc(st.name) + '</div><div class="sp-desc">' + U.esc(st.desc) + '</div></div>' +
              '<span class="sp-turns">' + Math.ceil(st.turns) + ' 回合</span></div>';
          }).join("") + '</div>'
          : '<div class="empty">' + U.icon("shield") + '<div class="empty-title">当前无状态效果</div><div class="tiny">伤病、术后康复、疲劳与火热手感都会在此显示</div></div>') +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">健康面板</div>' +
        '<div class="col" style="gap:12px">' +
          meterRow("手部健康", "hand", S.res.hand, 100, S.res.hand < 45 ? "bad" : S.res.hand < 70 ? "warn" : "good") +
          meterRow("竞技状态", "flame", S.res.condition, 100, S.res.condition < 40 ? "bad" : "cyan") +
          meterRow("伤病风险", "warn", S.res.injury, 100, S.res.injury > 50 ? "bad" : "good") +
        '</div>' +
        '<div class="tiny dim" style="margin-top:10px">伤病分级（30.7）：轻伤 3—5 回合 ｜ 中伤 10—20 回合 ｜ 重伤 30 回合以上（可能提前退役）。俱乐部理疗 +50% 恢复，专业康复中心 +100%，硬扛 -30% 且恶化风险翻倍。</div>' +
        '<div class="row-tight" style="margin-top:12px">' +
          '<button type="button" class="btn btn-sm btn-line" data-open="modal-schedule">' + U.icon("clock", "icon-xs") + '安排恢复日程</button>' +
        '</div>' +
      '</div>');

    /* 资源与身价 */
    const mv = ES.state.marketDetail(S);
    out.resource = paneShell("资源与身价", "coin",
      '<div class="pane-block inset corner-marks">' +
        '<div class="stat-grid">' +
          '<div class="stat-tile" data-tone="gold"><div class="k">' + U.icon("bank", "icon-xs") + '现金</div><div class="v" data-money-val>¥' + U.money(S.res.money) + '</div></div>' +
          '<div class="stat-tile" data-tone="cyan"><div class="k">' + U.icon("users", "icon-xs") + '粉丝</div><div class="v">' + U.fmtNum(S.res.fans) + ' 万</div></div>' +
          '<div class="stat-tile" data-tone="violet"><div class="k">' + U.icon("star", "icon-xs") + '名声</div><div class="v">' + Math.round(S.special.fame) + '</div></div>' +
          '<div class="stat-tile" data-tone="gold"><div class="k">' + U.icon("chart", "icon-xs") + '身价估值</div><div class="v">¥' + U.money(mv.value) + '</div></div>' +
        '</div>' +
        '<div class="hairline"></div>' +
        '<div class="col" style="gap:8px">' +
          '<div class="between small"><span class="dim">年薪（合同）</span><span class="mono up">' + (S.club && S.club.signed ? "¥" + U.money(S.club.salary) : "无合同") + '</span></div>' +
          '<div class="between small"><span class="dim">违约金</span><span class="mono warnc">' + (S.club ? "¥" + U.money(S.club.buyout) : "—") + '</span></div>' +
          '<div class="between small"><span class="dim">生活成本 / 月</span><span class="mono down">¥' + U.fmtNum(S.club ? S.club.livingCost : 0) + '</span></div>' +
          '<div class="between small"><span class="dim">直播与商务累计</span><span class="mono up">¥' + U.money(S.metrics.mediaDone * 120000 + S.metrics.streams * 45000) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">身价演算（附录V.1）</div>' +
        '<div class="tiny dim-2" style="line-height:2">身价 = 总评系数 × 人气系数 × 年龄系数 × 荣誉系数 × 合同剩余系数<br>' +
        '= ¥' + U.money(mv.base) + '（' + mv.level.name + '）× ' + mv.fanMul + '（粉丝 ' + U.fmtNum(S.res.fans) + ' 万）× ' + mv.ageMul + '（' + S.profile.age + ' 岁）× ' + mv.honor + '（荣誉）× ' + mv.contractMul + '（合同 ' + ((S.club && S.club.years) || 2) + ' 年）<br>' +
        '= <b class="acc">¥' + U.money(mv.value) + '</b></div>' +
      '</div>' +
      '<div class="pane-block inset corner-marks">' +
        '<div class="sub-title">资源获取途径</div>' +
        '<div class="row-tight wrap">' +
          '<button type="button" class="chip" data-free="开直播和粉丝聊天">' + U.icon("mic", "chip-ico") + '开直播</button>' +
          '<button type="button" class="chip" data-free="接一个品牌代言拍摄">' + U.icon("video", "chip-ico") + '接商务</button>' +
          '<button type="button" class="chip" data-free="研究版本并写复盘笔记">' + U.icon("layers", "chip-ico") + '研究版本</button>' +
          '<button type="button" class="chip" data-free="和粉丝做一次互动">' + U.icon("heart", "chip-ico") + '粉丝互动</button>' +
        '</div>' +
      '</div>');

    /* 俱乐部与合同 */
    out.club = paneShell("俱乐部与合同", "briefcase",
      '<div class="pane-block inset corner-marks">' +
        '<div class="row-tight"><span class="card-glyph" style="width:38px;height:38px">' + U.icon("building", "icon") + '</span>' +
          '<div class="grow"><div class="style-name" style="font-family:var(--font-display);font-size:var(--fs-md)">' + U.esc(S.club ? S.club.name : "无俱乐部") + '</div>' +
          '<div class="tiny dim">' + U.esc(S.club ? S.club.short + " · " + S.club.region + " 赛区 · " + S.club.city : "—") + '</div></div>' +
          '<span class="tag" data-tone="' + (S.club && S.club.signed ? "cyan" : "red") + '">' + (S.club && S.club.signed ? "已签约" : "未签约") + '</span>' +
        '</div>' +
        '<div class="hairline"></div>' +
        '<div class="col" style="gap:6px">' +
          '<div class="between small"><span class="dim">资源分级</span><span class="mono">' + U.esc(S.club ? S.club.tier + " · " + S.club.seat : "—") + '</span></div>' +
          '<div class="between small"><span class="dim">主位置</span><span>' + U.esc(d.pos.name) + '</span></div>' +
          '<div class="between small"><span class="dim">年薪</span><span class="mono">' + (S.club ? "¥" + U.fmtNum(S.club.salary) : "—") + '</span></div>' +
          '<div class="between small"><span class="dim">合同年限</span><span class="mono">' + (S.club ? S.club.years + " 年" : "—") + '</span></div>' +
          '<div class="between small"><span class="dim">违约金</span><span class="mono warnc">' + (S.club ? "¥" + U.money(S.club.buyout) : "—") + '</span></div>' +
          '<div class="between small"><span class="dim">联赛排名</span><span class="mono">第 ' + (S.club ? S.club.rank : "—") + ' / 12</span></div>' +
          '<div class="between small"><span class="dim">赛季预期</span><span class="mono">' + U.esc(S.club ? S.club.expectation : "—") + '</span></div>' +
          '<div class="between small"><span class="dim">队伍羁绊</span><span class="mono">' + U.esc(bond.level.name) + ' +' + Math.round(bond.level.bonus * 100) + '%</span></div>' +
          '<div class="between small"><span class="dim">2025 阵容</span><span class="tiny dim-2" style="max-width:62%;text-align:right">' + U.esc(S.club ? (S.club.roster || []).join("、") : "—") + '</span></div>' +
        '</div>' +
        '<div class="hairline"></div>' +
        '<div class="tiny dim-2">' + U.esc(S.club ? (S.club.style + " · " + (S.club.line || "")) : "") + '</div>' +
        '<div class="row-tight" style="margin-top:10px">' +
          '<button type="button" class="btn btn-sm btn-line" data-open="modal-contract">' + U.icon("contract", "icon-xs") + '合同详情</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-open="modal-calendar">' + U.icon("calendar", "icon-xs") + '赛程</button>' +
        '</div>' +
      '</div>' +
      '<div class="inset" style="padding:12px">' +
        '<div class="sub-title">绩效目标</div>' +
        '<div class="col" style="gap:7px">' + S.quests.filter(function (q) { return q.kind === "main"; }).map(function (q) {
          const p = ES.state.questProgress(S, q);
          return '<div><div class="between small"><span>' + U.esc(q.name) + '</span><span class="mono dim">' + p + "/" + q.target + '</span></div>' +
            '<div class="quest" data-kind="main" style="padding:0;border:0;background:none"><div class="q-bar"><i style="width:' + Math.round((p / q.target) * 100) + '%"></i></div></div></div>';
        }).join("") + '</div>' +
      '</div>');

    /* 任务 */
    out.quests = paneShell('任务列表', 'tasks',
      ['main', 'side', 'daily'].map(function (kind) {
        const label = { main: '主线任务', side: '支线委托', daily: '每日训练' }[kind];
        const list = S.quests.filter(function (q) { return q.kind === kind; });
        return '<div class="pane-block inset corner-marks">' +
          '<div class="row-tight" style="margin-bottom:8px"><span class="sub-title" style="margin:0">' + label + '</span>' +
          '<span class="tag" data-tone="' + (kind === 'main' ? 'gold' : kind === 'daily' ? 'violet' : 'cyan') + '" style="margin-left:auto">' + list.filter(function (q) { return ES.state.questProgress(S, q) >= q.target; }).length + '/' + list.length + '</span></div>' +
          '<div class="col" style="gap:7px">' + list.map(questHtml).join('') + '</div>' +
        '</div>';
      }).join('') +
      '<div class="row-tight"><button type="button" class="btn btn-sm btn-line btn-block" data-open="modal-quests">' + U.icon('list', 'icon-xs') + '查看全部任务</button></div>');

    /* 关系 */
    const groups = [['coach', '教练组'], ['teammate', '队友'], ['manager', '管理层'], ['medic', '医疗'], ['analyst', '分析'], ['agent', '经纪'], ['friend', '圈内好友'], ['bench', '竞争者'], ['rival', '宿敌'], ['partner', '关系候选']];
    out.relations = paneShell('关系列表', 'link',
      groups.map(function (g) {
        const list = S.relations.filter(function (r) { return r.type === g[0]; });
        if (!list.length) return '';
        return '<div class="pane-block inset corner-marks">' +
          '<div class="row-tight" style="margin-bottom:8px"><span class="sub-title" style="margin:0">' + g[1] + '</span><span class="tag" data-tone="dim" style="margin-left:auto">' + list.length + ' 人</span></div>' +
          '<div class="col" style="gap:6px">' + list.map(relHtml).join('') + '</div></div>';
      }).join(''));

    /* 情缘 */
    const partner = S.relations.filter(function (r) { return r.id === S.romance.npcId; })[0];
    const stateMap = { single: '单身', ambiguous: '暧昧', dating: '交往中', public: '已公开', longdistance: '异地', breakup: '已分手' };
    out.romance = paneShell('情缘状态', 'heart',
      '<div class="pane-block inset corner-marks">' +
        '<div class="row-tight"><span class="tag" data-tone="' + (S.romance.state === 'single' ? 'dim' : 'red') + '">' + (stateMap[S.romance.state] || '单身') + '</span>' +
        '<span class="tiny dim" style="margin-left:auto">公开度 ' + S.romance.public + '%</span></div>' +
        (partner
          ? '<div class="lrow" data-npc="' + partner.id + '"><span class="lrow-ava">' + U.esc(partner.name.slice(0, 1)) + '</span>' +
            '<span class="lrow-main"><span class="lrow-name">' + U.esc(partner.name) + '</span><span class="lrow-sub">' + U.esc(partner.role) + '</span></span>' +
            '<span class="lrow-side"><span class="mono small">' + Math.round(partner.affection) + '</span><span class="mini-meter" data-tone="love"><i style="width:' + partner.affection + '%"></i></span></span></div>'
          : '<div class="empty">' + U.icon('heart') + '<div class="empty-title">目前没有情感线</div><div class="tiny">关系可能在赛后、直播或日常场景中发展</div></div>') +
        '<div class="row-tight"><button type="button" class="btn btn-sm btn-line btn-block" data-open="modal-romance">' + U.icon('link', 'icon-xs') + '查看情缘详情</button></div>' +
      '</div>' +
      '<div class="alert" data-tone="violet">' + U.icon('info') + '<div>感情状态会影响<b>心态恢复速度</b>与<b>舆论风险</b>，公开关系后商务机会增加，但负面事件伤害加倍。</div></div>');

    /* 快讯 */
    out.news = paneShell('世界快讯', 'globe',
      '<div class="pane-block inset corner-marks">' +
        '<div class="col" style="gap:7px">' + S.news.slice(0, 5).map(function (n) {
          const cat = { transfer: '转会', patch: '版本', match: '赛事', media: '舆论', injury: '伤病', biz: '商业' }[n.cat] || '快讯';
          return '<button type="button" class="lrow" data-news="' + n.id + '">' +
            '<span class="lrow-ava" style="font-size:10px">' + cat + '</span>' +
            '<span class="lrow-main"><span class="lrow-name">' + U.esc(n.title) + '</span>' +
            '<span class="lrow-sub">' + U.esc(n.source) + ' · 热度 ' + n.heat + '</span></span>' +
            '<span class="lrow-side">' + U.icon('chev-r', 'icon-xs') + '</span></button>';
        }).join('') + '</div>' +
        '<div class="row-tight" style="margin-top:4px"><button type="button" class="btn btn-sm btn-line btn-block" data-open="modal-news">' + U.icon('list', 'icon-xs') + '查看全部快讯</button></div>' +
      '</div>');

    /* 成就 */
    const recent = S.achievements.slice(-4).reverse();
    out.achievements = paneShell('最近成就', 'medal',
      '<div class="pane-block inset corner-marks">' +
        (recent.length ? '<div class="col" style="gap:7px">' + recent.map(function (id) {
          const a = D.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
          if (!a) return '';
          return '<div class="lrow" data-rarity="' + a.rar + '" style="cursor:default">' +
            '<span class="lrow-ava" style="color:var(--rar);border-color:var(--rar)">' + U.icon('medal') + '</span>' +
            '<span class="lrow-main"><span class="lrow-name" style="color:var(--rar)">' + U.esc(a.name) + '</span>' +
            '<span class="lrow-sub">' + U.esc(a.desc) + '</span></span>' +
            '<span class="lrow-side tag" data-tone="gold">+' + a.pts + '</span></div>';
        }).join('') + '</div>'
          : '<div class="empty">' + U.icon('medal') + '<div class="empty-title">尚未解锁成就</div><div class="tiny">完成首胜、签约、夺冠等里程碑即可解锁</div></div>') +
        '<div class="between" style="margin-top:10px"><span class="small dim">成就点</span><span class="mono gold">' + ES.state.achievementPoints(S) + '</span></div>' +
        '<div class="row-tight"><button type="button" class="btn btn-sm btn-line btn-block" data-open="modal-achievements">' + U.icon('medal', 'icon-xs') + '成就殿堂</button></div>' +
      '</div>');
    return out;
  }

  function questHtml(q) {
    const p = ES.state.questProgress(S, q);
    const done = p >= q.target;
    const rw = [];
    if (q.reward.money) rw.push('<span class="tag" data-tone="gold">' + U.icon('coin', 'icon-xs') + '¥' + U.money(q.reward.money) + '</span>');
    if (q.reward.res) Object.keys(q.reward.res).forEach(function (k) {
      const map = { fame: '知名度', popularity: '人气', hand: '手部健康', mood: '心态', energy: '体力' };
      const v = q.reward.res[k];
      rw.push('<span class="tag" data-tone="' + (v > 0 ? 'cyan' : 'red') + '">' + (map[k] || k) + ' ' + (v > 0 ? '+' : '') + v + '</span>');
    });
    if (q.reward.special) Object.keys(q.reward.special).forEach(function (k) { rw.push('<span class="tag" data-tone="violet">' + attrName(k) + ' +' + q.reward.special[k] + '</span>'); });
    if (q.reward.attrs) Object.keys(q.reward.attrs).forEach(function (k) { rw.push('<span class="tag" data-tone="cyan">' + attrName(k) + ' +' + q.reward.attrs[k] + '</span>'); });
    return '<div class="quest" data-kind="' + q.kind + '">' +
      '<div class="q-top">' + U.icon(done ? 'check' : (q.kind === 'main' ? 'flag' : q.kind === 'daily' ? 'refresh' : 'target'), 'icon-xs') +
        '<span class="q-name" style="' + (done ? 'color:var(--green)' : '') + '">' + U.esc(q.name) + '</span>' +
        '<span class="q-ddl">' + (q.deadline ? q.deadline + ' 天内' : '每日') + '</span></div>' +
      '<div class="q-desc">' + U.esc(q.desc) + '</div>' +
      '<div class="q-bar"><i style="width:' + Math.round((p / q.target) * 100) + '%"></i></div>' +
      '<div class="between tiny dim"><span>进度 ' + p + ' / ' + q.target + '</span><span>' + (done ? '已完成' : '进行中') + '</span></div>' +
      (rw.length ? '<div class="q-reward">' + rw.join('') + '</div>' : '') +
    '</div>';
  }
  function relHtml(r) {
    const tone = r.type === 'rival' ? 'bad' : r.affection >= 70 ? 'good' : r.affection < 35 ? 'warn' : 'cyan';
    return '<button type="button" class="lrow" data-npc="' + r.id + '">' +
      '<span class="lrow-ava">' + U.esc(r.name.slice(0, 1)) + '</span>' +
      '<span class="lrow-main"><span class="lrow-name">' + U.esc(r.name) + '<span class="tiny dim">' + U.esc(r.tag) + '</span></span>' +
      '<span class="lrow-sub">' + U.esc(r.role) + '</span></span>' +
      '<span class="lrow-side"><span class="mono small">' + Math.round(r.affection) + '</span><span class="mini-meter" data-tone="' + tone + '"><i style="width:' + r.affection + '%"></i></span></span>' +
    '</button>';
  }

  function renderPanes() {
    const host = U.$('#dash-panes');
    if (!host || !S) return;
    const html = panesHtml();
    host.innerHTML = DASH_TABS.map(function (t) {
      return '<div class="dash-pane' + (t.id === dashTab ? ' is-active' : '') + '" data-pane-id="' + t.id + '" role="tabpanel">' + (html[t.id] || '') + '</div>';
    }).join('');
  }

  /* ══════════ 完整看板（模态） ══════════ */
  function renderBoard() {
    const host = U.$('#board-grid');
    if (!host || !S) return;
    const html = panesHtml();
    host.innerHTML = DASH_TABS.map(function (t) {
      return '<section class="dash-pane is-active" data-board-card="' + t.id + '" style="background:var(--panel);border:1px solid var(--line);clip-path:var(--clip-card);padding:14px">' + html[t.id] + '</section>';
    }).join('');
  }

  /* ══════════ 档案模态 ══════════ */
  function renderDossier() {
    if (!S) return;
    const ovr = ES.state.ovr(S), pa = ES.state.pa(S), paInfo = ES.state.paLabel(pa);
    U.$('#dossier-file-no').textContent = 'HKG-' + String(Math.abs(hash(S.profile.tag)) % 1000000).padStart(6, '0');
    U.$('#dossier-sync').textContent = ES.state.timeText(S);
    const ev = ES.state.evaluation(S);
    U.$('#dossier-head-host').innerHTML =
      '<div class="row" style="gap:20px;align-items:flex-start">' +
        '<div class="sigil" style="--sig:88px">' + ES.creator.sigilSvg(S.profile.sigil) + '</div>' +
        '<div class="grow">' +
          '<div class="row-tight" style="gap:10px"><span class="display" style="font-size:var(--fs-2xl)">' + U.esc(S.profile.name) + '</span>' +
          '<span class="tag" data-tone="cyan">' + U.esc(S.profile.tag) + '</span>' +
          '<span class="tag" data-tone="gold">' + U.esc(S.difficultyName) + '</span></div>' +
          '<div class="row-tight wrap" style="margin-top:8px">' +
            '<span class="tag" data-tone="dim">' + U.esc(S.profile.gender) + '</span>' +
            '<span class="tag" data-tone="dim">' + S.profile.age + ' 岁</span>' +
            '<span class="tag" data-tone="dim">' + S.profile.height + ' cm</span>' +
            '<span class="tag" data-tone="dim">外貌 ' + S.profile.look + '/10</span>' +
            '<span class="tag" data-tone="dim">' + U.esc(S.profile.orientation) + '</span>' +
            '<span class="tag" data-tone="violet">' + U.esc(ES.state.positionOf(S).name) + '</span>' +
          '</div>' +
          '<div class="row-tight wrap" style="margin-top:8px">' +
            S.profile.traits.map(function (t) { const o = D.TRAITS.filter(function (x) { return x.id === t; })[0]; return o ? '<span class="tag" data-tone="cyan">' + U.icon(o.icon, 'icon-xs') + U.esc(o.name) + '</span>' : ''; }).join('') +
            (S.profile.catchphrase ? '<span class="tag" data-tone="gold">「' + U.esc(S.profile.catchphrase) + '」</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="row" style="gap:16px">' +
          '<div class="ring" style="--ring-size:92px"><svg viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="ring-bg" cx="50" cy="50" r="42"></circle>' +
            '<circle class="ring-val" cx="50" cy="50" r="42" style="stroke-dasharray:' + (2 * Math.PI * 42).toFixed(1) + ';stroke-dashoffset:' + (2 * Math.PI * 42 * (1 - ovr / 100)).toFixed(1) + '"></circle></svg>' +
            '<div class="ring-core"><span class="ring-num">' + ovr + '</span><span class="ring-lab">OVR ' + ES.state.ovrGrade(ovr) + '</span></div></div>' +
          '<div class="ring" style="--ring-size:92px"><svg viewBox="0 0 100 100" aria-hidden="true">' +
            '<circle class="ring-bg" cx="50" cy="50" r="42"></circle>' +
            '<circle class="ring-val" cx="50" cy="50" r="42" style="stroke:var(--amber);stroke-dasharray:' + (2 * Math.PI * 42).toFixed(1) + ';stroke-dashoffset:' + (2 * Math.PI * 42 * (1 - pa / 100)).toFixed(1) + '"></circle></svg>' +
            '<div class="ring-core"><span class="ring-num">' + pa + '</span><span class="ring-lab">POT ' + U.esc(paInfo.t.split(' · ')[0]) + '</span></div></div>' +
        '</div>' +
      '</div>';

    U.$('#dossier-overview-grid').innerHTML = [
      ['生涯回合', S.time.turn, 'pulse'], ['总抉择数', S.stats.choices, 'target'],
      ['比赛场次', S.stats.matches, 'sword'], ['胜率', (S.stats.matches ? Math.round((S.stats.wins / S.stats.matches) * 100) : 0) + '%', 'trend-up'],
      ['综合评分', ovr, 'chart'], ['成就点', ES.state.achievementPoints(S), 'medal'],
      ['当前资金', '¥' + U.money(S.res.money), 'bank'], ['联赛排名', '第 ' + S.club.rank + ' 位', 'rank']
    ].map(function (t) {
      return '<div class="stat-tile"><div class="k">' + U.icon(t[2], 'icon-xs') + t[0] + '</div><div class="v">' + t[1] + '</div></div>';
    }).join('');

    U.$('#dossier-bio-host').innerHTML =
      '<div class="col" style="gap:10px">' +
        '<div class="alert" data-tone="cyan">' + U.icon('briefcase') + '<div><b>出身</b>：' + U.esc((D.ORIGINS.filter(function (o) { return o.id === S.origin; })[0] || {}).name || '') +
          ' — ' + U.esc((D.ORIGINS.filter(function (o) { return o.id === S.origin; })[0] || {}).storyLine || '') + '</div></div>' +
        '<div class="alert" data-tone="cyan">' + U.icon('pin') + '<div><b>起始地点</b>：' + U.esc(S.city ? S.city.name : '') + ' · ' + U.esc(S.city ? S.city.perk : '') + '</div></div>' +
        '<div class="alert" data-tone="cyan">' + U.icon('calendar') + '<div><b>时间线</b>：' + U.esc((D.TIMELINES.filter(function (t) { return t.id === S.timelineId; })[0] || {}).tagline || '') + '</div></div>' +
        '<div class="row-tight wrap"><span class="tag" data-tone="gold">荣誉记录 ' + S.stats.honorList.length + ' 项</span>' +
          S.stats.honorList.slice(0, 6).map(function (h) { return '<span class="tag" data-tone="dim">' + U.icon('trophy', 'icon-xs') + U.esc(h) + '</span>'; }).join('') + '</div>' +
      '</div>';

    U.$('#dossier-radar-host').innerHTML = radarSvg(S, { size: 420, compare: true });
    const eff = ES.state.effective(S).attrs;
    U.$('#dossier-attr-list').innerHTML = D.ATTRS.map(function (a) {
      const isKey = ES.state.positionOf(S).key.indexOf(a.k) >= 0;
      const tone = a.group === 'luck' ? 'gold' : a.group === 'support' ? 'violet' : (eff[a.k] >= 85 ? 'gold' : '');
      return '<div class="attr-row" data-attr-row="' + a.k + '"><span class="k">' + U.icon(a.icon, 'icon-xs') + ' ' + U.esc(a.name) + (isKey ? ' ★' : '') + '</span>' +
        '<span class="t"><i' + (tone ? ' data-tone="' + tone + '"' : '') + ' style="width:' + U.clamp(eff[a.k], 2, 100) + '%"></i></span>' +
        '<span class="v">' + eff[a.k] + '</span></div>';
    }).join('');
    const DOSSIER_ROWS = [
      ['竞技状态', S.res.condition, 'flame'], ['手部健康', S.res.hand, 'hand'], ['伤病风险', S.res.injury, 'warn'],
      ['名声', S.special.fame, 'star'], ['舆论热度', S.special.heat, 'message'], ['队内地位', S.special.standing, 'rank'],
      ['教练信任', S.special.coachTrust, 'briefcase'], ['队友信任', S.special.teammateTrust, 'link'],
      ['粉丝忠诚', S.special.fanLoyalty, 'heart'], ['黑粉威胁', S.special.antiThreat, 'warn'],
      ['版本红利', S.special.versionBonus, 'layers'], ['属性上限', S.special.cap, 'chart']
    ];
    U.$('#dossier-special-list').innerHTML = DOSSIER_ROWS.map(function (a) {
      const bad = (a[0] === '黑粉威胁' || a[0] === '伤病风险' || a[0] === '舆论热度') && a[1] > 60;
      return '<div class="attr-row"><span class="k">' + U.icon(a[2], 'icon-xs') + ' ' + U.esc(a[0]) + '</span>' +
        '<span class="t"><i' + (bad ? ' data-tone="bad"' : '') + ' style="width:' + U.clamp(a[1], 2, 100) + '%"></i></span><span class="v">' + Math.round(a[1]) + '</span></div>';
    }).join('');

    U.$('#dossier-timeline').innerHTML = buildCareerTimeline();
    U.$('#dossier-stats-body').innerHTML = (S.stats.seasonRows.length ? S.stats.seasonRows : [{
      season: 'S' + S.time.season, club: S.club.short, matches: S.stats.matches, kda: kdaOf(S), kp: '—', dpm: '—', ovr: ovr, honor: '生涯进行中'
    }]).map(function (r) {
      return '<tr><td class="mono">' + U.esc(r.season) + '</td><td>' + U.esc(r.club) + '</td><td class="num">' + r.matches + '</td>' +
        '<td class="num hl">' + U.esc(r.kda) + '</td><td class="num">' + U.esc(r.kp) + '</td><td class="num">' + U.esc(r.dpm) + '</td>' +
        '<td class="num">' + r.ovr + '</td><td>' + U.esc(r.honor) + '</td></tr>';
    }).join('');
    U.$('#dossier-trend-host').innerHTML = sparklineSvg(trendValues(S, 'aim', 20), { height: 70, color: 'var(--accent)' }) +
      '<div class="row-tight tiny dim" style="margin-top:6px"><span>近期状态曲线</span><span style="margin-left:auto" class="mono">评估 ' + ev.total + ' / 100</span></div>';

    const flagList = Object.keys(S.flags).filter(function (k) { return S.flags[k]; });
    U.$('#dossier-flags-host').innerHTML = flagList.length
      ? '<div class="row-tight wrap">' + flagList.map(function (k) { return '<span class="tag" data-tone="cyan">' + U.esc(k) + '</span>'; }).join('') + '</div>'
      : '<div class="empty">' + U.icon('flag') + '<div class="empty-title">暂无剧情标记</div></div>';

    U.$('#dossier-eval-host') && (U.$('#dossier-eval-host').innerHTML = '');
  }
  function kdaOf(S) {
    return ((S.stats.kills + S.stats.assists) / Math.max(1, S.stats.deaths)).toFixed(2);
  }
  function hash(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i++) { h = (h << 5) - h + String(str).charCodeAt(i); h |= 0; }
    return h;
  }
  function buildCareerTimeline() {
    const items = [];
    items.push({ time: '建档', title: '职业生涯开始', desc: S.difficultyName + ' · ' + (D.ORIGINS.filter(function (o) { return o.id === S.origin; })[0] || {}).name + ' · ' + (S.city ? S.city.name : ''), state: 'done' });
    if (S.club.signed) items.push({ time: '签约', title: '加入 ' + S.club.name, desc: ES.state.positionOf(S).name + ' · 年薪 ¥' + U.fmtNum(S.club.salary) + ' · ' + S.club.years + ' 年合同', state: 'done' });
    if (S.flags.playoff) items.push({ time: '季后赛', title: '挺进季后赛', desc: '常规赛排名前六，进入淘汰赛阶段。', state: 'done' });
    if (S.flags.worlds) items.push({ time: '世界冠军赛', title: '获得世界冠军赛资格', desc: '代表赛区出战 VCT 国际赛事。', state: 'done' });
    if (S.flags.champion) items.push({ time: '夺冠', title: '举起了冠军奖杯', desc: '这一年属于你。', state: 'done' });
    if (S.flags.surgery) items.push({ time: '伤病', title: '接受手腕手术', desc: '赛季报销，换取完整的未来。', state: 'done' });
    items.push({ time: '当前', title: S.time.phase + ' · 第 ' + S.time.week + ' 周', desc: '回合 ' + S.time.turn + ' · ' + ES.state.timeText(S), state: 'active' });
    return items.map(function (it) {
      return '<div class="tl-item" data-state="' + it.state + '"><div class="tl-time">' + U.esc(it.time) + '</div>' +
        '<div class="tl-title">' + U.esc(it.title) + '</div><div class="tl-desc">' + U.esc(it.desc) + '</div></div>';
    }).join('');
  }

  /* ══════════ 任务模态 ══════════ */
  function renderQuests() {
    const host = U.$('#quests-list');
    if (!host) return;
    const list = S.quests.filter(function (q) { return q.kind === questFilter; });
    host.innerHTML = list.length ? list.map(questHtml).join('') : '<div class="empty">' + U.icon('tasks') + '<div class="empty-title">暂无任务</div></div>';
    U.$$('[data-quest-filter]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-quest-filter') === questFilter ? 'true' : 'false'); });
  }

  /* ══════════ 成就模态 ══════════ */
  function renderAchievements() {
    if (!S) return;
    const total = D.ACHIEVEMENTS.length, got = S.achievements.length;
    U.$('#ach-count').textContent = got;
    U.$('#ach-total').textContent = total;
    U.$('#ach-points').textContent = ES.state.achievementPoints(S);
    const C = 2 * Math.PI * 42;
    const arc = U.$('#ach-ring-arc');
    arc.style.strokeDasharray = C;
    arc.style.strokeDashoffset = C * (1 - got / total);
    U.$('#ach-ring-num').textContent = Math.round((got / total) * 100) + '%';
    U.$('#ach-rarity-stats').innerHTML = D.QUALITY_ORDER.map(function (q) {
      const list = D.ACHIEVEMENTS.filter(function (a) { return a.rar === q; });
      const have = list.filter(function (a) { return S.achievements.indexOf(a.id) >= 0; }).length;
      return '<span class="tag" data-rarity="' + q + '" style="--rar:var(--rarity-' + (q === 'white' ? 'white' : q) + ')">' +
        '<span style="color:var(--rarity-' + q + ')">' + D.QUALITIES[q].name + '</span>' + have + '/' + list.length + '</span>';
    }).join('');
    const list = D.ACHIEVEMENTS.filter(function (a) {
      const un = S.achievements.indexOf(a.id) >= 0;
      return achFilter === 'all' || (achFilter === 'unlocked' ? un : !un);
    });
    U.$('#ach-list').innerHTML = list.map(function (a) {
      const un = S.achievements.indexOf(a.id) >= 0;
      return '<div class="lrow" data-rarity="' + a.rar + '" style="cursor:default;' + (un ? '' : 'opacity:.55') + '">' +
        '<span class="lrow-ava" style="color:var(--rarity-' + a.rar + ');border-color:var(--rarity-' + a.rar + ')">' + U.icon(un ? 'medal' : 'lock') + '</span>' +
        '<span class="lrow-main"><span class="lrow-name" style="color:' + (un ? 'var(--rarity-' + a.rar + ')' : 'var(--txt-2)') + '">' + U.esc(a.name) + '</span>' +
        '<span class="lrow-sub">' + U.esc(a.desc) + '</span></span>' +
        '<span class="lrow-side"><span class="tag" data-tone="' + (un ? 'gold' : 'dim') + '">' + (un ? '+' + a.pts : '未解锁') + '</span></span></div>';
    }).join('') || '<div class="empty">' + U.icon('medal') + '<div class="empty-title">没有符合条件的成就</div></div>';
    U.$$('[data-ach-filter]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-ach-filter') === achFilter ? 'true' : 'false'); });
  }

  /* ══════════ 快讯模态 ══════════ */
  function renderNews() {
    if (!S) return;
    const catName = { transfer: '转会', patch: '版本', match: '赛事', media: '舆论', injury: '伤病', biz: '商业' };
    const list = S.news.filter(function (n) { return newsFilter === 'all' || n.cat === newsFilter; });
    U.$('#news-list').innerHTML = list.map(function (n) {
      const on = newsSelected === n.id;
      return '<button type="button" class="lrow' + (on ? ' is-active' : '') + '" data-news="' + n.id + '">' +
        '<span class="lrow-ava" style="font-size:10px">' + (catName[n.cat] || '快讯') + '</span>' +
        '<span class="lrow-main"><span class="lrow-name">' + U.esc(n.title) + '</span>' +
        '<span class="lrow-sub">' + U.esc(n.source) + ' · ' + U.esc(n.time) + '</span></span>' +
        '<span class="lrow-side"><span class="tag" data-tone="' + (n.heat > 70 ? 'red' : n.heat > 40 ? 'gold' : 'dim') + '">热度 ' + n.heat + '</span></span></button>';
    }).join('') || '<div class="empty">' + U.icon('globe') + '<div class="empty-title">该分类暂无快讯</div></div>';
    const sel = S.news.filter(function (n) { return n.id === newsSelected; })[0] || list[0];
    if (sel) {
      newsSelected = sel.id;
      U.$('#news-detail').innerHTML =
        '<div class="row-tight" style="margin-bottom:10px"><span class="tag" data-tone="cyan">' + U.esc(catName[sel.cat] || '快讯') + '</span>' +
        '<span class="tag" data-tone="dim">热度 ' + sel.heat + '</span><span class="tiny dim" style="margin-left:auto">' + U.esc(sel.time) + '</span></div>' +
        '<div class="display" style="font-size:var(--fs-lg);line-height:1.5;margin-bottom:10px">' + U.esc(sel.title) + '</div>' +
        '<p class="story-p small">' + U.esc(sel.body) + '</p>' +
        '<div class="hairline" style="margin:12px 0"></div>' +
        '<div class="between small"><span class="dim">来源</span><span>' + U.esc(sel.source) + '</span></div>' +
        '<div class="between small"><span class="dim">对本人的影响</span><span class="' + (sel.cat === 'injury' || sel.cat === 'media' ? 'down' : 'up') + '">' +
          (sel.cat === 'transfer' ? '转会市场活跃' : sel.cat === 'patch' ? '需重新适应版本' : sel.cat === 'media' ? '舆论压力上升' : sel.cat === 'injury' ? '伤病风险被关注' : sel.cat === 'biz' ? '商业机会增加' : '赛程信息更新') + '</span></div>' +
        '<div class="row-tight" style="margin-top:12px"><button type="button" class="btn btn-sm btn-line" id="btn-news-react">' + U.icon('message', 'icon-xs') + '在直播中回应</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" id="btn-news-ignore">' + U.icon('eye', 'icon-xs') + '静观其变</button></div>';
      const react = U.$('#btn-news-react');
      if (react) react.addEventListener('click', function () {
        ES.util.closeModal('modal-news');
        ES.narrative.freeAction('就这条新闻在直播里和粉丝聊聊：' + sel.title);
      });
      const ig = U.$('#btn-news-ignore');
      if (ig) ig.addEventListener('click', function () {
        U.toast({ tone: 'info', title: '已忽略该快讯', msg: '快讯会在 2-3 个回合后自然降温。' });
      });
    }
    U.$$('[data-news-filter]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-news-filter') === newsFilter ? 'true' : 'false'); });
  }

  /* ══════════ 关系模态 ══════════ */
  function renderNpc(id) {
    const r = S.relations.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    U.$('#npc-sub').textContent = r.role + ' · ' + r.name + '（' + r.tag + '）';
    const trend = trendValues({ attrs: { lane: r.affection }, special: {} }, 'lane', 12);
    U.$('#npc-body').innerHTML =
      '<div class="row" style="gap:16px;align-items:flex-start">' +
        '<div class="sigil" style="--sig:72px">' + ES.creator.sigilSvg(hash(r.name) % 8) + '</div>' +
        '<div class="grow">' +
          '<div class="row-tight"><span class="display" style="font-size:var(--fs-xl)">' + U.esc(r.name) + '</span>' +
          '<span class="tag" data-tone="dim mono">' + U.esc(r.tag) + '</span>' +
          '<span class="tag" data-tone="' + (r.type === 'rival' ? 'red' : 'cyan') + '">' + U.esc(r.role) + '</span></div>' +
          '<p class="story-p small" style="margin-top:8px">' + U.esc(r.persona) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="hairline" style="margin:16px 0"></div>' +
      '<div class="col" style="gap:12px">' +
        meterRow('好感度', 'heart', r.affection, 100, r.affection >= 70 ? 'good' : r.affection < 35 ? 'bad' : 'cyan') +
        meterRow('信任度', 'link', r.trust, 100, r.trust >= 70 ? 'good' : r.trust < 35 ? 'bad' : 'violet') +
      '</div>' +
      '<div class="sec-title" style="margin-top:18px">' + U.icon('trend-up') + '好感趋势</div>' +
      sparklineSvg(trend, { height: 56 }) +
      '<div class="sec-title" style="margin-top:18px">' + U.icon('clock') + '互动记录</div>' +
      '<div class="timeline">' +
        (r.events.length ? r.events.slice(-6).reverse().map(function (e) {
          return '<div class="tl-item" data-state="done"><div class="tl-time">' + U.esc(e.time) + '</div><div class="tl-title">' + U.esc(e.title) + '</div><div class="tl-desc">' + U.esc(e.desc) + '</div></div>';
        }).join('') : '<div class="tl-item" data-state="active"><div class="tl-time">' + ES.state.timeText(S) + '</div><div class="tl-title">关系建立</div><div class="tl-desc">你们在基地第一次正式交谈，彼此都还在试探。</div></div>') +
      '</div>' +
      '<div class="sec-title" style="margin-top:18px">' + U.icon('message') + '互动选项</div>' +
      '<div class="pick-grid" data-cols="2">' +
        '<button type="button" class="chip" data-free="约' + U.esc(r.name) + '单独吃顿饭聊聊">' + U.icon('users', 'chip-ico') + '约饭谈心</button>' +
        '<button type="button" class="chip" data-free="邀请' + U.esc(r.name) + '一起复盘训练赛录像">' + U.icon('cpu', 'chip-ico') + '一起复盘</button>' +
        '<button type="button" class="chip" data-free="和' + U.esc(r.name) + '开黑打几局排位">' + U.icon('monitor', 'chip-ico') + '一起排位</button>' +
        '<button type="button" class="chip" data-free="送' + U.esc(r.name) + '一份小心意，感谢他的帮助">' + U.icon('heart', 'chip-ico') + '表达感谢</button>' +
      '</div>';
    U.openModal('modal-npc');
  }

  /* ══════════ 合同模态 ══════════ */
  function renderContract() {
    if (!S) return;
    const c = S.club;
    U.$('#contract-club-host').innerHTML =
      '<div class="row" style="gap:18px;align-items:center">' +
        '<span class="card-glyph" style="width:56px;height:56px;color:' + c.color + '">' + U.icon('building', 'icon-2xl') + '</span>' +
        '<div class="grow">' +
          '<div class="row-tight"><span class="display" style="font-size:var(--fs-xl)">' + U.esc(c.name) + '</span>' +
          '<span class="tag" data-tone="cyan mono">' + U.esc(c.short) + '</span>' +
          '<span class="tag" data-tone="gold">' + U.esc(c.tier) + ' 级战队</span>' +
          '<span class="tag" data-tone="' + (c.signed ? 'green' : 'red') + '">' + (c.signed ? '合同生效中' : '未签约') + '</span></div>' +
          '<div class="tiny dim" style="margin-top:4px">' + U.esc(c.league) + ' · ' + U.esc(c.role) + ' · 赛季预期：' + U.esc(c.expectation) + '</div>' +
        '</div>' +
        '<div class="stat-grid" style="grid-template-columns:repeat(3,minmax(90px,1fr));flex:none">' +
          '<div class="stat-tile" data-tone="gold"><div class="k">月薪</div><div class="v">¥' + U.money(c.salary) + '</div></div>' +
          '<div class="stat-tile"><div class="k">年限</div><div class="v">' + c.years + '<span class="u">年</span></div></div>' +
          '<div class="stat-tile" data-tone="warn"><div class="k">违约金</div><div class="v">¥' + U.money(c.buyout) + '</div></div>' +
        '</div>' +
      '</div>';

    const terms = [
      ['薪资结构', '底薪 ¥' + U.fmtNum(c.salary) + ' / 月，按季度发放，含成绩奖金条款（' + (S.flags.bonusClause ? '已谈判：赛事奖金 30% 分成' : '默认：赛事奖金 15% 分成') + '）', '奖金条款依赖冠军，未达预期将影响续约'],
      ['合同期限', c.years + ' 年（至 ' + (S.time.year + c.years) + ' 年 ' + S.time.month + ' 月）' + (S.flags.shortContract ? ' · 已谈判为短期合同' : ''), '提前解约需支付全额违约金'],
      ['违约金', '¥' + U.fmtNum(c.buyout) + '（含训练培养成本摊销）', '违约金过高会锁死转会自由'],
      ['直播义务', S.flags.streamerDuty ? '每月至少 8 场直播，每场不少于 2 小时' : '每月至少 4 场直播，每场不少于 2 小时', '缺席一次罚款 ¥20,000 并扣减教练信任'],
      ['训练义务', '每日训练赛 + 排位合计不少于 8 小时' + (S.flags.studentDuty ? '（学生身份已申请减免至 6 小时）' : ''), '超时训练累积疲劳，提升伤病概率'],
      ['肖像与商务', '俱乐部享有 60% 肖像权收益分成，个人代言需报备', '私接代言可能触发违约'],
      ['竞业限制', '合同期内不得与其他战队接触，转会窗口除外', '违规接触将被联盟处罚'],
      ['健康条款', '俱乐部承担康复治疗费用，但有权要求伤情评估', '隐瞒伤情属于违约行为']
    ];
    U.$('#contract-terms-body').innerHTML = terms.map(function (t) {
      return '<tr><td><b>' + U.esc(t[0]) + '</b></td><td>' + U.esc(t[1]) + '</td><td class="down">' + U.esc(t[2]) + '</td></tr>';
    }).join('');

    U.$('#contract-perf-list').innerHTML = S.quests.filter(function (q) { return q.kind === 'main' || q.kind === 'side'; }).map(function (q) {
      const p = ES.state.questProgress(S, q), done = p >= q.target;
      return '<div class="quest" data-kind="' + q.kind + '">' +
        '<div class="q-top">' + U.icon(done ? 'check' : 'target', 'icon-xs') + '<span class="q-name">' + U.esc(q.name) + '</span>' +
        '<span class="q-ddl">' + q.deadline + ' 天内</span></div>' +
        '<div class="q-desc">' + U.esc(q.desc) + '</div>' +
        '<div class="q-bar"><i style="width:' + Math.round((p / q.target) * 100) + '%"></i></div>' +
        '<div class="between tiny dim"><span>进度 ' + p + ' / ' + q.target + '</span><span>' + (done ? '已达成' : '未达成') + '</span></div></div>';
    }).join('') +
      '<div class="alert" data-tone="warn">' + U.icon('warn') + '<div>未达成的主线目标将影响赛季末的续约报价与教练信任。</div></div>';

    U.$('#contract-squad-list').innerHTML = S.relations.filter(function (r) { return r.type === 'teammate' || r.type === 'bench' || r.type === 'coach'; }).map(function (r) {
      return '<button type="button" class="lrow" data-npc="' + r.id + '">' +
        '<span class="lrow-ava">' + U.esc(r.name.slice(0, 1)) + '</span>' +
        '<span class="lrow-main"><span class="lrow-name">' + U.esc(r.name) + '<span class="tiny dim mono">' + U.esc(r.tag) + '</span></span>' +
        '<span class="lrow-sub">' + U.esc(r.role) + ' · ' + U.esc(r.persona.slice(0, 22)) + '…</span></span>' +
        '<span class="lrow-side"><span class="mono small">好感 ' + Math.round(r.affection) + '</span>' +
        '<span class="mini-meter" data-tone="' + (r.affection >= 70 ? 'good' : r.affection < 35 ? 'bad' : 'cyan') + '"><i style="width:' + r.affection + '%"></i></span></span></button>';
    }).join('');

    U.$('#contract-market-list').innerHTML = D.CLUBS.filter(function (o) { return o.id !== c.id; }).slice(0, 7).map(function (o, i) {
      const interest = U.clamp(Math.round(ES.state.ovr(S) * 0.85 + (30 - i * 3)), 10, 99);
      const salary = Math.round(o.tier === 'S' ? 420000 : o.tier === 'A' ? 260000 : 140000);
      return '<button type="button" class="lrow" data-market="' + o.id + '">' +
        '<span class="lrow-ava" style="color:' + o.color + ';border-color:' + o.color + '">' + U.esc(o.short.slice(0, 2)) + '</span>' +
        '<span class="lrow-main"><span class="lrow-name">' + U.esc(o.name) + '</span>' +
        '<span class="lrow-sub">' + U.esc(o.league) + ' · ' + o.tier + ' 级 · 报价 ¥' + U.money(salary) + '/月</span></span>' +
        '<span class="lrow-side"><span class="tag" data-tone="' + (interest > 70 ? 'gold' : interest > 45 ? 'cyan' : 'dim') + '">意向 ' + interest + '%</span></span></button>';
    }).join('');
    U.$$('[data-market]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const o = D.CLUBS.filter(function (x) { return x.id === btn.getAttribute('data-market'); })[0];
        U.confirmDialog({
          title: '发起转会接触', sub: o.name + ' · ' + o.league,
          message: '接触其他战队会提升转会可能，但若被现俱乐部得知，教练信任将下降。是否继续？',
          okText: '发起接触', danger: true
        }).then(function (ok) {
          if (!ok) return;
          ES.narrative.freeAction('通过经纪人向' + o.name + '发起转会接触，试探他们的意向与报价');
        });
      });
    });
    U.$('#contract-foot-note').textContent = c.signed ? '当前合同剩余 ' + c.years + ' 年 · 违约金 ¥' + U.money(c.buyout) : '尚未签约，试用期选手';
  }

  /* ══════════ 情缘模态 ══════════ */
  function renderRomance() {
    if (!S) return;
    const partner = S.relations.filter(function (r) { return r.id === S.romance.npcId; })[0];
    const stateMap = { single: '单身', ambiguous: '暧昧', dating: '交往中', public: '已公开', longdistance: '异地', breakup: '已分手' };
    U.$('#romance-host').innerHTML =
      '<div class="pane-block inset corner-marks">' +
        '<div class="row-tight"><span class="tag" data-tone="' + (S.romance.state === 'single' ? 'dim' : 'red') + '">' + (stateMap[S.romance.state] || '单身') + '</span>' +
        '<span class="tag" data-tone="dim">公开度 ' + S.romance.public + '%</span>' +
        '<span class="tag" data-tone="cyan" style="margin-left:auto">好感 ' + Math.round(S.romance.affection) + '</span></div>' +
        (partner
          ? '<div class="charcard" style="margin-top:12px"><div class="sigil" style="--sig:56px">' + ES.creator.sigilSvg(hash(partner.name) % 8) + '</div>' +
            '<div class="cc-main"><div class="cc-name">' + U.esc(partner.name) + '<span class="tag" data-tone="dim">' + U.esc(partner.tag) + '</span></div>' +
            '<div class="cc-meta">' + U.esc(partner.role) + '</div></div>' +
            '<button type="button" class="btn btn-sm btn-line" data-npc="' + partner.id + '">' + U.icon('user', 'icon-xs') + '详情</button></div>'
          : '<div class="empty">' + U.icon('heart') + '<div class="empty-title">目前没有情感线</div><div class="tiny">情感关系可能在天台、赛后采访或直播间场景中展开</div></div>') +
        '<div class="hairline" style="margin:12px 0"></div>' +
        meterRow('情感浓度', 'heart', S.romance.affection, 100, 'violet') +
      '</div>';

    const stages = ['陌生', '队友', '暧昧', '交往', '公开', '异地 / 分手'];
    const cur = { single: 0, ambiguous: 2, dating: 3, public: 4, longdistance: 5, breakup: 5 }[S.romance.state] || 0;
    U.$('#romance-stages').innerHTML = stages.map(function (s, i) {
      return '<div class="tl-item" data-state="' + (i < cur ? 'done' : i === cur ? 'active' : '') + '">' +
        '<div class="tl-time">阶段 ' + (i + 1) + '</div><div class="tl-title">' + s + '</div>' +
        '<div class="tl-desc">' + ['你们还不认识，或者只是赛场上的对手。', '同在基地，日常交集不多。', '聊天变多了，但谁都没有说破。', '正式确定关系，开始控制公开范围。', '关系被媒体拍到，舆论开始发酵。', '距离、舆论或压力最终压垮了这段关系。'][i] + '</div></div>';
    }).join('');

    const pub = S.romance.public;
    U.$('#range-romance-public').value = pub;
    U.$('#val-romance-public').textContent = pub < 20 ? '保密' : pub < 50 ? '圈内知晓' : pub < 80 ? '半公开' : '完全公开';
    U.$('#romance-impact').innerHTML =
      '<div class="col" style="gap:7px">' +
        '<div class="between small"><span class="dim">粉丝反应</span><span class="' + (pub > 50 ? 'warnc' : 'up') + '">' + (pub > 50 ? '部分粉丝流失，话题度上升' : '粉丝不知情，风险低') + '</span></div>' +
        '<div class="between small"><span class="dim">商务影响</span><span class="' + (pub > 80 ? 'down' : 'up') + '">' + (pub > 80 ? '品牌方谨慎，情侣向合作增加' : '无影响') + '</span></div>' +
        '<div class="between small"><span class="dim">心态恢复</span><span class="up">+' + (S.romance.state === 'single' ? 0 : 4) + ' / 回合</span></div>' +
        '<div class="between small"><span class="dim">舆论风险</span><span class="' + (pub > 60 ? 'down' : '') + '">' + (pub > 60 ? '负面事件伤害 ×1.5' : '标准') + '</span></div>' +
      '</div>';
  }

  /* ══════════ 日程模态 ══════════ */
  const SCHEDULE_DEFS = [
    { id: 'scrim', name: '训练赛', icon: 'users', unit: '小时', attrs: { comms: 1, gameSense: 1 }, special: { teammateTrust: 3, coachTrust: 2 }, res: { condition: -2 }, desc: '与队伍磨合战术与配合' },
    { id: 'solo', name: '单排冲分', icon: 'monitor', unit: '小时', attrs: { aim: 1, reaction: 1 }, res: { condition: -1.5, hand: -1 }, desc: '维持手感与特工熟练度' },
    { id: 'vod', name: '录像复盘', icon: 'cpu', unit: '小时', attrs: { gameSense: 1, insight: 1 }, special: { versionBonus: 3 }, res: { condition: -1 }, desc: '提升战术阅读与版本理解' },
    { id: 'gym', name: '体能康复', icon: 'pulse', unit: '小时', attrs: { stamina: 1 }, special: { }, res: { hand: 4, condition: 1, injury: -4 }, desc: '手腕、肩颈与核心力量训练' },
    { id: 'stream', name: '直播商务', icon: 'mic', unit: '小时', money: 22000, res: { fans: 1, condition: -1.5 }, special: { fanLoyalty: 2 }, desc: '收入与粉丝，挤占训练时间' },
    { id: 'rest', name: '休息娱乐', icon: 'moon', unit: '小时', res: { condition: 3, hand: 1 }, attrs: { mentality: 1 }, desc: '恢复竞技状态与身体' }
  ];
  let scheduleValues = { scrim: 10, solo: 9, vod: 6, gym: 4, stream: 4, rest: 7 };

  function renderSchedule() {
    if (!S) return;
    const total = SCHEDULE_DEFS.reduce(function (a, d) { return a + (scheduleValues[d.id] || 0); }, 0);
    const budget = 40 - (S.flags.studentDuty ? 8 : 0) - (S.flags.streamerDuty ? 6 : 0);
    const tag = U.$('#schedule-budget-tag');
    tag.textContent = '已分配 ' + total + ' / ' + budget + ' 小时';
    tag.setAttribute('data-tone', total > budget ? 'red' : total < budget ? 'warn' : 'cyan');
    U.$('#schedule-controls').innerHTML = SCHEDULE_DEFS.map(function (d) {
      const v = scheduleValues[d.id] || 0;
      return '<div class="field" data-sched="' + d.id + '">' +
        '<div class="between"><span class="field-label">' + U.icon(d.icon) + U.esc(d.name) + '<span class="tiny dim">· ' + U.esc(d.desc) + '</span></span>' +
        '<span class="range-val mono" data-sched-val="' + d.id + '">' + v + ' 小时</span></div>' +
        '<input class="range" type="range" min="0" max="24" step="1" value="' + v + '" data-sched-range="' + d.id + '" aria-label="' + U.esc(d.name) + '时长">' +
      '</div>';
    }).join('');
    U.$$('[data-sched-range]').forEach(function (r) {
      r.addEventListener('input', function () {
        scheduleValues[r.getAttribute('data-sched-range')] = +r.value;
        U.$('[data-sched-val="' + r.getAttribute('data-sched-range') + '"]').textContent = r.value + ' 小时';
        updateSchedulePreview();
      });
    });
    updateSchedulePreview();
  }
  function scheduleTotals() {
    const out = { attrs: {}, special: {}, res: {}, money: 0 };
    SCHEDULE_DEFS.forEach(function (d) {
      const v = scheduleValues[d.id] || 0;
      if (!v) return;
      const scale = v / 12;
      if (d.attrs) Object.keys(d.attrs).forEach(function (k) { out.attrs[k] = (out.attrs[k] || 0) + d.attrs[k] * scale; });
      if (d.special) Object.keys(d.special).forEach(function (k) { out.special[k] = (out.special[k] || 0) + d.special[k] * scale; });
      if (d.res) Object.keys(d.res).forEach(function (k) { out.res[k] = (out.res[k] || 0) + d.res[k] * scale; });
      if (d.money) out.money += d.money * v;
    });
    return out;
  }
  function updateSchedulePreview() {
    const t = scheduleTotals();
    const total = SCHEDULE_DEFS.reduce(function (a, d) { return a + (scheduleValues[d.id] || 0); }, 0);
    const budget = 40 - (S.flags.studentDuty ? 8 : 0) - (S.flags.streamerDuty ? 6 : 0);
    const rows = [];
    Object.keys(t.attrs).forEach(function (k) { rows.push(['属性 · ' + attrName(k), '+' + t.attrs[k].toFixed(1), t.attrs[k] > 0]); });
    Object.keys(t.special).forEach(function (k) {
      rows.push(['特殊 · ' + attrName(k), (t.special[k] > 0 ? '+' : '') + t.special[k].toFixed(1), t.special[k] > 0]);
    });
    Object.keys(t.res).forEach(function (k) {
      const map = { energy: '体力', mood: '心态', hand: '手部健康', popularity: '人气' };
      rows.push([map[k] || k, (t.res[k] > 0 ? '+' : '') + t.res[k].toFixed(1), t.res[k] > 0]);
    });
    if (t.money) rows.push(['预计收入', '¥' + U.money(t.money), true]);
    rows.push(['总训练时长', total + ' / ' + budget + ' 小时', total <= budget]);
    U.$('#schedule-preview').innerHTML = rows.map(function (r) {
      return '<div class="between small"><span class="dim">' + U.esc(r[0]) + '</span><span class="mono ' + (r[2] ? 'up' : 'down') + '">' + U.esc(r[1]) + '</span></div>';
    }).join('');
    const warn = U.$('#schedule-warning');
    if (total > budget) {
      warn.className = 'alert';
      warn.setAttribute('data-tone', 'danger');
      warn.innerHTML = U.icon('warn') + '<div><div class="alert-title">超出预算 ' + (total - budget) + ' 小时</div>超额训练会立即造成体力透支与手部健康损耗，并累积疲劳状态。</div>';
    } else if (total > budget - 6) {
      warn.className = 'alert';
      warn.setAttribute('data-tone', 'warn');
      warn.innerHTML = U.icon('warn') + '<div><div class="alert-title">接近负荷上限</div>连续两周高负荷会显著提升腕部伤病概率，建议保留至少 6 小时休息。</div>';
    } else {
      warn.className = 'alert';
      warn.setAttribute('data-tone', 'good');
      warn.innerHTML = U.icon('check') + '<div><div class="alert-title">负荷健康</div>当前日程在可持续范围内，属性会稳定成长。</div>';
    }
  }

  /* ══════════ 日历模态 ══════════ */
  function renderCalendar() {
    if (!S) return;
    const month = ((S.time.month - 1 + calOffset) % 12 + 12) % 12 + 1;
    U.$('#calendar-sub').textContent = 'S' + S.time.season + ' · ' + S.time.year + ' 年 ' + month + ' 月 · ' + S.time.phase;
    const head = ['一', '二', '三', '四', '五', '六', '日'].map(function (d) { return '<div class="cal-head">' + d + '</div>'; }).join('');
    const rnd = U.makeRng(month * 317 + S.time.season);
    let cells = '';
    const evPool = ['联赛比赛', '训练赛', '媒体采访', '品牌拍摄', '休整日', '战术会议', '版本更新', '直播日'];
    const firstDow = (month * 3 + S.time.year) % 7;
    for (let i = 0; i < firstDow; i++) cells += '<div></div>';
    for (let d = 1; d <= 28; d++) {
      const r = rnd();
      let ev = null, type = 'rest';
      if (d % 7 === 3) { ev = '联赛比赛'; type = 'match'; }
      else if (d % 7 === 6) { ev = '休整日'; type = 'rest'; }
      else if (r > 0.72) { ev = '媒体采访'; type = 'media'; }
      else if (r > 0.6) { ev = '战术会议'; type = 'media'; }
      else if (r > 0.5) { ev = '版本更新'; type = 'critical'; }
      if (month === S.time.month && d === S.time.day) type = 'critical';
      const isToday = month === S.time.month && d === S.time.day;
      cells += '<div class="cal-cell' + (isToday ? ' is-today' : '') + '" data-ev="' + type + '" data-day="' + d + '" data-tip="' + (ev || evPool[Math.floor(r * evPool.length)]) + '">' +
        '<span class="d">' + U.pad2(d) + '</span><span class="ev">' + (ev || '') + '</span></div>';
    }
    U.$('#calendar-grid').innerHTML = head + cells;

    const list = [];
    for (let d = 1; d <= 28; d++) {
      const r2 = U.makeRng(month * 977 + d * 13)();
      if (d % 7 === 3) list.push({ d: d, t: '联赛比赛 · 常规赛第 ' + Math.ceil(d / 7) + ' 周', tone: 'cyan', icon: 'sword' });
      else if (r2 > 0.78) list.push({ d: d, t: '官方媒体采访（俱乐部安排）', tone: 'violet', icon: 'mic' });
      else if (r2 > 0.66) list.push({ d: d, t: '版本更新 · 需重新适应特工池', tone: 'gold', icon: 'layers' });
      else if (r2 > 0.56) list.push({ d: d, t: '战术复盘会议', tone: 'cyan', icon: 'cpu' });
    }
    U.$('#calendar-list').innerHTML = list.length ? list.map(function (it) {
      return '<div class="lrow" style="cursor:default">' +
        '<span class="lrow-ava">' + U.pad2(it.d) + '</span>' +
        '<span class="lrow-main"><span class="lrow-name">' + U.icon(it.icon, 'icon-xs') + ' ' + U.esc(it.t) + '</span>' +
        '<span class="lrow-sub">' + month + ' 月 ' + it.d + ' 日 · 预计消耗 1 回合</span></span>' +
        '<span class="lrow-side"><span class="tag" data-tone="' + it.tone + '">' + (it.tone === 'gold' ? '关键' : '日程') + '</span></span></div>';
    }).join('') : '<div class="empty">' + U.icon('calendar') + '<div class="empty-title">本月暂无固定日程</div></div>';
  }

  /* ══════════ 舆论模态 ══════════ */
  function renderMedia() {
    if (!S) return;
    U.$('#media-sentiment').textContent = '名声 ' + Math.round(S.special.fame) + ' · 热度 ' + Math.round(S.special.heat);
    const name = S.profile.tag;
    const hot = [
      ['#' + name + ' 残局 1v3 名场面#', '热度 ' + (600 + Math.round(S.special.fame * 18)) + ' 万', 'up'],
      ['#' + S.club.short + ' 让一追二晋级#', '热度 ' + (300 + Math.round(S.special.fame * 9)) + ' 万', 'warnc'],
      ['#职业选手的训练量该被限制吗#', '热度 421 万', 'warnc'],
      ['#' + name + ' 直播回应挂机#', '热度 ' + (120 + Math.round(S.special.antiThreat * 6)) + ' 万', 'down']
    ];
    const forum = [
      ['理性讨论：' + name + ' 的枪法到底什么水平？', '128 回复 · 3 小时前'],
      ['数据贴：近十场首杀率与残局胜率统计', '96 回复 · 5 小时前'],
      ['有人注意到他最近手上有护腕吗？', '214 回复 · 昨天'],
      ['投票：本赛季最被低估的选手', '540 回复 · 昨天']
    ];
    const danmu = U.pickMany(D.DANMU, 8);
    const press = [
      ['《电竞周刊》', '「' + name + ' 的出现，让这个位置重新变得值得讨论。」'],
      ['赛事官方评述', '「他的问题从来不是操作，而是如何在长赛季里保持稳定。」'],
      ['圈内匿名教练', '「如果他能把心态磨出来，会是很难处理的那种选手。」'],
      ['解说阿七', '「我看了他全部的比赛录像，他的上限还没有被逼出来。」']
    ];
    const body = {
      hot: hot.map(function (h) {
        return '<div class="lrow" style="cursor:default"><span class="lrow-ava">' + U.icon('flame') + '</span>' +
          '<span class="lrow-main"><span class="lrow-name">' + U.esc(h[0]) + '</span><span class="lrow-sub">' + U.esc(h[1]) + '</span></span>' +
          '<span class="lrow-side">' + U.icon(h[2] === 'up' ? 'trend-up' : h[2] === 'down' ? 'trend-down' : 'minus', 'icon-sm') + '</span></div>';
      }).join(''),
      forum: forum.map(function (f) {
        return '<div class="lrow" style="cursor:default"><span class="lrow-ava">' + U.icon('message') + '</span>' +
          '<span class="lrow-main"><span class="lrow-name">' + U.esc(f[0]) + '</span><span class="lrow-sub">' + U.esc(f[1]) + '</span></span></div>';
      }).join(''),
      danmu: '<div class="bc-log" style="max-height:300px">' + danmu.map(function (d, i) {
        return '<div class="bc-log-item" data-t="' + (d.indexOf('别') >= 0 || d.indexOf('自闭') >= 0 ? 'die' : 'kill') + '"><span class="bc-log-time">' + (1000 + i * 37) + '</span><span>' + U.esc(d) + '</span></div>';
      }).join('') + '</div>',
      press: press.map(function (p) {
        return '<div class="cast-line">' + U.icon('mic') + '<div><b>' + U.esc(p[0]) + '</b><div class="small dim-2" style="margin-top:3px">' + U.esc(p[1]) + '</div></div></div>';
      }).join('')
    }[mediaTab] || '';
    U.$('#media-body').innerHTML = body;
    U.$$('[data-media-tab]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-media-tab') === mediaTab ? 'true' : 'false'); });
    U.$('#media-actions').innerHTML = [
      { id: 'apology', n: '发布公开致歉', d: '降低黑粉威胁，但会显得软弱', i: 'warn' },
      { id: 'silent', n: '保持沉默专注比赛', d: '心态小幅下滑，教练信任提升', i: 'eye' },
      { id: 'live', n: '开直播正面对话', d: '人气与粉丝忠诚提升，风险极高', i: 'mic' },
      { id: 'lawyer', n: '交由俱乐部法务处理', d: '花费金钱，快速平息谣言', i: 'briefcase' },
      { id: 'sue', n: '起诉造谣账号', d: '长期收益高，短期舆论反弹', i: 'shield' },
      { id: 'ignore', n: '完全不回应', d: '舆论自然衰减，风险不可控', i: 'moon' }
    ].map(function (a) {
      return '<button type="button" class="card" style="padding:12px" data-media-act="' + a.id + '">' +
        '<div class="row-tight">' + U.icon(a.i) + '<span class="card-title" style="font-size:var(--fs-sm)">' + U.esc(a.n) + '</span></div>' +
        '<div class="tiny dim" style="margin-top:6px">' + U.esc(a.d) + '</div></button>';
    }).join('');
    U.$$('[data-media-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-media-act');
        const map = { apology: '发布一条公开致歉声明，回应最近的挂机争议', silent: '对舆论保持沉默，把所有精力投入训练', live: '开直播正面回应所有质疑', lawyer: '请俱乐部的法务团队处理网络造谣', sue: '正式起诉两个造谣账号', ignore: '暂不回应任何舆论' };
        U.closeModal('modal-media');
        ES.narrative.freeAction(map[id]);
      });
    });
  }

  /* ══════════ 天赋模态 ══════════ */
  function renderTalentModal() {
    if (!S) return;
    const host = U.$("#talent-modal-body");
    const list = S.talents || [];
    if (!list.length) {
      host.innerHTML = '<div class="empty">' + U.icon("dna") + '<div class="empty-title">尚未觉醒天赋</div><div class="tiny">原著传奇模板的天赋会在进入赛场后固化。</div></div>';
      return;
    }
    const best = list.filter(function (x) { return x.quality === "gold"; })[0] || list[0];
    const q = D.QUALITIES[best.quality];
    const dir = D.TALENT_DIRECTIONS.filter(function (d) { return d.id === best.direction; })[0];
    host.innerHTML =
      '<div class="rarity-stage" data-rarity="' + best.quality + '" style="border:1px solid var(--line);clip-path:var(--clip-card);overflow:hidden">' +
        '<div class="rarity-beam" aria-hidden="true"></div>' +
        '<div class="rarity-halo" aria-hidden="true"></div>' +
        '<div class="rarity-card">' +
          '<span class="rarity-tag">' + U.esc(q.label) + " · " + U.esc(q.name) + '</span>' +
          '<span class="rarity-glyph">' + U.icon(best.icon, "icon-2xl") + '</span>' +
          '<span class="rarity-name">' + U.esc(best.name) + '</span>' +
          '<span class="rarity-desc">' + U.esc(best.desc) + '</span>' +
          '<span class="rarity-eff">' + best.lines.map(function (l) { return '<span class="tag" data-tone="cyan">' + U.esc(l.name) + " +" + l.v + '</span>'; }).join("") + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="col" style="gap:10px;margin-top:16px">' +
        '<div class="between small"><span class="dim">觉醒数量</span><span class="mono">' + list.length + ' 个（骰子决定 3—5 个）</span></div>' +
        '<div class="between small"><span class="dim">最高品质方向</span><span>' + U.icon(dir ? dir.icon : "sparkle", "icon-xs") + " " + U.esc(dir ? dir.name : "未知") + '</span></div>' +
        '<div class="between small"><span class="dim">品质倍率</span><span class="mono">×' + q.mul + '</span></div>' +
        '<div class="between small"><span class="dim">属性上限</span><span class="mono up">' + (S.special.cap || 85) + '（由最高品质决定）</span></div>' +
        '<div class="hairline"></div>' +
        list.map(function (tl) {
          const tq = D.QUALITIES[tl.quality];
          return '<div class="talent-item is-selected" data-rarity="' + tl.quality + '" style="cursor:default">' + U.icon(tl.icon, "talent-ico") +
            '<span class="talent-body"><span class="talent-name">' + U.esc(tl.name) + '</span>' +
            '<span class="talent-desc">' + U.esc(tl.desc) + '</span></span>' +
            '<span class="talent-badge" data-rarity="' + tl.quality + '">' + U.esc(tq.name) + '</span></div>';
        }).join("") +
        '<div class="alert" data-tone="cyan">' + U.icon("info") + '<div><b>成长方式</b>：执行与该天赋方向一致的行动可获得该方向属性 +1；天赋一经定型不可更改，但可通过剧情进化（如「枪法·蓝」长期特训后进化为「枪法·紫」）。</div></div>' +
      '</div>';
  }

  /* ══════════ 作弊菜单（2.1 作弊模式 · 需二次确认后开启） ══════════ */
  function renderCheat() {
    if (!S) return;
    const host = U.$("#cheat-menu-body");
    if (!host) return;
    if (!S.cheat) {
      host.innerHTML = '<div class="alert" data-tone="warn">' + U.icon("warn") + '<div>当前存档不是作弊模式。作弊模式需在建档时选择，且开启后不可关闭。</div></div>';
      return;
    }
    const items = [
      { id: "money", name: "无限元", desc: "立即获得 ¥10,000,000", icon: "coin" },
      { id: "ovr", name: "任意总评", desc: "五项评定属性各 +3（总评同步上涨）", icon: "chart" },
      { id: "invincible", name: "无敌状态", desc: "竞技状态 / 手部健康回满，伤病风险清零", icon: "shield" },
      { id: "champion", name: "直接获得世界冠军", desc: "写入冠军荣誉与剧情标记", icon: "trophy" },
      { id: "agents", name: "任意特工", desc: "特工池全部熟练度提升至 95", icon: "layers" },
      { id: "skip", name: "跳过剧情", desc: "直接推进 6 个回合（不结算事件）", icon: "clock" }
    ];
    host.innerHTML = '<div class="alert" data-tone="red">' + U.icon("warn") + '<div><b>作弊模式已开启</b>：本存档所有成就都会标记为「作弊获得」，且不参与正常结局评定。</div></div>' +
      '<div class="grid-2" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:14px">' +
      items.map(function (it) {
        return '<button type="button" class="card" data-cheat="' + it.id + '" id="cheat-' + it.id + '" style="text-align:left">' +
          '<div class="card-head"><span class="card-glyph">' + U.icon(it.icon, "icon-lg") + '</span><div class="grow"><div class="card-title">' + U.esc(it.name) + '</div><div class="card-sub">' + U.esc(it.desc) + '</div></div></div></button>';
      }).join("") + '</div>' +
      '<div class="hairline" style="margin:14px 0"></div>' +
      '<div class="tiny dim">当前：总评 ' + ovrOf() + ' · 元 ¥' + U.money(S.res.money) + ' · 竞技状态 ' + Math.round(S.res.condition) + ' · 手部健康 ' + Math.round(S.res.hand) + '</div>';
  }
  function ovrOf() { return ES.state.ovr(S); }
  function applyCheat(id) {
    if (!S.cheat) return;
    if (id === "money") { ES.state.apply(S, { money: 10000000 }, { silent: true }); }
    else if (id === "ovr") {
      const pos = ES.state.positionOf(S);
      const add = {};
      Object.keys(pos.weights).forEach(function (k) { add[k] = 3; });
      ES.state.apply(S, { attrs: add }, { silent: true });
    } else if (id === "invincible") { S.res.condition = 100; S.res.hand = 100; S.res.injury = 0; S.statuses = []; }
    else if (id === "champion") {
      S.flags.champion = true; S.flags.worlds = true;
      if (S.stats.honorList.indexOf("全球冠军赛冠军（作弊获得）") < 0) S.stats.honorList.push("全球冠军赛冠军（作弊获得）");
      S.res.fans += 200;
    } else if (id === "agents") { (S.agents || []).forEach(function (a) { a.mastery = 95; }); }
    else if (id === "skip") { for (let i = 0; i < 6; i++) ES.state.advanceTime(S, 4); }
    ES.state.pushLog(S, "cheat", "作弊菜单执行：" + id);
    ES.state.saveSlot("auto", S);
    renderCheat(); renderRail(); renderPanes(); ES.panels.updateTopbar();
    U.toast({ tone: "gold", icon: "terminal", title: "作弊指令已执行", msg: "成就将继续标记为「作弊获得」。" });
  }
  /* ══════════ 对外入口 ══════════ */
  function bind(state) {
    S = state;
    railSig = '';
    renderRail();
    mountDashboard();
    renderPanes();
  }
  function refreshAll() {
    if (!S) return;
    renderRail();
    renderPanes();
    if (U.$('#modal-board').classList.contains('is-open')) renderBoard();
    if (U.$('#modal-dossier').classList.contains('is-open')) renderDossier();
  }
  function updateTopbar() {
    if (!S) return;
    U.$('#tb-season').textContent = 'S' + S.time.season + ' · ' + S.time.year;
    U.$('#tb-time').textContent = U.pad2(S.time.month) + '/' + U.pad2(S.time.day) + ' ' + S.time.clock;
    U.$('#tb-phase').textContent = S.time.phase;
    U.$('#tb-ovr').textContent = ES.state.ovr(S);
    U.$('#tb-rank').textContent = '第 ' + S.club.rank + ' / 12';
    const tr = U.$('#turn-readout');
    if (tr) tr.textContent = '回合 ' + S.time.turn + ' · 已执行 ' + (S.stats.choices || 0) + ' 次抉择';
    const dt = U.$('#dash-sync-tag');
    if (dt) dt.textContent = ES.state.timeText(S).replace(' 赛季 · ', ' · ');
  }
  function renderTicker() {
    const track = U.$('#ticker-track');
    if (!track || !S) return;
    const items = S.news.slice(0, 6).map(function (n) {
      return '<span class="ticker-item">' + U.icon('chev-r') + '<b>' + U.esc(n.source) + '</b>' + U.esc(n.title) + '</span>';
    }).join('');
    track.innerHTML = items + items;
    track.style.setProperty('--tick-dur', Math.max(28, S.news.length * 6) + 's');
  }
  function stateRef() { return S; }
  function getDashTab() { return dashTab; }

  return {
    bind: bind, refreshAll: refreshAll, renderRail: renderRail, renderPanes: renderPanes,
    renderBoard: renderBoard, renderDossier: renderDossier, renderQuests: renderQuests,
    renderAchievements: renderAchievements, renderNews: renderNews, renderNpc: renderNpc,
    renderContract: renderContract, renderRomance: renderRomance, renderSchedule: renderSchedule,
    renderTalentModal: renderTalentModal, renderCheat: renderCheat, applyCheat: applyCheat,
    renderCalendar: renderCalendar, renderMedia: renderMedia, updateTopbar: updateTopbar,
    renderTicker: renderTicker, radarSvg: radarSvg, sparklineSvg: sparklineSvg, trendValues: trendValues,
    attrName: attrName, stateRef: stateRef, getDashTab: getDashTab, mountDashboard: mountDashboard,
    setNewsFilter: function (f) { newsFilter = f; renderNews(); },
    setQuestFilter: function (f) { questFilter = f; renderQuests(); },
    setAchFilter: function (f) { achFilter = f; renderAchievements(); },
    setMediaTab: function (t) { mediaTab = t; renderMedia(); },
    selectNews: function (id) { newsSelected = id; renderNews(); },
    getCalOffset: function () { return calOffset; },
    shiftCal: function (d) { calOffset += d; renderCalendar(); },
    scheduleValues: function () { return scheduleValues; },
    scheduleTotals: scheduleTotals,
    setSchedule: function (id, v) { scheduleValues[id] = v; renderSchedule(); },
    applyPreset: function () {
      scheduleValues = S.flags.studentDuty ? { scrim: 9, solo: 8, vod: 6, gym: 4, stream: 2, rest: 7 } : { scrim: 12, solo: 9, vod: 7, gym: 5, stream: 4, rest: 6 };
      renderSchedule();
    }
  };
})();
