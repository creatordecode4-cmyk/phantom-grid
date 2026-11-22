// ---------------------------------------------------------------------------
// furniture2.js - more pieces, for the rooms that are made by the game itself
// (generate.js): homes, little shops, cafés, offices, lobbies, garages.
// Same rules as furniture.js: each piece is drawn in its own frame (x to its
// right, z to its front, y up; (0, 0, 0) = the middle of its foot print).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { C, books, plant, bottle, jar, mug, cup, plate, bowl } from './furniture.js';
import { pillowGeometry } from '../utils/softShapes.js';

const TAU = Math.PI * 2;
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const DARK = C('#1d1b19'), CHROME = C('#d6d8da'), STEEL = C('#8e9499'), WHITE = C('#f2efe8'), BRASS = C('#c49a55');
const SHADE_IN = [[0.004, 0.2], [0.03, 0.2], [0.04, 0.17], [0.07, 0.12], [0.15, 0.03], [0.19, 0]];
const SHADE_OUT = SHADE_IN.slice().reverse().map(([r, h]) => [r * 1.03, h + 0.002]);

// ======================================================================= the home
// a sofa with three seat cushions, a back, two arms and two throw pillows (front = +z)
export function sofa(P, o = {}) {
  const w = o.w || 2.0, d = 0.9, c = o.color || C('#5a6e7a');
  P.box('cloth', 0, 0.1, 0, w, 0.28, d, mul(c, 0.9), { r: 0.06 });
  const n = w > 1.7 ? 3 : 2, cw = (w - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.18 + cw * (i + 0.5);
    P.box('cloth', x, 0.38, 0.07, cw - 0.02, 0.14, d - 0.3, c, { r: 0.05 });
    P.box('cloth', x, 0.38, -d / 2 + 0.14, cw - 0.03, 0.46, 0.2, mul(c, 0.96), { r: 0.07, tilt: -0.14 });
  }
  for (const sx of [-1, 1]) P.box('cloth', sx * (w / 2 - 0.09), 0.1, 0, 0.18, 0.5, d, mul(c, 0.88), { r: 0.07 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl('wood', sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 0.025, 0.02, 0.1, C('#3a2a1e'), 8);
  // two soft throw pillows leaning on the back (puffy, with a seam: src/utils/softShapes.js)
  const pc = o.pillow || C('#d9a441');
  P.geo('cloth', pillowGeometry(0.42, 0.4, 0.15, { nu: 10, nv: 10, seed: 3 }), -w / 2 + 0.38, 0.69, -d / 2 + 0.21, 0.25, pc, [Math.PI / 2 - 0.28, 0, 0]);
  P.geo('cloth', pillowGeometry(0.42, 0.4, 0.15, { nu: 10, nv: 10, seed: 6 }), w / 2 - 0.38, 0.69, -d / 2 + 0.21, -0.2, mul(pc, 0.8), [Math.PI / 2 - 0.3, 0, 0]);
  P.shadow(0, 0, w * 0.56, d * 0.62, 0.85);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, 0.75);
}
// a low coffee table with a magazine and a mug
export function coffeeTable(P, o = {}) {
  const w = o.w || 1.0, d = o.d || 0.55, h = 0.42, c = o.color || C('#8a5a34');
  P.box('wood', 0, h - 0.04, 0, w, 0.04, d, c, { r: 0.012, uv: [w, d] });
  P.box('wood', 0, 0.1, 0, w - 0.1, 0.02, d - 0.1, mul(c, 0.85), { r: 0.005 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box('wood', sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 0.045, h - 0.04, 0.045, mul(c, 0.9), { r: 0.008 });
  P.paper(-0.18, h + 0.002, 0.02, 0.21, 0.28, 6, 0.3, -Math.PI / 2);
  mug(P, 0.24, h, -0.06, o.mug || C('#d84a3a'), 0.8);
  P.shadow(0, 0, w * 0.6, d * 0.62, 0.55);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a low cabinet with a flat television on it (the screen glows a little at night)
export function tvUnit(P, o = {}) {
  const w = o.w || 1.5, d = 0.42, c = o.color || C('#6b4a32');
  P.box('wood', 0, 0.06, 0, w, 0.44, d, c, { r: 0.012, uv: [w, 1] });
  for (const sx of [-1, 1]) P.box('wood', sx * w / 4, 0.1, d / 2, w / 2 - 0.04, 0.36, 0.02, mul(c, 1.07), { r: 0.006 });
  for (const sx of [-1, 1]) P.box('metal', sx * (w / 2 - 0.08), 0, 0, 0.04, 0.06, d - 0.08, DARK, { r: 0.005 });
  // the television: a thin dark frame and glass
  const tw = Math.min(1.25, w - 0.2), th = tw * 0.58;
  P.box('metal', 0, 0.5, -0.04, 0.3, 0.02, 0.16, DARK, { r: 0.006 });
  P.box('metal', 0, 0.5, -0.04, 0.05, 0.1, 0.04, DARK, { r: 0.006 });
  P.box('gloss', 0, 0.58, -0.05, tw, th, 0.035, C('#141618'), { r: 0.008 });
  P.box('screen', 0, 0.6, -0.03, tw - 0.05, th - 0.05, 0.004, o.screen || [0.012, 0.016, 0.022], { r: 0 });
  books(P, w / 2 - 0.3, 0.5, 0.02, 2, { lying: true });
  P.shadow(0, 0, w * 0.56, d * 0.62, 0.7);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, 0.5);
}
// a tall bookcase full of books, with a few things between them (front = +z)
export function bookcase(P, o = {}) {
  const w = o.w || 0.9, d = 0.32, h = o.h || 1.9, c = o.color || C('#7a5130');
  P.box('wood', 0, 0, -d / 2 + 0.01, w, h, 0.02, mul(c, 0.8));
  for (const sx of [-1, 1]) P.box('wood', sx * (w / 2 - 0.012), 0, 0, 0.024, h, d, c, { r: 0.005 });
  const n = 5;
  for (let i = 0; i <= n; i++) P.box('wood', 0, i === 0 ? 0 : (h - 0.03) * (i / n), 0, w - 0.02, 0.03, d, c, { r: 0.004 });
  for (let i = 0; i < n; i++) {
    const y = (h - 0.03) * (i / n) + 0.03;
    const end = books(P, -w / 2 + 0.04, y, 0.0, 6 + Math.floor(P.R() * 7), { h: 0.22 + P.R() * 0.06, d: 0.2, lean: true });
    if (end < w / 2 - 0.18 && P.R() < 0.6) jar(P, Math.min(end + 0.1, w / 2 - 0.1), y, 0.02, C('#c8b890'), 0.8);
  }
  P.shadow(0, 0, w * 0.6, d * 0.7, 0.8);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a floor lamp: a heavy foot, a thin pole, a shade (the room puts a real light at its bulb)
export function floorLamp(P, x, z, color = C('#e8dcc0')) {
  P.cyl('metal', x, 0, z, 0.14, 0.15, 0.03, DARK, 18);
  P.cyl('metal', x, 0.03, z, 0.011, 0.011, 1.42, BRASS, 8);
  P.lathe('cloth', x, 1.28, z, SHADE_OUT.map(([r, h]) => [r * 1.05, h * 1.6]), color, 20);
  P.lathe('cloth', x, 1.28, z, SHADE_IN.map(([r, h]) => [r * 1.0, h * 1.6]), mul(color, 1.05), 20);
  P.sphere('glow', x, 1.36, z, 0.04, [3, 2.3, 1.4], 10);
  P.shadow(x, z, 0.18, 0.18, 0.7);
  P.solid(x - 0.16, z - 0.16, x + 0.16, z + 0.16, 1.6);
  return P.at(x, 1.33, z);
}
// a little dining table for two with two chairs is made from furniture.js; this is a round one
export function roundTable(P, o = {}) {
  const r = o.r || 0.36, h = o.h || 0.74, top = o.color || C('#e8e2d4');
  P.cyl(o.topMat || 'gloss', 0, h - 0.03, 0, r, r, 0.03, top, 24);
  P.cyl('metal', 0, 0.02, 0, 0.025, 0.025, h - 0.05, DARK, 10);
  P.cyl('metal', 0, 0, 0, 0.2, 0.22, 0.025, DARK, 18);
  P.shadow(0, 0, r * 0.9, r * 0.9, 0.6);
  P.solid(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6, h);
}
// a bistro chair: a thin metal frame and a round wooden seat (front = +z)
export function bistroChair(P, o = {}) {
  const fc = o.color || DARK, seat = o.seat || C('#9a6a3e'), sh = 0.46;
  P.cyl('wood', 0, sh - 0.025, 0, 0.2, 0.2, 0.03, seat, 18);
  for (let i = 0; i < 4; i++) { const a = (i + 0.5) * (TAU / 4); P.cyl('metal', Math.cos(a) * 0.15, (sh - 0.03) / 2, Math.sin(a) * 0.15, 0.01, 0.01, sh - 0.03, fc, 6, [Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08]); }
  P.torus('metal', 0, 0.17, 0, 0.16, 0.007, fc, [Math.PI / 2, 0, 0]);
  for (const sx of [-1, 1]) P.cyl('metal', sx * 0.15, sh + 0.2, -0.15, 0.01, 0.01, 0.42, fc, 6, [-0.12, 0, 0]);
  P.torus('metal', 0, sh + 0.38, -0.19, 0.15, 0.01, fc, [0, 0, 0], Math.PI);
  P.shadow(0, 0, 0.22, 0.22, 0.45);
  P.solid(-0.18, -0.18, 0.18, 0.18, sh);
}

// ======================================================================= the shop
// a shelf you can walk around (both sides full of things to buy); its length runs along x
export function gondola(P, o = {}) {
  const L = o.l || 2.4, d = 0.9, h = o.h || 1.55, c = o.color || C('#e9e6e0'), R = P.R;
  P.box('paint', 0, 0, 0, L, 0.12, d, mul(c, 0.8), { r: 0.01 });
  P.box('paint', 0, 0.12, 0, L, h - 0.12, 0.05, c, { r: 0.006 });
  for (const sx of [-1, 1]) P.box('paint', sx * (L / 2 - 0.02), 0, 0, 0.04, h, d, mul(c, 0.95), { r: 0.006 });
  const goods = [C('#d84a3a'), C('#3a7ad2'), C('#e8c030'), C('#5aa04a'), C('#f2efe8'), C('#e07a1c'), C('#8a4ab0'), C('#2a2a2a')];
  for (const side of [-1, 1]) for (let lvl = 0; lvl < 4; lvl++) {
    const y = 0.12 + lvl * ((h - 0.2) / 4);
    P.box('paint', 0, y, side * (d / 4 + 0.01), L - 0.06, 0.025, d / 2 - 0.05, mul(c, 0.92), { r: 0.004 });
    P.box('paint', 0, y + 0.03, side * (d / 2 - 0.02), L - 0.06, 0.04, 0.01, C('#d8d0b8'), { r: 0 });
    // the things on the shelf: boxes, tins and bottles in rows
    let x = -L / 2 + 0.08;
    while (x < L / 2 - 0.1) {
      const kind = R(), col = goods[Math.floor(R() * goods.length)], n = 2 + Math.floor(R() * 4);
      if (kind < 0.45) { const bw = 0.12 + R() * 0.1, bh = 0.14 + R() * 0.14; for (let k = 0; k < n && x < L / 2 - 0.1; k++) { P.box('paint', x + bw / 2, y + 0.025, side * (d / 4 + 0.02), bw, bh, 0.18, col, { r: 0.006 }); x += bw + 0.01; } }
      else if (kind < 0.75) { for (let k = 0; k < n && x < L / 2 - 0.1; k++) { P.cyl('metal', x + 0.035, y + 0.025, side * (d / 4 + 0.02), 0.034, 0.034, 0.11, col, 10); x += 0.075; } }
      else { for (let k = 0; k < n && x < L / 2 - 0.1; k++) { bottle(P, x + 0.04, y + 0.025, side * (d / 4 + 0.02), col, 0.75); x += 0.085; } }
      x += 0.04;
    }
  }
  P.shadow(0, 0, L * 0.55, d * 0.62, 0.7);
  P.solid(-L / 2, -d / 2, L / 2, d / 2, h);
}
// the shop counter with a till (front = +z, the shopkeeper's side is -z)
export function shopCounter(P, o = {}) {
  const w = o.w || 1.6, d = 0.6, h = 0.98, c = o.color || C('#8a5a34');
  P.box('wood', 0, 0, 0, w, h - 0.04, d, c, { r: 0.012, uv: [w, 1] });
  P.box(o.topMat || 'gloss', 0, h - 0.04, 0, w + 0.04, 0.04, d + 0.04, o.top || C('#d8d4cc'), { r: 0.01 });
  // the till: a screen on a stand, a keyboard, a card reader
  P.box('metal', -w / 2 + 0.35, h, -0.05, 0.3, 0.06, 0.26, DARK, { r: 0.01 });
  P.box('metal', -w / 2 + 0.35, h + 0.06, -0.08, 0.04, 0.18, 0.04, DARK, { r: 0.006 });
  P.box('gloss', -w / 2 + 0.35, h + 0.2, -0.08, 0.3, 0.2, 0.025, C('#202326'), { r: 0.006, tilt: -0.3 });
  P.box('screen', -w / 2 + 0.35, h + 0.205, -0.066, 0.26, 0.16, 0.004, [0.35, 0.6, 0.8], { r: 0, tilt: -0.3 });
  P.box('metal', -w / 2 + 0.7, h, 0.05, 0.09, 0.03, 0.15, C('#2a2a2a'), { r: 0.008 });
  // small things to grab on the counter: sweets in jars, a stand of newspapers
  for (let i = 0; i < 3; i++) jar(P, w / 2 - 0.15 - i * 0.14, h, 0.12, [C('#d84a3a'), C('#e8c030'), C('#5aa04a')][i], 0.9);
  P.shadow(0, 0, w * 0.58, d * 0.62, 0.7);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a tall fridge with a glass door, full of bottles, lit from inside (front = +z)
export function drinksFridge(P, o = {}) {
  const w = o.w || 0.75, d = 0.7, h = 2.0, R = P.R;
  P.box('paint', 0, 0, 0, w, h, d, C('#e9ecee'), { r: 0.02 });
  P.box('screen', 0, 0.12, d / 2 - 0.04, w - 0.08, h - 0.32, 0.01, [0.75, 0.85, 0.95], { r: 0 });
  const cols = [C('#d84a3a'), C('#3a7ad2'), C('#5aa04a'), C('#e8c030'), C('#f2efe8'), C('#e07a1c')];
  for (let lvl = 0; lvl < 5; lvl++) {
    const y = 0.16 + lvl * 0.34;
    P.box('metal', 0, y, d / 2 - 0.2, w - 0.1, 0.012, 0.3, STEEL, { r: 0 });
    for (let k = 0; k < 6; k++) bottle(P, -w / 2 + 0.1 + k * ((w - 0.2) / 5), y + 0.012, d / 2 - 0.12, cols[Math.floor(R() * cols.length)], 0.8);
  }
  // (the glass door: only its frame is drawn, so the bottles behind it stay clear)
  P.box('metal', 0, 0.08, d / 2 + 0.005, w - 0.02, 0.04, 0.02, CHROME, { r: 0.004 });
  P.box('metal', 0, h - 0.24, d / 2 + 0.005, w - 0.02, 0.04, 0.02, CHROME, { r: 0.004 });
  for (const sx of [-1, 1]) P.box('metal', sx * (w / 2 - 0.02), 0.08, d / 2 + 0.005, 0.04, h - 0.28, 0.02, CHROME, { r: 0.004 });
  P.box('metal', w / 2 - 0.06, 0.8, d / 2 + 0.03, 0.025, 0.5, 0.03, CHROME, { r: 0.01 });
  P.box('screen', 0, h - 0.16, d / 2 + 0.005, w - 0.1, 0.1, 0.01, [1.6, 0.4, 0.3], { r: 0 });
  P.shadow(0, 0, w * 0.6, d * 0.6, 0.85);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}

// ======================================================================= the café
// the café counter: a coffee machine, a glass case with cakes, cups on top (front = +z, the guests' side)
export function cafeCounter(P, o = {}) {
  const w = o.w || 2.4, d = 0.65, h = 1.02, c = o.color || C('#3f5a4a');
  P.box('wood', 0, 0, 0, w, h - 0.04, d, c, { r: 0.012, uv: [w, 1] });
  for (let i = 0; i < Math.round(w / 0.3); i++) P.box('wood', -w / 2 + 0.15 + i * 0.3, 0.08, d / 2 + 0.005, 0.24, h - 0.2, 0.012, C('#c8a070'), { r: 0.004 });
  P.box('wood', 0, h - 0.04, 0, w + 0.05, 0.04, d + 0.05, C('#a8784a'), { r: 0.01, uv: [w, d] });
  // the coffee machine: a chrome box with two handles, cups on its top
  const mx = -w / 2 + 0.45;
  P.box('metal', mx, h, -0.12, 0.62, 0.45, 0.4, CHROME, { r: 0.03 });
  P.box('paint', mx, h + 0.08, 0.06, 0.5, 0.025, 0.12, DARK, { r: 0.006 });
  for (const k of [-0.14, 0.14]) { P.cyl('metal', mx + k, h + 0.25, 0.1, 0.02, 0.02, 0.1, DARK, 8, [Math.PI / 2, 0, 0]); cup(P, mx + k, h + 0.105, 0.06, WHITE, 0); }
  for (let i = 0; i < 4; i++) cup(P, mx - 0.2 + i * 0.13, h + 0.45, -0.12, WHITE, i);
  // the glass case with cakes
  const cx = w / 2 - 0.55;
  P.box('glass', cx, h, 0.0, 0.9, 0.38, 0.5, C('#d8e4e8'), { r: 0.015 });
  P.box('paint', cx, h + 0.02, 0.0, 0.84, 0.012, 0.44, WHITE, { r: 0 });
  const R = P.R;
  for (let i = 0; i < 6; i++) {
    const x = cx - 0.33 + (i % 3) * 0.33, z = i < 3 ? -0.1 : 0.12;
    plate(P, x, h + 0.035, z, WHITE, null, 0.8);
    if (R() < 0.5) P.cyl('cloth', x, h + 0.05, z, 0.06, 0.06, 0.07, [C('#8a4a2a'), C('#e8c8a0'), C('#c86a6a')][i % 3], 14);
    else for (let k = 0; k < 3; k++) P.sphere('cloth', x + (k - 1) * 0.05, h + 0.07, z, 0.035, C('#c88a45'), 8);
  }
  P.shadow(0, 0, w * 0.56, d * 0.62, 0.75);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// the board with the menu, on the wall (a dark board with chalk lines)
export function menuBoard(P, x, y, z, w = 1.4, h = 0.8) {
  P.box('wood', x, y, z + 0.015, w + 0.08, h + 0.08, 0.03, C('#5a3a22'), { r: 0.008 });
  P.box('paint', x, y + 0.04, z + 0.032, w, h, 0.006, C('#22282a'), { r: 0 });
  for (let i = 0; i < 6; i++) {
    const yy = y + h - 0.12 - i * (h / 7);
    P.box('paint', x - w * 0.18, yy, z + 0.037, w * 0.5 * (0.6 + 0.4 * ((i * 37) % 10) / 10), 0.018, 0.002, C('#e8e4d8'), { r: 0 });
    P.box('paint', x + w * 0.36, yy, z + 0.037, 0.12, 0.018, 0.002, C('#e8c030'), { r: 0 });
  }
}

// ======================================================================= the office
// a desk with a computer screen, a keyboard, papers and a mug (front = +z, where you sit)
export function officeDesk(P, o = {}) {
  const w = o.w || 1.4, d = 0.75, h = 0.74, top = o.color || C('#e9e4da'), R = P.R;
  P.box('paint', 0, h - 0.03, 0, w, 0.03, d, top, { r: 0.008 });
  for (const sx of [-1, 1]) { P.box('metal', sx * (w / 2 - 0.05), 0, 0, 0.05, h - 0.03, d - 0.1, STEEL, { r: 0.006 }); }
  P.box('metal', 0, 0.2, -d / 2 + 0.06, w - 0.12, 0.35, 0.02, mul(STEEL, 0.9), { r: 0.004 });
  // the screen
  P.box('metal', 0.05, h, -0.2, 0.22, 0.015, 0.16, DARK, { r: 0.005 });
  P.box('metal', 0.05, h, -0.21, 0.04, 0.2, 0.03, DARK, { r: 0.006 });
  P.box('gloss', 0.05, h + 0.14, -0.22, 0.62, 0.38, 0.03, C('#16181a'), { r: 0.008 });
  P.box('screen', 0.05, h + 0.16, -0.203, 0.58, 0.33, 0.004, o.screen || [0.35 + R() * 0.2, 0.5 + R() * 0.2, 0.7], { r: 0 });
  P.box('paint', 0.05, h, 0.08, 0.44, 0.02, 0.15, C('#2a2a2a'), { r: 0.006 });
  P.box('paint', 0.38, h, 0.1, 0.07, 0.025, 0.11, C('#2a2a2a'), { r: 0.02 });
  P.paper(-0.42, h + 0.002, 0.05, 0.21, 0.28, 5, 0.25, -Math.PI / 2);
  mug(P, -0.5, h, -0.18, o.mug || C('#3a7ad2'), 1.2);
  if (R() < 0.6) plant(P, w / 2 - 0.12, h, -0.24, 0.45, { n: 5 });
  P.shadow(0, 0, w * 0.56, d * 0.6, 0.65);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// an office chair on five wheels (front = +z)
export function officeChair(P, o = {}) {
  const c = o.color || C('#2f3a44');
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; P.box('metal', Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15, 0.04, 0.03, 0.3, DARK, { r: 0.008, rot: a }); P.sphere('paint', Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29, 0.03, DARK, 8); }
  P.cyl('metal', 0, 0.06, 0, 0.025, 0.025, 0.38, CHROME, 10);
  P.box('cloth', 0, 0.44, 0.02, 0.5, 0.08, 0.48, c, { r: 0.035 });
  P.box('cloth', 0, 0.56, -0.24, 0.46, 0.55, 0.07, c, { r: 0.035, tilt: -0.1 });
  P.box('metal', 0, 0.48, -0.23, 0.06, 0.14, 0.04, DARK, { r: 0.006 });
  P.shadow(0, 0, 0.3, 0.3, 0.55);
  P.solid(-0.25, -0.25, 0.25, 0.25, 0.5);
}
// a metal filing cabinet with four drawers (front = +z)
export function filingCabinet(P, o = {}) {
  const w = 0.47, d = 0.6, h = o.h || 1.32, c = o.color || C('#9aa3a8');
  P.box('metal', 0, 0, 0, w, h, d, c, { r: 0.012 });
  const n = Math.round(h / 0.33);
  for (let i = 0; i < n; i++) { const y = 0.03 + i * (h / n); P.box('metal', 0, y, d / 2, w - 0.04, h / n - 0.04, 0.012, mul(c, 1.06), { r: 0.006 }); P.box('metal', 0, y + h / n - 0.14, d / 2 + 0.015, 0.12, 0.025, 0.02, CHROME, { r: 0.008 }); }
  P.shadow(0, 0, w * 0.6, d * 0.6, 0.8);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a water cooler with a big blue bottle
export function waterCooler(P, x, z) {
  P.box('paint', x, 0, z, 0.32, 1.0, 0.32, C('#e9ecee'), { r: 0.03 });
  P.box('paint', x, 0.75, z + 0.165, 0.18, 0.1, 0.02, C('#3a3a3a'), { r: 0.01 });
  P.lathe('glass', x, 1.0, z, [[0, 0], [0.04, 0], [0.04, 0.04], [0.13, 0.08], [0.135, 0.36], [0.12, 0.4], [0, 0.42]], C('#7ab4e8'), 18);
  P.shadow(x, z, 0.22, 0.22, 0.75);
  P.solid(x - 0.17, z - 0.17, x + 0.17, z + 0.17, 1.4);
}
// a whiteboard with lines and a few notes stuck on it
export function whiteboard(P, x, y, z, w = 1.6, h = 0.95) {
  P.box('metal', x, y, z + 0.012, w + 0.04, h + 0.04, 0.025, STEEL, { r: 0.008 });
  P.box('gloss', x, y + 0.02, z + 0.026, w, h, 0.004, C('#f6f7f8'), { r: 0 });
  const R = P.R;
  for (let i = 0; i < 5; i++) P.box('paint', x - w * 0.3 + R() * w * 0.2, y + h - 0.15 - i * 0.13, z + 0.03, w * (0.2 + R() * 0.3), 0.012, 0.002, [C('#2a5ad0'), C('#d02a2a'), C('#2a2a2a')][i % 3], { r: 0 });
  for (let i = 0; i < 3; i++) P.paper(x + w * 0.25 + (i % 2) * 0.12, y + h - 0.2 - i * 0.2, z + 0.031, 0.1, 0.1, [5, 1, 2][i]);
  P.box('metal', x, y - 0.03, z + 0.05, w * 0.6, 0.02, 0.06, STEEL, { r: 0.004 });
}

// ======================================================================= the lobby
// a wall of letter boxes (on the wall: z = 0 is the wall, +z the room)
export function mailboxes(P, x, y, z, cols = 6, rows = 4) {
  const cw = 0.24, ch = 0.16;
  P.box('metal', x, y - 0.02, z + 0.08, cols * cw + 0.06, rows * ch + 0.06, 0.16, C('#7a7f84'), { r: 0.01 });
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = x - (cols * cw) / 2 + cw * (i + 0.5), py = y + ch * j + 0.01;
    P.box('metal', px, py, z + 0.165, cw - 0.02, ch - 0.02, 0.012, C('#a8adb2'), { r: 0.004 });
    P.box('paint', px - 0.05, py + ch - 0.06, z + 0.173, 0.08, 0.025, 0.003, WHITE, { r: 0 });
    P.box('metal', px + 0.07, py + 0.05, z + 0.176, 0.015, 0.03, 0.01, DARK, { r: 0 });
  }
}
// the doors of a lift, with a frame, the floor numbers and a button
export function liftDoors(P, x, z, color = C('#b8bcc0')) {
  P.box('metal', x, 0, z + 0.04, 1.3, 2.3, 0.08, mul(color, 0.7), { r: 0.01 });
  for (const sx of [-1, 1]) P.box('metal', x + sx * 0.255, 0.02, z + 0.085, 0.5, 2.12, 0.02, color, { r: 0.004 });
  P.box('screen', x, 2.18, z + 0.09, 0.3, 0.07, 0.01, [1.6, 0.6, 0.2], { r: 0 });
  P.box('metal', x + 0.82, 1.0, z + 0.03, 0.09, 0.18, 0.02, CHROME, { r: 0.006 });
  P.sphere('screen', x + 0.82, 1.1, z + 0.045, 0.014, [0.4, 1.2, 2], 8);
}
// a reception desk (front = +z, where the visitors stand)
export function receptionDesk(P, o = {}) {
  const w = o.w || 1.8, d = 0.7, h = 1.08, c = o.color || C('#e8e2d4');
  P.box('paint', 0, 0, 0, w, h, d, c, { r: 0.04 });
  P.box('wood', 0, h, 0.12, w + 0.04, 0.04, 0.4, C('#8a5a34'), { r: 0.012 });
  P.box('wood', 0, 0.72, -0.12, w - 0.1, 0.03, 0.42, C('#8a5a34'), { r: 0.008 });
  P.box('gloss', -0.2, 0.75, -0.15, 0.45, 0.28, 0.03, C('#16181a'), { r: 0.006, tilt: -0.15 });
  P.box('screen', -0.2, 0.765, -0.135, 0.41, 0.24, 0.004, [0.3, 0.45, 0.6], { r: 0, tilt: -0.15 });
  flowersBowl(P, w / 2 - 0.25, h + 0.04, 0.12);
  P.shadow(0, 0, w * 0.58, d * 0.62, 0.75);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
function flowersBowl(P, x, y, z) { bowl(P, x, y, z, C('#2f4a5a'), 1.1); for (let i = 0; i < 5; i++) P.sphere('cloth', x + Math.cos(i * 1.3) * 0.04, y + 0.07, z + Math.sin(i * 1.3) * 0.04, 0.03, [C('#e8b830'), C('#d84a3a'), WHITE][i % 3], 8); }
// a bench: wooden slats on two metal legs (front = +z)
export function bench(P, o = {}) {
  const w = o.w || 1.6, h = 0.45;
  for (let i = 0; i < 4; i++) P.box('wood', 0, h - 0.03, -0.18 + i * 0.12, w, 0.03, 0.09, C('#a8784a'), { r: 0.008 });
  for (const sx of [-1, 1]) { P.box('metal', sx * (w / 2 - 0.12), 0, 0, 0.04, h - 0.03, 0.42, DARK, { r: 0.006 }); }
  P.shadow(0, 0, w * 0.56, 0.3, 0.6);
  P.solid(-w / 2, -0.24, w / 2, 0.24, h);
}

// ======================================================================= the garage
// a heavy work bench with a vice and a few tools (front = +z)
export function workbench(P, o = {}) {
  const w = o.w || 2.0, d = 0.7, h = 0.9;
  P.box('wood', 0, h - 0.06, 0, w, 0.06, d, C('#9a7a50'), { r: 0.008, uv: [w, d] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box('metal', sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), 0.06, h - 0.06, 0.06, C('#3a4a5a'), { r: 0.006 });
  P.box('metal', 0, 0.18, 0, w - 0.1, 0.03, d - 0.1, C('#3a4a5a'), { r: 0.004 });
  P.box('metal', w / 2 - 0.25, h, 0.2, 0.18, 0.12, 0.2, C('#3a5a8a'), { r: 0.01 });
  P.cyl('metal', w / 2 - 0.25, h + 0.08, 0.36, 0.008, 0.008, 0.2, CHROME, 6, [0, 0, Math.PI / 2]);
  P.box('metal', -0.3, h, 0.05, 0.25, 0.02, 0.05, C('#c8302a'), { r: 0.008, rot: 0.4 });
  P.box('metal', 0.1, h, 0.1, 0.03, 0.03, 0.25, CHROME, { r: 0.008, rot: -0.3 });
  for (let i = 0; i < 3; i++) P.box('paint', -0.75 + i * 0.22, 0.21, 0.0, 0.2, 0.16, 0.3, [C('#c8302a'), C('#2a5a8a'), C('#e8c030')][i], { r: 0.01 });
  P.shadow(0, 0, w * 0.56, d * 0.6, 0.75);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// a board with holes for tools, on the wall (tools hang on it)
export function pegboard(P, x, y, z, w = 1.6, h = 0.9) {
  P.box('paint', x, y, z + 0.01, w, h, 0.02, C('#c8a878'), { r: 0.004 });
  const R = P.R;
  for (let i = 0; i < 9; i++) {
    const tx = x - w / 2 + 0.15 + (i / 8) * (w - 0.3), ty = y + h * (0.35 + R() * 0.3);
    if (i % 3 === 0) { P.box('metal', tx, ty - 0.12, z + 0.035, 0.03, 0.24, 0.015, CHROME, { r: 0.006 }); P.torus('metal', tx, ty + 0.12, z + 0.035, 0.025, 0.006, CHROME, [0, 0, 0]); }
    else if (i % 3 === 1) { P.cyl('wood', tx, ty - 0.1, z + 0.035, 0.014, 0.014, 0.2, C('#8a5a34'), 6); P.box('metal', tx, ty + 0.0, z + 0.035, 0.1, 0.035, 0.03, STEEL, { r: 0.006 }); }
    else { P.cyl('paint', tx, ty - 0.08, z + 0.035, 0.012, 0.012, 0.1, [C('#c8302a'), C('#e8c030')][i % 2], 6); P.cyl('metal', tx, ty - 0.18, z + 0.035, 0.004, 0.004, 0.12, CHROME, 5); }
  }
}
// a pile of old tires
export function tires(P, x, z, n = 3) { for (let i = 0; i < n; i++) P.torus('paint', x + (i % 2) * 0.02, 0.1 + i * 0.2, z, 0.26, 0.1, C('#1f1f1f'), [Math.PI / 2, 0, 0]); P.shadow(x, z, 0.4, 0.4, 0.8); P.solid(x - 0.36, z - 0.36, x + 0.36, z + 0.36, n * 0.2); }
// an oil drum
export function drum(P, x, z, color = C('#2a5a8a')) {
  P.cyl('metal', x, 0, z, 0.29, 0.29, 0.88, color, 18);
  for (const y of [0.29, 0.59]) P.torus('metal', x, y, z, 0.29, 0.012, color, [Math.PI / 2, 0, 0]);
  P.shadow(x, z, 0.36, 0.36, 0.8);
  P.solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0.9);
}
// cardboard boxes, stacked
export function boxes(P, x, z, n = 3, rot = 0) {
  const R = P.R;
  let y = 0;
  for (let i = 0; i < n; i++) { const s = 0.35 + R() * 0.25; P.box('paint', x + (R() - 0.5) * 0.06, y, z + (R() - 0.5) * 0.06, s, s * 0.75, s, C('#b58a5a'), { r: 0.01, rot: rot + (R() - 0.5) * 0.3 }); y += s * 0.75; }
  P.shadow(x, z, 0.35, 0.35, 0.7);
  P.solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3, y);
}
// a flat light in the ceiling (the cold, even light of shops, offices and garages)
export function ceilingPanel(P, x, z, ceiling, w = 1.2, d = 0.3) {
  P.box('metal', x, ceiling - 0.05, z, w + 0.04, 0.05, d + 0.04, C('#d8dadc'), { r: 0.004 });
  P.box('screen', x, ceiling - 0.056, z, w, 0.01, d, [2.0, 2.0, 1.9], { r: 0 });
}
// a tall shelf with boxes and tins (the garage, the store room), front = +z
export function rack(P, o = {}) {
  const w = o.w || 1.8, d = 0.5, h = o.h || 2.0, R = P.R;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box('metal', sx * (w / 2 - 0.025), 0, sz * (d / 2 - 0.025), 0.05, h, 0.05, C('#3a5a8a'), { r: 0.004 });
  for (let i = 0; i < 4; i++) {
    const y = 0.12 + i * ((h - 0.2) / 3);
    P.box('metal', 0, y, 0, w, 0.03, d, C('#7a8a96'), { r: 0.004 });
    let x = -w / 2 + 0.1;
    while (x < w / 2 - 0.3) { const s = 0.22 + R() * 0.22; if (R() < 0.75) P.box('paint', x + s / 2, y + 0.03, (R() - 0.5) * 0.1, s, s * 0.7, Math.min(s, d - 0.08), R() < 0.7 ? C('#b58a5a') : [C('#c8302a'), C('#2a5a8a'), C('#e8c030')][Math.floor(R() * 3)], { r: 0.008 }); x += s + 0.05; }
  }
  P.shadow(0, 0, w * 0.56, d * 0.6, 0.7);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
