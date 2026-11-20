// ---------------------------------------------------------------------------
// buildings.js - fills every block with buildings.
//
// Step 1 (plan):  place simple boxes along the edges of each block.
// Step 2 (build): give every box walls, windows, a shop floor, signs,
//                 awnings, a roof and a collision box.
//
// All walls of all buildings end up in just two meshes (brick and plaster).
// ---------------------------------------------------------------------------

import { CONFIG } from '../config.js';
import { RNG, insetConvex, pointInConvex, polygonArea } from '../utils/math.js';
import { blockEdges, addDecal } from './ground.js';
import { signUV, SIGN_COLS, NEON_FIRST_ROW, SIGN_ROWS } from './textures.js';

const T = CONFIG.textures;
const FLOOR_H = 3.5;     // meters per floor
const SHOP_OPEN_H = 3.05; // height of a shop opening
const RECESS = 0.16;     // shop fronts sit this far inside the wall

// Wall colors. They multiply the texture, so 1 = the photo as it is.
const BRICK_TINTS = [
  [1.0, 1.0, 1.0], [0.82, 0.8, 0.8], [1.12, 1.02, 0.94], [0.72, 0.7, 0.72], [1.2, 1.12, 1.0],
  [0.9, 0.84, 0.8], [1.05, 0.9, 0.82], [0.66, 0.62, 0.6],
];
const PLASTER_TINTS = [
  [1.0, 1.0, 1.0], [1.05, 1.08, 1.14], [0.84, 0.92, 1.02], [1.06, 0.92, 0.9], [0.86, 0.9, 0.78],
  [0.7, 0.72, 0.76], [1.04, 0.8, 0.68], [0.9, 0.88, 0.84], [0.6, 0.58, 0.56],
];
const NEON_TINTS = [
  [1.08, 1.1, 1.14], [1.1, 0.94, 0.94], [0.84, 1.0, 0.98], [1.08, 1.02, 0.86], [0.86, 0.96, 1.1],
  [1.12, 0.98, 0.84], [0.98, 1.02, 1.04],
];
const ROOF_TINTS = [[0.8, 0.8, 0.82], [1.25, 1.22, 1.16], [0.55, 0.55, 0.56], [1.6, 1.6, 1.55], [1.0, 0.95, 0.9]];
const AWNING_TINTS = [[0.5, 0.1, 0.09], [0.1, 0.27, 0.17], [0.1, 0.16, 0.32], [0.62, 0.46, 0.12], [0.3, 0.3, 0.31], [0.08, 0.3, 0.32], [0.55, 0.3, 0.12]];

// The four sides of a box. For each side:
//   (ox, oz) = the left end of the wall when you look at it from outside
//   (dx, dz) = direction from left to right,  (nx, nz) = points out of the wall
function sideFrame(b, side) {
  switch (side) {
    case 'N': return { side, ox: b.minX, oz: b.maxZ, dx: 1, dz: 0, nx: 0, nz: 1, len: b.maxX - b.minX };
    case 'S': return { side, ox: b.maxX, oz: b.minZ, dx: -1, dz: 0, nx: 0, nz: -1, len: b.maxX - b.minX };
    case 'W': return { side, ox: b.maxX, oz: b.maxZ, dx: 0, dz: -1, nx: 1, nz: 0, len: b.maxZ - b.minZ };
    default: return { side, ox: b.minX, oz: b.minZ, dx: 0, dz: 1, nx: -1, nz: 0, len: b.maxZ - b.minZ };
  }
}
// Point on a wall: s meters from the left end, y meters up, "out" meters in front.
function fp(f, s, y, out = 0) {
  return [f.ox + f.dx * s + f.nx * out, y, f.oz + f.dz * s + f.nz * out];
}

