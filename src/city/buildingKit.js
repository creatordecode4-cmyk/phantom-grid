// ---------------------------------------------------------------------------
// buildingKit.js - the KIT OF PARTS for the buildings of Port Meridian (2090).
//
// Every building, hero or not, is put together from these parts:
//
//   body          a tower body: a stack of rounded floor outlines. Every level
//                 can be scaled, shifted and turned, which gives twisted,
//                 tapered and hourglass towers. Its skin is a glass curtain wall.
//   slabs         rounded floor slabs that stick out (white trays, balconies,
//                 wave balconies) - instanced, one copy per floor
//   fins          thin upright blades on the glass - instanced
//   ribbon        a wide frame band swept along a curve on the body
//   patch         a piece of surface on the body: perforated metal, wood
//                 slats, solar strip, light veil, green wall
//   terrace       a garden terrace: slab + planter hedge + bushes + hanging plants
//   roof          roof plate, roof garden with trees, helipad, drone pad, solar
//   bridge        glass sky bridge between two points
//   evBays        EV charging bays on the ground floor
//   brickBox      an OLD brick building with 3D windows (for retrofits)
//
// HOW IT STAYS FAST (LOD = level of detail)
//   * Body skins, ribbons, terraces are merged into a few big meshes: the
//     whole city's glass is ONE draw call, all frames are ONE draw call.
//   * Fins, slabs, plants, pads are "instanced" (many copies of one small
//     model = one draw call) and only drawn near the player (about 150 m).
//     Far away the glass shader paints the floor lines and bars instead.
//   * LOW quality switches fins and facade plants off.
// ---------------------------------------------------------------------------

import { ENTRANCES } from './entrances.js';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { DetailSet } from '../utils/geometry.js';
import { WINDOW_STYLES } from './materials.js';
import { addDecal } from './ground.js';
import * as M from './models.js';
import { signUV, SIGN_COLS, SIGN_ROWS, NEON_FIRST_ROW, HOLO_COUNT, graffitiUV, GRAFFITI_COLS, GRAFFITI_ROWS, RAIL } from './textures.js';

const T = CONFIG.textures;
export const FLOOR = 4.0;        // height of one floor of the new buildings (meters)
export const LOBBY = 5.0;        // height of a glass ground floor
const BRICK_FLOOR = 3.5;         // floors of the old brick buildings

// ---------------------------------------------------------------------------
// COLORS (in the renderer's "linear" color; see lin() in models.js)
// ---------------------------------------------------------------------------
const lin = M.lin;
// tints of the glass: blue-grey, sea green, neutral, dark graphite, bronze, sky
// glass tints (every building picks one): blue, sea green, grey, dark grey, bronze, light blue, green-grey
export const GLASS_TINTS = [[0.12, 0.2, 0.33], [0.1, 0.24, 0.21], [0.19, 0.21, 0.23], [0.09, 0.1, 0.12], [0.3, 0.21, 0.11], [0.15, 0.25, 0.34], [0.15, 0.22, 0.17]];
export const C = {
  white: lin([0.8, 0.81, 0.81]), light: lin([0.7, 0.72, 0.74]), grey: lin([0.55, 0.57, 0.6]), graphite: lin([0.17, 0.18, 0.2]),
  wood: lin([0.56, 0.36, 0.2]), bronze: lin([0.5, 0.33, 0.18]), concrete: lin([0.62, 0.62, 0.6]), dark: lin([0.08, 0.085, 0.09]),
  roof: lin([0.42, 0.43, 0.44]),
};
// frame colors the city fill picks from: mostly light, some graphite, some warm
export const FRAME_COLORS = [C.white, C.white, C.light, C.light, C.grey, C.graphite, C.graphite, C.wood];
export const BRICK_TINTS = [[1.0, 1.0, 1.0], [0.82, 0.8, 0.8], [0.72, 0.7, 0.72], [0.9, 0.84, 0.8], [0.66, 0.62, 0.6], [1.05, 0.9, 0.82]];

// The three floor outlines: soft square, round square, circle (oval when stretched).
const PLAN = { soft: M.planRing(0.25, 3), round: M.planRing(0.55, 4), circle: M.planRing(1.0, 5) };
// the same outlines with fewer points (city fill and far towers; the instanced slabs round them off)
const PLAN_LO = { soft: M.planRing(0.25, 2), round: M.planRing(0.55, 3), circle: M.planRing(1.0, 3) };
const RHO = { soft: 0.25, round: 0.55, circle: 1.0 };

// The four sides of a rectangle that is lined up with the map (used by the brick part).
export function sideFrame(b, side) {
  switch (side) {
    case 'N': return { side, ox: b.minX, oz: b.maxZ, dx: 1, dz: 0, nx: 0, nz: 1, len: b.maxX - b.minX };
    case 'S': return { side, ox: b.maxX, oz: b.minZ, dx: -1, dz: 0, nx: 0, nz: -1, len: b.maxX - b.minX };
    case 'W': return { side, ox: b.maxX, oz: b.maxZ, dx: 0, dz: -1, nx: 1, nz: 0, len: b.maxZ - b.minZ };
    default: return { side, ox: b.minX, oz: b.minZ, dx: 0, dz: 1, nx: -1, nz: 0, len: b.maxZ - b.minZ };
  }
}
const fp = (f, s, y, out = 0) => [f.ox + f.dx * s + f.nx * out, y, f.oz + f.dz * s + f.nz * out];

// Smooth curve through control values (Catmull-Rom). pts = list of arrays, t = 0..1 over the whole list.
function curve(pts, t) {
  const n = pts.length - 1;
  const x = Math.min(n - 1e-6, Math.max(0, t * n)), i = Math.floor(x), f = x - i;
  const P = (k) => pts[Math.min(n, Math.max(0, k))];
  const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
  return p1.map((b, k) => {
    const a = p0[k], c = p2[k], d = p3[k];
    return 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
  });
}

