// ---------------------------------------------------------------------------
// docks.js - builds RUSTWATER DOCKS, the port of Chapter 5 (the plan is in
// layout.js, "docks"): east of Neon Mile, along the coast, past the highway.
//
//   * Wet concrete, oil stains, puddles, tire marks; Dock Road with its gate.
//   * Two container yards: stacks of shipping containers (rusted red, blue,
//     grey ...) two to four high, aisles between the rows and short cross
//     aisles (the ways a chase can take). Yard B is watched: a fence, floodlights.
//   * Cranes: four big ship-to-shore cranes on the quay, and one gantry crane in
//     each yard that drives up and down its row - its legs close the aisles for
//     a while (a moving obstacle: wait for the gap or go around).
//   * The channel from the sea into the port, with a slip at its end where a
//     boat can be left. Two cargo ships at the quay (they bob gently). A pier.
//   * North of the road: rail tracks with wagons, two warehouses, the covered
//     smuggler market, the fuel depot, and Rask's building - the back warehouse
//     on the ground floor and his office above it, its window over the yards.
//   * Small future touches: autonomous carriers that bring containers along the
//     quay, drone loaders over the ships, green tracking tags on containers.
//
// Everything that does not move goes into the shared mesh builders of the city
// (no extra draw calls). Extra draw calls: the containers (2 + their tags), the
// fence panels, the two yard cranes, the two ships, the channel water, the
// office glass, and the few moving machines near the player.
//
// buildDocks(ctx) returns the object the game uses at run time: update() moves
// the cranes, ships and machines; dockNear() finds where to leave a boat; the
// yard cranes give their legs to the collision list every frame.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RNG } from '../utils/math.js';
import { InstancedSet, MeshBuilder, mergeParts } from '../utils/geometry.js';
import { addDecal, addMark } from './ground.js';
import { MARK } from './textures.js';
import { shared } from './materials.js';
import * as M from './models.js';

const T = CONFIG.textures;
const lin = M.lin;
// colors (linear)
const COL = {
  steel: [0.2, 0.21, 0.22], dark: [0.045, 0.048, 0.052], rust: [0.2, 0.075, 0.035], rust2: [0.3, 0.12, 0.05],
  craneRed: [0.4, 0.07, 0.035], craneBlue: [0.05, 0.13, 0.28], white: [0.62, 0.63, 0.62], cream: [0.55, 0.52, 0.44],
  yellow: [0.62, 0.42, 0.03], black: [0.018, 0.018, 0.02], rubber: [0.025, 0.025, 0.028], orange: [0.62, 0.19, 0.03],
  wood: [0.17, 0.11, 0.065], wood2: [0.23, 0.16, 0.1], glass: [0.02, 0.03, 0.04], concrete: [0.4, 0.4, 0.38], gravel: [0.16, 0.15, 0.14],
  warm: [1.0, 0.6, 0.28], cold: [0.85, 0.92, 1.0], red: [0.5, 0.04, 0.03], green: [0.05, 0.26, 0.1], blueTarp: [0.04, 0.12, 0.3],
};
// container paint (linear): faded red, rust, blue, grey, green, orange, white, teal
const CONTAINER_COLORS = [
  [0.3, 0.055, 0.035], [0.26, 0.07, 0.04], [0.36, 0.09, 0.04], [0.05, 0.11, 0.24], [0.06, 0.14, 0.29], [0.04, 0.08, 0.17],
  [0.3, 0.31, 0.32], [0.2, 0.21, 0.22], [0.05, 0.15, 0.09], [0.42, 0.14, 0.04], [0.56, 0.56, 0.53], [0.04, 0.17, 0.19],
];
const CH = 2.59, CW = 2.44, L40 = 12.19, L20 = 6.06;     // container height, width, lengths

