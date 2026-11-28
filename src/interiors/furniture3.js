// ---------------------------------------------------------------------------
// furniture3.js - the pieces of the BANK and the POLICE STATION (the rooms are put together in generate.js).
//
//   people      person() - a standing figure: staff behind a counter, a guard, somebody waiting
//   the bank    tellerCounter (a long counter with a glass screen), atm, vaultDoor, ropePosts, standDesk
//   the police  frontDesk, cellBars (a holding cell), lockers, noticeBoard, waitingSeats
//
// Like every piece of furniture.js: P is a "frame" (the piece's own place and turn in the room), the piece's
// front looks toward +z, sizes are meters. Each piece ends with P.solid(...) where you cannot walk.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { C } from './furniture.js';

const TAU = Math.PI * 2;
const DARK = C('#1d1b19'), CHROME = C('#d6d8da'), STEEL = C('#8f969c'), BRASS = C('#c49a55'), WHITE = C('#f2efe8');
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// ======================================================================= a person
// The shapes of a standing body, made once (the same proportions as the people of the street).
let BODY = null;
function bodyParts() {
  if (BODY) return BODY;
  const ell = (rx, ry, rz, x, y, z, ws = 10, hs = 7) => new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz).translate(x, y, z);
  const tube = (a, b, ra, rb, flat = 1) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = new THREE.CylinderGeometry(rb, ra, len, 8, 1, false);
    g.scale(1, 1, flat);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const torso = new THREE.LatheGeometry([[0.002, 0.83], [0.152, 0.85], [0.166, 0.92], [0.152, 1.02], [0.158, 1.12], [0.178, 1.24], [0.186, 1.34], [0.172, 1.41], [0.125, 1.463], [0.06, 1.49]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
  torso.scale(1, 1, 0.62);
  const hair = new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI * 0.55);
  hair.scale(0.097, 0.123, 0.109); hair.rotateX(-0.32); hair.translate(0, 1.652, 0);
  const cap = new THREE.CylinderGeometry(0.105, 0.108, 0.07, 12); cap.translate(0, 1.745, 0.005);
  const peak = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 12, 1, false, -0.9, 1.8); peak.scale(1, 1, 1.5); peak.translate(0, 1.712, 0.03);
  BODY = {
    torso, hair, cap, peak,
    hips: ell(0.158, 0.1, 0.104, 0, 0.9, 0, 10, 5),
    neck: tube(V(0, 1.45, 0), V(0, 1.57, 0.006), 0.052, 0.046),
    head: ell(0.091, 0.117, 0.103, 0, 1.646, 0.012, 12, 8),
    nose: ell(0.015, 0.025, 0.02, 0, 1.633, 0.108, 6, 4),
    arms: [1, -1].map((s) => [ell(0.062, 0.058, 0.062, s * 0.2, 1.37, 0, 8, 5), tube(V(s * 0.215, 1.36, 0), V(s * 0.235, 1.08, 0.01), 0.05, 0.042), tube(V(s * 0.235, 1.08, 0.01), V(s * 0.228, 0.84, 0.05), 0.04, 0.034)]),
    hands: [1, -1].map((s) => ell(0.036, 0.05, 0.03, s * 0.226, 0.79, 0.058, 7, 5)),
    legs: [1, -1].map((s) => [tube(V(s * 0.088, 0.9, 0), V(s * 0.092, 0.5, 0.005), 0.082, 0.062), tube(V(s * 0.092, 0.5, 0.005), V(s * 0.094, 0.09, 0), 0.058, 0.045)]),
    shoes: [1, -1].map((s) => ell(0.052, 0.045, 0.125, s * 0.095, 0.045, 0.04, 8, 5)),
    tie: new THREE.BoxGeometry(0.035, 0.26, 0.012).translate(0, 1.3, 0.112),
    badge: new THREE.BoxGeometry(0.04, 0.045, 0.01).translate(0.085, 1.33, 0.112),
  };
  return BODY;
}
const SKINS = ['#e3b596', '#c98f6b', '#8d5b3e', '#f0cdb1', '#a8714e'].map(C), HAIRS = ['#1d1612', '#3a2618', '#6b4a2a', '#8a8580', '#141414'].map(C);
// A standing person (front = +z). o: { shirt, trousers, skin, hair, cap (a colour: a peaked cap), tie (a colour), badge }
export function person(P, o = {}) {
  const B = bodyParts(), R = P.R;
  const skin = o.skin || SKINS[Math.floor(R() * SKINS.length)], hair = o.hair || HAIRS[Math.floor(R() * HAIRS.length)];
  const shirt = o.shirt || C('#e8eaee'), trousers = o.trousers || C('#2a2f38'), k = o.size || 0.96 + R() * 0.08;
  const G = (g, c, mat = 'cloth') => P.geo(mat, k === 1 ? g : g.clone().scale(k, k, k), 0, 0, 0, 0, c);
  G(B.torso, shirt); G(B.hips, trousers); G(B.neck, skin); G(B.head, skin); G(B.nose, skin);
  if (o.cap) { G(B.cap, o.cap); G(B.peak, mul(o.cap, 0.6)); } else G(B.hair, hair);
  for (const side of B.arms) for (const g of side) G(g, shirt);
  for (const g of B.hands) G(g, skin);
  for (const side of B.legs) for (const g of side) G(g, trousers);
  for (const g of B.shoes) G(g, DARK);
  if (o.tie) G(B.tie, o.tie);
  if (o.badge) G(B.badge, BRASS, 'metal');
  P.shadow(0, 0, 0.3, 0.24, 0.6);
  P.solid(-0.24, -0.18, 0.24, 0.18, 1.7);
}

