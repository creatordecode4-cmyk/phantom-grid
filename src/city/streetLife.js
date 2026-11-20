// ---------------------------------------------------------------------------
// streetLife.js - everything that MOVES at street level:
//   * people walking on the sidewalks (one instanced mesh for all of them)
//   * cars driving slowly along the lanes (one instanced mesh per car type)
//
// PEOPLE walk around the blocks on two thin "lanes" of the sidewalk, one in
// each direction. Only the people near the player exist: when somebody gets
// too far away, they are moved to a new place closer by.
//
// CARS drive on the inner lanes, on the right side of the road. They stop at
// red lights, keep a gap to the car in front, brake for the player, and at
// some crossings they turn right. At the edge of the walkable city every car
// has to turn right, so the traffic goes round and round and never leaves.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { blockEdges } from './ground.js';
import * as M from './models.js';

// clothes (screen colors); every person gets one
const CLOTHES = [
  [0.82, 0.82, 0.8], [0.12, 0.13, 0.15], [0.2, 0.26, 0.4], [0.52, 0.14, 0.12], [0.75, 0.62, 0.3], [0.25, 0.42, 0.36],
  [0.55, 0.57, 0.6], [0.8, 0.5, 0.25], [0.36, 0.3, 0.5], [0.16, 0.36, 0.55], [0.7, 0.72, 0.62], [0.42, 0.2, 0.28],
];
const CAR_COLORS = [
  [0.82, 0.82, 0.8], [0.82, 0.82, 0.8], [0.6, 0.61, 0.62], [0.3, 0.31, 0.33], [0.05, 0.05, 0.055], [0.08, 0.13, 0.26],
  [0.45, 0.07, 0.06], [0.42, 0.52, 0.6], [0.7, 0.66, 0.5], [0.09, 0.18, 0.13],
];

const LANE = 1.75;        // the inner driving lane is this far from the middle of the street
const TURN_R = 4.5;       // radius of a right turn (meters)
const TURN_SPEED = 3.4;   // meters per second in a turn
const ACCEL = 2.2, BRAKE = 3.6;

