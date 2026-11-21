// ---------------------------------------------------------------------------
// effects.js - the small things around vehicles. Everything is POOLED: a fixed
// number of slots that are used again and again, so nothing is created while
// you drive and the cost stays the same.
//
//   particles   tire smoke, dust, water spray, exhaust puffs, debris (soft,
//               see-through) and sparks, flames (glowing)        2 draw calls
//   skid marks  dark strips on the road that fade slowly; the white foam
//               behind the boat uses the same strips              1 draw call
//   glow        the light dots of ALL cars: headlights, tail lights, brake
//               lights, indicators, police lights                 1 draw call
// ---------------------------------------------------------------------------

import * as THREE from 'three';

// what every kind of particle looks like:
//   life (s), size at start / end (m), color, see-through, gravity (m/s2, + = falls), drag
const KINDS = {
  smoke: { life: 1.5, s0: 0.5, s1: 2.4, col: [0.82, 0.82, 0.82], a: 0.34, g: -0.7, drag: 1.4 },
  dust: { life: 1.3, s0: 0.5, s1: 2.2, col: [0.72, 0.62, 0.45], a: 0.36, g: -0.3, drag: 1.6 },
  spray: { life: 0.7, s0: 0.3, s1: 1.4, col: [0.8, 0.86, 0.9], a: 0.3, g: 2.5, drag: 1.0 },
  exhaust: { life: 0.9, s0: 0.18, s1: 0.9, col: [0.4, 0.4, 0.42], a: 0.3, g: -0.9, drag: 2 },
  hood: { life: 2.2, s0: 0.4, s1: 2.6, col: [0.16, 0.16, 0.17], a: 0.45, g: -1.6, drag: 0.8 },
  debris: { life: 1.1, s0: 0.12, s1: 0.1, col: [0.1, 0.1, 0.11], a: 0.95, g: 9, drag: 0.3 },
  foam: { life: 1.6, s0: 0.6, s1: 2.6, col: [0.92, 0.96, 0.97], a: 0.5, g: 3, drag: 1.2 },
  spark: { life: 0.45, s0: 0.11, s1: 0.03, col: [3.2, 1.9, 0.6], a: 1, g: 8, drag: 0.5, glow: true },
  flame: { life: 0.22, s0: 0.42, s1: 0.1, col: [1.6, 2.4, 4.5], a: 1, g: 0, drag: 2, glow: true },
};

