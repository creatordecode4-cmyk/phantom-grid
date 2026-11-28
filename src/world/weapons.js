// ---------------------------------------------------------------------------
// weapons.js - A BAT AND TWO GUNS for free roam.
//
// FOR THE PLAYER (on foot, free roam only - never in the story):
//   the WEAPON button (or the Z key) goes through: EMPTY HANDS, BAT, PISTOL, RIFLE
//   the HIT / FIRE button (or the X key): swing the bat, or shoot (hold it to keep shooting)
//
//   * THE BAT: one swing. People in front of you fall over, street things (bins, news boxes, meters) fly, a car
//     gets a dent. The people of the city run away.
//   * THE PISTOL and THE RIFLE: the shot flies where you look (it finds somebody in front of you by itself, so no
//     aiming with a second finger is needed on a phone). A light line shows its way, sparks where it hits.
//     People who are hit fall over and get up after a moment - nobody is hurt, nobody bleeds: this is a game
//     about a city, not about killing. Cars get damaged; street things are knocked over.
//   * Whoever swings a bat at people or fires a gun is WANTED: the Guard comes (two stars for a shot, three when
//     somebody was hit, four for hitting a Guard car).
//
// HOW IT WORKS INSIDE THE GAME
//   The weapon is a small mesh in the right hand of the player's skeleton; the arms take a pose for it
//   (proceduralAnim.js: 'bat', 'batSwing', 'pistol', 'aim'). A shot is a straight line on the map: it stops at the
//   first wall (the boxes of the collision grid), and everything nearer than that along the line is tested -
//   people, the workers of the building site, vehicles, loose street things.
//
//   const weapons = createWeapons({ scene, player, city, vehicles, police, loose, site, sound, hud, effects, t });
//   weapons.update(dt, { can, inside })     can: on foot in free roam and free to act; inside: in a room
//   weapons.armed                           a gun is in the hand (the bank asks this)
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const ORDER = ['none', 'bat', 'pistol', 'rifle'];
const INFO = {
  none: { label: 'HANDS', pose: 'idle', act: 'HIT', every: 0.55 },
  bat: { label: 'BAT', pose: 'bat', act: 'HIT', every: 0.62 },
  pistol: { label: 'PISTOL', pose: 'pistol', act: 'FIRE', every: 0.3, range: 60, spread: 0.012 },
  rifle: { label: 'RIFLE', pose: 'aim', act: 'FIRE', every: 0.11, range: 90, spread: 0.028 },
};
// where each weapon sits in the right hand: position (meters) and turn (radians) in the hand bone's own frame
// (the hand's fingers point along +y, the palm looks to -x)
// (with the arm held out forward, the hand's +y points forward and its +z up: a gun's barrel - its own +z - is
//  turned onto the hand's +y, its top onto the hand's +z)
const GRIP = {
  bat: { p: [-0.03, 0.07, 0.0], r: [0.45, 0, 0] },
  pistol: { p: [-0.03, 0.09, 0.035], r: [-Math.PI / 2, 0, Math.PI] },
  rifle: { p: [-0.035, 0.09, 0.03], r: [-Math.PI / 2, 0, Math.PI] },
};

