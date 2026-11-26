// ---------------------------------------------------------------------------
// garageSet.js - MACE'S GARAGE for Chapter 6, "Old Debts": the quietest place in the game.
//
// The repair bay is part of the city's buildings (g01 in src/city/heroBuildings.js). Chapter 6 shows nothing but
// this one room, at night, in the rain. So while the chapter runs the city is not drawn at all (the camera only
// sees "layer 4", like inside a house - src/interiors/interiors.js), there is no traffic and nobody in the street,
// and this set is drawn instead: the same bay, with what years of living in it leave behind -
//   * warm work lamps with a faint haze of dust in their light, a lamp on a stand by the car
//   * oil stains on the concrete, a drain, rags, a broom, an extension cord
//   * a long bench with a vice, and on its top, scratched into the wood, Theo's initials
//   * pegboards of tools, a red tool chest, the lift posts, tyres, an oil drum
//   * a radio on a shelf and a kettle with two mugs; Mace's old armchair by the door
//   * a steel cabinet: inside its open door, Theo's old photos, taped there
//   * the frame of the door to the stairs, with a child's height marks: T and N, two different heights
//   * high windows with rain running down them
//   * and THEO'S CAR (src/vehicles/theoCar.js) under its cloth, the cloth that comes off (station 1 of the repair)
//
// Everything that does not move is built with the kit of the houses (src/interiors/kit.js): one mesh per
// material, rounded edges, soft shadows under things, corners darker. The whole room is about 20 draw calls.
// Garage directions as everywhere in the story: r = to the right (seen from the door), f = toward the street,
// y = up from the floor. The bay: r -8.7 .. 0.7, f -6.7 .. 6.7, the ceiling at 4.3 m, the big door r -7.4 .. -1.6.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createBuilder, materials as kitMaterials, roomShade } from '../interiors/kit.js';
import { INTERIOR_LAYER } from '../interiors/interiors.js';
import { C, mug, jar, bottle } from '../interiors/furniture.js';
import { makeTheoCar, THEO_INFO, theoCover } from '../vehicles/theoCar.js';

export const CAR_AT = { r: -6.9, f: -3.9 };        // the middle of Theo's car (its nose to the street)
const B0 = -8.7, B1 = 0.7, F0 = -6.7, F1 = 6.7, TOP = 4.3, DR0 = -7.4, DR1 = -1.6, DH = 3.5;
// WHAT IS SOLID in the set. The city already knows the walls, the bench, the lift posts, the drum, the tyres and the
// car (src/city/heroBuildings.js); these are the set's own things, put into the city's collision grid while the
// set is shown. Boxes: [r0, f0, r1, f1, height], circles: [r, f, radius] (garage directions).
const SOLID_BOXES = [
  [-0.28, 1.53, 0.28, 1.97, 0.8],              // the cart with the kettle
  [-3.47, F0, -2.51, F0 + 0.5, 1.9],           // the steel cabinet
  [-2.32, F0, 0.32, F0 + 0.53, 2.1],           // the shelves at the back
  [-1.6, -3.25, -0.9, -2.75, 1.05],            // the red tool chest
  [-4.78, 5.03, -3.5, 5.87, 0.9],              // the armchair and the crate beside it
];
const SOLID_CIRCLES = [
  [-5.3, -6.15, 0.26],                         // the lamp on its stand (behind the car's left rear)
  [-3.53, F0 + 0.69, 0.24],                    // the open door of the cabinet
];
// THEO'S CAR FROM A FILE: when this file exists it is shown instead of the car made in code. The file uses the
// directions of every vehicle of the game (meters, +z the nose, +x the car's left, y up, the ground at y = 0). Parts
// with these names follow the repair (else they are simply there): bumper_old, bumper_new, hood (its origin on the
// hinge), air_cleaner, deck, lights (a lamp mesh that glows when the wires are joined).
export const THEO_GLB = 'assets/vehicles/theo_car.glb';

