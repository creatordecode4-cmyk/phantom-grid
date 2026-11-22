// ---------------------------------------------------------------------------
// physics.js - how vehicles move. Simple, but it should feel like a real car.
//
// THE CAR MODEL (stepCar)
//   ENGINE     a torque curve (weak at idle, strong in the middle, falling off
//              near the red line), a rev limiter, engine braking off the gas
//   GEARBOX    automatic, 6 gears. It shifts by engine speed, with a short
//              pause without power while it shifts
//   WEIGHT     braking throws weight onto the front wheels, speeding up onto
//              the rear wheels, corners onto the outside. More weight on a
//              tire = more grip there. The body pitches and rolls with it.
//   TIRES      every axle has a limited amount of grip that is shared between
//              going / stopping and turning. Ask for too much and it slides:
//                front slides  -> the car runs wide (understeer)
//                rear slides   -> the tail comes around (oversteer, drift)
//   SURFACES   dry road, wet road, sand, curbs: different grip and drag
//   HELPERS    ABS (no locked wheels), traction control (no wheel spin) and,
//              on "Easy", extra steering help
//
// The car's speed is kept as two numbers: "forward" along its nose and
// "slide" sideways. The same file has the much simpler boat and drone.
// Everything runs in fixed steps of 1/60 second (see vehicle.js).
// ---------------------------------------------------------------------------

const G = 9.81;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, rate, dt) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt));

// how fast each gear can go, as a share of the top speed
export const GEAR_TOP = [0.17, 0.3, 0.45, 0.62, 0.81, 1.0];
export const IDLE_RPM = 900, RED_RPM = 7200;

// how much push a gear gives compared to first gear (higher gears: less push, more speed)
const gearPush = (g) => (GEAR_TOP[0] / GEAR_TOP[g - 1]) ** 0.72;
// engine pull at an engine speed n (0 = idle .. 1 = red line): 0..1
const torque = (n) => clamp(0.58 + 1.5 * n - 1.22 * n * n, 0, 1.05);

// Everything the physics remembers about one car. "type" comes from
// CAR_TYPES (mass, drive, topSpeed, accel, grip ...), "info" from carInfo.
export function initCarState(v) {
  Object.assign(v, {
    vx: 0, vz: 0, forward: 0, slide: 0, steer: 0, yawSpin: 0,
    spin: 0,      // how far the wheels have turned (radians). It must start at 0: "undefined" plus a number is
                  // NaN, and a wheel turned by NaN disappears (the detailed cars then stood on empty wheel arches)
    gear: 1, rpm: IDLE_RPM, shiftT: 0, reverse: false, stopped: 0,
    roll: 0, pitch: 0, heave: 0, heaveV: 0, lastGround: null,
    damage: 0, nitro: 1, nitroOn: false, nitroCool: 0, braking: false,
    // races (src/race): boost 0..1 = a short push after a clean drift; airborne = in the air over a jump (no grip)
    boost: 0, airborne: false,
    // what the effects and sounds read
    fx: { throttle: 0, slip: 0, spin: 0, abs: false, surface: 'road', bump: 0, shifted: false, impact: 0, scrape: 0, ax: 0, ay: 0, limited: false },
  });
}

