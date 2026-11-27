// ---------------------------------------------------------------------------
// towerSet.js - THE KVI TOWER (Chapter 10, "Phantom Grid"): the inside of Vance's tower, built in code, far out over
// the sea like Lena's safehouse (src/story/safehouseSet.js). While a part of it is shown the city is not drawn at all
// (only the set's own layer), and only ONE part - a "zone" - is in the picture at a time: the others are built the
// first time they are needed and then hidden. That keeps a phone at 60 frames a second.
//
// THE ZONES (each has its own place out at sea; inside it: x to the right, z forward, y up, (0, 0, 0) = the middle
// of its floor)
//   ramp      the spiral ramp up the base of the tower: concrete, cold light strips, glass, the city outside. It is
//             DRIVEN: an "arena" with its own ground (two turns up) and its own walls (src/vehicles/vehicle.js)
//   lobby     the sky lobby at night: dark stone, a wall of white light with the KVI name, the reception desk,
//             columns and planters to hide behind, a row of gates, the door to the atrium
//   atrium    a tall empty middle: balconies all round, light rods hanging over a dark pool, the security door to the
//             lifts and its terminal (the hack)
//   shaft     the lift: a glass cab in a concrete shaft; light strips run past while it moves; near the top the shaft
//             is glass and the city lies far below
//   server    the server floor: rows of racks with small lights, the HALO core and its console; red when the alarm goes
//   terrace   the sky garden: wet stone, trees in planters, a glass rail, the city far below, rain
//   glass     the top floor: Vance's glass room - rain on the windows, a long table, the console
//
//   const T = createTower({ scene, renderer, camera, lighting, props, colliders, player, weather })
//   T.show(zone | null)        that zone instead of the city (null: the city again)
//   T.at(zone, x, y, z)        a point of a zone -> the world [x, y, z]
//   T.arena                    the spiral ramp (a car spawned in it drives up it); T.rampStart -> { x, y, z, heading }
//   T.rampK(v)                 how far up the ramp a car is: 0 at the start .. 1 at the doors at the top
//   T.ride(speed)              the lift moves (m/s, up > 0; 0 = it stands); T.view('walls' | 'city'); T.floor(n)
//   T.alarm(on)                the server floor in red;  T.door(name, open): 'gate' (lobby), 'atrium', 'lift'
//   T.update(dt, cast)         every frame (cast: the people and things that must be seen in it)
//   T.room                     the room the game camera stays in (null on the ramp)
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { INTERIOR_LAYER } from '../interiors/interiors.js';
import { createBuilder, materials as kitMaterials, roomShade } from '../interiors/kit.js';
import { frame, C, bigPlant, plant } from '../interiors/furniture.js';
import { officeChair } from '../interiors/furniture2.js';
import { RAIN_VS, RAIN_FS } from './garageSet.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// where the zones are: far out over the sea, south of everything (nothing of the city is drawn while one is shown)
const BASE = [-1700, 0, -2700];
const ZONES = ['ramp', 'lobby', 'atrium', 'shaft', 'server', 'terrace', 'glass'];
const centerOf = (zone) => [BASE[0] + ZONES.indexOf(zone) * 140, BASE[1], BASE[2]];

// THE SPIRAL RAMP: a lane from radius RI to RO round a concrete core; two turns up, PITCH meters a turn.
// u is the angle along it (radians, more than one turn: 0 .. 4 pi); from U0 (the closed gate behind the start) to U1
// (the glass doors of the lobby at the top). Before 0 and after two turns it is flat.
const RAMP = { ri: 7.6, ro: 15.4, pitch: 5.6, turns: 2, u0: -0.9, u1: TAU * 2 + 1.3, deck: 0.45 };
RAMP.top = RAMP.pitch * RAMP.turns;
RAMP.mid = (RAMP.ri + RAMP.ro) / 2;
const rampH = (u) => (clamp(u, 0, TAU * RAMP.turns) / TAU) * RAMP.pitch;

// ======================================================================= pictures drawn in code
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(cv, repeat = false) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
// the city at night seen from high up, for a big ring round a zone: the dark sky at the top, a hazy glow along the
// horizon (in the middle of the picture), far towers on it, and under it the city's lights getting closer and
// bigger: grids of windows, roads of orange light, a few colored signs
function cityNight(w = 2048, h = 512, seed = 3) {
  const cv = canvas(w, h), g = cv.getContext('2d');
  let s = seed;
  const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#03050a'); sky.addColorStop(0.36, '#0b1220'); sky.addColorStop(0.49, '#2a2c3a'); sky.addColorStop(0.53, '#1a1c26'); sky.addColorStop(1, '#05060a');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const hz = h * 0.5;
  // far towers on the horizon, their windows
  for (let x = 0; x < w;) {
    const bw = 8 + R() * 30, bh = 6 + R() * R() * 70;
    g.fillStyle = `rgb(${14 + R() * 10 | 0},${16 + R() * 10 | 0},${24 + R() * 12 | 0})`; g.fillRect(x, hz - bh, bw, bh + 2);
    for (let yy = hz - bh + 3; yy < hz - 2; yy += 4) for (let xx = x + 2; xx < x + bw - 2; xx += 3) if (R() < 0.18) { g.fillStyle = R() < 0.7 ? 'rgba(255,205,140,0.8)' : 'rgba(160,210,255,0.7)'; g.fillRect(xx, yy, 1.4, 1.6); }
    x += bw + R() * 4;
  }
  // the city below: rows of lights, closer rows bigger and further apart
  for (let row = 0; row < 70; row++) {
    const k = row / 70, y = hz + 4 + Math.pow(k, 1.7) * (h - hz - 6), size = 0.8 + k * 3.2, gap = 3 + k * 16;
    for (let x = R() * gap; x < w; x += gap * (0.5 + R())) {
      if (R() < 0.45) continue;
      const warm = R() < 0.72;
      g.fillStyle = warm ? `rgba(255,${170 + R() * 60 | 0},${90 + R() * 60 | 0},${0.35 + R() * 0.55})` : `rgba(${140 + R() * 60 | 0},200,255,${0.3 + R() * 0.5})`;
      g.fillRect(x, y, size * (0.6 + R()), size * 0.7);
    }
  }
  // roads: lines of orange light going out from the middle of the view
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const x0 = R() * w, x1 = x0 + (R() - 0.5) * w * 0.9;
    const gr = g.createLinearGradient(x0, hz, x1, h); gr.addColorStop(0, 'rgba(255,150,60,0.05)'); gr.addColorStop(1, 'rgba(255,150,60,0.45)');
    g.strokeStyle = gr; g.lineWidth = 1 + R() * 2.5; g.beginPath(); g.moveTo(x0, hz + 3); g.lineTo(x1, h); g.stroke();
  }
  // a few glowing signs and the haze over the city
  for (let i = 0; i < 26; i++) {
    const x = R() * w, y = hz + 8 + R() * (h - hz) * 0.8, r = 10 + R() * 34, c = ['255,70,140', '70,220,255', '255,170,60', '160,255,150', '210,120,255'][i % 5];
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},0.32)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const haze = g.createLinearGradient(0, hz - 30, 0, hz + 60); haze.addColorStop(0, 'rgba(90,100,130,0)'); haze.addColorStop(0.45, 'rgba(90,100,130,0.22)'); haze.addColorStop(1, 'rgba(90,100,130,0)');
  g.fillStyle = haze; g.fillRect(0, hz - 30, w, 90);
  g.globalCompositeOperation = 'source-over';
  const t = texOf(cv); t.wrapS = THREE.RepeatWrapping;
  return t;
}
// the white wall of light in the lobby: the company's name, very big, very calm
function kviWall() {
  const cv = canvas(1024, 320), g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 320); bg.addColorStop(0, '#dfe8ee'); bg.addColorStop(1, '#bccbd6');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 320);
  g.fillStyle = '#0d1116'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '200 150px "Helvetica Neue", Arial, sans-serif'; g.fillText('K V I', 512, 140);
  g.font = '300 30px "Helvetica Neue", Arial, sans-serif'; g.fillText('C O N T I N U I T Y   ·   F O R   Y O U R   S A F E T Y', 512, 250);
  return texOf(cv);
}
// small lights of the server racks (green, some blue, a few amber), on black
function rackLights() {
  const cv = canvas(128, 256), g = cv.getContext('2d');
  g.fillStyle = '#07090c'; g.fillRect(0, 0, 128, 256);
  let s = 11;
  const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let y = 10; y < 248; y += 9) {
    g.fillStyle = '#12161c'; g.fillRect(8, y - 1, 112, 7);
    for (let x = 14; x < 116; x += 7) if (R() < 0.42) { const k = R(); g.fillStyle = k < 0.6 ? '#5dffb0' : k < 0.9 ? '#6ac8ff' : '#ffb347'; g.fillRect(x, y + 1, 2.4, 2.4); }
  }
  return texOf(cv);
}
// the number of the floor in the lift
function floorSign() {
  const cv = canvas(128, 64), t = texOf(cv);
  const draw = (n) => { const g = cv.getContext('2d'); g.fillStyle = '#05070a'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#9fe6ff'; g.font = '600 40px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 34); t.needsUpdate = true; };
  draw(1);
  return { t, draw };
}

// a quad with the whole picture on it once (p0 bottom left .. p3 top left, seen from the front), turned so that its
// front looks along n
function quadUV(m, p0, p1, p2, p3, n) {
  const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
  const front = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] >= 0;
  if (front) m.quad(p0, p1, p2, p3, n, [0, 0], [1, 0], [1, 1], [0, 1]);
  else m.quad(p1, p0, p3, p2, n, [0, 0], [1, 0], [1, 1], [0, 1]);
}
// the ring of the city round a zone (a big open cylinder seen from inside; horizon at eye height)
function cityRing(radius, height, y, repeat = 2) {
  const tex = cityNight();
  tex.repeat.set(repeat, 1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, toneMapped: true }));
  m.position.y = y;
  return m;
}

