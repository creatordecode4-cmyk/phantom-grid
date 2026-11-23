// ---------------------------------------------------------------------------
// ship.js - a cargo ship at the quay, built from smooth curves (no boxes).
//
//   THE HULL is one curved surface, made like a real ship's lines plan: cross sections along the ship, each
//   one round at the bottom (the bilge), full in the middle of the ship, a sharp V at the bow. The bow leans
//   forward (a raked stem) and flares out above the water; under the water a bulbous bow sticks out in
//   front. The stern is rounded in plan and ends in a transom; the bottom rises there for the propeller.
//   The deck rises toward the bow (the sheer). Paint: antifouling red under the water, a black boot top at
//   the water line, the hull color above, the name in white on both sides of the bow and on the stern.
//   ON DECK: the accommodation house at the stern in tiers with rounded corners and window bands, the
//   bridge with its wings out over both sides, a mast with radar, a raked funnel with a colored band and a
//   black top, an orange free-fall lifeboat on its ramp over the stern, hatch covers, railings, bollards,
//   two anchors in their pockets at the bow, a light mast on the forecastle.
//   The containers on deck are the docks' own containers (the same detailed ones as in the yards).
//
// Ship frame: x along the ship (stern at -len/2, bow at +len/2), y up (0 = the water line), z across.
// buildCargoShip(S, o) -> { mesh, names (a mesh with the painted names) }
//   S: { len, beam, hull: [r, g, b], name, band: [r, g, b] }
//   o: { material (vertex colors: aData = roughness, metal), addContainer(x, y, z, rot) (ship frame), rng }
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MeshBuilder } from '../utils/geometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _c = new THREE.Color();
const lin = (c) => { _c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [_c.r, _c.g, _c.b]; };

