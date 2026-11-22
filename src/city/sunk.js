// ---------------------------------------------------------------------------
// sunk.js - builds THE SUNK, the drowned quarter of Chapter 3 (the plan is in
// sunkPlan.js: canals, blocks, decks, bridges, lanterns, places).
//
//   * The old buildings stand in the canals: dark, stained walls under the
//     water line, sash windows above, flat tar roofs with huts of salvaged
//     sheets, patched solar sheets, antenna clusters and water tanks.
//   * Rusty steel bridges and rope walkways hang between the roofs, strings of
//     lanterns over the water, small boats are tied up along the walls, old
//     cars lie on the bottom of the canals.
//   * The Tidewalker market (pontoons, stalls under tarps), Lena's flat in a
//     half-sunk warehouse, the Guard post with its drone pad, the pump hall
//     with the drain tunnel under it, Rustwater Dock at the city's quay.
//   * Collision: every building is a box. Pontoons and ramps are boxes that only
//     stop boats ("boatOnly"); people walk only where there is a deck.
//
// Everything that does not move is added to the shared mesh builders of the
// city (no extra draw calls). Extra draw calls: the water, the mist, the
// sunken cars, the small boats, roof tanks, antennas, the screens in Lena's flat.
//
// buildSunk(ctx) returns the "sunk" object the game uses at run time: the
// water, the canal map for boats, where people can stand, the mist and fog.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RNG } from '../utils/math.js';
import { InstancedSet, mergeParts } from '../utils/geometry.js';
import * as M from './models.js';
import { sideFrame, BRICK_TINTS, C } from './buildingKit.js';
import { WINDOW_STYLES, shared } from './materials.js';
import { makeCar } from '../vehicles/carModels.js';
import {
  SUNK, WATER, DECKS, SPECIAL, PLACES, BUILDINGS, SPANS, LANTERN_LINES, NODES, EDGES,
  inSunk, inWater, deckHeight, deckAt, topAt, inTunnel, inRect,
} from './sunkPlan.js';

const T = CONFIG.textures;
const LEVEL = SUNK.level, BED = SUNK.bed, FL = SUNK.floor;
const FLOOR0 = BED + FL;          // the old first floor line (just above the water now)
const PAR = 0.9;                  // the low wall around a roof
const lin = M.lin;
const R = (minX, maxX, minZ, maxZ, more = {}) => ({ minX, maxX, minZ, maxZ, ...more });
const fp = (f, s, y, out = 0) => [f.ox + f.dx * s + f.nx * out, y, f.oz + f.dz * s + f.nz * out];

// faded paint of the old plaster houses (linear color)
const PLASTER_TINTS = [[0.82, 0.78, 0.7], [0.62, 0.7, 0.7], [0.8, 0.66, 0.52], [0.58, 0.6, 0.62], [0.74, 0.58, 0.54], [0.64, 0.7, 0.6]];
// colors of the salvaged things (linear)
const COL = {
  rust: [0.2, 0.075, 0.035], rust2: [0.31, 0.13, 0.06], wood: [0.19, 0.12, 0.07], wood2: [0.13, 0.085, 0.05], plank: [0.24, 0.17, 0.11],
  steel: [0.16, 0.17, 0.18], dark: [0.03, 0.032, 0.035], rope: [0.3, 0.24, 0.16], tire: [0.025, 0.025, 0.028],
  blue: [0.03, 0.1, 0.2], teal: [0.03, 0.17, 0.16], green: [0.06, 0.12, 0.05], orange: [0.5, 0.17, 0.03], red: [0.36, 0.05, 0.03], cream: [0.62, 0.57, 0.46],
  guard: [0.09, 0.1, 0.115], guardLine: [0.12, 0.6, 0.45], solar: [0.015, 0.03, 0.07], warm: [1.0, 0.55, 0.2], screen: [0.2, 0.85, 0.7],
};

