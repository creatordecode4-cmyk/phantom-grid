// ---------------------------------------------------------------------------
// carParts.js - the inside of a car and the cutting of car bodies into parts.
//
//   makeInterior   floor, seats, dashboard, steering wheel (seen through the glass)
//   makeDriver     a simple person sitting behind the wheel
//   splitBody      cuts a car body made in code into: body, glass, two front
//                  doors (each with its window). Model files are already cut
//                  by the build script.
//   assembleModel  takes the named parts of a model file and hangs them into
//                  the moving groups of a car
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mergeParts } from '../utils/geometry.js';
import { lin } from '../city/models.js';

const P = (geom, pos, color, rough, metal, more = {}) => ({ geom, pos, color: lin(color), rough, metal, ...more });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// where the driver sits (the left seat = +x)
export function seatOf(info) {
  if (info.seat) return info.seat;
  return { x: info.halfWidth * 0.42, y: info.door.y0 + 0.02, z: (info.door.z0 + info.door.z1) / 2 - 0.12 };
}

// Seats, floor, dashboard and steering wheel as ONE geometry (drawn with the prop material).
export function makeInterior(info) {
  const s = seatOf(info), hw = info.halfWidth;
  const leather = [0.2, 0.15, 0.12], dark = [0.05, 0.05, 0.055], trim = [0.13, 0.13, 0.14];
  // low cars get lower seats, so nothing pokes through the roof
  const k = Math.min(1, Math.max(0.55, (info.roof - 0.14 - s.y) / 0.95));
  const parts = [];
  const zBack = info.wheelZ[0] + 0.15, zFront = info.wheelZ[1] - 0.1;
  // floor and the walls under the windows
  parts.push(P(box((hw - 0.1) * 2, 0.04, zFront - zBack), [0, s.y - 0.1, (zFront + zBack) / 2], dark, 0.9, 0));
  const seat = (x, z, wide) => {
    parts.push(P(box(wide, 0.13, 0.5), [x, s.y + 0.05, z], leather, 0.6, 0));                                   // cushion
    parts.push(P(box(wide, 0.62 * k, 0.12), [x, s.y + 0.1 + 0.3 * k, z - 0.3], leather, 0.6, 0, { rot: [-0.2 - (1 - k) * 0.5, 0, 0] })); // back rest
    parts.push(P(box(wide * 0.55, 0.15 * k, 0.1), [x, s.y + 0.1 + 0.68 * k, z - 0.38 - (1 - k) * 0.2], leather, 0.6, 0));                  // head rest
  };
  seat(s.x, s.z, 0.46); seat(-s.x, s.z, 0.46);
  // back seat, when there is room for one
  if (s.z - 0.95 > zBack + 0.2) { parts.push(P(box(hw * 1.5, 0.13, 0.48), [0, s.y + 0.05, s.z - 0.92], leather, 0.6, 0)); parts.push(P(box(hw * 1.5, 0.55 * k, 0.12), [0, s.y + 0.1 + 0.27 * k, s.z - 1.2], leather, 0.6, 0, { rot: [-0.22, 0, 0] })); }
  // dashboard, a glowing screen, the middle console and the steering wheel
  const dz = Math.min(s.z + 0.82, zFront - 0.05);
  parts.push(P(box((hw - 0.14) * 2, 0.3 * k, 0.34), [0, s.y + 0.1 + 0.32 * k, dz], trim, 0.7, 0));
  // (a soft glow: in a close-up at night a brighter screen burned out into a white-blue block)
  parts.push(P(box(0.34, 0.14 * k, 0.02), [0, s.y + 0.1 + 0.4 * k, dz - 0.18], [0.12, 0.3, 0.4], 0.2, 0, { glow: 0.08 }));
  parts.push(P(box(0.2, 0.2, 0.9), [0, s.y + 0.05, s.z + 0.2], trim, 0.7, 0));
  parts.push(P(box(0.05, 0.05, 0.22), [s.x, s.y + 0.1 + 0.4 * k, dz - 0.16], dark, 0.5, 0));
  const g = mergeParts(parts);
  // the steering wheel is its own small part (it turns): remember where it sits and where the driver's eyes are
  g.userData.wheel = [s.x, s.y + 0.1 + 0.42 * k, dz - 0.26];
  g.userData.eye = [s.x, s.y + 0.16 + 0.68 * k, s.z - 0.1 - (1 - k) * 0.3];
  return g;
}

