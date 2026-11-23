// ---------------------------------------------------------------------------
// spectators.js - the people who came to watch a race.
//
//   * ONE instanced mesh for all of them (one draw call): simple bodies in many clothes colors. Their arms
//     move in the shader - hanging, swinging a little, thrown up when a car flies past (cheering).
//   * PHONE LIGHTS: one glowing dot for every second person, held up to film (one more draw call). They
//     twinkle, and now and then a camera flash.
//   * Some people stand ON the road (the night market): when the cars come they step back to the side.
//   * near(x, z) says how close the crowd is (for the murmur and the cheers in sound.js).
//
//   set(crowds, ground)  crowds: [{ a: [x, z], b: [x, z], n, face (compass deg), clear, go: [dx, dz] }]
//   update(dt, time, cars), cheer(x, z), near(x, z), clear(), setQuality({ spectators: 0..1 })
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { makeHumanFigure, FIGURE } from '../city/models.js';

const MAX = 320;
const CLOTHES = [
  [0.09, 0.1, 0.12], [0.16, 0.15, 0.14], [0.3, 0.08, 0.07], [0.12, 0.18, 0.28], [0.42, 0.4, 0.37], [0.07, 0.07, 0.08],
  [0.36, 0.24, 0.12], [0.16, 0.26, 0.2], [0.5, 0.48, 0.44], [0.22, 0.12, 0.25], [0.6, 0.36, 0.12], [0.1, 0.12, 0.1],
];

// one person: the smooth figure of the city's crowds in a long coat (makeHumanFigure in city/models.js, the
// light version). aPart: 0 still (body, legs), 1 left arm, 2 right arm; the arms hang from the shoulder joint
// at (+-FIGURE.shoulderX, FIGURE.shoulderY, 0) and the shader turns them around it.
function personGeometry() {
  return makeHumanFigure('coat', 0);
}

