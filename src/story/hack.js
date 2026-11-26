// ---------------------------------------------------------------------------
// hack.js - THE HACKING MINI-GAME (Chapter 3).
//
// A grid of round nodes that pulse. A path of glowing nodes is shown once
// (1, 2, 3 ...). The player draws the path with ONE SWIPE: put a finger on
// the first node and slide through the others in order, before the time runs
// out. Big targets for a thumb, readable at a glance, never longer than 20 s.
//
//   * a wrong node: a red flash, the line starts again, and 2.5 seconds less
//   * time over: it failed - the story gives a short penalty (no game over)
//   * optional hacks have a SKIP button (it counts as failed)
//
// The story engine starts it with { do: 'hack', ... } (see engine.js).
// Works with a mouse too (the same pointer events). Keys: none needed.
// ---------------------------------------------------------------------------

const CSS = `
#hack { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, rgba(2, 18, 20, 0.82), rgba(0, 0, 0, 0.9)); touch-action: none;
  font-family: "Helvetica Neue", Roboto, Arial, sans-serif; color: #cfeee6; user-select: none; -webkit-user-select: none; }
#hack.on { display: flex; }
#hack .panel { position: relative; width: min(92vw, 460px); padding: 18px 16px 14px; border: 1px solid rgba(90, 230, 190, 0.35);
  border-radius: 14px; background: rgba(4, 22, 24, 0.86); box-shadow: 0 0 40px rgba(40, 200, 160, 0.12); }
#hack .title { font-size: 13px; letter-spacing: 0.22em; color: #7ff0cc; text-align: center; }
#hack .sub { font-size: 11px; letter-spacing: 0.12em; color: rgba(200, 240, 230, 0.6); text-align: center; margin-top: 4px; min-height: 14px; }
#hack .bar { height: 5px; border-radius: 3px; background: rgba(255, 255, 255, 0.1); margin: 12px 4px 10px; overflow: hidden; }
#hack .bar i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #4fe0b4, #a6ffe2); transform-origin: left; }
#hack .bar.low i { background: linear-gradient(90deg, #ff7a4a, #ffb36a); }
#hack .grid { position: relative; margin: 0 auto; touch-action: none; }
#hack canvas { position: absolute; inset: 0; pointer-events: none; }
#hack .node { position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
  border: 2px solid rgba(110, 230, 200, 0.35); background: radial-gradient(circle, rgba(60, 200, 170, 0.18), rgba(10, 40, 40, 0.5));
  display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; color: rgba(220, 255, 245, 0.0);
  animation: hackPulse 1.6s ease-in-out infinite; }
#hack .node.path { border-color: rgba(140, 255, 220, 0.95); color: #eafff8; box-shadow: 0 0 18px rgba(80, 255, 200, 0.55); background: radial-gradient(circle, rgba(90, 255, 210, 0.5), rgba(10, 60, 50, 0.6)); }
#hack .node.done { border-color: #a6ffe2; background: radial-gradient(circle, rgba(170, 255, 230, 0.85), rgba(30, 120, 100, 0.7)); color: #042; }
#hack .node.bad { border-color: #ff6a4a; background: radial-gradient(circle, rgba(255, 120, 80, 0.7), rgba(80, 10, 0, 0.6)); }
#hack .row { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
#hack .hint { font-size: 11px; color: rgba(200, 240, 230, 0.55); letter-spacing: 0.06em; }
#hack button { font: inherit; font-size: 11px; letter-spacing: 0.15em; color: #cfeee6; background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 18px; padding: 9px 16px; min-width: 76px; }
#hack .result { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; font-size: 22px; letter-spacing: 0.3em; border-radius: 14px; }
#hack .result.ok { display: flex; color: #9fffe0; background: rgba(4, 40, 32, 0.8); }
#hack .result.fail { display: flex; color: #ff9a7a; background: rgba(40, 8, 4, 0.8); }
@keyframes hackPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
/* THE STEADY LINK (Chapter 8): a small panel at the top; it takes no touches (the driving buttons stay free) */
#hackSteady { position: fixed; left: 50%; top: calc(env(safe-area-inset-top) + 58px); transform: translateX(-50%); width: min(88vw, 430px); z-index: 38;
  display: none; pointer-events: none; padding: 10px 14px 9px; border-radius: 14px; border: 1px solid rgba(90, 230, 190, 0.32);
  background: rgba(4, 22, 24, 0.7); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); color: #cfeee6;
  font-family: "Helvetica Neue", Roboto, Arial, sans-serif; user-select: none; -webkit-user-select: none; transition: opacity 0.5s; }
#hackSteady.on { display: block; }
#hackSteady .title { font-size: 11px; letter-spacing: 0.24em; color: #7ff0cc; text-align: center; }
#hackSteady .chain { position: relative; display: flex; justify-content: space-between; align-items: center; margin: 10px 6px 8px; height: 34px; }
#hackSteady .line { position: absolute; left: 14px; right: 14px; top: 50%; height: 3px; margin-top: -1.5px; background: rgba(120, 255, 210, 0.13); border-radius: 2px; }
#hackSteady .line i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #4fe0b4, #a6ffe2); border-radius: 2px; box-shadow: 0 0 10px rgba(80, 255, 200, 0.5); }
#hackSteady .n { position: relative; width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(110, 230, 200, 0.35);
  background: radial-gradient(circle, rgba(60, 200, 170, 0.15), rgba(10, 40, 40, 0.65)); }
#hackSteady .n.cur { border-color: rgba(140, 255, 220, 0.9); background: conic-gradient(rgba(130, 255, 215, 0.75) calc(var(--p, 0) * 1%), rgba(10, 40, 40, 0.65) 0); }
#hackSteady .n.done { border-color: #a6ffe2; background: radial-gradient(circle, rgba(170, 255, 230, 0.9), rgba(30, 120, 100, 0.75)); box-shadow: 0 0 12px rgba(120, 255, 210, 0.55); }
#hackSteady .hint { text-align: center; font-size: 13px; letter-spacing: 0.2em; font-weight: 600; min-height: 16px; transition: color 0.3s; }
#hackSteady .hint.ok { color: #9fffe0; }
#hackSteady .hint.wobble { color: #ffc46b; animation: steadyPulse 1.1s ease-in-out infinite; }
#hackSteady.linked { border-color: rgba(160, 255, 225, 0.9); box-shadow: 0 0 30px rgba(80, 255, 200, 0.3); }
@keyframes steadyPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
body.cine #hackSteady { top: calc(var(--bar, 0px) + 12px); }
`;