// ===========================================================================
export function buildSunk(ctx) {
  const kit = ctx.kit, sets = ctx.sets, mats = ctx.mats;
  const rng = new RNG(4021);
  const wasPlayable = ctx.playableNow;
  ctx.playableNow = true;
  const ps = ctx.mb.propStatic;
  const boxes = ctx.colliders.boxes;
  const spots = [];               // hiding places for the Guard (src/ai/wanted.js)
  const lanternList = [];         // for the map

  // ---- small helpers ----
  const paint = (c, rough = 0.8, metal = 0, glow = 0) => ps.color(c[0], c[1], c[2], 1).data(rough, metal, 0, glow);
  const pbox = (x0, y0, z0, x1, y1, z1, faces = 'nsewt') => ps.box(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), 1, faces);
  const solid = (r, h, more = {}) => boxes.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, h, ...more });
  // a box from point a to point b (a beam, a rope, a sloping plank): w = width, h = height
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  function beam(a, b, w, h, up = null) {
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _v.length();
    if (len < 1e-4) return;
    _v.divideScalar(len);
    _q.setFromUnitVectors(_z, _v);
    // (keep the box flat: no roll around its own length)
    if (up === null && Math.abs(_v.y) < 0.99) {
      const yaw = Math.atan2(_v.x, _v.z), pitch = -Math.asin(Math.max(-1, Math.min(1, _v.y)));
      _q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    }
    _m.compose(_s.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, new THREE.Vector3(w, h, len));
    ps.addGeometry(unitBox, _m);
  }
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 9, 1);
  const cylLow = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
  // an upright cylinder (a drum, a post): bottom at y
  function drum(x, y, z, r, h, low = false) { ps.add(low ? cylLow : cylGeo, x, y + h / 2, z, null, [r, h, r]); }
  // a cylinder lying along x or z (a float under a pontoon)
  function log(x, y, z, r, len, alongX) { ps.add(cylLow, x, y, z, alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], [r, len, r]); }
  const torus = new THREE.TorusGeometry(0.34, 0.12, 5, 9);
  // a car tire hanging on a wall as a fender (ring facing out of the wall: nx, nz)
  function tire(x, y, z, nx, nz) { paint(COL.tire, 0.9); ps.add(torus, x, y, z, [0, Math.atan2(nx, nz), 0]); }

  // ---- instanced things (one draw call each, only drawn near the player) ----
  const S = (name, geom, mat, opts) => (sets[name] = new InstancedSet(name, geom, mat, opts));
  const tankSet = S('sunkTank', M.makeWaterTank(), mats.prop, { maxDistance: 300 });
  const antennaSet = S('sunkAntenna', M.makeAntenna(), mats.prop, { maxDistance: 220 });
  const dishSet = S('sunkDish', M.makeDish(), mats.prop, { maxDistance: 200 });
  const skiffSet = S('sunkSkiff', makeSkiff(), mats.prop, { maxDistance: 260, useColor: true });
  const sunkenA = S('sunkenCarA', makeCar('sedan'), mats.prop, { maxDistance: 140, useColor: true, castShadow: false });
  const sunkenB = S('sunkenCarB', makeCar('van'), mats.prop, { maxDistance: 140, useColor: true, castShadow: false });
  const P = kit.parts;

  // which lot (building) is at a point, and how high it is there
  const lots = BUILDINGS.slice();
  for (const k of Object.keys(SPECIAL)) lots.push({ ...SPECIAL[k], special: k });
  const lotAt = (x, z) => lots.find((b) => inRect(b, x, z)) || null;

  // =========================================================================
  // 1. THE BOTTOM OF THE CANALS: the old street, mud, rubble, faded road lines
  // =========================================================================
  {
    const mb = ctx.mb.asphalt;
    mb.color(0.16, 0.19, 0.17, 1);
    mb.groundRect(SUNK.minX, SUNK.minZ - 30, SUNK.maxX, SUNK.maxZ, BED, T.asphalt.size);
    // rubble heaps and the old road line under the water (seen dimly through the water)
    for (const w of WATER) {
      const along = w.maxX - w.minX > w.maxZ - w.minZ;
      const len = along ? w.maxX - w.minX : w.maxZ - w.minZ;
      paint([0.16, 0.15, 0.1], 0.9);
      for (let s = 2; s < len - 2; s += 6) {
        const x = along ? w.minX + s : (w.minX + w.maxX) / 2, z = along ? (w.minZ + w.maxZ) / 2 : w.minZ + s;
        pbox(x - (along ? 1.5 : 0.08), BED + 0.01, z - (along ? 0.08 : 1.5), x + (along ? 1.5 : 0.08), BED + 0.03, z + (along ? 0.08 : 1.5), 't');
      }
      paint([0.11, 0.12, 0.1], 0.95);
      for (let i = 0; i < len / 14; i++) {
        const x = rng.range(w.minX + 1, w.maxX - 1), z = rng.range(w.minZ + 1, w.maxZ - 1), r = rng.range(0.6, 1.6);
        pbox(x - r, BED, z - r * 0.7, x + r, BED + rng.range(0.3, 0.9), z + r * 0.7);
      }
    }
  }

  // =========================================================================
  // 2. THE OLD BUILDINGS
  // =========================================================================
  const win = sets.window;                       // the 3D windows of the city (buildingKit.js)
  const wr = WINDOW_STYLES[2];
  const avg = ctx.tex.avg || {};
  function oldWalls(r, o = {}) {
    const brick = r.mat === 'brick';
    const mb = brick ? ctx.mb.brick : ctx.mb.plaster, tile = brick ? T.brick.size : T.plaster.size;
    const lr = new RNG(r.seed || 7);
    const tint = brick ? BRICK_TINTS[r.tint % BRICK_TINTS.length] : PLASTER_TINTS[r.tint % PLASTER_TINTS.length];
    const B = { mb, tile, tint, age: lr.range(0.8, 1), uOff: lr.range(0, 50), vOff: lr.range(0, 50), roofY: r.top + PAR, offU: 64 * lr.int(0, 15) + lr.int(0, 20), offV: 64 * lr.int(0, 15) + 1 };
    // the drowned part is dark and green; the water line leaves a stain
    const Bd = { ...B, tint: [tint[0] * 0.32, tint[1] * 0.4, tint[2] * 0.34] };
    const Bs = { ...B, tint: [tint[0] * 0.42, tint[1] * 0.52, tint[2] * 0.4] };
    const reveal = (avg[r.mat] || [0.45, 0.42, 0.38]).map((v, i) => v * tint[i] * 0.8);
    const nf = o.floors ?? Math.max(0, Math.floor((r.top - 0.5 - FLOOR0) / FL));
    const yW = FLOOR0 + nf * FL;
    const top = r.top + (o.roofWall ?? PAR);        // the wall ends here (a walkable roof has no low wall)
    let face = 0;
    // the floors with windows on one side: a wall with a grid of painted windows + the 3D windows close by
    const windows = (f, len, y0, rows, row, bays) => {
      if (rows <= 0) return;
      const bw = len / bays;
      kit.wall(B, f, 0, len, y0, y0 + rows * FL, { mode: 2, grid: [B.offU, B.offU + bays, row, row + rows] });
      for (let j = 0; j < rows; j++) for (let i = 0; i < bays; i++) {
        const cs = (i + wr[0] + wr[2] / 2) * bw, cy = y0 + (j + wr[1] + wr[3] / 2) * FL;
        win.add(f.ox + f.dx * cs, cy, f.oz + f.dz * cs, f.nx, f.nz, 1, 1, 1, [wr[2] * bw, wr[3] * FL, B.offU + i, row + j], [reveal[0], reveal[1], reveal[2], 2 + 4 + 8]);
      }
    };
    for (const side of ['N', 'S', 'E', 'W']) {
      const f = sideFrame(r, side), len = f.len;
      const open = o.open && o.open[side];          // a piece left open: [s0, s1, y0, y1]
      const wallPiece = (BB, y0, y1, opts) => {
        opts = opts || {};
        if (!open || y1 <= open[2] || y0 >= open[3]) { kit.wall(BB, f, 0, len, y0, y1, opts); return; }
        // around the opening: left, right, below, above
        kit.wall(BB, f, 0, open[0], y0, y1, {});
        kit.wall(BB, f, open[1], len, y0, y1, {});
        if (open[2] > y0) kit.wall(BB, f, open[0], open[1], y0, open[2]);
        if (open[3] < y1) kit.wall(BB, f, open[0], open[1], open[3], y1);
      };
      wallPiece(Bd, BED, FLOOR0);
      kit.wall(Bs, f, open ? open[1] : 0, len, LEVEL - 0.25, LEVEL + 0.72, { out: 0.012 });
      if (open) kit.wall(Bs, f, 0, open[0], LEVEL - 0.25, LEVEL + 0.72, { out: 0.012 });
      // the floors with windows (the 3D windows close by, painted ones far away)
      if (nf > 0) {
        const bays = Math.max(1, Math.floor(len / lr.range(2.3, 2.8) + 0.4)), bw = len / bays;
        const row = B.offV + (face++ % 5) * 12;
        if (open) {
          // the floors that the opening reaches have no windows on this side, the ones above it have
          const low = Math.min(nf, Math.ceil((open[3] - FLOOR0) / FL - 0.01));
          wallPiece(B, FLOOR0, FLOOR0 + low * FL, null);
          windows(f, len, FLOOR0 + low * FL, nf - low, row + low, bays);
        } else {
          windows(f, len, FLOOR0, nf, row, bays);
          // boarded windows just above the water (somebody keeps the wind out)
          if (lr.chance(0.4)) {
            paint(COL.wood2, 0.9);
            for (let i = 0; i < bays; i++) {
              if (!lr.chance(0.3)) continue;
              const cs = (i + wr[0] + wr[2] / 2) * bw, w = wr[2] * bw * 0.6, y0 = FLOOR0 + wr[1] * FL, y1 = y0 + wr[3] * FL;
              for (let k = 0; k < 4; k++) {
                const y = y0 + 0.1 + (k / 3) * (y1 - y0 - 0.3);
                const a = fp(f, cs - w, y, 0.06), b = fp(f, cs + w, y + lr.range(-0.12, 0.12), 0.06);
                beam(a, b, 0.05, 0.16);
              }
            }
          }
        }
        // stone lines at the floors
        for (let j = 1; j <= nf; j++) {
          const y = FLOOR0 + j * FL - 0.12;
          if (open && y > open[2] - 0.2 && y < open[3] + 0.2) continue;
          P.fin.add(...fp(f, len / 2, y, 0), f.nx, f.nz, len + 0.1, 0.14, 0.09, null, [0.4, 0.39, 0.36]);
        }
      }
      if (top > yW) wallPiece(B, yW, top, null);
      // the low wall around the roof, seen from the roof
      const t = 0.25;
      const inner = side === 'N' ? sideFrame(R(r.minX, r.maxX, r.maxZ - t, r.maxZ), 'S') : side === 'S' ? sideFrame(R(r.minX, r.maxX, r.minZ, r.minZ + t), 'N')
        : side === 'W' ? sideFrame(R(r.maxX - t, r.maxX, r.minZ, r.maxZ), 'E') : sideFrame(R(r.minX, r.minX + t, r.minZ, r.maxZ), 'W');
      if (!o.noParapet && top > r.top) kit.wall(B, inner, 0, inner.len, r.top, top, { shade: 0.85 });
      // the stone top of the low wall and a cornice
      if (top > r.top) P.fin.add(...fp(f, len / 2, top, -t), f.nx, f.nz, len + 0.1, 0.08, t + 0.06, null, [0.38, 0.37, 0.35]);
      P.fin.add(...fp(f, len / 2, r.top - 0.35, 0), f.nx, f.nz, len + 0.2, 0.32, 0.22, null, [0.36, 0.35, 0.33]);
    }
    // the tar roof
    ctx.mb.asphalt.color(0.42, 0.42, 0.44, 1);
    ctx.mb.asphalt.groundRect(r.minX, r.minZ, r.maxX, r.maxZ, r.top, T.asphalt.size, B.uOff * 0.1, B.vOff * 0.1);
    return B;
  }

  // things on a roof: a hut of salvaged sheets, solar sheets, antennas, a water tank, plants
  function roofLife(r) {
    const lr = new RNG((r.seed || 3) * 7 + 1);
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ, y = r.top;
    const free = [];                                 // places already taken (simple check)
    const take = (hw, hd) => {
      if (w < 2.4 + 2 * hw || d < 2.4 + 2 * hd) return null;
      for (let k = 0; k < 8; k++) {
        const x = lr.range(r.minX + 1.2 + hw, r.maxX - 1.2 - hw), z = lr.range(r.minZ + 1.2 + hd, r.maxZ - 1.2 - hd);
        if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
        if (free.some((q) => Math.abs(q.x - x) < q.hw + hw + 0.4 && Math.abs(q.z - z) < q.hd + hd + 0.4)) continue;
        free.push({ x, z, hw, hd });
        return { x, z };
      }
      return null;
    };
    if (r.shack && w > 7 && d > 7) {
      const hw = lr.range(1.4, 2.4), hd = lr.range(1.2, 1.9), h = lr.range(2.1, 2.6);
      const p = take(hw, hd);
      if (p) {
        const mb = ctx.mb.metal;
        const c = lr.pick([[0.42, 0.28, 0.2], [0.33, 0.36, 0.38], [0.3, 0.33, 0.28], [0.45, 0.42, 0.36]]);
        mb.color(c[0], c[1], c[2], 1).data(0, 0, 0, lr.range(0.7, 1));
        mb.box(p.x - hw, y, p.z - hd, p.x + hw, y + h, p.z + hd, 2, 'nsew');
        // the roof sheet: sloping, a little bigger than the hut
        const lo = y + h, hi = y + h + 0.45;
        mb.color(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 1);
        mb.quadAuto([p.x - hw - 0.3, lo, p.z - hd - 0.3], [p.x + hw + 0.3, lo, p.z - hd - 0.3], [p.x + hw + 0.3, hi, p.z + hd + 0.3], [p.x - hw - 0.3, hi, p.z + hd + 0.3], [0, 0.97, -0.24], 2);
        mb.quadAuto([p.x - hw - 0.3, lo - 0.02, p.z - hd - 0.3], [p.x + hw + 0.3, lo - 0.02, p.z - hd - 0.3], [p.x + hw + 0.3, hi - 0.02, p.z + hd + 0.3], [p.x - hw - 0.3, hi - 0.02, p.z + hd + 0.3], [0, -0.97, 0.24], 2);
        // a door and a small window (lit at night: somebody lives here)
        paint(COL.dark, 0.7, 0.2);
        pbox(p.x - 0.45, y, p.z - hd - 0.04, p.x + 0.45, y + 1.95, p.z - hd + 0.01, 's');
        paint([0.6, 0.38, 0.16], 0.4, 0, lr.chance(0.7) ? 0.55 : 0);
        pbox(p.x + hw - 1.0, y + 1.1, p.z - hd - 0.03, p.x + hw - 0.35, y + 1.6, p.z - hd + 0.01, 's');
        solid(R(p.x - hw, p.x + hw, p.z - hd, p.z + hd), y + h);
        // a stove pipe
        paint(COL.rust, 0.8, 0.5);
        drum(p.x - hw * 0.6, y + h, p.z + hd * 0.4, 0.09, 1.2, true);
      }
    }
    if (r.solar) {
      const n = lr.int(1, 3);
      for (let i = 0; i < n; i++) {
        const p = take(2.7, 1.3);
        if (!p) break;
        const a = lr.range(-0.3, 0.3);
        P.solarRack.add(p.x, y, p.z, Math.sin(Math.PI + a), Math.cos(Math.PI + a), lr.range(0.75, 1), 1, lr.range(0.8, 1));
        // a patch: one sheet is a different color (salvaged)
        if (lr.chance(0.5)) { paint(lr.pick([COL.blue, COL.solar, [0.05, 0.05, 0.06]]), 0.25, 0.6); pbox(p.x - 0.8, y + 0.05, p.z - 1.0, p.x + 0.9, y + 0.09, p.z + 1.0, 't'); }
      }
    }
    if (r.antenna) {
      const p = take(1, 1);
      if (p) {
        for (let i = 0; i < lr.int(2, 4); i++) antennaSet.add(p.x + lr.range(-0.8, 0.8), y, p.z + lr.range(-0.8, 0.8), lr.range(0, 6.28), lr.range(0.8, 1.5));
        if (lr.chance(0.6)) dishSet.add(p.x + lr.range(-1, 1), y, p.z + lr.range(-1, 1), lr.range(0, 6.28), lr.range(0.9, 1.3));
      }
    }
    if (r.tank && w > 6 && d > 6) { const p = take(1.7, 1.7); if (p) { tankSet.add(p.x, y, p.z, lr.range(0, 6.28), lr.range(0.85, 1)); solid(R(p.x - 1.4, p.x + 1.4, p.z - 1.4, p.z + 1.4), y + 5); } }
    // plants in tubs and old buckets (a garden on the roof)
    if (lr.chance(0.35)) for (let i = 0; i < lr.int(2, 5); i++) { const p = take(0.5, 0.5); if (!p) break; P.planter.add(p.x, y, p.z, 0, 1); P.shrub.add(p.x, y + 0.55, p.z, 1, 0, 0.8, 0.8, 0.8); }
    // water barrels
    if (lr.chance(0.5)) { paint(lr.pick([COL.blue, [0.08, 0.2, 0.32], COL.rust2]), 0.6, 0.1); for (let i = 0; i < lr.int(1, 3); i++) { const p = take(0.35, 0.35); if (p) drum(p.x, y, p.z, 0.3, 0.88); } }
    if (lr.chance(0.25)) { const p = take(0.7, 0.6); if (p) P.roofAC.add(p.x, y, p.z, 0, 1); }
  }

  // rusty balconies along one wall that looks over the water
  function balconies(r) {
    const lr = new RNG((r.seed || 5) * 13 + 2);
    const sides = ['N', 'S', 'E', 'W'].filter((sd) => {
      const f = sideFrame(r, sd), mid = fp(f, f.len / 2, 0, 3);
      return inWater(mid[0], mid[2]) && f.len > 6;
    });
    if (!sides.length) return;
    const f = sideFrame(r, lr.pick(sides));
    const nf = Math.floor((r.top - 0.5 - FLOOR0) / FL);
    for (let j = 1; j < nf; j++) {
      for (let s = 2; s < f.len - 3; s += lr.range(5, 9)) {
        if (!lr.chance(0.55)) continue;
        const y = FLOOR0 + j * FL, w = lr.range(1.8, 2.8), out = 1.1;
        paint(lr.chance(0.5) ? COL.rust : COL.rust2, 0.75, 0.55);
        const a = fp(f, s, y, 0), b = fp(f, s + w, y, out);
        pbox(a[0], y - 0.08, a[2], b[0], y, b[2]);
        // the railing: posts and a top rail
        const c0 = fp(f, s, y, out), c1 = fp(f, s + w, y, out);
        beam([c0[0], y + 0.95, c0[2]], [c1[0], y + 0.95, c1[2]], 0.05, 0.05);
        beam([c0[0], y + 0.5, c0[2]], [c1[0], y + 0.5, c1[2]], 0.03, 0.03);
        for (let k = 0; k <= 3; k++) { const q = fp(f, s + (w * k) / 3, y, out); beam([q[0], y, q[2]], [q[0], y + 0.95, q[2]], 0.04, 0.04); }
        for (const ss of [s, s + w]) { const p0 = fp(f, ss, y + 0.95, 0), p1 = fp(f, ss, y + 0.95, out); beam(p0, p1, 0.04, 0.04); }
        // laundry or a plant pot now and then
        if (lr.chance(0.35)) { const c = lr.pick([[0.5, 0.48, 0.42], [0.15, 0.2, 0.35], [0.45, 0.12, 0.08], [0.3, 0.35, 0.25]]); paint(c, 0.95); const q = fp(f, s + w * 0.4, y + 0.95, out + 0.02); const q2 = fp(f, s + w * 0.75, y + 0.95, out + 0.02); pbox(q[0], y + 0.4, q[2], q2[0], y + 0.93, q2[2] + 0.01); }
      }
    }
  }

  for (const r of BUILDINGS) {
    oldWalls(r);
    roofLife(r);
    if (r.balcony) balconies(r);
    solid(r, r.top + PAR);
  }

  // =========================================================================
  // 3. THE WATER'S EDGE: tires and ropes on the walls, boats tied up
  // =========================================================================
  for (const w of WATER) {
    if (w.name === 'drain' || w.name === 'inlet') continue;
    const along = w.maxX - w.minX > w.maxZ - w.minZ;
    const len = along ? w.maxX - w.minX : w.maxZ - w.minZ;
    for (const side of [-1, 1]) {
      for (let s = 3; s < len - 3; s += rng.range(7, 16)) {
        // the wall of the canal on this side, and its normal (pointing into the water)
        const x = along ? w.minX + s : side < 0 ? w.minX : w.maxX, z = along ? (side < 0 ? w.minZ : w.maxZ) : w.minZ + s;
        const nx = along ? 0 : -side, nz = along ? -side : 0;
        if (inWater(x - nx * 1.5, z - nz * 1.5)) continue;      // (no wall here: another canal joins)
        if (DECKS.some((d) => inRect(d, x + nx, z + nz, 1.5))) continue;
        const roll = rng.next();
        if (roll < 0.4) tire(x + nx * 0.12, LEVEL + rng.range(0.3, 0.9), z + nz * 0.12, nx, nz);
        else if (roll < 0.62) {
          // a small boat tied to a ring in the wall
          const bx = x + nx * 1.4, bz = z + nz * 1.4;
          skiffSet.add(bx, LEVEL - 0.12, bz, Math.atan2(along ? 1 : 0, along ? 0 : 1) + (rng.chance(0.5) ? Math.PI : 0), rng.range(0.9, 1.15), rng.pick([[0.2, 0.25, 0.3], [0.35, 0.12, 0.06], [0.12, 0.22, 0.16], [0.5, 0.46, 0.38], [0.16, 0.12, 0.08]]), 0, rng.range(-0.04, 0.04));
          boxes.push({ minX: bx - (along ? 2.6 : 1), maxX: bx + (along ? 2.6 : 1), minZ: bz - (along ? 1 : 2.6), maxZ: bz + (along ? 1 : 2.6), h: 0.3, boatOnly: true });
          paint(COL.rope, 0.95);
          beam([x + nx * 0.05, LEVEL + 0.9, z + nz * 0.05], [bx - nx * 0.4, LEVEL + 0.35, bz - nz * 0.4], 0.03, 0.03);
        } else if (roll < 0.75) {
          // a rusty ladder up the wall
          paint(COL.rust, 0.75, 0.6);
          const ax = x + nx * 0.18, az = z + nz * 0.18, tx = along ? 0.25 : 0, tz = along ? 0 : 0.25;
          beam([ax - tx, LEVEL - 0.6, az - tz], [ax - tx, LEVEL + 3.2, az - tz], 0.04, 0.04);
          beam([ax + tx, LEVEL - 0.6, az + tz], [ax + tx, LEVEL + 3.2, az + tz], 0.04, 0.04);
          for (let k = 0; k < 10; k++) beam([ax - tx, LEVEL - 0.4 + k * 0.38, az - tz], [ax + tx, LEVEL - 0.4 + k * 0.38, az + tz], 0.025, 0.025);
        }
      }
    }
  }

  // =========================================================================
  // 4. DECKS: pontoons, gangways, ramps (people walk here)
  // =========================================================================
  function planks(d, y0fn, alongX) {
    // the boards across the deck (two shades), each one its own little top face
    const len = alongX ? d.maxX - d.minX : d.maxZ - d.minZ;
    const n = Math.max(1, Math.round(len / 0.3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * len, b = ((i + 1) / n) * len - 0.035;
      paint(i % 3 === 0 ? COL.wood2 : i % 2 ? COL.plank : COL.wood, 0.85);
      if (alongX) {
        const x0 = d.minX + a, x1 = d.minX + b;
        const ya = y0fn(x0, (d.minZ + d.maxZ) / 2), yb = y0fn(x1, (d.minZ + d.maxZ) / 2);
        ps.quadAuto([x0, ya, d.minZ], [x1, yb, d.minZ], [x1, yb, d.maxZ], [x0, ya, d.maxZ], [0, 1, 0]);
      } else {
        const z0 = d.minZ + a, z1 = d.minZ + b;
        const ya = y0fn((d.minX + d.maxX) / 2, z0), yb = y0fn((d.minX + d.maxX) / 2, z1);
        ps.quadAuto([d.minX, ya, z0], [d.maxX, ya, z0], [d.maxX, yb, z1], [d.minX, yb, z1], [0, 1, 0]);
      }
    }
  }
  for (const d of DECKS) {
    const at = (x, z) => deckAt(d, x, z);
    if (d.kind === 'pontoon') {
      const y = d.y, wide = d.maxX - d.minX >= d.maxZ - d.minZ;
      // the boards run across the long side
      planks(d, () => y + 0.002, wide);
      // the frame and the floats under it (old drums and blue floats, half out of the water)
      paint(COL.wood2, 0.9);
      pbox(d.minX, y - 0.28, d.minZ, d.maxX, y - 0.02, d.maxZ, 'nsew');
      const len = wide ? d.maxX - d.minX : d.maxZ - d.minZ, dep = wide ? d.maxZ - d.minZ : d.maxX - d.minX;
      for (let s = 0.8; s < len - 0.5; s += 1.5) {
        for (const off of [0.6, dep - 0.6]) {
          paint(rng.chance(0.5) ? COL.blue : rng.chance(0.5) ? COL.rust2 : [0.12, 0.13, 0.14], 0.6, 0.2);
          if (wide) log(d.minX + s, LEVEL + 0.06, d.minZ + off, 0.3, 1.1, false); else log(d.minX + off, LEVEL + 0.06, d.minZ + s, 0.3, 1.1, true);
        }
      }
      // bollards and a few tires on the water side
      paint(COL.dark, 0.6, 0.6);
      for (let s = 1.5; s < len; s += 6) { const x = wide ? d.minX + s : d.minX + 0.2, z = wide ? d.minZ + 0.2 : d.minZ + s; drum(x, y, z, 0.12, 0.45, true); }
      boxes.push({ minX: d.minX, maxX: d.maxX, minZ: d.minZ, maxZ: d.maxZ, h: y, boatOnly: true });
    } else if (d.kind === 'gangway' || d.kind === 'ramp') {
      const alongX = d.axis === 'x';
      planks(d, (x, z) => at(x, z) + 0.004, alongX);
      // side rails (steel pipes) and the posts that hold them
      paint(COL.steel, 0.55, 0.7);
      const L0 = alongX ? d.minX : d.minZ, L1 = alongX ? d.maxX : d.maxZ;
      for (const side of [alongX ? d.minZ : d.minX, alongX ? d.maxZ : d.maxX]) {
        const p = (t, up) => alongX ? [t, at(t, (d.minZ + d.maxZ) / 2) + up, side] : [side, at((d.minX + d.maxX) / 2, t) + up, t];
        beam(p(L0, 1.0), p(L1, 1.0), 0.05, 0.05);
        beam(p(L0, 0.55), p(L1, 0.55), 0.035, 0.035);
        for (let t = L0; t <= L1 + 0.01; t += 1.6) beam(p(t, 0), p(t, 1.0), 0.05, 0.05);
      }
      // the underside (a beam), and legs down into the water
      paint(COL.rust, 0.8, 0.4);
      const mid = alongX ? (d.minZ + d.maxZ) / 2 : (d.minX + d.maxX) / 2;
      const q = (t, up) => alongX ? [t, at(t, mid) + up, mid] : [mid, at(mid, t) + up, t];
      beam(q(L0, -0.15), q(L1, -0.15), alongX ? 0.3 : d.maxX - d.minX, 0.2);
      for (let t = L0 + 1; t < L1; t += 4) { const top = q(t, -0.2); if (top[1] > LEVEL + 0.4) beam(top, [top[0], BED, top[2]], 0.18, 0.18); }
      boxes.push({ minX: d.minX, maxX: d.maxX, minZ: d.minZ, maxZ: d.maxZ, h: Math.max(d.y0, d.y1), boatOnly: true });
    } else if (d.kind === 'stair') {
      // a steel stair (rusty treads between two side beams, a hand rail on both sides)
      const alongX = d.axis === 'x', mid = alongX ? (d.minZ + d.maxZ) / 2 : (d.minX + d.maxX) / 2;
      const L0 = alongX ? d.minX : d.minZ, L1 = alongX ? d.maxX : d.maxZ, wHalf = alongX ? (d.maxZ - d.minZ) / 2 : (d.maxX - d.minX) / 2;
      const p = (t, up, off) => alongX ? [t, at(t, mid) + up, mid + off] : [mid + off, at(mid, t) + up, t];
      paint(COL.rust, 0.7, 0.6);
      for (let t = L0 + 0.1; t < L1 - 0.05; t += 0.3) { const a = p(t, -0.04, -wHalf + 0.05), b = p(t + 0.24, 0, wHalf - 0.05); pbox(a[0], Math.min(a[1], b[1]) - 0.04, a[2], b[0], Math.max(a[1], b[1]), b[2]); }
      paint(COL.rust2, 0.7, 0.6);
      for (const off of [-wHalf, wHalf]) { beam(p(L0, -0.15, off), p(L1, -0.15, off), 0.08, 0.25); beam(p(L0, 0.95, off), p(L1, 0.95, off), 0.045, 0.045); for (let t = L0; t <= L1 + 0.01; t += 1.5) beam(p(t, -0.1, off), p(t, 0.95, off), 0.04, 0.04); }
    } else if (d.kind === 'landing') {
      // a steel landing on brackets, a rail on the open sides
      paint(COL.rust, 0.7, 0.6);
      pbox(d.minX, d.y - 0.08, d.minZ, d.maxX, d.y, d.maxZ);
      paint(COL.rust2, 0.7, 0.6);
      beam([d.minX, d.y + 0.95, d.minZ], [d.maxX, d.y + 0.95, d.minZ], 0.045, 0.045);
      beam([d.minX, d.y - 0.1, d.minZ], [d.minX, d.y - 1.2, d.maxZ], 0.06, 0.06);
      beam([d.maxX, d.y - 0.1, d.minZ], [d.maxX, d.y - 1.2, d.maxZ], 0.06, 0.06);
    } else if (d.kind === 'roof' && !d.name) {
      // the landing of the market ramp: a deck on legs over the water
      planks(d, () => d.y + 0.003, false);
      paint(COL.rust, 0.8, 0.4);
      pbox(d.minX, d.y - 0.3, d.minZ, d.maxX, d.y - 0.02, d.maxZ, 'nsewb');
      for (const [x, z] of [[d.minX + 0.3, d.minZ + 0.3], [d.minX + 0.3, d.maxZ - 0.3], [d.maxX - 0.3, d.minZ + 0.3]]) beam([x, d.y - 0.3, z], [x, BED, z], 0.2, 0.2);
      paint(COL.steel, 0.55, 0.7);
      beam([d.minX, d.y + 1, d.minZ], [d.maxX, d.y + 1, d.minZ], 0.05, 0.05);
      boxes.push({ minX: d.minX, maxX: d.maxX, minZ: d.minZ, maxZ: d.maxZ, h: d.y, boatOnly: true });
    }
  }

  // =========================================================================
  // 5. RUSTWATER DOCK: the end of the city's street, a quay wall, the gangway
  // =========================================================================
  {
    const rw = WATER.find((w) => w.name === 'rustwater');
    // the quay wall (concrete, stained) from the bottom to the street
    const mb = ctx.mb.plaster;
    mb.color(0.36, 0.37, 0.36, 1).data(0, 0, 0, 0.9);
    mb.quadAuto([SUNK.minX, BED, rw.minZ], [SUNK.minX, BED, rw.maxZ], [SUNK.minX, 0, rw.maxZ], [SUNK.minX, 0, rw.minZ], [1, 0, 0], T.plaster.size);
    // the edge stone and bollards along the quay, a chain between them
    paint([0.42, 0.42, 0.4], 0.85);
    pbox(SUNK.minX - 0.6, -0.02, rw.minZ, SUNK.minX + 0.05, 0.12, rw.maxZ);
    paint(COL.dark, 0.6, 0.6);
    for (let z = rw.minZ + 1.5; z < rw.maxZ; z += 4) if (z < -193.5 || z > -189) drum(SUNK.minX - 0.45, 0.12, z, 0.16, 0.6);
    // an old crane arm over the water (only to look at)
    paint(COL.rust2, 0.7, 0.6);
    beam([SUNK.minX - 3, 0, rw.minZ + 1.6], [SUNK.minX - 3, 7.5, rw.minZ + 1.6], 0.45, 0.45);
    beam([SUNK.minX - 3.5, 7.3, rw.minZ + 1.6], [SUNK.minX + 9, 8.2, rw.minZ + 1.6], 0.35, 0.5);
    paint(COL.dark, 0.6, 0.5);
    beam([SUNK.minX + 8.6, 8.0, rw.minZ + 1.6], [SUNK.minX + 8.6, 2.5, rw.minZ + 1.6], 0.03, 0.03);
    solid(R(SUNK.minX - 3.3, SUNK.minX - 2.7, rw.minZ + 1.3, rw.minZ + 1.9), 7.5);
    // the boat cannot drive onto the street
    boxes.push({ minX: SUNK.minX - 8, maxX: SUNK.minX, minZ: rw.minZ - 4, maxZ: rw.maxZ + 4, h: 0, boatOnly: true });
    // a sign: RUSTWATER DOCK (a board on two posts)
    paint(COL.rust, 0.8, 0.4);
    beam([SUNK.minX - 1.2, 0, -187.8], [SUNK.minX - 1.2, 2.6, -187.8], 0.08, 0.08);
    beam([SUNK.minX - 1.2, 0, -185.2], [SUNK.minX - 1.2, 2.6, -185.2], 0.08, 0.08);
    paint([0.45, 0.4, 0.3], 0.8);
    pbox(SUNK.minX - 1.25, 1.9, -188, SUNK.minX - 1.15, 2.55, -185);
    // two lamps on the quay
    for (const z of [-209.5, -186.5]) {
      paint(COL.steel, 0.5, 0.8);
      beam([SUNK.minX - 1.4, 0, z], [SUNK.minX - 1.4, 4.9, z], 0.12, 0.12);
      beam([SUNK.minX - 1.4, 4.85, z], [SUNK.minX - 0.4, 4.85, z], 0.08, 0.08);
      paint([1, 0.9, 0.75], 0.3, 0, 0.9);
      pbox(SUNK.minX - 0.7, 4.66, z - 0.18, SUNK.minX - 0.25, 4.8, z + 0.18);
      addLamp(SUNK.minX - 0.5, 4.65, z, 1, 1.2, 4.65, true);
      solid(R(SUNK.minX - 1.6, SUNK.minX - 1.2, z - 0.2, z + 0.2), 4.9);
    }
  }

  // =========================================================================
  // 6. BRIDGES AND ROPE WALKWAYS between the roofs (only to look at)
  // =========================================================================
  for (const [ax, az, bx, bz, kind] of SPANS) {
    const A = lotAt(ax, az), Bl = lotAt(bx, bz);
    if (!A || !Bl) continue;
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    // from the wall of one building to the wall of the other
    const s0 = alongX ? Math.min(A.maxX, Bl.maxX) : Math.min(A.maxZ, Bl.maxZ), s1 = alongX ? Math.max(A.minX, Bl.minX) : Math.max(A.minZ, Bl.minZ);
    const lo = Math.min(s0, s1) - 0.3, hi = Math.max(s0, s1) + 0.3;
    const c = alongX ? az : ax;
    const y = Math.max(LEVEL + 3.6, Math.min(A.top, Bl.top) - (kind === 'rope' ? 1.6 : 1.2));
    const p = (t, up, off = 0) => alongX ? [t, y + up, c + off] : [c + off, y + up, t];
    if (kind === 'steel') {
      paint(COL.rust, 0.75, 0.55);
      beam(p(lo, -0.15), p(hi, -0.15), 2.4, 0.22);                         // the deck
      for (const off of [-1.2, 1.2]) {
        beam(p(lo, 1.1, off), p(hi, 1.1, off), 0.12, 0.12);                // top chord
        beam(p(lo, -0.3, off), p(hi, -0.3, off), 0.16, 0.26);              // bottom chord
        const n = Math.max(2, Math.round((hi - lo) / 1.6));
        for (let k = 0; k <= n; k++) {
          const t = lo + ((hi - lo) * k) / n;
          beam(p(t, -0.3, off), p(t, 1.1, off), 0.08, 0.08);
          if (k < n) beam(p(t, -0.3, off), p(lo + ((hi - lo) * (k + 1)) / n, 1.1, off), 0.05, 0.05);
        }
      }
      paint(COL.rust2, 0.8, 0.5);
      for (let t = lo + 1; t < hi; t += 2.5) beam(p(t, -0.3, -1.2), p(t, -0.3, 1.2), 0.1, 0.1);
      // doors in the walls at both ends
      paint(COL.dark, 0.7, 0.2);
      for (const t of [lo + 0.28, hi - 0.28]) { const a = p(t, 0, -0.7), b = p(t, 2.1, 0.7); pbox(a[0] - (alongX ? 0.02 : 0), a[1], a[2] - (alongX ? 0 : 0.02), b[0] + (alongX ? 0.02 : 0), b[1], b[2] + (alongX ? 0 : 0.02)); }
      spots.push({ ...(alongX ? R(lo, hi, c - 1.6, c + 1.6) : R(c - 1.6, c + 1.6, lo, hi)), top: y, kind: 'bridge' });
    } else {
      // planks between two ropes, sagging in the middle
      const sag = 0.55 + (hi - lo) * 0.012;
      const yAt = (t) => -sag * (1 - ((2 * (t - lo)) / (hi - lo) - 1) ** 2);
      for (let t = lo; t < hi; t += 0.34) {
        paint(rng.chance(0.15) ? COL.wood2 : COL.plank, 0.9);
        const a = p(t, yAt(t), -0.55), b = p(t + 0.24, yAt(t + 0.24), 0.55);
        pbox(a[0], a[1] - 0.04, a[2], b[0], b[1], b[2]);
      }
      paint(COL.rope, 0.95);
      for (const off of [-0.62, 0.62]) {
        let prev = null;
        for (let t = lo; t <= hi + 0.01; t += (hi - lo) / 10) {
          const q = p(t, yAt(t) * 0.75 + 0.95, off);
          if (prev) beam(prev, q, 0.035, 0.035);
          prev = q;
        }
        for (let t = lo + 1.2; t < hi; t += 1.2) beam(p(t, yAt(t), off), p(t, yAt(t) * 0.75 + 0.95, off), 0.02, 0.02);
      }
    }
  }

  // =========================================================================
  // 7. LANTERNS over the water
  // =========================================================================
  // a lamp: its glow, its pool of light on the map (pool), and a real light near the player (power; 0 = none).
  // (power 1 = a street light of the city, about 250 at the bulb. The lanterns, bulbs and stalls of The Sunk are
  // small: 0.02 to 0.04 - more than that and the market at night looks like a lit stage.)
  function addLamp(x, y, z, type, size, h, pool, power = 1) {
    // (pool: a number = how strong its light is on the map of lamp light; true = like a street lamp)
    ctx.lamps.push({ x, y, z, type, size, h, noPool: !pool, pool: typeof pool === 'number' ? pool : 1, power, noLight: power <= 0 });
  }
  {
    let k = 0;
    for (const [ax, az, bx, bz, y] of LANTERN_LINES) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / 4.2)), sag = 0.5 + len * 0.008;
      const pt = (t) => [ax + (bx - ax) * t, y - sag * (1 - (2 * t - 1) ** 2), az + (bz - az) * t];
      paint(COL.dark, 0.7, 0.3);
      let prev = pt(0);
      for (let i = 1; i <= 16; i++) { const q = pt(i / 16); beam(prev, q, 0.02, 0.02); prev = q; }
      for (let i = 1; i < n; i++) {
        const q = pt(i / n), ly = q[1] - 0.45;
        const warm = (k++ % 7) !== 3;
        // a cap, the glowing shade, a short cord
        paint(COL.dark, 0.7, 0.3);
        beam([q[0], q[1], q[2]], [q[0], ly + 0.2, q[2]], 0.012, 0.012);
        pbox(q[0] - 0.13, ly + 0.17, q[2] - 0.13, q[0] + 0.13, ly + 0.22, q[2] + 0.13);
        paint(warm ? [0.9, 0.42, 0.12] : [0.15, 0.6, 0.5], 0.6, 0, 0.9);
        ps.add(cylLow, q[0], ly, q[2], null, [0.12, 0.34, 0.12]);
        addLamp(q[0], ly, q[2], warm ? 0 : 1, 0.6, ly - LEVEL, i % 2 === 0 ? 0.25 : false, i % 3 === 0 ? 0.04 : 0);
        lanternList.push({ x: q[0], z: q[2] });
      }
    }
  }

  // =========================================================================
  // 8. THE TIDEWALKER MARKET (the base): stalls on the pontoons, tarps, goods
  // =========================================================================
  {
    const y = DECKS.find((d) => d.name === 'platform').y;
    const aw = ctx.mb.awning;
    const TARPS = [[0.12, 0.25, 0.42], [0.45, 0.18, 0.08], [0.18, 0.3, 0.18], [0.55, 0.48, 0.32], [0.35, 0.1, 0.12], [0.1, 0.32, 0.34]];
    // a stall: four poles, a sloping tarp, a counter of crates, goods, a lamp
    function stall(x0, z0, x1, z1, face, i) {
      const h0 = 2.5, h1 = 2.1;
      paint(COL.wood, 0.9);
      for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) beam([x, y, z], [x, y + (face(x, z) ? h1 : h0), z], 0.09, 0.09);
      const c = TARPS[i % TARPS.length];
      aw.color(c[0], c[1], c[2], 1);
      const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [x, y + (face(x, z) ? h1 : h0) + 0.05, z]);
      aw.quadAuto(pts[0], pts[1], pts[2], pts[3], [0, 1, 0], 2);
      // the counter: crates
      paint(lin([0.36, 0.27, 0.18]), 0.9);
      const cx0 = Math.min(x0, x1) + 0.3, cx1 = Math.max(x0, x1) - 0.3, cz0 = Math.min(z0, z1) + 0.3, cz1 = Math.max(z0, z1) - 0.3;
      const fx = face(x0, z0) && face(x1, z0) ? 'z0' : face(x0, z1) && face(x1, z1) ? 'z1' : face(x0, z0) ? 'x0' : 'x1';
      if (fx === 'z0' || fx === 'z1') { const zz = fx === 'z0' ? cz0 : cz1; pbox(cx0, y, zz - 0.35, cx1, y + 0.95, zz + 0.35); solid(R(cx0, cx1, zz - 0.35, zz + 0.35), y + 0.95); }
      else { const xx = fx === 'x0' ? cx0 : cx1; pbox(xx - 0.35, y, cz0, xx + 0.35, y + 0.95, cz1); solid(R(xx - 0.35, xx + 0.35, cz0, cz1), y + 0.95); }
      // goods on the counter: small boxes, jars, a basket of fish, cables
      for (let k = 0; k < 7; k++) {
        const gx = rng.range(cx0, cx1), gz = rng.range(cz0, cz1);
        const gc = rng.pick([[0.5, 0.45, 0.3], [0.2, 0.35, 0.3], [0.6, 0.2, 0.05], [0.3, 0.3, 0.32], [0.15, 0.15, 0.2], [0.55, 0.55, 0.5]]);
        paint(gc, 0.7, rng.chance(0.3) ? 0.5 : 0);
        const s = rng.range(0.12, 0.3);
        if (fx === 'z0' || fx === 'z1') { const zz = fx === 'z0' ? cz0 : cz1; pbox(gx - s, y + 0.95, zz - s * 0.8, gx + s, y + 0.95 + s * rng.range(0.6, 1.6), zz + s * 0.8); }
        else { const xx = fx === 'x0' ? cx0 : cx1; pbox(xx - s * 0.8, y + 0.95, gz - s, xx + s * 0.8, y + 0.95 + s * rng.range(0.6, 1.6), gz + s); }
      }
      // a bare bulb under the tarp (warm)
      const lx = (x0 + x1) / 2, lz = (z0 + z1) / 2;
      paint([1, 0.6, 0.25], 0.5, 0, 0.85);
      ps.add(cylLow, lx, y + 1.95, lz, null, [0.06, 0.12, 0.06]);
      addLamp(lx, y + 1.95, lz, 0, 0.5, 1.95, 0.2, i % 3 === 0 ? 0.02 : 0);
      spots.push({ ...R(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)), top: y + 2.1, kind: 'tarp' });
    }
    // on the big platform (the counter faces the water, to the east = smaller x)
    let i = 0;
    for (let z = -296; z < -258; z += 6.8) stall(657.5, z, 661.4, z + 4.8, (x) => x < 659, i++);
    // on the north piers (the counter faces the basin, to the south)
    for (let x = 592; x < 611; x += 6.5) stall(x, -250.6, x + 4.4, -247.0, (x2, z2) => z2 < -249, i++);
    for (let x = 634; x < 646; x += 6.5) stall(x, -250.6, x + 4.4, -247.0, (x2, z2) => z2 < -249, i++);
    // the leader's place: a table of a cable drum, crates around it, a canopy
    const L = PLACES.market.leader;
    paint(COL.wood2, 0.9);
    drum(L[0] - 1.2, y, L[2], 0.55, 0.75);
    solid(R(L[0] - 1.8, L[0] - 0.6, L[2] - 0.6, L[2] + 0.6), y + 0.75);
    paint(lin([0.32, 0.25, 0.17]), 0.9);
    pbox(L[0] - 0.25, y, L[2] - 0.3, L[0] + 0.3, y + 0.45, L[2] + 0.3);
    pbox(L[0] - 2.6, y, L[2] + 0.9, L[0] - 2.0, y + 0.45, L[2] + 1.5);
    aw.color(0.2, 0.24, 0.22, 1);
    aw.quadAuto([L[0] - 3.5, y + 2.7, L[2] - 2.5], [L[0] + 1.2, y + 2.7, L[2] - 2.5], [L[0] + 1.2, y + 2.4, L[2] + 2.5], [L[0] - 3.5, y + 2.4, L[2] + 2.5], [0, 1, 0], 2);
    paint(COL.wood, 0.9);
    for (const [x, z, hh] of [[L[0] - 3.5, L[2] - 2.5, 2.7], [L[0] + 1.2, L[2] - 2.5, 2.7], [L[0] - 3.5, L[2] + 2.5, 2.4], [L[0] + 1.2, L[2] + 2.5, 2.4]]) beam([x, y, z], [x, y + hh, z], 0.1, 0.1);
    // a barrel stove (it glows at night), nets hanging to dry, fish racks
    paint(COL.rust, 0.8, 0.5);
    drum(651, y, -268, 0.32, 0.85);
    paint([1, 0.42, 0.1], 0.5, 0, 0.75);
    pbox(650.7, y + 0.6, -268.33, 651.3, y + 0.75, -268.31, 's');
    addLamp(651, y + 1.0, -268, 0, 0.45, 1.0, 0.2, 0.02);
    solid(R(650.6, 651.4, -268.4, -267.6), y + 0.9);
    paint(lin([0.22, 0.2, 0.15]), 0.95);
    for (let z = -300; z < -253; z += 9) { beam([648.4, y, z], [648.4, y + 2.2, z], 0.07, 0.07); beam([648.4, y, z + 3], [648.4, y + 2.2, z + 3], 0.07, 0.07); beam([648.4, y + 2.15, z], [648.4, y + 2.15, z + 3], 0.04, 0.04); pbox(648.38, y + 0.6, z + 0.1, 648.42, y + 2.1, z + 2.9, 'ew'); }
    // crates and drums on the piers (the Tidewalkers' goods)
    for (let k = 0; k < 26; k++) {
      const d = rng.pick(DECKS.filter((q) => q.kind === 'pontoon' && q.y === y && q.minX > 580 && q.maxX < 665 && q.maxZ < -245));
      const x = rng.range(d.minX + 0.6, d.maxX - 0.6), z = rng.range(d.minZ + 0.6, d.maxZ - 0.6);
      if (Math.hypot(x - L[0], z - L[2]) < 4 || Math.hypot(x - PLACES.market.platform[0], z - PLACES.market.platform[2]) < 3) continue;
      if (d.name === 'platform' && x > 656.5) continue;                 // (not inside a stall)
      if (Math.abs(z - (-248.8)) < 2 && ((x > 591 && x < 612) || (x > 633 && x < 647))) continue;
      const s = rng.range(0.35, 0.6);
      paint(rng.pick([lin([0.36, 0.27, 0.18]), COL.blue, COL.rust2, [0.2, 0.22, 0.2]]), 0.85, 0.1);
      if (rng.chance(0.6)) { pbox(x - s, y, z - s, x + s, y + s * 1.6, z + s); if (rng.chance(0.4)) pbox(x - s * 0.8, y + s * 1.6, z - s * 0.8, x + s * 0.7, y + s * 2.9, z + s * 0.7); }
      else drum(x, y, z, s * 0.6, 0.9);
      solid(R(x - s, x + s, z - s, z + s), y + 0.9);
    }
    // laundry lines across the market cut and hanging cloth
    for (let z = -236; z < -160; z += 19) {
      const yl = 6.5 + rng.range(-0.8, 0.8);
      paint(COL.dark, 0.8);
      beam([615.8, yl, z], [628.2, yl - 0.3, z], 0.015, 0.015);
      for (let x = 617; x < 627; x += rng.range(0.8, 1.6)) {
        const c = rng.pick([[0.55, 0.53, 0.48], [0.2, 0.25, 0.4], [0.5, 0.15, 0.1], [0.35, 0.4, 0.3], [0.5, 0.4, 0.2]]);
        paint(c, 0.95);
        const w = rng.range(0.4, 0.7), h = rng.range(0.4, 0.9), yy = yl - 0.3 * ((x - 615.8) / 12.4) - 0.03;
        pbox(x, yy - h, z - 0.01, x + w, yy, z + 0.01, 'ns');
      }
    }
  }

  // =========================================================================
  // 9. LENA'S FLAT: a half-sunk warehouse, its loading door open to the canal
  // =========================================================================
  const lenaRoom = { intact: null, wrecked: null };
  {
    const b = SPECIAL.lena, rm = b.room, fy = b.roomFloor, cy = b.roomTop;
    const [o0, o1] = b.opening;
    oldWalls({ ...b, mat: 'brick', tint: 4, seed: 777 }, { open: { S: [b.maxX - o1, b.maxX - o0, LEVEL + 0.3, cy] }, roofWall: 0 });
    // (the south side runs from x = maxX to minX: the opening is measured from the west end)
    // the inside: floor, ceiling, walls around the room and the short hall to the loading door
    const pm = ctx.mb.plaster;
    pm.color(0.3, 0.3, 0.29, 1).data(0, 0, 0, 1);
    const tile = T.plaster.size;
    pm.quadAuto([rm.minX, cy, rm.minZ], [rm.maxX, cy, rm.minZ], [rm.maxX, cy, rm.maxZ], [rm.minX, cy, rm.maxZ], [0, -1, 0], tile);
    pm.quadAuto([o0, cy, b.minZ], [o1, cy, b.minZ], [o1, cy, rm.minZ], [o0, cy, rm.minZ], [0, -1, 0], tile);
    pm.color(0.4, 0.38, 0.35, 1);
    pm.quadAuto([rm.minX, fy, rm.minZ], [rm.minX, cy, rm.minZ], [rm.minX, cy, rm.maxZ], [rm.minX, fy, rm.maxZ], [1, 0, 0], tile);
    pm.quadAuto([rm.maxX, fy, rm.minZ], [rm.maxX, cy, rm.minZ], [rm.maxX, cy, rm.maxZ], [rm.maxX, fy, rm.maxZ], [-1, 0, 0], tile);
    pm.quadAuto([rm.minX, fy, rm.maxZ], [rm.maxX, fy, rm.maxZ], [rm.maxX, cy, rm.maxZ], [rm.minX, cy, rm.maxZ], [0, 0, -1], tile);
    pm.quadAuto([rm.minX, fy, rm.minZ], [o0, fy, rm.minZ], [o0, cy, rm.minZ], [rm.minX, cy, rm.minZ], [0, 0, 1], tile);
    pm.quadAuto([o1, fy, rm.minZ], [rm.maxX, fy, rm.minZ], [rm.maxX, cy, rm.minZ], [o1, cy, rm.minZ], [0, 0, 1], tile);
    // the hall: its two side walls and the floor under the ramp
    pm.color(0.33, 0.32, 0.3, 1);
    pm.quadAuto([o0, LEVEL - 0.3, b.minZ], [o0, cy, b.minZ], [o0, cy, rm.minZ], [o0, LEVEL - 0.3, rm.minZ], [1, 0, 0], tile);
    pm.quadAuto([o1, LEVEL - 0.3, b.minZ], [o1, cy, b.minZ], [o1, cy, rm.minZ], [o1, LEVEL - 0.3, rm.minZ], [-1, 0, 0], tile);
    // the room floor: old concrete with boards on it
    ctx.mb.asphalt.color(0.5, 0.48, 0.45, 1);
    ctx.mb.asphalt.groundRect(rm.minX, rm.minZ, rm.maxX, rm.maxZ, fy, T.asphalt.size);
    planks(R(698, 714, -127.5, -112), () => fy + 0.012, true);
    // the broken loading door: a bent roller door hanging from the top
    paint([0.3, 0.31, 0.3], 0.6, 0.6);
    beam([o0, cy - 0.35, b.minZ - 0.05], [o1, cy - 0.5, b.minZ - 0.05], 0.06, 0.75);
    beam([o0 + 1.5, cy - 0.85, b.minZ - 0.1], [o0 + 5, cy - 1.4, b.minZ - 0.14], 0.05, 0.4);
    paint(COL.rust, 0.7, 0.6);
    pbox(o0 - 0.25, LEVEL + 0.3, b.minZ - 0.12, o0, cy, b.minZ + 0.02, 'sew');
    pbox(o1, LEVEL + 0.3, b.minZ - 0.12, o1 + 0.25, cy, b.minZ + 0.02, 'sew');
    // walls of the building for people and boats (the room and the hall stay free)
    // (as high as the roof: people walk on it in the raid)
    const H = b.top;
    solid(R(b.minX, rm.minX, b.minZ, b.maxZ), H);
    solid(R(rm.maxX, b.maxX, b.minZ, b.maxZ), H);
    solid(R(rm.minX, rm.maxX, rm.maxZ, b.maxZ), H);
    solid(R(rm.minX, o0, b.minZ, rm.minZ), H);
    solid(R(o1, rm.maxX, b.minZ, rm.minZ), H);
    boxes.push({ minX: o0, maxX: o1, minZ: b.minZ, maxZ: rm.maxZ, h: fy, boatOnly: true });
    // the room counts as a roof over the head (the drones do not see in)
    spots.push({ ...R(rm.minX, rm.maxX, b.minZ, rm.maxZ), top: cy, kind: 'room' });
    // furniture (stays the same whole or wrecked)
    paint(lin([0.3, 0.24, 0.17]), 0.85);
    // the desk: an old door on two crates, along the north wall
    pbox(699.5, fy + 0.74, -111.3, 711, fy + 0.8, -110.25);
    pbox(699.8, fy, -111.1, 700.8, fy + 0.74, -110.3);
    pbox(709.6, fy, -111.1, 710.6, fy + 0.74, -110.3);
    solid(R(699.5, 711, -111.4, -110), fy + 0.8);
    // shelves of hardware on the west wall, a mattress on pallets in the east corner
    paint([0.12, 0.12, 0.13], 0.6, 0.6);
    for (const z of [-124, -120.5, -117]) { pbox(716.6, fy, z, 717.9, fy + 2.4, z + 2.6, 'nsewt'); solid(R(716.6, 717.9, z, z + 2.6), fy + 2.4); }
    paint(lin([0.32, 0.26, 0.18]), 0.9);
    pbox(692.2, fy, -128.2, 694.6, fy + 0.28, -124.2);
    paint(lin([0.5, 0.48, 0.44]), 0.95);
    pbox(692.3, fy + 0.28, -128.1, 694.5, fy + 0.46, -124.3);
    paint(lin([0.2, 0.28, 0.32]), 0.95);
    pbox(692.5, fy + 0.46, -127.2, 694.4, fy + 0.5, -124.4, 't');
    solid(R(692.2, 694.6, -128.2, -124.2), fy + 0.5);
    // a camp stove and water jugs, a bucket under a drip, plants in tins by the window
    paint(COL.steel, 0.6, 0.6);
    pbox(695.5, fy, -111.6, 696.6, fy + 0.7, -110.4);
    paint([0.25, 0.4, 0.5], 0.3, 0);
    for (const x of [697.2, 697.7]) drum(x, fy, -111.0, 0.18, 0.5);
    paint([0.3, 0.32, 0.33], 0.6, 0.5);
    drum(703, fy, -121, 0.2, 0.32);
    P.shrub.add(713.5, fy + 0.2, -111.2, 0, 1, 0.45, 0.45, 0.45);
    P.shrub.add(714.4, fy + 0.2, -111.2, 0, 1, 0.4, 0.5, 0.4);
    // cables: across the floor and hanging from the ceiling in loops
    paint([0.02, 0.02, 0.025], 0.6, 0.1);
    for (let k = 0; k < 9; k++) {
      const x0 = rng.range(696, 716), z0 = rng.range(-126, -112), x1 = rng.range(699, 711), z1 = -110.8;
      beam([x0, fy + 0.02, z0], [x1, fy + 0.02, z1], 0.04, 0.03);
    }
    for (let k = 0; k < 7; k++) {
      const x0 = rng.range(694, 716), z0 = rng.range(-127, -112), x1 = x0 + rng.range(-4, 4), z1 = z0 + rng.range(-3, 3);
      const mid = [(x0 + x1) / 2, cy - rng.range(0.5, 1.1), (z0 + z1) / 2];
      beam([x0, cy, z0], mid, 0.03, 0.03); beam(mid, [x1, cy, z1], 0.03, 0.03);
    }
    // a sheet of plastic over a broken window, a tarp hung as a wall
    ctx.mb.awning.color(0.25, 0.3, 0.3, 1);
    ctx.mb.awning.quadAuto([694.5, fy, -116], [694.5, fy, -121.5], [694.5, cy - 0.2, -121.5], [694.5, cy - 0.2, -116], [1, 0, 0], 2);
    // the room's screens and lights are a group of their own (they go dark when the flat is wrecked)
    lenaRoom.build = () => makeLenaScreens(ctx, b, rm, fy);
  }

  // =========================================================================
  // 10. THE GUARD POST: two low roofs, a ramp up the facade, the drone pad
  // =========================================================================
  {
    for (const k of ['postA', 'postB']) {
      const b = SPECIAL[k];
      oldWalls({ ...b, mat: 'plaster', tint: 3, seed: k === 'postA' ? 501 : 502 }, { floors: 1, noParapet: true, roofWall: 0 });
      solid(b, b.top);
    }
    const y = SPECIAL.postA.top;
    // the ramp along the north wall of roof A
    const rampDeck = DECKS.find((d) => d.kind === 'ramp' && d.minZ < -415 && d.minZ > -420);
    if (rampDeck) {
      paint(COL.guard, 0.5, 0.6);
      beam([rampDeck.maxX, LEVEL + 0.4, -415.7], [rampDeck.maxX, PLACES.post.dock[1], -415.7], 0.15, 0.15);
    }
    // the hut of the Guard on roof B: dark panels, a lit strip, an antenna
    const hx = 712.5, hz = -446.5;
    paint(COL.guard, 0.45, 0.65);
    pbox(hx - 2.2, y, hz - 1.6, hx + 2.2, y + 2.7, hz + 1.6);
    paint(COL.guardLine, 0.4, 0, 1.4);
    pbox(hx - 2.21, y + 2.3, hz + 1.6, hx + 2.21, y + 2.38, hz + 1.61, 'n');
    paint([0.5, 0.65, 0.75], 0.2, 0.1, 0.5);
    pbox(hx - 1.2, y + 1.2, hz + 1.6, hx + 0.6, y + 2.0, hz + 1.62, 'n');
    solid(R(hx - 2.2, hx + 2.2, hz - 1.6, hz + 1.6), y + 2.7);
    paint(COL.steel, 0.5, 0.8);
    beam([hx + 1.8, y + 2.7, hz - 1.2], [hx + 1.8, y + 7.5, hz - 1.2], 0.08, 0.08);
    paint([1, 0.1, 0.05], 0.4, 0, 1.6);
    pbox(hx + 1.72, y + 7.5, hz - 1.28, hx + 1.88, y + 7.66, hz - 1.12);
    // the drone pad, floodlights on poles, the camera mast, barriers and crates
    P.dronePad.add(PLACES.post.pad[0], y + 0.02, PLACES.post.pad[2], 0, 1);
    for (const [x, z] of [[699, -428], [714, -428], [699, -449]]) {
      paint(COL.steel, 0.5, 0.8);
      beam([x, y, z], [x, y + 5.2, z], 0.1, 0.1);
      paint([0.9, 0.95, 1], 0.3, 0, 1.2);
      pbox(x - 0.3, y + 5.0, z - 0.2, x + 0.3, y + 5.3, z + 0.2);
      addLamp(x, y + 5.1, z, 1, 1.0, 5.1, true);
      solid(R(x - 0.15, x + 0.15, z - 0.15, z + 0.15), y + 5);
    }
    paint(COL.guard, 0.5, 0.6);
    for (const [x0, z0, x1, z1] of [[664, -428, 671, -427.4], [676, -441, 683, -440.4], [694, -421, 699.5, -420.4]]) {
      pbox(x0, y, z0, x1, y + 0.9, z1);
      paint(COL.guardLine, 0.4, 0, 0.6);
      pbox(x0, y + 0.62, z0 - 0.01, x1, y + 0.7, z1 + 0.01, 'ns');
      paint(COL.guard, 0.5, 0.6);
      solid(R(x0, x1, z0, z1), y + 0.9);
    }
    for (const [x, z, s] of [[668, -440, 0.6], [669.6, -440.2, 0.5], [681, -424, 0.55], [703, -449.5, 0.6], [716, -424, 0.6], [715.8, -425.6, 0.5]]) {
      paint([0.2, 0.22, 0.24], 0.55, 0.4);
      pbox(x - s, y, z - s, x + s, y + s * 1.5, z + s);
      paint(COL.guardLine, 0.4, 0, 0.5);
      pbox(x - s - 0.005, y + s * 1.1, z - s - 0.005, x + s + 0.005, y + s * 1.2, z + s + 0.005, 'nsew');
      solid(R(x - s, x + s, z - s, z + s), y + s * 1.5);
    }
    // the rope walkway over the inlet (planks and two ropes)
    const rope = DECKS.find((d) => d.kind === 'rope');
    for (let x = rope.minX; x < rope.maxX; x += 0.32) { paint(COL.plank, 0.9); pbox(x, y - 0.06, rope.minZ, x + 0.24, y, rope.maxZ); }
    paint(COL.rope, 0.95);
    for (const z of [rope.minZ, rope.maxZ]) { beam([rope.minX, y + 0.95, z], [(rope.minX + rope.maxX) / 2, y + 0.8, z], 0.035, 0.035); beam([(rope.minX + rope.maxX) / 2, y + 0.8, z], [rope.maxX, y + 0.95, z], 0.035, 0.035); }
    // a low wall at the edges of both roofs (only to look at: the edge of the deck stops people anyway)
    paint([0.45, 0.45, 0.43], 0.85);
    for (const k of ['postA', 'postB']) {
      const b = SPECIAL[k];
      pbox(b.minX, y, b.minZ, b.maxX, y + 0.45, b.minZ + 0.2);
      if (k === 'postB') pbox(b.maxX - 0.2, y, b.minZ, b.maxX, y + 0.45, b.maxZ);
      else pbox(b.minX, y, b.minZ, b.minX + 0.2, y + 0.45, b.maxZ - 5);
    }
    spots.push({ ...R(hx - 2.2, hx + 2.2, hz + 1.6, hz + 3.5), top: y + 2.7, kind: 'hut' });
  }

  // =========================================================================
  // 11. THE PUMP HALL over the drain, and the tunnel under it
  // =========================================================================
  {
    const b = SPECIAL.pump, t = PLACES.tunnel, top = b.tunnelTop;
    const half = (627 - 619) / 2;
    const tx0 = 619, tx1 = 627;
    oldWalls({ ...b, mat: 'brick', tint: 2, seed: 909 }, { open: { N: [tx0 - b.minX, tx1 - b.minX, BED, top], S: [b.maxX - tx1, b.maxX - tx0, BED, top] } });
    solid(R(b.minX, tx0, b.minZ, b.maxZ), b.top + PAR);
    solid(R(tx1, b.maxX, b.minZ, b.maxZ), b.top + PAR);
    // the tunnel: its walls, its low ceiling, pipes and dim lamps
    const pm = ctx.mb.brick;
    pm.color(0.22, 0.26, 0.24, 1).data(0, 0, 0, 1);
    pm.quadAuto([tx0, BED, b.minZ], [tx0, top, b.minZ], [tx0, top, b.maxZ], [tx0, BED, b.maxZ], [1, 0, 0], T.brick.size);
    pm.quadAuto([tx1, BED, b.minZ], [tx1, top, b.minZ], [tx1, top, b.maxZ], [tx1, BED, b.maxZ], [-1, 0, 0], T.brick.size);
    pm.color(0.16, 0.18, 0.17, 1);
    pm.quadAuto([tx0, top, b.minZ], [tx1, top, b.minZ], [tx1, top, b.maxZ], [tx0, top, b.maxZ], [0, -1, 0], T.brick.size);
    paint(COL.rust, 0.7, 0.6);
    for (const x of [tx0 + 0.25, tx1 - 0.25]) { log(x, top - 0.5, (b.minZ + b.maxZ) / 2, 0.16, b.maxZ - b.minZ, false); log(x, LEVEL + 1.2, (b.minZ + b.maxZ) / 2, 0.11, b.maxZ - b.minZ, false); }
    for (let z = b.minZ + 4; z < b.maxZ; z += 9) {
      paint([0.5, 0.85, 0.8], 0.4, 0, 1.25);
      pbox(tx0 + 3.2, top - 0.06, z - 0.5, tx1 - 3.2, top - 0.01, z + 0.5, 'b');
      addLamp((tx0 + tx1) / 2, top - 0.1, z, 1, 0.45, top - LEVEL, 0.3, 0.025);
    }
    // the old grate, half pulled up at the south end (the boat passes under it)
    paint(COL.rust, 0.7, 0.7);
    for (let x = tx0 + 0.4; x < tx1; x += 0.5) beam([x, top - 0.65, b.minZ - 0.1], [x, top, b.minZ - 0.1], 0.06, 0.06);
    beam([tx0, top - 0.65, b.minZ - 0.1], [tx1, top - 0.65, b.minZ - 0.1], 0.1, 0.12);
    // lintels over both arches
    paint([0.32, 0.31, 0.29], 0.85);
    for (const z of [b.minZ, b.maxZ]) pbox(tx0 - 0.4, top, z - 0.15, tx1 + 0.4, top + 0.6, z + 0.15);
    spots.push({ minX: t.minX, maxX: t.maxX, minZ: t.minZ, maxZ: t.maxZ, top, kind: 'tunnel' });
    void half;
  }

  // =========================================================================
  // 12. THE LOW BUILDING BY THE MARKET with its roof terrace
  // =========================================================================
  {
    const b = SPECIAL.terrace;
    oldWalls({ ...b, mat: 'brick', tint: 5, seed: 333 }, { floors: 0, noParapet: true, roofWall: 0 });
    solid(b, b.top);
    const y = b.top;
    // a canopy, a long table, plants in tubs and a rain catcher on the roof
    ctx.mb.awning.color(0.42, 0.2, 0.1, 1);
    ctx.mb.awning.quadAuto([668, y + 2.6, -330], [684, y + 2.6, -330], [684, y + 2.3, -318], [668, y + 2.3, -318], [0, 1, 0], 2);
    paint(COL.wood, 0.9);
    for (const [x, z, h] of [[668, -330, 2.6], [684, -330, 2.6], [668, -318, 2.3], [684, -318, 2.3]]) beam([x, y, z], [x, y + h, z], 0.1, 0.1);
    paint(lin([0.34, 0.26, 0.18]), 0.9);
    pbox(671, y + 0.72, -325.6, 681, y + 0.78, -323.6);
    for (const x of [671.5, 680.5]) pbox(x - 0.1, y, -325.4, x + 0.1, y + 0.72, -323.8);
    solid(R(671, 681, -325.6, -323.6), y + 0.78);
    for (let x = 664.5; x < 689; x += 3) { P.planter.add(x, y, -300.9, 0, 1); P.shrub.add(x, y + 0.55, -300.9, 1, 0, 0.9, 0.9, 0.9); }
    paint([0.45, 0.45, 0.43], 0.85);
    pbox(b.minX, y, b.maxZ - 0.2, b.maxX, y + 0.5, b.maxZ);
    pbox(b.maxX - 0.2, y, b.minZ, b.maxX, y + 0.5, b.maxZ);
    pbox(b.minX, y, b.minZ, b.maxX, y + 0.5, b.minZ + 0.2);
    tankSet.add(686, y, -306, 0.4, 0.75);
    solid(R(685, 687, -307, -305), y + 4);
  }

  // =========================================================================
  // 12b. THE ROOF ROUTE west of Lena's flat: two lower roofs; low walls with gaps where the stairs go
  // =========================================================================
  {
    for (const k of ['w1', 'w2']) {
      const b = SPECIAL[k];
      oldWalls({ ...b, mat: k === 'w1' ? 'plaster' : 'brick', tint: k === 'w1' ? 1 : 3, seed: k === 'w1' ? 611 : 612 }, { roofWall: 0 });
      solid(b, b.top);
      // (nothing on these roofs: people run over them in the raid)
    }
    // a low wall along the edge of a roof, from a to b (x or z), with gaps [from, to]
    const edge = (x0, z0, x1, z1, y, gaps = []) => {
      paint([0.4, 0.39, 0.37], 0.9);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const lo = alongX ? Math.min(x0, x1) : Math.min(z0, z1), hi = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
      const cuts = [[lo, lo], ...gaps.slice().sort((a, b) => a[0] - b[0]), [hi, hi]];
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i][1], c = cuts[i + 1][0];
        if (c - a < 0.05) continue;
        if (alongX) pbox(a, y, z0 - 0.12, c, y + 0.5, z0 + 0.12); else pbox(x0 - 0.12, y, a, x0 + 0.12, y + 0.5, c);
      }
    };
    const L = SPECIAL.lena, W1 = SPECIAL.w1, W2 = SPECIAL.w2;
    edge(L.minX, L.maxZ - 0.12, L.maxX, L.maxZ - 0.12, L.top);
    edge(L.minX, L.minZ + 0.12, L.maxX, L.minZ + 0.12, L.top);
    edge(L.minX + 0.12, L.minZ, L.minX + 0.12, L.maxZ, L.top);
    edge(L.maxX - 0.12, L.minZ, L.maxX - 0.12, L.maxZ, L.top, [[-124.9, -122.7]]);
    edge(W1.minX, W1.maxZ - 0.12, W1.maxX, W1.maxZ - 0.12, W1.top);
    edge(W1.minX, W1.minZ + 0.12, W1.maxX, W1.minZ + 0.12, W1.top);
    edge(W1.maxX - 0.12, W1.minZ, W1.maxX - 0.12, W1.maxZ, W1.top, [[-127.9, -125.7]]);
    edge(W2.minX, W2.maxZ - 0.12, W2.maxX, W2.maxZ - 0.12, W2.top);
    edge(W2.minX, W2.minZ + 0.12, W2.maxX, W2.minZ + 0.12, W2.top, [[737.9, 741.7]]);
    edge(W2.maxX - 0.12, W2.minZ, W2.maxX - 0.12, W2.maxZ, W2.top);
    // a roof hatch on Lena's roof (where the stairs from her flat come up)
    paint(COL.rust2, 0.7, 0.5);
    pbox(702.5, L.top, -114.2, 705.5, L.top + 0.9, -112);
    paint(COL.dark, 0.7, 0.2);
    pbox(703, L.top + 0.05, -114.25, 705, L.top + 0.85, -114.2, 's');
    solid(R(702.5, 705.5, -114.2, -112), L.top + 0.9);
    // water barrels and a satellite dish on her roof (she listens to everything)
    dishSet.add(694, L.top, -108, 2.5, 1.4);
    paint(COL.blue, 0.6, 0.1);
    for (const [x, z] of [[716, -108], [716.8, -108.6]]) { drum(x, L.top, z, 0.3, 0.88); solid(R(x - 0.32, x + 0.32, z - 0.32, z + 0.32), L.top + 0.9); }
  }

  // =========================================================================
  // 13. OLD CARS on the bottom of the canals (one sticks out of the water)
  // =========================================================================
  {
    const RUST = [[0.18, 0.08, 0.04], [0.12, 0.13, 0.12], [0.2, 0.16, 0.1], [0.08, 0.1, 0.12], [0.25, 0.1, 0.05]];
    const spotsCars = [[500, -201, 0.4, 0], [534, -260, 1.6, 1], [529, -330, 1.4, 0], [560, -409, 0.1, 1], [640, -137, 0.2, 0], [690, -406, 3.0, 0], [731, -220, 1.5, 1], [731, -360, 1.7, 0], [623, -210, 1.55, 0], [607, -300, 0.7, 1], [575, -141, 3.1, 0], [520 + 9, -175, 1.5, 0]];
    spotsCars.forEach(([x, z, rot, k], i) => {
      const set = k ? sunkenB : sunkenA;
      set.add(x, BED + 0.02, z, rot, 1, RUST[i % RUST.length], rng.range(-0.06, 0.06), rng.range(-0.1, 0.1));
    });
    // the one by the market cut: nose down in the mud, its back out of the water
    sunkenA.add(621.5, LEVEL - 1.55, -190, 0.1, 1, RUST[0], 0.62, 0.08);
    boxes.push({ minX: 620.2, maxX: 622.8, minZ: -192.4, maxZ: -187.6, h: 0.5, boatOnly: true });
  }

  // a few boats that people live on, tied up in the ring (bigger, with a cabin)
  for (const [x, z, rot] of [[534, -372, 0], [726, -168, Math.PI], [705, -403.6, Math.PI / 2], [560, -146, -Math.PI / 2]]) {
    skiffSet.add(x, LEVEL - 0.15, z, rot, 1.9, [0.25, 0.22, 0.18], 0, 0.02);
    const ax = Math.abs(Math.sin(rot)) > 0.5;          // true: the boat lies along x
    const hx = ax ? 4.5 : 1.6, hz = ax ? 1.6 : 4.5;
    boxes.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, h: 0.4, boatOnly: true });
    // a cabin of sheets with a stove pipe and a lit window
    const mb = ctx.mb.metal, cx = ax ? 1.6 : 0.9, cz = ax ? 0.9 : 1.6;
    mb.color(0.36, 0.33, 0.28, 1).data(0, 0, 0, 0.9);
    mb.box(x - cx, LEVEL + 0.4, z - cz, x + cx, LEVEL + 2.1, z + cz, 2, 'nsewt');
    paint([0.62, 0.4, 0.18], 0.4, 0, 0.6);
    if (ax) pbox(x - 0.5, LEVEL + 1.2, z - cz - 0.02, x + 0.5, LEVEL + 1.7, z - cz + 0.01, 's'); else pbox(x - cx - 0.02, LEVEL + 1.2, z - 0.5, x - cx + 0.01, LEVEL + 1.7, z + 0.5, 'e');
    paint(COL.rust, 0.8, 0.5);
    drum(x + (ax ? 0.8 : 0.3), LEVEL + 2.1, z + (ax ? 0.3 : 0.8), 0.08, 0.9, true);
  }

  // =========================================================================
  // 14. FARTHER WEST: more of the old city, the same drowned blocks fading into the mist
  // =========================================================================
  {
    let z = SUNK.minZ + 4;
    while (z < SUNK.maxZ + 30) {
      const len = rng.range(18, 40), w = rng.range(18, 32), x0 = SUNK.maxX + 10 + rng.range(0, 8);
      const floors = rng.int(2, 7);
      const r = R(x0, x0 + w, z, z + len, { top: floors * FL + rng.range(0.6, 1.2), mat: rng.chance(0.6) ? 'brick' : 'plaster', tint: rng.int(0, 5), seed: rng.int(1, 99999) });
      farWalls(r);
      z += len + rng.range(1, 6);
    }
  }
  // walls with painted windows only (far away: no 3D windows, no roof clutter)
  function farWalls(r) {
    const brick = r.mat === 'brick';
    const mb = brick ? ctx.mb.brick : ctx.mb.plaster, tile = brick ? T.brick.size : T.plaster.size;
    const tint = brick ? BRICK_TINTS[r.tint % BRICK_TINTS.length] : PLASTER_TINTS[r.tint % PLASTER_TINTS.length];
    const B = { mb, tile, tint, age: 0.9, uOff: rng.range(0, 50), vOff: rng.range(0, 50), roofY: r.top + PAR, offU: 64 * rng.int(0, 15), offV: 64 * rng.int(0, 15) + 1 };
    const nf = Math.max(1, Math.floor((r.top - 0.5) / FL));
    for (const side of ['N', 'S', 'E', 'W']) {
      const f = sideFrame(r, side), bays = Math.max(1, Math.round(f.len / 2.6));
      kit.wall({ ...B, tint: [tint[0] * 0.35, tint[1] * 0.42, tint[2] * 0.36] }, f, 0, f.len, BED, 0);
      kit.wall(B, f, 0, f.len, 0, nf * FL, { mode: 2, grid: [B.offU, B.offU + bays, B.offV, B.offV + nf] });
      kit.wall(B, f, 0, f.len, nf * FL, r.top + PAR);
    }
    ctx.mb.asphalt.color(0.42, 0.42, 0.44, 1);
    ctx.mb.asphalt.groundRect(r.minX, r.minZ, r.maxX, r.maxZ, r.top, T.asphalt.size);
  }

  // =========================================================================
  // 15. WALLS AROUND THE ZONE: the old edge of the play area north of The Sunk
  // =========================================================================
  // (low: it stops cars and people, but not the eye, the drones or the sun)
  boxes.push({ minX: ctx.layout.raw.oldWestEdge || 472.4, maxX: 800, minZ: SUNK.maxZ, maxZ: 600, h: 0.6 });

  ctx.playableNow = wasPlayable;
  const runtime = createSunkRuntime(ctx, { lenaRoom, spots, lanternList });
  return runtime;
}

