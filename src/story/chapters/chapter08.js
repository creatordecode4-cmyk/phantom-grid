// ---------------------------------------------------------------------------
// CHAPTER 8 - "TALK TO ZERO" (a night after Chapter 7)
//
// This file is ONLY DATA, written like chapter06.js. The story engine (src/story/engine.js) explains every word used
// here at its top; the new steps of this chapter are "safehouse" (Lena's room, src/story/safehouseSet.js), "run" and
// "runGoal" (the night run on the highway: Zero, the Phantoms, the meters - src/story/nightRun.js), "hack" with
// steady: true (Lena links the pilot key while Nate holds the cars side by side), and "memory" (the flashback look).
// All texts are keys of src/story/strings.js.
//
// The night in one line: a pilot key on a laptop, a highway in the rain at full speed, a black car that comes out of
// the dark and rides beside him, a voice on the radio that is Theo's, the Phantoms of KVI, a tunnel, and one word.
//
// TONE: emotional, intimate, eerie. Short plain lines. Long silences. The camera stays on the two cars in the rain.
//
// It uses what earlier chapters left behind (Chapter 7 is not written yet: its flags are read if they are there,
// and default to "no"):
//   dante_captured (true: Nate looks at Dante's empty chair), juno_fate ('spared': Lena says a line about Juno's bike),
//   theo_car (Nate drives Theo's car, else Mace's old street car), wren_muted (WREN speaks again from now on).
// It leaves for later chapters:
//   pilot_key_ready, theo_running_confirmed, wren_fragment_unlocked,
//   theo_reply_a, theo_reply_b ('why' | 'scared' | 'sorry' | 'silence'), asked_crash_question (true | false),
//   radio_off (true | false), nate_partial_peace (true when his last reply was "I am sorry" or silence)
//
// Places: [x, z] on the ground (on the highway: on its deck), [x, y, z], { safe: [x, y, z] } (Lena's room: x to the
// right of the window, y up from the floor, z toward the door), { of: 'run' | 'zero' | 'ph1', p: [left, up, forward] },
// { cabin: 'run', at: 'eye' | 'pass' | 'mid' | 'dash' | 'wheel', p }. Compass degrees: 0 north, 180 south.
// The highway: northbound lanes at x -487.1 (inside), -491.25, -495.4 (by the wall); the deck is 8 m up; the
// Ironhill tunnel from z 1000 to 1320; the road ends at z 1470.
// ---------------------------------------------------------------------------

const NEAR = 0.05;
const NIGHT = { do: 'time', hour: 2.3, rain: true };
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));
const LANE = [-487.1, -491.25, -495.4];

// ---- Lena's safehouse (src/story/safehouseSet.js) ----
const s = (x, y, z) => ({ safe: [x, y, z] });
const SAFE = {
  nate: [0.45, 1.05],             // Nate, behind the sofa by the lamp, where he can see the table and the TV
  lena: s(1.2, 0.5, -1.2),        // Lena on her chair at the work table (seat 0.5 m up)
  laptop: s(1.22, 0.765, -1.98),
  key: s(1.68, 0.765, -1.86),
  chair: s(2.25, 0.55, -1.05),    // Dante's chair (empty)
  tv: s(-2.88, 0.82, -0.2),
};
const LENA = (more = {}) => ({ do: 'actor', id: 'lena', model: 'Lena_Marchetti', name: 'name.lena', at: SAFE.lena, face: 180, pose: 'sit', floorBelow: 0.5, fixed: true, mood: 'stern', look: SAFE.laptop, ...more });
// the green of the pilot key (the story's one lamp)
const KEY_LIGHT_ROOM = { do: 'light', at: s(1.45, 1.3, -1.8), color: 0x46ff9c, power: 0.3, range: 2.2 };

// ---- the car (Theo's car if it is Nate's now, else Mace's old street car) and what is in its dash ----
const RUN_CAR = (at, more = {}) => [
  { do: 'spawn', id: 'run', kind: 'theo_coupe', or: 'coupe', at, face: 0, arena: 'ironhill', enter: true, lockExit: true, detail: true, if: { flag: 'theo_car' }, ...more },
  { do: 'spawn', id: 'run', kind: 'tech_patrol_car', or: 'sedan', at, face: 0, arena: 'ironhill', enter: true, lockExit: true, detail: true, color: [0.42, 0.27, 0.12], lights: 'normal',
    type: { label: "MACE'S STREET CAR", topSpeed: 204, accel: 9.4, grip: 1.1, nitro: true, role: 'car' }, if: { not: { flag: 'theo_car' } }, ...more },
];
// (on the middle of the dashboard: the radio's dial on top, the tape deck under it - empty until the end - and the
//  pilot key lying on the console, plugged in)
const AT_DIAL = [0, -0.1, -0.185], AT_DECK = [0, -0.175, -0.18], AT_KEY = [0.07, -0.245, -0.235];
const DASH = [
  { do: 'prop', id: 'key', kind: 'pilotKey', in: 'run', at: { cabinAt: 'dash', p: AT_KEY }, rot: [0, 0.3, 0] },
  { do: 'prop', id: 'dial', kind: 'radioDial', in: 'run', at: { cabinAt: 'dash', p: AT_DIAL } },
  { do: 'prop', id: 'deck', kind: 'deck', empty: true, in: 'run', at: { cabinAt: 'dash', p: AT_DECK } },
];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// the faint green of the pilot key in the car
const KEY_LIGHT_CAR = { do: 'light', at: { cabin: 'run', at: 'dash', p: plus(AT_KEY, [0, 0.08, -0.05]) }, color: 0x46ff9c, power: 0.32, range: 1.1 };
// the faint warm glow of the dash lamps (the end: the key is dark, the radio is dead)
const DASH_GLOW = { do: 'light', at: { cabin: 'run', at: 'dash', p: plus(AT_DECK, [0.02, 0.13, -0.12]) }, color: 0xffc58a, power: 0.4, range: 1.0 };
// Zero's glow on Nate's car while it rides beside him
const ZERO_LIGHT = { do: 'light', at: { of: 'zero', p: [0, 1.0, 0] }, color: 0xa8d8ff, power: 24, range: 9 };
// (the cars of the run are moved back along the road at a cut when they are this far north: the long talk stays on
//  the open, dark stretch north of the city - z 540 .. 1000 - with the tunnel's mouth far ahead and never reached)
const BACK = { do: 'run', rewind: { over: 600, to: 540 } };
const TALK_KMH = 70;
// (every shot of the long talk starts with it: a cut is where the road may be moved back)
const talk = (shots) => shots.map((sh) => (sh.do && sh.do.includes(BACK) ? sh : { ...sh, do: [BACK, ...(sh.do || [])] }));
// the story drives Nate's car (in a film scene)
const CRUISE = (speed, lane = 1) => ({ do: 'run', cruise: { lane, speed } });

