// ---------------------------------------------------------------------------
// animStates.js - THE ACTIONS of a character, on top of walking and standing.
//
// proceduralAnim.js works out walking, running and standing every frame. This file adds what the character DOES,
// as one small state machine. Only one action runs at a time; crouching and looking are layers that stay on.
//
//   ACTION      what it looks like                                            how long   can be stopped by moving
//   pickup      walk up, knees and hips bend, the right hand reaches the      1.2 s      after 1.0 s
//               object (arm IK), holds 0.3 s, stands up; the object goes
//               into the right hand
//   attack      wind-up (0.15 s): the hand goes back, the hips turn away;     0.6 s      after 0.3 s
//               strike (0.15 s) forward with the arm AND the hips; recover
//               (0.3 s). The hit lands in the middle of the strike.
//   getHit      the head and the spine jerk back, the arms come up a little,  0.45 s     after 0.2 s
//               back to normal in 0.4 s
//   enterCar    a hand goes to the door, the body folds down to the seat      0.4 s      no
//   exitCar     the other way round: folded, then up, the hand leaves the door 0.5 s     no
//   jump        crouch (0.12 s), up - the arms rise, the knees fold - and     air time   no
//               the landing: the knees give (0.28 s), a small camera shake    + 0.28 s
//   look        the head turns to a point (at most 60 degrees), softly        seconds    -
//
//   CROUCH (stealth) is a layer that is on or off: the hips go down (the knees bend about 60 degrees), the body
//   leans forward, the arms are held in front; the steps get short and slow.
//   LOOK can also run as a layer: lookAt(point) - the head follows a clue, a person, another player.
//
// BLENDING: every action comes in and goes out over 0.15 s. Hands that reach for something come softly from where
// the arm was swinging (the arm solver's "mix"), so nothing snaps.
//
// The state's name (stateName) is what an online game sends to the other players (src/net/online.js).
//
//   const actions = createActionLayer({ anim, handBone });  anim.overlay = actions.overlay;
//   actions.play('pickup', { at: [x, y, z], onGrab(), onEnd() });  actions.play('attack', { onStrike() });
//   actions.crouch = true;  actions.lookAt([x, y, z]) / lookAt(null);  actions.update(dt) - the timers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;
const BLEND = 0.15;

// how long each action lasts, and from when on moving may stop it
export const ACTIONS = {
  pickup: { dur: 1.2, min: 1.0, lock: true },
  attack: { dur: 0.6, min: 0.3, lock: true },
  getHit: { dur: 0.45, min: 0.2, lock: true },
  enterCar: { dur: 0.4, min: 0.4, lock: true },
  exitCar: { dur: 0.5, min: 0.5, lock: true },
  jump: { dur: 9, min: 9, lock: false },          // (as long as it is in the air; the player ends it on landing)
  look: { dur: 2.5, min: 0, lock: false },
};
export const ACTION_NAMES = Object.keys(ACTIONS);

