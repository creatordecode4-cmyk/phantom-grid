// ---------------------------------------------------------------------------
// raceLine.js - the road of a race, worked out from a few points.
//
//   makeLine(points, opts)
//     points: [[x, z, halfWidth?], ...]  points in the middle of the road, in the order the race is driven.
//             halfWidth: how far a car may go to each side of that point (meters; default opts.width)
//     opts:   { closed: true for a lap race (the end joins the start), width, step (meters between points),
//               margin (meters kept from the edge), ground(x, z) -> height }
//
//   Two lines are made:
//     mid      THE MIDDLE OF THE ROAD, a point every "step" meters: { x, z, w (half width), dx, dz }.
//              Where a car is in the race (meters along it, and how far to the side) is measured on it.
//     race     THE RACING LINE, with its own points: how a driver takes the corners. Before a corner it is
//              at the OUTSIDE edge of the road, at the middle of the corner close to the INSIDE corner, after
//              it at the outside edge again (outside - inside - outside): a circle as big as the road allows.
//              Between two corners: straight from one to the next.
//   curv      how sharp the racing line bends (1 / radius in meters), at every point of the racing line
//
//   project(x, z, hint) -> { s (meters along the middle line), d (meters to the LEFT of the middle), i }
//   midAt(s) / raceAt(s) -> a point on the middle / the racing line at s (s always in middle-line meters)
//   raceOffset(s)  how far the racing line is to the left of the middle there
//   sharpest(s, ahead), speedProfile(grip, brake, top) -> the fastest safe speed (m/s) on the racing line,
//     with the braking for the next corner already in it; .min(s, ahead) is what a driver looks at
//
// Directions: +z north, +x west. "Left" of a direction (dx, dz) is (dz, -dx), as everywhere in the game.
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const G = 9.81;

// points every "step" meters along a list of points
function resample(list, step, closed) {
  const out = [];
  const L = closed ? list.length : list.length - 1;
  for (let i = 0; i < L; i++) {
    const a = list[i], b = list[(i + 1) % list.length], len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) { const t = k / n; out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, w: (a.w || 0) + ((b.w || 0) - (a.w || 0)) * t, fixed: !!(a.fixed && b.fixed) }); }
  }
  if (!closed) out.push({ ...list[list.length - 1] });
  return out;
}

