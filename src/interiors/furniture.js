// ---------------------------------------------------------------------------
// furniture.js - the pieces the rooms are made of: walls with windows and
// doors, tables, chairs, a stove, a fridge, a dresser with plates, a bed, a
// wardrobe, a desk, shelves, pots, cups, books ... (all made in code).
//
// Every piece is drawn in its OWN little frame (see frame() below):
//   x to its right, z to its FRONT (where you stand to use it), y up,
//   (0, 0, 0) = the middle of its foot print on the floor.
// The room then says where the piece stands and which way it looks.
//
// Colours are written like on the web ('#8a5a34') and turned into the
// numbers the builder wants by C().
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const TAU = Math.PI * 2;
const _c = new THREE.Color();
// a colour written like on the web, for the builder (the builder wants "linear" numbers)
export const C = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ============================================================ the little frame
// Draw a piece standing at (x0, z0) of the room, turned by rot (radians about y; 0 = its front looks along +z).
// y0 lifts the whole piece (a lamp on a table, a jar on a shelf).
export function frame(b, x0, z0, rot = 0, y0 = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const X = (x, z) => x0 + x * c + z * s, Z = (x, z) => z0 - x * s + z * c;
  const R3 = (r) => [r[0] || 0, (r[1] || 0) + rot, r[2] || 0];
  return {
    b, R: b.R, col: b.col, rot,
    // the same point in the room (for lamps, colliders made by the room)
    at: (x, y, z) => [X(x, z), y0 + y, Z(x, z)],
    // a smaller frame inside this one (a cup on a table that is itself turned)
    sub: (x, z, r = 0, y = 0) => frame(b, X(x, z), Z(x, z), rot + r, y0 + y),
    box(mat, x, y, z, sx, sy, sz, color, o = {}) { b.box(mat, X(x, z), y0 + y, Z(x, z), sx, sy, sz, color, { ...o, rot: (o.rot || 0) + rot }); },
    cyl(mat, x, y, z, r0, r1, h, color, seg = 12, r = null) { b.cyl(mat, X(x, z), y0 + y, Z(x, z), r0, r1, h, color, seg, r ? R3(r) : null); },
    lathe(mat, x, y, z, profile, color, seg = 18, scale = 1, r = null) { b.lathe(mat, X(x, z), y0 + y, Z(x, z), profile, color, seg, rot, scale, r ? R3(r) : null); },
    sphere(mat, x, y, z, r, color, seg = 12) { b.sphere(mat, X(x, z), y0 + y, Z(x, z), r, color, seg); },
    torus(mat, x, y, z, R0, r, color, rr = [0, 0, 0], arc = TAU) { b.torus(mat, X(x, z), y0 + y, Z(x, z), R0, r, color, R3(rr), arc); },
    paper(x, y, z, w, h, cell, rotY = 0, tilt = 0, mat = undefined, cols = undefined, rows = undefined) { b.paper(X(x, z), y0 + y, Z(x, z), w, h, cell, rotY + rot, tilt, mat, cols, rows); },
    geo(mat, g, x, y, z, rotY = 0, color = [1, 1, 1], r = null) { b.geo(mat, g, X(x, z), y0 + y, Z(x, z), rotY + rot, color, r ? R3(r) : null); },
    // something solid you cannot walk through (given in the piece's frame; stored as a box of the room)
    solid(ax, az, bx, bz, h) {
      const xs = [], zs = [];
      for (const [u, v] of [[ax, az], [bx, az], [bx, bz], [ax, bz]]) { xs.push(X(u, v)); zs.push(Z(u, v)); }
      b.solid(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), y0 + h);
    },
    shadow(x, z, rx, rz, k = 1) { if (y0 < 0.05) b.shadow(X(x, z), Z(x, z), rx, rz, k, rot); },
  };
}

// ============================================================ shapes used again and again (turned profiles)
const PLATE = [[0, 0.004], [0.075, 0], [0.09, 0.004], [0.112, 0.016], [0.12, 0.021], [0.115, 0.022], [0.088, 0.009], [0.07, 0.007], [0, 0.009]];
const BOWL = [[0, 0], [0.04, 0], [0.065, 0.02], [0.08, 0.055], [0.076, 0.056], [0.06, 0.024], [0.036, 0.008], [0, 0.008]];
const CUP = [[0, 0], [0.03, 0], [0.034, 0.008], [0.04, 0.072], [0.037, 0.074], [0.033, 0.012], [0, 0.012]];
const MUG = [[0, 0], [0.04, 0], [0.042, 0.006], [0.042, 0.095], [0.039, 0.097], [0.037, 0.01], [0, 0.01]];
const BOTTLE = [[0, 0], [0.036, 0], [0.04, 0.012], [0.04, 0.17], [0.03, 0.205], [0.012, 0.235], [0.012, 0.29], [0.015, 0.295], [0, 0.297]];
const JAR = [[0, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.14], [0.044, 0.15], [0.044, 0.16], [0, 0.16]];
const VASE = [[0, 0], [0.035, 0], [0.05, 0.04], [0.045, 0.1], [0.025, 0.14], [0.028, 0.16], [0, 0.16]];
const TPOT = [[0, 0], [0.05, 0], [0.072, 0.018], [0.084, 0.055], [0.08, 0.09], [0.062, 0.116], [0.036, 0.128], [0, 0.128]];
const POTPLANT = [[0, 0], [0.07, 0], [0.095, 0.16], [0.1, 0.165], [0.1, 0.18], [0.088, 0.18], [0.084, 0.17], [0, 0.17]];
// (a lamp shade: SHADE_IN is seen from inside and below, SHADE_OUT from outside - a turned shape shows one side only)
const SHADE_IN = [[0.004, 0.2], [0.03, 0.2], [0.04, 0.17], [0.07, 0.12], [0.15, 0.03], [0.19, 0]];
const SHADE_OUT = SHADE_IN.slice().reverse().map(([r, h]) => [r * 1.03, h + 0.002]);
const LEG = (h) => [[0, 0], [0.02, 0], [0.024, 0.03], [0.019, 0.1], [0.022, 0.32], [0.028, 0.44], [0.024, 0.5], [0.03, h - 0.14], [0.03, h], [0, h]];

const DARK = C('#1d1b19'), CHROME = C('#d6d8da'), BRASS = C('#c49a55'), WHITE = C('#f2efe8'), COPPER = C('#c77b4a');

