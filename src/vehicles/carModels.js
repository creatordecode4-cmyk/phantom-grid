// ---------------------------------------------------------------------------
// carModels.js - the four car types, built in code (no model files):
//   sedan, suv, van (a shuttle pod) and coupe (a low sports car).
//
// Cars of the year 2090: smooth bodies, glass roofs, thin light bars, no
// grille and no mirrors - but real sizes and real proportions.
//
// A car body is made from "rings": cross-sections from the back to the front.
// For each ring:  z = position,  yb = bottom,  ys = shoulder (below the
// windows),  yt = top,  wb / ws / wt = half width at bottom / shoulder / top.
//
// Every vertex stores its own color, how shiny / metallic it is and whether
// it is "paint" (paint takes the color of the single car).
// Model space: y is up, the ground is y = 0, the nose points to +z.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MeshBuilder, mergeParts } from '../utils/geometry.js';
import { lin } from '../city/models.js';
import { makeLightWheel } from './wheelDetail.js';

const HALF_PI = Math.PI / 2;
const RUBBER = [0.035, 0.035, 0.04];
const P = (geom, pos, color, rough, metal, more = {}) => ({ geom, pos, color: lin(color), rough, metal, ...more });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// How every car type drives (used by vehicle.js and by the traffic).
//   topSpeed in km/h, accel in m/s2, grip: how well it holds the road,
//   roll: how much the body leans in corners
//   mass in kg, drive: 'fwd' front wheels push, 'rwd' rear wheels, 'awd' all four
//   armor: how well it takes hits, tone: how the engine sounds
export const CAR_TYPES = {
  sedan: { label: 'SEDAN', topSpeed: 165, accel: 7.5, grip: 1.0, roll: 1.0, mass: 1500, drive: 'fwd', armor: 1, tone: 'smooth', role: 'car' },
  suv: { label: 'SUV', topSpeed: 150, accel: 6.4, grip: 0.9, roll: 1.45, mass: 2000, drive: 'awd', armor: 1.2, tone: 'smooth', role: 'car' },
  van: { label: 'VAN', topSpeed: 125, accel: 4.8, grip: 0.82, roll: 1.6, mass: 2400, drive: 'rwd', armor: 1.3, tone: 'rumble', role: 'car' },
  coupe: { label: 'SPORTS COUPE', topSpeed: 182, accel: 10.5, grip: 1.15, roll: 0.7, mass: 1350, drive: 'rwd', armor: 0.9, tone: 'muscle', role: 'car' },
};

