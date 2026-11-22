// ---------------------------------------------------------------------------
// faceSculpt.js - gives a character a new, calm face before it is rigged.
//
// Some models were made with an expression of their own. Theo, for example,
// was generated laughing: mouth wide open, teeth showing. Expressions are
// ADDED to the face a model comes with, so a laughing model can never look
// sad. This file re-sculpts such a face once, when the character loads:
//
//   1. it finds the open mouth on the flat face (faceClean.js): the band of
//      teeth and the dark gaps around them, column by column
//   2. CLOSE: that band is squeezed to one line. The upper lip comes down,
//      the lower lip (and a part of the chin) comes up, so the lips meet.
//   3. CALM: the line where they meet is made flatter, so the corners of the
//      mouth that were pulled up by the laugh come down.
//   4. the teeth in the picture are painted the dark color of the line
//      between closed lips (they are squeezed to a thin line anyway)
//   5. the light directions (normals) of the moved points are worked out new
//
// Then the face is read again and gets its face bones as usual (faceRig.js):
// the calm face is the new "neutral", and every expression works on it.
//
// Only models listed in SCULPT are changed, and only when an open mouth with
// teeth is really found: a new model with a closed mouth is left alone. The
// model files are NOT changed.
// ---------------------------------------------------------------------------

import { flatFace } from './faceClean.js';