// ---- the three shapes (each one mesh; colours in the vertices) ----
function shape(parts) {
  const geos = [];
  for (const [g, color] of parts) {
    // (every triangle with its own three corners, so the pieces can simply be put one after the other)
    const gg = g.index ? g.toNonIndexed() : g, col = new THREE.Color(color);
    const c = new Float32Array(gg.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
    gg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geos.push(gg);
  }
  // put them into one geometry
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return g; };
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 10) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y, z); return g; };
// along z (a barrel): a cylinder turned to lie forward
const barrel = (r, len, x, y, z, seg = 8) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };
function makeShapes() {
  // THE BAT: a turned club standing along +y (the hand holds it near its lower end), 0.84 m long
  const prof = [[0.001, -0.14], [0.026, -0.138], [0.03, -0.12], [0.02, -0.1], [0.016, 0.1], [0.02, 0.3], [0.03, 0.5], [0.034, 0.62], [0.03, 0.69], [0.012, 0.705], [0.001, 0.706]].map(([r, y]) => new THREE.Vector2(r, y));
  const bat = shape([[new THREE.LatheGeometry(prof, 12), '#b98a52'], [cyl(0.0175, 0.0175, 0.2, 0, -0.01, 0, 10), '#2a2622']]);
  // THE PISTOL: the barrel along +z, the grip down (-y)
  const pistol = shape([
    [box(0.03, 0.036, 0.19, 0, 0.02, 0.06), '#1c1d20'],            // the slide
    [box(0.026, 0.02, 0.15, 0, -0.005, 0.045), '#2b2d31'],         // the frame
    [box(0.027, 0.105, 0.042, 0, -0.06, -0.012, 0.22), '#24211e'], // the grip
    [barrel(0.007, 0.02, 0, 0.022, 0.16), '#0c0c0d'],
    [box(0.006, 0.03, 0.045, 0, -0.03, 0.045), '#1c1d20'],         // the trigger guard
  ]);
  // THE RIFLE: a short carbine, the barrel along +z, the stock back to the shoulder
  const rifle = shape([
    [box(0.04, 0.055, 0.34, 0, 0.02, 0.1), '#1d1f22'],             // the body
    [box(0.034, 0.05, 0.24, 0, 0.012, -0.19), '#26221e'],          // the stock
    [box(0.03, 0.09, 0.04, 0, -0.045, -0.01, 0.25), '#24211e'],    // the grip
    [box(0.03, 0.13, 0.05, 0, -0.07, 0.11, -0.18), '#141516'],     // the magazine
    [box(0.036, 0.04, 0.2, 0, 0.012, 0.36), '#2a2c30'],            // the hand guard
    [barrel(0.009, 0.22, 0, 0.024, 0.55), '#0c0c0d'],
    [box(0.012, 0.035, 0.1, 0, 0.065, 0.1), '#0c0c0d'],            // the sight
  ]);
  return { bat, pistol, rifle };
}
// how far the muzzle is in front of the hand (along the weapon's own +z)
const MUZZLE = { pistol: 0.18, rifle: 0.68 };

