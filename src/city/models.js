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
import { RAIL } from './textures.js';

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
// tube without end caps (for poles: the ends are never seen)
const openCyl = (rTop, rBot, h, seg = 6) => new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, true);
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
    P(cyl(0.2, 0.22, 0.08, 6), [0, 0.04, 0], GALV, 0.55, 0.85),
    P(openCyl(0.065, 0.11, 8.2, 6), [0, 4.1, 0], GALV, 0.5, 0.85),
    // arm: rises a little toward the street
    P(openCyl(0.04, 0.05, 2.5, 4), [0, 8.42, 1.2], GALV, 0.5, 0.85, { rot: [HALF_PI - 0.2, 0, 0] }),
    // lamp head
    P(sph(0.5, 6, 3), [0, 8.62, 2.5], [0.4, 0.41, 0.42], 0.45, 0.8, { scale: [0.3, 0.14, 0.76] }),
    // glowing glass under the head
    P(box(0.2, 0.03, 0.44), [0, 8.535, 2.56], SODIUM, 0.3, 0, { glow: 1 }),
  ]);
  return { geometry, lampPos: [0, 8.5, 2.56] };
}

// Modern LED light for Neon Mile. arms = 1 or 2 (two arms for the median).
export function makeLedLight(arms) {
  const col = [0.14, 0.15, 0.16];
  const parts = [
    P(cyl(0.16, 0.19, 0.5, 6), [0, 0.25, 0], col, 0.4, 0.7),
    P(openCyl(0.07, 0.1, 9.0, 6), [0, 4.5, 0], col, 0.4, 0.7),
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
    P(cyl(0.2, 0.24, 0.3, 6), [0, 0.15, 0], col, 0.5, 0.6),
    P(openCyl(0.085, 0.11, 6.1, 6), [0, 3.05, 0], col, 0.5, 0.6),
    P(openCyl(0.05, 0.075, 6.8, 5), [3.3, 5.9, 0], col, 0.5, 0.6, { rot: [0, 0, HALF_PI] }),
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
    P(openCyl(0.1, 0.15, 9.6, 6), [0, 4.8, 0], wood, 0.95, 0),
    P(box(2.4, 0.1, 0.12), [0, 8.9, 0], wood, 0.95, 0),
    P(box(1.5, 0.09, 0.1), [0, 7.7, 0], wood, 0.95, 0),
    // grey transformer can
    P(cyl(0.27, 0.27, 0.85, 7), [0.42, 7.0, 0], [0.42, 0.44, 0.45], 0.5, 0.6),
    P(cyl(0.05, 0.05, 0.16, 6), [0.42, 7.5, 0], [0.75, 0.74, 0.7], 0.4, 0),
  ];
  const wirePoints = [];
  for (const x of [-1.1, -0.4, 0.4, 1.1]) {
    parts.push(P(box(0.07, 0.14, 0.07), [x, 9.02, 0], [0.5, 0.52, 0.5], 0.35, 0));
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
    P(box(1.2, 0.9, 0.95), [0, 0.5, 0], m, 0.5, 0.7),
    P(box(1.26, 0.06, 1.0), [0, 0.98, 0], [0.45, 0.46, 0.46], 0.5, 0.7),
    P(cyl(0.36, 0.36, 0.03, 8), [0, 1.02, 0], [0.05, 0.05, 0.05], 0.6, 0.4),   // fan
    P(box(1.21, 0.5, 0.7), [0, 0.5, 0.14], [0.2, 0.21, 0.21], 0.7, 0.5),       // dark vents
  ]);
}

// Wooden water tank on a steel stand (classic on old city roofs).
export function makeWaterTank() {
  const wood = [0.33, 0.24, 0.17], steel = [0.12, 0.11, 0.1];
  const parts = [
    P(openCyl(1.45, 1.5, 2.7, 9), [0, 3.75, 0], wood, 0.9, 0),
    P(new THREE.ConeGeometry(1.65, 0.8, 9, 1, true), [0, 5.5, 0], [0.2, 0.17, 0.14], 0.85, 0),
    P(openCyl(1.53, 1.53, 0.09, 9), [0, 4.3, 0], steel, 0.6, 0.7),
    P(box(2.6, 0.14, 2.6), [0, 2.33, 0], steel, 0.7, 0.6),
  ];
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    parts.push(P(box(0.12, 2.3, 0.12), [x, 1.15, z], steel, 0.7, 0.6));
  }
  parts.push(P(box(3.1, 0.07, 0.07), [0, 1.2, -1.1], steel, 0.7, 0.6, { rot: [0, 0, 0.72] }));
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

// A simple walking person, 1.75 m tall, looking toward +z.
// The clothes take the per-copy color. Arms and legs swing in the shader:
// for that every vertex stores "aLimb" = ( height of the joint it turns
// around, how far it swings (+ or -), 1 ).
export function makePedestrian() {
  const skin = [0.7, 0.53, 0.42], hair = [0.1, 0.08, 0.07], shoe = [0.06, 0.06, 0.07], trousers = [0.2, 0.21, 0.25];
  const parts = [
    // body (takes the clothes color), a little wider at the shoulders
    P(cyl(0.2, 0.165, 0.6, 6), [0, 1.17, 0], [0.95, 0.95, 0.95], 0.85, 0, { paint: 1, scale: [1, 1, 0.62] }),
    P(cyl(0.05, 0.055, 0.1, 5), [0, 1.5, 0], skin, 0.7, 0),                       // neck
    P(sph(0.112, 7, 5), [0, 1.63, 0.005], skin, 0.7, 0, { scale: [0.94, 1.14, 1] }), // head
    P(sph(0.118, 7, 4), [0, 1.665, -0.022], hair, 0.8, 0, { scale: [0.97, 0.95, 1.02] }), // hair
  ];
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.15, 0.82, 0.17), [sx * 0.092, 0.46, 0], trousers, 0.85, 0, { paint: 0.3 }));   // leg
    parts.push(P(box(0.14, 0.07, 0.27), [sx * 0.092, 0.036, 0.045], shoe, 0.6, 0));                    // shoe
    parts.push(P(box(0.1, 0.5, 0.115), [sx * 0.262, 1.2, 0], [0.9, 0.9, 0.9], 0.85, 0, { paint: 1 })); // sleeve
    parts.push(P(box(0.085, 0.16, 0.095), [sx * 0.262, 0.875, 0], skin, 0.7, 0));                      // hand
  }
  const geometry = mergeParts(parts);
  // mark the arms and legs for the walking shader
  const pos = geometry.attributes.position, limb = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), side = x > 0 ? 1 : -1;
    let pivot = 0, swing = 0;
    if (Math.abs(x) > 0.2) { pivot = 1.42; swing = -0.42 * side; }            // arm: swings against the leg on its side
    else if (y < 0.875 && Math.abs(x) > 0.01) { pivot = 0.88; swing = 0.5 * side; } // leg
    limb[i * 3] = pivot; limb[i * 3 + 1] = swing; limb[i * 3 + 2] = 1;
  }
  geometry.setAttribute('aLimb', new THREE.BufferAttribute(limb, 3));
  return { geometry };
}

