// ---------------------------------------------------------------------------
// main.js - starts the game and runs the main loop.
//
// Order of things:
//   1. create the renderer (the thing that draws)
//   2. load textures and build the city
//   3. create lighting, weather, the player, the camera and the controls
//   4. pick a quality level that fits this device
//   5. loop forever: read input -> move player or car -> traffic and people
//      -> missions, map and GPS -> update world -> draw
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG, urlOption } from './config.js';
import { clamp, smoothstep, DEG } from './utils/math.js';
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
import { createGPS } from './ui/gps.js';
import { createSound } from './audio/sound.js';
import { createVehicles } from './vehicles/vehicle.js';
import { CAR_TYPES } from './vehicles/carModels.js';
import { loadCarLibrary } from './vehicles/carLibrary.js';
import { createMissions } from './missions/missionManager.js';

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
  if (/apple/.test(gpu)) return 'medium';              // iPhones and iPads: fast chips, but they do not tell us more
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
  const materials = await createMaterials(renderer, (p, text) => hud.setProgress(0.03 + 0.27 * p, text || 'Loading textures'));
  hud.setProgress(0.32, 'Preparing materials');
  await nextFrame();

  const layout = buildLayout();
  // car model files (assets/cars); without them the game uses only the cars made in code
  hud.setProgress(0.33, 'Loading cars');
  const carLib = await loadCarLibrary();
  const city = await buildCity(scene, layout, materials, (p, text) => hud.setProgress(0.34 + 0.4 * p, text), carLib);

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

  // ------------------------------------------------- Phase 2: cars, sound, GPS, missions
  const sound = createSound();
  // browsers only allow sound after the first tap or key press
  const unlockSound = () => sound.unlock();
  window.addEventListener('pointerdown', unlockSound, { capture: true });
  window.addEventListener('keydown', unlockSound, { capture: true });
  const vehicles = createVehicles({ scene, city, materials, sound, weather, carLib });
  const gps = createGPS(layout);
  const missions = createMissions({ scene, city, vehicles, hud, sound });
  let waypoint = null;          // a place the player tapped on the big map
  let route = null;             // list of points along the roads (for the minimap)
  let routeTimer = 0, nearTimer = 0, lastSteps = 0, wasDriving = false;
  let missionState = missions.state;
  const obstacles = [];         // what the traffic must not hit: the player or the player's car
  const _mark = new THREE.Vector3();

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
    city.setQuality(quality);
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
    // ---- E key / CAR button: get in, or stop and get out ----
    if (input.action) carAction();
    if (input.map) hud.actions.map();
    rig.rotate(input.lookX, input.lookY);
    const onFoot = vehicles.state === 'none';
    if (onFoot) player.update(dt, input, rig.yaw);
    const px = player.position.x, pz = player.position.z;
    const night = shared.uPgNight.value, rain = weather.amount;

    // ---- traffic and people (they keep away from the player and the player's car) ----
    obstacles.length = 0;
    const car = vehicles.active;
    if (car && !onFoot) {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      for (const k of [-1.4, 0, 1.4]) obstacles.push({ x: car.x + fx * k, z: car.z + fz * k, r: 1.0 });
    } else obstacles.push({ x: px, z: pz, r: 0.4 });
    city.traffic.update(dt, time, px, pz, obstacles, city.people.people, night);
    city.people.update(dt, time, px, pz, obstacles, night, rain > 0.3 ? 1 : 0);

    // ---- the player's car (after the traffic, so it can bump into it) ----
    vehicles.update(dt, input.drive, player, night);
    const driving = vehicles.driving;
    if (driving !== wasDriving) {
      wasDriving = driving;
      hud.setDriving(driving, driving && vehicles.active ? CAR_TYPES[vehicles.active.kind].label : '');
      if (driving) rig.startChase(); else rig.endChase();
    }
    if (driving && vehicles.active) rig.updateChase(dt, vehicles.active, vehicles.shake);
    else rig.update(dt, player);

    // ---- footsteps: a different sound on sand ----
    if (player.steps !== lastSteps) {
      lastSteps = player.steps;
      if (onFoot) sound.footstep(pz < layout.neon.promenadeMinZ ? 'sand' : 'concrete', player.speed > 3);
    }

    // ---- mission, waypoint, GPS route ----
    missionState = missions.update(dt, { x: px, z: pz, inCar: vehicles.state === 'driving', car: vehicles.active, speed: car ? Math.hypot(car.vx, car.vz) : player.speed });
    if (waypoint && Math.hypot(waypoint.x - px, waypoint.z - pz) < 14) { waypoint = null; hud.toast('YOU HAVE ARRIVED'); sound.chime(); }
    const goal = waypoint || missionState.marker;
    routeTimer -= dt;
    if (!goal) route = null;
    else if (routeTimer <= 0) { routeTimer = 0.6; route = gps.route(px, pz, goal.x, goal.z); }
    // the CAR button shows up next to a car
    nearTimer -= dt;
    if (nearTimer <= 0) { nearTimer = 0.2; hud.showCarButton(onFoot && !!vehicles.nearest(px, pz)); }
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
    updateSunGlow(dt);
  }
  // Get into the nearest car, or (when driving) stop and get out.
  function carAction() {
    if (vehicles.state === 'none') {
      if (!vehicles.tryEnter(player)) hud.toast('NO CAR NEAR YOU', 1200);
    } else if (vehicles.state === 'driving') vehicles.requestExit();
  }

  // ---- HUD things that follow the world: GPS arrow, floating marker, speed ----
  function updateGuides() {
    hud.setSpeed(vehicles.speedKmh);
    hud.setMission(missionState.active ? missionState : null);
    const goal = waypoint || missionState.marker;
    if (!goal) { hud.setArrow(null); hud.setMarker(null); return; }
    const px = player.position.x, pz = player.position.z;
    const dist = Math.hypot(goal.x - px, goal.z - pz);
    // the arrow points along the route (about 28 m ahead), seen from the camera
    const aim = route && route.length > 1 && dist > 34 ? gps.pointAhead(route, 28) : goal;
    const dx = aim.x - px, dz = aim.z - pz;
    const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw);
    hud.setArrow(Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz), route && route.length > 1 ? gps.length(route) : dist);
    // the marker floats over the goal (hidden when it is behind the camera)
    _mark.set(goal.x, city.groundHeight(goal.x, goal.z) + 2.6, goal.z).project(camera);
    if (_mark.z < 1 && Math.abs(_mark.x) < 1.05 && Math.abs(_mark.y) < 1.05) hud.setMarker((_mark.x * 0.5 + 0.5) * window.innerWidth, (-_mark.y * 0.5 + 0.5) * window.innerHeight, dist);
    else hud.setMarker(null);
  }
  const mapExtra = () => ({ inCar: vehicles.driving, cars: city.traffic.cars, waypoint, marker: missionState.marker, route });

  // ---- sun glow: is the sun on the screen, and do buildings hide it? ----
  const _sun = new THREE.Vector3(), _camFwd = new THREE.Vector3(), _ray = new THREE.Vector3();
  let sunSeen = 0; // 0 = hidden .. 1 = fully visible (changes smoothly)
  // does a line from the camera toward (dx, dy, dz) hit a building?
  function skyBlocked(dx, dy, dz) {
    const o = camera.position;
    for (const b of city.colliders.boxes) {
      if (b.h < o.y + 0.5) continue;
      // where the line enters and leaves the box (seen from above)
      let t0 = 0, t1 = 2000;
      if (Math.abs(dx) < 1e-6) { if (o.x < b.minX || o.x > b.maxX) continue; }
      else { const a = (b.minX - o.x) / dx, c = (b.maxX - o.x) / dx; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
      if (Math.abs(dz) < 1e-6) { if (o.z < b.minZ || o.z > b.maxZ) continue; }
      else { const a = (b.minZ - o.z) / dz, c = (b.maxZ - o.z) / dz; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
      if (t0 > t1) continue;
      if (o.y + dy * t0 < b.h) return true; // the line is still below the roof when it reaches the box
    }
    return false;
  }
  function updateSunGlow(dt) {
    const info = lighting.info;
    let target = 0, sx = 0.5, sy = 0.5;
    if (usePost && info.sunDir && info.sunDir.y > -0.02 && info.sunLevel > 0.02) {
      camera.getWorldDirection(_camFwd);
      if (_camFwd.dot(info.sunDir) > 0.15) {
        _sun.copy(camera.position).addScaledVector(info.sunDir, 1000).project(camera);
        sx = _sun.x * 0.5 + 0.5; sy = _sun.y * 0.5 + 0.5;
        // fades out when the sun leaves the screen
        const edge = 1 - smoothstep(0.95, 1.35, Math.max(Math.abs(_sun.x), Math.abs(_sun.y)));
        if (edge > 0) {
          // five lines toward the sun disc: how many of them reach the sky?
          let open = 0;
          const d = info.sunDir;
          for (const [ox, oy] of [[0, 0], [0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]]) {
            _ray.set(d.x - d.z * ox, d.y + oy, d.z + d.x * ox).normalize();
            if (!skyBlocked(_ray.x, _ray.y, _ray.z)) open++;
          }
          target = (open / 5) * edge;
        }
      }
    }
    sunSeen += (target - sunSeen) * Math.min(1, dt * 7);
    if (!postfx.setSun) return;
    const c = info.sunColor || [1, 1, 1];
    // strength: strong low sun, softer at noon; weaker in rain (sunPower already knows about rain)
    const k = sunSeen * Math.min(1, (info.sunPower || 0) / 6) * 0.9 / Math.max(renderer.toneMappingExposure, 0.2) * 0.42;
    postfx.setSun(sx, sy, c[0] * k, c[1] * k, c[2] * k);
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
  hud.actions.car = carAction;
  hud.actions.sound = () => {
    sound.setMuted(!sound.muted);
    hud.setSoundButton(!sound.muted);
    hud.toast(sound.muted ? 'SOUND OFF' : 'SOUND ON', 1000);
  };
  hud.actions.dialog = () => missions.advanceDialog();
  // ---- the big map: tap to set a waypoint ----
  const drawBigMap = () => minimap.drawBig(hud.dom.bigmapCanvas, player.position.x, player.position.z, player.heading, mapExtra());
  hud.actions.map = () => {
    hud.showBigMap(!hud.bigMapOpen);
    if (hud.bigMapOpen) requestAnimationFrame(drawBigMap);
  };
  hud.actions.mapClose = () => hud.showBigMap(false);
  hud.actions.mapClear = () => { waypoint = null; route = null; routeTimer = 0; drawBigMap(); };
  hud.dom.bigmapCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const box = hud.dom.bigmapCanvas.getBoundingClientRect();
    const w = minimap.bigToWorld(e.clientX - box.left, e.clientY - box.top);
    if (!w) return;
    waypoint = w;
    route = gps.route(player.position.x, player.position.z, w.x, w.z);
    routeTimer = 0.6;
    drawBigMap();
    hud.toast('WAYPOINT SET', 1000);
  });
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
      minimap.draw(player.position.x, player.position.z, player.heading, mapExtra());
      if (hud.bigMapOpen) drawBigMap();
    }
    updateGuides();
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
    vehicles, missions, gps, sound, hud, minimap, carLib,
    applyQuality, step, draw, carAction, updateGuides,
    get waypoint() { return waypoint; },
    set waypoint(w) { waypoint = w; routeTimer = 0; },
    get route() { return route; },
    get quality() { return active; },
    get fps() { return fps; },
    get time() { return time; },
    ready: true,
  };

  // the placeholder mission starts by itself (add "?mission=0" to the address to play without it)
  if (urlOption('mission') !== '0') missions.start('meet-at-neon-mile');

  hud.hideLoading();
  requestAnimationFrame((t) => { last = t; loop(t); });
}

boot().catch((err) => {
  console.error(err);
  hud.showError(`Something went wrong while starting the game: ${err && err.message ? err.message : err}`);
});
