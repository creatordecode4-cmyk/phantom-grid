// ---------------------------------------------------------------------------
// lighting.js - sky, sun, shadows, fog, reflections, day / night.
//
// The goal is light that looks like real camera footage:
//   * three.js "Sky" shader for the sky colors
//   * a layer of clouds, plus moon, stars and city glow at night
//   * ONE sun light. Sharp shadows near the player, soft shadows far away
//   * sky light from above + bounce light from the ground (HemisphereLight)
//   * haze (fog) that always has the color of the horizon
//   * a reflection map made from the sky, updated as the time changes
//   * at night only the 6 street lamps nearest to the player are real lights
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CONFIG } from '../config.js';
import { clamp, lerp, smoothstep, damp, acesToneMap, DEG } from '../utils/math.js';
import { shared } from '../city/materials.js';

// ---------------------------------------------------------------------------
// The same math as the three.js Sky shader, in JavaScript.
// We need the sky color at the horizon to color the fog, and the color of
// the sunlight after it has travelled through the air.
// ---------------------------------------------------------------------------
const SKY = {
  totalRayleigh: [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5],
  mieConst: [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14],
  cutoff: 1.6110731556870734, steepness: 1.5, EE: 1000,
  rayleighZenith: 8.4e3, mieZenith: 1.25e3,
};
function skyState(sunDir, p) {
  const sunE = SKY.EE * Math.max(0, 1 - Math.exp(-((SKY.cutoff - Math.acos(clamp(sunDir.y, -1, 1))) / SKY.steepness)));
  const sunfade = 1 - clamp(1 - Math.exp(sunDir.y), 0, 1); // the shader gets the sun at distance 450000
  const rc = p.rayleigh - (1 - sunfade);
  const c = 0.2 * p.turbidity * 10e-18;
  return {
    sunE, sunfade, sunDir,
    betaR: SKY.totalRayleigh.map((v) => v * rc),
    betaM: SKY.mieConst.map((v) => 0.434 * c * v * p.mie),
    g: p.g,
  };
}
function skyExtinction(st, dirY) {
  const zen = Math.acos(Math.max(0, dirY));
  const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
  const sR = SKY.rayleighZenith * inv, sM = SKY.mieZenith * inv;
  return [0, 1, 2].map((i) => Math.exp(-(st.betaR[i] * sR + st.betaM[i] * sM)));
}
// Sky color in direction (x, y, z). Same result as the shader (without the sun disc).
function skyColor(st, x, y, z) {
  const fex = skyExtinction(st, y);
  const cosT = x * st.sunDir.x + y * st.sunDir.y + z * st.sunDir.z;
  const rPhase = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
  const g2 = st.g * st.g;
  const mPhase = 0.07957747154594767 * ((1 - g2) / Math.pow(1 - 2 * st.g * cosT + g2, 1.5));
  const k = clamp(Math.pow(1 - st.sunDir.y, 5), 0, 1);
  const out = [0, 0, 0];
  const add = [0, 0.0003, 0.00075];
  for (let i = 0; i < 3; i++) {
    const s = (st.betaR[i] * rPhase + st.betaM[i] * mPhase) / (st.betaR[i] + st.betaM[i]);
    let lin = Math.pow(Math.max(0, st.sunE * s * (1 - fex[i])), 1.5);
    lin *= lerp(1, Math.pow(Math.max(0, st.sunE * s * fex[i]), 0.5), k);
    const tex = (lin + 0.1 * fex[i]) * 0.04 + add[i];
    out[i] = Math.pow(Math.max(tex, 0), 1 / (1.2 + 1.2 * st.sunfade));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cloud / night layer: a big dome drawn over the sky.
// ---------------------------------------------------------------------------
function makeSkyOverlayMaterial(noiseTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noiseTex },
      uTime: shared.uPgTime,
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },   // light on the clouds
      uSkyColor: { value: new THREE.Color(0.3, 0.4, 0.6) }, // shade color of the clouds
      uCover: { value: 0.35 },                            // 0 = clear, 1 = full of clouds
      uOvercast: { value: 0 },                            // 1 = grey rain sky
      uOvercastColor: { value: new THREE.Color(0.5, 0.52, 0.55) },
      uNight: { value: 0 },                               // 1 = night
      uGlowColor: { value: new THREE.Color(0.06, 0.035, 0.02) }, // city glow at the horizon
      uZenithColor: { value: new THREE.Color(0.004, 0.007, 0.016) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w; // always behind everything
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform float uCover;
      uniform float uOvercast;
      uniform vec3 uOvercastColor;
      uniform float uNight;
      uniform vec3 uGlowColor;
      uniform vec3 uZenithColor;
      varying vec3 vDir;
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      void main() {
        vec3 d = normalize( vDir );
        float up = max( d.y, 0.0 );
        vec3 col = vec3( 0.0 );
        float alpha = 0.0;
        // ---- clouds: noise on a flat layer high above the city ----
        if ( d.y > 0.005 ) {
          vec2 p = d.xz / ( d.y + 0.11 );
          vec2 uv = p * 0.085 + uTime * vec2( 0.0011, 0.0004 );
          float n = texture2D( uNoise, uv ).r * 0.58
                  + texture2D( uNoise, uv * 2.9 + 0.31 ).b * 0.28
                  + texture2D( uNoise, uv * 8.3 - uTime * 0.0007 ).g * 0.14;
          float edge0 = mix( 0.7, 0.24, uCover );
          float c = smoothstep( edge0, edge0 + 0.26, n ) * smoothstep( 0.005, 0.1, d.y );
          float thick = smoothstep( edge0 + 0.1, edge0 + 0.5, n );
          float toSun = max( dot( d, uSunDir ), 0.0 );
          vec3 lit = uSunColor * ( 0.5 + 0.5 * pow( toSun, 3.0 ) ) + uSkyColor * 0.55;
          vec3 shade = uSkyColor * 0.5 + uSunColor * 0.1;
          vec3 cloud = mix( lit, shade, thick * 0.8 );
          cloud += uSunColor * pow( toSun, 28.0 ) * ( 1.0 - thick ) * 1.6; // bright rim near the sun
          col = cloud;
          alpha = c * 0.93;
          // rain sky: one grey sheet with a little texture
          vec3 lid = uOvercastColor * ( 0.72 + 0.28 * n ) * ( 0.8 + 0.2 * up );
          col = mix( col, lid, uOvercast );
          alpha = mix( alpha, 0.97, uOvercast );
        } else {
          col = uOvercastColor * 0.8;
          alpha = 0.97 * uOvercast;
        }
        vec3 rgb = col * alpha;
        // ---- night sky: dark blue above, warm city glow near the horizon ----
        float clear = ( 1.0 - alpha );
        rgb += mix( uGlowColor, uZenithColor, pow( up, 0.4 ) ) * uNight;
        if ( uNight > 0.01 && d.y > 0.0 ) {
          // stars: random cells, a few of them hold a star
          vec2 sp = d.xz / ( d.y + 0.25 ) * 170.0;
          vec2 cell = floor( sp );
          float h = hash( cell );
          float dist = length( fract( sp ) - 0.5 );
          float star = step( 0.988, h ) * ( 1.0 - smoothstep( 0.0, 0.14, dist ) );
          float twinkle = 0.7 + 0.3 * sin( uTime * 3.0 + h * 90.0 );
          rgb += vec3( 0.75, 0.82, 1.0 ) * star * twinkle * fract( h * 77.0 ) * 0.5 * uNight * clear * smoothstep( 0.06, 0.4, d.y );
          // moon
          float md = dot( d, uMoonDir );
          float disc = smoothstep( 0.99988, 0.99993, md );
          rgb += ( vec3( 0.95, 0.96, 1.0 ) * disc * 1.6 + vec3( 0.3, 0.36, 0.5 ) * pow( max( md, 0.0 ), 900.0 ) * 0.25 ) * uNight * clear;
        }
        gl_FragColor = vec4( rgb, alpha );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function createLighting(scene, renderer, city, materials) {
  const TC = CONFIG.time;
  const layout = city.layout;

  // ---------------- sky ----------------
  // remove the sun disc from the copy used for reflections (the sun light
  // already makes its own highlight; a second one would look wrong)
  const sky = new Sky();
  sky.scale.setScalar(8000);
  sky.frustumCulled = false;
  sky.renderOrder = 8;
  sky.name = 'sky';
  scene.add(sky);
  const skyU = sky.material.uniforms;

  const overlayMat = makeSkyOverlayMaterial(materials.tex.noise);
  const overlay = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16), overlayMat);
  overlay.frustumCulled = false;
  overlay.renderOrder = 9;
  overlay.name = 'clouds';
  scene.add(overlay);

  // ---------------- lights ----------------
  const sun = new THREE.DirectionalLight(0xffffff, 5);
  sun.name = 'sun';
  sun.castShadow = true;
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.05;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1100;
  scene.add(sun);
  scene.add(sun.target);

  // helper light: it gives no light, it only carries the far shadow map
  const farSun = new THREE.DirectionalLight(0x000000, 0);
  farSun.name = 'farShadowHelper';
  farSun.castShadow = true;
  farSun.shadow.autoUpdate = false;
  farSun.shadow.bias = -0.0006;
  farSun.shadow.normalBias = 1.0;
  farSun.shadow.radius = 1.4;
  scene.add(farSun);
  scene.add(farSun.target);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0x9fb0c0, CONFIG.fog.density);

  // real point lights for the nearest street lamps (only switched on at night)
  const SL = CONFIG.streetLights;
  const pool = [];
  for (let i = 0; i < SL.realLights; i++) {
    const pl = new THREE.PointLight(SL.sodiumColor, 0, SL.range, 2);
    pl.visible = false;
    pl.userData = { lamp: -1, fade: 0 };
    scene.add(pl);
    pool.push(pl);
  }

  // ---------------- reflection map ----------------
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(8000);
  envSky.material.fragmentShader = envSky.material.fragmentShader.replace(
    'L0 += ( vSunE * 19000.0 * Fex ) * sundisk;',
    '// (sun disc removed for the reflection map)'
  );
  envScene.add(envSky);
  const envOverlay = new THREE.Mesh(overlay.geometry, overlayMat);
  envOverlay.renderOrder = 2;
  envScene.add(envOverlay);
  // ground and a ring of building shapes, so reflections show a "city"
  const envGroundMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(4000, 24), envGroundMat);
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -1.5;
  envScene.add(envGround);
  const ringGeo = new THREE.CylinderGeometry(300, 300, 64, 48, 1, true);
  const sk = materials.tex.skyline;
  sk.shape.repeat.set(3, 1);
  sk.lights.repeat.set(3, 1);
  const envRingMat = new THREE.MeshBasicMaterial({ map: sk.shape, alphaTest: 0.5, side: THREE.BackSide });
  const envRing = new THREE.Mesh(ringGeo, envRingMat);
  envRing.position.y = 28;
  envRing.renderOrder = 3;
  envScene.add(envRing);
  const envRingLightsMat = new THREE.MeshBasicMaterial({ map: sk.lights, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const envRingLights = new THREE.Mesh(new THREE.CylinderGeometry(299, 299, 64, 48, 1, true), envRingLightsMat);
  envRingLights.position.y = 28;
  envRingLights.renderOrder = 4;
  envScene.add(envRingLights);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let cubeRT = null, cubeCam = null, pmremRT = null;
  let hdriEnv = null; // set when a sky photo was found in assets/hdri
  function setEnvSize(size) {
    if (cubeRT && cubeRT.width === size) return;
    if (cubeRT) cubeRT.dispose();
    if (pmremRT) { pmremRT.dispose(); pmremRT = null; }
    cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    cubeCam = new THREE.CubeCamera(1, 9000, cubeRT);
    cubeCam.position.set(0, 3, 0);
    envDirty = true;
  }

  // ---------------- state ----------------
  let hour = TC.startHour;
  let running = true;          // false = time stands still
  let rain = 0;                // 0..1, set by weather.js
  let quality = CONFIG.quality.medium;
  let postActive = true;       // false = we draw straight to the screen (fog color needs tone mapping)
  let nightMode = false;
  let lampLevel = 0;           // 0..1, lamps warming up
  let winLate = 1;
  let envDirty = true, envTimer = 0, envSunEl = 99, envSunAz = 99, envRain = -1, envLum = 1;
  let farEl = 99, farAz = 99, farDirty = true;
  let lampTimer = 0;
  const sunDir = new THREE.Vector3(0, 1, 0);   // toward the sun
  const moonDir = new THREE.Vector3(0, 1, 0);
  const lightDir = new THREE.Vector3(0, 1, 0); // toward the active light (sun or moon)
  const info = { elevation: 0, azimuth: 0, day: 1, night: 0, sunLevel: 1 };
  const fogHDR = [0.6, 0.7, 0.8];
  const _v = new THREE.Vector3(), _c = new THREE.Color();
  const _x = new THREE.Vector3(), _y = new THREE.Vector3();

  // Where is the sun at a given hour? Returns elevation and compass direction (degrees).
  function sunAngles(h) {
    const dayLen = TC.sunsetHour - TC.sunriseHour;
    let f = (h - TC.sunriseHour) / dayLen; // 0 at sunrise, 1 at sunset
    if (f >= 0 && f <= 1) {
      return { el: CONFIG.sun.maxElevation * Math.sin(Math.PI * f), az: lerp(CONFIG.sun.azimuthAtSunrise, CONFIG.sun.azimuthAtSunset, f) };
    }
    // night: the sun goes around below the horizon
    const nightLen = 24 - dayLen;
    const g = h > TC.sunsetHour ? (h - TC.sunsetHour) / nightLen : (h + 24 - TC.sunsetHour) / nightLen; // 0..1 through the night
    return { el: -32 * Math.sin(Math.PI * g), az: (CONFIG.sun.azimuthAtSunset + (360 - CONFIG.sun.azimuthAtSunset + CONFIG.sun.azimuthAtSunrise) * g) % 360 };
  }
  // Compass direction + elevation -> a direction in the world (north = +z, east = -x).
  function dirFromAngles(el, az, out) {
    const e = el * DEG, a = az * DEG;
    return out.set(-Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  }

  // ---------------- reflection map update ----------------
  function updateEnv() {
    if (hdriEnv) return;
    const prevTarget = renderer.getRenderTarget();
    cubeCam.update(renderer, envScene);
    pmremRT = pmrem.fromCubemap(cubeRT.texture, pmremRT);
    renderer.setRenderTarget(prevTarget);
    scene.environment = pmremRT.texture;
    envSunEl = info.elevation; envSunAz = info.azimuth; envRain = rain;
    envLum = currentSkyLum();
    envDirty = false;
    envTimer = 0;
  }
  let lastSkyLum = 1;
  function currentSkyLum() { return lastSkyLum; }

  // ---------------- far shadow map ----------------
  const cityBox = { minX: layout.city.minX - 60, maxX: layout.city.maxX + 20, minZ: layout.neon.promenadeMinZ - 20, maxZ: layout.city.maxZ + 20, maxY: 45 };
  function updateFarShadow() {
    const cx = (cityBox.minX + cityBox.maxX) / 2, cz = (cityBox.minZ + cityBox.maxZ) / 2;
    farSun.target.position.set(cx, 0, cz);
    farSun.position.set(cx, 0, cz).addScaledVector(lightDir, 1600);
    // light space axes (same as the shadow camera will use)
    _x.crossVectors(THREE.Object3D.DEFAULT_UP, lightDir).normalize();
    _y.crossVectors(lightDir, _x).normalize();
    let ex = 0, ey = 0, ez = 0;
    for (const x of [cityBox.minX, cityBox.maxX]) for (const z of [cityBox.minZ, cityBox.maxZ]) for (const y of [0, cityBox.maxY]) {
      _v.set(x - cx, y, z - cz);
      ex = Math.max(ex, Math.abs(_v.dot(_x)));
      ey = Math.max(ey, Math.abs(_v.dot(_y)));
      ez = Math.max(ez, Math.abs(_v.dot(lightDir)));
    }
    const cam = farSun.shadow.camera;
    cam.left = -ex; cam.right = ex; cam.top = ey; cam.bottom = -ey;
    cam.near = 1600 - ez - 250; cam.far = 1600 + ez + 20;
    cam.updateProjectionMatrix();
    farSun.shadow.needsUpdate = true;
    farEl = info.elevation; farAz = info.azimuth;
    farDirty = false;
  }

  // ---------------- nearest street lamps become real lights ----------------
  const lamps = city.lamps;
  const nearest = [];
  function assignLamps(px, pz) {
    // find the N nearest lamps
    nearest.length = 0;
    const N = pool.length;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const d = (l.x - px) * (l.x - px) + (l.z - pz) * (l.z - pz);
      if (d > 60 * 60) continue;
      let k = nearest.length;
      if (k < N) nearest.push({ i, d });
      else if (d < nearest[N - 1].d) nearest[N - 1] = { i, d };
      else continue;
      // keep the short list sorted
      for (k = nearest.length - 1; k > 0 && nearest[k].d < nearest[k - 1].d; k--) {
        const t = nearest[k]; nearest[k] = nearest[k - 1]; nearest[k - 1] = t;
      }
    }
    // lights that already sit on one of these lamps stay there (no flicker)
    const wanted = new Set(nearest.map((n) => n.i));
    const freeLights = [];
    for (const pl of pool) {
      if (wanted.has(pl.userData.lamp)) wanted.delete(pl.userData.lamp);
      else freeLights.push(pl);
    }
    for (const i of wanted) {
      const pl = freeLights.pop();
      if (!pl) break;
      const l = lamps[i];
      pl.userData.lamp = i;
      pl.userData.fade = 0; // fade in softly at the new place
      pl.position.set(l.x, l.y - 0.25, l.z);
      pl.color.setHex(l.type === 0 ? SL.sodiumColor : SL.ledColor);
    }
    for (const pl of freeLights) { pl.userData.lamp = -1; pl.userData.fade = 0; }
  }

  // ---------------- every frame ----------------
  function update(dt, playerPos, camDir) {
    if (running) hour = (hour + (dt * 24) / TC.dayLengthSeconds) % 24;

    // ---- where is the sun? ----
    const ang = sunAngles(hour);
    info.elevation = ang.el; info.azimuth = ang.az;
    dirFromAngles(ang.el, ang.az, sunDir);
    // the moon stands roughly opposite the sun, but always well above the horizon at night
    dirFromAngles(Math.max(18, -ang.el * 1.35 + 14), (ang.az + 180) % 360, moonDir);

    const el = ang.el;
    const sunLevel = smoothstep(-2.0, 5.0, el);            // strength of direct sunlight
    const day = smoothstep(-9.0, 6.0, el);                 // 0 = night, 1 = day (for the sky light)
    const night = 1 - smoothstep(-10.0, -1.0, el);
    info.day = day; info.night = night; info.sunLevel = sunLevel;
    const dry = 1 - rain;

    // ---- night mode: lamps on, sun shadows off (switched together) ----
    if (!nightMode && el < -1.6) nightMode = true;
    else if (nightMode && el > -0.6) nightMode = false;
    lampLevel = damp(lampLevel, nightMode ? 1 : 0, nightMode ? 0.9 : 4, dt);
    shared.uPgNight.value = lampLevel < 0.003 ? 0 : lampLevel;
    // windows light up one by one at dusk; late at night most go dark again
    const late = hour > 23.6 || hour < TC.sunriseHour - 0.5 ? 0.3 : 1;
    winLate = damp(winLate, late, 0.4, dt);
    shared.uPgWinLight.value = (1 - smoothstep(-7.0, 7.0, el)) * winLate * (0.9 + 0.1 * rain) + rain * 0.25 * day;
    shared.uPgDay.value = day * (1 - 0.45 * rain);

    // ---- sky shader settings ----
    const low = 1 - smoothstep(4, 30, el);                 // 1 when the sun is low
    const skyParams = {
      turbidity: lerp(lerp(2.4, 7.5, low), 14, rain),
      rayleigh: lerp(lerp(1.15, 2.7, low), 0.7, rain),
      mie: lerp(0.0045, 0.012, rain),
      g: lerp(0.82, 0.74, low),
    };
    for (const u of [skyU, envSky.material.uniforms]) {
      u.turbidity.value = skyParams.turbidity;
      u.rayleigh.value = skyParams.rayleigh;
      u.mieCoefficient.value = skyParams.mie;
      u.mieDirectionalG.value = skyParams.g;
      u.sunPosition.value.copy(sunDir).multiplyScalar(450000);
    }
    const st = skyState(sunDir, skyParams);

    // ---- sunlight color: white at noon, orange when low ----
    const ext = skyExtinction(st, Math.max(sunDir.y, 0.02));
    const mx = Math.max(ext[0], ext[1], ext[2], 1e-4);
    const sunCol = [Math.pow(ext[0] / mx, 0.62), Math.pow(ext[1] / mx, 0.62), Math.pow(ext[2] / mx, 0.62)];
    const sunPower = 6.4 * sunLevel * (0.42 + 0.58 * smoothstep(0, 28, el)) * (1 - 0.86 * rain);

    if (!nightMode) {
      lightDir.copy(sunDir);
      if (lightDir.y < 0.03) { lightDir.y = 0.03; lightDir.normalize(); }
      sun.color.setRGB(sunCol[0], sunCol[1], sunCol[2]);
      sun.intensity = sunPower;
      sun.shadow.intensity = clamp(sunLevel * 1.4, 0, 1) * (1 - 0.5 * rain);
    } else {
      // moonlight: weak and blue
      lightDir.copy(moonDir);
      sun.color.setRGB(0.55, 0.68, 1.0);
      sun.intensity = 0.22 * night * (1 - 0.7 * rain);
    }
    const wantShadows = quality.shadows && !nightMode;
    if (sun.castShadow !== wantShadows) { sun.castShadow = wantShadows; farDirty = true; }
    const wantFar = wantShadows && quality.farShadows;
    if (farSun.visible !== wantFar) { farSun.visible = wantFar; farDirty = true; }
    for (const pl of pool) pl.visible = nightMode;

    // ---- sky light and ground bounce ----
    const zen = skyColor(st, -sunDir.x * 0.3, 0.9, -sunDir.z * 0.3);
    const overcastLum = (0.34 * day + 0.012) ;
    const hemiSky = [lerp(zen[0], overcastLum, rain * 0.85), lerp(zen[1], overcastLum * 1.04, rain * 0.85), lerp(zen[2], overcastLum * 1.1, rain * 0.85)];
    // night: a little cold light from the sky so shapes stay readable
    hemi.color.setRGB(hemiSky[0] + 0.02 * night, hemiSky[1] + 0.028 * night, hemiSky[2] + 0.05 * night);
    hemi.groundColor.setRGB(
      0.2 * day * (0.5 + 0.5 * sunCol[0] * sunLevel) + 0.012 * night,
      0.17 * day * (0.5 + 0.5 * sunCol[1] * sunLevel) + 0.009 * night,
      0.14 * day * (0.5 + 0.5 * sunCol[2] * sunLevel) + 0.007 * night
    );
    hemi.intensity = 1.0;

    // ---- clouds / night layer ----
    const ou = overlayMat.uniforms;
    ou.uSunDir.value.copy(sunDir);
    ou.uMoonDir.value.copy(moonDir);
    const cloudLight = sunLevel * 1.15 + 0.02;
    ou.uSunColor.value.setRGB(sunCol[0] * cloudLight + 0.02 * night, sunCol[1] * cloudLight + 0.024 * night, sunCol[2] * cloudLight + 0.035 * night);
    ou.uSkyColor.value.setRGB(zen[0] * 0.9 + 0.012 * night, zen[1] * 0.9 + 0.012 * night, zen[2] * 0.9 + 0.016 * night);
    ou.uCover.value = quality.skyClouds ? lerp(0.36, 0.9, rain) : 0;
    ou.uOvercast.value = smoothstep(0.15, 0.9, rain);
    ou.uOvercastColor.value.setRGB(overcastLum * 1.25 + 0.02 * night, overcastLum * 1.28 + 0.02 * night, overcastLum * 1.34 + 0.022 * night);
    ou.uNight.value = night;

    // ---- haze color = color of the sky at the horizon ----
    // (three directions around the horizon, more weight on the side away from the sun)
    const sx = sunDir.x, sz = sunDir.z, sl = Math.hypot(sx, sz) || 1;
    const hx = sx / sl, hz = sz / sl;
    const h1 = skyColor(st, -hx * 0.99, 0.04, -hz * 0.99);
    const h2 = skyColor(st, hz * 0.99, 0.04, -hx * 0.99);
    const h3 = skyColor(st, hx * 0.7 - hz * 0.7, 0.04, hz * 0.7 + hx * 0.7);
    for (let i = 0; i < 3; i++) {
      let f = (h1[i] * 0.4 + h2[i] * 0.4 + h3[i] * 0.2) * 0.92;
      f = lerp(f, ou.uOvercastColor.value.getComponent(i) * 0.78, ou.uOvercast.value * 0.97);
      f += ou.uGlowColor.value.getComponent(i) * night * 0.9;
      fogHDR[i] = f;
    }
    lastSkyLum = 0.2 * (zen[0] + zen[1] + zen[2]) + 0.25 * (fogHDR[0] + fogHDR[1] + fogHDR[2]) / 3 + 0.004;

    // ---- exposure: the "camera" opens up when it gets dark ----
    const exposure = lerp(1.25, lerp(0.74, 0.56, smoothstep(0, 30, el)), day) * (1 + 0.12 * rain * day);
    renderer.toneMappingExposure = exposure;
    info.exposure = exposure;

    if (postActive) scene.fog.color.setRGB(fogHDR[0], fogHDR[1], fogHDR[2]);
    else {
      // drawing straight to the screen: three.js mixes fog in AFTER tone mapping
      const tm = acesToneMap(fogHDR, exposure);
      scene.fog.color.setRGB(tm[0], tm[1], tm[2]);
    }
    scene.fog.density = lerp(CONFIG.fog.density, CONFIG.fog.rainDensity, rain) * quality.fogMultiplier * lerp(1, 0.8, night);

    // ---- reflection strength follows the sky brightness ----
    if (hdriEnv) scene.environmentIntensity = (0.06 + 0.94 * day) * (1 - 0.4 * rain);
    else scene.environmentIntensity = clamp(lastSkyLum / Math.max(envLum, 1e-4), 0.25, 4) * lerp(0.9, 1.25, rain);
    envGroundMat.color.setRGB(
      0.05 + 0.2 * day * (0.35 + 0.65 * sunLevel * sunCol[0]) * dry + fogHDR[0] * 0.25,
      0.05 + 0.18 * day * (0.35 + 0.65 * sunLevel * sunCol[1]) * dry + fogHDR[1] * 0.25,
      0.05 + 0.16 * day * (0.35 + 0.65 * sunLevel * sunCol[2]) * dry + fogHDR[2] * 0.25
    ).multiplyScalar(day * 0.9 + 0.1);
    envRingMat.color.setRGB(
      (0.22 + 0.5 * sunLevel * sunCol[0]) * day + fogHDR[0] * 0.5 + 0.004,
      (0.22 + 0.45 * sunLevel * sunCol[1]) * day + fogHDR[1] * 0.5 + 0.004,
      (0.23 + 0.4 * sunLevel * sunCol[2]) * day + fogHDR[2] * 0.5 + 0.005
    );
    envRingLightsMat.color.setScalar(1.5 * lampLevel);

    // ---- sharp shadow map: follows the player, looks ahead of the camera ----
    const R = quality.shadowRange;
    _v.set(playerPos.x + camDir.x * R * 0.55, 0, playerPos.z + camDir.z * R * 0.55);
    // snap to whole shadow pixels (in light space), so shadow edges do not shimmer
    _x.crossVectors(THREE.Object3D.DEFAULT_UP, lightDir).normalize();
    _y.crossVectors(lightDir, _x).normalize();
    const texel = (R * 2) / quality.shadowMapSize;
    const lx = Math.round(_v.dot(_x) / texel) * texel, ly = Math.round(_v.dot(_y) / texel) * texel, lz = _v.dot(lightDir);
    _v.set(0, 0, 0).addScaledVector(_x, lx).addScaledVector(_y, ly).addScaledVector(lightDir, lz);
    sun.target.position.copy(_v);
    sun.position.copy(_v).addScaledVector(lightDir, 520);
    sun.target.updateMatrixWorld();

    // ---- far shadow map: only redrawn when the sun has moved a little ----
    envTimer += dt;
    if (wantFar && (farDirty || Math.abs(el - farEl) > 0.2 || Math.abs(ang.az - farAz) > 0.35)) {
      // never on the same frame as the reflection map (spreads the work)
      if (!(envDirty && envTimer > 0.8)) updateFarShadow();
    }

    // ---- reflection map: redrawn when the sky has changed enough ----
    if (!hdriEnv) {
      if (Math.abs(el - envSunEl) > 1.1 || Math.abs(ang.az - envSunAz) > 3.5 || Math.abs(rain - envRain) > 0.12) envDirty = true;
      if (envDirty && (envTimer > 0.8 || envSunEl === 99)) updateEnv();
    }

    // ---- street lamps -> real lights ----
    if (nightMode) {
      lampTimer -= dt;
      if (lampTimer <= 0) { lampTimer = 0.2; assignLamps(playerPos.x, playerPos.z); }
      for (const pl of pool) {
        if (pl.userData.lamp < 0) { pl.intensity = 0; continue; }
        pl.userData.fade = Math.min(1, pl.userData.fade + dt * 2.5);
        const l = lamps[pl.userData.lamp];
        const d = Math.hypot(l.x - playerPos.x, l.z - playerPos.z);
        // fades out with distance, matching the fake lamp light in the shaders
        pl.intensity = SL.intensity * lampLevel * pl.userData.fade * (1 - smoothstep(18, 40, d));
      }
    }
  }

  // ---------------- controls for the rest of the game ----------------
  function setQuality(q) {
    quality = q;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const R = q.shadowRange;
    const cam = sun.shadow.camera;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.updateProjectionMatrix();
    for (const [light, size] of [[sun, q.shadowMapSize], [farSun, q.farShadowMapSize]]) {
      if (light.shadow.mapSize.x !== size) {
        light.shadow.mapSize.set(size, size);
        if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
      }
    }
    sun.shadow.normalBias = (R * 2 / q.shadowMapSize) * 0.8;
    setEnvSize(q.envMapSize);
    farDirty = true;
    envDirty = true;
    envSunEl = 99; // forces a new reflection map right away
  }

  // Try to load a sky photo for reflections (optional file in assets/hdri).
  async function tryLoadHDRI() {
    for (const url of CONFIG.hdri) {
      try {
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) continue;
        let tex;
        if (url.endsWith('.hdr')) {
          const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
          tex = await new RGBELoader().loadAsync(url);
        } else {
          tex = await new THREE.TextureLoader().loadAsync(url);
          tex.colorSpace = THREE.SRGBColorSpace;
        }
        tex.mapping = THREE.EquirectangularReflectionMapping;
        hdriEnv = pmrem.fromEquirectangular(tex).texture;
        scene.environment = hdriEnv;
        tex.dispose();
        console.info('[lighting] using sky photo for reflections:', url);
        return true;
      } catch (e) { /* file not there - that is fine */ }
    }
    return false;
  }

  return {
    sun, hemi, sky, info,
    update,
    setQuality,
    tryLoadHDRI,
    setPostActive(v) { postActive = v; },
    setRain(v) { rain = v; },
    get hour() { return hour; },
    setHour(h) { hour = ((h % 24) + 24) % 24; envDirty = true; envSunEl = 99; farDirty = true; },
    jumpTo(name) { this.setHour(TC.presets[name]); },
    setRunning(v) { running = v; },
    get nightMode() { return nightMode; },
    // used once at start to make the GPU prepare both day and night shaders
    forceNight(v) { nightMode = v; for (const pl of pool) pl.visible = v; sun.castShadow = quality.shadows && !v; farSun.visible = sun.castShadow && quality.farShadows; },
    fogHDR,
    sunDir,
  };
}
