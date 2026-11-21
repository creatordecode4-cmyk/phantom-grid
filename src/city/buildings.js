// ---------------------------------------------------------------------------
// buildings.js - decides WHERE buildings go and WHAT stands on each lot.
//
//   1. hero sites: the hand-made hero buildings (heroBuildings.js) get fixed
//      lots, listed in layout.js under "heroSites"
//   2. plan: the rest of every block's street front is cut into lots
//   3. build: every lot gets a building type from buildingTypes.js
//   4. sky bridges link some tall neighbours
//
// District rules (see pickType in buildingTypes.js):
//   THE CROWN  tall towers 60 to 260 m      NEON MILE  mid-rise 15 to 50 m
//   THE GRID   mid-rise 6 to 12 floors, about 15% old brick retrofits
//
// MODEL FILES: if assets/buildings/ holds a .glb file named like a reference
// (b01_twist_tower.glb ...), it is used instead of the hero made from code,
// at the same place, scaled to its real height, with a collision box.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RNG, insetConvex, pointInConvex, polygonArea } from '../utils/math.js';
import { blockEdges, addDecal } from './ground.js';
import { createKit, sideFrame, FLOOR } from './buildingKit.js';
import { TYPES, pickType } from './buildingTypes.js';
import { HEROES, buildHero } from './heroBuildings.js';

const ROT = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 };
const MIN_LOT = 16; // no building type is narrower than this

// Which side of a lot looks out of the block across this edge?
function sideOfEdge(e) {
  return e.inZ > 0.9 ? 'S' : e.inZ < -0.9 ? 'N' : e.inX > 0.9 ? 'E' : 'W';
}
const overlap = (a, b, m = 0.02) => a.maxX > b.minX + m && a.minX < b.maxX - m && a.maxZ > b.minZ + m && a.minZ < b.maxZ - m;

// The part of a block where buildings may stand (the block without its sidewalks).
function innerOf(block) {
  const poly = insetConvex(block.poly, block.poly.map((p) => p.edge.sidewalk));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  return { poly, minX, maxX, minZ, maxZ };
}

// Lot of a hero site: h = { at, front }, w = width along the street, d = depth.
//   at: 'sw' 'se' 'nw' 'ne' = a corner of the block, 's' 'n' 'e' 'w' = middle of that side, 'c' = middle
function siteRect(inner, h, w, d) {
  const wide = h.front === 'N' || h.front === 'S';
  const sx = wide ? w : d, sz = wide ? d : w;
  const cx = (inner.minX + inner.maxX) / 2, cz = (inner.minZ + inner.maxZ) / 2;
  const minX = h.at.includes('e') ? inner.minX : h.at.includes('w') ? inner.maxX - sx : cx - sx / 2;
  const minZ = h.at.includes('s') ? inner.minZ : h.at.includes('n') ? inner.maxZ - sz : cz - sz / 2;
  // "shift": meters to move the lot along the street it faces (+ = north or west)
  const sh = h.shift || 0;
  return wide ? { minX: minX + sh, maxX: minX + sh + sx, minZ, maxZ: minZ + sz } : { minX, maxX: minX + sx, minZ: minZ + sh, maxZ: minZ + sh + sz };
}

