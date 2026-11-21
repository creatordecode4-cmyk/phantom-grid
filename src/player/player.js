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
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, angleDelta, DEG } from '../utils/math.js';
import { makeMannequin } from '../city/models.js';
import { autoRig } from '../characters/autoRig.js';
import { createAnimator } from '../characters/proceduralAnim.js';

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
      rig = await autoRig(THREE, model, { height: P.height, name: 'player', onProgress });
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
  let stepPhase = 0;
  let stepDist = 0, steps = 0;
  const vel = new THREE.Vector2();
  pos.set(layout.spawn.x, city.groundHeight(layout.spawn.x, layout.spawn.z), layout.spawn.z);
  root.rotation.y = heading;

  // Push the player out of anything solid. Returns nothing, changes x/z in "p".
  const p = { x: 0, z: 0 };
  function collide() {
    const r = P.radius;
    for (let pass = 0; pass < 3; pass++) {
      const cell = city.colliders.near(p.x, p.z);
      let hit = false;
      for (const b of cell.boxes) {
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
      for (const c of city.colliders.dynamic && city.colliders.dynamic.length ? cell.circles.concat(city.colliders.dynamic) : cell.circles) {
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
    // edge of the world
    const B = layout.bounds;
    p.x = clamp(p.x, B.minX, B.maxX);
    p.z = clamp(p.z, B.minZ, B.maxZ);
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
    const top = input.run ? P.runSpeed : P.walkSpeed;
    vel.x = damp(vel.x, mx * top, P.acceleration, dt);
    vel.y = damp(vel.y, mz * top, P.acceleration, dt);
    speed = vel.length();

    // turn toward the walking direction
    if (amount > 0.05 && speed > 0.05) {
      const target = Math.atan2(vel.x, vel.y);
      heading += angleDelta(heading, target) * (1 - Math.exp(-P.turnSpeed * dt));
    }

    // move, then fix collisions
    p.x = pos.x + vel.x * dt;
    p.z = pos.z + vel.y * dt;
    collide();
    // if a wall stopped us, forget the blocked part of the speed
    if (dt > 0) {
      const ax = (p.x - pos.x) / dt, az = (p.z - pos.z) / dt;
      if (Math.abs(ax) < Math.abs(vel.x)) vel.x = ax;
      if (Math.abs(az) < Math.abs(vel.y)) vel.y = az;
    }
    pos.x = p.x;
    pos.z = p.z;
    // follow the ground (curbs, the sloping beach)
    pos.y = damp(pos.y, city.groundHeight(pos.x, pos.z), 14, dt);
    root.rotation.y = heading;

    if (mixer) animate(dt);
    else if (mover) {
      // the procedural animation: it needs the speed along the walking direction and the ground under the feet
      const forward = vel.x * Math.sin(heading) + vel.y * Math.cos(heading);
      mover.update(dt, { speed: forward, x: pos.x, z: pos.z, y: pos.y, heading, groundAt: city.groundHeight });
    } else {
      // no skeleton: a tiny up-down bob and a forward lean, so it does not look like sliding
      stepPhase += dt * (4.5 + speed * 2.2);
      const k = clamp(speed / P.walkSpeed, 0, 1);
      body.position.y = Math.abs(Math.sin(stepPhase)) * 0.022 * k;
      body.rotation.x = damp(body.rotation.x, clamp(speed / P.runSpeed, 0, 1) * 0.09, 6, dt);
    }
    // count the steps (main.js plays a footstep sound for each one)
    stepDist += speed * dt;
    const stride = speed > 3 ? 1.25 : 0.72;
    if (stepDist > stride) { stepDist = 0; steps++; }

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
  function setHidden(h) { hidden = h; root.visible = !h; blob.visible = !h; }
  function place(x, z, angle) {
    if (mover && Math.hypot(pos.x - x, pos.z - z) > 0.5) mover.reset();
    pos.set(x, city.groundHeight(x, z), z);
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
    if (sitting !== seat.node) {
      sitting = seat.node;
      seat.node.add(rig.root);
      mover.setMode('drive', 0);
    }
    const sc = seat.scale;
    rig.root.position.set(seat.x, seat.y, seat.z);
    rig.root.scale.setScalar(sc);
    mover.drive = { steer: seat.steer, wheel: [(seat.wheel[0] - seat.x) / sc, (seat.wheel[1] - seat.y) / sc, (seat.wheel[2] - seat.z) / sc], radius: 0.17 / sc, tilt: -0.45 };
    mover.update(dt, {});
  }

  function teleport(x, z, compassDeg = null) {
    if (mover) mover.reset();
    pos.set(x, city.groundHeight(x, z), z);
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
    get hidden() { return hidden; },
    get steps() { return steps; },   // goes up by one with every footstep
    get heading() { return heading; },
    get speed() { return speed; },
  };
}
