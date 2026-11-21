// ---------------------------------------------------------------------------
// vehicleLoader.js - loads the vehicle MODEL FILES from assets/vehicles/ and
// makes them fit the game.
//
// For every file it:
//   * centers the model and puts its lowest point on the ground
//   * turns it so its LONGEST side lies along +Z (the driving direction)
//   * scales it to its real size (see VEHICLE_SPECS below)
//   * measures its box: that becomes the collision shape
//
// Two files per vehicle (a missing file is simply skipped):
//   <name>_lo.glb  very light, colors stored in the vertices. Loaded at the
//                  start; used for parked cars, traffic and far vehicles.
//   <name>.glb     the detailed model. Loaded only when somebody needs it.
//                  If it contains parts named body, glass, door_l, door_r,
//                  wheel_fl ... they are used (doors open, wheels turn); a
//                  model that is ONE mesh works too: then only the body moves.
// vehicles.json (optional) holds where wheels, doors and seats are inside a
// file. All its numbers are scaled together with the model.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { registerCar } from './carModels.js';

const DIR = 'assets/vehicles/';

// REAL SIZES AND CHARACTER of every vehicle. Change the numbers to tune them.
//   length: meters (the drone: "width")      mass: kg
//   drive: which wheels push - 'fwd' front, 'rwd' rear, 'awd' all
//   topSpeed: km/h    accel: m/s2 in first gear    grip: 1 = normal road tires
//   armor: how well it takes hits (1 = normal, 3 = very strong)
//   tone: how the engine sounds     role: car | police | boat | drone
export const VEHICLE_SPECS = {
  small_city_car: { label: 'CITY CAR', length: 3.4, mass: 950, drive: 'fwd', topSpeed: 140, accel: 6.6, grip: 0.95, roll: 1.25, armor: 0.8, tone: 'light', role: 'car' },
  tech_patrol_car: { label: 'TECH PATROL CAR', length: 4.9, mass: 1750, drive: 'awd', topSpeed: 200, accel: 8.8, grip: 1.1, roll: 0.95, armor: 1.3, tone: 'smooth', role: 'police' },
  police_coupe: { label: 'POLICE COUPE', length: 4.8, mass: 1600, drive: 'rwd', topSpeed: 210, accel: 9.4, grip: 1.08, roll: 0.9, armor: 1.3, tone: 'muscle', role: 'police' },
  armored_van: { label: 'ARMORED VAN', length: 6.0, mass: 4200, drive: 'rwd', topSpeed: 120, accel: 4.4, grip: 0.85, roll: 1.6, armor: 3.2, tone: 'rumble', role: 'car' },
  chrome_supercar: { label: 'CHROME SUPERCAR', length: 4.6, mass: 1350, drive: 'rwd', topSpeed: 230, accel: 12.5, grip: 1.25, roll: 0.6, armor: 0.9, tone: 'sharp', role: 'car', nitro: true, turbo: true },
  patrol_boat: { label: 'PATROL BOAT', length: 8.0, mass: 3000, topSpeed: 75, accel: 4.5, armor: 1.5, tone: 'boat', role: 'boat' },
  drone: { label: 'DRONE', width: 1.8, mass: 12, topSpeed: 70, accel: 9, armor: 0.5, tone: 'drone', role: 'drone' },
};

// Turn, move and scale a geometry so the model stands right. Returns the scale that was used.
function fitGeometry(geo, wantLength) {
  geo.computeBoundingBox();
  let b = geo.boundingBox;
  // the longest flat side becomes the driving direction (+Z)
  if (b.max.x - b.min.x > b.max.z - b.min.z) { geo.rotateY(Math.PI / 2); geo.computeBoundingBox(); b = geo.boundingBox; }
  const s = wantLength / (b.max.z - b.min.z);
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeBoundingBox();
  return s;
}