// Bike rack: four steel hoops in a row (along x) with two parked bicycles.
export function makeBikeRack() {
  const steel = [0.6, 0.62, 0.64];
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.85;
    parts.push(P(new THREE.TorusGeometry(0.34, 0.022, 4, 10, Math.PI), [x, 0.46, 0], steel, 0.35, 0.9));
    for (const sx of [-0.34, 0.34]) parts.push(P(cyl(0.022, 0.022, 0.46, 5), [x + sx, 0.23, 0], steel, 0.35, 0.9));
  }
  // one simple bicycle standing along x
  const bike = (cx, z, color, lean) => {
    const tyre = [0.05, 0.05, 0.055], rot = [lean, 0, 0];
    for (const wx of [-0.52, 0.52]) parts.push(P(new THREE.TorusGeometry(0.32, 0.018, 4, 12), [cx + wx, 0.34, z], tyre, 0.8, 0, { rot }));
    const tube = (x0, y0, x1, y1, r = 0.017) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      parts.push(P(cyl(r, r, len, 4), [cx + (x0 + x1) / 2, (y0 + y1) / 2, z + lean * ((y0 + y1) / 2 - 0.34) * -1], color, 0.4, 0.5, { rot: [lean, 0, Math.atan2(x1 - x0, y1 - y0) * -1] }));
    };
    tube(-0.52, 0.34, -0.12, 0.36);   // chain stay
    tube(-0.12, 0.36, 0.3, 0.8);      // down tube
    tube(-0.2, 0.84, 0.3, 0.8);       // top tube
    tube(-0.12, 0.36, -0.22, 0.9);    // seat tube
    tube(-0.52, 0.34, -0.2, 0.84);    // seat stay
    tube(0.52, 0.34, 0.28, 0.95);     // fork + head
    parts.push(P(box(0.2, 0.04, 0.09), [cx - 0.23, 0.93, z - lean * 0.6], [0.05, 0.05, 0.05], 0.7, 0));   // saddle
    parts.push(P(box(0.04, 0.03, 0.44), [cx + 0.27, 0.97, z - lean * 0.63], [0.08, 0.08, 0.08], 0.5, 0.4)); // handlebar
  };
  bike(-0.85, 0.11, [0.1, 0.3, 0.5], 0.1);
  bike(0.9, -0.11, [0.55, 0.16, 0.1], -0.1);
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
    P(box(0.26, 0.2, 0.3), [0, -0.19, -0.02], [0.62, 0.48, 0.3], 0.85, 0),             // the parcel it carries
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
// Street tree: trunk with branches (solid) + crown (many leaf cards).
// The crown is built from a few "puffs" (balls of leaf cards) so it has a
// natural, lumpy outline instead of one round ball.
//   shape 0 = wide round street tree, 1 = taller, narrower tree
export function makeTree(seed = 1, shape = 0) {
  const rng = new RNG(seed);
  const bark = [0.92, 0.88, 0.84]; // the bark picture brings the color
  const tall = shape === 1;
  const trunkH = tall ? 4.4 : 3.5;
  const trunkParts = [
    P(openCyl(0.12, 0.21, trunkH, 7), [0, trunkH / 2, 0], bark, 0.95, 0),
    P(openCyl(0.2, 0.3, 0.35, 7), [0, 0.17, 0], bark, 0.95, 0), // root flare
  ];
  // the puffs: [x, y, z, radius]
  const puffs = tall
    ? [[0, 5.6, 0, 1.45], [0.5, 6.9, 0.2, 1.25], [-0.45, 6.4, -0.4, 1.2], [0.1, 8.0, -0.1, 1.0], [-0.2, 5.0, 0.55, 1.05]]
    : [[0, 5.4, 0, 1.7], [1.25, 5.0, 0.35, 1.3], [-1.15, 5.1, -0.5, 1.35], [0.2, 4.9, -1.3, 1.2], [-0.3, 5.0, 1.25, 1.25], [0.15, 6.5, 0.1, 1.3]];
  // a branch from the top of the trunk into every side puff
  for (let k = 1; k < puffs.length; k++) {
    const [px, py, pz] = puffs[k];
    const from = [0, trunkH - 0.25, 0], to = [px * 0.8, py - 0.3, pz * 0.8];
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    trunkParts.push(P(openCyl(0.045, 0.1, len, 5), [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], bark, 0.95, 0,
      { rot: [Math.atan2(dz, dy), 0, -Math.atan2(dx, dy)] }));
  }
  const trunk = mergeParts(trunkParts);

  const mb = new MeshBuilder();
  const center = [0, tall ? 6.3 : 5.3, 0];
  const lowY = tall ? 4.0 : 3.7, highY = tall ? 9.2 : 7.9;
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  for (const [px, py, pz, pr] of puffs) {
    // (ten smaller cards per puff instead of six big ones: the crown looks finer, not like a pile of green boards)
    const cards = 10;
    for (let i = 0; i < cards; i++) {
      const a = (i / cards) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const e = rng.range(-0.55, 1.15);
      const rad = pr * rng.range(0.4, 0.8);
      const cx = px + Math.cos(a) * Math.cos(e) * rad, cy = py + Math.sin(e) * rad * 0.8, cz = pz + Math.sin(a) * Math.cos(e) * rad;
      const size = pr * rng.range(1.1, 1.45);
      // each card looks roughly outward, with a random tilt
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-1.0, 1.0), -a + HALF_PI + rng.range(-0.8, 0.8), rng.range(0, 6.28), 'YXZ'));
      const idx = [];
      for (const [u, v] of corners) {
        const p = new THREE.Vector3(u * size, v * size, 0).applyQuaternion(q);
        p.x += cx; p.y += cy; p.z += cz;
        // normal points away from the middle of the crown = round, soft shading
        const n = new THREE.Vector3(p.x - center[0], (p.y - center[1]) * 1.1 + 0.9, p.z - center[2]).normalize();
        // lower and inner leaves are a little darker (less sky light reaches them)
        const h = Math.min(1, Math.max(0, (p.y - lowY) / (highY - lowY)));
        const shade = 0.78 + 0.34 * h;
        mb.color(shade, shade, shade * 0.94, 1);
        mb.data(0.6 + 0.6 * h, 0, 0, 0); // sways in the wind, the top more than the bottom
        idx.push(mb.vertex(p.x, p.y, p.z, n.x, n.y, n.z, u + 0.5, v + 0.5));
      }
      mb.quadIdx(idx[0], idx[1], idx[2], idx[3]);
    }
  }
  return { trunk, crown: mb.build(true) };
}

// Palm tree: a tall ringed trunk + a full crown of wide, drooping fronds.
export function makePalm(seed = 2) {
  const rng = new RNG(seed);
  const bark = [0.95, 0.92, 0.88]; // the ring picture brings the color
  const H = 10.5;
  // the trunk leans a little: stack short pieces along a soft curve
  const trunkParts = [];
  const seg = 7;
  const curve = (t) => [0.55 * t * t, H * t, 0.25 * Math.sin(t * 2.2)];
  // thick foot, slim middle, a little thicker again under the crown
  const radius = (t) => 0.2 + 0.12 * Math.exp(-t * 9) - 0.05 * t + 0.03 * smooth01((t - 0.86) / 0.14);
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg, t1 = (i + 1) / seg;
    const a = curve(t0), b = curve(t1);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    trunkParts.push(P(openCyl(radius(t1), radius(t0), len * 1.03, 8), mid, bark, 0.95, 0, { rot: [Math.atan2(dz, dy), 0, -Math.atan2(dx, dy)] }));
  }
  const top = curve(1);
  // the "boot": brown fibre ball where the fronds grow out
  trunkParts.push(P(sph(0.36, 7, 5), [top[0], top[1] + 0.05, top[2]], [0.62, 0.52, 0.4], 0.95, 0, { scale: [1, 1.25, 1] }));
  const trunk = mergeParts(trunkParts);

  const mb = new MeshBuilder();
  const fronds = 19;
  for (let k = 0; k < fronds; k++) {
    // three rings: young fronds stand up, middle ones reach out, old ones hang down
    const tier = k < 5 ? 0 : k < 13 ? 1 : 2;
    const az = k * 2.39996 + rng.range(-0.15, 0.15);       // golden angle: evenly spread
    const len = (tier === 0 ? rng.range(3.0, 3.6) : rng.range(3.8, 4.7));
    const rise = tier === 0 ? rng.range(2.6, 3.6) : tier === 1 ? rng.range(0.9, 2.0) : rng.range(-0.4, 0.5);
    const droop = tier === 0 ? rng.range(1.6, 2.4) : tier === 1 ? rng.range(2.6, 3.8) : rng.range(2.6, 3.6);
    const hx = Math.cos(az), hz = Math.sin(az);
    const S = 5;
    // the rib: goes up and out, then bends down more and more toward the tip
    const pt = (t) => new THREE.Vector3(
      top[0] + hx * len * (t - 0.12 * t * t * t), top[1] + 0.25 + rise * t - droop * Math.pow(t, 2.3), top[2] + hz * len * (t - 0.12 * t * t * t));
    const dry = tier === 2 && rng.chance(0.35); // some old fronds are yellow-brown
    for (const half of [-1, 1]) {
      let prev = null;
      for (let i = 0; i <= S; i++) {
        const t = i / S;
        const p = pt(t);
        const tan = pt(Math.min(1, t + 0.05)).sub(pt(Math.max(0, t - 0.05))).normalize();
        const sideV = new THREE.Vector3(-hz, 0, hx);
        const up = new THREE.Vector3().crossVectors(sideV, tan).normalize();
        if (up.y < 0) up.negate();
        // wide in the middle, narrow at both ends (the picture is cut the same way)
        const w = 1.02 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.9)), 0.6) * (1 - 0.3 * t) + 0.05;
        // the leaflets hang down from the rib: the frond is an upside-down "V"
        const sag = 0.28 + 0.3 * t;
        const edge = p.clone().addScaledVector(sideV, half * w * Math.cos(sag)).addScaledVector(up, -w * Math.sin(sag));
        const n = up.clone().addScaledVector(sideV, half * 0.45).normalize();
        const shade = (tier === 0 ? 1.08 : tier === 1 ? 0.98 : 0.84) + 0.1 * (1 - t);
        if (dry) mb.color(shade * 1.25, shade * 0.95, shade * 0.5, 1);
        else mb.color(shade, shade, shade * 0.93, 1);
        mb.data(t * t * 1.4, 0, 0, 0); // the tips sway in the wind
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
const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// (The cars live in src/vehicles/carModels.js.)