export function createStreetLife(ctx) {
  const L = ctx.layout;
  const rng = ctx.rng.fork();
  const curb = L.street.curbHeight;
  const half = L.street.width / 2;
  const lin = M.lin;

  // =========================================================================
  // 1. PEOPLE
  // =========================================================================
  // ---- the walking paths: two closed loops around every block ----
  const loops = [];
  for (const block of L.blocks) {
    if (!block.playable) continue;
    const edges = blockEdges(block);
    const n = edges.length;
    if (n < 3) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of block.poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    // walls of this block (people must not walk through them)
    const walls = ctx.colliders.boxes.filter((b) => b.h > 1 && b.maxX > minX && b.minX < maxX && b.maxZ > minZ && b.minZ < maxZ);
    const blocked = (x, z) => walls.some((b) => x > b.minX - 0.35 && x < b.maxX + 0.35 && z > b.minZ - 0.35 && z < b.maxZ + 0.35);
    for (let lane = 0; lane < 2; lane++) {
      // how far in from the curb this lane runs on every edge of the block
      const offs = edges.map((e) => {
        if (e.type === 'alley') return -1.1 - lane * 0.6; // alleys have no sidewalk: walk in the alley
        const o = lane ? 1.9 : 1.45;
        for (let s = 3; s < e.len - 3; s += 2) {
          // a wall is in the way: walk closer to the curb on this edge
          if (blocked(e.a.x + e.dirX * s + e.inX * o, e.a.z + e.dirZ * s + e.inZ * o)) return lane ? 1.15 : 0.8;
        }
        return o;
      });
      // corner i = where edge i-1 meets edge i, moved inward by both offsets
      const pts = edges.map((e, i) => {
        const p = edges[(i - 1 + n) % n], d1 = offs[(i - 1 + n) % n], d2 = offs[i];
        const k = p.inX * e.inX + p.inZ * e.inZ, den = 1 - k * k;
        if (den < 1e-3) return { x: e.a.x + e.inX * d2, z: e.a.z + e.inZ * d2 };
        const u = (d1 - d2 * k) / den, v = (d2 - d1 * k) / den;
        return { x: e.a.x + p.inX * u + e.inX * v, z: e.a.z + p.inZ * u + e.inZ * v };
      });
      const seg = [];
      let total = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n], len = Math.hypot(b.x - a.x, b.z - a.z);
        seg.push({ a, b, len, start: total, dx: (b.x - a.x) / (len || 1), dz: (b.z - a.z) / (len || 1) });
        total += len;
      }
      if (total > 40) loops.push({ seg, total, dir: lane ? -1 : 1, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 });
    }
  }

  // ---- the mesh: one model, many copies ----
  const PEOPLE_MAX = 190;
  const pedModel = M.makePedestrian();
  const pedGeo = pedModel.geometry;
  const phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX), 1);
  phaseAttr.setUsage(THREE.DynamicDrawUsage);
  pedGeo.setAttribute('aPhase', phaseAttr);
  const pedMesh = new THREE.InstancedMesh(pedGeo, ctx.mats.ped, PEOPLE_MAX);
  pedMesh.name = 'people';
  pedMesh.frustumCulled = false;
  pedMesh.castShadow = true;
  pedMesh.receiveShadow = true;
  pedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE_MAX * 3), 3);
  pedMesh.count = 0;
  ctx.group.add(pedMesh);

  const people = [];
  for (let i = 0; i < PEOPLE_MAX; i++) {
    const c = lin(rng.pick(CLOTHES)), k = rng.range(0.85, 1.1);
    pedMesh.instanceColor.setXYZ(i, c[0] * k, c[1] * k, c[2] * k);
    people.push({
      loop: null, s: 0, x: 0, z: 0, y: 0, heading: 0, alive: false,
      speed: rng.chance(0.1) ? 0 : rng.range(1.05, 1.65),   // a few people just stand and wait
      phase: rng.range(0, 6.28), size: rng.range(0.92, 1.07), wide: rng.range(0.92, 1.1),
    });
  }
  let peopleCount = 130;
  const PEOPLE_FAR = 105;   // people further away than this are moved closer

  // where is a person on its loop? writes x, z and the walking direction
  const _at = { x: 0, z: 0, dx: 0, dz: 1 };
  function loopAt(loop, s) {
    s = ((s % loop.total) + loop.total) % loop.total;
    let g = loop.seg[0];
    for (const q of loop.seg) { if (s >= q.start && s <= q.start + q.len) { g = q; break; } }
    const t = s - g.start;
    _at.x = g.a.x + g.dx * t; _at.z = g.a.z + g.dz * t;
    _at.dx = g.dx * loop.dir; _at.dz = g.dz * loop.dir;
    return _at;
  }

  let nearLoops = [], nearX = 1e9, nearZ = 1e9;
  function placePerson(p, px, pz, minD, maxD) {
    if ((px - nearX) ** 2 + (pz - nearZ) ** 2 > 30 * 30) {
      nearX = px; nearZ = pz;
      nearLoops = loops.filter((l) => Math.abs(l.cx - px) < 190 && Math.abs(l.cz - pz) < 190);
    }
    if (!nearLoops.length) return false;
    for (let k = 0; k < 16; k++) {
      const loop = rng.pick(nearLoops), s = rng.range(0, loop.total);
      const a = loopAt(loop, s), d = Math.hypot(a.x - px, a.z - pz);
      if (d < minD || d > maxD) continue;
      p.loop = loop; p.s = s; p.x = a.x; p.z = a.z; p.heading = Math.atan2(a.dx, a.dz); p.alive = true;
      return true;
    }
    return false;
  }

  function updatePeople(dt, px, pz, first) {
    const m = pedMesh.instanceMatrix.array, ph = phaseAttr.array;
    let moved = 0;
    for (let i = 0; i < peopleCount; i++) {
      const p = people[i];
      if (p.alive && Math.hypot(p.x - px, p.z - pz) > PEOPLE_FAR) p.alive = false;
      if (!p.alive && (first || moved < 8)) { moved++; placePerson(p, px, pz, first ? 6 : 48, PEOPLE_FAR - 8); }
      const o = i * 16;
      if (!p.alive) { for (let k = 0; k < 16; k++) m[o + k] = 0; continue; } // hidden: size zero
      p.s += p.speed * dt * p.loop.dir;
      const a = loopAt(p.loop, p.s);
      let x = a.x, z = a.z;
      // step aside for the player
      const ex = x - px, ez = z - pz, ed = Math.hypot(ex, ez);
      if (ed < 0.95 && ed > 0.001) { x += (ex / ed) * (0.95 - ed); z += (ez / ed) * (0.95 - ed); }
      p.x = x; p.z = z;
      if (p.speed > 0) {
        // turn smoothly at the corners
        let turn = Math.atan2(a.dx, a.dz) - p.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        p.heading += turn * Math.min(1, dt * 7);
        p.phase += p.speed * dt * 4.4; // one full leg swing every 1.4 m
      }
      p.y = L.groundHeight(x, z);
      const c = Math.cos(p.heading) * p.size, sn = Math.sin(p.heading) * p.size;
      m[o] = c * p.wide; m[o + 1] = 0; m[o + 2] = -sn * p.wide; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = p.size; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = sn; m[o + 9] = 0; m[o + 10] = c; m[o + 11] = 0;
      m[o + 12] = x; m[o + 13] = p.y; m[o + 14] = z; m[o + 15] = 1;
      ph[i] = p.speed > 0 ? p.phase : 0;
    }
    pedMesh.count = peopleCount;
    pedMesh.instanceMatrix.needsUpdate = true;
    phaseAttr.needsUpdate = true;
  }

  // =========================================================================
  // 2. CARS
  // =========================================================================
  const N = L.neon;
  const nsList = L.streetsNS.filter((s) => s.playable).map((s) => ({ c: s.center, index: s.index }));
  const ewList = L.streetsEW.filter((s) => s.playable).map((s) => ({ c: s.center, index: s.index }));
  const NEON_LANE = N.centerZ + N.medianWidth / 2 + 1.9; // north half of the boulevard: cars drive west (+X)
  const signalAt = new Map();
  for (const it of L.intersections) signalAt.set(it.ns + ',' + it.ew, it.signals);

  // right-hand traffic: which line does a car follow on a street?
  //   north-south street: north-bound cars use the east half (-x)
  //   east-west street:   cars going west (+x) use the north half (+z)
  const laneOf = (axis, center, dir) => (axis === 'ns' ? center - LANE * dir : center + LANE * dir);
  // the direction on the cross street after a right turn
  //   going north (+z) -> east (-x);  south -> west;  west (+x) -> north;  east -> south
  const rightDir = (axis, dir) => (axis === 'ns' ? -dir : dir);

  const CARS_MAX = 36;
  const KINDS = ['sedan', 'sedan', 'suv', 'van'];
  const carMeshes = {};
  const cars = [];
  for (let i = 0; i < CARS_MAX; i++) cars.push({ kind: KINDS[i % 4], slot: 0, alive: false, turn: null, plan: null, x: 0, z: 0, heading: 0, v: 0, v0: 7, axis: 'ns', c: 0, dir: 1, t: 0, neon: false });
  for (const kind of ['sedan', 'suv', 'van']) {
    const mine = cars.filter((c) => c.kind === kind);
    const mesh = new THREE.InstancedMesh(ctx.sets[kind].geometry, ctx.mats.prop, mine.length);
    mesh.name = 'traffic_' + kind;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mine.length * 3), 3);
    mine.forEach((c, k) => {
      c.slot = k;
      const col = lin(kind === 'van' && rng.chance(0.6) ? [0.8, 0.8, 0.78] : rng.pick(CAR_COLORS));
      mesh.instanceColor.setXYZ(k, col[0], col[1], col[2]);
    });
    mesh.instanceMatrix.array.fill(0);
    ctx.group.add(mesh);
    carMeshes[kind] = mesh;
  }
  let carCount = 24;
  const CARS_FAR = 240;

  // What happens at the next crossing in front of this car?
  function makePlan(car) {
    const list = car.axis === 'ns' ? ewList : nsList;
    let next = null;
    for (const s of list) {
      const ahead = (s.c - car.t) * car.dir;
      if (ahead > half && (!next || ahead < (next.c - car.t) * car.dir)) next = s;
    }
    if (!next) {
      // no street left in front: only south-bound cars get here, they meet the boulevard
      if (car.axis === 'ns' && car.dir < 0) {
        car.plan = { turn: true, stop: null, lane2: NEON_LANE, start: NEON_LANE + TURN_R, pass: -1e9, neon: true };
        return;
      }
      car.alive = false; // (should not happen)
      return;
    }
    const first = list[0], last = list[list.length - 1];
    const forced = car.dir > 0 ? next === last : next === first && !(car.axis === 'ns');
    const key = car.axis === 'ns' ? car.street + ',' + next.index : next.index + ',' + car.street;
    const signals = !car.neon && !!signalAt.get(key);
    // the edge of the city: turn. Otherwise turn at about one crossing in four (only where there are lights)
    const turn = forced || (car.neon ? rng.chance(0.3) : signals && rng.chance(0.25));
    const cross = car.axis === 'ns' ? 'ew' : 'ns';
    const d2 = rightDir(car.axis, car.dir);
    const lane2 = laneOf(cross, next.c, d2);
    car.plan = {
      turn, lane2, dir2: d2, street2: next.index, neon: false,
      start: lane2 - car.dir * TURN_R,                               // where the turn begins
      stop: signals ? next.c - car.dir * (half + 4.4 + 2.9) : null,  // where to wait at a red light
      pass: next.c + car.dir * half,                                 // behind this point the crossing is done
      group: car.axis === 'ns' ? 0 : 1,
    };
  }

  function placeCar(car, px, pz, minD) {
    for (let k = 0; k < 8; k++) {
      const r = rng.next();
      let axis, st, dir, c, t, neon = false;
      if (r < 0.14) {
        axis = 'ew'; dir = 1; c = NEON_LANE; neon = true; st = -1;
        t = rng.range(nsList[0].c + 20, nsList[nsList.length - 1].c - 20);
      } else if (r < 0.57) {
        axis = 'ns'; const s = rng.pick(nsList); st = s.index; dir = rng.chance(0.5) ? 1 : -1; c = laneOf('ns', s.c, dir);
        t = rng.range(N.roadMaxZ + 20, ewList[ewList.length - 1].c - 20);
      } else {
        axis = 'ew'; const s = rng.pick(ewList); st = s.index; dir = rng.chance(0.5) ? 1 : -1; c = laneOf('ew', s.c, dir);
        t = rng.range(nsList[0].c + 20, nsList[nsList.length - 1].c - 20);
      }
      const x = axis === 'ns' ? c : t, z = axis === 'ns' ? t : c;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > CARS_FAR - 30) continue;
      // not inside a crossing, and not on top of another car
      if ((axis === 'ns' ? ewList : nsList).some((s) => Math.abs(s.c - t) < half + 9)) continue;
      if (cars.some((o) => o.alive && o !== car && Math.hypot(o.x - x, o.z - z) < 14)) continue;
      Object.assign(car, { axis, street: st, dir, c, t, neon, x, z, alive: true, turn: null, v0: rng.range(6.5, 9), heading: axis === 'ns' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2) });
      car.v = car.v0 * 0.8;
      makePlan(car);
      return car.alive;
    }
    return false;
  }

  // circles around the cars close to the player (the player cannot walk through a car)
  const dynamicCircles = [];

  function updateCars(dt, time, px, pz, first) {
    // traffic lights: 40 second cycle (the same clock as the signal lamps in props.js)
    const tt = time % 40;
    const state = [tt < 16 ? 2 : tt < 19 ? 1 : 0, tt >= 20 && tt < 36 ? 2 : tt >= 36 && tt < 39 ? 1 : 0]; // 2 green, 1 yellow, 0 red
    let placed = 0;
    dynamicCircles.length = 0;
    for (let i = 0; i < CARS_MAX; i++) {
      const car = cars[i];
      const out = carMeshes[car.kind].instanceMatrix.array, o = car.slot * 16;
      if (i >= carCount) car.alive = false;
      else if (car.alive && Math.hypot(car.x - px, car.z - pz) > CARS_FAR) car.alive = false;
      if (!car.alive && i < carCount && (first || placed < 2)) { placed++; placeCar(car, px, pz, first ? 28 : 110); }
      if (!car.alive) { for (let k = 0; k < 16; k++) out[o + k] = 0; continue; }

      let want = car.v0;
      const pd = Math.hypot(car.x - px, car.z - pz);
      if (car.turn) {
        // ---- in a right turn: a quarter circle from one lane into the other ----
        const T = car.turn;
        want = pd < 5 ? 0 : TURN_SPEED;
        car.v += Math.max(-BRAKE * dt, Math.min(ACCEL * dt, want - car.v));
        T.th += (car.v * dt) / TURN_R;
        const th = Math.min(T.th, Math.PI / 2), cs = Math.cos(th), sn = Math.sin(th);
        car.x = T.ox + (-T.rx * cs + T.dx * sn) * TURN_R;
        car.z = T.oz + (-T.rz * cs + T.dz * sn) * TURN_R;
        car.heading = Math.atan2(T.dx * cs + T.rx * sn, T.dz * cs + T.rz * sn);
        if (T.th >= Math.PI / 2) {
          // arrived on the new street
          car.axis = T.axis2; car.dir = T.dir2; car.c = T.c2; car.street = T.street2; car.neon = T.neon2;
          car.t = car.axis === 'ns' ? car.z : car.x;
          car.turn = null;
          makePlan(car);
        }
      } else {
        const P = car.plan;
        // ---- brake for: a red light, the start of a turn, the car in front, the player ----
        const slowTo = (dist, speed) => { want = Math.min(want, Math.sqrt(speed * speed + 2 * BRAKE * 0.6 * Math.max(dist, 0))); };
        if (P) {
          if (P.stop !== null) {
            const ds = (P.stop - car.t) * car.dir;
            const light = state[P.group];
            if (ds > -1.5 && (light === 0 || (light === 1 && ds > 10))) slowTo(ds, 0);
          }
          if (P.turn) slowTo((P.start - car.t) * car.dir, TURN_SPEED);
        }
        for (let j = 0; j < carCount; j++) {
          const b = cars[j];
          if (b === car || !b.alive) continue;
          if (b.turn) { if (Math.hypot(b.x - car.x, b.z - car.z) < 9 && ((b.x - car.x) * Math.sin(car.heading) + (b.z - car.z) * Math.cos(car.heading)) > 0) slowTo(0, 0); continue; }
          if (b.axis !== car.axis || b.dir !== car.dir || Math.abs(b.c - car.c) > 1) continue;
          const gap = (b.t - car.t) * car.dir;
          if (gap > 0 && gap < 32) slowTo(gap - 7.5, b.v * 0.5);
        }
        {
          const pt = car.axis === 'ns' ? pz : px, pc = car.axis === 'ns' ? px : pz;
          const gap = (pt - car.t) * car.dir;
          if (Math.abs(pc - car.c) < 1.8 && gap > 0 && gap < 16) slowTo(gap - 4.6, 0);
        }
        if (want < 0.15) want = 0;
        car.v += Math.max(-BRAKE * 1.6 * dt, Math.min(ACCEL * dt, want - car.v));
        if (car.v < 0) car.v = 0;
        car.t += car.v * dt * car.dir;
        car.x = car.axis === 'ns' ? car.c : car.t;
        car.z = car.axis === 'ns' ? car.t : car.c;
        if (P) {
          if (P.turn && (car.t - P.start) * car.dir >= 0) {
            // begin the right turn: d = where the car drives now, r = to its right
            const dx = car.axis === 'ns' ? 0 : car.dir, dz = car.axis === 'ns' ? car.dir : 0;
            const rx = -dz, rz = dx;
            car.turn = {
              th: 0, dx, dz, rx, rz, ox: car.x + rx * TURN_R, oz: car.z + rz * TURN_R,
              axis2: car.axis === 'ns' ? 'ew' : 'ns', dir2: P.neon ? 1 : P.dir2, c2: P.lane2, street2: P.neon ? -1 : P.street2, neon2: !!P.neon,
            };
          } else if (!P.turn && (car.t - P.pass) * car.dir > 0) makePlan(car);
        }
      }

      const c = Math.cos(car.heading), sn = Math.sin(car.heading);
      out[o] = c; out[o + 1] = 0; out[o + 2] = -sn; out[o + 3] = 0;
      out[o + 4] = 0; out[o + 5] = 1; out[o + 6] = 0; out[o + 7] = 0;
      out[o + 8] = sn; out[o + 9] = 0; out[o + 10] = c; out[o + 11] = 0;
      out[o + 12] = car.x; out[o + 13] = 0; out[o + 14] = car.z; out[o + 15] = 1;
      if (pd < 22) for (const k of [-1.45, 0, 1.45]) dynamicCircles.push({ x: car.x + sn * k, z: car.z + c * k, r: 1.0 });
    }
    for (const mesh of Object.values(carMeshes)) mesh.instanceMatrix.needsUpdate = true;
  }

  // =========================================================================
  let started = false;
  return {
    people, cars, dynamicCircles, pedMesh, carMeshes,
    // fewer people and cars on weaker quality levels
    setQuality(q) {
      const nextPeople = Math.min(PEOPLE_MAX, q.people ?? 130), nextCars = Math.min(CARS_MAX, q.traffic ?? 24);
      for (let i = nextPeople; i < PEOPLE_MAX; i++) people[i].alive = false;
      peopleCount = nextPeople; carCount = nextCars;
    },
    update(dt, time, px, pz) {
      updatePeople(dt, px, pz, !started);
      updateCars(dt, time, px, pz, !started);
      started = true;
    },
  };
}