// what to do with which model (the name of its file)
//   bottom: where the lower lip starts, measured on the model: [beside the middle, height above the chin] in
//           millimeters (a body of 1.8 m). The top of the opening is the line under the upper lip (found by itself).
//   upper:  how much of the closing the upper lip does (the rest: the lower lip and the chin), in the middle
//   chin:   how much of the lift of the lower lip the chin follows (0..1)
//   soft:   millimeters below the lower lip over which the lift fades to the chin's share
//   narrow: the mouth gets this much narrower (0.1 = 10 %)
//   corners: millimeters the corners of the mouth come down (a laugh pulls them up)
//   cheeks: millimeters the cheeks come down and back (a laugh lifts them)
//   folds:  how much the painted laugh lines from the nose to the mouth are softened (0..1)
export const SCULPT = {
  // Theo was generated laughing: the jaw open 13 mm, the lower lip pulled down in a U, the corners up.
  Theo_Calloway: {
    bottom: [[-38, 79.5], [-36, 77], [-33, 75.5], [-30, 72.5], [-27, 67.5], [-24, 67], [-21, 66], [-18, 65.5], [-12, 65.5], [-6, 65.2],
      [0, 65.2], [6, 66], [12, 66.7], [18, 68], [21, 69.5], [24, 72.7], [27, 74], [30, 75.5], [33, 77.5], [36, 77.5], [38, 79.5]],
    upper: 0.25, chin: 0.75, soft: 20, narrow: 0.06, corners: 3.5, cheeks: 2.2, folds: 0.65,
  },
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sat = (r, g, b) => { const hi = Math.max(r, g, b); return hi > 0 ? (hi - Math.min(r, g, b)) / hi : 0; };

// A: the analysis of autoRig.js. face: from readFace. geo: the geometry (its positions ARE A.positions).
// Returns null when nothing was done, else what was found (for tests).
export function sculptFace(THREE, A, face, geo, material, recipe) {
  if (!recipe || !face) return null;
  const F = flatFace();
  const { GX, GY, CELL, X0, Y0, cellX, cellY, colOf, rowOf } = F;
  const { k, chin, zFace, noseX, tipY, mouthY, mouthHalf, cr, cg, cb, cl, cn } = face;

  // ---- the normal skin of this face: the cheeks beside the mouth ----
  const cheek = [];
  for (let j = rowOf(mouthY + 0.015); j <= rowOf(mouthY + 0.035); j++) for (let i = 0; i < GX; i++) {
    const u = Math.abs(cellX(i) - noseX), c = j * GX + i;
    if (u > 0.025 && u < 0.045 && cn[c]) cheek.push(cl[c]);
  }
  if (cheek.length < 20) return null;
  cheek.sort((a, b) => a - b);
  const skinL = cheek[cheek.length >> 1];
  const teeth = (c) => cn[c] > 0 && sat(cr[c], cg[c], cb[c]) < 0.245 && cl[c] > 0.92 * skinL;
  const dark = (c) => cl[c] < 0.75 * skinL;

  // ---- 1. the open mouth, column by column: its top (the line under the upper lip) and its bottom (the recipe) ----
  const bottomAt = (u) => {                                   // (meters, from the table in millimeters)
    const t = recipe.bottom, um = u * 1000;
    if (um <= t[0][0]) return t[0][1] / 1000;
    for (let n = 1; n < t.length; n++) if (um <= t[n][0]) { const f = (um - t[n - 1][0]) / (t[n][0] - t[n - 1][0]); return (t[n - 1][1] + (t[n][1] - t[n - 1][1]) * f) / 1000; }
    return t[t.length - 1][1] / 1000;
  };
  const uMin = recipe.bottom[0][0] / 1000, uMax = recipe.bottom[recipe.bottom.length - 1][0] / 1000;
  const Top = new Float32Array(GX), Bot = new Float32Array(GX), In = new Uint8Array(GX);
  for (let i = 0; i < GX; i++) {
    const u = cellX(i) - noseX;
    Top[i] = face.lipLine[i];
    Bot[i] = Math.min(Top[i], bottomAt(Math.max(uMin, Math.min(uMax, u))));
    In[i] = u >= uMin && u <= uMax ? 1 : 0;
  }
  // is the mouth really open? (teeth between the lips in the middle; a new model with a closed mouth is left alone)
  let teethN = 0, gapR = 0, gapG = 0, gapB = 0, gapN = 0;
  for (let i = colOf(noseX - 0.015); i <= colOf(noseX + 0.015); i++) for (let j = rowOf(Bot[i]); j <= rowOf(Top[i]); j++) {
    const c = j * GX + i;
    if (teeth(c)) teethN++;
    if (dark(c)) { gapR += cr[c]; gapG += cg[c]; gapB += cb[c]; gapN++; }
  }
  if (teethN < 8) return null;
  // ---- 2. + 3. where the lips meet afterwards ----
  // the upper lip comes down a little in the middle (nothing at the corners), the lower lip comes up to meet it
  const mid = colOf(noseX), upper = recipe.upper === undefined ? 0.25 : recipe.upper, h0 = Top[mid] - Bot[mid];
  const Tgt = new Float32Array(GX), Su = new Float32Array(GX), Sl = new Float32Array(GX);
  for (let i = 0; i < GX; i++) {
    const open = Top[i] - Bot[i], share = upper * Math.min(1, open / Math.max(h0, 1e-4));
    Tgt[i] = Top[i] - open * share;
    Su[i] = Tgt[i] - Top[i]; Sl[i] = Tgt[i] - Bot[i];
  }
  // (the chin: one lift for the whole jaw, the average of the middle of the lower lip)
  let slFar = 0, nFar = 0;
  for (let i = colOf(noseX - 0.02); i <= colOf(noseX + 0.02); i++) { slFar += Sl[i]; nFar++; }
  slFar = (slFar / nFar) * (recipe.chin === undefined ? 0.6 : recipe.chin);
  const soft = (recipe.soft || 16) / 1000, edgeU = Math.max(-uMin, uMax), C = Top, Hh = new Float32Array(GX);
  for (let i = 0; i < GX; i++) Hh[i] = (Top[i] - Bot[i]) / 2;
  const at = (arr, x) => { const f = Math.max(0, Math.min(GX - 1.001, (x - X0) / CELL - 0.5)), i = f | 0, t = f - i; return arr[i] * (1 - t) + arr[i + 1] * t; };
  const narrow = recipe.narrow || 0, corners = (recipe.corners || 0) / 1000, cheeks = (recipe.cheeks || 0) / 1000;
  const close = 1, left = colOf(noseX + uMin), right = colOf(noseX + uMax), span = uMax - uMin;

  // ---- move the points of the face ----
  const pos = A.positions, si = A.skinIndex, sw = A.skinWeight, count = pos.length / 3, head = A.boneIndex.head;
  const old = new Float32Array(pos);
  let moved = 0;
  for (let v = 0; v < count; v++) {
    if (si[v * 4] !== head || sw[v * 4] < 0.999) continue;
    const x = pos[v * 3] / k, y = (pos[v * 3 + 1] - chin) / k, back = -(pos[v * 3 + 2] - zFace) / k;
    if (back > 0.11 || y < -0.01 || y > tipY + 0.03) continue;               // (the mouth part fades out long before the nose; the cheeks reach higher)
    const u = x - noseX, au = Math.abs(u);
    const wH = 1 - smooth(edgeU + 0.006, edgeU + 0.022, au);          // beside the corners: less and less
    if (wH <= 0 && !cheeks) continue;
    const tp = at(Top, x), bt = at(Bot, x), su = at(Su, x), sl = at(Sl, x), tg = at(Tgt, x);
    let ny;
    if (y > tp) ny = y + su * (1 - smooth(0, 0.012, y - tp));                         // above: the upper lip, softly up to the nose
    else if (y < bt) {                                                                 // below: the lower lip, and the chin
      const near = 1 - smooth(0, soft, bt - y), jaw = 1 - smooth(0.07, 0.105, back);
      ny = y + sl * near + slFar * (1 - near) * jaw;
    } else ny = tg + (y - (tp + bt) / 2) * 0.06;                                        // the opening: squeezed to one line
    let nx = x, nz = pos[v * 3 + 2] / k - zFace / k;
    if (narrow) nx = noseX + u * (1 - narrow * (1 - smooth(0.008, 0.022, Math.abs(y - tg))) * (1 - smooth(edgeU + 0.004, edgeU + 0.018, au)));
    ny = y + (ny - y) * wH; nx = x + (nx - x) * wH;
    // the corners of the mouth come down (and the skin around them, softly)
    if (corners) ny -= corners * smooth(0.012, 0.03, au) * (1 - smooth(0.006, 0.02, Math.abs(y - tg))) * (1 - smooth(edgeU + 0.006, edgeU + 0.02, au));
    // the cheeks come down and back (a round hill over each cheek)
    if (cheeks) {
      const hill = (1 - smooth(0.006, 0.022, Math.hypot(au - 0.033, (y - tg - 0.02) * 0.8))) * (1 - smooth(0.06, 0.09, back));
      ny -= cheeks * hill; nz -= cheeks * 0.5 * hill;
    }
    if (Math.abs(ny - y) < 1e-6 && Math.abs(nx - x) < 1e-6 && Math.abs(nz * k + zFace - pos[v * 3 + 2]) < 1e-7) continue;
    pos[v * 3] = nx * k; pos[v * 3 + 1] = chin + ny * k; pos[v * 3 + 2] = zFace + nz * k;
    moved++;
  }
  if (!moved) return null;
  geo.attributes.position.needsUpdate = true;

  // ---- 4. the teeth in the picture: the dark color of the line between closed lips ----
  const gr = gapN ? gapR / gapN : 62, gg = gapN ? gapG / gapN : 30, gb = gapN ? gapB / gapN : 27;
  const { px, gxOf, gyOf, list, g2, data, cv, map } = face;
  for (let n = 0; n < list.length; n++) {
    const i = list[n], x = X0 + (gxOf[i] / 64) * CELL, y = Y0 + (gyOf[i] / 64) * CELL;
    if (Math.abs(x - noseX) > edgeU + 0.004) continue;
    if (y > at(Top, x) + 0.0009 || y < at(Bot, x) - 0.0009) continue;
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const a = smooth(0.32, 0.2, sat(r, g, b)) * smooth(0.75, 0.95, lum(r, g, b) / skinL);
    if (a < 0.01) continue;
    px[i * 4] = r + (gr - r) * a; px[i * 4 + 1] = g + (gg - g) * a; px[i * 4 + 2] = b + (gb - b) * a;
  }
  // ---- the painted laugh lines (nose to mouth corners): their dark creases are lifted toward the skin around them ----
  const folds = recipe.folds || 0;
  if (folds > 0) {
    const sr = F.blur(cr, 2), sg = F.blur(cg, 2), sb = F.blur(cb, 2);
    const tgMid = at(Tgt, noseX);
    for (let n = 0; n < list.length; n++) {
      const i = list[n], gx = gxOf[i] / 64, gy = gyOf[i] / 64, x = X0 + gx * CELL, y = Y0 + gy * CELL, au = Math.abs(x - noseX);
      const m = smooth(0.009, 0.015, au) * (1 - smooth(0.04, 0.052, au)) * smooth(tgMid - 0.002, tgMid + 0.006, y) * (1 - smooth(tipY - 0.006, tipY + 0.004, y))
        * (1 - (1 - smooth(mouthHalf - 0.004, mouthHalf + 0.004, au)) * (1 - smooth(0.004, 0.009, Math.abs(y - at(Top, x)))));   // (not the lips)
      if (m < 0.02) continue;
      const fx = Math.max(0, Math.min(GX - 1.001, gx - 0.5)), fy = Math.max(0, Math.min(GY - 1.001, gy - 0.5)), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, c = iy * GX + ix;
      const bl = (f) => (f[c] * (1 - tx) + f[c + 1] * tx) * (1 - ty) + (f[c + GX] * (1 - tx) + f[c + GX + 1] * tx) * ty;
      const R = bl(sr), G = bl(sg), Bc = bl(sb), r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (lum(r, g, b) >= lum(R, G, Bc)) continue;                                 // (only what is darker than around it)
      const a = folds * m;
      px[i * 4] = r + (R - r) * a; px[i * 4 + 1] = g + (G - g) * a; px[i * 4 + 2] = b + (Bc - b) * a;
    }
  }
  g2.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = map.colorSpace; tex.flipY = map.flipY; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  tex.minFilter = map.minFilter; tex.magFilter = map.magFilter; tex.generateMipmaps = map.generateMipmaps;
  tex.anisotropy = map.anisotropy; tex.channel = map.channel; tex.name = map.name;
  tex.offset.copy(map.offset); tex.repeat.copy(map.repeat); tex.rotation = map.rotation; tex.center.copy(map.center);
  tex.needsUpdate = true;
  material.map = tex; material.needsUpdate = true;
  map.dispose();

  // ---- 5. new light directions for the points that moved (the same at both sides of a seam of the picture) ----
  const nrm = geo.attributes.normal, idx = geo.index.array;
  if (nrm) {
    const key = (v) => `${Math.round(old[v * 3] * 1e5)},${Math.round(old[v * 3 + 1] * 1e5)},${Math.round(old[v * 3 + 2] * 1e5)}`;
    const movedV = new Uint8Array(count);
    for (let v = 0; v < count; v++) if (Math.abs(pos[v * 3] - old[v * 3]) + Math.abs(pos[v * 3 + 1] - old[v * 3 + 1]) > 2e-5) movedV[v] = 1;
    const acc = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (!movedV[a] && !movedV[b] && !movedV[c]) continue;
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const p of [a, b, c]) { const kk = key(p), s = acc.get(kk); if (s) { s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; } else acc.set(kk, n.slice()); }
    }
    const arr = nrm.array;
    for (let v = 0; v < count; v++) {
      if (!movedV[v]) continue;
      const s = acc.get(key(v));
      if (!s) continue;
      const l = Math.hypot(s[0], s[1], s[2]);
      if (l < 1e-12) continue;
      // (A.flip: the model was turned around; the normals of the geometry are already in rig space, like the positions)
      arr[v * 3] = s[0] / l; arr[v * 3 + 1] = s[1] / l; arr[v * 3 + 2] = s[2] / l;
    }
    nrm.needsUpdate = true;
  }
  const cols = [];
  for (let i = colOf(noseX + uMin); i <= colOf(noseX + uMax); i += 2) cols.push([Math.round((cellX(i) - noseX) * 1000), Math.round(Top[i] * 10000) / 10, Math.round(Bot[i] * 10000) / 10, Math.round(Tgt[i] * 10000) / 10]);
  return { moved, span, opening: h0, chinLift: slFar, teeth: teethN, skinL, cols };
}