// ======================================================================= pictures drawn in code
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, repeat = false) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const rnd = (() => { let s = 77; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

// the concrete floor: grey, trowel marks, fine cracks, old oil stains
function drawConcrete(g, w, h) {
  g.fillStyle = '#6d6b66'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 90 + rnd() * 40 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.18 + rnd() * 0.25})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(30,28,26,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.3) * 30; g.lineTo(x, y); } g.stroke(); }
  // the joint lines of the slabs
  g.strokeStyle = 'rgba(40,38,35,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
}
// a dark oil stain (soft edges, a slightly brown ring)
function drawStain(g, w, h) {
  g.clearRect(0, 0, w, h);
  for (let k = 0; k < 5; k++) {
    const x = w * (0.35 + rnd() * 0.3), y = h * (0.35 + rnd() * 0.3), r = w * (0.16 + rnd() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(14,12,10,0.85)'); gr.addColorStop(0.6, 'rgba(24,20,16,0.55)'); gr.addColorStop(0.85, 'rgba(48,38,26,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
// Theo's photos: 4 x 2 small pictures with white borders, faded colours. Simple shapes, like real old photos
// seen from a few steps away: a boy with the blue car, two brothers on a curb at sunset, the car with its 7 on a
// race line, a man and two boys in this garage, a cat on the bench by the radio, the city at dusk, two faces in
// a photo booth strip, and a note in pen: DON'T SKIP.
function drawPhotos(g, w, h) {
  const cw = w / 4, ch = h / 2;
  const scenes = [
    (x, y, W, H) => { sky(x, y, W, H, '#8fb0c8', '#d9d2bc'); ground(x, y, W, H, '#5b5a55', 0.62); car(x + W * 0.48, y + H * 0.62, W * 0.42, '#2a4f86'); person(x + W * 0.22, y + H * 0.62, H * 0.28, '#3a3532'); },
    (x, y, W, H) => { sky(x, y, W, H, '#e09a5a', '#6a4a62'); ground(x, y, W, H, '#2c2626', 0.7); person(x + W * 0.38, y + H * 0.7, H * 0.26, '#1a1414', true); person(x + W * 0.56, y + H * 0.7, H * 0.22, '#1a1414', true); },
    (x, y, W, H) => { sky(x, y, W, H, '#a8b7c2', '#c9c4b4'); ground(x, y, W, H, '#3d3d40', 0.55); g.fillStyle = '#e8e4d8'; g.fillRect(x, y + H * 0.8, W, H * 0.04); car(x + W * 0.5, y + H * 0.7, W * 0.6, '#244a84', true); },
    (x, y, W, H) => { sky(x, y, W, H, '#6e6254', '#3e352c'); ground(x, y, W, H, '#4a4239', 0.68); person(x + W * 0.3, y + H * 0.68, H * 0.42, '#2e2724'); person(x + W * 0.55, y + H * 0.68, H * 0.26, '#2a3e5e'); person(x + W * 0.7, y + H * 0.68, H * 0.2, '#5a3020'); },
    (x, y, W, H) => { sky(x, y, W, H, '#5d4c3c', '#3a2e24'); g.fillStyle = '#6b4a2c'; g.fillRect(x, y + H * 0.62, W, H * 0.38); g.fillStyle = '#7a4b2a'; g.fillRect(x + W * 0.6, y + H * 0.38, W * 0.26, H * 0.24); cat(x + W * 0.36, y + H * 0.62, H * 0.3); },
    (x, y, W, H) => { sky(x, y, W, H, '#f0a868', '#3c3f66'); g.fillStyle = '#1e1e2a'; for (let i = 0; i < 9; i++) { const bw = W * (0.06 + rnd() * 0.07), bh = H * (0.15 + rnd() * 0.45); g.fillRect(x + W * (i / 9), y + H * 0.85 - bh, bw, bh); } },
    (x, y, W, H) => { g.fillStyle = '#d8d0c0'; g.fillRect(x, y, W, H); for (let i = 0; i < 2; i++) { g.fillStyle = '#8a7a68'; g.fillRect(x + W * 0.1, y + H * (0.06 + i * 0.47), W * 0.8, H * 0.42); g.fillStyle = '#3a302a'; g.beginPath(); g.arc(x + W * 0.5, y + H * (0.25 + i * 0.47), H * 0.1, 0, Math.PI * 2); g.fill(); g.fillRect(x + W * 0.32, y + H * (0.33 + i * 0.47), W * 0.36, H * 0.14); } },
    (x, y, W, H) => { g.fillStyle = '#ece6d4'; g.fillRect(x, y, W, H); g.strokeStyle = 'rgba(60,80,140,0.25)'; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x, y + (H * i) / 6); g.lineTo(x + W, y + (H * i) / 6); g.stroke(); } g.fillStyle = '#1d2a6a'; g.font = `bold ${Math.round(H * 0.2)}px serif`; g.textAlign = 'center'; g.fillText("DON'T", x + W / 2, y + H * 0.45); g.fillText('SKIP', x + W / 2, y + H * 0.72); },
  ];
  function sky(x, y, W, H, a, b) { const gr = g.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, W, H); }
  function ground(x, y, W, H, c, at) { g.fillStyle = c; g.fillRect(x, y + H * at, W, H * (1 - at)); }
  function car(cx, cy, len, c, side = false) {
    g.fillStyle = c; g.beginPath(); g.moveTo(cx - len / 2, cy); g.lineTo(cx - len / 2, cy - len * 0.14); g.lineTo(cx - len * 0.12, cy - len * 0.17); g.lineTo(cx + len * 0.02, cy - len * 0.29); g.lineTo(cx + len * 0.22, cy - len * 0.29); g.lineTo(cx + len * 0.36, cy - len * 0.17); g.lineTo(cx + len / 2, cy - len * 0.13); g.lineTo(cx + len / 2, cy); g.closePath(); g.fill();
    g.fillStyle = '#141414'; for (const k of [-0.3, 0.32]) { g.beginPath(); g.arc(cx + len * k, cy, len * 0.09, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#e8e6dc'; g.beginPath(); g.arc(cx - len * 0.02, cy - len * 0.08, len * 0.05, 0, Math.PI * 2); g.fill();
    if (side) { g.fillStyle = '#111'; g.font = `bold ${Math.round(len * 0.07)}px sans-serif`; g.textAlign = 'center'; g.fillText('7', cx - len * 0.02, cy - len * 0.055); }
  }
  function person(cx, base, hgt, c, sitting = false) {
    g.fillStyle = c; g.beginPath(); g.arc(cx, base - hgt * (sitting ? 0.78 : 0.9), hgt * 0.1, 0, Math.PI * 2); g.fill();
    g.fillRect(cx - hgt * 0.12, base - hgt * (sitting ? 0.68 : 0.8), hgt * 0.24, hgt * (sitting ? 0.42 : 0.45));
    if (!sitting) { g.fillRect(cx - hgt * 0.1, base - hgt * 0.36, hgt * 0.08, hgt * 0.36); g.fillRect(cx + hgt * 0.02, base - hgt * 0.36, hgt * 0.08, hgt * 0.36); }
    else g.fillRect(cx - hgt * 0.12, base - hgt * 0.28, hgt * 0.34, hgt * 0.1);
  }
  function cat(cx, base, hgt) { g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(cx, base - hgt * 0.3, hgt * 0.32, hgt * 0.26, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx + hgt * 0.1, base - hgt * 0.68, hgt * 0.15, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(cx, base - hgt * 0.78); g.lineTo(cx + hgt * 0.04, base - hgt * 0.95); g.lineTo(cx + hgt * 0.1, base - hgt * 0.8); g.fill(); g.beginPath(); g.moveTo(cx + hgt * 0.14, base - hgt * 0.8); g.lineTo(cx + hgt * 0.2, base - hgt * 0.95); g.lineTo(cx + hgt * 0.24, base - hgt * 0.76); g.fill(); }
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * cw, y = Math.floor(i / 4) * ch, m = cw * 0.06;
    g.fillStyle = '#f4f1e8'; g.fillRect(x, y, cw, ch);
    scenes[i](x + m, y + m, cw - 2 * m, ch - 2 * m * (i === 7 ? 1 : 2.2));
    // faded: a warm wash over the colours, a soft dark corner
    g.fillStyle = 'rgba(240,200,140,0.16)'; g.fillRect(x + m, y + m, cw - 2 * m, ch - 2 * m * (i === 7 ? 1 : 2.2));
  }
}
// the slats of the roller door: a light top edge, a groove, a little rust at the bottom of each
function drawRibs(g, w, h) {
  const n = 16, sh = h / n;
  for (let i = 0; i < n; i++) {
    const y = i * sh;
    const gr = g.createLinearGradient(0, y, 0, y + sh);
    gr.addColorStop(0, '#d8dbde'); gr.addColorStop(0.12, '#b9bdc1'); gr.addColorStop(0.7, '#8c9095'); gr.addColorStop(0.86, '#5c6064'); gr.addColorStop(1, '#3a3d40');
    g.fillStyle = gr; g.fillRect(0, y, w, sh);
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(110, 70, 40, ${0.05 + rnd() * 0.12})`; g.fillRect(rnd() * w, y + sh * (0.75 + rnd() * 0.2), 2 + rnd() * 8, 1 + rnd() * 2); }
  }
}
// the street light that comes in under the door: bright at the door, gone a meter in
function drawLeak(g, w, h) {
  const gr = g.createLinearGradient(0, h, 0, 0);
  gr.addColorStop(0, 'rgba(150, 170, 205, 0.85)'); gr.addColorStop(0.18, 'rgba(120, 140, 175, 0.35)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
// the door frame with the height marks: pencil lines, the letter and the age (T higher than N at the same age)
function drawMarks(g, w, h) {
  g.fillStyle = '#d6cfbf'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,110,95,${rnd() * 0.12})`; g.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 6); }
  // h = 2.1 m of frame: y in pixels from the bottom = height / 2.1 * h
  const at = (m) => h - (m / 2.1) * h;
  const mark = (m, label, side) => {
    g.strokeStyle = 'rgba(40,40,46,0.85)'; g.lineWidth = 2.2;
    const y = at(m);
    g.beginPath(); g.moveTo(side < 0 ? 4 : w * 0.35, y); g.lineTo(side < 0 ? w * 0.65 : w - 4, y); g.stroke();
    g.fillStyle = 'rgba(40,40,46,0.9)'; g.font = `${Math.round(w * 0.22)}px sans-serif`; g.textAlign = side < 0 ? 'left' : 'right';
    g.fillText(label, side < 0 ? 4 : w - 4, y - 4);
  };
  for (const [m, a] of [[1.12, 6], [1.27, 8], [1.4, 10], [1.53, 12], [1.67, 14]]) mark(m, 'T ' + a, -1);
  for (const [m, a] of [[1.02, 5], [1.18, 7], [1.3, 9], [1.42, 11]]) mark(m, 'N ' + a, 1);
}
// Theo's initials scratched into the bench: T.C., the cuts lighter than the old wood, a little crooked
function drawInitials(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.font = `bold ${Math.round(h * 0.7)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(w / 2, h / 2); g.rotate(-0.06);
  g.strokeStyle = 'rgba(205,170,120,0.85)'; g.lineWidth = 3; g.strokeText('T.C.', 0, 0);
  g.strokeStyle = 'rgba(40,24,12,0.9)'; g.lineWidth = 1.4; g.strokeText('T.C.', 1, 1);
  g.restore();
}
// the pegboard: holes on a pale brown board, the painted outlines of the tools
function drawPegboard(g, w, h) {
  g.fillStyle = '#a88f6c'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(40,30,20,0.85)';
  for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(30,30,30,0.5)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) { const x = 30 + i * 52; g.strokeRect(x, 40, 14, 90 + (i % 3) * 20); }
}
// the night outside the high windows: dark blue, a few blurred street lights
function drawNight(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#070b12'); gr.addColorStop(0.6, '#0e1520'); gr.addColorStop(1, '#2a2418'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // the glow of a street lamp somewhere below the window, blurred by the rain
  for (const [x, r, a] of [[w * 0.3, h * 0.9, 0.35], [w * 0.78, h * 0.7, 0.22]]) {
    const gl = g.createRadialGradient(x, h, 0, x, h, r); gl.addColorStop(0, `rgba(255,170,90,${a})`); gl.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, h);
  }
}

// ======================================================================= shaders
// RAIN ON GLASS: drops that slide down and leave a wet trail; a few sit still. Used on the high windows and on a
// pane in front of the camera ("through the window").
export const RAIN_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
export const RAIN_FS = `
uniform float uTime; uniform vec2 uScale; uniform float uOpacity; uniform vec3 uTint; uniform float uSoft;
varying vec2 vUv;
float h1( float n ) { return fract( sin( n ) * 43758.5453 ); }
float h2( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
// One drop of water on glass is a tiny lens, not a grey or white dot: it is mostly clear; it shows the room upside
// down (dark at its top, the warm light low in it), it has a thin dark edge and one very small bright spot.
// d: the point from the middle of the drop, r: its size (both in uv units). acc: color (premultiplied) and amount.
void drop( vec2 d, float r, inout vec4 acc ) {
  vec2 q = d / r; q.y *= 1.08;
  float l = length( q );
  if ( l > 1.15 ) return;
  float body = 1.0 - smoothstep( 0.84 - uSoft * 0.25, 1.0, l );
  float rim = smoothstep( 0.62, 0.97, l ) * body;
  float low = clamp( 0.5 - q.y * 0.6, 0.0, 1.0 );
  float spec = 1.0 - smoothstep( 0.0, 0.12 + uSoft * 0.08, length( q - vec2( -0.32, 0.42 ) ) );
  float aB = 0.16 * body, aR = 0.36 * rim, aS = 0.7 * spec * body;
  vec4 c = vec4( uTint * 1.15 * low * aB, aB );
  c = c * ( 1.0 - aR ) + vec4( 0.0, 0.0, 0.0, aR );
  c = c * ( 1.0 - aS ) + vec4( uTint * 1.8 * aS, aS );
  if ( c.a > acc.a ) acc = c;
}
void main() {
  vec2 uv = vUv * uScale;
  vec4 acc = vec4( 0.0 );
  // drops that sit still: two sizes in a loose grid, not in every place, each its own size
  for ( int k = 0; k < 2; k++ ) {
    float n = k == 0 ? 6.0 : 11.0;
    vec2 g = uv * n + float( k ) * 4.3;
    vec2 cell = floor( g );
    float h = h2( cell + float( k ) * 19.0 );
    if ( h > ( k == 0 ? 0.62 : 0.5 ) ) {
      vec2 off = ( vec2( h2( cell + 3.1 ), h2( cell + 7.7 ) ) - 0.5 ) * 0.5;
      float r = ( k == 0 ? 0.2 : 0.17 ) * ( 0.35 + 0.65 * h2( cell + 11.3 ) );
      drop( ( fract( g ) - 0.5 - off ) / n, r / n, acc );
    }
  }
  // drops that run down: not every line has one at every turn; each leaves a thin wet trail that fades (a little
  // darker, with a fine line of light along one side), with a few small beads left on it, and wanders a little
  for ( int k = 0; k < 2; k++ ) {
    float n = k == 0 ? 4.0 : 6.5;
    vec2 g = uv + float( k ) * 2.9;
    float col = floor( g.x * n );
    float sp = 0.05 + h1( col * 1.3 + float( k ) * 9.0 ) * 0.12;
    float t = g.y * 0.55 + uTime * sp + h1( col * 1.7 );
    float cyc = floor( t ), y = fract( t );
    if ( h1( col * 5.3 + cyc * 1.31 + float( k ) * 2.0 ) > 0.45 ) {
      float cx = ( col + 0.5 + ( h1( col * 3.1 + cyc ) - 0.5 ) * 0.5 ) / n;
      float x = g.x - cx - sin( ( g.y + cyc ) * 13.0 + col ) * 0.004;
      float up = ( y - 0.08 ) / 0.55;                     // (above the head is up the glass)
      float r = 0.03 + 0.02 * h1( col * 7.7 + cyc );
      drop( vec2( x, up ), r, acc );
      float L = 0.12 + 0.22 * h1( col * 2.3 + cyc );
      if ( up > 0.0 && up < L ) {
        float w = r * 0.32 * ( 1.0 - up / L * 0.6 );
        float tr = ( 1.0 - smoothstep( w * 0.5, w, abs( x ) ) ) * ( 1.0 - up / L );
        float line = ( 1.0 - smoothstep( 0.0, w * 0.3, abs( x + w * 0.45 ) ) ) * tr;
        vec4 c = vec4( 0.0, 0.0, 0.0, 0.1 * tr );
        c = c * ( 1.0 - 0.17 * line ) + vec4( uTint * 1.2 * 0.17 * line, 0.17 * line );
        if ( c.a > acc.a ) acc = c;
        float bead = floor( up * 30.0 );
        if ( h1( bead + col * 3.7 + cyc * 5.1 ) > 0.8 ) drop( vec2( x, ( fract( up * 30.0 ) - 0.5 ) / 30.0 ), r * 0.25, acc );
      }
    }
  }
  gl_FragColor = vec4( acc.rgb / max( acc.a, 0.001 ), acc.a * uOpacity );
}`;
// DUST in the lamp light: tiny specks drifting slowly in a box under each lamp
const DUST_VS = `
uniform float uTime; uniform float uSize; attribute vec3 aRand; attribute vec3 aAxis; varying float vA;
void main() {
  vec3 p = position;
  p.x += sin( uTime * 0.13 + aRand.x * 40.0 ) * 0.25;
  p.y = mod( p.y + uTime * ( 0.012 + aRand.y * 0.02 ), 2.6 );
  p.z += cos( uTime * 0.11 + aRand.z * 30.0 ) * 0.25;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * ( 0.6 + aRand.x * 0.8 ) / max( 0.6, -mv.z );
  // seen only inside the cone of light (the cone is 0.2 wide at the lamp, 1.25 at the floor)
  float k = clamp( p.y / aAxis.y, 0.0, 1.0 );
  float coneR = mix( 1.25, 0.2, k );
  float inCone = 1.0 - smoothstep( coneR * 0.7, coneR, length( p.xz - aAxis.xz ) );
  vA = ( 0.35 + 0.65 * aRand.z ) * inCone * smoothstep( 0.7, 1.6, -mv.z );
}`;
// the HAZE in a lamp's cone: brightest through the middle of the cone and near the lamp, nothing at its edges, and
// none close to the camera (so the picture never turns milky when the camera stands in the light)
const HAZE_VS = `
attribute float aH; varying float vH; varying float vFace; varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vec3 n = normalize( normalMatrix * normal );
  vFace = abs( dot( n, normalize( -mv.xyz ) ) );
  vH = aH; vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const HAZE_FS = `
uniform vec3 uColor; uniform float uOpacity; varying float vH; varying float vFace; varying float vDist;
void main() {
  float a = pow( vFace, 1.6 ) * mix( 0.22, 1.0, vH * vH ) * smoothstep( 0.0, 0.18, vH ) * smoothstep( 0.6, 2.4, vDist );
  gl_FragColor = vec4( uColor, a * uOpacity );
}`;
const DUST_FS = `uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length( c ); if ( d > 0.5 ) discard; gl_FragColor = vec4( uColor, ( 1.0 - d * 2.0 ) * vA * uOpacity ); }`;

// ======================================================================= THE SET
// G: { scene, renderer, camera, GARAGE, mats (the city's materials: the wheels), quality }
export function createGarageSet(G) {
  const { scene, renderer, camera, GARAGE } = G;
  let root = null, built = null, active = false, time = 0;
  const lightsOn = { car: 1, bench: 1, stand: 1 };

  // the room's reflections: a dark room with three small warm lamps and the cold windows (for the car's paint and
  // glass, the metal). A real garage at night is dark: the paint shows the lamps as a few bright streaks, not a
  // bright studio all round
  function makeEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    const basic = (r, g, b, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side });
    const box = new THREE.Mesh(new THREE.BoxGeometry(14, 4.2, 12), basic(0.03, 0.024, 0.019, THREE.BackSide));
    box.position.y = 1.4; sc.add(box);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), basic(0.018, 0.016, 0.013));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.6; sc.add(floor);
    // the three lamps (the one over the car the brightest), warm
    for (const [x, z, w, k] of [[0, 0, 0.55, 6], [4.2, 2.0, 0.4, 4], [-2.4, 3.1, 0.3, 3]]) {
      const q = new THREE.Mesh(new THREE.CircleGeometry(w, 20), basic(1.0 * k, 0.74 * k, 0.46 * k, THREE.DoubleSide));
      q.rotation.x = Math.PI / 2; q.position.set(x, 3.3, z); sc.add(q);
    }
    // the high windows: dim, cold
    const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.55), basic(0.05, 0.068, 0.1, THREE.DoubleSide));
    win.position.set(-1, 2.55, -5.95); sc.add(win);
    // the light of the bench on the wall behind it: a soft warm patch
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), basic(0.32, 0.22, 0.13, THREE.DoubleSide));
    patch.position.set(6.95, 1.6, 1.5); patch.rotation.y = -Math.PI / 2; sc.add(patch);
    const env = pm.fromScene(sc, 0.02).texture;
    pm.dispose();
    sc.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return env;
  }

  function build() {
    const M = kitMaterials(renderer);
    const env = makeEnv();
    root = new THREE.Group();
    root.name = 'garageSet';
    const o = GARAGE.at(0, 0, 0);
    root.position.set(o[0], GARAGE.curb || 0, o[2]);
    root.rotation.y = GARAGE.rot;
    const B = createBuilder([0, 0, 0], 61);
    // the set's own materials (the kit's are shared with the houses and keep their settings)
    const own = {
      concrete: new THREE.MeshStandardMaterial({ map: tex(cv(512, 512, drawConcrete), true), roughness: 0.86, metalness: 0, envMap: env, envMapIntensity: 0.25 }),
      stain: new THREE.MeshBasicMaterial({ map: tex(cv(256, 256, drawStain)), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      photos: new THREE.MeshStandardMaterial({ map: tex(cv(1024, 512, drawPhotos)), roughness: 0.5, metalness: 0, side: THREE.DoubleSide }),
      marks: new THREE.MeshStandardMaterial({ map: tex(cv(96, 512, drawMarks)), roughness: 0.8 }),
      initials: new THREE.MeshStandardMaterial({ map: tex(cv(256, 128, drawInitials)), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      peg: new THREE.MeshStandardMaterial({ map: tex(cv(512, 256, drawPegboard)), roughness: 0.85 }),
      night: new THREE.MeshBasicMaterial({ map: tex(cv(256, 128, drawNight)) }),
      rain: new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: new THREE.Vector2(2, 1) }, uOpacity: { value: 0.75 }, uTint: { value: new THREE.Color(0.6, 0.66, 0.75) }, uSoft: { value: 0.2 } }, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false }),
    };
    // (copies of the kit's materials: the houses keep theirs. The copies keep the dark corners of the kit, and
    //  reflect the warm garage, not the studio room of the houses)
    const MM = {};
    for (const [k, m] of Object.entries(M)) { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; MM[k] = c; }
    for (const k of ['wood', 'paint', 'metal', 'gloss', 'cloth', 'plaster', 'wallpaint']) { MM[k].envMap = env; MM[k].envMapIntensity = 0.35; }
    const meshes = [];
    const addMesh = (geo, mat, cast = false) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; root.add(m); meshes.push(m); return m; };

    // ---------------- the shell: floor, walls, ceiling, beams ----------------
    {
      const g = new THREE.PlaneGeometry(B1 - B0, F1 - F0 + 0.6);
      g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.4, uv.getY(i) * 3.4);
      const floor = addMesh(g, own.concrete);
      floor.position.set((B0 + B1) / 2, 0.001, (F0 + F1 + 0.6) / 2);
    }
    const WALL = C('#9aa09a'), LOWER = C('#4b5a55'), CEIL = C('#3a3a3c');
    const wall = (p0, p1, p2, p3, n, color = WALL) => B.plane('wallpaint', [p0, p1, p2, p3], n, 2.2, color);
    // the back wall, the left wall (around the high window), the right wall (around the door to the stairs), the front
    wall([B0, 0, F0], [B1, 0, F0], [B1, TOP, F0], [B0, TOP, F0], [0, 0, 1]);
    const W0 = -5.0, W1 = -1.0, WY0 = 2.55, WY1 = 3.4;            // the high window in the left wall
    wall([B0, 0, F0], [B0, 0, F1], [B0, WY0, F1], [B0, WY0, F0], [1, 0, 0]);
    wall([B0, WY1, F0], [B0, WY1, F1], [B0, TOP, F1], [B0, TOP, F0], [1, 0, 0]);
    wall([B0, WY0, F0], [B0, WY0, W0], [B0, WY1, W0], [B0, WY1, F0], [1, 0, 0]);
    wall([B0, WY0, W1], [B0, WY0, F1], [B0, WY1, F1], [B0, WY1, W1], [1, 0, 0]);
    const D0 = -6.05, D1 = -5.15, DTOP = 2.1;                       // the door to the stairs in the right wall
    wall([B1, 0, F0], [B1, 0, D0], [B1, TOP, D0], [B1, TOP, F0], [-1, 0, 0]);
    wall([B1, 0, D1], [B1, 0, F1], [B1, TOP, F1], [B1, TOP, D1], [-1, 0, 0]);
    wall([B1, DTOP, D0], [B1, DTOP, D1], [B1, TOP, D1], [B1, TOP, D0], [-1, 0, 0]);
    wall([B0, 0, F1], [DR0, 0, F1], [DR0, TOP, F1], [B0, TOP, F1], [0, 0, -1]);
    wall([DR1, 0, F1], [B1, 0, F1], [B1, TOP, F1], [DR1, TOP, F1], [0, 0, -1]);
    wall([DR0, DH, F1], [DR1, DH, F1], [DR1, TOP, F1], [DR0, TOP, F1], [0, 0, -1]);
    // a darker painted band on the lower walls (years of hands, tyres and mops)
    const band = (a, b, n) => B.plane('paint', [a, b, [b[0], 1.05, b[2]], [a[0], 1.05, a[2]]], n, 1, LOWER);
    band([B0 + 0.003, 0, F0], [B0 + 0.003, 0, F1], [1, 0, 0]);
    band([B0, 0, F0 + 0.003], [B1, 0, F0 + 0.003], [0, 0, 1]);
    band([B1 - 0.003, 0, F0], [B1 - 0.003, 0, D0], [-1, 0, 0]);
    band([B1 - 0.003, 0, D1], [B1 - 0.003, 0, F1], [-1, 0, 0]);
    // the ceiling: the underside of the metal roof (dark ribs) and steel beams across
    B.plane('metal', [[B0, TOP, F0], [B1, TOP, F0], [B1, TOP, F1], [B0, TOP, F1]], [0, -1, 0], 1, CEIL);
    for (let f = F0 + 0.6; f < F1; f += 0.42) B.box('metal', (B0 + B1) / 2, TOP - 0.05, f, B1 - B0, 0.05, 0.05, C('#2c2d30'), { r: 0.006 });
    for (let f = F0 + 1.4; f < F1; f += 2.6) {
      B.box('metal', (B0 + B1) / 2, TOP - 0.34, f, B1 - B0, 0.3, 0.08, C('#40464a'), { r: 0.008 });
      B.box('metal', (B0 + B1) / 2, TOP - 0.36, f, B1 - B0, 0.025, 0.2, C('#40464a'), { r: 0.005 });
    }
    // a pipe along the back wall, a cable tray
    B.cyl('metal', (B0 + B1) / 2, 3.6, F0 + 0.18, 0.045, 0.045, B1 - B0, C('#6e6a62'), 10, [0, 0, Math.PI / 2]);

    // ---------------- the high window in the left wall: the night outside, the rain on the glass ----------------
    {
      const frameC = C('#2b2c2e');
      B.box('metal', B0 + 0.06, WY0 - 0.06, (W0 + W1) / 2, 0.14, 0.06, W1 - W0 + 0.12, frameC, { r: 0.01 });
      B.box('metal', B0 + 0.06, WY1, (W0 + W1) / 2, 0.14, 0.06, W1 - W0 + 0.12, frameC, { r: 0.01 });
      for (let k = 0; k <= 4; k++) B.box('metal', B0 + 0.05, WY0, W0 + (k * (W1 - W0)) / 4, 0.1, WY1 - WY0, 0.05, frameC, { r: 0.008 });
      const view = new THREE.PlaneGeometry(W1 - W0, WY1 - WY0);
      const vm = addMesh(view, own.night);
      vm.position.set(B0 - 0.2, (WY0 + WY1) / 2, (W0 + W1) / 2); vm.rotation.y = Math.PI / 2;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(W1 - W0, WY1 - WY0), own.rain);
      glass.position.set(B0 + 0.03, (WY0 + WY1) / 2, (W0 + W1) / 2); glass.rotation.y = Math.PI / 2; glass.renderOrder = 6;
      root.add(glass); meshes.push(glass);
      own.rain.uniforms.uScale.value.set(10, 2.2);                  // (about 2.5 to the meter both ways: drops of a centimeter)
    }

    // ---------------- the bench along the right wall, Theo's initials in its top ----------------
    const WOOD = C('#7a5a3c'), STEEL = C('#3c4044'), RED = C('#8e1f18');
    B.box('wood', 0.215, 0.86, -1.7, 0.92, 0.065, 5.0, WOOD, { r: 0.008, uv: [1, 5] });
    for (const f of [-4.1, -1.7, 0.7]) for (const r of [-0.18, 0.62]) B.box('metal', r, 0, f, 0.05, 0.86, 0.05, STEEL, { r: 0.006 });
    B.box('wood', 0.215, 0.24, -1.7, 0.86, 0.03, 4.9, C('#5d4430'), { r: 0.005 });
    B.box('metal', 0.215, 0.5, -1.7, 0.03, 0.03, 4.9, STEEL, { r: 0.004 });
    // the vice at the near end
    B.box('metal', -0.15, 0.925, -3.85, 0.2, 0.12, 0.16, C('#2f4a6a'), { r: 0.012 });
    B.box('metal', -0.28, 0.95, -3.85, 0.1, 0.06, 0.12, C('#2f4a6a'), { r: 0.01 });
    B.cyl('metal', -0.38, 0.97, -3.85, 0.008, 0.008, 0.26, C('#b8b8b0'), 8, [0, 0, Math.PI / 2]);
    // on the bench: a can of brushes, an oily rag, a box of bolts, two spanners
    B.cyl('metal', 0.45, 0.925, -2.9, 0.07, 0.07, 0.16, C('#9a8a5a'), 14);
    for (let i = 0; i < 4; i++) B.cyl('wood', 0.43 + (i % 2) * 0.04, 1.0, -2.92 + (i - 1.5) * 0.02, 0.008, 0.008, 0.2, C('#c9a46a'), 6, [0.12 * (i - 1.5), 0, 0.1]);
    B.box('cloth', 0.05, 0.925, -0.6, 0.32, 0.03, 0.24, C('#7a6a52'), { r: 0.012, rot: 0.4 });
    B.box('paint', 0.42, 0.925, -0.2, 0.26, 0.09, 0.18, RED, { r: 0.01 });
    for (const [f, rot, len] of [[-2.2, 0.3, 0.24], [-2.0, -0.2, 0.2]]) B.box('metal', 0.1, 0.925, f, len, 0.012, 0.035, C('#c4c6c8'), { r: 0.005, rot });
    // T.C. scratched into the wood
    {
      const g = new THREE.PlaneGeometry(0.22, 0.11); g.rotateX(-Math.PI / 2); g.rotateY(-Math.PI / 2);
      const m = addMesh(g, own.initials);
      m.position.set(0.12, 0.926, -1.3);
    }

    // ---------------- the pegboard of tools over the bench ----------------
    {
      const g = new THREE.PlaneGeometry(4.0, 1.1);
      const m = addMesh(g, own.peg);
      m.position.set(B1 - 0.012, 1.7, -1.75); m.rotation.y = -Math.PI / 2;
      // spanners in a row (big to small), screwdrivers, a hammer, pliers, a saw
      for (let i = 0; i < 7; i++) {
        const len = 0.34 - i * 0.03, f = -3.55 + i * 0.12;
        B.box('metal', B1 - 0.03, 1.32, f, 0.012, len, 0.028, C('#c4c6c8'), { r: 0.006 });
        B.cyl('metal', B1 - 0.03, 1.32 + len - 0.02, f, 0.022, 0.022, 0.012, C('#c4c6c8'), 10, [0, 0, Math.PI / 2]);
      }
      for (let i = 0; i < 5; i++) {
        const f = -2.55 + i * 0.1;
        B.cyl('paint', B1 - 0.05, 1.55, f, 0.016, 0.016, 0.12, [C('#b8291e'), C('#d8a21a'), C('#244a8a'), C('#1d1d1f'), C('#b8291e')][i], 8);
        B.cyl('metal', B1 - 0.05, 1.37, f, 0.004, 0.004, 0.18, C('#d0d2d4'), 6);
      }
      B.box('wood', B1 - 0.05, 1.45, -1.85, 0.03, 0.32, 0.035, C('#8a6a44'), { r: 0.008 });
      B.box('metal', B1 - 0.05, 1.74, -1.85, 0.05, 0.05, 0.16, C('#3a3a3c'), { r: 0.01 });
      for (const k of [-0.025, 0.025]) B.box('metal', B1 - 0.04, 1.4, -1.5 + k, 0.012, 0.22, 0.02, C('#5a2a20'), { r: 0.006, roll: k * 4 });
      B.box('metal', B1 - 0.03, 1.35, -0.6, 0.008, 0.18, 0.62, C('#9ca0a4'), { r: 0.004 });
      B.box('wood', B1 - 0.04, 1.35, -0.25, 0.03, 0.2, 0.14, C('#6a4a2c'), { r: 0.01 });
    }

    // ---------------- the radio on its shelf, the kettle on a little cart ----------------
    B.box('wood', B1 - 0.14, 1.52, 1.55, 0.26, 0.035, 1.1, C('#5a4130'), { r: 0.006 });
    for (const f of [1.1, 2.0]) B.box('metal', B1 - 0.05, 1.42, f, 0.03, 0.1, 0.03, STEEL, { r: 0.004 });
    // (the radio itself is a part of its own: it can be switched on and off, see radio below)
    B.box('metal', -0.0, 0, 1.75, 0.55, 0.76, 0.42, C('#5f6b70'), { r: 0.02 });                 // the cart
    B.box('metal', -0.0, 0.25, 1.75, 0.5, 0.02, 0.38, C('#4a5458'), { r: 0.006 });
    B.box('metal', 0.08, 0.76, 1.68, 0.24, 0.035, 0.22, C('#1c1c1e'), { r: 0.012 });              // the hot plate
    mug(B, -0.14, 0.76, 1.62, C('#d8d2c4'), 0.6);
    mug(B, -0.12, 0.76, 1.86, C('#3a5a7a'), 2.2);
    jar(B, -0.02, 0.76, 1.92, C('#4a3020'), 0.8);
    bottle(B, 0.18, 0.76, 1.92, C('#6a5a2a'), 0.7);

    // ---------------- the steel cabinet at the back, open: Theo's photos inside its door ----------------
    {
      const r0 = -3.45, f0 = F0 + 0.02, w = 0.92, d = 0.45, h = 1.9, GREEN = C('#4b5c52');
      B.box('paint', r0 + w / 2, 0, f0 + d / 2, w, h, d, GREEN, { r: 0.012 });
      // the inside (darker) with two shelves, boxes and a jar of bolts
      B.box('paint', r0 + w / 2, 0.06, f0 + d / 2 + 0.02, w - 0.04, h - 0.1, d - 0.02, C('#2d3530'), { r: 0.006 });
      for (const y of [0.62, 1.22]) B.box('metal', r0 + w / 2, y, f0 + d / 2 + 0.02, w - 0.06, 0.02, d - 0.06, C('#556058'), { r: 0.004 });
      B.box('paint', r0 + 0.25, 0.64, f0 + 0.22, 0.3, 0.22, 0.28, C('#8a6a40'), { r: 0.01 });
      B.box('paint', r0 + 0.65, 1.24, f0 + 0.22, 0.24, 0.16, 0.26, C('#6a2a24'), { r: 0.01 });
      jar(B, r0 + 0.62, 0.64, f0 + 0.24, C('#7a7a70'), 0.9);
      // the open left door, turned out into the room (about 110 degrees)
      // (closed, the leaf lies across the left half of the front; open, it has swung out into the room and its
      //  inside, with the photos, looks toward the bench)
      const hingeR = r0 + 0.01, hingeF = f0 + d;
      const door = new THREE.Group();
      door.position.set(hingeR, 0, hingeF); door.rotation.y = -1.9;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w / 2, h - 0.04, 0.025), MM.paint);
      leaf.position.set(w / 4, h / 2, 0);
      setColor(leaf.geometry, GREEN);
      door.add(leaf);
      // the photos on the inside of the door: six of them, taped, a little crooked; a strip of tape on each
      const cells = [0, 1, 3, 4, 5, 6];
      cells.forEach((cell, i) => {
        const g = new THREE.PlaneGeometry(0.16, 0.115);
        const u0 = (cell % 4) / 4, v0 = 1 - (Math.floor(cell / 4) + 1) / 2, uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / 4, v0 + uv.getY(k) / 2);
        const p = new THREE.Mesh(g, own.photos);
        p.position.set(0.12 + (i % 2) * 0.2 + (i === 4 ? 0.02 : 0), 1.0 + Math.floor(i / 2) * 0.22, -0.0145);
        p.rotation.set(0, Math.PI, (rnd() - 0.5) * 0.18);
        door.add(p);
        const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.018), new THREE.MeshStandardMaterial({ color: 0xe8e0b0, roughness: 0.6, transparent: true, opacity: 0.75 }));
        tape.position.set(p.position.x, p.position.y + 0.045, -0.0152); tape.rotation.set(0, Math.PI, p.rotation.z + (rnd() - 0.5) * 0.3);
        door.add(tape);
      });
      root.add(door);
      door.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; meshes.push(m); } });
    }

    // ---------------- the door to the stairs, its frame with the height marks ----------------
    {
      const CASE = C('#c9c0ae');
      B.box('paint', B1 - 0.03, 0, D0 - 0.05, 0.08, DTOP + 0.06, 0.1, CASE, { r: 0.008 });
      B.box('paint', B1 - 0.03, 0, D1 + 0.05, 0.08, DTOP + 0.06, 0.1, CASE, { r: 0.008 });
      B.box('paint', B1 - 0.03, DTOP, (D0 + D1) / 2, 0.08, 0.1, D1 - D0 + 0.2, CASE, { r: 0.008 });
      // (the leaf is a part of its own: it opens into the room - Nate comes down from his flat this way)
      // the marks: on the face of the frame toward the room
      const g = new THREE.PlaneGeometry(0.1, DTOP);
      const m = addMesh(g, own.marks);
      m.position.set(B1 - 0.072, DTOP / 2, D1 + 0.05); m.rotation.y = -Math.PI / 2;
    }

    // the leaf of the door to the stairs, on its hinge at the back edge
    const stairs = new THREE.Group();
    stairs.position.set(B1 + 0.02, 0, D0);
    {
      const leaf = new THREE.Mesh(new RoundedBoxGeometry(0.05, DTOP - 0.01, D1 - D0 - 0.01, 1, 0.008), MM.wood);
      setColor(leaf.geometry, C('#5a3a24'));
      leaf.position.set(0, DTOP / 2, (D1 - D0) / 2);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), MM.metal);
      setColor(knob.geometry, C('#b8a070'));
      knob.position.set(-0.05, 1.0, D1 - D0 - 0.1);
      stairs.add(leaf, knob);
      stairs.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; meshes.push(m); } });
    }
    root.add(stairs);

    // ---------------- the roller door, down for the night: a strip of street light comes in under it ----------------
    {
      const W = DR1 - DR0, Hd = DH - 0.05;
      const m = new THREE.MeshStandardMaterial({ map: tex(cv(64, 512, drawRibs), true), color: 0x9a9ea2, roughness: 0.52, metalness: 0.55, envMap: env, envMapIntensity: 0.7 });
      m.map.repeat.set(W / 1.5, 1);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(W, Hd), m);
      door.position.set((DR0 + DR1) / 2, 0.05 + Hd / 2, F1 - 0.07); door.rotation.y = Math.PI;
      door.receiveShadow = true;
      root.add(door); meshes.push(door);
      B.box('metal', (DR0 + DR1) / 2, 0.035, F1 - 0.1, W, 0.07, 0.05, C('#34363a'), { r: 0.01 });          // the bottom bar
      B.box('metal', (DR0 + DR1) / 2, 0.6, F1 - 0.12, 0.32, 0.035, 0.05, C('#1a1a1c'), { r: 0.012 });       // the pull handle
      for (const r of [DR0 + 0.03, DR1 - 0.03]) B.box('metal', r, 0, F1 - 0.08, 0.07, DH, 0.09, C('#2c2e32'), { r: 0.01 });   // the guide rails
      const leak = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 1.1), new THREE.MeshBasicMaterial({ map: tex(cv(16, 128, drawLeak)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      leak.rotation.x = -Math.PI / 2; leak.position.set((DR0 + DR1) / 2, 0.007, F1 - 0.62); leak.renderOrder = 3;
      root.add(leak);
    }

    // ---------------- shelves at the back, the tool chest, the lift posts, tyres, the drum ----------------
    for (const y of [0.45, 1.15, 1.85]) B.box('metal', -1.0, y, F0 + 0.28, 2.6, 0.03, 0.45, STEEL, { r: 0.004 });
    for (const r of [-2.28, 0.28]) B.box('metal', r, 0, F0 + 0.28, 0.04, 2.1, 0.45, STEEL, { r: 0.004 });
    for (let i = 0; i < 10; i++) {
      const y = [0.48, 1.18, 1.88][i % 3], r = -2.1 + i * 0.24;
      if (i % 4 === 3) B.cyl('metal', r, y, F0 + 0.28, 0.08, 0.08, 0.2, [C('#8a2a20'), C('#3a5a2a'), C('#c9a020')][i % 3], 14);
      else B.box('paint', r, y, F0 + 0.28, 0.2, 0.18 + (i % 3) * 0.08, 0.32, [C('#8a6a40'), C('#5a4a3a'), C('#a89a7a')][i % 3], { r: 0.008 });
    }
    // the red tool chest on wheels
    {
      const r = -1.25, f = -3.0;
      B.box('paint', r, 0.08, f, 0.68, 0.95, 0.46, RED, { r: 0.02 });
      for (let i = 0; i < 6; i++) B.box('metal', r, 0.18 + i * 0.14, f + 0.235, 0.5, 0.018, 0.02, C('#c4c6c8'), { r: 0.006 });
      for (const [dx, dz] of [[-0.28, -0.18], [0.28, -0.18], [-0.28, 0.18], [0.28, 0.18]]) B.cyl('cloth', r + dx, 0.0, f + dz, 0.04, 0.04, 0.08, C('#1a1a1a'), 10);
      B.shadow(r, f, 0.4, 0.3, 0.6);
    }
    // the two posts of the car lift
    for (const [r, s] of [[-6.9, 1], [-2.1, -1]]) {
      const Y = C('#b8900f');
      B.box('metal', r, 0, 1.05, 0.56, 0.025, 0.56, STEEL, { r: 0.004 });                       // the base plate
      B.box('paint', r - s * 0.07, 0.025, 1.05, 0.12, 2.9, 0.3, Y, { r: 0.01 });                // the column, outer wall
      for (const dz of [-0.13, 0.13]) B.box('paint', r + s * 0.03, 0.025, 1.05 + dz, 0.1, 2.9, 0.04, Y, { r: 0.006 });   // its sides
      B.box('metal', r + s * 0.02, 0.025, 1.05, 0.06, 2.88, 0.2, C('#1a1a1c'), { r: 0.004 });    // the dark channel inside
      B.box('metal', r + s * 0.1, 0.32, 1.05, 0.16, 0.42, 0.22, C('#3a3c40'), { r: 0.012 });     // the carriage
      for (const a of [0.55, -0.55]) B.box('metal', r + s * (0.1 + 0.42), 0.36, 1.05 + a * 0.55, 0.8, 0.07, 0.09, C('#3a3c40'), { r: 0.01, rot: a });   // the arms, folded
      B.cyl('metal', r - s * 0.07, 2.92, 1.05, 0.03, 0.03, 0.12, C('#c4c6c8'), 8);
    }
    B.box('metal', -4.5, 2.95, 1.05, 4.9, 0.12, 0.14, STEEL, { r: 0.01 });                       // the beam across the top
    B.cyl('cloth', -4.5, 2.88, 1.05, 0.012, 0.012, 4.6, C('#151515'), 6, [0, 0, Math.PI / 2]);
    // tyres, the oil drum, a broom, a coil of cable
    for (let i = 0; i < 4; i++) B.torus('cloth', -8.1, 0.12 + i * 0.22, 5.7, 0.26, 0.1, C('#1b1b1c'), [Math.PI / 2, 0, 0]);
    B.cyl('paint', -0.6, 0, 5.6, 0.3, 0.3, 0.9, C('#1f3d63'), 18);
    B.torus('metal', -0.6, 0.3, 5.6, 0.3, 0.012, C('#16304e'), [Math.PI / 2, 0, 0]);
    B.torus('metal', -0.6, 0.62, 5.6, 0.3, 0.012, C('#16304e'), [Math.PI / 2, 0, 0]);
    B.cyl('wood', B0 + 0.12, 0.0, -0.4, 0.012, 0.012, 1.3, C('#9a7a50'), 6, [0.08, 0, 0.05]);
    B.box('cloth', B0 + 0.2, 0, -0.4, 0.3, 0.12, 0.06, C('#3a3020'), { r: 0.02 });
    for (let k = 0; k < 3; k++) B.torus('cloth', -2.4, 0.03 + k * 0.012, -0.2, 0.22 - k * 0.02, 0.012, C('#c2741a'), [Math.PI / 2, 0, 0]);

    // ---------------- Mace's armchair by the door, a crate beside it ----------------
    {
      const r = -4.3, f = 5.45;
      B.box('cloth', r, 0.12, f, 0.86, 0.32, 0.78, C('#4e3626'), { r: 0.08 });
      B.box('cloth', r, 0.44, f - 0.33, 0.86, 0.6, 0.18, C('#4e3626'), { r: 0.07 });
      for (const s of [-1, 1]) B.box('cloth', r + s * 0.38, 0.3, f, 0.14, 0.34, 0.78, C('#45301f'), { r: 0.06 });
      B.box('cloth', r, 0.42, f + 0.05, 0.6, 0.08, 0.58, C('#5a4030'), { r: 0.04 });
      B.box('wood', r + 0.75, 0, f - 0.05, 0.45, 0.42, 0.4, C('#7a5a3a'), { r: 0.012 });
      B.shadow(r, f, 0.55, 0.5, 0.8);
    }

    // ---------------- oil stains and the drain ----------------
    const stains = [];
    for (const [r, f, s, rot] of [[-6.6, -3.4, 1.6, 0.3], [-7.2, -1.9, 0.9, 1.2], [-4.6, 2.6, 1.8, 2.0], [-3.8, 3.6, 0.8, 0.7], [-1.1, 5.0, 0.9, 2.6], [-5.8, -5.4, 1.0, 1.9], [-2.6, -1.2, 0.7, 0.2]]) {
      const g = new THREE.PlaneGeometry(s, s * 0.8); g.rotateX(-Math.PI / 2); g.rotateY(rot);
      const m = new THREE.Mesh(g, own.stain); m.position.set(r, 0.004, f); m.renderOrder = 2; m.receiveShadow = false;
      root.add(m); stains.push(m); meshes.push(m);
    }
    B.box('metal', -4.5, 0, 3.0, 0.5, 0.008, 0.32, C('#141414'), { r: 0.002 });
    for (let i = 0; i < 8; i++) B.box('metal', -4.72 + i * 0.062, 0.006, 3.0, 0.012, 0.006, 0.3, C('#3a3a3a'), { r: 0.001 });

    // ---------------- the lamps: two enamel shades on cords, a lamp on a stand by the car ----------------
    const lampAt = [{ id: 'car', r: -6.35, f: -3.4, y: 3.05 }, { id: 'bench', r: -0.35, f: -1.9, y: 2.55 }];
    for (const L of lampAt) {
      B.cyl('metal', L.r, L.y + 0.18, L.f, 0.004, 0.004, TOP - L.y - 0.18, C('#1a1a1a'), 6);
      B.lathe('paint', L.r, L.y, L.f, [[0.235, 0.0], [0.2, 0.04], [0.07, 0.16], [0.04, 0.2]], C('#2f4a3a'), 22);
      B.lathe('gloss', L.r, L.y - 0.002, L.f, [[0.0, 0.17], [0.065, 0.155], [0.2, 0.035], [0.226, 0.004]], C('#e8e4d8'), 22);
    }
    // the lamp on a stand: three legs, a pole, a yoke, and a deep enamel bowl with a bright reflector inside and a
    // wire guard over its mouth, aimed at the left front corner of the car (where the work is)
    const STAND = { r: -5.3, f: -6.15, y: 1.6 };
    const aim = [CAR_AT.r + 0.85 - STAND.r, 0.55 - STAND.y, CAR_AT.f + 1.85 - STAND.f];
    const aimLen = Math.hypot(aim[0], aim[1], aim[2]);
    STAND.dir = aim.map((v) => v / aimLen);
    STAND.yaw = Math.atan2(STAND.dir[0], STAND.dir[2]);
    STAND.tilt = Math.PI / 2 - Math.asin(STAND.dir[1]);          // (turns the bowl's +y opening to the aim)
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; B.cyl('metal', STAND.r + Math.cos(a) * 0.2, 0.0, STAND.f + Math.sin(a) * 0.2, 0.01, 0.01, 0.45, C('#2a2a2c'), 6, [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]); }
    B.cyl('metal', STAND.r, 0.2, STAND.f, 0.014, 0.014, STAND.y - 0.36, C('#2a2a2c'), 8);
    B.cyl('metal', STAND.r, STAND.y - 0.2, STAND.f, 0.02, 0.02, 0.05, C('#1c1c1e'), 10);           // the clamp
    {
      const back = 0.07;                                         // the bowl's back sits this far behind the pivot
      const bx = STAND.r - STAND.dir[0] * back, by = STAND.y - STAND.dir[1] * back, bz = STAND.f - STAND.dir[2] * back;
      const rot = [STAND.tilt, STAND.yaw, 0];
      B.lathe('paint', bx, by, bz, [[0.035, 0.0], [0.075, 0.02], [0.108, 0.062], [0.126, 0.12], [0.131, 0.145]], C('#8a2a16'), 22, 0, 1, rot);    // the enamel bowl (outside)
      B.lathe('gloss', bx, by, bz, [[0.124, 0.143], [0.119, 0.12], [0.1, 0.064], [0.064, 0.026], [0.0, 0.012]], C('#e9e6de'), 22, 0, 1, rot);   // the reflector (inside)
      B.cyl('metal', bx - STAND.dir[0] * 0.03, by - STAND.dir[1] * 0.03, bz - STAND.dir[2] * 0.03, 0.04, 0.04, 0.06, C('#1c1c1e'), 12, rot);    // the socket at its back
      // the guard: a ring on the rim and two wires across
      const rx = bx + STAND.dir[0] * 0.15, ry = by + STAND.dir[1] * 0.15, rz = bz + STAND.dir[2] * 0.15;
      // (the ring's axis is its own +z, the bowl's is its +y: a quarter turn less about x)
      B.torus('metal', rx, ry, rz, 0.13, 0.004, C('#3a3a3c'), [STAND.tilt - Math.PI / 2, STAND.yaw, 0]);
      B.cyl('metal', rx, ry, rz, 0.0025, 0.0025, 0.26, C('#3a3a3c'), 5, [STAND.tilt + Math.PI / 2, STAND.yaw, 0]);
      B.cyl('metal', rx, ry, rz, 0.0025, 0.0025, 0.26, C('#3a3a3c'), 5, [STAND.tilt, STAND.yaw, -Math.PI / 2]);
      // the yoke: two arms from the clamp to the sides of the bowl
      const side = [Math.cos(STAND.yaw), 0, -Math.sin(STAND.yaw)];
      for (const k of [-1, 1]) B.box('metal', STAND.r + side[0] * 0.138 * k, STAND.y - 0.16, STAND.f + side[2] * 0.138 * k, 0.01, 0.17, 0.02, C('#2a2a2c'), { r: 0.003, rot: STAND.yaw });
      B.box('metal', STAND.r, STAND.y - 0.165, STAND.f, 0.286, 0.012, 0.02, C('#2a2a2c'), { r: 0.003, rot: STAND.yaw });
      for (const k of [-1, 1]) B.cyl('metal', STAND.r + side[0] * 0.138 * k, STAND.y, STAND.f + side[2] * 0.138 * k, 0.012, 0.012, 0.016, C('#151515'), 10, [0, STAND.yaw, Math.PI / 2]);   // the wing nuts
      // the cable down the pole to the floor
      B.cyl('cloth', STAND.r + 0.022, 0.0, STAND.f, 0.005, 0.005, STAND.y - 0.3, C('#121212'), 5);
    }

    // the caged bulb over the cabinet
    B.box('metal', -2.9, 2.38, F0 + 0.06, 0.12, 0.12, 0.1, C('#2a2a2a'), { r: 0.02 });
    // an old oval bulkhead lamp on the right wall over the radio shelf: a cast body, a ribbed glass, a guard
    B.box('metal', B1 - 0.035, 2.12, 1.0, 0.07, 0.2, 0.28, C('#3a3226'), { r: 0.03 });
    B.box('gloss', B1 - 0.075, 2.15, 1.0, 0.03, 0.14, 0.21, C('#f0dcb0'), { r: 0.012 });
    for (const dz of [-0.06, 0, 0.06]) B.box('metal', B1 - 0.093, 2.14, 1.0 + dz, 0.008, 0.16, 0.01, C('#2a2620'), { r: 0.003 });
    // ---------------- build the static meshes ----------------
    built = B.finish(root, MM);
    for (const m of Object.values(built.meshes)) meshes.push(m);

    // ---------------- the lamps' glowing bulbs, the haze under them, the dust in it ----------------
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
    const glows = {};
    for (const L of lampAt) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), glowMat);
      g.position.set(L.r, L.y + 0.06, L.f); root.add(g); glows[L.id] = g;
    }
    { const g = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), glowMat); g.position.set(-2.9, 2.44, F0 + 0.13); root.add(g); glows.cab = g; }
    { // the ribbed glass of the bulkhead lamp, lit from inside
      const g = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.12), new THREE.MeshBasicMaterial({ color: 0xe8c48a }));
      g.rotation.y = -Math.PI / 2; g.position.set(B1 - 0.0915, 2.22, 1.0); root.add(g); glows.shelf = g;
    }
    {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), glowMat);
      g.position.set(STAND.r, STAND.y, STAND.f); root.add(g); glows.stand = g;
    }
    const hazeMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 0.82, 0.58) }, uOpacity: { value: 0.1 } },
      vertexShader: HAZE_VS, fragmentShader: HAZE_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const hazes = {};
    for (const L of lampAt) {
      const h = L.y - 0.02;
      const g = new THREE.CylinderGeometry(0.2, 1.25, h, 28, 6, true);
      // (aH: 0 at the floor, 1 at the lamp)
      const pa = g.attributes.position, ah = new Float32Array(pa.count);
      for (let i = 0; i < pa.count; i++) ah[i] = pa.getY(i) / h + 0.5;
      g.setAttribute('aH', new THREE.BufferAttribute(ah, 1));
      const m = new THREE.Mesh(g, hazeMat); m.position.set(L.r, h / 2, L.f); m.renderOrder = 8;
      root.add(m); hazes[L.id] = m;
    }
    // dust
    const DUST_N = 110, dpos = new Float32Array(DUST_N * 3), drnd = new Float32Array(DUST_N * 3), daxis = new Float32Array(DUST_N * 3);
    for (let i = 0; i < DUST_N; i++) {
      const L = lampAt[i % 2], a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 1.0;
      dpos[i * 3] = L.r + Math.cos(a) * rr; dpos[i * 3 + 1] = rnd() * 2.6; dpos[i * 3 + 2] = L.f + Math.sin(a) * rr;
      drnd[i * 3] = rnd(); drnd[i * 3 + 1] = rnd(); drnd[i * 3 + 2] = rnd();
      daxis[i * 3] = L.r; daxis[i * 3 + 1] = L.y; daxis[i * 3 + 2] = L.f;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); dg.setAttribute('aRand', new THREE.BufferAttribute(drnd, 3)); dg.setAttribute('aAxis', new THREE.BufferAttribute(daxis, 3));
    const dustU = { uTime: { value: 0 }, uSize: { value: 5.5 }, uColor: { value: new THREE.Color(1, 0.86, 0.64) }, uOpacity: { value: 0.22 } };
    const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: dustU, vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.frustumCulled = false; dust.renderOrder = 9;
    root.add(dust);

    // ---------------- the lights ----------------
    const hemi = new THREE.HemisphereLight(0x5a4632, 0x1a1410, 0.72);
    hemi.position.set(-4, TOP, 0);
    root.add(hemi);
    // the lamp over the car: a spot light straight down, with soft shadows (the people, the car, on the concrete)
    const carSpot = new THREE.SpotLight(0xffc890, 40, 12, 1.05, 0.75, 2);
    carSpot.position.set(lampAt[0].r, lampAt[0].y - 0.05, lampAt[0].f);
    carSpot.target.position.set(lampAt[0].r - 0.2, 0, lampAt[0].f + 0.6);
    carSpot.castShadow = true; carSpot.shadow.mapSize.set(1024, 1024); carSpot.shadow.bias = -0.0006; carSpot.shadow.normalBias = 0.02; carSpot.shadow.radius = 3;
    carSpot.shadow.camera.near = 0.3; carSpot.shadow.camera.far = 6;
    root.add(carSpot, carSpot.target);
    const benchLight = new THREE.PointLight(0xffc48a, 9, 7, 2);
    benchLight.position.set(lampAt[1].r, lampAt[1].y - 0.12, lampAt[1].f);
    root.add(benchLight);
    const standLight = new THREE.SpotLight(0xffe0b0, 11, 7, 0.75, 0.7, 2);
    standLight.position.set(STAND.r + STAND.dir[0] * 0.08, STAND.y + STAND.dir[1] * 0.08, STAND.f + STAND.dir[2] * 0.08);
    standLight.target.position.set(STAND.r + STAND.dir[0] * 3, STAND.y + STAND.dir[1] * 3, STAND.f + STAND.dir[2] * 3);
    root.add(standLight, standLight.target);
    // the bulkhead lamp over the radio shelf: the kettle corner, the armchair, the way to the door
    const shelfLight = new THREE.PointLight(0xffc68a, 3.4, 5.5, 2);
    shelfLight.position.set(B1 - 0.25, 2.2, 1.0);
    root.add(shelfLight);
    // an old caged bulb on the back wall over the cabinet (it lights the photos, and a little the door frame)
    const cabLight = new THREE.PointLight(0xffc890, 3.2, 6, 2);
    cabLight.position.set(-2.9, 2.45, F0 + 0.35);
    root.add(cabLight);
    // a dim fill from the far end of the bay (the street light through the gaps of the door)
    const doorLight = new THREE.PointLight(0x8aa2c8, 1.6, 9, 2);
    doorLight.position.set(-4.5, 2.2, 5.6);
    root.add(doorLight);

    // ---------------- THEO'S CAR, and its cloth ----------------
    const car = makeTheoCar({ env, wheelMaterial: G.mats && G.mats.carPaint, state: 'wreck' });
    car.root.position.set(CAR_AT.r, 0, CAR_AT.f);
    root.add(car.root);
    car.root.traverse((m) => { if (m.isMesh) { m.receiveShadow = true; m.castShadow = m.material === car.materials.paint || !!(m.geometry && m.geometry.attributes.position.count > 3000); } });
    const cloth = makeCloth(car);
    car.root.add(cloth.mesh);
    loadGlbCar(car, cloth.mesh);

    // the chain of the frame puller (station 2): from a ring in the floor to the bent corner of the car
    const chain = makeChain();
    root.add(chain.group);
    chain.group.visible = false;

    // the radio (it can be switched on: its dial glows)
    const radio = makeRadio();
    radio.group.position.set(B1 - 0.14, 1.54, 1.55); radio.group.rotation.y = -Math.PI / 2;
    root.add(radio.group);

    // the kettle on the hot plate (its little light, its steam)
    const kettle = makeKettle();
    kettle.onClick = (on) => { if (G.sound && G.sound.kettleClick) G.sound.kettleClick(on); };
    kettle.group.position.set(0.08, 0.8, 1.68);
    root.add(kettle.group);

    // ---------------- the pane in front of the camera ("through the window") ----------------
    const paneMat = own.rain.clone();
    paneMat.uniforms = THREE.UniformsUtils.clone(own.rain.uniforms);
    // (close to the lens: bigger, softer drops; their bright spots are the warm lamps of the room)
    paneMat.uniforms.uScale.value.set(3.2, 1.8); paneMat.uniforms.uOpacity.value = 0.9; paneMat.uniforms.uTint.value.setRGB(0.95, 0.84, 0.7); paneMat.uniforms.uSoft.value = 1;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.24), paneMat);
    pane.renderOrder = 30; pane.frustumCulled = false; pane.visible = false;
    pane.material.depthTest = false;
    camera.add(pane); pane.position.set(0, 0, -0.12);
    if (!camera.parent) scene.add(camera);

    root.traverse((m) => m.layers.set(INTERIOR_LAYER));
    pane.layers.set(INTERIOR_LAYER);
    scene.add(root);
    return { env, own, M: MM, meshes, stains, glows, hazes, hazeMat, dust, dustU, hemi, carSpot, benchLight, standLight, doorLight, car, cloth, chain, radio, kettle, pane, paneMat, lampAt, STAND, stairs };
  }

  // ===================================================================== show / hide
  let saved = null;
  function show(on, opts = {}) {
    if (on && !active) {
      if (!built) built = build();
      active = true;
      root.visible = true;
      saved = { mask: camera.layers.mask };
      camera.layers.set(INTERIOR_LAYER);
      solid(true);
      if (G.onShow) G.onShow(true);
      if (G.lighting) G.lighting.interior = { sky: [0.34, 0.26, 0.18], ground: [0.14, 0.11, 0.08], hemi: 0.55, exposure: 1.05, env: 0.3 };
      setRoomShade();
    } else if (!on && active) {
      active = false;
      root.visible = false;
      if (built) built.pane.visible = false;
      if (saved) camera.layers.mask = saved.mask; else camera.layers.set(0);
      solid(false);
      if (G.onShow) G.onShow(false);
      if (G.lighting) G.lighting.interior = null;
    }
  }
  // the set's own solid things in the city's collision grid (on) or out of it again (off)
  let solids = null;
  function solid(on) {
    const grid = G.colliders;
    if (!grid) return;
    if (on && !solids) {
      const w = (r, f) => GARAGE.at(r, 0, f);
      solids = { boxes: [], circles: [] };
      for (const [r0, f0, r1, f1, h] of SOLID_BOXES) {
        const a = w(r0, f0), b = w(r1, f1);
        const box = { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h: (GARAGE.curb || 0) + h };
        grid.addBox(box); solids.boxes.push(box);
      }
      for (const [r, f, rad] of SOLID_CIRCLES) { const q = w(r, f); const c = { x: q[0], z: q[2], r: rad }; grid.addCircle(c); solids.circles.push(c); }
    } else if (!on && solids) {
      for (const b of solids.boxes) grid.removeBox(b);
      for (const c of solids.circles) grid.removeCircle(c);
      solids = null;
    }
  }
  // the room the game camera stays in while the set is shown (camera.js "room"): the bay, under its ceiling
  function room() {
    const I = GARAGE.inside, y0 = GARAGE.curb || 0;
    return { minX: I.minX, maxX: I.maxX, minZ: I.minZ, maxZ: I.maxZ, floor: y0, top: y0 + TOP - 0.25, dist: 2.7 };
  }
  // (the corners of the bay darker, like the houses: roomShade of kit.js)
  function setRoomShade() {
    const I = GARAGE.inside;
    roomShade.uRoomA.value.set(I.minX, I.minZ, I.maxX, I.maxZ);
    const far = new THREE.Vector4(-1e6, -1e6, -1e6 + 1, -1e6 + 1);
    roomShade.uRoomB.value.copy(far); roomShade.uRoomC.value.copy(far);
    roomShade.uRoomH.value.set(TOP, 2.8, 2.8);
    roomShade.uRoomY.value = GARAGE.curb || 0;
  }
  // everything in the room that the camera must see: the people, the player, the story's things
  function layerAll(list) { for (const o of list) if (o) o.traverse((m) => { if ((m.isMesh || m.isSkinnedMesh || m.isPoints || m.isLight) && !m.layers.isEnabled(INTERIOR_LAYER)) m.layers.enable(INTERIOR_LAYER); }); }

  // ===================================================================== every frame
  let layerT = 0;
  function update(dt, extra = []) {
    if (!active || !built) return;
    time += dt;
    built.own.rain.uniforms.uTime.value = time;
    built.paneMat.uniforms.uTime.value = time;
    built.dustU.uTime.value = time;
    built.kettle.update(dt);
    built.radio.update(dt, time);
    // the rain pane sits just past the camera's near plane (film shots move that plane), and grows with the distance
    if (built.pane.visible) { const d = Math.max(0.12, camera.near * 1.6); built.pane.position.z = -d; built.pane.scale.setScalar(d / 0.12); }
    // the lamps: a slow, very small flicker of old bulbs
    const fl = 1 + Math.sin(time * 7.3) * 0.006 + Math.sin(time * 17.1) * 0.004;
    built.carSpot.intensity = 40 * lightsOn.car * fl;
    built.benchLight.intensity = 9 * lightsOn.bench * fl;
    built.standLight.intensity = 11 * lightsOn.stand;
    built.glows.car.visible = lightsOn.car > 0.05; built.glows.bench.visible = lightsOn.bench > 0.05; built.glows.stand.visible = lightsOn.stand > 0.05;
    built.hazes.car.visible = lightsOn.car > 0.05; built.hazes.bench.visible = lightsOn.bench > 0.05;
    built.hazeMat.uniforms.uOpacity.value = 0.1 * Math.max(lightsOn.car, lightsOn.bench);
    built.dustU.uOpacity.value = 0.22 * Math.max(lightsOn.car, lightsOn.bench);
    layerT -= dt;
    if (layerT <= 0) { layerT = 0.25; layerAll(typeof extra === 'function' ? extra() : extra); }
  }

  // ===================================================================== what the story can change
  const api = {
    show, update,
    get active() { return active; },
    get car() { return built ? built.car : null; },
    get root() { return root; },
    // the cloth over the car: 0 on .. 1 off (on the floor in front of the car); 'aside' = folded on the floor by the wall
    cloth(v) { if (!built) return; built.cloth.set(v); },
    // the lamps: { car, bench, stand } 0..1
    lamps(o) { Object.assign(lightsOn, o); },
    // the chain of the frame puller: { on, pull: 0..1 }
    chain(o) { if (!built) return; built.chain.group.visible = !!o.on; if (o.pull !== undefined) built.chain.set(o.pull); },
    radio(on) { if (built) built.radio.set(on); },
    // the door to the stairs: 0 shut .. 1 open (into the room)
    stairsDoor(v) { if (built) { built.stairs.rotation.y = -1.35 * v; built.stairsOpen = v; } },
    get stairsAt() { return built ? built.stairsOpen || 0 : 0; },
    get radioOn() { return built ? built.radio.on : false; },
    kettle(on) { if (built) built.kettle.set(on); },
    // how hot the kettle is while it is on (0..1, for the sound of the water), 0 when it is off
    get kettleHeat() { return built && built.kettle.on ? built.kettle.heat : 0; },
    // the pane of rain in front of the camera (a shot "through the window")
    pane(on) { if (built) built.pane.visible = !!on; },
    // a point given in the car's own directions (x left, y up, z nose) -> garage directions [r, y, f]
    carPoint(p) { return [CAR_AT.r + p[0], p[1], CAR_AT.f + p[2]]; },
    // the camera's room (see room above), and where the radio stands in the world (its song is heard from there)
    get room() { return room(); },
    get radioAt() { return GARAGE.at(B1 - 0.14, (GARAGE.curb || 0) + 1.62, 1.55); },
    // how bright the lamps are now: { car, bench, stand }; where the cloth is now (0..1 or 'aside')
    get lampsOn() { return lightsOn; },
    get clothAt() { return built ? built.cloth.state : 0; },
  };
  return api;
}

