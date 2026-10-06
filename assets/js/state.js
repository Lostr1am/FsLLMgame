window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   状态层 · 依据规则书 v2.3
   —— 第7章 / 附录N：位置加权总评（基础分＋关键属性加成－短板惩罚）
   —— 7.13 / 附录AK：突破检定（1d100 ≤ 成功率）
   —— 附录V：身价模型（总评×人气×年龄×荣誉×合同剩余）
   —— 附录AW / 30.2：训练收益 = 基础值 ＋ 悟性×0.3 ＋ 状态×0.1 ＋ 资源 ＋ 教练 ＋ 难度 ± 1d6
   ═══════════════════════════════════════════════════════════════ */
ES.state = (function () {
  'use strict';
  const U = ES.util, D = ES.data;
  const SAVE_KEY = 'apex-corridor.data.v2';

  const listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, payload) { (listeners[evt] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.warn(e); } }); }

  /* ── 赛季阶段（第18章；按年份区分：2023 无联赛，2024 起走赛季日历） ── */
  const PHASES = [
    { id: 'beta', name: '封测期', from: 1, to: 6, desc: '国服封测，无联赛，网吧与排位阶段' },
    { id: 'launch', name: '开服首日', from: 7, to: 12, desc: '国服公测，俱乐部抢人建队' },
    { id: 'preseason', name: '季前休赛期', from: 1, to: 2, desc: '启点赛前的休整与转会补强' },
    { id: 'scout', name: '青训选拔期', from: 3, to: 3, desc: '青训营与挑战者赛集中招新' },
    { id: 'league', name: '第一联赛期', from: 4, to: 7, desc: '常规赛与季后赛' },
    { id: 'break', name: '休赛期', from: 8, to: 8, desc: '转会窗口与休整' },
    { id: 'worlds', name: '世界冠军赛期', from: 9, to: 11, desc: '大师赛与全球冠军赛' },
    { id: 'winter', name: '冬歇转会期', from: 12, to: 12, desc: '合同年谈判与阵容重组' }
  ];
  const SEASON_OF_YEAR = { 2023: 0, 2024: 1, 2025: 2, 2026: 3, 2027: 4, 2028: 5 };
  function seasonLabel(n) { return Number(n) <= 0 ? '国服元年' : 'S' + n; }
  function seasonOfYear(year, fallback) {
    if (SEASON_OF_YEAR[year] !== undefined) return SEASON_OF_YEAR[year];
    const n = parseInt(String(fallback || 'S1').replace(/\D/g, ''), 10);
    return isNaN(n) ? 1 : n;
  }
  /** 年份感知的阶段：2023 只有封测/开服；2024 起走赛季日历 */
  function phaseOf(month, year) {
    const y = Number(year) || 2024;
    if (y <= 2023) return month >= 7 ? PHASES[1] : PHASES[0];
    for (let i = 2; i < PHASES.length; i++) { if (month >= PHASES[i].from && month <= PHASES[i].to) return PHASES[i]; }
    return PHASES[2];
  }

  /* ── 定位 ── */
  function positionOf(s) {
    return D.POSITIONS.filter(function (p) { return p.id === s.positionId; })[0] || D.POSITIONS[0];
  }

  /* ── 引用解析（建档向导可能传 id，也可能传整个数据对象） ── */
  function byId(list, v) {
    if (!v) return null;
    if (typeof v === 'string') return list.filter(function (x) { return x.id === v; })[0] || null;
    return list.filter(function (x) { return x.id === v.id; })[0] || v;
  }
  function resolveTimeline(v) { return byId(D.TIMELINES, v) || D.TIMELINES[0]; }
  function resolveCity(v) { return byId(D.CITIES_CN.concat(D.CITIES_GLOBAL), v) || null; }
  function resolveClub(v) { return v ? byId(D.CLUBS, v) : null; }
  /** 附录 Q.6：先定位年份，再取该年份列的阵容 */
  function rosterYearFor(tl) {
    const r = String((tl && tl.roster) || '2025');
    if (r.indexOf('2026') === 0) return '2026';
    if (r === '2023') return '2024';   /* 2023 尚无联赛，以 2024 名单作建队基准 */
    return r;
  }

  /* ── 旧存档迁移（v2.3 修复：赛季标签与年份感知阶段） ── */
  function migrate(st) {
    if (!st || !st.time) return st;
    if (st.time.seasonLabel === undefined) st.time.seasonLabel = seasonLabel(st.time.season);
    if (st.time.year === undefined) st.time.year = 2024 + Math.max(0, (st.time.season || 1) - 1);
    const ph = phaseOf(st.time.month, st.time.year);
    if (st.time.phaseId !== ph.id) { st.time.phase = ph.name; st.time.phaseId = ph.id; }
    return st;
  }
  /* ── 建档 ── */
  function create(setup) {
    const diff = D.DIFFICULTIES.filter(function (d) { return d.id === setup.difficulty; })[0] || D.DIFFICULTIES[1];
    const origin = D.ORIGINS.filter(function (o) { return o.id === setup.origin; })[0] || D.ORIGINS[0];
    const tl = resolveTimeline(setup.timeline);
    const city = resolveCity(setup.city);
    const legend = setup.mode === 'legend' ? D.LEGENDS.filter(function (l) { return l.id === setup.legendId; })[0] : null;
    const pos = D.POSITIONS.filter(function (p) { return p.id === (setup.positionId || (legend && legend.positionId)); })[0] || D.POSITIONS[0];
    const clubDef = resolveClub(setup.clubId);

    /* 属性：传奇 → 出身 → 素人基线；再叠加时间线 / 城市 / 难度取点 */
    const attrs = {};
    D.ATTRS.forEach(function (a) {
      let base;
      if (legend && legend.attrs[a.k] !== undefined) base = legend.attrs[a.k];
      else if (setup.mode === 'custom' && origin.attrs[a.k] !== undefined) base = origin.attrs[a.k];
      else base = 44 + Math.round(Math.random() * 8);
      base += (tl.attrs && tl.attrs[a.k]) || 0;
      base += (city && city.attrs && city.attrs[a.k]) || 0;
      attrs[a.k] = Math.round(base);
    });
    /* 出身总评加成：直接补到五项评定属性上（按位置权重反推） */
    if (origin.ovrBonus) {
      D.POSITIONS[0] && Object.keys(pos.weights).forEach(function (k) {
        attrs[k] = (attrs[k] || 0) + Math.round(origin.ovrBonus / (pos.weights[k] * 5));
      });
    }
    /* 难度取点：把评定属性整体拉到该难度的总评区间 */
    if (setup.mode === 'custom' && !setup.ovrTarget) setup.ovrTarget = Math.round((diff.mods.ovrMin + diff.mods.ovrMax) / 2);
    if (setup.ovrTarget) {
      const keyAvgNow = pos.key.reduce(function (a, k) { return a + attrs[k]; }, 0) / pos.key.length;
      const otherAvgNow = Object.keys(pos.weights).filter(function (k) { return pos.key.indexOf(k) < 0; })
        .reduce(function (a, k) { return a + attrs[k]; }, 0) / (Object.keys(pos.weights).length - pos.key.length);
      const cur = keyAvgNow * pos.key.reduce(function (a, k) { return a + pos.weights[k]; }, 0) +
        otherAvgNow * (1 - pos.key.reduce(function (a, k) { return a + pos.weights[k]; }, 0));
      const delta = setup.ovrTarget - cur;
      if (Math.abs(delta) > 0.5) Object.keys(pos.weights).forEach(function (k) { attrs[k] = Math.round(attrs[k] + delta); });
    }
    /* 性格修正 */
    const traitRes = {};
    (setup.traits || []).forEach(function (tid) {
      const t = D.TRAITS.filter(function (x) { return x.id === tid; })[0];
      if (!t) return;
      Object.keys(t.mods).forEach(function (k) {
        if (attrs[k] !== undefined) attrs[k] += t.mods[k];
        else if (['condition', 'hand', 'fans', 'fame', 'heat', 'standing'].indexOf(k) >= 0) traitRes[k] = (traitRes[k] || 0) + t.mods[k];
      });
    });
    /* 外貌影响魅力 */
    attrs.charisma = (attrs.charisma || 50) + Math.round((setup.look - 5) * 1.4);
    /* 气运由难度决定（2.1） */
    attrs.luck = diff.mods.luck;

    /* 天赋与体质 */
    const talents = [];
    (setup.talents || []).forEach(function (t) {
      const q = D.QUALITIES[t.quality] || D.QUALITIES.white;
      const tpl = D.TALENTS.filter(function (x) { return x.id === t.id; })[0];
      if (tpl) talents.push(buildTalent(tpl, q));
    });
    let body = null;
    if (setup.bodyId) {
      const b = D.BODIES.filter(function (x) { return x.id === setup.bodyId; })[0];
      if (b) body = { id: b.id, name: b.name, desc: b.desc, icon: b.icon, eff: b.eff };
    }

    /* 属性上限：取天赋品质最高档（8.3 / 30.1） */
    let cap = 85;
    talents.forEach(function (t) { cap = Math.max(cap, (D.QUALITIES[t.quality] || {}).cap || 85); });
    if (!talents.length) cap = 85;
    if (body && body.eff && body.eff.reactionCap) cap = Math.max(cap, body.eff.reactionCap);

    /* 天赋与体质对属性的即时加成 */
    const applyMod = function (eff, mul) {
      Object.keys(eff || {}).forEach(function (k) {
        if (attrs[k] !== undefined) attrs[k] += Math.round(eff[k] * (mul || 1));
      });
    };
    talents.forEach(function (t) {
      Object.keys(t.eff).forEach(function (k) {
        if (attrs[k] !== undefined) attrs[k] += t.eff[k];
      });
    });
    if (body) applyMod(body.eff, 1);

    Object.keys(attrs).forEach(function (k) {
      const kCap = (body && k === 'reaction' && body.eff && body.eff.reactionCap) ? body.eff.reactionCap : cap;
      attrs[k] = U.clamp(Math.round(attrs[k]), 5, kCap);
    });

    /* 特殊与资源 */
    const special = {
      coachTrust: legend ? 70 : 50,
      teammateTrust: legend ? 66 : 50,
      fanLoyalty: legend ? 74 : 45,
      antiThreat: U.clamp((origin.id === 'wanted' ? 35 : 15) + ((body && body.eff.antiThreat) || 0), 0, 100),
      fame: legend ? U.clamp(Math.round(attrs.charisma * 0.7) + 20, 0, 100) : Math.round(attrs.charisma * 0.5),
      heat: origin.id === 'wanted' ? 28 : 8,
      standing: origin.id === 'academy' ? 22 : 12,
      versionBonus: legend ? 6 : 0,
      clutch: (body && body.eff.clutch) || 0,
      cap: cap
    };
    special.fanLoyalty = U.clamp(special.fanLoyalty + (traitRes.fanLoyalty || 0), 0, 100);
    special.antiThreat = U.clamp(special.antiThreat + (traitRes.antiThreat || 0), 0, 100);

    const month = tl.month, day = tl.day;
    const phase = phaseOf(month, tl.year);
    const seasonNum = seasonOfYear(tl.year, tl.season);
    const club = makeClub(setup, origin, legend, clubDef, attrs, special, tl);

    const state = {
      v: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      difficulty: setup.difficulty,
      difficultyName: diff.name,
      cheat: !!diff.cheat,
      mode: setup.mode,
      legendId: setup.legendId || null,
      origin: setup.origin,
      positionId: pos.id,
      talents: talents,
      body: body,
      talentRollsLeft: diff.mods.rerolls,
      profile: {
        name: setup.name, tag: setup.tag, gender: setup.gender, age: setup.age, height: setup.height,
        look: setup.look, orientation: setup.orientation, loveStyle: setup.loveStyle || '专一型',
        traits: (setup.traits || []).slice(), catchphrase: setup.catchphrase, sigil: setup.sigil, sign: setup.sign || ''
      },
      city: city,
      timelineId: tl.id,
      attrs: attrs,
      special: special,
      res: {
        money: Math.round((legend ? 240000 : origin.money) * (setup.difficulty === 'cheat' ? 1 : 1) + (diff.id === 'chosen' ? 0 : 0)),
        fans: Math.round(((legend ? 80 : (origin.fans || 0)) * diff.mods.fansMul) + (traitRes.fans || 0)),
        condition: U.clamp((origin.res.condition || 78) + (traitRes.condition || 0), 5, 100),
        hand: U.clamp((origin.res.hand || 88) + (traitRes.hand || 0), 5, 100),
        injury: U.clamp((body && body.eff.injuryMul === 2 ? 14 : 6), 0, 100)
      },
      statuses: [],
      club: club,
      relations: [],
      romance: { state: 'single', npcId: null, affection: 0, public: 0, love: 0, family: 0 },
      quests: [],
      news: [],
      achievements: [],
      log: [],
      flags: {},
      metrics: {
        rankGames: 0, vodReviews: 0, gymSessions: 0, streams: 0, mediaDone: 0, choices: 0,
        trainStreak: 0, restStreak: 0, scrims: 0, matches: 0
      },
      scene: { chapterId: tl.startNode || 'ch1_beta', nodeId: tl.startNode || 'ch1_beta', history: [], turnText: [] },
      time: {
        season: seasonNum, seasonLabel: seasonLabel(seasonNum), year: tl.year,
        month: month, day: day, week: 1, clock: '21:40',
        /* 开局阶段以所选时间线为准，之后由 phaseOf(month, year) 推进 */
        phase: tl.phase || phase.name, phaseId: phaseOf(month, tl.year).id,
        turn: 0, dayCount: 0
      },
      stats: { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, bestKills: 0, bestFK: 0, bestClutch: 0, aces: 0, choices: 0, seasonRows: [], honorList: [], ovrHistory: [] },
      settings: {
        textSpeed: 62, storyLength: 'normal', temperature: 70, showRoll: true, pity: true,
        theme: 'harbor', motion: 'full', uiScale: 100, sfx: true, sfxDice: true, sfxNotify: true, volume: 45,
        autosave: true, dashDesktop: false
      }
    };

    if (legend) {
      state.stats.honorList = [legend.honor];
      state.flags.legendary = legend.id;
      state.stats.rankPoints = 320;
      state.flags.legendItem = legend.item;
    }
    /* 特工池（9.1 / 9.2）：本命特工 + 3—5 名熟练特工，熟练度 0—100 */
    const posAgents = pos.agents.slice();
    const sig = (legend && legend.agent) ? legend.agent.split(' / ')[0] : posAgents[0];
    state.agents = [{ name: sig, role: pos.name, mastery: legend ? U.randInt(88, 96) : U.randInt(62, 78), signature: true }];
    posAgents.filter(function (a) { return a !== sig; }).slice(0, 3).forEach(function (a) {
      state.agents.push({ name: a, role: pos.name, mastery: U.randInt(35, 62), signature: false });
    });
    const cross = D.POSITIONS.filter(function (p) { return p.id !== pos.id; });
    U.pickMany(cross, 2).forEach(function (p) {
      state.agents.push({ name: U.pick(p.agents), role: p.name, mastery: U.randInt(15, 34), signature: false });
    });
    if (origin.id === 'streamer') state.flags.streamerDuty = true;
    if (origin.id === 'student') state.flags.studentDuty = true;
    if (diff.cheat) state.flags.cheatMode = true;

    state.relations = makeRelations(state);
    state.quests = makeQuests(state);
    state.news = makeNews(state, 8);
    state.stats.ovrHistory.push({ turn: 0, ovr: ovr(state), level: level(ovr(state)).name });
    state.log = [{
      turn: 0, time: timeText(state), kind: 'system',
      text: '建档完成：' + state.profile.name + '（' + state.profile.tag + '） · ' + diff.name + '难度 · ' + pos.name + ' · ' + (club ? club.name : '无俱乐部')
    }];
    state.scene.turnText = [];
    return state;
  }

  /* ── 天赋构建（品质倍率放大效果） ── */
  function buildTalent(tpl, quality) {
    const eff = {};
    Object.keys(tpl.eff).forEach(function (k) { eff[k] = Math.round(tpl.eff[k] * quality.mul); });
    const lines = Object.keys(eff).map(function (k) { return { k: k, name: labelOf(k), v: eff[k] }; });
    return {
      id: tpl.id, name: tpl.name, direction: tpl.direction, icon: tpl.icon,
      quality: quality.id, qualityName: quality.name, mul: quality.mul, cap: quality.cap,
      desc: tpl.desc, eff: eff, lines: lines
    };
  }

  /* ── 俱乐部（附录Q 数据 + 合同体系 附录V.2） ── */
  function makeClub(setup, origin, legendary, def, attrs, special, tl) {
    if (!def) return null;
    const ry = rosterYearFor(tl);
    const rosterAll = (def.rosters && def.rosters[ry]) ? def.rosters[ry].slice() : (def.roster || []).slice();
    const year = (tl && tl.year) || 2024;
    const rosterNote = (tl && tl.year <= 2023) ? year + ' · 建队期（以 2024 年阵容为基准）'
      : (tl && tl.year >= 2027) ? year + ' 演绎扩展（以 2026 年阵容为基准）'
        : year + ' 赛季基准（' + ry + ' 年阵容）';
    /* 队内定位：名单里含玩家本人 → 首发；否则自创角色从替补做起，现实五人保持完整 */
    const selfName = setup.name || '你';
    const myTag = String(setup.tag || '').toLowerCase();
    const selfInRoster = rosterAll.some(function (nm) { return String(nm).toLowerCase() === myTag; });
    const baseline = rosterAll.slice(0, 5);
    const lineup = selfInRoster
      ? { baseline: baseline.slice(), current: baseline.slice(), benchNames: rosterAll.slice(5), selfStatus: 'starter', selfInRoster: true, replaced: null, selfName: selfName }
      : { baseline: baseline.slice(), current: baseline.slice(), benchNames: rosterAll.slice(5), selfStatus: 'bench', selfInRoster: false, replaced: null, selfName: selfName };
    const ovrGuess = attrs ? Math.round((attrs.aim + attrs.reaction + attrs.gameSense + attrs.mentality + attrs.comms) / 5) : 60;
    const baseByLevel = ovrGuess >= 90 ? 2000000 : ovrGuess >= 80 ? 300000 : ovrGuess >= 70 ? 50000 : ovrGuess >= 60 ? 20000 : 5000;
    const tierMul = { T0: 1.5, T1: 1.0, T2: 0.7 }[def.tier] || 1.0;
    const salary = U.clamp(Math.round(baseByLevel * 20 * tierMul / 10000) * 10000, 60000, 20000000);
    const cityCost = setup.city && setup.city.bars ? setup.city.bars.cost : 6;
    return {
      id: def.id, name: def.name, short: def.short, region: def.region, city: def.city, tier: def.tier,
      seat: def.seat, style: def.style, roster: rosterAll, rosters: def.rosters || {}, rosterYear: ry, rosterNote: rosterNote,
      lineup: lineup,
      honors: def.honors, line: def.line,
      fansLabel: def.fans, env: def.env,
      league: 'VCT ' + (def.region === 'CN' ? 'CN' : def.region) + ' 联赛',
      role: null,
      salary: salary, years: legendary ? 2 : 3,
      buyout: salary * (legendary ? 8 : 5),
      bonus: Math.round(salary * 0.35),
      signed: !!legendary, standing: 0, rank: U.clamp(Math.round((def.tier === 'T0' ? 4 : def.tier === 'T1' ? 7 : 10) + U.randInt(-1, 1)), 1, 12),
      wins: 0, losses: 0, form: 50, bond: 12,
      expectation: legendary ? '必须夺冠' : (def.tier === 'T0' ? '至少打进世界赛' : '打进季后赛'),
      livingCost: Math.round(cityCost * 900 + (def.env === '顶级基地' ? 0 : 1200)),
      contractNote: legendary ? '传奇合同' : '待签约',
      signedAt: null
    };
  }

  /* ── 关系网（第25章人物库） ── */
  function makeRelations(state) {
    const rel = [];
    let idx = 0;
    function add(o) {
      const r = {
        id: 'npc-' + (++idx), name: o.name, tag: o.tag, role: o.role, type: o.type, persona: o.persona,
        affection: o.affection, trust: o.trust, events: [], callable: o.callable !== false
      };
      /* 业务字段透传（白名单此前把它们丢了） */
      if (o.positionId) r.positionId = o.positionId;
      if (o.fromRoster !== undefined) r.fromRoster = o.fromRoster;
      if (o.starter !== undefined) r.starter = o.starter;
      if (o.kind) r.kind = o.kind;
      rel.push(r);
    }
    const coach = U.pick(D.NPCS.coach);
    add(Object.assign({}, coach, { role: '主教练', type: 'coach', affection: U.clamp(state.special.coachTrust, 5, 95), trust: U.clamp(state.special.coachTrust + 6, 5, 95) }));
    add(Object.assign({}, U.pick(D.NPCS.manager), { role: '运营经理', type: 'manager', affection: U.randInt(40, 62), trust: U.randInt(42, 62) }));
    add(Object.assign({}, D.NPCS.medic[0], { role: '队医 · 理疗师', type: 'medic', affection: U.randInt(45, 65), trust: U.randInt(50, 72) }));
    add(Object.assign({}, D.NPCS.analyst[0], { role: '数据分析师', type: 'analyst', affection: U.randInt(40, 60), trust: U.randInt(45, 68) }));
    add(Object.assign({}, D.NPCS.medic[1], { role: '心理顾问', type: 'psych', affection: U.randInt(42, 64), trust: U.randInt(48, 70) }));
    add(Object.assign({}, U.pick(D.NPCS.streamer), { role: '圈内好友 · 主播', type: 'friend', affection: U.randInt(58, 78), trust: U.randInt(55, 76) }));
    add(Object.assign({}, D.NPCS.agent[0], { role: '经纪人', type: 'agent', affection: U.randInt(36, 56), trust: U.randInt(40, 62) }));
    add(Object.assign({}, U.pick(D.NPCS.rival), { role: '宿敌 · 同位置', type: 'rival', affection: U.randInt(8, 24), trust: U.randInt(5, 20) }));
    add(Object.assign({}, U.pick(D.NPCS.media), { role: '电竞记者', type: 'media', affection: U.randInt(28, 46), trust: U.randInt(25, 45) }));

    /* 队友与替补：按 lineup 生成 —— 替补身份时现实首发五人完整在位；
       首发身份时玩家占据一个位置，被顶替者转入替补席（可自选顶替谁） */
    const L = state.club ? state.club.lineup : null;
    const myName = (state.profile && state.profile.name) || '你';
    const order = D.POSITIONS.concat([D.POSITIONS[1]]);
    const clubLabel = (state.club ? state.club.short : '俱乐部') + ' ' + (state.club && state.club.rosterNote ? state.club.rosterNote : '阵容');
    const used = {};
    const myTagLC = String((state.profile && state.profile.tag) || '').toLowerCase();
    const isSelf = function (nm) {
      const s = String(nm);
      return s === String(myName) || (!!myTagLC && s.toLowerCase() === myTagLC);
    };
    if (L) {
      /* 首发（可能含玩家）：替补身份看 5 名现实首发，首发身份则是其余 4 人 */
      const mateNames = L.current.filter(function (nm) { return !isSelf(nm); });
      const slots = L.selfStatus === 'bench' ? 5 : 4;
      mateNames.slice(0, slots).forEach(function (nm, i) {
        const p = order[i % order.length];
        used[String(nm).toLowerCase()] = 1;
        add({
          name: nm, tag: String(nm).slice(0, 7), role: '队友 · ' + p.name, positionId: p.id, type: 'teammate',
          fromRoster: true, starter: true,
          persona: '现实选手（' + clubLabel + '）：' + p.name + '位首发，按公开赛场形象设定；描写以其比赛 ID 与赛场表现为限，不涉及私生活与未公开信息。',
          affection: U.clamp(state.special.teammateTrust + U.randInt(-10, 12), 10, 92),
          trust: U.clamp(state.special.teammateTrust + U.randInt(-6, 14), 10, 92)
        });
      });
      /* 替补席：被顶替者优先，其余为名单中未首发者 */
      const benchList = [];
      if (L.replaced) benchList.push(L.replaced);
      (L.benchNames || []).forEach(function (nm) { if (benchList.indexOf(nm) < 0) benchList.push(nm); });
      benchList.slice(0, 3).forEach(function (nm, i) {
        const p = order[(4 + i) % order.length];
        used[String(nm).toLowerCase()] = 1;
        const replacedByMe = L.replaced === nm;
        add({
          name: nm, tag: String(nm).slice(0, 7), role: (replacedByMe ? '替补（被你顶替） · ' : '替补 · ') + p.name,
          positionId: p.id, type: 'bench', fromRoster: true,
          persona: replacedByMe
            ? '现实选手（' + clubLabel + '）：' + p.name + '位，首发位置被你顶替后转入替补席。关系数值会随剧情变化。'
            : '现实选手（' + clubLabel + '）：' + p.name + '位替补/轮换，随赛季与大名单浮动。',
          affection: U.clamp(state.special.teammateTrust - (replacedByMe ? 18 : 6) + U.randInt(-8, 10), 5, 88),
          trust: U.clamp(state.special.teammateTrust - (replacedByMe ? 14 : 8) + U.randInt(-6, 12), 5, 86)
        });
      });
      /* 替补身份时，补一名虚构队内竞争者，形成「抢位置」的压力 */
      if (L.selfStatus === 'bench') {
        const rival = D.TEAMMATE_POOL.filter(function (m) {
          return m.role.indexOf('替补') === 0 && !used[String(m.name).toLowerCase()];
        })[0];
        if (rival) add(Object.assign({}, rival, { role: '队内竞争者', type: 'bench', affection: U.randInt(17, 36), trust: U.randInt(12, 32) }));
      }
      /* 名额不足时用虚构队友补齐（替补需 5 人，首发需 4 人） */
      if (mateNames.length < slots) {
        const pool = D.TEAMMATE_POOL.filter(function (m) {
          return m.role.indexOf('替补') < 0 && !used[String(m.name).toLowerCase()];
        });
        U.pickMany(pool, slots - mateNames.length).forEach(function (m) {
          const p = D.POSITIONS.filter(function (x) { return m.role.indexOf(x.name) >= 0; })[0] || D.POSITIONS[0];
          add(Object.assign({}, m, {
            role: '队友 · ' + m.role, positionId: p.id, type: 'teammate', fromRoster: false,
            affection: U.clamp(state.special.teammateTrust + U.randInt(-12, 12), 10, 92),
            trust: U.clamp(state.special.teammateTrust + U.randInt(-8, 14), 10, 92)
          }));
        });
      }
    } else {
      /* 未选俱乐部：全部用虚构队友 */
      const pool = D.TEAMMATE_POOL.filter(function (m) { return m.role.indexOf('替补') < 0; });
      U.pickMany(pool, 4).forEach(function (m) {
        const p = D.POSITIONS.filter(function (x) { return m.role.indexOf(x.name) >= 0; })[0] || D.POSITIONS[0];
        add(Object.assign({}, m, {
          role: '队友 · ' + m.role, positionId: p.id, type: 'teammate', fromRoster: false,
          affection: U.clamp(state.special.teammateTrust + U.randInt(-12, 12), 10, 92),
          trust: U.clamp(state.special.teammateTrust + U.randInt(-8, 14), 10, 92)
        }));
      });
      const bench = D.TEAMMATE_POOL.filter(function (m) { return m.role.indexOf('替补') === 0; })[0];
      if (bench) add(Object.assign({}, bench, { role: '队内竞争者', type: 'bench', affection: U.randInt(17, 36), trust: U.randInt(12, 32) }));
    }
    /* 情缘候选 */
    U.pickMany(D.NPCS.partner, 2).forEach(function (p) {
      add(Object.assign({}, p, { role: '关系候选', type: 'partner', affection: U.randInt(25, 48), trust: U.randInt(30, 52) }));
    });
    return rel;
  }

  /** 上首发：把你写进首发五人，顶替 selectedName（不传则顶替最弱的位置），并迁移队内关系 */
  function promotePlayer(st, selectedName) {
    if (!st || !st.club || !st.club.lineup) return null;
    const L = st.club.lineup;
    if (L.selfStatus === 'starter') return null;
    const myName = (st.profile && st.profile.name) || '你';
    const candidates = L.current.slice();
    const target = (selectedName && candidates.indexOf(selectedName) >= 0) ? selectedName : candidates[candidates.length - 1];
    const idx = L.current.indexOf(target);
    if (idx < 0) return null;
    L.current[idx] = myName;
    L.selfStatus = 'starter';
    L.replaced = target;
    L.selfName = myName;
    /* 关系迁移：顶替者转替补，其余现实首发保持队友，计数与首发口径一致 */
    const myTagLC2 = String((st.profile && st.profile.tag) || '').toLowerCase();
    const isMe = function (nm) { const s = String(nm); return s === myName || (!!myTagLC2 && s.toLowerCase() === myTagLC2); };
    const mateNames = L.current.filter(function (nm) { return !isMe(nm); });
    const benchNames = [];
    if (target) benchNames.push(target);
    (L.benchNames || []).forEach(function (nm) { if (benchNames.indexOf(nm) < 0) benchNames.push(nm); });
    const order = D.POSITIONS.concat([D.POSITIONS[1]]);
    const findRel = function (nm) { return st.relations.filter(function (r) { return r.name === nm; })[0]; };
    st.relations.forEach(function (r) {
      if (r.type !== 'teammate' && r.type !== 'bench') return;
      const i = mateNames.indexOf(r.name);
      if (i >= 0) {
        r.type = 'teammate';
        r.role = '队友 · ' + order[i % order.length].name;
        r.starter = true;
        return;
      }
      const j = benchNames.indexOf(r.name);
      if (j >= 0) {
        r.type = 'bench';
        r.role = (r.name === target ? '替补（被你顶替） · ' : '替补 · ') + order[(4 + j) % order.length].name;
        r.starter = false;
        if (r.name === target) {
          r.affection = U.clamp(r.affection - 18, 5, 88);
          r.trust = U.clamp(r.trust - 14, 5, 86);
          r.persona = String(r.persona || '').replace(/首发/, '首发位置被你顶替');
        }
      }
    });
    /* 首发人数补齐到 5 人 */
    const haveMates = st.relations.filter(function (r) { return r.type === 'teammate'; }).length;
    if (haveMates < 4) {
      const used = {};
      st.relations.forEach(function (r) { used[r.name] = 1; });
      const pool = D.TEAMMATE_POOL.filter(function (m) { return !used[m.name] && m.role.indexOf('替补') < 0; });
      U.pickMany(pool, Math.max(0, 4 - haveMates)).forEach(function (m) {
        const p = D.POSITIONS.filter(function (x) { return m.role.indexOf(x.name) >= 0; })[0] || D.POSITIONS[0];
        st.relations.push({
          id: 'npc-' + Math.random().toString(36).slice(2, 8), name: m.name, tag: m.tag, role: '队友 · ' + p.name,
          positionId: p.id, type: 'teammate', fromRoster: false, persona: m.persona, affection: 50, trust: 50, events: [], callable: true
        });
      });
    }
    return { target: target, starters: L.current.slice(), bench: benchNames.slice() };
  }

  /** 队内定位文案（供各面板复用） */
  function lineupText(s) {
    const L = s && s.club && s.club.lineup;
    if (!L) return '无俱乐部';
    if (L.selfStatus === 'starter') return L.replaced ? ('首发 · 顶替 ' + L.replaced) : '首发 · 名单内';
    return '替补席（' + L.current.length + ' 人首发）· 需争取首发';
  }
  /* ══════════ 赛季赛历（规则书 18.2 / 27.4 / 27.5） ══════════ */
  const SEASON_MONTHS = {
    1: { name: '季前休整 / 开服预热', kind: 'off' },
    2: { name: '排位开启 · 季前备战', kind: 'pre' },
    3: { name: '青训招新季 · 试训与选秀', kind: 'scout' },
    4: { name: '启点赛（Kickoff）', kind: 'kickoff', league: true },
    5: { name: '联赛第一分段 · 常规赛', kind: 'league', league: true, playoff: true },
    6: { name: '大师赛一（国际）', kind: 'masters', intl: 'masters1' },
    7: { name: '联赛第二分段 · 常规赛', kind: 'league', league: true, window: '夏季转会窗' },
    8: { name: '大师赛二（国际）', kind: 'masters', intl: 'masters2' },
    9: { name: '联赛第三分段 · 常规赛 + 季后赛', kind: 'league', league: true, playoff: true },
    10: { name: '全球冠军赛（Champions）', kind: 'champions', intl: 'champions' },
    11: { name: '冬季转会窗 / 休赛期', kind: 'off', window: '冬季转会窗' },
    12: { name: '年度颁奖盛典 · 全明星周末', kind: 'award' }
  };
  /* 国际赛事举办地（取自规则书人物档中的现实赛事记录，缺省留待定） */
  const INTL_HOSTS = {
    2024: { masters1: '曼谷', masters2: '上海', champions: '首尔' },
    2025: { masters1: '曼谷', masters2: '多伦多', champions: '巴黎' },
    2026: { masters1: '待定', masters2: '待定', champions: '待定' }
  };
  function hostOf(year, key) {
    const h = INTL_HOSTS[year] || {};
    return h[key] || '待定';
  }
  /** 该月是否赛区联赛比赛月 */
  function leagueMonth(month) { return !!(SEASON_MONTHS[month] && SEASON_MONTHS[month].league); }
  /** 同赛区对手（按日期确定性抽取，保证每次渲染一致） */
  function opponentFor(s, month, day) {
    const region = (s.club && s.club.region) || 'CN';
    const pool = D.CLUBS.filter(function (c) { return c.region === region && (!s.club || c.id !== s.club.id); });
    if (!pool.length) return null;
    const seed = s.time.year * 10000 + month * 100 + day;
    return pool[seed % pool.length];
  }
  /** 某月的真实赛程（阶段节点 + 联赛比赛日 + 转会窗） */
  function monthSchedule(s, month) {
    const out = [];
    const meta = SEASON_MONTHS[month];
    if (!meta) return out;
    const year = s.time.year;
    const isS1 = year <= 2024 && month >= 1 && month <= 3;   /* 2024 之前的 1—3 月是筹建期 */
    if (meta.intl) {
      const city = hostOf(year, meta.intl);
      const label = meta.intl === 'champions' ? '全球冠军赛' : (meta.intl === 'masters1' ? '大师赛一' : '大师赛二');
      out.push({ day: 5, text: label + ' · 小组赛（' + city + '）', tone: 'gold', icon: 'sword', kind: 'intl' });
      out.push({ day: 19, text: label + ' · 淘汰赛（' + city + '）', tone: 'gold', icon: 'medal', kind: 'intl' });
      out.push({ day: 26, text: label + ' · 决赛日（' + city + '）', tone: 'gold', icon: 'trophy', kind: 'intl' });
    }
    if (meta.league && !isS1) {
      /* 常规赛：每周三、周六两场（VCT CN 真实节奏） */
      for (let d = 1; d <= 28; d++) {
        if (d % 7 !== 3 && d % 7 !== 6) continue;
        const opp = opponentFor(s, month, d);
        if (!opp) continue;
        out.push({ day: d, text: (month === 4 ? '启点赛' : 'VCT ' + ((s.club && s.club.region) || 'CN') + ' 常规赛') + ' · vs ' + opp.short, tone: 'cyan', icon: 'sword', kind: 'match', opponent: opp.id });
      }
      if (meta.playoff) {
        out.push({ day: 24, text: '阶段季后赛 · 八进四', tone: 'cyan', icon: 'swords', kind: 'match' });
        out.push({ day: 27, text: '阶段季后赛 · 半决赛', tone: 'cyan', icon: 'swords', kind: 'match' });
        out.push({ day: 28, text: '阶段总决赛（BO5）', tone: 'gold', icon: 'trophy', kind: 'match' });
      }
    }
    if (meta.scout) out.push({ day: 12, text: '青训营公开试训日', tone: 'violet', icon: 'users', kind: 'scout' });
    if (meta.window) out.push({ day: 8, text: meta.window + '开启 · 合同谈判', tone: 'gold', icon: 'briefcase', kind: 'window' });
    if (meta.kind === 'award') {
      out.push({ day: 15, text: '年度颁奖盛典（最佳新人 / 最佳选手）', tone: 'gold', icon: 'medal', kind: 'award' });
      out.push({ day: 22, text: '全明星周末 · 表演赛', tone: 'violet', icon: 'star', kind: 'award' });
    }
    if (meta.kind === 'off') out.push({ day: 20, text: '俱乐部年度休整 / 商业活动', tone: 'dim', icon: 'clock', kind: 'off' });
    if (meta.kind === 'pre') {
      out.push({ day: 6, text: '排位赛季开启 · 冲分与试训', tone: 'cyan', icon: 'target', kind: 'train' });
      out.push({ day: 18, text: '季前赛训营 · 阵容磨合', tone: 'cyan', icon: 'users', kind: 'train' });
    }
    /* 兜底：任何月份都要给模型一个可对齐的日程 */
    if (!out.length) out.push({ day: 14, text: meta.name + ' · 队内训练与排位', tone: 'dim', icon: 'target', kind: 'train' });
    return out;
  }
  /** 下一场比赛（供面板与提示词引用） */
  function nextMatch(s) {
    const now = s.time.day;
    const cur = monthSchedule(s, s.time.month).filter(function (e) { return e.kind === 'match' && e.day >= now; });
    if (cur.length) return { inDays: cur[0].day - now, text: cur[0].text, month: s.time.month, day: cur[0].day };
    for (let i = 1; i <= 3; i++) {
      const m = ((s.time.month - 1 + i) % 12) + 1;
      const list = monthSchedule(s, m).filter(function (e) { return e.kind === 'match' || e.kind === 'intl'; });
      if (list.length) return { inDays: (28 - now) + (i - 1) * 28 + list[0].day, text: list[0].text, month: m, day: list[0].day };
    }
    return null;
  }
  /* ══════════ 剧情变量回写（AI 的 <vars> 块；时间由剧情驱动） ══════════ */
  const ATTR_ALIAS = {
    '枪法': 'aim', '反应': 'reaction', '意识': 'gameSense', '心态': 'mentality', '沟通': 'comms',
    '身法': 'movement', '体能': 'stamina', '魅力': 'charisma', '悟性': 'insight', '气运': 'luck'
  };
  const RES_ALIAS = {
    '竞技状态': 'condition', '状态': 'condition', '手部健康': 'hand', '手': 'hand',
    '伤病风险': 'injury', '伤病': 'injury', '舆论热度': 'heat', '热度': 'heat'
  };
  const SPECIAL_ALIAS = {
    '名声': 'fame', '声望': 'fame', '名气': 'fame', '教练信任': 'coachTrust',
    '队友信任': 'teammateTrust', '队内地位': 'standing', '地位': 'standing'
  };
  function attrKeyOf(v) {
    const s = String(v || '').trim();
    if (D.ATTRS && D.ATTRS.some(function (a) { return a.k === s; })) return s;
    return ATTR_ALIAS[s] || s;
  }
  /** 把任意形态的 <vars> 补丁归一化 */
  function normalizeStoryVars(patch) {
    const out = { attrs: {}, res: {}, special: {}, relations: {}, flags: {}, metrics: {}, status: [], money: 0, time: null, notes: [] };
    if (!patch || typeof patch !== 'object') return out;
    const num = function (v) { const n = Number(v); return isNaN(n) ? 0 : n; };
    const takeAttrs = function (obj) {
      Object.keys(obj || {}).forEach(function (k) {
        const key = attrKeyOf(k);
        if (out.attrs[key] !== undefined) out.attrs[key] += num(obj[k]);
        else out.attrs[key] = num(obj[k]);
      });
    };
    const takeRes = function (obj) {
      Object.keys(obj || {}).forEach(function (k) {
        const key = RES_ALIAS[k] || RES_ALIAS[String(k).replace(/^状态\./, '')] || k;
        out.res[key] = (out.res[key] || 0) + num(obj[k]);
      });
    };
    const takeSpecial = function (obj) {
      Object.keys(obj || {}).forEach(function (k) {
        const key = SPECIAL_ALIAS[k] || k;
        if (key === 'fans') { out.res.fans = (out.res.fans || 0) + num(obj[k]); return; }
        out.special[key] = (out.special[key] || 0) + num(obj[k]);
      });
    };
    /* 中文键 / 内部键 / 前缀键（属性.枪法）都能吃 */
    Object.keys(patch).forEach(function (k) {
      const v = patch[k];
      if (k === 'time' || k === 'date' || k === 'advanceDays' || k === 'days') return;
      if (k === 'attrs' || k === '属性') return takeAttrs(v);
      if (k === 'res' || k === '状态') return takeRes(v);
      if (k === 'special' || k === '特殊') return takeSpecial(v);
      if (k === 'flags') { Object.keys(v || {}).forEach(function (x) { out.flags[x] = v[x]; }); return; }
      if (k === 'metrics') { Object.keys(v || {}).forEach(function (x) { out.metrics[x] = (out.metrics[x] || 0) + num(v[x]); }); return; }
      if (k === 'status' || k === 'statuses') { if (Array.isArray(v)) out.status = out.status.concat(v); return; }
      if (k === 'rel' || k === 'relations' || k === '关系') {
        Object.keys(v || {}).forEach(function (n) { out.relations[n] = (out.relations[n] || 0) + num(v[n]); });
        return;
      }
      if (k === 'money' || k === '金钱') { out.money += num(v); return; }
      if (k === 'fans' || k === '粉丝') { out.res.fans = (out.res.fans || 0) + num(v); return; }
      if (k.indexOf('属性.') === 0) { takeAttrs({ [k.slice(3)]: v }); return; }
      if (k.indexOf('状态.') === 0) { takeRes({ [k.slice(3)]: v }); return; }
      if (k.indexOf('关系.') === 0) { out.relations[k.slice(3)] = (out.relations[k.slice(3)] || 0) + num(v); return; }
      if (k.indexOf('资源.') === 0) { const kk = k.slice(3); if (kk === '金钱') out.money += num(v); else if (kk === '粉丝') out.res.fans = (out.res.fans || 0) + num(v); return; }
      /* 裸属性名 / 裸特殊值名 */
      if (ATTR_ALIAS[k] || (D.ATTRS && D.ATTRS.some(function (a) { return a.k === k; }))) { takeAttrs({ [k]: v }); return; }
      if (SPECIAL_ALIAS[k]) { takeSpecial({ [k]: v }); return; }
      if (RES_ALIAS[k]) { takeRes({ [k]: v }); return; }
    });
    /* 时间：advanceDays / date / set 三种写法 */
    const tt = patch.time && typeof patch.time === 'object' ? patch.time : {};
    const adv = num(tt.advanceDays || tt.days || patch.advanceDays || patch.days);
    const abs = tt.date || patch.date || tt.day === undefined ? (tt.date || patch.date) : null;
    out.time = { advanceDays: adv > 0 ? Math.min(Math.round(adv), 400) : 0, set: null, raw: tt };
    if (tt.set && typeof tt.set === 'object') out.time.set = tt.set;
    if (abs && /^\d{4}-\d{1,2}-\d{1,2}/.test(String(abs))) {
      const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(abs));
      out.time.set = { year: +m[1], month: +m[2], day: +m[3] };
    }
    return out;
  }
  /** 应用剧情变量；返回人类可读的结算条目 */
  function applyStoryVars(s, patch) {
    const v = normalizeStoryVars(patch);
    const notes = [];
    const fromDate = { year: s.time.year, month: s.time.month, day: s.time.day };
    /* 时间 */
    let advanced = 0;
    if (v.time.set) {
      const st = v.time.set;
      if (st.year && st.year >= fromDate.year) {
        const jumped = (st.year - s.time.year) * 12 + ((st.month || s.time.month) - s.time.month);
        if (jumped >= 0 && jumped <= 60) {
          s.time.year = st.year;
          if (st.month) s.time.month = U.clamp(st.month, 1, 12);
          if (st.day) s.time.day = U.clamp(st.day, 1, 28);
          if (st.clock) s.time.clock = String(st.clock);
          advanced = jumped;
        }
      }
    }
    const days = v.time.advanceDays || 0;
    if (days > 0) { advanceTime(s, days); advanced += days; }
    if (advanced > 0) {
      notes.push('时间：' + fromDate.month + '/' + fromDate.day + ' → ' + s.time.month + '/' + s.time.day +
        '（+' + advanced + ' 天 · ' + s.time.phase + '）');
    }
    /* 属性/资源/特殊/金钱 */
    const deltas = apply(s, {
      attrs: v.attrs, res: v.res, special: v.special, money: v.money,
      flags: v.flags, metrics: v.metrics, status: v.status
    }, { silent: true });
    (deltas || []).forEach(function (d) {
      if (!d.delta) return;
      if (d.kind === 'money') notes.push(d.label + ' ' + (d.delta > 0 ? '+' : '') + Math.round(d.delta));
      else {
        const fmt = function (v) { const n = Number(v); return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); };
        notes.push(d.label + ' ' + fmt(d.from) + ' → ' + fmt(d.to));
      }
    });
    /* 关系（按 NPC 姓名） */
    Object.keys(v.relations).forEach(function (nm) {
      const r = s.relations.filter(function (x) { return x.name === nm; })[0];
      if (!r) return;
      const before = Math.round(r.affection);
      r.affection = U.clamp(r.affection + v.relations[nm], 0, 100);
      if (Math.round(r.affection) !== before) notes.push(nm + ' 好感 ' + before + ' → ' + Math.round(r.affection));
    });
    return { notes: notes, applied: v, advanced: advanced, from: fromDate, to: { year: s.time.year, month: s.time.month, day: s.time.day } };
  }
  /* ── 任务 ── */
  function makeQuests(state) {
    const q = [];
    D.QUESTS.main.forEach(function (t, i) {
      q.push({ id: t.id, kind: 'main', name: t.name, desc: t.desc, metric: t.metric, target: t.target, reward: t.reward, deadline: t.deadlineDays, tone: 'gold', order: i });
    });
    D.QUESTS.side.forEach(function (t) {
      q.push({ id: t.id, kind: 'side', name: t.name, desc: t.desc, metric: t.metric, target: t.target, reward: t.reward, deadline: t.deadlineDays, tone: t.tone || 'cyan' });
    });
    D.QUESTS.daily.forEach(function (t) {
      q.push({ id: t.id, kind: 'daily', name: t.name, desc: t.desc, metric: t.metric, target: t.target, reward: t.reward, tone: t.tone || 'violet' });
    });
    return q;
  }

  /* ── 快讯 ── */
  function makeNews(state, count) {
    const used = {}, out = [];
    let guard = 0;
    while (out.length < count && guard++ < 200) {
      const n = U.pick(D.NEWS);
      if (used[n.t]) continue;
      used[n.t] = 1;
      out.push({
        id: U.uid('news'), cat: n.c, title: n.t, body: n.b, source: n.s,
        turn: state ? state.time.turn : 0, time: state ? timeText(state) : '', heat: U.randInt(12, 99)
      });
    }
    return out;
  }

  /* ── 时间 ── */
  function timeText(s) {
    const sea = s.time.seasonLabel || seasonLabel(s.time.season);
    return s.time.year + ' 年 · ' + sea + ' · ' + U.pad2(s.time.month) + '月' + U.pad2(s.time.day) + '日 ' + s.time.clock;
  }
  function statusMod(condition) {
    if (condition >= 90) return 2;
    if (condition >= 80) return 1;
    if (condition >= 40) return 0;
    if (condition >= 20) return -2;
    return -4;
  }
  function advanceTime(s, days) {
    days = days || 1;
    const before = { month: s.time.month, phase: s.time.phaseId };
    for (let i = 0; i < days; i++) {
      s.time.day++; s.time.dayCount++;
      if (s.time.day > 28) { s.time.day = 1; s.time.month++; }
      if (s.time.month > 12) {
        s.time.month = 1; s.time.year++;
        s.time.season = seasonOfYear(s.time.year, 'S' + (s.time.season + 1));
        s.time.seasonLabel = seasonLabel(s.time.season);
      }
      /* 每日自然变化（第5章状态律 / 附录AW.2） */
      s.res.condition = U.clamp(s.res.condition - 0.8 + (s.attrs.stamina > 70 ? 0.3 : 0), 0, 100);
      s.res.hand = U.clamp(s.res.hand + (s.res.condition > 55 ? 0.6 : 0.15), 0, 100);
      s.res.injury = U.clamp(s.res.injury + (s.metrics.trainStreak >= 5 ? 0.8 : -0.2), 0, 100);
      s.special.heat = U.clamp(s.special.heat - 0.9, 0, 100);
      s.statuses.forEach(function (st) { st.turns = Math.max(0, st.turns - 1 / 3); });
    }
    s.statuses = s.statuses.filter(function (st) { return st.turns > 0.05; });
    s.time.week = Math.min(4, Math.floor((s.time.day - 1) / 7) + 1);
    const ph = phaseOf(s.time.month, s.time.year);
    s.time.phase = ph.name; s.time.phaseId = ph.id;
    s.time.turn += 1;
    if (s.time.turn % 2 === 0 && s.club && s.club.signed) {
      const pay = Math.round(s.club.salary / 24);
      s.res.money += pay - s.club.livingCost;
      pushLog(s, 'finance', '薪资入账 ¥' + U.fmtNum(pay) + ' · 生活支出 ¥' + U.fmtNum(s.club.livingCost) + ' · 余额 ¥' + U.fmtNum(s.res.money));
    } else if (s.time.turn % 2 === 0) {
      s.res.money -= (s.club ? s.club.livingCost : 3000);
    }
    if (before.phase !== s.time.phaseId) emit('phase', { from: before.phase, to: s.time.phaseId, name: s.time.phase });
    return { monthChanged: before.month !== s.time.month, phaseChanged: before.phase !== s.time.phaseId, phase: s.time.phase };
  }

  /* ── 效果结算 ── */
  function apply(s, effects, opts) {
    opts = opts || {};
    const deltas = [];
    if (!effects) return deltas;
    const injuryMul = (s.body && s.body.eff && s.body.eff.injuryMul) || 1;

    if (effects.attrs) Object.keys(effects.attrs).forEach(function (k) {
      if (s.attrs[k] === undefined) return;
      const before = s.attrs[k];
      let v = effects.attrs[k];
      if (v < 0 && opts.soften) v = Math.ceil(v / 2);
      const cap = (s.body && k === 'reaction' && s.body.eff && s.body.eff.reactionCap) ? s.body.eff.reactionCap : (s.special.cap || 85);
      s.attrs[k] = U.clamp(Math.round(before + v), 1, cap);
      deltas.push({ kind: 'attr', k: k, label: labelOf(k), from: before, to: s.attrs[k], delta: s.attrs[k] - before });
    });
    if (effects.special) Object.keys(effects.special).forEach(function (k) {
      if (s.attrs[k] !== undefined) {
        const b0 = s.attrs[k];
        s.attrs[k] = U.clamp(b0 + effects.special[k], 1, s.special.cap || 85);
        deltas.push({ kind: 'attr', k: k, label: labelOf(k), from: b0, to: s.attrs[k], delta: s.attrs[k] - b0 });
        return;
      }
      if (s.special[k] === undefined) return;
      const before = s.special[k];
      s.special[k] = U.clamp(Math.round(before + effects.special[k]), 0, 100);
      deltas.push({ kind: 'special', k: k, label: labelOf(k), from: before, to: s.special[k], delta: s.special[k] - before });
    });
    if (effects.money) { const b = s.res.money; s.res.money += effects.money; deltas.push({ kind: 'money', label: '元', from: b, to: s.res.money, delta: effects.money }); }
    if (effects.res) Object.keys(effects.res).forEach(function (k) {
      /* 容错：误写进 res 的属性/特殊值自动归位 */
      if (s.res[k] === undefined) {
        if (s.attrs[k] !== undefined) {
          const b0 = s.attrs[k];
          s.attrs[k] = U.clamp(b0 + effects.res[k], 1, s.special.cap || 85);
          deltas.push({ kind: 'attr', k: k, label: labelOf(k), from: b0, to: s.attrs[k], delta: s.attrs[k] - b0 });
        } else if (s.special[k] !== undefined) {
          const b1 = s.special[k];
          s.special[k] = U.clamp(b1 + effects.res[k], 0, 100);
          deltas.push({ kind: 'special', k: k, label: labelOf(k), from: b1, to: s.special[k], delta: s.special[k] - b1 });
        }
        return;
      }
      const before = s.res[k];
      let v = effects.res[k];
      if (k === 'hand' && v < 0) v = v * injuryMul * ((s.body && s.body.eff && s.body.eff.handLoss) || 1);
      if (k === 'hand' && (s.flags.cheatMode)) v = Math.abs(v);
      if (k === 'money') { s.res.money += v; deltas.push({ kind: 'money', label: '元', from: before, to: s.res.money, delta: v }); return; }
      s.res[k] = U.clamp(Math.round((before + v) * 10) / 10, 0, k === 'injury' ? 100 : 100);
      deltas.push({ kind: 'res', k: k, label: labelOf(k), from: before, to: s.res[k], delta: Math.round((s.res[k] - before) * 10) / 10 });
    });
    if (effects.status) effects.status.forEach(function (st) {
      const exist = s.statuses.filter(function (x) { return x.id === st.id; })[0];
      if (exist) exist.turns = Math.max(exist.turns, st.turns || 4);
      else {
        s.statuses.push({ id: st.id, name: st.name, tone: st.tone || 'warn', desc: st.desc, turns: st.turns || 4, icon: st.icon || 'med' });
        pushLog(s, 'status', '获得状态：' + st.name + '（' + st.desc + '）');
      }
    });
    if (effects.removeStatus) s.statuses = s.statuses.filter(function (st) { return effects.removeStatus.indexOf(st.id) < 0; });
    if (effects.rel) Object.keys(effects.rel).forEach(function (key) {
      const target = findRelation(s, key);
      if (!target) return;
      const before = target.affection;
      target.affection = U.clamp(target.affection + effects.rel[key], 0, 100);
      target.trust = U.clamp(target.trust + Math.round(effects.rel[key] * 0.7), 0, 100);
      deltas.push({ kind: 'rel', k: target.id, label: target.name, from: before, to: target.affection, delta: target.affection - before });
    });
    if (effects.relAll) s.relations.forEach(function (r) {
      if (r.type === 'rival') return;
      r.affection = U.clamp(r.affection + effects.relAll, 0, 100);
    });
    if (effects.trust) Object.keys(effects.trust).forEach(function (type) {
      s.relations.filter(function (r) { return r.type === type; }).forEach(function (r) { r.trust = U.clamp(r.trust + effects.trust[type], 0, 100); });
    });
    if (effects.romance) {
      const ro = effects.romance;
      if (ro.state) s.romance.state = ro.state;
      if (ro.affection) s.romance.affection = U.clamp(s.romance.affection + ro.affection, 0, 100);
      if (ro.affectionAbs !== undefined) s.romance.affection = ro.affectionAbs;
      if (ro.love !== undefined) s.romance.love = U.clamp(ro.love, 0, 100);
      if (ro.family !== undefined) s.romance.family = U.clamp(ro.family, 0, 100);
      if (ro.public !== undefined) s.romance.public = ro.public;
      if (!s.romance.npcId) {
        const cand = s.relations.filter(function (r) { return r.type === 'partner'; })[0];
        if (cand) s.romance.npcId = cand.id;
      }
    }
    if (effects.flags) Object.keys(effects.flags).forEach(function (k) { s.flags[k] = effects.flags[k]; });
    if (effects.metrics) Object.keys(effects.metrics).forEach(function (k) { s.metrics[k] = (s.metrics[k] || 0) + effects.metrics[k]; });
    if (effects.stats) Object.keys(effects.stats).forEach(function (k) { s.stats[k] = (s.stats[k] || 0) + effects.stats[k]; });
    if (effects.club) clubAction(s, effects.club);
    return deltas;
  }

  function labelOf(k) {
    const a = D.ATTRS.filter(function (x) { return x.k === k; })[0];
    if (a) return a.name;
    const SPECIAL_LABEL = {
      coachTrust: '教练信任', teammateTrust: '队友信任', fanLoyalty: '粉丝忠诚', antiThreat: '黑粉威胁',
      fame: '名声', heat: '舆论热度', standing: '队内地位', versionBonus: '版本红利', clutch: '关键局', cap: '属性上限',
      condition: '竞技状态', hand: '手部健康', injury: '伤病风险', fans: '粉丝（万）', money: '元',
      handLoss: '手部损耗', bigMatch: '大场面加成', nightTrain: '夜训收益', pressShield: '抗压护盾',
      reactionCap: '反应上限', injuryMul: '伤病倍率', heroPool: '特工池', potential: '潜力'
    };
    return SPECIAL_LABEL[k] || k;
  }
  function findRelation(s, key) {
    return s.relations.filter(function (r) { return r.id === key || r.type === key || r.role.indexOf(key) >= 0; })[0];
  }

  /* ── 俱乐部动作 ── */
  function clubAction(s, action) {
    if (!action) return;
    if (action.indexOf('bond+') === 0) {
      const add = parseFloat(action.slice(5)) || 0;
      s.club.bond = U.clamp((s.club.bond || 0) + add, 0, 100);
      return;
    }
    if (action === 'sign') {
      s.club.signed = true;
      s.club.signedAt = s.time.turn;
      pushLog(s, 'club', '与 ' + s.club.name + ' 签下 ' + s.club.years + ' 年合同，年薪 ¥' + U.fmtNum(s.club.salary));
    } else if (action === 'stay') {
      s.club.contractNote = '续约留队';
    } else if (action === 'transfer_t0' || action === 'transfer_core') {
      const wantTier = action === 'transfer_t0' ? 'T0' : 'T1';
      const pool = D.CLUBS.filter(function (c) { return c.id !== s.club.id && c.tier === wantTier && (!s.club.region || c.region === s.club.region || wantTier === 'T0'); });
      const def = pool.length ? U.pick(pool) : D.CLUBS[0];
      s.club = Object.assign({}, s.club, {
        id: def.id, name: def.name, short: def.short, region: def.region, city: def.city, tier: def.tier,
        seat: def.seat, style: def.style, roster: rosterAll, rosters: def.rosters || {}, rosterYear: ry, rosterNote: rosterNote,
      lineup: lineup,
      honors: def.honors, line: def.line,
        salary: Math.round(s.club.salary * (action === 'transfer_t0' ? 1.9 : 1.35)),
        buyout: Math.round(s.club.buyout * 1.4), signed: true, bond: 10,
        contractNote: action === 'transfer_t0' ? 'T0 豪门转会' : '重建核心'
      });
      pushLog(s, 'club', '转会至 ' + def.name + '（' + def.short + ' · ' + def.region + '），年薪 ¥' + U.fmtNum(s.club.salary));
    }
  }

  /* ── 派生：生效属性（状态压制） ── */
  function effective(s) {
    const out = {};
    let aimMod = 0, judgeMod = 0, trainMul = 1;
    s.statuses.forEach(function (st) {
      if (st.id === 'wrist') { aimMod -= 8; judgeMod -= 2; }
      if (st.id === 'wrist_bad') { aimMod -= 14; judgeMod -= 3; }
      if (st.id === 'playing_hurt') { aimMod -= 12; }
      if (st.id === 'fatigue') { aimMod -= 6; trainMul *= 0.7; }
      if (st.id === 'rehab') { trainMul *= 0.5; }
      if (st.id === 'therapy') { trainMul *= 1.0; }
    });
    const cond = s.res.condition;
    if (cond < 20) { aimMod -= 8; judgeMod -= 4; }
    else if (cond < 40) { aimMod -= 4; judgeMod -= 2; }
    else if (cond >= 90) { judgeMod += 2; }
    D.ATTRS.forEach(function (a) {
      let v = s.attrs[a.k];
      if (['aim', 'reaction', 'movement'].indexOf(a.k) >= 0) v += aimMod;
      if (a.k === 'aim' && s.res.hand < 40) v -= 5;
      if (a.k === 'reaction' && s.res.hand < 40) v -= 5;
      if (a.k === 'mentality' && cond < 35) v -= 6;
      if (a.k === 'stamina' && cond < 30) v -= 8;
      out[a.k] = U.clamp(Math.round(v), 1, 99);
    });
    if (cond >= 90) out.aim = U.clamp(out.aim + 10, 1, 99); /* 火热手感：枪法判定 +10 */
    return { attrs: out, judgeMod: judgeMod, trainMul: trainMul, statusMod: statusMod(cond) };
  }

  /* ── 总评（第7章 / 附录N） ── */
  function ovrDetail(s) {
    const pos = positionOf(s);
    const eff = effective(s).attrs;
    const parts = Object.keys(pos.weights).map(function (k) {
      return { k: k, name: labelOf(k), w: pos.weights[k], v: eff[k], score: eff[k] * pos.weights[k] };
    });
    const base = parts.reduce(function (a, p) { return a + p.score; }, 0);
    const keyVals = pos.key.map(function (k) { return eff[k]; });
    const minKey = Math.min.apply(null, keyVals);
    const keyAvg = keyVals.reduce(function (a, b) { return a + b; }, 0) / keyVals.length;
    let bonus = 0;
    if (minKey >= 95) bonus = 5; else if (minKey >= 90) bonus = 3; else if (minKey >= 85) bonus = 2;
    let penalty = 0;
    if (minKey < 30) penalty = 3; else if (minKey < 40) penalty = 2; else if (minKey < 50) penalty = 1;
    const raw = base + bonus - penalty;
    const total = U.clamp(Math.round(raw), 0, 99);
    return {
      pos: pos, parts: parts, base: base, bonus: bonus, penalty: penalty, raw: raw, total: total,
      key: pos.key, keyVals: keyVals, keyAvg: keyAvg, minKey: minKey, level: level(total)
    };
  }
  function ovr(s) { return ovrDetail(s).total; }
  function level(v) {
    if (v >= 90) return { id: 'legend', name: '传奇', tone: 'gold', short: 'LEGEND', min: 90, max: 99 };
    if (v >= 80) return { id: 'star', name: '明星', tone: 'purple', short: 'STAR', min: 80, max: 89 };
    if (v >= 70) return { id: 'pro', name: '职业', tone: 'blue', short: 'PRO', min: 70, max: 79 };
    if (v >= 60) return { id: 'semi', name: '半职业', tone: 'green', short: 'SEMI', min: 60, max: 69 };
    return { id: 'amateur', name: '业余', tone: 'white', short: 'AMATEUR', min: 0, max: 59 };
  }
  function nextLevel(v) {
    const l = level(v);
    if (l.id === 'legend') return null;
    const thresholds = { amateur: 60, semi: 70, pro: 80, star: 90 };
    return thresholds[l.id];
  }

  /* ── 突破检定（7.13 / AK.2） ── */
  function breakthroughRate(s) {
    const d = ovrDetail(s);
    const diff = D.DIFFICULTIES.filter(function (x) { return x.id === s.difficulty; })[0] || D.DIFFICULTIES[1];
    const eff = effective(s);
    const cond = s.res.condition;
    const condMod = cond >= 90 ? 10 : cond >= 80 ? 5 : cond >= 40 ? 0 : cond >= 20 ? -5 : -10;
    const vBonus = Math.round((s.special.versionBonus || 0) / 2);
    const rate = 40 + d.keyAvg * 0.3 + eff.attrs.mentality * 0.15 + condMod + vBonus + diff.mods.breakthrough;
    return { rate: U.clamp(Math.round(rate), 5, 95), keyAvg: d.keyAvg, condMod: condMod, vBonus: vBonus, diffMod: diff.mods.breakthrough, from: d.total, to: nextLevel(d.total) };
  }

  /* ── 身价（附录V.1） ── */
  function marketDetail(s) {
    const o = ovr(s);
    const base = o >= 90 ? 2000000 : o >= 80 ? 300000 : o >= 70 ? 50000 : o >= 60 ? 20000 : 5000;
    const f = s.res.fans;
    const fanMul = f >= 1000 ? 8 : f >= 500 ? 6 : f >= 100 ? 4 : f >= 10 ? 2.5 : f >= 1 ? 1.5 : f >= 0.1 ? 1.2 : 1.0;
    const age = s.profile.age;
    const ageMul = age <= 21 ? 1.3 : age <= 24 ? 1.0 : age <= 26 ? 0.8 : 0.5;
    const honor = s.flags.champion ? 3.0 : (s.flags.worlds ? 2.0 : (s.stats.honorList.length ? 1.5 : 1.0));
    const years = (s.club && s.club.years) || 2;
    const contractMul = years <= 1 ? 0.7 : years === 2 ? 0.9 : years === 3 ? 1.1 : 1.3;
    const value = base * fanMul * ageMul * honor * contractMul;
    return { base: base, fanMul: fanMul, ageMul: ageMul, honor: honor, contractMul: contractMul, value: Math.round(value), level: level(o) };
  }
  function marketValue(s) { return marketDetail(s).value; }

  /* ── 潜力 ── */
  function pa(s) {
    const cap = (s.special.cap || 85);
    const ageBonus = s.profile.age <= 19 ? 8 : s.profile.age <= 22 ? 4 : 0;
    return U.clamp(Math.round(cap * 0.85 + ageBonus), 1, 99);
  }
  function paLabel(v) {
    if (v >= 92) return { t: 'S+ · 时代级', tone: 'gold' };
    if (v >= 84) return { t: 'S · 世界级', tone: 'gold' };
    if (v >= 74) return { t: 'A · 联赛顶级', tone: 'purple' };
    if (v >= 62) return { t: 'B · 主力水准', tone: 'blue' };
    if (v >= 50) return { t: 'C · 替补水准', tone: 'green' };
    return { t: 'D · 边缘选手', tone: 'white' };
  }
  function ovrGrade(v) {
    if (v >= 92) return 'S+';
    if (v >= 85) return 'S';
    if (v >= 78) return 'A+';
    if (v >= 70) return 'A';
    if (v >= 62) return 'B+';
    if (v >= 54) return 'B';
    if (v >= 46) return 'C';
    return 'D';
  }

  /* ── 队伍羁绊（9.4） ── */
  function bondOf(s) {
    const b = (s.club && s.club.bond) || 0;
    let cur = D.BONDS[0];
    D.BONDS.forEach(function (x) { if (b >= x.need) cur = x; });
    const next = D.BONDS[D.BONDS.indexOf(cur) + 1] || null;
    return { value: b, level: cur, next: next };
  }

  /* ── 训练结算（附录AW.1 / 30.2） ── */
  function train(s, projectId) {
    const p = D.TRAINING.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return null;
    const diff = D.DIFFICULTIES.filter(function (x) { return x.id === s.difficulty; })[0] || D.DIFFICULTIES[1];
    const envMul = { netcafe: 0.8, rent: 1.0, normal: 1.15, top: 1.25 }[diff.mods.envBase] || 1.0;
    const base = 5;
    const gain = base + s.attrs.insight * 0.3 + s.res.condition * 0.1;
    const raw = gain * envMul * diff.mods.trainMul * (s.body && s.body.eff.nightTrain ? 1.2 : 1) + U.randInt(-3, 3);
    const points = U.clamp(Math.round(raw / 4), 0, 4);
    const deltas = [];
    if (points > 0) {
      const before = s.attrs[p.attr];
      const cap = s.special.cap || 85;
      s.attrs[p.attr] = U.clamp(before + points, 1, cap);
      if (s.attrs[p.attr] !== before) deltas.push({ kind: 'attr', k: p.attr, label: p.name, from: before, to: s.attrs[p.attr], delta: s.attrs[p.attr] - before });
    }
    s.res.condition = U.clamp(s.res.condition - (p.id === 'stamina' ? -3 : 5), 0, 100);
    if (p.id !== 'stamina') s.res.hand = U.clamp(s.res.hand - 1.5, 0, 100);
    s.metrics.trainStreak = (s.metrics.trainStreak || 0) + 1;
    s.metrics.restStreak = 0;
    /* 疲劳与伤病检定（AW.2 / AW.3 / 30.7） */
    if (s.metrics.trainStreak === 5) {
      apply(s, { status: [{ id: 'fatigue', name: '疲劳预警', tone: 'warn', desc: '训练收益 -30%，继续硬练将触发伤病', turns: 4, icon: 'warn' }], res: { condition: -5 } });
      pushLog(s, 'status', '连续高强度训练 5 回合：触发疲劳预警');
    }
    const odds = 70 - (s.attrs.stamina - 60) * 0.2 - (s.metrics.trainStreak >= 8 ? 0 : 0);
    const roll = U.randInt(1, 100);
    if (roll >= odds || (s.metrics.trainStreak >= 8 && roll >= 55)) {
      const inj = U.pick(D.INJURIES);
      const mul = (s.body && s.body.eff.injuryMul) || 1;
      apply(s, {
        res: { injury: 12 * mul, condition: -6 },
        status: [{ id: 'inj_' + inj.part, name: inj.name, tone: inj.tone, desc: inj.desc, turns: Math.round(inj.turns * mul), icon: inj.icon }]
      });
      pushLog(s, 'injury', '伤病检定失败（1d100=' + roll + ' ≥ ' + Math.round(odds) + '）：' + inj.name);
      deltas.push({ kind: 'injury', label: inj.name, roll: roll, odds: Math.round(odds) });
    }
    s.metrics.trainStreak = s.metrics.trainStreak % 8;
    return { project: p, points: points, deltas: deltas, raw: Math.round(raw) };
  }

  /* ── 综合评估 / 结局 ── */
  function evaluation(s) {
    const o = ovr(s);
    const honor = U.clamp(Math.round(o * 0.6 + s.stats.wins * 2 + s.stats.honorList.length * 10 + (s.flags.champion ? 30 : 0) + (s.flags.worlds ? 12 : 0)), 0, 100);
    const money = U.clamp(Math.round(s.res.money / 60000), 0, 100);
    const health = Math.round((s.res.hand * 0.6 + s.res.condition * 0.4 - s.res.injury * 0.3));
    const relAvg = s.relations.length ? s.relations.reduce(function (a, r) { return a + r.affection; }, 0) / s.relations.length : 50;
    const mood = Math.round((s.attrs.mentality * 0.6 + relAvg * 0.4));
    const press = U.clamp(Math.round(100 - s.special.antiThreat + s.special.fanLoyalty * 0.3), 0, 100);
    const total = Math.round(honor * 0.34 + money * 0.12 + health * 0.18 + mood * 0.18 + press * 0.18);
    return { honor: honor, money: money, health: health, mood: mood, press: press, total: total, ovr: o };
  }
  function endingTitle(s) {
    const e = evaluation(s), l = level(e.ovr);
    if (s.flags.champion && e.health >= 50) return { t: '传奇 · 圆满落幕', d: '你赢下了一切，并且完好地走出了这条回廊。', tone: 'gold' };
    if (s.flags.champion) return { t: '传奇 · 代价', d: '冠军戒指在手上，但你的手再也握不紧鼠标了。', tone: 'purple' };
    if (s.flags.worlds) return { t: '无冕 · 世界冠军赛常客', d: '你站上过最高的舞台，只是没能在那里留下名字。', tone: 'purple' };
    if (e.ovr >= 85) return { t: '明星 · 赛区门面', d: '你的 ID 会被写进这个赛区的名单里，哪怕只有一行。', tone: 'purple' };
    if (e.ovr >= 70 && s.club && s.club.signed) return { t: '职业 · 稳健生涯', d: '你不是天才，但你在每个赛季都交出了及格线以上的答案。', tone: 'blue' };
    if (s.club && s.club.signed) return { t: '过客 · 板凳生涯', d: '你进过这个圈子，也被这个圈子慢慢忘掉。', tone: 'white' };
    if (e.money >= 60) return { t: '转型 · 商人之道', d: '你没打出成绩，但你学会了怎么把流量换成钱。', tone: 'green' };
    return { t: '离场 · 无名之辈', d: '封测那年，你在排行榜上留过一个 ID，仅此而已。', tone: 'white' };
  }

  /* ── 日志 ── */
  function pushLog(s, kind, text) {
    s.log.unshift({ turn: s.time.turn, time: timeText(s), kind: kind, text: text });
    if (s.log.length > 260) s.log.length = 260;
  }

  /* ── 成就 ── */
  function checkAchievements(s) {
    const fresh = [];
    D.ACHIEVEMENTS.forEach(function (a) {
      if (s.achievements.indexOf(a.id) >= 0) return;
      let ok = false;
      try { ok = !!a.test(s); } catch (e) { ok = false; }
      if (ok) {
        s.achievements.push(a.id); fresh.push(a);
        if (s.cheat) pushLog(s, 'ach', '解锁成就（作弊获得）：' + a.name);
      }
    });
    return fresh;
  }
  function achievementPoints(s) {
    let p = 0;
    s.achievements.forEach(function (id) {
      const a = D.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0];
      if (a) p += a.pts * (s.difficulty === 'hell' ? 1.5 : s.difficulty === 'hard' ? 1.2 : 1);
    });
    return Math.round(p);
  }

  /* ── 任务进度 ── */
  function questProgress(s, q) {
    const map = {
      signed: s.club && s.club.signed ? 1 : 0,
      matches: s.stats.matches,
      rankTop: U.clamp(13 - (s.club ? s.club.rank : 12), 0, 12),
      worlds: s.flags.worlds ? 1 : 0,
      handGuard: s.res.hand >= 60 ? 1 : 0,
      streams: s.metrics.streams,
      bondedTeammates: s.relations.filter(function (r) { return r.type === 'teammate' && r.affection >= 70; }).length,
      rivalWins: s.flags.beatRival ? 1 : 0,
      breakthrough: s.flags.breakthrough ? 1 : 0,
      rankGames: s.metrics.rankGames,
      vodReviews: s.metrics.vodReviews,
      gymSessions: s.metrics.gymSessions,
      mediaDone: s.metrics.mediaDone
    };
    return U.clamp(map[q.metric] || 0, 0, q.target);
  }

  /* ── 存档 ── */
  function storage() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : { slots: {}, settings: null, meta: { created: Date.now() } };
    } catch (e) { return { slots: {}, settings: null, meta: {} }; }
  }
  function writeStorage(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }
  function saveSlot(slotId, state) {
    const store = storage();
    store.slots[slotId] = { state: state, savedAt: Date.now(), label: summaryLabel(state) };
    store.meta.updated = Date.now();
    writeStorage(store);
    emit('saved', { slot: slotId });
    return store.slots[slotId];
  }
  function loadSlot(slotId) {
    const store = storage();
    return store.slots[slotId] ? store.slots[slotId].state : null;
  }
  function listSlots() {
    const store = storage();
    return { auto: store.slots.auto || null, s1: store.slots.s1 || null, s2: store.slots.s2 || null, s3: store.slots.s3 || null, s4: store.slots.s4 || null, s5: store.slots.s5 || null, s6: store.slots.s6 || null };
  }
  function deleteSlot(slotId) { const store = storage(); delete store.slots[slotId]; writeStorage(store); }
  function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  function summaryLabel(s) {
    const o = ovr(s);
    return s.profile.name + ' · ' + s.profile.tag + ' · ' + (s.club ? s.club.short : '无队') + ' · 总评 ' + o + '（' + level(o).name + '）';
  }
  function storageSize() {
    try { const raw = localStorage.getItem(SAVE_KEY) || ''; return (raw.length / 1024).toFixed(1) + ' KB'; } catch (e) { return '0 KB'; }
  }
  function saveSettings(settings) { const store = storage(); store.settings = settings; writeStorage(store); }
  function loadSettings() { const store = storage(); return store.settings || null; }

  return {
    PHASES: PHASES, phaseOf: phaseOf, create: create, migrate: migrate,
    seasonLabel: seasonLabel, seasonOfYear: seasonOfYear, rosterYearFor: rosterYearFor, buildTalent: buildTalent, positionOf: positionOf,
    apply: apply, effective: effective, train: train, statusMod: statusMod,
    promotePlayer: promotePlayer, lineupText: lineupText,
    applyStoryVars: applyStoryVars, normalizeStoryVars: normalizeStoryVars, attrKeyOf: attrKeyOf,
    monthSchedule: monthSchedule, nextMatch: nextMatch, SEASON_MONTHS: SEASON_MONTHS, hostOf: hostOf,
    ovr: ovr, ovrDetail: ovrDetail, level: level, nextLevel: nextLevel, breakthroughRate: breakthroughRate,
    marketValue: marketValue, marketDetail: marketDetail, bondOf: bondOf, labelOf: labelOf,
    pa: pa, paLabel: paLabel, ovrGrade: ovrGrade, evaluation: evaluation, endingTitle: endingTitle,
    advanceTime: advanceTime, timeText: timeText, pushLog: pushLog,
    checkAchievements: checkAchievements, achievementPoints: achievementPoints, questProgress: questProgress,
    makeNews: makeNews, makeQuests: makeQuests, makeClub: makeClub, makeRelations: makeRelations,
    saveSlot: saveSlot, loadSlot: loadSlot, listSlots: listSlots, deleteSlot: deleteSlot, wipe: wipe,
    storageSize: storageSize, summaryLabel: summaryLabel, saveSettings: saveSettings, loadSettings: loadSettings,
    on: on, emit: emit
  };
})();
