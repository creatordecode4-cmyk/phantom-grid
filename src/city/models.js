// ---------------------------------------------------------------------------
// models.js - small 3D models built in code (no model files needed):
// street lights, traffic lights, cars, trees, palms, hydrants, benches ...
//
// Every model is ONE geometry. Each vertex stores its own color and how
// shiny / metallic it is, so one shared material can draw all of them.
//
// Sizes are real: a street light is 8.5 m tall, a car is 4.6 m long, etc.
// Model space: y is up, the ground is y = 0, "front" is +z.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MeshBuilder, mergeParts } from '../utils/geometry.js';
import { RNG } from '../utils/math.js';

// Colors below are written as normal screen colors (sRGB 0..1).
// The renderer works in "linear" color, so we convert them here.
const _c = new THREE.Color();
export function lin(c) {
  _c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  return [_c.r, _c.g, _c.b];
}

// One part of a model.
//   geom: a three.js geometry,  pos: [x, y, z],  color: [r, g, b]
//   rough: 0 mirror .. 1 matte,  metal: 0 or 1 (or between)
//   more: { rot: [rx, ry, rz], scale, paint: 1 = takes the per-copy color, glow }
function P(geom, pos, color, rough, metal, more = {}) {
  return { geom, pos, color: lin(color), rough, metal, ...more };
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rTop, rBot, h, seg = 8) => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
const sph = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);
const HALF_PI = Math.PI / 2;

// Materials (as colors + shininess) used again and again.
const GALV = [0.52, 0.54, 0.55];       // galvanized steel
const DARK_METAL = [0.09, 0.1, 0.1];   // dark painted metal
const RUBBER = [0.035, 0.035, 0.04];
const SODIUM = [1.0, 0.56, 0.2];       // orange lamp
const LED = [1.0, 0.88, 0.72];         // warm white lamp

// ---------------------------------------------------------------------------
// STREET LIGHTS
// ---------------------------------------------------------------------------
// Old "cobra head" street light of The Grid. The arm points to +z (the street).
// lampPos = where the bulb is (used for glow and light).
export function makeStreetLight() {
  const geometry = mergeParts([
    P(cyl(0.2, 0.22, 0.08, 10), [0, 0.04, 0], GALV, 0.55, 0.85),
    P(cyl(0.065, 0.11, 8.2, 8), [0, 4.1, 0], GALV, 0.5, 0.85),
    // arm: rises a little toward the street
    P(cyl(0.04, 0.05, 2.5, 6), [0, 8.42, 1.2], GALV, 0.5, 0.85, { rot: [HALF_PI - 0.2, 0, 0] }),
    // lamp head
    P(sph(0.5, 8, 5), [0, 8.62, 2.5], [0.4, 0.41, 0.42], 0.45, 0.8, { scale: [0.3, 0.14, 0.76] }),
    // glowing glass under the head
    P(box(0.2, 0.03, 0.44), [0, 8.535, 2.56], SODIUM, 0.3, 0, { glow: 1 }),
  ]);
  return { geometry, lampPos: [0, 8.5, 2.56] };
}

// Modern LED light for Neon Mile. arms = 1 or 2 (two arms for the median).
export function makeLedLight(arms) {
  const col = [0.14, 0.15, 0.16];
  const parts = [
    P(cyl(0.16, 0.19, 0.5, 10), [0, 0.25, 0], col, 0.4, 0.7),
    P(cyl(0.07, 0.1, 9.0, 8), [0, 4.5, 0], col, 0.4, 0.7),
  ];
  const lamps = [];
  for (let i = 0; i < arms; i++) {
    const s = i === 0 ? 1 : -1;
    parts.push(P(box(0.07, 0.07, 2.0), [0, 8.95, s * 1.0], col, 0.4, 0.7));
    parts.push(P(box(0.34, 0.06, 0.95), [0, 8.93, s * 2.3], col, 0.35, 0.7));
    parts.push(P(box(0.26, 0.02, 0.8), [0, 8.895, s * 2.3], LED, 0.3, 0, { glow: 1 }));
    lamps.push([0, 8.86, s * 2.3]);
  }
  return { geometry: mergeParts(parts), lamps };
}

// ---------------------------------------------------------------------------
// TRAFFIC LIGHT: pole + long arm over the road (+x) with two signal heads.
// The lamps face -z. Lamp positions are returned so we can add the lights.
// ---------------------------------------------------------------------------
export function makeTrafficLight() {
  const col = [0.07, 0.09, 0.08];
  const parts = [
    P(cyl(0.2, 0.24, 0.3, 10), [0, 0.15, 0], col, 0.5, 0.6),
    P(cyl(0.085, 0.11, 6.1, 8), [0, 3.05, 0], col, 0.5, 0.6),
    P(cyl(0.05, 0.075, 6.8, 6), [3.3, 5.9, 0], col, 0.5, 0.6, { rot: [0, 0, HALF_PI] }),
    // small box with the walk signal on the pole
    P(box(0.3, 0.34, 0.2), [0.2, 2.7, -0.16], [0.03, 0.03, 0.03], 0.6, 0.2),
  ];
  const heads = [];
  for (const x of [3.6, 6.2]) {
    parts.push(P(box(0.52, 1.24, 0.04), [x, 5.42, 0.06], [0.03, 0.03, 0.03], 0.7, 0.1));  // back plate
    parts.push(P(box(0.3, 1.0, 0.24), [x, 5.42, -0.06], [0.04, 0.04, 0.04], 0.55, 0.3));  // housing
    for (let k = 0; k < 3; k++) {
      // little sun shades above each lamp
      parts.push(P(box(0.26, 0.03, 0.16), [x, 5.42 + (1 - k) * 0.32 + 0.12, -0.24], [0.03, 0.03, 0.03], 0.6, 0.3));
    }
    heads.push(x);
  }
  // lamps: [x, y, z] for red, yellow, green of each head
  const lamps = [];
  for (const x of heads) {
    lamps.push({ pos: [x, 5.74, -0.19], kind: 'red' }, { pos: [x, 5.42, -0.19], kind: 'yellow' }, { pos: [x, 5.1, -0.19], kind: 'green' });
  }
  return { geometry: mergeParts(parts), lamps };
}

