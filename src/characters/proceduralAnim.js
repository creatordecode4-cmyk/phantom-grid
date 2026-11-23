// ---------------------------------------------------------------------------
// proceduralAnim.js - moves a character that was rigged by autoRig.js.
//
// There are no animation files. Every frame the pose is worked out from a few
// numbers (how fast the character moves, where the ground is):
//
//   * WALK and RUN: a step cycle with the four phases contact - down - passing -
//     up. The heel lands first and the foot rolls onto the toes; the hips turn
//     and tilt, the spine turns the other way, the arms swing opposite to the
//     legs with the elbows a little late, the head stays level.
//   * FEET are placed with "IK": a foot that stands on the ground stays exactly
//     where it is in the world (no sliding) while the body moves over it. Feet
//     follow curbs and slopes, knees point where the foot points, and the body
//     sinks a little when the legs are far apart.
//   * IDLE: breathing, shifting the weight from foot to foot, slow looks around.
//   * DRIVING: sitting, hands on the steering wheel (they turn with it).
//   * SWIMMING (deep water): treading water when still (upright, the head out, the hands sculling), a front
//     crawl with the head up when moving (flat body that rolls, arms over the water, a fast small kick).
//   * STORY POSES: asleep on one side, fallen on the back, sitting on the edge
//     of a bed or in a car seat, arms crossed, hands on the hips, holding,
//     carrying, looking at a phone, aiming. Hands and feet are put ON things
//     (the bed, the ground, the thighs, the hips) with the same arm and leg
//     solver, and the body rests on the surface by its own measured shape - so
//     nothing floats in the air.
//   * TEST POSES for the rig test screen.
//
// JOINT LIMITS: every angle is clamped to what a human joint can do (LIMITS
// below). Elbows and knees only bend one way. Bones are only turned (and the
// small helper bones moved a few millimeters) - never stretched or scaled.
//
// Directions inside the character: +Y up, +Z forward, +X the character's left.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const frac = (v) => v - Math.floor(v);
const TAU = Math.PI * 2;

// What a human joint can do, in degrees.
export const LIMITS = {
  elbow: [0, 150],            // bends one way only
  knee: [0, 140],             // bends backward only
  hipForward: [-30, 120],     // thigh back .. thigh up in front
  hipSide: [-20, 45],
  shoulderForward: [-60, 170],
  shoulderSide: [-15, 160],
  wrist: [-70, 80],
  ankle: [-20, 40],           // toes up .. toes down
  spine: [-25, 25],           // per spine bone
  neck: [-40, 40],
  head: [-50, 50],
  finger: [0, 90],
};
const lim = (name, deg) => clamp(deg, LIMITS[name][0], LIMITS[name][1]);

import { createFaceAnimator } from './faceAnim.js';

