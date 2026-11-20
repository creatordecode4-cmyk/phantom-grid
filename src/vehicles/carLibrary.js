// ---------------------------------------------------------------------------
// carLibrary.js - loads the car MODEL FILES from assets/cars/.
//
// For every car there are two files (made from the big original scans by the
// build script, see README):
//   <name>_lo.glb  very light, colors stored in the vertices. Loaded when the
//                  game starts; used for parked cars and traffic.
//   <name>.glb     the detailed car, cut into parts with fixed names:
//                    body, glass, door_l, door_r (+ door_l_glass, door_r_glass),
//                    wheel_fl, wheel_fr, wheel_rl, wheel_rr
//                  Loaded only when the player gets into such a car.
// cars.json holds the sizes (wheels, doors, seat) and how each car drives.
// If the folder is empty, the game simply uses the cars made in code.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { registerCar } from './carModels.js';

const DIR = 'assets/cars/';

export async function loadCarLibrary() {
  const lib = { kinds: [], geo: {}, info: {}, boat: null, loadHi: async () => null };
  let list;
  try {
    const res = await fetch(DIR + 'cars.json');
    if (!res.ok) return lib;
    list = await res.json();
  } catch (e) { return lib; }
  let loader;
  try {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (e) { return lib; }

  // the light versions, all at once
  await Promise.all(Object.entries(list).map(async ([name, info]) => {
    try {
      const gltf = await loader.loadAsync(`${DIR}${name}_lo.glb`);
      let geo = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
      if (!geo) return;
      // the extra numbers per vertex (roughness, metal ...) are called "aData" in our shaders
      if (geo.attributes._data) { geo.setAttribute('aData', geo.attributes._data); geo.deleteAttribute('_data'); }
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!info.type) { lib.boat = geo; return; } // the boat is scenery, not a car
      lib.geo[name] = geo;
      lib.info[name] = info;
      lib.kinds.push(name);
      registerCar(name, info);
    } catch (e) { console.warn('[cars] could not load', name, e); }
  }));
  lib.kinds.sort();

  // the detailed version: loaded once per car type, when somebody needs it
  const pending = {};
  lib.loadHi = (name) => {
    if (!pending[name]) pending[name] = loader.loadAsync(`${DIR}${name}.glb`).then((g) => g.scene).catch((e) => { console.warn('[cars] no detailed model for', name, e); return null; });
    return pending[name];
  };
  return lib;
}