// ---------------------------------------------------------------------------
// SMALL STREET FURNITURE
// ---------------------------------------------------------------------------
export function makeHydrant() {
  const body = [1, 1, 1]; // painted: the real color comes from each copy
  const o = { paint: 1 };
  return mergeParts([
    P(cyl(0.15, 0.16, 0.05, 10), [0, 0.025, 0], body, 0.55, 0.2, o),
    P(cyl(0.105, 0.115, 0.48, 10), [0, 0.29, 0], body, 0.5, 0.2, o),
    P(cyl(0.135, 0.135, 0.035, 10), [0, 0.5, 0], body, 0.5, 0.2, o),
    P(sph(0.12, 10, 6), [0, 0.53, 0], body, 0.5, 0.2, { ...o, scale: [1, 0.85, 1] }),
    P(cyl(0.035, 0.035, 0.07, 6), [0, 0.66, 0], GALV, 0.4, 0.8),
    P(cyl(0.05, 0.05, 0.34, 8), [0, 0.38, 0], body, 0.5, 0.2, { ...o, rot: [0, 0, HALF_PI] }),
    P(cyl(0.065, 0.065, 0.13, 8), [0, 0.36, 0.13], body, 0.5, 0.2, { ...o, rot: [HALF_PI, 0, 0] }),
    P(cyl(0.035, 0.035, 0.03, 6), [0, 0.36, 0.205], GALV, 0.4, 0.8, { rot: [HALF_PI, 0, 0] }),
  ]);
}

export function makeTrashBin() {
  const green = [0.07, 0.13, 0.1];
  return mergeParts([
    P(cyl(0.27, 0.24, 0.84, 12), [0, 0.42, 0], green, 0.6, 0.35),
    P(cyl(0.295, 0.295, 0.06, 12), [0, 0.85, 0], [0.05, 0.08, 0.07], 0.55, 0.4),
    P(sph(0.28, 12, 6), [0, 0.87, 0], green, 0.6, 0.35, { scale: [1, 0.55, 1] }),
    P(box(0.3, 0.1, 0.58), [0, 0.93, 0], [0.01, 0.01, 0.01], 0.9, 0),  // dark opening
    P(cyl(0.22, 0.22, 0.03, 12), [0, 0.015, 0], [0.04, 0.04, 0.04], 0.7, 0.3),
  ]);
}

// Bench: the seat faces +z.
export function makeBench() {
  const wood = [0.34, 0.22, 0.13], iron = [0.06, 0.06, 0.065];
  const parts = [];
  for (const x of [-0.72, 0.72]) {
    parts.push(P(box(0.05, 0.44, 0.05), [x, 0.22, 0.2], iron, 0.55, 0.7));
    parts.push(P(box(0.05, 0.86, 0.05), [x, 0.43, -0.2], iron, 0.55, 0.7, { rot: [-0.12, 0, 0] }));
    parts.push(P(box(0.05, 0.05, 0.5), [x, 0.43, 0], iron, 0.55, 0.7));
    parts.push(P(box(0.05, 0.04, 0.36), [x, 0.63, 0.02], iron, 0.55, 0.7));  // arm rest
  }
  for (const z of [-0.12, 0.02, 0.16]) parts.push(P(box(1.62, 0.035, 0.11), [0, 0.47, z], wood, 0.75, 0));
  for (const y of [0.64, 0.8]) parts.push(P(box(1.62, 0.11, 0.035), [0, y, -0.25 - (y - 0.64) * 0.12], wood, 0.75, 0));
  return mergeParts(parts);
}

// Bus stop shelter: open toward +z. 3.6 m wide.
export function makeBusStop() {
  const frame = [0.13, 0.14, 0.15], glass = [0.07, 0.09, 0.1];
  const parts = [
    P(box(3.7, 0.07, 1.55), [0, 2.48, 0.05], frame, 0.4, 0.7),          // roof
    P(box(3.5, 0.03, 1.4), [0, 2.44, 0.05], [0.5, 0.5, 0.48], 0.6, 0),   // light ceiling
    P(box(3.4, 1.75, 0.02), [0, 1.32, -0.66], glass, 0.07, 0.9),         // back glass
    P(box(0.03, 1.75, 1.15), [-1.78, 1.32, -0.08], glass, 0.07, 0.9),    // side glass
    P(box(2.4, 0.05, 0.36), [-0.3, 0.48, -0.4], [0.3, 0.2, 0.12], 0.7, 0), // seat
    P(box(0.06, 0.48, 0.3), [-1.3, 0.24, -0.4], frame, 0.4, 0.7),
    P(box(0.06, 0.48, 0.3), [0.7, 0.24, -0.4], frame, 0.4, 0.7),
    // lit advert box at the right end
    P(box(0.14, 1.85, 1.2), [1.76, 1.25, -0.06], frame, 0.4, 0.7),
    P(box(0.02, 1.6, 1.0), [1.68, 1.28, -0.06], [0.55, 0.62, 0.66], 0.25, 0, { glow: 0.55 }),
    P(box(0.02, 1.6, 1.0), [1.84, 1.28, -0.06], [0.66, 0.58, 0.5], 0.25, 0, { glow: 0.55 }),
    // the stop sign on its own pole
    P(cyl(0.03, 0.03, 2.9, 6), [2.5, 1.45, 0.5], GALV, 0.5, 0.85),
    P(box(0.42, 0.42, 0.03), [2.5, 2.7, 0.5], [0.1, 0.24, 0.42], 0.5, 0.2),
  ];
  for (const x of [-1.78, 0, 1.7]) parts.push(P(box(0.07, 2.45, 0.07), [x, 1.225, -0.67], frame, 0.4, 0.7));
  return mergeParts(parts);
}