export function createWeapons({ scene, player, city, vehicles, police, loose, site, sound, hud, effects, t }) {
  let current = 'none', cool = 0, swing = 0, hitDone = true, holdFire = false, shown = false, seenBy = 0;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
  const shapes = makeShapes();
  const meshes = {};
  const hand = player.rig && player.rig.bones ? player.rig.bones.hand_R : null;
  for (const k of ['bat', 'pistol', 'rifle']) {
    const m = new THREE.Mesh(shapes[k], mat);
    m.castShadow = true;
    m.visible = false;
    m.layers.enable(4);                          // (also seen inside a room)
    m.position.fromArray(GRIP[k].p); m.rotation.set(GRIP[k].r[0], GRIP[k].r[1], GRIP[k].r[2]);
    if (hand) hand.add(m);
    meshes[k] = m;
  }

  // ---- the line of a shot and the flash at the muzzle (a few, used again and again) ----
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracerGeo = new THREE.BoxGeometry(0.018, 0.018, 1).translate(0, 0, 0.5);
  const tracers = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(tracerGeo, tracerMat); m.visible = false; m.frustumCulled = false; scene.add(m); tracers.push({ m, t: 0 }); }
  const flashTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,220,140,0.8)'); gr.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.visible = false; flash.scale.setScalar(0.5);
  scene.add(flash);
  let flashT = 0, nextTracer = 0;

  // ---- the two buttons ----
  const css = document.createElement('style');
  css.textContent = `
    #btn-weapon, #btn-fire { position: absolute; z-index: 6; user-select: none; -webkit-user-select: none; touch-action: none; zoom: var(--ctl, 1); }
    #btn-weapon { right: calc(118px + env(safe-area-inset-right)); bottom: calc(136px + env(safe-area-inset-bottom)); width: 64px; height: 64px; font-size: 10px; letter-spacing: 0.12em; }
    #btn-fire { right: calc(26px + env(safe-area-inset-right)); bottom: calc(142px + env(safe-area-inset-bottom)); width: 78px; height: 78px; font-size: 12px; letter-spacing: 0.16em;
      background: rgba(255, 120, 90, 0.26); border-color: rgba(255, 170, 150, 0.7); }
    #btn-fire.down { background: rgba(255, 120, 90, 0.6); }
    #btn-weapon[hidden], #btn-fire[hidden] { display: none; }
    body.driving #btn-weapon, body.driving #btn-fire, body.cine #btn-weapon, body.cine #btn-fire, body.title #btn-weapon, body.title #btn-fire { display: none; }`;
  document.head.appendChild(css);
  const mk = (id, label) => { const b = document.createElement('button'); b.className = 'btn round'; b.id = id; b.hidden = true; b.setAttribute('aria-label', label); (document.getElementById('ui') || document.body).appendChild(b); return b; };
  const bWeapon = mk('btn-weapon', 'Change the weapon'), bFire = mk('btn-fire', 'Hit or fire');
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  bWeapon.addEventListener('pointerdown', (e) => { stop(e); next(); });
  bFire.addEventListener('pointerdown', (e) => { stop(e); holdFire = true; bFire.classList.add('down'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bFire.addEventListener(ev, () => { holdFire = false; bFire.classList.remove('down'); });
  let keyFire = false;
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyZ' && !e.repeat && shown) next(); if (e.code === 'KeyX') keyFire = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'KeyX') keyFire = false; });

  function label() { bWeapon.textContent = INFO[current].label; bFire.textContent = INFO[current].act || ''; bFire.hidden = !shown; }
  function show(kind) {
    for (const k of Object.keys(meshes)) meshes[k].visible = k === kind;
    player.setPose(INFO[kind].pose, 0.22);
  }
  function set(kind) {
    if (!INFO[kind] || kind === current) return;
    current = kind; swing = 0; cool = 0.25;
    show(kind);
    label();
    if (sound.tick) sound.tick();
  }
  function next() { set(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]); }

  // ---- what a hit does ----
  const fwd = () => [Math.sin(player.heading), Math.cos(player.heading)];
  // the Guard hears of it: at least n stars, they start to look where it happened
  const wanted = (n) => { if (police.stars < n && !police.scripted) police.setStars(n, { search: [player.position.x, player.position.z], radius: 45 }); };
  function batHit() {
    const [dx, dz] = fwd(), px = player.position.x, pz = player.position.z, hx = px + dx * 1.0, hz = pz + dz * 1.0;
    let people = city.people.knockAt(hx, hz, 1.15, dx, dz, 4.5);
    if (site && site.knockAt) people += site.knockAt(hx, hz, 1.15, dx, dz, 3.5);
    const things = loose ? loose.push(hx, hz, 0.95, dx, dz, 6) : 0;
    // a car in reach: a dent, a hollow bang
    let car = null;
    for (const v of vehicles.live) { if (v.away || !v.circles) continue; if (Math.hypot(v.x - hx, v.z - hz) < (v.radius || 1) + 1.0) { car = v; break; } }
    if (car) { car.damage = Math.min(1.2, (car.damage || 0) + 0.06); vehicles.showDamage(car); effects.emit('spark', hx, 1.0, hz, dx * 2, 2, dz * 2, 1); }
    if (people || things || car) {
      if (sound.batHit) sound.batHit(car ? 'metal' : things ? 'thing' : 'soft');
      if (navigator.vibrate) navigator.vibrate(40);
    }
    if (people) { city.people.scareAt(px, pz, 22); wanted(car && car.role === 'police' ? 3 : 2); }
    else if (car && (car.role === 'police' || car.npc)) wanted(car.role === 'police' ? 3 : 1);
    return { people, things, car: !!car };
  }
  const _q = new THREE.Quaternion(), _b4 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
  function fire() {
    const I = INFO[current];
    const px = player.position.x, pz = player.position.z, py = player.position.y;
    let [dx, dz] = fwd();
    // somebody in front (within 14 degrees): the shot goes to them
    let best = null, bestD = I.range;
    const aimAt = (x, z) => {
      const ex = x - px, ez = z - pz, d = Math.hypot(ex, ez);
      if (d < 1.2 || d >= bestD) return;
      if ((ex * dx + ez * dz) / d < 0.97) return;
      best = [ex / d, ez / d]; bestD = d;
    };
    for (const p of city.people.people) if (p.alive && !(p.fall > 0)) aimAt(p.x, p.z);
    if (site && site.near) for (const w of site.workers) if (!(w.fall > 0) && w.y - site.site.curb < 1) aimAt(w.x, w.z);
    if (best) { dx = best[0]; dz = best[1]; }
    // (no shot is perfectly straight)
    const sp = (Math.random() - 0.5) * 2 * I.spread, c = Math.cos(sp), s = Math.sin(sp);
    [dx, dz] = [dx * c + dz * s, dz * c - dx * s];
    // (the line starts at the player, not at the muzzle: a muzzle held into a wall must not shoot through it)
    const ox = px, oz = pz, oy = py + 1.38;
    // ---- where does it stop? the first wall on its way ----
    let tHit = I.range, what = 'air';
    for (const b of city.colliders.boxes) {
      if (b.h < 1.3) continue;
      // (the line against the box, seen from above)
      let t0 = 0, t1 = tHit;
      if (Math.abs(dx) < 1e-6) { if (ox < b.minX || ox > b.maxX) continue; }
      else { const a = (b.minX - ox) / dx, bb = (b.maxX - ox) / dx; t0 = Math.max(t0, Math.min(a, bb)); t1 = Math.min(t1, Math.max(a, bb)); if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-6) { if (oz < b.minZ || oz > b.maxZ) continue; }
      else { const a = (b.minZ - oz) / dz, bb = (b.maxZ - oz) / dz; t0 = Math.max(t0, Math.min(a, bb)); t1 = Math.min(t1, Math.max(a, bb)); if (t0 > t1) continue; }
      if (t0 < tHit) { tHit = t0; what = 'wall'; }
    }
    // ---- everything nearer than that along the line ----
    // how far along the line is the point nearest to (x, z), and how far is it from the line?
    const along = (x, z) => (x - ox) * dx + (z - oz) * dz, off = (x, z) => Math.abs((x - ox) * dz - (z - oz) * dx);
    let hitPerson = null, hitWorker = null, hitCar = null, hitTraffic = null;
    for (const p of city.people.people) { if (!p.alive || p.fall > 0) continue; const a = along(p.x, p.z); if (a > 0.3 && a < tHit && off(p.x, p.z) < 0.4) { tHit = a; hitPerson = p; hitWorker = hitCar = null; what = 'person'; } }
    if (site && site.near) for (const w of site.workers) { if (w.fall > 0 || w.y - site.site.curb > 1) continue; const a = along(w.x, w.z); if (a > 0.3 && a < tHit && off(w.x, w.z) < 0.4) { tHit = a; hitWorker = w; hitPerson = hitCar = null; what = 'person'; } }
    for (const v of vehicles.live) {
      if (v.away || !v.circles || v === vehicles.active) continue;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      for (const k of v.circles) { const cx = v.x + fx * k, cz = v.z + fz * k, a = along(cx, cz); if (a > 0.3 && a - v.radius < tHit && off(cx, cz) < v.radius) { tHit = Math.max(0.3, a - v.radius * 0.8); hitCar = v; hitPerson = hitWorker = null; what = 'car'; } }
    }
    for (const c of city.traffic.cars) { if (!c.alive) continue; const a = along(c.wx, c.wz); if (a > 0.3 && a - 1.2 < tHit && off(c.wx, c.wz) < 1.1) { tHit = Math.max(0.3, a - 1.0); hitTraffic = c; hitCar = hitPerson = hitWorker = null; what = 'car'; } }
    const ex = ox + dx * tHit, ez = oz + dz * tHit;
    // loose street things on the way (the nearest cell every few meters)
    let things = 0;
    if (loose) for (let a = 1; a < tHit + 0.5; a += 3) {
      const cx = ox + dx * a, cz = oz + dz * a;
      for (const c of city.colliders.near(cx, cz).circles.slice()) { if (!c.loose || c.gone) continue; const ac = along(c.x, c.z); if (ac > 0.3 && ac < tHit + 0.3 && off(c.x, c.z) < c.r + 0.12) things += loose.knock(c, dx * 5, dz * 5); }
    }
    // ---- what the hit does ----
    if (hitPerson) city.people.knockAt(hitPerson.x, hitPerson.z, 0.3, dx, dz, 2.6);
    if (hitWorker) site.knockAt(hitWorker.x, hitWorker.z, 0.3, dx, dz, 2.2);
    if (hitCar) { hitCar.damage = Math.min(1.2, (hitCar.damage || 0) + (current === 'rifle' ? 0.035 : 0.05)); vehicles.showDamage(hitCar); }
    if (hitTraffic && hitTraffic.honk === undefined && sound.honk) sound.honk(0.4);
    const sy = what === 'person' ? oy - 0.2 : oy - 0.1;
    if (what === 'wall' || what === 'car') for (let i = 0; i < 4; i++) effects.emit('spark', ex, sy, ez, -dx * 2 + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, -dz * 2 + (Math.random() - 0.5) * 3, 0.8);
    if (what === 'wall') effects.emit('dust', ex - dx * 0.1, sy, ez - dz * 0.1, -dx * 0.6, 0.5, -dz * 0.6, 0.5);
    // ---- what is seen and heard: the flash, the line, the bang ----
    const T = tracers[nextTracer = (nextTracer + 1) % tracers.length];
    const m0 = MUZZLE[current] || 0.3;
    T.m.position.set(px + dx * (0.45 + m0), oy, pz + dz * (0.45 + m0));
    T.m.rotation.set(0, Math.atan2(dx, dz), 0);
    T.m.scale.set(1, 1, Math.max(0.1, tHit - 0.45 - m0));
    T.m.visible = true; T.t = 0.06;
    flash.position.set(px + dx * (0.5 + m0), oy, pz + dz * (0.5 + m0));
    flash.scale.setScalar(current === 'rifle' ? 0.6 : 0.42);
    flash.visible = true; flashT = 0.045;
    if (sound.gunshot) sound.gunshot(current);
    if (navigator.vibrate) navigator.vibrate(current === 'rifle' ? 12 : 25);
    if (api.onEvent) api.onEvent('shot', { x: px, z: pz, dx, dz, d: tHit, w: current });
    // ---- the city reacts ----
    city.people.scareAt(px, pz, 45);
    wanted(hitCar && hitCar.role === 'police' ? 4 : hitPerson || hitWorker ? 3 : 2);
    return { what, dist: +tHit.toFixed(1), things };
  }

  // A PUNCH (empty hands): whoever is right in front staggers back for a moment (nobody falls, nobody is hurt)
  function punchHit() {
    const [dx, dz] = fwd(), px = player.position.x, pz = player.position.z, hx = px + dx * 0.8, hz = pz + dz * 0.8;
    let people = city.people.staggerAt ? city.people.staggerAt(hx, hz, 0.75, dx, dz) : 0;
    if (site && site.knockAt && !people) people += site.knockAt(hx, hz, 0.6, dx, dz, 1.2);
    const things = loose ? loose.push(hx, hz, 0.55, dx, dz, 2.5) : 0;
    let car = null;
    for (const v of vehicles.live) { if (v.away || !v.circles) continue; if (Math.hypot(v.x - hx, v.z - hz) < (v.radius || 1) + 0.6) { car = v; break; } }
    if (people || things || car) { if (sound.batHit) sound.batHit(car ? 'metal' : 'soft'); if (navigator.vibrate) navigator.vibrate(25); }
    if (people) { city.people.scareAt(px, pz, 14); wanted(1); }
    return { people, things, car: !!car };
  }
  function attack() {
    if (cool > 0) return null;
    cool = INFO[current].every;
    // the bat and the fist: the swing is an action of the body (wind-up, strike, recover: src/characters/animStates.js);
    // what it hits is worked out in the middle of the strike
    if ((current === 'bat' || current === 'none') && player.actions) {
      const bat = current === 'bat';
      if (!player.actions.play('attack', { weapon: bat ? 'bat' : 'fist', onStrike: () => (bat ? batHit() : punchHit()) })) { cool = 0; return null; }
      if (bat && sound.batSwing) setTimeout(() => sound.batSwing(), 150);
      if (api.onEvent) api.onEvent('bat', { x: player.position.x, z: player.position.z, dx: Math.sin(player.heading), dz: Math.cos(player.heading) });
      return { what: 'swing' };
    }
    if (current === 'none') return null;
    if (current === 'bat') {
      swing = 0.42; hitDone = false;
      player.setPose('batSwing', 0.1);
      if (sound.batSwing) sound.batSwing();
      if (api.onEvent) api.onEvent('bat', { x: player.position.x, z: player.position.z });
      return { what: 'swing' };
    }
    return fire();
  }

  // the shot of somebody else (another player online): its line, flash and bang, and the people run
  function showShot(x, y, z, dx, dz, dist, kind = 'pistol') {
    const T = tracers[nextTracer = (nextTracer + 1) % tracers.length], m0 = MUZZLE[kind] || 0.3;
    T.m.position.set(x + dx * (0.45 + m0), y + 1.38, z + dz * (0.45 + m0));
    T.m.rotation.set(0, Math.atan2(dx, dz), 0);
    T.m.scale.set(1, 1, Math.max(0.1, dist - 0.45 - m0));
    T.m.visible = true; T.t = 0.06;
    const far = Math.hypot(x - player.position.x, z - player.position.z);
    if (far < 120 && sound.gunshot) sound.gunshot(kind);
    if (far < 60) city.people.scareAt(x, z, 45);
  }
  const api = {
    // set by main.js: (kind, data) - what the other players of an online world should see
    onEvent: null, showShot,
    get current() { return current; },
    get armed() { return current === 'pistol' || current === 'rifle'; },
    set, next, attack, meshes,
    // tests: the hit of a bat swing right now; where a weapon sits in the hand
    batHit, punchHit,
    tune(kind, p, r) { meshes[kind].position.fromArray(p); meshes[kind].rotation.set(r[0], r[1], r[2]); },
    update(dt, ctx = {}) {
      const can = !!ctx.can;
      if (can !== shown) {
        shown = can;
        bWeapon.hidden = !can;
        if (!can && current !== 'none') { for (const k of Object.keys(meshes)) meshes[k].visible = false; if (!ctx.keepPose) player.setPose('idle', 0.2); }
        else if (can && current !== 'none') show(current);
        label();
      }
      cool = Math.max(0, cool - dt);
      // the swing of the bat: the hit lands in its middle, then the arm goes back
      if (swing > 0 && !player.actions) {
        swing -= dt;
        if (!hitDone && swing < 0.27) { hitDone = true; if (can) batHit(); }
        if (swing <= 0 && can && current === 'bat') player.setPose('bat', 0.25);
      }
      if (can && (holdFire || keyFire)) {
        // (no shooting in a room: the bank's guard would not like it - and a room has no street to hit)
        if (ctx.inside && current !== 'bat' && current !== 'none') { if (cool <= 0) { cool = 0.8; hud.toast(t('ui.weapon.notHere'), 1600); } }
        else attack();
      }
      // a gun always points where the player looks, level - whatever the hand is doing at this moment of the pose
      if (shown && hand && (current === 'pistol' || current === 'rifle')) {
        hand.getWorldQuaternion(_q).invert();
        meshes[current].quaternion.copy(_q).multiply(_b4.setFromAxisAngle(_up, player.heading));
      }
      for (const T of tracers) if (T.t > 0) { T.t -= dt; if (T.t <= 0) T.m.visible = false; }
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.visible = false; }
    },
    // a new game, the story starts: empty hands
    reset() { if (current !== 'none') { current = 'none'; for (const k of Object.keys(meshes)) meshes[k].visible = false; label(); } swing = 0; holdFire = false; },
  };
  return api;
}
