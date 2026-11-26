// ---------------------------------------------------------------------------
// safehouseSet.js - LENA'S SAFEHOUSE (Chapter 8, "Talk to Zero"): a small room of its own, like Mace's garage set
// of Chapter 6. While it is shown, the city is not drawn at all (only the room's own layer), so it is cheap.
//
// A rented room above a closed shop, at night, in the rain: worn planks, grey-green walls, one big window with rain
// running down it and the lights of the city blurred behind; a TV on a low cabinet with the news on (the sound low);
// a work table by the window with Lena's laptop (the pilot key glows green on it) and two chairs - one of them
// Dante's, empty; a sofa, a floor lamp, boxes not yet unpacked, a sleeping bag, a board of papers on the wall.
//
//   const S = createSafehouse({ scene, renderer, camera, lighting, takeFace });
//   S.show(true / false)      the room instead of the city (the camera sees only its layer)
//   S.at(x, y, z)             a point of the room -> the world ([x, y, z]: x to the right of the window, z toward the
//                             door, y up from the floor; (0, 0, 0) = the middle of the floor)
//   S.tvFace(actor)           the TV shows that person's face (a picture of the model, see src/ui/portrait.js)
//   S.tv(on), S.lamp(0..1)    the TV, the floor lamp
//   S.update(dt, cast)        every frame while shown (cast: the people and things that must be seen in it)
// Built the first time it is shown.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { INTERIOR_LAYER } from '../interiors/interiors.js';
import { createBuilder, materials as kitMaterials, roomShade } from '../interiors/kit.js';
import { frame, C, chair, table, books, plant, mug, wallShelf, bottle } from '../interiors/furniture.js';
import { sofa, coffeeTable, bookcase, floorLamp, officeChair, boxes } from '../interiors/furniture2.js';
import { RAIN_VS, RAIN_FS } from './garageSet.js';

// where the room is in the world: far out over the sea, where nothing else is (nothing of the city is drawn while
// it is shown, so it does not matter what is around it)
const O = [150, 0, -2600];
const W = 3.2, D = 2.6, TOP = 2.8;            // half its width (x), half its depth (z), its height
const WIN = { x0: -1.7, x1: 0.9, y0: 0.86, y1: 2.32 };   // the window in the back wall (z = -D)
const DOOR = { x0: 1.55, x1: 2.5, y1: 2.1 };            // the door in the front wall (z = +D)

// (the rain on the glass: the same small lenses of water as on Mace's garage window, src/story/garageSet.js)