// Wooden power pole with two cross arms. wirePoints = where the wires hang.
export function makePowerPole() {
  const wood = [0.27, 0.21, 0.16];
  const parts = [
    P(cyl(0.1, 0.15, 9.6, 8), [0, 4.8, 0], wood, 0.95, 0),
    P(box(2.4, 0.1, 0.12), [0, 8.9, 0], wood, 0.95, 0),
    P(box(1.5, 0.09, 0.1), [0, 7.7, 0], wood, 0.95, 0),
    // grey transformer can
    P(cyl(0.27, 0.27, 0.85, 10), [0.42, 7.0, 0], [0.42, 0.44, 0.45], 0.5, 0.6),
    P(cyl(0.05, 0.05, 0.16, 6), [0.42, 7.5, 0], [0.75, 0.74, 0.7], 0.4, 0),
  ];
  const wirePoints = [];
  for (const x of [-1.1, -0.4, 0.4, 1.1]) {
    parts.push(P(cyl(0.035, 0.045, 0.14, 6), [x, 9.02, 0], [0.5, 0.52, 0.5], 0.35, 0));
    wirePoints.push([x, 9.09, 0]);
  }
  wirePoints.push([-0.65, 7.75, 0], [0.65, 7.75, 0], [0.16, 6.2, 0]);
  return { geometry: mergeParts(parts), wirePoints };
}

// EV charging post (near-future touch). The screen faces +z.
export function makeEvPost() {
  const shell = [0.13, 0.14, 0.15];
  return mergeParts([
    P(box(0.3, 0.06, 0.24), [0, 0.03, 0], [0.2, 0.2, 0.2], 0.7, 0.3),
    P(box(0.26, 1.34, 0.19), [0, 0.73, 0], shell, 0.35, 0.6),
    P(box(0.28, 0.05, 0.21), [0, 1.42, 0], [0.3, 0.31, 0.32], 0.3, 0.8),
    P(box(0.18, 0.13, 0.012), [0, 1.2, 0.097], [0.25, 0.75, 0.9], 0.15, 0, { glow: 1.25 }),   // screen (always on)
    P(box(0.2, 0.02, 0.012), [0, 1.05, 0.097], [0.2, 0.95, 0.65], 0.2, 0, { glow: 1.6 }),     // status strip
    P(cyl(0.035, 0.035, 0.14, 6), [0.16, 0.85, 0.02], [0.03, 0.03, 0.03], 0.6, 0.2, { rot: [0, 0, HALF_PI] }),
    P(cyl(0.02, 0.02, 0.5, 5), [0.2, 0.6, 0.02], [0.03, 0.03, 0.03], 0.7, 0),                 // cable
  ]);
}

// Concrete road barrier (3 m long, along x).
export function makeBarrier() {
  const con = [0.55, 0.54, 0.51];
  // cross-section narrows toward the top
  const shape = new THREE.Shape();
  shape.moveTo(-0.3, 0); shape.lineTo(0.3, 0); shape.lineTo(0.3, 0.2); shape.lineTo(0.12, 0.5);
  shape.lineTo(0.1, 0.82); shape.lineTo(-0.1, 0.82); shape.lineTo(-0.12, 0.5); shape.lineTo(-0.3, 0.2);
  const ext = new THREE.ExtrudeGeometry(shape, { depth: 2.96, bevelEnabled: false });
  ext.rotateY(HALF_PI);
  ext.translate(-1.48, 0, 0);
  return mergeParts([
    P(ext, [0, 0, 0], con, 0.9, 0),
    // orange and white warning board on top
    P(box(2.2, 0.26, 0.04), [0, 1.12, 0], [0.82, 0.36, 0.08], 0.6, 0),
    P(box(0.5, 0.26, 0.045), [-0.55, 1.12, 0], [0.86, 0.86, 0.82], 0.6, 0),
    P(box(0.5, 0.26, 0.045), [0.55, 1.12, 0], [0.86, 0.86, 0.82], 0.6, 0),
    P(box(0.05, 0.36, 0.05), [-0.9, 0.98, 0], GALV, 0.5, 0.8),
    P(box(0.05, 0.36, 0.05), [0.9, 0.98, 0], GALV, 0.5, 0.8),
    P(sph(0.07, 6, 4), [0, 1.32, 0], [1.0, 0.6, 0.1], 0.3, 0, { glow: 0.9 }),
  ]);
}

// ---------------------------------------------------------------------------
// ROOF THINGS
// ---------------------------------------------------------------------------
export function makeRoofAC() {
  const m = [0.62, 0.63, 0.62];
  return mergeParts([
    P(box(1.2, 0.85, 0.95), [0, 0.5, 0], m, 0.5, 0.7),
    P(box(1.26, 0.06, 1.0), [0, 0.95, 0], [0.45, 0.46, 0.46], 0.5, 0.7),
    P(cyl(0.36, 0.36, 0.03, 12), [0, 0.99, 0], [0.05, 0.05, 0.05], 0.6, 0.4),   // fan
    P(box(1.21, 0.5, 0.7), [0, 0.5, 0.14], [0.2, 0.21, 0.21], 0.7, 0.5),        // dark vents
    P(box(1.0, 0.08, 0.1), [0, 0.04, -0.35], [0.3, 0.3, 0.3], 0.7, 0.5),
    P(box(1.0, 0.08, 0.1), [0, 0.04, 0.35], [0.3, 0.3, 0.3], 0.7, 0.5),
  ]);
}

// Wooden water tank on a steel stand (classic on old city roofs).
export function makeWaterTank() {
  const wood = [0.33, 0.24, 0.17], steel = [0.12, 0.11, 0.1];
  const parts = [
    P(cyl(1.45, 1.5, 2.7, 14), [0, 3.75, 0], wood, 0.9, 0),
    P(new THREE.ConeGeometry(1.65, 0.8, 14), [0, 5.5, 0], [0.2, 0.17, 0.14], 0.85, 0),
    P(cyl(1.52, 1.52, 0.07, 14), [0, 3.0, 0], steel, 0.6, 0.7),
    P(cyl(1.5, 1.5, 0.07, 14), [0, 4.4, 0], steel, 0.6, 0.7),
    P(box(2.6, 0.14, 2.6), [0, 2.33, 0], steel, 0.7, 0.6),
  ];
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    parts.push(P(box(0.12, 2.3, 0.12), [x, 1.15, z], steel, 0.7, 0.6));
  }
  parts.push(P(box(3.1, 0.07, 0.07), [0, 1.2, -1.1], steel, 0.7, 0.6, { rot: [0, 0, 0.72] }));
  parts.push(P(box(3.1, 0.07, 0.07), [0, 1.2, 1.1], steel, 0.7, 0.6, { rot: [0, 0, -0.72] }));
  parts.push(P(box(0.07, 0.07, 3.1), [-1.1, 1.2, 0], steel, 0.7, 0.6, { rot: [0.72, 0, 0] }));
  parts.push(P(box(0.07, 0.07, 3.1), [1.1, 1.2, 0], steel, 0.7, 0.6, { rot: [-0.72, 0, 0] }));
  return mergeParts(parts);
}

