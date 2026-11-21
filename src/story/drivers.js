// ---------------------------------------------------------------------------
// drivers.js - the computer drivers of the story.
//
// The story data says "this car drives like that" and this file does the
// driving. The ways of driving:
//
//   path      follow a line of points at a speed (race cars, cars that arrive
//             or leave). "kin" = moved exactly along the line, nothing can
//             push it off (for scenes that must happen the same way every time)
//   race      like path, but it speeds up or slows down so the race stays close
//   shadow    ZERO: follows the player's own track at a chosen distance. It
//             brakes late, runs wide out of corners and never touches the player
//   pursue    a Meridian Guard car: chases the player along the roads
//   overtake  an impatient car that passes the slow player and drives off
//   ram       drives straight at the player (the crash of the prologue)
//   stop      brakes and stands still
// ---------------------------------------------------------------------------

import { stepSimpleCar } from '../vehicles/physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A line of points with the distance along it: { pts, at (distance of each point), total }
export function makePath(points) {
  const pts = points.map((p) => ({ x: p[0], z: p[1] })), at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, at, total: at[at.length - 1] };
}
// how far along the path is the point nearest to (x, z)?
export function progressOn(path, x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < path.pts.length - 1; i++) {
    const a = path.pts[i], b = path.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1), d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (d < bestD) { bestD = d; best = path.at[i] + Math.sqrt(l2) * t; }
  }
  return best;
}
// the place at distance s along the path: { x, z, dx, dz (direction) }
export function pointOn(path, s, out = {}) {
  s = clamp(s, 0, path.total);
  let i = 0;
  while (i < path.pts.length - 2 && path.at[i + 1] < s) i++;
  const a = path.pts[i], b = path.pts[i + 1], l = path.at[i + 1] - path.at[i] || 1, t = (s - path.at[i]) / l;
  out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t; out.dx = (b.x - a.x) / l; out.dz = (b.z - a.z) / l;
  return out;
}

