// ---------------------------------------------------------------------------
// bicycle.js - A BICYCLE made in code (an original design, no real make).
//
// It is ridden like the street bike (the same seat on two wheels: it leans into corners, the rider's hands are on
// the bars and the feet on the pedals), but it is slow, light and silent - it has no motor.
//
//   frame      a diamond frame of round tubes in the bicycle's colour: top tube, down tube, seat tube, two chain
//              stays and two seat stays to the back wheel
//   front      (turns when you steer) the fork, the stem, a flat handlebar with dark grips and two brake levers,
//              a small bell, a white lamp
//   drive      the chain ring with two crank arms and pedals, the chain, the sprocket at the back wheel
//   the rest   a saddle on its post, a bottle in a cage, mudguards, a red reflector, a kickstand
//   wheels     thin wheels with a silver rim and sixteen spokes each
//
// Bicycle space: y up, the ground is y = 0, the nose points to +z, the left side is +x.
// Every part stores its colour, roughness and metal in the vertices (the car material draws it all).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mergeParts } from '../utils/geometry.js';
import { lin } from '../city/models.js';

export const CYCLE_R = 0.34;
const REAR_Z = -0.5, HEAD = [0, 0.95, 0.42], RAKE = 0.3;
// the fork runs from the head down to the front axle, leaning back by the rake
const FORK = (HEAD[1] - CYCLE_R) / Math.cos(RAKE), FRONT_Z = HEAD[2] + Math.sin(RAKE) * FORK;
export const CYCLE_INFO = {
  length: 1.8, halfWidth: 0.3, boxHalfWidth: 0.3, roof: 1.15, backZ: REAR_Z - CYCLE_R, frontZ: FRONT_Z + CYCLE_R,
  wheelR: CYCLE_R, wheelX: 0.22, wheelZ: [REAR_Z, FRONT_Z], door: { z0: -0.4, z1: 0.1, y0: 0.4, y1: 1.2 },
  seat: { x: 0, y: 0.99, z: -0.2 }, bike: true, cycle: true,
};
// (the numbers of the driving model are those of a rider on a bicycle: about 30 km/h with ease, 42 flat out)
export const CYCLE_SPEC = { label: 'BICYCLE', length: 1.8, mass: 95, drive: 'rwd', topSpeed: 42, accel: 3.4, grip: 1.0, roll: 0.2, armor: 0.3, tone: 'none', role: 'car' };
// where things are, for vehicle.js and the rider
export const CYCLE_KIT = {
  info: CYCLE_INFO, r: CYCLE_R, head: HEAD, rake: RAKE,
  bar: [0, 1.06, 0.5], grip: [0.27, 1.06, 0.5], peg: [0.12, 0.3, -0.04], eye: [0, 1.58, 0.0],
  parkLean: -0.16, wheelWidth: 0.045,
};

const DARK = [0.05, 0.05, 0.055], SILVER = [0.72, 0.74, 0.76], RUBBER = [0.03, 0.03, 0.035], SEAT = [0.06, 0.05, 0.05];
const P = (geom, pos, color, rough, metal, more = {}) => ({ geom, pos, color: lin(color), rough, metal, ...more });
const cyl = (r0, r1, h, seg = 10) => new THREE.CylinderGeometry(r1, r0, h, seg);
const ell = (sx, sy, sz, seg = 12) => { const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.6))); g.scale(sx, sy, sz); return g; };
// a round tube from a to b; paint: it takes the bicycle's own colour
function tube(a, b, r, color, rough = 0.35, metal = 0.6, paint = 0, seg = 8) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return paint ? { geom: g, pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color: [1, 1, 1], rough: 0.3, metal: 0.25, paint: 1 } : P(g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], color, rough, metal);
}
// a disc or a wheel part standing across the bicycle (its axis along x)
const acrossX = (g) => { g.rotateZ(Math.PI / 2); return g; };

