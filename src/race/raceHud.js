// ---------------------------------------------------------------------------
// raceHud.js - what the player sees during a race (only HTML, no 3D).
//
//   top middle   POSITION (big: 2/6), LAP 1/3, the race time
//   under it     the gauge to the next checkpoint (a thin bar + meters)
//   middle       the countdown (3, 2, 1, GO) and short notes: FINAL LAP, MISSED CHECKPOINT - GO BACK,
//                WRONG WAY, DRIFT BOOST, SLIPSTREAM
//   top left     RESTART (start the race again from the line)
//   cards        the result (place and time) and, after a fail, RETRY (and SKIP after two fails)
//
// Everything sits where a thumb does not cover it, and the subtitles get a darker plate while racing (they
// must be readable at 200 km/h).
// ---------------------------------------------------------------------------

const CSS = `
#race-hud { position: absolute; inset: 0; pointer-events: none; z-index: 6; font-family: inherit; color: #fff; }
#race-hud[hidden] { display: none; }
#race-top { position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); text-align: center; text-shadow: 0 1px 4px rgba(0,0,0,0.85); }
#race-pos { font-size: 34px; font-weight: 700; letter-spacing: 0.02em; line-height: 1; }
#race-pos small { font-size: 15px; font-weight: 600; opacity: 0.75; }
#race-lap { margin-top: 3px; font-size: 11px; letter-spacing: 0.18em; opacity: 0.9; }
#race-gauge { width: 150px; height: 3px; margin: 6px auto 0; background: rgba(255,255,255,0.18); border-radius: 2px; overflow: hidden; }
#race-gauge i { display: block; height: 100%; width: 0%; background: #ffc94a; }
#race-cp { margin-top: 3px; font-size: 10px; letter-spacing: 0.14em; opacity: 0.75; }
#race-msg { position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); font-size: 17px; font-weight: 700; letter-spacing: 0.16em; text-shadow: 0 2px 8px rgba(0,0,0,0.9); opacity: 0; transition: opacity 0.25s; white-space: nowrap; }
#race-msg.on { opacity: 1; }
#race-msg.warn { color: #ffb14a; }
#race-count { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%) scale(1); font-size: 84px; font-weight: 800; text-shadow: 0 4px 18px rgba(0,0,0,0.85); opacity: 0; }
#race-count.pop { animation: racepop 0.9s ease-out; }
@keyframes racepop { 0% { opacity: 0; transform: translate(-50%,-50%) scale(1.6); } 15% { opacity: 1; transform: translate(-50%,-50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%,-50%) scale(0.92); } }
#race-replay { position: absolute; top: calc(14px + env(safe-area-inset-top)); left: calc(16px + env(safe-area-inset-left)); font-size: 12px; letter-spacing: 0.3em; padding: 4px 9px; border: 1px solid rgba(255,255,255,0.6); border-radius: 4px; background: rgba(0,0,0,0.35); }
#race-replay[hidden] { display: none; }
#race-restart { position: absolute; pointer-events: auto; top: calc(150px + env(safe-area-inset-top)); left: calc(14px + env(safe-area-inset-left)); width: 54px; height: 54px; border-radius: 50%; font-size: 9px; letter-spacing: 0.08em; line-height: 1.2; }
#race-card { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: auto; background: rgba(4,5,7,0.55); }
#race-card[hidden] { display: none; }
#race-card .box { min-width: min(320px, 86vw); padding: 18px 20px 16px; border-radius: 10px; background: rgba(10,12,15,0.9); border: 1px solid rgba(255,255,255,0.14); text-align: center; }
#race-card h2 { margin: 0; font-size: 24px; letter-spacing: 0.12em; }
#race-card .sub { margin: 6px 0 12px; font-size: 13px; opacity: 0.8; letter-spacing: 0.06em; }
#race-card .row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 4px; opacity: 0.85; }
#race-card .row.me { color: #ffc94a; opacity: 1; }
#race-card .btns { display: flex; gap: 10px; justify-content: center; margin-top: 14px; }
#race-card .btns .btn { position: static; min-width: 110px; height: 44px; font-size: 12px; letter-spacing: 0.12em; }
body.racing #subs .plate { background: rgba(0,0,0,0.78); }
/* (a film scene in the middle of a race - the last turn of the final race: no race HUD over the picture) */
body.cine #race-top, body.cine #race-msg, body.cine #race-count, body.cine #race-restart { display: none !important; }
body.racing #subs-text { font-size: calc(var(--sub, 16px) + 2px); }
`;

