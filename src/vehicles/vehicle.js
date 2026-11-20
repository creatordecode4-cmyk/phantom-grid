// ---------------------------------------------------------------------------
// vehicle.js - the cars the player can drive.
//
// HOW IT FITS TOGETHER
//   * Parked cars are cheap "instanced" copies (see props.js). When the player
//     gets into one, that copy is hidden and a real car object is put in its
//     place: body, four turning wheels, a door that opens, brake lights and a
//     headlight beam on the road.
//   * Cars the player leaves behind stay real objects (a few of them at most).
//
// DRIVING FEEL (arcade, but with weight)
//   The car has a speed along its nose ("forward") and a speed sideways
//   ("slide"). The tires pull the sideways speed back to zero - that is grip.
//   With the handbrake the grip is low, so the tail swings out: a drift.
//   Steering gets smaller at high speed, the body leans in corners and dips
//   when braking.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CAR_TYPES, carInfo, makeCar, makeWheel } from './carModels.js';
import { clamp, damp, smoothstep } from '../utils/math.js';

const KMH = 3.6;
const BODY_CIRCLES = [1.35, 0, -1.35]; // three circles along the car are its collision shape
const BODY_R = 0.98;
const ENTER_RANGE = 3.3;               // how close the player has to stand to get in

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

export function createVehicles({ scene, city, materials, sound, weather }) {
  const mats = materials.mats;
  const L = city.layout, B = L.bounds;
  const geo = { body: {}, wheel: {} };
  const beamTex = makeBeamTexture();
  const live = [];        // real car objects
  let active = null;      // the car the player sits in (or is getting into / out of)
  let state = 'none';     // none | entering | driving | exiting
  let stateTime = 0;
  let shake = 0;          // camera shake after a crash (goes back to 0)
  let exitWanted = false;
  let hornOn = false;

  // ------------------------------------------------------------- build a car
  function makeVehicle(kind, x, y, z, rot, color) {
    if (!geo.body[kind]) { geo.body[kind] = makeCar(kind, { wheels: false }); geo.wheel[kind] = makeWheel(kind); }
    const info = carInfo(kind), type = CAR_TYPES[kind];
    const group = new THREE.Group();   // place and direction
    const tilt = new THREE.Group();    // body roll and pitch (the wheels stay on the road)
    group.add(tilt);
    // the body is an "instanced" mesh with one copy: that is how the shader gets the paint color
    const body = new THREE.InstancedMesh(geo.body[kind], mats.carPaint, 1);
    body.setMatrixAt(0, new THREE.Matrix4());
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(color), 3);
    body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
    tilt.add(body);
    // wheels: front left, front right, rear left, rear right (the car's left side is +x)
    const wheels = [];
    for (const wz of [info.wheelZ[1], info.wheelZ[0]]) {
      for (const sx of [1, -1]) {
        const steerNode = new THREE.Group();
        steerNode.position.set(sx * info.wheelX, info.wheelR, wz);
        const w = new THREE.Mesh(geo.wheel[kind], mats.carPaint);
        w.castShadow = true;
        if (sx < 0) w.rotation.y = Math.PI; // the same wheel, turned around for the other side
        steerNode.add(w);
        group.add(steerNode);
        wheels.push({ steerNode, mesh: w, front: wz > 0, sx });
      }
    }
    // driver's door: a painted panel that swings open around its front edge
    const d = info.door, dLen = d.z1 - d.z0, dH = d.y1 - d.y0;
    const doorGeo = new THREE.BoxGeometry(0.035, dH, dLen);
    doorGeo.translate(0, 0, -dLen / 2);
    const door = new THREE.Mesh(doorGeo, new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setRGB(color[0], color[1], color[2]), metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06,
    }));
    door.position.set(d.x, (d.y0 + d.y1) / 2, d.z1);
    door.castShadow = true;
    tilt.add(door);
    // brake lights: a red bar that gets very bright when braking
    const brakeMat = new THREE.MeshBasicMaterial({ color: 0x200000 });
    const brake = new THREE.Mesh(new THREE.BoxGeometry(info.tailW * 0.96, 0.055, 0.03), brakeMat);
    brake.position.set(0, info.tailY, info.backZ - 0.04);
    tilt.add(brake);
    // headlight beam: a soft patch of light lying on the road in front of the car
    const beamGeo = new THREE.PlaneGeometry(8, 19);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14, fog: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 0.04, info.frontZ + 9.3);
    beam.renderOrder = 13;
    beam.visible = false;
    group.add(beam);

    group.position.set(x, y, z);
    group.rotation.y = rot;
    scene.add(group);
    const v = {
      kind, info, type, group, tilt, body, wheels, door, brakeMat, beam, beamMat, color,
      x, y, z, heading: rot, vx: 0, vz: 0, steer: 0, roll: 0, pitch: 0, spin: 0, doorOpen: 0,
      forward: 0, slide: 0, braking: false, born: performance.now(),
    };
    live.push(v);
    return v;
  }

  function removeVehicle(v) {
    scene.remove(v.group);
    v.door.geometry.dispose(); v.door.material.dispose(); v.brakeMat.dispose(); v.beamMat.dispose();
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

  // ------------------------------------------------------- which car is near?
  function nearest(px, pz) {
    let best = null, bestD = ENTER_RANGE;
    for (const v of live) {
      if (v === active) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d < bestD) { bestD = d; best = { live: v, x: v.x, z: v.z }; }
    }
    for (const rec of city.parkedCars) {
      if (rec.taken) continue;
      const dx = rec.x - px, dz = rec.z - pz;
      if (Math.abs(dx) > ENTER_RANGE || Math.abs(dz) > ENTER_RANGE) continue;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = { parked: rec, x: rec.x, z: rec.z }; }
    }
    return best;
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
  // where the driver stands next to the car (left side first)
  function doorSpot(v) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const lx = fz, lz = -fx; // the car's left
    const side = v.info.halfWidth + 0.75;
    const tries = [[lx * side, lz * side], [-lx * side, -lz * side], [-fx * (v.info.length / 2 + 0.9), -fz * (v.info.length / 2 + 0.9)], [fx * (v.info.length / 2 + 0.9), fz * (v.info.length / 2 + 0.9)]];
    for (const [ox, oz] of tries) if (spotFree(v.x + ox, v.z + oz)) return { x: v.x + ox, z: v.z + oz };
    return { x: v.x + lx * side, z: v.z + lz * side };
  }

  // ------------------------------------------------------------ get in / out
  function tryEnter(player) {
    if (state !== 'none') return false;
    const near = nearest(player.position.x, player.position.z);
    if (!near) return false;
    active = near.live || takeParked(near.parked);
    state = 'entering'; stateTime = 0;
    active.vx = active.vz = 0;
    sound.doorClick();
    return true;
  }
  function requestExit() { if (state === 'driving') exitWanted = true; }

  // -------------------------------------------------------------- collisions
  // Push the car out of walls, props and other cars. Returns how hard it hit.
  const _n = { x: 0, z: 0 };
  function collide(v) {
    let impact = 0;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (let pass = 0; pass < 2; pass++) {
      for (const off of BODY_CIRCLES) {
        const cx = v.x + fx * off, cz = v.z + fz * off;
        const cell = city.colliders.near(cx, cz);
        let px = 0, pz = 0;
        for (const b of cell.boxes) {
          if (b.h < 0.3) continue;
          const qx = clamp(cx, b.minX, b.maxX), qz = clamp(cz, b.minZ, b.maxZ);
          let dx = cx - qx, dz = cz - qz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= BODY_R * BODY_R) continue;
          if (d2 > 1e-8) { const d = Math.sqrt(d2); px += (dx / d) * (BODY_R - d); pz += (dz / d) * (BODY_R - d); }
          else {
            // the middle of the circle is inside the box: leave through the nearest side
            const l = cx - b.minX, r = b.maxX - cx, n = cz - b.minZ, f = b.maxZ - cz, m = Math.min(l, r, n, f);
            if (m === l) px -= l + BODY_R; else if (m === r) px += r + BODY_R; else if (m === n) pz -= n + BODY_R; else pz += f + BODY_R;
          }
        }
        const hitCircle = (c) => {
          const dx = cx + px - c.x, dz = cz + pz - c.z, min = BODY_R + c.r, d2 = dx * dx + dz * dz;
          if (d2 >= min * min) return;
          const d = Math.sqrt(d2) || 0.001;
          px += (dx / d) * (min - d); pz += (dz / d) * (min - d);
        };
        for (const c of cell.circles) hitCircle(c);
        for (const c of city.colliders.dynamic || []) hitCircle(c);
        const len = Math.hypot(px, pz);
        if (len < 1e-5) continue;
        v.x += px; v.z += pz;
        // bounce: take away the speed that goes INTO the obstacle, give a little back
        _n.x = px / len; _n.z = pz / len;
        const vn = v.vx * _n.x + v.vz * _n.z;
        if (vn < 0) {
          v.vx -= 1.25 * vn * _n.x; v.vz -= 1.25 * vn * _n.z;
          const lose = clamp(1 - (-vn) * 0.03, 0.55, 1) * 0.985; // a hard hit also costs speed along the wall
          v.vx *= lose; v.vz *= lose;
          impact = Math.max(impact, -vn);
        }
      }
    }
    // the edge of the map is a soft wall
    if (v.x < B.minX + 1) { v.x = B.minX + 1; if (v.vx < 0) { impact = Math.max(impact, -v.vx); v.vx *= -0.25; } }
    if (v.x > B.maxX - 1) { v.x = B.maxX - 1; if (v.vx > 0) { impact = Math.max(impact, v.vx); v.vx *= -0.25; } }
    if (v.z < B.minZ + 1) { v.z = B.minZ + 1; if (v.vz < 0) { impact = Math.max(impact, -v.vz); v.vz *= -0.25; } }
    if (v.z > B.maxZ - 1) { v.z = B.maxZ - 1; if (v.vz > 0) { impact = Math.max(impact, v.vz); v.vz *= -0.25; } }
    return impact;
  }

  // ------------------------------------------------------------ one car step
  // drive: { steer -1..1 (right is +), gas 0..1, brake 0..1, handbrake }
  function physics(v, drive, dt) {
    const T = v.type, top = T.topSpeed / KMH;
    const wet = weather && weather.amount > 0.3 ? 0.8 : 1;
    // split the speed into "along the nose" and "sideways"
    let fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let fwd = v.vx * fx + v.vz * fz;
    const speed = Math.hypot(v.vx, v.vz);

    // ---- steering: quick at low speed, small and calm at high speed ----
    const maxSteer = 0.6 - 0.5 * smoothstep(0, 38, Math.abs(fwd));
    const target = drive.steer * maxSteer;
    v.steer = damp(v.steer, target, Math.abs(target) > Math.abs(v.steer) ? 5.5 : 9, dt);
    // how fast the car turns (a right turn makes the heading angle smaller)
    let yawRate = (-fwd * Math.tan(v.steer)) / v.info.wheelbase;
    if (drive.handbrake) yawRate *= 1.45;
    // tires can only hold so much: limit the turn at speed
    const maxLat = (drive.handbrake ? 17 : 11.5) * T.grip * wet;
    if (Math.abs(fwd) > 1) yawRate = clamp(yawRate, -maxLat / Math.abs(fwd), maxLat / Math.abs(fwd));
    v.heading += yawRate * dt;

    fx = Math.sin(v.heading); fz = Math.cos(v.heading);
    const rx = -fz, rz = fx; // the car's right
    fwd = v.vx * fx + v.vz * fz;
    let slide = v.vx * rx + v.vz * rz;

    // ---- engine, brakes, air ----
    let acc = 0;
    v.braking = false;
    if (drive.gas > 0.02) {
      if (fwd < -0.5) { acc += 12 * drive.gas; v.braking = true; }                 // rolling backward: brake first
      else acc += T.accel * drive.gas * Math.max(0, 1 - (fwd / top) ** 2) * (drive.handbrake ? 0.45 : 1);
    }
    if (drive.brake > 0.02) {
      if (fwd > 0.6) { acc -= 14 * drive.brake * wet; v.braking = true; v.stopped = 0; }   // brake
      else if (fwd > -0.3 && (v.stopped || 0) < 0.35) {
        // the car stands still for a moment before it starts to reverse
        v.stopped = (v.stopped || 0) + dt; v.braking = true;
        acc -= Math.sign(fwd) * Math.min(Math.abs(fwd) / dt, 14);
      } else acc -= T.accel * 0.6 * drive.brake * Math.max(0, 1 + fwd / 11);                // reverse (up to 40 km/h)
    } else v.stopped = 0;
    if (drive.handbrake) { acc -= Math.sign(fwd) * Math.min(Math.abs(fwd) / dt, 5.5); v.braking = true; }
    acc -= fwd * (0.035 + 0.0011 * Math.abs(fwd));                                  // air and rolling drag
    if (drive.gas < 0.02 && drive.brake < 0.02) acc -= Math.sign(fwd) * Math.min(Math.abs(fwd) / dt, 0.9);
    fwd += acc * dt;

    // ---- grip: the tires pull the sideways speed back to zero ----
    let grip = (drive.handbrake ? 1.1 : 7.5) * T.grip * wet;
    if (Math.abs(slide) > 4.5 && !drive.handbrake) grip *= 0.6; // once it slides, it keeps sliding for a moment
    slide *= Math.exp(-grip * dt);
    v.vx = fx * fwd + rx * slide;
    v.vz = fz * fwd + rz * slide;
    v.forward = fwd; v.slide = slide;

    // ---- move (in small steps when fast, so the car cannot jump through a wall) ----
    const steps = Math.max(1, Math.ceil((speed * dt) / 0.6));
    let impact = 0;
    for (let i = 0; i < steps; i++) {
      v.x += (v.vx * dt) / steps; v.z += (v.vz * dt) / steps;
      impact = Math.max(impact, collide(v));
    }
    if (impact > 1.6) {
      sound.thud(impact / 16);
      shake = Math.min(1, shake + impact * 0.045);
    }
    // follow the ground (curbs, the beach)
    const gy = (city.groundHeight(v.x + fx * 1.4, v.z + fz * 1.4) + city.groundHeight(v.x - fx * 1.4, v.z - fz * 1.4)) / 2;
    v.y = damp(v.y, gy, 16, dt);

    // ---- body movement: lean in corners, dip when braking, lift when speeding up ----
    const lat = fwd * yawRate; // sideways push (m/s2)
    v.roll = damp(v.roll, clamp(lat * 0.0075 * T.roll, -0.085, 0.085), 5, dt);
    v.pitch = damp(v.pitch, clamp(-acc * 0.0042 * T.roll, -0.035, 0.045), 5, dt);
    v.spin += (fwd * dt) / v.info.wheelR;
    return { acc, top };
  }

  // put the 3D object where the numbers say
  function place(v, night) {
    v.group.position.set(v.x, v.y, v.z);
    v.group.rotation.y = v.heading;
    v.tilt.rotation.set(v.pitch, 0, v.roll);
    for (const w of v.wheels) {
      if (w.front) w.steerNode.rotation.y = -v.steer;
      w.mesh.rotation.x = w.sx > 0 ? v.spin : -v.spin;
    }
    v.door.rotation.y = -v.doorOpen * 1.15;
    // lights
    const on = v === active && state !== 'none';
    const lamp = on ? night : 0;
    v.beam.visible = lamp > 0.02;
    v.beamMat.opacity = lamp * 0.95;
    const red = on && v.braking ? 5.0 : 0.12 + 1.1 * lamp;
    v.brakeMat.color.setRGB(red, red * 0.035, red * 0.02);
  }

  // --------------------------------------------------------------- every frame
  // drive: input for the car, player: the player object, night: 0..1 (lamps on)
  function update(dt, drive, player, night) {
    shake = Math.max(0, shake - dt * 2.6);
    const idle = { steer: 0, gas: 0, brake: 0, handbrake: true };
    if (state === 'entering') {
      // door opens, the player steps in, door closes
      stateTime += dt;
      const v = active;
      v.doorOpen = stateTime < 0.3 ? stateTime / 0.3 : Math.max(0, 1 - (stateTime - 0.45) / 0.3);
      if (stateTime > 0.38) player.setHidden(true);
      else {
        const s = doorSpot(v);
        player.glideTo(s.x, s.z, v.heading, dt);
      }
      if (stateTime > 0.75) { state = 'driving'; v.doorOpen = 0; sound.doorClick(); exitWanted = false; }
    } else if (state === 'exiting') {
      stateTime += dt;
      const v = active;
      v.doorOpen = stateTime < 0.3 ? stateTime / 0.3 : Math.max(0, 1 - (stateTime - 0.5) / 0.3);
      if (stateTime > 0.3 && player.hidden) {
        const s = doorSpot(v);
        player.place(s.x, s.z, v.heading);
        player.setHidden(false);
      }
      if (stateTime > 0.8) { state = 'none'; v.doorOpen = 0; active = null; sound.doorClick(); }
    }

    for (const v of live) {
      if (v === active && state === 'driving') {
        // the EXIT button first stops the car, then the door opens
        const input = exitWanted ? { steer: drive.steer, gas: 0, brake: v.forward > 0.5 ? 1 : 0, handbrake: Math.abs(v.forward) <= 0.5 || drive.handbrake } : drive;
        const r = physics(v, input, dt);
        if (exitWanted && Math.hypot(v.vx, v.vz) < 0.9) { v.vx = v.vz = 0; state = 'exiting'; stateTime = 0; exitWanted = false; sound.doorClick(); }
        // sounds: the engine "shifts" through five gears
        const ratio = clamp(Math.abs(v.forward) / r.top, 0, 0.999) * 5;
        const rev = 0.18 + 0.82 * (ratio < 1 ? ratio : 0.35 + 0.65 * (ratio % 1));
        sound.setEngine(true, rev, Math.max(input.gas, input.brake * (v.forward < 0.6 ? 1 : 0)));
        const sliding = Math.max(0, (Math.abs(v.slide) - 2.2) / 6) + (v.braking && Math.abs(v.forward) > 14 && input.brake > 0.8 ? 0.25 : 0);
        sound.setScreech(clamp(sliding, 0, 1));
        if (!!drive.horn !== hornOn) { hornOn = !!drive.horn; sound.setHorn(hornOn); }
        // the player object travels with the car (so the world knows where we are)
        player.place(v.x, v.z, v.heading);
      } else if (Math.abs(v.vx) + Math.abs(v.vz) > 0.01 || v === active) {
        physics(v, idle, dt); // a car without a driver rolls to a stop
      }
      place(v, night);
    }
    if (state !== 'driving') {
      sound.setEngine(false); sound.setScreech(0);
      if (hornOn) { hornOn = false; sound.setHorn(false); }
    }

    // ---- cars the player left behind: solid for the player and the traffic, and not too many ----
    const dyn = city.colliders.dynamic;
    const px = player.position.x, pz = player.position.z;
    for (let i = live.length - 1; i >= 0; i--) {
      const v = live[i];
      if (v === active) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      const extra = live.length - (active ? 1 : 0) > 5;
      if (!v.keep && (d > 320 || (extra && d > 90 && v === live.find((o) => o !== active && !o.keep)))) { removeVehicle(v); continue; }
      if (dyn && d < 40) {
        const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
        for (const off of BODY_CIRCLES) dyn.push({ x: v.x + fx * off, z: v.z + fz * off, r: BODY_R });
      }
    }
  }

  // (a plain object with "get" functions: the values are read fresh every time)
  return {
    live, nearest, tryEnter, requestExit, update,
    // a new car at a fixed place (used by missions). keep = it never disappears by itself.
    spawn(kind, x, z, rot, color, keep = true) {
      const v = makeVehicle(kind, x, city.groundHeight(x, z), z, rot, color);
      v.keep = keep;
      place(v, 0);
      return v;
    },
    get active() { return active; },
    get state() { return state; },
    get driving() { return state === 'driving' || state === 'exiting'; },
    get shake() { return shake; },
    // km/h of the car the player drives
    get speedKmh() { return active ? Math.hypot(active.vx, active.vz) * KMH : 0; },
  };
}