// the city at night through a wet window: dark sky, rows of buildings with lit windows, a few signs, all a little
// blurred (drawn once into a canvas)
function cityView() {
  const w = 1024, h = 512, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#05080f'); sky.addColorStop(0.55, '#141d2c'); sky.addColorStop(0.75, '#2a2a33'); sky.addColorStop(1, '#0c0d12');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // three rows of buildings: far (pale, small), middle, near (dark, big)
  for (const [base, hMin, hMax, shade, win] of [[0.72, 0.12, 0.42, '#1b2130', 0.35], [0.8, 0.1, 0.36, '#11151e', 0.5], [0.92, 0.05, 0.25, '#07080c', 0.65]]) {
    let x = -20;
    while (x < w) {
      const bw = 40 + rnd() * 90, bh = h * (hMin + rnd() * (hMax - hMin)), top = h * base - bh;
      g.fillStyle = shade; g.fillRect(x, top, bw, h - top);
      // lit windows (warm and cold)
      for (let yy = top + 8; yy < h * base - 6; yy += 9) for (let xx = x + 5; xx < x + bw - 6; xx += 8) {
        if (rnd() < win * 0.32) { g.fillStyle = rnd() < 0.75 ? `rgba(255, ${190 + rnd() * 40 | 0}, 120, ${0.5 + rnd() * 0.5})` : `rgba(150, 200, 255, ${0.4 + rnd() * 0.4})`; g.fillRect(xx, yy, 4, 5); }
      }
      x += bw + rnd() * 6;
    }
  }
  // a few glowing signs, and the glow of the street below
  for (let i = 0; i < 7; i++) { const x = rnd() * w, y = h * (0.55 + rnd() * 0.3); const c = ['255,80,140', '80,220,255', '255,170,60', '160,255,140'][i % 4]; const gr = g.createRadialGradient(x, y, 0, x, y, 40); gr.addColorStop(0, `rgba(${c},0.55)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); }
  const street = g.createLinearGradient(0, h * 0.85, 0, h); street.addColorStop(0, 'rgba(255,170,90,0)'); street.addColorStop(1, 'rgba(255,170,90,0.25)'); g.fillStyle = street; g.fillRect(0, h * 0.85, w, h * 0.15);
  // the wet glass blurs it all a little
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d'); o.filter = 'blur(2.5px)'; o.drawImage(cv, 0, 0);
  const t = new THREE.CanvasTexture(out); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSafehouse({ scene, renderer, camera, lighting, takeFace = null, props = null }) {
  const root = new THREE.Group();
  root.name = 'safehouse';
  root.visible = false;
  scene.add(root);
  let built = null, active = false, saved = null, time = 0, layerT = 0;
  const at = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];

  function build() {
    const M = kitMaterials(renderer);
    const b = createBuilder([0, 0, 0], 31);
    const P0 = (x, z, rot = 0, y = 0) => frame(b, O[0] + x, O[2] + z, rot, O[1] + y);
    const X = (x) => O[0] + x, Y = (y) => O[1] + y, Z = (z) => O[2] + z;
    const wallC = C('#6f7a72'), skirt = C('#3c3a36');
    // ---- the shell: floor, ceiling, four walls (the back one round the window, the front one round the door) ----
    b.plane('planks', [[X(-W), Y(0), Z(-D)], [X(-W), Y(0), Z(D)], [X(W), Y(0), Z(D)], [X(W), Y(0), Z(-D)]], [0, 1, 0], 1.6, C('#8c6c4e'));
    b.plane('plaster', [[X(-W), Y(TOP), Z(-D)], [X(-W), Y(TOP), Z(D)], [X(W), Y(TOP), Z(D)], [X(W), Y(TOP), Z(-D)]], [0, -1, 0], 2, C('#b9b6ad'));
    const wall = (pts, n) => b.plane('wallpaint', pts.map((p) => [X(p[0]), Y(p[1]), Z(p[2])]), n, 1.4, wallC);
    // back wall (z = -D, faces +z): below, above, left and right of the window
    wall([[-W, 0, -D], [W, 0, -D], [W, WIN.y0, -D], [-W, WIN.y0, -D]], [0, 0, 1]);
    wall([[-W, WIN.y1, -D], [W, WIN.y1, -D], [W, TOP, -D], [-W, TOP, -D]], [0, 0, 1]);
    wall([[-W, WIN.y0, -D], [WIN.x0, WIN.y0, -D], [WIN.x0, WIN.y1, -D], [-W, WIN.y1, -D]], [0, 0, 1]);
    wall([[WIN.x1, WIN.y0, -D], [W, WIN.y0, -D], [W, WIN.y1, -D], [WIN.x1, WIN.y1, -D]], [0, 0, 1]);
    // front wall (z = +D, faces -z): round the door
    wall([[-W, 0, D], [DOOR.x0, 0, D], [DOOR.x0, TOP, D], [-W, TOP, D]], [0, 0, -1]);
    wall([[DOOR.x1, 0, D], [W, 0, D], [W, TOP, D], [DOOR.x1, TOP, D]], [0, 0, -1]);
    wall([[DOOR.x0, DOOR.y1, D], [DOOR.x1, DOOR.y1, D], [DOOR.x1, TOP, D], [DOOR.x0, TOP, D]], [0, 0, -1]);
    // side walls
    wall([[-W, 0, -D], [-W, 0, D], [-W, TOP, D], [-W, TOP, -D]], [1, 0, 0]);
    wall([[W, 0, -D], [W, 0, D], [W, TOP, D], [W, TOP, -D]], [-1, 0, 0]);
    // skirting boards
    b.box('paint', X(0), Y(0), Z(-D + 0.01), 2 * W, 0.1, 0.02, skirt, { r: 0.003 });
    b.box('paint', X(-W + 0.01), Y(0), Z(0), 0.02, 0.1, 2 * D, skirt, { r: 0.003 });
    b.box('paint', X(W - 0.01), Y(0), Z(0), 0.02, 0.1, 2 * D, skirt, { r: 0.003 });
    // ---- the window: a deep frame, the sill, the city behind, the glass with rain on it ----
    const wc = C('#2b2d2f'), ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0, wx = (WIN.x0 + WIN.x1) / 2;
    b.box('paint', X(wx), Y(WIN.y0 - 0.05), Z(-D + 0.06), ww + 0.16, 0.05, 0.2, C('#d8d2c4'), { r: 0.01 });
    for (const x of [WIN.x0, WIN.x1]) b.box('paint', X(x), Y(WIN.y0), Z(-D - 0.08), 0.07, wh, 0.18, wc, { r: 0.006 });
    b.box('paint', X(wx), Y(WIN.y1 - 0.035), Z(-D - 0.08), ww, 0.07, 0.18, wc, { r: 0.006 });
    b.box('paint', X(wx), Y(WIN.y0), Z(-D - 0.08), ww, 0.05, 0.18, wc, { r: 0.006 });
    b.box('paint', X(wx), Y(WIN.y0), Z(-D - 0.1), 0.05, wh, 0.07, wc, { r: 0.006 });     // the bar in the middle
    // ---- the TV corner (left wall): a low cabinet, the TV on it (a prop with the news), a plant ----
    const tvc = P0(-W + 0.3, -0.2, Math.PI / 2);
    tvc.box('wood', 0, 0.06, 0, 1.5, 0.42, 0.42, C('#3a2c22'), { r: 0.012, uv: [1.5, 1] });
    for (const sx of [-1, 1]) tvc.box('wood', sx * 0.375, 0.1, 0.21, 0.71, 0.34, 0.02, C('#45352a'), { r: 0.006 });
    plant(tvc, 0.6, 0.48, 0.02, 0.55, { n: 6 });
    books(tvc, -0.68, 0.48, 0.02, 3, { lying: true });
    // ---- the sofa (facing the TV), a coffee table with two mugs and the remote ----
    sofa(P0(-0.55, -0.15, -Math.PI / 2), { w: 2.0, color: C('#4a5560'), pillow: C('#8a6a3e') });
    const ct = P0(-1.75, -0.15, -Math.PI / 2);
    coffeeTable(ct, { w: 1.0, d: 0.52, color: C('#5e4430') });
    mug(ct, -0.2, 0.42, 0.05, C('#c84a3a'), 0.4); mug(ct, 0.25, 0.42, -0.1, C('#e8e2d4'), 2.2);
    ct.box('paint', 0.05, 0.42, 0.12, 0.05, 0.015, 0.16, C('#111214'), { r: 0.006 });
    // ---- the work table by the window: Lena's laptop sits on it (the story's prop), papers, a lamp; two chairs ----
    const tb = P0(1.55, -1.85, 0);
    table(tb, { w: 1.5, d: 0.8, color: C('#6b4b33') });
    tb.paper(-0.45, 0.762, 0.1, 0.21, 0.29, 2, 0.3, -Math.PI / 2);
    tb.paper(-0.6, 0.764, -0.12, 0.21, 0.29, 5, -0.2, -Math.PI / 2);
    mug(tb, 0.6, 0.76, 0.2, C('#2d4f7a'), 1.0);
    bottle(tb, 0.62, 0.76, -0.22, C('#3a5a3a'), 0.8);
    officeChair(P0(1.2, -1.15, Math.PI), { color: C('#2a2d30') });       // Lena's (it faces the table)
    chair(P0(2.25, -1.05, Math.PI + 0.55), { color: C('#5a3a24') });    // DANTE'S: pushed back, turned away, empty
    // ---- the front wall: a bookcase, boxes, the door ----
    bookcase(P0(-1.6, D - 0.2, Math.PI), { w: 0.9, h: 1.9, color: C('#6b4a30') });
    boxes(P0(0, 0), -2.7, D - 0.45, 3, 0.2);
    boxes(P0(0, 0), 2.8, 0.9, 2, -0.3);
    const door = P0((DOOR.x0 + DOOR.x1) / 2, D - 0.02, Math.PI);
    door.box('paint', 0, 0, 0, DOOR.x1 - DOOR.x0, DOOR.y1, 0.05, C('#4a4f52'), { r: 0.01 });
    door.sphere('metal', 0.34, 1.02, 0.05, 0.03, C('#b8bcc0'), 10);
    // ---- the board of papers on the right wall (what they know about KVI), a shelf, a sleeping bag ----
    const bd = P0(W - 0.03, -0.9, -Math.PI / 2, 1.05);
    bd.box('cork', 0, 0, 0, 1.4, 0.9, 0.02, [1, 1, 1], { r: 0.004 });
    for (let i = 0; i < 6; i++) bd.paper(-0.5 + (i % 3) * 0.48, 0.25 + Math.floor(i / 3) * 0.38, 0.012, 0.2, 0.26, (i * 3) % 8, 0, 0);
    // (red string between the papers)
    for (let i = 0; i < 3; i++) bd.box('paint', -0.26 + i * 0.25, 0.42 + (i % 2) * 0.06, 0.014, 0.5, 0.006, 0.004, C('#b0201a'), { r: 0, roll: (i % 2 ? -1 : 1) * 0.35 });
    wallShelf(P0(W - 0.12, 1.2, -Math.PI / 2, 1.55), 0, 0, 0, 0.9, 0.22, C('#5a3a24'));
    const sb = P0(2.6, 1.85, 0.3);
    sb.cyl('cloth', 0, 0.16, 0, 0.16, 0.16, 0.6, C('#2f4a3a'), 14, [0, 0, Math.PI / 2]);
    // ---- THE MEMORY NOOK (the flashback of Chapter 8, out of sight of the room: 8 m beyond its door): a dark steel
    //      table under one cold light, black all round - Solberg's case is put on it by the story ----
    b.box('metal', X(0), Y(0), Z(8.05), 1.1, 0.72, 0.7, C('#2a2e33'), { r: 0.01 });
    b.plane('paint', [[X(-4), Y(0), Z(10.5)], [X(4), Y(0), Z(10.5)], [X(4), Y(4), Z(10.5)], [X(-4), Y(4), Z(10.5)]], [0, 0, -1], 1, C('#040506'));
    b.plane('paint', [[X(-4), Y(0), Z(5.5)], [X(-4), Y(0), Z(10.5)], [X(4), Y(0), Z(10.5)], [X(4), Y(0), Z(5.5)]], [0, 1, 0], 1, C('#07080a'));
    // ---- the floor lamp (its light is a real lamp of the room) ----
    const lampAt = floorLamp(P0(0.35, 1.55, 0), 0, 0, C('#e8d6b0'));
    const { group, meshes } = b.finish(root, M);
    group.traverse((m) => m.layers.set(INTERIOR_LAYER));

    // the city behind the window, and the rain on the glass
    const view = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: cityView(), toneMapped: true }));
    view.position.set(X(wx), Y(1.55), Z(-D - 2.2)); view.layers.set(INTERIOR_LAYER); root.add(view);
    // (cold city light behind the drops: their tint)
    const rainU = { uTime: { value: 0 }, uScale: { value: new THREE.Vector2(ww * 1.1, wh * 1.1) }, uOpacity: { value: 0.8 }, uTint: { value: new THREE.Color(0.55, 0.62, 0.74) }, uSoft: { value: 0.25 } };
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.04, wh - 0.04), new THREE.ShaderMaterial({ uniforms: rainU, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false }));
    rain.position.set(X(wx), Y(WIN.y0 + wh / 2), Z(-D - 0.04)); rain.layers.set(INTERIOR_LAYER); rain.renderOrder = 6; root.add(rain);
    // the dark glass itself (a faint reflection of the room)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.04, wh - 0.04), new THREE.MeshStandardMaterial({ color: 0x0c1014, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, depthWrite: false }));
    glass.position.set(X(wx), Y(WIN.y0 + wh / 2), Z(-D - 0.05)); glass.layers.set(INTERIOR_LAYER); glass.renderOrder = 5; root.add(glass);

    // the TV with the news (a prop: its face and headline are set by the story)
    let tv = null;
    if (props) {
      tv = props.make('newsTv', {});
      tv.position.set(X(-W + 0.32), Y(0.5), Z(-0.2)); tv.rotation.y = Math.PI / 2;
      tv.traverse((m) => m.layers.set(INTERIOR_LAYER)); root.add(tv);
    }
    // ---- the lights of the room: the warm floor lamp, the cold flicker of the TV ----
    const lamp = new THREE.PointLight(0xffb36a, 7, 7.5, 2);
    lamp.position.set(lampAt[0], lampAt[1], lampAt[2]); lamp.layers.set(INTERIOR_LAYER); root.add(lamp);
    const tvLight = new THREE.PointLight(0x7aa8ff, 2.2, 5.5, 2);
    tvLight.position.set(X(-W + 0.9), Y(1.0), Z(-0.2)); tvLight.layers.set(INTERIOR_LAYER); root.add(tvLight);
    return { meshes, rainU, tv, lamp, tvLight, lampOn: 1, tvOn: 1 };
  }

  // the room's own soft light and its darker corners (like the houses of src/interiors and Mace's garage)
  function setRoomShade() {
    roomShade.uRoomA.value.set(O[0] - W, O[2] - D, O[0] + W, O[2] + D);
    const far = new THREE.Vector4(-1e6, -1e6, -1e6 + 1, -1e6 + 1);
    roomShade.uRoomB.value.copy(far); roomShade.uRoomC.value.copy(far);
    roomShade.uRoomH.value.set(TOP, TOP, TOP);
    roomShade.uRoomY.value = O[1];
  }
  function show(on) {
    if (on && !active) {
      if (!built) built = build();
      active = true; root.visible = true; layerT = 0;
      saved = { mask: camera.layers.mask };
      camera.layers.set(INTERIOR_LAYER);
      if (lighting) lighting.interior = { sky: [0.12, 0.15, 0.22], ground: [0.07, 0.06, 0.05], hemi: 0.4, exposure: 1.2, env: 0.22 };
      setRoomShade();
    } else if (!on && active) {
      active = false; root.visible = false;
      if (saved) camera.layers.mask = saved.mask; else camera.layers.set(0);
      if (lighting) lighting.interior = null;
    }
  }
  // what the camera must see besides the room: the player, the story's people and things (the set's layer is added)
  function layerAll(list) { for (const o of list) if (o) o.traverse((m) => { if ((m.isMesh || m.isSkinnedMesh || m.isPoints || m.isLight || m.isSprite) && !m.layers.isEnabled(INTERIOR_LAYER)) m.layers.enable(INTERIOR_LAYER); }); }
  function update(dt, cast = []) {
    if (!active || !built) return;
    time += dt;
    built.rainU.uTime.value = time;
    if (built.tv && built.tv.userData.anim) built.tv.userData.anim(time);
    // the TV's light flickers with the pictures; the lamp is steady
    const fl = 0.75 + 0.25 * Math.sin(time * 3.1) * Math.sin(time * 1.7 + 1) + 0.1 * Math.sin(time * 11.3);
    built.tvLight.intensity = 2.2 * fl * built.tvOn;
    built.lamp.intensity = 7 * built.lampOn;
    layerT -= dt;
    if (layerT <= 0) { layerT = 0.25; layerAll(typeof cast === 'function' ? cast() : cast); }
  }

  return {
    show, update, at,
    get active() { return active; },
    // the room the game camera stays in (camera.js "room")
    get room() { return { minX: O[0] - W, maxX: O[0] + W, minZ: O[2] - D, maxZ: O[2] + D, floor: O[1], top: O[1] + TOP - 0.2, dist: 2.4 }; },
    // the TV shows a person's face: a picture of the model (taken once); headline / ticker: the words of the news
    tvFace(actor, headline, ticker) {
      if (!built) built = build();
      if (!built.tv) return false;
      if (headline !== undefined || ticker !== undefined) built.tv.userData.setText(headline, ticker);
      if (!actor || !takeFace) return false;
      const cv = takeFace(actor);
      if (cv) built.tv.userData.setFace(cv);
      return !!cv;
    },
    tv(on) { if (built) { built.tvOn = on ? 1 : 0; if (built.tv) built.tv.visible = !!on; } },
    lamp(v) { if (built) built.lampOn = Math.max(0, Math.min(1, v)); },
  };
}