export function createRaceHud(onRestart) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'race-hud';
  root.hidden = true;
  root.innerHTML = `
    <div id="race-top"><div id="race-pos">1<small>/6</small></div><div id="race-lap"></div><div id="race-gauge"><i></i></div><div id="race-cp"></div></div>
    <div id="race-msg"></div>
    <div id="race-count"></div>
    <div id="race-replay" hidden>REPLAY</div>
    <button class="btn" id="race-restart" aria-label="Restart the race">&#8634;<br>RESTART</button>
    <div id="race-card" hidden><div class="box"></div></div>`;
  (document.getElementById('hud') || document.body).appendChild(root);
  const $ = (id) => root.querySelector('#' + id);
  const el = { pos: $('race-pos'), lap: $('race-lap'), gauge: $('race-gauge').firstElementChild, cp: $('race-cp'), msg: $('race-msg'), count: $('race-count'), replay: $('race-replay'), restart: $('race-restart'), card: $('race-card') };
  el.restart.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onRestart(); });
  let msgUntil = 0, msgText = '', now = 0;
  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };

  return {
    show(on) { root.hidden = !on; document.body.classList.toggle('racing', !!on); if (!on) { el.card.hidden = true; el.replay.hidden = true; } },
    // d: { pos, of, lap, laps, time, cpDist, cpFrac, label }
    set(d) {
      el.pos.innerHTML = `${d.pos}<small>/${d.of}</small>`;
      el.lap.textContent = `${d.laps > 1 ? `LAP ${Math.min(d.lap, d.laps)}/${d.laps}  ·  ` : ''}${fmt(d.time)}${d.limit ? `  /  ${fmt(d.limit)}` : ''}`;
      el.gauge.style.width = `${Math.round(Math.max(0, Math.min(1, d.cpFrac)) * 100)}%`;
      el.cp.textContent = d.cpDist !== null ? `${d.label || 'CHECKPOINT'}  ${Math.max(0, Math.round(d.cpDist))} M` : '';
    },
    // a short note in the middle (warn: orange)
    note(text, seconds = 1.6, warn = false) {
      if (text === msgText && now < msgUntil) { msgUntil = now + seconds; return; }
      msgText = text; msgUntil = now + seconds;
      el.msg.textContent = text; el.msg.classList.toggle('warn', warn); el.msg.classList.add('on');
    },
    count(text) { el.count.textContent = text; el.count.classList.remove('pop'); void el.count.offsetWidth; el.count.classList.add('pop'); },
    replay(on) { el.replay.hidden = !on; el.restart.hidden = !!on; },
    restartButton(on) { el.restart.hidden = !on; },
    // card: { title, sub, rows: [{ name, place, time, me }], buttons: [[label, action]] }, cb(action)
    card(c, cb) {
      if (!c) { el.card.hidden = true; return; }
      const box = el.card.firstElementChild;
      box.innerHTML = `<h2>${c.title}</h2><div class="sub">${c.sub || ''}</div>` +
        (c.rows || []).map((r) => `<div class="row${r.me ? ' me' : ''}"><span>${r.place}. ${r.name}</span><span>${r.time || ''}</span></div>`).join('') +
        `<div class="btns">${c.buttons.map((b, i) => `<button class="btn${i === 0 ? ' main' : ''}" data-i="${i}">${b[0]}</button>`).join('')}</div>`;
      for (const b of box.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.card.hidden = true; cb(c.buttons[+b.dataset.i][1]); });
      el.card.hidden = false;
    },
    update(dt) {
      now += dt;
      if (msgText && now >= msgUntil) { el.msg.classList.remove('on'); msgText = ''; }
    },
    fmt,
  };
}