// ---------------------------------------------------------------------------
// MAGLEV TRAIN (two cars). It floats over the guideway and has no wheels.
// Runs along z. Length about 31 m.
// ---------------------------------------------------------------------------
export function makeTrain() {
  const white = [0.86, 0.87, 0.87], glass = [0.5, 0.47, 0.38], dark = [0.05, 0.05, 0.055], teal = [0.1, 0.4, 0.42];
  const parts = [];
  for (const cz of [-7.6, 7.6]) {
    const s = Math.sign(cz);
    parts.push(P(box(2.7, 2.1, 12.4), [0, 1.9, cz], white, 0.3, 0.45));
    parts.push(P(box(2.72, 0.12, 12.42), [0, 1.0, cz], teal, 0.35, 0.4));
    parts.push(P(box(2.74, 0.8, 11.4), [0, 2.3, cz], glass, 0.08, 0.6, { glow: 1.0 }));           // window band (lit at night)
    parts.push(P(box(3.0, 0.7, 12.6), [0, 0.55, cz], dark, 0.6, 0.5));                          // skirt that wraps the guideway
    // long rounded nose at the outer end
    parts.push(P(sph(1.0, 10, 6), [0, 1.75, cz + s * 6.4], white, 0.3, 0.45, { scale: [1.34, 1.05, 3.4] }));
    parts.push(P(sph(1.0, 8, 5), [0, 2.1, cz + s * 7.3], [0.05, 0.06, 0.07], 0.08, 0.8, { scale: [1.0, 0.62, 2.0] })); // windshield
    parts.push(P(box(1.6, 0.05, 0.06), [0, 1.2, cz + s * 9.62], [1.0, 0.97, 0.9], 0.2, 0, { glow: 1.5 }));
  }
  parts.push(P(box(2.3, 1.9, 2.9), [0, 1.9, 0], dark, 0.8, 0.2)); // joint between the two cars
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// MANNEQUIN: stand-in player with real human proportions (1.8 m tall).
// Faces +z.
// ---------------------------------------------------------------------------
export function makeMannequin() {
  const skin = [0.62, 0.46, 0.38], hair = [0.07, 0.06, 0.05];
  const jacket = [0.24, 0.25, 0.27], jeans = [0.2, 0.26, 0.38], shoe = [0.1, 0.09, 0.08], shirt = [0.55, 0.54, 0.5];
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
    P(sph(0.068, 8, 6), [0.2, 1.425, 0], jacket, cloth, 0),
    P(sph(0.068, 8, 6), [-0.2, 1.425, 0], jacket, cloth, 0),
  ];
  for (const s of [-1, 1]) {
    // arms hang down, slightly away from the body
    parts.push(P(cap(0.05, 0.24), [s * 0.235, 1.27, 0], jacket, cloth, 0, { rot: [0, 0, s * 0.1] }));
    parts.push(P(cap(0.042, 0.23), [s * 0.265, 0.99, 0.02], jacket, cloth, 0, { rot: [-0.12, 0, s * 0.06] }));
    parts.push(P(sph(0.045, 8, 6), [s * 0.275, 0.8, 0.045], skin, 0.6, 0, { scale: [0.8, 1.25, 1.0] }));
    // legs
    parts.push(P(cap(0.075, 0.33), [s * 0.095, 0.69, 0], jeans, cloth, 0));
    parts.push(P(cap(0.056, 0.36), [s * 0.1, 0.3, -0.01], jeans, cloth, 0));
    parts.push(P(sph(0.05, 8, 5), [s * 0.1, 0.042, 0.045], shoe, 0.9, 0, { scale: [1.0, 0.85, 2.7] }));
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


// ===========================================================================
// BUILDING PARTS (placed by buildingKit.js, drawn only near the player)
// ===========================================================================

// One 3D window: glass that sits inside the wall, the four sides of the
// opening, a stone sill, a stone lintel and a raised frame around it.
// The model is 1 x 1 in size; the shader stretches it to each opening and
// hides the parts a window does not have.
//   x, y = -0.5 .. 0.5 across the opening,  z = 0 is the wall face,
//   z = -1 means "at the glass" (the shader turns that into the real depth)
// Stored per corner:  aData = ( part, 0, offset x, offset y in meters )
//   part: 0 glass, 1 wall-colored sides, 2 sill, 3 lintel, 4 raised frame
export function makeWindowModule() {
  const mb = new MeshBuilder();
  const D = -1;
  // One flat piece. pts = 4 corners [x, y, z, offX, offY, shade] listed around the piece.
  const piece = (part, n, pts) => {
    // find the real place of 3 corners (for an example window) to get the winding right
    const real = pts.map((p) => [p[0] * 1.2 + p[3], p[1] * 1.6 + p[4], p[2] < 0 ? p[2] * 0.2 : p[2]]);
    const a = real[0], b = real[1], c = real[2];
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const order = cx * n[0] + cy * n[1] + cz * n[2] < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3];
    const idx = order.map((k) => {
      const q = pts[k];
      mb.color(q[5], q[5], q[5], 1);
      mb.data(part, 0, q[3], q[4]);
      return mb.vertex(q[0], q[1], q[2], n[0], n[1], n[2], q[0] + 0.5, q[1] + 0.5);
    });
    mb.quadIdx(idx[0], idx[1], idx[2], idx[3]);
  };
  // ---- glass ----
  piece(0, [0, 0, 1], [[-0.5, -0.5, D, 0, 0, 1], [0.5, -0.5, D, 0, 0, 1], [0.5, 0.5, D, 0, 0, 1], [-0.5, 0.5, D, 0, 0, 1]]);
  // ---- the four sides of the opening (darker toward the glass = soft shadow) ----
  piece(1, [1, 0, 0], [[-0.5, -0.5, 0, 0, 0, 1], [-0.5, -0.5, D, 0, 0, 0.6], [-0.5, 0.5, D, 0, 0, 0.5], [-0.5, 0.5, 0, 0, 0, 0.85]]);
  piece(1, [-1, 0, 0], [[0.5, -0.5, 0, 0, 0, 1], [0.5, -0.5, D, 0, 0, 0.6], [0.5, 0.5, D, 0, 0, 0.5], [0.5, 0.5, 0, 0, 0, 0.85]]);
  piece(1, [0, -1, 0], [[-0.5, 0.5, 0, 0, 0, 0.62], [0.5, 0.5, 0, 0, 0, 0.62], [0.5, 0.5, D, 0, 0, 0.4], [-0.5, 0.5, D, 0, 0, 0.4]]);
  piece(1, [0, 1, 0], [[-0.5, -0.5, 0, 0, 0, 1], [0.5, -0.5, 0, 0, 0, 1], [0.5, -0.5, D, 0, 0, 0.7], [-0.5, -0.5, D, 0, 0, 0.7]]);
  // ---- stone sill: sticks out 9 cm, a little wider than the opening ----
  const O = 0.09, T = 0.012, B = -0.085, W = 0.07;
  piece(2, [0, 1, 0], [[-0.5, -0.5, 0, 0, T, 1], [0.5, -0.5, 0, 0, T, 1], [0.5, -0.5, D, 0, T, 0.7], [-0.5, -0.5, D, 0, T, 0.7]]);
  piece(2, [0, 1, 0], [[-0.5, -0.5, O, -W, T, 1], [0.5, -0.5, O, W, T, 1], [0.5, -0.5, 0, W, T, 1], [-0.5, -0.5, 0, -W, T, 1]]);
  piece(2, [0, 0, 1], [[-0.5, -0.5, O, -W, B, 0.92], [0.5, -0.5, O, W, B, 0.92], [0.5, -0.5, O, W, T, 1], [-0.5, -0.5, O, -W, T, 1]]);
  piece(2, [0, -1, 0], [[-0.5, -0.5, 0, -W, B, 0.5], [0.5, -0.5, 0, W, B, 0.5], [0.5, -0.5, O, W, B, 0.6], [-0.5, -0.5, O, -W, B, 0.6]]);
  piece(2, [-1, 0, 0], [[-0.5, -0.5, 0, -W, B, 0.8], [-0.5, -0.5, O, -W, B, 0.8], [-0.5, -0.5, O, -W, T, 0.9], [-0.5, -0.5, 0, -W, T, 0.9]]);
  piece(2, [1, 0, 0], [[0.5, -0.5, 0, W, B, 0.8], [0.5, -0.5, O, W, B, 0.8], [0.5, -0.5, O, W, T, 0.9], [0.5, -0.5, 0, W, T, 0.9]]);
  // ---- stone lintel above the opening (brick houses) ----
  const LO = 0.035, LH = 0.24, LW = 0.1;
  piece(3, [0, 0, 1], [[-0.5, 0.5, LO, -LW, 0, 0.95], [0.5, 0.5, LO, LW, 0, 0.95], [0.5, 0.5, LO, LW, LH, 1], [-0.5, 0.5, LO, -LW, LH, 1]]);
  piece(3, [0, -1, 0], [[-0.5, 0.5, 0, -LW, 0, 0.5], [0.5, 0.5, 0, LW, 0, 0.5], [0.5, 0.5, LO, LW, 0, 0.55], [-0.5, 0.5, LO, -LW, 0, 0.55]]);
  piece(3, [0, 1, 0], [[-0.5, 0.5, 0, -LW, LH, 1], [0.5, 0.5, 0, LW, LH, 1], [0.5, 0.5, LO, LW, LH, 1], [-0.5, 0.5, LO, -LW, LH, 1]]);
  // ---- raised plaster frame around the opening ----
  const SO = 0.03, SW = 0.085;
  piece(4, [0, 0, 1], [[-0.5, -0.5, SO, -SW, -SW, 1], [-0.5, -0.5, SO, 0, -SW, 1], [-0.5, 0.5, SO, 0, SW, 1], [-0.5, 0.5, SO, -SW, SW, 1]]);
  piece(4, [0, 0, 1], [[0.5, -0.5, SO, 0, -SW, 1], [0.5, -0.5, SO, SW, -SW, 1], [0.5, 0.5, SO, SW, SW, 1], [0.5, 0.5, SO, 0, SW, 1]]);
  piece(4, [0, 0, 1], [[-0.5, 0.5, SO, 0, 0, 1], [0.5, 0.5, SO, 0, 0, 1], [0.5, 0.5, SO, 0, SW, 1], [-0.5, 0.5, SO, 0, SW, 1]]);
  piece(4, [0, 0, 1], [[-0.5, -0.5, SO, 0, -SW, 1], [0.5, -0.5, SO, 0, -SW, 1], [0.5, -0.5, SO, 0, 0, 1], [-0.5, -0.5, SO, 0, 0, 1]]);
  return mb.build(true);
}

// A plain box that sticks out of a wall: x = -0.5..0.5 along the wall,
// y = 0..1 up, z = 0..1 out. Stretched per copy into ledges, fins, pipes,
// steps ... The color comes from each copy.
export function makeTrimBox() {
  const g = box(1, 1, 1);
  g.translate(0, 0.5, 0.5);
  return mergeParts([P(g, [0, 0, 0], [1, 1, 1], 0.86, 0, { paint: 1 })]);
}

// Balcony, 3 m wide. The wall is at z = 0, the floor top is at y = 0.
//   slab: concrete floor + two brackets,  rail: see-through railing picture
export function makeBalcony() {
  const slab = mergeParts([
    P(box(3.0, 0.14, 1.15), [0, -0.07, 0.575], [1, 1, 1], 0.85, 0, { paint: 1 }),
    P(box(0.12, 0.2, 0.9), [-1.2, -0.24, 0.45], [1, 1, 1], 0.85, 0, { paint: 1 }),
    P(box(0.12, 0.2, 0.9), [1.2, -0.24, 0.45], [1, 1, 1], 0.85, 0, { paint: 1 }),
  ]);
  const mb = new MeshBuilder();
  const R = RAIL.bars, H = 1.05;
  mb.color(1, 1, 1, 1);
  const panel = (p0, p1, n) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / R.tile;
    mb.quad([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], H, p1[1]], [p0[0], H, p0[1]], n, [0, R.v0], [len, R.v0], [len, R.v1], [0, R.v1]);
  };
  panel([-1.48, 1.12], [1.48, 1.12], [0, 0, 1]);
  panel([-1.48, 0.02], [-1.48, 1.12], [-1, 0, 0]);
  panel([1.48, 1.12], [1.48, 0.02], [1, 0, 0]);
  return { slab, rail: mb.build(false) };
}

