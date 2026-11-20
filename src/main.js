// ---------------------------------------------------------------------------
// main.js - starts the game and runs the main loop.
//
// Order of things:
//   1. create the renderer (the thing that draws)
//   2. load textures and build the city
//   3. create lighting, weather, the player, the camera and the controls
//   4. pick a quality level that fits this device
//   5. loop forever: read input -> move player -> update world -> draw
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG, urlOption } from './config.js';
import { clamp, DEG } from './utils/math.js';
import { buildLayout } from './city/layout.js';
import { createMaterials, installGlobalShaderPatches, shared } from './city/materials.js';
import { buildCity } from './city/cityBuilder.js';
import { createLighting } from './world/lighting.js';
import { createWeather } from './world/weather.js';
import { createPostFX } from './world/postfx.js';
import { createPlayer } from './player/player.js';
import { createCameraRig } from './player/camera.js';
import { createControls } from './ui/touchControls.js';
import { createMinimap } from './ui/minimap.js';
import { createHUD } from './ui/hud.js';

const hud = createHUD();
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Guess a quality level from what the browser tells us about the device.
// (If the guess is too high, AUTO mode lowers it after a few seconds.)
function guessQuality(renderer) {
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase();
  } catch (e) { /* not available */ }
  const mobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  const memory = navigator.deviceMemory || 4;          // GB (rounded by the browser)
  const cores = navigator.hardwareConcurrency || 4;
  if (/swiftshader|llvmpipe|software/.test(gpu)) return 'low';   // no real graphics chip
  if (!mobile) return /rtx|gtx|radeon rx|apple m\d|arc|rx \d{4}/.test(gpu) ? 'high' : 'medium';
  if (memory <= 3 || cores <= 4 || /mali-4|mali-t|adreno \(tm\) [2-5]\d\d|powervr (sgx|rogue g)/.test(gpu)) return 'low';
  if (memory >= 8 && /adreno \(tm\) (7[3-9]\d|8\d\d)|immortalis|mali-g7[1-9]\d|mali-g[89]\d\d|apple/.test(gpu)) return 'high';
  return 'medium';
}

