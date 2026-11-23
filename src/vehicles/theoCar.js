// ---------------------------------------------------------------------------
// theoCar.js - THEO'S CAR, made in code (when assets/vehicles/theo_car.glb is not there).
//
// A low two-door sports coupe from before the city went quiet and electric: a long hood, a short fastback roof,
// wide hips over the rear wheels, four round headlights, a small lip on the tail, a thin chrome blade on each
// bumper. Deep blue paint, scratched, dusty after four years under a cloth, a white racing roundel with Theo's
// number 7 on each door.
//
// It is made so that Chapter 6 can repair it part by part (src/story/repair.js):
//   * the left front corner is pushed in by the crash (bend 1) and is pulled straight (bend 0)
//   * the old front bumper hangs down, cracked; a new one goes on
//   * the hood opens; the round air cleaner is put on the engine
//   * two wires of the headlights are joined: the lights come on
//   * the dashboard gets its tape deck (the last part)
//   * the dust goes away part by part (dirt 1 .. 0)
// and so that it can be a car the player drives later (vehicle.js: kind 'theo_coupe').
//
// Car space (like every vehicle of the game): +z is the nose, +x the car's LEFT side, y up, the ground is y = 0.
// The body is "lofted": cross-sections from the tail to the nose, each a curve from the middle of the floor out
// over the sill, up the side and over the top to the middle of the hood. Where a wheel is, the side stops above
// it (the wheel arch) and a dark well goes in. The roof and the glass are a second loft on top.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeDetailedWheel } from './wheelDetail.js';

// ---- the sizes (meters) ----
const FRONT = 2.13, BACK = -2.21;               // the nose and the tail
const ZF = 1.29, ZR = -1.25;                    // front and rear axle
const WR = 0.318, ARCH = 0.405, TRACK = 0.78;   // wheel radius, arch radius, the middle of a wheel from the middle of the car
const TYRE_W = 0.235;
const WS = 0.52, RB = -1.12;                    // the bottom of the windshield, of the rear window
const HOOD0 = 0.575;                            // the back edge of the hood (the cowl is between it and the windshield)
const XIN = 0.585;                              // the inner wall of a wheel well
export const THEO_INFO = {
  length: FRONT - BACK, halfWidth: 0.905, boxHalfWidth: 0.9, roof: 1.22, wheelR: WR, wheelX: TRACK, wheelZ: [ZR, ZF],
  wheels: { wheel_fl: [TRACK, WR, ZF], wheel_fr: [-TRACK, WR, ZF], wheel_rl: [TRACK, WR, ZR], wheel_rr: [-TRACK, WR, ZR] },
  door: { z0: -0.6, z1: 0.44, y0: 0.3, y1: 0.98 },
  seat: { x: 0.37, y: 0.36, z: -0.38 },
  backZ: BACK, frontZ: FRONT,
};
// where things are in the car (for the story's cameras and for the repair stations)
export const THEO_SPOTS = {
  corner: [0.82, 0.55, 1.86],            // the bent left front corner
  bumper: [0, 0.31, FRONT + 0.02],       // the middle of the front bumper
  engine: [0.0, 0.76, 1.08],             // the top of the air cleaner on the engine
  wires: [0.52, 0.62, 1.82],             // the plug of the left headlights, behind them in the engine bay
  deck: [0.0, 0.6, 0.2],                 // the tape deck slot in the dashboard
  eye: [0.37, 1.02, -0.42],              // the driver's eyes
  roof: [0.25, 1.215, -0.25],            // a hand on the roof
};