// Balcony with solid low walls instead of a railing (common on plaster blocks).
export function makeBalconySolid() {
  const c = [1, 1, 1], o = { paint: 1 };
  return mergeParts([
    P(box(3.0, 0.14, 1.15), [0, -0.07, 0.575], c, 0.85, 0, o),
    P(box(3.0, 0.98, 0.1), [0, 0.49, 1.1], c, 0.88, 0, o),
    P(box(0.1, 0.98, 1.05), [-1.45, 0.49, 0.525], c, 0.88, 0, o),
    P(box(0.1, 0.98, 1.05), [1.45, 0.49, 0.525], c, 0.88, 0, o),
    P(box(3.06, 0.05, 0.16), [0, 1.0, 1.1], [0.5, 0.5, 0.48], 0.8, 0),
  ]);
}

// Stoop: stairs from the sidewalk up to a front door that is 0.9 m above
// the ground. The wall is at z = 0, the stairs go down toward +z.
export function makeStoop() {
  const c = [1, 1, 1], o = { paint: 1 }, iron = [0.045, 0.045, 0.05];
  const parts = [P(box(1.7, 0.9, 0.95), [0, 0.45, 0.475], c, 0.9, 0, o)];
  for (let i = 1; i <= 4; i++) {
    const h = 0.9 - i * 0.18;
    parts.push(P(box(1.7, h, 0.28), [0, h / 2, 0.95 + (i - 0.5) * 0.28], c, 0.9, 0, o));
  }
  for (const s of [-1, 1]) {
    // low side walls, with iron hand rails on top
    parts.push(P(box(0.2, 1.25, 1.0), [s * 0.95, 0.625, 0.5], c, 0.9, 0, o));
    parts.push(P(box(0.2, 0.55, 1.12), [s * 0.95, 0.275, 1.56], c, 0.9, 0, o));
    parts.push(P(box(0.24, 0.05, 1.04), [s * 0.95, 1.275, 0.5], [0.5, 0.49, 0.46], 0.85, 0));
    parts.push(P(box(0.04, 0.04, 0.9), [s * 0.95, 1.8, 0.52], iron, 0.6, 0.75));
    parts.push(P(box(0.04, 0.04, 1.33), [s * 0.95, 1.44, 1.51], iron, 0.6, 0.75, { rot: [0.571, 0, 0] }));
    parts.push(P(box(0.035, 0.52, 0.035), [s * 0.95, 1.54, 0.1], iron, 0.6, 0.75));
    parts.push(P(box(0.035, 0.52, 0.035), [s * 0.95, 1.54, 0.95], iron, 0.6, 0.75));
    parts.push(P(box(0.035, 0.54, 0.035), [s * 0.95, 0.81, 2.06], iron, 0.6, 0.75));
  }
  return mergeParts(parts);
}