// camera places around the two cars (Nate's car 'run'; Zero rides on his left, the +x side, 4.2 m over)
const C = {
  wide: { from: { of: 'run', p: [-5.5, 1.0, 10] }, to: { of: 'run', p: [-5.2, 1.3, 6] }, look: { of: 'run', p: [2.1, 0.7, 0] }, fov: 42 },
  high: { from: { of: 'run', p: [2.1, 9.5, -7] }, to: { of: 'run', p: [2.1, 8.5, -4] }, look: { of: 'run', p: [2.1, 0, 7] }, fov: 46 },
  behind: { from: { of: 'run', p: [2.1, 0.75, -10] }, to: { of: 'run', p: [2.1, 0.9, -8] }, look: { of: 'run', p: [2.1, 0.9, 12] }, fov: 38 },
  between: { from: { of: 'run', p: [2.05, 1.05, 2.6] }, to: { of: 'run', p: [2.05, 1.05, 1.6] }, look: { of: 'run', p: [0.7, 0.75, -0.6] }, fov: 40, near: NEAR },
  nateFace: { from: { cabin: 'run', at: 'pass', p: [0.05, 0.02, 0.25] }, look: { cabin: 'run', at: 'eye', p: [0, -0.02, 0] }, fov: 40, near: NEAR },
  nateClose: { from: { cabin: 'run', at: 'pass', p: [0.12, 0.0, 0.38] }, to: { cabin: 'run', at: 'pass', p: [0.16, 0.0, 0.3] }, look: { cabin: 'run', at: 'eye', p: [0, -0.03, 0] }, fov: 30, near: NEAR },
  povZero: { from: { cabin: 'run', at: 'eye', p: [0, 0.0, -0.02] }, look: { of: 'zero', p: [0, 0.85, 0.5] }, fov: 46, near: NEAR },
  dial: { from: { cabin: 'run', at: 'mid', p: [0.04, -0.17, 0.36] }, to: { cabin: 'run', at: 'mid', p: [0.03, -0.18, 0.42] }, look: { cabin: 'run', at: 'dash', p: AT_DIAL }, fov: 34, near: 0.03 },
  key: { from: { cabin: 'run', at: 'mid', p: [0.1, -0.24, 0.38] }, to: { cabin: 'run', at: 'mid', p: [0.1, -0.26, 0.44] }, look: { cabin: 'run', at: 'dash', p: AT_KEY }, fov: 32, near: 0.03 },
  hands: { from: { cabin: 'run', at: 'pass', p: [0.08, 0.05, 0.15] }, look: { cabin: 'run', at: 'wheel', p: [0, 0, 0] }, fov: 38, near: NEAR },
  side: { from: { of: 'run', p: [-4.2, 1.05, 0.8] }, to: { of: 'run', p: [-4.0, 1.05, -0.4] }, look: { of: 'run', p: [2.2, 0.85, 0.4] }, fov: 44 },
  // (out on his left, past the lane Zero comes up in: it goes by between the camera and his car)
  pass: { from: { of: 'run', p: [8.8, 1.2, 6] }, to: { of: 'run', p: [8.6, 1.3, 9] }, look: { of: 'run', p: [1.0, 0.8, -3] }, lookTo: { of: 'run', p: [3.0, 0.8, 8] }, fov: 46 },
};

// the four replies on the radio (two times the same four: "theo_reply_a", "theo_reply_b"); silence is the last,
// and it is what happens when the player does not answer
const REPLIES = (k) => [
  { text: 'c8.ch.why', set: { [k]: 'why' } },
  { text: 'c8.ch.scared', set: { [k]: 'scared' } },
  { text: 'c8.ch.sorry', set: { [k]: 'sorry' } },
  { text: 'c8.ch.silence', set: { [k]: 'silence' } },
];
const said = (k, v) => ({ flag: k, is: v });

