// ---------------------------------------------------------------------------
// heroBuildings.js - the HERO BUILDINGS of Port Meridian, made from code.
//
// Each one follows a reference picture in assets/reference/buildings/
// (see docs/building_notes.md for the notes on every picture):
//
//   b01 twist tower          160 m   The Crown (and 260 m as Kessler-Vance HQ)
//   b02 terrace tower         80 m   The Crown
//   b03 garden midrise        30 m   The Grid
//   b04 office hub            35 m   Neon Mile (twin towers with a sky bridge)
//   b05 villa cluster         20 m   The Grid
//   b06 beach hotel           50 m   Neon Mile
//   b07 drone and EV hub      35 m   Neon Mile (+ 55 m drone tower)
//   b08 retrofit brick tower  55 m   The Grid
//   b09 Neon Mile arcade      12 m   Neon Mile (no picture, built from the brief)
//   b10 S-curve tower        180 m   The Crown
//   b11 hourglass tower      140 m   The Crown and Neon Mile
//
// A hero function gets the kit and a "site":
//   s.x, s.z   middle of the lot,   s.rot  the way the front looks (radians)
//   s.far      true for copies outside the walkable area (less detail)
//   s.scale    b01 only: 1 = 160 m, 1.625 = 260 m
// It returns { rect (ground area that is solid), top (height) }.
//
// If a model file with the same name exists in assets/buildings/ (for example
// b01_twist_tower.glb), buildings.js loads that file instead.
// ---------------------------------------------------------------------------

import { ENTRANCES } from './entrances.js';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { FLOOR, GLASS_TINTS } from './buildingKit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pillowGeometry, blanketGeometry, rollGeometry } from '../utils/softShapes.js';

// Real sizes: height (m) and the lot each hero needs (width along the street x depth).
export const HEROES = {
  b01: { file: 'b01_twist_tower', height: 160, w: 52, d: 52 },
  b02: { file: 'b02_terrace_tower', height: 82, w: 42, d: 34 },
  b03: { file: 'b03_garden_midrise', height: 31, w: 30, d: 30 },
  b04: { file: 'b04_office_hub', height: 36, w: 54, d: 28 },
  b05: { file: 'b05_villa_cluster', height: 21, w: 46, d: 44 },
  b06: { file: 'b06_beach_hotel', height: 56, w: 40, d: 34 },
  b07: { file: 'b07_drone_ev_hub', height: 55, w: 40, d: 34 },
  b08: { file: 'b08_retrofit_brick_tower', height: 55, w: 28, d: 26 },
  b09: { file: 'b09_neon_arcade', height: 14, w: 46, d: 22 },
  b10: { file: 'b10_scurve_tower', height: 180, w: 46, d: 40 },
  b11: { file: 'b11_hourglass_tower', height: 140, w: 36, d: 36 },
  g01: { file: 'g01_mace_garage', height: 8, w: 18, d: 14 },   // story: Mace's garage with Nate's flat above it
  g02: { file: 'g02_parking_garage', height: 8, w: 30, d: 24 }, // story: an old car park with a flooded ground floor (Chapter 2)
};

// A curve on a body as a list of points: f(t) gives where around, y runs from ya to yb.
const line = (f, ya, yb, n = 9) => Array.from({ length: n }, (_, i) => [f(i / (n - 1)), ya + ((yb - ya) * i) / (n - 1)]);
// A point in front of the building: "right" meters to the right, "front" meters toward the street.
const local = (s, right, front) => [s.x + right * Math.cos(s.rot) + front * Math.sin(s.rot), s.z - right * Math.sin(s.rot) + front * Math.cos(s.rot)];
// A few street trees and EV posts at the foot of a hero.
function entrance(kit, s, w, front, trees = 2) {
  const ctx = kit.ctx;
  for (let i = 0; i < trees; i++) {
    const p = local(s, (i - (trees - 1) / 2) * (w / Math.max(1, trees)), front);
    ctx.roofTrees.push({ x: p[0], y: kit.curb, z: p[1], s: 0.9, trunk: true });
    ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.25 });
  }
}
function evPosts(kit, s, right0, right1, front, n) {
  for (let i = 0; i < n; i++) {
    const p = local(s, right0 + ((right1 - right0) * (i + 0.5)) / n, front);
    kit.ctx.evPosts.push({ x: p[0], z: p[1], rot: s.rot });
  }
}

// ===========================================================================
// b01 TWIST TOWER
// ===========================================================================
function b01(kit, s) {
  const { curb, C } = kit, far = !!s.far, k = s.scale || 1;
  const H = 160 * k, a = 16 * Math.sqrt(k), y0 = curb, tint = GLASS_TINTS[0];
  // green podium: two floors, wider than the tower, trees on its roof
  const pod = kit.body({ x: s.x, z: s.z, rot: s.rot, plan: 'round', a: a * 1.45, b: a * 1.45, y0, y1: y0 + 9, kind: 1, bay: 3, floorH: 4.5, tint });
  kit.roof(pod, { hedge: true, trees: far ? 0 : 7, color: C.concrete, far });
  // the tower: turns 80 degrees on the way up and is thinner in the middle
  const TW = 1.4, yb = y0 + 9, yt = y0 + H;
  const main = kit.body({
    x: s.x, z: s.z, rot: s.rot, plan: 'round', a, b: a, y0: yb, y1: yt, tint, bay: 1.7, steps: far ? 12 : 22,
    levels: [[0, 1.06, 0], [0.25, 0.97, TW * 0.25], [0.5, 0.86, TW * 0.5], [0.75, 0.94, TW * 0.75], [1, 1.02, TW]],
  });
  const T = (y) => (y - yb) / (yt - yb), Y = (t) => yb + (yt - yb) * t;
  // Four ribbons in two pairs. A pair starts together, opens in the middle
  // and closes again at the top: the field between them is an "eye" of dark glass.
  const open = (t) => 0.16 * Math.sin(Math.PI * t);
  const A = (t) => 0.02 + 0.5 * t + open(t), B = (t) => 0.02 + 0.5 * t - open(t);
  const rib = { w: 2.8 * Math.sqrt(k), out: 0.5, color: C.light };
  kit.ribbon(main, line(A, yb + 2, yt - 1.5, 11), rib);
  kit.ribbon(main, line(B, yb + 2, yt - 1.5, 11), rib);
  kit.ribbon(main, line((t) => A(t) + 0.5, yb + 2, yt - 1.5, 11), rib);
  kit.ribbon(main, line((t) => B(t) + 0.5, yb + 2, yt - 1.5, 11), rib);
  // outside the eyes: a light veil over the glass
  const veil = { mat: 'glass', out: 0.2, cols: 5, rowH: far ? 12 : 6 };
  kit.patch(main, (y) => A(T(y)), (y) => B(T(y)) + 0.5, yb + 2.5, yt - 2, veil);
  kit.patch(main, (y) => A(T(y)) + 0.5, (y) => B(T(y)) + 1, yb + 2.5, yt - 2, veil);
  // sky gardens: a diagonal band of planted terraces inside the eyes
  for (let t = 0.3; t < 0.64; t += FLOOR / (yt - yb)) kit.terrace(main, Y(t), A(t) - 0.2, A(t) - 0.03, { depth: 2.4, far });
  for (let t = 0.52; t < 0.82; t += (2 * FLOOR) / (yt - yb)) kit.terrace(main, Y(t), B(t) + 0.53, B(t) + 0.7, { depth: 2.2, far });
  // two platforms that stick out: a sky bridge stub and a garden balcony
  kit.bridgeStub(main, A(0.55) + 0.2, Y(0.55), 11);
  kit.terrace(main, Y(0.4), A(0.4) + 0.03, A(0.4) + 0.12, { depth: 5.5, far });
  // top: tilted solar panels on the last floors, roof garden, helipad
  kit.patch(main, 0.58, 0.9, Y(0.9), Y(0.985), { mat: 'panel', kind: 4, out: 0.4, color: [1, 1, 1], cols: 6 });
  kit.roof(main, { trees: far ? 3 : 9, hedge: true, helipad: [0.36, -0.3], treeSize: 1.3, far });
  if (!far) {
    kit.fins(main, { every: 2, depth: 0.3 });
    kit.slabs(pod, { y0: y0 + 4.5, y1: y0 + 9, step: 4.5, thick: 0.5, grow: 1.03 });
    kit.evBays(pod, 0.42, 0.58, 4);
    kit.signOn(pod, 0, y0 + 5, 5, 1.1, 0.4);
    entrance(kit, s, a * 2.6, a * 1.45 + 4, 4);
    kit.contactShadow(pod);
  }
  return { rect: pod.aabb(), top: yt };
}

// ===========================================================================
// b02 TERRACE TOWER
// ===========================================================================
function b02(kit, s) {
  const { curb, C } = kit, far = !!s.far;
  const a = 17, b = 13, tint = GLASS_TINTS[1];
  const base = { x: s.x, z: s.z, rot: s.rot, plan: 'round', a, b, tint, bay: 1.5 };
  // glass lobby
  const lobby = kit.body({ ...base, a: a - 1.2, b: b - 1.2, y0: curb, y1: curb + 5, kind: 1, bay: 3 });
  // two stacked blocks with an open garden floor between them
  const blocks = [[curb + 5, curb + 41], [curb + 46, curb + 82]];
  for (const [ya, yb] of blocks) {
    const sf = kit.body({ ...base, y0: ya, y1: yb });
    const h = yb - ya;
    // ribbon frames: an S on the front and one on the back; between them (around
    // the right side) every floor is a planted terrace, the other half is smooth glass
    const F = (t) => 0.95 + 0.17 * (0.5 - 0.5 * Math.cos(Math.PI * t)), K = (t) => 0.55 - 0.15 * (0.5 - 0.5 * Math.cos(Math.PI * t));
    const rib = { w: 2.6, out: 0.45, color: C.white, kind: 1, metal: 0.3 };
    kit.ribbon(sf, line(F, ya + 1.4, yb - 1.4), rib);
    kit.ribbon(sf, line(K, ya + 1.4, yb - 1.4), rib);
    // bands along the top and the bottom of the glass half
    kit.ribbon(sf, [[K(1), yb - 1.3], [0.62, yb - 1.3], [0.82, yb - 1.3], [F(1), yb - 1.3]], { ...rib, w: 2.2 });
    kit.ribbon(sf, [[K(0), ya + 1.3], [0.68, ya + 1.3], [0.85, ya + 1.3], [F(0), ya + 1.3]], { ...rib, w: 2.2 });
    for (let y = ya + FLOOR; y < yb - 1; y += FLOOR) {
      const t = (y - ya) / h;
      kit.terrace(sf, y, F(t) - 1 + 0.035, K(t) - 0.035, { depth: 2.3, vines: 0.5, far });
    }
    if (!far) kit.fins(sf, { u0: 0.58, u1: 0.93, depth: 0.42 });
    if (ya > curb + 40) kit.roof(sf, { trees: far ? 3 : 8, hedge: true, dronePad: [-0.45, -0.3], solar: 0.12, treeSize: 1.2, far });
  }
  // the garden floor: a smaller core, columns, plants all around, a sky bridge
  const core = kit.body({ ...base, a: a - 4, b: b - 4, y0: curb + 41, y1: curb + 46, mat: 'panel', tint: C.concrete, kind: 0 });
  kit.cap(core, curb + 41, { down: true, grow: 1.4, color: C.light });
  kit.terrace(core, curb + 41, 0, 1, { depth: 4.3, thick: 0.6, vines: 0.8, far });
  const posts = [];
  for (let i = 0; i < 8; i++) { const p = lobby.at((i + 0.5) / 8, 0); posts.push([p.x + p.nx * 0.6, p.z + p.nz * 0.6]); }
  kit.columns(posts, curb + 41, curb + 46, 0.4);
  kit.bridgeStub(core, 0.75, curb + 41.4, 12);
  if (!far) {
    for (let i = 0; i < 5; i++) { const p = core.at(i / 5 + 0.1, 0); kit.ctx.roofTrees.push({ x: p.x + p.nx * 2.2, y: curb + 41, z: p.z + p.nz * 2.2, s: 0.7, trunk: true }); }
    kit.slabs(lobby, { y0: curb + 5, y1: curb + 5, thick: 0.5, grow: 1.1 });
    kit.evBays(lobby, 0.45, 0.55, 2);
    kit.signOn(lobby, 0, curb + 3.4, 4.5, 1.0, 0.4);
    evPosts(kit, s, 6, 14, b + 3.5, 3);
    entrance(kit, s, 30, b + 5, 3);
    kit.contactShadow(lobby);
  }
  return { rect: kit.body({ ...base, y0: curb, y1: curb + 1, noSkin: true }).aabb(), top: curb + 82 };
}