// ---- more roof things ----
export function makeRoofVent() {
  return mergeParts([
    P(cyl(0.19, 0.19, 0.5, 7), [0, 0.25, 0], GALV, 0.5, 0.8),
    P(sph(0.3, 7, 4), [0, 0.6, 0], GALV, 0.45, 0.8, { scale: [1, 0.55, 1] }),
    P(box(0.5, 0.04, 0.5), [0, 0.02, 0], [0.12, 0.12, 0.12], 0.8, 0.2),
  ]);
}
// Satellite dish on a short pole. It looks up toward -z (south).
export function makeDish() {
  const dish = new THREE.SphereGeometry(0.62, 9, 3, 0, Math.PI * 2, 0, 0.72);
  dish.translate(0, -0.62, 0); // the rim is now around the origin
  return mergeParts([
    P(cyl(0.03, 0.03, 0.9, 5), [0, 0.45, 0], GALV, 0.5, 0.8),
    P(dish, [0, 1.12, 0.12], [0.72, 0.72, 0.7], 0.55, 0.15, { rot: [2.25, 0, 0] }),
    P(box(0.03, 0.03, 0.5), [0, 1.05, -0.2], GALV, 0.5, 0.8, { rot: [-0.7, 0, 0] }),
    P(box(0.08, 0.08, 0.12), [0, 1.22, -0.4], [0.1, 0.1, 0.1], 0.5, 0.3),
  ]);
}
// Old roof aerial: a mast with a row of thin cross bars.
export function makeAntenna() {
  const parts = [P(openCyl(0.022, 0.03, 3.4, 5), [0, 1.7, 0], GALV, 0.5, 0.8), P(box(0.03, 0.03, 1.5), [0, 3.25, 0], GALV, 0.5, 0.8)];
  for (let i = 0; i < 5; i++) parts.push(P(box(1.0 - i * 0.12, 0.02, 0.02), [0, 3.25, -0.65 + i * 0.32], GALV, 0.5, 0.8));
  parts.push(P(box(0.7, 0.02, 0.02), [0, 2.6, 0], GALV, 0.5, 0.8));
  return mergeParts(parts);
}

// ---- sidewalk furniture ----
// Concrete planter box (1.3 m long). A shrub is placed on top of it.
export function makePlanter() {
  return mergeParts([
    P(box(1.3, 0.5, 0.56), [0, 0.25, 0], [0.5, 0.49, 0.46], 0.92, 0),
    P(box(1.36, 0.06, 0.62), [0, 0.5, 0], [0.56, 0.55, 0.52], 0.9, 0),
    P(box(1.18, 0.03, 0.44), [0, 0.535, 0], [0.09, 0.07, 0.05], 0.95, 0),
  ]);
}
// A small round bush made of leaf cards (uses the same leaf picture as the trees).
export function makeShrub(seed = 5) {
  const rng = new RNG(seed);
  const mb = new MeshBuilder();
  // (eleven smaller cards: a soft bush instead of a few big green boards)
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 * 2 + rng.range(-0.3, 0.3);
    const rad = i < 8 ? rng.range(0.2, 0.36) : rng.range(0.02, 0.1);
    const cx = Math.cos(a) * rad * 1.5, cz = Math.sin(a) * rad, cy = 0.4 + rng.range(-0.1, 0.18) + (i >= 8 ? 0.1 : 0);
    const size = rng.range(0.52, 0.74);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.5, 0.5), -a + HALF_PI + rng.range(-0.6, 0.6), rng.range(0, 6.28), 'YXZ'));
    const idx = [];
    for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      const p = new THREE.Vector3(u * size, v * size, 0).applyQuaternion(q);
      p.x += cx; p.y += cy; p.z += cz;
      const n = new THREE.Vector3(p.x, (p.y - 0.3) * 1.3 + 0.4, p.z).normalize();
      const shade = 0.8 + 0.3 * Math.min(1, Math.max(0, p.y / 0.8));
      mb.color(shade, shade, shade * 0.95, 1);
      mb.data(0.35, 0, 0, 0);
      idx.push(mb.vertex(p.x, Math.max(0.02, p.y), p.z, n.x, n.y, n.z, u + 0.5, v + 0.5));
    }
    mb.quadIdx(idx[0], idx[1], idx[2], idx[3]);
  }
  return mb.build(true);
}
// Weeds: a few thin leaves growing out of one point (uses the palm frond picture).
export function makeWeed(seed = 6) {
  const rng = new RNG(seed);
  const mb = new MeshBuilder();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const h = rng.range(0.45, 0.95), lean = rng.range(0.15, 0.5), w = rng.range(0.22, 0.34);
    const dx = Math.cos(a), dz = Math.sin(a);
    const sx = -dz * w * 0.5, sz = dx * w * 0.5;
    const tx = dx * lean, tz = dz * lean;
    const n = [dx * 0.5, 0.8, dz * 0.5];
    mb.color(0.8, 0.84, 0.7, 1);
    mb.data(0, 0, 0, 0); const i0 = mb.vertex(-sx, 0, -sz, n[0], n[1], n[2], 0, 0);
    const i1 = mb.vertex(sx, 0, sz, n[0], n[1], n[2], 1, 0);
    mb.color(1, 1, 0.9, 1);
    mb.data(0.6, 0, 0, 0); const i2 = mb.vertex(tx + sx, h, tz + sz, n[0], n[1], n[2], 1, 1);
    const i3 = mb.vertex(tx - sx, h, tz - sz, n[0], n[1], n[2], 0, 1);
    mb.quadIdx(i0, i1, i2, i3);
  }
  return mb.build(true);
}
// Newspaper box (the color comes from each copy). The door faces +z.
export function makeNewsBox() {
  const o = { paint: 1 };
  return mergeParts([
    P(box(0.4, 0.3, 0.3), [0, 0.15, 0], [0.07, 0.07, 0.075], 0.6, 0.5),
    P(box(0.48, 0.86, 0.42), [0, 0.73, 0], [1, 1, 1], 0.5, 0.35, o),
    P(box(0.5, 0.04, 0.44), [0, 1.18, 0], [1, 1, 1], 0.5, 0.35, o),
    P(box(0.36, 0.34, 0.015), [0, 0.86, 0.213], [0.05, 0.06, 0.07], 0.1, 0.6),
    P(box(0.3, 0.07, 0.02), [0, 0.52, 0.213], [0.75, 0.74, 0.7], 0.6, 0),
  ]);
}
// Parking meter with a small screen (near-future touch). The screen faces +z.
export function makeParkingMeter() {
  return mergeParts([
    P(openCyl(0.03, 0.035, 1.05, 6), [0, 0.525, 0], GALV, 0.5, 0.85),
    P(box(0.17, 0.3, 0.13), [0, 1.2, 0], [0.16, 0.17, 0.18], 0.45, 0.6),
    P(sph(0.09, 6, 3), [0, 1.35, 0], [0.16, 0.17, 0.18], 0.45, 0.6, { scale: [1, 0.5, 0.72] }),
    P(box(0.1, 0.08, 0.012), [0, 1.24, 0.066], [0.3, 0.8, 0.9], 0.2, 0, { glow: 1.2 }),
  ]);
}
// Street sign: a pole with two green name blades and a parking sign.
export function makeStreetSign() {
  const green = [0.04, 0.26, 0.15], white = [0.85, 0.85, 0.82];
  return mergeParts([
    P(openCyl(0.03, 0.035, 3.05, 6), [0, 1.525, 0], GALV, 0.5, 0.85),
    P(box(0.8, 0.18, 0.016), [0, 2.94, 0], green, 0.5, 0.2),
    P(box(0.56, 0.05, 0.02), [0, 2.94, 0], white, 0.5, 0),
    P(box(0.016, 0.18, 0.8), [0, 2.72, 0], green, 0.5, 0.2),
    P(box(0.02, 0.05, 0.56), [0, 2.72, 0], white, 0.5, 0),
    P(box(0.42, 0.56, 0.014), [0, 2.1, 0.04], white, 0.5, 0.1),
    P(box(0.42, 0.13, 0.018), [0, 2.3, 0.04], [0.6, 0.08, 0.06], 0.5, 0.1),
    P(box(0.26, 0.05, 0.018), [0, 2.08, 0.04], [0.1, 0.1, 0.1], 0.5, 0),
    P(box(0.3, 0.05, 0.018), [0, 1.96, 0.04], [0.1, 0.1, 0.1], 0.5, 0),
  ]);
}
// A heap of broken concrete and bricks (empty lots).
export function makeRubble() {
  const con = [0.45, 0.44, 0.41], brick = [0.36, 0.17, 0.12];
  return mergeParts([
    P(box(1.0, 0.34, 0.7), [0, 0.13, 0], con, 0.95, 0, { rot: [0.18, 0.5, 0.1] }),
    P(box(0.6, 0.3, 0.45), [0.7, 0.1, 0.35], con, 0.95, 0, { rot: [-0.2, 1.1, 0.25] }),
    P(box(0.5, 0.24, 0.55), [-0.6, 0.09, 0.3], [0.38, 0.37, 0.35], 0.95, 0, { rot: [0.3, -0.4, -0.15] }),
    P(box(0.7, 0.2, 0.4), [0.2, 0.3, -0.1], con, 0.95, 0, { rot: [0.5, 2.0, 0.3] }),
    P(box(0.22, 0.07, 0.1), [0.5, 0.05, -0.5], brick, 0.9, 0, { rot: [0, 0.7, 0] }),
    P(box(0.22, 0.07, 0.1), [-0.3, 0.05, -0.55], brick, 0.9, 0, { rot: [0, -0.3, 0.2] }),
    P(box(0.22, 0.07, 0.1), [-0.8, 0.06, -0.2], brick, 0.9, 0, { rot: [0.3, 1.3, 0] }),
    P(box(1.5, 0.025, 0.025), [0.1, 0.36, 0.2], [0.2, 0.09, 0.05], 0.8, 0.6, { rot: [0.1, 0.4, 0.3] }),
  ]);
}
// Fast charger / fuel pump for the station. The screen faces +z.
export function makeCharger() {
  return mergeParts([
    P(box(0.9, 0.12, 0.6), [0, 0.06, 0], [0.4, 0.4, 0.38], 0.9, 0),
    P(box(0.72, 1.85, 0.42), [0, 1.04, 0], [0.82, 0.83, 0.82], 0.35, 0.3),
    P(box(0.74, 0.3, 0.44), [0, 1.85, 0], [1, 1, 1], 0.4, 0.3, { paint: 1 }),
    P(box(0.44, 0.34, 0.012), [0, 1.4, 0.216], [0.25, 0.8, 0.9], 0.15, 0, { glow: 1.3 }),
    P(box(0.5, 0.03, 0.012), [0, 1.12, 0.216], [0.2, 0.95, 0.6], 0.2, 0, { glow: 1.6 }),
    P(cyl(0.035, 0.035, 0.16, 6), [0.4, 1.0, 0.05], [0.03, 0.03, 0.03], 0.6, 0.2, { rot: [0, 0, HALF_PI] }),
    P(cyl(0.022, 0.022, 0.7, 5), [0.46, 0.66, 0.05], [0.03, 0.03, 0.03], 0.7, 0),
  ]);
}


