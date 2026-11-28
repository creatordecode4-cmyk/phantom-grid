// ---------------------------------------------------------------------------
// debugFlags.js - the hidden DEBUG FLAGS screen (triple tap on the game's name on the title screen).
//
// It shows every saved choice of the story (the list of src/story/flags.js), lets you change each one, put a whole
// preset in place ("Good run", "Dark run", "Secret run") and jump to any chapter, mission or ending with those
// flags. It is a tool for testing every branch and every ending on the phone; a normal player never sees it.
//
// A value button goes round its values with every tap: a yes / no flag goes  (not set) -> YES -> NO -> (not set),
// a word flag goes through its words. A text, a number without a list of values, or a list (ally_help) asks with a
// small box. "Not set" means the chapter will read it as "no".
// ---------------------------------------------------------------------------

import { FLAGS, FLAG_GROUPS, PRESETS } from '../story/flags.js';
import { t } from '../story/strings.js';

// opts: { flags (the saved ones), list: a promise of [{ head } | { label, id: { chapter, mission } }] (every chapter
//         file is read for it: that can take a few seconds the first time), endings: [{ label, id }] (also a promise),
//         onStart(id, flags), onSave(flags), onBack() }
export function showDebugFlags(node, opts) {
  const press = (b, fn) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (label, cls = 'btn') => el('button', cls, label);
  // the flags being edited (a copy: nothing is saved until SAVE or a jump)
  let flags = { ...(opts.flags || {}) };

  node.innerHTML = '';
  node.hidden = false;
  node.style.justifyContent = 'flex-start';
  node.appendChild(el('h2', '', t('dbg.title')));
  node.appendChild(el('div', 'dbg-note', t('dbg.note')));

  // ---- presets ----
  node.appendChild(el('div', 'dbg-head', t('dbg.presets')));
  const pre = el('div', 'dbg-chips'), preNote = el('div', 'dbg-note');
  for (const [key, p] of Object.entries(PRESETS)) {
    const b = button(p.label, 'btn dbg-chip');
    press(b, () => {
      flags = { ...p.flags };
      for (const o of pre.children) o.classList.remove('on');
      b.classList.add('on');
      preNote.textContent = p.note;
      drawValues();
    });
    b.dataset.preset = key;
    pre.appendChild(b);
  }
  node.appendChild(pre); node.appendChild(preNote);

  // ---- start anywhere with these flags ----
  node.appendChild(el('div', 'dbg-head', t('dbg.start')));
  const start = el('div', 'dbg-start');
  start.appendChild(el('div', 'dbg-sub', t('ui.loading_story')));
  node.appendChild(start);
  Promise.all([opts.list, opts.endings]).then(([list, endings]) => {
    if (node.hidden) return;
    start.textContent = '';
    let row = null;
    for (const it of [...(list || []), ...(endings && endings.length ? [{ head: t('dbg.endings') }, ...endings] : [])]) {
      if (it.head) { start.appendChild(el('div', 'dbg-sub', it.head)); row = el('div', 'dbg-chips'); start.appendChild(row); continue; }
      const b = button(it.label, 'btn dbg-chip');
      press(b, () => opts.onStart(it.id, { ...flags }));
      (row || start).appendChild(b);
    }
  });

  // ---- every flag ----
  node.appendChild(el('div', 'dbg-head', t('dbg.flags')));
  const table = el('div', 'dbg-table');
  const valueButtons = new Map();
  for (const [ch, head] of FLAG_GROUPS) {
    const list = FLAGS.filter((f) => f.ch === ch);
    if (!list.length) continue;
    table.appendChild(el('div', 'dbg-sub', head));
    for (const f of list) {
      const r = el('div', 'dbg-row');
      const name = el('div', 'dbg-name', f.name);
      name.appendChild(el('small', '', f.note));
      const b = button('', 'btn dbg-val');
      press(b, () => { change(f); drawValues(); });
      r.appendChild(name); r.appendChild(b); table.appendChild(r);
      valueButtons.set(f.name, b);
    }
  }
  node.appendChild(table);

  // ---- save, clear, back ----
  const col = el('div', 'menu-col');
  const saveB = button(t('dbg.save'), 'btn main');
  press(saveB, () => { opts.onSave({ ...flags }); saveB.textContent = t('dbg.saved'); setTimeout(() => { saveB.textContent = t('dbg.save'); }, 1200); });
  const clearB = button(t('dbg.clear'));
  press(clearB, () => { flags = {}; for (const o of pre.children) o.classList.remove('on'); preNote.textContent = ''; drawValues(); });
  const back = button(t('ui.back'));
  press(back, () => opts.onBack());
  // ANIM TEST (src/ui/animTest.js): every animation of Nate on buttons, slow motion, the foot contacts
  const animB = button(t('dbg.anim'));
  press(animB, () => { if (opts.onAnimTest) opts.onAnimTest(); });
  col.appendChild(saveB); col.appendChild(clearB); if (opts.onAnimTest) col.appendChild(animB); col.appendChild(back);
  node.appendChild(col);

  // what a value looks like on its button
  function show(v) {
    if (v === undefined || v === null) return '—';
    if (v === true) return 'YES';
    if (v === false) return 'NO';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '[ ]';
    if (typeof v === 'string') return v === '' ? '“”' : v;
    return String(v);
  }
  function drawValues() {
    for (const [name, b] of valueButtons) {
      const v = flags[name];
      b.textContent = show(v);
      b.classList.toggle('unset', v === undefined || v === null);
      b.classList.toggle('yes', v === true);
    }
  }
  // one tap on a value: the next value
  function change(f) {
    const v = flags[f.name];
    const ask = (q, def) => { const a = window.prompt(q, def); return a === null ? undefined : a; };
    if (f.kind === 'bool') { flags[f.name] = v === undefined ? true : v === true ? false : undefined; }
    else if (f.kind === 'word' || (f.kind === 'number' && f.values)) {
      const seq = [undefined, ...f.values];
      const i = seq.findIndex((x) => x === v);
      flags[f.name] = seq[(i + 1) % seq.length];
    } else if (f.kind === 'number') {
      const a = ask(f.name, v === undefined ? '' : String(v));
      if (a !== undefined) flags[f.name] = a.trim() === '' ? undefined : Number(a) || 0;
    } else if (f.kind === 'text') {
      const a = ask(f.name, v === undefined ? '' : v);
      if (a !== undefined) flags[f.name] = a;
    } else if (f.kind === 'list') {
      const a = ask(`${f.name} (${(f.values || []).join(', ')})`, Array.isArray(v) ? v.join(', ') : '');
      if (a !== undefined) flags[f.name] = a.split(',').map((x) => x.trim()).filter(Boolean);
    }
    if (flags[f.name] === undefined) delete flags[f.name];
  }
  drawValues();
  node.scrollTop = 0;
}
