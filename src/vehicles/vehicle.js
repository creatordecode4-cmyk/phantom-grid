// ---------------------------------------------------------------------------
// vehicle.js - every vehicle the player can use: cars, the boat, the drone.
//
// HOW IT FITS TOGETHER
//   * Parked cars are cheap "instanced" copies (see props.js). When the player
//     gets into one, that copy is hidden and a real vehicle object is put in
//     its place.
//   * A real car has a body that pitches and rolls, doors that swing open,
//     glass you can look through, seats, a dashboard and a steering wheel.
//     Cars made in code are cut into these parts here. Cars from model files
//     (assets/vehicles/) show a light version first; the detailed model is
//     loaded when somebody gets in or stands next to it.
//   * HOW IT MOVES is in physics.js (engine, gears, grip, boat, drone). This
//     file runs that physics in fixed steps of 1/60 s and turns the results
//     into what you see and hear: lights, smoke, skid marks, sounds, damage.
//   * Roles: police cars have flashing lights and a siren, the supercar has
//     nitro, the armored van is heavy and strong, the boat floats, the drone flies.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CAR_TYPES, carInfo, makeCar, makeWheel, registerCar } from './carModels.js';
import { makeInterior, makeDriver, splitBody, seatOf } from './carParts.js';
import { VEHICLE_SPECS } from './vehicleLoader.js';
import { initCarState, stepCar, initBoatState, stepBoat, initDroneState, stepDrone, IDLE_RPM, RED_RPM } from './physics.js';
import { makeDrone, lin } from '../city/models.js';
import { mountDetailedWheel, addBrake } from './wheelDetail.js';
import { BIKE_INFO, BIKE_SPEC, BIKE_HEAD, BIKE_RAKE, BIKE_BAR, BIKE_GRIP, BIKE_PEG, BIKE_EYE, BIKE_R, BIKE_PARK_LEAN, bikeBodyIn } from './bike.js';
import { clamp, damp } from '../utils/math.js';
import { createCargo } from './cargo.js';

const KMH = 3.6;
const STEP = 1 / 60;                   // the physics always runs in steps of this length
const ENTER_RANGE = 3.3;               // how close the player has to stand to get in
// where a passenger sits in the patrol boat: on the flat side deck on the RIGHT, near the back, facing out over
// the water, legs over the side (measured from the model: the deck is 1.81 m above the keel, from 1.05 to 1.72 m
// out from the middle; the cabin is in the middle)
const BOAT_SEAT = { x: -1.42, y: 1.81, z: -3.0, yaw: -Math.PI / 2, floorBelow: 0.5 };