// ===========================================================================
// b03 GARDEN MIDRISE
// ===========================================================================
function b03(kit, s) {
  const { curb, C, ctx } = kit;
  const a = 11.5, tint = GLASS_TINTS[2];
  const base = { x: s.x, z: s.z, rot: s.rot, plan: 'round', a, b: a, tint, bay: 1.3 };
  const lobby = kit.body({ ...base, a: a - 0.8, b: a - 0.8, y0: curb, y1: curb + 5.5, kind: 1, bay: 2.8 });
  const sf = kit.body({ ...base, y0: curb + 5.5, y1: curb + 29.5 });
  const tiers = [curb + 5.5, curb + 13.5, curb + 21.5];
  // three thick concrete trays full of plants
  for (const y of tiers) kit.terrace(sf, y, 0, 1, { depth: 1.7, thick: 0.95, color: C.concrete, vines: 0.65 });
  // a ribbon swings over every tier, with perforated metal under it
  tiers.forEach((y, i) => {
    const u0 = [0.88, 0.38, 0.62][i], dir = i === 1 ? -1 : 1;
    const R = (t) => u0 + dir * 0.24 * (0.5 - 0.5 * Math.cos(Math.PI * t));
    kit.ribbon(sf, line(R, y + 1.2, y + 7.4, 7), { w: 1.7, out: 0.4, color: C.concrete });
    kit.patch(sf, (yy) => R((yy - y - 1.2) / 6.2), R(1) + dir * 0.02, y + 1.3, y + 7.3, { kind: 1, out: 0.3, color: C.light, cols: 5, rowH: 3 });
  });
  // the big green wall, two tiers high
  kit.patch(sf, 0.66, 0.84, curb + 6.6, curb + 21, { mat: 'green', out: 0.35, cols: 4 });
  kit.fins(sf, { depth: 0.36, width: 0.07 });
  // thin roof plate that hangs over, solar roof with a drone, trees
  kit.roof(sf, { plate: 1.16, solar: 0.4, trees: 4, treeSize: 1.35, dronePad: [0.5, 0.45], hedge: true });
  // sky bridges at the top tier, to the left and to the right
  kit.bridgeStub(sf, 0.25, curb + 22.3, 8);
  kit.bridgeStub(sf, 0.75, curb + 22.3, 8);
  // outdoor glass stair from the street up to the first tray
  stair(kit, sf.at(0.14, 0), sf.at(0.3, 0), curb, curb + 5.5, 2.6);
  kit.slabs(lobby, { y0: curb + 5.5, y1: curb + 5.5, thick: 0.01, grow: 1 });
  kit.signOn(lobby, 0, curb + 3.6, 4, 0.9, 0.4);
  kit.doorOn(lobby, 0.0, 2.2, 2.9, 0);
  if (!s.far) markEntrance('garden', lobby, 0.0, curb, 2.2, 2.9);                     // (the lobby door: a flat inside)
  evPosts(kit, s, -9, -3, a + 1.6, 3);
  kit.contactShadow(lobby);
  ctx.shopLights.push({ x: local(s, 0, a + 1.5)[0], z: local(s, 0, a + 1.5)[1], r: 9, power: 0.4 });
  return { rect: lobby.aabb(), top: curb + 30 };
}
// Outdoor stair with glass sides: from point p (on the ground) up to point q.
function stair(kit, p, q, y0, y1, off) {
  const mb = kit.ctx.mb.panel, C = kit.C;
  const A = [p.x + p.nx * off, p.z + p.nz * off], B = [q.x + q.nx * off, q.z + q.nz * off];
  const nA = [p.nx, p.nz], nB = [q.nx, q.nz], w = 1.5;
  mb.color(C.concrete[0], C.concrete[1], C.concrete[2], 1);
  mb.data(0, 0.6, 0.05, 0);
  const a0 = [A[0], y0, A[1]], a1 = [A[0] + nA[0] * w, y0, A[1] + nA[1] * w], b0 = [B[0], y1, B[1]], b1 = [B[0] + nB[0] * w, y1, B[1] + nB[1] * w];
  mb.quadAuto(a0, a1, b1, b0, [0, 1, 0]);
  mb.quadAuto([a0[0], y0 - 0.3, a0[2]], [a1[0], y0 - 0.3, a1[2]], [b1[0], y1 - 0.3, b1[2]], [b0[0], y1 - 0.3, b0[2]], [0, -1, 0]);
  mb.quadAuto(a1, [a1[0], y0 - 0.3, a1[2]], [b1[0], y1 - 0.3, b1[2]], b1, [nA[0], 0, nA[1]]);
  // glass balustrade on the outer side
  const rm = kit.ctx.mb.rail;
  rm.color(1, 1, 1, 1);
  rm.quad(a1, b1, [b1[0], y1 + 1.1, b1[2]], [a1[0], y0 + 1.1, a1[2]], [nA[0], 0, nA[1]], [0, 0.252], [5, 0.252], [5, 0.498], [0, 0.498]);
  kit.ctx.colliders.circles.push({ x: (a0[0] + a1[0]) / 2, z: (a0[2] + a1[2]) / 2, r: 0.9 });
}

// ===========================================================================
// b04 OFFICE HUB (twin towers with a sky bridge)
// ===========================================================================
function b04(kit, s) {
  const { curb, C } = kit;
  const a = 10.5, tint = GLASS_TINTS[3];
  let rect = null;
  [-1, 1].forEach((side, i) => {
    const c = local(s, side * 15.5, 0);
    const base = { x: c[0], z: c[1], rot: s.rot, plan: 'round', a, b: a, tint, bay: 1.5 };
    // dark recessed ground floor with EV bays
    const ground = kit.body({ ...base, a: a - 1, b: a - 1, y0: curb, y1: curb + 4.6, mat: 'panel', tint: C.graphite, kind: 0 });
    kit.evBays(ground, -0.11, 0.11, 3);
    kit.evBays(ground, 0.39, 0.61, 2);
    // curved glass podium, framed like one huge rounded window
    const pod = kit.body({ ...base, a: a + 0.7, b: a + 0.7, y0: curb + 4.6, y1: curb + 15.6, levels: [[0, 0.96, 0], [0.5, 1.03, 0], [1, 0.96, 0]], steps: 4, bay: 2.2 });
    kit.slabs(pod, { y0: curb + 4.6, y1: curb + 15.6, step: 11, thick: 0.9, grow: 1.02, color: C.light });
    kit.faceRibbon(pod, 0, 'portal', { color: C.light, wide: 0.95, depth: 0.5 });
    kit.faceRibbon(pod, 2, 'portal', { color: C.light, wide: 0.95, depth: 0.5 });
    // upper part: one half stepped terraces, the other half a perforated volume with fins
    const up = kit.body({ ...base, y0: curb + 15.6, y1: curb + 33 });
    for (const y of [curb + 19.6, curb + 23.6, curb + 27.6]) kit.terrace(up, y, 0.54 + (y - curb - 19.6) * 0.012, 0.96, { depth: 2.5, color: C.light, vines: 0.6 });
    kit.patch(up, 0.05, 0.45, curb + 17, curb + 31.5, { kind: 1, out: 0.3, color: C.light, cols: 8 });
    kit.ribbon(up, [[0.96, curb + 16], [0.0, curb + 21], [0.05, curb + 27], [0.16, curb + 32.6]], { w: 2.0, out: 0.45, color: C.light });
    kit.fins(up, { u0: 0.46, u1: 0.56, depth: 0.5 });
    // wide thin roof wing; helipad on one tower, solar on the other
    kit.roof(up, i === 0 ? { plate: 1.2, helipad: [0, 0], plateColor: C.light } : { plate: 1.2, solar: 0.5, trees: 2, plateColor: C.light });
    kit.contactShadow(ground);
    const r = ground.aabb();
    rect = rect ? { minX: Math.min(rect.minX, r.minX), maxX: Math.max(rect.maxX, r.maxX), minZ: Math.min(rect.minZ, r.minZ), maxZ: Math.max(rect.maxZ, r.maxZ) } : r;
    kit.collide(r, curb + 33);
  });
  // the long sky bridge between the two towers
  const p = local(s, -8, 0), q = local(s, 8, 0);
  kit.bridge(p[0], p[1], q[0], q[1], curb + 20);
  evPosts(kit, s, -4, 4, a + 2.5, 3);
  return { rect, top: curb + 35, solid: true };
}

