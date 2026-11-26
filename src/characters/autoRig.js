// ---------------------------------------------------------------------------
// autoRig.js - gives a character model WITHOUT a skeleton a skeleton and skin.
//
// The models in assets/characters/ are one plain mesh standing in an A-pose
// (arms out and down, legs straight). This file:
//
//   1. JOINTS    cuts the mesh into many thin slices and finds the real joints:
//                every joint sits at the CENTER of the slice (the average of
//                the slice's points), elbows / knees / wrists / ankles are moved
//                to the slice where the limb is thinnest near the expected place.
//   2. BONES     builds the skeleton: spine, neck, head, collar bones, arms with
//                twist bones, hands with 3-bone fingers, legs, feet, toes, and a
//                few small HELPER bones that keep elbows, knees, shoulders and
//                hips from collapsing when they bend.
//   3. CHECK     logs every bone length and the rest pose angles, and compares
//                the left and the right side (more than 3 % apart = the better
//                side is mirrored).
//   4. SKIN      gives every point of the mesh up to 4 bones to follow:
//                soft blends about 7 cm wide at the joints, exactly one bone in
//                the middle of a limb, rigid head / hands / feet, and rules that
//                stop "leaks" (a leg never follows the other leg, the jacket
//                never follows the arm ...). Mesh distance is used for that.
//   5. SELF-TEST bends every joint through its range, measures how much the
//                volume of the mesh around the joint changes, repairs the bad
//                spots (up to 3 rounds) and returns a PASS / WARN table.
//   6. FACE      everything from the chin up follows the head bone ONLY, so a
//                face never stretches when the head turns or nods. The painted
//                shadows on the face are cleaned (faceClean.js).
//
// Directions: +Y up, the character looks along +Z, its LEFT hand is at +X.
// All sizes are in meters after the model has been scaled to its height.
//
// Bones never scale. A bone's own axes: Y points along the bone, turning
// around X by a positive angle bends "forward" (elbow flexes, thigh lifts,
// spine bows).
// ---------------------------------------------------------------------------

import { readFace, cleanFace } from './faceClean.js';
import { addFaceBones } from './faceRig.js';
import { SCULPT, sculptFace } from './faceSculpt.js';
import { applyCharacterLook } from './characterLook.js';
import { prepareCharacter } from './characterDetail.js';

// ----------------------------------------------------------- small vector helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;
const FWD = [0, 0, 1], UP = [0, 1, 0];
// turn vector v around the unit axis k by angle a
function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = dot(k, v) * (1 - c), x = cross(k, v);
  return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d];
}
// The three axes of a bone that points along "dir": [X (the hinge), Y (along the bone), Z].
export function boneAxes(dir) {
  const y = norm(dir);
  let x = Math.abs(dot(y, FWD)) > 0.9 ? cross(UP, y) : cross(y, FWD);   // (a bone that points forward, like a toe, uses "up" instead)
  x = norm(x);
  return [x, y, cross(x, y)];
}