// ===========================================================================
// FUTURISTIC BUILDING PARTS (2090 style, placed by buildingKit.js)
// ===========================================================================

// Outline of a "unit" floor plan: a square with rounded corners that fits
// into -1..1 in x and z. The kit stretches it to the real size of a building.
//   rho = corner radius: 0.25 soft square, 0.55 round square, 1 = circle
// Returns points { x, z, nx, nz, s } going round (s = 0..1 along the outline).
// The first and the last point are the same (middle of the front, +z side).
export function planRing(rho, seg = 4) {
  const r = Math.min(1, Math.max(0.02, rho)), c = 1 - r;
  const pts = [{ x: 0, z: 1, nx: 0, nz: 1 }];
  // corner centers and start angles (angles go from +x toward +z)
  const corners = [[c, c, Math.PI / 2], [c, -c, 0], [-c, -c, -Math.PI / 2], [-c, c, -Math.PI]];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 - (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) });
    }
  }
  pts.push({ x: 0, z: 1, nx: 0, nz: 1 });
  let total = 0;
  pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    pts[i].s = total;
  }
  for (const p of pts) p.s /= total;
  return pts;
}

// Parts for the "panel" material: data = ( kind, roughness, metalness, glow ).
//   kind 0 smooth, 1 perforated, 2 slats, 3 seam metal, 4 solar, 5 pool
function panelParts(parts) {
  const mb = new MeshBuilder();
  for (const p of parts) {
    const c = p.color || [1, 1, 1];
    mb.color(c[0], c[1], c[2], 1);
    mb.data(p.kind || 0, p.rough ?? 0.55, p.metal ?? 0.1, p.glow ?? 0);
    const pos = p.pos || [0, 0, 0];
    mb.add(p.geom, pos[0], pos[1], pos[2], p.rot || null, p.scale ?? null);
  }
  return mb.build(true);
}

// Floor slab edge: a ring that sticks out around one floor (white trays,
// balcony bands). The building outline is at -1..1; the ring reaches from
// 0.88 (hidden inside the glass) out to 1 + out. Height 0..1 (stretched to
// the slab thickness).  wave > 0: the edge swings in and out (wave balconies).
export function makeSlabRing(rho, out = 0.06, wave = 0, phase = 0, seg = 4) {
  const ring = planRing(rho, seg);
  const mb = new MeshBuilder();
  mb.color(1, 1, 1, 1);
  mb.data(0, 0.55, 0.08, 0);
  const P = ring.map((p) => {
    const o = out + wave * (0.5 + 0.5 * Math.sin(3 * Math.atan2(p.x, p.z) + phase));
    return { ix: p.x * 0.88, iz: p.z * 0.88, ox: p.x + p.nx * o, oz: p.z + p.nz * o, nx: p.nx, nz: p.nz };
  });
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    if (Math.hypot(b.ox - a.ox, b.oz - a.oz) < 1e-5) continue;
    // top, bottom
    mb.quadAuto([a.ix, 1, a.iz], [a.ox, 1, a.oz], [b.ox, 1, b.oz], [b.ix, 1, b.iz], [0, 1, 0]);
    mb.quadAuto([a.ix, 0, a.iz], [a.ox, 0, a.oz], [b.ox, 0, b.oz], [b.ix, 0, b.iz], [0, -1, 0]);
    // rounded outer edge (smooth shading from corner to corner)
    const i0 = mb.vertex(a.ox, 0, a.oz, a.nx, 0, a.nz), i1 = mb.vertex(b.ox, 0, b.oz, b.nx, 0, b.nz);
    const i2 = mb.vertex(b.ox, 1, b.oz, b.nx, 0, b.nz), i3 = mb.vertex(a.ox, 1, a.oz, a.nx, 0, a.nz);
    mb.quadIdx(i0, i1, i2, i3);
  }
  return mb.build(true);
}

