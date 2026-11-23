// ---------------------------------------------------------------------------
// repair.js - REBUILDING THEO'S CAR (Chapter 6, "Old Debts").
//
// Six calm stations, one after the other. Each one is a single, slow thing for
// one thumb (10 to 30 seconds), on a soft panel at the right of the screen,
// while the film camera holds a close-up of the part and Mace tells a story:
//
//   1. the cloth      SLIDE UP, slowly         - the cloth slides off the car
//   2. the frame      PULL DOWN AND HOLD       - the chain pulls the bent corner straight
//   3. the bumper     DRAG IT INTO ITS PLACE   - the new bumper goes on
//   4. the engine     TURN IT, THEN PRESS DOWN - the air cleaner is turned to its mark and set down
//   5. the lights     SWIPE ONE PLUG TO THE OTHER - the wires meet, the headlights come on
//   6. the dashboard  SLIDE THE DECK IN        - the tape deck (the last part: it stops short the first time)
//
// There is no failing, no score and no clock: letting go never undoes what was
// done, a part dropped in the wrong place floats back to the hand. The story
// engine starts a station with { do: 'repair', station: n, ... } (engine.js)
// and finishes it when the station is done AND Mace's story is told.
//
// The panel only draws; the car itself (src/vehicles/theoCar.js) and the
// garage (src/story/garageSet.js) are changed through their "set" functions,
// so what the fingers do is seen on the real car behind the panel at once.
// Works with a mouse too (the same pointer events).
// ---------------------------------------------------------------------------

const CSS = `
#repair { position: fixed; inset: 0; z-index: 55; pointer-events: none; display: none; user-select: none; -webkit-user-select: none;
  font-family: "Helvetica Neue", Roboto, Arial, sans-serif; color: #f4e9d8; }
#repair.on { display: block; }
#repair .pad { position: absolute; right: calc(3.5vw + env(safe-area-inset-right)); top: 50%; transform: translateY(-58%);
  width: min(40vw, 330px); height: min(58vh, 330px); pointer-events: auto; touch-action: none; border-radius: 26px;
  background: radial-gradient(ellipse at 50% 40%, rgba(255, 236, 205, 0.09), rgba(20, 14, 9, 0.30));
  box-shadow: inset 0 0 0 1px rgba(255, 232, 200, 0.16), 0 10px 40px rgba(0, 0, 0, 0.25);
  -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); transition: opacity 0.8s ease; }
#repair .pad.done { opacity: 0; }
#repair canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#repair .hint { position: absolute; left: 0; right: 0; top: 12px; text-align: center; font-size: 11px; letter-spacing: 0.22em;
  color: rgba(255, 238, 214, 0.62); text-transform: uppercase; pointer-events: none; transition: opacity 0.6s ease; }
@media (max-height: 430px) { #repair .pad { height: min(64vh, 270px); width: min(38vw, 280px); } }
`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

// what each station needs: how the panel looks, what the gesture is
export const STATIONS = {
  1: { kind: 'slide', part: 'cloth' },
  2: { kind: 'pull', part: 'frame' },
  3: { kind: 'drag', part: 'bumper' },
  4: { kind: 'turn', part: 'engine' },
  5: { kind: 'wire', part: 'lights' },
  6: { kind: 'deck', part: 'deck' },
};

// how the car is before a station (so a station can be done again) - garage set G, car C
export function before(n, G, C) {
  const S = C.set;
  if (n === 1) { G.cloth(0); }
  if (n === 2) { S.bend(1); G.chain({ on: true, pull: 0 }); }
  if (n === 3) { S.bumper('none'); }
  if (n === 4) { S.hood(1); S.cleaner({ lift: 1, turn: 2.4 }); }
  if (n === 5) { S.hood(1); S.wires(0); S.lights(0); }
  if (n === 6) { S.deck(0); }
}
// how the car is after it (a skipped station ends here at once)
export function after(n, G, C, stop = 1) {
  const S = C.set;
  if (n === 1) G.cloth(1);
  if (n === 2) { S.bend(0); G.chain({ on: false }); }
  if (n === 3) S.bumper('new');
  if (n === 4) S.cleaner('on');
  if (n === 5) { S.wires(1); S.lights(1); }
  if (n === 6) S.deck(stop >= 1 ? 'in' : stop);
}

