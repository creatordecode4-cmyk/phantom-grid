// ---------------------------------------------------------------------------
// faceClean.js - cleans the face of a scanned character.
//
// The character models come with ONE picture, and light and shadow are already
// painted into it. On some faces that looks like dirt: black patches around
// the eyes, brown smudges on the cheeks. In the dark streets of the game it
// gets worse.
//
// What this file does, once, when a character is loaded:
//   1. it finds the points of the picture that belong to the FRONT OF THE HEAD
//      and notes where on the face each of them is
//   2. it lays the face out flat, as seen from the front (colors and depth),
//      and works out
//        - where the nose is (the only narrow ridge on the middle line)
//        - where the eyes are (the hollows beside the nose, then the row with
//          the most contrast: white, iris, white)
//        - the normal skin color of this face (cheeks and forehead)
//        - how dark every part of the face is on the whole (a blurred copy)
//   3. parts that are much darker than the normal skin are lifted toward it,
//      softly, with no hard edges. Small dark things stay as they are
//      (eyebrows, lashes, wrinkles, the line of the mouth), the eyeballs are
//      almost not touched, the mouth and the chin only a little (a beard
//      stays a beard), and hair above the eyebrows and beside the face not at
//      all. Only a big dark patch in the hollow of an eye is lifted as a
//      whole, right up to its edge.
//
// A face that is clean already hardly changes. The model files are NOT
// changed: only the picture in memory is. The strength comes from
// CONFIG.player.faceClean (0 = off, 1 = normal, 1.4 = strong).
// ---------------------------------------------------------------------------

// the flat face: GX x GY cells of 1.5 mm (at a body height of 1.8 m)
const GX = 128, GY = 144, CELL = 0.0015, X0 = -0.096, Y0 = -0.012;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sat = (r, g, b) => { const hi = Math.max(r, g, b); return hi > 0 ? (hi - Math.min(r, g, b)) / hi : 0; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// a soft blur of a GX x GY field (three passes of a box blur = close to a bell curve)
function blur(src, radius, passes = 3) {
  const a = Float32Array.from(src), b = new Float32Array(GX * GY), sum = new Float64Array(Math.max(GX, GY) + 1);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < GY; y++) {                                        // left - right
      const o = y * GX;
      for (let x = 0; x < GX; x++) sum[x + 1] = sum[x] + a[o + x];
      for (let x = 0; x < GX; x++) { const lo = Math.max(0, x - radius), hi = Math.min(GX - 1, x + radius); b[o + x] = (sum[hi + 1] - sum[lo]) / (hi - lo + 1); }
    }
    for (let x = 0; x < GX; x++) {                                        // up - down
      for (let y = 0; y < GY; y++) sum[y + 1] = sum[y] + b[y * GX + x];
      for (let y = 0; y < GY; y++) { const lo = Math.max(0, y - radius), hi = Math.min(GY - 1, y + radius); a[y * GX + x] = (sum[hi + 1] - sum[lo]) / (hi - lo + 1); }
    }
  }
  return a;
}
// every cell takes the biggest value within "radius" cells (a patch grows by that much)
function grow2(src, radius) {
  const a = new Float32Array(GX * GY), b = new Float32Array(GX * GY);
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    let m = -1e9;
    for (let d = -radius; d <= radius; d++) { const q = x + d; if (q >= 0 && q < GX && src[y * GX + q] > m) m = src[y * GX + q]; }
    a[y * GX + x] = m;
  }
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    let m = -1e9;
    for (let d = -radius; d <= radius; d++) { const q = y + d; if (q >= 0 && q < GY && a[q * GX + x] > m) m = a[q * GX + x]; }
    b[y * GX + x] = m;
  }
  return b;
}
// every cell takes the smallest value within "radius" cells
function shrink2(src, radius) {
  const a = new Float32Array(GX * GY), b = new Float32Array(GX * GY);
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    let m = 1e9;
    for (let d = -radius; d <= radius; d++) { const q = x + d; if (q >= 0 && q < GX && src[y * GX + q] < m) m = src[y * GX + q]; }
    a[y * GX + x] = m;
  }
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    let m = 1e9;
    for (let d = -radius; d <= radius; d++) { const q = y + d; if (q >= 0 && q < GY && a[q * GX + x] < m) m = a[q * GX + x]; }
    b[y * GX + x] = m;
  }
  return b;
}
// the value of a field at a place between its cells
function sample(f, gx, gy) {
  const x = Math.max(0, Math.min(GX - 1.001, gx - 0.5)), y = Math.max(0, Math.min(GY - 1.001, gy - 0.5));
  const ix = x | 0, iy = y | 0, tx = x - ix, ty = y - iy, i = iy * GX + ix;
  return (f[i] * (1 - tx) + f[i + 1] * tx) * (1 - ty) + (f[i + GX] * (1 - tx) + f[i + GX + 1] * tx) * ty;
}