// ===========================================================================
// b05 VILLA CLUSTER
// ===========================================================================
function b05(kit, s) {
  const { curb, C, ctx } = kit;
  const spots = [[-12, 10.5, 0], [12, 10.5, 0.2], [-12, -10.5, Math.PI], [12, -10.5, Math.PI - 0.15]];
  let rect = null;
  const centers = [];
  spots.forEach(([dx, dz, turn], i) => {
    const c = local(s, dx, dz);
    const rot = s.rot + turn;
    centers.push(c);
    const wood = i % 2 === 0;
    // rounded concrete plinth with the garage
    const plinth = kit.body({ x: c[0], z: c[1], rot, plan: 'round', a: 9.4, b: 8.6, y0: curb, y1: curb + 3.4, mat: 'panel', tint: C.concrete, kind: 0, rough: 0.85 });
    kit.evBays(plinth, -0.06, 0.06, 1);
    kit.doorOn(plinth, 0.12, 3.2, 2.6, 3);
    kit.doorOn(plinth, -0.13, 1.5, 2.5, 0);
    if (!s.far && i < 2) markEntrance('villa' + i, plinth, -0.13, curb, 1.5, 2.5);     // (a door you can open: a house inside)
    // a thin warm line of light along the top edge of the plinth
    kit.ribbon(plinth, [[0, curb + 3.2], [0.25, curb + 3.2], [0.5, curb + 3.2], [0.75, curb + 3.2], [1, curb + 3.2]], { w: 0.1, out: 0.05, color: [1.0, 0.72, 0.4], glow: 0.75, fine: 2.5 });
    // four floors of rounded trays that step back, each with a garden terrace in front
    let top = curb + 3.4;
    for (let f = 0; f < 4; f++) {
      const sf = kit.body({
        x: c[0], z: c[1], rot, plan: 'round', a: 8.6 - f * 1.05, b: 7.6 - f * 0.9, y0: top, y1: top + FLOOR,
        levels: [[0, 1, 0, 0, -f * 0.75], [1, 1, 0, 0, -f * 0.75]], steps: 1,
        ...(f % 2 === (wood ? 1 : 0) ? { mat: 'panel', tint: wood ? C.wood : C.graphite, kind: 2, rough: 0.6 } : { tint: GLASS_TINTS[4], bay: 1.6 }),
      });
      // graphite tray under every floor, plants on the part that the next floor leaves free
      kit.slabs(sf, { y0: top + 0.02, y1: top + 0.02, thick: 0.45, grow: 1.09, color: C.graphite });
      kit.terrace(sf, top, -0.2, 0.2, { depth: 1.1, thick: 0.3, color: C.graphite, vines: 0.7 });
      top += FLOOR;
      if (f === 3) kit.roof(sf, { trees: 2, hedge: true, solar: wood ? 0.45 : 0, rimColor: C.graphite, treeSize: 1.1 });
    }
    // one villa has a small helipad on its first terrace
    if (i === 0) { const p = local({ x: c[0], z: c[1], rot }, 0, 6.3); kit.parts.helipad.add(p[0], curb + 3.4, p[1], 0, 1, 0.42, 0.25, 0.42); }
    const r = plinth.aabb();
    kit.collide(r, top);
    kit.contactShadow(plinth);
    rect = rect ? { minX: Math.min(rect.minX, r.minX), maxX: Math.max(rect.maxX, r.maxX), minZ: Math.min(rect.minZ, r.minZ), maxZ: Math.max(rect.maxZ, r.maxZ) } : r;
  });
  // thin bridges from villa to villa
  kit.bridge(centers[0][0], centers[0][1], centers[1][0], centers[1][1], curb + 11.4);
  kit.bridge(centers[2][0], centers[2][1], centers[3][0], centers[3][1], curb + 11.4);
  // a small garden court in the middle
  for (const [dx, dz] of [[0, 0], [-3, 2], [3, -2]]) { const p = local(s, dx, dz); ctx.roofTrees.push({ x: p[0], y: curb, z: p[1], s: 1.0, trunk: true }); ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.25 }); }
  return { rect, top: curb + 21, solid: true };
}

// ===========================================================================
// b06 BEACH HOTEL
// ===========================================================================
function b06(kit, s) {
  const { curb, C, ctx } = kit;
  const a = 15, b = 12, tint = GLASS_TINTS[3];
  const base = { x: s.x, z: s.z, rot: s.rot, plan: 'circle', a, b, tint, bay: 1.6 };
  // glass lobby under a wide curved canopy on slim legs
  const lobby = kit.body({ ...base, a: a - 2, b: b - 2, y0: curb, y1: curb + 5, kind: 1, bay: 3 });
  kit.slabs(lobby, { y0: curb + 5.4, y1: curb + 5.4, thick: 0.5, grow: 1.5, color: C.white });
  const legs = [];
  for (let i = 0; i < 8; i++) { const p = lobby.at((i + 0.5) / 8, 0); legs.push([p.x + p.nx * 4.6, p.z + p.nz * 4.6]); }
  kit.columns(legs, curb, curb + 5, 0.3, C.white);
  // the tower: every floor has a thick white wave balcony
  const sf = kit.body({ ...base, y0: curb + 5, y1: curb + 49.4, levels: [[0, 0.9, 0], [0.12, 1, 0], [1, 1, 0]], steps: 6 });
  kit.slabs(sf, { y0: curb + 9.4, y1: curb + 49.4, step: FLOOR, thick: 1.15, grow: 1.0, wave: true, color: C.white });
  kit.fins(sf, { every: 2, depth: 0.25, y0: curb + 9.4, color: C.graphite });
  kit.planted(sf, curb + 9.5, { grow: 1.07, share: 0.6, vines: 0.5 });
  // back: green walls and two ribbons
  kit.patch(sf, 0.4, 0.47, curb + 10, curb + 40, { mat: 'green', out: 2.0, cols: 2 });
  kit.patch(sf, 0.53, 0.58, curb + 14, curb + 30, { mat: 'green', out: 2.0, cols: 2 });
  kit.ribbon(sf, [[0.4, curb + 33], [0.48, curb + 35], [0.56, curb + 40], [0.62, curb + 42]], { w: 1.8, out: 2.1, color: C.white });
  kit.ribbon(sf, [[0.6, curb + 16], [0.52, curb + 18], [0.44, curb + 22]], { w: 1.8, out: 2.1, color: C.white });
  // roof: pool at the front edge, garden, penthouse with the helipad on top
  kit.roof(sf, { trees: 6, hedge: true, treeSize: 1.1, color: C.light });
  const pool = kit.body({ ...base, a: a * 0.62, b: b * 0.36, y0: curb + 49.4, y1: curb + 50.2, mat: 'panel', tint: C.white, kind: 0, levels: [[0, 1, 0, 0, b * 0.52], [1, 1, 0, 0, b * 0.52]], steps: 1 });
  kit.cap(pool, curb + 50.05, { kind: 5, color: [1, 1, 1], grow: 0.93 });
  kit.cap(pool, curb + 50.2, { color: C.white, grow: 0.0 });
  const pent = kit.body({ ...base, plan: 'round', a: 6.2, b: 4.6, y0: curb + 49.4, y1: curb + 55.4, levels: [[0, 1, 0, 0, -b * 0.42], [1, 1, 0, 0, -b * 0.42]], steps: 1, bay: 1.8 });
  kit.roof(pent, { helipad: [0, 0], plate: 1.12 });
  kit.bridgeStub(sf, 0.75, curb + 29.4, 10);
  kit.signOn(lobby, 0, curb + 3.3, 5, 1.1, 0.45, true);
  // landscaped foot: trees, EV parking at the street
  entrance(kit, s, 34, b + 6, 4);
  evPosts(kit, s, -6, 6, b + 9, 4);
  kit.contactShadow(lobby);
  ctx.shopLights.push({ x: local(s, 0, b + 2)[0], z: local(s, 0, b + 2)[1], r: 10, power: 0.45 });
  return { rect: lobby.aabb(), top: curb + 56 };
}

// ===========================================================================
// b07 DRONE AND EV HUB
// ===========================================================================
function b07(kit, s) {
  const { curb, C, ctx } = kit;
  const a = 14, b = 11, tint = GLASS_TINTS[2];
  const c = local(s, -3, 1);
  const base = { x: c[0], z: c[1], rot: s.rot, plan: 'soft', a, b, tint, bay: 1.4 };
  // concrete ground floor: glass door in front, garage doors at the back, chargers on one side
  const ground = kit.body({ ...base, y0: curb, y1: curb + 5.5, mat: 'panel', tint: C.concrete, kind: 0, rough: 0.85 });
  kit.doorOn(ground, 0, 5.5, 3.6, 0);
  kit.doorOn(ground, 0.44, 4.4, 4.0, 3);
  kit.doorOn(ground, 0.56, 4.4, 4.0, 3);
  kit.evBays(ground, 0.66, 0.84, 4);
  // tall glass body with white fins
  const sf = kit.body({ ...base, y0: curb + 5.5, y1: curb + 27.5 });
  kit.fins(sf, { depth: 0.5, width: 0.09, color: C.white, u0: 0.12, u1: 0.88 });
  kit.slabs(sf, { y0: curb + 5.5, y1: curb + 5.5, thick: 0.6, grow: 1.03, color: C.light });
  // a ribbon cuts diagonally over the front; stepped green terraces above it
  const R = (t) => 0.86 + 0.3 * t;
  kit.ribbon(sf, line(R, curb + 9, curb + 24, 6), { w: 1.9, out: 0.5, color: C.white });
  for (const y of [curb + 15.5, curb + 19.5, curb + 23.5]) kit.terrace(sf, y, R((y - curb - 9) / 15) - 1 + 0.03, 0.2, { depth: 2.6, color: C.concrete, vines: 0.5 });
  kit.patch(sf, 0.42, 0.58, curb + 8, curb + 20, { mat: 'green', out: 0.3, cols: 4 });
  // the wavy metal roof with a white edge, trees on it
  const top = curb + 27.5, rf = sf.frameAt(top), mb = ctx.mb.panel;
  const wave = (x, z) => top + 3.4 + 2.4 * Math.sin(1.5 * x + 0.5) * Math.cos(1.1 * z) + 1.2 * x;
  const rows = [0, 0.5, 1.09].map((r) => sf.ring.map((p) => { const q = sf.place(rf, p.x * r, p.z * r, p.nx, p.nz); return [q.x, wave(p.x * r, p.z * r), q.z]; }));
  mb.color(C.graphite[0], C.graphite[1], C.graphite[2], 1);
  mb.data(3, 0.4, 0.6, 0);
  for (let r = 0; r < 2; r++) for (let i = 0; i < sf.ring.length - 1; i++) mb.quadAuto(rows[r][i], rows[r + 1][i], rows[r + 1][i + 1], rows[r][i + 1], [0, 1, 0]);
  mb.color(C.white[0], C.white[1], C.white[2], 1);
  mb.data(0, 0.5, 0.1, 0);
  for (let i = 0; i < sf.ring.length - 1; i++) {
    const p = rows[2][i], q = rows[2][i + 1], n = sf.ring[i];
    mb.quadAuto(p, q, [q[0], q[1] - 0.55, q[2]], [p[0], p[1] - 0.55, p[2]], [n.nx, 0, n.nz]);
    // wall between the glass and the roof (so nothing is open under the wave)
    const g0 = sf.place(rf, n.x, n.z, n.nx, n.nz), n2 = sf.ring[i + 1], g1 = sf.place(rf, n2.x, n2.z, n2.nx, n2.nz);
    mb.quadAuto([g0.x, top, g0.z], [g1.x, top, g1.z], [g1.x, wave(n2.x, n2.z) - 0.1, g1.z], [g0.x, wave(n.x, n.z) - 0.1, g0.z], [n.nx, 0, n.nz]);
  }
  for (const [x, z] of [[0.5, 0.2], [0.3, -0.4], [-0.3, 0.3]]) { const q = sf.place(rf, x, z, 0, 1); ctx.roofTrees.push({ x: q.x, y: wave(x, z) - 0.2, z: q.z, s: 0.85, trunk: true }); }
  // the slim drone tower with a solar strip and a landing deck
  const tc = local(s, 15.2, -8);
  const tower = kit.body({ x: tc[0], z: tc[1], rot: s.rot, plan: 'soft', a: 2.5, b: 2.5, y0: curb, y1: curb + 53, mat: 'panel', tint: C.grey, kind: 0, rough: 0.7 });
  kit.patch(tower, -0.09, 0.09, curb + 10, curb + 50, { kind: 4, out: 0.12, color: [1, 1, 1], cols: 1, rowH: 20 });
  kit.patch(tower, 0.16, 0.34, curb + 8, curb + 46, { kind: 1, out: 0.1, color: C.light, cols: 1, rowH: 20 });
  kit.slabs(tower, { y0: curb + 53, y1: curb + 53, thick: 0.5, grow: 1.9, color: C.light });
  kit.cap(tower, curb + 53, { grow: 1.9 });
  kit.parts.dronePad.add(tc[0], curb + 53, tc[1], Math.sin(s.rot), Math.cos(s.rot), 1.35, 1, 1.35);
  // zig-zag service stairs on the side of the tower
  for (let i = 0; i < 7; i++) {
    const p = tower.at(0.75, 0), y = curb + 6 + i * 6;
    kit.parts.block.add(p.x + p.nx * 0.1, y, p.z + p.nz * 0.1, p.nx, p.nz, 3.4, 0.15, 1.3, null, C.grey);
  }
  kit.collide(tower.aabb(), curb + 53);
  evPosts(kit, s, -17, -9, 4, 4);
  kit.contactShadow(ground);
  return { rect: ground.aabb(), top: curb + 55 };
}

