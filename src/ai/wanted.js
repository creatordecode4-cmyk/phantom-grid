// ---------------------------------------------------------------------------
// wanted.js - the wanted level and the Meridian Guard (the police).
//
// STARS 0 to 5. In free roam they come from what the player does (ramming
// cars, knocking people over, hitting a Guard car). In the story they are set
// by the chapter: in Chapter 2 the whole city is looking for Nate.
//
// THE GUARD
//   cars    Meridian Guard cars (police_coupe, tech_patrol_car) chase along
//           the roads and ram at 3 stars and more. At most 4 at a time.
//   drones  surveillance drones fly over the streets with a searchlight and
//           see everything under the open sky. At most 2 at a time.
//   roadblocks  from 4 stars: two cars across the road at a crossing (or at
//           the foot of the Ironhill ramp) in front of the player.
//   gates   scanner gates over the main roads read plates and faces.
//   No gore and no guns: only chases, ramming, roadblocks and arrests.
//
// SEEN OR NOT
//   Every car looks forward in a cone (shown on the minimap), drones look
//   down. Buildings block the view. While somebody sees the player: CHASE.
//   When nobody has seen the player for a few seconds: SEARCH - the Guard
//   drives to the place where the player was seen last and looks around
//   there (a growing circle on the minimap).
//
// HIDING: parked in an alley or a garage (or in a van with a new color and a
// new plate) and not seen: after 20 seconds one star is gone, then the next.
// Inside a house (src/interiors) nobody can see the player at all, and the
// stars go down the same way (who.inside).  The Guard cannot arrest the
// player through a closed door either.
// COVER (a button, when parked at the right spot) also hides the car from the
// drones. Driving dangerously or passing a scanner gate shows a disguised van.
//
// BUSTED: a Guard car stops next to the stopped player for a few seconds. The
// story then sends the player back to the last checkpoint with a small fine.
//
// ON THE WATER (Chapter 3, The Sunk): where the player is in the canals the
// Guard comes in BOATS (at most 3) that follow the canal map, and drones (at
// most 2). A loud boat motor is HEARD; the QUIET motor is not. The story can
// put SENTRIES up: drones that fly a fixed path and look forward in a cone
// (shown on the minimap). With "stealth" on, a cone that touches the player
// fills a meter first - only when it is full has the Guard spotted him.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { stepSimpleCar, stepBoat } from '../vehicles/physics.js';
import { CAR_TYPES } from '../vehicles/carModels.js';

