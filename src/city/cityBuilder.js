// ---------------------------------------------------------------------------
// cityBuilder.js - builds the whole city from the layout data.
//
// How it works:
//   1. ground.js, buildings.js, props.js and backdrop.js add shapes to a few
//      shared "mesh builders" (one per material).
//   2. Here every builder becomes ONE mesh. That keeps the number of draw
//      calls small, which is what makes the game fast on phones.
//   3. We also create the collision data and the "lamp light map".
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RNG } from '../utils/math.js';
import { MeshBuilder } from '../utils/geometry.js';
import { shared } from './materials.js';
import { buildGround, blockEdges } from './ground.js';
import { buildBuildings, loadHeroModels } from './buildings.js';
import { createTraffic } from '../ai/traffic.js';
import { createPedestrians } from '../ai/pedestrians.js';
import { makeBeamTexture } from '../vehicles/vehicle.js';
import { buildProps, makeHoloMaterial } from './props.js';
import { buildBackdrop } from './backdrop.js';

// Used to free the normal-memory copy of a big mesh after it was sent to the graphics card.
function dropArray() {
  this.array = null;
}

// Let the browser draw the loading bar between heavy steps.
const pause = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Collision data. Buildings are boxes, poles / trees / cars are circles.
// They are sorted into a grid so the player only checks things nearby.
// ---------------------------------------------------------------------------
const CELL = 24; // meters
function makeCollisionGrid(boxes, circles) {
  const cells = new Map();
  const EMPTY = { boxes: [], circles: [] };
  const get = (cx, cz) => {
    const key = cx * 100000 + cz;
    let c = cells.get(key);
    if (!c) { c = { boxes: [], circles: [] }; cells.set(key, c); }
    return c;
  };
  const M = 1.6; // extra margin so things close to a cell border are found
  function addBox(b) {
    for (let cx = Math.floor((b.minX - M) / CELL); cx <= Math.floor((b.maxX + M) / CELL); cx++) {
      for (let cz = Math.floor((b.minZ - M) / CELL); cz <= Math.floor((b.maxZ + M) / CELL); cz++) get(cx, cz).boxes.push(b);
    }
  }
  for (const b of boxes) addBox(b);
  function addCircle(c) {
    for (let cx = Math.floor((c.x - c.r - M) / CELL); cx <= Math.floor((c.x + c.r + M) / CELL); cx++) {
      for (let cz = Math.floor((c.z - c.r - M) / CELL); cz <= Math.floor((c.z + c.r + M) / CELL); cz++) get(cx, cz).circles.push(c);
    }
  }
  for (const c of circles) addCircle(c);
  return {
    boxes, circles,
    // everything that could touch a point near (x, z)
    near(x, z) {
      return cells.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL)) || EMPTY;
    },
    // something solid that is put into the world later (the posts of the scanner gates, the walls of a room)
    addCircle(c) { circles.push(c); addCircle(c); },
    addBox(b) { boxes.push(b); addBox(b); },
  };
}

