// ---------------------------------------------------------------------------
// siteBuilding.js - A CONSTRUCTION SITE (a "hero lot" like the hand-made buildings, see heroBuildings.js).
//
// One lot of the city is a building site instead of a finished house:
//   * a board fence around it with a wide gate to the street (you can walk and drive in)
//   * the concrete frame of a new house: columns, four floor slabs, a stair core, steel bars standing out of
//     the top where the next floor will be poured
//   * scaffolding with plank decks along its front
//   * a tower crane with a long jib, a load hanging from its hook
//   * the site office (a cabin), a portable toilet, a generator, a small mixer
//   * piles of material: sand, gravel, bricks on pallets, pipes, timber, steel bars, cement bags, barrels
//   * cones and barriers at the gate
//
// Everything here stands still, so it goes into the big merged meshes of the city (no extra draw calls).
// What MOVES on the site - the workers and the digger - is made by src/world/construction.js, which reads the
// places from SITE (meters, in the world).
//
// The lot's own numbers: r = meters to the right (seen from the street), f = meters toward the street, y up.
// The lot is 40 wide and 34 deep: r from -20 to 20, f from -17 to 17 (the street is at f = +17).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { softBox } from '../utils/geometry.js';

export const SITE = { ready: false };
export const SITE_SIZE = { w: 40, d: 34 };

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const UP = new THREE.Vector3(0, 1, 0);