// A row of solar panels (near-future touch). Tilts toward -z.
export function makeSolarPanels() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.75;
    parts.push(P(box(1.66, 0.04, 2.1), [x, 0.62, 0], [0.02, 0.035, 0.09], 0.12, 0.75, { rot: [0.3, 0, 0] }));
    parts.push(P(box(1.7, 0.03, 2.14), [x, 0.6, 0], [0.6, 0.61, 0.62], 0.4, 0.8, { rot: [0.3, 0, 0] }));
    parts.push(P(box(0.05, 0.95, 0.05), [x, 0.46, 0.85], GALV, 0.5, 0.8));
    parts.push(P(box(0.05, 0.36, 0.05), [x, 0.17, -0.85], GALV, 0.5, 0.8));
  }
  return mergeParts(parts);
}

// Air conditioner hanging under a window. Sticks out toward +z.
export function makeWindowAC() {
  return mergeParts([
    P(box(0.66, 0.42, 0.4), [0, 0, 0.2], [0.7, 0.7, 0.66], 0.6, 0.3),
    P(box(0.6, 0.34, 0.02), [0, 0, 0.405], [0.22, 0.22, 0.22], 0.7, 0.4),
    P(box(0.7, 0.03, 0.44), [0, 0.22, 0.2], [0.55, 0.55, 0.52], 0.6, 0.3),
  ]);
}

// One floor of a fire escape. The wall is at z = 0, the platform sticks out
// to +z. withStairs: also the stairs up to the next floor (3.5 m higher).
export function makeFireEscape(withStairs) {
  const iron = [0.045, 0.045, 0.05];
  const r = 0.6, m = 0.75;
  const parts = [
    P(box(3.0, 0.05, 1.0), [0, 0, 0.52], iron, r, m),                 // platform
    P(box(3.0, 0.04, 0.04), [0, 1.0, 1.0], iron, r, m),               // top rail front
    P(box(3.0, 0.03, 0.03), [0, 0.5, 1.0], iron, r, m),
    P(box(0.04, 0.04, 1.0), [-1.48, 1.0, 0.52], iron, r, m),
    P(box(0.04, 0.04, 1.0), [1.48, 1.0, 0.52], iron, r, m),
    P(box(0.03, 0.03, 1.0), [-1.48, 0.5, 0.52], iron, r, m),
    P(box(0.03, 0.03, 1.0), [1.48, 0.5, 0.52], iron, r, m),
    P(box(0.07, 0.3, 0.9), [-1.2, -0.17, 0.48], iron, r, m),          // brackets under the platform
    P(box(0.07, 0.3, 0.9), [1.2, -0.17, 0.48], iron, r, m),
  ];
  for (const x of [-1.48, -0.5, 0.5, 1.48]) parts.push(P(box(0.035, 1.0, 0.035), [x, 0.5, 1.0], iron, r, m));
  if (withStairs) {
    // two side beams and the steps, rising from the left end to the right end
    const run = 2.3, rise = 3.5, ang = Math.atan2(rise, run), len = Math.hypot(run, rise);
    for (const z of [0.32, 0.8]) parts.push(P(box(len, 0.14, 0.03), [0, rise / 2, z], iron, r, m, { rot: [0, 0, ang] }));
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      parts.push(P(box(0.22, 0.025, 0.46), [-run / 2 + run * t, rise * t, 0.56], iron, r, m));
    }
  }
  return mergeParts(parts);
}

// Lifeguard tower for the beach. The ramp points to +z.
export function makeLifeguardTower() {
  const blue = [0.56, 0.68, 0.74], white = [0.86, 0.86, 0.82], wood = [0.5, 0.4, 0.28];
  const parts = [
    P(box(2.6, 0.12, 2.8), [0, 1.7, 0], wood, 0.85, 0),                 // deck
    P(box(2.2, 2.0, 2.0), [0, 2.76, -0.3], blue, 0.7, 0),               // hut
    P(box(2.8, 0.1, 3.0), [0, 3.86, 0], white, 0.7, 0, { rot: [0.1, 0, 0] }), // roof
    P(box(1.2, 0.8, 0.03), [0, 2.9, 0.72], [0.08, 0.1, 0.12], 0.1, 0.8), // window
    P(box(1.0, 0.08, 2.6), [0, 0.85, 2.5], wood, 0.85, 0, { rot: [0.6, 0, 0] }), // ramp
    P(box(2.6, 0.06, 0.06), [0, 2.6, 1.36], white, 0.7, 0),
  ];
  for (const [x, z] of [[-1.15, -1.2], [1.15, -1.2], [-1.15, 1.2], [1.15, 1.2]]) {
    parts.push(P(box(0.16, 1.7, 0.16), [x, 0.85, z], wood, 0.85, 0));
    parts.push(P(box(0.06, 0.9, 0.06), [x, 2.2, z > 0 ? 1.36 : z], white, 0.7, 0));
  }
  return mergeParts(parts);
}

