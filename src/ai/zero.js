// ---------------------------------------------------------------------------
// zero.js - ZERO, the black car nobody has seen the driver of.
//
// 1. THE ZERO PROXIMITY SYSTEM (after Chapter 4: the saved flag zero_found_race)
//    Outside a mission (free roam), when Nate drives at full speed for more than 10 seconds, Zero can come out
//    of the dark behind him. It is calm, not a chase:
//      * it follows his own track, about 40 m back (the "shadow" driver of src/story/drivers.js). It never comes
//        closer, never touches him, never attacks
//      * no siren, no engine sound: only its thin cold bar of light, and a faint deep heartbeat (music.js)
//      * when he slows down below 80 km/h it lets go: it brakes, its light goes out, and it is gone
//      * after that it stays away for a while (at least a minute and a half)
//
// 2. THE STRIKE (the last turn of the final race of Chapter 4)
//    strike(): Zero comes down the dark street ahead, passes Nate close on his left without touching him, and
//    goes through the field behind him. Every car it touches spins and stops (no fire, no gore: the drivers climb
//    out). Then it is gone into the dark (stage 'dark'), until the story calls stare(): it stands in front of
//    Nate, facing him, headlights on. After a few seconds it turns away and drives off ('away', then 'gone').
//    Every stage change is an event the story can wait for: 'pass', 'hit', 'dark', 'stare', 'away', 'gone'.
// ---------------------------------------------------------------------------

import { lin } from '../city/models.js';
import { stepCar, stepSimpleCar } from '../vehicles/physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KMH = 3.6;
const DARK = [0.07, 0.075, 0.085];          // the paint: almost black, a little blue
const TRAIL_STEP = 2.5;                     // meters between the points of the player's track

// THE BLACK CAR itself (also used by the night run of Chapter 8, src/story/nightRun.js). arena: a place with its own
// ground and walls (the raised highway), or null
export function spawnZeroCar(vehicles, x, z, heading, arena = null) {
  const o = { keep: true, npc: true, noDetail: true, tint: DARK, lights: 'bar', arena };
  const v = vehicles.spawn('tech_patrol_car', x, z, heading, lin([0.02, 0.02, 0.025]), o)
    || vehicles.spawn('sedan', x, z, heading, lin([0.02, 0.02, 0.025]), { ...o, noDetail: false });
  if (v) { v.type = { ...v.type, role: 'car', topSpeed: 260 }; v.role = 'car'; v.label = 'ZERO'; v.zero = true; v.lockExit = true; }
  return v;
}