// ---------------------------------------------------------------------------
// A small open boat (5 m) for the canals: wooden hull, a bench, an outboard motor.
// Its front is +z, the water line is y = 0.12. The per-copy color paints the hull.
// ---------------------------------------------------------------------------
function makeSkiff() {
  const parts = [];
  const hull = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, Math.PI / 2, Math.PI);
  // the hull: a half tube, narrow at both ends (made from a scaled half cylinder + two pointed ends)
  const shape = new THREE.Shape();
  shape.moveTo(0, -2.5); shape.quadraticCurveTo(0.95, -2.2, 0.95, -0.6); shape.lineTo(0.95, 1.4); shape.quadraticCurveTo(0.9, 2.3, 0, 2.6);
  shape.quadraticCurveTo(-0.9, 2.3, -0.95, 1.4); shape.lineTo(-0.95, -0.6); shape.quadraticCurveTo(-0.95, -2.2, 0, -2.5);
  const body = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false, curveSegments: 5 });
  body.rotateX(Math.PI / 2); body.translate(0, 0.55, 0);
  parts.push({ geom: body, color: [1, 1, 1], rough: 0.8, metal: 0.05, paint: 1 });
  const inside = new THREE.ShapeGeometry(shape, 5);
  inside.rotateX(-Math.PI / 2); inside.translate(0, 0.2, 0); inside.scale(0.9, 1, 0.92);
  parts.push({ geom: inside, color: lin([0.22, 0.16, 0.1]), rough: 0.9, metal: 0 });
  parts.push({ geom: new THREE.BoxGeometry(1.7, 0.06, 0.32), pos: [0, 0.45, -0.3], color: lin([0.3, 0.22, 0.14]), rough: 0.9, metal: 0 });
  parts.push({ geom: new THREE.BoxGeometry(1.7, 0.06, 0.32), pos: [0, 0.45, 1.2], color: lin([0.3, 0.22, 0.14]), rough: 0.9, metal: 0 });
  // the motor at the back
  parts.push({ geom: new THREE.BoxGeometry(0.32, 0.45, 0.4), pos: [0, 0.8, -2.55], color: lin([0.12, 0.12, 0.13]), rough: 0.5, metal: 0.6 });
  parts.push({ geom: new THREE.BoxGeometry(0.1, 0.7, 0.12), pos: [0, 0.3, -2.62], color: lin([0.1, 0.1, 0.1]), rough: 0.5, metal: 0.6 });
  // an old tarp over the front and a coil of rope
  parts.push({ geom: new THREE.BoxGeometry(1.5, 0.1, 1.2), pos: [0, 0.6, 1.9], rot: [0.1, 0, 0], color: lin([0.15, 0.25, 0.32]), rough: 0.95, metal: 0 });
  parts.push({ geom: new THREE.TorusGeometry(0.2, 0.05, 4, 8), pos: [0.4, 0.27, -1.4], rot: [Math.PI / 2, 0, 0], color: lin([0.4, 0.33, 0.22]), rough: 0.95, metal: 0 });
  void hull;
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// The screens in Lena's flat: green and teal lines of code on dark glass.
// One small mesh with its own picture; it goes dark when the flat is wrecked.
// ---------------------------------------------------------------------------
function makeLenaScreens(ctx, b, rm, fy) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  const rng = new RNG(88);
  g.fillStyle = '#020807'; g.fillRect(0, 0, 512, 256);
  // four screens side by side in the picture (each 128 x 256)
  for (let s = 0; s < 4; s++) {
    const x0 = s * 128;
    g.fillStyle = s === 2 ? '#03100e' : '#020a09';
    g.fillRect(x0 + 4, 4, 120, 248);
    g.font = '9px monospace';
    for (let l = 0; l < 26; l++) {
      const w = rng.range(20, 110), y = 14 + l * 9.2;
      g.fillStyle = rng.chance(0.15) ? '#e8a040' : rng.chance(0.5) ? '#3fe0b0' : '#2a9e86';
      if (s === 3 && l % 6 === 0) { g.fillRect(x0 + 10, y - 6, 100 * rng.next(), 5); continue; }
      let txt = '';
      const n = Math.floor(w / 6);
      for (let k = 0; k < n; k++) txt += rng.chance(0.18) ? ' ' : '0123456789abcdef{}()=<>;:_'.charAt(rng.int(0, 25));
      g.fillText(txt, x0 + 8 + (l % 4) * 6, y);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: true, fog: true });
  const geo = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  // four monitors on the desk, a little turned toward the middle
  const screens = [[700.6, 0.32], [703.6, 0.1], [706.8, -0.1], [709.8, -0.32]];
  screens.forEach(([x, turn], s) => {
    const w = 1.2, h = 0.72, y0 = fy + 0.86, z = -110.75;
    const cx = Math.cos(turn), sx = Math.sin(turn);
    const base = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const lx = (0.5 - u) * w;                       // (seen from the room, +x is on the left)
      pos.push(x + lx * cx, y0 + v * h, z + lx * sx);
      uv.push((s + u) / 4, v);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lenaScreens';
  // the dark backs and stands of the monitors
  const backs = new THREE.Mesh(mergeParts(screens.map(([x, turn]) => ({ geom: new THREE.BoxGeometry(1.3, 0.82, 0.06), pos: [x, fy + 1.22, -110.7], rot: [0, -turn, 0], color: [0.02, 0.02, 0.022], rough: 0.5, metal: 0.4 }))
    .concat(screens.map(([x]) => ({ geom: new THREE.BoxGeometry(0.08, 0.1, 0.08), pos: [x, fy + 0.83, -110.65], color: [0.03, 0.03, 0.03], rough: 0.5, metal: 0.5 })))), ctx.mats.prop);
  backs.name = 'lenaScreenBacks';
  const group = new THREE.Group();
  group.add(mesh, backs);
  group.name = 'lenaRoomGlow';
  return { group, mat, mesh };
}

// ===========================================================================
// RUN TIME: the water, the mist, the canal map, decks, fog
// ===========================================================================
function createSunkRuntime(ctx, { lenaRoom, spots, lanternList }) {
  const group = new THREE.Group();
  group.name = 'sunk';
  ctx.group.add(group);

  // ---- the mask picture: r = close to a wall, g = algae, b = the tunnel ----
  const MASK = 512, mx0 = SUNK.minX - 8, mz0 = SUNK.minZ - 16, mw = SUNK.maxX - SUNK.minX + 16, mh = SUNK.maxZ - SUNK.minZ + 24;
  const maskTex = makeMask();
  shared.uPgSunkMask.value = maskTex;
  shared.uPgSunkRect.value.set(mx0, mz0, 1 / mw, 1 / mh);
  function makeMask() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = MASK;
    const g = cv.getContext('2d');
    const img = g.createImageData(MASK, MASK);
    const land = new Float32Array(MASK * MASK), tun = new Float32Array(MASK * MASK);
    for (let j = 0; j < MASK; j++) for (let i = 0; i < MASK; i++) {
      const x = mx0 + ((i + 0.5) / MASK) * mw, z = mz0 + ((j + 0.5) / MASK) * mh;
      land[j * MASK + i] = inWater(x, z) || z < SUNK.minZ ? 0 : 1;
      tun[j * MASK + i] = inTunnel(x, z, -1) ? 1 : 0;
    }
    // soften: a few box blurs (r = 3 pixels, about 2 m)
    const blur = (a, r, passes) => {
      const tmp = new Float32Array(a.length);
      for (let p = 0; p < passes; p++) {
        for (let j = 0; j < MASK; j++) { let s = 0; for (let i = -r; i <= r; i++) s += a[j * MASK + Math.max(0, Math.min(MASK - 1, i))]; for (let i = 0; i < MASK; i++) { tmp[j * MASK + i] = s / (2 * r + 1); s += a[j * MASK + Math.min(MASK - 1, i + r + 1)] - a[j * MASK + Math.max(0, i - r)]; } }
        for (let i = 0; i < MASK; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[Math.max(0, Math.min(MASK - 1, j)) * MASK + i]; for (let j = 0; j < MASK; j++) { a[j * MASK + i] = s / (2 * r + 1); s += tmp[Math.min(MASK - 1, j + r + 1) * MASK + i] - tmp[Math.max(0, j - r) * MASK + i]; } }
      }
    };
    const near = land.slice();
    blur(near, 3, 2);
    blur(tun, 2, 1);
    const rng = new RNG(19);
    // algae: patches near the walls, a few out in the water
    const alg = new Float32Array(MASK * MASK);
    for (let k = 0; k < 4500; k++) {
      const i = rng.int(0, MASK - 1), j = rng.int(0, MASK - 1);
      const n = near[j * MASK + i];
      if (land[j * MASK + i] > 0.5 || (n < 0.08 && !rng.chance(0.1))) continue;
      const r = rng.range(3, 9), s = rng.range(0.55, 1);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= MASK || jj >= MASK) continue;
        const d = Math.hypot(di, dj) / r;
        if (d < 1) alg[jj * MASK + ii] = Math.min(1, alg[jj * MASK + ii] + s * (1 - d) * (1 - d));
      }
    }
    for (let k = 0; k < MASK * MASK; k++) {
      const water = 1 - land[k];
      img.data[k * 4] = Math.round(Math.min(1, near[k] * 1.6) * water * 255);
      img.data[k * 4 + 1] = Math.round(alg[k] * water * 255);
      img.data[k * 4 + 2] = Math.round(tun[k] * 255);
      img.data[k * 4 + 3] = 255;
    }
    // (the picture is stored with z growing downward = row j)
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  // ---- the water: one sheet per canal (where the sea is, the ocean of backdrop.js takes over) ----
  const geo = (() => {
    const pos = [], nor = [], idx = [];
    for (const w of WATER) {
      const z0 = w.minZ, z1 = w.maxZ, b = pos.length / 3;
      pos.push(w.minX, LEVEL, z0, w.minX, LEVEL, z1, w.maxX, LEVEL, z1, w.maxX, LEVEL, z0);
      for (let k = 0; k < 4; k++) nor.push(0, 1, 0);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  })();
  const water = new THREE.Mesh(geo, ctx.mats.canal);
  water.name = 'canalWater';
  water.renderOrder = 6;
  water.receiveShadow = true;
  water.frustumCulled = false;
  group.add(water);

  // ---- mist: soft sheets that drift slowly over the water ----
  const mistGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mistMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(0.5, 0.56, 0.58) }, uOpacity: { value: 0.2 } }]),
    fog: true, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * instanceMatrix * vec4( position, 1.0 );
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform sampler2D uPgNoise;
      uniform float uPgTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec2 c = vUv - 0.5;
        float edge = 1.0 - smoothstep( 0.2, 0.5, length( c ) );
        float n = texture2D( uPgNoise, vWorld.xz * 0.018 + uPgTime * vec2( 0.004, 0.002 ) ).r;
        float n2 = texture2D( uPgNoise, vWorld.xz * 0.05 - uPgTime * vec2( 0.006, 0.003 ) ).r;
        float a = edge * smoothstep( 0.25, 0.8, n * 0.7 + n2 * 0.5 ) * uOpacity;
        // (thin out close to the camera, so we never sit inside a wall of fog)
        a *= smoothstep( 2.0, 14.0, distance( vWorld, cameraPosition ) );
        gl_FragColor = vec4( uColor, a );
        #include <fog_fragment>
      }`,
  });
  mistMat.uniforms.uPgNoise = shared.uPgNoise;
  mistMat.uniforms.uPgTime = shared.uPgTime;
  const MIST = 34;
  const mist = new THREE.InstancedMesh(mistGeo, mistMat, MIST);
  mist.name = 'sunkMist';
  mist.frustumCulled = false;
  mist.renderOrder = 7;
  const mistData = [];
  {
    const rng = new RNG(55);
    const waters = WATER.filter((w) => w.name !== 'drain' && w.name !== 'inlet');
    for (let i = 0; i < MIST; i++) {
      const w = waters[i % waters.length];
      mistData.push({ x: rng.range(w.minX, w.maxX), z: rng.range(w.minZ, w.maxZ), y: LEVEL + rng.range(0.4, 2.6), s: rng.range(18, 34), w, v: rng.range(0.15, 0.4), ph: rng.range(0, 6.28) });
    }
  }
  group.add(mist);
  const _mm = new THREE.Matrix4(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _qq = new THREE.Quaternion();

  // ---- Lena's screens ----
  const screens = lenaRoom.build ? lenaRoom.build() : null;
  if (screens) group.add(screens.group);

  // ---- the canal map (boats, the GPS line) ----
  const nodeIds = Object.keys(NODES);
  const nodes = nodeIds.map((id) => ({ id, x: NODES[id][0], z: NODES[id][1], links: [] }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  for (const [a, b] of EDGES) {
    const A = byId[a], B = byId[b], d = Math.hypot(A.x - B.x, A.z - B.z);
    A.links.push({ to: B, d }); B.links.push({ to: A, d });
  }
  const edges = EDGES.map(([a, b]) => [byId[a], byId[b]]);
  // the nearest point on the canal map
  function snap(x, z) {
    let best = null;
    for (const [A, B] of edges) {
      const dx = B.x - A.x, dz = B.z - A.z, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / L2));
      const px = A.x + dx * t, pz = A.z + dz * t, d = Math.hypot(px - x, pz - z);
      if (!best || d < best.d) best = { d, x: px, z: pz, a: A, b: B, t };
    }
    return best;
  }
  // a way along the canals: list of { x, z }
  function route(x0, z0, x1, z1) {
    const S = snap(x0, z0), E = snap(x1, z1);
    if ((S.a === E.a && S.b === E.b) || (S.a === E.b && S.b === E.a)) return [{ x: x0, z: z0 }, { x: S.x, z: S.z }, { x: E.x, z: E.z }, { x: x1, z: z1 }];
    const dist = new Map(), prev = new Map(), done = new Set();
    dist.set(S.a, Math.hypot(S.a.x - S.x, S.a.z - S.z));
    dist.set(S.b, Math.hypot(S.b.x - S.x, S.b.z - S.z));
    for (;;) {
      let u = null;
      for (const [n, d] of dist) if (!done.has(n) && (!u || d < dist.get(u))) u = n;
      if (!u) break;
      done.add(u);
      for (const l of u.links) { const nd = dist.get(u) + l.d; if (!dist.has(l.to) || nd < dist.get(l.to)) { dist.set(l.to, nd); prev.set(l.to, u); } }
    }
    const ea = (dist.get(E.a) ?? 1e9) + Math.hypot(E.a.x - E.x, E.a.z - E.z), eb = (dist.get(E.b) ?? 1e9) + Math.hypot(E.b.x - E.x, E.b.z - E.z);
    const mid = [];
    for (let n = ea <= eb ? E.a : E.b; n; n = prev.get(n)) mid.unshift({ x: n.x, z: n.z });
    return [{ x: x0, z: z0 }, { x: S.x, z: S.z }, ...mid, { x: E.x, z: E.z }, { x: x1, z: z1 }];
  }
  // a random point on the water near (x, z) (the Guard boats look around there)
  function waterPoint(x, z, r) {
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      const s = snap(x + Math.sin(a) * d, z + Math.cos(a) * d);
      if (s && inSunk(s.x, s.z, 4)) return { x: s.x, z: s.z };
    }
    const s = snap(x, z);
    return { x: s.x, z: s.z };
  }

  // ---- where a person can step off a boat: the nearest deck edge (null = none in reach) ----
  function dockNear(x, z, reach = 4.5) {
    let best = null;
    for (const d of DECKS) {
      if (d.kind !== 'pontoon' && d.kind !== 'gangway' && d.kind !== 'ramp' && d.kind !== 'floor') continue;
      const qx = Math.max(d.minX + 0.6, Math.min(d.maxX - 0.6, x)), qz = Math.max(d.minZ + 0.6, Math.min(d.maxZ - 0.6, z));
      const dd = Math.hypot(qx - x, qz - z);
      if (dd < reach && (!best || dd < best.d)) best = { d: dd, x: qx, z: qz, y: deckAt(d, qx, qz), deck: d };
    }
    return best;
  }

  // ---- how much of The Sunk is around a point (mist), and the tunnel ----
  function fogAt(x, y, z) {
    const dx = Math.max(SUNK.minX - x, 0, x - SUNK.maxX), dz = Math.max(SUNK.minZ - z, 0, z - SUNK.maxZ);
    const k = 1 - Math.min(1, Math.hypot(dx, dz) / 70);
    const t = PLACES.tunnel;
    // the tunnel: from the arch inward, under the low ceiling
    const inX = x > t.minX && x < t.maxX, depth = Math.min(z - (t.minZ - 2), (t.maxZ + 2) - z);
    const tunnel = inX && y < SPECIAL.pump.tunnelTop + 0.6 ? Math.max(0, Math.min(1, depth / 6)) : 0;
    return { k, tunnel };
  }

  let wrecked = false;
  function setLena(state) {
    wrecked = state === 'wrecked';
    if (screens) screens.mesh.visible = !wrecked;
  }

  // ---- every frame ----
  const boatsU = shared.uPgBoats.value;
  function update(dt, time, cam, boats, quality, fogColor) {
    // the ripples of up to three boats (the player's first)
    for (let i = 0; i < 3; i++) {
      const b = boats[i];
      if (b && inSunk(b.x, b.z, 30)) boatsU[i].set(b.x, b.z, Math.hypot(b.vx, b.vz), b.heading);
      else boatsU[i].set(0, 0, 0, 0);
    }
    // the mist drifts along its canal; only near The Sunk
    const near = inSunk(cam.x, cam.z, 160);
    mist.visible = near && quality.sunkMist !== false;
    group.visible = inSunk(cam.x, cam.z, 450);          // (further away the fog hides it all)
    if (mist.visible) {
      for (let i = 0; i < MIST; i++) {
        const m = mistData[i], w = m.w;
        const along = w.maxX - w.minX > w.maxZ - w.minZ;
        let x = m.x, z = m.z;
        const off = ((time * m.v + m.ph * 10) % 60) - 30;
        if (along) x = w.minX + (((m.x - w.minX + off) % (w.maxX - w.minX)) + (w.maxX - w.minX)) % (w.maxX - w.minX);
        else z = w.minZ + (((m.z - w.minZ + off) % (w.maxZ - w.minZ)) + (w.maxZ - w.minZ)) % (w.maxZ - w.minZ);
        _p.set(x, m.y + Math.sin(time * 0.2 + m.ph) * 0.2, z);
        _qq.setFromAxisAngle(_up, m.ph + time * 0.01);
        _sc.set(m.s, 1, m.s * 0.7);
        _mm.compose(_p, _qq, _sc);
        mist.setMatrixAt(i, _mm);
      }
      mist.instanceMatrix.needsUpdate = true;
      // the mist takes the color of the fog, a little lighter
      const fc = fogColor;
      if (fc) mistMat.uniforms.uColor.value.setRGB(fc.r * 1.15 + 0.01, fc.g * 1.15 + 0.012, fc.b * 1.15 + 0.012);
    }
    if (screens) {
      screens.group.visible = Math.abs(cam.x - 705) < 60 && Math.abs(cam.z + 120) < 60;
      // the screens flicker a little
      screens.mat.color.setScalar(wrecked ? 0 : 1.45 + Math.sin(time * 7.3) * 0.04 + (Math.sin(time * 1.3) > 0.97 ? 0.3 : 0));
    }
  }
  const _up = new THREE.Vector3(0, 1, 0);

  // ---- the walkable decks (for the player) ----
  function walk(x, z, y) { return deckHeight(x, z, y, 0.9); }

  // Lena's flat for the camera: the room and the hall up from the loading door
  const L = SPECIAL.lena;
  const room = { minX: L.room.minX, maxX: L.room.maxX, minZ: L.minZ + 0.2, maxZ: L.room.maxZ, floor: L.roomFloor, top: L.roomTop, dist: 3.2 };
  return {
    group, water, mist, spots, lanterns: lanternList, nodes, edges, room,
    market: [PLACES.market.center[0], PLACES.market.center[1]],
    update, route, snap, waterPoint, dockNear, fogAt, walk, setLena,
    inZone: (x, z, m = 0) => inSunk(x, z, m),
    inWater: (x, z, m = 0) => inWater(x, z, m),
    inTunnel: (x, z) => inTunnel(x, z),
    topAt,
    get wrecked() { return wrecked; },
  };
}