// ---------------------------------------------------------------------------
// STEP 1: plan the boxes of one block
// ---------------------------------------------------------------------------
function styleFor(block, edgeType) {
  if (edgeType === 'neon') return { minW: 9, maxW: 20, minD: 14, maxD: 22, neon: true };
  if (block.district === 'neon') return { minW: 8, maxW: 18, minD: 10, maxD: 15, neon: false, low: true };
  if (edgeType === 'alley') return { minW: 8, maxW: 18, minD: 9, maxD: 14, neon: false };
  return { minW: 7, maxW: 22, minD: 11, maxD: 19, neon: false };
}

function pickFloors(rng, style, corner) {
  if (style.neon || style.low) return rng.int(2, 4);
  // The Grid: mostly 3 to 5 floors, a few taller ones
  const r = rng.next();
  let f = r < 0.1 ? 2 : r < 0.32 ? 3 : r < 0.58 ? 4 : r < 0.78 ? 5 : r < 0.9 ? 6 : r < 0.96 ? 7 : 8;
  if (corner && f < 8 && rng.chance(0.5)) f++;
  return f;
}

function planBlock(block, rng) {
  const lot = insetConvex(block.poly, block.poly.map((p) => p.edge.sidewalk));
  if (lot.length < 3 || polygonArea(lot) < 90) return [];
  const lotBlock = { poly: lot };
  const edges = blockEdges(lotBlock);
  const placed = [];

  const fits = (r) => {
    if (!pointInConvex(lot, r.minX, r.minZ) || !pointInConvex(lot, r.maxX, r.minZ) ||
        !pointInConvex(lot, r.maxX, r.maxZ) || !pointInConvex(lot, r.minX, r.maxZ)) return false;
    for (const b of placed) {
      if (r.maxX > b.minX + 0.02 && r.minX < b.maxX - 0.02 && r.maxZ > b.minZ + 0.02 && r.minZ < b.maxZ - 0.02) return false;
    }
    return true;
  };

  // --- straight edges: a row of buildings with shared walls or small gaps ---
  // start with a different edge in every block so corners vary
  const order = edges.map((e, i) => i);
  const shift = block.id % Math.max(1, order.length);
  for (let k = 0; k < order.length; k++) {
    const e = edges[order[(k + shift) % order.length]];
    if (!e.axis) continue;
    const style = styleFor(block, e.type);
    let s = 0;
    while (s < e.len - style.minW + 0.01) {
      const remain = e.len - s;
      let w = rng.range(style.minW, style.maxW);
      if (w > remain || remain - w < style.minW) w = remain;
      let d = rng.range(style.minD, style.maxD);
      let rect = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const x0 = e.a.x + e.dirX * s, z0 = e.a.z + e.dirZ * s;
        const x1 = x0 + e.dirX * w + e.inX * d, z1 = z0 + e.dirZ * w + e.inZ * d;
        const r = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) };
        if (fits(r)) { rect = r; break; }
        d *= 0.74;
        if (attempt >= 1) w = Math.max(style.minW, w * 0.8);
        if (d < 6) break;
      }
      if (rect) {
        const corner = s < 0.5 || s + w > e.len - 0.5;
        placed.push({ ...rect, style, floors: pickFloors(rng, style, corner), edgeType: e.type, diag: null });
        // neighbours often share a wall; sometimes there is a small gap
        s += w + (rng.chance(0.32) ? rng.range(1.0, 2.6) : 0);
      } else {
        s += 2;
      }
    }
  }

  // --- diagonal edge (along the avenue): boxes in a stair pattern ---
  for (const e of edges) {
    if (e.axis) continue;
    const sx = Math.sign(e.inX), sz = Math.sign(e.inZ);
    const style = styleFor(block, e.type);
    for (let t = 0.5; t < e.len - 3; t += 1.5) {
      const px = e.a.x + e.dirX * t, pz = e.a.z + e.dirZ * t;
      let w = rng.range(9, 18), d = rng.range(9, 16);
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = { minX: Math.min(px, px + sx * w), maxX: Math.max(px, px + sx * w), minZ: Math.min(pz, pz + sz * d), maxZ: Math.max(pz, pz + sz * d) };
        if (fits(r)) {
          placed.push({ ...r, style, floors: pickFloors(rng, style, false), edgeType: 'avenue', diag: { outX: -e.inX, outZ: -e.inZ } });
          break;
        }
        w *= 0.76; d *= 0.76;
        if (w < 6.5 || d < 6.5) break;
      }
    }
  }

  // --- decide what each side of each box faces ---
  for (const b of placed) {
    b.sides = {};
    for (const side of ['N', 'S', 'E', 'W']) {
      const f = sideFrame(b, side);
      const mx = f.ox + f.dx * f.len / 2, mz = f.oz + f.dz * f.len / 2;
      let kind = 'back', edgeType = null;
      // on the edge of the lot? then it faces a street (or an alley)
      for (const e of edges) {
        if (!e.axis) continue;
        const dist = Math.abs((mx - e.a.x) * e.inX + (mz - e.a.z) * e.inZ);
        const along = (mx - e.a.x) * e.dirX + (mz - e.a.z) * e.dirZ;
        const facing = f.nx * -e.inX + f.nz * -e.inZ;
        if (dist < 0.35 && along > -0.5 && along < e.len + 0.5 && facing > 0.9) {
          kind = e.type === 'alley' ? 'alley' : 'front';
          edgeType = e.type;
        }
      }
      // boxes on the diagonal: the two sides that look toward the avenue
      if (kind === 'back' && b.diag && f.nx * b.diag.outX + f.nz * b.diag.outZ > 0.1) {
        kind = 'front';
        edgeType = 'avenue';
      }
      if (kind === 'back' || (kind === 'front' && b.diag)) {
        // is another building right in front of this wall?
        const zone = {
          minX: Math.min(mx - f.dx * (f.len / 2 - 0.6), mx + f.dx * (f.len / 2 - 0.6)) + Math.min(0, f.nx * 3.2),
          maxX: Math.max(mx - f.dx * (f.len / 2 - 0.6), mx + f.dx * (f.len / 2 - 0.6)) + Math.max(0, f.nx * 3.2),
          minZ: Math.min(mz - f.dz * (f.len / 2 - 0.6), mz + f.dz * (f.len / 2 - 0.6)) + Math.min(0, f.nz * 3.2),
          maxZ: Math.max(mz - f.dz * (f.len / 2 - 0.6), mz + f.dz * (f.len / 2 - 0.6)) + Math.max(0, f.nz * 3.2),
        };
        for (const o of placed) {
          if (o === b) continue;
          if (zone.maxX > o.minX && zone.minX < o.maxX && zone.maxZ > o.minZ && zone.minZ < o.maxZ) { kind = 'blocked'; break; }
        }
      }
      b.sides[side] = { kind, edgeType, len: f.len };
    }
  }
  return placed;
}

