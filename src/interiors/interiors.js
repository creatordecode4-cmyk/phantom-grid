// ---------------------------------------------------------------------------
// interiors.js - going into houses.
//
// HOW IT WORKS FOR THE PLAYER
//   Some doors in the city are real doors (a wooden door with a small lamp
//   over it). Walk up to one: the ENTER button shows. The door swings open,
//   the screen goes dark for a moment, and you are inside. Inside, walk back
//   to the door you came in by: EXIT.
//   Inside nobody on the street can see you (the Guard loses you, the stars
//   go down like in a hiding place). Free roam and quiet story moments only.
//
// HOW IT WORKS INSIDE THE GAME
//   * The rooms are NOT inside the city's buildings. Each house is built far
//     away from the city (x = 4200 and more), and only the first time you go
//     in (src/interiors/rooms.js, furniture.js, kit.js).
//   * Inside, the camera only draws "layer 4": the house, its lights and the
//     player. The city is not drawn at all - it costs nothing.
//   * The street keeps living around the door (traffic, people, the Guard),
//     so it is all there when you come out (main.js uses `anchor`).
//   * The light follows the clock of the game:
//       day      the sun comes through the window: a real light with shadows
//                (the window bars draw lines on the floor), a soft beam in
//                the air with slow dust in it, warm light bouncing back
//       evening  the sun is low and orange, the lamps go on
//       night    cold moonlight through the window, warm lamps
//     The view through the windows (a picture) changes with it.
//   * Corners are darker (kit.js "room shade"), and things stand on soft
//     shadows. The materials reflect a soft studio room (RoomEnvironment),
//     not the sky.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { materials, createBuilder, roomShade, viewMix } from './kit.js';
import { frame, doorLeaf, C } from './furniture.js';
import { HOUSES } from './rooms.js';
import { generate, kindOf } from './generate.js';
import { ENTRANCES } from '../city/heroBuildings.js';
import { t } from '../story/strings.js';

export const INTERIOR_LAYER = 4;
// where each house is built (far from the city: x of the city is about -500 .. 470).
// The rooms made for all the other doors (generate.js) take turns in three places.
const ORIGINS = { halden: [4200, 0, 300], flat: [4290, 0, 300] };
const GEN_SLOTS = [[4400, 0, 300], [4480, 0, 300], [4560, 0, 300]];
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const mixC = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const OPEN_TIME = 0.55, FADE = 0.5;