function makePoints(max, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vCol;
      void main() {
        vCol = aColor;
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mv;
        // size in meters -> pixels (far away = smaller), never huge right in front of the camera
        gl_PointSize = min( aSize * uScale / max( - mv.z, 0.3 ), 420.0 );
      }`,
    fragmentShader: /* glsl */ `
      varying vec4 vCol;
      void main() {
        float d = length( gl_PointCoord - 0.5 ) * 2.0;
        float a = smoothstep( 1.0, 0.25, d ) * vCol.a;     // soft round dot
        if ( a < 0.004 ) discard;
        gl_FragColor = vec4( vCol.rgb, a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, pos, col, size, geo, mat };
}

export function createEffects(scene) {
  // ======================================================================= particles
  const MAX = 260;
  const soft = makePoints(MAX, false), hot = makePoints(120, true);
  soft.points.renderOrder = 21; hot.points.renderOrder = 22;
  scene.add(soft.points, hot.points);
  const pool = { soft: [], hot: [] };
  for (let i = 0; i < MAX; i++) pool.soft.push({ t: 0, life: 0 });
  for (let i = 0; i < 120; i++) pool.hot.push({ t: 0, life: 0 });
  let nextSoft = 0, nextHot = 0;

  // one new particle. kind: see KINDS. (vx, vy, vz): how it flies. scale: bigger / smaller
  function emit(kind, x, y, z, vx = 0, vy = 0, vz = 0, scale = 1) {
    const K = KINDS[kind];
    const list = K.glow ? pool.hot : pool.soft;
    const i = K.glow ? (nextHot = (nextHot + 1) % list.length) : (nextSoft = (nextSoft + 1) % list.length);
    Object.assign(list[i], { K, t: 0, life: K.life * (0.7 + Math.random() * 0.6), x, y, z, vx, vy, vz, scale });
  }

  function updateParticles(dt) {
    for (const [list, P] of [[pool.soft, soft], [pool.hot, hot]]) {
      let n = 0;
      for (const p of list) {
        if (p.life <= 0) continue;
        p.t += dt;
        if (p.t >= p.life) { p.life = 0; continue; }
        const K = p.K, k = p.t / p.life;
        p.vy -= K.g * dt;
        const drag = Math.exp(-K.drag * dt);
        p.vx *= drag; p.vz *= drag; p.vy *= K.g > 5 ? 1 : drag;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.03 && K.g > 5) { p.y = 0.03; p.vy *= -0.3; }   // heavy bits bounce on the road
        P.pos[n * 3] = p.x; P.pos[n * 3 + 1] = p.y; P.pos[n * 3 + 2] = p.z;
        P.col[n * 4] = K.col[0]; P.col[n * 4 + 1] = K.col[1]; P.col[n * 4 + 2] = K.col[2];
        P.col[n * 4 + 3] = K.a * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);      // fade in quickly, out slowly
        P.size[n] = (K.s0 + (K.s1 - K.s0) * k) * p.scale;
        n++;
      }
      P.geo.setDrawRange(0, n);
      P.geo.attributes.position.needsUpdate = true; P.geo.attributes.aColor.needsUpdate = true; P.geo.attributes.aSize.needsUpdate = true;
    }
  }

  // ======================================================================= skid marks
  const STRIPS = 520;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(STRIPS * 4 * 3), sCol = new Float32Array(STRIPS * 4 * 4), sIdx = new Uint16Array(STRIPS * 6);
  for (let i = 0; i < STRIPS; i++) sIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  sGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 4).setUsage(THREE.DynamicDrawUsage));
  sGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const skids = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -9 }));
  skids.frustumCulled = false;
  skids.renderOrder = 11;
  scene.add(skids);
  const strips = [];
  for (let i = 0; i < STRIPS; i++) strips.push({ life: 0, t: 0, a: 0 });
  let nextStrip = 0, fadeTimer = 0;

  // one piece of a mark from (x0, z0) to (x1, z1). color: [r, g, b], alpha: how dark, life: seconds until gone
  function addStrip(x0, z0, x1, z1, y, width, color, alpha, life) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < 0.02 || len > 6) return;
    const nx = (-dz / len) * width / 2, nz = (dx / len) * width / 2;
    const i = (nextStrip = (nextStrip + 1) % STRIPS), o = i * 12;
    sPos.set([x0 - nx, y, z0 - nz, x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz], o);
    Object.assign(strips[i], { life, t: 0, a: alpha });
    for (let k = 0; k < 4; k++) sCol.set([color[0], color[1], color[2], alpha], i * 16 + k * 4);
    sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
  }
  function updateStrips(dt) {
    fadeTimer += dt;
    for (const s of strips) if (s.life > 0) s.t += dt;
    if (fadeTimer < 0.25) return;       // fading is slow: a few times a second is enough
    fadeTimer = 0;
    for (let i = 0; i < STRIPS; i++) {
      const s = strips[i];
      if (s.life <= 0) continue;
      const k = s.t / s.life;
      const a = k >= 1 ? 0 : s.a * Math.min(1, (1 - k) * 2.5);
      if (k >= 1) s.life = 0;
      for (let q = 0; q < 4; q++) sCol[i * 16 + q * 4 + 3] = a;
    }
    sGeo.attributes.color.needsUpdate = true;
  }

  // ======================================================================= light dots of the cars
  const GLOWS = 360;
  const glow = makePoints(GLOWS, true);
  glow.points.renderOrder = 23;
  scene.add(glow.points);
  let nGlow = 0;
  // call every frame for every lamp that is on. size in meters, color may be brighter than 1.
  function lamp(x, y, z, r, g, b, size) {
    if (nGlow >= GLOWS) return;
    glow.pos[nGlow * 3] = x; glow.pos[nGlow * 3 + 1] = y; glow.pos[nGlow * 3 + 2] = z;
    glow.col[nGlow * 4] = r; glow.col[nGlow * 4 + 1] = g; glow.col[nGlow * 4 + 2] = b; glow.col[nGlow * 4 + 3] = 1;
    glow.size[nGlow] = size;
    nGlow++;
  }
  // The lamps of one car. (x, y, z, heading) = the car, hw = half its width, front / back = its ends.
  //   head: 0 off, 1 low beam, 2 high beam;  tail: 0..1;  brake, reverse: on / off;  blink: -1 left, 1 right, 2 both, 0 none
  function carLamps(x, y, z, heading, hw, frontZ, backZ, lampY, o) {
    const fx = Math.sin(heading), fz = Math.cos(heading), lx = fz, lz = -fx; // left of the car
    for (const s of [1, -1]) {
      const px = x + lx * hw * 0.72 * s, pz = z + lz * hw * 0.72 * s;
      if (o.head) lamp(px + fx * (frontZ + 0.04), y + lampY, pz + fz * (frontZ + 0.04), 1.5 * o.head, 1.45 * o.head, 1.25 * o.head, o.head > 1 ? 0.95 : 0.62);
      const red = o.brake ? 3.2 : o.tail * 0.9;
      if (red > 0.02) lamp(px - fx * (-backZ + 0.04), y + lampY * 1.15, pz - fz * (-backZ + 0.04), red, red * 0.06, red * 0.04, o.brake ? 0.62 : 0.4);
      if (o.reverse) lamp(px * 0.6 + x * 0.4 - fx * (-backZ + 0.04), y + lampY, pz * 0.6 + z * 0.4 - fz * (-backZ + 0.04), 1.3, 1.3, 1.3, 0.34);
    }
    if (o.blinkOn && o.blink) {
      // left side of the car is s = +1 here; blink -1 = left, +1 = right
      for (const s of [1, -1]) {
        if (o.blink !== 2 && ((o.blink < 0) !== (s > 0))) continue;
        const px = x + lx * hw * 0.92 * s, pz = z + lz * hw * 0.92 * s;
        lamp(px + fx * frontZ * 0.97, y + lampY, pz + fz * frontZ * 0.97, 2.4, 1.2, 0.1, 0.36);
        lamp(px + fx * backZ * 0.97, y + lampY * 1.15, pz + fz * backZ * 0.97, 2.4, 1.2, 0.1, 0.36);
      }
    }
  }
  function beginFrame() { nGlow = 0; }
  function endFrame(dt) {
    glow.geo.setDrawRange(0, nGlow);
    glow.geo.attributes.position.needsUpdate = true; glow.geo.attributes.aColor.needsUpdate = true; glow.geo.attributes.aSize.needsUpdate = true;
    updateParticles(dt);
    updateStrips(dt);
  }
  // particles and light dots are sized in meters; this tells the shader how many pixels a meter is
  function setViewport(fovDeg, heightPx) {
    const s = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    soft.mat.uniforms.uScale.value = s; hot.mat.uniforms.uScale.value = s; glow.mat.uniforms.uScale.value = s;
  }
  return { emit, addStrip, lamp, carLamps, beginFrame, endFrame, setViewport };
}
