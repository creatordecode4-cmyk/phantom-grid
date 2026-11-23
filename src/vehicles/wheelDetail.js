// ---------------------------------------------------------------------------
// wheelDetail.js - a detailed wheel made in code, like the wheels of a good
// car model (the player's reference pictures):
//   * a round tyre with soft shoulders, a bulging side wall and grooves
//   * a deep rim: a dark barrel, a bright lip, spokes that dish inward,
//     a hub with a cap and five lug nuts
//   * behind the spokes a brake disc with drilled holes
//   * and a coloured brake caliper that does NOT turn with the wheel
//
// Everything that turns is ONE geometry (one draw call per wheel); the caliper
// is a second, small one. The material is the car material made in code
// (mats.carPaint): every part keeps its own colour, roughness and metal in
// its vertices.
// The axle is the x axis, the outside of the wheel looks to +x, the middle of
// the wheel is (0, 0, 0). For a wheel on the other side, turn it by PI about y.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mergeParts } from '../utils/geometry.js';
import { lin } from '../city/models.js';

const HALF_PI = Math.PI / 2;
const RUBBER = lin([0.032, 0.032, 0.035]), TREAD = lin([0.012, 0.012, 0.014]), WALL = lin([0.06, 0.06, 0.065]);
// the rims: spoke pattern, colour of the rim and of the brake caliper
export const RIM_STYLES = {
  twin5: { spokes: 5, twin: true, rim: [0.72, 0.73, 0.75], caliper: [0.75, 0.08, 0.05] },     // five double spokes, red caliper
  mesh10: { spokes: 10, twin: false, rim: [0.22, 0.22, 0.24], caliper: [0.85, 0.62, 0.05] },  // ten thin dark spokes, yellow caliper
  blade6: { spokes: 6, twin: false, blade: true, rim: [0.58, 0.6, 0.62], caliper: [0.1, 0.1, 0.11] }, // six wide blades, black caliper
  theo5: { spokes: 5, twin: false, rim: [0.66, 0.67, 0.69], caliper: [0.12, 0.12, 0.13] },     // Theo's car: five plain silver spokes (Chapter 6)
  // motorbike wheels: the spokes stand in the MIDDLE of the wheel (center), a red stripe on both rim edges,
  // ring-shaped brake discs ("rotors") on the hub: two at the front, one at the back plus the chain sprocket.
  //   discs: where each disc sits (part of the half width, + = the outside), rd: disc size (part of the tyre radius)
  bikeF: { spokes: 5, twin: true, center: true, rim: [0.5, 0.51, 0.53], lip: [0.72, 0.05, 0.03], caliper: [0.82, 0.56, 0.08], rotor: 'ring', discs: [0.9, -0.9], rd: 0.5 },
  bikeR: { spokes: 5, twin: true, center: true, rim: [0.5, 0.51, 0.53], lip: [0.72, 0.05, 0.03], caliper: [0.82, 0.56, 0.08], rotor: 'ring', discs: [0.72], rd: 0.4, sprocket: -1.28 },
};

// geometry around the y axis, turned so it lies around the x axis
const toX = [0, 0, -HALF_PI];
const part = (geom, pos, color, rough, metal, rot = null) => ({ geom, pos, color, rough, metal, rot });

