// ---------------------------------------------------------------------------
// backdrop.js - the big things around the play area:
//   * the ocean
//   * dry brown hills on the north and east horizon
//   * THE CROWN: downtown towers with the Kessler-Vance (KVI) headquarters
//   * IRONHILL HIGHWAY: raised freeway on pillars along the east edge
//   * the raised light-rail line with its train
//   * rows of scenery buildings that close the view at the edges
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RNG } from '../utils/math.js';
import { makeFbm } from '../utils/noise.js';
import { MeshBuilder } from '../utils/geometry.js';
import { simpleBuilding } from './buildings.js';
import { makeTrain } from './models.js';
import { HOLO_COUNT } from './textures.js';

const T = CONFIG.textures;
const CONCRETE = [0.74, 0.78, 0.86]; // turns the warm plaster picture into grey concrete

// ---------------------------------------------------------------------------
// OCEAN: one huge flat sheet. The waves are drawn by the shader.
// ---------------------------------------------------------------------------
function buildOcean(ctx) {
  const L = ctx.layout;
  const mb = new MeshBuilder();
  mb.groundRect(-9000, -9000, 9000, L.beach.minZ + 8, L.ocean.level, 1);
  const mesh = new THREE.Mesh(mb.build(false), ctx.mats.ocean);
  mesh.name = 'ocean';
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  ctx.group.add(mesh);
}

// ---------------------------------------------------------------------------
// HILLS: two long ridges (north and east) made from a bumpy grid.
// ---------------------------------------------------------------------------
function buildHills(ctx) {
  const L = ctx.layout;
  const noise = makeFbm(5, 4, 311);
  const noise2 = makeFbm(11, 3, 322);
  const pos = [], col = [], uv = [], idx = [];

  // One ridge. along: positions along the ridge, depth rows go away from the city.
  //   point(a, r) gives the ground position; shape(r) is the height profile.
  function ridge(count, rows, point, seedOff) {
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      for (let i = 0; i <= count; i++) {
        const [x, z] = point(i / count, r / rows);
        const t = r / rows;
        const profile = Math.max(0, Math.sin(Math.min(1, t * 1.25) * Math.PI)) ** 0.8; // rises, then falls behind
        const n = noise(i / count * 2.2 + seedOff, t * 0.9 + seedOff);
        const n2 = noise2(i / count * 3.1, t * 2.0 + seedOff);
        const n3 = noise2(i / count * 9.7 + 0.3, t * 5.0 + seedOff); // small gullies
        // lower at both ends of the ridge so it fades out
        const ends = Math.max(0, Math.sin((i / count) * Math.PI)) ** 0.35;
        const h = profile * (120 + 270 * n + 60 * n2 + 46 * (n3 - 0.5)) * (0.45 + 0.55 * ends);
        pos.push(x, t === 0 ? -4 : h - 2, z);
        // dry earth with darker patches of brush
        const brush = Math.max(0, n2 - 0.45) * 1.6 + Math.max(0, 0.5 - n3) * 0.7;
        const shade = 0.7 + 0.45 * n;
        col.push((0.5 - 0.2 * brush) * shade, (0.44 - 0.14 * brush) * shade, (0.36 - 0.12 * brush) * shade, 1);
        uv.push(x / 170, z / 170);
      }
    }
    const w = count + 1;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < count; i++) {
        const a = base + r * w + i, b = a + 1, c = a + w, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  // north ridge: runs east-west, far behind The Crown
  ridge(110, 9, (a, r) => [-3200 + a * 6600, L.hills.northZ + r * 1700], 0.1);
  // east ridge: runs north-south and reaches down into the sea
  ridge(96, 9, (a, r) => [L.hills.eastX - r * 1600, -1700 + a * 5200], 0.6);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 4));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the grid can face up or down depending on its direction: make all normals point up
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  const mat = ctx.mats.hills;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'hills';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  ctx.group.add(mesh);
}

