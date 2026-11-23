// ---------------------------------------------------------------------------
// faceAnim.js - moves the small face bones of faceRig.js.
//
// A face does three things here:
//   1. it has an EXPRESSION (smile, sad, angry, afraid ...): a set of numbers
//      for the eyebrows, the eyelids, the corners of the mouth and the jaw.
//      Changing the expression blends softly from the old one to the new one.
//   2. it BLINKS on its own every few seconds (not while asleep)
//   3. it TALKS. Given the words of the line (say), the mouth makes the shape
//      of every sound in turn (speech.js): open for "a", wide for "ee", round
//      for "oo", the lips pressed for m, b, p - flowing from one to the next.
//      On stressed words the eyebrows lift, a question raises them at the end,
//      and the eyes blink at the end of a sentence. Without the words (talk
//      only) the mouth opens and closes in syllables, with short pauses
//      between words. (characterLook.js draws the inside of the open mouth.)
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

// Some models were made with an expression of their own. These numbers are added to EVERY face of that model,
// so its "neutral" is calm. (jaw below 0 closes a mouth that was made open.) Keyed by the model file name.
export const FIXES = {
  // Model_File_Name: { jaw: -2, up: -1.5 },     (an example: a little calmer mouth)
  // (Small changes only. A model that was made laughing with open teeth, like Theo_Calloway, gets a new calm face
  //  before it is rigged: see faceSculpt.js.)
};