const CAR_SPECS = {
  // low electric fastback: one smooth arc from nose to tail, glass roof
  sedan: {
    wheelR: 0.34, wheelX: 0.86, wheelZ: [-1.42, 1.5], door: [-0.62, 0.42],
    rings: [
      { z: -2.36, yb: 0.36, ys: 0.84, yt: 0.9, wb: 0.7, ws: 0.8, wt: 0.7 },
      { z: -2.2, yb: 0.22, ys: 0.92, yt: 1.02, wb: 0.86, ws: 0.92, wt: 0.8 },
      { z: -1.5, yb: 0.19, ys: 0.94, yt: 1.2, wb: 0.89, ws: 0.935, wt: 0.72 },
      { z: -0.7, yb: 0.19, ys: 0.94, yt: 1.37, wb: 0.89, ws: 0.94, wt: 0.62 },
      { z: 0.35, yb: 0.19, ys: 0.93, yt: 1.36, wb: 0.89, ws: 0.94, wt: 0.62 },
      { z: 1.25, yb: 0.19, ys: 0.9, yt: 1.0, wb: 0.89, ws: 0.935, wt: 0.8 },
      { z: 2.0, yb: 0.2, ys: 0.78, yt: 0.84, wb: 0.87, ws: 0.9, wt: 0.76 },
      { z: 2.3, yb: 0.24, ys: 0.62, yt: 0.7, wb: 0.8, ws: 0.84, wt: 0.68 },
      { z: 2.38, yb: 0.32, ys: 0.54, yt: 0.6, wb: 0.62, ws: 0.7, wt: 0.56 },
    ],
    // what is between ring i and ring i+1
    gaps: ['body', 'glass', 'cabin', 'cabin', 'glass', 'body', 'body', 'body'],
  },
  // tall rounded crossover
  suv: {
    wheelR: 0.38, wheelX: 0.88, wheelZ: [-1.45, 1.5], door: [-0.55, 0.5],
    rings: [
      { z: -2.34, yb: 0.42, ys: 0.98, yt: 1.06, wb: 0.74, ws: 0.84, wt: 0.74 },
      { z: -2.2, yb: 0.28, ys: 1.06, yt: 1.3, wb: 0.9, ws: 0.95, wt: 0.82 },
      { z: -1.7, yb: 0.25, ys: 1.08, yt: 1.62, wb: 0.92, ws: 0.96, wt: 0.7 },
      { z: 0.3, yb: 0.25, ys: 1.08, yt: 1.66, wb: 0.92, ws: 0.965, wt: 0.7 },
      { z: 1.2, yb: 0.25, ys: 1.04, yt: 1.14, wb: 0.92, ws: 0.96, wt: 0.84 },
      { z: 2.0, yb: 0.27, ys: 0.92, yt: 0.98, wb: 0.9, ws: 0.93, wt: 0.8 },
      { z: 2.28, yb: 0.32, ys: 0.72, yt: 0.82, wb: 0.84, ws: 0.88, wt: 0.72 },
      { z: 2.36, yb: 0.4, ys: 0.62, yt: 0.7, wb: 0.66, ws: 0.74, wt: 0.6 },
    ],
    gaps: ['body', 'glass', 'cabin', 'glass', 'body', 'body', 'body'],
  },
  // self-driving shuttle pod: the same rounded shape at both ends, glass all around
  van: {
    wheelR: 0.35, wheelX: 0.93, wheelZ: [-1.7, 1.7], door: [-0.2, 1.1],
    rings: [
      { z: -2.6, yb: 0.5, ys: 1.0, yt: 1.5, wb: 0.72, ws: 0.82, wt: 0.74 },
      { z: -2.42, yb: 0.3, ys: 1.05, yt: 1.95, wb: 0.94, ws: 0.99, wt: 0.88 },
      { z: -2.0, yb: 0.27, ys: 1.05, yt: 2.12, wb: 0.98, ws: 1.02, wt: 0.92 },
      { z: 2.0, yb: 0.27, ys: 1.05, yt: 2.12, wb: 0.98, ws: 1.02, wt: 0.92 },
      { z: 2.42, yb: 0.3, ys: 1.05, yt: 1.95, wb: 0.94, ws: 0.99, wt: 0.88 },
      { z: 2.6, yb: 0.5, ys: 1.0, yt: 1.5, wb: 0.72, ws: 0.82, wt: 0.74 },
    ],
    gaps: ['glass', 'body', 'cabin', 'body', 'glass'],
  },
  // sports coupe: low and wide, long nose, short tail, small cabin set far back
  coupe: {
    wheelR: 0.36, wheelX: 0.9, wheelZ: [-1.38, 1.48], door: [-0.75, 0.3], spoiler: true,
    rings: [
      { z: -2.22, yb: 0.34, ys: 0.8, yt: 0.86, wb: 0.74, ws: 0.86, wt: 0.76 },
      { z: -2.06, yb: 0.2, ys: 0.86, yt: 0.94, wb: 0.91, ws: 0.97, wt: 0.84 },
      { z: -1.45, yb: 0.16, ys: 0.87, yt: 1.06, wb: 0.94, ws: 0.99, wt: 0.7 },
      { z: -0.75, yb: 0.16, ys: 0.87, yt: 1.19, wb: 0.94, ws: 0.99, wt: 0.58 },
      { z: 0.2, yb: 0.16, ys: 0.85, yt: 1.16, wb: 0.94, ws: 0.99, wt: 0.58 },
      { z: 1.0, yb: 0.16, ys: 0.8, yt: 0.88, wb: 0.94, ws: 0.985, wt: 0.82 },
      { z: 1.85, yb: 0.17, ys: 0.68, yt: 0.73, wb: 0.91, ws: 0.95, wt: 0.8 },
      { z: 2.24, yb: 0.2, ys: 0.54, yt: 0.6, wb: 0.84, ws: 0.89, wt: 0.72 },
      { z: 2.36, yb: 0.28, ys: 0.46, yt: 0.51, wb: 0.64, ws: 0.74, wt: 0.58 },
    ],
    gaps: ['body', 'glass', 'cabin', 'glass', 'body', 'body', 'body', 'body'],
  },
};