export function buildSite(kit, s) {
  const { curb, ctx } = kit;
  const pm = ctx.mb.plaster, ps = ctx.mb.propStatic;
  const fx = Math.sin(s.rot), fz = Math.cos(s.rot), rx = Math.cos(s.rot), rz = -Math.sin(s.rot);
  const P = (r, y, f) => [s.x + r * rx + f * fx, y, s.z + r * rz + f * fz];
  const letter = (dx, dz) => (dx > 0.5 ? 'w' : dx < -0.5 ? 'e' : dz > 0.5 ? 'n' : 's');
  const SIDE = { F: letter(fx, fz), B: letter(-fx, -fz), R: letter(rx, rz), L: letter(-rx, -rz), T: 't', D: 'b' };
  // a box along the lot's own directions (the big concrete parts: they get the wall picture)
  const box = (mb, r0, y0, f0, r1, y1, f1, faces = 'FBRLT', t = 2) => {
    const a = P(r0, 0, f0), b = P(r1, 0, f1);
    mb.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), t, [...faces].map((c) => SIDE[c]).join(''));
  };
  const wall = (c, k = 1) => pm.color(c[0] * k, c[1] * k, c[2] * k, 1).data(0, 0, 0, 0);
  const paint = (c, rough = 0.7, metal = 0, glow = 0) => ps.color(c[0], c[1], c[2], 1).data(rough, metal, 0, glow);
  const collide = (r0, f0, r1, f1, h) => { const a = P(r0, 0, f0), b = P(r1, 0, f1); ctx.colliders.boxes.push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h }); };
  const post = (r, f, rad) => { const c = P(r, 0, f); ctx.colliders.circles.push({ x: c[0], z: c[2], r: rad }); };

  // ---- shapes that are turned any way (bars, braces, pipes): a matrix in the lot's numbers, then into the world ----
  const siteM = new THREE.Matrix4().makeRotationY(s.rot).setPosition(s.x, 0, s.z);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3();
  // a shape at (r, y, f): turned by rot = [rx, ry, rz], scaled
  const put = (geom, r, y, f, rot = null, scale = 1) => {
    _q.setFromEuler(rot ? _e.set(rot[0], rot[1], rot[2], 'YXZ') : _e.set(0, 0, 0));
    if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(scale[0], scale[1], scale[2]);
    _m.compose(_p.set(r, y, f), _q, _s).premultiply(siteM);
    ps.addGeometry(geom, _m);
  };
  // a plain block (middle of its bottom at r, y, f), turned round the up axis
  const blk = (r, y, f, w, h, d, turn = 0) => put(UNIT_BOX, r, y + h / 2, f, turn ? [0, turn, 0] : null, [w, h, d]);
  // a block with soft edges (things you see from close)
  const soft = (r, y, f, w, h, d, turn = 0) => put(softBox(w, h, d), r, y + h / 2, f, turn ? [0, turn, 0] : null, 1);
  // a bar from a to b ([r, y, f]), w wide and d deep; round = a tube
  const beam = (a, b, w, d = w, round = false) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
    _m.compose(_p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(round ? w / 2 : w, len, round ? w / 2 : d)).premultiply(siteM);
    ps.addGeometry(round ? UNIT_CYL : UNIT_BOX, _m);
  };

  const Y = curb;
  const CONCRETE = [0.62, 0.61, 0.58], DIRT = [0.42, 0.34, 0.25], YELLOW = [0.92, 0.66, 0.06], STEEL = [0.5, 0.52, 0.54], RUST = [0.4, 0.22, 0.13];
  const WOODC = [0.62, 0.47, 0.3], BLUE = [0.12, 0.3, 0.52], WHITE = [0.9, 0.9, 0.88], ORANGE = [0.95, 0.38, 0.05], DARK = [0.1, 0.1, 0.11];

  // =========================================================================
  // 1. THE GROUND: trampled earth, a concrete strip from the gate to the frame
  // =========================================================================
  wall(DIRT, 1);
  box(pm, -19.7, Y, -16.7, 19.7, Y + 0.04, 16.7, 'T', 3);
  wall(CONCRETE, 0.92);
  box(pm, 5.5, Y + 0.04, -4, 13.5, Y + 0.07, 16.7, 'T', 3);

  // =========================================================================
  // 2. THE FENCE: boards on posts, a white band along the top, a gate 7 m wide (r from 6 to 13)
  // =========================================================================
  const GATE = [6, 13];
  const fence = (r0, f0, r1, f1) => {
    const along = Math.abs(r1 - r0) > Math.abs(f1 - f0), t = 0.06;
    paint(BLUE, 0.8);
    if (along) blk((r0 + r1) / 2, Y, f0, Math.abs(r1 - r0), 1.75, t); else blk(r0, Y, (f0 + f1) / 2, t, 1.75, Math.abs(f1 - f0));
    paint(WHITE, 0.8);
    if (along) blk((r0 + r1) / 2, Y + 1.75, f0, Math.abs(r1 - r0), 0.33, t); else blk(r0, Y + 1.75, (f0 + f1) / 2, t, 0.33, Math.abs(f1 - f0));
    // posts every 2.5 m, on the inside
    paint(STEEL, 0.5, 0.6);
    const len = along ? Math.abs(r1 - r0) : Math.abs(f1 - f0), n = Math.max(1, Math.round(len / 2.5));
    for (let i = 0; i <= n; i++) {
      const k = i / n, r = r0 + (r1 - r0) * k, f = f0 + (f1 - f0) * k;
      blk(r - (along ? 0 : Math.sign(r) * 0.07), Y, f - (along ? Math.sign(f) * 0.07 : 0), 0.07, 2.15, 0.07);
    }
    if (along) collide(Math.min(r0, r1), f0 - 0.12, Math.max(r0, r1), f0 + 0.12, 2.1); else collide(r0 - 0.12, Math.min(f0, f1), r0 + 0.12, Math.max(f0, f1), 2.1);
  };
  fence(-19.8, 16.8, GATE[0], 16.8);
  fence(GATE[1], 16.8, 19.8, 16.8);
  fence(-19.8, -16.8, 19.8, -16.8);
  fence(-19.8, -16.8, -19.8, 16.8);
  fence(19.8, -16.8, 19.8, 16.8);
  // the two gate leaves stand open, swung into the site
  for (const [gr, sg] of [[GATE[0], -1], [GATE[1], 1]]) {
    paint(STEEL, 0.5, 0.6);
    blk(gr, Y, 16.8, 0.14, 2.3, 0.14);
    for (const yy of [0.25, 1.1, 1.95]) beam([gr, Y + yy, 16.7], [gr + sg * 0.5, Y + yy, 13.4], 0.06);
    beam([gr + sg * 0.5, Y + 0.2, 13.4], [gr + sg * 0.5, Y + 2.0, 13.4], 0.07);
    beam([gr, Y + 0.25, 16.7], [gr + sg * 0.5, Y + 1.95, 13.4], 0.045);
    paint(BLUE, 0.75, 0.2);
    put(UNIT_BOX, gr + sg * 0.25, Y + 1.1, 15.05, [0, Math.atan2(sg * 0.5, -3.3), 0], [0.02, 1.6, 3.2]);
    post(gr + sg * 0.25, 15.0, 0.3); post(gr + sg * 0.45, 13.6, 0.25);
  }
  // warning signs on the fence beside the gate: a yellow board with a black band
  for (const r of [GATE[0] - 1.6, GATE[1] + 1.6]) {
    paint(YELLOW, 0.6); blk(r, Y + 1.0, 16.86, 0.9, 0.65, 0.02);
    paint(DARK, 0.6); blk(r, Y + 1.05, 16.875, 0.7, 0.12, 0.012); blk(r, Y + 1.35, 16.875, 0.16, 0.16, 0.012);
  }

  // =========================================================================
  // 3. THE NEW HOUSE: a concrete frame (22 m x 18 m), four slabs, a stair core
  // =========================================================================
  const CR = [-17, -11.5, -6, -0.5, 5], CF = [-14, -8, -2, 4];
  const FLOORS = [3.6, 7.2, 10.8, 14.4], SLAB = 0.3;
  wall(CONCRETE, 1);
  // the floor of the ground level and the slabs (the top one is only half poured: r up to -6)
  box(pm, -17.4, Y + 0.04, -14.4, 5.4, Y + 0.16, 4.4, 'FBRLT', 3);
  FLOORS.forEach((fy, i) => {
    const r1 = i === 3 ? -5.7 : 5.4;
    box(pm, -17.4, Y + fy - SLAB, -14.4, r1, Y + fy, 4.4, 'FBRLTD', 3);
  });
  // columns: up to the top slab where it is poured, one floor lower with steel bars above elsewhere
  for (const r of CR) for (const f of CF) {
    const poured = r <= -6;
    const top = poured ? 18.0 : 10.8;
    wall(CONCRETE, 0.95);
    box(pm, r - 0.25, Y + 0.16, f - 0.25, r + 0.25, Y + top, f + 0.25, 'FBRLT', 2);
    post(r, f, 0.42);
    // the steel bars of the next piece of column
    paint(RUST, 0.85, 0.3);
    const y0 = Y + top;
    for (const [a, b] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) blk(r + a, y0, f + b, 0.025, poured ? 1.1 : 1.5, 0.025);
    if (!poured) for (const yy of [0.4, 0.9]) for (const [a0, b0, a1, b1] of [[-0.16, -0.16, 0.16, -0.16], [0.16, -0.16, 0.16, 0.16], [0.16, 0.16, -0.16, 0.16], [-0.16, 0.16, -0.16, -0.16]]) beam([r + a0, y0 + yy, f + b0], [r + a1, y0 + yy, f + b1], 0.014);
  }
  // the stair core: a concrete tower with dark door openings on every floor
  wall(CONCRETE, 0.9);
  box(pm, -9.3, Y + 0.16, -14.2, -3.2, Y + 19.2, -9.6, 'FBRLT', 3);
  collide(-9.3, -14.2, -3.2, -9.6, 19);
  paint([0.06, 0.06, 0.07], 0.9);
  for (const fy of [0.16, ...FLOORS]) blk(-6.2, Y + fy, -9.58, 1.1, 2.15, 0.04);
  // formwork (wooden boards) around the columns that are being made on the top floor
  paint(WOODC, 0.85);
  for (const [r, f] of [[-0.5, -8], [5, -2]]) { blk(r, Y + 10.8, f - 0.3, 0.7, 2.4, 0.04); blk(r, Y + 10.8, f + 0.3, 0.7, 2.4, 0.04); blk(r - 0.3, Y + 10.8, f, 0.04, 2.4, 0.56); blk(r + 0.3, Y + 10.8, f, 0.04, 2.4, 0.56); }
  // a net of steel bars lying on the open part of the third slab, ready for the concrete
  paint(RUST, 0.85, 0.3);
  for (let i = 0; i < 8; i++) beam([-5.2 + i * 1.3, Y + 10.86, -14], [-5.2 + i * 1.3, Y + 10.86, 4], 0.03);
  for (let i = 0; i < 9; i++) beam([-5.4, Y + 10.9, -13.5 + i * 2.1], [5.2, Y + 10.9, -13.5 + i * 2.1], 0.03);
  // edge protection: a rail of red and white boards round every open slab
  for (const fy of FLOORS.slice(0, 3)) {
    for (const [a, b] of [[[-17.3, -14.3], [5.3, -14.3]], [[5.3, -14.3], [5.3, 4.3]], [[-17.3, -14.3], [-17.3, 4.3]]]) {
      paint([0.85, 0.16, 0.1], 0.7); beam([a[0], Y + fy + 1.0, a[1]], [b[0], Y + fy + 1.0, b[1]], 0.035, 0.1);
      paint(WHITE, 0.7); beam([a[0], Y + fy + 0.55, a[1]], [b[0], Y + fy + 0.55, b[1]], 0.035, 0.1);
    }
  }

  // =========================================================================
  // 4. SCAFFOLDING along the front of the frame: tubes, plank decks, rails, braces, a ladder
  // =========================================================================
  {
    const F0 = 4.75, F1 = 5.85, TOP = 16.2, R0 = -17.2, R1 = 5.2, n = 8;
    paint(STEEL, 0.45, 0.8);
    for (let i = 0; i <= n; i++) {
      const r = R0 + ((R1 - R0) * i) / n;
      for (const f of [F0, F1]) { beam([r, Y, f], [r, Y + TOP, f], 0.055, 0.055, true); blk(r, Y, f, 0.16, 0.02, 0.16); }
      // the short tubes across, under every deck
      for (const fy of FLOORS) beam([r, Y + fy - 0.08, F0], [r, Y + fy - 0.08, F1], 0.05, 0.05, true);
      if (i % 2 === 0) post(r, F1, 0.12);
    }
    for (const fy of FLOORS) {
      // the long tubes, the rails
      paint(STEEL, 0.45, 0.8);
      for (const f of [F0, F1]) beam([R0, Y + fy - 0.14, f], [R1, Y + fy - 0.14, f], 0.05, 0.05, true);
      for (const yy of [0.55, 1.05]) beam([R0, Y + fy + yy, F1], [R1, Y + fy + yy, F1], 0.045, 0.045, true);
      // the deck: three planks side by side
      paint(WOODC, 0.9);
      for (let k = 0; k < 3; k++) blk((R0 + R1) / 2, Y + fy - 0.04, F0 + 0.2 + k * 0.36, R1 - R0, 0.045, 0.33);
      // a toe board
      blk((R0 + R1) / 2, Y + fy, F1 - 0.02, R1 - R0, 0.15, 0.025);
    }
    // braces: a zigzag over the outer face
    paint(STEEL, 0.45, 0.8);
    for (let i = 0; i < n; i += 2) {
      const ra = R0 + ((R1 - R0) * i) / n, rb = R0 + ((R1 - R0) * (i + 1)) / n;
      for (let k = 0; k < 4; k++) { const y0 = k === 0 ? 0.1 : FLOORS[k - 1], y1 = FLOORS[k]; beam(k % 2 ? [rb, Y + y0, F1 + 0.04] : [ra, Y + y0, F1 + 0.04], k % 2 ? [ra, Y + y1, F1 + 0.04] : [rb, Y + y1, F1 + 0.04], 0.04, 0.04, true); }
    }
    // a ladder from the ground to the first deck
    paint([0.75, 0.76, 0.78], 0.4, 0.8);
    for (const dr of [-0.2, 0.2]) beam([-15.6 + dr, Y, F1 + 1.3], [-15.6 + dr, Y + 4.4, F1 + 0.1], 0.04, 0.04, true);
    for (let i = 1; i < 13; i++) { const k = i / 13; beam([-15.8, Y + 4.4 * k, F1 + 1.3 - 1.2 * k], [-15.4, Y + 4.4 * k, F1 + 1.3 - 1.2 * k], 0.028, 0.028, true); }
  }

  // =========================================================================
  // 5. THE TOWER CRANE: a concrete foot, a lattice mast, the turning part with the cab, a long jib and a short
  //    one with the counter weights, the trolley and the hook with a load
  // =========================================================================
  const CR0 = [12.5, -10.5], MAST = 38, JIB = 30, BACK = 10;
  {
    const [cr, cf] = CR0, h = 0.8;
    wall(CONCRETE, 0.85);
    box(pm, cr - 2.2, Y, cf - 2.2, cr + 2.2, Y + 0.7, cf + 2.2, 'FBRLT', 2);
    collide(cr - 1.2, cf - 1.2, cr + 1.2, cf + 1.2, MAST);
    paint(YELLOW, 0.55, 0.3);
    const C4 = [[-h, -h], [h, -h], [h, h], [-h, h]];
    for (const [a, b] of C4) beam([cr + a, Y + 0.7, cf + b], [cr + a, Y + MAST, cf + b], 0.14);
    const sec = 3.0, ns = Math.floor((MAST - 0.7) / sec);
    for (let i = 0; i <= ns; i++) {
      const y = Y + 0.7 + i * sec;
      for (let k = 0; k < 4; k++) {
        const [a0, b0] = C4[k], [a1, b1] = C4[(k + 1) % 4];
        beam([cr + a0, y, cf + b0], [cr + a1, y, cf + b1], 0.07);
        if (i < ns) beam((i + k) % 2 ? [cr + a0, y, cf + b0] : [cr + a1, y, cf + b1], (i + k) % 2 ? [cr + a1, y + sec, cf + b1] : [cr + a0, y + sec, cf + b0], 0.06);
      }
    }
    // a ladder inside the mast
    paint(STEEL, 0.5, 0.7);
    for (const dr of [-0.2, 0.2]) beam([cr + dr, Y + 0.8, cf + h - 0.2], [cr + dr, Y + MAST - 0.5, cf + h - 0.2], 0.035);
    // the turning part: a ring, the cab hanging at its side, the pointed top
    const TY = Y + MAST;
    // (the jib points over the new house: this way in the lot's numbers)
    const ja = Math.atan2(-22, 6), jx = Math.sin(ja), jz = Math.cos(ja), sx = jz, sz = -jx;     // along the jib, across it
    const J = (along, y, side = 0) => [cr + jx * along + sx * side, TY + y, cf + jz * along + sz * side];
    paint([0.25, 0.26, 0.28], 0.5, 0.6);
    put(UNIT_CYL, cr, TY + 0.25, cf, null, [1.25, 0.5, 1.25]);
    paint(YELLOW, 0.55, 0.3);
    put(UNIT_BOX, cr, TY + 0.95, cf, [0, ja, 0], [1.9, 0.9, 2.6]);
    // the cab: a small glass box hanging on the right of the jib
    paint(WHITE, 0.5);
    put(softBox(1.3, 1.7, 1.5), ...J(1.2, -0.45, 1.55), [0, ja, 0]);
    paint([0.08, 0.14, 0.2], 0.15, 0.4);
    put(UNIT_BOX, ...J(1.96, -0.25, 1.55), [0, ja, 0], [1.1, 0.95, 0.03]);
    put(UNIT_BOX, ...J(1.2, -0.25, 2.21), [0, ja, 0], [0.03, 0.95, 1.2]);
    // the top (an A frame) and the tie bars down to both jibs
    paint(YELLOW, 0.55, 0.3);
    const apex = J(0, 7.0);
    for (const [a, b] of [[-0.8, -0.7], [0.8, -0.7], [0.8, 0.7], [-0.8, 0.7]]) beam(J(a, 1.4, b), apex, 0.12);
    paint([0.3, 0.31, 0.33], 0.5, 0.7);
    beam(apex, J(JIB * 0.62, 2.0), 0.05, 0.05, true);
    beam(apex, J(JIB * 0.3, 2.0), 0.05, 0.05, true);
    beam(apex, J(-BACK + 1.2, 1.5), 0.05, 0.05, true);
    // the long jib: a triangle of three tubes with a zigzag between them
    paint(YELLOW, 0.55, 0.3);
    const jw = 0.6, jh = 1.15;
    beam(J(1.0, 1.4, -jw), J(JIB, 1.4, -jw), 0.11); beam(J(1.0, 1.4, jw), J(JIB, 1.4, jw), 0.11); beam(J(1.0, 1.4 + jh, 0), J(JIB - 1.2, 1.4 + jh, 0), 0.11);
    const nb = 15, st = (JIB - 1) / nb;
    for (let i = 0; i < nb; i++) {
      const a = 1 + i * st, b = a + st, m = a + st / 2;
      for (const sd of [-jw, jw]) { beam(J(a, 1.4, sd), J(m, 1.4 + jh, 0), 0.05); beam(J(m, 1.4 + jh, 0), J(b, 1.4, sd), 0.05); }
      beam(J(a, 1.4, -jw), J(a, 1.4, jw), 0.05);
    }
    beam(J(JIB, 1.4, -jw), J(JIB, 1.4, jw), 0.08); beam(J(JIB - 1.2, 1.4 + jh, 0), J(JIB, 1.4, 0), 0.07);
    // the short jib behind, with the counter weights
    beam(J(-1.0, 1.4, -jw), J(-BACK, 1.4, -jw), 0.12); beam(J(-1.0, 1.4, jw), J(-BACK, 1.4, jw), 0.12);
    for (let i = 0; i <= 4; i++) beam(J(-1 - i * ((BACK - 1) / 4), 1.4, -jw), J(-1 - i * ((BACK - 1) / 4), 1.4, jw), 0.06);
    wall(CONCRETE, 0.8);
    for (let i = 0; i < 4; i++) { paint([0.5, 0.5, 0.48], 0.9); put(UNIT_BOX, ...J(-BACK + 0.6 + i * 0.62, 0.55, 0), [0, ja, 0], [1.5, 1.9, 0.55]); }
    // the machine house on the short jib
    paint([0.78, 0.8, 0.82], 0.6, 0.2);
    put(softBox(1.3, 1.1, 2.2), ...J(-4.2, 2.1, 0), [0, ja, 0]);
    // the trolley, the rope, the hook block and the load: a bundle of steel beams in two slings
    const TR = JIB * 0.6, LOADY = -19.5;
    paint([0.3, 0.31, 0.33], 0.5, 0.7);
    put(UNIT_BOX, ...J(TR, 1.2, 0), [0, ja, 0], [1.3, 0.3, 1.1]);
    for (const sd of [-0.2, 0.2]) beam(J(TR + sd, 1.1, 0), J(TR + sd * 0.4, LOADY + 2.6, 0), 0.03, 0.03, true);
    paint(YELLOW, 0.5, 0.3);
    put(softBox(0.5, 0.75, 0.3), ...J(TR, LOADY + 2.3, 0), [0, ja, 0]);
    paint([0.3, 0.31, 0.33], 0.5, 0.7);
    for (const al of [-1.6, 1.6]) for (const sd of [-0.42, 0.42]) beam(J(TR, LOADY + 1.95, 0), J(TR + al, LOADY + 0.55, sd), 0.022, 0.022, true);
    paint(RUST, 0.7, 0.5);
    for (let i = 0; i < 5; i++) put(UNIT_BOX, ...J(TR, LOADY + 0.18 + (i > 2 ? 0.26 : 0), (i > 2 ? i - 3.5 : i - 1) * 0.3), [0, ja + Math.PI / 2, 0], [0.22, 0.24, 5.6]);
    // a red lamp on the very top and on the tip of the jib (they glow at night)
    paint([1, 0.08, 0.04], 0.4, 0, 2.2);
    put(UNIT_BOX, apex[0], apex[1] + 0.2, apex[2], null, [0.2, 0.25, 0.2]);
    put(UNIT_BOX, ...J(JIB, 1.75, 0), null, [0.18, 0.2, 0.18]);
    SITE.crane = { top: P(cr, TY, cf), load: P(...J(TR, LOADY, 0).map((v, i) => (i === 1 ? v : v))) };
  }

  // =========================================================================
  // 6. THE SITE OFFICE (a cabin on blocks), the toilet, the generator, the small mixer
  // =========================================================================
  {
    // the cabin: 6 m x 2.6 m, its door and windows look at the yard (toward -r)
    const c0 = [14.2, 8.6], c1 = [19.0, 15.2];
    paint([0.84, 0.85, 0.83], 0.7);
    put(softBox(c1[0] - c0[0], 2.5, c1[1] - c0[1], 0.06), (c0[0] + c1[0]) / 2, Y + 0.3 + 1.25, (c0[1] + c1[1]) / 2);
    paint(BLUE, 0.7);
    blk(c0[0] - 0.012, Y + 0.3 + 1.9, (c0[1] + c1[1]) / 2, 0.02, 0.32, c1[1] - c0[1] - 0.1);
    paint([0.3, 0.3, 0.3], 0.9);
    for (const f of [c0[1] + 0.6, (c0[1] + c1[1]) / 2, c1[1] - 0.6]) for (const r of [c0[0] + 0.6, c1[0] - 0.6]) blk(r, Y, f, 0.4, 0.3, 0.4);
    paint([0.3, 0.33, 0.36], 0.6);
    blk(c0[0] - 0.02, Y + 0.3, 13.9, 0.05, 2.0, 0.9);                              // the door
    paint([0.07, 0.11, 0.15], 0.15, 0.4);
    blk(c0[0] - 0.02, Y + 1.25, 10.1, 0.04, 0.9, 1.3); blk(c0[0] - 0.02, Y + 1.25, 12.0, 0.04, 0.9, 1.3);   // windows
    paint(STEEL, 0.6, 0.6);
    blk(c0[0] - 0.45, Y, 13.9, 0.8, 0.15, 1.0); blk(c0[0] - 0.8, Y, 13.9, 0.5, 0.02, 1.0);          // a step
    collide(c0[0], c0[1], c1[0], c1[1], 2.9);
    // a notice board beside the door
    paint([0.9, 0.9, 0.85], 0.8); blk(c0[0] - 0.02, Y + 1.2, 12.95, 0.03, 0.8, 0.6);
    paint([0.85, 0.16, 0.1], 0.8); blk(c0[0] - 0.035, Y + 1.75, 12.95, 0.012, 0.12, 0.45);
    // the portable toilet
    paint([0.1, 0.38, 0.62], 0.6);
    put(softBox(1.15, 2.25, 1.15, 0.05), 17.9, Y + 1.125, 6.4);
    paint(WHITE, 0.6); put(softBox(1.2, 0.14, 1.2, 0.04), 17.9, Y + 2.3, 6.4);
    paint([0.07, 0.3, 0.5], 0.6); blk(17.31, Y + 0.1, 6.4, 0.02, 1.9, 0.8);
    collide(17.3, 5.8, 18.5, 7.0, 2.3);
    // the generator: a yellow box on a frame, with a dark grille and an exhaust pipe
    paint(YELLOW, 0.6);
    put(softBox(2.0, 1.05, 0.95, 0.05), 9.5, Y + 0.72, -3.6);
    paint(DARK, 0.7); blk(9.5, Y + 0.45, -3.11, 1.2, 0.5, 0.02); blk(9.5, Y, -3.6, 1.8, 0.2, 0.7);
    paint([0.2, 0.2, 0.2], 0.6, 0.6); put(UNIT_CYL, 10.2, Y + 1.5, -3.6, null, [0.045, 0.5, 0.045]);
    collide(8.5, -4.1, 10.5, -3.1, 1.3);
    // the small concrete mixer: a tilted drum on two wheels
    paint(ORANGE, 0.6);
    put(new THREE.CylinderGeometry(0.36, 0.5, 0.85, 12), 0.5, Y + 1.0, 7.2, [0.75, 0.4, 0], 1);
    paint([0.25, 0.25, 0.26], 0.6, 0.5);
    for (const dr of [-0.42, 0.42]) { beam([0.5 + dr, Y + 0.3, 6.9], [0.5 + dr * 0.6, Y + 0.95, 7.2], 0.05); put(UNIT_CYL, 0.5 + dr, Y + 0.22, 6.9, [0, 0, Math.PI / 2], [0.22, 0.08, 0.22]); }
    beam([0.5, Y, 7.75], [0.5, Y + 0.75, 7.45], 0.05);
    post(0.5, 7.2, 0.65);
  }

  // =========================================================================
  // 7. MATERIAL: sand, gravel, bricks, pipes, timber, steel bars, cement bags, barrels, a wheelbarrow, a skip
  // =========================================================================
  {
    // a heap: a round mound (a turned shape), a little oval
    const heap = (r, f, rad, h, c) => {
      const prof = [[0.001, h], [rad * 0.22, h * 0.93], [rad * 0.48, h * 0.66], [rad * 0.74, h * 0.34], [rad * 0.92, h * 0.1], [rad, 0]].map(([a, b]) => new THREE.Vector2(a, b));
      paint(c, 0.95); put(new THREE.LatheGeometry(prof, 18), r, Y + 0.02, f, [0, 0.4, 0], [1, 1, 0.86]); post(r, f, rad * 0.62);
    };
    heap(2.6, 11.2, 2.3, 1.4, [0.55, 0.43, 0.25]);               // sand
    heap(-2.2, 13.2, 1.9, 1.1, [0.36, 0.36, 0.35]);              // gravel
    // a shovel standing in the sand
    paint(WOODC, 0.8); beam([3.9, Y + 0.3, 10.2], [4.2, Y + 1.45, 10.0], 0.035, 0.035, true);
    paint(STEEL, 0.5, 0.7); put(UNIT_BOX, 3.87, Y + 0.2, 10.22, [0.2, 0.3, 0.25], [0.2, 0.3, 0.02]);
    // bricks on pallets (two high in places)
    const pallet = (r, f, n, turn = 0) => {
      paint(WOODC, 0.9); blk(r, Y, f, 1.2, 0.14, 1.0, turn);
      for (let i = 0; i < n; i++) { paint([0.6 + (i % 2) * 0.05, 0.25, 0.17], 0.9); soft(r, Y + 0.14 + i * 0.84, f, 1.08, 0.8, 0.9, turn + (i % 2) * 0.03); }
      post(r, f, 0.75);
    };
    pallet(-9.5, 9.0, 2); pallet(-7.9, 9.3, 1, 0.1); pallet(-9.4, 10.8, 2, -0.05); pallet(-11.2, 9.4, 1);
    // pallets of grey blocks
    for (const [r, f, n] of [[-12.8, 12.6, 2], [-11.2, 12.9, 1]]) { paint(WOODC, 0.9); blk(r, Y, f, 1.2, 0.14, 1.0); for (let i = 0; i < n; i++) { paint([0.6, 0.6, 0.58], 0.95); soft(r, Y + 0.14 + i * 0.74, f, 1.1, 0.7, 0.92); } post(r, f, 0.75); }
    // concrete pipes: three lying side by side and two on top
    paint([0.68, 0.67, 0.64], 0.9);
    const pipe = new THREE.CylinderGeometry(0.45, 0.45, 2.4, 14, 1, true);
    for (const [dr, dy] of [[-0.95, 0.45], [0, 0.45], [0.95, 0.45], [-0.48, 1.23], [0.48, 1.23]]) put(pipe, -16.2 + dr, Y + dy, 11.6, [Math.PI / 2, 0, 0]);
    paint([0.3, 0.3, 0.3], 0.95);
    for (const [dr, dy] of [[-0.95, 0.45], [0, 0.45], [0.95, 0.45], [-0.48, 1.23], [0.48, 1.23]]) put(new THREE.CylinderGeometry(0.38, 0.38, 2.38, 12, 1, true), -16.2 + dr, Y + dy, 11.6, [Math.PI / 2, 0, 0]);
    collide(-17.7, 10.4, -14.7, 12.8, 1.7);
    // timber: a stack of boards and a stack of beams
    for (let i = 0; i < 5; i++) { paint([0.66 - i * 0.02, 0.5, 0.31], 0.9); blk(-4.0, Y + 0.1 + i * 0.07, 8.0, 3.6, 0.06, 1.0, 0.03 * (i % 2)); }
    paint([0.5, 0.36, 0.22], 0.9); for (const df of [-0.3, 0.3]) blk(-4.0, Y, 8.0 + df, 0.12, 0.1, 0.12);
    for (let i = 0; i < 6; i++) { paint([0.6, 0.45, 0.28], 0.9); blk(15.2 + (i % 3) * 0.22, Y + 0.08 + Math.floor(i / 3) * 0.2, -1.2, 0.18, 0.18, 4.2); }
    collide(-5.8, 7.5, -2.2, 8.5, 0.5);
    // steel bars for the concrete: long bundles on timbers
    paint(RUST, 0.85, 0.3);
    for (let i = 0; i < 9; i++) beam([-17.5, Y + 0.2 + (i % 3) * 0.035, 14.6 + i * 0.06], [-9.5, Y + 0.2 + (i % 3) * 0.035, 14.6 + i * 0.06], 0.028, 0.028, true);
    paint(WOODC, 0.9); for (const r of [-16.5, -13.5, -10.5]) blk(r, Y, 14.85, 0.12, 0.14, 0.9);
    // cement bags: two neat stacks under a blue sheet... (the sheet is folded back)
    for (let i = 0; i < 12; i++) { paint([0.8, 0.78, 0.72], 0.95); soft(7.3 + (i % 2) * 0.62, Y + 0.02 + Math.floor(i / 4) * 0.17, 9.6 + (Math.floor(i / 2) % 2) * 0.42, 0.58, 0.16, 0.38, (i % 3) * 0.04); }
    post(7.6, 9.8, 0.75);
    // barrels
    for (const [r, f, c] of [[16.6, -4.2, [0.1, 0.3, 0.5]], [17.5, -4.6, [0.1, 0.3, 0.5]], [17.1, -3.5, [0.5, 0.12, 0.08]]]) { paint(c, 0.6, 0.3); put(UNIT_CYL, r, Y + 0.45, f, null, [0.29, 0.9, 0.29]); paint(mulc(c, 0.7), 0.6, 0.3); for (const yy of [0.3, 0.6]) put(UNIT_CYL, r, Y + yy, f, null, [0.3, 0.03, 0.3]); post(r, f, 0.32); }
    // a wheelbarrow with sand in it
    paint([0.12, 0.42, 0.2], 0.6, 0.2);
    put(softBox(0.62, 0.3, 0.85, 0.05), 5.6, Y + 0.5, 9.0, [0.08, 0.5, 0]);
    paint([0.55, 0.43, 0.25], 0.95); put(softBox(0.5, 0.12, 0.7, 0.05), 5.6, Y + 0.66, 9.0, [0.08, 0.5, 0]);
    paint(DARK, 0.9); put(UNIT_CYL, 5.84, Y + 0.19, 9.43, [0, 0.5, Math.PI / 2], [0.19, 0.08, 0.19]);
    paint(STEEL, 0.5, 0.6); for (const dr of [-0.25, 0.25]) beam([5.6 + dr * 0.9 - 0.2, Y + 0.45, 8.65 + dr * 0.5], [5.6 + dr * 0.9 - 0.52, Y + 0.6, 8.05 + dr * 0.5], 0.03, 0.03, true);
    post(5.6, 9.0, 0.5);
    // a skip for rubble: an open steel tub with sloped ends, broken bits in it
    paint([0.72, 0.5, 0.06], 0.7, 0.2);
    blk(-17.6, Y + 0.12, 4.2, 1.9, 0.08, 3.4);
    for (const dr of [-0.92, 0.92]) blk(-17.6 + dr, Y + 0.12, 4.2, 0.06, 1.25, 3.4);
    put(UNIT_BOX, -17.6, Y + 0.75, 2.3, [-0.42, 0, 0], [1.9, 1.4, 0.06]); put(UNIT_BOX, -17.6, Y + 0.75, 6.1, [0.42, 0, 0], [1.9, 1.4, 0.06]);
    paint([0.5, 0.48, 0.45], 0.95); put(softBox(1.7, 0.5, 2.9, 0.12), -17.6, Y + 0.85, 4.2, [0, 0.03, 0.04]);
    collide(-18.6, 2.2, -16.6, 6.2, 1.4);
    // traffic cones and barriers at the gate, on the sidewalk side and inside
    const cone = (r, f) => { paint(ORANGE, 0.7); put(new THREE.ConeGeometry(0.15, 0.6, 10, 1, true), r, Y + 0.33, f); blk(r, Y, f, 0.36, 0.035, 0.36); paint(WHITE, 0.6); put(new THREE.CylinderGeometry(0.075, 0.105, 0.14, 10, 1, true), r, Y + 0.38, f); };
    for (const [r, f] of [[5.0, 15.6], [5.2, 13.9], [14.0, 15.9], [4.6, 12.2], [3.6, 6.2], [-1.2, 6.0], [11.0, 2.0], [14.2, 4.6]]) cone(r, f);
    const barrier = (r, f, turn) => {
      for (let k = 0; k < 4; k++) { paint(k % 2 ? WHITE : [0.85, 0.16, 0.1], 0.7); put(UNIT_BOX, r + Math.cos(turn) * (k - 1.5) * 0.5, Y + 0.85, f - Math.sin(turn) * (k - 1.5) * 0.5, [0, turn, 0], [0.5, 0.22, 0.03]); }
      paint(STEEL, 0.5, 0.6);
      for (const sg of [-0.85, 0.85]) { const br = r + Math.cos(turn) * sg, bf = f - Math.sin(turn) * sg; beam([br, Y + 0.95, bf], [br - Math.sin(turn) * 0.28, Y, bf - Math.cos(turn) * 0.28], 0.035); beam([br, Y + 0.95, bf], [br + Math.sin(turn) * 0.28, Y, bf + Math.cos(turn) * 0.28], 0.035); }
      post(r, f, 0.5);
    };
    barrier(2.0, 15.4, 0.1); barrier(16.4, 3.2, 1.2); barrier(-13.0, 6.6, -0.15);
  }

  // =========================================================================
  // 8. THE PLACES of what moves (src/world/construction.js): the digger and the workers
  //    worker: [r, y above the ground, f, compass way they look (degrees, 0 = toward the street), work, walks to r2, f2]
  //    work: 'hammer' | 'dig' | 'carry' | 'wave' | 'stand' | 'walk'
  // =========================================================================
  const W = [
    [3.9, 0, 9.3, 300, 'dig'],                       // shovelling sand
    [-8.6, 0, 7.6, 200, 'hammer'],                   // at the pallets
    [-13.2, 3.6, 5.3, 180, 'hammer'],                // on the first deck of the scaffolding
    [-2.0, 3.6, 5.3, 180, 'hammer'],
    [2.5, 7.2, 5.3, 180, 'stand'],                   // second deck, looking at the wall
    [-14.0, 0.16, -4.0, 90, 'hammer'],               // inside the frame, at a column
    [9.5, 0, 0.6, 250, 'wave'],                      // the one who guides the crane, looking up
    [13.2, 0, 12.6, 270, 'stand'],                   // the foreman at the office door
    [11.6, 0, 12.0, 80, 'stand'],                    // talking to the foreman
    [-6.0, 0, 6.6, 90, 'carry', 4.0, 6.6],           // carrying between the timber and the mixer
    [8.0, 0, 14.0, 0, 'walk', 8.0, -1.0],            // on their rounds
    [-16.0, 0, 8.0, 90, 'walk', -1.0, 9.8],
  ];
  SITE.workers = W.map(([r, y, f, face, work, r2, f2]) => {
    const a = P(r, 0, f), b = r2 !== undefined ? P(r2, 0, f2) : null;
    return { x: a[0], y: Y + y, z: a[2], heading: s.rot + (face * Math.PI) / 180 + Math.PI, work, x2: b ? b[0] : a[0], z2: b ? b[2] : a[2] };
  });
  { const d = P(9.8, 0, 6.8); SITE.digger = { x: d[0], y: Y + 0.04, z: d[2], rot: s.rot + 2.3 }; post(9.8, 6.8, 2.0); }
  { const g = P((GATE[0] + GATE[1]) / 2, 0, 17.6); SITE.gate = { x: g[0], z: g[2] }; const c = P(0, 0, 0); SITE.center = { x: c[0], z: c[2] }; SITE.rot = s.rot; SITE.curb = Y; }
  { const sg = P(-6.5, 0, 16.86); SITE.sign = { x: sg[0], y: Y + 2.75, z: sg[2], rot: s.rot }; }
  SITE.ready = true;

  const a = P(-SITE_SIZE.w / 2, 0, -SITE_SIZE.d / 2), b = P(SITE_SIZE.w / 2, 0, SITE_SIZE.d / 2);
  return { rect: { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]) }, top: Y + 3, solid: true, open: true };
}
const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
