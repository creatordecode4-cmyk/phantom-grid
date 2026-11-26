// ---------------------------------------------------------------------------
// weather.js - rain.
//
// When rain is switched on:
//   * thin rain streaks fall around the camera (one instanced mesh)
//   * the sky turns grey and the fog gets thicker (done in lighting.js)
//   * roads slowly get wet and puddles appear (done by the ground shaders,
//     we only raise the "wetness" number here)
// After the rain stops the streets dry slowly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { damp } from '../utils/math.js';
import { shared } from '../city/materials.js';

const MAX_STREAKS = 3000;

export function createWeather(scene, lighting) {
  // ---- rain streaks: copies of one small quad, moved on the GPU ----
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const seeds = new Float32Array(MAX_STREAKS * 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random(); // rain may be truly random
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  geo.instanceCount = 1400;

  const uniforms = {
    uTime: shared.uPgTime,
    uBox: { value: new THREE.Vector3(46, 26, 46) },        // rain exists only in this box around the camera
    uFall: { value: new THREE.Vector3(1.6, -15.0, 0.8) },  // meters per second (a bit of wind)
    uColor: { value: new THREE.Color(0.6, 0.65, 0.7) },
    uOpacity: { value: 0 },
    // a roof the camera is under (a garage, a car park): no rain falls inside it. minX, maxX, minZ, maxZ / top
    uShelter: { value: new THREE.Vector4(1e9, -1e9, 1e9, -1e9) },
    uShelterTop: { value: -1e9 },
    // a soft glow the drops pass through (Chapter 8: Zero's light lights the rain around it): x, y, z, radius
    uGlow: { value: new THREE.Vector4(0, -1e6, 0, 1) },
    uGlowCol: { value: new THREE.Color(0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform vec3 uBox;
      uniform vec3 uFall;
      uniform vec4 uShelter;
      uniform float uShelterTop;
      uniform vec4 uGlow;
      varying vec2 vUv;
      varying float vFade;
      varying float vGlow;
      void main() {
        vUv = uv;
        // each drop starts at a random place and falls; when it leaves the
        // box around the camera it comes back in on the other side
        vec3 p = aSeed * uBox + uFall * uTime * ( 0.85 + 0.3 * aSeed.y );
        vec3 rel = mod( p - cameraPosition, uBox ) - uBox * 0.5;
        vec3 world = cameraPosition + rel;
        vec3 dir = normalize( uFall );
        vec3 toCam = normalize( cameraPosition - world );
        vec3 side = normalize( cross( dir, toCam ) );
        float len = 0.5 + 0.5 * aSeed.z;
        world += dir * ( position.y * len ) + side * ( position.x * 0.016 );
        vec4 mv = viewMatrix * vec4( world, 1.0 );
        gl_Position = projectionMatrix * mv;
        // fade out drops that are very close or at the edge of the box
        float d = length( rel );
        vFade = smoothstep( 1.5, 5.0, d ) * ( 1.0 - smoothstep( uBox.x * 0.36, uBox.x * 0.5, d ) );
        // under the roof of a garage there is no rain
        float inside = step( uShelter.x, world.x ) * step( world.x, uShelter.y ) * step( uShelter.z, world.z ) * step( world.z, uShelter.w ) * step( world.y, uShelterTop );
        vFade *= 1.0 - inside;
        // (near the glow: lit drops, the light falling off softly)
        float g = 1.0 - clamp( length( world - uGlow.xyz ) / uGlow.w, 0.0, 1.0 );
        vGlow = g * g;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec3 uGlowCol;
      varying vec2 vUv;
      varying float vFade;
      varying float vGlow;
      void main() {
        float across = 1.0 - abs( vUv.x - 0.5 ) * 2.0;
        float along = smoothstep( 0.0, 0.25, vUv.y ) * ( 1.0 - smoothstep( 0.6, 1.0, vUv.y ) );
        gl_FragColor = vec4( uColor + uGlowCol * vGlow, across * along * vFade * uOpacity * ( 1.0 + 1.6 * vGlow ) );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rain';
  mesh.frustumCulled = false;
  mesh.renderOrder = 30;
  mesh.visible = false;
  scene.add(mesh);

  let raining = false;
  let zoneRain = false; // The Sunk: it always rains there (Chapter 3)
  let rain = 0;     // how hard it rains right now (0..1)
  let wet = 0;      // how wet the ground is (0..1)

  function update(dt) {
    // rain starts and stops over a few seconds
    const on = raining || zoneRain;
    rain = damp(rain, on ? (raining ? 1 : 0.75) : 0, on ? 0.5 : 0.8, dt);
    if (rain < 0.002 && !on) rain = 0;
    // the ground gets wet in about 10 seconds and dries much more slowly
    if (rain > wet) wet = Math.min(1, wet + dt * 0.11 * rain);
    else wet = Math.max(0, wet - dt * 0.022);
    shared.uPgWet.value = wet;
    lighting.setRain(rain);

    mesh.visible = rain > 0.01;
    uniforms.uOpacity.value = rain * 0.42;
    // drops take the color of the hazy sky, a bit brighter so they can be seen
    const f = lighting.fogHDR;
    uniforms.uColor.value.setRGB(f[0] * 1.5 + 0.02, f[1] * 1.5 + 0.022, f[2] * 1.5 + 0.026);
  }

  return {
    update,
    toggle() { raining = !raining; return raining; },
    setRaining(v) { raining = !!v; },
    // skip the slow start (used by the test tools): rain and wet ground at once
    setInstant(v) { raining = !!v; rain = v ? 1 : 0; wet = v ? 1 : 0; },
    get raining() { return raining; },
    // The Sunk: a steady rain while the player is there
    setZoneRain(v) { zoneRain = !!v; },
    get amount() { return rain; },
    setQuality(q) { geo.instanceCount = Math.min(MAX_STREAKS, q.rainStreaks); },
    // a glow that lights the drops around it (Zero, Chapter 8): pos [x, y, z] (null = none), color [r, g, b] x strength,
    // radius in meters
    setGlow(pos, color = [0, 0, 0], radius = 8) {
      if (!pos) { uniforms.uGlow.value.set(0, -1e6, 0, 1); uniforms.uGlowCol.value.setRGB(0, 0, 0); return; }
      uniforms.uGlow.value.set(pos[0], pos[1], pos[2], radius);
      uniforms.uGlowCol.value.setRGB(color[0], color[1], color[2]);
    },
    // the roof the camera is under: { minX, maxX, minZ, maxZ, top } or null
    setShelter(b) {
      if (b) { uniforms.uShelter.value.set(b.minX, b.maxX, b.minZ, b.maxZ); uniforms.uShelterTop.value = b.top; }
      else { uniforms.uShelter.value.set(1e9, -1e9, 1e9, -1e9); uniforms.uShelterTop.value = -1e9; }
    },
  };
}
