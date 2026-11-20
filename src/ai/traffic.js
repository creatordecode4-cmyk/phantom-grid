// ---------------------------------------------------------------------------
// traffic.js - the other cars on the road.
//
// The lanes come from layout.js ("traffic"): every street has one driving
// lane per direction, cars keep to the right.
//
// What a traffic car does:
//   * follows its lane and keeps a gap to the car in front
//   * stops at red lights (the same 40 second clock as the signal lamps)
//   * at a crossing it goes straight, turns right or turns left; before a
//     left turn it lets the cars from the other direction pass
//   * brakes for the player (on foot or in a car) and for people on the road
//   * at the edge of the walkable city it has to turn, so nobody drives away
//
// Only cars within 250 m of the player exist. A car that gets too far away
// is put back on a road closer to the player (out of sight if possible).
// All cars of one type are ONE instanced mesh.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { lin } from '../city/models.js';
import { CAR_TYPES } from '../vehicles/carModels.js';

const CAR_COLORS = [
  [0.82, 0.82, 0.8], [0.82, 0.82, 0.8], [0.6, 0.61, 0.62], [0.3, 0.31, 0.33], [0.05, 0.05, 0.055], [0.08, 0.13, 0.26],
  [0.45, 0.07, 0.06], [0.42, 0.52, 0.6], [0.7, 0.66, 0.5], [0.09, 0.18, 0.13], [0.62, 0.3, 0.05],
];
const KINDS = ['sedan', 'suv', 'sedan', 'van', 'coupe', 'sedan', 'suv', 'van'];
const ACCEL = 2.2, BRAKE = 3.6;
const FAR = 250;          // cars further away than this are recycled
const MAX = 40;