// ---- small helpers ----
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// a smooth curve through [[z, value], ...] (Catmull-Rom with uneven spacing, flat at the ends)
function curve(keys) {
  const n = keys.length;
  return (z) => {
    if (z <= keys[0][0]) return keys[0][1];
    if (z >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (z > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
    const h = p2[0] - p1[0], t = (z - p1[0]) / h, t2 = t * t, t3 = t2 * t;
    const m1 = i > 0 ? ((p2[1] - p0[1]) / (p2[0] - p0[0])) * h : 0;
    const m2 = i + 2 < n ? ((p3[1] - p1[1]) / (p3[0] - p1[0])) * h : 0;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

// ---- the shape of the lower body, seen from the side (heights) and from above (half widths) ----
const FLOOR = curve([[BACK, 0.31], [-1.96, 0.21], [-1.62, 0.17], [1.62, 0.165], [1.94, 0.2], [FRONT, 0.27]]);
const SILL = curve([[BACK, 0.34], [-1.92, 0.28], [-1.5, 0.255], [1.5, 0.25], [1.9, 0.265], [FRONT, 0.33]]);
const SHOULDER = curve([[BACK, 0.7], [-1.62, 0.725], [-1.0, 0.705], [0, 0.675], [0.8, 0.672], [1.45, 0.666], [1.95, 0.615], [FRONT, 0.56]]);
const BELT = curve([[BACK, 0.815], [-1.65, 0.842], [-1.05, 0.83], [-0.2, 0.8], [0.52, 0.79], [1.3, 0.735], [1.95, 0.655], [FRONT, 0.6]]);
// the middle line of the top: the rear deck and the tail lip, and the hood falling to the nose
const TOP = curve([[BACK, 0.845], [-2.12, 0.872], [-1.85, 0.868], [-1.4, 0.866], [RB, 0.87], [WS, 0.812], [0.85, 0.79], [1.3, 0.752], [1.7, 0.705], [2.0, 0.65], [FRONT, 0.6]]);
const CROWN = curve([[BACK, 0.004], [-1.4, 0.018], [RB, 0.02], [WS, 0.022], [1.2, 0.03], [1.9, 0.018], [FRONT, 0.008]]);
// half widths: the shoulder (with the hips over the wheels), the rest follows it
const bump = (z, at, w, h) => h * Math.exp(-((z - at) * (z - at)) / (2 * w * w));
const SH_W = (z) => 0.872 + bump(z, ZR, 0.42, 0.034) + bump(z, ZF, 0.4, 0.019);
// the plan view of the ends: rounded corners (a "squircle": flat in front, round at the corners)
function endScale(z) {
  const f = FRONT - 0.3, b = BACK + 0.3;
  if (z > f) { const t = clamp((z - f) / (FRONT - f), 0, 1); return Math.pow(1 - Math.pow(t, 3.2), 1 / 3.2); }
  if (z < b) { const t = clamp((b - z) / (b - BACK), 0, 1); return Math.pow(1 - Math.pow(t, 3.0), 1 / 3.0); }
  return 1;
}
// where the surface of the nose (dir 1) or of the tail (dir -1) is, at this distance from the middle (plan view)
function endZ(x, dir) {
  const n = dir > 0 ? 3.2 : 3.0, W = SH_W(dir > 0 ? FRONT - 0.15 : BACK + 0.15) - 0.01;
  const s = clamp(x / W, 0, 0.999), t = Math.pow(1 - Math.pow(s, n), 1 / n);
  return dir > 0 ? FRONT - 0.3 + 0.3 * t : BACK + 0.3 - 0.3 * t;
}
// the arch over a wheel at this z (null: no arch here). side = which side of the edge (the edge itself is in both)
function archAt(z, inside) {
  for (const zw of [ZF, ZR]) {
    const dz = z - zw;
    if (Math.abs(dz) < ARCH - 1e-6 || (inside && Math.abs(Math.abs(dz) - ARCH) < 1e-6)) return WR + Math.sqrt(Math.max(0, ARCH * ARCH - dz * dz));
  }
  return null;
}

// THE CLOTH (Chapter 6) lies over the car: how high the top of the car is at x (from the middle, either side) and z,
// how wide the car is there, and how high its shoulder is (where the cloth starts to hang down)
export function theoCover(x, z) {
  const zz = clamp(z, BACK + 0.02, FRONT - 0.02);
  const hw = SH_W(zz) * endScale(zz), belt = BELT(zz), top = TOP(zz) + CROWN(zz);
  const xe = Math.min(1, x / Math.max(0.05, hw - 0.09));
  let y = lerp(top, belt, xe * xe);
  if (zz > RB && zz < WS) {
    // the roof over the cabin
    const H = ROOF(zz), wR = 0.6, wB = SH_W(zz) - 0.104;
    const k = clamp((x - wR * 0.85) / Math.max(0.05, wB - wR * 0.85), 0, 1);
    y = Math.max(y, lerp(H, belt + 0.01, k * k));
  }
  return { y: Math.max(y, 0.3), halfWidth: hw, edgeY: SHOULDER(zz) };
}

// the cross-section of the lower body at z: points [x, y] of the left half, from the middle of the floor to the
// middle of the top. inArch: this section is on the wheel side of an arch edge. part: 'deck' | 'cabin' | 'cowl' | 'hood'
const NP = 18;                         // points in one half section
const I_BELT = 11, I_EDGE = 13;        // the belt line (top of the side) and the edge where the top begins
function lowerSection(z, inArch, part) {
  const e = endScale(z);
  const floor = FLOOR(z), sill = SILL(z), sh = SHOULDER(z), belt = BELT(z), top = TOP(z), crown = CROWN(z);
  const wSh = SH_W(z) * e, arch = inArch ? archAt(z, true) : null;
  const bottom = arch !== null ? Math.max(sill, arch) : sill;
  const wSill = (arch !== null ? wSh - 0.012 : wSh - 0.062) ;
  const wLow = wSh - 0.022 * e, wBelt = wSh - 0.034 * e, wEdge = wBelt - 0.058 * e;
  const xin = Math.min(XIN * e, wSill - 0.06);
  const wellTop = arch !== null ? arch + 0.012 : floor;
  // (the side: a soft S from the sill out to the shoulder crease, then in a little to the belt)
  const mid = lerp(bottom, sh, 0.5);
  const pts = [
    [0, floor], [xin * 0.55, floor], [xin, floor], [xin, wellTop],
    [wSill, bottom + 0.004], [lerp(wSill, wLow, 0.7), lerp(bottom, mid, 0.35)], [wLow, mid], [lerp(wLow, wSh, 0.75), lerp(mid, sh, 0.7)],
    [wSh, sh], [wSh - 0.006 * e, lerp(sh, belt, 0.4)], [lerp(wSh, wBelt, 0.75), lerp(sh, belt, 0.8)],
    [wBelt, belt],
  ];
  if (part === 'cabin') {
    // only a narrow shelf under the glass (the inside of the car is open to the roof)
    const shelfX = wBelt - 0.07 * e;
    pts.push([lerp(wBelt, shelfX, 0.5), belt + 0.006], [shelfX, belt + 0.004]);
    while (pts.length < NP) pts.push([shelfX, belt + 0.004]);
  } else {
    // the round edge from the side over to the top, then the top to the middle (a slight crown)
    const edgeY = lerp(belt, top, 0.72);
    pts.push([wBelt - 0.022 * e, lerp(belt, edgeY, 0.6)], [wEdge, edgeY], [wEdge * 0.86, top - 0.002], [wEdge * 0.62, top + crown * 0.45], [wEdge * 0.32, top + crown * 0.85], [0, top + crown]);
  }
  return pts;
}

// the sections along the car, in runs: within a run neighbouring sections share their points (smooth); between
// two runs the shape jumps (the edge of an arch, the bottom of the windshield) and a separate strip joins them
function lowerRuns() {
  const edges = [BACK, ZR - ARCH, RB, ZR + ARCH, WS, ZF - ARCH, ZF + ARCH, FRONT];
  const runs = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const z0 = edges[k], z1 = edges[k + 1], zs = [];
    const step = 0.045, n = Math.max(2, Math.ceil((z1 - z0) / step));
    for (let i = 0; i <= n; i++) {
      // (finer near the ends of the car, where the corners round off)
      let t = i / n;
      const zz = z0 + (z1 - z0) * t;
      zs.push(zz);
    }
    // more sections in the last 0.3 m of the nose and the tail (the corners round there)
    const extra = [];
    if (z1 === FRONT) for (let i = 1; i < 10; i++) extra.push(FRONT - 0.3 * Math.pow(i / 10, 1.6));
    if (z0 === BACK) for (let i = 1; i < 10; i++) extra.push(BACK + 0.3 * Math.pow(i / 10, 1.6));
    const all = [...new Set([...zs, ...extra])].sort((a, b) => a - b);
    const mid = (z0 + z1) / 2;
    const inArch = archAt(mid, false) !== null;
    // (between the bottom of the rear window and the bottom of the windshield the inside of the car is open)
    const part = mid > RB && mid < WS ? 'cabin' : 'full';
    runs.push({ zs: all, inArch, part });
  }
  return runs;
}

// one grid of points (sections x points) -> an indexed geometry of the LEFT half; skip(i, j) leaves a face out.
// The right half is the mirror image (made by the caller).
function gridGeometry(sections, skip, color) {
  const S = sections.length, N = sections[0].pts.length;
  const pos = new Float32Array(S * N * 3), col = new Float32Array(S * N * 3);
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < N; j++) {
      const [x, y] = sections[i].pts[j];
      const o = (i * N + j) * 3;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = sections[i].z;
      const c = color(i, j);
      col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];
    }
  }
  const idx = [];
  for (let i = 0; i < S - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      if (skip && skip(i, j)) continue;
      const a = i * N + j, b = i * N + j + 1, c = (i + 1) * N + j + 1, d = (i + 1) * N + j;
      // (seen from outside: the points go up the section, the sections go toward the nose)
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (a point on the middle line: its normal has no sideways part, so the two halves meet without a crease)
  const p = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 1e-5) { const ny = nrm.getY(i), nz = nrm.getZ(i), l = Math.hypot(ny, nz) || 1; nrm.setXYZ(i, 0, ny / l, nz / l); }
  return g;
}
// the mirror image of a left half (x -> -x, the faces turned round)
function mirrored(g) {
  const m = g.clone();
  const p = m.attributes.position, n = m.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); n.setX(i, -n.getX(i)); }
  const ix = m.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  return m;
}
// put several geometries together (positions, normals, colors; no index)
function merge(list) {
  let n = 0;
  for (const g of list) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const p = g.attributes.position, q = g.attributes.normal, c = g.attributes.color;
    const count = g.index ? g.index.count : p.count;
    for (let k = 0; k < count; k++) {
      const i = g.index ? g.index.array[k] : k;
      pos[o * 3] = p.getX(i); pos[o * 3 + 1] = p.getY(i); pos[o * 3 + 2] = p.getZ(i);
      nor[o * 3] = q.getX(i); nor[o * 3 + 1] = q.getY(i); nor[o * 3 + 2] = q.getZ(i);
      if (c) { col[o * 3] = c.getX(i); col[o * 3 + 1] = c.getY(i); col[o * 3 + 2] = c.getZ(i); } else { col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = 1; }
      o++;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const both = (g) => [g, mirrored(g)];

// ---- THE LOWER BODY: the shell without the hood (the hood is its own part) ----
const PAINT_C = [1, 1, 1], UNDER_C = [0.035, 0.035, 0.04];
function makeLowerBody() {
  const runs = lowerRuns();
  const parts = [];
  // under the car and in the wheel wells: dark; the rest: paint
  const color = (sections) => (i, j) => (j <= 3 ? UNDER_C : PAINT_C);
  let prev = null;
  for (const r of runs) {
    const sections = r.zs.map((z) => ({ z, pts: lowerSection(z, r.inArch, r.part) }));
    // (the hood's own faces are not part of the body; the open cabin has no top)
    const zc = (i) => (sections[i].z + sections[i + 1].z) / 2;
    const skip = (i, j) => (zc(i) > HOOD0 && j >= I_EDGE) || (r.part === 'cabin' && j >= I_BELT + 2);
    parts.push(...both(gridGeometry(sections, skip, color(sections))));
    // the strip that joins this run to the one before it (the same z, two shapes)
    if (prev) {
      const z = sections[0].z;
      const a = prev.sections[prev.sections.length - 1], b = sections[0];
      const strip = [{ z: z - 0.0005, pts: a.pts }, { z: z + 0.0005, pts: b.pts }];
      // (at the bottom of the windshield and of the rear window the strip is a wall from the shelf up to the top)
      const skipS = (i, j) => (z > HOOD0 && j >= I_EDGE) || (r.part === 'cabin' && prev.part === 'cabin' && j >= I_BELT + 2);
      parts.push(...both(gridGeometry(strip, skipS, color(strip))));
    }
    prev = { sections, part: r.part };
  }
  return merge(parts);
}

// ---- THE HOOD: the top of the front, from the cowl to the nose, a few centimeters thick ----
function makeHood() {
  const zs = [];
  for (let z = HOOD0; z < FRONT - 0.001; z += 0.045) zs.push(z);
  for (let i = 1; i < 10; i++) zs.push(FRONT - 0.3 * Math.pow(i / 10, 1.6));
  zs.push(FRONT - 0.004);
  const list = [...new Set(zs)].sort((a, b) => a - b);
  const top = list.map((z) => {
    const pts = lowerSection(z, false, 'hood').slice(I_EDGE);
    // (a hair inside the fender edge: the gap between hood and fender)
    pts[0] = [pts[0][0] - 0.006, pts[0][1] - 0.003];
    return { z, pts };
  });
  // the underside: the same shape 3 cm lower, facing down (dark)
  const under = top.map((s) => ({ z: s.z, pts: s.pts.map(([x, y]) => [x * 0.985, y - 0.03]).reverse() }));
  const gTop = gridGeometry(top, null, () => PAINT_C);
  const gUnder = gridGeometry(under, null, () => [0.05, 0.05, 0.055]);
  return merge([...both(gTop), ...both(gUnder)]);
}

// ---- THE GREENHOUSE: the roof, the pillars and the glass ----
// heights of the top line (the windshield rising, the roof, the fastback falling to the deck)
const ROOF = curve([[RB, 0.872], [-1.0, 0.95], [-0.82, 1.06], [-0.6, 1.165], [-0.38, 1.212], [-0.12, 1.218], [0.05, 1.2], [0.2, 1.1], [0.38, 0.95], [WS, 0.815]]);
const DLO_BACK = -0.74, DLO_FRONT = 0.4;       // the side windows: from, to
const ROOF_BACK = -0.55, ROOF_FRONT = 0.06;     // the painted roof: from, to (the rest of the top is glass)
function ghSection(z) {
  const belt = BELT(z), H = Math.max(ROOF(z), belt + 0.01);
  const wB = SH_W(z) - 0.034 - 0.07;            // the bottom of the glass: on the shelf
  const k = smooth(RB, RB + 0.5, z) * smooth(WS, WS - 0.35, z);
  const wR = lerp(wB - 0.02, 0.6, k);          // the roof edge: in (tumblehome)
  const h = H - belt;
  return [
    [wB, belt + 0.003], [lerp(wB, wR, 0.38) + 0.012, belt + h * 0.42], [lerp(wB, wR, 0.82) + 0.006, belt + h * 0.86],
    [wR, H - 0.032 * k], [wR * 0.88, H - 0.012 * k], [wR * 0.5, H - 0.002], [0, H],
  ];
}
function makeGreenhouse() {
  const zs = new Set();
  for (let z = RB; z <= WS + 1e-6; z += 0.04) zs.add(+z.toFixed(4));
  for (const z of [RB, WS, DLO_BACK, DLO_FRONT, ROOF_BACK, ROOF_FRONT, -0.24, -0.2]) zs.add(z);
  const list = [...zs].sort((a, b) => a - b);
  const sections = list.map((z) => ({ z, pts: ghSection(z) }));
  // which faces are glass: the sides between the pillars, the top in front of and behind the roof
  const glassFace = (i, j) => {
    const z = (sections[i].z + sections[i + 1].z) / 2;
    if (j <= 1) return z > DLO_BACK && z < DLO_FRONT && !(z > -0.24 && z < -0.2);
    if (j >= 3) return z > ROOF_FRONT || z < ROOF_BACK;
    return false;
  };
  const paint = gridGeometry(sections, (i, j) => glassFace(i, j), () => PAINT_C);
  const glass = gridGeometry(sections, (i, j) => !glassFace(i, j), () => [1, 1, 1]);
  return { paint: merge(both(paint)), glass: merge(both(glass)) };
}

// FEWER DRAW CALLS: every mesh under "group" (also in groups below it, except the ones in "keep") is put into one
// mesh per material, with its place relative to "group" baked in. A phone draws the car in about 25 calls, not 110.
function flatten(group, keep = []) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map(), drop = [];
  const walk = (o) => {
    for (const c of o.children) {
      if (keep.includes(c)) continue;
      if (c.isMesh && c.visible) {
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        const n = g.attributes.position.count;
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
        if (g.attributes.color.itemSize !== 3) { const a = g.attributes.color, c3 = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c3[i * 3] = a.getX(i); c3[i * 3 + 1] = a.getY(i); c3[i * 3 + 2] = a.getZ(i); } g.setAttribute('color', new THREE.BufferAttribute(c3, 3)); }
        if (!byMat.has(c.material)) byMat.set(c.material, { list: [], cast: false, order: c.renderOrder });
        const e = byMat.get(c.material);
        e.list.push(g); e.cast = e.cast || c.castShadow;
        drop.push(c);
      } else if (!c.isMesh) walk(c);
    }
  };
  walk(group);
  for (const c of drop) c.parent.remove(c);
  // (empty groups left behind are taken away too)
  const prune = (o) => { for (const c of [...o.children]) { if (keep.includes(c)) continue; if (!c.isMesh) { prune(c); if (!c.children.length) o.remove(c); } } };
  prune(group);
  const out = [];
  for (const [mat, e] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(e.list), mat);
    m.castShadow = e.cast; m.receiveShadow = true; m.renderOrder = e.order;
    group.add(m);
    out.push(m);
    for (const g of e.list) g.dispose();
  }
  return out;
}