// One step of the player's car.
//   input: { steer -1..1, gas 0..1, brake 0..1, handbrake, nitro }
//   world: { surface(x, z) -> { name, grip, drag, rough }, wet (0..1), ground(x, z),
//            collide(v) -> { impact, nx, nz, lever, hard } , assist: 'off' | 'normal' | 'easy' }
export function stepCar(v, input, dt, world) {
  const T = v.type, fx = v.fx;
  const top = (T.topSpeed / 3.6) * (1 - 0.4 * v.damage * v.damage) * (v.nitroOn ? 1.1 : 1) * (1 + 0.04 * (v.boost || 0));
  const L = v.info.wheelbase || 2.7;
  const assist = world.assist || 'normal';
  const surf = world.surface(v.x, v.z);
  // grip of the ground under the car: tires x surface x rain (in the air over a jump: almost none)
  const mu = T.grip * surf.grip * lerp(1, 0.66, world.wet || 0) * (v.airborne ? 0.04 : 1);
  const aMax = mu * G * 1.02;                      // the most the tires can push the car (m/s2)

  let fxv = Math.sin(v.heading), fzv = Math.cos(v.heading);
  let fwd = v.vx * fxv + v.vz * fzv;
  const speed = Math.hypot(v.vx, v.vz);

  // ------------------------------------------------------------ gearbox + engine speed
  fx.shifted = false;
  if (v.shiftT > 0) v.shiftT -= dt;
  const gearTop = (g) => top * GEAR_TOP[g - 1];
  let n = clamp(Math.abs(fwd) / gearTop(v.gear), 0, 1.02);      // 0..1 engine speed in this gear
  if (!v.reverse && v.shiftT <= 0) {
    if (n > 0.9 && v.gear < 6) { v.gear++; v.shiftT = 0.2; fx.shifted = true; }
    else if (v.gear > 1 && Math.abs(fwd) / gearTop(v.gear - 1) < (input.gas > 0.6 ? 0.72 : 0.5)) { v.gear--; v.shiftT = 0.14; fx.shifted = true; }
    n = clamp(Math.abs(fwd) / gearTop(v.gear), 0, 1.02);
  }
  const wantRpm = IDLE_RPM + (RED_RPM - IDLE_RPM) * Math.max(n, input.gas * 0.12 * (speed < 1 ? 1 : 0));
  v.rpm += (wantRpm - v.rpm) * Math.min(1, dt * 9);

  // ------------------------------------------------------------ what the driver asks for
  let gas = input.gas, brake = input.brake;
  v.braking = false;
  // BRAKE at standstill = reverse (after a short stop), GAS while rolling back = brake
  if (brake > 0.02 && fwd < 0.6) {
    if (fwd > -0.3 && v.stopped < 0.35 && !v.reverse) { v.stopped += dt; gas = 0; brake = 1; }
    else { v.reverse = true; gas = brake; brake = 0; }
  } else if (v.reverse && (gas > 0.02 || brake < 0.02)) {
    if (fwd < -0.5 && gas > 0.02) { brake = gas; gas = 0; } else if (fwd > -0.5) { v.reverse = false; v.gear = 1; }
    else gas = 0;
  }
  if (brake < 0.02 && !v.reverse) v.stopped = 0;
  fx.throttle = gas;

  // ------------------------------------------------------------ forces along the car
  // drive: first gear gives "accel", higher gears less (they turn slower but go faster)
  let drive = 0;
  if (gas > 0.02 && v.shiftT <= 0) {
    if (v.reverse) drive = -T.accel * 0.55 * gas * clamp(1 + fwd / 11, 0, 1);
    else if (n < 1.0) drive = T.accel * gas * torque(n) * gearPush(v.gear) * (v.nitroOn ? 1.75 : 1) * (1 + 0.55 * (v.boost || 0)) * (1 - 0.35 * v.damage);
  }
  // SPEED LIMITER (story: Nate's van): at v.limit (m/s) the engine simply stops pulling
  fx.limited = false;
  if (v.limit > 0 && !v.reverse) {
    const over = fwd - (v.limit - 0.7);
    if (over > 0) { drive *= clamp(1 - over / 0.7, 0, 1); fx.limited = gas > 0.3 && over > 0.35; }
  }
  // air drag is set so the car just reaches its top speed in 6th gear
  const roll = 0.16;
  const cD = Math.max(0, (T.accel * gearPush(6) * torque(0.97) - roll) / ((T.topSpeed / 3.6) ** 2));
  let resist = cD * fwd * Math.abs(fwd) + Math.sign(fwd) * Math.min(Math.abs(fwd) / dt, roll + surf.drag * (0.4 + 0.06 * Math.abs(fwd)));
  // engine braking: stronger in a low gear and at high engine speed
  if (gas < 0.02 && !v.reverse && Math.abs(fwd) > 0.5) resist += Math.sign(fwd) * (0.5 + 1.9 * n) * (GEAR_TOP[0] / GEAR_TOP[v.gear - 1]) ** 0.5;
  if (v.limit > 0 && fwd > v.limit + 0.4) resist += (fwd - v.limit) * 1.6;     // (rolling faster than the limiter allows: it holds the car back)
  let brakeAcc = brake > 0.02 ? brake * 13.5 : 0;
  if (input.handbrake) brakeAcc = Math.max(brakeAcc, 5.5);

  // ------------------------------------------------------------ weight on the front and rear tires
  const h = 0.52;                                               // height of the center of gravity (m)
  const ax0 = fx.ax;                                            // acceleration of the last step
  const wf = clamp(0.5 - (ax0 * h) / (L * G), 0.24, 0.76);     // share of the weight on the front wheels
  const wr = 1 - wf;
  let capF = aMax * wf * 2, capR = aMax * wr * 2;               // grip of the front / rear axle

  // TRACTION: the driven wheels can only push as hard as their grip allows
  const driven = T.drive === 'fwd' ? capF * 0.5 : T.drive === 'rwd' ? capR * 0.5 : (capF + capR) * 0.5;
  fx.spin = 0;
  let usedF = 0, usedR = 0;                                     // grip used up by going / stopping
  if (Math.abs(drive) > driven) {
    if (assist === 'off') {
      // wheel spin: less push, smoke, and a driven rear axle loses its side grip
      fx.spin = clamp((Math.abs(drive) - driven) / 6, 0.15, 1);
      drive = Math.sign(drive) * driven * 0.86;
      if (T.drive !== 'fwd') usedR = capR * (0.55 + 0.4 * fx.spin); else usedF = capF * 0.8;
    } else drive = Math.sign(drive) * driven * 0.97;          // traction control
  }
  if (T.drive === 'fwd') usedF = Math.max(usedF, Math.abs(drive)); else if (T.drive === 'rwd') usedR = Math.max(usedR, Math.abs(drive) * 1.0); else { usedF = Math.max(usedF, Math.abs(drive) * 0.5); usedR = Math.max(usedR, Math.abs(drive) * 0.5); }

  // BRAKES: 65 % front. Too much = locked wheels (no ABS) or pulsing brakes (ABS)
  fx.abs = false;
  if (brakeAcc > 0 && Math.abs(fwd) > 0.3) {
    v.braking = true;
    const limit = aMax * 0.98;
    if (brake > 0.02 && brakeAcc > limit) {
      if (assist === 'off') { brakeAcc = limit * 0.8; usedF = capF * 0.93; usedR = Math.max(usedR, capR * 0.8); fx.spin = Math.max(fx.spin, speed > 4 ? 0.5 : 0); } // locked: slides straight on
      else { brakeAcc = limit; fx.abs = speed > 3; usedF = Math.max(usedF, capF * 0.72); usedR = Math.max(usedR, capR * 0.5); }
    } else { usedF = Math.max(usedF, brakeAcc * 0.65 * 1.3); usedR = Math.max(usedR, brakeAcc * 0.35 * 1.3); }
    if (input.handbrake) usedR = capR * 0.97;                  // handbrake locks the rear wheels
  }
  const sideF = Math.sqrt(Math.max(0.02, capF * capF - Math.min(usedF, capF) ** 2));   // grip left for turning
  const sideR = Math.sqrt(Math.max(0.02, capR * capR - Math.min(usedR, capR) ** 2));

  // ------------------------------------------------------------ steering
  // little steering angle at speed, and the wheel does not jump: it turns at a limited rate
  const maxSteer = 0.58 - 0.5 * clamp(Math.abs(fwd) / 42, 0, 1) ** 0.75;
  let target = input.steer * maxSteer;
  if (assist === 'easy' && Math.abs(fwd) > 6) {
    // steering help: never ask the front tires for more than they can give
    const most = Math.atan((sideF * 0.92 * L) / (fwd * fwd));
    target = clamp(target, -most, most);
  }
  v.steer = approach(v.steer, target, Math.abs(target) > Math.abs(v.steer) ? 1.9 : 3.2, dt);

  // how fast the car wants to turn, and how hard that pushes sideways
  let yaw = (-fwd * Math.tan(v.steer)) / L;
  const ay = Math.abs(fwd * yaw);
  let under = 0;
  if (ay > sideF && Math.abs(fwd) > 2) { under = 1 - sideF / ay; yaw *= sideF / ay; }          // UNDERSTEER: runs wide
  // OVERSTEER: the rear cannot hold the corner -> the tail steps out
  let over = 0;
  const ayNow = Math.abs(fwd * yaw);
  if (ayNow > sideR && Math.abs(fwd) > 3) over = clamp((ayNow - sideR) / (aMax + 0.01), 0, 1);
  if (input.handbrake && Math.abs(fwd) > 4) over = Math.max(over, 0.42 * Math.min(1, Math.abs(v.steer) * 6));
  if (over > 0) v.yawSpin += Math.sign(yaw || -v.slide || 1) * over * 4.0 * dt * (assist === 'easy' ? 0.45 : 1);
  v.yawSpin *= Math.exp(-(assist === 'easy' ? 4.5 : 2.4) * dt);
  v.heading += (yaw + v.yawSpin) * dt;

  // ------------------------------------------------------------ new speed
  fxv = Math.sin(v.heading); fzv = Math.cos(v.heading);
  const rx = -fzv, rz = fxv;
  fwd = v.vx * fxv + v.vz * fzv;
  let slide = v.vx * rx + v.vz * rz;
  const before = fwd;
  fwd += drive * dt;
  fwd -= resist * dt;
  if (brakeAcc > 0) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), brakeAcc * dt);
  if (v.reverse && fwd < -11) fwd = -11;
  // the tires pull the sideways speed back to zero - as hard as the rear grip allows
  const hold = clamp(sideR / (aMax + 0.01), 0.1, 1.2);
  let pull = (6.5 + (assist === 'easy' ? 3 : 0)) * hold;
  if (Math.abs(slide) > 4 && assist !== 'easy') pull *= 0.62;   // once it slides it keeps sliding for a moment
  slide *= Math.exp(-pull * dt);
  v.vx = fxv * fwd + rx * slide;
  v.vz = fzv * fwd + rz * slide;
  v.forward = fwd; v.slide = slide;
  fx.ax = lerp(fx.ax, (fwd - before) / dt, Math.min(1, dt * 10));
  fx.ay = lerp(fx.ay, fwd * (yaw + v.yawSpin), Math.min(1, dt * 10));
  fx.slip = clamp(Math.max((Math.abs(slide) - 1.6) / 7, under * (Math.abs(fwd) > 8 ? 1 : 0) * 0.9, fx.spin * 0.8, fx.abs ? 0.2 : 0), 0, 1);
  fx.surface = surf.name;

  // nitro: empties in 3.5 s, fills again in 12 s. An empty bottle cools down for 3 s before it fills, and a
  // new burn needs at least a quarter of a bottle (no flickering on and off at the bottom)
  if (v.nitroCool > 0) v.nitroCool -= dt;
  const lit = v.nitroOn || v.nitro > 0.25;
  v.nitroOn = !!(input.nitro && T.nitro && v.nitro > 0.02 && lit && gas > 0.3 && !v.reverse && !(v.nitroCool > 0));
  v.nitro = clamp(v.nitro + (v.nitroOn ? -dt / 3.5 : v.nitroCool > 0 ? 0 : dt / 12), 0, 1);
  if (v.nitroOn && v.nitro <= 0.02) { v.nitroOn = false; v.nitroCool = 3; }

  // ------------------------------------------------------------ move, hit things
  const steps = Math.max(1, Math.ceil((Math.hypot(v.vx, v.vz) * dt) / 0.6));   // small steps: no jumping through walls
  fx.impact = 0; fx.scrape = 0;
  for (let i = 0; i < steps; i++) {
    v.x += (v.vx * dt) / steps; v.z += (v.vz * dt) / steps;
    const hit = world.collide(v);
    if (!hit) continue;
    const s = hit.impact / Math.sqrt(T.armor || 1);              // heavy, armored cars shrug it off
    if (hit.impact < 3.2) fx.scrape = Math.max(fx.scrape, Math.hypot(v.vx, v.vz) > 3 ? 1 : 0);   // light touch: scrape along
    else {
      // real crash: lose speed, get turned a little, take damage
      const lose = clamp(1 - s * 0.055, 0.25, 1);
      v.vx *= lose; v.vz *= lose;
      v.yawSpin += clamp(hit.lever * s * 0.11, -2.2, 2.2);
      v.damage = clamp(v.damage + (s * s) / 1150, 0, 1);
    }
    fx.impact = Math.max(fx.impact, hit.impact);
  }

  // ------------------------------------------------------------ ground, suspension, body movement
  const gy = (world.ground(v.x + fxv * 1.4, v.z + fzv * 1.4) + world.ground(v.x - fxv * 1.4, v.z - fzv * 1.4)) / 2;
  fx.bump = 0;
  if (v.lastGround !== null) {
    const step = gy - v.lastGround;
    // a curb: the wheels are kicked up (or drop), the body follows on its springs
    if (Math.abs(step) > 0.03 && speed > 0.5) { v.heaveV += clamp(step * 14, -1.4, 1.6) + Math.sign(step) * Math.min(speed, 15) * 0.02; fx.bump = clamp(Math.abs(step) * 6 + speed * 0.02, 0, 1); }
  }
  v.lastGround = gy;
  // rough ground shakes the car all the time
  if (surf.rough > 0 && speed > 1.5) { v.heaveV += (Math.random() - 0.5) * surf.rough * Math.min(speed, 20) * 0.5 * dt * 60 * 0.02; fx.bump = Math.max(fx.bump, surf.rough * Math.min(1, speed / 15) * 0.35); }
  v.heaveV += (-v.heave * 120 - v.heaveV * 9) * dt;              // spring and damper
  v.heave = clamp(v.heave + v.heaveV * dt, -0.09, 0.12);
  v.y += (gy - v.y) * Math.min(1, dt * 18);
  // the body leans with the weight: nose down when braking, lean out in corners
  const rollK = T.roll || 1;
  v.roll += (clamp(fx.ay * 0.0085 * rollK, -0.1, 0.1) - v.roll) * Math.min(1, dt * 6);
  v.pitch += (clamp(-fx.ax * 0.0058 * rollK, -0.05, 0.065) + v.heaveV * 0.02 - v.pitch) * Math.min(1, dt * 7);
  return fx;
}