export async function loadVehicles() {
  const lib = { kinds: [], geo: {}, info: {}, specs: VEHICLE_SPECS, boat: null, boatInfo: null, loadHi: async () => null };
  let loader;
  try {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (e) { return lib; }
  // where the parts are inside each file (wheels, doors, seat) - optional
  let parts = {};
  try { const res = await fetch(DIR + 'vehicles.json'); if (res.ok) parts = await res.json(); } catch (e) { /* no list: fine */ }
  const exists = async (file) => { try { return (await fetch(DIR + file, { method: 'HEAD' })).ok; } catch (e) { return false; } };

  const scaleOf = {};
  await Promise.all(Object.entries(VEHICLE_SPECS).map(async ([name, spec]) => {
    try {
      // the light version; if only the detailed file exists, that one is used for both
      const file = (await exists(`${name}_lo.glb`)) ? `${name}_lo.glb` : (await exists(`${name}.glb`)) ? `${name}.glb` : null;
      if (!file) return; // this vehicle has no file: skip it
      const gltf = await loader.loadAsync(DIR + file);
      let geo = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (o.isMesh && !geo) { geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); } });
      if (!geo) return;
      // the extra numbers per vertex (roughness, metal ...) are called "aData" in our shaders
      if (geo.attributes._data) { geo.setAttribute('aData', geo.attributes._data); geo.deleteAttribute('_data'); }
      const n = geo.attributes.position.count;
      if (!geo.attributes.aData) { const d = new Float32Array(n * 4); for (let i = 0; i < n; i++) { d[i * 4] = 0.35; d[i * 4 + 1] = 0.4; } geo.setAttribute('aData', new THREE.BufferAttribute(d, 4)); }
      if (!geo.attributes.color) { const c = new Float32Array(n * 3).fill(0.5); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      const s = fitGeometry(geo, spec.length || spec.width);
      scaleOf[name] = s;
      const b = geo.boundingBox;
      const P = parts[name] || {};
      const hw = (P.halfWidth ? P.halfWidth * s : (b.max.x - b.min.x) / 2);
      const k = (v) => (Array.isArray(v) ? v.map((q) => q * s) : v * s);
      // sizes in meters, measured from the fitted box (+ the part positions from vehicles.json)
      const info = {
        length: b.max.z - b.min.z, halfWidth: hw, roof: b.max.y, backZ: b.min.z, frontZ: b.max.z, boxHalfWidth: (b.max.x - b.min.x) / 2,
        wheelR: P.wheelR ? P.wheelR * s : 0.36, wheelX: P.wheelX ? P.wheelX * s : hw * 0.85,
        wheelZ: P.wheelZ ? k(P.wheelZ) : [b.min.z * 0.6, b.max.z * 0.6],
        wheels: P.wheels ? Object.fromEntries(Object.entries(P.wheels).map(([w, p]) => [w, k(p)])) : null,
        door: P.door ? { z0: P.door.z0 * s, z1: P.door.z1 * s, y0: P.door.y0 * s, y1: P.door.y1 * s } : { z0: -0.4, z1: 0.5, y0: 0.35, y1: b.max.y * 0.9 },
        seat: P.seat ? { x: P.seat.x * s, y: P.seat.y * s, z: P.seat.z * s } : null,
        codeWheels: !!P.codeWheels, hasParts: !!P.wheels,
      };
      if (spec.role === 'boat') { lib.boat = geo; lib.boatInfo = info; registerCar(name, info, spec); return; }
      if (spec.role === 'drone') { lib.drone = geo; registerCar(name, info, spec); return; }
      lib.geo[name] = geo;
      lib.info[name] = info;
      lib.kinds.push(name);
      registerCar(name, info, spec);
    } catch (e) { console.warn('[vehicles] could not load', name, e); }
  }));
  lib.kinds.sort();

  // The detailed version: loaded once per vehicle, when somebody needs it. It
  // gets the same scale as the light version (and the same turn / centering
  // when it is one plain mesh).
  const pending = {};
  lib.loadHi = (name) => {
    if (pending[name]) return pending[name];
    pending[name] = (async () => {
      if (!(await exists(`${name}.glb`)) || !scaleOf[name]) return null;
      try {
        const scene = (await loader.loadAsync(`${DIR}${name}.glb`)).scene;
        const s = scaleOf[name];
        const named = !!scene.getObjectByName('body');
        if (named) {
          // already cut into parts by the build script: scale the parts and where they hang
          scene.traverse((o) => { o.position.multiplyScalar(s); if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.scale(s, s, s); } });
        } else {
          // one plain mesh: fit it exactly like the light version
          scene.updateMatrixWorld(true);
          scene.traverse((o) => { if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.applyMatrix4(o.matrixWorld); fitGeometry(o.geometry, VEHICLE_SPECS[name].length || VEHICLE_SPECS[name].width); o.name = 'body'; } o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); });
        }
        return scene;
      } catch (e) { console.warn('[vehicles] no detailed model for', name, e); return null; }
    })();
    return pending[name];
  };
  return lib;
}