// ---------------------------------------------------------------------------
// Lamp light map: a top-down picture of the city.
//   red   = light from the orange street lamps
//   green = light from white lamps and lit shop windows
//   blue  = where rain water collects (gutters along the curbs, alleys)
// The ground and wall shaders read it, so hundreds of lamps cost nothing.
// ---------------------------------------------------------------------------
function makeLampLightMap(ctx) {
  const L = ctx.layout;
  const SIZE = 1024;
  const minX = L.bounds.minX - 40, maxX = L.bounds.maxX + 220;
  const minZ = L.bounds.minZ - 30, maxZ = L.bounds.maxZ + 230;
  const sx = SIZE / (maxX - minX), sz = SIZE / (maxZ - minZ);
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, SIZE, SIZE);
  const X = (x) => (x - minX) * sx;
  const Y = (z) => SIZE - (z - minZ) * sz; // the picture is flipped: north is up
  g.globalCompositeOperation = 'lighter'; // colors add up where light pools overlap

  // gutters and alleys (blue) - drawn first
  g.strokeStyle = 'rgb(0,0,150)';
  g.lineWidth = 1.7;
  for (const b of L.blocks) {
    for (const e of blockEdges(b)) {
      if (e.type === 'alley') continue;
      g.beginPath();
      g.moveTo(X(e.a.x - e.inX * 0.8), Y(e.a.z - e.inZ * 0.8));
      g.lineTo(X(e.b.x - e.inX * 0.8), Y(e.b.z - e.inZ * 0.8));
      g.stroke();
    }
  }
  g.fillStyle = 'rgb(0,0,110)';
  for (const a of L.alleyRects) g.fillRect(X(a.minX), Y(a.maxZ), (a.maxX - a.minX) * sx, (a.maxZ - a.minZ) * sz);

  // street lamps: brightest right under the lamp, fading out like real light
  const R = 30; // meters
  for (const lamp of ctx.lamps) {
    if (lamp.noPool) continue;
    const px = X(lamp.x), py = Y(lamp.z), pr = R * sx;
    const grad = g.createRadialGradient(px, py, 0, px, py, pr);
    const h = lamp.h || lamp.y; // lamp height above the ground it lights
    for (const t of [0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1]) {
      const d = t * R;
      // light on the ground from a lamp at height h (inverse square + angle)
      let v = Math.pow(1 + (d * d) / (h * h), -1.5) * (1 - t * t);
      v = Math.round(v * 150);
      grad.addColorStop(t, lamp.type === 0 ? `rgb(${v},0,0)` : `rgb(0,${Math.round(v * 0.8)},0)`);
    }
    g.fillStyle = grad;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  // light falling out of shop windows and from lit signs
  for (const s of ctx.shopLights) {
    const px = X(s.x), py = Y(s.z), pr = s.r * sx;
    const grad = g.createRadialGradient(px, py, 0, px, py, pr);
    const v = Math.round(s.power * 255);
    grad.addColorStop(0, `rgb(0,${v},0)`);
    grad.addColorStop(0.5, `rgb(0,${Math.round(v * 0.35)},0)`);
    grad.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = grad;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  shared.uPgLightMap.value = tex;
  shared.uPgLightRect.value.set(minX, minZ, 1 / (maxX - minX), 1 / (maxZ - minZ));
  return tex;
}

// ---------------------------------------------------------------------------
// MAIN: build everything. Returns the "city" object used by the game.
// ---------------------------------------------------------------------------
export async function buildCity(scene, layout, materials, onProgress = () => {}, carLib = null) {
  const group = new THREE.Group();
  group.name = 'city';
  const ctx = {
    layout,
    group,
    carLib,           // cars from model files (may be empty)
    mats: materials.mats,
    tex: materials.tex,
    rng: new RNG(layout.seed),
    // one builder per material
    mb: {
      asphalt: new MeshBuilder(), sidewalk: new MeshBuilder(), sand: new MeshBuilder(),
      decal: new MeshBuilder(), marking: new MeshBuilder(),
      brick: new MeshBuilder(), plaster: new MeshBuilder(), tower: new MeshBuilder(),
      shop: new MeshBuilder(), sign: new MeshBuilder(), awning: new MeshBuilder(),
      propStatic: new MeshBuilder(), holo: new MeshBuilder(),
      metal: new MeshBuilder(), graffiti: new MeshBuilder(), rail: new MeshBuilder(), puddle: new MeshBuilder(),
      glass: new MeshBuilder(), panel: new MeshBuilder(), hedge: new MeshBuilder(), green: new MeshBuilder(),
    },
    sets: {},         // all instanced things (props.js and buildingKit.js add to it)
    colliders: { boxes: [], circles: [] },
    lamps: [],        // every street lamp: { x, y, z, type }
    shopLights: [],   // light from shop windows: { x, z, r, power }
    buildings: [],
    parked: [],       // cars standing in parking lots: { x, z, rot }
    parkedCars: [],   // every parked car (the player can drive them): filled by props.js
    lotLamps: [],     // lamps in plazas: { x, z, rot }
    roofTrees: [],    // trees on roofs, terraces and in gardens: { x, y, z, s, trunk }
    evPosts: [],      // EV charging posts in front of buildings: { x, z, rot }
    playableNow: false,
    lampPatch: materials.lampPatch,
  };

  // how long each step takes (milliseconds), handy when tuning the load time
  const timing = {};
  let mark = performance.now();
  const lap = (name) => { const now = performance.now(); timing[name] = Math.round(now - mark); mark = now; };

  onProgress(0.05, 'Laying out streets');
  buildGround(ctx);
  lap('ground');
  await pause();

  onProgress(0.2, 'Looking for building models');
  const models = await loadHeroModels();
  onProgress(0.25, 'Raising buildings');
  lap('heroLookup');
  buildBuildings(ctx, models);
  lap('buildings');
  await pause();

  onProgress(0.5, 'Building skyline and highway');
  const backdrop = buildBackdrop(ctx);
  lap('backdrop');
  await pause();

  onProgress(0.65, 'Placing street furniture');
  const props = buildProps(ctx);
  lap('props');
  await pause();

  onProgress(0.85, 'Finishing the city');
  // ---- every builder becomes one mesh ----
  //   order: lower numbers are drawn first. Buildings first, ground after,
  //   because pixels hidden behind buildings are then skipped (faster).
  const meshes = {};
  const make = (name, mat, opts) => {
    const mb = ctx.mb[name];
    if (mb.count === 0) return null;
    const geo = mb.build(opts.data !== false);
    // the big meshes never change: free their copy in normal memory once the
    // graphics card has them (saves a lot of memory on phones)
    if (mb.count > 20000) {
      for (const a of Object.values(geo.attributes)) a.onUpload(dropArray);
      geo.index.onUpload(dropArray);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.castShadow = !!opts.cast;
    mesh.receiveShadow = opts.receive !== false;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = opts.order;
    group.add(mesh);
    meshes[name] = mesh;
    ctx.mb[name] = null; // free the memory
    return mesh;
  };
  const m = ctx.mats;
  make('brick', m.brick, { cast: true, order: 0 });
  make('plaster', m.plaster, { cast: true, order: 0 });
  make('metal', m.metal, { cast: true, order: 0 });
  make('glass', m.glass, { cast: true, order: 0 });
  make('panel', m.panel, { cast: true, order: 0 });
  make('green', m.greenWall, { order: 1, data: false });
  make('hedge', m.leaf, { order: 1 });
  make('shop', m.shop, { order: 1 });
  make('sign', m.sign, { order: 1 });
  make('awning', m.awning, { cast: true, order: 1 });
  make('propStatic', m.prop, { cast: true, order: 1 });
  make('tower', m.tower, { order: 2, receive: false, data: false });
  make('sidewalk', m.sidewalk, { order: 3, data: false });
  make('asphalt', m.asphalt, { order: 4, data: false });
  make('sand', m.sand, { order: 5, data: false });
  make('decal', m.decal, { order: 10, data: false });
  make('puddle', m.puddle, { order: 10, data: false });
  make('marking', m.marking, { order: 11, data: false });
  make('graffiti', m.graffiti, { order: 12, data: false });
  make('rail', m.rail, { order: 12, data: false });
  const holoMb = ctx.mb.holo;
  if (holoMb.count > 0) {
    const holo = new THREE.Mesh(holoMb.build(false), makeHoloMaterial(ctx.tex.holo));
    holo.name = 'holograms';
    holo.frustumCulled = false;
    holo.renderOrder = 18;
    group.add(holo);
  }

  // people and traffic (they need the car models from the props and the walls of the buildings)
  const traffic = createTraffic(ctx, makeBeamTexture());
  const people = createPedestrians(ctx);
  lap('meshes');
  makeLampLightMap(ctx);
  const colliders = makeCollisionGrid(ctx.colliders.boxes, ctx.colliders.circles);
  colliders.dynamic = traffic.dynamicCircles; // moving cars near the player
  lap('lightMap');
  scene.add(group);
  onProgress(1, 'City ready');

  return {
    group,
    layout,
    meshes,
    props,
    traffic,
    people,
    parkedCars: ctx.parkedCars,
    colliders,
    lamps: ctx.lamps,
    buildings: ctx.buildings,
    groundHeight: layout.groundHeight,
    counts: ctx.buildingCounts,
    timing,
    // LOW quality switches the 3D window detail off
    setQuality(q) {
      const on = q.buildingDetail !== false;
      props.setDetail(on);
      traffic.setQuality(q);
      people.setQuality(q);
      if (meshes.hedge) meshes.hedge.visible = on; // LOW: no plants on the facades
    },
    // called every frame
    update(dt, time, x, z, propDistance) {
      props.update(dt, time, x, z, propDistance);
      backdrop.rail.update(dt);
    },
  };
}