// ============================================================ the room itself
// A room box: walls, floor, ceiling, the openings in the walls (doors, windows, a doorway to the next room).
//   s = { x0, z0, x1, z1, h,
//         floor: 'tiles' | 'planks' | 'checker', floorTile (m), floorColor
//         wall: 'plaster' | 'wallpaper' | 'walltile', wallTile, wallColor
//         dado: { mat, h, tile, color, border } (a lower wall of tiles, picture 2)
//         ceiling: { mat, color, beams: [z ...] (wooden beams across), boards: true }
//         skirting: colour,
//         holes: [{ wall: 'front'|'back'|'left'|'right', a, b (along the wall, from its left end seen from inside), y0, y1,
//                  kind: 'window'|'door'|'pass', depth (the wall thickness) }] }
// Returns the openings with where they are in the room (for windows: the sun goes through them).
export function shell(b, s) {
  const { x0, z0, x1, z1, h } = s;
  // the four walls by where they stand: 'z0' (at z = z0, it faces +z), 'z1', 'x0', 'x1'.
  // A hole's a..b is measured along the wall in the room's own numbers (x for a z wall, z for an x wall).
  // (Careful: looking toward +z, +x is on your LEFT - the game's x grows to the west.)
  const W = {
    z0: { p: [0, z0], q: [1, z0], n: [0, 1] },
    z1: { p: [0, z1], q: [1, z1], n: [0, -1] },
    x0: { p: [x0, 0], q: [x0, 1], n: [1, 0] },
    x1: { p: [x1, 0], q: [x1, 1], n: [-1, 0] },
  };
  const out = [];
  // floor and ceiling
  b.plane(s.floor || 'tiles', [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], [0, 1, 0], s.floorTile || 0.5, s.floorColor || [1, 1, 1]);
  const cl = s.ceiling || {};
  b.plane(cl.mat || 'plaster', [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], [0, -1, 0], cl.tile || 2, cl.color || C('#f0ebe2'));
  if (cl.boards) {
    // long boards along z, a dark line between them
    for (let x = x0; x < x1 - 0.01; x += 0.16) b.box('wood', Math.min(x + 0.08, x1 - 0.08), h - 0.022, (z0 + z1) / 2, Math.min(0.155, x1 - x), 0.02, z1 - z0, b.col(cl.color || C('#5a3a22'), 0.18), { r: 0, uv: [0.3, z1 - z0] });
  }
  for (const z of cl.beams || []) b.box('wood', (x0 + x1) / 2, h - 0.2, z, x1 - x0, 0.18, 0.16, mul(cl.color || C('#5a3a22'), 0.8), { r: 0.015, uv: [x1 - x0, 0.3] });

  for (const [name, w] of Object.entries(W)) {
    const ux = w.q[0] - w.p[0], uz = w.q[1] - w.p[1];                  // along the wall (+x or +z)
    const lo = ux ? x0 : z0, len = ux ? x1 : z1;                       // the wall goes from u = lo to u = len
    const P = (u, y) => [w.p[0] + ux * u, y, w.p[1] + uz * u];
    const N = [w.n[0], 0, w.n[1]];
    const holes = (s.holes || []).filter((o) => o.wall === name).sort((a, c) => a.a - c.a);
    // the wall around the openings, in upright strips
    const cuts = [lo];
    for (const o of holes) cuts.push(o.a, o.b);
    cuts.push(len);
    const quad = (mat, u0, u1, ya, yb, tile, color) => { if (u1 - u0 > 0.001 && yb - ya > 0.001) b.plane(mat, [P(u0, ya), P(u1, ya), P(u1, yb), P(u0, yb)], N, tile, color); };
    const dado = s.dado;
    const wallPart = (u0, u1, ya, yb) => {
      if (dado && ya < dado.h) {
        quad(dado.mat, u0, u1, ya, Math.min(yb, dado.h), dado.tile || 0.6, dado.color || [1, 1, 1]);
        quad(s.wall || 'plaster', u0, u1, Math.max(ya, dado.h), yb, s.wallTile || 2, s.wallColor || [1, 1, 1]);
      } else quad(s.wall || 'plaster', u0, u1, ya, yb, s.wallTile || 2, s.wallColor || [1, 1, 1]);
    };
    for (let i = 0; i < cuts.length - 1; i++) {
      const u0 = cuts[i], u1 = cuts[i + 1];
      const o = holes.find((hh) => Math.abs(hh.a - u0) < 1e-6 && Math.abs(hh.b - u1) < 1e-6);
      if (!o) { wallPart(u0, u1, 0, h); continue; }
      wallPart(u0, u1, 0, o.y0);
      wallPart(u0, u1, o.y1, h);
    }
    // a band of darker tiles on top of the lower wall (picture 2), and the skirting board
    if (dado && dado.border) for (let i = 0; i < cuts.length - 1; i++) {
      const u0 = cuts[i], u1 = cuts[i + 1], o = holes.find((hh) => Math.abs(hh.a - u0) < 1e-6);
      if (o && o.y0 < dado.h + 0.06) continue;
      const m = P((u0 + u1) / 2, 0);
      b.box('gloss', m[0] + N[0] * 0.008, dado.h - 0.03, m[2] + N[2] * 0.008, Math.abs(ux) * (u1 - u0) + Math.abs(uz) * 0.02, 0.06, Math.abs(uz) * (u1 - u0) + Math.abs(ux) * 0.02, dado.border, { r: 0.004 });
    }
    if (s.skirting) for (let i = 0; i < cuts.length - 1; i++) {
      const u0 = cuts[i], u1 = cuts[i + 1], o = holes.find((hh) => Math.abs(hh.a - u0) < 1e-6);
      if (o && o.y0 < 0.1) continue;
      const m = P((u0 + u1) / 2, 0);
      b.box('paint', m[0] + N[0] * 0.012, 0, m[2] + N[2] * 0.012, Math.abs(ux) * (u1 - u0) + Math.abs(uz) * 0.025, 0.1, Math.abs(uz) * (u1 - u0) + Math.abs(ux) * 0.025, s.skirting, { r: 0.006 });
    }
    // the openings: the wall's thickness around them (reveals), a frame on the wall, and what is in them
    for (const o of holes) {
      const T = o.depth === undefined ? 0.22 : o.depth;
      const back = (u, y, d) => { const p = P(u, y); return [p[0] - N[0] * d, y, p[2] - N[2] * d]; };
      const rev = s.reveal || s.wall || 'plaster', rc = s.revealColor || s.wallColor || [1, 1, 1];
      // the sides of the hole (they face into the hole). (depth 0: the room next door already made them)
      if (T > 0.001) {
        b.plane(rev, [P(o.a, o.y0), back(o.a, o.y0, T), back(o.a, o.y1, T), P(o.a, o.y1)], [ux, 0, uz], s.wallTile || 2, rc);
        b.plane(rev, [P(o.b, o.y0), back(o.b, o.y0, T), back(o.b, o.y1, T), P(o.b, o.y1)], [-ux, 0, -uz], s.wallTile || 2, rc);
        b.plane(rev, [P(o.a, o.y1), P(o.b, o.y1), back(o.b, o.y1, T), back(o.a, o.y1, T)], [0, -1, 0], s.wallTile || 2, rc);
        if (o.y0 > 0.01) b.plane(rev, [P(o.a, o.y0), P(o.b, o.y0), back(o.b, o.y0, T), back(o.a, o.y0, T)], [0, 1, 0], s.wallTile || 2, rc);
        // (a doorway between two rooms: a threshold board on the floor)
        if (o.kind === 'pass') { const m0 = back((o.a + o.b) / 2, 0, T / 2); b.box('wood', m0[0], 0, m0[2], Math.abs(ux) * (o.b - o.a) + Math.abs(uz) * (T + 0.04), 0.012, Math.abs(uz) * (o.b - o.a) + Math.abs(ux) * (T + 0.04), C('#6b4a2e'), { r: 0.004 }); }
      }
      // the middle of the opening on the wall, the direction along the wall and out of the room
      const mid = P((o.a + o.b) / 2, 0);
      const rot = Math.atan2(N[0], N[2]);                  // a frame whose +z looks into the room
      out.push({ ...o, wallName: name, x: mid[0], z: mid[2], nx: N[0], nz: N[2], rot, width: o.b - o.a, T });
    }
  }
  return out;
}

// the wooden frame around an opening, on the wall (o = an opening returned by shell)
export function casing(b, o, color, w = 0.07) {
  const P = frame(b, o.x, o.z, o.rot);
  const hw = o.width / 2;
  P.box('wood', -hw - w / 2, o.y0 > 0.01 ? o.y0 - w : 0, 0.012, w, (o.y1 - (o.y0 > 0.01 ? o.y0 - w : 0)) + w, 0.025, color, { r: 0.006 });
  P.box('wood', hw + w / 2, o.y0 > 0.01 ? o.y0 - w : 0, 0.012, w, (o.y1 - (o.y0 > 0.01 ? o.y0 - w : 0)) + w, 0.025, color, { r: 0.006 });
  P.box('wood', 0, o.y1, 0.012, o.width + w * 2.4, w * 1.2, 0.03, color, { r: 0.008 });
}

// A WINDOW in an opening: the sash with small panes, glass, a deep sill inside, the view outside.
//   panes: [columns, rows], curtains: { color, kind: 'sheer' | 'heavy' } | null, shutters: colour | null
export function windowIn(b, o, o2 = {}) {
  const P = frame(b, o.x, o.z, o.rot);
  const hw = o.width / 2, T = o.T, hgt = o.y1 - o.y0;
  const wood = o2.color || C('#e9e2d2'), cols = (o2.panes || [2, 2])[0], rows = (o2.panes || [2, 2])[1];
  const zs = -T * 0.62;                                  // the sash sits deep in the wall (z < 0 is outside)
  // sash frame and bars
  P.box('paint', 0, o.y0, zs, o.width, 0.06, 0.06, wood, { r: 0.008 });
  P.box('paint', 0, o.y1 - 0.06, zs, o.width, 0.06, 0.06, wood, { r: 0.008 });
  P.box('paint', -hw + 0.03, o.y0, zs, 0.06, hgt, 0.06, wood, { r: 0.008 });
  P.box('paint', hw - 0.03, o.y0, zs, 0.06, hgt, 0.06, wood, { r: 0.008 });
  for (let i = 1; i < cols; i++) P.box('paint', -hw + (o.width * i) / cols, o.y0, zs, 0.035, hgt, 0.045, wood, { r: 0.006 });
  for (let j = 1; j < rows; j++) P.box('paint', 0, o.y0 + (hgt * j) / rows - 0.0175, zs, o.width, 0.035, 0.045, wood, { r: 0.006 });
  // glass (a little reflection) and the view outside, two meters away
  P.geo('pane', new THREE.PlaneGeometry(o.width - 0.04, hgt - 0.04), 0, o.y0 + hgt / 2, zs - 0.01, 0, [1, 1, 1]);
  const vw = Math.max(3.2, o.width * 3.4), vh = Math.max(2.6, hgt * 2.6);
  const vg = new THREE.PlaneGeometry(vw, vh);
  P.geo('view', vg, (o2.viewShift || 0), o.y0 + hgt / 2 + 0.35, -T - 1.6, 0, [1, 1, 1]);
  // the sill inside: a thick board that sticks out a little
  if (o.y0 > 0.3) { const s0 = zs + 0.03, s1 = 0.06; P.box('paint', 0, o.y0 - 0.035, (s0 + s1) / 2, o.width + 0.14, 0.04, s1 - s0, mul(wood, 0.96), { r: 0.01 }); }
  // curtains: two cloths with folds, on a thin rod, pulled to the sides
  if (o2.curtains) {
    const cc = o2.curtains.color, top = o.y1 + 0.12, ch = top - (o2.curtains.long ? 0.05 : o.y0 - 0.12);
    P.cyl('metal', 0, top + 0.02, 0.06, 0.008, 0.008, o.width + 0.5, DARK, 8, [0, 0, Math.PI / 2]);
    for (const sx of [-1, 1]) {
      const cw = (o2.curtains.width || 0.42);
      P.geo('curtain', curtainGeo(cw, ch, 7 + Math.round(cw * 6), 0.035), sx * (hw + 0.1 - cw * 0.25), top - ch / 2, 0.075, 0, cc);
    }
  }
  // little wooden shutters, open against the wall on both sides (picture 3)
  if (o2.shutters) for (const sx of [-1, 1]) shutter(P, sx * (hw + 0.07 + 0.16), o.y0 - 0.02, 0.02, 0.32, hgt + 0.04, o2.shutters);
  return P;
}