// Vehicles that come from model files (see vehicleLoader.js) are added here when they are loaded.
const MODEL_INFO = {};
export function registerCar(name, info, spec) {
  CAR_TYPES[name] = { ...spec };
  const hw = info.halfWidth, r = info.wheelR;
  MODEL_INFO[name] = {
    kind: name, model: true, ...info, wheelbase: info.wheelZ[1] - info.wheelZ[0],
    noseY: r * 1.7, noseW: hw * 1.5, tailY: r * 2.15, tailW: hw * 1.45,
    door: { ...info.door, x: hw + 0.012 },
  };
}

// Sizes of a car type that other files need (wheels, lights, door, length).
export function carInfo(kind) {
  if (MODEL_INFO[kind]) return MODEL_INFO[kind];
  const s = CAR_SPECS[kind], first = s.rings[0], last = s.rings[s.rings.length - 1];
  const roof = Math.max(...s.rings.map((r) => r.yt));
  const side = Math.max(...s.rings.map((r) => r.ws));
  return {
    kind, wheelR: s.wheelR, wheelX: s.wheelX, wheelZ: s.wheelZ, wheelbase: s.wheelZ[1] - s.wheelZ[0],
    backZ: first.z, frontZ: last.z, length: last.z - first.z, halfWidth: side, roof,
    noseY: (last.yb + last.yt) / 2 + 0.1, noseW: last.ws * 1.5,
    tailY: first.ys - 0.04, tailW: first.ws * 1.6,
    door: { z0: s.door[0], z1: s.door[1], y0: s.rings[2].yb + 0.16, y1: s.rings[2].ys - 0.02, x: side + 0.012 },
  };
}

// Make normals smooth: every vertex at the same place gets the same normal.
function smoothNormals(geom) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, idx = geom.index;
  const acc = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    fn.subVectors(b, a).cross(c.sub(a)); // length = 2 x area, so big faces count more
    for (const i of [i0, i1, i2]) {
      const k = key(i);
      if (!acc.has(k)) acc.set(k, new THREE.Vector3());
      acc.get(k).add(fn);
    }
  }
  for (let i = 0; i < pos.count; i++) {
    const nrm = acc.get(key(i));
    if (nrm) { fn.copy(nrm).normalize(); nor.setXYZ(i, fn.x, fn.y, fn.z); }
  }
  nor.needsUpdate = true;
}

// The parts of one wheel: tyre, rim with five spokes, hub.
//   sx = +1: the outside of the wheel looks to +x,  -1: to -x
function wheelParts(r, sx, x, y, z, detail = 12) {
  const alloy = [0.62, 0.64, 0.66], dark = [0.05, 0.05, 0.055];
  const out = [];
  const face = { rot: [0, sx * HALF_PI, 0] };
  // tyre: a tube, closed on the outside by the rubber side wall
  out.push(P(new THREE.CylinderGeometry(r, r, 0.24, detail, 1, true), [x, y, z], RUBBER, 0.9, 0, { rot: [0, 0, HALF_PI] }));
  out.push(P(new THREE.RingGeometry(r * 0.66, r, detail), [x + sx * 0.12, y, z], RUBBER, 0.85, 0, face));
  // rim: a dark dish with a bright edge, five spokes and a hub cap
  out.push(P(new THREE.CircleGeometry(r * 0.66, detail), [x + sx * 0.085, y, z], dark, 0.5, 0.6, face));
  out.push(P(new THREE.RingGeometry(r * 0.58, r * 0.68, detail), [x + sx * 0.122, y, z], alloy, 0.25, 0.95, face));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    // the wheels of the player's car get solid spokes, all other cars flat ones (far fewer triangles)
    if (detail > 12) out.push(P(box(0.03, r * 0.6, r * 0.13), [x + sx * 0.112, y + Math.cos(a) * r * 0.32, z + Math.sin(a) * r * 0.32], alloy, 0.25, 0.95, { rot: [a, 0, 0] }));
    else out.push(P(new THREE.PlaneGeometry(r * 0.13, r * 0.6), [x + sx * 0.118, y + Math.cos(a) * r * 0.32, z + Math.sin(a) * r * 0.32], alloy, 0.25, 0.95, { rot: [a, sx * HALF_PI, 0], }));
  }
  out.push(P(new THREE.CircleGeometry(r * 0.15, 8), [x + sx * 0.13, y, z], alloy, 0.2, 1, face));
  return out;
}