// The much simpler car of the computer drivers (police chasers): it follows a
// target point, has no gears and no tire model.
export function stepSimpleCar(v, targetX, targetZ, wantSpeed, dt, world) {
  const dx = targetX - v.x, dz = targetZ - v.z;
  const want = Math.atan2(dx, dz);
  let turn = Math.atan2(Math.sin(want - v.heading), Math.cos(want - v.heading));
  const speed = Math.hypot(v.vx, v.vz);
  const maxTurn = clamp(1.9 - speed * 0.03, 0.5, 1.9) * Math.min(1, speed / 3 + 0.25);
  v.heading += clamp(turn, -maxTurn * dt, maxTurn * dt);
  // slow down for sharp turns
  const limit = Math.abs(turn) > 0.5 ? Math.max(6, wantSpeed * 0.35) : wantSpeed;
  let fwd = v.forward;
  fwd = approach(fwd, limit, fwd < limit ? v.type.accel * 0.75 : 11, dt);
  v.forward = fwd;
  v.vx = Math.sin(v.heading) * fwd; v.vz = Math.cos(v.heading) * fwd;
  v.x += v.vx * dt; v.z += v.vz * dt;
  const hit = world.collide(v);
  if (hit && hit.impact > 2) { v.forward *= 0.5; v.vx *= 0.5; v.vz *= 0.5; }
  v.y = world.ground(v.x, v.z);
  v.roll += (clamp(-fwd * turn * 0.01, -0.07, 0.07) - v.roll) * Math.min(1, dt * 5);
  return hit;
}