// Small delivery / camera drone (near-future touch).
export function makeDrone() {
  const body = [0.12, 0.13, 0.14];
  const parts = [
    P(box(0.34, 0.1, 0.42), [0, 0, 0], body, 0.4, 0.5),
    P(sph(0.07, 6, 4), [0, -0.09, 0.12], [0.02, 0.02, 0.02], 0.2, 0.6),
    P(box(0.04, 0.04, 0.02), [0.1, 0, 0.22], [1, 0.1, 0.05], 0.3, 0, { glow: 1.9 }),   // red light
    P(box(0.04, 0.04, 0.02), [-0.1, 0, 0.22], [0.1, 1, 0.3], 0.3, 0, { glow: 1.9 }),   // green light
  ];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    parts.push(P(box(0.05, 0.03, 0.46), [x * 0.2, 0.02, z * 0.2], body, 0.4, 0.5, { rot: [0, (x * z > 0 ? 1 : -1) * 0.78, 0] }));
    parts.push(P(cyl(0.17, 0.17, 0.012, 10), [x * 0.36, 0.07, z * 0.36], [0.25, 0.25, 0.26], 0.5, 0.2));
  }
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// TREES
// ---------------------------------------------------------------------------
// Street tree: trunk (solid) + crown (flat leaf cards with soft round shading).
export function makeTree(seed = 1) {
  const rng = new RNG(seed);
  const bark = [0.22, 0.18, 0.15];
  const trunkParts = [
    P(cyl(0.11, 0.19, 3.4, 7), [0, 1.7, 0], bark, 0.95, 0),
    P(cyl(0.06, 0.1, 2.2, 5), [0.45, 4.1, 0.15], bark, 0.95, 0, { rot: [0.1, 0, -0.5] }),
    P(cyl(0.06, 0.1, 2.2, 5), [-0.4, 4.1, -0.25], bark, 0.95, 0, { rot: [-0.2, 0, 0.45] }),
    P(cyl(0.05, 0.09, 2.0, 5), [0.05, 4.2, 0.4], bark, 0.95, 0, { rot: [0.5, 0, 0.05] }),
  ];
  const trunk = mergeParts(trunkParts);

  // crown: cards placed around a squashed ball
  const mb = new MeshBuilder();
  const center = [0, 5.5, 0];
  const cards = 13;
  for (let i = 0; i < cards; i++) {
    const inner = i >= 10;
    const a = (i / 10) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const e = rng.range(-0.35, 0.95);
    const rad = inner ? rng.range(0.2, 0.6) : rng.range(1.25, 1.75);
    const cx = Math.cos(a) * Math.cos(e) * rad, cy = Math.sin(e) * rad * 0.9, cz = Math.sin(a) * Math.cos(e) * rad;
    const size = rng.range(2.5, 3.5);
    // each card looks roughly outward, with a random tilt
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.9, 0.9), -a + HALF_PI + rng.range(-0.7, 0.7), rng.range(0, 6.28), 'YXZ'));
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    const idx = [];
    for (const [u, v] of corners) {
      const p = new THREE.Vector3(u * size, v * size, 0).applyQuaternion(q);
      p.x += center[0] + cx; p.y += center[1] + cy; p.z += center[2] + cz;
      // normal points away from the middle of the crown = round, soft shading
      const n = new THREE.Vector3(p.x - center[0], (p.y - center[1]) * 1.2 + 0.6, p.z - center[2]).normalize();
      // lower and inner leaves are darker (less sky light reaches them)
      const shade = 0.62 + 0.42 * Math.min(1, Math.max(0, (p.y - 3.8) / 3.4));
      mb.color(shade, shade, shade * 0.96, 1);
      mb.data(1, 0, 0, 0); // sways in the wind
      idx.push(mb.vertex(p.x, p.y, p.z, n.x, n.y, n.z, u + 0.5, v + 0.5));
    }
    mb.quadIdx(idx[0], idx[1], idx[2], idx[3]);
  }
  return { trunk, crown: mb.build(true) };
}

// Palm tree: tall thin trunk + a crown of curved fronds.
export function makePalm(seed = 2) {
  const rng = new RNG(seed);
  const bark = [0.4, 0.34, 0.28];
  const H = 10.5;
  // the trunk leans a little: stack short pieces along a soft curve
  const trunkParts = [];
  const seg = 6;
  const curve = (t) => [0.55 * t * t, H * t, 0.25 * Math.sin(t * 2.2)];
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg, t1 = (i + 1) / seg;
    const a = curve(t0), b = curve(t1);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const r0 = 0.24 - 0.1 * t0, r1 = 0.24 - 0.1 * t1;
    trunkParts.push(P(cyl(r1, r0, len * 1.02, 7), mid, bark, 0.95, 0, { rot: [Math.atan2(dz, dy), 0, -Math.atan2(dx, dy)] }));
  }
  const top = curve(1);
  trunkParts.push(P(sph(0.32, 7, 5), [top[0], top[1] - 0.05, top[2]], [0.3, 0.27, 0.2], 0.95, 0));
  const trunk = mergeParts(trunkParts);

  const mb = new MeshBuilder();
  const fronds = 15;
  for (let k = 0; k < fronds; k++) {
    const az = (k / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(3.1, 4.0);
    const rise = rng.range(0.1, 2.0);            // young fronds point up, old ones hang
    const droop = rise + rng.range(1.4, 2.6);
    const hx = Math.cos(az), hz = Math.sin(az);
    const S = 5;
    const pt = (t) => new THREE.Vector3(top[0] + hx * len * t, top[1] + rise * t - droop * t * t, top[2] + hz * len * t);
    for (const half of [-1, 1]) {
      let prev = null;
      for (let i = 0; i <= S; i++) {
        const t = i / S;
        const p = pt(t);
        const tan = pt(Math.min(1, t + 0.05)).sub(pt(Math.max(0, t - 0.05))).normalize();
        const sideV = new THREE.Vector3(-hz, 0, hx);
        const up = new THREE.Vector3().crossVectors(sideV, tan).normalize();
        if (up.y < 0) up.negate();
        const w = 0.52 * (1 - 0.55 * t) + 0.04;
        // each half is folded up a little: the frond looks like a shallow "V"
        const edge = p.clone().addScaledVector(sideV, half * w * 0.92).addScaledVector(up, w * 0.38);
        const n = up.clone().addScaledVector(sideV, -half * 0.4).normalize();
        const shade = 0.72 + 0.34 * (1 - t) + rise * 0.04;
        mb.color(shade, shade, shade * 0.95, 1);
        mb.data(t, 0, 0, 0);
        const iRib = mb.vertex(p.x, p.y, p.z, n.x, n.y, n.z, 0.5, t);
        const iEdge = mb.vertex(edge.x, edge.y, edge.z, n.x, n.y, n.z, 0.5 + half * 0.5, t);
        if (prev) {
          if (half > 0) mb.quadIdx(prev[0], prev[1], iEdge, iRib);
          else mb.quadIdx(prev[1], prev[0], iRib, iEdge);
        }
        prev = [iRib, iEdge];
      }
    }
  }
  return { trunk, crown: mb.build(true), height: H };
}