// the names of the two sides: index 0 = left (+x), 1 = right (-x)
const SIDES = [{ tag: 'L', s: 1 }, { tag: 'R', s: -1 }];
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// ===========================================================================
// THE ANALYSIS (no three.js needed: it works on plain number arrays)
//   positions: Float32Array (x, y, z per point, any size and place)
//   index:     the triangles (three point numbers each)
// Returns joints, bones, skin weights and the report.
// ===========================================================================
export function analyzeCharacter(positions, index, opts = {}) {
  const t0 = Date.now();
  const H = opts.height || 1.8;
  const k = H / 1.8;                       // sizes below are written for a 1.8 m person
  const log = [];
  const say = (text) => { log.push(text); };
  const notes = [];                        // things that could not be found and were guessed
  const n = positions.length / 3;

  // ------------------------------------------------------- 1. size, place, direction
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const scale = H / (maxY - minY);
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    P[i * 3] = (positions[i * 3] - (minX + maxX) / 2) * scale;
    P[i * 3 + 1] = (positions[i * 3 + 1] - minY) * scale;
    P[i * 3 + 2] = (positions[i * 3 + 2] - (minZ + maxZ) / 2) * scale;
  }
  // the middle of the body: the hips, not the middle of the box (a backpack would shift that)
  {
    const xs = [], zs = [];
    for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; if (y > 0.47 * H && y < 0.6 * H && Math.abs(P[i * 3]) < 0.3 * k) { xs.push(P[i * 3]); zs.push(P[i * 3 + 2]); } }
    xs.sort((a, b) => a - b); zs.sort((a, b) => a - b);
    const cx = xs.length ? (xs[Math.floor(xs.length * 0.02)] + xs[Math.floor(xs.length * 0.98)]) / 2 : 0, cz = zs.length ? zs[zs.length >> 1] : 0;
    for (let i = 0; i < n; i++) { P[i * 3] -= cx; P[i * 3 + 2] -= cz; }
  }
  // which way does it look? the toes point forward: the feet lie in front of the shins
  let flip = false;
  {
    let fz = 0, fn = 0, sz = 0, sn = 0;
    for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; if (y < 0.04 * H) { fz += P[i * 3 + 2]; fn++; } else if (y > 0.1 * H && y < 0.22 * H) { sz += P[i * 3 + 2]; sn++; } }
    if (fn && sn && fz / fn < sz / sn - 0.005) { flip = true; for (let i = 0; i < n; i++) { P[i * 3] = -P[i * 3]; P[i * 3 + 2] = -P[i * 3 + 2]; } }
  }

  // ------------------------------------------------------- 2. weld + neighbours
  // Model files repeat a point wherever the picture on the skin has a seam.
  // "Welded" points are the real corners of the mesh; neighbours come from the triangles.
  const wOf = new Int32Array(n);
  const wp = [];
  {
    const seen = new Map();
    for (let i = 0; i < n; i++) {
      const key = Math.round(P[i * 3] * 20000) + ',' + Math.round(P[i * 3 + 1] * 20000) + ',' + Math.round(P[i * 3 + 2] * 20000);
      let w = seen.get(key);
      if (w === undefined) { w = wp.length / 3; seen.set(key, w); wp.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
      wOf[i] = w;
    }
  }
  const nw = wp.length / 3;
  const W = new Float32Array(wp);
  const pt = (v) => [W[v * 3], W[v * 3 + 1], W[v * 3 + 2]];
  // neighbour lists (start[v] .. start[v + 1] in "nbr")
  const tris = new Int32Array(index.length);
  for (let i = 0; i < index.length; i++) tris[i] = wOf[index[i]];
  const start = new Int32Array(nw + 1);
  let nbr;
  {
    const sets = new Array(nw);
    for (let v = 0; v < nw; v++) sets[v] = [];
    const link = (a, b) => { if (a !== b && !sets[a].includes(b)) sets[a].push(b); };
    for (let t = 0; t < tris.length; t += 3) { const a = tris[t], b = tris[t + 1], c = tris[t + 2]; link(a, b); link(b, a); link(b, c); link(c, b); link(a, c); link(c, a); }
    let total = 0;
    for (let v = 0; v < nw; v++) { start[v] = total; total += sets[v].length; }
    start[nw] = total;
    nbr = new Int32Array(total);
    for (let v = 0; v < nw; v++) nbr.set(sets[v], start[v]);
  }
  // distance along the surface of the mesh from a set of start points (Dijkstra)
  function meshDistance(seeds) {
    const d = new Float64Array(nw).fill(Infinity);   // (64 bit: the heap compares exact numbers)
    const heap = [];   // a small binary heap of [distance, point]
    const push = (dist, v) => { let i = heap.length; heap.push([dist, v]); while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top;
    };
    for (const v of seeds) { d[v] = 0; push(0, v); }
    while (heap.length) {
      const [dist, v] = pop();
      if (dist > d[v]) continue;
      for (let e = start[v]; e < start[v + 1]; e++) {
        const u = nbr[e], nd = dist + Math.hypot(W[u * 3] - W[v * 3], W[u * 3 + 1] - W[v * 3 + 1], W[u * 3 + 2] - W[v * 3 + 2]);
        if (nd < d[u]) { d[u] = nd; push(nd, u); }
      }
    }
    return d;
  }

  // ------------------------------------------------------- 3. thin horizontal slices
  const SLICE = 0.01 * k;                                  // 1 cm
  const nS = Math.ceil(H / SLICE) + 1;
  const slices = new Array(nS);                            // the corner points in every slice
  for (let i = 0; i < nS; i++) slices[i] = [];
  for (let v = 0; v < nw; v++) slices[clamp(Math.floor(W[v * 3 + 1] / SLICE), 0, nS - 1)].push(v);
  const sliceOf = (y) => clamp(Math.floor(y / SLICE), 0, nS - 1);

  // CUT the mesh with many parallel planes. Every triangle that a plane goes
  // through gives one short line; all lines of a plane together are the outline
  // of the body at that place. (Looking only at corner points is not enough:
  // big flat triangles have no points in the middle and would look like holes.)
  //   triList: the triangles to cut (offsets into "tris"), coord: the height of every point
  //   along the cutting direction. Returns per plane a list of numbers: ax, ay, az, bx, by, bz, ...
  function cutSlices(triList, coord, from, stepSize, count) {
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = [];
    const cut = (a, b, t, into) => { const ta = coord[a], tb = coord[b], f = (t - ta) / (tb - ta); into.push(W[a * 3] + (W[b * 3] - W[a * 3]) * f, W[a * 3 + 1] + (W[b * 3 + 1] - W[a * 3 + 1]) * f, W[a * 3 + 2] + (W[b * 3 + 2] - W[a * 3 + 2]) * f); };
    for (const t3 of triList) {
      const a = tris[t3], b = tris[t3 + 1], c = tris[t3 + 2], ta = coord[a], tb = coord[b], tc = coord[c];
      const lo = Math.min(ta, tb, tc), hi = Math.max(ta, tb, tc);
      for (let i = Math.max(0, Math.ceil((lo - from) / stepSize - 0.5)); i < count; i++) {
        const t = from + (i + 0.5) * stepSize;
        if (t >= hi) break;
        if (t <= lo) continue;
        const into = out[i], before = into.length;
        if ((ta - t) * (tb - t) < 0) cut(a, b, t, into);
        if ((tb - t) * (tc - t) < 0) cut(b, c, t, into);
        if ((tc - t) * (ta - t) < 0) cut(c, a, t, into);
        if (into.length - before !== 6) into.length = before;        // (a plane exactly through a corner: skip)
      }
    }
    return out;
  }
  // the center of an outline (every line counts by its length) and its "radius" (average distance from the center)
  function ringOf(seg, keep = null) {
    let cx = 0, cy = 0, cz = 0, total = 0;
    for (let i = 0; i < seg.length; i += 6) {
      const mx = (seg[i] + seg[i + 3]) / 2, my = (seg[i + 1] + seg[i + 4]) / 2, mz = (seg[i + 2] + seg[i + 5]) / 2;
      if (keep && !keep(mx, my, mz)) continue;
      const l = Math.hypot(seg[i] - seg[i + 3], seg[i + 1] - seg[i + 4], seg[i + 2] - seg[i + 5]);
      cx += mx * l; cy += my * l; cz += mz * l; total += l;
    }
    if (total < 0.05 * k) return null;
    cx /= total; cy /= total; cz /= total;
    let r = 0;
    for (let i = 0; i < seg.length; i += 6) {
      const mx = (seg[i] + seg[i + 3]) / 2, my = (seg[i + 1] + seg[i + 4]) / 2, mz = (seg[i + 2] + seg[i + 5]) / 2;
      if (keep && !keep(mx, my, mz)) continue;
      r += Math.hypot(mx - cx, my - cy, mz - cz) * Math.hypot(seg[i] - seg[i + 3], seg[i + 1] - seg[i + 4], seg[i + 2] - seg[i + 5]);
    }
    return { c: [cx, cy, cz], r: r / total, n: total };
  }
  const allTris = [];
  for (let t = 0; t < tris.length; t += 3) allTris.push(t);
  const yCoord = new Float32Array(nw);
  for (let v = 0; v < nw; v++) yCoord[v] = W[v * 3 + 1];
  const hcut = cutSlices(allTris, yCoord, 0, SLICE, nS);     // the horizontal outlines, 1 cm apart

  // the gap between the legs, and the gaps between the arms and the body, in every slice:
  // the lines of an outline cover stretches of x; where nothing covers x there is air
  const legGap = new Float32Array(nS).fill(NaN);           // x of the middle of the gap between the legs
  const armIn = [new Float32Array(nS).fill(NaN), new Float32Array(nS).fill(NaN)];   // |x| where the body ends
  const armOut = [new Float32Array(nS).fill(NaN), new Float32Array(nS).fill(NaN)];  // |x| where the arm begins
  const spanLo = new Float32Array(nS).fill(NaN), spanHi = new Float32Array(nS).fill(NaN);   // the body's left and right end near the middle
  for (let i = 0; i < nS; i++) {
    const seg = hcut[i], spans = [];
    for (let j = 0; j < seg.length; j += 6) spans.push([Math.min(seg[j], seg[j + 3]), Math.max(seg[j], seg[j + 3])]);
    if (spans.length < 4) continue;
    spans.sort((a, b) => a[0] - b[0]);
    const y = (i + 0.5) * SLICE;
    let reach = spans[0][1];
    const gaps = [];
    for (const [a, b] of spans) { if (a > reach + 0.006 * k) gaps.push([reach, a]); if (b > reach) reach = b; }
    for (const [a, b] of gaps) {
      if (y < 0.56 * H && a < 0.045 * k && b > -0.045 * k) legGap[i] = (a + b) / 2;
      if (y > 0.4 * H && y < 0.84 * H && b - a > 0.012 * k) {
        if (a > 0.1 * k && Number.isNaN(armIn[0][i])) { armIn[0][i] = a; armOut[0][i] = b; }
        if (b < -0.1 * k) { armIn[1][i] = -b; armOut[1][i] = -a; }   // (the last one found is the innermost on this side)
      }
    }
    // the stretch that holds x = 0 (neck, body): from the gap left of the middle to the gap right of it
    let lo = spans[0][0], hi = reach;
    for (const [a, b] of gaps) { if (b <= 0 && b > lo) lo = b; if (a >= 0 && a < hi) hi = a; }
    spanLo[i] = lo; spanHi[i] = hi;
  }
  // the crotch: the highest slice that still has a gap between the legs
  let crotchY = 0, guessLegs = false;
  {
    let miss = 0;
    for (let i = sliceOf(0.12 * H); i < sliceOf(0.56 * H); i++) {
      if (!Number.isNaN(legGap[i])) { crotchY = (i + 1) * SLICE; miss = 0; } else if (++miss > 4 && crotchY > 0) break;
    }
    if (crotchY < 0.38 * H) { guessLegs = true; crotchY = 0.45 * H; notes.push('the legs are hidden (long coat or skirt): the hip height is taken from normal body proportions'); }
    crotchY = Math.min(crotchY, 0.5 * H);
  }
  const hipY = clamp(crotchY + 0.055 * H, 0.48 * H, 0.54 * H);
  // the middle between the legs (x), a little smoothed; 0 where there is no gap
  const midX = (y) => { const i = sliceOf(y); for (let j = 0; j < 4; j++) { if (!Number.isNaN(legGap[Math.max(0, i - j)])) return legGap[Math.max(0, i - j)]; } return 0; };

  // the best place for a joint: thin, and close to where a body normally has it
  function pickThin(rings, from, to, prior, range) {
    let best = -1, bestScore = 1e9, med = [];
    for (let i = from; i <= to; i++) if (rings[i]) med.push(rings[i].r);
    if (!med.length) return -1;
    med.sort((a, b) => a - b);
    const m = med[med.length >> 1];
    for (let i = from; i <= to; i++) {
      if (!rings[i]) continue;
      // average with the neighbours: one odd slice should not decide
      const r = ((rings[i - 1] ? rings[i - 1].r : rings[i].r) + rings[i].r * 2 + (rings[i + 1] ? rings[i + 1].r : rings[i].r)) / 4;
      const score = r / m + 2.2 * Math.abs(i - prior) / range;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  const joints = {};
  const info = { H, crotchY, hipY, side: [{}, {}] };

  // ------------------------------------------------------- 4. legs (horizontal slices)
  const legScore = [0, 0];
  for (let q = 0; q < 2; q++) {
    const { tag, s } = SIDES[q];
    const rings = new Array(nS).fill(null);
    for (let i = 0; i < sliceOf(crotchY); i++) {
      const mx = midX((i + 0.5) * SLICE);
      rings[i] = ringOf(hcut[i], (x) => (x - mx) * s > 0 && Math.abs(x) < 0.3 * k);
    }
    // ankle: the thinnest place a little above the heel
    let ia = pickThin(rings, sliceOf(0.032 * H), sliceOf(0.085 * H), sliceOf(0.052 * H), sliceOf(0.053 * H));
    if (ia < 0) { ia = sliceOf(0.052 * H); notes.push(`${tag} ankle guessed`); } else legScore[q]++;
    const ankleRing = rings[ia] || { c: [s * 0.09 * k, 0, 0], r: 0.045 * k };
    const ankle = [ankleRing.c[0], (ia + 0.5) * SLICE, ankleRing.c[2]];
    // hip joint: above the top of the leg, x from the thigh just below the crotch
    let hx = 0, hz = 0, hn = 0;
    for (let i = sliceOf(crotchY - 0.09 * k); i < sliceOf(crotchY - 0.02 * k); i++) if (rings[i]) { hx += rings[i].c[0]; hz += rings[i].c[2]; hn++; }
    if (hn && !guessLegs) { hx /= hn; hz /= hn; legScore[q]++; } else { hx = s * 0.052 * H; hz = ankle[2] + 0.01 * k; }
    hx = s * clamp(Math.abs(hx), 0.043 * H, 0.06 * H);
    const hip = [hx, hipY, hz];
    // knee: the middle between hip and ankle, moved to the thinnest slice near it
    const mid = sliceOf((hip[1] + ankle[1]) / 2 + 0.01 * H), range = sliceOf((hip[1] - ankle[1]) * 0.09);
    let ik = guessLegs ? -1 : pickThin(rings, mid - range, mid + range, mid, range);
    let knee;
    if (ik < 0) { knee = lerp3(ankle, hip, 0.5); knee[2] += 0.01 * k; notes.push(`${tag} knee guessed`); }
    else {
      legScore[q]++;
      knee = [rings[ik].c[0], (ik + 0.5) * SLICE, rings[ik].c[2]];
      // it must stay close to the straight line from hip to ankle (clothes can pull the center away)
      const t = (knee[1] - ankle[1]) / (hip[1] - ankle[1]), line = lerp3(ankle, hip, t);
      knee[0] = line[0] + clamp(knee[0] - line[0], -0.03 * k, 0.03 * k);
      knee[2] = line[2] + clamp(knee[2] - line[2], -0.01 * k, 0.04 * k);
    }
    // foot: toes in front, heel behind
    let toeZ = -1e9, heelZ = 1e9, fx = 0, fn = 0;
    for (let i = 0; i <= ia; i++) for (const v of slices[i]) {
      if ((W[v * 3] - midX(0.05)) * s <= 0 || Math.abs(W[v * 3]) > 0.3 * k) continue;
      const z = W[v * 3 + 2];
      if (z > toeZ) toeZ = z; if (z < heelZ) heelZ = z;
      if (z > ankle[2] + 0.06 * k) { fx += W[v * 3]; fn++; }
    }
    if (toeZ < ankle[2] + 0.08 * k) toeZ = ankle[2] + 0.17 * k;
    const footX = fn ? fx / fn : ankle[0];
    const ball = [ankle[0] + (footX - ankle[0]) * 0.8, 0.022 * k, ankle[2] + (toeZ - ankle[2]) * 0.6];
    const toeEnd = [footX + (footX - ankle[0]) * 0.2, 0.022 * k, toeZ];
    joints['thigh_' + tag] = hip; joints['shin_' + tag] = knee; joints['foot_' + tag] = ankle; joints['toe_' + tag] = ball; joints['toeEnd_' + tag] = toeEnd;
    info.side[q].heelZ = heelZ; info.side[q].toeZ = toeZ;
    info.side[q].thighR = (rings[sliceOf((hip[1] + knee[1]) / 2)] || { r: 0.08 * k }).r;
    info.side[q].kneeR = (rings[sliceOf(knee[1])] || { r: 0.06 * k }).r;
    info.side[q].ankleR = ankleRing.r;
  }

  // ------------------------------------------------------- 5. arms (slices across the arm)
  const armScore = [0, 0];
  for (let q = 0; q < 2; q++) {
    const { tag, s } = SIDES[q];
    // the armpit: the highest slice with a gap between arm and body (with more gaps right below it)
    let armpitI = -1;
    for (let i = sliceOf(0.82 * H); i > sliceOf(0.45 * H); i--) {
      if (Number.isNaN(armIn[q][i])) continue;
      let c = 0;
      for (let j = 1; j <= 6; j++) if (!Number.isNaN(armIn[q][i - j])) c++;
      if (c >= 4) { armpitI = i; break; }
    }
    const S = info.side[q];
    let ok = armpitI > 0;
    let armPts = [];
    if (ok) {
      // the points of the arm: everything outside the gap, below the armpit
      for (let i = 0; i <= armpitI; i++) {
        let edge = NaN;
        for (let j = 0; j < 5 && Number.isNaN(edge); j++) edge = armOut[q][Math.min(armpitI, i + j)];
        for (const v of slices[i]) { const x = W[v * 3] * s; if ((!Number.isNaN(armIn[q][i]) && x > (armIn[q][i] + armOut[q][i]) / 2) || x > 0.215 * H || (i * SLICE > 0.5 * H && !Number.isNaN(edge) && x > edge + 0.05 * k)) armPts.push(v); }
      }
      if (armPts.length < 60) ok = false;
    }
    if (!ok) {
      // no gap found (the arms touch the body): use normal body proportions for a 45 degree A-pose
      notes.push(`${tag} arm could not be found in the slices: joints are placed from normal body proportions`);
      const sh = [s * 0.105 * H, 0.8 * H, 0], d = norm([s * 0.72, -0.69, 0]);
      joints['upperArm_' + tag] = sh; joints['foreArm_' + tag] = add(sh, mul(d, 0.158 * H)); joints['hand_' + tag] = add(sh, mul(d, 0.295 * H)); joints['handEnd_' + tag] = add(sh, mul(d, 0.39 * H));
      Object.assign(S, { armpitY: 0.72 * H, armpit: [s * 0.1 * H, 0.72 * H, 0], armR: 0.045 * k, wristR: 0.03 * k, elbowR: 0.04 * k, handLen: 0.095 * H, handW: 0.085 * k, handDir: d, armPts: [], tipV: -1, fingers: null });
      continue;
    }
    armScore[q]++;
    const armpitY = (armpitI + 1) * SLICE;
    let az = 0, an = 0;
    for (let j = 0; j < 4; j++) for (const v of slices[armpitI - j]) if (Math.abs(W[v * 3] * s - armIn[q][armpitI]) < 0.04 * k) { az += W[v * 3 + 2]; an++; }
    const armpit = [s * (armIn[q][armpitI] + armOut[q][armpitI]) / 2, armpitY, an ? az / an : 0];
    // main direction of the arm (the longest direction of its cloud of points)
    let c0 = [0, 0, 0];
    for (const v of armPts) { c0[0] += W[v * 3]; c0[1] += W[v * 3 + 1]; c0[2] += W[v * 3 + 2]; }
    c0 = mul(c0, 1 / armPts.length);
    let d = norm([s, -0.8, 0]);
    for (let it = 0; it < 12; it++) {
      let ax = 0, ay = 0, azz = 0;
      for (const v of armPts) { const p = [W[v * 3] - c0[0], W[v * 3 + 1] - c0[1], W[v * 3 + 2] - c0[2]], t = dot(p, d); ax += p[0] * t; ay += p[1] * t; azz += p[2] * t; }
      d = norm([ax, ay, azz]);
    }
    if (d[0] * s < 0) d = mul(d, -1);
    // thin slices ACROSS the arm, 1 cm apart, from the armpit to the finger tips
    let tMin = 1e9, tMax = -1e9, tipV = armPts[0];
    const tOf = (p) => dot(sub(p, c0), d);
    for (const v of armPts) { const t = tOf(pt(v)); if (t < tMin) tMin = t; if (t > tMax) { tMax = t; tipV = v; } }
    const tA = tOf(armpit);
    const nA = Math.ceil((tMax - tMin) / SLICE) + 1;
    const isArm = new Uint8Array(nw), tArm = new Float32Array(nw);
    for (const v of armPts) { isArm[v] = 1; tArm[v] = tOf(pt(v)); }
    const armTris = allTris.filter((t) => isArm[tris[t]] && isArm[tris[t + 1]] && isArm[tris[t + 2]]);
    const rings = cutSlices(armTris, tArm, tMin, SLICE, nA).map((seg) => ringOf(seg));
    const iOf = (t) => clamp(Math.floor((t - tMin) / SLICE), 0, nA - 1);
    // wrist: where the forearm gets thin before the hand
    const iTip = nA - 1;
    let iw = pickThin(rings, iTip - Math.round(0.25 * k / SLICE), iTip - Math.round(0.08 * k / SLICE), iTip - Math.round(0.155 * k / SLICE), Math.round(0.17 * k / SLICE));
    if (iw < 0) { iw = iTip - Math.round(0.16 * k / SLICE); notes.push(`${tag} wrist guessed`); } else armScore[q]++;
    const wrist = (rings[iw] || { c: add(c0, mul(d, tMax - 0.16 * k - tOf(c0))) }).c.slice();
    // the line through the middle of the upper arm (full rings only: 3 to 14 cm outside the armpit)
    const ia0 = iOf(tA + 0.03 * k), ia1 = iOf(tA + 0.14 * k);
    let ra = null, rb = null;
    for (let i = ia0; i <= ia1; i++) if (rings[i]) { if (!ra) ra = rings[i]; rb = rings[i]; }
    let ud = d, ubase = ra ? ra.c : add(c0, mul(d, tA - tOf(c0) + 0.05 * k));
    if (ra && rb && ra !== rb) ud = norm(sub(rb.c, ra.c));
    if (dot(ud, d) < 0.85) ud = d;
    // shoulder: on that line, about where a body has its shoulder joint, and inside the body
    let tS = (s * 0.106 * H - ubase[0]) / (ud[0] || 1e-6);                 // the place on the line with x = 0.106 x height
    const tPit = dot(sub(armpit, ubase), ud);                                // right "above" the armpit
    tS = clamp(tS, tPit - 0.09 * k, tPit + 0.01 * k);
    let shoulder = add(ubase, mul(ud, tS));
    {
      let top = 0;
      for (let i = sliceOf(shoulder[1]); i < nS; i++) for (const v of slices[i]) if (Math.abs(W[v * 3] - shoulder[0]) < 0.025 * k && Math.abs(W[v * 3 + 2] - shoulder[2]) < 0.12 * k && W[v * 3 + 1] > top && W[v * 3 + 1] < 0.9 * H) top = W[v * 3 + 1];
      if (top > 0) shoulder[1] = clamp(shoulder[1], top - 0.085 * k, top - 0.045 * k);
      shoulder[1] = Math.max(shoulder[1], armpitY + 0.025 * k);
    }
    // elbow: a little past the middle between shoulder and wrist, moved to the thinnest slice near it
    const tSh = tOf(shoulder), tW = tOf(wrist), L = tW - tSh;
    const ip = iOf(tSh + 0.555 * L), range = Math.max(2, Math.round(0.09 * L / SLICE));
    let ie = pickThin(rings, ip - range, ip + range, ip, range);
    let elbow;
    if (ie < 0) { elbow = lerp3(shoulder, wrist, 0.555); notes.push(`${tag} elbow guessed`); } else { armScore[q]++; elbow = rings[ie].c.slice(); }
    // the hand: everything past the wrist
    const hand = [];
    for (const v of armPts) if (tOf(pt(v)) > tOf(wrist)) hand.push(v);
    let hcn = [0, 0, 0];
    for (const v of hand) { hcn[0] += W[v * 3]; hcn[1] += W[v * 3 + 1]; hcn[2] += W[v * 3 + 2]; }
    let handDir = hand.length > 5 ? norm(sub(mul(hcn, 1 / hand.length), wrist)) : norm(sub(wrist, elbow));
    if (dot(handDir, norm(sub(wrist, elbow))) < 0.2) handDir = norm(sub(wrist, elbow));
    let handLen = 0, wLo = 1e9, wHi = -1e9;
    const lat = norm(sub(FWD, mul(handDir, dot(FWD, handDir))));             // across the hand: toward the thumb side (front)
    for (const v of hand) { const p = sub(pt(v), wrist); handLen = Math.max(handLen, dot(p, handDir)); const w = dot(p, lat); if (w < wLo) wLo = w; if (w > wHi) wHi = w; }
    handLen = clamp(handLen, 0.07 * k, 0.21 * k);
    joints['upperArm_' + tag] = shoulder; joints['foreArm_' + tag] = elbow; joints['hand_' + tag] = wrist; joints['handEnd_' + tag] = add(wrist, mul(handDir, handLen));
    Object.assign(S, {
      armpitY, armpit, armPts, tipV, handDir, handLen, handLat: lat, handW: clamp(wHi - wLo, 0.05 * k, 0.11 * k), handMid: (wHi + wLo) / 2, handPts: hand,
      armR: (rings[iOf(tSh + 0.3 * L)] || { r: 0.05 * k }).r, elbowR: (rings[iOf(tOf(elbow))] || { r: 0.045 * k }).r, wristR: (rings[iw] || { r: 0.03 * k }).r,
    });
  }

  // ------------------------------------------------------- 6. spine, neck, head
  {
    // neck: the narrowest slice between shoulders and head
    let best = sliceOf(0.865 * H), bw = 1e9;
    for (let i = sliceOf(0.82 * H); i <= sliceOf(0.905 * H); i++) {
      if (Number.isNaN(spanLo[i])) continue;
      const w = (spanHi[i] - spanLo[i]) * (1 + 1.5 * Math.abs(i * SLICE - 0.865 * H) / H);
      if (w < bw) { bw = w; best = i; }
    }
    const neckY = (best + 0.5) * SLICE;
    // how far forward / back the middle of the body is at a height (only the points near the middle line)
    const zAt = (y) => { let z = 0, c = 0; for (let j = -1; j <= 1; j++) { const r = ringOf(hcut[clamp(sliceOf(y) + j, 0, nS - 1)], (x) => Math.abs(x) < 0.1 * k); if (r) { z += r.c[2]; c++; } } return c ? z / c : 0; };
    const hz = (joints.thigh_L[2] + joints.thigh_R[2]) / 2;
    const zc = (y, lim) => hz + clamp(zAt(y) - hz, -lim, lim);
    const hips = [0, hipY + 0.035 * k, hz];
    // THE CHIN. A face has no bones in this rig, so the head must move as ONE piece - and for that the rig has
    // to know where the face ends. Hoods, collars, beards and hair make "the narrowest place" land in the middle
    // of a face, so the chin is looked for directly: going up the front of the body along the middle line, the
    // chin is where the surface jumps forward (from the throat out to the face).
    const front = new Float32Array(nS).fill(NaN);
    for (let i = sliceOf(0.75 * H); i <= sliceOf(0.93 * H); i++) {
      let z = -1e9;
      for (let j = i; j <= i + 1 && j < nS; j++) for (const v of slices[j]) if (Math.abs(W[v * 3]) < 0.05 * k && W[v * 3 + 2] > z) z = W[v * 3 + 2];
      if (z > -1e8) front[i] = z;
    }
    let chinY = Math.min(neckY, 0.845 * H), jump = 0.03 * k, chinFound = false;      // (a jump under 3 cm is not a chin)
    for (let i = sliceOf(0.795 * H); i <= sliceOf(0.885 * H); i++) {
      const a = front[i - 2], b = front[i + 2];                                     // 4 cm apart
      if (Number.isNaN(a) || Number.isNaN(b) || b - a <= jump) continue;
      jump = b - a; chinFound = true;
      // the lowest slice where the surface has come most of the way out: that is the under side of the chin
      let j = i - 2;
      while (j < i + 2 && !(front[j] > a + 0.6 * (b - a))) j++;
      chinY = j * SLICE;
    }
    if (!chinFound) notes.push('chin not found: the head starts at a normal height');
    info.chinY = chinY;
    // the spine keeps its old top (so bodies bend as before); the neck starts lower, below the chin
    const spineTop = neckY - 0.055 * k;
    const shoulderTop = Math.max(joints.upperArm_L[1], joints.upperArm_R[1]) + 0.015 * k;
    const neckBase = Math.max(shoulderTop, Math.min(spineTop, chinY - 0.075 * k)), headY = chinY + 0.04 * k;
    const at = (f, lim) => { const y = hips[1] + (spineTop - hips[1]) * f; return [0, y, zc(y, lim)]; };
    joints.hips = hips;
    joints.spine = at(0.14, 0.02 * k); joints.spine1 = at(0.42, 0.03 * k); joints.chest = at(0.7, 0.03 * k);
    // head: the middle of the points above the neck tells how far forward the skull sits
    let hzz = 0, hc = 0;
    for (let i = sliceOf(headY + 0.05 * k); i < nS; i++) for (const v of slices[i]) { hzz += W[v * 3 + 2]; hc++; }
    const headZ = hc ? hzz / hc : hz;
    joints.neck = [0, neckBase, lerp3([0, 0, joints.chest[2]], [0, 0, headZ], 0.5)[2] - 0.01 * k];
    joints.head = [0, headY, headZ - 0.012 * k];
    joints.headEnd = [0, H, headZ];
    info.neckY = neckY;
    for (let q = 0; q < 2; q++) {
      const { tag, s } = SIDES[q], sh = joints['upperArm_' + tag];
      joints['clavicle_' + tag] = [s * 0.022 * H, sh[1] - 0.005 * k, sh[2] + 0.01 * k];
    }
  }

  // ------------------------------------------------------- 7. check left against right
  const boneLen = (a, b) => len(sub(joints[b], joints[a]));
  const mirror = (from, to, names) => { for (const nm of names) { const j = joints[nm + '_' + from]; joints[nm + '_' + to] = [-j[0], j[1], j[2]]; } };
  const symmetry = [];
  {
    const groups = [
      ['arm', ['clavicle', 'upperArm', 'foreArm', 'hand', 'handEnd'], [['upperArm', 'foreArm'], ['foreArm', 'hand'], ['clavicle', 'upperArm']], armScore],
      ['leg', ['thigh', 'shin', 'foot', 'toe', 'toeEnd'], [['thigh', 'shin'], ['shin', 'foot'], ['foot', 'toe']], legScore],
    ];
    for (const [name, names, pairs, score] of groups) {
      let worst = 0;
      for (const [a, b] of pairs) { const l = boneLen(a + '_L', b + '_L'), r = boneLen(a + '_R', b + '_R'); worst = Math.max(worst, Math.abs(l - r) / Math.max(l, r)); }
      // also the height of the joints must match
      for (const nm of names) worst = Math.max(worst, Math.abs(joints[nm + '_L'][1] - joints[nm + '_R'][1]) / H * 2);
      let action = 'ok';
      if (worst > 0.03) {
        // the better side: the one where more joints were really found; if equal, the left
        const from = score[1] > score[0] ? 'R' : 'L', to = from === 'L' ? 'R' : 'L';
        mirror(from, to, names);
        const a = SIDES.findIndex((q) => q.tag === from), b = 1 - a;
        for (const key of ['armR', 'elbowR', 'wristR', 'handLen', 'handW', 'thighR', 'kneeR', 'ankleR']) if (info.side[a][key] !== undefined) info.side[b][key] = info.side[a][key];
        if (name === 'arm') { const hd = info.side[a].handDir; info.side[b].handDir = [-hd[0], hd[1], hd[2]]; if (info.side[a].handLat) { const hl = info.side[a].handLat; info.side[b].handLat = [-hl[0], hl[1], hl[2]]; } }
        action = `mirrored from ${from}`;
      }
      symmetry.push({ part: name, difference: +(worst * 100).toFixed(1), action });
      say(`symmetry ${name}: left and right differ by ${(worst * 100).toFixed(1)} % -> ${action}`);
    }
  }

  // ------------------------------------------------------- 8. the bones
  // { name, parent, head (where it starts), tail (where it points), helper }
  const bones = [];
  const B = (name, parent, head, tail, extra = {}) => { bones.push({ name, parent, head: head.slice(), tail: tail.slice(), ...extra }); };
  B('hips', null, joints.hips, add(joints.hips, [0, 0.1 * k, 0]));
  B('spine', 'hips', joints.spine, joints.spine1);
  B('spine1', 'spine', joints.spine1, joints.chest);
  B('chest', 'spine1', joints.chest, joints.neck);
  B('neck', 'chest', joints.neck, joints.head);
  B('head', 'neck', joints.head, joints.headEnd);
  for (let q = 0; q < 2; q++) {
    const { tag } = SIDES[q], S = info.side[q], J = (nm) => joints[nm + '_' + tag];
    B('clavicle_' + tag, 'chest', J('clavicle'), J('upperArm'));
    B('upperArm_' + tag, 'clavicle_' + tag, J('upperArm'), J('foreArm'));
    // helper at the shoulder: turns half as far as the arm (keeps the shoulder round)
    B('shoulderFix_' + tag, 'clavicle_' + tag, J('upperArm'), J('foreArm'), { helper: 'half', of: 'upperArm_' + tag, radius: S.armR });
    // twist bone of the upper arm: sits at the shoulder end and does NOT twist with the arm
    B('upperArmTwist_' + tag, 'upperArm_' + tag, J('upperArm'), J('foreArm'), { helper: 'untwist' });
    B('foreArm_' + tag, 'upperArm_' + tag, J('foreArm'), J('hand'));
    B('elbowFix_' + tag, 'upperArm_' + tag, J('foreArm'), J('hand'), { helper: 'half', of: 'foreArm_' + tag, radius: S.elbowR });
    // twist bone of the forearm: sits toward the wrist and takes part of the hand's twist
    const mid = lerp3(J('foreArm'), J('hand'), 0.5);
    B('foreArmTwist_' + tag, 'foreArm_' + tag, mid, J('hand'), { helper: 'twist' });
    B('hand_' + tag, 'foreArm_' + tag, J('hand'), J('handEnd'));
    // fingers: 3 bones each. They are always built; they only move skin if the fingers are separate in the mesh.
    const hd = S.handDir, lat = S.handLat || norm(sub(FWD, mul(hd, dot(FWD, hd)))), wr = J('hand');
    const spread = { index: 0.3, middle: 0.1, ring: -0.1, pinky: -0.3 };
    for (const f of FINGERS) {
      let base, dir, total;
      if (f === 'thumb') { base = add(add(wr, mul(hd, S.handLen * 0.22)), mul(lat, S.handW * 0.38)); dir = norm(add(mul(hd, 0.65), mul(lat, 0.75))); total = S.handLen * 0.42; }
      else { base = add(add(wr, mul(hd, S.handLen * 0.52)), mul(lat, S.handW * spread[f])); dir = hd; total = S.handLen * (f === 'pinky' ? 0.4 : 0.48); }
      let p = base, parent = 'hand_' + tag;
      [0.45, 0.31, 0.24].forEach((part, i) => {
        const e = add(p, mul(dir, total * part)), name = `${f}${i + 1}_${tag}`;
        B(name, parent, p, e, { finger: f });
        parent = name; p = e;
      });
    }
    B('thigh_' + tag, 'hips', J('thigh'), J('shin'));
    B('hipFix_' + tag, 'hips', J('thigh'), J('shin'), { helper: 'half', of: 'thigh_' + tag, radius: S.thighR });
    B('shin_' + tag, 'thigh_' + tag, J('shin'), J('foot'));
    B('kneeFix_' + tag, 'thigh_' + tag, J('shin'), J('foot'), { helper: 'half', of: 'shin_' + tag, radius: S.kneeR });
    B('foot_' + tag, 'shin_' + tag, J('foot'), J('toe'));
    B('toe_' + tag, 'foot_' + tag, J('toe'), J('toeEnd'));
  }
  const boneIndex = {};
  bones.forEach((b, i) => { boneIndex[b.name] = i; b.axes = boneAxes(sub(b.tail, b.head)); b.length = len(sub(b.tail, b.head)); });
  const bi = (name) => boneIndex[name];

  // ------------------------------------------------------- 9. log lengths and rest angles
  const angleBetween = (a, b) => Math.acos(clamp(dot(norm(a), norm(b)), -1, 1)) / DEG;
  const restAngles = {};
  for (const { tag } of SIDES) {
    const J = (nm) => joints[nm + '_' + tag];
    restAngles['elbow_' + tag] = angleBetween(sub(J('foreArm'), J('upperArm')), sub(J('hand'), J('foreArm')));
    restAngles['knee_' + tag] = angleBetween(sub(J('shin'), J('thigh')), sub(J('foot'), J('shin')));
    restAngles['armFromBody_' + tag] = angleBetween(sub(J('foreArm'), J('upperArm')), [0, -1, 0]);
    restAngles['legFromVertical_' + tag] = angleBetween(sub(J('shin'), J('thigh')), [0, -1, 0]);
  }
  for (const b of bones) if (!b.helper && !b.finger) say(`bone ${b.name.padEnd(16)} length ${(b.length * 100).toFixed(1).padStart(5)} cm   starts at (${b.head.map((v) => v.toFixed(3)).join(', ')})`);
  for (const key of Object.keys(restAngles)) say(`rest angle ${key.padEnd(20)} ${restAngles[key].toFixed(1)} deg`);

  // ------------------------------------------------------- 10. which point belongs to which limb
  // Mesh distance from the two feet and the two finger tips.
  const footSeeds = [[], []], handSeeds = [[], []];
  for (let v = 0; v < nw; v++) if (W[v * 3 + 1] < 0.03 * k) footSeeds[(W[v * 3] - midX(0.05)) > 0 ? 0 : 1].push(v);
  for (let q = 0; q < 2; q++) if (info.side[q].tipV >= 0) handSeeds[q].push(info.side[q].tipV);
  const dFoot = [meshDistance(footSeeds[0]), meshDistance(footSeeds[1])];
  const dHand = [handSeeds[0].length ? meshDistance(handSeeds[0]) : null, handSeeds[1].length ? meshDistance(handSeeds[1]) : null];
  // the shape of each limb, used by the weights
  const limb = SIDES.map(({ tag, s }, q) => {
    const J = (nm) => joints[nm + '_' + tag], S = info.side[q];
    const sh = J('upperArm'), el = J('foreArm'), wr = J('hand'), he = J('handEnd');
    const hip = J('thigh'), kn = J('shin'), an = J('foot'), ball = J('toe');
    const u = norm(sub(el, sh)), f = norm(sub(wr, el)), th = norm(sub(kn, hip)), sn = norm(sub(an, kn));
    // the crease of the hip: a slanted line from the crotch up to the outside of the hip
    const C = [midX(crotchY - 0.01), crotchY], O = [s * (Math.abs(hip[0]) + S.thighR * 1.15 + 0.03 * k), hipY + 0.075 * k];
    const e = norm([O[0] - C[0], O[1] - C[1], 0]);
    return {
      tag, s, sh, el, wr, he, hip, kn, an, ball, u, f, th, sn,
      nElbow: norm(add(u, f)), nKnee: norm(add(th, sn)), nWrist: norm(add(f, S.handDir)),
      hipC: C, hipN: [s * e[1], -s * e[0]],
      armLen: len(sub(el, sh)) + len(sub(wr, el)) + S.handLen,
    };
  });
  // distance from a point to the line of the arm (shoulder - elbow - wrist - hand end)
  const segDist = (p, a, b) => { const ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1); return len(sub(p, add(a, mul(ab, t)))); };
  const armDist = (p, Lm) => Math.min(segDist(p, Lm.sh, Lm.el), segDist(p, Lm.el, Lm.wr), segDist(p, Lm.wr, Lm.he));

  // ------------------------------------------------------- 11. skin weights
  // half widths of the soft zones (the whole blend is twice as wide)
  const zone = { shoulder: [0.04, 0.04], elbow: [0.036, 0.036], wrist: [0.03, 0.03], hip: [0.042, 0.042], knee: [0.038, 0.038], ankle: [0.032, 0.032], toe: 0.02, spine: 0.04, neck: 0.034, head: 0.03 };
  for (const key of Object.keys(zone)) zone[key] = Array.isArray(zone[key]) ? zone[key].map((v) => v * k) : zone[key] * k;
  // a joint with a helper bone: how much goes to the bone before, the helper, the bone after
  const hat = (d, h) => { const t = clamp(d / h, -1, 1); return [Math.max(0, -t), 1 - Math.abs(t), Math.max(0, t)]; };
  // a plain joint: a smooth step from the bone before to the bone after
  const step = (d, h) => { const b = smooth01((d + h) / (2 * h)); return [1 - b, 0, b]; };

  let weights = null;        // per welded point: Map(bone index -> weight)
  let cls = null;            // per welded point: 0 body, 1 left arm, 2 right arm, 3 left leg, 4 right leg
  let fixed = null;          // per welded point: 1 = rigid (head, hand, foot): smoothing leaves it alone
  const signed = {};         // signed distances to the joints (for the self-test)
  let fingersSeparate = [false, false];

  // the body: spine bones by height, collar bones toward the shoulders
  const spineLevels = [['hips', -1e9], ['spine', joints.spine[1]], ['spine1', joints.spine1[1]], ['chest', joints.chest[1]], ['neck', joints.neck[1] + 0.01 * k], ['head', info.chinY - 0.004 * k - zone.head]];
  function bodyWeights(p, out, amount) {
    if (amount <= 0) return;
    let acc = [];
    let rest = 1;
    for (let i = spineLevels.length - 1; i >= 1; i--) {
      const h = i === 5 ? zone.head : i === 4 ? zone.neck : zone.spine;
      const w = smooth01((p[1] - spineLevels[i][1] + h) / (2 * h)) * rest;
      if (w > 0) acc.push([spineLevels[i][0], w]);
      rest -= w;
      if (rest <= 1e-4) break;
    }
    if (rest > 1e-4) acc.push(['hips', rest]);
    // collar bones: the outer part of the shoulder area follows them
    for (let q = 0; q < 2; q++) {
      const { tag, s } = SIDES[q], S = info.side[q], sx = Math.abs(joints['upperArm_' + tag][0]);
      const c = smooth01((p[0] * s / sx - 0.32) / 0.55) * smooth01((p[1] - (S.armpitY - 0.03 * k)) / (0.08 * k)) * (1 - smooth01((p[1] - joints.neck[1] - 0.02 * k) / (0.05 * k)));
      if (c <= 0.001) continue;
      for (const a of acc) if (a[0] !== 'head') { const m = a[1] * c; a[1] -= m; out.set(bi('clavicle_' + tag), (out.get(bi('clavicle_' + tag)) || 0) + m * amount); }
    }
    for (const [name, w] of acc) if (w > 0) out.set(bi(name), (out.get(bi(name)) || 0) + w * amount);
  }

  // only: null = every point, or a list of 0 / 1 per point (1 = work this point out again)
  function computeWeights(only = null) {
    if (!only) {
      weights = new Array(nw); cls = new Uint8Array(nw); fixed = new Uint8Array(nw);
      for (const key of ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle']) signed[key] = [new Float32Array(nw).fill(NaN), new Float32Array(nw).fill(NaN)];
    }
    for (let v = 0; v < nw; v++) {
      if (only) { if (!only[v]) continue; cls[v] = 0; fixed[v] = 0; for (const key in signed) { signed[key][0][v] = NaN; signed[key][1][v] = NaN; } }
      const p = pt(v), out = new Map();
      const put = (name, w) => { if (w > 1e-5) out.set(bi(name), (out.get(bi(name)) || 0) + w); };
      let body = 1;
      // ---------------- arms ----------------
      for (let q = 0; q < 2 && body > 0; q++) {
        const Lm = limb[q], S = info.side[q], { tag, s } = Lm;
        if (!S.armPts || !S.armPts.length && S.tipV < 0) { /* guessed arm: still use the planes below */ }
        const dS = dot(sub(p, Lm.sh), Lm.u);
        const hs = zone.shoulder[q];
        if (dS <= -hs || p[0] * s < 0.05 * k) continue;
        // below the armpit the body column is body, whatever the planes say
        const i = sliceOf(p[1]);
        if (p[1] < S.armpitY) {
          let edge = NaN;
          for (let j = 0; j < 6 && Number.isNaN(edge); j++) if (!Number.isNaN(armIn[q][Math.min(nS - 1, i + j)])) edge = (armIn[q][Math.min(nS - 1, i + j)] + armOut[q][Math.min(nS - 1, i + j)]) / 2;
          if (Number.isNaN(edge)) edge = Math.abs(S.armpit[0]);
          if (p[0] * s < edge) continue;
        } else if (armDist(p, Lm) > S.armR * 2.3 + 0.035 * k) continue;      // above it: only what is close to the arm (not the neck or a hood)
        // mesh distance: cloth that only hangs NEAR the arm is far away along the surface
        if (dHand[q]) {
          const along = Lm.armLen - Math.max(0, dS);
          if (dHand[q][v] > along * 1.7 + 0.2 * k) continue;
        }
        const dE = dot(sub(p, Lm.el), Lm.nElbow), dW = dot(sub(p, Lm.wr), Lm.nWrist);
        signed.shoulder[q][v] = dS; signed.elbow[q][v] = dE; signed.wrist[q][v] = dW;
        const [a1, m1, b1] = hat(dS, hs), [a2, m2, b2] = hat(dE, zone.elbow[q]), [a3, , b3] = step(dW, zone.wrist[q]);
        // along the upper arm (0 shoulder .. 1 elbow) and the forearm (0 elbow .. 1 wrist)
        const tu = clamp(dS / len(sub(Lm.el, Lm.sh)), 0, 1), tf = clamp(dot(sub(p, Lm.el), Lm.f) / len(sub(Lm.wr, Lm.el)), 0, 1);
        const up = b1 * a2, fo = b1 * b2 * a3, ha = b1 * b2 * b3;
        const untw = 1 - smooth01(tu / 0.6), tw = smooth01((tf - 0.3) / 0.6);
        put('shoulderFix_' + tag, m1);
        put('upperArm_' + tag, up * (1 - untw)); put('upperArmTwist_' + tag, up * untw);
        put('elbowFix_' + tag, b1 * m2);
        put('foreArm_' + tag, fo * (1 - tw)); put('foreArmTwist_' + tag, fo * tw);
        if (ha > 0) fingerWeights(q, p, ha, put);
        body = a1;
        cls[v] = 1 + q;
        if (ha > 0.999) fixed[v] = 1;
      }
      // ---------------- legs ----------------
      if (body > 0 && p[1] < hipY + 0.14 * k && cls[v] === 0) {
        // which leg? below the crotch: the foot that is nearer along the mesh. above: by side.
        let q = p[0] - midX(Math.min(p[1], crotchY - 0.01)) > 0 ? 0 : 1;
        if (p[1] < crotchY && Number.isFinite(dFoot[0][v]) && Number.isFinite(dFoot[1][v]) && Math.abs(dFoot[0][v] - dFoot[1][v]) > 0.03 * k) q = dFoot[0][v] < dFoot[1][v] ? 0 : 1;
        const Lm = limb[q], { tag } = Lm;
        const dH = (p[0] - Lm.hipC[0]) * Lm.hipN[0] + (p[1] - Lm.hipC[1]) * Lm.hipN[1];
        const hh = zone.hip[q];
        if (dH > -hh) {
          const dK = dot(sub(p, Lm.kn), Lm.nKnee), dA = dot(sub(p, Lm.an), Lm.sn);
          signed.hip[q][v] = dH; signed.knee[q][v] = dK; signed.ankle[q][v] = dA;
          const [a1, m1, b1] = hat(dH, hh), [a2, m2, b2] = hat(dK, zone.knee[q]), [a3, , b3] = step(dA, zone.ankle[q]);
          const toe = b3 > 0 ? smooth01((p[2] - Lm.ball[2] + zone.toe) / (2 * zone.toe)) * smooth01((Lm.an[1] - p[1]) / (0.03 * k)) : 0;
          put('hipFix_' + tag, m1 * body);
          put('thigh_' + tag, b1 * a2 * body);
          put('kneeFix_' + tag, b1 * m2 * body);
          put('shin_' + tag, b1 * b2 * a3 * body);
          put('foot_' + tag, b1 * b2 * b3 * (1 - toe) * body);
          put('toe_' + tag, b1 * b2 * b3 * toe * body);
          if (b1 > 0.5) cls[v] = 3 + q;
          if (b1 * b2 * b3 > 0.999) fixed[v] = 1;
          body *= a1;
        }
      }
      bodyWeights(p, out, body);
      if (cls[v] === 0 && p[1] > info.chinY - 0.003 * k) fixed[v] = 1;      // the head is rigid: everything from the chin up moves as one piece
      weights[v] = out;
    }
  }

  // ---- fingers: found from the points of the hand ----
  const fingerInfo = [null, null];
  function findFingers() {
    for (let q = 0; q < 2; q++) {
      const S = info.side[q], { tag } = SIDES[q];
      fingerInfo[q] = null;
      if (!S.handPts || S.handPts.length < 120) continue;                  // too few points for real fingers
      const wr = joints['hand_' + tag], hd = S.handDir, lat = S.handLat;
      // the points of the outer part of the hand, sorted across the hand
      const far = [];
      for (const v of S.handPts) { const p = sub(pt(v), wr); if (dot(p, hd) > S.handLen * 0.62) far.push(dot(p, lat)); }
      if (far.length < 40) continue;
      far.sort((a, b) => a - b);
      // gaps between fingers: at least 4 mm with nothing in between
      const groups = [[far[0], far[0], 1]];
      for (let i = 1; i < far.length; i++) { const g = groups[groups.length - 1]; if (far[i] - g[1] > 0.004 * k) groups.push([far[i], far[i], 1]); else { g[1] = far[i]; g[2]++; } }
      const real = groups.filter((g) => g[2] >= 6);
      if (real.length < 4) continue;
      // the four widest groups are index .. pinky (from the thumb side to the other side)
      real.sort((a, b) => b[2] - a[2]);
      const four = real.slice(0, 4).sort((a, b) => b[0] - a[0]);
      fingerInfo[q] = four.map((g) => (g[0] + g[1]) / 2);
    }
    fingersSeparate = fingerInfo.map((f) => !!f);
  }
  function fingerWeights(q, p, amount, put) {
    const { tag } = SIDES[q], S = info.side[q], F = fingerInfo[q];
    if (!F) { put('hand_' + tag, amount); return; }                        // one rigid hand block
    const wr = joints['hand_' + tag], rel = sub(p, wr), along = dot(rel, S.handDir), across = dot(rel, S.handLat);
    const knuckle = S.handLen * 0.52;
    if (along < knuckle - 0.006 * k) { put('hand_' + tag, amount); return; }
    // the nearest finger
    let best = 0;
    for (let i = 1; i < 4; i++) if (Math.abs(across - F[i]) < Math.abs(across - F[best])) best = i;
    const f = FINGERS[best + 1], total = S.handLen * (f === 'pinky' ? 0.4 : 0.48);
    const t = (along - knuckle) / total, h = 0.006 * k / total;
    const s0 = smooth01((along - knuckle + 0.006 * k) / (0.012 * k)), s1 = smooth01((t - 0.45 + h) / (2 * h)), s2 = smooth01((t - 0.76 + h) / (2 * h));
    put('hand_' + tag, amount * (1 - s0));
    put(`${f}1_${tag}`, amount * s0 * (1 - s1)); put(`${f}2_${tag}`, amount * s0 * s1 * (1 - s2)); put(`${f}3_${tag}`, amount * s0 * s1 * s2);
  }

  // ---- which bones a point may never follow (leaks) ----
  const group = bones.map((b) => {
    const m = /_(L|R)$/.exec(b.name), side = m ? (m[1] === 'L' ? 0 : 1) : -1, nm = b.name.replace(/_(L|R)$/, '');
    if (/^(thigh|shin|foot|toe|kneeFix|hipFix)$/.test(nm)) return { part: 'leg', side, low: /^(shin|foot|toe|kneeFix)$/.test(nm) };
    if (/^(clavicle)$/.test(nm)) return { part: 'collar', side };
    if (side >= 0) return { part: 'arm', side, low: !/^(upperArm|upperArmTwist|shoulderFix)$/.test(nm) };
    return { part: 'body', side: -1, lowBody: /^(hips|spine|spine1)$/.test(nm) };
  });
  function allowed(v, b) {
    const g = group[b], c = cls[v];
    if (c === 0) return !(g.part === 'arm' && g.low) && !(g.part === 'leg' && g.low);                       // body: no forearm, hand, shin, foot
    if (c <= 2) {                                                                                             // an arm
      if (g.part === 'leg' || g.lowBody) return false;
      if ((g.part === 'arm' || g.part === 'collar') && g.side !== c - 1) return false;                         // never the other arm
      if (signed.elbow[c - 1][v] > zone.elbow[c - 1] && !(g.part === 'arm')) return false;                     // past the elbow: no body at all
      return true;
    }
    if (g.part === 'arm' || g.part === 'collar') return false;                                                 // a leg
    if (g.part === 'leg' && g.side !== c - 3) return false;                                                    // never the other leg
    return true;
  }
  // ---- smooth over the neighbours in the mesh, 3 times, then tidy up ----
  function finishWeights(only = null) {
    for (let round = 0; round < 3; round++) {
      const next = new Array(nw);
      for (let v = 0; v < nw; v++) {
        if (fixed[v] || (only && !only[v])) { next[v] = weights[v]; continue; }
        const out = new Map();
        const cnt = start[v + 1] - start[v];
        for (const [b, w] of weights[v]) out.set(b, w * 0.5);
        if (!cnt) { next[v] = weights[v]; continue; }
        for (let e = start[v]; e < start[v + 1]; e++) for (const [b, w] of weights[nbr[e]]) out.set(b, (out.get(b) || 0) + (w * 0.5) / cnt);
        next[v] = out;
      }
      weights = next;
    }
    for (let v = 0; v < nw; v++) {
      if (only && !only[v]) continue;
      let list = [];
      for (const [b, w] of weights[v]) if (allowed(v, b)) list.push([b, w]);
      if (!list.length) list = [...weights[v]];
      list.sort((a, b) => b[1] - a[1]);
      list = list.slice(0, 4);                                             // at most 4 bones
      let sum = 0;
      for (const a of list) sum += a[1];
      list = list.filter((a) => a[1] / sum >= 0.02);                       // drop tiny weights
      sum = 0;
      for (const a of list) sum += a[1];
      weights[v] = new Map(list.map(([b, w]) => [b, w / sum]));
    }
  }

  // ------------------------------------------------------- 12. the self-test
  // Bend one joint, move the points around it like the game would, and compare
  // the volume of that piece of the mesh with the volume in the rest pose.
  // (The joint itself does not move, so "volume seen from the joint" is exact.)
  const parentOf = bones.map((b) => (b.parent ? bi(b.parent) : -1));
  const isBelow = (b, top) => { for (let x = b; x >= 0; x = parentOf[x]) if (x === top) return true; return false; };
  const gains = {};     // how far each helper bone moves outward when its joint bends (found by the test)
  for (const b of bones) if (b.helper === 'half') gains[b.name] = 0.35;

  const TESTS = [];
  for (let q = 0; q < 2; q++) {
    const { tag } = SIDES[q], nm = q ? 'right' : 'left';
    const ax = (bone) => bones[bi(bone + '_' + tag)].axes;
    TESTS.push({ label: `${nm} shoulder`, key: 'shoulder', q, bone: 'upperArm_' + tag, fix: 'shoulderFix_' + tag, limit: 'forward 170, sideways 160',
      moves: [[ax('upperArm')[0], 45], [ax('upperArm')[0], 90], [ax('upperArm')[0], 150], [FWD, (q ? -1 : 1) * 50], [FWD, (q ? 1 : -1) * 40]] });
    TESTS.push({ label: `${nm} elbow`, key: 'elbow', q, bone: 'foreArm_' + tag, fix: 'elbowFix_' + tag, limit: '0 to 150',
      moves: [[ax('foreArm')[0], 45], [ax('foreArm')[0], 90], [ax('foreArm')[0], 120], [ax('foreArm')[0], 150]] });
    TESTS.push({ label: `${nm} wrist`, key: 'wrist', q, bone: 'hand_' + tag, fix: null, limit: '-70 to 80',
      moves: [[ax('hand')[2], (q ? 1 : -1) * 80], [ax('hand')[2], (q ? -1 : 1) * 70]] });     // toward the palm, toward the back of the hand
    TESTS.push({ label: `${nm} hip`, key: 'hip', q, bone: 'thigh_' + tag, fix: 'hipFix_' + tag, limit: '-30 to 120, sideways 45',
      moves: [[ax('thigh')[0], 45], [ax('thigh')[0], 90], [ax('thigh')[0], 120], [ax('thigh')[0], -30], [FWD, (q ? -1 : 1) * 45]] });
    TESTS.push({ label: `${nm} knee`, key: 'knee', q, bone: 'shin_' + tag, fix: 'kneeFix_' + tag, limit: '0 to 140',
      moves: [[ax('shin')[0], -45], [ax('shin')[0], -90], [ax('shin')[0], -140]] });
    TESTS.push({ label: `${nm} ankle`, key: 'ankle', q, bone: 'foot_' + tag, fix: null, limit: '-20 to 40',
      moves: [[[1, 0, 0], 40], [[1, 0, 0], -20]] });
  }
  // the points and triangles around every joint (found once per weight set)
  function zoneOf(test) {
    const d = signed[test.key][test.q], half = 0.12 * k, used = new Int32Array(nw).fill(-1), verts = [], t3 = [];
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      if (!(Math.abs(d[a]) < half && Math.abs(d[b]) < half && Math.abs(d[c]) < half)) continue;
      for (const v of [a, b, c]) if (used[v] < 0) { used[v] = verts.length; verts.push(v); }
      t3.push(used[a], used[b], used[c]);
    }
    return { verts, t3 };
  }
  function volumeOf(test, Z, axis, angle, gain) {
    const top = bi(test.bone), fix = test.fix ? bi(test.fix) : -1, J = bones[top].head;
    const a = angle * DEG;
    // where the helper bone goes: half the turn, and a little outward (away from the inside of the bend)
    let off = [0, 0, 0];
    if (fix >= 0) {
      const dir = bones[top].axes[1], bent = rotate(dir, axis, a), outward = sub(dir, bent), l = len(outward);
      if (l > 1e-5) off = mul(outward, (gain * bones[fix].radius * Math.sin(a / 2) ** 2) / l);
    }
    const pos = new Float32Array(Z.verts.length * 3);
    for (let i = 0; i < Z.verts.length; i++) {
      const v = Z.verts[i], p = sub(pt(v), J);
      let x = 0, y = 0, z = 0;
      for (const [b, w] of weights[v]) {
        let r;
        if (b === fix) r = add(rotate(p, axis, a / 2), off);
        else if (isBelow(b, top)) r = rotate(p, axis, a);
        else r = p;
        x += r[0] * w; y += r[1] * w; z += r[2] * w;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    let vol = 0;
    for (let t = 0; t < Z.t3.length; t += 3) {
      const a0 = Z.t3[t] * 3, b0 = Z.t3[t + 1] * 3, c0 = Z.t3[t + 2] * 3;
      vol += pos[a0] * (pos[b0 + 1] * pos[c0 + 2] - pos[b0 + 2] * pos[c0 + 1]) - pos[a0 + 1] * (pos[b0] * pos[c0 + 2] - pos[b0 + 2] * pos[c0]) + pos[a0 + 2] * (pos[b0] * pos[c0 + 1] - pos[b0 + 1] * pos[c0]);
    }
    return vol / 6;
  }
  const TOL = 12;       // percent: more change than this is a WARN
  function runTests(which = TESTS) {
    const rows = [];
    for (const test of which) {
      const Z = zoneOf(test);
      const gain = test.fix ? gains[test.fix] : 0;
      const v0 = Z.t3.length ? volumeOf(test, Z, [1, 0, 0], 0, 0) : 0;
      let worst = 0, worstAt = 0;
      if (Math.abs(v0) > 1e-7) for (const [axis, angle] of test.moves) {
        const change = (volumeOf(test, Z, axis, angle, gain) / v0 - 1) * 100;
        if (Math.abs(change) > Math.abs(worst)) { worst = change; worstAt = angle; }
      }
      rows.push({ joint: test.label, key: test.key, q: test.q, fix: test.fix, limit: test.limit, change: +worst.toFixed(1), at: worstAt, triangles: Z.t3.length / 3, status: !Z.t3.length ? 'SKIP' : Math.abs(worst) <= TOL ? 'PASS' : 'WARN', Z, test, v0 });
    }
    return rows;
  }
  // how bad is this joint right now? (the biggest volume change over all its test moves, in percent)
  function worstOf(test, Z, v0, gain) {
    let worst = 0;
    for (const [axis, angle] of test.moves) { const c = (volumeOf(test, Z, axis, angle, gain) / v0 - 1) * 100; if (Math.abs(c) > Math.abs(worst)) worst = c; }
    return worst;
  }
  // REPAIR one joint with a WARN:
  //   1. helper bone: try several strengths of its outward move, keep the best
  //   2. still bad: try narrower and wider soft zones (only the points around this joint are
  //      worked out again), keep the best
  function repair(row) {
    const { test } = row;
    let Z = row.Z, v0 = row.v0;
    const bestGain = () => {
      if (!test.fix) return Math.abs(worstOf(test, Z, v0, 0));
      let best = gains[test.fix], bw = Math.abs(worstOf(test, Z, v0, best));
      for (const g of [0, 0.2, 0.5, 0.8, 1.1, 1.5, 2, 2.6]) { const w = Math.abs(worstOf(test, Z, v0, g)); if (w < bw - 0.2) { bw = w; best = g; } }
      gains[test.fix] = best;
      return bw;
    };
    let now = bestGain();
    if (now <= TOL) return;
    const z = zone[test.key], original = z[test.q], d = signed[test.key][test.q];
    const mask = new Uint8Array(nw);
    for (let v = 0; v < nw; v++) if (Math.abs(d[v]) < 0.2 * k) mask[v] = 1;
    const redo = (h) => { z[test.q] = h; computeWeights(mask); finishWeights(mask); Z = zoneOf(test); v0 = Z.t3.length ? volumeOf(test, Z, [1, 0, 0], 0, 0) : 0; };
    let bestH = original;
    for (const f of [0.78, 1.3]) {
      const h = clamp(original * f, 0.016 * k, 0.062 * k);
      redo(h);
      if (Math.abs(v0) < 1e-7) continue;
      const w = bestGain();
      if (w < now - 0.3) { now = w; bestH = h; }
    }
    redo(bestH);
    bestGain();
  }

  // ------------------------------------------------------- 13. run it all
  findFingers();
  computeWeights();
  finishWeights();
  let rows = runTests();
  const rounds = [rows.filter((r) => r.status === 'WARN').length];
  for (let round = 0; round < 3 && rows.some((r) => r.status === 'WARN'); round++) {
    // only the joints with a WARN are repaired and tested again
    const bad = rows.filter((r) => r.status === 'WARN');
    for (const row of bad) repair(row);
    const again = runTests(bad.map((r) => r.test));
    // stop early when a round did not make anything better (saves time on phones)
    let better = false;
    for (const a of again) { const before = bad.find((r) => r.test === a.test); if (Math.abs(a.change) < Math.abs(before.change) - 0.5) better = true; }
    rows = rows.map((r) => again.find((a) => a.test === r.test) || r);
    rounds.push(rows.filter((r) => r.status === 'WARN').length);
    if (!better) break;
  }
  const table = rows.map((r) => ({ joint: r.joint, status: r.status, change: r.change, at: r.at, limit: r.limit, text: r.status === 'SKIP' ? 'no mesh found around it' : `${r.change > 0 ? '+' : ''}${r.change} % volume at ${r.at} deg` }));
  say(`self-test: WARN count per round: ${rounds.join(' -> ')}`);
  for (const r of table) say(`${r.joint.padEnd(15)} ${r.status}  ${r.text}`);

  // ------------------------------------------------------- 14. weights for every point of the model
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  let maxInfluences = 0, leaks = 0;
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (const [b, w] of weights[wOf[i]]) { skinIndex[i * 4 + c] = b; skinWeight[i * 4 + c] = w; c++; }
    if (c > maxInfluences) maxInfluences = c;
  }
  // count leaks (should be 0): a point of one leg that follows the other leg, a far arm point that follows the body
  for (let v = 0; v < nw; v++) for (const [b] of weights[v]) if (!allowed(v, b)) leaks++;

  const ms = Date.now() - t0;
  say(`done in ${ms} ms: ${nw} corner points, ${bones.length} bones, at most ${maxInfluences} bones per point, ${leaks} leaks`);
  return {
    positions: P, scale, flip, height: H,
    joints, bones, boneIndex, skinIndex, skinWeight, gains,
    info: { crotchY, hipY, neckY: info.neckY, chinY: info.chinY, restAngles, fingersSeparate, sides: info.side.map((S) => ({ armR: S.armR, elbowR: S.elbowR, wristR: S.wristR, handLen: S.handLen, handW: S.handW, handDir: S.handDir, handLat: S.handLat, thighR: S.thighR, kneeR: S.kneeR, ankleR: S.ankleR, heelZ: S.heelZ, toeZ: S.toeZ, armpitY: S.armpitY })) },
    report: { table, symmetry, notes, log, rounds, ms, maxInfluences, leaks, points: nw, bones: bones.length, fingers: fingersSeparate.map((f) => (f ? 'separate fingers' : 'one rigid hand block')) },
    debug: { cls, wOf, weightsOf: (i) => weights[wOf[i]] },
  };
}

// ===========================================================================
// THE THREE.JS PART: turn a loaded model into a skinned, posable character.
//   THREE:  the three.js module
//   model:  the loaded model (any Object3D with one or more meshes; the biggest is used)
//   opts:   { height (meters), onProgress(fraction, text) }
// Returns the rig: { root, mesh, bones (by name), skeleton, rest, def, report }.
// ===========================================================================
// SMOOTH SHADING. The models' own normals are cut in many places (each piece of the picture keeps its own, and many
// edges of the low-poly face are hard): close up, a face and a neck look made of flat pieces with lines between them -
// a line across a neck looks like a cut. Here every point gets the normal of the surface round its spot: the faces that
// meet there (also across the seams of the picture, welded by position), weighted by their size - but only the faces
// that turn less than maxDeg from the point's own normal, so a real fold (a collar, the edge of a sleeve) stays sharp.
// P: positions, N: normals (changed in place), I: the triangles.
export function smoothNormals(P, N, I, maxDeg = 60) {
  const n = P.length / 3, spot = new Int32Array(n), ids = new Map();
  let spots = 0;
  for (let v = 0; v < n; v++) {
    const k = `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`;
    let s = ids.get(k);
    if (s === undefined) { s = spots++; ids.set(k, s); }
    spot[v] = s;
  }
  // the faces round each spot (a compact list: start[s] .. start[s + 1])
  const T = I.length / 3, fn = new Float32Array(T * 3), start = new Int32Array(spots + 1), list = new Int32Array(I.length);
  for (let t = 0; t < T; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;     // (length = 2 x area)
    start[spot[a] + 1]++; start[spot[b] + 1]++; start[spot[c] + 1]++;
  }
  for (let s = 0; s < spots; s++) start[s + 1] += start[s];
  const fill = start.slice(0, spots);
  for (let t = 0; t < T; t++) for (let j = 0; j < 3; j++) list[fill[spot[I[t * 3 + j]]]++] = t;
  const cosMax = Math.cos((maxDeg * Math.PI) / 180);
  for (let v = 0; v < n; v++) {
    const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
    let sx = 0, sy = 0, sz = 0;
    for (let q = start[spot[v]]; q < start[spot[v] + 1]; q++) {
      const t = list[q], fx = fn[t * 3], fy = fn[t * 3 + 1], fz = fn[t * 3 + 2], fl = Math.hypot(fx, fy, fz);
      if (fl < 1e-14) continue;
      if ((fx * nx + fy * ny + fz * nz) / fl < cosMax) continue;          // (across a real fold: not this face)
      sx += fx; sy += fy; sz += fz;
    }
    const l = Math.hypot(sx, sy, sz);
    if (l < 1e-14) continue;
    N[v * 3] = sx / l; N[v * 3 + 1] = sy / l; N[v * 3 + 2] = sz / l;
  }
}

export async function autoRig(THREE, model, opts = {}) {
  const progress = opts.onProgress || (() => {});
  const wait = () => new Promise((r) => setTimeout(r, 0));     // lets the loading bar repaint
  progress(0.05, 'Reading the character');
  await wait();
  model.updateWorldMatrix(true, true);
  let src = null;
  model.traverse((o) => { if (o.isMesh && (!src || o.geometry.attributes.position.count > src.geometry.attributes.position.count)) src = o; });
  if (!src) throw new Error('no mesh in the character model');
  const g0 = src.geometry, pos = g0.attributes.position, count = pos.count;
  // plain numbers in world space (model files often store small whole numbers plus a scale)
  const raw = new Float32Array(count * 3), v = new THREE.Vector3();
  for (let i = 0; i < count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(src.matrixWorld); raw[i * 3] = v.x; raw[i * 3 + 1] = v.y; raw[i * 3 + 2] = v.z; }
  let index = g0.index ? g0.index.array : null;
  if (!index) { index = new Uint32Array(count); for (let i = 0; i < count; i++) index[i] = i; }

  progress(0.2, 'Finding joints and skin');
  await wait();
  // opts.analyze: do the heavy part somewhere else (a background worker), so the game does not stop meanwhile
  const A = opts.analyze ? await opts.analyze(raw, index, opts.height || 1.8) : analyzeCharacter(raw, index, { height: opts.height || 1.8 });

  progress(0.8, 'Building the skeleton');
  await wait();
  // ---- geometry: new positions, the old picture coordinates, fresh normals ----
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(A.positions, 3));
  if (g0.attributes.uv) {
    const uv = g0.attributes.uv, arr = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) { arr[i * 2] = uv.getX(i); arr[i * 2 + 1] = uv.getY(i); }
    geo.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
  }
  geo.setIndex(new THREE.BufferAttribute(index.length > 65535 || count > 65535 ? new Uint32Array(index) : new Uint16Array(index), 1));
  if (g0.attributes.normal) {
    // keep the model's own smooth normals (only turned if the model was turned around)
    const nr = g0.attributes.normal, arr = new Float32Array(count * 3), nm = new THREE.Matrix3().getNormalMatrix(src.matrixWorld);
    for (let i = 0; i < count; i++) { v.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize(); arr[i * 3] = A.flip ? -v.x : v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = A.flip ? -v.z : v.z; }
    geo.setAttribute('normal', new THREE.BufferAttribute(arr, 3));
    if (opts.smooth !== false) smoothNormals(geo.attributes.position.array, arr, geo.index.array, 60);
  } else geo.computeVertexNormals();
  // ---- the face: where the nose, the eyes, the mouth and the eyebrows are (faceClean.js) ----
  const material = Array.isArray(src.material) ? src.material[0] : src.material;
  let face = null;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  try { face = readFace(geo, material, A); } catch (e) { console.warn('[autoRig] the face could not be read:', e); }
  // a model that was made with an open, laughing mouth gets a calm face first (faceSculpt.js); then it is read again
  if (face && opts.faceRig !== false && opts.sculpt !== false && SCULPT[opts.name]) {
    try {
      const done = sculptFace(THREE, A, face, geo, material, SCULPT[opts.name]);
      if (done) { face = readFace(geo, material, A); if (opts.faceDebug) opts.faceDebug.sculpt = done; }
    } catch (e) { console.warn('[autoRig] the face could not be sculpted:', e); }
  }
  // small bones for the jaw, the eyelids, the eyebrows and the corners of the mouth (faceRig.js). opts.faceRig: false = off
  if (face && opts.faceRig !== false && !A.face) { try { addFaceBones(A, face); } catch (e) { console.warn('[autoRig] no face bones:', e); } }
  if (A.face) A.face.name = opts.name || '';                 // (faceAnim.js: some models get a fix of their own)
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(A.skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(A.skinWeight, 4));
  // (where the lips meet: the shader draws the inside of an open mouth there)
  if (A.lip) geo.setAttribute('pgLip', new THREE.BufferAttribute(A.lip, 2));
  geo.computeBoundingBox();
  // (a generous sphere: the pose changes, the sphere is not recomputed)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, A.height / 2, 0), A.height * 0.95);

  const rig = assemble(THREE, A, geo, material);
  // the face: painted shadows and smudges are cleaned in the character's picture (faceClean.js). opts.faceClean: 0 = off
  try { rig.faceCleaned = cleanFace(THREE, face, material, opts.faceClean === undefined ? 1 : opts.faceClean, opts.faceDebug || null); } catch (e) { rig.faceCleaned = false; console.warn('[autoRig] the face could not be cleaned:', e); }
  // close up: a sharper picture with clean seams, wet eyes (characterDetail.js). opts.detail: false = off
  let detail = null;
  if (opts.look !== false && opts.detail !== false) {
    await wait();                                          // (a breath for the game between the face and the picture)
    try { detail = await prepareCharacter(THREE, A, geo, material, face, { sharpen: opts.sharpen }); } catch (e) { detail = null; console.warn('[autoRig] no close-up detail:', e); }
  }
  rig.detail = detail;
  // the light on a character: a soft fill light from the camera, a matt head (characterLook.js). opts.look: false = off
  if (opts.look !== false) applyCharacterLook(material, A.info.chinY, A.face && A.lip ? { jaw: A.face.jawBone, head: A.face.headBone, p: A.face.lipPoint, ref: 0.007 * (A.height / 1.8) } : null, detail);
  rig.faceMs = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
  face = null;                                             // (its big tables are not needed any more)
  progress(1, 'Character ready');
  if (opts.log !== false && A.report) {
    console.groupCollapsed(`[autoRig] ${opts.name || 'character'}: ${A.report.table.filter((r) => r.status === 'PASS').length} PASS, ${A.report.table.filter((r) => r.status === 'WARN').length} WARN (${A.report.ms} ms) - open for the full report`);
    for (const line of A.report.log) console.log(line);
    for (const line of A.report.notes) console.warn(line);
    console.groupEnd();
    console.table(A.report.table.map((r) => ({ joint: r.joint, result: r.status, 'volume change': r.text, limits: r.limit })));
  }
  return rig;
}