const cache = new Map();
// r: the radius of the tyre, w: its width (meters), style: a key of RIM_STYLES, rimK: how big the rim is (0.6 .. 0.78)
export function makeDetailedWheel(r, w, style = 'twin5', rimK = 0.7) {
  const key = `${r.toFixed(3)}|${w.toFixed(3)}|${style}|${rimK}`;
  if (cache.has(key)) return cache.get(key);
  const S = RIM_STYLES[style] || RIM_STYLES.twin5;
  const ri = r * rimK, hw = w / 2, parts = [];
  // ---- the tyre: one turned shape, from the inside face over the tread to the outside face ----
  const wall = (r - ri);
  const prof = [
    [ri + 0.004, -hw + 0.012], [ri + wall * 0.4, -hw - 0.006], [r - wall * 0.22, -hw + 0.002], [r - 0.01, -hw + 0.022],
    [r, -hw + 0.05], [r, hw - 0.05],
    [r - 0.01, hw - 0.022], [r - wall * 0.22, hw - 0.002], [ri + wall * 0.4, hw + 0.006], [ri + 0.004, hw - 0.012],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  parts.push(part(new THREE.LatheGeometry(prof, 44), [0, 0, 0], RUBBER, 0.92, 0, toX));
  // grooves in the tread, and a thin ring on the side wall (where the letters would be)
  for (const gx of [-hw * 0.36, hw * 0.36]) parts.push(part(new THREE.TorusGeometry(r + 0.0012, 0.005, 4, 56), [gx, 0, 0], TREAD, 1, 0, [0, HALF_PI, 0]));
  parts.push(part(new THREE.TorusGeometry(ri + wall * 0.55, 0.0035, 3, 48), [hw + 0.004, 0, 0], WALL, 0.7, 0, [0, HALF_PI, 0]));
  // ---- the rim ----
  const rim = lin(S.rim), dark = lin([0.06, 0.06, 0.065]), center = !!S.center;
  // the barrel (seen from outside: its inner face)
  parts.push(part(new THREE.LatheGeometry([new THREE.Vector2(ri - 0.004, hw * 0.86), new THREE.Vector2(ri - 0.004, -hw * 0.86)], 40), [0, 0, 0], dark, 0.45, 0.85, toX));
  // the bright lip at the outside (a bike wheel shows both sides: a lip on each, with a coloured stripe)
  const lipCol = S.lip ? lin(S.lip) : rim;
  for (const side of center ? [1, -1] : [1]) parts.push(part(new THREE.TorusGeometry(ri - 0.004, 0.011, 6, 44), [side * (hw - 0.012), 0, 0], lipCol, S.lip ? 0.3 : 0.18, S.lip ? 0.2 : 1, [0, HALF_PI, 0]));
  // the spokes: from the hub out to the lip. A car wheel: at the outside face, dishing inward toward the hub.
  // A bike wheel: in the middle of the wheel, straight.
  const hubR = r * (center ? 0.12 : 0.17), L = ri - hubR - 0.006, dish = center ? 0 : 0.045, tilt = Math.atan2(dish, L);
  const xFace = center ? 0 : hw - 0.02;
  const spokeAt = (a, width, thick) => {
    const g = new THREE.BoxGeometry(thick, L, width);
    // (a little narrower at the hub)
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * 0.72);
    const rho = hubR + L / 2;
    parts.push(part(g, [xFace - dish / 2, Math.cos(a) * rho, Math.sin(a) * rho], rim, 0.2, 1, [a, 0, -tilt]));
  };
  const n = S.spokes;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    if (S.twin) { spokeAt(a - 0.1, r * 0.075, center ? 0.034 : 0.028); spokeAt(a + 0.1, r * 0.075, center ? 0.034 : 0.028); }
    else if (S.blade) spokeAt(a, r * 0.2, 0.03);
    else spokeAt(a, r * 0.06, 0.026);
  }
  if (center) {
    // a bike hub: a wide drum on the axle, an axle nut on each side
    parts.push(part(new THREE.CylinderGeometry(hubR, hubR, hw * 1.7, 22), [0, 0, 0], rim, 0.25, 1, toX));
    for (const side of [1, -1]) parts.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6), [side * hw * 0.95, 0, 0], lin([0.8, 0.8, 0.82]), 0.2, 1, toX));
  } else {
    // the hub, its cap, five lug nuts
    parts.push(part(new THREE.CylinderGeometry(hubR, hubR * 1.08, 0.05, 24), [xFace - dish - 0.004, 0, 0], rim, 0.25, 1, toX));
    parts.push(part(new THREE.CylinderGeometry(hubR * 0.42, hubR * 0.42, 0.014, 18), [xFace - dish + 0.024, 0, 0], dark, 0.3, 0.6, toX));
    parts.push(part(new THREE.TorusGeometry(hubR * 0.42, 0.003, 4, 18), [xFace - dish + 0.031, 0, 0], rim, 0.15, 1, [0, HALF_PI, 0]));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3;
      parts.push(part(new THREE.CylinderGeometry(0.0085, 0.0085, 0.022, 6), [xFace - dish + 0.02, Math.cos(a) * hubR * 0.68, Math.sin(a) * hubR * 0.68], lin([0.8, 0.8, 0.82]), 0.2, 1, toX));
    }
  }
  // ---- the brake disc(s) (they turn with the wheel), with drilled holes ----
  const hole = new THREE.CircleGeometry(0.0055, 6);
  const steel = lin([0.44, 0.44, 0.45]), black = lin([0.03, 0.03, 0.03]);
  let rd, discX;
  if (S.rotor === 'ring') {
    // a bike disc: a steel ring held by a gold carrier with little round buttons (you can see through it)
    rd = r * S.rd; discX = S.discs.map((f) => f * hw);
    const rin = rd * 0.7, t = 0.005, carrier = lin([0.6, 0.42, 0.12]);
    for (const dx of discX) {
      const out = dx >= 0 ? 1 : -1;
      parts.push(part(new THREE.LatheGeometry([new THREE.Vector2(rin, -t), new THREE.Vector2(rd, -t), new THREE.Vector2(rd, t), new THREE.Vector2(rin, t), new THREE.Vector2(rin, -t)], 40), [dx, 0, 0], steel, 0.38, 0.95, toX));
      for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + ring * 0.26, rr = rd * (0.79 + ring * 0.12);
        parts.push(part(hole, [dx + out * (t + 0.0006), Math.cos(a) * rr, Math.sin(a) * rr], black, 1, 0, [0, out * HALF_PI, 0]));
      }
      // the carrier: six arms from the hub to the ring, a button where each arm meets it
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.25, len = rin - hubR + 0.01, mid = hubR + len / 2;
        parts.push(part(new THREE.BoxGeometry(0.008, len, 0.016), [dx - out * 0.004, Math.cos(a) * mid, Math.sin(a) * mid], carrier, 0.35, 0.8, [a, 0, 0]));
        parts.push(part(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 8), [dx, Math.cos(a) * rin * 1.02, Math.sin(a) * rin * 1.02], carrier, 0.3, 0.9, toX));
      }
    }
    if (S.sprocket) {
      // the chain sprocket (the chain pulls the back wheel round), with five round holes
      const sx = S.sprocket * hw, out = sx >= 0 ? 1 : -1;
      parts.push(part(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 36), [sx, 0, 0], lin([0.55, 0.55, 0.57]), 0.3, 1, toX));
      parts.push(part(new THREE.TorusGeometry(0.1, 0.006, 3, 40), [sx, 0, 0], lin([0.2, 0.2, 0.21]), 0.5, 0.9, [0, HALF_PI, 0]));
      const big = new THREE.CircleGeometry(0.02, 10);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; parts.push(part(big, [sx + out * 0.0046, Math.cos(a) * 0.062, Math.sin(a) * 0.062], black, 1, 0, [0, out * HALF_PI, 0])); }
    }
  } else {
    // a car disc: a solid steel disc with a darker hat in the middle
    rd = ri * 0.86; discX = (S.discs || [-0.12]).map((f) => f * hw);
    const dx = discX[0];
    parts.push(part(new THREE.CylinderGeometry(rd, rd, 0.026, 44), [dx, 0, 0], steel, 0.42, 0.95, toX));
    parts.push(part(new THREE.CylinderGeometry(rd * 0.46, rd * 0.5, 0.06, 26), [dx + 0.02, 0, 0], lin([0.2, 0.2, 0.21]), 0.5, 0.7, toX));
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + ring * 0.21, rr = rd * (0.62 + ring * 0.11);
      parts.push(part(hole, [dx + 0.0135, Math.cos(a) * rr, Math.sin(a) * rr], black, 1, 0, [0, HALF_PI, 0]));
    }
  }
  const spin = mergeParts(parts);
  for (const g of new Set(parts.map((p) => p.geom))) g.dispose();
  // ---- the caliper: it holds the disc at the back, above the axle (it does not turn) ----
  // side: +1 for a wheel whose outside looks to +x, -1 for the other side (then it is mirrored)
  const caliper = (side) => {
    const cp = [];
    const col = lin(S.caliper), a = 0.65;                     // (angle up from the back: behind and a little above the axle)
    const ring = S.rotor === 'ring';
    const y = Math.sin(a) * rd * (ring ? 0.86 : 0.9), z = -Math.cos(a) * rd * (ring ? 0.86 : 0.9);
    for (const dx of discX) {
      // (two halves, one each side of the disc, lying along its edge, and a bridge over the edge)
      const o = ring ? (dx >= 0 ? 1 : -1) : 1;              // (which half is on the outside)
      const big = ring ? [0.032, rd * 0.42, 0.05] : [0.055, rd * 0.5, 0.07], small = ring ? [0.022, rd * 0.36, 0.04] : [0.03, rd * 0.38, 0.05];
      cp.push(part(new THREE.BoxGeometry(big[0], big[1], big[2]), [side * (dx + o * (big[0] / 2 + 0.004)), y, z], col, 0.35, 0.25, [a, 0, 0]));
      cp.push(part(new THREE.BoxGeometry(small[0], small[1], small[2]), [side * (dx - o * (small[0] / 2 + 0.004)), y, z], col, 0.35, 0.25, [a, 0, 0]));
      cp.push(part(new THREE.BoxGeometry(ring ? 0.05 : 0.075, 0.02, 0.03), [side * dx, y + Math.sin(a) * rd * 0.23, z - Math.cos(a) * rd * 0.23], col, 0.35, 0.25));
    }
    const g = mergeParts(cp);
    for (const p of cp) p.geom.dispose();
    return g;
  };
  const out = { spin, caliper: { 1: caliper(1), '-1': caliper(-1) } };
  cache.set(key, out);
  return out;
}

