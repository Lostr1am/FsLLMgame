window.ES = window.ES || {};
/* ═══════════════════════════════════════════════════════════════
   存档层：槽位管理 / 导出导入 / 危险操作确认
   ═══════════════════════════════════════════════════════════════ */
ES.saves = (function () {
  'use strict';
  const U = ES.util;
  const SLOTS = [
    { id: 'auto', name: '自动存档', desc: '每次场景推进后自动写入，不可手动覆盖' },
    { id: 's1', name: '存档 01', desc: '手动存档槽位' },
    { id: 's2', name: '存档 02', desc: '手动存档槽位' },
    { id: 's3', name: '存档 03', desc: '手动存档槽位' },
    { id: 's4', name: '存档 04', desc: '手动存档槽位' },
    { id: 's5', name: '存档 05', desc: '手动存档槽位' },
    { id: 's6', name: '存档 06', desc: '手动存档槽位' }
  ];
  let S = null;

  function timeAgo(ts) {
    if (!ts) return '';
    const d = Date.now() - ts;
    if (d < 60000) return '刚刚';
    if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
    if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
    return Math.floor(d / 86400000) + ' 天前';
  }

  function render() {
    if (!S) return;
    const slots = ES.state.listSlots();
    U.$('#saves-usage').textContent = '占用 ' + ES.state.storageSize();
    U.$('#saves-list').innerHTML = SLOTS.map(function (slot) {
      const data = slots[slot.id];
      const st = data ? data.state : null;
      const isAuto = slot.id === 'auto';
      return '<div class="lrow" style="cursor:default;align-items:flex-start" data-slot="' + slot.id + '">' +
        '<span class="lrow-ava" style="color:' + (isAuto ? 'var(--gold)' : 'var(--accent)') + ';border-color:' + (isAuto ? 'var(--gold)' : 'var(--accent)') + '">' +
          U.icon(isAuto ? 'refresh' : 'save') + '</span>' +
        '<span class="lrow-main">' +
          '<span class="lrow-name">' + slot.name + (isAuto ? '<span class="tag" data-tone="gold">自动</span>' : '') +
            (st ? '<span class="tag" data-tone="cyan">' + U.esc(ES.state.ovrGrade(ES.state.ovr(st))) + '</span>' : '') + '</span>' +
          (st
            ? '<span class="lrow-sub">' + U.esc(st.profile.name) + ' · ' + U.esc(st.profile.tag) + ' · ' + U.esc(st.club.short) + ' · ' + U.esc(st.time.phase) + ' · OVR ' + ES.state.ovr(st) + '</span>' +
              '<span class="tiny dim">最后保存：' + timeAgo(data.savedAt) + ' · 回合 ' + st.time.turn + ' · ' + ES.state.timeText(st) + '</span>'
            : '<span class="lrow-sub dim">' + slot.desc + ' · 空槽位</span>') +
        '</span>' +
        '<span class="lrow-side" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
          (st ? '<button type="button" class="btn btn-sm btn-line" data-slot-load="' + slot.id + '">' + U.icon('play', 'icon-xs') + '读取</button>' : '') +
          (!isAuto ? '<button type="button" class="btn btn-sm ' + (st ? 'btn-ghost' : 'btn-primary') + '" data-slot-save="' + slot.id + '">' + U.icon('save', 'icon-xs') + (st ? '覆盖' : '保存') + '</button>' : '') +
          (st ? '<button type="button" class="btn btn-sm btn-danger" data-slot-del="' + slot.id + '" aria-label="删除 ' + slot.name + '">' + U.icon('trash', 'icon-xs') + '</button>' : '') +
        '</span>' +
      '</div>';
    }).join('');

    U.$$('[data-slot-load]').forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.getAttribute('data-slot-load');
        U.confirmDialog({
          title: '读取存档', sub: SLOTS.filter(function (s) { return s.id === id; })[0].name,
          message: '读取存档会立即替换当前进度，未保存的内容将丢失。是否继续？',
          okText: '读取存档'
        }).then(function (ok) {
          if (!ok) return;
          const st = ES.state.loadSlot(id);
          if (!st) { U.toast({ tone: 'error', title: '存档损坏', msg: '该槽位数据无法解析。' }); return; }
          ES.app.startGame(st, false);
          U.closeModal('modal-saves');
          U.toast({ tone: 'success', title: '存档已读取', msg: ES.state.summaryLabel(st) });
          ES.audio.play('levelup');
        });
      });
    });
    U.$$('[data-slot-save]').forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.getAttribute('data-slot-save');
        const exist = !!slots[id];
        const doSave = function () {
          ES.state.saveSlot(id, S);
          render();
          ES.panels.renderRail();
          U.toast({ tone: 'success', icon: 'save', title: '已保存至 ' + SLOTS.filter(function (s) { return s.id === id; })[0].name, msg: ES.state.summaryLabel(S) });
          ES.audio.play('notify');
        };
        if (exist) {
          U.confirmDialog({ title: '覆盖存档', sub: '该槽位已有存档', message: '覆盖后原存档将无法恢复。', okText: '覆盖保存', danger: true }).then(function (ok) { if (ok) doSave(); });
        } else doSave();
      });
    });
    U.$$('[data-slot-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.getAttribute('data-slot-del');
        U.confirmDialog({ title: '删除存档', sub: SLOTS.filter(function (s) { return s.id === id; })[0].name, message: '删除后无法恢复，确定继续吗？', okText: '删除', danger: true }).then(function (ok) {
          if (!ok) return;
          ES.state.deleteSlot(id);
          render();
          U.toast({ tone: 'warn', title: '存档已删除', msg: '该槽位现在是空的。' });
        });
      });
    });
  }

  function bind(state) { S = state; render(); }

  function bindStatic() {
    U.$('#btn-saves-export').addEventListener('click', function () {
      const slots = ES.state.listSlots();
      const payload = { app: 'apex-corridor', v: 1, exportedAt: Date.now(), slots: {} };
      Object.keys(slots).forEach(function (k) { if (slots[k]) payload.slots[k] = slots[k]; });
      const text = JSON.stringify(payload);
      U.$('#textarea-saves-data').value = text;
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      } catch (e) {}
      U.toast({ tone: 'success', title: '导出完成', msg: '序列化数据已写入下方文本框并尝试复制到剪贴板（' + (text.length / 1024).toFixed(1) + ' KB）。' });
      ES.audio.play('notify');
    });
    U.$('#btn-saves-import').addEventListener('click', function () {
      const raw = U.$('#textarea-saves-data').value.trim();
      if (!raw) { U.toast({ tone: 'warn', title: '没有可导入的数据', msg: '请先粘贴 JSON 数据。' }); return; }
      let data;
      try { data = JSON.parse(raw); } catch (e) { U.toast({ tone: 'error', title: '数据格式错误', msg: '粘贴的内容不是有效的 JSON。' }); return; }
      if (!data || !data.slots) { U.toast({ tone: 'error', title: '数据不完整', msg: '未找到 slots 字段。' }); return; }
      U.confirmDialog({ title: '导入存档', sub: Object.keys(data.slots).length + ' 个槽位', message: '导入会覆盖同名槽位，是否继续？', okText: '导入' }).then(function (ok) {
        if (!ok) return;
        let n = 0;
        Object.keys(data.slots).forEach(function (k) {
          const st = data.slots[k] && data.slots[k].state;
          if (!st) return;
          ES.state.saveSlot(k, st);
          n++;
        });
        render();
        U.toast({ tone: 'success', title: '导入完成', msg: '成功导入 ' + n + ' 个槽位。' });
      });
    });
    U.$('#btn-saves-wipe').addEventListener('click', function () {
      U.confirmDialog({
        title: '清空全部存档', sub: '不可恢复',
        message: '所有槽位（含自动存档）与设置都会被删除，当前进度也会丢失。确定要清空吗？',
        okText: '确认清空', danger: true
      }).then(function (ok) {
        if (!ok) return;
        ES.state.wipe();
        U.toast({ tone: 'error', title: '本地数据已清空', msg: '页面即将回到建档界面。' });
        setTimeout(function () { ES.app.gotoCreator(); }, 900);
      });
    });
  }

  return { bind: bind, render: render, bindStatic: bindStatic, SLOTS: SLOTS };
})();