export function createTraffic(ctx, beamTexture) {
  const L = ctx.layout, T = L.traffic;
  const rng = ctx.rng.fork();
  const half = L.street.width / 2;

  // ---- the road network: which road crosses which ----
  const signalAt = new Map();
  for (const it of L.intersections) signalAt.set(it.ns + ',' + it.ew, it.signals);
  const neon = { ...T.neon, cross: [] };
  const nsRoads = T.ns.map((r) => ({ ...r, cross: [] }));
  const ewRoads = T.ew.map((r) => ({ ...r, cross: [] }));
  for (const ns of nsRoads) {
    for (const ew of ewRoads) {
      const signals = !!signalAt.get(ns.index + ',' + ew.index);
      ns.cross.push({ c: ew.center, road: ew, signals });
      ew.cross.push({ c: ns.center, road: ns, signals });
    }
    ns.cross.push({ c: neon.center, road: neon, signals: false });
    neon.cross.push({ c: ns.center, road: ns, signals: false });
  }
  // the line a car follows on a road
  const laneC = (road, dir) => (road.neon ? (dir > 0 ? road.laneWest : road.laneEast) : road.axis === 'ns' ? road.center - T.laneOffset * dir : road.center + T.laneOffset * dir);
  // is there another crossing further along this road?
  const hasAhead = (road, from, dir) => road.cross.some((k) => (k.c - from) * dir > 12);
  const xMin = nsRoads[0].center, xMax = nsRoads[nsRoads.length - 1].center;
  const zMax = ewRoads[ewRoads.length - 1].center;

  // ---- the meshes: one per car type ----
  const cars = [];
  const meshes = {};
  // cars from model files join in (about every third car)
  const modelKinds = ctx.carLib ? ctx.carLib.kinds : [];
  const kindList = [];
  for (let i = 0; i < MAX; i++) kindList.push(modelKinds.length && i % 3 === 1 ? modelKinds[Math.floor(i / 3) % modelKinds.length] : KINDS[i % KINDS.length]);
  for (let i = 0; i < MAX; i++) {
    cars.push({ kind: kindList[i], slot: 0, alive: false, turn: null, plan: null, x: 0, z: 0, heading: 0, v: 0, v0: 7, road: null, c: 0, dir: 1, t: 0, still: 0 });
  }
  for (const kind of ['sedan', 'suv', 'van', 'coupe', ...modelKinds]) {
    const mine = cars.filter((c) => c.kind === kind);
    if (!mine.length) continue;
    const mesh = new THREE.InstancedMesh(ctx.sets[kind].geometry, ctx.mats.carPaint, mine.length);
    mesh.name = 'traffic_' + kind;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mine.length * 3), 3);
    mine.forEach((c, k) => {
      c.slot = k;
      const col = modelKinds.includes(kind) ? [1, 1, 1] : lin(kind === 'van' && rng.chance(0.6) ? [0.8, 0.8, 0.78] : rng.pick(CAR_COLORS));
      mesh.instanceColor.setXYZ(k, col[0], col[1], col[2]);
    });
    mesh.instanceMatrix.array.fill(0);
    ctx.group.add(mesh);
    meshes[kind] = mesh;
  }
  // headlight beams on the road at night: one flat patch of light per car
  const beamGeo = new THREE.PlaneGeometry(7, 15);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(0, 0.045, 9.8);
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 });
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, MAX);
  beams.name = 'traffic_beams';
  beams.frustumCulled = false;
  beams.renderOrder = 13;
  beams.count = 0;
  beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.group.add(beams);

  let carCount = 30;

  // ---------------------------------------------------------------- planning
  // What will this car do at the next crossing in front of it?
  function makePlan(car) {
    const road = car.road;
    let K = null;
    for (const k of road.cross) {
      const ahead = (k.c - car.t) * car.dir;
      if (ahead > half - 1 && (!K || ahead < (K.c - car.t) * car.dir)) K = k;
    }
    if (!K) { car.alive = false; return; }
    const from = road.center; // where my road is, measured along the crossing road
    const dRight = road.axis === 'ns' ? -car.dir : car.dir;
    const can = {
      straight: !K.road.neon && hasAhead(road, K.c, car.dir),
      right: hasAhead(K.road, from, dRight),
      left: hasAhead(K.road, from, -dRight),
    };
    let kind;
    const turns = ['right', 'left'].filter((k) => can[k]);
    if (!can.straight) kind = turns.length ? rng.pick(turns) : null;
    else if ((K.signals || road.neon) && turns.length && rng.chance(road.neon ? 0.3 : 0.4)) kind = turns.length === 2 && rng.chance(0.45) ? 'left' : turns[0];
    else kind = 'straight';
    if (!kind) { car.alive = false; return; }
    const d2 = kind === 'right' ? dRight : -dRight;
    const lane2 = kind === 'straight' ? 0 : laneC(K.road, d2);
    const R = kind === 'right' ? T.turnRight : T.turnLeft;
    car.plan = {
      kind, K, d2, lane2, R, road2: K.road, wait: 0,
      start: lane2 - car.dir * R,                                      // where the turn begins
      stop: K.signals ? K.c - car.dir * (half + 4.4 + 2.9) : null,     // where to wait at a red light
      pass: K.c + car.dir * half,                                      // behind this point the crossing is done
      group: road.axis === 'ns' ? 0 : 1,
    };
  }

  function placeCar(car, px, pz, minD) {
    for (let k = 0; k < 8; k++) {
      const r = rng.next();
      let road, dir, t;
      if (r < 0.2) { road = neon; dir = rng.chance(0.5) ? 1 : -1; t = rng.range(xMin + 20, xMax - 20); }
      else if (r < 0.6) { road = rng.pick(nsRoads); dir = rng.chance(0.5) ? 1 : -1; t = rng.range(L.neon.roadMaxZ + 20, zMax - 20); }
      else { road = rng.pick(ewRoads); dir = rng.chance(0.5) ? 1 : -1; t = rng.range(xMin + 20, xMax - 20); }
      const c = laneC(road, dir);
      const x = road.axis === 'ns' ? c : t, z = road.axis === 'ns' ? t : c;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > FAR - 15) continue;
      // not inside a crossing, and not on top of another car
      if (road.cross.some((q) => Math.abs(q.c - t) < half + 9)) continue;
      if (cars.some((o) => o.alive && o !== car && Math.hypot(o.x - x, o.z - z) < 14)) continue;
      Object.assign(car, {
        road, dir, c, t, x, z, alive: true, turn: null, still: 0,
        v0: rng.range(7, 10.5) * (0.85 + 0.15 * CAR_TYPES[car.kind].accel / 7),
        heading: road.axis === 'ns' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      });
      car.v = car.v0 * 0.8;
      makePlan(car);
      return car.alive;
    }
    return false;
  }

  // Before a left turn: is somebody coming from the other direction?
  function leftIsBlocked(car, P) {
    // the lane we have to cross: on a normal street the cars coming toward us,
    // at Neon Mile the cars going west on the north half
    const road = car.road.neon || P.road2.neon ? neon : car.road;
    const dir = road === neon ? 1 : -car.dir;
    const at = road === neon ? (car.road.neon ? P.lane2 : car.c) : P.K.c;
    if (road === neon && car.road.neon && car.dir > 0) return false;
    for (let j = 0; j < carCount; j++) {
      const b = cars[j];
      if (b === car || !b.alive || b.turn || b.road !== road || b.dir !== dir) continue;
      if (b.plan && b.plan.kind === 'left' && b.v < 0.5) continue; // they wait for a left turn too
      const gap = (at - b.t) * b.dir; // meters until they reach our turning place
      if (gap > -6 && gap < 30) return true;
    }
    return false;
  }

  // circles around the cars close to the player (nobody can walk or drive through a car)
  const dynamicCircles = [];
  const _m = new THREE.Matrix4();

  // obstacles: [{ x, z, r }] things the cars must not hit (the player, the player's car)
  // people:    the walking people (cars brake for the ones on the road)
  function update(dt, time, px, pz, obstacles = [], people = null, night = 0) {
    // traffic lights: 40 second cycle (the same clock as the signal lamps in props.js)
    const tt = time % 40;
    const state = [tt < 16 ? 2 : tt < 19 ? 1 : 0, tt >= 20 && tt < 36 ? 2 : tt >= 36 && tt < 39 ? 1 : 0]; // 2 green, 1 yellow, 0 red
    const first = !update.started;
    update.started = true;
    let placed = 0, nBeams = 0;
    dynamicCircles.length = 0;
    const beamOn = night > 0.05;
    for (let i = 0; i < MAX; i++) {
      const car = cars[i];
      const out = meshes[car.kind].instanceMatrix.array, o = car.slot * 16;
      const pd = Math.hypot(car.x - px, car.z - pz);
      if (i >= carCount) car.alive = false;
      else if (car.alive && (pd > FAR || (car.still > 30 && pd > 70))) car.alive = false;
      if (!car.alive && i < carCount && (first || placed < 2)) { placed++; placeCar(car, px, pz, first ? 28 : 110); }
      if (!car.alive) { for (let k = 0; k < 16; k++) out[o + k] = 0; continue; }

      let want = car.v0;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const slowTo = (dist, speed) => { want = Math.min(want, Math.sqrt(speed * speed + 2 * BRAKE * 0.6 * Math.max(dist, 0))); };
      // ---- things in front of the car: the player, the player's car, people ----
      for (const ob of obstacles) {
        const ax = ob.x - car.x, az = ob.z - car.z;
        const ahead = ax * fx + az * fz, side = Math.abs(-ax * fz + az * fx);
        if (ahead > -1 && ahead < 22 && side < 1.3 + ob.r) slowTo(ahead - 3.4 - ob.r * 1.6, 0);
      }
      if (people && pd < 90) {
        for (const p of people) {
          if (!p.alive) continue;
          const ax = p.x - car.x, az = p.z - car.z;
          if (Math.abs(ax) > 11 || Math.abs(az) > 11) continue;
          const ahead = ax * fx + az * fz, side = Math.abs(-ax * fz + az * fx);
          if (ahead > 0 && ahead < 10 && side < 1.7) slowTo(ahead - 4.2, 0);
        }
      }

      if (car.turn) {
        // ---- in a turn: a quarter circle from one lane into the other ----
        const Q = car.turn;
        want = Math.min(want, Q.speed);
        car.v += Math.max(-BRAKE * 1.6 * dt, Math.min(ACCEL * dt, want - car.v));
        if (car.v < 0) car.v = 0;
        Q.th += (car.v * dt) / Q.R;
        const th = Math.min(Q.th, Math.PI / 2), cs = Math.cos(th), sn = Math.sin(th);
        car.x = Q.ox + (-Q.s * Q.rx * cs + Q.dx * sn) * Q.R;
        car.z = Q.oz + (-Q.s * Q.rz * cs + Q.dz * sn) * Q.R;
        car.heading = Math.atan2(Q.dx * cs + Q.s * Q.rx * sn, Q.dz * cs + Q.s * Q.rz * sn);
        if (Q.th >= Math.PI / 2) {
          // arrived on the new road
          car.road = Q.road2; car.dir = Q.d2; car.c = Q.lane2;
          car.t = car.road.axis === 'ns' ? car.z : car.x;
          car.turn = null;
          makePlan(car);
        }
      } else {
        const P = car.plan;
        if (P) {
          // ---- red light, the start of a turn ----
          if (P.stop !== null) {
            const ds = (P.stop - car.t) * car.dir;
            const light = state[P.group];
            if (ds > -1.5 && (light === 0 || (light === 1 && ds > 10))) slowTo(ds, 0);
          }
          if (P.kind !== 'straight') {
            const dist = (P.start - car.t) * car.dir;
            slowTo(dist, P.kind === 'left' ? 4.6 : 3.4);
            // left turn: wait at the turning place while somebody is coming (but not forever)
            if (P.kind === 'left' && dist < 2.5 && P.wait < 9 && leftIsBlocked(car, P)) { slowTo(dist - 0.3, 0); P.wait += dt; }
          }
        }
        // ---- the car in front ----
        for (let j = 0; j < carCount; j++) {
          const b = cars[j];
          if (b === car || !b.alive) continue;
          if (b.turn) {
            const ax = b.x - car.x, az = b.z - car.z;
            if (Math.abs(ax) < 10 && Math.abs(az) < 10 && ax * fx + az * fz > 0 && Math.abs(-ax * fz + az * fx) < 2.6) slowTo(ax * fx + az * fz - 7, 0);
            continue;
          }
          if (b.road !== car.road || b.dir !== car.dir) continue;
          const gap = (b.t - car.t) * car.dir;
          if (gap > 0 && gap < 32) slowTo(gap - 7.5, b.v * 0.5);
        }
        if (want < 0.15) want = 0;
        car.v += Math.max(-BRAKE * 1.6 * dt, Math.min(ACCEL * dt, want - car.v));
        if (car.v < 0) car.v = 0;
        car.t += car.v * dt * car.dir;
        car.x = car.road.axis === 'ns' ? car.c : car.t;
        car.z = car.road.axis === 'ns' ? car.t : car.c;
        if (P) {
          if (P.kind !== 'straight' && (car.t - P.start) * car.dir >= 0) {
            // begin the turn: d = where the car drives now, r = to its right, s = +1 right / -1 left
            const dx = car.road.axis === 'ns' ? 0 : car.dir, dz = car.road.axis === 'ns' ? car.dir : 0;
            const rx = -dz, rz = dx, s = P.kind === 'right' ? 1 : -1;
            car.turn = { th: 0, dx, dz, rx, rz, s, R: P.R, ox: car.x + s * rx * P.R, oz: car.z + s * rz * P.R, road2: P.road2, d2: P.d2, lane2: P.lane2, speed: s > 0 ? 3.4 : 4.6 };
          } else if (P.kind === 'straight' && (car.t - P.pass) * car.dir > 0) makePlan(car);
        }
      }
      car.still = car.v < 0.1 ? car.still + dt : 0;

      const c = Math.cos(car.heading), sn = Math.sin(car.heading);
      out[o] = c; out[o + 1] = 0; out[o + 2] = -sn; out[o + 3] = 0;
      out[o + 4] = 0; out[o + 5] = 1; out[o + 6] = 0; out[o + 7] = 0;
      out[o + 8] = sn; out[o + 9] = 0; out[o + 10] = c; out[o + 11] = 0;
      out[o + 12] = car.x; out[o + 13] = 0; out[o + 14] = car.z; out[o + 15] = 1;
      if (pd < 45) for (const k of [-1.45, 0, 1.45]) dynamicCircles.push({ x: car.x + sn * k, z: car.z + c * k, r: 1.0 });
      if (beamOn && pd < 150) {
        _m.makeRotationY(car.heading); _m.setPosition(car.x, 0, car.z);
        beams.setMatrixAt(nBeams++, _m);
      }
    }
    for (const mesh of Object.values(meshes)) mesh.instanceMatrix.needsUpdate = true;
    beams.count = nBeams;
    beamMat.opacity = 0.7 * night;
    if (nBeams) beams.instanceMatrix.needsUpdate = true;
  }

  return {
    cars, meshes, dynamicCircles, update,
    get count() { return carCount; },
    setQuality(q) { carCount = Math.min(MAX, q.traffic ?? 30); },
  };
}