// Glass balustrade that stands on a slab ring (uses the fence / railing picture).
export function makeRailRing(rho, out = 0.05, seg = 4) {
  const ring = planRing(rho, seg);
  const mb = new MeshBuilder();
  const R = RAIL.glass;
  mb.color(1, 1, 1, 1);
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const ax = a.x + a.nx * out, az = a.z + a.nz * out, bx = b.x + b.nx * out, bz = b.z + b.nz * out;
    if (Math.hypot(bx - ax, bz - az) < 1e-5) continue;
    const i0 = mb.vertex(ax, 0, az, a.nx, 0, a.nz, a.s * 44, R.v0), i1 = mb.vertex(bx, 0, bz, b.nx, 0, b.nz, b.s * 44, R.v0);
    const i2 = mb.vertex(bx, 1, bz, b.nx, 0, b.nz, b.s * 44, R.v1), i3 = mb.vertex(ax, 1, az, a.nx, 0, a.nz, a.s * 44, R.v1);
    mb.quadIdx(i0, i1, i2, i3);
  }
  return mb.build(false);
}

// A straight piece of glass balustrade, 1 m long (x = -0.5..0.5), 1 m high.
export function makeGlassRail() {
  const mb = new MeshBuilder();
  const R = RAIL.glass;
  mb.color(1, 1, 1, 1);
  mb.quad([-0.5, 0, 0], [0.5, 0, 0], [0.5, 1, 0], [-0.5, 1, 0], [0, 0, 1], [0, R.v0], [1, R.v0], [1, R.v1], [0, R.v1]);
  return mb.build(false);
}

// RIBBON FRAMES for one flat side of a building. The side is the unit
// square x = -0.5..0.5, y = 0..1; the band sticks out z = 0..1 (stretched to
// about 0.4 m). kind: 'S' big S-curve, 'sweep' diagonal swing, 'portal' rounded frame.
export function makeFaceRibbon(kind) {
  let path, closed = false, half = 0.04;
  if (kind === 'S') path = [[-0.5, 0.0], [-0.3, 0.04], [-0.06, 0.26], [0.0, 0.5], [0.06, 0.74], [0.3, 0.96], [0.5, 1.0]];
  else if (kind === 'sweep') path = [[-0.5, 0.12], [-0.22, 0.16], [0.0, 0.5], [0.22, 0.84], [0.5, 0.88]];
  else {
    // rounded rectangle outline
    path = [];
    const w = 0.4, h0 = 0.08, h1 = 0.92, r = 0.12;
    const arc = (cx, cy, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * (Math.PI / 2); path.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6]); } };
    arc(w - r, h1 - r * 0.6, 0); arc(-w + r, h1 - r * 0.6, Math.PI / 2); arc(-w + r, h0 + r * 0.6, Math.PI); arc(w - r, h0 + r * 0.6, Math.PI * 1.5);
    closed = true;
    half = 0.03;
  }
  // smooth the path (Catmull-Rom), except the portal which is already smooth
  let pts = path;
  if (!closed) {
    pts = [];
    const n = path.length, P = (i) => path[Math.min(n - 1, Math.max(0, i))];
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < 6; k++) {
        const t = k / 6, p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
        pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    pts.push(path[n - 1]);
  } else pts = path.concat([path[0]]);
  const mb = new MeshBuilder();
  mb.color(1, 1, 1, 1);
  mb.data(0, 0.5, 0.12, 0);
  const n = pts.length;
  const edge = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    if (closed && (i === 0 || i === n - 1)) { tx = pts[1][0] - pts[n - 2][0]; ty = pts[1][1] - pts[n - 2][1]; }
    const l = Math.hypot(tx, ty) || 1;
    const mx = -ty / l, my = tx / l;
    return { lx: p[0] + mx * half, ly: p[1] + my * half, rx: p[0] - mx * half, ry: p[1] - my * half, mx, my };
  });
  for (let i = 0; i < n - 1; i++) {
    const a = edge[i], b = edge[i + 1];
    mb.quadAuto([a.lx, a.ly, 1], [a.rx, a.ry, 1], [b.rx, b.ry, 1], [b.lx, b.ly, 1], [0, 0, 1]);                 // front
    mb.quadAuto([a.lx, a.ly, 0], [a.lx, a.ly, 1], [b.lx, b.ly, 1], [b.lx, b.ly, 0], [a.mx, a.my, 0]);           // one side
    mb.quadAuto([a.rx, a.ry, 0], [a.rx, a.ry, 1], [b.rx, b.ry, 1], [b.rx, b.ry, 0], [-a.mx, -a.my, 0]);         // other side
  }
  return mb.build(true);
}

// Round helipad on a short stem. The deck is 12 m wide and 2 m above the roof.
export function makeHelipad() {
  const deck = [0.19, 0.2, 0.21], white = [0.86, 0.86, 0.83];
  const ring = new THREE.RingGeometry(4.25, 4.7, 20);
  const parts = [
    P(openCyl(1.4, 1.7, 1.7, 8), [0, 0.85, 0], [0.5, 0.51, 0.52], 0.6, 0.3),
    P(cyl(6.0, 5.5, 0.4, 18), [0, 1.87, 0], deck, 0.8, 0.1),
    P(openCyl(6.08, 6.08, 0.1, 18), [0, 2.03, 0], [0.62, 0.63, 0.64], 0.5, 0.5),
    P(ring, [0, 2.09, 0], white, 0.7, 0, { rot: [-HALF_PI, 0, 0] }),
    P(box(0.5, 0.02, 3.0), [-1.1, 2.095, 0], white, 0.7, 0),
    P(box(0.5, 0.02, 3.0), [1.1, 2.095, 0], white, 0.7, 0),
    P(box(2.2, 0.02, 0.5), [0, 2.095, 0], white, 0.7, 0),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.39;
    parts.push(P(new THREE.PlaneGeometry(0.3, 0.3), [Math.cos(a) * 5.7, 2.1, Math.sin(a) * 5.7], [0.3, 1.0, 0.5], 0.4, 0, { glow: 0.9, rot: [-HALF_PI, 0, 0] }));
  }
  return mergeParts(parts);
}

// Small drone landing pad on a mast, with a parked delivery drone.
export function makeDronePad() {
  const deck = [0.17, 0.18, 0.19];
  const ring = new THREE.RingGeometry(1.7, 1.95, 14);
  const body = [0.12, 0.13, 0.14];
  const parts = [
    P(openCyl(0.16, 0.22, 1.5, 5), [0, 0.75, 0], [0.55, 0.56, 0.57], 0.5, 0.6),
    P(cyl(2.5, 2.3, 0.22, 12), [0, 1.61, 0], deck, 0.8, 0.1),
    P(ring, [0, 1.74, 0], [0.86, 0.86, 0.83], 0.7, 0, { rot: [-HALF_PI, 0, 0] }),
    // a parked delivery drone (simple shape: body, two arms, four rotor discs)
    P(box(0.55, 0.18, 0.7), [0, 1.98, 0], body, 0.4, 0.5),
    P(box(1.5, 0.05, 0.08), [0, 2.02, 0], body, 0.4, 0.5, { rot: [0, 0.78, 0] }),
    P(box(1.5, 0.05, 0.08), [0, 2.02, 0], body, 0.4, 0.5, { rot: [0, -0.78, 0] }),
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.78;
    parts.push(P(new THREE.CircleGeometry(0.3, 6), [Math.cos(a) * 0.75, 2.1, Math.sin(a) * 0.75], [0.25, 0.25, 0.26], 0.5, 0.2, { rot: [-HALF_PI, 0, 0] }));
    parts.push(P(new THREE.PlaneGeometry(0.2, 0.2), [Math.cos(a) * 2.3, 1.74, Math.sin(a) * 2.3], [0.3, 0.85, 1.0], 0.4, 0, { glow: 0.9, rot: [-HALF_PI, 0, 0] }));
  }
  return mergeParts(parts);
}