// ---------------------------------------------------------------------------
// CARS
// ---------------------------------------------------------------------------
// A car body is made from "rings": cross-sections from the back to the front.
// For each ring:  z = position,  yb = bottom,  ys = shoulder (below the
// windows),  yt = top,  wb / ws / wt = half width at bottom / shoulder / top.
const CAR_SPECS = {
  sedan: {
    wheelR: 0.33, wheelX: 0.835, wheelZ: [-1.34, 1.4],
    rings: [
      { z: -2.3, yb: 0.34, ys: 0.8, yt: 0.86, wb: 0.72, ws: 0.8, wt: 0.68 },
      { z: -2.12, yb: 0.22, ys: 0.9, yt: 0.99, wb: 0.86, ws: 0.905, wt: 0.78 },
      { z: -1.45, yb: 0.2, ys: 0.93, yt: 1.03, wb: 0.88, ws: 0.915, wt: 0.8 },
      { z: -0.85, yb: 0.2, ys: 0.94, yt: 1.42, wb: 0.88, ws: 0.92, wt: 0.6 },
      { z: 0.3, yb: 0.2, ys: 0.94, yt: 1.43, wb: 0.88, ws: 0.92, wt: 0.62 },
      { z: 1.02, yb: 0.2, ys: 0.92, yt: 1.0, wb: 0.88, ws: 0.915, wt: 0.8 },
      { z: 1.95, yb: 0.21, ys: 0.8, yt: 0.86, wb: 0.87, ws: 0.895, wt: 0.76 },
      { z: 2.2, yb: 0.24, ys: 0.64, yt: 0.74, wb: 0.82, ws: 0.85, wt: 0.7 },
      { z: 2.3, yb: 0.32, ys: 0.56, yt: 0.62, wb: 0.66, ws: 0.72, wt: 0.58 },
    ],
    // what is between ring i and ring i+1
    gaps: ['body', 'body', 'glass', 'cabin', 'glass', 'body', 'body', 'body'],
  },
  suv: {
    wheelR: 0.37, wheelX: 0.87, wheelZ: [-1.42, 1.48],
    rings: [
      { z: -2.37, yb: 0.4, ys: 0.95, yt: 1.02, wb: 0.76, ws: 0.84, wt: 0.72 },
      { z: -2.25, yb: 0.28, ys: 1.05, yt: 1.12, wb: 0.9, ws: 0.94, wt: 0.84 },
      { z: -2.02, yb: 0.26, ys: 1.08, yt: 1.68, wb: 0.92, ws: 0.95, wt: 0.68 },
      { z: 0.25, yb: 0.26, ys: 1.08, yt: 1.72, wb: 0.92, ws: 0.955, wt: 0.7 },
      { z: 0.95, yb: 0.26, ys: 1.06, yt: 1.14, wb: 0.92, ws: 0.95, wt: 0.84 },
      { z: 2.02, yb: 0.28, ys: 0.96, yt: 1.02, wb: 0.91, ws: 0.93, wt: 0.8 },
      { z: 2.28, yb: 0.32, ys: 0.74, yt: 0.86, wb: 0.86, ws: 0.89, wt: 0.74 },
      { z: 2.37, yb: 0.4, ys: 0.64, yt: 0.72, wb: 0.7, ws: 0.76, wt: 0.62 },
    ],
    gaps: ['body', 'glass', 'cabin', 'glass', 'body', 'body', 'body'],
  },
  van: {
    wheelR: 0.36, wheelX: 0.915, wheelZ: [-1.6, 1.75],
    rings: [
      { z: -2.65, yb: 0.42, ys: 1.1, yt: 1.95, wb: 0.9, ws: 0.96, wt: 0.88 },
      { z: -2.55, yb: 0.3, ys: 1.15, yt: 2.03, wb: 0.97, ws: 1.0, wt: 0.92 },
      { z: 1.05, yb: 0.3, ys: 1.15, yt: 2.03, wb: 0.97, ws: 1.0, wt: 0.9 },
      { z: 1.75, yb: 0.3, ys: 1.12, yt: 1.22, wb: 0.97, ws: 1.0, wt: 0.88 },
      { z: 2.45, yb: 0.32, ys: 0.95, yt: 1.02, wb: 0.95, ws: 0.97, wt: 0.84 },
      { z: 2.65, yb: 0.4, ys: 0.7, yt: 0.8, wb: 0.8, ws: 0.84, wt: 0.72 },
    ],
    gaps: ['body', 'body', 'glass', 'body', 'body'],
  },
};