export default {
  id: 'chapter08',
  number: 8,
  title: 'c8.title',
  vehicle: 'run',
  getIn: 'c8.get_in',
  // (what a normal game has decided by now; used when a mission is started from the mission list. Chapter 7 is not
  //  written yet: dante_captured and juno_fate are left out - the address option "flags" can set them for a test)
  flags: {
    limiter_off: true, ticket_taken: true, keystone_found: true, chip_holder: 'lena', chip_to_lena: true,
    mace_gave_car: true, zero_found_race: true, jacket_taken: true, mace_forgiven: true, c6_end: 'forgive',
    theo_car: true, theo_key: true, garage_open: true, upgrades_at: 'garage',
  },
  preload: { actors: ['Lena_Marchetti', 'Adrian_Vance'], vehicles: ['tech_patrol_car'] },

  missions: [
    // =====================================================================
    // 1. THE PILOT KEY - Lena's safehouse. Short. The news on the TV with the sound low, rain on the window.
    // =====================================================================
    {
      id: 'c8m0', title: 'c8.m0',
      setup: [
        NIGHT,
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'safehouse', set: true },
        LENA(),
        // (the man on the news: his face is taken once from his model for the TV, then he is gone)
        { do: 'actor', id: 'vance', model: 'Adrian_Vance', name: 'name.vance', at: s(0, 0, -14), face: 0, fixed: true, mood: 'smirk', look: null },
        { do: 'prop', id: 'laptop', kind: 'laptop', at: SAFE.laptop, face: 0 },
        { do: 'prop', id: 'key', kind: 'pilotKey', at: SAFE.key, face: 20 },
        { do: 'player', stage: { at: s(SAFE.nate[0], 0, SAFE.nate[1]), face: 200, pose: 'idle' }, mood: 'tired' },
        KEY_LIGHT_ROOM,
        { do: 'allow', enter: 'none', move: false },
        { do: 'wanted', stars: 0 },
      ],
      steps: [
        { do: 'card', over: 'c8.card.over', title: 'c8.title', sub: 'c8.card.sub', seconds: 4.5 },
        { do: 'safehouse', tv: 'vance', headline: 'c8.tv.headline', ticker: 'c8.tv.ticker' },
        { do: 'remove', ids: ['vance'] },
        {
          do: 'cutscene', shots: [
            // the room: rain on the window, the TV flickering with the news, Lena bent over her laptop
            { seconds: 5.5, fade: 'in', cam: { from: s(-2.55, 1.75, 2.35), to: s(-2.25, 1.7, 2.05), look: s(1.0, 0.95, -1.5), fov: 50 } },
            // the news, the sound almost off: his face, the words along the bottom
            { seconds: 4.0, cam: { from: s(-1.2, 1.05, -0.25), to: s(-1.5, 1.02, -0.22), look: SAFE.tv, fov: 34 } },
            // the pilot key on the laptop, glowing green
            { seconds: 5.0, cam: { from: s(1.95, 1.08, -1.35), to: s(1.85, 1.02, -1.45), look: SAFE.key, fov: 30, near: NEAR },
              lines: [{ at: 0.8, who: 'lena', text: 'c8.lena.speed', mood: 'stern' }] },
            { seconds: 4.5, cam: { from: s(1.0, 1.22, -2.42), to: s(0.95, 1.2, -2.38), look: s(1.2, 1.2, -1.25), fov: 40, near: NEAR },
              do: [{ do: 'actorSet', id: 'lena', look: 'player' }],
              lines: [{ at: 0.4, who: 'lena', text: 'c8.lena.see_you', mood: 'worried' }] },
            // (Dante was taken: Nate looks at his chair, and nobody says anything)
            { seconds: 4.2, if: { flag: 'dante_captured' }, cam: { from: s(0.6, 1.72, 2.02), to: s(0.66, 1.7, 1.9), look: SAFE.chair, fov: 36 },
              do: [{ do: 'player', look: SAFE.chair, mood: 'sad' }] },
            // (Juno was spared: Lena says one thing about her bike)
            { seconds: 4.6, if: { flag: 'juno_fate', is: 'spared' }, cam: { from: s(1.0, 1.22, -2.42), look: s(1.2, 1.2, -1.25), fov: 36, near: NEAR },
              lines: [{ at: 0.4, who: 'lena', text: 'c8.lena.juno', mood: 'tired' }] },
            // (over Lena's shoulder on Nate; then over his on her)
            { seconds: 3.0, cam: { from: s(1.62, 1.48, -0.98), to: s(1.58, 1.48, -0.9), look: s(0.45, 1.55, 1.05), fov: 38 },
              do: [{ do: 'player', look: s(1.2, 1.2, -1.2), mood: 'tired' }],
              lines: [{ at: 0.3, who: 'nate', text: 'c8.nate.if_answers' }] },
            { seconds: 3.6, cam: { from: s(0.62, 1.68, 1.72), to: s(0.66, 1.66, 1.62), look: s(1.2, 1.18, -1.2), fov: 38 },
              lines: [{ at: 0.4, who: 'lena', text: 'c8.lena.listen' }] },
            { seconds: 2.6, cam: { from: s(1.95, 1.08, -1.35), look: SAFE.key, fov: 30, near: NEAR }, fade: 'out', fadeSeconds: 1.4 },
          ],
        },
        { do: 'flag', set: { pilot_key_ready: true } },
        { do: 'safehouse', set: false },
        { do: 'remove', ids: ['lena', 'laptop', 'key'] },
        { do: 'light' },
      ],
      flags: { pilot_key_ready: true },
    },

    // =====================================================================
    // 2. BE SEEN - Ironhill Highway, night, rain. Full speed, so Zero can see him. Then keep up with it.
    // =====================================================================
    {
      id: 'c8m1', title: 'c8.m1',
      setup: [
        NIGHT,
        { do: 'world', traffic: 8, people: 0, indoors: false, now: true },
        ...RUN_CAR([LANE[1], -300]),
        ...DASH,
        { do: 'player', inCar: 'run' },
        { do: 'allow', enter: ['run'], move: true, drive: true },
        { do: 'run', start: true },
        { do: 'run', autoRewind: { at: 1385, to: 60 } },
        KEY_LIGHT_CAR,
        { do: 'wanted', stars: 0 },
        { do: 'cam', mode: 'chase' },
      ],
      steps: [
        { do: 'fade', to: 'clear', seconds: 1.6 },
        {
          do: 'cutscene', shots: [
            // the key in the dash, its light breathing; the radio dial; the road ahead in the rain
            { seconds: 4.2, fade: 'in', cam: C.key, do: [{ do: 'propSet', id: 'key', call: { setLink: 0.25 } }] },
            { seconds: 3.6, cam: C.dial, do: [{ do: 'propSet', id: 'dial', call: { tune: 0.15, setSignal: 0.15 } }, { do: 'sound', name: 'radioClick' }],
              lines: [{ at: 0.6, do: [{ do: 'propSet', id: 'dial', call: { tune: 0.62 } }, { do: 'sound', name: 'tune' }] }] },
            { seconds: 4.0, pov: true, cam: { from: { cabin: 'run', at: 'eye', p: [0, 0.02, 0] }, look: { of: 'run', p: [0, 1.0, 40] }, fov: 50, near: NEAR },
              lines: [{ at: 0.5, who: 'nate', kind: 'thought', text: 'c8.nate.full_speed', mood: 'tired' }] },
          ],
        },
        { do: 'checkpoint', id: 1 },
        // 30 seconds over 150 km/h. On the way, out of the dark behind: Zero.
        { do: 'runGoal', meter: 'seen', seconds: 30, text: 'c8.obj.seen', info: 'c8.info.seen', tip: 'c8.tip.seen', tipSeconds: 8,
          marks: [
            { at: 13, do: [{ do: 'run', zero: 'appear' }] },
            { at: 17, do: [{ do: 'say', who: 'wren', text: 'c8.wren.behind' }] },
          ] },
        { do: 'waitFor', event: 'run:zeroHere', text: 'c8.obj.keep_speed', timeout: 9 },
        {
          do: 'cutscene', shots: [
            // in the mirror, behind him in the rain: a soft cold glow, no siren, no sound but the engines
            { seconds: 4.6, pov: true, cam: { from: { cabin: 'run', at: 'eye', p: [0, 0.02, 0] }, look: { of: 'run', p: [0, 1.0, 40] }, fov: 52, near: NEAR },
              do: [BACK, CRUISE(155), { do: 'run', zero: 'follow' }, { do: 'music', zero: 0.6 }, { do: 'rearView', car: 'run', x: 0 }],
              lines: [{ at: 1.6, who: 'nate', kind: 'thought', text: 'c8.nate.there', mood: 'afraid' }] },
            // it pulls out and goes past him, close, on his left
            { seconds: 5.4, cam: C.pass, do: [{ do: 'rearView', off: true }, { do: 'run', zero: 'lead', speed: 165 }, { do: 'music', zero: 0 }],
              lines: [{ at: 3.0, who: 'lena', kind: 'radio', text: 'c8.lena.keep_up' }] },
          ],
        },
        { do: 'run', cruise: null },
        { do: 'checkpoint', id: 2, setup: [{ do: 'run', zero: 'lead', speed: 165 }] },
        // keep up with it: 15 seconds with Zero in reach (it never runs away for good)
        { do: 'runGoal', meter: 'matched', seconds: 15, text: 'c8.obj.match', info: 'c8.info.match', lostText: 'c8.obj.find_zero', tip: 'c8.tip.match' },
      ],
    },

    // =====================================================================
    // 3. SIDE BY SIDE - Zero slows and comes up beside him. Hold it there while Lena links the pilot key.
    // =====================================================================
    {
      id: 'c8m2', title: 'c8.m2',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 8, people: 0, indoors: false, now: true },
          ...RUN_CAR([LANE[1], 540], { speed: 120 }),
          ...DASH,
          { do: 'player', inCar: 'run' },
          { do: 'allow', enter: ['run'], move: true, drive: true },
          { do: 'run', start: true },
          { do: 'run', zero: 'lead', speed: 140 },
          { do: 'wanted', stars: 0 },
        ]),
        // (this mission stays on the dark stretch north of the city: z 540 .. 1385. Near the city the wide shots
        //  look back at all its towers - too many draw calls for a phone)
        { do: 'run', autoRewind: { at: 1385, to: 540 } },
      ],
      steps: [
        {
          do: 'cutscene', shots: [
            // Zero drops back beside him: its glow on his door, the rain lit around it
            // (the cut puts the two cars at z 540, wherever the last mission left them)
            { seconds: 5.5, cam: C.wide, do: [{ do: 'run', rewind: 540 }, CRUISE(118), { do: 'run', zero: 'cruise' }, ZERO_LIGHT],
              lines: [{ at: 3.0, who: 'wren', text: 'c8.wren.beside' }] },
            { seconds: 4.8, pov: true, cam: C.povZero, do: [{ do: 'player', look: { of: 'zero', p: [0, 0.9, 0] }, mood: 'afraid' }] },
            { seconds: 5.0, cam: C.between, do: [{ do: 'player', look: null }],
              lines: [{ at: 0.6, who: 'lena', kind: 'radio', text: 'c8.lena.hold' }] },
          ],
        },
        { do: 'run', cruise: null },
        { do: 'run', zero: 'beside', speed: 118 },
        // (only wind, the tyres and the two engines while Lena works: the radio stays silent until the link is made)
        { do: 'music', radio: 0 },
        { do: 'propSet', id: 'dial', call: { setSignal: 0.35 } },
        { do: 'checkpoint', id: 1, setup: [{ do: 'run', zero: 'beside', speed: 118 }, ZERO_LIGHT, { do: 'music', radio: 0 }] },
        // the gentle hack: long nodes, no clock, no penalty - the link only grows while the two cars are steady
        { do: 'hack', steady: true, title: 'c8.hack.title', hint: 'c8.hack.steady', wobble: 'c8.hack.wobble', nodes: 6, seconds: 20,
          text: 'c8.obj.side', tip: 'c8.tip.side', tipSeconds: 8,
          ok: [{ do: 'propSet', id: 'key', call: { setLink: 1 } }, { do: 'sound', name: 'chime' }] },
      ],
    },

    // =====================================================================
    // 4. TALK - the radio connects. WREN's locked part opens. A voice comes in: Theo.
    //    (the story drives both cars: the camera stays on them, in the rain)
    // =====================================================================
    {
      id: 'c8m3', title: 'c8.m3',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 8, people: 0, indoors: false, now: true },
          ...RUN_CAR([LANE[1], 560], { speed: 70 }),
          ...DASH,
          { do: 'player', inCar: 'run' },
          { do: 'allow', enter: ['run'] },
          { do: 'run', start: true },
          { do: 'run', zero: 'cruise' },
          { do: 'propSet', id: 'key', call: { setLink: 1 } },
          ZERO_LIGHT,
          { do: 'wanted', stars: 0 },
        ]),
        { do: 'run', autoRewind: null },
      ],
      steps: [
        CRUISE(TALK_KMH),
        { do: 'run', zero: 'cruise' },
        // ---- THE LINK: the radio finds Zero; WREN's locked part opens ----
        {
          do: 'cutscene', keep: true, shots: talk([
            { seconds: 4.2, cam: C.dial, do: [BACK, { do: 'music', radio: 0.75, calm: 0 }, { do: 'propSet', id: 'dial', call: { tune: 0.81, setSignal: 1 } }, { do: 'sound', name: 'tune' }],
              lines: [{ at: 1.6, do: [{ do: 'sound', name: 'radioClick' }] }] },
            { seconds: 3.8, cam: C.key, do: [{ do: 'propSet', id: 'key', call: { setLink: 1 } }, { do: 'light', at: { cabin: 'run', at: 'dash', p: plus(AT_KEY, [0, 0.08, -0.05]) }, color: 0x46ff9c, power: 0.9, range: 1.4 }],
              lines: [{ at: 1.0, who: 'wren', text: 'c8.wren.unlocked' }] },
            // WREN, for two sentences, in a voice more like Theo's
            { seconds: 7.6, cam: C.nateFace, do: [{ do: 'player', mood: 'afraid' }],
              lines: [{ at: 0.6, who: 'wren', kind: 'wrenTheo', text: 'c8.wren.theo1', seconds: 3.4 }, { at: 4.1, who: 'wren', kind: 'wrenTheo', text: 'c8.wren.theo2', seconds: 3.2 }] },
            // SOLBERG'S HIDDEN FILE: a tiny memory card glowing in a small case (a memory: no words)
            { seconds: 5.0, fade: 'fromWhite', fadeSeconds: 0.9,
              cam: { from: s(0.3, 1.08, 7.6), to: s(0.2, 0.98, 7.72), look: s(0.0, 0.76, 8.05), fov: 30, near: NEAR },
              do: [{ do: 'prop', id: 'memcase', kind: 'memoryCase', at: s(0, 0.72, 8.05), face: 160 },
                { do: 'safehouse', set: true }, { do: 'safehouse', tvOn: false, lamp: 0 }, { do: 'memory', on: true },
                { do: 'light', at: s(0.1, 1.55, 7.95), color: 0xbfe8ff, power: 5, range: 3.0 }],
              end: [{ do: 'memory', on: false }, { do: 'safehouse', set: false }, { do: 'remove', ids: ['memcase'] }, { do: 'flag', set: { wren_fragment_unlocked: true } }] },
            { seconds: 5.4, fade: 'fromWhite', fadeSeconds: 0.7, cam: C.high, do: [ZERO_LIGHT],
              lines: [{ at: 1.0, who: 'wren', text: 'c8.wren.plain' }] },
          ]),
        },
        // ---- THEO ----
        {
          do: 'cutscene', keep: true, shots: talk([
            // only the rain and the voice; one low slow pad
            { seconds: 6.0, cam: C.wide, do: [BACK, { do: 'music', calm: 0.45, radio: 0.85 }],
              lines: [{ at: 1.5, who: 'theo', kind: 'signal', text: 'c8.theo.nate', seconds: 2.6 }] },
            { seconds: 5.5, cam: C.nateClose, do: [{ do: 'player', mood: 'afraid' }],
              lines: [{ at: 1.6, who: 'nate', text: 'c8.nate.theo', mood: 'sad' }] },
            { seconds: 6.5, cam: C.between,
              lines: [{ at: 0.8, who: 'theo', kind: 'signal', text: 'c8.theo.tape', seconds: 3.6 }] },
            { seconds: 5.0, cam: C.nateFace,
              lines: [{ at: 0.8, who: 'nate', text: 'c8.nate.track7' }] },
            { seconds: 6.6, cam: C.side,
              lines: [{ at: 0.8, who: 'theo', kind: 'signal', text: 'c8.theo.never', seconds: 4.2 }] },
            // SILENCE for four seconds: the pad goes; only the rain and the two engines
            { seconds: 4.6, cam: C.high, do: [{ do: 'music', calm: 0 }] },
            // he forgets the name. The camera shows it: Nate's face, a long look at the dark car
            { seconds: 5.6, cam: C.between, do: [BACK],
              lines: [{ at: 0.6, who: 'theo', kind: 'signal', text: 'c8.theo.driver', seconds: 3.0 }] },
            { seconds: 5.2, cam: C.nateClose, do: [{ do: 'player', mood: 'sad', look: { of: 'zero', p: [0, 0.9, 0] } }] },
            { seconds: 4.2, pov: true, cam: C.povZero },
            { seconds: 5.8, cam: C.nateFace, do: [{ do: 'player', look: null }],
              lines: [{ at: 1.2, who: 'theo', kind: 'signal', text: 'c8.theo.nate_again', seconds: 2.4 }, { at: 3.6, do: [{ do: 'sound', name: 'breath' }, { do: 'player', mood: 'tired' }] }] },
            // the half truth
            { seconds: 8.6, cam: C.wide, do: [BACK],
              lines: [
                { at: 0.8, who: 'theo', kind: 'signal', text: 'c8.theo.running1', seconds: 3.2 },
                { at: 4.2, who: 'theo', kind: 'signal', text: 'c8.theo.running2', seconds: 3.6, do: [{ do: 'flag', set: { theo_running_confirmed: true } }] },
              ] },
            { seconds: 3.0, cam: C.nateClose },
          ]),
        },
        { do: 'flag', set: { theo_running_confirmed: true } },
        // ---- REPLY 1 (silence is always there, and it is what happens when no answer is given) ----
        { do: 'choice', layout: 'radio', prompt: 'c8.ch.prompt', options: REPLIES('theo_reply_a'), seconds: 10, default: 3 },
        {
          do: 'cutscene', keep: true, shots: talk([
            { seconds: 3.4, if: { not: said('theo_reply_a', 'silence') }, cam: C.nateFace, do: [BACK],
              lines: [
                { at: 0.4, if: said('theo_reply_a', 'why'), who: 'nate', text: 'c8.ch.why' },
                { at: 0.4, if: said('theo_reply_a', 'scared'), who: 'nate', text: 'c8.ch.scared' },
                { at: 0.4, if: said('theo_reply_a', 'sorry'), who: 'nate', text: 'c8.ch.sorry' },
              ] },
            // (a silence: the next line comes much later)
            { seconds: 5.5, if: said('theo_reply_a', 'silence'), cam: C.high, do: [BACK] },
            { seconds: 6.4, cam: C.between,
              lines: [
                { at: 0.9, if: said('theo_reply_a', 'why'), who: 'theo', kind: 'signal', text: 'c8.theo.a_why', seconds: 3.8 },
                { at: 0.9, if: said('theo_reply_a', 'scared'), who: 'theo', kind: 'signal', text: 'c8.theo.a_scared', seconds: 4.2 },
                { at: 0.9, if: said('theo_reply_a', 'sorry'), who: 'theo', kind: 'signal', text: 'c8.theo.a_sorry', seconds: 4.0 },
                { at: 0.9, if: said('theo_reply_a', 'silence'), who: 'theo', kind: 'signal', text: 'c8.theo.a_silence', seconds: 3.6 },
              ] },
            { seconds: 7.0, cam: C.side,
              lines: [{ at: 1.0, who: 'theo', kind: 'signal', text: 'c8.theo.watched', seconds: 4.2 }] },
            { seconds: 2.6, cam: C.nateClose },
          ]),
        },
        // ---- REPLY 2 ----
        { do: 'choice', layout: 'radio', prompt: 'c8.ch.prompt', options: REPLIES('theo_reply_b'), seconds: 10, default: 3 },
        {
          do: 'cutscene', keep: true, shots: talk([
            { seconds: 3.4, if: { not: said('theo_reply_b', 'silence') }, cam: C.nateFace, do: [BACK],
              lines: [
                { at: 0.4, if: said('theo_reply_b', 'why'), who: 'nate', text: 'c8.ch.why' },
                { at: 0.4, if: said('theo_reply_b', 'scared'), who: 'nate', text: 'c8.ch.scared' },
                { at: 0.4, if: said('theo_reply_b', 'sorry'), who: 'nate', text: 'c8.ch.sorry' },
              ] },
            { seconds: 5.5, if: said('theo_reply_b', 'silence'), cam: C.behind, do: [BACK] },
            { seconds: 6.6, cam: C.wide,
              lines: [
                { at: 0.9, if: said('theo_reply_b', 'why'), who: 'theo', kind: 'signal', text: 'c8.theo.b_why', seconds: 3.8 },
                { at: 0.9, if: said('theo_reply_b', 'scared'), who: 'theo', kind: 'signal', text: 'c8.theo.b_scared', seconds: 4.0 },
                { at: 0.9, if: said('theo_reply_b', 'sorry'), who: 'theo', kind: 'signal', text: 'c8.theo.b_sorry', seconds: 4.0 },
                { at: 0.9, if: said('theo_reply_b', 'silence'), who: 'theo', kind: 'signal', text: 'c8.theo.b_silence', seconds: 3.8 },
              ] },
            { seconds: 4.0, cam: C.hands, do: [{ do: 'player', mood: 'sad' }] },
          ]),
        },
        // ---- THE QUESTION (ask it, or keep it) ----
        { do: 'choice', layout: 'radio', prompt: 'c8.ch.ask_prompt', seconds: 12, default: 1, options: [
          { text: 'c8.ch.ask', set: { asked_crash_question: true } },
          { text: 'c8.ch.keep', set: { asked_crash_question: false } },
        ] },
        {
          do: 'cutscene', keep: true, shots: talk([
            { seconds: 5.4, if: { flag: 'asked_crash_question' }, cam: C.nateClose, do: [BACK],
              lines: [{ at: 0.6, who: 'nate', text: 'c8.nate.crash', mood: 'afraid', seconds: 3.6 }] },
            // the long pause before the answer
            { seconds: 6.0, if: { flag: 'asked_crash_question' }, cam: C.high },
            { seconds: 8.0, if: { flag: 'asked_crash_question' }, cam: C.between,
              lines: [{ at: 0.6, who: 'theo', kind: 'signal', text: 'c8.theo.no1', seconds: 2.4 }, { at: 3.2, who: 'theo', kind: 'signal', text: 'c8.theo.no2', seconds: 4.4 }] },
            { seconds: 5.0, if: { flag: 'asked_crash_question' }, cam: C.nateFace, do: [{ do: 'player', mood: 'tired' }],
              lines: [{ at: 2.4, do: [{ do: 'sound', name: 'breath' }] }] },
            // (kept: he almost asks; his hands on the wheel)
            { seconds: 5.0, if: { not: { flag: 'asked_crash_question' } }, cam: C.hands, do: [BACK, { do: 'player', mood: 'sad' }] },
            { seconds: 4.0, if: { not: { flag: 'asked_crash_question' } }, cam: C.nateClose },
            // ---- THE FAILED SIGNAL ----
            { seconds: 4.6, cam: C.wide, do: [BACK],
              lines: [{ at: 0.8, who: 'theo', kind: 'signal', text: 'c8.theo.tunnel', seconds: 2.6 }, { at: 2.9, do: [{ do: 'music', radioStatic: 1.8, calm: 0 }, { do: 'propSet', id: 'dial', call: { setSignal: 0.08 } }] }] },
            // behind them: the Phantoms of KVI, lights flashing, drones over the road
            { seconds: 5.2, cam: { from: { of: 'run', p: [-1.0, 2.2, -5] }, look: { of: 'run', p: [2, 1.6, -120] }, fov: 34 },
              do: [{ do: 'run', phantoms: 3, back: 175 }, { do: 'run', drones: 2 }, { do: 'sound', name: 'sirenBurst', seconds: 1.6 }, { do: 'wanted', stars: 3 }, { do: 'music', tension: 0.7 }],
              lines: [{ at: 2.2, who: 'lena', kind: 'radio', text: 'c8.lena.behind' }] },
            { seconds: 3.0, cam: C.dial },
          ]),
        },
        // keep the dead radio on, or switch it off
        { do: 'choice', layout: 'radio', prompt: 'c8.ch.radio_prompt', seconds: 7, default: 0, options: [
          { text: 'c8.ch.radio_on', set: { radio_off: false }, do: [{ do: 'music', radio: 0.35 }] },
          { text: 'c8.ch.radio_off', set: { radio_off: true }, do: [{ do: 'music', radio: 0 }, { do: 'propSet', id: 'dial', call: { setSignal: 0 } }, { do: 'sound', name: 'radioClick' }] },
        ] },
      ],
    },

    // =====================================================================
    // 5. RUN - escape the Phantoms through the highway tunnel. Zero stays between Nate and them.
    // =====================================================================
    {
      id: 'c8m4', title: 'c8.m4',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 8, people: 0, indoors: false, now: true },
          ...RUN_CAR([LANE[1], 260], { speed: 110 }),
          ...DASH,
          { do: 'player', inCar: 'run' },
          { do: 'allow', enter: ['run'] },
          { do: 'run', start: true },
          { do: 'run', zero: 'guard' },
          { do: 'run', phantoms: 3, back: 150 },
          { do: 'run', drones: 2 },
          { do: 'propSet', id: 'key', call: { setLink: 1 } },
          { do: 'propSet', id: 'dial', call: { setSignal: 0.08, tune: 0.81 } },
          { do: 'music', radio: 0.35, if: { not: { flag: 'radio_off' } } },
          { do: 'propSet', id: 'dial', call: { setSignal: 0 }, if: { flag: 'radio_off' } },
        ]),
        { do: 'run', autoRewind: null },
        // (before the mission's rules look: a tunnel passed in an earlier mission is not this mission's tunnel)
        { do: 'run', forget: true },
        { do: 'wanted', stars: 3 },
        { do: 'music', tension: 1, calm: 0 },
        KEY_LIGHT_CAR,
      ],
      on: [
        // caught: he slowed right down with a Phantom on him
        { event: 'run:caught', fail: 'c8.fail.caught' },
        // out of the far mouth of the tunnel: Zero is between him and them - they give up
        { event: 'run:tunnelOut', do: [{ do: 'run', phantoms: 'giveUp' }, { do: 'wanted', stars: 0 }, { do: 'music', tension: 0.3 }] },
        // at the tunnel Zero makes its move (it starts 150 m before the mouth: the touch then comes at or in the tunnel)
        { event: 'run:tunnelNear', do: [{ do: 'run', zero: 'block' }, { do: 'say', who: 'wren', text: 'c8.wren.tunnel' }] },
        { event: 'run:blocked', do: [{ do: 'slowmo', scale: 0.45, seconds: 1.1 }, { do: 'say', who: 'lena', kind: 'radio', text: 'c8.lena.blocked' }] },
        // the radio left on: pieces of his voice in the static, now and then
        { flag: 'radio_off', is: false, hold: 9, repeat: true, do: [{ do: 'say', who: 'theo', kind: 'signal', texts: ['c8.theo.bits1', 'c8.theo.bits2', 'c8.theo.bits3', 'c8.theo.bits4'], seconds: 2.0 }] },
      ],
      steps: [
        { do: 'cine', on: false },
        { do: 'run', forget: true },
        { do: 'run', rewind: { over: 330, to: 260 } },
        { do: 'run', cruise: null },
        { do: 'run', zero: 'guard' },
        { do: 'checkpoint', id: 1, setup: [{ do: 'run', zero: 'guard' }] },
        { do: 'driveTo', at: [LANE[1], 1352], radius: 16, text: 'c8.obj.run', tip: 'c8.tip.run', tipSeconds: 7 },
      ],
    },

    // =====================================================================
    // 6. DRIVER - the tunnel's mouth, the rain again, Zero's glow turning away. The radio is dead.
    // =====================================================================
    {
      id: 'c8m5', title: 'c8.m5',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 8, people: 0, indoors: false, now: true },
          ...RUN_CAR([LANE[2], 1325], { speed: 60 }),
          ...DASH,
          { do: 'player', inCar: 'run' },
          { do: 'allow', enter: ['run'] },
          { do: 'run', start: true },
          { do: 'run', zero: 'cruise' },
          { do: 'propSet', id: 'key', call: { setLink: 0.2 } },
          { do: 'propSet', id: 'dial', call: { setSignal: 0 } },
        ]),
        { do: 'run', autoRewind: null },
      ],
      steps: [
        // (a new, quiet scene: no line from the chase is left on the screen)
        { do: 'hush' },
        { do: 'run', phantoms: 'stop' },
        { do: 'run', drones: 0 },
        { do: 'wanted', stars: 0 },
        { do: 'music', tension: 0, radio: 0, calm: 0 },
        { do: 'propSet', id: 'dial', call: { setSignal: 0 } },
        {
          do: 'cutscene', shots: [
            // he pulls over just out of the tunnel, by the wall, in the rain
            // (at the cut the run is put just past the tunnel mouth at 62 km/h, however fast he came out: the car then
            //  stops in front of these cameras, not far up the road)
            { seconds: 5.0, cam: { from: [LANE[0] + 3.5, 10.4, 1395], to: [LANE[0] + 3.0, 10.2, 1388], look: { of: 'run', p: [0, 0.8, 0] }, fov: 44 },
              do: [{ do: 'run', rewind: 1345 }, { do: 'vehicleSet', id: 'run', speed: 62 },
                { do: 'run', cruise: { x: LANE[2] + 0.8, speed: 30 } }, { do: 'run', zero: 'cruise' }, KEY_LIGHT_CAR, { do: 'music', silence: 1.2 }],
              lines: [{ at: 2.4, do: [{ do: 'run', cruise: null }, { do: 'autoDrive', brake: 0.7 }] }] },
            // Zero turns away: its glow goes back into the orange of the tunnel
            { seconds: 7.5, cam: { from: { of: 'run', p: [0.2, 1.9, -4.5] }, look: [LANE[0], 9.0, 1300], fov: 40 },
              do: [{ do: 'autoDrive', brake: 1 }, { do: 'run', zero: 'away' }, { do: 'light' }, { do: 'sound', name: 'coolTicks', seconds: 26 }] },
            // breathing hard, in the dark car; the dead radio; the key's light fading
            { seconds: 5.0, cam: C.nateClose, do: [{ do: 'player', mood: 'tired' }, { do: 'propSet', id: 'key', call: { setLink: 0 } }],
              lines: [{ at: 0.6, do: [{ do: 'sound', name: 'breath' }] }, { at: 2.6, do: [{ do: 'sound', name: 'breath' }] }] },
            { seconds: 3.4, cam: C.dial },
            // the mixtape: into the dash. He does not press play.
            // (the only light left in the car: the faint warm glow of the dash lamps, enough to see the tape and the deck)
            { seconds: 5.0, cam: { from: { cabin: 'run', at: 'mid', p: [0.02, -0.22, 0.36] }, to: { cabin: 'run', at: 'mid', p: [0.02, -0.23, 0.42] }, look: { cabin: 'run', at: 'dash', p: AT_DECK }, fov: 34, near: 0.03 },
              do: [DASH_GLOW, { do: 'prop', id: 'tape', kind: 'tape', in: 'run', at: { cabinAt: 'dash', p: plus(AT_DECK, [-0.034, 0.003, -0.075]) }, rot: [Math.PI / 2, 0, 0], replace: true }],
              lines: [
                { at: 1.3, do: [{ do: 'prop', id: 'tape', kind: 'tape', in: 'run', at: { cabinAt: 'dash', p: plus(AT_DECK, [-0.034, 0.003, -0.045]) }, rot: [Math.PI / 2, 0, 0], replace: true }] },
                { at: 2.2, do: [{ do: 'remove', ids: ['tape'] }, { do: 'prop', id: 'deck', kind: 'deck', in: 'run', at: { cabinAt: 'dash', p: AT_DECK }, replace: true }, { do: 'sound', name: 'clunk' }] },
              ] },
            { seconds: 4.4, cam: C.hands },
            // "Driver." Then one short laugh, because it was Theo's joke.
            { seconds: 7.4, cam: C.nateFace, do: [{ do: 'player', mood: 'sad' }],
              lines: [
                { at: 1.2, who: 'nate', text: 'c8.nate.driver', seconds: 2.0 },
                { at: 3.6, do: [{ do: 'sound', name: 'laugh' }, { do: 'player', mood: 'smile' }] },
                { at: 5.2, do: [{ do: 'player', mood: 'sad' }] },
              ] },
            // (the line he says after it: peace, or not yet)
            { seconds: 5.4, cam: C.nateClose,
              lines: [
                { at: 0.8, if: { any: [said('theo_reply_b', 'sorry'), said('theo_reply_b', 'silence')] }, who: 'nate', text: 'c8.nate.peace', seconds: 2.8 },
                { at: 0.8, if: { not: { any: [said('theo_reply_b', 'sorry'), said('theo_reply_b', 'silence')] } }, who: 'nate', text: 'c8.nate.not_yet', seconds: 2.8 },
              ] },
            // the rain on the road, the tunnel's orange mouth, the slow fade
            { seconds: 7.0, cam: { from: [LANE[2] - 2.5, 9.4, 1400], to: [LANE[2] - 2.0, 10.6, 1408], look: [LANE[1], 9.0, 1330], fov: 46 }, fade: 'out', fadeSeconds: 4.5 },
          ],
        },
        { do: 'flag', set: { nate_partial_peace: false } },
        { do: 'if', cond: { any: [said('theo_reply_b', 'sorry'), said('theo_reply_b', 'silence')] }, then: [{ do: 'flag', set: { nate_partial_peace: true } }] },
        { do: 'run', stop: true },
        { do: 'wait', seconds: 1.2 },
        { do: 'end', over: 'c8.end.over', title: 'c8.title', lines: ['c8.end.1', 'c8.end.2', 'c8.end.3'], locked: 'c8.end.locked' },
      ],
    },
  ],
};