// ======================================================================= the bank
// The long counter of the tellers with a glass screen on it (front = +z, where the customers stand).
//   o.w  its length;  o.windows  how many places to be served (a gap under the glass and a tray at each)
export function tellerCounter(P, o = {}) {
  const w = o.w || 6, n = o.windows || 3, h = 1.08, d = 0.72, wood = o.color || C('#5a3a26'), stone = C('#d9d2c4');
  P.box('wood', 0, 0, 0, w, h - 0.05, d, wood, { r: 0.02, uv: [w, 1] });
  // panels on the front, a foot rail
  const np = Math.max(2, Math.round(w / 1.1));
  for (let i = 0; i < np; i++) P.box('wood', -w / 2 + (w / np) * (i + 0.5), 0.14, d / 2 + 0.005, w / np - 0.14, h - 0.36, 0.02, mul(wood, 1.18), { r: 0.012 });
  P.cyl('metal', 0, 0.16, d / 2 + 0.1, 0.018, 0.018, w - 0.3, BRASS, 10, [0, 0, Math.PI / 2]);
  P.box('gloss', 0, h - 0.05, 0, w + 0.06, 0.05, d + 0.1, stone, { r: 0.015 });
  // the glass screen: posts, a rail on top, one pane for every place with a gap under it
  const gh = 0.95, pw = w / n;
  for (let i = 0; i <= n; i++) P.box('metal', -w / 2 + pw * i, h, 0.05, 0.05, gh, 0.05, BRASS, { r: 0.008 });
  P.box('metal', 0, h + gh, 0.05, w, 0.05, 0.06, BRASS, { r: 0.008 });
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + pw * (i + 0.5);
    P.box('glass', x, h + 0.16, 0.05, pw - 0.06, gh - 0.16, 0.012, C('#cfe4ea'), { r: 0 });
    // the tray the money goes through, a pen on a chain, the number of the place
    P.box('metal', x, h + 0.002, 0.08, 0.3, 0.012, 0.22, STEEL, { r: 0.004 });
    P.box('paint', x + 0.3, h, 0.2, 0.012, 0.012, 0.13, DARK, { r: 0.004, rot: 0.5 });
    P.box('screen', x, h + gh + 0.07, 0.05, 0.22, 0.12, 0.02, [0.3, 1.3, 0.5], { r: 0.004 });
    // behind the glass: a keyboard, a small screen, stacks of notes
    P.box('paint', x - 0.05, h, -0.2, 0.34, 0.015, 0.12, C('#2a2a2a'), { r: 0.004 });
    P.box('gloss', x + 0.36, h + 0.1, -0.22, 0.3, 0.22, 0.02, C('#16181a'), { r: 0.006, rot: -0.3 });
    for (let k = 0; k < 3; k++) P.box('paint', x - 0.38 + k * 0.09, h, -0.17, 0.07, 0.018 + (k % 2) * 0.012, 0.15, C('#7aa87a'), { r: 0.002 });
  }
  P.shadow(0, 0, w * 0.52, d * 0.7, 0.8);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, 2.1);
}
// A cash machine set against the wall (its back at z = 0, the screen looks toward +z).
export function atm(P, o = {}) {
  const c = o.color || C('#2f5a86');
  P.box('paint', 0, 0, 0.24, 0.78, 1.95, 0.48, C('#d9dcde'), { r: 0.03 });
  P.box('paint', 0, 1.62, 0.5, 0.78, 0.33, 0.03, c, { r: 0.01 });
  P.box('screen', 0, 1.7, 0.52, 0.5, 0.14, 0.006, [1.4, 1.4, 1.5], { r: 0 });                  // the lit sign
  P.box('gloss', 0, 1.12, 0.47, 0.5, 0.4, 0.04, C('#16181a'), { r: 0.01, tilt: -0.25 });
  P.box('screen', 0, 1.145, 0.492, 0.42, 0.32, 0.004, [0.35, 0.75, 1.1], { r: 0, tilt: -0.25 });   // the screen
  P.box('metal', 0, 0.9, 0.5, 0.56, 0.03, 0.26, STEEL, { r: 0.01 });                               // the shelf with the keys
  for (let i = 0; i < 12; i++) P.box('paint', -0.075 + (i % 3) * 0.075, 0.932, 0.44 + Math.floor(i / 3) * 0.045, 0.05, 0.012, 0.03, i === 9 ? C('#b83a2a') : i === 11 ? C('#3a9a4a') : C('#4a4f54'), { r: 0.003 });
  P.box('paint', 0.24, 1.0, 0.485, 0.12, 0.025, 0.012, DARK, { r: 0.002 });                        // the card slot, with a green light
  P.sphere('screen', 0.33, 1.012, 0.49, 0.009, [0.3, 2.2, 0.5], 6);
  P.box('paint', 0, 0.62, 0.485, 0.4, 0.05, 0.012, DARK, { r: 0.004 });                            // where the notes come out
  P.shadow(0, 0.24, 0.45, 0.3, 0.7);
  P.solid(-0.39, 0, 0.39, 0.5, 1.95);
}
// The round door of the vault, in the wall behind the counter (the wall is z = 0, the room +z).
export function vaultDoor(P, x, z) {
  const y = 1.25, r = 1.0;
  P.box('metal', x, 0.05, z + 0.06, 2.6, 2.5, 0.12, C('#5f666c'), { r: 0.02 });                    // the steel frame
  P.cyl('metal', x, y, z + 0.2, r, r, 0.18, C('#aab0b5'), 28, [Math.PI / 2, 0, 0]);
  P.cyl('metal', x, y, z + 0.3, r * 0.82, r * 0.82, 0.05, C('#8f969c'), 28, [Math.PI / 2, 0, 0]);
  // the bolts round the edge
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; P.cyl('metal', x + Math.cos(a) * r * 0.91, y + Math.sin(a) * r * 0.91, z + 0.3, 0.035, 0.035, 0.04, CHROME, 8, [Math.PI / 2, 0, 0]); }
  // the wheel in the middle: a ring on five spokes, and the number dial
  P.torus('metal', x, y, z + 0.42, 0.34, 0.025, CHROME, [0, 0, 0]);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; P.cyl('metal', x + Math.cos(a) * 0.17, y + Math.sin(a) * 0.17, z + 0.42, 0.016, 0.016, 0.34, CHROME, 8, [0, 0, a - Math.PI / 2]); }
  P.cyl('metal', x, y, z + 0.38, 0.07, 0.07, 0.12, C('#6a7076'), 14, [Math.PI / 2, 0, 0]);
  P.cyl('metal', x - 0.58, y + 0.42, z + 0.35, 0.11, 0.11, 0.05, DARK, 16, [Math.PI / 2, 0, 0]);
  P.cyl('metal', x - 0.58, y + 0.42, z + 0.385, 0.06, 0.06, 0.03, CHROME, 12, [Math.PI / 2, 0, 0]);
  // two heavy hinges on the right
  for (const dy of [-0.5, 0.5]) P.box('metal', x + r + 0.12, y + dy - 0.12, z + 0.2, 0.22, 0.24, 0.16, C('#6a7076'), { r: 0.02 });
  // a small red lamp over it
  P.sphere('screen', x, 2.42, z + 0.14, 0.03, [2.4, 0.3, 0.2], 8);
}
// Brass posts with a red rope between them: pts = [[x, z], ...] in the frame of P.
export function ropePosts(P, pts) {
  for (const [x, z] of pts) {
    P.cyl('metal', x, 0, z, 0.15, 0.14, 0.03, BRASS, 16);
    P.cyl('metal', x, 0.03, z, 0.022, 0.022, 0.92, BRASS, 10);
    P.sphere('metal', x, 0.97, z, 0.04, BRASS, 10);
    P.solid(x - 0.1, z - 0.1, x + 0.1, z + 0.1, 1.0);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), a = Math.atan2(bx - ax, bz - az);
    // the rope hangs a little: three short pieces
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3, sag = 0.06 * (1 - Math.abs(t - 0.5) * 2) + 0.02;
      P.cyl('cloth', ax + (bx - ax) * t, 0.9 - sag, az + (bz - az) * t, 0.014, 0.014, len / 3 + 0.02, C('#8a1f24'), 6, [Math.PI / 2, a, 0]);
    }
    P.solid(Math.min(ax, bx) - 0.04, Math.min(az, bz) - 0.04, Math.max(ax, bx) + 0.04, Math.max(az, bz) + 0.04, 0.95);
  }
}
// A high desk to write at, with forms and a pen (front = +z).
export function standDesk(P, o = {}) {
  const w = o.w || 1.3, h = 1.05, wood = C('#5a3a26');
  P.box('wood', 0, h - 0.04, 0, w, 0.04, 0.5, wood, { r: 0.01 });
  for (const sx of [-1, 1]) P.box('wood', sx * (w / 2 - 0.06), 0, 0, 0.06, h - 0.04, 0.44, mul(wood, 0.85), { r: 0.008 });
  P.box('wood', 0, 0.3, -0.2, w - 0.12, 0.6, 0.03, mul(wood, 0.9), { r: 0.006 });
  P.paper(-0.3, h + 0.002, 0.02, 0.21, 0.28, 5, 0.1, -Math.PI / 2);
  P.paper(0.1, h + 0.002, 0.0, 0.21, 0.28, 2, -0.15, -Math.PI / 2);
  P.box('paint', 0.42, h, 0.05, 0.012, 0.012, 0.14, DARK, { r: 0.004, rot: 0.6 });
  P.shadow(0, 0, w * 0.5, 0.3, 0.6);
  P.solid(-w / 2, -0.25, w / 2, 0.25, h);
}