export function makeCar(kind) {
  const spec = CAR_SPECS[kind];
  const mb = new MeshBuilder();
  const PAINT = { c: [1, 1, 1], d: [0.3, 0.5, 1, 0] };          // takes the per-car color
  const GLASS = { c: lin([0.05, 0.06, 0.07]), d: [0.06, 0.9, 0, 0] };
  const TRIM = { c: lin([0.06, 0.06, 0.065]), d: [0.7, 0.2, 0, 0] };
  const use = (m) => { mb.color(m.c[0], m.c[1], m.c[2], 1); mb.data(m.d[0], m.d[1], m.d[2], m.d[3]); };

  // points of one ring: right side from the bottom to the top middle, then the left side
  const ringPts = (r) => {
    const half = [
      [r.wb * 0.82, r.yb], [r.wb, r.yb + 0.14], [r.ws, r.yb + (r.ys - r.yb) * 0.62],
      [r.ws * 0.985, r.ys], [r.wt, r.yt], [0, r.yt + 0.035],
    ];
    const pts = half.map(([x, y]) => [x, y, r.z]);
    for (let i = half.length - 2; i >= 0; i--) pts.push([-half[i][0], half[i][1], r.z]);
    return pts;
  };
  const rings = spec.rings.map(ringPts);
  const n = rings[0].length;
  for (let g = 0; g < rings.length - 1; g++) {
    const A = rings[g], B = rings[g + 1];
    const kindG = spec.gaps[g];
    const zc = (A[0][2] + B[0][2]) / 2;
    for (let j = 0; j < n - 1; j++) {
      const s = j < 5 ? j : 9 - j; // 0 sill, 1-2 door, 3 window band, 4 top
      let m = PAINT;
      if (s === 0) m = TRIM;
      else if (s === 3 && (kindG === 'cabin' || kindG === 'glass')) m = GLASS;
      else if (s === 4 && kindG === 'glass') m = GLASS;
      use(m);
      const p0 = A[j], p1 = A[j + 1], p2 = B[j + 1], p3 = B[j];
      const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
      mb.quadAuto(p0, p1, p2, p3, [cx, cy - 0.7, 0], 1);
    }
  }
  // close the back and the front
  for (const [ring, dir] of [[rings[0], -1], [rings[rings.length - 1], 1]]) {
    use(PAINT);
    const cy = (ring[0][1] + ring[5][1]) / 2, z = ring[0][2];
    for (let j = 0; j < n - 1; j++) {
      const a = ring[j], b = ring[j + 1];
      const i0 = mb.vertex(0, cy, z + dir * 0.03, 0, 0, dir, 0, 0);
      const i1 = mb.vertex(a[0], a[1], a[2], 0, 0, dir, 0, 0);
      const i2 = mb.vertex(b[0], b[1], b[2], 0, 0, dir, 0, 0);
      if (dir > 0) mb.tri(i0, i1, i2); else mb.tri(i0, i2, i1);
    }
  }
  const body = mb.build(true);
  smoothNormals(body);

  // wheels, lights, mirrors
  const last = spec.rings[spec.rings.length - 1], first = spec.rings[0];
  const extra = [];
  for (const z of spec.wheelZ) {
    for (const sx of [-1, 1]) {
      const x = sx * spec.wheelX;
      extra.push(P(cyl(spec.wheelR, spec.wheelR, 0.23, 14), [x, spec.wheelR, z], RUBBER, 0.9, 0, { rot: [0, 0, HALF_PI] }));
      extra.push(P(cyl(spec.wheelR * 0.6, spec.wheelR * 0.6, 0.24, 10), [x, spec.wheelR, z], [0.6, 0.61, 0.63], 0.3, 0.9, { rot: [0, 0, HALF_PI] }));
      // dark half circle behind the wheel = the wheel arch
      const arch = new THREE.CircleGeometry(spec.wheelR + 0.08, 12, 0, Math.PI);
      extra.push(P(arch, [sx * (spec.wheelX + 0.097), spec.wheelR - 0.02, z], [0.02, 0.02, 0.02], 0.9, 0, { rot: [0, sx * HALF_PI, 0] }));
    }
  }
  const hw = last.ws;
  const hy = (last.yb + last.yt) / 2 + 0.08;
  extra.push(P(box(0.28, 0.1, 0.05), [hw * 0.66, hy, last.z + 0.005], [0.9, 0.92, 0.95], 0.12, 0.6));   // head lights
  extra.push(P(box(0.28, 0.1, 0.05), [-hw * 0.66, hy, last.z + 0.005], [0.9, 0.92, 0.95], 0.12, 0.6));
  extra.push(P(box(hw * 0.8, 0.13, 0.04), [0, last.yb + 0.1, last.z + 0.022], [0.03, 0.03, 0.03], 0.6, 0.3)); // grille
  const ty = first.ys - 0.05;
  extra.push(P(box(0.26, 0.11, 0.05), [first.ws * 0.7, ty, first.z - 0.005], [0.5, 0.03, 0.03], 0.25, 0.3)); // tail lights
  extra.push(P(box(0.26, 0.11, 0.05), [-first.ws * 0.7, ty, first.z - 0.005], [0.5, 0.03, 0.03], 0.25, 0.3));
  extra.push(P(box(0.5, 0.13, 0.03), [0, first.yb + 0.22, first.z - 0.03], [0.8, 0.8, 0.74], 0.5, 0));       // plate
  // side mirrors sit at the bottom of the windshield
  const cowl = spec.rings[spec.gaps.lastIndexOf('glass') + 1];
  for (const sx of [-1, 1]) {
    extra.push(P(box(0.2, 0.11, 0.09), [sx * (cowl.ws + 0.09), cowl.ys + 0.1, cowl.z - 0.12], [1, 1, 1], 0.3, 0.5, { paint: 1 }));
  }

  const out = new MeshBuilder();
  out.addGeometry(body, null, true);
  const rest = mergeParts(extra);
  out.addGeometry(rest, null, true);
  return out.build(true);
}

// Make normals smooth: every vertex at the same place gets the same normal.
function smoothNormals(geom) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, idx = geom.index;
  const acc = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    fn.subVectors(b, a).cross(c.sub(a)); // length = 2 x area, so big faces count more
    for (const i of [i0, i1, i2]) {
      const k = key(i);
      if (!acc.has(k)) acc.set(k, new THREE.Vector3());
      acc.get(k).add(fn);
    }
  }
  for (let i = 0; i < pos.count; i++) {
    const nrm = acc.get(key(i));
    if (nrm) { fn.copy(nrm).normalize(); nor.setXYZ(i, fn.x, fn.y, fn.z); }
  }
  nor.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// LIGHT RAIL TRAIN (two cars). Runs along z. Length about 29 m.