// ---------------------------------------------------------------------------
// Cut the free street front of one block into lots.
// ---------------------------------------------------------------------------
function planBlock(block, rng, reserved, gaps) {
  const poly = insetConvex(block.poly, block.poly.map((p) => p.edge.sidewalk));
  if (poly.length < 3 || polygonArea(poly) < 90) return reserved.slice();
  const edges = blockEdges({ poly });
  const lots = reserved.slice(); // hero lots are already taken
  let openUsed = false;

  const fits = (r) => {
    if (!pointInConvex(poly, r.minX, r.minZ) || !pointInConvex(poly, r.maxX, r.minZ) ||
        !pointInConvex(poly, r.maxX, r.maxZ) || !pointInConvex(poly, r.minX, r.maxZ)) return false;
    for (const l of lots) if (overlap(r, l.rect)) return false;
    return true;
  };
  // rectangle on edge e: from s to s + w along the edge, d deep into the block
  const rectOn = (e, s, w, d) => {
    const x0 = e.a.x + e.dirX * s, z0 = e.a.z + e.dirZ * s;
    const x1 = x0 + e.dirX * w + e.inX * d, z1 = z0 + e.dirZ * w + e.inZ * d;
    return { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) };
  };
  const along = (e, r) => [(r.minX - e.a.x) * e.dirX + (r.minZ - e.a.z) * e.dirZ, (r.maxX - e.a.x) * e.dirX + (r.maxZ - e.a.z) * e.dirZ];
  // how far along edge e does something already stand (seen from position s)?
  const takenUntil = (e, s) => {
    const probe = rectOn(e, s + 0.05, 1.0, 6);
    let end = -1;
    for (const l of lots) if (overlap(probe, l.rect)) end = Math.max(end, ...along(e, l.rect));
    return end;
  };
  // free street front from s up to the next lot (or the end of the edge)
  const freeUntil = (e, s) => {
    let lim = e.len;
    const strip = rectOn(e, s + 0.05, e.len - s - 0.05, 8);
    for (const l of lots) if (overlap(strip, l.rect)) lim = Math.min(lim, Math.max(s, Math.min(...along(e, l.rect))));
    return lim;
  };

  // ---- straight edges: a row of lots ----
  const shift = block.id % Math.max(1, edges.length);
  for (let k = 0; k < edges.length; k++) {
    const e = edges[(k + shift) % edges.length];
    if (!e.axis) continue;
    let s = 0, prev = null, guard = 0;
    while (s < e.len - 6 && guard++ < 60) {
      const t0 = takenUntil(e, s);
      if (t0 > s + 0.01) { s = t0; prev = null; continue; }
      const lim = freeUntil(e, s);
      const space = lim - s;
      if (space < MIN_LOT + 0.4) {
        // too narrow for a building: it becomes a small green gap with trees
        if (space > 5 && block.playable) gaps.push(rectOn(e, s + 1, space - 2, 7));
        s = lim + 0.01;
        continue;
      }
      const id = pickType(rng, { district: block.district, edgeType: e.type, playable: block.playable, space, openUsed, prevType: prev ? prev.type : null });
      if (!id) { s += 2; continue; }
      const T = TYPES[id];
      const big = block.district === 'crown' ? 1.25 : 1; // towers of The Crown stand on bigger lots
      let w = rng.range(T.w[0] * big, Math.min(T.w[1] * big, space));
      if (w > space) w = space;
      // do not leave a strip that is too narrow for any building
      if (space - w < MIN_LOT + 1) w = space <= T.w[1] * big * 1.25 ? space : space - MIN_LOT - 2;
      let d = rng.range(T.d[0] * big, T.d[1] * big);
      let rect = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const r = rectOn(e, s, w, d);
        if (fits(r)) { rect = r; break; }
        d *= 0.84;
        if (attempt >= 2) w = Math.max(T.w[0], w * 0.88);
        if (d < T.d[0] * 0.85) break;
      }
      if (!rect) { s += 2; prev = null; continue; }
      const lot = { rect, type: id, front: sideOfEdge(e), edgeType: e.type, block, district: block.district, playable: block.playable, prevLot: prev, diag: null };
      lots.push(lot);
      if (T.open) openUsed = true;
      prev = lot;
      s += w;
    }
  }

  // ---- slanted edge (along the avenue): lots in a stair pattern ----
  for (const e of edges) {
    if (e.axis) continue;
    const sx = Math.sign(e.inX), sz = Math.sign(e.inZ);
    let prev = null;
    for (let t = 0.5; t < e.len - 3; t += 1.5) {
      const px = e.a.x + e.dirX * t, pz = e.a.z + e.dirZ * t;
      const id = rng.pick(prev && prev.type === 'tower' ? ['steps', 'trays', 'podium'] : ['tower', 'tower', 'steps']);
      let w = rng.range(18, 26), d = rng.range(18, 26);
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = { minX: Math.min(px, px + sx * w), maxX: Math.max(px, px + sx * w), minZ: Math.min(pz, pz + sz * d), maxZ: Math.max(pz, pz + sz * d) };
        if (fits(r)) {
          const sideX = sx > 0 ? 'E' : 'W', sideZ = sz > 0 ? 'S' : 'N';
          const lot = { rect: r, type: id, front: w >= d ? sideZ : sideX, edgeType: 'avenue', block, district: block.district, playable: block.playable, prevLot: prev, diag: true };
          lots.push(lot);
          prev = lot;
          break;
        }
        w *= 0.86; d *= 0.86;
        if (w < 15.5 || d < 15.5) break;
      }
    }
  }
  return lots;
}