// A LIGHT wheel for parked cars, traffic and far cars (about 200 triangles; it does not turn and it is
// merged into the car's own model): a round tyre with soft shoulders, a dark rim
// well, a bright rim edge, flat spokes in the style's pattern and a hub cap.
// Same space as the detailed wheel: the axle is x, the outside looks to +x, the middle is (0, 0, 0).
export function makeLightWheel(r, w, style = 'twin5', rimK = 0.68) {
  const key = `L|${r.toFixed(3)}|${w.toFixed(3)}|${style}|${rimK}`;
  if (cache.has(key)) return cache.get(key);
  const S = RIM_STYLES[style] || RIM_STYLES.twin5, hw = w / 2, ri = r * rimK, seg = 14;
  const parts = [];
  // the tyre: inner wall, shoulder, tread, shoulder, outer wall
  const prof = [[ri, -hw * 0.9], [r * 0.95, -hw], [r, -hw * 0.55], [r, hw * 0.55], [r * 0.95, hw], [ri, hw * 0.9]].map(([a, b]) => new THREE.Vector2(a, b));
  parts.push(part(new THREE.LatheGeometry(prof, seg), [0, 0, 0], RUBBER, 0.9, 0, toX));
  // the rim: a dark well, a bright edge (or a coloured stripe), the spokes, the hub cap
  const rim = lin(S.rim), well = lin([0.045, 0.045, 0.05]);
  parts.push(part(new THREE.CircleGeometry(ri, seg), [hw * 0.5, 0, 0], well, 0.5, 0.6, [0, HALF_PI, 0]));
  parts.push(part(new THREE.RingGeometry(ri * 0.9, ri * 1.01, seg), [hw * 0.86, 0, 0], S.lip ? lin(S.lip) : rim, 0.25, 0.9, [0, HALF_PI, 0]));
  const width = S.blade ? 0.2 : S.twin ? 0.07 : 0.06, len = ri * 0.84, mid = ri * 0.5;
  for (let k = 0; k < S.spokes; k++) {
    const a = (k / S.spokes) * Math.PI * 2;
    for (const da of S.twin ? [-0.1, 0.1] : [0]) {
      const g = new THREE.PlaneGeometry(r * width, len);
      g.rotateY(HALF_PI);                                       // (it faces out; then it is turned round the axle)
      parts.push(part(g, [hw * 0.7, Math.cos(a + da) * mid, Math.sin(a + da) * mid], rim, 0.25, 0.95, [a + da, 0, 0]));
    }
  }
  parts.push(part(new THREE.CircleGeometry(r * 0.15, 10), [hw * 0.76, 0, 0], rim, 0.2, 1, [0, HALF_PI, 0]));
  const g = mergeParts(parts);
  for (const q of new Set(parts.map((p) => p.geom))) q.dispose();
  cache.set(key, g);
  return g;
}

