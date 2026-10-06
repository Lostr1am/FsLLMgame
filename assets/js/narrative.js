window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   叙事引擎：场景推演 / 骰子判定 / 自由行动 / 事件生成 / 结算
   （纯前端推演，模拟 LLM 叙事管线的输出节奏与结构）
   ═══════════════════════════════════════════════════════════════ */
ES.narrative = (function () {
  'use strict';
  const U = ES.util, D = ES.data;

  let S = null;
  let current = null;          // 当前节点
  let busy = false;            // 推演中，禁止重复提交
  let pendingReveal = null;    // 正在打字的控制器
  let consecutiveFail = 0;
  let actionCount = 0;

  /* ══════════ 打字机 ══════════ */
  function revealHtml(container, html, opts) {
    opts = opts || {};
    const speed = opts.instant ? 0 : (S.settings.textSpeed === 0 ? 0 : 12 + S.settings.textSpeed * 1.35);
    container.innerHTML = html;
    if (!speed) { container.classList.remove('typing'); return { skip: function () {}, done: Promise.resolve() }; }
    const nodes = [];
    (function walk(node) {
      if (node.nodeType === 3) { nodes.push({ node: node, text: node.nodeValue }); node.nodeValue = ''; return; }
      Array.prototype.slice.call(node.childNodes).forEach(walk);
    })(container);
    let total = nodes.reduce(function (a, n) { return a + n.text.length; }, 0);
    if (!total) return { skip: function () {}, done: Promise.resolve() };
    let revealed = 0, idx = 0, pos = 0, raf = 0, lastTime = 0, acc = 0, skipped = false;
    let resolveDone;
    const done = new Promise(function (res) { resolveDone = res; });
    function step(now) {
      if (skipped) return;
      if (!lastTime) lastTime = now;
      const dt = Math.min(80, now - lastTime);
      lastTime = now;
      acc += (dt / 1000) * speed;
      let budget = Math.floor(acc);
      acc -= budget;
      while (budget-- > 0) {
        if (idx >= nodes.length) { finish(); return; }
        const n = nodes[idx];
        n.node.nodeValue = n.text.slice(0, ++pos);
        if (pos >= n.text.length) { idx++; pos = 0; }
        revealed++;
      }
      raf = requestAnimationFrame(step);
    }
    function finish() {
      cancelAnimationFrame(raf);
      nodes.forEach(function (n) { n.node.nodeValue = n.text; });
      container.classList.remove('typing');
      pendingReveal = null;
      resolveDone();
    }
    container.classList.add('typing');
    pendingReveal = {
      skip: function () { skipped = true; finish(); },
      done: done
    };
    if (S.settings.textSpeed > 0) ES.audio.play('type');
    raf = requestAnimationFrame(step);
    return pendingReveal;
  }

  /* ══════════ 生成指示器 ══════════ */
  function setGen(text, active) {
    const t = U.$('#gen-text'), ind = U.$('#gen-indicator');
    if (t) t.textContent = text;
    if (ind) ind.style.opacity = active ? '1' : '.55';
  }

  /* ══════════ 剧情输出 ══════════ */
  function scrollBottom(smooth) {
    const sc = U.$('#story-scroll');
    if (!sc) return;
    sc.scrollTo({ top: sc.scrollHeight, behavior: smooth === false ? 'auto' : 'smooth' });
  }

  function blockHtml(b) {
    switch (b.t) {
      case 'speak':
        return '<div class="story-speak" data-role="' + (b.role || 'self') + '"><div class="story-who">' + U.icon('message', 'icon-xs') + U.esc(b.who) + '</div><div class="story-say">' + b.text + '</div></div>';
      case 'sys':
        return '<div class="story-sys">' + U.icon('terminal', 'icon-xs') + '<div>' + b.text + '</div></div>';
      case 'chapter':
        return '<div class="story-sys" style="border-style:solid;border-left:3px solid var(--gold);background:linear-gradient(90deg,rgba(255,212,121,.1),transparent)">' + U.icon('scroll', 'icon-xs') + '<div><b>' + U.esc(b.text) + '</b></div></div>';
      case 'sum':
        return '<div class="story-sum"><div class="story-sum-h">' + U.icon('list', 'icon-xs') + '事件结算</div><div class="story-sum-b">' + b.text + '</div></div>';
      case 'panel':
        return '<div class="story-panel"><div class="story-panel-h">' + U.icon('grid', 'icon-xs') + U.esc(b.title || '职业面板') + '</div><div class="story-panel-b">' + b.text + '</div></div>';
      case 'think':
        return '<details class="story-think"><summary>' + U.icon('mind', 'icon-xs') + '模型推演（点击展开）</summary><div>' + b.text + '</div></details>';
      case 'ai':
        return '<div class="story-ai">' + b.text + '</div>';
      case 'broadcast':
        return '<div class="story-sys" style="border-left:3px solid var(--red)">' + U.icon('video', 'icon-xs') + '<div>' + b.text + '</div></div>';
      default:
        return '<p class="story-p">' + b.text + '</p>';
    }
  }

  function appendBlocks(blocks, opts) {
    opts = opts || {};
    /* 酒馆层捕获：把叙事块同步给楼层流（tavern.js） */
    if (ES.tavern && ES.tavern.captureBlocks) { try { ES.tavern.captureBlocks(blocks); } catch (e) {} }
    const host = U.$('#story-scroll');
    if (!host) return Promise.resolve();
    const items = blocks.map(function (b) {
      const holder = document.createElement('div');
      holder.style.display = 'contents';
      host.appendChild(holder);
      return { node: holder, block: b };
    });
    let chain = Promise.resolve();
    items.forEach(function (item) {
      chain = chain.then(function () {
        return new Promise(function (resolve) {
          const isLast = item === items[items.length - 1];
          if (item.block.t === 'speak') {
            item.node.innerHTML = blockHtml(item.block);
            ES.audio.play('click');
            const say = item.node.querySelector('.story-say');
            const ctl = revealHtml(say, item.block.text, {});
            ctl.done.then(resolve);
          } else {
            const ctl = revealHtml(item.node, blockHtml(item.block), {});
            ctl.done.then(resolve);
          }
          scrollBottom();
          if (isLast) scrollBottom();
        });
      });
    });
    return chain.then(function () {
      if (opts.then) opts.then();
    });
  }

  /* ══════════ 章节与场景 ══════════ */
  function setChapter(chapter) {
    if (!chapter) return;
    U.$('#chapter-name').textContent = chapter.name;
    U.$('#chapter-index').textContent = chapter.index;
    S.scene.chapterId = chapter.id;
  }
  function setSceneTag(txt) { U.$('#scene-tag').textContent = '场景 · ' + txt; }

  /* ══════════ 开局导语生成 ══════════ */
  function composeOpening(setup) {
    const origin = D.ORIGINS.filter(function (o) { return o.id === setup.origin; })[0];
    const city = setup.city;
    const tl = setup.timeline;
    const mode = setup.mode;
    const diff = D.DIFFICULTIES.filter(function (d) { return d.id === setup.difficulty; })[0];
    const name = setup.name || '你';
    const tag = setup.tag || '无名';
    const lead = '2026 年 ' + tl.month + ' 月 ' + tl.day + ' 日，' + (city ? city.name : '某座城市') + '。' +
      '你叫' + name + '，ID 是 ' + tag + '。' + tl.quote;
    const lines = [];
    lines.push({ t: 'narr', text: '这是<b>' + U.esc(tl.name) + '</b>。' + U.esc(tl.tagline) + '。' + U.esc(city ? city.perk : '') + '，而你要面对的是：' + U.esc(city ? city.cons : '未知的对手') + '。' });
    if (mode === 'legend') {
      lines.push({ t: 'narr', text: '你的 ID 早就被写进过历史。' + U.esc((D.LEGENDS.filter(function (l) { return l.id === setup.legendId; })[0] || {}).desc || '') });
      lines.push({ t: 'speak', role: 'media', who: '电竞周刊 · 记者', text: '「' + tag + '，所有人都在等你再赢一次。你自己怎么看？」' });
      lines.push({ t: 'speak', role: 'self', who: name, text: '「……先打完这个赛季再说。」' });
    } else {
      lines.push({ t: 'narr', text: U.esc(origin.desc) });
      lines.push({ t: 'speak', role: 'self', who: name, text: '「' + (setup.catchphrase || '先让我打一局。') + '」' });
    }
    lines.push({ t: 'narr', text: '难度：<span class="hl-gold">' + U.esc(diff.name) + '</span>。' + U.esc(diff.tagline) + '。' + U.esc(diff.id === 'hell' ? '你连一台像样的外设都没有，护腕是从网吧老板那里借来的。' : '你的设备已经就位，剩下的只能靠自己。') });
    lines.push({ t: 'sys', text: '<b>叙事引擎已就绪</b> · 已载入 ' + (S ? '' : '') + '选手档案、赛季时间线与 12 名关系人物。你的每一次抉择都会被记录进履历。' });
    return { lead: lead, lines: lines };
  }

  /* ══════════ 事件横幅 ══════════ */
  function banner(opts) {
    const host = U.$('#banner-host');
    if (!host) return;
    const node = document.createElement('div');
    node.className = 'banner corner-marks';
    if (opts.tone) node.setAttribute('data-tone', opts.tone);
    node.innerHTML = '<span class="banner-ico">' + U.icon(opts.icon || 'info', 'icon') + '</span>' +
      '<div class="grow"><div class="banner-title">' + U.esc(opts.title) + '</div>' +
      (opts.text ? '<div class="banner-text">' + opts.text + '</div>' : '') + '</div>' +
      '<button type="button" class="btn btn-icon btn-sm btn-ghost" aria-label="关闭横幅">' + U.icon('x', 'icon-xs') + '</button>';
    node.querySelector('button').addEventListener('click', function () { removeBanner(node); });
    host.appendChild(node);
    setTimeout(function () { removeBanner(node); }, opts.duration || 9000);
  }
  function removeBanner(node) {
    if (!node || !node.parentNode) return;
    node.style.transition = 'opacity .3s, transform .3s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(-8px)';
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 320);
  }

  /* ══════════ 选项渲染 ══════════ */
  function renderChoices(choices) {
    const host = U.$('#choice-list');
    const quick = U.$('#quick-choices');
    if (!host) return;
    host.innerHTML = choices.map(function (c, i) {
      return '<button type="button" class="choice" data-choice="' + i + '" data-risk="' + (c.risk || 'normal') + '" id="choice-' + i + '">' +
        '<span class="choice-key">' + (i + 1) + '</span>' +
        '<span class="choice-main">' +
          '<span class="choice-label">' + U.esc(c.label) + '</span>' +
          (c.desc ? '<span class="choice-desc">' + U.esc(c.desc) + '</span>' : '') +
          '<span class="choice-meta">' +
            (c.check ? '<span class="tag" data-tone="cyan">' + U.icon('dice', 'icon-xs') + U.esc(c.check.tag) + (c.check.kind === 'breakthrough' ? ' 1d100' : ' 成功线 ' + c.check.dc) + '</span>' : '<span class="tag" data-tone="green">' + U.icon('check', 'icon-xs') + '无判定</span>') +
            (c.risk === 'high' ? '<span class="tag" data-tone="red">高风险</span>' : c.risk === 'safe' ? '<span class="tag" data-tone="green">稳健</span>' : '') +
            (c.tag ? '<span class="tag" data-tone="violet">' + U.esc(c.tag) + '</span>' : '') +
          '</span>' +
        '</span>' +
        '<span class="choice-arrow">' + U.icon('chev-r') + '</span>' +
      '</button>';
    }).join('');
    U.$$('#choice-list .choice').forEach(function (btn) {
      btn.addEventListener('click', function () { choose(parseInt(btn.getAttribute('data-choice'), 10)); });
    });
    if (quick) {
      quick.innerHTML = choices.map(function (c, i) {
        return '<button type="button" class="quick-choice" data-choice="' + i + '" data-tip="' + U.esc(c.desc || c.label) + '">' +
          '<span class="qc-key">' + (i + 1) + '</span><span class="qc-txt">' + U.esc(c.label) + '</span></button>';
      }).join('');
      U.$$('#quick-choices .quick-choice').forEach(function (btn) {
        btn.addEventListener('click', function () { choose(parseInt(btn.getAttribute('data-choice'), 10)); });
      });
    }
    U.$('#choice-hint').textContent = '按数字键 1-' + Math.min(9, choices.length) + ' 快速选择';
  }

  /* AI 模式下的选择：先做规则判定，再把结果交给模型叙事 */
  function aiChoose(c) {
    if (busy) return;
    disableChoices(true);
    if (!c.check) return aiTurn(c.label);
    busy = true;
    setGen('判定中 · ' + (c.check.tag || '判定'), true);
    return rollCheck(c.check).then(function (res) {
      aiPendingFact = c.label + ' —— ' + res.label + '（' + res.attrName + ' ' + res.attrValue + ' vs 成功线 ' + res.dc + '，掷出 ' + res.roll + '）；剧情必须按这个结果写。';
      return showDiceDialog(res).then(function () {
        busy = false;
        return aiTurn(c.label + '（判定结果：' + res.verdict + '）');
      });
    });
  }

  /* ══════════ 自由行动提示词 ══════════ */
  function renderFreeHints() {
    const host = U.$('#fa-hints');
    if (!host) return;
    const picks = U.pickMany(D.FREE_ACTIONS, 5);
    host.innerHTML = '<span class="tiny dim">快速行动</span>' + picks.map(function (f) {
      return '<button type="button" class="fa-hint" data-hint="' + U.esc(f.name) + '">' + U.esc(f.name) + '</button>';
    }).join('');
    U.$$('#fa-hints .fa-hint').forEach(function (b) {
      b.addEventListener('click', function () { U.$('#input-free-action').value = b.getAttribute('data-hint'); U.$('#input-free-action').focus(); });
    });
  }

  /* ══════════ 骰子判定 ══════════ */
  function rollCheck(spec) {
    return new Promise(function (resolve) {
      const eff = ES.state.effective(S);
      const diff = D.DIFFICULTIES.filter(function (d) { return d.id === S.difficulty; })[0] || D.DIFFICULTIES[1];
      const pityMod = (S.settings.pity && consecutiveFail >= 3) ? 3 : 0;

      /* ① 突破检定（7.13）：1d100 ≤ 成功率 */
      if (spec.kind === 'breakthrough') {
        const br = ES.state.breakthroughRate(S);
        const rate = U.clamp(br.rate + (spec.dc || 0), 5, 95);
        const roll = U.randInt(1, 100);
        const ok = roll <= rate;
        resolve({
          kind: 'breakthrough', dice: 100, roll: roll, attrKey: 'mentality', attrName: '突破检定', attrVal: Math.round(br.keyAvg),
          terms: [
            { k: 'base', label: '基础', v: 40 },
            { k: 'key', label: '关键属性均值×0.3', v: Math.round(br.keyAvg * 0.3 * 10) / 10 },
            { k: 'mind', label: '心态×0.15', v: Math.round(eff.attrs.mentality * 0.15 * 10) / 10 },
            { k: 'cond', label: '状态修正', v: br.condMod },
            { k: 'ver', label: '版本红利', v: br.vBonus },
            { k: 'diff', label: '难度修正', v: br.diffMod + (spec.dc || 0) }
          ],
          attrMod: 0, statusMod: 0, envMod: 0, pityMod: 0, dc: rate, total: roll,
          verdict: ok ? (roll <= rate / 2 ? 'crit' : 'success') : (roll >= 90 ? 'critfail' : 'fail'),
          label: ok ? (roll <= rate / 2 ? '突破成功 · 一飞冲天' : '突破成功') : (roll >= 90 ? '突破失败 · 心魔发作' : '突破失败 · 撞墙期'),
          tone: ok ? 'crit' : 'fail', sound: ok ? 'levelup' : 'fail', tag: spec.tag || '突破检定'
        });
        return;
      }

      /* ② 对枪判定（15.3 / 30.4）：1d20 ＋ 枪法/10 ＋ 反应/10 ＋ 身法/10 ＋ 状态 ＋ 装备 ＋ 先手 − 对手防御 */
      const isGun = spec.kind === 'gun' || ['aim', 'reaction', 'movement'].indexOf(spec.attr) >= 0;
      const attrKey = spec.attr || 'aim';
      const attrVal = eff.attrs[attrKey] !== undefined ? eff.attrs[attrKey] : 50;
      const terms = [];
      let mod = 0;
      function add(k, label, v) { if (v) { terms.push({ k: k, label: label, v: Math.round(v * 10) / 10 }); mod += v; } }

      if (isGun) {
        add('aim', '枪法÷10', Math.floor(eff.attrs.aim / 10));
        add('reaction', '反应÷10', Math.floor(eff.attrs.reaction / 10));
        add('movement', '身法÷10', Math.floor(eff.attrs.movement / 10));
      } else {
        add(attrKey, ES.panels.attrName(attrKey) + '÷10', Math.floor(attrVal / 10));
      }
      /* 状态修正（X.1：≥90 +2 / 80—89 +1 / 40—79 0 / 20—39 -2 / <20 -4） */
      add('cond', '竞技状态', ES.state.statusMod(S.res.condition));
      /* 装备修正：经济局 -2 / 半起 -1 / 满配 0 / 高级外设 +1—3 */
      const equip = S.flags.equipTier >= 3 ? 3 : S.flags.equipTier === 2 ? 1 : 0;
      add('equip', '外设与装备', equip);
      /* 先手修正 */
      const first = spec.firstMove === true ? 5 : spec.firstMove === false ? -5 : 0;
      add('first', '先手权', first);
      /* 体质 / 天赋：大场面加成 */
      if (S.body && S.body.eff && S.body.eff.bigMatch && /季后赛|世界|决赛|关键/.test(spec.tag || '')) add('body', '比赛型选手', S.body.eff.bigMatch);
      if (S.body && S.body.eff && S.body.eff.clutch && /残局|关键/.test(spec.tag || '')) add('body2', '大心脏', Math.round(S.body.eff.clutch / 2));
      add('pity', '连续失败保底', pityMod);
      const judgeMod = eff.judgeMod || 0;
      add('status', '伤病与状态效果', judgeMod);

      /* 对手防御（对冲）：仅对枪判定生效 */
      const opp = spec.oppDefense !== undefined ? spec.oppDefense : (isGun ? 12 + U.randInt(-2, 4) : 0);
      if (isGun) terms.push({ k: 'opp', label: '对手防御', v: -opp });

      const roll = U.randInt(1, 20);
      const total = roll + mod - opp;
      const line = spec.dc;
      let verdict;
      if (roll === 1) verdict = 'critfail';
      else if (roll === 20) verdict = 'crit';
      else if (line >= 16) { /* 高难：命中头部/完美 */
        verdict = total >= line ? 'crit' : total >= line - 3 ? 'success' : total >= line - 6 ? 'narrow' : 'fail';
      } else {
        verdict = total >= line + 4 ? 'crit' : total >= line ? 'success' : total >= line - 2 ? 'narrow' : 'fail';
      }
      const map = {
        crit: { t: '大成功', tone: 'crit', sound: 'success' },
        success: { t: '成功', tone: 'success', sound: 'success' },
        narrow: { t: '勉强成功', tone: 'narrow', sound: 'notify' },
        fail: { t: '失败', tone: 'fail', sound: 'fail' },
        critfail: { t: '大失败', tone: 'critfail', sound: 'fail' }
      }[verdict];
      resolve({
        kind: isGun ? 'gun' : 'check', dice: 20, roll: roll, attrKey: attrKey,
        attrName: isGun ? '对枪判定' : ES.panels.attrName(attrKey), attrVal: attrVal,
        terms: terms, attrMod: mod, statusMod: judgeMod, envMod: 0, pityMod: pityMod, opp: opp,
        dc: line, total: total, verdict: verdict, label: map.t, tone: map.tone, sound: map.sound, tag: spec.tag
      });
    });
  }

  function showDiceDialog(res) {
    return new Promise(function (resolve) {
      if (!S.settings.showRoll || document.documentElement.getAttribute('data-motion') === 'reduced') {
        /* 仍给一次极短的展示，保持节奏感 */
        U.openModal('modal-dice');
        renderDiceResult(res, true);
        ES.audio.play(res.sound);
        setTimeout(function () {
          U.closeModal('modal-dice');
          resolve();
        }, 1200);
        return;
      }
      U.openModal('modal-dice');
      U.$('#dice-sub').textContent = (res.dice === 100 ? '突破检定 · 成功率 ' + res.dc + '%' : res.attrName + '（' + ES.panels.attrName(res.attrKey) + ' ' + res.attrVal + '）· 成功线 ' + res.dc);
      U.$('#dice-verdict-host').innerHTML = '';
      U.$('#dice-breakdown').innerHTML = '';
      U.$('#dice-effect-host').innerHTML = '<div class="gen-indicator"><span class="gen-dots"><i></i><i></i><i></i></span>叙事引擎正在计算判定结果…</div>';
      const core = U.$('#dice-core'), num = U.$('#dice-num'), cap = U.$('#dice-cap');
      core.classList.add('is-rolling');
      cap.textContent = res.dice === 100 ? 'D100' : 'D20';
      let ticks = 0;
      ES.audio.play('roll');
      const iv = setInterval(function () {
        num.textContent = U.randInt(1, res.dice);
        ticks++;
        if (ticks > 14) { clearInterval(iv); core.classList.remove('is-rolling'); num.textContent = res.roll; renderDiceResult(res); }
      }, 68);
      const btn = U.$('#btn-dice-continue');
      btn.disabled = true;
      btn.onclick = function () { U.closeModal('modal-dice'); resolve(); };
      setTimeout(function () { btn.disabled = false; }, 1400);
      const onKey = function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!U.$('#modal-dice').classList.contains('is-open')) return;
          if (btn.disabled) return;
          document.removeEventListener('keydown', onKey);
          btn.click();
        }
      };
      document.addEventListener('keydown', onKey);
    });
  }

  function renderDiceResult(res, quiet) {
    if (ES.tavern && ES.tavern.captureDice) { try { ES.tavern.captureDice(res); } catch (e) {} }
    const rows = (res.terms || []).map(function (t2) {
      return '<span class="dice-term" data-k="' + t2.k + '">' + U.esc(t2.label) + ' ' + (t2.v > 0 ? '+' : '') + t2.v + '</span>';
    }).join('');
    U.$("#dice-cap").textContent = res.dice === 100 ? '突破检定' : res.attrName;
    U.$("#dice-verdict-host").innerHTML = '<div class="row-tight" style="gap:14px"><span class="dice-verdict" data-v="' + res.tone + '">' + res.label + '</span>' +
      '<span class="mono" style="font-size:var(--fs-lg);color:var(--txt-2)">' +
      (res.dice === 100 ? '1d100 = <b style="color:var(--accent)">' + res.roll + '</b> / 成功率 ' + res.dc + '%'
        : '1d20 ' + (res.roll >= 16 ? '（高成功线）' : '') + res.roll + ' + ' + Math.round(res.attrMod) + ' − ' + (res.opp || 0) + ' = <b style="color:var(--accent)">' + Math.round(res.total) + '</b> / 成功线 ' + res.dc) +
      '</span></div>';
    U.$("#dice-breakdown").innerHTML = rows || '<span class="dice-term">无修正项</span>';
    U.$("#dice-effect-host").innerHTML = '<div class="row-tight small"><span class="dim">判定类型</span><span class="mono acc">' + U.esc(res.tag || res.attrName) + '</span>' +
      '<span class="dim" style="margin-left:auto">属性值</span><span class="mono">' + res.attrVal + '</span></div>' +
      '<div class="row-tight small" style="margin-top:6px"><span class="dim">结果等级</span><span class="mono">' + res.label + '</span>' +
      '<span class="dim" style="margin-left:auto">结算方式</span><span class="mono">' + (res.verdict === 'crit' ? '收益翻倍' : res.verdict === 'success' ? '按成功结算' : res.verdict === 'narrow' ? '收益减半' : '按失败结算') + '</span></div>' +
      '<div class="tiny dim" style="margin-top:8px">判定公式与修正来源可查（X.8）：所有修正均来自属性、状态、装备、先手与天赋，不随手给值。</div>';
    if (!quiet) ES.audio.play(res.sound);
    if (res.verdict === 'crit') U.burst(U.$("#modal-dice .modal-body"), 20, res.dice === 100 ? 'var(--gold)' : 'var(--accent)', 150);
  }

  /* ══════════ 效果应用与反馈 ══════════ */
  function applyEffects(effects, opts) {
    opts = opts || {};
    const deltas = ES.state.apply(S, effects, opts);
    if (ES.tavern && ES.tavern.captureDeltas) { try { ES.tavern.captureDeltas(deltas); } catch (e) {} }
    if (!opts.silent) reportDeltas(deltas);
    return deltas;
  }

  function reportDeltas(deltas) {
    const interesting = deltas.filter(function (d) { return d.delta !== 0; });
    if (!interesting.length) return;
    const groups = { attr: [], special: [], res: [], money: [], rel: [] };
    interesting.forEach(function (d) { (groups[d.kind] = groups[d.kind] || []).push(d); });
    const parts = [];
    function fmt(d) {
      const v = d.kind === 'money' ? '¥' + U.fmtNum(d.delta) : (d.delta > 0 ? '+' : '') + U.round(d.delta, 1);
      return '<span class="' + (d.delta > 0 ? 'up' : 'down') + '">' + U.esc(d.label) + ' ' + v + '</span>';
    }
    if (groups.res.length) parts.push(groups.res.map(fmt).join(' · '));
    if (groups.attr.length) parts.push(groups.attr.map(fmt).join(' · '));
    if (groups.special.length) parts.push(groups.special.map(fmt).join(' · '));
    if (groups.money.length) parts.push(groups.money.map(fmt).join(' · '));
    if (groups.rel.length) parts.push(groups.rel.map(fmt).join(' · '));
    U.toast({ tone: 'info', icon: 'pulse', title: '状态结算', msg: parts.join('<br>'), duration: 5200 });
    /* 面板数值微动画 */
    groups.attr.forEach(function (d) {
      const node = U.$('[data-attr-val="' + d.k + '"]');
      if (node) { U.animateNumber(node, d.from, d.to, { duration: 500 }); node.classList.add(d.delta > 0 ? 'flash-pos' : 'flash-neg'); setTimeout(function () { node.classList.remove('flash-pos', 'flash-neg'); }, 1200); }
    });
    if (groups.money.length) {
      const node = U.$('[data-money-val]');
      if (node) {
        node.textContent = '¥' + U.money(S.res.money);
        node.classList.add(groups.money[0].delta > 0 ? 'flash-pos' : 'flash-neg');
        setTimeout(function () { node.classList.remove('flash-pos', 'flash-neg'); }, 1200);
      }
      ES.audio.play('cash');
    }
  }

  /* ══════════ 回合收尾 ══════════ */
  function endTurn(days, opts) {
    opts = opts || {};
    S.stats.choices++;
    S.metrics.choices = S.stats.choices;
    const info = ES.state.advanceTime(S, days || 1);
    /* 赛季阶段横幅 */
    if (info.phaseChanged) {
      banner({ title: '进入 ' + info.phase, text: '赛季推进至新阶段，赛程与舆论环境发生变化。', tone: 'gold', icon: 'calendar', duration: 11000 });
      S.news = ES.state.makeNews(S, 8);
      ES.panels.renderTicker();
      ES.state.pushLog(S, 'phase', '赛季阶段推进：' + info.phase);
      U.toast({ tone: 'gold', title: '新阶段 · ' + info.phase, msg: '快讯与赛程已刷新。' });
    }
    /* 舆论自然衰减 */
    if (S.special.antiThreat > 0) S.special.antiThreat = U.clamp(S.special.antiThreat - 1.2, 0, 100);
    S.special.heat = U.clamp(S.special.heat - 1.4, 0, 100);
    S.special.fame = U.clamp(S.special.fame + (S.stats.wins > S.stats.losses ? 0.3 : -0.2), 0, 100);
    /* 天赋共鸣随使用缓慢增长 */
    /* 天赋与行动方向一致时，额外获得该方向属性成长（8.1） */
    if ((S.talents || []).length && S.stats.choices % 4 === 0) {
      const tl = U.pick(S.talents);
      const dir = tl.direction;
      if (S.attrs[dir] !== undefined) {
        S.attrs[dir] = U.clamp(S.attrs[dir] + 1, 1, S.special.cap || 85);
        U.floatDelta(U.$('#story-scroll'), 1);
      }
    }
    /* 任务与成就 */
    checkQuestCompletion();
    const fresh = ES.state.checkAchievements(S);
    fresh.forEach(function (a, i) {
      setTimeout(function () {
        U.toast({
          tone: a.rar === 'gold' ? 'gold' : 'success', icon: 'medal',
          title: '成就解锁 · ' + a.name, msg: U.esc(a.desc) + ' <span class="gold mono">+' + a.pts + ' 成就点</span>', duration: 7000
        });
        ES.audio.play('achieve');
        banner({ title: '成就解锁 · ' + a.name, text: a.desc, tone: a.rar === 'gold' ? 'gold' : 'good', icon: 'medal', duration: 8000 });
      }, i * 700);
    });
    /* 伤病与危机检查 */
    checkHealth();
    /* 存档 */
    if (S.settings.autosave) ES.state.saveSlot('auto', S);
    /* 面板刷新 */
    ES.app.refreshUI();
  }

  function checkQuestCompletion() {
    S.quests.forEach(function (q) {
      const p = ES.state.questProgress(S, q);
      if (p >= q.target && !q.done) {
        q.done = true;
        applyEffects(q.reward, { silent: true });
        ES.state.pushLog(S, 'quest', '完成任务：' + q.name);
        U.toast({ tone: 'gold', icon: 'check', title: '任务完成 · ' + q.name, msg: '奖励已发放。' });
        ES.audio.play('levelup');
      }
    });
  }

  function checkHealth() {
    if (S.res.hand < 35 && !S.flags.handWarned) {
      S.flags.handWarned = true;
      banner({ title: '队医警告', text: '手部健康已跌破 35：枪法与反应各 -5，继续高强度训练可能造成不可逆损伤。', tone: 'danger', icon: 'med', duration: 12000 });
      U.toast({ tone: 'error', title: '严重警告 · 手部健康', msg: '建议立即安排康复日程，或考虑就医。', duration: 8000 });
      ES.state.pushLog(S, 'status', '手部健康危险：' + Math.round(S.res.hand));
    }
    if (S.res.condition < 25 && !S.flags.condWarned) {
      S.flags.condWarned = true;
      U.toast({ tone: 'warn', title: '竞技状态崩盘边缘', msg: '状态低于 25：全项判定减益，随时可能被按在替补席。' });
    }
    if (S.res.hand < 22 && !S.statuses.filter(function (s) { return s.id === 'chronic'; }).length) {
      S.statuses.push({ id: 'chronic', name: '慢性腕伤', tone: 'bad', desc: '枪法类属性永久 -8，高强度训练后加剧', turns: 99, icon: 'med' });
      banner({ title: '慢性损伤确诊', text: '队医阿坤建议你减少训练量，否则可能提前结束职业生涯。', tone: 'danger', icon: 'warn', duration: 12000 });
    }
    /* 心理危机检定（X.6：1d100 ≥ 心态值时触发） */
    if ((S.special.heat > 60 || S.stats.losses - S.stats.wins > 6) && !S.flags.mentalChecked) {
      S.flags.mentalChecked = true;
      const roll = U.randInt(1, 100);
      if (roll >= S.attrs.mentality) {
        applyEffects({ res: { condition: -8 }, attrs: { mentality: -1 }, status: [{ id: 'mental_crisis', name: '心理危机', tone: 'bad', desc: '关键局判定 -4，需要心理疏导（心理师苏锦）', turns: 6, icon: 'mind' }] });
        banner({ title: '心理危机', text: '舆论与连败的压力叠在一起。心理师苏锦建议你做一次完整疏导。', tone: 'danger', icon: 'mind', duration: 12000 });
      }
    }
  }

  /* ══════════ AI 剧情引擎（主叙事线 · 真实 API） ══════════ */
  const AI_HISTORY_MAX = 16;
  let aiHistory = [];
  let aiBusy = false;
  let aiPendingFact = null;

  function aiOn() { return !!(ES.api && ES.api.isEnabled && ES.api.isEnabled()); }
  function engineName() {
    if (!aiOn()) return '叙事引擎 · 本地推演';
    const c = ES.api.config();
    return '叙事引擎 · ' + (ES.api.mode && ES.api.mode() === 'dual' ? '双 API' : 'AI') + ' · ' + (c.primary.model || '未命名模型');
  }
  function refreshEngineTag() {
    const el = U.$('#story-mode-tag');
    if (!el) return;
    el.textContent = engineName();
    el.setAttribute('data-tone', aiOn() ? 'gold' : 'cyan');
  }
  function resetAiSession() { aiHistory = []; aiPendingFact = null; }

  /* ── 职业面板（注入提示词 + 回合末尾快照，对应截图里的「职业面板」） ── */
  function panelLines(s) {
    const pos = ES.state.positionOf(s);
    const L = s.club && s.club.lineup;
    const lvl = ES.state.level(ES.state.ovr(s));
    const line = [];
    line.push('★ 职业面板 · ' + s.time.year + ' 年 ' + s.time.month + ' 月（' + (s.time.seasonLabel || ('S' + s.time.season)) + ' · ' + s.time.phase + '）');
    const diffName = (function () {
      const d = s.difficulty;
      if (!d) return '标准';
      if (typeof d === 'object') return d.name || '标准';
      const f = (D.DIFFICULTIES || []).filter(function (x) { return x.id === d; })[0];
      return f ? f.name : String(d);
    })();
    line.push('· ' + s.profile.name + '（ID: ' + s.profile.tag + '）｜' + s.profile.gender + ' · ' + s.profile.age + ' 岁｜' + diffName + '难度');
    line.push('· 总评 ' + ES.state.ovr(s) + '（' + lvl.name + '）｜位置 ' + pos.name + '｜体能 ' + Math.round(s.attrs.stamina) + '/100');
    line.push('· 竞技状态 ' + Math.round(s.res.condition) + '/100 ｜ 手部健康 ' + Math.round(s.res.hand) + '/100 ｜ 伤病风险 ' + Math.round(s.res.injury) + '/100');
    line.push('· 资金 ' + Math.round(s.res.money) + ' 元 ｜ 粉丝 ' + Math.round(s.res.fans) + ' ｜ 名声 ' + Math.round(s.special.fame) + ' ｜ 舆论热度 ' + Math.round(s.special.heat));
    line.push('· 属性：' + D.ATTRS.map(function (a) { return a.name + Math.round(s.attrs[a.k]); }).join(' ｜ '));
    if (s.club) line.push('· ' + s.club.name + '（' + s.club.short + '）· ' + s.club.league + ' ｜ 队内定位：' + ES.state.lineupText(s) + ' ｜ 教练信任 ' + Math.round(s.special.coachTrust));
    const rels = s.relations.slice().sort(function (a, b) { return b.affection - a.affection; });
    if (rels.length) line.push('· 关系：' + rels.slice(0, 6).map(function (r) { return r.name + ' +' + Math.round(r.affection); }).join(' ｜ '));
    const low = rels.slice(-3).filter(function (r) { return r.affection < 45; });
    if (low.length) line.push('· 暗流：' + low.map(function (r) { return r.name + '（好感 ' + Math.round(r.affection) + '，' + r.role + '）'; }).join('；'));
    const q = (s.quests || []).filter(function (x) { return !x.done; }).slice(0, 3);
    if (q.length) line.push('· 待办：' + q.map(function (x) {
      const pg = (ES.state.questProgress ? ES.state.questProgress(s, x) : (x.progress || 0));
      return x.name + '（' + pg + '/' + x.target + '，' + x.deadline + ' 天内）';
    }).join('；'));
    const logs = (s.stats.log || []).slice(-4);
    if (logs.length) line.push('· 近期：' + logs.map(function (x) { return x.text; }).join(' → '));
    return line;
  }
  function buildStateDigest(s) { return panelLines(s).join('\n'); }

  /* ── 世界上下文（按当前处境挑选，控制 token） ── */
  function buildWorldContext(s) {
    const out = [];
    out.push('【世界】现实向《无畏契约》VCT 电竞世界。当前 ' + s.time.year + ' 年 ' + s.time.month + ' 月，' + (s.time.seasonLabel || '') + ' · ' + s.time.phase + '。');
    if (D.VERSIONS && D.VERSIONS.length) {
      const v = D.VERSIONS.filter(function (x) { return x.year <= s.time.year; }).slice(-1)[0];
      if (v) out.push('【版本】' + v.name + '：' + (v.note || v.desc || ''));
    }
    if (s.club) {
      out.push('【俱乐部】' + s.club.name + '（' + s.club.short + '）· ' + s.club.region + ' ' + s.club.tier + ' 级 · ' + s.club.city + '。风格：' + s.club.style + '。荣誉：' + (s.club.honors || '—'));
      out.push('【阵容】' + (s.club.rosterNote || '') + '：' + (s.club.roster || []).join('、') + '。' + (s.club.lineup ? '当前首发：' + s.club.lineup.current.join('、') + '；玩家定位：' + ES.state.lineupText(s) : ''));
      if (s.club.line) out.push('【队内张力】' + s.club.line);
    }
    if (ES.state.monthSchedule) {
      const sch = ES.state.monthSchedule(s, s.time.month);
      if (sch.length) out.push('【本月赛程】' + sch.map(function (e) { return e.day + ' 日 ' + e.text; }).join('；'));
      const nm = ES.state.nextMatch ? ES.state.nextMatch(s) : null;
      if (nm) out.push('【下一场比赛】' + nm.text + '（' + nm.inDays + ' 天后，' + nm.month + ' 月 ' + nm.day + ' 日）；剧情与训练安排必须与赛程吻合。');
      const today = ES.state.matchToday ? ES.state.matchToday(s) : null;
      if (today) out.push('【今日比赛】' + today.text + ' —— 今天是比赛日：正文必须写到这场比赛（赛前准备 / 上场 / 赛果），玩家可据此进入比赛推演。');
    }
    const rels = s.relations.slice().sort(function (a, b) { return b.affection - a.affection; }).slice(0, 8);
    if (rels.length) out.push('【关键人物】' + rels.map(function (r) { return r.name + '（' + r.role + '，好感 ' + Math.round(r.affection) + '）'; }).join('；'));
    out.push('【当前定位】' + ES.state.positionOf(s).name + '；总评 ' + ES.state.ovr(s) + '。');
    return out.join('\n');
  }

  /* ── 输出契约（标签协议） ── */
  function storySystemPrompt(s) {
    return [
      '你是一款现实向《无畏契约》职业选手人生模拟器的剧情引擎。你负责生成**具体、可读的中文剧情**，并让世界状态随剧情推进。',
      '',
      '输出格式（严格遵守，标签外不要写任何解释）：',
      '<thinking>一到三句内部推演：这一段要推进什么、谁在场、玩家行为会有什么代价。玩家可展开查看。</thinking>',
      '<maintext>剧情正文。350—800 字，中文，第二人称或第三人称皆可。必须有具体场景、动作、对话与细节（时间、地点、人物、数据、对话原话）。不要写成选项说明，不要把数值写进正文。</maintext>',
      '<sum>事件结算，逐条列出这段剧情造成的可验证后果（含具体数值），每条一行。必须与 <vars> 一致。</sum>',
      '<option>每个选项一行，格式：选项文本 | risk:safe|normal|high | check:属性:成功线:判定名 | 一句话说明这个选项的做法与代价</option>',
      '<option>…（3—5 个，不要替玩家做决定，不要给出「全都做」的选项）</option>',
      '<vars>合法 JSON，只写发生变化的部分。</vars>',
      '',
      '可用属性键：' + D.ATTRS.map(function (a) { return a.k + '（' + a.name + '）'; }).join('、'),
      'vars 结构示例：{"time":{"advanceDays":3},"attrs":{"aim":1,"gameSense":2},"res":{"condition":-6,"hand":-2},"special":{"coachTrust":8,"fame":3},"fans":120,"money":-2000,"rel":{"书呆":2},"flags":{"了解战术":true}}',
      '',
      '硬性规则：',
      '1. 日期只能前进，绝不回退；只有当剧情真的经过了时间（训练数日、休赛期、出差、等待）才写 time.advanceDays，一两天的小事不要推进日期。',
      '2. 数值变化要克制：属性 ±1~3，关系 ±2~8，金钱按现实量级（电竞选手月薪数万到数十万），状态/健康 ±3~15。',
      '2.1 赛程纪律：比赛日（见【今日比赛】）的正文必须围绕这场比赛；比赛结果由系统的比赛推演产生，你只负责赛前、赛后与场间叙事，不要自己编造比分与冠军。',
      '3. 尊重现实 VCT 设定：俱乐部、赛制（13 分制、加时）、地图与特工名称都要真实；现实选手只用其比赛 ID 与公开赛场形象，不涉及私生活；虚构配角可用中文名。',
      '4. 玩家是 17—19 岁的年轻选手，起点低、资源少；不要无理由地给他大赛冠军或顶级合同。',
      '5. 判定的成败由系统给出（见【判定结果】）；有判定时，剧情必须体现该结果，不要自行改变成败。',
      '6. 每次回复必须包含 <maintext> 与**恰好 3 个** <option>；玩家另有「自由行动」输入框，不要替他写自由行动选项。',
      '',
      '<文风>（必须遵守，来源：融合预设文风规则）',
      (D.STORY_STYLE || []).join('\n'),
      '</文风>',
      '',
      '<选项规则>',
      (D.OPTION_RULES || []).join('\n'),
      '</选项规则>',
      '',
      '<选项格式>每行一个 <option>，用竖线分隔：选项文本 | risk:safe|normal|high | check:属性:成功线:判定名 | 一句话说明做法与代价</option>',
      '（判定属性只能是：' + D.ATTRS.map(function (a) { return a.name; }).join('、') + '；没有判定就省略 check 段。）'
    ].join('\n');
  }

  /* ── 组装 messages ── */
  function buildStoryMessages(s, actionText, opts) {
    opts = opts || {};
    const msgs = [{ role: 'system', content: storySystemPrompt(s) }];
    msgs.push({ role: 'system', content: buildWorldContext(s) });
    msgs.push({ role: 'system', content: '【当前状态】\n' + buildStateDigest(s) });
    if (aiPendingFact) { msgs.push({ role: 'system', content: '【判定结果】' + aiPendingFact }); aiPendingFact = null; }
    aiHistory.slice(-AI_HISTORY_MAX).forEach(function (m) { msgs.push(m); });
    if (opts.opening) {
      msgs.push({ role: 'user', content: '（开局）请顺着刚发生的情境继续推进剧情：给出玩家现在可以做的一批具体行动。' });
      return msgs;
    }
    msgs.push({ role: 'user', content: actionText ? ('我的行动：' + actionText) : '（继续推进，不要替我决定行动）' });
    return msgs;
  }

  /* ── 流式正文容器 ── */
  function esc2html(txt) {
    return U.esc(String(txt || ''))
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\n{2,}/g, '</p><p class="story-p">')
      .replace(/\n/g, '<br>');
  }
  function appendLiveProse() {
    const host = U.$('#story-scroll');
    if (!host) return { set: function () {}, done: function () {} };
    const holder = document.createElement('div');
    holder.style.display = 'contents';
    holder.innerHTML = '<p class="story-p live"></p>';
    host.appendChild(holder);
    const p = holder.querySelector('p');
    let last = 0;
    return {
      set: function (txt) {
        const now = Date.now();
        if (now - last < 60) return;   /* 流式节流 */
        last = now;
        p.innerHTML = esc2html(txt);
        scrollBottom();
      },
      done: function (txt) {
        p.classList.remove('live');
        p.innerHTML = esc2html(txt || '（模型没有返回正文）');
        scrollBottom();
      }
    };
  }

  /* ── 生成一回合（AI 通道） ── */
  function aiTurn(actionText, opts) {
    opts = opts || {};
    if (aiBusy) return Promise.resolve();
    if (!aiOn()) return nextSceneLocal(opts.forceId);
    aiBusy = true; busy = true; disableChoices(true);
    setGen('AI 生成剧情中', true);
    if (actionText && !opts.opening) {
      const host = U.$('#story-scroll');
      if (host) {
        const echo = document.createElement('div');
        echo.className = 'chosen-line';
        echo.innerHTML = U.icon('target', 'icon-sm') + '<span>你的行动：<b>' + U.esc(actionText) + '</b></span>';
        host.appendChild(echo); scrollBottom();
      }
    }
    const messages = buildStoryMessages(S, actionText, opts);
    const parsed = { thinking: '', maintext: '', options: [], sum: '', varsRaw: '', varsCommands: { merge: {} }, unknown: {} };
    const parser = new ES.tavern.StreamTagParser(ES.tavern.DEFAULT_TAGS, ES.tavern.DEFAULT_OPAQUE);
    let reasoningBuf = '';
    const live = appendLiveProse();
    const started = Date.now();
    return ES.api.chat({
      task: 'story',
      messages: messages,
      onDelta: function (chunk) {
        ES.tavern.aggregate(parser.feed(chunk), parsed);
        live.set(parsed.maintext);
        setGen('AI 生成剧情中 · ' + String(parsed.maintext || '').length + ' 字', true);
      },
      onReasoning: function (piece) {
        reasoningBuf += piece;
        if (!parsed.maintext) setGen('模型思考中 · ' + reasoningBuf.length + ' 字', true);
      }
    }).then(function (res) {
      if (res && res.local) {
        /* API 不可用 → 回退本地推演（api 层已给出提示） */
        aiBusy = false; busy = false; disableChoices(false);
        live.done(parsed.maintext || '（API 不可用，已切回本地推演）');
        refreshEngineTag();
        return nextSceneLocal(opts.forceId);
      }
      /* 降级：模型没写标签时，把整段原文当正文 */
      let rawText = String(res && (res.text || res.raw) || '');
      const reasonText = String((res && res.reasoning) || reasoningBuf || '');
      /* 协议噪声（SSE / chat.completion JSON）绝不进正文 */
      const noise = /chat\.completion\.chunk|system_fingerprint|\"delta\"\s*:/.test(rawText) || /^\s*data:\s*\{/m.test(rawText);
      if (noise) rawText = '';
      /* 有些端点把最终答案也放在 reasoning_content 里，那就从里面捞标签 */
      if (!parsed.maintext && reasonText && /<maintext>|<option>/i.test(reasonText)) {
        ES.tavern.aggregate(parser.feed(reasonText), parsed);
      }
      if (!parsed.maintext && rawText) {
        parsed.maintext = rawText.replace(/<\/?(?:thinking|think|vars|sum|option|maintext)>/gi, '').trim();
      }
      if (!parsed.maintext) {
        parsed.maintext = reasonText
          ? '（模型只返回了思维链，没有给出正文。若持续如此，说明该端点把答案也放在 reasoning_content，或需要关闭思考模式。已按思维链中的内容尽力恢复，可点「继续」重试。）'
          : '（模型这次没有返回可用文本' + (rawText ? '，原始响应见下方' : '，可能是超时或鉴权失败') + '。可以点「继续」重试，或换一个模型。）';
      }
      live.done(parsed.maintext);
      const blocks = [];
      const thinkText = parsed.thinking || reasonText;
      if (thinkText) blocks.push({ t: 'think', text: esc2html(thinkText.slice(0, 4000)) });
      else if (rawText) blocks.push({ t: 'think', text: '<b>模型原始响应</b>（未按标签格式输出，前 1200 字）<br>' + esc2html(rawText.slice(0, 1200)) });
      if (parsed.sum) blocks.push({ t: 'sum', text: esc2html(parsed.sum).replace(/\n/g, '<br>') });
      const applied = ES.state.applyStoryVars(S, parsed.varsCommands.merge);
      if (applied && applied.notes.length) {
        blocks.push({ t: 'sum', text: '<b>引擎结算</b><br>' + applied.notes.map(function (n) { return '· ' + U.esc(n); }).join('<br>') });
      }
      blocks.push({ t: 'panel', title: '职业面板 · ' + S.time.year + ' 年 ' + S.time.month + ' 月', text: panelLines(S).slice(1).map(function (x) { return U.esc(x.replace(/^· /, '')); }).join('<br>') });
      if (applied && applied.advanced > 0) {
        ES.audio.play('levelup');
        U.toast({ tone: 'info', icon: 'calendar', title: '剧情推进了 ' + applied.advanced + ' 天', msg: applied.from.month + ' 月 ' + applied.from.day + ' 日 → ' + applied.to.month + ' 月 ' + applied.to.day + ' 日 · ' + S.time.phase, duration: 7000 });
      }
      aiHistory.push({ role: 'user', content: actionText || '（继续推进）' });
      aiHistory.push({ role: 'assistant', content: '<maintext>' + (parsed.maintext || '') + '</maintext>' + (parsed.sum ? '<sum>' + parsed.sum + '</sum>' : '') });
      if (aiHistory.length > AI_HISTORY_MAX * 2) aiHistory = aiHistory.slice(-AI_HISTORY_MAX * 2);
      ES.state.pushLog(S, 'story', (parsed.maintext || '').slice(0, 60));
      if (ES.tavern && ES.tavern.captureBlocks) { try { ES.tavern.captureBlocks([{ t: 'narr', text: parsed.maintext || '' }].concat(blocks)); } catch (e) {} }
      const setCh = function () { setChoices(parsed.options, { rawText: rawText }); };
      const finish = function () {
        setCh();
        if (ES.app.refreshUI) ES.app.refreshUI();
        busy = false; aiBusy = false; disableChoices(false);
        setGen('待命', false);
        U.announce('AI 已生成剧情，共 ' + (parsed.options || []).length + ' 个可选行动。');
      };
      return appendBlocks(blocks).then(finish);
    }).catch(function (err) {
      const msg = ES.api.friendlyError ? ES.api.friendlyError(err) : String(err && err.message || err);
      appendBlocks([{ t: 'sys', text: '<b>生成失败</b>：' + U.esc(msg) }]);
      busy = false; aiBusy = false; disableChoices(false); setGen('待命', false);
      refreshEngineTag();
    });
  }

  /* ── 选项文本 → 选项对象（同时供酒馆层复用） ── */
  function parseOptionLine(line) {
    const s = String(line == null ? '' : line).trim().replace(/^[-•*\d.、)\s]+/, '');
    if (!s) return null;
    if (s.charAt(0) === '{') {
      try {
        const o = JSON.parse(s);
        if (o && o.label) return { label: String(o.label), desc: String(o.desc || ''), risk: o.risk || 'normal', check: o.check || null, tag: o.tag || '' };
      } catch (e) { /* 非 JSON，按管道解析 */ }
    }
    const parts = s.split('|').map(function (x) { return x.trim(); }).filter(Boolean);
    const out = { label: parts[0] || s, desc: '', risk: 'normal', check: null, tag: '' };
    parts.slice(1).forEach(function (p) {
      let m = /^risk\s*[:=]\s*(safe|normal|high)$/i.exec(p);
      if (m) { out.risk = m[1].toLowerCase(); return; }
      m = /^check\s*[:=]\s*([^:=]+)\s*[:=]\s*(\d+)\s*[:=]?\s*(.*)$/.exec(p);
      if (m) {
        const key = ES.state.attrKeyOf ? ES.state.attrKeyOf(m[1].trim()) : m[1].trim();
        const a = D.ATTRS.filter(function (x) { return x.k === key || x.name === m[1].trim(); })[0];
        out.check = { attr: a ? a.k : key, dc: parseInt(m[2], 10), tag: (m[3] || (a ? a.name : key)), kind: 'check' };
        return;
      }
      m = /^tag\s*[:=]\s*(.+)$/i.exec(p);
      if (m) { out.tag = m[1]; return; }
      if (!out.desc) out.desc = p;
    });
    return out;
  }

  /** 模型没按标签输出时：从纯文本里抽选项 */
  function optionsFromText(txt) {
    const s = String(txt || '');
    const out = [];
    const re = /^\s*(?:[-*•]|\d{1,2}[.、)]|选项\s*\d{1,2}\s*[:：])\s*(.+)$/gm;
    let m;
    while ((m = re.exec(s)) !== null) {
      const line = m[1].trim().replace(/^(?:选项\s*\d{1,2}\s*[:：]\s*)/, '');
      if (line.length < 4 || line.length > 90) continue;
      if (/^[\d.、)\s]+$/.test(line)) continue;
      out.push(line);
      if (out.length >= 5) break;
    }
    return out;
  }

  /** 兜底选项：任何情况下都保证有 3 个可执行行动（自由行动始终由玩家输入） */
  function fallbackChoices() {
    /* 叙事层可能尚未启动（酒馆层先挂载），此时给通用三条 */
    if (!S || !S.profile) {
      return [
        { label: '继续训练，把手感维持住', desc: '稳妥推进', risk: 'safe', check: { attr: 'aim', dc: 12, tag: '枪法' } },
        { label: '找教练聊一次，问清楚下一步怎么走', desc: '沟通判定', risk: 'normal', check: { attr: 'comms', dc: 13, tag: '沟通' } },
        { label: '推进一周：按部就班训练与排位', desc: '时间快进，由剧情结算', risk: 'safe' }
      ];
    }
    const pos = ES.state.positionOf(S).name;
    const rels = S.relations.slice().sort(function (a, b) { return a.affection - b.affection; });
    const low = rels[0];
    const list = [
      { label: '加练两小时，把今天的失误逐帧过一遍', desc: '稳妥推进：小幅成长，消耗体能', risk: 'safe', check: { attr: 'aim', dc: 12, tag: '枪法' } },
      { label: '找教练谈一次，问清楚自己离首发还差什么', desc: '沟通判定，可能改变教练信任与定位', risk: 'normal', check: { attr: 'comms', dc: 13, tag: '沟通' } },
      { label: '约队友吃个饭，先把队内关系理顺', desc: '关系线：提升队内好感与默契', risk: 'safe' }
    ];
    if (low) list.push({ label: '私下找 ' + low.name + ' 聊一次，把话说开', desc: '关系修复：' + low.name + ' 目前好感最低（' + Math.round(low.affection) + '）', risk: 'normal', check: { attr: 'comms', dc: 12, tag: '沟通' } });
    return list.slice(0, 3);
  }

  /** 把选项对象序列化回一行（供楼层回写 <option> 时保留元数据） */
  function optionLine(c) {
    const parts = [String(c.label || '').trim()];
    parts.push('risk:' + (c.risk || 'normal'));
    if (c.check) parts.push('check:' + (c.check.attr || c.check.tag) + ':' + c.check.dc + ':' + (c.check.tag || ''));
    if (c.desc) parts.push(String(c.desc).replace(/\|/g, '/'));
    return parts.join(' | ');
  }

  /** 用模型给出的选项替换当前选项（酒馆层与叙事层共用） */
  function setChoices(lines, opts) {
    opts = opts || {};
    let list = (Array.isArray(lines) ? lines : String(lines || '').split('\n'))
      .map(parseOptionLine).filter(Boolean);
    if (!list.length && opts.rawText) list = optionsFromText(opts.rawText).map(parseOptionLine).filter(Boolean);
    if (!list.length) list = fallbackChoices();
    if (!list.length) return false;
    current = current || {
      id: 'ai',
      chapter: { id: (S && S.scene && S.scene.chapterId) || 'ch1', name: 'AI 剧情', index: 'AI' },
      scene: 'AI 剧情', choices: [], days: 1, next: null
    };
    current.choices = list;
    renderChoices(list);
    return true;
  }

  /* ── 本地推演的入口别名（AI 失败时回退用） ── */
  function nextSceneLocal(forceId) {
    const nodeId = forceId || (current && current.next) || null;
    if (nodeId && D.SCENES[nodeId]) return renderNode(nodeId);
    return randomInterlude();
  }
  /* ══════════ 抉择处理 ══════════ */
  function choose(index) {
    if (busy || !current) return;
    const c = current.choices[index];
    if (!c) return;
    if (aiOn()) return aiChoose(c);
    busy = true;
    disableChoices(true);
    ES.audio.play('click');
    const host = U.$('#story-scroll');
    const echo = document.createElement('div');
    echo.className = 'chosen-line';
    echo.innerHTML = U.icon('target', 'icon-sm') + '<span>你的选择：<b>' + U.esc(c.label) + '</b></span>';
    host.appendChild(echo);
    scrollBottom();
    setGen('推演中 · 正在生成后果', true);
    const thinking = 320 + Math.random() * 380;

    setTimeout(function () {
      const flow = c.check ? rollCheck(c.check).then(function (res) {
        setGen('判定中 · ' + res.attrName, true);
        return showDiceDialog(res).then(function () { return res; });
      }) : Promise.resolve(null);

      flow.then(function (res) {
        let verdict = res ? res.verdict : 'auto';
        let effects = c.effects || {};
        let text = c.result ? (c.result.success || '') : '';
        if (res) {
          if (verdict === 'crit') { effects = mergeEffects(c.effects, c.critEffects); text = (c.result && (c.result.crit || c.result.success)) || text; }
          else if (verdict === 'success') { text = (c.result && c.result.success) || text; }
          else if (verdict === 'narrow') { effects = soften(c.effects); text = (c.result && (c.result.narrow || c.result.success)) || text; }
          else { effects = c.failEffects || invert(c.effects); text = (c.result && c.result.fail) || '事情没有按你预想的方向发展。'; }
          if (verdict === 'fail' || verdict === 'critfail') consecutiveFail++;
          else consecutiveFail = 0;
        }
        setGen('结算中 · 正在写入履历', true);
        return printOutcome(text, res).then(function () {
          const deltas = applyEffects(effects);
          if (res) {
            ES.state.pushLog(S, 'choice', '【' + res.label + '】' + c.label);
          } else {
            ES.state.pushLog(S, 'choice', c.label);
          }
          /* 职业战绩：某些选项直接产生比赛 */
          if (c.match) simulateQuickMatch(c.match);
          /* 上首发：判定成功（非失败）才真正顶替，并迁移队内关系 */
          const promoted = !!(c.promotionTarget && (!res || res.verdict === 'crit' || res.verdict === 'success' || res.verdict === 'narrow'));
          if (promoted) {
            const r = ES.state.promotePlayer(S, c.promotionTarget);
            if (r) {
              banner({ title: '首发名单变更', text: '你顶替了 ' + r.target + '，进入首发五人。对方转入替补席。', tone: 'gold', icon: 'medal', duration: 12000 });
              U.toast({ tone: 'gold', icon: 'medal', title: '你上首发了', msg: '顶替 ' + r.target + ' · 首发：' + r.starters.join('、'), duration: 9000 });
              ES.state.pushLog(S, 'club', '上首发：顶替 ' + r.target + '，当前首发 ' + r.starters.join('、'));
              ES.audio.play('levelup');
            }
          }
          endTurn(c.days || current.days || 1);
          const next = c.next;
          if (next === '__after_promotion__') {
        const resume = current && current.resumeNode;
        setGen(resume ? '继续剧情' : '待命', false);
        return nextScene(resume || undefined);
      }
      const promo = /^__promotion(?:@(.+))?__$/.exec(String(next || ''));
      if (promo) {
        setGen('生成场景中', false);
        return promotionScene(false, promo[1] || null);
      }
      if (next === '__end__') { setGen('生涯终章', false); return finishCareer(); }
          if (next === '__loop__') { setGen('待命', false); return nextScene(); }
          setGen('待命', false);
          return nextScene(next);
        });
      }).then(function () {
        busy = false;
        disableChoices(false);
      }).catch(function (err) {
        console.warn(err);
        busy = false; disableChoices(false); setGen('待命', false);
        U.toast({ tone: 'error', title: '推演异常', msg: '叙事引擎遇到未知错误，已回滚本次结算。' });
      });
    }, thinking);
  }

  function mergeEffects(a, b) {
    if (!b) {
      const out = JSON.parse(JSON.stringify(a || {}));
      if (out.res) Object.keys(out.res).forEach(function (k) { if (out.res[k] > 0) out.res[k] = Math.round(out.res[k] * 1.5); });
      if (out.attrs) Object.keys(out.attrs).forEach(function (k) { if (out.attrs[k] > 0) out.attrs[k] = out.attrs[k] + 1; });
      return out;
    }
    const out = JSON.parse(JSON.stringify(a || {}));
    ['attrs', 'special', 'res', 'flags', 'metrics'].forEach(function (grp) {
      if (!b[grp]) return;
      out[grp] = out[grp] || {};
      Object.keys(b[grp]).forEach(function (k) { out[grp][k] = (out[grp][k] || 0) + b[grp][k]; });
    });
    if (b.money) out.money = (out.money || 0) + b.money;
    if (b.status) out.status = (out.status || []).concat(b.status);
    return out;
  }
  function soften(effects) {
    const out = JSON.parse(JSON.stringify(effects || {}));
    ['attrs', 'special'].forEach(function (grp) {
      if (!out[grp]) return;
      Object.keys(out[grp]).forEach(function (k) { if (out[grp][k] > 0) out[grp][k] = Math.max(1, Math.round(out[grp][k] / 2)); });
    });
    if (out.res) Object.keys(out.res).forEach(function (k) { if (out.res[k] > 0 && k !== 'money') out.res[k] = Math.max(1, Math.round(out.res[k] / 2)); });
    return out;
  }
  function invert(effects) {
    const out = {};
    if (!effects) return out;
    if (effects.res) { out.res = {}; Object.keys(effects.res).forEach(function (k) { if (k === 'money') return; out.res[k] = -Math.round(effects.res[k] * 0.5); }); }
    if (effects.attrs) { out.attrs = {}; Object.keys(effects.attrs).forEach(function (k) { out.attrs[k] = -Math.max(1, Math.round(effects.attrs[k] / 2)); }); }
    if (effects.special) { out.special = {}; Object.keys(effects.special).forEach(function (k) { out.special[k] = -Math.max(1, Math.round(effects.special[k] / 2)); }); }
    return out;
  }
  function disableChoices(dis) {
    U.$$('#choice-list .choice').forEach(function (b) { b.disabled = dis; });
    U.$$('#quick-choices .quick-choice').forEach(function (b) { b.disabled = dis; });
  }
  function printOutcome(text, res) {
    const blocks = [];
    if (text) blocks.push({ t: 'narr', text: text });
    if (res) {
      const extra = res.verdict === 'crit' ? '你的表现超出了所有人的预期，连对手都在赛后面无表情地盯着数据面板。'
        : res.verdict === 'critfail' ? '最糟糕的情况发生了，而且所有人都看见了。'
          : res.verdict === 'narrow' ? '你勉强过关，但代价已经记在身体和账本上。'
            : res.verdict === 'fail' ? '结果不算好，你需要在接下来的几天里处理它留下的麻烦。' : '';
      if (extra) blocks.push({ t: 'sys', text: '<b>' + res.label + '</b> · ' + extra });
    }
    return appendBlocks(blocks);
  }

  /* ══════════ 场景推进 ══════════ */
  function nextScene(forceId) {
    if (aiOn() && !forceId) return aiTurn(null);
    return nextSceneLocal(forceId);
  }

  function renderNode(nodeId) {
    const node = D.SCENES[nodeId];
    if (!node) return randomInterlude();
    current = { id: nodeId, chapter: node.chapter, scene: node.scene, choices: node.choices, days: node.days, next: node.openNext || null };
    setChapter(node.chapter);
    setSceneTag(node.scene);
    const withChapter = [{ t: 'chapter', text: node.chapter.index + ' · ' + node.chapter.name + ' —— ' + node.scene }].concat(node.lines);
    setGen('生成场景中', true);
    return appendBlocks(withChapter).then(function () {
      if (aiOn()) {
        /* AI 模式：把开场情境交给模型，由它续写并给出选项 */
        aiHistory.push({ role: 'assistant', content: '<maintext>' + node.lines.map(function (l) { return (l.who ? l.who + '：' : '') + String(l.text || '').replace(/<[^>]+>/g, ''); }).join('\n') + '</maintext>' });
        return aiTurn(null, { opening: true });
      }
      renderChoices(node.choices);
      setGen('待命', false);
      U.$$('#choice-list .choice').forEach(function (b, i) { b.style.animation = 'stepIn .32s ' + (i * 0.05) + 's both'; });
      U.announce('新场景：' + node.scene + '，共 ' + node.choices.length + ' 个可选行动。');
    });
  }

  /* ══════════ 随机事件（无剧情节点时的推演） ══════════ */
  /* ══════════ 上首发剧情（选项按当前首发动态生成） ══════════ */
  function promotionReady() {
    const L = S.club && S.club.lineup;
    return !!(L && L.selfStatus === 'bench');
  }
  function promotionScene(forced, resumeNode) {
    const L = S.club.lineup;
    if (resumeNode !== undefined) { /* 由节点进入时记录后续落点 */ }
    const order = D.POSITIONS;
    const starterRels = S.relations.filter(function (r) { return r.type === 'teammate'; });
    const nameOf = function (nm) { return nm; };
    const lines = [
      { t: 'narr', text: '训练赛结束，教练把战术板扣在桌上。首发五人今天的状态都不好，但名单明天就要提交。' },
      { t: 'speak', role: 'coach', who: '主教练', text: '「名单不是刻在石头上的。你想上，就得有人下来——你自己说，你替谁？」' },
      { t: 'sys', text: '<b>当前首发</b>：' + L.current.map(function (nm, i) {
        const rel = starterRels.filter(function (r) { return r.name === nm; })[0];
        return nm + '（' + (rel ? rel.role.replace('队友 · ', '') : order[i % order.length].name) + '）';
      }).join('、') + '<br><b>你的定位</b>：替补席 · 需要一次「顶替」才能进首发（顶替后对方转入替补，关系会变化）' }
    ];
    const choices = L.current.map(function (nm, i) {
      const rel = starterRels.filter(function (r) { return r.name === nm; })[0];
      const pos = rel ? rel.role.replace('队友 · ', '') : order[i % order.length].name;
      const aff = rel ? Math.round(rel.affection) : 50;
      return {
        label: '顶替 ' + nm + '（' + pos + '）',
        desc: '与你的关系 ' + aff + ' · 顶替后对方转入替补席，好感与信任下降；你的战术地位将按其位置重塑。',
        risk: aff >= 70 ? 'high' : 'normal',
        check: { attr: 'comms', dc: 13, tag: '沟通（说服教练与队内）' },
        promotionTarget: nm,
        effects: {
          special: { coachTrust: 10, standing: 14, teammateTrust: -4, fame: 4 },
          res: { fans: 2, condition: -4 },
          flags: { debut: true, promoted: true }
        },
        failEffects: { special: { coachTrust: -6, standing: -4, teammateTrust: -8 }, res: { condition: -6 } },
        result: {
          success: '你把训练赛的数据摆到教练面前，指出自己能在' + pos + '位提供的价值。教练沉默了几秒：「明天你上。」' + nm + ' 摘下耳机，没有说话。',
          fail: '你话说得太急，教练皱了眉：「先把自己的失误处理干净。」名单没有变化，你回到替补席。'
        },
        next: '__after_promotion__'
      };
    });
    choices.push({
      label: '再等等，用训练赛表现说话',
      desc: '安全路线：不立刻顶替任何人，继续积累教练信任与数据。',
      risk: 'safe',
      check: null,
      effects: { special: { coachTrust: 6, teammateTrust: 6, standing: 2 }, res: { condition: 4 } },
      result: { success: '「行，那就继续练。」教练把名单收回抽屉。你把护腕重新戴好。' },
      next: null
    });
    const p = baseScene('争一个首发名额', '基地 · 战术室', lines, choices, 2);
    current.resumeNode = resumeNode || null;
    return p;
  }

  function randomInterlude() {
    /* 替补身份 + 教练信任达标 → 优先触发「争首发」剧情 */
    if (promotionReady() && S.special.coachTrust >= 58 && S.stats.choices >= 6 && !S.flags.promotionOffered) {
      S.flags.promotionOffered = true;
      return promotionScene();
    }
    const roll = U.rng();
    const phase = S.time.phaseId;
    if (roll < 0.16) return eventMedia();
    if (roll < 0.3) return eventTraining();
    if (roll < 0.42) return eventMatchOffer();
    if (roll < 0.54) return eventSocial();
    if (roll < 0.64) return eventBody();
    if (roll < 0.74) return eventPatch();
    if (roll < 0.84) return eventFans();
    return eventFiller(phase);
  }

  function baseScene(title, sceneName, lines, choices, days) {
    current = { id: 'gen', chapter: { id: S.scene.chapterId, name: chapterName(S.scene.chapterId), index: chapterIndex(S.scene.chapterId) }, scene: sceneName, choices: choices, days: days || 1, next: null };
    setSceneTag(sceneName);
    setGen('生成场景中', true);
    return appendBlocks([{ t: 'chapter', text: chapterIndex(S.scene.chapterId) + ' · ' + chapterName(S.scene.chapterId) + ' —— ' + title }].concat(lines)).then(function () {
      renderChoices(choices);
      setGen('待命', false);
    });
  }
  function chapterName(id) {
    return { ch1: '起步', ch2: '赛场', ch3: '风暴', ch4: '抉择', ch5: '巅峰' }[id] || '日常';
  }
  function chapterIndex(id) {
    return 'CH.' + ({ ch1: '01', ch2: '02', ch3: '03', ch4: '04', ch5: '05' }[id] || '00');
  }

  function eventFiller(phase) {
    const f = U.pick(D.FILLER_SCENES);
    const lines = f.lines.slice();
    lines.push({ t: 'narr', text: '现在是' + S.time.phase + '的第 ' + S.time.week + ' 周。' + (S.club.signed ? '你在 ' + S.club.name + ' 的角色是' + S.club.role + '。' : '你还没有正式合同，只能靠训练赛和排位证明自己。') });
    lines.push({ t: 'speak', role: 'coach', who: '主教练', text: pickCoachLine() });
    const choices = [
      { label: '按计划完成今天的训练量', desc: '稳定积累，不会有意外。', risk: 'safe', check: null, effects: { attrs: { aim: 1, comms: 1 }, res: { condition: -6 }, special: { coachTrust: 2 } }, result: { success: '你把训练计划一项项划掉。没有惊喜，也没有意外，这在职业圈里已经算是好日子。' }, next: null },
      { label: '主动找教练要一次加练', desc: '沟通与心态判定，成功可获得额外成长。', risk: 'normal', check: { attr: 'comms', dc: 13, tag: '沟通' }, effects: { attrs: { aim: 2, gameSense: 1 }, special: { coachTrust: 6 }, res: { condition: -12 } }, failEffects: { res: { condition: -12 }, special: { coachTrust: -2 } }, result: { success: '教练看了你一眼，把战术板推过来：「行，那我们把上一张图的回合拆一遍。」', fail: '教练正忙着复盘其他队伍：「今天先按计划走。」你只好自己加练了两小时。' }, next: null },
      { label: '早点回宿舍，看看比赛录像', desc: '恢复体力同时提升版本理解。', risk: 'safe', check: null, effects: { special: { versionBonus: 4 }, attrs: { insight: 1 }, res: { condition: 8 } }, result: { success: '你躺在床上用平板看了两场国外联赛，顺手记了三条笔记。' }, next: null }
    ];
    return baseScene(f.title, f.scene, lines, choices, U.randInt(1, 2));
  }

  function pickCoachLine() {
    return U.pick([
      '今天训练赛第一张图，别再打那套默认了。',
      '你的枪法没问题，问题是你太想赢了。',
      '手怎么样？老实说。',
      '下周的对手喜欢在 B 点前压，你自己注意。',
      '数据我看了，你的首杀参与率还得提。',
      '别管外面怎么说，打好你自己的。'
    ]);
  }

  function eventMedia() {
    const lines = [
      { t: 'narr', text: '媒体日的采访排在训练之后。三家媒体的镜头对着你，问题早就写好了。' },
      { t: 'speak', role: 'media', who: '记者 · 爆料姬', text: '「上一张图的失误，是沟通问题还是你的判断问题？」' }
    ];
    const choices = [
      { label: '坦诚复盘，承认自己的判断失误', desc: '沟通判定，成功则口碑上升。', risk: 'normal', check: { attr: 'comms', dc: 12, tag: '沟通' }, effects: { special: { fame: 4, fanLoyalty: 6, heat: -4 }, attrs: { mentality: 1 }, res: { condition: 3 } }, failEffects: { special: { heat: 6, antiThreat: 4 }, res: { condition: -4 } }, result: { success: '你把那一回合的想法完整讲了一遍，包括自己犹豫的两秒。剪出来的片段被评价为「职业选手该有的复盘态度」。', fail: '你越说越像在找借口，标题最后被写成「他在甩锅队友」。' }, next: null },
      { label: '把话题引向团队与下一场比赛', desc: '安全路线，避免舆论风险。', risk: 'safe', check: { attr: 'charisma', dc: 12, tag: '魅力' }, effects: { special: { teammateTrust: 6, heat: -6 }, res: { fans: 2 } }, result: { success: '「这场已经过去了，我们在准备下一张图。」这句话干净利落，教练在群里点了个赞。' }, next: null },
      { label: '直接硬刚提问的记者', desc: '高风险：可能变成热搜，也可能引火烧身。', risk: 'high', check: { attr: 'mentality', dc: 15, tag: '心态' }, effects: { special: { fame: 8, heat: 12, fanLoyalty: 8 }, res: { fans: 5, condition: -4 } }, failEffects: { special: { heat: 20, antiThreat: 10 }, res: { fans: -4, condition: -8 } }, result: { success: '你一句话把记者问住了，直播间弹幕瞬间刷满。第二天这段视频播放过百万。', fail: '你的回应被断章取义，公关部连夜开会，你被迫删掉了那条动态。' }, next: null }
    ];
    return baseScene('媒体日', '基地采访间', lines, choices, 1);
  }

  function eventTraining() {
    const lines = [
      { t: 'narr', text: '今天的训练单贴在战术室门口。教练没有写明必须完成多少，但每个项目后面都留了空行。' },
      { t: 'speak', role: 'coach', who: '主教练', text: '「练多少你自己定。我只在赛场上验收。」' }
    ];
    const choices = [
      { label: '按计划完成今天的训练量', desc: '稳定积累，不会有意外。', risk: 'safe', check: null, effects: { attrs: { aim: 1, gameSense: 1 }, res: { condition: -5 } }, result: { success: '靶场两小时，录像一小时。数据面板上是一条平稳上升的曲线。' }, next: null },
      { label: '主动找教练要一次加练', desc: '沟通判定，成功可获得额外成长与信任。', risk: 'normal', check: { attr: 'comms', dc: 13, tag: '沟通' }, effects: { attrs: { aim: 2 }, special: { coachTrust: 8 }, res: { condition: -9, hand: -3 } }, failEffects: { res: { condition: -8, hand: -4 }, special: { coachTrust: -3 } }, result: { success: '教练陪你打了 40 分钟的一对一，指出你架点时肩膀的问题。这 40 分钟比你自己练一天有用。', fail: '教练看了你一眼：「先把基础量练完再谈加练。」你只能自己加了一小时靶场。' }, next: null },
      { label: '早点回宿舍，看录像并写笔记', desc: '恢复状态同时提升版本理解。', risk: 'safe', check: null, effects: { special: { versionBonus: 4 }, attrs: { insight: 1, gameSense: 1 }, res: { condition: 4 }, metrics: { vodReviews: 1 } }, result: { success: '你把对手最近三张图的默认写成了半页纸，睡前在脑子里过了一遍。' }, next: null }
    ];
    return baseScene('训练日', '基地训练室', lines, choices, 1);
  }

  function eventMatchOffer() {
    const opp = U.pick(D.CLUBS.filter(function (o) { return !S.club || o.id !== S.club.id; }));
    const lines = [
      { t: 'narr', text: '赛程表更新了。下一张图的对手是' + opp.name + '（' + opp.tier + ' · ' + opp.region + '），他们最近五张图赢了四张，而你们刚经历两连败。' },
      { t: 'speak', role: 'coach', who: '主教练', text: '这一场很关键。你想怎么打？' }
    ];
    const choices = [
      { label: '进入比赛直播（真实推演战局）', desc: '打开直播界面，手动指挥并打完这一局。', risk: 'normal', check: null, effects: { res: { condition: -4 } }, result: { success: '你走向选手席，戴上了耳机。' }, next: null, match: { opponent: opp } },
      { label: '赛前加练三小时针对性训练', desc: '提升对枪属性，消耗体力。', risk: 'normal', check: { attr: 'insight', dc: 13, tag: '悟性' }, effects: { attrs: { aim: 2, insight: 1 }, res: { condition: -12, hand: -4 } }, failEffects: { res: { condition: -12, hand: -6 } }, result: { success: '你针对对手的招牌特工练了一套应对方案，训练赛里试了两次都成功。', fail: '加练到深夜，手腕开始发酸，第二天状态并不好。' }, next: null },
      { label: '观看对手最近五张图录像', desc: '提升战术阅读与版本理解。', risk: 'safe', check: null, effects: { attrs: { gameSense: 2 }, special: { versionBonus: 5 }, res: { condition: -6 }, metrics: { vodReviews: 1 } }, result: { success: '分析师苏黎陪你拆完了五张图的录像，你在笔记本上写满了对手的提速时序。' }, next: null }
    ];
    return baseScene('赛前准备', '基地 · 战术室', lines, choices, 2);
  }

  function eventSocial() {
    const mate = U.pick(S.relations.filter(function (r) { return r.type === 'teammate'; }));
    const lines = [
      { t: 'narr', text: '训练结束后，' + (mate ? mate.name : '队友') + '在走廊里叫住你。他的表情不太好看。' },
      { t: 'speak', role: 'self', who: mate ? mate.name : '队友', text: '「你上一张图那回合为什么不跟我说一声？我在等你的报点。」' }
    ];
    const choices = [
      { label: '道歉并解释当时的判断', desc: '沟通判定，修复关系。', risk: 'normal', check: { attr: 'comms', dc: 13, tag: '沟通' }, effects: { rel: mate ? { } : {}, special: { teammateTrust: 8 }, res: { condition: 4 } }, failEffects: { special: { teammateTrust: -6 }, res: { condition: -4 } }, result: { success: '你们在走廊里聊了二十分钟，最后他拍了拍你的肩：「下次记得喊我。」' }, next: null },
      { label: '坚持自己的判断，据理力争', desc: '心态判定：赢了获得尊重，输了关系恶化。', risk: 'high', check: { attr: 'mentality', dc: 14, tag: '心态' }, effects: { special: { teammateTrust: 4, coachTrust: 3 }, attrs: { mentality: 1 } }, failEffects: { special: { teammateTrust: -12 }, res: { condition: -6 } }, result: { success: '你把当时的站位与判断讲清楚了，他沉默了一会儿，说：「行，是我急了。」', fail: '你们越说越僵，最后不欢而散。第二天训练室的气氛很冷。' }, next: null },
      { label: '不回应，直接回宿舍', desc: '回避冲突，但关系会受损。', risk: 'safe', check: null, effects: { special: { teammateTrust: -6 }, res: { condition: -3 } }, result: { success: '你什么都没说。走廊里只剩下他的脚步声。' }, next: null }
    ];
    if (mate) { choices[0].effects.rel = {}; choices[0].effects.rel[mate.id] = 6; choices[1].effects.rel = {}; choices[1].effects.rel[mate.id] = 4; choices[1].failEffects.rel = {}; choices[1].failEffects.rel[mate.id] = -10; choices[2].effects.rel = {}; choices[2].effects.rel[mate.id] = -6; }
    return baseScene('队内摩擦', '基地走廊', lines, choices, 1);
  }

  function eventBody() {
    const lines = [
      { t: 'narr', text: '早上醒来时，你的右手小指和无名指有轻微的麻木感。握拳，松开，再握拳——第三下的时候，那种感觉才消失。' },
      { t: 'speak', role: 'self', who: '队医 · 阿坤', text: '「这个症状我见过太多次了。你现在有两个选择：减量，或者无视它。」' }
    ];
    const choices = [
      { label: '立刻减量，安排一周康复训练', desc: '手部健康恢复，但竞技成长放缓。', risk: 'safe', check: null, effects: { res: { hand: 16, condition: 8 }, special: { coachTrust: -4 }, metrics: { gymSessions: 3 } }, result: { success: '一周的理疗和拉伸之后，麻木感完全消失了。阿坤说：「你做了正确的选择。」' }, next: null },
      { label: '继续训练，靠冰敷和止痛贴撑着', desc: '保持竞技状态，风险极高。', risk: 'high', check: { attr: 'stamina', dc: 15, tag: '体能' }, effects: { attrs: { aim: 2, reaction: 1 }, special: { coachTrust: 8 }, res: { hand: -14, condition: -8 }, status: [{ id: 'wrist', name: '腕部劳损', tone: 'bad', desc: '枪法精度 -8，判定 -2', turns: 5, icon: 'med' }] }, failEffects: { res: { hand: -24, condition: -10 }, special: { coachTrust: 4 }, status: [{ id: 'wrist_bad', name: '陈旧性损伤', tone: 'bad', desc: '枪法精度 -14，高强度训练额外损耗手部健康', turns: 10, icon: 'med' }] }, result: { success: '你撑过了两周的高强度训练，数据没有下滑。只有你自己知道每次训练前要吃几片止痛药。', fail: '第十天，你在训练赛里点错了一次关键技能。阿坤看完片子后，只说了一句：「你该早点来。」' }, next: null },
      { label: '私下找外面的医生看看', desc: '花费金钱，换取更专业的诊断。', risk: 'normal', check: null, effects: { money: -8000, res: { hand: 10, condition: 3 }, special: { fame: 2 } }, result: { success: '私立医院的诊断更细致：早期腱鞘炎。医生给你做了一副定制的护具。' }, next: null }
    ];
    return baseScene('身体的信号', '队医室', lines, choices, 2);
  }

  function eventPatch() {
    const hero = U.pick(['夜露', '捷风', '雷兹', '索瓦', '幽影', '奇乐', '霓虹', '凯佑']);
    const lines = [
      { t: 'narr', text: '版本更新公告在凌晨发布。你最擅长的特工之一「' + hero + '」被削了 8% 的核心伤害。' },
      { t: 'sys', text: '<b>版本更新</b> · 特工池评价下降，需要重新适应。' }
    ];
    const choices = [
      { label: '立刻开始练版本新贵特工', desc: '版本适应判定，成功则特工池扩展。', risk: 'normal', check: { attr: 'insight', dc: 14, tag: '悟性' }, effects: { attrs: { insight: 1, aim: 1 }, special: { versionBonus: 8 }, res: { condition: -8 } }, failEffects: { attrs: { insight: 1 }, res: { condition: -10 } }, result: { success: '三天后你就把新特工打进了训练赛，教练直接把战术重心往你这边挪。', fail: '新特工的机制比你想象的复杂，练了两天还是打不出效果。' }, next: null },
      { label: '坚持老特工，用手感弥补数值', desc: '高风险：成功则建立个人风格。', risk: 'high', check: { attr: 'aim', dc: 16, tag: '对枪' }, effects: { attrs: { aim: 2, gameSense: 1 }, special: { coachTrust: 8, fanLoyalty: 6 }, res: { fans: 1 } }, failEffects: { attrs: { aim: -1 }, res: { condition: -8 }, special: { coachTrust: -6 } }, result: { success: '你硬是用削弱后的特工打穿了对手。赛后论坛开始逐帧分析你的架点。', fail: '数值差距不是靠意志能弥补的，你被对手的新特工压制了两张图。' }, next: null },
      { label: '找分析师一起做版本研究报告', desc: '安全路线，提升版本适应与教练信任。', risk: 'safe', check: null, effects: { special: { versionBonus: 10, coachTrust: 5 }, attrs: { gameSense: 1, insight: 1 }, res: { condition: -6 }, metrics: { vodReviews: 2 } }, result: { success: '你和分析师艾琳做出了这周全队唯一一份版本优先级列表，教练把它打印出来贴在了墙上。' }, next: null }
    ];
    return baseScene('版本更迭', '战术室', lines, choices, 1);
  }

  function eventFans() {
    const lines = [
      { t: 'narr', text: '基地门口的快递架上堆着三个箱子。是粉丝寄来的应援物，其中一个箱子里全是手写信。' },
      { t: 'narr', text: '你随手抽出一封：<b>「我今年高三。看你打比赛的时候我才觉得，努力是有意义的。」</b>' }
    ];
    const choices = [
      { label: '录一段视频回复粉丝', desc: '人气与粉丝忠诚提升。', risk: 'safe', check: null, effects: { res: { fans: 2, condition: 8 }, special: { fanLoyalty: 10, antiThreat: -4 } }, result: { success: '你把信读了一遍，录了一段三分钟的视频。发出去两小时后，评论区有四千条「加油」。' }, next: null },
      { label: '把这些信带回宿舍慢慢看', desc: '心态大幅恢复。', risk: 'safe', check: null, effects: { res: { condition: 12 }, special: { fanLoyalty: 6 } }, result: { success: '你在台灯下把信一封封看完，看到凌晨两点。第二天训练时，你觉得手比前几天稳。' }, next: null },
      { label: '交给俱乐部统一处理', desc: '省时但会被粉丝察觉冷淡。', risk: 'normal', check: null, effects: { res: { condition: 3 }, special: { fanLoyalty: -6, antiThreat: 3 } }, result: { success: '你让经理把信转交给了运营团队。三天后，超话里有人说「他从没回应过」。' }, next: null }
    ];
    return baseScene('应援', '基地快递架', lines, choices, 1);
  }

  /* ══════════ 自由行动 ══════════ */
  function classify(text) {
    const t = text.toLowerCase();
    let best = null, bestLen = 0;
    D.FREE_ACTIONS.forEach(function (f) {
      f.keys.forEach(function (k) {
        if (t.indexOf(k.toLowerCase()) >= 0 && k.length > bestLen) { best = f; bestLen = k.length; }
      });
    });
    return best;
  }

  /* 主动争取首发：直接进入上首发剧情（仅在替补身份下） */
  function wantsPromotion(text) {
    const s = String(text || '');
    return promotionReady() && /(首发|上场|主力|顶替|名额|轮换|位置)/.test(s) && /(争取|要|抢|要求|顶|进|上)/.test(s);
  }

  function freeAction(text) {
    if (aiOn()) return aiTurn(text);
    if (wantsPromotion(text)) {
      ES.state.pushLog(S, 'action', '主动争取首发：' + text);
      return promotionScene(true);
    }
    if (busy || !text || !String(text).trim()) {
      if (!String(text || '').trim()) {
        U.toast({ tone: 'warn', title: '请输入你的行动', msg: '例如：「加练三小时靶场」「约队友吃饭」「开直播回应质疑」' });
        U.$('#input-free-action').focus();
      }
      return;
    }
    const raw = String(text).trim();
    U.$('#input-free-action').value = '';
    busy = true;
    disableChoices(true);
    const host = U.$('#story-scroll');
    const echo = document.createElement('div');
    echo.className = 'chosen-line';
    echo.innerHTML = U.icon('send', 'icon-sm') + '<span>自由行动：<b>' + U.esc(raw) + '</b></span>';
    host.appendChild(echo);
    scrollBottom();
    setGen('推演中 · 正在理解你的行动', true);

    const cat = classify(raw);
    const action = cat || {
      id: 'custom', name: '自定义行动', icon: 'terminal',
      check: { attr: 'gameSense', dc: 13, tag: '临场判断' },
      effects: { res: { condition: 3 }, attrs: { mentality: 1 } },
      prose: {
        success: '你按自己的想法做完了这件事。结果谈不上惊天动地，但它确实改变了点什么——至少改变了你自己的状态。',
        fail: '事情没做成。你花了时间和体力，却只换来一个教训。'
      }
    };

    setTimeout(function () {
      /* 动作理解模拟 */
      const interpret = composeInterpretation(raw, action);
      appendBlocks([{ t: 'narr', text: interpret }]).then(function () {
        const spec = action.check ? Object.assign({}, action.check, { dc: action.check.dc }) : null;
        const flow = spec ? rollCheck(spec).then(function (res) { setGen('判定中 · ' + res.attrName, true); return showDiceDialog(res).then(function () { return res; }); }) : Promise.resolve(null);
        flow.then(function (res) {
          let effects = JSON.parse(JSON.stringify(action.effects || {}));
          let text = action.prose.success;
          if (res) {
            if (res.verdict === 'crit') {
              effects = mergeEffects(effects, null);
              text = (action.prose.crit || action.prose.success) + ' 结果比你预期的最好情况还要好。';
            } else if (res.verdict === 'narrow') {
              effects = soften(effects);
              text = action.prose.success + ' 但代价比想象中更大。';
            } else if (res.verdict === 'fail' || res.verdict === 'critfail') {
              effects = invert(effects);
              text = (action.prose.fail || '事情没有成功。') + (res.verdict === 'critfail' ? ' 而且留下了不小的后患。' : '');
            }
            if (res.verdict === 'fail' || res.verdict === 'critfail') consecutiveFail++; else consecutiveFail = 0;
            ES.state.pushLog(S, 'action', '【' + res.label + '】自由行动：' + raw);
          } else {
            ES.state.pushLog(S, 'action', '自由行动：' + raw);
          }
          setGen('结算中 · 正在写入履历', true);
          const blocks = [{ t: 'narr', text: text }];
          if (res) blocks.push({ t: 'sys', text: '<b>行动判定</b> · ' + res.attrName + ' · ' + res.label + (res.dice === 100 ? '（1d100 = ' + res.roll + ' / 成功率 ' + res.dc + '%）' : '（' + res.roll + ' + ' + Math.round(res.attrMod) + ' − ' + (res.opp || 0) + ' = ' + Math.round(res.total) + ' / 成功线 ' + res.dc + '）') });
          return appendBlocks(blocks).then(function () {
            applyEffects(effects);
            /* 天赋方向一致性：共鸣加成 */
            const dir = directionOfAction(action.id);
            const match = (S.talents || []).filter(function (tl) { return tl.direction === dir; })[0];
            if (match && S.attrs[dir] !== undefined) {
              S.attrs[dir] = U.clamp(S.attrs[dir] + 1, 1, S.special.cap || 85);
              U.toast({ tone: 'info', icon: 'dna', title: '天赋契合 · ' + match.name, msg: '你的行动与天赋方向一致：' + ES.state.labelOf(dir) + ' +1', duration: 3600 });
            }
            endTurn(U.randInt(1, 2));
            setGen('待命', false);
            if (U.rng() < 0.45) return randomInterlude();
            return renderChoices(current ? current.choices : []);
          });
        });
      }).then(function () {
        busy = false; disableChoices(false);
      }).catch(function (err) {
        console.warn(err);
        busy = false; disableChoices(false); setGen('待命', false);
        U.toast({ tone: 'error', title: '推演异常', msg: '引擎未能完成本次自由行动推演。' });
      });
    }, 420);
  }

  function directionOfAction(id) {
    return {
      aim: 'aim', reaction: 'reaction', movement: 'movement', gameSense: 'gameSense', mentality: 'mentality',
      stamina: 'stamina', comms: 'comms', charisma: 'charisma', insight: 'insight', luck: 'luck'
    }[id] || null;
  }

  function composeInterpretation(raw, action) {
    const tpl = [
      '你决定「' + U.esc(raw) + '」。叙事引擎解析你的意图：<b>' + U.esc(action.name) + '</b>。',
      '你把想法说出口，或者只是在心里做了决定。基地里的人各忙各的，没有人特别注意你——直到结果出现。',
      '接下来的一段时间，这件事占用了你的精力与体力。'
    ];
    return tpl.join('');
  }

  /* ══════════ 快速比赛（不打开直播界面时的后台推演） ══════════ */
  function simulateQuickMatch(opts) {
    const pool = D.CLUBS.filter(function (o) { return o.id !== (S.club ? S.club.id : ''); });
    const opp = (opts && opts.opponent) || U.pick(pool);
    const bond = ES.state.bondOf(S);
    const myPower = (ES.state.ovr(S) - 60) * 1.2 + (S.club ? (S.club.form - 50) * 0.15 : 0) + bond.level.bonus * 100 + (S.special.coachTrust - 50) * 0.1;
    const oppPower = (opp.tier === 'T0' ? 22 : opp.tier === 'T1' ? 12 : 4) + U.randInt(-6, 6);
    const mod = U.clamp(Math.round((myPower - oppPower) / 5), -5, 5);
    const roll = U.randInt(1, 20);
    let win = roll + mod >= 10;
    if (Math.abs(myPower - oppPower) > 40 && roll === 20) win = true;
    if (Math.abs(myPower - oppPower) > 40 && roll === 1) win = false;
    const k = U.randInt(8, 24), d = U.randInt(6, 18), a = U.randInt(2, 8);
    S.stats.matches++; if (win) S.stats.wins++; else S.stats.losses++;
    S.stats.kills += k; S.stats.deaths += d; S.stats.assists += a;
    S.stats.bestKills = Math.max(S.stats.bestKills, k);
    if (S.club) {
      S.club.wins += win ? 1 : 0; S.club.losses += win ? 0 : 1;
      S.club.rank = U.clamp(S.club.rank + (win ? -1 : 1), 1, 12);
      S.club.form = U.clamp(S.club.form + (win ? 6 : -6), 0, 100);
      S.club.bond = U.clamp((S.club.bond || 0) + (win ? 2 : -1), 0, 100);
    }
    return { win: win, opp: opp, roll: roll, mod: mod, k: k, d: d, a: a };
  }

  /* ══════════ 结算回执 ══════════ */
  function renderAftermath(win, live, kda) {
    const me = live.myTeam[0];
    const d = ES.state.ovrDetail(S);
    const blocks = [
      { t: 'broadcast', text: '<b>对局结束</b> · ' + (S.club ? S.club.short : '无队') + ' vs ' + live.opp.short + ' · ' + (win ? '胜利' : '失利') + ' · ' + S.profile.tag + ' ' + kda },
      { t: 'narr', text: win
        ? '你在选手席上摘下耳机，场馆的声音涌进来。队友在语音里喊你的名字，教练在场边握紧了拳头。'
        : '你盯着结算界面看了很久。对面的人已经起身去握手了，你才慢慢把耳机取下来。' },
      { t: 'sys', text: '<b>本图数据</b> · K/D/A ' + me.k + '/' + me.d + '/' + me.a + ' · ACS ' + me.acs + ' · 首杀 ' + me.fk + ' · 残局 ' + me.clutch },
      { t: 'sys', text: '<b>总评</b> ' + d.total + '（' + d.level.name + '）· 位置 ' + d.pos.name + ' · 关键属性 ' + d.keyVals.join('/') + ' · 等级门槛 ' + (ES.state.nextLevel(d.total) || '已满') }
    ];
    appendBlocks(blocks);
  }

  function afterSettle(win, info) {
    setGen('待命', false);
    endTurn(1);
    const opp = (info && info.opponent) ? info.opponent : { name: '对手', short: 'OPP' };
    const blocks = [
      { t: 'narr', text: win
        ? '回到休息室，' + (S.club ? S.club.name : '俱乐部') + '的工作人员在门口等着。有人递水，有人拍你的肩。赛后的采访区已经排好了队。'
        : '休息室里很安静。你坐在角落，把护腕解下来又戴上。教练走过来，只说了一句：「明天九点，复盘。」' }
    ];
    appendBlocks(blocks).then(function () {
      return randomInterlude();
    });
  }

  /* ══════════ 继续推演按钮 ══════════ */
  function advance() {
    if (busy) return;
    if (pendingReveal) { pendingReveal.skip(); return; }
    ES.audio.play('click');
    randomInterlude();
  }

  /* ══════════ 结局 ══════════ */
  function finishCareer() {
    const ending = ES.state.endingTitle(S);
    const ev = ES.state.evaluation(S);
    S.flags.ended = true;
    const blocks = [
      { t: 'chapter', text: '生涯终章 · ' + ending.t },
      { t: 'narr', text: ending.d },
      { t: 'sys', text: '<b>最终评估</b> · 荣誉 ' + ev.honor + ' · 财务 ' + ev.money + ' · 健康 ' + ev.health + ' · 关系 ' + ev.mood + ' · 舆论 ' + ev.press + ' · 综合 ' + ev.total + ' / 100' },
      { t: 'narr', text: '你把手从键盘上拿开。窗外天快亮了，训练室的灯还亮着——总有下一批人会坐在这里，做着和你当年一样的梦。' }
    ];
    appendBlocks(blocks).then(function () {
      renderChoices([
        { label: '回到建档界面，开始新的人生', desc: '保留成就记录，重新创建角色。', risk: 'safe', check: null, effects: {}, result: { success: '' }, next: '__restart__' },
        { label: '继续留在这个存档（观察模式）', desc: '保留存档，随时可以继续查看面板。', risk: 'safe', check: null, effects: {}, result: { success: '' }, next: '__stay__' }
      ]);
      setGen('生涯结束', false);
      U.toast({ tone: 'gold', icon: 'trophy', title: '生涯结局 · ' + ending.t, msg: '综合评估 ' + ev.total + ' / 100。', duration: 9000 });
      current.choices[0].next = null;
      current.choices[1].next = null;
      /* 绑定即席处理 */
      U.$$('#choice-list .choice').forEach(function (btn, i) {
        btn.onclick = function () {
          if (i === 0) { ES.app.gotoCreator(); }
          else { U.toast({ tone: 'info', title: '已保留存档', msg: '你可以继续浏览面板、查看履历，或开始新的人生。' }); }
        };
      });
    });
  }

  /* ══════════ 初始化与入口 ══════════ */
  function bind(state) {
    S = state;
    consecutiveFail = 0;
    busy = false;
    current = null;
    U.$('#story-scroll').innerHTML = '';
  }

  function start() {
    refreshEngineTag();
    resetAiSession();
    if (!S) return;
    const nodeId = S.scene.nodeId || 'ch1_tryout';
    const openingChoice = S.scene.openingChoice;
    /* 若从建档进入，先播放导语，再执行开局选项 */
    if (S.flags.pendingOpening && !window.__DEV_NO_OPENING) {
      S.flags.pendingOpening = false;
      const node = D.SCENES[nodeId] || D.SCENES.ch1_tryout;
      setChapter(node.chapter);
      setSceneTag(node.scene);
      setGen('生成开局', true);
      appendBlocks([{ t: 'chapter', text: '序幕 · ' + node.chapter.name }].concat(node.lines)).then(function () {
        if (openingChoice !== null && openingChoice !== undefined && node.choices[openingChoice]) {
          current = { id: nodeId, chapter: node.chapter, scene: node.scene, choices: node.choices, days: node.days, next: null };
          setGen('待命', false);
          choose(openingChoice);
        } else {
          renderNode(nodeId);
        }
      });
      return;
    }
    renderNode(nodeId);
  }

  function bindFreeInput() {
    const input = U.$('#input-free-action'), btn = U.$('#btn-free-action');
    /* 静态元素，只在首次绑一次，避免重开一局后重复提交 */
    if (!btn || btn.__esBound) return;
    btn.__esBound = true;
    if (btn) btn.addEventListener('click', function () { freeAction(input.value); });
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); freeAction(input.value); }
    });
  }

  return {
    bind: bind, start: start, choose: choose, freeAction: freeAction, advance: advance,
    composeOpening: composeOpening, applyEffects: applyEffects, renderAftermath: renderAftermath,
    afterSettle: afterSettle, banner: banner, bindFreeInput: bindFreeInput, randomInterlude: randomInterlude,
    setGen: setGen, get current() { return current; }, finishCareer: finishCareer,
    currentChoices: function () { return current ? (current.choices || []) : []; },
    aiOn: aiOn, aiTurn: aiTurn, engineName: engineName, refreshEngineTag: refreshEngineTag,
    resetAiSession: resetAiSession, setChoices: setChoices, parseOptionLine: parseOptionLine, optionLine: optionLine,
    buildStateDigest: buildStateDigest, buildWorldContext: buildWorldContext,
    promotionReady: promotionReady, promotionScene: promotionScene,
    busyNow: function () { return !!busy; },
    applyNode: function (id) { return renderNode(id); }
  };
})();
