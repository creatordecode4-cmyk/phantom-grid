// ---------------------------------------------------------------------------
// dockModels.js - machines and stalls of the docks, built from rounded shapes instead of boxes:
//
//   forklift()        a counterbalance forklift: a rounded body with a curved counterweight, big front
//                     wheels with rims, the overhead guard on four slanted posts, a seat and a steering
//                     wheel, the mast with its chains, the carriage and two forks, an amber beacon
//   straddleCarrier() an autonomous straddle carrier: four tall tapered legs on rubber wheels, a rounded
//                     top frame with sensors, a container between its legs
//   droneLoader()     a heavy-lift drone: a rounded body, four arms with ducted rotors, a crate on straps
//   rbox / rod / disc helpers (used by docks.js too): a block with round edges, a round bar between two
//                     points, a wheel
//
// Every model is ONE geometry with per-vertex colors and aData (roughness, metal, paint, glow) for the
// shared prop material. Sizes are real (meters); y up, the front is +z.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MeshBuilder } from '../utils/geometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _c = new THREE.Color();
export const lin = (c) => { _c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [_c.r, _c.g, _c.b]; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const unitRod = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

// a round bar from a to b (radius r) into a MeshBuilder
export function rod(mb, a, b, r) {
  _d.subVectors(b, a); const l = _d.length(); if (l < 1e-4) return;
  _q.setFromUnitVectors(UP, _d.divideScalar(l));
  _m.compose(V((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), _q, _s.set(r, l, r));
  mb.addGeometry(unitRod, _m);
}
// a block with rounded edges and corners: x0..x1, y0..y1, z0..z1, r = how round (meters)
export function rbox(mb, x0, y0, z0, x1, y1, z1, r = 0.05, seg = 1) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mb.addGeometry(g, null);
}
// a wheel standing on its edge, its axle along x: a tire with a rim and a hub
export function wheel(mb, set, x, y, z, r, w, rim = [0.62, 0.63, 0.64]) {
  set([0.05, 0.05, 0.055], 0.92, 0);
  mb.addGeometry(new THREE.TorusGeometry(r - w * 0.5, w * 0.5, 6, 14).rotateY(Math.PI / 2).translate(x, y, z), null);
  mb.addGeometry(new THREE.CylinderGeometry(r * 0.78, r * 0.78, w * 0.9, 14).rotateZ(Math.PI / 2).translate(x, y, z), null);
  set(rim, 0.35, 0.75);
  mb.addGeometry(new THREE.CylinderGeometry(r * 0.5, r * 0.55, w * 0.96, 14).rotateZ(Math.PI / 2).translate(x, y, z), null);
  set([0.15, 0.15, 0.16], 0.5, 0.6);
  mb.addGeometry(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.02, 10).rotateZ(Math.PI / 2).translate(x, y, z), null);
}
function builder() {
  const mb = new MeshBuilder();
  const set = (c, rough = 0.6, metal = 0, glow = 0, paint = 0) => { const l = lin(c); mb.color(l[0], l[1], l[2], 1).data(rough, metal, paint, glow); };
  return { mb, set };
}

