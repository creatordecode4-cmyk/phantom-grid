// ---------------------------------------------------------------------------
// buildings.js - decides WHERE buildings go and WHICH type each one is.
//
//   1. plan:  cut the street front of every block into lots (pieces of land)
//   2. look:  find out what each side of a lot faces (street, alley,
//             neighbour, back yard)
//   3. build: let the building type of each lot put its parts together
//             (buildingTypes.js + buildingKit.js)
//
// Rules that keep the streets varied:
//   * never the same type twice in a row, and neighbours differ in height
//     and color (see pickType / floorsBetween / pickTint in buildingTypes.js)
//   * some lots stay open: a parking lot, a station, an empty lot
//   * now and then there is a narrow gap between two houses
//
// HERO BUILDINGS: .glb model files in assets/buildings/ are placed on a few
// corner lots (see "heroLots" in layout.js and loadHeroModels below).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RNG, insetConvex, pointInConvex, polygonArea } from '../utils/math.js';
import { blockEdges, addDecal } from './ground.js';
import { createKit, sideFrame } from './buildingKit.js';
import { TYPES, pickType } from './buildingTypes.js';

const RIGHT_OF = { N: 'W', W: 'S', S: 'E', E: 'N' };
const isStreet = (t) => t === 'street' || t === 'neon' || t === 'avenue';

// Which side of a lot looks out of the block across this edge?
function sideOfEdge(e) {
  return e.inZ > 0.9 ? 'S' : e.inZ < -0.9 ? 'N' : e.inX > 0.9 ? 'E' : 'W';
}
const overlap = (a, b, m = 0.02) => a.maxX > b.minX + m && a.minX < b.maxX - m && a.maxZ > b.minZ + m && a.minZ < b.maxZ - m;