// ======================================================================= the police station
// The front desk: high, dark blue, a lit strip under its edge, a screen and a phone behind it (front = +z).
export function frontDesk(P, o = {}) {
  const w = o.w || 2.6, h = 1.12, d = 0.75, c = o.color || C('#22344e');
  P.box('paint', 0, 0, 0, w, h, d, c, { r: 0.04 });
  P.box('gloss', 0, h, 0.06, w + 0.06, 0.04, d + 0.16, C('#d6d8da'), { r: 0.012 });
  P.box('screen', 0, h - 0.07, d / 2 + 0.012, w - 0.3, 0.025, 0.008, [0.5, 0.9, 2.0], { r: 0 });
  P.box('metal', 0, 0.62, d / 2 + 0.008, 0.52, 0.2, 0.01, BRASS, { r: 0.004 });                    // the crest plate
  P.box('wood', 0, 0.74, -0.18, w - 0.12, 0.03, 0.36, C('#3a3f46'), { r: 0.006 });
  P.box('gloss', -0.5, 0.77, -0.2, 0.46, 0.3, 0.03, C('#16181a'), { r: 0.006, tilt: -0.15 });
  P.box('screen', -0.5, 0.785, -0.185, 0.42, 0.26, 0.004, [0.3, 0.5, 0.75], { r: 0, tilt: -0.15 });
  P.box('paint', 0.45, 0.77, -0.16, 0.2, 0.05, 0.16, DARK, { r: 0.015 });                           // a phone
  P.box('paint', 0.45, 0.82, -0.2, 0.2, 0.035, 0.05, C('#2a2a2a'), { r: 0.012 });
  P.paper(0.5, h + 0.042, 0.1, 0.21, 0.28, 5, 0.2, -Math.PI / 2);
  P.shadow(0, 0, w * 0.56, d * 0.64, 0.8);
  P.solid(-w / 2, -d / 2, w / 2, d / 2, h);
}
// Steel bars from the floor to the ceiling along x (a wall of a holding cell): w long, h high, with a door in it.
export function cellBars(P, o = {}) {
  const w = o.w || 3, h = o.h || 2.9, c = C('#4a5158');
  P.box('metal', 0, 0, 0, w, 0.06, 0.07, c, { r: 0.006 });
  P.box('metal', 0, h - 0.06, 0, w, 0.06, 0.07, c, { r: 0.006 });
  P.box('metal', 0, 1.25, 0, w, 0.05, 0.05, c, { r: 0.006 });
  const n = Math.round(w / 0.115);
  for (let i = 0; i <= n; i++) P.cyl('metal', -w / 2 + (w * i) / n, 0.06, 0, 0.014, 0.014, h - 0.12, c, 6);
  if (o.door !== false) {
    // the frame of the door and its lock plate
    const dx = o.doorAt === undefined ? w / 2 - 0.65 : o.doorAt;
    for (const sx of [-0.45, 0.45]) P.box('metal', dx + sx, 0, 0, 0.05, 2.15, 0.08, mul(c, 0.8), { r: 0.006 });
    P.box('metal', dx, 2.1, 0, 0.95, 0.05, 0.08, mul(c, 0.8), { r: 0.006 });
    P.box('metal', dx - 0.38, 1.0, 0.03, 0.12, 0.2, 0.06, C('#2a2e33'), { r: 0.01 });
  }
  P.solid(-w / 2, -0.06, w / 2, 0.06, h);
}
// A row of steel lockers against the wall (front = +z).
export function lockers(P, o = {}) {
  const n = o.n || 4, lw = 0.38, h = 1.9, d = 0.48, c = o.color || C('#5c7286');
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * lw;
    P.box('metal', x, 0.08, 0, lw - 0.01, h, d, c, { r: 0.012 });
    P.box('metal', x, 0.12, d / 2 + 0.004, lw - 0.05, h - 0.1, 0.012, mul(c, 1.08), { r: 0.008 });
    for (let k = 0; k < 4; k++) P.box('paint', x, 1.72 - k * 0.045, d / 2 + 0.012, lw - 0.16, 0.012, 0.004, mul(c, 0.5), { r: 0 });
    P.box('metal', x + lw / 2 - 0.07, 1.05, d / 2 + 0.02, 0.025, 0.11, 0.025, CHROME, { r: 0.006 });
    P.box('paint', x - 0.05, 1.5, d / 2 + 0.012, 0.09, 0.05, 0.003, WHITE, { r: 0 });
  }
  P.box('metal', 0, 0, 0, n * lw, 0.08, d - 0.06, mul(c, 0.6), { r: 0.004 });
  P.shadow(0, 0, n * lw * 0.52, d * 0.6, 0.8);
  P.solid(-(n * lw) / 2, -d / 2, (n * lw) / 2, d / 2, h);
}
// A cork board on the wall with notices pinned to it (the wall is z = 0).
export function noticeBoard(P, x, y, z, w = 1.6, h = 1.0, cells = [5, 1, 2, 5, 6, 3]) {
  P.box('wood', x, y, z + 0.012, w + 0.06, h + 0.06, 0.025, C('#5a3a26'), { r: 0.008 });
  P.box('cloth', x, y + 0.03, z + 0.026, w, h, 0.006, C('#b08a5a'), { r: 0 });
  const cols = Math.max(2, Math.floor(w / 0.42));
  for (let i = 0; i < cells.length; i++) {
    const px = x - w / 2 + (w / cols) * ((i % cols) + 0.5), py = y + h - 0.2 - Math.floor(i / cols) * 0.42;
    if (py < y + 0.12) break;
    P.paper(px, py, z + 0.033, 0.24, 0.32, cells[i], 0, 0);
    P.sphere('paint', px, py + 0.14, z + 0.04, 0.012, [C('#c8322a'), C('#2a62c8'), C('#e8c030')][i % 3], 6);
  }
}
// A row of seats joined on one bar, for waiting (front = +z).
export function waitingSeats(P, o = {}) {
  const n = o.n || 3, c = o.color || C('#3f5a78');
  P.box('metal', 0, 0.36, 0, n * 0.56, 0.05, 0.08, STEEL, { r: 0.008 });
  for (const sx of [-1, 1]) { P.box('metal', sx * (n * 0.28 - 0.14), 0, 0, 0.05, 0.36, 0.05, STEEL, { r: 0.006 }); P.box('metal', sx * (n * 0.28 - 0.14), 0, 0, 0.06, 0.03, 0.5, STEEL, { r: 0.006 }); }
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.56;
    P.box('paint', x, 0.41, 0.03, 0.5, 0.05, 0.46, c, { r: 0.022 });
    P.box('paint', x, 0.5, -0.2, 0.5, 0.42, 0.05, c, { r: 0.022, tilt: -0.12 });
  }
  P.shadow(0, 0, n * 0.3, 0.3, 0.55);
  P.solid(-n * 0.28, -0.26, n * 0.28, 0.26, 0.5);
}