// ---------------------------------------------------------------------------
// MODEL FILES (.glb) made in a 3D program.
//   * bXX_name.glb (see HEROES in heroBuildings.js) replaces that hero building
//   * hero1.glb ... hero4.glb, or the files listed in buildings.json, are
//     extra buildings on the "modelLots" of layout.js
// Returns { byId: { b01: scene, ... }, extra: [ { file, scene, height, rotate } ] }
// ---------------------------------------------------------------------------
export async function loadHeroModels() {
  const base = 'assets/buildings/';
  const exists = async (file) => {
    try { return (await fetch(base + file, { method: 'HEAD' })).ok; } catch (e) { return false; }
  };
  const want = [];
  for (const [id, h] of Object.entries(HEROES)) if (await exists(h.file + '.glb')) want.push({ id, file: h.file + '.glb' });
  let list = null;
  try {
    const r = await fetch(base + 'buildings.json', { cache: 'no-cache' });
    if (r.ok) list = await r.json();
  } catch (e) { /* no list file: that is fine */ }
  if (!Array.isArray(list)) {
    list = [];
    for (let i = 1; i <= 4; i++) if (await exists(`hero${i}.glb`)) list.push({ file: `hero${i}.glb` });
  }
  for (const item of list.slice(0, 8)) {
    const entry = typeof item === 'string' ? { file: item } : item;
    if (entry && entry.file) want.push(entry);
  }
  const out = { byId: {}, extra: [] };
  if (!want.length) return out;
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  for (const entry of want) {
    try {
      const gltf = await loader.loadAsync(base + entry.file);
      if (entry.id) out.byId[entry.id] = gltf.scene;
      else out.extra.push({ ...entry, scene: gltf.scene });
    } catch (e) {
      console.warn(`[buildings] could not load ${entry.file}`, e);
    }
  }
  return out;
}

