// ---------------------------------------------------------------------------
// player.js - the player character (temporary version for Phase 1).
//
//   * tries to load assets/characters/Nate_Calloway.glb and scales it to 1.8 m
//   * if that file is missing, a simple mannequin with real human
//     proportions is used instead
//   * if assets/characters/Nate_Calloway_rigged.glb exists (a model with a
//     skeleton and the animations idle, walk, run) it is used and animated
//   * without it the plain model gets an AUTOMATIC skeleton (src/characters/
//     autoRig.js) and is moved by code (src/characters/proceduralAnim.js):
//     walking, running, standing, sitting in a car
//   * walks 1.6 m/s, runs 5 m/s, turns smoothly
//   * cannot walk through buildings, cars, poles or out of the map
//   * SWIMS in deep water (the canals of The Sunk, the sea): from a low deck or
//     the beach he goes into the water, swimming into a pontoon he climbs out
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, angleDelta, DEG } from '../utils/math.js';
import { makeMannequin } from '../city/models.js';
import { autoRig } from '../characters/autoRig.js';
import { createAnimator } from '../characters/proceduralAnim.js';
import { SWIM, WADE } from '../world/water.js';

// Load the character file. Returns a three.js object, or null if it is missing.
async function loadCharacter(url) {
  try {
    // quick check first, so we do not download the loader code for nothing
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok) return null;
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder); // the models are meshopt-compressed
    const gltf = await loader.loadAsync(url);
    gltf.scene.userData.animations = gltf.animations || [];
    return gltf.scene;
  } catch (e) {
    console.warn('[player] could not load the character model, using the mannequin.', e);
    return null;
  }
}

