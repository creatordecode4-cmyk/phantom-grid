// ---------------------------------------------------------------------------
// softShapes.js - SOFT THINGS made in code: a puffy pillow, a blanket that
// lies on a bed and hangs down its sides with folds, a rolled edge.
//
// Every function returns a BufferGeometry with positions, normals and texture
// coordinates (in meters x 2, so a fabric texture repeats every half meter).
// Nothing here is random: the same bed looks the same every time (the small
// wrinkles come from sine waves; "seed" shifts them).
// ---------------------------------------------------------------------------

import * as THREE from 'three';

// a smooth bumpy number between about -1.5 and 1.5 (small wrinkles and lumps)
const wob = (x, z, s) => Math.sin(x * 7.3 + s) * Math.cos(z * 5.1 - s * 1.7) + 0.5 * Math.sin(x * 13.7 - z * 11.3 + s * 2.3);

function build(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// PILLOW lying flat: W wide (x), D deep (z), H high (y). The middle of its underside is (0, 0, 0).
//   o.dent: [x, z, radius, depth] - a hollow where a head lies
//   o.seed: shifts the small lumps
// The top and the bottom meet in a seam half way up (a sewn edge, the corners stick out a little).
// ---------------------------------------------------------------------------
export function pillowGeometry(W, D, H, o = {}) {
  const nu = o.nu || 16, nv = o.nv || 12, seed = o.seed || 1, pos = [], uv = [], idx = [];
  // how full the pillow is at a place: 1 in the middle, 0 at the seam
  const full = (u, v) => Math.sqrt(Math.max(0, (1 - Math.abs(u) ** 3.2) * (1 - Math.abs(v) ** 3.2)));
  for (const top of [true, false]) {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = -1 + (2 * i) / nu, v = -1 + (2 * j) / nv, b = full(u, v);
      // (the stuffing pulls the middle of each side in a little; the corners stay out)
      const x = u * (W / 2) * (1 - 0.06 * b * (1 - Math.abs(v))), z = v * (D / 2) * (1 - 0.06 * b * (1 - Math.abs(u)));
      let y;
      if (top) {
        y = H * (0.5 + 0.5 * b) + H * 0.035 * b * wob(x, z, seed);
        if (o.dent) { const [dx, dz, dr, dd] = o.dent; y -= dd * b * Math.exp(-((x - dx) ** 2 + (z - dz) ** 2) / (dr * dr)); }
      } else y = H * 0.5 * (1 - 0.92 * b);                  // the underside: flat on the bed, the seam lifted
      pos.push(x, y, z); uv.push(x * 2, z * 2);
    }
    const row = nu + 1;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * row + i, b = a + 1, c = a + row + 1, d = a + row;
      if (top) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
    }
  }
  return build(pos, uv, idx);
}

// the outline of a bed top seen from one end: [x, y] points from the hem hanging on one side, over the
// rounded edge, across the top and down the other side. half: half the width of the top, R: the radius of
// its edge, d0 / d1: how far the cloth hangs down at each side (0 = it ends at the edge), off: distance from
// the bed (the inside or the outside of the cloth). The number of points does not depend on "off".
function outline(half, R, d0, d1, off) {
  const pts = [], r = R + off;
  const sideYs = (d) => { const m = Math.max(1, Math.ceil((d - R) / 0.035)); const out = []; for (let k = 0; k < m; k++) out.push(-d + (d - R) * (k / m)); return out; };
  if (d0 > R) {
    for (const y of sideYs(d0)) pts.push([-half - off, y]);
    for (let k = 0; k <= 5; k++) { const a = Math.PI - (k / 5) * (Math.PI / 2); pts.push([-half + R + r * Math.cos(a), -R + r * Math.sin(a)]); }
  } else pts.push([-half, off]);
  const x0 = d0 > R ? -half + R : -half, x1 = d1 > R ? half - R : half;
  const n = Math.max(2, Math.ceil((x1 - x0) / 0.04));
  for (let k = 1; k < n; k++) pts.push([x0 + (x1 - x0) * (k / n), off]);
  if (d1 > R) {
    for (let k = 0; k <= 5; k++) { const a = Math.PI / 2 - (k / 5) * (Math.PI / 2); pts.push([half - R + r * Math.cos(a), -R + r * Math.sin(a)]); }
    for (const y of sideYs(d1).reverse()) pts.push([half + off, y]);
  } else pts.push([half, off]);
  return pts;
}