export function createHack() {
  let root = null, els = null, run = null;

  function build() {
    if (root) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    root = document.createElement('div');
    root.id = 'hack';
    root.innerHTML = `<div class="panel"><div class="title"></div><div class="sub"></div><div class="bar"><i></i></div>
      <div class="grid"><canvas></canvas></div>
      <div class="row"><span class="hint"></span><button type="button" class="skip">SKIP</button></div><div class="result"></div></div>`;
    document.body.appendChild(root);
    els = {
      title: root.querySelector('.title'), sub: root.querySelector('.sub'), bar: root.querySelector('.bar'), fill: root.querySelector('.bar i'),
      grid: root.querySelector('.grid'), canvas: root.querySelector('canvas'), hint: root.querySelector('.hint'), skip: root.querySelector('.skip'), result: root.querySelector('.result'),
    };
    // (the touches stay here: the driving buttons and the camera under it do not get them)
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev.startsWith('touch') });
    els.grid.addEventListener('pointerdown', (e) => run && run.down(e));
    els.grid.addEventListener('pointermove', (e) => run && run.move(e));
    els.grid.addEventListener('pointerup', (e) => run && run.up(e));
    els.grid.addEventListener('pointercancel', (e) => run && run.up(e));
    els.skip.addEventListener('click', () => run && run.finish(false, true));
  }

  // opts: { title, sub, hint, seconds (max 20), length (nodes in the path, 3..7), cols, rows, optional, labels: { ok, fail, skip } }
  // Returns a promise: true = done in time, false = failed or skipped.
  function start(opts = {}) {
    build();
    if (run) run.finish(false, true);
    const cols = opts.cols || 4, rows = opts.rows || 4, n = cols * rows;
    const seconds = Math.min(20, opts.seconds || 14);
    const len = Math.max(3, Math.min(7, opts.length || 5));
    const L = opts.labels || {};
    els.title.textContent = opts.title || 'HACK';
    els.sub.textContent = opts.sub || '';
    els.hint.textContent = opts.hint || 'SWIPE THROUGH THE NODES IN ORDER';
    els.skip.textContent = L.skip || 'SKIP';
    els.skip.style.visibility = opts.optional ? 'visible' : 'hidden';
    els.result.className = 'result';
    // the grid: as big as the screen allows, the nodes never smaller than a thumb
    const W = Math.min(window.innerWidth * 0.84, 400), gap = W / cols;
    const H = gap * rows;
    els.grid.style.width = `${W}px`; els.grid.style.height = `${H}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.round(W * dpr); els.canvas.height = Math.round(H * dpr);
    els.canvas.style.width = `${W}px`; els.canvas.style.height = `${H}px`;
    for (const old of els.grid.querySelectorAll('.node')) old.remove();
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'node';
      const x = (i % cols + 0.5) * gap, y = (Math.floor(i / cols) + 0.5) * gap;
      d.style.left = `${x}px`; d.style.top = `${y}px`;
      d.style.animationDelay = `${(i * 0.13) % 1.6}s`;
      els.grid.appendChild(d);
      nodes.push({ el: d, x, y, i });
    }
    // the path: a chain of neighbouring nodes (also across a corner), never the same node twice
    const path = [];
    {
      let cur = Math.floor(Math.random() * n);
      path.push(cur);
      for (let k = 1; k < len; k++) {
        const cx = cur % cols, cy = Math.floor(cur / cols), next = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy, j = y * cols + x;
          if ((dx || dy) && x >= 0 && y >= 0 && x < cols && y < rows && !path.includes(j)) next.push(j);
        }
        if (!next.length) break;
        cur = next[Math.floor(Math.random() * next.length)];
        path.push(cur);
      }
    }
    path.forEach((j, k) => { nodes[j].el.classList.add('path'); nodes[j].el.textContent = String(k + 1); });
    const g = els.canvas.getContext('2d');
    root.classList.add('on');

    return new Promise((resolve) => {
      let left = seconds, got = 0, drawing = false, finger = null, over = false, raf = 0, last = performance.now();
      const nodeAt = (px, py) => { for (const q of nodes) if (Math.hypot(q.x - px, q.y - py) < gap * 0.36) return q; return null; };
      const local = (e) => { const r = els.grid.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      function draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        // the hint line of the whole path (faint), then the part already drawn (bright)
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(120, 255, 210, 0.14)'; g.lineWidth = 6;
        g.beginPath(); path.forEach((j, k) => (k ? g.lineTo(nodes[j].x, nodes[j].y) : g.moveTo(nodes[j].x, nodes[j].y))); g.stroke();
        if (got > 0) {
          g.strokeStyle = 'rgba(170, 255, 225, 0.95)'; g.lineWidth = 7;
          g.beginPath();
          for (let k = 0; k < got; k++) { const q = nodes[path[k]]; if (k) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }
          if (drawing && finger) g.lineTo(finger[0], finger[1]);
          g.stroke();
        }
      }
      function reset(bad) {
        got = 0; drawing = false; finger = null;
        for (const q of nodes) q.el.classList.remove('done');
        if (bad) { bad.el.classList.add('bad'); setTimeout(() => bad.el.classList.remove('bad'), 380); left -= 2.5; if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* no */ } } }
        draw();
      }
      function finish(ok, quiet = false) {
        if (over) return;
        over = true;
        cancelAnimationFrame(raf);
        run = null;
        els.result.textContent = ok ? (L.ok || 'ACCESS') : (L.fail || 'TRACE');
        els.result.className = 'result ' + (ok ? 'ok' : 'fail');
        if (navigator.vibrate) { try { navigator.vibrate(ok ? [30, 40, 30] : [90]); } catch (e) { /* no */ } }
        setTimeout(() => { root.classList.remove('on'); resolve(ok); }, quiet ? 150 : 900);
      }
      function touch(q) {
        if (!q) return;
        const want = path[got];
        if (q.i === want) {
          q.el.classList.add('done');
          got++;
          if (got >= path.length) { draw(); finish(true); }
        } else if (got > 0 && q.i !== path[got - 1]) reset(q);   // (sliding back over the last node is fine)
      }
      run = {
        finish,
        down(e) {
          if (over) return;
          try { els.grid.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
          const p = local(e), q = nodeAt(p[0], p[1]);
          if (q && q.i === path[0]) { reset(null); drawing = true; finger = p; touch(q); }
          else if (q) reset(q);
          draw();
        },
        move(e) {
          if (!drawing || over) return;
          finger = local(e);
          touch(nodeAt(finger[0], finger[1]));
          draw();
        },
        up() { if (over) return; if (drawing && got < path.length) reset(null); drawing = false; draw(); },
      };
      function tick(now) {
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        left -= dt;
        els.fill.style.transform = `scaleX(${Math.max(0, left / seconds)})`;
        els.bar.classList.toggle('low', left < seconds * 0.3);
        if (left <= 0) { finish(false); return; }
        if (!over) raf = requestAnimationFrame(tick);
      }
      draw();
      raf = requestAnimationFrame(tick);
    });
  }

  // ---------------------------------------------------------------- THE STEADY LINK (Chapter 8)
  // Lena does the hacking; the player only holds the car steady beside Zero. The nodes light one after the other while
  // the two cars are steady ("long nodes": each one takes a few seconds), and simply wait while they are not.
  // No timer, no wrong move, no penalty.
  //   opts: { title, hint (shown while steady), wobble (shown while not), nodes (4..8), seconds (steady riding in all),
  //           steady() -> 0..1, labels: { ok } }. Returns a promise: true when the link is made.
  let sRoot = null, sEls = null, sRun = null;
  function buildSteady() {
    if (sRoot) return;
    build();
    sRoot = document.createElement('div');
    sRoot.id = 'hackSteady';
    sRoot.innerHTML = '<div class="title"></div><div class="chain"><div class="line"><i></i></div></div><div class="hint"></div>';
    document.body.appendChild(sRoot);
    sEls = { title: sRoot.querySelector('.title'), chain: sRoot.querySelector('.chain'), fill: sRoot.querySelector('.line i'), hint: sRoot.querySelector('.hint') };
  }
  function steady(opts = {}) {
    buildSteady();
    if (sRun) sRun.finish(false);
    const n = Math.max(4, Math.min(8, opts.nodes || 6)), seconds = Math.max(4, opts.seconds || 20), L = opts.labels || {};
    sEls.title.textContent = opts.title || 'LINKING';
    for (const old of sEls.chain.querySelectorAll('.n')) old.remove();
    const nodes = [];
    for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'n'; sEls.chain.appendChild(d); nodes.push(d); }
    sRoot.classList.remove('linked');
    sRoot.classList.add('on');
    document.body.classList.add('steady-link');
    return new Promise((resolve) => {
      let got = 0, over = false, hintWas = '';
      const per = seconds / n;
      function finish(ok) {
        if (over) return;
        over = true; sRun = null;
        document.body.classList.remove('steady-link');
        if (ok) {
          sRoot.classList.add('linked'); sEls.hint.className = 'hint ok'; sEls.hint.textContent = L.ok || 'LINKED';
          if (navigator.vibrate) { try { navigator.vibrate([20, 40, 20]); } catch (e) { /* no */ } }
          setTimeout(() => { sRoot.classList.remove('on'); resolve(true); }, 1300);
        } else { sRoot.classList.remove('on'); resolve(false); }
      }
      // (moved on by the game's own clock - stepSteady - so it waits while the game is paused)
      function tick(dt) {
        const k = opts.steady ? Math.max(0, Math.min(1, opts.steady())) : 1;
        // (only a steady ride moves the link on: from a little steady it is slow, fully steady it is full speed)
        got = Math.min(seconds, got + dt * Math.max(0, Math.min(1, (k - 0.45) / 0.35)));
        const done = Math.floor(got / per + 1e-6), part = (got - done * per) / per;
        nodes.forEach((d, i) => { d.className = 'n' + (i < done ? ' done' : i === done ? ' cur' : ''); if (i === done) d.style.setProperty('--p', String(Math.round(part * 100))); });
        sEls.fill.style.width = `${(Math.min(done, n - 1) / (n - 1)) * 100}%`;
        const ok = k > 0.62, want = ok ? 'ok' : 'wobble';
        if (want !== hintWas) { hintWas = want; sEls.hint.className = 'hint ' + want; sEls.hint.textContent = ok ? (opts.hint || 'STEADY') : (opts.wobble || 'STAY BESIDE IT'); }
        if (got >= seconds - 1e-6) finish(true);
      }
      sRun = { finish, tick, add(s) { got = Math.min(seconds, got + s); } };
      tick(0);
    });
  }

  return {
    start, steady,
    get active() { return !!run; },
    get steadyActive() { return !!sRun; },
    stepSteady(dt) { if (sRun) sRun.tick(Math.min(0.1, dt)); },
    cancel() { if (run) run.finish(false, true); if (sRun) sRun.finish(false); },
    // for tests: the steady link is made at once
    solveSteady() { if (sRun) { sRun.add(1e6); return true; } return false; },
    // for tests: draw the whole path at once
    solve() {
      if (!run || !els) return false;
      const ns = [...els.grid.querySelectorAll('.node')];
      const order = ns.filter((d) => d.classList.contains('path')).sort((a, b) => Number(a.textContent) - Number(b.textContent));
      const r = els.grid.getBoundingClientRect();
      const ev = (type, d) => { const b = d.getBoundingClientRect(); return new PointerEvent(type, { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, pointerId: 7, bubbles: true }); };
      els.grid.dispatchEvent(ev('pointerdown', order[0]));
      for (const d of order.slice(1)) els.grid.dispatchEvent(ev('pointermove', d));
      void r;
      return true;
    },
  };
}
