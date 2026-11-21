// ---------------------------------------------------------------------------
// actors.js - the people of the story (Theo, Dante, Mace, Dr. Solberg ...).
//
//   * A character's model file (assets/characters/<Name>.glb) is only loaded
//     when the story needs that person. The automatic skeleton is worked out
//     in the background (a "worker"), so the game does not stop meanwhile.
//   * If the file is missing, a plain mannequin with a name tag stands in.
//   * "Extras" (people without a name: two strangers arguing, a guard) are dark
//     copies of a body that is already loaded. They cost almost nothing.
//   * Every actor can stand, walk to a place, sit in a car, take a pose, look at
//     something, move a hand while speaking, and step out of the player's way.
//   * Only actors near the player are updated every frame.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { autoRig, cloneRig, analyzeCharacter } from '../characters/autoRig.js';
import { createAnimator } from '../characters/proceduralAnim.js';
import { makeMannequin } from '../city/models.js';
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;
// compass degrees (0 north, 90 east, 180 south, 270 west) -> our angle (north = +z, east = -x)
export const compassToAngle = (deg) => Math.atan2(-Math.sin(deg * DEG), Math.cos(deg * DEG));
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function createActors({ scene, city, materials, player, vehicles }) {
  const list = [];
  const rigs = new Map();          // model name -> promise of the first rig (later ones are copies)
  let loaderPromise = null, worker = null, workerBroken = false, nextJob = 1;
  const jobs = new Map();

  // ---- the heavy part of the rigging, in a background worker when the browser can do that ----
  function analyze(raw, index, height) {
    if (!worker && !workerBroken) {
      try {
        worker = new Worker(new URL('../characters/rigWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => { const j = jobs.get(e.data.id); if (!j) return; jobs.delete(e.data.id); if (e.data.ok) j.resolve(e.data.A); else j.reject(new Error(e.data.error)); };
        worker.onerror = () => { workerBroken = true; for (const j of jobs.values()) j.fallback(); jobs.clear(); };
      } catch (e) { workerBroken = true; }
    }
    if (workerBroken || !worker) return Promise.resolve(analyzeCharacter(raw, index, { height }));
    return new Promise((resolve, reject) => {
      const id = nextJob++, p = new Float32Array(raw), ix = new Uint32Array(index);
      jobs.set(id, { resolve, reject, fallback: () => { try { resolve(analyzeCharacter(raw, index, { height })); } catch (err) { reject(err); } } });
      worker.postMessage({ id, positions: p, index: ix, height }, [p.buffer, ix.buffer]);
    });
  }
  async function loadModel(name) {
    if (!loaderPromise) {
      loaderPromise = Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => {
        const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l;
      });
    }
    const loader = await loaderPromise;
    const gltf = await loader.loadAsync(`assets/characters/${name}.glb`);
    return autoRig(THREE, gltf.scene, { height: 1.8, name, log: false, analyze, faceClean: CONFIG.player.faceClean });
  }
  // the first rig of a model (shared by everybody who asks)
  function rigOf(model) {
    if (!rigs.has(model)) rigs.set(model, loadModel(model).then((rig) => ({ rig, used: false })));
    return rigs.get(model);
  }
  // start loading people before they are needed (the story calls this at the start of a chapter)
  function preload(models) { return Promise.all(models.map((m) => rigOf(m).catch(() => null))); }

  // dark, flat look for extras: only a shape in the rain
  const shadeMats = new Map();
  function shade(color) {
    const key = color.join(',');
    if (!shadeMats.has(key)) shadeMats.set(key, new THREE.MeshStandardMaterial({ color: new THREE.Color(color[0], color[1], color[2]), roughness: 0.85, metalness: 0.05 }));
    return shadeMats.get(key);
  }

  // ------------------------------------------------------------------ spawn
  // spec: { model: 'Mace_Doyle' | null, extra: [r, g, b] (a dark copy of the player's body), name: text for the tag,
  //         at: [x, y, z], heading (radians), pose, scale, tag: always show the name, fixed: never steps aside }
  function spawn(id, spec) {
    const old = get(id);
    if (old) remove(id);
    const root = new THREE.Group();
    root.name = 'actor_' + id;
    const a = {
      id, name: spec.name || '', root, rig: null, anim: null, mannequin: false, ready: false,
      x: spec.at[0], y: spec.at[1], z: spec.at[2], heading: spec.heading || 0, scale: spec.scale || 1,
      pose: spec.pose || 'idle', look: spec.look === undefined ? 'auto' : spec.look, talking: 0, tag: !!spec.tag, fixed: !!spec.fixed,
      hidden: !!spec.hidden, seat: null, seated: null, walk: null, speed: 0, attached: [], floorBelow: spec.floorBelow || 0.45, far: 0,
      keepY: !!spec.keepY,       // true: stands on a floor inside a building (the height is not taken from the street)
      ghost: !!spec.ghost,       // true: the player can walk through (far away figures)
    };
    root.position.set(a.x, a.y, a.z);
    root.rotation.y = a.heading;
    root.scale.setScalar(a.scale);
    root.visible = false;
    scene.add(root);
    list.push(a);
    const finish = (rig) => {
      if (!list.includes(a)) return;                    // (removed again before the model arrived)
      a.rig = rig; a.anim = createAnimator(THREE, rig);
      a.anim.setPose(a.pose, 0); a.anim.floorBelow = a.floorBelow;
      root.add(rig.root);
      for (const at of a.attached) rig.bones[at.bone].add(at.object);
      a.ready = true;
    };
    const fallback = () => {
      if (!list.includes(a)) return;
      // no model file: a plain figure with a name tag
      const m = new THREE.Mesh(makeMannequin(), materials.mats.prop);
      m.castShadow = true;
      root.add(m);
      a.mannequin = true; a.tag = true; a.ready = true;
    };
    if (spec.extra && player.rig) finish(cloneRig(THREE, player.rig, shade(spec.extra)));
    else if (spec.model) {
      rigOf(spec.model).then((entry) => {
        if (!entry) return fallback();
        // the first actor of a model uses the rig itself, later ones get a copy
        if (!entry.used) { entry.used = true; finish(entry.rig); } else finish(cloneRig(THREE, entry.rig));
      }).catch((e) => { console.warn('[actors] could not load', spec.model, e); fallback(); });
    } else fallback();
    return a;
  }
  const get = (id) => list.find((a) => a.id === id) || null;
  function remove(id) {
    const i = list.findIndex((a) => a.id === id);
    if (i < 0) return;
    const a = list[i];
    if (a.rig && a.rig.root.parent && a.rig.root.parent !== a.root) a.rig.root.parent.remove(a.rig.root);
    scene.remove(a.root);
    // the first rig of a model can be used again by the next actor of that model
    for (const p of rigs.values()) p.then((entry) => { if (entry && a.rig === entry.rig) entry.used = false; }).catch(() => {});
    list.splice(i, 1);
  }
  function clear() { while (list.length) remove(list[0].id); }
  // free the memory of models that nobody uses (between chapters)
  function unload() {
    for (const [model, p] of rigs) p.then((entry) => {
      if (!entry || entry.used || list.some((a) => a.rig && a.rig.def === entry.rig.def)) return;
      entry.rig.mesh.geometry.dispose();
      const m = entry.rig.mesh.material;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[key]) m[key].dispose();
      m.dispose();
      rigs.delete(model);
    }).catch(() => {});
  }

  // ------------------------------------------------------------------ what the story can ask of an actor
  // put something into a hand or on the body: bone name ('hand_R' ...), object with its own position
  function attach(a, bone, object) { a.attached.push({ bone, object }); if (a.rig) a.rig.bones[bone].add(object); }
  function setPose(a, pose, seconds = 0.4) { a.pose = pose; if (a.anim) a.anim.setPose(pose, seconds); }
  // walk to a place (speed in m/s), then turn to "face" (radians) if given
  function walkTo(a, x, z, speed = 1.4, face = null) { a.walk = { x, z, speed, face }; }
  function place(a, x, y, z, heading = null) { a.x = x; a.y = y; a.z = z; if (heading !== null) a.heading = heading; a.walk = null; if (a.anim) a.anim.reset(); }
  // sit in a car: seat = 'passenger'. null = get out (the story places the actor afterwards)
  function sitIn(a, vehicle) { a.seat = vehicle; if (!vehicle && a.seated) { a.root.add(a.rig.root); a.rig.root.position.set(0, 0, 0); a.rig.root.scale.setScalar(1); a.seated = null; setPose(a, 'idle', 0); } }

  // ------------------------------------------------------------------ every frame
  const tmp = new THREE.Vector3();
  function update(dt, time, driving) {
    const px = player.position.x, pz = player.position.z;
    for (const a of list) {
      if (!a.ready) continue;
      a.root.visible = !a.hidden && !(a.seat && !a.seated);
      if (a.hidden) continue;
      // ---- in a car seat: the body belongs to the car ----
      if (a.seat) {
        const s = vehicles.passengerSeat(a.seat);
        if (!s || !a.anim) { a.root.visible = false; continue; }
        if (a.seated !== s.node) { a.seated = s.node; s.node.add(a.rig.root); a.anim.setPose('sit', 0); }
        a.rig.root.position.set(s.x, s.y, s.z); a.rig.root.scale.setScalar(s.scale * a.scale);
        a.x = a.seat.x; a.z = a.seat.z; a.y = a.seat.y;
        a.anim.talk = a.talking;
        a.anim.look = a.look && a.look !== 'auto' && typeof a.look === 'object' && 'yaw' in a.look ? a.look : null;
        a.anim.update(dt, {});
        continue;
      }
      const dist = Math.hypot(a.x - px, a.z - pz);
      // far away: only now and then (nobody sees the difference)
      a.far += dt;
      if (dist > 55 && a.far < 0.4 && !a.walk) continue;
      const step = dist > 55 ? a.far : dt;
      a.far = 0;
      // ---- walking ----
      let speed = 0;
      if (a.walk) {
        const dx = a.walk.x - a.x, dz = a.walk.z - a.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { if (a.walk.face !== null) a.heading += angleDiff(a.heading, a.walk.face) * Math.min(1, step * 6); if (a.walk.face === null || Math.abs(angleDiff(a.heading, a.walk.face)) < 0.05) a.walk = null; }
        else {
          speed = Math.min(a.walk.speed, d / Math.max(step, 0.001));
          a.heading += angleDiff(a.heading, Math.atan2(dx, dz)) * Math.min(1, step * 7);
          a.x += (dx / d) * speed * step; a.z += (dz / d) * speed * step;
          if (!a.keepY) a.y = city.groundHeight(a.x, a.z);
        }
      } else if (!a.fixed && !driving && dist < 0.7 && a.pose !== 'fallen' && a.pose !== 'lie' && a.pose !== 'sitEdge') {
        // the player walks into them: one step aside
        const ax = a.x - px, az = a.z - pz, d = Math.hypot(ax, az) || 1;
        walkTo(a, a.x + (ax / d) * 0.6 - (az / d) * 0.35, a.z + (az / d) * 0.6 + (ax / d) * 0.35, 1.2, a.heading);
      }
      a.speed = speed;
      a.root.position.set(a.x, a.y, a.z);
      a.root.rotation.y = a.heading;
      if (!a.anim) continue;
      // ---- where to look: at the player when near ('auto'), at a point, or freely ----
      let look = null;
      const target = a.look === 'player' || (a.look === 'auto' && dist < 6 && !a.walk) ? tmp.set(px, player.position.y + (driving ? 1.1 : 1.6), pz) : a.look && typeof a.look === 'object' && 'x' in a.look ? tmp.set(a.look.x, a.look.y, a.look.z) : null;
      if (target) {
        const yaw = angleDiff(a.heading, Math.atan2(target.x - a.x, target.z - a.z));
        if (Math.abs(yaw) < 1.9) look = { yaw, pitch: -Math.atan2(target.y - (a.y + 1.62 * a.scale), Math.max(0.5, Math.hypot(target.x - a.x, target.z - a.z))) };
      } else if (a.look && typeof a.look === 'object' && 'yaw' in a.look) look = a.look;
      a.anim.look = look;
      a.anim.talk = a.talking;
      a.anim.update(step, { speed, x: a.x, z: a.z, y: a.y, heading: a.heading, groundAt: a.keepY ? null : city.groundHeight });
      // the player cannot walk through a standing person
      if (!a.walk && dist < 12 && city.colliders.dynamic && a.pose !== 'fallen' && !a.ghost) city.colliders.dynamic.push({ x: a.x, z: a.z, r: 0.32 });
    }
  }
  // name tags (mannequins and actors marked with "tag"): writes { x, y, text } into "out"
  function tags(camera, out) {
    for (const a of list) {
      if (!a.tag || !a.name || a.hidden || !a.ready) continue;
      if (Math.abs(a.x - player.position.x) > 25 || Math.abs(a.z - player.position.z) > 25) continue;
      tmp.set(a.x, a.y + 2.05 * a.scale, a.z).project(camera);
      if (tmp.z < 1 && Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1) out.push({ x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight, text: a.name });
    }
  }

  return { list, spawn, get, remove, clear, unload, preload, update, tags, attach, setPose, walkTo, place, sitIn };
}
