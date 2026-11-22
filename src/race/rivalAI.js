// ---------------------------------------------------------------------------
// rivalAI.js - a computer driver of a race.
//
// It drives the SAME car physics as the player (stepCar in src/vehicles/physics.js). It only decides, like a
// person, how far to turn the wheel and how hard to press the pedals:
//
//   * LINE      it follows the racing line (outside - inside - outside), each driver a little to its own side
//   * BRAKES    it looks ahead at the fastest safe speed of the road (raceLine.speedProfile) and brakes in
//               time for the corner, then gives full gas out of it
//   * PASSING   a slower car ahead in its way: it moves to the side with more room
//   * BLOCKING  an aggressive driver moves across in front of the player on a straight (not in corners)
//   * PUSHING   one driver of the crew (Chapter 4, mission 3) leans its car into the player's to push him
//               into a wall
//   * MISTAKES  now and then (more for a weak driver): it brakes too late and runs wide, lifts off, twitches
//   * STUCK     against a wall: it backs out and tries again
//   * NITRO     on a long straight, if its car has it
//
// The race (raceManager.js) sets two numbers every moment - the rubber band: "pace" (how close to the limit it
// takes the corners) and "power" (its engine). A driver far ahead of the player gets a little slower, one far
// behind a little faster - never more than a few percent, so it never looks like cheating.
// ---------------------------------------------------------------------------