// ---------------------------------------------------------------------------
// THE CROWN: glass towers 60 - 220 m, and the 260 m KVI headquarters.
// ---------------------------------------------------------------------------
function buildCrown(ctx) {
  const L = ctx.layout;
  const C = L.crown;
  const rng = new RNG(L.seed + 77);
  const mb = ctx.mb.tower;
  const tile = T.glassTower.size;
  const tints = [[0.8, 0.88, 0.96], [1, 1, 1], [0.84, 0.96, 0.92], [0.5, 0.54, 0.6], [1.0, 0.86, 0.7], [0.66, 0.72, 0.82], [0.38, 0.42, 0.48], [0.9, 0.92, 0.9]];
  const placed = [{ x: C.kvi.x, z: C.kvi.z, r: 40 }];

  const tower = (x, z, w, d, h, tint) => {
    mb.color(tint[0], tint[1], tint[2], 1);
    mb.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, tile, 'nsewt');
  };

  let tries = 0;
  while (placed.length < C.towers + 1 && tries++ < 4000) {
    const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * C.radius;
    const x = C.centerX + Math.cos(a) * rr * 1.25, z = C.centerZ + Math.sin(a) * rr;
    const w = rng.range(26, 52), d = rng.range(26, 52);
    if (z - d / 2 < L.city.maxZ + 62) continue; // keep clear of the scenery blocks
    const r = Math.max(w, d) * 0.75;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r)) continue;
    placed.push({ x, z, r });
    // towers are tallest in the middle of the district
    const mid = 1 - Math.min(1, rr / C.radius);
    const h = C.minHeight + (C.maxHeight - C.minHeight) * Math.min(1, mid * 0.75 + rng.next() * 0.45);
    const tint = rng.pick(tints);
    tower(x, z, w, d, h, tint);
    // a narrower top part on many towers
    if (rng.chance(0.6)) tower(x + rng.range(-3, 3), z + rng.range(-3, 3), w * 0.66, d * 0.66, h + rng.range(12, 40), tint);
  }

  // ---- Kessler-Vance headquarters: the tallest tower, in three steps ----
  const k = C.kvi;
  const kt = [0.62, 0.72, 0.86];
  tower(k.x, k.z, 50, 50, k.height * 0.74, kt);
  tower(k.x, k.z, 37, 37, k.height * 0.92, kt);
  tower(k.x, k.z, 24, 24, k.height, kt);
  // thin mast on top (dark metal)
  const ps = ctx.mb.propStatic;
  ps.color(0.05, 0.055, 0.06, 1).data(0.4, 0.8, 0, 0);
  ps.box(k.x - 0.8, k.height, k.z - 0.8, k.x + 0.8, k.height + 34, k.z + 0.8, 1, 'nsew');
  // red warning light on the mast
  ps.color(1, 0.08, 0.05, 1).data(0.4, 0, 0, 1.9);
  ps.box(k.x - 1.2, k.height + 34, k.z - 1.2, k.x + 1.2, k.height + 36, k.z + 1.2, 1, 'nsewt');

  // ---- giant KVI light banner on the tower sides that face the city ----
  // (panel 0 of the hologram picture is the KVI advert)
  const hm = ctx.mb.holo;
  const u0 = 0, u1 = 1 / HOLO_COUNT;
  const banner = (p0, p1, y0, y1, n) => {
    const v = (p, y, lu, lv, uu, vv) => { hm.color(lu, lv, 0, 1); return hm.vertex(p[0], y, p[1], n[0], 0, n[1], uu, vv); };
    hm.quadIdx(v(p0, y0, 0, 0, u0, 0), v(p1, y0, 1, 0, u1, 0), v(p1, y1, 1, 1, u1, 1), v(p0, y1, 0, 1, u0, 1));
  };
  const y0 = k.height * 0.74 - 74, y1 = k.height * 0.74 - 6;
  banner([k.x + 17, k.z - 25.4], [k.x - 17, k.z - 25.4], y0, y1, [0, -1]);   // south face
  banner([k.x - 25.4, k.z - 17], [k.x - 25.4, k.z + 17], y0, y1, [-1, 0]);   // east face
}