export async function createPlayer(scene, city, materials, onProgress = () => {}) {
  const P = CONFIG.player;
  const layout = city.layout;
  const root = new THREE.Group();   // moves and turns
  const body = new THREE.Group();   // small bobbing while walking
  root.name = 'player';
  root.add(body);
  scene.add(root);

  // ---- the model ----
  let usingMannequin = false;
  // first choice: the model with a skeleton and animations, then the plain model
  let model = P.riggedModel ? await loadCharacter(P.riggedModel) : null;
  const rigged = !!model;
  if (!model) model = await loadCharacter(P.model);
  // ---- animations (only the rigged model has them): idle, walk, run ----
  let mixer = null;
  const anim = { idle: null, walk: null, run: null };
  if (rigged && model.userData.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    for (const clip of model.userData.animations) {
      const name = clip.name.toLowerCase();
      for (const key of ['idle', 'walk', 'run']) {
        if (!anim[key] && name.includes(key)) { anim[key] = mixer.clipAction(clip); anim[key].play(); anim[key].setEffectiveWeight(key === 'idle' ? 1 : 0); }
      }
    }
    if (!anim.idle && !anim.walk && !anim.run) mixer = null; // no clip with a name we know
  }
  // ---- no skeleton in the file: build one from the shape of the mesh ----
  let rig = null, mover = null;
  if (model && !mixer && P.autoRig !== false) {
    try {
      rig = await autoRig(THREE, model, { height: P.height, name: 'player', faceClean: P.faceClean, onProgress });
      mover = createAnimator(THREE, rig);
      body.add(rig.root);
    } catch (e) {
      console.warn('[player] the automatic skeleton failed, the model is shown without animation.', e);
      rig = null; mover = null;
    }
  }
  if (rig) { /* the rig already has the right size and stands on the ground */ }
  else if (model) {
    // scale to exactly 1.8 m and stand it on the ground, centered
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = P.height / Math.max(size.y, 0.001);
    model.scale.multiplyScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= box.min.y;
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    });
    body.add(model);
  } else {
    usingMannequin = true;
    const mesh = new THREE.Mesh(makeMannequin(), materials.mats.prop);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
  }

  // soft dark spot under the feet (keeps the character "on the ground" in any light)
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: materials.tex.glow, transparent: true, opacity: 0.5,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -12,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 12;
  scene.add(blob);

  // ---- state ----
  const pos = root.position;
  let heading = layout.spawn.facingDeg * DEG; // 0 = north (+z), turns like a compass
  // compass degrees -> our angle: north = +z, east = -x
  const compassToAngle = (deg) => Math.atan2(-Math.sin(deg * DEG), Math.cos(deg * DEG));
  heading = compassToAngle(layout.spawn.facingDeg);
  let speed = 0;
  let burden = 0;          // 0..1: something heavy in the arms
  let stepPhase = 0;
  let stepDist = 0, steps = 0;
  const vel = new THREE.Vector2();
  pos.set(layout.spawn.x, city.groundHeight(layout.spawn.x, layout.spawn.z), layout.spawn.z);
  root.rotation.y = heading;

  // ---- inside a house (src/interiors): its own floor, walls and furniture instead of the city's ----
  // room = { floor, minX, maxX, minZ, maxZ, boxes: [{ minX, maxX, minZ, maxZ }] } or null (outdoors)
  let room = null;
  // THE SUNK (Chapter 3): only the decks can be walked on (pontoons, ramps, roofs); where two decks lie
  // over each other (a ramp over a pontoon) the one nearest to the feet counts
  const sunk = city.sunk || null;
  const inSunk = (x, z) => !!sunk && sunk.inZone(x, z);
  // (a crack of a few centimeters between two decks - the end of a stair and a pontoon - does not swallow
  //  him: with decks on two sides of it, the deck next to it carries him. The outer edge of a deck - a deck on
  //  one side only - still ends where it ends.)
  const CRACK = [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];
  function deckAt(x, z, y) {
    // (off the side of a stair onto the pontoon or the roof just under it: a drop of up to two meters lands
    //  on that deck - not in the water under it)
    const h = sunk.walk(x, z, y) ?? sunk.walk(x, z, y - 1.0);
    if (h !== null) return h;
    let found = null, sides = 0;
    for (const [dx, dz] of CRACK) { const g = sunk.walk(x + dx, z + dz, y); if (g !== null) { sides++; if (found === null) found = g; } }
    return sides >= 2 ? found : null;
  }
  const groundAt = (x, z) => {
    if (room) return room.floor;
    if (inSunk(x, z)) { const h = deckAt(x, z, pos.y); if (h !== null) return h; }
    return city.groundHeight(x, z);
  };
  const NO_CIRCLES = [];

  // ---- WATER (src/world/water.js): in deep water he swims ----
  // The root of the character is then AT the surface; the animation puts the body into the water (upright and
  // treading when still, almost flat in a front crawl with the head up when moving). From a low deck (a pontoon,
  // the foot of a ramp) or down the beach he goes into the water; swimming into a pontoon he climbs out. In
  // shallow water he walks on the bottom, slower the deeper it is. Nobody stands ON the water.
  const water = city.water || null;
  const SEA_REACH = 45;          // how far past the south edge of the map he can swim out to sea
  const DIVE = 2.0;              // from a deck higher than this over the water he does not step off (a roof, a stair)
  let swimming = false, surface = 0, wade = 0, splashes = 0, strokes = 0, strokeDist = 0;
  // the water at (x, z) for somebody at height y: null where there is none, or where a deck carries him
  function wetAt(x, z, y) {
    if (room || !water) return null;
    const w = water.at(x, z);
    if (!w) return null;
    if (inSunk(x, z) && deckAt(x, z, y) !== null) return null;
    return w;
  }
  // after he was put somewhere (or moved): is he swimming now?
  function settle() {
    if (hidden) { swimming = false; wade = 0; return; }       // (put into a car or a boat: nobody swims in there)
    const w = wetAt(pos.x, pos.z, pos.y);
    swimming = !!w && w.surface - w.bottom >= SWIM && pos.y < w.surface + DIVE;
    if (swimming) { surface = w.surface; pos.y = surface; }
    wade = 0;
  }

  // Push the player out of anything solid. Returns nothing, changes x/z in "p".
  const p = { x: 0, z: 0 };
  function collide() {
    const r = P.radius;
    for (let pass = 0; pass < 3; pass++) {
      const cell = room ? room : city.colliders.near(p.x, p.z);
      let hit = false;
      const deck = !room && inSunk(p.x, p.z);
      for (const b of cell.boxes) {
        if (b.boatOnly) continue;                                  // (pontoons and ramps only stop boats)
        if (deck && b.h <= pos.y + 0.06) continue;                 // (The Sunk: standing on this roof)
        const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.z += (dz / d) * (r - d);
        } else {
          // the center is inside the box: leave through the nearest side
          const l = p.x - b.minX, rr = b.maxX - p.x, n = p.z - b.minZ, f = b.maxZ - p.z;
          const m = Math.min(l, rr, n, f);
          if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r;
          else if (m === n) p.z = b.minZ - r; else p.z = b.maxZ + r;
        }
      }
      // (fixed things first, then the moving cars close to the player)
      for (const c of room ? NO_CIRCLES : city.colliders.dynamic && city.colliders.dynamic.length ? cell.circles.concat(city.colliders.dynamic) : cell.circles) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        hit = true;
        const d = Math.sqrt(d2) || 0.0001;
        p.x += (dx / d) * (min - d);
        p.z += (dz / d) * (min - d);
      }
      if (!hit) break;
    }
    // edge of the world (or the walls of the house). South of the beach there is only sea: he can swim out a bit.
    const B = room || layout.bounds;
    p.x = clamp(p.x, B.minX, B.maxX);
    p.z = clamp(p.z, room || !water ? B.minZ : B.minZ - SEA_REACH, B.maxZ);
  }

  // input: { moveX, moveY (-1..1), run }, camYaw: where the camera looks
  function update(dt, input, camYaw) {
    // stick direction -> world direction (forward = away from the camera)
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -fz, rz = fx;
    let mx = fx * input.moveY + rx * input.moveX;
    let mz = fz * input.moveY + rz * input.moveX;
    let amount = Math.hypot(mx, mz);
    if (amount > 1) { mx /= amount; mz /= amount; amount = 1; }
    // swimming is slow (and slow to speed up and to turn); deep water at the beach slows the walk
    // (carrying something heavy - the crate of Chapter 5 - he walks slower and cannot run)
    const top = swimming ? (input.run ? P.swimFast ?? 2 : P.swimSpeed ?? 1.2)
      : (input.run && burden < 0.5 ? P.runSpeed : P.walkSpeed) * (1 - 0.6 * clamp((wade - WADE) / (SWIM - WADE), 0, 1)) * (1 - 0.4 * burden);
    const acc = swimming ? 2.4 : P.acceleration;
    vel.x = damp(vel.x, mx * top, acc, dt);
    vel.y = damp(vel.y, mz * top, acc, dt);
    speed = vel.length();

    // turn toward the walking direction
    if (amount > 0.05 && speed > 0.05) {
      const target = Math.atan2(vel.x, vel.y);
      heading += angleDelta(heading, target) * (1 - Math.exp(-P.turnSpeed * (swimming ? 0.4 : 1) * dt));
    }

    // move, then fix collisions
    p.x = pos.x + vel.x * dt;
    p.z = pos.z + vel.y * dt;
    collide();
    // The Sunk: no deck there = water or a drop. From a low deck he steps into the water; swimming, he goes on
    // in the water or climbs onto a deck that is low enough. Anything else (a roof edge, a quay wall): slide along it.
    if (!room && (inSunk(p.x, p.z) || inSunk(pos.x, pos.z))) {
      const ok = (x, z) => !inSunk(x, z) || deckAt(x, z, pos.y) !== null ||
        (!!water && water.at(x, z) !== null && (swimming || pos.y < water.level + DIVE));
      if (!ok(p.x, p.z)) {
        if (ok(p.x, pos.z)) p.z = pos.z;
        else if (ok(pos.x, p.z)) p.x = pos.x;
        else { p.x = pos.x; p.z = pos.z; }
      }
    }
    // if a wall stopped us, forget the blocked part of the speed
    if (dt > 0) {
      const ax = (p.x - pos.x) / dt, az = (p.z - pos.z) / dt;
      if (Math.abs(ax) < Math.abs(vel.x)) vel.x = ax;
      if (Math.abs(az) < Math.abs(vel.y)) vel.y = az;
    }
    pos.x = p.x;
    pos.z = p.z;
    // ---- in the water, or not? (a little give between the two, so he does not flicker at the edge) ----
    const w = wetAt(pos.x, pos.z, swimming ? surface : pos.y);
    const depth = w ? w.surface - w.bottom : 0;
    if (!swimming && w && depth >= SWIM && pos.y < w.surface + DIVE) { swimming = true; surface = w.surface; splashes++; }
    else if (swimming && (!w || depth < SWIM - 0.15)) { swimming = false; splashes++; }
    wade = !swimming && w ? Math.max(0, w.surface - pos.y) : 0;
    // follow the ground (curbs, the sloping beach) - or float at the surface (going in from a pontoon: a small drop)
    if (swimming) pos.y = damp(pos.y, surface, 9, dt);
    else pos.y = damp(pos.y, groundAt(pos.x, pos.z), 14, dt);
    root.rotation.y = heading;

    if (mixer) { animate(dt); body.position.y = swimming ? -1.25 : 0; }
    else if (mover) {
      // the procedural animation: it needs the speed along the walking direction and the ground under the feet
      const forward = vel.x * Math.sin(heading) + vel.y * Math.cos(heading);
      handsTarget();
      mover.update(dt, { speed: forward, x: pos.x, z: pos.z, y: pos.y, heading, groundAt, swim: swimming });
      placeHeld();
    } else {
      // no skeleton: a tiny up-down bob and a forward lean, so it does not look like sliding
      stepPhase += dt * (4.5 + speed * 2.2);
      const k = clamp(speed / P.walkSpeed, 0, 1);
      body.position.y = Math.abs(Math.sin(stepPhase)) * 0.022 * k - (swimming ? 1.25 : 0);
      body.rotation.x = damp(body.rotation.x, clamp(speed / P.runSpeed, 0, 1) * 0.09, 6, dt);
    }
    // count the steps (main.js plays a footstep sound for each one) - or the strokes, swimming
    if (swimming) {
      strokeDist += Math.max(speed, 0.35) * dt;                 // (treading water: a soft splash now and then)
      if (strokeDist > (speed > 0.4 ? 0.85 : 0.6)) { strokeDist = 0; strokes++; }
    } else {
      stepDist += speed * dt;
      const stride = speed > 3 ? 1.25 : 0.72;
      if (stepDist > stride) { stepDist = 0; steps++; }
    }

    // (no dark spot on the water, nor on the sand under it)
    blob.visible = !hidden && !staged && !swimming && wade < 0.2;
    blob.position.set(pos.x, pos.y + 0.02, pos.z);
  }

  // Blend idle / walk / run by how fast the player moves.
  const weights = { idle: 1, walk: 0, run: 0 };
  function animate(dt) {
    const run = clamp((speed - 2.2) / 2.0, 0, 1);
    const move = clamp(speed / 0.9, 0, 1);
    const want = { idle: 1 - move, walk: move * (1 - run), run: move * run };
    // a missing clip gives its share to the nearest one we have
    if (!anim.run) { want.walk += want.run; want.run = 0; }
    if (!anim.walk) { want.run += want.walk; want.walk = 0; }
    if (!anim.idle) want.idle = 0;
    for (const key of ['idle', 'walk', 'run']) {
      if (!anim[key]) continue;
      weights[key] = damp(weights[key], want[key], 8, dt);
      anim[key].setEffectiveWeight(weights[key]);
    }
    // the feet should not slide: play the clips faster when the player is faster
    if (anim.walk) anim.walk.setEffectiveTimeScale(clamp(speed / P.walkSpeed, 0.6, 1.6));
    if (anim.run) anim.run.setEffectiveTimeScale(clamp(speed / P.runSpeed, 0.7, 1.3));
    mixer.update(dt);
  }

  // ---- used by the cars: hide the player, put them somewhere, walk them to a door ----
  let hidden = false;
  function setHidden(h) { hidden = h; root.visible = !h && fadeK > 0.02; blob.visible = !h && !swimming; }

  // ---- the camera pressed very close to the player (against a wall, in a small room) ----
  // Instead of the camera cutting through the head and the bag (you would see inside the model), the
  // character becomes see-through for that moment: a soft, even fade (no pattern of white dots), and he
  // comes back when the camera moves away. The rest of the time he is drawn as a normal solid model.
  let fadeK = 1, fadeOn = false;
  const fadeMats = [];
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (fadeMats.includes(m) || m.transparent || m.alphaTest > 0) continue;
      m.alphaHash = false;
      fadeMats.push(m);
    }
  });
  function setFade(k) {
    k = clamp(k, 0, 1);
    if (k === fadeK || (Math.abs(k - fadeK) < 0.01 && k > 0 && k < 1)) return;
    fadeK = k;
    const on = k < 0.995;
    if (on !== fadeOn) { fadeOn = on; for (const m of fadeMats) { m.transparent = on; m.depthWrite = true; m.needsUpdate = true; } }
    for (const m of fadeMats) m.opacity = on ? k : 1;
    root.visible = !hidden && k > 0.02;
  }
  // The see-through version of the shaders is made once at the start (a phone would stutter for a moment the
  // first time the camera comes close otherwise).
  function prewarmFade(renderer, scene, camera) {
    if (!fadeMats.length) return;
    try {
      for (const m of fadeMats) { m.transparent = true; m.needsUpdate = true; }
      renderer.compile(root, camera, scene);
    } catch (e) { /* only a small stutter later */ }
    for (const m of fadeMats) { m.transparent = false; m.needsUpdate = true; }
  }
  // y (optional): about how high the place is. In The Sunk a roof and the room under it share x and z:
  // the deck nearest to this height is the one he stands on (without it: the one nearest to where he is now).
  function place(x, z, angle, y) {
    if (mover && Math.hypot(pos.x - x, pos.z - z) > 0.5) mover.reset();
    if (typeof y === 'number' && isFinite(y)) pos.y = y;
    pos.set(x, groundAt(x, z), z);
    settle();
    vel.set(0, 0); speed = 0;
    heading = angle;
    root.rotation.y = heading;
    blob.position.set(pos.x, pos.y + 0.02, pos.z);
  }
  function glideTo(x, z, angle, dt) {
    pos.x = damp(pos.x, x, 12, dt); pos.z = damp(pos.z, z, 12, dt);
    heading += angleDelta(heading, angle) * (1 - Math.exp(-10 * dt));
    root.rotation.y = heading;
    blob.position.set(pos.x, pos.y + 0.02, pos.z);
  }

  // ---- sitting in a car (only with the automatic skeleton) ----
  // seat: { node (the car body), x, y, z (the seat inside it), scale, wheel [x, y, z], steer } or null = not sitting
  let sitting = null;
  function sit(seat, dt) {
    if (!mover) return;
    if (!seat) {
      if (!sitting) return;
      // back on the street: the character belongs to the player object again
      sitting = null;
      body.add(rig.root);
      rig.root.position.set(0, 0, 0); rig.root.scale.setScalar(1);
      mover.setMode('auto', 0);
      mover.reset();
      return;
    }
    swimming = false;          // (in a car or a boat nobody swims)
    if (sitting !== seat.node) {
      sitting = seat.node;
      seat.node.add(rig.root);
      mover.setMode('drive', 0);
    }
    const sc = seat.scale;
    rig.root.position.set(seat.x, seat.y, seat.z);
    rig.root.scale.setScalar(sc);
    const rel = (p) => [(p[0] - seat.x) / sc, (p[1] - seat.y) / sc, (p[2] - seat.z) / sc];
    mover.drive = { steer: seat.steer, wheel: rel(seat.wheel), radius: (seat.radius || 0.17) / sc, tilt: seat.tilt === undefined ? -0.45 : seat.tilt,
      // a motorbike: where the left grip and the left footpeg are (the right ones are their mirror image), how far the bars are turned
      bike: seat.bike ? { grip: rel(seat.bike.grip), peg: rel(seat.bike.peg), turn: seat.bike.turn } : null };
    mover.update(dt, {});
  }

  // ---- story scenes: the character is put somewhere in a pose (lying in bed, sitting on its edge, standing at a
  //      mark) and does not listen to the stick. y can be a floor inside a building. ----
  let staged = false;
  //   floorBelow: for the pose 'sitEdge' - how far the floor is under the seat (meters)
  function stage(x, y, z, angle, pose = 'idle', floorBelow = 0.45) {
    staged = true; swimming = false;
    if (mover) mover.floorBelow = floorBelow;
    pos.set(x, y, z); vel.set(0, 0); speed = 0;
    heading = angle; root.rotation.y = heading;
    blob.visible = false;
    if (mover) { mover.setPose(pose, 0); mover.reset(); }
  }
  function unstage() {
    if (!staged) return;
    staged = false;
    blob.visible = !hidden;
    // (still holding a box after the scene: the hands stay on it)
    if (mover) { mover.setPose(held && heldSize ? 'carry' : 'idle', 0); mover.look = null; mover.talk = 0; mover.reset(); }
  }
  // a staged character still breathes, speaks and looks around
  function tick(dt) { if (mover) { handsTarget(); mover.update(dt, { speed: 0, x: pos.x, z: pos.z, y: pos.y, heading, groundAt: null }); placeHeld(); } }
  // where the hands work: a point in the world the story gives (poses work, spanner, putDown, roof, lean, give),
  // turned into the body's own space every frame
  let workAt = null;
  const workLocal = new THREE.Vector3();
  function handsTarget() {
    if (!mover) return;
    if (!workAt) { mover.workAt = null; return; }
    const dx = workAt[0] - pos.x, dy = workAt[1] - pos.y, dz = workAt[2] - pos.z, c = Math.cos(heading), sn = Math.sin(heading);
    mover.workAt = workLocal.set(dx * c - dz * sn, dy, dx * sn + dz * c);
  }
  // what the arms do while walking ('idle', 'carry' ...), and small things the story sets
  function setPose(pose, seconds = 0.3) { if (mover) mover.setPose(pose, seconds); }
  // something carried in front of the body (a parcel): it moves with the character. null = put it away
  //   size: { w, h, d, cx, cy, cz } - how big the box is and where its middle is in its own frame. With it, the box
  //   sits where the arms can hold it (the animator's carryAt) and both hands are put on its sides
  let held = null, heldSize = null;
  function hold(object, size = null) {
    if (held) body.remove(held);
    held = object; heldSize = object ? size : null;
    if (mover) mover.carry = heldSize;
    if (object) body.add(object);
  }
  function placeHeld() {
    const at = held && heldSize && mover ? mover.carryAt : null;
    if (at) held.position.set(at.x - heldSize.cx, at.y - heldSize.cy, at.z - heldSize.cz);
  }

  function teleport(x, z, compassDeg = null) {
    if (mover) mover.reset();
    pos.set(x, groundAt(x, z), z);
    settle();
    vel.set(0, 0);
    if (compassDeg !== null) heading = compassToAngle(compassDeg);
    root.rotation.y = heading;
    blob.position.set(pos.x, pos.y + 0.02, pos.z);
  }

  return {
    root,
    position: pos,
    update,
    teleport,
    usingMannequin,
    rigged, animated: !!mixer || !!mover, autoRigged: !!rig, rig, anim: mover,
    setHidden, place, glideTo, sit,
    setBurden(b) { burden = clamp(b || 0, 0, 1); },
    stage, unstage, tick, setPose, hold,
    // walking inside a house: its floor, its walls and furniture (null = back in the city)
    setRoom(r) { room = r; },
    get room() { return room; },
    setFade, prewarmFade,
    blob,
    get staged() { return staged; },
    set talk(v) { if (mover) mover.talk = v; },
    // the words of a line Nate says, and how long it stays: his mouth says them (speech.js)
    say(text, seconds) { if (mover) mover.say(text, seconds); },
    // someone near is talking for "seconds": Nate listens (small nods now and then, the weight shifts)
    listen(seconds) { if (mover && mover.listen) mover.listen(seconds); },
    set look(v) { if (mover) mover.look = v; },
    set workAt(v) { workAt = v || null; },
    get workAt() { return workAt; },
    // the expression of the face ('smile', 'sad' ... see src/characters/faceAnim.js)
    set mood(v) { if (mover) mover.setFace(v || 'neutral'); },
    get mood() { return mover ? mover.face : null; },
    get hidden() { return hidden; },
    get steps() { return steps; },   // goes up by one with every footstep
    get heading() { return heading; },
    get speed() { return speed; },
    // in deep water (the root is at the surface), how deep he wades, and the splashes for main.js:
    // "splashes" goes up by one when he goes into the water or comes out, "strokes" with every stroke
    get swimming() { return swimming; },
    get wade() { return wade; },
    get splashes() { return splashes; },
    get strokes() { return strokes; },
  };
}