// ===========================================================================
// b08 RETROFIT BRICK TOWER
// ===========================================================================
function b08(kit, s) {
  const { curb, C, ctx } = kit;
  // the old brick tower (lined up with the map, like all brick houses)
  const turn = Math.round(s.rot / (Math.PI / 2));
  const front = ['N', 'W', 'S', 'E'][((turn % 4) + 4) % 4];
  const hw = 11, hd = 10;
  const wide = front === 'N' || front === 'S';
  const r = { minX: s.x - (wide ? hw : hd), maxX: s.x + (wide ? hw : hd), minZ: s.z - (wide ? hd : hw), maxZ: s.z + (wide ? hd : hw) };
  const brick = kit.brickBox(r, 9, { tint: [0.78, 0.72, 0.7], age: 0.95, cut: { side: front, s0: 0, s1: 10, y0: curb + 4.6 + 4 * 3.5 } });
  const top = brick.top;            // 36.3 m
  // new glass part set into the front left corner; it rises above the brick
  const gc = local(s, -5.6, 4.2);
  const glass = kit.body({ x: gc[0], z: gc[1], rot: s.rot, plan: 'round', a: 6.2, b: 6.2, y0: curb + 18.6, y1: curb + 51, tint: GLASS_TINTS[4], bay: 1.5 });
  kit.cap(glass, curb + 18.6, { down: true, color: C.bronze });
  kit.slabs(glass, { y0: curb + 22.6, y1: curb + 50.6, thick: 0.35, grow: 1.1, color: C.light, rail: true });
  kit.planted(glass, curb + 30.7, { grow: 1.12, share: 0.5, vines: 0.6 });
  kit.planted(glass, curb + 42.7, { grow: 1.12, share: 0.5, vines: 0.6 });
  // bronze frame around the glass part, with an S step where it cuts into the brick
  kit.faceRibbon(glass, 0, 'portal', { color: C.bronze, wide: 0.92, y0: curb + 19, y1: curb + 50.6 });
  kit.ribbon(glass, [[0.22, curb + 19], [0.2, curb + 26], [0.12, curb + 30], [0.1, curb + 37]], { w: 1.0, out: 0.35, color: C.bronze, metal: 0.6 });
  kit.roof(glass, { helipad: [0, 0], plate: 1.1, plateColor: C.light });
  // grey metal box on top of the old roof, wood slats beside it
  const bc = local(s, 2.6, -1.5);
  const box = kit.body({ x: bc[0], z: bc[1], rot: s.rot, plan: 'soft', a: 7.6, b: 7.8, y0: top, y1: curb + 49.5, mat: 'panel', tint: C.grey, kind: 3, rough: 0.45, metal: 0.5 });
  kit.roof(box, { helipad: [0.2, -0.2], solar: 0.2, trees: 3, color: C.roof });
  const sc = local(s, 6.4, 6.6);
  const slats = kit.body({ x: sc[0], z: sc[1], rot: s.rot, plan: 'soft', a: 3.8, b: 2.6, y0: top, y1: curb + 45.5, mat: 'panel', tint: C.wood, kind: 2 });
  kit.roof(slats, { trees: 2, hedge: true, rimColor: C.bronze });
  // green walls and hanging plants on the old brick
  kit.patch(box, 0.2, 0.3, top - 9, top + 6, { mat: 'green', out: 3.7, cols: 2 });
  kit.patch(box, 0.7, 0.78, top - 6, top + 4, { mat: 'green', out: 3.5, cols: 2 });
  kit.planted(box, top + 0.9, { grow: 1.32, share: 0.45, vines: 0.8 });
  // sky bridge near the top, EV chargers at the street
  kit.bridgeStub(box, 0.25, curb + 43.5, 12);
  evPosts(kit, s, 2, 9, hd + 1.4, 3);
  ctx.shopLights.push({ x: local(s, 0, hd + 1.5)[0], z: local(s, 0, hd + 1.5)[1], r: 8, power: 0.3 });
  return { rect: r, top: curb + 53 };
}

// ===========================================================================
// b09 NEON MILE ARCADE (designed from the brief)
// ===========================================================================
function b09(kit, s) {
  const { curb, C, ctx } = kit;
  const a = 19, b = 7.2;
  const base = { x: s.x, z: s.z, rot: s.rot, plan: 'round', a, b, tint: GLASS_TINTS[5] };
  // curved glass front: shops on the ground floor, two floors above
  const shops = kit.body({ ...base, y0: curb, y1: curb + 5, kind: 1, bay: 3.2, floorH: 5 });
  const up = kit.body({ ...base, y0: curb + 5, y1: curb + 12.2, bay: 1.6, floorH: 3.6 });
  kit.slabs(up, { y0: curb + 5, y1: curb + 12.2, step: 3.6, thick: 0.4, grow: 1.04, color: C.white });
  kit.fins(up, { every: 2, depth: 0.3, u0: 0.0, u1: 1 });
  // soft lit shop signs along the front
  for (const u of [-0.076, -0.038, 0, 0.038, 0.076]) kit.signOn(shops, u, curb + 3.7, 3.1, 0.8, 0.45, u === 0);
  for (const u of [-0.057, 0.019, 0.057]) kit.doorOn(shops, u, 1.9, 2.8, 0);
  // green wall at one end
  kit.patch(up, 0.19, 0.31, curb + 0.6, curb + 12, { mat: 'green', out: 0.35, cols: 4 });
  // roof garden under a thin floating canopy on slim columns
  kit.roof(up, { trees: 3, hedge: true, treeSize: 0.9 });
  const posts = [];
  for (let i = 0; i < 10; i++) { const p = up.at((i + 0.5) / 10, 0); posts.push([p.x + p.nx * 1.6, p.z + p.nz * 1.6]); }
  kit.columns(posts, curb, curb + 15.2, 0.17, C.white);
  kit.parts.slab.round.add(s.x, curb + 15.2, s.z, Math.sin(s.rot), Math.cos(s.rot), a * 1.16, 0.35, b * 1.42, null, C.white);
  kit.cap(up, curb + 15.5, { grow: 1.1, color: C.light });
  kit.cap(up, curb + 15.22, { grow: 1.1, down: true, color: C.white });
  // a soft hologram above the entrance, EV chargers at the street
  const hp = local(s, 0, b + 0.5);
  kit.hologram(hp[0], hp[1], curb + 16.4, Math.sin(s.rot), Math.cos(s.rot), 0.7);
  evPosts(kit, s, -15, -5, b + 3.2, 4);
  evPosts(kit, s, 5, 15, b + 3.2, 4);
  ctx.shopLights.push({ x: local(s, -8, b + 2)[0], z: local(s, -8, b + 2)[1], r: 9, power: 0.5 }, { x: local(s, 8, b + 2)[0], z: local(s, 8, b + 2)[1], r: 9, power: 0.5 });
  kit.contactShadow(shops);
  return { rect: shops.aabb(), top: curb + 16 };
}

