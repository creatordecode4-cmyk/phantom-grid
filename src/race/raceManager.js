// ---------------------------------------------------------------------------
// raceManager.js - runs one race at a time (the data is in races.js).
//
//   start(name, { car, onEvent }) -> handle { done, result: 'win' | 'skip' | 'theo', place, time, fails }
//     car: the player's car (the story gives it). Five computer drivers are spawned on the grid.
//
//   THE RACE, step by step
//     grid      everybody stands on the start line (two by two)
//     count     3, 2, 1, GO - the cars are held, the player can rev the engine
//     run       CHECKPOINTS: invisible gates across the road, every ~90 m. They must be passed in order:
//               cutting a corner (or a block) misses one - "MISSED CHECKPOINT - GO BACK".
//               POSITION from the gates passed and the meters to the next one. LAPS on a lap race.
//               RUBBER BAND: a computer driver far ahead of the player drives a little slower, one far behind
//               a little faster (rivalAI.js). SLIPSTREAM: right behind another car there is less wind - a
//               little more speed. DRIFT BOOST: a clean drift (no wall) gives a short push. JUMPS: over a
//               ramp the car flies (no grip in the air) and lands with a thump.
//     finish    the player crosses the line: the last three seconds are shown again (REPLAY), then the result
//     fail      WRECKED (the car is broken), LAST PLACE (or not good enough), OUT OF TIME: RETRY from the line;
//               after two fails also SKIP
//
//   The cars of a race bump into each other (they did not before: story cars drove through each other).
//   The final race of Chapter 4 has a LAST TURN rule (races.js: lastTurn): it is only won on Theo's line.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { makeLine } from './raceLine.js';
import { createRival } from './rivalAI.js';
import { createRaceHud } from './raceHud.js';
import { RACES } from './races.js';
import { lin } from '../city/models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KMH = 3.6;
const ORD = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];
const RACE_ARMOR = 2.2;          // how much better a race car takes a hit (damage / this)