// the middle of a cell of the flat face (meters at a body height of 1.8 m), and the cell of a place
const cellX = (x) => X0 + (x + 0.5) * CELL, cellY = (y) => Y0 + (y + 0.5) * CELL;
const colOf = (x) => Math.max(0, Math.min(GX - 1, Math.floor((x - X0) / CELL))), rowOf = (y) => Math.max(0, Math.min(GY - 1, Math.floor((y - Y0) / CELL)));
// the average of a field over a small box around a place
function boxMean(f, x, y, hw, hh) {
  let s = 0, n = 0;
  for (let j = rowOf(y - hh); j <= rowOf(y + hh); j++) for (let i = colOf(x - hw); i <= colOf(x + hw); i++) { s += f[j * GX + i]; n++; }
  return s / n;
}
// the grid of the flat face, for other files (faceSculpt.js)
export function flatFace() { return { GX, GY, CELL, X0, Y0, cellX, cellY, colOf, rowOf, blur }; }
// the depth of the bare face at a place (x beside the middle of the model, y above the chin; meters at 1.8 m)
export function bareAt(face, x, y) { return sample(face.bare, (x - X0) / CELL, (y - Y0) / CELL); }
// the height of the line where the lips meet, at x beside the middle of the model (meters at 1.8 m, above the chin)
export function lipAt(face, x) {
  const f = Math.max(0, Math.min(GX - 1.001, (x - X0) / CELL - 0.5)), i = f | 0, t = f - i;
  return face.lipLine[i] * (1 - t) + face.lipLine[i + 1] * t;
}

