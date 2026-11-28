// ---------------------------------------------------------------------------
// animTest.js - THE ANIM TEST SCREEN (hidden: title > three taps on the name > DEBUG FLAGS > ANIM TEST).
//
// Free roam starts with a small panel on the left side of the screen:
//   * a button for every animation: IDLE, WALK, RUN, CROUCH, CROUCH WALK, PICK UP, LOOK, HIT, BAT, GET HIT,
//     ENTER CAR, EXIT CAR, JUMP, RUN + JUMP (WALK and RUN walk Nate in a slow circle by themselves)
//   * a slow-motion slider: the whole game runs at 0.1x .. 1x
//   * the FOOT CONTACT display: L and R light up green while that foot stands on the ground (red in the air),
//     with the step phase, the walk state and the time of the last blend
//   * every change of state and its blend time is written into the browser console ("[anim] ...")
// CLOSE gives the normal free roam back.
// ---------------------------------------------------------------------------

export function createAnimTest({ player, vehicles, weapons, onClose }) {
  let open = false, scale = 1, drive = null, panel = null, info = null, t = 0, testCar = null;

  const css = document.createElement('style');
  css.textContent = `
    #anim-test { position: absolute; left: calc(8px + env(safe-area-inset-left)); top: calc(8px + env(safe-area-inset-top)); z-index: 60; width: 214px;
      max-height: calc(100% - 16px); overflow-y: auto; background: rgba(8, 10, 14, 0.82); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px;
      padding: 8px; color: #eef; font: 10px/1.35 "Helvetica Neue", Arial, sans-serif; letter-spacing: 0.06em; -webkit-overflow-scrolling: touch; }
    #anim-test h3 { margin: 0 0 6px; font-size: 10px; letter-spacing: 0.24em; font-weight: 500; }
    #anim-test .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    #anim-test button { height: 30px; min-width: 0; padding: 0 4px; font-size: 9px; letter-spacing: 0.08em; border-radius: 8px; }
    #anim-test button.on { background: rgba(255, 255, 255, 0.86); color: #0b0d10; }
    #anim-test input { width: 100%; margin: 4px 0 2px; }
    #anim-test .feet { display: flex; gap: 6px; margin: 6px 0 2px; }
    #anim-test .foot { flex: 1; text-align: center; padding: 6px 0; border-radius: 8px; font-weight: 600; background: #7a2020; }
    #anim-test .foot.down { background: #1d7a3a; }
    #anim-test .info { opacity: 0.8; white-space: pre-line; min-height: 46px; }`;
  document.head.appendChild(css);

  function build() {
    panel = document.createElement('div');
    panel.id = 'anim-test';
    panel.innerHTML = `<h3>ANIM TEST</h3><div class="grid"></div>
      <div style="margin-top:8px">SLOW MOTION <b id="at-scale">1.0x</b></div><input id="at-slow" type="range" min="0.1" max="1" step="0.05" value="1">
      <div>FOOT CONTACT</div><div class="feet"><div class="foot" id="at-l">L</div><div class="foot" id="at-r">R</div></div>
      <div class="info" id="at-info"></div><div class="grid" style="margin-top:6px"></div>`;
    (document.getElementById('ui') || document.body).appendChild(panel);
    const grid = panel.querySelectorAll('.grid')[0], grid2 = panel.querySelectorAll('.grid')[1];
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    const add = (g, label, fn) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.addEventListener('pointerdown', (e) => { stop(e); fn(b); }); g.appendChild(b); return b; };
    const A = () => player.actions;
    const point = (fwd, side = 0, up = 0) => { const p = player.position, h = player.heading; return [p.x + Math.sin(h) * fwd + Math.cos(h) * side, p.y + up, p.z + Math.cos(h) * fwd - Math.sin(h) * side]; };
    add(grid, 'IDLE', () => { drive = null; if (A()) { A().crouch = false; A().stop(); } });
    add(grid, 'WALK', () => { drive = { run: false }; if (A()) A().crouch = false; });
    add(grid, 'RUN', () => { drive = { run: true }; if (A()) A().crouch = false; });
    add(grid, 'CROUCH', () => { drive = null; if (A()) A().crouch = true; });
    add(grid, 'CROUCH WALK', () => { drive = { run: false }; if (A()) A().crouch = true; });
    add(grid, 'PICK UP', () => { drive = null; if (A()) A().play('pickup', { at: point(0.48, 0.1, 0.03) }); });
    add(grid, 'LOOK', () => { if (A()) A().play('look', { at: point(3, 2.6, 1.7), seconds: 2.5 }); });
    add(grid, 'HIT', () => { drive = null; weapons.set('none'); weapons.attack(); });
    add(grid, 'BAT', () => { drive = null; weapons.set('bat'); setTimeout(() => weapons.attack(), 250); });
    add(grid, 'GET HIT', () => { if (A()) A().play('getHit', { side: Math.random() < 0.5 ? -1 : 1 }); });
    add(grid, 'ENTER CAR', () => {
      drive = null;
      // a test car right beside him (the last one goes away), then the normal way in: door, fold, seat
      if (testCar && vehicles.live.includes(testCar) && vehicles.active !== testCar) vehicles.removeVehicle(testCar);
      const p = point(0.3, -2.0);
      testCar = vehicles.spawn('sedan', p[0], p[2], player.heading, null, { keep: false, tag: false });
      if (testCar && !vehicles.tryEnter(player)) console.log('[anim] ENTER CAR: no car near enough');
    });
    add(grid, 'EXIT CAR', () => { if (vehicles.state === 'driving') vehicles.requestExit(); });
    add(grid, 'JUMP', () => { pending.jump = true; });
    add(grid, 'RUN + JUMP', () => { drive = { run: true }; setTimeout(() => { pending.jump = true; }, 900); });
    add(grid2, 'CONSOLE LOG', (b) => { if (A()) { A().debug = !A().debug; b.classList.toggle('on', A().debug); } });
    add(grid2, 'CLOSE', () => close());
    const slider = panel.querySelector('#at-slow');
    slider.addEventListener('input', () => { scale = Number(slider.value); panel.querySelector('#at-scale').textContent = scale.toFixed(2) + 'x'; console.log('[anim] slow motion', scale.toFixed(2) + 'x'); });
    for (const ev of ['pointerdown', 'touchstart']) slider.addEventListener(ev, (e) => e.stopPropagation());
    info = panel.querySelector('#at-info');
  }
  const pending = { jump: false };

  function openTest() {
    if (!panel) build();
    panel.hidden = false; open = true; scale = 1; drive = null;
    panel.querySelector('#at-slow').value = 1; panel.querySelector('#at-scale').textContent = '1.00x';
    if (player.actions) player.actions.debug = true;
    console.log('[anim] ANIM TEST open - every state change and its blend time is logged here');
  }
  function close() {
    if (panel) panel.hidden = true;
    open = false; scale = 1; drive = null;
    if (player.actions) { player.actions.debug = false; player.actions.crouch = false; }
    if (onClose) onClose();
  }

  return {
    open: openTest, close,
    get isOpen() { return open; },
    // the whole game runs this much slower (main.js multiplies its time step with it)
    get timeScale() { return open ? scale : 1; },
    // the panel's own input: walking in a circle, a jump
    input(input) {
      if (!open) return;
      if (drive) { input.moveY = 1; input.moveX = 0.32; input.run = drive.run; }
      if (pending.jump) { input.jump = true; pending.jump = false; }
    },
    // the foot contact display (a few times a second is enough)
    update(dt) {
      if (!open || !player.anim) return;
      t += dt;
      if (t < 0.05) return;
      t = 0;
      const f = player.anim.feet, g = player.anim.gait, A = player.actions;
      panel.querySelector('#at-l').classList.toggle('down', !!(f[0] && f[0].planted && !player.jumping));
      panel.querySelector('#at-r').classList.toggle('down', !!(f[1] && f[1].planted && !player.jumping));
      info.textContent = `state: ${A ? A.locomotion : '-'}${A && A.current ? ' + ' + A.current + ' ' + A.time.toFixed(2) + ' s' : ''}\n`
        + `phase ${g.phase.toFixed(2)} · moving ${g.moving.toFixed(2)} · run ${g.run.toFixed(2)}\n`
        + `speed ${player.speed.toFixed(2)} m/s · last blend ${A ? A.lastBlend.toFixed(2) : '-'} s\n`
        + `animation ${player.animMs.toFixed(2)} ms a frame`;
    },
  };
}
