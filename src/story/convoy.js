// ---------------------------------------------------------------------------
// convoy.js - THE CONVOY (Chapter 9, "Harrow's Line"): a Meridian Guard prison convoy on Ironhill Highway at night,
// going north, away from the city, toward the Ironhill tunnel (dir +1; dir -1 would be south). Dante is in the
// armored truck.
//
//   THE CARS (spawned by the story, handed over by their story names):
//     truck    the armored prison truck in the middle lane. Dante is inside: hard hits hurt him (its load, see
//              src/vehicles/cargo.js, kind 'inside')
//     escorts  two Guard patrol coupes behind the truck, one on each side. They defend it: the one on Nate's side
//              drops back into his lane in front of him and brakes, and leans into him when he comes alongside.
//              They stay on their own half of the road: on the empty other half a quick driver can get past them
//     lead     a Guard tech car 34 m ahead of the truck. It does not fight. Nate may spare it, ram it or trap it
//   One SURVEILLANCE DRONE hangs over the truck with its searchlight.
//
//   HOW A GUARD CAR IS TAKEN OUT (no gore, no weapons: only driving)
//     ram     two or three solid hits (or the car is badly damaged): it pulls over smoking
//     spin    hit at a back corner it turns across the road: it slides and stops by the crash wall
//     block   Nate in front of it, braking: when it has been held under 35 km/h for a moment, it gives up and stops
//     gate    trapped behind the bridge gate that Lena's hack closes after Nate has gone through
//
//   THE TRUCK can only be stopped when both escorts are out: Nate (or Mace's van) gets in front of it in its lane and
//   slows down; the driver will not ram a car with a prisoner in the back, so the truck slows with him. It tries to
//   go round a few times. Held under 7 km/h for a moment, it stops. It also stops at the closed gate.
//
//   THE BRIDGE GATE: a Guard gantry over the southbound lanes. When Nate comes toward it, the story offers a HACK;
//   while the fingers draw, the van keeps its lane and speed by itself and the world runs slower. Once hacked, the
//   gate closes as soon as Nate has passed under it, and every convoy car behind it stops at the boom.
//
//   MACE'S VAN (when Mace drives support): when both escorts are out it comes up fast, gets in front of the truck
//   and slows it down with Nate.
//
//   THE REWIND: the road north ends a little past the tunnel. When the truck comes out of it, the picture dips to
//   black for a moment and everything of the chase is moved back south along the straight road (like a cut).
//   stage(z): the same, at a cut of a film scene: the stopped truck is put at z (the trap of the story).
//
// The story drives it with { do: 'convoy', ... } and { do: 'convoyGoal', ... } (engine.js). Every event it has is
// passed to the story as 'convoy:<event>'.
// ---------------------------------------------------------------------------

import { stepSimpleCar, stepCar } from '../vehicles/physics.js';
import { spinOutCar } from '../ai/zero.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KMH = 3.6;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const speedOf = (v) => (v ? Math.hypot(v.vx, v.vz) : 0);
const STOP_IN = { steer: 0, gas: 0, brake: 1, handbrake: false, nitro: false };
// (nearly still: only the handbrake holds it - the brake pedal held at a standstill puts a car into reverse, see
//  physics.js, and a stopped car crept backwards into the one behind it)
const HOLD_IN = { steer: 0, gas: 0, brake: 0, handbrake: true, nitro: false };

const BASE = 94 / KMH;                  // the convoy's calm speed
const ALERT = 104 / KMH;                // once it knows it is attacked
const RUN = 112 / KMH;                  // the truck alone, both escorts out
const SLOTS = { lead: { lane: 1, ahead: 34 }, esc1: { lane: 0, back: 11 }, esc2: { lane: 2, back: 11 } };