export function createActionLayer({ anim, debug = false } = {}) {
  let cur = null;                   // { name, t, dur, min, o, w, done }
  let crouchOn = false, crouchK = 0;
  let lookPt = null, lookW = 0, lookYaw = 0, lookPitch = 0, storyLook = false;
  let jumpPhase = 'none', airT = 0, landT = 9, landHard = 0;
  let V3 = null, tmp = null, tmp2 = null;
  const log = (...a) => { if (api.debug) console.log('[anim]', ...a); };

  // ---- locomotion state, and how long the blend between them took (for the ANIM TEST screen) ----
  let loco = 'idle', blendFrom = null, blendStart = 0, clock = 0, lastBlend = 0;
  function trackLocomotion() {
    const g = anim.gait;
    const want = g.moving < 0.5 ? (crouchK > 0.5 ? 'crouch' : 'idle') : g.run > 0.5 ? 'run' : crouchK > 0.5 ? 'crouchWalk' : 'walk';
    if (want !== loco) { blendFrom = loco; blendStart = clock; loco = want; }
    // (the blend is finished when the walk numbers are within 10 % of where they are going)
    if (blendFrom) {
      const tMoving = loco === 'idle' || loco === 'crouch' ? 0 : 1, tRun = loco === 'run' ? 1 : 0;
      if (Math.abs(g.moving - tMoving) < 0.1 && Math.abs(g.run - tRun) < 0.1) {
        lastBlend = clock - blendStart;
        log(`${blendFrom} -> ${loco}: blend ${lastBlend.toFixed(2)} s`);
        blendFrom = null;
      }
    }
  }

  function play(name, o = {}) {
    const A = ACTIONS[name];
    if (!A) return false;
    // (an action does not stop one that cannot be stopped yet - except being hit, which always comes through)
    // (the car door always comes through too: the player was out of sight in the seat, so the last action may never have ended)
    const always = name === 'getHit' || name === 'enterCar' || name === 'exitCar';
    if (cur && cur.t < cur.min && !always && name !== cur.name) return false;
    if (cur && cur.name === name && !always && name !== 'look') return false;
    if (cur && cur.o.onEnd && !cur.ended) { cur.ended = true; cur.o.onEnd(false); }
    cur = { name, t: 0, dur: o.seconds || A.dur, min: Math.min(A.min, o.seconds || A.min), o, lock: A.lock, grabbed: false, struck: false, ended: false };
    if (name === 'jump') { jumpPhase = 'prep'; airT = 0; }
    if (name === 'look') lookPt = o.at ? [...o.at] : null;
    log(`play ${name} (blend in ${BLEND} s)`);
    return true;
  }
  function stop(why = 'stop') {
    if (!cur) return;
    if (cur.o.onEnd && !cur.ended) { cur.ended = true; cur.o.onEnd(why === 'end'); }
    log(`${why} ${cur.name} after ${cur.t.toFixed(2)} s (blend out ${BLEND} s)`);
    if (cur.name === 'look') lookPt = null;
    cur = null;
  }

  // ---- the timers (once a frame, before the character moves) ----
  function update(dt) {
    clock += dt;
    crouchK += ((crouchOn ? 1 : 0) - crouchK) * (1 - Math.exp(-12 * dt));          // (about 0.2 s)
    anim.crouch = crouchK;
    landT += dt;
    if (cur) {
      cur.t += dt;
      if (cur.name === 'jump') { if (jumpPhase === 'air') airT += dt; }
      else if (cur.t >= cur.dur) stop('end');
    }
    trackLocomotion();
  }

  // ---- the pose (called by the animator every frame, after walking and standing) ----
  function overlay(P, dt) {
    if (!V3) { V3 = new P.THREE.Vector3(); tmp = new P.THREE.Vector3(); tmp2 = new P.THREE.Quaternion(); }
    const { k, hipsPos, bodyQ, euler, legLen } = P;
    const hy = hipsPos.y, hz = hipsPos.z;
    // a turn of the whole body (hips and everything above): pitch forward (+), yaw (+ = the right hip comes forward)
    const turnBody = (pitch, yaw = 0, roll = 0) => { if (pitch || yaw || roll) bodyQ.multiply(tmp2.setFromEuler(euler.set(pitch, yaw, roll, 'YXZ'))); };

    // ---------------- CROUCH (a layer) ----------------
    if (crouchK > 0.002) {
      const c = crouchK;
      hipsPos.y -= 0.115 * k * c;                       // (knees bent about 60 degrees)
      hipsPos.z -= 0.03 * k * c;
      turnBody(13 * DEG * c);
      P.addDelta('spine1', 6 * DEG * c); P.addDelta('neck', -10 * DEG * c); P.addDelta('head', -8 * DEG * c);
      // the arms in front, ready (only when no action uses the hands)
      if (!cur || cur.name === 'look') {
        const w = 0.75 * c;
        P.handTo(0, 0.16 * k, hy + 0.2 * k, hz + 0.33 * k, 0.6, -0.7, -0.2, w);
        P.handTo(1, -0.16 * k, hy + 0.2 * k, hz + 0.33 * k, -0.6, -0.7, -0.2, w);
      }
    }

    // ---------------- LOOK (a layer): the head turns to a point, at most 60 degrees ----------------
    const pt = cur && cur.name === 'look' ? lookPt : lookPt;
    let want = 0;
    if (pt && !storyLook) {
      P.toLocal(pt[0], pt[1], pt[2], V3);
      const eyeY = hy + 0.68 * k;
      const yaw = Math.atan2(V3.x, V3.z), dist = Math.hypot(V3.x, V3.z);
      // (behind him, further than 60 degrees: he does not twist round - the look fades out)
      if (Math.abs(yaw) < 100 * DEG && dist > 0.3) {
        want = 1;
        lookYaw += (clamp(yaw, -60 * DEG, 60 * DEG) - lookYaw) * (1 - Math.exp(-6 * dt));
        lookPitch += (clamp(-Math.atan2(V3.y - eyeY, dist), -35 * DEG, 40 * DEG) - lookPitch) * (1 - Math.exp(-6 * dt));
      }
    }
    lookW += (want - lookW) * (1 - Math.exp(-7 * dt));
    P.st.lookHold = lookW > 0.05;
    if (lookW > 0.01) {
      const w = lookW;
      // (the neck takes a little less than the head; the chest helps a little for a big turn)
      P.addDelta('chest', 0, lookYaw * 0.15 * w, 0);
      P.addDelta('neck', lookPitch * 0.4 * w, lookYaw * 0.38 * w, 0);
      P.addDelta('head', lookPitch * 0.6 * w, lookYaw * 0.47 * w, 0);
    }

    // ---------------- the landing of a jump (it can overlap the next action) ----------------
    if (landT < 0.3) {
      const d = Math.sin(Math.PI * clamp(landT / 0.28, 0, 1)) * (0.6 + 0.4 * landHard);
      hipsPos.y -= 0.13 * k * d; turnBody(9 * DEG * d);
      P.addDelta('neck', -6 * DEG * d);
    }

    if (!cur) return;
    const t = cur.t, o = cur.o;
    // in and out over 0.15 s
    const w = cur.name === 'jump' ? 1 : smooth(t / BLEND) * smooth((cur.dur - t) / BLEND);

    // ---------------- PICK UP ----------------
    if (cur.name === 'pickup') {
      // down 0.42 s, hold until 0.72 s (the hand takes the object at 0.45 s), up until 1.2 s
      const b = t < 0.42 ? smooth(t / 0.42) : t < 0.72 ? 1 : 1 - smooth((t - 0.72) / 0.48);
      // where the object is, in the character's space (not further than the arm can reach, not under the ground)
      if (o.at) P.toLocal(o.at[0], o.at[1], o.at[2], V3); else V3.set(-0.12 * k, 0.04 * k, 0.45 * k);
      V3.y = Math.max(V3.y, 0.035 * k);
      // how low the hips go depends on how low the object lies (a thing on a table: only a small bend)
      const low = clamp(1 - V3.y / (0.9 * k), 0, 1);
      hipsPos.y -= 0.4 * k * b * low; hipsPos.z -= 0.1 * k * b * low;
      turnBody(lerp(20, 58, low) * DEG * b);
      P.addDelta('spine', 8 * DEG * b * low); P.addDelta('spine1', 10 * DEG * b * low);
      P.addDelta('neck', -12 * DEG * b * low); P.addDelta('head', -6 * DEG * b);
      // the right hand: to the object; after the grab it brings it up toward the belly
      if (t >= 0.45 && !cur.grabbed) { cur.grabbed = true; if (o.onGrab) o.onGrab(); }
      const up = t < 0.72 ? 0 : smooth((t - 0.72) / 0.48);
      tmp.set(-0.17 * k, hy + 0.1 * k, hz + 0.24 * k);
      V3.lerp(tmp, up);
      P.handTo(1, V3.x, V3.y + 0.02 * k, V3.z, -0.4, -0.5, -0.8, smooth(t / 0.3) * (1 - smooth((t - 0.95) / 0.25)));
      P.fingers(1, t < 0.45 ? 8 : 62, t < 0.45 ? 10 : 40);
      // the left hand rests on the left knee
      P.handTo(0, 0.14 * k, hipsPos.y - 0.02 * k, hipsPos.z + 0.3 * k, 0.6, -0.4, -0.6, 0.7 * b * low);
      return;
    }

    // ---------------- ATTACK: wind-up 0.15 s, strike 0.15 s, recover 0.3 s ----------------
    if (cur.name === 'attack') {
      const bat = o.weapon === 'bat';
      const wind = smooth(t / 0.15), strike = smooth((t - 0.15) / 0.15), back = smooth((t - 0.3) / 0.3);
      if (!cur.struck && t >= 0.22) { cur.struck = true; if (o.onStrike) o.onStrike(); }
      // the hips and the chest: away from the target, then through it
      const yaw = lerp(-24 * wind, 30, strike) * (1 - back) * DEG;
      turnBody(lerp(0, 6, strike) * (1 - back) * DEG, yaw * 0.6);
      P.addDelta('spine1', 0, yaw * 0.25); P.addDelta('chest', 0, yaw * 0.25);
      P.addDelta('head', 0, -yaw * 0.6);                 // (the eyes stay on the target)
      // the right hand: back by the shoulder, then forward through the target, then back to the swing
      const A = bat ? [-0.34 * k, hy + 0.62 * k, hz - 0.12 * k] : [-0.26 * k, hy + 0.5 * k, hz - 0.05 * k];
      const Bp = bat ? [0.22 * k, hy + 0.34 * k, hz + 0.5 * k] : [0.02 * k, hy + 0.52 * k, hz + 0.6 * k];
      V3.set(lerp(A[0], Bp[0], strike), lerp(A[1], Bp[1], strike), lerp(A[2], Bp[2], strike));
      P.handTo(1, V3.x, V3.y, V3.z, -0.8, -0.3, -0.5, w);
      P.fingers(1, 85, 60);
      // the left hand: a guard in front of the chin (a punch) or helping the swing (a bat)
      if (bat) P.handTo(0, V3.x + 0.08 * k, V3.y - 0.06 * k, V3.z + 0.02 * k, 0.6, -0.5, -0.4, w * 0.7);
      else P.handTo(0, 0.13 * k, hy + 0.58 * k, hz + 0.26 * k, 0.7, -0.6, -0.2, w * 0.85);
      P.fingers(0, 80, 55);
      return;
    }

    // ---------------- GET HIT: a jerk back, then back to normal in 0.4 s ----------------
    if (cur.name === 'getHit') {
      const j = t < 0.07 ? smooth(t / 0.07) : 1 - smooth((t - 0.07) / 0.38);
      const side = o.side || 0;                          // (-1 hit from the left, 1 from the right)
      turnBody(-7 * DEG * j, side * 6 * DEG * j, side * 4 * DEG * j);
      hipsPos.z -= 0.05 * k * j;
      P.addDelta('spine1', -9 * DEG * j); P.addDelta('chest', -8 * DEG * j);
      P.addDelta('neck', -15 * DEG * j, side * 5 * DEG * j); P.addDelta('head', -12 * DEG * j, side * 6 * DEG * j);
      P.handTo(0, 0.2 * k, hy + 0.42 * k, hz + 0.24 * k, 0.6, -0.6, -0.3, 0.75 * j);
      P.handTo(1, -0.2 * k, hy + 0.42 * k, hz + 0.24 * k, -0.6, -0.6, -0.3, 0.75 * j);
      return;
    }

    // ---------------- INTO A CAR / OUT OF IT ----------------
    if (cur.name === 'enterCar' || cur.name === 'exitCar') {
      const into = cur.name === 'enterCar';
      // fold: 0 standing .. 1 bent down into the seat
      const f = into ? smooth((t - 0.12) / 0.28) : 1 - smooth((t - 0.08) / 0.34);
      const reach = into ? smooth(t / 0.16) : 1 - smooth((t - 0.3) / 0.2);
      // the door handle in the character's space: which side is the car on?
      if (o.at) P.toLocal(o.at[0], o.at[1], o.at[2], V3); else V3.set(0.5 * k, 1.0 * k, 0.2 * k);
      const q = V3.x > 0 ? 0 : 1, sd = V3.x > 0 ? 1 : -1;
      hipsPos.y -= 0.22 * k * f;
      hipsPos.x += sd * 0.14 * k * f;
      turnBody(24 * DEG * f, -sd * 10 * DEG * f, sd * 6 * DEG * f);
      P.addDelta('neck', -8 * DEG * f); P.addDelta('head', 0, sd * 12 * DEG * reach);
      P.handTo(q, V3.x, V3.y, V3.z, sd * 0.6, -0.6, -0.4, reach * w);
      P.fingers(q, 55, 30);
      // the other hand goes onto the roof edge while folding in
      P.handTo(1 - q, V3.x * 0.6, hy + 0.62 * k, V3.z + 0.25 * k, -sd * 0.5, -0.5, -0.3, 0.6 * f * w);
      return;
    }

    // ---------------- JUMP: crouch, up (arms rise, knees fold), down ----------------
    if (cur.name === 'jump') {
      if (jumpPhase === 'prep') {
        const c = smooth(t / 0.12);
        hipsPos.y -= 0.1 * k * c; turnBody(8 * DEG * c);
        P.handTo(0, 0.24 * k, hy - 0.02 * k, hz - 0.12 * k, 0.6, -0.5, -0.4, 0.6 * c);
        P.handTo(1, -0.24 * k, hy - 0.02 * k, hz - 0.12 * k, -0.6, -0.5, -0.4, 0.6 * c);
        if (t >= 0.12) { jumpPhase = 'air'; airT = 0; if (o.onTakeoff) o.onTakeoff(); }
      } else {
        // in the air: the arms go up and a little out, the knees fold (the feet come up under the body)
        const a = smooth(airT / 0.16) * (1 - 0.5 * smooth((airT - 0.4) / 0.25));
        P.handTo(0, 0.34 * k, hy + 0.98 * k, hz + 0.14 * k, 0.8, -0.3, -0.3, a);
        P.handTo(1, -0.34 * k, hy + 0.98 * k, hz + 0.14 * k, -0.8, -0.3, -0.3, a);
        turnBody(-3 * DEG * a);
        for (let q = 0; q < 2; q++) {
          const A = P.foot[q].ankle;
          // (a foot that stands on the ground far below is pulled up under the hips: the knee folds)
          A.y = Math.max(A.y, hipsPos.y - legLen * lerp(0.95, 0.72, a));
          A.z = lerp(A.z, hipsPos.z - 0.04 * k, a);
          P.foot[q].pitch = 20 * DEG * a;
        }
      }
    }
  }

  const api = {
    overlay, update, play, stop,
    debug,
    // a jump ends when the feet are back on the ground (the player's physics knows when): the knees give
    land(hard = 0) {
      if (cur && cur.name === 'jump') { log(`land after ${airT.toFixed(2)} s in the air`); cur = null; }
      jumpPhase = 'none'; landT = 0; landHard = clamp(hard, 0, 1);
      if (anim.reset) anim.reset();
    },
    // stop the action because the player moves (only after its minimum time)
    tryCancel() { if (cur && cur.t >= cur.min && cur.name !== 'jump') { stop('cancel'); return true; } return false; },
    get current() { return cur ? cur.name : null; },
    get time() { return cur ? cur.t : 0; },
    // the player may not walk while this is true (the action holds him)
    get locked() { return !!cur && cur.lock && cur.t < cur.min; },
    get busy() { return !!cur; },
    get inAir() { return jumpPhase === 'air'; },
    set crouch(v) { if (!!v !== crouchOn) log(`crouch ${v ? 'on' : 'off'} (blend 0.2 s)`); crouchOn = !!v; },
    get crouch() { return crouchOn; },
    get crouchAmount() { return crouchK; },
    // the head follows a point of the world ([x, y, z]) or nothing (null)
    lookAt(p) { if (!cur || cur.name !== 'look') lookPt = p ? [p[0], p[1], p[2]] : null; },
    get looking() { return lookW > 0.5; },
    // the story looks itself (player.look): then this layer does not turn the head
    set storyLook(v) { storyLook = !!v; },
    // the state an online game sends: an action, or crouch / crouchWalk, or '' (walking and standing need no name:
    // the speed says it)
    get stateName() {
      if (cur && cur.name !== 'look') return cur.name === 'jump' ? 'jump' : cur.name;
      return crouchK > 0.5 ? 'crouch' : '';
    },
    get locomotion() { return loco; },
    get lastBlend() { return lastBlend; },
  };
  return api;
}
