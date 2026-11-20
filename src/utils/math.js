// ---------------------------------------------------------------------------
// math.js - small math helpers used everywhere in the game.
// ---------------------------------------------------------------------------

// Keep a number between a minimum and a maximum.
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Blend from a to b. t = 0 gives a, t = 1 gives b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smooth 0..1 ramp between two edges (same as the GLSL function).
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Frame-rate independent smoothing.
// Moves "current" toward "target". Bigger lambda = faster.
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

// Shortest signed difference between two angles (radians).
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Seeded random numbers.
// The city must look the same every time, so we never use Math.random()
// for the world. Same seed in = same city out.
// ---------------------------------------------------------------------------
export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  // Random number from 0 (included) to 1 (not included).
  next() {
    // "mulberry32" - tiny and fast generator.
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // Random number between a and b.
  range(a, b) {
    return a + (b - a) * this.next();
  }
  // Random whole number between a and b (both included).
  int(a, b) {
    return Math.floor(a + (b - a + 1) * this.next());
  }
  // True with probability p (0..1).
  chance(p) {
    return this.next() < p;
  }
  // Pick one item from an array.
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  // Make a new generator that depends on this one (for sub-tasks).
  fork() {
    return new RNG(Math.floor(this.next() * 4294967296));
  }
}

// Quick repeatable "random" value 0..1 from two numbers (no state).
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// 2D polygon helpers. Points are {x, z}. Polygons are convex and listed
// counter-clockwise in the (x, z) plane.
// ---------------------------------------------------------------------------

// Signed area (positive when the points go counter-clockwise).
export function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a * 0.5;
}

// Cut a convex polygon with a straight line and keep one side.
// We keep the points where  nx * x + nz * z + c >= 0.
// Every point also carries "edge" info (data about the edge that starts
// at this point). The new edge made by the cut gets "newEdge".
export function clipConvex(poly, nx, nz, c, newEdge) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % n];
    const dc = nx * cur.x + nz * cur.z + c;
    const dn = nx * nxt.x + nz * nxt.z + c;
    const curIn = dc >= 0;
    const nxtIn = dn >= 0;
    if (curIn) out.push({ x: cur.x, z: cur.z, edge: cur.edge });
    if (curIn !== nxtIn) {
      const t = dc / (dc - dn);
      const ix = cur.x + (nxt.x - cur.x) * t;
      const iz = cur.z + (nxt.z - cur.z) * t;
      // Leaving the kept side: the next edge runs along the cut line.
      // Entering the kept side: the rest of the old edge continues.
      out.push({ x: ix, z: iz, edge: curIn ? newEdge : cur.edge });
    }
  }
  return out;
}

// Shrink a convex polygon. Each edge moves inward by its own distance
// (dists[i] belongs to the edge that starts at point i).
export function insetConvex(poly, dists) {
  let out = poly.map((p) => ({ x: p.x, z: p.z, edge: p.edge }));
  const n = poly.length;
  for (let i = 0; i < n && out.length >= 3; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez);
    if (len < 1e-6) continue;
    // Inward normal for a counter-clockwise polygon.
    const nx = -ez / len;
    const nz = ex / len;
    const d = typeof dists === 'number' ? dists : dists[i];
    const c = -(nx * a.x + nz * a.z) - d;
    out = clipConvex(out, nx, nz, c, a.edge);
  }
  return out.length >= 3 && polygonArea(out) > 0.01 ? out : [];
}

// Is the point inside the convex polygon?
export function pointInConvex(poly, x, z) {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if ((b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x) < -1e-6) return false;
  }
  return true;
}

// Bounding rectangle of a polygon.
export function polygonBounds(poly) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

// ---------------------------------------------------------------------------
// Tone mapping in JavaScript. This is the same ACES curve three.js uses on
// the GPU. We need it to work out fog colors that match the sky.
// Input and output are linear RGB arrays [r, g, b].
// ---------------------------------------------------------------------------
export function acesToneMap(rgb, exposure) {
  const r = (rgb[0] * exposure) / 0.6;
  const g = (rgb[1] * exposure) / 0.6;
  const b = (rgb[2] * exposure) / 0.6;
  // sRGB -> ACES input matrix
  let x = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  let y = 0.076 * r + 0.90834 * g + 0.01566 * b;
  let z = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  // curve fit
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  x = fit(x); y = fit(y); z = fit(z);
  // ACES output matrix -> sRGB
  return [
    clamp(1.60475 * x - 0.53108 * y - 0.07367 * z, 0, 1),
    clamp(-0.10208 * x + 1.10813 * y - 0.00605 * z, 0, 1),
    clamp(-0.00327 * x - 0.07276 * y + 1.07602 * z, 0, 1),
  ];
}