// ======================================================================= materials
// THE PAINT: deep blue under a clear coat; scratched; dusty (dirt), with the racing roundels on the doors and
// thin dark lines where the panels meet. bend (0..1) pushes the left front corner in, with creases.
export function makeTheoPaint(env = null) {
  const U = {
    uDirt: { value: 1 }, uBend: { value: 1 }, uScratch: { value: 1 }, uClean: { value: 0 },
    uDecal: { value: makeRoundel() },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(0.028, 0.09, 0.24), vertexColors: true, roughness: 0.32, metalness: 0.45,
    clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 1.0,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uBend;
varying vec3 vCarPos;
varying vec3 vCarN;
${BEND_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = pgBend( transformed, uBend );
vCarPos = transformed;
vCarN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uDirt, uScratch, uClean;
uniform sampler2D uDecal;
varying vec3 vCarPos;
varying vec3 vCarN;
${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float pgPaint = smoothstep( 0.2, 0.6, vColor.g );
vec3 cp = vCarPos;
vec3 cn = normalize( vCarN );
// the racing roundel on each door: a white circle with a black 7
if ( abs( cn.x ) > 0.55 && pgPaint > 0.5 ) {
  vec2 duv = vec2( ( cp.z + 0.06 ) * -sign( cp.x ), cp.y - 0.53 ) / 0.42 + 0.5;
  if ( duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0 ) {
    vec4 dc = texture2D( uDecal, duv );
    diffuseColor.rgb = mix( diffuseColor.rgb, dc.rgb, dc.a );
  }
}
// thin dark lines where the panels meet: the doors, the trunk lid
float gapLine = 0.0;
if ( abs( cn.x ) > 0.4 && cp.y > 0.3 && cp.y < 0.97 ) gapLine = max( 1.0 - smoothstep( 0.0012, 0.0032, abs( cp.z - 0.44 ) ), 1.0 - smoothstep( 0.0012, 0.0032, abs( cp.z + 0.6 ) ) );
if ( cn.y > 0.3 && cp.z < -1.1 ) gapLine = max( gapLine, max( 1.0 - smoothstep( 0.0012, 0.0032, abs( cp.z + 1.17 ) ), 1.0 - smoothstep( 0.0012, 0.0032, abs( abs( cp.x ) - 0.74 ) ) * step( cp.z, -1.17 ) * step( -2.17, cp.z ) ) );
diffuseColor.rgb *= 1.0 - 0.85 * gapLine * pgPaint;
// scratches: fine bright lines in many directions, more on the left side (the night of the crash) and at the
// corners, through the paint to the grey primer
float scr = pgScratches( cp ) * uScratch * pgPaint;
scr = max( scr, pgScrape( cp ) * uScratch * pgPaint );
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.42, 0.43, 0.45 ), scr );
// dust: grey and soft, mostly on what faces up; grime low on the sides
float dn = pgNoise( cp * 6.0 ) * 0.6 + pgNoise( cp * 23.0 ) * 0.4;
float dust = uDirt * clamp( 0.14 + 0.62 * max( cn.y, 0.0 ) + ( dn - 0.5 ) * 0.5, 0.0, 1.0 ) * pgPaint;
float grime = uDirt * smoothstep( 0.55, 0.22, cp.y ) * 0.7 * pgPaint;
// (the cover kept most of it off: a thin grey film, thicker on the roof and the hood)
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.15, 0.14, 0.125 ), dust * 0.72 );
diffuseColor.rgb *= 1.0 - grime * 0.55;
float pgMatte = clamp( max( dust * 1.1, scr ) + grime * 0.5, 0.0, 1.0 );`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix( 0.8, roughnessFactor, pgPaint );
roughnessFactor = mix( roughnessFactor, 0.85, pgMatte );`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor *= pgPaint * ( 1.0 - pgMatte );`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.clearcoat *= pgPaint * ( 1.0 - pgMatte ) * ( 1.0 - gapLine );`);
  };
  m.customProgramCacheKey = () => 'pg-theo-paint';
  m.userData.uniforms = U;
  return m;
}
// the crash bent the left front corner in and back; the panel creases
const BEND_GLSL = `
vec3 pgBend( vec3 p, float k ) {
  if ( k <= 0.0 ) return p;
  vec3 c = vec3( 0.95, 0.5, 2.15 );
  float d = length( ( p - c ) * vec3( 1.0, 1.3, 1.0 ) );
  float w = k * ( 1.0 - smoothstep( 0.0, 0.85, d ) );
  w *= smoothstep( -0.1, 0.35, p.x );
  vec3 q = p;
  q.x -= w * 0.11;
  q.z -= w * 0.075;
  q.y -= w * 0.02;
  // creases
  q.x += w * 0.012 * sin( p.z * 38.0 + p.y * 21.0 );
  q.y += w * 0.008 * sin( p.z * 29.0 - p.x * 17.0 );
  return q;
}`;
const NOISE_GLSL = `
float pgHash( vec3 p ) { p = fract( p * 0.3183099 + vec3( 0.1, 0.17, 0.13 ) ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float pgNoise( vec3 x ) {
  vec3 i = floor( x ), f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( pgHash( i ), pgHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( pgHash( i + vec3( 0, 1, 0 ) ), pgHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( pgHash( i + vec3( 0, 0, 1 ) ), pgHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( pgHash( i + vec3( 0, 1, 1 ) ), pgHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
// fine scratches: in cells of 9 cm, a straight thin line in a random direction, in some of the cells
float pgScratches( vec3 p ) {
  float s = 0.0;
  for ( int k = 0; k < 2; k++ ) {
    vec3 q = p * ( k == 0 ? 11.0 : 19.0 ) + float( k ) * 7.3;
    vec3 cell = floor( q );
    float h = pgHash( cell );
    if ( h > 0.62 ) {
      vec3 f = fract( q ) - 0.5;
      float a = pgHash( cell + 3.1 ) * 6.2832;
      vec3 dir = normalize( vec3( cos( a ), sin( a * 0.7 ) * 0.6, sin( a ) ) );
      float along = dot( f, dir );
      float dist = length( f - dir * along );
      float len = 0.18 + 0.3 * pgHash( cell + 1.7 );
      s = max( s, ( 1.0 - smoothstep( 0.006, 0.02, dist ) ) * ( 1.0 - smoothstep( len * 0.8, len, abs( along ) ) ) * ( 0.45 + 0.55 * pgHash( cell + 9.2 ) ) );
    }
  }
  return s;
}
// the long scrape of the crash: along the left side, from the front wheel back over the door
float pgScrape( vec3 p ) {
  if ( p.x < 0.6 ) return 0.0;
  float along = smoothstep( 1.75, 1.2, p.z ) * smoothstep( -0.75, -0.1, p.z );
  float band = 1.0 - smoothstep( 0.0, 0.055, abs( p.y - 0.47 - 0.05 * sin( p.z * 2.3 ) ) );
  float streak = smoothstep( 0.35, 0.75, pgNoise( vec3( p.z * 1.5, p.y * 90.0, 0.0 ) ) );
  return along * band * streak;
}`;