export function createRaces(G) {
  const { scene, camera, city, layout, vehicles, player, sound, effects, spectators, slowmo, text } = G;
  const t = text || ((k) => k);
  const hud = createRaceHud(() => { if (R && (R.state === 'run' || R.state === 'count')) restart(); });
  let R = null;
  const H = layout.highway;
  // the raised highway: the same "arena" as in the story (its own ground and crash walls)
  const HWY = { minX: H.minX + 0.45, maxX: H.maxX - 0.45, minZ: H.rampBottomZ - 4, maxZ: 760, ground: (x, z) => H.heightAt(z), entry: null };
  // the way UP the ramp from Neon Mile (in the city the ramp is closed by a row of barriers 1.5 m before its foot;
  // a race car that drives into the 9 m in front of it, heading north, joins the highway before it touches them,
  // and stays on it while it is there heading north - it only leaves the highway going south)
  const inEntry = (v) => v.x > H.minX + 0.6 && v.x < H.maxX - 0.6 && v.z > H.rampBottomZ - 9 && v.z < H.rampBottomZ - 0.4 && Math.cos(v.heading) > 0.2;
  HWY.entry = inEntry;
  const rampGate = { arena: HWY, test: (v) => !!R && R.byCar.has(v) && inEntry(v) };
  const groundAt = (x, z) => { const g = city.groundHeight(x, z); return x > H.minX && x < H.maxX && z > H.rampBottomZ ? Math.max(g, H.heightAt(z)) : g; };

  // ---- the ghost of Theo's line (the final race, after two misses): a faint trail on the road ----
  let ghost = null;
  function makeGhost(points) {
    if (ghost) { scene.remove(ghost); ghost.geometry.dispose(); }
    const pts = points.map((p) => new THREE.Vector3(p[0], groundAt(p[0], p[1]) + 0.06, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts);
    const n = 80, pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), d = curve.getTangentAt(i / n);
      const lx = d.z, lz = -d.x, l = Math.hypot(lx, lz) || 1, w = 0.42;
      pos.push(p.x + (lx / l) * w, p.y, p.z + (lz / l) * w, p.x - (lx / l) * w, p.y, p.z - (lz / l) * w);
      uv.push(i / n, 0, i / n, 1);
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // a soft pale line; a slow pulse runs along it in the driving direction
      fragmentShader: 'uniform float uTime; varying vec2 vUv; void main() { float edge = 1.0 - abs(vUv.y - 0.5) * 2.0; float run = 0.55 + 0.45 * sin(vUv.x * 18.0 - uTime * 6.0); float a = edge * edge * run * 0.42 * smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x)); gl_FragColor = vec4(vec3(0.62, 0.8, 1.0) * a, a); }',
    });
    ghost = new THREE.Mesh(geo, mat);
    ghost.renderOrder = 14; ghost.frustumCulled = false;
    scene.add(ghost);
  }

  // ---- a jump ramp: the car drives up the steel ramp, then flies ----
  function jumpState(C, J, dt) {
    const v = C.v;
    if (C.air) {
      C.air.t += dt;
      const lift = C.air.h0 + C.air.vy * C.air.t - 4.9 * C.air.t * C.air.t;
      if (lift <= 0) {
        // landing: a thump, sparks under the car, the suspension takes it
        C.air = null; v.lift = 0; v.airborne = false;
        v.heaveV -= 1.4;
        if (C.isPlayer) { sound.thump(1); if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* not allowed */ } } }
        for (let i = 0; i < 6; i++) effects.emit('spark', v.x + (Math.random() - 0.5) * 1.6, v.y + 0.1, v.z + (Math.random() - 0.5) * 1.6, v.vx * 0.3 + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, v.vz * 0.3 + (Math.random() - 0.5) * 3);
      } else { v.lift = lift; v.airborne = true; }
      return;
    }
    v.lift = 0;
    for (const j of J) {
      // along the ramp (0 = its foot, 1 = its lip) and across it
      const ax = v.x - j.x, az = v.z - j.z, along = ax * j.dx + az * j.dz, across = Math.abs(ax * j.dz - az * j.dx);
      if (across > j.w || along < -j.len || along > 0.6) continue;
      const fwd = v.vx * j.dx + v.vz * j.dz;
      if (fwd < 4) continue;
      if (along < 0) { v.lift = j.h * (1 + along / j.len); continue; }               // up the ramp
      // over the lip: into the air (the faster, the higher and longer)
      C.air = { t: 0, h0: j.h, vy: Math.min(7.5, fwd * j.kick) };
      v.airborne = true;
      if (C.isPlayer) G.onJump && G.onJump();
    }
  }

  // ------------------------------------------------------------------ start
  function start(name, opts = {}) {
    const def = typeof name === 'string' ? RACES[name] : name;
    if (!def) { console.warn('[race] no such race:', name); return { done: true, result: 'skip' }; }
    stop();
    const line = makeLine(def.route, { closed: def.laps > 1, width: def.width || 6, ground: groundAt, margin: def.margin });
    const handle = { done: false, result: null, place: 0, time: 0, fails: 0, events: [], shortcut: false };
    // the checkpoint gates: every "gateEvery" meters, the last one is the finish line
    // (none on a stretch where a shortcut is allowed - noGates)
    const sAt = (p) => line.project(p[0], p[1], -1).s;
    const holes = (def.noGates || []).map(([a, b]) => [sAt(a), sAt(b)]);
    const every = def.gateEvery || 90, n = Math.max(2, Math.round(line.total / every)), gates = [];
    for (let k = 1; k <= n; k++) {
      const s = (line.total * k) / n, p = line.midAt(Math.min(s, line.total - 0.01), {});
      if (k < n && holes.some(([a, b]) => s > a && s < b)) continue;
      gates.push({ s, x: p.x, z: p.z, w: p.w });
    }
    const lt = def.lastTurn ? { from: sAt(def.lastTurn.from), to: sAt(def.lastTurn.to), brake: sAt(def.lastTurn.brakeAt), restartS: sAt(def.lastTurn.restartAt) } : null;
    R = {
      def, line, gates, handle, opts, cars: [], byCar: new Map(), player: null, state: 'grid', t: 0, raceT: 0, stateT: 0,
      laps: def.laps || 1, fails: 0, lastTurnFails: 0, finished: [], replay: null, msgCool: 0, crowdNext: 0, wet: -1, lastTurn: null, lt, tookShortcut: false,
    };
    if (!vehicles.arenaGates.includes(rampGate)) vehicles.arenaGates.push(rampGate);
    // ---- the player and the five others ----
    const pv = opts.car;
    if (!pv) { console.warn('[race] no car for the player'); R = null; return { done: true, result: 'skip' }; }
    addCar(pv, { id: 'player', name: t('race.you'), isPlayer: true });
    // (a race car takes a knock better than a street car: bumping is part of racing, a wreck should be rare)
    R.armorWas = pv.type.armor;
    pv.type = { ...pv.type, armor: Math.max(pv.type.armor || 1, RACE_ARMOR) };
    const slots = gridSlots(def);
    (def.rivals || []).forEach((rd, k) => {
      const p = slots[k + 1] || slots[slots.length - 1];
      const v = vehicles.spawn(rd.kind, p.x, p.z, p.h, rd.color ? lin(rd.color) : null, { keep: true, npc: true, noDetail: !rd.detail, tint: rd.tint || null })
        || (rd.or ? vehicles.spawn(rd.or, p.x, p.z, p.h, rd.color ? lin(rd.color) : lin([0.1, 0.1, 0.11]), { keep: true, npc: true, noDetail: true }) : null);
      if (!v) return;
      v.type = { ...v.type, role: 'car', nitro: !!rd.nitro, ...(rd.type || {}) };
      v.type.armor = Math.max(v.type.armor || 1, RACE_ARMOR);
      v.role = 'car';                                   // (a Phantom body as a racer: not a police car)
      if (rd.label) v.label = rd.label;
      v.storyId = rd.id;
      addCar(v, { id: rd.id, name: rd.name ? t(rd.name) : rd.id.toUpperCase(), rd });
      if (opts.onSpawn) opts.onSpawn(rd.id, v);
    });
    // the computer drivers (they look at all the cars; their speed plan is made for their own car)
    const all = R.cars.map((c) => c.v);
    R.cars.forEach((C, k) => {
      if (!C.rd) return;
      C.ctx = { line, profile: null, cars: all, player: pv };
      C.rival = createRival(C.v, C.ctx, { skill: C.rd.skill, aggression: C.rd.aggression, lane: C.rd.lane, push: C.rd.push, nitro: C.rd.nitro, seed: k + 3 });
    });
    // the world around: no traffic on a closed road, no parked cars on it, the crowd, the ghost
    city.traffic.setCap(0);
    clearRoad(line);
    if (def.people !== undefined) city.people.setCap(def.people, true);
    if (spectators) spectators.set(def.crowds || [], groundAt);
    // red flares at the start of some groups of people (their glow, their smoke over the crowd)
    R.flares = (def.crowds || []).filter((c) => c.flare && (c.n || 0) > 0).map((c) => {
      const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], l = Math.hypot(dx, dz) || 1;
      const x = c.a[0] - (dx / l) * 1.2, z = c.a[1] - (dz / l) * 1.2;
      return { x, z, y: groundAt(x, z), t: Math.random() };
    });
    if (def.lastTurn && def.lastTurn.line) makeGhost(def.lastTurn.line);
    if (ghost) ghost.visible = false;
    hud.show(true); hud.card(null); hud.restartButton(true);
    reset(true);
    return handle;
  }
  // the parked cars of the city that stand on the race road go away (for the rest of this game)
  function clearRoad(line) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of line.mid) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const P = {};
    vehicles.clearParked((rec) => {
      if (rec.x < minX - 12 || rec.x > maxX + 12 || rec.z < minZ - 12 || rec.z > maxZ + 12) return false;
      const pr = line.project(rec.x, rec.z, -1);
      line.midAt(pr.s, P);
      return Math.abs(pr.d) < P.w + 2.4;
    });
  }
  function addCar(v, o) {
    const C = { v, id: o.id, name: o.name, isPlayer: !!o.isPlayer, rd: o.rd || null, rival: null, i: -1, s: 0, d: 0, prevS: 0, passed: 0, lapsDone: 0, done: false, time: 0, place: 0, wrongT: 0, missedT: 0, air: null, drift: 0, driftClean: true, boostT: 0, buf: [], slip: 0 };
    R.cars.push(C); R.byCar.set(v, C);
    if (o.isPlayer) R.player = C;
    v.track = { s: 0, d: 0 };
    return C;
  }
  // grid places: two by two behind the line, the player in the slot the race gives (default: the back row)
  function gridSlots(def) {
    const line = R.line, s0 = def.startS || 0, out = [], P = {};
    const count = 1 + (def.rivals || []).length, order = [];
    const mine = def.playerSlot === undefined ? count - 1 : def.playerSlot;
    for (let k = 0; k < count; k++) order.push(k);
    for (let k = 0; k < count; k++) {
      const row = Math.floor(k / 2), side = k % 2 ? -1 : 1, back = s0 - 7 - row * 8.5;
      if (!line.closed && back < 0) {
        // (a sprint starts at the first point: the grid goes on backward along the first piece of road)
        line.midAt(0, P);
        P.x -= P.dx * -back; P.z -= P.dz * -back;
      } else line.midAt(line.wrap(back), P);
      const lane = (def.gridLane || 0) + side * (def.gridSide || 2.3);
      out.push({ x: P.x + P.dz * lane, z: P.z - P.dx * lane, h: Math.atan2(P.dx, P.dz) });
    }
    // slot 0 is the player's
    const me = out.splice(mine, 1)[0];
    out.unshift(me);
    return out;
  }
  // everybody back on the grid (or, the final race after a miss in the last turn: the last mile)
  function reset(first = false, lastMile = false) {
    const line = R.line, def = R.def;
    R.state = 'grid'; R.stateT = 0; R.raceT = 0; R.finished.length = 0; R.replay = null; R.lastTurn = null;
    R.handle.done = false;
    const slots = gridSlots(def);
    R.cars.forEach((C, k) => {
      const v = C.v;
      let p = slots[k];
      if (lastMile && def.lastTurn) p = lastMileSlot(k);
      v.x = p.x; v.z = p.z; v.heading = p.h; v.vx = v.vz = 0; v.forward = 0; v.slide = 0; v.yawSpin = 0; v.steer = 0;
      v.y = groundAt(v.x, v.z); v.lift = 0; v.airborne = false; v.boost = 0; v.nitro = 1; v.nitroCool = 0; v.nitroOn = false;
      v.arena = H && v.x > H.minX && v.x < H.maxX && v.z > HWY.minZ ? HWY : null;
      if (v.isCar) { v.damage = 0; vehicles.showDamage(v); }
      v.frozen = true;
      C.i = -1; const pr = line.project(v.x, v.z, -1); C.s = C.prevS = pr.s; C.d = pr.d; C.i = pr.i;
      C.passed = lastMile ? R.gates.length * (R.laps - 1) + gateIndexAt(C.s) : 0;
      C.lapsDone = lastMile ? R.laps - 1 : 0;
      C.done = false; C.time = 0; C.place = 0; C.wrongT = 0; C.missedT = 0; C.air = null; C.drift = 0; C.boostT = 0; C.buf.length = 0;
      if (C.rival) { C.rival.halt = true; C.rival.i = -1; C.rival.move = 0; C.rival.mistake = null; }
      if (C.ctx && !C.ctx.profile) C.ctx.profile = line.speedProfile(v.type.grip * 0.94, 8.2, v.type.topSpeed / KMH);
    });
    R.wet = -1;
    if (lastMile) R.raceT = R.def.lastTurn.clock || 0;
    if (ghost) ghost.visible = R.lastTurnFails >= 2;
    player.place(R.player.v.x, R.player.v.z, R.player.v.heading);
    if (R.player.v.arena) player.position.y = R.player.v.y;
    R.player.v.lockExit = true;
    if (G.rigStart) G.rigStart();
    hud.note(t(R.def.title || 'race.title'), 2.2);
    emit(first ? 'start' : 'restart');
  }
  // which gate comes next at s (on the last lap, for the last-mile restart)
  function gateIndexAt(s) { let k = 0; while (k < R.gates.length && R.gates[k].s <= s) k++; return k; }
  function lastMileSlot(k) {
    const L2 = R.def.lastTurn, P = {}, line = R.line;
    // the player and Dante side by side, the others a little behind
    const row = k < 2 ? 0 : 1 + Math.floor((k - 2) / 2), side = k === 0 ? -1 : k === 1 ? 1 : (k % 2 ? -1 : 1);
    line.midAt(line.wrap(R.lt.restartS - row * 10), P);
    const lane = side * 2.4 + (L2.restartLane || 0);
    return { x: P.x + P.dz * lane, z: P.z - P.dx * lane, h: Math.atan2(P.dx, P.dz), speed: L2.restartKmh / KMH };
  }
  function restart() { if (!R) return; R.fails++; R.handle.fails = R.fails; reset(false); }
  function emit(name) { if (R) R.handle.events.push(name); if (R && R.opts.onEvent) R.opts.onEvent(name); }

  // ------------------------------------------------------------------ before the physics of this frame
  // (the cars of the race see each other: their circles join the list of moving things for the physics)
  function preVehicles(dt, input) {
    if (!R) return;
    const dyn = city.colliders.dynamic;
    if (dyn) for (const C of R.cars) {
      const v = C.v, fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      if (v.away) continue;
      for (const off of v.circles) dyn.push({ x: v.x + fx * off, z: v.z + fz * off, r: v.radius, veh: v });
    }
    // the countdown: the engine revs with the gas pedal, the car does not move
    if ((R.state === 'grid' || R.state === 'count') && input) {
      const v = R.player.v, gas = input.drive ? input.drive.gas : 0;
      v.rpm += ((900 + 6300 * gas * (0.85 + Math.random() * 0.15)) - v.rpm) * Math.min(1, dt * 8);
      v.fx.throttle = gas;
    }
  }

  // ------------------------------------------------------------------ every frame, after the physics
  function update(dt, time, input) {
    hud.update(dt);
    if (spectators) spectators.update(dt, time, R ? R.cars.map((c) => c.v) : null);
    if (ghost && ghost.visible) ghost.material.uniforms.uTime.value = time;
    if (!R) return;
    const line = R.line, def = R.def, P = R.player;
    R.stateT += dt;
    // the flares burn (near the player only: the smoke costs a little)
    for (const f of R.flares) {
      if (Math.abs(f.x - P.v.x) > 150 || Math.abs(f.z - P.v.z) > 150) continue;
      const fl = 0.75 + 0.25 * Math.sin(time * 23 + f.t * 9) * Math.sin(time * 9 + f.t * 3);
      effects.lamp(f.x, f.y + 0.35, f.z, 3.2 * fl, 0.32 * fl, 0.12 * fl, 0.55);
      f.t += dt;
      if (f.t > 0.22) { f.t = 0; effects.emit('smoke', f.x, f.y + 0.5, f.z, 0.5 + Math.random() * 0.6, 0.9, (Math.random() - 0.5) * 0.6, 1.3); }
    }
    // ---- wet roads: the drivers plan their corners for the grip there is ----
    const wet = vehicles.world.wet;
    if (Math.abs(wet - R.wet) > 0.15) {
      R.wet = wet;
      for (const C of R.cars) if (C.ctx) C.ctx.profile = line.speedProfile(C.v.type.grip * (1 - 0.34 * wet) * 0.94, 8.2 * (1 - 0.25 * wet), C.v.type.topSpeed / KMH);
    }
    if (R.state === 'grid') {
      if (R.stateT > 1.2) { R.state = 'count'; R.stateT = 0; R.countN = 3; hud.count('3'); sound.blip('sine', 660, 660, 0.14, 0.22); emit('count'); }
      track(dt, false);
      return;
    }
    if (R.state === 'count') {
      const n = 3 - Math.floor(R.stateT);
      if (n !== R.countN && n >= 1) { R.countN = n; hud.count(String(n)); sound.blip('sine', 660, 660, 0.14, 0.22); }
      if (R.stateT >= 3) {
        R.state = 'run'; R.stateT = 0;
        hud.count(t('race.go')); sound.blip('sine', 1320, 1320, 0.16, 0.5);
        for (const C of R.cars) { C.v.frozen = false; if (C.rival) C.rival.halt = false; }
        // the last mile of the final race: everybody is already rolling
        if (R.restartRolling) { for (const C of R.cars) { const sp = R.restartRolling; C.v.forward = sp; C.v.vx = Math.sin(C.v.heading) * sp; C.v.vz = Math.cos(C.v.heading) * sp; } R.restartRolling = 0; }
        emit('go');
      }
      track(dt, false);
      return;
    }
    if (R.state === 'replay') { playReplay(dt); return; }
    if (R.state === 'held') { engines(); return; }       // (handed over to the story: the engines are still heard)
    if (R.state === 'card') return;
    // ---------------------------------------------------------------- RUN
    R.raceT += dt;
    track(dt, true);
    rubberBand();
    slipstream(dt);
    // the player's car: drift boost, wrong way, missed checkpoint, wrecked, out of time
    const v = P.v, sp = Math.hypot(v.vx, v.vz);
    driftBoost(P, dt);
    for (const C of R.cars) {
      if (def.jumps) jumpState(C, R.jumps || (R.jumps = def.jumps.map(prepJump)), dt);
      // rivals' nitro: a blue flame at the back (the player's car has its own)
      if (!C.isPlayer && C.v.nitroOn && Math.random() < 0.8) {
        const cv = C.v, sx = Math.sin(cv.heading), sz = Math.cos(cv.heading);
        effects.emit('flame', cv.x + sx * (cv.info.backZ - 0.15), cv.y + 0.38 + (cv.lift || 0), cv.z + sz * (cv.info.backZ - 0.15), cv.vx - sx * 5, 0, cv.vz - sz * 5);
      }
      // rivals sliding: a little tire smoke
      if (!C.isPlayer && Math.abs(C.v.slide) > 4 && Math.random() < 0.3) effects.emit('smoke', C.v.x, C.v.y + 0.3, C.v.z, 0, 0.6, 0, 0.7);
      if (C.rival) for (const e of C.rival.events.splice(0)) emit(e);
      // a buffer of the last seconds (for the replay)
      C.buf.push({ t: R.raceT, x: C.v.x, y: C.v.y, z: C.v.z, h: C.v.heading, r: C.v.roll, p: C.v.pitch, l: C.v.lift || 0, st: C.v.steer });
      while (C.buf.length && C.buf[0].t < R.raceT - 4.5) C.buf.shift();
    }
    if (v.fx && v.fx.impact > 6 && sp < 6 && v.damage > 0.35) hud.note(t('race.hit'), 1.2, true);
    if (v.damage >= 0.92) { fail('wrecked'); return; }
    if (def.timeLimit && R.raceT > def.timeLimit) { fail('time'); return; }
    // the crowd: louder near the people, cheers when a car flies past
    if (spectators) {
      const near = spectators.near(v.x, v.z);
      sound.crowd(near * (0.55 + 0.45 * clamp(sp / 30, 0, 1)));
      R.crowdNext -= dt;
      if (near > 0.55 && sp > 20 && R.crowdNext <= 0) { R.crowdNext = 2.2 + Math.random() * 2; sound.cheer(near); spectators.cheer(v.x, v.z); }
    }
    // the engines of the two nearest others
    engines();
    // the risky shortcut of the final race: it saves time, the road works there hurt the car
    if (def.shortcut && !R.tookShortcut) {
      const S = def.shortcut, ex = S.b[0] - S.a[0], ez = S.b[1] - S.a[1], l2 = ex * ex + ez * ez;
      const u = clamp(((v.x - S.a[0]) * ex + (v.z - S.a[1]) * ez) / l2, 0, 1);
      if (u > 0.15 && u < 0.85 && Math.hypot(v.x - S.a[0] - ex * u, v.z - S.a[1] - ez * u) < S.w) {
        R.tookShortcut = true; R.handle.shortcut = true;
        v.damage = Math.min(0.85, v.damage + S.damage); vehicles.showDamage(v);
        sound.crash('scrape', 0.8); sound.thump(0.9);
        hud.note(t('race.shortcut'), 2, true);
        emit(S.event || 'shortcut');
      }
    }
    // the last turn of the final race
    if (def.lastTurn) lastTurn(dt);
    // HUD
    hudUpdate();
  }

  // where every car is on the line: gates, laps, places
  function track(dt, live) {
    const line = R.line, gates = R.gates, total = R.gates.length * R.laps;
    for (const C of R.cars) {
      const v = C.v;
      const pr = line.project(v.x, v.z, C.i);
      C.i = pr.i; C.prevS = C.s; C.s = pr.s; C.d = pr.d;
      v.track.s = C.s; v.track.d = C.d;
      if (!live || C.done) continue;
      const g = gates[C.passed % gates.length];
      // crossing the next gate (on a lap line the finish gate sits at the very end: s jumps back to 0 there)
      const atEnd = g.s >= line.total - 0.05;
      let crossed;
      if (atEnd && line.closed) crossed = C.prevS > line.total - 80 && C.s < 80;
      else if (atEnd) crossed = C.s >= line.total - 1.5;
      else crossed = C.prevS < g.s && C.s >= g.s && C.s - C.prevS < 80;
      if (crossed && Math.abs(C.d) <= g.w + 3.5) {
        C.passed++; C.missedT = 0;
        if (atEnd) C.lapsDone++;
        if (C.isPlayer) {
          sound.blip('sine', 1046, 1046, 0.05, 0.08);
          if (atEnd && C.lapsDone === R.laps - 1 && R.laps > 1) { hud.note(t('race.final_lap'), 2.2); emit('finalLap'); }
          else if (atEnd && C.lapsDone < R.laps) { hud.note(`${t('race.lap')} ${C.lapsDone + 1}`, 1.6); emit('lap' + (C.lapsDone + 1)); }
        }
        if (C.passed >= total) finishCar(C);
      } else if (!atEnd && C.s > g.s + 22 && C.s - g.s < line.total / 2) {
        // past the gate without going through it: missed
        C.missedT += dt;
        if (C.isPlayer && C.missedT > 0.4) hud.note(t('race.missed'), 1.2, true);
      }
      // wrong way: driving against the line for a while
      if (C.isPlayer) {
        const p = line.midAt(C.s, {}), along = v.vx * p.dx + v.vz * p.dz;
        C.wrongT = along < -4 ? C.wrongT + dt : 0;
        if (C.wrongT > 1.2) hud.note(t('race.wrong_way'), 1.2, true);
      }
    }
    // places: finished cars first (in order), then by progress
    const order = R.cars.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1;
      if (a.done) return a.place - b.place;
      return progress(b) - progress(a);
    });
    order.forEach((C, k) => { if (!C.done) C.place = k + 1; });
  }
  // how far along the race a car is (meters; a missed gate holds it back)
  function progress(C) {
    const g = R.gates[C.passed % R.gates.length], prev = C.passed % R.gates.length ? R.gates[(C.passed % R.gates.length) - 1].s : 0;
    let into = C.s - prev;
    if (R.line.closed) { if (into > R.line.total / 2) into -= R.line.total; else if (into < -R.line.total / 2) into += R.line.total; }
    into = clamp(into, -40, g.s - prev + 3);
    return Math.floor(C.passed / R.gates.length) * R.line.total + prev + into;
  }
  function finishCar(C) {
    C.done = true; C.time = R.raceT;
    R.finished.push(C);
    C.place = R.finished.length;
    if (C.rival) C.rival.halt = false;
    if (C.isPlayer) playerFinished();
    else if (C.rival) C.rival.pace = 0.6;                 // (a finished car cruises on)
  }

  // ---- rubber band, slipstream, drift boost ----
  function diff() { const d = (G.settings && G.settings.difficulty) || 'n'; return d === 'e' ? { skill: 0.8, power: 0.94, band: 1 } : d === 'h' ? { skill: 1, power: 1.02, band: 0.3 } : { skill: 0.93, power: 0.98, band: 0.65 }; }
  function rubberBand() {
    const D = diff(), me = progress(R.player);
    for (const C of R.cars) {
      if (!C.rival || C.done) continue;
      const gap = progress(C) - me;                       // + = this driver is ahead of the player
      const k = clamp(gap / 160, -1, 1) * D.band;
      const s = C.rd.skill * D.skill;
      C.rival.skill = clamp(s, 0, 1);
      C.rival.pace = clamp(1 - 0.06 * k, 0.92, 1.05);
      C.rival.power = clamp((D.power + 0.06 * (s - 0.7)) * (1 - 0.07 * k), 0.86, 1.08);
    }
  }
  function slipstream(dt) {
    for (const A of R.cars) {
      const a = A.v, sp = Math.hypot(a.vx, a.vz);
      A.slip = 0;
      if (sp < 19 || a.airborne) continue;
      for (const B of R.cars) {
        if (B === A) continue;
        let ds = B.s - A.s;
        if (R.line.closed) { if (ds > R.line.total / 2) ds -= R.line.total; else if (ds < -R.line.total / 2) ds += R.line.total; }
        if (ds < 4 || ds > 28 || Math.abs(B.d - A.d) > 1.7) continue;
        A.slip = Math.max(A.slip, 1 - ds / 28);
      }
      if (A.slip > 0) { const push = 1.3 * A.slip * dt; a.vx += Math.sin(a.heading) * push; a.vz += Math.cos(a.heading) * push; }
    }
    const P = R.player;
    if (P.slip > 0.3) { P.slipT = (P.slipT || 0) + 1 / 60; if (P.slipT > 0.6) hud.note(t('race.slipstream'), 0.8); } else P.slipT = 0;
  }
  function driftBoost(C, dt) {
    const v = C.v, sp = Math.hypot(v.vx, v.vz);
    if (C.boostT > 0) { C.boostT -= dt; v.boost = clamp(C.boostT / 0.9, 0, 1); } else v.boost = 0;
    const sliding = Math.abs(v.slide) > 2.6 && sp > 11 && !v.airborne;
    if (sliding) { C.drift += dt; if (v.fx && v.fx.impact > 2.5) C.driftClean = false; }
    else if (C.drift > 0) {
      // the drift is over: clean and long enough = a push (a longer drift, a longer push)
      if (C.driftClean && C.drift >= 0.7) {
        C.boostT = clamp(0.6 + C.drift * 0.35, 0.8, 1.6);
        hud.note(t('race.drift_boost'), 1.1);
        sound.turbo();
        emit('driftBoost');
      }
      C.drift = 0; C.driftClean = true;
    }
  }
  function prepJump(j) {
    const f = (j.face || 0) * Math.PI / 180;
    // (compass degrees: 0 north, 90 east = -x)
    return { x: j.at[0], z: j.at[1], dx: -Math.sin(f), dz: Math.cos(f), len: j.len || 6, w: j.w || 4.5, h: j.h || 0.6, kick: j.kick || 0.2 };
  }
  // the engines of the two nearest other cars (pitch from their engine speed, loudness from the distance)
  function engines() {
    const v = R.player.v, list = [];
    for (const C of R.cars) {
      if (C.isPlayer || C.v.away) continue;
      const d = Math.hypot(C.v.x - v.x, C.v.z - v.z);
      list.push({ d, rpm: C.v.rpm || 900, gas: C.v.fx ? C.v.fx.throttle : 0, tone: C.v.type.tone, closing: ((C.v.vx - v.vx) * (v.x - C.v.x) + (C.v.vz - v.vz) * (v.z - C.v.z)) / Math.max(1, d) });
    }
    list.sort((a, b) => a.d - b.d);
    sound.rivals(list.slice(0, 2));
  }

  // ---- the last turn of the final race: only Theo's line wins it ----
  function lastTurn(dt) {
    const L2 = R.def.lastTurn, P = R.player, Z = R.lt;
    if (P.lapsDone !== R.laps - 1 || P.done) return;
    const s = P.s, kmh = Math.hypot(P.v.vx, P.v.vz) * KMH;
    if (!R.lastTurn && s >= Z.from && s < Z.to) {
      R.lastTurn = { ok: true, entry: kmh, worst: 0, braked: false, why: '' };
      if (kmh < L2.minKmh) { R.lastTurn.ok = false; R.lastTurn.why = 'slow'; }
      emit('lastTurn');
    }
    if (!R.lastTurn || R.lastTurn.done) return;
    // LATE BRAKE: still fast at the brake point
    if (!R.lastTurn.braked && s >= Z.brake) { R.lastTurn.braked = true; emit('lastBrake'); if (kmh < L2.brakeKmh) { R.lastTurn.ok = false; R.lastTurn.why = 'early'; } }
    // how far from Theo's line (meters) - from a little before the brake mark on (on the straight before it he may be
    // anywhere; he must be on the line when he brakes, and stay on it through the corner)
    if (s < Z.brake - 12) return;
    const pts = L2.line;
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1;
      const u = clamp(((P.v.x - a[0]) * ex + (P.v.z - a[1]) * ez) / l2, 0, 1);
      best = Math.min(best, Math.hypot(P.v.x - a[0] - ex * u, P.v.z - a[1] - ez * u));
    }
    R.lastTurn.worst = Math.max(R.lastTurn.worst, best);
    if (best > L2.width) { R.lastTurn.ok = false; R.lastTurn.why = R.lastTurn.why || 'line'; }
    if (kmh < L2.minApexKmh) { R.lastTurn.ok = false; R.lastTurn.why = R.lastTurn.why || 'slow'; }
    if (s >= Z.to) {
      R.lastTurn.done = true;
      if (R.lastTurn.ok) {
        // THEO'S LINE: the race hands over to the story (Zero comes now). The cars keep driving.
        R.handle.place = 1; R.handle.time = R.raceT; R.handle.result = 'theo'; R.handle.done = true;
        R.state = 'held';
        hud.show(false);
        emit('theoLine');
      } else {
        // Dante takes the turn: try the last mile again (after two misses Theo's line shows on the road)
        R.lastTurnFails++;
        fail('lastTurn');
      }
    }
  }

  // ---- the finish: the last 3 seconds again, then the result ----
  function playerFinished() {
    const P = R.player, need = R.def.need || (R.cars.length - 1);
    R.handle.place = P.place; R.handle.time = P.time;
    emit('finish');
    if (P.place > need) { fail(P.place >= R.cars.length ? 'last' : 'place'); return; }
    R.state = 'replay'; R.stateT = 0;
    R.replay = { t: 0, from: R.raceT - 3, cam: null };
    for (const C of R.cars) C.v.frozen = true;
    hud.replay(true);
  }
  const RP = {};
  function sample(buf, tt, out) {
    if (!buf.length) return null;
    let k = 0;
    while (k < buf.length - 1 && buf[k + 1].t < tt) k++;
    const a = buf[k], b = buf[Math.min(k + 1, buf.length - 1)], u = b.t > a.t ? clamp((tt - a.t) / (b.t - a.t), 0, 1) : 0;
    out.x = a.x + (b.x - a.x) * u; out.y = a.y + (b.y - a.y) * u; out.z = a.z + (b.z - a.z) * u;
    out.h = a.h + Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h)) * u; out.r = a.r + (b.r - a.r) * u; out.p = a.p + (b.p - a.p) * u; out.l = a.l + (b.l - a.l) * u; out.st = a.st;
    return out;
  }
  function playReplay(dt) {
    const Rp = R.replay;
    Rp.t += dt;
    const tt = Rp.from + Math.min(3, Rp.t);
    for (const C of R.cars) {
      const s = sample(C.buf, tt, RP);
      if (!s) continue;
      const v = C.v, moved = Math.hypot(s.x - v.x, s.z - v.z);
      v.x = s.x; v.y = s.y; v.z = s.z; v.heading = s.h; v.roll = s.r; v.pitch = s.p; v.lift = s.l; v.steer = s.st;
      v.spin += moved / (v.info.wheelR || 0.33);
    }
    if (Rp.t >= 3.2) {
      hud.replay(false);
      // (the cars come to a stop where the line is)
      for (const C of R.cars) { const v = C.v; v.vx = v.vz = 0; v.forward = 0; v.lift = 0; }
      showResult();
    }
  }
  function showResult() {
    R.state = 'card';
    const rows = R.cars.slice().sort((a, b) => a.place - b.place).map((C) => ({ place: C.place, name: C.name, time: C.done ? hud.fmt(C.time) : '', me: C.isPlayer }));
    hud.card({ title: ORD[R.player.place - 1] || String(R.player.place), sub: `${t(R.def.title || 'race.title')}  ·  ${hud.fmt(R.player.time)}`, rows, buttons: [[t('race.continue'), 'ok']] }, () => {
      R.handle.result = 'win'; R.handle.done = true; R.state = 'held';
      for (const C of R.cars) { C.v.frozen = false; if (C.rival) C.rival.halt = true; }
      emit('done');
    });
  }
  // ---- failing: a card, RETRY (and after two fails SKIP) ----
  function fail(why) {
    R.fails++; R.handle.fails = R.fails;
    R.state = 'card';
    for (const C of R.cars) { C.v.frozen = true; if (C.rival) C.rival.halt = true; }
    emit('fail');
    const titles = { wrecked: 'race.wrecked', last: 'race.last', place: 'race.not_enough', time: 'race.out_of_time', lastTurn: 'race.dante_turn' };
    // (the last turn: what went wrong - too slow, braked too early, off the line - or, after two misses, the ghost)
    const ltWhy = R.lastTurn && R.lastTurn.why ? R.lastTurn.why : 'line';
    const subs = { wrecked: 'race.wrecked_sub', last: 'race.last_sub', place: 'race.not_enough_sub', time: 'race.out_of_time_sub', lastTurn: why === 'lastTurn' && R.lastTurnFails >= 2 ? 'race.ghost_sub' : 'race.lt_' + ltWhy };
    const buttons = [[t('race.retry'), 'retry']];
    if (R.fails >= 2) buttons.push([t('race.skip'), 'skip']);
    hud.card({ title: t(titles[why]), sub: t(subs[why]), buttons }, (a) => {
      if (a === 'skip') {
        R.handle.result = R.def.lastTurn ? 'theo' : 'skip'; R.handle.place = 1; R.handle.done = true; R.state = 'held';
        for (const C of R.cars) { C.v.frozen = false; if (C.rival) C.rival.halt = true; }
        emit('skip');
        return;
      }
      // the final race: a miss in the last turn starts again on the last mile, not from the grid
      if (why === 'lastTurn') { R.restartRolling = R.def.lastTurn.restartKmh / KMH; reset(false, true); }
      else reset(false);
    });
  }

  function hudUpdate() {
    const P = R.player, g = R.gates[P.passed % R.gates.length], prev = P.passed % R.gates.length ? R.gates[(P.passed % R.gates.length) - 1].s : 0;
    let left = g.s - P.s;
    if (R.line.closed && left < -R.line.total / 2) left += R.line.total;
    const span = Math.max(1, g.s - prev);
    hud.set({ pos: P.place || R.cars.length, of: R.cars.length, lap: P.lapsDone + 1, laps: R.laps, time: R.raceT, limit: R.def.timeLimit || 0,
      cpDist: Math.max(0, left), cpFrac: 1 - clamp(left / span, 0, 1), label: P.passed % R.gates.length === R.gates.length - 1 ? (P.lapsDone === R.laps - 1 ? t('race.finish') : t('race.lap_line')) : t('race.checkpoint') });
  }

  // ------------------------------------------------------------------ the replay camera
  const _look = new THREE.Vector3();
  function applyCamera(dt) {
    if (!R || !R.replay || R.state !== 'replay') return false;
    const v = R.player.v, Rp = R.replay;
    if (!Rp.cam) {
      // a place at the side of the road, a little ahead of where the car was 1.5 s before the line
      const b = sample(R.player.buf, Rp.from + 1.6, {}) || { x: v.x, z: v.z, h: v.heading };
      const side = R.def.replaySide || 1, fx = Math.sin(b.h), fz = Math.cos(b.h);
      Rp.cam = new THREE.Vector3(b.x + fx * 9 + fz * 7 * side, groundAt(b.x, b.z) + 1.3, b.z + fz * 9 - fx * 7 * side);
    }
    camera.position.copy(Rp.cam);
    _look.set(v.x, v.y + 0.7 + (v.lift || 0), v.z);
    camera.lookAt(_look);
    return true;
  }

  // ------------------------------------------------------------------ the end of a race (the story is done with it)
  function stop(removeCars = true) {
    if (!R) return;
    hud.show(false); hud.card(null);
    sound.crowd(0); sound.rivals([]);
    if (spectators) spectators.clear();
    if (ghost) ghost.visible = false;
    for (const C of R.cars) {
      const v = C.v;
      v.frozen = false; v.lift = 0; v.airborne = false; v.boost = 0;
      if (C.isPlayer) { v.lockExit = false; v.type = { ...v.type, armor: R.armorWas || 1 }; continue; }
      if (removeCars && !(R.opts.keep && R.opts.keep.includes(C.id))) vehicles.removeVehicle(v);
      else if (C.rival) C.rival.halt = true;
    }
    const i = vehicles.arenaGates.indexOf(rampGate);
    if (i >= 0) vehicles.arenaGates.splice(i, 1);
    city.traffic.setCap(Infinity); city.people.setCap(Infinity);
    R = null;
  }

  return {
    start, stop, update, preVehicles, applyCamera, restart: () => restart(),
    get active() { return !!R; },
    get cameraActive() { return !!R && R.state === 'replay'; },
    get state() { return R ? R.state : null; },
    // the minimap: the line of the race, the other cars, the next gate
    get mapExtra() {
      if (!R) return null;
      const g = R.gates[R.player.passed % R.gates.length];
      if (!R.mapLine) { R.mapLine = []; for (let i = 0; i < R.line.mid.length; i += 3) R.mapLine.push(R.line.mid[i]); if (R.line.closed) R.mapLine.push(R.line.mid[0]); }
      return { line: R.mapLine, cars: R.cars.filter((C) => !C.isPlayer).map((C) => ({ x: C.v.x, z: C.v.z, color: C.rd && C.rd.dot ? C.rd.dot : '#ff6b5a' })), gate: { x: g.x, z: g.z } };
    },
    // a car of the race by its id (the story can talk about 'dante')
    car: (id) => (R ? (R.cars.find((C) => C.id === id) || {}).v || null : null),
    // the line of the race and the computer cars (Zero's strike in the final race)
    get line() { return R ? R.line : null; },
    get field() { return R ? R.cars.filter((C) => !C.isPlayer).map((C) => C.v) : []; },
    get playerCar() { return R ? R.player.v : null; },
    // tests
    get info() {
      if (!R) return null;
      return { state: R.state, t: +R.raceT.toFixed(1), place: R.player.place, lap: R.player.lapsDone + 1, passed: R.player.passed, gates: R.gates.length, total: Math.round(R.line.total), fails: R.fails,
        cars: R.cars.map((C) => ({ id: C.id, place: C.place, s: Math.round(C.s), d: +C.d.toFixed(1), passed: C.passed, kmh: Math.round(Math.hypot(C.v.vx, C.v.vz) * KMH), dmg: +(C.v.damage || 0).toFixed(2), done: C.done })) };
    },
    // (tests: the final race from the last mile, everybody rolling - as after a miss in the last turn)
    lastMile() { if (!R || !R.def.lastTurn) return false; R.restartRolling = R.def.lastTurn.restartKmh / KMH; reset(false, true); return true; },
    press(action) { const b = document.querySelector('#race-card button'); if (!b) return false; const all = [...document.querySelectorAll('#race-card button')]; const want = all.find((x) => x.textContent.toLowerCase().includes(action)) || b; want.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true; },
    hud,
  };
}
