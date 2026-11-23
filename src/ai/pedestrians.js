// ---------------------------------------------------------------------------
// pedestrians.js - the people on the sidewalks.
//
//   * Everybody is drawn with ONE instanced mesh (one draw call). Arms and
//     legs swing in the shader, so the walk cycle costs almost nothing.
//   * People walk around the blocks on two thin "lanes" of the sidewalk (one
//     per direction). At corners with traffic lights some of them cross the
//     street on the crosswalk - but only when the cars have red.
//   * They step aside for the player and jump out of the way of cars.
//   * Only people near the player exist. There are fewer at night and in rain.
//   * Different clothes and heights for everybody.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { blockEdges } from '../city/ground.js';
import * as M from '../city/models.js';

// clothes (screen colors); every person gets one
const CLOTHES = [
  [0.82, 0.82, 0.8], [0.12, 0.13, 0.15], [0.2, 0.26, 0.4], [0.52, 0.14, 0.12], [0.75, 0.62, 0.3], [0.25, 0.42, 0.36],
  [0.55, 0.57, 0.6], [0.8, 0.5, 0.25], [0.36, 0.3, 0.5], [0.16, 0.36, 0.55], [0.7, 0.72, 0.62], [0.42, 0.2, 0.28],
];
const MAX = 80;
const FAR = 100;          // people further away than this are moved closer