// ===========================================================================
// READ A FACE: lay it out flat and find the nose, the eyes, the mouth and the eyebrows.
//   geo: the character's geometry in rig space (position, uv, index). A: the analysis of autoRig.js (chin height ...).
// Returns null when the model has no bare face (no picture, a mask, a helmet), else what was found.
// All places are in meters at a body height of 1.8 m: x beside the middle of the model (the character's left is +),
// y above the chin, z in front of (+) or behind (-) the foremost point of the face.
// ===========================================================================
export function readFace(geo, material, A) {
  const map = material && material.map, img = map && map.image;
  if (!img || !geo.attributes.uv || !geo.index || !A || !A.info || !A.info.chinY) return null;
  if (map.userData && map.userData.faceCleaned) return null;
  const W = img.width, H = img.height;
  if (!W || !H || W * H > 4200000 || typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g2 = cv.getContext('2d', { willReadFrequently: true });
  let data;
  try { g2.drawImage(img, 0, 0, W, H); data = g2.getImageData(0, 0, W, H); } catch (e) { return null; }   // (a picture that may not be read: leave it)
  const px = data.data;
  const pos = geo.attributes.position.array, uv = geo.attributes.uv.array, idx = geo.index.array;
  const k = A.height / 1.8, chin = A.info.chinY;
  // where a point of the model is in the picture (the picture can be moved, scaled or upside down)
  map.updateMatrix();
  const e = map.matrix.elements, flip = map.flipY;
  const U = (i) => (e[0] * uv[i * 2] + e[3] * uv[i * 2 + 1] + e[6]) * W;
  const V = (i) => { const v = e[1] * uv[i * 2] + e[4] * uv[i * 2 + 1] + e[7]; return (flip ? 1 - v : v) * H; };

  // ---- the front of the face: the frontmost point of the head near the middle line ----
  let zFace = -1e9;
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > chin + 0.03 * k && pos[i + 1] < chin + 0.2 * k && Math.abs(pos[i]) < 0.04 * k && pos[i + 2] > zFace) zFace = pos[i + 2];
  if (zFace < -1e8) return null;
  const zBack = zFace - 0.105 * k;            // the face is the front 10 cm of the head

  // ---- 1. the points of the picture that belong to the face, and where on the face each one is ----
  // gxOf / gyOf: the place on the flat face, in 1/64 of a cell (0 = not a point of the face)
  const gxOf = new Uint16Array(W * H), gyOf = new Uint16Array(W * H);
  const N = GX * GY, cz = new Float32Array(N).fill(-1e9);      // cz: how far forward the face is in every cell of the flat face
  const list = [];                                              // the points of the face (so nothing has to walk over the whole picture)
  let any = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ya = pos[a * 3 + 1] - chin, yb = pos[b * 3 + 1] - chin, yc = pos[c * 3 + 1] - chin;
    if (Math.min(ya, yb, yc) < Y0 * k || Math.max(ya, yb, yc) > (Y0 + GY * CELL) * k) continue;
    if ((pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3 < zBack) continue;
    const xa = pos[a * 3], xb = pos[b * 3], xc = pos[c * 3], za = pos[a * 3 + 2], zb = pos[b * 3 + 2], zc = pos[c * 3 + 2];
    if (Math.max(Math.abs(xa), Math.abs(xb), Math.abs(xc)) > -X0 * k) continue;
    const u0 = U(a), v0 = V(a), u1 = U(b), v1 = V(b), u2 = U(c), v2 = V(c);
    const area = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (Math.abs(area) < 1e-6) continue;
    const x0 = Math.max(0, Math.floor(Math.min(u0, u1, u2) - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(u0, u1, u2) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(v0, v1, v2) - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(v0, v1, v2) + 1));
    if ((x1 - x0) * (y1 - y0) > 60000) continue;             // (a broken triangle that covers half the picture)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const pu = x + 0.5, pv = y + 0.5;
        // where the point is inside the triangle (a little over the edge still counts: the picture is blurred there)
        const w0 = ((u1 - pu) * (v2 - pv) - (u2 - pu) * (v1 - pv)) / area, w1 = ((u2 - pu) * (v0 - pv) - (u0 - pu) * (v2 - pv)) / area, w2 = 1 - w0 - w1;
        if (w0 < -0.2 || w1 < -0.2 || w2 < -0.2) continue;
        const fx = ((xa * w0 + xb * w1 + xc * w2) / k - X0) / CELL, fy = ((ya * w0 + yb * w1 + yc * w2) / k - Y0) / CELL;
        if (fx < 0 || fx >= GX || fy < 0 || fy >= GY) continue;
        const i = y * W + x, qx = Math.max(1, Math.round(fx * 64)), qy = Math.max(1, Math.round(fy * 64));
        const cellAt = Math.min(GY - 1, qy >> 6) * GX + Math.min(GX - 1, qx >> 6), fz = (za * w0 + zb * w1 + zc * w2 - zFace) / k;
        if (fz > cz[cellAt]) cz[cellAt] = fz;
        if (!gxOf[i]) { any++; list.push(i); }
        gxOf[i] = qx; gyOf[i] = qy;
      }
    }
  }
  if (any < 400) return null;
  // (the border around every patch of the picture belongs to it too: grow by two points)
  let rim = list;
  for (let pass = 0; pass < 2; pass++) {
    const next = [];
    for (let n = 0; n < rim.length; n++) {
      const i = rim[n], x = i % W;
      for (let d = 0; d < 4; d++) {
        const j = d === 0 ? (x > 0 ? i - 1 : -1) : d === 1 ? (x < W - 1 ? i + 1 : -1) : d === 2 ? i - W : i + W;
        if (j < 0 || j >= gxOf.length || gxOf[j]) continue;
        gxOf[j] = gxOf[i]; gyOf[j] = gyOf[i]; next.push(j);
      }
    }
    for (let n = 0; n < next.length; n++) list.push(next[n]);
    rim = next;
  }

  // ---- 2. the flat face: the average color of every cell ----
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N), cn = new Float32Array(N);
  for (let n = 0; n < list.length; n++) {
    const i = list[n];
    const c = Math.min(GY - 1, gyOf[i] >> 6) * GX + Math.min(GX - 1, gxOf[i] >> 6);
    cr[c] += px[i * 4]; cg[c] += px[i * 4 + 1]; cb[c] += px[i * 4 + 2]; cn[c]++;
  }
  for (let c = 0; c < N; c++) if (cn[c]) { cr[c] /= cn[c]; cg[c] /= cn[c]; cb[c] /= cn[c]; }
  // (cells nobody painted take the color of their neighbors)
  const seen = Uint8Array.from(cn, (n) => (n ? 1 : 0));
  for (let round = 0; round < 40; round++) {
    let open = 0;
    const was = seen.slice();
    for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
      const c = y * GX + x;
      if (was[c]) continue;
      let r = 0, g = 0, b = 0, z = 0, n = 0;
      if (x > 0 && was[c - 1]) { r += cr[c - 1]; g += cg[c - 1]; b += cb[c - 1]; z += cz[c - 1]; n++; }
      if (x < GX - 1 && was[c + 1]) { r += cr[c + 1]; g += cg[c + 1]; b += cb[c + 1]; z += cz[c + 1]; n++; }
      if (y > 0 && was[c - GX]) { r += cr[c - GX]; g += cg[c - GX]; b += cb[c - GX]; z += cz[c - GX]; n++; }
      if (y < GY - 1 && was[c + GX]) { r += cr[c + GX]; g += cg[c + GX]; b += cb[c + GX]; z += cz[c + GX]; n++; }
      if (n) { cr[c] = r / n; cg[c] = g / n; cb[c] = b / n; cz[c] = z / n; seen[c] = 1; } else open++;
    }
    if (!open) break;
  }
  const cl = new Float32Array(N);
  for (let c = 0; c < N; c++) cl[c] = lum(cr[c], cg[c], cb[c]);

  for (let c = 0; c < N; c++) if (!(cz[c] > -0.08)) cz[c] = -0.08;

  // ---- the nose: the only narrow ridge of a face. Its tip and its line are the anchors for everything else. ----
  const zNear = blur(cz, 1, 1), zFar = blur(cz, 9);
  let noseX = 0, tipY = 0;
  for (let round = 0; round < 2; round++) {
    // the tip: the highest point of the ridge
    let ridgeMax = 0, tipZ = -1e9;
    const prof = [];
    for (let j = 0; j < GY; j++) {
      const y = cellY(j);
      if (y < 0.03 || y > 0.17) continue;
      const mid = boxMean(cz, noseX, y, 0.004, 0.002), ridge = mid - (boxMean(cz, noseX - 0.026, y, 0.004, 0.002) + boxMean(cz, noseX + 0.026, y, 0.004, 0.002)) / 2;
      prof.push([y, mid, ridge]);
      if (ridge > ridgeMax) ridgeMax = ridge;
    }
    if (ridgeMax < 0.008) return null;                     // no nose: this is not a bare face (a mask, a helmet)
    for (const [y, mid, ridge] of prof) if (ridge > 0.6 * ridgeMax && mid > tipZ) { tipZ = mid; tipY = y; }
    if (round) break;
    // the line of the nose: where the ridge is highest, row by row from the tip up (a head is not always exactly in the middle)
    const xs = [];
    for (let j = rowOf(tipY - 0.004); j <= rowOf(tipY + 0.03); j++) {
      let top = -1e9, sw = 0, sx = 0;
      for (let i = colOf(-0.03); i <= colOf(0.03); i++) if (zNear[j * GX + i] > top) top = zNear[j * GX + i];
      for (let i = colOf(-0.03); i <= colOf(0.03); i++) { const w = Math.max(0, zNear[j * GX + i] - (top - 0.004)); sw += w * w; sx += w * w * cellX(i); }
      if (sw > 0) xs.push(sx / sw);
    }
    xs.sort((a, b) => a - b);
    noseX = xs.length ? Math.max(-0.015, Math.min(0.015, xs[xs.length >> 1])) : 0;
  }

  // ---- the eyes ----
  // (a) the eye sockets are the places beside the nose that lie deeper than the face around them
  let socketN = 0, socketX = 0, socketY = 0;
  for (let side = -1; side <= 1; side += 2) {
    let sw = 0, sx = 0, sy = 0;
    for (let j = rowOf(tipY + 0.02); j <= rowOf(tipY + 0.056); j++) for (let i = 0; i < GX; i++) {
      const x = (cellX(i) - noseX) * side;
      if (x < 0.014 || x > 0.056) continue;
      const d = zFar[j * GX + i] - zNear[j * GX + i] - 0.0015;
      if (d <= 0) continue;
      sw += d * d; sx += d * d * x; sy += d * d * cellY(j);
    }
    if (sw > 0) { socketN++; socketX += sx / sw; socketY += sy / sw; }
  }
  let eyeX = socketN ? socketX / socketN : 0.022, eyeY = socketN ? socketY / socketN : tipY + 0.035;
  // (b) the exact row: the one with the most left-right contrast (white, iris, white)
  const soft = blur(cl, 1, 1);
  const edge = (i, j) => { const q = j * GX + Math.max(1, Math.min(GX - 2, i)); return Math.abs(soft[q + 1] - soft[q - 1]) / Math.max(soft[q], 20); };
  const rows = [];
  let most = 0;
  for (let j = Math.max(1, rowOf(eyeY - 0.009)); j <= Math.min(GY - 2, rowOf(eyeY + 0.009)); j++) {
    let en = 0;
    for (let side = -1; side <= 1; side += 2) for (let i = colOf(noseX + side * eyeX - 0.016); i <= colOf(noseX + side * eyeX + 0.016); i++) en += edge(i, j - 1) + edge(i, j) + edge(i, j + 1);
    rows.push([cellY(j), en]);
    if (en > most) most = en;
  }
  let eyesFound = 0;
  if (most > 0) {
    let sw = 0, sy = 0;
    for (const [y, en] of rows) { const w = Math.pow(en / most, 4); sw += w; sy += w * y; }
    eyeY = sy / sw;
    // (c) left - right: the middle of the busy part of that row, on each side of the nose
    let sum = 0, got = 0;
    for (let side = -1; side <= 1; side += 2) {
      let sw2 = 0, sx = 0;
      for (let i = 1; i < GX - 1; i++) {
        const x = (cellX(i) - noseX) * side;
        if (x < 0.014 || x > 0.06) continue;
        let en = 0;
        for (let j = rowOf(eyeY - 0.0045); j <= rowOf(eyeY + 0.0045); j++) en += edge(i, j);
        sw2 += en * en; sx += en * en * x;
      }
      if (sw2 > 0) { sum += sx / sw2; got++; }
    }
    if (got) { eyeX = sum / got; eyesFound = socketN; }
  }
  // (a face has its eyes 2 - 5 cm above the tip of the nose; anything else was a wrong guess)
  if (!eyesFound || eyeY - tipY < 0.02 || eyeY - tipY > 0.05 || eyeX < 0.024 || eyeX > 0.046) { eyesFound = 0; eyeY = tipY + 0.035; eyeX = 0.034; }

  // ---- the mouth: the darkest line across the middle, 2 - 5 cm under the tip of the nose ----
  const rowMean = (j, x0, x1) => { let sum = 0; const i0 = colOf(x0), i1 = colOf(x1); for (let i = i0; i <= i1; i++) sum += soft[j * GX + i]; return sum / (i1 - i0 + 1); };
  let mouthY = tipY - 0.036, mouthScore = 0;
  for (let j = rowOf(tipY - 0.052); j <= rowOf(tipY - 0.02); j++) {
    const y = cellY(j), here = rowMean(j, noseX - 0.016, noseX + 0.016);
    const around = (rowMean(rowOf(y + 0.007), noseX - 0.016, noseX + 0.016) + rowMean(rowOf(y - 0.007), noseX - 0.016, noseX + 0.016)) / 2;
    const score = ((around - here) / Math.max(around, 20)) * (1 - 0.5 * Math.min(1, Math.abs(y - (tipY - 0.036)) / 0.022));     // (close to where a mouth normally is counts more)
    if (score > mouthScore) { mouthScore = score; mouthY = y; }
  }
  // its corners: how far the dark line goes out on each side
  const mj = rowOf(mouthY);
  const lineDark = (i) => {
    const here = Math.min(soft[(mj - 1) * GX + i], soft[mj * GX + i], soft[(mj + 1) * GX + i]), around = (soft[rowOf(mouthY + 0.008) * GX + i] + soft[rowOf(mouthY - 0.008) * GX + i]) / 2;
    return (around - here) / Math.max(around, 20);
  };
  let midDark = 0;
  for (let d = -2; d <= 2; d++) midDark += lineDark(colOf(noseX + d * 0.004)) / 5;
  let mouthHalf = 0;
  for (let side = -1; side <= 1; side += 2) {
    let w = 0.014;
    for (let step = 10; step < 28; step++) { const u = step * CELL; if (lineDark(colOf(noseX + side * u)) > 0.4 * midDark) w = u; else if (u > w + 0.0045) break; }
    mouthHalf += w / 2;
  }
  mouthHalf = Math.max(0.018, Math.min(0.034, mouthHalf));
  // the line where the lips meet, column by column (it curves up in a smile): the darkest row near the mouth line
  const lipLine = new Float32Array(GX).fill(mouthY), raw = new Float32Array(GX).fill(mouthY);
  const i0 = colOf(noseX - mouthHalf - 0.006), i1 = colOf(noseX + mouthHalf + 0.006);
  for (let i = i0; i <= i1; i++) {
    let best = 1e9, bj = mj;
    for (let j = Math.max(1, rowOf(mouthY - 0.006)); j <= Math.min(GY - 2, rowOf(mouthY + 0.007)); j++) {
      const v = soft[j * GX + i] * 2 + soft[j * GX + Math.max(0, i - 1)] + soft[j * GX + Math.min(GX - 1, i + 1)];
      const prefer = 1 + 0.25 * Math.abs(cellY(j) - mouthY) / 0.006;        // (closer to the middle line wins a tie)
      if (v * prefer < best) { best = v * prefer; bj = j; }
    }
    // (between two rows: the bottom of a parabola through three of them)
    const a = soft[(bj - 1) * GX + i], b = soft[bj * GX + i], c = soft[(bj + 1) * GX + i], den = a - 2 * b + c;
    raw[i] = cellY(bj) + (den > 1e-3 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0) * CELL;
  }
  // smoothed along the mouth (the middle of five neighbors, then their average), a mouth is no zig-zag
  const med = new Float32Array(GX).fill(mouthY);
  for (let i = i0; i <= i1; i++) {
    const w = [];
    for (let d = -2; d <= 2; d++) w.push(raw[Math.max(i0, Math.min(i1, i + d))]);
    w.sort((p, q) => p - q);
    med[i] = w[2];
  }
  for (let i = i0; i <= i1; i++) {
    let sum = 0, n = 0;
    for (let d = -2; d <= 2; d++) { const q = i + d; if (q >= i0 && q <= i1) { sum += med[q]; n++; } }
    lipLine[i] = Math.max(mouthY - 0.006, Math.min(mouthY + 0.007, sum / n));
  }
  // how much higher the corners are than the middle (a model that was made smiling)
  const lipAt = (x) => lipLine[colOf(x)];
  const restSmile = ((lipAt(noseX - mouthHalf + 0.002) + lipAt(noseX + mouthHalf - 0.002)) / 2 - lipAt(noseX)) / 0.001;   // millimeters

  // ---- the eyebrows: the dark band above the eyes ----
  let browY = eyeY + 0.016, browScore = 0;
  for (let j = rowOf(eyeY + 0.009); j <= rowOf(eyeY + 0.026); j++) {
    const y = cellY(j);
    let score = 0;
    for (let side = -1; side <= 1; side += 2) {
      const x0 = noseX + side * eyeX - 0.018, x1 = noseX + side * eyeX + 0.018, here = rowMean(j, x0, x1);
      const around = (rowMean(rowOf(y + 0.008), x0, x1) + rowMean(rowOf(y - 0.007), x0, x1)) / 2;
      score += (around - here) / Math.max(around, 20);
    }
    score *= 1 - 0.5 * Math.min(1, Math.abs(y - (eyeY + 0.016)) / 0.012);
    if (score > browScore) { browScore = score; browY = y; }
  }
  browY = Math.max(eyeY + 0.011, Math.min(eyeY + 0.022, browY));

  // thin things that stand out in front of the face are not skin: the frame of glasses, a strand of hair, a ring.
  // (the face without them: every cell takes the lowest depth within 6 mm, then the highest of those again)
  const bare = grow2(shrink2(cz, 4), 4);

  return {
    k, chin, zFace, noseX, tipY, eyeX, eyeY, eyesFound, mouthY, mouthHalf, browY, lipLine, restSmile,
    cr, cg, cb, cl, cn, cz, bare,                              // the flat face: colors, brightness, how many points, depth
    map, cv, g2, data, px, W, H, gxOf, gyOf, list, any,        // the picture (for cleanFace)
  };
}