async function boot() {
  // ------------------------------------------------------------------ renderer
  const canvas = document.getElementById('game');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' });
  } catch (e) {
    hud.showError('This browser cannot show 3D graphics (WebGL 2 is needed). Please try a recent version of Chrome.');
    return;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // film-like handling of bright light
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;                      // we count the draw calls of a whole frame ourselves
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); hud.toast('GRAPHICS WERE RESET - PLEASE RELOAD', 60000); });

  installGlobalShaderPatches();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, CONFIG.camera.near, CONFIG.camera.far);

  // ------------------------------------------------------------- load and build
  hud.setProgress(0.03, 'Loading textures');
  await nextFrame();
  const materials = await createMaterials(renderer, (p) => hud.setProgress(0.03 + 0.27 * p, 'Loading textures'));
  hud.setProgress(0.32, 'Preparing materials');
  await nextFrame();

  const layout = buildLayout();
  const city = await buildCity(scene, layout, materials, (p, text) => hud.setProgress(0.34 + 0.4 * p, text));

  hud.setProgress(0.78, 'Setting up light');
  await nextFrame();
  const postfx = createPostFX(renderer);
  const lighting = createLighting(scene, renderer, city, materials);
  const weather = createWeather(scene, lighting);
  await lighting.tryLoadHDRI();

  hud.setProgress(0.84, 'Loading character');
  const player = await createPlayer(scene, city, materials);
  const rig = createCameraRig(camera, city);
  rig.set(player.heading, CONFIG.camera.startPitch);
  const controls = createControls(hud.dom);
  const minimap = createMinimap(hud.dom.minimap, layout);

  // -------------------------------------------------------------------- quality
  let mode = 'auto';            // what the player picked: auto / low / medium / high
  let active = 'medium';        // the preset that is running now
  let quality = CONFIG.quality.medium;
  let usePost = false;
  let sinceChange = 0, slowTime = 0;
  try { mode = localStorage.getItem('pg-quality') || 'auto'; } catch (e) { /* private mode */ }
  const urlQ = urlOption('quality');
  if (urlQ && (urlQ === 'auto' || CONFIG.quality[urlQ])) mode = urlQ;
  if (mode !== 'auto' && !CONFIG.quality[mode]) mode = 'auto';

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const pr = clamp(dpr * quality.pixelRatio.scale, quality.pixelRatio.min, quality.pixelRatio.max);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // tall screens (phone held upright) get a taller view, so you still see enough to the sides
    if (camera.aspect >= 1) camera.fov = CONFIG.camera.fov;
    else camera.fov = clamp((2 * Math.atan(Math.tan((CONFIG.camera.portraitHFov * DEG) / 2) / camera.aspect)) / DEG, CONFIG.camera.fov, 84);
    camera.far = quality.cameraFar;
    camera.updateProjectionMatrix();
    if (usePost) postfx.resize(w * pr, h * pr, quality.msaa);
    city.props.setViewport(camera.fov, h * pr);
    minimap.resize();
  }

  function applyQuality(name) {
    active = name;
    quality = CONFIG.quality[name];
    usePost = quality.post && postfx.supported;
    materials.setQuality(quality);
    lighting.setQuality(quality);
    lighting.setPostActive(usePost);
    postfx.setQuality(quality);
    weather.setQuality(quality);
    resize();
    city.props.cull(player.position.x, player.position.z, quality.propDistance, true);
    hud.setQualityButtons(mode, quality.label);
    sinceChange = 0;
    slowTime = 0;
  }

  // ------------------------------------------------------------------ one frame
  let time = 0;
  const camDir = new THREE.Vector3();
  function step(dt) {
    time += dt;
    shared.uPgTime.value = time;
    const input = controls.update();
    rig.rotate(input.lookX, input.lookY);
    player.update(dt, input, rig.yaw);
    rig.update(dt, player);
    // test tool: PG.freeCam = { pos: [x, y, z], look: [x, y, z] } puts the camera anywhere
    const fc = window.PG && window.PG.freeCam;
    if (fc) {
      camera.position.set(fc.pos[0], fc.pos[1], fc.pos[2]);
      camera.lookAt(fc.look[0], fc.look[1], fc.look[2]);
    }
    shared.uPgPlayer.value.copy(player.position);
    weather.update(dt);
    lighting.update(dt, player.position, rig.forwardXZ(camDir));
    city.update(dt, time, player.position.x, player.position.z, quality.propDistance);
  }
  function draw() {
    renderer.info.reset();
    if (usePost) postfx.render(scene, camera, time);
    else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  // ------------------------------------------------------------ start settings
  const startTime = urlOption('time');
  if (startTime) {
    if (CONFIG.time.presets[startTime] !== undefined) lighting.jumpTo(startTime);
    else if (!Number.isNaN(parseFloat(startTime))) lighting.setHour(parseFloat(startTime));
  }
  if (urlOption('freeze') === '1') lighting.setRunning(false);
  if (urlOption('rain') === '1') weather.setInstant(true);
  if (urlOption('nohud') === '1') document.body.classList.add('nohud');
  const startPos = urlOption('pos');
  if (startPos) {
    const [x, z] = startPos.split(',').map(parseFloat);
    if (!Number.isNaN(x) && !Number.isNaN(z)) player.teleport(x, z);
  }
  const startYaw = urlOption('yaw'), startPitch = urlOption('pitch');
  if (startYaw !== null) {
    const a = parseFloat(startYaw) * DEG; // compass degrees: 0 north, 90 east, 180 south, 270 west
    rig.set(Math.atan2(-Math.sin(a), Math.cos(a)), startPitch !== null ? parseFloat(startPitch) * DEG : CONFIG.camera.startPitch);
  }
  let statsOn = CONFIG.showStats || urlOption('stats') === '1';
  hud.showStats(statsOn);

  applyQuality(mode === 'auto' ? guessQuality(renderer) : mode);

  // -------------------------------------------- make the GPU prepare all shaders
  // Day and night use different shader programs (night has the street lamps as
  // real lights). We draw one hidden frame of each now, so there is no pause
  // later when night falls.
  hud.setProgress(0.9, 'Warming up');
  await nextFrame();
  step(0.016);
  const wasNight = lighting.nightMode;
  lighting.forceNight(!wasNight);
  draw();
  await nextFrame();
  lighting.forceNight(wasNight);
  draw();
  hud.setProgress(1, 'Ready');
  await nextFrame();

  // -------------------------------------------------------------------- buttons
  hud.actions.time = (name) => {
    lighting.jumpTo(name);
    hud.toast(name.toUpperCase());
  };
  hud.actions.rain = () => {
    const on = weather.toggle();
    hud.setRainButton(on);
    hud.toast(on ? 'RAIN' : 'RAIN STOPS');
  };
  hud.actions.quality = (m) => {
    mode = m;
    try { localStorage.setItem('pg-quality', m); } catch (e) { /* private mode */ }
    hud.toast('APPLYING…', 900);
    // wait one frame so the message is visible before the short pause
    requestAnimationFrame(() => applyQuality(m === 'auto' ? guessQuality(renderer) : m));
  };
  hud.actions.stats = () => {
    statsOn = !statsOn;
    hud.showStats(statsOn);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') {
      const order = ['morning', 'noon', 'sunset', 'night'];
      const h = lighting.hour;
      const next = h < 7 ? 'morning' : h < 12 ? 'noon' : h < 18 ? 'sunset' : h < 22.5 ? 'night' : 'morning';
      hud.actions.time(order.includes(next) ? next : 'morning');
    } else if (e.code === 'KeyR') hud.actions.rain();
    else if (e.code === 'KeyF') hud.actions.stats();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // ---------------------------------------------------------------- main loop
  let last = performance.now();
  let frames = 0, fpsTimer = 0, fps = 60, mapTimer = 0;
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0.0001, (now - last) / 1000)); // never jump more than 1/10 s
    last = now;
    step(dt);
    draw();

    // ---- HUD (not every frame: text and map do not need 60 updates a second) ----
    frames++;
    fpsTimer += dt;
    mapTimer += dt;
    sinceChange += dt;
    if (mapTimer > 0.066) {
      mapTimer = 0;
      minimap.draw(player.position.x, player.position.z, player.heading);
    }
    if (fpsTimer >= 0.5) {
      fps = frames / fpsTimer;
      frames = 0;
      fpsTimer = 0;
      hud.setLocation(layout.districtAt(player.position.x, player.position.z));
      hud.setClock(lighting.hour);
      hud.setWeather(weather.amount > 0.3 ? 'RAIN' : lighting.info.night > 0.6 ? 'NIGHT' : 'CLEAR');
      if (statsOn) {
        const r = renderer.info.render;
        hud.setStats(`${Math.round(fps)} FPS  ·  ${r.calls} DRAW CALLS\n${Math.round(r.triangles / 1000)}K TRIANGLES  ·  ${quality.label} ${renderer.getPixelRatio().toFixed(2)}x`);
      }
      // AUTO quality: if the game runs slowly for a while, go one level down
      if (mode === 'auto' && sinceChange > 5 && !document.hidden) {
        slowTime = fps < 42 ? slowTime + 0.5 : Math.max(0, slowTime - 0.25);
        if (slowTime >= 3 && active !== 'low') {
          applyQuality(active === 'high' ? 'medium' : 'low');
          hud.toast(`QUALITY: ${quality.label}`);
        }
      }
    }
  }

  // tools for testing from the browser console (and for screenshots)
  window.PG = {
    THREE, CONFIG, renderer, scene, camera, city, layout, lighting, weather, player, rig, controls, materials, shared, postfx,
    applyQuality, step, draw,
    get quality() { return active; },
    get fps() { return fps; },
    get time() { return time; },
    ready: true,
  };

  hud.hideLoading();
  requestAnimationFrame((t) => { last = t; loop(t); });
}

boot().catch((err) => {
  console.error(err);
  hud.showError(`Something went wrong while starting the game: ${err && err.message ? err.message : err}`);
});