// Soft light on the road in front of the car (white = light, see-through elsewhere).
export function makeBeamTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 128);
  // two lamps: two overlapping pools that start at the bottom edge (the nose of the car)
  for (const cx of [22, 42]) {
    const grad = g.createRadialGradient(cx, 120, 2, cx, 70, 78);
    grad.addColorStop(0, 'rgba(255,250,235,1)');
    grad.addColorStop(0.35, 'rgba(255,250,235,0.5)');
    grad.addColorStop(1, 'rgba(255,250,235,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(cx, 66, 26, 64, 0, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createVehicles({ scene, city, materials, sound, weather, carLib = null, effects, settings }) {
  const mats = materials.mats;
  const L = city.layout, B = L.bounds;
  const geo = { body: {}, wheel: {} };
  // which detailed rim each car made in code gets (wheelDetail.js)
  const RIMS = { sedan: 'blade6', suv: 'mesh10', van: 'blade6', coupe: 'twin5', police_coupe: 'twin5' };
  const beamTex = makeBeamTexture();
  const live = [];        // real car objects
  let active = null;      // the car the player sits in (or is getting into / out of)
  let state = 'none';     // none | entering | driving | exiting
  let stateTime = 0;
  let shake = 0;          // camera shake after a crash (goes back to 0)
  let exitWanted = false;
  let message = '';       // a short text for the player (main.js shows it and clears it)
  let haptic = 0;         // phone vibration wanted (milliseconds), main.js does it
  const events = [];      // things other systems react to: { type: 'crash' | 'hitCar' ..., strength }

  // ------------------------------------------------------------- build a car
  // glass you can look through (all cars share it)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x141c21, transparent: true, opacity: 0.56, roughness: 0.03, metalness: 0.0, envMapIntensity: 2.2,
    depthWrite: false, side: THREE.DoubleSide,
  });
  // the dark inside of the body shell and the doors
  const liningMat = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.9, side: THREE.BackSide });
  const addLining = (mesh) => { const m = new THREE.Mesh(mesh.geometry, liningMat); m.name = 'lining'; mesh.add(m); };
  // the dark spot under every real car
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: materials.tex.glow, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -12 });
  const wheelGeo = new THREE.TorusGeometry(0.17, 0.022, 5, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.5 });
  // broken glass: milky and dull
  const crackedMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa4a8, transparent: true, opacity: 0.78, roughness: 0.65, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  let detailed = 0;       // how many vehicles show their detailed model
  const interiors = {};   // seats, dashboard ... one geometry per car type
  const drivers = {};

  // A CHEAP CAR for computer drivers (story racers, cars that overtake): one mesh, wheels that do not turn,
  // no doors and no inside. It costs 2 draw calls instead of about 18.
  const cheapGeo = {};
  function partsSimple(v) {
    const key = v.kind + '|' + v.color.map((c) => c.toFixed(3)).join(',');
    if (!cheapGeo[key]) {
      const g = makeCar(v.kind, { wheels: true }).clone();
      const c = g.attributes.color, d = g.attributes.aData;
      // paint: the color is written into the points that carry paint (the third "data" number says how much)
      for (let i = 0; i < c.count; i++) { const k = d ? d.getZ(i) : 0; c.setXYZ(i, c.getX(i) * (1 + (v.color[0] - 1) * k), c.getY(i) * (1 + (v.color[1] - 1) * k), c.getZ(i) * (1 + (v.color[2] - 1) * k)); }
      cheapGeo[key] = g;
    }
    const body = new THREE.Mesh(cheapGeo[key], mats.carPaint);
    body.castShadow = true;
    v.tilt.add(body);
    v.paintMeshes = [];
  }

  // A CAR MADE IN CODE: the body is cut into body, glass and two real doors.
  function partsFromCode(v) {
    const { kind, info, color } = v;
    if (!geo.body[kind]) { geo.body[kind] = makeCar(kind, { wheels: false }); geo.wheel[kind] = makeWheel(kind); }
    const cut = splitBody(geo.body[kind], info, color);
    const body = new THREE.Mesh(cut.body, mats.carPaint);
    body.castShadow = true; body.receiveShadow = true;
    addLining(body);
    v.tilt.add(body);
    const glass = new THREE.Mesh(cut.glass, glassMat);
    glass.renderOrder = 16;
    v.tilt.add(glass);
    for (const d of cut.doors) {
      const door = new THREE.Group();
      door.position.set(d.origin[0], d.origin[1], d.origin[2]);
      const skin = new THREE.Mesh(d.paint, mats.carPaint);
      skin.castShadow = true;
      addLining(skin);
      const win = new THREE.Mesh(d.glass, glassMat);
      win.renderOrder = 16;
      door.add(skin, win);
      v.tilt.add(door);
      if (d.side > 0) v.doorL = door; else v.doorR = door;
    }
    // wheels: front left, front right, rear left, rear right (the car's left side is +x)
    for (const wz of [info.wheelZ[1], info.wheelZ[0]]) {
      for (const sx of [1, -1]) {
        const steerNode = new THREE.Group();
        steerNode.position.set(sx * info.wheelX, info.wheelR, wz);
        // a detailed wheel: spokes, lug nuts, a drilled brake disc and a caliper (wheelDetail.js)
        const w = mountDetailedWheel(steerNode, info.wheelR, 0.24, RIMS[kind] || 'twin5', sx, mats.carPaint, 0.66);
        v.group.add(steerNode);
        v.wheels.push({ steerNode, mesh: w, front: wz > 0, spin: sx > 0 ? 1 : -1 });
      }
    }
    v.paintMeshes = [];
    v.tilt.traverse((m) => { if (m.isMesh && m.material === mats.carPaint) v.paintMeshes.push(m); });
    addInside(v);
  }

  // A CAR FROM A MODEL FILE. First the light version is shown; the detailed one
  // (with doors, glass and turning wheels) replaces it as soon as it is loaded.
  function partsFromModel(v) {
    const info = v.info;
    const simple = new THREE.Mesh(carLib.geo[v.kind], v.tint ? tintedSimple(v.tint) : mats.carPaint);
    simple.castShadow = true; simple.receiveShadow = true;
    v.tilt.add(simple);
    // the detailed model is only fetched when somebody needs it (v.needDetail())
    v.needDetail = () => { if (v.detailAsked) return; v.detailAsked = true; detailed++; carLib.loadHi(v.kind).then((scene) => {
      if (!scene || !live.includes(v)) return;
      const before = new Set([...v.tilt.children, ...v.group.children]);
      const model = scene.clone(true);
      const take = (name) => model.getObjectByName(name);
      const paint = (o) => {
        // (collect the meshes first: the dark lining adds new ones while we work)
        const meshes = [];
        o.traverse((m) => { if (m.isMesh) meshes.push(m); });
        for (const m of meshes) {
          if (m.name.endsWith('glass')) { m.material = glassMat; m.renderOrder = 16; continue; }
          m.material = paintFor(m.material, v.tint);
          m.castShadow = true; m.receiveShadow = true;
          if (!m.name.startsWith('wheel')) addLining(m); // wheels are solid, they need no inside
        }
      };
      for (const name of ['body', 'glass', 'door_l', 'door_r']) {
        const o = take(name);
        if (!o) continue;
        paint(o);
        v.tilt.add(o);
        if (name === 'door_l') v.doorL = o;
        if (name === 'door_r') v.doorR = o;
      }
      for (const [name, front] of [['wheel_fl', true], ['wheel_fr', true], ['wheel_rl', false], ['wheel_rr', false]]) {
        const o = take(name);
        if (!o) continue;
        paint(o);
        const steerNode = new THREE.Group();
        steerNode.position.copy(o.position);
        const side = o.position.x >= 0 ? 1 : -1;
        o.position.set(0, 0, 0);
        steerNode.add(o);
        // a brake disc and a caliper behind the spokes of the model's own rim
        addBrake(o, steerNode, info.wheelR, info.wheelR * 0.6, side, mats.carPaint);
        v.group.add(steerNode);
        v.wheels.push({ steerNode, mesh: o, front, spin: 1 });
      }
      // this scan had no usable wheels: mount clean wheels made in code
      if (info.codeWheels && info.wheels) {
        for (const [name, front, sx] of [['wheel_fl', true, 1], ['wheel_fr', true, -1], ['wheel_rl', false, 1], ['wheel_rr', false, -1]]) {
          const p = info.wheels[name];
          const steerNode = new THREE.Group();
          steerNode.position.set(p[0], info.wheelR, p[2]);
          const w = mountDetailedWheel(steerNode, info.wheelR, 0.26, RIMS[v.kind] || 'twin5', sx, mats.carPaint, 0.7);
          v.group.add(steerNode);
          v.wheels.push({ steerNode, mesh: w, front, spin: sx });
        }
      }
      v.paintMeshes = [];
      v.tilt.traverse((m) => { if (m.isMesh && m.material && m.material.userData.paintSrc) v.paintMeshes.push(m); });
      addInside(v);
      // everything that was just added is "the detailed model": it can be switched
      // back to the light version when the car is far away (see prefetch)
      const nodes = [...v.tilt.children, ...v.group.children].filter((o) => !before.has(o) && o !== v.tilt && o !== v.driver);
      let on = true;
      simple.visible = false;
      v.detailOn = true;
      v.setDetail = (want) => { if (want === on) return; on = want; v.detailOn = want; simple.visible = !want; for (const o of nodes) o.visible = want; };
    }).catch((e) => console.warn('[vehicles] could not show the detailed model of', v.kind, e)); };
  }
  // THE STREET BIKE (bike.js): the body, a front that turns about the raked steering head, two detailed wheels.
  // Both wheels sit inside "tilt", so the whole bike leans into a corner.
  function partsBike(v) {
    const g = bikeBodyIn(v.color || [0.45, 0.025, 0.02]);
    const body = new THREE.Mesh(g.body, mats.carPaint);
    body.castShadow = true; body.receiveShadow = true;
    v.tilt.add(body);
    // the front: a head that leans back by the rake, the turning part inside it, the wheel at the bottom of the fork
    const head = new THREE.Group();
    head.position.set(BIKE_HEAD[0], BIKE_HEAD[1], BIKE_HEAD[2]);
    head.rotation.x = -BIKE_RAKE;
    const steer = new THREE.Group();
    head.add(steer);
    const front = new THREE.Mesh(g.front, mats.carPaint);
    front.castShadow = true;
    steer.add(front);
    const axle = new THREE.Group();
    axle.position.set(0, -g.forkLen, 0);
    axle.rotation.x = BIKE_RAKE;                        // (the wheel itself stands upright again)
    steer.add(axle);
    const fw = mountDetailedWheel(axle, BIKE_R, 0.12, 'bikeF', -1, mats.carPaint, 0.72);
    v.tilt.add(head);
    v.wheels.push({ steerNode: steer, mesh: fw, front: true, spin: -1 });
    const rearNode = new THREE.Group();
    rearNode.position.set(0, BIKE_R, BIKE_INFO.wheelZ[0]);
    const rw = mountDetailedWheel(rearNode, BIKE_R, 0.18, 'bikeR', -1, mats.carPaint, 0.72);
    v.tilt.add(rearNode);
    v.wheels.push({ steerNode: rearNode, mesh: rw, front: false, spin: -1 });
    // (no seats or dashboard inside: the rider sits on the bike; the cockpit view is the rider's eyes)
    v.driver = new THREE.Object3D();
    v.tilt.add(v.driver);
    v.eye = BIKE_EYE;
    v.paintMeshes = [];
    // the kickstand: out while nobody rides the bike (then the bike leans on it)
    v.kick = new THREE.Mesh(g.kick, mats.carPaint);
    v.tilt.add(v.kick);
    v.lean = BIKE_PARK_LEAN;
  }

  // model files bring their own picture; we add a clear coat and the street lamp light at night
  // tint: [r, g, b] darkens / colors the whole car (story: the black Phantom)
  const paintCache = new Map();   // picture of the model -> (tint -> the 4 damage levels)
  function paintFor(src, tint = null) {
    const id = tint ? tint.join(',') : '';
    let byTint = paintCache.get(src);
    if (!byTint) paintCache.set(src, (byTint = new Map()));
    if (byTint.has(id)) return byTint.get(id)[0];
    // (the same picture is kept; three more copies get darker and duller for damaged cars)
    const make = (level) => {
      const m = new THREE.MeshPhysicalMaterial({
        map: src.map, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap, roughness: 1, metalness: 1,
        clearcoat: 0.6 * (1 - level / 3), clearcoatRoughness: 0.12 + level * 0.15, envMapIntensity: 1.3 - level * 0.25,
      });
      m.color.setScalar(1 - level * 0.2);
      if (tint) m.color.multiply(new THREE.Color(tint[0], tint[1], tint[2]));
      m.userData.paintSrc = src; m.userData.level = level;
      materials.lampPatch(m);
      return m;
    };
    const set = [make(0), make(1), make(2), make(3)];
    for (const m of set) m.userData.paintSet = set;
    byTint.set(id, set);
    return set[0];
  }
  // the light version of a model car in another color
  const simpleTints = new Map();
  function tintedSimple(tint) {
    const id = tint.join(',');
    if (!simpleTints.has(id)) {
      const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.14 });
      m.color.setRGB(tint[0], tint[1], tint[2]);
      materials.lampPatch(m);
      simpleTints.set(id, m);
    }
    return simpleTints.get(id);
  }
  // seats, dashboard and (while somebody drives) a driver
  function addInside(v) {
    const k = v.kind;
    if (!interiors[k]) { interiors[k] = makeInterior(v.info); drivers[k] = makeDriver(v.info); }
    v.tilt.add(new THREE.Mesh(interiors[k], mats.prop));
    v.driver = new THREE.Mesh(drivers[k], mats.prop);
    v.driver.visible = false;
    v.tilt.add(v.driver);
    // the steering wheel turns with the front wheels
    const hub = new THREE.Group();
    hub.position.fromArray(interiors[k].userData.wheel);
    hub.rotation.x = -0.45;
    v.steerWheel = new THREE.Mesh(wheelGeo, wheelMat);
    hub.add(v.steerWheel);
    v.tilt.add(hub);
    v.eye = interiors[k].userData.eye;
  }

  // the drone has no model file: it is made in code (1.8 m wide)
  let droneGeo = carLib && carLib.drone;
  if (!droneGeo) {
    droneGeo = makeDrone();
    droneGeo.scale(1.7, 1.7, 1.7);
    registerCar('drone', { length: 1.8, halfWidth: 0.9, boxHalfWidth: 0.9, roof: 0.45, backZ: -0.9, frontZ: 0.9, wheelR: 0.1, wheelX: 0.5, wheelZ: [-0.5, 0.5], door: { z0: 0, z1: 0, y0: 0, y1: 0 }, seat: null }, VEHICLE_SPECS.drone);
  }
  // the street bike is made in code (bike.js)
  registerCar('street_bike', BIKE_INFO, BIKE_SPEC);
  { const bi = carInfo('street_bike'); bi.noseY = 0.95; bi.tailY = 0.98; bi.lampW = 0.025; }
  const SHORE = L.bounds.minZ - 1.6;   // the boat cannot come closer to the beach than this
  // the sea, and the canals of The Sunk (Chapter 3): there the boat may pass the shore line, and the
  // walls, pontoons and other boats stop it (collideBoat below)
  const SK = city.sunk;
  const DK = city.docks;     // Chapter 5: the channel of Rustwater Docks is open to boats too
  const seaWorld = {
    waterLevel: L.ocean.level, shoreZ: SHORE, minX: B.minX - 250, maxX: B.maxX + 250, minZ: B.minZ - 1100,
    canal: SK || DK ? (x, z) => (SK && SK.inZone(x, z, 10) && z < -86) || (DK && DK.inChannel(x, z, 2)) : null,
    collide: (v) => collideBoat(v),
    ramps: [],                 // floating junk with a plank: boats jump from it (Chapter 5; the story adds them)
  };

  function makeVehicle(kind, x, y, z, rot, color, opts = {}) {
    const info = carInfo(kind), type = CAR_TYPES[kind];
    const role = type.role || 'car';
    const isCar = role === 'car' || role === 'police';
    const group = new THREE.Group();   // place and direction
    const tilt = new THREE.Group();    // body roll and pitch
    group.add(tilt);
    let beam = null, beamMat = null;
    if (isCar) {
      // headlight beam: a soft patch of light lying on the road in front of the car
      const beamGeo = new THREE.PlaneGeometry(8, 19);
      beamGeo.rotateX(-Math.PI / 2);
      beamMat = new THREE.MeshBasicMaterial({
        map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14, fog: false,
      });
      beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 0.04, info.frontZ + 9.3);
      beam.renderOrder = 13;
      beam.visible = false;
      group.add(beam);
      // soft dark spot under the car: it sits on the road in any light (also without real shadows)
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.scale.set(info.halfWidth * 2 + 0.9, 1, info.length + 1.0);
      shadow.position.y = 0.03;
      shadow.renderOrder = 12;
      group.add(shadow);
    }
    group.position.set(x, y, z);
    group.rotation.y = rot;
    scene.add(group);
    // collision shape: three circles along the vehicle, sized from its box
    const radius = clamp((info.boxHalfWidth || info.halfWidth) * 0.97, role === 'drone' ? 0.5 : 0.85, 1.45);
    const reach = Math.max(0, info.length / 2 - radius);
    const v = {
      kind, info, type, role, isCar, group, tilt, wheels: [], doorL: null, doorR: null, driver: null, beam, beamMat, color,
      x, y, z, heading: rot, doorOpen: 0, radius, circles: reach > 0.3 ? [reach, 0, -reach] : [0],
      label: type.label, tag: !!opts.tag, keep: !!opts.keep, npc: !!opts.npc, ai: null,
      // story hooks: tint (color), lights ('normal' | 'off' | 'bar'), limit (top speed in m/s, 0 = none),
      // lockExit (the player may not get out), arena (a place with its own ground and walls)
      tint: opts.tint || null, lights: opts.lights || 'normal', limit: 0, lockExit: false, arena: opts.arena || null,
      noDetail: !!opts.noDetail,   // never load the detailed model (computer drivers)
      away: false,                 // true: not in the world right now (the test garage during the story)
      dead: false,                 // true: the engine does not run any more (a wreck in a story scene)
      curbSide: false,             // true: the driver gets out on the right, the sidewalk side
      siren: false, hiBeam: false, blink: 0, blinkT: 0, startT: 0, level: 0, lastSmoke: 0, wheelPrev: null, hitX: x, hitZ: z, scrapeT: 0, turboArmed: false,
    };
    if (role === 'boat') initBoatState(v); else if (role === 'drone') initDroneState(v); else initCarState(v);
    live.push(v);
    if (role === 'boat') { const m = new THREE.Mesh(carLib.boat, opts.tint ? boatPaint(opts.tint) : mats.carPaint); m.castShadow = true; tilt.add(m); }
    else if (role === 'drone') { const m = new THREE.Mesh(droneGeo, carLib && carLib.drone ? mats.carPaint : mats.prop); m.castShadow = true; m.position.y = 0.16; tilt.add(m); }
    else if (info.bike) partsBike(v);
    else if (info.model && carLib && carLib.geo[kind]) partsFromModel(v);
    else if (opts.simple) partsSimple(v);
    else partsFromCode(v);
    return v;
  }

  // a boat in other colors (the Guard's dark boats, Mace's rusty old one): the same shader, one color over the whole model
  const boatPaints = new Map();
  function boatPaint(c) {
    const key = c.join(',');
    if (!boatPaints.has(key)) {
      const m = mats.carPaint.clone();
      m.color.setRGB(c[0], c[1], c[2]);
      m.onBeforeCompile = mats.carPaint.onBeforeCompile;
      m.customProgramCacheKey = mats.carPaint.customProgramCacheKey;
      boatPaints.set(key, m);
    }
    return boatPaints.get(key);
  }

  function removeVehicle(v) {
    scene.remove(v.group);
    if (v.beamMat) v.beamMat.dispose();
    if (v.detailAsked) detailed--;
    const i = live.indexOf(v);
    if (i >= 0) live.splice(i, 1);
  }

  // A parked copy becomes a real car.
  function takeParked(rec) {
    rec.taken = true;
    const sets = city.props.sets;
    sets[rec.kind].all.fill(0, rec.index * 16, rec.index * 16 + 16);
    sets.carShadow.all.fill(0, rec.shadow * 16, rec.shadow * 16 + 16);
    for (const c of rec.circles) c.x = 1e7; // its fixed collision circles move far away
    city.props.recull();
    return makeVehicle(rec.kind, rec.x, rec.y, rec.z, rec.rot, rec.color);
  }
  // take the parked copies out of an area (the garage, a spawn place)
  function clearParked(test) {
    let any = false;
    for (const rec of city.parkedCars) {
      if (rec.taken || !test(rec)) continue;
      rec.taken = true; any = true;
      city.props.sets[rec.kind].all.fill(0, rec.index * 16, rec.index * 16 + 16);
      city.props.sets.carShadow.all.fill(0, rec.shadow * 16, rec.shadow * 16 + 16);
      for (const c of rec.circles) c.x = 1e7;
    }
    if (any) city.props.recull();
  }

  // ------------------------------------------------------- which vehicle is near?
  function nearest(px, pz) {
    let best = null, bestD = 1e9;
    for (const v of live) {
      if (v === active || v.npc || v.away || (enterFilter && !enterFilter(v))) continue;
      const d = Math.hypot(v.x - px, v.z - pz) - (v.role === 'boat' ? 3.5 : 0);
      if (d < ENTER_RANGE && d < bestD) { bestD = d; best = { live: v, x: v.x, z: v.z }; }
    }
    if (!enterFilter) for (const rec of city.parkedCars) {
      if (rec.taken) continue;
      const dx = rec.x - px, dz = rec.z - pz;
      if (Math.abs(dx) > ENTER_RANGE || Math.abs(dz) > ENTER_RANGE) continue;
      const d = Math.hypot(dx, dz);
      if (d < ENTER_RANGE && d < bestD) { bestD = d; best = { parked: rec, x: rec.x, z: rec.z }; }
    }
    return best;
  }

  // Start loading the detailed model of the model cars close to the player, so
  // it is ready when they get in (it is about 1 MB per car type).
  // budget: how many vehicles may show their detailed model at the same time (the nearest ones win)
  const byDist = [];
  function prefetch(px, pz, budget = 8) {
    if (!carLib) return;
    for (const rec of city.parkedCars) {
      if (rec.taken || !carLib.geo[rec.kind]) continue;
      if (Math.abs(rec.x - px) < 14 && Math.abs(rec.z - pz) < 14) carLib.loadHi(rec.kind);
    }
    // the real vehicles nearest to the player show their detailed model, the others the light one
    byDist.length = 0;
    for (const v of live) {
      if (!v.needDetail || v.away) continue;
      const d = v === active ? -1 : Math.hypot(v.x - px, v.z - pz);
      // computer drivers (the Guard, the racers) show their detailed model only right next to the player
      // (when they ram you, they do not look like soft blobs any more)
      if (v.noDetail && d > 14) { if (v.setDetail) v.setDetail(false); continue; }
      // (a computer driver that shows its detailed model already counts 3 m nearer: two cars side by side do not
      // swap back and forth between the two versions)
      v.lodD = d; v.lodKey = v.noDetail && v.detailOn ? d - 3 : d; byDist.push(v);
    }
    byDist.sort((a, b) => a.lodKey - b.lodKey);
    // computer drivers in a pack (a race grid, the rivals around him): only the nearest one shows the detailed
    // model (four on HIGH): a detailed car costs about 27 draw calls, the light one 2 or 3
    const npcMax = budget >= 8 ? 4 : 1;
    let npc = 0;
    byDist.forEach((v, i) => {
      let want = v === active || (i < budget && v.lodD < 20);
      if (want && v.noDetail && v !== active) want = ++npc <= npcMax;
      if (want && !v.detailAsked && (v === active || v.lodD < 10)) v.needDetail();
      if (v.setDetail) v.setDetail(want);
    });
  }

  // is this spot free to stand on?
  function spotFree(x, z) {
    if (x < B.minX + 0.5 || x > B.maxX - 0.5 || z < B.minZ + 0.5 || z > B.maxZ - 0.5) return false;
    const cell = city.colliders.near(x, z);
    for (const b of cell.boxes) if (x > b.minX - 0.4 && x < b.maxX + 0.4 && z > b.minZ - 0.4 && z < b.maxZ + 0.4) return false;
    for (const c of cell.circles) if (Math.hypot(c.x - x, c.z - z) < c.r + 0.4) return false;
    for (const c of city.colliders.dynamic || []) if (Math.hypot(c.x - x, c.z - z) < c.r + 0.4) return false;
    return true;
  }
  // a boat in the harbor of the docks (there is no beach there: he gets out at the slip or the pier)
  function inHarbor(v) { return !!DK && v.x < L.docks.maxX + 6 && v.x > L.docks.minX - 60 && v.z < L.docks.maxZ; }
  // where the driver stands next to the vehicle (left side first)
  function doorSpot(v) {
    if (v.role === 'boat') {
      // a dock of The Sunk next to the boat (the story may take him out anywhere: then the nearest one), else the beach
      const d = SK && SK.dockNear(v.x, v.z, SK.inZone(v.x, v.z, 30) ? 400 : 6);
      if (d) return { x: d.x, z: d.z };
      // the slip or the pier of the docks (the story may take him out anywhere near the port: then the nearest)
      const k = DK && DK.dockNear(v.x, v.z, inHarbor(v) ? 600 : 9);
      if (k) return { x: k.x, z: k.z };
      return { x: clamp(v.x, B.minX + 1, B.maxX - 1), z: B.minZ + 0.6 };     // step onto the beach
    }
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const lx = fz, lz = -fx; // the car's left
    const side = v.info.halfWidth + 0.75;
    const tries = [[lx * side, lz * side], [-lx * side, -lz * side], [-fx * (v.info.length / 2 + 0.9), -fz * (v.info.length / 2 + 0.9)], [fx * (v.info.length / 2 + 0.9), fz * (v.info.length / 2 + 0.9)]];
    if (v.curbSide) tries.unshift(tries.splice(1, 1)[0]);   // (a courier van: out on the sidewalk side, not into the traffic)
    for (const [ox, oz] of tries) if (spotFree(v.x + ox, v.z + oz)) return { x: v.x + ox, z: v.z + oz };
    return { x: v.x + lx * side, z: v.z + lz * side };
  }

  // ------------------------------------------------------------ get in / out
  // Put the player into a vehicle at once, without the door animation (story scenes start like this).
  function enterNow(v, player) {
    active = v; state = 'driving'; stateTime = 0; exitWanted = false; v.doorOpen = 0; v.startT = 0;
    player.setHidden(true);
    player.place(v.x, v.z, v.heading);
    if (v.needDetail) v.needDetail();
    sound.setTone(v.type.tone);
  }
  // ... and take the player out again at once (x, z: where to stand; left out = next to the door)
  function leaveNow(player, x = null, z = null, heading = null, y = undefined) {
    const v = active;
    if (!v) return;
    v.vx = v.vz = 0; v.forward = 0; v.siren = false; v.doorOpen = 0;
    const s = x === null ? doorSpot(v) : { x, z };
    active = null; state = 'none'; exitWanted = false;
    player.place(s.x, s.z, heading === null ? v.heading : heading, y);
    player.setHidden(false);
    sound.quiet();
  }
  function tryEnter(player) {
    if (state !== 'none') return false;
    const near = nearest(player.position.x, player.position.z);
    if (!near) return false;
    active = near.live || takeParked(near.parked);
    state = 'entering'; stateTime = 0;
    active.vx = active.vz = 0;
    if (active.needDetail) active.needDetail();
    sound.setTone(active.type.tone);
    sound.doorClick('open');
    return true;
  }
  function requestExit() {
    if (state !== 'driving') return;
    const v = active;
    if (v.lockExit) { if (typeof v.lockExit === 'string') message = v.lockExit; return; }
    if (v.role === 'boat' && inHarbor(v) && !DK.dockNear(v.x, v.z, 9)) { message = 'STEER THE BOAT TO THE SLIP OR THE PIER TO GET OUT'; return; }
    if (v.role === 'boat' && v.z < SHORE - 9 && !(SK && SK.dockNear(v.x, v.z, 6)) && !(DK && DK.dockNear(v.x, v.z, 9))) { message = SK && SK.inZone(v.x, v.z, 20) ? 'STEER THE BOAT TO A DOCK TO GET OUT' : 'BRING THE BOAT BACK TO THE BEACH TO GET OUT'; return; }
    if (v.role === 'boat' && SK && SK.inZone(v.x, v.z) && !SK.dockNear(v.x, v.z, 6)) { message = 'STEER THE BOAT TO A DOCK TO GET OUT'; return; }
    if (v.role === 'drone' && v.alt > 1.5) { message = 'LAND THE DRONE FIRST (DOWN BUTTON)'; return; }
    exitWanted = true;
  }

  // -------------------------------------------------------------- collisions
  // Push the vehicle out of walls, props and other cars. Returns what it hit:
  //   { impact (m/s into the obstacle), lever (how much the hit wants to spin the car) }
  const hitOut = { impact: 0, lever: 0 };
  const NO_CELL = { boxes: [], circles: [] };
  let cur = null;           // the vehicle whose physics step is running (the world functions below look at it)
  // ways into an arena: [{ arena, test(v) -> true when the car is in the gate }] (src/race adds the highway ramp)
  const arenaGates = [];
  function collide(v) {
    // (an arena with a way in: a car that drives into its gate joins it - a race up the ramp onto the highway)
    if (!v.arena && arenaGates.length) for (const g of arenaGates) if (g.test(v)) { v.arena = g.arena; break; }
    let impact = 0, lever = 0;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), R = v.radius;
    for (let pass = 0; pass < 2; pass++) {
      for (const off of v.circles) {
        const cx = v.x + fx * off, cz = v.z + fz * off;
        const cell = v.arena ? NO_CELL : city.colliders.near(cx, cz);
        let px = 0, pz = 0;
        for (const b of cell.boxes) {
          if (b.h < 0.3) continue;
          const qx = clamp(cx, b.minX, b.maxX), qz = clamp(cz, b.minZ, b.maxZ);
          const dx = cx - qx, dz = cz - qz, d2 = dx * dx + dz * dz;
          if (d2 >= R * R) continue;
          if (d2 > 1e-8) { const d = Math.sqrt(d2); px += (dx / d) * (R - d); pz += (dz / d) * (R - d); }
          else {
            // the middle of the circle is inside the box: leave through the nearest side (never stay stuck in a wall)
            const l = cx - b.minX, r = b.maxX - cx, n = cz - b.minZ, f = b.maxZ - cz, m = Math.min(l, r, n, f);
            if (m === l) px -= l + R; else if (m === r) px += r + R; else if (m === n) pz -= n + R; else pz += f + R;
          }
        }
        const hitCircle = (c) => {
          // (cars are not here: the traffic and the real vehicles are pushed apart below, both of them)
          if (c.veh || c.car) return;
          const dx = cx + px - c.x, dz = cz + pz - c.z, min = R + c.r, d2 = dx * dx + dz * dz;
          if (d2 >= min * min) return;
          const d = Math.sqrt(d2) || 0.001;
          px += (dx / d) * (min - d); pz += (dz / d) * (min - d);
        };
        for (const c of cell.circles) hitCircle(c);
        for (const c of city.colliders.dynamic || []) hitCircle(c);
        const len = Math.hypot(px, pz);
        if (len < 1e-5) continue;
        v.x += px; v.z += pz;
        const nx = px / len, nz = pz / len;
        const vn = v.vx * nx + v.vz * nz;
        if (vn < 0) {
          // take away the speed that goes INTO the obstacle, give a little back (bounce)
          v.vx -= 1.22 * vn * nx; v.vz -= 1.22 * vn * nz;
          if (-vn > impact) { impact = -vn; v.hitX = cx - nx * R; v.hitZ = cz - nz * R; }
          lever += off * (nx * fz - nz * fx) * 0.5;
        }
      }
    }
    // other cars: the traffic, and the real vehicles (police, story cars, race cars, cars at the curb)
    const carHit = v.ghost ? 0 : Math.max(hitTraffic(v), hitCars(v));
    if (v.arena) {
      // an arena has its own side walls (the crash walls of the raised highway) and its own way out
      const A = v.arena, r0 = v.radius;
      if (v.x < A.minX + r0) { v.x = A.minX + r0; if (v.vx < 0) { impact = Math.max(impact, -v.vx * 0.7); v.vx *= -0.2; lever -= 0.25 * Math.sign(v.vz || 1); } }
      if (v.x > A.maxX - r0) { v.x = A.maxX - r0; if (v.vx > 0) { impact = Math.max(impact, v.vx * 0.7); v.vx *= -0.2; lever += 0.25 * Math.sign(v.vz || 1); } }
      if (v.z > A.maxZ - 2) { v.z = A.maxZ - 2; if (v.vz > 0) v.vz *= -0.2; }
      // out of the arena (the foot of the ramp): the normal city rules again (not while the car is still in the
      // arena's way in, heading into it: entry)
      if (v.z < A.minZ && !(A.entry && A.entry(v))) v.arena = null;
      if (impact < 0.05 && carHit < 0.05) return null;
      hitOut.impact = impact; hitOut.lever = lever; hitOut.car = carHit;
      return hitOut;
    }
    // the edge of the map is a soft wall
    if (v.x < B.minX + 1) { v.x = B.minX + 1; if (v.vx < 0) { impact = Math.max(impact, -v.vx); v.vx *= -0.25; } }
    if (v.x > B.maxX - 1) { v.x = B.maxX - 1; if (v.vx > 0) { impact = Math.max(impact, v.vx); v.vx *= -0.25; } }
    if (v.z < B.minZ + 1) { v.z = B.minZ + 1; if (v.vz < 0) { impact = Math.max(impact, -v.vz); v.vz *= -0.25; } }
    if (v.z > B.maxZ - 1) { v.z = B.maxZ - 1; if (v.vz > 0) { impact = Math.max(impact, v.vz); v.vz *= -0.25; } }
    if (impact < 0.05 && carHit < 0.05) return null;
    hitOut.impact = impact; hitOut.lever = lever; hitOut.car = carHit;
    return hitOut;
  }

  // ---- CAR AGAINST CAR ----
  // Two cars that touch are pushed apart and both feel the hit, by their weight: a light car moves more, a heavy one
  // less (the momentum is shared; crumpled metal gives little of the speed back). The hit can turn a car (hit at a
  // corner it spins), and hard hits damage both. A car the story moves exactly ("kin": Zero arriving, Dante's car)
  // does not give way to anything; a "ghost" (Zero's strike, the ram of the prologue) touches nothing, as before.
  // Returns the strongest closing speed (m/s) of this car's hits, for the sounds and the shaking.
  const CAR_BOUNCE = 0.18;           // the part of the closing speed that comes back as a bounce
  const TRAFFIC_K = [-1.45, 0, 1.45]; // the circles of a traffic car along its length (radius 1.0, see traffic.js)
  let rammed = 0;                    // the hardest hit the player's car got from ANOTHER car in this frame
  const driving = (q) => q === active && state === 'driving';
  // 1 / mass: 0 = it does not give way (the story moves it, or a race holds it on the grid)
  const invMass = (q) => ((q.kin && q !== active) || q.frozen ? 0 : 1 / Math.max(150, q.type.mass || 1500));
  // how hard it is to turn the car (a box of its length and width)
  const invTurn = (q) => 12 / (Math.max(150, q.type.mass || 1500) * ((q.info.length || 4.5) ** 2 + (2 * q.radius) ** 2));
  // the touch between the circles of car v and a set of circles: fills TOUCH. pen = the deepest overlap, (nx, nz) =
  // the way out (from the other car to v), (hx, hz) = where they touch: the middle of all the touching places,
  // weighted by how deep they are (two cars side by side touch along the whole side: no false spin from one corner)
  const TOUCH = { pen: 0, nx: 0, nz: 0, hx: 0, hz: 0 };
  function deepest(v, ox, oz, ofx, ofz, oCircles, oR) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), min = v.radius + oR;
    let pen = 0, w = 0, sx = 0, sz = 0, nx = 0, nz = 0;
    for (const a of v.circles) {
      const ax = v.x + fx * a, az = v.z + fz * a;
      for (const b of oCircles) {
        const bx = ox + ofx * b, bz = oz + ofz * b, ex = ax - bx, ez = az - bz, d2 = ex * ex + ez * ez;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2), p = min - d;
        let ux, uz;
        if (d > 1e-4) { ux = ex / d; uz = ez / d; } else { const l = Math.hypot(v.x - ox, v.z - oz); ux = l > 1e-4 ? (v.x - ox) / l : 1; uz = l > 1e-4 ? (v.z - oz) / l : 0; }
        if (p > pen) pen = p;
        w += p; nx += ux * p; nz += uz * p;
        sx += (bx + ux * oR) * p; sz += (bz + uz * oR) * p;
      }
    }
    TOUCH.pen = pen;
    if (pen <= 0) return 0;
    const nl = Math.hypot(nx, nz);
    if (nl > 1e-6) { TOUCH.nx = nx / nl; TOUCH.nz = nz / nl; } else { TOUCH.nx = 1; TOUCH.nz = 0; }
    TOUCH.hx = sx / w; TOUCH.hz = sz / w;
    return pen;
  }
  // a hit makes a car turn: the push at the touching point, away from the middle of the car (j: the push, kg*m/s).
  // (only part of it: the tires on the road hold the car against turning)
  function spinBy(q, hx, hz, jx, jz) {
    if (q.yawSpin === undefined) return;
    const rx = hx - q.x, rz = hz - q.z;
    q.yawSpin = clamp(q.yawSpin + clamp((rz * jx - rx * jz) * invTurn(q) * 0.4, -2, 2), -4.5, 4.5);
  }
  // damage from a hit: closing speed s (m/s), the car's share of the hit 0..1 (a light car takes more)
  function hurt(q, s, share) {
    if (!q.isCar || s < 3.2) return;
    const e = (s * share) / Math.sqrt(q.type.armor || 1);
    q.damage = clamp(q.damage + (e * e) / 1150, 0, 1);
    if (q !== active) showDamage(q);
  }
  // the player's car rammed by another car: it shakes, makes the sound, shows the sparks where it was hit
  function onRammed(q, s, hx, hz) {
    if (!driving(q)) return;
    if (s > rammed) { rammed = s; q.hitX = hx; q.hitZ = hz; }
  }
  // sparks and bits where two cars hit hard; a crash between two OTHER cars is also heard (softer further away)
  let otherCrashCool = 0;
  function crashFx(hx, hy, hz, s, mine) {
    if (s < 4 || !effects) return;
    const d = curPlayer ? Math.hypot(hx - curPlayer.position.x, hz - curPlayer.position.z) : 0;
    if (d > 90) return;
    const n = Math.min(10, 3 + Math.floor(s * 0.4));
    for (let i = 0; i < n; i++) effects.emit('spark', hx, hy + 0.45, hz, (Math.random() - 0.5) * 5, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 5);
    if (s > 7) for (let i = 0; i < 4; i++) effects.emit('debris', hx, hy + 0.5, hz, (Math.random() - 0.5) * 4, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 4);
    // (the player's own crashes have their sound in feedback())
    if (!mine && d < 55 && otherCrashCool <= 0) { otherCrashCool = 0.35; sound.crash('heavy', Math.min(1, s / 16) * (1 - d / 55)); }
  }
  // who is to blame (the police counts it): the player's car drove INTO the other one
  function playerFault(p, o, nx, nz) {
    // (n points from o to p: p's speed toward o, and o's speed toward p)
    const pIn = -(p.vx * nx + p.vz * nz), oIn = o ? o.vx * nx + o.vz * nz : 0;
    return pIn > 2.5 && pIn > oIn;
  }

  // the real vehicles against each other
  function hitCars(v) {
    let worst = 0;
    const wv = invMass(v);
    for (const q of live) {
      if (q === v || q.away || q.ghost || !q.circles || q.role === 'boat' || q.role === 'drone') continue;
      const ex = v.x - q.x, ez = v.z - q.z;
      if (ex > 9 || ex < -9 || ez > 9 || ez < -9 || Math.abs(v.y - q.y) > 1.8) continue;   // (far apart, or one is up on the raised highway)
      if (deepest(v, q.x, q.z, Math.sin(q.heading), Math.cos(q.heading), q.circles, q.radius) <= 0) continue;
      const { pen, nx, nz, hx, hz } = TOUCH;
      const wq = invMass(q), ws = wv + wq;
      if (ws <= 0) continue;                                 // (nothing can move: two story cars, leave them)
      // apart: each by its share (the heavy one moves less)
      v.x += nx * pen * (wv / ws); v.z += nz * pen * (wv / ws);
      q.x -= nx * pen * (wq / ws); q.z -= nz * pen * (wq / ws);
      const vn = (v.vx - q.vx) * nx + (v.vz - q.vz) * nz;   // < 0: they come together
      if (vn >= 0) continue;
      const s = -vn;
      // blame first (before the speeds change): did the player drive into it?
      const vFault = driving(v) && s > 3 && playerFault(v, q, nx, nz);
      const qFault = driving(q) && s > 3 && playerFault(q, v, -nx, -nz);
      // the push: both cars change speed along the line between them, by their weight
      const j = ((1 + CAR_BOUNCE) * s) / ws;
      v.vx += nx * j * wv; v.vz += nz * j * wv;
      q.vx -= nx * j * wq; q.vz -= nz * j * wq;
      // (a computer driver keeps its speed in "forward": it loses what the hit took)
      if (v.ai && v !== active) v.forward = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
      if (q.ai && q !== active) q.forward = q.vx * Math.sin(q.heading) + q.vz * Math.cos(q.heading);
      // turning: pushed at a corner, a car spins (only the light share for a heavy car)
      if (wv > 0) spinBy(v, hx, hz, nx * j, nz * j);
      if (wq > 0) spinBy(q, hx, hz, -nx * j, -nz * j);
      // damage: by how much each car's own speed changed (a light car takes the bigger share; hitting a car
      // that gives way is softer than a wall)
      hurt(v, s, wv / ws);
      hurt(q, s, wq / ws);
      if (s > 3) crashFx(hx, Math.max(v.y, q.y), hz, s, driving(v) || driving(q));
      // (how hard each one feels it: the shaking and the sound)
      const feltV = s * Math.min(1, (1.5 * wv) / ws), feltQ = s * Math.min(1, (1.5 * wq) / ws);
      onRammed(q, feltQ, hx, hz);
      // the police counts a hit the player made (hitting a police car is worse)
      const other = vFault ? q : qFault ? v : null;
      if (other) events.push({ type: other.ai || other.npc ? 'hitCar' : 'hitParked', strength: s, police: other.type.role === 'police' });
      if (feltV > worst) worst = feltV;
      // (the parked car that was hit is moved by the physics from now on: it rolls and stops by itself)
    }
    return worst;
  }

  // the traffic (src/ai/traffic.js): its cars run on their lanes, so they can only give way ALONG the lane (the hit
  // speeds them up or slows them down); pushed from the side they slide a little off the lane and steer back. The
  // driver stops for a moment and honks.
  function hitTraffic(v) {
    const TR = city.traffic;
    if (!TR || v.y > 2.5) return 0;                          // (up on the raised highway: the traffic is below)
    let worst = 0;
    const wv = invMass(v);
    for (const t of TR.cars) {
      if (!t.alive) continue;
      const ex = v.x - t.wx, ez = v.z - t.wz;
      if (ex > 9 || ex < -9 || ez > 9 || ez < -9) continue;
      const ts = Math.sin(t.heading), tc = Math.cos(t.heading);
      if (deepest(v, t.wx, t.wz, ts, tc, TRAFFIC_K, 1.0) <= 0) continue;
      const { pen, nx, nz, hx, hz } = TOUCH;
      if (wv <= 0) continue;
      v.x += nx * pen; v.z += nz * pen;                      // (the lane holds the traffic car: the real car moves)
      // closing speed (the traffic car drives along its lane at t.v)
      const vn = (v.vx - ts * t.v) * nx + (v.vz - tc * t.v) * nz;
      if (vn >= 0) continue;
      const s = -vn;
      const fault = driving(v) && s > 3 && -(v.vx * nx + v.vz * nz) > 2.5;
      const along = nx * ts + nz * tc;                       // how much of the push goes along the traffic car's lane
      const wt = (along * along) / 1500;                     // (a traffic car weighs about 1500 kg)
      const j = ((1 + CAR_BOUNCE) * s) / (wv + wt);
      v.vx += nx * j * wv; v.vz += nz * j * wv;
      if (v.ai && v !== active) v.forward = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
      spinBy(v, hx, hz, nx * j, nz * j);
      hurt(v, s, wv / (wv + wt));
      // the traffic car: faster or slower along its lane (never backwards), slid to the side, stops and honks
      t.v = clamp(t.v - (j * along) / 1500, 0, 30);
      const sideV = -(j * (-nx * tc + nz * ts)) / 1500;    // (the push to the traffic car's right side, m/s)
      t.side = clamp(t.side + clamp(sideV * 0.1, -0.7, 0.7), -2, 2);
      t.bumped = Math.max(t.bumped || 0, s);
      if (s > 3) crashFx(hx, v.y, hz, s, driving(v));
      if (fault) events.push({ type: 'hitCar', strength: s, police: false });
      const felt = s * Math.min(1, (1.5 * wv) / (wv + wt));
      if (felt > worst) worst = felt;
    }
    return worst;
  }
  // A BOAT in the canals: walls, pontoons and other boats push it back gently (it bumps, it does not crash).
  // Returns how hard it hit (m/s into the wall).
  function collideBoat(v) {
    let impact = 0;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading), R = Math.min(v.radius, 1.45);
    for (const off of v.circles) {
      const cx = v.x + fx * off, cz = v.z + fz * off;
      let px = 0, pz = 0;
      for (const b of city.colliders.near(cx, cz).boxes) {
        if (b.h < 0.3 && !b.boatOnly) continue;
        const qx = clamp(cx, b.minX, b.maxX), qz = clamp(cz, b.minZ, b.maxZ);
        const dx = cx - qx, dz = cz - qz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); px += (dx / d) * (R - d); pz += (dz / d) * (R - d); }
        else { const l = cx - b.minX, r = b.maxX - cx, n = cz - b.minZ, f = b.maxZ - cz, m = Math.min(l, r, n, f); if (m === l) px -= l + R; else if (m === r) px += r + R; else if (m === n) pz -= n + R; else pz += f + R; }
      }
      // other boats (the Guard, the boats of the story)
      for (const q of live) {
        if (q === v || q.role !== 'boat' || q.away) continue;
        if (Math.abs(q.x - v.x) > 14 || Math.abs(q.z - v.z) > 14) continue;
        const qfx = Math.sin(q.heading), qfz = Math.cos(q.heading), qR = Math.min(q.radius, 1.45);
        for (const qo of q.circles) {
          const dx = cx + px - (q.x + qfx * qo), dz = cz + pz - (q.z + qfz * qo), min = R + qR, d2 = dx * dx + dz * dz;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 0.01, push = (min - d) * 0.5;
          px += (dx / d) * push; pz += (dz / d) * push;
          q.x -= (dx / d) * push; q.z -= (dz / d) * push;
          // the hit pushes the other boat a little
          const vn = (v.vx - q.vx) * (dx / d) + (v.vz - q.vz) * (dz / d);
          // (RAM, Chapter 5: a boat that rams pushes much harder - a bump that throws the other one off its line)
          const ramming = v.ramT > 0;
          if (vn < 0) {
            const k = ramming ? 1.35 : 0.45;
            q.vx += (dx / d) * vn * k; q.vz += (dz / d) * vn * k;
            if (ramming) { q.stunT = 1.6; v.ramT = 0; }
            if (-vn > 2 || ramming) events.push({ type: 'hitBoat', strength: -vn, police: !!q.guard, ram: ramming });
          }
        }
      }
      const len = Math.hypot(px, pz);
      if (len < 1e-5) continue;
      v.x += px; v.z += pz;
      const nx = px / len, nz = pz / len, vn = v.vx * nx + v.vz * nz;
      if (vn < 0) {
        // a soft bump: most of the speed into the wall is lost, a little comes back; it slides along
        v.vx -= 1.25 * vn * nx; v.vz -= 1.25 * vn * nz;
        v.vx *= 0.97; v.vz *= 0.97;
        if (-vn > impact) { impact = -vn; v.hitX = cx - nx * R; v.hitZ = cz - nz * R; }
      }
    }
    return impact;
  }
  // the drone only hits buildings it is lower than
  function collideAir(v) {
    const cell = city.colliders.near(v.x, v.z);
    for (const b of cell.boxes) {
      if (v.y > b.h + 0.3) continue;
      const qx = clamp(v.x, b.minX, b.maxX), qz = clamp(v.z, b.minZ, b.maxZ), dx = v.x - qx, dz = v.z - qz, d2 = dx * dx + dz * dz;
      if (d2 >= v.radius * v.radius) continue;
      const d = Math.sqrt(d2) || 0.001;
      if (d2 > 1e-6) { v.x += (dx / d) * (v.radius - d); v.z += (dz / d) * (v.radius - d); } else { v.x -= Math.sin(v.heading) * 1.2; v.z -= Math.cos(v.heading) * 1.2; }
      return Math.abs(v.forward) + 0.5;
    }
    return 0;
  }

  // ------------------------------------------------------------ the ground under a car
  const SURF = {
    road: { name: 'road', grip: 1, drag: 0, rough: 0 },
    wet: { name: 'wet', grip: 1, drag: 0.05, rough: 0 },                 // (the rain itself lowers the grip in physics.js)
    walk: { name: 'walk', grip: 0.92, drag: 0.2, rough: 0.2 },           // sidewalks: slabs and joints
    sand: { name: 'sand', grip: 0.45, drag: 2.2, rough: 0.5 },           // the beach: soft, slow, slippery
  };
  const world = {
    surface(x, z) {
      if (cur && cur.arena) return weather && weather.amount > 0.3 ? SURF.wet : SURF.road;
      if (z < L.neon.promenadeMinZ) return SURF.sand;
      if (city.groundHeight(x, z) > 0.05) return SURF.walk;
      return weather && weather.amount > 0.3 ? SURF.wet : SURF.road;
    },
    ground: (x, z) => (cur && cur.arena ? cur.arena.ground(x, z) : city.groundHeight(x, z)),
    collide, collideAir,
    get wet() { return weather ? clamp(weather.amount, 0, 1) : 0; },
    get assist() { return settings ? settings.assist : 'normal'; },
    maxHeight: 150, bounds: B,
  };

  // ------------------------------------------------------------ new paint (the story: Mace's paint shop)
  // color: [r, g, b] (linear, like the color given to spawn). Cars made in code keep the paint in their own body
  // colors: the "bare" colors are worked out once from the first paint, then any new paint is laid over them.
  function repaint(v, color) {
    if (!v || !v.paintMeshes) return;
    const first = v.color;
    v.color = color.slice();
    for (const m of v.paintMeshes) {
      // (how much paint each point carries: "aPaint" on a body that was cut into doors, else the third data number)
      const g = m.geometry, c = g.attributes.color, kp = g.attributes.aPaint, dd = g.attributes.aData;
      if (!c || (!kp && !dd) || m.isInstancedMesh || m.material.userData.paintSet) continue;
      const d = kp ? { getZ: (i) => kp.getX(i) } : dd;
      if (!g.userData.bare) {
        // (once: the colors without paint. A body shared by several cars is copied first.)
        const bare = new Float32Array(c.array.length);
        for (let i = 0; i < c.count; i++) {
          const k = d.getZ(i);
          for (let j = 0; j < 3; j++) { const f = 1 + (first[j] - 1) * k; bare[i * 3 + j] = f > 1e-4 ? c.array[i * c.itemSize + j] / f : 1; }
        }
        g.userData.bare = bare;
      }
      const bare = g.userData.bare;
      for (let i = 0; i < c.count; i++) {
        const k = d.getZ(i);
        for (let j = 0; j < 3; j++) c.array[i * c.itemSize + j] = bare[i * 3 + j] * (1 + (color[j] - 1) * k);
      }
      c.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ damage you can see
  function showDamage(v) {
    const level = v.damage > 0.75 ? 3 : v.damage > 0.5 ? 2 : v.damage > 0.22 ? 1 : 0;
    if (level === v.level || !v.isCar) return;
    const was = v.level;
    v.level = level;
    for (const m of v.paintMeshes || []) {
      const set = m.material.userData.paintSet;
      if (set) m.material = set[level];                       // model cars: a darker, duller paint
      else if (m.geometry.attributes.color && !m.isInstancedMesh) {
        // cars made in code: darken the colors stored in this car's own body
        const c = m.geometry.attributes.color, k = (1 - level * 0.17) / (1 - was * 0.17);
        for (let i = 0; i < c.array.length; i++) c.array[i] *= k;
        c.needsUpdate = true;
      }
    }
    // broken windows after a strong hit
    v.tilt.traverse((m) => { if (m.isMesh && (m.material === glassMat || m.material === crackedMat)) m.material = level >= 2 ? crackedMat : glassMat; });
  }
  function repair(v) { v.damage = 0; showDamage(v); }

  // ------------------------------------------------------------ show it: place, tilt, lights
  function place(v, night, time) {
    v.group.visible = !v.away;
    if (v.away) return;
    // (drawn at the smooth pose between the last two physics steps - see update: no stutter on 90/120 Hz screens)
    const X = v.rx ?? v.x, Y = v.ry ?? v.y, Z = v.rz ?? v.z, H = v.rh ?? v.heading;
    v.group.position.set(X, Y + (v.isCar ? v.heave : 0) + (v.lift || 0), Z);     // (lift: in the air over a jump)
    v.group.rotation.y = H;
    // engine start: a short shake
    const shakeStart = v.startT > 0 ? Math.sin(v.startT * 70) * 0.006 * Math.min(1, v.startT * 3) : 0;
    if (v.info.bike) {
      // a bike leans INTO the corner (a car's body rolls out of it): by atan(sideways force / g).
      // Nobody on it and standing still: it leans on its kickstand.
      const ridden = v === active && state !== 'none';
      const parked = !ridden && Math.abs(v.forward || 0) < 0.5 && !v.npc;
      const want = v.dead ? 0 : parked ? BIKE_PARK_LEAN : clamp(-Math.atan(((v.fx && v.fx.ay) || 0) / 9.81), -0.72, 0.72);
      v.lean += (want - v.lean) * (parked ? 0.06 : 0.16);
      if (v.kick) v.kick.visible = parked && Math.abs(v.lean - BIKE_PARK_LEAN) < 0.05;
      v.tilt.rotation.set(v.pitch * 0.4 + shakeStart, 0, v.lean);
    } else v.tilt.rotation.set(v.pitch + shakeStart, 0, v.roll + shakeStart);
    // (a bad number must never reach a wheel: it would vanish)
    if (!Number.isFinite(v.spin)) v.spin = 0;
    if (!Number.isFinite(v.steer)) v.steer = 0;
    for (const w of v.wheels) {
      if (w.front) w.steerNode.rotation.y = -v.steer * 0.8;
      w.mesh.rotation.x = (v.spin % (Math.PI * 2)) * w.spin;
    }
    if (v.steerWheel) v.steerWheel.rotation.z = v.steer * 2.6;
    // the driver's door swings open around its front edge (the other door stays shut)
    if (v.doorL) v.doorL.rotation.y = -v.doorOpen * 1.15;
    const driven = v === active && state !== 'none';
    if (v.driver) v.driver.visible = !riggedDriver && v === active && camMode !== 'cockpit' && (state === 'driving' || (state === 'entering' && stateTime > 0.38) || (state === 'exiting' && stateTime < 0.3));
    if (!v.isCar) {
      // boat and drone: two small position lights at night
      if ((driven || v.npc) && night > 0.05 && v.lights !== 'off') { effects.lamp(X + Math.sin(H) * v.info.frontZ, Y + v.info.roof * 0.6, Z + Math.cos(H) * v.info.frontZ, 1.4, 1.4, 1.2, 0.5); effects.lamp(X - Math.sin(H) * v.info.frontZ, Y + v.info.roof * 0.6, Z - Math.cos(H) * v.info.frontZ, 1.6, 0.1, 0.08, 0.4); }
      // a Guard boat: red and blue lights that flash in turn on the cabin roof
      if (v.siren && v.role === 'boat') {
        const lx = Math.cos(H), lz = -Math.sin(H), y = Y + v.info.roof + 0.1, phase = Math.floor(time * 7) % 4;
        if (phase < 2) effects.lamp(X + lx * 0.5, y, Z + lz * 0.5, 3.4, 0.15, 0.1, 0.85); else effects.lamp(X - lx * 0.5, y, Z - lz * 0.5, 0.15, 0.3, 3.4, 0.85);
        const pp = curPlayer ? curPlayer.position : v;
        if (!flasher.on || Math.hypot(flasher.x - pp.x, flasher.z - pp.z) > Math.hypot(X - pp.x, Z - pp.z)) { flasher.on = true; flasher.x = X; flasher.y = y + 0.6; flasher.z = Z; flasher.red = phase < 2; }
      }
      return;
    }
    // ---- lamps: light dots at the ends of the car's box (see effects.js) ----
    const on = (driven || v.npc) && v.lights !== 'off';
    const lampOn = on ? (v.lights === 'bar' ? 1 : night) : 0;
    const blinkOn = v.blink !== 0 && (time * 2.6) % 1 < 0.5;
    if (on && v.lights === 'bar') {
      // the Phantom: one thin, cold bar of light across the nose and a red one across the tail (day and night)
      const fx = Math.sin(H), fz = Math.cos(H), lx = fz, lz = -fx, hw = v.info.halfWidth * 0.62, y = Y + v.heave + v.info.noseY;
      for (let i = -6; i <= 6; i++) {
        effects.lamp(X + fx * (v.info.frontZ + 0.05) + lx * hw * (i / 6), y, Z + fz * (v.info.frontZ + 0.05) + lz * hw * (i / 6), 0.8, 1.1, 1.5, 0.13);
        if (i % 2 === 0) effects.lamp(X + fx * (v.info.backZ - 0.05) + lx * hw * (i / 6), y * 1.0 + 0.12, Z + fz * (v.info.backZ - 0.05) + lz * hw * (i / 6), v.braking ? 2.4 : 1.0, 0.05, 0.04, 0.14);
      }
    } else if (on) {
      effects.carLamps(X, Y + v.heave, Z, H, v.info.lampW || v.info.halfWidth, v.info.frontZ, v.info.backZ, v.info.noseY, {
        head: lampOn > 0.05 ? (v.hiBeam ? 2 : 1) : 0, tail: lampOn, brake: v.braking && !v.reverse, reverse: v.reverse && Math.abs(v.forward) > 0.2, blink: v.blink, blinkOn,
      });
    }
    if (v.beam) {
      v.beam.visible = lampOn > 0.02 && (driven || !!v.beamOn);     // (beamOn: a computer car with its light on the road - Zero facing Nate)
      v.beamMat.opacity = lampOn * (v.hiBeam ? 1.25 : 0.9);
      v.beam.scale.set(v.hiBeam ? 1.25 : 1, 1, v.hiBeam ? 1.6 : 1);
      v.beam.position.z = v.info.frontZ + (v.hiBeam ? 14.5 : 9.3);
    }
    // ---- police: red and blue lights that flash in turn ----
    if (v.siren) {
      const fx = Math.sin(H), fz = Math.cos(H), lx = fz, lz = -fx;
      const phase = Math.floor(time * 7) % 4;
      const y = Y + v.info.roof + 0.08, s = v.info.halfWidth * 0.38;
      const k = 3.4;
      if (phase < 2) effects.lamp(X + lx * s, y, Z + lz * s, k, 0.15, 0.1, 0.75); else effects.lamp(X - lx * s, y, Z - lz * s, 0.15, 0.3, k, 0.75);
      flasher.on = true; flasher.x = X; flasher.y = y + 0.6; flasher.z = Z; flasher.red = phase < 2;
    }
  }

  // ------------------------------------------------------------ smoke, marks, sounds of the driven car
  let impactCool = 0, bumpCool = 0, squealOn = false, wasBlink = false;
  function feedback(v, input, dt, time, night) {
    const fx = v.fx, sx = Math.sin(v.heading), sz = Math.cos(v.heading), lx = sz, lz = -sx;
    const speed = Math.hypot(v.vx, v.vz);
    const top = v.type.topSpeed / KMH;
    impactCool -= dt; bumpCool -= dt;
    if (v.role === 'boat') {
      // (the QUIET motor: a low murmur)
      sound.setEngine(true, clamp(0.15 + Math.abs(v.forward) / top * 0.6 + fx.throttle * 0.25, 0, 1) * (v.quiet ? 0.6 : 1), fx.throttle * (v.quiet ? 0.3 : 1), v.quiet ? 0.32 : 1);
      sound.setWind(speed / 40); sound.setRoad(fx.wake * 0.8, 'wet');
      // wake: foam at the stern and two white trails on the water. (In the canals of The Sunk the water itself
      // draws the V of the wake and the churned water: no trails there, and less spray between the walls.)
      const canal = !!(SK && SK.inZone(v.x, v.z));
      if (fx.wake > 0.08) {
        const bx = v.x - sx * v.info.frontZ * 0.9, bz = v.z - sz * v.info.frontZ * 0.9;
        if (Math.random() < fx.wake * (canal ? 0.4 : 0.9)) effects.emit('foam', bx + (Math.random() - 0.5) * 2, seaWorld.waterLevel + 0.2, bz + (Math.random() - 0.5) * 2, -v.vx * 0.2, (canal ? 0.6 : 1.2) + fx.wake * (canal ? 1 : 2), -v.vz * 0.2, canal ? 0.7 + fx.wake * 0.6 : 1 + fx.wake);
        const p = [[bx + lx * 1.5, bz + lz * 1.5], [bx - lx * 1.5, bz - lz * 1.5]];
        if (v.wheelPrev && !canal) for (let i = 0; i < 2; i++) effects.addStrip(v.wheelPrev[i][0], v.wheelPrev[i][1], p[i][0], p[i][1], seaWorld.waterLevel + 0.07, 0.35 + fx.wake * 0.5, [0.9, 0.95, 0.96], 0.34 * fx.wake, 4);
        v.wheelPrev = p;
      } else v.wheelPrev = null;
      if (fx.impact > 1 && impactCool < 0) { impactCool = 0.4; sound.thump(Math.min(1, fx.impact / 6)); if (fx.impact > 3) sound.crash('scrape', fx.impact / 10); shake = Math.min(1, shake + fx.impact * 0.03); haptic = 40; }
      // Chapter 5: RAM (the motor roars), QUICK TURN (a wall of spray), landing after a jump (a heavy splash)
      if (fx.ram) { sound.burst(160, 0.8, 0.22, 0.01, 0.5, 'lowpass'); shake = Math.min(1, shake + 0.2); haptic = 30; }
      if (fx.turned) { sound.burst(1400, 0.5, 0.1, 0.02, 0.5); for (let k = 0; k < 10; k++) effects.emit('foam', v.x + (Math.random() - 0.5) * 3, seaWorld.waterLevel + 0.3, v.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3, 1.3); }
      if (fx.landed > 2) { sound.splash(true); sound.thump(Math.min(1, fx.landed / 8)); shake = Math.min(1, shake + fx.landed * 0.05); haptic = 60; for (let k = 0; k < 16; k++) effects.emit('foam', v.x + (Math.random() - 0.5) * 4, seaWorld.waterLevel + 0.3, v.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 1.6); }
      return;
    }
    if (v.role === 'drone') {
      sound.setEngine(true, fx.throttle, fx.throttle * 0.6);
      sound.setWind(speed / 30);
      if (fx.impact > 0.5 && impactCool < 0) { impactCool = 0.4; sound.crash('scrape', 0.4); shake = Math.min(1, shake + 0.25); haptic = 50; }
      return;
    }
    // ---- sounds ----
    const rev = clamp((v.rpm - IDLE_RPM) / (RED_RPM - IDLE_RPM), 0, 1);
    sound.setEngine(!v.dead, 0.1 + rev * 0.9, fx.limited ? 0.3 : Math.max(fx.throttle, v.nitroOn ? 1 : 0));   // (at the limiter the engine sounds held back)
    const onRoad = fx.surface === 'road' || fx.surface === 'wet';
    sound.setScreech(onRoad ? fx.slip * (fx.surface === 'wet' ? 0.55 : 1) : 0);
    sound.setWind(speed / 55);
    sound.setRoad(clamp(speed / 30, 0, 1) * (onRoad ? 0.5 : 1), fx.surface);
    sound.setScrape(fx.scrape > 0 && speed > 2);
    const squeal = v.braking && input.brake > 0.3 && speed > 0.6 && speed < 4.5 && !v.reverse;
    if (squeal !== squealOn) { squealOn = squeal; sound.setSqueal(squeal); }
    if (fx.shifted) { sound.shiftClick(); if (v.type.turbo) sound.turbo(); effects.emit('exhaust', v.x + sx * (v.info.backZ - 0.1), v.y + 0.35, v.z + sz * (v.info.backZ - 0.1), -sx, 0.4, -sz); }
    // turbo cars whoosh when the driver lifts off after a hard pull
    if (v.type.turbo) { if (fx.throttle > 0.8 && rev > 0.5) v.turboArmed = true; else if (v.turboArmed && fx.throttle < 0.1) { v.turboArmed = false; sound.turbo(); } }
    if (fx.bump > 0.25 && bumpCool < 0) { bumpCool = 0.18; sound.thump(fx.bump); haptic = Math.max(haptic, 18); shake = Math.min(1, shake + fx.bump * 0.12); }
    if (fx.abs && bumpCool < 0) { bumpCool = 0.09; haptic = Math.max(haptic, 10); }
    if (fx.impact > 0.6 && impactCool < 0) {
      impactCool = 0.3;
      const hard = fx.impact >= 3.2;
      sound.crash(hard ? 'heavy' : 'scrape', fx.impact / (hard ? 16 : 5));
      shake = Math.min(1, shake + (hard ? fx.impact * 0.05 : 0.08));
      haptic = Math.max(haptic, hard ? Math.min(220, 40 + fx.impact * 9) : 25);
      if (hard) { for (let i = 0; i < 9; i++) effects.emit('debris', v.hitX, v.y + 0.5, v.hitZ, (Math.random() - 0.5) * 6 + v.vx * 0.3, 2 + Math.random() * 3, (Math.random() - 0.5) * 6 + v.vz * 0.3); events.push({ type: 'crash', strength: fx.impact }); }
    }
    // ---- indicators: they blink by themselves when you steer hard at low speed ----
    v.blink = Math.abs(input.steer) > 0.55 && speed < 16 && speed > 0.3 ? (input.steer < 0 ? -1 : 1) : v.damage > 0.9 ? 2 : 0;
    const blinkNow = v.blink !== 0 && (time * 2.6) % 1 < 0.5;
    if (blinkNow !== wasBlink) { wasBlink = blinkNow; if (v.blink) sound.tick(); }

    // ---- particles and skid marks at the rear wheels ----
    const wz = v.info.wheelZ[0], wx = v.info.wheelX;
    const p = [[v.x + sx * wz + lx * wx, v.z + sz * wz + lz * wx], [v.x + sx * wz - lx * wx, v.z + sz * wz - lz * wx]];
    const sliding = fx.slip > 0.22 && speed > 2.5;
    if (sliding || fx.spin > 0.2) {
      const kind = fx.surface === 'sand' ? 'dust' : fx.surface === 'wet' ? 'spray' : 'smoke';
      for (let i = 0; i < 2; i++) if (Math.random() < 0.35 + fx.slip * 0.5) effects.emit(kind, p[i][0], v.y + 0.15, p[i][1], v.vx * 0.15 + (Math.random() - 0.5), 0.6, v.vz * 0.15 + (Math.random() - 0.5), 0.8 + fx.slip);
      if (v.wheelPrev && fx.surface !== 'sand') for (let i = 0; i < 2; i++) effects.addStrip(v.wheelPrev[i][0], v.wheelPrev[i][1], p[i][0], p[i][1], v.y + 0.022, 0.24, [0.02, 0.02, 0.02], 0.3 + fx.slip * 0.4, 28);
    } else if (fx.surface === 'sand' && speed > 3) {
      if (Math.random() < 0.5) effects.emit('dust', p[0][0], v.y + 0.15, p[0][1], -v.vx * 0.1, 0.8, -v.vz * 0.1, 0.9);
      if (v.wheelPrev) for (let i = 0; i < 2; i++) effects.addStrip(v.wheelPrev[i][0], v.wheelPrev[i][1], p[i][0], p[i][1], v.y + 0.03, 0.26, [0.32, 0.27, 0.2], 0.4, 20);
    } else if (fx.surface === 'wet' && speed > 9 && Math.random() < 0.5) effects.emit('spray', p[Math.random() < 0.5 ? 0 : 1][0], v.y + 0.12, p[0][1], -v.vx * 0.08, 0.9 + speed * 0.03, -v.vz * 0.08, 0.6 + speed * 0.02);
    v.wheelPrev = p;
    // sparks where the body scrapes along a wall
    if (fx.scrape > 0 && speed > 4) for (let i = 0; i < 2; i++) effects.emit('spark', v.hitX, v.y + 0.4, v.hitZ, v.vx * 0.5 + (Math.random() - 0.5) * 4, 1 + Math.random() * 2.5, v.vz * 0.5 + (Math.random() - 0.5) * 4);
    // nitro: a blue flame at the back
    if (v.nitroOn) for (const s of [0.3, -0.3]) effects.emit('flame', v.x + sx * (v.info.backZ - 0.15) + lx * s, v.y + 0.38, v.z + sz * (v.info.backZ - 0.15) + lz * s, v.vx - sx * 5, 0, v.vz - sz * 5);
    // a badly damaged car smokes from the hood
    if (v.damage > 0.7 && time - v.lastSmoke > 0.12) { v.lastSmoke = time; effects.emit('hood', v.x + sx * v.info.frontZ * 0.6, v.y + v.info.noseY + 0.3, v.z + sz * v.info.frontZ * 0.6, v.vx * 0.3, 1.5, v.vz * 0.3); }
    showDamage(v);
  }

  // --------------------------------------------------------------- every frame
  const idle = { steer: 0, gas: 0, brake: 0, handbrake: true };
  const flasher = { on: false, x: 0, y: 0, z: 0, red: true };
  let acc = 0, camMode = 'chase', nitroWas = false, detailTimer = 0;
  let enterFilter = null;     // story: which vehicles the player may get into
  let riggedDriver = false;   // true: the real player character sits in the car (main.js puts it there), the simple driver stays hidden
  let forceDriver = null;     // film scenes: true = always show the driver's body, false = never (the camera is in their eyes), null = as usual
  let autoInput = null;       // the story drives the player's car for a moment (brakes it to a stop in a film scene): pedals and wheel, or null
  const AUTO_HOLD = { steer: 0, gas: 0, brake: 0, handbrake: true, nitro: false, up: false, down: false, horn: false };
  // input: what the player does, player: the player object, night: 0..1 (lamps on), time: seconds
  let curPlayer = null;
  function update(dt, input, player, night, time) {
    curPlayer = player;
    shake = Math.max(0, shake - dt * 2.6);
    flasher.on = false;
    const drive = input.drive;
    if (state === 'entering') {
      // door opens, the player steps in, door closes, the engine starts
      stateTime += dt;
      const v = active;
      v.doorOpen = stateTime < 0.3 ? stateTime / 0.3 : Math.max(0, 1 - (stateTime - 0.45) / 0.3);
      if (stateTime > 0.38) player.setHidden(true);
      else { const s = v.role === 'boat' ? { x: player.position.x, z: player.position.z } : doorSpot(v); player.glideTo(s.x, s.z, v.heading, dt); }
      if (stateTime > 0.75) {
        state = 'driving'; v.doorOpen = 0; exitWanted = false; v.startT = 0.7;
        if (v.isCar) { sound.doorClick('close'); sound.startEngine(); effects.emit('exhaust', v.x + Math.sin(v.heading) * v.info.backZ, v.y + 0.35, v.z + Math.cos(v.heading) * v.info.backZ, 0, 0.5, 0, 1.5); }
        if (v.type.role === 'police') message = 'POLICE CAR: HORN BUTTON = SIREN';
      }
    } else if (state === 'exiting') {
      stateTime += dt;
      const v = active;
      v.doorOpen = stateTime < 0.3 ? stateTime / 0.3 : Math.max(0, 1 - (stateTime - 0.5) / 0.3);
      if (stateTime > 0.3 && player.hidden) {
        const s = doorSpot(v);
        player.place(s.x, s.z, v.heading);
        player.setHidden(false);
      }
      if (stateTime > 0.8) { state = 'none'; v.doorOpen = 0; v.siren = false; active = null; if (v.isCar) sound.doorClick('close'); }
    }

    // ---- the physics, in fixed steps of 1/60 s ----
    rammed = 0; otherCrashCool -= dt;
    acc = Math.min(acc + dt, STEP * 5);
    let fxLast = null;
    // a frame can hold 0, 1 or more physics steps: remember the strongest hit and bump of all of them
    let pkImpact = 0, pkBump = 0, pkScrape = 0, pkShift = false;
    while (acc >= STEP) {
      acc -= STEP;
      for (const v of live) {
        if (v.away || v.frozen) continue;            // (frozen: a race holds it - the countdown, the replay)
        // (the pose before this step: the drawing goes smoothly from it to the pose after the step)
        v.p0x = v.x; v.p0y = v.y; v.p0z = v.z; v.p0h = v.heading;
        cur = v;
        if (v.startT > 0) v.startT -= STEP;
        if (v === active && state === 'driving') {
          let inp = autoInput || drive;
          // (the story brakes the car to a stop: once it stands, the brake must not turn into reverse - hold it)
          if (autoInput && autoInput.brake > 0 && v.forward < 0.8) inp = AUTO_HOLD;
          // the EXIT button first stops the vehicle, then the door opens
          if (exitWanted) inp = { steer: drive.steer, gas: v.forward < -0.5 ? 1 : 0, brake: v.forward > 0.5 ? 1 : 0, handbrake: Math.abs(v.forward) <= 4 || drive.handbrake, up: false, down: true };   // (rolling backwards: the gas pedal is the brake)
          if (v.role === 'boat') { v.quiet = !!drive.quiet && !exitWanted; fxLast = stepBoat(v, inp, STEP, seaWorld); }
          else if (v.role === 'drone') fxLast = stepDrone(v, inp, STEP, world);
          else { fxLast = stepCar(v, inp, STEP, world); v.spin += (v.forward * STEP) / v.info.wheelR; }
          pkImpact = Math.max(pkImpact, fxLast.impact || 0); pkBump = Math.max(pkBump, fxLast.bump || 0); pkScrape = Math.max(pkScrape, fxLast.scrape || 0); pkShift = pkShift || !!fxLast.shifted;
          if (exitWanted && Math.hypot(v.vx, v.vz) < 0.9 && (v.role !== 'drone' || v.alt < 0.3)) { v.vx = v.vz = 0; v.forward = 0; state = 'exiting'; stateTime = 0; exitWanted = false; sound.doorClick('open'); }
        } else if (v.ai) v.ai(v, STEP, world);
        else if (v.isCar && (Math.abs(v.vx) + Math.abs(v.vz) > 0.02 || v === active)) { stepCar(v, idle, STEP, world); v.spin += (v.forward * STEP) / v.info.wheelR; } // a car without a driver rolls to a stop
        else if (v.role === 'boat') stepBoat(v, idle, STEP, seaWorld);
        else if (v.role === 'drone' && v.alt > 0.01) stepDrone(v, { steer: 0, gas: 0, brake: 0, down: true }, STEP, world);
      }
    }

    cur = null;
    // ---- SMOOTH DRAWING: the physics moves in steps of 1/60 s, the screen may draw 45, 90 or 120 pictures a
    //      second. Each vehicle is drawn between its pose before and after the last step, by how much time is
    //      left over (acc): it glides instead of jumping 0, 1 or 2 steps from one picture to the next. A vehicle
    //      that was put somewhere (a jump of more than 6 m) is drawn there at once.
    {
      const k = acc / STEP;
      for (const q of live) {
        if (q.p0x === undefined || q.frozen || q.away || Math.abs(q.x - q.p0x) + Math.abs(q.z - q.p0z) > 6) { q.rx = q.x; q.ry = q.y; q.rz = q.z; q.rh = q.heading; q.p0x = q.x; q.p0y = q.y; q.p0z = q.z; q.p0h = q.heading; continue; }
        q.rx = q.p0x + (q.x - q.p0x) * k; q.ry = q.p0y + (q.y - q.p0y) * k; q.rz = q.p0z + (q.z - q.p0z) * k;
        q.rh = q.p0h + Math.atan2(Math.sin(q.heading - q.p0h), Math.cos(q.heading - q.p0h)) * k;
      }
    }
    const v = active;
    // (rammed by another car: it shakes and sounds like the player's own crash)
    if (rammed > pkImpact) pkImpact = rammed;
    if (v && v.fx) { v.fx.impact = pkImpact; if (v.isCar) { v.fx.bump = pkBump; v.fx.shifted = pkShift; if (fxLast) v.fx.scrape = pkScrape; } }
    cargo.update(dt);           // a crate or a trailer on a vehicle (Chapter 5): the trailer follows, hits break the load
    if (v && state === 'driving') {
      // police: the horn button switches the siren
      if (v.type.role === 'police') { if (drive.horn && !nitroWas) { v.siren = !v.siren; } nitroWas = drive.horn; sound.setSiren(v.siren); }
      else sound.setHorn(!!drive.horn);
      if (drive.nitro && v.nitroOn && !v.nitroSound) sound.nitro();
      v.nitroSound = v.nitroOn;
      feedback(v, drive, dt, time, night);
      // the player object travels with the vehicle (so the world knows where we are)
      player.place(v.x, v.z, v.heading);
      if (v.arena) player.position.y = v.y;        // (up on the raised highway)
    } else if (state !== 'driving') sound.quiet();
    for (const q of live) place(q, night, time);

    // ---- vehicles the player left behind: solid for the player and the traffic, and not too many ----
    const dyn = city.colliders.dynamic;
    const px = player.position.x, pz = player.position.z;
    let loose = 0;
    for (const q of live) if (q !== active && !q.keep && !q.npc) loose++;
    for (let i = live.length - 1; i >= 0; i--) {
      const q = live[i];
      if (q === active) continue;
      const d = Math.hypot(q.x - px, q.z - pz);
      if (!q.keep && !q.npc && (d > 320 || (loose > 2 && d > 90))) { removeVehicle(q); loose--; continue; }
      if (dyn && d < 45 && !q.away && q.role !== 'boat' && !(q.role === 'drone' && q.alt > 2.5)) {
        const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
        for (const off of q.circles) dyn.push({ x: q.x + fx * off, z: q.z + fz * off, r: q.radius, veh: q });
      }
    }
  }

  // ------------------------------------------------------------ making vehicles appear
  // a new vehicle at a fixed place. opts: { keep: never disappears, tag: shows its name, npc: driven by the computer }
  function spawn(kind, x, z, rot, color, opts = { keep: true }) {
    if (!CAR_TYPES[kind]) return null;
    const role = CAR_TYPES[kind].role;
    if (role === 'boat' && !(carLib && carLib.boat)) return null;
    const y = role === 'boat' ? seaWorld.waterLevel - 0.5 : opts.arena ? opts.arena.ground(x, z) : city.groundHeight(x, z);
    const v = makeVehicle(kind, x, y, z, rot, color || [1, 1, 1], opts);
    place(v, 0, 0);
    return v;
  }
  // THE GARAGE: one of each vehicle, parked along the curb next to the start point.
  function buildGarage() {
    const gx = L.spawn.x + 3.1, z0 = L.spawn.z + 20, rot = 0;            // at the east curb, noses to the north
    clearParked((rec) => Math.abs(rec.x - gx) < 3 && rec.z > z0 - 62 && rec.z < z0 + 8);
    const paint = { sedan: [0.3, 0.31, 0.33], coupe: [0.08, 0.13, 0.26] };
    const list = ['street_bike', 'small_city_car', 'tech_patrol_car', 'police_coupe', 'chrome_supercar', 'armored_van'].filter((k) => CAR_TYPES[k]);
    let z = z0;
    const made = [];
    for (const kind of list) {
      const len = carInfo(kind).length;
      z -= len / 2 + 1.4;
      made.push(spawn(kind, gx, z, rot, kind === 'street_bike' ? [0.45, 0.025, 0.02] : [1, 1, 1], { keep: true, tag: true }));
      z -= len / 2 + 1.4;
    }
    // the drone waits on the sidewalk, the boat at the coast
    made.push(spawn('drone', L.spawn.x - 1.2, L.spawn.z + 3.5, 0, null, { keep: true, tag: true }));
    const boat = spawn('patrol_boat', -30, SHORE - 2.5, Math.PI, null, { keep: true, tag: true });
    if (boat) made.push(boat);
    return { vehicles: made.filter(Boolean), repair: { x: gx + 3.4, z: z0 - 12 }, paint };
  }
  // the test menu: put any vehicle in front of the player
  function spawnInFront(kind, px, pz, yaw) {
    if (!CAR_TYPES[kind]) return null;
    const role = CAR_TYPES[kind].role;
    if (role === 'boat') {
      const bx = clamp(px, B.minX + 20, B.maxX - 20);
      message = pz > B.minZ + 60 ? 'THE BOAT IS AT THE BEACH - WALK SOUTH TO THE WATER' : 'BOAT READY';
      return spawn(kind, bx, SHORE - 2.5, Math.PI, null, { keep: false, tag: true });
    }
    const d = role === 'drone' ? 3 : 7;
    let x = px + Math.sin(yaw) * d, z = pz + Math.cos(yaw) * d;
    x = clamp(x, B.minX + 3, B.maxX - 3); z = clamp(z, B.minZ + 3, B.maxZ - 3);
    clearParked((rec) => Math.hypot(rec.x - x, rec.z - z) < 5.5);
    const v = spawn(kind, x, z, yaw, lin([0.5, 0.52, 0.55]), { keep: false, tag: true });
    if (v && v.isCar) collide(v);     // push it out of a wall if it landed in one
    return v;
  }

  // (a plain object with "get" functions: the values are read fresh every time)
  // A BIGGER (OR SMALLER) COPY of a vehicle: the armored van as the big truck of the docks (Chapter 5).
  // The whole vehicle grows (body, wheels, lights); its size numbers and its collision circles grow with it.
  function rescale(v, k) {
    if (!v || !(k > 0)) return;
    const s0 = v.group.scale.x || 1, f = k / s0;
    v.group.scale.setScalar(k);
    const i = v.info, sc = (n) => (typeof n === 'number' ? n * f : n);
    v.info = { ...i, length: sc(i.length), halfWidth: sc(i.halfWidth), boxHalfWidth: sc(i.boxHalfWidth), frontZ: sc(i.frontZ), backZ: sc(i.backZ),
      roof: sc(i.roof), wheelR: sc(i.wheelR), wheelbase: sc(i.wheelbase), plateY: sc(i.plateY), noseY: sc(i.noseY), tailY: sc(i.tailY), lampW: sc(i.lampW),
      wheelZ: Array.isArray(i.wheelZ) ? i.wheelZ.map(sc) : i.wheelZ, wheelX: sc(i.wheelX) };
    v.radius = clamp((v.info.boxHalfWidth || v.info.halfWidth) * 0.97, 0.85, 1.75);
    const reach = Math.max(0, v.info.length / 2 - v.radius);
    v.circles = reach > 0.3 ? [reach, reach / 3, -reach / 3, -reach] : [0];
  }
  const cargo = createCargo({ scene, city, mats });

  return {
    live, nearest, tryEnter, requestExit, update, prefetch, spawn, spawnInFront, buildGarage, repair, removeVehicle, world, events, flasher, seaWorld, arenaGates,
    enterNow, leaveNow, showDamage, clearParked, repaint, rescale, cargo,
    // story: only vehicles this function says yes to can be entered (null = all)
    set enterFilter(fn) { enterFilter = fn; },
    // where the passenger sits (null until the inside of the car exists)
    passengerSeat(v) {
      // a boat: somebody sits on the edge of the deck, legs over the side (Lena in Chapter 3)
      if (v && v.role === 'boat') return { node: v.tilt, x: BOAT_SEAT.x, y: BOAT_SEAT.y, z: BOAT_SEAT.z, yaw: BOAT_SEAT.yaw, pose: 'sitEdge', floorBelow: BOAT_SEAT.floorBelow, scale: 1, boat: true };
      if (!v || !v.isCar || !v.driver) return null;
      const s = seatOf(v.info);
      return { node: v.tilt, x: -s.x, y: s.y + 0.02, z: s.z - 0.05, scale: clamp((v.info.roof - 0.1 - (s.y + 0.12)) / 0.93, 0.62, 1) };
    },
    // places inside a car, for story props: the seat, the middle of the dashboard, the steering wheel, the driver's eyes
    cabin(v) {
      const s = seatOf(v.info), k = Math.min(1, Math.max(0.55, (v.info.roof - 0.14 - s.y) / 0.95));
      const dz = Math.min(s.z + 0.82, v.info.wheelZ[1] - 0.1 - 0.05);
      return { seat: s, k, dash: [0, s.y + 0.1 + 0.47 * k + 0.012, dz - 0.05], wheel: [s.x, s.y + 0.1 + 0.42 * k, dz - 0.26], eye: [s.x, s.y + 0.16 + 0.68 * k, s.z - 0.1 - (1 - k) * 0.3] };
    },
    get active() { return active; },
    get state() { return state; },
    get driving() { return state === 'driving' || state === 'exiting'; },
    get shake() { return shake; },
    // km/h of the vehicle the player drives
    get speedKmh() { return active ? Math.hypot(active.vx, active.vz) * KMH : 0; },
    // what the dashboard shows
    get hud() {
      const v = active;
      if (!v) return null;
      return {
        kmh: Math.hypot(v.vx, v.vz) * KMH, role: v.role, label: v.label, damage: v.damage || 0,
        limit: v.limit ? Math.round(v.limit * KMH) : 0, limited: !!(v.fx && v.fx.limited),
        gear: v.isCar ? (v.reverse ? 'R' : Math.abs(v.forward) < 0.3 && !v.fx.throttle ? 'N' : String(v.gear)) : '',
        rpm: v.isCar ? clamp((v.rpm - IDLE_RPM) / (RED_RPM - IDLE_RPM), 0, 1) : v.fx.throttle,
        nitro: v.type.nitro ? v.nitro : null, blink: v.blink, abs: v.isCar && v.fx.abs, siren: v.siren, height: v.role === 'drone' ? v.alt : null,
      };
    },
    // Where the driver sits right now (null = nobody is to be seen in the seat). Used to put the real player character into the car.
    get seat() {
      const v = active;
      if (!v || !v.isCar || !v.driver || forceDriver === false) return null;
      if (camMode === 'cockpit' && forceDriver !== true) return null;
      if (!(state === 'driving' || (state === 'entering' && stateTime > 0.38) || (state === 'exiting' && stateTime < 0.3))) return null;
      const s = seatOf(v.info);
      // low cars: a smaller driver, so the head stays under the roof
      if (v.info.bike) return { node: v.tilt, x: s.x, y: s.y, z: s.z, scale: 1, wheel: BIKE_BAR, steer: v.steer, radius: 0.3, tilt: 0.25, bike: { grip: BIKE_GRIP, peg: BIKE_PEG, turn: -v.steer * 0.8 } };
      return { node: v.tilt, x: s.x, y: s.y + 0.02, z: s.z - 0.05, scale: clamp((v.info.roof - 0.1 - (s.y + 0.12)) / 0.93, 0.62, 1), wheel: interiors[v.kind].userData.wheel, steer: v.steer };
    },
    set riggedDriver(on) { riggedDriver = !!on; },
    set forceDriver(v) { forceDriver = v; },
    get autoDrive() { return autoInput; },
    set autoDrive(i) { autoInput = i || null; },
    // camera: chase | close | hood | cockpit
    get camMode() { return camMode; },
    set camMode(m) { camMode = m; sound.setInside(m === 'cockpit' && state === 'driving'); },
    toggleHighBeam() { if (active) { active.hiBeam = !active.hiBeam; return active.hiBeam; } return false; },
    // a short text for the player, and a wanted phone vibration (both are cleared when read)
    takeMessage() { const m = message; message = ''; return m; },
    takeHaptic() { const h = haptic; haptic = 0; return h; },
  };
}