// a curtain: a cloth hanging in soft folds (w wide, h high, n folds, a = how deep the folds are)
function curtainGeo(w, h, n, a) {
  const g = new THREE.PlaneGeometry(w, h, n * 4, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const k = 0.75 + 0.25 * ((y / h) + 0.5);             // the folds open a little toward the bottom
    p.setZ(i, Math.sin((x / w + 0.5) * n * TAU * 0.5) * a * k);
  }
  g.computeVertexNormals();
  return g;
}

// a louvered shutter (slats), standing open against the wall
export function shutter(P, x, y, z, w, h, color) {
  P.box('paint', x - w / 2 + 0.02, y, z, 0.04, h, 0.03, color, { r: 0.006 });
  P.box('paint', x + w / 2 - 0.02, y, z, 0.04, h, 0.03, color, { r: 0.006 });
  P.box('paint', x, y, z, w, 0.04, 0.03, color, { r: 0.006 });
  P.box('paint', x, y + h - 0.04, z, w, 0.04, 0.03, color, { r: 0.006 });
  for (let yy = y + 0.07; yy < y + h - 0.07; yy += 0.055) P.box('paint', x, yy, z, w - 0.06, 0.035, 0.012, mul(color, 0.92), { r: 0.003, tilt: 0.5 });
}

// A DOOR LEAF (a wooden door with panels): its frame is at the hinge side, x from 0 to w. Returns nothing.
export function doorLeaf(P, w, h, color, o = {}) {
  const t = 0.045;
  P.box('wood', w / 2, 0, 0, w, h, t, color, { r: 0.01, uv: [1, h] });
  // four sunk panels (a little lighter) and a round brass knob
  const pw = (w - 0.24) / 2;
  for (const [cx, cy, ph] of [[0.09 + pw / 2, 0.12, h * 0.42], [w - 0.09 - pw / 2, 0.12, h * 0.42], [0.09 + pw / 2, h * 0.58, h * 0.34], [w - 0.09 - pw / 2, h * 0.58, h * 0.34]]) {
    for (const sz of [-1, 1]) P.box('wood', cx, cy, sz * (t / 2 + 0.002), pw, ph, 0.012, mul(color, 1.06), { r: 0.012 });
  }
  if (o.glass) P.box('glass', w / 2, h * 0.62, 0, w - 0.3, h * 0.26, t + 0.006, C('#cfd8da'), { r: 0.01 });
  for (const sz of [-1, 1]) { P.sphere('metal', w - 0.08, 1.0, sz * (t / 2 + 0.04), 0.028, o.knob || BRASS, 12); P.cyl('metal', w - 0.08, 1.0, sz * (t / 2 + 0.02), 0.008, 0.008, 0.04, o.knob || BRASS, 8, [Math.PI / 2, 0, 0]); }
  P.box('metal', w - 0.08, 0.93, 0, 0.04, 0.1, t + 0.012, o.knob || BRASS, { r: 0.006 });
}

// ============================================================ tables and chairs
export function table(P, o = {}) {
  const w = o.w || 1.3, d = o.d || 0.82, h = o.h || 0.76, wood = o.color || C('#86552f'), top = 0.045;
  P.box('wood', 0, h - top, 0, w, top, d, P.col(wood), { r: 0.012, uv: [w, d] });
  const ap = 0.1, inset = 0.07, aw = mul(wood, 0.86);
  P.box('wood', 0, h - top - ap, d / 2 - inset, w - 2 * inset, ap, 0.025, aw);
  P.box('wood', 0, h - top - ap, -d / 2 + inset, w - 2 * inset, ap, 0.025, aw);
  P.box('wood', w / 2 - inset, h - top - ap, 0, 0.025, ap, d - 2 * inset, aw);
  P.box('wood', -w / 2 + inset, h - top - ap, 0, 0.025, ap, d - 2 * inset, aw);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset - 0.01), z = sz * (d / 2 - inset - 0.01);
    P.lathe('wood', x, 0, z, LEG(h - top), mul(wood, 0.92), 10);
    P.shadow(x, z, 0.08, 0.08, 0.8);
  }
  P.shadow(0, 0, w * 0.6, d * 0.62, 0.5);
  if (o.solid !== false) P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}