// ===========================================================================
// CLEAN A FACE (see the top of the file).
//   face: from readFace. strength: 0 = off, 1 = normal. debug: an empty object that is filled with what was found (tests).
// Returns true when the picture was changed.
// ===========================================================================
export function cleanFace(THREE, face, material, strength = 1, debug = null) {
  if (!face || !(strength > 0) || material.map !== face.map) return false;
  const { noseX, tipY, eyeX, eyeY, eyesFound, cr, cg, cb, cl, cn, cz, bare, map, cv, g2, data, px, gxOf, gyOf, list, any } = face;
  const N = GX * GY;
  const grow = eyesFound ? 1 : 1.4;
  // how far a place is beside the line of the nose
  const beside = (fx) => Math.abs(fx - noseX);
  // how much a place belongs to an eyeball: 1 inside, 0 outside (wider when the eyes were only guessed)
  const eyeball = (fx, fy) => { const dx = (beside(fx) - eyeX) / (0.0165 * grow), dy = (fy - eyeY) / (0.0055 * grow); return 1 - smooth(0.75, 1.25, Math.sqrt(dx * dx + dy * dy)); };
  // how much a place belongs to the hollow around an eye (from under the eyebrow down to the top of the cheek)
  const hollow = (fx, fy) => {
    const ax = beside(fx) - eyeX, dy = fy - eyeY;
    return smooth(-0.036, -0.029, ax) * (1 - smooth(0.034, 0.042, ax)) * smooth(-0.031, -0.024, dy) * (1 - smooth(0.0105, 0.014, dy));
  };

  // ---- the normal skin color of this face: the top of the cheeks and the middle of the forehead ----
  const skinHue = (r, g, b) => r > g && g >= b * 0.9 && r - b > 10 && r > 45;
  const inRef = (ax, y) => (ax > 0.028 && ax < 0.06 && y > eyeY - 0.045 && y < eyeY - 0.03) || (ax < 0.02 && y > eyeY + 0.028 && y < eyeY + 0.044);
  const hist = new Uint32Array(256);
  let n = 0;
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    const c = y * GX + x;
    if (!inRef(beside(cellX(x)), cellY(y)) || !skinHue(cr[c], cg[c], cb[c])) continue;
    hist[Math.round(cl[c])]++; n++;
  }
  if (n < 80) return false;
  let Lref = 0;
  for (let acc = 0; Lref < 255; Lref++) { acc += hist[Lref]; if (acc >= n * 0.6) break; }
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    const c = y * GX + x;
    if (!inRef(beside(cellX(x)), cellY(y)) || !skinHue(cr[c], cg[c], cb[c]) || cl[c] < Lref * 0.9 || cl[c] > Lref * 1.1) continue;
    sr += cr[c]; sg += cg[c]; sb += cb[c]; sn++;
  }
  if (sn < 30 || Lref < 40) return false;
  const refR = sr / sn, refG = sg / sn, refB = sb / sn, refS = sat(refR, refG, refB);
  // the normal skin color NEAR every place (cheeks are pinker than a forehead): a wide blur of the skin that is in the light
  const lit = new Float32Array(N), litR = new Float32Array(N), litG = new Float32Array(N), litB = new Float32Array(N);
  for (let c = 0; c < N; c++) {
    if (!skinHue(cr[c], cg[c], cb[c]) || cl[c] < Lref * 0.78 || cl[c] > Lref * 1.3 || cz[c] - bare[c] > 0.002) continue;
    lit[c] = 1; litR[c] = cr[c]; litG[c] = cg[c]; litB[c] = cb[c];
  }
  const nearN = blur(lit, 8), nearR = blur(litR, 8), nearG = blur(litG, 8), nearB = blur(litB, 8);
  for (let c = 0; c < N; c++) {
    const f = Math.min(1, nearN[c] / 0.08);             // (little lit skin around: mix with the color of the whole face)
    nearR[c] = refR + (nearR[c] / Math.max(nearN[c], 1e-4) - refR) * f; nearG[c] = refG + (nearG[c] / Math.max(nearN[c], 1e-4) - refG) * f; nearB[c] = refB + (nearB[c] / Math.max(nearN[c], 1e-4) - refB) * f;
  }

  // ---- painted rings around the eyes? ----
  // On a normal face the skin right under an eye is a little darker than the cheek below it. Where it is MUCH darker
  // (under 0.6 of the cheek) dark rings were painted around the eyes: only then the hollows of the eyes are cleaned as a whole.
  const middle = (side, x0, x1, y0, y1) => {
    const v = [];
    for (let j = rowOf(eyeY + y0); j <= rowOf(eyeY + y1); j++) for (let i = 0; i < GX; i++) {
      const x = (cellX(i) - noseX) * side - eyeX;
      if (x >= x0 && x <= x1) v.push(cl[j * GX + i]);
    }
    v.sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : 0;
  };
  let rings = 0;
  const under = [0, 0];
  for (let side = -1; side <= 1; side += 2) {
    const cheek = middle(side, -0.02, 0.02, -0.026, -0.019);
    under[side < 0 ? 0 : 1] = cheek > 0 ? middle(side, -0.015, 0.015, -0.017, -0.008) / cheek : 1;
    rings = Math.max(rings, 1 - smooth(0.58, 0.7, under[side < 0 ? 0 : 1]));
  }

  // ---- how dark every part of the face is on the whole ----
  // (the eyeballs do not count; small things that are much darker than their surroundings count less)
  const wgt = new Float32Array(N), wl = new Float32Array(N);
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) { const c = y * GX + x; wgt[c] = 1 - eyeball(cellX(x), cellY(y)) * 0.97; wl[c] = cl[c] * wgt[c]; }
  let low = blur(wl, 5);
  const wsum = blur(wgt, 5);
  for (let c = 0; c < N; c++) low[c] /= Math.max(wsum[c], 1e-3);
  const wgt2 = new Float32Array(N);
  for (let c = 0; c < N; c++) { wgt2[c] = wgt[c] * (0.15 + 0.85 * smooth(0.45, 0.85, cl[c] / Math.max(low[c], 1))); wl[c] = cl[c] * wgt2[c]; }
  low = blur(wl, 5);
  const wsum2 = blur(wgt2, 5);
  for (let c = 0; c < N; c++) low[c] /= Math.max(wsum2[c], 1e-3);
  // the same for the amount of color (hair and beards have little, skin in the shade has a lot)
  const lowS = new Float32Array(N);
  for (let c = 0; c < N; c++) lowS[c] = sat(cr[c], cg[c], cb[c]) * wgt2[c];
  const lowSat = blur(lowS, 5);
  for (let c = 0; c < N; c++) lowSat[c] /= Math.max(wsum2[c], 1e-3);
  // a closer look (2 mm) for the hollows around the eyes: there a dark patch is followed right up to its edge
  for (let c = 0; c < N; c++) wl[c] = cl[c] * wgt[c];
  const fine = blur(wl, 1), wsum3 = blur(wgt, 1);
  for (let c = 0; c < N; c++) fine[c] = wsum3[c] > 0.05 ? fine[c] / wsum3[c] : low[c];

  // ---- what is done where ----
  //   may:  how much may be done at all (1 = everything, 0 = nothing)
  //   deep: 1 where a big dark patch lies in the hollow of an eye: there everything dark is shade and is lifted
  //   base: how dark the surroundings are (the wide look, or the close look inside a deep patch)
  //   gain: how much brighter the surroundings have to become
  const target = Lref * 0.93, power = Math.min(1, 0.45 * strength), full = Math.min(1, strength), maxGain = 2.6 + 1.2 * Math.min(strength, 1.5);
  const gain = new Float32Array(N), may = new Float32Array(N), deep = new Float32Array(N), base = new Float32Array(N);
  // (a big dark patch: where the wide look says "much darker than normal skin". Its edge belongs to it, so it is grown by 6 mm.)
  const dark = new Float32Array(N);
  for (let c = 0; c < N; c++) dark[c] = smooth(1.3, 1.8, Math.pow(target / Math.max(low[c], 4), 0.85));
  const patch = grow2(dark, 4);
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    const c = y * GX + x, fx = cellX(x), ax = beside(fx), fy = cellY(y);
    // from the side: full in the middle, nothing at the temples (hair, ears)
    let m = 1 - smooth(0.058, 0.08, ax);
    // from below: nothing at the chin, a little around the mouth (a beard stays a beard), full from the tip of the nose up
    m *= smooth(0, 0.028, fy) * (0.22 + 0.78 * smooth(tipY - 0.016, tipY - 0.002, fy));
    // from above: full to above the eyebrows, nothing higher up (hair)
    m *= 1 - smooth(eyeY + 0.035, eyeY + 0.055, fy);
    const h = hollow(fx, fy);
    deep[c] = h * patch[c] * rings;
    // a dark place with almost no color is hair, a beard or a dark thing, not skin in the shade (inside a deep patch everything dark is shade)
    m *= 0.25 + 0.75 * smooth(refS * 0.45, refS * 0.85, lowSat[c]);
    // a big place that is almost black is hair (eyebrows that have grown together with the shade), not skin
    m *= 0.2 + 0.8 * smooth(0.17, 0.33, low[c] / target);
    m *= 1 - smooth(0.002, 0.0045, cz[c] - bare[c]);                     // (the frame of glasses, a strand of hair: not skin)
    may[c] = Math.max(m, deep[c] * (1 - smooth(0.08, 0.094, ax)));
  }
  const mayS = blur(may, 2), deepS = blur(deep, 2);
  for (let c = 0; c < N; c++) {
    base[c] = low[c] + (fine[c] - low[c]) * deepS[c];
    // (a deep patch is lifted all the way, the rest of the face keeps a part of its painted shade)
    gain[c] = Math.min(maxGain + (6 - maxGain) * deepS[c], Math.max(1, Math.pow(target / Math.max(base[c], 4), power + (full - power) * deepS[c])));
  }

  if (debug) Object.assign(debug, { lipLine: face.lipLine, mouthY: face.mouthY, mouthHalf: face.mouthHalf, restSmile: face.restSmile, GX, GY, cr, cg, cb, cn, cz, cl, low, base, gain, bare, may: mayS, deep: deepS, tipY, noseX, eyeX, eyeY, eyesFound, rings, under, Lref, ref: [refR, refG, refB], refS, texels: any });

  // ---- 3. lift the dark parts ----
  let changed = 0;
  for (let n = 0; n < list.length; n++) {
    const i = list[n];
    const gx = gxOf[i] / 64, gy = gyOf[i] / 64;
    const s = sample(mayS, gx, gy);
    if (s < 0.02) continue;
    const g = sample(gain, gx, gy);
    if (g < 1.03) continue;
    const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2], L = lum(r, gg, b);
    if (L < 1) continue;
    const fx = X0 + gx * CELL, fy = Y0 + gy * CELL, ball = eyeball(fx, fy), dp = sample(deepS, gx, gy);
    const around = Math.max(sample(base, gx, gy), 4), ratio = L / around;
    // the new brightness: the surroundings are lifted, what stands out from them keeps standing out (a little less where the lift is big)
    const damp = 1 - 0.4 * smooth(1.4, 3.0, g);
    let up = around * g * (1 + damp * (ratio - 1));
    up = Math.min(up, Math.max(L, target));                       // never brighter than normal skin
    // small dark things are not shade: eyebrows, lashes, the line of the mouth, wrinkles (inside a deep patch everything dark is shade)
    let a = s * (1 - ball) * (dp + (1 - dp) * smooth(0.34, 0.74, ratio));
    let L2 = L + Math.max(0, up - L) * a;
    // the eyeballs get a part of the lift of their surroundings, all of the eye by the same amount (so the iris stays darker than the white)
    if (ball > 0.01) {
      const wide = Math.pow(target / Math.max(sample(low, gx, gy), 4), power + (0.85 - power) * dp);
      L2 = Math.max(L2, Math.min(L * (1 + ball * Math.min(0.6, 0.5 * (wide - 1))), Math.max(L, target)));
    }
    if (L2 < L + 0.5) continue;
    const f = L2 / L;
    let nr = r * f, ng = gg * f, nb = b * f;
    // skin that was in deep shade is too red: it takes the normal skin color (in a deep patch everything does, also the darkest points)
    const skin = r > gg && gg >= b * 0.9 && r - b > 6 ? 1 : dp;       // (also the darkest red-brown points: lifted, they would glow red)
    if (skin > 0.02) {
      const cm = Math.min(1, a * skin * (0.9 + 0.1 * smooth(2.2, 3.2, g)) * smooth(1.15, 2.1, g));
      const wr = sample(nearR, gx, gy), wg = sample(nearG, gx, gy), wb = sample(nearB, gx, gy), q = L2 / Math.max(lum(wr, wg, wb), 1);
      nr += (wr * q - nr) * cm; ng += (wg * q - ng) * cm; nb += (wb * q - nb) * cm;
    }
    px[i * 4] = nr > 255 ? 255 : nr; px[i * 4 + 1] = ng > 255 ? 255 : ng; px[i * 4 + 2] = nb > 255 ? 255 : nb;
    changed++;
  }
  if (debug) debug.changed = changed;
  if (changed < 50) return false;
  g2.putImageData(data, 0, 0);

  // ---- the cleaned picture takes the place of the old one (same settings) ----
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = map.colorSpace; tex.flipY = map.flipY;
  tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  tex.minFilter = map.minFilter; tex.magFilter = map.magFilter; tex.generateMipmaps = map.generateMipmaps;
  tex.anisotropy = map.anisotropy; tex.channel = map.channel;
  tex.offset.copy(map.offset); tex.repeat.copy(map.repeat); tex.rotation = map.rotation; tex.center.copy(map.center);
  tex.name = map.name;
  tex.userData.faceCleaned = true;
  tex.needsUpdate = true;
  material.map = tex;
  material.needsUpdate = true;
  map.dispose();
  return true;
}