// ---------------------------------------------------------------------------
// IRONHILL HIGHWAY
// ---------------------------------------------------------------------------
function buildHighway(ctx) {
  const L = ctx.layout;
  const H = L.highway;
  const pm = ctx.mb.plaster;
  const tile = T.plaster.size;
  const con = (s = 1) => pm.color(CONCRETE[0] * s, CONCRETE[1] * s, CONCRETE[2] * s, 1).data(0, 0, 0, 0);
  const x0 = H.minX, x1 = H.maxX;
  const zTop = H.rampTopZ, zEnd = H.northEndZ, deck = H.height, thick = 1.4;

  // ---- flat part on pillars ----
  con(0.92);
  pm.box(x0, deck - thick, zTop, x1, deck, zEnd, tile, 'ewb');          // sides + underside
  ctx.mb.asphalt.color(0.95, 0.95, 0.95, 1);
  ctx.mb.asphalt.groundRect(x0 + 0.4, zTop, x1 - 0.4, zEnd, deck + 0.01, T.asphalt.size);
  con(1);
  for (const [a, b] of [[x0, x0 + 0.4], [x1 - 0.4, x1]]) pm.box(a, deck, zTop, b, deck + 0.95, zEnd, tile, 'ewt'); // crash walls
  for (let z = zTop + 14; z < zEnd; z += H.pillarSpacing) {
    con(0.9);
    pm.box(H.centerX - 1.3, 0, z - 1.1, H.centerX + 1.3, deck - thick - 1.3, z + 1.1, tile, 'nsew');   // pillar
    pm.box(H.centerX - 10.5, deck - thick - 1.3, z - 1.3, H.centerX + 10.5, deck - thick, z + 1.3, tile, 'nsewb'); // cross beam
    if (z < L.bounds.maxZ + 30) ctx.colliders.boxes.push({ minX: H.centerX - 1.3, maxX: H.centerX + 1.3, minZ: z - 1.1, maxZ: z + 1.1, h: 6 });
  }

  // ---- ramp down to Neon Mile: a solid wedge ----
  const zB = H.rampBottomZ;
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const za = zB + ((zTop - zB) * i) / steps, zb = zB + ((zTop - zB) * (i + 1)) / steps;
    const ya = H.heightAt(za), yb = H.heightAt(zb);
    // road surface (sloping)
    const am = ctx.mb.asphalt;
    am.color(0.95, 0.95, 0.95, 1);
    am.quad([x0 + 0.4, ya + 0.01, za], [x0 + 0.4, yb + 0.01, zb], [x1 - 0.4, yb + 0.01, zb], [x1 - 0.4, ya + 0.01, za], [0, 1, 0],
      [x0 / T.asphalt.size, za / T.asphalt.size], [x0 / T.asphalt.size, zb / T.asphalt.size], [x1 / T.asphalt.size, zb / T.asphalt.size], [x1 / T.asphalt.size, za / T.asphalt.size]);
    // side walls from the ground up to the top of the crash wall
    con(0.95);
    for (const [x, nx] of [[x0, -1], [x1, 1]]) {
      pm.quadAuto([x, 0, za], [x, 0, zb], [x, yb + 0.95, zb], [x, ya + 0.95, za], [nx, 0, 0], tile);
      // inner face and top of the crash wall
      const xi = x - nx * 0.4;
      pm.quadAuto([xi, ya, za], [xi, yb, zb], [xi, yb + 0.95, zb], [xi, ya + 0.95, za], [-nx, 0, 0], tile);
      pm.quadAuto([x, ya + 0.95, za], [x, yb + 0.95, zb], [xi, yb + 0.95, zb], [xi, ya + 0.95, za], [0, 1, 0], tile);
    }
    ctx.colliders.boxes.push({ minX: x0, maxX: x1, minZ: za, maxZ: zb, h: yb + 1 });
  }
  // the low end is open toward Neon Mile; close the south face of the walls
  con(0.9);
  pm.quadAuto([x0, 0, zB], [x0 + 0.4, 0, zB], [x0 + 0.4, 0.95, zB], [x0, 0.95, zB], [0, 0, -1], tile);
  pm.quadAuto([x1 - 0.4, 0, zB], [x1, 0, zB], [x1, 0.95, zB], [x1 - 0.4, 0.95, zB], [0, 0, -1], tile);

  // ---- wall along the east edge of the play area (under the highway) ----
  con(0.85);
  pm.box(L.bounds.minX - 1.5, 0, L.neon.roadMaxZ, L.bounds.minX - 1.1, 2.7, L.bounds.maxZ + 220, tile, 'nsewt');
}