// ---------------------------------------------------------------- a counterbalance forklift (front = +z)
export function forklift() {
  const { mb, set } = builder();
  const YEL = [0.86, 0.56, 0.06], DARK = [0.08, 0.085, 0.09], STEEL = [0.55, 0.56, 0.57];
  // the body: a rounded lower body, the curved counterweight at the back, the engine hood
  set(YEL, 0.45, 0.3);
  rbox(mb, -0.56, 0.22, -0.95, 0.56, 0.98, 0.95, 0.09);
  set(DARK, 0.7, 0.3);
  const cw = new THREE.CylinderGeometry(0.62, 0.62, 1.12, 20, 1, false, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.86, 0.55);
  mb.addGeometry(cw.translate(0, 0.66, -0.95), null);
  set(YEL, 0.45, 0.3);
  rbox(mb, -0.5, 0.98, -1.0, 0.5, 1.18, -0.25, 0.08);                     // the hood over the engine (the seat stands on it)
  // the seat and the steering wheel
  set([0.06, 0.06, 0.065], 0.8, 0);
  rbox(mb, -0.25, 1.18, -0.62, 0.25, 1.28, -0.2, 0.05);
  rbox(mb, -0.24, 1.26, -0.7, 0.24, 1.72, -0.58, 0.05);
  set(DARK, 0.6, 0.3);
  rod(mb, V(0, 1.0, 0.45), V(0, 1.45, 0.25), 0.03);
  mb.addGeometry(new THREE.TorusGeometry(0.16, 0.018, 6, 16).rotateX(-1.05).translate(0, 1.47, 0.22), null);
  // wheels: big ones at the front, small ones under the counterweight
  for (const sx of [-1, 1]) {
    wheel(mb, set, sx * 0.52, 0.33, 0.6, 0.33, 0.24);
    wheel(mb, set, sx * 0.5, 0.25, -0.72, 0.25, 0.2);
  }
  // the overhead guard: four slanted posts, a frame and slats
  set(DARK, 0.55, 0.4);
  const top = 2.15;
  for (const sx of [-1, 1]) {
    rod(mb, V(sx * 0.5, 1.0, 0.55), V(sx * 0.46, top, 0.32), 0.035);
    rod(mb, V(sx * 0.5, 1.15, -0.95), V(sx * 0.46, top, -0.72), 0.035);
    rod(mb, V(sx * 0.46, top, 0.34), V(sx * 0.46, top, -0.74), 0.03);
  }
  for (let z = -0.66; z <= 0.33; z += 0.165) rod(mb, V(-0.46, top + 0.01, z), V(0.46, top + 0.01, z), 0.016);
  set([1, 0.55, 0.05], 0.4, 0, 1.4);
  mb.addGeometry(new THREE.SphereGeometry(0.07, 10, 6).translate(0, top + 0.08, -0.6), null);
  // the mast at the front: two uprights, cross bars, the chains, the lift cylinder
  set(DARK, 0.5, 0.5);
  for (const sx of [-1, 1]) { rbox(mb, sx * 0.36 - 0.05, 0.2, 0.98, sx * 0.36 + 0.05, 2.45, 1.08, 0.015); }
  for (const y of [0.45, 1.4, 2.35]) rbox(mb, -0.36, y, 1.0, 0.36, y + 0.08, 1.06, 0.015);
  set([0.15, 0.15, 0.16], 0.6, 0.7);
  for (const sx of [-1, 1]) rod(mb, V(sx * 0.18, 0.5, 1.1), V(sx * 0.18, 2.4, 1.1), 0.012);
  set(STEEL, 0.3, 0.85);
  rod(mb, V(0, 0.3, 1.02), V(0, 2.0, 1.02), 0.045);
  // the carriage and the two forks (an L each: the shank up the carriage, the tine on the ground)
  set(DARK, 0.55, 0.5);
  rbox(mb, -0.45, 0.12, 1.1, 0.45, 0.72, 1.17, 0.02);
  set(STEEL, 0.35, 0.8);
  for (const sx of [-1, 1]) {
    rbox(mb, sx * 0.28 - 0.05, 0.08, 1.17, sx * 0.28 + 0.05, 0.62, 1.22, 0.012);
    rbox(mb, sx * 0.28 - 0.05, 0.08, 1.17, sx * 0.28 + 0.05, 0.13, 2.25, 0.012);
  }
  // lights at the front of the guard, a mirror
  set([1, 0.95, 0.85], 0.3, 0, 1.2);
  for (const sx of [-1, 1]) mb.addGeometry(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateX(Math.PI / 2).translate(sx * 0.42, 2.05, 0.36), null);
  return mb.build(true);
}