// Bones + skinned mesh from a finished analysis. geo: the geometry with skin weights.
function assemble(THREE, A, geo, material) {
  // ---- bones ----
  const list = [], byName = {}, rest = {}, worldQ = [];
  const m = new THREE.Matrix4();
  A.bones.forEach((b, i) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    const [x, y, z] = b.axes;
    m.makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z));
    worldQ[i] = new THREE.Quaternion().setFromRotationMatrix(m);
    list.push(bone); byName[b.name] = bone;
  });
  A.bones.forEach((b, i) => {
    const bone = list[i], p = b.parent ? A.boneIndex[b.parent] : -1;
    if (p < 0) { bone.position.set(...b.head); bone.quaternion.copy(worldQ[i]); }
    else {
      const inv = worldQ[p].clone().invert(), ph = A.bones[p].head;
      bone.position.set(b.head[0] - ph[0], b.head[1] - ph[1], b.head[2] - ph[2]).applyQuaternion(inv);
      bone.quaternion.copy(inv).multiply(worldQ[i]);
      list[p].add(bone);
    }
    // the rest pose is remembered: the animation always starts from it
    rest[b.name] = { position: bone.position.clone(), quaternion: bone.quaternion.clone(), world: worldQ[i].clone(), length: b.length, head: b.head.slice(), tail: b.tail.slice(), parent: b.parent, helper: b.helper || null, of: b.of || null, radius: b.radius || 0, gain: A.gains[b.name] || 0 };
  });
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = 'character';
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;            // one character: cheaper than testing a moving shape
  const root = new THREE.Group();
  root.name = 'characterRig';
  root.add(list[0]);
  root.add(mesh);
  const skeleton = new THREE.Skeleton(list);
  root.updateMatrixWorld(true);
  mesh.bind(skeleton);
  return { root, mesh, bones: byName, list, skeleton, rest, def: A, report: A.report, joints: A.joints, info: A.info, height: A.height };
}

// A second character with the same body (it shares the mesh data, so it costs little memory).
// material: another look for the copy (left out = the same).
export function cloneRig(THREE, rig, material = null) {
  return assemble(THREE, rig.def, rig.mesh.geometry, material || rig.mesh.material);
}