// ---------------------------------------------------------------------------
// LIGHT RAIL: thin pillars, a narrow track deck, one raised station, a train
// ---------------------------------------------------------------------------
function buildRail(ctx) {
  const L = ctx.layout;
  const R = L.rail;
  const pm = ctx.mb.plaster;
  const tile = T.plaster.size;
  const con = (s = 1) => pm.color(CONCRETE[0] * s, CONCRETE[1] * s, CONCRETE[2] * s, 1).data(0, 0, 0, 0);
  const x = R.x, top = R.height;

  // track deck: a slim box girder
  con(1);
  pm.box(x - 2.7, top - 0.9, R.southEndZ, x + 2.7, top, R.northEndZ, tile, 'nsewtb');
  pm.box(x - 1.2, top - 1.7, R.southEndZ, x + 1.2, top - 0.9, R.northEndZ, tile, 'nsewb');
  for (const sx of [-2.7, 2.45]) pm.box(x + sx, top, R.southEndZ, x + sx + 0.25, top + 0.4, R.northEndZ, tile, 'ewt');
  // dark rails on the deck
  const ps = ctx.mb.propStatic;
  ps.color(0.05, 0.05, 0.055, 1).data(0.35, 0.9, 0, 0);
  for (const o of [-1.75, -0.95, 0.95, 1.75]) ps.box(x + o - 0.05, top, R.southEndZ, x + o + 0.05, top + 0.1, R.northEndZ, 1, 'ewt');

  // thin round pillars with a small head
  const pillar = new THREE.CylinderGeometry(0.5, 0.55, top - 1.7, 12);
  const uvA = pillar.attributes.uv;
  for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 0.95, (uvA.getY(i) * (top - 1.7)) / tile);
  for (let z = R.southEndZ + 6; z < R.northEndZ; z += R.pillarSpacing) {
    // do not put a pillar in the middle of a crossing
    let zz = z;
    for (const ew of L.streetsEW) if (Math.abs(zz - ew.center) < 9.5) zz = ew.center + (zz > ew.center ? 10 : -10);
    con(0.92);
    pm.add(pillar, x, (top - 1.7) / 2, zz);
    pm.box(x - 1.0, top - 2.1, zz - 0.9, x + 1.0, top - 1.7, zz + 0.9, tile, 'nsewb');
    // small raised island around the foot of the pillar
    con(1.05);
    pm.box(x - 0.9, 0, zz - 1.6, x + 0.9, 0.22, zz + 1.6, tile, 'nsewt');
    if (zz < L.bounds.maxZ + 10) ctx.colliders.circles.push({ x, z: zz, r: 0.75 });
  }

  // ---- station: wider platforms, a roof, and lift towers on both sidewalks ----
  const sz = R.stationZ, sl = 22;
  con(1.02);
  for (const s of [-1, 1]) {
    const a = x + s * 2.7, b = x + s * 5.4;
    pm.box(Math.min(a, b), top - 0.5, sz - sl, Math.max(a, b), top + 0.95, sz + sl, tile, 'nsewtb');
    // lift tower on the sidewalk, with a short bridge to the platform
    const tx = x + s * 8.5;
    ps.color(0.07, 0.09, 0.1, 1).data(0.08, 0.85, 0, 0);
    ps.box(tx - 0.8, 0.15, sz - 1.3, tx + 0.8, top + 3.4, sz + 1.3, 1, 'nsewt');
    ps.color(0.14, 0.15, 0.16, 1).data(0.4, 0.7, 0, 0);
    ps.box(tx - 0.9, top + 3.4, sz - 1.4, tx + 0.9, top + 3.6, sz + 1.4, 1, 'nsewtb');
    con(1);
    pm.box(Math.min(tx, b), top + 0.5, sz - 1.1, Math.max(tx, b), top + 0.95, sz + 1.1, tile, 'nsewtb');
    ctx.colliders.boxes.push({ minX: tx - 0.8, maxX: tx + 0.8, minZ: sz - 1.3, maxZ: sz + 1.3, h: 10 });
    // glowing strip above the lift door (always on)
    ps.color(0.3, 0.9, 0.8, 1).data(0.3, 0, 0, 1.5);
    ps.box(tx - 0.6, 2.5, sz - 1.34, tx + 0.6, 2.62, sz + 1.34, 1, 'ns');
    // roof over the platform
    ps.color(0.16, 0.17, 0.18, 1).data(0.4, 0.7, 0, 0);
    ps.box(Math.min(a, b) - 0.2, top + 4.2, sz - sl + 1, Math.max(a, b) + 0.2, top + 4.36, sz + sl - 1, 1, 'nsewtb');
    for (let z = sz - sl + 3; z < sz + sl; z += 8) ps.box(b - s * 0.3 - 0.07, top + 0.95, z - 0.07, b - s * 0.3 + 0.07, top + 4.2, z + 0.07, 1, 'nsew');
    // light under the roof (glows at night)
    ps.color(1, 0.9, 0.75, 1).data(0.3, 0, 0, 0.9);
    ps.box((a + b) / 2 - 0.1, top + 4.12, sz - sl + 3, (a + b) / 2 + 0.1, top + 4.19, sz + sl - 3, 1, 'ewb');
  }

  // ---- the train ----
  const train = new THREE.Mesh(makeTrain(), ctx.mats.prop);
  train.name = 'train';
  train.castShadow = true;
  train.receiveShadow = true;
  train.position.set(x, top + 0.1, sz);
  ctx.group.add(train);
  // It drives between the south end and far north, and waits at the station.
  const stops = [R.southEndZ + 17, sz, R.northEndZ - 30, sz];
  let target = 1, wait = 4, speed = 0;
  function update(dt) {
    if (wait > 0) { wait -= dt; return; }
    const goal = stops[target];
    const dist = goal - train.position.z;
    const dir = Math.sign(dist);
    const maxSpeed = 15;
    // slow down early enough to stop at the goal (braking distance = v^2 / 2a)
    const brake = Math.sqrt(2 * 1.0 * Math.abs(dist));
    speed = Math.min(maxSpeed, brake, speed + 1.1 * dt);
    train.position.z += dir * speed * dt;
    if (Math.abs(dist) < 0.3) {
      speed = 0;
      wait = 7;
      target = (target + 1) % stops.length;
    }
  }
  return { update, train };
}