// ===========================================================================
export function buildDocks(ctx) {
  const L = ctx.layout, D = L.docks, mats = ctx.mats, sets = ctx.sets;
  const rng = new RNG(5077);
  const ps = ctx.mb.propStatic, mt = ctx.mb.metal, pm = ctx.mb.plaster;
  const as = ctx.mb.asphalt, sw = ctx.mb.sidewalk, dc = ctx.mb.decal, pu = ctx.mb.puddle, mk = ctx.mb.marking;
  const boxes = ctx.colliders.boxes, circles = ctx.colliders.circles;
  const level = L.ocean.level;
  const P = D.places;

  // ---- small helpers ----
  const paint = (c, rough = 0.75, metal = 0, glow = 0) => ps.color(c[0], c[1], c[2], 1).data(rough, metal, 0, glow);
  const pbox = (x0, y0, z0, x1, y1, z1, faces = 'nsewt') => ps.box(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), 1, faces);
  const solid = (minX, maxX, minZ, maxZ, h, more = {}) => boxes.push({ minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ), h, ...more });
  // (data w = how old and dirty a wall is: stains, rust, moss. The port is old.)
  const conc = (s = 1, age = 0.7) => pm.color(0.74 * s, 0.76 * s, 0.8 * s, 1).data(0, 0, 0, age);   // (plaster -> grey concrete)
  const sheet = (c, age = 0.75) => mt.color(c[0], c[1], c[2], 1).data(0, 0, 0, age);           // corrugated metal, no windows, rusty
  // a box from point a to point b (a beam, a brace, a cable): w = width, h = height
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const bigCyl = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);      // (for tanks: 10 sides would show)
  function beam(mb, a, b, w, h) {
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _v.length();
    if (len < 1e-4) return;
    _v.divideScalar(len);
    _q.setFromUnitVectors(_z, _v);
    _m.compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(w, h, len));
    mb.addGeometry(unitBox, _m);
  }
  // an upright round post (cylinder) from y0 to y1
  function post(mb, x, z, r, y0, y1) {
    _m.compose(new THREE.Vector3(x, (y0 + y1) / 2, z), _q.identity(), _s.set(r, y1 - y0, r));
    mb.addGeometry(r > 2 ? bigCyl : unitCyl, _m);
  }

  // =========================================================================
  // 1. THE GROUND: asphalt for the road and the aprons, concrete slabs in the yards
  //    (cut into cells so nothing lies on top of something else: no flicker)
  // =========================================================================
  const FAR_E = -1500;                       // the port's concrete goes on east into the haze (as far as the city ground)
  {
    const ch = D.channel;
    const xs = new Set([FAR_E, D.maxX, ch.minX, ch.maxX]), zs = new Set([D.minZ, D.maxZ, ch.maxZ]);
    for (const y of D.yards) { xs.add(y.minX); xs.add(y.maxX); zs.add(y.minZ); zs.add(y.maxZ); }
    const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
    as.color(0.9, 0.9, 0.9, 1);
    sw.color(0.86, 0.86, 0.85, 1);
    for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) {
      const x0 = X[i], x1 = X[i + 1], z0 = Z[j], z1 = Z[j + 1], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (cx > ch.minX && cx < ch.maxX && cz < ch.maxZ) continue;                     // the channel: water
      const yard = D.yards.some((y) => cx > y.minX && cx < y.maxX && cz > y.minZ && cz < y.maxZ);
      (yard ? sw : as).groundRect(x0, z0, x1, z1, 0, yard ? T.sidewalk.size * 1.6 : T.asphalt.size);
    }
  }

  // =========================================================================
  // 2. THE QUAY WALL along the sea, the channel and its slip
  // =========================================================================
  const ch = D.channel;
  {
    const wallTop = 0, wallBot = -7.5;
    conc(0.86);
    // the quay face toward the sea (not across the mouth of the channel)
    const pr = D.pier;
    for (const [x0, x1] of [[FAR_E, ch.minX], [ch.maxX, D.maxX]]) pm.box(x0, wallBot, D.minZ - 0.6, x1, wallTop, D.minZ, T.plaster.size, 'st');
    // (the edge and the curb have a gap where the pier starts)
    for (const [x0, x1] of [[FAR_E, ch.minX], [ch.maxX, pr.minX], [pr.maxX, D.maxX]]) {
      // the steel edge on top of the quay, and a low curb that stops cars
      paint(COL.dark, 0.5, 0.7); pbox(x0, -0.02, D.minZ - 0.6, x1, 0.06, D.minZ - 0.45);
      conc(0.7); pm.box(x0, 0, D.minZ, x1, 0.28, D.minZ + 0.45, T.plaster.size, 'nst');
      solid(x0, x1, D.minZ - 0.6, D.minZ + 0.45, 0.6);
      conc(0.86);
    }
    // the beach of Neon Mile ends at a low retaining wall: the port is a step higher
    conc(0.8); pm.box(D.maxX - 0.6, -2.2, D.minZ - 0.6, D.maxX, 0.32, L.beach.maxZ, T.plaster.size, 'wtn');
    paint([0.42, 0.43, 0.43], 0.5, 0.7);
    for (let z = D.minZ + 1; z < L.beach.maxZ; z += 2.5) pbox(D.maxX - 0.34, 0.32, z - 0.03, D.maxX - 0.26, 1.3, z + 0.03);
    pbox(D.maxX - 0.36, 1.25, D.minZ, D.maxX - 0.24, 1.33, L.beach.maxZ);
    solid(D.maxX - 0.6, D.maxX, D.minZ - 0.6, L.beach.maxZ, 1.3);
    // the channel: two walls and the end wall with the slip
    pm.box(ch.minX - 0.6, wallBot, ch.minZ, ch.minX, wallTop, ch.maxZ, T.plaster.size, 'wt');
    pm.box(ch.maxX, wallBot, ch.minZ, ch.maxX + 0.6, wallTop, ch.maxZ, T.plaster.size, 'et');
    pm.box(ch.minX - 0.6, wallBot, ch.maxZ, ch.maxX + 0.6, wallTop, ch.maxZ + 0.6, T.plaster.size, 'st');
    for (const x of [ch.minX, ch.maxX]) {
      conc(0.7); pm.box(x - (x === ch.minX ? 0.6 : 0), 0, ch.minZ, x + (x === ch.maxX ? 0.6 : 0), 0.28, ch.maxZ + 0.6, T.plaster.size, 'ewt');
      solid(x - 0.6, x + 0.6, ch.minZ, ch.maxZ + 0.6, 0.6);
    }
    // the channel walls stop boats too (and the end wall)
    solid(ch.minX - 1.6, ch.minX, ch.minZ - 0.6, ch.maxZ, 3, { boatOnly: true });
    solid(ch.maxX, ch.maxX + 1.6, ch.minZ - 0.6, ch.maxZ, 3, { boatOnly: true });
    solid(ch.minX - 1, ch.maxX + 1, ch.maxZ - 1.2, ch.maxZ + 2, 3, { boatOnly: true });
    // THE SLIP: a floating steel pontoon at the end of the channel with a ramp up to the quay
    paint(COL.steel, 0.6, 0.5); pbox(ch.minX + 2, level + 0.15, ch.maxZ - 3.2, ch.maxX - 2, level + 0.45, ch.maxZ - 0.3);
    paint(COL.dark, 0.7, 0.4); beam(ps, [ch.minX + 8, level + 0.45, ch.maxZ - 0.5], [ch.minX + 8, 0.05, ch.maxZ + 0.4], 2.2, 0.12);
    paint(COL.yellow, 0.6, 0.2); for (const x of [ch.minX + 2.2, ch.maxX - 2.2]) pbox(x - 0.05, level + 0.45, ch.maxZ - 3.2, x + 0.05, level + 1.4, ch.maxZ - 0.3);
    // rubber fenders on the quay face and the channel walls, bollards on top
    paint(COL.rubber, 0.95, 0);
    for (let x = FAR_E + 10; x < D.maxX - 4; x += 9) {
      if ((x > ch.minX - 2 && x < ch.maxX + 2) || (x > pr.minX - 2 && x < pr.maxX + 2)) continue;
      post(ps, x, D.minZ - 0.9, 0.45, -1.8, -0.35);
    }
    for (let z = ch.minZ + 5; z < ch.maxZ - 5; z += 8) { post(ps, ch.minX + 0.35, z, 0.4, -1.8, -0.4); post(ps, ch.maxX - 0.35, z, 0.4, -1.8, -0.4); }
    const bollard = new InstancedSet('bollard', mergeParts([
      { geom: new THREE.CylinderGeometry(0.22, 0.26, 0.55, 10), pos: [0, 0.28, 0], color: COL.dark, rough: 0.6, metal: 0.6 },
      { geom: new THREE.CylinderGeometry(0.32, 0.3, 0.1, 10), pos: [0, 0.6, 0], color: COL.dark, rough: 0.6, metal: 0.6 },
    ]), mats.prop, { maxDistance: 160 });
    sets.dockBollard = bollard;
    for (let x = FAR_E + 14; x < D.maxX - 6; x += 12) {
      if ((x > ch.minX - 3 && x < ch.maxX + 3) || (x > pr.minX - 3 && x < pr.maxX + 3)) continue;
      bollard.add(x, 0, D.minZ + 0.9, 0);
      circles.push({ x, z: D.minZ + 0.9, r: 0.3 });
    }
  }

  // =========================================================================
  // 3. CONTAINERS: two shapes (40 ft and 20 ft), one draw call each; the color
  //    comes with every copy. The metal shader draws the ribs and the rust.
  // =========================================================================
  function containerGeo(len) {
    const mb = new MeshBuilder();
    const hl = len / 2, hw = CW / 2;
    mb.color(1, 1, 1, 1).data(0, 0, 0, 0.62);           // (w: old paint - the shader adds rust and faded patches)
    mb.box(-hl, 0, -hw, hl, CH, hw, 1, 'nsewt');
    // the doors at the +x end: four locking bars and a frame
    mb.color(0.78, 0.78, 0.78, 1);
    for (const z of [-0.88, -0.32, 0.32, 0.88]) mb.box(hl, 0.18, z - 0.03, hl + 0.05, CH - 0.18, z + 0.03, 1, 'nsewt');
    mb.box(hl, CH - 0.2, -hw, hl + 0.04, CH, hw, 1, 'nsewt');
    mb.box(hl, 0, -hw, hl + 0.04, 0.18, hw, 1, 'nsewt');
    // corner castings (darker), the rails along the top and the bottom
    mb.color(0.42, 0.42, 0.42, 1);
    for (const x of [-hl - 0.01, hl - 0.17]) for (const z of [-hw - 0.01, hw - 0.15]) for (const y of [0, CH - 0.12]) mb.box(x, y, z, x + 0.18, y + 0.12, z + 0.16, 1, 'nsewt');
    mb.color(0.7, 0.7, 0.7, 1);
    for (const z of [-hw - 0.025, hw]) { mb.box(-hl, 0, z, hl, 0.17, z + 0.025, 1, 'nsewt'); mb.box(-hl, CH - 0.14, z, hl, CH, z + 0.025, 1, 'nsewt'); }
    return mb.build(true);
  }
  // near the player the detailed containers (doors, bars, corner castings); every container also has a plain
  // box, a hair smaller, for far away (hidden inside the detailed one when that one is drawn)
  const c40 = new InstancedSet('container40', containerGeo(L40), mats.metal, { useColor: true, maxDistance: 150 });
  const c20 = new InstancedSet('container20', containerGeo(L20), mats.metal, { useColor: true, maxDistance: 150 });
  const plainGeo = (len) => { const mb = new MeshBuilder(); mb.color(1, 1, 1, 1).data(0, 0, 0, 0.62); mb.box(-len / 2 + 0.03, 0.01, -CW / 2 + 0.03, len / 2 - 0.03, CH - 0.03, CW / 2 - 0.03, 1, 'nsewt'); return mb.build(true); };
  const f40 = new InstancedSet('container40far', plainGeo(L40), mats.metal, { useColor: true, maxDistance: 1400 });
  const f20 = new InstancedSet('container20far', plainGeo(L20), mats.metal, { useColor: true, maxDistance: 1400 });
  sets.container40far = f40; sets.container20far = f20;
  // the green tracking tags (they glow a little in the dark)
  const tagGeo = new THREE.PlaneGeometry(0.34, 0.2);
  const tagMat = new THREE.MeshBasicMaterial({ color: 0x38ff8c, fog: true, toneMapped: false });
  const tags = new InstancedSet('containerTag', tagGeo, tagMat, { maxDistance: 220, castShadow: false, receiveShadow: false });
  sets.container40 = c40; sets.container20 = c20; sets.containerTag = tags;
  const pickColor = () => rng.pick(CONTAINER_COLORS);
  // one container: x, z = middle of its floor, y = floor height, rot = turn (radians), long = 40 ft
  function container(x, y, z, rot, long = true, color = null) {
    const k = color || pickColor(), f = rng.range(0.82, 1.08), c = [k[0] * f, k[1] * f, k[2] * f];
    (long ? c40 : c20).add(x, y, z, rot, 1, c);
    (long ? f40 : f20).add(x, y, z, rot, 1, c);
    if (rng.chance(0.38)) {
      // the tag sits on a long side near the doors (+x end in the container's own frame), at chest height
      const hl = (long ? L40 : L20) / 2 - 0.9, side = rng.chance(0.5) ? 1 : -1;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const lx = hl, lz = side * (CW / 2 + 0.03);
      tags.add(x + lx * cr + lz * sr, y + 1.55, z - lx * sr + lz * cr, rot + (side > 0 ? 0 : Math.PI));
    }
  }
  // a line of stacks along x from x0 to x1 at z: heights between lo and hi containers
  function stackLine(x0, x1, z, lo, hi, rot = 0) {
    let x = x0, top = 0;
    while (x + L20 <= x1 + 0.01) {
      const room = x1 - x;
      const long = room >= L40 && !rng.chance(0.14);
      const len = long ? L40 : L20;
      const n = rng.int(lo, hi);
      const cx = x + len / 2;
      for (let k = 0; k < n; k++) container(cx + rng.range(-0.05, 0.05), k * CH, z + rng.range(-0.04, 0.04), rot + (rng.chance(0.5) ? Math.PI : 0) + rng.range(-0.006, 0.006), long);
      top = Math.max(top, n);
      x += len + 0.28;
    }
    return top;
  }
  // the yards: blocks of two lines, cut by the cross aisles
  const yardInfo = [];
  for (const Y of D.yards) {
    const cuts = [...Y.cuts].sort((a, b) => a - b);
    const segs = [];
    let a = Y.minX;
    for (const c of cuts) { segs.push([a, c - 4]); a = c + 4; }
    segs.push([a, Y.maxX]);
    for (const rz of Y.rows) {
      for (const [x0, x1] of segs) {
        for (const off of [-1.3, 1.3]) {
          const top = stackLine(x0 + 0.6, x1 - 0.6, rz + off, Y.watched ? 2 : 1, 4);
          solid(x0 + 0.4, x1 - 0.4, rz + off - CW / 2 - 0.05, rz + off + CW / 2 + 0.05, top * CH + 0.1);
        }
      }
    }
    yardInfo.push({ Y, segs });
    // painted lanes in the aisles and the slot lines of the stacks
    const yel = [0.9, 0.68, 0.16], wht = [0.92, 0.92, 0.9];
    for (let i = 0; i < Y.rows.length - 1; i++) {
      const zc = (Y.rows[i] + Y.rows[i + 1]) / 2;
      addMark(mk, Y.minX + 1, zc, Y.maxX - 1, zc, 0.16, MARK.dashed, 8, yel, 0.6);
    }
    for (const rz of Y.rows) for (const zz of [rz - 2.7, rz + 2.7]) addMark(mk, Y.minX + 0.5, zz, Y.maxX - 0.5, zz, 0.12, MARK.solid, 6, wht, 0.45);
    // oil, tire marks and water in the aisles
    for (let k = 0; k < 26; k++) {
      const x = rng.range(Y.minX + 4, Y.maxX - 4);
      const zi = rng.int(0, Y.rows.length - 2), z = (Y.rows[zi] + Y.rows[zi + 1]) / 2 + rng.range(-2.4, 2.4);
      if (rng.chance(0.45)) addDecal(dc, rng.pick(['oil1', 'oil2', 'leak']), x, z, rng.range(1.2, 3), rng.range(1, 2.6), rng.range(0, 6.28), 0.02, rng.range(0.6, 0.95));
      else if (rng.chance(0.6)) addDecal(dc, 'skid', x, z, rng.range(6, 14), 1.6, rng.range(-0.15, 0.15) + (rng.chance(0.5) ? 0 : Math.PI), 0.021, rng.range(0.35, 0.7));
      else addDecal(pu, rng.pick(['blob', 'oil1', 'oil2']), x, z, rng.range(1.6, 3.6), rng.range(1.2, 2.8), rng.range(0, 6.28), 0.019, rng.range(0.8, 1));
    }
  }
  // a few loose containers on the aprons, along the north fence and east of the port (the far yards)
  for (let x = -880; x < -770; x += 13.2) container(x, 0, -306.5, 0, true);
  for (let x = -880; x < -800; x += 13.2) container(x + 2, CH, -306.5, 0, true);
  for (const [x, z, r] of [[-640, -464.5, 0], [-628, -464.5, 0], [-760, -464.5, 0.02], [-530, -410, Math.PI / 2], [-700, -380, 0], [-860, -409, 0.03]]) container(x, 0, z, r, rng.chance(0.7));
  for (let row = 0; row < 7; row++) {
    const z = -455 + row * 9;
    stackLine(-1150, -920, z - 1.3, 1, 4);
    stackLine(-1150, -920, z + 1.3, 1, 4);
  }

  // =========================================================================
  // 4. CRANES. Ship-to-shore cranes on the quay (they do not move), and a
  //    gantry crane in each yard (built here, moved in update()).
  // =========================================================================
  const QL = D.minZ + 14, QS = D.minZ + 1.6;            // the land and the sea rail of the quay cranes
  function quayCrane(x, color) {
    const H = 30, boomY = 36, back = QL + 18, tip = D.minZ - 44;
    paint(color, 0.55, 0.45);
    // four legs and the portal beams between them
    for (const lx of [x - 8, x + 8]) for (const lz of [QL, QS]) { pbox(lx - 0.7, 0.5, lz - 0.7, lx + 0.7, H, lz + 0.7); circles.push({ x: lx, z: lz, r: 1.1 }); }
    for (const lz of [QL, QS]) pbox(x - 8.7, H - 1.6, lz - 0.7, x + 8.7, H, lz + 0.7);
    for (const lx of [x - 8, x + 8]) { pbox(lx - 0.7, H - 1.6, QS - 0.7, lx + 0.7, H, QL + 0.7); beam(ps, [lx, 2, QL], [lx, H - 2, QS], 0.45, 0.45); }
    pbox(x - 8.7, 14, QL - 0.5, x + 8.7, 15, QL + 0.5);
    pbox(x - 8.7, 14, QS - 0.5, x + 8.7, 15, QS + 0.5);
    // bogies (the wheel sets on the rails)
    paint(COL.dark, 0.6, 0.5);
    for (const lx of [x - 8, x + 8]) for (const lz of [QL, QS]) pbox(lx - 2.2, 0, lz - 0.9, lx + 2.2, 0.9, lz + 0.9);
    // the boom: two chords from the back to far over the water, with braces
    paint(color, 0.55, 0.45);
    for (const bx of [x - 2.2, x + 2.2]) {
      pbox(bx - 0.35, boomY - 0.9, tip, bx + 0.35, boomY, back);
      pbox(bx - 0.3, boomY + 2.2, tip + 8, bx + 0.3, boomY + 2.8, back);
      for (let z = tip + 8; z < back - 4; z += 7) beam(ps, [bx, boomY, z], [bx, boomY + 2.5, z + 3.5], 0.2, 0.2);
    }
    for (let z = tip; z < back; z += 6) pbox(x - 2.5, boomY - 0.9, z - 0.2, x + 2.5, boomY - 0.6, z + 0.2);
    // the A-frame on top and the stays to the boom
    for (const bx of [x - 6, x + 6]) { beam(ps, [bx, H, QL], [x, boomY + 16, (QL + QS) / 2], 0.6, 0.6); beam(ps, [bx, H, QS], [x, boomY + 16, (QL + QS) / 2], 0.6, 0.6); }
    for (const bx of [x - 2.2, x + 2.2]) { beam(ps, [x, boomY + 16, (QL + QS) / 2], [bx, boomY + 1, tip + 4], 0.18, 0.18); beam(ps, [x, boomY + 16, (QL + QS) / 2], [bx, boomY + 1, back - 2], 0.18, 0.18); }
    // the machine house at the back, the driver's cabin and trolley out over the ship
    paint(COL.white, 0.6, 0.2); pbox(x - 4, boomY, back - 9, x + 4, boomY + 5, back);
    paint(COL.glass, 0.1, 0.4); pbox(x - 4.02, boomY + 3, back - 8, x + 4.02, boomY + 4, back - 1);
    const tz = D.minZ - 20;
    paint(COL.dark, 0.5, 0.6); pbox(x - 2.6, boomY - 1.8, tz - 2, x + 2.6, boomY - 0.9, tz + 2);
    paint(COL.white, 0.5, 0.3); pbox(x - 1.2, boomY - 4.2, tz - 1.4, x + 1.4, boomY - 1.8, tz + 1.2);
    paint(COL.glass, 0.1, 0.4); pbox(x - 1.22, boomY - 3.6, tz - 1.42, x + 1.42, boomY - 2.4, tz - 1.2);
    // cables down to the spreader over the ship
    paint(COL.dark, 0.4, 0.8);
    const sy = 16;
    for (const ox of [-1.1, 1.1]) for (const oz of [-0.9, 0.9]) beam(ps, [x + ox, boomY - 1.8, tz + oz], [x + ox * 2.4, sy + 0.6, tz + oz * 0.6], 0.04, 0.04);
    paint(COL.yellow, 0.6, 0.3); pbox(x - 6, sy, tz - 1.2, x + 6, sy + 0.6, tz + 1.2);
    // a red warning light on top (always lit)
    paint([1, 0.1, 0.05], 0.4, 0, 1.6); pbox(x - 0.25, boomY + 16, (QL + QS) / 2 - 0.25, x + 0.25, boomY + 16.5, (QL + QS) / 2 + 0.25);
    // rails on the quay
    paint(COL.dark, 0.5, 0.8);
  }
  for (const [i, x] of D.quayCranes.entries()) quayCrane(x, i % 2 ? COL.craneBlue : COL.craneRed);
  paint(COL.dark, 0.5, 0.8);
  for (const lz of [QL, QS]) for (const [x0, x1] of [[FAR_E, ch.minX - 1], [ch.maxX + 1, D.maxX - 2]]) for (const o of [-0.4, 0.4]) pbox(x0, 0, lz + o - 0.04, x1, 0.05, lz + o + 0.04, 'nsewt');

  // the YARD GANTRY CRANES (one per yard): a frame over one row of stacks, its legs in the aisles on both sides
  const gantries = [];
  function makeGantry(color) {
    const parts = [];
    const H = 19, sz = 6.2, sx = 4.6;           // height, half span across the row, half length along the row
    for (const lx of [-sx, sx]) for (const lz of [-sz, sz]) {
      parts.push({ geom: new THREE.BoxGeometry(0.9, H, 0.9), pos: [lx, H / 2 + 0.9, lz], color, rough: 0.55, metal: 0.4 });
      parts.push({ geom: new THREE.BoxGeometry(2.6, 0.9, 1.6), pos: [lx, 0.6, lz], color: COL.dark, rough: 0.7, metal: 0.4 });
      parts.push({ geom: new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), pos: [lx - 0.8, 0.55, lz], rot: [Math.PI / 2, 0, 0], color: COL.rubber, rough: 0.9, metal: 0 });
      parts.push({ geom: new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), pos: [lx + 0.8, 0.55, lz], rot: [Math.PI / 2, 0, 0], color: COL.rubber, rough: 0.9, metal: 0 });
    }
    for (const lz of [-sz, sz]) parts.push({ geom: new THREE.BoxGeometry(sx * 2 + 0.9, 1.1, 0.9), pos: [0, H + 0.4, lz], color, rough: 0.55, metal: 0.4 });
    for (const lx of [-sx, sx]) parts.push({ geom: new THREE.BoxGeometry(0.9, 1.4, sz * 2 + 0.9), pos: [lx, H + 1.4, 0], color, rough: 0.55, metal: 0.4 });
    parts.push({ geom: new THREE.BoxGeometry(2.2, 2.2, 2.4), pos: [-sx + 1.2, H - 2, sz - 1.4], color: COL.white, rough: 0.5, metal: 0.2 });         // the cabin
    parts.push({ geom: new THREE.BoxGeometry(2.24, 0.9, 2.44), pos: [-sx + 1.2, H - 1.6, sz - 1.4], color: COL.glass, rough: 0.1, metal: 0.4 });
    parts.push({ geom: new THREE.BoxGeometry(3.2, 1.4, 3.2), pos: [0, H + 2.6, 0], color: COL.dark, rough: 0.6, metal: 0.5 });             // the trolley
    parts.push({ geom: new THREE.BoxGeometry(0.5, 0.5, 0.5), pos: [sx, H + 2.4, sz], color: [1, 0.55, 0.05], rough: 0.4, metal: 0, glow: 1.4 }); // amber beacon
    const frame = new THREE.Mesh(mergeParts(parts), mats.prop);
    // the spreader with its container hangs from the trolley (moved up and down in update)
    const hang = new THREE.Mesh(mergeParts([
      { geom: new THREE.BoxGeometry(L40 + 0.4, 0.5, 2.6), pos: [0, CH + 0.25, 0], color: COL.yellow, rough: 0.6, metal: 0.3 },
      { geom: new THREE.BoxGeometry(L40, CH, CW), pos: [0, CH / 2, 0], color: CONTAINER_COLORS[rng.int(0, CONTAINER_COLORS.length - 1)], rough: 0.7, metal: 0.4 },
    ]), mats.prop);
    const cables = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.8 }));
    const g = new THREE.Group();
    g.add(frame, hang, cables);
    hang.rotation.y = Math.PI / 2;               // the container lies across the frame (along the row)
    for (const m of [frame, hang]) { m.castShadow = true; m.receiveShadow = true; }
    return { g, hang, cables, H, sz, sx };
  }
  for (const [i, Y] of D.yards.entries()) {
    const G = makeGantry(i ? COL.craneBlue : COL.yellow);
    const row = Y.rows[1];
    // It stops over the cross aisles (nothing stands under it there): lowers its container to the ground,
    // holds it there for a while, lifts it and drives on. While the box is down, that aisle is shut.
    const stops = [Y.minX + 7, ...[...Y.cuts].sort((a, b) => a - b), Y.maxX - 7];
    const k = i ? stops.length - 2 : 1;
    const o = { ...G, row, stops, k, x: stops[k], dir: i ? -1 : 1, state: 'hold', t: 2 + i * 3, lift: 1, legs: [], box: [], boxOn: false };
    o.g.position.set(o.x, 0, row);
    ctx.group.add(o.g);
    for (let j = 0; j < 4; j++) o.legs.push({ x: 0, z: 0, r: 1.6, crane: true });
    for (let j = 0; j < 5; j++) o.box.push({ x: 0, z: 0, r: 1.3, crane: true });
    gantries.push(o);
  }

  // =========================================================================
  // 5. BUILDINGS: warehouses, Rask's building with his office, the market,
  //    the fuel depot, the gate booth
  // =========================================================================
  // a corrugated metal shed: rect, height, tint; doors: list of [x0, x1] roller doors on the south face
  function shed(r, h, tint, doors = []) {
    sheet(tint);
    mt.box(r.minX, 0, r.minZ, r.maxX, h, r.maxZ, 1, 'nsew');
    // the roof (a low pitch), overhanging a little, darker metal
    paint(COL.steel, 0.7, 0.5);
    const mid = (r.minZ + r.maxZ) / 2;
    for (const [z0, z1] of [[r.minZ - 0.6, mid], [mid, r.maxZ + 0.6]]) {
      const y0 = z0 < mid ? h : h + 1.6, y1 = z0 < mid ? h + 1.6 : h;
      ps.quad([r.minX - 0.5, y0, z0], [r.minX - 0.5, y1, z1], [r.maxX + 0.5, y1, z1], [r.maxX + 0.5, y0, z0], [0, 1, 0], [0, 0], [0, 1], [1, 1], [1, 0]);
    }
    sheet([tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9]);
    // the two gable ends (triangles; triAuto turns them to face out)
    for (const x of [r.minX, r.maxX]) mt.triAuto([x, h, r.minZ], [x, h, r.maxZ], [x, h + 1.6, mid], [x === r.maxX ? 1 : -1, 0, 0]);
    // a strip of high windows along the south face
    paint(COL.glass, 0.12, 0.3);
    for (let x = r.minX + 2; x < r.maxX - 3; x += 5) pbox(x, h - 2.4, r.minZ - 0.04, x + 3, h - 1.2, r.minZ, 's');
    // roller doors with their frames, and a loading dock in front of each
    for (const [x0, x1] of doors) {
      paint([0.3, 0.31, 0.3], 0.6, 0.5);
      pbox(x0, 0, r.minZ - 0.12, x1, 5.2, r.minZ, 's');
      paint(COL.dark, 0.6, 0.5);
      for (let y = 0.3; y < 5.1; y += 0.32) pbox(x0, y, r.minZ - 0.14, x1, y + 0.04, r.minZ - 0.12, 's');
      paint(COL.yellow, 0.6, 0.2);
      pbox(x0 - 0.3, 0, r.minZ - 0.3, x0, 5.5, r.minZ, 'nsewt'); pbox(x1, 0, r.minZ - 0.3, x1 + 0.3, 5.5, r.minZ, 'nsewt');
      paint(COL.rubber, 0.9, 0); pbox(x0 + 0.4, 0.4, r.minZ - 0.32, x0 + 0.9, 1.1, r.minZ - 0.12); pbox(x1 - 0.9, 0.4, r.minZ - 0.32, x1 - 0.4, 1.1, r.minZ - 0.12);
      // a lamp over the door (warm, lit at night)
      paint(COL.warm, 0.4, 0, 0.9); pbox((x0 + x1) / 2 - 0.4, 5.8, r.minZ - 0.5, (x0 + x1) / 2 + 0.4, 6.0, r.minZ - 0.1);
      ctx.lamps.push({ x: (x0 + x1) / 2, y: 6, z: r.minZ - 1, type: 0, h: 6, pool: 0.6, size: 1.0, power: 0.3 });
    }
    solid(r.minX, r.maxX, r.minZ, r.maxZ, h);
  }
  for (const w of D.warehouses) {
    const doors = [];
    for (let x = w.minX + 6; x < w.maxX - 9; x += 17) doors.push([x, x + 7]);
    shed(w, w.h, w.id === 'w1' ? [0.5, 0.52, 0.54] : [0.36, 0.42, 0.48], doors);
    // a steel walkway along the south face up at the windows, and its stairs
    paint(COL.steel, 0.6, 0.6);
    pbox(w.minX + 1, 6.6, w.minZ - 1.5, w.maxX - 1, 6.75, w.minZ - 0.1);
    for (let x = w.minX + 1; x <= w.maxX - 1; x += 2.5) pbox(x - 0.04, 6.75, w.minZ - 1.5, x + 0.04, 7.8, w.minZ - 1.42);
    pbox(w.minX + 1, 7.75, w.minZ - 1.52, w.maxX - 1, 7.85, w.minZ - 1.4);
    for (let i = 0; i < 24; i++) { const x = w.maxX + 9.6 - i * 0.4; pbox(x - 0.4, 0.275 * (i + 1) - 0.06, w.minZ - 1.5, x, 0.275 * (i + 1), w.minZ - 0.3); }   // the stairs up to it (east end)
    beam(ps, [w.maxX + 9.6, 0.1, w.minZ - 1.5], [w.maxX + 0.2, 6.7, w.minZ - 1.5], 0.06, 0.06);
  }

  // ---- RASK'S BUILDING: the back warehouse below, the office above (hollow: the story films inside) ----
  const R = D.rask, O = R.office;
  {
    const t = 0.35, h = R.h;
    // ground floor walls: concrete; the upper part corrugated metal. The south face has the big roller door
    // (into the back warehouse) and, upstairs, the office window.
    const door = [-846, -830];
    conc(0.82);
    // north, east and west walls of the hall (inside and outside faces)
    pm.box(R.minX, 0, R.maxZ - t, R.maxX, 6.2, R.maxZ, T.plaster.size, 'nst');
    pm.box(R.minX, 0, R.minZ, R.minX + t, 6.2, R.maxZ, T.plaster.size, 'ewt');
    pm.box(R.maxX - t, 0, R.minZ, R.maxX, 6.2, R.maxZ, T.plaster.size, 'ewt');
    // south wall with the door opening
    pm.box(R.minX, 0, R.minZ, door[0], 6.2, R.minZ + t, T.plaster.size, 'nset');
    pm.box(door[1], 0, R.minZ, R.maxX, 6.2, R.minZ + t, T.plaster.size, 'nswt');
    pm.box(door[0], 5.2, R.minZ, door[1], 6.2, R.minZ + t, T.plaster.size, 'nsb');
    // upper walls (metal), with the office window band on the south face
    const up = [0.3, 0.32, 0.33];
    sheet(up);
    mt.box(R.minX, 6.2, R.maxZ - t, R.maxX, h, R.maxZ, 1, 'ns');
    mt.box(R.minX, 6.2, R.minZ, R.minX + t, h, R.maxZ, 1, 'ew');
    mt.box(R.maxX - t, 6.2, R.minZ, R.maxX, h, R.maxZ, 1, 'ew');
    mt.box(R.minX, 6.2, R.minZ, O.minX, h, R.minZ + t, 1, 'ns');
    mt.box(O.maxX, 6.2, R.minZ, R.maxX, h, R.minZ + t, 1, 'ns');
    mt.box(O.minX, 6.2, R.minZ, O.maxX, 7.3, R.minZ + t, 1, 'ns');           // below the window
    mt.box(O.minX, 9.4, R.minZ, O.maxX, h, R.minZ + t, 1, 'ns');             // above it
    // mullions of the window band, and the glass (its own see-through mesh, below)
    paint(COL.dark, 0.5, 0.6);
    for (let x = O.minX; x <= O.maxX + 0.01; x += 3) pbox(x - 0.07, 7.3, R.minZ - 0.02, x + 0.07, 9.4, R.minZ + t);
    // the roof
    paint(COL.steel, 0.7, 0.5);
    pbox(R.minX - 0.4, h, R.minZ - 0.4, R.maxX + 0.4, h + 0.25, R.maxZ + 0.4);
    // the hall: floor (concrete inside), the ceiling under the office, a few lamps hanging from the roof beams
    conc(0.55); pm.box(R.minX + t, 0.01, R.minZ + t, R.maxX - t, 0.02, R.maxZ - t, T.plaster.size, 't');
    paint(COL.steel, 0.6, 0.5);
    for (let x = R.minX + 6; x < R.maxX - 3; x += 10) pbox(x - 0.2, h - 0.8, R.minZ + t, x + 0.2, h - 0.4, R.maxZ - t);
    // THE OFFICE: a floor over the south part of the hall, walls, a ceiling
    paint(COL.wood2, 0.75, 0);
    pbox(O.minX, O.floor - 0.25, O.minZ + t, O.maxX, O.floor, O.maxZ);                 // the floor (wood on a slab)
    conc(1.0);
    pm.box(O.minX, O.floor, O.maxZ - 0.2, O.maxX, O.ceil, O.maxZ, T.plaster.size, 'ns');          // back wall
    pm.box(O.minX, O.floor, O.minZ + t, O.minX + 0.2, O.ceil, O.maxZ, T.plaster.size, 'ew');       // side walls
    pm.box(O.maxX - 0.2, O.floor, O.minZ + t, O.maxX, O.ceil, O.maxZ - 2.6, T.plaster.size, 'ew');
    pm.box(O.maxX - 0.2, O.floor + 2.3, O.maxZ - 2.6, O.maxX, O.ceil, O.maxZ, T.plaster.size, 'ewb'); // over the door
    conc(0.9); pm.box(O.minX, O.ceil, O.minZ + t, O.maxX, O.ceil + 0.2, O.maxZ, T.plaster.size, 'b');
    // inside the office: the desk by the window, a heavy chair, a cabinet, shelves, a lamp, a map of the docks
    const [dx, dz] = P.officeDesk;
    paint([0.12, 0.08, 0.05], 0.55, 0);
    pbox(dx - 1.1, O.floor + 0.72, dz - 0.45, dx + 1.1, O.floor + 0.78, dz + 0.45);                     // desk top
    pbox(dx - 1.05, O.floor, dz - 0.4, dx - 0.5, O.floor + 0.72, dz + 0.4);                             // drawers
    pbox(dx + 0.95, O.floor, dz - 0.4, dx + 1.05, O.floor + 0.72, dz + 0.4);
    paint([0.05, 0.05, 0.055], 0.6, 0.1);
    pbox(dx - 0.3, O.floor, dz - 1.2, dx + 0.3, O.floor + 0.48, dz - 0.65);                             // his chair: his back to the window
    pbox(dx - 0.3, O.floor + 0.48, dz - 1.2, dx + 0.3, O.floor + 1.25, dz - 1.1);
    paint([0.24, 0.25, 0.24], 0.5, 0.6);
    pbox(O.minX + 0.3, O.floor, O.maxZ - 1.0, O.minX + 1.3, O.floor + 1.4, O.maxZ - 0.25);              // filing cabinet
    paint(COL.wood, 0.7, 0);
    for (const y of [0.4, 1.0, 1.6, 2.2]) pbox(O.minX + 2, O.floor + y, O.maxZ - 0.5, O.minX + 6, O.floor + y + 0.04, O.maxZ - 0.22);
    paint([0.55, 0.5, 0.42], 0.8, 0);
    for (let k = 0; k < 12; k++) { const x = O.minX + 2.1 + k * 0.32; pbox(x, O.floor + 0.44 + (k % 4) * 0.6, O.maxZ - 0.46, x + 0.22, O.floor + 0.72 + (k % 4) * 0.6, O.maxZ - 0.26); }
    paint([0.7, 0.62, 0.45], 0.9, 0); pbox(dx - 1.6, O.floor + 1.4, O.maxZ - 0.24, dx + 1.6, O.floor + 2.8, O.maxZ - 0.2);   // the map
    // a desk lamp: a heavy round foot, a thin arm, a dark shade with the bulb glowing under it
    paint(COL.dark, 0.4, 0.7); post(ps, dx + 0.7, dz - 0.1, 0.07, O.floor + 0.78, O.floor + 0.8);
    beam(ps, [dx + 0.7, O.floor + 0.8, dz - 0.1], [dx + 0.62, O.floor + 1.18, dz - 0.18], 0.015, 0.015);
    paint([0.12, 0.16, 0.13], 0.5, 0.3); ps.add(new THREE.ConeGeometry(0.11, 0.12, 14, 1, true), dx + 0.6, O.floor + 1.16, dz - 0.2);
    paint(COL.warm, 0.4, 0, 1.6); pbox(dx + 0.58, O.floor + 1.1, dz - 0.22, dx + 0.62, O.floor + 1.12, dz - 0.18);
    // (a warm light under the ceiling: lights the office when the player is near, glows in the window at night)
    ctx.lamps.push({ x: dx, y: O.ceil - 0.4, z: dz + 2.5, type: 0, h: O.ceil - O.floor - 0.4, noPool: true, pool: 0, size: 0.7, power: 0.3, streak: 0 });
    // the steel stairs outside up to the office door (east side), and the landing
    paint(COL.steel, 0.6, 0.6);
    pbox(R.maxX + 0.2, O.floor - 0.2, O.maxZ - 3, R.maxX + 2.2, O.floor, O.maxZ + 0.2);
    for (let i = 0; i < 31; i++) { const y = O.floor - 0.2 - (i + 1) * 0.2, z = O.maxZ - 3 - (i + 1) * 0.28; pbox(R.maxX + 0.2, y - 0.05, z, R.maxX + 2.2, y, z + 0.28); }
    for (const x of [R.maxX + 0.25, R.maxX + 2.15]) beam(ps, [x, O.floor + 1, O.maxZ - 3], [x, 1, O.maxZ - 3 - 31 * 0.28], 0.06, 0.06);
    // (hollow: only its walls stop cars and people - the truck of Chapter 5 drives in through the big door)
    solid(R.minX, R.maxX, R.maxZ - t, R.maxZ, h);                  // north wall
    solid(R.minX, R.minX + t, R.minZ, R.maxZ, h);                  // the two side walls
    solid(R.maxX - t, R.maxX, R.minZ, R.maxZ, h);
    solid(R.minX, door[0], R.minZ, R.minZ + t, h);                 // the south wall, left and right of the big door
    solid(door[1], R.maxX, R.minZ, R.minZ + t, h);
    solid(R.maxX, R.maxX + 2.4, O.maxZ - 12, O.maxZ + 0.4, 2);     // the outside stairs
    // a light over the big door, and the sign
    paint(COL.warm, 0.4, 0, 1); pbox((door[0] + door[1]) / 2 - 0.5, 5.6, R.minZ - 0.5, (door[0] + door[1]) / 2 + 0.5, 5.8, R.minZ - 0.1);
    ctx.lamps.push({ x: (door[0] + door[1]) / 2, y: 6, z: R.minZ - 1, type: 0, h: 6, pool: 0.8, size: 1.1, power: 0.35 });
  }
  // the office window glass: see-through, a little green-grey
  const officeGlass = new THREE.Mesh(new THREE.PlaneGeometry(O.maxX - O.minX, 2.1), new THREE.MeshPhysicalMaterial({ color: 0x9fb2ad, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false }));
  officeGlass.position.set((O.minX + O.maxX) / 2, 8.35, R.minZ + 0.05);
  officeGlass.rotation.y = Math.PI;
  officeGlass.renderOrder = 16;
  ctx.group.add(officeGlass);

  // ---- THE COVERED SMUGGLER MARKET: a long roof on posts, stalls and goods under it, warm bulbs ----
  {
    const r = D.market, h = 5;
    paint(COL.steel, 0.6, 0.6);
    for (let x = r.minX; x <= r.maxX + 0.01; x += 8) for (const z of [r.minZ, r.maxZ]) { pbox(x - 0.15, 0, z - 0.15, x + 0.15, h, z + 0.15); circles.push({ x, z, r: 0.25 }); }
    sheet([0.36, 0.3, 0.26]);
    const mid = (r.minZ + r.maxZ) / 2;
    mt.quad([r.minX - 1, h, r.minZ - 1.5], [r.minX - 1, h + 1.4, mid], [r.maxX + 1, h + 1.4, mid], [r.maxX + 1, h, r.minZ - 1.5], [0, 1, 0], [0, 0], [0, 1], [1, 1], [1, 0]);
    mt.quad([r.minX - 1, h + 1.4, mid], [r.minX - 1, h, r.maxZ + 1.5], [r.maxX + 1, h, r.maxZ + 1.5], [r.maxX + 1, h + 1.4, mid], [0, 1, 0], [0, 0], [0, 1], [1, 1], [1, 0]);
    mt.quad([r.minX - 1, h, r.minZ - 1.5], [r.maxX + 1, h, r.minZ - 1.5], [r.maxX + 1, h + 1.4, mid], [r.minX - 1, h + 1.4, mid], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    mt.quad([r.minX - 1, h + 1.4, mid], [r.maxX + 1, h + 1.4, mid], [r.maxX + 1, h, r.maxZ + 1.5], [r.minX - 1, h, r.maxZ + 1.5], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    // two rows of stalls with an aisle between them
    const goods = [[0.5, 0.36, 0.2], [0.2, 0.25, 0.3], [0.55, 0.5, 0.42], [0.3, 0.12, 0.08], [0.15, 0.3, 0.2], [0.6, 0.45, 0.1]];
    for (const z of [r.minZ + 4, r.maxZ - 4]) {
      for (let x = r.minX + 3; x < r.maxX - 3; x += 6.5) {
        paint(COL.wood, 0.8, 0); pbox(x, 0, z - 1, x + 4.6, 0.9, z + 1);                      // the table
        // (the tea stall: the middle of its table stays free - her tin of drawings stands there. The random numbers are
        //  still drawn, so everything else in the docks stays where it was)
        const tea = z === r.minZ + 4 && r.teaX !== undefined && r.teaX > x && r.teaX < x + 4.6;
        for (let k = 0; k < 6; k++) {
          paint(rng.pick(goods), 0.8, 0); const gx = x + 0.3 + k * 0.72, top = 0.9 + rng.range(0.15, 0.45);
          if (tea && gx + 0.6 > r.teaX - 0.2 && gx < r.teaX + 1.4) continue;
          pbox(gx, 0.9, z - 0.7, gx + 0.6, top, z + 0.5);
        }
        paint(rng.pick([COL.blueTarp, [0.35, 0.08, 0.05], [0.12, 0.2, 0.12], [0.4, 0.33, 0.2]]), 0.9, 0);
        pbox(x - 0.2, 2.6, z - 1.6, x + 4.8, 2.65, z + 1.4);                                    // a tarp overhead
        paint(COL.warm, 0.4, 0, 1.1); pbox(x + 2.2, 2.2, z - 0.1, x + 2.4, 2.4, z + 0.1);       // the bulb
        ctx.lamps.push({ x: x + 2.3, y: 2.3, z, type: 0, h: 2.3, pool: 0.35, size: 0.6, power: 0.03, streak: 0 });
        solid(x, x + 4.6, z - 1, z + 1, 0.9);
      }
    }
    // crates and pallets around it
    for (let k = 0; k < 14; k++) { paint(rng.pick([COL.wood, COL.wood2]), 0.85, 0); const x = rng.range(r.minX, r.maxX), z = rng.chance(0.5) ? r.minZ - rng.range(1.5, 3) : r.maxZ + rng.range(1.5, 3); const s = rng.range(0.6, 1.1); pbox(x, 0, z, x + s, s * rng.range(0.6, 1), z + s * 0.9); }
  }

  // ---- THE FUEL DEPOT: three tanks, pipes, a pump house, a fence ----
  {
    const r = D.depot;
    const tanks = [[r.minX + 10, r.minZ + 12], [r.maxX - 10, r.minZ + 12], [r.minX + 10, r.maxZ - 10]];
    for (const [x, z] of tanks) {
      const rad = 7, h = 10.5;
      paint([0.6, 0.6, 0.58], 0.6, 0.35); post(ps, x, z, rad, 0, h);
      paint([0.52, 0.52, 0.5], 0.6, 0.35); ps.add(new THREE.ConeGeometry(rad, 1.4, 20, 1, true), x, h + 0.7, z);
      paint(COL.rust, 0.9, 0.2); post(ps, x, z, rad + 0.02, 0, 0.9);                                  // rust at the foot
      paint(COL.dark, 0.6, 0.6);
      for (let y = 0.6; y < h; y += 0.45) pbox(x + rad - 0.05, y, z - 0.25, x + rad + 0.1, y + 0.05, z + 0.25);     // ladder rungs
      pbox(x + rad + 0.08, 0, z - 0.3, x + rad + 0.14, h + 1, z - 0.24); pbox(x + rad + 0.08, 0, z + 0.24, x + rad + 0.14, h + 1, z + 0.3);
      circles.push({ x, z, r: rad + 0.3 });
    }
    paint([0.45, 0.4, 0.12], 0.6, 0.5);
    for (const [x, z] of tanks) beam(ps, [x, 1.2, z], [r.maxX - 3, 1.2, r.minZ + 3], 0.4, 0.4);
    paint(COL.white, 0.7, 0.1); pbox(r.maxX - 6, 0, r.minZ + 1, r.maxX - 1, 3, r.minZ + 5);
    solid(r.maxX - 6, r.maxX - 1, r.minZ + 1, r.minZ + 5, 3);
    paint([0.7, 0.1, 0.05], 0.6, 0.2); pbox(r.maxX - 4.5, 3, r.minZ + 0.9, r.maxX - 2.5, 3.6, r.minZ + 0.98);   // NO SMOKING plate
  }

  // ---- the gate booth on Dock Road and the barrier arms (up: the port is open) ----
  {
    const x = D.gateX, rd = D.road;
    paint(COL.white, 0.6, 0.1); pbox(x - 1.4, 0, rd.maxZ + 0.6, x + 1.4, 2.7, rd.maxZ + 3.2);
    paint(COL.glass, 0.1, 0.4); pbox(x - 1.42, 1.1, rd.maxZ + 0.58, x + 1.42, 2.2, rd.maxZ + 3.22);
    paint(COL.steel, 0.6, 0.5); pbox(x - 1.6, 2.7, rd.maxZ + 0.4, x + 1.6, 2.9, rd.maxZ + 3.4);
    solid(x - 1.4, x + 1.4, rd.maxZ + 0.6, rd.maxZ + 3.2, 2.7);
    for (const [z, s] of [[rd.minZ - 0.5, 1], [rd.maxZ + 0.3, -1]]) {
      paint(COL.dark, 0.6, 0.5); pbox(x - 0.3, 0, z - 0.3, x + 0.3, 1.1, z + 0.3);
      paint([0.8, 0.8, 0.78], 0.6, 0.1); beam(ps, [x, 1.05, z], [x - 0.4, 6.5, z + s * 0.6], 0.12, 0.12);
      paint([0.75, 0.08, 0.05], 0.6, 0.1); beam(ps, [x - 0.1, 2.6, z + s * 0.16], [x - 0.2, 4.0, z + s * 0.32], 0.13, 0.13);
      solid(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 1.1);
    }
  }

  // =========================================================================
  // 6. THE RAIL TRACKS and the wagons on them
  // =========================================================================
  {
    const x0 = FAR_E, x1 = D.fenceX - 2;
    for (const z of D.railZ) {
      paint(COL.gravel, 0.95, 0); pbox(x0, 0, z - 1.6, x1, 0.06, z + 1.6, 't');
      paint([0.12, 0.09, 0.07], 0.9, 0);
      for (let x = x0 + 0.4; x < x1; x += 0.72) pbox(x, 0.06, z - 1.3, x + 0.26, 0.17, z + 1.3, 'nsewt');
      paint(COL.steel, 0.35, 0.9);
      for (const o of [-0.72, 0.72]) pbox(x0, 0.17, z + o - 0.04, x1, 0.31, z + o + 0.04, 'nsewt');
    }
    // wagons on the north track: boxcars and flatcars with containers
    const zN = D.railZ[1];
    for (const [x, kind] of [[-560, 'box'], [-578, 'box'], [-596, 'flat'], [-760, 'flat'], [-778, 'box'], [-880, 'flat']]) {
      paint(COL.dark, 0.6, 0.6); pbox(x - 8, 0.31, zN - 1.4, x + 8, 1.4, zN + 1.4);
      for (const bx of [x - 5.5, x + 5.5]) { paint(COL.black, 0.7, 0.6); pbox(bx - 1.3, 0.31, zN - 1.1, bx + 1.3, 1.0, zN + 1.1); }
      if (kind === 'box') {
        sheet(rng.pick([[0.35, 0.1, 0.06], [0.24, 0.2, 0.15], [0.12, 0.17, 0.22]]));
        mt.box(x - 8, 1.4, zN - 1.5, x + 8, 4.6, zN + 1.5, 1, 'nsewt');
        paint(COL.dark, 0.6, 0.6); for (const s of [-1.52, 1.5]) pbox(x - 1.8, 1.5, zN + s, x + 1.8, 4.3, zN + s + 0.02);
      } else { container(x, 1.4, zN, 0, true); }
      solid(x - 8, x + 8, zN - 1.5, zN + 1.5, 4.6);
    }
  }

  // =========================================================================
  // 7. THE PIER: a long deck on piles, railings, lamps, a hut at the end
  // =========================================================================
  {
    const p = D.pier, y = p.deck;
    paint(COL.wood2, 0.85, 0); pbox(p.minX, y - 0.3, p.minZ, p.maxX, y, p.maxZ);
    paint([0.12, 0.08, 0.05], 0.9, 0);
    for (let z = p.minZ + 0.6; z < p.maxZ; z += 0.9) pbox(p.minX, y - 0.001, z, p.maxX, y + 0.005, z + 0.06, 't');
    paint([0.1, 0.09, 0.08], 0.9, 0);
    for (let z = p.minZ + 1; z < p.maxZ; z += 6) for (const x of [p.minX + 0.3, p.maxX - 0.3]) post(ps, x, z, 0.22, -7, y);
    paint(COL.steel, 0.6, 0.6);
    for (const x of [p.minX + 0.05, p.maxX - 0.05]) {
      for (let z = p.minZ; z <= p.maxZ; z += 2.5) pbox(x - 0.04, y, z - 0.04, x + 0.04, y + 1.05, z + 0.04);
      pbox(x - 0.05, y + 1.0, p.minZ, x + 0.05, y + 1.08, p.maxZ);
      pbox(x - 0.03, y + 0.5, p.minZ, x + 0.03, y + 0.55, p.maxZ);
      solid(x - 0.1, x + 0.1, p.minZ, p.maxZ, 1.1);
    }
    // the hut at the end, and lamps along the pier
    paint([0.3, 0.35, 0.36], 0.8, 0.1); pbox(p.minX + 0.3, y, p.minZ + 0.5, p.maxX - 0.3, y + 2.4, p.minZ + 3.4);
    paint(COL.steel, 0.7, 0.4); pbox(p.minX, y + 2.4, p.minZ + 0.3, p.maxX, y + 2.55, p.minZ + 3.6);
    solid(p.minX + 0.3, p.maxX - 0.3, p.minZ + 0.5, p.minZ + 3.4, 2.4);
    for (let z = p.minZ + 12; z < p.maxZ; z += 22) {
      paint(COL.dark, 0.5, 0.6); pbox(p.maxX - 0.2, y, z - 0.06, p.maxX - 0.08, y + 4.2, z + 0.06);
      paint(COL.cold, 0.4, 0, 1); pbox(p.maxX - 0.6, y + 4.1, z - 0.15, p.maxX - 0.05, y + 4.25, z + 0.15);
      ctx.lamps.push({ x: p.maxX - 0.4, y: y + 4.2, z, type: 1, h: 4.2, pool: 0.4, size: 1.0, power: 0.25, streak: 0 });
    }
    // fishing rods leaning on the rail, a bucket, a life ring
    paint(COL.dark, 0.5, 0.2);
    for (const z of [p.minZ + 9, p.minZ + 21, p.minZ + 40]) beam(ps, [p.minX + 0.6, y, z], [p.minX - 1.6, y + 3.2, z + 0.6], 0.03, 0.03);
    paint([0.55, 0.1, 0.05], 0.7, 0); pbox(p.minX + 0.5, y, p.minZ + 9.4, p.minX + 0.85, y + 0.35, p.minZ + 9.75);
    paint([0.85, 0.3, 0.05], 0.7, 0); post(ps, p.maxX - 0.15, p.minZ + 30, 0.35, y + 0.4, y + 0.55);
    // boats stop at the pier
    solid(p.minX - 0.4, p.maxX + 0.4, p.minZ - 0.4, p.maxZ, 3, { boatOnly: true });
  }

  // =========================================================================
  // 8. FENCES: chain-link panels on posts (one draw call), and their walls for collision
  // =========================================================================
  // the wire panel (the picture is the wire, see makeChainLinkTexture): 3 m wide, 2.25 m high.
  // One copy every 3 m (one draw call); the posts and rails are solid steel in the shared prop mesh.
  const fenceGeo = (() => {
    const mb = new MeshBuilder();
    mb.color(1, 1, 1, 1).data(0.55, 0.6, 0, 0);          // (rough, metal)
    mb.quad([-1.5, 0.05, 0], [1.5, 0.05, 0], [1.5, 2.3, 0], [-1.5, 2.3, 0], [0, 0, 1], [0, 0], [7.5, 0], [7.5, 0.86], [0, 0.86]);
    return mb.build(true);
  })();
  const fences = new InstancedSet('fence', fenceGeo, mats.fence, { maxDistance: 240, castShadow: false });
  sets.dockFence = fences;
  // a fence from a to b (straight), with the gaps given as [from, to] along it (meters).
  //   wire: barbed wire on top (the watched yard)
  function fence(ax, az, bx, bz, gaps = [], wire = false) {
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, rot = Math.atan2(-dz, dx);
    const nx = -dz, nz = dx;                       // sideways
    let piece = null, lastEnd = 0;
    const at = (t) => [ax + dx * t, az + dz * t];
    const close = (t) => {
      if (piece !== null && t - piece > 0.2) {
        const [x0, z0] = at(piece), [x1, z1] = at(t);
        solid(Math.min(x0, x1) - 0.08, Math.max(x0, x1) + 0.08, Math.min(z0, z1) - 0.08, Math.max(z0, z1) + 0.08, 2.4);
        // the top rail and the tension wire at the bottom
        paint([0.42, 0.43, 0.43], 0.5, 0.7);
        beam(ps, [x0, 2.33, z0], [x1, 2.33, z1], 0.045, 0.045);
        beam(ps, [x0, 0.12, z0], [x1, 0.12, z1], 0.012, 0.012);
        if (wire) {
          // arms lean out, three strands of barbed wire
          paint(COL.dark, 0.6, 0.6);
          for (const k of [1, 2, 3]) beam(ps, [x0 + nx * 0.12 * k, 2.33 + 0.14 * k, z0 + nz * 0.12 * k], [x1 + nx * 0.12 * k, 2.33 + 0.14 * k, z1 + nz * 0.12 * k], 0.014, 0.014);
        }
      }
      piece = null;
    };
    for (let t = 1.5; t < len; t += 3) {
      const inGap = gaps.some(([g0, g1]) => t + 1.5 > g0 && t - 1.5 < g1);
      if (inGap) { close(t - 1.5); continue; }
      if (piece === null) {
        piece = t - 1.5;
        const [x, z] = at(piece);
        paint([0.42, 0.43, 0.43], 0.5, 0.7); post(ps, x, z, 0.04, 0, 2.4);
      }
      fences.add(ax + dx * t, 0, az + dz * t, rot);
      lastEnd = t + 1.5;
      // a post at the end of every panel
      const [x, z] = at(t + 1.5);
      paint([0.42, 0.43, 0.43], 0.5, 0.7); post(ps, x, z, 0.04, 0, 2.4);
      if (wire) { paint(COL.dark, 0.6, 0.6); beam(ps, [x, 2.3, z], [x + nx * 0.4, 2.78, z + nz * 0.4], 0.03, 0.03); }
    }
    close(lastEnd);
  }
  const rd = D.road;
  fence(D.fenceX, D.minZ + 0.5, D.fenceX, rd.minZ - 0.5);          // west, south of the road
  fence(D.fenceX, rd.maxZ + 0.5, D.fenceX, D.maxZ);               // west, north of the road
  fence(D.fenceX, D.maxZ, D.minX, D.maxZ);                        // north
  fence(D.minX, D.maxZ, D.minX, D.minZ + 0.5);                   // east: the end of the port (the road ends at a closed gate)
  // yard B: its own fence, with the gate gap (the story puts the gate in) and a cut-open hole by the channel
  const YB = D.yards.find((y) => y.watched);
  if (YB) {
    fence(YB.fenceX, YB.fenceZ, D.minX, YB.fenceZ, [[Math.abs(YB.gateX - YB.fenceX) - 4.2, Math.abs(YB.gateX - YB.fenceX) + 4.2]], true);
    fence(YB.fenceX, D.minZ + 0.5, YB.fenceX, YB.fenceZ, [[Math.abs(YB.hole[1] - (D.minZ + 0.5)) - 1.2, Math.abs(YB.hole[1] - (D.minZ + 0.5)) + 1.2]], true);
    // the gate posts and a sign
    paint(COL.dark, 0.6, 0.6);
    for (const x of [YB.gateX - 4.3, YB.gateX + 4.3]) { pbox(x - 0.15, 0, YB.fenceZ - 0.15, x + 0.15, 2.8, YB.fenceZ + 0.15); circles.push({ x, z: YB.fenceZ, r: 0.25 }); }
    // the control box of the gate (the story hacks it)
    paint([0.35, 0.37, 0.38], 0.5, 0.5); pbox(P.gateBox[0] - 0.4, 0, P.gateBox[1] - 0.25, P.gateBox[0] + 0.4, 1.5, P.gateBox[1] + 0.25);
    paint([0.2, 0.9, 0.45], 0.3, 0, 1.2); pbox(P.gateBox[0] - 0.1, 1.2, P.gateBox[1] - 0.27, P.gateBox[0] + 0.1, 1.3, P.gateBox[1] - 0.25);
    solid(P.gateBox[0] - 0.4, P.gateBox[0] + 0.4, P.gateBox[1] - 0.25, P.gateBox[1] + 0.25, 1.5);
  }
  // around the fuel depot
  {
    const r = D.depot;
    fence(r.minX - 1, r.minZ - 1, r.maxX + 1, r.minZ - 1, [[(r.maxX - r.minX) / 2 - 3, (r.maxX - r.minX) / 2 + 3]]);
    fence(r.minX - 1, r.minZ - 1, r.minX - 1, r.maxZ + 1);
    fence(r.maxX + 1, r.minZ - 1, r.maxX + 1, r.maxZ + 1);
    fence(r.minX - 1, r.maxZ + 1, r.maxX + 1, r.maxZ + 1);
  }

  // =========================================================================
  // 9. FLOODLIGHT MASTS (tall poles with a crown of lamps) and the road lamps
  // =========================================================================
  const floods = [];
  function mast(x, z, h = 24) {
    paint([0.45, 0.46, 0.46], 0.5, 0.6);
    post(ps, x, z, 0.35, 0, h);
    pbox(x - 1.6, h - 0.2, z - 1.6, x + 1.6, h, z + 1.6);
    paint(COL.dark, 0.5, 0.6);
    for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) pbox(x + ox - 0.35, h - 0.9, z + oz - 0.35, x + ox + 0.35, h - 0.2, z + oz + 0.35);
    paint(COL.cold, 0.3, 0, 1.5);
    for (const [ox, oz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) pbox(x + ox - 0.3, h - 0.95, z + oz - 0.3, x + ox + 0.3, h - 0.9, z + oz + 0.3, 'b');
    circles.push({ x, z, r: 0.45 });
    ctx.lamps.push({ x, y: h - 0.9, z, type: 1, h, pool: 3.4, size: 3.4 });
    floods.push([x, z, h]);
  }
  // (yard masts stand at the end of a row of stacks, in line with it: not in the way of a chase)
  for (const Y of D.yards) Y.cuts.forEach((c, i) => mast(c - 4.3, Y.rows[i % 2 ? 0 : 2]));
  for (const x of [-560, -660, -760, -860]) mast(x, D.minZ + 6, 26);
  for (let x = D.fenceX - 18; x > D.minX + 10; x -= 46) {
    // road lamps on the north side of Dock Road
    paint([0.4, 0.41, 0.42], 0.5, 0.6); post(ps, x, rd.maxZ + 1.2, 0.12, 0, 9);
    pbox(x - 0.08, 8.9, rd.maxZ - 1.5, x + 0.08, 9.05, rd.maxZ + 1.2);
    paint(COL.warm, 0.4, 0, 1); pbox(x - 0.25, 8.75, rd.maxZ - 1.6, x + 0.25, 8.9, rd.maxZ - 1.0);
    ctx.lamps.push({ x, y: 8.8, z: rd.maxZ - 1.3, type: 0, h: 8.8, size: 1.5 });
    circles.push({ x, z: rd.maxZ + 1.2, r: 0.2 });
  }

  // =========================================================================
  // 10. LOOSE THINGS: pallets, drums, tires, cones, cable reels, parked forklifts
  // =========================================================================
  const pallet = new InstancedSet('dockPallet', mergeParts([
    ...[-0.5, 0, 0.5].map((x) => ({ geom: new THREE.BoxGeometry(0.1, 0.1, 1.2), pos: [x, 0.05, 0], color: [0.32, 0.22, 0.14], rough: 0.9 })),
    ...[-0.5, -0.17, 0.17, 0.5].map((z) => ({ geom: new THREE.BoxGeometry(1.0, 0.03, 0.14), pos: [0, 0.115, z], color: [0.36, 0.26, 0.17], rough: 0.9 })),
  ]), mats.prop, { maxDistance: 120 });
  const drum = new InstancedSet('dockDrum', mergeParts([
    { geom: new THREE.CylinderGeometry(0.29, 0.29, 0.88, 14), pos: [0, 0.44, 0], color: [1, 1, 1], rough: 0.6, metal: 0.5, paint: 1 },
    { geom: new THREE.TorusGeometry(0.29, 0.02, 4, 14), pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, 0], color: [0.6, 0.6, 0.6], rough: 0.5, metal: 0.6, paint: 1 },
    { geom: new THREE.TorusGeometry(0.29, 0.02, 4, 14), pos: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0], color: [0.6, 0.6, 0.6], rough: 0.5, metal: 0.6, paint: 1 },
  ]), mats.prop, { maxDistance: 110, useColor: true });
  const forkGeo = mergeParts([
    { geom: new THREE.BoxGeometry(1.1, 0.9, 2.1), pos: [0, 0.75, 0], color: [0.75, 0.5, 0.05], rough: 0.5, metal: 0.3 },
    { geom: new THREE.BoxGeometry(1.0, 0.1, 1.0), pos: [0, 2.15, -0.15], color: COL.dark, rough: 0.6, metal: 0.4 },
    ...[[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.35], [0.45, 0.35]].map(([x, z]) => ({ geom: new THREE.BoxGeometry(0.06, 1.0, 0.06), pos: [x, 1.65, z], color: COL.dark, rough: 0.6, metal: 0.4 })),
    { geom: new THREE.BoxGeometry(0.9, 2.4, 0.12), pos: [0, 1.3, 1.1], color: COL.dark, rough: 0.6, metal: 0.4 },
    { geom: new THREE.BoxGeometry(0.12, 0.06, 1.1), pos: [-0.3, 0.12, 1.7], color: COL.steel, rough: 0.4, metal: 0.8 },
    { geom: new THREE.BoxGeometry(0.12, 0.06, 1.1), pos: [0.3, 0.12, 1.7], color: COL.steel, rough: 0.4, metal: 0.8 },
    { geom: new THREE.BoxGeometry(1.2, 0.5, 0.5), pos: [0, 0.6, -1.2], color: COL.dark, rough: 0.7, metal: 0.4 },
    ...[[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.7], [0.6, -0.7]].map(([x, z]) => ({ geom: new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12), pos: [x, 0.3, z], rot: [0, 0, Math.PI / 2], color: COL.rubber, rough: 0.9 })),
    { geom: new THREE.BoxGeometry(0.2, 0.12, 0.12), pos: [0, 2.25, -0.4], color: [1, 0.5, 0.05], rough: 0.4, glow: 1.3 },
  ]);
  const forks = new InstancedSet('dockForklift', forkGeo, mats.prop, { maxDistance: 150 });
  sets.dockPallet = pallet; sets.dockDrum = drum; sets.dockForklift = forks;
  const DRUM_COLORS = [[0.06, 0.15, 0.4], [0.5, 0.06, 0.04], [0.6, 0.45, 0.05], [0.08, 0.25, 0.12], [0.3, 0.3, 0.3]];
  function clutter(x, z, n = 4) {
    for (let k = 0; k < n; k++) {
      const px = x + rng.range(-4, 4), pz = z + rng.range(-3, 3);
      const r = rng.next();
      if (r < 0.45) { const st = rng.int(1, 6); for (let s = 0; s < st; s++) pallet.add(px, s * 0.13, pz, rng.range(-0.1, 0.1) + (rng.chance(0.5) ? Math.PI / 2 : 0)); circles.push({ x: px, z: pz, r: 0.7 }); }
      else if (r < 0.85) { drum.add(px, 0, pz, rng.range(0, 6), 1, rng.pick(DRUM_COLORS)); if (rng.chance(0.3)) drum.add(px + 0.62, 0, pz, rng.range(0, 6), 1, rng.pick(DRUM_COLORS)); circles.push({ x: px + 0.3, z: pz, r: 0.55 }); }
      else { forks.add(px, 0, pz, rng.range(0, 6.28)); circles.push({ x: px, z: pz, r: 1.3 }); }
    }
  }
  for (const w of D.warehouses) for (let x = w.minX + 4; x < w.maxX - 4; x += 14) clutter(x, w.minZ - 6, 3);
  for (const x of [-530, -575, -650, -735, -790, -870]) clutter(x, D.minZ + 10, 3);
  clutter(D.market.minX - 6, D.market.minZ - 4, 4);
  clutter(R.maxX + 8, R.minZ - 6, 4);
  clutter(-700, -360, 3);
  // oil stains, cracks and puddles on the aprons and the road
  for (let k = 0; k < 70; k++) {
    const x = rng.range(D.minX + 4, D.maxX - 4), z = rng.range(D.minZ + 2, D.maxZ - 4);
    if (x > ch.minX - 1 && x < ch.maxX + 1 && z < ch.maxZ + 1) continue;
    if (D.yards.some((y) => x > y.minX && x < y.maxX && z > y.minZ && z < y.maxZ)) continue;
    const r = rng.next();
    if (r < 0.35) addDecal(dc, rng.pick(['oil1', 'oil2', 'tar', 'patch']), x, z, rng.range(1.5, 4), rng.range(1.2, 3), rng.range(0, 6.28), 0.02, rng.range(0.5, 0.9));
    else if (r < 0.55) addDecal(dc, rng.pick(['crack1', 'crack2']), x, z, rng.range(2, 5), rng.range(2, 5), rng.range(0, 6.28), 0.021, rng.range(0.5, 0.8));
    else if (r < 0.75) addDecal(dc, 'skid', x, z, rng.range(8, 16), 1.7, rng.range(-0.3, 0.3), 0.021, rng.range(0.3, 0.6));
    else addDecal(pu, rng.pick(['blob', 'oil1', 'oil2']), x, z, rng.range(2, 5), rng.range(1.5, 3.5), rng.range(0, 6.28), 0.019, rng.range(0.85, 1));
  }
  // Dock Road: its paint
  {
    const yel = [0.92, 0.7, 0.18], wht = [0.92, 0.92, 0.9], zc = (rd.minZ + rd.maxZ) / 2;
    addMark(mk, rd.maxX - 2, zc, rd.minX + 4, zc, 0.36, MARK.double, 6, yel, 0.75);
    for (const o of [-5.5, 5.5]) addMark(mk, rd.maxX - 2, zc + o, rd.minX + 4, zc + o, 0.13, MARK.dashed, 12, wht, 0.7);
    addMark(mk, D.gateX + 6, rd.minZ + 0.5, D.gateX + 6, zc - 0.4, 0.45, MARK.solid, 2, wht, 0.8);
  }

  // trucks and vans parked along Dock Road and by the market (real parked vehicles: they can be taken)
  ctx.parkedDocks = [
    { x: -640, z: -401.2, rot: -Math.PI / 2, kind: 'armored_van' }, { x: -655, z: -401.2, rot: -Math.PI / 2, kind: 'armored_van' },
    { x: -760, z: -401.2, rot: -Math.PI / 2, kind: 'armored_van' }, { x: -872, z: -383.2, rot: Math.PI / 2, kind: 'armored_van' },
    { x: -566, z: -361.5, rot: Math.PI / 2, kind: 'van' }, { x: -705, z: -383.0, rot: Math.PI / 2, kind: 'van' },
  ];

  // =========================================================================
  // 11. THE SHIPS at the quay (their own meshes: they bob), and the channel water
  // =========================================================================
  const ships = [];
  function shipMesh(S) {
    const mb = new MeshBuilder();
    const hl = S.len / 2, hb = S.beam / 2, deck = 7, keel = -8;
    const stations = [];
    // the hull's half width along its length (stern at -hl, bow at +hl): full in the middle, a sharp bow
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, x = -hl + t * S.len;
      const w = t > 0.78 ? hb * Math.pow(Math.max(0, 1 - (t - 0.78) / 0.22), 0.7) + 0.4 : t < 0.06 ? hb * (0.86 + 0.14 * (t / 0.06)) : hb;
      stations.push([x, w, t]);
    }
    const hullC = S.hull, red = [0.22, 0.03, 0.025], white = [0.6, 0.6, 0.58];
    // the bow leans forward: low down it ends up to 7 m earlier than at the deck (a raked stem)
    const X = (x, t, y) => x - (t > 0.78 ? ((t - 0.78) / 0.22) * 7 * (1 - (y - keel) / (deck - keel)) : 0);
    const side = (s) => {
      for (let i = 0; i < stations.length - 1; i++) {
        const [x0, w0, t0] = stations[i], [x1, w1, t1] = stations[i + 1];
        for (const [ya, yb, c] of [[keel, level - 0.3, red], [level - 0.3, deck - 0.5, hullC], [deck - 0.5, deck, white]]) {
          mb.color(c[0], c[1], c[2], 1).data(0.6, 0.3, 0, 0);
          const p0 = [X(x0, t0, ya), ya, s * w0], p1 = [X(x1, t1, ya), ya, s * w1], p2 = [X(x1, t1, yb), yb, s * w1], p3 = [X(x0, t0, yb), yb, s * w0];
          const k = -(w1 - w0) / (x1 - x0), nl = Math.hypot(k, 1), n = [k / nl, 0, s / nl];   // (leans forward at the bow)
          if (s > 0) mb.quad(p0, p1, p2, p3, n, [0, 0], [1, 0], [1, 1], [0, 1]);
          else mb.quad(p1, p0, p3, p2, n, [0, 0], [1, 0], [1, 1], [0, 1]);
        }
      }
    };
    side(1); side(-1);
    // the stern (flat) and the deck
    mb.color(hullC[0], hullC[1], hullC[2], 1).data(0.6, 0.3, 0, 0);
    mb.quadAuto([-hl, keel, stations[0][1]], [-hl, keel, -stations[0][1]], [-hl, deck, -stations[0][1]], [-hl, deck, stations[0][1]], [-1, 0, 0]);
    const bw = stations[stations.length - 1][1];
    mb.quadAuto([X(hl, 1, keel), keel, -bw], [X(hl, 1, keel), keel, bw], [hl, deck, bw], [hl, deck, -bw], [1, 0, 0]);          // the narrow bow plate
    mb.color(0.2, 0.22, 0.2, 1).data(0.8, 0.1, 0, 0);
    for (let i = 0; i < stations.length - 1; i++) {
      const [x0, w0] = stations[i], [x1, w1] = stations[i + 1];
      mb.quad([x0, deck, -w0], [x0, deck, w0], [x1, deck, w1], [x1, deck, -w1], [0, 1, 0], [0, 0], [0, 1], [1, 1], [1, 0]);
    }
    // the bridge house at the stern, the funnel, a mast, lifeboats
    const bx0 = -hl + 4, bx1 = -hl + 18;
    mb.color(0.66, 0.66, 0.63, 1).data(0.6, 0.1, 0, 0);
    mb.box(bx0, deck, -hb + 1.5, bx1, deck + 15, hb - 1.5, 1, 'nsewt');
    mb.box(bx0 + 2, deck + 15, -hb, bx0 + 10, deck + 17, hb, 1, 'nsewt');                  // the bridge wings
    mb.color(0.02, 0.03, 0.04, 1).data(0.1, 0.4, 0, 0);
    for (let y = deck + 2.5; y < deck + 14; y += 2.8) mb.box(bx1, y, -hb + 2.2, bx1 + 0.05, y + 1.1, hb - 2.2, 1, 'w');
    mb.box(bx0 + 2, deck + 15.6, -hb - 0.02, bx0 + 10, deck + 16.6, hb + 0.02, 1, 'nsw');
    mb.color(S.hull[0] * 1.3, S.hull[1] * 1.3, S.hull[2] * 1.3, 1).data(0.6, 0.2, 0, 0);
    mb.box(bx0 - 2, deck + 15, -2.4, bx0 + 3, deck + 23, 2.4, 1, 'nsewt');
    mb.color(0.02, 0.02, 0.02, 1).data(0.8, 0.1, 0, 0);
    mb.box(bx0 - 2, deck + 22, -2.45, bx0 + 3, deck + 23, 2.45, 1, 'nsewt');
    mb.color(0.6, 0.18, 0.04, 1).data(0.6, 0, 0, 0);
    for (const s of [-1, 1]) mb.box(bx0 + 4, deck + 6, s * (hb - 0.2) - 1.2, bx0 + 11, deck + 8, s * (hb - 0.2) + 1.2, 1, 'nsewt');
    mb.color(0.5, 0.5, 0.5, 1).data(0.5, 0.6, 0, 0);
    mb.box(bx0 + 5.9, deck + 17, -0.12, bx0 + 6.1, deck + 26, 0.12, 1, 'nsew');
    // containers on deck, in bays (their colors vary), with gaps for the hatch covers
    for (let x = bx1 + 3; x < hl * 0.72; x += L40 + 1.4) {
      const rows = Math.floor((S.beam - 2) / (CW + 0.06));
      for (let r = 0; r < rows; r++) {
        const zc = -((rows - 1) * (CW + 0.06)) / 2 + r * (CW + 0.06);
        const n = rng.int(1, 4);
        for (let k = 0; k < n; k++) {
          const c = pickColor(), f = rng.range(0.75, 1.05);
          mb.color(c[0] * f, c[1] * f, c[2] * f, 1).data(0.7, 0.4, 0, 0);
          mb.box(x, deck + k * CH, zc - CW / 2, x + L40, deck + (k + 1) * CH - 0.02, zc + CW / 2, 1, 'nsewt');
        }
      }
    }
    // the bow mast with a light, and the anchor hawse
    mb.color(0.9, 0.9, 0.9, 1).data(0.4, 0, 0, 1.2);
    mb.box(hl - 3, deck + 9, -0.2, hl - 2.6, deck + 9.4, 0.2, 1, 'nsewt');
    mb.color(0.5, 0.5, 0.5, 1).data(0.5, 0.6, 0, 0);
    mb.box(hl - 2.95, deck, -0.1, hl - 2.75, deck + 9, 0.1, 1, 'nsew');
    const m = new THREE.Mesh(mb.build(true), mats.prop);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(S.x, 0, S.z);
    // (bow to the east: -x)
    m.rotation.y = Math.PI;
    ctx.group.add(m);
    solid(S.x - hl - 1, S.x + hl + 1, S.z - hb - 1, S.z + hb + 1, 12, { boatOnly: true });
    return m;
  }
  for (const S of D.ships) ships.push({ m: shipMesh(S), ph: rng.range(0, 6.28) });
  // mooring lines from the bollards to the ships
  paint(COL.rope || [0.3, 0.26, 0.18], 0.9, 0);
  for (const S of D.ships) for (const o of [-0.42, -0.3, 0.3, 0.42]) beam(ps, [S.x + o * S.len, 0.6, D.minZ + 0.9], [S.x + o * S.len * 0.92, 6, S.z + S.beam / 2 - 0.5], 0.05, 0.05);
  // the channel water (the ocean picture, its own small sheet: the sea mesh ends at the beach line)
  // (the sea sheet of backdrop.js stops at the quay line in the docks; this one goes on into the channel)
  const chWater = new THREE.Mesh((() => { const mb = new MeshBuilder(); mb.groundRect(ch.minX, D.minZ, ch.maxX, ch.maxZ, level, 1); return mb.build(false); })(), mats.harbor);
  shared.uPgHarborX.value = D.maxX;
  shared.uPgChannel.value.set(ch.minX, ch.maxX, ch.maxZ, 0);
  chWater.name = 'docksChannel';
  chWater.renderOrder = 6;
  ctx.group.add(chWater);

  // =========================================================================
  // 12. MACHINES THAT MOVE: autonomous carriers on the quay, drone loaders over
  //     the ships, two forklifts by the warehouses (their own meshes, near the player only)
  // =========================================================================
  const movers = [];
  function mover(mesh, path, speed, opts = {}) {
    mesh.castShadow = true;
    ctx.group.add(mesh);
    movers.push({ mesh, path, speed, s: rng.range(0, 1) * 300, y: opts.y || 0, bob: opts.bob || 0, r: opts.r || 0, ping: opts.ping !== false, len: 0 });
  }
  const carrierGeo = mergeParts([
    ...[[-2.4, -1.4], [2.4, -1.4], [-2.4, 1.4], [2.4, 1.4]].map(([x, z]) => ({ geom: new THREE.BoxGeometry(0.6, 5.6, 0.6), pos: [x, 3.4, z], color: [0.75, 0.75, 0.72], rough: 0.5, metal: 0.4 })),
    { geom: new THREE.BoxGeometry(5.6, 0.8, 3.4), pos: [0, 6.4, 0], color: [0.75, 0.75, 0.72], rough: 0.5, metal: 0.4 },
    ...[[-2.4, -1.4], [2.4, -1.4], [-2.4, 1.4], [2.4, 1.4]].map(([x, z]) => ({ geom: new THREE.CylinderGeometry(0.5, 0.5, 0.45, 12), pos: [x, 0.5, z], rot: [Math.PI / 2, 0, 0], color: COL.rubber, rough: 0.9 })),
    { geom: new THREE.BoxGeometry(L20, CH, CW), pos: [0, 3.1, 0], color: CONTAINER_COLORS[3], rough: 0.7, metal: 0.4 },
    { geom: new THREE.BoxGeometry(0.3, 0.3, 0.3), pos: [2.6, 6.9, 1.6], color: [0.2, 1, 0.5], rough: 0.4, glow: 1.5 },
    { geom: new THREE.BoxGeometry(0.3, 0.3, 0.3), pos: [-2.6, 6.9, -1.6], color: [1, 0.55, 0.05], rough: 0.4, glow: 1.5 },
  ]);
  for (const [i, x0] of [-540, -800].entries()) {
    const m = new THREE.Mesh(carrierGeo, mats.prop);
    m.rotation.y = Math.PI / 2;
    mover(m, [[x0, D.minZ + 9], [x0 - 120, D.minZ + 9]], 3.2 + i * 0.4, { r: 3.2 });
  }
  const droneGeo = mergeParts([
    { geom: new THREE.BoxGeometry(1.4, 0.35, 1.4), pos: [0, 0, 0], color: [0.2, 0.21, 0.22], rough: 0.5, metal: 0.5 },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ({ geom: new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12), pos: [x, 0.25, z], color: [0.1, 0.1, 0.1], rough: 0.5 })),
    { geom: new THREE.BoxGeometry(0.9, 0.8, 0.9), pos: [0, -1.2, 0], color: [0.4, 0.28, 0.16], rough: 0.9 },
    { geom: new THREE.BoxGeometry(0.2, 0.12, 0.2), pos: [0, -0.2, 0.7], color: [0.2, 1, 0.5], rough: 0.4, glow: 1.6 },
  ]);
  for (const [i, x] of [-585, -790].entries()) {
    const m = new THREE.Mesh(droneGeo, mats.prop);
    mover(m, [[x - 20, D.minZ - 8], [x + 15, D.minZ - 12], [x + 10, D.minZ + 12], [x - 25, D.minZ + 10]], 4 + i, { y: 18 + i * 3, bob: 0.4, ping: false });
  }
  for (const w of D.warehouses) {
    const m = new THREE.Mesh(forkGeo, mats.prop);
    mover(m, [[w.minX + 8, w.minZ - 8], [w.maxX - 8, w.minZ - 8]], 1.6, { r: 1.4 });
  }
  for (const mv of movers) {
    let len = 0;
    const segs = mv.path.length - (mv.ping ? 1 : 0);
    for (let i = 0; i < segs; i++) { const a = mv.path[i], b = mv.path[(i + 1) % mv.path.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    mv.len = len;
    mv.dyn = mv.r ? { x: 0, z: 0, r: mv.r, crane: true } : null;
  }

  // =========================================================================
  // 13. FAR AWAY east of the fence: more yards, warehouses and two cranes in the haze
  // =========================================================================
  for (let x = -930; x > -1280; x -= 70) {
    const w = rng.range(36, 60), d = rng.range(26, 40), h = rng.range(8, 14), z = rng.range(-370, -330);
    sheet(rng.pick([[0.42, 0.44, 0.46], [0.3, 0.33, 0.36], [0.45, 0.38, 0.3]]));
    mt.box(x - w, 0, z - d / 2, x, h, z + d / 2, 1, 'nsewt');
  }
  quayCrane(-1010, COL.craneRed);
  quayCrane(-1180, COL.craneBlue);

  // =========================================================================
  // 14. THE CREWS: dock workers in orange vests and hard hats, a few in rain gear. Most stand at
  //     their work (cranes, sheds, the market, the gate), some walk their rounds. One draw call;
  //     shown only near the port (never more than 24 people).
  // =========================================================================
  const crewGeo = (() => {
    const skin = [0.62, 0.46, 0.36], trousers = [0.12, 0.13, 0.15], shoe = [0.05, 0.05, 0.05];
    const parts = [
      { geom: new THREE.CylinderGeometry(0.2, 0.165, 0.6, 6), pos: [0, 1.17, 0], scale: [1, 1, 0.62], color: [0.95, 0.95, 0.95], rough: 0.8, paint: 1 },   // the vest (its color per person)
      { geom: new THREE.CylinderGeometry(0.181, 0.178, 0.045, 6), pos: [0, 1.05, 0], scale: [1, 1, 0.64], color: [0.8, 0.82, 0.78], rough: 0.4, glow: 0.12 },   // reflective stripes
      { geom: new THREE.CylinderGeometry(0.193, 0.19, 0.045, 6), pos: [0, 1.27, 0], scale: [1, 1, 0.64], color: [0.8, 0.82, 0.78], rough: 0.4, glow: 0.12 },
      { geom: new THREE.CylinderGeometry(0.05, 0.055, 0.1, 5), pos: [0, 1.5, 0], color: skin, rough: 0.7 },
      { geom: new THREE.SphereGeometry(0.112, 7, 5), pos: [0, 1.63, 0.005], scale: [0.94, 1.14, 1], color: skin, rough: 0.7 },
      { geom: new THREE.SphereGeometry(0.128, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), pos: [0, 1.67, 0], color: [0.85, 0.7, 0.08], rough: 0.4 },        // hard hat
      { geom: new THREE.CylinderGeometry(0.15, 0.15, 0.015, 10), pos: [0, 1.672, 0.02], color: [0.85, 0.7, 0.08], rough: 0.4 },
    ];
    for (const sx of [-1, 1]) {
      parts.push({ geom: new THREE.BoxGeometry(0.15, 0.82, 0.17), pos: [sx * 0.092, 0.46, 0], color: trousers, rough: 0.85 });
      parts.push({ geom: new THREE.BoxGeometry(0.14, 0.07, 0.27), pos: [sx * 0.092, 0.036, 0.045], color: shoe, rough: 0.6 });
      parts.push({ geom: new THREE.BoxGeometry(0.1, 0.5, 0.115), pos: [sx * 0.262, 1.2, 0], color: [0.2, 0.21, 0.24], rough: 0.85 });            // dark sleeves (a work shirt under the vest)
      parts.push({ geom: new THREE.BoxGeometry(0.085, 0.16, 0.095), pos: [sx * 0.262, 0.875, 0], color: [0.12, 0.12, 0.1], rough: 0.8 });       // gloves
    }
    const geometry = mergeParts(parts);
    // arms and legs swing when they walk (the same marks as the city's people, see models.js)
    const pos = geometry.attributes.position, limb = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), sd = x > 0 ? 1 : -1;
      let pivot = 0, swing = 0;
      if (Math.abs(x) > 0.2) { pivot = 1.42; swing = -0.42 * sd; }
      else if (y < 0.875 && Math.abs(x) > 0.01) { pivot = 0.88; swing = 0.5 * sd; }
      limb[i * 3] = pivot; limb[i * 3 + 1] = swing; limb[i * 3 + 2] = 1;
    }
    geometry.setAttribute('aLimb', new THREE.BufferAttribute(limb, 3));
    return geometry;
  })();
  const VESTS = [[1.0, 0.36, 0.02], [1.0, 0.42, 0.04], [0.95, 0.3, 0.02], [0.85, 0.75, 0.05], [0.1, 0.16, 0.12], [0.05, 0.08, 0.16]];   // orange, orange, orange, yellow, rain gear
  // [x, z, compass facing (degrees), walk to x2, z2 (or nothing: stands at work)]
  const CREW = [
    [-556, -461.5, 200], [-562.5, -458.5, 120], [-761, -461, 160], [-768.5, -463, 250],             // at the quay cranes
    [-620, -360.5, 170], [-616.5, -361.5, 220], [-700, -360.5, 190],                                // at the shed doors
    [-550.7, -354.3, 0], [-537.7, -354.3, 0], [-544.2, -319.7, 180], [-524.7, -319.7, 180],         // the market (behind their tables)
    [-538.5, -337, 90], [-534, -338.2, 270],                                                         // two buyers haggling
    [-514, -377.8, 90],                                                                              // the gate
    [-600.5, -441.4, 270], [-646, -429.6, 90],                                                       // checking containers
    [-772, -341, 140], [-663.2, -543.4, 270],                                                          // the depot; a man fishing at the end of the pier
    [-530, -458, 270, -642, -458], [-522, -377.5, 270, -700, -377.5], [-646, -362, 0, -654, -330],   // on their rounds
    [-680, -409, 90, -560, -409],
  ];
  const nCrew = CREW.length;
  const crewPhase = new THREE.InstancedBufferAttribute(new Float32Array(nCrew), 1);
  crewPhase.setUsage(THREE.DynamicDrawUsage);
  crewGeo.setAttribute('aPhase', crewPhase);
  const crewMesh = new THREE.InstancedMesh(crewGeo, mats.ped, nCrew);
  crewMesh.name = 'dockCrew';
  crewMesh.castShadow = true; crewMesh.receiveShadow = true;
  crewMesh.frustumCulled = false;
  crewMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crewMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nCrew * 3), 3);
  const crew = CREW.map(([x, z, face, x2, z2], i) => {
    const c = VESTS[i % 7 === 6 ? 4 + (i % 2) : i % 4];
    crewMesh.instanceColor.setXYZ(i, c[0], c[1], c[2]);
    const walk = x2 !== undefined;
    return { x, z, ax: x, az: z, bx: walk ? x2 : x, bz: walk ? z2 : z, walk, t: rng.range(0, 1), dir: 1, heading: (-face * Math.PI) / 180, phase: rng.range(0, 6), size: rng.range(0.92, 1.06), len: walk ? Math.hypot(x2 - x, z2 - z) : 0, idle: rng.range(0, 6) };
  });
  ctx.group.add(crewMesh);
  const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cs = new THREE.Vector3(), _cp = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  let crewShown = 0, crewOn = true, crewMax = nCrew, moversOn = true;
  function updateCrew(dt, time, near) {
    crewMesh.visible = near && crewOn;
    if (!near) return;
    for (let i = 0; i < nCrew; i++) {
      const w = crew[i];
      if (w.walk) {
        // walk to the end, turn, walk back (1.2 m/s)
        w.t += (w.dir * 1.2 * dt) / w.len;
        if (w.t > 1) { w.t = 1; w.dir = -1; } else if (w.t < 0) { w.t = 0; w.dir = 1; }
        w.x = w.ax + (w.bx - w.ax) * w.t; w.z = w.az + (w.bz - w.az) * w.t;
        w.heading = Math.atan2((w.bx - w.ax) * w.dir, (w.bz - w.az) * w.dir);
        w.phase += 1.2 * dt * 4.4;
      } else {
        // standing at work: now and then a small turn of the body
        w.idle += dt;
      }
      const turn = w.walk ? 0 : Math.sin(w.idle * 0.35 + i) * 0.25;
      _cq.setFromAxisAngle(_up, w.heading + turn);
      _cm.compose(_cp.set(w.x, 0, w.z), _cq, _cs.set(w.size, w.size, w.size));
      crewMesh.setMatrixAt(i, _cm);
      crewPhase.array[i] = w.walk ? w.phase : 0;
    }
    crewMesh.count = crewMax;                    // (LOW quality: only the first half of them)
    crewMesh.instanceMatrix.needsUpdate = true;
    crewPhase.needsUpdate = true;
    crewShown = crewMax;
  }

  // =========================================================================
  // RUN TIME
  // =========================================================================
  const dyn = [];               // the moving legs and machines (they go into the collision list every frame)
  for (const G of gantries) dyn.push(...G.legs);
  for (const mv of movers) if (mv.dyn) dyn.push(mv.dyn);
  const _tmp = new THREE.Vector3();
  function pointOn(mv, s) {
    const n = mv.path.length;
    if (mv.ping) {
      // back and forth along the path
      const L2 = mv.len * 2, u = ((s % L2) + L2) % L2, d = u < mv.len ? u : L2 - u;
      let acc = 0;
      for (let i = 0; i < n - 1; i++) {
        const a = mv.path[i], b = mv.path[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= acc + l || i === n - 2) { const t = Math.min(1, (d - acc) / l); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1]) + (u < mv.len ? 0 : Math.PI)]; }
        acc += l;
      }
    }
    // a closed loop
    const u = ((s % mv.len) + mv.len) % mv.len;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = mv.path[i], b = mv.path[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (u <= acc + l) { const t = (u - acc) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])]; }
      acc += l;
    }
    return [mv.path[0][0], mv.path[0][1], 0];
  }

  return {
    // in the port? (m: margin)
    inZone: (x, z, m = 0) => L.docks.inZone(x, z, m),
    inChannel: (x, z, m = 0) => L.docks.inChannel(x, z, m),
    places: P,
    slip: ch.slip,
    gantries,
    // where to step off a boat near (x, z): the slip at the end of the channel, the steps of the pier
    dockNear(x, z, r = 8) {
      const pz = D.pier.minZ + 6;
      const spots = [
        { x: ch.slip[0], z: ch.maxZ - 1.6, bx: ch.slip[0], bz: ch.maxZ - 6 },                 // the slip at the end of the channel
        { x: D.pier.minX + 0.8, z: pz, bx: D.pier.minX - 2.2, bz: pz },                     // the pier, east side
        { x: D.pier.maxX - 0.8, z: pz, bx: D.pier.maxX + 2.2, bz: pz },                     // the pier, west side
      ];
      let best = null, bd = r;
      for (const s of spots) { const d = Math.hypot(s.bx - x, s.bz - z); if (d < bd) { bd = d; best = s; } }
      return best;
    },
    // called every frame: the cranes drive, the ships bob, the machines go about their work.
    //   dyn: the list of moving circles the cars and people collide with (traffic.dynamicCircles)
    update(dt, time, px, pz, dynList) {
      const near = Math.abs(px - (D.minX + D.maxX) / 2) < 380 && pz < D.maxZ + 220;
      for (const s of ships) {
        s.m.position.y = Math.sin(time * 0.42 + s.ph) * 0.16;
        s.m.rotation.z = Math.sin(time * 0.31 + s.ph) * 0.005;
        s.m.rotation.x = Math.sin(time * 0.23 + s.ph * 1.7) * 0.003;
      }
      // the yard cranes: drive to the next cross aisle, lower the container to the ground, hold, lift, drive on
      for (const G of gantries) {
        if (G.state === 'move') {
          const target = G.stops[G.k + G.dir];
          G.x += G.dir * 2.2 * dt;
          if ((G.dir > 0 && G.x >= target) || (G.dir < 0 && G.x <= target)) {
            G.x = target; G.k += G.dir;
            const end = G.k === 0 || G.k === G.stops.length - 1;
            if (end) { G.dir = -G.dir; G.state = 'pause'; G.t = 3; }
            else G.state = 'lower';
          }
        } else if (G.state === 'lower') {
          G.lift += dt / 3.5;
          if (G.lift >= 1) { G.lift = 1; G.state = 'hold'; G.t = 5; }
        } else if (G.state === 'hold') {
          G.t -= dt;
          if (G.t <= 0) G.state = 'raise';
        } else if (G.state === 'raise') {
          G.lift -= dt / 3.5;
          if (G.lift <= 0) { G.lift = 0; G.state = 'move'; }
        } else if (G.state === 'pause') {
          G.t -= dt;
          if (G.t <= 0) G.state = 'move';
        }
        G.g.position.x = G.x;
        // the container's floor: high over the stacks while it drives, on the ground when it is let down
        const e = G.lift * G.lift * (3 - 2 * G.lift);
        const bottom = 11.4 + (0.12 - 11.4) * e, top = G.H + 1.9;
        G.hang.position.set(0, bottom, 0);
        G.cables.position.set(0, (top + bottom + CH + 0.5) / 2, 0);
        G.cables.scale.set(1, Math.max(0.1, top - bottom - CH - 0.5), 1);
        let k = 0;
        for (const lx of [-G.sx, G.sx]) for (const lz of [-G.sz, G.sz]) { const c = G.legs[k++]; c.x = G.x + lx; c.z = G.row + lz; }
        G.boxOn = bottom < 2.4;
        G.box.forEach((c, j) => { c.x = G.x; c.z = G.row + (j - 2) * 2.4; });
      }
      for (const mv of movers) {
        mv.mesh.visible = near && moversOn;
        if (!near || !moversOn) { if (mv.dyn) mv.dyn.x = 1e7; continue; }
        mv.s += mv.speed * dt;
        const p = pointOn(mv, mv.s);
        mv.mesh.position.set(p[0], mv.y + (mv.bob ? Math.sin(time * 1.3 + mv.s) * mv.bob : 0), p[1]);
        mv.mesh.rotation.y = p[2] + (mv.mesh.geometry === carrierGeo ? 0 : 0);
        if (mv.dyn) { mv.dyn.x = p[0]; mv.dyn.z = p[1]; }
      }
      for (const G of gantries) G.g.visible = near || Math.abs(px - G.x) < 600;
      updateCrew(dt, time, near);
      if (dynList && near) {
        for (const c of dyn) dynList.push(c);
        for (const G of gantries) if (G.boxOn) for (const c of G.box) dynList.push(c);
      }
    },
    // THE WATER of the port for the Guard's boats (src/ai/wanted.js): the harbor in front of the quay and the channel
    water: {
      inZone(x, z, m = 0) {
        if (L.docks.inChannel(x, z, m)) return true;
        return x > D.minX - 220 - m && x < D.maxX + 40 + m && z < D.minZ + m && z > D.minZ - 330 - m;
      },
      // a free place on the water near (x, z): not in a ship, not at the pier, not up on the quay
      waterPoint(x, z, r = 10) {
        const ok = (px, pz) => {
          if (px > ch.minX + 2 && px < ch.maxX - 2 && pz > ch.minZ && pz < ch.maxZ - 4) return true;            // in the channel
          if (pz > D.minZ - 9 || pz < D.minZ - 320 || px < D.minX - 210 || px > D.maxX + 30) return false;
          if (px > D.pier.minX - 5 && px < D.pier.maxX + 5 && pz > D.pier.minZ - 5) return false;
          for (const S of D.ships) if (Math.abs(px - S.x) < S.len / 2 + 5 && Math.abs(pz - S.z) < S.beam / 2 + 5) return false;
          return true;
        };
        if (ok(x, z)) return { x, z };
        for (let k = 0; k < 24; k++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r + k * 2;
          const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
          if (ok(px, pz)) return { x: px, z: pz };
        }
        return { x: Math.max(D.minX - 200, Math.min(D.maxX + 20, x)), z: D.minZ - 40 };
      },
      // into the channel or out of it: through its mouth (else: straight)
      route(x0, z0, x1, z1) {
        const a = L.docks.inChannel(x0, z0, 0) && z0 > D.minZ, b = L.docks.inChannel(x1, z1, 0) && z1 > D.minZ;
        if (a === b) return null;
        const mx = (ch.minX + ch.maxX) / 2;
        return a ? [{ x: x0, z: z0 }, { x: mx, z: D.minZ + 4 }, { x: mx, z: D.minZ - 14 }, { x: x1, z: z1 }]
          : [{ x: x0, z: z0 }, { x: mx, z: D.minZ - 14 }, { x: mx, z: D.minZ + 4 }, { x: x1, z: z1 }];
      },
    },
    // roofs that keep the rain off (and hide a person from the drones): Rask's building, the market
    spots: [
      { minX: R.minX, maxX: R.maxX, minZ: R.minZ, maxZ: R.maxZ, top: R.h },
      { minX: D.market.minX - 1, maxX: D.market.maxX + 1, minZ: D.market.minZ - 1.5, maxZ: D.market.maxZ + 1.5, top: 5 },
    ],
    // the dock workers (the story can send them home: setCrew(false))
    crew: crewMesh,
    crewCount: () => (crewMesh.visible ? crewShown : 0),
    setCrew(on) { crewOn = !!on; },
    // LOW quality: half the workers, the carriers and drone loaders stand still out of sight
    setQuality(q) { const low = q.water === 'simple'; crewMax = low ? Math.ceil(nCrew / 2) : nCrew; moversOn = !low; },
    // for the map: the yards, the buildings, the water
    map: { yards: D.yards, buildings: [...D.warehouses, D.market, D.depot, R], channel: ch, pier: D.pier, road: rd, ships: D.ships, floods },
  };
}
