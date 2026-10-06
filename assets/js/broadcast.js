window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   比赛直播（战术射击）：回合制推演 / 经济与购买 / 首杀与残局 /
   比分走势 / 选手数据 / 解说与弹幕 / 结算
   —— 先到 13 分取胜，第 12 回合交换攻防，12:12 进入加时
   ═══════════════════════════════════════════════════════════════ */
ES.broadcast = (function () {
  'use strict';
  const U = ES.util, D = ES.data;

  const MAPS = D.MAPS;
  const AGENTS = D.AGENTS;
  const POSITIONS = D.POSITIONS;

  let live = null;
  let timer = null;
  let S = null;

  /* ─────────── 初始化 ─────────── */
  function mount(state) {
    S = state;
    U.$$('[data-mtab="bc"]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-pane') === 'bc-pane-log' ? 'true' : 'false'); });
    U.$$('#modal-broadcast .tab-panel').forEach(function (p) { p.classList.toggle('is-active', p.id === 'bc-pane-log'); });
  }

  function agentFor(role) {
    const pool = AGENTS[role] || AGENTS['决斗者'];
    return U.pick(pool);
  }

  function newGame(opts) {
    opts = opts || {};
    const pool = D.CLUBS.filter(function (o) { return !S.club || o.id !== S.club.id; });
    const opp = opts.opponent || U.pick(pool);
    const map = opts.map || U.pick(MAPS);

    const myPos = ES.state.positionOf(S);
    const me = {
      name: S.profile.name, tag: S.profile.tag, role: myPos.name, positionId: myPos.id,
      agent: (S.agents && S.agents[0]) ? S.agents[0].name : U.pick(AGENTS[myPos.name] || AGENTS['决斗者']), me: true,
      k: 0, d: 0, a: 0, fk: 0, hs: 0, shots: 0, clutch: 0, score: 0, credits: 800
    };
    const mates = [];
    S.relations.filter(function (r) { return r.type === 'teammate'; }).slice(0, 4).forEach(function (r) {
      const roleName = (r.role || '').replace('队友 · ', '') || '先锋';
      const p = (r.positionId && D.POSITIONS.filter(function (x) { return x.id === r.positionId; })[0]) ||
        D.POSITIONS.filter(function (x) { return roleName.indexOf(x.name) >= 0; })[0] || myPos;
      mates.push({ name: r.name, tag: r.tag, role: p.name, positionId: p.id, agent: U.pick(AGENTS[p.name] || AGENTS['决斗者']), k: 0, d: 0, a: 0, fk: 0, hs: 0, shots: 0, clutch: 0, score: 0, credits: 800 });
    });
    const fill = D.POSITIONS.map(function (p) { return p.name; });
    let ri = 0;
    while (mates.length < 4) {
      const roleName = fill[ri++ % fill.length];
      if (mates.some(function (m) { return m.role === roleName; })) continue;
      mates.push({ name: U.pick(['青训', '替补']) + U.randInt(1, 9), tag: 'SUB' + U.randInt(10, 99), role: roleName, positionId: 'x', agent: U.pick(AGENTS[roleName]), k: 0, d: 0, a: 0, fk: 0, hs: 0, shots: 0, clutch: 0, score: 0, credits: 800 });
    }
    const myTeam = [me].concat(mates);

    /* 对手：按其该时间线年份的阵容与资源分级生成总评（N.6：一线主力 70—80 / 赛区明星 80—88） */
    const base = opp.tier === 'T0' ? 84 : opp.tier === 'T1' ? 76 : 68;
    const theirTeam = (opp.roster && opp.roster.length ? opp.roster : ['选手A', '选手B', '选手C', '选手D', '选手E']).map(function (nm, i) {
      const p = D.POSITIONS[i % D.POSITIONS.length];
      return {
        name: nm, tag: nm.slice(0, 6), role: p.name, positionId: p.id, agent: U.pick(AGENTS[p.name]),
        ovr: U.clamp(base + U.randInt(-5, 5), 45, 96), k: 0, d: 0, a: 0, fk: 0, hs: 0, shots: 0, clutch: 0, score: 0, credits: 800
      };
    });

    live = {
      map: map, opp: opp, myTeam: myTeam, theirTeam: theirTeam,
      round: 1, scoreMe: 0, scoreThem: 0, side: 'attack', ended: false, result: null,
      econDiff: 0, scoreHist: [0], order: null, logs: [], cast: [], danmu: [], clutches: 0, aces: 0,
      bond: ES.state.bondOf(S), overtime: false
    };
    /* BP 阶段：每队禁 2 图 + 每队禁 2 特工 + 交替选 5 特工（27 章） */
    live.bp = { bannedMaps: U.pickMany(MAPS.filter(function (m) { return m !== map; }), 2), bannedAgents: U.pickMany((AGENTS[myPos.name] || []).concat(AGENTS['控场']), 2) };
    renderAll();
    return live;
  }

  /* ─────────── 渲染 ─────────── */
  function renderAll() {
    if (!live) return;
    const benchMe = !!(S.club && S.club.lineup && S.club.lineup.selfStatus === 'bench');
    U.$('#bc-sub').textContent = (benchMe ? '训练赛（替补席争取首发）' : (S.club ? S.club.league : 'VCT')) + ' · ' + S.time.phase + ' · 地图：' + live.map + ' · 羁绊 ' + live.bond.level.name + ' +' + Math.round(live.bond.level.bonus * 100) + '% · 解说：老黄 / 小黎';
    U.$('#bc-team-a').textContent = S.club.name;
    U.$('#bc-tag-a').textContent = S.club.short + ' · ' + (live.side === 'attack' ? '进攻方' : '防守方');
    U.$('#bc-team-b').textContent = live.opp.name;
    U.$('#bc-bp-tag').textContent = 'BP 禁用：' + live.bp.bannedMaps.join(' / ') + ' · 禁用特工 ' + live.bp.bannedAgents.join(' / ');
    U.$('#bc-tag-b').textContent = live.opp.short + ' · ' + (live.side === 'attack' ? '防守方' : '进攻方');
    U.$('#bc-kills-a').textContent = live.scoreMe;
    U.$('#bc-kills-b').textContent = live.scoreThem;
    U.$('#bc-timer').textContent = 'R' + live.round;
    U.$('#bc-game-no').textContent = '地图 ' + (S.stats.matches + 1) + ' · ' + live.opp.tier + ' 对手 · ' + live.map;
    U.$('#bc-gold-a').textContent = U.fmtNum(Math.round(econAvg(live.myTeam)));
    U.$('#bc-gold-b').textContent = U.fmtNum(Math.round(econAvg(live.theirTeam)));
    const total = (econAvg(live.myTeam) + econAvg(live.theirTeam)) || 1;
    U.$('#bc-gold-fill').style.width = U.clamp((econAvg(live.myTeam) / total) * 100, 5, 95) + '%';
    U.$('#bc-diff-readout').textContent = '比分 ' + live.scoreMe + ':' + live.scoreThem +
      ' · 队内平均经济 ' + Math.round(econAvg(live.myTeam)) + ' / 对手 ' + Math.round(econAvg(live.theirTeam));
    U.$('#bc-chart-host').innerHTML = ES.panels.sparklineSvg(live.scoreHist.length > 1 ? live.scoreHist : [0, 0], {
      height: 70, width: 420, color: (live.scoreHist[live.scoreHist.length - 1] || 0) >= 0 ? 'var(--accent)' : 'var(--red)',
      min: Math.min.apply(null, live.scoreHist) - 1, max: Math.max.apply(null, live.scoreHist) + 1
    });
    renderLog(); renderData(); renderCast(); renderDanmu(); renderOrders(); renderGoals();
    U.$('#bc-live-tag').innerHTML = live.ended
      ? '<i class="dot-pulse" style="width:6px;height:6px;display:inline-block;border-radius:50%"></i>已结束'
      : '<i class="dot-live" style="width:6px;height:6px;display:inline-block;border-radius:50%"></i>LIVE';
    U.$('#btn-bc-settle').disabled = !live.ended;
    U.$('#btn-bc-play').innerHTML = live.ended
      ? U.icon('refresh', 'icon-sm') + '再打一张图'
      : (timer ? U.icon('pause', 'icon-sm') + '暂停推演' : U.icon('play', 'icon-sm') + '开始推演战局');
  }

  function econAvg(team) {
    return team.reduce(function (a, p) { return a + (p.credits || 0); }, 0) / team.length;
  }

  function renderLog() {
    const host = U.$('#bc-log');
    host.innerHTML = live.logs.slice(-40).reverse().map(function (l) {
      return '<div class="bc-log-item" data-t="' + l.t + '"><span class="bc-log-time">R' + U.pad2(l.r) + '</span><span>' + U.esc(l.text) + '</span></div>';
    }).join('') || '<div class="tiny dim">比赛尚未开始。选择战术指令后点击「开始推演战局」。</div>';
  }
  function renderData() {
    U.$('#bc-data-body').innerHTML = live.myTeam.concat(live.theirTeam).map(function (p) {
      const acs = Math.round(p.score / Math.max(1, live.round - 1)) || 0;
      const hsPct = p.shots ? Math.round((p.hs / p.shots) * 100) : 0;
      return '<tr' + (p.me ? ' style="background:color-mix(in oklab,var(--accent) 8%,transparent)"' : '') + '>' +
        '<td>' + (p.me ? '<b class="acc">' + U.esc(p.name) + '</b>' : U.esc(p.name)) + ' <span class="tiny dim mono">' + U.esc(p.tag) + '</span></td>' +
        '<td class="tiny dim">' + U.esc(p.role) + '<div class="mono tiny" style="color:var(--txt-4)">' + U.esc(p.agent) + '</div></td>' +
        '<td class="num">' + p.k + ' / ' + p.d + (p.a ? ' / ' + p.a : '') + '</td>' +
        '<td class="num hl">' + acs + '</td>' +
        '<td class="num">' + p.fk + '</td>' +
        '<td class="num">' + hsPct + '%</td>' +
        '<td class="num">' + p.clutch + '</td></tr>';
    }).join('');
  }
  function renderCast() {
    U.$('#bc-cast').innerHTML = live.cast.slice(-8).reverse().map(function (c) {
      return '<div class="cast-line">' + U.icon('mic') + '<div><b>' + U.esc(c.who) + '</b><div class="small dim-2" style="margin-top:3px">' + U.esc(c.text) + '</div></div></div>';
    }).join('') || '<div class="tiny dim">解说席正在做赛前分析……</div>';
  }
  function renderDanmu() {
    U.$('#bc-danmu').innerHTML = live.danmu.slice(-9).map(function (d) {
      return '<p><b>' + U.esc(d.who) + '</b>：' + U.esc(d.text) + '</p>';
    }).join('') || '<div class="tiny dim">弹幕区安静得有点反常。</div>';
  }
  function renderOrders() {
    U.$('#bc-orders').innerHTML = D.ORDERS.map(function (o) {
      const on = live.order === o.id;
      return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" data-order="' + o.id + '" aria-pressed="' + on + '" id="chip-order-' + o.id + '" style="width:100%;justify-content:flex-start">' +
        U.icon(o.icon, 'chip-ico') + '<span style="text-align:left"><b>' + U.esc(o.name) + '</b><span class="tiny dim" style="display:block">' + U.esc(o.desc) + '</span></span></button>';
    }).join('');
  }
  function renderGoals() {
    const me = live.myTeam[0];
    const acs = Math.round(me.score / Math.max(1, live.round - 1)) || 0;
    U.$('#bc-goals').innerHTML = [
      ['个人首杀 ≥ 3 次', me.fk >= 3],
      ['个人 ACS ≥ 220', acs >= 220],
      ['赢下至少 1 次残局', me.clutch >= 1],
      ['赢下本张地图', live.ended && live.result === 'win']
    ].map(function (g) {
      return '<div class="row-tight small" style="color:' + (g[1] ? 'var(--green)' : 'var(--txt-3)') + '">' + U.icon(g[1] ? 'check' : 'target', 'icon-xs') + U.esc(g[0]) + '</div>';
    }).join('');
  }

  /* ─────────── 回合推演 ─────────── */
  function start() {
    if (!live) return false;
    if (live.ended) { newGame({}); return true; }
    if (timer) { stop(); return true; }
    if (!live.order) {
      U.toast({ tone: 'warn', title: '请先选择战术指令', msg: '指令会直接影响进点节奏与交火强度。' });
      const first = U.$('[data-order]');
      if (first) first.classList.add('u-shake');
      return false;
    }
    timer = setInterval(tick, 700);
    renderAll();
    return true;
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    renderAll();
  }

  function buyType(team) {
    const avg = econAvg(team);
    if (live.round === 1 || live.round === 13) return '手枪局';
    if (avg < 2200) return '经济局';
    if (avg < 3400) return '半起';
    if (avg < 4400) return '强起';
    return '满配';
  }

  function tick() {
    if (!live || live.ended) { stop(); return; }
    const me = live.myTeam[0];
    const r = live.round;
    const myBuy = buyType(live.myTeam);
    const theirBuy = buyType(live.theirTeam);
    const eff = ES.state.effective(S).attrs;
    const orderMod = live.order === 'fast' ? 0.06 : live.order === 'mech' ? 0.05 : live.order === 'group' ? 0.04 : 0.02;

    let power = 0.5 + (ES.state.ovr(S) - 64) / 150 + (eff.aim - 60) / 320 + (eff.gameSense - 60) / 340 + live.bond.level.bonus;
    power += orderMod + (myBuy === '满配' ? 0.06 : myBuy === '经济局' ? -0.08 : 0) - (theirBuy === '满配' ? 0.05 : 0);
    if (S.res.hand < 50) power -= 0.05;
    power += (S.special.coachTrust - 50) / 600;
    if (S.res.condition < 40) power -= 0.04;
    power = U.clamp(power, 0.14, 0.9);

    const myWin = U.rng() < power;

    /* 首杀 */
    const fbMine = U.rng() < U.clamp(power - 0.25, 0.1, 0.45);
    if (fbMine) {
      me.fk++; me.score += 170 + U.randInt(0, 40);
      pushLog('kill', '你拿下本回合首杀（' + (U.rng() < 0.5 ? '中路对枪' : '进点时的一枪') + '），我方士气提起来了。');
      if (U.rng() < 0.35) live.cast.push({ who: '解说 · 激情老黄', text: '首杀是 ' + S.profile.tag + '！他这一枪完全没给对手反应时间。' });
    } else {
      const their = U.pick(live.theirTeam); their.fk++; their.k++; their.score += 190;
      pushLog('die', '对手先拿到首杀，我方被迫进入少打多的局面。');
    }

    /* 本回合合计 5 个人头，按胜负与个人状态分配 */
    const totalKills = U.randInt(4, 5);
    let myKills = myWin ? U.randInt(3, totalKills) : U.randInt(0, 2);
    myKills = U.clamp(myKills, 0, totalKills);
    const theirKills = totalKills - myKills;

    /* 玩家在我方人头中的占比 */
    let share = 0.3 + (eff.aim - 55) / 200 + (fbMine ? 0.12 : 0) + (live.order === 'mech' ? 0.06 : 0);
    share = U.clamp(share, 0.1, 0.62);
    let playerKills = Math.round(myKills * share);
    playerKills = U.clamp(playerKills, 0, myKills);
    me.k += playerKills;
    me.score += playerKills * (120 + U.randInt(0, 50));
    me.shots += playerKills;
    for (let i = 0; i < playerKills; i++) { if (U.rng() < 0.42) me.hs++; }

    /* 队友人头 */
    const matesArr = live.myTeam.filter(function (x) { return x !== me; });
    for (let i = 0; i < myKills - playerKills; i++) {
      const sorted = matesArr.slice().sort(function (a, b) { return a.k - b.k; });
      const killer = U.rng() < 0.6 ? sorted[0] : U.pick(matesArr);
      killer.k++; killer.score += 130 + U.randInt(0, 50); killer.shots += 2;
      if (U.rng() < 0.4) killer.hs++;
    }

    /* 对手人头 */
    for (let i = 0; i < theirKills; i++) {
      const ek = U.pick(live.theirTeam); ek.k++; ek.score += 130 + U.randInt(0, 50); ek.shots += 2;
      if (U.rng() < 0.4) ek.hs++;
    }

    /* 对手阵亡统计 */
    for (let i = 0; i < myKills; i++) { U.pick(live.theirTeam).d++; }

    /* 我方阵亡：输掉的回合大概率阵亡 */
    const deathChance = myWin ? 0.34 : 0.72;
    if (U.rng() < deathChance) { me.d++; me.shots += 1; }
    const mateDeaths = Math.max(0, theirKills - (U.rng() < deathChance ? 1 : 0));
    for (let i = 0; i < mateDeaths; i++) { U.pick(matesArr).d++; }

    /* 残局 */
    let clutchText = '';
    const clutchRoll = myWin ? U.clamp(0.1 + (eff.mental - 55) / 400 + (fbMine ? 0.05 : 0), 0.06, 0.3) : 0;
    if (U.rng() < clutchRoll) {
      me.clutch++; live.clutches++; me.k++; me.score += 260;
      clutchText = '（1v' + U.randInt(2, 3) + ' 残局成功）';
      if (U.rng() < 0.5) live.cast.push({ who: '解说 · 冷静小黎', text: '残局！他一个人把局面收回来了，心态太硬了。' });
    }

    /* 回合归属与经济 */
    if (myWin) {
      live.scoreMe++;
      live.myTeam.forEach(function (p) { p.credits = Math.min(9000, p.credits + 3000 + (U.rng() < 0.3 ? 200 : 0)); });
      live.theirTeam.forEach(function (p) { p.credits = Math.min(9000, p.credits + 1900); });
      pushLog('obj', '第 ' + r + ' 回合我方拿下' + clutchText + (myBuy === '经济局' ? ' —— 经济局翻盘！' : ''));
    } else {
      live.scoreThem++;
      live.theirTeam.forEach(function (p) { p.credits = Math.min(9000, p.credits + 3000); });
      live.myTeam.forEach(function (p) { p.credits = Math.min(9000, p.credits + 1900 + (U.rng() < 0.3 ? 200 : 0)); });
      pushLog('die', '第 ' + r + ' 回合被对手拿下' + (theirBuy === '经济局' ? '（被经济局翻盘）' : ''));
    }
    const cost = { '手枪局': 800, '经济局': 900, '半起': 2200, '强起': 3400, '满配': 4700 }[myBuy] || 3000;
    live.myTeam.forEach(function (p) { p.credits = Math.max(0, p.credits - cost); });
    const theirCost = { '手枪局': 800, '经济局': 900, '半起': 2200, '强起': 3400, '满配': 4700 }[theirBuy] || 3000;
    live.theirTeam.forEach(function (p) { p.credits = Math.max(0, p.credits - theirCost); });

    live.econDiff = Math.round(econAvg(live.myTeam) - econAvg(live.theirTeam));
    live.scoreHist.push(live.scoreMe - live.scoreThem);

    if (U.rng() < 0.25 && D.CAST_LINES.length) live.cast.push(U.pick(D.CAST_LINES));
    if (U.rng() < 0.55) live.danmu.push({ who: '观众' + U.randInt(100, 999), text: U.pick(D.DANMU) });
    if (U.rng() < 0.12) {
      live.aces++;
      live.cast.push({ who: '解说 · 激情老黄', text: '团灭！他们把对手全员清掉，这一回合是碾压。' });
      pushLog('obj', '我方完成一次团灭（五杀）');
    }

    live.round++;
    if (live.round === 13) {
      live.side = live.side === 'attack' ? 'defense' : 'attack';
      pushLog('obj', '半场交换攻防：我方转为' + (live.side === 'attack' ? '进攻方' : '防守方'));
      live.cast.push({ who: '解说 · 冷静小黎', text: '进入下半场，攻防互换，经济重置，这才是真正的开始。' });
    }
    const diff = Math.abs(live.scoreMe - live.scoreThem);
    const reached = Math.max(live.scoreMe, live.scoreThem);
    if (live.scoreMe === 12 && live.scoreThem === 12 && !live.overtime) {
      live.overtime = true;
      pushLog('obj', '12:12 —— 进入加时赛，必须净胜两回合才能拿下这张地图');
      live.cast.push({ who: '解说 · 冷静小黎', text: '12:12！加时赛，双方经济全部重置，这就是最残酷的舞台。' });
    }
    if (reached >= 13 && diff >= 2) finish();
    else if (live.round > 40) finish();
    renderAll();
  }

  function pushLog(t, text) { live.logs.push({ r: live.round, t: t, text: text }); }

  function finish() {
    live.ended = true;
    const win = live.scoreMe > live.scoreThem;
    live.result = win ? 'win' : 'lose';
    const me = live.myTeam[0];
    const kda = me.k + '/' + me.d + (me.a ? '/' + me.a : '');
    const acs = Math.round(me.score / Math.max(1, live.round - 1));
    pushLog(win ? 'obj' : 'die', win ? '我方以 ' + live.scoreMe + ':' + live.scoreThem + ' 拿下这张地图！' : '我方以 ' + live.scoreMe + ':' + live.scoreThem + ' 输掉这张地图。');
    pushLog('info', '赛后数据：' + S.profile.tag + ' ' + kda + ' · ACS ' + acs + ' · 首杀 ' + me.fk + ' · 残局 ' + me.clutch);
    live.cast.push({ who: '解说 · 激情老黄', text: win ? '他们赢了！这张图他们把节奏稳稳守到了最后。' : '可惜，下半场他们没能把经济优势转化成回合。' });
    U.burst(U.$('#modal-broadcast .modal-body'), win ? 22 : 8, win ? 'var(--accent)' : 'var(--red)', 220);
    ES.audio.play(win ? 'levelup' : 'fail');
    stop();
    renderAll();
  }

  /* ─────────── 结算 ─────────── */
  function settle() {
    if (!live || !live.ended) return;
    const me = live.myTeam[0];
    const win = live.result === 'win';
    const acs = Math.round(me.score / Math.max(1, live.round - 1));
    const kda = me.k + '/' + me.d + (me.a ? '/' + me.a : '');
    S.stats.matches++;
    if (win) S.stats.wins++; else S.stats.losses++;
    S.stats.kills += me.k; S.stats.deaths += me.d; S.stats.assists += me.a;
    S.stats.bestKills = Math.max(S.stats.bestKills, me.k);
    S.club.wins += win ? 1 : 0; S.club.losses += win ? 0 : 1;
    S.club.rank = U.clamp(S.club.rank + (win ? -1 : 1), 1, 12);
    S.club.bond = U.clamp((S.club.bond || 0) + (win ? 2 : -1), 0, 100);
    S.club.form = U.clamp(S.club.form + (win ? 8 : -8), 0, 100);
    const perf = U.clamp((me.k * 1.4 + me.clutch * 1.5 - me.d * 1.1) / 6, -1, 2);
    const effects = {
      res: {
        fame: win ? 4200 : 900, popularity: win ? 3 : -1, mood: win ? 10 + Math.round(perf * 3) : -9,
        energy: -12, hand: -4
      },
      attrs: win ? { gameSense: 2, comms: 1, mentality: 1 } : { mentality: 1, comms: 1 },
      special: { teammateTrust: win ? 6 : -3, coachTrust: win ? 6 : -2, fanLoyalty: win ? 5 : 1 },
      money: win ? Math.round(S.club.salary * 0.25) : 0
    };
    if (win && S.club.rank <= 6) effects.flags = { playoff: true };
    if (win && S.time.phaseId === 'worlds') effects.flags = { worlds: true };
    if (win && me.k >= 25) effects.res.fans = (effects.res.fans || 0) + 3;
    ES.narrative.applyEffects(effects, { silent: true });
    ES.state.pushLog(S, 'match', '比赛结束：' + (win ? '胜利' : '失利') + ' vs ' + live.opp.short + ' · ' + live.map + ' ' + live.scoreMe + ':' + live.scoreThem + ' · ' + S.profile.tag + ' ' + kda + ' · ACS ' + acs);
    let row = S.stats.seasonRows.filter(function (r) { return r.season === (S.time.seasonLabel || ('S' + S.time.season)) + ' · ' + S.time.year; })[0];
    if (!row) { row = { season: (S.time.seasonLabel || ('S' + S.time.season)) + ' · ' + S.time.year, club: S.club.short, matches: 0, kda: '0.00', kp: '—', dpm: '—', ovr: ES.state.ovr(S), honor: '进行中' }; S.stats.seasonRows.push(row); }
    row.matches = S.stats.matches;
    row.kda = ((S.stats.kills + S.stats.assists) / Math.max(1, S.stats.deaths)).toFixed(2);
    row.kp = me.fk + ' 次首杀';
    row.dpm = acs + ' ACS';
    row.ovr = ES.state.ovr(S);
    ES.narrative.renderAftermath(win, live, kda);
    U.closeModal('modal-broadcast');
    ES.narrative.afterSettle(win, { opponent: live.opp, kda: kda, kills: me.k, deaths: me.d, assists: me.a, acs: acs });
  }

  /* ─────────── 事件绑定 ─────────── */
  function bindOrderClicks() {
    /* 静态元素，只绑一次；重复绑定会导致「开始推演」被连点两次（开始后又暂停） */
    if (U.$('#bc-orders').__esBound) return;
    U.$('#bc-orders').__esBound = true;
    U.$('#bc-orders').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-order]');
      if (!btn) return;
      live.order = btn.getAttribute('data-order');
      ES.audio.play('click');
      renderOrders();
      U.toast({ tone: 'info', title: '战术指令已下达：' + (D.ORDERS.filter(function (o) { return o.id === live.order; })[0] || {}).name, msg: '点击「开始推演战局」进入对局。' });
    });
    U.$('#btn-bc-play').addEventListener('click', function () {
      ES.audio.play('click');
      start();
    });
    U.$('#btn-bc-settle').addEventListener('click', function () { ES.audio.play('success'); settle(); });
    U.$('#modal-broadcast').addEventListener('click', function (e) {
      if (e.target.closest('[data-close="modal-broadcast"]')) stop();
    });
  }

  function open(opts) {
    opts = opts || {};
    if (!live || live.ended || opts.fresh) newGame(opts);
    U.openModal('modal-broadcast');
    renderAll();
  }
  function current() { return live; }

  return {
    mount: mount, open: open, newGame: newGame, setState: function (s) { S = s; },
    current: current, bindOrderClicks: bindOrderClicks, stop: stop, MAPS: MAPS
  };
})();