// ---------------------------------------------------------------------------
// SCENERY BUILDINGS that close the view at the edges of the city
// ---------------------------------------------------------------------------
function buildEdgeRows(ctx) {
  const L = ctx.layout;
  const rng = new RNG(L.seed + 991);
  const city = L.city;
  // west: a wall of buildings at the end of the east-west streets
  for (let z = L.neon.roadMaxZ + 36; z < city.maxZ + 60; ) {
    const len = rng.range(28, 62);
    simpleBuilding(ctx, { minX: city.maxX + 14, maxX: city.maxX + 14 + rng.range(26, 40), minZ: z, maxZ: z + len }, rng.int(4, 9), rng);
    z += len + rng.range(0, 3);
  }
  // north: a wall of buildings at the end of the north-south streets
  for (let x = city.minX; x < city.maxX + 50; ) {
    const len = rng.range(28, 62);
    simpleBuilding(ctx, { minX: x, maxX: x + len, minZ: city.maxZ + 14, maxZ: city.maxZ + 14 + rng.range(26, 40) }, rng.int(4, 9), rng);
    x += len + rng.range(0, 3);
  }
  // east of the highway: low warehouses with few windows
  for (let z = L.neon.roadMaxZ + 10; z < city.maxZ; ) {
    const len = rng.range(40, 90);
    simpleBuilding(ctx, { minX: L.highway.minX - 70 - rng.range(0, 20), maxX: L.highway.minX - 14, minZ: z, maxZ: z + len }, rng.int(2, 3), rng,
      { brick: rng.chance(0.3), tint: rng.pick([[0.7, 0.72, 0.76], [0.82, 0.8, 0.76], [0.6, 0.62, 0.6], [1, 1, 1]]), windows: rng.chance(0.4) });
    z += len + rng.range(4, 14);
  }
  // far west along Neon Mile: the strip goes on into the haze
  for (let x = city.maxX + 14; x < city.maxX + 520; ) {
    const len = rng.range(12, 30);
    simpleBuilding(ctx, { minX: x, maxX: x + len, minZ: L.neon.roadMaxZ + 5, maxZ: L.neon.roadMaxZ + 5 + rng.range(16, 26) }, rng.int(2, 4), rng,
      { brick: false, tint: rng.pick([[1.08, 1.1, 1.14], [1.1, 0.94, 0.94], [0.84, 1.0, 0.98], [1.08, 1.02, 0.86]]) });
    x += len + rng.range(0, 4);
  }
}

// ---------------------------------------------------------------------------
export function buildBackdrop(ctx) {
  buildOcean(ctx);
  buildHills(ctx);
  buildCrown(ctx);
  buildHighway(ctx);
  buildEdgeRows(ctx);
  const rail = buildRail(ctx);
  return { rail };
}