// ---------------------------------------------------------------------------
// BOAT: pushed by its propeller, slowed by the water, turns only while moving.
// It rides the waves: bobs up and down, lifts its nose at speed, leans in turns.
//   world: { waterLevel, shoreZ (the beach: it cannot go past it), minX, maxX, minZ }
// ---------------------------------------------------------------------------
export function initBoatState(v) {
  Object.assign(v, { vx: 0, vz: 0, forward: 0, slide: 0, steer: 0, roll: 0, pitch: 0, wave: Math.random() * 10, damage: 0, fx: { throttle: 0, slip: 0, impact: 0, wake: 0 } });
}
export function stepBoat(v, input, dt, world) {
  const T = v.type, fx = v.fx;
  // in the canals of The Sunk (Chapter 3) the water is calm and the walls stop the boat
  const canal = !!(world.canal && world.canal(v.x, v.z));
  // top speed: an old boat can have its own limit (v.limit, m/s); the QUIET motor makes it slow and soft
  let top = T.topSpeed / 3.6;
  if (v.limit > 0) top = Math.min(top, v.limit);
  if (v.quiet) top *= 0.42;
  const accel = T.accel * (v.quiet ? 0.55 : 1) * (v.rusty ? 0.82 : 1);
  let fxv = Math.sin(v.heading), fzv = Math.cos(v.heading);
  let fwd = v.vx * fxv + v.vz * fzv;
  const thrust = (input.gas - input.brake * 0.6) * accel;
  fx.throttle = Math.abs(input.gas - input.brake);
  v.steer = approach(v.steer, input.steer, 1.6, dt);
  // the rudder only works when water flows past it
  v.heading -= v.steer * 0.85 * clamp(fwd / 7, -0.6, 1) * dt;
  fxv = Math.sin(v.heading); fzv = Math.cos(v.heading);
  const rx = -fzv, rz = fxv;
  fwd = v.vx * fxv + v.vz * fzv;
  let slide = v.vx * rx + v.vz * rz;
  fwd += thrust * dt - (fwd * Math.abs(fwd) * (accel / (top * top)) + fwd * 0.25) * dt;
  slide *= Math.exp(-1.6 * dt);                                  // a boat slides sideways for a while
  v.vx = fxv * fwd + rx * slide; v.vz = fzv * fwd + rz * slide;
  v.forward = fwd; v.slide = slide;
  v.x += v.vx * dt; v.z += v.vz * dt;
  fx.impact = 0;
  // the beach and the edges of the sea (in The Sunk: its walls and pontoons, see vehicle.js)
  if (!canal && v.z > world.shoreZ) { v.z = world.shoreZ; if (v.vz > 0) { fx.impact = v.vz; v.vz *= -0.2; v.vx *= 0.6; } }
  if (world.collide) { const hit = world.collide(v); if (hit > fx.impact) fx.impact = hit; }
  if (v.z < world.minZ) { v.z = world.minZ; v.vz = Math.abs(v.vz) * 0.3; }
  if (v.x < world.minX) { v.x = world.minX; v.vx = Math.abs(v.vx) * 0.3; }
  if (v.x > world.maxX) { v.x = world.maxX; v.vx = -Math.abs(v.vx) * 0.3; }
  // waves: three slow swells with different rhythms
  v.wave += dt;
  const t = v.wave, k = clamp(1 - Math.abs(fwd) / (top * 1.5), 0.4, 1) * (canal ? 0.4 : 1);
  v.y = world.waterLevel - 0.5 + (Math.sin(t * 1.25 + v.x * 0.08) * 0.13 + Math.sin(t * 0.8 + v.z * 0.06) * 0.1) * k + Math.abs(fwd) * 0.006;
  v.pitch += (-clamp(fwd / top, -0.3, 1) * 0.085 - thrust * 0.004 + Math.sin(t * 1.25 + 1.1) * 0.03 * k - v.pitch) * Math.min(1, dt * 3);
  v.roll += (v.steer * clamp(fwd / top, 0, 1) * 0.2 + Math.sin(t * 0.95) * 0.04 * k - v.roll) * Math.min(1, dt * 3);
  // (the wake is measured against the boat's real top speed: the quiet motor leaves almost none)
  fx.wake = clamp(Math.abs(fwd) / (T.topSpeed / 3.6 * 0.8), 0, 1);
  return fx;
}