import { buildSpeech, sampleSpeech } from './speech.js';

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
  let wordLeft = 0, vowel = 0, vowelTo = 0;                // syllables left in the word, lips: -1 round ... +1 wide
  // the words of the line being said (speech.js), where in it we are, and the mouth it asks for (smoothed)
  let sp = null, spT = 0, spI = 0, markI = 0, sinceBlink = 9;
  const vis = { jaw: 0, wide: 0, press: 0 }, mouth = { jaw: 0, wide: 0, press: 0 };
  let stress = 0, question = 0;                            // 1 on a stressed word / at the end of a question, then fading
  // a model that was made with an expression of its own (FIXES above): its numbers are added to every face
  const fix = channels(FIXES[F.name] || {}), hasFix = !!FIXES[F.name];

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

  // the words of a line (the subtitle) and how long it stays on screen: the mouth says them
  function say(text, seconds) { sp = buildSpeech(text, seconds); spT = 0; spI = 0; markI = 0; if (!sp.seg.length) sp = null; }

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
    sinceBlink = blinkT === 0 ? 0 : sinceBlink + dt;
    // ---- talking: the mouth opens and closes in syllables, words have a short pause between them ----
    talkNow += (talk - talkNow) * Math.min(1, dt * 10);
    if (talkNow > 0.02) {
      if ((syllableIn -= dt) <= 0) {
        if (wordLeft <= 0) { wordLeft = 1 + Math.floor(Math.random() * 4); syllableIn = 0.07 + Math.random() * 0.12; syllableTo = 0.04; vowelTo = 0; }
        else { wordLeft--; syllableIn = 0.085 + Math.random() * 0.1; syllableTo = Math.random() < 0.15 ? 0.2 : 0.42 + Math.random() * 0.58; vowelTo = Math.random() * 2 - 1; }
      }
      syllable += (syllableTo - syllable) * Math.min(1, dt * 26);
      vowel += (vowelTo - vowel) * Math.min(1, dt * 14);
    } else { syllable *= Math.max(0, 1 - dt * 12); vowel *= Math.max(0, 1 - dt * 8); wordLeft = 0; }
    let speak = talkNow * syllable, lips = talkNow * vowel;
    // ---- the words: the shape of every sound (it overrides the syllables above) ----
    if (sp && talk > 0.01) {
      spT += dt;
      spI = sampleSpeech(sp, spT, vis, spI);
      while (markI < sp.marks.length && sp.marks[markI].t <= spT) {
        const m = sp.marks[markI++];
        if (m.kind === 'stress') stress = 1;
        else if (m.kind === 'question') question = 1;
        // (people blink at the end of a sentence, between two thoughts)
        else if (m.kind === 'end' && blinks && !asleep && blinkT < 0 && sinceBlink > 0.7 && Math.random() < 0.75) { blinkT = 0; sinceBlink = 0; }
      }
    } else { vis.jaw = 0; vis.wide = 0; vis.press = 0; if (talk <= 0.01) sp = null; }
    // (the jaw is quick - closing even quicker, so the lips really meet for m, b, p - the lips a little slower:
    //  soft, never a jump)
    mouth.jaw += (vis.jaw - mouth.jaw) * (1 - Math.exp(-(vis.jaw < mouth.jaw ? 46 : 30) * dt));
    mouth.wide += (vis.wide - mouth.wide) * (1 - Math.exp(-20 * dt));
    mouth.press += (vis.press - mouth.press) * (1 - Math.exp(-30 * dt));
    stress *= Math.exp(-5 * dt); question *= Math.exp(-1.4 * dt);
    if (sp) { speak = mouth.jaw / 12; lips = mouth.wide; }

    // ---- the bones ----
    // (a fix may close the jaw further than the model was made: then speaking opens it from there)
    // (lips pressed together for m, b, p: even a mouth the mood holds open closes for them)
    // (and never wider than a real shout)
    const jaw = Math.min(22, Math.max(hasFix ? fix.jaw : 0, now.jaw * (1 - mouth.press * (sp ? 1 : 0)) + fix.jaw + speak * 12));
    place('jaw', 0, 0, 0, q.setFromAxisAngle(X, (jaw * mm) / F.jawArm));
    const lidL = Math.max(-0.35, Math.min(1, Math.max(now.lidL, 0) + blink * (1 - Math.max(now.lidL, 0)) + Math.min(now.lidL, 0) * (1 - blink)));
    const lidR = Math.max(-0.35, Math.min(1, Math.max(now.lidR, 0) + blink * (1 - Math.max(now.lidR, 0)) + Math.min(now.lidR, 0) * (1 - blink)));
    place('lid_L', 0, (-lidL * F.lidTravel) / mm, 0, null);
    place('lid_R', 0, (-lidR * F.lidTravel) / mm, 0, null);
    // (an eyebrow comes down a little with a closing eye)
    // (speaking: the eyebrows lift a little on a stressed word, and more, with the inner ends up, for a question)
    const browUp = stress * 1.3 + question * 2.2, browTilt = question * 3;
    place('brow_L', 0, now.browL + browUp - 0.6 * blink, 0, q.setFromAxisAngle(Z, (-(now.tiltL + browTilt) * Math.PI) / 180));
    place('brow_R', 0, now.browR + browUp - 0.6 * blink, 0, q.setFromAxisAngle(Z, ((now.tiltR + browTilt) * Math.PI) / 180));
    // (speaking: the corners come in for a round "oo", go out for a wide "ee", and sink a little with an open mouth)
    // (pressed lips pull the corners in a little)
    const press = sp ? mouth.press : 0;
    const outL = now.outL + fix.outL + lips * 1.8 - speak * 0.6 - press * 0.4, outR = now.outR + fix.outR + lips * 1.8 - speak * 0.6 - press * 0.4;
    place('mouth_L', outL, now.upL + fix.upL - speak * 0.8, -0.3 * outL, null);
    place('mouth_R', -outR, now.upR + fix.upR - speak * 0.8, -0.3 * outR, null);
  }
  return {
    set, update, say,
    get name() { return name; },
    // speaking: 1 on a stressed word / at the end of a question, fading after (the head nods, a hand beats)
    get stress() { return stress; },
    get question() { return question; },
    get speaking() { return !!sp && spT < sp.len; },
    get names() { return Object.keys(FACES); },
    set blinks(on) { blinks = !!on; },                      // false: the eyes stay open (a stare, or a test picture)
  };
}