// ---------------------------------------------------------------- an autonomous straddle carrier (long side = x)
export function straddleCarrier(containerColor, L20, CH, CW) {
  const { mb, set } = builder();
  const WHITE = [0.82, 0.83, 0.8], DARK = [0.1, 0.1, 0.11];
  const legH = 6.0;
  for (const [x, z] of [[-2.4, -1.45], [2.4, -1.45], [-2.4, 1.45], [2.4, 1.45]]) {
    // a tapered leg (wider at the top), a wheel at its foot
    set(WHITE, 0.5, 0.35);
    const leg = new THREE.CylinderGeometry(0.3, 0.22, legH, 10).scale(1, 1, 1.5).translate(x, 0.9 + legH / 2, z);
    mb.addGeometry(leg, null);
    set(DARK, 0.6, 0.4);
    rbox(mb, x - 0.7, 0.55, z - 0.32, x + 0.7, 1.05, z + 0.32, 0.12);
    wheel(mb, set, x - 0.45, 0.5, z, 0.48, 0.38);
    wheel(mb, set, x + 0.45, 0.5, z, 0.48, 0.38);
  }
  // the top frame: two long rounded beams, two cross beams, the machine house with sensors
  set(WHITE, 0.5, 0.35);
  for (const z of [-1.45, 1.45]) rbox(mb, -2.9, 6.6, z - 0.32, 2.9, 7.3, z + 0.32, 0.14);
  for (const x of [-2.4, 2.4]) rbox(mb, x - 0.3, 6.65, -1.75, x + 0.3, 7.25, 1.75, 0.14);
  rbox(mb, -1.2, 7.3, -1.0, 1.2, 8.1, 1.0, 0.25);
  set([0.06, 0.08, 0.1], 0.1, 0.5);
  for (const sx of [-1, 1]) mb.addGeometry(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12).translate(sx * 2.7, 7.45, 0), null);   // lidar domes
  set([0.2, 1, 0.5], 0.4, 0, 1.5);
  mb.addGeometry(new THREE.SphereGeometry(0.12, 8, 6).translate(2.75, 7.4, 1.5), null);
  set([1, 0.55, 0.05], 0.4, 0, 1.5);
  mb.addGeometry(new THREE.SphereGeometry(0.12, 8, 6).translate(-2.75, 7.4, -1.5), null);
  // the spreader and its container between the legs
  set([0.85, 0.65, 0.08], 0.5, 0.3);
  rbox(mb, -L20 / 2 - 0.15, 3.1 + CH, -CW / 2 - 0.1, L20 / 2 + 0.15, 3.1 + CH + 0.3, CW / 2 + 0.1, 0.06);
  set([0.1, 0.1, 0.11], 0.5, 0.7);
  for (const x of [-1.8, 1.8]) for (const z of [-0.7, 0.7]) rod(mb, V(x, 3.4 + CH, z), V(x * 1.2, 6.6, z * 1.6), 0.03);
  // (the container colors of the docks are already linear)
  mb.color(containerColor[0], containerColor[1], containerColor[2], 1).data(0.7, 0.4, 0, 0);
  rbox(mb, -L20 / 2, 3.1, -CW / 2, L20 / 2, 3.1 + CH, CW / 2, 0.04);
  return mb.build(true);
}

// ---------------------------------------------------------------- a heavy-lift drone with a crate
export function droneLoader() {
  const { mb, set } = builder();
  set([0.18, 0.19, 0.2], 0.45, 0.5);
  mb.addGeometry(new THREE.SphereGeometry(1, 18, 10).scale(0.85, 0.28, 0.85), null);                     // the body
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    set([0.18, 0.19, 0.2], 0.45, 0.5);
    rod(mb, V(x * 0.5, 0.02, z * 0.5), V(x * 1.05, 0.12, z * 1.05), 0.06);
    // a ducted rotor: a ring and the blur of the blades
    mb.addGeometry(new THREE.TorusGeometry(0.58, 0.05, 6, 22).rotateX(Math.PI / 2).translate(x * 1.05, 0.14, z * 1.05), null);
    set([0.06, 0.06, 0.06], 0.6, 0.1);
    mb.addGeometry(new THREE.CylinderGeometry(0.54, 0.54, 0.015, 18).translate(x * 1.05, 0.15, z * 1.05), null);
  }
  set([0.2, 1, 0.5], 0.4, 0, 1.6);
  mb.addGeometry(new THREE.SphereGeometry(0.07, 8, 6).translate(0, -0.1, 0.8), null);
  // the crate on four straps
  set([0.12, 0.12, 0.12], 0.7, 0.1);
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) rod(mb, V(x * 0.4, -0.2, z * 0.4), V(x, -0.75, z), 0.012);
  set([0.45, 0.32, 0.19], 0.9, 0);
  rbox(mb, -0.45, -1.6, -0.45, 0.45, -0.75, 0.45, 0.04);
  set([0.3, 0.2, 0.12], 0.9, 0);
  for (const y of [-1.5, -0.85]) rbox(mb, -0.47, y, -0.47, 0.47, y + 0.07, 0.47, 0.02);
  return mb.build(true);
}
