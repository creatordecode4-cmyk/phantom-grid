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
  const foot = SIDES.map(({ s }) => ({ ankle: new THREE.Vector3(s * footHomeX, ankleH, R.foot_L.head[2]), yaw: 0, pitch: 0, toe: 0, knee: 0 }));
  const thighD = V(), shinD = V(), hingeL = V(), poleL = V(), footQ = Q();
  function legResolver(q) {
    const { tag, s } = SIDES[q];
    return (hip) => {
      const F = foot[q];
      // the knee points where the foot points (a little outward, like real legs)
      poleL.set(Math.sin(F.yaw + s * 0.07), 0, Math.cos(F.yaw + s * 0.07));
      F.knee = twoBone(hip, F.ankle, thighLen, shinLen, poleL, LIMITS.knee[1], thighD, shinD);
      hingeL.crossVectors(thighD, poleL);
      if (hingeL.lengthSq() < 1e-6) hingeL.set(-1, 0, 0);
      setTarget('thigh_' + tag, thighD, hingeL);
      setTarget('shin_' + tag, shinD, hingeL);
      // the foot: its rest direction, turned by yaw and pitch (pitch + = toes down). The ankle has limits too.
      const shinPitch = Math.atan2(shinD.z, -shinD.y);                       // how far the shin leans forward (+) or back (-)
      const pitch = clamp(F.pitch, (LIMITS.ankle[0] * DEG) - shinPitch, (LIMITS.ankle[1] * DEG) - shinPitch);
      footQ.setFromAxisAngle(Y_AXIS, F.yaw).multiply(tq.setFromAxisAngle(X_AXIS, pitch));
      target['foot_' + tag].copy(footQ).multiply(R['foot_' + tag].world);
      hasTarget['foot_' + tag] = true;
      setDelta('toe_' + tag, -F.toe, 0, 0);
    };
  }
  resolvers.thigh_L = legResolver(0); resolvers.thigh_R = legResolver(1);

  // ---------------------------------------------------------------- hands on something (IK), used when driving
  const hand = [{ on: false, p: V(), dir: V() }, { on: false, p: V(), dir: V() }];
  const upD = V(), foD = V(), hingeA = V(), poleA = V();
  function armResolver(q) {
    const { tag, s } = SIDES[q];
    return (shoulder) => {
      if (!hand[q].on) return;
      poleA.set(s * 0.55, -0.8, -0.25);                                   // elbows point down and a little out
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
    hand[0].on = hand[1].on = false;
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
  const groundAt = (wx, wz) => (st.ground ? st.ground(wx, wz) : 0);
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
    if (m > 0.3) { look.tYaw = 0; look.tPitch = 0; }
    look.yaw += (look.tYaw - look.yaw) * (1 - Math.exp(-1.6 * dt)); look.pitch += (look.tPitch - look.pitch) * (1 - Math.exp(-1.6 * dt));
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
  let mode = 'auto';
  // s: { speed (m/s, forward +), x, z (where the character stands in the world), y (height of its root), heading (radians),
  //      groundAt(x, z) -> height, inPlace (walk on the spot) }
  function update(dt, s = {}) {
    dt = Math.min(dt, 0.05);
    st.time += dt;
    blendT = Math.min(1, blendT + dt / blendLen);
    if (mode === 'apose') {
      restPose();
      if (blendT < 1) { const t = smooth(blendT); for (const n of names) B[n].quaternion.slerpQuaternions(snapshot[n], B[n].quaternion, t); B.hips.position.lerpVectors(snapPos, B.hips.position, t); }
      return;
    }
    const speed = s.speed || 0;
    st.heading = s.heading || 0; st.ground = s.groundAt || null;
    if (s.inPlace) { vx += Math.sin(st.heading) * speed * dt; vz += Math.cos(st.heading) * speed * dt; st.x = vx; st.z = vz; st.y = 0; st.ground = null; }
    else { st.x = s.x || 0; st.z = s.z || 0; st.y = s.y || 0; }
    st.speed = speed;
    if (mode === 'drive') drivingPose(dt);
    else if (mode === 'armsForward' || mode === 'deepBend') testPose(mode);
    else { locomotion(dt, speed, 0); bodyAndArms(dt, speed); }
    apply();
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

  return {
    update, setMode, reset, LIMITS,
    get mode() { return mode; },
    set drive(d) { drive = d; },
    // for tests: is a foot on the ground, and where (world)
    get feet() { return step.map((S, q) => ({ planted: S.planted, x: S.wx, z: S.wz, knee: foot[q].knee })); },
    get phase() { return st.phase; },
  };
}
