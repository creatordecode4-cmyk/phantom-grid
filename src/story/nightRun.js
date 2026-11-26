// ---------------------------------------------------------------------------
// nightRun.js - THE NIGHT RUN (Chapter 8, "Talk to Zero"): Ironhill Highway at night, in the rain, going north.
//
//   ZERO beside Nate. Its ways of driving ("modes"):
//     appear   comes out of the dark far behind him, its soft glow growing, and settles 40 m back (like the proximity
//              system of Chapter 4)
//     follow   stays about 40 m behind, in his lane, at his speed
//     lead     passes him and drives ahead at its own steady pace: he must keep up without losing it
//     beside   rides next to him, one lane over, at a calm steady pace; he must hold the two cars side by side
//     cruise   (film scenes) exactly next to him while the story drives his car too ("autopilot")
//     guard    (the chase) drops back between him and the Phantoms
//     block    (the chase) a silent move: it comes up beside the nearest Phantom and touches it; the Phantom spins
//              into the crash wall (no fire, no gore)
//     away     brakes, turns round and drives back south into the dark, its glow fading
//   Its light is a soft, calm glow (never a flashing police light): a halo around the car, a pale pool on the road,
//   and the rain drops around it lit (weather.js). Its engine is heard in time with Nate's (sound.rivals).
//
//   THE PHANTOMS of KVI: police cars with flashing lights, chasing on the raised road. At most two at once (the next
//   one waits until one is out). They close in from behind and try to come up on both sides; they steer round Zero.
//   If Nate slows right down with one of them close, he is caught (the story fails the mission).
//   Their DRONES hover over the road behind him with searchlights; they stop at the mouth of the tunnel.
//
//   THE METERS of the missions: seconds over 150 km/h (seen), seconds with Zero in reach while it leads (matched),
//   and how steady the two cars are side by side (steady, 0..1: the gentle hack of Lena runs while it is high).
//
//   THE REWIND: at the cut of a film scene everything of the run is moved back south along the straight road (the
//   highway looks the same all along it), so a long talk at speed never runs out of road. If a mission goes on so
//   long that Nate comes near the closed end of the road, the picture dips to black for a moment and the run is
//   moved back the same way (like a cut in a film).
//
// The story drives it with { do: 'run', ... } and { do: 'runGoal', ... } steps (engine.js). Places are on the
// "ironhill" arena of engine.js (the whole highway, the tunnel, the closed end).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { stepSimpleCar } from '../vehicles/physics.js';
import { spawnZeroCar, spinOutCar } from '../ai/zero.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KMH = 3.6;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const GLOW = [0.62, 0.84, 1.0];          // Zero's light: a pale, cold blue-white

