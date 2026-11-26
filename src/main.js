// ---------------------------------------------------------------------------
// main.js - starts the game and runs the main loop.
//
// Order of things:
//   1. create the renderer (the thing that draws)
//   2. load textures and build the city
//   3. create lighting, weather, the player, the camera and the controls
//   4. pick a quality level that fits this device
//   5. loop forever: read input -> move player or vehicle -> traffic, people,
//      police -> story or missions, map and GPS -> update world -> draw
//
// THE THREE WAYS TO PLAY
//   title   the title screen (CONTINUE, NEW GAME, MISSIONS, FREE ROAM, SETTINGS)
//   story   the Prologue and the chapters (src/story)
//   free    free roam: the whole city, the test garage, the old test buttons
// Address options for testing:  ?story=0 (straight into free roam),
//   ?story=prologue.1 or ?story=chapter01.4 (straight into a mission)
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG, urlOption } from './config.js';
import { clamp, smoothstep, DEG } from './utils/math.js';
import { buildLayout } from './city/layout.js';
import { createMaterials, installGlobalShaderPatches, shared, setTunnelLight, tunnelLightOn, tunnelLampAt } from './city/materials.js';
import { tunnelInfo } from './city/tunnel.js';
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
import { CAR_TYPES, carInfo } from './vehicles/carModels.js';
import { loadVehicles } from './vehicles/vehicleLoader.js';
import { createEffects } from './vehicles/effects.js';
import { createWanted, FINE } from './ai/wanted.js';
import { createMissions } from './missions/missionManager.js';
import { createStoryUI } from './ui/storyUI.js';
import { createMusic } from './audio/music.js';
import { createSave } from './story/save.js';
import { createActors, jacketLook } from './story/actors.js';
import { createDrivers } from './story/drivers.js';
import { createDirector } from './story/director.js';
import { createProps } from './story/props.js';
import { createStory } from './story/engine.js';
import { createStreetLife } from './ai/streetLife.js';
import { t } from './story/strings.js';
import { GARAGE, PARKING } from './city/heroBuildings.js';
import { takePortrait } from './ui/portrait.js';
import { setCharacterFill, characterLight } from './characters/characterLook.js';
import { createInteriors } from './interiors/interiors.js';
import { createRaces } from './race/raceManager.js';
import { createSpectators } from './race/spectators.js';
import { createZero } from './ai/zero.js';
import { raceLook } from './story/propsRace.js';
import { createGarageSet } from './story/garageSet.js';
import { createRearView } from './story/rearView.js';

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
  // vehicle model files (assets/vehicles); without them the game uses only the cars made in code
  hud.setProgress(0.33, 'Loading vehicles');
  const carLib = await loadVehicles();
  const city = await buildCity(scene, layout, materials, (p, text) => hud.setProgress(0.34 + 0.4 * p, text), carLib);

  hud.setProgress(0.78, 'Setting up light');
  await nextFrame();
  const postfx = createPostFX(renderer);
  const lighting = createLighting(scene, renderer, city, materials);
  const weather = createWeather(scene, lighting);
  await lighting.tryLoadHDRI();

  hud.setProgress(0.84, 'Loading character');
  const player = await createPlayer(scene, city, materials, (f, text) => hud.setProgress(0.84 + 0.05 * f, text));
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
  // driving assist: off / normal (traction control + ABS) / easy (also helps with steering)
  const settings = { assist: 'normal' };
  try { const a = localStorage.getItem('pg-assist'); if (a === 'off' || a === 'normal' || a === 'easy') settings.assist = a; } catch (e) { /* private mode */ }
  const effects = createEffects(scene);                 // smoke, sparks, skid marks, lamp glow
  const vehicles = createVehicles({ scene, city, materials, sound, weather, carLib, effects, settings });
  vehicles.riggedDriver = player.autoRigged;
  const garage = vehicles.buildGarage();                // one of each vehicle, parked next to the start point
  const gps = createGPS(layout);
  const storyProps = createProps();
  // the Meridian Guard: stars, chasing cars, drones, scanner gates, hiding (src/ai/wanted.js)
  const police = createWanted({ scene, vehicles, gps, layout, city, props: storyProps, sound });
  // garages with a roof: a car parked inside cannot be seen by the drones
  const SHELTERS = [GARAGE.ready ? GARAGE.inside : null, PARKING.ready ? PARKING.inside : null].filter(Boolean);
  for (const b of SHELTERS) police.addSpot({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ });
  // THE SUNK (Chapter 3): the drain tunnel, the space under a bridge, a market tarp, Lena's flat, the Guard hut:
  // roofs that keep the rain off and hide a boat (or a person) from the drones
  const SK = city.sunk;
  if (SK) for (const b of SK.spots) { SHELTERS.push(b); police.addSpot({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ }); }
  // RUSTWATER DOCKS (Chapter 5): Rask's building and the covered market keep the rain out too
  if (city.docks) for (const b of city.docks.spots) { SHELTERS.push(b); police.addSpot({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ }); }
  // THE IRONHILL TUNNEL (Chapter 8, src/city/tunnel.js): its lamps light the road, the walls and the cars in the city
  // shaders; no rain falls under its roof; its air is a warm dark haze
  const TUN = layout.highway.tunnel ? tunnelInfo(layout.highway) : null;
  const TUN_ROOF = TUN ? { minX: TUN.minX, maxX: TUN.maxX, minZ: TUN.minZ, maxZ: TUN.maxZ, top: TUN.ceil } : null;
  if (TUN) setTunnelLight({ ...TUN, power: 11, color: [1.0, 0.5, 0.15] });
  // (how close the camera is to the tunnel: 0 far away .. 1 inside; 'deep': how far inside, for the haze)
  const tunnelNear = (p) => {
    if (!TUN) return { near: false, deep: 0 };
    const dx = Math.max(TUN.minX - p.x, 0, p.x - TUN.maxX), dz = Math.max(TUN.minZ - p.z, 0, p.z - TUN.maxZ);
    const inside = dx < 0.5 && p.y > TUN.floor - 2 && p.y < TUN.ceil;
    const fromMouth = Math.min(p.z - TUN.minZ, TUN.maxZ - p.z);
    return { near: dx < 120 && dz < 420, close: dx < 60 && dz < 180, deep: inside ? clamp((fromMouth + 6) / 40, 0, 1) : 0 };
  };
  const sunkBoats = [], sunkWalker = { x: 0, z: 0, vx: 0, vz: 0, heading: 0 };
  let lenaCam = false;           // the camera is in "room" mode in Lena's flat
  let marketHush = 0;            // 0..1: the Tidewalkers at the market have gone quiet (Nate is close)
  // the garage's repair point: a glowing ring on the road (drive onto it to fix the car)
  const repairRing = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fe0a0, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10 }));
  repairRing.position.set(garage.repair.x, city.groundHeight(garage.repair.x, garage.repair.z) + 0.03, garage.repair.z);
  repairRing.renderOrder = 12;
  scene.add(repairRing);
  // one real lamp for the flashing police lights (only at night, like the street lamps)
  const flashLight = new THREE.PointLight(0xff2010, 0, 26, 2);
  flashLight.visible = false;
  flashLight.layers.enable(4);          // (the story's lamp also lights a room of its own: Mace's garage in Chapter 6)
  scene.add(flashLight);
  const sirens = [], tags = [];
  const CAM_MODES = ['chase', 'close', 'hood', 'cockpit'];
  let baseFov = CONFIG.camera.fov, fovNow = CONFIG.camera.fov, pixelH = 720, stars = 0;
  const missions = createMissions({ scene, city, vehicles, hud, sound });

  // ------------------------------------------------- Phase 4: the story
  const ui = createStoryUI();                           // film bars, subtitles, choices, menus
  const music = createMusic(sound);                     // the mixtape, rain, the chase pad
  const save = createSave();
  const actors = createActors({ scene, city, materials, player, vehicles, camera });
  const drivers = createDrivers({ vehicles, gps, city, player, sound });
  // free roam: small moments in the streets (people with their own business, overheard lines)
  const streetLife = createStreetLife({ actors, props: storyProps, vehicles, ui, scene, player, city });
  let story = null;
  const director = createDirector(camera, (place) => story.pt(place));
  let gameMode = 'boot';        // title | story | free
  let menuWas = false;          // (a menu was on the screen last frame: body.menu-open)
  let paused = false, frozen = false, idleFrames = 0, fovSent = 0;
  // things of Mace's garage that belong to the city (there in every mode): the cloth over Theo's car, the roller door
  const world = {};
  if (GARAGE.ready) {
    world.tarp = storyProps.make('tarp', GARAGE.tarpSize);
    world.tarp.position.fromArray(GARAGE.tarp);
    world.tarp.rotation.y = GARAGE.rot;
    scene.add(world.tarp);
    const d = GARAGE.doorSize;
    world.shutter = storyProps.make('shutter', { width: d.r1 - d.r0 - 0.02, height: d.top - GARAGE.curb - 0.25, open: 1 });
    world.shutter.position.fromArray(GARAGE.at((d.r0 + d.r1) / 2, d.top - 0.25, 6.78));
    world.shutter.rotation.y = GARAGE.rot;
    scene.add(world.shutter);
  }
  // CHAPTER 6: Mace's garage at night as a room of its own (src/story/garageSet.js) - built the first time the story
  // shows it; while it is shown the city is not drawn at all
  if (GARAGE.ready) world.garageSet = createGarageSet({ scene, renderer, camera, GARAGE, mats: materials.mats, lighting, colliders: city.colliders, sound });
  // a rear-view mirror for a film shot (Chapter 6, "Leave": the garage door behind the van, getting smaller)
  world.rearView = createRearView({ renderer, scene, camera });
  // (what the set's camera must see besides the room: the player, the story's people and things - a fresh list four
  //  times a second, see garageSet.update)
  const garageCast = () => [player.root, ...actors.list.map((a) => a.root), ...[...story.things.values()].map((o) => o.holder)];
  // SLOW MOTION (Chapter 4: the half second at the last turn): scale = how fast time goes, for a few real seconds
  const slow = { scale: 1, left: 0, set(scale, seconds) { this.scale = scale; this.left = seconds; } };
  // RACES (src/race): the race of the moment, and the people who watch it
  const spectators = createSpectators(scene);
  const races = createRaces({ scene, camera, city, layout, vehicles, player, sound, effects, spectators, settings: ui.settings, text: t, rigStart: () => rig.startChase() });
  world.races = races; world.slow = slow;
  // ZERO (src/ai/zero.js): after Chapter 4 it can come out of the dark behind Nate in free roam; in the final race it
  // goes through the field (the story calls it)
  const zero = createZero({ vehicles, drivers, music, sound, effects, flags: () => (story && story.active ? story.flags : save.data.flags) });
  world.zero = zero;
  // THEO'S JACKET (Chapter 4, when Nate took it on the roof): from then on Nate wears it, and a small sign of it is
  // on the screen
  const jacket = { on: false, badge: null, base: null, mat: null, forced: false };
  world.jacket = (on) => { jacket.forced = on; };
  story = createStory({
    scene, camera, city, layout, vehicles, player, actors, drivers, director, props: storyProps, ui, music, sound, save, police, lighting, weather, hud, rig, carLib, world,
    onExit: () => showTitle(),
    // free roam: caught by the Guard - a fine, and the game goes on
    onFreeBusted: () => { const left = save.pay(FINE); hud.toast(`BUSTED  ·  FINE ${FINE} CR  ·  ${left} CR LEFT`, 3200); },
  });
  // the name on Mace's garage (it belongs to the city, so it is there in every mode)
  if (GARAGE.ready) {
    const sign = storyProps.make('garageSign', { width: GARAGE.sign.width, height: GARAGE.sign.height });
    sign.position.fromArray(GARAGE.sign.pos);
    sign.rotation.y = GARAGE.rot;
    scene.add(sign);
  }
  // HOUSES YOU CAN WALK INTO (src/interiors): real doors on the start street, rooms built far away
  const interiors = createInteriors({ scene, renderer, camera, player, rig, ui, hud, sound, lighting });
  // NATE'S FACE for the WANTED posters and the news (a picture of the player character's own head, taken once)
  let portraitURL = null;
  if (player.rig && player.rig.bones && player.rig.bones.head) {
    const cv = takePortrait(renderer, scene, { root: player.root, head: player.rig.bones.head, heading: player.heading }, setCharacterFill);
    if (cv) { storyProps.setPortrait(cv); try { portraitURL = cv.toDataURL('image/jpeg', 0.82); } catch (e) { portraitURL = null; } }
  }
  // sound settings from the last visit
  sound.setVolume(ui.settings.volume);
  sound.setMuted(ui.settings.muted);
  hud.setSoundButton(!ui.settings.muted);
  let goalState = missions.state;   // what the HUD shows: the story's objective or the free roam mission
  let waypoint = null;          // a place the player tapped on the big map
  let route = null;             // list of points along the roads (for the minimap)
  let routeTimer = 0, nearTimer = 0, lastSteps = 0, lastSplashes = 0, lastStrokes = 0, wasDriving = false;
  let missionState = missions.state;
  const obstacles = [];         // what the people step away from: the player or the player's car
  const carObstacles = [];      // what the traffic must not drive into: the same, and every other real vehicle
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

  // DYNAMIC RESOLUTION: a phone that keeps 60 frames per second easily gets a sharper picture (more pixels, up to
  // pixelRatio.dynMax of the quality level); when it gets slow, the picture gets a little softer again before the
  // frame rate drops (never below 80 % of the normal setting). Address option dynres=0 switches it off (tests).
  let resK = 1;
  const dynRes = urlOption('dynres') !== '0';
  let resFrames = 0, resTime = 0, resGood = 0, resHold = 0;     // resHold: seconds before the next change is allowed
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const base = clamp(dpr * quality.pixelRatio.scale, quality.pixelRatio.min, quality.pixelRatio.max);
    const top = Math.max(base, Math.min(quality.pixelRatio.dynMax || base, dpr));
    const pr = clamp(base * resK, Math.max(0.6, base * 0.8), top);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // tall screens (phone held upright) get a taller view, so you still see enough to the sides
    // (a very wide phone: the view left-right is capped, or everything near the edges of the picture looks fat)
    if (camera.aspect >= 1) camera.fov = Math.min(CONFIG.camera.fov, (2 * Math.atan(Math.tan((CONFIG.camera.maxHFov * DEG) / 2) / camera.aspect)) / DEG);
    else camera.fov = clamp((2 * Math.atan(Math.tan((CONFIG.camera.portraitHFov * DEG) / 2) / camera.aspect)) / DEG, CONFIG.camera.fov, 84);
    baseFov = fovNow = camera.fov;
    pixelH = h * pr;
    effects.setViewport(camera.fov, pixelH);
    spectators.setViewport(camera.fov, pixelH);
    interiors.setViewport(pixelH);
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
    interiors.setQuality(quality);
    spectators.setQuality(quality);
    raceLook.reflections = !!quality.post;          // (LOW: no streaks of light under the signs of Chapter 4)
    resK = 1;                                       // (a new level starts at its normal sharpness)
    resize();
    city.props.cull(player.position.x, player.position.z, quality.propDistance, true);
    hud.setQualityButtons(mode, quality.label);
    sinceChange = 0;
    slowTime = 0;
  }

  // ------------------------------------------------------------------ one frame
  let time = 0;
  const LOCK_ALL = { move: true, drive: true, look: true, action: true };
  // where the title screen's camera stands and looks (across the street from Mace's garage)
  // (a little to the side, so the lit garage door is not hidden behind the menu)
  const TITLE = GARAGE.ready ? { x: GARAGE.door[0] + 18.6, z: GARAGE.door[2] - 6.5, lookX: GARAGE.door[0] } : { x: 1.6, z: 77, lookX: -17 };
  const camDir = new THREE.Vector3();
  // ---- free roam: while Zero follows, the rear-view mirror comes up and shows it (a cold bar of light, far behind) ----
  const zeroMirror = { on: false, n: 0, items: [] };
  function zeroInMirror() {
    const zf = !story.active ? zero.follower : null, c = vehicles.state === 'driving' ? vehicles.active : null;
    if (zf && c && c.isCar) {
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading), dx = zf.x - c.x, dz = zf.z - c.z;
      const back = -(dx * fx + dz * fz), left = dx * fz - dz * fx;
      zeroMirror.items.length = 0;
      if (back > 2 && back < 150 && zf.lights !== 'off') zeroMirror.items.push({ side: clamp(-left / Math.max(5, back * 0.4), -1, 1), dist: back, kind: 'zero' });
      if (!zeroMirror.on) { zeroMirror.on = true; ui.mirror(true); }
      if (++zeroMirror.n % 2 === 0) ui.drawMirror(zeroMirror.items, time);
    } else if (zeroMirror.on) { zeroMirror.on = false; ui.mirror(false); }
  }
  // ---- Theo's jacket: Nate wears it, and the sign on the screen ----
  function updateJacket() {
    const f = story.active ? story.flags : save.data.flags;
    // (not while a chapter up to Chapter 4 is played: there he has not taken it yet, or holds it in his hands)
    const early = story.active && /^(prologue|chapter0[1-4])$/.test(story.where.chapter || '');
    const want = gameMode !== 'title' && ((!!(f && f.jacket_taken) && !early) || !!jacket.forced);
    if (want !== jacket.on) {
      jacket.on = want;
      if (want && !jacket.badge) {
        jacket.badge = document.createElement('div');
        jacket.badge.id = 'jacket-badge';
        jacket.badge.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 3 L12 6 L16 3 L21 6 L22 15 L19 16 L18 10 L18 21 L6 21 L6 10 L5 16 L2 15 L3 6 Z" fill="#2f7fd0" stroke="#e8edf2" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 6 L12 21" stroke="#e8edf2" stroke-width="1"/></svg><span>' + t('ui.jacket') + '</span>';
        const host = document.getElementById('hud-top-left') || document.body;
        host.appendChild(jacket.badge);
      }
      if (jacket.badge) jacket.badge.hidden = !want;
    }
    // he WEARS it: the jacket painted over his own clothes (the model cannot change clothes; see jacketLook in
    // src/story/actors.js), the right size for him
    const R = player.rig;
    if (R && R.mesh) {
      if (!jacket.base) jacket.base = R.mesh.material;
      if (want && !jacket.mat) jacket.mat = jacketLook(R, { color: [0.11, 0.42, 0.78], cuff: 0.9, hem: 0.04 });
      const m = want ? jacket.mat : jacket.base;
      if (R.mesh.material !== m) R.mesh.material = m;
    }
  }
  function step(dt) {
    time += dt;
    shared.uPgTime.value = time;
    const input = controls.update();
    const S = story.active ? story : null;
    // (a menu on the screen - pause, settings, an end card: the panels of the mini-games step back under it)
    { const mo = ui.menuOpen; if (mo !== menuWas) { menuWas = mo; document.body.classList.toggle('menu-open', mo); } }
    // ---- the story (or the title screen) can take the controls away for a moment ----
    const lock = gameMode === 'title' ? LOCK_ALL : S ? S.locks : null;
    if (lock) {
      if (lock.move) { input.moveX = 0; input.moveY = 0; input.run = false; }
      if (lock.drive) { const d = input.drive; d.steer = 0; d.gas = 0; d.brake = 0; d.handbrake = true; d.nitro = false; d.horn = false; d.up = false; d.down = false; d.ram = false; d.turn = false; }
      if (lock.look) { input.lookX = 0; input.lookY = 0; input.map = false; input.camera = false; }
      if (lock.action) input.lights = false;
    }
    // ---- E key: the story's TALK / TAKE button when it is shown, else get in or out of a car ----
    // (walking through a door: the player stands still for that moment)
    if (interiors.busy) { input.moveX = 0; input.moveY = 0; input.run = false; input.action = false; }
    if (input.action) { if (ui.actShown) ui.act(); else if (!(lock && lock.action)) carAction(); }
    if (input.map) hud.actions.map();
    if (input.camera) hud.actions.camera();
    if (input.lights) hud.actions.lights();
    rig.rotate(input.lookX, input.lookY);
    const onFoot = vehicles.state === 'none';
    // (in a story scene the character can be posed somewhere: then it does not listen to the stick)
    if (onFoot) { if (player.staged) player.tick(dt); else player.update(dt, input, rig.yaw); }
    // inside a house the player is far away from the city: the street goes on living around the door
    const inside = interiors.inside;
    const AP = inside ? interiors.anchor : player.position;
    const px = AP.x, pz = AP.z;
    const night = shared.uPgNight.value, rain = weather.amount;

    // ---- traffic and people (they keep away from the player and the player's car) ----
    obstacles.length = 0;
    const car = vehicles.active;
    if (car && !onFoot) {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      // (speed and direction: people jump out of the way of a fast car; damaged: the traffic passes slowly)
      const sp = Math.hypot(car.vx, car.vz), flying = car.role === 'drone' && car.alt > 2.5, atSea = car.role === 'boat';
      if (!flying && !atSea) for (const k of car.circles) obstacles.push({ x: car.x + fx * k, z: car.z + fz * k, r: car.radius, speed: sp, dx: sp > 0.1 ? car.vx / sp : fx, dz: sp > 0.1 ? car.vz / sp : fz, damaged: car.damage > 0.6 });
    } else obstacles.push({ x: px, z: pz, r: 0.4 });
    // the traffic also sees the police, the story and race cars and the cars standing at the curb (it brakes and
    // waits for them, it never drives through them), and a trailer behind a truck
    carObstacles.length = 0;
    for (const o of obstacles) carObstacles.push(o);
    for (const q of vehicles.live) {
      if (q === car && !onFoot) continue;
      if (q.away || q.ghost || q.role === 'boat' || (q.role === 'drone' && q.alt > 2.5) || !q.circles) continue;
      // (as far out as the traffic goes: 250 m)
      if (Math.abs(q.x - px) > 260 || Math.abs(q.z - pz) > 260 || q.y > 2.5) continue;
      const fx = Math.sin(q.heading), fz = Math.cos(q.heading), sp = Math.hypot(q.vx || 0, q.vz || 0);
      for (const k of q.circles) carObstacles.push({ x: q.x + fx * k, z: q.z + fz * k, r: q.radius, speed: sp, dx: sp > 0.1 ? q.vx / sp : fx, dz: sp > 0.1 ? q.vz / sp : fz, damaged: q.damage > 0.6, kin: !!q.kin });
    }
    vehicles.cargo.circles((x, z, r) => carObstacles.push({ x, z, r }));
    city.traffic.update(dt, time, px, pz, carObstacles, city.people.people, night, police.sirens(sirens));
    city.people.update(dt, time, px, pz, obstacles, night, rain > 0.3 ? 1 : 0);
    for (const e of city.traffic.events) if (e.type === 'honk') sound.honk(clamp(1.3 - Math.hypot(e.x - px, e.z - pz) / 45, 0, 1));

    // ---- lamps of the traffic near the player (light dots; brake lights also by day) ----
    effects.beginFrame();
    for (const t of city.traffic.cars) {
      if (!t.alive || Math.abs(t.wx - px) > 70 || Math.abs(t.wz - pz) > 70) continue;
      if (night < 0.05 && !t.braking) continue;
      const info = carInfo(t.kind);
      effects.carLamps(t.wx, 0, t.wz, t.heading, info.halfWidth, info.frontZ, info.backZ, info.noseY, { head: night > 0.05 ? 1 : 0, tail: night, brake: t.braking, reverse: false, blink: t.turn ? (t.turn.s > 0 ? 1 : -1) : 0, blinkOn: (time * 2.6) % 1 < 0.5 });
    }

    // ---- the player's vehicle and the other real vehicles (after the traffic, so they can bump into it) ----
    races.preVehicles(dt, input);                       // (the cars of a race see each other; the countdown holds them)
    vehicles.update(dt, input, player, night, time);
    races.update(dt, time, input);
    zero.update(dt, { free: gameMode === 'free' && !story.active, car: vehicles.state === 'driving' ? vehicles.active : null });
    zeroInMirror();
    updateJacket();
    effects.endFrame(dt);
    // the player character sits in the driver's seat, hands on the wheel (only with the automatic skeleton)
    player.sit(vehicles.seat, dt);
    const driving = vehicles.driving;
    if (driving !== wasDriving) {
      wasDriving = driving;
      const v = vehicles.active;
      hud.setDriving(driving, driving && v ? v.label : '', v ? (v.type.role === 'police' ? 'police' : v.role) : 'car', !!(v && v.type.nitro));
      hud.setLightButton(!!(v && v.hiBeam));
      if (driving) rig.startChase(); else { rig.endChase(); sound.setInside(false); }
    }
    // ---- the story: its people, its steps, its film camera ----
    actors.update(dt, time, driving);
    story.update(dt, time);
    // Chapter 6: the garage set (its lamps, the rain on its window, the kettle, the radio); the player, the people and
    // the story's things must be in its picture too
    if (world.garageSet && world.garageSet.active) world.garageSet.update(dt, garageCast);
    streetLife.update(dt, time, gameMode === 'free' && !inside);
    // ---- the doors of the houses (ENTER / EXIT) ----
    interiors.update(dt, {
      can: gameMode !== 'title' && vehicles.state === 'none' && !player.staged && !(S && (S.locks.move || S.cameraActive)),
      seen: !police.scripted && police.mode === 'chase' && police.seen, film: !!S && S.cameraActive, rain, time,
    });
    const film = !!S && S.cameraActive;
    const view = vehicles.camMode;
    // Lena's flat in The Sunk: inside it the camera stays under the ceiling (like in a house)
    if (SK && !inside) {
      const pp = player.position, R = SK.room;
      const inRoom = vehicles.state === 'none' && pp.x > R.minX && pp.x < R.maxX && pp.z > R.minZ && pp.z < R.maxZ && pp.y > R.floor - 1.2 && pp.y < R.top;
      if (inRoom !== lenaCam) { lenaCam = inRoom; rig.setRoom(inRoom ? R : null); }
    }
    if (film) S.applyCamera(dt);
    else if (races.cameraActive) races.applyCamera(dt);   // (the replay after the finish line)
    else if (driving && vehicles.active) rig.updateChase(dt, vehicles.active, vehicles.shake, view);
    else rig.update(dt, player);
    // test tool: PG.freeCam = { pos: [x, y, z], look: [x, y, z] } puts the camera anywhere (before the rain, the
    // tunnel light and the haze look at where the camera is)
    const fc = window.PG && window.PG.freeCam;
    if (fc) {
      camera.position.set(fc.pos[0], fc.pos[1], fc.pos[2]);
      camera.lookAt(fc.look[0], fc.look[1], fc.look[2]);
    }
    // a wall pushed the camera right up to the player: the character fades out instead of being cut open
    if (!film && vehicles.state === 'none' && !player.staged) {
      const cp = camera.position, pp = player.position;
      const hy = clamp(cp.y, pp.y + 0.9, pp.y + 1.8);
      // (only when the camera is really at his head: the camera rises over the shoulder before that, camera.js)
      player.setFade(clamp((Math.hypot(cp.x - pp.x, cp.y - hy, cp.z - pp.z) - 0.3) / 0.28, 0, 1));
    } else player.setFade(1);
    {
      // the faster, the wider the view (and a little speed blur at the very top, see postfx.js)
      // (the story can take the player out of the car in the middle of a frame: "driving" may be old here)
      const kmh = driving ? vehicles.speedKmh : 0, boost = driving && vehicles.active && vehicles.active.nitroOn ? 1 : 0;
      // (after the limiter is switched off the view stays a little wider: the city opens up)
      const want = baseFov + Math.min(14, kmh * 0.058) + boost * 4 + (S ? S.fovBoost * 7 : 0);
      fovNow += (want - fovNow) * Math.min(1, dt * 3);
      if (!film && Math.abs(camera.fov - fovNow) > 0.04) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
      // the light dots of the lamps are sized for the lens that is used right now (film scenes use long lenses)
      if (Math.abs(camera.fov - fovSent) > 0.04) { fovSent = camera.fov; effects.setViewport(camera.fov, pixelH); spectators.setViewport(camera.fov, pixelH); }
      if (postfx.setSpeed) postfx.setSpeed(film ? 0 : clamp((kmh - 140) / 90, 0, 1) * 0.8 + boost * 0.25);
      hud.setWindscreen(!film && driving && rain > 0.3 && (view === 'hood' || view === 'cockpit') && !!vehicles.active && vehicles.active.isCar);
    }
    // ---- police: wanted stars, chasers, sirens, the flashing light ----
    const knocked = city.people.takeKnocked();
    if (knocked) { sound.thump(1); if (navigator.vibrate) navigator.vibrate(60); }
    const inCar = !!(car && !onFoot);
    // (a boat: a loud motor is heard by the Guard; the QUIET motor is not)
    const boatNow = inCar && car.role === 'boat', boatSpeed = boatNow ? Math.hypot(car.vx, car.vz) : 0;
    stars = police.update(dt, { x: px, z: pz, y: inCar ? car.y : player.position.y, speed: inCar ? Math.hypot(car.vx, car.vz) : inside ? 0 : player.speed, inCar, heading: inCar ? car.heading : player.heading, vx: inCar ? car.vx : 0, vz: inCar ? car.vz : 0, inside,
      loud: boatNow && !car.quiet && (boatSpeed > 2.5 || (car.fx && car.fx.throttle > 0.5)), quiet: boatNow && !!car.quiet }, knocked, night, rain);
    // (the story's own chases of Chapter 1 only show stars: no pulse, no state, no red and blue light)
    const realWanted = !police.scripted;
    music.setWanted(realWanted ? stars : 0, police.hidden, police.mode === 'chase');
    document.body.classList.toggle('wanted', realWanted && (stars > 0 || police.known));
    // the roof of a garage keeps the rain out (the camera is inside)
    {
      const cp = camera.position;
      let roof = null;
      for (const b of SHELTERS) if (cp.x > b.minX - 0.5 && cp.x < b.maxX + 0.5 && cp.z > b.minZ - 0.5 && cp.z < b.maxZ + 0.5 && cp.y < b.top + 0.5) roof = b;
      // (the Ironhill tunnel: its roof keeps the rain out whenever the camera is near enough to look into it)
      const tn = tunnelNear(cp);
      if (!roof && tn.close) roof = TUN_ROOF;
      weather.setShelter(roof);
      tunnelLightOn(tn.near);
    }
    if (!(driving && vehicles.active && vehicles.active.siren)) {
      let nearSiren = false;
      for (const s of sirens) if (Math.hypot(s.x - px, s.z - pz) < 170) nearSiren = true;
      sound.setSiren(nearSiren);
    }
    const F = vehicles.flasher, SL = S ? S.light : null;
    flashLight.visible = lighting.nightMode;
    // the one real lamp: a flashing Guard car first; else a lamp of the story (a room, a face)
    if (F.on) { flashLight.intensity = lighting.nightMode ? 90 : 0; flashLight.distance = 26; flashLight.position.set(F.x, F.y, F.z); flashLight.color.setHex(F.red ? 0xff2010 : 0x1040ff); }
    else if (SL) { flashLight.intensity = lighting.nightMode ? SL.power : 0; flashLight.distance = SL.range; flashLight.position.set(SL.pos[0], SL.pos[1], SL.pos[2]); flashLight.color.setHex(SL.color); }
    else flashLight.intensity = 0;
    // ---- repair point, messages, phone vibration ----
    // (after Chapter 6, when Mace's garage is still open to Nate: driving slowly into its bay fixes the car too)
    const inBay = GARAGE.ready && garageSafe() && car && car.x > GARAGE.inside.minX && car.x < GARAGE.inside.maxX && car.z > GARAGE.inside.minZ && car.z < GARAGE.inside.maxZ;
    if (gameMode === 'free' && driving && car && car.isCar && car.damage > 0.03 && (inBay || Math.hypot(car.x - garage.repair.x, car.z - garage.repair.z) < 3.2) && Math.hypot(car.vx, car.vz) < 4) {
      vehicles.repair(car); hud.toast(inBay ? t('c6.repaired') : 'REPAIRED'); sound.chime();
    }
    const msg = vehicles.takeMessage() || (gameMode === 'free' ? police.takeMessage() : (police.takeMessage(), null));
    if (msg) hud.toast(msg, 2600);
    const buzz = vehicles.takeHaptic();
    if (buzz && navigator.vibrate) { try { navigator.vibrate(buzz); } catch (e) { /* not allowed */ } }

    // ---- footsteps: a different sound on sand (and in the water) ----
    if (player.steps !== lastSteps) {
      lastSteps = player.steps;
      if (onFoot) sound.footstep(player.wade > 0.15 ? 'water' : SK && SK.inZone(px, pz) && SK.walk(px, pz, player.position.y) !== null && player.position.y < 1.5 ? 'wood' : pz < layout.neon.promenadeMinZ && !(SK && SK.inZone(px, pz, 6)) ? 'sand' : 'concrete', player.speed > 3);
    }
    // ---- swimming: a splash going in (or out), the strokes, white water at the hands ----
    if (player.splashes !== lastSplashes) {
      lastSplashes = player.splashes;
      if (onFoot) {
        const big = player.swimming, wy = city.water.level + 0.1;
        sound.splash(big);
        for (let i = 0; i < (big ? 7 : 3); i++) effects.emit('foam', px + (Math.random() - 0.5) * 0.8, wy, pz + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.6, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6, big ? 0.55 : 0.4);
      }
    }
    if (player.strokes !== lastStrokes) {
      lastStrokes = player.strokes;
      if (onFoot && player.swimming) {
        const moving = player.speed > 0.4, h = player.heading, side = (player.strokes % 2 ? 1 : -1) * 0.3;
        sound.stroke(moving);
        // (where the hand goes into the water: in front of him, a little to one side)
        const hx = px + Math.sin(h) * 0.7 + Math.cos(h) * side, hz = pz + Math.cos(h) * 0.7 - Math.sin(h) * side;
        if (moving) effects.emit('foam', hx, city.water.level + 0.08, hz, Math.sin(h) * 0.6, 0.9, Math.cos(h) * 0.6, 0.32);
      }
    }

    // ---- mission, waypoint, GPS route ----
    if (gameMode === 'free') missionState = missions.update(dt, { x: px, z: pz, inCar: vehicles.state === 'driving', car: vehicles.active, speed: car ? Math.hypot(car.vx, car.vz) : player.speed });
    goalState = S ? S.hud : missionState;
    if (waypoint && Math.hypot(waypoint.x - px, waypoint.z - pz) < 14) { waypoint = null; hud.toast('YOU HAVE ARRIVED'); sound.chime(); }
    // (in the story the map's yellow line always leads to the objective)
    const goal = S ? goalState.marker : waypoint || missionState.marker;
    routeTimer -= dt;
    // (the raised highway is not part of the street map: up there the arrow points straight at the goal)
    // (The Sunk: a boat follows the canals; on foot on the decks the arrow points straight at the goal)
    const byBoat = !!(car && !onFoot && car.role === 'boat');
    const inSunkNow = !!SK && SK.inZone(px, pz, 4);
    const onDeck = !!(car && car.arena) || px < layout.highway.maxX || (inSunkNow && !byBoat) || (byBoat && !(SK && SK.inZone(goal ? goal.x : 0, goal ? goal.z : 0, 40)) && !inSunkNow);
    if (!goal || onDeck) route = null;
    else if (routeTimer <= 0) { routeTimer = 0.6; route = byBoat && SK ? SK.route(px, pz, goal.x, goal.z) : gps.route(px, pz, goal.x, goal.z); }
    // the CAR button shows up next to a car
    nearTimer -= dt;
    if (nearTimer <= 0) { nearTimer = 0.2; hud.showCarButton(onFoot && !inside && !!vehicles.nearest(px, pz)); vehicles.prefetch(px, pz, active === 'low' ? 2 : active === 'medium' ? 4 : 8); }
    // ---- rain, traffic hum, waves near the beach, the tape (all made in code: src/audio/music.js) ----
    const amb = story.ambient;
    // THE SUNK: how deep in it the camera is, the market's murmur (it goes quiet when Nate comes close), the tunnel
    let sunkK = 0, marketK = 0, tunnelK = 0;
    if (SK && !inside) {
      const cp = camera.position, fz = SK.fogAt(cp.x, cp.y, cp.z);
      sunkK = fz.k; tunnelK = fz.tunnel;
      const m = SK.market, dm = Math.hypot(cp.x - m[0], cp.z - m[1]), dp = Math.hypot(px - m[0], pz - m[1]);
      marketHush += ((dp < 30 ? 1 : 0) - marketHush) * Math.min(1, dt * (dp < 30 ? 0.8 : 0.15));
      marketK = clamp(1 - dm / 130, 0, 1) * (1 - 0.85 * marketHush) * (S ? amb.market ?? 1 : 1);
    }
    // RUSTWATER DOCKS (Chapter 5): how deep in the port the camera is, the morning (gulls), a moving yard crane close by
    let docksK = 0, dawnK = 0, craneK = 0;
    if (city.docks && !inside) {
      const cp = camera.position, Dd = layout.docks;
      const dx = Math.max(Dd.minX - cp.x, 0, cp.x - Dd.maxX), dz = Math.max(Dd.minZ - 60 - cp.z, 0, cp.z - Dd.maxZ);
      docksK = clamp(1 - Math.hypot(dx, dz) / 80, 0, 1);
      const h = lighting.hour;
      dawnK = clamp(1 - Math.abs(h - 6.2) / 1.6, 0, 1);
      for (const g of city.docks.gantries) if (g.state === 'move' || g.state === 'lower' || g.state === 'raise') craneK = Math.max(craneK, clamp(1 - Math.hypot(g.x - cp.x, g.row - cp.z) / 70, 0, 1));
    }
    const GS = world.garageSet && world.garageSet.active ? world.garageSet : null;
    music.update(dt, {
      sunk: sunkK, market: marketK, tunnel: tunnelK, docks: docksK, dawn: dawnK, crane: craneK,
      garage: GS ? 1 : 0, kettle: GS ? GS.kettleHeat : 0, song: S ? amb.song || 0 : 0,
      rain: weather.amount, city: clamp(city.traffic.count / 30, 0, 1) * 0.8, beach: clamp((-250 - pz) / 130, 0, 1),
      inCar: driving || (!!S && S.indoors) || inside,
      drone: Math.max(police.droneNear, S ? amb.drone : 0), radio: S ? amb.radio : 0, street: S ? amb.street : 0,
    });
    // ---- the title screen: a slow look along the street in front of Mace's garage ----
    if (gameMode === 'title') {
      const cz = TITLE.z + Math.sin(time * 0.045) * 4;
      camera.position.set(TITLE.x, 2.5 + Math.sin(time * 0.07) * 0.2, cz);
      camera.lookAt(TITLE.lookX, 2.9, cz - 1.5);
    }
    shared.uPgPlayer.value.copy(player.position);
    // ---- THE SUNK: its water and mist, the steady rain there, the teal dark of the tunnel ----
    // (not while the garage set of Chapter 6 is shown: the canals are not in that picture)
    const citySleeps = !!(world.garageSet && world.garageSet.active);
    if (citySleeps) lighting.zone = null;
    else if (TUN && tunnelNear(camera.position).deep > 0) {
      // inside the Ironhill tunnel: a warm, dark haze (the orange of its lamps in the air)
      lighting.zone = { k: 0, tunnel: tunnelNear(camera.position).deep, tint: [0.05, 0.026, 0.009], dens: 3.2 };
    } else if (SK) {
      const cp = camera.position;
      lighting.zone = inside ? null : SK.fogAt(cp.x, cp.y, cp.z);
      weather.setZoneRain(!inside && SK.inZone(px, pz, 40));
      sunkBoats.length = 0;
      const av = vehicles.active;
      if (av && av.role === 'boat') sunkBoats.push(av);
      for (const v of vehicles.live) if (v.role === 'boat' && v !== av && !v.away && sunkBoats.length < 3 && Math.abs(v.x - cp.x) < 150 && Math.abs(v.z - cp.z) < 150) sunkBoats.push(v);
      // (walking on a pontoon: it moves a little in the water, small ripples go out from it)
      if (onFoot && sunkBoats.length < 3 && player.position.y < 0 && player.speed > 0.4 && SK.inZone(px, pz)) {
        sunkWalker.x = px; sunkWalker.z = pz; sunkWalker.heading = player.heading;
        sunkWalker.vx = Math.sin(player.heading) * (player.speed + 2.5); sunkWalker.vz = Math.cos(player.heading) * (player.speed + 2.5);
        sunkBoats.push(sunkWalker);
      }
      SK.update(dt, time, cp, sunkBoats, quality, scene.fog.color);
    }
    weather.update(dt);
    lighting.update(dt, player.position, rig.forwardXZ(camDir));
    // the characters' own soft light (characterLook.js): clear at night, almost nothing in daylight.
    // (divided by the exposure, so it looks the same on the screen whatever the camera is set to)
    {
      const li = lighting.info, P = CONFIG.player, test = window.PG && window.PG.fillOverride !== null && window.PG.fillOverride !== undefined ? window.PG.fillOverride : story.fill;
      // (how much real light there is: all of it with the sun high, little with a low sun, none at night)
      const bright = smoothstep(4, 30, li.elevation === undefined ? 90 : li.elevation);
      const want = P.fillDay + (P.fillNight - P.fillDay) * (1 - bright);
      const fill = typeof test === 'number' ? test : want / Math.max(li.exposure || 1, 0.25);
      // (in the Ironhill tunnel the light on the faces is the lamps' orange, brighter under each lamp as the car goes)
      const lamp = TUN ? tunnelLampAt(camera.position.x, camera.position.y, camera.position.z) : 0;
      if (lamp > 0) setCharacterFill(fill * (0.5 + 1.3 * lamp), 1.0, 0.62 + 0.3 * (1 - lamp), 0.34 + 0.5 * (1 - lamp));
      else setCharacterFill(fill);
    }
    // (in a film scene the near detail - props, the docks' crews and machines - is around the CAMERA, which may be
    //  far from where the player stands: nothing pops in or is missing in the shot)
    // (Chapter 6: while the garage set is the whole picture, nothing of the city is drawn, and it sleeps too: its
    //  props, its train and its cranes wake up again the frame the set is gone)
    if (!citySleeps) city.update(dt, time, film ? camera.position.x : px, film ? camera.position.z : pz, quality.propDistance);
    updateSunGlow(dt);
  }
  // Get into the nearest car, or (when driving) stop and get out.
  function carAction() {
    if (gameMode === 'title' || (story.active && story.locks.action)) return;
    if (vehicles.state === 'none') {
      if (!vehicles.tryEnter(player)) hud.toast('NO CAR NEAR YOU', 1200);
    } else if (vehicles.state === 'driving') vehicles.requestExit();
  }

  // ---- HUD things that follow the world: GPS arrow, floating marker, speed ----
  function updateGuides() {
    hud.setSpeed(vehicles.speedKmh);
    const dash = vehicles.hud;
    if (dash && vehicles.driving) hud.setDash(dash, (time * 2.6) % 1 < 0.5);
    hud.setWanted(stars, police.chased);
    const real = !police.scripted && gameMode !== 'title';
    hud.setWantedState(real ? { stars, mode: police.mode, hidden: police.hidden, progress: police.hideProgress, covered: police.covered, light: police.light,
      stealth: police.stealth, exposed: police.exposed, suspicion: police.suspicion, heard: police.heard, seenNow: police.exposed && !police.heard } : { stars: 0, light: 0 });
    hud.showCover(real && police.coverAvailable && !story.cameraActive);
    hud.setTicker(gameMode === 'story' ? story.news : null, portraitURL);
    // name tags over the garage vehicles (only when you stand close: a screen full of labels looks like a test build)
    tags.length = 0;
    if (vehicles.state === 'none' && gameMode !== 'title') {
      for (const v of vehicles.live) {
        if (!v.tag || v.away || Math.hypot(v.x - player.position.x, v.z - player.position.z) > 11) continue;
        _mark.set(v.x, v.y + v.info.roof + 0.75, v.z).project(camera);
        if (_mark.z < 1 && Math.abs(_mark.x) < 1 && Math.abs(_mark.y) < 1) tags.push({ x: (_mark.x * 0.5 + 0.5) * window.innerWidth, y: (-_mark.y * 0.5 + 0.5) * window.innerHeight, text: v.label });
      }
      // (story people whose model file is missing stand in as mannequins with a name tag)
      actors.tags(camera, tags);
      _mark.set(garage.repair.x, 1.4, garage.repair.z);
      if (gameMode === 'free' && _mark.distanceTo(player.position) < 16) { _mark.project(camera); if (_mark.z < 1 && Math.abs(_mark.x) < 1 && Math.abs(_mark.y) < 1) tags.push({ x: (_mark.x * 0.5 + 0.5) * window.innerWidth, y: (-_mark.y * 0.5 + 0.5) * window.innerHeight, text: 'REPAIR' }); }
    }
    hud.setTags(tags);
    hud.setMission(goalState.active ? goalState : null);
    const goal = story.active ? goalState.marker : waypoint || missionState.marker;
    if (!goal || gameMode === 'title' || interiors.inside) { hud.setArrow(null); hud.setMarker(null); return; }
    const px = player.position.x, pz = player.position.z;
    const dist = Math.hypot(goal.x - px, goal.z - pz);
    // the arrow points along the route (about 28 m ahead), seen from the camera
    const aim = route && route.length > 1 && dist > 34 ? gps.pointAhead(route, 28) : goal;
    const dx = aim.x - px, dz = aim.z - pz;
    const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw);
    hud.setArrow(Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz), route && route.length > 1 ? gps.length(route) : dist);
    // the marker floats over the goal (hidden when it is behind the camera)
    _mark.set(goal.x, (goal.y !== undefined ? goal.y : city.groundHeight(goal.x, goal.z)) + 2.6, goal.z).project(camera);
    if (_mark.z < 1 && Math.abs(_mark.x) < 1.05 && Math.abs(_mark.y) < 1.05) hud.setMarker((_mark.x * 0.5 + 0.5) * window.innerWidth, (-_mark.y * 0.5 + 0.5) * window.innerHeight, dist);
    else hud.setMarker(null);
  }
  const mapExtra = () => {
    // while the Guard is after the player (or knows his face): its view cones, the search area and the scanner gates, and a wider view
    const showGuard = !police.scripted && (stars > 0 || police.known);
    return { inCar: vehicles.driving, cars: city.traffic.cars, waypoint: story.active ? null : waypoint, marker: goalState.marker, route, wanted: showGuard ? police.mapView() : null, view: showGuard ? 0.5 : 0, time, race: races.mapExtra };
  };

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
    if (usePost && !interiors.inside && info.sunDir && info.sunDir.y > -0.02 && info.sunLevel > 0.02) {
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

  let drawnAt = 0;
  function draw() {
    renderer.info.reset();
    // (the film's rear-view mirror is made first: its small picture is then part of the big one)
    const nowS = performance.now() / 1000, ddt = Math.min(0.1, drawnAt ? nowS - drawnAt : 0.016);
    drawnAt = nowS;
    if (world.rearView) world.rearView.render(ddt);
    if (usePost) postfx.render(scene, camera, time);
    else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  // ------------------------------------------------------------ start settings
  // (options in the address, for testing free roam: ?time=night&rain=1&pos=10,20&yaw=90 ...)
  function applyStartOptions() {
    const startTime = urlOption('time');
    if (startTime) {
      if (CONFIG.time.presets[startTime] !== undefined) lighting.jumpTo(startTime);
      else if (!Number.isNaN(parseFloat(startTime))) lighting.setHour(parseFloat(startTime));
    }
    if (urlOption('freeze') === '1') lighting.setRunning(false);
    if (urlOption('rain') === '1') weather.setInstant(true);
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
  }
  applyStartOptions();
  if (urlOption('nohud') === '1') document.body.classList.add('nohud');
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
  // ... and the rooms of the houses you can walk into (built now, drawn once behind the loading screen)
  hud.setProgress(0.95, 'Warming up rooms');
  await nextFrame();
  interiors.warm(draw);
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
  // ---- CAM: next camera view. boat and drone only have the two outside views ----
  hud.actions.camera = () => {
    const v = vehicles.active;
    const list = v && !v.isCar ? CAM_MODES.slice(0, 2) : CAM_MODES;
    const next = list[(list.indexOf(vehicles.camMode) + 1) % list.length] || 'chase';
    vehicles.camMode = next;
    hud.toast({ chase: 'CHASE CAMERA', close: 'CLOSE CAMERA', hood: 'HOOD CAMERA', cockpit: 'COCKPIT' }[next], 1000);
  };
  hud.actions.lights = () => {
    if (!vehicles.driving) return;
    const on = vehicles.toggleHighBeam();
    hud.setLightButton(on);
    hud.toast(on ? 'HIGH BEAM' : 'LOW BEAM', 900);
  };
  // ---- CARS menu (for testing): put any vehicle in front of the player ----
  hud.setVehicleMenu(['street_bike', 'small_city_car', 'tech_patrol_car', 'police_coupe', 'chrome_supercar', 'theo_coupe', 'armored_van', 'patrol_boat', 'drone', 'sedan', 'suv', 'coupe']
    .filter((k) => CAR_TYPES[k] && (CAR_TYPES[k].role !== 'boat' || carLib.boat)).map((k) => [k, CAR_TYPES[k].label]));
  hud.actions.spawn = (kind) => {
    if (vehicles.state !== 'none') { hud.toast('GET OUT OF THE VEHICLE FIRST', 1500); return; }
    const v = vehicles.spawnInFront(kind, player.position.x, player.position.z, player.heading);
    const m = vehicles.takeMessage();
    hud.toast(m || (v ? `${v.label} READY` : 'NOT AVAILABLE'), 1800);
  };
  hud.setAssist(settings.assist);
  hud.actions.assist = (mode) => {
    settings.assist = mode;
    try { localStorage.setItem('pg-assist', mode); } catch (e) { /* private mode */ }
    hud.setAssist(mode);
    hud.toast({ off: 'ASSIST OFF: NO HELP', normal: 'ASSIST NORMAL: TRACTION CONTROL + ABS', easy: 'ASSIST EASY: ALSO HELPS YOU STEER' }[mode], 2200);
  };
  hud.actions.sound = () => {
    sound.setMuted(!sound.muted);
    ui.setSetting('muted', sound.muted);
    hud.setSoundButton(!sound.muted);
    hud.toast(sound.muted ? 'SOUND OFF' : 'SOUND ON', 1000);
  };
  hud.actions.dialog = () => missions.advanceDialog();
  // COVER: parked in an alley, pull the car into the shadow (the drones lose it too)
  hud.actions.cover = () => { if (police.cover()) { sound.burst(900, 0.6, 0.12, 0.05, 0.4, 'lowpass'); hud.toast('COVERED  ·  STAY STILL', 1600); } };
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

  // ------------------------------------------------ title screen, story, free roam
  // the test garage, its repair ring and the cars of the old test mission only exist in free roam
  function setTestWorld(on) {
    for (const v of garage.vehicles) v.away = !on;
    for (const v of Object.values(missions.cars)) v.away = !on;
    repairRing.visible = on;
    // (cars the player took or spawned in free roam do not stay around for the story)
    if (!on) for (const v of [...vehicles.live]) if (!v.keep && !v.npc && !v.storyId) vehicles.removeVehicle(v);
  }
  async function showTitle() {
    interiors.reset();
    story.stop(); missions.stop();
    gameMode = 'title'; paused = false;
    document.body.classList.add('title');
    setTestWorld(false);
    hud.showBigMap(false); waypoint = null; route = null;
    // a rainy night in front of Mace's garage
    lighting.setHour(23); lighting.setRunning(false); weather.setInstant(true); hud.setRainButton(true);
    player.place(TITLE.x - 9, TITLE.z, 0); player.setHidden(true);
    const info = await story.saveInfo();
    if (gameMode === 'title') ui.title(info, onTitle);
  }
  function onTitle(action) {
    if (action === 'continue') startStory(() => story.resume());
    else if (action === 'new') startStory(() => story.newGame());
    else if (action === 'free') startFree(false);
    else if (action === 'settings') openSettings(showTitle);
    else if (action === 'select') {
      // the mission list: every mission of every chapter that exists
      story.missionList().then((list) => {
        if (gameMode !== 'title') return;
        ui.select(list, (id) => { if (id) startStory(() => story.startAt(id.chapter, id.mission)); else showTitle(); });
      });
    }
  }
  async function startStory(go) {
    interiors.reset();
    ui.hideMenus();
    document.body.classList.remove('title');
    gameMode = 'story';
    setTestWorld(false);
    player.setHidden(false);
    garageAfterStory(false);            // (the story puts the garage as each chapter needs it)
    const ok = await go();
    if (ok === true) return;
    // (nothing to start: the next chapter does not exist yet, or its file could not be read)
    if (ok === 'locked') hud.toast(t('ui.locked'), 2800);
    showTitle();
  }
  // AFTER CHAPTER 6 (the flags of the save): when Nate forgave Mace or stayed silent, Mace's garage stays a safe place -
  // Theo's car waits in it, whole, and can be driven (it drives like the chrome supercar), and driving into the bay
  // fixes a car. When Nate walked out, the garage is shut (its roller door down) until Chapter 9.
  let theoParked = null;
  function garageSafe() { const f = save.data.flags || {}; return f.mace_forgiven !== undefined && f.garage_open !== false; }
  function garageAfterStory(on) {
    const f = save.data.flags || {};
    const want = on && !!f.theo_car && f.garage_open !== false && GARAGE.ready;
    if (want && !(theoParked && vehicles.live.includes(theoParked))) {
      if (GARAGE.tarpBox && !GARAGE.tarpBoxGone) { city.colliders.removeBox(GARAGE.tarpBox); GARAGE.tarpBoxGone = true; }
      const p = GARAGE.at(-6.9, 0, -3.9);
      theoParked = vehicles.spawn('theo_coupe', p[0], p[2], GARAGE.rot, null, { keep: true, tag: true });
    } else if (!want && theoParked) {
      if (vehicles.active === theoParked) vehicles.leaveNow(player);
      if (vehicles.live.includes(theoParked)) vehicles.removeVehicle(theoParked);
      theoParked = null;
    }
    if (!want && GARAGE.tarpBoxGone) { city.colliders.addBox(GARAGE.tarpBox); GARAGE.tarpBoxGone = false; }
    if (world.tarp) world.tarp.visible = !want;
    // shut: the roller door down - and solid, nobody walks or drives in
    const shut = on && f.garage_open === false && GARAGE.ready;
    if (world.shutter) world.shutter.userData.setOpen(shut ? 0 : 1);
    if (shut && !doorBox) {
      const d = GARAGE.doorSize, a = GARAGE.at(d.r0, 0, 6.68), b = GARAGE.at(d.r1, 0, 6.98);
      doorBox = { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[2], b[2]), maxZ: Math.max(a[2], b[2]), h: d.top };
      city.colliders.addBox(doorBox);
    } else if (!shut && doorBox) { city.colliders.removeBox(doorBox); doorBox = null; }
  }
  let doorBox = null;
  // fromBoot: the game was opened with ?story=0 (tests): the world stays exactly as the address options made it
  function startFree(fromBoot) {
    interiors.reset();
    story.stop();
    ui.hideMenus();
    document.body.classList.remove('title');
    gameMode = 'free';
    setTestWorld(true);
    player.setHidden(false);
    if (!fromBoot) {
      lighting.setHour(CONFIG.time.startHour); lighting.setRunning(true); weather.setInstant(false); hud.setRainButton(false);
      player.teleport(layout.spawn.x, layout.spawn.z, layout.spawn.facingDeg);
      rig.set(player.heading, CONFIG.camera.startPitch);
      applyStartOptions();
    }
    // the placeholder mission starts by itself (add "?mission=0" to the address to play without it)
    if (urlOption('mission') !== '0' && !missions.running) missions.start('meet-at-neon-mile');
    garageAfterStory(true);
  }
  // ---- pause and settings ----
  function openPause() {
    if (gameMode === 'title' || ui.menuOpen || story.loading) return;
    paused = true;
    ui.pause({ story: gameMode === 'story' }, (action) => {
      if (action === 'resume') closePause();
      else if (action === 'settings') openSettings(() => { paused = false; openPause(); });
      else if (action === 'restart') { closePause(); story.restart(); }
      else { closePause(); showTitle(); }
    });
  }
  function closePause() { paused = false; ui.hideMenus(); last = performance.now(); }
  function openSettings(back) {
    ui.settingsScreen({ quality: mode }, (key, value) => {
      if (key === 'quality') hud.actions.quality(value);
      else if (key === 'tilt') controls.setTilt(value);
      else if (key === 'volume') sound.setVolume(value);
      else if (key === 'muted') { sound.setMuted(value); hud.setSoundButton(!value); }
      else if (key === 'walk' && player.anim) player.anim.walkStyle = value;     // how Nate walks
      // (button size and subtitle size are style settings: storyUI.js applies them itself)
    }, back);
  }
  ui.onPauseButton(openPause);
  controls.onTiltChange = (on) => ui.setSetting('tilt', on);
  if (ui.settings.tilt) controls.setTilt(true);
  if (player.anim) player.anim.walkStyle = ui.settings.walk || 'confident';      // how Nate walks (SETTINGS: WALK STYLE)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' && e.code !== 'Escape') return;
    if (paused && !document.getElementById('pause').hidden) closePause(); else openPause();
  });
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    // the phone was put away or another app came up: no sound in the background, and the game waits in the pause menu
    if (document.hidden) { sound.pause(true); if (gameMode !== 'title' && !story.cameraActive) openPause(); }
    else sound.pause(frozen);
  });

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0.0001, (now - last) / 1000)); // never jump more than 1/10 s
    last = now;
    // a menu is open (pause, settings, mission failed, chapter end): the game and its sound stand still
    const hold = gameMode !== 'title' && (paused || ui.menuOpen);
    if (hold !== frozen) { frozen = hold; sound.pause(frozen); }
    if (frozen) {
      // (the picture is still drawn now and then, so turning the phone or changing the graphics level shows)
      if (++idleFrames % 12 === 0) draw();
      return;
    }
    // (slow motion: the world runs slower for a few real seconds; the menus and the subtitles do not)
    let k = 1;
    if (slow.left > 0) { slow.left -= dt; k = slow.scale; }
    step(dt * k);
    draw();
    ui.update(dt);

    // ---- HUD (not every frame: text and map do not need 60 updates a second) ----
    frames++;
    fpsTimer += dt;
    mapTimer += dt;
    sinceChange += dt;
    if (mapTimer > 0.066) {
      mapTimer = 0;
      const mp = interiors.inside ? interiors.anchor : player.position;
      minimap.draw(mp.x, mp.z, player.heading, mapExtra());
      if (hud.bigMapOpen) drawBigMap();
    }
    updateGuides();
    if (fpsTimer >= 0.5) {
      fps = frames / fpsTimer;
      const frames_ = frames, span_ = fpsTimer;
      frames = 0;
      fpsTimer = 0;
      hud.setLocation(interiors.inside ? interiors.label : vehicles.active && vehicles.active.arena ? 'IRONHILL HIGHWAY' : layout.districtAt(player.position.x, player.position.z));
      hud.setClock(lighting.hour);
      hud.setWeather(weather.amount > 0.3 ? 'RAIN' : lighting.info.night > 0.6 ? 'NIGHT' : 'CLEAR');
      if (statsOn) {
        const r = renderer.info.render;
        hud.setStats(`${Math.round(fps)} FPS  ·  ${r.calls} DRAW CALLS\n${Math.round(r.triangles / 1000)}K TRIANGLES  ·  ${quality.label} ${renderer.getPixelRatio().toFixed(2)}x`);
      }
      // dynamic resolution (see resize): look at the frame rate of the last 2.5 seconds.
      // (Never in the middle of a film scene - a change of resolution makes the picture jump for a moment - and
      //  at least 8 seconds between two changes.)
      resFrames += frames_; resTime += span_;
      resHold = Math.max(0, resHold - span_);
      const filmNow = !!story && story.cameraActive;
      if (filmNow) { resFrames = 0; resTime = 0; }
      if (dynRes && resTime >= 2.5 && !document.hidden && gameMode !== 'title' && !filmNow && resHold <= 0) {
        const rf = resFrames / resTime, prNow = renderer.getPixelRatio();
        resFrames = 0; resTime = 0;
        if (rf < 47) { resGood = 0; const k = Math.max(0.8, resK - 0.12); if (k !== resK) { resK = k; resize(); resHold = 8; } }
        else if (rf >= 57) {
          resGood++;
          // (two calm windows in a row before it gets sharper: no back and forth)
          if (resGood >= 2) { resGood = 0; const k = Math.min(2.2, resK + 0.08); if (k !== resK) { resK = k; resize(); resHold = 8; if (renderer.getPixelRatio() === prNow) resK -= 0.08; } }
        } else resGood = 0;
      } else if (resTime >= 2.5) { resFrames = 0; resTime = 0; }
      // AUTO quality: if the game runs slowly for a while, go one level down
      // (not during a film scene: changing the quality rebuilds the shaders, the scene would freeze for a moment)
      if (mode === 'auto' && sinceChange > 5 && !document.hidden && !(story && story.cameraActive)) {
        slowTime = fps < 42 ? slowTime + 0.5 : Math.max(0, slowTime - 0.25);
        if (slowTime >= 3 && active !== 'low') {
          applyQuality(active === 'high' ? 'medium' : 'low');
          hud.toast(`QUALITY: ${quality.label}`);
        }
      }
    }
  }

  // the see-through look of the player (the camera against a wall) is prepared now, not in the middle of play
  if (player.prewarmFade) player.prewarmFade(renderer, scene, camera);

  // tools for testing from the browser console (and for screenshots)
  window.PG = {
    THREE, CONFIG, renderer, scene, camera, city, layout, lighting, weather, player, rig, controls, materials, shared, postfx,
    vehicles, missions, gps, sound, hud, minimap, carLib, effects, police, garage, settings,
    story, ui, music, save, actors, drivers, director, storyProps, streetLife, GARAGE, interiors, races, spectators, slow, zero,
    applyQuality, step, draw, carAction, updateGuides, showTitle, startFree, startStory, openPause,
    fillOverride: null, characterFill: () => characterLight.uPgCharFill.value,      // (tests: the characters' fill light)
    get mode() { return gameMode; },
    get paused() { return frozen; },
    get waypoint() { return waypoint; },
    set waypoint(w) { waypoint = w; routeTimer = 0; },
    get route() { return route; },
    get quality() { return active; },
    get fps() { return fps; },
    get time() { return time; },
    ready: true,
  };

  // ---- where the game opens: the title screen, or straight into a mode (address options, for testing) ----
  const open = urlOption('story');
  if (open === '0') startFree(true);
  else if (open) { const [id, m] = open.split('.'); startStory(() => story.startAt(id, parseInt(m || '0', 10) || 0)); }
  else showTitle();

  hud.hideLoading();
  requestAnimationFrame((t) => { last = t; loop(t); });
}

boot().catch((err) => {
  console.error(err);
  hud.showError(`Something went wrong while starting the game: ${err && err.message ? err.message : err}`);
});