// ---------------------------------------------------------------------------
// BLANKET (a duvet) lying on a bed top and hanging down its sides.
//   o.w: the width of the bed top (x, centered on 0); o.l: how long a part of it is covered
//        (z from 0 = the blanket's top edge, toward the foot of the bed, to o.l = the foot end)
//   o.drop: [left, right, foot] how far it hangs down (0 = not at all); o.round: the radius of the
//        mattress edge it bends over; o.thick: its thickness; o.folds: how much the hanging parts wave;
//   o.wrinkle: the height of the small wrinkles on top; o.quilt: the depth of the stitched squares (0 = none);
//   o.seed
// The bed top is y = 0; the blanket's top is y = thick.
// ---------------------------------------------------------------------------
export function blanketGeometry(o) {
  const { w, l } = o, thick = o.thick ?? 0.035, R = o.round ?? 0.05, [dl, dr, df] = o.drop || [0.2, 0.2, 0.2];
  const seed = o.seed || 1, folds = o.folds ?? 0.022, wrinkle = o.wrinkle ?? 0.006, quilt = o.quilt ?? 0.007, cell = o.cell || 0.36;
  const gap = 0.004;
  // across (x) and along (z, as an outline from the top edge to the foot), inside and outside of the cloth
  const A = [outline(w / 2, R, dl, dr, gap), outline(w / 2, R, dl, dr, gap + thick)];
  const B = [outline(l / 2, R, 0, df, gap), outline(l / 2, R, 0, df, gap + thick)];
  const ns = A[0].length, nt = B[0].length;
  const pos = [], uv = [], idx = [];
  // the soft dips of the stitched squares (only on the top)
  const line = (t) => { const f = t / cell - Math.floor(t / cell) - 0.5; return Math.exp(-(f * f) / 0.004); };
  for (let side = 0; side < 2; side++) {                   // 0 = the inside (under the cloth), 1 = the outside
    const base = pos.length / 3;
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
      const [x0, ya] = A[side][i], [zz, yb] = B[side][j];
      const z0 = zz + l / 2;
      let x = x0, z = z0, y = Math.min(ya, yb);
      // where it hangs: how far down (0 at the edge .. 1 at the hem)
      const hangX = ya < -R ? Math.min(1, (-ya - R) / Math.max(0.01, (x0 < 0 ? dl : dr) - R)) : 0;
      const hangZ = yb < -R ? Math.min(1, (-yb - R) / Math.max(0.01, df - R)) : 0;
      // folds in the hanging parts: they wave out more toward the hem
      if (hangX > 0) x += Math.sign(x0) * folds * hangX * (0.55 + 0.45 * Math.sin(z0 * 8.5 + seed + Math.sign(x0)));
      if (hangZ > 0) z += folds * hangZ * (0.55 + 0.45 * Math.sin(x0 * 8.5 + seed * 2));
      // the top: small wrinkles and the stitched squares
      const onTop = ya >= -0.001 && yb >= -0.001 ? 1 : 0;
      if (onTop) y += wrinkle * wob(x0, z0, seed) * 0.6 - quilt * Math.max(line(x0 + w / 2), line(z0)) * (side ? 1 : 0.4);
      pos.push(x, y, z); uv.push(x * 2, z * 2);
    }
    for (let j = 0; j < nt - 1; j++) for (let i = 0; i < ns - 1; i++) {
      const a = base + j * ns + i, b = a + 1, c = a + ns + 1, d = a + ns;
      if (side) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
    }
  }
  // the hem: join the inside and the outside all round the edge of the cloth
  const inn = 0, out = ns * nt;
  const ring = [];
  for (let i = 0; i < ns; i++) ring.push(i);                          // the top edge (z = 0)
  for (let j = 1; j < nt; j++) ring.push(j * ns + ns - 1);            // down the right side
  for (let i = ns - 2; i >= 0; i--) ring.push((nt - 1) * ns + i);     // the foot hem
  for (let j = nt - 2; j >= 1; j--) ring.push(j * ns);                // up the left side
  // (the hem has its own points, so the edges of the two big surfaces keep their own light; both of its
  // sides are drawn, so it never looks like a hole)
  const P = (n) => [pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2]];
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length], b = pos.length / 3;
    for (let twice = 0; twice < 2; twice++) for (const n of [inn + p, out + p, out + q, inn + q]) { pos.push(...P(n)); uv.push(0, 0); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b + 4, b + 6, b + 5, b + 4, b + 7, b + 6);
  }
  return build(pos, uv, idx);
}

// ---------------------------------------------------------------------------
// ROLL: a soft rolled edge (the turned-down top of a blanket), lying across x.
//   len: its length, r: its radius; the middle of its underside is (0, 0, 0). The ends are rounded.
// ---------------------------------------------------------------------------
export function rollGeometry(len, r, o = {}) {
  const seg = o.seg || 10, n = Math.max(4, Math.ceil(len / 0.05)), seed = o.seed || 2, pos = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) {
    const t = j / n, x = -len / 2 + len * t;
    const end = Math.min(1, Math.min(t, 1 - t) * len / (r * 1.5));        // the ends close softly
    const rr = r * Math.sqrt(Math.max(0.02, end)) * (1 + 0.06 * Math.sin(x * 9 + seed));
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      // (a little flatter at the bottom, where it lies)
      pos.push(x, r + Math.cos(a) * rr * (Math.cos(a) < 0 ? 0.8 : 1), Math.sin(a) * rr * 1.15);
      uv.push(x * 2, k / seg);
    }
  }
  const row = seg + 1;
  for (let j = 0; j < n; j++) for (let k = 0; k < seg; k++) {
    const a = j * row + k, b = a + 1, c = a + row + 1, d = a + row;
    idx.push(a, b, c, a, c, d);
  }
  return build(pos, uv, idx);
}