// ===========================================================================
// b10 S-CURVE TOWER
// ===========================================================================
function b10(kit, s) {
  const { curb, C } = kit, far = !!s.far;
  const a = 17, b = 14, H = 180, tint = GLASS_TINTS[0];
  const base = { x: s.x, z: s.z, rot: s.rot, plan: 'round', a, b, tint, bay: 1.6 };
  // glass podium with a white canopy
  const pod = kit.body({ ...base, a: a + 1.5, b: b + 1.5, y0: curb, y1: curb + 6, kind: 1, bay: 3, floorH: 6 });
  // the tower, and a slightly smaller glass crown box on top
  const yb = curb + 6, yc = curb + 158, yt = curb + H;
  const main = kit.body({ ...base, y0: yb, y1: yc });
  const crown = kit.body({ ...base, a: a * 0.9, b: b * 0.9, y0: yc, y1: yt, tint: GLASS_TINTS[5], levels: [[0, 1, 0], [1, 0.93, 0]], steps: 2 });
  kit.cap(main, yc, { color: C.roof });
  // ONE huge S ribbon from the foot to the top; it ends in a fin above the roof.
  // A thinner second line runs beside it; the field between them is a light veil.
  const Sx = (t) => 0.84 + 0.42 * (t * t * (3 - 2 * t)) + 0.05 * Math.sin(Math.PI * 2 * t);
  const S2 = (t) => Sx(t) - 0.16 + 0.07 * t;
  const T = (y) => Math.min(1, Math.max(0, (y - yb - 2) / (yt + 7 - yb - 2)));
  kit.ribbon(main, line(Sx, yb + 2, yt + 9, 14), { w: 3.6, out: 0.6, color: C.white, over: 12 });
  kit.ribbon(main, line(S2, yb + 2, yt + 3, 14), { w: 1.1, out: 0.5, color: C.white, over: 6 });
  kit.patch(main, (y) => S2(T(y)), (y) => Sx(T(y)), yb + 3, yt + 4, { mat: 'glass', out: 0.25, cols: 4, rowH: far ? 14 : 7 });
  // sky gardens cut into the tower at about 30% and 60% of the height
  for (const [ya, n] of [[curb + 52, 3], [curb + 108, 2]]) {
    for (let i = 0; i < n; i++) kit.terrace(main, ya + i * FLOOR, 0.3, 0.72, { depth: 3 - i * 0.5, vines: 0.6, far });
    if (!far) for (const u of [0.36, 0.5, 0.64]) { const p = main.at(u, 0); kit.ctx.roofTrees.push({ x: p.x + p.nx * 1.5, y: ya + (n - 1) * FLOOR + 0.4, z: p.z + p.nz * 1.5, s: 0.8, trunk: false }); }
  }
  // sky bridges, roof garden, helipad on a round core
  kit.bridgeStub(main, 0.75, curb + 63, 10);
  kit.bridgeStub(main, 0.25, curb + 85, 10);
  kit.roof(crown, { trees: far ? 3 : 8, hedge: true, treeSize: 1.3, far });
  const core = kit.body({ ...base, plan: 'circle', a: 4.2, b: 4.2, y0: yt, y1: yt + 4.5, mat: 'panel', tint: C.light, kind: 0, levels: [[0, 1, 0, a * 0.3, 0], [1, 1, 0, a * 0.3, 0]], steps: 1 });
  kit.roof(core, { helipad: [0, 0] });
  if (!far) {
    kit.slabs(main, { y0: yb + FLOOR, y1: yc, thick: 0.35, grow: 1.012, color: C.light });
    kit.slabs(pod, { y0: curb + 6.3, y1: curb + 6.3, thick: 0.5, grow: 1.12, color: C.white });
    kit.evBays(pod, 0.44, 0.56, 3);
    kit.signOn(pod, 0, curb + 4.2, 5, 1.1, 0.4);
    entrance(kit, s, 34, b + 6, 4);
    kit.contactShadow(pod);
  }
  return { rect: pod.aabb(), top: yt + 6 };
}

// ===========================================================================
// b11 HOURGLASS TOWER
// ===========================================================================
function b11(kit, s) {
  const { curb, C } = kit, far = !!s.far;
  const a = 13.5, H = 140, tint = GLASS_TINTS[5];
  const base = { x: s.x, z: s.z, rot: s.rot, plan: 'soft', a, b: a, tint, bay: 1.5 };
  // concrete ground floor with upright fins and EV chargers
  const ground = kit.body({ ...base, a: a * 0.97, b: a * 0.97, y0: curb, y1: curb + 8, mat: 'panel', tint: C.concrete, kind: 0, rough: 0.85 });
  // the glass tower: narrower toward the middle (waist at 55% of the height)
  const yb = curb + 8, yt = curb + 124;
  const main = kit.body({ ...base, y0: yb, y1: yt, steps: far ? 8 : 14, levels: [[0, 1.0, 0], [0.3, 0.9, 0], [0.55, 0.76, 0], [0.8, 0.88, 0], [1, 0.99, 0]] });
  // the last four floors step back, with terraces and trees
  const t1 = kit.body({ ...base, a: a * 0.88, b: a * 0.88, y0: yt, y1: yt + 8 });
  const t2 = kit.body({ ...base, a: a * 0.74, b: a * 0.74, y0: yt + 8, y1: curb + H });
  kit.roof(main, { hedge: true, trees: far ? 0 : 4, far });
  kit.roof(t1, { hedge: true, trees: far ? 0 : 3, far });
  kit.roof(t2, { trees: far ? 3 : 6, hedge: true, helipad: [1.15, 0.1], treeSize: 1.2, far });
  // the curved solar strip with its white frame
  const Su = (t) => 0.02 + 0.055 * Math.sin(Math.PI * 1.5 * t);
  const T = (y) => (y - yb) / (yt - 26 - yb), hw = 1.6 / main.per;
  kit.patch(main, (y) => Su(T(y)) - hw, (y) => Su(T(y)) + hw, yb + 1, yt - 26, { kind: 4, out: 0.3, color: [1, 1, 1], cols: 2, rowH: 6 });
  kit.ribbon(main, line((t) => Su(t) - hw * 1.25, yb + 1, yt - 26, 10), { w: 0.5, out: 0.42, color: C.white });
  kit.ribbon(main, line((t) => Su(t) + hw * 1.25, yb + 1, yt - 26, 10), { w: 0.5, out: 0.42, color: C.white });
  // white ribs on the back that follow the hourglass shape
  for (const u of [0.42, 0.47, 0.53, 0.58]) kit.ribbon(main, [[u, yb + 1], [u, yb + 40], [u, yb + 80], [u, yt - 1]], { w: 0.45, out: 0.4, color: C.white });
  // garden notches at about 45% and 62% of the height
  kit.terrace(main, curb + 62, 0.08, 0.42, { depth: 2.4, vines: 0.6, far });
  kit.terrace(main, curb + 86, 0.6, 0.94, { depth: 2.4, vines: 0.6, far });
  if (!far) {
    // white floor plates on every floor, fins on the concrete foot
    kit.slabs(main, { y0: yb, y1: yt, thick: 0.34, grow: 1.012, color: C.white });
    kit.slabs(t1, { y0: yt + 4, y1: yt + 8, thick: 0.34, grow: 1.015, color: C.white });
    kit.fins(ground, { every: 2, depth: 0.5, width: 0.5, color: C.concrete });
    kit.evBays(ground, 0.42, 0.58, 3);
    kit.doorOn(ground, 0, 4.5, 3.6, 0);
    kit.signOn(ground, 0, curb + 4.6, 4.5, 1.0, 0.4);
    evPosts(kit, s, -9, 9, a + 2.2, 4);
    kit.contactShadow(ground);
  }
  return { rect: ground.aabb(), top: curb + H };
}