export function createPedestrians(ctx) {
  const L = ctx.layout;
  const rng = ctx.rng.fork();
  const lin = M.lin;
  const streetW = L.street.width;

  // =========================================================================
  // 1. THE WALKING PATHS: two closed loops around every block
  // =========================================================================
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
        seg.push({ a, b, len, start: total, dx: (b.x - a.x) / (len || 1), dz: (b.z - a.z) / (len || 1), links: [] });
        total += len;
      }
      if (total > 40) loops.push({ seg, total, dir: lane ? -1 : 1, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 });
    }
  }

  // ---- crosswalks: from a corner of one block straight over the street to the next block ----
  // A link is stored at the corner (= the start point of a path piece).
  //   group: which cars drive across this crosswalk (0 = north-south street, 1 = east-west street)
  {
    const signals = L.intersections.filter((it) => it.signals);
    for (const A of loops) {
      for (const sa of A.seg) {
        for (const Bl of loops) {
          if (Bl === A || Math.abs(Bl.cx - A.cx) > 140 || Math.abs(Bl.cz - A.cz) > 160) continue;
          for (let j = 0; j < Bl.seg.length; j++) {
            const b = Bl.seg[j].a;
            const dx = b.x - sa.a.x, dz = b.z - sa.a.z, d = Math.hypot(dx, dz);
            if (d < streetW + 1.5 || d > streetW + 5) continue;
            const alongX = Math.abs(dz) < 1.2, alongZ = Math.abs(dx) < 1.2;
            if (!alongX && !alongZ) continue;
            // only next to a crossing with traffic lights
            const mx = sa.a.x + dx / 2, mz = sa.a.z + dz / 2;
            if (!signals.some((it) => Math.abs(it.x - mx) < 13 && Math.abs(it.z - mz) < 13)) continue;
            if (L.groundHeight(mx, mz) > 0.05) continue; // the middle must be road
            sa.links.push({ loop: Bl, index: j, x: b.x, z: b.z, len: d, group: alongX ? 0 : 1 });
          }
        }
      }
    }
  }

  // =========================================================================
  // 2. THE MESH: one model, many copies
  // =========================================================================
  const pedGeo = M.makePedestrian().geometry;
  const phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  phaseAttr.setUsage(THREE.DynamicDrawUsage);
  pedGeo.setAttribute('aPhase', phaseAttr);
  const mesh = new THREE.InstancedMesh(pedGeo, ctx.mats.ped, MAX);
  mesh.name = 'people';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.count = 0;
  ctx.group.add(mesh);

  const people = [];
  for (let i = 0; i < MAX; i++) {
    const c = lin(rng.pick(CLOTHES)), k = rng.range(0.85, 1.1);
    mesh.instanceColor.setXYZ(i, c[0] * k, c[1] * k, c[2] * k);
    people.push({
      loop: null, s: 0, segIndex: 0, x: 0, z: 0, y: 0, heading: 0, alive: false,
      mode: 'walk',          // walk | wait (at a red light) | cross (on the crosswalk)
      link: null, crossT: 0, fromX: 0, fromZ: 0, cool: 0,
      speed: rng.chance(0.08) ? 0 : rng.range(1.05, 1.65),   // a few people just stand around
      phase: rng.range(0, 6.28),
      size: rng.range(0.86, 1.1),     // different heights
      wide: rng.range(0.9, 1.12),
    });
  }
  let baseCount = 60;    // from the quality level
  let knocked = 0;       // how many people were knocked over by the player's car (main.js reads this)
  let wanted = 60;       // fewer at night and in rain
  let cap = Infinity;    // story: at most this many (0 = empty streets)
  let capNow = false;    // true: people over the cap vanish at once (the screen is black), false: only once they are far away

  // where is a point on a loop? writes x, z, the walking direction and the piece number
  const _at = { x: 0, z: 0, dx: 0, dz: 1, index: 0 };
  function loopAt(loop, s) {
    s = ((s % loop.total) + loop.total) % loop.total;
    let g = loop.seg[0], index = 0;
    for (let i = 0; i < loop.seg.length; i++) { const q = loop.seg[i]; if (s >= q.start && s <= q.start + q.len) { g = q; index = i; break; } }
    const t = s - g.start;
    _at.x = g.a.x + g.dx * t; _at.z = g.a.z + g.dz * t;
    _at.dx = g.dx * loop.dir; _at.dz = g.dz * loop.dir; _at.index = index;
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
      p.loop = loop; p.s = s; p.segIndex = a.index; p.x = a.x; p.z = a.z; p.heading = Math.atan2(a.dx, a.dz); p.alive = true; p.mode = 'walk'; p.ox = 0; p.oz = 0; p.fall = 0; p.jump = 0;
      return true;
    }
    return false;
  }

  // may somebody start to cross now? (the cars on that street must have red for long enough)
  //   40 second clock: north-south cars drive from 0 to 19, east-west cars from 20 to 39
  const mayCross = (group, tt) => (group === 0 ? tt > 20.5 && tt < 27 : tt > 0.5 && tt < 7);

  // avoid: [{ x, z, r, speed, dx, dz }] (speed and direction only for a car: people jump away from fast ones) the player and the cars near the player
  function update(dt, time, px, pz, avoid = [], night = 0, rain = 0) {
    const first = !update.started;
    update.started = true;
    wanted = Math.min(cap, Math.round(baseCount * (1 - 0.5 * night) * (1 - 0.4 * rain)));
    const tt = time % 40;
    const m = mesh.instanceMatrix.array, ph = phaseAttr.array;
    let moved = 0, top = 0;
    for (let i = 0; i < MAX; i++) {
      const p = people[i];
      const o = i * 16;
      const d = p.alive ? Math.hypot(p.x - px, p.z - pz) : 0;
      // too far away, or too many people for this time of day (those leave when nobody looks)
      if (p.alive && (d > FAR || (i >= wanted && (d > 45 || capNow)))) p.alive = false;
      if (!p.alive && i < wanted && (first || moved < 6)) { moved++; placePerson(p, px, pz, first ? 6 : 48, FAR - 8); }
      if (!p.alive) { for (let k = 0; k < 16; k++) m[o + k] = 0; continue; } // hidden: size zero
      top = i + 1;

      let x, z, dirX, dirZ, walking = p.speed > 0;
      if (p.mode === 'cross') {
        // straight over the crosswalk, a little faster than normal
        const K = p.link;
        p.crossT += (Math.max(p.speed, 1.3) * 1.15 * dt) / K.len;
        const t = Math.min(1, p.crossT);
        x = p.fromX + (K.x - p.fromX) * t; z = p.fromZ + (K.z - p.fromZ) * t;
        dirX = (K.x - p.fromX) / K.len; dirZ = (K.z - p.fromZ) / K.len;
        walking = true;
        if (t >= 1) { p.loop = K.loop; p.s = K.loop.seg[K.index].start; p.segIndex = K.index; p.mode = 'walk'; p.cool = 12; }
      } else if (p.mode === 'wait') {
        // standing at the curb until the cars have red
        x = p.fromX; z = p.fromZ;
        dirX = (p.link.x - x) / p.link.len; dirZ = (p.link.z - z) / p.link.len;
        walking = false;
        if (mayCross(p.link.group, tt)) { p.mode = 'cross'; p.crossT = 0; }
      } else {
        p.cool -= dt;
        p.s += p.speed * dt * p.loop.dir;
        const a = loopAt(p.loop, p.s);
        x = a.x; z = a.z; dirX = a.dx; dirZ = a.dz;
        if (a.index !== p.segIndex) {
          // just walked around a corner: maybe cross the street here
          const corner = p.loop.dir > 0 ? a.index : p.segIndex;
          const piece = p.loop.seg[corner];
          p.segIndex = a.index;
          if (piece.links.length && p.speed > 0 && p.cool <= 0 && rng.chance(0.4)) {
            p.link = rng.pick(piece.links);
            p.fromX = piece.a.x; p.fromZ = piece.a.z;
            p.mode = 'wait';
            x = p.fromX; z = p.fromZ;
          }
        }
      }

      // ---- step aside for the player, get out of the way of cars ----
      // p.ox / p.oz: how far this person jumped off their path (they walk back afterwards)
      p.jump = Math.max(0, (p.jump || 0) - dt);
      p.fall = Math.max(0, (p.fall || 0) - dt);
      if (p.fall > 0) walking = false;
      if (p.jump <= 0 && p.fall <= 0) { p.ox = (p.ox || 0) * Math.exp(-1.2 * dt); p.oz = (p.oz || 0) * Math.exp(-1.2 * dt); }
      else if (p.jump > 0) { p.ox += p.jx * 5.5 * dt; p.oz += p.jz * 5.5 * dt; }
      x += p.ox || 0; z += p.oz || 0;
      for (const ob of avoid) {
        const ex = x - ob.x, ez = z - ob.z, min = ob.r + 0.6;
        if (ob.speed > 4 && Math.abs(ex) < 9 && Math.abs(ez) < 9 && p.fall <= 0) {
          const ed = Math.hypot(ex, ez) || 0.001;
          const along = ex * ob.dx + ez * ob.dz, side = -ex * ob.dz + ez * ob.dx;
          if (ed < ob.r + 0.7) {
            // hit by the car: fall on the back, get up again after a moment (nobody gets hurt)
            p.fall = 3; p.jump = 0; knocked++;
            p.ox += (ex / ed) * 0.9; p.oz += (ez / ed) * 0.9;
            p.fallDir = Math.atan2(-ob.dx, -ob.dz);
          } else if (p.jump <= 0 && along > -0.5 && along < 4 + ob.speed * 0.45 && Math.abs(side) < ob.r + 1.3) {
            // a fast car is coming straight at them: jump to the side
            const sg = side >= 0 ? 1 : -1;
            p.jump = 0.36; p.jx = -ob.dz * sg; p.jz = ob.dx * sg;
          }
        }
        if (Math.abs(ex) > min || Math.abs(ez) > min) continue;
        const ed = Math.hypot(ex, ez);
        if (ed < min && ed > 0.001) { x += (ex / ed) * (min - ed); z += (ez / ed) * (min - ed); }
      }
      // ---- poles, trees, benches, parked cars and walls in the way: walk AROUND them, not through them ----
      // (the person only moves sideways, so the path bends in a smooth curve around the thing)
      if (grid && p.fall <= 0) {
        const cell = grid.near(x, z);
        for (const q of cell.circles) {
          if (q.car || q.veh) continue;
          const ex = x - q.x, ez = z - q.z, min = q.r + 0.34;
          if (Math.abs(ex) > min || Math.abs(ez) > min) continue;
          const along = ex * dirX + ez * dirZ;
          let lat = ex * dirZ - ez * dirX;
          if (along * along + lat * lat >= min * min) continue;
          lat = (lat >= 0 ? 1 : -1) * Math.sqrt(min * min - along * along);
          x = q.x + along * dirX + lat * dirZ; z = q.z + along * dirZ - lat * dirX;
        }
        for (const b of cell.boxes) {
          if (b.h < 0.5) continue;
          const m = 0.3;
          if (x < b.minX - m || x > b.maxX + m || z < b.minZ - m || z > b.maxZ + m) continue;
          // out through the nearest side
          const l = x - (b.minX - m), r = b.maxX + m - x, n = z - (b.minZ - m), f = b.maxZ + m - z, k = Math.min(l, r, n, f);
          if (k === l) x -= l; else if (k === r) x += r; else if (k === n) z -= n; else z += f;
        }
      }
      p.x = x; p.z = z;
      // turn smoothly toward the walking direction
      let turn = Math.atan2(dirX, dirZ) - p.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      p.heading += turn * Math.min(1, dt * 7);
      if (walking) p.phase += Math.max(p.speed, 1.2) * dt * 4.4; // one full leg swing every 1.4 m

      p.y = L.groundHeight(x, z);
      // lean: 0 = standing .. 1.45 = lying on the back (falls fast, lies, gets up slowly)
      let lean = 0, hop = 0;
      if (p.fall > 0) { const t = 3 - p.fall; lean = 1.45 * (t < 0.3 ? t / 0.3 : p.fall < 0.8 ? p.fall / 0.8 : 1); p.heading = p.fallDir; }
      else if (p.jump > 0) hop = Math.sin((p.jump / 0.36) * Math.PI) * 0.28;
      const c = Math.cos(p.heading) * p.size, sn = Math.sin(p.heading) * p.size;
      const cl = Math.cos(lean), sl = Math.sin(lean);
      m[o] = c * p.wide; m[o + 1] = 0; m[o + 2] = -sn * p.wide; m[o + 3] = 0;
      m[o + 4] = -sl * sn; m[o + 5] = cl * p.size; m[o + 6] = -sl * c; m[o + 7] = 0;
      m[o + 8] = cl * sn; m[o + 9] = sl * p.size; m[o + 10] = cl * c; m[o + 11] = 0;
      m[o + 12] = x; m[o + 13] = p.y + hop + sl * 0.12; m[o + 14] = z; m[o + 15] = 1;
      ph[i] = walking ? p.phase : 0;
    }
    // (only up to the last person who is out: the empty places are not drawn at all)
    mesh.count = top;
    mesh.instanceMatrix.needsUpdate = true;
    phaseAttr.needsUpdate = true;
  }

  // the walls, poles, trees, benches and parked cars of the city (cityBuilder gives the grid once it is made)
  let grid = null;

  return {
    people, mesh, loops, update,
    setColliders(g) { grid = g; },
    get wanted() { return wanted; },
    takeKnocked() { const k = knocked; knocked = 0; return k; },
    // story: at most n people (Infinity = as many as the quality level allows)
    setCap(n, now = false) { cap = n; capNow = now; },
    setQuality(q) {
      baseCount = Math.min(MAX, q.people ?? 60);
      for (let i = baseCount; i < MAX; i++) people[i].alive = false;
    },
  };
}