// Put one model file on its lot: scale it to real size, turn its front to the
// street, add shadows and a collision box.
//   hero = { scene, height (meters, optional), rotate (degrees, optional), file }
function placeModel(ctx, lot, hero) {
  const curb = ctx.layout.street.curbHeight;
  const model = hero.scene;
  const f = sideFrame(lot.rect, lot.front);
  const lotW = lot.rect.maxX - lot.rect.minX, lotD = lot.rect.maxZ - lot.rect.minZ;
  // models are expected to look toward +z; turn that toward the street
  model.rotation.y = Math.atan2(f.nx, f.nz) + ((hero.rotate || 0) * Math.PI) / 180;
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.x < 1e-4 || size.y < 1e-4 || size.z < 1e-4) return false;
  let scale;
  if (hero.height) scale = hero.height / size.y;                     // real height is known
  else {
    scale = Math.min((lotW - 0.6) / size.x, (lotD - 0.6) / size.z);  // fit the lot
    if (size.y * scale > 70) scale = 70 / size.y;
  }
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  // stand in the middle of the lot, feet on the sidewalk
  model.position.x += (lot.rect.minX + lot.rect.maxX) / 2 - c.x;
  model.position.z += (lot.rect.minZ + lot.rect.maxZ) / 2 - c.z;
  model.position.y += curb - box.min.y;
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) if (m && m.isMeshStandardMaterial && ctx.lampPatch) ctx.lampPatch(m);
  });
  model.name = `model:${hero.file}`;
  ctx.group.add(model);
  ctx.colliders.boxes.push({ minX: box.min.x + 0.1, maxX: box.max.x - 0.1, minZ: box.min.z + 0.1, maxZ: box.max.z - 0.1, h: box.max.y });
  ctx.buildings.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y, floors: Math.round(box.max.y / FLOOR), mat: 'model', playable: true, type: hero.id || 'model', hero: true, file: hero.file });
  addDecal(ctx.mb.decal, 'blobRect', (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, box.max.x - box.min.x + 2.5, box.max.z - box.min.z + 2.5, 0, curb + 0.012, 0.8);
  return true;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function buildBuildings(ctx, models = { byId: {}, extra: [] }) {
  const L = ctx.layout;
  const kit = createKit(ctx);
  ctx.kit = kit;
  const counts = {};
  const heroSites = L.raw.heroSites || [];
  const modelLots = (L.raw.modelLots || []).slice(0, models.extra.length);
  const used = {}; // a model file can stand on several sites: later ones get a copy

  for (const block of L.blocks) {
    // every block has its own random numbers, so editing one block does not change the others
    const rng = new RNG(L.seed * 7919 + block.id * 104729);
    ctx.playableNow = block.playable;
    const gaps = [];

    // ---- outside the play area: one simple glass body per lot ----
    if (!block.playable) {
      for (const lot of planBlock(block, rng, [], gaps)) {
        if (TYPES[lot.type].open) continue;
        const crown = block.district === 'crown', neon = block.district === 'neon';
        kit.simple(lot.rect, crown ? rng.int(14, 40) : neon ? rng.int(3, 9) : rng.int(5, 12), rng);
      }
      continue;
    }

    // ---- reserve the lots of hero buildings and model files in this block ----
    const reserved = [];
    const whole = block.isRect && !block.half;
    if (whole) {
      const inner = innerOf(block);
      for (const h of heroSites) {
        if (h.col !== block.col || h.row !== block.row) continue;
        const H = HEROES[h.id];
        reserved.push({ rect: siteRect(inner, h, H.w, H.d), type: 'hero', hero: h, front: h.front, block, district: block.district, playable: true, prevLot: null });
      }
      modelLots.forEach((h, i) => {
        if (h.col !== block.col || h.row !== block.row) return;
        reserved.push({ rect: siteRect(inner, { at: h.corner || h.at, front: h.front }, h.width || 24, h.depth || 24), type: 'model', model: models.extra[i], front: h.front, block, district: block.district, playable: true, prevLot: null });
      });
    }

    const lots = planBlock(block, rng, reserved, gaps);
    for (const lot of lots) {
      const r = new RNG(L.seed * 31 + block.id * 7907 + Math.round(lot.rect.minX * 13 + lot.rect.minZ * 7));
      ctx.rng = r; // the kit takes its random numbers from here
      if (lot.type === 'model') {
        placeModel(ctx, lot, lot.model);
        continue;
      }
      if (lot.type === 'hero') {
        const id = lot.hero.id, file = models.byId[id];
        if (file) {
          // a model file with the name of this hero: use it instead of the code version
          const scene = used[id] ? file.clone(true) : file;
          used[id] = true;
          placeModel(ctx, lot, { scene, height: HEROES[id].height, file: HEROES[id].file + '.glb', id });
        } else {
          const site = { x: (lot.rect.minX + lot.rect.maxX) / 2, z: (lot.rect.minZ + lot.rect.maxZ) / 2, rot: ROT[lot.front] };
          const out = buildHero(kit, id, site);
          lot.summary = { type: id, floors: Math.round(out.top / FLOOR), rect: out.rect, top: out.top };
        }
        counts[id] = (counts[id] || 0) + 1;
        continue;
      }
      lot.prev = lot.prevLot ? lot.prevLot.summary || null : null;
      lot.summary = TYPES[lot.type].build(kit, lot, r);
      counts[lot.type] = (counts[lot.type] || 0) + 1;
      if (lot.summary.rect) kit.finish({ ...lot.summary.rect, top: lot.summary.top, floors: lot.summary.floors, mat: lot.type, playable: true, block, type: lot.type });

      // ---- glass sky bridge to the neighbour, if both are tall enough ----
      const a = lot.prev, b = lot.summary;
      if (a && a.rect && b.rect && a.top > 26 && b.top > 26 && r.chance(block.district === 'crown' ? 0.5 : 0.2)) {
        const ax = (a.rect.minX + a.rect.maxX) / 2, az = (a.rect.minZ + a.rect.maxZ) / 2, bx = (b.rect.minX + b.rect.maxX) / 2, bz = (b.rect.minZ + b.rect.maxZ) / 2;
        const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
        // from 4 m inside one building to 4 m inside the other (the ends are hidden inside)
        const ra = Math.abs(dx) > Math.abs(dz) ? (a.rect.maxX - a.rect.minX) / 2 : (a.rect.maxZ - a.rect.minZ) / 2;
        const rb = Math.abs(dx) > Math.abs(dz) ? (b.rect.maxX - b.rect.minX) / 2 : (b.rect.maxZ - b.rect.minZ) / 2;
        const gap = len - ra - rb;
        if (gap > 2 && gap < 26) {
          const y = Math.round((Math.min(a.top, b.top) * r.range(0.45, 0.72)) / FLOOR) * FLOOR + 1.2;
          kit.bridge(ax + dx * (ra - 4), az + dz * (ra - 4), bx - dx * (rb - 4), bz - dz * (rb - 4), y);
        }
      }
    }

    // ---- narrow leftovers between two lots become small green gaps ----
    for (const g of gaps) {
      const n = Math.max(1, Math.round(((g.maxX - g.minX) * (g.maxZ - g.minZ)) / 30));
      for (let i = 0; i < n; i++) {
        const x = rng.range(g.minX + 0.6, g.maxX - 0.6), z = rng.range(g.minZ + 0.6, g.maxZ - 0.6);
        ctx.roofTrees.push({ x, y: kit.curb, z, s: rng.range(0.8, 1.2), trunk: true, pit: true });
        ctx.colliders.circles.push({ x, z, r: 0.28 });
      }
    }
  }
  ctx.playableNow = false;
  ctx.buildingCounts = counts;
  return kit;
}

// A plain building for the scenery outside the play area (used by backdrop.js).
export function simpleBuilding(ctx, box, floors, rng, opts = {}) {
  return ctx.kit.simple(box, floors, rng, opts);
}
