window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   应用外壳：引导启动 / 屏幕切换 / 快捷键 / 设置 / 全局事件
   ═══════════════════════════════════════════════════════════════ */
ES.app = (function () {
  'use strict';
  const U = ES.util;

  let S = null;
  let screen = 'boot';
  let booted = false;
  let settings = {
    textSpeed: 62, storyLength: 'normal', temperature: 70, showRoll: true, pity: true,
    theme: 'harbor', motion: 'full', uiScale: 100, sfx: true, sfxDice: true, sfxNotify: true, volume: 45,
    autosave: true, dashDesktop: false
  };

  /* ══════════ 设置应用 ══════════ */
  function applySettings(persist) {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-motion', settings.motion);
    root.style.fontSize = (16 * (settings.uiScale / 100)) + 'px';
    document.body.style.zoom = '';
    ES.audio.setEnabled(settings.sfx);
    ES.audio.setCategory('dice', settings.sfxDice);
    ES.audio.setCategory('notify', settings.sfxNotify);
    ES.audio.setVolume(settings.volume / 100);
    if (S) Object.assign(S.settings, settings);
    if (persist !== false) ES.state.saveSettings(settings);
    syncSettingsUI();
  }
  function syncSettingsUI() {
    const set = function (sel, v, prop) {
      const n = U.$(sel); if (!n) return;
      if (prop === 'checked') n.checked = v; else n.value = v;
    };
    set('#range-text-speed', settings.textSpeed); U.$('#val-text-speed') && (U.$('#val-text-speed').textContent = settings.textSpeed);
    set('#select-story-length', settings.storyLength);
    set('#range-temperature', settings.temperature); U.$('#val-temperature') && (U.$('#val-temperature').textContent = (settings.temperature / 100).toFixed(2));
    set('#switch-show-roll', settings.showRoll, 'checked');
    set('#switch-pity', settings.pity, 'checked');
    set('#range-ui-scale', settings.uiScale); U.$('#val-ui-scale') && (U.$('#val-ui-scale').textContent = settings.uiScale + '%');
    set('#switch-sfx', settings.sfx, 'checked');
    set('#switch-sfx-dice', settings.sfxDice, 'checked');
    set('#switch-sfx-notify', settings.sfxNotify, 'checked');
    set('#range-volume', settings.volume); U.$('#val-volume') && (U.$('#val-volume').textContent = settings.volume);
    set('#switch-autosave', settings.autosave, 'checked');
    set('#switch-dash-desktop', settings.dashDesktop, 'checked');
    U.$$('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === settings.theme ? 'true' : 'false'); });
    U.$$('[data-motion-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-motion-set') === settings.motion ? 'true' : 'false'); });
  }

  function bindSettings() {
    U.$('#range-text-speed').addEventListener('input', function (e) { settings.textSpeed = +e.target.value; U.$('#val-text-speed').textContent = settings.textSpeed; applySettings(); });
    U.$('#select-story-length').addEventListener('change', function (e) { settings.storyLength = e.target.value; applySettings(); });
    U.$('#range-temperature').addEventListener('input', function (e) { settings.temperature = +e.target.value; U.$('#val-temperature').textContent = (settings.temperature / 100).toFixed(2); applySettings(); });
    U.$('#switch-show-roll').addEventListener('change', function (e) { settings.showRoll = e.target.checked; applySettings(); });
    U.$('#switch-pity').addEventListener('change', function (e) { settings.pity = e.target.checked; applySettings(); });
    U.$('#range-ui-scale').addEventListener('input', function (e) { settings.uiScale = +e.target.value; U.$('#val-ui-scale').textContent = settings.uiScale + '%'; applySettings(); });
    U.$('#switch-sfx').addEventListener('change', function (e) { settings.sfx = e.target.checked; applySettings(); ES.audio.play('notify'); });
    U.$('#switch-sfx-dice').addEventListener('change', function (e) { settings.sfxDice = e.target.checked; applySettings(); });
    U.$('#switch-sfx-notify').addEventListener('change', function (e) { settings.sfxNotify = e.target.checked; applySettings(); });
    U.$('#range-volume').addEventListener('input', function (e) { settings.volume = +e.target.value; U.$('#val-volume').textContent = settings.volume; applySettings(); });
    U.$('#switch-autosave').addEventListener('change', function (e) { settings.autosave = e.target.checked; applySettings(); });
    U.$('#switch-dash-desktop').addEventListener('change', function (e) { settings.dashDesktop = e.target.checked; applySettings(); toggleDashboard(!settings.dashDesktop ? false : U.$('#dashboard').classList.contains('is-open')); });
    U.$('#theme-picker').addEventListener('click', function (e) {
      const b = e.target.closest('[data-theme-set]'); if (!b) return;
      settings.theme = b.getAttribute('data-theme-set');
      applySettings();
      ES.audio.play('tab');
      U.toast({ tone: 'info', icon: 'palette', title: '主题已切换', msg: '当前主题：' + b.textContent.trim() });
    });
    U.$('#motion-picker').addEventListener('click', function (e) {
      const b = e.target.closest('[data-motion-set]'); if (!b) return;
      settings.motion = b.getAttribute('data-motion-set');
      applySettings();
      ES.audio.play('tab');
      U.toast({ tone: 'info', icon: 'bolt', title: '动效强度：' + b.textContent.trim(), msg: settings.motion === 'reduced' ? '已关闭背景光晕与大部分过渡动画。' : '已恢复完整动效。' });
    });
    U.$('#btn-settings-restore').addEventListener('click', function () {
      U.confirmDialog({ title: '恢复默认设置', message: '所有界面与叙事引擎参数将回到初始值，存档不受影响。', okText: '恢复默认' }).then(function (ok) {
        if (!ok) return;
        settings = { textSpeed: 62, storyLength: 'normal', temperature: 70, showRoll: true, pity: true, theme: 'harbor', motion: 'full', uiScale: 100, sfx: true, sfxDice: true, sfxNotify: true, volume: 45, autosave: true, dashDesktop: false };
        applySettings();
        U.toast({ tone: 'success', title: '已恢复默认设置' });
      });
    });
    U.$('#btn-settings-open-saves').addEventListener('click', function () { U.closeModal('modal-settings'); openSaves(); });
    U.$('#btn-settings-reset-creator').addEventListener('click', function () {
      U.confirmDialog({ title: '重开一局', message: '将返回角色创建向导，当前进度若未保存将丢失。', okText: '返回建档' }).then(function (ok) {
        if (ok) { U.closeModal('modal-settings'); gotoCreator(); }
      });
    });
    U.$('#btn-settings-hard-reset').addEventListener('click', function () {
      U.confirmDialog({ title: '清空全部本地数据', sub: '不可恢复', message: '全部存档、设置与成就记录都会被删除。', okText: '确认清空', danger: true }).then(function (ok) {
        if (!ok) return;
        ES.state.wipe();
        U.closeModal('modal-settings');
        U.toast({ tone: 'error', title: '本地数据已清空', msg: '即将重新加载终端。' });
        setTimeout(function () { location.reload(); }, 1200);
      });
    });
  }

  /* ══════════ 引导启动 ══════════ */
  function boot() {
    const logs = U.$$('#boot-log .boot-line');
    logs.forEach(function (l, i) {
      l.style.animationDelay = (0.12 + i * 0.16) + 's';
    });
    let pct = 0;
    const fill = U.$('#boot-progress-fill'), txt = U.$('#boot-progress-txt'), bar = U.$('#boot-progressbar');
    const readout = U.$('#boot-readout');
    const hexes = ['0x1A2F', '0x3B7C', '0x5E01', '0x9D44', '0xC1A8', '0xE7F3', '0xFF20'];
    const iv = setInterval(function () {
      pct = Math.min(100, pct + (2 + Math.random() * 7));
      fill.style.width = pct + '%';
      txt.textContent = Math.round(pct) + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
      readout.textContent = hexes[Math.floor(Math.random() * hexes.length)] + ' · ' + (pct < 40 ? '载入叙事权重矩阵' : pct < 70 ? '校验选手档案库' : pct < 95 ? '同步赛季时间线' : '终端就绪');
      if (pct >= 100) {
        clearInterval(iv);
        readout.textContent = '0xFF20 · 终端就绪 · 等待身份确认';
        const btn = U.$('#btn-boot-enter');
        btn.disabled = false;
        btn.focus();
      }
    }, 90);

    const enter = function () {
      if (!booted) return;
      ES.audio.unlock();
      ES.audio.play('open');
      const auto = ES.state.listSlots().auto;
      if (auto && auto.state) {
        U.confirmDialog({
          title: '检测到自动存档', sub: ES.state.summaryLabel(auto.state),
          body: '<div class="alert" data-tone="cyan">' + U.icon('save') + '<div>上次游玩：' + U.esc(auto.state.profile.name) + '（' + U.esc(auto.state.profile.tag) + '）· ' + U.esc(auto.state.time.phase) + ' · 回合 ' + auto.state.time.turn + '<br><span class="dim">保存于 ' + new Date(auto.savedAt).toLocaleString('zh-CN') + '</span></div></div>' +
            '<div class="alert" data-tone="dim" style="margin-top:8px">' + U.icon('info') + '<div>选择「继续生涯」读取该存档，或选择「新建角色」进入建档向导。</div></div>',
          okText: '继续生涯', icon: 'save'
        }).then(function (ok) {
          if (ok) startGame(JSON.parse(JSON.stringify(auto.state)), false);
          else gotoCreator();
        });
      } else {
        gotoCreator();
      }
    };
    U.$('#btn-boot-enter').addEventListener('click', enter);
    const onKey = function (e) {
      if (screen !== 'boot') return;
      if (U.$('#btn-boot-enter').disabled) return;
      if (e.key === 'Tab') return;
      document.removeEventListener('keydown', onKey);
      enter();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', function () { if (screen === 'boot' && booted && !U.$('#btn-boot-enter').disabled) { /* 等待按钮 */ } });
    setTimeout(function () { booted = true; }, 1800);
  }

  /* ══════════ 屏幕切换 ══════════ */
  function showScreen(name) {
    const screens = { boot: '#screen-boot', creator: '#screen-creator', main: '#screen-main' };
    Object.keys(screens).forEach(function (k) {
      const node = U.$(screens[k]);
      if (!node) return;
      if (k === name) {
        node.classList.add('is-active');
        node.classList.remove('is-leaving');
      } else {
        node.classList.remove('is-active');
      }
    });
    screen = name;
    U.$('#app').setAttribute('data-screen', name);
    U.announce(name === 'creator' ? '进入角色创建向导' : name === 'main' ? '进入主界面' : '终端启动');
  }

  function setUiMode(mode) {
    if (!ES.tavern) return;
    ES.tavern.setMode(mode);
    const screen = U.$('#screen-main');
    if (screen) screen.setAttribute('data-ui', mode);
    const lbl = U.$('#ui-mode-label');
    if (lbl) lbl.textContent = mode === 'tavern' ? '叙事模式' : '酒馆模式';
    const panel = U.$('#tavern-panel');
    if (panel) panel.classList.toggle('hidden', mode !== 'tavern');
    U.toast({ tone: 'info', icon: 'message', title: mode === 'tavern' ? '已进入酒馆模式' : '已回到叙事模式',
      msg: mode === 'tavern' ? '楼层流 · 世界书注入 · 变量快照回溯 · 标签流式解析' : '经典叙事区与抉择列表。', duration: 3200 });
  }
  function toggleUiMode() {
    const cur = (ES.tavern && ES.tavern.uiMode) || 'narrative';
    setUiMode(cur === 'tavern' ? 'narrative' : 'tavern');
  }

  function openCheat() {    if (!S || !S.cheat) {
      U.toast({ tone: 'warn', title: '当前不是作弊模式', msg: '作弊模式需在角色创建时选择。' });
      return;
    }
    ES.panels.renderCheat();
    U.openModal('modal-cheat');
  }

  function gotoCreator() {
    showScreen('creator');
    ES.creator.mount();
    document.documentElement.setAttribute('data-ready', '1');
  }

  function startGame(state, isNew) {
    S = state;
    if (ES.state.migrate) ES.state.migrate(state);
    /* 合并设置 */
    Object.keys(settings).forEach(function (k) {
      if (state.settings && state.settings[k] !== undefined) settings[k] = state.settings[k];
    });
    applySettings(false);
    if (isNew) {
      ES.state.saveSlot('auto', state);
      U.toast({ tone: 'gold', icon: 'medal', title: '建档完成 · ' + state.profile.name, msg: '欢迎来到巅峰回廊。你的每一个抉择都会被记住。', duration: 8000 });
      ES.audio.play('levelup');
    }
    showScreen('main');
    ES.broadcast.setState(state);
    if (ES.tavern) ES.tavern.mount(state);
    ES.broadcast.mount(state);
    ES.broadcast.bindOrderClicks();
    ES.saves.bind(state);
    ES.panels.bind(state);
    ES.narrative.bind(state);
    ES.narrative.bindFreeInput();
    ES.panels.updateTopbar();
    syncCheatEntry();
    ES.panels.renderRail();
    ES.panels.renderTicker();
    ES.narrative.start();
    restartCursorAura();
  }

  function syncCheatEntry() {
    const b = U.$('#btn-cheat-menu');
    if (b) b.classList.toggle('hidden', !(S && S.cheat));
  }

  function refreshUI() {
    if (!S) return;
    ES.panels.updateTopbar();
    syncCheatEntry();
    ES.panels.renderRail();
    ES.panels.renderPanes();
    ES.panels.renderTicker();
  }

  function restartCursorAura() {
    U.initCursorAura();
  }

  /* ══════════ 看板抽屉 ══════════ */
  function toggleDashboard(force) {
    const d = U.$('#dashboard');
    if (!d) return;
    const open = force === undefined ? !d.classList.contains('is-open') : force;
    d.classList.toggle('is-open', open);
    U.$('#btn-toggle-dashboard').classList.toggle('is-active', open);
  }

  /* ══════════ 模态打开器 ══════════ */
  function openBoard() { ES.panels.renderBoard(); U.openModal('modal-board'); }
  function openDossier() { ES.panels.renderDossier(); U.openModal('modal-dossier'); }
  function openSaves() { ES.saves.render(); U.openModal('modal-saves'); }
  function openQuests() { ES.panels.renderQuests(); U.openModal('modal-quests'); }
  function openAchievements() { ES.panels.renderAchievements(); U.openModal('modal-achievements'); }
  function openNews() { ES.panels.renderNews(); U.openModal('modal-news'); }
  function openContract() { ES.panels.renderContract(); U.openModal('modal-contract'); }
  function openRomance() { ES.panels.renderRomance(); U.openModal('modal-romance'); }
  function openSchedule() { ES.panels.renderSchedule(); U.openModal('modal-schedule'); }
  function openCalendar() { ES.panels.renderCalendar(); U.openModal('modal-calendar'); }
  function openMedia() { ES.panels.renderMedia(); U.openModal('modal-media'); }
  function openBroadcast() { ES.broadcast.open({ fresh: !ES.broadcast.current() || ES.broadcast.current().ended }); }
  function openTalent() { ES.panels.renderTalentModal(); U.openModal('modal-talent'); }

  /* ══════════ 全局委托 ══════════ */
  function bindGlobal() {
    /* 关闭按钮 */
    document.addEventListener('click', function (e) {
      const closer = e.target.closest && e.target.closest('[data-close]');
      if (closer) {
        ES.audio.play('close');
        U.closeModal(closer.getAttribute('data-close'));
      }
      const opener = e.target.closest && e.target.closest('[data-open]');
      if (opener) {
        ES.audio.play('click');
        const id = opener.getAttribute('data-open');
        switch (id) {
          case 'modal-dossier': openDossier(); break;
          case 'modal-board': openBoard(); break;
          case 'modal-saves': openSaves(); break;
          case 'modal-quests': openQuests(); break;
          case 'modal-achievements': openAchievements(); break;
          case 'modal-news': openNews(); break;
          case 'modal-contract': openContract(); break;
          case 'modal-romance': openRomance(); break;
          case 'modal-schedule': openSchedule(); break;
          case 'modal-calendar': openCalendar(); break;
          case 'modal-media': openMedia(); break;
          case 'modal-broadcast': openBroadcast(); break;
          case 'modal-talent': openTalent(); break;
          default: U.openModal(id);
        }
      }
      const free = e.target.closest && e.target.closest('[data-free]');
      if (free) {
        const text = free.getAttribute('data-free');
        if (U.$('#modal-npc').classList.contains('is-open')) U.closeModal('modal-npc');
        if (U.$('#modal-romance').classList.contains('is-open')) U.closeModal('modal-romance');
        U.$('#input-free-action').value = text;
        if (screen !== 'main') { U.toast({ tone: 'warn', title: '尚未进入赛场', msg: '完成建档后即可执行自由行动。' }); return; }
        ES.narrative.freeAction(text);
      }
      const npc = e.target.closest && e.target.closest('[data-npc]');
      if (npc) { ES.audio.play('click'); ES.panels.renderNpc(npc.getAttribute('data-npc')); }
      const news = e.target.closest && e.target.closest('[data-news]');
      if (news) {
        ES.panels.selectNews(news.getAttribute('data-news'));
        if (!U.$('#modal-news').classList.contains('is-open')) openNews();
      }
      const mt = e.target.closest && e.target.closest('[data-mtab]');
      if (mt) ES.audio.play('tab');
    });

    /* 顶部与底部工具按钮 */
    const map = {
      '#btn-open-board': openBoard, '#btn-open-dossier': openDossier, '#btn-open-saves': openSaves,
      '#btn-open-saves-top': openSaves, '#btn-open-calendar': openCalendar, '#btn-open-broadcast': openBroadcast,
      '#btn-open-help': function () { U.openModal('modal-help'); },
      '#btn-ui-mode': toggleUiMode,
      '#btn-open-api': function () { if (ES.tavern) ES.tavern.openApi(); },
      '#btn-cheat-menu': openCheat,
      '#btn-open-help-bottom': function () { U.openModal('modal-help'); },
      '#btn-open-settings': function () { syncSettingsUI(); U.openModal('modal-settings'); },
      '#btn-open-quests': openQuests, '#btn-open-training': openSchedule, '#btn-open-media': openMedia,
      '#btn-dossier-to-board': function () { U.closeModal('modal-dossier'); openBoard(); },
      '#btn-dash-collapse': function () { toggleDashboard(false); },
      '#btn-toggle-dashboard': function () { toggleDashboard(); },
      '#btn-continue': function () { ES.narrative.advance(); },
      '#btn-skip-typing': function () { ES.narrative.advance(); },
      '#btn-scroll-bottom': function () { const sc = U.$('#story-scroll'); sc.scrollTop = sc.scrollHeight; }
    };
    Object.keys(map).forEach(function (sel) {
      const node = U.$(sel);
      if (node) node.addEventListener('click', function () { ES.audio.play('click'); map[sel](); });
    });

    /* 模态内部标签 */
    U.$$('[data-news-filter]').forEach(function (t) {
      t.addEventListener('click', function () { ES.panels.setNewsFilter(t.getAttribute('data-news-filter')); });
    });
    U.$$('[data-quest-filter]').forEach(function (t) {
      t.addEventListener('click', function () { ES.panels.setQuestFilter(t.getAttribute('data-quest-filter')); });
    });
    U.$$('[data-ach-filter]').forEach(function (t) {
      t.addEventListener('click', function () { ES.panels.setAchFilter(t.getAttribute('data-ach-filter')); });
    });
    U.$$('[data-media-tab]').forEach(function (t) {
      t.addEventListener('click', function () { ES.panels.setMediaTab(t.getAttribute('data-media-tab')); });
    });
    U.$('#cheat-menu-body').addEventListener('click', function (e) {
      const b = e.target.closest('[data-cheat]');
      if (!b) return;
      ES.audio.play('success');
      ES.panels.applyCheat(b.getAttribute('data-cheat'));
    });
    U.$('#btn-cal-prev').addEventListener('click', function () { ES.panels.shiftCal(-1); ES.audio.play('tab'); });
    U.$('#btn-cal-next').addEventListener('click', function () { ES.panels.shiftCal(1); ES.audio.play('tab'); });
    U.$('#btn-schedule-preset').addEventListener('click', function () { ES.panels.applyPreset(); ES.audio.play('click'); U.toast({ tone: 'info', title: '已套用推荐日程', msg: '教练组推荐的标准训练配置。' }); });
    U.$('#btn-schedule-submit').addEventListener('click', function () {
      const t = ES.panels.scheduleTotals();
      const total = Object.keys(t.res).length + Object.keys(t.attrs).length;
      U.closeModal('modal-schedule');
      const blocks = [];
      ES.state.pushLog(S, 'schedule', '提交本周日程：训练时长 ' + Object.keys(ES.panels.scheduleValues()).reduce(function (a, k) { return a + ES.panels.scheduleValues()[k]; }, 0) + ' 小时');
      ES.narrative.applyEffects({
        attrs: roundMap(t.attrs), special: roundMap(t.special), res: roundMap(t.res), money: Math.round(t.money)
      });
      ES.narrative.banner({ title: '日程已提交', text: '教练组已收到你的周计划，明天开始按新节奏执行。', tone: 'good', icon: 'check' });
      U.toast({ tone: 'success', icon: 'clock', title: '日程规划完成', msg: '本周训练计划已生效，属性成长已结算。' });
      ES.narrative.advance();
    });
    U.$('#btn-contract-renew').addEventListener('click', function () {
      U.closeModal('modal-contract');
      ES.narrative.freeAction('要求经纪人与俱乐部开启续约谈判，争取更好的薪资与奖金条款');
    });
    U.$('#btn-dossier-export').addEventListener('click', function () {
      const text = JSON.stringify(S, null, 1);
      try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
      U.$('#textarea-saves-data').value = text.length > 200000 ? text.slice(0, 200000) : text;
      openSaves();
      U.toast({ tone: 'success', title: '档案已导出', msg: '完整档案 JSON 已复制并写入存档数据框。' });
    });

    /* 选择光标移动时提示音 */
    document.addEventListener('mouseover', function (e) {
      const t = e.target.closest && e.target.closest('.btn, .choice, .chip, .lrow, .card, .tab');
      if (t && t.__hoverSound !== 1) {
        t.__hoverSound = 1;
        setTimeout(function () { t.__hoverSound = 0; }, 240);
        ES.audio.play('hover');
      }
    });
  }

  function roundMap(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(function (k) {
      const v = obj[k];
      out[k] = Math.abs(v) < 1 ? (v > 0 ? 1 : -1) : Math.round(v);
    });
    return out;
  }

  /* ══════════ 键盘 ══════════ */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      const tag = (e.target.tagName || '').toUpperCase();
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      /* Esc 关闭浮层 */
      if (e.key === 'Escape') {
        if (U.topModal()) { e.preventDefault(); ES.audio.play('close'); U.closeModal(U.topModal().id); }
        else if (screen === 'main' && U.$('#dashboard').classList.contains('is-open')) toggleDashboard(false);
        return;
      }
      /* 浮层内的焦点陷阱 */
      if (e.key === 'Tab') {
        const modal = U.topModal();
        if (modal) {
          const focusables = U.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
          if (focusables.length) {
            const idx = focusables.indexOf(document.activeElement);
            const next = e.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1) : (idx >= focusables.length - 1 ? 0 : idx + 1);
            if (idx === -1 || next !== idx + 1 || e.shiftKey) { e.preventDefault(); focusables[next].focus(); }
          }
          return;
        }
      }
      if (typing) return;
      if (screen !== 'main') return;
      if (U.topModal()) {
        if (e.key === ' ' || e.key === 'Enter') {
          const btn = U.$('#modal-dice').classList.contains('is-open') ? U.$('#btn-dice-continue') : null;
          if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        }
        return;
      }
      /* 数字键选择 */
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const btn = U.$('#choice-list .choice[data-choice="' + idx + '"]');
        if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        return;
      }
      const k = e.key.toLowerCase();
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ES.narrative.advance(); }
      else if (k === 'tab') { e.preventDefault(); toggleDashboard(); }
      else if (k === 'd') { openDossier(); }
      else if (k === 'x') { openCheat(); }
      else if (k === 'v') { toggleUiMode(); }
      else if (k === 's') { openSaves(); }
      else if (k === 'b') { openBroadcast(); }
      else if (k === 'c') { openCalendar(); }
      else if (k === 't') { openSchedule(); }
      else if (k === 'm') { openMedia(); }
      else if (k === 'h' || k === '?') { U.openModal('modal-help'); }
      else if (k === ',' || k === '.') { syncSettingsUI(); U.openModal('modal-settings'); }
      else if (k === 'q') { openQuests(); }
      else if (k === 'a') { openAchievements(); }
      else if (k === 'n') { openNews(); }
      else if (k === '/') { e.preventDefault(); U.$('#input-free-action').focus(); }
    });
  }

  /* ══════════ 开发者深链（便于截图与联调：index.html#dev:main,dossier） ══════════ */
  function devDiag() {
    const grid = U.$('.hud-grid');
    const cs = grid ? getComputedStyle(grid) : null;
    const rail = U.$('#status-rail'), dash = U.$('#dashboard'), bar = U.$('#bottombar');
    const r = function (n) { return n ? Math.round(n.getBoundingClientRect().width) + 'x' + Math.round(n.getBoundingClientRect().height) : 'none'; };
    const info = [
      'viewport ' + window.innerWidth + 'x' + window.innerHeight + ' dpr=' + window.devicePixelRatio,
      'app ' + r(U.$('#app')) + ' display=' + getComputedStyle(U.$('#app')).display,
      'screen-main ' + r(U.$('#screen-main')) + ' display=' + getComputedStyle(U.$('#screen-main')).display +
        ' cols=' + getComputedStyle(U.$('#screen-main')).gridTemplateColumns,
      'topbar ' + r(U.$('#topbar')),
      'hud-grid ' + r(grid) + ' cols: ' + (cs ? cs.gridTemplateColumns : 'n/a') + ' kids=' + (grid ? grid.children.length : -1),
      'child ids: ' + (grid ? Array.prototype.map.call(grid.children, function (c) { return c.id || c.className; }).join(' | ') : ''),
      'narrative-col ' + r(U.$('#narrative-col')),
      'status-rail ' + r(rail) + ' children=' + (rail ? rail.children.length : -1),
      'dashboard ' + r(dash) + ' panes=' + (U.$$('#dash-panes .dash-pane').length),
      'bottombar ' + r(bar) + ' quick=' + (U.$$('#quick-choices .quick-choice').length),
      'choices ' + (U.$$('#choice-list .choice').length) + ' storyBlocks=' + (U.$$('#story-scroll > div').length)
    ];
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:12px;top:70px;z-index:9999;background:#000e;border:1px solid #2fe3d4;color:#9ff;font:12px/1.7 monospace;padding:10px 14px;white-space:pre;pointer-events:none';
    document.body.appendChild(box);
    const openIds = function () { return U.$$('.modal.is-open').map(function (m) { return m.id; }).join(',') || 'none'; };
    const tick = function () {
      const cur = ES.narrative.current;
      box.textContent = info.concat([
        't=' + Math.round(performance.now()) + 'ms  openModals=' + openIds(),
        'scene=' + (cur ? cur.id + ' choices=' + (cur.choices ? cur.choices.length : 0) : 'null') +
          ' choiceBtns=' + U.$$('#choice-list .choice').length + ' quick=' + U.$$('#quick-choices .quick-choice').length,
        'storyChildren=' + (U.$('#story-scroll') ? U.$('#story-scroll').children.length : -1) +
          ' scrollH=' + (U.$('#story-scroll') ? U.$('#story-scroll').scrollHeight : -1),
        'turn=' + (ES.app.state ? ES.app.state.time.turn : '-') + ' ovr=' + (ES.app.state ? ES.state.ovr(ES.app.state) : '-') +
          ' money=' + (ES.app.state ? Math.round(ES.app.state.res.money) : '-') + ' fame=' + (ES.app.state ? Math.round(ES.app.state.special.fame) : '-') + ' cond=' + (ES.app.state ? Math.round(ES.app.state.res.condition) : '-'),
        'lastText=' + (U.$('#story-scroll') ? (U.$('#story-scroll').textContent || '').slice(-60).replace(/\s+/g, ' ') : '')
      ]).join('\n');
    };
    tick();
    setInterval(tick, 400);
  }

  function devRoute() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (raw.indexOf('dev:') !== 0) return false;
    const parts = raw.slice(4).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const target = parts.shift() || 'creator';
    /* 深链覆盖：tl:<时间线> / cl:<俱乐部> / lg:<传奇选手> */
    parts.forEach(function (p) {
      if (p.indexOf('tl:') === 0) window.__DEV_TIMELINE = p.slice(3);
      if (p.indexOf('cl:') === 0) window.__DEV_CLUB = p.slice(3);
      if (p.indexOf('lg:') === 0) window.__DEV_LEGEND = p.slice(3);
      if (p.indexOf('md:') === 0) window.__DEV_MODE = p.slice(3);
    });
    if (target === 'creator') {
      gotoCreator();
    } else {
      window.__DEV_NO_OPENING = parts.length > 0;
      ES.creator.devFinish();
      window.__DEV_NO_OPENING = false;
      /* 截图/联调时关闭打字机，保证内容完整呈现 */
      settings.textSpeed = 0;
      if (S) S.settings.textSpeed = 0;
      applySettings(false);
    }
    setTimeout(function () {
      if (parts.indexOf('sim') >= 0) {
        const idx = parts.indexOf('sim');
        const n = parseInt(parts[idx + 1], 10);
        setTimeout(function () {
          ES.narrative.choose(isNaN(n) ? 0 : n);
          setTimeout(function () {
            const b = U.$('#btn-dice-continue');
            if (b && !b.disabled) b.click();
          }, 2400);
        }, 600);
      }
      if (parts.indexOf('simfree') >= 0) {
        setTimeout(function () { ES.narrative.freeAction('加练三小时靶场与身法，把手感找回来'); }, 600);
      }
      if (target === 'creator') {
        if (parts.indexOf('roll') >= 0) { ES.creator.devRoll(); return; }
        if (parts.indexOf('random') >= 0) { ES.creator.randomAll(); return; }
        const stepPart = parts.filter(function (p) { return /^step(1[01]|[1-9])$/.test(p); })[0];
        if (stepPart) {
          ES.creator.devPrep();
          ES.creator.goto(parseInt(stepPart.slice(4), 10));
        }
      }
    }, 800);
    if (parts.length) {
      setTimeout(function () {
        parts.forEach(function (p) {
          switch (p) {
            case 'dossier': openDossier(); break;
            case 'board': openBoard(); break;
            case 'saves': openSaves(); break;
            case 'settings': syncSettingsUI(); U.openModal('modal-settings'); break;
            case 'help': U.openModal('modal-help'); break;
            case 'news': openNews(); break;
            case 'quests': openQuests(); break;
            case 'achievements': openAchievements(); break;
            case 'contract': openContract(); break;
            case 'romance': openRomance(); break;
            case 'schedule': openSchedule(); break;
            case 'calendar': openCalendar(); break;
            case 'media': openMedia(); break;
            case 'broadcast': openBroadcast(); break;
            case 'tavern': setUiMode('tavern'); break;
            case 'api': setUiMode('tavern'); ES.tavern.openApi(); break;
            case 'promo':
              S.special.coachTrust = Math.max(S.special.coachTrust, 62);
              S.stats.choices = Math.max(S.stats.choices || 0, 6);
              S.flags.promotionOffered = false;
              setTimeout(function () { if (ES.narrative.promotionScene) ES.narrative.promotionScene(); }, 400);
              break;
            case 'squad': openContract(); setTimeout(function () { const b = U.$('[data-pane="contract-squad"]'); if (b) b.click(); }, 300); break;
            case 'clubpane': if (ES.panels.selectDash) ES.panels.selectDash('club'); break;
            case 'attrspane': if (ES.panels.selectDash) ES.panels.selectDash('attrs'); break;
            case 'dossierhist': openDossier(); setTimeout(function () { const b = U.$('[data-dtab="dossier-hist"]'); if (b) b.click(); }, 300); break;
            case 'narrative': setUiMode('narrative'); break;
            case 'tvbooks': setUiMode('tavern'); ES.tavern.openLorebook(); break;
            case 'tvpreset': setUiMode('tavern'); ES.tavern.openPreset(); break;
            case 'tvcard': setUiMode('tavern'); ES.tavern.openCard(); break;
            case 'tvctx': setUiMode('tavern'); ES.tavern.openContext(); break;
            case 'tvvars': setUiMode('tavern'); ES.tavern.openVars(); break;
              case 'tvchoice':
                setUiMode('tavern');
                setTimeout(function () { ES.tavern.chooseOption(0); }, 500);
              (function () {
                let n = 0;
                const iv = setInterval(function () {
                  const b = U.$('#btn-dice-continue');
                  if (b && !b.disabled && U.$('#modal-dice').classList.contains('is-open')) b.click();
                  if (++n > 26) clearInterval(iv);
                }, 700);
              })();
              break;
            case 'tvhistory': setUiMode('tavern'); ES.tavern.openHistory(); break;
            case 'tvsend':
              setUiMode('tavern');
              setTimeout(function () { ES.tavern.send('加练三小时靶场，把爆头线找回来'); }, 400);
              (function () {
                let n = 0;
                const iv = setInterval(function () {
                  const b = U.$('#btn-dice-continue');
                  if (b && !b.disabled && U.$('#modal-dice').classList.contains('is-open')) b.click();
                  if (++n > 26) clearInterval(iv);
                }, 700);
              })();
              break;
            case 'talent': openTalent(); break;
            case 'cheat':
              if (S && !S.cheat) {
                S.cheat = true; S.flags.cheatMode = true; S.difficulty = 'cheat'; S.difficultyName = '作弊模式';
              }
              syncCheatEntry();
              openCheat();
              break;
            case 'bcplay':
              openBroadcast();
              setTimeout(function () {
                const chip = U.$('#bc-orders [data-order]');
                if (chip) chip.click();
                setTimeout(function () { const b = U.$('#btn-bc-play'); if (b) b.click(); }, 320);
                setTimeout(function () { const tb = U.$('[data-pane="bc-pane-data"]'); if (tb) tb.click(); }, 26000);
              }, 420);
              break;
            case 'trait':
              setTimeout(function () {
                ES.creator.devPrep();
                ES.creator.goto(5);
                setTimeout(function () {
                  const chip = U.$('#chip-trait-calm');
                  if (chip) chip.click();
                  const chip2 = U.$('#chip-gender-女');
                  if (chip2) chip2.click();
                  const st = ES.creator.setup;
                  const box = document.createElement('div');
                  box.style.cssText = 'position:fixed;left:12px;bottom:14px;z-index:9999;background:#000e;border:1px solid #2fe3d4;color:#9ff;font:13px/1.7 monospace;padding:10px 14px;white-space:pre';
                  box.textContent = 'traits=' + JSON.stringify(st.traits) +
                    '\nchipPressed=' + (U.$('#chip-trait-calm') ? U.$('#chip-trait-calm').getAttribute('aria-pressed') : 'n/a') +
                    '\ngender=' + st.gender +
                    '\ngenderPressed=' + (U.$('#chip-gender-女') ? U.$('#chip-gender-女').getAttribute('aria-pressed') : 'n/a');
                  document.body.appendChild(box);
                }, 500);
              }, 200);
              break;
            case 'diag': devDiag(); break;
            default: break;
          }
        });
      }, 1100);
    }
    return true;
  }

  /* ══════════ 初始化 ══════════ */
  function init() {
    /* 载入全局设置 */
    const saved = ES.state.loadSettings();
    if (saved) settings = Object.assign(settings, saved);
    applySettings(false);

    U.initTooltips();
    U.initRipples();
    U.initTilt();
    U.initAccordions();
    U.initTabs();
    bindSettings();
    bindGlobal();
    bindKeyboard();
    ES.saves.bindStatic();
    document.documentElement.setAttribute('data-ready', '1');
    if (!devRoute()) boot();

    /* 首次交互解锁音频 */
    const unlock = function () { ES.audio.unlock(); document.removeEventListener('pointerdown', unlock); };
    document.addEventListener('pointerdown', unlock);

    /* 屏幕尺寸响应：窄屏默认收起看板 */
    const mq = window.matchMedia('(max-width: 1280px)');
    const onChange = function () {
      if (mq.matches) { toggleDashboard(false); U.$('#btn-toggle-dashboard').classList.add('u-breath'); }
      else U.$('#btn-toggle-dashboard').classList.remove('u-breath');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    onChange();

    /* 场景推演的 LLM 状态文本轮播 */
    setInterval(function () {
      if (screen !== 'main') return;
      const t = U.$('#gen-text');
      if (!t || t.textContent.indexOf('待命') < 0) return;
      const pool = ['待命 · 等待你的抉择', '待命 · 上下文已同步', '待命 · 叙事权重就绪', '待命 · 关系网已更新'];
      t.textContent = pool[Math.floor(Math.random() * pool.length)];
    }, 7000);
  }

  document.addEventListener('DOMContentLoaded', init);

  const api = {
    get currentScreen() { return screen; },
    get state() { return S; },
    get settings() { return settings; },
    startGame: startGame, gotoCreator: gotoCreator, refreshUI: refreshUI,
    openBoard: openBoard, openDossier: openDossier, openSaves: openSaves,
    openQuests: openQuests, openAchievements: openAchievements, openNews: openNews,
    openContract: openContract, openRomance: openRomance, openSchedule: openSchedule,
    openCalendar: openCalendar, openMedia: openMedia, openBroadcast: openBroadcast,
    toggleDashboard: toggleDashboard, applySettings: applySettings, previewState: null
  };
  ES.app = api;
  return api;
})();