// ---------------------------------------------------------------------------
export function makeTrain() {
  const white = [0.8, 0.81, 0.8], teal = [0.1, 0.36, 0.38], glass = [0.5, 0.47, 0.38], dark = [0.05, 0.05, 0.055];
  const parts = [];
  for (const cz of [-7.35, 7.35]) {
    parts.push(P(box(2.65, 2.3, 13.6), [0, 2.0, cz], white, 0.35, 0.4));
    parts.push(P(box(2.67, 0.34, 13.62), [0, 1.15, cz], teal, 0.35, 0.4));
    parts.push(P(box(2.5, 0.5, 13.0), [0, 3.3, cz], [0.6, 0.61, 0.6], 0.5, 0.5));        // roof equipment
    parts.push(P(box(2.68, 0.85, 12.6), [0, 2.35, cz], glass, 0.08, 0.6, { glow: 1.0 })); // window band (lit at night)
    parts.push(P(box(2.3, 0.5, 12.8), [0, 0.6, cz], dark, 0.7, 0.4));                    // under frame
    for (const dz of [-4.4, 4.4]) parts.push(P(box(2.2, 0.55, 2.2), [0, 0.3, cz + dz], dark, 0.7, 0.5));
    // sloped nose at the outer end
    const s = Math.sign(cz);
    parts.push(P(box(2.5, 1.5, 1.2), [0, 1.7, cz + s * 7.2], white, 0.35, 0.4, { rot: [-s * 0.35, 0, 0] }));
    parts.push(P(box(2.2, 0.8, 0.5), [0, 2.4, cz + s * 7.45], [0.06, 0.07, 0.08], 0.08, 0.8, { rot: [-s * 0.35, 0, 0] })); // windshield
    parts.push(P(box(0.3, 0.1, 0.06), [0.85, 1.25, cz + s * 7.82], [1.0, 0.95, 0.85], 0.2, 0, { glow: 1.5 }));
    parts.push(P(box(0.3, 0.1, 0.06), [-0.85, 1.25, cz + s * 7.82], [1.0, 0.95, 0.85], 0.2, 0, { glow: 1.5 }));
  }
  parts.push(P(box(2.2, 2.0, 1.2), [0, 2.0, 0], dark, 0.8, 0.2)); // joint between the two cars
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// MANNEQUIN: stand-in player with real human proportions (1.8 m tall).
// Faces +z.
// ---------------------------------------------------------------------------
export function makeMannequin() {
  const skin = [0.62, 0.46, 0.38], hair = [0.07, 0.06, 0.05];
  const jacket = [0.14, 0.15, 0.17], jeans = [0.13, 0.17, 0.25], shoe = [0.06, 0.055, 0.05], shirt = [0.45, 0.44, 0.42];
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 8);
  const cloth = 0.85;
  const parts = [
    // head and neck
    P(sph(0.105, 12, 10), [0, 1.675, 0.01], skin, 0.6, 0, { scale: [0.92, 1.12, 1.0] }),
    P(sph(0.109, 12, 8), [0, 1.705, -0.012], hair, 0.8, 0, { scale: [0.95, 1.0, 1.0] }),
    P(cyl(0.05, 0.055, 0.1, 8), [0, 1.53, 0], skin, 0.6, 0),
    // torso: chest, belly, hips
    P(cap(0.15, 0.2), [0, 1.3, 0], jacket, cloth, 0, { scale: [1.28, 1.0, 0.82] }),
    P(cap(0.135, 0.12), [0, 1.08, 0], jacket, cloth, 0, { scale: [1.2, 1.0, 0.82] }),
    P(cap(0.14, 0.06), [0, 0.94, 0], jeans, cloth, 0, { scale: [1.2, 1.0, 0.85] }),
    P(box(0.1, 0.16, 0.02), [0, 1.36, 0.118], shirt, cloth, 0),
    // shoulders
    P(sph(0.075, 8, 6), [0.205, 1.43, 0], jacket, cloth, 0),
    P(sph(0.075, 8, 6), [-0.205, 1.43, 0], jacket, cloth, 0),
  ];
  for (const s of [-1, 1]) {
    // arms hang down, slightly away from the body
    parts.push(P(cap(0.05, 0.24), [s * 0.235, 1.27, 0], jacket, cloth, 0, { rot: [0, 0, s * 0.1] }));
    parts.push(P(cap(0.042, 0.23), [s * 0.265, 0.99, 0.02], jacket, cloth, 0, { rot: [-0.12, 0, s * 0.06] }));
    parts.push(P(sph(0.045, 8, 6), [s * 0.275, 0.8, 0.045], skin, 0.6, 0, { scale: [0.8, 1.25, 1.0] }));
    // legs
    parts.push(P(cap(0.075, 0.33), [s * 0.095, 0.69, 0], jeans, cloth, 0));
    parts.push(P(cap(0.056, 0.36), [s * 0.1, 0.3, -0.01], jeans, cloth, 0));
    parts.push(P(box(0.095, 0.075, 0.26), [s * 0.1, 0.038, 0.045], shoe, 0.6, 0));
  }
  return mergeParts(parts);
}

// Big wheeled trash container for alleys (1.9 m wide, lid slopes to the front +z).
export function makeDumpster() {
  const col = [1, 1, 1]; // painted: the color comes from each copy
  const o = { paint: 1 };
  return mergeParts([
    P(box(1.9, 1.0, 1.1), [0, 0.68, 0], col, 0.6, 0.4, o),
    P(box(1.96, 0.07, 1.16), [0, 1.2, 0], col, 0.6, 0.4, o),
    P(box(1.94, 0.05, 1.18), [0, 1.3, -0.02], [0.05, 0.05, 0.05], 0.55, 0.1, { rot: [0.14, 0, 0] }),  // black lid
    P(box(0.08, 0.5, 0.12), [-1.0, 0.8, 0], [0.1, 0.1, 0.1], 0.6, 0.6),                                // lifting pockets
    P(box(0.08, 0.5, 0.12), [1.0, 0.8, 0], [0.1, 0.1, 0.1], 0.6, 0.6),
    P(cyl(0.09, 0.09, 0.07, 8), [-0.8, 0.09, 0.4], RUBBER, 0.9, 0, { rot: [0, 0, HALF_PI] }),
    P(cyl(0.09, 0.09, 0.07, 8), [0.8, 0.09, 0.4], RUBBER, 0.9, 0, { rot: [0, 0, HALF_PI] }),
    P(cyl(0.09, 0.09, 0.07, 8), [-0.8, 0.09, -0.4], RUBBER, 0.9, 0, { rot: [0, 0, HALF_PI] }),
    P(cyl(0.09, 0.09, 0.07, 8), [0.8, 0.09, -0.4], RUBBER, 0.9, 0, { rot: [0, 0, HALF_PI] }),
  ]);
}
