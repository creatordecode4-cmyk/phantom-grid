// ---------------------------------------------------------------------------
// bike.js - THE STREET BIKE: a sports motorbike made in code (an original
// design of this game, no real make). The player's reference picture of a
// sports bike was used for the level of detail only.
//
//   body panels  made as a SKIN through cross sections (like a boat hull):
//                a sharp nose with two slim LED headlights and a smoked
//                screen, side fairings with vents, a dark belly pan, a tank
//                with a crisp shoulder line, a rider seat, a tail that rises
//                to a point with LED tail lights
//   frame        aluminium beams, the swing arm, a red-spring shock
//   engine       crankcase and covers (seen through the open back of the fairing)
//   front        golden upside-down fork, triple clamps, clip-on bars with
//                grips, levers and bar-end weights, a front fender
//                (this part turns when you steer)
//   wheels       detailed wheels (wheelDetail.js): spokes in the middle, two
//                ring brake discs at the front, one at the back + the sprocket
//   kickstand    the bike leans on it when nobody rides it
//
// Bike space: y up, the ground is y = 0, the nose points to +z, the bike's
// left side is +x. Painted parts take the colour of the bike.
// Every part stores its colour, roughness and metal in the vertices (the car
// material made in code draws it all: one draw call for the body).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mergeParts } from '../utils/geometry.js';
import { lin } from '../city/models.js';

const HALF_PI = Math.PI / 2;
// the numbers the rest of the game reads (wheels, seat, lights, door = where you get on)
export const BIKE_R = 0.31;
export const BIKE_INFO = {
  length: 2.12, halfWidth: 0.42, boxHalfWidth: 0.42, roof: 1.2, backZ: -1.06, frontZ: 1.04,
  wheelR: BIKE_R, wheelX: 0.3, wheelZ: [-0.7, 0.72], door: { z0: -0.45, z1: 0.05, y0: 0.4, y1: 1.2 },
  seat: { x: 0, y: 0.84, z: -0.21 }, bike: true,
};
export const BIKE_SPEC = { label: 'STREET BIKE', length: 2.12, mass: 230, drive: 'rwd', topSpeed: 235, accel: 11.5, grip: 1.18, roll: 0.2, armor: 0.5, tone: 'sharp', role: 'car' };
// where things are, for vehicle.js and the rider
export const BIKE_HEAD = [0, 1.0, 0.5];             // the steering head (the front turns about it)
export const BIKE_RAKE = 0.3;                       // how far the fork leans back (radians)
export const BIKE_BAR = [0, 0.97, 0.47];            // the middle of the handlebars
export const BIKE_GRIP = [0.3, 0.96, 0.47];         // the left grip (the right one is the mirror image)
export const BIKE_PEG = [0.2, 0.42, -0.16];         // the left footpeg
export const BIKE_EYE = [0, 1.46, 0.08];            // the rider's eyes (the cockpit view)
export const BIKE_PARK_LEAN = -0.13;                // parked: the bike leans to its left, onto the kickstand

const DARK = [0.05, 0.05, 0.055], SILVER = [0.62, 0.64, 0.66], GOLD = [0.78, 0.56, 0.16], SEAT = [0.035, 0.035, 0.04];
const ALU = [0.5, 0.52, 0.55], TITAN = [0.42, 0.4, 0.38], SMOKE = [0.05, 0.06, 0.07];
const LIGHT = { color: lin([1, 1, 1]), rough: 0.2, metal: 0, glow: 1 };
const RED = { color: lin([1, 0.06, 0.04]), rough: 0.2, metal: 0, glow: 1 };
const AMBER = { color: lin([1, 0.55, 0.08]), rough: 0.2, metal: 0, glow: 0.8 };
const SCREEN_GLOW = { color: lin([0.45, 0.85, 1]), rough: 0.3, metal: 0, glow: 1.25 };   // (1..2 = lit day and night)