// ---------------------------------------------------------------------------
// STEP 1: cut one block into lots
// ---------------------------------------------------------------------------
function planBlock(block, rng, reserved) {
  const poly = insetConvex(block.poly, block.poly.map((p) => p.edge.sidewalk));
  if (poly.length < 3 || polygonArea(poly) < 90) return [];
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
  // how far along edge e does something already stand (seen from position s)?
  const takenUntil = (e, s) => {
    const probe = rectOn(e, s + 0.05, 1.0, 5);
    let end = -1;
    for (const l of lots) {
      if (!overlap(probe, l.rect)) continue;
      const a = (l.rect.minX - e.a.x) * e.dirX + (l.rect.minZ - e.a.z) * e.dirZ;
      const b = (l.rect.maxX - e.a.x) * e.dirX + (l.rect.maxZ - e.a.z) * e.dirZ;
      end = Math.max(end, a, b);
    }
    return end;
  };
  // free street front from s up to the next lot (or the end of the edge)
  const freeUntil = (e, s) => {
    let lim = e.len;
    const strip = rectOn(e, s + 0.05, e.len - s - 0.05, 6);
    for (const l of lots) {
      if (!overlap(strip, l.rect)) continue;
      const a = (l.rect.minX - e.a.x) * e.dirX + (l.rect.minZ - e.a.z) * e.dirZ;
      const b = (l.rect.maxX - e.a.x) * e.dirX + (l.rect.maxZ - e.a.z) * e.dirZ;
      lim = Math.min(lim, Math.max(s, Math.min(a, b)));
    }
    return lim;
  };

  // ---- straight edges: a row of lots, side by side ----
  // start with a different edge in every block so the corners vary
  const shift = block.id % Math.max(1, edges.length);
  for (let k = 0; k < edges.length; k++) {
    const ei = (k + shift) % edges.length;
    const e = edges[ei];
    if (!e.axis) continue;
    const before = edges[(ei - 1 + edges.length) % edges.length], after = edges[(ei + 1) % edges.length];
    const low = block.district === 'neon' && e.type !== 'neon';
    let s = 0, prev = null, guard = 0;
    while (s < e.len - 6 && guard++ < 60) {
      const t0 = takenUntil(e, s);
      if (t0 > s + 0.01) { s = t0; prev = null; continue; }
      const lim = freeUntil(e, s);
      const space = lim - s;
      if (space < 6.4) { s = lim + 0.01; continue; }
      const cornerStart = s < 0.01 && isStreet(before.type) && before.axis;
      const cornerEnd = lim > e.len - 0.01 && isStreet(after.type) && after.axis && space <= TYPES.corner.w[1] && space >= TYPES.corner.w[0] - 2;
      const id = pickType(rng, {
        district: block.district, edgeType: e.type, playable: block.playable, space, openUsed,
        corner: isStreet(e.type) && (cornerStart || cornerEnd), prevType: prev ? prev.type : null,
      });
      if (!id) { s += 2; continue; }
      const T = TYPES[id];
      let w = rng.range(T.w[0], Math.min(T.w[1], space));
      if (id === 'corner' && cornerEnd && !cornerStart) w = space;
      // do not leave a strip that is too narrow for any building
      if (space - w < 6.5) w = space <= T.w[1] * 1.3 ? space : Math.max(T.w[0], space - 7.5);
      let d = rng.range(T.d[0], T.d[1]);
      if (id === 'corner') d = Math.min(T.d[1], Math.max(T.d[0], w + rng.range(-2, 2)));
      let rect = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const r = rectOn(e, s, w, d);
        if (fits(r)) { rect = r; break; }
        d *= 0.8;
        if (attempt >= 2) w = Math.max(T.w[0], w * 0.85);
        if (d < Math.min(T.d[0], 8.5)) break;
      }
      if (!rect) { s += 2; prev = null; continue; }
      const atEnd = s + w > e.len - 0.01;
      const lot = {
        rect, type: id, front: sideOfEdge(e), edgeType: e.type, block, district: block.district, low,
        cornerSide: s < 0.01 && isStreet(before.type) ? 'right' : atEnd && isStreet(after.type) ? 'left' : null,
        prevLot: prev, diag: null,
      };
      lots.push(lot);
      if (T.open) openUsed = true;
      prev = lot;
      // houses mostly share a wall; now and then there is a narrow gap
      s += w + (!T.open && rng.chance(0.14) ? rng.range(1.3, 2.4) : 0);
    }
  }

  // ---- slanted edge (along the avenue): lots in a stair pattern ----
  for (const e of edges) {
    if (e.axis) continue;
    const sx = Math.sign(e.inX), sz = Math.sign(e.inZ);
    let prev = null;
    for (let t = 0.5; t < e.len - 3; t += 1.5) {
      const px = e.a.x + e.dirX * t, pz = e.a.z + e.dirZ * t;
      const id = prev && prev.type === 'corner' ? rng.pick(['stucco', 'walkup', 'office']) : rng.chance(0.6) ? 'corner' : rng.pick(['stucco', 'walkup']);
      const T = TYPES[id];
      let w = rng.range(Math.max(9, T.w[0]), Math.min(17, T.w[1])), d = rng.range(Math.max(10, T.d[0]), Math.min(16, T.d[1]));
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = { minX: Math.min(px, px + sx * w), maxX: Math.max(px, px + sx * w), minZ: Math.min(pz, pz + sz * d), maxZ: Math.max(pz, pz + sz * d) };
        if (fits(r)) {
          // the two sides that look at the avenue; the longer one is the front
          const sideX = sx > 0 ? 'E' : 'W', sideZ = sz > 0 ? 'S' : 'N';
          const front = w >= d ? sideZ : sideX, other = w >= d ? sideX : sideZ;
          const lot = {
            rect: r, type: id, front, edgeType: 'avenue', block, district: block.district, low: false,
            cornerSide: RIGHT_OF[front] === other ? 'right' : 'left', prevLot: prev, diag: { outX: -e.inX, outZ: -e.inZ },
          };
          lots.push(lot);
          prev = lot;
          break;
        }
        w *= 0.8; d *= 0.8;
        if (w < T.w[0] - 1.5 || d < 8.5) break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP 2: what does each side of each lot face?
  //   'front' a street,  'alley' an alley (or an open lot next door),
  //   'party' a neighbour's wall,  'gap' a narrow gap,  'back' the back yard
  // -------------------------------------------------------------------------
  for (const lot of lots) {
    const b = lot.rect;
    lot.sides = {};
    for (const side of ['N', 'S', 'E', 'W']) {
      const f = sideFrame(b, side);
      const mx = f.ox + f.dx * f.len / 2, mz = f.oz + f.dz * f.len / 2;
      let kind = 'back', edgeType = null;
      // on the edge of the block? then it faces a street (or an alley)
      for (const e of edges) {
        if (!e.axis) continue;
        const dist = Math.abs((mx - e.a.x) * e.inX + (mz - e.a.z) * e.inZ);
        const along = (mx - e.a.x) * e.dirX + (mz - e.a.z) * e.dirZ;
        const facing = f.nx * -e.inX + f.nz * -e.inZ;
        if (dist < 0.35 && along > -0.5 && along < e.len + 0.5 && facing > 0.9) {
          kind = e.type === 'alley' ? 'alley' : 'front';
          edgeType = e.type;
        }
      }
      // lots on the slanted edge: the two sides that look toward the avenue
      const towardAvenue = lot.diag && f.nx * lot.diag.outX + f.nz * lot.diag.outZ > 0.1;
      if (kind === 'back' && towardAvenue) { kind = 'front'; edgeType = 'avenue'; }
      if (kind === 'back' || towardAvenue) {
        // is another lot right in front of this wall? how far away?
        const reach = 3.6, inset = Math.min(1.2, f.len * 0.3);
        const ax = f.ox + f.dx * inset, az = f.oz + f.dz * inset, bx = f.ox + f.dx * (f.len - inset), bz = f.oz + f.dz * (f.len - inset);
        const zone = {
          minX: Math.min(ax, bx) + Math.min(0, f.nx * reach), maxX: Math.max(ax, bx) + Math.max(0, f.nx * reach),
          minZ: Math.min(az, bz) + Math.min(0, f.nz * reach), maxZ: Math.max(az, bz) + Math.max(0, f.nz * reach),
        };
        let gap = Infinity, openNext = false;
        for (const o of lots) {
          if (o === lot || !overlap(zone, o.rect, 0)) continue;
          const g = f.nx > 0.5 ? o.rect.minX - b.maxX : f.nx < -0.5 ? b.minX - o.rect.maxX : f.nz > 0.5 ? o.rect.minZ - b.maxZ : b.minZ - o.rect.maxZ;
          if (g < gap) { gap = g; openNext = !!TYPES[o.type] && !!TYPES[o.type].open; }
        }
        if (gap < 3.6) {
          if (openNext) { kind = 'alley'; edgeType = 'lot'; }
          else kind = gap < 0.3 ? 'party' : 'gap';
        }
      }
      lot.sides[side] = { kind, edgeType };
    }
    // a corner lot must really have a second street side, otherwise it is a normal lot
    if (lot.cornerSide) {
      const other = lot.cornerSide === 'right' ? RIGHT_OF[lot.front] : Object.keys(RIGHT_OF).find((k) => RIGHT_OF[k] === lot.front);
      if (lot.sides[other].kind !== 'front') lot.cornerSide = null;
    }
    lot.corner = !!lot.cornerSide;
    if (lot.type === 'corner' && !lot.corner) lot.type = 'stucco';
  }
  return lots;
}

// ---------------------------------------------------------------------------
// HERO BUILDINGS: model files made in a 3D program.
//
// Put .glb files into assets/buildings/ and either
//   * name them hero1.glb, hero2.glb, hero3.glb, hero4.glb, or
//   * list them in assets/buildings/buildings.json, for example
//       [ { "file": "bank.glb", "height": 32, "rotate": 90 }, "diner.glb" ]
//     height = real height in meters (optional), rotate = extra turn in degrees
// A model is scaled to fit its corner lot unless a height is given.
// ---------------------------------------------------------------------------
export async function loadHeroModels() {
  const base = 'assets/buildings/';
  let list = null;
  try {
    const r = await fetch(base + 'buildings.json', { cache: 'no-cache' });
    if (r.ok) list = await r.json();
  } catch (e) { /* no list file: that is fine */ }
  if (!Array.isArray(list)) {
    list = [];
    for (let i = 1; i <= 4; i++) {
      try {
        const head = await fetch(`${base}hero${i}.glb`, { method: 'HEAD' });
        if (head.ok) list.push({ file: `hero${i}.glb` });
      } catch (e) { /* missing */ }
    }
  }
  if (!list.length) return [];
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const out = [];
  for (const item of list.slice(0, 8)) {
    const entry = typeof item === 'string' ? { file: item } : item;
    if (!entry || !entry.file) continue;
    try {
      const gltf = await loader.loadAsync(base + entry.file);
      out.push({ ...entry, scene: gltf.scene });
    } catch (e) {
      console.warn(`[buildings] could not load ${entry.file}`, e);
    }
  }
  return out;
}

// Put one hero model on its lot: scale it to real size, turn its front to the
// street, add shadows and a collision box.
function placeHero(ctx, lot, hero) {
  const L = ctx.layout, curb = L.street.curbHeight;
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
  if (hero.height) scale = hero.height / size.y;                     // real height given in the list
  else {
    scale = Math.min((lotW - 0.6) / size.x, (lotD - 0.6) / size.z);  // fit the lot
    if (size.y * scale > 70) scale = 70 / size.y;                    // never taller than 70 m
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
  model.name = `hero:${hero.file}`;
  ctx.group.add(model);
  ctx.colliders.boxes.push({ minX: box.min.x + 0.1, maxX: box.max.x - 0.1, minZ: box.min.z + 0.1, maxZ: box.max.z - 0.1, h: box.max.y });
  ctx.buildings.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y, floors: Math.round(box.max.y / 3.5), mat: 'hero', playable: true, block: lot.block, type: 'hero', file: hero.file });
  // soft shadow where the model meets the ground
  addDecal(ctx.mb.decal, 'blobRect', (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, box.max.x - box.min.x + 2.5, box.max.z - box.min.z + 2.5, 0, curb + 0.012, 0.8);
  return true;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function buildBuildings(ctx, heroes = []) {
  const L = ctx.layout;
  const kit = createKit(ctx);
  ctx.kit = kit;
  const counts = {};
  const heroLots = (L.raw.heroLots || []).slice(0, heroes.length);

  for (const block of L.blocks) {
    // every block has its own random numbers, so editing one block does not change the others
    const rng = new RNG(L.seed * 7919 + block.id * 104729);

    // ---- outside the play area: simple boxes with painted windows ----
    if (!block.playable) {
      const lots = planBlock(block, rng, []);
      for (const lot of lots) {
        const T = TYPES[lot.type];
        if (T.open && rng.chance(0.6)) continue;
        const neon = block.district === 'neon';
        kit.simple(lot.rect, lot.type === 'shoprow' || lot.type === 'warehouse' ? rng.int(1, 2) : neon ? rng.int(2, 4) : rng.int(3, 8), rng);
      }
      continue;
    }

    // ---- hero models take a corner of their block ----
    const reserved = [];
    heroLots.forEach((h, i) => {
      if (h.col !== block.col || h.row !== block.row || !block.isRect || block.half) return;
      const inner = insetConvex(block.poly, block.poly.map((p) => p.edge.sidewalk));
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of inner) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
      const w = h.width || 24, d = h.depth || 24;
      const south = h.corner[0] === 's', east = h.corner[1] === 'e';
      const rect = {
        minX: east ? minX : maxX - w, maxX: east ? minX + w : maxX,
        minZ: south ? minZ : maxZ - d, maxZ: south ? minZ + d : maxZ,
      };
      reserved.push({ rect, type: 'hero', hero: heroes[i], front: h.front || (south ? 'S' : 'N'), edgeType: 'street', block, district: block.district, prevLot: null, diag: null, cornerSide: null });
    });

    const lots = planBlock(block, rng, reserved);
    for (const lot of lots) {
      if (lot.type === 'hero') {
        if (!placeHero(ctx, lot, lot.hero)) console.warn('[buildings] hero model is empty:', lot.hero.file);
        continue;
      }
      lot.prev = lot.prevLot ? lot.prevLot.summary || null : null;
      const r = new RNG(L.seed * 31 + block.id * 7907 + Math.round(lot.rect.minX * 13 + lot.rect.minZ * 7));
      lot.summary = TYPES[lot.type].build(kit, lot, r);
      if (lot.summary) lot.summary.type = lot.type;
      counts[lot.type] = (counts[lot.type] || 0) + 1;
    }
  }
  ctx.buildingCounts = counts;
  return kit;
}

// ---------------------------------------------------------------------------
// A plain building for the scenery outside the play area (used by backdrop.js).
//   box = { minX, maxX, minZ, maxZ },  opts = { brick, tint, windows }
// ---------------------------------------------------------------------------
export function simpleBuilding(ctx, box, floors, rng, opts = {}) {
  return ctx.kit.simple(box, floors, rng, opts);
}