// One 8 m piece of a glass sky bridge (runs along x). Several pieces in a row
// make a long bridge. The floor is at y = 0.
export function makeSkyBridge() {
  const L = 8, W = 3.0, H = 3.1;
  const frame = [0.62, 0.64, 0.66], glass = [0.05, 0.07, 0.09];
  const parts = [
    P(box(L, 0.32, W + 0.3), [0, -0.16, 0], frame, 0.5, 0.4),
    P(box(L, 0.26, W + 0.3), [0, H + 0.13, 0], frame, 0.5, 0.4),
    P(box(L - 0.3, 0.04, 0.3), [0, H - 0.03, 0], [1.0, 0.86, 0.66], 0.3, 0, { glow: 0.7 }),   // light strip inside
  ];
  const diag = Math.hypot(L / 2, H), ang = Math.atan2(H, L / 2);
  for (const sz of [-1, 1]) {
    parts.push(P(box(L, H, 0.05), [0, H / 2, sz * W / 2], glass, 0.08, 0.85));
    for (const x of [-L / 2, 0, L / 2]) parts.push(P(box(0.14, H, 0.14), [x, H / 2, sz * (W / 2 + 0.06)], frame, 0.5, 0.4));
    // light truss: one diagonal per 4 m
    parts.push(P(box(diag, 0.1, 0.1), [-L / 4, H / 2, sz * (W / 2 + 0.07)], frame, 0.5, 0.4, { rot: [0, 0, ang] }));
    parts.push(P(box(diag, 0.1, 0.1), [L / 4, H / 2, sz * (W / 2 + 0.07)], frame, 0.5, 0.4, { rot: [0, 0, -ang] }));
  }
  return mergeParts(parts);
}

// EV bay on a ground floor wall: a dark opening with a green light frame and
// a charger. The wall is at z = 0, the bay is 3.4 m wide.
export function makeEvBay() {
  const frame = [0.6, 0.62, 0.64], green = [0.25, 1.0, 0.55];
  return mergeParts([
    P(box(3.2, 2.75, 0.05), [0, 1.38, 0.04], [0.02, 0.022, 0.025], 0.5, 0.2),
    P(box(0.18, 2.95, 0.34), [-1.62, 1.475, 0.17], frame, 0.5, 0.4),
    P(box(0.18, 2.95, 0.34), [1.62, 1.475, 0.17], frame, 0.5, 0.4),
    P(box(3.42, 0.2, 0.34), [0, 2.95, 0.17], frame, 0.5, 0.4),
    P(box(3.0, 0.045, 0.04), [0, 2.8, 0.24], green, 0.3, 0, { glow: 1.25 }),
    P(box(0.04, 2.5, 0.04), [-1.49, 1.4, 0.24], green, 0.3, 0, { glow: 1.2 }),
    P(box(0.04, 2.5, 0.04), [1.49, 1.4, 0.24], green, 0.3, 0, { glow: 1.2 }),
    P(box(0.3, 1.25, 0.2), [1.05, 0.63, 0.3], [0.85, 0.86, 0.86], 0.35, 0.3),
    P(box(0.2, 0.12, 0.02), [1.05, 1.05, 0.41], green, 0.2, 0, { glow: 1.5 }),
  ]);
}

// Hanging plant: a few long leaves that hang down from one point (y = 0 is
// the top). Uses the palm frond picture.
export function makeVine(seed = 9) {
  // HANGING PLANTS under the edge of a planter or a balcony: thin curtains of ivy (the picture from
  // makeIvyTexture). Most hang along the wall, every third one stands across the others, so from the side they
  // never look like flat green ribbons. v = 0 at the top (where they hang from), the picture covers 2 m.
  const rng = new RNG(seed);
  const mb = new MeshBuilder();
  for (let i = 0; i < 7; i++) {
    const across = i % 3 === 2;
    const a = across ? HALF_PI + rng.range(-0.3, 0.3) : rng.range(-0.25, 0.25);   // 0 = along the wall (x)
    const len = rng.range(0.9, 2.0), w = rng.range(0.32, 0.46), lean = rng.range(0.04, 0.22);
    const dx = Math.cos(a), dz = Math.sin(a);
    const ox = rng.range(-0.55, 0.55), oz = across ? rng.range(0, 0.15) : rng.range(-0.05, 0.1), tx = ox + rng.range(-0.1, 0.1);
    const n = [0, 0.45, 0.89];                     // out from the wall and a little up: soft light, like a crown
    mb.color(0.8, 0.84, 0.76, 1);                  // the top hangs in the shade of the planter
    mb.data(0.05, 0, 0, 0);
    const i0 = mb.vertex(ox - dx * w / 2, 0, oz - dz * w / 2, n[0], n[1], n[2], 0, 0);
    const i1 = mb.vertex(ox + dx * w / 2, 0, oz + dz * w / 2, n[0], n[1], n[2], 1, 0);
    mb.color(1, 1, 0.94, 1);
    mb.data(0.75, 0, 0, 0);                        // the ends sway in the wind
    const i2 = mb.vertex(tx + dx * w / 2, -len, oz + dz * w / 2 + lean, n[0], n[1], n[2], 1, len / 2);
    const i3 = mb.vertex(tx - dx * w / 2, -len, oz - dz * w / 2 + lean, n[0], n[1], n[2], 0, len / 2);
    mb.quadIdx(i0, i1, i2, i3);
  }
  return mb.build(true);
}

// Smart street light: a slim pole with a thin bar of white light. The bar
// points to +z (the street). lampPos = where the light comes from.
export function makeSmartLight() {
  const col = [0.6, 0.62, 0.64], led = [0.92, 0.96, 1.0];
  const geometry = mergeParts([
    P(openCyl(0.15, 0.18, 0.5, 6), [0, 0.25, 0], col, 0.45, 0.7),
    P(openCyl(0.05, 0.085, 8.4, 5), [0, 4.7, 0], col, 0.45, 0.7),
    P(box(0.08, 0.05, 2.9), [0, 8.86, 1.25], col, 0.45, 0.7),
    P(box(0.055, 0.02, 2.1), [0, 8.825, 1.55], led, 0.3, 0, { glow: 1 }),
    P(box(0.14, 0.14, 0.14), [0, 8.95, -0.1], [0.08, 0.09, 0.1], 0.3, 0.6),               // sensor
    P(box(0.2, 0.04, 0.2), [0, 2.3, 0], [0.3, 0.8, 1.0], 0.3, 0, { glow: 1.15 }),          // small status light
  ]);
  return { geometry, lampPos: [0, 8.8, 1.55] };
}

// Smart mast: slim pole with small antennas, a camera and a status light.
export function makeSmartMast() {
  const col = [0.56, 0.58, 0.6];
  return mergeParts([
    P(cyl(0.14, 0.17, 0.4, 8), [0, 0.2, 0], col, 0.45, 0.7),
    P(openCyl(0.05, 0.08, 7.4, 6), [0, 4.1, 0], col, 0.45, 0.7),
    P(box(0.18, 0.7, 0.1), [0.16, 7.2, 0], [0.8, 0.81, 0.82], 0.4, 0.2),
    P(box(0.18, 0.7, 0.1), [-0.16, 7.2, 0], [0.8, 0.81, 0.82], 0.4, 0.2),
    P(box(0.1, 0.5, 0.18), [0, 6.5, 0.16], [0.8, 0.81, 0.82], 0.4, 0.2),
    P(sph(0.11, 6, 4), [0.2, 5.4, 0], [0.05, 0.05, 0.06], 0.2, 0.6),
    P(box(0.06, 0.06, 0.06), [0, 7.85, 0], [1.0, 0.2, 0.15], 0.3, 0, { glow: 1.3 }),
  ]);
}

// Flat field of solar panels for roofs: 1 x 1 m, lies at y = 0..1 (stretch to size).
export function makeSolarField() {
  const g = box(1, 1, 1);
  g.translate(0, 0.5, 0);
  return panelParts([{ geom: g, kind: 4, rough: 0.14, metal: 0.55, color: [1, 1, 1] }]);
}