// ===========================================================================
// g01 MACE'S GARAGE (story building)
//   ground floor: an open repair bay (you can walk in) and a small office
//   upper floor:  Nate's flat (a real little room: the story's opening is filmed in it)
// Where things are is also returned as "GARAGE" (in meters, in the world), so
// the story can put people, cameras and props there.
// ===========================================================================
export const GARAGE = { ready: false };
// doors of hero buildings that can be opened (src/interiors/interiors.js): { id, x, z, nx, nz (out of the
// building), w, h, y }. Filled while the city is built.
export { ENTRANCES };
// give a name to the door that kit.doorOn just drew there (the rooms made by hand are found by these names)
function markEntrance(id, sf, u, y, w, h) {
  const p = sf.at(u, y), l = Math.hypot(p.nx, p.nz) || 1;
  const x = p.x + (p.nx / l) * 0.07, z = p.z + (p.nz / l) * 0.07;
  const e = ENTRANCES.find((d) => Math.hypot(d.x - x, d.z - z) < 0.3);
  if (e) e.id = id;
  else ENTRANCES.push({ id, x, z, nx: p.nx / l, nz: p.nz / l, w, h, y, door: 2, district: 'grid', building: '' });
}
function g01(kit, s) {
  const { curb, ctx } = kit;
  const pm = ctx.mb.plaster, ps = ctx.mb.propStatic, tile = CONFIG.textures.plaster.size;
  const fx = Math.sin(s.rot), fz = Math.cos(s.rot), rx = Math.cos(s.rot), rz = -Math.sin(s.rot);   // "front" and "right" as world directions
  const P = (r, y, f) => [s.x + r * rx + f * fx, y, s.z + r * rz + f * fz];
  const letter = (dx, dz) => (dx > 0.5 ? 'w' : dx < -0.5 ? 'e' : dz > 0.5 ? 'n' : 's');
  const SIDE = { F: letter(fx, fz), B: letter(-fx, -fz), R: letter(rx, rz), L: letter(-rx, -rz), T: 't', D: 'b' };
  // a box given in the garage's own directions (r = to the right, f = toward the street). faces: letters of F B R L T D
  const box = (mb, r0, y0, f0, r1, y1, f1, faces = 'FBRLT', t = 1) => {
    const a = P(r0, 0, f0), b = P(r1, 0, f1);
    mb.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), t, [...faces].map((c) => SIDE[c]).join(''));
  };
  // one flat wall piece that is seen from INSIDE a room. n: the direction it faces, as [r, y, f]
  const face = (mb, p0, p1, p2, p3, n, t = tile) => mb.quadAuto(P(...p0), P(...p1), P(...p2), P(...p3), [n[0] * rx + n[2] * fx, n[1], n[0] * rz + n[2] * fz], t);
  const wall = (c, k = 1) => pm.color(c[0] * k, c[1] * k, c[2] * k, 1).data(0, 0, 0, 0);
  const paint = (c, rough = 0.7, metal = 0, glow = 0) => ps.color(c[0], c[1], c[2], 1).data(rough, metal, 0, glow);
  const collide = (r0, f0, r1, f1, h) => { const a = P(r0, 0, f0), b = P(r1, 0, f1); ctx.colliders.boxes.push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h }); };
  const BRICKRED = [0.42, 0.25, 0.2], CONC = [0.5, 0.52, 0.55], DARK = [0.05, 0.055, 0.06], STEEL = [0.2, 0.21, 0.23];
  const y0 = curb, y1 = curb + 4.3, y2 = curb + 7.6, y3 = curb + 8.1;        // floor, ceiling of the bay, roof, top of the roof wall
  const dr0 = -7.4, dr1 = -1.6, dh = curb + 3.5;                              // the big door: from, to, height

  // ---------------- outside ----------------
  wall(BRICKRED);
  box(pm, -9, y0, -7, 9, y3, -6.7, 'BRLT', tile);                              // back
  box(pm, -9, y0, -7, -8.7, y3, 7, 'FBLRT', tile);                              // left side
  box(pm, 8.7, y0, -7, 9, y3, 7, 'FBRLT', tile);                                // right side
  box(pm, -8.7, y0, 6.7, dr0, y3, 7, 'FT', tile);                              // front: left of the door
  box(pm, dr1, y0, 6.7, 8.7, y3, 7, 'FT', tile);                               // front: right of the door (office)
  box(pm, dr0, dh, 6.7, dr1, y3, 7, 'FDT', tile);                              // front: above the door
  wall(CONC, 0.8);
  box(pm, -9, y2, -7, 9, y2 + 0.05, 7, 'T', tile);                            // roof
  // door frame, the rolled-up door, office door and window, the windows of the flat
  paint(STEEL, 0.5, 0.7);
  box(ps, dr0 - 0.12, y0, 6.98, dr0, dh + 0.12, 7.06, 'FRL');
  box(ps, dr1, y0, 6.98, dr1 + 0.12, dh + 0.12, 7.06, 'FRL');
  box(ps, dr0 - 0.12, dh, 6.98, dr1 + 0.12, dh + 0.12, 7.06, 'FDT');
  paint([0.3, 0.31, 0.33], 0.55, 0.6);
  box(ps, dr0, dh - 0.55, 6.6, dr1, dh, 6.95, 'FBD');                         // the roller door, rolled up
  paint(DARK, 0.6, 0.3);
  box(ps, 2.2, y0, 6.98, 3.3, y0 + 2.15, 7.03, 'FRLT');                       // office door
  paint([0.55, 0.4, 0.22], 0.3, 0, 0.32);
  box(ps, 4.4, y0 + 1.1, 6.98, 7.8, y0 + 2.5, 7.02, 'F');                     // office window (lit at night)
  box(ps, 4.1, y1 + 0.95, 6.98, 6.3, y1 + 2.35, 7.02, 'F');                   // the flat's window (lit at night)
  paint([0.06, 0.08, 0.1], 0.1, 0.4);
  for (const r of [-6.4, -1.2]) box(ps, r, y1 + 0.95, 6.98, r + 2.0, y1 + 2.35, 7.02, 'F');   // dark windows
  paint(STEEL, 0.6, 0.5);
  box(ps, 5.6, y2 + 0.05, -4.5, 7.4, y2 + 0.95, -3.0, 'FBRLT');               // air unit on the roof
  // sign board above the door (the name is painted on it by the story props)
  paint([0.07, 0.075, 0.08], 0.6, 0.2);
  box(ps, dr0 + 0.2, dh + 0.35, 7.0, dr1 - 0.2, dh + 1.25, 7.07, 'FRLTD');

  // ---------------- the repair bay (seen from inside) ----------------
  const b0 = -8.7, b1 = 0.7, bf0 = -6.7, bf1 = 6.7;
  wall([0.33, 0.34, 0.36]);
  face(pm, [b0, y0, bf0], [b1, y0, bf0], [b1, y1, bf0], [b0, y1, bf0], [0, 0, 1]);              // back wall
  face(pm, [b0, y0, bf0], [b0, y0, bf1], [b0, y1, bf1], [b0, y1, bf0], [1, 0, 0]);              // left wall
  face(pm, [b1, y0, bf0], [b1, y0, bf1], [b1, y1, bf1], [b1, y1, bf0], [-1, 0, 0]);             // right wall
  face(pm, [b0, y0, bf1], [dr0, y0, bf1], [dr0, y1, bf1], [b0, y1, bf1], [0, 0, -1]);           // inside of the front wall
  face(pm, [dr1, y0, bf1], [b1, y0, bf1], [b1, y1, bf1], [dr1, y1, bf1], [0, 0, -1]);
  face(pm, [dr0, dh, bf1], [dr1, dh, bf1], [dr1, y1, bf1], [dr0, y1, bf1], [0, 0, -1]);
  wall([0.2, 0.2, 0.21]);
  face(pm, [b0, y1, bf0], [b1, y1, bf0], [b1, y1, bf1], [b0, y1, bf1], [0, -1, 0]);             // ceiling
  wall([0.26, 0.26, 0.27]);
  face(pm, [b0, y0 + 0.012, bf0], [b1, y0 + 0.012, bf0], [b1, y0 + 0.012, bf1 + 0.3], [b0, y0 + 0.012, bf1 + 0.3], [0, 1, 0]);   // oil-dark floor
  // two strips of light under the ceiling (always on), light falls out onto the sidewalk
  paint([1.0, 0.9, 0.72], 0.3, 0, 1.75);
  for (const f of [-3.2, 2.6]) box(ps, -6.6, y1 - 0.09, f - 0.07, -1.4, y1 - 0.03, f + 0.07, 'DFB');
  const mid = P(-4, 0, 1.5), out = P(-4.5, 0, 9);
  ctx.shopLights.push({ x: mid[0], z: mid[2], r: 11, power: 1.0 }, { x: out[0], z: out[2], r: 8, power: 0.45 });
  // work bench with a tool box, a board of tools above it
  paint([0.3, 0.2, 0.12], 0.8);
  box(ps, -0.25, y0 + 0.86, -4.2, 0.68, y0 + 0.94, 0.8, 'FBLTD');
  paint(STEEL, 0.6, 0.6);
  for (const f of [-4.1, 0.6]) box(ps, -0.2, y0, f, 0.6, y0 + 0.86, f + 0.1, 'FBL');
  paint([0.6, 0.08, 0.06], 0.45, 0.3);
  box(ps, 0.0, y0 + 0.94, -1.0, 0.5, y0 + 1.22, -0.2, 'FBLT');
  paint([0.12, 0.12, 0.13], 0.8);
  box(ps, 0.62, y0 + 1.25, -3.8, 0.68, y0 + 2.3, 0.4, 'L');
  for (let i = 0; i < 7; i++) { paint(i % 2 ? [0.55, 0.56, 0.58] : [0.7, 0.35, 0.08], 0.4, 0.7); box(ps, 0.56, y0 + 1.45 + (i % 3) * 0.22, -3.5 + i * 0.55, 0.62, y0 + 1.95 + (i % 2) * 0.1, -3.42 + i * 0.55, 'LFBT'); }
  // car lift posts, an oil drum, a stack of tires, shelves at the back
  paint([0.75, 0.55, 0.06], 0.5, 0.4);
  for (const r of [-6.9, -2.1]) box(ps, r - 0.12, y0, 0.9, r + 0.12, y0 + 2.4, 1.2, 'FBRLT');
  const cyl = (rad, h, n = 12) => new THREE.CylinderGeometry(rad, rad, h, n);
  paint([0.08, 0.2, 0.36], 0.55, 0.5);
  ps.add(cyl(0.3, 0.9), ...P(-0.6, y0 + 0.45, 5.6));
  paint([0.03, 0.03, 0.035], 0.9);
  for (let i = 0; i < 4; i++) ps.add(new THREE.TorusGeometry(0.24, 0.11, 6, 14), ...P(-8.1, y0 + 0.12 + i * 0.22, 5.7), [Math.PI / 2, 0, 0]);
  paint(STEEL, 0.6, 0.5);
  for (const y of [0.5, 1.2, 1.9]) box(ps, -4.4, y0 + y, -6.6, 0.5, y0 + y + 0.04, -6.1, 'FBRLTD');
  for (const r of [-4.4, -2.0, 0.44]) box(ps, r, y0, -6.6, r + 0.06, y0 + 2.0, -6.1, 'FRL');
  for (let i = 0; i < 9; i++) { paint([[0.5, 0.1, 0.08], [0.1, 0.25, 0.4], [0.6, 0.55, 0.3], [0.15, 0.15, 0.16]][i % 4], 0.6); box(ps, -4.2 + i * 0.5, y0 + [0.54, 1.24, 1.94][i % 3], -6.5, -3.9 + i * 0.5, y0 + [0.54, 1.24, 1.94][i % 3] + 0.2 + (i % 2) * 0.1, -6.2, 'FRLT'); }
  // ---- THEO'S CAR UNDER A TARP, at the back on the left ----
  // (the cloth itself is a prop, 'tarp' in src/story/props.js, put here by main.js: the story can lift one corner of it)
  {
    const tr = -6.9, tf = -3.9, len = 4.5, wid = 2.0;
    collide(tr - 1.15, tf - len / 2 - 0.1, tr + 1.15, tf + len / 2 + 0.1, 1.3);
    GARAGE.tarpBox = ctx.colliders.boxes[ctx.colliders.boxes.length - 1];   // (taken away when Theo's car can drive out: main.js)
    GARAGE.tarp = P(tr, y0, tf);
    GARAGE.tarpSize = { len, wid, height: 1.3 };
  }

  // ---------------- the office (a closed block) and NATE'S FLAT above it ----------------
  const f0 = 2.0, f1 = 8.5, ff0 = 0.6, ff1 = 6.6, fy0 = y1 + 0.25, fy1 = y2 - 0.25;     // the room: 6.5 m x 6 m x 2.8 m
  wall([0.5, 0.47, 0.42]);
  face(pm, [f0, fy0, ff0], [f1, fy0, ff0], [f1, fy1, ff0], [f0, fy1, ff0], [0, 0, 1]);
  face(pm, [f0, fy0, ff1], [f1, fy0, ff1], [f1, fy1, ff1], [f0, fy1, ff1], [0, 0, -1]);
  face(pm, [f0, fy0, ff0], [f0, fy0, ff1], [f0, fy1, ff1], [f0, fy1, ff0], [1, 0, 0]);
  face(pm, [f1, fy0, ff0], [f1, fy0, ff1], [f1, fy1, ff1], [f1, fy1, ff0], [-1, 0, 0]);
  wall([0.3, 0.29, 0.28]);
  face(pm, [f0, fy1, ff0], [f1, fy1, ff0], [f1, fy1, ff1], [f0, fy1, ff1], [0, -1, 0]);
  paint([0.2, 0.14, 0.09], 0.75);
  face(ps, [f0, fy0, ff0], [f1, fy0, ff0], [f1, fy0, ff1], [f0, fy0, ff1], [0, 1, 0], 1);                 // wooden floor
  // the window to the street (rainy city light), seen from inside
  paint([0.09, 0.13, 0.22], 0.2, 0, 1.1);
  face(ps, [4.1, fy0 + 0.75, ff1 - 0.02], [6.3, fy0 + 0.75, ff1 - 0.02], [6.3, fy0 + 2.15, ff1 - 0.02], [4.1, fy0 + 2.15, ff1 - 0.02], [0, 0, -1], 1);
  paint([0.1, 0.1, 0.11], 0.6, 0.3);
  box(ps, 5.17, fy0 + 0.75, ff1 - 0.06, 5.23, fy0 + 2.15, ff1 - 0.02, 'BRL');
  box(ps, 4.1, fy0 + 1.42, ff1 - 0.06, 6.3, fy0 + 1.48, ff1 - 0.02, 'BTD');
  // THE BED in the back corner (the soft parts are made in src/utils/softShapes.js): a low wooden platform
  // on a dark plinth, a padded headboard against the wall, a mattress with a pale sheet, two puffy pillows
  // (Nate's has a hollow where his head lies) and a quilted blanket that hangs down the open side and the
  // foot, its top edge rolled back. (Nate sleeps on top of the blanket, in his clothes: the story puts him
  // at its height, 0.555 m above the floor.)
  {
    const toWorld = new THREE.Matrix4().makeBasis(new THREE.Vector3(rx, 0, rz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(fx, 0, fz)).setPosition(s.x, 0, s.z);
    const _m = new THREE.Matrix4(), _r = new THREE.Matrix4();
    // a geometry made in the bed's own space (x = toward the right, y up, z = toward the street) put at (r, y, f)
    const put = (g, r, y, f, c, rough = 0.92, rotY = 0, rotX = 0) => {
      paint(c, rough);
      _m.makeRotationY(rotY).multiply(_r.makeRotationX(rotX)).setPosition(r, y, f);
      ps.addGeometry(g, toWorld.clone().multiply(_m));
      g.dispose();
    };
    const wood = [0.16, 0.12, 0.09], top = fy0 + 0.51;
    paint([0.03, 0.03, 0.03], 0.9);
    box(ps, 6.5, fy0, ff0 + 0.15, 8.35, fy0 + 0.07, ff0 + 2.05, 'FBRL');                        // the dark plinth
    paint(wood, 0.75);
    box(ps, 6.4, fy0 + 0.07, ff0 + 0.05, 8.45, fy0 + 0.29, ff0 + 2.15, 'FBRLT');                // the platform
    paint([0.24, 0.18, 0.13], 0.6);
    box(ps, 6.39, fy0 + 0.27, ff0 + 0.04, 8.46, fy0 + 0.3, ff0 + 2.16, 'FBRLT');                // its lighter top edge
    // the headboard: a wooden back, six padded channels, a rail on top
    paint(wood, 0.75);
    box(ps, 6.38, fy0 + 0.3, ff0 + 0.0, 8.47, fy0 + 1.18, ff0 + 0.04, 'FBRLT');
    for (let i = 0; i < 6; i++) put(pillowGeometry(0.33, 0.78, 0.07, { nu: 8, nv: 10, seed: i + 4 }), 6.585 + i * 0.335, fy0 + 0.72, ff0 + 0.04, [0.13, 0.13, 0.145], 0.95, 0, Math.PI / 2);
    paint([0.24, 0.18, 0.13], 0.6);
    box(ps, 6.36, fy0 + 1.16, ff0 - 0.01, 8.49, fy0 + 1.2, ff0 + 0.08, 'FBRLT');
    // the mattress with its sheet
    put(new RoundedBoxGeometry(2.0, 0.21, 2.02, 3, 0.05), 7.425, fy0 + 0.405, ff0 + 1.12, [0.6, 0.6, 0.58]);
    // two pillows on the sheet: Nate's on the wall side (a hollow where his head lies), the other one a little turned
    put(pillowGeometry(0.74, 0.5, 0.2, { dent: [-0.2, 0.13, 0.16, 0.035], seed: 2 }), 8.04, top, ff0 + 0.42, [0.72, 0.72, 0.7]);
    put(pillowGeometry(0.72, 0.48, 0.18, { seed: 5 }), 7.06, top, ff0 + 0.4, [0.7, 0.7, 0.68], 0.92, 0.07);
    // the blanket: from just below the pillows to the foot; it hangs down the open side (toward the room) and the foot
    put(blanketGeometry({ w: 2.0, l: 1.39, drop: [0.2, 0, 0.2], thick: 0.04, seed: 3 }), 7.425, top, ff0 + 0.76, [0.16, 0.2, 0.26], 0.96);
    put(rollGeometry(1.9, 0.04, { seed: 4 }), 7.47, top + 0.035, ff0 + 0.79, [0.25, 0.29, 0.35], 0.95);
  }
  // the shelf on the wall beside the bed (the mixtape and the photo lie on it: story props)
  paint([0.27, 0.19, 0.12], 0.8);
  box(ps, 8.16, fy0 + 1.25, ff0 + 2.5, 8.5, fy0 + 1.29, ff0 + 4.0, 'FBLTD');
  for (let i = 0; i < 5; i++) { paint([[0.35, 0.1, 0.1], [0.12, 0.2, 0.3], [0.5, 0.45, 0.3], [0.1, 0.1, 0.1], [0.25, 0.3, 0.22]][i], 0.8); box(ps, 8.24, fy0 + 1.29, ff0 + 3.45 + i * 0.07, 8.46, fy0 + 1.52 + (i % 2) * 0.03, ff0 + 3.51 + i * 0.07, 'FBLT'); }
  // a small table with a lamp, a chair, the door, a hook for the jacket
  paint([0.22, 0.16, 0.1], 0.8);
  box(ps, 2.2, fy0 + 0.7, ff1 - 1.5, 3.4, fy0 + 0.74, ff1 - 0.5, 'FBRLTD');
  for (const [r, f] of [[2.25, ff1 - 1.45], [3.3, ff1 - 1.45], [2.25, ff1 - 0.6], [3.3, ff1 - 0.6]]) box(ps, r, fy0, f, r + 0.05, fy0 + 0.7, f + 0.05, 'FBRL');
  paint([1.0, 0.72, 0.4], 0.4, 0, 1.6);
  box(ps, 2.45, fy0 + 0.95, ff1 - 1.05, 2.65, fy0 + 1.12, ff1 - 0.85, 'FBRLTD');
  paint(STEEL, 0.5, 0.7);
  box(ps, 2.53, fy0 + 0.74, ff1 - 0.97, 2.57, fy0 + 0.95, ff1 - 0.93, 'FBRL');
  paint([0.09, 0.09, 0.1], 0.7);
  box(ps, f0, fy0, ff0 + 0.5, f0 + 0.05, fy0 + 2.1, ff0 + 1.45, 'R');                                   // the door to the stairs
  paint(STEEL, 0.4, 0.8);
  box(ps, f0, fy0 + 1.7, ff0 + 2.2, f0 + 0.12, fy0 + 1.74, ff0 + 2.24, 'FBRTD');                        // jacket hook

  // ---------------- what is solid ----------------
  collide(-9, -7, 9, -6.7, 8); collide(-9, -7, -8.7, 7, 8);                      // back, left
  collide(0.7, -7, 9, 7, 8);                                                    // the office block
  collide(-8.7, 6.7, dr0, 7, 8); collide(dr1, 6.7, 0.7, 7, 8);                  // front wall beside the door
  collide(-0.25, -4.2, 0.7, 0.8, 1.0);                                          // work bench
  for (const r of [-6.9, -2.1]) { const c = P(r, 0, 1.05); ctx.colliders.circles.push({ x: c[0], z: c[2], r: 0.2 }); }
  { const c = P(-0.6, 0, 5.6); ctx.colliders.circles.push({ x: c[0], z: c[2], r: 0.33 }); const t = P(-8.1, 0, 5.7); ctx.colliders.circles.push({ x: t[0], z: t[2], r: 0.4 }); }

  // the sidewalk in front of the big door stays free (no trees, benches, lamps)
  { const a = P(dr0 - 1.2, 0, 7), b = P(dr1 + 1.2, 0, 11); (ctx.clearZones = ctx.clearZones || []).push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]) }); }

  // ---------------- places for the story ----------------
  Object.assign(GARAGE, {
    ready: true, rot: s.rot, curb,
    at: (r, y, f) => P(r, y, f),                         // any point given in the garage's own directions
    door: P((dr0 + dr1) / 2, y0, 7), bay: P(-4.5, y0, 2.5), mace: P(-2.4, y0, 4.6), stairs: P(-0.4, y0, -5.6),
    doorSize: { r0: dr0, r1: dr1, top: dh },              // the big door: from, to (meters to the right) and its top (height)
    sign: { pos: P((dr0 + dr1) / 2, dh + 0.8, 7.08), width: dr1 - dr0 - 0.6, height: 0.7 },
    van: P(-4.5, 0, 11.3),                               // at the curb in front of the big door
    // the repair bay: the van fits in here (no rain falls inside, drones cannot see in)
    inside: { minX: Math.min(P(b0, 0, bf0)[0], P(b1, 0, bf1)[0]), maxX: Math.max(P(b0, 0, bf0)[0], P(b1, 0, bf1)[0]), minZ: Math.min(P(b0, 0, bf0)[2], P(b1, 0, bf1)[2]), maxZ: Math.max(P(b0, 0, bf0)[2], P(b1, 0, bf1)[2]), top: y1 },
    flat: { floor: fy0, bed: P(8.05, fy0 + 0.555, ff0 + 1.15), bedEdge: P(6.62, fy0 + 0.555, ff0 + 1.4), shelf: P(8.33, fy0 + 1.29, ff0 + 2.9), hook: P(f0 + 0.1, fy0 + 1.55, ff0 + 2.22), lamp: P(2.55, fy0 + 1.05, ff1 - 0.95), middle: P(5, fy0, 3.4), window: P(5.2, fy0 + 1.45, ff1) },
  });
  const a = P(-9, 0, -7), b = P(9, 0, 7);
  return { rect: { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]) }, top: y3, solid: true };
}