// ======================================================================= Theo's car from a file
// If assets/vehicles/theo_car.glb is there, it replaces the car made in code (the cloth stays). The repair still
// works: the parts of the file with the names of THEO_GLB above follow it, the dust is a darker, duller paint.
async function loadGlbCar(car, keep) {
  let ok = false;
  try { ok = (await fetch(THEO_GLB, { method: 'HEAD', cache: 'no-store' })).ok; } catch (e) { ok = false; }
  if (!ok) return;
  let gltf = null;
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    gltf = await new GLTFLoader().loadAsync(THEO_GLB);
  } catch (e) { console.warn('[garage] theo_car.glb could not be read; the car made in code stays', e); return; }
  const model = gltf.scene;
  const parts = {};
  const mats = new Map();
  model.traverse((o) => {
    if (o.name && !parts[o.name]) parts[o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    o.layers.set(INTERIOR_LAYER);
    // (each material once: its own copy, with its first color and roughness kept for the dust)
    const list = Array.isArray(o.material) ? o.material : [o.material];
    o.material = list.map((m) => { if (!mats.has(m)) { const c = m.clone(); c.userData.base = { color: c.color ? c.color.clone() : null, rough: c.roughness }; mats.set(m, c); } return mats.get(m); });
    if (o.material.length === 1) o.material = o.material[0];
  });
  // the car made in code goes away (only the cloth over it stays)
  for (const ch of [...car.root.children]) if (ch !== keep) ch.visible = false;
  car.root.add(model);
  const S = car.set, orig = { ...S };
  const dust = (v) => { for (const m of mats.values()) { const b = m.userData.base; if (b.color) m.color.copy(b.color).multiplyScalar(1 - 0.38 * v); if (b.rough !== undefined) m.roughness = Math.min(1, b.rough + 0.45 * v); } };
  S.dirt = (v) => { orig.dirt(v); dust(v); };
  S.bumper = (v) => {
    orig.bumper(v);
    if (parts.bumper_old) parts.bumper_old.visible = v === 'old';
    if (parts.bumper_new) parts.bumper_new.visible = v !== 'old' && v !== 'none' && v !== 0;
  };
  S.hood = (v) => { orig.hood(v); if (parts.hood) parts.hood.rotation.x = -v * 1.05; };
  S.cleaner = (v) => { orig.cleaner(v); if (parts.air_cleaner) parts.air_cleaner.visible = v !== 'off'; };
  S.deck = (v) => { orig.deck(v); if (parts.deck) parts.deck.visible = v !== 'out'; };
  S.lights = (v) => {
    orig.lights(v);
    if (parts.lights) parts.lights.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { o.material.emissive.setRGB(1, 0.92, 0.75); o.material.emissiveIntensity = v * 2; } });
  };
  // (what the car is now, also on the file's parts)
  const st = car.state;
  S.dirt(st.dirt); S.bumper(st.bumper); S.hood(st.hood); S.cleaner(st.cleaner); S.deck(st.deck); S.lights(st.lights);
  car.glb = model;
}

