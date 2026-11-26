// ---------------------------------------------------------------------------
// gesture.js - the BODY says the words too.
//
// In real life a person who talks does not only move the mouth. The hands come
// up and beat with the important words, a palm turns up toward "you", a hand
// goes to the chest for "I", the head shakes on "no", the shoulders rise at a
// question, the chest leans in, the weight goes from one foot to the other.
//
// This file plans that from the words of a line, the same way speech.js plans
// the mouth: the line (its words, their times, which ones are stressed, the
// sentences and how they end) becomes a short list of GESTURES, each one on
// its word. proceduralAnim.js then moves the arms, hands, fingers, chest,
// shoulders, head and hips toward them - smoothly, never with a jump.
//
// How much a person moves depends on the mood (the face): tired and sad people
// move little and slowly, angry people sharply and often, happy people openly.
// The same line always gets the same gestures from the same person (the plan
// is made from the words and a number of that person), but two people say it
// differently.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// ---- words that ask for a gesture of their own ----
const SELF = new Set(['i', 'me', 'my', 'mine', 'myself', "i'm", "i've", "i'd", "i'll"]);
const YOU = new Set(['you', 'your', 'yours', 'yourself', "you're", "you've", "you'll", "you'd", 'we', 'us', 'our', 'ours', "we're", "we'll", "let's", 'together']);
const NO = new Set(['no', 'not', 'never', 'nothing', 'nobody', 'none', 'nor', 'neither', 'nope', 'stop', "don't", "can't", "won't", "didn't", "doesn't", "isn't", "wasn't", "aren't", "weren't", "couldn't", "shouldn't", "wouldn't", "haven't", "hasn't", 'cannot']);
const ALL = new Set(['all', 'every', 'everything', 'everyone', 'everybody', 'everywhere', 'whole', 'always', 'world', 'huge', 'years', 'enough', 'forever']);
const THIS = new Set(['this', 'that', 'these', 'those', 'here', 'there', 'look', 'him', 'her', 'them']);
const DOUBT = new Set(['maybe', 'perhaps', 'guess', 'whatever', 'if', 'might', 'probably', 'suppose', 'somehow', 'anyway', 'dunno']);

// ---- how a mood moves: size (of the gestures), speed (of the strokes), often (how many stressed words get one) ----
const ENERGY = {
  neutral: { size: 0.8, speed: 1, often: 0.7 },
  smile: { size: 0.9, speed: 1.05, often: 0.8 }, grin: { size: 1, speed: 1.1, often: 0.85 }, smirk: { size: 0.65, speed: 0.95, often: 0.5 },
  sad: { size: 0.5, speed: 0.75, often: 0.45 }, tired: { size: 0.45, speed: 0.7, often: 0.4 }, pain: { size: 0.35, speed: 0.8, often: 0.3 },
  worried: { size: 0.6, speed: 1.1, often: 0.6 }, afraid: { size: 0.6, speed: 1.2, often: 0.6 }, surprised: { size: 0.95, speed: 1.2, often: 0.75 },
  angry: { size: 1.1, speed: 1.35, often: 0.9 }, stern: { size: 0.75, speed: 1.15, often: 0.6 }, doubt: { size: 0.7, speed: 0.9, often: 0.65 },
  shout: { size: 1.25, speed: 1.4, often: 1 }, asleep: { size: 0, speed: 1, often: 0 },
};
export function energyOf(mood) { return ENERGY[mood] || ENERGY.neutral; }