// Put a detailed wheel on a car: a node that steers, the turning wheel in it, the caliper beside it.
//   sx: +1 = the car's left side (its outside looks to +x), -1 = the right side
export function mountDetailedWheel(steerNode, r, w, style, sx, material, rimK) {
  const g = makeDetailedWheel(r, w, style, rimK);
  const mesh = new THREE.Mesh(g.spin, material);
  mesh.castShadow = true;
  if (sx < 0) mesh.rotation.y = Math.PI;
  steerNode.add(mesh);
  const cal = new THREE.Mesh(g.caliper[sx < 0 ? '-1' : 1], material);
  steerNode.add(cal);
  return mesh;
}
// Only a brake disc and a caliper, for a wheel that comes from a model file (its rim is open between the spokes)
export function addBrake(spinMesh, steerNode, r, w, sx, material) {
  const g = makeDetailedWheel(r, w, 'twin5', 0.72);
  // (the disc of the detailed wheel is inside "spin"; here a separate disc is made once and kept)
  const key = `disc|${r.toFixed(3)}`;
  if (!cache.has(key)) {
    const rd = r * 0.72 * 0.86, parts = [];
    parts.push(part(new THREE.CylinderGeometry(rd, rd, 0.026, 40), [0, 0, 0], lin([0.44, 0.44, 0.45]), 0.42, 0.95, toX));
    parts.push(part(new THREE.CylinderGeometry(rd * 0.46, rd * 0.5, 0.05, 24), [0.018, 0, 0], lin([0.2, 0.2, 0.21]), 0.5, 0.7, toX));
    const hole = new THREE.CircleGeometry(0.0055, 6);
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + ring * 0.21, rr = rd * (0.62 + ring * 0.11);
      parts.push(part(hole, [0.0135, Math.cos(a) * rr, Math.sin(a) * rr], lin([0.03, 0.03, 0.03]), 1, 0, [0, HALF_PI, 0]));
    }
    cache.set(key, mergeParts(parts));
    for (const p of parts) if (p.geom !== hole) p.geom.dispose();
    hole.dispose();
  }
  const disc = new THREE.Mesh(cache.get(key), material);
  // the disc sits inside the rim, toward the car (it turns with the wheel)
  disc.position.x = -sx * w * 0.06;
  if (sx < 0) disc.rotation.y = Math.PI;
  spinMesh.add(disc);
  // (the caliper was made around the same disc position)
  steerNode.add(new THREE.Mesh(g.caliper[sx < 0 ? '-1' : 1], material));
}
