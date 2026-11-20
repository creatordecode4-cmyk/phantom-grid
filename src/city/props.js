// ---------------------------------------------------------------------------
// props.js - puts all the small things into the city:
// street lights, traffic lights, trees with tree grates, palms, bins,
// benches, bus stops, hydrants, planters, newspaper boxes, parking meters,
// street signs, power poles with sagging wires, parked cars, EV chargers,
// drones, dumpsters and puddles in the alleys, barriers at the edge of the map.
//
// (Things that belong to a building - balconies, fire escapes, roof
// equipment - are placed by buildingKit.js.)
//
// Each kind of prop is ONE instanced mesh (one draw call for all copies).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { InstancedSet } from '../utils/geometry.js';
import { blockEdges, addDecal } from './ground.js';
import * as M from './models.js';
import { shared } from './materials.js';

// Car paint colors (screen colors). Common colors appear more often.
const CAR_COLORS = [
  [0.82, 0.82, 0.8], [0.82, 0.82, 0.8], [0.6, 0.61, 0.62], [0.6, 0.61, 0.62], [0.3, 0.31, 0.33], [0.3, 0.31, 0.33],
  [0.05, 0.05, 0.055], [0.05, 0.05, 0.055], [0.08, 0.13, 0.26], [0.45, 0.07, 0.06], [0.52, 0.47, 0.38],
  [0.09, 0.18, 0.13], [0.42, 0.52, 0.6], [0.36, 0.22, 0.12], [0.7, 0.66, 0.5],
];
const HYDRANT_COLORS = [[0.78, 0.6, 0.1], [0.78, 0.6, 0.1], [0.6, 0.1, 0.07]];
const DUMPSTER_COLORS = [[0.1, 0.22, 0.14], [0.12, 0.2, 0.36], [0.3, 0.3, 0.3], [0.35, 0.16, 0.1]];
const NEWSBOX_COLORS = [[0.55, 0.08, 0.06], [0.08, 0.2, 0.45], [0.7, 0.55, 0.08], [0.1, 0.3, 0.16], [0.75, 0.75, 0.72], [0.06, 0.06, 0.07]];

// Turn a point of a model (lx, ly, lz) by "rot" around the up axis and move it.
function place(x, y, z, rot, lx, ly, lz) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
}

// ---------------------------------------------------------------------------
// Glow around lamps: one flat sprite per lamp that always faces the camera.
// Far lamps keep a minimum size on screen, so the city sparkles at night.
// ---------------------------------------------------------------------------
function makeLampGlow(lamps, glowTex) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const off = new Float32Array(lamps.length * 3);
  const col = new Float32Array(lamps.length * 3);
  const size = new Float32Array(lamps.length);
  const a = new THREE.Color(), b = new THREE.Color();
  a.copy(shared.uPgLightColA.value);
  b.copy(shared.uPgLightColB.value);
  lamps.forEach((l, i) => {
    off[i * 3] = l.x; off[i * 3 + 1] = l.y; off[i * 3 + 2] = l.z;
    const c = l.type === 1 ? b : a;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    size[i] = l.size || 1.5;
  });
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.instanceCount = lamps.length;

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null }, uPixel: { value: 0.002 } }]);
  uniforms.uTex.value = glowTex;
  uniforms.uPgNight = shared.uPgNight;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uPgNight;
      uniform float uPixel;     // size of one screen pixel at 1 m distance
      varying vec2 vUv;
      varying vec3 vCol;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = viewMatrix * vec4( aOffset, 1.0 );
        float dist = - mvPosition.z;
        // never smaller than about 2.5 pixels
        float size = max( aSize, dist * uPixel * 2.5 );
        mvPosition.xy += position.xy * size;
        mvPosition.z += 0.35;   // a little toward the camera, in front of the lamp itself
        gl_Position = projectionMatrix * mvPosition;
        // enlarged far lamps get dimmer so the total light stays right
        float k = aSize / size;
        vCol = aColor * uPgNight * ( 0.25 + 0.75 * k ) * 5.0;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      varying vec2 vUv;
      varying vec3 vCol;
      #include <fog_pars_fragment>
      void main() {
        float a = texture2D( uTex, vUv ).r;
        gl_FragColor = vec4( vCol * a, 1.0 );
        #ifdef USE_FOG
          gl_FragColor.rgb *= 1.0 - pgFogAmount();
        #endif
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lampGlow';
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  return mesh;
}