export function createRepair() {
  let root = null, pad = null, cv = null, g = null, hintEl = null, run = null;

  function build() {
    if (root) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    root = document.createElement('div');
    root.id = 'repair';
    root.innerHTML = '<div class="pad"><canvas></canvas><div class="hint"></div></div>';
    document.body.appendChild(root);
    pad = root.querySelector('.pad'); cv = root.querySelector('canvas'); hintEl = root.querySelector('.hint');
    g = cv.getContext('2d');
    // (the touches stay here: the stick and the camera under the panel do not get them)
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove']) pad.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev.startsWith('touch') });
    pad.addEventListener('pointerdown', (e) => { if (run) { try { pad.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ } run.down(local(e)); } });
    pad.addEventListener('pointermove', (e) => run && run.move(local(e)));
    pad.addEventListener('pointerup', () => run && run.up());
    pad.addEventListener('pointercancel', () => run && run.up());
  }
  const local = (e) => { const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // o: { station (1..6), car (theoCar), garage (garageSet api), stop (station 6: where the deck stops, 0..1),
  //      from (station 6 again: where it starts), hint (text), sound: { clink, ratchet, creak, clunk, click, slide,
  //      spark } }. Returns a promise: resolved when the station is done.
  function start(o) {
    build();
    if (run) run.finish(true);
    const st = STATIONS[o.station];
    if (!st) return Promise.resolve();
    const C = o.car, G = o.garage, S = C.set, sfx = o.sound || {};
    const play = (name, ...a) => { if (sfx[name]) sfx[name](...a); };
    const buzz = (ms) => { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* not allowed */ } } };
    hintEl.textContent = o.hint || '';
    hintEl.style.opacity = '1';
    pad.classList.remove('done');
    root.classList.add('on');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const size = () => { const r = pad.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
    size();
    const stop = o.stop === undefined ? 1 : o.stop;
    if (o.station !== 6 || !o.from) before(o.station, G, C);

    return new Promise((resolve) => {
      let over = false, raf = 0, last = performance.now(), time = 0, finger = null, grab = null;
      // the state of the gesture (each station uses what it needs)
      const M = { p: o.from || 0, shown: o.from || 0, hold: false, angle: 2.4, aligned: false, drop: 0, dropping: false, placed: false, part: null, snap: 0, wire: null, joined: 0, creakT: 0, slideT: 0 };
      if (st.kind === 'drag') M.part = { x: 0, y: 0, home: true };
      // ---------------------------------------------------------------- the car follows the panel
      function apply(dt) {
        if (st.kind === 'slide') { M.shown += (M.p - M.shown) * Math.min(1, dt * 2.6); G.cloth(M.shown); }
        else if (st.kind === 'pull') {
          const k = M.hold ? 1 : 0;
          M.pullShow = (M.pullShow || 0) + (k * (0.55 + 0.45 * M.p) - (M.pullShow || 0)) * Math.min(1, dt * 4);
          G.chain({ on: true, pull: M.pullShow });
          M.shown += (M.p - M.shown) * Math.min(1, dt * 3); S.bend(1 - M.shown);
        } else if (st.kind === 'drag') { if (M.placed) { M.snap = Math.min(1, M.snap + dt / 1.7); S.bumper(ease(M.snap)); } }
        else if (st.kind === 'turn') {
          const lift = M.dropping ? 1 - ease(M.drop) : 1;
          S.cleaner({ lift, turn: M.angle });
        } else if (st.kind === 'wire') {
          S.wires(M.joined > 0 ? Math.min(1, M.joined * 2.5) : (M.wire ? 0.12 : 0));
          if (M.joined > 0) {
            // the headlights catch: a flicker, then they burn
            const j = M.joined;
            S.lights(j < 0.25 ? 0 : j < 0.32 ? 0.9 : j < 0.4 ? 0.1 : j < 0.5 ? 1 : j < 0.56 ? 0.4 : 1);
          }
        } else if (st.kind === 'deck') { M.shown += (M.p - M.shown) * Math.min(1, dt * 3.2); S.deck(M.shown); }
      }
      // ---------------------------------------------------------------- the panel
      const ink = (a) => `rgba(255, 238, 214, ${a})`, warm = (a) => `rgba(255, 196, 120, ${a})`;
      function circle(x, y, r, fill, stroke, lw = 2) { g.beginPath(); g.arc(x, y, r, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
      function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
      const breathe = () => 0.5 + 0.5 * Math.sin(time * 2.2);
      // where things are on the panel (they depend on its size)
      const L = () => ({
        trackTop: H * 0.2, trackBot: H * 0.84, cx: W / 2, cy: H * 0.54, r: Math.min(W, H) * 0.27,
        slot: { x: W * 0.62, y: H * 0.3 }, home: { x: W * 0.36, y: H * 0.78 }, plugA: { x: W * 0.2, y: H * 0.56 }, plugB: { x: W * 0.8, y: H * 0.56 },
      });
      function draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        const P = L();
        g.lineCap = 'round'; g.lineJoin = 'round';
        if (st.kind === 'slide' || st.kind === 'deck') {
          const top = P.trackTop, bot = P.trackBot, x = P.cx;
          const lim = st.kind === 'deck' ? stop : 1;
          // the track, and how far it has gone
          g.strokeStyle = ink(0.13); g.lineWidth = 16; g.beginPath(); g.moveTo(x, bot); g.lineTo(x, top); g.stroke();
          const yAt = (p) => bot - (bot - top) * p;
          g.strokeStyle = warm(0.55); g.lineWidth = 16; g.beginPath(); g.moveTo(x, bot); g.lineTo(x, yAt(M.p)); g.stroke();
          if (lim < 1) { g.strokeStyle = ink(0.35); g.lineWidth = 2; g.beginPath(); g.moveTo(x - 26, yAt(lim)); g.lineTo(x + 26, yAt(lim)); g.stroke(); }
          // a soft arrow up, while nothing has moved yet
          if (M.p < 0.04 && !grab) { const a = 0.25 + 0.35 * breathe(); g.strokeStyle = ink(a); g.lineWidth = 3; for (const k of [0, 1]) { const y = yAt(0.3 + k * 0.12); g.beginPath(); g.moveTo(x - 14, y + 8); g.lineTo(x, y - 6); g.lineTo(x + 14, y + 8); g.stroke(); } }
          // the handle: a fold of cloth / the deck
          const y = yAt(M.p);
          if (st.kind === 'slide') { circle(x, y, 34, warm(grab ? 0.35 : 0.22), ink(0.8), 2.5); g.strokeStyle = ink(0.6); g.lineWidth = 2; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(x - 14, y + k * 8 + 2); g.quadraticCurveTo(x, y + k * 8 - 4, x + 14, y + k * 8 + 2); g.stroke(); } }
          else { rrect(x - 44, y - 16, 88, 32, 7); g.fillStyle = 'rgba(22, 20, 18, 0.85)'; g.fill(); g.strokeStyle = ink(0.8); g.lineWidth = 2; g.stroke(); rrect(x - 26, y - 5, 52, 10, 3); g.fillStyle = 'rgba(0,0,0,0.9)'; g.fill(); circle(x + 34, y, 3, 'rgba(95, 200, 175, 0.9)'); }
        } else if (st.kind === 'pull') {
          const x = P.cx, top = P.trackTop, zone = H * 0.7;
          // the zone at the bottom where it is held
          g.fillStyle = warm(0.08 + (M.hold ? 0.1 : 0)); rrect(x - 70, zone, 140, H * 0.24, 22); g.fill();
          g.strokeStyle = ink(0.25); g.lineWidth = 1.5; g.stroke();
          // the chain from the top to the handle
          const hy = grab ? clamp(finger[1], top, H * 0.86) : top + (M.spring || 0);
          g.strokeStyle = ink(0.5); g.lineWidth = 3; g.setLineDash([7, 6]); g.beginPath(); g.moveTo(x, 6); g.lineTo(x, hy); g.stroke(); g.setLineDash([]);
          circle(x, hy, 32, warm(M.hold ? 0.45 : 0.2), ink(0.85), 2.5);
          g.strokeStyle = ink(0.7); g.lineWidth = 3; g.beginPath(); g.moveTo(x - 12, hy); g.lineTo(x + 12, hy); g.stroke();
          // how straight the frame is now: a ring that fills
          g.strokeStyle = ink(0.15); g.lineWidth = 6; g.beginPath(); g.arc(W - 34, 34, 18, 0, TAU); g.stroke();
          g.strokeStyle = warm(0.8); g.beginPath(); g.arc(W - 34, 34, 18, -Math.PI / 2, -Math.PI / 2 + TAU * M.p); g.stroke();
          if (!grab && M.p < 0.03) { const a = 0.25 + 0.35 * breathe(); g.strokeStyle = ink(a); g.lineWidth = 3; for (const k of [0, 1]) { const y = top + 70 + k * 16; g.beginPath(); g.moveTo(x - 14, y - 8); g.lineTo(x, y + 6); g.lineTo(x + 14, y - 8); g.stroke(); } }
        } else if (st.kind === 'drag') {
          // the place (a soft dashed outline), the new bumper (a long chrome-edged bar)
          const s = P.slot, glow = M.placed ? 0.8 : 0.3 + 0.25 * breathe();
          g.setLineDash([8, 7]); g.strokeStyle = ink(glow); g.lineWidth = 2; rrect(s.x - 70, s.y - 16, 140, 32, 14); g.stroke(); g.setLineDash([]);
          const pp = M.placed ? s : M.part.home ? P.home : M.part;
          rrect(pp.x - 70, pp.y - 15, 140, 30, 14); g.fillStyle = 'rgba(32, 58, 110, 0.92)'; g.fill();
          g.strokeStyle = 'rgba(225, 230, 238, 0.95)'; g.lineWidth = 3; g.beginPath(); g.moveTo(pp.x - 62, pp.y - 4); g.lineTo(pp.x + 62, pp.y - 4); g.stroke();
          g.strokeStyle = ink(0.5); g.lineWidth = 1.5; rrect(pp.x - 70, pp.y - 15, 140, 30, 14); g.stroke();
          if (!grab && !M.placed && M.part.home) { const a = 0.25 + 0.35 * breathe(); g.strokeStyle = ink(a); g.lineWidth = 3; g.beginPath(); g.moveTo(P.home.x + 12, P.home.y - 34); g.lineTo(s.x - 12, s.y + 30); g.stroke(); }
        } else if (st.kind === 'turn') {
          const { cx, cy, r } = P;
          // the mark at the top, the part (seen from above) with its notch
          g.fillStyle = M.aligned ? warm(0.95) : ink(0.6); g.beginPath(); g.moveTo(cx, cy - r - 22); g.lineTo(cx - 9, cy - r - 36); g.lineTo(cx + 9, cy - r - 36); g.closePath(); g.fill();
          const lift = M.dropping ? 1 - ease(M.drop) : 1;
          const rr = r * (0.92 + 0.08 * lift);
          circle(cx, cy + (1 - lift) * 8, rr, 'rgba(30, 32, 36, 0.88)', ink(M.aligned ? 0.9 : 0.55), 3);
          circle(cx, cy + (1 - lift) * 8, rr * 0.34, 'rgba(70, 74, 82, 0.95)', ink(0.35), 2);
          for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + M.angle; g.strokeStyle = ink(0.18); g.lineWidth = 2; g.beginPath(); g.moveTo(cx + Math.sin(a) * rr * 0.5, cy - Math.cos(a) * rr * 0.5); g.lineTo(cx + Math.sin(a) * rr * 0.86, cy - Math.cos(a) * rr * 0.86); g.stroke(); }
          const na = M.angle;
          g.fillStyle = M.aligned ? warm(1) : warm(0.85); g.beginPath(); g.arc(cx + Math.sin(na) * rr * 0.93, cy - Math.cos(na) * rr * 0.93, 7, 0, TAU); g.fill();
          if (!grab && !M.aligned) { const a = 0.2 + 0.3 * breathe(); g.strokeStyle = ink(a); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r + 16, -2.2, -0.9); g.stroke(); }
          if (M.aligned && !M.dropping) { const a = 0.3 + 0.4 * breathe(); g.strokeStyle = ink(a); g.lineWidth = 3; for (const k of [0, 1]) { const y = cy + r + 16 + k * 14; g.beginPath(); g.moveTo(cx - 14, y - 6); g.lineTo(cx, y + 6); g.lineTo(cx + 14, y - 6); g.stroke(); } }
        } else if (st.kind === 'wire') {
          const A = P.plugA, B = P.plugB;
          const plug = (p, side, lit) => { rrect(p.x - 26, p.y - 18, 52, 36, 9); g.fillStyle = side < 0 ? 'rgba(120, 92, 30, 0.92)' : 'rgba(26, 26, 28, 0.92)'; g.fill(); g.strokeStyle = ink(lit ? 0.9 : 0.5); g.lineWidth = 2; g.stroke(); for (const k of [-1, 1]) circle(p.x + side * 18, p.y + k * 7, 3.2, ink(0.8)); };
          // the cables into the plugs from the edges
          g.strokeStyle = 'rgba(20, 20, 22, 0.9)'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, A.y + 30); g.quadraticCurveTo(A.x - 30, A.y + 20, A.x - 26, A.y); g.stroke();
          g.beginPath(); g.moveTo(W, B.y + 30); g.quadraticCurveTo(B.x + 30, B.y + 20, B.x + 26, B.y); g.stroke();
          if (M.joined > 0) { g.strokeStyle = warm(0.9); g.lineWidth = 5; g.beginPath(); g.moveTo(A.x + 26, A.y); g.lineTo(B.x - 26, B.y); g.stroke(); }
          else if (M.wire) { g.strokeStyle = warm(0.75); g.lineWidth = 5; g.beginPath(); g.moveTo(A.x + 26, A.y); g.quadraticCurveTo((A.x + M.wire[0]) / 2, Math.max(A.y, M.wire[1]) + 24, M.wire[0], M.wire[1]); g.stroke(); circle(M.wire[0], M.wire[1], 10, warm(0.45)); }
          else { const a = 0.2 + 0.35 * breathe(); g.setLineDash([6, 8]); g.strokeStyle = ink(a); g.lineWidth = 2; g.beginPath(); g.moveTo(A.x + 34, A.y); g.lineTo(B.x - 34, B.y); g.stroke(); g.setLineDash([]); }
          plug(A, 1, !!M.wire || M.joined > 0); plug(B, -1, M.joined > 0);
          if (M.joined > 0 && M.joined < 0.6) { for (let i = 0; i < 5; i++) { const a = Math.random() * TAU, d = 6 + Math.random() * 16; circle((A.x + B.x) / 2 + Math.cos(a) * d, A.y + Math.sin(a) * d, 1.6, warm(0.9)); } }
        }
      }
      // ---------------------------------------------------------------- the end of the station
      function finish(quiet = false) {
        if (over) return;
        over = true;
        cancelAnimationFrame(raf);
        run = null;
        if (!quiet) { buzz(14); }
        hintEl.style.opacity = '0';
        pad.classList.add('done');
        setTimeout(() => { if (!run) root.classList.remove('on'); resolve(); }, quiet ? 0 : 750);
      }
      // ---------------------------------------------------------------- the fingers
      const near = (p, q, d) => Math.hypot(p[0] - q.x, p[1] - q.y) < d;
      run = {
        finish,
        // (tests and "hold to skip": the part is in its place at once)
        complete() { after(o.station, G, C, stop); finish(true); },
        down(p) {
          if (over) return;
          finger = p; const P = L();
          if (st.kind === 'slide' || st.kind === 'deck') grab = { y: p[1], p: M.p };
          else if (st.kind === 'pull') { grab = { y: p[1] }; M.hold = p[1] > H * 0.7; }
          else if (st.kind === 'drag') { const at = M.part.home ? P.home : M.part; if (!M.placed && near(p, at, 85)) { grab = { dx: at.x - p[0], dy: at.y - p[1] }; M.part = { x: at.x, y: at.y, home: false }; play('clink'); } }
          else if (st.kind === 'turn') {
            if (M.aligned && !M.dropping) grab = { y: p[1], drop: true };
            else if (!M.aligned) grab = { a: Math.atan2(p[0] - P.cx, -(p[1] - P.cy)) };
          } else if (st.kind === 'wire') { if (!M.joined && near(p, P.plugA, 60)) { M.wire = p; grab = {}; play('click'); } }
        },
        move(p) {
          if (over || !grab) return;
          finger = p; const P = L();
          if (st.kind === 'slide' || st.kind === 'deck') {
            const lim = st.kind === 'deck' ? stop : 1;
            const want = clamp(grab.p + (grab.y - p[1]) / (P.trackBot - P.trackTop), M.p, lim);   // (never back down)
            // (slow: the cloth is heavy, the deck is tight - the handle follows the finger at a calm pace)
            M.target = want;
          } else if (st.kind === 'pull') M.hold = p[1] > H * 0.7;
          else if (st.kind === 'drag') { M.part.x = p[0] + grab.dx; M.part.y = p[1] + grab.dy; }
          else if (st.kind === 'turn' && !grab.drop) {
            const a = Math.atan2(p[0] - P.cx, -(p[1] - P.cy));
            let d = a - grab.a; d = Math.atan2(Math.sin(d), Math.cos(d));
            grab.a = a;
            M.angle += d;            // (the part turns with the finger; the notch must come to the mark at the top)
            const n = Math.atan2(Math.sin(M.angle), Math.cos(M.angle));
            M.turnT = (M.turnT || 0) + Math.abs(d);
            if (M.turnT > 0.5) { M.turnT = 0; play('ratchet', 2); }
            if (Math.abs(n) < 0.14) { M.angle = 0; M.aligned = true; grab = null; play('clink'); buzz(10); hintEl.textContent = o.hint2 || ''; }
          } else if (st.kind === 'turn' && grab.drop) { if (p[1] - grab.y > 40) { M.dropping = true; grab = null; } }
          else if (st.kind === 'wire') { M.wire = p; if (near(p, P.plugB, 44)) { M.wire = null; M.joined = 0.001; grab = null; play('spark'); buzz(18); } }
        },
        up() {
          if (over) return;
          if (st.kind === 'pull') M.hold = false;
          if (st.kind === 'drag' && grab && !M.placed) {
            const P = L();
            if (near([M.part.x, M.part.y], P.slot, 70)) { M.placed = true; play('ratchet', 6); }
            else { M.back = { x: M.part.x, y: M.part.y, t: 0 }; }
          }
          if (st.kind === 'turn' && grab && grab.drop) M.dropping = true;      // (a tap on the part also sets it down)
          if (st.kind === 'wire' && !M.joined) M.wire = null;
          grab = null; finger = null;
        },
        // tests: do the gesture by itself
        auto: false,
      };
      // ---------------------------------------------------------------- every frame
      function tick(now) {
        const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
        if (run && run.auto) autoStep(dt);
        if (st.kind === 'slide' || st.kind === 'deck') {
          if (M.target !== undefined) {
            const speed = st.kind === 'slide' ? 0.3 : 0.45;       // (at most this much of the way per second)
            M.p = Math.min(M.target, M.p + speed * dt);
            M.slideT = (M.slideT || 0) + dt;
            if (M.target > M.p + 0.002 && M.slideT > 0.5) { M.slideT = 0; play('slide'); }
          }
          const lim = st.kind === 'deck' ? stop : 1;
          if (M.p >= lim - 0.002 && M.shown >= lim - 0.01) { M.p = lim; if (st.kind === 'deck' && lim >= 1) { S.deck('in'); play('clunk'); } else if (st.kind === 'deck') play('click'); finish(); return; }
        } else if (st.kind === 'pull') {
          if (M.hold) {
            M.p = Math.min(1, M.p + dt / 9);
            M.creakT -= dt; if (M.creakT <= 0) { M.creakT = 1.1 + Math.random() * 0.6; play('creak'); }
          }
          M.spring = (M.spring || 0) * Math.exp(-dt * 6);
          if (M.p >= 1 && M.shown > 0.985) { S.bend(0); G.chain({ on: false }); play('clunk'); finish(); return; }
        } else if (st.kind === 'drag') {
          if (M.back) { M.back.t = Math.min(1, M.back.t + dt * 2.2); const P = L(), e = ease(M.back.t); M.part.x = M.back.x + (P.home.x - M.back.x) * e; M.part.y = M.back.y + (P.home.y - M.back.y) * e; if (M.back.t >= 1) { M.back = null; M.part.home = true; } }
          if (M.placed && M.snap >= 1) { S.bumper('new'); play('clunk'); finish(); return; }
        } else if (st.kind === 'turn') {
          if (M.dropping) { M.drop = Math.min(1, M.drop + dt / 1.1); if (M.drop >= 1) { S.cleaner('on'); play('clunk'); finish(); return; } }
        } else if (st.kind === 'wire') {
          if (M.joined > 0) { M.joined += dt / 1.6; if (M.joined >= 1) { S.wires(1); S.lights(1); finish(); return; } }
        }
        apply(dt);
        draw();
        if (!over) raf = requestAnimationFrame(tick);
      }
      // the gesture done by a test (the same paths as the fingers)
      function autoStep(dt) {
        const P = L();
        if (st.kind === 'slide' || st.kind === 'deck') { M.target = st.kind === 'deck' ? stop : 1; }
        else if (st.kind === 'pull') M.hold = true;
        else if (st.kind === 'drag' && !M.placed) { M.placed = true; play('ratchet', 6); }
        else if (st.kind === 'turn') { if (!M.aligned) { M.angle = Math.max(0, M.angle - dt * 3); if (M.angle <= 0.001) { M.angle = 0; M.aligned = true; } } else M.dropping = true; }
        else if (st.kind === 'wire' && !M.joined) { M.joined = 0.001; play('spark'); }
        void P;
      }
      window.addEventListener('resize', size, { once: true });
      draw();
      raf = requestAnimationFrame(tick);
    });
  }

  return {
    start,
    get active() { return !!run; },
    // the part in its place at once (hold to skip, tests)
    complete() { if (run) run.complete(); },
    cancel() { if (run) run.finish(true); if (root) root.classList.remove('on'); },
    // tests: the fingers do it by themselves (a few calm seconds)
    solve() { if (run) { run.auto = true; return true; } return false; },
  };
}