// ---------------------------------------------------------------------------
// STEP 2: turn one planned box into walls, windows, shops ...
// ---------------------------------------------------------------------------
function buildOne(ctx, block, b, rng) {
  const L = ctx.layout;
  const neonStyle = !!b.style.neon;
  const inNeon = block.district === 'neon';
  const brick = !neonStyle && rng.chance(inNeon ? 0.25 : 0.56);
  const mb = brick ? ctx.mb.brick : ctx.mb.plaster;
  const tile = brick ? T.brick.size : T.plaster.size;
  const tint = brick ? rng.pick(BRICK_TINTS) : neonStyle || inNeon ? rng.pick(NEON_TINTS) : rng.pick(PLASTER_TINTS);

  const hasShops = neonStyle || rng.chance(0.72);
  const groundH = hasShops ? 4.0 : FLOOR_H;
  const top = groundH + (b.floors - 1) * FLOOR_H;
  const parapet = rng.range(0.55, 1.15);
  const cornice = brick && rng.chance(0.55);
  const bayTarget = rng.range(3.3, 4.5);
  const offU = rng.int(0, 180), offV = rng.int(0, 180);
  const litShare = neonStyle ? rng.range(0.2, 0.5) : rng.chance(0.12) ? 0.04 : rng.range(0.14, 0.5);
  const uOff = rng.range(0, 50), vOff = rng.range(0, 50);

  Object.assign(b, { id: ctx.buildings.length, block, brick, tint, groundH, top, parapet, hasShops, neonStyle, playable: block.playable, bays: {} });

  // One wall rectangle. win = null or { u0, u1, v0, v1 } (window bays / floors).
  const wall = (f, s0, s1, y0, y1, out, shade, win) => {
    if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
    mb.color(tint[0] * shade, tint[1] * shade, tint[2] * shade, 1);
    const u0 = (s0 + uOff) / tile, u1 = (s1 + uOff) / tile, v0 = (y0 + vOff) / tile, v1 = (y1 + vOff) / tile;
    const p0 = fp(f, s0, y0, out), p1 = fp(f, s1, y0, out), p2 = fp(f, s1, y1, out), p3 = fp(f, s0, y1, out);
    const w = win || { u0: 0, u1: 0, v0: 0, v1: 0 };
    const on = win ? 1 : 0;
    mb.data(w.u0, w.v0, on, litShare); const a = mb.vertex(p0[0], p0[1], p0[2], f.nx, 0, f.nz, u0, v0);
    mb.data(w.u1, w.v0, on, litShare); const c = mb.vertex(p1[0], p1[1], p1[2], f.nx, 0, f.nz, u1, v0);
    mb.data(w.u1, w.v1, on, litShare); const d = mb.vertex(p2[0], p2[1], p2[2], f.nx, 0, f.nz, u1, v1);
    mb.data(w.u0, w.v1, on, litShare); const e = mb.vertex(p3[0], p3[1], p3[2], f.nx, 0, f.nz, u0, v1);
    mb.quadIdx(a, c, d, e);
  };
  // Small wall piece that faces sideways or down (the sides of a shop opening).
  const reveal = (pts, n, shade) => {
    mb.color(tint[0] * shade, tint[1] * shade, tint[2] * shade, 1);
    mb.data(0, 0, 0, 0);
    mb.quadAuto(pts[0], pts[1], pts[2], pts[3], n, tile);
  };

  for (const side of ['N', 'S', 'E', 'W']) {
    const f = sideFrame(b, side);
    const info = b.sides[side];
    const len = f.len;
    const bays = Math.max(1, Math.floor(len / bayTarget));
    info.bays = bays;
    info.frame = f;

    if (info.kind === 'blocked') {
      // a neighbour is right in front: blank, darker wall (little light gets in)
      wall(f, 0, len, 0, top + parapet, 0, 0.62, null);
      continue;
    }
    const upperWin = { u0: offU, u1: offU + bays, v0: offV, v1: offV + b.floors - 1 };

    if (info.kind === 'front' && hasShops) {
      // ---------------- ground floor with shops ----------------
      const n = Math.max(1, Math.round(len / rng.range(4.3, 5.6)));
      const bayW = len / n;
      const doorBay = n >= 2 && rng.chance(0.6) ? rng.int(0, n - 1) : -1; // entrance to the flats above
      const openings = [];
      for (let i = 0; i < n; i++) {
        let s0 = i * bayW + 0.32, s1 = (i + 1) * bayW - 0.32, h = SHOP_OPEN_H, type;
        if (i === doorBay) {
          type = 2;
          const c = (s0 + s1) / 2;
          s0 = c - 0.6; s1 = c + 0.6; h = 2.6;
        } else {
          const r = rng.next();
          type = r < (neonStyle ? 0.86 : 0.6) ? 0 : r < 0.9 ? 1 : bayW > 4.4 ? 3 : 1;
        }
        openings.push({ s0, s1, h, type });
      }
      info.openings = openings;
      // wall between and above the openings
      let cur = 0;
      for (const o of openings) {
        wall(f, cur, o.s0, 0, groundH, 0, 1, null);
        wall(f, o.s0, o.s1, o.h, groundH, 0, 1, null);
        cur = o.s1;
        // sides and top of the opening (it goes a little into the wall)
        reveal([fp(f, o.s0, 0, 0), fp(f, o.s0, 0, -RECESS), fp(f, o.s0, o.h, -RECESS), fp(f, o.s0, o.h, 0)], [f.dx, 0, f.dz], 0.7);
        reveal([fp(f, o.s1, 0, 0), fp(f, o.s1, 0, -RECESS), fp(f, o.s1, o.h, -RECESS), fp(f, o.s1, o.h, 0)], [-f.dx, 0, -f.dz], 0.7);
        reveal([fp(f, o.s0, o.h, 0), fp(f, o.s1, o.h, 0), fp(f, o.s1, o.h, -RECESS), fp(f, o.s0, o.h, -RECESS)], [0, -1, 0], 0.55);

        // the shop front itself (drawn by the shader)
        const sm = ctx.mb.shop;
        const seed = rng.int(1, 60) + (neonStyle || inNeon ? rng.range(0.0, 0.55) : rng.range(0.38, 0.99));
        const w = o.s1 - o.s0;
        sm.color(1, 1, 1, 1).data(o.type, seed, w, o.h);
        sm.quad(fp(f, o.s0, 0, -RECESS), fp(f, o.s1, 0, -RECESS), fp(f, o.s1, o.h, -RECESS), fp(f, o.s0, o.h, -RECESS),
          [f.nx, 0, f.nz], [0, 0], [1, 0], [1, 1], [0, 1]);
        const lit = o.type === 0 && seed % 1 < 0.62;
        if (lit && block.playable) {
          const c = fp(f, (o.s0 + o.s1) / 2, 0, 1.6);
          ctx.shopLights.push({ x: c[0], z: c[2], r: w * 0.6 + 3.2, power: neonStyle ? 0.5 : 0.36 });
        }

        // sign above the shop
        if (o.type !== 2 && rng.chance(neonStyle ? 0.95 : 0.78)) {
          const neonSign = (neonStyle || inNeon) && rng.chance(0.6);
          const idx = neonSign ? SIGN_COLS * NEON_FIRST_ROW + rng.int(0, SIGN_COLS * (SIGN_ROWS - NEON_FIRST_ROW) - 1) : rng.int(0, SIGN_COLS * NEON_FIRST_ROW - 1);
          const sh = Math.min(0.74, groundH - o.h - 0.16);
          const sw = Math.min(w - 0.2, sh * 4);
          const c = (o.s0 + o.s1) / 2, y0 = (o.h + groundH) / 2 - sh / 2;
          const uv = signUV(idx);
          const glow = neonSign ? 1.0 : rng.chance(neonStyle || inNeon ? 0.8 : 0.45) ? rng.range(0.35, 0.6) : 0;
          ctx.mb.sign.color(1, 1, 1, 1).data(glow, 0, 0, 0);
          ctx.mb.sign.quad(fp(f, c - sw / 2, y0, 0.05), fp(f, c + sw / 2, y0, 0.05), fp(f, c + sw / 2, y0 + sh, 0.05), fp(f, c - sw / 2, y0 + sh, 0.05),
            [f.nx, 0, f.nz], [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]);
          if (glow > 0 && block.playable) {
            const p = fp(f, c, 0, 1.2);
            ctx.shopLights.push({ x: p[0], z: p[2], r: 4.5, power: 0.14 * glow });
          }
        }

        // cloth awning over some glass shops
        if (o.type === 0 && rng.chance(neonStyle ? 0.5 : 0.3)) {
          const am = ctx.mb.awning;
          const at = rng.pick(AWNING_TINTS);
          const striped = rng.chance(0.55);
          const a0 = o.s0 - 0.12, a1 = o.s1 + 0.12, yT = o.h - 0.02, yB = o.h - 0.58, reach = rng.range(1.1, 1.5);
          const uA = striped ? a0 / 1.6 : 0.03, uB = striped ? a1 / 1.6 : 0.09;
          am.color(at[0], at[1], at[2], 1).data(0, 0, 0, 0);
          // sloping top
          am.quad(fp(f, a0, yB, reach), fp(f, a1, yB, reach), fp(f, a1, yT, 0.03), fp(f, a0, yT, 0.03),
            [f.nx * 0.37, 0.93, f.nz * 0.37], [uA, 0], [uB, 0], [uB, 0.9], [uA, 0.9]);
          // hanging front flap
          am.quad(fp(f, a0, yB - 0.22, reach), fp(f, a1, yB - 0.22, reach), fp(f, a1, yB, reach), fp(f, a0, yB, reach),
            [f.nx, 0, f.nz], [uA, 0.8], [uB, 0.8], [uB, 1.0], [uA, 1.0]);
          info.awnings = (info.awnings || 0) + 1;
        }
      }
      wall(f, cur, len, 0, groundH, 0, 1, null);
    } else {
      // ---------------- ground floor without shops ----------------
      const winRow = info.kind === 'alley' ? null : { u0: offU, u1: offU + bays, v0: offV - 1, v1: offV };
      if ((info.kind === 'front' || info.kind === 'alley') && len > 5) {
        // one door, the rest of the wall has windows
        const dBay = rng.int(0, bays - 1);
        const bw = len / bays;
        const c = (dBay + 0.5) * bw, s0 = c - 0.6, s1 = c + 0.6, h = 2.6;
        const split = (a, bq) => (winRow ? { u0: winRow.u0 + a / bw, u1: winRow.u0 + bq / bw, v0: winRow.v0, v1: winRow.v1 } : null);
        // windows only in whole bays next to the door bay
        wall(f, 0, dBay * bw, 0, groundH, 0, 1, split(0, dBay * bw));
        wall(f, dBay * bw, s0, 0, groundH, 0, 1, null);
        wall(f, s0, s1, h, groundH, 0, 1, null);
        wall(f, s1, (dBay + 1) * bw, 0, groundH, 0, 1, null);
        wall(f, (dBay + 1) * bw, len, 0, groundH, 0, 1, split((dBay + 1) * bw, len));
        reveal([fp(f, s0, 0, 0), fp(f, s0, 0, -RECESS), fp(f, s0, h, -RECESS), fp(f, s0, h, 0)], [f.dx, 0, f.dz], 0.7);
        reveal([fp(f, s1, 0, 0), fp(f, s1, 0, -RECESS), fp(f, s1, h, -RECESS), fp(f, s1, h, 0)], [-f.dx, 0, -f.dz], 0.7);
        reveal([fp(f, s0, h, 0), fp(f, s1, h, 0), fp(f, s1, h, -RECESS), fp(f, s0, h, -RECESS)], [0, -1, 0], 0.55);
        ctx.mb.shop.color(1, 1, 1, 1).data(2, rng.int(1, 60) + rng.range(0.7, 0.99), s1 - s0, h);
        ctx.mb.shop.quad(fp(f, s0, 0, -RECESS), fp(f, s1, 0, -RECESS), fp(f, s1, h, -RECESS), fp(f, s0, h, -RECESS),
          [f.nx, 0, f.nz], [0, 0], [1, 0], [1, 1], [0, 1]);
      } else {
        wall(f, 0, len, 0, groundH, 0, info.kind === 'back' ? 0.9 : 1, info.kind === 'back' ? null : winRow);
      }
    }

    // ---------------- upper floors, roof edge ----------------
    const shade = info.kind === 'back' ? 0.92 : 1;
    wall(f, 0, len, groundH, top, 0, shade, upperWin);
    wall(f, 0, len, top, top + parapet, 0, shade, null);
    if (cornice && info.kind === 'front') {
      // a ledge sticking out under the roof line (typical for old brick houses)
      const o = 0.26, y0 = top - 0.12, y1 = top + 0.34;
      wall(f, -0.02, len + 0.02, y0, y1, o, 0.8, null);
      reveal([fp(f, 0, y0, 0), fp(f, len, y0, 0), fp(f, len, y0, o), fp(f, 0, y0, o)], [0, -1, 0], 0.5);
      reveal([fp(f, 0, y1, 0), fp(f, len, y1, 0), fp(f, len, y1, o), fp(f, 0, y1, o)], [0, 1, 0], 0.9);
    }

    // soft dark line where the wall meets the sidewalk
    if (block.playable) {
      const wdt = info.kind === 'alley' ? 0.5 : 0.95;
      const c = fp(f, len / 2, 0, wdt / 2);
      addDecal(ctx.mb.decal, 'ao', c[0], c[2], len, wdt, Math.atan2(f.nx, f.nz), L.street.curbHeight + 0.011, 0.9);
    }
  }

  // ---- roof ----
  const rt = rng.pick(ROOF_TINTS);
  ctx.mb.asphalt.color(rt[0], rt[1], rt[2], 1);
  ctx.mb.asphalt.groundRect(b.minX, b.minZ, b.maxX, b.maxZ, top, T.asphalt.size, uOff * 0.1, vOff * 0.1);

  // ---- collision box ----
  ctx.colliders.boxes.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, h: top + parapet });
  ctx.buildings.push(b);
}