export function createAnimator(THREE, rig, opts = {}) {
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const B = rig.bones, R = rig.rest, names = rig.list.map((b) => b.name);
  const H = rig.height, k = H / 1.8;
  const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
  const SIDES = [{ tag: 'L', s: 1 }, { tag: 'R', s: -1 }];
  const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  // ---- numbers of this body ----
  const restHead = (n) => new THREE.Vector3(...R[n].head);
  const thighLen = R.thigh_L.length, shinLen = R.shin_L.length, legLen = thighLen + shinLen;
  const upperLen = R.upperArm_L.length, foreLen = R.foreArm_L.length;
  const hipsRest = restHead('hips');
  const ankleH = R.foot_L.head[1];                               // height of the ankle above the sole
  const ballZ = R.toe_L.head[2] - R.foot_L.head[2];              // ankle -> ball of the foot (forward)
  const heelZ = Math.min(-0.04 * k, (rig.info.sides[0].heelZ ?? -0.06) - R.foot_L.head[2]);   // ankle -> back of the heel
  const hipW = Math.abs(R.thigh_L.head[0]);
  const footHomeX = (Math.abs(R.foot_L.head[0]) + Math.abs(R.foot_R.head[0])) / 2 * 0.82;     // feet a bit closer than in the A-pose
  const hipInv = R.hips.world.clone().invert();

  // ---- the pose we build every frame ----
  const world = {}, pos = {}, target = {}, delta = {}, hasTarget = {}, hasDelta = {};
  for (const n of names) { world[n] = Q(); pos[n] = V(); target[n] = Q(); delta[n] = Q(); }
  const resolvers = {};        // bone name -> function that sets targets when the bone's place is known
  const tq = Q(), tq2 = Q(), tv = V(), tv2 = V(), tv3 = V(), tm = new THREE.Matrix4();

  // a turn (quaternion) from angles around the bone's own axes: x = bend forward, y = twist, z = to the side
  const euler = new THREE.Euler();
  function setDelta(name, x, y = 0, z = 0) { delta[name].setFromEuler(euler.set(x, y, z, 'YXZ')); hasDelta[name] = true; }
  // the turn that makes a bone point along "dir" with its hinge along "hinge"
  const bx = V(), by = V(), bz = V();
  function aim(out, dir, hinge) {
    by.copy(dir).normalize();
    bx.copy(hinge).addScaledVector(by, -hinge.dot(by));
    if (bx.lengthSq() < 1e-8) bx.set(1, 0, 0).addScaledVector(by, -by.x);
    bx.normalize();
    bz.crossVectors(bx, by);
    return out.setFromRotationMatrix(tm.makeBasis(bx, by, bz));
  }
  function setTarget(name, dir, hinge) { aim(target[name], dir, hinge); hasTarget[name] = true; }

  // ---------------------------------------------------------------- arms (angles)
  // flex: arm forward (+) / back (-), side: away from the body, twist, elbow: bend. All in degrees.
  const aDir = V(), aHinge = V(), fDir = V();
  function armAngles(q, flex, side, twist, elbow, wrist = 0) {
    const { tag, s } = SIDES[q];
    flex = lim('shoulderForward', flex) * DEG; side = lim('shoulderSide', side) * DEG; elbow = lim('elbow', elbow) * DEG;
    // start hanging straight down, lift to the side, then swing forward
    aDir.set(0, -1, 0).applyAxisAngle(Z_AXIS, s * side).applyAxisAngle(X_AXIS, -flex);
    aHinge.set(-1, 0, 0).applyAxisAngle(Z_AXIS, s * side).applyAxisAngle(X_AXIS, -flex).applyAxisAngle(aDir, -s * twist * DEG);
    setTarget('upperArm_' + tag, aDir, aHinge);
    fDir.copy(aDir).applyAxisAngle(aHinge, elbow);
    setTarget('foreArm_' + tag, fDir, aHinge);
    // the wrist bends toward the palm (the hand's own z axis)
    setDelta('hand_' + tag, 0, 0, -s * lim('wrist', wrist) * DEG);
  }
  // fingers: curl in degrees (0 = straight .. 90 = fist). They only show on models with separate fingers.
  function fingers(q, curl, thumb = curl * 0.5, spread = 0) {
    const { tag, s } = SIDES[q];
    FINGERS.forEach((f, i) => {
      const c = lim('finger', f === 'thumb' ? thumb : curl * (1 + (i - 2.5) * 0.08)) * DEG;
      for (let j = 1; j <= 3; j++) setDelta(`${f}${j}_${tag}`, f === 'thumb' ? -c * 0.3 : 0, 0, -s * c * (j === 1 ? 0.75 : j === 2 ? 1 : 0.7) - (j === 1 && f !== 'thumb' ? s * spread * (i - 2.5) * 0.04 : 0));
    });
  }

  // ---------------------------------------------------------------- two-bone IK
  // Places the middle joint (knee / elbow) for a limb from "root" to "goal".
  // pole: the direction the middle joint points to. Returns the bend angle in degrees.
  const ikN = V(), ikP = V(), ikMid = V(), ikA = V(), ikB = V();
  function twoBone(root, goal, l1, l2, pole, maxBend, out1, out2) {
    ikN.subVectors(goal, root);
    let d = ikN.length();
    // the joint limit: the limb cannot fold further than maxBend, and cannot stretch past straight
    const dMin = Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(maxBend * DEG)), dMax = (l1 + l2) * 0.9995;
    d = clamp(d, dMin, dMax);
    ikN.normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    ikP.copy(pole).addScaledVector(ikN, -pole.dot(ikN));
    if (ikP.lengthSq() < 1e-8) ikP.set(0, 0, 1);
    ikP.normalize();
    ikMid.copy(root).addScaledVector(ikN, a).addScaledVector(ikP, h);
    out1.subVectors(ikMid, root).normalize();
    ikB.copy(root).addScaledVector(ikN, d);            // where the end really is (after the limits)
    out2.subVectors(ikB, ikMid).normalize();
    return Math.acos(clamp(out1.dot(out2), -1, 1)) / DEG;
  }

  // ---------------------------------------------------------------- legs (IK)
  // foot[q]: where the ankle should be, in character space, and how the foot is turned
  //   lying: the body lies on its back (the knee points up, the toes point up)
  //   pole + loose: the knee points along "pole", the foot simply follows the shin (a body curled up on its side)
  const foot = SIDES.map(({ s }) => ({ ankle: new THREE.Vector3(s * footHomeX, ankleH, R.foot_L.head[2]), yaw: 0, pitch: 0, toe: 0, knee: 0, lying: false, loose: false, pole: new THREE.Vector3() }));
  const thighD = V(), shinD = V(), hingeL = V(), poleL = V(), footQ = Q();
  let legIK = true;      // false: the legs are posed by hand (a character lying on the ground)
  function legResolver(q) {
    const { tag, s } = SIDES[q];
    return (hip) => {
      if (!legIK) return;
      const F = foot[q];
      // the knee points where the foot points (a little outward, like real legs). Lying on the back: it points up.
      if (F.loose) poleL.copy(F.pole);
      else if (F.lying) poleL.set(s * 0.22, 1, 0);
      else poleL.set(Math.sin(F.yaw + s * 0.07), 0, Math.cos(F.yaw + s * 0.07));
      F.knee = twoBone(hip, F.ankle, thighLen, shinLen, poleL, LIMITS.knee[1], thighD, shinD);
      hingeL.crossVectors(thighD, poleL);
      if (hingeL.lengthSq() < 1e-6) hingeL.set(-1, 0, 0);
      setTarget('thigh_' + tag, thighD, hingeL);
      setTarget('shin_' + tag, shinD, hingeL);
      if (F.loose) { setDelta('foot_' + tag, F.pitch, 0, 0); return; }
      // the foot: its rest direction, turned by yaw and pitch (pitch + = toes down). The ankle has limits too.
      const shinPitch = Math.atan2(shinD.z, -shinD.y);                       // how far the shin leans forward (+) or back (-)
      const pitch = F.lying ? F.pitch : clamp(F.pitch, (LIMITS.ankle[0] * DEG) - shinPitch, (LIMITS.ankle[1] * DEG) - shinPitch);
      footQ.setFromAxisAngle(Y_AXIS, F.yaw).multiply(tq.setFromAxisAngle(X_AXIS, pitch));
      if (F.lying) footQ.premultiply(bodyQ);                                 // (the foot lies down with the body)
      target['foot_' + tag].copy(footQ).multiply(R['foot_' + tag].world);
      hasTarget['foot_' + tag] = true;
      setDelta('toe_' + tag, -F.toe, 0, 0);
    };
  }
  resolvers.thigh_L = legResolver(0); resolvers.thigh_R = legResolver(1);

  // ---------------------------------------------------------------- hands on something (IK), used when driving
  const hand = [{ on: false, p: V(), dir: V(), pole: V(), hasPole: false }, { on: false, p: V(), dir: V(), pole: V(), hasPole: false }];
  const upD = V(), foD = V(), hingeA = V(), poleA = V();
  function armResolver(q) {
    const { tag, s } = SIDES[q];
    return (shoulder) => {
      if (!hand[q].on) return;
      if (hand[q].hasPole) poleA.copy(hand[q].pole); else poleA.set(s * 0.55, -0.8, -0.25);   // elbows point down and a little out
      twoBone(shoulder, hand[q].p, upperLen, foreLen + 0.03 * k, poleA, LIMITS.elbow[1], upD, foD);
      hingeA.crossVectors(upD, foD);
      if (hingeA.lengthSq() < 1e-6) hingeA.set(-1, 0, 0);
      setTarget('upperArm_' + tag, upD, hingeA);
      setTarget('foreArm_' + tag, foD, hingeA);
    };
  }
  resolvers.upperArm_L = armResolver(0); resolvers.upperArm_R = armResolver(1);

  // ---------------------------------------------------------------- write the pose into the bones
  const hipsPos = V(), bodyQ = Q();     // where the hips are and how the whole body is turned (character space)
  const snapshot = {}, snapPos = V();
  let blendT = 1, blendLen = 0.2;       // cross-fade after a change of mode
  for (const n of names) snapshot[n] = Q();
  const y0 = V(), y1 = V(), swing = Q(), ident = Q();
  function apply() {
    for (const n of names) {
      const bone = B[n], r = R[n];
      if (r.helper) continue;
      const p = r.parent;
      if (!p) { pos[n].copy(hipsPos); world[n].copy(bodyQ).multiply(r.world); bone.quaternion.copy(world[n]); bone.position.copy(hipsPos); continue; }
      pos[n].copy(r.position).applyQuaternion(world[p]).add(pos[p]);
      if (resolvers[n]) resolvers[n](pos[n]);
      if (hasTarget[n]) { world[n].copy(target[n]); bone.quaternion.copy(world[p]).invert().multiply(world[n]); }
      else {
        bone.quaternion.copy(r.quaternion);
        if (hasDelta[n]) bone.quaternion.multiply(delta[n]);
        world[n].copy(world[p]).multiply(bone.quaternion);
      }
    }
    // cross-fade from the pose before the last change of mode
    if (blendT < 1) {
      const t = smooth(blendT);
      for (const n of names) if (!R[n].helper) B[n].quaternion.slerpQuaternions(snapshot[n], B[n].quaternion, t);
      B.hips.position.lerpVectors(snapPos, B.hips.position, t);
    }
    // ---- helper bones ----
    for (const n of names) {
      const r = R[n], bone = B[n];
      if (r.helper === 'half') {
        // turns half as far as the limb next to it, and moves a few millimeters to the outside of the bend
        const of = B[r.of], ro = R[r.of];
        y0.set(0, 1, 0).applyQuaternion(ro.quaternion); y1.set(0, 1, 0).applyQuaternion(of.quaternion);
        swing.setFromUnitVectors(y0, y1);
        const ang = Math.acos(clamp(y0.dot(y1), -1, 1));
        bone.quaternion.copy(ident).slerp(swing, 0.5).multiply(r.quaternion);
        bone.position.copy(r.position);
        if (ang > 1e-3) bone.position.add(tv.subVectors(y0, y1).normalize().multiplyScalar(r.gain * r.radius * Math.sin(ang / 2) ** 2));
      } else if (r.helper === 'untwist') {
        // sits at the shoulder: it takes back most of the upper arm's twist, so the shoulder skin does not wring
        const par = B[r.parent], rp = R[r.parent];
        tq.copy(rp.quaternion).invert().multiply(par.quaternion);          // how the upper arm is turned from its rest
        const tw = Math.atan2(tq.y, tq.w) * 2;                             // the part of that around its own length
        bone.quaternion.setFromAxisAngle(Y_AXIS, -tw * 0.8);
      } else if (r.helper === 'twist') {
        // sits toward the wrist: it takes half of the hand's twist
        const tag = n.slice(-1), hb = B['hand_' + tag], rh = R['hand_' + tag];
        tq.copy(rh.quaternion).invert().multiply(hb.quaternion);
        bone.quaternion.setFromAxisAngle(Y_AXIS, Math.atan2(tq.y, tq.w));  // (half of 2 * atan2)
      }
    }
    for (const n of names) { hasTarget[n] = false; hasDelta[n] = false; }
    hand[0].on = hand[1].on = false; hand[0].hasPole = hand[1].hasPole = false;
    foot[0].lying = foot[1].lying = false; foot[0].loose = foot[1].loose = false;
  }
  function startBlend(seconds = 0.2) {
    for (const n of names) snapshot[n].copy(B[n].quaternion);
    snapPos.copy(B.hips.position);
    blendT = 0; blendLen = seconds;
  }

  // ---------------------------------------------------------------- the step machine (feet that do not slide)
  // Every foot is either PLANTED at a fixed place in the world, or in the air on
  // its way to the next place. Places are stored in world coordinates.
  const step = SIDES.map(({ s }) => ({ planted: true, wx: 0, wz: 0, wy: 0, yaw: 0, fx: 0, fz: 0, fy: 0, fyaw: 0, t: 1, dur: 0.3, lift: 0, off: s > 0 ? 0 : 0.5, first: true, strikeT: 9, phase: 0 }));
  const st = { x: 0, z: 0, heading: 0, y: 0, ground: null, phase: 0, speed: 0, time: 0, bob: 0, drop: 0, lean: 0, moving: 0, run: 0 };
  let vx = 0, vz = 0;       // virtual position, for walking on the spot (test screen)
  const toWorld = (lx, lz, out) => { const c = Math.cos(st.heading), sn = Math.sin(st.heading); out.x = st.x + lx * c + lz * sn; out.z = st.z - lx * sn + lz * c; return out; };
  const toLocal = (wx, wz, out) => { const c = Math.cos(st.heading), sn = Math.sin(st.heading), dx = wx - st.x, dz = wz - st.z; out.x = dx * c - dz * sn; out.z = dx * sn + dz * c; return out; };
  // (no ground function: the character stands on a flat floor at its own height - a room, a roof, the highway)
  const groundAt = (wx, wz) => (st.ground ? st.ground(wx, wz) : st.y);
  const w2 = { x: 0, z: 0 }, l2 = { x: 0, z: 0 };

  function locomotion(dt, speed, turn) {
    const moving = smooth((Math.abs(speed) - 0.12) / 0.5), run = smooth((speed - 2.3) / 2.2);
    st.moving = lerp(st.moving, moving, 1 - Math.exp(-10 * dt)); st.run = lerp(st.run, run, 1 - Math.exp(-8 * dt));
    // how long a step is and how long a foot stays on the ground
    const stepLen = (0.4 + 0.235 * Math.abs(speed)) * (legLen / 0.86) * (speed < 0 ? 0.7 : 1);
    const duty = lerp(0.62, 0.3, st.run);
    const cycleTime = Math.abs(speed) > 0.05 ? (2 * stepLen) / Math.abs(speed) : 1e9;
    if (moving > 0.01) st.phase = frac(st.phase + dt / cycleTime);
    const sign = speed < 0 ? -1 : 1;
    const lateral = lerp(footHomeX, footHomeX * 0.45, st.run);          // runners put their feet almost on one line

    for (let q = 0; q < 2; q++) {
      const S = step[q], { s } = SIDES[q], p = frac(st.phase + S.off);
      S.phase = p;
      S.strikeT += dt;
      if (S.first) { toWorld(s * footHomeX, 0, w2); S.wx = w2.x; S.wz = w2.z; S.wy = groundAt(w2.x, w2.z); S.yaw = st.heading; S.first = false; }
      if (moving > 0.05) {
        // ---- walking / running: the phase says when to lift the foot ----
        if (S.planted && p >= duty) { S.planted = false; S.fx = S.wx; S.fz = S.wz; S.fy = S.wy; S.fyaw = S.yaw; S.t = 0; S.gait = true; }
        if (!S.planted && !S.gait) S.gait = true;       // (it was in the middle of a small standing step)
        if (!S.planted && S.gait) {
          const sw = clamp((p - duty) / (1 - duty), 0, 1);
          if (p < duty || sw >= 0.999) { S.planted = true; S.strikeT = 0; S.t = 1; }
          else {
            S.t = sw;
            // where it will land: in front of the hip by half of what the body travels while the foot stands
            const remain = (1 - sw) * (1 - duty) * cycleTime;
            // (walking: the foot lands as far in front of the hip as it leaves behind; running: it lands closer and leaves further back)
            const ahead = sign * duty * stepLen * 2 * lerp(0.5, 0.3, st.run) + speed * remain;
            toWorld(s * lateral, ahead, w2);
            const e = sw * sw * (3 - 2 * sw);
            S.wx = lerp(S.fx, w2.x, e); S.wz = lerp(S.fz, w2.z, e);
            const gy = groundAt(w2.x, w2.z);
            S.wy = lerp(S.fy, gy, e);
            S.yaw = S.fyaw + Math.atan2(Math.sin(st.heading - S.fyaw), Math.cos(st.heading - S.fyaw)) * e;
            S.lift = Math.sin(Math.PI * Math.pow(sw, 0.8)) * lerp(0.075, 0.2, st.run) * k + Math.max(0, Math.max(S.fy, gy) - S.wy) * Math.sin(Math.PI * sw);
          }
        }
      } else {
        // ---- standing: take a small step when a foot is too far from where it should stand ----
        S.gait = false;
        toWorld(s * footHomeX, 0, w2);
        if (S.planted) {
          const err = Math.hypot(S.wx - w2.x, S.wz - w2.z), turnErr = Math.abs(Math.atan2(Math.sin(st.heading - S.yaw), Math.cos(st.heading - S.yaw)));
          if ((err > 0.09 * k || turnErr > 0.5) && step[1 - q].planted && step[1 - q].strikeT > 0.12) { S.planted = false; S.fx = S.wx; S.fz = S.wz; S.fy = S.wy; S.fyaw = S.yaw; S.t = 0; S.dur = 0.26; }
          else S.lift = 0;
        }
        if (!S.planted) {
          S.t = Math.min(1, S.t + dt / S.dur);
          const e = smooth(S.t), gy = groundAt(w2.x, w2.z);
          S.wx = lerp(S.fx, w2.x, e); S.wz = lerp(S.fz, w2.z, e); S.wy = lerp(S.fy, gy, e);
          S.yaw = S.fyaw + Math.atan2(Math.sin(st.heading - S.fyaw), Math.cos(st.heading - S.fyaw)) * e;
          S.lift = Math.sin(Math.PI * S.t) * 0.045 * k;
          if (S.t >= 1) { S.planted = true; S.strikeT = 0; S.lift = 0; }
        }
      }
      if (S.planted) { S.lift = 0; S.wy = groundAt(S.wx, S.wz); }

      // ---- from the world place to the ankle target in character space ----
      const F = foot[q];
      toLocal(S.wx, S.wz, l2);
      const yawL = Math.atan2(Math.sin(S.yaw - st.heading), Math.cos(S.yaw - st.heading));
      // the ground under the foot: a slope tilts it
      toWorld(l2.x + Math.sin(yawL) * ballZ, l2.z + Math.cos(yawL) * ballZ, w2);
      const gToe = groundAt(w2.x, w2.z);
      toWorld(l2.x + Math.sin(yawL) * heelZ, l2.z + Math.cos(yawL) * heelZ, w2);
      const gHeel = groundAt(w2.x, w2.z);
      let slope = S.planted || S.t > 0.85 ? Math.atan2(gHeel - gToe, ballZ - heelZ) : 0;   // + = toes lower
      slope = clamp(slope, -0.45, 0.45);
      let pitch = slope, heelUp = 0, lift = S.lift, toe = 0;
      if (st.moving > 0.05 && S.gait !== false) {
        const m = st.moving;
        if (S.planted) {
          // CONTACT: the heel lands first with the toes up, then the foot rolls flat (walking only)
          const strike = (1 - smooth(p / (duty * 0.22))) * lerp(18, 4, st.run) * DEG * m * sign;
          // UP / toe-off: late in the stance the heel rises while the ball of the foot stays down
          heelUp = smooth((p - duty * 0.58) / (duty * 0.42)) * lerp(38, 48, st.run) * DEG * m * (sign > 0 ? 1 : 0.3);
          pitch += heelUp - strike;
          toe = heelUp * 0.9;
        } else {
          // in the air: toes down right after toe-off, toes up before the heel lands
          const sw = S.t;
          pitch += (lerp(lerp(34, 46, st.run), -lerp(16, 4, st.run), smooth(sw * 1.25)) * DEG) * m * sign;
          toe = (1 - smooth(sw * 3)) * 0.5;
          // a runner's foot kicks up behind
          lift += Math.sin(Math.PI * clamp(sw * 1.5, 0, 1)) * 0.16 * k * st.run;
        }
      }
      F.yaw = yawL; F.pitch = pitch; F.toe = toe;
      // ankle place: the sole point, plus the ankle height turned by the pitch around the ball (heel up) or the heel (toes up)
      // where the ankle is: a planted foot turns around the ball (heel up) or around the heel (toes up),
      // so the part that touches the ground stays where it is; a foot in the air just turns around the ankle
      let az = 0, ay = ankleH;
      if (S.planted) {
        const ph2 = pitch - slope, pivot = ph2 > 0 ? ballZ : heelZ;
        az = pivot - pivot * Math.cos(ph2) + ankleH * Math.sin(ph2);
        ay = Math.max(ankleH * 0.6, pivot * Math.sin(ph2) + ankleH * Math.cos(ph2));
      }
      F.ankle.set(l2.x + Math.sin(yawL) * az, S.wy - st.y + lift + ay, l2.z + Math.cos(yawL) * az);
    }
  }

  // ---------------------------------------------------------------- the body above the legs
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, next: 2 }, elbowLag = [12, 12];
  let sway = 0;
  function bodyAndArms(dt, speed) {
    const m = st.moving, r = st.run, t = st.time, ph = st.phase * TAU;
    const sgn = speed < 0 ? -1 : 1;
    // ---- hips: turn with the leading leg, drop on the side of the leg in the air, lean when running ----
    // (phase 0 = the left foot lands in front; turning by a positive angle around 'up' brings the RIGHT hip forward)
    const hipYaw = -Math.cos(ph) * lerp(5, 9, r) * DEG * m * sgn;          // the hip of the leading leg goes forward
    const hipRoll = Math.sin(ph - 0.38) * lerp(3.2, 4.5, r) * DEG * m;     // the hip of the swinging leg drops a little
    const leanF = (lerp(2.5, 9, r) * m * sgn + st.lean) * DEG;
    // ---- idle: breathing and shifting the weight ----
    const breathe = Math.sin(t * 1.45) * (1 - m * 0.6), idle = 1 - m;
    sway = Math.sin(t * 0.43) * 0.6 + Math.sin(t * 0.171 + 1.3) * 0.4;
    const shift = sway * 0.022 * k * idle;
    bodyQ.setFromEuler(euler.set(leanF, hipYaw, hipRoll + sway * 1.6 * DEG * idle, 'YXZ'));
    // ---- hips height: as high as the legs allow (so the body sinks when the feet are far apart) ----
    const lateralSway = Math.sin(ph - 0.38) * lerp(0.018, 0.008, r) * k * m;          // over the standing foot
    const nominal = hipsRest.y - (0.012 + 0.03 * r) * k * m - 0.006 * k + breathe * 0.0025 * k;
    let y = nominal + st.bob;
    hipsPos.set(lateralSway + shift, y, hipsRest.z + lerp(0, 0.03, r) * k * m * sgn);
    const reach = legLen * 0.992;
    for (let q = 0; q < 2; q++) {
      tv.copy(restHead('thigh_' + SIDES[q].tag)).sub(hipsRest).applyQuaternion(bodyQ);     // hip joint relative to the hips bone
      const a = foot[q].ankle, dx = hipsPos.x + tv.x - a.x, dz = hipsPos.z + tv.z - a.z, flat = Math.min(reach * 0.98, Math.hypot(dx, dz));
      // a planted foot holds the body down; a foot in the air does not (it would pull the body up and down)
      if (step[q].planted || step[q].t > 0.8 || step[q].t < 0.12) y = Math.min(y, a.y + Math.sqrt(reach * reach - flat * flat) - tv.y);
    }
    // (soft, so the height does not jump from frame to frame)
    st.drop += (Math.min(0, y - (nominal + st.bob)) - st.drop) * (1 - Math.exp(-22 * dt));
    hipsPos.y = nominal + st.bob + st.drop;
    // running: a short flight between the steps lifts the body
    st.bob = Math.max(0, Math.cos(ph * 2 - 5.4)) * 0.035 * k * r * m;

    // ---- spine: turns against the hips, so the shoulders swing opposite to them; breathing in the chest ----
    const counter = -hipYaw * 1.55;
    const spineBend = (v) => lim('spine', v / DEG) * DEG;
    setDelta('spine', spineBend(-leanF * 0.25 + breathe * 0.2 * DEG), spineBend(counter * 0.3), spineBend(-hipRoll * 0.5 - sway * 0.9 * DEG * idle));
    setDelta('spine1', spineBend(-leanF * 0.2 - breathe * 0.7 * DEG), spineBend(counter * 0.35), spineBend(-hipRoll * 0.4 - sway * 0.5 * DEG * idle));
    setDelta('chest', spineBend(-breathe * 0.9 * DEG), spineBend(counter * 0.35), spineBend(-hipRoll * 0.1));
    // ---- head: stays level and looks where the body goes; when idle it looks around slowly ----
    look.next -= dt;
    if (look.next <= 0) { look.next = 2.5 + Math.random() * 4; look.tYaw = (Math.random() - 0.5) * 50 * DEG * idle; look.tPitch = (Math.random() - 0.4) * 12 * DEG * idle; }
    if (m > 0.3 && !lookAt) { look.tYaw = 0; look.tPitch = 0; }
    if (lookAt) { look.tYaw = clamp(lookAt.yaw, -1.3, 1.3); look.tPitch = clamp(lookAt.pitch || 0, -0.5, 0.5); look.next = 1; }     // the story says where to look
    const quick = lookAt ? 5 : 1.6;
    look.yaw += (look.tYaw - look.yaw) * (1 - Math.exp(-quick * dt)); look.pitch += (look.tPitch - look.pitch) * (1 - Math.exp(-quick * dt));
    const chestYaw = hipYaw + counter, headYaw = -chestYaw + look.yaw, headPitch = -leanF * 0.55 + look.pitch + breathe * 0.2 * DEG;
    setDelta('neck', lim('neck', headPitch * 0.4 / DEG) * DEG, lim('neck', headYaw * 0.45 / DEG) * DEG, hipRoll * 0.15);
    setDelta('head', lim('head', headPitch * 0.6 / DEG) * DEG, lim('head', headYaw * 0.55 / DEG) * DEG, hipRoll * 0.15);

    // ---- arms: swing opposite to the leg of the same side; the elbow follows a little later ----
    for (let q = 0; q < 2; q++) {
      const { tag, s } = SIDES[q];
      const a = ph + (q === 0 ? Math.PI : 0);                               // left arm is forward when the right leg is
      const sw = Math.cos(a) * sgn, late = Math.cos(a - 0.5) * sgn;         // (the forearm is 0.5 rad late: overlap)
      const flexWalk = 4 + sw * 22 + (sw < 0 ? sw * 6 : 0), flexRun = 2 + sw * 42;
      const elbowWalk = 14 + Math.max(0, late) * 22 + Math.max(0, -late) * 4, elbowRun = 88 + late * 18;
      const flex = lerp(lerp(2, flexWalk, m), flexRun, r) + breathe * 0.6 * idle;
      const side = lerp(lerp(9, 8, m), 11, r) + breathe * 0.5 * idle + Math.max(0, -s * sway) * 1.2 * idle;
      const want = lerp(lerp(10 + Math.sin(t * 0.7 + q * 2) * 2 * idle, elbowWalk, m), elbowRun, r);
      elbowLag[q] += (want - elbowLag[q]) * (1 - Math.exp(-18 * dt));
      armAngles(q, flex, side, lerp(8, 0, m), elbowLag[q], lerp(6, 10, r));
      // shoulders: rise a little when breathing in, and swing with the arm
      setDelta('clavicle_' + tag, -sw * 2.5 * DEG * m, 0, s * (breathe * 1.3 + 1) * DEG * (1 - r * 0.5));
      // fingers: relaxed curl, a bit more when running, tiny movements when idle
      fingers(q, lerp(26, 52, r) + Math.sin(t * 0.9 + q * 1.7) * 3 * idle + Math.sin(t * 2.3 + q) * 1.2 * idle, lerp(16, 30, r), 1);
    }
  }

  // ---------------------------------------------------------------- driving: sitting, hands on the wheel
  // drive: { steer (-1..1), wheel: [x, y, z] its middle in character space, radius, tilt (radians) }
  let drive = null;
  function drivingPose(dt) {
    const d = drive || {}, t = st.time;
    if (d.bike) { ridingPose(d.bike, clamp(d.steer || 0, -1, 1), t); return; }
    const steer = clamp(d.steer || 0, -1, 1);
    bodyQ.setFromEuler(euler.set(-10 * DEG, 0, -steer * 2 * DEG, 'YXZ'));          // leaning back into the seat
    // the hips sit where the seat is: the caller puts the character's root on the seat cushion
    const seatY = 0.1 * k;
    hipsPos.set(0, seatY + (hipsRest.y - R.thigh_L.head[1]), 0);
    setDelta('spine', 6 * DEG, 0, 0); setDelta('spine1', 5 * DEG, -steer * 3 * DEG, 0); setDelta('chest', 3 * DEG + Math.sin(t * 1.4) * 0.5 * DEG, -steer * 3 * DEG, 0);
    setDelta('neck', -2 * DEG, steer * 6 * DEG, 0); setDelta('head', -2 * DEG, steer * 8 * DEG, 0);
    // legs: thighs forward, knees bent, feet on the pedals
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q], F = foot[q];
      F.ankle.set(s * hipW * 1.15, seatY - 0.13 * k + ankleH * 0.3 + (q === 1 ? 0.012 * k : 0), thighLen * 0.93 + shinLen * 0.52);
      F.yaw = s * 0.12; F.pitch = -0.25; F.toe = 0;
    }
    // hands on the rim of the wheel; they turn with it (not too far, so the arms do not cross)
    const c = d.wheel || [0.0, seatY + 0.52 * k, 0.42 * k], rad = (d.radius || 0.17) * 0.96, tilt = d.tilt ?? 0.38, a = clamp(-steer * 1.15, -1.3, 1.3);
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q];
      const ang = (s > 0 ? Math.PI - 0.32 : 0.32) + a;                              // "10 past 10": left hand at the left, right hand at the right
      const ux = -Math.cos(ang), uy = Math.sin(ang);                                 // on the wheel: across (+ = the character's left) and up
      hand[q].on = true;
      hand[q].p.set(c[0] + ux * rad, c[1] + uy * rad * Math.cos(tilt), c[2] + uy * rad * Math.sin(tilt) - 0.02 * k);   // (the top of the wheel is further away than the bottom)
      setDelta('hand_' + SIDES[q].tag, 0, 0, s * 12 * DEG);
      fingers(q, 68, 42, 0);                                                         // gripping the wheel, thumb around it
      setDelta('clavicle_' + SIDES[q].tag, -6 * DEG, 0, 0);
    }
  }

  // ---------------------------------------------------------------- riding a sports bike
  // b: { grip: [x, y, z] the left grip, peg: [x, y, z] the left footpeg (character space; the right ones are
  // mirrored), turn: how far the handlebars are turned (radians, + = to the left) }
  // The body leans forward over the tank, the head comes up to look down the road, the knees hold the tank,
  // the feet stand on the pegs and the hands hold the grips (they go with the bars when you steer).
  function ridingPose(b, steer, t) {
    bodyQ.setFromEuler(euler.set(16 * DEG, 0, -steer * 3 * DEG, 'YXZ'));
    const seatY = 0.1 * k;
    hipsPos.set(0, seatY + (hipsRest.y - R.thigh_L.head[1]), 0);
    setDelta('spine', 9 * DEG, 0, 0); setDelta('spine1', 7 * DEG, -steer * 3 * DEG, 0); setDelta('chest', 4 * DEG + Math.sin(t * 1.4) * 0.4 * DEG, -steer * 3 * DEG, 0);
    setDelta('neck', -15 * DEG, steer * 5 * DEG, 0); setDelta('head', -13 * DEG, steer * 7 * DEG, 0);
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q], F = foot[q];
      // the ball of the foot on the peg: the ankle a little behind and above it, toes down
      F.ankle.set(s * b.peg[0], b.peg[1] + ankleH * 0.75, b.peg[2] - 0.05 * k);
      F.yaw = s * 0.22; F.pitch = 0.42; F.toe = 0;
    }
    const c = Math.cos(b.turn || 0), sn = Math.sin(b.turn || 0);
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q];
      // the grip turns with the bars about the steering head: the left one comes back when the bars turn left
      const gx = s * b.grip[0], gz = b.grip[2];
      handAt(q, gx * c, b.grip[1], gz - gx * sn, s * 0.75, -0.6, -0.25);
      setDelta('hand_' + SIDES[q].tag, 0, 0, s * 8 * DEG);
      fingers(q, 70, 44, 0);
      setDelta('clavicle_' + SIDES[q].tag, -4 * DEG, 0, 0);
    }
  }

  // ---------------------------------------------------------------- poses for story characters
  // pose: what the arms (or the whole body) do. talk: 0..1 = speaking (a hand moves with the words).
  // lookAt: { yaw, pitch } in radians relative to the body, or null = look around freely.
  let pose = 'idle', talk = 0, talkNow = 0, lookAt = null, floorBelow = 0.45;
  const face = createFaceAnimator(THREE, rig);
  let asleep = false, awake = 'neutral';
  // put a hand at a place (character space); the elbow points along (px, py, pz). The arm is then solved like
  // a real one, so a hand that should rest ON something really is there - it does not hang in the air.
  function handAt(q, x, y, z, px, py, pz) { const A = hand[q]; A.on = true; A.hasPole = true; A.p.set(x, y, z); A.pole.set(px, py, pz); }
  // CARRY: a box in front of the belly, held with both hands - a palm flat on each side of it, the fingers forward
  // and a little down. The box sits where this body can hold it (it rides up and down with the hips while
  // walking), and the arms are solved to its sides like real arms (the elbows down and out), so the hands are ON
  // the box and never inside it. carrySize = { w, h, d }: the size of the box; carryAt: where its middle is.
  let carrySize = null, carryOn = false;
  const carryAt = V(), fingerDir = V(), palmIn = V().set(-1, 0, 0);
  const grip = [0, 0];       // fingers closed around a handle (degrees), left and right hand: 0 = the normal curl
  function carryPose() {
    const w = carrySize ? carrySize.w : 0.38 * k, h = carrySize ? carrySize.h : 0.26 * k, d = carrySize ? carrySize.d : 0.3 * k;
    const handY = hipsPos.y + 0.17 * k;                                 // the hands: about as high as the navel
    // (the back of the box a little in front of the belly; it sways a little with the hips)
    carryAt.set(hipsPos.x * 0.6, handY + h * 0.1, hipsPos.z + 0.15 * k + d / 2);
    const x = w / 2 + 0.026 * k;                                        // the wrist: half a hand outside the side of the box
    const z = carryAt.z - d * 0.16 - 0.035 * k;                         // the palm on the back half of the side, the fingers toward the front
    fingerDir.set(0, -0.3, 1).normalize();
    for (let q = 0; q < 2; q++) {
      const { s, tag } = SIDES[q];
      handAt(q, carryAt.x + s * x, handY, z, s * 0.8, -0.55, -0.25);   // the elbows point down and out
      // the hand lies along the side of the box: the fingers forward, the palm toward the box. (The palm is on the
      // +x side of a left hand's own frame and on the -x side of a right hand's, so x = -1 turns both palms inward.)
      setTarget('hand_' + tag, fingerDir, palmIn);
      fingers(q, 12, 26);
    }
    carryOn = true;
  }
  // standing poses: they only change the arms (and a little of the spine and head)
  function standingPose(dt) {
    const t = st.time;
    talkNow += (talk - talkNow) * (1 - Math.exp(-6 * dt));
    const beat = Math.sin(t * 5.2) * 0.5 + Math.sin(t * 3.1 + 1) * 0.5;               // small hand movements while speaking
    if (pose === 'crossed') { for (let q = 0; q < 2; q++) { armAngles(q, 26 + q * 6, 2, -66, 102 - q * 8, 8); fingers(q, 30); } }
    else if (pose === 'hips') {
      // hands on the hips, the elbows out and a little back
      for (let q = 0; q < 2; q++) { const { s } = SIDES[q]; handAt(q, s * (hipW + 0.075 * k), hipsPos.y + 0.075 * k, hipsPos.z - 0.035 * k, s, -0.05, -0.7); setDelta('hand_' + SIDES[q].tag, 0, 0, -s * 25 * DEG); fingers(q, 40); }
    }
    else if (pose === 'hold') { for (let q = 0; q < 2; q++) { armAngles(q, 24, 3, -36, 70 + talkNow * beat * 4, 6); fingers(q, 62); } }
    else if (pose === 'carry') carryPose();
    else if (pose === 'flag') { armAngles(0, 6, 9, 8, 12); armAngles(1, 166, 12, 0, 8); fingers(1, 60); }
    else if (pose === 'phone') {
      // one hand holds something small in front of the chest, the head is bent over it
      armAngles(0, 4, 9, 8, 12);
      handAt(1, -0.07 * k, hipsPos.y + 0.34 * k, hipsPos.z + 0.29 * k, -0.6, -0.8, -0.25);
      fingers(1, 55); setDelta('neck', 14 * DEG, 0, 0); setDelta('head', 16 * DEG, -6 * DEG, 0);
    }
    else if (pose === 'aim') {
      // both hands forward on a rifle, the body turned a little, the head down on the sight
      armAngles(1, 76, 6, -10, 36, 0); armAngles(0, 68, -6, 18, 60, 0);
      for (let q = 0; q < 2; q++) fingers(q, 62);
      setDelta('spine1', 4 * DEG, -14 * DEG, 0); setDelta('chest', 4 * DEG, -10 * DEG, 0); setDelta('neck', 8 * DEG, 16 * DEG, -6 * DEG); setDelta('head', 4 * DEG, 8 * DEG, -8 * DEG);
    } else if (talkNow > 0.02) {
      // speaking: one hand comes up a little and moves with the words
      armAngles(1, 12 + 20 * talkNow + beat * 5 * talkNow, 10, -8 * talkNow, 12 + 60 * talkNow + beat * 9 * talkNow, 12 * talkNow);
    }
  }
  // sitting: 'sit' = in a car seat (leaning back), 'sitEdge' = on the edge of a bed (leaning forward, head down)
  function sittingPose(dt) {
    const edge = pose === 'sitEdge', t = st.time;
    bodyQ.setFromEuler(euler.set((edge ? 16 : -10) * DEG, 0, 0, 'YXZ'));
    const seatY = 0.1 * k;
    hipsPos.set(0, seatY + (hipsRest.y - R.thigh_L.head[1]), 0);
    setDelta('spine', (edge ? 10 : 6) * DEG); setDelta('spine1', (edge ? 8 : 5) * DEG); setDelta('chest', 3 * DEG + Math.sin(t * 1.4) * 0.6 * DEG);
    if (lookAt) { look.yaw += (clamp(lookAt.yaw, -1.4, 1.4) - look.yaw) * (1 - Math.exp(-4 * dt)); look.pitch += (clamp(lookAt.pitch || 0, -0.5, 0.5) - look.pitch) * (1 - Math.exp(-4 * dt)); }
    else { look.yaw *= Math.exp(-2 * dt); look.pitch += ((edge ? 0.2 : 0) - look.pitch) * (1 - Math.exp(-2 * dt)); }
    setDelta('neck', (edge ? 10 : -2) * DEG + look.pitch * 0.4, look.yaw * 0.45, 0); setDelta('head', (edge ? 8 : -2) * DEG + look.pitch * 0.6, look.yaw * 0.55, 0);
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q], F = foot[q];
      if (edge) F.ankle.set(s * hipW * 1.25, seatY - floorBelow + ankleH, thighLen * 0.92);        // feet flat on the floor in front of the bed
      else F.ankle.set(s * hipW * 1.1, seatY - 0.16 * k + ankleH * 0.3, thighLen * 0.9 + shinLen * 0.5);
      F.yaw = s * 0.1; F.pitch = edge ? 0 : -0.2; F.toe = 0;
      // the hands REST on the legs: on the edge of a bed the forearms lie on the thighs and the hands hang
      // between the knees; in a car seat each hand lies on its own thigh
      if (edge) handAt(q, s * 0.075 * k, seatY + 0.05 * k, thighLen * 0.8, s, 0.15, -0.5);
      else handAt(q, s * hipW * 1.12, seatY + 0.105 * k, thighLen * 0.5, s * 0.7, -0.6, -0.4);
      fingers(q, 35);
    }
  }
  // LYING DOWN: 'lie' = asleep, curled up on one side. 'fallen' = on the back, where somebody fell.
  // The body lies ON the surface it was put on (a bed, the street): hip, shoulder, knees, heels and hands touch
  // it, nothing floats. How far the body sticks out from its bones is measured once from the model itself, so
  // it fits every character (also one with a backpack: then the upper back lies higher than the hips).
  let lieM = null;
  function lieMeasure() {
    if (lieM) return lieM;
    const g = rig.mesh.geometry.attributes.position;
    const hy = hipsRest.y, cy = R.chest ? R.chest.head[1] : hy + 0.3 * k, ny = R.head.head[1], sx = Math.abs(R.upperArm_L.head[0]);
    let low = 1e9, high = 1e9, headBack = 1e9, headSide = 0, hipSide = 0;
    const jump = Math.max(1, Math.floor(g.count / 9000));
    for (let i = 0; i < g.count; i += jump) {
      const x = Math.abs(g.getX(i)), y = g.getY(i), z = g.getZ(i);
      if (x < 0.18 * k && y > hy - 0.16 * k && y < hy + 0.05 * k && z < low) low = z;            // the seat
      if (x < 0.2 * k && y > cy - 0.1 * k && y < cy + 0.2 * k && z < high) high = z;             // the upper back (or a backpack)
      if (y > ny + 0.03 * k) { if (x < 0.1 * k && z < headBack) headBack = z; if (x > headSide) headSide = x; }
      if (y > hy - 0.12 * k && y < hy + 0.04 * k && x > hipSide && x < hipW + 0.14 * k) hipSide = x;
    }
    if (low > 1e8) low = hipsRest.z - 0.11 * k;
    if (high > 1e8) high = low;
    if (headBack > 1e8) headBack = R.head.head[2] - 0.1 * k;
    const span = Math.max(0.2 * k, cy + 0.05 * k - hy);                    // from the seat to the shoulder blades
    lieM = {
      seat: hipsRest.z - low,                                             // on the back: the hips are this far above the surface
      tilt: Math.asin(clamp((low - high) / span, 0, 0.5)),                // ... and the chest end lies this much higher (radians)
      headBack: R.head.head[2] - headBack,
      hipSide: hipSide || hipW + 0.09 * k,                                // on the side: half the width of the hips,
      shoulderSide: sx + 0.05 * k,                                        // of the shoulders,
      headSide: headSide || 0.09 * k,                                     // and of the head
      span, heelUp: -heelZ, handUp: 0.035 * k,
    };
    return lieM;
  }
  const qa = Q(), qb = Q();
  // ASLEEP: on the right side, curled up a little. The face looks to the character's right.
  function sleepPose() {
    const M = lieMeasure(), t = st.time;
    // the shoulders are wider than the hips: the head end lies a little higher
    const tilt = Math.asin(clamp((M.shoulderSide - M.hipSide) / M.span, -0.3, 0.3));
    bodyQ.setFromAxisAngle(X_AXIS, tilt).multiply(qa.setFromAxisAngle(Z_AXIS, Math.PI / 2)).multiply(qb.setFromAxisAngle(X_AXIS, -Math.PI / 2));
    hipsPos.set(0, M.hipSide + 0.004, 0);
    const breathe = Math.sin(t * 1.1) * 1.2 * DEG;
    // a rounded back, the head sunk toward the pillow, the chin toward the chest
    setDelta('spine', 9 * DEG); setDelta('spine1', 8 * DEG); setDelta('chest', 6 * DEG + breathe);
    setDelta('neck', 10 * DEG, 0, -11 * DEG); setDelta('head', 8 * DEG, 0, -10 * DEG);
    const hipZ = hipsRest.y - R.thigh_L.head[1];
    legIK = true;
    for (let q = 0; q < 2; q++) {
      const F = foot[q], under = q === 1;                                 // the right leg lies under the left one
      F.loose = true; F.pitch = 0.25; F.toe = 0;
      // knees forward (toward the face side, -x). The upper leg rests in front of the lower one, its knee on the bed.
      if (under) { F.ankle.set(0.06 * k, 0.05 * k, hipZ + legLen * 0.74); F.pole.set(-1, 0.05, 0.25); }
      else { F.ankle.set(-0.2 * k, 0.055 * k, hipZ + legLen * 0.6); F.pole.set(-1, -0.35, 0.3); }
    }
    for (let q = 0; q < 2; q++) {
      const A = hand[q], under = q === 1;
      A.on = true; A.hasPole = true;
      // the lower arm lies forward on the bed, the hand near the face. The upper arm rests in front of the chest.
      // (the hand under the face rests IN FRONT of the pillow, on the bed - not inside the pillow)
      if (under) { A.p.set(-0.42 * k, M.handUp, -(M.span + 0.2 * k)); A.pole.set(-0.7, 0.25, 0.65); }
      else { A.p.set(-0.3 * k, M.handUp + 0.01, -(M.span * 0.45)); A.pole.set(-0.3, 0.6, 0.75); }
      fingers(q, 32, 14);
    }
  }
  // FALLEN: on the back. One knee up and to the side, one arm thrown out with the hand open.
  function fallenPose() {
    const M = lieMeasure();
    bodyQ.setFromAxisAngle(X_AXIS, -Math.PI / 2 + M.tilt);
    hipsPos.set(0, M.seat * Math.cos(M.tilt) + 0.004, 0);
    setDelta('spine1', 0, 0, 4 * DEG); setDelta('chest', 0, 0, 3 * DEG);
    // the head falls back until it touches the ground (as far as a neck allows), turned away
    const headY = hipsPos.y + Math.sin(M.tilt) * (R.head.head[1] - hipsRest.y) + Math.cos(M.tilt) * (R.head.head[2] - hipsRest.z) - M.headBack;
    const drop = clamp(headY / (0.22 * k), 0, 0.55);
    setDelta('neck', -drop * 0.55, 20 * DEG, 0); setDelta('head', -drop * 0.45, 26 * DEG, 0);
    legIK = true;
    const hipZ = hipsRest.y - R.thigh_L.head[1];
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q], F = foot[q];
      F.lying = true;
      F.ankle.set(s * hipW * (q ? 1.15 : 1.9), M.heelUp + 0.006, hipZ + legLen * (q ? 0.992 : 0.88));
      F.yaw = s * (q ? 0.3 : 0.7); F.pitch = 0.4; F.toe = 0;                // the feet fall outward, the toes relax
    }
    for (let q = 0; q < 2; q++) {
      const { s } = SIDES[q], A = hand[q];
      A.on = true; A.hasPole = true;
      if (q === 0) { A.p.set(s * (hipW + 0.5 * k), M.handUp, -0.34 * k); A.pole.set(s * 0.3, -0.2, 1); }     // thrown out, the open hand on the ground
      else { A.p.set(s * (hipW + 0.2 * k), M.handUp, 0.01 * k); A.pole.set(s, -0.25, 0); }                  // beside the body
      fingers(q, 16, 10);
    }
  }

  // ---------------------------------------------------------------- swimming
  // The caller puts the root of the character AT the water surface (y = 0 is the surface). Two strokes,
  // blended by the speed:
  //   * TREADING WATER (still): the body upright, the head and the top of the shoulders out of the water.
  //     The hands scull under the surface (small sweeps out and in), the legs turn slowly like an egg beater.
  //   * FRONT CRAWL with the head up (moving): the body lies almost flat just under the surface and rolls a
  //     little from side to side. One arm pulls under the water while the other one comes forward over it with
  //     a high elbow. The legs kick fast and small from the hips, the toes pointed.
  // The hands and feet are placed with the same arm and leg solver as always, so the joint limits still hold.
  const SW = { k: 0, ph: 0 };
  const shoulderRest = restHead('upperArm_L');
  const swP = V(), swE = V();
  // a point in BODY space (from the hips: +Y toward the head, +Z the chest side, +X the left) -> character space
  const fromBody = (out, x, y, z) => out.set(x, y, z).applyQuaternion(bodyQ).add(hipsPos);
  function swimPose(dt, speed) {
    const t = st.time;
    SW.k += (smooth((Math.abs(speed) - 0.15) / 0.7) - SW.k) * (1 - Math.exp(-3 * dt));
    const w = SW.k;                                         // 0 = treading water, 1 = swimming
    // one stroke = both arms once (faster swimming, faster strokes)
    SW.ph = frac(SW.ph + dt * lerp(0.62, 0.42 + 0.22 * Math.min(2.2, Math.abs(speed)), w));
    const ph = SW.ph * TAU;
    // ---- the body: upright when treading, almost flat when swimming; it rolls toward the arm that pulls ----
    const pitch = lerp(6, 74, w) * DEG, roll = -Math.sin(ph) * 22 * DEG * w;
    bodyQ.setFromAxisAngle(X_AXIS, pitch).multiply(qa.setFromAxisAngle(Y_AXIS, roll));
    // the shoulders stay just under the surface (treading: the body bobs a little with the kicks)
    const sy = shoulderRest.y - hipsRest.y, sz = shoulderRest.z - hipsRest.z;
    tv.set(0, sy, sz).applyQuaternion(bodyQ);
    const bob = Math.sin(t * TAU * 1.5) * 0.014 * k * (1 - w);
    hipsPos.set(0, -tv.y - lerp(0.05, 0.09, w) * k + bob, -0.3 * k * w);
    // ---- spine and head: a long body; the neck bends back so the face stays out of the water ----
    setDelta('spine', -3 * DEG * w, roll * 0.15, 0);
    setDelta('spine1', -3 * DEG * w, roll * 0.1, 0);
    if (lookAt) { look.yaw += (clamp(lookAt.yaw, -1.2, 1.2) - look.yaw) * (1 - Math.exp(-4 * dt)); look.pitch += (clamp(lookAt.pitch || 0, -0.4, 0.4) - look.pitch) * (1 - Math.exp(-4 * dt)); }
    else { look.yaw *= Math.exp(-2 * dt); look.pitch *= Math.exp(-2 * dt); }
    const lift = (pitch / DEG - 12);                       // degrees the head has to come up to look ahead
    const turnHead = look.yaw * (1 - w * 0.7);
    setDelta('neck', -lim('neck', lift * 0.45) * DEG + look.pitch * 0.4, lim('neck', (-roll * 0.4 + turnHead * 0.45) / DEG) * DEG, 0);
    setDelta('head', -lim('head', lift * 0.55) * DEG + look.pitch * 0.6, lim('head', (-roll * 0.3 + turnHead * 0.55) / DEG) * DEG, 0);
    // ---- arms ----
    const reach = (upperLen + foreLen) * 0.97;
    for (let q = 0; q < 2; q++) {
      const { tag, s } = SIDES[q];
      const shx = s * Math.abs(shoulderRest.x);
      // treading: the hands scull in front of the chest, a hand's length under the water
      const sc = Math.sin(t * TAU * 0.9 + q * 0.6);
      const tx = shx + s * (0.1 + 0.12 * sc) * k, ty = sy - 0.26 * k, tz = sz + (0.3 + 0.04 * Math.cos(t * TAU * 0.9 + q * 0.6)) * k;
      // the crawl: the hand goes round the shoulder in the plane of the body. 0 = reaching forward past the
      // head, a quarter = under the chest, a half = back at the hip (the pull, under the water); the second half
      // comes forward again over the water, the elbow high and the hand wide past the head.
      const p = frac(SW.ph + q * 0.5);
      let a, r, ox, ex, ey, ez;
      if (p < 0.5) {
        const u = p / 0.5;
        a = (u * 0.75 + smooth(u) * 0.25) * Math.PI;
        r = reach * (0.95 - 0.22 * Math.sin(a));                 // (the elbow bends most under the chest)
        ox = s * (0.03 - 0.1 * Math.sin(a)) * k;                 // (an S: the hand comes in under the body)
        ex = s * 0.9; ey = 0.1; ez = -0.45;                      // the elbow out to the side and up
      } else {
        const u = (p - 0.5) / 0.5;
        a = Math.PI * (1 + smooth(u));
        r = reach * (0.88 - 0.32 * Math.sin(u * Math.PI));
        ox = s * (0.08 + 0.24 * Math.sin(u * Math.PI)) * k;
        ex = s * 0.45; ey = -0.15; ez = -1;                      // the elbow up, out of the water
      }
      const hx = shx + ox, hy = sy + Math.cos(a) * r, hz = sz + Math.sin(a) * r;
      fromBody(swP, lerp(tx, hx, w), lerp(ty, hy, w), lerp(tz, hz, w));
      swE.set(lerp(s, ex, w), lerp(-0.35, ey, w), lerp(-0.6, ez, w)).applyQuaternion(bodyQ);
      handAt(q, swP.x, swP.y, swP.z, swE.x, swE.y, swE.z);
      setDelta('hand_' + tag, 0, 0, -s * lerp(12 * sc, 14, w) * DEG);
      fingers(q, lerp(16, 8, w), 12, 0);
    }
    // ---- legs ----
    legIK = true;
    const kick = SW.ph * 3;                                        // a six-beat kick: three kicks of each leg per stroke
    for (let q = 0; q < 2; q++) {
      const { tag, s } = SIDES[q], F = foot[q];
      const hj = tv2.copy(restHead('thigh_' + tag)).sub(hipsRest);  // the hip joint (body space)
      // treading: an egg beater (each foot goes round in a circle under its knee)
      const e = t * TAU * 0.75 + q * Math.PI;
      const tx = hj.x + s * 0.08 * k, ty = hj.y - legLen * 0.8 + Math.sin(e) * 0.06 * k, tz = hj.z + (0.14 + Math.cos(e) * 0.1) * k;
      // the crawl: an almost straight leg behind the body that kicks from the hip
      const f = Math.sin(TAU * kick + q * Math.PI);
      const cx = hj.x * 0.75, cy = hj.y - legLen * 0.95, cz = hj.z + f * 0.13 * k;
      fromBody(F.ankle, lerp(tx, cx, w), lerp(ty, cy, w), lerp(tz, cz, w));
      F.loose = true;
      F.pole.set(s * lerp(0.35, 0.05, w), lerp(0, -0.1, w), 1).applyQuaternion(bodyQ);   // the knees point forward (down, when swimming)
      F.pitch = (lerp(22, 55, w) + f * 8 * w) * DEG; F.toe = 0; F.yaw = 0;               // toes pointed
    }
  }

  // ---------------------------------------------------------------- test poses (rig test screen)
  function testPose(name) {
    bodyQ.identity(); hipsPos.copy(hipsRest);
    for (let q = 0; q < 2; q++) { const { s } = SIDES[q]; foot[q].ankle.set(R['foot_' + SIDES[q].tag].head[0], ankleH, R.foot_L.head[2]); foot[q].yaw = s * 0.0; foot[q].pitch = 0; foot[q].toe = 0; }
    if (name === 'armsForward') { for (let q = 0; q < 2; q++) { armAngles(q, 90, 0, 0, 0); fingers(q, 10); } }
    else if (name === 'deepBend') {
      // deep knee bend: the hips go down and back, the body leans forward to keep the balance; elbows bent 120 degrees
      const depth = 0.42 * legLen;
      hipsPos.y -= depth; hipsPos.z -= 0.17 * k;
      bodyQ.setFromAxisAngle(X_AXIS, 24 * DEG);
      setDelta('spine', 8 * DEG); setDelta('spine1', 6 * DEG); setDelta('neck', -14 * DEG); setDelta('head', -12 * DEG);
      for (let q = 0; q < 2; q++) { armAngles(q, 62, 12, 0, 120); fingers(q, 40); foot[q].yaw = SIDES[q].s * 0.14; }
    }
  }
  // the plain rest pose: no targets at all, exactly as the skin was bound
  function restPose() {
    for (const n of names) { const bone = B[n], r = R[n]; bone.quaternion.copy(r.quaternion); bone.position.copy(r.position); }
  }

  // ---------------------------------------------------------------- every frame
  let mode = 'auto', swimming = false;
  // s: { speed (m/s, forward +), x, z (where the character stands in the world), y (height of its root), heading (radians),
  //      groundAt(x, z) -> height, inPlace (walk on the spot), swim (true: in deep water, the root is at the surface) }
  function update(dt, s = {}) {
    dt = Math.min(dt, 0.05);
    st.time += dt;
    blendT = Math.min(1, blendT + dt / blendLen);
    if (mode === 'apose') {
      restPose();
      if (blendT < 1) { const t = smooth(blendT); for (const n of names) B[n].quaternion.slerpQuaternions(snapshot[n], B[n].quaternion, t); B.hips.position.lerpVectors(snapPos, B.hips.position, t); }
      if (face) face.update(dt, 0, false);
      return;
    }
    const speed = s.speed || 0;
    carryOn = false;
    st.heading = s.heading || 0; st.ground = s.groundAt || null;
    if (s.inPlace) { vx += Math.sin(st.heading) * speed * dt; vz += Math.cos(st.heading) * speed * dt; st.x = vx; st.z = vz; st.y = 0; st.ground = null; }
    else { st.x = s.x || 0; st.z = s.z || 0; st.y = s.y || 0; }
    st.speed = speed;
    legIK = true;
    // into the water / out of it: a soft change of the whole body; out of it the feet stand where he is
    const swim = !!s.swim && mode === 'auto';
    if (swim !== swimming) {
      startBlend(0.45);
      swimming = swim;
      if (swim) SW.k = smooth((Math.abs(speed) - 0.15) / 0.7);
      else { for (const S of step) { S.first = true; S.planted = true; S.t = 1; S.gait = false; } st.drop = 0; }
    }
    if (mode === 'drive') drivingPose(dt);
    else if (mode === 'armsForward' || mode === 'deepBend') testPose(mode);
    else if (swimming) swimPose(dt, speed);
    else if (pose === 'sit' || pose === 'sitEdge') sittingPose(dt);
    else if (pose === 'lie') sleepPose();
    else if (pose === 'fallen') fallenPose();
    else { locomotion(dt, speed, 0); bodyAndArms(dt, speed); if (pose !== 'idle' || talk > 0 || talkNow > 0.02) standingPose(dt); }
    // a hand that holds something by its handle (a case): the fingers close around it
    for (let q = 0; q < 2; q++) if (grip[q] > 0 && mode !== 'drive') fingers(q, grip[q], grip[q] * 0.75);
    apply();
    // the face (faceAnim.js): its expression, blinking, the jaw while speaking; asleep = eyes shut
    if (face) { if (pose === 'lie' && !asleep) { asleep = true; awake = face.name; face.set('asleep', 0.6); } else if (pose !== 'lie' && asleep) { asleep = false; face.set(awake, 0.5); } face.update(dt, talk, asleep); }
  }
  function setMode(next, seconds = 0.2) {
    if (next === mode) return;
    startBlend(seconds);
    // coming back to walking: the feet stand where the character is now
    if (next === 'auto') for (const S of step) { S.first = true; S.planted = true; S.t = 1; S.gait = false; }
    mode = next;
  }
  // put the feet under the body at once (after the character was moved far in one go)
  function reset() { for (const S of step) { S.first = true; S.planted = true; S.t = 1; } st.drop = 0; }

  // story: change the pose (blends over "seconds")
  function setPose(next, seconds = 0.35) {
    if (next === pose) return;
    startBlend(seconds);
    const wasDown = pose === 'sit' || pose === 'sitEdge' || pose === 'fallen' || pose === 'lie';
    pose = next;
    if (wasDown) for (const S of step) { S.first = true; S.planted = true; S.t = 1; S.gait = false; }
  }

  return {
    update, setMode, reset, LIMITS, setPose,
    get pose() { return pose; },
    set talk(v) { talk = v; },
    // the expression of the face: a name from FACES in faceAnim.js ('smile', 'sad', 'angry' ...). seconds: how softly it changes.
    setFace(name, seconds = 0.35) { if (!face) return; if (asleep) awake = name; else face.set(name, seconds); },
    set face(name) { this.setFace(name); },
    get face() { return face ? (asleep ? awake : face.name) : null; },
    get faces() { return face ? face.names : []; },
    set blinks(on) { if (face) face.blinks = on; },
    set look(v) { lookAt = v; },
    // 'sitEdge': how far the floor is below the character's root (meters)
    set floorBelow(v) { floorBelow = v; },
    // a box held with both hands (pose 'carry'): its size { w, h, d } (null = a parcel). carryAt: where the middle of
    // the box is right now, in the character's own space (null when no box is held this frame)
    set carry(c) { carrySize = c || null; },
    get carryAt() { return carryOn ? carryAt : null; },
    // a hand that holds something by its handle: tag 'L' or 'R', how far the fingers close (degrees, 0 = normal)
    setGrip(tag, curl) { grip[tag === 'L' ? 0 : 1] = curl || 0; },
    get mode() { return mode; },
    get swimming() { return swimming; },
    // where the stroke is (0..1, one stroke = both arms once) - for the splash of each hand
    get stroke() { return SW.ph; },
    set drive(d) { drive = d; },
    // for tests: is a foot on the ground, and where (world)
    get feet() { return step.map((S, q) => ({ planted: S.planted, x: S.wx, z: S.wz, knee: foot[q].knee })); },
    get phase() { return st.phase; },
  };
}