// ---- where a hand goes for each gesture ----
// In a space the size of the body (times k, the body's height / 1.8): x across, out to the hand's own side (a little
// below 0 = across the middle), y up from the hips, z forward from the hips.
// turn: the palm turned up (+) or down (-), in degrees (0 = the thumb up, the palm toward the middle).
// bend: the wrist bent back (+, an open offering hand) or toward the palm (-). curl / spread: the fingers.
// aim (only some): the hand turned to fixed directions of the body instead - f: where the fingers point, p: where
// the palm faces (x out to the hand's own side, y up, z forward)
export const HAND_POSES = {
  low: { x: 0.16, y: 0.05, z: 0.2, turn: 10, bend: 0, curl: 30, spread: 0 },      // waiting, low in front
  beat: { x: 0.15, y: 0.2, z: 0.3, turn: 22, bend: 4, curl: 24, spread: 2 },       // a relaxed hand that beats
  offer: { x: 0.19, y: 0.21, z: 0.38, turn: 72, bend: 14, curl: 12, spread: 8 },   // the palm up, held out to "you"
  spread: { x: 0.33, y: 0.18, z: 0.29, turn: 68, bend: 10, curl: 10, spread: 10 }, // both hands apart: "all of it"
  // flat on the chest: "I". aim: the hand is turned to these directions of the body (fingers up and in toward the
  // middle, the palm on the chest) - x as for the place, out to the hand's own side
  // (onChest: z is measured from the front of this body's chest - a big chest or a thin one - not from the hips)
  self: { x: -0.03, y: 0.37, z: 0.035, onChest: true, turn: 0, bend: 0, curl: 6, spread: 3, aim: { f: [-0.5, 0.84, 0.12], p: [0, 0.12, -1] } },
  shrug: { x: 0.25, y: 0.12, z: 0.25, turn: 80, bend: 16, curl: 10, spread: 10 },  // palms up, low and out
  no: { x: 0.27, y: 0.22, z: 0.33, turn: -80, bend: 18, curl: 6, spread: 6 },      // a flat hand swept out, palm down
  indicate: { x: 0.11, y: 0.3, z: 0.45, turn: 40, bend: 6, curl: 10, spread: 4 },  // an open hand toward someone or something
  chop: { x: 0.12, y: 0.27, z: 0.36, turn: 0, bend: 0, curl: 6, spread: 0 },       // the edge of the hand, cutting down
  fist: { x: 0.14, y: 0.22, z: 0.32, turn: 12, bend: -4, curl: 82, spread: 0 },    // a closed hand that beats
};
// the stroke: how the hand moves ON the word - a little the other way before it, through, a small overshoot, back
// (times k: across - out to its side +, up +, forward +)
const STROKES = {
  low: [0, 0, 0], beat: [0, -0.05, 0.012], offer: [0.02, 0.012, 0.05], spread: [0.05, 0.02, 0], self: [0, 0, -0.025],
  shrug: [0.02, 0.035, 0], no: [0.13, 0, 0.01], indicate: [0, 0.005, 0.06], chop: [0, -0.085, 0.02], fist: [0, -0.055, 0.01],
};
// what the rest of the body does with each gesture (degrees): lean (the chest forward +), twist (toward the hand that
// moves), chest (up and open), shrug (the shoulders), nod (the head down and back on the word), shake (side to side),
// tilt (the head to one side)
const BODY = {
  beat: { lean: 1.5, nod: 2.5 },
  offer: { lean: 3, twist: 4, nod: 1.5 },
  spread: { lean: -1, chest: 2.5, nod: 1 },
  self: { lean: -1.5, nod: 2 },
  shrug: { lean: -1, shrug: 9, tilt: 6 },
  no: { lean: -1, shake: 7 },
  indicate: { lean: 3, twist: 6, nod: 2 },
  chop: { lean: 4, nod: 4 },
  fist: { lean: 3, nod: 3 },
};

