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
import { CREDITS, rollCredits } from './credits.js';

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
    convoy: $('convoy'), cvLabel: $('cv-label'), cvBar: $('cv-bar').firstElementChild, cvNum: $('cv-num'), cvCars: $('cv-cars'),
    title: $('title'), pause: $('pause'), settings: $('settings'), select: $('select'), endcard: $('endcard'), failcard: $('failcard'),
    debug: $('debug'), gallery: $('gallery'), finale: $('finale'),
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
    el.who.classList.toggle('wren', s.kind === 'wren' || s.kind === 'wrenTheo');
    el.who.classList.toggle('radio', s.kind === 'radio');           // a voice over the radio (Rask, Chapter 5)
    // Chapter 8: THEO over a broken radio ('signal': the words come through in pieces) and WREN for a moment in a
    // voice more like his ('wrenTheo')
    el.who.classList.toggle('signal', s.kind === 'signal');
    el.who.classList.toggle('wrenTheo', s.kind === 'wrenTheo');
    el.who.classList.toggle('tv', s.kind === 'tv');                 // the man on the TV (Chapter 9)
    el.who.classList.toggle('machine', s.kind === 'machine');       // a small machine's voice (Mila, Chapter 9)
    el.text.classList.toggle('machine', s.kind === 'machine');
    el.subs.classList.toggle('signal', s.kind === 'signal');
    el.text.classList.toggle('thought', s.kind === 'thought');
    el.text.classList.toggle('wrenTheo', s.kind === 'wrenTheo');
    if (s.kind === 'signal') { sig = { text: s.text, t: 0, gaps: signalGaps(s.text), last: '' }; drawSignal(0); }
    else { sig = null; el.text.textContent = s.text; }
    subLeft = s.seconds;
    el.wren.classList.toggle('on', s.kind === 'wren' || s.kind === 'wrenTheo');
    el.wren.classList.toggle('warm', s.kind === 'wrenTheo');
    if (s.onShow) s.onShow(s.seconds);         // (how long the line stays: the speaker's mouth is timed to it)
  }
  // ---- THE BROKEN SIGNAL (Chapter 8): a line comes through letter by letter, a little late; now and then a word drops
  // out into static for a moment and comes back. In the end the whole line is there (it must be read).
  let sig = null;
  function signalGaps(text) {
    // two or three short drop-outs, each over one word, at places that are the same every time for the same line
    const gaps = [], words = [];
    text.replace(/\S+/g, (w, i) => { words.push([i, i + w.length]); return w; });
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    const n = Math.min(words.length > 6 ? 3 : 2, Math.max(0, words.length - 2));
    for (let k = 0; k < n; k++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const w = words[1 + (h % Math.max(1, words.length - 1))];
      if (w && !gaps.some((g) => g.a === w[0])) gaps.push({ a: w[0], b: w[1], at: 0.25 + (k * 0.3) + ((h >>> 8) % 100) / 900, len: 0.28 + ((h >>> 16) % 100) / 500 });
    }
    return gaps;
  }
  const NOISE = '\u2591\u2592\u00B7';
  function drawSignal(dt) {
    if (!sig) return;
    sig.t += dt;
    const T = sig.text, n = T.length;
    // (it starts a little late, like a delay on the line; then about 30 letters a second)
    const shown = Math.max(0, Math.min(n, Math.floor((sig.t - 0.18) * 30)));
    const k = n ? sig.t / Math.max(0.6, n / 30 + 0.6) : 1;
    let out = '';
    for (let i = 0; i < shown; i++) {
      const ch = T[i];
      const g = sig.gaps.find((q) => i >= q.a && i < q.b && k > q.at && k < q.at + q.len);
      out += g && ch !== ' ' ? NOISE[(i + Math.floor(sig.t * 14)) % NOISE.length] : ch;
    }
    const rest = T.slice(shown);
    const html = `${esc(out)}<span class="sig-rest">${esc(rest)}</span>`;
    if (html !== sig.last) { sig.last = html; el.text.innerHTML = html; }
  }
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // how long a line stays: long enough to read it
  const readTime = (text) => Math.max(1.9, Math.min(7, 1.1 + text.length * 0.062));
  // who: name shown above (may be ''), kind: '' | 'wren' | 'thought' | 'radio'
  function say(who, text, opts = {}) {
    const s = { who, text, seconds: opts.seconds || readTime(text), kind: opts.kind || '', onShow: opts.onShow || null, onDone: opts.onDone || null, hold: !!opts.hold };
    if (opts.now || (!subNow && !queue.length)) { queue.length = opts.now ? 0 : queue.length; showSub(s); } else queue.push(s);
    return s.seconds;
  }
  function clearSubs() { queue.length = 0; subNow = null; subLeft = 0; sig = null; el.subs.hidden = true; el.wren.classList.remove('on'); }
  // the line on the screen is over: the next one, or nothing
  function nextSub() {
    const done = subNow && subNow.onDone;
    subNow = null; subLeft = 0;
    if (queue.length) showSub(queue.shift()); else { el.subs.hidden = true; el.wren.classList.remove('on'); }
    if (done) done();
  }
  // a question (hold: true) stays on the screen while its buttons are there; it goes when it is answered
  function dropHeld() { if (subNow && subNow.hold) nextSub(); }

  // ------------------------------------------------------------ choices
  let choiceDone = null, choiceLeft = 0, choiceTotal = 0, choiceDefault = 0;
  // options: list of texts (at most 2 are shown), cb(index). seconds: after this time the default is taken (0 = wait forever)
  // (layout 'radio', Chapter 8: up to four big replies in two rows near the top of the picture, away from the driving
  //  buttons; the last one is usually the silence)
  function choice(prompt, options, cb, seconds = 0, def = 0, layout = '') {
    // (no options: take the choice away)
    if (!options) { el.choices.hidden = true; el.choices.textContent = ''; el.choices.className = ''; choiceDone = null; choiceLeft = 0; body.classList.remove('choosing'); body.classList.remove('choosing-radio'); dropHeld(); return; }
    el.choices.textContent = '';
    el.choices.className = layout || '';
    body.classList.toggle('choosing-radio', layout === 'radio');
    if (prompt) { const p = document.createElement('div'); p.className = 'prompt'; p.textContent = prompt; el.choices.appendChild(p); }
    options.slice(0, layout === 'radio' ? 4 : layout === 'final' ? 2 : 3).forEach((text, i) => { const b = button(text, ''); press(b, () => pick(i)); el.choices.appendChild(b); });
    if (seconds > 0) { const bar = document.createElement('div'); bar.className = 'bar'; bar.appendChild(document.createElement('i')); el.choices.appendChild(bar); }
    el.choices.hidden = false;
    body.classList.add('choosing');            // (the subtitle moves up, over the buttons: a question stays readable)
    choiceDone = cb; choiceLeft = choiceTotal = seconds; choiceDefault = def;
  }
  function pick(i) { const cb = choiceDone; choiceDone = null; el.choices.hidden = true; el.choices.className = ''; body.classList.remove('choosing'); body.classList.remove('choosing-radio'); dropHeld(); if (cb) cb(i); }

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
  // (mode 'big': a big button away from the driving controls - the HACK of Chapter 9, pressed while driving)
  function prompt(label, cb = null, mode = null) {
    actCb = label ? cb : null;
    if (el.act.hidden === !!label) el.act.hidden = !label;
    if (label && el.act.textContent !== label) el.act.textContent = label;
    const big = !!label && mode === 'big';
    if (el.act.classList.contains('big') !== big) el.act.classList.toggle('big', big);
  }
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

  // ---- THE CONVOY (Chapter 9): how Dante is (the load of the prison truck) and the Guard cars, out or not ----
  //   h: { dante: 0..1, escorts: [{ id, role: 'escort' | 'lead', out }], target: id } or null; L: the words
  const CAR_ICON = '<svg viewBox="0 0 12 22" width="11" height="20" aria-hidden="true"><rect x="1" y="1" width="10" height="20" rx="3.2" fill="currentColor"/>'
    + '<rect x="2.6" y="5" width="6.8" height="4" rx="1" fill="rgba(0,0,0,0.45)"/><rect x="2.6" y="14" width="6.8" height="3" rx="1" fill="rgba(0,0,0,0.45)"/></svg>';
  let cvKey = '', cvLast = -1;
  function convoy(h, L = {}) {
    if (!h) { if (!el.convoy.hidden) { el.convoy.hidden = true; body.classList.remove('convoy'); } cvKey = ''; cvLast = -1; return; }
    if (el.convoy.hidden) body.classList.add('convoy');
    const d = Math.round(h.dante * 100);
    const key = d + '|' + h.target + '|' + h.escorts.map((e) => e.id + (e.out ? 'x' : 'o')).join(',');
    if (key === cvKey) return;
    cvKey = key;
    if (el.convoy.hidden) el.convoy.hidden = false;
    // (Dante's bar shakes when the truck is hit)
    if (cvLast >= 0 && d < cvLast - 1) { el.convoy.classList.remove('hit'); void el.convoy.offsetWidth; el.convoy.classList.add('hit'); }
    cvLast = d;
    el.cvLabel.textContent = L.dante || 'DANTE';
    el.cvBar.style.width = d + '%';
    el.cvNum.textContent = String(d);
    el.convoy.classList.toggle('warn', d < 60 && d >= 30);
    el.convoy.classList.toggle('bad', d < 30);
    el.cvCars.innerHTML = h.escorts.map((e) => `<span class="cv-car ${e.role}${e.out ? ' out' : ''}${!e.out && e.id === h.target ? ' target' : ''}">${CAR_ICON}<b>${e.out ? (L.out || 'OUT') : e.role === 'lead' ? (L.lead || 'LEAD') : (L.escort || 'ESCORT')}</b></span>`).join('');
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
  const MENUS = () => [el.title, el.pause, el.settings, el.select, el.endcard, el.failcard, el.bustcard, el.debug, el.gallery, el.finale];
  function hideMenus() { for (const n of MENUS()) n.hidden = true; }
  // info: { canContinue, where: text under CONTINUE, gallery: endings seen }, cb(action): 'continue' | 'new' | 'free' |
  // 'select' | 'settings' | 'gallery' | 'debug' (three quick taps on the game's name: the hidden DEBUG FLAGS screen)
  function title(info, cb) {
    hideMenus();
    const n = screen(el.title, `<h1>${t('ui.game')}</h1><div class="sub">${info.tagline || t('ui.tagline')}</div>${info.under ? `<div class="sub under">${info.under}</div>` : ''}<div class="menu-col"></div>`), col = n.querySelector('.menu-col');
    let taps = 0, tapAt = 0;
    press(n.querySelector('h1'), () => {
      const now = performance.now();
      taps = now - tapAt < 650 ? taps + 1 : 1; tapAt = now;
      if (taps >= 3) { taps = 0; cb('debug'); }
    });
    const add = (label, action, cls = 'btn') => { const b = button(label, cls); press(b, () => cb(action)); col.appendChild(b); return b; };
    if (info.canContinue) { add(t('ui.continue'), 'continue', 'btn main'); if (info.where) { const d = document.createElement('div'); d.className = 'note'; d.textContent = info.where; col.appendChild(d); } }
    if (!info.canContinue) add(t('ui.new_game'), 'new', 'btn main');
    else {
      // a saved game would be erased: the button must be pressed twice
      const b = button(t('ui.new_game'), 'btn'); let armed = false;
      press(b, () => { if (armed) cb('new'); else { armed = true; b.textContent = t('ui.new_confirm'); } });
      col.appendChild(b);
    }
    // (the Ending gallery is there once an ending was seen)
    if (info.gallery) add(t('ui.gallery'), 'gallery');
    add(t('ui.missions'), 'select'); add(t('ui.free_roam'), 'free'); add(t('ui.online'), 'online'); add(t('ui.settings'), 'settings');
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
    // GRAPHICS: one button that opens its own screen (the level, and the single options over it)
    {
      const r = document.createElement('div'); r.className = 'set-row'; r.innerHTML = '<span></span><span class="opts"></span>';
      r.firstElementChild.textContent = t('ui.quality');
      const b = button(t('ui.gfx.open'));
      press(b, () => graphicsScreen(values, onChange, () => settingsScreen(values, onChange, onBack)));
      r.lastElementChild.appendChild(b);
      col.appendChild(r);
    }
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
  // THE GRAPHICS SCREEN: the level (AUTO looks at the phone and goes down when the game runs slowly) and the player's
  // own options over it. Every row: 'auto' = as the level says. A line at the bottom says what is running now.
  // values: { quality, gfx: { sharp, shadows, effects, distance, people, traffic, fps }, label(), cap() }
  function graphicsScreen(values, onChange, onBack) {
    hideMenus();
    const n = screen(el.settings, `<h2>${t('ui.gfx.title')}</h2><div class="menu-col gfx-col" style="width:min(430px,94vw)"></div>`), col = n.querySelector('.menu-col');
    const g = values.gfx || {};
    const note = document.createElement('div'); note.className = 'gfx-note';
    const say = () => { note.textContent = t('ui.gfx.now').replace('{level}', values.label ? values.label() : '').replace('{cap}', values.cap ? String(values.cap()) : ''); };
    const row = (label, opts, current, key, hint) => {
      const r = document.createElement('div'); r.className = 'set-row'; r.innerHTML = '<span></span><span class="opts"></span>';
      r.firstElementChild.textContent = label;
      if (hint) { const h = document.createElement('small'); h.textContent = hint; r.firstElementChild.appendChild(h); }
      for (const [value, text] of opts) {
        const b = button(text); b.classList.toggle('on', value === current);
        press(b, () => {
          for (const o of r.querySelectorAll('.btn')) o.classList.remove('on');
          b.classList.add('on');
          if (key === 'quality') values.quality = value; else g[key.slice(4)] = value;
          onChange(key, value);
          // (the level is applied a frame later: the line at the bottom follows by itself, see below)
        });
        r.lastElementChild.appendChild(b);
      }
      col.appendChild(r);
    };
    const A = ['auto', t('ui.auto')];
    row(t('ui.gfx.level'), [A, ['verylow', t('ui.gfx.verylow')], ['low', t('ui.low')], ['medium', t('ui.med')], ['high', t('ui.high')]], values.quality, 'quality');
    row(t('ui.gfx.sharp'), [A, ['low', t('ui.gfx.soft')], ['medium', t('ui.med')], ['high', t('ui.gfx.sharp_hi')]], g.sharp, 'gfx.sharp', t('ui.gfx.sharp_hint'));
    row(t('ui.gfx.shadows'), [A, ['off', t('ui.off')], ['on', t('ui.on')]], g.shadows, 'gfx.shadows');
    row(t('ui.gfx.effects'), [A, ['off', t('ui.off')], ['on', t('ui.on')]], g.effects, 'gfx.effects', t('ui.gfx.effects_hint'));
    row(t('ui.gfx.distance'), [A, ['near', t('ui.gfx.near')], ['far', t('ui.gfx.far')]], g.distance, 'gfx.distance');
    row(t('ui.gfx.people'), [A, ['few', t('ui.gfx.few')], ['normal', t('ui.normal')], ['many', t('ui.gfx.many')]], g.people, 'gfx.people');
    row(t('ui.gfx.traffic'), [A, ['few', t('ui.gfx.few')], ['normal', t('ui.normal')], ['many', t('ui.gfx.many')]], g.traffic, 'gfx.traffic');
    row(t('ui.gfx.fps'), [[60, '60'], [30, t('ui.gfx.fps30')]], g.fps === 30 ? 30 : 60, 'gfx.fps', t('ui.gfx.fps_hint'));
    say();
    // (the line follows what is really running, while this screen is open)
    const timer = setInterval(() => { if (!note.isConnected || el.settings.hidden) clearInterval(timer); else say(); }, 400);
    col.appendChild(note);
    const tip = document.createElement('div'); tip.className = 'gfx-note'; tip.textContent = t('ui.gfx.tip'); col.appendChild(tip);
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
  // CHAPTER 10: the clock of the last night (text like '23:57:12', null hides it; late: in red) and the corner sign of
  // a voice in the ear (a name for some seconds)
  function clock(text, late = false) {
    const c = $('clock');
    if (!text) { c.hidden = true; return; }
    if (c.textContent !== text) c.textContent = text;
    c.classList.toggle('late', !!late);
    c.hidden = false;
  }
  let linkLeft = 0;
  function link(name, seconds = 3) {
    const n = $('link');
    if (!name) { n.hidden = true; linkLeft = 0; return; }
    n.lastElementChild.textContent = name;
    n.hidden = false; linkLeft = seconds + 0.4;
  }
  // THE LAST SCREENS OF AN ENDING (Chapter 10): data { title (the ending's name), cards: [{ who, text }] (one line for
  // each friend), stats: [[label, value]], continued (true: "TO BE CONTINUED" after the credits) }, cb(action):
  // 'again' (play again - the endings and rewards stay) | 'gallery' | 'title'.
  // Black, very still: one card at a time (a tap goes on), the numbers of the story, the credits rolling up, the
  // buttons.
  function finale(data, cb) {
    hideMenus();
    const n = el.finale;
    n.innerHTML = ''; n.hidden = false; n.className = 'screen';
    const stage = document.createElement('div'); stage.className = 'f-stage'; n.appendChild(stage);
    let timer = null, next = null;
    const later = (fn, seconds) => { clearTimeout(timer); next = fn; timer = setTimeout(() => { next = null; fn(); }, seconds * 1000); };
    // a tap goes to the next card at once
    n.onpointerdown = (e) => { if (e.target.closest('.btn')) return; if (next) { const f = next; next = null; clearTimeout(timer); f(); } };
    const card = (who, text) => {
      stage.innerHTML = '';
      const c = document.createElement('div'); c.className = 'f-card';
      if (who) { const w = document.createElement('div'); w.className = 'f-who'; w.textContent = who; c.appendChild(w); }
      const l = document.createElement('div'); l.className = 'f-line'; l.textContent = text; c.appendChild(l);
      stage.appendChild(c);
    };
    const cards = data.cards || [];
    let i = 0;
    const nextCard = () => {
      if (i >= cards.length) { stats(); return; }
      const c = cards[i++];
      card(c.who, c.text);
      later(nextCard, Math.max(3.6, 1.6 + c.text.length * 0.055));
    };
    function stats() {
      stage.innerHTML = '';
      const box = document.createElement('div'); box.className = 'f-stats';
      const h = document.createElement('div'); h.className = 'f-head'; h.textContent = data.title || ''; box.appendChild(h);
      for (const [label, value] of data.stats || []) {
        const r = document.createElement('div'); r.className = 'f-row';
        const a = document.createElement('span'); a.textContent = label; const b = document.createElement('span'); b.textContent = value;
        r.appendChild(a); r.appendChild(b); box.appendChild(r);
      }
      stage.appendChild(box);
      later(credits, 7);
    }
    function credits() {
      stage.innerHTML = '';
      const roll = document.createElement('div'); roll.className = 'f-credits'; stage.appendChild(roll);
      next = null;
      rollCredits(roll, data.credits || CREDITS, 34, () => (data.continued ? continued() : buttons()));
    }
    function continued() {
      card('', t('end.continued'));
      later(buttons, 5);
    }
    function buttons() {
      stage.innerHTML = '';
      const col = document.createElement('div'); col.className = 'menu-col';
      for (const [label, action, cls] of [[t('end.again'), 'again', 'btn main'], [t('ui.gallery'), 'gallery', 'btn'], [t('ui.title'), 'title', 'btn']]) {
        const b = button(label, cls); press(b, () => { clearTimeout(timer); n.onpointerdown = null; cb(action); }); col.appendChild(b);
      }
      const note = document.createElement('div'); note.className = 'note'; note.textContent = t('end.again_note'); col.appendChild(note);
      stage.appendChild(col);
    }
    nextCard();
  }
  // THE ENDING GALLERY: items [{ key, label, line, seen }], cb(item) (null = back). An ending not seen yet is a
  // closed card with no name.
  function gallery(items, cb) {
    hideMenus();
    const n = screen(el.gallery, `<h2>${t('ui.gallery')}</h2><div class="list"></div><div class="menu-col"></div>`);
    const listNode = n.querySelector('.list');
    for (const it of items) {
      const c = document.createElement('div'); c.className = 'g-card' + (it.seen ? ' seen' : '');
      const h = document.createElement('div'); h.className = 'g-name'; h.textContent = it.seen ? it.label : t('ui.gallery_locked');
      const l = document.createElement('div'); l.className = 'g-line'; l.textContent = it.seen ? it.line : t('ui.gallery_hint');
      c.appendChild(h); c.appendChild(l);
      if (it.seen) { const b = button(t('ui.gallery_play'), 'btn'); press(b, () => cb(it)); c.appendChild(b); }
      listNode.appendChild(c);
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
    if (sig && subNow) drawSignal(dt);
    if (subNow) {
      subLeft -= dt;
      if (subLeft <= 0) {
        // (a question waits for its answer on the screen; the speaker has stopped talking)
        if (subNow.hold && choiceDone) { const done = subNow.onDone; subNow.onDone = null; if (done) done(); }
        else nextSub();
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
    if (linkLeft > 0) { linkLeft -= dt; if (linkLeft <= 0) $('link').hidden = true; }
  }
  // everything of the story off the screen (leaving the story, restarting a checkpoint)
  function reset() {
    cine(false); clearSubs(); skip(null); limiter(null); prompt(null); tip(null); tape(false); mirror(false); limitBadge(0, false); cargo(null); convoy(null);
    card(null); el.choices.hidden = true; el.choices.className = ''; choiceDone = null; el.reader.hidden = true; body.classList.remove('quiet'); body.classList.remove('choosing'); body.classList.remove('choosing-radio'); body.classList.remove('steady-link');
    paint(null); video('off'); clock(null); link(null);
  }

  return {
    settings, update, reset,
    // change one setting from outside the settings screen (the TILT and SOUND buttons) and remember it
    setSetting(key, value) { settings[key] = value; saveSettings(); applyLook(); },
    cine, fade, card, say, clearSubs, choice, skip, limiter, prompt, tip, tape, limitBadge, cargo, convoy, mirror, drawMirror, reader,
    title, pause, settingsScreen, select, endCard, failCard, hideMenus, paint, paintProgress, video, bustCard, gallery, clock, link, finale,
    quiet(on) { body.classList.toggle('quiet', !!on); },
    // a calm chapter (Chapter 6): no minimap, no stars, no timer; big soft buttons (index.html, body.calm)
    calm(on) { body.classList.toggle('calm', !!on); },
    storyMode(on) { body.classList.toggle('story', !!on); },
    get subsBusy() { return !!subNow || queue.length > 0; },
    get choosing() { return !!choiceDone; },
    get actShown() { return !el.act.hidden; },
    get actLabel() { return el.act.hidden ? null : el.act.textContent; },
    act() { if (actCb) actCb(); },
    get menuOpen() { return MENUS().some((n) => !n.hidden); },
    // the last screens of the story are open: they are black and cover everything, so nothing is drawn under them
    get coverOpen() { return !el.finale.hidden; },
    onPauseButton(fn) { press($('btn-pause-story'), fn); },
  };
}