// ---- the slow dust in the sun beams (a few hundred soft dots, moved by the graphics card) ----
const DUST_VS = `
attribute vec3 aRand;
uniform float uTime, uSize;
uniform vec3 uO, uU, uV, uD;
varying float vA;
void main() {
  vec3 r = aRand;
  float s = fract( r.z + uTime * 0.01 * ( 0.4 + r.x ) );           // each grain drifts slowly along the beam
  vec3 p = uO + uU * ( r.x - 0.5 ) + uV * ( r.y - 0.5 ) + uD * s;
  p += vec3( sin( uTime * 0.31 + r.x * 40.0 ), sin( uTime * 0.23 + r.y * 31.0 ), cos( uTime * 0.27 + r.z * 23.0 ) ) * 0.05;
  vA = sin( s * 3.14159 ) * ( 0.35 + 0.65 * fract( r.x * 13.7 + r.y * 7.1 ) );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * ( 0.5 + r.y ) / max( -mv.z, 0.2 );
}`;
const DUST_FS = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  float d = length( gl_PointCoord - 0.5 );
  float a = smoothstep( 0.5, 0.05, d ) * vA * uOpacity;
  gl_FragColor = vec4( uColor * a, a );
}`;

export function createInteriors({ scene, renderer, camera, player, rig, ui, hud, sound, lighting }) {
  const M = materials(renderer);
  let pixelH = 720;                       // the height of the picture in pixels (for the size of the dust)
  // the rooms reflect a soft studio room (not the sky outside)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const STD = Object.values(M).filter((m) => m.isMeshStandardMaterial);
  for (const m of STD) { m.envMap = envTex; m.envMapIntensity = 0.4; m.needsUpdate = true; }

  // the player is drawn inside too (layers are not passed on to children: every mesh gets it)
  const showPlayer = () => {
    player.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.layers.enable(INTERIOR_LAYER); });
    if (player.blob) player.blob.layers.enable(INTERIOR_LAYER);
  };
  showPlayer();

  // ======================================================== the doors in the city
  // (their own copies of the materials: outside they are lit by the sky, not by the studio room)
  const OUT = {};
  for (const k of ['wood', 'paint', 'metal', 'gloss', 'glass']) { OUT[k] = M[k].clone(); OUT[k].envMap = null; OUT[k].onBeforeCompile = () => {}; }
  OUT.glow = M.glow.clone();
  const haloTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  const hallTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#3a2a1c'); gr.addColorStop(0.35, '#7a5634'); gr.addColorStop(0.75, '#2a1d14'); gr.addColorStop(1, '#120c08');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 128);
    const t2 = new THREE.CanvasTexture(cv); t2.colorSpace = THREE.SRGBColorSpace; return t2;
  })();
  const doors = [];            // every door that can be opened
  const animated = [];         // the doors with a real wooden leaf and a lamp (the houses made by hand)
  const grid = new Map();      // doors by 16 m squares of the map (to find the nearest one quickly)
  const houseOf = {};
  for (const [id, h] of Object.entries(HOUSES)) for (const d of h.doors) houseOf[d] = id;
  const cellKey = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
  for (const e of ENTRANCES) {
    const house = houseOf[e.id] || 'gen:' + e.id;
    const d = { e, house, open: 0, want: 0, front: { x: e.x + e.nx * 0.85, z: e.z + e.nz * 0.85 } };
    doors.push(d);
    const k = cellKey(d.front.x, d.front.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(d);
    if (!houseOf[e.id]) continue;
    const g = new THREE.Group();
    g.position.set(e.x, e.y, e.z);
    g.rotation.y = Math.atan2(e.nx, e.nz);           // its +z looks out to the street
    const w = Math.min(e.w, 1.0), h = Math.min(e.h - 0.05, 2.2);
    // the frame around the door, a stone step, a mat
    const fb = createBuilder([0, 0, 0], 5);
    const F = frame(fb, 0, 0, 0);
    const trim = C('#3a2a1e');
    F.box('wood', -w / 2 - 0.05, 0, 0.02, 0.1, h + 0.1, 0.08, trim, { r: 0.01 });
    F.box('wood', w / 2 + 0.05, 0, 0.02, 0.1, h + 0.1, 0.08, trim, { r: 0.01 });
    F.box('wood', 0, h, 0.03, w + 0.3, 0.12, 0.1, trim, { r: 0.012 });
    F.box('paint', 0, -0.02, 0.3, w + 0.5, 0.06, 0.5, C('#8a8580'), { r: 0.01 });
    F.box('paint', 0, 0.04, 0.42, w * 0.8, 0.012, 0.4, C('#5a4030'), { r: 0.004 });
    // a small brass lamp over the door: its glass glows at night
    F.box('metal', 0, h + 0.3, 0.06, 0.1, 0.16, 0.1, C('#3a3226'), { r: 0.02 });
    F.box('metal', 0, h + 0.2, 0.1, 0.03, 0.1, 0.03, C('#3a3226'), { r: 0.008 });
    const fx = fb.finish(g, OUT);
    // the glass of the lamp and its glow in the air (bigger in rain and fog)
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
    glass.position.set(0, h + 0.27, 0.2);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    halo.position.copy(glass.position);
    halo.scale.setScalar(1.4);
    g.add(glass, halo);
    // the door leaf: it turns on its hinge (out toward the street)
    const pivot = new THREE.Group();
    pivot.position.set(w / 2, 0.0, 0.045);
    pivot.rotation.y = Math.PI;
    const lb = createBuilder([0, 0, 0], 9);
    doorLeaf(frame(lb, 0, 0, 0), w, h, house === 'flat' ? C('#3f6a5a') : C('#6b4024'), { glass: house === 'flat' });
    lb.finish(pivot, OUT);
    g.add(pivot);
    for (const m of Object.values(fx.meshes)) m.castShadow = false;
    // behind the leaf: a warm, dim hall (seen when the door swings open)
    const hall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: hallTex, toneMapped: true }));
    hall.position.set(0, h / 2, 0.028);
    g.add(hall);
    scene.add(g);
    Object.assign(d, { g, pivot, glass, halo });
    animated.push(d);
  }

  // ======================================================== the houses (built the first time)
  const built = {};
  const genCache = [];         // the made rooms that are kept (the last three), oldest first
  function build(id) {
    if (built[id]) { if (id.startsWith('gen:')) { genCache.splice(genCache.indexOf(id), 1); genCache.push(id); } return built[id]; }
    let O, data;
    const b = createBuilder([0, 0, 0], id.length * 7 + 3);
    if (id.startsWith('gen:')) {
      // a room made for this door: it takes a free place (the oldest one is thrown away)
      const usedSlots = genCache.map((k) => built[k].slot);
      let slot = GEN_SLOTS.findIndex((_, i) => !usedSlots.includes(i));
      if (slot < 0) {
        const old = genCache.find((k) => !house || built[k] !== house);
        slot = built[old].slot;
        dispose(old);
      }
      O = GEN_SLOTS[slot];
      const e = ENTRANCES.find((x) => 'gen:' + x.id === id);
      data = generate(b, e);
      data.slot = slot;
      genCache.push(id);
    } else {
      O = ORIGINS[id];
      data = HOUSES[id].build(b);
    }
    const root = new THREE.Group();
    root.position.set(O[0], O[1], O[2]);
    b.finish(root, M);
    // ---- the front door from inside (it moves, so it is its own small mesh) ----
    const dd = data.door;
    const pivot = new THREE.Group();
    pivot.position.set(dd.hinge[0], 0, dd.hinge[1]);
    pivot.rotation.y = dd.closed;
    const lb = createBuilder([0, 0, 0], 11);
    if (dd.shutter) {
      // a garage: a roller door (it does not swing; the room behind it is left through the fade)
      const P = frame(lb, dd.width / 2, 0, 0);
      for (let y = 0; y < dd.height - 0.05; y += 0.12) P.box('metal', 0, y, 0, dd.width, 0.11, 0.04, dd.color, { r: 0.01 });
    } else doorLeaf(frame(lb, 0, 0, 0), dd.width, dd.height, dd.color, { glass: id === 'flat' || dd.glass });
    lb.finish(pivot, M);
    root.add(pivot);
    // behind the front door: the street (a picture), seen when the door opens
    const street = new THREE.Mesh(new THREE.PlaneGeometry(dd.width, dd.height), M.view);
    street.position.set(dd.hole.x, dd.height / 2, dd.hole.z - dd.hole.T - 0.02);
    root.add(street);
    // ---- what you cannot walk through, in the world's numbers ----
    const W = (bx) => ({ minX: O[0] + bx.minX, maxX: O[0] + bx.maxX, minZ: O[2] + bx.minZ, maxZ: O[2] + bx.maxZ, h: bx.h });
    const walls = data.walls.map(W);
    const furniture = b.colliders.map((c) => W({ minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1, h: c.h }));
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, top = 0;
    for (const r of data.rooms) { minX = Math.min(minX, r.x0); maxX = Math.max(maxX, r.x1); minZ = Math.min(minZ, r.z0); maxZ = Math.max(maxZ, r.z1); top = Math.max(top, r.h); }
    const box = { minX: O[0] + minX, maxX: O[0] + maxX, minZ: O[2] + minZ, maxZ: O[2] + maxZ };
    const playerRoom = { floor: O[1], ...box, boxes: walls.concat(furniture) };
    const camRoom = { floor: O[1], top: O[1] + top, ...box, boxes: walls, dist: 2.7 };

    // ---- the lights ----
    const hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
    hemi.position.set((minX + maxX) / 2, top, (minZ + maxZ) / 2);
    root.add(hemi);
    const sunWins = data.windows.map((wd) => {
      const o = wd.hole;
      const N = new THREE.Vector3(o.nx, 0, o.nz);                             // into the room
      const U = new THREE.Vector3(o.nz, 0, -o.nx);                            // along the wall
      const mid = new THREE.Vector3(o.x, (o.y0 + o.y1) / 2, o.z).addScaledVector(N, -o.T * 0.62);
      const aim = new THREE.Vector3(wd.aim[0], wd.aim[1], wd.aim[2]);
      const base = aim.clone().sub(mid);
      const yaw0 = Math.atan2(base.x, base.z), pitch0 = Math.atan2(-base.y, Math.hypot(base.x, base.z));
      const spot = new THREE.SpotLight(0xffffff, 0, 0, 0.3, 0.45, 2);
      spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.025;
      spot.shadow.camera.near = 1.0; spot.shadow.camera.far = 14;
      spot.target.position.copy(aim);
      root.add(spot, spot.target);
      const bounce = new THREE.PointLight(0xffd8b0, 0, 5.5, 2);
      root.add(bounce);
      // the beam: thin slices through the air from the window down to the floor (added light)
      const n = 6, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
      const uv = [], idx = [];
      // (v = 1 at the window, where the beam is bright; 0 on the floor, where it has faded)
      for (let i = 0; i < n; i++) { uv.push(0, 1, 1, 1, 1, 0, 0, 0); const a = i * 4; idx.push(a, a + 1, a + 2, a, a + 2, a + 3); }
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const beam = new THREE.Mesh(geo, M.beam);
      beam.frustumCulled = false; beam.renderOrder = 8;
      root.add(beam);
      // the dust
      const COUNT = 140, rnd = new Float32Array(COUNT * 3);
      for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
      dg.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3));
      const du = { uTime: { value: 0 }, uSize: { value: pixelH * 0.012 }, uO: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3() }, uV: { value: new THREE.Vector3() }, uD: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(1, 0.9, 0.7) }, uOpacity: { value: 0 } };
      const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: du, vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      dust.frustumCulled = false; dust.renderOrder = 9;
      root.add(dust);
      return { o, N, U, mid, yaw0, pitch0, spot, bounce, beam, dust, du, w: o.width - 0.08, h: o.y1 - o.y0 - 0.08, dir: new THREE.Vector3(), lastKey: '' };
    });
    const lamps = data.lamps.map((l) => {
      const p = new THREE.PointLight(new THREE.Color(l.color[0], l.color[1], l.color[2]), 0, l.range, 2);
      p.position.set(l.at[0], l.at[1], l.at[2]);
      root.add(p);
      return { ...l, light: p };
    });
    root.traverse((o) => o.layers.set(INTERIOR_LAYER));
    root.visible = false;
    scene.add(root);
    const h = { id, data, root, pivot, O, box, playerRoom, camRoom, hemi, sunWins, lamps, top, door: 0, doorWant: 0, slot: data.slot };
    built[id] = h;
    applyQuality();
    return h;
  }
  // throw a made room away (its shapes and lights; the materials are shared and stay)
  function dispose(id) {
    const h = built[id];
    if (!h) return;
    h.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
      if (o.material && o.material.isShaderMaterial) o.material.dispose();
    });
    scene.remove(h.root);
    delete built[id];
    const i = genCache.indexOf(id);
    if (i >= 0) genCache.splice(i, 1);
  }

  // ======================================================== quality (shadows of the sun spot, dust)
  let Q = { shadows: true, size: 1024, dust: true };
  function applyQuality() {
    for (const h of Object.values(built)) for (const s of h.sunWins) {
      s.spot.castShadow = Q.shadows;
      if (s.spot.shadow.mapSize.x !== Q.size) { s.spot.shadow.mapSize.set(Q.size, Q.size); if (s.spot.shadow.map) { s.spot.shadow.map.dispose(); s.spot.shadow.map = null; } }
      s.dust.visible = Q.dust;
    }
  }

  // ======================================================== the light of the hour
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  let glowNow = -1;
  function light(house, dt, time, rain) {
    const li = lighting.info || {}, el = li.elevation === undefined ? 40 : li.elevation, hour = lighting.hour === undefined ? 12 : lighting.hour;
    const sunK = smooth(-3, 9, el) * (1 - 0.82 * rain);           // how much direct sun
    const warm = 1 - smooth(6, 28, el);                           // a low sun is orange
    const nightK = 1 - smooth(-8, 2, el);
    const moonK = nightK * (1 - 0.6 * rain);
    const lampK = Math.max(1 - smooth(2, 14, el), rain * 0.8);  // the lamps go on before sunset (and on dark rainy days)
    const sunCol = mixC([1.0, 0.93, 0.8], [1.0, 0.55, 0.26], warm);
    const moonCol = [0.5, 0.62, 1.0];
    // the hemisphere: soft light from everywhere - daylight from the windows, or at night a little warm
    // light that the lamps throw back from the walls (the corners stay dark, like in picture 1 at night)
    const fill = house.data.fill ? Object.values(house.data.fill)[0] : [1, 0.9, 0.8];
    const dayK = smooth(-6, 16, el);
    const dayFill = lerp(0.03, 1.0, dayK) * (1 - 0.3 * rain);
    house.hemi.intensity = dayFill + lampK * (1 - dayK) * 0.09;
    const hs = mixC(mixC(mixC([0.95, 0.97, 1.0], fill, 0.5), [0.42, 0.5, 0.72], nightK), [1.0, 0.72, 0.45], lampK * (1 - dayK) * 0.7);
    house.hemi.color.setRGB(hs[0], hs[1], hs[2]);
    house.hemi.groundColor.setRGB(0.5 * fill[0], 0.4 * fill[1], 0.3 * fill[2]);
    for (const m of STD) m.envMapIntensity = 0.05 + 0.33 * dayK;
    // the windows: sun (or moon) through them
    for (const s of house.sunWins) {
      const yaw = s.yaw0 + (hour - 13) * 0.045 * (1 - nightK);                  // the sun moves across the sky: so does its patch
      const pitchDeg = lerp(lerp(s.pitch0 * 57.3, 15, warm), 30, nightK);
      const p = pitchDeg / 57.3;
      s.dir.set(Math.sin(yaw) * Math.cos(p), -Math.sin(p), Math.cos(yaw) * Math.cos(p)).normalize();
      // the light stands 4.5 m outside the window and shines through it
      s.spot.position.copy(s.mid).addScaledVector(s.dir, -4.5);
      s.spot.target.position.copy(s.mid).addScaledVector(s.dir, 3);
      s.spot.angle = Math.atan((Math.hypot(s.w, s.h) / 2 + 0.25) / 4.5);
      const sun = sunK > moonK * 0.2;
      const col = sun ? sunCol : moonCol;
      s.spot.color.setRGB(col[0], col[1], col[2]);
      // (the moon is a faint, cold light: at night the window must not look like morning)
      s.spot.intensity = sun ? 620 * sunK * (0.75 + 0.25 * (1 - warm)) : 7 * moonK;
      // where it lands on the floor: a warm light bounces back from there
      const tt = (s.mid.y - 0.05) / Math.max(0.15, -s.dir.y);
      _a.copy(s.mid).addScaledVector(s.dir, Math.min(tt, 6));
      s.bounce.position.set(_a.x, 0.55, _a.z);
      s.bounce.color.setRGB(col[0] * 1.0, col[1] * 0.86, col[2] * 0.7);
      s.bounce.intensity = sun ? 3.2 * sunK : 0.06 * moonK;
      // the beam and the dust
      const key = `${s.dir.x.toFixed(3)}|${s.dir.y.toFixed(3)}|${s.dir.z.toFixed(3)}`;
      if (key !== s.lastKey) { s.lastKey = key; beamShape(s); }
      const beamK = sun ? 0.2 * sunK : 0.02 * moonK;
      s.du.uOpacity.value = (sun ? 0.85 * sunK : 0.08 * moonK);
      s.du.uColor.value.setRGB(col[0], col[1], col[2]);
      s.du.uTime.value = time;
      s.beamK = beamK; s.col = col;
    }
    const w0 = house.sunWins[0];
    if (w0) { M.beam.opacity = w0.beamK; M.beam.color.setRGB(w0.col[0], w0.col[1], w0.col[2]); }
    // lamps (the bulbs glow when they are on)
    for (const l of house.lamps) l.light.intensity = l.power * lampK * (l.nightOnly ? nightK : 1);
    const g = 0.18 + 0.82 * lampK;
    if (Math.abs(g - glowNow) > 0.01) { glowNow = g; M.glow.color.setScalar(g); }
    // the thin curtains glow with the sun behind them
    M.curtain.emissive.setRGB(sunCol[0] * 0.22 * sunK, sunCol[1] * 0.2 * sunK, sunCol[2] * 0.16 * sunK);
    // the picture outside: day, evening, night
    const dayW = sunK * (1 - warm), eveW = Math.max(0, Math.min(1, (sunK + 0.4 * (1 - nightK)) * warm)), nightW = nightK;
    const sum = dayW + eveW + nightW || 1;
    viewMix.uViewW.value.set(dayW / sum, eveW / sum, nightW / sum);
    M.view.color.setScalar(lerp(0.5, 1.7, smooth(-4, 20, el)) * (1 - 0.35 * rain));
    // the "camera" of the eye: a little more open at night
    const exposure = lerp(1.0, 0.9, smooth(-6, 18, el));
    lighting.interior = { sky: hs, ground: [0.3, 0.25, 0.2], hemi: house.hemi.intensity, exposure, env: 0.35 };
  }
  // the slices of a sun beam: from the glass, along the light, down to the floor
  function beamShape(s) {
    const pos = s.beam.geometry.attributes.position, d = s.dir;
    const V = new THREE.Vector3(0, 1, 0);
    const end = (p) => { const k = (p.y - 0.02) / Math.max(0.12, -d.y); return p.clone().addScaledVector(d, Math.min(k, 7)); };
    let i = 0;
    const quad = (a, b) => {
      const a2 = end(a), b2 = end(b);
      for (const q of [a, b, b2, a2]) pos.setXYZ(i++, q.x, q.y, q.z);
    };
    // four upright slices across the window, two lying ones
    for (let k = 0; k < 4; k++) {
      const u = (k / 3 - 0.5) * s.w * 0.8;
      quad(_v.copy(s.mid).addScaledVector(s.U, u).addScaledVector(V, -s.h / 2).clone(), _b.copy(s.mid).addScaledVector(s.U, u).addScaledVector(V, s.h / 2).clone());
    }
    for (let k = 0; k < 2; k++) {
      const v = (k - 0.5) * s.h * 0.5;
      quad(_v.copy(s.mid).addScaledVector(s.U, -s.w / 2).addScaledVector(V, v).clone(), _b.copy(s.mid).addScaledVector(s.U, s.w / 2).addScaledVector(V, v).clone());
    }
    pos.needsUpdate = true;
    // the dust fills the same box
    const L = (s.mid.y - 0.1) / Math.max(0.12, -d.y);
    s.du.uO.value.copy(s.mid);
    s.du.uU.value.copy(s.U).multiplyScalar(s.w * 0.9);
    s.du.uV.value.set(0, s.h * 0.9, 0);
    s.du.uD.value.copy(d).multiplyScalar(Math.min(L, 6));
  }

  // ======================================================== going in and out
  let state = 'out', T = 0, house = null, via = null, settle = 0, ownPrompt = null, gone = 0;
  const anchor = new THREE.Vector3();
  function setPrompt(label, cb) {
    if (label) {
      if (!ui.actShown || ui.actLabel === label) ui.prompt(label, cb);
      ownPrompt = label;
    } else if (ownPrompt) {
      if (ui.actShown && ui.actLabel === ownPrompt) ui.prompt(null);
      ownPrompt = null;
    }
  }
  function setRoomShade(h) {
    const R = h.data.rooms.map((r) => new THREE.Vector4(h.O[0] + r.x0, h.O[2] + r.z0, h.O[0] + r.x1, h.O[2] + r.z1));
    const far = new THREE.Vector4(-1e6, -1e6, -1e6 + 1, -1e6 + 1);
    roomShade.uRoomA.value.copy(R[0] || far); roomShade.uRoomB.value.copy(R[1] || far); roomShade.uRoomC.value.copy(R[2] || far);
    roomShade.uRoomH.value.set((h.data.rooms[0] || {}).h || 2.8, (h.data.rooms[1] || {}).h || 2.8, (h.data.rooms[2] || {}).h || 2.8);
    roomShade.uRoomY.value = h.O[1];
  }
  // (the screen is black now) put everything inside
  function switchIn() {
    house = build(via.house);
    showPlayer();                     // (every part of the character, also a part added after the game started)
    house.root.visible = true;
    setRoomShade(house);
    camera.layers.set(INTERIOR_LAYER);
    player.setRoom(house.playerRoom);
    const en = house.data.entry;
    player.place(house.O[0] + en.x, house.O[2] + en.z, en.face);
    rig.setRoom(house.camRoom);
    rig.set(en.face, 0.3);
    house.door = 0; house.doorWant = 0; house.pivot.rotation.y = house.data.door.closed;
    anchor.set(via.front.x, via.e.y, via.front.z);
    via.open = 0; via.want = 0;
    gone = 0;
  }
  // (the screen is black now) back to the street, in front of the door
  function switchOut(teleport = true) {
    if (house) house.root.visible = false;
    camera.layers.set(0);
    player.setRoom(null);
    rig.setRoom(null);
    lighting.interior = null;
    if (teleport && via) {
      const heading = Math.atan2(via.e.nx, via.e.nz);
      player.place(via.e.x + via.e.nx * 1.5, via.e.z + via.e.nz * 1.5, heading);
      // (the camera looks back at the player and the door from the side, not squeezed against the wall)
      rig.set(heading + 2.3, 0.2);
      if (via.pivot) { via.open = 1; via.want = 0; }
    }
    house = null;
  }
  function enter(d) {
    if (state !== 'out') return;
    via = d; state = 'entering'; T = 0;
    d.want = 1;
    sound.doorClick('open');
    ui.fade('black', 1, FADE);
    setPrompt(null);
  }
  function leave() {
    if (state !== 'in') return;
    state = 'leaving'; T = 0;
    house.doorWant = 1;
    sound.doorClick('open');
    ui.fade('black', 1, FADE);
    setPrompt(null);
  }
  // leave at once, without walking out (the title screen, the story moved the player away)
  function reset() {
    if (state === 'out') return;
    if (state === 'entering' && !house) { state = 'out'; ui.fade('black', 0, 0.3); if (via) via.want = 0; return; }
    switchOut(false);
    state = 'out';
    ui.fade('black', 0, 0.3);
  }

  // ======================================================== every frame
  // ctx: { can (the player may use a door now), seen (the Guard sees the player now), film (a story film scene runs), rain, time }
  let seenNow = false;
  function update(dt, ctx) {
    T += dt;
    seenNow = !!ctx.seen;
    // the doors of the city turn smoothly
    for (const d of animated) {
      d.open += (d.want - d.open) * Math.min(1, dt * (d.want > d.open ? 7 : 4));
      d.pivot.rotation.y = Math.PI + d.open * 1.55;
      const night = lighting.nightMode ? 1 : 0;
      const lampOn = Math.max(night, 1 - smooth(2, 14, (lighting.info || {}).elevation || 40));
      d.glass.material.color.setRGB(0.25 + 1.75 * lampOn, 0.2 + 1.3 * lampOn, 0.12 + 0.75 * lampOn);
      d.halo.material.opacity = lampOn * (0.35 + 0.35 * (ctx.rain || 0));
      d.halo.scale.setScalar(1.2 + 0.9 * (ctx.rain || 0));
    }
    if (state === 'out') {
      // the nearest door, close enough to open
      let best = null, bd = 1.35;
      const px = player.position.x, pz = player.position.z;
      const cx = Math.floor(px / 16), cz = Math.floor(pz / 16);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const list = grid.get(`${cx + i},${cz + j}`);
        if (list) for (const d of list) { const dist = Math.hypot(d.front.x - px, d.front.z - pz); if (dist < bd) { bd = dist; best = d; } }
      }
      if (best && ctx.can) setPrompt(t('ui.enter'), () => { if (seenNow) { if (hud) hud.toast('THE GUARD CAN SEE YOU', 1800); } else enter(best); });
      else setPrompt(null);
      return;
    }
    if (state === 'entering') {
      if (T > Math.max(OPEN_TIME, FADE) + 0.05 && !house) { switchIn(); settle = 0; }
      if (house) {
        // two frames in the dark (the graphics card prepares the room's materials), then the light comes back
        light(house, dt, ctx.time || 0, ctx.rain || 0);
        if (++settle === 3) { ui.fade('black', 0, 0.7); sound.doorClick('close'); }
        if (settle >= 3) state = 'in';
      }
      return;
    }
    if (!house) { state = 'out'; return; }
    light(house, dt, ctx.time || 0, ctx.rain || 0);
    // the front door from inside
    house.door += (house.doorWant - house.door) * Math.min(1, dt * 6);
    if (!house.data.door.shutter) house.pivot.rotation.y = house.data.door.closed + house.door * 1.45;
    // the room the player is in (for the name on the screen)
    const lx = player.position.x - house.O[0], lz = player.position.z - house.O[2];
    house.roomNow = house.data.rooms.find((r) => lx >= r.x0 - 0.1 && lx <= r.x1 + 0.1 && lz >= r.z0 - 0.1 && lz <= r.z1 + 0.1) || house.roomNow || house.data.rooms[0];
    if (state === 'leaving') {
      if (T > Math.max(OPEN_TIME, FADE) + 0.05) {
        switchOut(true);
        state = 'out';
        ui.fade('black', 0, 0.6);
        setTimeout(() => sound.doorClick('close'), 700);
      }
      return;
    }
    // a film scene of the story starts while the player is inside: back to the door at once, so the scene sees the city
    if (ctx.film) { switchOut(true); state = 'out'; ui.fade('black', 0, 0.3); setPrompt(null); return; }
    // the story (or anything else) took the player out of the house: tidy up
    const inBox = lx > -1 && lx < house.box.maxX - house.O[0] + 1 && lz > -1 && lz < house.box.maxZ - house.O[2] + 1;
    gone = inBox ? 0 : gone + dt;
    if (gone > 0.25) { reset(); return; }
    const ex = house.data.exit;
    if (Math.hypot(lx - ex.x, lz - ex.z) < ex.r && ctx.can) { setPrompt(t('ui.exit'), leave); return; }
    // a place in the room where something can be done (a cash machine, a counter: src/world/places.js);
    // only in free roam
    if (ctx.can && ctx.free && api.onSpot) {
      for (const sp of house.data.spots || []) {
        if (Math.hypot(lx - sp.x, lz - sp.z) > sp.r) continue;
        const label = api.spotLabel ? api.spotLabel(sp) : null;
        if (label) { setPrompt(label, () => api.onSpot(sp, house)); return; }
      }
    }
    setPrompt(null);
  }

  const api = {
    // set by places.js: the button text of a spot (or nothing), and what happens when it is pressed
    spotLabel: null, onSpot: null,
    update, reset,
    get inside() { return state === 'in' || state === 'leaving' || (state === 'entering' && !!house); },
    // moving through a door: the player stands still
    get busy() { return state === 'entering' || state === 'leaving'; },
    // where the house is in the city (the street lives around this point while the player is inside)
    get anchor() { return anchor; },
    get label() {
      if (!house) return '';
      const d = house.data;
      return d.kind && d.kind !== 'home' ? d.name : `${d.name} · ${(house.roomNow || d.rooms[0]).label}`;
    },
    get doors() { return doors; },
    setQuality(q) { Q = { shadows: !!q.shadows, size: 1024, dust: !!q.shadows }; applyQuality(); },
    setViewport(h) { pixelH = h; for (const b of Object.values(built)) for (const s of b.sunWins) s.du.uSize.value = h * 0.012; },
    // tests: go in at once
    enterNow(id = 'villa0') { const d = doors.find((x) => x.e.id === id); if (d) enter(d); return !!d; },
    // tests: how many doors of each kind, and one door of each kind
    kinds() { const out = {}; for (const d of doors) { const k = HOUSES[d.house] ? d.house : kindOf(d.e); out[k] = out[k] || { n: 0, first: d.e.id, x: +d.e.x.toFixed(1), z: +d.e.z.toFixed(1) }; out[k].n++; } return out; },
    leaveNow() { leave(); },
    get state() { return state; },
    viewWeights() { const v = viewMix.uViewW.value; return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; },
    get house() { return house; },
    // while the game loads: build every house and draw it once, hidden behind the loading screen, so the
    // graphics card has prepared its materials and the first visit does not start with a long black screen
    warm(draw) {
      const mask = camera.layers.mask, cp = camera.position.clone(), cq = camera.quaternion.clone(), pp = player.position.clone();
      const first = doors.find((d) => d.house.startsWith('gen:'));
      for (const id of [...Object.keys(HOUSES), ...(first ? [first.house] : [])]) {
        const h = build(id);
        h.root.visible = true;
        setRoomShade(h);
        camera.layers.set(INTERIOR_LAYER);
        camera.position.set(h.box.minX + 0.4, h.O[1] + 1.5, h.box.minZ + 0.4);
        camera.lookAt((h.box.minX + h.box.maxX) / 2, h.O[1] + 1, h.box.maxZ);
        player.position.set((h.box.minX + h.box.maxX) / 2, h.O[1], (h.box.minZ + h.box.maxZ) / 2);
        player.root.updateMatrixWorld(true);
        light(h, 0.016, 0, 0);
        draw();
        h.root.visible = false;
      }
      camera.layers.mask = mask; camera.position.copy(cp); camera.quaternion.copy(cq);
      player.position.copy(pp); player.root.updateMatrixWorld(true);
      lighting.interior = null;
    },
  };
  return api;
}