import { stepCar } from '../vehicles/physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// v: the vehicle. ctx: { line, profile (made for this car), cars (all race cars, with their .track), player (car) }
// o: { skill 0..1, aggression 0..1, lane (m, + = left of the racing line), push, nitro, seed }
export function createRival(v, ctx, o = {}) {
  const skill = clamp(o.skill ?? 0.7, 0, 1);
  const R = {
    skill, aggression: o.aggression ?? 0.3, push: !!o.push,
    lane: o.lane ?? 0, laneNow: o.lane ?? 0, move: 0, moveT: 0,
    pace: 1, power: 1,                  // the rubber band (raceManager)
    i: -1, s: 0, d: 0,
    halt: false,                        // true: brake and stay (before the start, after the finish)
    mistake: null, mistakeT: 0, stuckT: 0, backT: 0, blockCool: 0, pushCool: 3, nitroT: 0, lastSteer: 0,
    seed: o.seed || 1, events: [],      // ('push' when it leans into the player: the story may say something)
  };
  let rnd = R.seed * 9301 + 49297;
  const random = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  const base = v.type;                  // the car as it is (the rubber band changes a copy)
  v.type = { ...base };
  const inp = { steer: 0, gas: 0, brake: 0, handbrake: false, nitro: false };
  const P = {}, Q = {};
  const L = (v.info && v.info.wheelbase) || 2.7;

  v.ai = (car, dt, world) => {
    const line = ctx.line;
    // the rubber band: the engine of this car, a little stronger or weaker
    car.type.accel = base.accel * R.power;
    car.type.topSpeed = base.topSpeed * (0.97 + 0.03 * R.power);
    const speed = Math.hypot(car.vx, car.vz), fwd = car.forward;
    if (R.halt || car.dead) {
      inp.steer = 0; inp.gas = 0; inp.brake = speed > 0.3 ? 1 : 0; inp.handbrake = speed < 1; inp.nitro = false;
      stepCar(car, inp, dt, world);
      car.spin += (car.forward * dt) / car.info.wheelR;
      return;
    }
    const pr = line.project(car.x, car.z, R.i);
    R.i = pr.i; R.s = pr.s; R.d = pr.d;

    // ---- where to go: a point on the racing line ahead, moved to this driver's side on straights ----
    const look = clamp(5 + speed * 0.5, 7, 34);
    const bend = line.sharpest(pr.s, 45);
    const straight = clamp(1 - bend * 28, 0, 1);              // 1 on a straight, 0 in a real corner
    R.moveT -= dt; R.blockCool -= dt; R.pushCool -= dt;
    if (R.moveT <= 0) R.move = 0;
    const wantLane = (R.lane + R.move) * (R.move ? Math.max(straight, 0.45) : straight);
    R.laneNow += (wantLane - R.laneNow) * Math.min(1, dt * 1.8);
    line.raceAt(pr.s + look, P);
    // (stay on the road: the racing line plus the side step must keep 1.3 m from the edge)
    let off = R.laneNow;
    const fromMid = line.raceOffset(pr.s + look) + off, room = P.w - 1.3;
    if (fromMid > room) off -= fromMid - room; else if (fromMid < -room) off -= fromMid + room;
    const tx = P.x + P.dz * off, tz = P.z - P.dx * off;
    // ---- steering: aim at that point like a person looking ahead ("pure pursuit") ----
    const dist = Math.max(4, Math.hypot(tx - car.x, tz - car.z));
    const alpha = wrapAngle(Math.atan2(tx - car.x, tz - car.z) - car.heading);
    const wheel = Math.atan((2 * Math.sin(alpha) * L) / dist);                 // the wheel angle it wants (+ = left)
    const maxSteer = 0.58 - 0.5 * clamp(Math.abs(fwd) / 42, 0, 1) ** 0.75;
    let steer = clamp(-wheel / maxSteer, -1, 1);
    // ---- speed: the fastest safe speed of the road ahead, as close to the limit as this driver dares ----
    const dare = (0.86 + 0.12 * skill) * R.pace;
    let target = ctx.profile.min(pr.s, Math.max(12, speed * 0.7)) * dare;
    // ---- other cars: pass a slower one, block the player, lean into him ----
    for (const c of ctx.cars) {
      if (c === car || !c.track) continue;
      let ds = c.track.s - pr.s;
      if (line.closed) { if (ds > line.total / 2) ds -= line.total; else if (ds < -line.total / 2) ds += line.total; }
      const dd = c.track.d - pr.d, cs = Math.hypot(c.vx, c.vz);
      // a car close ahead in my way, and I am faster: go round it (the side with more room), or wait behind it
      if (ds > 1 && ds < 15 + speed * 0.3 && Math.abs(dd) < 2.4 && speed > cs + 0.5) {
        if (R.moveT <= 0) { const left = c.track.d < 0; R.move = (left ? 1 : -1) * 3.2; R.moveT = 1.6; }
        if (Math.abs(dd) < 1.6 && ds < 8) target = Math.min(target, cs + 0.5);
      }
      if (c !== ctx.player || straight < 0.6) continue;
      // BLOCK: the player comes up behind me on a straight - move across in front of him (not too often)
      if (R.aggression > 0.35 && ds < -2 && ds > -14 && cs > speed + 0.8 && R.blockCool <= 0) {
        R.move = clamp(c.track.d - line.raceOffset(pr.s) - R.lane, -3.5, 3.5); R.moveT = 1.2;
        R.blockCool = 5.5 - R.aggression * 2;
      }
      // PUSH: the player is right beside me - lean in (the crash between the cars does the rest)
      if (R.push && Math.abs(ds) < 3.5 && Math.abs(dd) > 1.4 && Math.abs(dd) < 4.6 && speed > 14 && R.pushCool <= 0) {
        R.move = clamp(c.track.d - line.raceOffset(pr.s) - R.lane, -4, 4); R.moveT = 0.9;
        R.pushCool = 6; R.events.push('push');
      }
    }
    // ---- mistakes: rare for a good driver ----
    R.mistakeT -= dt;
    if (!R.mistake && random() < dt * (1 - skill) * 0.03) {
      const r = random();
      R.mistake = r < 0.45 ? { kind: 'late', t: 3 } : r < 0.75 ? { kind: 'lift', t: 0.7 } : { kind: 'twitch', t: 0.5 };
    }
    if (R.mistake) {
      R.mistake.t -= dt;
      if (R.mistake.kind === 'late') target *= 1.16;                         // into the next corner too fast: runs wide
      else if (R.mistake.kind === 'lift') target = Math.min(target, speed * 0.9);
      else steer += Math.sin(R.mistake.t * 23) * 0.25;
      if (R.mistake.t <= 0) R.mistake = null;
    }
    // ---- pedals ----
    const err = target - fwd;
    if (err > 0.3) { inp.gas = clamp(0.4 + err * 0.35, 0, 1); inp.brake = 0; }
    else if (err < -1.0) { inp.gas = 0; inp.brake = clamp(-err * 0.2, 0.12, 1); }
    else { inp.gas = 0.3; inp.brake = 0; }
    // a big slide: ease off and steer into it (the physics brings it back)
    if (Math.abs(car.slide) > 3.5) { inp.gas = Math.min(inp.gas, 0.4); steer += clamp(car.slide * 0.04, -0.3, 0.3); }
    // ---- nitro on a long straight ----
    R.nitroT -= dt;
    if (o.nitro && car.type.nitro && R.nitroT <= 0 && straight > 0.95 && line.sharpest(pr.s, 160) < 0.008 && speed > 18 && car.nitro > 0.6 && random() < dt * (0.2 + skill * 0.5)) R.nitroT = 1.4 + random() * 1.4;
    inp.nitro = R.nitroT > 0 && straight > 0.8;
    // ---- stuck against something: back out ----
    if (R.backT > 0) {
      R.backT -= dt;
      inp.gas = 0; inp.brake = 1; steer = -R.lastSteer; inp.nitro = false;
    } else if (Math.abs(fwd) < 1.2 && inp.gas > 0.4) {
      R.stuckT += dt;
      if (R.stuckT > 1.4) { R.stuckT = 0; R.backT = 1.1; R.lastSteer = steer || 1; }
    } else R.stuckT = 0;
    inp.steer = clamp(steer, -1, 1);
    inp.handbrake = false;
    stepCar(car, inp, dt, world);
    car.spin += (car.forward * dt) / car.info.wheelR;
  };
  v.rival = R;
  return R;
}