// the racing roundel: a white disc with a thin black ring and a black 7 (drawn in code)
function makeRoundel() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(236,234,226,1)';
  g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(18,18,20,1)'; g.lineWidth = 5;
  g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.stroke();
  // the 7: a heavy, old racing number (drawn as a shape, not a font: the same on every phone)
  g.fillStyle = 'rgba(14,14,16,1)';
  g.beginPath();
  g.moveTo(74, 66); g.lineTo(186, 66); g.lineTo(186, 90); g.lineTo(130, 196); g.lineTo(98, 196); g.lineTo(152, 92); g.lineTo(74, 92);
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// glass: dark, a little blue, reflecting; dusty while the car is dirty
export function makeTheoGlass(env, U) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x18222b, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.52, envMap: env, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = U.uDirt; sh.uniforms.uBend = U.uBend;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uBend;\n${BEND_GLSL}`).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = pgBend( transformed, uBend );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDirt;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.3, 0.29, 0.27 ), uDirt * 0.55 );\ndiffuseColor.a = mix( diffuseColor.a, 0.78, uDirt * 0.6 );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, 0.6, uDirt * 0.7 );');
  };
  m.customProgramCacheKey = () => 'pg-theo-glass';
  return m;
}

// ======================================================================= the details
const CHROME = { color: 0xc9ccd0, roughness: 0.14, metalness: 1 };
const BLACK = { color: 0x0c0c0e, roughness: 0.62, metalness: 0.1 };
const RUBBER = { color: 0x050506, roughness: 0.9, metalness: 0 };
function std(o, env) { return new THREE.MeshStandardMaterial({ ...o, envMap: env, envMapIntensity: 0.9 }); }

// a round lamp: a chrome ring, a reflector bowl and a glass lens, looking along +z (at the origin)
function roundLamp(r, mats, lensMat) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.11, 8, 28), mats.chrome);
  g.add(ring);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.98, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.reflector);
  bowl.rotation.x = -Math.PI / 2; bowl.position.z = -0.005; bowl.scale.set(1, 1, 0.55);
  g.add(bowl);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(r * 0.97, 20, 8, 0, Math.PI * 2, 0, 0.7), lensMat);
  lens.rotation.x = Math.PI / 2; lens.position.z = -r * 0.72;
  g.add(lens);
  return g;
}

// ======================================================================= THE CAR
// opts: { env (an environment map for the reflections), state: 'wreck' | 'whole' }
// Returns { root, info, spots, parts, set: { dirt, bend, hood, lights, ... } }
export function makeTheoCar(opts = {}) {
  const env = opts.env || null;
  const root = new THREE.Group();
  root.name = 'theoCar';
  const paint = makeTheoPaint(env), U = paint.userData.uniforms;
  const glassMat = makeTheoGlass(env, U);
  const mats = {
    paint, glass: glassMat,
    chrome: std(CHROME, env), black: std(BLACK, env), rubber: std(RUBBER, env),
    reflector: std({ color: 0xdfe3e8, roughness: 0.08, metalness: 1 }, env),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xf2f4f6, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.32, envMap: env, envMapIntensity: 1.3, depthWrite: false }),
    lampOn: new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false }),
    tail: new THREE.MeshStandardMaterial({ color: 0x5a0606, roughness: 0.2, metalness: 0.1, emissive: 0x000000, envMap: env }),
    amber: new THREE.MeshStandardMaterial({ color: 0x8a4a06, roughness: 0.25, metalness: 0.1, envMap: env }),
    trim: std({ color: 0x151518, roughness: 0.5, metalness: 0.2 }, env),
    seat: new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.72, metalness: 0 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.55, metalness: 0.1 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 1, metalness: 0 }),
    engine: std({ color: 0x2b2d31, roughness: 0.55, metalness: 0.6 }, env),
    engineDark: std({ color: 0x101113, roughness: 0.7, metalness: 0.3 }, env),
    plate: new THREE.MeshStandardMaterial({ map: makePlate(), roughness: 0.45, metalness: 0.2 }),
  };
  const add = (geo, mat, parent = root, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };

  // ---- the shell ----
  const body = add(makeLowerBody(), paint);
  const gh = makeGreenhouse();
  add(gh.paint, paint);
  const glass = add(gh.glass, glassMat, root, false);
  glass.renderOrder = 3;
  // the hood turns about its back edge (hinges at the cowl)
  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, TOP(HOOD0) + CROWN(HOOD0) * 0.5, HOOD0);
  root.add(hoodPivot);
  // (the geometry stays in car space, so the bend of the corner works on the hood the same way as on the fender)
  const hood = add(makeHood(), paint, hoodPivot);
  hood.position.set(0, -hoodPivot.position.y, -HOOD0);

  // ---- the front: grille, four round headlights, indicators ----
  const nose = new THREE.Group();
  root.add(nose);
  const noseY = 0.5;
  // the dark grille opening between the lamps, with thin chrome bars
  const grille = add(new RoundedBoxGeometry(0.62, 0.15, 0.06, 2, 0.02), mats.black, nose);
  grille.position.set(0, 0.42, FRONT - 0.03);
  for (let i = 0; i < 4; i++) { const bar = add(new THREE.BoxGeometry(0.58, 0.007, 0.012), mats.chrome, nose); bar.position.set(0, 0.37 + i * 0.033, FRONT + 0.002); }
  const heads = [];
  const dent = new THREE.Group();          // (the lamps of the left corner: the crash pushed them in)
  root.add(dent);
  for (const sx of [1, -1]) {
    const into = sx > 0 ? dent : nose;
    for (const [dx, r] of [[0.5, 0.07], [0.655, 0.066]]) {
      const x = sx * dx;
      // (the lamp sits on the surface of the nose in a black ring, turned a little with the corner)
      const z = endZ(dx + r * 0.6, 1) + 0.012;
      const back = add(new THREE.CircleGeometry(r * 1.2, 28), mats.black, into);
      back.position.set(x, noseY, z - 0.004); back.rotation.y = sx * (dx > 0.6 ? 0.42 : 0.16);
      const lamp = roundLamp(r, mats, mats.lens);
      lamp.position.set(x, noseY, z);
      lamp.rotation.y = sx * (dx > 0.6 ? 0.42 : 0.16);
      into.add(lamp);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 24), mats.lampOn);
      glow.position.set(0, 0, -0.012); glow.visible = false;
      lamp.add(glow);
      heads.push(glow);
    }
    const ind = add(new RoundedBoxGeometry(0.12, 0.04, 0.03, 2, 0.008), mats.amber, into);
    ind.position.set(sx * 0.58, 0.39, endZ(0.64, 1) + 0.006); ind.rotation.y = sx * 0.3;
  }
  // (the dented corner turns about its own middle, not about the middle of the car)
  const DENT_AT = new THREE.Vector3(0.6, 0.47, 1.98);
  for (const c of dent.children) c.position.sub(DENT_AT);
  dent.position.copy(DENT_AT);

  // ---- the back: two round tail lamps each side, the tail lip, exhaust pipes, the number plate ----
  const tails = [];
  for (const sx of [1, -1]) {
    for (const dx of [0.5, 0.68]) {
      const z = endZ(dx + 0.05, -1) - 0.008;
      const tl = add(new THREE.CylinderGeometry(0.058, 0.058, 0.026, 24), mats.tail, root);
      tl.rotation.x = Math.PI / 2; tl.position.set(sx * dx, 0.665, z);
      const ring = add(new THREE.TorusGeometry(0.06, 0.006, 6, 24), mats.chrome, root);
      ring.position.set(sx * dx, 0.665, z - 0.013);
      tails.push(tl);
    }
  }
  for (const dx of [0.36, 0.44]) {
    const pipe = add(new THREE.CylinderGeometry(0.032, 0.034, 0.16, 18, 1, true), mats.chrome, root);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(-dx, 0.24, BACK + 0.02);
    const inner = add(new THREE.CircleGeometry(0.028, 16), mats.engineDark, root);
    inner.position.set(-dx, 0.24, BACK - 0.05); inner.rotation.y = Math.PI;
  }
  const plateR = add(new THREE.PlaneGeometry(0.42, 0.11), mats.plate, root);
  plateR.position.set(0, 0.47, BACK - 0.004); plateR.rotation.y = Math.PI;
  // the rear bumper blade
  const rearBlade = add(bladeGeometry(BACK, -1), mats.chrome);
  rearBlade.castShadow = false;

  // ---- the front bumper: the new one (blue under a chrome blade) and the old one (cracked, hanging) ----
  const bumperNew = new THREE.Group();
  bumperNew.add(new THREE.Mesh(valanceGeometry(), paint), new THREE.Mesh(bladeGeometry(FRONT, 1), mats.chrome));
  const plateF = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), mats.plate);
  plateF.position.set(0, 0.31, FRONT + 0.075);
  bumperNew.add(plateF);
  root.add(bumperNew);
  const bumperOld = new THREE.Group();
  {
    const v = new THREE.Mesh(valanceGeometry(true), paint), b = new THREE.Mesh(bladeGeometry(FRONT, 1, true), mats.chrome);
    bumperOld.add(v, b);
    // it hangs from its right end: the left end has come loose and dropped
    bumperOld.position.set(-0.75, 0.3, FRONT);
    v.position.set(0.75, -0.3, -FRONT); b.position.set(0.75, -0.3, -FRONT);
    bumperOld.rotation.set(0.12, -0.09, -0.17);
  }
  root.add(bumperOld);

  // ---- the engine bay (under the hood): walls, the radiator, the engine, the air cleaner (a separate part) ----
  const bay = new THREE.Group();
  root.add(bay);
  const bayBox = (w, h, d, x, y, z, mat = mats.engineDark) => { const m = add(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.02, w / 3, h / 3, d / 3)), mat, bay); m.position.set(x, y, z); return m; };
  bayBox(1.22, 0.04, 1.4, 0, 0.36, 1.33);                         // the floor of the bay
  for (const sx of [1, -1]) bayBox(0.03, 0.36, 1.3, sx * 0.62, 0.55, 1.3);   // the inner fenders
  bayBox(1.16, 0.32, 0.05, 0, 0.56, 1.98, mats.engine);            // the radiator
  bayBox(1.16, 0.3, 0.04, 0, 0.6, 0.6);                            // the firewall
  // the engine: a long block, two cam covers, the exhaust manifold side
  bayBox(0.42, 0.24, 0.72, 0, 0.5, 1.15, mats.engine);
  for (const sx of [1, -1]) { const c = bayBox(0.14, 0.06, 0.68, sx * 0.11, 0.645, 1.15, mats.chrome); c.rotation.z = sx * 0.22; }
  const intake = bayBox(0.16, 0.05, 0.3, 0, 0.64, 1.1, mats.engine);
  // the air cleaner: a round chrome can on top (the part of station 4)
  const airCleaner = new THREE.Group();
  {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.075, 32), mats.chrome);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.02, 32), mats.chrome);
    lid.position.y = 0.047;
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 6), mats.chrome);
    nut.position.y = 0.064;
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16), mats.chrome);
    snout.rotation.z = Math.PI / 2; snout.position.set(0.2, 0, 0);
    airCleaner.add(can, lid, nut, snout);
    for (const m of airCleaner.children) { m.castShadow = true; m.receiveShadow = true; }
  }
  airCleaner.position.set(0, 0.69, 1.08);
  airCleaner.rotation.y = -Math.PI / 2;     // fitted: the snout points to the left fender (the air intake)
  bay.add(airCleaner);
  // the headlight wires: a loose plug on each side of the loom (the part of station 5)
  const wires = new THREE.Group();
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6, metalness: 0 });
  const plugA = new THREE.Group(), plugB = new THREE.Group();
  {
    const pA = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.03, 0.06, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x8a6a1a, roughness: 0.5 }));
    const pB = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.03, 0.06, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x222224, roughness: 0.5 }));
    plugA.add(pA); plugB.add(pB);
    const cable = (from, to, parent) => {
      const c = new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, -0.04, 0)), to]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.008, 6), wireMat);
      parent.add(m);
      return m;
    };
    cable(new THREE.Vector3(0, 0, -0.03), new THREE.Vector3(0.02, -0.02, -0.2), plugA);
    cable(new THREE.Vector3(0, 0, 0.03), new THREE.Vector3(-0.04, -0.03, 0.18), plugB);
  }
  wires.add(plugA, plugB);
  wires.position.set(0.5, 0.6, 1.78);
  bay.add(wires);
  const WIRE_JOINED = { a: [0, 0, -0.035], b: [0, 0, 0.035] }, WIRE_LOOSE = { a: [0.05, -0.04, -0.12], b: [-0.06, 0.02, 0.12] };

  // ---- the inside: two seats, the dashboard with two round dials, the steering wheel, the tape deck slot ----
  const cabin = new THREE.Group();
  root.add(cabin);
  const cbox = (w, h, d, x, y, z, mat, r = 0.02, rot = null) => { const m = add(new RoundedBoxGeometry(w, h, d, 2, r), mat, cabin, false); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); return m; };
  cbox(1.36, 0.04, 1.6, 0, 0.2, -0.3, mats.carpet, 0.01);                       // the floor
  cbox(0.2, 0.18, 1.0, 0, 0.3, -0.05, mats.dash, 0.03);                         // the tunnel
  for (const sx of [1, -1]) {
    cbox(0.5, 0.12, 0.5, sx * 0.37, 0.32, -0.42, mats.seat, 0.05);              // the seat cushion
    cbox(0.5, 0.62, 0.12, sx * 0.37, 0.62, -0.72, mats.seat, 0.05, [-0.22, 0, 0]);   // the backrest
    cbox(0.09, 0.2, 0.46, sx * 0.37 + 0.22, 0.42, -0.42, mats.seat, 0.04);      // bolsters
    cbox(0.09, 0.2, 0.46, sx * 0.37 - 0.22, 0.42, -0.42, mats.seat, 0.04);
    cbox(0.04, 0.45, 1.05, sx * 0.79, 0.55, -0.1, mats.dash, 0.02);             // the door card
  }
  cbox(1.42, 0.17, 0.34, 0, 0.74, 0.38, mats.dash, 0.05, [0.12, 0, 0]);          // the dashboard
  cbox(0.28, 0.26, 0.2, 0, 0.57, 0.3, mats.dash, 0.025);                        // the middle stack under it
  cbox(1.3, 0.05, 0.5, 0, 0.86, -1.0, mats.dash, 0.01, [-0.12, 0, 0]);           // the shelf behind the seats
  // the two dials in front of the driver
  for (const dx of [0.29, 0.45]) {
    const d = add(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 24), mats.trim, cabin, false);
    d.rotation.x = Math.PI / 2 + 0.25; d.position.set(dx, 0.79, 0.22);
    const face = add(new THREE.CircleGeometry(0.046, 24), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.3, emissive: 0x000000 }), cabin, false);
    face.rotation.x = Math.PI + 0.25; face.rotation.z = Math.PI; face.position.set(dx, 0.788, 0.207);
  }
  // the steering wheel (the driver sits on the left)
  const steer = new THREE.Group();
  steer.position.set(0.37, 0.76, 0.06); steer.rotation.x = -0.42;
  steer.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 8, 32), mats.rubber));
  for (const a of [0, 2.1, 4.2]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.17, 0.012), mats.chrome); s.position.set(Math.sin(a) * 0.085, Math.cos(a) * 0.085, 0); s.rotation.z = -a; steer.add(s); }
  cabin.add(steer);
  // the slot for the tape deck in the middle of the dashboard, and the deck itself (the last part)
  const slot = cbox(0.235, 0.064, 0.012, 0, 0.6, 0.197, new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1 }), 0.004);
  const deck = new THREE.Group();
  {
    const face = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.058, 0.16, 2, 0.006), mats.trim);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.004), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.2 }));
    door.position.set(-0.02, 0.004, -0.081);
    const knobs = [];
    for (const dx of [-0.085, 0.085]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 12), mats.chrome); k.rotation.x = Math.PI / 2; k.position.set(dx, 0, -0.087); knobs.push(k); }
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.012), new THREE.MeshBasicMaterial({ color: 0x3a9e8a, toneMapped: false }));
    lcd.position.set(0.045, 0.012, -0.0815); lcd.rotation.y = Math.PI; lcd.visible = false;
    deck.add(face, door, ...knobs, lcd);
    deck.userData.lcd = lcd;
  }
  cabin.add(deck);

  // ---- outside details: door mirrors, door handles, wipers ----
  for (const sx of [1, -1]) {
    const stalk = add(new THREE.CylinderGeometry(0.012, 0.016, 0.09, 8), mats.chrome);
    stalk.position.set(sx * 0.84, 0.86, 0.36); stalk.rotation.z = sx * 1.15;
    const head = add(new THREE.SphereGeometry(0.06, 16, 10), paint);
    head.scale.set(0.55, 0.75, 1.15); head.position.set(sx * 0.895, 0.895, 0.36);
    const handle = add(new RoundedBoxGeometry(0.02, 0.025, 0.13, 2, 0.008), mats.chrome);
    handle.position.set(sx * (SH_W(-0.42) - 0.028), 0.735, -0.43);
  }
  for (const dx of [-0.26, 0.24]) {
    const w = add(new THREE.BoxGeometry(0.5, 0.008, 0.012), mats.black);
    w.position.set(dx, 0.83, 0.54); w.rotation.set(0.5, 0, dx > 0 ? -0.08 : 0.06);
  }

  // ---- the wheels: deep classic five-spoke rims on high tyres ----
  const wheels = [];
  const wheelGeo = makeDetailedWheel(WR, TYRE_W, 'theo5', 0.62);
  const wheelMat = opts.wheelMaterial || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5, envMap: env });
  for (const [x, z, sx] of [[TRACK, ZF, 1], [-TRACK, ZF, -1], [TRACK, ZR, 1], [-TRACK, ZR, -1]]) {
    const node = new THREE.Group();
    node.position.set(x, WR, z);
    const spin = new THREE.Mesh(wheelGeo.spin, wheelMat);
    spin.castShadow = true;
    if (sx < 0) spin.rotation.y = Math.PI;
    node.add(spin);
    node.add(new THREE.Mesh(wheelGeo.caliper[sx < 0 ? '-1' : 1], wheelMat));
    root.add(node);
    wheels.push({ node, spin, front: z > 0, sx });
  }

  // ======================================================== the state (what the repair changes)
  const state = { dirt: 1, bend: 1, hood: 0, lights: 0, bumper: 'old', cleaner: 'off', wires: 0, deck: 'out', lit: 0 };
  const set = {
    // dust and grime: 1 = four years under a cloth, 0 = washed
    dirt(v) { state.dirt = v; U.uDirt.value = v; },
    // the crash: 1 = the left front corner pushed in, 0 = straight
    bend(v) {
      state.bend = v; U.uBend.value = v;
      // (the left front wheel leans out with the bent corner)
      wheels[0].node.rotation.set(0, v * 0.07, v * 0.09);
      dent.position.set(DENT_AT.x - v * 0.06, DENT_AT.y - v * 0.012, DENT_AT.z - v * 0.05); dent.rotation.y = v * 0.12;
    },
    // the hood: 0 shut .. 1 open
    hood(v) { state.hood = v; hoodPivot.rotation.x = -v * 0.95; },
    // the front bumper: 'old' (hanging), 'none', 'new', or a number 0..1 = the new one coming into place (from the floor)
    bumper(v) {
      state.bumper = v;
      bumperOld.visible = v === 'old';
      bumperNew.visible = v !== 'old' && v !== 'none';
      if (typeof v === 'number') { const t = 1 - v; bumperNew.position.set(t * 0.1, -t * 0.12, t * 0.55); bumperNew.rotation.set(t * 0.25, 0, t * 0.05); }
      else bumperNew.position.set(0, 0, 0), bumperNew.rotation.set(0, 0, 0);
    },
    // the air cleaner: 'off' (not there), or { lift: 0..1 (above its place), turn: radians off its right turn }
    cleaner(v) {
      state.cleaner = v;
      airCleaner.visible = v !== 'off';
      if (v && typeof v === 'object') { airCleaner.position.set(0, 0.69 + (v.lift || 0) * 0.45, 1.08); airCleaner.rotation.y = -Math.PI / 2 + (v.turn || 0); }
      else if (v === 'on') { airCleaner.position.set(0, 0.69, 1.08); airCleaner.rotation.y = -Math.PI / 2; }
    },
    // the plugs of the headlight wires: 0 apart .. 1 joined
    wires(v) {
      state.wires = v;
      for (const [p, k] of [[plugA, 'a'], [plugB, 'b']]) {
        const a = WIRE_LOOSE[k], b = WIRE_JOINED[k];
        p.position.set(lerp(a[0], b[0], v), lerp(a[1], b[1], v), lerp(a[2], b[2], v));
        p.rotation.set((1 - v) * 0.6, (1 - v) * (k === 'a' ? 0.5 : -0.7), 0);
      }
    },
    // the headlights and the tail lamps: 0 off .. 1 on (a value in between flickers on the way)
    lights(v) {
      state.lights = v;
      for (const h of heads) { h.visible = v > 0.05; h.material.color.setRGB(1.0 * v + 0.05, 0.94 * v + 0.05, 0.84 * v + 0.05); }
      for (const t of tails) t.material.emissive.setRGB(0.5 * v, 0.02 * v, 0.01 * v);
    },
    // the tape deck: 'out' (an empty slot), a number 0..1 (sliding in), 'in'
    deck(v) {
      state.deck = v;
      deck.visible = v !== 'out';
      const t = v === 'in' ? 1 : typeof v === 'number' ? v : 0;
      deck.position.set(0, 0.6, 0.29 - (1 - t) * 0.3);
      deck.userData.lcd.visible = v === 'in' && state.lit > 0;
    },
    // the small light of the tape deck (the car has power)
    lit(v) { state.lit = v; deck.userData.lcd.visible = state.deck === 'in' && v > 0; },
    // everything at once: the wreck under the cloth, or the car whole again
    all(s) {
      if (s === 'wreck') { set.dirt(1); set.bend(1); set.hood(0); set.bumper('old'); set.cleaner('off'); set.wires(0); set.lights(0); set.deck('out'); }
      else { set.dirt(0.12); set.bend(0); set.hood(0); set.bumper('new'); set.cleaner('on'); set.wires(1); set.lights(0); set.deck('in'); }
    },
  };
  // (fewer draw calls: everything that moves together becomes one mesh per material; the lamps' glow, the deck,
  //  the plugs and the wheels stay apart because they change)
  const glowMerged = [];
  {
    // the four glowing discs of the headlights: one mesh for the two of each side
    for (const grp of [nose, dent]) {
      const discs = heads.filter((h) => { let o = h; while (o && o !== grp) o = o.parent; return o === grp; });
      if (!discs.length) continue;
      grp.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert();
      const gs = discs.map((d) => { const g = d.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, d.matrixWorld)); return g; });
      for (const d of discs) d.parent.remove(d);
      const m = new THREE.Mesh(mergeGeometries(gs), mats.lampOn);
      m.visible = false;
      grp.add(m);
      glowMerged.push(m);
    }
    heads.length = 0; heads.push(...glowMerged);
  }
  // (not the hood: its geometry must stay in car space for the bend of the corner)
  flatten(nose); flatten(dent); flatten(bumperNew); flatten(bumperOld); flatten(airCleaner);
  flatten(cabin, [deck, steer]); flatten(bay, [airCleaner, wires]);
  flatten(root, [nose, dent, hoodPivot, bumperNew, bumperOld, bay, cabin, ...wheels.map((w) => w.node)]);
  for (const m of [...nose.children, ...dent.children]) if (m.material === mats.lampOn) m.visible = false;
  set.all(opts.state || 'wreck');
  slot.visible = true;
  return {
    root, info: THEO_INFO, spots: THEO_SPOTS, state, set, uniforms: U, wheels,
    parts: { body, hood: hoodPivot, bumperOld, bumperNew, airCleaner, intake, wires, plugA, plugB, deck, slot, cabin, steer, heads, tails, bay },
    materials: mats,
    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } }); for (const m of Object.values(mats)) if (m && m.dispose) m.dispose(); },
  };
}

// ---- the bumper pieces ----
// the chrome blade: a thin bar that follows the plan shape of the nose (or the tail) and wraps round the corners
function bladeGeometry(endZ, dir, bent = false) {
  const pts = [];
  const y = dir > 0 ? 0.345 : 0.36;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, x = lerp(-0.86, 0.86, t);
    const e = Math.abs(x) / 0.86;
    const z = endZ + dir * (0.05 - Math.pow(e, 4) * 0.2);
    let yy = y;
    if (bent) yy -= Math.max(0, x) * 0.05 + Math.sin(t * 9) * 0.004;
    pts.push(new THREE.Vector3(x, yy, z + (bent ? Math.max(0, x) * dir * -0.03 : 0)));
  }
  const c = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(c, 48, 0.022, 8, false);
  g.scale(1, 1, 1);
  const p = g.attributes.position;
  // (flattened: a blade, not a pipe)
  for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setY(i, y + (yy - y) * 1.45); }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.count * 3).fill(1), 3));
  return g;
}
// the painted lower part of the front (under the blade), with a dark mouth; cracked when old
function valanceGeometry(cracked = false) {
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [], col = [], idx = [];
  const N = 30, rows = 5;
  for (let r = 0; r <= rows; r++) {
    const v = r / rows, y = lerp(0.19, 0.335, v);
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = lerp(-0.88, 0.88, t), e = Math.abs(x) / 0.88;
      // (it curves back round the corners, and leans back a little at the bottom)
      let z = FRONT + 0.035 - Math.pow(e, 3.2) * 0.26 - (1 - v) * 0.05;
      let yy = y;
      if (cracked) { yy += Math.sin(t * 23 + v * 3) * 0.004; z += (t > 0.62 && t < 0.66 ? -0.015 : 0) + Math.sin(t * 17) * 0.004; }
      pos.push(x * (1 - (1 - v) * 0.02), yy, z);
      nor.push(0, 0, 1);
      const dark = cracked && t > 0.62 && t < 0.66 ? 0.05 : 1;
      col.push(dark, dark, dark);
    }
  }
  for (let r = 0; r < rows; r++) for (let i = 0; i < N; i++) {
    const a = r * (N + 1) + i, b = a + 1, c = a + N + 2, d = a + N + 1;
    idx.push(a, b, c, a, c, d);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// the number plate: white with dark letters (drawn in code)
function makePlate() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e6dc'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#1d1d22'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#18181c'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TC 0707', 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