export function buildCargoShip(S, o) {
  const mb = new MeshBuilder();
  const len = S.len, hl = len / 2, hb = S.beam / 2;
  const KEEL = -7.4, DECK = 7.0;
  // (colors written here are screen colors; S.hull and S.band come from layout.js and are already linear)
  const set = (c, rough = 0.6, metal = 0.2, glow = 0) => { const l = c.linear ? c : lin(c); mb.color(l[0], l[1], l[2], 1).data(rough, metal, 0, glow); };
  const linear = (c) => Object.assign([c[0], c[1], c[2]], { linear: true });

  // ---------------------------------------------------------------- the lines of the hull
  // u: 0 = stern .. 1 = bow. Half breadth at the water line and at the deck (as parts of the full half breadth)
  const aWL = (u) => (u < 0.14 ? 0.7 + 0.3 * smooth(0, 0.14, u) : u > 0.58 ? Math.pow(Math.max(0, 1 - Math.pow((u - 0.58) / 0.42, 2)), 0.62) : 1);
  const aDk = (u) => (u < 0.1 ? 0.86 + 0.14 * smooth(0, 0.1, u) : u > 0.66 ? Math.pow(Math.max(0, 1 - Math.pow((u - 0.66) / 0.34, 2.4)), 0.5) : 1);
  // how full a cross section is under the water: 8 = nearly square with a round bilge, 2.4 = a V
  const nSec = (u) => (u > 0.6 ? 8 - 5.6 * smooth(0.6, 1, u) : u < 0.16 ? 8 - 4 * smooth(0.16, 0, u) : 8);
  const keelAt = (u) => KEEL + 4.2 * smooth(0.09, 0, u);                                  // the bottom rises at the stern
  const deckAt = (u) => DECK + 1.7 * smooth(0.8, 1, u) + 0.5 * smooth(0.06, 0, u);         // the sheer
  // the raked stem: in the bow the stations lean forward with height
  const xAt = (u, y) => {
    const x = -hl + u * len;
    if (u <= 0.6) return x;
    const t = (u - 0.6) / 0.4, h01 = (y - KEEL) / (DECK + 1.7 - KEEL);
    return x + t * 7 * (h01 - 0.55);
  };
  const zAt = (u, y) => {
    const a = hb * aWL(u), ad = hb * aDk(u);
    if (y <= 0) {
      const t = Math.min(1, -y / -keelAt(u)), n = nSec(u);
      return a * Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);
    }
    return a + (ad - a) * Math.min(1, y / deckAt(u));                                     // (the flare: wider toward the deck at the bow)
  };
  const NS = 60;
  const us = [];
  for (let i = 0; i <= NS; i++) us.push(i / NS);
  // the rows of a band: heights from y0(u) to y1(u), t-values (0 = y0, 1 = y1)
  function band(y0, y1, ts, color, rough, metal) {
    for (const s of [1, -1]) {
      const pos = [], idx = [];
      for (let i = 0; i <= NS; i++) {
        const u = us[i];
        for (const t of ts) {
          const y = y0(u) + (y1(u) - y0(u)) * t;
          pos.push(xAt(u, y), y, s * zAt(u, y));
        }
      }
      const R = ts.length;
      for (let i = 0; i < NS; i++) for (let j = 0; j < R - 1; j++) {
        const a = i * R + j, b = (i + 1) * R + j;
        if (s > 0) idx.push(a, b, b + 1, a, b + 1, a + 1); else idx.push(a, b + 1, b, a, a + 1, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      set(color, rough, metal);
      mb.addGeometry(g, null);
    }
  }
  const ANTI = [0.46, 0.09, 0.07], BOOT = [0.035, 0.035, 0.04], HULL = linear(S.hull);
  // under the water (dense rows near the keel: the round bilge), the boot top, the topsides
  band(keelAt, () => -0.3, [0, 0.004, 0.015, 0.035, 0.07, 0.12, 0.2, 0.32, 0.48, 0.66, 0.84, 1], ANTI, 0.7, 0.1);
  band(() => -0.3, () => 0.45, [0, 1], BOOT, 0.6, 0.2);
  band(() => 0.45, deckAt, [0, 0.2, 0.4, 0.6, 0.8, 0.93, 1], HULL, 0.55, 0.3);
  // the deck plate
  set([0.24, 0.27, 0.25], 0.8, 0.1);
  for (let i = 0; i < NS; i++) {
    const u0 = us[i], u1 = us[i + 1], y0 = deckAt(u0), y1 = deckAt(u1);
    const p = (u, y, s) => [xAt(u, y), y, s * zAt(u, y)];
    mb.quadAuto(p(u0, y0, -1), p(u1, y1, -1), p(u1, y1, 1), p(u0, y0, 1), [0, 1, 0]);
  }
  // the transom at the stern
  set(HULL, 0.55, 0.3);
  {
    const rows = [];
    for (let k = 0; k <= 8; k++) { const y = keelAt(0) + (deckAt(0) - keelAt(0)) * (k / 8); rows.push([y, zAt(0, y)]); }
    for (let k = 0; k < rows.length - 1; k++) {
      const [ya, za] = rows[k], [yb, zb] = rows[k + 1];
      mb.quadAuto([-hl, ya, za], [-hl, ya, -za], [-hl, yb, -zb], [-hl, yb, zb], [-1, 0, 0]);
    }
  }
  // the bulbous bow under the water
  set(ANTI, 0.7, 0.1);
  mb.addGeometry(new THREE.SphereGeometry(1, 20, 12).scale(4.6, 2.4, 1.9).translate(hl - 2.4, KEEL + 3.1, 0), null);

  // ---------------------------------------------------------------- small helpers for the fittings
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const unitRod = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  // a round bar from a to b
  const rod = (a, b, r) => {
    _d.subVectors(b, a); const l = _d.length(); if (l < 1e-4) return;
    _q.setFromUnitVectors(Y, _d.divideScalar(l));
    _m.compose(V((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), _q, _s.set(r, l, r));
    mb.addGeometry(unitRod, _m);
  };
  // a block with rounded corners (in plan), from y0 up to y1: smooth on the round corners, sharp at the top edge
  const roundBlock = (x0, x1, z0, z1, y0, y1, r) => {
    r = Math.min(r, (x1 - x0) / 2 - 0.01, (z1 - z0) / 2 - 0.01);
    const sh = new THREE.Shape();
    // (the shape is drawn in x / -z: turned up it lands the right way round)
    const Z0 = -z1, Z1 = -z0;
    sh.moveTo(x0 + r, Z0); sh.lineTo(x1 - r, Z0); sh.absarc(x1 - r, Z0 + r, r, -Math.PI / 2, 0);
    sh.lineTo(x1, Z1 - r); sh.absarc(x1 - r, Z1 - r, r, 0, Math.PI / 2);
    sh.lineTo(x0 + r, Z1); sh.absarc(x0 + r, Z1 - r, r, Math.PI / 2, Math.PI);
    sh.lineTo(x0, Z0 + r); sh.absarc(x0 + r, Z0 + r, r, Math.PI, Math.PI * 1.5);
    let g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    g = toCreasedNormals(g, 0.6);
    mb.addGeometry(g, null);
  };
  const deckY = (x) => deckAt(Math.min(1, Math.max(0, (x + hl) / len)));

  // ---------------------------------------------------------------- the accommodation house at the stern
  const hx0 = -hl + 6, hx1 = -hl + 21, base = deckY(hx0);
  const WHITE = [0.86, 0.87, 0.85], GLASS = [0.16, 0.2, 0.24];
  const tiers = 5, th = 2.85;
  for (let k = 0; k < tiers; k++) {
    const y0 = base + k * th, inX = k * 0.25, inZ = 1.6 + k * 0.15;
    set(WHITE, 0.62, 0.1);
    roundBlock(hx0 + inX, hx1 - inX, -hb + inZ, hb - inZ, y0, y0 + th, 1.6);
    // the window band of this deck (a little proud of the wall, dark glass)
    set(GLASS, 0.1, 0.35);
    roundBlock(hx0 + inX - 0.03, hx1 - inX + 0.03, -hb + inZ - 0.03, hb - inZ + 0.03, y0 + 1.1, y0 + 1.85, 1.6);
    // a thin ledge at the floor of each deck (a walkway edge)
    set([0.62, 0.63, 0.62], 0.6, 0.2);
    roundBlock(hx0 + inX - 0.12, hx1 - inX + 0.12, -hb + inZ - 0.12, hb - inZ + 0.12, y0, y0 + 0.16, 1.7);
  }
  // the bridge on top: across the whole ship (its wings stand out over both sides), windows all round
  const by0 = base + tiers * th, bx0 = hx1 - 8.5, bx1 = hx1 - 0.4;
  set(WHITE, 0.6, 0.1);
  roundBlock(bx0, bx1, -hb - 0.9, hb + 0.9, by0, by0 + 3.0, 1.1);
  set(GLASS, 0.1, 0.6);
  roundBlock(bx0 - 0.03, bx1 + 0.03, -hb - 0.93, hb + 0.93, by0 + 1.15, by0 + 2.45, 1.1);
  set([0.7, 0.71, 0.7], 0.6, 0.2);
  roundBlock(bx0 - 0.25, bx1 + 0.35, -hb - 1.1, hb + 1.1, by0 + 3.0, by0 + 3.22, 1.2);      // the roof, a little wider (a sun shade)
  // the mast on the bridge roof: radar, lights
  set([0.9, 0.9, 0.88], 0.5, 0.3);
  const mastX = (bx0 + bx1) / 2 - 1.5, mastY = by0 + 3.22;
  rod(V(mastX, mastY, 0), V(mastX - 0.6, mastY + 7.5, 0), 0.16);
  rod(V(mastX - 0.35, mastY + 4.5, -2.6), V(mastX - 0.35, mastY + 4.5, 2.6), 0.07);           // the yard (cross bar)
  roundBlock(mastX + 0.6, mastX + 1.3, -2.4, 2.4, mastY + 0.9, mastY + 1.15, 0.12);              // radar scanners: slim white bars
  roundBlock(mastX - 0.3, mastX + 0.4, -1.9, 1.9, mastY + 3.1, mastY + 3.32, 0.12);
  rod(V(mastX + 0.95, mastY, 0), V(mastX + 0.95, mastY + 0.9, 0), 0.12);
  set([1, 0.96, 0.85], 0.4, 0, 1.3);
  mb.addGeometry(new THREE.SphereGeometry(0.18, 8, 6).translate(mastX - 0.6, mastY + 7.6, 0), null);
  // the funnel behind the bridge: an oval, raked back, its own color band and a black top
  {
    const fx = hx0 + 3.6, fy0 = base + (tiers - 1) * th + th, fh = 8.4;
    const sh = new THREE.Shape();
    sh.absellipse(0, 0, 2.6, 1.9, 0, Math.PI * 2, false, 0);
    const parts = [[0, 0.62, linear([S.hull[0] * 1.5 + 0.02, S.hull[1] * 1.5 + 0.02, S.hull[2] * 1.5 + 0.02])], [0.62, 0.72, [0.92, 0.92, 0.9]], [0.72, 0.86, S.band ? linear(S.band) : [0.1, 0.45, 0.62]], [0.86, 1, [0.04, 0.04, 0.04]]];
    for (const [a, b, c] of parts) {
      let g = new THREE.ExtrudeGeometry(sh, { depth: (b - a) * fh, bevelEnabled: false, curveSegments: 14 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, a * fh, 0);
      // (raked: the higher, the further back)
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) - p.getY(i) * 0.16);
      g.translate(fx, fy0, 0);
      g = toCreasedNormals(g, 0.6);
      set(c, 0.55, 0.25);
      mb.addGeometry(g, null);
    }
  }
  // the free-fall lifeboat on its ramp over the stern, nose down toward the water
  {
    const lx = -hl + 3.4, ly = base + 2 * th + 0.4;
    set([0.62, 0.64, 0.66], 0.5, 0.6);
    for (const z of [-1.1, 1.1]) rod(V(hx0 + 0.5, ly + 0.6, z), V(-hl + 0.2, ly - 2.9, z), 0.12);
    const boat = new THREE.CapsuleGeometry(1.15, 5.0, 5, 12);
    boat.rotateZ(Math.PI / 2); boat.scale(1, 1.18, 1);
    boat.rotateZ(0.55); boat.translate(lx, ly, 0);
    set([0.98, 0.42, 0.06], 0.45, 0.05);
    mb.addGeometry(boat, null);
    const cab = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.7, 0.85);
    cab.rotateZ(0.55); cab.translate(lx + 0.5, ly + 1.05, 0);
    mb.addGeometry(cab, null);
  }
  // ---------------------------------------------------------------- the deck: hatch covers, containers, railings
  const bayX0 = hx1 + 2.2, bayX1 = hl - 13, CW = o.CW, CH = o.CH, L40 = o.L40;
  const rows = Math.floor((S.beam - 2.2) / (CW + 0.06));
  for (let x = bayX0; x + L40 < bayX1; x += L40 + 1.5) {
    const yb = deckY(x + L40 / 2);
    set([0.2, 0.3, 0.28], 0.75, 0.3);
    roundBlock(x - 0.35, x + L40 + 0.35, -hb + 1.0, hb - 1.0, yb, yb + 0.75, 0.35);               // the hatch cover
    for (let r = 0; r < rows; r++) {
      const zc = -((rows - 1) * (CW + 0.06)) / 2 + r * (CW + 0.06);
      const n = o.rng.int(1, 4);
      for (let k = 0; k < n; k++) o.addContainer(x + L40 / 2, yb + 0.75 + k * CH, zc, o.rng.chance(0.5) ? 0 : Math.PI);
    }
  }
  // railings along both sides of the deck (posts and two rails), and on the forecastle
  set([0.78, 0.79, 0.77], 0.45, 0.6);
  for (const s of [1, -1]) {
    let prev = null;
    for (let x = -hl + 1.2; x <= hl - 2.2; x += 2.4) {
      const u = (x + hl) / len, y = deckAt(u), z = s * (zAt(u, y) - 0.18);
      if (Math.abs(z) < 0.5) continue;
      const p = V(xAt(u, y), y, z);
      rod(p, V(p.x, y + 1.05, p.z), 0.028);
      if (prev) { rod(V(prev.x, prev.y + 1.05, prev.z), V(p.x, y + 1.05, p.z), 0.03); rod(V(prev.x, prev.y + 0.55, prev.z), V(p.x, y + 0.55, p.z), 0.022); }
      prev = p;
    }
  }
  // bollards along the deck edge, the light mast and two anchors at the bow
  set([0.12, 0.12, 0.13], 0.5, 0.6);
  for (const x of [-hl + 3, -hl + 28, -8, 20, hl - 18]) for (const s of [1, -1]) {
    const u = (x + hl) / len, y = deckAt(u), z = s * (zAt(u, y) - 0.9);
    for (const dx of [-0.35, 0.35]) mb.addGeometry(new THREE.CylinderGeometry(0.17, 0.2, 0.55, 10).translate(x + dx, y + 0.27, z), null);
  }
  {
    const fx = hl - 6, fy = deckY(fx);
    set([0.86, 0.86, 0.84], 0.5, 0.3);
    rod(V(fx, fy, 0), V(fx, fy + 8.5, 0), 0.13);
    set([1, 0.96, 0.85], 0.4, 0, 1.3);
    mb.addGeometry(new THREE.SphereGeometry(0.2, 8, 6).translate(fx, fy + 8.7, 0), null);
    // the anchors: a dark pocket in the hull and the anchor in it
    for (const s of [1, -1]) {
      const x = hl - 7.5, u = (x + hl) / len, y = deckAt(u) - 2.4, z = s * zAt(u, y);
      set([0.02, 0.02, 0.02], 0.9, 0.1);
      mb.addGeometry(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.0, 0.75, 0.2).rotateX(s * Math.PI / 2).translate(x, y, z), null);
      set([0.1, 0.1, 0.1], 0.6, 0.7);
      rod(V(x, y + 0.5, z + s * 0.2), V(x, y - 1.3, z + s * 0.25), 0.12);
      rod(V(x - 0.8, y - 1.15, z + s * 0.25), V(x + 0.8, y - 1.15, z + s * 0.25), 0.14);
    }
  }
  const mesh = new THREE.Mesh(mb.build(true), o.material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'ship';

  // ---------------------------------------------------------------- the names (white letters, a picture)
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g2 = cv.getContext('2d');
  g2.clearRect(0, 0, 1024, 256);
  g2.fillStyle = '#f2f2ee'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.font = '700 120px "Helvetica Neue", Arial, sans-serif';
  g2.fillText(S.name, 512, 96);
  g2.font = '700 54px "Helvetica Neue", Arial, sans-serif';
  g2.fillText('RUSTWATER', 512, 206);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const nameMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const ng = [];
  // on both sides near the bow (the plane follows the hull's angle there), and across the transom
  for (const s of [1, -1]) {
    const x = hl - 23, u = (x + hl) / len, y = 4.2;
    const za = zAt(u, y), zb = zAt(Math.min(1, u + 0.02), y), ang = Math.atan2(zb - za, 0.02 * len);
    const p = new THREE.PlaneGeometry(10, 2.5);
    if (s < 0) p.rotateY(Math.PI);
    p.rotateY(-s * ang);
    p.translate(xAt(u, y), y, s * (za + 0.06));
    ng.push(p);
  }
  {
    const p = new THREE.PlaneGeometry(9, 2.25); p.rotateY(-Math.PI / 2); p.translate(-hl - 0.05, deckAt(0) - 2.2, 0);
    ng.push(p);
  }
  const names = new THREE.Mesh(mergeSimple(ng), nameMat);
  names.renderOrder = 3;
  return { mesh, names };
}

// (plain geometries with position, normal, uv -> one)
function mergeSimple(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(t.getX(i), t.getY(i)); }
    const ix = g.index;
    for (let i = 0; i < ix.count; i++) idx.push(off + ix.getX(i));
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
