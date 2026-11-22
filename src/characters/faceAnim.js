// ---------------------------------------------------------------------------
// faceAnim.js - moves the small face bones of faceRig.js.
//
// A face does three things here:
//   1. it has an EXPRESSION (smile, sad, angry, afraid ...): a set of numbers
//      for the eyebrows, the eyelids, the corners of the mouth and the jaw.
//      Changing the expression blends softly from the old one to the new one.
//   2. it BLINKS on its own every few seconds (not while asleep)
//   3. it TALKS: while the character speaks, the jaw opens and closes in small
//      uneven steps, like syllables
//
// To add an expression: add a line to FACES below. The numbers are
//   jaw            how far the mouth opens (millimeters at the lips)
//   lid            eyelids: 0 = open, 1 = closed, below 0 = wide open
//   brow           eyebrows up (+) or down (-) in millimeters
//   tilt           eyebrows tilted in degrees: + = inner ends up (sad), - = inner ends down (angry)
//   up, out        corners of the mouth up (+) / down (-) and outward, in millimeters
// A name with L or R at the end (browL, upR ...) is for one side only.
// ---------------------------------------------------------------------------

export const FACES = {
  neutral: {},
  smile: { up: 6, out: 3.6, lid: 0.22, brow: 1 },
  grin: { up: 7.5, out: 5, lid: 0.34, brow: 1.4, jaw: 3.5 },
  smirk: { upL: 6, out: 2, lid: 0.12, browR: 2.6, tiltR: -4 },
  sad: { tilt: 17, brow: 1.1, up: -4.4, lid: 0.3 },
  worried: { tilt: 13, brow: 2.3, up: -2, lid: 0.06, jaw: 0.8 },
  afraid: { tilt: 12, brow: 5.4, lid: -0.36, jaw: 4.4, up: -1.7, out: 1.4 },
  surprised: { brow: 7.4, lid: -0.42, jaw: 9 },
  angry: { tilt: -18, brow: -4.4, lid: 0.28, up: -2.3 },
  stern: { tilt: -10, brow: -2.6, lid: 0.16, up: -1.1 },
  doubt: { browL: 5, tiltL: 5.5, browR: -2, tiltR: -7, up: -0.9, lid: 0.1 },
  tired: { lid: 0.56, brow: -1.4, up: -1.4, tilt: 5 },
  pain: { lid: 0.85, brow: -3.6, tilt: 11, up: 1.6, out: 3.2, jaw: 2.6 },
  asleep: { lid: 1, jaw: 1.6, brow: -0.4 },
  shout: { jaw: 14, brow: -3.2, tilt: -11, lid: -0.12, out: 2 },
};

// the numbers of a face, written out for both sides
const CH = ['jaw', 'lidL', 'lidR', 'browL', 'browR', 'tiltL', 'tiltR', 'upL', 'upR', 'outL', 'outR'];
function channels(f) {
  const both = (one, all) => (f[one] !== undefined ? f[one] : f[all] || 0);
  return {
    jaw: f.jaw || 0,
    lidL: both('lidL', 'lid'), lidR: both('lidR', 'lid'),
    browL: both('browL', 'brow'), browR: both('browR', 'brow'),
    tiltL: both('tiltL', 'tilt'), tiltR: both('tiltR', 'tilt'),
    upL: both('upL', 'up'), upR: both('upR', 'up'),
    outL: both('outL', 'out'), outR: both('outR', 'out'),
  };
}