const HIDE_SECONDS = 20;              // hidden this long = one star less
const CARS = [0, 1, 2, 3, 4, 4];      // Guard cars at each star level (somebody the whole city is looking for)
const DRONES = [0, 0, 1, 1, 2, 2];    // drones at each star level
const CARS_FREE = [0, 0, 1, 2, 3, 4]; // free roam (a stranger who bumped a car): one star sends nobody yet
const DRONES_FREE = [0, 0, 0, 1, 1, 2];
const BOATS = [0, 1, 2, 2, 3, 3];     // Guard boats at each star level (on the canals of The Sunk)
const HEAR = 24;                      // meters: how far a loud boat motor is heard
export const FINE = 250;              // credits the Guard takes when it catches the player
const LOST_AFTER = 2.6;               // seconds without being seen before the Guard starts to search
const DRONE_ALT = 24;                 // how high the drones fly (meters)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function createWanted({ scene, vehicles, gps, layout, city, props, sound }) {
  const kinds = ['police_coupe', 'tech_patrol_car'].filter((k) => CAR_TYPES[k]);
  const fallback = kinds.length ? kinds : ['sedan'];   // without the model files: a plain dark sedan
  const B = layout.bounds, H = layout.highway;
  const SK = city.sunk || null;      // The Sunk (Chapter 3): canals, the canal map, decks

  // ------------------------------------------------------------------ state
  let level = 0;                      // 0..5 (stars = level rounded up)
  let scripted = null;                // Chapter 1: { stars } - the story drives its own chase, this file only shows the stars
  let mode = 'idle';                  // idle | patrol | chase | search
  let known = false;                  // the player's face and plate are known (story: wanted for murder)
  let disguised = false, blown = false;   // a van with a new color and plate / ... that was recognized anyway
  let covered = false, coverAvailable = false;
  let seen = false, lostT = 0, searchT = 0, hiddenT = 0, hidden = false, bustT = 0, gateCool = 0, spawnT = 0, droneSpawnT = 0, sightT = 0, time = 0;
  let message = '', onBusted = null, onGate = null, light = 0, droneNear = 0, gateHit = null, nightNow = 0;
  let graceT = 0;                       // just after an arrest: bumps with the leaving Guard cars do not count
  let heard = false, sightClose = 0, sightHeard = false;
  const lastKnown = { x: 0, z: 0 };
  let searchR = 20, searchBase = 22;            // the radius of the searched area (it grows while they search)
  const caps = { cars: 4, drones: 2, boats: 3 };
  let water = false;                  // the player is in The Sunk: the Guard comes by boat
  let stealth = false, suspicion = 0, spotted = false, hearOn = true;
  const sentries = [];                // drones on a fixed path that look forward (the story puts them up)
  let gatesOn = true, roadblocksOn = true, patrol = null, startStars = 2, freeRoam = true, ram = true, areaT = 0;
  const units = [];                   // the Guard cars: { v, mode, goal, wait, route, t, check, lastX, lastZ, back, sees }
  const drones = [];                  // { o, x, y, z, vx, vz, goal, sees, heading, leaving }
  const target = { x: 0, z: 0, speed: 0, vx: 0, vz: 0, inCar: false };
  let nextKind = 0;

  // ------------------------------------------------------------------ places
  // alleys and garages: where a parked car can hide. roof: drones cannot see in.
  const spots = layout.alleyRects.map((a) => ({ minX: a.minX - 0.5, maxX: a.maxX + 0.5, minZ: a.minZ - 0.5, maxZ: a.maxZ + 0.5, roof: false, kind: 'alley' }));
  // a garage or a covered car park: { minX, maxX, minZ, maxZ } (drones cannot see in)
  function addSpot(r) { spots.push({ roof: true, kind: 'garage', ...r }); }
  function spotAt(x, z) { for (const s of spots) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) return s; return null; }

  // ------------------------------------------------------------------ seeing
  // Is the line from a (height ah) to b (height bh) free of buildings?
  function clearLine(ax, az, ah, bx, bz, bh) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 2.5));
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, h = ah + (bh - ah) * t;
      for (const b of city.colliders.near(x, z).boxes) if (b.h > h && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return false;
    }
    return true;
  }
  // how far a Guard car looks (meters) in its current mode; night and rain make it shorter
  const viewRange = (u) => (u.mode === 'chase' ? 62 : u.mode === 'search' ? 46 : 34) * look;
  let look = 1;
  const FOV = 62 * Math.PI / 180;     // half of the cone
  function carSees(u, px, pz, ph) {
    const v = u.v, dx = px - v.x, dz = pz - v.z, d = Math.hypot(dx, dz);
    if (d > viewRange(u)) return false;
    if (d > 11 && Math.abs(angleDiff(v.heading, Math.atan2(dx, dz))) > FOV) return false;
    return clearLine(v.x, v.z, 1.3, px, pz, ph);
  }
  function droneSees(dr, px, pz, ph, roofed) {
    if (roofed) return false;
    const d = Math.hypot(px - dr.x, pz - dr.z);
    if (d > (mode === 'chase' ? 34 : 27) * look) return false;
    return clearLine(dr.x, dr.z, dr.y, px, pz, ph);
  }

  // how high the roof is at x, z (0 on a street)
  function roofAt(x, z) {
    let h = 0;
    for (const b of city.colliders.near(x, z).boxes) if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && b.h > h) h = b.h;
    return h;
  }

  // ------------------------------------------------------------------ the scanner gates
  // From the layout data (layout.raw.scanGates): { road: 'ns' | 'ew' | 'neon', c (the street), at (where along it) }
  const gates = [];
  const roadHalf = (g) => (g.road === 'neon' ? layout.neon.width / 2 : layout.street.width / 2);
  for (const g of layout.raw.scanGates || []) {
    const x = g.road === 'ns' ? g.c : g.at, z = g.road === 'ns' ? g.at : g.road === 'neon' ? layout.neon.centerZ : g.c;
    gates.push({ x, z, axis: g.road === 'ns' ? 'z' : 'x', half: roadHalf(g) + 0.6, alarm: 0, inside: false });
  }
  // the links of the GPS road net that have a gate on them: while the player is wanted, the GPS line goes around them
  let avoiding = false;
  function avoidGates(on) {
    if (on === avoiding || !gps.setAvoid) return;
    avoiding = on;
    gps.setAvoid(on ? gates.map((g) => ({ x: g.x, z: g.z })) : []);
  }
  // ---- gate meshes (3 draw calls for all gates): the posts, the beams, the scanner lights under the beams ----
  let gatePosts = null, gateBeams = null, gateLights = null;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
  if (gates.length) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.65 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const postGeo = new THREE.BoxGeometry(0.42, 5.9, 0.42); postGeo.translate(0, 2.95, 0);
    // (beam and light strip are 1 m long: each gate stretches them over its road)
    const beamGeo = new THREE.BoxGeometry(1, 0.62, 0.5); beamGeo.translate(0, 5.6, 0);
    const lightGeo = new THREE.BoxGeometry(1, 0.07, 0.36); lightGeo.translate(0, 5.26, 0);
    gatePosts = new THREE.InstancedMesh(postGeo, frameMat, gates.length * 2);
    gateBeams = new THREE.InstancedMesh(beamGeo, frameMat, gates.length);
    gateLights = new THREE.InstancedMesh(lightGeo, lightMat, gates.length);
    gates.forEach((g, i) => {
      const y = city.groundHeight(g.x, g.z), w = g.half * 2 + 0.6;
      // (a gate over a north-south road: its beam runs east-west, along x)
      _q.setFromAxisAngle(UP, g.axis === 'z' ? 0 : Math.PI / 2);
      _m.compose(_p.set(g.x, y, g.z), _q, _s.set(w, 1, 1));
      gateBeams.setMatrixAt(i, _m); gateLights.setMatrixAt(i, _m);
      gateLights.setColorAt(i, _c.setRGB(0.2, 1.4, 0.7));
      for (const side of [-1, 1]) {
        const ox = g.axis === 'z' ? side * (w / 2) : 0, oz = g.axis === 'z' ? 0 : side * (w / 2);
        _m.compose(_p.set(g.x + ox, y, g.z + oz), _q, _s.set(1, 1, 1));
        gatePosts.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), _m);
      }
      // the posts stand on the sidewalk: cars bump into them
      if (city.colliders.addCircle) for (const side of [-1, 1]) city.colliders.addCircle({ x: g.x + (g.axis === 'z' ? side * (w / 2) : 0), z: g.z + (g.axis === 'z' ? 0 : side * (w / 2)), r: 0.3 });
    });
    gatePosts.castShadow = gateBeams.castShadow = true;
    scene.add(gatePosts, gateBeams, gateLights);
  }
  // the player drives under a gate: is a wanted person (or a face) in the car?
  function checkGates(dt, px, pz, inCar) {
    gateCool -= dt;
    let changed = false;
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i];
      const along = g.axis === 'z' ? pz - g.z : px - g.x, across = g.axis === 'z' ? px - g.x : pz - g.z;
      const inside = Math.abs(along) < 1.6 && Math.abs(across) < g.half;
      if (inside && !g.inside && inCar && gateCool <= 0) {
        gateCool = 3;
        const wantedHere = known || level > 0;
        if (wantedHere && gatesOn) {
          g.alarm = 6; changed = true;
          if (disguised) blown = true;            // the camera reads the face behind the glass
          seenBy('gate', px, pz);
          if (level < startStars) level = startStars;
          message = 'SCANNER GATE: YOUR PLATE WAS READ';
          if (sound && sound.scanAlarm) sound.scanAlarm();
          gateHit = i;
          if (onGate) onGate(i);
        } else if (sound && sound.scanBeep) sound.scanBeep();
      }
      g.inside = inside;
      if (g.alarm > 0) { g.alarm -= dt; if (g.alarm <= 0) changed = true; }
    }
    if (gateLights && (changed || gates.some((g) => g.alarm > 0))) {
      gates.forEach((g, i) => gateLights.setColorAt(i, g.alarm > 0 ? (Math.floor(time * 6) % 2 ? _c.setRGB(2.2, 0.15, 0.1) : _c.setRGB(0.6, 0.05, 0.03)) : _c.setRGB(0.2, 1.4, 0.7)));
      gateLights.instanceColor.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ the Guard cars
  function spawnCar(near, minD = 95, maxD = 150) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const s = gps.snap(near.x + Math.sin(a) * d, near.z + Math.cos(a) * d);
      if (!s || Math.hypot(s.x - target.x, s.z - target.z) < 70) continue;
      if (s.x < B.minX + 6 || s.x > B.maxX - 6 || s.z < B.minZ + 6 || s.z > B.maxZ - 6) continue;
      const kind = fallback[nextKind++ % fallback.length];
      // (computer drivers never load the detailed model: a Guard car costs only a few draw calls)
      const v = vehicles.spawn(kind, s.x, s.z, Math.atan2(target.x - s.x, target.z - s.z), kinds.length ? [1, 1, 1] : [0.02, 0.02, 0.03], { npc: true, keep: true, noDetail: true });
      if (!v) return null;
      const u = { v, mode: 'search', goal: { x: near.x, z: near.z }, wait: 0, route: null, t: 0, check: 1.2, lastX: s.x, lastZ: s.z, back: 0, sees: false, gone: 0 };
      v.guard = u;
      v.ai = (car, dt, world) => driveUnit(u, car, dt, world);
      units.push(u);
      return u;
    }
    return null;
  }
  // a new place to look at: a point on a road, not too far from where the player was last seen
  function searchPoint(cx, cz, r) {
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      const s = gps.snap(cx + Math.sin(a) * d, cz + Math.cos(a) * d);
      if (s) return { x: s.x, z: s.z };
    }
    return { x: cx, z: cz };
  }
  function driveUnit(u, car, dt, world) {
    const chase = u.mode === 'chase';
    const goal = chase ? target : u.goal;
    const dist = Math.hypot(goal.x - car.x, goal.z - car.z);
    u.t -= dt;
    if (u.t <= 0) { u.t = 0.6; u.route = dist > 28 ? gps.route(car.x, car.z, goal.x, goal.z, { ignoreAvoid: true }) : null; }
    let aim = u.route && u.route.length > 1 ? gps.pointAhead(u.route, 14) || goal : goal;
    const top = car.type.topSpeed / 3.6;
    let want;
    if (chase) {
      const stars = Math.ceil(level - 0.001);
      // close behind: ram from 3 stars on (aim a little ahead of the player), else keep close and box in
      if (dist < 16 && stars >= 3 && ram) { aim = { x: target.x + target.vx * 0.5, z: target.z + target.vz * 0.5 }; want = Math.min(top, target.speed + 4); }
      else want = dist < 9 ? Math.min(target.speed, 4) : Math.min(top * (stars >= 5 ? 0.92 : 0.82), Math.max(12, target.speed + 9));
    } else if (u.mode === 'leave') want = 12;
    else {
      want = u.mode === 'patrol' ? 9.5 : 13;
      if (dist < 7) { want = 0; u.wait -= dt; if (u.wait <= 0) { u.wait = 1 + Math.random() * 2.5; u.goal = u.mode === 'patrol' && patrol ? searchPoint(patrol.x, patrol.z, patrol.r) : searchPoint(lastKnown.x, lastKnown.z, searchR); } }
    }
    const before = Math.hypot(car.x - u.lastX, car.z - u.lastZ);
    stepSimpleCar(car, aim.x, aim.z, want, dt, world);
    if (car.spin !== undefined && car.info) car.spin += (car.forward * dt) / car.info.wheelR;
    car.braking = car.forward > want + 1;
    // stuck against something: back up for a moment
    u.check -= dt;
    if (u.check <= 0) { u.check = 1.2; if (before < 0.6 && dist > 10 && want > 2) u.back = 0.9; u.lastX = car.x; u.lastZ = car.z; }
    if (u.back > 0) { u.back -= dt; car.forward = -4; }
  }
  function removeUnit(i) {
    const u = units[i], v = u.v;
    if (vehicles.active !== v) vehicles.removeVehicle(v);
    else { v.npc = false; v.ai = null; v.keep = false; v.guard = null; }     // the player took it: it is theirs now
    units.splice(i, 1);
  }

  // ------------------------------------------------------------------ Guard boats (The Sunk)
  // a place on the canals near (x, z), r meters around
  const waterPoint = (x, z, r) => (SK ? SK.waterPoint(x, z, r) : { x, z });
  function spawnBoat(near, minD = 70, maxD = 150) {
    if (!SK) return null;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const p = waterPoint(near.x + Math.sin(a) * d, near.z + Math.cos(a) * d, 10);
      if (Math.hypot(p.x - target.x, p.z - target.z) < 45 || !SK.inZone(p.x, p.z, 30)) continue;
      const v = vehicles.spawn('patrol_boat', p.x, p.z, Math.atan2(target.x - p.x, target.z - p.z), null, { npc: true, keep: true, noDetail: true, tint: [0.42, 0.46, 0.55] });
      if (!v) return null;
      const u = { v, kind: 'boat', mode: 'search', goal: { x: near.x, z: near.z }, wait: 0, route: null, t: 0, check: 1.5, lastX: p.x, lastZ: p.z, back: 0, sees: false, gone: 0 };
      v.guard = u;
      v.ai = (boat, dt) => driveBoat(u, boat, dt);
      units.push(u);
      return u;
    }
    return null;
  }
  const _in = { steer: 0, gas: 0, brake: 0, handbrake: false };
  function driveBoat(u, v, dt) {
    const chase = u.mode === 'chase';
    const goal = chase ? target : u.goal;
    const dist = Math.hypot(goal.x - v.x, goal.z - v.z);
    u.t -= dt;
    if (u.t <= 0) { u.t = 0.7; u.route = dist > 14 && SK ? SK.route(v.x, v.z, goal.x, goal.z) : null; }
    const aim = u.route && u.route.length > 1 ? gps.pointAhead(u.route, 13) || goal : goal;
    const top = v.type.topSpeed / 3.6;
    let want;
    if (chase) {
      const st = Math.ceil(level - 0.001);
      want = dist < 9 ? Math.min(target.speed + (st >= 3 && ram ? 3 : 0), 6) : Math.min(top * (st >= 5 ? 0.88 : 0.78), Math.max(9, target.speed + 6));
    } else if (u.mode === 'leave') want = 10;
    else {
      want = u.mode === 'patrol' ? 5.5 : 9;
      if (dist < 8) { want = 0; u.wait -= dt; if (u.wait <= 0) { u.wait = 1.5 + Math.random() * 3; u.goal = u.mode === 'patrol' && patrol ? waterPoint(patrol.x, patrol.z, patrol.r) : waterPoint(lastKnown.x, lastKnown.z, searchR); } }
    }
    // steer toward the point ahead on the canal line; slow down for a sharp turn
    const d = angleDiff(v.heading, Math.atan2(aim.x - v.x, aim.z - v.z));
    if (Math.abs(d) > 0.7) want = Math.min(want, 5);
    const fwd = v.forward || 0;
    _in.steer = clamp(-d * 2.4, -1, 1);
    _in.gas = fwd < want ? clamp((want - fwd) / 3, 0.15, 1) : 0;
    _in.brake = fwd > want + 1.2 ? clamp((fwd - want) / 4, 0, 1) : 0;
    if (u.back > 0) { u.back -= dt; _in.gas = 0; _in.brake = 1; _in.steer = -_in.steer; }
    stepBoat(v, _in, dt, vehicles.seaWorld);
    v.braking = _in.brake > 0;
    // stuck at a wall: back off for a moment
    u.check -= dt;
    if (u.check <= 0) { u.check = 1.5; if (Math.hypot(v.x - u.lastX, v.z - u.lastZ) < 0.8 && dist > 10 && want > 2) u.back = 1.1; u.lastX = v.x; u.lastZ = v.z; }
  }

  // ------------------------------------------------------------------ sentries (fixed paths, a cone of sight)
  // spec: { path: [[x, z], ...] (a loop), y: height, speed (m/s), range (m), fov (half the cone, radians), sweep (radians), stop: seconds at each point }
  function addSentry(spec) {
    const o = props ? props.make('policeDrone') : new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    const U = o.userData;
    if (U.beam) U.beam.visible = false;
    if (U.spot) U.spot.visible = false;
    const range = spec.range || 22, fov = spec.fov || 0.55;
    // its searchlight looks forward and down: a soft cone and a pool of light where it meets the ground
    const coneGeo = new THREE.ConeGeometry(Math.tan(fov) * range * 0.9, range, 20, 1, true);
    coneGeo.translate(0, -range / 2, 0);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    cone.rotation.x = -Math.PI / 2 - 0.5;      // tip at the drone, opening forward and a little down
    cone.renderOrder = 18;
    o.add(cone);
    const spotMesh = U.spot ? U.spot.clone() : null;
    if (spotMesh) { spotMesh.visible = true; spotMesh.material = U.spot.material.clone(); scene.add(spotMesh); }
    const p0 = spec.path[0];
    const sn = { o, cone, spot: spotMesh, path: spec.path, i: 0, x: p0[0], z: p0[1], y: spec.y, speed: spec.speed || 3, range, fov, sweep: spec.sweep ?? 0.45, stop: spec.stop || 0, wait: 0, heading: 0, look: 0, sees: false, ph: Math.random() * 6 };
    if (spec.path.length > 1) sn.heading = Math.atan2(spec.path[1][0] - p0[0], spec.path[1][1] - p0[1]);
    else sn.heading = spec.face || 0;
    o.position.set(sn.x, sn.y, sn.z);
    scene.add(o);
    sentries.push(sn);
    return sn;
  }
  function clearSentries() {
    for (const sn of sentries) {
      scene.remove(sn.o); if (sn.spot) scene.remove(sn.spot);
      sn.o.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material.dispose) m.material.dispose(); } });
    }
    sentries.length = 0;
  }
  function flySentry(sn, dt) {
    if (sn.path.length > 1) {
      const next = sn.path[(sn.i + 1) % sn.path.length];
      const dx = next[0] - sn.x, dz = next[1] - sn.z, d = Math.hypot(dx, dz);
      if (sn.wait > 0) sn.wait -= dt;
      else if (d < 0.3) { sn.i = (sn.i + 1) % sn.path.length; sn.wait = sn.stop; }
      else {
        const step = Math.min(d, sn.speed * dt);
        sn.x += (dx / d) * step; sn.z += (dz / d) * step;
        sn.heading += angleDiff(sn.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 2.5);
      }
    }
    // it looks around a little while it flies
    sn.look = sn.heading + Math.sin(time * 0.7 + sn.ph) * sn.sweep;
    sn.o.position.set(sn.x, sn.y + Math.sin(time * 1.7 + sn.ph) * 0.2, sn.z);
    sn.o.rotation.set(0, sn.look, 0);
    sn.cone.material.opacity = (sn.sees ? 0.1 : 0.035) + 0.04 * nightNow;
    sn.cone.material.color.setHex(sn.sees ? 0xffb080 : 0xcfe2ff);
    if (sn.spot) {
      const gx = sn.x + Math.sin(sn.look) * sn.range * 0.55, gz = sn.z + Math.cos(sn.look) * sn.range * 0.55;
      sn.spot.position.set(gx, city.groundHeight(gx, gz) + 0.06, gz);
      sn.spot.material.opacity = 0.06 + 0.3 * nightNow;
    }
    if (sn.o.userData.anim) sn.o.userData.anim(time);
  }
  function sentrySees(sn, px, pz, ph, roofed) {
    if (roofed) return false;
    const dx = px - sn.x, dz = pz - sn.z, d = Math.hypot(dx, dz);
    if (d > sn.range * look || (d > 3 && Math.abs(angleDiff(sn.look, Math.atan2(dx, dz))) > sn.fov)) return false;
    return clearLine(sn.x, sn.z, sn.y, px, pz, ph);
  }

  // ------------------------------------------------------------------ drones
  function spawnDrone() {
    const a = Math.random() * Math.PI * 2, d = 130;
    const o = props ? props.make('policeDrone') : new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    const dr = { o, x: target.x + Math.sin(a) * d, y: DRONE_ALT + 6, z: target.z + Math.cos(a) * d, vx: 0, vz: 0, goal: { x: lastKnown.x, z: lastKnown.z }, sees: false, heading: 0, leaving: false, wait: 0 };
    o.position.set(dr.x, dr.y, dr.z);
    scene.add(o);
    drones.push(dr);
  }
  function flyDrone(dr, dt) {
    const goal = dr.leaving ? { x: dr.x + Math.sin(dr.heading) * 50, z: dr.z + Math.cos(dr.heading) * 50 } : mode === 'chase' ? target : dr.goal;
    const dx = goal.x - dr.x, dz = goal.z - dr.z, d = Math.hypot(dx, dz);
    const top = mode === 'chase' ? 19 : 12, want = d > 3 ? Math.min(top, d * 0.8) : 0;
    const tvx = d > 0.01 ? (dx / d) * want : 0, tvz = d > 0.01 ? (dz / d) * want : 0;
    const k = Math.min(1, dt * 1.6);
    dr.vx += (tvx - dr.vx) * k; dr.vz += (tvz - dr.vz) * k;
    dr.x += dr.vx * dt; dr.z += dr.vz * dt;
    // (it flies over the roofs: higher where the buildings are tall, and it climbs before it gets there)
    const over = Math.max(roofAt(dr.x, dr.z), roofAt(dr.x + dr.vx * 2.5, dr.z + dr.vz * 2.5)) + 9;
    dr.y += ((dr.leaving ? Math.max(40, over) : Math.min(75, Math.max(DRONE_ALT, over))) - dr.y) * Math.min(1, dt * 1.2);
    if (Math.hypot(dr.vx, dr.vz) > 0.5) dr.heading = Math.atan2(dr.vx, dr.vz);
    if (!dr.leaving && mode !== 'chase' && d < 4) {
      dr.wait -= dt;
      if (dr.wait <= 0) {
        dr.wait = 2 + Math.random() * 3;
        const c = mode === 'patrol' && patrol ? patrol : { x: lastKnown.x, z: lastKnown.z, r: searchR * 0.8 };
        // (over The Sunk there are no roads to look along: any point in the area)
        dr.goal = water ? { x: c.x + (Math.random() - 0.5) * c.r * 1.6, z: c.z + (Math.random() - 0.5) * c.r * 1.6 } : searchPoint(c.x, c.z, c.r);
      }
    }
    dr.o.position.set(dr.x, dr.y + Math.sin(time * 1.7 + dr.x) * 0.25, dr.z);
    dr.o.rotation.set(0, dr.heading, 0);
    // the searchlight: easy to see at night, faint by day; its pool of light lies on the street below
    const U = dr.o.userData;
    if (U.beam) { U.beam.visible = !dr.leaving; U.beam.material.opacity = 0.03 + 0.045 * nightNow; }
    if (U.spot) { U.spot.visible = !dr.leaving; U.spot.position.y = city.groundHeight(dr.x, dr.z) + 0.06 - dr.o.position.y; U.spot.material.opacity = 0.08 + 0.32 * nightNow; }
    if (U.anim) U.anim(time);
  }
  function removeDrone(i) {
    const dr = drones[i];
    scene.remove(dr.o);
    dr.o.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material.dispose) m.material.dispose(); } });
    drones.splice(i, 1);
  }

  // ------------------------------------------------------------------ roadblocks
  let block = null;                  // { cars: [v], x, z, t, barrier }
  let blockT = 8;
  const barrierGeo = new THREE.BoxGeometry(2.4, 1.05, 0.4); barrierGeo.translate(0, 0.52, 0);
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
  const barrierStripe = new THREE.MeshBasicMaterial({ color: 0xd8301c });
  const stripeGeo = new THREE.BoxGeometry(2.42, 0.18, 0.42); stripeGeo.translate(0, 0.78, 0);
  // a crossing in front of the player (on the road it drives on), or the foot of the Ironhill ramp
  function roadblockSite() {
    const hx = Math.sin(target.heading || 0), hz = Math.cos(target.heading || 0);
    const sp = target.speed;
    if (sp < 4) return null;
    // the ramp of the Ironhill Highway (the only "bridge" of the city)
    const ramp = { x: H.centerX, z: H.rampBottomZ + 6 };
    const dR = Math.hypot(ramp.x - target.x, ramp.z - target.z);
    if (dR > 60 && dR < 170 && ((ramp.x - target.x) * hx + (ramp.z - target.z) * hz) / dR > 0.75) return { x: ramp.x, z: ramp.z, axis: 'z', half: H.width / 2 - 1.5 };
    // a crossing straight ahead on the same street
    const alongNS = Math.abs(hz) > Math.abs(hx);
    const streets = alongNS ? layout.traffic.ns : layout.traffic.ew;
    let road = null, best = 9;
    for (const s of streets) { const d = Math.abs((alongNS ? target.x : target.z) - s.center); if (d < best) { best = d; road = s; } }
    if (!road) return null;
    const cross = (alongNS ? layout.traffic.ew : layout.traffic.ns).map((s) => s.center);
    const pos = alongNS ? target.z : target.x, dir = alongNS ? Math.sign(hz) : Math.sign(hx);
    let pick = null;
    for (const c of cross) { const ahead = (c - pos) * dir; if (ahead > 70 && ahead < 160 && (!pick || ahead < (pick - pos) * dir)) pick = c; }
    if (pick === null) return null;
    const before = pick - dir * 11;                      // just before the crossing
    return alongNS ? { x: road.center, z: before, axis: 'z', half: layout.street.width / 2 } : { x: before, z: road.center, axis: 'x', half: layout.street.width / 2 };
  }
  function placeRoadblock(site) {
    const across = site.axis === 'z' ? 0 : 1;          // the road runs along z: the cars stand across it (along x)
    const rot = site.axis === 'z' ? Math.PI / 2 : 0;
    const cars = [];
    for (const off of [-site.half * 0.42, site.half * 0.42]) {
      const x = site.x + (across ? 0 : off), z = site.z + (across ? off : 0);
      const v = vehicles.spawn(fallback[nextKind++ % fallback.length], x, z, rot + (off > 0 ? Math.PI : 0), kinds.length ? [1, 1, 1] : [0.02, 0.02, 0.03], { npc: true, keep: true, simple: true, noDetail: true });
      if (v) { v.siren = true; v.ai = null; cars.push(v); }
    }
    const g = new THREE.Group();
    for (const off of [-site.half + 0.9, site.half - 0.9]) {
      const b = new THREE.Mesh(barrierGeo, barrierMat), s = new THREE.Mesh(stripeGeo, barrierStripe);
      b.add(s);
      b.position.set(site.x + (across ? 0 : off), city.groundHeight(site.x, site.z), site.z + (across ? off : 0));
      b.rotation.y = rot;
      b.castShadow = true;
      g.add(b);
    }
    scene.add(g);
    block = { cars, x: site.x, z: site.z, t: 0, barrier: g };
  }
  function removeRoadblock() {
    if (!block) return;
    for (const v of block.cars) if (vehicles.live.includes(v) && vehicles.active !== v) vehicles.removeVehicle(v);
    scene.remove(block.barrier);
    block = null;
  }

  // ------------------------------------------------------------------ helpers
  const stars = () => Math.ceil(level - 0.001);
  function seenBy(who, px, pz) { seen = true; lastKnown.x = px; lastKnown.z = pz; lostT = 0; hiddenT = 0; }
  function clearAll() {
    level = 0; mode = known && patrol ? 'patrol' : 'idle'; hiddenT = 0; bustT = 0; covered = false; searchR = 20;
    for (const u of units) { u.mode = 'leave'; u.gone = 0; u.v.siren = false; }
    for (const dr of drones) dr.leaving = true;
    removeRoadblock();
  }

  // ==================================================================== every frame
  // who: { x, z, speed (m/s), inCar, heading, vx, vz }. knocked: people knocked over since the last call.
  // night: 0..1 (it is harder to see at night), rain: 0..1
  function update(dt, who, knocked, night = 0, rain = 0) {
    time += dt; nightNow = night;
    if (scripted) { vehicles.events.length = 0; level = 0; return scripted.stars; }
    target.x = who.x; target.z = who.z; target.speed = who.speed; target.vx = who.vx || 0; target.vz = who.vz || 0; target.heading = who.heading || 0; target.inCar = !!who.inCar;
    look = 1 - 0.18 * night - 0.12 * rain;

    // ---- what the player did ----
    let crime = 0;
    for (const e of vehicles.events) {
      if (e.type === 'hitCar') crime += e.police ? 1.6 : 0.55 + Math.min(0.6, e.strength * 0.04);
      else if (e.type === 'hitParked') crime += e.police ? 1.6 : 0.3;
    }
    vehicles.events.length = 0;
    if (knocked) crime += knocked * 1.1;
    if (graceT > 0) { graceT -= dt; crime = 0; }
    if (crime > 0) {
      if (disguised) blown = true;                        // nobody drives like that in a van that wants to stay unseen
      if (freeRoam || level > 0 || known) level = Math.min(5, level + crime);
      if (stars() > 0) { lastKnown.x = who.x; lastKnown.z = who.z; lostT = 0; hiddenT = 0; }
    }

    // ---- hiding places ----
    const parked = who.speed < 1.0;
    const spot = spotAt(who.x, who.z);
    if (covered && (!spot || who.speed > 1.5)) covered = false;
    const roofed = covered || (spot && spot.roof);
    // COVER: in an alley (a garage already has a roof), parked, in the car, and somebody is looking for the player
    coverAvailable = !covered && !!spot && !spot.roof && parked && who.inCar && (stars() > 0 || (known && !(disguised && !blown)));

    // ---- who sees the player (every 0.15 s; the line through the buildings costs a little) ----
    sightT -= dt;
    if (sightT <= 0) {
      sightT = 0.15;
      seen = false;
      const ph = (who.y || 0) + (who.inCar ? 1.25 : 1.55);
      const ignore = disguised && !blown && who.inCar && stars() === 0;   // a van with a new color and plate: nobody looks twice
      const sneaking = stealth && stars() === 0;                           // (stealth: what they see fills the meter first)
      for (const u of units) {
        if (u.mode === 'leave') { u.sees = false; continue; }
        const close = Math.hypot(u.v.x - who.x, u.v.z - who.z) < 9;
        // (inside a house nobody on the street can see the player)
        u.sees = !who.inside && carSees(u, who.x, who.z, ph) && !(covered && !close);
        if (u.sees && !ignore && !sneaking) seenBy('car', who.x, who.z);
      }
      for (const dr of drones) {
        dr.sees = !dr.leaving && !who.inside && droneSees(dr, who.x, who.z, ph, roofed);
        if (dr.sees && !ignore && !sneaking) seenBy('drone', who.x, who.z);
      }
      // the sentries of the story, and what the Guard hears: a loud boat motor close by
      let close = 0;
      for (const sn of sentries) {
        sn.sees = !who.inside && sentrySees(sn, who.x, who.z, ph, roofed);
        if (sn.sees) { close = Math.max(close, 1 - Math.hypot(sn.x - who.x, sn.z - who.z) / sn.range); if (!stealth || stars() > 0) seenBy('sentry', who.x, who.z); }
      }
      heard = false;
      if (hearOn && who.loud && !who.inside) {
        for (const u of units) if (u.mode !== 'leave' && Math.hypot(u.v.x - who.x, u.v.z - who.z) < HEAR) heard = true;
        for (const sn of sentries) if (Math.hypot(sn.x - who.x, sn.z - who.z) < HEAR) heard = true;
        if (heard && (!stealth || stars() > 0)) seenBy('ear', who.x, who.z);
      }
      // STEALTH (before anybody knows he is there): being in a cone, or heard, fills the meter; when it is full he is spotted
      if (stealth && stars() === 0) {
        const unitSees = units.some((u) => u.sees) || drones.some((dr) => dr.sees);
        const anySees = close > 0 || unitSees;
        sightClose = anySees ? Math.max(close, unitSees ? 0.5 : 0) : 0;
        sightHeard = heard;
      } else { sightClose = 0; sightHeard = false; }
      // a disguised van that races past a Guard car is noticed
      if (ignore && who.speed > 26 && units.some((u) => u.sees)) { blown = true; }
      // stars 0, but the face is known: a patrol that sees the player calls it in
      if (seen && stars() === 0 && known) { level = startStars; message = 'THE GUARD HAS SEEN YOU'; }
    }
    if (gates.length) checkGates(dt, who.x, who.z, who.inCar);
    if (stealth && stars() === 0) {
      if (sightClose > 0 || sightHeard) suspicion = Math.min(1, suspicion + dt * (sightClose > 0 ? 0.55 + 1.6 * sightClose : 0.45));
      else suspicion = Math.max(0, suspicion - dt * 0.3);
      if (suspicion >= 1) { suspicion = 0; spotted = true; level = Math.max(1, startStars); lastKnown.x = who.x; lastKnown.z = who.z; lostT = 0; mode = 'chase'; seen = true; message = 'SPOTTED'; }
    } else if (stars() > 0) suspicion = 0;

    // ---- chase, search, hidden ----
    const s0 = stars();
    if (s0 > 0) {
      if (seen) { mode = 'chase'; searchT = 0; searchR = 18; searchBase = 22; }
      else {
        lostT += dt;
        if (mode !== 'search' && lostT > LOST_AFTER) { mode = 'search'; searchT = 0; for (const u of units) if (u.mode !== 'leave') u.goal = u.kind === 'boat' ? waterPoint(lastKnown.x, lastKnown.z, 25) : searchPoint(lastKnown.x, lastKnown.z, 25); }
        if (mode === 'search') { searchT += dt; searchR = Math.min(150, searchBase + searchT * 2.6); }
      }
      // hidden: parked in an alley or a garage, or covered, or in a disguised van - and nobody sees
      let nearest = 1e9;
      for (const u of units) if (u.mode !== 'leave') nearest = Math.min(nearest, Math.hypot(u.v.x - who.x, u.v.z - who.z));
      const farAway = lostT > 40 && nearest > 150;
      hidden = !seen && mode === 'search' && ((parked && !!spot) || covered || (disguised && !blown && who.inCar) || farAway || !!who.inside || (!!spot && spot.roof && who.quiet));
      hiddenT = hidden ? hiddenT + dt : 0;
      if (hiddenT >= HIDE_SECONDS) {
        hiddenT = 0;
        level = s0 - 1;
        message = level > 0 ? 'ONE STAR LESS' : 'THE GUARD HAS LOST YOU';
        if (level <= 0) clearAll();
      }
    } else {
      mode = known && patrol ? 'patrol' : 'idle'; hidden = false; hiddenT = 0;
    }
    const s = stars();

    avoidGates(known || s > 0);
    // the player's yellow line goes around the area that is being searched (once a second)
    areaT -= dt;
    if (areaT <= 0 && gps.setAvoidArea) { areaT = 1; gps.setAvoidArea(s > 0 && mode === 'search' ? { x: lastKnown.x, z: lastKnown.z, r: searchR } : null); }
    // ---- how many units: cars (on the streets) or boats (in The Sunk), and drones ----
    water = !!SK && (SK.inZone(who.x, who.z, 25) || (mode === 'patrol' && !!patrol && SK.inZone(patrol.x, patrol.z)));
    const wantCars = water ? 0 : s > 0 ? Math.min(caps.cars, (known ? CARS : CARS_FREE)[s]) : (mode === 'patrol' ? Math.min(caps.cars, patrol.cars || 0) : 0);
    const wantBoats = !water ? 0 : s > 0 ? Math.min(caps.boats, BOATS[s]) : (mode === 'patrol' ? Math.min(caps.boats, patrol.boats || 0) : 0);
    const wantDrones = s > 0 ? Math.min(caps.drones, (known ? DRONES : DRONES_FREE)[s]) : (mode === 'patrol' ? Math.min(caps.drones, patrol.drones || 0) : 0);
    let activeCars = 0, activeBoats = 0;
    for (const u of units) if (u.mode !== 'leave') { if (u.kind === 'boat') activeBoats++; else activeCars++; }
    spawnT -= dt;
    const around = s > 0 ? (mode === 'chase' ? target : lastKnown) : patrol;
    if (activeCars < wantCars && spawnT <= 0) {
      spawnT = s >= 3 ? 2.5 : 4;
      const u = spawnCar(around, mode === 'patrol' ? 60 : 95, mode === 'patrol' ? Math.max(90, patrol.r) : 150);
      if (u) { u.mode = s > 0 ? mode : 'patrol'; u.goal = mode === 'patrol' ? searchPoint(patrol.x, patrol.z, patrol.r) : searchPoint(lastKnown.x, lastKnown.z, searchR); }
    } else if (activeBoats < wantBoats && spawnT <= 0) {
      spawnT = s >= 3 ? 3 : 4.5;
      const u = spawnBoat(around, mode === 'patrol' ? 40 : 70, mode === 'patrol' ? Math.max(70, patrol.r) : 140);
      if (u) { u.mode = s > 0 ? mode : 'patrol'; u.goal = mode === 'patrol' ? waterPoint(patrol.x, patrol.z, patrol.r) : waterPoint(lastKnown.x, lastKnown.z, searchR); }
    }
    // too many of a kind: the one farthest away leaves
    for (const [kind, act, want] of [['car', activeCars, wantCars], ['boat', activeBoats, wantBoats]]) {
      if (act <= want) continue;
      let far = null;
      for (const u of units) if (u.mode !== 'leave' && (u.kind || 'car') === kind && (!far || Math.hypot(u.v.x - who.x, u.v.z - who.z) > Math.hypot(far.v.x - who.x, far.v.z - who.z))) far = u;
      if (far) { far.mode = 'leave'; far.v.siren = false; far.gone = 0; }
    }
    // modes and lights of the cars that stay
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.mode === 'leave') {
        u.gone += dt;
        const away = (x, z) => (u.kind === 'boat' ? waterPoint(x, z, 200) : searchPoint(x, z, 200));
        if (u.goal && Math.hypot(u.goal.x - u.v.x, u.goal.z - u.v.z) < 10) u.goal = away(u.v.x, u.v.z);
        if (!u.goal || u.goal === target) u.goal = away(u.v.x, u.v.z);
        if ((u.gone > 6 && Math.hypot(u.v.x - who.x, u.v.z - who.z) > 110) || u.gone > 45 || !vehicles.live.includes(u.v)) removeUnit(i);
        continue;
      }
      if (!vehicles.live.includes(u.v)) { units.splice(i, 1); continue; }
      u.mode = s > 0 ? (mode === 'chase' ? 'chase' : 'search') : 'patrol';
      u.v.siren = s > 0;
    }
    let activeD = 0;
    for (const dr of drones) if (!dr.leaving) activeD++;
    droneSpawnT -= dt;
    if (activeD < wantDrones && droneSpawnT <= 0) { droneSpawnT = 6; spawnDrone(); }
    else if (activeD > wantDrones) { const dr = drones.find((q) => !q.leaving); if (dr) dr.leaving = true; }
    droneNear = 0;
    for (const sn of sentries) { flySentry(sn, dt); droneNear = Math.max(droneNear, clamp(1 - Math.hypot(sn.x - who.x, sn.z - who.z) / 70, 0, 1) * 0.7); }
    for (let i = drones.length - 1; i >= 0; i--) {
      const dr = drones[i];
      flyDrone(dr, dt);
      const d = Math.hypot(dr.x - who.x, dr.z - who.z);
      droneNear = Math.max(droneNear, clamp(1 - d / 90, 0, 1));
      if (dr.leaving && d > 160) removeDrone(i);
    }

    // ---- roadblocks from 4 stars ----
    if (roadblocksOn && s >= 4 && mode === 'chase') {
      blockT -= dt;
      if (!block && blockT <= 0) { blockT = 22; const site = roadblockSite(); if (site) placeRoadblock(site); }
    }
    if (block) {
      block.t += dt;
      if (s < 4 || Math.hypot(block.x - who.x, block.z - who.z) > 220 || block.t > 70) removeRoadblock();
    }

    // ---- busted: a Guard car stops right beside the stopped player ----
    let near = 1e9;
    for (const u of units) if (u.mode !== 'leave') near = Math.min(near, Math.hypot(u.v.x - who.x, u.v.z - who.z));
    if (block) for (const v of block.cars) near = Math.min(near, Math.hypot(v.x - who.x, v.z - who.z) + 1);
    if (s > 0 && near < 7.5 && who.speed < 1.6 && !covered && !who.inside) bustT += dt; else bustT = Math.max(0, bustT - dt * 2);
    if (bustT > 2.6) {
      bustT = 0;
      const was = s;
      clearAll();
      graceT = 8;
      if (onBusted) onBusted(was); else message = 'BUSTED';
    }

    // ---- the red and blue light at the edges of the screen ----
    let want = 0;
    if (s > 0 && mode === 'chase') for (const u of units) if (u.mode === 'chase') want = Math.max(want, clamp(1 - Math.hypot(u.v.x - who.x, u.v.z - who.z) / 85, 0, 1));
    light += (want - light) * Math.min(1, dt * 2.5);
    return s;
  }

  // ==================================================================== for the HUD and the minimap
  const view = { units: [], search: null, gates };
  function mapView() {
    view.units.length = 0;
    for (const u of units) {
      if (u.mode === 'leave') continue;
      view.units.push({ x: u.v.x, z: u.v.z, heading: u.v.heading, range: viewRange(u), fov: FOV, kind: u.kind || 'car', alert: u.mode === 'chase' || u.sees });
    }
    for (const dr of drones) if (!dr.leaving) view.units.push({ x: dr.x, z: dr.z, heading: dr.heading, range: (mode === 'chase' ? 34 : 27) * look, fov: Math.PI, kind: 'drone', alert: dr.sees });
    for (const sn of sentries) view.units.push({ x: sn.x, z: sn.z, heading: sn.look, range: sn.range * look, fov: sn.fov, kind: 'drone', alert: sn.sees });
    view.search = mode === 'search' ? { x: lastKnown.x, z: lastKnown.z, r: searchR } : null;
    view.block = block ? { x: block.x, z: block.z } : null;
    return view;
  }

  return {
    update, mapView, addSpot,
    get stars() { return stars(); },
    get heat() { return level; },
    // (raising the heat by hand = something just happened where the player is: they come to look)
    set heat(h) { level = clamp(h, 0, 5); if (level <= 0) clearAll(); else { lastKnown.x = target.x; lastKnown.z = target.z; lostT = 0; mode = 'chase'; } },
    get chased() { return scripted ? scripted.stars > 0 : stars() > 0 && mode === 'chase'; },
    get mode() { return mode; },
    get hidden() { return hidden; },
    get hideProgress() { return hiddenT / HIDE_SECONDS; },
    get seen() { return seen; },
    get covered() { return covered; },
    get coverAvailable() { return coverAvailable; },
    get light() { return light; },
    get droneNear() { return droneNear; },
    get known() { return known; },
    get disguised() { return disguised && !blown; },
    get units() { return units; },
    get drones() { return drones; },
    get roadblock() { return block; },
    get chasers() { return units.map((u) => u.v); },
    get scripted() { return !!scripted; },
    // ---- the water and stealth (Chapter 3) ----
    get water() { return water; },
    get stealth() { return stealth && stars() === 0; },
    get suspicion() { return suspicion; },
    get spotted() { return spotted; },
    get heard() { return heard; },
    get sentries() { return sentries; },
    get exposed() { return sightClose > 0 || sightHeard; },
    addSentry, clearSentries,
    // ---- COVER: pull the parked car into the shadow of the alley / the garage ----
    cover() { if (!coverAvailable) return false; covered = true; coverAvailable = false; message = 'COVERED - STAY STILL'; return true; },
    // ---- the story ----
    // stars: a real wanted level. opts.search: [x, z] where the Guard starts to look (default: the player); opts.seen: they see him now
    setStars(n, opts = {}) {
      level = clamp(n, 0, 5);
      if (level <= 0) { clearAll(); return; }
      const at = opts.search || [target.x, target.z];
      lastKnown.x = at[0]; lastKnown.z = at[1];
      mode = opts.seen ? 'chase' : 'search'; lostT = opts.seen ? 0 : LOST_AFTER + 0.1; searchT = 0; searchR = searchBase = opts.radius || 40; hiddenT = 0;
    },
    // what the story wants: { known, disguised, cars, drones, gates, roadblocks, patrol: { x, z, r, cars, drones } | null, startStars, freeRoam }
    configure(o = {}) {
      if ('known' in o) known = !!o.known;
      if ('disguised' in o) { disguised = !!o.disguised; if (disguised) blown = false; }
      if ('cars' in o) caps.cars = clamp(o.cars, 0, 4);
      if ('drones' in o) caps.drones = clamp(o.drones, 0, 2);
      if ('gates' in o) gatesOn = !!o.gates;
      if ('roadblocks' in o) roadblocksOn = !!o.roadblocks;
      if ('patrol' in o) patrol = o.patrol;
      if ('startStars' in o) startStars = o.startStars;
      if ('freeRoam' in o) freeRoam = !!o.freeRoam;
      if ('ram' in o) ram = !!o.ram;
      if ('boats' in o) caps.boats = clamp(o.boats, 0, 3);
      if ('stealth' in o) { stealth = !!o.stealth; suspicion = 0; spotted = false; }
      if ('hear' in o) hearOn = !!o.hear;
      if ('sentries' in o) { clearSentries(); for (const sp of o.sentries || []) addSentry(sp); }
      if (!(level > 0)) mode = known && patrol ? 'patrol' : 'idle';
    },
    // back to free roam: nobody knows anybody, all units go home
    reset() {
      known = false; disguised = false; blown = false; patrol = null; caps.cars = 4; caps.drones = 2; caps.boats = 3; gatesOn = true; roadblocksOn = true; startStars = 2; freeRoam = true; ram = true;
      stealth = false; suspicion = 0; spotted = false; hearOn = true; clearSentries();
      if (gps.setAvoidArea) gps.setAvoidArea(null);
      clearAll();
      for (let i = units.length - 1; i >= 0; i--) removeUnit(i);
      for (let i = drones.length - 1; i >= 0; i--) removeDrone(i);
    },
    // Chapter 1: show this many stars and do nothing else (null = normal police again)
    setScripted(s) { scripted = s; if (s) { for (const u of units) { u.mode = 'leave'; u.v.siren = false; } level = 0; removeRoadblock(); } },
    set onBusted(fn) { onBusted = fn; },
    set onGate(fn) { onGate = fn; },
    // sirens that are on right now (the traffic pulls over for them)
    sirens(out) { out.length = 0; for (const v of vehicles.live) if (v.siren) out.push(v); return out; },
    takeMessage() { const m = message; message = ''; return m; },
    // the scanner gate that has read the player's plate since the last call (its number), or null
    takeGate() { const g = gateHit; gateHit = null; return g; },
    // for tests
    get lastKnown() { return lastKnown; }, get searchR() { return searchR; }, gatesList: gates, spots,
  };
}
