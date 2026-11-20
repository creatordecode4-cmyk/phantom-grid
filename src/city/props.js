// ---------------------------------------------------------------------------
// props.js - puts all the small things into the city:
// street lights, traffic lights, trees, palms, bins, benches, bus stops,
// hydrants, power poles with wires, parked cars, EV chargers, drones,
// roof equipment, fire escapes, barriers at the edge of the map ...
//
// Each kind of prop is ONE instanced mesh (one draw call for all copies).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { InstancedSet } from '../utils/geometry.js';
import { blockEdges, addDecal } from './ground.js';
import * as M from './models.js';
import { signUV, SIGN_COLS, SIGN_ROWS, NEON_FIRST_ROW, HOLO_COUNT } from './textures.js';
import { shared } from './materials.js';

// Car paint colors (screen colors). Common colors appear more often.
const CAR_COLORS = [
  [0.82, 0.82, 0.8], [0.82, 0.82, 0.8], [0.6, 0.61, 0.62], [0.6, 0.61, 0.62], [0.3, 0.31, 0.33], [0.3, 0.31, 0.33],
  [0.05, 0.05, 0.055], [0.05, 0.05, 0.055], [0.08, 0.13, 0.26], [0.45, 0.07, 0.06], [0.52, 0.47, 0.38],
  [0.09, 0.18, 0.13], [0.42, 0.52, 0.6], [0.36, 0.22, 0.12], [0.7, 0.66, 0.5],
];
const HYDRANT_COLORS = [[0.78, 0.6, 0.1], [0.78, 0.6, 0.1], [0.6, 0.1, 0.07]];
const DUMPSTER_COLORS = [[0.1, 0.22, 0.14], [0.12, 0.2, 0.36], [0.3, 0.3, 0.3], [0.35, 0.16, 0.1]];

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
  const mStreet = M.makeStreetLight();
  const mLed1 = M.makeLedLight(1);
  const mLed2 = M.makeLedLight(2);
  const mTraffic = M.makeTrafficLight();
  const mPole = M.makePowerPole();
  const mTree = M.makeTree(11);
  const mPalm = M.makePalm(12);

  const sets = {};
  const S = (name, geom, mat, opts) => (sets[name] = new InstancedSet(name, geom, mat, opts));
  S('streetLight', mStreet.geometry, mats.prop, { maxDistance: 430 });
  S('led1', mLed1.geometry, mats.prop, { maxDistance: 500 });
  S('led2', mLed2.geometry, mats.prop, { maxDistance: 600 });
  S('traffic', mTraffic.geometry, mats.prop, { maxDistance: 300 });
  S('pole', mPole.geometry, mats.prop, { maxDistance: 380 });
  S('treeTrunk', mTree.trunk, mats.prop, { maxDistance: 480 });
  S('treeCrown', mTree.crown, mats.leaf, { maxDistance: 480 });
  S('palmTrunk', mPalm.trunk, mats.prop, { maxDistance: 850 });
  S('palmCrown', mPalm.crown, mats.frond, { maxDistance: 850 });
  S('hydrant', M.makeHydrant(), mats.prop, { maxDistance: 95, useColor: true });
  S('bin', M.makeTrashBin(), mats.prop, { maxDistance: 105 });
  S('bench', M.makeBench(), mats.prop, { maxDistance: 120 });
  S('busStop', M.makeBusStop(), mats.prop, { maxDistance: 230 });
  S('ev', M.makeEvPost(), mats.prop, { maxDistance: 110 });
  S('dumpster', M.makeDumpster(), mats.prop, { maxDistance: 130, useColor: true });
  S('barrier', M.makeBarrier(), mats.prop, { maxDistance: 320 });
  S('sedan', M.makeCar('sedan'), mats.prop, { maxDistance: 200, useColor: true });
  S('suv', M.makeCar('suv'), mats.prop, { maxDistance: 200, useColor: true });
  S('van', M.makeCar('van'), mats.prop, { maxDistance: 200, useColor: true });
  S('roofAC', M.makeRoofAC(), mats.prop, { maxDistance: 230, castShadow: false });
  S('tank', M.makeWaterTank(), mats.prop, { maxDistance: 620 });
  S('solar', M.makeSolarPanels(), mats.prop, { maxDistance: 260, castShadow: false });
  S('winAC', M.makeWindowAC(), mats.prop, { maxDistance: 115, castShadow: false });
  S('fireEscape', M.makeFireEscape(true), mats.prop, { maxDistance: 150, castShadow: false });
  S('fireEscapeTop', M.makeFireEscape(false), mats.prop, { maxDistance: 150, castShadow: false });
  S('lifeguard', M.makeLifeguardTower(), mats.prop, { maxDistance: 700 });

  // lamps of the traffic lights: tiny glowing balls with their own color
  const bitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bits = S('signalLamp', new THREE.SphereGeometry(0.105, 7, 5), bitMat, { maxDistance: 280, useColor: true, castShadow: false, receiveShadow: false });
  const signalBits = []; // { index, group: 0 north-south / 1 east-west, kind }

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
    if (grid && e.type === 'street' && e.axis && len > 70 && rng.chance(0.15)) {
      const s = rng.range(0.32, 0.68) * len;
      if (free(s, 3.4)) {
        const p = P(s, sw - 0.95);
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

    // ---- wooden power poles on some east-west streets of The Grid ----
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
        poleRows.get(key).push({ x: p[0], y: ground, z: p[1] });
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
    if (neon ? rng.chance(0.7) : grid && rng.chance(0.55)) {
      for (let s = rng.range(6, 10); s < len - 6; s += neon ? rng.range(18, 26) : rng.range(11, 17)) {
        if (!free(s, 1.3)) continue;
        const p = P(s, neon ? 1.3 : 0.95);
        const rot = rng.range(0, 6.28);
        if (neon) {
          const sc = rng.range(0.82, 1.1);
          sets.palmTrunk.add(p[0], ground, p[1], rot, sc);
          sets.palmCrown.add(p[0], ground, p[1], rot, sc);
        } else {
          const sc = rng.range(0.8, 1.25);
          sets.treeTrunk.add(p[0], ground, p[1], rot, sc);
          sets.treeCrown.add(p[0], ground, p[1], rot, sc);
        }
        addDecal(dc, 'treePit', p[0], p[1], 1.3, 1.3, toStreet, ground + 0.013, 1);
        take(s, 1.3);
        circles.push({ x: p[0], z: p[1], r: 0.25 });
      }
    }

    // ---- trash bin near a corner ----
    if (rng.chance(0.6)) {
      const s = (rng.chance(0.5) ? 4.3 : len - 4.3) + rng.range(-0.4, 0.4);
      if (free(s, 0.45)) {
        const p = P(s, 0.55);
        sets.bin.add(p[0], ground, p[1], rng.range(0, 6.28));
        take(s, 0.5);
        circles.push({ x: p[0], z: p[1], r: 0.32 });
        blob(p[0], p[1], 0.9, 0.9, 0, ground + 0.012, 0.7);
      }
    }

    // ---- bench ----
    if (rng.chance(neon ? 0.4 : 0.16)) {
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

    // ---- parked cars at the curb (they face the driving direction) + EV chargers ----
    const fx = e.inZ, fz = -e.inX;          // driving direction on this side of the road
    const carRot = Math.atan2(fx, fz);
    const fill = neon ? 0.42 : e.type === 'avenue' ? 0.3 : 0.33;
    for (let s = 9; s + 5.6 < len - 8; s += 6.2) {
      const sc = s + 2.8;
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
      if (rng.chance(neon ? 0.3 : 0.09) && free(s + 5.9, 0.35)) {
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
  // 2. WIRES between the power poles (thin sagging lines)
  // =============================================================================
  {
    const pts = [];
    for (const row of poleRows.values()) {
      row.sort((p, q) => p.x - q.x);
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i], b = row[i + 1];
        const d = Math.abs(b.x - a.x);
        if (d > 75) continue;
        for (const wp of mPole.wirePoints) {
          // the poles are turned 90 degrees, so the cross arm runs along z
          const z0 = a.z - wp[0], z1 = b.z - wp[0];
          const sag = d * rng.range(0.012, 0.02) + (wp[1] < 7 ? 0.25 : 0);
          const N = 8;
          for (let k = 0; k < N; k++) {
            const t0 = k / N, t1 = (k + 1) / N;
            pts.push(a.x + (b.x - a.x) * t0, a.y + wp[1] - sag * 4 * t0 * (1 - t0), z0 + (z1 - z0) * t0);
            pts.push(a.x + (b.x - a.x) * t1, a.y + wp[1] - sag * 4 * t1 * (1 - t1), z0 + (z1 - z0) * t1);
          }
        }
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
        const index = bits.add(p[0], p[1], p[2], 0, 1, [0.02, 0.02, 0.02]);
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
        const rot = rng.range(0, 6.28), sc = rng.range(0.9, 1.25);
        sets.palmTrunk.add(x, curb, z, rot, sc);
        sets.palmCrown.add(x, curb, z, rot, sc);
        addDecal(dc, 'treePit', x, z, 1.5, 1.5, 0, curb + 0.013, 1);
        circles.push({ x, z, r: 0.3 });
        if (k % 2 === 0 && x + 6.5 < x1 - 2) addStreetLight(2, x + 6.5, curb, N.centerZ, 0);
      }
    }
    // beach walk: palms, lights, benches that look at the sea, bins
    const pz = N.promenadeMinZ;
    for (let x = L.highway.maxX + 14; x < L.city.maxX + 60; x += 17) {
      const rot = rng.range(0, 6.28), sc = rng.range(0.85, 1.15);
      sets.palmTrunk.add(x, curb, pz + 1.3, rot, sc);
      sets.palmCrown.add(x, curb, pz + 1.3, rot, sc);
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
  }

  // =============================================================================
  // 7. ROOFS, FIRE ESCAPES, WINDOW AIR CONDITIONERS
  // =============================================================================
  const holoMb = ctx.mb.holo;
  for (const b of ctx.buildings) {
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const near = inPlay((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 120);
    if (!near) continue;
    const r = rng.fork();
    const roofY = b.top;
    // air conditioning units
    const acs = r.int(0, 3);
    for (let i = 0; i < acs && w > 5 && d > 5; i++) {
      sets.roofAC.add(r.range(b.minX + 1.6, b.maxX - 1.6), roofY, r.range(b.minZ + 1.6, b.maxZ - 1.6), r.int(0, 3) * Math.PI / 2);
    }
    // wooden water tank on older, taller houses
    if (!b.neonStyle && b.floors >= 4 && w > 7 && d > 7 && r.chance(0.3)) {
      sets.tank.add(r.range(b.minX + 2.6, b.maxX - 2.6), roofY, r.range(b.minZ + 2.6, b.maxZ - 2.6), r.range(0, 6.28));
    }
    // solar panels, facing the midday sun in the south
    if (w > 8 && d > 6 && r.chance(0.26)) {
      sets.solar.add((b.minX + b.maxX) / 2 + r.range(-1, 1), roofY, (b.minZ + b.maxZ) / 2 + r.range(-1, 1), Math.PI);
    }
    if (!b.playable) continue;

    // fire escape on some brick houses
    if (b.brick && b.floors >= 3 && r.chance(0.36)) {
      const options = ['N', 'S', 'E', 'W'].filter((s) => (b.sides[s].kind === 'front' || b.sides[s].kind === 'back') && b.sides[s].len > 7);
      if (options.length) {
        const info = b.sides[r.pick(options)];
        const f = info.frame;
        const bay = r.int(0, info.bays - 1);
        const s = ((bay + 0.5) * f.len) / info.bays;
        const rot = Math.atan2(f.nx, f.nz);
        const x = f.ox + f.dx * s + f.nx * 0.03, z = f.oz + f.dz * s + f.nz * 0.03;
        for (let k = 1; k < b.floors; k++) {
          const y = b.groundH + (k - 1) * 3.5 + 0.55;
          (k < b.floors - 1 ? sets.fireEscape : sets.fireEscapeTop).add(x, y, z, rot);
        }
      }
    }
    // air conditioners hanging in a few windows
    if (!b.neonStyle) {
      for (const sName of ['N', 'S', 'E', 'W']) {
        const info = b.sides[sName];
        if (info.kind !== 'front' && info.kind !== 'back') continue;
        const f = info.frame, bw = f.len / info.bays;
        for (let k = 1; k < b.floors; k++) {
          for (let i = 0; i < info.bays; i++) {
            if (!r.chance(0.06)) continue;
            const s = (i + 0.36) * bw;
            const y = b.groundH + (k - 1) * 3.5 + 0.25 * 3.5 + 0.2;
            sets.winAC.add(f.ox + f.dx * s + f.nx * 0.02, y, f.oz + f.dz * s + f.nz * 0.02, Math.atan2(f.nx, f.nz));
          }
        }
      }
    }
    // Neon Mile: a big glowing roof sign or a hologram on some houses
    if (b.neonStyle && b.sides.S.kind === 'front') {
      const f = b.sides.S.frame;
      const roll = r.next();
      if (roll < 0.34 && f.len > 9) {
        const idx = SIGN_COLS * NEON_FIRST_ROW + r.int(0, SIGN_COLS * (SIGN_ROWS - NEON_FIRST_ROW) - 1);
        const uv = signUV(idx);
        const sw = Math.min(f.len - 1.5, 8), sh = sw / 4, y0 = b.top + b.parapet + 0.5;
        const c = f.len / 2;
        const P = (s, y, o) => [f.ox + f.dx * s + f.nx * o, y, f.oz + f.dz * s + f.nz * o];
        ctx.mb.sign.color(1, 1, 1, 1).data(1.0, 0, 0, 0);
        ctx.mb.sign.quad(P(c - sw / 2, y0, -0.4), P(c + sw / 2, y0, -0.4), P(c + sw / 2, y0 + sh, -0.4), P(c - sw / 2, y0 + sh, -0.4),
          [f.nx, 0, f.nz], [uv.u0, uv.v0], [uv.u1, uv.v0], [uv.u1, uv.v1], [uv.u0, uv.v1]);
        // dark back side and two posts
        const ps = ctx.mb.propStatic;
        ps.color(0.02, 0.02, 0.022, 1).data(0.7, 0.3, 0, 0);
        ps.quadAuto(P(c + sw / 2, y0, -0.46), P(c - sw / 2, y0, -0.46), P(c - sw / 2, y0 + sh, -0.46), P(c + sw / 2, y0 + sh, -0.46), [-f.nx, 0, -f.nz]);
        for (const o of [-sw * 0.32, sw * 0.32]) {
          const p = P(c + o, 0, -0.5);
          ps.box(p[0] - 0.06, b.top, p[2] - 0.06, p[0] + 0.06, y0 + sh * 0.5, p[2] + 0.06, 1, 'nsew');
        }
        const lp = P(c, 0, 2.5);
        ctx.shopLights.push({ x: lp[0], z: lp[2], r: 9, power: 0.2 });
      } else if (roll < 0.52 && f.len > 7) {
        // hologram: a tall glowing panel floating above the roof
        const k = r.int(0, HOLO_COUNT - 1);
        const hw = 2.6, hh = 5.2, y0 = b.top + b.parapet + 1.4, c = f.len / 2;
        const P = (s, y) => [f.ox + f.dx * s + f.nx * -1.2, y, f.oz + f.dz * s + f.nz * -1.2];
        const u0 = k / HOLO_COUNT, u1 = (k + 1) / HOLO_COUNT;
        const v = (px, py, lu, lv, uu, vv) => { holoMb.color(lu, lv, 0, 1); return holoMb.vertex(px[0], px[1], px[2], f.nx, 0, f.nz, uu, vv); };
        const i0 = v(P(c - hw, y0), 0, 0, 0, u0, 0), i1 = v(P(c + hw, y0), 0, 1, 0, u1, 0);
        const i2 = v(P(c + hw, y0 + hh * 2), 0, 1, 1, u1, 1), i3 = v(P(c - hw, y0 + hh * 2), 0, 0, 1, u0, 1);
        holoMb.quadIdx(i0, i1, i2, i3);
        // projector box on the roof
        const ps = ctx.mb.propStatic;
        const p = P(c, 0);
        ps.color(0.03, 0.03, 0.035, 1).data(0.4, 0.6, 0, 0);
        ps.box(p[0] - 0.7, b.top, p[2] - 0.4, p[0] + 0.7, b.top + b.parapet + 0.5, p[2] + 0.4, 1, 'nsewt');
        ps.color(0.02, 0.2, 0.25, 1).data(0.3, 0, 0, 1.4);
        ps.box(p[0] - 0.6, b.top + b.parapet + 0.5, p[2] - 0.08, p[0] + 0.6, b.top + b.parapet + 0.56, p[2] + 0.08, 1, 'nsewt');
      }
    }
  }
  // =============================================================================
  // 8. DRONES (animated every frame)
  // =============================================================================
  const drones = [];
  const playStreets = L.streetsNS.filter((s) => s.playable).concat(L.streetsEW.filter((s) => s.playable));
  const DRONES = 16;
  for (let i = 0; i < DRONES; i++) {
    const st = rng.pick(playStreets);
    const t = st.axis === 'ns' ? rng.range(-300, 460) : rng.range(-430, 440);
    drones.push({
      axis: st.axis, c: st.center + rng.range(-3, 3), t,
      y: rng.range(13, 30), range: rng.range(25, 70), speed: rng.range(0.05, 0.12), phase: rng.range(0, 6.28),
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
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
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

  function update(dt, time, x, z, mul) {
    // re-pick the visible copies when the player has moved a bit
    const moved = (x - cullX) ** 2 + (z - cullZ) ** 2 > 12 * 12 || mul !== cullMul;
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

  return { sets, lampGlow, cull, update, setViewport };
}
