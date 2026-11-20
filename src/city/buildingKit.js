// ---------------------------------------------------------------------------
// buildingKit.js - the KIT OF PARTS that all buildings are made from.
//
// Like in a real game studio, a facade is not modelled by hand. It is put
// together from a few reusable parts that are placed along each wall:
//
//   wall panel      flat piece of wall (brick, plaster or metal sheets)
//   window bay      wall with windows; near the player every window becomes
//                   real 3D: glass set back into the wall, sill, lintel
//   shop front      big glass, roller shutter or garage door + sign + awning
//   door bay        doorway set back into the wall, with steps or a stoop
//   corner piece    corner stones (quoins), cut (chamfered) corners
//   ledge, cornice  thin band at every floor, decorative top edge
//   balcony, fire escape, roof parts, fences, graffiti ...
//
// buildingTypes.js combines these parts into building types.
//
// HOW THE DETAIL STAYS FAST (LOD = level of detail)
//   * Far away, a wall is ONE flat quad. The shader paints the windows on it.
//   * Within about 120 m of the player, small 3D parts are added on top
//     (see DetailSet in utils/geometry.js). They are "instanced": thousands
//     of copies of one model cost one draw call.
//   * On LOW quality the 3D windows are switched off.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { DetailSet } from '../utils/geometry.js';
import { WINDOW_STYLES } from './materials.js';
import { addDecal } from './ground.js';
import * as M from './models.js';
import { signUV, SIGN_COLS, SIGN_ROWS, NEON_FIRST_ROW, HOLO_COUNT, graffitiUV, GRAFFITI_COLS, GRAFFITI_ROWS, RAIL, MARK } from './textures.js';

const T = CONFIG.textures;
export const FLOOR_H = 3.5;    // height of one upper floor (meters)
export const GROUND_H = 4.5;   // height of a ground floor with shops
const RECESS = 0.22;           // shop fronts sit this far inside the wall

// ---------------------------------------------------------------------------
// Colors. Wall tints multiply the photo texture, so 1 = the photo as it is.
// ---------------------------------------------------------------------------
export const BRICK_TINTS = [
  [1.0, 1.0, 1.0], [0.82, 0.8, 0.8], [1.12, 1.02, 0.94], [0.72, 0.7, 0.72], [1.2, 1.12, 1.0],
  [0.9, 0.84, 0.8], [1.05, 0.9, 0.82], [0.66, 0.62, 0.6], [1.15, 1.0, 0.8], [0.8, 0.86, 0.9],
];
export const PLASTER_TINTS = [
  [1.0, 1.0, 1.0], [1.05, 1.08, 1.14], [0.84, 0.92, 1.02], [1.06, 0.92, 0.9], [0.86, 0.9, 0.78],
  [0.7, 0.72, 0.76], [1.04, 0.8, 0.68], [0.9, 0.88, 0.84], [0.6, 0.58, 0.56], [1.1, 1.0, 0.8], [0.78, 0.86, 0.84],
];
export const NEON_TINTS = [
  [1.08, 1.1, 1.14], [1.1, 0.94, 0.94], [0.84, 1.0, 0.98], [1.08, 1.02, 0.86], [0.86, 0.96, 1.1],
  [1.12, 0.98, 0.84], [0.98, 1.02, 1.04], [1.14, 0.9, 0.78], [0.8, 0.94, 0.88],
];
// Painted metal sheets (real colors, there is no photo behind them).
export const METAL_TINTS = [
  [0.3, 0.33, 0.34], [0.2, 0.26, 0.3], [0.36, 0.3, 0.24], [0.42, 0.43, 0.42], [0.16, 0.24, 0.2], [0.34, 0.2, 0.16], [0.26, 0.27, 0.3],
];
export const ROOF_TINTS = [[0.8, 0.8, 0.82], [1.25, 1.22, 1.16], [0.55, 0.55, 0.56], [1.6, 1.6, 1.55], [1.0, 0.95, 0.9]];
const SLOPED_ROOF_TINTS = [[0.5, 0.3, 0.26], [0.36, 0.36, 0.38], [0.5, 0.42, 0.36], [0.3, 0.34, 0.32]];
export const AWNING_TINTS = [[0.5, 0.1, 0.09], [0.1, 0.27, 0.17], [0.1, 0.16, 0.32], [0.62, 0.46, 0.12], [0.3, 0.3, 0.31], [0.08, 0.3, 0.32], [0.55, 0.3, 0.12]];

// Every building gets its own slightly different color, so no two look the same.
export function varyTint(tint, rng, amount = 0.07) {
  const v = 1 + rng.range(-amount, amount);
  return [tint[0] * v * (1 + rng.range(-amount, amount) * 0.6), tint[1] * v, tint[2] * v * (1 + rng.range(-amount, amount) * 0.6)];
}

// ---------------------------------------------------------------------------
// WALL FRAMES. A "frame" describes one straight wall as seen from outside:
//   (ox, oz) = its left end,  (dx, dz) = direction from left to right,
//   (nx, nz) = points out of the wall,  len = its length in meters
// ---------------------------------------------------------------------------
export function frameFrom(ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az) || 1e-6;
  const dx = (bx - ax) / len, dz = (bz - az) / len;
  return { ox: ax, oz: az, dx, dz, nx: -dz, nz: dx, len };
}
// The four sides of a rectangle that is lined up with the map.
export function sideFrame(b, side) {
  switch (side) {
    case 'N': return { side, ox: b.minX, oz: b.maxZ, dx: 1, dz: 0, nx: 0, nz: 1, len: b.maxX - b.minX };
    case 'S': return { side, ox: b.maxX, oz: b.minZ, dx: -1, dz: 0, nx: 0, nz: -1, len: b.maxX - b.minX };
    case 'W': return { side, ox: b.maxX, oz: b.maxZ, dx: 0, dz: -1, nx: 1, nz: 0, len: b.maxZ - b.minZ };
    default: return { side, ox: b.minX, oz: b.minZ, dx: 0, dz: 1, nx: -1, nz: 0, len: b.maxZ - b.minZ };
  }
}
// Point on a wall: s meters from the left end, y meters up, "out" meters in front.
export function fp(f, s, y, out = 0) {
  return [f.ox + f.dx * s + f.nx * out, y, f.oz + f.dz * s + f.nz * out];
}
// Which side of a lot is to the right of / behind / to the left of its front?
const AXES = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const RIGHT_OF = { N: 'W', W: 'S', S: 'E', E: 'N' };
const BACK_OF = { N: 'S', S: 'N', E: 'W', W: 'E' };
const LEFT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };

// How many window bays fit on a wall of this length?
// Returns { bays, bw (width of one bay), m (plain wall left over at each end) }.
function gridFor(len, bayW) {
  const bays = Math.max(1, Math.floor(len / bayW + 0.4));
  let bw = len / bays, m = 0;
  if (bw > bayW * 1.2) { bw = bayW * 1.2; m = (len - bays * bw) / 2; }
  if (bw < bayW * 0.72) return { bays: 0, bw: 0, m: len / 2 }; // too narrow for a window
  return { bays, bw, m };
}