export function makeLine(points, opts = {}) {
  const closed = !!opts.closed, step = opts.step || 2, W = opts.width || 6;
  const margin = opts.margin === undefined ? 1.6 : opts.margin;
  const src = points.map((p) => ({ x: p[0], z: p[1], w: p[2] || W }));
  const M = src.length;

  // ---- 1. the middle of the road ----
  const mid = resample(src, step, closed);
  const N = mid.length;
  const idx = (i) => (closed ? ((i % N) + N) % N : clamp(i, 0, N - 1));
  for (let i = 0; i < N; i++) {
    const a = mid[idx(i - 1)], b = mid[idx(i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    mid[i].dx = dx / l; mid[i].dz = dz / l;
  }
  const at = new Float32Array(N + 1);
  for (let i = 1; i <= N; i++) { const a = mid[i - 1], b = mid[idx(i)]; at[i] = at[i - 1] + (i < N || closed ? Math.hypot(b.x - a.x, b.z - a.z) : 0); }
  const total = closed ? at[N] : at[N - 1];

  // ---- 2. the corners: a circle that touches the outside edge before and after, and comes to the inside ----
  //  (a corner of angle "turn" between roads of usable half width u: the biggest such circle has the radius
  //   2u / (1 - sin(phi)), phi = (180 deg - turn) / 2. A 90-degree street corner: about 3.4 x the road width.)
  const arcAt = new Array(M).fill(null);
  for (let i = 0; i < M; i++) {
    if (!closed && (i === 0 || i === M - 1)) continue;
    const a = src[(i - 1 + M) % M], b = src[i], c = src[(i + 1) % M];
    const l1 = Math.hypot(b.x - a.x, b.z - a.z), l2 = Math.hypot(c.x - b.x, c.z - b.z);
    if (l1 < 1 || l2 < 1) continue;
    const d1x = (b.x - a.x) / l1, d1z = (b.z - a.z) / l1, d2x = (c.x - b.x) / l2, d2z = (c.z - b.z) / l2;
    const cross = d1x * d2z - d1z * d2x, dot = d1x * d2x + d1z * d2z;
    const turn = Math.atan2(Math.abs(cross), dot);
    if (turn < 0.25 || turn > 2.3) continue;                    // (a gentle bend, or part of a hairpin: no circle)
    const u = Math.min(a.w, b.w, c.w) - margin, phi = (Math.PI - turn) / 2;
    let R = Math.min(160, (2 * u) / (1 - Math.sin(phi)));
    // (the circle must fit between this corner and the ones before and after: half of each piece of road)
    const extra = u / Math.tan(phi), most = 0.48 * Math.min(l1, l2);
    if (R / Math.tan(phi) - extra > most) R = (most + extra) * Math.tan(phi);
    // the outside: away from the turn. cross < 0: the heading grows (+x is west): a LEFT turn
    const out = cross < 0 ? -1 : 1;
    const n1x = d1z * out, n1z = -d1x * out, n2x = d2z * out, n2z = -d2x * out;
    const bx = n1x + n2x, bz = n1z + n2z, bl = Math.hypot(bx, bz) || 1;
    // the outer corner (where the two outside edges meet), the circle's middle, the two touching points
    const ox = b.x + (bx / bl) * (u / Math.sin(phi)), oz = b.z + (bz / bl) * (u / Math.sin(phi));
    const T = R / Math.tan(phi);
    const cx = ox - (bx / bl) * (R / Math.sin(phi)), cz = oz - (bz / bl) * (R / Math.sin(phi));
    arcAt[i] = { t1x: ox - d1x * T, t1z: oz - d1z * T, t2x: ox + d2x * T, t2z: oz + d2z * T, cx, cz, R };
  }
  // ---- 3. the racing line: the touching points and the circles, joined by straight lines ----
  const raw = [];
  for (let i = 0; i < M; i++) {
    const A = arcAt[i];
    if (!A) { raw.push({ x: src[i].x, z: src[i].z, fixed: !closed && (i === 0 || i === M - 1) }); continue; }
    const a1 = Math.atan2(A.t1x - A.cx, A.t1z - A.cz), a2 = Math.atan2(A.t2x - A.cx, A.t2z - A.cz);
    const span = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
    const n = Math.max(2, Math.ceil((Math.abs(span) * A.R) / step));
    for (let k = 0; k <= n; k++) { const ang = a1 + (span * k) / n; raw.push({ x: A.cx + Math.sin(ang) * A.R, z: A.cz + Math.cos(ang) * A.R, fixed: true }); }
  }
  const race = resample(raw, step, closed);
  const RN = race.length;
  const ri = (i) => (closed ? ((i % RN) + RN) % RN : clamp(i, 0, RN - 1));
  // (keep the circles; smooth only the rest a little, so no point bends sharply - a hairpin, a gentle bend)
  for (let it = 0; it < 40; it++) {
    for (let i = closed ? 0 : 1; i < (closed ? RN : RN - 1); i++) {
      const p = race[i];
      if (p.fixed) continue;
      const a = race[ri(i - 1)], b = race[ri(i + 1)];
      p.x += ((a.x + b.x) / 2 - p.x) * 0.3; p.z += ((a.z + b.z) / 2 - p.z) * 0.3;
    }
  }
  const rAt = new Float32Array(RN + 1);
  for (let i = 1; i <= RN; i++) { const a = race[i - 1], b = race[ri(i)]; rAt[i] = rAt[i - 1] + (i < RN || closed ? Math.hypot(b.x - a.x, b.z - a.z) : 0); }
  const rTotal = closed ? rAt[RN] : rAt[RN - 1];
  // ---- 4. how sharp the racing line bends (a circle through three points 6 m apart) ----
  const curvRaw = new Float32Array(RN), curv = new Float32Array(RN);
  for (let i = 0; i < RN; i++) {
    const a = race[ri(i - 3)], b = race[i], c = race[ri(i + 3)];
    const abx = b.x - a.x, abz = b.z - a.z, cbx = c.x - b.x, cbz = c.z - b.z, acx = c.x - a.x, acz = c.z - a.z;
    const den = Math.hypot(abx, abz) * Math.hypot(cbx, cbz) * Math.hypot(acx, acz);
    curvRaw[i] = den > 1e-6 ? Math.abs(2 * (abx * cbz - abz * cbx)) / den : 0;
  }
  for (let i = 0; i < RN; i++) { let s = 0; for (let k = -2; k <= 2; k++) s += curvRaw[ri(i + k)]; curv[i] = s / 5; }
  // ---- 5. which racing-line meter belongs to every middle point (always forward along the race) ----
  const map = new Float32Array(N);
  {
    let j = 0;
    for (let i = 0; i < N; i++) {
      const m = mid[i];
      let best = j, bd = Infinity;
      const from = i === 0 ? 0 : j, to = i === 0 ? RN : j + 70;
      for (let k = from; k < to; k++) {
        const q = race[ri(k)], d = (q.x - m.x) * (q.x - m.x) + (q.z - m.z) * (q.z - m.z);
        if (d < bd) { bd = d; best = k; }
      }
      j = best;
      map[i] = rAt[ri(j)] + (j >= RN ? rTotal : 0);
    }
    for (let i = 1; i < N; i++) if (map[i] < map[i - 1]) map[i] = map[i - 1];
  }

  // ---- finding a car on the middle line ----
  function project(x, z, hint = -1) {
    let best = 0, bestD = Infinity, from = 0, to = N - 1;
    if (hint >= 0) { from = hint - 40; to = hint + 80; }
    for (let k = from; k <= to; k++) {
      const i = idx(k), j = idx(i + 1);
      if (!closed && i >= N - 1) continue;
      const a = mid[i], b = mid[j], ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1;
      const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
      const qx = a.x + ex * t, qz = a.z + ez * t, d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
      if (d < bestD) { bestD = d; best = i + t; }
    }
    // (nothing close near the last place: search everything once)
    if (hint >= 0 && bestD > 40 * 40) return project(x, z, -1);
    const i = Math.floor(best), t = best - i, a = mid[idx(i)], b = mid[idx(i + 1)];
    const qx = a.x + (b.x - a.x) * t, qz = a.z + (b.z - a.z) * t;
    const d = (x - qx) * a.dz + (z - qz) * -a.dx;               // meters to the left of the middle
    return { s: at[i] + (at[i + 1] - at[i]) * t, d, i: idx(i) };
  }
  // middle-line meters -> { i, t }
  function find(s) {
    s = closed ? ((s % total) + total) % total : clamp(s, 0, total);
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (at[m] <= s) lo = m; else hi = m - 1; }
    const seg = (at[lo + 1] - at[lo]) || 1;
    return { i: lo, t: clamp((s - at[lo]) / seg, 0, 1) };
  }
  // middle-line meters -> racing-line meters
  function toRace(s) {
    const lapN = closed ? Math.floor(s / total) : 0;
    const f = find(s), a = map[f.i], b = f.i + 1 < N ? map[f.i + 1] : closed ? map[0] + rTotal : map[N - 1];
    return a + (b - a) * f.t + lapN * rTotal;
  }
  function rFind(r) {
    r = closed ? ((r % rTotal) + rTotal) % rTotal : clamp(r, 0, rTotal);
    let lo = 0, hi = RN - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rAt[m] <= r) lo = m; else hi = m - 1; }
    const seg = (rAt[lo + 1] - rAt[lo]) || 1;
    return { i: lo, t: clamp((r - rAt[lo]) / seg, 0, 1) };
  }
  function midAt(s, out = {}) {
    const f = find(s), a = mid[f.i], b = mid[idx(f.i + 1)];
    out.x = a.x + (b.x - a.x) * f.t; out.z = a.z + (b.z - a.z) * f.t;
    const ex = b.x - a.x, ez = b.z - a.z, l = Math.hypot(ex, ez) || 1;
    out.dx = ex / l; out.dz = ez / l; out.w = a.w + (a.corner || 0); out.i = f.i;
    return out;
  }
  function raceAt(s, out = {}) {
    const f = rFind(toRace(s)), a = race[f.i], b = race[ri(f.i + 1)];
    out.x = a.x + (b.x - a.x) * f.t; out.z = a.z + (b.z - a.z) * f.t;
    const ex = b.x - a.x, ez = b.z - a.z, l = Math.hypot(ex, ez) || 1;
    out.dx = ex / l; out.dz = ez / l;
    const m = mid[find(s).i]; out.w = m.w + (m.corner || 0);       // (the road's half width there)
    return out;
  }
  const _m = {}, _r = {};
  function raceOffset(s) { midAt(s, _m); raceAt(s, _r); return (_r.x - _m.x) * _m.dz + (_r.z - _m.z) * -_m.dx; }
  function sharpest(s, ahead) {
    const f = rFind(toRace(s)), n = Math.ceil(ahead / step);
    let k = 0;
    for (let q = 0; q <= n; q++) k = Math.max(k, curv[ri(f.i + q)]);
    return k;
  }
  // FASTEST SAFE SPEED on the racing line: a corner of radius r can be taken at sqrt(grip * g * r); before it
  // the car must have been able to brake down to that (v^2 = v_next^2 + 2 * brake * distance)
  function speedProfile(grip = 1.1, brake = 9, top = 70) {
    const v = new Float32Array(RN);
    for (let i = 0; i < RN; i++) v[i] = Math.min(top, Math.sqrt((grip * G) / Math.max(curv[i], 1e-4)));
    for (let r = 0; r < (closed ? 2 : 1); r++) {
      for (let i = RN - 1; i >= 0; i--) {
        if (!closed && i === RN - 1) continue;
        const j = ri(i + 1), ds = Math.max(0.5, rAt[i + 1] - rAt[i]);
        v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * brake * ds));
      }
    }
    return {
      v,
      min: (s, ahead) => { const f = rFind(toRace(s)), n = Math.ceil(ahead / step); let m = Infinity; for (let q = 0; q <= n; q++) m = Math.min(m, v[ri(f.i + q)]); return m; },
    };
  }
  // the height of the ground under the points (markers)
  if (opts.ground) for (const p of mid) p.y = opts.ground(p.x, p.z);
  // points inside a crossing may go a little further sideways (the crossing is wider than the street)
  for (let i = 0; i < M; i++) if (arcAt[i]) { const b = src[i]; for (const m of mid) if (Math.hypot(m.x - b.x, m.z - b.z) < b.w + 3) m.corner = 2.5; }

  return {
    closed, step, total, mid, race, curv, N, rTotal,
    project, sharpest, speedProfile, midAt, raceAt, raceOffset,
    wrap: (s) => (closed ? ((s % total) + total) % total : clamp(s, 0, total)),
  };
}