export function createConvoy({ scene, vehicles, sound, effects, rig, ui, layout, props }) {
  const H = layout.highway, cx = H.centerX;
  // the lanes: 0 = next to the middle line .. 2 = next to the crash wall (dir +1 = northbound, on the -x side;
  // dir -1 = southbound, on the +x side)
  const laneX = (i, d) => cx - d * (2.1 + 4.15 * i);
  const fx = { vehicles, sound, effects };

  let on = false, dir = 1, arena = null, clock = 0, alert = false, engaged = true, hacked = false;
  const events = [];
  const say = (e) => events.push(e);
  const playerCar = () => (vehicles.state === 'driving' ? vehicles.active : null);
  const live = (v) => v && vehicles.live.includes(v);
  // how far b is ahead of a along the way the convoy drives (+ = ahead)
  const along = (a, b) => (b.z - a.z) * dir;
  const roadH = () => (dir > 0 ? 0 : Math.PI);

  // ---------------------------------------------------------------- the cars
  // a Guard car of the convoy: { v, id, role ('escort' | 'lead'), state ('active' | 'out'), how, hp, blockT, spinT, leanT, side }
  const G = [];
  const T = { v: null, state: 'run', blockT: 0, slowT: 0, laneWant: 1, swerveT: 0, swerves: 0, how: null, hitT: 0 };
  const S = { v: null, state: 'off', t: 0 };          // Mace's van
  let supportWanted = false;
  let drone = null;

  function drive(v, x, want, dt) {
    const sp = speedOf(v), d = Math.sign(Math.cos(v.heading)) || dir;
    stepSimpleCar(v, x, v.z + d * (9 + sp * 0.45), Math.max(0, want), dt, vehicles.world);
    v.braking = v.forward > want + 1.5;
    v.spin += (v.forward * dt) / (v.info.wheelR || 0.33);
  }
  // a car that has given up: it brakes to a stop where it is, and stays there (the same physics as every car)
  function stopAI(v) {
    v.ai = (c, dt, world) => { stepCar(c, c.forward > 0.6 ? STOP_IN : HOLD_IN, dt, world); c.spin += (c.forward * dt) / (c.info.wheelR || 0.33); c.braking = true; };
  }

  // ---------------------------------------------------------------- start / stop
  // o: { truck, escorts: [v, v], lead: v | null, dir, arena, gateZ, support (true: Mace's van comes) }
  function start(o) {
    stop();
    on = true; clock = 0; alert = false;
    // (passive: it only drives in its order - the escorts do not defend yet - until engage())
    engaged = !o.passive;
    dir = o.dir || 1; arena = o.arena || null; hacked = false;
    T.v = o.truck; T.state = 'run'; T.blockT = 0; T.slowT = 0; T.laneWant = 1; T.swerveT = 0; T.swerves = 0; T.how = null;
    (o.escorts || []).forEach((v, i) => v && G.push({ v, id: v.storyId || 'esc' + (i + 1), role: 'escort', slot: i ? SLOTS.esc2 : SLOTS.esc1, state: 'active', how: null, hp: 1, blockT: 0, spinT: 0, leanT: 0 }));
    if (o.lead) G.push({ v: o.lead, id: o.lead.storyId || 'lead', role: 'lead', slot: SLOTS.lead, state: 'active', how: null, hp: 1, blockT: 0, spinT: 0, leanT: 0 });
    for (const g of G) { g.v.ai = (c, dt) => guardAI(g, c, dt); g.v.siren = g.role === 'escort'; }
    if (T.v) T.v.ai = (c, dt) => truckAI(c, dt);
    supportWanted = !!o.support;
    gate.z = o.gateZ === undefined ? null : o.gateZ; gate.state = 'open'; gate.k = 0; gate.spent = false;
    if (gate.z !== null) makeGate();
    makeDrone();
    say('start');
  }
  function stop() {
    for (const g of G) if (live(g.v) && g.v.ai) stopAI(g.v);
    if (live(T.v)) stopAI(T.v);
    G.length = 0; T.v = null;
    if (S.v && live(S.v)) stopAI(S.v);
    S.v = null; S.state = 'off'; supportWanted = false;
    removeDrone(); removeGate();
    if (autoOn) { vehicles.autoDrive = null; autoOn = false; }
    dipping = 0; on = false;
  }

  // ---------------------------------------------------------------- THE GUARD CARS
  function guardAI(g, v, dt) {
    if (g.state !== 'active') return;
    const pc = playerCar(), tr = live(T.v) ? T.v : null;
    const base = tr ? Math.max(speedOf(tr), 6) : BASE;
    // where it should be: its place in the convoy, relative to the truck
    const slotX = laneX(g.slot.lane, dir);
    let tx = slotX, want = base;
    if (tr) {
      const want_z = g.slot.ahead ? tr.z + dir * g.slot.ahead : tr.z - dir * g.slot.back;
      const behind = (want_z - v.z) * dir;               // + = it is behind its place
      want = base + clamp(behind * 0.7, -8, 9);
    } else want = alert ? ALERT : BASE;
    // ---- an escort defends the truck: the one on Nate's side drops back into his lane, in front of him, and brakes
    if (g.role === 'escort' && engaged && pc && tr && T.state === 'run') {
      const pAlong = along(tr, pc);                       // how far Nate is ahead of the truck (- = behind it)
      const mine = nearestEscortTo(pc) === g;
      if (mine && pAlong < 6 && pAlong > -55) {
        alertNow();
        const gap = along(pc, v);                         // how far the escort is ahead of Nate (- = behind him)
        // (Nate over the middle line, on the empty half of the road: the escort stays on its own half, in the lane by
        //  the line. It does not cross over to shut that side, so a quick driver can get past the convoy there - the
        //  bridge gate hack needs that)
        const across = (pc.x - cx) * dir > 0.8;
        if (gap < -2.5) {
          // behind him: it goes past him in a lane beside his, to get in front of him - the nearest lane of its half
          // that is free: not his, and not one where the truck or another Guard car is just ahead of it (it used to
          // swerve into the truck's lane and run into the back of the truck). No free lane: it stays behind him.
          const pLane = across ? -1 : clamp(Math.round((Math.abs(pc.x - cx) - 2.1) / 4.15), 0, 2);
          let passLane = -1, best = 1e9;
          for (let L = 0; L < 3; L++) {
            const lx = laneX(L, dir);
            if (L === pLane || Math.abs(v.x - lx) >= best) continue;
            const busy = [T.v, ...G.map((q) => q.v)].some((q) => q !== v && live(q) && Math.abs(q.x - lx) < 2.4 && along(v, q) > -3 && along(v, q) < 30);
            if (!busy) { best = Math.abs(v.x - lx); passLane = L; }
          }
          if (passLane >= 0) { tx = laneX(passLane, dir); want = speedOf(pc) + 6; }
          else { tx = v.x; want = Math.min(want, speedOf(pc) - 1.2); }
          // (Nate right in front of it in its lane: it brakes - it never drives into him from behind)
          if (gap > -12 && Math.abs(pc.x - v.x) < 2.6) want = Math.min(want, speedOf(pc) - 1.2);
        } else {
          // ahead of him: it moves over into his lane to shut it (not at once: a quick driver can still go round it),
          // and it keeps its own place by the truck - it does not run away when he comes up fast, so he can hit it
          if (g.blockX === undefined) g.blockX = v.x;
          g.blockX += ((across ? laneX(0, dir) : clamp(pc.x, H.minX + 1.6, H.maxX - 1.6)) - g.blockX) * Math.min(1, dt * 1.5);
          tx = g.blockX;
          // now and then, with him close behind it (in its lanes), a hard brake check
          g.checkT = (g.checkT || 0) - dt;
          if (!across && gap > 3 && gap < 14 && g.checkT <= 0) { g.checkT = 3.6; g.check = 0.7; }
          if (g.check > 0) { g.check -= dt; want = Math.max(0, want - 7); }
          // alongside him: it leans in for a short side push (it never rams him head on)
          if (gap < 4.5 && Math.abs(pc.x - v.x) < 4.6) {
            g.leanT -= dt;
            if (g.leanT <= 0) { g.leanT = 2.6; g.lean = 0.9; }
          }
        }
      }
    }
    else g.blockX = undefined;
    if (g.lean > 0) { g.lean -= dt; if (pc) tx = v.x + Math.sign(pc.x - v.x) * 1.6; }
    // never over the crash walls
    tx = clamp(tx, H.minX + 1.4, H.maxX - 1.4);
    drive(v, tx, want, dt);
  }
  function nearestEscortTo(pc) {
    let best = null, bd = 1e9;
    for (const g of G) {
      if (g.role !== 'escort' || g.state !== 'active') continue;
      const d = Math.hypot(g.v.x - pc.x, g.v.z - pc.z);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  function alertNow() { if (!alert) { alert = true; say('alert'); } }

  // is a Guard car out? (every frame)
  function checkGuard(g, dt) {
    if (g.state !== 'active' || !engaged) return;
    const v = g.v, pc = playerCar();
    if (!live(v)) { out(g, 'ram'); return; }
    // hits: what it felt from other cars this frame (vehicle.js)
    if ((v.hitFelt || 0) > 2.5) { g.hp -= (v.hitFelt - 1.5) / 10; alertNow(); }
    if (g.hp <= 0 || (v.damage || 0) > 0.62) { out(g, 'ram'); return; }
    // turned across the road by a hit at its corner
    const dev = Math.abs(wrapA(v.heading - roadH()));
    g.spinT = dev > 0.75 ? g.spinT + dt : 0;
    if (g.spinT > 0.2) { out(g, 'spin'); return; }
    // held back by Nate in front of it
    if (pc) {
      const gap = along(v, pc), lat = Math.abs(pc.x - v.x);
      const held = gap > 0 && gap < 11 && lat < 2.8 && speedOf(v) < 35 / KMH;
      g.blockT = held ? g.blockT + dt : Math.max(0, g.blockT - dt * 0.5);
      if (g.blockT > 1.6) { out(g, 'block'); return; }
    }
  }
  function out(g, how) {
    g.state = 'out'; g.how = how;
    const v = g.v;
    v.siren = false;
    if (live(v)) {
      if (how === 'ram' || how === 'spin') {
        // it slides toward the crash wall on its own side and stops (no fire, no gore: the crew stays in the car)
        const pc = playerCar() || v;
        spinOutCar(v, pc, fx, v.x < cx ? -1 : 1);
      } else stopAI(v);
    }
    say('out:' + g.id + ':' + how);
    say(g.role === 'escort' ? 'escortOut' : 'leadOut');
    if (g.role === 'escort' && escortsLeft() === 0) { say('escortsDown'); alertNow(); }
  }
  const escortsLeft = () => G.filter((g) => g.role === 'escort' && g.state === 'active').length;

  // ---------------------------------------------------------------- THE TRUCK
  function truckAI(v, dt) {
    const pc = playerCar();
    if (T.state === 'stopped') { drive(v, v.x, 0, dt); return; }
    const free = escortsLeft() === 0;
    let want = free ? RUN : alert ? ALERT : BASE;
    // it changes lane when something stays in front of it
    T.swerveT -= dt;
    let tx = laneX(T.laneWant, dir);
    // what is in front of it: Nate, Mace's van
    const blockers = [pc, S.state === 'block' || S.state === 'ahead' ? S.v : null].filter((q) => q && live(q));
    let blocked = null;
    for (const q of blockers) {
      const gap = along(v, q), lat = Math.abs(q.x - v.x);
      if (gap > 0 && gap < 16 && lat < 3.0) { blocked = q; break; }
    }
    if (blocked) {
      if (free) {
        // the driver will not ram a car with a prisoner in the back: it slows with the car in front of it
        want = Math.min(want, speedOf(blocked) - 1.2 - (along(v, blocked) < 8 ? 2 : 0));
        T.blockT += dt;
        // a few times it tries to go round (another lane)
        if (T.blockT > 2.4 && T.swerveT <= 0 && T.swerves < 4) {
          T.swerveT = 4.5; T.swerves++; T.blockT = 0;
          const lane = Math.round((Math.abs(v.x - cx) - 2.1) / 4.15);
          T.laneWant = lane === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
          tx = laneX(T.laneWant, dir);
          say('truckSwerve');
        }
      } else {
        // the escorts are still there: it just goes round
        if (T.swerveT <= 0) { T.swerveT = 3; T.laneWant = T.laneWant === 1 ? 0 : 1; }
      }
    } else T.blockT = Math.max(0, T.blockT - dt);
    // the closed gate ahead: it stops at the boom
    if (gate.z !== null && gate.state === 'closed') {
      const toGate = (gate.z - v.z) * dir;
      if (toGate > -2 && toGate < 160) {
        // (or behind a Guard car that stops at the boom in its lane - the tech car: it does not run into it, Dante
        //  is not hurt by the trap)
        let stopAt = 9;
        for (const g of G) {
          if (!live(g.v) || Math.abs(g.v.x - v.x) > 2.6) continue;
          const gt = (gate.z - g.v.z) * dir;
          if (gt > -2 && gt < toGate) stopAt = Math.max(stopAt, gt + 7.5);
        }
        want = Math.min(want, clamp((toGate - stopAt) * 0.55, 0, want));
      }
    }
    drive(v, clamp(tx, H.minX + 1.6, H.maxX - 1.6), want, dt);
    // stopped: held still for a moment with both escorts out (or at the gate)
    const slow = speedOf(v) < 7 / KMH;
    T.slowT = slow ? T.slowT + dt : 0;
    if (T.slowT > 1.2) {
      const atGate = gate.state === 'closed' && Math.abs((gate.z - v.z) * dir) < 30;
      if (free || atGate) { T.state = 'stopped'; T.how = atGate ? 'gate' : blocked === S.v && S.v ? 'mace' : 'block'; v.braking = true; say('stopped:' + T.how); }
    }
  }

  // ---------------------------------------------------------------- MACE'S VAN
  function supportUpdate(dt) {
    if (!supportWanted || S.state === 'done' || !live(T.v)) return;
    const tr = T.v;
    if (S.state === 'off') {
      if (escortsLeft() > 0 || T.state !== 'run') return;
      // it comes up from behind, in the inside lane
      const v = vehicles.spawn('van', laneX(0, dir), tr.z - dir * 70, tr.heading, [0.34, 0.35, 0.36], { keep: true, npc: true, arena });
      if (!v) { S.state = 'done'; return; }
      v.storyId = 'maceVan'; v.label = "MACE'S VAN";
      const sp = speedOf(tr) + 6;
      v.forward = sp; v.vx = Math.sin(v.heading) * sp; v.vz = Math.cos(v.heading) * sp;
      S.v = v; S.state = 'come'; S.t = 0;
      v.ai = (c, d) => supportAI(c, d);
      say('support');
    }
  }
  function supportAI(v, dt) {
    const tr = T.v;
    S.t += dt;
    if (!live(tr) || T.state === 'stopped') { S.state = 'done'; drive(v, v.x, 0, dt); return; }
    const gap = along(tr, v);                              // how far it is ahead of the truck
    const trX = tr.x;
    if (S.state === 'come') {
      // fast past the truck on the inside lane
      drive(v, laneX(0, dir), speedOf(tr) + 9, dt);
      if (gap > 12) { S.state = 'ahead'; say('supportAhead'); }
    } else if (S.state === 'ahead') {
      // over into the truck's lane, in front of it
      drive(v, trX, speedOf(tr) + clamp((13 - gap) * 0.8, -4, 6), dt);
      if (Math.abs(v.x - trX) < 1.2 && gap > 6) { S.state = 'block'; }
    } else if (S.state === 'block') {
      // then slowly down: the truck has to slow with it
      drive(v, trX, Math.max(0, speedOf(tr) - 3.2 + clamp((10 - gap) * 0.4, -2, 2)), dt);
    } else drive(v, v.x, 0, dt);
  }

  // ---------------------------------------------------------------- THE DRONE
  function makeDrone() {
    removeDrone();
    if (!props || !T.v) return;
    const g = props.make('policeDrone', {});
    g.position.set(T.v.x, T.v.y + 16, T.v.z - dir * 12);
    scene.add(g);
    drone = { g, t: 0 };
  }
  function removeDrone() {
    if (!drone) return;
    scene.remove(drone.g);
    drone.g.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material && m.material.dispose) m.material.dispose(); } });
    drone = null;
  }
  function droneUpdate(dt, time) {
    if (!drone || !live(T.v)) return;
    drone.t += dt;
    if (drone.g.userData.anim) drone.g.userData.anim(time);
    const tr = T.v, p = drone.g.position, k = Math.min(1, dt * 1.4);
    // over the truck, a little behind it, swaying
    p.x += (tr.x + Math.sin(drone.t * 0.5) * 3 - p.x) * k;
    p.z += (tr.z - dir * (12 + Math.sin(drone.t * 0.3) * 4) - p.z) * k;
    p.y += (tr.y + 16 + Math.sin(drone.t * 1.1) * 0.5 - p.y) * Math.min(1, dt * 2);
    const pc = playerCar() || tr;
    drone.g.rotation.y = Math.atan2(pc.x - p.x, pc.z - p.z);
  }

  // ---------------------------------------------------------------- THE BRIDGE GATE
  const gate = { z: null, state: 'open', k: 0, spent: false, prop: null };
  function makeGate() {
    removeGate();
    if (!props) return;
    // over the half of the deck the convoy drives on (north: the -x side; south: the +x side)
    const g = props.make('bridgeGate', { width: (dir > 0 ? cx - H.minX : H.maxX - cx) + 0.6 });
    g.position.set(dir > 0 ? (cx + H.minX) / 2 - 0.3 : (cx + H.maxX) / 2 + 0.3, H.heightAt(gate.z), gate.z);
    g.rotation.y = dir < 0 ? 0 : Math.PI;
    scene.add(g);
    gate.prop = g;
  }
  function removeGate() {
    if (!gate.prop) return;
    scene.remove(gate.prop);
    gate.prop.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material && m.material.dispose) m.material.dispose(); } });
    gate.prop = null;
  }
  // can the gate be hacked now? (Nate driving toward it, 130 to 320 m before it - and in front of at least one Guard
  // car: the gate drops behind him, so with all of them ahead it would trap nobody and the one hack would be wasted)
  function gateReady() {
    const pc = playerCar();
    if (!on || gate.z === null || gate.state !== 'open' || gate.spent || !pc) return false;
    const d = (gate.z - pc.z) * dir;
    if (!(d > 130 && d < 320 && Math.cos(pc.heading - roadH()) > 0.5)) return false;
    return G.some((g) => g.state === 'active' && (pc.z - g.v.z) * dir > 4);
  }
  function gateUpdate(dt) {
    if (gate.z === null) return;
    const pc = playerCar();
    if (gate.state === 'armed' && pc && (gate.z - pc.z) * dir < -5) { gate.state = 'closing'; sound.gateMotor && sound.gateMotor(); say('gateClosing'); }
    if (gate.state === 'closing') { gate.k = Math.min(1, gate.k + dt / 1.1); if (gate.k >= 1) { gate.state = 'closed'; say('gateClosed'); } }
    if (gate.prop && gate.prop.userData.setClosed) gate.prop.userData.setClosed(gate.k);
    if (gate.state !== 'closed') return;
    // every Guard car behind the closed gate stops at the boom: trapped
    for (const g of G) {
      if (g.state !== 'active') continue;
      const toGate = (gate.z - g.v.z) * dir;
      if (toGate > -1 && toGate < 170) {
        g.trap = true;
        // (it brakes to a stop before the boom)
        const v = g.v, want = clamp((toGate - 8 - G.indexOf(g) * 2.5) * 0.6, 0, speedOf(v));
        v.ai = (c, d) => { drive(c, c.x, want, d); };
        if (speedOf(v) < 1.5 && toGate < 40) out(g, 'gate');
      }
    }
  }

  // ---------------------------------------------------------------- the story drives Nate's car while the fingers hack
  let autoOn = false;
  function autopilot(onOff) {
    autoOn = !!onOff;
    if (!autoOn) vehicles.autoDrive = null;
  }
  function autopilotUpdate() {
    const pc = playerCar();
    if (!autoOn || !pc) return;
    const sp = speedOf(pc), want = Math.max(sp, 70 / KMH);
    // keep the lane it is in, keep the speed
    const lane = clamp(Math.round((Math.abs(pc.x - cx) - 2.1) / 4.15), 0, 2), tx = laneX(lane, dir);
    // (heading up = toward +x; going south the same move needs the other sign)
    const aim = (dir > 0 ? 0 : Math.PI) + clamp((tx - pc.x) * 0.09 * dir, -0.2, 0.2);
    const d = wrapA(aim - pc.heading);
    vehicles.autoDrive = { steer: clamp(-d * 2.6, -1, 1), gas: sp < want ? 0.6 : 0, brake: 0, handbrake: false, nitro: false, up: false, down: false, horn: false };
  }

  // ---------------------------------------------------------------- the rewind
  let rewindAt = null, rewindTo = 0, dipping = 0;
  function rewind(toZ) {
    const tr = live(T.v) ? T.v : playerCar();
    if (!tr) return 0;
    const dz = toZ - tr.z;
    if (Math.abs(dz) < 0.5) return 0;
    const move = (v) => { if (!live(v)) return; v.z += dz; if (v.p0z !== undefined) v.p0z += dz; if (v.rz !== undefined) v.rz += dz; };
    const pc = playerCar();
    move(pc);
    // (Nate far behind - after a crash, say: the cut puts him back on the straight at most 300 m behind the truck, so
    //  the chase goes on; before, every dip pushed him further back, down to the foot of the ramp)
    if (pc && live(T.v) && pc !== T.v && (toZ - pc.z) * dir > 300) {
      const d2 = toZ - dir * 300 - pc.z;
      pc.z += d2; if (pc.p0z !== undefined) pc.p0z += d2; if (pc.rz !== undefined) pc.rz += d2;
    }
    move(T.v);
    for (const g of G) {
      // (a car out far behind is left behind: it is taken away)
      if (g.state === 'out' && pc && Math.abs(g.v.z - pc.z) > 150) { if (live(g.v)) vehicles.removeVehicle(g.v); continue; }
      move(g.v);
    }
    move(S.v);
    if (drone) drone.g.position.z += dz;
    rig.shift(0, 0, dz);
    // (a new stretch of road: a gate that was used stands open again, its lock burnt out)
    if (gate.state === 'closed' || gate.state === 'closing') { gate.state = 'open'; gate.k = 0; gate.spent = true; for (const g of G) if (g.trap && g.state === 'active') { g.trap = false; g.v.ai = (c, d) => guardAI(g, c, d); } }
    say('rewind');
    return dz;
  }
  function rewindUpdate(dt) {
    if (dipping > 0) {
      dipping -= dt;
      if (dipping <= 0.55 && dipping + dt > 0.55) rewind(rewindTo);
      if (dipping <= 0) ui.fade('black', 0, 0.6);
      return;
    }
    if (rewindAt === null || !live(T.v) || T.state === 'stopped') return;
    if ((T.v.z - rewindAt) * dir > 0) { dipping = 1.1; ui.fade('black', 1, 0.45); }
  }
  // at a cut: the stopped truck (and Nate, and the cars near them) at z. Cars of the convoy far away are taken away.
  function stage(z) {
    const pc = playerCar() || null, ref = live(T.v) ? T.v : pc;
    if (!ref) return;
    for (const g of G) if (live(g.v) && Math.abs(g.v.z - ref.z) > 120) vehicles.removeVehicle(g.v);
    rewind(z);
  }

  // ---------------------------------------------------------------- every frame
  function update(dt, time) {
    if (!on) return;
    clock += dt;
    for (const g of G) checkGuard(g, dt);
    T.hitT -= dt;
    if (live(T.v) && (T.v.hitFelt || 0) > 3) { alertNow(); if (T.hitT <= 0) { T.hitT = 7; say('truckHit'); } }
    supportUpdate(dt);
    gateUpdate(dt);
    droneUpdate(dt, time);
    autopilotUpdate();
    rewindUpdate(dt);
  }

  // ---------------------------------------------------------------- what the screen shows
  function target() {
    const pc = playerCar();
    if (T.state === 'stopped') return null;
    if (escortsLeft() > 0) { const g = pc ? nearestEscortTo(pc) : G.find((q) => q.role === 'escort' && q.state === 'active'); return g ? g.id : null; }
    return T.v ? T.v.storyId || 'truck' : null;
  }

  return {
    start, stop, update, rewind, stage, autopilot,
    // the fight begins: the escorts defend the truck from now on
    engage() { engaged = true; },
    get on() { return on; },
    get truck() { return T.v; },
    get truckStopped() { return T.state === 'stopped'; },
    get truckHow() { return T.how; },
    get escortsLeft() { return escortsLeft(); },
    get supportCar() { return S.v; },
    // how the lead car (the tech car) ended: 'ram' | 'hack' | 'gentle' (spared or held back) | null (still going)
    get leadHow() { const g = G.find((q) => q.role === 'lead'); if (!g) return null; if (g.state !== 'out') return null; return g.how === 'gate' ? 'hack' : g.how === 'block' ? 'gentle' : 'ram'; },
    // HOW THE AMBUSH WAS DONE (the story keeps it as ambush_style): 'ram' (the tech car was rammed or spun out),
    // 'hack' (the bridge gate was hacked, or trapped the tech car), else 'gentle' (the tech car was spared)
    get style() { const h = this.leadHow; if (h === 'ram') return 'ram'; if (h === 'hack' || hacked) return 'hack'; return 'gentle'; },
    get gateReady() { return gateReady(); },
    get gateState() { return gate.state; },
    // the hack worked: the gate closes behind Nate
    armGate() { if (gate.state === 'open') { gate.state = 'armed'; hacked = true; say('gateArmed'); } },
    gateSpent() { gate.spent = true; },
    // a dip to black and the rewind when the truck comes near z "at" (the ramp): to = where the truck goes back to
    autoRewind(o) { rewindAt = o ? o.at : null; rewindTo = o ? o.to : 0; },
    // every car stops where it is (a film scene begins)
    halt() {
      for (const g of G) if (live(g.v) && g.state === 'active') { g.state = 'held'; stopAI(g.v); g.v.siren = false; }
      if (live(T.v)) { T.state = 'stopped'; stopAI(T.v); }
      if (S.v && live(S.v)) stopAI(S.v);
      if (autoOn) autopilot(false);
    },
    removeDrone,
    get hud() {
      const T2 = T.v ? vehicles.cargo.info(T.v) : null;
      return {
        dante: T2 ? T2.integrity : 1,
        escorts: G.map((g) => ({ id: g.id, role: g.role, out: g.state !== 'active', how: g.how })),
        target: target(), stopped: T.state === 'stopped',
      };
    },
    takeEvents() { return events.splice(0); },
    // (tests: put a Guard car out, or stop the truck, as if it had been done by driving)
    testOut(id, how = 'block') { const g = G.find((q) => q.id === id && q.state === 'active'); if (g) out(g, how); },
    testStop() { if (live(T.v) && T.state === 'run') { T.state = 'stopped'; T.how = 'block'; stopAI(T.v); say('stopped:block'); } },
    // (tests)
    get info() {
      const pc = playerCar();
      return {
        on, alert, truck: T.v ? { z: Math.round(T.v.z), x: +T.v.x.toFixed(1), kmh: Math.round(speedOf(T.v) * KMH), state: T.state, how: T.how, dante: +(this.hud.dante).toFixed(2) } : null,
        guards: G.map((g) => `${g.id}:${g.state}${g.how ? '/' + g.how : ''}:${Math.round(g.hp * 100)}:${pc ? Math.round(along(pc, g.v)) : '-'}`),
        support: S.state, gate: gate.state, gateZ: gate.z, z: pc ? Math.round(pc.z) : null, kmh: pc ? Math.round(speedOf(pc) * KMH) : 0,
      };
    },
  };
}