// ======================================================================= small parts
function setColor(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }

// THE CLOTH over Theo's car: a sheet of faded canvas lying over the shape of the car, hanging down its sides in
// folds. set(p): pulled toward the nose by p (0..1) - it slides over the car, falls down in front of it and lies
// in a heap on the floor. 'aside': folded on the floor beside the car.
function makeCloth(car) {
  const NU = 64, NV = 26, L0 = THEO_INFO.backZ - 0.3, L1 = THEO_INFO.frontZ + 0.3, W = 1.6;
  const n = (NU + 1) * (NV + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const idx = [];
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const k = i * (NV + 1) + j; uv[k * 2] = j / NV * 2; uv[k * 2 + 1] = i / NU * 5; }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 2, d = a + NV + 1; idx.push(a, b, c, a, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const ctex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#6d6f62'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(0,0,0,${0.04 + (i % 4) * 0.01})`; x.fillRect(0, i, 256, 1); x.fillRect(i, 0, 1, 256); }
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(60,50,40,${0.05 + rnd() * 0.08})`; x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 10 + rnd() * 30, 0, Math.PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const mat = new THREE.MeshStandardMaterial({ map: ctex, color: 0xffffff, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const fold = (a, b) => Math.sin(a * 9.1 + b * 1.7) * 0.5 + Math.sin(a * 23.3 - b * 3.1) * 0.25 + Math.sin(a * 4.2 + b * 7.7) * 0.25;
  let state = 0;
  function set(p) {
    state = p;
    if (p === 'aside') { mesh.visible = true; heap(1, true); return; }
    mesh.visible = true;
    heap(typeof p === 'number' ? p : 0, false);
  }
  function heap(p, aside) {
    const shift = p * (L1 - L0 + 0.9);
    const FLOOR_Z = THEO_INFO.frontZ + 0.32;
    for (let i = 0; i <= NU; i++) {
      const z0 = L0 + (i / NU) * (L1 - L0);           // where this row of the cloth lies when it covers the car
      const s = z0 + shift;                            // where it is now along the car
      for (let j = 0; j <= NV; j++) {
        const v = j / NV, x0 = (v - 0.5) * 2 * W;
        const k = i * (NV + 1) + j;
        let x, y, z;
        const fz = fold(z0, x0), fx = fold(x0 * 2.1, z0 * 0.7);
        if (aside) {
          // folded on the floor to the right of the car (toward the wall): a low long heap
          x = -1.25 + (v - 0.5) * 0.5 + fx * 0.04; z = -0.4 + (i / NU - 0.5) * 2.4; y = 0.03 + Math.max(0, Math.sin(v * Math.PI)) * 0.08 + fz * 0.02;
        } else if (s <= FLOOR_Z - 0.2) {
          // on the car: the height of the car under it, the sides hanging down
          const top = theoCover(Math.min(Math.abs(x0), 0.95), Math.min(Math.max(s, L0 + 0.3), L1 - 0.3));
          const hw = top.halfWidth + 0.04;
          if (Math.abs(x0) <= hw) { x = x0; y = top.y + 0.02 + Math.abs(fz) * 0.006; }
          else {
            const drop = (Math.abs(x0) - hw) * 1.05;                       // the extra cloth hangs down the side
            x = Math.sign(x0) * (hw + 0.03 + drop * 0.08 + fx * 0.025);
            y = Math.max(0.26 + fz * 0.03, top.edgeY - drop);
          }
          z = s + (Math.abs(x0) > hw ? fz * 0.03 : 0);
          // (over the ends of the car the cloth hangs down too)
          if (s < THEO_INFO.backZ) { const d = THEO_INFO.backZ - s; z = THEO_INFO.backZ - 0.03 - d * 0.1; y = Math.max(0.28, top.y - d * 1.1); }
          if (s > THEO_INFO.frontZ) { const d = s - THEO_INFO.frontZ; z = THEO_INFO.frontZ + 0.03 + d * 0.1; y = Math.max(0.28, top.y - d * 1.1); }
        } else {
          // past the nose: it falls and lies on the floor in a heap, gathered toward the middle
          const e = s - (FLOOR_Z - 0.2);
          const fall = Math.min(1, e / 0.5);
          z = FLOOR_Z + e * 0.32 + fz * 0.05;
          x = x0 * (1 - 0.45 * fall) + fx * 0.06;
          y = Math.max(0.02, (1 - fall) * 0.55) + Math.max(0, Math.sin(v * Math.PI) * 0.12 * fall) + Math.abs(fz) * 0.05 * fall;
        }
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
  }
  set(0);
  return { mesh, set, get state() { return state; } };
}

// the chain of the frame puller: links from a ring in the floor in front of the car to its bent corner
function makeChain() {
  const group = new THREE.Group();
  const N = 22;
  const link = new THREE.TorusGeometry(0.03, 0.009, 6, 10);
  link.scale(1, 1.6, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.45, metalness: 0.85 });
  const links = new THREE.InstancedMesh(link, mat, N);
  links.castShadow = true;
  group.add(links);
  const anchor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.05, 16), mat);
  group.add(anchor);
  const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.4, metalness: 0.3 }));
  group.add(ram);
  const A = new THREE.Vector3(-5.3, 0.03, -0.2), Bp = new THREE.Vector3(CAR_AT.r + 0.84, 0.36, CAR_AT.f + 2.0);
  anchor.position.copy(A);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0);
  function set(pull) {
    // (the corner comes out a little as the chain pulls: the end of the chain follows it)
    const end = Bp.clone().add(new THREE.Vector3(0.07 * (1 - pull), 0, 0.05 * (1 - pull)));
    const dir = end.clone().sub(A), len = dir.length(); dir.normalize();
    const sag = 0.08 * (1 - pull * 0.8);
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      _p.copy(A).addScaledVector(dir, len * t); _p.y -= Math.sin(t * Math.PI) * sag;
      _q.setFromUnitVectors(_u, dir);
      if (i % 2) _q.multiply(new THREE.Quaternion().setFromAxisAngle(_u, Math.PI / 2));
      _m.compose(_p, _q, _s);
      links.setMatrixAt(i, _m);
    }
    links.instanceMatrix.needsUpdate = true;
    ram.position.copy(A).add(new THREE.Vector3(0.2, 0.45, 0.25));
    ram.rotation.set(-0.25 + pull * 0.1, 0, 0.2);
  }
  set(0);
  return { group, set };
}

// the radio on the shelf: a wooden box, a cloth grille, a dial that glows when it is on
function makeRadio() {
  const group = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, 0.13), new THREE.MeshStandardMaterial({ color: 0x6a4026, roughness: 0.55, metalness: 0 }));
  wood.position.y = 0.085; wood.castShadow = true;
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.95 }));
  grille.position.set(-0.055, 0.09, 0.0655);
  const dialMat = new THREE.MeshBasicMaterial({ color: 0x2a2014, toneMapped: false });
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), dialMat);
  dial.position.set(0.085, 0.12, 0.0656);
  const knobMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.4 });
  for (const x of [0.06, 0.11]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), knobMat); k.rotation.x = Math.PI / 2; k.position.set(x, 0.05, 0.072); group.add(k); }
  group.add(wood, grille, dial);
  let on = false, k = 0;
  return {
    group,
    get on() { return on; },
    set(v) { on = !!v; },
    update(dt, t) { k += ((on ? 1 : 0) - k) * Math.min(1, dt * 3); dialMat.color.setRGB(0.16 + 0.84 * k * (0.96 + Math.sin(t * 2.1) * 0.02), 0.11 + 0.55 * k, 0.05 + 0.2 * k); },
  };
}

// the kettle on the hot plate: a small red light while it heats, a thin column of steam when it boils
function makeKettle() {
  const group = new THREE.Group();
  const prof = [[0, 0], [0.085, 0], [0.095, 0.03], [0.09, 0.1], [0.06, 0.15], [0.03, 0.165], [0, 0.17]].map(([a, b]) => new THREE.Vector2(a, b));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), new THREE.MeshStandardMaterial({ color: 0xb8b8b4, roughness: 0.22, metalness: 0.9 }));
  body.castShadow = true;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.009, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }));
  handle.position.y = 0.19;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.12, 10), body.material);
  spout.position.set(0.1, 0.1, 0); spout.rotation.z = -0.9;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x220404, toneMapped: false });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), ledMat);
  led.position.set(0.0, 0.012, 0.115);
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const steam = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 10, 1, true), steamMat);
  steam.position.set(0.16, 0.36, 0); steam.rotation.z = Math.PI;
  group.add(body, handle, spout, led, steam);
  let on = false, heat = 0;
  const kettle = {
    group, onClick: null,
    get on() { return on; },
    get heat() { return heat; },
    set(v) { if (!!v !== on && kettle.onClick) kettle.onClick(!!v); on = !!v; if (on) heat = Math.min(heat, 0.2); },
    update(dt) {
      heat = on ? Math.min(1, heat + dt / 14) : Math.max(0, heat - dt / 30);
      // (it boils: the switch clicks off by itself)
      if (on && heat >= 1) kettle.set(false);
      ledMat.color.setRGB(on ? 0.9 : 0.13, on ? 0.08 : 0.02, on ? 0.05 : 0.02);
      steamMat.opacity = Math.max(0, heat - 0.75) * 0.25;
      steam.scale.y = 0.8 + Math.sin(performance.now() * 0.003) * 0.1;
    },
  };
  return kettle;
}