// rig: from autoRig. Returns null when the character has no face bones.
export function createFaceAnimator(THREE, rig) {
  const F = rig.def && rig.def.face, B = rig.bones, R = rig.rest;
  if (!F || !B.jaw || !R.head) return null;
  const mm = (rig.height / 1.8) / 1000;                      // one millimeter of a 1.8 m body, in this model
  const headInv = R.head.world.clone().invert();           // a direction of the model -> a direction of the head bone
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  let name = 'neutral', from = channels({}), to = channels({}), blend = 1, blendLen = 0.35;
  const now = channels({});
  let blinkIn = 0.8 + Math.random() * 3, blinkT = -1;       // seconds until the next blink / how far the running blink is
  let syllable = 0, syllableTo = 0, syllableIn = 0, talkNow = 0, blinks = true;

  function set(next, seconds = 0.35) {
    if (!FACES[next]) next = 'neutral';
    if (next === name) return;
    name = next;
    for (const c of CH) from[c] = now[c];
    to = channels(FACES[next]);
    blend = seconds > 0 ? 0 : 1; blendLen = Math.max(0.01, seconds);
  }
  // one bone: slide it by (x, y, z) millimeters (directions of the model) and turn it
  function place(bone, x, y, z, turn) {
    const r = R[bone];
    v.set(x * mm, y * mm, z * mm).applyQuaternion(headInv);
    B[bone].position.copy(r.position).add(v);
    if (turn) B[bone].quaternion.copy(r.quaternion).multiply(turn); else B[bone].quaternion.copy(r.quaternion);
  }

  // talk: 0..1 = speaking. asleep: the eyes stay shut, no blinking.
  function update(dt, talk = 0, asleep = false) {
    blend = Math.min(1, blend + dt / blendLen);
    const t = blend * blend * (3 - 2 * blend);
    for (const c of CH) now[c] = from[c] + (to[c] - from[c]) * t;
    // ---- blinking ----
    let blink = 0;
    if (asleep) { blink = 1; blinkT = -1; }
    else if (blinkT >= 0) {
      blinkT += dt;
      blink = blinkT < 0.07 ? blinkT / 0.07 : blinkT < 0.11 ? 1 : 1 - (blinkT - 0.11) / 0.14;
      if (blinkT >= 0.25) { blinkT = -1; blink = 0; blinkIn = 1.8 + Math.random() * 4.2; if (Math.random() < 0.15) blinkIn = 0.25; }
    } else if (blinks && (blinkIn -= dt) <= 0) blinkT = 0;
    // ---- talking: the jaw follows uneven "syllables" ----
    talkNow += (talk - talkNow) * Math.min(1, dt * 10);
    if (talkNow > 0.02) {
      if ((syllableIn -= dt) <= 0) { syllableIn = 0.09 + Math.random() * 0.11; syllableTo = Math.random() < 0.22 ? 0.05 : 0.3 + Math.random() * 0.7; }
      syllable += (syllableTo - syllable) * Math.min(1, dt * 24);
    } else syllable *= Math.max(0, 1 - dt * 12);
    const speak = talkNow * syllable;

    // ---- the bones ----
    const jaw = Math.max(0, now.jaw + speak * 5.2);
    place('jaw', 0, 0, 0, q.setFromAxisAngle(X, (jaw * mm) / F.jawArm));
    const lidL = Math.max(-0.35, Math.min(1, Math.max(now.lidL, 0) + blink * (1 - Math.max(now.lidL, 0)) + Math.min(now.lidL, 0) * (1 - blink)));
    const lidR = Math.max(-0.35, Math.min(1, Math.max(now.lidR, 0) + blink * (1 - Math.max(now.lidR, 0)) + Math.min(now.lidR, 0) * (1 - blink)));
    place('lid_L', 0, (-lidL * F.lidTravel) / mm, 0, null);
    place('lid_R', 0, (-lidR * F.lidTravel) / mm, 0, null);
    // (an eyebrow comes down a little with a closing eye)
    place('brow_L', 0, now.browL - 0.6 * blink, 0, q.setFromAxisAngle(Z, (-now.tiltL * Math.PI) / 180));
    place('brow_R', 0, now.browR - 0.6 * blink, 0, q.setFromAxisAngle(Z, (now.tiltR * Math.PI) / 180));
    // (speaking pulls the corners of the mouth in a little when the mouth is open)
    place('mouth_L', now.outL - speak * 0.7, now.upL - speak * 0.5, -0.3 * now.outL, null);
    place('mouth_R', -(now.outR - speak * 0.7), now.upR - speak * 0.5, -0.3 * now.outR, null);
  }
  return {
    set, update,
    get name() { return name; },
    get names() { return Object.keys(FACES); },
    set blinks(on) { blinks = !!on; },                      // false: the eyes stay open (a stare, or a test picture)
  };
}