export function createDrivers({ vehicles, gps, city, player, sound }) {
  const P = {};
  const spinWheels = (v, dt) => { if (v.spin !== undefined && v.info) v.spin += (v.forward * dt) / v.info.wheelR; };
  // the vehicle the player drives (or null)
  const playerCar = () => (vehicles.state === 'driving' ? vehicles.active : null);
  const target = () => { const c = playerCar(); return c ? { x: c.x, z: c.z, speed: Math.hypot(c.vx, c.vz), heading: c.heading } : { x: player.position.x, z: player.position.z, speed: player.speed, heading: player.heading }; };

  // ------------------------------------------------------------------ path / race
  // o: { path, speed (m/s), kin, end: 'stop' | 'remove' | 'hold', offset (meters to the left of the line),
  //      race: { lead: meters this car wants to be ahead of the player, min, max (m/s) }, onEnd() }
  function path(v, o) {
    let s = progressOn(o.path, v.x, v.z), done = false;
    v.ai = (car, dt, world) => {
      if (done) { stop(car, dt, world); return; }
      let want = o.speed;
      if (o.race) {
        const t = target(), ps = progressOn(o.path, t.x, t.z);
        // behind the place it wants to be: faster. ahead of it: slower. (This keeps the race close.)
        want = clamp(t.speed + (ps + o.race.lead - s) * 0.22, o.race.min, o.race.max);
      }
      if (o.kin) {
        // moved exactly along the line
        car.forward += clamp(want - car.forward, -9 * dt, 6 * dt);
        s += car.forward * dt;
        pointOn(o.path, s, P);
        const side = o.offset || 0;
        car.x = P.x + P.dz * side; car.z = P.z - P.dx * side;
        const h = Math.atan2(P.dx, P.dz);
        car.heading += Math.atan2(Math.sin(h - car.heading), Math.cos(h - car.heading)) * Math.min(1, dt * 8);
        car.vx = P.dx * car.forward; car.vz = P.dz * car.forward;
        car.y = world.ground(car.x, car.z);
      } else {
        s = Math.max(s, progressOn(o.path, car.x, car.z));
        const ahead = 7 + Math.abs(car.forward) * 0.45;
        pointOn(o.path, s + ahead, P);
        const side = o.offset || 0;
        // slow down before a sharp bend in the line
        const here = pointOn(o.path, s, {}), bend = 1 - (here.dx * P.dx + here.dz * P.dz);
        if (bend > 0.04) want = Math.min(want, Math.max(9, want * (1 - bend * 1.6)));
        stepSimpleCar(car, P.x + P.dz * side, P.z - P.dx * side, want, dt, world);
      }
      car.braking = car.forward > want + 1.5;
      spinWheels(car, dt);
      if (s >= o.path.total - (o.kin ? 0.1 : 3)) {
        if (o.end === 'remove') { done = true; car.ai = null; vehicles.removeVehicle(car); }
        else if (o.end === 'hold') { /* keep the last speed (somebody else stops it) */ }
        else { done = true; car.forward = o.kin ? 0 : car.forward; car.vx = o.kin ? 0 : car.vx; car.vz = o.kin ? 0 : car.vz; }
        if (o.onEnd) { const cb = o.onEnd; o.onEnd = null; cb(car); }
      }
    };
    v.aiInfo = { mode: 'path', get s() { return s; } };
  }
  // brake to a stop and stay
  function stop(car, dt, world) {
    if (Math.abs(car.forward) < 0.05 && Math.abs(car.vx) + Math.abs(car.vz) < 0.05) { car.forward = 0; car.vx = car.vz = 0; car.braking = false; return; }
    stepSimpleCar(car, car.x + Math.sin(car.heading) * 20, car.z + Math.cos(car.heading) * 20, 0, dt, world);
    car.braking = true;
    spinWheels(car, dt);
  }

  // ------------------------------------------------------------------ shadow (Zero)
  // Zero drives exactly where the player drove: a trail of points is dropped behind the player's car.
  // o.gap: how many meters behind the player it stays (the story changes this number during the chase)
  const trail = [];
  let trailOn = false;
  function shadow(v, o) {
    trailOn = true;
    const S = { gap: o.gap || 16, k: Math.max(0, trail.length - 1), stuck: 0 };
    v.aiInfo = S;
    v.ai = (car, dt, world) => {
      const t = target();
      if (!trail.length) { stop(car, dt, world); return; }
      // the next point of the trail it has not passed yet
      while (S.k < trail.length - 1 && Math.hypot(trail[S.k].x - car.x, trail[S.k].z - car.z) < 4.2) S.k++;
      S.k = Math.min(S.k, trail.length - 1);
      const left = (trail.length - 1 - S.k) * 2.5 + Math.hypot(trail[S.k].x - car.x, trail[S.k].z - car.z);   // meters of trail between it and the player
      const top = car.type.topSpeed / 3.6;
      // closer than the gap: ease off (it could catch the player - it does not)
      let want = clamp(t.speed + (left - S.gap) * 0.8, 0, top);
      if (left < S.gap * 0.6) want = Math.min(want, t.speed * 0.8);
      // LATE BRAKE, WIDE EXIT: before a bend it keeps its speed longer than a careful driver, after the bend its
      // line swings to the outside of the corner (this is how Theo drove)
      const a = trail[Math.max(0, S.k - 3)], b = trail[S.k], c = trail[Math.min(trail.length - 1, S.k + 3)];
      const turn = Math.atan2(Math.sin(Math.atan2(c.x - b.x, c.z - b.z) - Math.atan2(b.x - a.x, b.z - a.z)), Math.cos(Math.atan2(c.x - b.x, c.z - b.z) - Math.atan2(b.x - a.x, b.z - a.z)));
      S.wide = (S.wide || 0) + (clamp(-turn * 3.2, -1.6, 1.6) - (S.wide || 0)) * Math.min(1, dt * 1.6);
      const dirx = c.x - b.x, dirz = c.z - b.z, dl = Math.hypot(dirx, dirz) || 1;
      const tx = b.x + (dirz / dl) * S.wide, tz = b.z - (dirx / dl) * S.wide;
      if (Math.abs(turn) > 0.35) want = Math.min(want, Math.max(11, top * 0.3));
      const before = car.x + car.z;
      stepSimpleCar(car, tx, tz, want, dt, world);
      car.braking = car.forward > want + 2;
      spinWheels(car, dt);
      // stuck against something or left far behind: come back onto the trail out of sight
      S.stuck = Math.abs(car.x + car.z - before) < 0.004 && want > 3 ? S.stuck + dt : 0;
      const far = Math.hypot(car.x - t.x, car.z - t.z);
      if ((S.stuck > 1.2 || far > 110) && trail.length > 22) {
        const i = trail.length - 1 - Math.round(Math.max(S.gap, 42) / 2.5), p = trail[Math.max(0, i)], q = trail[Math.max(1, i + 1)];
        car.x = p.x; car.z = p.z; car.heading = Math.atan2(q.x - p.x, q.z - p.z); car.forward = t.speed; car.vx = Math.sin(car.heading) * t.speed; car.vz = Math.cos(car.heading) * t.speed;
        S.k = Math.max(0, i + 1); S.stuck = 0;
      }
    };
  }

  // ------------------------------------------------------------------ pursue (Meridian Guard)
  function pursue(v, o = {}) {
    const C = { t: 0, route: null, check: 1.2, lastX: v.x, lastZ: v.z, back: 0, hold: o.hold || 0 };
    v.aiInfo = C;
    v.ai = (car, dt, world) => {
      const t = target(), dist = Math.hypot(t.x - car.x, t.z - car.z);
      C.t -= dt;
      if (C.t <= 0) { C.t = 0.5; C.route = dist > 26 ? gps.route(car.x, car.z, t.x, t.z) : null; }
      const aim = C.route && C.route.length > 1 ? gps.pointAhead(C.route, 14) || t : t;
      const top = (car.type.topSpeed / 3.6) * (o.pace || 0.8);
      // (C.hold: stay this far back - the story uses it to let the player get away)
      const want = dist < 9 + C.hold ? Math.min(t.speed, 4) : Math.min(top, Math.max(12, t.speed + 8 - C.hold * 0.2));
      const moved = Math.hypot(car.x - C.lastX, car.z - C.lastZ);
      stepSimpleCar(car, aim.x, aim.z, want, dt, world);
      car.braking = car.forward > want + 1;
      spinWheels(car, dt);
      C.check -= dt;
      if (C.check <= 0) { C.check = 1.2; if (moved < 0.6 && dist > 10) C.back = 0.9; C.lastX = car.x; C.lastZ = car.z; }
      if (C.back > 0) { C.back -= dt; car.forward = -4; }
    };
  }

  // ------------------------------------------------------------------ overtake
  // An impatient car: it comes up behind the player on a straight road, moves to the next lane, passes and is gone.
  // o: { dir: [dx, dz] the direction of the road, lanes: [a, b] the two lane lines (the coordinate across the road),
  //      axis: 'x' | 'z' (the road runs along this), speed, onPass() }
  function overtake(v, o) {
    let lane = o.lanes[0], passed = false, life = 0;
    const across = (x, z) => (o.axis === 'x' ? z : x);
    v.ai = (car, dt, world) => {
      life += dt;
      const t = target();
      const along = (t.x - car.x) * o.dir[0] + (t.z - car.z) * o.dir[1];          // + = the player is ahead
      // the player's lane is taken: use the other one (and move back after passing)
      const pl = across(t.x, t.z);
      const playerIn = Math.abs(pl - o.lanes[0]) < Math.abs(pl - o.lanes[1]) ? 0 : 1;
      if (along > -8 && along < 45) lane = o.lanes[1 - playerIn];
      // something slow ahead in this lane (traffic): brake
      let want = o.speed;
      for (const c of city.colliders.dynamic || []) {
        if (c.veh === car) continue;
        const ax = (c.x - car.x) * o.dir[0] + (c.z - car.z) * o.dir[1], side = Math.abs(across(c.x, c.z) - across(car.x, car.z));
        if (ax > 2 && ax < 22 && side < 1.9) { want = Math.min(want, 7 + ax * 0.5); if (Math.abs(across(c.x, c.z) - lane) < 1.5) lane = o.lanes[lane === o.lanes[0] ? 1 : 0]; }
      }
      const ahead = 14 + car.forward * 0.4;
      const tx = o.axis === 'x' ? car.x + o.dir[0] * ahead : lane, tz = o.axis === 'x' ? lane : car.z + o.dir[1] * ahead;
      stepSimpleCar(car, tx, tz, want, dt, world);
      spinWheels(car, dt);
      if (!passed && along < -6) { passed = true; if (o.onPass) o.onPass(car); }
      if (along < -150 || life > 40 || Math.hypot(t.x - car.x, t.z - car.z) > 260) { car.ai = null; vehicles.removeVehicle(car); }
    };
  }

  // ------------------------------------------------------------------ ram
  // straight at the player (nothing stops it). o: { speed, hitAt (meters), onHit() }
  function ram(v, o) {
    let hit = false;
    v.ai = (car, dt, world) => {
      if (hit) return;
      const t = target(), dx = t.x - car.x, dz = t.z - car.z, d = Math.hypot(dx, dz) || 1;
      car.heading = Math.atan2(dx, dz);
      car.forward = o.speed; car.vx = (dx / d) * o.speed; car.vz = (dz / d) * o.speed;
      car.x += car.vx * dt; car.z += car.vz * dt; car.y = world.ground(car.x, car.z);
      if (d < (o.hitAt || 4.6)) { hit = true; car.forward = 0; car.vx = car.vz = 0; if (o.onHit) o.onHit(car); }
    };
  }

  // the trail of the player's car (only kept while somebody follows it)
  let lastX = 0, lastZ = 0;
  function update() {
    if (!trailOn) return;
    const c = playerCar();
    if (!c) return;
    if (!trail.length || Math.hypot(c.x - lastX, c.z - lastZ) >= 2.5) {
      trail.push({ x: c.x, z: c.z }); lastX = c.x; lastZ = c.z;
      if (trail.length > 400) { trail.splice(0, 100); for (const v of vehicles.live) if (v.aiInfo && typeof v.aiInfo.k === 'number') v.aiInfo.k = Math.max(0, v.aiInfo.k - 100); }
    }
  }
  function reset() { trail.length = 0; trailOn = false; }

  return { path, shadow, pursue, overtake, ram, update, reset, stopCar: (v) => { v.ai = stop; v.aiInfo = null; }, playerCar, target, trail };
}
