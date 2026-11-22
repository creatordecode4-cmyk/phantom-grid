// ---------------------------------------------------------------------------
// kit.js - everything a room is made of: walls, floors, furniture, small
// things, and the pictures on them (all drawn in code).
//
// A room is built in its OWN directions (meters):
//   x  from the left wall (0) to the right wall (W)      (looking at the back wall)
//   z  from the front wall (0, the door you came in by) to the back wall (D)
//   y  up from the floor
//
// HOW IT STAYS CHEAP: every piece is written into one of a few "builders",
// one per material (wood, paint, ceramic, metal, cloth ...). A whole room is
// then about fifteen meshes, however many plates and books are in it.
//
// HOW IT LOOKS GOOD:
//   * every box has soft, rounded edges that catch a thin line of light
//   * real textures drawn in code: wood grain, patterned tiles, wallpaper, a rug
//   * corners and the floor under things are darker (the materials know where
//     the walls of the room are: see roomShade below), soft shadows under feet
//   * colours vary a little from piece to piece, nothing is perfectly straight
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MeshBuilder } from '../utils/geometry.js';
import { makeNormalRoughTexture } from '../utils/noise.js';

const TAU = Math.PI * 2;
// small repeatable random numbers (the same room looks the same every time)
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ====================================================================== pictures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(cv, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
// soft noise on a canvas (for wood, plaster, cloth)
function speckle(g, w, h, n, a, r = rng(7), size = 2) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${a * r()})`; g.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r())); }
}

// WOOD: light grey grain (the colour comes from each piece), 1 copy = 1 m along the grain
function drawWood(g, w, h) {
  const r = rng(11);
  g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 1) {
    const k = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 6) * 0.5 + 0.5;
    g.fillStyle = `rgba(70,45,25,${0.05 + 0.13 * k * k})`; g.fillRect(0, y, w, 1);
  }
  // long fibres, a few knots
  for (let i = 0; i < 260; i++) { const y = r() * h, x = r() * w, l = 40 + r() * 220; g.strokeStyle = `rgba(60,38,20,${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + (r() - 0.5) * 4, x + l * 0.7, y + (r() - 0.5) * 4, x + l, y + (r() - 0.5) * 3); g.stroke(); }
  for (let i = 0; i < 4; i++) { const x = r() * w, y = r() * h; for (let k = 6; k > 0; k--) { g.strokeStyle = `rgba(60,35,18,${0.1 + 0.04 * k})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, k * 4.5, k * 1.6, 0, 0, TAU); g.stroke(); } }
  speckle(g, w, h, 3000, 0.05, r);
}
// FLOOR TILES of picture 1: blue and cream circles, 2 x 2 tiles per copy (1 copy = 0.6 m)
function drawTiles(g, w, h) {
  const n = 2, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * s, y = j * s;
    g.fillStyle = '#d9cfb6'; g.fillRect(x, y, s, s);
    g.fillStyle = '#5c7894';
    // four quarter circles in the corners and a ring in the middle: together they make circles across the floor
    for (const [cx, cy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) { g.beginPath(); g.arc(cx, cy, s * 0.36, 0, TAU); g.fill(); }
    g.fillStyle = '#d9cfb6'; for (const [cx, cy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) { g.beginPath(); g.arc(cx, cy, s * 0.22, 0, TAU); g.fill(); }
    g.strokeStyle = '#5c7894'; g.lineWidth = s * 0.05; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.19, 0, TAU); g.stroke();
    g.fillStyle = '#a36b3f'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.06, 0, TAU); g.fill();
  }
  // grout lines, wear
  g.strokeStyle = 'rgba(70,62,50,0.55)'; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  speckle(g, w, h, 2500, 0.07, rng(3), 3);
}
// TILE PANEL behind the stove: small blue and white patterned tiles (1 copy = 0.6 m)
function drawBacksplash(g, w, h) {
  const n = 4, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * s, y = j * s;
    g.fillStyle = '#ece6d8'; g.fillRect(x, y, s, s);
    g.fillStyle = '#3e6390';
    g.save(); g.translate(x + s / 2, y + s / 2);
    for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(0, -s * 0.24, s * 0.09, s * 0.2, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#c9a04a'; g.beginPath(); g.arc(0, 0, s * 0.08, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(60,80,110,0.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }
}
// WALL PLASTER: warm, with soft stains (1 copy = 2 m)
function drawPlaster(g, w, h) {
  const r = rng(5);
  g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, rad = 20 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${r() < 0.5 ? '120,95,60' : '255,250,235'},${0.04 + r() * 0.05})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  speckle(g, w, h, 9000, 0.06, r, 1.5);
}
// WALLPAPER of picture 3: pale with a fine pattern (1 copy = 0.5 m)
function drawWallpaper(g, w, h) {
  g.fillStyle = '#e4ddd0'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(150,138,120,0.35)';
  const n = 6, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i * s + (j % 2) * s / 2, y = j * s; g.beginPath(); g.moveTo(x + s / 2, y + s * 0.2); g.lineTo(x + s * 0.68, y + s / 2); g.lineTo(x + s / 2, y + s * 0.8); g.lineTo(x + s * 0.32, y + s / 2); g.closePath(); g.fill(); }
  g.fillStyle = 'rgba(150,138,120,0.18)'; for (let i = 0; i < w; i += s / 3) g.fillRect(i, 0, 1, h);
  speckle(g, w, h, 2500, 0.03, rng(9), 1.5);
}
// FLOOR PLANKS of picture 3: warm boards, staggered ends (1 copy = 1.2 m)
function drawPlanks(g, w, h) {
  const r = rng(21), rows = 8, bh = h / rows;
  for (let j = 0; j < rows; j++) {
    let x = -r() * w * 0.5;
    while (x < w) {
      const L = w * (0.35 + r() * 0.45), t = 0.75 + r() * 0.35;
      g.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(98 * t)},${Math.round(60 * t)})`;
      g.fillRect(x, j * bh, L, bh);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(60,30,12,${0.06 + r() * 0.1})`; g.fillRect(x, j * bh + r() * bh, L, 1 + r() * 2); }
      g.fillStyle = 'rgba(25,14,6,0.7)'; g.fillRect(x, j * bh, 2, bh);
      x += L;
    }
    g.fillStyle = 'rgba(25,14,6,0.75)'; g.fillRect(0, j * bh, w, 2);
  }
  speckle(g, w, h, 3000, 0.05, r);
}
// RUG of picture 3: deep red with borders and a middle pattern
function drawRug(g, w, h) {
  g.fillStyle = '#7a1a1a'; g.fillRect(0, 0, w, h);
  const band = (inset, color, lw) => { g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
  band(10, '#2c1a35', 16); band(30, '#d0a35a', 5); band(44, '#5a1414', 12); band(60, '#d8c49a', 3);
  g.save(); g.translate(w / 2, h / 2);
  for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.fillStyle = k % 2 ? '#c88a40' : '#2a1a3a'; g.beginPath(); g.ellipse(0, -h * 0.17, w * 0.05, h * 0.12, 0, 0, TAU); g.fill(); }
  g.fillStyle = '#e0cfa0'; g.beginPath(); g.arc(0, 0, w * 0.06, 0, TAU); g.fill();
  g.restore();
  const r = rng(4);
  for (let i = 0; i < 180; i++) { g.fillStyle = ['#c88a40', '#2a1a3a', '#e0cfa0', '#4a2010'][i % 4]; g.fillRect(80 + r() * (w - 160), 80 + r() * (h - 160), 4, 4); }
  speckle(g, w, h, 6000, 0.12, r, 2);
}
// CLOTH: a fine weave (blanket, curtain, seat)
function drawCloth(g, w, h) {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 3) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 1, h); }
  speckle(g, w, h, 4000, 0.05, rng(13), 2);
}
// PAPERS: an atlas of 8 cells (posters, notes, a calendar, a map, children's drawings)
function drawPapers(g, w, h) {
  const cw = w / 4, ch = h / 2, r = rng(31);
  const cell = (i, fn) => { const x = (i % 4) * cw, y = Math.floor(i / 4) * ch; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, cw, ch); g.clip(); fn(cw, ch); g.restore(); };
  // 0: a travel poster: a tower against a warm sky
  cell(0, (W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f0b45a'); gr.addColorStop(1, '#c4573a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#3a2430'; g.fillRect(W * 0.42, H * 0.25, W * 0.16, H * 0.6); g.fillRect(W * 0.36, H * 0.22, W * 0.28, H * 0.05); g.fillStyle = '#f4ead0'; g.font = `700 ${W * 0.13}px Georgia, serif`; g.textAlign = 'center'; g.fillText('PORTO', W / 2, H * 0.15); g.font = `${W * 0.08}px Georgia, serif`; g.fillText('MERIDIAN 08', W / 2, H * 0.94); });
  // 1: a recipe card, handwriting
  cell(1, (W, H) => { g.fillStyle = '#f2ead6'; g.fillRect(0, 0, W, H); g.fillStyle = '#7a3a2a'; g.font = `700 ${W * 0.1}px Georgia, serif`; g.fillText('Fish stew', W * 0.1, H * 0.13); g.strokeStyle = 'rgba(40,40,80,0.6)'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(W * 0.1, H * (0.22 + k * 0.08)); g.lineTo(W * (0.5 + r() * 0.4), H * (0.22 + k * 0.08)); g.stroke(); } });
  // 2: a calendar
  cell(2, (W, H) => { g.fillStyle = '#f6f2e8'; g.fillRect(0, 0, W, H); g.fillStyle = '#b03a2e'; g.fillRect(0, 0, W, H * 0.16); g.fillStyle = '#fff'; g.font = `700 ${W * 0.1}px Arial`; g.textAlign = 'center'; g.fillText('NOVEMBER', W / 2, H * 0.11); g.fillStyle = '#333'; g.font = `${W * 0.06}px Arial`; for (let k = 0; k < 30; k++) g.fillText(String(k + 1), W * (0.12 + (k % 7) * 0.127), H * (0.3 + Math.floor(k / 7) * 0.13)); g.strokeStyle = '#c33'; g.lineWidth = 3; g.beginPath(); g.arc(W * 0.37, H * 0.56, W * 0.06, 0, TAU); g.stroke(); });
  // 3: a city map with pins
  cell(3, (W, H) => { g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, W, H); g.strokeStyle = '#a8b8c8'; g.lineWidth = 3; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(0, H * k / 6); g.lineTo(W, H * k / 6 + (r() - 0.5) * 20); g.stroke(); g.beginPath(); g.moveTo(W * k / 6, 0); g.lineTo(W * k / 6 + (r() - 0.5) * 20, H); g.stroke(); } g.fillStyle = '#7aa0c8'; g.fillRect(0, H * 0.82, W, H * 0.18); for (let k = 0; k < 5; k++) { g.fillStyle = ['#c33', '#36c', '#3a3'][k % 3]; g.beginPath(); g.arc(W * (0.15 + r() * 0.7), H * (0.15 + r() * 0.6), 6, 0, TAU); g.fill(); } });
  // 4: a child's drawing: a sun, a house, a dog
  cell(4, (W, H) => { g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineWidth = 6; g.strokeStyle = '#f0b030'; g.beginPath(); g.arc(W * 0.78, H * 0.18, W * 0.08, 0, TAU); g.stroke(); g.strokeStyle = '#c03a2a'; g.beginPath(); g.moveTo(W * 0.15, H * 0.55); g.lineTo(W * 0.35, H * 0.35); g.lineTo(W * 0.55, H * 0.55); g.stroke(); g.strokeStyle = '#7a4a2a'; g.strokeRect(W * 0.18, H * 0.55, W * 0.34, H * 0.3); g.strokeStyle = '#333'; g.beginPath(); g.ellipse(W * 0.75, H * 0.75, W * 0.1, H * 0.06, 0, 0, TAU); g.stroke(); g.strokeStyle = '#3a8a3a'; g.beginPath(); g.moveTo(0, H * 0.86); g.lineTo(W, H * 0.86); g.stroke(); });
  // 5: notes on lined paper
  cell(5, (W, H) => { g.fillStyle = '#f8f4e0'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,120,200,0.35)'; g.lineWidth = 1; for (let k = 1; k < 14; k++) { g.beginPath(); g.moveTo(0, H * k / 14); g.lineTo(W, H * k / 14); g.stroke(); } g.strokeStyle = 'rgba(30,30,60,0.75)'; g.lineWidth = 2; for (let k = 2; k < 11; k++) { g.beginPath(); g.moveTo(W * 0.08, H * k / 14 - 3); g.lineTo(W * (0.3 + r() * 0.6), H * k / 14 - 3); g.stroke(); } });
  // 6: a band poster (made up), dark with big letters
  cell(6, (W, H) => { g.fillStyle = '#1e2a3a'; g.fillRect(0, 0, W, H); g.fillStyle = '#e8c04a'; g.font = `900 ${W * 0.2}px Arial`; g.textAlign = 'center'; g.fillText('LOW', W / 2, H * 0.35); g.fillText('TIDE', W / 2, H * 0.55); g.fillStyle = '#e8e0d0'; g.font = `${W * 0.07}px Arial`; g.fillText('LIVE AT THE PIER', W / 2, H * 0.75); });
  // 7: a planet poster
  cell(7, (W, H) => { g.fillStyle = '#101826'; g.fillRect(0, 0, W, H); for (let k = 0; k < 80; k++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * W, r() * H, 2, 2); } const gr = g.createRadialGradient(W * 0.4, H * 0.45, 5, W / 2, H / 2, W * 0.32); gr.addColorStop(0, '#f0c070'); gr.addColorStop(1, '#a04a20'); g.fillStyle = gr; g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(230,200,150,0.8)'; g.lineWidth = 4; g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.45, H * 0.08, -0.3, 0, TAU); g.stroke(); });
}
// LABELS: an atlas of 8 jar and book labels
function drawLabels(g, w, h) {
  const colors = ['#b03a2e', '#2e5a8a', '#4a7a3a', '#c89a3a', '#6a3a7a', '#2a2a2a', '#d0c8b0', '#8a5a2a'];
  colors.forEach((c, i) => { const x = (i % 4) * (w / 4), y = Math.floor(i / 4) * (h / 2); g.fillStyle = c; g.fillRect(x, y, w / 4, h / 2); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + w / 16, y + h / 8, w / 8, h / 16); g.fillRect(x + w / 16, y + h * 0.3, w / 10, h / 30); });
}
// THE VIEW through a window: day / evening / night side by side (u 0..1/3, 1/3..2/3, 2/3..1)
function drawView(g, w, h) {
  const third = w / 3;
  const sky = (x0, top, bottom) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(x0, 0, third, h); };
  sky(0, '#bcd8f0', '#fdf2d8'); sky(third, '#283a66', '#f0a070'); sky(third * 2, '#05080f', '#141c30');
  const r = rng(55);
  for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; g.fillRect(third * 2 + r() * third, r() * h * 0.7, 1.5, 1.5); }
  // roofs and a tree across the street
  for (let b = 0; b < 3; b++) {
    const x0 = b * third, dark = ['#8a8a82', '#2a2a34', '#05070c'][b];
    g.fillStyle = dark;
    g.fillRect(x0, h * 0.62, third * 0.45, h * 0.38); g.fillRect(x0 + third * 0.55, h * 0.5, third * 0.45, h * 0.5);
    g.beginPath(); g.arc(x0 + third * 0.5, h * 0.62, third * 0.14, 0, TAU); g.fill();
    if (b > 0) { g.fillStyle = b === 1 ? '#ffd890' : '#e0b060'; for (let k = 0; k < 6; k++) g.fillRect(x0 + third * (0.6 + (k % 3) * 0.12), h * (0.58 + Math.floor(k / 3) * 0.14), third * 0.05, h * 0.06); }
  }
}
// WALL TILES of picture 2: small cream squares with grey lines (1 copy = 0.6 m, 4 x 4 tiles)
function drawWallTiles(g, w, h) {
  const n = 4, s = w / n, r = rng(17);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = 0.96 + r() * 0.06;
    g.fillStyle = `rgb(${Math.round(236 * k)},${Math.round(226 * k)},${Math.round(200 * k)})`; g.fillRect(i * s, j * s, s, s);
    // a soft shine at the top of each tile (glaze)
    const gr = g.createLinearGradient(0, j * s, 0, j * s + s); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)');
    g.fillStyle = gr; g.fillRect(i * s, j * s, s, s);
  }
  g.strokeStyle = 'rgba(120,112,98,0.8)'; g.lineWidth = 4;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  speckle(g, w, h, 1200, 0.04, r, 2);
}
// PAINTED WALL: a clean, matt paint with a very fine roll texture (the colour comes from the room)
function drawWallPaint(g, w, h) {
  g.fillStyle = '#efede9'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 6000, 0.025, rng(29), 1.5);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${i % 2 ? '0,0,0' : '255,255,255'},0.012)`; g.fillRect(0, (i * 37) % h, w, 3); }
}
// CHECKERED FLOOR of the flat: cream and dark red squares, a little worn (1 copy = 0.6 m, 2 x 2 squares)
function drawChecker(g, w, h) {
  const n = 2, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = (i + j) % 2 ? '#8c3a2c' : '#e2d6bc'; g.fillRect(i * s, j * s, s, s); }
  g.strokeStyle = 'rgba(40,30,25,0.45)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  speckle(g, w, h, 4000, 0.08, rng(19), 2);
}
// CORK for the pin board: warm brown with many small dark and light grains
function drawCork(g, w, h) {
  g.fillStyle = '#b4834f'; g.fillRect(0, 0, w, h);
  const r = rng(23);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.55 ? `rgba(80,45,20,${0.2 + r() * 0.4})` : `rgba(235,195,140,${0.2 + r() * 0.4})`; const z = 1 + r() * 3; g.fillRect(r() * w, r() * h, z, z * (0.5 + r())); }
}
// a soft round shadow (for under the feet of furniture)
function drawBlob(g, w, h) { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
// a beam of light: bright at the window, fading along its length and at the sides
function drawBeam(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, w, 0); side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(0.25, 'rgba(0,0,0,1)'); side.addColorStop(0.75, 'rgba(0,0,0,1)'); side.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = side; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

// ====================================================================== materials
// The whole house shares these. "Room shade": the material knows the boxes of the rooms (up to 3) and makes the
// light darker near corners and edges - where the walls, the floor and the ceiling meet - like soft bounced light.
export const roomShade = { uRoomA: { value: new THREE.Vector4() }, uRoomB: { value: new THREE.Vector4() }, uRoomC: { value: new THREE.Vector4() }, uRoomH: { value: new THREE.Vector3(2.8, 2.8, 2.8) }, uRoomY: { value: 0 } };
function shaded(m) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, roomShade);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoomPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n\tvRoomPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'varying vec3 vRoomPos;',
        'uniform vec4 uRoomA, uRoomB, uRoomC;',      // minX, minZ, maxX, maxZ of each room (world)
        'uniform vec3 uRoomH;',                       // height of each room
        'uniform float uRoomY;',                      // the floor
        // how much a point is closed in by the walls of one room (0 open .. 1 deep in a corner)
        'float pgRoomOcc( vec4 r, float h, vec3 p, vec3 n ) {',
        '\tif ( p.x < r.x - 0.05 || p.x > r.z + 0.05 || p.z < r.y - 0.05 || p.z > r.w + 0.05 ) return -1.0;',
        '\tfloat y = p.y - uRoomY;',
        '\tvec3 lo = vec3( p.x - r.x, y, p.z - r.y ), hi = vec3( r.z - p.x, h - y, r.w - p.z );',
        '\tfloat o = 0.0;',
        // (a surface is not darkened by the wall it lies on: only by the walls across its edges)
        '\to += exp( -lo.x / 0.42 ) * ( 1.0 - abs( n.x ) ) + exp( -hi.x / 0.42 ) * ( 1.0 - abs( n.x ) );',
        '\to += exp( -lo.z / 0.42 ) * ( 1.0 - abs( n.z ) ) + exp( -hi.z / 0.42 ) * ( 1.0 - abs( n.z ) );',
        '\to += exp( -lo.y / 0.3 ) * ( 1.0 - abs( n.y ) ) * 0.9 + exp( -hi.y / 0.5 ) * ( 1.0 - abs( n.y ) ) * 0.8;',
        '\treturn clamp( o * 0.5, 0.0, 1.0 );',
        '}',
      ].join('\n'))
      .replace('#include <aomap_fragment>', [
        '#include <aomap_fragment>',
        '\t{',
        '\t\tvec3 wn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );',      // the surface direction in the world
        '\t\tfloat o = pgRoomOcc( uRoomA, uRoomH.x, vRoomPos, wn );',
        '\t\tif ( o < 0.0 ) o = pgRoomOcc( uRoomB, uRoomH.y, vRoomPos, wn );',
        '\t\tif ( o < 0.0 ) o = pgRoomOcc( uRoomC, uRoomH.z, vRoomPos, wn );',
        '\t\tfloat ao = 1.0 - 0.62 * max( o, 0.0 );',
        '\t\treflectedLight.indirectDiffuse *= ao;',
        '\t\treflectedLight.directDiffuse *= mix( 1.0, ao, 0.45 );',
        '\t\treflectedLight.indirectSpecular *= ao;',
        '\t}',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'pg-room';
  return m;
}

// THE VIEW through the windows: the picture has day, evening and night side by side; these weights mix them
// (interiors.js sets them from the hour, so the view changes slowly while you are inside)
export const viewMix = { uViewW: { value: new THREE.Vector3(1, 0, 0) } };
function viewShader(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uViewW = viewMix.uViewW;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uViewW;')
      .replace('#include <map_fragment>', [
        '#ifdef USE_MAP',
        '\tvec2 vu = vec2( clamp( vMapUv.x, 0.01, 0.99 ) / 3.0, vMapUv.y );',
        '\tvec4 vc = texture2D( map, vu ) * uViewW.x + texture2D( map, vu + vec2( 1.0 / 3.0, 0.0 ) ) * uViewW.y + texture2D( map, vu + vec2( 2.0 / 3.0, 0.0 ) ) * uViewW.z;',
        '\tdiffuseColor *= vc;',
        '#endif',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'pg-view';
  return m;
}

let MATS = null;
// the shared materials (made once)
export function materials(renderer) {
  if (MATS) return MATS;
  const mk = (draw, w, h) => { const cv = canvas(w, h); draw(cv.getContext('2d'), w, h); return cv; };
  const woodCv = mk(drawWood, 512, 512), tileCv = mk(drawTiles, 512, 512), plankCv = mk(drawPlanks, 512, 512), plasterCv = mk(drawPlaster, 512, 512), clothCv = mk(drawCloth, 256, 256);
  const wallTileCv = mk(drawWallTiles, 256, 256), checkerCv = mk(drawChecker, 256, 256), corkCv = mk(drawCork, 256, 256), paintCv = mk(drawWallPaint, 256, 256);
  const normal = (cv, strength, rough) => makeNormalRoughTexture(cv, { size: 256, strength, roughness: rough });
  const std = (o) => shaded(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
  MATS = {
    wood: std({ map: tex(woodCv), normalMap: normal(woodCv, 1.6, 0.6), roughness: 0.62, normalScale: new THREE.Vector2(0.35, 0.35) }),
    paint: std({ roughness: 0.42 }),                                     // painted wood, enamel
    gloss: std({ roughness: 0.16 }),                                     // plates, cups, enamel stove, tiles in glaze
    metal: std({ roughness: 0.32, metalness: 0.92 }),                    // pans, handles, chrome
    cloth: std({ map: tex(clothCv), roughness: 0.96 }),
    plaster: std({ map: tex(plasterCv), normalMap: normal(plasterCv, 0.8, 0.92), roughness: 0.92, normalScale: new THREE.Vector2(0.5, 0.5) }),
    wallpaper: std({ map: tex(mk(drawWallpaper, 256, 256)), roughness: 0.9 }),
    tiles: std({ map: tex(tileCv), normalMap: normal(tileCv, 0.9, 0.35), roughness: 0.38 }),
    backsplash: std({ map: tex(mk(drawBacksplash, 256, 256)), roughness: 0.22 }),
    planks: std({ map: tex(plankCv), normalMap: normal(plankCv, 1.2, 0.55), roughness: 0.55, normalScale: new THREE.Vector2(0.4, 0.4) }),
    rug: std({ map: tex(mk(drawRug, 512, 512), false), roughness: 1 }),
    papers: std({ map: tex(mk(drawPapers, 1024, 512), false), roughness: 0.9, side: THREE.DoubleSide }),
    labels: std({ map: tex(mk(drawLabels, 256, 128), false), roughness: 0.6 }),
    walltile: std({ map: tex(wallTileCv), normalMap: normal(wallTileCv, 1.4, 0.25), roughness: 0.25 }),
    checker: std({ map: tex(checkerCv), normalMap: normal(checkerCv, 0.6, 0.4), roughness: 0.45 }),
    cork: std({ map: tex(corkCv), roughness: 0.95 }),
    wallpaint: std({ map: tex(paintCv), roughness: 0.9 }),
    // thin cloth with the sun behind it: it glows a little (interiors.js turns the glow up and down)
    curtain: shaded(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex(clothCv), roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9, emissive: new THREE.Color(0, 0, 0) })),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    // the glass of a window: almost clear, so what is outside (day, evening, night) is what you see through it
    pane: new THREE.MeshStandardMaterial({ color: 0x0c1014, transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0, depthWrite: false }),
    view: viewShader(new THREE.MeshBasicMaterial({ map: tex(mk(drawView, 768, 256), false), toneMapped: true })),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),          // lamp bulbs (dim by day, when they are off)
    screen: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),        // screens, fridge and ceiling lights (always on)
    blob: new THREE.MeshBasicMaterial({ map: tex(mk(drawBlob, 128, 128), false), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.85 }),
    beam: new THREE.MeshBasicMaterial({ map: tex(mk(drawBeam, 64, 256), false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.2, toneMapped: true }),
  };
  MATS.blob.color.setRGB(1, 1, 1);
  return MATS;
}

// ====================================================================== the builder of one house
// All pieces of a house go through this. b = createBuilder(origin) ... b.finish(scene) -> { group, meshes }
export function createBuilder(origin = [0, 0, 0], seed = 1) {
  const R = rng(seed);
  const mbs = {};                        // one MeshBuilder per material name
  const mb = (name) => (mbs[name] = mbs[name] || new MeshBuilder());
  const colliders = [];                  // boxes in room space: { x0, z0, x1, z1, h }
  const blobs = [];                      // soft shadows: [x, z, rx, rz, strength]
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  const cache = new Map();
  // a rounded box geometry of this size (kept: rooms reuse many sizes)
  const rounded = (sx, sy, sz, r) => {
    r = Math.min(r, sx / 2 - 0.001, sy / 2 - 0.001, sz / 2 - 0.001);
    const key = `${sx.toFixed(3)}|${sy.toFixed(3)}|${sz.toFixed(3)}|${r.toFixed(3)}`;
    // (small edges: one cut is enough and costs a third of the triangles; big soft cushions get two)
    if (!cache.has(key)) cache.set(key, r > 0.002 ? new RoundedBoxGeometry(sx, sy, sz, r > 0.035 ? 2 : 1, r) : new THREE.BoxGeometry(sx, sy, sz));
    return cache.get(key);
  };
  const col = (c, vary = 0.06) => { const k = 1 + (R() - 0.5) * vary; return [c[0] * k, c[1] * k, c[2] * k]; };
  // put a geometry into a material's builder: position (room space, the middle of the piece), turn (radians about y), colour
  function put(mat, geo, x, y, z, rotY = 0, color = [1, 1, 1], rot = null, uvScale = null) {
    _e.set(rot ? rot[0] : 0, rotY, rot ? rot[2] : 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
    const m = mb(mat);
    m.color(color[0], color[1], color[2], 1);
    const first = m.count;
    m.addGeometry(geo, _m);
    if (uvScale) for (let i = first; i < m.count; i++) { m.uv[i * 2] *= uvScale[0]; m.uv[i * 2 + 1] *= uvScale[1]; }
  }
  // a box with soft edges. (x, y, z) = the middle of its bottom face (furniture stands on things)
  // o: { r (edge radius), rot (turn about y), tilt (about x), roll (about z), uv: [u, v] (texture repeats) }
  function box(mat, x, y, z, sx, sy, sz, color, o = {}) {
    put(mat, rounded(sx, sy, sz, o.r === undefined ? 0.012 : o.r), x, y + sy / 2, z, o.rot || 0, color, o.tilt || o.roll ? [o.tilt || 0, 0, o.roll || 0] : null, o.uv || null);
  }
  // any geometry made by the caller (curtains with folds, a bent rail): it is used once, then thrown away
  function geo(mat, g, x, y, z, rotY = 0, color = [1, 1, 1], rot = null) { put(mat, g, x, y, z, rotY, color, rot); cache.set('G' + cache.size, g); }
  // a turned shape (plates, cups, bottles, vases, lamp shades): profile = [[radius, height], ...]
  // (rot = [rx, ry, rz]: a plate standing on its edge, a tilted bowl)
  function lathe(mat, x, y, z, profile, color, seg = 18, rotY = 0, scale = 1, rot = null) {
    const key = 'L' + JSON.stringify(profile) + seg;
    if (!cache.has(key)) cache.set(key, new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), seg));
    let g = cache.get(key);
    if (scale !== 1) { g = g.clone(); g.scale(scale, scale, scale); }
    put(mat, g, x, y, z, rot ? rot[1] || 0 : rotY, color, rot);
  }
  // a cylinder (r0 at the bottom, r1 at the top). Standing: (x, y, z) = the middle of its bottom.
  // Lying or tilted (rot = [rx, ry, rz]): (x, y, z) = its middle.
  function cyl(mat, x, y, z, r0, r1, h, color, seg = 12, rot = null) {
    const key = `C${r0}|${r1}|${h}|${seg}`;
    if (!cache.has(key)) { const g = new THREE.CylinderGeometry(r1, r0, h, seg); cache.set(key, g); }
    put(mat, cache.get(key), x, y + (rot ? 0 : h / 2), z, rot ? rot[1] || 0 : 0, color, rot);
  }
  function sphere(mat, x, y, z, r, color, seg = 12) {
    const key = `S${r}|${seg}`;
    if (!cache.has(key)) cache.set(key, new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6)));
    put(mat, cache.get(key), x, y, z, 0, color);
  }
  function torus(mat, x, y, z, R0, r, color, rot = [0, 0, 0], arc = TAU) {
    const key = `T${R0}|${r}|${arc}`;
    if (!cache.has(key)) cache.set(key, new THREE.TorusGeometry(R0, r, 6, 16, arc));
    put(mat, cache.get(key), x, y, z, rot[1], color, rot);
  }
  // a flat picture on a wall or a table: atlas cell (0..7), w x h, facing direction (radians about y; 0 = faces +z)
  function paper(x, y, z, w, h, cell, rotY = 0, tilt = 0, mat = 'papers', cols = 4, rows = 2) {
    const g = new THREE.PlaneGeometry(w, h);
    const u0 = (cell % cols) / cols, v0 = 1 - (Math.floor(cell / cols) + 1) / rows, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / cols, v0 + uv.getY(i) / rows);
    put(mat, g, x, y, z, rotY, col([1, 1, 1], 0.08), [tilt, 0, (R() - 0.5) * 0.05]);
  }
  // a plain flat quad of a material with its texture in meters (floors, walls)
  function plane(mat, corners, normal, tile = 1, color = [1, 1, 1]) {
    const m = mb(mat); m.color(color[0], color[1], color[2], 1);
    m.quadAuto(corners[0], corners[1], corners[2], corners[3], normal, tile);
  }
  const solid = (x0, z0, x1, z1, h) => colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h });
  const shadow = (x, z, rx, rz, k = 1, rot = 0) => blobs.push([x, z, rx, rz, k, rot]);

  // ---------------------------------------------------------------- finish: the meshes of the house
  function finish(parent, M) {
    const group = new THREE.Group();
    group.position.set(origin[0], origin[1], origin[2]);
    // soft shadows on the floor
    if (blobs.length) {
      const b = mb('blob');
      for (const [x, z, rx, rz, k, rot] of blobs) {
        b.color(1, 1, 1, Math.min(1, k));
        const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
        const P = (u, v) => [x + u * c + v * s, 0.006, z - u * s + v * c];
        b.quad(P(-rx, rz), P(rx, rz), P(rx, -rz), P(-rx, -rz), [0, 1, 0], [0, 1], [1, 1], [1, 0], [0, 0]);
      }
    }
    const meshes = {};
    for (const [name, m] of Object.entries(mbs)) {
      if (!m.count) continue;
      const geo = m.build(false);
      const mesh = new THREE.Mesh(geo, M[name]);
      mesh.castShadow = !['blob', 'glass', 'pane', 'view', 'glow', 'screen', 'beam', 'papers'].includes(name);
      mesh.receiveShadow = !['glow', 'screen', 'view', 'beam'].includes(name);
      if (name === 'blob') mesh.renderOrder = 2;
      if (name === 'glass' || name === 'pane') mesh.renderOrder = 5;
      group.add(mesh);
      meshes[name] = mesh;
    }
    for (const g of cache.values()) g.dispose();
    parent.add(group);
    return { group, meshes };
  }

  return { R, col, put, box, geo, lathe, cyl, sphere, torus, paper, plane, solid, shadow, finish, mb, colliders, blobs };
}