// ===========================================================================
export function createKit(ctx) {
  const L = ctx.layout;
  const mats = ctx.mats;
  const curb = L.street.curbHeight;
  const sets = ctx.sets;
  const S = (name, geom, mat, opts) => (sets[name] = new DetailSet(name, geom, mat, opts));

  // ---- the instanced parts (one draw call each, only drawn near the player) ----
  const slab = {}, rail = {};
  for (const p of ['soft', 'round', 'circle']) {
    slab[p] = S('slab_' + p, M.makeSlabRing(RHO[p], 0.06, 0, 0, p === 'soft' ? 3 : p === 'round' ? 4 : 5), mats.panel, { maxDistance: 150, color: true });
  }
  const slabWave = [
    S('slabWave0', M.makeSlabRing(1.0, 0.03, 0.1, 0, 5), mats.panel, { maxDistance: 190, color: true }),
    S('slabWave1', M.makeSlabRing(1.0, 0.03, 0.1, 2.1, 5), mats.panel, { maxDistance: 190, color: true }),
  ];
  rail.round = S('rail_round', M.makeRailRing(0.55, 0.05, 4), mats.rail, { maxDistance: 110, renderOrder: 12, group: 'window' });
  rail.circle = S('rail_circle', M.makeRailRing(1.0, 0.05, 5), mats.rail, { maxDistance: 110, renderOrder: 12, group: 'window' });
  const fin = S('fin', M.makeTrimBox(), mats.prop, { maxDistance: 130, facing: true, color: true, group: 'window' });
  const block = S('block', M.makeTrimBox(), mats.prop, { maxDistance: 150, color: true });
  const ribbonSets = {
    S: S('ribbonS', M.makeFaceRibbon('S'), mats.panel, { maxDistance: 230, facing: true, color: true }),
    sweep: S('ribbonSweep', M.makeFaceRibbon('sweep'), mats.panel, { maxDistance: 230, facing: true, color: true }),
    portal: S('ribbonPortal', M.makeFaceRibbon('portal'), mats.panel, { maxDistance: 230, facing: true, color: true }),
  };
  const helipad = S('helipad', M.makeHelipad(), mats.prop, { maxDistance: 440 });
  const dronePad = S('dronePad', M.makeDronePad(), mats.prop, { maxDistance: 170 });
  const bridgeSet = S('skyBridge', M.makeSkyBridge(), mats.prop, { maxDistance: 400, castShadow: true });
  const evBay = S('evBay', M.makeEvBay(), mats.prop, { maxDistance: 150, facing: true });
  const solar = S('solarField', M.makeSolarField(), mats.panel, { maxDistance: 320 });
  const solarRack = S('solar', M.makeSolarPanels(), mats.prop, { maxDistance: 170 });
  const shrub = S('shrub', M.makeShrub(5), mats.leaf, { maxDistance: 115, group: 'plants' });
  const vine = S('vine', M.makeVine(9), mats.ivy, { maxDistance: 100, group: 'plants' });
  const planter = S('planter', M.makePlanter(), mats.prop, { maxDistance: 110, castShadow: true });
  const roofAC = S('roofAC', M.makeRoofAC(), mats.prop, { maxDistance: 110 });
  const charger = S('charger', M.makeCharger(), mats.prop, { maxDistance: 160, color: true, castShadow: true });
  // old brick buildings (retrofits): 3D windows + the invisible mask that cuts the opening
  const win = S('window', M.makeWindowModule(), mats.winMod, { maxDistance: 120, facing: true, attrA: true, attrB: true, renderOrder: -3, group: 'window' });
  win.addCompanion('windowMask', new THREE.PlaneGeometry(1, 1), mats.winMask, { renderOrder: -2 });

  let serial = 0; // every body gets its own number (for the window light pattern)

  // =========================================================================
  // BODY: a stack of rounded outlines with a skin
  // =========================================================================
  //   o.x, o.z      middle of the body on the map,  o.rot = turn (radians)
  //   o.plan        'soft' | 'round' | 'circle',  o.a / o.b = half width / half depth
  //   o.y0, o.y1    bottom and top
  //   o.levels      shape over the height: [[t, scale, twist, dx, dz, scaleB], ...]
  //                 t = 0 bottom .. 1 top. Leave out for a straight body.
  //   o.mat         'glass' (default) | 'panel' | 'plaster' | 'brick' | 'tower' (far glass photo)
  //   o.kind        glass: 0 curtain wall, 1 lobby, 2 veil.  panel: 0 smooth, 1 perforated, 2 slats ...
  //   o.tint        color,  o.bay = width of one glass bay (m),  o.floorH = floor height
  // Returns a "surface" that the other parts are placed on.
  function body(o) {
    const ring = (o.lo ? PLAN_LO : PLAN)[o.plan || 'round'];
    const H = o.y1 - o.y0;
    const lv = o.levels && o.levels.length > 1 ? o.levels.map((l) => [l[0], l[1] ?? 1, l[2] || 0, l[3] || 0, l[4] || 0, l[5] ?? l[1] ?? 1]) : null;
    const shaped = !!lv;
    const steps = o.steps || (shaped ? Math.max(3, Math.round(H / 8)) : 1);
    // shape at height fraction t: [scaleA, twist, dx, dz, scaleB]
    const shape = (t) => {
      if (!lv) return [1, 0, 0, 0, 1];
      // the control points need not be evenly spaced: find the piece, then smooth inside it
      let i = 0;
      while (i < lv.length - 2 && t > lv[i + 1][0]) i++;
      const span = lv[i + 1][0] - lv[i][0] || 1;
      const v = curve(lv.map((l) => l.slice(1)), (i + Math.min(1, Math.max(0, (t - lv[i][0]) / span))) / (lv.length - 1));
      return [v[0], v[1], v[2], v[3], v[4]];
    };
    const rot = o.rot || 0;
    const frameAt = (y) => {
      const s = shape(Math.min(1, Math.max(0, (y - o.y0) / H)));
      const c = Math.cos(rot), sn = Math.sin(rot);
      return { x: o.x + s[2] * c + s[3] * sn, z: o.z - s[2] * sn + s[3] * c, rot: rot + s[1], a: o.a * s[0], b: o.b * s[4] };
    };
    // a point of the unit outline -> the world, for the frame "fr"
    const place = (fr, ux, uz, unx, unz) => {
      const c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
      const lx = ux * fr.a, lz = uz * fr.b;
      let nx = unx / fr.a, nz = unz / fr.b;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl; nz /= nl;
      return { x: fr.x + lx * c + lz * sn, z: fr.z - lx * sn + lz * c, nx: nx * c + nz * sn, nz: -nx * sn + nz * c };
    };
    // ---- the rings of the skin ----
    const levels = [];
    for (let k = 0; k <= steps; k++) {
      const y = o.y0 + (H * k) / steps;
      const fr = frameAt(y);
      levels.push({ y, fr, pts: ring.map((p) => place(fr, p.x, p.z, p.nx, p.nz)) });
    }
    // length of the outline at the bottom, number of glass bays around
    let per = 0;
    for (let i = 1; i < ring.length; i++) per += Math.hypot((ring[i].x - ring[i - 1].x) * o.a, (ring[i].z - ring[i - 1].z) * o.b);
    const bayW = o.bay || 1.6;
    const bays = Math.max(4, Math.round(per / bayW));
    const floorH = o.floorH || FLOOR;
    const id = serial++;
    const offU = 64 * (id % 15) + 3, offV = 64 * ((id * 7) % 15) + 2;
    const seed = o.seed ?? ((id * 0.6180339) % 1);
    const matName = o.mat || 'glass';
    const mb = ctx.mb[matName];
    const tint = o.tint || GLASS_TINTS[0];
    const tile = matName === 'brick' ? T.brick.size : matName === 'plaster' ? T.plaster.size : matName === 'tower' ? T.glassTower.size : 1;
    const dataFor = (u, y) => {
      if (matName === 'glass') mb.data(u * bays + offU, (y - o.y0) / floorH + offV, o.kind || 0, seed);
      else if (matName === 'panel') mb.data(o.kind || 0, o.rough ?? 0.6, o.metal ?? 0.05, 0);
      else mb.data(0, 0, 0, o.age ?? 0.4);
    };
    if (!o.noSkin) {
      mb.color(tint[0], tint[1], tint[2], 1);
      const idx = [];
      for (let k = 0; k <= steps; k++) {
        const lvl = levels[k], row = [];
        // how much the body narrows here (tilts the surface up or down)
        const lo = levels[Math.max(0, k - 1)], hi = levels[Math.min(steps, k + 1)];
        const slope = -((hi.fr.a + hi.fr.b) - (lo.fr.a + lo.fr.b)) / 2 / Math.max(0.01, hi.y - lo.y);
        for (let i = 0; i < ring.length; i++) {
          const p = lvl.pts[i];
          dataFor(ring[i].s, lvl.y);
          const nl = Math.hypot(1, slope);
          row.push(mb.vertex(p.x, lvl.y, p.z, p.nx / nl, slope / nl, p.nz / nl, (ring[i].s * per) / tile, lvl.y / tile));
        }
        idx.push(row);
      }
      for (let k = 0; k < steps; k++) {
        for (let i = 0; i < ring.length - 1; i++) {
          if (ring[i + 1].s - ring[i].s < 1e-6) continue; // (circle: no flat sides)
          mb.quadIdx(idx[k][i], idx[k][i + 1], idx[k + 1][i + 1], idx[k + 1][i]);
        }
      }
    }
    // point on the surface: u = 0..1 around (0 = middle of the front), y = height
    const at = (u, y) => {
      u -= Math.floor(u);
      let i = 0;
      while (i < ring.length - 2 && ring[i + 1].s < u) i++;
      const sp = ring[i + 1].s - ring[i].s;
      const f = sp > 1e-9 ? (u - ring[i].s) / sp : 0;
      const a = ring[i], b = ring[i + 1];
      const fr = frameAt(Math.min(o.y1, Math.max(o.y0, y)));
      const p = place(fr, a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, a.nx + (b.nx - a.nx) * f, a.nz + (b.nz - a.nz) * f);
      p.y = y;
      return p;
    };
    const aabb = (ya = o.y0, yb = o.y0) => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const y of ya === yb ? [ya] : [ya, (ya + yb) / 2, yb]) {
        const fr = frameAt(y);
        for (const p of ring) {
          const q = place(fr, p.x, p.z, p.nx, p.nz);
          minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z);
        }
      }
      return { minX, maxX, minZ, maxZ };
    };
    return { o, plan: o.plan || 'round', ring, y0: o.y0, y1: o.y1, H, per, bays, floorH, offU, offV, seed, shaped, frameAt, at, aabb, place, tint };
  }

  // Flat lid on a body at height y (roofs, undersides). Faces up unless down = true.
  function cap(sf, y, o = {}) {
    const mb = ctx.mb.panel;
    const c = o.color || C.roof;
    mb.color(c[0], c[1], c[2], 1);
    mb.data(o.kind || 0, o.rough ?? 0.85, o.metal ?? 0, 0);
    const fr = sf.frameAt(y), ny = o.down ? -1 : 1;
    const first = mb.vertex(fr.x, y, fr.z, 0, ny, 0);
    const ids = sf.ring.map((p) => { const q = sf.place(fr, p.x * (o.grow || 1), p.z * (o.grow || 1), p.nx, p.nz); return mb.vertex(q.x, y, q.z, 0, ny, 0); });
    for (let i = 0; i < ids.length - 1; i++) {
      if (o.down) mb.tri(first, ids[i], ids[i + 1]); else mb.tri(first, ids[i + 1], ids[i]);
    }
  }

  // =========================================================================
  // INSTANCED PARTS ON A BODY
  // =========================================================================

  // Rounded floor slabs that stick out around the body, one per floor.
  //   o.y0, o.y1, o.step (meters between slabs), o.thick, o.grow (1 = flush, 1.05 = sticks out more)
  //   o.color, o.wave (wave balconies), o.rail (glass balustrade on top)
  function slabs(sf, o = {}) {
    const step = o.step || sf.floorH, thick = o.thick || 0.4, grow = o.grow || 1, col = o.color || C.white;
    const y0 = o.y0 ?? sf.y0 + step, y1 = o.y1 ?? sf.y1;
    let k = 0;
    for (let y = y0; y <= y1 + 0.01; y += step, k++) {
      const fr = sf.frameAt(Math.min(sf.y1, y));
      const set = o.wave ? slabWave[k % 2] : slab[sf.plan];
      const g = typeof grow === 'function' ? grow(k, y) : grow;
      set.add(fr.x, y - thick, fr.z, Math.sin(fr.rot), Math.cos(fr.rot), fr.a * g, thick, fr.b * g, null, col);
      if (o.rail && rail[sf.plan]) rail[sf.plan].add(fr.x, y, fr.z, Math.sin(fr.rot), Math.cos(fr.rot), fr.a * g, 1.1, fr.b * g);
    }
  }

  // Thin upright blades on the glass.
  //   o.y0, o.y1, o.every (every n-th bay), o.depth, o.width, o.color, o.u0 / o.u1 (only part of the way round)
  function fins(sf, o = {}) {
    const every = o.every || 1, depth = o.depth || 0.38, width = o.width || 0.08, col = o.color || C.light;
    const y0 = o.y0 ?? sf.y0, y1 = o.y1 ?? sf.y1;
    const u0 = o.u0 ?? 0, u1 = o.u1 ?? 1;
    // a straight body gets one long fin per bay, a shaped one a piece every two floors
    const seg = sf.shaped ? 2 * sf.floorH : y1 - y0;
    for (let j = 0; j < sf.bays; j += every) {
      const u = j / sf.bays;
      if (u < u0 || u > u1) continue;
      for (let y = y0; y < y1 - 0.1; y += seg) {
        const p = sf.at(u, y + Math.min(seg, y1 - y) / 2);
        fin.add(p.x, y, p.z, p.nx, p.nz, width, Math.min(seg, y1 - y), depth, null, col);
      }
    }
  }

  // A ribbon frame on one flat side of a straight body (instanced; the city fill uses it).
  //   side: 0 front, 1 right, 2 back, 3 left.  kind: 'S' | 'sweep' | 'portal'
  function faceRibbon(sf, side, kind, o = {}) {
    const fr = sf.frameAt(sf.y0);
    const y0 = o.y0 ?? sf.y0, y1 = o.y1 ?? sf.y1;
    const ang = fr.rot + side * (Math.PI / 2);
    // only the flat part of the side (between the round corners) carries the ribbon
    const flat = o.wide ?? Math.min(1, 1 - RHO[sf.plan] + 0.22);
    const half = side % 2 === 0 ? fr.b : fr.a, wide = (side % 2 === 0 ? fr.a : fr.b) * flat;
    const nx = Math.sin(ang), nz = Math.cos(ang);
    const col = o.color || C.white;
    ribbonSets[kind].add(fr.x + nx * (half + 0.04), y0, fr.z + nz * (half + 0.04), nx, nz, wide * 2, y1 - y0, o.depth || 0.42, null, col);
  }

  // =========================================================================
  // STATIC PARTS ON A BODY (merged into the big meshes)
  // =========================================================================

  // RIBBON FRAME: a band swept along a curve on the body surface.
  //   pts: control points [[u, y], ...]; u may run past 1 (once more around)
  //   o.w = width (m), o.out = how far it stands off the glass, o.color, o.kind (panel kind)
  function ribbon(sf, pts, o = {}) {
    const w = o.w || 2.6, out = o.out || 0.4, col = o.color || C.white;
    const mb = ctx.mb.panel;
    // sample the curve: about one point every 3 m
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot((pts[i][0] - pts[i - 1][0]) * sf.per, pts[i][1] - pts[i - 1][1]);
    const n = Math.max(8, Math.min(120, Math.round(len / (o.fine || 3))));
    const path = [];
    for (let i = 0; i <= n; i++) path.push(curve(pts, i / n));
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n, i + 1)], p = path[i];
      // direction of the curve measured in meters on the surface, and the direction across it
      let tx = (b[0] - a[0]) * sf.per, ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      // the band can get thinner toward its ends
      const k = o.taper ? Math.min(1, Math.min(i, n - i) / (n * o.taper)) : 1;
      const hw = (w / 2) * (0.25 + 0.75 * k);
      const l = sf.at(p[0] - (ty * hw) / sf.per, Math.min(sf.y1 + (o.over || 0), p[1] + tx * hw));
      const r = sf.at(p[0] + (ty * hw) / sf.per, Math.max(sf.y0, p[1] - tx * hw));
      rows.push({ l, r });
    }
    mb.color(col[0], col[1], col[2], 1);
    mb.data(o.kind || 0, o.rough ?? 0.5, o.metal ?? 0.12, o.glow || 0); // glow: a line of light (0..1 = at night)
    const V = (p, off) => mb.vertex(p.x + p.nx * off, p.y, p.z + p.nz * off, p.nx, 0, p.nz);
    let prev = null;
    for (const row of rows) {
      const cur = [V(row.l, out), V(row.r, out)];
      if (prev) mb.quadIdx(prev[0], prev[1], cur[1], cur[0]);
      prev = cur;
    }
    // the two edges of the band (so it has thickness)
    for (let i = 0; i < n; i++) {
      for (const [k, sgn] of [['l', 1], ['r', -1]]) {
        const a = rows[i][k], b = rows[i + 1][k];
        const up = [0, sgn, 0];
        mb.quadAuto([a.x + a.nx * 0.02, a.y, a.z + a.nz * 0.02], [a.x + a.nx * out, a.y, a.z + a.nz * out],
          [b.x + b.nx * out, b.y, b.z + b.nz * out], [b.x + b.nx * 0.02, b.y, b.z + b.nz * 0.02], up);
      }
    }
  }

  // PATCH: a piece of the body surface between two lines, a little in front of the skin.
  //   uA, uB: where it starts and ends around the body (numbers, or functions of y)
  //   o.mat: 'panel' (o.kind: 1 perforated, 2 slats, 4 solar ...) | 'glass' (veil) | 'green' (green wall)
  function patch(sf, uA, uB, y0, y1, o = {}) {
    const fa = typeof uA === 'function' ? uA : () => uA, fb = typeof uB === 'function' ? uB : () => uB;
    const out = o.out ?? 0.22, matName = o.mat || 'panel';
    const mb = ctx.mb[matName];
    const col = o.color || (matName === 'green' ? [1, 1, 1] : C.light);
    const rows = Math.max(1, Math.round((y1 - y0) / (o.rowH || 6)));
    const colsN = o.cols || 8;
    mb.color(col[0], col[1], col[2], 1);
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const y = y0 + ((y1 - y0) * r) / rows, a = fa(y), b = fb(y), row = [];
      for (let c = 0; c <= colsN; c++) {
        const u = a + ((b - a) * c) / colsN;
        const p = sf.at(u, y);
        if (matName === 'glass') mb.data((u - Math.floor(u)) * sf.bays + sf.offU, (y - sf.y0) / sf.floorH + sf.offV, 2, sf.seed);
        else if (matName === 'panel') mb.data(o.kind ?? 1, o.rough ?? 0.5, o.metal ?? 0.3, 0);
        else mb.data(0, 0, 0, 0);
        row.push(mb.vertex(p.x + p.nx * out, y, p.z + p.nz * out, p.nx, 0, p.nz, (u * sf.per) * 0.36, y * 0.36));
      }
      grid.push(row);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < colsN; c++) mb.quadIdx(grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]);
    // green walls get a few real leaf clusters and hanging plants in front (near the player)
    if (matName === 'green' && !o.far) {
      const rng = ctx.rng;
      const area = (y1 - y0) * Math.abs(fb(y0) - fa(y0)) * sf.per;
      for (let k = 0; k < area / 14; k++) {
        const y = y0 + rng.range(0.5, y1 - y0 - 0.5), u = fa(y) + (fb(y) - fa(y)) * rng.range(0.05, 0.95);
        const p = sf.at(u, y), s = rng.range(1.0, 1.7);
        if (rng.chance(0.6)) shrub.add(p.x + p.nx * (out + 0.1), y - 0.4, p.z + p.nz * (out + 0.1), p.nx, p.nz, s, s, s * 0.6);
        else vine.add(p.x + p.nx * (out + 0.15), y, p.z + p.nz * (out + 0.15), p.nx, p.nz, s, s, s);
      }
    }
  }

  // TERRACE: a garden balcony around a part of the body.
  //   y = floor height, u0..u1 = how far around,  o.depth, o.thick, o.color
  //   o.hedge (planter with plants along the edge), o.vines (0..1 hanging plants), o.rail (glass balustrade)
  function terrace(sf, y, u0, u1, o = {}) {
    const depth = o.depth ?? 2.2, thick = o.thick ?? 0.4, col = o.color || C.white, lip = o.hedge === false ? 0.12 : 0.5;
    const mb = ctx.mb.panel, rng = ctx.rng;
    const arc = Math.abs(u1 - u0) * sf.per;
    const n = Math.max(2, Math.round(arc / 1.6));
    const P = [];
    for (let i = 0; i <= n; i++) {
      const p = sf.at(u0 + ((u1 - u0) * i) / n, y);
      // the terrace gets shallower toward its two ends (rounded tray)
      const k = u1 - u0 > 0.98 ? 1 : Math.min(1, Math.sin((Math.PI * i) / n) * 2.2 + 0.25);
      const d = depth * k;
      P.push({ ix: p.x - p.nx * 0.25, iz: p.z - p.nz * 0.25, ox: p.x + p.nx * d, oz: p.z + p.nz * d, nx: p.nx, nz: p.nz });
    }
    mb.color(col[0], col[1], col[2], 1);
    mb.data(0, 0.55, 0.08, 0);
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[i + 1];
      mb.quadAuto([a.ix, y, a.iz], [a.ox, y, a.oz], [b.ox, y, b.oz], [b.ix, y, b.iz], [0, 1, 0]);
      mb.quadAuto([a.ix, y - thick, a.iz], [a.ox, y - thick, a.oz], [b.ox, y - thick, b.oz], [b.ix, y - thick, b.iz], [0, -1, 0]);
      const i0 = mb.vertex(a.ox, y - thick, a.oz, a.nx, 0, a.nz), i1 = mb.vertex(b.ox, y - thick, b.oz, b.nx, 0, b.nz);
      const i2 = mb.vertex(b.ox, y + lip, b.oz, b.nx, 0, b.nz), i3 = mb.vertex(a.ox, y + lip, a.oz, a.nx, 0, a.nz);
      mb.quadIdx(i0, i1, i2, i3);
    }
    if (o.hedge !== false) {
      // planter hedge: leaf cards along the rim (always drawn, cheap) ...
      const hm = ctx.mb.hedge;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[i + 1];
        const sh = 0.75 + 0.25 * rng.next();
        hm.color(sh, sh, sh * 0.95, 1);
        const h = rng.range(0.8, 1.3), inn = 0.18;
        hm.data(0, 0, 0, 0);
        const v0 = hm.vertex(a.ox - a.nx * inn, y + lip - 0.15, a.oz - a.nz * inn, a.nx, 0.5, a.nz, 0, 0.05);
        const v1 = hm.vertex(b.ox - b.nx * inn, y + lip - 0.15, b.oz - b.nz * inn, b.nx, 0.5, b.nz, 1, 0.05);
        hm.data(0.3, 0, 0, 0);
        const v2 = hm.vertex(b.ox - b.nx * (inn + 0.3), y + lip + h, b.oz - b.nz * (inn + 0.3), b.nx, 0.7, b.nz, 1, 0.95);
        const v3 = hm.vertex(a.ox - a.nx * (inn + 0.3), y + lip + h, a.oz - a.nz * (inn + 0.3), a.nx, 0.7, a.nz, 0, 0.95);
        hm.quadIdx(v0, v1, v2, v3);
      }
      // ... plus real bushes and hanging plants near the player
      if (!o.far) {
        for (let i = 0; i < n; i++) {
          const a = P[i];
          if (rng.chance(0.55)) { const s = rng.range(1.1, 1.9); shrub.add(a.ox - a.nx * 0.5, y + lip - 0.1, a.oz - a.nz * 0.5, a.nx, a.nz, s, s * rng.range(0.9, 1.3), s); }
          if (rng.chance(o.vines ?? 0.4)) { const s = rng.range(0.9, 1.6); vine.add(a.ox + a.nx * 0.06, y + lip - 0.05, a.oz + a.nz * 0.06, a.nx, a.nz, s, s, s); }
        }
      }
    } else if (o.rail) {
      const rm = ctx.mb.rail, R = RAIL.glass;
      rm.color(1, 1, 1, 1);
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[i + 1];
        const l = Math.hypot(b.ox - a.ox, b.oz - a.oz) / R.tile;
        rm.quad([a.ox, y, a.oz], [b.ox, y, b.oz], [b.ox, y + 1.1, b.oz], [a.ox, y + 1.1, a.oz], [a.nx, 0, a.nz], [0, R.v0], [l, R.v0], [l, R.v1], [0, R.v1]);
      }
    }
  }

  // PLANTED TRAY (city fill): a ring of plants on a floor slab. Leaf cards are
  // always drawn (cheap), real bushes and hanging plants only near the player.
  function planted(sf, y, o = {}) {
    const rng = ctx.rng, g = o.grow || 1.03, hm = ctx.mb.hedge;
    const fr = sf.frameAt(Math.min(sf.y1, y));
    const pts = sf.ring.map((p) => sf.place(fr, p.x * g, p.z * g, p.nx, p.nz));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.hypot(b.x - a.x, b.z - a.z) < 0.3 || (o.share && !rng.chance(o.share))) continue;
      const sh = 0.72 + 0.28 * rng.next(), h = rng.range(0.8, 1.25);
      hm.color(sh, sh, sh * 0.95, 1);
      hm.data(0, 0, 0, 0);
      const v0 = hm.vertex(a.x, y - 0.1, a.z, a.nx, 0.5, a.nz, 0, 0.05), v1 = hm.vertex(b.x, y - 0.1, b.z, b.nx, 0.5, b.nz, 1, 0.05);
      hm.data(0.3, 0, 0, 0);
      const v2 = hm.vertex(b.x - b.nx * 0.3, y + h, b.z - b.nz * 0.3, b.nx, 0.7, b.nz, 1, 0.95), v3 = hm.vertex(a.x - a.nx * 0.3, y + h, a.z - a.nz * 0.3, a.nx, 0.7, a.nz, 0, 0.95);
      hm.quadIdx(v0, v1, v2, v3);
    }
    if (!ctx.playableNow) return;
    const n = Math.round(sf.per / (o.every || 3.2));
    for (let i = 0; i < n; i++) {
      const p = sf.at((i + rng.next()) / n, y);
      const s = rng.range(1.0, 1.7);
      if (rng.chance(0.6)) shrub.add(p.x + p.nx * 0.2, y - 0.05, p.z + p.nz * 0.2, p.nx, p.nz, s, s * rng.range(0.9, 1.3), s);
      if (rng.chance(o.vines ?? 0.35)) vine.add(p.x + p.nx * (o.hang ?? 0.75), y - 0.05, p.z + p.nz * (o.hang ?? 0.75), p.nx, p.nz, s, s, s);
    }
  }

  // A flat picture on the body: garage door, shop door (the shop shader draws it).
  //   u = where around, w / h = size in meters, type: 0 glass shop, 1 shutter, 2 door, 3 garage door
  function doorOn(sf, u, w, h, type, y = curb) {
    const rng = ctx.rng;
    const p = sf.at(u, y);
    const tx = p.nz, tz = -p.nx, o = 0.07;
    const q = (s, yy) => [p.x + tx * s + p.nx * o, yy, p.z + tz * s + p.nz * o];
    const sm = ctx.mb.shop;
    sm.color(1, 1, 1, 1).data(type, rng.int(1, 60) + rng.range(0.1, 0.9), w, h);
    sm.quad(q(-w / 2, y), q(w / 2, y), q(w / 2, y + h), q(-w / 2, y + h), [p.nx, 0, p.nz], [0, 0], [1, 0], [1, 1], [0, 1]);
    // a door at street level of a building you can walk to: it can be opened (src/interiors)
    if (ctx.playableNow !== false && y < curb + 0.5) {
      const l = Math.hypot(p.nx, p.nz) || 1, dc = ctx.doorCtx || {};
      ENTRANCES.push({ id: 'd' + ENTRANCES.length, x: p.x + (p.nx / l) * o, z: p.z + (p.nz / l) * o, nx: p.nx / l, nz: p.nz / l, w, h, y, door: type, district: dc.district || 'grid', building: dc.type || '' });
    }
  }

  // ROOF of a body: lid + whatever stands on it.
  //   o.trees (how many), o.hedge (green rim), o.helipad, o.dronePad, o.solar (0..1 share of the roof),
  //   o.plate (thin roof plate that hangs over: grow factor), o.ac (machines), o.color
  function roof(sf, o = {}) {
    const y = o.y ?? sf.y1, rng = ctx.rng;
    cap(sf, y, { color: o.color || C.roof });
    const fr = sf.frameAt(y);
    const c = Math.cos(fr.rot), sn = Math.sin(fr.rot);
    const P = (lx, lz) => [fr.x + lx * c + lz * sn, fr.z - lx * sn + lz * c];
    if (o.plate) {
      slab[sf.plan].add(fr.x, y - 0.1, fr.z, sn, c, fr.a * o.plate, 0.42, fr.b * o.plate, null, o.plateColor || C.white);
    }
    // green rim: plants all around the roof edge, some hang over it
    if (o.hedge) planted(sf, y + 0.1, { grow: 0.99, vines: o.vines ?? 0.25, hang: 0.25 });
    let padSide = rng.chance(0.5) ? 1 : -1;
    if (o.helipad) {
      const p = typeof o.helipad === 'object' ? P(o.helipad[0] * fr.a, o.helipad[1] * fr.b) : P(padSide * fr.a * 0.3, -fr.b * 0.25);
      const s = Math.min(1, Math.min(fr.a, fr.b) / 9);
      helipad.add(p[0], y, p[1], sn, c, s, 1, s);
    }
    if (o.dronePad) {
      const p = typeof o.dronePad === 'object' ? P(o.dronePad[0] * fr.a, o.dronePad[1] * fr.b) : P(-padSide * fr.a * 0.45, fr.b * 0.4);
      dronePad.add(p[0], y, p[1], sn, c);
    }
    if (o.solar) {
      // a field of solar panels on the part of the roof that the pads leave free
      const w = fr.a * 1.1 * Math.sqrt(o.solar), d = fr.b * 0.9 * Math.sqrt(o.solar);
      const p = P(-padSide * fr.a * 0.22, fr.b * 0.3);
      solar.add(p[0], y + 0.25, p[1], sn, c, w, 0.12, d);
    }
    for (let i = 0; i < (o.trees || 0); i++) {
      const a = rng.range(0, 6.28), rad = Math.sqrt(rng.next()) * 0.72;
      const p = P(Math.cos(a) * fr.a * rad, Math.sin(a) * fr.b * rad);
      ctx.roofTrees.push({ x: p[0], y, z: p[1], s: rng.range(0.75, 1.25) * (o.treeSize || 1), trunk: y < 9 });
    }
    for (let i = 0; i < (o.ac || 0); i++) {
      const p = P(rng.range(-0.5, 0.5) * fr.a, rng.range(-0.5, 0.5) * fr.b);
      roofAC.add(p[0], y, p[1], sn, c);
    }
    return fr;
  }

  // GLASS SKY BRIDGE from (ax, az) to (bx, bz) at height y (floor of the bridge).
  function bridge(ax, az, bx, bz, y) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 2) return;
    const n = Math.max(1, Math.round(len / 8)), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      // the model runs along its own x axis: turn that into the bridge direction
      bridgeSet.add(ax + (bx - ax) * t, y, az + (bz - az) * t, -dz, dx, len / n / 8, 1, 1);
    }
  }
  // A bridge that sticks out of a body at (u, y): the stub that leads to the neighbour.
  function bridgeStub(sf, u, y, len) {
    const p = sf.at(u, y);
    bridge(p.x - p.nx * 3, p.z - p.nz * 3, p.x + p.nx * len, p.z + p.nz * len, y);
  }

  // EV CHARGING BAYS on the ground floor of a body, from u0 to u1.
  function evBays(sf, u0, u1, n) {
    for (let i = 0; i < n; i++) {
      const p = sf.at(u0 + ((u1 - u0) * (i + 0.5)) / n, curb);
      evBay.add(p.x + p.nx * 0.03, curb, p.z + p.nz * 0.03, p.nx, p.nz);
      if (ctx.playableNow) ctx.shopLights.push({ x: p.x + p.nx * 1.6, z: p.z + p.nz * 1.6, r: 4, power: 0.16 });
    }
  }

  // A softly lit shop sign on the body at (u, y). w, h in meters.
  function signOn(sf, u, y, w, h, glow, neon = false) {
    const rng = ctx.rng;
    const idx = neon ? SIGN_COLS * NEON_FIRST_ROW + rng.int(0, SIGN_COLS * (SIGN_ROWS - NEON_FIRST_ROW) - 1) : rng.int(0, SIGN_COLS * NEON_FIRST_ROW - 1);
    const uv = signUV(idx);
    const p = sf.at(u, y);
    const tx = p.nz, tz = -p.nx; // along the wall
    const o = 0.14;
    const q = (s, yy) => [p.x + tx * s + p.nx * o, yy, p.z + tz * s + p.nz * o];
    ctx.mb.sign.color(1, 1, 1, 1).data(glow, 0, 0, 0);
    ctx.mb.sign.quad(q(-w / 2, y), q(w / 2, y), q(w / 2, y + h), q(-w / 2, y + h), [p.nx, 0, p.nz], [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]);
    if (glow > 0 && ctx.playableNow) ctx.shopLights.push({ x: p.x + p.nx * 1.4, z: p.z + p.nz * 1.4, r: 4.5, power: 0.12 * glow });
  }

  // Round columns (legs under a raised floor, canopy posts). pts = [[x, z], ...]
  function columns(pts, y0, y1, r = 0.35, color = C.light) {
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, 8, 1, true);
    const mb = ctx.mb.panel;
    mb.color(color[0], color[1], color[2], 1);
    mb.data(0, 0.5, 0.2, 0);
    for (const [x, z] of pts) {
      mb.add(g, x, (y0 + y1) / 2, z);
      if (y0 < curb + 1) ctx.colliders.circles.push({ x, z, r: r + 0.1 });
    }
  }

  // A hologram advert floating above a point (soft, see-through light).
  function hologram(x, z, y, nx, nz, size = 1, index = -1) {
    const hm = ctx.mb.holo, rng = ctx.rng;
    const k = index >= 0 ? index : rng.int(0, HOLO_COUNT - 1);
    const hw = 2.2 * size, hh = 8.4 * size, tx = nz, tz = -nx;
    const u0 = k / HOLO_COUNT, u1 = (k + 1) / HOLO_COUNT;
    const v = (s, yy, lu, lv, uu, vv) => { hm.color(lu, lv, 0, 1); return hm.vertex(x + tx * s, yy, z + tz * s, nx, 0, nz, uu, vv); };
    hm.quadIdx(v(-hw, y, 0, 0, u0, 0), v(hw, y, 1, 0, u1, 0), v(hw, y + hh, 1, 1, u1, 1), v(-hw, y + hh, 0, 1, u0, 1));
  }

  // The player cannot walk through this rectangle.
  function collide(r, h) {
    ctx.colliders.boxes.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, h });
  }
  // Soft dark line on the ground around a body (it "sits" on the sidewalk).
  function contactShadow(sf, y = curb) {
    if (!ctx.playableNow) return;
    const r = sf.aabb();
    addDecal(ctx.mb.decal, 'blobRect', (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, r.maxX - r.minX + 2.6, r.maxZ - r.minZ + 2.6, 0, y + 0.012, 0.75);
  }
  // Remember a finished building (sky bridges between neighbours, statistics).
  function finish(rec) {
    ctx.buildings.push(rec);
    return rec;
  }

  // =========================================================================
  // OLD BRICK (for the retrofitted buildings): walls with real 3D windows
  // =========================================================================
  // One flat rectangle of brick wall. o.grid = window cells [u0, u1, v0, v1], o.mode = window style.
  function wall(B, f, s0, s1, y0, y1, o = {}) {
    if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
    const mb = B.mb, tile = B.tile, t = B.tint;
    const sh = o.shade ?? 1, out = o.out || 0, mode = o.mode || 0;
    const g = o.grid || [0, 0, 0, 0];
    const a0 = 2 + Math.max(0, B.roofY - y0), a1 = 2 + Math.max(0, B.roofY - y1);
    const u0 = (s0 + B.uOff) / tile, u1 = (s1 + B.uOff) / tile, v0 = (y0 + B.vOff) / tile, v1 = (y1 + B.vOff) / tile;
    const p0 = fp(f, s0, y0, out), p1 = fp(f, s1, y0, out), p2 = fp(f, s1, y1, out), p3 = fp(f, s0, y1, out);
    mb.color(t[0] * sh, t[1] * sh, t[2] * sh, a0);
    mb.data(g[0], g[2], mode, B.age); const a = mb.vertex(p0[0], p0[1], p0[2], f.nx, 0, f.nz, u0, v0);
    mb.data(g[1], g[2], mode, B.age); const b = mb.vertex(p1[0], p1[1], p1[2], f.nx, 0, f.nz, u1, v0);
    mb.color(t[0] * sh, t[1] * sh, t[2] * sh, a1);
    mb.data(g[1], g[3], mode, B.age); const c = mb.vertex(p2[0], p2[1], p2[2], f.nx, 0, f.nz, u1, v1);
    mb.data(g[0], g[3], mode, B.age); const d = mb.vertex(p3[0], p3[1], p3[2], f.nx, 0, f.nz, u0, v1);
    mb.quadIdx(a, b, c, d);
  }
  function piece(B, pts, n, shade = 1) {
    const t = B.tint;
    B.mb.color(t[0] * shade, t[1] * shade, t[2] * shade, 1);
    B.mb.data(0, 0, 0, B.age);
    B.mb.quadAuto(pts[0], pts[1], pts[2], pts[3], n, B.tile);
  }
  // An opening in the ground floor: its sides + the shop / door picture inside.
  //   type: 0 glass shop, 1 shutter, 2 door, 3 garage door
  function opening(B, f, s0, s1, y0, h, rec, type, seed) {
    piece(B, [fp(f, s0, y0, 0), fp(f, s0, y0, -rec), fp(f, s0, y0 + h, -rec), fp(f, s0, y0 + h, 0)], [f.dx, 0, f.dz], 0.7);
    piece(B, [fp(f, s1, y0, 0), fp(f, s1, y0, -rec), fp(f, s1, y0 + h, -rec), fp(f, s1, y0 + h, 0)], [-f.dx, 0, -f.dz], 0.7);
    piece(B, [fp(f, s0, y0 + h, 0), fp(f, s1, y0 + h, 0), fp(f, s1, y0 + h, -rec), fp(f, s0, y0 + h, -rec)], [0, -1, 0], 0.5);
    const sm = ctx.mb.shop;
    sm.color(1, 1, 1, 1).data(type, seed, s1 - s0, h);
    sm.quad(fp(f, s0, y0, -rec), fp(f, s1, y0, -rec), fp(f, s1, y0 + h, -rec), fp(f, s0, y0 + h, -rec), [f.nx, 0, f.nz], [0, 0], [1, 0], [1, 1], [0, 1]);
  }

  // An old brick block: four walls with tall sash windows (real 3D windows near
  // the player), stone sills and lintels, a ground floor with glass shops and
  // garage doors, bronze trim lines. New parts are then added on top of it.
  //   r = map rectangle, floors = floors above the ground floor
  //   o: { tint, age, rng, groundH, cut: { side, s0, s1, y0 } = a piece of one wall left out for a glass insert }
  function brickBox(r, floors, o = {}) {
    const rng = o.rng || ctx.rng;
    const gH = o.groundH || 4.6;
    const avg = ctx.tex.avg.brick;
    const tint = o.tint || rng.pick(BRICK_TINTS);
    const B = {
      mb: ctx.mb.brick, tile: T.brick.size, tint, age: o.age ?? rng.range(0.6, 1), rng,
      uOff: rng.range(0, 50), vOff: rng.range(0, 50), offU: 64 * rng.int(0, 15) + rng.int(0, 20), offV: 64 * rng.int(0, 15) + 1,
    };
    const top = curb + gH + floors * BRICK_FLOOR, par = 0.9;
    B.roofY = top + par;
    const reveal = [avg[0] * tint[0] * 0.82, avg[1] * tint[1] * 0.82, avg[2] * tint[2] * 0.82];
    const bayW = rng.range(2.3, 2.7);
    const wr = WINDOW_STYLES[2];
    let face = 0;
    for (const side of ['N', 'S', 'E', 'W']) {
      const f = sideFrame(r, side), len = f.len;
      const cut = o.cut && o.cut.side === side ? o.cut : null;
      // ---- ground floor: glass shops, a door, garage doors for EVs ----
      const n = Math.max(1, Math.round(len / 5.2)), bw = len / n;
      let cur = 0;
      for (let i = 0; i < n; i++) {
        const s0 = i * bw + 0.5, s1 = (i + 1) * bw - 0.5, h = 3.3;
        const roll = rng.next();
        const type = roll < 0.55 ? 0 : roll < 0.8 ? 3 : 2;
        const a = type === 2 ? (s0 + s1) / 2 - 0.65 : s0, b = type === 2 ? (s0 + s1) / 2 + 0.65 : s1, hh = type === 2 ? 2.6 : h;
        wall(B, f, cur, a, curb, curb + gH);
        wall(B, f, a, b, curb + hh, curb + gH);
        cur = b;
        const seed = rng.int(1, 60) + rng.range(0.1, 0.9);
        opening(B, f, a, b, curb, hh, 0.24, type, seed);
        if (type === 0 && seed % 1 < 0.62 && ctx.playableNow) { const p = fp(f, (a + b) / 2, 0, 1.6); ctx.shopLights.push({ x: p[0], z: p[2], r: bw * 0.6 + 3, power: 0.36 }); }
        // thin bronze line above every opening
        fin.add(...fp(f, (a + b) / 2, curb + hh + 0.06, 0), f.nx, f.nz, b - a + 0.3, 0.07, 0.06, null, C.bronze);
      }
      wall(B, f, cur, len, curb, curb + gH);
      // ---- upper floors with windows ----
      const yU = curb + gH;
      const bays = Math.max(1, Math.floor(len / bayW + 0.4)), bwU = len / bays;
      const row = B.offV + (face++ % 5) * 12;
      const cells = (s0, nb, u0, y0, nf, v0) => {
        if (nb <= 0 || nf <= 0) return;
        wall(B, f, s0, s0 + nb * bwU, y0, y0 + nf * BRICK_FLOOR, { mode: 2, grid: [u0, u0 + nb, v0, v0 + nf] });
        if (!ctx.playableNow) return;
        for (let j = 0; j < nf; j++) for (let i = 0; i < nb; i++) {
          const cs = s0 + (i + wr[0] + wr[2] / 2) * bwU, cy = y0 + (j + wr[1] + wr[3] / 2) * BRICK_FLOOR;
          win.add(f.ox + f.dx * cs, cy, f.oz + f.dz * cs, f.nx, f.nz, 1, 1, 1, [wr[2] * bwU, wr[3] * BRICK_FLOOR, u0 + i, v0 + j], [reveal[0], reveal[1], reveal[2], 2 + 4 + 8]);
        }
      };
      if (!cut) cells(0, bays, B.offU, yU, floors, row);
      else {
        // leave a piece of this wall open (a glass part is set into it)
        const c0 = Math.max(0, Math.round(cut.s0 / bwU)), c1 = Math.min(bays, Math.round(cut.s1 / bwU));
        const fl = Math.max(0, Math.min(floors, Math.round((cut.y0 - yU) / BRICK_FLOOR)));
        cells(0, c0, B.offU, yU, floors, row);
        cells(c1 * bwU, bays - c1, B.offU + c1, yU, floors, row);
        cells(c0 * bwU, c1 - c0, B.offU + c0, yU, fl, row);
        // the brick edges of the opening
        const ya = yU + fl * BRICK_FLOOR;
        piece(B, [fp(f, c0 * bwU, ya, 0), fp(f, c0 * bwU, ya, -1.2), fp(f, c0 * bwU, top, -1.2), fp(f, c0 * bwU, top, 0)], [f.dx, 0, f.dz], 0.7);
        piece(B, [fp(f, c1 * bwU, ya, 0), fp(f, c1 * bwU, ya, -1.2), fp(f, c1 * bwU, top, -1.2), fp(f, c1 * bwU, top, 0)], [-f.dx, 0, -f.dz], 0.7);
      }
      // low wall around the roof, with a bronze line under it
      if (!cut) wall(B, f, 0, len, top, top + par);
      fin.add(...fp(f, len / 2, top - 0.12, 0), f.nx, f.nz, len + 0.1, 0.12, 0.08, null, C.bronze);
      if (ctx.playableNow) {
        const c = fp(f, len / 2, 0, 0.45);
        addDecal(ctx.mb.decal, 'ao', c[0], c[2], len, 0.9, Math.atan2(f.nx, f.nz), curb + 0.011, 0.9);
        // a little spray paint on old brick near the ground
        if (rng.chance(0.35)) {
          const uv = graffitiUV(rng.int(0, GRAFFITI_COLS * GRAFFITI_ROWS - 1)), s = rng.range(1.5, len - 1.5), w = rng.range(1.5, 2.4), h = rng.range(1.0, 1.5), y = curb + rng.range(0.4, 0.9);
          ctx.mb.graffiti.color(1, 1, 1, rng.range(0.4, 0.75));
          ctx.mb.graffiti.quad(fp(f, s - w / 2, y, 0.012), fp(f, s + w / 2, y, 0.012), fp(f, s + w / 2, y + h, 0.012), fp(f, s - w / 2, y + h, 0.012), [f.nx, 0, f.nz], [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]);
        }
      }
    }
    // roof of the old part
    ctx.mb.asphalt.color(0.8, 0.8, 0.82, 1);
    ctx.mb.asphalt.groundRect(r.minX, r.minZ, r.maxX, r.maxZ, top, T.asphalt.size, B.uOff * 0.1, B.vOff * 0.1);
    return { top, par, B };
  }

  // =========================================================================
  // SIMPLE BUILDING for the scenery outside the play area: one glass body
  // with a lid. No instanced detail, no collision.
  // =========================================================================
  function simple(box, floors, rng, opts = {}) {
    const w = box.maxX - box.minX, d = box.maxZ - box.minZ;
    const plan = rng.pick(['soft', 'soft', 'round', 'circle']);
    const taper = rng.chance(0.4);
    const top = LOBBY + floors * FLOOR;
    const sf = body({
      x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2, plan, a: w / 2 - 1, b: d / 2 - 1, y0: 0, y1: top,
      levels: taper ? [[0, 1, 0], [0.6, rng.range(0.85, 1), rng.range(-0.3, 0.3)], [1, rng.range(0.7, 0.95), rng.range(-0.5, 0.5)]] : null,
      steps: taper ? 3 : 1, tint: opts.tint || rng.pick(GLASS_TINTS), bay: 2.2,
    });
    cap(sf, top);
    return top;
  }

  return {
    ctx, curb, sets, C, body, cap, slabs, fins, faceRibbon, ribbon, patch, terrace, planted, doorOn, roof, bridge, bridgeStub, evBays, signOn, columns,
    hologram, collide, contactShadow, finish, brickBox, wall, piece, opening, simple,
    parts: { fin, block, helipad, dronePad, solar, solarRack, shrub, vine, planter, roofAC, charger, evBay, slab, slabWave, rail },
  };
}