// a chair with a back of thin round spindles (picture 1). Its front (+z) is where the knees go.
export function chair(P, o = {}) {
  const wood = o.color || C('#74472a'), sh = 0.45, sw = 0.43, sd = 0.41;
  P.box('wood', 0, sh - 0.035, 0, sw, 0.035, sd, P.col(wood), { r: 0.016 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (sw / 2 - 0.045), z = sz * (sd / 2 - 0.045);
    P.cyl('wood', x + sx * 0.01, (sh - 0.035) / 2, z + sz * 0.01, 0.018, 0.015, sh - 0.03, mul(wood, 0.9), 8, [-sz * 0.05, 0, sx * 0.05]);
    P.shadow(x + sx * 0.02, z + sz * 0.02, 0.055, 0.055, 0.7);
  }
  // rungs between the legs
  P.cyl('wood', 0, 0.17, sd / 2 - 0.05, 0.009, 0.009, sw - 0.1, mul(wood, 0.85), 6, [0, 0, Math.PI / 2]);
  P.cyl('wood', 0, 0.17, -sd / 2 + 0.05, 0.009, 0.009, sw - 0.1, mul(wood, 0.85), 6, [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) P.cyl('wood', sx * (sw / 2 - 0.05), 0.22, 0, 0.009, 0.009, sd - 0.1, mul(wood, 0.85), 6, [Math.PI / 2, 0, 0]);
  // the back: two posts, a curved top rail, five spindles (leaning back a little)
  const bz = -sd / 2 + 0.03;
  for (const sx of [-1, 1]) P.cyl('wood', sx * (sw / 2 - 0.035), sh + 0.22, bz - 0.022, 0.017, 0.014, 0.47, wood, 8, [-0.1, 0, 0]);
  P.box('wood', 0, sh + 0.39, bz - 0.045, sw - 0.01, 0.08, 0.03, mul(wood, 1.05), { r: 0.013, tilt: -0.1 });
  for (let i = 0; i < 5; i++) P.cyl('wood', -0.13 + i * 0.065, sh + 0.2, bz - 0.02, 0.0085, 0.0085, 0.38, mul(wood, 0.96), 6, [-0.1, 0, 0]);
  P.shadow(0, 0, 0.3, 0.3, 0.42);
  P.solid(-sw / 2 + 0.03, -sd / 2 + 0.03, sw / 2 - 0.03, sd / 2 - 0.03, sh);
}

// a plain kitchen chair with a padded seat (the flat, picture 2)
export function chairPadded(P, o = {}) {
  const frameC = o.color || CHROME, pad = o.pad || C('#b8463a'), sh = 0.46, sw = 0.42, sd = 0.42;
  P.box('cloth', 0, sh - 0.06, 0, sw, 0.07, sd, pad, { r: 0.03 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P.cyl('metal', sx * (sw / 2 - 0.03), 0, sz * (sd / 2 - 0.03), 0.012, 0.012, sh - 0.06, frameC, 8); P.shadow(sx * (sw / 2 - 0.03), sz * (sd / 2 - 0.03), 0.05, 0.05, 0.6); }
  for (const sx of [-1, 1]) P.cyl('metal', sx * (sw / 2 - 0.03), sh + 0.2, -sd / 2 + 0.03, 0.012, 0.012, 0.42, frameC, 8);
  P.box('cloth', 0, sh + 0.2, -sd / 2 + 0.035, sw - 0.02, 0.2, 0.05, pad, { r: 0.025 });
  P.shadow(0, 0, 0.3, 0.3, 0.4);
  P.solid(-sw / 2 + 0.03, -sd / 2 + 0.03, sw / 2 - 0.03, sd / 2 - 0.03, sh);
}

// ============================================================ the kitchen of picture 1
// an old enamel stove with an oven (front = +z)
export function stove(P, o = {}) {
  const w = o.w || 0.78, d = 0.62, h = 0.86, en = o.color || C('#e7dfc9'), trim = o.trim || DARK;
  P.box('gloss', 0, 0.06, 0, w, h - 0.06, d, en, { r: 0.035 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl('metal', sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.022, 0.018, 0.06, DARK, 8);
  // the cooking top with four burners
  P.box('paint', 0, h, 0.02, w - 0.03, 0.022, d - 0.06, trim, { r: 0.008 });
  for (const [x, z, r] of [[-0.19, 0.13, 0.09], [0.19, 0.13, 0.075], [-0.19, -0.12, 0.075], [0.19, -0.12, 0.09]]) {
    P.torus('metal', x, h + 0.034, z, r, 0.009, C('#2b2926'), [Math.PI / 2, 0, 0]);
    P.box('metal', x, h + 0.022, z, r * 2, 0.012, 0.014, C('#2b2926'), { r: 0.003 });
    P.box('metal', x, h + 0.022, z, 0.014, 0.012, r * 2, C('#2b2926'), { r: 0.003 });
    P.cyl('metal', x, h + 0.02, z, r * 0.4, r * 0.36, 0.016, C('#45423e'), 14);
  }
  // the raised back with the knobs
  P.box('gloss', 0, h - 0.01, -d / 2 + 0.035, w, 0.2, 0.07, en, { r: 0.025 });
  for (let i = 0; i < 4; i++) P.cyl('paint', -0.25 + i * (0.5 / 3), h + 0.1, -d / 2 + 0.085, 0.022, 0.02, 0.035, trim, 14, [Math.PI / 2, 0, 0]);
  // the oven door: a window, a chrome bar
  P.box('gloss', 0, 0.17, d / 2, w - 0.08, 0.5, 0.03, mul(en, 0.98), { r: 0.022 });
  P.box('glass', 0, 0.3, d / 2 + 0.016, w - 0.32, 0.19, 0.012, C('#3a3028'), { r: 0.012 });
  P.cyl('metal', 0, 0.7, d / 2 + 0.05, 0.012, 0.012, w - 0.18, CHROME, 12, [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) P.box('metal', sx * (w / 2 - 0.12), 0.685, d / 2 + 0.01, 0.022, 0.03, 0.045, CHROME, { r: 0.004 });
  P.box('gloss', 0, 0.075, d / 2, w - 0.08, 0.075, 0.026, mul(en, 0.95), { r: 0.012 });
  P.shadow(0, 0, w * 0.6, d * 0.6, 0.75);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}

// a cooking pot with a lid (red enamel in picture 1)
export function pot(P, x, y, z, color, s = 1) {
  P.lathe('gloss', x, y, z, [[0, 0], [0.1, 0], [0.11, 0.012], [0.11, 0.12], [0.116, 0.126], [0.104, 0.126], [0.1, 0.014], [0, 0.014]], color, 22, s);
  P.lathe('gloss', x, y + 0.122 * s, z, [[0, 0.012], [0.112, 0], [0.104, 0.014], [0.04, 0.034], [0.018, 0.05], [0, 0.056]], color, 22, s);
  for (const sx of [-1, 1]) P.box('metal', x + sx * 0.125 * s, y + 0.09 * s, z, 0.04 * s, 0.014 * s, 0.05 * s, DARK, { r: 0.005 });
}
// a kettle
export function kettle(P, x, y, z, color = CHROME) {
  P.lathe('metal', x, y, z, [[0, 0], [0.085, 0], [0.095, 0.03], [0.09, 0.1], [0.06, 0.15], [0.03, 0.165], [0, 0.17]], color, 20);
  P.torus('paint', x, y + 0.19, z, 0.07, 0.009, DARK, [0, 0, 0], Math.PI);
  P.cyl('metal', x + 0.1, y + 0.1, z, 0.016, 0.01, 0.12, color, 10, [0, 0, -0.9]);
}
// a teapot with a spout and a handle
export function teapot(P, x, y, z, color) {
  P.lathe('gloss', x, y, z, TPOT, color, 20);
  P.sphere('gloss', x, y + 0.138, z, 0.016, color, 10);
  P.cyl('gloss', x + 0.1, y + 0.07, z, 0.014, 0.008, 0.1, color, 10, [0, 0, -0.95]);
  P.torus('gloss', x - 0.088, y + 0.065, z, 0.035, 0.008, color, [0, 0, Math.PI / 2], Math.PI);
}
export function plate(P, x, y, z, color = WHITE, rim = null, s = 1) {
  P.lathe('gloss', x, y, z, PLATE, color, 24, s);
  if (rim) P.torus('gloss', x, y + 0.02 * s, z, 0.112 * s, 0.004, rim, [Math.PI / 2, 0, 0]);
}
export function cup(P, x, y, z, color = WHITE, turn = 0) {
  P.lathe('gloss', x, y, z, CUP, color, 16);
  P.torus('gloss', x + Math.cos(turn) * 0.045, y + 0.04, z - Math.sin(turn) * 0.045, 0.02, 0.0045, color, [0, turn, 0], Math.PI * 1.2);
}
export function mug(P, x, y, z, color, turn = 0) {
  P.lathe('gloss', x, y, z, MUG, color, 16);
  P.torus('gloss', x + Math.cos(turn) * 0.048, y + 0.05, z - Math.sin(turn) * 0.048, 0.026, 0.006, color, [0, turn, -Math.PI / 2], Math.PI);
}
export function bottle(P, x, y, z, color = C('#2f6b3a'), s = 1) {
  P.lathe('glass', x, y, z, BOTTLE, color, 14, s);
  P.cyl('paint', x, y + 0.29 * s, z, 0.014 * s, 0.014 * s, 0.025 * s, C('#6a4a2a'), 8);
}
export function jar(P, x, y, z, fill, s = 1, lid = C('#b0b2b4')) {
  P.cyl('paint', x, y + 0.008, z, 0.043 * s, 0.043 * s, 0.11 * s, fill, 12);
  P.lathe('glass', x, y, z, JAR, C('#c9d4d6'), 14, s);
  P.cyl('metal', x, y + 0.155 * s, z, 0.047 * s, 0.047 * s, 0.022 * s, lid, 14);
}
export function bowl(P, x, y, z, color, s = 1) { P.lathe('gloss', x, y, z, BOWL, color, 18, s); }
// a bowl of fruit: oranges and apples
export function fruitBowl(P, x, y, z) {
  bowl(P, x, y, z, C('#e9e1cf'), 1.35);
  const R = P.R;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + R(); P.sphere('gloss', x + Math.cos(a) * 0.045, y + 0.06 + (i % 2) * 0.03, z + Math.sin(a) * 0.045, 0.034, i % 3 ? C('#e07a1c') : C('#b5281e'), 10); }
}
// a vase with a few flowers
export function flowers(P, x, y, z, color = C('#d8d2c4'), bloom = C('#e8b830')) {
  P.lathe('gloss', x, y, z, VASE, color, 14);
  const R = P.R;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + R() * 0.5, l = 0.14 + R() * 0.08, tx = Math.cos(a) * 0.05, tz = Math.sin(a) * 0.05;
    P.cyl('paint', x + tx * 0.5, y + 0.15 + l / 2, z + tz * 0.5, 0.0035, 0.0035, l, C('#4d6b2e'), 5, [tz * 4, 0, -tx * 4]);
    P.sphere('cloth', x + tx, y + 0.15 + l, z + tz, 0.022, i % 2 ? bloom : mix(bloom, WHITE, 0.6), 8);
  }
}
// a loaf of bread on a board
export function bread(P, x, y, z, turn = 0) {
  P.box('wood', x, y, z, 0.38, 0.02, 0.22, C('#a57345'), { r: 0.008, rot: turn });
  P.box('cloth', x, y + 0.02, z, 0.22, 0.08, 0.11, C('#c78a45'), { r: 0.045, rot: turn });
}
// a pan hanging on the wall by its handle (copper in picture 1); the wall is behind it (-z)
export function hangingPan(P, x, y, z, r, color = COPPER) {
  // the pan stands on its edge against the wall: its bottom faces the room
  P.lathe('metal', x, y - r, z + 0.05, [[0, 0], [r * 0.85, 0], [r, r * 0.35], [r * 0.97, r * 0.36], [r * 0.82, 0.008], [0, 0.008]], color, 22, 1, [-Math.PI / 2, 0, 0]);
  P.cyl('metal', x, y + 0.1, z + 0.02, 0.009, 0.009, 0.2, mul(color, 0.8), 8);
  P.torus('metal', x, y + 0.21, z + 0.02, 0.012, 0.003, DARK, [0, 0, 0]);
}
// a ladle, a spoon or a whisk hanging from a hook (handle up)
export function utensil(P, x, y, z, kind = 'ladle', color = CHROME) {
  P.cyl('metal', x, y - 0.14, z, 0.006, 0.006, 0.28, kind === 'spoon' ? C('#8a5a34') : color, 6);
  if (kind === 'ladle') P.lathe('metal', x, y - 0.33, z + 0.02, [[0, 0], [0.035, 0.005], [0.045, 0.03], [0.043, 0.032], [0.03, 0.008], [0, 0.005]], color, 12, 1, [-0.6, 0, 0]);
  else if (kind === 'whisk') for (let i = 0; i < 4; i++) P.torus('metal', x, y - 0.33, z, 0.03, 0.002, color, [0, (i / 4) * Math.PI, 0]);
  else P.sphere(kind === 'spoon' ? 'wood' : 'metal', x, y - 0.3, z + 0.01, 0.026, kind === 'spoon' ? C('#8a5a34') : color, 8);
  P.torus('metal', x, y + 0.01, z, 0.01, 0.002, DARK, [0, 0, 0]);
}
// a colander (a metal bowl with handles)
export function colander(P, x, y, z, color = C('#c6c8c4')) {
  P.lathe('metal', x, y, z, [[0, 0], [0.08, 0.005], [0.11, 0.05], [0.12, 0.09], [0.115, 0.092], [0.104, 0.052], [0.075, 0.012], [0, 0.008]], color, 18, 1, [-Math.PI / 2 + 0.25, 0, 0]);
}
// a rail on the wall with hooks
export function rail(P, x0, x1, y, z = 0.03) {
  P.cyl('metal', (x0 + x1) / 2, y, z, 0.008, 0.008, x1 - x0, mul(CHROME, 0.8), 8, [0, 0, Math.PI / 2]);
  for (const x of [x0 + 0.02, x1 - 0.02]) P.box('metal', x, y - 0.015, z / 2, 0.02, 0.03, z, DARK, { r: 0.004 });
}

// THE DRESSER of picture 1: drawers and doors below, open shelves with plates above (front = +z)
export function hutch(P, o = {}) {
  const w = o.w || 1.2, d = 0.48, wood = o.color || C('#6e4426'), top = 0.9, H = o.h || 2.15, ud = 0.27;
  const knob = BRASS, lit = mul(wood, 1.06);
  P.box('wood', 0, 0.07, 0, w, top - 0.07, d, wood, { r: 0.01, uv: [w, 1] });
  P.box('wood', 0, 0, 0, w - 0.05, 0.07, d - 0.07, mul(wood, 0.55), { r: 0.004 });
  P.box('wood', 0, top, 0.01, w + 0.04, 0.035, d + 0.04, lit, { r: 0.01, uv: [w, d] });
  for (const sx of [-1, 1]) {
    P.box('wood', sx * w / 4, top - 0.2, d / 2, w / 2 - 0.05, 0.16, 0.022, lit, { r: 0.008 });
    P.sphere('metal', sx * w / 4, top - 0.12, d / 2 + 0.03, 0.017, knob, 10);
    P.box('wood', sx * w / 4, 0.1, d / 2, w / 2 - 0.05, 0.56, 0.022, lit, { r: 0.008 });
    P.box('wood', sx * w / 4, 0.17, d / 2 + 0.013, w / 2 - 0.16, 0.42, 0.012, mul(wood, 0.93), { r: 0.005 });
    P.sphere('metal', sx * 0.05, 0.47, d / 2 + 0.035, 0.015, knob, 10);
  }
  // the upper part (it stands at the back of the counter)
  const z0 = -d / 2 + ud / 2;
  P.box('wood', 0, top + 0.035, -d / 2 + 0.012, w - 0.03, H - top - 0.035, 0.02, mul(wood, 0.8));
  for (const sx of [-1, 1]) P.box('wood', sx * (w / 2 - 0.016), top + 0.035, z0, 0.032, H - top - 0.035, ud, wood, { r: 0.006 });
  const shelves = [top + 0.44, top + 0.84];
  for (const y of shelves) { P.box('wood', 0, y, z0, w - 0.05, 0.026, ud, wood, { r: 0.005 }); P.box('wood', 0, y + 0.05, z0 + ud / 2 - 0.02, w - 0.05, 0.018, 0.01, lit); }
  P.box('wood', 0, H, z0 + 0.012, w + 0.07, 0.065, ud + 0.07, lit, { r: 0.014 });
  // plates standing on the shelves, cups hanging under them
  const R = P.R;
  for (const y of shelves) {
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 0.17 + i * ((w - 0.34) / 3);
      P.lathe('gloss', x, y + 0.14, z0 - 0.03, PLATE, mix(WHITE, C('#e6dcc4'), R() * 0.5), 24, 1.05, [1.32, 0, 0]);
      // (a blue line on the rim, like the plates of picture 1)
      P.torus('gloss', x, y + 0.145, z0 - 0.011, 0.112 * 1.05, 0.0042, C('#36628f'), [-0.25, 0, 0]);
    }
  }
  // cups in front of the plates on the lower shelf, bowls on the upper one
  for (let i = 0; i < 3; i++) cup(P, -w / 2 + 0.26 + i * ((w - 0.52) / 2), shelves[0] + 0.026, z0 + 0.07, i % 2 ? C('#dfe8ee') : C('#f0e6d0'), 0.5 + i);
  for (let i = 0; i < 2; i++) bowl(P, -w / 4 + i * (w / 2), shelves[1] + 0.026, z0 + 0.07, C('#e4d8bf'), 1.1);
  P.shadow(0, 0, w * 0.58, d * 0.62, 0.8);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, H);
  return { top, shelves, z0, d };
}

// a small radio with a cloth speaker and two knobs
export function radio(P, x, y, z, color = C('#7a4b2a')) {
  P.box('wood', x, y, z, 0.26, 0.16, 0.11, color, { r: 0.03 });
  P.box('cloth', x - 0.035, y + 0.03, z + 0.052, 0.14, 0.1, 0.01, C('#d8c8a0'), { r: 0.01 });
  for (const k of [0.07, 0.1]) P.cyl('paint', x + k, y + 0.07, z + 0.06, 0.012, 0.012, 0.015, C('#e8e0cc'), 10, [Math.PI / 2, 0, 0]);
}
// a candle in a brass holder (the flame glows)
export function candle(P, x, y, z) {
  P.lathe('metal', x, y, z, [[0, 0], [0.05, 0], [0.05, 0.008], [0.015, 0.012], [0.012, 0.05], [0.025, 0.06], [0, 0.062]], BRASS, 16);
  P.cyl('paint', x, y + 0.06, z, 0.011, 0.011, 0.11, C('#f3ecd8'), 10);
  P.lathe('glow', x, y + 0.172, z, [[0, 0], [0.006, 0.006], [0.0045, 0.02], [0, 0.032]], [3.2, 1.8, 0.7], 8);
}
// books: a row standing (count, starting at x, going +x) or a pile lying
export function books(P, x, y, z, n, o = {}) {
  const R = P.R, pal = o.colors || ['#8b2f2a', '#2f4f6f', '#c99a3e', '#3f5f3a', '#6d4a7a', '#d8cdb5', '#22303a', '#a45a2a'].map(C);
  let px = x;
  for (let i = 0; i < n; i++) {
    const c = pal[Math.floor(R() * pal.length)], t = 0.025 + R() * 0.03, hh = (o.h || 0.22) * (0.8 + R() * 0.25), dd = (o.d || 0.16) * (0.85 + R() * 0.15);
    if (o.lying) { P.box('paint', x + (R() - 0.5) * 0.02, y + i * 0.035, z, hh, 0.033, dd, c, { r: 0.006, rot: (R() - 0.5) * 0.3 }); continue; }
    const lean = i === n - 1 && o.lean ? -0.25 : 0;
    P.box('paint', px + t / 2, y, z, t, hh, dd, c, { r: 0.005, roll: lean });
    px += t + 0.002;
  }
  return px;
}
// a plant in a clay pot (leaves: soft green balls of different sizes)
export function plant(P, x, y, z, s = 1, o = {}) {
  P.lathe('paint', x, y, z, POTPLANT, o.pot || C('#b5643a'), 16, s);
  const R = P.R, leaf = o.leaf || C('#4f7a35');
  for (let i = 0; i < (o.n || 9); i++) {
    const a = R() * TAU, r = R() * 0.08 * s, hh = (0.2 + R() * (o.tall || 0.22)) * s;
    P.sphere('cloth', x + Math.cos(a) * r, y + hh, z + Math.sin(a) * r, (0.05 + R() * 0.04) * s, mul(leaf, 0.75 + R() * 0.5), 8);
  }
}
// a tall leafy plant in the corner (stems and big leaves)
const LEAF = (() => {
  // one long leaf: a thin, bent blade (pointed at the tip), made once
  const g = new THREE.PlaneGeometry(0.11, 0.42, 1, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.21, k = y / 0.42;                       // 0 at the stem .. 1 at the tip
    p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, k * 1.15 + 0.08)) * (1 - 0.35 * k));
    p.setY(i, y);
    p.setZ(i, -0.16 * k * k);                                     // it bends over
  }
  g.computeVertexNormals();
  return twoSided(g);
})();
// a flat shape seen from both sides (a leaf): the same triangles again, turned the other way
function twoSided(g) {
  const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv.array, idx = g.index.array;
  const n = pos.length / 3, out = new THREE.BufferGeometry();
  const P2 = new Float32Array(pos.length * 2), N2 = new Float32Array(nor.length * 2), U2 = new Float32Array(uv.length * 2);
  P2.set(pos); P2.set(pos, pos.length); U2.set(uv); U2.set(uv, uv.length);
  N2.set(nor); for (let i = 0; i < nor.length; i++) N2[nor.length + i] = -nor[i];
  const I2 = [];
  for (let i = 0; i < idx.length; i += 3) { I2.push(idx[i], idx[i + 1], idx[i + 2]); I2.push(n + idx[i], n + idx[i + 2], n + idx[i + 1]); }
  out.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N2, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
  out.setIndex(I2);
  return out;
}
export function bigPlant(P, x, z) {
  P.lathe('paint', x, 0, z, POTPLANT, C('#6f6a60'), 16, 1.9);
  P.cyl('paint', x, 0.3, z, 0.17, 0.17, 0.01, C('#3a2a1e'), 14);
  const R = P.R;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU * 2.3 + R() * 0.6, h = 0.35 + R() * 1.0, lean = 0.12 + R() * 0.3;
    // a thin stem leaning out, and a leaf at its end that bends over
    P.cyl('paint', x + Math.cos(a) * lean * h * 0.5, 0.3 + h / 2, z + Math.sin(a) * lean * h * 0.5, 0.006, 0.005, h, C('#4b5a2a'), 5, [Math.sin(a) * lean, 0, -Math.cos(a) * lean]);
    P.geo('cloth', LEAF.clone(), x + Math.cos(a) * lean * h, 0.28 + h, z + Math.sin(a) * lean * h, -a - Math.PI / 2, mul(C('#3f6e2e'), 0.7 + R() * 0.6), [-(0.15 + R() * 0.45), 0, 0]);
  }
  P.shadow(x, z, 0.3, 0.3, 0.7);
  P.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 1.2);
}
// a wooden crate with vegetables
export function crate(P, x, y, z, rot = 0, veg = 'onion') {
  const Q = P.sub(x, z, rot, y), wood = C('#b08a5a');
  for (const sz of [-1, 1]) for (let j = 0; j < 3; j++) Q.box('wood', 0, 0.02 + j * 0.09, sz * 0.17, 0.46, 0.07, 0.018, mul(wood, 0.9 + j * 0.05), { r: 0.004 });
  for (const sx of [-1, 1]) for (let j = 0; j < 3; j++) Q.box('wood', sx * 0.22, 0.02 + j * 0.09, 0, 0.018, 0.07, 0.34, wood, { r: 0.004 });
  Q.box('wood', 0, 0, 0, 0.46, 0.02, 0.34, mul(wood, 0.8));
  const R = P.R, c = veg === 'onion' ? C('#b9772e') : veg === 'potato' ? C('#9c7a4a') : C('#c8451e');
  for (let i = 0; i < 12; i++) Q.sphere('gloss', (R() - 0.5) * 0.34, 0.2 + R() * 0.06, (R() - 0.5) * 0.22, 0.04 + R() * 0.012, mul(c, 0.8 + R() * 0.4), 8);
}