export function createSpectators(scene) {
  const geo = personGeometry();
  const phase = new Float32Array(MAX), cheerA = new Float32Array(MAX);
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aCheer', new THREE.InstancedBufferAttribute(cheerA, 1).setUsage(THREE.DynamicDrawUsage));
  // (vertex colors: skin, hair and shoes keep their own color, the coat takes the person's color - aData.z marks it)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, vertexColors: true });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aPart;\nattribute float aPhase;\nattribute float aCheer;\nattribute vec4 aData;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
	#ifdef USE_INSTANCING_COLOR
		vColor.xyz = color.xyz * mix( vec3( 1.0 ), instanceColor.xyz, aData.z );
	#endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
	// the arms turn around the shoulder: a little swing standing, thrown up and waving when cheering
	// (parts 3 and 4 are the legs: they stand still)
	if ( aPart > 0.5 && aPart < 2.5 ) {
		float side = aPart < 1.5 ? 1.0 : -1.0;
		float wave = sin( uTime * 7.0 + aPhase * 6.28 + side ) * 0.35;
		float a = mix( sin( uTime * 1.3 + aPhase * 9.0 ) * 0.08, 2.6 + wave, aCheer );
		vec3 p = transformed - vec3( side * ${FIGURE.shoulderX.toFixed(3)}, ${FIGURE.shoulderY.toFixed(3)}, 0.0 );
		float c = cos( a ), s = sin( a );
		// (forward and up: around the left-right axis, a little outward too)
		p = vec3( p.x, p.y * c - p.z * s, p.y * s + p.z * c );
		p.x += side * sin( a ) * 0.08;
		transformed = p + vec3( side * ${FIGURE.shoulderX.toFixed(3)}, ${FIGURE.shoulderY.toFixed(3)}, 0.0 );
	}
	// a small bounce on the toes when cheering
	transformed.y += aCheer * max( 0.0, sin( uTime * 9.0 + aPhase * 12.0 ) ) * 0.06;`);
  };
  mat.customProgramCacheKey = () => 'spectators';
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = 'spectators';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false;
  scene.add(mesh);

  // ---- phone lights ----
  const PMAX = MAX;
  const pPos = new Float32Array(PMAX * 3), pSeed = new Float32Array(PMAX);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime, uScale: { value: 300 } },
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // a screen glows softly; now and then a camera flash
        float tw = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 40.0);
        float flash = step(0.996, fract(sin(floor(uTime * 6.0) * 12.9898 + aSeed * 78.233) * 43758.5453));
        vA = tw * 0.6 + flash * 2.4;
        gl_PointSize = clamp(uScale * (0.06 + flash * 0.1) / -mv.z, 1.5, 22.0);
      }`,
    fragmentShader: `varying float vA; void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); float a = smoothstep(0.25, 0.0, r) * vA; gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a, a); }`,
  });
  const phones = new THREE.Points(pGeo, pMat);
  phones.name = 'spectatorPhones';
  phones.frustumCulled = false;
  phones.renderOrder = 15;
  scene.add(phones);
  pGeo.setDrawRange(0, 0);

  // ---- the people ----
  const people = [];          // { x, z, y, h, tx, tz, clear, ph, cheer, phone }
  const groups = [];          // centers, for near()
  let share = 1;              // LOW quality: half of them
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let ground = () => 0;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  function place(p, i) {
    q.setFromAxisAngle(up, p.h);
    pos.set(p.x, p.y, p.z);
    scl.setScalar(p.size);
    m4.compose(pos, q, scl);
    mesh.setMatrixAt(i, m4);
  }
  function set(crowds, groundAt) {
    clear();
    ground = groundAt || ground;
    seed = 7;
    for (const c of crowds || []) {
      const n = Math.round((c.n || 0) * share);
      if (!n) continue;
      const ax = c.a[0], az = c.a[1], bx = c.b[0], bz = c.b[1];
      const f = (c.face || 0) * Math.PI / 180, h = Math.atan2(-Math.sin(f), Math.cos(f));
      const fx = Math.sin(h), fz = Math.cos(h);
      for (let k = 0; k < n && people.length < MAX; k++) {
        const t = n > 1 ? k / (n - 1) : 0.5;
        // rows: the first close to the road, some behind
        const back = (rnd() < 0.55 ? 0 : 0.7 + rnd() * 0.8) * (c.clear ? 0.3 : 1);
        const x = ax + (bx - ax) * t + (rnd() - 0.5) * 0.7 - fx * back, z = az + (bz - az) * t + (rnd() - 0.5) * 0.7 - fz * back;
        const p = { x, z, y: ground(x, z), h: h + (rnd() - 0.5) * 0.7, size: 0.9 + rnd() * 0.17, clear: !!c.clear, go: c.go || [0, 0], gone: 0, ph: rnd(), cheer: 0, phone: rnd() < 0.5, sx: x, sz: z };
        people.push(p);
        const i = people.length - 1;
        phase[i] = p.ph;
        cheerA[i] = 0;
        const cc = CLOTHES[Math.floor(rnd() * CLOTHES.length)];
        col.setRGB(cc[0], cc[1], cc[2]);
        mesh.setColorAt(i, col);
        place(p, i);
      }
      groups.push({ x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 6, n });
    }
    mesh.count = people.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    geo.attributes.aPhase.needsUpdate = true;
    let np = 0;
    for (const p of people) if (p.phone) np++;
    pGeo.setDrawRange(0, np);
    for (let i = 0, k = 0; i < people.length; i++) if (people[i].phone) pSeed[k++] = people[i].ph;
    pGeo.attributes.aSeed.needsUpdate = true;
    mesh.visible = phones.visible = people.length > 0;
  }
  function clear() { people.length = 0; groups.length = 0; mesh.count = 0; pGeo.setDrawRange(0, 0); mesh.visible = phones.visible = false; }

  // cars: [{ x, z, vx, vz }] (the race cars) - the people on the road step back when one comes
  function update(dt, time, cars) {
    uTime.value = time;
    if (!people.length) return;
    let moved = false, k = 0;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.cheer > 0) { p.cheer = Math.max(0, p.cheer - dt * 0.4); cheerA[i] = Math.min(1, p.cheer * 1.6); }
      if (p.clear && cars) {
        // a car coming close: go to the side of the road (quickly), and stay there
        let near = false;
        for (const c of cars) if (Math.abs(c.x - p.x) < 50 && Math.abs(c.z - p.z) < 50) { near = true; break; }
        if (near || p.gone > 0) {
          p.gone = Math.min(1, p.gone + dt * 0.9);
          const e = p.gone * p.gone * (3 - 2 * p.gone);
          p.x = p.sx + p.go[0] * e; p.z = p.sz + p.go[1] * e;
          p.h = Math.atan2(p.go[0], p.go[1]);
          p.y = ground(p.x, p.z);
          place(p, i); moved = true;
        }
      }
      if (p.phone) {
        // the phone: held up high when cheering, in front of the chest otherwise
        const fx = Math.sin(p.h), fz = Math.cos(p.h), up2 = 1.25 + cheerA[i] * 0.85;
        pPos[k * 3] = p.x + fx * 0.28; pPos[k * 3 + 1] = p.y + up2 * p.size; pPos[k * 3 + 2] = p.z + fz * 0.28;
        k++;
      }
    }
    geo.attributes.aCheer.needsUpdate = true;
    pGeo.attributes.position.needsUpdate = true;
    if (moved) mesh.instanceMatrix.needsUpdate = true;
  }
  // people near (x, z) cheer: arms up, phones up
  function cheer(x, z) {
    for (const p of people) if (Math.abs(p.x - x) < 34 && Math.abs(p.z - z) < 34) p.cheer = Math.max(p.cheer, 1.4 + Math.random() * 0.6);
  }
  // how close the crowd is to (x, z): 0 (nobody) .. 1 (right among them)
  function near(x, z) {
    let k = 0;
    for (const g of groups) k = Math.max(k, Math.min(1, g.n / 30) * Math.max(0, 1 - Math.max(0, Math.hypot(g.x - x, g.z - z) - g.r) / 45));
    return k;
  }
  return {
    set, clear, update, cheer, near,
    setQuality(q) { share = q && q.spectators !== undefined ? q.spectators : 1; },
    setViewport(fov, pixelH) { pMat.uniforms.uScale.value = pixelH / (2 * Math.tan((fov * Math.PI) / 360)) * 0.9; },
    get count() { return people.length; },
  };
}