// ---------------------------------------------------------------------------
// DRONE: flies. steer = turn, gas / brake = forward / back, up / down = height.
// It hovers with a small bob and tilts into the direction it flies.
//   world: { ground(x, z), collideAir(v) (walls of buildings), maxHeight, bounds }
// ---------------------------------------------------------------------------
export function initDroneState(v) {
  Object.assign(v, { vx: 0, vz: 0, vy: 0, forward: 0, slide: 0, steer: 0, roll: 0, pitch: 0, wave: 0, alt: 0, damage: 0, fx: { throttle: 0, slip: 0, impact: 0 } });
}
export function stepDrone(v, input, dt, world) {
  const T = v.type, top = T.topSpeed / 3.6, fx = v.fx;
  v.steer = approach(v.steer, input.steer, 3, dt);
  v.heading -= v.steer * 1.7 * dt;
  const fxv = Math.sin(v.heading), fzv = Math.cos(v.heading);
  const flying = v.alt > 0.15;
  const want = flying ? (input.gas - input.brake) * top : 0;
  const before = v.forward;
  v.forward = approach(v.forward, want, T.accel, dt);
  v.vx = fxv * v.forward; v.vz = fzv * v.forward;
  v.x += v.vx * dt; v.z += v.vz * dt;
  const up = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  v.vy = approach(v.vy, up * 7, 14, dt);
  const g = world.ground(v.x, v.z);
  v.alt = clamp(v.alt + v.vy * dt, 0, world.maxHeight);
  v.wave += dt;
  v.y = g + 0.12 + v.alt + (flying ? Math.sin(v.wave * 2.3) * 0.05 : 0);     // hovering bob
  fx.impact = 0;
  const hit = world.collideAir(v);
  if (hit) { fx.impact = hit; v.forward *= -0.25; }
  const B = world.bounds;
  v.x = clamp(v.x, B.minX, B.maxX); v.z = clamp(v.z, B.minZ - 300, B.maxZ);
  // tilt into the movement
  v.pitch += (clamp((v.forward / top) * 0.3 + (v.forward - before) / dt * 0.01, -0.45, 0.45) - v.pitch) * Math.min(1, dt * 5);
  v.roll += (v.steer * clamp(Math.abs(v.forward) / top + 0.25, 0, 1) * 0.35 - v.roll) * Math.min(1, dt * 5);
  fx.throttle = clamp(0.35 + Math.abs(v.forward) / top * 0.4 + Math.abs(v.vy) / 7 * 0.4, 0, 1) * (flying || up > 0 ? 1 : 0.25);
  return fx;
}