// a plain wooden work table with a shelf under it (picture 1, left wall)
export function workTable(P, o = {}) {
  const w = o.w || 1.4, d = o.d || 0.6, h = 0.86, wood = o.color || C('#9a6a3e');
  P.box('wood', 0, h - 0.05, 0, w, 0.05, d, P.col(wood), { r: 0.01, uv: [w, d] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P.box('wood', sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 0.06, h - 0.05, 0.06, mul(wood, 0.85), { r: 0.008 }); P.shadow(sx * (w / 2 - 0.05), sz * (d / 2 - 0.05), 0.07, 0.07, 0.7); }
  P.box('wood', 0, 0.16, 0, w - 0.06, 0.025, d - 0.06, mul(wood, 0.8), { r: 0.006 });
  P.shadow(0, 0, w * 0.58, d * 0.6, 0.55);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
  return h;
}
// a wall shelf (a board on two brackets); things are put on it by the room
export function wallShelf(P, x, y, z, w, d = 0.2, color = C('#8a5a34')) {
  P.box('wood', x, y, z + d / 2, w, 0.03, d, color, { r: 0.006 });
  for (const sx of [-1, 1]) P.box('wood', x + sx * (w / 2 - 0.08), y - 0.12, z + 0.06, 0.025, 0.12, 0.12, mul(color, 0.85), { r: 0.004 });
  return y + 0.03;
}
// a dish rack with plates standing in it
export function dishRack(P, x, y, z, rot = 0) {
  const Q = P.sub(x, z, rot, y), wood = C('#a87a4a');
  for (const sx of [-1, 1]) { Q.box('wood', sx * 0.17, 0, 0, 0.02, 0.06, 0.26, wood); Q.box('wood', sx * 0.17, 0.2, 0, 0.02, 0.02, 0.26, wood); }
  for (let i = 0; i < 9; i++) Q.cyl('wood', -0.17 + i * 0.0425, 0.11, 0.1, 0.004, 0.004, 0.2, wood, 5);
  for (let i = 0; i < 5; i++) Q.lathe('gloss', -0.12 + i * 0.06, 0.13, 0, PLATE, i % 2 ? WHITE : C('#dfe7ea'), 22, 1, [0, 0, Math.PI / 2 - 0.08]);
}
// a sink: a white basin in a wooden cabinet top, a tap (front = +z)
export function sinkCabinet(P, o = {}) {
  const w = o.w || 1.3, d = 0.6, h = 0.88, wood = o.color || C('#7a5634'), top = o.top || C('#c9b79a');
  P.box('wood', 0, 0.08, 0, w, h - 0.08 - 0.04, d, wood, { r: 0.01 });
  P.box('wood', 0, 0, 0, w - 0.06, 0.08, d - 0.08, mul(wood, 0.55));
  P.box(o.topMat || 'wood', 0, h - 0.04, 0.005, w + 0.03, 0.04, d + 0.03, top, { r: 0.008, uv: [w, d] });
  const doors = Math.max(2, Math.round(w / 0.45));
  for (let i = 0; i < doors; i++) {
    const dw = (w - 0.06) / doors, x = -w / 2 + 0.03 + dw * (i + 0.5);
    P.box('wood', x, 0.12, d / 2, dw - 0.02, h - 0.25, 0.02, mul(wood, 1.06), { r: 0.008 });
    P.box('wood', x, 0.18, d / 2 + 0.012, dw - 0.12, h - 0.37, 0.01, mul(wood, 0.95), { r: 0.005 });
    P.box('metal', x + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), 0.58, d / 2 + 0.025, 0.014, 0.08, 0.014, BRASS, { r: 0.005 });
  }
  // the basin (white, deep) and a tap
  const sx = o.sinkX || 0;
  P.box('gloss', sx, h - 0.03, 0.03, 0.56, 0.05, 0.44, WHITE, { r: 0.02 });
  P.box('gloss', sx, h - 0.2, 0.03, 0.48, 0.18, 0.36, mul(WHITE, 0.7), { r: 0.04 });
  P.cyl('metal', sx, h + 0.02, -0.19, 0.018, 0.016, 0.24, CHROME, 12);
  P.cyl('metal', sx, h + 0.24, -0.13, 0.012, 0.012, 0.14, CHROME, 10, [Math.PI / 2, 0, 0]);
  for (const k of [-1, 1]) P.cyl('metal', sx + k * 0.08, h + 0.02, -0.2, 0.016, 0.014, 0.06, CHROME, 10);
  P.shadow(0, 0, w * 0.58, d * 0.6, 0.75);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
  return h;
}