// ===========================================================================
// g02 THE OLD CAR PARK (story building, Chapter 2)
//   A two-level concrete car park. The ground floor is open to the street and
//   half of it stands under water (the drains have been blocked for years):
//   dark, mirror-flat water between the columns. The upper level is closed
//   off. Nate's van spends the night in here.
// Places for the story are returned as "PARKING" (meters, in the world).
// ===========================================================================
export const PARKING = { ready: false };
function g02(kit, s) {
  const { curb, ctx } = kit;
  const pm = ctx.mb.plaster, ps = ctx.mb.propStatic, tile = CONFIG.textures.plaster.size;
  const fx = Math.sin(s.rot), fz = Math.cos(s.rot), rx = Math.cos(s.rot), rz = -Math.sin(s.rot);
  const P = (r, y, f) => [s.x + r * rx + f * fx, y, s.z + r * rz + f * fz];
  const letter = (dx, dz) => (dx > 0.5 ? 'w' : dx < -0.5 ? 'e' : dz > 0.5 ? 'n' : 's');
  const SIDE = { F: letter(fx, fz), B: letter(-fx, -fz), R: letter(rx, rz), L: letter(-rx, -rz), T: 't', D: 'b' };
  const box = (mb, r0, y0, f0, r1, y1, f1, faces = 'FBRLT', t = 1) => {
    const a = P(r0, 0, f0), b = P(r1, 0, f1);
    mb.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), t, [...faces].map((c) => SIDE[c]).join(''));
  };
  const face = (mb, p0, p1, p2, p3, n, t = tile) => mb.quadAuto(P(...p0), P(...p1), P(...p2), P(...p3), [n[0] * rx + n[2] * fx, n[1], n[0] * rz + n[2] * fz], t);
  const wall = (c, k = 1) => pm.color(c[0] * k, c[1] * k, c[2] * k, 1).data(0, 0, 0, 0);
  const paint = (c, rough = 0.7, metal = 0, glow = 0) => ps.color(c[0], c[1], c[2], 1).data(rough, metal, 0, glow);
  const collide = (r0, f0, r1, f1, h) => { const a = P(r0, 0, f0), b = P(r1, 0, f1); ctx.colliders.boxes.push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h }); };
  const post = (r, f, rad) => { const c = P(r, 0, f); ctx.colliders.circles.push({ x: c[0], z: c[2], r: rad }); };
  const CONC = [0.46, 0.47, 0.48], CDARK = [0.3, 0.31, 0.32], STEEL = [0.2, 0.21, 0.23];
  const W = 15, D = 12;                                       // half width (along the street), half depth
  const y0 = curb, y1 = curb + 3.1, y1t = y1 + 0.32, y2 = curb + 6.5, y3 = curb + 7.6;   // floor, deck, roof, top of the roof wall

  // ---------------- the concrete body ----------------
  wall(CONC);
  box(pm, -W, y0, -D, W, y3, -D + 0.3, 'BRLT', tile);                         // back wall (to the neighbours)
  box(pm, -W, y0, -D, -W + 0.3, y3, D, 'FBLRT', tile);                         // left side
  box(pm, W - 0.3, y0, -D, W, y3, D, 'FBRLT', tile);                           // right side
  wall(CONC, 0.92);
  box(pm, -W, y1, -D, W, y1t, D, 'FD', tile);                                  // the upper deck (its edge and underside)
  box(pm, -W, y1t, D - 0.3, W, y1t + 1.15, D, 'FBT', tile);                   // the low wall along the upper deck
  box(pm, -W, y2, -D, W, y2 + 0.3, D, 'FTD', tile);                            // roof deck
  box(pm, -W, y2 + 0.3, D - 0.3, W, y3, D, 'FBT', tile);                       // the roof wall
  // a stair tower at the right front corner
  wall(CDARK);
  box(pm, W - 4.6, y0, D - 4.2, W - 0.3, y3 + 1.6, D, 'FLT', tile);
  paint([0.06, 0.065, 0.07], 0.6, 0.3);
  box(ps, W - 3.6, y0, D + 0.01, W - 2.5, y0 + 2.1, D + 0.05, 'FRLT');         // its steel door
  // columns: the street side (between them the cars drive in) and inside
  wall([0.52, 0.52, 0.51]);
  for (const r of [-11.3, -3.8, 3.8]) {
    box(pm, r - 0.3, y0, D - 0.6, r + 0.3, y1, D, 'FBRL', tile); post(r, D - 0.3, 0.42);
    for (const f of [-4.8, 2.4]) { box(pm, r - 0.3, y0, f - 0.3, r + 0.3, y1, f + 0.3, 'FBRL', tile); post(r, f, 0.42); }
  }
  // yellow-and-black bands on the columns (old, dull), the level number
  paint([0.6, 0.48, 0.08], 0.75);
  for (const r of [-11.3, -3.8, 3.8]) for (const f of [-4.8, 2.4, D - 0.3]) box(ps, r - 0.31, y0 + 0.2, f - 0.31, r + 0.31, y0 + 0.75, f + 0.31, 'FBRL');
  paint([0.85, 0.85, 0.8], 0.6);
  for (const r of [-11.3, -3.8, 3.8]) box(ps, r - 0.16, y0 + 1.55, -4.8 + 0.31, r + 0.16, y0 + 1.95, -4.8 + 0.32, 'F');

  // ---------------- inside: ceiling, floor, the flood ----------------
  wall([0.2, 0.2, 0.21]);
  face(pm, [-W + 0.3, y1 - 0.01, -D + 0.3], [W - 0.3, y1 - 0.01, -D + 0.3], [W - 0.3, y1 - 0.01, D], [-W + 0.3, y1 - 0.01, D], [0, -1, 0]);
  wall([0.24, 0.24, 0.245]);
  face(pm, [-W + 0.3, y0 + 0.012, -D + 0.3], [W - 0.3, y0 + 0.012, -D + 0.3], [W - 0.3, y0 + 0.012, D + 0.4], [-W + 0.3, y0 + 0.012, D + 0.4], [0, 1, 0]);
  // white bay lines (half of them under water)
  paint([0.62, 0.62, 0.6], 0.8);
  for (let i = 0; i <= 9; i++) {
    const r = -W + 1.2 + i * 2.75;
    if (r > W - 4.8) break;
    box(ps, r - 0.05, y0 + 0.014, -D + 0.6, r + 0.05, y0 + 0.02, -D + 5.6, 'T');
    box(ps, r - 0.05, y0 + 0.014, D - 6.4, r + 0.05, y0 + 0.02, D - 1.4, 'T');
  }
  // THE WATER: flat, black, a mirror. Blobs of water with ragged edges, joined in the middle.
  paint([0.012, 0.014, 0.017], 0.02, 0.0);
  const blob = (cr, cf, rad, seed) => {
    const n = 22, ring = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = 1 + 0.22 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 7 + seed * 2.1);
      ring.push([Math.max(-W + 0.35, Math.min(W - 0.35, cr + Math.cos(a) * rad * 1.5 * k)), y0 + 0.03, Math.max(-D + 0.35, Math.min(D - 0.7, cf + Math.sin(a) * rad * k))]);
    }
    for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n], c = [cr, y0 + 0.03, cf]; face(ps, c, a, b, c, [0, 1, 0], 1); }
  };
  blob(-7.5, -5.5, 5.2, 0.3); blob(2.5, -4.6, 5.6, 1.7); blob(-2.0, 1.2, 4.2, 2.9); blob(8.5, -1.0, 3.4, 4.2);
  // a few things left behind: a shopping cart on its side, a pallet, a broken barrier arm, cones
  paint(STEEL, 0.5, 0.7);
  box(ps, -13.2, y0, 6.2, -12.4, y0 + 0.9, 7.2, 'FBRLT');
  paint([0.35, 0.25, 0.14], 0.9);
  box(ps, 9.6, y0, 6.4, 10.8, y0 + 0.14, 7.6, 'FBRLT');
  paint([0.75, 0.75, 0.72], 0.6);
  box(ps, -2.6, y0 + 0.02, D - 2.2, 0.8, y0 + 0.1, D - 2.08, 'FBRLT');
  paint([0.8, 0.3, 0.05], 0.6);
  for (const [r, f] of [[-0.4, 8.6], [0.9, 9.1]]) ps.add(new THREE.ConeGeometry(0.17, 0.5, 8), ...P(r, y0 + 0.25, f));
  // the closed ramp to the upper level, at the back left: a barrier and a sign
  wall(CDARK);
  box(pm, -W + 0.3, y0, -D + 0.3, -W + 4.6, y1 - 0.2, -D + 0.6, 'FRT', tile);
  paint([0.85, 0.12, 0.08], 0.6);
  box(ps, -W + 0.4, y0 + 0.9, -D + 3.2, -W + 4.4, y0 + 1.1, -D + 3.3, 'FBRLTD');
  paint(STEEL, 0.6, 0.5);
  for (const r of [-W + 0.5, -W + 4.3]) box(ps, r - 0.05, y0, -D + 3.2, r + 0.05, y0 + 1.0, -D + 3.3, 'FBRL');
  collide(-W + 0.3, -D + 0.3, -W + 4.6, -D + 3.35, 1.2);
  // tube lights under the deck (two are dead), an EXIT light at the street
  paint([0.85, 0.95, 1.0], 0.3, 0, 1.45);
  for (const [r, f] of [[-7.5, -7.5], [0, -7.5], [7.5, -1.2], [-7.5, 5.0], [0, 5.0]]) box(ps, r - 1.1, y1 - 0.1, f - 0.06, r + 1.1, y1 - 0.04, f + 0.06, 'DFB');
  paint([0.1, 0.11, 0.12], 0.5, 0.3);
  for (const [r, f] of [[-7.5, -1.2], [7.5, -7.5]]) box(ps, r - 1.1, y1 - 0.1, f - 0.06, r + 1.1, y1 - 0.04, f + 0.06, 'DFB');
  paint([0.15, 1.0, 0.45], 0.3, 0, 1.6);
  box(ps, -1.0, y1 - 0.45, D - 0.62, 1.0, y1 - 0.12, D - 0.6, 'F');
  const lit = P(0, 0, -1), lit2 = P(-7, 0, 4);
  ctx.shopLights.push({ x: lit[0], z: lit[2], r: 13, power: 0.55 }, { x: lit2[0], z: lit2[2], r: 9, power: 0.4 });
  // a big "P" sign on the corner of the roof (blue, lit at night)
  paint([0.08, 0.28, 0.75], 0.4, 0.1, 0.9);
  box(ps, -W + 0.6, y3 - 0.1, D + 0.02, -W + 2.6, y3 + 2.0, D + 0.12, 'FRLT');
  paint([0.95, 0.95, 0.95], 0.4, 0, 0.9);
  box(ps, -W + 1.1, y3 + 0.15, D + 0.12, -W + 1.35, y3 + 1.75, D + 0.15, 'F');
  box(ps, -W + 1.1, y3 + 1.5, D + 0.12, -W + 2.1, y3 + 1.75, D + 0.15, 'F');
  box(ps, -W + 1.1, y3 + 0.95, D + 0.12, -W + 2.1, y3 + 1.2, D + 0.15, 'F');
  box(ps, -W + 1.85, y3 + 0.95, D + 0.12, -W + 2.1, y3 + 1.75, D + 0.15, 'F');

  // ---------------- what is solid ----------------
  collide(-W, -D, W, -D + 0.3, y3); collide(-W, -D, -W + 0.3, D, y3); collide(W - 0.3, -D, W, D, y3);
  collide(W - 4.6, D - 4.2, W, D, y3 + 1.6);                                // the stair tower
  collide(-13.2, 6.2, -12.4, 7.2, 0.9);
  // the sidewalk in front of the entrance stays free
  { const a = P(-W + 1, 0, D), b = P(W - 5, 0, D + 3.2); (ctx.clearZones = ctx.clearZones || []).push({ minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]) }); }

  // ---------------- places for the story ----------------
  const a = P(-W, 0, -D), b = P(W, 0, D);
  Object.assign(PARKING, {
    ready: true, rot: s.rot, curb,
    at: (r, y, f) => P(r, y, f),
    van: P(6.83, 0, -8.6),                   // the van's bay: in the water, at the back (nose toward the street)
    exit: P(0, 0, D + 4),                    // on the street in front of the entrance
    // inside (no rain falls here, drones cannot see in)
    inside: { minX: Math.min(a[0], b[0]) + 0.3, maxX: Math.max(a[0], b[0]) - 0.3, minZ: Math.min(a[2], b[2]) + 0.3, maxZ: Math.max(a[2], b[2]) - 0.3, top: y1 },
  });
  return { rect: { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]) }, top: y3, solid: true };
}

const BUILDERS = { b01, b02, b03, b04, b05, b06, b07, b08, b09, b10, b11, g01, g02 };

// Build one hero. Returns { rect, top } and adds its collision box.
export function buildHero(kit, id, site) {
  const out = BUILDERS[id](kit, site);
  if (!site.far) {
    if (!out.solid) kit.collide(out.rect, out.top);
    kit.finish({ ...out.rect, top: out.top, floors: Math.round(out.top / FLOOR), mat: 'hero', playable: true, type: id, hero: true });
  }
  return out;
}