// a small random number maker: the same seed gives the same numbers (the same line, the same gestures)
function maker(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashText(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

// sp: a speech from speech.js (with its words and sentences). mood: a face name. seed: a number of this person.
// Returns { strokes: [{ t, kind, hand (0 left, 1 right, 2 both), amp }], shifts: [{ t, x }], len, size, speed }
export function planGestures(sp, mood = 'neutral', seed = 0) {
  const E = energyOf(mood);
  const plan = { strokes: [], shifts: [], len: sp.len || 0, size: E.size, speed: E.speed };
  const W = sp.words || [], SN = sp.sentences || [];
  if (!W.length || E.size <= 0) return plan;
  const rnd = maker(seed ^ hashText(W.map((w) => w.w).join(' ')));
  const angry = mood === 'angry' || mood === 'shout', firm = angry || mood === 'stern';
  // ---- 1. the words that could get a gesture ----
  const cands = [];
  for (const w of W) {
    const S = SN[w.s] || { end: '.' }, bang = S.end === '!';
    let kind = null, pri = 0;
    if (NO.has(w.w)) { kind = 'no'; pri = 3; }
    else if (SELF.has(w.w)) { kind = 'self'; pri = 2; }
    else if (YOU.has(w.w)) { kind = firm ? 'indicate' : 'offer'; pri = 2; }
    else if (ALL.has(w.w)) { kind = 'spread'; pri = 2; }
    else if (DOUBT.has(w.w)) { kind = 'shrug'; pri = 2; }
    else if (THIS.has(w.w) && w.stressed) { kind = 'indicate'; pri = 1.5; }
    else if (w.stressed) { kind = firm && bang ? 'chop' : angry ? 'fist' : 'beat'; pri = 1; }
    if (!kind) continue;
    // ("I" or "you" that nobody stresses still moves a little: a smaller gesture)
    cands.push({ t: w.t0 + 0.06, kind, pri, amp: (w.stressed ? 1 : 0.75) * (bang ? 1.2 : 1) });
  }
  // a question: on its last word the palms turn up - or the shoulders rise, when the person is not sure
  SN.forEach((S, i) => {
    if (S.end !== '?') return;
    let last = null;
    for (const w of W) if (w.s === i) last = w;
    if (last) cands.push({ t: last.t0 + 0.06, kind: mood === 'doubt' || mood === 'worried' || rnd() < 0.4 ? 'shrug' : 'offer', pri: 2.5, amp: 1 });
  });
  cands.sort((a, b) => a.t - b.t);
  // ---- 2. not every stressed word: how often depends on the mood (a word that means something is kept more) ----
  const kept = cands.filter((c) => rnd() < (c.pri >= 2 ? Math.min(1, E.often + 0.35) : E.often));
  // ---- 3. never too close together: the more important one of two close gestures wins ----
  const gap = 0.5 / E.speed, out = [];
  for (const c of kept) {
    const last = out[out.length - 1];
    if (!last || c.t - last.t >= gap) out.push(c);
    else if (c.pri > last.pri && (out.length < 2 || c.t - out[out.length - 2].t >= gap)) out[out.length - 1] = c;
  }
  // ---- 4. which hand: mostly the right one, now and then the left, both for the wide ones ----
  for (const c of out) {
    let hand;
    if (c.kind === 'spread' || c.kind === 'shrug') hand = 2;
    else if (c.kind === 'self' || c.kind === 'no' || c.kind === 'chop' || c.kind === 'fist') hand = 1;
    else if (c.kind === 'offer' && E.size >= 0.9 && c.pri >= 2 && rnd() < 0.4) hand = 2;
    else hand = rnd() < 0.28 ? 0 : 1;
    plan.strokes.push({ t: c.t, kind: c.kind, hand, amp: c.amp });
  }
  // ---- 5. the weight goes from one foot to the other, at the start of a sentence (not more often than every 2 s) ----
  let side = rnd() < 0.5 ? -1 : 1, lastShift = -9;
  for (const S of SN) {
    if (S.t0 - lastShift < 2) continue;
    plan.shifts.push({ t: S.t0, x: side * (0.55 + 0.45 * rnd()) });
    side = -side; lastShift = S.t0;
  }
  return plan;
}

// a fresh "moment" for samplePlan to fill
export function makeSample() {
  return { hands: [0, 1].map(() => ({ kind: 'low', w: 0, push: [0, 0, 0] })), lean: 0, twist: 0, chest: 0, shrug: 0, nod: 0, shake: 0, tilt: 0, shift: 0 };
}

// the stroke over time (u: seconds from the word, already scaled by the speed of the mood): a little the other way
// while the hand gets ready (0 .. -0.5), quickly through to the gesture (+1), then back to rest
function strokeCurve(u) {
  if (u < -0.12) return -0.5 * smooth((u + 0.3) / 0.18);
  if (u < 0.06) return -0.5 + 1.5 * smooth((u + 0.12) / 0.18);
  if (u < 0.45) return 1 - 0.85 * smooth((u - 0.06) / 0.39);
  return 0.15 * Math.max(0, 1 - (u - 0.45) / 0.4);
}

// The plan at time t (seconds since the line began). ending: the line is over (or was cut off) - everything goes
// back to rest. Fills "out" (see makeSample):
//   out.hands[q] = { kind (the pose the hand goes to), w (0 = the arm hangs, 1 = in the gesture), push (the stroke, times k) }
//   out.lean, twist, chest, shrug, nod, shake, tilt: degrees for the body. out.shift: the weight, -1 (right foot) .. 1 (left)
export function samplePlan(plan, t, out, ending = false) {
  const talking = !ending && t < plan.len + 0.3;
  const prep = 0.3 / plan.speed, hold = 0.55 + 0.35 / plan.speed;
  // (a flat hand swept out for "no" is a quick thing: it does not stay out there)
  const holdOf = (kind) => (kind === 'no' ? hold * 0.55 : hold);
  for (let q = 0; q < 2; q++) {
    const H = out.hands[q];
    // this hand's last gesture that has begun (getting ready counts), and its next one
    let cur = null, next = null;
    for (const S of plan.strokes) {
      if (S.hand !== q && S.hand !== 2) continue;
      if (S.t - prep <= t) cur = S; else { next = S; break; }
    }
    H.push[0] = H.push[1] = H.push[2] = 0;
    if (!cur) {
      // before its first gesture: the right hand comes up a little, ready; the left one stays down
      H.kind = 'low'; H.w = talking && q === 1 && plan.strokes.length ? 0.55 : 0;
      continue;
    }
    const u = t - cur.t;
    // held for a moment; then, if nothing comes soon, the hand sinks a little to wait
    const soon = next && next.t - prep - t < 0.5 && next.kind !== 'no';
    if (u < holdOf(cur.kind) || soon) { H.kind = cur.kind; H.w = talking ? 1 : 0; }
    else { H.kind = 'low'; H.w = talking ? 0.7 : 0; }
    if (H.kind === cur.kind && talking) {
      const f = strokeCurve(u * plan.speed) * cur.amp * plan.size, v = STROKES[cur.kind] || STROKES.low;
      H.push[0] = v[0] * f; H.push[1] = v[1] * f; H.push[2] = v[2] * f;
    }
  }
  // ---- the body ----
  let lean = 0, twist = 0, chest = 0, shrug = 0, nod = 0, shake = 0, tilt = 0;
  if (talking) {
    for (const S of plan.strokes) {
      const u = (t - S.t) * plan.speed;
      if (u < -0.35 || u > 1.6) continue;
      const A = BODY[S.kind];
      if (!A) continue;
      const env = u < 0 ? smooth((u + 0.35) / 0.35) : u < 0.4 ? 1 : 1 - smooth((u - 0.4) / 1.2);
      const amp = S.amp * plan.size, side = S.hand === 0 ? 1 : S.hand === 1 ? -1 : 0;
      lean += (A.lean || 0) * env * amp; twist += (A.twist || 0) * side * env * amp;
      chest += (A.chest || 0) * env * amp; shrug += (A.shrug || 0) * env * amp; tilt += (A.tilt || 0) * env * amp;
      // a nod is quick: down on the word and back up
      if (A.nod && u > -0.05 && u < 0.35) nod += A.nod * amp * Math.sin((Math.PI * (u + 0.05)) / 0.4);
      // the head shakes two or three times, side to side, smaller each time
      if (A.shake && u > -0.1 && u < 0.9) shake += A.shake * amp * Math.sin((u + 0.1) * TAU * 2.4) * (1 - (u + 0.1) / 1.0);
    }
    // while talking, an awake person leans in a little toward the one they talk to (a sad or tired one does not)
    lean += Math.max(0, plan.size - 0.5) * 2;
  }
  out.lean = lean; out.twist = twist; out.chest = chest; out.shrug = shrug; out.nod = nod; out.shake = shake; out.tilt = tilt;
  // the weight: where the last shift put it (it stays there after the line, until the next one)
  for (const S of plan.shifts) if (S.t <= t) out.shift = S.x * plan.size;
  return out;
}