// ---------------------------------------------------------------------------
// A plain building for the scenery outside the play area: four walls with
// windows and a roof. No shops, no collision box.
//   box = { minX, maxX, minZ, maxZ },  opts = { brick, tint, windows }
// ---------------------------------------------------------------------------
export function simpleBuilding(ctx, box, floors, rng, opts = {}) {
  const brick = opts.brick ?? rng.chance(0.4);
  const mb = brick ? ctx.mb.brick : ctx.mb.plaster;
  const tile = brick ? T.brick.size : T.plaster.size;
  const tint = opts.tint || (brick ? rng.pick(BRICK_TINTS) : rng.pick(PLASTER_TINTS));
  const top = floors * FLOOR_H + rng.range(0.5, 1.2);
  const offU = rng.int(0, 180), offV = rng.int(0, 180), uOff = rng.range(0, 50);
  const lit = rng.range(0.1, 0.45);
  mb.color(tint[0], tint[1], tint[2], 1);
  for (const side of ['N', 'S', 'E', 'W']) {
    const f = sideFrame(box, side);
    const bays = Math.max(1, Math.floor(f.len / rng.range(3.4, 4.6)));
    const win = opts.windows === false ? 0 : 1;
    const u0 = uOff / tile, u1 = (f.len + uOff) / tile, v1 = top / tile;
    const p0 = fp(f, 0, 0), p1 = fp(f, f.len, 0), p2 = fp(f, f.len, top), p3 = fp(f, 0, top);
    // window rows end a little below the roof edge
    const rows = top / FLOOR_H;
    mb.data(offU, offV, win, lit); const a = mb.vertex(p0[0], p0[1], p0[2], f.nx, 0, f.nz, u0, 0);
    mb.data(offU + bays, offV, win, lit); const b = mb.vertex(p1[0], p1[1], p1[2], f.nx, 0, f.nz, u1, 0);
    mb.data(offU + bays, offV + rows, win, lit); const c = mb.vertex(p2[0], p2[1], p2[2], f.nx, 0, f.nz, u1, v1);
    mb.data(offU, offV + rows, win, lit); const d = mb.vertex(p3[0], p3[1], p3[2], f.nx, 0, f.nz, u0, v1);
    mb.quadIdx(a, b, c, d);
  }
  const rt = rng.pick(ROOF_TINTS);
  ctx.mb.asphalt.color(rt[0], rt[1], rt[2], 1);
  ctx.mb.asphalt.groundRect(box.minX, box.minZ, box.maxX, box.maxZ, top - 0.6, T.asphalt.size);
  return top;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function buildBuildings(ctx) {
  for (const block of ctx.layout.blocks) {
    // every block has its own random numbers, so editing one block does not change the others
    const r = new RNG(ctx.layout.seed * 7919 + block.id * 104729);
    const plan = planBlock(block, r);
    for (const b of plan) buildOne(ctx, block, b, r);
  }
}