// a soft round spot (for the halo and the pool on the road)
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.55)'); r.addColorStop(0.65, 'rgba(255,255,255,0.14)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createNightRun({ scene, vehicles, sound, music, effects, weather, rig, ui, layout, props }) {
  const H = layout.highway, T = H.tunnel, cx = H.centerX;
  // the lanes: 0 = next to the middle line .. 2 = next to the crash wall; dir +1 = northbound (on the -x side)
  const laneX = (i, dir) => cx - dir * (2.1 + 4.15 * i);
  const fx = { vehicles, sound, effects };

  let on = false, arena = null, dir = 1, clock = 0;
  const events = [];
  const say = (e) => events.push(e);

  // ---------------------------------------------------------------- the player's car
  const playerCar = () => (vehicles.state === 'driving' ? vehicles.active : null);
  let cruiseOn = null;                            // { lane, speed (m/s), x (exact place across the road, optional) }
  const speedOf = (v) => (v ? Math.hypot(v.vx, v.vz) : 0);

  // ---------------------------------------------------------------- ZERO
  const Z = { v: null, mode: 'off', t: 0, glow: 0, glowWant: 0, base: 0, side: 1, gap: 40, blockT: 0, target: null, away: null, lost: 0, wasNear: false };
  let tex = null, halo = null, pool = null;
  function makeGlow(v) {
    if (!tex) tex = glowTexture();
    if (!halo) {
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color().setRGB(GLOW[0], GLOW[1], GLOW[2]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(12, 6, 1); halo.renderOrder = 19;
      pool = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 10), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setRGB(GLOW[0] * 0.8, GLOW[1] * 0.9, GLOW[2]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10 }));
      pool.rotation.x = -Math.PI / 2; pool.renderOrder = 14;
    }
    halo.position.set(0, 1.05, 0); pool.position.set(0, 0.06, 0.3);
    v.group.add(halo); v.group.add(pool);
  }
  function spawnZero(x, z, heading) {
    removeZero();
    const v = spawnZeroCar(vehicles, x, z, heading, arena);
    if (!v) return null;
    v.ghost = true;                               // (it never touches anything by itself: only the story's block does)
    v.kin = false;
    v.storyId = 'zero';
    makeGlow(v);
    Z.v = v; Z.t = 0; Z.glow = 0; Z.lost = 0; Z.wasNear = false;
    return v;
  }
  function removeZero() {
    if (Z.v) {
      if (halo && halo.parent) halo.parent.remove(halo);
      if (pool && pool.parent) pool.parent.remove(pool);
      if (vehicles.live.includes(Z.v)) vehicles.removeVehicle(Z.v);
    }
    Z.v = null; Z.mode = 'off';
    weather.setGlow(null);
    music.setZero(0);
  }

  // which side of him Zero rides on: toward the middle line, unless that would take it across the line
  const besideSide = (pc) => (dir > 0 ? (pc.x + 4.2 <= cx - 1.0 ? 1 : -1) : (pc.x - 4.2 >= cx + 1.0 ? -1 : 1));
  // drive Zero toward a place across the road (x) at a speed (m/s): steers for a point ahead on that line
  function drive(v, x, want, dt) {
    const sp = speedOf(v), d = Math.sign(Math.cos(v.heading)) || dir;
    stepSimpleCar(v, x, v.z + d * (9 + sp * 0.45), Math.max(0, want), dt, vehicles.world);
    v.braking = v.forward > want + 1.5;
    v.spin += (v.forward * dt) / (v.info.wheelR || 0.33);
  }

  // ZERO's driving, every frame (as the car's own "ai", so it moves with the physics of every other car)
  function zeroAI(v, dt) {
    const pc = playerCar() || cruiseCar();
    Z.t += dt;
    if (!pc) { drive(v, v.x, 0, dt); return; }
    const pS = speedOf(pc), along = (pc.z - v.z) * dir;      // (+: Nate is ahead of Zero)
    const pLane = clamp(Math.round((Math.abs(pc.x - cx) - 2.1) / 4.15), 0, 2);
    const m = Z.mode;
    if (m === 'appear' || m === 'follow') {
      // its glow grows as it comes nearer out of the dark; it settles about 40 m back, in his lane
      const gap = m === 'appear' ? 40 : Z.gap;
      const want = pS + clamp((along - gap) * 0.7, -10, 14);
      drive(v, laneX(pLane, dir), want, dt);
      Z.glowWant = m === 'appear' ? clamp(1.25 - (along - 40) / 70, 0.15, 1) : 1;
      if (m === 'appear' && along < 60 && Z.t > 2.5) { Z.mode = 'follow'; say('zeroHere'); }
    } else if (m === 'lead') {
      // it passes on the inside lane, then keeps its own steady pace ahead; it never runs away for good: far ahead
      // it waits a little, and when he is right behind it, it pulls away a little
      const lane = 0, ahead = -along;                        // (meters Zero is ahead of him)
      let want = Z.base + Math.sin(Z.t * 0.35) * 1.2;
      // (still behind him: it comes up past him quickly, then settles a little ahead)
      if (ahead < -6) want = Math.max(want, pS + 13);
      else if (ahead < 22) want = Math.max(want, pS + 6);
      else if (ahead > 95) want = Math.min(want, pS - 2);
      else if (ahead > 70) want = Math.min(want, pS + 1);
      drive(v, laneX(lane, dir), want, dt);
      Z.glowWant = 1;
    } else if (m === 'beside' || m === 'cruise') {
      // next to him, one lane toward the middle (or toward the wall when he drives in the inside lane)
      Z.side += (besideSide(pc) - Z.side) * Math.min(1, dt * 0.6);
      const wantX = clamp(pc.x + Z.side * 4.2, H.minX + 1.6, H.maxX - 1.6);
      if (m === 'cruise') {
        // (a film scene: exactly beside him, breathing a little forward and back)
        // (from wherever it was it eases into its place - never faster than a car could: at most 12 m/s closer)
        const tz = pc.z + dir * (Math.sin(Z.t * 0.4) * 0.6 - 0.4);
        v.x += clamp((wantX - v.x) * Math.min(1, dt * 2.5), -2.2 * dt, 2.2 * dt);
        v.z += clamp((tz - v.z) * Math.min(1, dt * 3), -12 * dt, 12 * dt) + pc.vz * dt;
        v.heading = pc.heading; v.forward = pS; v.vx = pc.vx; v.vz = pc.vz;
        v.y = vehicles.world.ground(v.x, v.z);
        v.spin += (pS * dt) / (v.info.wheelR || 0.33);
      } else {
        // its own calm pace, drawn a little toward him (so he can find it again), and it moves away if he swerves at it
        let want = Z.base + Math.sin(Z.t * 0.23) * 0.9 + clamp(along * 0.33, -7, 7);
        if (pS < 8) want = Math.min(want, 6);
        let x = wantX;
        if (Math.abs(pc.x - v.x) < 3.2 && Math.abs(along) < 6) x = clamp(v.x + Math.sign(v.x - pc.x || 1) * 3, H.minX + 1.4, H.maxX - 1.4);
        drive(v, x, want, dt);
      }
      Z.glowWant = 1;
    } else if (m === 'guard') {
      // behind him, in the lane of the nearest Phantom: whoever wants him must go round Zero
      const ph = nearestPhantom(pc);
      const lane = ph ? clamp(Math.round((Math.abs(ph.v.x - cx) - 2.1) / 4.15), 0, 2) : pLane;
      const want = pS + clamp((along - 13) * 0.9, -12, 9);
      drive(v, laneX(lane, dir), want, dt);
      Z.glowWant = 1;
    } else if (m === 'block') {
      // up beside the nearest Phantom (on its inside), and one quiet touch
      Z.blockT += dt;
      const ph = Z.target && Z.target.state !== 'out' ? Z.target : (Z.target = nearestPhantom(pc));
      if (!ph) { Z.mode = 'guard'; return; }
      const pv = ph.v, rel = (pv.z - v.z) * dir;              // (+: the Phantom is ahead of Zero)
      // (on its inside: the side toward the middle line; the touch then sends it toward its own crash wall)
      const sideX = pv.x + (pv.x < cx ? 2.6 : -2.6);
      const want = speedOf(pv) + clamp(rel * 1.2, -18, 16);      // (it drops back hard: the move takes a few seconds)
      drive(v, sideX, want, dt);
      const dx = Math.abs(pv.x - v.x), dz = Math.abs(pv.z - v.z);
      if ((dx < 3.6 && dz < 3.4) || (Z.blockT > 5 && Math.hypot(pv.x - v.x, pv.z - v.z) < 30)) {
        // the touch: the Phantom spins toward the crash wall on its own side and slides into it
        spinOutCar(pv, v, fx, pv.x < cx ? -1 : 1);
        ph.state = 'out'; ph.outT = 0;
        Z.mode = 'guard'; Z.target = null;
        say('blocked');
      }
      Z.glowWant = 1;
    } else if (m === 'away') {
      // it brakes, turns round in a slow arc and goes back into the dark, faster and faster; its glow fades
      const A = Z.away || (Z.away = { h: wrapA(v.heading + Math.PI), u: 0 });
      A.u = Math.min(1, A.u + dt / 2.6);
      const sp = A.u < 1 ? Math.max(3.5, speedOf(v) - 14 * dt) : Math.min(48, speedOf(v) + 7 * dt);
      v.heading += wrapA(A.h - v.heading) * Math.min(1, dt * 1.6 * (0.25 + A.u));
      v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
      v.x = clamp(v.x + v.vx * dt, H.minX + 1.5, H.maxX - 1.5); v.z += v.vz * dt;
      v.y = vehicles.world.ground(v.x, v.z);
      v.spin += (sp * dt) / (v.info.wheelR || 0.33);
      Z.glowWant = clamp(1 - (Z.t - 2.5) / 4.5, 0, 1);
      if (Z.t > 4.5) v.lights = 'off';
      if (Z.t > 11 || Math.hypot(v.x - pc.x, v.z - pc.z) > 260) { removeZero(); say('zeroGone'); }
    }
  }
  function setZeroMode(mode, o = {}) {
    const pc = playerCar() || cruiseCar();
    if (mode === 'off' || mode === 'hide') { removeZero(); return; }
    if (!Z.v) {
      if (!pc) return;
      // (it starts far behind him, out of the light of his car - or, for a film scene, right where it should be)
      const back = mode === 'appear' ? 115 : mode === 'cruise' || mode === 'beside' ? 0 : 40;
      const pLane = clamp(Math.round((Math.abs(pc.x - cx) - 2.1) / 4.15), 0, 2);
      const x = back ? laneX(pLane, dir) : clamp(pc.x + besideSide(pc) * 4.2, H.minX + 1.6, H.maxX - 1.6);
      const v = spawnZero(x, pc.z - dir * back, pc.heading);
      if (!v) { say('zeroGone'); return; }
      const sp = speedOf(pc) * (back ? 0.95 : 1);
      v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
      v.lights = mode === 'appear' ? 'off' : 'bar';
      if (mode === 'appear') Z.glow = 0; else Z.glow = 1;
    } else if (o.snap && pc && (mode === 'cruise' || mode === 'beside')) {
      // (snap, at a cut: it is put right beside him again at his speed, however far back the chase left it)
      const v = Z.v;
      v.x = clamp(pc.x + besideSide(pc) * 4.2, H.minX + 1.6, H.maxX - 1.6); v.z = pc.z; v.heading = pc.heading;
      v.y = vehicles.world.ground(v.x, v.z);
      const sp = speedOf(pc);
      v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
      Z.glow = 1;
    }
    Z.mode = mode; Z.t = 0; Z.away = null; Z.blockT = 0; Z.target = null;
    if (o.speed) Z.base = o.speed / KMH;
    else if (mode === 'lead' || mode === 'beside') Z.base = Math.max(speedOf(pc), mode === 'lead' ? 44 : 33);
    if (o.gap) Z.gap = o.gap;
    if (mode !== 'appear') Z.v.lights = 'bar';
    Z.v.ai = (v, dt) => zeroAI(v, dt);
    Z.v.aiInfo = null;
    if ((mode === 'cruise' || mode === 'beside') && pc) Z.side = besideSide(pc);
    // (its headlights lie on the road beside his: "beamOn" shows the light of a car nobody drives. The light is soft and
    //  calm (beamK), and it is off while Zero rides close behind him (guard, block): no white flood around his car)
    Z.v.beamOn = mode !== 'away' && mode !== 'appear' && mode !== 'guard' && mode !== 'block';
    Z.v.beamK = 0.5;
  }

  // ---------------------------------------------------------------- THE PHANTOMS
  const PH = [];                                   // { v, state: 'hunt' | 'press' | 'out' | 'lost', side, t, outT }
  let phQueue = 0, phTotal = 0, caughtT = 0, phOn = false;
  const nearestPhantom = (pc) => {
    let best = null, bd = 1e9;
    for (const p of PH) { if (p.state === 'out' || p.state === 'lost') continue; const d = Math.hypot(p.v.x - pc.x, p.v.z - pc.z); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  function spawnPhantom(back) {
    const pc = playerCar() || cruiseCar();
    if (!pc) return null;
    const n = PH.length, lane = [1, 0, 2][n % 3];
    // (the patrol car in its own paint: [1, 1, 1] keeps the colors of the model)
    const v = vehicles.spawn('tech_patrol_car', laneX(lane, dir), pc.z - dir * back, pc.heading, [1, 1, 1], { keep: true, npc: true, noDetail: true, arena })
      || vehicles.spawn('sedan', laneX(lane, dir), pc.z - dir * back, pc.heading, [0.02, 0.02, 0.03], { keep: true, npc: true, arena });
    if (!v) return null;
    v.type = { ...v.type, topSpeed: 245 };
    v.label = 'PHANTOM'; v.siren = true; v.storyId = 'ph' + (n + 1);
    const sp = speedOf(pc) + 6;
    v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
    const P = { v, state: 'hunt', side: n % 2 ? 1 : -1, t: 0, outT: 0, id: v.storyId };
    v.ai = (car, dt) => phantomAI(P, car, dt);
    PH.push(P);
    say('phantom:' + P.id);
    return P;
  }
  function phantomAI(P, v, dt) {
    const pc = playerCar() || cruiseCar();
    P.t += dt;
    if (!pc || P.state === 'lost') { drive(v, v.x, 0, dt); return; }
    const pS = speedOf(pc), along = (pc.z - v.z) * dir;      // (+: Nate is ahead)
    // close in fast from behind; then press: a car length or two back, on one side of him
    if (P.state === 'hunt' && along < 26) P.state = 'press';
    let want, x;
    if (P.state === 'hunt') {
      want = pS + clamp((along - 10) * 0.55, -6, 22);
      x = laneX(clamp(Math.round((Math.abs(pc.x - cx) - 2.1) / 4.15), 0, 2), dir);
    } else {
      const holdBack = 5 + 3 * (P.side > 0 ? 1 : 0) + Math.sin(P.t * 0.7) * 2;
      want = pS + clamp((along - holdBack) * 0.8, -9, 9);
      x = pc.x + P.side * 4.0;
      if (x < H.minX + 1.8 || x > H.maxX - 1.8) { P.side = -P.side; x = pc.x + P.side * 4.0; }
    }
    // Zero in the way: go round it on the other side, and ease off a little
    if (Z.v && Z.mode !== 'away') {
      const za = (Z.v.z - v.z) * dir, zl = Z.v.x - v.x;
      if (za > -2 && za < 16 && Math.abs(zl) < 2.8) { x = Z.v.x + (zl > 0 ? -3.6 : 3.6); want = Math.min(want, speedOf(Z.v) - 1); }
    }
    drive(v, clamp(x, H.minX + 1.4, H.maxX - 1.4), want, dt);
  }
  function phantomsUpdate(dt) {
    if (!phOn) return;
    const pc = playerCar() || cruiseCar();
    let active = 0;
    for (const P of PH) {
      if (!vehicles.live.includes(P.v)) { P.state = 'lost'; continue; }
      if (P.state === 'out') { P.outT += dt; continue; }
      if (P.state !== 'lost') active++;
    }
    // (at most two chase at once: the next one comes when one is out)
    if (active < 2 && phQueue > 0 && pc) { phQueue--; spawnPhantom(170); }
    // CAUGHT: he slows right down with a Phantom close by
    if (pc) {
      let close = false;
      for (const P of PH) if ((P.state === 'press' || P.state === 'hunt') && Math.hypot(P.v.x - pc.x, P.v.z - pc.z) < 10) close = true;
      caughtT = close && speedOf(pc) * KMH < 45 ? caughtT + dt : Math.max(0, caughtT - dt * 2);
      if (caughtT > 2.6) { caughtT = 0; say('caught'); }
    }
  }
  function phantomsGiveUp() {
    for (const P of PH) if (P.state !== 'out') { P.state = 'lost'; P.v.siren = false; }
  }
  function removePhantoms() {
    for (const P of PH) if (vehicles.live.includes(P.v)) vehicles.removeVehicle(P.v);
    PH.length = 0; phQueue = 0; phOn = false; caughtT = 0;
  }

  // ---------------------------------------------------------------- the drones over the road
  const drones = [];
  function spawnDrones(n) {
    removeDrones();
    const pc = playerCar() || cruiseCar();
    for (let i = 0; i < n; i++) {
      const g = props.make('policeDrone', {});
      const at = pc ? [pc.x + (i ? 6 : -6), H.height + 22, pc.z - dir * (70 + i * 25)] : [cx, 30, 0];
      g.position.set(at[0], at[1], at[2]);
      scene.add(g);
      drones.push({ g, i, stop: false, t: Math.random() * 6 });
    }
  }
  function dronesUpdate(dt, time) {
    if (!drones.length) return;
    const pc = playerCar() || cruiseCar();
    for (const d of drones) {
      d.t += dt;
      if (d.g.userData.anim) d.g.userData.anim(time);
      if (!pc) continue;
      // over the road, behind him, a little apart; they cannot follow into the tunnel (they hover at its mouth)
      let tz = pc.z - dir * (26 + d.i * 16), tx = pc.x + (d.i ? 5 : -5) + Math.sin(d.t * 0.6 + d.i) * 2;
      if (T && dir > 0 && tz > T.z0 - 12) { tz = T.z0 - 12 - d.i * 8; d.stop = true; }
      const p = d.g.position, k = Math.min(1, dt * (d.stop ? 0.8 : 1.6));
      p.x += (tx - p.x) * k; p.z += (tz - p.z) * k;
      p.y += (H.height + 22 + Math.sin(d.t * 1.1 + d.i) * 0.6 - p.y) * Math.min(1, dt * 2);
      d.g.rotation.y = Math.atan2(pc.x - p.x, pc.z - p.z);
    }
  }
  function removeDrones() {
    for (const d of drones) {
      scene.remove(d.g);
      d.g.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material && m.material.dispose) m.material.dispose(); } });
    }
    drones.length = 0;
  }
  // how near the nearest drone is (0..1, for its buzz)
  function droneNear(cam) {
    let k = 0;
    for (const d of drones) k = Math.max(k, clamp(1 - Math.hypot(d.g.position.x - cam.x, d.g.position.z - cam.z) / 70, 0, 1));
    return k;
  }

  // ---------------------------------------------------------------- the story drives his car (film scenes)
  // (the story's own car when he is not "driving" it: the run keeps working in a film scene)
  let storyCar = null;
  const cruiseCar = () => storyCar;
  function cruiseUpdate() {
    const c = playerCar() || storyCar;
    if (!cruiseOn || !c) return;
    const want = cruiseOn.speed, sp = speedOf(c);
    const tx = cruiseOn.x !== undefined ? cruiseOn.x : laneX(cruiseOn.lane, dir);
    // stay on the line: aim a little toward it, steer to that heading
    const aim = dir > 0 ? clamp((tx - c.x) * 0.09, -0.2, 0.2) : Math.PI + clamp(-(tx - c.x) * 0.09, -0.2, 0.2);
    const d = wrapA(aim - c.heading);
    vehicles.autoDrive = {
      steer: clamp(-d * 2.6, -1, 1), gas: sp < want ? clamp((want - sp) / 4, 0.12, 1) : 0, brake: sp > want + 1.2 ? clamp((sp - want) / 6, 0.1, 0.6) : 0,
      handbrake: false, nitro: false, up: false, down: false, horn: false,
    };
  }

  // ---------------------------------------------------------------- the meters
  const M = { seen: 0, matched: 0, lostFor: 0, steady: 0, zeroDist: 0 };
  function metersUpdate(dt) {
    const pc = playerCar();
    const kmh = pc ? speedOf(pc) * KMH : 0;
    if (kmh > 150) M.seen += dt;
    M.zeroDist = Z.v && pc ? Math.hypot(Z.v.x - pc.x, Z.v.z - pc.z) : 999;
    if (Z.v && pc && Z.mode === 'lead') {
      const inReach = M.zeroDist < 75;
      if (inReach) { M.matched += dt; if (M.lostFor > 2.5) say('found'); M.lostFor = 0; }
      else { M.lostFor += dt; if (M.lostFor > 2.5 && M.lostFor - dt <= 2.5) say('lost'); }
    }
    // SIDE BY SIDE: how close to the right place the two cars are: level with each other, one lane apart, the same speed
    if (Z.v && pc && (Z.mode === 'beside' || Z.mode === 'cruise')) {
      const lon = Math.abs((Z.v.z - pc.z)), lat = Math.abs(Z.v.x - pc.x), dv = Math.abs(speedOf(Z.v) - speedOf(pc)) * KMH;
      const bad = Math.max((lon - 2.8) / 6.5, (Math.abs(lat - 4.2) - 0.9) / 2.4, (dv - 7) / 20, kmh < 55 ? 1 : 0, 0);
      const s = clamp(1 - bad, 0, 1);
      M.steady += (s - M.steady) * Math.min(1, dt * 4);
    } else M.steady += (0 - M.steady) * Math.min(1, dt * 4);
  }

  // ---------------------------------------------------------------- the rewind
  function rewind(toZ) {
    const pc = playerCar() || storyCar;
    if (!pc) return 0;
    const dz = toZ - pc.z;
    if (Math.abs(dz) < 0.5) return 0;
    const move = (v) => { if (!v) return; v.z += dz; if (v.p0z !== undefined) v.p0z += dz; if (v.rz !== undefined) v.rz += dz; };
    move(pc);
    if (Z.v) move(Z.v);
    for (const P of PH) if (P.state !== 'out' && vehicles.live.includes(P.v)) move(P.v);
    for (const d of drones) d.g.position.z += dz;
    rig.shift(0, 0, dz);
    say('rewind');
    return dz;
  }
  let autoRewind = null, dipping = 0;
  function autoRewindUpdate(dt) {
    const pc = playerCar();
    if (dipping > 0) {
      dipping -= dt;
      if (dipping <= 0.6 && dipping + dt > 0.6 && autoRewind) rewind(autoRewind.to);
      if (dipping <= 0) ui.fade('black', 0, 0.7);
      return;
    }
    if (!autoRewind || !pc) return;
    if (pc.z * dir > autoRewind.at * dir && Math.cos(pc.heading) * dir > 0.3) { dipping = 1.2; ui.fade('black', 1, 0.5); }
  }

  // ---------------------------------------------------------------- every frame
  let tunnelWas = false, nearWas = false;
  function update(dt, time) {
    if (!on) return;
    clock += dt;
    // (the run is over when the story removed the cars)
    if (Z.v && !vehicles.live.includes(Z.v)) { Z.v = null; Z.mode = 'off'; weather.setGlow(null); }
    cruiseUpdate();
    phantomsUpdate(dt);
    dronesUpdate(dt, time);
    metersUpdate(dt);
    autoRewindUpdate(dt);
    const pc = playerCar() || storyCar;
    // in and out of the tunnel
    if (pc && T) {
      const inT = pc.z > T.z0 && pc.z < T.z1;
      if (inT !== tunnelWas) { tunnelWas = inT; say(inT ? 'tunnelIn' : 'tunnelOut'); }
      // (150 m before the south mouth: "tunnelNear" - a moment that should happen AT the tunnel starts here, because at
      //  200 km/h the 320 m of the tunnel go by in six seconds)
      const near = pc.z > T.z0 - 150 && pc.z < T.z1;
      if (near && !nearWas) say('tunnelNear');
      nearWas = near;
    }
    // ZERO's glow: it breathes slowly; the rain around it is lit; its engine goes with his
    if (Z.v) {
      Z.glow += (Z.glowWant - Z.glow) * Math.min(1, dt * (Z.glowWant > Z.glow ? 0.7 : 1.2));
      const breath = 0.86 + 0.14 * Math.sin(clock * 1.25);
      const g = Z.glow * breath;
      if (halo) { halo.material.opacity = 0.08 * g; pool.material.opacity = 0.34 * g; }
      if (Z.glow > 0.3 && Z.v.lights === 'off' && Z.mode !== 'away') Z.v.lights = 'bar';
      weather.setGlow([Z.v.x, Z.v.y + 1.3, Z.v.z], [GLOW[0] * 1.6 * g, GLOW[1] * 1.6 * g, GLOW[2] * 1.6 * g], 8.5);
      // the deep slow heartbeat of Chapter 4 while it follows and leads; quiet when it is beside him
      const d = pc ? Math.hypot(Z.v.x - pc.x, Z.v.z - pc.z) : 999;
      music.setZero(Z.mode === 'follow' || Z.mode === 'appear' ? clamp(1 - (d - 30) / 90, 0, 1) * 0.7 : 0);
    }
    // the engines of the others: Zero in time with his, the Phantoms
    if (pc) {
      const list = [];
      const rpm = pc.rpm || 2400, gas = pc.fx ? pc.fx.throttle : 0.4;
      if (Z.v && Z.mode !== 'away') list.push({ d: Math.hypot(Z.v.x - pc.x, Z.v.z - pc.z), rpm, gas: Math.max(0.3, gas), tone: 'smooth', closing: 0 });
      for (const P of PH) if (P.state !== 'out' && vehicles.live.includes(P.v)) {
        const v = P.v, d = Math.hypot(v.x - pc.x, v.z - pc.z);
        list.push({ d, rpm: 2600 + speedOf(v) * 60, gas: 0.8, tone: 'muscle', closing: ((v.vx - pc.vx) * (pc.x - v.x) + (v.vz - pc.vz) * (pc.z - v.z)) / Math.max(1, d) });
      }
      list.sort((a, b) => a.d - b.d);
      sound.rivals(list.slice(0, 2));
    }
  }

  // ---------------------------------------------------------------- start / stop
  function start(o = {}) {
    on = true; dir = o.dir || 1; arena = o.arena || null; clock = 0;
    M.seen = 0; M.matched = 0; M.lostFor = 0; M.steady = 0;
    tunnelWas = false; nearWas = false;
  }
  function stop() {
    removeZero(); removePhantoms(); removeDrones();
    if (cruiseOn) { cruiseOn = null; vehicles.autoDrive = null; }
    storyCar = null; autoRewind = null; dipping = 0;
    sound.rivals([]);
    events.length = 0;
    on = false;
  }

  return {
    start, stop, update, rewind,
    get on() { return on; },
    // ZERO: mode = 'appear' | 'follow' | 'lead' | 'beside' | 'cruise' | 'guard' | 'block' | 'away' | 'off'
    zero(mode, o) { setZeroMode(mode, o); },
    get zeroCar() { return Z.v; },
    get zeroMode() { return Z.mode; },
    // THE PHANTOMS: n in all (at most 2 at once), arriving from far behind
    phantoms(n, o = {}) {
      if (n === 0 || n === 'stop') { removePhantoms(); return; }
      if (n === 'giveUp') { phantomsGiveUp(); return; }
      phOn = true; phTotal = n; phQueue = n;
      const first = Math.min(2, n);
      for (let i = 0; i < first; i++) { phQueue--; spawnPhantom((o.back || 150) + i * 24); }
    },
    get phantomCars() { return PH.map((P) => P.v); },
    get phantomsActive() { return PH.filter((P) => P.state === 'hunt' || P.state === 'press').length; },
    drones(n) { if (n) spawnDrones(n); else removeDrones(); },
    droneNear,
    // the story drives his car: { lane, speed (km/h), x } or null
    cruise(o) {
      if (!o) { cruiseOn = null; vehicles.autoDrive = null; return; }
      cruiseOn = { lane: o.lane === undefined ? 1 : o.lane, speed: (o.speed || 90) / KMH, x: o.x };
    },
    setStoryCar(v) { storyCar = v || null; },
    // a dip to black and the rewind when he comes near the end of the road: { at: z, to: z } or null
    autoRewind(o) { autoRewind = o || null; },
    get meters() { return M; },
    get steady() { return M.steady; },
    meterReset(k) { if (k in M) M[k] = 0; },
    takeEvents() { return events.splice(0); },
    // (tests)
    get info() {
      const pc = playerCar();
      return { on, zero: Z.mode, zeroDist: +M.zeroDist.toFixed(1), seen: +M.seen.toFixed(1), matched: +M.matched.toFixed(1), steady: +M.steady.toFixed(2), glow: +Z.glow.toFixed(2),
        ph: PH.map((P) => P.state + ':' + (pc ? Math.round(Math.hypot(P.v.x - pc.x, P.v.z - pc.z)) : '-')), queue: phQueue, drones: drones.length, z: pc ? Math.round(pc.z) : null, kmh: pc ? Math.round(speedOf(pc) * KMH) : 0 };
    },
  };
}