export function createTower({ scene, renderer, camera, lighting, props = null, colliders = null, player = null, weather = null }) {
  const root = new THREE.Group();
  root.name = 'kviTower';
  root.visible = false;
  scene.add(root);
  const zones = {};                // name -> { group, ... } (built when first shown)
  let shown = null, saved = null, time = 0, layerT = 0, solids = null;
  const at = (zone, x, y, z) => { const c = centerOf(zone); return [c[0] + x, c[1] + y, c[2] + z]; };
  let M = null;
  const mats = () => {
    if (M) return M;
    M = { ...kitMaterials(renderer) };
    M.led = new THREE.MeshBasicMaterial({ map: rackLights(), toneMapped: false });
    return M;
  };

  // ---------------------------------------------------------------- the zones
  // Each builder returns { group, solids: [[x0, z0, x1, z1, h]] (in the zone's frame), walk: { minX, maxX, minZ,
  // maxZ } | null (where the player can walk), room (the camera), light: { sky, ground, hemi, exposure, env },
  // outdoor (rain falls), update(dt, t) }
  const BUILD = {
    // ============================== THE SPIRAL RAMP ==============================
    ramp() {
      const c = centerOf('ramp'), b = createBuilder([0, 0, 0], 41);
      const P = (u, r, dy = 0) => [c[0] + Math.sin(u) * r, c[1] + rampH(u) + dy, c[2] + Math.cos(u) * r];
      const { ri, ro, deck, u0, u1, pitch } = RAMP, du = 0.045;
      const concrete = C('#7c8086'), under = C('#3b3f45'), wallC = C('#8a8e93');
      const top = b.mb('plaster'), paint = b.mb('paint'), glow = b.mb('screen');
      for (let u = u0, k = 0; u < u1 - 1e-6; u += du, k++) {
        const ua = u, ub = Math.min(u1, u + du);
        const na = [Math.sin(ua), 0, Math.cos(ua)], nb = [Math.sin(ub), 0, Math.cos(ub)];
        // the deck: its top (the road), its underside (the ceiling of the turn below)
        top.color(...concrete, 1); top.quadAuto(P(ua, ri - 0.25), P(ua, ro), P(ub, ro), P(ub, ri - 0.25), [0, 1, 0], 3);
        top.color(...under, 1); top.quadAuto(P(ua, ri - 0.25, -deck), P(ua, ro + 0.3, -deck), P(ub, ro + 0.3, -deck), P(ub, ri - 0.25, -deck), [0, -1, 0], 3);
        // the outer parapet (1.05 m over the road) and its top
        top.color(...wallC, 1); top.quadAuto(P(ua, ro), P(ub, ro), P(ub, ro, 1.05), P(ua, ro, 1.05), [-na[0], 0, -na[2]], 2);
        top.color(...mul(wallC, 0.9), 1); top.quadAuto(P(ua, ro, 1.05), P(ub, ro, 1.05), P(ub, ro + 0.3, 1.05), P(ua, ro + 0.3, 1.05), [0, 1, 0], 2);
        top.color(...mul(wallC, 0.7), 1); top.quadAuto(P(ua, ro + 0.3, -deck), P(ub, ro + 0.3, -deck), P(ub, ro + 0.3, 1.05), P(ua, ro + 0.3, 1.05), na, 2);
        // the inner curb
        top.color(...mul(wallC, 0.95), 1); top.quadAuto(P(ua, ri - 0.25, 0.18), P(ub, ri - 0.25, 0.18), P(ub, ri + 0.35, 0.18), P(ua, ri + 0.35, 0.18), [0, 1, 0], 2);
        top.quadAuto(P(ua, ri + 0.35), P(ub, ri + 0.35), P(ub, ri + 0.35, 0.18), P(ua, ri + 0.35, 0.18), na, 2);
        // cold light: a strip along the top of the parapet, one along the core; the middle line of the road
        glow.color(1.6, 1.9, 2.3, 1); glow.quadAuto(P(ua, ro - 0.01, 0.93), P(ub, ro - 0.01, 0.93), P(ub, ro - 0.01, 0.98), P(ua, ro - 0.01, 0.98), [-na[0], 0, -na[2]], 1);
        glow.quadAuto(P(ua, ri - 0.19, 0.62), P(ub, ri - 0.19, 0.62), P(ub, ri - 0.19, 0.67), P(ua, ri - 0.19, 0.67), na, 1);
        if (k % 4 < 2) { paint.color(0.9, 0.82, 0.5, 1); paint.quadAuto(P(ua, RAMP.mid - 0.07, 0.012), P(ua, RAMP.mid + 0.07, 0.012), P(ub, RAMP.mid + 0.07, 0.012), P(ub, RAMP.mid - 0.07, 0.012), [0, 1, 0], 1); }
        // light panels on the ceiling of each turn (under the deck above): they run past as the car climbs
        if (k % 9 === 0) { glow.color(2.2, 2.3, 2.4, 1); glow.quadAuto(P(ua, RAMP.mid - 1.3, -deck - 0.01), P(ua, RAMP.mid + 1.3, -deck - 0.01), P(ua + 0.02, RAMP.mid + 1.3, -deck - 0.01), P(ua + 0.02, RAMP.mid - 1.3, -deck - 0.01), [0, -1, 0], 1); }
        // the glass wall: thin dark posts from the parapet up to the turn above
        if (k % 7 === 0) {
          const h0 = rampH(ua) + 1.05, h1 = rampH(ua + TAU) - deck, q = P(ua, ro + 0.16);
          b.box('metal', q[0], c[1] + h0, q[2], 0.09, Math.max(0.5, h1 - h0 + (ua > TAU * RAMP.turns - 0.1 ? 3.6 : 0)), 0.14, C('#22262b'), { r: 0.01, rot: ua });
        }
      }
      // the flat roof slab over the last turn
      for (let u = TAU, k = 0; u < u1; u += 0.09, k++) {
        const y = RAMP.top + 4.7;
        const q = (uu, r) => [c[0] + Math.sin(uu) * r, c[1] + y, c[2] + Math.cos(uu) * r];
        top.color(...under, 1); top.quadAuto(q(u, ri - 0.25), q(u, ro + 0.3), q(u + 0.09, ro + 0.3), q(u + 0.09, ri - 0.25), [0, -1, 0], 3);
        if (k % 4 === 0) { glow.color(2.2, 2.3, 2.4, 1); const q2 = (uu, r) => [c[0] + Math.sin(uu) * r, c[1] + y - 0.01, c[2] + Math.cos(uu) * r]; glow.quadAuto(q2(u, RAMP.mid - 1.3), q2(u, RAMP.mid + 1.3), q2(u + 0.02, RAMP.mid + 1.3), q2(u + 0.02, RAMP.mid - 1.3), [0, -1, 0], 1); }
      }
      // the concrete core and its light slits
      const coreH = RAMP.top + 8, core = new THREE.CylinderGeometry(ri - 0.2, ri - 0.2, coreH, 56, 1, true);
      const cuv = core.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * TAU * (ri - 0.2) / 3, cuv.getY(i) * coreH / 3);
      b.geo('plaster', core, c[0], c[1] + coreH / 2 - 1, c[2], 0, C('#6d7177'));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.13; b.box('screen', c[0] + Math.sin(a) * (ri - 0.17), c[1] - 0.5, c[2] + Math.cos(a) * (ri - 0.17), 0.05, coreH - 2, 0.05, [0.9, 1.1, 1.4], { r: 0 }); }
      // the closed gate behind the start, and the glass doors at the top (the lobby)
      const gate = (u, h, col, light) => {
        const a = P(u, ri - 0.25), z = P(u, ro + 0.3), n = [Math.cos(u), 0, -Math.sin(u)];
        top.color(...col, 1); top.quadAuto(a, z, [z[0], z[1] + h, z[2]], [a[0], a[1] + h, a[2]], n, 2);
        top.quadAuto(a, z, [z[0], z[1] + h, z[2]], [a[0], a[1] + h, a[2]], [-n[0], 0, -n[2]], 2);
        glow.color(...light, 1); glow.quadAuto([a[0], a[1] + h - 0.35, a[2]], [z[0], z[1] + h - 0.35, z[2]], [z[0], z[1] + h - 0.25, z[2]], [a[0], a[1] + h - 0.25, a[2]], n, 1);
      };
      gate(u0, 4.2, C('#2a2d31'), [2.4, 0.25, 0.2]);
      gate(u1, 4.6, C('#151a20'), [1.4, 2.2, 2.6]);
      // (the doors' glass: a cool glow behind them - the lobby)
      const d0 = P(u1 - 0.01, ri + 0.4, 0.2), d1 = P(u1 - 0.01, ro - 0.2, 0.2);
      glow.color(0.55, 0.75, 0.95, 1); glow.quadAuto(d0, d1, [d1[0], d1[1] + 3.6, d1[2]], [d0[0], d0[1] + 3.6, d0[2]], [-Math.cos(u1), 0, Math.sin(u1)], 1);
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      // the glass all round (one see-through ring) and the city outside
      const glassH = RAMP.top + 6;
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(ro + 0.2, ro + 0.2, glassH, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c1218, transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.BackSide, depthWrite: false }));
      glass.position.set(c[0], c[1] + glassH / 2, c[2]); glass.renderOrder = 5; group.add(glass);
      const ring = cityRing(95, 140, 0, 3); ring.position.set(c[0], c[1] + 4, c[2]); group.add(ring);
      // two lamps that go with the car (a light ahead of it and one behind, under the ceiling)
      const lampA = new THREE.PointLight(0xcfe4ff, 9, 16, 2), lampB = new THREE.PointLight(0x9fc4ff, 5, 13, 2);
      group.add(lampA); group.add(lampB);
      root.add(group);
      return {
        group, meshes: built.meshes, solids: [], walk: null, room: null, outdoor: false,
        light: { sky: [0.16, 0.2, 0.27], ground: [0.06, 0.06, 0.07], hemi: 0.55, exposure: 1.15, env: 0.3 },
        follow(v) {
          // the lamps keep near the car (a car not on the ramp: they rest at its start)
          const u = v && v.rampU !== undefined ? v.rampU : 0;
          const a = P(u + 0.45, RAMP.mid, 3.4), bq = P(u - 0.25, RAMP.mid, 3.4);
          lampA.position.set(a[0], a[1], a[2]); lampB.position.set(bq[0], bq[1], bq[2]);
        },
      };
    },

    // ============================== THE LOBBY ==============================
    lobby() {
      const c = centerOf('lobby'), b = createBuilder([0, 0, 0], 42);
      const X = (x) => c[0] + x, Y = (y) => c[1] + y, Z = (z) => c[2] + z;
      const F = (x, z, rot = 0, y = 0) => frame(b, X(x), Z(z), rot, Y(y));
      const W = 20, D = 13, H = 8;
      const stone = C('#1b1e23'), wallC = C('#c6cacf'), dark = C('#23272d');
      // the floor: big dark stone slabs with thin joints
      b.plane('gloss', [[X(-W), Y(0), Z(-D)], [X(-W), Y(0), Z(D)], [X(W), Y(0), Z(D)], [X(W), Y(0), Z(-D)]], [0, 1, 0], 2, stone);
      for (let x = -W + 2.5; x < W; x += 2.5) b.box('paint', X(x), Y(0), Z(0), 0.02, 0.003, 2 * D, C('#0d0f12'), { r: 0 });
      for (let z = -D + 2.5; z < D; z += 2.5) b.box('paint', X(0), Y(0), Z(z), 2 * W, 0.003, 0.02, C('#0d0f12'), { r: 0 });
      // the ceiling, dark, with long lines of light
      b.plane('paint', [[X(-W), Y(H), Z(-D)], [X(-W), Y(H), Z(D)], [X(W), Y(H), Z(D)], [X(W), Y(H), Z(-D)]], [0, -1, 0], 2, dark);
      for (let z = -D + 2; z < D; z += 3.4) b.box('screen', X(0), Y(H - 0.06), Z(z), 2 * W - 3, 0.05, 0.12, [1.5, 1.6, 1.8], { r: 0 });
      // the walls: pale panels with dark fins
      const wall = (pts, n) => b.plane('paint', pts.map((p) => [X(p[0]), Y(p[1]), Z(p[2])]), n, 2, wallC);
      wall([[-W, 0, D], [W, 0, D], [W, H, D], [-W, H, D]], [0, 0, -1]);
      wall([[-W, 0, -D], [-W, 0, D], [-W, H, D], [-W, H, -D]], [1, 0, 0]);
      wall([[W, 0, -D], [W, 0, D], [W, H, D], [W, H, -D]], [-1, 0, 0]);
      // the front: glass doors in the middle (Nate comes in here), dark glass and posts on both sides
      wall([[-W, 0, -D], [-4, 0, -D], [-4, H, -D], [-W, H, -D]], [0, 0, 1]);
      wall([[4, 0, -D], [W, 0, -D], [W, H, -D], [4, H, -D]], [0, 0, 1]);
      wall([[-4, 4.2, -D], [4, 4.2, -D], [4, H, -D], [-4, H, -D]], [0, 0, 1]);
      b.plane('screen', [[X(-4), Y(0), Z(-D - 0.05)], [X(4), Y(0), Z(-D - 0.05)], [X(4), Y(4.2), Z(-D - 0.05)], [X(-4), Y(4.2), Z(-D - 0.05)]], [0, 0, 1], 1, [0.05, 0.07, 0.1]);
      for (const x of [-4, -2, 0, 2, 4]) b.box('metal', X(x), Y(0), Z(-D + 0.03), 0.08, 4.2, 0.08, C('#2b3036'), { r: 0.01 });
      for (let x = -W + 1.5; x < W; x += 3) for (const zz of [-D + 0.04, D - 0.04]) if (Math.abs(x) > 5) b.box('paint', X(x), Y(0), Z(zz), 0.18, H, 0.08, dark, { r: 0.01 });
      for (let z = -D + 1.5; z < D; z += 3) for (const xx of [-W + 0.04, W - 0.04]) b.box('paint', X(xx), Y(0), Z(z), 0.08, H, 0.18, dark, { r: 0.01 });
      // the reception desk in the middle: a long counter of pale stone, a line of light along its foot
      const desk = F(0, 2.4);
      desk.box('gloss', 0, 0, 0, 9, 1.08, 1.0, C('#d9d6cf'), { r: 0.04 });
      desk.box('gloss', 0, 1.08, -0.1, 9.2, 0.06, 1.3, C('#efece6'), { r: 0.02 });
      desk.box('screen', 0, 0.02, 0.52, 9, 0.04, 0.02, [1.4, 1.6, 1.9], { r: 0 });
      for (const x of [-2.5, 0.2, 2.8]) { desk.box('screen', x, 1.14, -0.35, 0.55, 0.36, 0.03, [0.35, 0.55, 0.75], { r: 0.01, tilt: -0.2 }); }
      desk.solid(-4.6, -0.65, 4.6, 0.65, 1.15);
      // the columns (round, dark stone, a ring of light at the top) - places to hide behind
      for (const [x, z] of [[-12.5, -6], [12.5, -6], [-12.5, 4.5], [12.5, 4.5], [-5.5, -8], [5.5, -8]]) {
        b.cyl('gloss', X(x), Y(0), Z(z), 0.75, 0.75, H, C('#2a2e34'), 28);
        b.cyl('screen', X(x), Y(H - 0.4), Z(z), 0.8, 0.8, 0.06, [1.3, 1.5, 1.8], 28);
        b.solid(X(x - 0.75), Z(z - 0.75), X(x + 0.75), Z(z + 0.75), H);
      }
      // long planters with low trees: cover
      for (const [x, z] of [[-8.5, -4], [8.5, -4], [-16, 1], [16, 1], [-7, 6.2], [7, 6.2]]) {
        const p = F(x, z, Math.abs(x) > 12 ? Math.PI / 2 : 0);
        p.box('gloss', 0, 0, 0, 3.8, 0.95, 1.1, C('#30353c'), { r: 0.04 });
        p.box('cloth', 0, 0.95, 0, 3.6, 0.06, 0.9, C('#2b2219'), { r: 0.01 });
        for (let i = -1; i <= 1; i++) for (let j = 0; j < 4; j++) p.sphere('cloth', i * 1.15 + (j - 1.5) * 0.18, 1.2 + (j % 2) * 0.18, (j % 2 ? 0.2 : -0.2), 0.34 + (j % 3) * 0.05, mul(C('#3c6a34'), 0.8 + 0.1 * j), 10);
        p.solid(-1.9, -0.55, 1.9, 0.55, 1.5);
      }
      // benches
      for (const [x, z] of [[-8.5, -6.1], [8.5, -6.1]]) { const p = F(x, z); p.box('wood', 0, 0.38, 0, 2.6, 0.08, 0.5, C('#5a4632'), { r: 0.02 }); for (const s of [-1, 1]) p.box('metal', s * 1.1, 0, 0, 0.08, 0.38, 0.42, C('#2a2d31'), { r: 0.01 }); p.solid(-1.3, -0.25, 1.3, 0.25, 0.5); }
      // the row of gates in front of the back of the hall: posts with glass wings; the staff gate in the middle
      // (closed until the card or the hack opens it) and low glass walls to the side walls
      for (let x = -7.2; x <= 7.2; x += 1.2) {
        if (Math.abs(x) < 1.0) continue;
        b.box('gloss', X(x), Y(0), Z(8), 0.24, 1.02, 1.3, C('#d6d9dc'), { r: 0.04 });
        b.box('screen', X(x), Y(1.02), Z(8), 0.2, 0.02, 1.0, [0.5, 1.4, 0.9], { r: 0 });
      }
      b.solid(X(-7.4), Z(7.35), X(-0.9), Z(8.65), 1.05);
      b.solid(X(0.9), Z(7.35), X(7.4), Z(8.65), 1.05);
      for (const s of [-1, 1]) { b.box('metal', X(s * 13.7), Y(1.15), Z(8), 12.6, 0.05, 0.08, C('#8d949b'), { r: 0.01 }); b.solid(X(s > 0 ? 7.4 : -20), Z(7.9), X(s > 0 ? 20 : -7.4), Z(8.1), 1.2); }
      // the white wall of light behind the gates, with the company's name
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      const lw = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.7), new THREE.MeshBasicMaterial({ map: kviWall(), toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
      lw.position.set(X(0), Y(4.2), Z(D - 0.06)); lw.rotation.y = Math.PI; group.add(lw);
      // the glass of the low walls and the staff gate's two glass wings (they slide open)
      const glassM = new THREE.MeshStandardMaterial({ color: 0x9fb3c4, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
      for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.1), glassM); g.position.set(X(s * 13.7), Y(0.6), Z(8)); group.add(g); }
      const wings = [];
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.03), glassM); w.position.set(X(s * 0.45), Y(0.55), Z(8)); w.userData.x0 = X(s * 0.45); w.userData.s = s; group.add(w); wings.push(w); }
      // the doors of the atrium at the back (two dark leaves that slide apart)
      const doorM = new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.35, metalness: 0.6 });
      const leaves = [];
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 0.08), doorM); l.position.set(X(s * 0.75), Y(1.7), Z(D - 0.12)); l.userData.x0 = X(s * 0.75); l.userData.s = s; group.add(l); leaves.push(l); }
      // lights: three cool lamps over the hall, the warm glow of the desk
      for (const [x, z, k] of [[-10, -3, 1], [10, -3, 1], [0, 8, 1.3]]) { const l = new THREE.PointLight(0xcfe0ff, 16 * k, 22, 2); l.position.set(X(x), Y(6.5), Z(z)); group.add(l); }
      const dl = new THREE.PointLight(0xffd9a8, 4, 7, 2); dl.position.set(X(0), Y(1.8), Z(1.2)); group.add(dl);
      root.add(group);
      const doors = { gate: { open: 0, want: 0, parts: wings, width: 0.85, solid: [X(-0.9), Z(7.35), X(0.9), Z(8.65), 1.05] }, atrium: { open: 0, want: 0, parts: leaves, width: 1.45 } };
      return {
        group, meshes: built.meshes, doors,
        solids: b.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.h]).concat([doors.gate.solid]),
        walk: { minX: X(-W + 0.4), maxX: X(W - 0.4), minZ: Z(-D + 0.4), maxZ: Z(D - 0.3) },
        room: { minX: X(-W), maxX: X(W), minZ: Z(-D), maxZ: Z(D), floor: Y(0), top: Y(H - 0.3), dist: 3.2 },
        light: { sky: [0.2, 0.24, 0.3], ground: [0.06, 0.06, 0.07], hemi: 0.6, exposure: 1.1, env: 0.35 },
      };
    },

    // ============================== THE ATRIUM ==============================
    atrium() {
      const c = centerOf('atrium'), b = createBuilder([0, 0, 0], 43);
      const X = (x) => c[0] + x, Y = (y) => c[1] + y, Z = (z) => c[2] + z;
      const F = (x, z, rot = 0, y = 0) => frame(b, X(x), Z(z), rot, Y(y));
      const W = 11, H = 34;
      const stone = C('#25282d'), wallC = C('#b9bec4');
      b.plane('gloss', [[X(-W), Y(0), Z(-W)], [X(-W), Y(0), Z(W)], [X(W), Y(0), Z(W)], [X(W), Y(0), Z(-W)]], [0, 1, 0], 2, stone);
      for (const [n, pts] of [[[0, 0, -1], [[-W, 0, W], [W, 0, W], [W, H, W], [-W, H, W]]], [[0, 0, 1], [[-W, 0, -W], [W, 0, -W], [W, H, -W], [-W, H, -W]]], [[1, 0, 0], [[-W, 0, -W], [-W, 0, W], [-W, H, W], [-W, H, -W]]], [[-1, 0, 0], [[W, 0, -W], [W, 0, W], [W, H, W], [W, H, -W]]]]) b.plane('paint', pts.map((p) => [X(p[0]), Y(p[1]), Z(p[2])]), n, 2, wallC);
      b.plane('screen', [[X(-W), Y(H), Z(-W)], [X(-W), Y(H), Z(W)], [X(W), Y(H), Z(W)], [X(W), Y(H), Z(-W)]], [0, -1, 0], 4, [0.12, 0.14, 0.2]);
      // the balconies all round, every 5 m: a slab, a glass rail with a line of light, the lit offices behind
      for (let y = 5; y < H - 2; y += 5) {
        const k = 1.8;
        for (const [x0, z0, x1, z1] of [[-W, W - k, W, W], [-W, -W, W, -W + k], [-W, -W + k, -W + k, W - k], [W - k, -W + k, W, W - k]]) {
          b.box('paint', X((x0 + x1) / 2), Y(y - 0.35), Z((z0 + z1) / 2), x1 - x0, 0.35, z1 - z0, C('#d5d8dc'), { r: 0.02 });
        }
        for (const [x, z, sx, sz] of [[0, W - k, 2 * W - 2 * k, 0.04], [0, -W + k, 2 * W - 2 * k, 0.04], [-W + k, 0, 0.04, 2 * W - 2 * k], [W - k, 0, 0.04, 2 * W - 2 * k]]) {
          b.box('screen', X(x), Y(y + 1.0), Z(z), sx + 0.04, 0.03, sz + 0.02, [1.4, 1.7, 2.1], { r: 0 });
          b.box('glass', X(x), Y(y), Z(z), sx, 1.0, sz + 0.01, [0.7, 0.8, 0.9], { r: 0 });
        }
        for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
          const t2 = -W + 2.3 + i * 2.5;
          if ((i + y) % 3 === 0) continue;
          b.box('screen', X(t2), Y(y + 0.9), Z(s * (W - 0.02)), 1.6, 1.2, 0.01, (i + y) % 2 ? [0.55, 0.62, 0.7] : [0.75, 0.68, 0.55], { r: 0 });
          b.box('screen', X(s * (W - 0.02)), Y(y + 0.9), Z(t2), 0.01, 1.2, 1.6, (i * y) % 3 ? [0.5, 0.58, 0.68] : [0.72, 0.66, 0.52], { r: 0 });
        }
      }
      // the dark pool in the middle and, over it, the light rods hanging from the top in rings
      b.cyl('gloss', X(0), Y(0), Z(0), 3.25, 3.25, 0.42, C('#3a3f46'), 40);
      b.cyl('gloss', X(0), Y(0.33), Z(0), 3.0, 3.0, 0.1, C('#0b1220'), 40);
      b.solid(X(-3.2), Z(-3.2), X(3.2), Z(3.2), 0.45);
      for (let ring = 0; ring < 4; ring++) {
        const r = 0.6 + ring * 0.8, n = 8 + ring * 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + ring * 0.4, len = 3 + ((i * 7 + ring * 3) % 9) * 1.1, y0 = H - 4 - len - ring * 2.5 - ((i * 5) % 4) * 1.4;
          b.box('screen', X(Math.cos(a) * r), Y(y0), Z(Math.sin(a) * r), 0.035, len, 0.035, [1.8 + ring * 0.2, 2.0, 2.4], { r: 0 });
        }
      }
      // big trees in pots at the corners
      for (const [x, z] of [[-8.6, -8.6], [8.6, -8.6], [-8.6, 8.2], [8.6, 8.2]]) { const p = F(x, z); bigPlant(p, 0, 0); bigPlant(p, 0.5, 0.3); }
      // the security door to the lifts (north) and its terminal
      const dw = F(0, W - 0.06, Math.PI);
      dw.box('metal', 0, 0, 0.05, 3.6, 3.6, 0.2, C('#1a1e23'), { r: 0.02 });
      const term = F(2.9, W - 1.4, Math.PI);
      term.box('metal', 0, 0, 0, 0.5, 1.0, 0.4, C('#2a2f35'), { r: 0.03 });
      term.box('screen', 0, 1.0, 0.08, 0.46, 0.3, 0.02, [0.25, 0.6, 0.85], { r: 0.005, tilt: -0.5 });
      term.solid(-0.3, -0.25, 0.3, 0.25, 1.1);
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      // the door leaves (they slide up into the wall when it opens) and the light over it (red, then green)
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x20262d, roughness: 0.3, metalness: 0.7 }));
      leaf.position.set(X(0), Y(1.6), Z(W - 0.2)); leaf.userData.y0 = Y(1.6); group.add(leaf);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }));
      lamp.position.set(X(0), Y(3.45), Z(W - 0.12)); group.add(lamp);
      const l1 = new THREE.PointLight(0xd8e6ff, 18, 26, 2); l1.position.set(X(0), Y(9), Z(0)); group.add(l1);
      const l2 = new THREE.PointLight(0xffe2c0, 5, 10, 2); l2.position.set(X(2.6), Y(2.6), Z(W - 2.2)); group.add(l2);
      root.add(group);
      const doors = { atrium: { open: 0, want: 0, parts: [leaf], lift: true, lamp, solid: [X(-1.6), Z(W - 0.3), X(1.6), Z(W + 0.2), 3.3] } };
      return {
        group, meshes: built.meshes, doors,
        solids: b.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.h]).concat([doors.atrium.solid]),
        walk: { minX: X(-W + 0.4), maxX: X(W - 0.4), minZ: Z(-W + 0.4), maxZ: Z(W + 1.6) },
        room: { minX: X(-W), maxX: X(W), minZ: Z(-W), maxZ: Z(W + 1.8), floor: Y(0), top: Y(H - 1), dist: 3.2 },
        light: { sky: [0.22, 0.26, 0.33], ground: [0.07, 0.07, 0.08], hemi: 0.65, exposure: 1.1, env: 0.35 },
      };
    },

    // ============================== THE LIFT ==============================
    shaft() {
      const c = centerOf('shaft'), b = createBuilder([0, 0, 0], 44);
      const X = (x) => c[0] + x, Y = (y) => c[1] + y, Z = (z) => c[2] + z;
      const K = 1.25;                 // half the cab
      // the cab: a dark floor, a solid back wall with a rail, glass on three sides, a panel of light above
      b.box('gloss', X(0), Y(-0.12), Z(0), 2 * K, 0.12, 2 * K, C('#1c1f24'), { r: 0.01 });
      b.box('paint', X(0), Y(0), Z(-K + 0.04), 2 * K, 2.9, 0.08, C('#2b3036'), { r: 0.01 });
      b.box('metal', X(0), Y(0.95), Z(-K + 0.12), 2 * K - 0.3, 0.04, 0.04, C('#b9c0c7'), { r: 0.015 });
      b.box('paint', X(0), Y(2.9), Z(0), 2 * K, 0.12, 2 * K, C('#191c20'), { r: 0.01 });
      b.box('screen', X(0), Y(2.88), Z(0), 2 * K - 0.5, 0.02, 2 * K - 0.5, [1.6, 1.7, 1.9], { r: 0 });
      for (const [x, z] of [[-K, -K], [K, -K], [-K, K], [K, K]]) b.box('metal', X(x), Y(0), Z(z), 0.07, 2.9, 0.07, C('#2a2f35'), { r: 0.01 });
      // the shaft round it (a group that slides down while the cab "goes up"): concrete walls, steel beams, strips
      const walls = createBuilder([0, 0, 0], 45);
      const S = 2.1, SEG = 4, N = 22;
      for (let i = 0; i < N; i++) {
        const y = -N * SEG / 2 + i * SEG;
        for (const [n, x0, z0, x1, z1] of [[[0, 0, 1], -S, -S, S, -S], [[0, 0, -1], -S, S, S, S], [[1, 0, 0], -S, -S, -S, S], [[-1, 0, 0], S, -S, S, S]]) {
          walls.plane('plaster', [[x0, y, z0], [x1, y, z1], [x1, y + SEG, z1], [x0, y + SEG, z0]], n, 2, C('#585c61'));
        }
        walls.box('metal', 0, y + 0.1, -S + 0.12, 2 * S, 0.22, 0.12, C('#30343a'), { r: 0.01 });
        walls.box('metal', 0, y + 0.1, S - 0.12, 2 * S, 0.22, 0.12, C('#30343a'), { r: 0.01 });
        if (i % 2 === 0) for (const s of [-1, 1]) walls.box('screen', s * (S - 0.03), y + 1.9, 0, 0.02, 0.06, 2 * S - 0.6, [1.8, 2.0, 2.3], { r: 0 });
      }
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      const wallG = new THREE.Group(); wallG.position.set(c[0], c[1], c[2]);
      walls.finish(wallG, mats());
      group.add(wallG);
      // the glass of the cab (see-through, rain on it when the shaft opens to the sky)
      const glassM = new THREE.MeshStandardMaterial({ color: 0x8fa4b8, transparent: true, opacity: 0.12, roughness: 0.04, depthWrite: false });
      for (const [x, z, ry] of [[0, K, 0], [-K, 0, Math.PI / 2], [K, 0, Math.PI / 2]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(2 * K, 2.9), glassM); g.position.set(X(x), Y(1.45), Z(z)); g.rotation.y = ry; group.add(g); }
      // the city far below (only when the shaft is glass)
      const ring = cityRing(70, 160, 0, 2); ring.position.set(c[0], c[1] - 20, c[2]); ring.visible = false; group.add(ring);
      // the floor number over the door
      const sign = floorSign();
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: sign.t, toneMapped: false }));
      sm.position.set(X(0), Y(2.62), Z(-K + 0.09)); group.add(sm);
      const lamp = new THREE.PointLight(0xdbe8ff, 6, 7, 2); lamp.position.set(X(0), Y(2.5), Z(0)); group.add(lamp);
      root.add(group);
      let speed = 0, offset = 0;
      return {
        group, meshes: built.meshes, solids: [],
        walk: { minX: X(-K + 0.35), maxX: X(K - 0.35), minZ: Z(-K + 0.35), maxZ: Z(K - 0.35) },
        room: { minX: X(-K - 0.4), maxX: X(K + 0.4), minZ: Z(-K - 0.4), maxZ: Z(K + 0.4), floor: Y(0), top: Y(2.8), dist: 1.6 },
        light: { sky: [0.16, 0.19, 0.25], ground: [0.05, 0.05, 0.06], hemi: 0.5, exposure: 1.15, env: 0.3 },
        ride(v) { speed = v; },
        view(kind) { const city = kind === 'city'; ring.visible = city; wallG.visible = !city; },
        floor(n) { sign.draw(n); },
        update(dt) {
          // the walls slide past (one 4 m piece of the shaft repeats)
          offset = (offset - speed * dt) % (SEG * 2);
          wallG.position.y = c[1] + offset;
          if (ring.visible) ring.position.y = c[1] - 20 + offset * 0.04;
        },
      };
    },

    // ============================== THE SERVER FLOOR ==============================
    server() {
      const c = centerOf('server'), b = createBuilder([0, 0, 0], 46);
      const X = (x) => c[0] + x, Y = (y) => c[1] + y, Z = (z) => c[2] + z;
      const F = (x, z, rot = 0, y = 0) => frame(b, X(x), Z(z), rot, Y(y));
      const W = 17, D = 13, H = 5;
      // a raised floor of dark grey panels (60 cm), a few with air holes
      b.plane('gloss', [[X(-W), Y(0), Z(-D)], [X(-W), Y(0), Z(D)], [X(W), Y(0), Z(D)], [X(W), Y(0), Z(-D)]], [0, 1, 0], 2, C('#30353c'));
      for (let x = -W + 0.6; x < W; x += 0.6) b.box('paint', X(x), Y(0), Z(0), 0.012, 0.002, 2 * D, C('#15181c'), { r: 0 });
      for (let z = -D + 0.6; z < D; z += 0.6) b.box('paint', X(0), Y(0), Z(z), 2 * W, 0.002, 0.012, C('#15181c'), { r: 0 });
      for (let x = -W + 1.5; x < W; x += 3) for (const z of [-5.6, -0.8, 4.2]) b.box('metal', X(x), Y(0), Z(z), 0.54, 0.004, 0.54, C('#4a525b'), { r: 0 });
      b.plane('paint', [[X(-W), Y(H), Z(-D)], [X(-W), Y(H), Z(D)], [X(W), Y(H), Z(D)], [X(W), Y(H), Z(-D)]], [0, -1, 0], 2, C('#14171b'));
      for (const [n, pts] of [[[0, 0, -1], [[-W, 0, D], [W, 0, D], [W, H, D], [-W, H, D]]], [[0, 0, 1], [[-W, 0, -D], [W, 0, -D], [W, H, -D], [-W, H, -D]]], [[1, 0, 0], [[-W, 0, -D], [-W, 0, D], [-W, H, D], [-W, H, -D]]], [[-1, 0, 0], [[W, 0, -D], [W, 0, -2], [W, H, -2], [W, H, -D]]], [[-1, 0, 0], [[W, 0, 2], [W, 0, D], [W, H, D], [W, H, 2]]], [[-1, 0, 0], [[W, 3.2, -2], [W, 3.2, 2], [W, H, 2], [W, H, -2]]]]) b.plane('paint', pts.map((p) => [X(p[0]), Y(p[1]), Z(p[2])]), n, 2, C('#2c3138'));
      // cable trays and lines of cold light under the ceiling (their color changes with the alarm: own meshes below)
      for (let z = -D + 3; z < D; z += 5) b.box('metal', X(0), Y(H - 0.55), Z(z), 2 * W - 2, 0.12, 0.5, C('#2a2e33'), { r: 0.01 });
      // the rows of racks: dark metal, lights on their fronts (one picture of small lights for every rack)
      const led = b.mb('led');
      const rows = [-8, -3.2, 1.6];
      for (const z of rows) for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const x = side * (2.2 + i * 0.84 + 0.42);
          b.box('metal', X(x), Y(0), Z(z), 0.8, 2.3, 1.1, C('#1a1d22'), { r: 0.01 });
          for (const f of [-1, 1]) {
            const zf = Z(z + f * 0.556), x0 = X(x - 0.36), x1 = X(x + 0.36);
            led.color(1, 1, 1, 1);
            quadUV(led, [x0, Y(0.15), zf], [x1, Y(0.15), zf], [x1, Y(2.15), zf], [x0, Y(2.15), zf], [0, 0, f]);
          }
        }
        b.solid(X(side > 0 ? 2.2 : -2.2 - 7 * 0.84), Z(z - 0.6), X(side > 0 ? 2.2 + 7 * 0.84 : -2.2), Z(z + 0.6), 2.3);
      }
      // the HALO core at the back: a column of light in glass with steel rings, the console in front of it
      b.cyl('metal', X(0), Y(0), Z(9.6), 1.35, 1.35, 0.4, C('#2f343b'), 40);
      b.cyl('metal', X(0), Y(H - 0.5), Z(9.6), 1.35, 1.35, 0.5, C('#2f343b'), 40);
      b.cyl('screen', X(0), Y(0.4), Z(9.6), 0.42, 0.42, H - 0.9, [0.7, 1.7, 2.4], 24);
      for (let y = 0.9; y < H - 0.6; y += 0.9) b.torus('metal', X(0), Y(y), Z(9.6), 1.12, 0.04, C('#8a939c'), [Math.PI / 2, 0, 0]);
      b.solid(X(-1.4), Z(8.2), X(1.4), Z(11), H);
      const con = F(0, 7.3, Math.PI);
      con.box('metal', 0, 0, 0, 1.6, 0.95, 0.6, C('#23272d'), { r: 0.03 });
      con.box('screen', 0, 0.95, 0.05, 1.4, 0.04, 0.45, [0.3, 0.75, 1.0], { r: 0.01, tilt: -0.3 });
      con.solid(-0.85, -0.35, 0.85, 0.35, 1.0);
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      // the glass round the core (see-through)
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, H - 0.9, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
      glass.position.set(X(0), Y(0.4 + (H - 0.9) / 2), Z(9.6)); glass.renderOrder = 5; group.add(glass);
      // the lines of light under the ceiling: white-blue, or red with the alarm
      const stripM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.6, 2.0), toneMapped: false });
      for (let z = -D + 1.5; z < D; z += 5) { const s = new THREE.Mesh(new THREE.BoxGeometry(2 * W - 3, 0.04, 0.1), stripM); s.position.set(X(0), Y(H - 0.05), Z(z)); group.add(s); }
      // a low cold mist over the floor
      const mistM = new THREE.MeshBasicMaterial({ color: 0x6fa8d8, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending });
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * D), mistM); mist.rotation.x = -Math.PI / 2; mist.position.set(X(0), Y(0.35), Z(0)); group.add(mist);
      const lamps = [];
      for (const [x, z] of [[-9, -5], [9, -5], [0, 6]]) { const l = new THREE.PointLight(0x9fd0ff, 10, 16, 2); l.position.set(X(x), Y(4.2), Z(z)); group.add(l); lamps.push(l); }
      const coreLight = new THREE.PointLight(0x7fd8ff, 8, 9, 2); coreLight.position.set(X(0), Y(2.2), Z(8.2)); group.add(coreLight);
      root.add(group);
      let alarm = false;
      return {
        group, meshes: built.meshes,
        solids: b.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.h]),
        walk: { minX: X(-W + 0.4), maxX: X(W + 2.5), minZ: Z(-D + 0.4), maxZ: Z(D - 0.4) },
        room: { minX: X(-W), maxX: X(W + 3), minZ: Z(-D), maxZ: Z(D), floor: Y(0), top: Y(H - 0.3), dist: 2.8 },
        light: { sky: [0.12, 0.17, 0.24], ground: [0.05, 0.06, 0.07], hemi: 0.5, exposure: 1.15, env: 0.3 },
        alarm(on) { alarm = !!on; },
        update(dt, t) {
          // the alarm: everything turns red and the lamps beat
          const beat = alarm ? 0.45 + 0.55 * Math.max(0, Math.sin(t * 6.5)) : 1;
          stripM.color.setRGB(alarm ? 2.4 * beat : 1.2, alarm ? 0.2 : 1.6, alarm ? 0.15 : 2.0);
          for (const l of lamps) { l.color.setHex(alarm ? 0xff3022 : 0x9fd0ff); l.intensity = alarm ? 12 * beat : 10; }
          coreLight.intensity = 8 + Math.sin(t * 1.3) * 1.5;
          mistM.opacity = 0.05 + Math.sin(t * 0.4) * 0.015;
        },
      };
    },

    // ============================== THE SKY GARDEN ==============================
    terrace() {
      const c = centerOf('terrace'), b = createBuilder([0, 0, 0], 47);
      const X = (x) => c[0] + x, Y = (y) => c[1] + y, Z = (z) => c[2] + z;
      const F = (x, z, rot = 0, y = 0) => frame(b, X(x), Z(z), rot, Y(y));
      const W = 16, D = 7;
      // wet dark stone, a strip of light along its edge
      b.plane('gloss', [[X(-W), Y(0), Z(-D)], [X(-W), Y(0), Z(D)], [X(W), Y(0), Z(D)], [X(W), Y(0), Z(-D)]], [0, 1, 0], 2, C('#202428'));
      for (let x = -W + 2; x < W; x += 2) b.box('paint', X(x), Y(0), Z(0), 0.02, 0.003, 2 * D, C('#121417'), { r: 0 });
      b.box('screen', X(0), Y(0), Z(-D + 0.25), 2 * W, 0.02, 0.05, [1.3, 1.7, 2.1], { r: 0 });
      // the glass rail on the open side (south) with a steel top: the city far below behind it
      b.box('metal', X(0), Y(1.1), Z(-D + 0.05), 2 * W, 0.06, 0.1, C('#9aa1a8'), { r: 0.02 });
      for (let x = -W; x <= W; x += 2) b.box('metal', X(x), Y(0), Z(-D + 0.05), 0.05, 1.1, 0.05, C('#5a6067'), { r: 0.01 });
      b.solid(X(-W), Z(-D - 0.2), X(W), Z(-D + 0.2), 1.15);
      // the tower behind it (north): tall glass with dark posts and the faint light of the floors
      b.plane('paint', [[X(-W), Y(0), Z(D)], [X(W), Y(0), Z(D)], [X(W), Y(16), Z(D)], [X(-W), Y(16), Z(D)]], [0, 0, -1], 2, C('#0f1418'));
      for (let x = -W; x <= W; x += 1.6) b.box('metal', X(x), Y(0), Z(D - 0.06), 0.1, 16, 0.12, C('#1b2025'), { r: 0.01 });
      for (let y = 3.6; y < 16; y += 3.6) b.box('screen', X(0), Y(y), Z(D - 0.05), 2 * W, 0.05, 0.02, [0.55, 0.7, 0.85], { r: 0 });
      // the two ends: the door from the server floor (east, +x) and the steel doors of the service lift (west)
      for (const s of [-1, 1]) b.plane('paint', [[X(s * W), Y(0), Z(-D)], [X(s * W), Y(0), Z(D)], [X(s * W), Y(5), Z(D)], [X(s * W), Y(5), Z(-D)]], [-s, 0, 0], 2, C('#2a3036'));
      const lift = F(-W + 0.06, 1.5, Math.PI / 2);
      lift.box('metal', 0, 0, 0, 1.6, 2.6, 0.06, C('#7d848b'), { r: 0.01 });
      lift.box('screen', 0, 2.75, 0.04, 1.6, 0.05, 0.02, [2.2, 1.6, 0.6], { r: 0 });
      const exitD = F(W - 0.06, 0, -Math.PI / 2);
      exitD.box('paint', 0, 0, 0, 1.4, 2.5, 0.06, C('#14181c'), { r: 0.01 });
      // planters with trees, benches, low lights between them: cover from the drone's light
      for (const [x, z] of [[-10, -2.5], [-3.5, 2.4], [3.5, -2.5], [10, 2.4]]) {
        const p = F(x, z);
        p.box('gloss', 0, 0, 0, 3.4, 0.9, 1.7, C('#363c43'), { r: 0.05 });
        p.box('cloth', 0, 0.9, 0, 3.2, 0.05, 1.5, C('#2a2118'), { r: 0.01 });
        bigPlant(p, -0.8, 0); bigPlant(p, 0.9, 0.1);
        for (let i = 0; i < 6; i++) p.sphere('cloth', -1.3 + i * 0.52, 1.0, (i % 2 ? 0.45 : -0.4), 0.3, mul(C('#365e30'), 0.8 + 0.08 * i), 9);
        p.solid(-1.75, -0.9, 1.75, 0.9, 1.6);
      }
      for (const [x, z] of [[-7, 2.6], [0, -2.6], [7, 2.6]]) { const p = F(x, z); p.box('wood', 0, 0.4, 0, 2.2, 0.07, 0.5, C('#4f3d2c'), { r: 0.02 }); p.box('gloss', 0, 0, 0, 2.0, 0.4, 0.4, C('#3a4047'), { r: 0.03 }); p.solid(-1.1, -0.25, 1.1, 0.25, 0.48); }
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      const glassM = new THREE.MeshStandardMaterial({ color: 0x9fb3c4, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
      const rail = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 1.1), glassM); rail.position.set(X(0), Y(0.55), Z(-D + 0.05)); group.add(rail);
      const ring = cityRing(140, 240, 0, 3); ring.position.set(c[0], c[1] - 8, c[2]); group.add(ring);
      const lamps = [];
      for (const x of [-12, -4, 4, 12]) { const l = new THREE.PointLight(0xffd2a0, 3.2, 7, 2); l.position.set(X(x), Y(0.6), Z(x % 8 === 0 ? 0.2 : -0.2)); group.add(l); lamps.push(l); }
      const sky = new THREE.HemisphereLight(0x3a4a66, 0x0a0b0e, 0.0); group.add(sky);
      root.add(group);
      return {
        group, meshes: built.meshes, outdoor: true,
        solids: b.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.h]),
        walk: { minX: X(-W + 0.4), maxX: X(W - 0.4), minZ: Z(-D + 0.45), maxZ: Z(D - 0.4) },
        room: { minX: X(-W), maxX: X(W), minZ: Z(-D - 2), maxZ: Z(D), floor: Y(0), top: Y(9), dist: 3.4 },
        light: { sky: [0.16, 0.2, 0.28], ground: [0.05, 0.05, 0.06], hemi: 0.55, exposure: 1.15, env: 0.3 },
      };
    },

    // ============================== THE GLASS ROOM ==============================
    glass() {
      const c = centerOf('glass'), b = createBuilder([0, 0, 0], 48);
      const X = (x) => c[0] + x, Y = (y) => c[1] + y, Z = (z) => c[2] + z;
      const F = (x, z, rot = 0, y = 0) => frame(b, X(x), Z(z), rot, Y(y));
      const W = 13, D = 8, H = 4.6;
      b.plane('gloss', [[X(-W), Y(0), Z(-D)], [X(-W), Y(0), Z(D)], [X(W), Y(0), Z(D)], [X(W), Y(0), Z(-D)]], [0, 1, 0], 3, C('#16181b'));
      b.plane('paint', [[X(-W), Y(H), Z(-D)], [X(-W), Y(H), Z(D)], [X(W), Y(H), Z(D)], [X(W), Y(H), Z(-D)]], [0, -1, 0], 2, C('#1b1d21'));
      // the back wall (south): dark wood, the lift doors in its middle
      b.plane('wood', [[X(-W), Y(0), Z(-D)], [X(W), Y(0), Z(-D)], [X(W), Y(H), Z(-D)], [X(-W), Y(H), Z(-D)]], [0, 0, 1], 1.2, C('#3a2c22'));
      const ld = F(0, -D + 0.05);
      ld.box('metal', 0, 0, 0, 2.0, 2.8, 0.05, C('#8b9198'), { r: 0.01 });
      ld.box('paint', 0, 0, 0.03, 0.02, 2.8, 0.02, C('#20242a'), { r: 0 });
      // glass on three sides: thin dark posts every 2.2 m, a low sill
      for (let x = -W; x <= W + 0.01; x += 2.6) b.box('metal', X(x), Y(0), Z(D - 0.05), 0.08, H, 0.1, C('#121518'), { r: 0.01 });
      for (let z = -D; z <= D + 0.01; z += 2.6) for (const s of [-1, 1]) b.box('metal', X(s * (W - 0.05)), Y(0), Z(z), 0.1, H, 0.08, C('#121518'), { r: 0.01 });
      b.box('paint', X(0), Y(0), Z(D - 0.1), 2 * W, 0.1, 0.2, C('#0e1012'), { r: 0.01 });
      for (const s of [-1, 1]) b.box('paint', X(s * (W - 0.1)), Y(0), Z(0), 0.2, 0.1, 2 * D, C('#0e1012'), { r: 0.01 });
      // the long table (dark stone on two steel legs) and its chairs; a line of light hangs over it
      const tbl = F(0, 1);
      tbl.box('gloss', 0, 0.72, 0, 9.4, 0.07, 1.5, C('#202326'), { r: 0.02 });
      for (const s of [-1, 1]) tbl.box('metal', s * 3.6, 0, 0, 0.12, 0.72, 1.1, C('#33383e'), { r: 0.02 });
      tbl.solid(-4.75, -0.8, 4.75, 0.8, 0.8);
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) officeChair(F(-3.6 + i * 1.8, 1 + s * 1.15, s > 0 ? Math.PI : 0), { color: C('#1e2124') });
      b.box('screen', X(0), Y(3.05), Z(1), 8.6, 0.04, 0.06, [2.0, 1.85, 1.6], { r: 0 });
      b.box('metal', X(0), Y(3.09), Z(1), 8.7, 0.05, 0.1, C('#202326'), { r: 0.01 });
      for (const s of [-1, 1]) b.box('metal', X(s * 4), Y(3.14), Z(1), 0.01, H - 3.14, 0.01, C('#8a8f95'), { r: 0 });
      // the console of the kill-switch at the other head of the table (Lena's code waits on it)
      const con = F(-6.1, 1, Math.PI / 2);
      con.box('metal', 0, 0, 0, 0.6, 1.02, 0.45, C('#24282d'), { r: 0.04 });
      con.box('screen', 0, 1.02, 0.03, 0.54, 0.03, 0.36, [0.25, 0.55, 0.8], { r: 0.01, tilt: -0.35 });
      con.solid(-0.35, -0.28, 0.35, 0.28, 1.05);
      // a low cabinet by the wall with a single glass and a bottle (Vance does not drink it)
      const cab = F(8.6, -D + 0.5);
      cab.box('wood', 0, 0, 0, 2.4, 0.8, 0.5, C('#2e241c'), { r: 0.02 });
      cab.lathe('glass', 0.3, 0.8, 0, [[0, 0], [0.035, 0], [0.04, 0.09], [0.038, 0.095], [0, 0.01]], [0.8, 0.85, 0.9], 14);
      cab.lathe('glass', -0.3, 0.8, 0.05, [[0, 0], [0.045, 0], [0.05, 0.2], [0.02, 0.28], [0.02, 0.34], [0, 0.34]], [0.5, 0.35, 0.2], 14);
      cab.solid(-1.25, -0.3, 1.25, 0.3, 0.85);
      plant(F(-12.0, -D + 0.6), 0, 0, 0, 2.6, { n: 14, tall: 0.5, pot: C('#30343a') });
      // a tall mirror on the back wall, left of the lift (the last shot of "Keep him"): a thin dark frame
      const mf = F(-9.6, -D + 0.04);
      for (const [x, y, w, h] of [[-0.58, 0.2, 0.06, 2.22], [0.58, 0.2, 0.06, 2.22], [0, 0.17, 1.22, 0.06], [0, 2.39, 1.22, 0.06]]) mf.box('metal', x, y, 0.02, w, h, 0.05, C('#1a1c1f'), { r: 0.01 });
      const group = new THREE.Group();
      const built = b.finish(group, mats());
      // the windows: dark glass on the sides, and the big north window with rain running down it
      const glassM = new THREE.MeshStandardMaterial({ color: 0x0c1014, transparent: true, opacity: 0.2, roughness: 0.04, depthWrite: false });
      for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(2 * D, H), glassM); g.position.set(X(s * W), Y(H / 2), Z(0)); g.rotation.y = Math.PI / 2; group.add(g); }
      const rainU = { uTime: { value: 0 }, uScale: { value: new THREE.Vector2(2 * W * 0.45, H * 0.45) }, uOpacity: { value: 0.75 }, uTint: { value: new THREE.Color(0.5, 0.58, 0.72) }, uSoft: { value: 0.25 } };
      const rain = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, H), new THREE.ShaderMaterial({ uniforms: rainU, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false }));
      rain.position.set(X(0), Y(H / 2), Z(D - 0.02)); rain.rotation.y = Math.PI; rain.renderOrder = 6; group.add(rain);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, H), glassM); win.position.set(X(0), Y(H / 2), Z(D)); win.rotation.y = Math.PI; win.renderOrder = 5; group.add(win);
      const ring = cityRing(160, 260, 0, 3); ring.position.set(c[0], c[1] - 6, c[2]); group.add(ring);
      // the mirror's glass: a real reflection, drawn only while it is used (it costs a second picture of the room)
      const mirror = new Reflector(new THREE.PlaneGeometry(1.1, 2.18), { textureWidth: 384, textureHeight: 768, color: 0x8a9096 });
      mirror.position.set(X(-9.6), Y(1.31), Z(-D + 0.03)); mirror.camera.layers.set(INTERIOR_LAYER); mirror.visible = false; group.add(mirror);
      const over = new THREE.PointLight(0xffe7c4, 7, 9, 2); over.position.set(X(0), Y(2.7), Z(1)); group.add(over);
      const cold = new THREE.PointLight(0x7fa2d6, 6, 16, 2); cold.position.set(X(0), Y(3.2), Z(D - 1.5)); group.add(cold);
      const conL = new THREE.PointLight(0x6fb4ff, 1.6, 3, 2); conL.position.set(X(-6.1), Y(1.4), Z(1)); group.add(conL);
      root.add(group);
      return {
        group, meshes: built.meshes, rainU, mirror,
        solids: b.colliders.map((q) => [q.x0, q.z0, q.x1, q.z1, q.h]),
        walk: { minX: X(-W + 0.45), maxX: X(W - 0.45), minZ: Z(-D + 0.45), maxZ: Z(D - 0.45) },
        room: { minX: X(-W), maxX: X(W), minZ: Z(-D), maxZ: Z(D), floor: Y(0), top: Y(H - 0.25), dist: 2.8 },
        light: { sky: [0.12, 0.15, 0.22], ground: [0.05, 0.05, 0.06], hemi: 0.5, exposure: 1.2, env: 0.28 },
        update(dt, t) { rainU.uTime.value = t; conL.intensity = 1.6 + Math.sin(t * 2.1) * 0.3; },
      };
    },
  };

  // ---------------------------------------------------------------- the spiral ramp as an arena (src/vehicles)
  const RC = centerOf('ramp');
  // the angle along the ramp of a point at height y: the turn (of the ones at this place) whose road is nearest
  function pickU(th, y) {
    let best = null, bestD = 1e9;
    for (let k = -1; k <= 3; k++) {
      const u = th + TAU * k;
      if (u < RAMP.u0 - 0.6 || u > RAMP.u1 + 0.6) continue;
      const d = y === undefined ? u - RAMP.u0 : Math.abs(rampH(u) - (y - RC[1]));
      if (d < bestD - 1e-6) { bestD = d; best = u; }
    }
    return best === null ? 0 : best;
  }
  const arena = {
    name: 'tower',
    ground(x, z, y) { return RC[1] + rampH(pickU(Math.atan2(x - RC[0], z - RC[2]), y)); },
    // the walls: the core on the inside, the parapet on the outside, the closed gate behind and the doors in front
    walls(v) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const th = Math.atan2(v.x - RC[0], v.z - RC[2]);
      v.rampU = v.rampU === undefined ? pickU(th, v.y) : th + TAU * Math.round((v.rampU - th) / TAU);
      let impact = 0, lever = 0;
      for (const off of v.circles) {
        const cx = v.x + fx * off, cz = v.z + fz * off, R = v.radius;
        const dx = cx - RC[0], dz = cz - RC[2], r = Math.hypot(dx, dz) || 0.001, nx = dx / r, nz = dz / r;
        let push = 0;
        if (r < RAMP.ri + 0.35 + R) push = RAMP.ri + 0.35 + R - r;
        else if (r > RAMP.ro - R) push = RAMP.ro - R - r;
        if (!push) continue;
        v.x += nx * push; v.z += nz * push;
        const wx = push > 0 ? nx : -nx, wz = push > 0 ? nz : -nz;      // from the wall into the road
        const vn = v.vx * wx + v.vz * wz;
        if (vn < 0) { v.vx -= 1.22 * vn * wx; v.vz -= 1.22 * vn * wz; impact = Math.max(impact, -vn); lever += off * (wx * fz - wz * fx) * 0.5; }
      }
      // the two ends of the road
      const r = Math.hypot(v.x - RC[0], v.z - RC[2]);
      const lo = RAMP.u0 + 2.6 / r, hi = RAMP.u1 - 2.6 / r;
      if (v.rampU < lo || v.rampU > hi) {
        const u = clamp(v.rampU, lo, hi), tx = Math.cos(u), tz = -Math.sin(u);
        v.x = RC[0] + Math.sin(u) * r; v.z = RC[2] + Math.cos(u) * r; v.rampU = u;
        const along = v.vx * tx + v.vz * tz, into = v.rampU <= lo + 1e-6 ? -along : along;
        if (into > 0) { const k = (v.rampU <= lo + 1e-6 ? 1 : -1); v.vx += k * 1.2 * into * tx; v.vz += k * 1.2 * into * tz; impact = Math.max(impact, into); }
      }
      return impact > 0.05 ? { impact, lever } : null;
    },
  };

  // ---------------------------------------------------------------- showing a zone
  // (the set's solid things go into the city's grid while it is shown: the Guard's eyes and the walkers use them)
  function solid(z) {
    if (solids && colliders) { for (const q of solids) colliders.removeBox(q); }
    solids = null;
    if (!z || !colliders) return;
    solids = z.solids.map(([x0, z0, x1, z1, h]) => ({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, h }));
    for (const q of solids) colliders.addBox(q);
  }
  // the room the player walks in (src/player/player.js): its floor, edges and the boxes in it
  function walkRoom(z) {
    if (!z.walk) return null;
    return { floor: centerOf(shown)[1], ...z.walk, boxes: (solids || []).filter((q) => q.h > 0.3) };
  }
  function setRoomShade(z) {
    const r = z.room || { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6, floor: 0, top: 40 };
    roomShade.uRoomA.value.set(r.minX, r.minZ, r.maxX, r.maxZ);
    const far = new THREE.Vector4(-1e6, -1e6, -1e6 + 1, -1e6 + 1);
    roomShade.uRoomB.value.copy(far); roomShade.uRoomC.value.copy(far);
    const h = (r.top || 4) - (r.floor || 0) + 0.3;
    roomShade.uRoomH.value.set(h, h, h);
    roomShade.uRoomY.value = r.floor || 0;
  }
  let rainMesh = null;
  function show(name) {
    if (name && !BUILD[name]) name = null;
    if (name === shown) return;
    // the zone shown until now goes away (it stays built, hidden: going back to it is quick)
    if (shown && zones[shown]) zones[shown].group.visible = false;
    solid(null);
    if (player) player.setRoom(null);
    if (!rainMesh) rainMesh = scene.getObjectByName('rain');
    if (rainMesh) rainMesh.layers.disable(INTERIOR_LAYER);
    if (!name) {
      shown = null; root.visible = false;
      if (saved) camera.layers.mask = saved.mask; else camera.layers.set(0);
      saved = null;
      if (lighting) lighting.interior = null;
      return;
    }
    if (!zones[name]) { zones[name] = BUILD[name](); zones[name].group.traverse((m) => m.layers.set(INTERIOR_LAYER)); }
    const z = zones[name];
    if (!shown) { saved = { mask: camera.layers.mask }; camera.layers.set(INTERIOR_LAYER); }
    shown = name; root.visible = true; z.group.visible = true; layerT = 0;
    if (lighting) lighting.interior = { ...z.light };
    setRoomShade(z);
    solid(z);
    if (player && z.walk) player.setRoom(walkRoom(z));
    // (the rain of the sky falls on the open terrace)
    if (z.outdoor && rainMesh) rainMesh.layers.enable(INTERIOR_LAYER);
  }
  // what the camera must see besides the set: the player, the story's people, cars and things
  function layerAll(list) { for (const o of list) if (o) o.traverse((m) => { if ((m.isMesh || m.isSkinnedMesh || m.isPoints || m.isLight || m.isSprite || m.isLine) && !m.layers.isEnabled(INTERIOR_LAYER)) m.layers.enable(INTERIOR_LAYER); }); }
  // the doors that move: the lobby's staff gate (two glass wings slide sideways), the atrium doors (two leaves, or
  // one that rises), and their solid boxes go when they open
  function moveDoors(z, dt) {
    for (const d of Object.values(z.doors || {})) {
      if (d.open === d.want) continue;
      d.open = d.want > d.open ? Math.min(d.want, d.open + dt * 0.8) : Math.max(d.want, d.open - dt * 0.8);
      const k = d.open * d.open * (3 - 2 * d.open);
      for (const p of d.parts) {
        if (d.lift) p.position.y = p.userData.y0 + k * 3.1;
        else p.position.x = p.userData.x0 + p.userData.s * k * d.width;
      }
      if (d.lamp) d.lamp.material.color.setHex(d.open > 0.05 ? 0x3cff8a : 0xff3a2a);
    }
  }
  function door(name, open) {
    for (const zn of Object.keys(zones)) {
      const d = zones[zn].doors && zones[zn].doors[name];
      if (!d) continue;
      d.want = open ? 1 : 0;
      // (its solid box: gone while it is open, back when it closes)
      if (d.solid) {
        const z = zones[zn], has = z.solids.includes(d.solid);
        if (open && has) z.solids = z.solids.filter((q) => q !== d.solid);
        if (!open && !has) z.solids = z.solids.concat([d.solid]);
        if (shown === zn) { solid(z); if (player && z.walk) player.setRoom(walkRoom(z)); }
      }
    }
  }
  function update(dt, cast = []) {
    if (!shown) return;
    time += dt;
    const z = zones[shown];
    if (z.update) z.update(dt, time);
    moveDoors(z, dt);
    layerT -= dt;
    if (layerT <= 0) { layerT = 0.25; layerAll(typeof cast === 'function' ? cast() : cast); }
  }

  return {
    show, update, at, door, arena,
    get zone() { return shown; },
    get room() { return shown ? zones[shown].room : null; },
    // where a car starts on the ramp: just past the closed gate, in the middle of the road, facing up it
    get rampStart() { const u = 0.15; return { x: RC[0] + Math.sin(u) * RAMP.mid, y: RC[1], z: RC[2] + Math.cos(u) * RAMP.mid, heading: u + Math.PI / 2 }; },
    // how far up a car is: 0 at the start .. 1 at the doors at the top
    rampK(v) { return v && v.rampU !== undefined ? clamp(v.rampU / (RAMP.u1 - 0.4), 0, 1) : 0; },
    follow(v) { if (zones.ramp && shown === 'ramp') zones.ramp.follow(v); },
    ride(speed) { if (zones.shaft) zones.shaft.ride(speed); },
    view(kind) { if (zones.shaft) zones.shaft.view(kind); },
    floor(n) { if (zones.shaft) zones.shaft.floor(n); },
    alarm(on) { if (zones.server) zones.server.alarm(on); },
    mirror(on) { if (zones.glass) zones.glass.mirror.visible = !!on; },
    // (for tests: build a zone without showing it)
    build(name) { if (!zones[name] && BUILD[name]) { zones[name] = BUILD[name](); zones[name].group.visible = false; zones[name].group.traverse((m) => m.layers.set(INTERIOR_LAYER)); } return !!zones[name]; },
    ZONES,
  };
}