// ============================================================ the retro kitchen of picture 2
// a big rounded cream fridge with chrome handle (front = +z); notes stuck on its door
export function fridge(P, o = {}) {
  const w = 0.74, d = 0.68, h = 1.66, c = o.color || C('#efe6cf');
  P.box('gloss', 0, 0.06, 0, w, h - 0.06, d, c, { r: 0.12 });
  P.box('paint', 0, 0, 0, w - 0.1, 0.07, d - 0.12, DARK, { r: 0.01 });
  // the door line, the chrome handle and a little badge (no brand name)
  P.box('paint', 0, h * 0.67, d / 2 - 0.004, w - 0.16, 0.006, 0.012, mul(c, 0.7));
  P.box('metal', w / 2 - 0.1, h * 0.43, d / 2 + 0.035, 0.035, 0.3, 0.03, CHROME, { r: 0.014 });
  for (const yy of [h * 0.43, h * 0.43 + 0.28]) P.box('metal', w / 2 - 0.1, yy, d / 2 + 0.005, 0.03, 0.03, 0.04, CHROME, { r: 0.008 });
  P.box('metal', 0, h - 0.24, d / 2 - 0.01, 0.16, 0.035, 0.03, CHROME, { r: 0.012 });
  // notes and a drawing (paper atlas cells), held by little magnets
  for (const [x, y, cell, r] of [[-0.12, 1.05, 4, 0.08], [0.06, 0.78, 5, -0.06], [-0.1, 0.6, 1, 0.03]]) {
    P.paper(x, y, d / 2 + 0.006, 0.16, 0.2, cell, 0, 0);
    P.sphere('gloss', x + 0.01, y + 0.09, d / 2 + 0.012, 0.012, [C('#d23c2c'), C('#3c7ad2'), C('#e8c030')][Math.abs(Math.round(r * 50)) % 3], 8);
  }
  P.shadow(0, 0, w * 0.6, d * 0.6, 0.85);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a mint green stove with an oven window and white knobs (front = +z)
export function retroStove(P, o = {}) {
  stove(P, { w: 0.76, color: o.color || C('#a9d3bf'), trim: C('#e8e4da') });
}
// a row of base cabinets with drawers on top and doors below, and a counter top (front = +z)
export function cabinets(P, o = {}) {
  const w = o.w || 2.0, d = 0.6, h = 0.9, wood = o.color || C('#b07a45'), top = o.top || C('#e9dfc8');
  P.box('wood', 0, 0.1, -0.02, w, h - 0.1 - 0.04, d - 0.04, wood, { r: 0.008, uv: [w, 1] });
  P.box('paint', 0, 0, -0.06, w - 0.04, 0.1, d - 0.12, mul(wood, 0.4));
  P.box(o.topMat || 'gloss', 0, h - 0.04, 0, w + 0.02, 0.04, d + 0.02, top, { r: 0.01, uv: [w, d] });
  const n = Math.max(1, Math.round(w / 0.5)), cw = (w - 0.02) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.01 + cw * (i + 0.5);
    if (o.sinkAt !== undefined && Math.abs(x - o.sinkAt) < cw * 0.55) {
      P.box('wood', x, 0.13, d / 2 - 0.035, cw - 0.02, h - 0.22, 0.02, mul(wood, 1.06), { r: 0.008 });
      P.box('metal', x, h - 0.2, d / 2 - 0.01, 0.12, 0.015, 0.02, CHROME, { r: 0.006 });
      continue;
    }
    P.box('wood', x, h - 0.22, d / 2 - 0.035, cw - 0.02, 0.15, 0.02, mul(wood, 1.06), { r: 0.008 });
    P.box('metal', x, h - 0.15, d / 2 - 0.01, 0.1, 0.014, 0.02, CHROME, { r: 0.006 });
    P.box('wood', x, 0.13, d / 2 - 0.035, cw - 0.02, h - 0.4, 0.02, mul(wood, 1.06), { r: 0.008 });
    P.box('wood', x, 0.19, d / 2 - 0.022, cw - 0.12, h - 0.52, 0.01, mul(wood, 0.94), { r: 0.005 });
    P.sphere('metal', x + (i % 2 ? -1 : 1) * (cw / 2 - 0.06), h - 0.42, d / 2 + 0.005, 0.014, CHROME, 8);
  }
  if (o.sinkAt !== undefined) {
    const sx = o.sinkAt;
    P.box('metal', sx, h - 0.03, 0.02, 0.6, 0.04, 0.44, C('#cfd2d4'), { r: 0.015 });
    P.box('metal', sx, h - 0.2, 0.02, 0.5, 0.17, 0.36, C('#8a8e92'), { r: 0.03 });
    P.cyl('metal', sx, h + 0.0, -0.2, 0.018, 0.016, 0.25, CHROME, 12);
    P.cyl('metal', sx, h + 0.25, -0.14, 0.012, 0.012, 0.14, CHROME, 10, [Math.PI / 2, 0, 0]);
  }
  P.shadow(0, 0, w * 0.55, d * 0.6, 0.75);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
  return h;
}
// a kitchen scale (a dial and a metal dish)
export function scale(P, x, y, z, color = C('#d8c9a8')) {
  P.box('gloss', x, y, z, 0.16, 0.1, 0.14, color, { r: 0.03 });
  P.cyl('gloss', x, y + 0.05, z + 0.072, 0.045, 0.045, 0.01, WHITE, 18, [Math.PI / 2, 0, 0]);
  P.cyl('paint', x, y + 0.05, z + 0.078, 0.003, 0.003, 0.07, C('#b83a2a'), 4, [Math.PI / 2, 0, 0.7]);
  P.lathe('metal', x, y + 0.1, z, [[0, 0], [0.09, 0.01], [0.11, 0.04], [0.105, 0.042], [0.085, 0.014], [0, 0.006]], CHROME, 18);
}
// open shelves on the wall with mugs and jars (picture 2)
export function openShelves(P, x, y, z, w, n = 2, gap = 0.34, color = C('#b07a45')) {
  const tops = [];
  for (let i = 0; i < n; i++) tops.push(wallShelf(P, x, y + i * gap, z, w, 0.22, color));
  for (const sx of [-1, 1]) P.box('wood', x + sx * (w / 2 - 0.012), y - 0.02, z + 0.11, 0.024, gap * (n - 1) + 0.06, 0.22, color, { r: 0.004 });
  return tops;
}
// a round wall clock
export function clock(P, x, y, z) {
  P.cyl('paint', x, y, z + 0.02, 0.16, 0.16, 0.04, C('#3a3a3a'), 28, [Math.PI / 2, 0, 0]);
  P.cyl('gloss', x, y, z + 0.042, 0.142, 0.142, 0.006, C('#f4efe2'), 28, [Math.PI / 2, 0, 0]);
  P.box('paint', x, y, z + 0.05, 0.008, 0.1, 0.004, DARK, { roll: 0.6 });
  P.box('paint', x, y, z + 0.052, 0.006, 0.13, 0.004, DARK, { roll: -1.9 });
}