export function makeBicycle() {
  const body = [], front = [], kick = [], wheel = [];
  const BB = [0, 0.3, -0.04], SEATC = [0, 0.8, -0.18], HEADT = [0, 0.92, 0.41], HEADB = [0, 0.8, 0.375], AXLE = [0, CYCLE_R, REAR_Z];
  const F = (a, b, r) => body.push(tube(a, b, r, null, 0.3, 0.25, 1));
  // ---- the frame ----
  F(SEATC, HEADT, 0.019);                                  // top tube
  F(HEADB, BB, 0.023);                                     // down tube
  F(BB, [0, 0.86, -0.195], 0.02);                          // seat tube
  F(HEADB, [0, 0.96, 0.422], 0.024);                       // head tube
  for (const s of [1, -1]) {
    F([s * 0.035, BB[1], BB[2]], [s * 0.065, AXLE[1], AXLE[2]], 0.012);     // chain stays
    F([s * 0.02, SEATC[1], SEATC[2]], [s * 0.065, AXLE[1], AXLE[2]], 0.011); // seat stays
  }
  body.push(P(acrossX(cyl(0.03, 0.03, 0.085, 12)), BB, SILVER, 0.3, 0.9));    // the bottom bracket
  // ---- the saddle on its post ----
  body.push(tube([0, 0.84, -0.19], [0, 0.985, -0.225], 0.013, SILVER, 0.25, 0.95));
  body.push(P(ell(0.07, 0.028, 0.135), [0, 1.0, -0.215], SEAT, 0.75, 0));
  body.push(P(ell(0.045, 0.024, 0.07), [0, 1.0, -0.11], SEAT, 0.75, 0));
  // ---- the drive: chain ring, cranks, pedals, chain, sprocket ----
  body.push(P(new THREE.TorusGeometry(0.088, 0.008, 5, 22).rotateY(Math.PI / 2), [-0.05, BB[1], BB[2]], SILVER, 0.3, 0.95));
  body.push(P(acrossX(cyl(0.085, 0.085, 0.004, 18)), [-0.05, BB[1], BB[2]], [0.2, 0.2, 0.21], 0.4, 0.9));
  // (the cranks stand level: one foot forward, one back - as when coasting)
  for (const s of [1, -1]) {
    const cx = s * 0.075, tip = [cx, BB[1], BB[2] + s * 0.165];
    body.push(tube([cx, BB[1], BB[2]], tip, 0.011, SILVER, 0.3, 0.9));
    body.push(P(new THREE.BoxGeometry(0.09, 0.018, 0.065), [cx + s * 0.05, tip[1], tip[2]], DARK, 0.7, 0.2));
  }
  body.push(P(acrossX(cyl(0.036, 0.036, 0.012, 12)), [-0.05, AXLE[1], AXLE[2]], [0.2, 0.2, 0.21], 0.4, 0.9));
  body.push(tube([-0.05, BB[1] + 0.082, BB[2]], [-0.05, AXLE[1] + 0.034, AXLE[2]], 0.005, DARK, 0.6, 0.6, 0, 5));
  body.push(tube([-0.05, BB[1] - 0.082, BB[2]], [-0.05, AXLE[1] - 0.034, AXLE[2]], 0.005, DARK, 0.6, 0.6, 0, 5));
  // ---- a bottle in its cage on the down tube, a red reflector under the saddle, the back mudguard ----
  body.push(P(cyl(0.032, 0.032, 0.17, 10).rotateX(-0.82), [0, 0.6, 0.2], [0.85, 0.87, 0.9], 0.4, 0.1));
  body.push(P(cyl(0.02, 0.014, 0.04, 8).rotateX(-0.82), [0, 0.675, 0.28], DARK, 0.5, 0));
  body.push(P(new THREE.BoxGeometry(0.05, 0.035, 0.015), [0, 0.9, -0.34], [1, 0.06, 0.04], 0.3, 0, { glow: 0.6 }));
  body.push(tube([0, 0.87, -0.2], [0, 0.9, -0.33], 0.006, DARK, 0.5, 0.5, 0, 5));
  {
    // (an arc over the top and the back of the wheel: turned so that it starts a little under the axle's height)
    const guard = new THREE.TorusGeometry(CYCLE_R + 0.03, 0.022, 4, 12, Math.PI * 0.62);
    guard.rotateY(Math.PI / 2); guard.rotateX(-0.17);
    body.push(P(guard, AXLE, DARK, 0.5, 0.2));
  }
  // ---- the front (its own frame: the middle of the head tube's top is (0, 0, 0), the fork runs down -y) ----
  for (const s of [1, -1]) front.push({ ...tube([s * 0.012, -0.12, 0], [s * 0.055, -FORK, 0], 0.012, null, 0.3, 0.25, 1) });
  front.push({ ...tube([-0.055, -0.14, 0], [0.055, -0.14, 0], 0.014, null, 0.3, 0.25, 1) });
  front.push(tube([0, -0.13, 0], [0, 0.07, 0], 0.014, SILVER, 0.25, 0.95));          // the steerer
  front.push(tube([0, 0.06, 0], [0, 0.085, 0.085], 0.015, DARK, 0.4, 0.7));         // the stem
  front.push(tube([-0.3, 0.09, 0.085], [0.3, 0.09, 0.085], 0.012, SILVER, 0.25, 0.95)); // the handlebar
  for (const s of [1, -1]) {
    front.push(tube([s * 0.2, 0.09, 0.085], [s * 0.31, 0.09, 0.085], 0.017, RUBBER, 0.9, 0));   // grips
    front.push(tube([s * 0.19, 0.085, 0.1], [s * 0.27, 0.07, 0.15], 0.006, SILVER, 0.3, 0.9, 0, 5)); // brake levers
  }
  front.push(P(ell(0.024, 0.018, 0.024, 10), [0.13, 0.115, 0.085], SILVER, 0.2, 0.95));  // the bell
  front.push(P(cyl(0.022, 0.03, 0.05, 10).rotateX(Math.PI / 2), [0, 0.04, 0.07], DARK, 0.4, 0.3));  // the lamp
  front.push(P(cyl(0.027, 0.027, 0.006, 10).rotateX(Math.PI / 2), [0, 0.04, 0.098], [1, 1, 0.95], 0.2, 0, { glow: 1 }));
  {
    const guard = new THREE.TorusGeometry(CYCLE_R + 0.03, 0.02, 4, 10, Math.PI * 0.42);
    guard.rotateY(Math.PI / 2); guard.rotateX(1.13 + RAKE);
    front.push(P(guard, [0, -FORK, 0], DARK, 0.5, 0.2));
  }
  // ---- the kickstand (shown while nobody rides) ----
  kick.push(tube([0.05, 0.3, -0.12], [0.2, 0.01, -0.2], 0.008, SILVER, 0.3, 0.9, 0, 6));
  // ---- one wheel (round the x axis): tyre, rim, hub, sixteen spokes ----
  const ring = (R, r, seg) => { const g = new THREE.TorusGeometry(R, r, 6, seg); g.rotateY(Math.PI / 2); return g; };
  wheel.push(P(ring(CYCLE_R - 0.017, 0.017, 28), [0, 0, 0], RUBBER, 0.9, 0));
  wheel.push(P(ring(CYCLE_R - 0.04, 0.011, 28), [0, 0, 0], SILVER, 0.25, 0.95));
  wheel.push(P(acrossX(cyl(0.02, 0.02, 0.1, 10)), [0, 0, 0], SILVER, 0.3, 0.9));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, side = i % 2 ? 0.035 : -0.035;
    wheel.push(tube([side, Math.cos(a) * 0.02, Math.sin(a) * 0.02], [0, Math.cos(a + 0.25) * (CYCLE_R - 0.045), Math.sin(a + 0.25) * (CYCLE_R - 0.045)], 0.0025, SILVER, 0.3, 0.9, 0, 4));
  }
  return { body: mergeParts(body), front: mergeParts(front), kick: mergeParts(kick), wheel: mergeParts(wheel), forkLen: FORK };
}

// The same bicycle in one colour: the painted parts take it (one copy per colour)
const byColor = new Map();
let base = null;
export function cycleBodyIn(color) {
  const key = color.map((c) => c.toFixed(3)).join(',');
  if (byColor.has(key)) return byColor.get(key);
  if (!base) base = makeBicycle();
  const paint = (g) => {
    const out = g.clone();
    const col = out.attributes.color, dat = out.attributes.aData;
    for (let i = 0; i < col.count; i++) if (dat.getZ(i) > 0.5) col.setXYZ(i, color[0], color[1], color[2]);
    return out;
  };
  const r = { body: paint(base.body), front: paint(base.front), kick: base.kick, wheel: base.wheel, forkLen: base.forkLen };
  byColor.set(key, r);
  return r;
}