// One loose wheel (for the car the player drives: its wheels turn and steer).
// It sits around the origin, its outside looks to +x.
export function makeWheel(kind, radius = null) {
  const r = radius || CAR_SPECS[kind].wheelR;
  const parts = wheelParts(r, 1, 0, 0, 0, 14);
  // the inner side is closed too, because a steered wheel shows it
  parts.push(P(new THREE.CircleGeometry(r, 14), [-0.12, 0, 0], RUBBER, 0.9, 0, { rot: [0, -HALF_PI, 0] }));
  return mergeParts(parts);
}

// The whole car as ONE geometry.
//   opts.wheels = false: without wheels (the player's car adds turning wheels)
export function makeCar(kind, opts = {}) {
  const spec = CAR_SPECS[kind];
  const withWheels = opts.wheels !== false;
  const mb = new MeshBuilder();
  const PAINT = { c: [1, 1, 1], d: [0.28, 0.55, 1, 0] };          // takes the per-car color
  const GLASS = { c: lin([0.05, 0.06, 0.07]), d: [0.05, 0.9, 0, 0] };
  const TRIM = { c: lin([0.06, 0.06, 0.065]), d: [0.7, 0.2, 0, 0] };
  const use = (m) => { mb.color(m.c[0], m.c[1], m.c[2], 1); mb.data(m.d[0], m.d[1], m.d[2], m.d[3]); };

  // points of one ring: right side from the bottom to the top middle, then the left side
  const ringPts = (r) => {
    const half = [
      [r.wb * 0.82, r.yb], [r.wb, r.yb + 0.14], [r.ws, r.yb + (r.ys - r.yb) * 0.62],
      [r.ws * 0.985, r.ys], [r.wt, r.yt], [0, r.yt + 0.035],
    ];
    const pts = half.map(([x, y]) => [x, y, r.z]);
    for (let i = half.length - 2; i >= 0; i--) pts.push([-half[i][0], half[i][1], r.z]);
    return pts;
  };
  const rings = spec.rings.map(ringPts);
  const n = rings[0].length;
  for (let g = 0; g < rings.length - 1; g++) {
    const A = rings[g], B = rings[g + 1];
    const kindG = spec.gaps[g];
    for (let j = 0; j < n - 1; j++) {
      const s = j < 5 ? j : 9 - j; // 0 sill, 1-2 door, 3 window band, 4 top
      let m = PAINT;
      if (s === 0) m = TRIM;
      else if (s === 3 && (kindG === 'cabin' || kindG === 'glass')) m = GLASS;
      else if (s === 4 && (kindG === 'glass' || (kindG === 'cabin' && kind !== 'van'))) m = GLASS; // glass roof
      use(m);
      const p0 = A[j], p1 = A[j + 1], p2 = B[j + 1], p3 = B[j];
      const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
      // which way is "outside"? away from a line through the lower middle of the body
      // (low enough that the flat nose of the coupe still counts as a top side)
      const yMid = (spec.rings[g].yb + spec.rings[g + 1].yb) / 2 + 0.2;
      mb.quadAuto(p0, p1, p2, p3, s === 4 ? [cx * 0.3, 1, 0] : [cx, cy - yMid, 0], 1);
    }
  }
  // close the back and the front
  for (const [ring, dir] of [[rings[0], -1], [rings[rings.length - 1], 1]]) {
    use(PAINT);
    const cy = (ring[0][1] + ring[5][1]) / 2, z = ring[0][2];
    for (let j = 0; j < n; j++) {
      const a = ring[j], b = ring[(j + 1) % n]; // (the last piece closes the bottom)
      const i0 = mb.vertex(0, cy, z + dir * 0.03, 0, 0, dir, 0, 0);
      const i1 = mb.vertex(a[0], a[1], a[2], 0, 0, dir, 0, 0);
      const i2 = mb.vertex(b[0], b[1], b[2], 0, 0, dir, 0, 0);
      if (dir > 0) mb.tri(i0, i1, i2); else mb.tri(i0, i2, i1);
    }
  }
  const body = mb.build(true);
  smoothNormals(body);

  const info = carInfo(kind);
  const last = spec.rings[spec.rings.length - 1], first = spec.rings[0];
  const extra = [], wheelsAt = [];
  for (const z of spec.wheelZ) {
    for (const sx of [-1, 1]) {
      if (withWheels) wheelsAt.push([sx, z]);
      // dark half circle behind the wheel = the wheel arch
      const arch = new THREE.CircleGeometry(spec.wheelR + 0.08, 7, 0, Math.PI);
      extra.push(P(arch, [sx * (spec.wheelX + 0.097), spec.wheelR - 0.02, z], [0.02, 0.02, 0.02], 0.9, 0, { rot: [0, sx * HALF_PI, 0] }));
    }
  }
  // HEADLIGHTS: a thin white light bar across the nose with a brighter lamp at
  // each end. "glow" below 1 = they light up by themselves at dusk and night.
  extra.push(P(box(info.noseW, 0.04, 0.05), [0, info.noseY, last.z + 0.012], [0.9, 0.94, 1.0], 0.1, 0.5, { glow: 0.5 }));
  for (const sx of [-1, 1]) extra.push(P(box(0.26, 0.07, 0.06), [sx * (info.noseW / 2 - 0.1), info.noseY, last.z + 0.016], [1.0, 0.97, 0.9], 0.1, 0.3, { glow: 0.95 }));
  extra.push(P(box(last.ws * 0.9, 0.1, 0.04), [0, last.yb + 0.1, last.z + 0.02], [0.03, 0.03, 0.035], 0.5, 0.3)); // air intake
  // TAIL LIGHTS: a red bar across the back
  extra.push(P(box(info.tailW, 0.045, 0.05), [0, info.tailY, first.z - 0.012], [0.6, 0.03, 0.03], 0.2, 0.3, { glow: 0.45 }));
  extra.push(P(box(0.5, 0.12, 0.03), [0, first.yb + 0.2, first.z - 0.03], [0.8, 0.8, 0.74], 0.5, 0)); // number plate
  // thin dark lines where the doors are
  for (const sx of [-1, 1]) {
    for (const z of [info.door.z0, info.door.z1]) extra.push(P(box(0.012, info.door.y1 - info.door.y0, 0.02), [sx * (info.halfWidth + 0.003), (info.door.y0 + info.door.y1) / 2, z], [0.02, 0.02, 0.02], 0.6, 0.2));
  }
  if (spec.spoiler) extra.push(P(box(first.ws * 1.7, 0.03, 0.2), [0, first.yt + 0.07, first.z + 0.16], [0.05, 0.05, 0.055], 0.4, 0.4));

  const out = new MeshBuilder();
  out.addGeometry(body, null, true);
  out.addGeometry(mergeParts(extra), null, true);
  // the wheels: round tyres with real rims (wheelDetail.js), the right ones turned round
  const LIGHT_RIM = { sedan: 'blade6', suv: 'mesh10', van: 'blade6', coupe: 'twin5' };
  const m = new THREE.Matrix4();
  for (const [sx, z] of wheelsAt) {
    m.makeRotationY(sx < 0 ? Math.PI : 0).setPosition(sx * spec.wheelX, spec.wheelR, z);
    out.addGeometry(makeLightWheel(spec.wheelR, 0.24, LIGHT_RIM[kind] || 'twin5'), m, true);
  }
  return out.build(true);
}