// A simple driver: body, head, arms on the wheel. Sits in the left seat.
export function makeDriver(info) {
  const s = seatOf(info);
  const jacket = [0.1, 0.11, 0.13], skin = [0.7, 0.53, 0.42], hair = [0.1, 0.08, 0.07];
  // in a low car the driver leans back, so the head stays under the roof
  const k = Math.min(1, Math.max(0.55, (info.roof - 0.14 - s.y) / 0.95));
  const back = (1 - k) * 0.35;
  const parts = [
    P(box(0.4, 0.52 * k, 0.22), [s.x, s.y + 0.14 + 0.28 * k, s.z - 0.12 - back * 0.5], jacket, 0.85, 0, { rot: [-0.14 - (1 - k) * 0.6, 0, 0] }),
    P(new THREE.SphereGeometry(0.108, 8, 6), [s.x, s.y + 0.16 + 0.66 * k, s.z - 0.17 - back], skin, 0.7, 0),
    P(new THREE.SphereGeometry(0.113, 8, 5), [s.x, s.y + 0.19 + 0.66 * k, s.z - 0.19 - back], hair, 0.8, 0),
    P(box(0.34, 0.14, 0.42), [s.x, s.y + 0.16, s.z + 0.1], [0.2, 0.21, 0.25], 0.85, 0),   // legs
  ];
  for (const sx of [-1, 1]) parts.push(P(box(0.09, 0.09, 0.46), [s.x + sx * 0.2, s.y + 0.12 + 0.38 * k, s.z + 0.14], jacket, 0.85, 0, { rot: [0.25, 0, 0] }));
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// Cut a car body made in code into parts.
//   geometry: the body without wheels;  color: the paint of this car [r, g, b]
// Returns plain geometries: { body, glass, doors: [{ side: +1 / -1, origin, paint, glass }] }
// ---------------------------------------------------------------------------
export function splitBody(geometry, info, color) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, col = geometry.attributes.color, dat = geometry.attributes.aData, idx = geometry.index;
  const corner = (i) => {
    const d = [dat.getX(i), dat.getY(i), dat.getZ(i), dat.getW(i)];
    // the paint parts take the color of this car now
    const k = d[2];
    const c = [col.getX(i) * (1 - k + k * color[0]), col.getY(i) * (1 - k + k * color[1]), col.getZ(i) * (1 - k + k * color[2])];
    // (k is kept as "aPaint": the paint can be changed later - Mace's paint shop in Chapter 2)
    return { p: [pos.getX(i), pos.getY(i), pos.getZ(i)], n: [nor.getX(i), nor.getY(i), nor.getZ(i)], c, d: [d[0], d[1], 0, d[3]], k };
  };
  const tris = [];
  for (let t = 0; t < idx.count; t += 3) tris.push([corner(idx.getX(t)), corner(idx.getX(t + 1)), corner(idx.getX(t + 2))]);
  const isGlass = (tri) => tri[0].d[1] > 0.85 && tri[0].d[0] < 0.1;
  const mix = (a, b, k) => ({ p: a.p.map((q, i) => q + (b.p[i] - q) * k), n: a.n.map((q, i) => q + (b.n[i] - q) * k), c: a.c, d: a.d, k: a.k });
  // cut one triangle with a flat plane; returns the pieces on both sides
  const split = (tri, axis, value) => {
    const d = tri.map((q) => q.p[axis] - value);
    if (d.every((q) => q >= 0)) return [[tri], []];
    if (d.every((q) => q <= 0)) return [[], [tri]];
    const hi = [], lo = [];
    for (let i = 0; i < 3; i++) {
      const a = tri[i], b = tri[(i + 1) % 3], da = d[i], db = d[(i + 1) % 3];
      if (da >= 0) hi.push(a); if (da <= 0) lo.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const m = mix(a, b, da / (da - db)); hi.push(m); lo.push(m); }
    }
    const fan = (poly) => { const out = []; for (let i = 1; i < poly.length - 1; i++) out.push([poly[0], poly[i], poly[i + 1]]); return out; };
    return [fan(hi), fan(lo)];
  };
  const D = info.door, top = info.roof + 0.1;
  const out = { body: [], glass: [], l: [], lg: [], r: [], rg: [] };
  for (const tri of tris) {
    let pieces = [tri];
    for (const [name, sx] of [['l', 1], ['r', -1]]) {
      const next = [];
      for (const q of pieces) {
        let ins = [q];
        const cut = (axis, value, keepHi) => { const keep = []; for (const t of ins) { const [hi, lo] = split(t, axis, value); keep.push(...(keepHi ? hi : lo)); next.push(...(keepHi ? lo : hi)); } ins = keep; };
        cut(0, info.halfWidth * 0.5 * sx, sx > 0); cut(2, D.z0, true); cut(2, D.z1, false); cut(1, D.y0 - 0.02, true); cut(1, top, false);
        for (const t of ins) out[isGlass(t) ? name + 'g' : name].push(t);
      }
      pieces = next;
    }
    for (const t of pieces) out[isGlass(t) ? 'glass' : 'body'].push(t);
  }
  const build = (list, origin = [0, 0, 0]) => {
    const n = list.length * 3;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), nn = new Float32Array(n * 3), c = new Float32Array(n * 3), d = new Float32Array(n * 4), k = new Float32Array(n);
    let i = 0;
    for (const t of list) for (const q of t) {
      p.set([q.p[0] - origin[0], q.p[1] - origin[1], q.p[2] - origin[2]], i * 3); nn.set(q.n, i * 3); c.set(q.c, i * 3); d.set(q.d, i * 4); k[i] = q.k || 0; i++;
    }
    g.setAttribute('aPaint', new THREE.BufferAttribute(k, 1));
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aData', new THREE.BufferAttribute(d, 4));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  };
  const doors = [['l', 1], ['r', -1]].map(([name, sx]) => {
    // the hinge: the front edge of the door, at the outside of the body
    let hx = 0; for (const t of out[name]) for (const q of t) if (q.p[2] > D.z1 - 0.15) hx = Math.max(hx, q.p[0] * sx);
    const origin = [sx * (hx || info.halfWidth), 0, D.z1];
    return { side: sx, origin, paint: build(out[name], origin), glass: build(out[name + 'g'], origin) };
  });
  return { body: build(out.body), glass: build(out.glass), doors };
}