// ============================================================ the child's room of picture 3
// a single bed: wooden frame, mattress, a grey blanket hanging over the sides, a pillow (front = +z = the foot)
export function bed(P, o = {}) {
  const w = o.w || 0.98, L = o.l || 2.0, wood = o.color || C('#8a5c36'), blanket = o.blanket || C('#7c8288');
  // frame and legs
  P.box('wood', 0, 0.12, 0, w, 0.2, L, wood, { r: 0.015, uv: [1, L] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box('wood', sx * (w / 2 - 0.04), 0, sz * (L / 2 - 0.04), 0.07, 0.14, 0.07, mul(wood, 0.85), { r: 0.008 });
  // headboard with round posts
  P.box('wood', 0, 0.12, -L / 2 - 0.02, w, 0.72, 0.04, wood, { r: 0.012 });
  for (const sx of [-1, 1]) { P.cyl('wood', sx * (w / 2 - 0.015), 0, -L / 2 - 0.02, 0.03, 0.03, 0.92, mul(wood, 0.95), 10); P.sphere('wood', sx * (w / 2 - 0.015), 0.95, -L / 2 - 0.02, 0.04, wood, 10); }
  P.box('wood', 0, 0.12, L / 2 + 0.02, w, 0.36, 0.04, wood, { r: 0.012 });
  // mattress, blanket over it and down the sides, a folded part at the top, the pillow
  P.box('cloth', 0, 0.32, 0, w - 0.06, 0.16, L - 0.06, C('#efece6'), { r: 0.05 });
  P.box('cloth', 0, 0.42, 0.18, w + 0.02, 0.08, L - 0.44, blanket, { r: 0.04 });
  for (const sx of [-1, 1]) P.box('cloth', sx * (w / 2 + 0.006), 0.2, 0.18, 0.025, 0.28, L - 0.46, mul(blanket, 0.92), { r: 0.012 });
  P.box('cloth', 0, 0.42, -L / 2 + 0.58, w + 0.03, 0.1, 0.22, mix(blanket, WHITE, 0.55), { r: 0.045 });
  P.box('cloth', 0, 0.47, -L / 2 + 0.24, w - 0.24, 0.13, 0.36, C('#f4f1ea'), { r: 0.06 });
  P.shadow(0, 0, w * 0.62, L * 0.54, 0.8);
  P.solid(-w / 2, -L / 2 - 0.04, w / 2, L / 2 + 0.04, 0.55);
}
// a tall wardrobe with two doors and a drawer (front = +z)
export function wardrobe(P, o = {}) {
  const w = o.w || 1.0, d = 0.56, h = o.h || 2.0, wood = o.color || C('#7a5130'), lit = mul(wood, 1.07);
  P.box('wood', 0, 0.08, 0, w, h - 0.08, d, wood, { r: 0.012, uv: [1, h] });
  for (const sx of [-1, 1]) P.box('wood', sx * (w / 2 - 0.05), 0, 0, 0.06, 0.08, d - 0.04, mul(wood, 0.7), { r: 0.006 });
  P.box('wood', 0, h, 0.01, w + 0.06, 0.06, d + 0.05, lit, { r: 0.015 });
  for (const sx of [-1, 1]) {
    P.box('wood', sx * w / 4, 0.4, d / 2, w / 2 - 0.03, h - 0.5, 0.022, lit, { r: 0.008, uv: [0.5, h] });
    P.box('wood', sx * w / 4, 0.52, d / 2 + 0.013, w / 2 - 0.15, h - 0.76, 0.012, mul(wood, 0.96), { r: 0.006 });
    P.box('metal', sx * 0.05, 1.12, d / 2 + 0.03, 0.016, 0.12, 0.016, BRASS, { r: 0.006 });
  }
  P.box('wood', 0, 0.12, d / 2, w - 0.06, 0.24, 0.022, lit, { r: 0.008 });
  P.sphere('metal', 0, 0.24, d / 2 + 0.03, 0.016, BRASS, 10);
  P.shadow(0, 0, w * 0.6, d * 0.62, 0.85);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a desk with a block of drawers on one side (front = +z)
export function desk(P, o = {}) {
  const w = o.w || 1.2, d = 0.6, h = 0.75, wood = o.color || C('#9a6b40'), lit = mul(wood, 1.06);
  P.box('wood', 0, h - 0.035, 0, w, 0.035, d, P.col(wood), { r: 0.01, uv: [w, d] });
  const dw = 0.42, dx = w / 2 - dw / 2 - 0.02;
  P.box('wood', dx, 0.04, 0, dw, h - 0.075, d - 0.04, wood, { r: 0.008 });
  for (let i = 0; i < 3; i++) { P.box('wood', dx, 0.07 + i * 0.205, d / 2 - 0.01, dw - 0.04, 0.18, 0.02, lit, { r: 0.008 }); P.box('metal', dx, 0.16 + i * 0.205, d / 2 + 0.015, 0.1, 0.014, 0.018, BRASS, { r: 0.006 }); }
  for (const sz of [-1, 1]) P.box('wood', -w / 2 + 0.04, 0, sz * (d / 2 - 0.04), 0.05, h - 0.035, 0.05, mul(wood, 0.9), { r: 0.006 });
  P.box('wood', -w / 2 + 0.04, 0.12, 0, 0.03, 0.04, d - 0.1, mul(wood, 0.85));
  P.shadow(0, 0, w * 0.58, d * 0.6, 0.7);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
  return h;
}
// a desk lamp with a bent arm and a round shade (it is a light: the room puts a real lamp at its bulb)
export function deskLamp(P, x, y, z, turn = 0, color = C('#2f5a4a')) {
  const Q = P.sub(x, z, turn, y);
  Q.cyl('metal', 0, 0, 0, 0.075, 0.08, 0.025, color, 18);
  Q.cyl('metal', 0, 0.2, -0.03, 0.009, 0.009, 0.36, CHROME, 8, [-0.35, 0, 0]);
  Q.cyl('metal', 0, 0.42, 0.06, 0.009, 0.009, 0.3, CHROME, 8, [1.1, 0, 0]);
  Q.lathe('paint', 0, 0.3, 0.17, SHADE_OUT, color, 16, 0.55, [-0.5, 0, 0]);
  Q.lathe('gloss', 0, 0.3, 0.17, SHADE_IN, C('#f4efe2'), 16, 0.55, [-0.5, 0, 0]);
  Q.sphere('glow', 0, 0.33, 0.19, 0.025, [3, 2.2, 1.2], 10);
  return Q.at(0, 0.34, 0.19);
}
// a pin board of cork with notes, a map and drawings (and red and blue pins)
export function pinBoard(P, x, y, z, w, h) {
  P.box('wood', x, y, z + 0.01, w + 0.06, h + 0.06, 0.025, C('#6d4a2c'), { r: 0.006 });
  P.box('cork', x, y + 0.03, z + 0.024, w, h, 0.012, [1, 1, 1], { r: 0.002, uv: [w * 2, h * 2] });
  const R = P.R;
  const notes = [[-0.36, 0.1, 3, 0.36, 0.28], [0.1, 0.3, 5, 0.18, 0.22], [0.32, 0.08, 4, 0.22, 0.18], [-0.05, -0.02, 2, 0.18, 0.2], [0.33, 0.33, 1, 0.16, 0.12], [-0.38, 0.38, 7, 0.16, 0.13]];
  for (const [nx, ny, cell, pw, ph] of notes) {
    if (Math.abs(nx) > w / 2 - pw / 2 + 0.02) continue;
    P.paper(x + nx, y + h / 2 + ny * (h / 0.9), z + 0.034, pw, ph, cell, 0, 0);
    P.sphere('gloss', x + nx + (R() - 0.5) * 0.04, y + h / 2 + ny * (h / 0.9) + ph / 2 - 0.02, z + 0.04, 0.009, R() < 0.5 ? C('#d02a2a') : C('#2a5ad0'), 6);
  }
}
// wall shelves with books and a globe
export function globe(P, x, y, z) {
  P.cyl('wood', x, y, z, 0.05, 0.055, 0.02, C('#5a3a22'), 14);
  P.cyl('metal', x, y + 0.02, z, 0.006, 0.006, 0.06, BRASS, 6);
  P.sphere('gloss', x, y + 0.16, z, 0.1, C('#3f78a8'), 20);
  for (const [a, b, r] of [[0.4, 0.6, 0.035], [-0.6, 0.2, 0.03], [1.8, -0.3, 0.04], [2.6, 0.5, 0.025]]) P.sphere('paint', x + Math.cos(a) * 0.088 * Math.cos(b), y + 0.16 + Math.sin(b) * 0.088, z + Math.sin(a) * 0.088 * Math.cos(b), r, C('#7a9a4a'), 8);
  P.torus('metal', x, y + 0.16, z, 0.112, 0.004, BRASS, [0, 0.4, 0.38], Math.PI * 1.3);
}
// an armchair with fat cushions (front = +z)
export function armchair(P, o = {}) {
  const c = o.color || C('#b5853a'), w = 0.82, d = 0.8;
  P.box('cloth', 0, 0.12, 0, w, 0.3, d, mul(c, 0.9), { r: 0.08 });
  P.box('cloth', 0, 0.4, 0.05, w - 0.26, 0.13, d - 0.2, c, { r: 0.06 });
  P.box('cloth', 0, 0.4, -d / 2 + 0.11, w - 0.06, 0.52, 0.2, mul(c, 0.95), { r: 0.08, tilt: -0.12 });
  for (const sx of [-1, 1]) P.box('cloth', sx * (w / 2 - 0.08), 0.12, 0.02, 0.16, 0.5, d - 0.06, mul(c, 0.93), { r: 0.07 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl('wood', sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), 0.022, 0.018, 0.12, C('#4a3020'), 8);
  P.shadow(0, 0, w * 0.62, d * 0.62, 0.8);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, 0.6);
}
// a rug lying on the floor (the picture of the rug on it)
export function rug(P, x, z, w, d, rot = 0) { const Q = P.sub(x, z, rot); Q.box('rug', 0, 0.002, 0, w, 0.012, d, [1, 1, 1], { r: 0.004 }); }
// a ball
export function ball(P, x, z, r = 0.11) {
  P.sphere('gloss', x, r, z, r, C('#c8302a'), 18);
  P.torus('gloss', x, r, z, r * 1.0, r * 0.18, WHITE, [0.4, 0.3, 0]);
  P.shadow(x, z, r * 1.3, r * 1.3, 0.8);
}
// a board game on the floor: the board with squares, a few pieces, its box
export function boardGame(P, x, z, rot = 0) {
  const Q = P.sub(x, z, rot);
  Q.box('paint', 0, 0.004, 0, 0.42, 0.012, 0.42, C('#3a2a1e'), { r: 0.004 });
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) Q.box('paint', -0.175 + i * 0.05, 0.016, -0.175 + j * 0.05, 0.05, 0.002, 0.05, C('#e6d6b0'), { r: 0 });
  const R = P.R;
  for (let k = 0; k < 7; k++) Q.cyl('gloss', -0.175 + Math.floor(R() * 8) * 0.05, 0.018, -0.175 + Math.floor(R() * 8) * 0.05, 0.017, 0.017, 0.012, k % 2 ? C('#c03a2a') : C('#1f1f1f'), 12);
  Q.box('paint', 0.42, 0.004, 0.1, 0.36, 0.05, 0.26, C('#2f4f8f'), { r: 0.006, rot: 0.3 });
  Q.shadow(0, 0, 0.28, 0.28, 0.4);
}
// an electric fan on the floor
export function fan(P, x, z, turn = 0) {
  const Q = P.sub(x, z, turn);
  Q.cyl('metal', 0, 0, 0, 0.13, 0.14, 0.03, C('#d8d2c2'), 20);
  Q.cyl('metal', 0, 0.03, 0, 0.016, 0.016, 0.75, CHROME, 8);
  Q.cyl('metal', 0, 0.85, 0, 0.07, 0.06, 0.16, C('#d8d2c2'), 14, [Math.PI / 2, 0, 0]);
  Q.torus('metal', 0, 0.85, 0.1, 0.19, 0.004, CHROME, [0, 0, 0]);
  Q.torus('metal', 0, 0.85, 0.1, 0.1, 0.003, CHROME, [0, 0, 0]);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.3; Q.box('paint', -Math.sin(a) * 0.085, 0.85 + Math.cos(a) * 0.085 - 0.08, 0.11, 0.07, 0.16, 0.006, C('#a6c2c8'), { r: 0.02, roll: a }); }
  Q.shadow(0, 0, 0.18, 0.18, 0.7);
  Q.solid(-0.15, -0.15, 0.15, 0.15, 1.0);
}
// a pendant lamp: a cord from the ceiling and an enamel shade (it is a light: the room puts a lamp at the bulb)
export function pendant(P, x, z, ceiling, hang, color = C('#2f4a3c')) {
  const y = ceiling - hang;
  P.cyl('paint', x, y + hang / 2 + 0.1, z, 0.004, 0.004, hang - 0.2, DARK, 5, [0, 0, 0.0001]);
  P.cyl('paint', x, ceiling - 0.03, z, 0.045, 0.04, 0.03, DARK, 12);
  P.lathe('paint', x, y - 0.2, z, SHADE_OUT, color, 24, 1);
  P.lathe('gloss', x, y - 0.2, z, SHADE_IN, C('#f4efe2'), 24, 1);
  P.sphere('glow', x, y - 0.13, z, 0.045, [3, 2.3, 1.4], 14);
  return [x, y - 0.14, z];
}
// a glass globe light on the ceiling (the flat)
export function ceilingGlobe(P, x, z, ceiling) {
  P.cyl('metal', x, ceiling - 0.04, z, 0.06, 0.06, 0.04, BRASS, 14);
  P.sphere('glow', x, ceiling - 0.2, z, 0.16, [2.4, 2.1, 1.7], 18);
  return [x, ceiling - 0.22, z];
}
// a light switch and a socket (little things that make a wall real)
export function switchPlate(P, x, y, z) { P.box('gloss', x, y, z + 0.005, 0.08, 0.12, 0.012, C('#efe9dc'), { r: 0.006 }); P.box('gloss', x, y + 0.04, z + 0.014, 0.02, 0.04, 0.012, C('#e2dccf'), { r: 0.004 }); }
export function socket(P, x, y, z) { P.box('gloss', x, y, z + 0.005, 0.08, 0.08, 0.012, C('#efe9dc'), { r: 0.006 }); for (const k of [-1, 1]) P.box('paint', x + k * 0.012, y + 0.03, z + 0.013, 0.008, 0.008, 0.004, DARK, { r: 0 }); }
// a framed picture on the wall
export function picture(P, x, y, z, w, h, cell, color = C('#3a2a1c')) {
  P.box('wood', x, y - h / 2 - 0.03, z + 0.012, w + 0.06, h + 0.06, 0.025, color, { r: 0.006 });
  P.paper(x, y, z + 0.026, w, h, cell, 0, 0);
}
// a coat on a hook
export function coat(P, x, y, z, color = C('#3a4a5a')) {
  P.box('metal', x, y - 0.02, z + 0.02, 0.025, 0.05, 0.05, BRASS, { r: 0.008 });
  // the body: wider at the bottom, flat against the wall
  const body = new THREE.CylinderGeometry(0.15, 0.22, 0.82, 14, 1);
  body.scale(1, 1, 0.42);
  P.geo('cloth', body, x, y - 0.5, z + 0.085, 0, color);
  // shoulders, the hood hanging at the back, two sleeves
  const sh = new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  sh.scale(1.1, 0.5, 0.5);
  P.geo('cloth', sh, x, y - 0.1, z + 0.085, 0, mul(color, 0.95));
  P.sphere('cloth', x, y - 0.05, z + 0.11, 0.07, mul(color, 0.85), 10);
  for (const sx of [-1, 1]) P.cyl('cloth', x + sx * 0.17, y - 0.42, z + 0.1, 0.045, 0.05, 0.62, mul(color, 0.92), 10, [0, 0, sx * 0.12]);
  P.box('metal', x, y - 0.55, z + 0.15, 0.012, 0.6, 0.006, C('#2a2a2a'), { r: 0 });
}