// ===========================================================================
export function createKit(ctx) {
  const L = ctx.layout;
  const mats = ctx.mats;
  const curb = L.street.curbHeight;
  const lin = M.lin;
  const STONE = lin([0.6, 0.58, 0.54]);
  const IRON = [0.012, 0.012, 0.014];

  // ---- the instanced detail parts (one draw call each) -----------------------
  const sets = ctx.sets;
  const S = (name, geom, mat, opts) => (sets[name] = new DetailSet(name, geom, mat, opts));
  // 3D windows are drawn FIRST, then the invisible mask that keeps the wall
  // from being drawn over them (see mats.winMask), then everything else.
  const win = S('window', M.makeWindowModule(), mats.winMod, { maxDistance: 120, facing: true, attrA: true, attrB: true, renderOrder: -3, group: 'window' });
  win.addCompanion('windowMask', new THREE.PlaneGeometry(1, 1), mats.winMask, { renderOrder: -2 });
  const trim = S('trim', M.makeTrimBox(), mats.prop, { maxDistance: 150, facing: true, color: true, group: 'window' });
  const mBalcony = M.makeBalcony();
  const balcony = S('balcony', mBalcony.slab, mats.prop, { maxDistance: 190, facing: true, color: true, castShadow: true });
  const balconyRail = S('balconyRail', mBalcony.rail, mats.rail, { maxDistance: 150, facing: true, renderOrder: 12 });
  const balconySolid = S('balconySolid', M.makeBalconySolid(), mats.prop, { maxDistance: 190, facing: true, color: true, castShadow: true });
  const stoop = S('stoop', M.makeStoop(), mats.prop, { maxDistance: 170, color: true, castShadow: true });
  const fireEscape = S('fireEscape', M.makeFireEscape(true), mats.prop, { maxDistance: 150, facing: true });
  const fireEscapeTop = S('fireEscapeTop', M.makeFireEscape(false), mats.prop, { maxDistance: 150, facing: true });
  const winAC = S('winAC', M.makeWindowAC(), mats.prop, { maxDistance: 110, facing: true });
  const roofAC = S('roofAC', M.makeRoofAC(), mats.prop, { maxDistance: 110 });
  const tank = S('tank', M.makeWaterTank(), mats.prop, { maxDistance: 320 });
  const solar = S('solar', M.makeSolarPanels(), mats.prop, { maxDistance: 170 });
  const vent = S('vent', M.makeRoofVent(), mats.prop, { maxDistance: 85 });
  const dish = S('dish', M.makeDish(), mats.propDouble, { maxDistance: 110 });
  const antenna = S('antenna', M.makeAntenna(), mats.prop, { maxDistance: 170 });
  const shrub = S('shrub', M.makeShrub(5), mats.leaf, { maxDistance: 130 });
  const planter = S('planter', M.makePlanter(), mats.prop, { maxDistance: 110, castShadow: true });
  const weed = S('weed', M.makeWeed(6), mats.frond, { maxDistance: 70 });
  const rubble = S('rubble', M.makeRubble(), mats.prop, { maxDistance: 120, castShadow: true });
  const charger = S('charger', M.makeCharger(), mats.prop, { maxDistance: 160, color: true, castShadow: true });
  // free-standing stretched boxes (wheel stops, curbs): like "trim" but seen from all sides
  const block = S('block', M.makeTrimBox(), mats.prop, { maxDistance: 120, color: true });

  // =========================================================================
  // BASIC PIECES
  // =========================================================================

  // One flat, upright rectangle of wall.
  //   o.grid = [u0, u1, v0, v1]: window cells across and up (see materials.js)
  //   o.mode = window style (+ 8 for painted floor ledges),  o.out = meters in front of the wall
  function wall(B, f, s0, s1, y0, y1, o = {}) {
    if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
    const mb = o.mb || B.mb, tile = B.tile, t = B.tint;
    const sh = o.shade ?? 1, out = o.out || 0, mode = o.mode || 0, age = B.age;
    const g = o.grid || [0, 0, 0, 0];
    // vertex alpha = 2 + meters below the roof edge (the shader hangs dirt streaks from it)
    const roofY = o.roofY ?? B.roofY;
    const a0 = 2 + Math.max(0, roofY - y0), a1 = 2 + Math.max(0, roofY - y1);
    const u0 = (s0 + B.uOff) / tile, u1 = (s1 + B.uOff) / tile, v0 = (y0 + B.vOff) / tile, v1 = (y1 + B.vOff) / tile;
    const p0 = fp(f, s0, y0, out), p1 = fp(f, s1, y0, out), p2 = fp(f, s1, y1, out), p3 = fp(f, s0, y1, out);
    mb.color(t[0] * sh, t[1] * sh, t[2] * sh, a0);
    mb.data(g[0], g[2], mode, age); const a = mb.vertex(p0[0], p0[1], p0[2], f.nx, 0, f.nz, u0, v0);
    mb.data(g[1], g[2], mode, age); const b = mb.vertex(p1[0], p1[1], p1[2], f.nx, 0, f.nz, u1, v0);
    mb.color(t[0] * sh, t[1] * sh, t[2] * sh, a1);
    mb.data(g[1], g[3], mode, age); const c = mb.vertex(p2[0], p2[1], p2[2], f.nx, 0, f.nz, u1, v1);
    mb.data(g[0], g[3], mode, age); const d = mb.vertex(p3[0], p3[1], p3[2], f.nx, 0, f.nz, u0, v1);
    mb.quadIdx(a, b, c, d);
  }

  // Small piece of wall that faces sideways, up or down (4 points, any order around it).
  function piece(B, pts, n, shade = 1, mb = null) {
    const m = mb || B.mb, t = B.tint;
    m.color(t[0] * shade, t[1] * shade, t[2] * shade, 1);
    m.data(0, 0, 0, B.age);
    m.quadAuto(pts[0], pts[1], pts[2], pts[3], n, B.tile);
  }
  function tri(B, p0, p1, p2, n, shade = 1) {
    const t = B.tint;
    B.mb.color(t[0] * shade, t[1] * shade, t[2] * shade, 1);
    B.mb.data(0, 0, 0, B.age);
    B.mb.triAuto(p0, p1, p2, n, B.tile);
  }

  // A stretched box on a wall (ledge, fin, pipe, step ...). Near the player only.
  //   s = middle along the wall, y = bottom, w / h / d = width / height / how far it sticks out
  function addTrim(B, f, s, y, w, h, d, color, out = 0) {
    if (!B.detail) return;
    const p = fp(f, s, y, out);
    trim.add(p[0], p[1], p[2], f.nx, f.nz, w, h, d, null, color);
  }

  // Wall with window cells: ONE quad for the far view + one 3D window per cell.
  //   bays x floors cells, each bw wide and one floor high, starting at (s0, y0)
  //   (u0, v0) = number of the first cell
  function cellWall(B, f, s0, y0, bays, bw, floors, u0, v0, o) {
    if (bays <= 0 || floors <= 0) return;
    const style = o.style;
    wall(B, f, s0, s0 + bays * bw, y0, y0 + floors * FLOOR_H, { mode: style + (o.band ? 8 : 0), grid: [u0, u0 + bays, v0, v0 + floors], shade: o.shade });
    if (!B.detail || o.modules === false || !style) return;
    const r = WINDOW_STYLES[style];
    const flags = style + (o.sill ? 4 : 0) + (o.lintel ? 8 : 0) + (o.surround ? 16 : 0);
    const c = B.reveal;
    for (let j = 0; j < floors; j++) {
      for (let i = 0; i < bays; i++) {
        let w = r[2] * bw, h = r[3] * FLOOR_H;
        const cs = s0 + (i + r[0] + r[2] / 2) * bw;
        let cy = y0 + (j + r[1] + r[3] / 2) * FLOOR_H;
        let fl = flags;
        if (o.door && o.door(i, j)) {
          // balcony door: the opening reaches down to the floor
          const top = y0 + (j + r[1] + r[3]) * FLOOR_H, bot = y0 + j * FLOOR_H + 0.1;
          h = top - bot;
          cy = (top + bot) / 2;
          fl = style + (o.surround ? 16 : 0);
        }
        win.add(f.ox + f.dx * cs, cy, f.oz + f.dz * cs, f.nx, f.nz, 1, 1, 1, [w, h, u0 + i, v0 + j], [c[0], c[1], c[2], fl]);
      }
    }
  }

  // An opening in the ground floor wall: its sides + the shop / door picture
  // that sits "rec" meters inside.  type: 0 glass shop, 1 shutter, 2 door, 3 garage door
  function opening(B, f, s0, s1, y0, h, rec, type, seed) {
    piece(B, [fp(f, s0, y0, 0), fp(f, s0, y0, -rec), fp(f, s0, y0 + h, -rec), fp(f, s0, y0 + h, 0)], [f.dx, 0, f.dz], 0.7);
    piece(B, [fp(f, s1, y0, 0), fp(f, s1, y0, -rec), fp(f, s1, y0 + h, -rec), fp(f, s1, y0 + h, 0)], [-f.dx, 0, -f.dz], 0.7);
    piece(B, [fp(f, s0, y0 + h, 0), fp(f, s1, y0 + h, 0), fp(f, s1, y0 + h, -rec), fp(f, s0, y0 + h, -rec)], [0, -1, 0], 0.5);
    if (rec > 0.3) piece(B, [fp(f, s0, y0 + 0.015, 0), fp(f, s1, y0 + 0.015, 0), fp(f, s1, y0 + 0.015, -rec), fp(f, s0, y0 + 0.015, -rec)], [0, 1, 0], 0.75);
    const sm = ctx.mb.shop;
    sm.color(1, 1, 1, 1).data(type, seed, s1 - s0, h);
    sm.quad(fp(f, s0, y0, -rec), fp(f, s1, y0, -rec), fp(f, s1, y0 + h, -rec), fp(f, s0, y0 + h, -rec), [f.nx, 0, f.nz], [0, 0], [1, 0], [1, 1], [0, 1]);
  }

  // A shop sign: one name from the sign picture. glow = how bright it is at night.
  function sign(f, c, y0, sw, sh, idx, glow, out = 0.05) {
    const uv = signUV(idx);
    ctx.mb.sign.color(1, 1, 1, 1).data(glow, 0, 0, 0);
    ctx.mb.sign.quad(fp(f, c - sw / 2, y0, out), fp(f, c + sw / 2, y0, out), fp(f, c + sw / 2, y0 + sh, out), fp(f, c - sw / 2, y0 + sh, out),
      [f.nx, 0, f.nz], [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]);
  }
  const paintedSign = (rng) => rng.int(0, SIGN_COLS * NEON_FIRST_ROW - 1);
  const neonSign = (rng) => SIGN_COLS * NEON_FIRST_ROW + rng.int(0, SIGN_COLS * (SIGN_ROWS - NEON_FIRST_ROW) - 1);

  // Cloth awning over an opening: a sloping top and a hanging front flap.
  function awning(B, f, a0, a1, yT, rng, tint = null) {
    const am = ctx.mb.awning;
    const at = tint || rng.pick(AWNING_TINTS);
    const striped = rng.chance(0.55);
    const yB = yT - 0.6, reach = rng.range(1.15, 1.55);
    const uA = striped ? a0 / 1.6 : 0.03, uB = striped ? a1 / 1.6 : 0.09;
    am.color(at[0], at[1], at[2], 1).data(0, 0, 0, 0);
    am.quad(fp(f, a0, yB, reach), fp(f, a1, yB, reach), fp(f, a1, yT, 0.03), fp(f, a0, yT, 0.03),
      [f.nx * 0.37, 0.93, f.nz * 0.37], [uA, 0], [uB, 0], [uB, 0.9], [uA, 0.9]);
    am.quad(fp(f, a0, yB - 0.24, reach), fp(f, a1, yB - 0.24, reach), fp(f, a1, yB, reach), fp(f, a0, yB, reach),
      [f.nx, 0, f.nz], [uA, 0.8], [uB, 0.8], [uB, 1.0], [uA, 1.0]);
  }

  // Spray paint on a wall or a shutter.
  function graffiti(B, f, s, y, w, h, out = 0) {
    const rng = B.rng;
    const uv = graffitiUV(rng.int(0, GRAFFITI_COLS * GRAFFITI_ROWS - 1));
    const a = rng.range(0.55, 0.95) * (1 - 0.25 * B.age);
    const gm = ctx.mb.graffiti;
    gm.color(1, 1, 1, a);
    gm.quad(fp(f, s - w / 2, y, out + 0.012), fp(f, s + w / 2, y, out + 0.012), fp(f, s + w / 2, y + h, out + 0.012), fp(f, s - w / 2, y + h, out + 0.012),
      [f.nx, 0, f.nz], [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]);
  }

  // A fence or railing along a line on the ground (see-through picture).
  //   kind: 'chain' | 'bars' | 'picket' | 'planks'.  solid = the player cannot walk through it
  function fence(ax, az, bx, bz, y, h, kind, solid = true, tint = 1) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) return;
    const R = RAIL[kind];
    const n = [-(bz - az) / len, 0, (bx - ax) / len];
    const rm = ctx.mb.rail;
    rm.color(tint, tint, tint, 1);
    rm.quad([ax, y, az], [bx, y, bz], [bx, y + h, bz], [ax, y + h, az], n, [0, R.v0], [len / R.tile, R.v0], [len / R.tile, R.v1], [0, R.v1]);
    if (solid) ctx.colliders.boxes.push({ minX: Math.min(ax, bx) - 0.08, maxX: Math.max(ax, bx) + 0.08, minZ: Math.min(az, bz) - 0.08, maxZ: Math.max(az, bz) + 0.08, h: h + y });
  }

  // Decorative top edge of old buildings: two stone steps that stick out.
  function cornice(B, f, y, o = {}) {
    const len = f.len;
    const tiers = o.big ? [[0.24, 0.34, y - 0.34], [0.46, 0.24, y]] : [[0.2, 0.3, y - 0.12]];
    for (const [out, h, y0] of tiers) {
      wall(B, f, -out, len + out, y0, y0 + h, { out, shade: 0.88, roofY: y0 + h + 6 });
      piece(B, [fp(f, -out, y0, 0), fp(f, len + out, y0, 0), fp(f, len + out, y0, out), fp(f, -out, y0, out)], [0, -1, 0], 0.5);
      piece(B, [fp(f, -out, y0 + h, 0), fp(f, len + out, y0 + h, 0), fp(f, len + out, y0 + h, out), fp(f, -out, y0 + h, out)], [0, 1, 0], 0.95);
      piece(B, [fp(f, -out, y0, 0), fp(f, -out, y0, out), fp(f, -out, y0 + h, out), fp(f, -out, y0 + h, 0)], [-f.dx, 0, -f.dz], 0.8);
      piece(B, [fp(f, len + out, y0, 0), fp(f, len + out, y0, out), fp(f, len + out, y0 + h, out), fp(f, len + out, y0 + h, 0)], [f.dx, 0, f.dz], 0.8);
    }
  }

  // =========================================================================
  // GROUND FLOORS
  // =========================================================================

  // ---- shops: big glass fronts, shutters, signs, awnings ----
  function groundShops(B, f, y0, gH, o) {
    const rng = B.rng, len = f.len, neon = !!o.neon;
    const openH = Math.min(3.3, gH - 1.05);
    const n = Math.max(1, Math.round(len / rng.range(4.6, 6.0)));
    const bayW = len / n;
    const doorBay = o.upperDoor !== false && n >= 2 && rng.chance(0.65) ? rng.int(0, n - 1) : -1; // entrance to the flats above
    const longAwning = o.longAwning && n >= 2 ? rng.pick(AWNING_TINTS) : null;
    let cur = 0, firstShop = null, lastShop = 0;
    for (let i = 0; i < n; i++) {
      let s0 = i * bayW + 0.36, s1 = (i + 1) * bayW - 0.36, h = openH, type, rec = RECESS;
      if (i === doorBay) {
        // doorway: narrow and deep, one step up
        type = 2;
        const c = (s0 + s1) / 2;
        s0 = c - 0.62; s1 = c + 0.62; h = 2.65; rec = 0.6;
      } else {
        const r = rng.next();
        type = r < (neon ? 0.88 : 0.6) ? 0 : r < 0.92 ? 1 : bayW > 4.6 ? 3 : 1;
        if (firstShop === null) firstShop = s0;
        lastShop = s1;
      }
      wall(B, f, cur, s0, y0, y0 + gH);
      wall(B, f, s0, s1, y0 + h, y0 + gH);
      cur = s1;
      const w = s1 - s0, c = (s0 + s1) / 2;
      const seed = rng.int(1, 60) + (neon ? rng.range(0.0, 0.55) : rng.range(0.38, 0.99));
      opening(B, f, s0, s1, y0, h, rec, type, seed);
      if (type === 2) {
        addTrim(B, f, c, y0, w + 0.3, 0.09, 0.3, STONE);          // door step
        continue;
      }
      // light falling out of lit shop windows at night
      if (type === 0 && seed % 1 < 0.62 && B.playable) {
        const p = fp(f, c, 0, 1.6);
        ctx.shopLights.push({ x: p[0], z: p[2], r: w * 0.6 + 3.2, power: neon ? 0.5 : 0.36 });
      }
      // sign above the shop
      if (rng.chance(neon ? 0.95 : 0.8)) {
        const isNeon = neon && rng.chance(0.6);
        const sh = Math.min(0.8, gH - h - 0.22);
        const sw = Math.min(w - 0.2, sh * 4);
        const glow = isNeon ? 1.0 : rng.chance(neon ? 0.8 : 0.45) ? rng.range(0.35, 0.6) : 0;
        sign(f, c, y0 + (h + gH) / 2 - sh / 2, sw, sh, isNeon ? neonSign(rng) : paintedSign(rng), glow);
        if (glow > 0 && B.playable) {
          const p = fp(f, c, 0, 1.2);
          ctx.shopLights.push({ x: p[0], z: p[2], r: 4.5, power: 0.14 * glow });
        }
      }
      // cloth awning over some glass shops
      if (!longAwning && type === 0 && rng.chance(neon ? 0.5 : 0.34)) awning(B, f, s0 - 0.12, s1 + 0.12, y0 + h - 0.02, rng);
      // tags on closed shutters and garage doors
      if (type !== 0 && B.playable && rng.chance(0.3 + 0.4 * B.age)) graffiti(B, f, c + rng.range(-0.3, 0.3), y0 + rng.range(0.5, 1.0), Math.min(w - 0.4, rng.range(1.6, 2.6)), rng.range(1.1, 1.6), -rec);
    }
    wall(B, f, cur, len, y0, y0 + gH);
    if (longAwning && firstShop !== null) awning(B, f, firstShop - 0.2, lastShop + 0.2, y0 + openH - 0.02, rng, longAwning);
    // tags on the wall between two shops
    if (B.playable && !neon && rng.chance(0.12 + 0.2 * B.age) && bayW > 4.4) graffiti(B, f, Math.round(rng.range(1, n - 1)) * bayW, y0 + 0.7, 0.66, 0.66);
  }

  // ---- homes: a raised first floor with windows and a front door up some steps ----
  function groundRes(B, f, y0, gH, o) {
    const rng = B.rng, len = f.len;
    const base = gH - FLOOR_H, yF = y0 + base;
    // darker base that sticks out a little
    wall(B, f, 0, len, y0, yF, { out: 0.05, shade: 0.6 });
    piece(B, [fp(f, 0, yF, 0), fp(f, len, yF, 0), fp(f, len, yF, 0.05), fp(f, 0, yF, 0.05)], [0, 1, 0], 0.8);
    const g = gridFor(len, o.bayW);
    const wo = { style: o.style, sill: o.sill, lintel: o.lintel, surround: o.surround, band: o.bands };
    const v0 = B.offV - 1; // the row of cells below the upper floors
    if (g.bays === 0) {
      wall(B, f, 0, len, yF, y0 + gH);
      return;
    }
    wall(B, f, 0, g.m, yF, y0 + gH);
    wall(B, f, len - g.m, len, yF, y0 + gH);
    if (o.noDoor) {
      cellWall(B, f, g.m, yF, g.bays, g.bw, 1, B.offU, v0, wo);
      return;
    }
    const dBay = g.bays <= 2 ? rng.int(0, g.bays - 1) : rng.int(1, g.bays - 2);
    const sA = g.m + dBay * g.bw, sB = sA + g.bw, c = (sA + sB) / 2;
    const dw = 0.62, dh = 2.6;
    cellWall(B, f, g.m, yF, dBay, g.bw, 1, B.offU, v0, wo);
    cellWall(B, f, sB, yF, g.bays - dBay - 1, g.bw, 1, B.offU + dBay + 1, v0, wo);
    wall(B, f, sA, c - dw, yF, y0 + gH);
    wall(B, f, c - dw, c + dw, yF + dh, y0 + gH);
    wall(B, f, c + dw, sB, yF, y0 + gH);
    opening(B, f, c - dw, c + dw, yF, dh, 0.34, 2, rng.int(1, 60) + rng.range(0.7, 0.99));
    B.door = c; // where the front door is along this wall (front yards leave a gap in the fence here)
    addTrim(B, f, c, yF + dh + 0.02, dw * 2 + 0.5, 0.24, 0.07, B.trim);            // stone above the door
    if (base > 0.7 && y0 < 1) {
      // stoop: stairs from the sidewalk up to the door
      const p = fp(f, c, y0, 0);
      stoop.add(p[0], p[1], p[2], f.nx, f.nz, 1, base / 0.9, 1, null, B.stoopColor);
      const a = fp(f, c - 1.05, 0, 0), b = fp(f, c + 1.05, 0, 2.1);
      ctx.colliders.boxes.push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h: 1.2 });
      if (B.playable) addDecal(ctx.mb.decal, 'blobRect', fp(f, c, 0, 1.05)[0], fp(f, c, 0, 1.05)[2], 2.6, 2.7, Math.atan2(f.nx, f.nz), y0 + 0.012, 0.6);
    } else if (base > 0.15) {
      // two low steps
      addTrim(B, f, c, y0, dw * 2 + 0.5, base, 0.36, STONE);
      addTrim(B, f, c, y0, dw * 2 + 0.5, base / 2, 0.72, STONE);
      const a = fp(f, c - dw - 0.25, 0, 0), b = fp(f, c + dw + 0.25, 0, 0.5);
      ctx.colliders.boxes.push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h: 0.5 });
    }
  }

  // ---- office lobby: glass from side to side, a canopy over the entrance ----
  function groundOffice(B, f, y0, gH, o) {
    const rng = B.rng, len = f.len;
    const openH = gH - 0.9;
    const n = Math.max(1, Math.round(len / 5.4));
    const bayW = len / n, pier = 0.3;
    const entry = Math.floor(n / 2);
    let cur = 0;
    for (let i = 0; i < n; i++) {
      const s0 = i * bayW + pier, s1 = (i + 1) * bayW - pier;
      wall(B, f, cur, s0, y0, y0 + gH);
      wall(B, f, s0, s1, y0 + openH, y0 + gH);
      cur = s1;
      opening(B, f, s0, s1, y0, openH, RECESS + 0.1, 0, rng.int(1, 60) + rng.range(0.0, 0.5));
      if (B.playable) {
        const p = fp(f, (s0 + s1) / 2, 0, 1.6);
        ctx.shopLights.push({ x: p[0], z: p[2], r: bayW * 0.6 + 3, power: 0.3 });
      }
    }
    wall(B, f, cur, len, y0, y0 + gH);
    // canopy: a thin slab over the entrance, with a lit strip under it
    const c = (entry + 0.5) * bayW, cw = Math.min(bayW + 0.6, 6);
    const ps = ctx.mb.propStatic;
    const a = fp(f, c - cw / 2, 0, 0), b = fp(f, c + cw / 2, 0, 2.0);
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[2], b[2]), z1 = Math.max(a[2], b[2]);
    ps.color(0.05, 0.055, 0.06, 1).data(0.4, 0.7, 0, 0);
    ps.box(x0, y0 + openH + 0.05, z0, x1, y0 + openH + 0.23, z1, 1, 'nsewtb');
    ps.color(1.0, 0.9, 0.75, 1).data(0.3, 0, 0, 0.8);
    const l0 = fp(f, c - cw / 2 + 0.3, 0, 0.9), l1 = fp(f, c + cw / 2 - 0.3, 0, 1.1);
    ps.box(Math.min(l0[0], l1[0]), y0 + openH + 0.02, Math.min(l0[2], l1[2]), Math.max(l0[0], l1[0]), y0 + openH + 0.05, Math.max(l0[2], l1[2]), 1, 'nsewb');
    if (rng.chance(0.8)) sign(f, c, y0 + openH + 0.3, Math.min(cw - 0.6, 2.6), 0.5, paintedSign(rng), 0.4, 2.02);
  }

  // ---- workshop / warehouse: big roll-up doors and a small side door ----
  function groundGarage(B, f, y0, gH, o) {
    const rng = B.rng, len = f.len;
    const doorH = Math.min(4.2, gH - 0.7);
    const n = Math.max(1, Math.min(3, Math.floor((len - 2.6) / 5.6)));
    const slot = (len - 2.6) / n;
    let cur = 0;
    const cut = (s0, s1, h, rec, type) => {
      wall(B, f, cur, s0, y0, y0 + gH);
      wall(B, f, s0, s1, y0 + h, y0 + gH);
      cur = s1;
      opening(B, f, s0, s1, y0, h, rec, type, rng.int(1, 60) + rng.range(0.7, 0.99));
    };
    // person door first, then the big doors
    cut(0.9, 2.1, 2.5, 0.2, 2);
    for (let i = 0; i < n; i++) {
      const dw = Math.min(slot - 1.0, rng.range(3.6, 4.8));
      const c = 2.6 + (i + 0.5) * slot;
      cut(c - dw / 2, c + dw / 2, doorH, 0.18, rng.chance(0.7) ? 1 : 3);
      // yellow posts that protect the door frame from trucks
      for (const e of [c - dw / 2 - 0.3, c + dw / 2 + 0.3]) addTrim(B, f, e, y0, 0.16, 1.0, 0.16, lin([0.75, 0.6, 0.08]), 0.25);
      if (B.playable && rng.chance(0.25 + 0.45 * B.age)) graffiti(B, f, c + rng.range(-0.4, 0.4), y0 + rng.range(0.5, 1.2), rng.range(2.0, 3.0), rng.range(1.3, 1.8), -0.18);
    }
    wall(B, f, cur, len, y0, y0 + gH);
    if (rng.chance(0.75) && len > 9) sign(f, 2.6 + slot * n / 2, y0 + doorH + (gH - doorH) / 2 - 0.34, Math.min(len * 0.5, 4.4), 0.68, paintedSign(rng), 0);
  }

  // ---- one entrance in the middle of a short wall (cut corners of corner buildings) ----
  function groundEntry(B, f, y0, gH, o) {
    const rng = B.rng, len = f.len;
    const dw = Math.min(1.15, len / 2 - 0.5), h = Math.min(3.1, gH - 1.0), c = len / 2;
    wall(B, f, 0, c - dw, y0, y0 + gH);
    wall(B, f, c - dw, c + dw, y0 + h, y0 + gH);
    wall(B, f, c + dw, len, y0, y0 + gH);
    opening(B, f, c - dw, c + dw, y0, h, 0.5, 0, rng.int(1, 60) + rng.range(0.0, 0.5));
    addTrim(B, f, c, y0, dw * 2 + 0.4, 0.09, 0.34, STONE);
    const sh = Math.min(0.8, gH - h - 0.2);
    sign(f, c, y0 + (h + gH) / 2 - sh / 2, Math.min(len - 0.5, sh * 4), sh, o.neon ? neonSign(rng) : paintedSign(rng), o.neon ? 1 : 0.5);
    if (B.playable) {
      const p = fp(f, c, 0, 1.6);
      ctx.shopLights.push({ x: p[0], z: p[2], r: 5, power: 0.4 });
    }
  }

  // ---- back side toward an alley: back doors, pipes, tags ----
  function groundService(B, f, y0, gH) {
    const rng = B.rng, len = f.len;
    let cur = 0;
    for (let s = rng.range(2, 6); s < len - 2.2; s += rng.range(7, 13)) {
      const shutter = rng.chance(0.25) && s + 3.4 < len - 1;
      const w = shutter ? 2.6 : 1.1, h = shutter ? 2.8 : 2.35;
      wall(B, f, cur, s, y0, y0 + gH, { shade: 0.9 });
      wall(B, f, s, s + w, y0 + h, y0 + gH, { shade: 0.9 });
      cur = s + w;
      opening(B, f, s, s + w, y0, h, 0.14, shutter ? 1 : 2, rng.int(1, 60) + rng.range(0.7, 0.99));
      // a small lamp box above some back doors
      if (!shutter && rng.chance(0.5)) addTrim(B, f, s + w / 2, y0 + h + 0.2, 0.26, 0.12, 0.2, [1.0, 0.75, 0.4]);
      s += w;
    }
    wall(B, f, cur, len, y0, y0 + gH, { shade: 0.9 });
    if (B.playable) {
      for (let k = 0; k < len / 9; k++) {
        if (rng.chance(0.5)) graffiti(B, f, rng.range(1.6, len - 1.6), y0 + rng.range(0.35, 0.9), rng.range(1.5, 2.8), rng.range(1.0, 1.7));
      }
    }
  }

  // ---- plain wall (back yards) with a door now and then ----
  function groundPlain(B, f, y0, gH, shade) {
    const rng = B.rng, len = f.len;
    if (len > 6 && rng.chance(0.4)) {
      const s = rng.range(1.5, len - 2.8);
      wall(B, f, 0, s, y0, y0 + gH, { shade });
      wall(B, f, s, s + 1.1, y0 + 2.35, y0 + gH, { shade });
      wall(B, f, s + 1.1, len, y0, y0 + gH, { shade });
      opening(B, f, s, s + 1.1, y0, 2.35, 0.12, 2, rng.int(1, 60) + rng.range(0.7, 0.99));
    } else wall(B, f, 0, len, y0, y0 + gH, { shade });
  }

  // =========================================================================
  // ONE WHOLE WALL FACE: ground floor + upper floors + roof edge
  // =========================================================================
  //   kind: 'front'  faces a street: all the detail
  //         'alley'  faces an alley: back doors, pipes, metal stairs
  //         'back'   faces a back yard: painted windows only
  //         'party'  touches the neighbour: blank wall
  //         'gap'    narrow gap to the neighbour: blank and dark
  function face(B, f, kind, o, ends = {}) {
    const rng = B.rng, len = f.len;
    const y0 = o.y0 || 0, gH = o.groundH || 0, floors = o.floors || 0;
    const yU = y0 + gH, top = yU + floors * FLOOR_H, roofY = top + (o.parapet || 0);
    B.roofY = roofY;
    const onGround = y0 < curb + 0.5;
    if (kind === 'party' || kind === 'gap' || len < 1.6) {
      wall(B, f, 0, len, y0, roofY, { shade: kind === 'gap' ? 0.68 : 0.8 });
      return;
    }
    const front = kind === 'front', alley = kind === 'alley';
    const shade = kind === 'back' ? 0.9 : 1;

    // ---- ground floor ----
    if (gH > 0) {
      if (front && o.ground === 'shops') groundShops(B, f, y0, gH, o);
      else if (front && o.ground === 'res') groundRes(B, f, y0, gH, o);
      else if (front && o.ground === 'office') groundOffice(B, f, y0, gH, o);
      else if (front && o.ground === 'garage') groundGarage(B, f, y0, gH, o);
      else if (front && o.ground === 'entry') groundEntry(B, f, y0, gH, o);
      else if (alley) groundService(B, f, y0, gH);
      else groundPlain(B, f, y0, gH, shade);
    }

    // ---- upper floors ----
    const g = gridFor(len, o.bayW);
    const row = B.offV + (B.face++ % 5) * 12; // each face gets its own rows of window cells
    if (floors > 0) {
      const band = front && o.bands;
      const plainMode = { shade, mode: band ? 8 : 0, grid: [0, 0, row, row + floors] };
      if (g.bays === 0 || !o.style) wall(B, f, 0, len, yU, top, plainMode);
      else {
        wall(B, f, 0, g.m, yU, top, plainMode);
        wall(B, f, len - g.m, len, yU, top, plainMode);
        const bal = front && o.balcony ? o.balcony : null;
        const hasBal = (i, j) => bal && j >= (bal.from || 0) && bal.cols(i, g.bays);
        cellWall(B, f, g.m, yU, g.bays, g.bw, floors, B.offU, row, {
          style: o.style, band, shade, modules: kind !== 'back',
          sill: o.sill, lintel: o.lintel, surround: o.surround && front,
          door: bal ? hasBal : null,
        });
        if (B.detail && kind !== 'back') {
          const r = WINDOW_STYLES[o.style];
          for (let j = 0; j < floors; j++) {
            for (let i = 0; i < g.bays; i++) {
              const cs = g.m + (i + r[0] + r[2] / 2) * g.bw, fy = yU + j * FLOOR_H;
              if (hasBal(i, j)) {
                const p = fp(f, cs, fy + 0.04, 0);
                const sx = Math.min(1.4, Math.max(0.62, (g.bw * 0.94) / 3));
                if (bal.kind === 'solid') balconySolid.add(p[0], p[1], p[2], f.nx, f.nz, sx, 1, 1, null, B.balconyColor);
                else {
                  balcony.add(p[0], p[1], p[2], f.nx, f.nz, sx, 1, 1, null, B.balconyColor);
                  balconyRail.add(p[0], p[1], p[2], f.nx, f.nz, sx, 1, 1);
                }
              } else if (o.style !== 3 && rng.chance(alley ? 0.12 : o.ac ?? 0.06)) {
                // air conditioner hanging in the window
                const p = fp(f, cs + rng.range(-0.2, 0.2) * r[2] * g.bw, fy + r[1] * FLOOR_H + 0.2, 0.02);
                winAC.add(p[0], p[1], p[2], f.nx, f.nz);
              }
            }
          }
          // metal fire escape (front of old walk-ups, alley sides)
          if ((front && o.fireEscape) || (alley && floors >= 2 && rng.chance(0.4))) {
            const i = g.bays <= 2 ? 0 : rng.int(0, g.bays - 2);
            const s = g.m + (g.bays === 1 ? 0.5 : i + 1) * g.bw;
            const p = fp(f, s, 0, 0.03);
            for (let j = 0; j < floors; j++) (j < floors - 1 ? fireEscape : fireEscapeTop).add(p[0], yU + j * FLOOR_H + 0.5, p[2], f.nx, f.nz);
          }
        }
      }
      if (B.detail && front) {
        // ledge at every floor
        if (o.bands) for (let j = (gH > 0 ? 0 : 1); j <= floors - (o.cornice ? 1 : 0); j++) addTrim(B, f, len / 2, yU + j * FLOOR_H - 0.1, len + 0.06, 0.2, 0.07, B.trim);
        // upright fins between the windows (offices)
        if (o.fins && g.bays > 0) for (let i = 0; i <= g.bays; i++) addTrim(B, f, g.m + i * g.bw, yU - 0.1, 0.32, top - yU + 0.1, 0.28, B.trim);
      }
      // corner stones on brick buildings
      if (front && o.quoins && len > 5) {
        const rows = (top - y0 - (o.ground === 'shops' ? gH : 0)) / 0.36, qy = o.ground === 'shops' ? yU : y0;
        if (ends.left) wall(B, f, 0, 0.56, qy, top, { out: 0.035, mode: 4, grid: [0.001, 0.999, 0, rows] });
        if (ends.right) wall(B, f, len - 0.56, len, qy, top, { out: 0.035, mode: 4, grid: [0.999, 0.001, 0, rows] });
      }
      // drain pipe from the roof to the ground
      if (B.detail && onGround && (alley || (front && rng.chance(0.3)))) {
        addTrim(B, f, alley ? rng.range(0.5, len - 0.5) : rng.chance(0.5) ? 0.22 : len - 0.22, y0, 0.11, roofY - y0 - 0.1, 0.11, rng.chance(0.5) ? IRON : lin([0.22, 0.14, 0.1]), 0.02);
      }
    }

    // ---- roof edge ----
    if (o.parapet > 0) wall(B, f, 0, len, top, roofY, { shade });
    if (front && o.cornice) cornice(B, f, top, { big: o.cornice === 'big' });
    else if (B.detail && (front || alley) && o.parapet > 0) addTrim(B, f, len / 2, roofY - 0.03, len + 0.1, 0.11, 0.06, B.trim, -0.02); // stone cap
    // soft dark line where the wall meets the sidewalk
    if (B.playable && onGround) {
      const wdt = alley ? 0.5 : 0.95;
      const c = fp(f, len / 2, 0, wdt / 2);
      addDecal(ctx.mb.decal, 'ao', c[0], c[2], len, wdt, Math.atan2(f.nx, f.nz), y0 + 0.011, 0.9);
    }
  }

  // =========================================================================
  // ROOFS
  // =========================================================================

  // Flat roof (the walls around it rise a little higher = parapet).
  //   rects: list of map rectangles { minX, maxX, minZ, maxZ }
  function roofFlat(B, rects, y, o = {}) {
    const rt = o.tint || B.rng.pick(ROOF_TINTS);
    const am = ctx.mb.asphalt;
    am.color(rt[0], rt[1], rt[2], 1);
    for (const r of rects) am.groundRect(r.minX, r.minZ, r.maxX, r.maxZ, y, T.asphalt.size, B.uOff * 0.1, B.vOff * 0.1);
  }
  // Flat roof with any convex outline (points in lot coordinates, same order as the walls).
  function roofPoly(B, pts, y, o = {}) {
    const rt = o.tint || B.rng.pick(ROOF_TINTS);
    const am = ctx.mb.asphalt;
    am.color(rt[0], rt[1], rt[2], 1);
    am.groundPoly(pts.map(([u, v]) => { const p = B.loc.pt(u, v); return { x: p[0], z: p[1] }; }).reverse(), y, T.asphalt.size, B.uOff * 0.1, B.vOff * 0.1);
  }
  // A plain box of wall material standing on a roof or on the ground (chimney, hut ...).
  function boxUp(B, u0, v0, u1, v1, y0, y1, shade = 0.92) {
    const r = B.loc.rect(u0, v0, u1, v1);
    const keep = B.roofY;
    B.roofY = y1;
    for (const s of ['N', 'S', 'E', 'W']) { const f = sideFrame(r, s); wall(B, f, 0, f.len, y0, y1, { shade }); }
    B.roofY = keep;
    piece(B, [[r.minX, y1, r.minZ], [r.minX, y1, r.maxZ], [r.maxX, y1, r.maxZ], [r.maxX, y1, r.minZ]], [0, 1, 0], 0.7);
    return r;
  }
  // Ground of an open lot (parking, station): asphalt lying just above the sidewalk slab.
  function lotGround(B, u0, v0, u1, v1, shade = 0.8) {
    const r = B.loc.rect(u0, v0, u1, v1);
    ctx.mb.asphalt.color(shade, shade, shade, 1);
    ctx.mb.asphalt.groundRect(r.minX, r.minZ, r.maxX, r.maxZ, curb + 0.03, T.asphalt.size, 0.3, 0.7);
    return r;
  }
  // A painted line on the ground between two points in lot coordinates.
  function paintLine(B, ua, va, ub, vb, width = 0.12, color = [0.9, 0.9, 0.88], alpha = 0.85) {
    const a = B.loc.pt(ua, va), b = B.loc.pt(ub, vb);
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const sx = (-dz / len) * width / 2, sz = (dx / len) * width / 2, y = curb + 0.045;
    const mk = ctx.mb.marking;
    mk.color(color[0], color[1], color[2], alpha);
    mk.quad([a[0] - sx, y, a[1] - sz], [a[0] + sx, y, a[1] + sz], [b[0] + sx, y, b[1] + sz], [b[0] - sx, y, b[1] - sz], [0, 1, 0],
      [0, MARK.solid[0]], [0, MARK.solid[1]], [len / 6, MARK.solid[1]], [len / 6, MARK.solid[0]]);
  }
  // A decal (stain, dirt, shadow) at a point given in lot coordinates.
  function lotDecal(B, name, u, v, sx, sz, alpha = 0.8, rot = 0, lift = 0.012) {
    const p = B.loc.pt(u, v);
    addDecal(ctx.mb.decal, name, p[0], p[1], sx, sz, rot, curb + lift, alpha);
  }

  // Soft round shadow on the ground (under heaps and other things standing in a lot).
  function groundShadow(x, z, size, alpha = 0.7) {
    addDecal(ctx.mb.decal, 'blob', x, z, size, size, 0, curb + 0.013, alpha);
  }

  // Inner side of the parapet, so the low wall around a roof also looks solid from above.
  function parapetInside(B, f, top, h) {
    if (h <= 0.05) return;
    const back = { ox: f.ox + f.dx * f.len, oz: f.oz + f.dz * f.len, dx: -f.dx, dz: -f.dz, nx: -f.nx, nz: -f.nz, len: f.len };
    wall(B, back, 0, f.len, top, top + h, { shade: 0.8 });
  }

  // Things standing on a flat roof. r = map rectangle, y = roof height.
  function roofStuff(B, r, y, o = {}) {
    const rng = B.rng;
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
    if (w < 4.5 || d < 4.5) return;
    const px = (m) => rng.range(r.minX + m, r.maxX - m), pz = (m) => rng.range(r.minZ + m, r.maxZ - m);
    // small hut where the stairs come out
    if (o.hut && w > 7 && d > 7 && rng.chance(0.6)) {
      const hx = px(2.6), hz = pz(2.6);
      const hb = { minX: hx - 1.4, maxX: hx + 1.4, minZ: hz - 1.2, maxZ: hz + 1.2 };
      const keep = B.roofY;
      B.roofY = y + 2.6;
      for (const s of ['N', 'S', 'E', 'W']) wall(B, sideFrame(hb, s), 0, s === 'N' || s === 'S' ? 2.8 : 2.4, y, y + 2.6, { shade: 0.9 });
      B.roofY = keep;
      roofFlat(B, [hb], y + 2.6);
    }
    const acs = rng.int(o.shops ? 1 : 0, w * d > 150 ? 3 : 2);
    for (let i = 0; i < acs; i++) { const dir = rng.pick(AXES); roofAC.add(px(1.6), y, pz(1.6), dir[0], dir[1]); }
    for (let i = rng.int(0, 3); i > 0; i--) vent.add(px(1.0), y, pz(1.0), 0, 1);
    // wooden water tank on older, taller houses
    if (o.old && B.floors >= 4 && w > 7 && d > 7 && rng.chance(0.3)) { const a = rng.range(0, 6.28); tank.add(px(2.6), y, pz(2.6), Math.sin(a), Math.cos(a)); }
    if (rng.chance(o.old ? 0.45 : 0.2)) { const a = rng.range(0, 6.28); antenna.add(px(1.2), y, pz(1.2), Math.sin(a), Math.cos(a)); }
    for (let i = rng.int(0, o.old ? 2 : 1); i > 0; i--) { const a = rng.range(-0.3, 0.3); dish.add(px(1.0), y, pz(1.0), Math.sin(a), Math.cos(a)); }
    // solar panels look toward the midday sun in the south
    if (!o.old && w > 8 && d > 6 && rng.chance(0.4)) solar.add((r.minX + r.maxX) / 2 + rng.range(-1, 1), y, (r.minZ + r.maxZ) / 2 + rng.range(-1, 1), 0, -1);
    // a few roofs are gardens: planters and bushes along the edge
    if (o.garden || rng.chance(0.05)) {
      for (let x = r.minX + 1.4; x < r.maxX - 1.2; x += rng.range(1.7, 3.2)) {
        const z = rng.chance(0.5) ? r.minZ + 0.9 : r.maxZ - 0.9;
        planter.add(x, y, z, 0, 1);
        shrub.add(x, y + 0.5, z, 0, 1, rng.range(0.9, 1.5), rng.range(0.9, 1.6), rng.range(0.9, 1.5));
      }
    }
  }

  // Sloped roof with two sides. rect in lot coordinates [u0, v0, u1, v1].
  //   ridgeAlong 'u': the ridge runs along the street,  'v': the gable looks at the street
  function roofGable(B, rect, y, o = {}) {
    const loc = B.loc, rng = B.rng;
    const [u0, v0, u1, v1] = rect;
    const along = o.ridgeAlong || 'u';
    const span = along === 'u' ? v1 - v0 : u1 - u0;
    const rise = o.rise || span * 0.32, ov = 0.35;
    const rt = o.tint || rng.pick(SLOPED_ROOF_TINTS);
    const am = ctx.mb.asphalt;
    am.color(rt[0], rt[1], rt[2], 1);
    const P = (u, v, h) => { const p = loc.pt(u, v); return [p[0], h, p[1]]; };
    const slope = (a, b, c, d) => {
      // normal from the corners (it must point up)
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((x) => x / l);
      if (n[1] < 0) n = n.map((x) => -x);
      am.quadAuto(a, b, c, d, n, T.asphalt.size);
    };
    const eave = y - (ov * rise) / (span / 2); // the roof hangs over the wall a little
    if (along === 'u') {
      const vm = (v0 + v1) / 2;
      slope(P(u0 - ov, v0 - ov, eave), P(u1 + ov, v0 - ov, eave), P(u1 + ov, vm, y + rise), P(u0 - ov, vm, y + rise));
      slope(P(u0 - ov, v1 + ov, eave), P(u1 + ov, v1 + ov, eave), P(u1 + ov, vm, y + rise), P(u0 - ov, vm, y + rise));
      // the two triangle walls at the ends
      const fl = loc.frame(u0, v1, u0, v0), fr = loc.frame(u1, v0, u1, v1);
      tri(B, P(u0, v0, y), P(u0, v1, y), P(u0, vm, y + rise), [fl.nx, 0, fl.nz], 0.95);
      tri(B, P(u1, v0, y), P(u1, v1, y), P(u1, vm, y + rise), [fr.nx, 0, fr.nz], 0.95);
    } else {
      const um = (u0 + u1) / 2;
      slope(P(u0 - ov, v0 - ov, eave), P(u0 - ov, v1 + ov, eave), P(um, v1 + ov, y + rise), P(um, v0 - ov, y + rise));
      slope(P(u1 + ov, v0 - ov, eave), P(u1 + ov, v1 + ov, eave), P(um, v1 + ov, y + rise), P(um, v0 - ov, y + rise));
      const ff = loc.frame(u0, v0, u1, v0), fb = loc.frame(u1, v1, u0, v1);
      tri(B, P(u0, v0, y), P(u1, v0, y), P(um, v0, y + rise), [ff.nx, 0, ff.nz], 1);
      tri(B, P(u0, v1, y), P(u1, v1, y), P(um, v1, y + rise), [fb.nx, 0, fb.nz], 0.9);
    }
    return rise;
  }

  // Sawtooth roof of old factories: a row of ridges, each with one upright
  // glass side (north light) and one sloping metal side. The teeth show on the front wall.
  function roofSaw(B, rect, y, o = {}) {
    const loc = B.loc;
    const [u0, v0, u1, v1] = rect;
    const n = Math.max(2, Math.round((u1 - u0) / 6.5));
    const tw = (u1 - u0) / n, rise = o.rise || 2.2;
    const mm = ctx.mb.metal, ps = ctx.mb.propStatic;
    const rt = o.tint || [0.3, 0.31, 0.32];
    const P = (u, v, h) => { const p = loc.pt(u, v); return [p[0], h, p[1]]; };
    const ff = loc.frame(u0, v0, u1, v0), fb = loc.frame(u1, v1, u0, v1), fs = loc.frame(u1, v0, u1, v1);
    for (let i = 0; i < n; i++) {
      const a = u0 + i * tw, b = a + tw;
      // sloping metal side: rises from a to b
      const len = Math.hypot(tw, rise);
      const nrm = [(-rise / len) * ff.dx, tw / len, (-rise / len) * ff.dz];
      mm.color(rt[0], rt[1], rt[2], 1).data(0, 0, 0, B.age);
      mm.quadAuto(P(a, v0, y), P(a, v1, y), P(b, v1, y + rise), P(b, v0, y + rise), nrm, 1);
      // upright glass side at b (dark, shiny)
      ps.color(0.03, 0.04, 0.05, 1).data(0.12, 0.8, 0, 0);
      ps.quadAuto(P(b, v0, y), P(b, v1, y), P(b, v1, y + rise), P(b, v0, y + rise), [fs.nx, 0, fs.nz], 1);
      // teeth on the front and the back wall
      tri(B, P(a, v0, y), P(b, v0, y), P(b, v0, y + rise), [ff.nx, 0, ff.nz], 1);
      tri(B, P(a, v1, y), P(b, v1, y), P(b, v1, y + rise), [fb.nx, 0, fb.nz], 0.9);
    }
    return rise;
  }

  // Curved metal roof (an arch from the left wall to the right wall).
  function roofBarrel(B, rect, y, o = {}) {
    const loc = B.loc;
    const [u0, v0, u1, v1] = rect;
    const rise = o.rise || (u1 - u0) * 0.2, N = 8;
    const mm = ctx.mb.metal;
    const rt = o.tint || [0.34, 0.35, 0.36];
    const P = (u, v, h) => { const p = loc.pt(u, v); return [p[0], h, p[1]]; };
    const ff = loc.frame(u0, v0, u1, v0), fb = loc.frame(u1, v1, u0, v1);
    const arc = (k) => { const t = k / N; return [u0 + (u1 - u0) * t, y + Math.sin(t * Math.PI) * rise]; };
    const um = (u0 + u1) / 2;
    for (let k = 0; k < N; k++) {
      const [ua, ha] = arc(k), [ub, hb] = arc(k + 1);
      const len = Math.hypot(ub - ua, hb - ha);
      const nrm = [(-(hb - ha) / len) * ff.dx, (ub - ua) / len, (-(hb - ha) / len) * ff.dz];
      mm.color(rt[0], rt[1], rt[2], 1).data(0, 0, 0, B.age);
      mm.quadAuto(P(ua, v0 - 0.3, ha), P(ua, v1 + 0.3, ha), P(ub, v1 + 0.3, hb), P(ub, v0 - 0.3, hb), nrm, 1);
      // the round part of the front and back wall
      tri(B, P(ua, v0, ha), P(ub, v0, hb), P(um, v0, y), [ff.nx, 0, ff.nz], 1);
      tri(B, P(ua, v1, ha), P(ub, v1, hb), P(um, v1, y), [fb.nx, 0, fb.nz], 0.9);
    }
    return rise;
  }

  // =========================================================================
  // BUILDINGS
  // =========================================================================

  // Start a building on a lot. Returns "B", the notebook the other functions share.
  //   o = { mat: 'brick' | 'plaster' | 'metal', tint, age (0 new .. 1 old), rng }
  function begin(lot, o) {
    const rng = o.rng;
    const ff = sideFrame(lot.rect, lot.front);
    const w = ff.len;
    const d = lot.front === 'N' || lot.front === 'S' ? lot.rect.maxZ - lot.rect.minZ : lot.rect.maxX - lot.rect.minX;
    // lot coordinates: u runs along the street (left to right seen from the street), v goes into the lot
    const pt = (u, v) => [ff.ox + ff.dx * u - ff.nx * v, ff.oz + ff.dz * u - ff.nz * v];
    const loc = {
      f: ff, w, d, pt,
      rect(u0, v0, u1, v1) {
        const a = pt(u0, v0), b = pt(u1, v1);
        return { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]) };
      },
      frame(ua, va, ub, vb) { const a = pt(ua, va), b = pt(ub, vb); return frameFrom(a[0], a[1], b[0], b[1]); },
    };
    const side = {
      front: lot.sides[lot.front].kind, right: lot.sides[RIGHT_OF[lot.front]].kind,
      back: lot.sides[BACK_OF[lot.front]].kind, left: lot.sides[LEFT_OF[lot.front]].kind,
    };
    const avg = ctx.tex.avg[o.mat] || [1, 1, 1];
    const tint = o.tint;
    const wallColor = [avg[0] * tint[0], avg[1] * tint[1], avg[2] * tint[2]];
    const B = {
      lot, rng, loc, side, mat: o.mat, mb: ctx.mb[o.mat], tint, age: o.age,
      tile: o.mat === 'brick' ? T.brick.size : o.mat === 'plaster' ? T.plaster.size : 1,
      offU: 64 * rng.int(0, 15) + rng.int(0, 20), offV: 64 * rng.int(0, 15) + 1,
      uOff: rng.range(0, 50), vOff: rng.range(0, 50),
      face: 0, roofY: 20, floors: 0,
      playable: lot.block.playable, detail: lot.block.playable,
      reveal: wallColor.map((c) => c * 0.82),
      // color of ledges and other trim: light stone, or the wall color a bit lighter
      trim: o.mat === 'brick' || rng.chance(0.4) ? STONE : wallColor.map((c) => Math.min(0.9, c * 1.25 + 0.02)),
      balconyColor: wallColor.map((c) => c * 0.95 + 0.02),
      stoopColor: o.mat === 'brick' && rng.chance(0.5) ? lin([0.36, 0.25, 0.2]) : STONE,
    };
    // What does an outline edge face? (edges are given in lot coordinates)
    B.kindOf = (p, q) => {
      const e = 0.06;
      if (Math.abs(p[1]) < e && Math.abs(q[1]) < e) return side.front;
      if (Math.abs(p[0] - w) < e && Math.abs(q[0] - w) < e) return side.right;
      if (Math.abs(p[1] - d) < e && Math.abs(q[1] - d) < e) return side.back;
      if (Math.abs(p[0]) < e && Math.abs(q[0]) < e) return side.left;
      // an edge inside the lot: decide by the way it looks
      const du = q[0] - p[0], dv = q[1] - p[1], l = Math.hypot(du, dv) || 1;
      const open = (k) => k === 'front' || k === 'alley';
      if (du / l > 0.5) return open(side.front) ? side.front : 'back';     // looks toward the street
      if (dv / l > 0.7) return side.right === 'front' ? 'front' : 'back';   // looks right
      if (dv / l < -0.7) return side.left === 'front' ? 'front' : 'back';   // looks left
      return 'back';
    };
    return B;
  }

  // One solid part of a building.
  //   pts: its outline in lot coordinates, starting with the front edge and
  //        going round (front, right side, back, left side)
  //   o:   { y0, groundH, floors, style, bayW, ground, parapet, cornice, bands, quoins,
  //          balcony, fireEscape, sill, lintel, surround, fins, kinds: [...] (to overrule), roof }
  // Returns the map rectangle around the outline.
  function volume(B, pts, o) {
    const n = pts.length;
    const world = pts.map(([u, v]) => B.loc.pt(u, v));
    const kinds = pts.map((p, i) => (o.kinds && o.kinds[i]) || B.kindOf(p, pts[(i + 1) % n]));
    const y0 = o.y0 || 0, top = y0 + (o.groundH || 0) + (o.floors || 0) * FLOOR_H;
    B.floors = Math.max(B.floors, (o.floors || 0) + (o.groundH ? 1 : 0));
    for (let i = 0; i < n; i++) {
      if (kinds[i] === 'none') continue; // no wall here (this edge touches another part of the building)
      const a = world[i], b = world[(i + 1) % n];
      const f = frameFrom(a[0], a[1], b[0], b[1]);
      const kl = kinds[(i - 1 + n) % n], kr = kinds[(i + 1) % n];
      // "per" can change the options for single edges, e.g. { 0: { ground: 'entry' } }
      face(B, f, kinds[i], o.per && o.per[i] ? { ...o, ...o.per[i] } : o, { left: kl !== 'party', right: kr !== 'party' });
      if (o.parapet > 0 && o.roof !== 'none' && top < 30) parapetInside(B, f, top, o.parapet);
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of world) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
    return { minX, maxX, minZ, maxZ, top, kinds };
  }

  // Bay window: a box that sticks 0.75 m out of the front above the ground floor,
  // one window wide, with its own windows.
  //   u0..u1 = where along the front,  v = where the front wall is,  y0 = bottom,  floors = how many floors high
  function bayWindow(B, u0, u1, v, y0, floors, o) {
    const out = 0.75, top = y0 + floors * FLOOR_H;
    volume(B, [[u0, v - out], [u1, v - out], [u1, v], [u0, v]], {
      y0, groundH: 0, floors, style: o.style, bayW: u1 - u0, sill: o.sill, lintel: o.lintel, parapet: 0, roof: 'none',
      kinds: ['front', 'front', 'none', 'front'],
    });
    const P = (u, vv, y) => { const p = B.loc.pt(u, vv); return [p[0], y, p[1]]; };
    piece(B, [P(u0, v - out, y0), P(u1, v - out, y0), P(u1, v, y0), P(u0, v, y0)], [0, -1, 0], 0.5);   // underside
    piece(B, [P(u0, v - out, top), P(u1, v - out, top), P(u1, v, top), P(u0, v, top)], [0, 1, 0], 0.8);  // top
    const f = B.loc.frame(u0, v - out, u1, v - out);
    addTrim(B, f, (u1 - u0) / 2, top - 0.05, u1 - u0 + 0.16, 0.16, 0.08, B.trim);                        // small cap
    addTrim(B, f, (u1 - u0) / 2, y0 - 0.14, u1 - u0 + 0.1, 0.14, 0.05, B.trim);
  }

  // The player cannot walk through this part of the lot. rect in lot coordinates.
  function collide(B, u0, v0, u1, v1, h) {
    const r = B.loc.rect(u0, v0, u1, v1);
    ctx.colliders.boxes.push({ ...r, h });
    return r;
  }
  // Round the corner of the collision shape where a building has a cut corner:
  // a row of small circles along the slanted wall.
  function collideSlant(B, ua, va, ub, vb) {
    const a = B.loc.pt(ua, va), b = B.loc.pt(ub, vb);
    const f = frameFrom(a[0], a[1], b[0], b[1]);
    const n = Math.max(2, Math.ceil(f.len / 0.9));
    for (let i = 0; i <= n; i++) {
      const p = fp(f, (f.len * i) / n, 0, -1.0);
      ctx.colliders.circles.push({ x: p[0], z: p[2], r: 1.0 });
    }
  }

  // Remember the finished building (used for roof signs, wires, statistics).
  function finish(B, rect, top, extra = {}) {
    const rec = { ...rect, top, floors: B.floors, mat: B.mat, playable: B.playable, block: B.lot.block, type: B.lot.type, ...extra };
    ctx.buildings.push(rec);
    return rec;
  }

  // =========================================================================
  // NEON MILE EXTRAS
  // =========================================================================
  // A big glowing name on the roof edge.
  function roofSign(B, f, y, rng) {
    const sw = Math.min(f.len - 1.5, 8), sh = sw / 4, y0 = y + 0.5, c = f.len / 2;
    sign(f, c, y0, sw, sh, neonSign(rng), 1.0, -0.4);
    const ps = ctx.mb.propStatic;
    ps.color(0.02, 0.02, 0.022, 1).data(0.7, 0.3, 0, 0);
    ps.quadAuto(fp(f, c + sw / 2, y0, -0.46), fp(f, c - sw / 2, y0, -0.46), fp(f, c - sw / 2, y0 + sh, -0.46), fp(f, c + sw / 2, y0 + sh, -0.46), [-f.nx, 0, -f.nz]);
    for (const o of [-sw * 0.32, sw * 0.32]) {
      const p = fp(f, c + o, 0, -0.5);
      ps.box(p[0] - 0.06, y - 1, p[2] - 0.06, p[0] + 0.06, y0 + sh * 0.5, p[2] + 0.06, 1, 'nsew');
    }
    const lp = fp(f, c, 0, 2.5);
    ctx.shopLights.push({ x: lp[0], z: lp[2], r: 9, power: 0.2 });
  }
  // A tall hologram advert floating above the roof (near-future touch).
  function hologram(B, f, y, rng) {
    const hm = ctx.mb.holo;
    const k = rng.int(0, HOLO_COUNT - 1);
    const hw = 2.6, hh = 5.2, y0 = y + 1.4, c = f.len / 2;
    const u0 = k / HOLO_COUNT, u1 = (k + 1) / HOLO_COUNT;
    const v = (s, yy, lu, lv, uu, vv) => { const p = fp(f, s, yy, -1.2); hm.color(lu, lv, 0, 1); return hm.vertex(p[0], p[1], p[2], f.nx, 0, f.nz, uu, vv); };
    hm.quadIdx(v(c - hw, y0, 0, 0, u0, 0), v(c + hw, y0, 1, 0, u1, 0), v(c + hw, y0 + hh * 2, 1, 1, u1, 1), v(c - hw, y0 + hh * 2, 0, 1, u0, 1));
    // projector box on the roof
    const ps = ctx.mb.propStatic;
    const p = fp(f, c, 0, -1.2);
    ps.color(0.03, 0.03, 0.035, 1).data(0.4, 0.6, 0, 0);
    ps.box(p[0] - 0.7, y - 1, p[2] - 0.4, p[0] + 0.7, y + 0.5, p[2] + 0.4, 1, 'nsewt');
    ps.color(0.02, 0.2, 0.25, 1).data(0.3, 0, 0, 1.4);
    ps.box(p[0] - 0.6, y + 0.5, p[2] - 0.08, p[0] + 0.6, y + 0.56, p[2] + 0.08, 1, 'nsewt');
  }

  // =========================================================================
  // SIMPLE BUILDING for the scenery outside the play area: four walls with
  // painted windows and a flat roof. No 3D detail, no collision.
  //   box = { minX, maxX, minZ, maxZ },  opts = { brick, tint, windows, style }
  // =========================================================================
  function simple(box, floors, rng, opts = {}) {
    const brick = opts.brick ?? rng.chance(0.4);
    const mat = brick ? 'brick' : 'plaster';
    const B = {
      rng, mat, mb: ctx.mb[mat], tile: brick ? T.brick.size : T.plaster.size,
      tint: opts.tint || varyTint(rng.pick(brick ? BRICK_TINTS : PLASTER_TINTS), rng),
      age: rng.range(0.2, 0.9), offU: 64 * rng.int(0, 15) + rng.int(0, 20), offV: 64 * rng.int(0, 15) + 1,
      uOff: rng.range(0, 50), vOff: rng.range(0, 50), face: 0, detail: false, playable: false,
    };
    const style = opts.windows === false ? 0 : opts.style || (brick ? 2 : rng.chance(0.75) ? 1 : 3);
    const top = floors * FLOOR_H, par = rng.range(0.5, 1.2);
    B.roofY = top + par;
    const bayW = style === 2 ? rng.range(2.3, 2.8) : rng.range(3.2, 4.2);
    for (const s of ['N', 'S', 'E', 'W']) {
      const f = sideFrame(box, s);
      const g = gridFor(f.len, bayW);
      const row = B.offV + (B.face++ % 5) * 12;
      if (!style || g.bays === 0) wall(B, f, 0, f.len, 0, top + par);
      else {
        wall(B, f, 0, g.m, 0, top + par);
        wall(B, f, f.len - g.m, f.len, 0, top + par);
        cellWall(B, f, g.m, 0, g.bays, g.bw, floors, B.offU, row, { style, modules: false });
        wall(B, f, g.m, f.len - g.m, top, top + par);
      }
    }
    roofFlat(B, [box], top);
    return top + par;
  }

  return {
    sets, wall, piece, tri, addTrim, cellWall, opening, sign, paintedSign, neonSign, awning, graffiti, fence, cornice,
    face, bayWindow, roofFlat, roofPoly, boxUp, lotGround, paintLine, lotDecal, roofStuff, roofGable, roofSaw, roofBarrel, begin, volume, collide, collideSlant, finish,
    roofSign, hologram, simple, groundShadow,
    parts: { win, trim, block, balcony, balconyRail, balconySolid, stoop, fireEscape, winAC, roofAC, tank, solar, vent, dish, antenna, shrub, planter, weed, rubble, charger },
    STONE, IRON, curb, ctx,
  };
}