const P = (geom, pos, color, rough, metal, more = {}) => ({ geom, pos, color: lin(color), rough, metal, ...more });
const PAINT = (geom, pos = [0, 0, 0], rot = null, rough = 0.28) => ({ geom, pos, color: [1, 1, 1], rough, metal: 0.25, paint: 1, rot });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ell = (sx, sy, sz, seg = 14) => { const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.6))); g.scale(sx, sy, sz); return g; };
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r1, r0, h, seg);
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// a tube from point a to point b (radius r)
function tube(a, b, r, color, rough = 0.4, metal = 0.9, seg = 10) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return P(g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color, rough, metal);
}
// a flat beam from a to b: w wide (across, along x), h0 high at a and h1 high at b (an aluminium frame or swing arm)
function beam(a, b, w, h0, h1, color, rough = 0.3, metal = 0.95) {
  const A = V3(a), B = V3(b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.BoxGeometry(w, len, 1);
  // (the box stands along y: its bottom end is at a, its top end at b; make each end as high as asked)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (p.getY(i) < 0 ? h0 : h1));
  const yAxis = d.clone().normalize(), xAxis = new THREE.Vector3(1, 0, 0);
  xAxis.sub(yAxis.clone().multiplyScalar(xAxis.dot(yAxis))).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  return P(g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color, rough, metal);
}

// ---------------------------------------------------------------------------
// SKIN: a surface through rings of points (the panels are made with it).
//   rings: a list of rings; a ring is a list of [x, y, z] points going around the part.
//          Every ring has the same number of points, in the same order.
//   sharp: the indexes of the points where the surface has a crisp edge (a crease line).
//   caps:  close the first / the last ring with a flat face.
// The normals are worked out from the neighbouring points, so the panels look smooth,
// except along the crease lines.
// ---------------------------------------------------------------------------
function skin(rings, sharp = [], caps = [true, true]) {
  const m = rings.length, n = rings[0].length;
  const isSharp = new Uint8Array(n);
  for (const j of sharp) isSharp[j] = 1;
  const P_ = (i, j) => rings[Math.min(m - 1, Math.max(0, i))][((j % n) + n) % n];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mid = rings.map((r) => { const c = [0, 0, 0]; for (const p of r) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return [c[0] / n, c[1] / n, c[2] / n]; });
  // which way is "out": tested at the point furthest from the middle of the middle ring
  const im = Math.floor(m / 2);
  let jm = 0, best = -1;
  for (let j = 0; j < n; j++) { const d = sub(P_(im, j), mid[im]); if (dot(d, d) > best) { best = dot(d, d); jm = j; } }
  const test = cross(sub(P_(im, jm + 1), P_(im, jm - 1)), sub(P_(im + 1, jm), P_(im - 1, jm)));
  const sign = dot(test, sub(P_(im, jm), mid[im])) >= 0 ? 1 : -1;
  // columns: a smooth point has one, a sharp point two (one for the face before it, one for the face after it)
  const colIn = new Int32Array(n), colOut = new Int32Array(n), cols = [];
  for (let j = 0; j < n; j++) {
    if (isSharp[j]) { colIn[j] = cols.length; cols.push([j, -1]); colOut[j] = cols.length; cols.push([j, 1]); }
    else { colIn[j] = colOut[j] = cols.length; cols.push([j, 0]); }
  }
  const C = cols.length, pos = [], nor = [], idx = [];
  for (let i = 0; i < m; i++) {
    for (const [j, k] of cols) {
      const p = P_(i, j);
      const along = sub(P_(i + 1, j), P_(i - 1, j));
      const around = k < 0 ? sub(p, P_(i, j - 1)) : k > 0 ? sub(P_(i, j + 1), p) : sub(P_(i, j + 1), P_(i, j - 1));
      const nn = unit(cross(around, along));
      pos.push(p[0], p[1], p[2]);
      nor.push(nn[0] * sign, nn[1] * sign, nn[2] * sign);
    }
  }
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * C + colOut[j], b = i * C + colIn[(j + 1) % n], c = (i + 1) * C + colIn[(j + 1) % n], d = (i + 1) * C + colOut[j];
    if (sign > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  // the end caps: a fan from the middle of the ring, facing away from the neighbouring ring
  const cap = (i, nb) => {
    const c = mid[i], nrm = unit(sub(mid[i], mid[nb]));
    let area = [0, 0, 0];
    for (let j = 0; j < n; j++) { const g = cross(sub(P_(i, j), c), sub(P_(i, j + 1), c)); area = [area[0] + g[0], area[1] + g[1], area[2] + g[2]]; }
    const fwd = dot(area, nrm) >= 0;
    const base = pos.length / 3;
    pos.push(c[0], c[1], c[2]); nor.push(nrm[0], nrm[1], nrm[2]);
    for (let j = 0; j < n; j++) { const p = P_(i, j); pos.push(p[0], p[1], p[2]); nor.push(nrm[0], nrm[1], nrm[2]); }
    for (let j = 0; j < n; j++) {
      const b = base + 1 + j, e = base + 1 + ((j + 1) % n);
      if (fwd) idx.push(base, b, e); else idx.push(base, e, b);
    }
  };
  if (caps[0] && m > 1) cap(0, 1);
  if (caps[1] && m > 1) cap(m - 1, m - 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// a ring from half an outline: the bike's left half (x >= 0), from the top middle down to the bottom middle.
// The right half is its mirror image.
function ringOf(half, z) {
  const pts = half.map(([x, y]) => [x, y, z]);
  for (let i = half.length - 2; i >= 1; i--) pts.push([-half[i][0], half[i][1], z]);
  return pts;
}
// the crease points of the half outline -> the same creases on both halves
const mirrored = (hs, K) => hs.flatMap((h) => (h === 0 || h === K - 1 ? [h] : [h, 2 * K - 2 - h]));
// more rows between the given ones: a smooth curve (Catmull-Rom) through every number of the rows
function smoothRows(rows, sub = 2) {
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const p0 = rows[Math.max(0, i - 1)], p1 = rows[i], p2 = rows[i + 1], p3 = rows[Math.min(rows.length - 1, i + 2)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(rows[rows.length - 1].slice());
  return out;
}
// a panel: rows of [z, top, bottom, half width] along the bike, the shape of its cross section (profile)
// and its crease points -> one skin
function panel(rows, profile, sharpHalf, sub = 2, caps = [true, true]) {
  const rings = smoothRows(rows, sub).map(([z, t, b, w]) => ringOf(profile(t, b, w), z));
  return skin(rings, mirrored(sharpHalf, profile(1, 0, 1).length), caps);
}

// ---- the cross sections (half outlines, from the top middle down to the bottom middle) ----
// the nose: narrow at the top where the screen sits, widest in the middle, a chin below
const NOSE = (t, b, w) => { const h = t - b; return [[0, t], [0.5 * w, t - 0.04 * h], [0.8 * w, t - 0.16 * h], [w, t - 0.5 * h], [0.9 * w, t - 0.78 * h], [0.5 * w, b + 0.02 * h], [0, b]]; };
// the side fairing: a flat top (under the tank), a crisp upper edge, a full side, then a step inward low down
const SIDE = (t, b, w) => { const h = t - b; return [[0, t], [0.88 * w, t], [w, t - 0.08 * h], [0.975 * w, t - 0.66 * h], [0.9 * w, t - 0.72 * h], [0.86 * w, b + 0.08 * h], [0.6 * w, b], [0, b]]; };
// the belly pan under the engine
const PAN = (t, b, w) => { const h = t - b; return [[0, t], [0.9 * w, t], [w, t - 0.3 * h], [0.86 * w, b + 0.12 * h], [0.55 * w, b], [0, b]]; };
// the tank: a round top, a crisp shoulder line, wide where the knees hold it
const TANK = (t, b, w) => { const h = t - b; return [[0, t], [0.5 * w, t - 0.02 * h], [0.84 * w, t - 0.16 * h], [w, t - 0.48 * h], [0.92 * w, b + 0.14 * h], [0.62 * w, b], [0, b]]; };
// the seat cushion
const SEATP = (t, b, w) => [[0, t], [0.6 * w, t - 0.004], [0.9 * w, t - 0.018], [w, t - 0.05], [0.98 * w, b], [0, b]];
// the tail: crisp upper and lower edges, it ends in a point
const TAIL = (t, b, w) => { const h = t - b; return [[0, t], [0.6 * w, t - 0.02 * h], [0.88 * w, t - 0.12 * h], [w, t - 0.45 * h], [0.84 * w, b + 0.08 * h], [0.45 * w, b], [0, b]]; };

// the screen: a thin curved shell (outside and inside, so it can be seen from both sides), made on the same
// rows as the nose: its edges lie exactly on the nose's shoulder crease lines (a clean joint, nothing pokes
// through), it bulges up more and more toward the back, and its top edge stands free above the back of the nose.
function screenOnNose() {
  const S = [1, 0.75, 0.45, 0, -0.45, -0.75, -1];
  const ringAt = (z, t, b, w, bump, edgeLift) => {
    const h = t - b, ws = 0.8 * w + 0.001, yEdge = t - 0.16 * h + 0.002 + edgeLift, yc = t + bump;   // (the edge lies on the nose's crease line)
    const pts = S.map((s) => [s * ws, yc - (yc - yEdge) * s * s, z]);
    for (let i = S.length - 1; i >= 0; i--) pts.push([S[i] * ws * 0.98, yc - (yc - yEdge) * S[i] * S[i] - 0.005, z]);
    return pts;
  };
  const rs = smoothRows(NOSE_ROWS, 2).filter((r) => r[0] <= 0.77);
  const z0 = rs[0][0], z1 = rs[rs.length - 1][0];
  const rings = rs.map(([z, t, b, w]) => { const k = (z0 - z) / (z0 - z1); return ringAt(z, t, b, w, 0.01 + 0.062 * k * k, 0); });
  const last = rs[rs.length - 1];
  rings.push(ringAt(last[0] - 0.025, last[1], last[2], last[3] * 0.85, 0.095, 0.05));
  return skin(rings, [0, 6, 7, 13]);
}
// a flat plate through 4 points (a vent, a light lens ...): a single face, it looks along "out"
function plate(pts, out) {
  const g = new THREE.BufferGeometry();
  const pos = pts.flat(), nrm = [];
  for (let i = 0; i < pts.length; i++) nrm.push(out[0], out[1], out[2]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  // (the winding must face "out")
  const a = V3(pts[0]), b = V3(pts[1]), c = V3(pts[2]);
  const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  const idx = [];
  for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1);
  if (face.dot(V3(out)) < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.setIndex(idx);
  return g;
}
// an arch over a wheel (a fender / hugger): center of the wheel (in bike or axle space), its radius,
// from angle a0 to a1 (0 = straight up, + = toward the front), half width w
function arch(cy, cz, R, a0, a1, w, thick = 0.006, steps = 10) {
  const rings = [];
  const across = [1, 0.75, 0.4, 0, -0.4, -0.75, -1];
  for (let s = 0; s <= steps; s++) {
    const a = a0 + (a1 - a0) * (s / steps), uy = Math.cos(a), uz = Math.sin(a);
    const ring = [];
    for (const k of across) { const lift = 0.022 * (1 - k * k); ring.push([k * w, cy + uy * (R + lift), cz + uz * (R + lift)]); }
    for (let i = across.length - 1; i >= 0; i--) { const k = across[i], lift = 0.022 * (1 - k * k) - thick; ring.push([k * w * 0.97, cy + uy * (R + lift), cz + uz * (R + lift)]); }
    rings.push(ring);
  }
  return skin(rings, [0, 6, 7, 13]);
}

// a patch that lies ON a panel, a few millimetres out (a vent, a light lens, a stripe).
//   rows, profile: the panel (as given to panel()); corners: 4 points [z, y] going round the patch;
//   sx: +1 = the bike's left side, -1 = the right side; off: how far out (meters)
function decal(rows, profile, corners, sx, off, nu = 4, nv = 3) {
  const rs = smoothRows(rows, 2);
  // where the panel's surface is (its x) at a height y, at a place z along the bike
  const xAt = (z, y) => {
    let i = 0;
    while (i < rs.length - 2 && rs[i + 1][0] > z) i++;
    const a = rs[i], b = rs[i + 1], t = Math.min(1, Math.max(0, (z - a[0]) / (b[0] - a[0] || 1)));
    const r = a.map((v, k) => v + (b[k] - v) * t);
    const half = profile(r[1], r[2], r[3]);
    for (let k = 0; k < half.length - 1; k++) {
      const [x0, y0] = half[k], [x1, y1] = half[k + 1];
      if (y0 !== y1 && (y - y0) * (y - y1) <= 0) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return r[3];
  };
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const W = nu + 1, pts = [];
  for (let i = 0; i <= nv; i++) for (let j = 0; j <= nu; j++) {
    const [z, y] = mix(mix(corners[0], corners[1], j / nu), mix(corners[3], corners[2], j / nu), i / nv);
    pts.push(new THREE.Vector3(sx * (xAt(z, y) + off), y, z));
  }
  const at = (i, j) => pts[Math.min(nv, Math.max(0, i)) * W + Math.min(nu, Math.max(0, j))];
  const out = new THREE.Vector3(sx, 0, 0), pos = [], nor = [], idx = [];
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i <= nv; i++) for (let j = 0; j <= nu; j++) {
    du.subVectors(at(i, j + 1), at(i, j - 1)); dv.subVectors(at(i + 1, j), at(i - 1, j));
    nn.crossVectors(du, dv).normalize();
    if (nn.dot(out) < 0) nn.negate();
    const p = at(i, j);
    pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z);
  }
  // (the faces must look outward)
  const face = new THREE.Vector3().crossVectors(du.subVectors(at(0, 1), at(0, 0)), dv.subVectors(at(1, 0), at(0, 0)));
  const flip = face.dot(out) < 0;
  for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
    const a = i * W + j, b = a + 1, c = a + W + 1, d = a + W;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// the rows of the panels (they are also used to lay lights and vents on them)
const NOSE_ROWS = [
  [0.83, 0.902, 0.872, 0.022], [0.795, 0.94, 0.83, 0.085], [0.745, 0.985, 0.78, 0.14],
  [0.67, 1.032, 0.728, 0.178], [0.585, 1.068, 0.697, 0.197], [0.49, 1.088, 0.7, 0.2],
];
const SIDE_ROWS = [
  [0.5, 0.775, 0.64, 0.186], [0.44, 0.775, 0.52, 0.195], [0.37, 0.775, 0.38, 0.2], [0.25, 0.772, 0.34, 0.198],
  [0.12, 0.77, 0.345, 0.19], [0.02, 0.77, 0.46, 0.178], [-0.05, 0.77, 0.62, 0.165], [-0.09, 0.77, 0.73, 0.155],
];
const TAIL_ROWS = [
  [-0.28, 0.83, 0.66, 0.13], [-0.39, 0.868, 0.685, 0.145], [-0.48, 0.925, 0.715, 0.148], [-0.6, 0.962, 0.765, 0.136],
  [-0.72, 0.984, 0.825, 0.108], [-0.83, 0.994, 0.89, 0.07], [-0.92, 0.997, 0.945, 0.028],
];

let built = null;
// The body (everything that does not turn with the handlebars), the front (fork, fender, bars) and the kickstand,
// built once. The front is given in "steer space": the steering head is (0, 0, 0), the fork goes down its y axis.
export function makeBike() {
  if (built) return built;
  const parts = [];

  // ================= the body panels =================
  // the nose (the upper fairing) and the smoked screen on it
  parts.push(PAINT(panel(NOSE_ROWS, NOSE, [2, 3, 4])));
  parts.push(P(screenOnNose(), [0, 0, 0], SMOKE, 0.04, 0.7));
  // the side fairings (one skin round the engine), its open back cut on a slant
  parts.push(PAINT(panel(SIDE_ROWS, SIDE, [2, 3, 4])));
  // the belly pan (dark, under the side fairings)
  parts.push(P(panel([
    [0.4, 0.42, 0.33, 0.178], [0.3, 0.41, 0.215, 0.186], [0.14, 0.41, 0.195, 0.178], [0.03, 0.45, 0.25, 0.163], [-0.04, 0.52, 0.36, 0.148],
  ], PAN, [3]), [0, 0, 0], [0.06, 0.06, 0.065], 0.55, 0.2));
  // the tank, its filler cap
  parts.push(PAINT(panel([
    [0.47, 1.03, 0.86, 0.12], [0.4, 1.068, 0.8, 0.163], [0.29, 1.08, 0.785, 0.185],
    [0.15, 1.055, 0.785, 0.182], [0.04, 0.995, 0.79, 0.155], [-0.05, 0.915, 0.8, 0.122],
  ], TANK, [2])));
  parts.push(P(cyl(0.04, 0.04, 0.01, 16), [0, 1.082, 0.3], ALU, 0.25, 1));
  parts.push(P(cyl(0.03, 0.03, 0.012, 16), [0, 1.087, 0.3], DARK, 0.4, 0.5));
  // the rider seat
  parts.push(P(panel([
    [-0.03, 0.88, 0.78, 0.1], [-0.12, 0.86, 0.78, 0.125], [-0.25, 0.862, 0.78, 0.138], [-0.37, 0.882, 0.79, 0.132], [-0.45, 0.905, 0.81, 0.118],
  ], SEATP, []), [0, 0, 0], SEAT, 0.85, 0));
  // the tail, rising to a point
  parts.push(PAINT(panel(TAIL_ROWS, TAIL, [2, 4])));
  // a black pillion pad on the hump of the tail
  parts.push(P(panel([[-0.465, 0.94, 0.9, 0.085], [-0.54, 0.962, 0.915, 0.108], [-0.62, 0.975, 0.935, 0.098]], SEATP, []), [0, 0, 0], SEAT, 0.85, 0));

  // ================= lights =================
  // headlights: on each front face of the nose a dark mask and in it a slim LED lens that sweeps back and up,
  // with a thin LED brow above it
  for (const sx of [-1, 1]) {
    parts.push(P(decal(NOSE_ROWS, NOSE, [[0.79, 0.872], [0.788, 0.9], [0.695, 0.935], [0.7, 0.9]], sx, 0.003, 5, 6), [0, 0, 0], [0.02, 0.02, 0.024], 0.15, 0.4));
    parts.push({ geom: decal(NOSE_ROWS, NOSE, [[0.782, 0.877], [0.78, 0.896], [0.705, 0.926], [0.709, 0.906]], sx, 0.005, 5, 6), pos: [0, 0, 0], ...LIGHT });
    parts.push({ geom: decal(NOSE_ROWS, NOSE, [[0.772, 0.912], [0.771, 0.918], [0.695, 0.95], [0.695, 0.944]], sx, 0.004, 5, 2), pos: [0, 0, 0], ...LIGHT });
  }
  // tail lights: a red LED strip along each lower edge of the tail, one in the tip
  for (const sx of [-1, 1]) parts.push({ geom: decal(TAIL_ROWS, TAIL, [[-0.8, 0.898], [-0.8, 0.914], [-0.905, 0.958], [-0.905, 0.946]], sx, 0.003, 4, 1), pos: [0, 0, 0], ...RED });
  parts.push({ geom: box(0.036, 0.03, 0.012), pos: [0, 0.97, -0.922], ...RED });
  // winglets on the sides of the nose (black)
  for (const sx of [-1, 1]) parts.push(P(box(0.075, 0.006, 0.1), [sx * 0.222, 0.86, 0.6], [0.04, 0.04, 0.045], 0.4, 0.3, { rot: [0.12, 0, -sx * 0.22] }));

  // ================= vents in the side fairings =================
  // a dark slanted opening with three slats in the colour of the bike
  for (const sx of [-1, 1]) {
    parts.push(P(decal(SIDE_ROWS, SIDE, [[0.35, 0.665], [0.23, 0.665], [0.1, 0.475], [0.22, 0.475]], sx, 0.003), [0, 0, 0], [0.015, 0.015, 0.017], 0.9, 0));
    for (let k = 1; k <= 3; k++) {
      const f = k / 4, yy = 0.475 + f * 0.19, z0 = 0.1 + f * 0.13, z1 = z0 + 0.12;
      parts.push(PAINT(decal(SIDE_ROWS, SIDE, [[z1, yy + 0.006], [z0, yy + 0.006], [z0, yy - 0.006], [z1, yy - 0.006]], sx, 0.005, 3, 1)));
    }
  }

  // ================= mirrors, dash =================
  for (const sx of [-1, 1]) {
    parts.push(tube([sx * 0.145, 1.0, 0.6], [sx * 0.26, 1.055, 0.57], 0.008, DARK, 0.5, 0.5, 6));
    parts.push(P(box(0.1, 0.045, 0.034), [sx * 0.285, 1.065, 0.565], DARK, 0.35, 0.3, { rot: [0, sx * 0.12, 0] }));
    parts.push(P(box(0.088, 0.035, 0.004), [sx * 0.285, 1.065, 0.547], [0.75, 0.77, 0.8], 0.04, 1, { rot: [0, sx * 0.12, 0] }));
    parts.push({ geom: box(0.06, 0.008, 0.006), pos: [sx * 0.29, 1.066, 0.583], rot: [0, sx * 0.12, 0], ...AMBER });
  }
  // the dash: a dark box with a glowing screen that looks at the rider
  parts.push(P(box(0.13, 0.03, 0.07), [0, 1.088, 0.52], DARK, 0.5, 0.3, { rot: [-0.65, 0, 0] }));
  parts.push({ geom: box(0.11, 0.004, 0.055), pos: [0, 1.1015, 0.5097], rot: [-0.65, 0, 0], ...SCREEN_GLOW });

  // ================= frame, engine, back =================
  // the aluminium frame beams (mostly under the tank), the plates that hold the swing arm
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * 0.12, 0.92, 0.45], [sx * 0.155, 0.58, -0.17], 0.035, 0.1, 0.08, ALU));
    parts.push(P(box(0.03, 0.2, 0.15), [sx * 0.158, 0.52, -0.19], ALU, 0.3, 0.95));
    parts.push(P(cyl(0.032, 0.032, 0.012, 14), [sx * 0.177, 0.5, -0.2], DARK, 0.4, 0.8, { rot: [0, 0, HALF_PI] }));
  }
  // the engine: crankcase, the cylinder block leaning forward, the clutch cover (right), the sprocket cover (left)
  parts.push(P(box(0.27, 0.27, 0.42), [0, 0.46, 0.1], [0.12, 0.12, 0.13], 0.5, 0.7));
  parts.push(P(box(0.26, 0.2, 0.2), [0, 0.66, 0.24], [0.16, 0.16, 0.17], 0.5, 0.7, { rot: [-0.4, 0, 0] }));
  parts.push(P(cyl(0.09, 0.09, 0.03, 22), [-0.15, 0.43, 0.0], [0.55, 0.56, 0.58], 0.25, 1, { rot: [0, 0, HALF_PI] }));
  parts.push(P(cyl(0.05, 0.05, 0.034, 6), [-0.16, 0.43, 0.0], [0.3, 0.3, 0.32], 0.3, 0.9, { rot: [0, 0, HALF_PI] }));
  parts.push(P(cyl(0.065, 0.065, 0.03, 18), [0.15, 0.42, -0.06], [0.08, 0.08, 0.085], 0.5, 0.6, { rot: [0, 0, HALF_PI] }));
  // the swing arm: two tapered aluminium arms from the pivot to the back axle, a brace between them
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * 0.15, 0.5, -0.2], [sx * 0.15, BIKE_R, -0.7], 0.035, 0.085, 0.05, ALU));
    parts.push(P(box(0.04, 0.05, 0.06), [sx * 0.15, BIKE_R, -0.705], [0.3, 0.3, 0.32], 0.3, 0.9));
  }
  parts.push(tube([-0.15, 0.45, -0.34], [0.15, 0.45, -0.34], 0.018, ALU, 0.3, 0.95));
  // the chain (left side): from the small sprocket at the engine to the big one on the back wheel
  parts.push(tube([0.115, 0.465, -0.06], [0.115, BIKE_R + 0.1, -0.7], 0.006, [0.09, 0.09, 0.09], 0.6, 0.8, 6));
  parts.push(tube([0.115, 0.375, -0.06], [0.115, BIKE_R - 0.1, -0.7], 0.006, [0.09, 0.09, 0.09], 0.6, 0.8, 6));
  parts.push(P(cyl(0.045, 0.045, 0.012, 16), [0.115, 0.42, -0.06], [0.4, 0.4, 0.42], 0.3, 0.95, { rot: [0, 0, HALF_PI] }));
  // the shock absorber under the seat, with its red spring
  parts.push(tube([0, 0.76, -0.23], [0, 0.46, -0.36], 0.02, DARK, 0.4, 0.8));
  for (let i = 0; i < 6; i++) { const k = i / 5; parts.push(P(new THREE.TorusGeometry(0.034, 0.008, 5, 14), [0, 0.72 - k * 0.2, -0.25 - k * 0.087], [0.8, 0.1, 0.05], 0.4, 0.3, { rot: [HALF_PI + 0.41, 0, 0] })); }
  // footpegs with heel plates, and the rear brake / gear levers
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.012, 0.11, 0.09), [sx * 0.175, 0.47, -0.17], ALU, 0.3, 0.95, { rot: [0.2, 0, 0] }));
    parts.push(tube([sx * 0.18, BIKE_PEG[1], BIKE_PEG[2]], [sx * 0.26, BIKE_PEG[1], BIKE_PEG[2]], 0.011, DARK, 0.6, 0.6, 8));
    parts.push(tube([sx * 0.19, 0.41, -0.15], [sx * 0.2, 0.37, -0.02], 0.006, ALU, 0.3, 0.9, 6));
  }
  // the rear hugger (a black arch over the front of the back wheel, on the swing arm)
  parts.push(P(arch(BIKE_R, -0.7, BIKE_R + 0.03, -0.15, 1.0, 0.075), [0, 0, 0], [0.05, 0.05, 0.055], 0.5, 0.2));
  // under the tail: the plate holder, the plate (no numbers of any real country), two indicators
  parts.push(beam([0, 0.89, -0.78], [0, 0.66, -0.99], 0.11, 0.012, 0.012, [0.04, 0.04, 0.045], 0.6, 0.2));
  parts.push(P(box(0.16, 0.1, 0.006), [0, 0.62, -1.0], [0.9, 0.88, 0.78], 0.5, 0, { rot: [-0.25, 0, 0] }));
  parts.push(P(box(0.12, 0.016, 0.007), [0, 0.63, -1.003], [0.08, 0.08, 0.09], 0.7, 0, { rot: [-0.25, 0, 0] }));
  for (const sx of [-1, 1]) {
    parts.push(tube([sx * 0.04, 0.78, -0.88], [sx * 0.1, 0.785, -0.9], 0.006, DARK, 0.5, 0.4, 6));
    parts.push({ geom: box(0.03, 0.014, 0.02), pos: [sx * 0.11, 0.786, -0.9], ...AMBER });
  }
  // the exhaust (right side): pipes from the front of the engine, under it, to a short angular titanium can
  for (const sx of [-1, 1]) parts.push(tube([sx * 0.06, 0.55, 0.36], [sx * 0.05, 0.25, 0.3], 0.022, TITAN, 0.35, 0.95));
  parts.push(tube([0, 0.24, 0.3], [-0.09, 0.25, -0.06], 0.03, TITAN, 0.35, 0.95));
  parts.push(tube([-0.09, 0.25, -0.06], [-0.19, 0.26, -0.15], 0.03, TITAN, 0.35, 0.95));
  {
    // the can: from (-0.19, 0.26, -0.15) back and up to (-0.25, 0.36, -0.5), eight flat sides
    const a = new THREE.Vector3(-0.19, 0.26, -0.15), b = new THREE.Vector3(-0.25, 0.36, -0.5);
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const at = (t) => a.clone().addScaledVector(dir, t);
    const can = cyl(0.068, 0.058, len - 0.05, 8); can.applyQuaternion(q);
    parts.push(P(can, at((len - 0.05) / 2).toArray(), TITAN, 0.3, 0.95));
    const capG = cyl(0.06, 0.048, 0.05, 8); capG.applyQuaternion(q);
    parts.push(P(capG, at(len - 0.025).toArray(), [0.08, 0.08, 0.085], 0.35, 0.3));
    const end = new THREE.CircleGeometry(0.03, 12);
    end.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    parts.push(P(end, at(len + 0.001).toArray(), [0.01, 0.01, 0.01], 1, 0));
  }
  const body = mergeParts(parts);
  for (const g of new Set(parts.map((p) => p.geom))) g.dispose();

  // ================= THE FRONT (it turns) =================
  // steer space: (0, 0, 0) = the steering head; the axis of the fork is -y (vehicle.js leans it back by the rake)
  const len = 0.72;                                  // from the steering head down to the front axle (it then sits at the wheel's height)
  const fp = [];
  for (const sx of [-1, 1]) {
    // upside-down fork: the thick golden tubes on top, thin polished tubes below, black axle feet
    fp.push(P(cyl(0.034, 0.034, 0.44, 14), [sx * 0.105, -0.19, 0], GOLD, 0.25, 1));
    fp.push(P(cyl(0.036, 0.036, 0.03, 14), [sx * 0.105, -0.41, 0], DARK, 0.4, 0.6));
    fp.push(P(cyl(0.024, 0.024, 0.26, 12), [sx * 0.105, -0.55, 0], [0.75, 0.76, 0.78], 0.12, 1));
    fp.push(P(box(0.05, 0.1, 0.07), [sx * 0.105, -len + 0.02, 0], DARK, 0.4, 0.6));
    fp.push(P(cyl(0.012, 0.012, 0.03, 8), [sx * 0.105, 0.045, 0], DARK, 0.4, 0.6));          // (the adjusters on top)
  }
  fp.push(P(box(0.27, 0.03, 0.085), [0, 0.02, -0.005], ALU, 0.3, 0.95));                 // top clamp
  fp.push(P(box(0.26, 0.04, 0.075), [0, -0.13, 0], ALU, 0.3, 0.95));                     // bottom clamp
  fp.push(P(cyl(0.02, 0.02, 0.03, 10), [0, 0.045, -0.005], SILVER, 0.2, 1));              // the steering nut
  for (const sx of [-1, 1]) {
    // clip-on bars under the top clamp: a bar, a black grip, the lever in front, a silver bar-end weight
    fp.push(tube([sx * 0.105, -0.03, 0.0], [sx * 0.26, -0.045, -0.035], 0.012, DARK, 0.5, 0.6, 8));
    fp.push(tube([sx * 0.24, -0.042, -0.03], [sx * 0.34, -0.05, -0.05], 0.018, SEAT, 0.85, 0, 10));
    fp.push(P(cyl(0.02, 0.02, 0.024, 10), [sx * 0.352, -0.051, -0.052], SILVER, 0.2, 1, { rot: [0, -sx * 0.2, HALF_PI] }));
    fp.push(tube([sx * 0.17, -0.025, 0.03], [sx * 0.33, -0.035, 0.035], 0.006, ALU, 0.3, 0.9, 6));
    fp.push(P(box(0.045, 0.035, 0.04), [sx * 0.155, -0.03, 0.0], DARK, 0.4, 0.4));        // switch box / brake fluid pot
  }
  // the front fender: an arch over the wheel, made in the wheel's own space and turned into steer space
  {
    const f = arch(0, 0, BIKE_R + 0.03, -0.55, 0.9, 0.07);
    f.applyMatrix4(new THREE.Matrix4().makeRotationX(BIKE_RAKE));
    f.translate(0, -len, 0);
    fp.push(PAINT(f));
  }
  const front = mergeParts(fp);
  for (const g of new Set(fp.map((p) => p.geom))) g.dispose();

  // ================= the kickstand (left side; shown when the bike is parked) =================
  // its foot reaches the ground when the bike leans by BIKE_PARK_LEAN
  const foot = [0.33, 0.33 * Math.tan(-BIKE_PARK_LEAN) + 0.012, -0.03];
  const kp = [tube([0.13, 0.36, -0.06], foot, 0.011, DARK, 0.5, 0.6, 8), P(box(0.05, 0.012, 0.04), [foot[0], foot[1] - 0.006, foot[2]], DARK, 0.6, 0.5, { rot: [0, 0, -BIKE_PARK_LEAN] })];
  const kick = mergeParts(kp);
  for (const p of kp) p.geom.dispose();

  built = { body, front, kick, forkLen: len };
  return built;
}

// The same bike in one colour: the painted parts take it (one copy per colour)
const byColor = new Map();
export function bikeBodyIn(color) {
  const key = color.map((c) => c.toFixed(3)).join(',');
  if (byColor.has(key)) return byColor.get(key);
  const b = makeBike();
  const paint = (g) => {
    const out = g.clone();
    const col = out.attributes.color, dat = out.attributes.aData;
    for (let i = 0; i < col.count; i++) if (dat.getZ(i) > 0.5) col.setXYZ(i, color[0], color[1], color[2]);
    return out;
  };
  const r = { body: paint(b.body), front: paint(b.front), kick: b.kick, forkLen: b.forkLen };
  byColor.set(key, r);
  return r;
}