// A CAR THAT ZERO TOUCHES: it spins, slides and stops (the brakes lock; smoke from the tires). No fire, no gore.
// from: the car that touched it (Zero). fx: { vehicles, sound, effects }. side: push it this way (-1 / 1 across the
// road, 0 = away from Zero)
const STOP_IN = { steer: 0, gas: 0, brake: 1, handbrake: true, nitro: false };
export function spinOutCar(car, from, fx, side = 0) {
  car.damage = Math.max(car.damage || 0, 0.5); fx.vehicles.showDamage(car);
  // most of its speed is gone in the touch (so nobody slides on into Nate), and it turns hard
  const dx = car.x - from.x, dz = car.z - from.z, l = Math.hypot(dx, dz) || 1;
  const across = dx * Math.cos(from.heading) - dz * Math.sin(from.heading);
  car.vx *= 0.3; car.vz *= 0.3; car.forward *= 0.3;
  const kick = 4.5 + Math.random() * 2;
  if (side) car.vx += side * kick; else { car.vx += (dx / l) * kick; car.vz += (dz / l) * kick; }
  car.yawSpin = (across > 0 ? 1 : -1) * (4.5 + Math.random() * 2);
  car.nitroOn = false; car.boost = 0;
  fx.sound.crash('heavy', 0.5);
  for (let i = 0; i < 9; i++) fx.effects.emit('spark', car.x - (dx / l) * 1.2, car.y + 0.5, car.z - (dz / l) * 1.2, (Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6);
  car.spunOut = true;
  car.braking = true;
  // from now on it only brakes (the same physics as every car: it slides, turns, and stops)
  car.ai = (c, dt, world) => {
    stepCar(c, STOP_IN, dt, world);
    c.spin += (c.forward * dt) / (c.info.wheelR || 0.33);
    c.braking = true;
    if (Math.abs(c.slide) + Math.abs(c.forward) > 2.5 && Math.random() < 0.3) fx.effects.emit('smoke', c.x, c.y + 0.3, c.z, 0, 0.8, 0, 1.1);
  };
}

export function createZero({ vehicles, drivers, music, sound, effects, flags }) {
  // ---- the black car ----
  const spawnCar = (x, z, heading) => spawnZeroCar(vehicles, x, z, heading);

  // ================================================================== 1. the proximity system
  const Z = { v: null, fast: 0, slow: 0, cool: 0, leaving: 0, level: 0 };
  const track = [];                          // the player's own track (only while he drives in free roam)
  let lastX = 0, lastZ = 0;
  // ctx: { free (true = outside a mission), car (the car the player drives, or null) }
  function update(dt, ctx) {
    if (S.active) { stepStrike(dt); return; }
    Z.cool = Math.max(0, Z.cool - dt);
    // (in a mission it stays away, and leaves the music to the story)
    if (!ctx.free && !Z.v) { Z.fast = 0; track.length = 0; return; }
    const fl = flags() || {};
    const allowed = !!fl.zero_found_race && ctx.free;
    const c = ctx.car && ctx.car.isCar && !ctx.car.dead ? ctx.car : null;
    const kmh = c ? Math.hypot(c.vx, c.vz) * KMH : 0;
    // "full speed" for this car: 140 km/h, or 80 % of what a slower car can do (a van counts at its own top speed)
    const full = c ? Math.min(140, c.type.topSpeed * 0.8) : Infinity;
    // the track: a point every 2.5 m (Zero drives exactly where he drove)
    if (allowed && c) {
      if (!track.length || Math.hypot(c.x - lastX, c.z - lastZ) >= TRAIL_STEP) {
        track.push({ x: c.x, z: c.z }); lastX = c.x; lastZ = c.z;
        if (track.length > 240) track.splice(0, 80);
      }
    } else if (!Z.v) track.length = 0;
    if (!Z.v) {
      // (a short lift at a crossing does not start the count again: it only goes back slowly)
      Z.fast = allowed && c ? (kmh >= full ? Z.fast + dt : Math.max(0, Z.fast - dt * 2)) : 0;
      if (Z.fast > 10 && Z.cool <= 0 && track.length > 44) appear(c);
      Z.level += (0 - Z.level) * Math.min(1, dt * 2);
      music.setZero(Z.level);
      return;
    }
    // ---- Zero is here ----
    const v = Z.v;
    if (!vehicles.live.includes(v)) { Z.v = null; return; }
    if (!ctx.free) { gone(); return; }                         // (a mission starts: it is not part of it)
    if (!Z.leaving) drivers.update();                          // (his track for the shadow driver: the story is not running it now)
    const d = c ? Math.hypot(v.x - c.x, v.z - c.z) : 999;
    // IT NEVER COMES CLOSE: inside 32 m it cannot be faster than him (when he stops dead - a crash - it simply
    // stands still out there; nobody sees how it braked)
    if (d < 32) {
      const ps = c ? Math.hypot(c.vx, c.vz) : 0, zs = Math.hypot(v.vx, v.vz), cap = Math.max(0, ps - 1);
      if (zs > cap) { const k = zs > 0 ? cap / zs : 0; v.vx *= k; v.vz *= k; v.forward = Math.min(v.forward, cap); }
    }
    Z.slow = !c || kmh < 80 ? Z.slow + dt : 0;
    if (!Z.leaving && (!allowed || Z.slow > 0.8)) letGo(v);
    if (Z.leaving) {
      Z.leaving += dt;
      if (Z.leaving > 1.1) v.lights = 'off';                  // its light goes out: it is part of the dark again
      if (Z.leaving > 7 || d > 140) gone();
    }
    // the deep heartbeat: louder the closer it is (quiet again while it falls back)
    const near = clamp(1 - (d - 30) / 90, 0, 1) * (Z.leaving ? Math.max(0, 1 - Z.leaving / 2.5) : 1);
    Z.level += (near - Z.level) * Math.min(1, dt * 1.5);
    music.setZero(Z.level);
  }
  function appear(c) {
    // out of the dark behind him: on his own track, about 100 m back (outside the light of his car)
    const i = Math.max(1, track.length - 1 - 40), p = track[i], q = track[i + 1];
    const v = spawnCar(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z));
    if (!v) return;
    const sp = Math.hypot(c.vx, c.vz) * 0.96;
    v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
    // the shadow driver follows the same list of points (drivers.trail): give it this track
    drivers.reset();
    for (const t of track) drivers.trail.push({ x: t.x, z: t.z });
    drivers.shadow(v, { gap: 40 });
    if (v.aiInfo) v.aiInfo.k = i + 1;                         // (start at its own place on the track, not at the end)
    Z.v = v; Z.leaving = 0; Z.slow = 0; Z.fast = 0;
  }
  // it lets go: brakes on its line and stays behind
  function letGo(v) {
    Z.leaving = 1e-6;
    v.aiInfo = null;
    v.ai = (car, dt, world) => {
      const h = car.heading;
      stepSimpleCar(car, car.x + Math.sin(h) * 20, car.z + Math.cos(h) * 20, 0, dt, world);
      car.braking = car.forward > 1;
      car.spin += (car.forward * dt) / (car.info.wheelR || 0.33);
    };
  }
  function gone() {
    if (Z.v) { if (vehicles.live.includes(Z.v)) vehicles.removeVehicle(Z.v); Z.v = null; drivers.reset(); }
    Z.cool = 90; Z.leaving = 0; Z.fast = 0;
    track.length = 0;
    music.setZero(0); Z.level = 0;
  }

  // ================================================================== 2. the strike (the final race)
  const S = { active: false, stage: '', v: null, t: 0, events: [] };
  // o: { line (the race's line, raceLine.js), field: [vehicles], playerCar, speed (km/h), ahead (m: where it
  //      comes from, along the line in front of Nate), side (m: how far to his left it passes), stopAhead (m: where
  //      it stands in front of him), stareFor (s), awayDist (m) }
  function strike(o) {
    if (Z.v) gone();
    const line = o.line, pc = o.playerCar;
    if (!line || !pc) return false;
    const me = line.project(pc.x, pc.z, -1);
    Object.assign(S, {
      active: true, stage: 'run', t: 0, line, pc, hit: new Set(), field: (o.field || []).filter((f) => f && f !== pc),
      speed: (o.speed || 120) / KMH, reach: o.reach || 170, side: o.side ?? 3.6, stopAhead: o.stopAhead || 16, stareFor: o.stareFor || 3.4, awayDist: o.awayDist || 170,
      s: line.wrap(me.s + (o.ahead || 120)), d: me.d + (o.side ?? 3.6), passed: false, saidPass: false, events: [],
    });
    const P = line.midAt(S.s, {});
    S.v = spawnCar(P.x + P.dz * S.d, P.z - P.dx * S.d, Math.atan2(-P.dx, -P.dz));
    if (!S.v) { S.active = false; S.stage = 'gone'; S.events.push('gone'); return false; }
    S.v.ai = () => {};                                         // (moved by the strike itself, exactly)
    S.v.ghost = true;                                          // (its touches are the strike's own: spinOut)
    S.v.lights = 'bar';
    return true;
  }
  const PM = {};
  // along the race line, BACKWARD (against the race), at "d" meters to the left of the line (as the racers see it)
  function moveOnLine(dt) {
    const v = S.v, line = S.line;
    S.s = line.wrap(S.s - S.speed * dt);
    line.midAt(S.s, PM);
    const nx = PM.x + PM.dz * S.d, nz = PM.z - PM.dx * S.d;
    const dx = nx - v.x, dz = nz - v.z, l = Math.hypot(dx, dz);
    if (l > 0.01) { const h = Math.atan2(dx, dz); v.heading += Math.atan2(Math.sin(h - v.heading), Math.cos(h - v.heading)) * Math.min(1, dt * 10); }
    v.x = nx; v.z = nz;
    v.y = vehicles.world.ground(v.x, v.z);
    v.forward = S.speed; v.vx = dx / Math.max(dt, 1e-4); v.vz = dz / Math.max(dt, 1e-4);
    v.spin += (S.speed * dt) / (v.info.wheelR || 0.33);
  }
  // meters from Zero's place on the line back to another place (+ = still to come, against the race direction)
  function backGap(fromS, toS) {
    let g = fromS - toS;
    if (S.line.closed) { const T = S.line.total; g = ((g % T) + T) % T; if (g > T / 2) g -= T; }
    return g;
  }
  // a car of the field is touched: it spins, slides and stops (the brakes lock; smoke from the tires)
  function spinOut(car) {
    spinOutCar(car, S.v, { vehicles, sound, effects });
    S.events.push('hit');
  }
  function stepStrike(dt) {
    const v = S.v;
    S.t += dt;
    if (!v || !vehicles.live.includes(v)) { S.active = false; S.stage = 'gone'; S.events.push('gone'); return; }
    if (S.stage === 'run') {
      const line = S.line, pc = S.pc;
      const me = line.project(pc.x, pc.z, -1);
      // who is next: the nearest car of the field it has not touched yet, still ahead of it (against the race)
      let next = null, best = Infinity;
      for (const car of S.field) {
        if (S.hit.has(car)) continue;
        const pr = line.project(car.x, car.z, -1), g = backGap(S.s, pr.s);
        if (g > -6 && g < best && g < S.reach) { best = g; next = { car, d: pr.d }; }
      }
      // across the road: first close past Nate's left side, then onto each car (its front corner)
      let wantD = me.d + S.side;
      if (!S.passed && backGap(S.s, me.s) < -8) S.passed = true;
      if (S.passed && next) wantD = next.d + (next.d > S.d ? -1.1 : 1.1);
      const maxW = (line.midAt(S.s, PM).w || 6) + 1.5;
      wantD = clamp(wantD, -maxW, maxW);
      S.d += clamp(wantD - S.d, -7 * dt, 7 * dt);
      moveOnLine(dt);
      if (S.passed && !S.saidPass) { S.saidPass = true; S.events.push('pass'); }
      // touching: within 4 m
      for (const car of S.field) {
        if (S.hit.has(car)) continue;
        const dx = car.x - v.x, dz = car.z - v.z;
        if (dx * dx + dz * dz < 16) { S.hit.add(car); spinOut(car); }
      }
      // all of them, or past the last one (a car it could not reach: touched in passing all the same)
      const left = S.field.filter((c) => !S.hit.has(c));
      const farPast = S.passed && (!next || best < -6) && S.t > 1.5;
      if (!left.length || farPast || S.t > 14) {
        for (const car of left) { S.hit.add(car); spinOut(car); }
        S.stage = 'dark'; S.t = 0;
        v.away = true;                                       // gone into the dark (the story films the wrecks now)
        S.events.push('dark');
      }
    } else if (S.stage === 'stare') {
      v.vx = v.vz = 0; v.forward = 0;
      if (S.t > S.stareFor) {
        // it turns away and goes, as quietly as it came
        S.stage = 'away'; S.t = 0;
        v.hiBeam = false; v.beamOn = false; v.lights = 'bar';
        S.awayFrom = { x: v.x, z: v.z, h: v.heading + Math.PI, u: 0 };     // (it turns around: back the way it came)
        S.events.push('away');
      }
    } else if (S.stage === 'away') {
      // a slow U-turn, then off into the dark, faster and faster
      const A = S.awayFrom;
      A.u = Math.min(1, A.u + dt / 1.4);
      const e = A.u * A.u * (3 - 2 * A.u);
      v.heading += Math.atan2(Math.sin(A.h - v.heading), Math.cos(A.h - v.heading)) * Math.min(1, dt * 3.2 * (0.3 + e));
      const sp = Math.min(55, 2 + S.t * S.t * 2.4);
      v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
      v.x += v.vx * dt; v.z += v.vz * dt; v.y = vehicles.world.ground(v.x, v.z);
      v.spin += (sp * dt) / (v.info.wheelR || 0.33);
      if (Math.hypot(v.x - A.x, v.z - A.z) > S.awayDist) {
        vehicles.removeVehicle(v); S.v = null; S.active = false; S.stage = 'gone'; S.events.push('gone');
      }
    }
  }
  // the story's moment: Zero stands in front of Nate, facing him, headlights on
  function stare() {
    const v = S.v;
    if (!v || !S.active) return false;
    const pc = S.pc, fx = Math.sin(pc.heading), fz = Math.cos(pc.heading);
    v.x = pc.x + fx * S.stopAhead; v.z = pc.z + fz * S.stopAhead;
    v.heading = pc.heading + Math.PI;
    v.y = vehicles.world.ground(v.x, v.z);
    v.vx = v.vz = 0; v.forward = 0;
    v.away = false;
    v.lights = 'normal'; v.hiBeam = true; v.beamOn = true;
    S.stage = 'stare'; S.t = 0;
    S.events.push('stare');
    return true;
  }
  function stopStrike() {
    if (S.v && vehicles.live.includes(S.v)) vehicles.removeVehicle(S.v);
    S.v = null; S.active = false; S.stage = '';
  }

  return {
    update, strike, stare, stopStrike, gone,
    get car() { return S.v || Z.v; },
    get follower() { return Z.v; },        // (the one behind him in free roam: main.js shows it in the mirror)
    get striking() { return S.active; },
    get stage() { return S.stage; },
    takeEvents() { return S.events.splice(0); },
    // (tests)
    get info() { return { here: !!Z.v, fast: +Z.fast.toFixed(1), cool: Math.round(Z.cool), level: +Z.level.toFixed(2), leaving: +Z.leaving.toFixed(1), track: track.length, striking: S.active, stage: S.stage }; },
    force(c) { if (!Z.v && c && track.length > 44) { appear(c); return true; } return false; },
  };
}
