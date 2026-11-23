// ---------------------------------------------------------------------------
// storyUI.js - everything the story puts on top of the game picture.
//
//   film scenes:  black bars, subtitles with the speaker's name, "hold to skip"
//   talking:      up to three big choice buttons
//   cards:        black or white over the whole picture, with a title on it
//   in the game:  the big LIMITER OFF button, WREN's small sign, the rear-view
//                 mirror of the chase, the tape display, the TALK / TAKE button,
//                 things to read (a phone, the race ticket)
//   menus:        title screen, pause, settings, mission list, end and fail cards
//   chapter 2:    the paint shop (four colors, hold to spray, a new number
//                 plate), the video on the KEYSTONE chip (a recording with its
//                 date and time), the BUSTED card (a fine instead of game over)
//
// This file only talks to the web page. The story engine tells it what to show.
// ---------------------------------------------------------------------------

import { t } from '../story/strings.js';

// the ways of walking the player can pick in the settings (names from WALK_STYLES in proceduralAnim.js)
const WALK_CHOICES = ['confident', 'normal', 'swagger', 'posh', 'tough', 'soldier', 'brisk', 'elegant', 'femme', 'old'];

export function createStoryUI() {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  // a button reacts as soon as the finger goes down
  const press = (node, fn) => node.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
  const el = {
    subs: $('subs'), who: $('subs-who'), text: $('subs-text'), choices: $('choices'), skip: $('skip'), fade: $('fade'), card: $('card'),
    limiter: $('btn-limiter'), wren: $('wren'), mirror: $('mirror'), tape: $('tape'), tapeName: $('tape-name'), tapeBar: $('tape-bar').firstElementChild,
    act: $('btn-act'), tip: $('tip'), reader: $('reader'), badge: $('limit-badge'),
    cargoRow: $('cargo-row'), cargoBar: $('cargo-bar').firstElementChild, cargoNum: $('cargo-num'),
    title: $('title'), pause: $('pause'), settings: $('settings'), select: $('select'), endcard: $('endcard'), failcard: $('failcard'),
    paint: $('paint'), video: $('video'), videoDate: $('video-date'), videoFile: $('video-file'), videoLock: $('video-lock'), bustcard: $('bustcard'),
  };
  const button = (label, cls = 'btn') => { const b = document.createElement('button'); b.className = cls; b.textContent = label; return b; };

  // ------------------------------------------------------------ settings kept on the phone
  // difficulty: how good the other drivers of a race are (e = easy, n = normal, h = hard)
  // walk: how Nate walks (a name from WALK_STYLES in src/characters/proceduralAnim.js)
  const settings = { ctl: 'm', subs: 'm', volume: 1, muted: false, tilt: false, difficulty: 'n', walk: 'confident' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('pg-settings') || '{}')); } catch (e) { /* private mode */ }
  const saveSettings = () => { try { localStorage.setItem('pg-settings', JSON.stringify(settings)); } catch (e) { /* private mode */ } };
  function applyLook() {
    document.documentElement.style.setProperty('--ctl', { s: 0.86, m: 1, l: 1.18 }[settings.ctl] || 1);
    document.documentElement.style.setProperty('--sub', { s: '14px', m: '16px', l: '20px', xl: '25px' }[settings.subs] || '16px');
  }
  applyLook();

  // ------------------------------------------------------------ film bars, fades, cards
  function cine(on) { body.classList.toggle('cine', !!on); }
  // color: 'black' | 'white', amount 0..1, seconds: how long the change takes
  function fade(color, amount, seconds = 0.8) {
    el.fade.style.transition = `opacity ${seconds}s linear`;
    el.fade.style.background = color === 'white' ? '#fff' : '#000';
    // (read a layout value so the browser really starts from the old state)
    void el.fade.offsetWidth;
    el.fade.style.opacity = String(amount);
  }
  // a title card on top of the fade: { over, title, sub } (texts, not keys) or null
  function card(c) {
    if (!c) { el.card.classList.remove('show'); return; }
    $('card-over').textContent = c.over || ''; $('card-title').textContent = c.title || ''; $('card-sub').textContent = c.sub || '';
    el.card.style.color = c.dark ? '#111' : '#fff';
    el.card.classList.add('show');
  }

  // ------------------------------------------------------------ subtitles
  // One line at a time. A new line replaces the old one. Lines can wait in a queue.
  const queue = [];
  let subLeft = 0, subNow = null;
  function showSub(s) {
    subNow = s;
    el.subs.hidden = false;
    el.who.textContent = s.who || '';
    el.who.classList.toggle('wren', s.kind === 'wren');
    el.who.classList.toggle('radio', s.kind === 'radio');           // a voice over the radio (Rask, Chapter 5)
    el.text.textContent = s.text;
    el.text.classList.toggle('thought', s.kind === 'thought');
    subLeft = s.seconds;
    el.wren.classList.toggle('on', s.kind === 'wren');
    if (s.onShow) s.onShow(s.seconds);         // (how long the line stays: the speaker's mouth is timed to it)
  }
  // how long a line stays: long enough to read it
  const readTime = (text) => Math.max(1.9, Math.min(7, 1.1 + text.length * 0.062));
  // who: name shown above (may be ''), kind: '' | 'wren' | 'thought' | 'radio'
  function say(who, text, opts = {}) {
    const s = { who, text, seconds: opts.seconds || readTime(text), kind: opts.kind || '', onShow: opts.onShow || null, onDone: opts.onDone || null };
    if (opts.now || (!subNow && !queue.length)) { queue.length = opts.now ? 0 : queue.length; showSub(s); } else queue.push(s);
    return s.seconds;
  }
  function clearSubs() { queue.length = 0; subNow = null; subLeft = 0; el.subs.hidden = true; el.wren.classList.remove('on'); }

  // ------------------------------------------------------------ choices
  let choiceDone = null, choiceLeft = 0, choiceTotal = 0, choiceDefault = 0;
  // options: list of texts (at most 2 are shown), cb(index). seconds: after this time the default is taken (0 = wait forever)
  function choice(prompt, options, cb, seconds = 0, def = 0) {
    // (no options: take the choice away)
    if (!options) { el.choices.hidden = true; el.choices.textContent = ''; choiceDone = null; choiceLeft = 0; body.classList.remove('choosing'); return; }
    el.choices.textContent = '';
    if (prompt) { const p = document.createElement('div'); p.className = 'prompt'; p.textContent = prompt; el.choices.appendChild(p); }
    options.slice(0, 3).forEach((text, i) => { const b = button(text, ''); press(b, () => pick(i)); el.choices.appendChild(b); });
    if (seconds > 0) { const bar = document.createElement('div'); bar.className = 'bar'; bar.appendChild(document.createElement('i')); el.choices.appendChild(bar); }
    el.choices.hidden = false;
    body.classList.add('choosing');            // (the subtitle moves up, over the buttons: a question stays readable)
    choiceDone = cb; choiceLeft = choiceTotal = seconds; choiceDefault = def;
  }
  function pick(i) { const cb = choiceDone; choiceDone = null; el.choices.hidden = true; body.classList.remove('choosing'); if (cb) cb(i); }

  // ------------------------------------------------------------ hold to skip
  let skipCb = null, skipHeld = false, skipT = 0;
  el.skip.querySelector('span').textContent = t('ui.skip');
  el.skip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); skipHeld = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.skip.addEventListener(ev, () => { skipHeld = false; });
  window.addEventListener('keydown', (e) => { if (e.code === 'Enter' && skipCb) skipHeld = true; if ((e.code === 'Enter' || e.code === 'KeyO') && limiterCb) limiterPressed(); });
  window.addEventListener('keyup', (e) => { if (e.code === 'Enter') skipHeld = false; });
  function skip(cb) { skipCb = cb; skipT = 0; skipHeld = false; el.skip.hidden = !cb; el.skip.firstElementChild.style.width = '0%'; }

  // ------------------------------------------------------------ the limiter button
  let limiterCb = null;
  el.limiter.innerHTML = `${t('ui.limiter_off')}<small>${t('ui.limiter_hint')}</small>`;
  function limiterPressed() { const cb = limiterCb; limiterCb = null; el.limiter.hidden = true; if (cb) cb(); }
  press(el.limiter, limiterPressed);
  function limiter(cb) { limiterCb = cb; el.limiter.hidden = !cb; }

  // ------------------------------------------------------------ small things in the game picture
  let actCb = null;
  press(el.act, () => { if (actCb) actCb(); });
  // the TALK / TAKE button (label = null hides it)
  function prompt(label, cb = null) { actCb = label ? cb : null; if (el.act.hidden === !!label) el.act.hidden = !label; if (label && el.act.textContent !== label) el.act.textContent = label; }
  let tipLeft = 0;
  function tip(text, seconds = 5) { el.tip.hidden = !text; if (text) { el.tip.textContent = text; tipLeft = seconds; } }
  function tape(on, name = '', progress = 0) {
    if (el.tape.hidden === on) el.tape.hidden = !on;
    if (!on) return;
    const label = `${t('ui.tape')}  ·  ${name}`;
    if (el.tapeName.textContent !== label) el.tapeName.textContent = label;
    el.tapeBar.style.width = `${Math.round(progress * 100)}%`;
  }
  // the red "80" sign next to the speed: limit 0 hides it, hit = the limiter is holding the van back right now
  let lastLimit = -1, lastHit = null;
  function limitBadge(limit, hit) {
    if (limit !== lastLimit) { lastLimit = limit; el.badge.hidden = !limit; el.badge.textContent = String(limit); }
    if (hit !== lastHit) { lastHit = hit; el.badge.classList.toggle('hit', !!hit); }
  }

  // ---- CARGO (Chapter 5): how whole the load on the vehicle still is. info: { integrity 0..1 } or null ----
  let lastCargo = -1;
  function cargo(info) {
    const v = info ? Math.round(info.integrity * 100) : -1;
    if (v === lastCargo) return;
    if (v >= 0 && lastCargo >= 0 && v < lastCargo - 1) { el.cargoRow.classList.remove('hit'); void el.cargoRow.offsetWidth; el.cargoRow.classList.add('hit'); }
    lastCargo = v;
    el.cargoRow.hidden = v < 0;
    if (v < 0) return;
    el.cargoBar.style.width = v + '%';
    el.cargoNum.textContent = String(v);
    el.cargoRow.classList.toggle('warn', v < 60 && v >= 30);
    el.cargoRow.classList.toggle('bad', v < 30);
  }

  // ---- the rear-view mirror: who is behind the player, drawn as lights in the dark ----
  const mctx = el.mirror.getContext('2d');
  function mirror(on) { if (el.mirror.hidden === on) { el.mirror.hidden = !on; body.classList.toggle('mirror', on); } }
  // items: [{ side: -1 (left) .. 1 (right), dist: meters behind, kind: 'zero' | 'guard' | 'car' }], time: seconds (for blinking)
  function drawMirror(items, time) {
    const W = el.mirror.width, H = el.mirror.height, g = mctx;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05070a'); bg.addColorStop(0.62, '#0b1016'); bg.addColorStop(1, '#151b22');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // wet road shine and a few rain streaks on the glass
    g.fillStyle = 'rgba(120,150,180,0.06)'; g.fillRect(0, H * 0.66, W, 2);
    g.strokeStyle = 'rgba(190,210,230,0.10)'; g.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const x = ((i * 53 + time * 40 * (1 + (i % 3) * 0.3)) % (W + 20)) - 10; g.beginPath(); g.moveTo(x, (i * 37) % H); g.lineTo(x - 5, ((i * 37) % H) + 14); g.stroke(); }
    const sorted = items.slice().sort((a, b) => b.dist - a.dist);
    for (const it of sorted) {
      const s = Math.max(0.16, Math.min(1.9, 13 / Math.max(it.dist, 3.5)));
      const x = W / 2 + it.side * W * 0.4, y = H * (0.62 - 0.1 * Math.min(1, s));
      const glow = (cx, cy, r, color) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); };
      if (it.kind === 'zero') {
        // one thin, cold bar of light
        const w = 60 * s;
        glow(x, y, 46 * s, 'rgba(150,200,255,0.5)');
        g.fillStyle = 'rgba(225,240,255,0.98)'; g.fillRect(x - w / 2, y - 2.2 * s, w, 4.4 * s);
      } else {
        const d = 17 * s;
        for (const sx of [-1, 1]) { glow(x + sx * d, y, 15 * s, 'rgba(255,240,200,0.85)'); g.fillStyle = '#fff8e0'; g.beginPath(); g.arc(x + sx * d, y, 3.2 * s, 0, 6.3); g.fill(); }
        if (it.kind === 'guard') { const red = Math.floor(time * 6) % 2 === 0; glow(x + (red ? -1 : 1) * d * 0.7, y - 15 * s, 20 * s, red ? 'rgba(255,40,30,0.9)' : 'rgba(50,90,255,0.9)'); }
      }
    }
  }

  // ---- things to read ----
  // kind 'phone': { from, text, when }, kind 'ticket': { t1, t2, t3 }. buttons: list of labels, cb(index)
  function reader(kind, data, buttons, cb) {
    el.reader.textContent = '';
    if (!kind) { el.reader.hidden = true; return; }
    const box = document.createElement('div');
    box.className = kind;
    if (kind === 'phone') box.innerHTML = '<div class="from"></div><div class="msg"></div><div class="when"></div>';
    else box.innerHTML = '<div class="t1"></div><div class="t2"></div><div class="t3"></div>';
    const fill = kind === 'phone' ? [data.from, data.text, data.when] : [data.t1, data.t2, data.t3];
    [...box.children].forEach((c, i) => { c.textContent = fill[i] || ''; });
    const wrap = document.createElement('div');
    wrap.appendChild(box);
    const row = document.createElement('div');
    row.className = 'menu-col'; row.style.margin = '18px auto 0';
    buttons.forEach((label, i) => { const b = button(label, i === 0 ? 'btn main' : 'btn'); press(b, () => { el.reader.hidden = true; cb(i); }); row.appendChild(b); });
    wrap.appendChild(row);
    el.reader.appendChild(wrap);
    el.reader.hidden = false;
  }

  // ------------------------------------------------------------ the paint shop (Chapter 2)
  // stage 'colors': data = { title, options: [{ name, css }] }, cb(index)
  // stage 'spray':  data = { label }, cb(true) when the finger goes down, cb(false) when it comes up
  // stage 'plate':  data = { title, old, plate, label }, cb() when the button is pressed
  // stage null:     hide it
  let paintBar = null;
  function paint(stage, data = {}, cb = null) {
    el.paint.textContent = ''; paintBar = null;
    if (!stage) { el.paint.hidden = true; return; }
    const head = document.createElement('div'); head.className = 'head'; head.textContent = data.title || '';
    el.paint.appendChild(head);
    if (stage === 'colors') {
      const row = document.createElement('div'); row.className = 'swatches';
      data.options.forEach((o, i) => {
        const b = document.createElement('button'); b.className = 'swatch';
        b.innerHTML = '<i></i><span></span>'; b.firstElementChild.style.background = o.css; b.lastElementChild.textContent = o.name;
        press(b, () => cb(i));
        row.appendChild(b);
      });
      el.paint.appendChild(row);
    } else if (stage === 'spray') {
      const b = button(data.label || '', 'btn spray'); b.innerHTML = '<i></i><span></span>'; b.lastElementChild.textContent = data.label || '';
      paintBar = b.firstElementChild;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('held'); cb(true); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (b.classList.contains('held')) { b.classList.remove('held'); cb(false); } });
      el.paint.appendChild(b);
    } else if (stage === 'plate') {
      const plates = document.createElement('div'); plates.className = 'plates';
      plates.innerHTML = '<span class="plate old"></span><span class="arrow">\u2192</span><span class="plate"></span>';
      plates.children[0].textContent = data.old || ''; plates.children[2].textContent = data.plate || '';
      el.paint.appendChild(plates);
      const b = button(data.label || '', 'btn main'); press(b, () => cb()); el.paint.appendChild(b);
    }
    el.paint.hidden = false;
  }
  // how far the spraying is (0..1)
  function paintProgress(p) { if (paintBar) paintBar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`; }

  // ------------------------------------------------------------ the video on the chip (Chapter 2)
  // state: 'on' (a recording: REC, the date, the file), 'glitch' (it breaks up), 'locked' (black, a lock), 'off'
  function video(state, info = {}) {
    el.video.classList.remove('glitch', 'locked');
    if (!state || state === 'off') { el.video.hidden = true; return; }
    if (info.date !== undefined) el.videoDate.textContent = info.date;
    if (info.file !== undefined) el.videoFile.textContent = info.file;
    if (info.lock !== undefined) el.videoLock.textContent = info.lock;
    if (state === 'glitch') el.video.classList.add('glitch');
    if (state === 'locked') el.video.classList.add('locked');
    el.video.hidden = false;
  }

  // ------------------------------------------------------------ menus
  const screen = (node, html) => { node.innerHTML = html; node.hidden = false; return node; };
  function hideMenus() { for (const n of [el.title, el.pause, el.settings, el.select, el.endcard, el.failcard, el.bustcard]) n.hidden = true; }
  // info: { canContinue, where: text under CONTINUE }, cb(action): 'continue' | 'new' | 'free' | 'select' | 'settings'
  function title(info, cb) {
    hideMenus();
    const n = screen(el.title, `<h1>${t('ui.game')}</h1><div class="sub">${t('ui.tagline')}</div><div class="menu-col"></div>`), col = n.querySelector('.menu-col');
    const add = (label, action, cls = 'btn') => { const b = button(label, cls); press(b, () => cb(action)); col.appendChild(b); return b; };
    if (info.canContinue) { add(t('ui.continue'), 'continue', 'btn main'); if (info.where) { const d = document.createElement('div'); d.className = 'note'; d.textContent = info.where; col.appendChild(d); } }
    if (!info.canContinue) add(t('ui.new_game'), 'new', 'btn main');
    else {
      // a saved game would be erased: the button must be pressed twice
      const b = button(t('ui.new_game'), 'btn'); let armed = false;
      press(b, () => { if (armed) cb('new'); else { armed = true; b.textContent = t('ui.new_confirm'); } });
      col.appendChild(b);
    }
    add(t('ui.missions'), 'select'); add(t('ui.free_roam'), 'free'); add(t('ui.settings'), 'settings');
    if (info.canContinue) { const d = document.createElement('div'); d.className = 'note'; d.textContent = t('ui.new_warn'); col.appendChild(d); }
  }
  // cb(action): 'resume' | 'settings' | 'restart' | 'title'
  function pause(info, cb) {
    hideMenus();
    const n = screen(el.pause, `<h2>${t('ui.paused')}</h2><div class="menu-col"></div>`), col = n.querySelector('.menu-col');
    for (const [label, action, cls] of [[t('ui.resume'), 'resume', 'btn main'], [t('ui.settings'), 'settings', 'btn'], [t('ui.restart'), 'restart', 'btn'], [t('ui.title'), 'title', 'btn']]) {
      if (action === 'restart' && !info.story) continue;
      const b = button(label, cls); press(b, () => cb(action)); col.appendChild(b);
    }
  }
  // values: { quality }, onChange(key, value): the game applies it, onBack()
  function settingsScreen(values, onChange, onBack) {
    hideMenus();
    const n = screen(el.settings, `<h2>${t('ui.settings')}</h2><div class="menu-col" style="width:min(380px,92vw)"></div>`), col = n.querySelector('.menu-col');
    const row = (label, opts, current, key) => {
      const r = document.createElement('div'); r.className = 'set-row'; r.innerHTML = `<span>${label}</span><span class="opts"></span>`;
      for (const [value, text] of opts) {
        const b = button(text); b.classList.toggle('on', value === current);
        press(b, () => { for (const o of r.querySelectorAll('.btn')) o.classList.remove('on'); b.classList.add('on'); set(key, value); });
        r.lastElementChild.appendChild(b);
      }
      col.appendChild(r);
    };
    const set = (key, value) => { if (key in settings) { settings[key] = value; saveSettings(); applyLook(); } onChange(key, value); };
    row(t('ui.quality'), [['auto', t('ui.auto')], ['low', t('ui.low')], ['medium', t('ui.med')], ['high', t('ui.high')]], values.quality, 'quality');
    row(t('ui.control_size'), [['s', t('ui.small')], ['m', t('ui.medium')], ['l', t('ui.large')]], settings.ctl, 'ctl');
    row(t('ui.tilt'), [[false, t('ui.off')], [true, t('ui.on')]], settings.tilt, 'tilt');
    row(t('ui.difficulty'), [['e', t('ui.easy')], ['n', t('ui.normal')], ['h', t('ui.hard')]], settings.difficulty, 'difficulty');
    row(t('ui.sub_size'), [['s', t('ui.small')], ['m', t('ui.medium')], ['l', t('ui.large')], ['xl', t('ui.xlarge')]], settings.subs, 'subs');
    // WALK STYLE: one button, "< SWAGGER >": every press goes to the next way of walking
    {
      const r = document.createElement('div'); r.className = 'set-row'; r.innerHTML = '<span></span><span class="opts"></span>';
      r.firstElementChild.textContent = t('ui.walk');
      const styles = WALK_CHOICES, b = button('');
      const show = () => { b.textContent = '\u2039 ' + t('walk.' + settings.walk) + ' \u203a'; };
      if (!styles.includes(settings.walk)) settings.walk = styles[0];
      show();
      press(b, () => { set('walk', styles[(styles.indexOf(settings.walk) + 1) % styles.length]); show(); });
      r.lastElementChild.appendChild(b);
      col.appendChild(r);
    }
    row(t('ui.sound'), [[false, t('ui.on')], [true, t('ui.off')]], settings.muted, 'muted');
    const vr = document.createElement('div'); vr.className = 'set-row'; vr.innerHTML = `<span>${t('ui.volume')}</span><input type="range" min="0" max="100" step="5">`;
    const slider = vr.querySelector('input'); slider.value = String(Math.round(settings.volume * 100));
    slider.addEventListener('input', () => set('volume', Number(slider.value) / 100));
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    col.appendChild(vr);
    const back = button(t('ui.back'), 'btn main'); press(back, onBack); col.appendChild(back);
  }
  // list: [{ head: text } | { label, id }], cb(id) (id null = back)
  function select(list, cb) {
    hideMenus();
    const n = screen(el.select, `<h2>${t('ui.select_title')}</h2><div class="menu-col"><div class="note">${t('ui.select_note')}</div></div><div class="list"></div><div class="menu-col"></div>`);
    n.style.justifyContent = 'flex-start';
    const listNode = n.querySelector('.list');
    for (const it of list) {
      if (it.head) { const d = document.createElement('div'); d.className = 'head'; d.textContent = it.head; listNode.appendChild(d); continue; }
      const b = button(it.label); press(b, () => cb(it.id)); listNode.appendChild(b);
    }
    const back = button(t('ui.back'), 'btn main'); press(back, () => cb(null)); n.lastElementChild.appendChild(back);
  }
  // data: { over, title, lines, locked }, buttons: [[label, action]], cb(action)
  function endCard(data, buttons, cb) {
    hideMenus();
    const n = screen(el.endcard, '<div class="over"></div><h2></h2><div class="lines"></div><div class="locked"></div><div class="menu-col"></div>');
    n.children[0].textContent = data.over || ''; n.children[1].textContent = data.title || ''; n.children[2].textContent = (data.lines || []).join('\n'); n.children[3].textContent = data.locked || '';
    for (const [label, action] of buttons) { const b = button(label, action === buttons[0][1] ? 'btn main' : 'btn'); press(b, () => cb(action)); n.lastElementChild.appendChild(b); }
  }
  // cb(action): 'retry' | 'title'
  function failCard(why, cb) {
    hideMenus();
    const n = screen(el.failcard, `<h2>${t('ui.failed')}</h2><div class="why"></div><div class="menu-col"></div>`);
    n.children[1].textContent = why || '';
    for (const [label, action, cls] of [[t('ui.retry'), 'retry', 'btn main'], [t('ui.title'), 'title', 'btn']]) { const b = button(label, cls); press(b, () => cb(action)); n.lastElementChild.appendChild(b); }
  }

  // BUSTED (Chapter 2): no game over - a fine, and back to the last checkpoint.
  //   data: { title, line, fine, left, label } (texts), cb()
  function bustCard(data, cb) {
    hideMenus();
    const n = screen(el.bustcard, '<h2></h2><div class="line"></div><div class="fine"></div><div class="left"></div><div class="menu-col"></div>');
    n.children[0].textContent = data.title || ''; n.children[1].textContent = data.line || '';
    n.children[2].textContent = data.fine || ''; n.children[3].textContent = data.left || '';
    const b = button(data.label || '', 'btn main'); press(b, () => { n.hidden = true; cb(); }); n.lastElementChild.appendChild(b);
  }

  // ------------------------------------------------------------ every frame (real seconds, also while the game is paused)
  function update(dt) {
    if (subNow) {
      subLeft -= dt;
      if (subLeft <= 0) {
        const done = subNow.onDone;
        subNow = null;
        if (queue.length) showSub(queue.shift()); else { el.subs.hidden = true; el.wren.classList.remove('on'); }
        if (done) done();
      }
    }
    if (choiceDone && choiceTotal > 0) {
      choiceLeft -= dt;
      const bar = el.choices.querySelector('.bar i');
      if (bar) bar.style.width = `${Math.max(0, (choiceLeft / choiceTotal) * 100)}%`;
      if (choiceLeft <= 0) pick(choiceDefault);
    }
    if (skipCb) {
      skipT = skipHeld ? skipT + dt : Math.max(0, skipT - dt * 2);
      el.skip.firstElementChild.style.width = `${Math.min(100, (skipT / 0.9) * 100)}%`;
      if (skipT >= 0.9) { const cb = skipCb; skip(null); cb(); }
    }
    if (!el.tip.hidden) { tipLeft -= dt; if (tipLeft <= 0) el.tip.hidden = true; }
  }
  // everything of the story off the screen (leaving the story, restarting a checkpoint)
  function reset() {
    cine(false); clearSubs(); skip(null); limiter(null); prompt(null); tip(null); tape(false); mirror(false); limitBadge(0, false); cargo(null);
    card(null); el.choices.hidden = true; choiceDone = null; el.reader.hidden = true; body.classList.remove('quiet'); body.classList.remove('choosing');
    paint(null); video('off');
  }

  return {
    settings, update, reset,
    // change one setting from outside the settings screen (the TILT and SOUND buttons) and remember it
    setSetting(key, value) { settings[key] = value; saveSettings(); applyLook(); },
    cine, fade, card, say, clearSubs, choice, skip, limiter, prompt, tip, tape, limitBadge, cargo, mirror, drawMirror, reader,
    title, pause, settingsScreen, select, endCard, failCard, hideMenus, paint, paintProgress, video, bustCard,
    quiet(on) { body.classList.toggle('quiet', !!on); },
    // a calm chapter (Chapter 6): no minimap, no stars, no timer; big soft buttons (index.html, body.calm)
    calm(on) { body.classList.toggle('calm', !!on); },
    storyMode(on) { body.classList.toggle('story', !!on); },
    get subsBusy() { return !!subNow || queue.length > 0; },
    get choosing() { return !!choiceDone; },
    get actShown() { return !el.act.hidden; },
    get actLabel() { return el.act.hidden ? null : el.act.textContent; },
    act() { if (actCb) actCb(); },
    get menuOpen() { return [el.title, el.pause, el.settings, el.select, el.endcard, el.failcard, el.bustcard].some((n) => !n.hidden); },
    onPauseButton(fn) { press($('btn-pause-story'), fn); },
  };
}