// ---------------------------------------------------------------------------
// Hologram billboards (near-future touch on Neon Mile).
// ---------------------------------------------------------------------------
export function makeHoloMaterial(tex) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null } }]);
  uniforms.uTex.value = tex;
  uniforms.uPgTime = shared.uPgTime;
  uniforms.uPgDay = shared.uPgDay;
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vLocal;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vLocal = color.xy;      // 0..1 across the panel (stored in the vertex color)
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uPgTime;
      uniform float uPgDay;
      varying vec2 vUv;
      varying vec2 vLocal;
      #include <fog_pars_fragment>
      void main() {
        vec3 c = texture2D( uTex, vUv ).rgb;
        // thin moving scan lines and a slow flicker
        float scan = 0.82 + 0.18 * sin( vLocal.y * 620.0 - uPgTime * 5.0 );
        float flick = 0.93 + 0.07 * sin( uPgTime * 13.0 + vLocal.x * 3.0 ) * sin( uPgTime * 2.3 );
        vec2 e = min( vLocal, 1.0 - vLocal );
        float edge = smoothstep( 0.0, 0.03, min( e.x, e.y ) );
        // weaker in daylight (it is light in the air), strong at night
        float power = mix( 2.6, 0.55, uPgDay );
        gl_FragColor = vec4( c * scan * flick * edge * power, 1.0 );
        #ifdef USE_FOG
          gl_FragColor.rgb *= 1.0 - pgFogAmount();
        #endif
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    vertexColors: true,
  });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function buildProps(ctx) {
  const L = ctx.layout;
  const mats = ctx.mats;
  const rng = ctx.rng.fork();
  const curb = L.street.curbHeight;
  const half = L.street.width / 2;
  const B = L.bounds;
  const dc = ctx.mb.decal;
  const circles = ctx.colliders.circles;
  const lamps = ctx.lamps;
  const lin = M.lin;

  // ---- the models -------------------------------------------------------------
  const mStreet = M.makeSmartLight(); // slim pole with a thin bar of white light
  const mLed1 = M.makeLedLight(1);
  const mLed2 = M.makeLedLight(2);
  const mTraffic = M.makeTrafficLight();
  const mTree = M.makeTree(11, 0);  // wide round street tree
  const mTree2 = M.makeTree(17, 1); // taller, narrower tree
  const mPalm = M.makePalm(12);

  const sets = ctx.sets; // shared with buildingKit.js, which has already added the building details
  const S = (name, geom, mat, opts) => (sets[name] = new InstancedSet(name, geom, mat, opts));
  S('streetLight', mStreet.geometry, mats.prop, { maxDistance: 230 });
  S('led1', mLed1.geometry, mats.prop, { maxDistance: 260 });
  S('led2', mLed2.geometry, mats.prop, { maxDistance: 300 });
  S('traffic', mTraffic.geometry, mats.prop, { maxDistance: 200 });
  S('pole', M.makeSmartMast(), mats.prop, { maxDistance: 260 });
  S('treeTrunk', mTree.trunk, mats.bark, { maxDistance: 200 });
  S('treeCrown', mTree.crown, mats.leaf, { maxDistance: 290, useColor: true });
  S('treeTrunk2', mTree2.trunk, mats.bark, { maxDistance: 200 });
  S('treeCrown2', mTree2.crown, mats.leaf, { maxDistance: 290, useColor: true });
  S('palmTrunk', mPalm.trunk, mats.palmBark, { maxDistance: 300 });
  S('palmCrown', mPalm.crown, mats.frond, { maxDistance: 340, useColor: true });
  S('hydrant', M.makeHydrant(), mats.prop, { maxDistance: 95, useColor: true });
  S('bin', M.makeTrashBin(), mats.prop, { maxDistance: 105 });
  S('bench', M.makeBench(), mats.prop, { maxDistance: 120 });
  S('busStop', M.makeBusStop(), mats.prop, { maxDistance: 230 });
  S('ev', M.makeEvPost(), mats.prop, { maxDistance: 110 });
  S('dumpster', M.makeDumpster(), mats.prop, { maxDistance: 130, useColor: true });
  S('barrier', M.makeBarrier(), mats.prop, { maxDistance: 320 });
  S('sedan', M.makeCar('sedan'), mats.prop, { maxDistance: 150, useColor: true });
  S('suv', M.makeCar('suv'), mats.prop, { maxDistance: 150, useColor: true });
  S('van', M.makeCar('van'), mats.prop, { maxDistance: 150, useColor: true });
  S('lifeguard', M.makeLifeguardTower(), mats.prop, { maxDistance: 700 });
  S('newsBox', M.makeNewsBox(), mats.prop, { maxDistance: 90, useColor: true });
  S('meter', M.makeParkingMeter(), mats.prop, { maxDistance: 80, castShadow: false });
  S('streetSign', M.makeStreetSign(), mats.prop, { maxDistance: 150 });
  S('bikeRack', M.makeBikeRack(), mats.prop, { maxDistance: 85 });

  // lamps of the traffic lights: tiny glowing balls with their own color
  const bitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampDisc = new THREE.CircleGeometry(0.105, 8);
  lampDisc.rotateY(Math.PI); // the lamps look toward -z, like the signal heads
  const bits = S('signalLamp', lampDisc, bitMat, { maxDistance: 240, useColor: true, castShadow: false, receiveShadow: false });
  const signalBits = []; // { index, group: 0 north-south / 1 east-west, kind }

  // ---- trees: every tree gets its own green, size and a slight lean ----
  // leaf tints from yellow-green over fresh green to deep green (multiplied with the leaf picture)
  const LEAF_TINTS = [[1.2, 1.12, 0.62], [1.08, 1.1, 0.7], [0.98, 1.05, 0.72], [0.9, 1.0, 0.7], [0.8, 0.95, 0.68], [0.68, 0.86, 0.62], [0.6, 0.78, 0.6]];
  const leafTint = () => {
    const c = rng.pick(LEAF_TINTS), k = rng.range(0.92, 1.08);
    return [c[0] * k, c[1] * k, c[2] * k];
  };
  // one street / roof tree. o: { trunk: false = crown only (high roofs) }
  function addTree(x, y, z, size = 1, o = {}) {
    const two = rng.chance(0.4);
    const rot = rng.range(0, 6.28), tx = rng.range(-0.07, 0.07), tz = rng.range(-0.07, 0.07);
    const s = size * rng.range(0.85, 1.2), sc = [s * rng.range(0.92, 1.1), s * rng.range(0.9, 1.15), s * rng.range(0.92, 1.1)];
    if (o.trunk !== false) sets[two ? 'treeTrunk2' : 'treeTrunk'].add(x, y, z, rot, sc, null, tx, tz);
    sets[two ? 'treeCrown2' : 'treeCrown'].add(x, o.trunk === false ? y - 2.6 * sc[1] : y, z, rot, sc, leafTint(), tx, tz);
  }
  function addPalm(x, y, z, size = 1) {
    const rot = rng.range(0, 6.28), tx = rng.range(-0.06, 0.06), tz = rng.range(-0.06, 0.06);
    const sc = [size, size * rng.range(0.85, 1.18), size];
    const c = rng.pick(LEAF_TINTS.slice(1, 6)), k = rng.range(0.95, 1.1);
    sets.palmTrunk.add(x, y, z, rot, sc, null, tx, tz);
    sets.palmCrown.add(x, y, z, rot, sc, [c[0] * k, c[1] * k, c[2] * k], tx, tz);
  }

  const inPlay = (x, z, m = 0) => x > B.minX - m && x < B.maxX + m && z > B.minZ - m && z < B.maxZ + m;
  const blob = (x, z, sx, sz, rot, y, a) => addDecal(dc, sx === sz ? 'blob' : 'blobRect', x, z, sx, sz, rot, y, a);

  // one street light: pole at (x, z), arm pointing along "rot"
  function addStreetLight(kind, x, y, z, rot) {
    const set = kind === 0 ? sets.streetLight : kind === 1 ? sets.led1 : sets.led2;
    set.add(x, y, z, rot);
    const list = kind === 0 ? [mStreet.lampPos] : kind === 1 ? mLed1.lamps : mLed2.lamps;
    for (const lp of list) {
      const p = place(x, y, z, rot, lp[0], lp[1], lp[2]);
      lamps.push({ x: p[0], y: p[1], z: p[2], type: kind === 0 ? 0 : 1, size: kind === 0 ? 1.5 : 1.7 });
    }
    circles.push({ x, z, r: 0.2 });
  }

  // =============================================================================
  // 1. THINGS ALONG THE SIDEWALKS (walk around every block edge)
  // =============================================================================
  const poleRows = new Map(); // street z -> list of pole positions (for the wires)

  function placeEdge(block, e) {
    const neon = e.type === 'neon';
    const grid = block.district === 'grid';
    const len = e.len;
    const sw = e.sidewalk;
    const P = (s, o) => [e.a.x + e.dirX * s + e.inX * o, e.a.z + e.dirZ * s + e.inZ * o]; // o = meters in from the curb
    const toStreet = Math.atan2(-e.inX, -e.inZ);   // facing the road
    const toHouse = Math.atan2(e.inX, e.inZ);      // facing the buildings
    const taken = [[-1, 3.4], [len - 3.4, len + 1]]; // corners stay free (traffic lights, crossings)
    const noPark = [];
    const free = (s, r) => taken.every(([a, b]) => s + r < a || s - r > b);
    const take = (s, r) => taken.push([s - r, s + r]);
    const ground = curb;

    // ---- street lights: about every 30 m ----
    const n = Math.max(1, Math.round(len / 30));
    for (let i = 0; i < n; i++) {
      const s = ((i + 0.5) * len) / n;
      if (!free(s, 0.7)) continue;
      const p = P(s, 0.55);
      addStreetLight(neon ? 1 : 0, p[0], ground, p[1], toStreet);
      take(s, 0.9);
    }

    // ---- bus stop on some long edges ----
    if (!neon && e.type === 'street' && e.axis && len > 60 && rng.chance(0.3)) {
      const s = rng.range(0.32, 0.68) * len;
      if (free(s, 3.4)) {
        const p = P(s, sw - 0.6); // close to the houses: people walk past in front of it
        sets.busStop.add(p[0], ground, p[1], toStreet);
        take(s, 3.4);
        noPark.push([s - 10, s + 10]);
        for (const o of [-1.8, 0, 1.75]) {
          const q = P(s + o, sw - 0.3);
          circles.push({ x: q[0], z: q[1], r: 0.3 });
        }
        blob(p[0], p[1], 2.2, 4.2, toStreet + Math.PI / 2, ground + 0.012, 0.5);
      }
    }

    // ---- smart masts (antennas, cameras) on some east-west streets of The Grid ----
    if (grid && e.type === 'street' && e.axis === 'x' && e.inZ > 0.9 && block.row % 2 === 0) {
      for (const f of [0.25, 0.75]) {
        const s = len * f;
        if (!free(s, 0.5)) continue;
        const p = P(s, 0.45);
        sets.pole.add(p[0], ground, p[1], Math.PI / 2 + rng.range(-0.04, 0.04));
        take(s, 0.6);
        circles.push({ x: p[0], z: p[1], r: 0.2 });
        const key = Math.round(e.a.z);
        if (!poleRows.has(key)) poleRows.set(key, []);
        poleRows.get(key).push({ x: p[0], y: ground, z: p[1], inX: e.inX, inZ: e.inZ, reach: sw });
      }
    }

    // ---- fire hydrant ----
    if (rng.chance(0.5)) {
      const s = rng.chance(0.5) ? 5.6 : len - 5.6;
      if (free(s, 0.5)) {
        const p = P(s, 0.5);
        sets.hydrant.add(p[0], ground, p[1], toStreet, 1, lin(rng.pick(HYDRANT_COLORS)));
        take(s, 0.6);
        noPark.push([s - 3.6, s + 3.6]);
        circles.push({ x: p[0], z: p[1], r: 0.22 });
        blob(p[0], p[1], 0.7, 0.7, 0, ground + 0.012, 0.75);
      }
    }

    // ---- trees (The Grid) or palms (Neon Mile sidewalk) ----
    // (small street trees with iron grates in The Grid and The Crown, palms on Neon Mile)
    if (neon ? rng.chance(0.7) : rng.chance(0.85)) {
      for (let s = rng.range(6, 10); s < len - 6; s += neon ? rng.range(18, 26) : rng.range(10, 15)) {
        if (!free(s, 1.3)) continue;
        const p = P(s, neon ? 1.3 : 0.95);
        if (neon) addPalm(p[0], ground, p[1], rng.range(0.82, 1.1));
        else addTree(p[0], ground, p[1], 0.82);
        addDecal(dc, neon ? 'treePit' : 'grate', p[0], p[1], neon ? 1.3 : 1.5, neon ? 1.3 : 1.5, toStreet, ground + 0.013, 1);
        take(s, 1.3);
        circles.push({ x: p[0], z: p[1], r: 0.25 });
      }
    }

    // ---- trash bin near a corner ----
    for (const s of [rng.chance(0.85) ? (rng.chance(0.5) ? 4.3 : len - 4.3) + rng.range(-0.4, 0.4) : -1, len > 50 && rng.chance(0.5) ? len * rng.range(0.4, 0.6) : -1]) {
      if (s < 0) continue;
      if (free(s, 0.45)) {
        const p = P(s, 0.55);
        sets.bin.add(p[0], ground, p[1], rng.range(0, 6.28));
        take(s, 0.5);
        circles.push({ x: p[0], z: p[1], r: 0.32 });
        blob(p[0], p[1], 0.9, 0.9, 0, ground + 0.012, 0.7);
      }
    }

    // ---- bench ----
    for (let k = 0; k < 2; k++) {
      if (len < 24 || !rng.chance(neon ? 0.7 : 0.45)) continue;
      const s = rng.range(8, len - 8);
      if (free(s, 1.2)) {
        const p = P(s, 0.75);
        sets.bench.add(p[0], ground, p[1], toHouse);
        take(s, 1.2);
        circles.push({ x: p[0] - e.dirX * 0.5, z: p[1] - e.dirZ * 0.5, r: 0.4 });
        circles.push({ x: p[0] + e.dirX * 0.5, z: p[1] + e.dirZ * 0.5, r: 0.4 });
        blob(p[0], p[1], 0.9, 2.0, toStreet + Math.PI / 2, ground + 0.012, 0.6);
      }
    }

    // ---- street sign near the corner ----
    if (len > 20 && free(4.0, 0.3)) {
      const p = P(4.0, 0.5);
      sets.streetSign.add(p[0], ground, p[1], toStreet + rng.range(-0.06, 0.06));
      take(4.0, 0.35);
      circles.push({ x: p[0], z: p[1], r: 0.14 });
    }

    // ---- planters with bushes ----
    if (block.playable && rng.chance(neon ? 0.8 : 0.6)) {
      for (let s = rng.range(10, 16); s < len - 9; s += rng.range(9, 20)) {
        if (!free(s, 1.0)) continue;
        const p = P(s, 0.7);
        sets.planter.add(p[0], ground, p[1], e.inX, e.inZ);
        const sc = rng.range(1.0, 1.5);
        sets.shrub.add(p[0], ground + 0.5, p[1], 0, 1, sc, sc * rng.range(0.9, 1.2), sc);
        take(s, 1.0);
        circles.push({ x: p[0] - e.dirX * 0.35, z: p[1] - e.dirZ * 0.35, r: 0.42 }, { x: p[0] + e.dirX * 0.35, z: p[1] + e.dirZ * 0.35, r: 0.42 });
        blob(p[0], p[1], 1.2, 1.9, toStreet + Math.PI / 2, ground + 0.012, 0.6);
      }
    }

    // ---- bike rack with two parked bikes ----
    if (block.playable && len > 30 && rng.chance(0.4)) {
      const s = rng.range(9, len - 9);
      if (free(s, 2.0)) {
        const p = P(s, 0.62);
        sets.bikeRack.add(p[0], ground, p[1], Math.atan2(e.dirX, e.dirZ) + Math.PI / 2);
        take(s, 2.0);
        for (const o of [-1.2, -0.4, 0.4, 1.2]) circles.push({ x: p[0] + e.dirX * o, z: p[1] + e.dirZ * o, r: 0.42 });
        blob(p[0], p[1], 1.0, 3.8, toStreet + Math.PI / 2, ground + 0.012, 0.55);
      }
    }

    // ---- a second sign in the middle of the block (parking / charging rules) ----
    if (block.playable && len > 40 && rng.chance(0.55)) {
      const s = len * rng.range(0.35, 0.65);
      if (free(s, 0.3)) {
        const p = P(s, 0.5);
        sets.streetSign.add(p[0], ground, p[1], toStreet + Math.PI / 2 + rng.range(-0.06, 0.06));
        take(s, 0.35);
        circles.push({ x: p[0], z: p[1], r: 0.14 });
      }
    }

    // ---- a row of newspaper boxes ----
    if (block.playable && rng.chance(0.14)) {
      const s0 = rng.chance(0.5) ? rng.range(6.5, 9) : len - rng.range(6.5, 9);
      const n = rng.int(1, 3);
      if (free(s0, 0.4 + n * 0.3)) {
        for (let i = 0; i < n; i++) {
          const p = P(s0 + (i - (n - 1) / 2) * 0.56, 0.55);
          sets.newsBox.add(p[0], ground, p[1], toHouse + rng.range(-0.05, 0.05), 1, lin(rng.pick(NEWSBOX_COLORS)));
        }
        const c = P(s0, 0.55);
        circles.push({ x: c[0], z: c[1], r: 0.3 + n * 0.14 });
        take(s0, 0.4 + n * 0.3);
        blob(c[0], c[1], 0.9, 0.6 + n * 0.5, toStreet + Math.PI / 2, ground + 0.012, 0.6);
      }
    }

    // ---- parked cars at the curb (they face the driving direction) + EV chargers ----
    const fx = e.inZ, fz = -e.inX;          // driving direction on this side of the road
    const carRot = Math.atan2(fx, fz);
    const fill = neon ? 0.42 : e.type === 'avenue' ? 0.3 : 0.33;
    const metered = block.playable && !neon && rng.chance(0.4); // parking meters on some streets
    for (let s = 9; s + 5.6 < len - 8; s += 6.2) {
      const sc = s + 2.8;
      if (metered && free(s, 0.25)) {
        const q = P(s, 0.42);
        sets.meter.add(q[0], ground, q[1], toHouse);
        take(s, 0.25);
        circles.push({ x: q[0], z: q[1], r: 0.12 });
      }
      if (noPark.some(([a, b]) => sc > a && sc < b)) continue;
      if (rng.chance(fill)) {
        const r = rng.next();
        const kind = r < 0.55 ? 'sedan' : r < 0.85 ? 'suv' : 'van';
        const out = (kind === 'van' ? 1.36 : 1.26) + rng.range(-0.1, 0.1);
        const p = P(sc + rng.range(-0.3, 0.3), -out);
        const rot = carRot + rng.range(-0.035, 0.035);
        sets[kind].add(p[0], 0, p[1], rot, 1, lin(kind === 'van' && rng.chance(0.6) ? [0.8, 0.8, 0.78] : rng.pick(CAR_COLORS)));
        for (const o of [-1.45, 0, 1.45]) circles.push({ x: p[0] + fx * o, z: p[1] + fz * o, r: 1.0 });
        blob(p[0], p[1], kind === 'van' ? 2.5 : 2.3, kind === 'van' ? 5.9 : 5.2, rot, 0.021, 0.92);
        // oil drips under parked cars
        if (rng.chance(0.4)) addDecal(dc, 'oil2', p[0] + fx * 0.9, p[1] + fz * 0.9, 1.0, 1.0, rng.range(0, 6.28), 0.017, 0.7);
      }
      if (rng.chance(neon ? 0.4 : 0.35) && free(s + 5.9, 0.35)) {
        const q = P(s + 5.9, 0.42);
        sets.ev.add(q[0], ground, q[1], toStreet);
        take(s + 5.9, 0.4);
        circles.push({ x: q[0], z: q[1], r: 0.22 });
      }
    }
  }

  for (const block of L.blocks) {
    for (const e of blockEdges(block)) {
      if (e.type === 'alley') continue;
      const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
      if (!inPlay(mx, mz, 6)) continue;
      placeEdge(block, e);
    }
  }

  // =============================================================================
  // 2. CABLES across the alleys (thin sagging lines from wall to wall)
  // =============================================================================
  {
    const pts = [];
    // Find the building that stands at a point (for wires that end on a wall).
    const cellOf = (x, z) => Math.floor(x / 40) * 1000 + Math.floor(z / 40);
    const grid = new Map();
    for (const b of ctx.buildings) {
      if (!b.playable) continue;
      for (let cx = Math.floor(b.minX / 40); cx <= Math.floor(b.maxX / 40); cx++) {
        for (let cz = Math.floor(b.minZ / 40); cz <= Math.floor(b.maxZ / 40); cz++) {
          const k = cx * 1000 + cz;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(b);
        }
      }
    }
    const buildingAt = (x, z) => (grid.get(cellOf(x, z)) || []).find((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) || null;
    // one hanging wire from a to b ([x, y, z]); sag = how far it hangs down in the middle
    const hang = (a, b, sag, N = 6) => {
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N;
        pts.push(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - sag * 4 * t0 * (1 - t0), a[2] + (b[2] - a[2]) * t0);
        pts.push(a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - sag * 4 * t1 * (1 - t1), a[2] + (b[2] - a[2]) * t1);
      }
    };
    // across the alleys, from wall to wall
    for (const al of L.alleyRects) {
      const long = al.axis === 'x' ? al.maxX - al.minX : al.maxZ - al.minZ;
      for (let t = rng.range(5, 12); t < long - 4; t += rng.range(6, 14)) {
        const a = al.axis === 'x' ? [al.minX + t, al.minZ - 0.6] : [al.minX - 0.6, al.minZ + t];
        const b = al.axis === 'x' ? [al.minX + t + rng.range(-2, 2), al.maxZ + 0.6] : [al.maxX + 0.6, al.minZ + t + rng.range(-2, 2)];
        const ba = buildingAt(al.axis === 'x' ? a[0] : a[0] - 1.5, al.axis === 'x' ? a[1] - 1.5 : a[1]);
        const bb = buildingAt(al.axis === 'x' ? b[0] : b[0] + 1.5, al.axis === 'x' ? b[1] + 1.5 : b[1]);
        if (!ba || !bb) continue;
        const h = Math.min(ba.top, bb.top) - 0.5;
        if (h < 4.5) continue;
        const y = rng.range(4.2, Math.min(h, 10));
        hang([a[0], y, a[1]], [b[0], y + rng.range(-0.8, 0.8), b[1]], rng.range(0.2, 0.5), 5);
      }
    }
    if (pts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const wires = new THREE.LineSegments(g, mats.wire);
      wires.name = 'wires';
      wires.frustumCulled = false;
      ctx.group.add(wires);
    }
  }

  // =============================================================================
  // 3. TRAFFIC LIGHTS at the intersections
  // =============================================================================
  for (const it of L.intersections) {
    if (!it.signals) continue;
    const o = half + 0.6;
    // [dx, dz, rotation, group]  group 0 = north-south traffic, 1 = east-west traffic
    const poles = [
      [-o, o, 0, 0],               // for cars driving north (pole on the far right corner)
      [o, -o, Math.PI, 0],         // for cars driving south
      [-o, -o, -Math.PI / 2, 1],   // for cars driving east
      [o, o, Math.PI / 2, 1],      // for cars driving west
    ];
    for (const [dx, dz, rot, group] of poles) {
      const x = it.x + dx, z = it.z + dz;
      if (L.groundHeight(x, z) < curb * 0.5) continue; // no sidewalk corner here
      sets.traffic.add(x, curb, z, rot);
      circles.push({ x, z, r: 0.24 });
      for (const lamp of mTraffic.lamps) {
        const p = place(x, curb, z, rot, lamp.pos[0], lamp.pos[1], lamp.pos[2]);
        const index = bits.add(p[0], p[1], p[2], rot, 1, [0.02, 0.02, 0.02]);
        signalBits.push({ index, group, kind: lamp.kind });
      }
    }
  }

  // =============================================================================
  // 4. NEON MILE: palms on the median, lights, beach walk, lifeguard towers
  // =============================================================================
  {
    const N = L.neon;
    for (const [x0, x1] of L.medianPieces) {
      let k = 0;
      for (let x = x0 + 3.5; x < x1 - 3; x += 13, k++) {
        const z = N.centerZ + rng.range(-0.5, 0.5);
        addPalm(x, curb, z, rng.range(0.9, 1.25));
        addDecal(dc, 'treePit', x, z, 1.5, 1.5, 0, curb + 0.013, 1);
        circles.push({ x, z, r: 0.3 });
        if (k % 2 === 0 && x + 6.5 < x1 - 2) addStreetLight(2, x + 6.5, curb, N.centerZ, 0);
      }
    }
    // beach walk: palms, lights, benches that look at the sea, bins
    const pz = N.promenadeMinZ;
    for (let x = L.highway.maxX + 14; x < L.city.maxX + 60; x += 17) {
      addPalm(x, curb, pz + 1.3, rng.range(0.85, 1.15));
      addDecal(dc, 'treePit', x, pz + 1.3, 1.4, 1.4, 0, curb + 0.013, 1);
      circles.push({ x, z: pz + 1.3, r: 0.3 });
    }
    for (let x = L.highway.maxX + 22; x < L.city.maxX + 60; x += 30) addStreetLight(1, x, curb, N.promenadeMaxZ - 0.6, 0);
    for (let x = L.highway.maxX + 30; x < B.maxX; x += 26) {
      sets.bench.add(x, curb, pz + 0.9, Math.PI);
      circles.push({ x: x - 0.5, z: pz + 0.9, r: 0.4 }, { x: x + 0.5, z: pz + 0.9, r: 0.4 });
      if (rng.chance(0.5)) {
        sets.bin.add(x + 2.2, curb, pz + 0.9, 0);
        circles.push({ x: x + 2.2, z: pz + 0.9, r: 0.32 });
      }
    }
    for (const x of [-270, 40, 330]) {
      const z = L.beach.maxZ - 24;
      sets.lifeguard.add(x, L.beachHeight(z) - 0.05, z, 0);
      circles.push({ x, z, r: 1.9 });
      blob(x, z, 5, 5, 0, L.beachHeight(z) + 0.03, 0.6);
    }
  }

  // =============================================================================
  // 5. ALLEYS: dumpsters against the walls
  // =============================================================================
  for (const al of L.alleyRects) {
    const long = al.axis === 'x' ? al.maxX - al.minX : al.maxZ - al.minZ;
    for (let t = rng.range(8, 16); t < long - 6; t += rng.range(14, 26)) {
      const sideA = rng.chance(0.5);
      let x, z, rot;
      if (al.axis === 'x') { x = al.minX + t; z = sideA ? al.minZ + 0.2 : al.maxZ - 0.2; rot = sideA ? 0 : Math.PI; }
      else { z = al.minZ + t; x = sideA ? al.minX + 0.2 : al.maxX - 0.2; rot = sideA ? Math.PI / 2 : -Math.PI / 2; }
      sets.dumpster.add(x, 0, z, rot + rng.range(-0.06, 0.06), 1, lin(rng.pick(DUMPSTER_COLORS)));
      circles.push({ x, z, r: 1.0 });
      blob(x, z, 1.9, 2.6, rot + Math.PI / 2, 0.021, 0.85);
    }
    // puddles that never quite dry up
    for (let t = rng.range(3, 9); t < long - 3; t += rng.range(6, 15)) {
      const o = rng.range(-1.3, 1.3);
      const x = al.axis === 'x' ? al.minX + t : (al.minX + al.maxX) / 2 + o;
      const z = al.axis === 'x' ? (al.minZ + al.maxZ) / 2 + o : al.minZ + t;
      addDecal(ctx.mb.puddle, rng.pick(['oil1', 'blob', 'oil2']), x, z, rng.range(1.4, 3.2), rng.range(1.2, 2.6), rng.range(0, 6.28), 0.019, rng.range(0.75, 1));
    }
  }

  // cars in the parking lots and the lamps that light them
  for (const c of ctx.parked) {
    const r = rng.next();
    const kind = r < 0.55 ? 'sedan' : r < 0.85 ? 'suv' : 'van';
    sets[kind].add(c.x, curb + 0.03, c.z, c.rot, 1, lin(rng.pick(CAR_COLORS)));
    const fx = Math.sin(c.rot), fz = Math.cos(c.rot);
    for (const o of [-1.45, 0, 1.45]) circles.push({ x: c.x + fx * o, z: c.z + fz * o, r: 1.0 });
    blob(c.x, c.z, 2.3, 5.2, c.rot, curb + 0.05, 0.9);
  }
  for (const l of ctx.lotLamps) addStreetLight(1, l.x, curb, l.z, l.rot);

  // trees on roofs and terraces, in gardens and plazas (collected by the building kit)
  for (const t of ctx.roofTrees) {
    // on high roofs only the crown is drawn: it stands lower, so no bare trunk floats there
    addTree(t.x, t.y, t.z, t.s, { trunk: !!t.trunk });
    if (t.pit) addDecal(dc, 'treePit', t.x, t.z, 1.3, 1.3, 0, t.y + 0.013, 1);
  }
  // EV charging posts in front of buildings
  for (const e of ctx.evPosts) {
    sets.ev.add(e.x, curb, e.z, e.rot);
    circles.push({ x: e.x, z: e.z, r: 0.22 });
  }

  // =============================================================================
  // 6. BARRIERS where the streets leave the play area
  // =============================================================================
  {
    const row = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / 3.3));
      const rot = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        sets.barrier.add(x0 + (x1 - x0) * t, L.groundHeight(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t), z0 + (z1 - z0) * t, rot + rng.range(-0.05, 0.05));
      }
      ctx.colliders.boxes.push({ minX: Math.min(x0, x1) - 0.4, maxX: Math.max(x0, x1) + 0.4, minZ: Math.min(z0, z1) - 0.4, maxZ: Math.max(z0, z1) + 0.4, h: 1.2 });
    };
    const wx = B.maxX - 1.0, nz = B.maxZ - 1.0;
    for (const ew of L.streetsEW) if (ew.playable) row(wx, ew.center - half, wx, ew.center + half);
    for (const ns of L.streetsNS) if (ns.playable) row(ns.center - half, nz, ns.center + half, nz);
    row(wx, L.neon.roadMinZ, wx, L.neon.roadMaxZ);          // Neon Mile, west end
    row(wx, L.neon.promenadeMinZ, wx, L.neon.promenadeMaxZ); // beach walk, west end
    // the highway ramp is closed (it cannot be used yet)
    row(L.highway.minX + 1.2, L.highway.rampBottomZ - 1.5, L.highway.maxX - 1.2, L.highway.rampBottomZ - 1.5);
  }

  // =============================================================================
  // 7. DRONES (animated every frame)
  // =============================================================================
  const drones = [];
  const playStreets = L.streetsNS.filter((s) => s.playable).concat(L.streetsEW.filter((s) => s.playable));
  const DRONES = 30; // small delivery drones with a parcel
  for (let i = 0; i < DRONES; i++) {
    const st = rng.pick(playStreets);
    const t = st.axis === 'ns' ? rng.range(-300, 460) : rng.range(-430, 440);
    drones.push({
      axis: st.axis, c: st.center + rng.range(-3, 3), t,
      y: rng.range(8, 26), range: rng.range(25, 70), speed: rng.range(0.05, 0.12), phase: rng.range(0, 6.28),
    });
  }
  const droneMesh = new THREE.InstancedMesh(M.makeDrone(), mats.prop, DRONES);
  droneMesh.name = 'drones';
  droneMesh.frustumCulled = false;
  droneMesh.castShadow = false;
  droneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.group.add(droneMesh);

  // ---- finish: create all instanced meshes ----
  for (const s of Object.values(sets)) s.finish(ctx.group);
  const lampGlow = makeLampGlow(lamps, ctx.tex.glow);
  ctx.group.add(lampGlow);

  // ---------------------------------------------------------------------------
  // Things that change over time
  // ---------------------------------------------------------------------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1.6, 1.6, 1.6);
  const LIT = { red: [2.4, 0.12, 0.06], yellow: [2.3, 1.3, 0.1], green: [0.15, 2.2, 0.9] };
  const DARK = [0.025, 0.025, 0.025];
  let lastPhase = -1;
  let cullX = 1e9, cullZ = 1e9, cullMul = 1;

  function updateSignals(time) {
    // 40 second cycle: north-south green, yellow, all red, east-west green, yellow, all red
    const t = time % 40;
    const phase = t < 16 ? 0 : t < 19 ? 1 : t < 20 ? 2 : t < 36 ? 3 : t < 39 ? 4 : 5;
    if (phase === lastPhase || !bits.mesh) return false;
    lastPhase = phase;
    const state = [phase === 0 ? 'green' : phase === 1 ? 'yellow' : 'red', phase === 3 ? 'green' : phase === 4 ? 'yellow' : 'red'];
    for (const b of signalBits) {
      const c = b.kind === state[b.group] ? LIT[b.kind] : DARK;
      bits.allColors[b.index * 3] = c[0]; bits.allColors[b.index * 3 + 1] = c[1]; bits.allColors[b.index * 3 + 2] = c[2];
    }
    return true;
  }

  function cull(x, z, mul, force = false) {
    cullX = x; cullZ = z; cullMul = mul;
    for (const s of Object.values(sets)) s.cull(x, z, mul, force);
  }
  // LOW quality: no fins, no plants on facades, no 3D windows (the shaders paint lines instead)
  function setDetail(on) {
    for (const s of Object.values(sets)) if (s.group === 'window' || s.group === 'plants') s.setEnabled(on);
    cull(cullX > 1e8 ? 0 : cullX, cullZ > 1e8 ? 0 : cullZ, cullMul, true);
  }

  function update(dt, time, x, z, mul) {
    // re-pick the visible copies when the player has moved a bit
    const moved = (x - cullX) ** 2 + (z - cullZ) ** 2 > 8 * 8 || mul !== cullMul;
    if (moved) cull(x, z, mul);
    if (updateSignals(time) && !moved) bits.cull(cullX, cullZ, cullMul, true);
    // traffic lamps are brighter at night
    bitMat.color.setScalar(1 + 1.6 * shared.uPgNight.value);

    // drones fly slowly back and forth along their street, bobbing a little
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      const a = time * d.speed + d.phase;
      const along = d.t + Math.sin(a) * d.range;
      const side = d.c + Math.sin(a * 2.3 + d.phase) * 1.5;
      const dir = Math.cos(a) >= 0 ? 0 : Math.PI;
      _p.set(d.axis === 'ns' ? side : along, d.y + Math.sin(time * 1.7 + d.phase) * 0.25, d.axis === 'ns' ? along : side);
      _e.set(Math.cos(a) * 0.12, d.axis === 'ns' ? dir : dir + Math.PI / 2, Math.sin(time * 2.1 + d.phase) * 0.05, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p, _q, _s);
      droneMesh.setMatrixAt(i, _m);
    }
    droneMesh.instanceMatrix.needsUpdate = true;
  }

  // The glow sprites need to know how big a pixel is.
  function setViewport(fovDeg, heightPx) {
    lampGlow.material.uniforms.uPixel.value = (2 * Math.tan((fovDeg * Math.PI) / 360)) / heightPx;
  }

  return { sets, lampGlow, cull, update, setViewport, setDetail };
}
