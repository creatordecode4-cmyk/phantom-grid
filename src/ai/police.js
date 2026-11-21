// ---------------------------------------------------------------------------
// police.js - the wanted level and the police cars that chase the player.
//
//   * Doing bad things raises the "heat": ramming traffic or parked cars,
//     knocking people over, hitting a police car.
//   * Heat is shown as 0..5 stars. From 2 stars on, police cars come after
//     the player with flashing lights and a siren (1 car, 2 cars from 4 stars).
//   * Keeping out of trouble cools the heat down again, faster when no police
//     car is near.
//   * If a police car stands next to the stopped player for a few seconds:
//     BUSTED - the heat is gone and the police drive away.
//
// The chasers are real vehicles (see vehicle.js) with the simple computer
// driver from physics.js; they follow the roads with the GPS route finder.
// ---------------------------------------------------------------------------

import { stepSimpleCar } from '../vehicles/physics.js';
import { CAR_TYPES } from '../vehicles/carModels.js';

export function createPolice({ vehicles, gps, layout }) {
  const kinds = ['police_coupe', 'tech_patrol_car'].filter((k) => CAR_TYPES[k]);
  const fallback = kinds.length ? kinds : ['sedan'];   // without the model files: a plain dark sedan
  const B = layout.bounds;
  const chasers = [];
  const target = { x: 0, z: 0, speed: 0 };
  let heat = 0, bustT = 0, spawnT = 0, message = '', nextKind = 0;
  let scripted = null;     // story: { stars } = the story runs its own chase, this file only shows the stars

  // the computer driver of one police car (called 60 times a second by vehicle.js)
  function drive(v, dt, world) {
    const C = v.chase;
    const dist = Math.hypot(target.x - v.x, target.z - v.z);
    C.t -= dt;
    if (C.leaving) {
      // the chase is over: roll to a stop
      stepSimpleCar(v, v.x + Math.sin(v.heading) * 10, v.z + Math.cos(v.heading) * 10, 0, dt, world);
      return;
    }
    if (C.t <= 0) { C.t = 0.5; C.route = dist > 26 ? gps.route(v.x, v.z, target.x, target.z) : null; }
    // far away: follow the roads. close: drive straight at the player.
    const aim = C.route && C.route.length > 1 ? gps.pointAhead(C.route, 14) || target : target;
    const top = v.type.topSpeed / 3.6;
    const want = dist < 9 ? Math.min(target.speed, 4) : Math.min(top * 0.82, Math.max(12, target.speed + 9));
    const before = Math.hypot(v.x - C.lastX, v.z - C.lastZ);
    stepSimpleCar(v, aim.x, aim.z, want, dt, world);
    v.spin += (v.forward * dt) / v.info.wheelR;
    v.braking = v.forward > want + 1;
    // stuck against something: back up for a moment
    C.check -= dt;
    if (C.check <= 0) {
      C.check = 1.2;
      if (before < 0.6 && dist > 10) C.back = 0.9;
      C.lastX = v.x; C.lastZ = v.z;
    }
    if (C.back > 0) { C.back -= dt; v.forward = -4; }
  }

  function spawnChaser(px, pz) {
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 50;
      const s = gps.snap(px + Math.sin(a) * d, pz + Math.cos(a) * d);
      if (!s || Math.hypot(s.x - px, s.z - pz) < 70) continue;
      if (s.x < B.minX + 5 || s.x > B.maxX - 5 || s.z < B.minZ + 5 || s.z > B.maxZ - 5) continue;
      const kind = fallback[nextKind++ % fallback.length];
      const v = vehicles.spawn(kind, s.x, s.z, Math.atan2(px - s.x, pz - s.z), kinds.length ? [1, 1, 1] : [0.02, 0.02, 0.03], { npc: true, keep: true });
      if (!v) return;
      v.siren = true;
      v.chase = { t: 0, route: null, check: 1.2, lastX: s.x, lastZ: s.z, back: 0, leaving: false, gone: 0 };
      v.ai = drive;
      chasers.push(v);
      return;
    }
  }

  // who: { x, z, speed (m/s), inCar }.  knocked: people knocked over since the last call
  function update(dt, who, knocked) {
    if (scripted) { vehicles.events.length = 0; heat = 0; return scripted.stars; }
    // ---- what the player did ----
    for (const e of vehicles.events) {
      if (e.type === 'hitCar') heat += e.police ? 1.6 : 0.55 + Math.min(0.6, e.strength * 0.04);
      else if (e.type === 'hitParked') heat += e.police ? 1.6 : 0.3;
    }
    vehicles.events.length = 0;
    if (knocked) heat += knocked * 1.1;
    heat = Math.min(5, heat);
    const stars = Math.ceil(heat - 0.001);

    // ---- cooling down ----
    let near = 1e9;
    for (const v of chasers) if (!v.chase.leaving) near = Math.min(near, Math.hypot(v.x - who.x, v.z - who.z));
    heat = Math.max(0, heat - dt * (near > 120 ? 0.075 : near > 45 ? 0.04 : 0.012));

    // ---- chasers come and go ----
    target.x = who.x; target.z = who.z; target.speed = who.speed;
    const wantCars = stars >= 4 ? 2 : stars >= 2 ? 1 : 0;
    const activeCars = chasers.filter((v) => !v.chase.leaving).length;
    spawnT -= dt;
    if (activeCars < wantCars && spawnT <= 0) { spawnT = 5; spawnChaser(who.x, who.z); }
    // BUSTED: a police car next to the player, who has stopped
    if (near < 9 && who.speed < 1.5 && stars > 0) bustT += dt; else bustT = Math.max(0, bustT - dt * 2);
    if (bustT > 2.6) { bustT = 0; heat = 0; message = 'BUSTED - THE POLICE LET YOU GO WITH A WARNING'; }
    for (let i = chasers.length - 1; i >= 0; i--) {
      const v = chasers[i], C = v.chase;
      if (heat <= 0 && !C.leaving) { C.leaving = true; v.siren = false; }
      if (C.leaving) {
        C.gone += dt;
        // when nobody is near any more the car is taken away
        if (C.gone > 8 && Math.hypot(v.x - who.x, v.z - who.z) > 70 || C.gone > 40) {
          if (vehicles.active !== v) vehicles.removeVehicle(v);
          else { v.npc = false; v.ai = null; v.keep = false; }     // the player took it: it is theirs now
          chasers.splice(i, 1);
        }
      }
    }
    return stars;
  }

  return {
    update, chasers,
    get heat() { return heat; },
    set heat(h) { heat = Math.max(0, Math.min(5, h)); },
    get stars() { return Math.ceil(heat - 0.001); },
    get chased() { return scripted ? scripted.stars > 0 : chasers.some((v) => !v.chase.leaving); },
    // story: show this many stars and do nothing else (null = normal police again)
    setScripted(s) { scripted = s; if (s) { for (const v of chasers) { v.chase.leaving = true; v.siren = false; } heat = 0; } },
    // sirens that are on right now (the traffic pulls over for them)
    sirens(out) { out.length = 0; for (const v of vehicles.live) if (v.siren) out.push(v); return out; },
    takeMessage() { const m = message; message = ''; return m; },
  };
}
