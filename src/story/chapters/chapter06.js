// ---------------------------------------------------------------------------
// CHAPTER 6 - "OLD DEBTS" (the night after Chapter 5)
//
// This file is ONLY DATA, written like chapter05.js. The story engine (src/story/engine.js) explains every word used
// here at its top; the steps of this chapter are "garage", "explore" and "repair". All texts are keys of
// src/story/strings.js.
//
// The quietest chapter of the game. No chase, no gunfight, no timer, no stars, no minimap (calm: true). One room:
// Mace's garage at night (src/story/garageSet.js), rain on the roof, warm work lamps, a radio on a shelf, a kettle.
// Nate and Mace rebuild Theo's car (src/vehicles/theoCar.js) in six calm stations (src/story/repair.js); while Nate
// works, Mace tells a story about Theo. Before the last part, Nate puts the bank record on the bench.
//
// It uses what Chapter 5 left behind: confront_mace (true: the night starts colder - Mace says very little and does
// not meet Nate's eyes). It leaves for later chapters:
//   mace_forgiven   true (I forgive you) | false (Leave) | 'neutral' (Stay silent - only after 3 of Mace's stories)
//   c6_end          'forgive' | 'leave' | 'neutral' (the same, as a word)
//   wren_muted      true: WREN stays silent until Chapter 8
//   heard           how many of Mace's six stories were heard to the end (heard_1 .. heard_6)
//   garage_open     false after Leave: the garage is shut and Mace does not appear until Chapter 9 (mace_back: 9)
//   theo_car        Theo's car is a vehicle of the game (kind 'theo_coupe', in the garage, it drives like the chrome
//                   supercar) - after forgive or neutral
//   upgrades_at     'garage' (Mace's) or 'lena' (Lena's new base, after Leave)
//
// Places: { garage: [right, up, toward the street] }; { of: 'mace' | 'player' | 'van', p: [left, up, forward] }.
// The garage's front faces WEST, so in compass degrees: toward the street (+f) = 270, toward the back wall = 90,
// toward the bench side (+r) = 180, toward the car side (-r) = 0.
// ---------------------------------------------------------------------------

const NIGHT = { do: 'time', hour: 23.6, rain: true };
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));
const NEAR = 0.05;
// a point in the garage (r, up, f), a place on its floor
const g = (r, u, f) => ({ garage: [r, u, f] });
const at = (p) => g(p[0], 0, p[1]);
// compass degrees from one floor place [r, f] of the garage to another
const toward = (a, b) => Math.round(((Math.atan2(-(b[1] - a[1]), -(b[0] - a[0])) * 180) / Math.PI + 360) % 360);

// ---- the garage (see garageSet.js; Theo's car stands at r -6.9, f -3.9, its nose to the street) ----
const SPOT = {
  stairs: [0.12, -5.5],             // just inside the door to the stairs (Nate comes down from his flat)
  bench: [-0.5, -0.7],              // Mace at the bench (a warm night)
  carBack: [-5.62, -4.9],           // Mace at the car, by the cloth (a cold night: his back to the stairs)
  help: [-5.45, -2.7],              // where HELP MACE / BACK TO WORK is pressed: the car's left side
  benchNate: [-0.52, -2.0], benchMace: [-0.52, -0.75],      // the two of them at the bench (the paper between them)
  door: [-3.9, 6.05],               // in front of the roller door
  macePark: [-1.6, -0.2],           // Mace steps back from the bench
};
const PT = {
  car: [-6.9, -3.9],
  corner: g(-6.08, 0.55, -2.04), bumper: g(-6.9, 0.34, -1.74), engine: g(-6.9, 0.8, -2.82), wires: g(-6.38, 0.64, -2.06),
  deck: g(-6.9, 0.62, -3.68), roof: g(-6.62, 1.22, -4.15), seat: [-6.53, -4.3],
  clothNose: g(-6.35, 1.0, -1.95), clothRear: g(-6.3, 1.0, -5.75), lever: g(-5.08, 0.92, 0.1),
  paper: g(0.0, 0.93, -1.4), key: g(0.05, 0.935, -1.0), benchEdgeMace: g(-0.2, 0.93, -0.75), clothFloor: g(-6.9, 0.06, -1.0),
  radio: g(0.56, 1.62, 1.55),
};

// ---- people ----
// MACE (Marcus Doyle): Theo's old mechanic, the closest thing to a father the brothers had
const MACE = (place, face, more = {}) => ({ do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at: place, face, pose: 'work', fixed: true, look: null, mood: 'tired', ...more });
const MACE_AT = (place, face, more = {}) => ({ do: 'actorSet', id: 'mace', at: place, face, ...more });
const NATE_AT = (place, face, pose = 'idle', more = {}) => ({ do: 'player', stage: { at: place, face, pose }, ...more });

// ---- what the eye can rest on: LOOK / TOUCH / LISTEN (Nate's one line, never more than ten words) ----
const SPOTS = [
  { id: 'radio', at: g(0.15, 0, 1.55), label: 'c6.act.listen', note: 'c6.note.radio', radius: 1.3, do: [{ do: 'garage', radio: 'toggle' }, { do: 'sound', name: 'tick' }] },
  { id: 'kettle', at: g(-0.42, 0, 1.75), label: 'c6.act.touch', note: 'c6.note.kettle', radius: 1.1, do: [{ do: 'garage', kettle: true }] },
  { id: 'photos', at: g(-2.8, 0, -5.45), label: 'c6.act.look', note: 'c6.note.photos', radius: 1.3 },
  { id: 'initials', at: g(-0.45, 0, -1.3), label: 'c6.act.touch', note: 'c6.note.initials', radius: 1.0 },
  { id: 'marks', at: g(0.05, 0, -4.75), label: 'c6.act.look', note: 'c6.note.marks', radius: 1.0 },
  { id: 'pegboard', at: g(-0.45, 0, -2.85), label: 'c6.act.look', note: 'c6.note.pegboard', radius: 1.0 },
  { id: 'chair', at: g(-4.3, 0, 4.75), label: 'c6.act.touch', note: 'c6.note.chair', radius: 1.2 },
  { id: 'window', at: g(-8.1, 0, -0.55), label: 'c6.act.look', note: 'c6.note.window', radius: 1.1 },
  { id: 'stain', at: g(-4.6, 0, 2.6), label: 'c6.act.look', note: 'c6.note.stain', radius: 1.0 },
];
const NEXT = { at: at(SPOT.help), label: 'c6.act.next', radius: 1.8 };
// a soft dip to black (it hides the cut from walking about to the close-up of the work)
const DIP = [{ do: 'fade', to: 'black', seconds: 0.45, wait: true }];
const UNDIP = { do: 'fade', to: 'clear', seconds: 0.9 };

// ---- the stories (Mace, while Nate works): slow, with room between the lines ----
const tell = (keys, moods = {}) => keys.map((k) => ({ who: 'mace', text: k, gap: 1.1, mood: moods[k] || 'tired' }));
const STORY = {
  1: tell(['c6.s1.1', 'c6.s1.2', 'c6.s1.3', 'c6.s1.4'], { 'c6.s1.4': 'smile' }),
  2: tell(['c6.s2.1', 'c6.s2.2', 'c6.s2.3', 'c6.s2.4', 'c6.s2.5'], { 'c6.s2.5': 'smile' }),
  3: tell(['c6.s3.1', 'c6.s3.2', 'c6.s3.3', 'c6.s3.4']),
  4: tell(['c6.s4.1', 'c6.s4.2', 'c6.s4.3'], { 'c6.s4.3': 'sad' }),
  5: tell(['c6.s5.1', 'c6.s5.2', 'c6.s5.3', 'c6.s5.4'], { 'c6.s5.4': 'smile' }),
  6: tell(['c6.s6.1', 'c6.s6.2', 'c6.s6.3', 'c6.s6.4'], { 'c6.s6.3': 'sad', 'c6.s6.4': 'sad' }),
};
// the silent beat at the end of every story: Mace stops, wipes his hands on a rag ... and goes back to work
const BEAT = (hands) => ({
  beat: [
    { do: 'actorSet', id: 'mace', pose: 'wipe', hands: null, look: null, mood: 'tired' },
    { do: 'prop', id: 'rag', kind: 'oilRag', on: 'mace', bone: 'hand_L', p: [0, -0.07, 0.04], replace: true },
  ],
  beatCam: { from: { of: 'mace', p: [0.3, 1.25, 0.95] }, to: { of: 'mace', p: [0.25, 1.22, 0.8] }, look: { of: 'mace', p: [0, 1.05, 0.25] }, fov: 34, near: NEAR },
  after: [{ do: 'remove', ids: ['rag'] }, { do: 'actorSet', id: 'mace', pose: 'work', hands }],
});
// the car a little more itself: a wide look at it while the dust goes
const CLEAN_CAM = { from: g(-4.3, 1.7, 0.45), to: g(-4.5, 1.65, 0.15), look: g(-6.9, 0.6, -3.6), fov: 46 };

// ---- the state of the garage at the start of each mission (for a game started there) ----
const ROOM = [
  NIGHT,
  { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
  { do: 'garage', set: true, car: 'wreck', cloth: 0, lamps: { car: 1, bench: 1, stand: 0 }, stairs: 0, radio: true, kettle: false },
  { do: 'allow', enter: 'none' },
];
const AFTER_FIVE = { do: 'garage', car: { dirt: 0.3, bend: 0, hood: 0, bumper: 'new', cleaner: 'on', wires: 1, lights: 0, deck: 'out' }, cloth: 1, lamps: { stand: 1 } };

// ---- one repair station: the two of them at the part (behind a short dip to black), the work, the story, the
//      beat, a little less dust; then the room again until BACK TO WORK ----
function station(n, o) {
  return [
    ...DIP,
    NATE_AT(at(o.nate), toward(o.nate, o.face), 'work', { hands: o.hands, look: o.look || o.hands }),
    MACE_AT(at(o.mace), toward(o.mace, o.maceFace), { pose: 'work', hands: o.maceHands, look: o.maceLook || o.maceHands, mood: 'tired' }),
    ...(o.before || []),
    UNDIP,
    {
      do: 'repair', station: n, hint: o.hint, hint2: o.hint2, cam: o.cam, story: [...(o.intro || []), ...STORY[n]], dirt: o.dirt, cleanCam: o.cleanCam || CLEAN_CAM,
      ...BEAT(o.maceHands),
    },
    ...(o.then || []),
    { do: 'player', stage: null, hands: null, look: null },
    { do: 'actorSet', id: 'mace', pose: 'crossed', hands: null, look: PT.corner, at: at(SPOT.help.map((v, i) => v + [-0.2, -1.05][i])), face: 0 },
  ];
}

// ---------------------------------------------------------------------------------------------------- the endings
// WREN speaks once in this chapter, quietly, near the end. Yes: she stays silent until Chapter 8.
function WREN_ASK() {
  return [
    { do: 'choice', line: { who: 'wren', text: 'c6.wren.ask', seconds: 4.2, always: true },
      options: [{ text: 'c6.wren.yes', set: { wren_muted: true } }, { text: 'c6.wren.no', set: { wren_muted: false } }] },
  ];
}
// what Chapter 6 leaves for the next chapters (forgiven or silent: the garage stays a safe place)
const KEEP_GARAGE = { do: 'flag', set: { garage_open: true, theo_car: true, upgrades_at: 'garage', theo_key: true } };
const CLOSE_GARAGE = { do: 'flag', set: { garage_open: false, theo_car: false, upgrades_at: 'lena', mace_back: 9 } };

// forgive and neutral end on the same image: the car whole under the work lamp; Mace's hand on its roof; the light
// goes off; Nate in the driver's seat plays the mixtape - track 7 is silent, and this time he does not skip it.
function FINAL_IMAGE() {
  return [
    {
      do: 'cutscene', skippable: true,
      shots: [
        { seconds: 6.2, cam: { from: g(-3.55, 1.45, 1.7), to: g(-3.8, 1.42, 1.2), look: g(-6.9, 0.6, -3.4), fov: 44 },
          do: [
            { do: 'garage', car: { dirt: 0.08, deck: 'in', hood: 0, lights: 0 }, cloth: 'aside', lamps: { car: 1, bench: 0.8, stand: 1 } },
            { do: 'player', stage: { at: at([-5.3, -1.2]), face: toward([-5.3, -1.2], PT.car), pose: 'idle' }, hands: null, look: g(-6.9, 0.8, -3.6), mood: 'tired' },
            MACE_AT(at([-5.72, -4.15]), 0, { pose: 'idle', hands: null, look: g(-6.6, 1.0, -4.0), mood: 'tired' }),
          ] },
        // Mace's hand on the roof
        { seconds: 5.6, cam: { from: g(-5.35, 1.6, -3.2), to: g(-5.45, 1.56, -3.4), look: g(-6.55, 1.2, -4.15), fov: 34 },
          do: [{ do: 'actorSet', id: 'mace', pose: 'roof', hands: PT.roof, look: PT.roof }] },
        // he turns the light off
        { seconds: 5.0, cam: { from: g(-1.6, 2.3, -6.0), to: g(-1.75, 2.25, -5.7), look: g(-6.6, 1.1, -2.8), fov: 46 },
          do: [{ do: 'actorSet', id: 'mace', pose: 'idle', hands: null, look: g(-6.35, 3.0, -3.4) }],
          lines: [{ at: 1.6, do: [{ do: 'sound', name: 'tick' }, { do: 'garage', lamps: { car: 0, stand: 0, bench: 0.45 }, seconds: 1.1 }] }] },
        // Nate in the driver's seat. The deck glows a little.
        { seconds: 6.2, cam: { from: g(-7.35, 1.05, -3.65), to: g(-7.3, 1.04, -3.85), look: { of: 'player', p: [0, 0.85, 0.1] }, fov: 40, near: NEAR },
          do: [
            { do: 'player', stage: { at: g(PT.seat[0], 0.36, PT.seat[1]), face: 270, pose: 'sit', floorBelow: 0.36 }, look: PT.deck, mood: 'tired' },
            { do: 'garage', car: { lit: 1 } },
            { do: 'light', at: g(-6.8, 0.8, -3.75), color: 0x8fd8c4, power: 1.1, range: 1.8 },
            { do: 'actorSet', id: 'mace', look: g(-6.55, 1.0, -4.3), mood: 'tired' },
          ] },
        // the tape; track 7
        { seconds: 5.0, cam: { from: g(-6.55, 1.0, -4.35), look: g(-6.9, 0.62, -3.68), fov: 36, near: NEAR },
          lines: [{ at: 1.2, do: [{ do: 'sound', name: 'clunk' }, { do: 'music', tape: 7 }] }] },
        // the silence of track 7. His hand rests by the deck. He does not skip it.
        { seconds: 8.4, cam: { from: g(-7.3, 1.08, -3.75), to: g(-7.15, 1.06, -3.95), look: { of: 'player', p: [0, 0.95, 0.12] }, fov: 34, near: NEAR },
          do: [{ do: 'player', look: g(-6.9, 1.0, -2.0), mood: 'sad' }] },
        // the last image: the dark garage, the rain, the car with a small glow inside. Three seconds of silence.
        { seconds: 6.6, fade: 'out', fadeSeconds: 3.2, cam: { from: g(-1.8, 2.3, -6.1), to: g(-1.9, 2.25, -5.85), look: g(-6.6, 0.9, -3.0), fov: 48 },
          do: [{ do: 'music', silence: 3.2 }] },
      ],
    },
    { do: 'light' },
    { do: 'wait', seconds: 1.4 },
  ];
}

function FORGIVE() {
  return [
    {
      do: 'cutscene', keep: true,
      shots: [
        { seconds: 3.6, cam: { from: g(-0.12, 1.55, -0.95), to: g(-0.14, 1.56, -1.05), look: { of: 'player', p: [0, 1.58, 0] }, fov: 28 },
          do: [{ do: 'player', look: at(SPOT.benchMace) }],
          lines: [{ at: 0.8, who: 'nate', text: 'c6.nate.forgive', seconds: 2.2, mood: 'sad' }] },
        // Mace raises his head and, for the first time tonight, looks at him
        { seconds: 4.4, cam: { from: g(0.42, 1.32, -0.25), to: g(0.4, 1.34, -0.4), look: { of: 'mace', p: [0, 1.55, 0] }, fov: 28 },
          do: [{ do: 'actorSet', id: 'mace', pose: 'idle', hands: null, look: 'player', mood: 'sad' }] },
        // a key from his pocket
        { seconds: 4.2, cam: { from: g(0.05, 1.22, -1.15), to: g(0.0, 1.21, -1.25), look: g(-0.55, 1.12, -1.3), fov: 36 },
          do: [{ do: 'actorSet', id: 'mace', face: toward(SPOT.benchMace, SPOT.benchNate), pose: 'give', look: 'player' }, { do: 'sound', name: 'keys' },
            { do: 'prop', id: 'key', kind: 'carKey', on: 'mace', bone: 'hand_R', p: [0, -0.07, 0.035], replace: true }] },
        { seconds: 3.8, cam: { from: g(0.42, 1.32, -0.25), to: g(0.41, 1.33, -0.35), look: { of: 'mace', p: [0, 1.55, 0] }, fov: 28 },
          lines: [{ at: 0.7, who: 'mace', text: 'c6.mace.yours', seconds: 2.4, mood: 'sad' }] },
        // Nate takes it
        { seconds: 3.6, cam: { from: g(0.05, 1.22, -1.3), to: g(0.02, 1.21, -1.38), look: g(-0.55, 1.12, -1.4), fov: 36 },
          do: [{ do: 'player', stage: { at: at(SPOT.benchNate), face: toward(SPOT.benchNate, SPOT.benchMace), pose: 'give' }, look: { of: 'mace', p: [0, 1.6, 0] } }],
          lines: [{ at: 1.6, do: [{ do: 'remove', ids: ['key'] }, { do: 'prop', id: 'key', kind: 'carKey', on: 'player', bone: 'hand_R', p: [0, -0.07, 0.035] }, { do: 'sound', name: 'keys' }, { do: 'actorSet', id: 'mace', pose: 'idle' }] },
            { at: 2.6, do: [{ do: 'music', motif: 'forgive' }] }] },
      ],
    },
    { do: 'cine', on: false },
    KEEP_GARAGE,
    // the last part, together: the deck goes all the way in; the tape after it
    ...DIP,
    { do: 'remove', ids: ['key'] },
    NATE_AT(at([-5.55, -3.85]), 0, 'work', { hands: PT.deck, look: PT.deck, mood: 'tired' }),
    MACE_AT(at([-7.95, -3.75]), 180, { pose: 'work', hands: g(-7.1, 0.64, -3.62), look: PT.deck, mood: 'tired' }),
    UNDIP,
    { do: 'repair', station: 6, from: 0.8, again: false, heard: false, hint: 'c6.hint.deck', story: [], beatSeconds: 0,
      cam: { from: g(-6.2, 1.06, -4.7), to: g(-6.25, 1.04, -4.6), look: g(-6.9, 0.62, -3.66), fov: 46, near: NEAR, seconds: 30 } },
    {
      do: 'cutscene', keep: true,
      shots: [
        // Theo's tape goes into the dashboard
        { seconds: 4.0, cam: { from: g(-6.55, 1.0, -4.35), look: g(-6.9, 0.62, -3.68), fov: 36, near: NEAR },
          lines: [{ at: 1.0, do: [{ do: 'prop', id: 'tapeIn', kind: 'tape', at: g(-6.9, 0.64, -3.7), face: 270 }, { do: 'sound', name: 'clunk' }, { do: 'garage', car: { lit: 1 } }] }] },
        // the two of them, and the car whole again
        { seconds: 7.4, cam: { from: g(-6.45, 1.22, -2.75), to: g(-6.4, 1.24, -2.5), look: g(-4.95, 1.45, -1.8), fov: 46 },
          do: [
            { do: 'remove', ids: ['tapeIn'] },
            { do: 'garage', car: { dirt: 0.08, deck: 'in', lit: 1 }, cloth: 'aside' },
            { do: 'player', stage: { at: at([-5.2, -1.45]), face: toward([-5.2, -1.45], PT.car), pose: 'idle' }, hands: null, look: g(-6.9, 0.8, -3.4), mood: 'tired' },
            MACE_AT(at([-4.75, -2.2]), toward([-4.75, -2.2], PT.car), { pose: 'idle', hands: null, look: g(-6.9, 0.8, -3.4), mood: 'tired' }),
          ] },
      ],
    },
    ...WREN_ASK(),
    ...FINAL_IMAGE(),
    { do: 'end', over: 'c6.end.over', title: 'c6.title', lines: ['c6.end.1', 'c6.end.f2', 'c6.end.3'], locked: 'c6.end.locked' },
  ];
}

function NEUTRAL() {
  return [
    {
      do: 'cutscene', keep: true,
      shots: [
        // Nate says nothing
        { seconds: 5.4, cam: { from: g(-0.12, 1.55, -0.95), to: g(-0.15, 1.56, -1.1), look: { of: 'player', p: [0, 1.58, 0] }, fov: 28 },
          do: [{ do: 'player', look: PT.paper, mood: 'sad' }] },
        // Mace takes the key from his pocket and lays it on the bench, beside the paper; he steps back
        { seconds: 5.2, cam: { from: g(-0.3, 1.38, -1.75), to: g(-0.28, 1.35, -1.65), look: g(0.05, 0.93, -1.15), fov: 32 },
          do: [{ do: 'actorSet', id: 'mace', pose: 'putDown', hands: PT.key, look: PT.key, mood: 'sad' }],
          lines: [{ at: 1.4, do: [{ do: 'prop', id: 'key', kind: 'carKey', at: PT.key, face: 200 }, { do: 'sound', name: 'keys' }] },
            { at: 3.0, do: [{ do: 'actorSet', id: 'mace', pose: 'idle', hands: null, walk: at(SPOT.macePark), speed: 0.6, then: 180 }] }] },
      ],
    },
    { do: 'cine', on: false },
    KEEP_GARAGE,
    // the last part, alone
    ...DIP,
    NATE_AT(at([-5.55, -3.85]), 0, 'work', { hands: PT.deck, look: PT.deck, mood: 'tired' }),
    MACE_AT(at(SPOT.macePark), 0, { pose: 'crossed', hands: null, look: PT.car, mood: 'sad' }),
    UNDIP,
    { do: 'repair', station: 6, from: 0.8, again: false, heard: false, hint: 'c6.hint.deck', story: [], beatSeconds: 0,
      cam: { from: g(-6.2, 1.06, -4.7), to: g(-6.25, 1.04, -4.6), look: g(-6.9, 0.62, -3.66), fov: 46, near: NEAR, seconds: 30 } },
    {
      do: 'cutscene', keep: true,
      shots: [
        // he takes the key from the bench
        { seconds: 4.6, cam: { from: g(-0.3, 1.38, -1.75), look: g(0.05, 0.93, -1.05), fov: 32 },
          do: [NATE_AT(at([-0.52, -1.25]), 180, 'putDown', { hands: PT.key, look: PT.key })],
          lines: [{ at: 1.5, do: [{ do: 'remove', ids: ['key'] }, { do: 'sound', name: 'keys' }, { do: 'player', pose: 'idle', hands: null }] }] },
        // Mace turns the radio off. They do not speak.
        { seconds: 4.8, cam: { from: g(-0.45, 1.62, 2.55), to: g(-0.4, 1.62, 2.45), look: g(0.4, 1.55, 1.45), fov: 34 },
          do: [MACE_AT(at([0.05, 1.05]), toward([0.05, 1.05], [0.56, 1.55]), { pose: 'putDown', hands: g(0.45, 1.66, 1.5), look: PT.radio })],
          lines: [{ at: 1.6, do: [{ do: 'sound', name: 'tick' }, { do: 'garage', radio: false }, { do: 'actorSet', id: 'mace', pose: 'idle', hands: null }] },
            { at: 2.8, do: [{ do: 'music', motif: 'neutral' }] }] },
      ],
    },
    ...WREN_ASK(),
    ...FINAL_IMAGE(),
    { do: 'end', over: 'c6.end.over', title: 'c6.title', lines: ['c6.end.1', 'c6.end.n2', 'c6.end.3'], locked: 'c6.end.locked' },
  ];
}

// the van at the curb in front of the garage (as Chapter 2 left it: its new color, its new plate)
const PAINTS = [
  { name: 'c2.paint.blue', color: [0.12, 0.16, 0.25] },
  { name: 'c2.paint.red', color: [0.43, 0.15, 0.1] },
  { name: 'c2.paint.green', color: [0.21, 0.28, 0.2] },
  { name: 'c2.paint.grey', color: [0.37, 0.38, 0.39] },
];
const CURB = g(-10.5, 0, 11.3);
function LEAVE() {
  return [
    {
      do: 'cutscene', keep: true,
      shots: [
        { seconds: 5.2, cam: { from: g(-0.12, 1.55, -0.95), to: g(-0.15, 1.56, -1.1), look: { of: 'player', p: [0, 1.58, 0] }, fov: 28 },
          do: [{ do: 'player', look: PT.clothFloor, mood: 'sad' }] },
        // he turns away and walks to the big door; the roller door goes up, the rain comes in loud
        { seconds: 5.6, cam: { from: g(-4.25, 1.7, -1.7), to: g(-4.2, 1.68, -1.3), look: g(-3.95, 1.3, 6.1), fov: 40 },
          do: [NATE_AT(at(SPOT.door), 270, 'idle', { hands: null, look: null, mood: 'sad' }), MACE_AT(at(SPOT.benchMace), 0, { pose: 'idle', hands: null, look: 'player', mood: 'sad' })],
          lines: [{ at: 2.2, do: [{ do: 'sound', name: 'rattle' }, { do: 'music', motif: 'leave' }] }] },
        // the car, unfinished, under its work lamp
        { seconds: 6.0, cam: { from: g(-4.3, 1.4, -0.4), to: g(-4.5, 1.36, -0.75), look: g(-6.8, 0.75, -3.6), fov: 42 },
          do: [{ do: 'garage', lamps: { car: 1, stand: 0, bench: 0.6 } }] },
      ],
    },
    { do: 'fade', to: 'black', seconds: 1.4, wait: true },
    { do: 'cine', on: false },
    CLOSE_GARAGE,
    // outside: the street at night, in the rain. The garage door open, its light on the wet sidewalk, the radio
    // inside still playing; Mace in the doorway. The van at the curb.
    { do: 'garage', set: false },
    { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
    { do: 'shutter', open: 1, seconds: 0 },
    { do: 'tarp', hidden: true },
    { do: 'light', at: g(-4.5, 2.6, 4.8), color: 0xffc890, power: 30, range: 11 },
    { do: 'prop', id: 'rbox', kind: 'crate', at: g(-3.4, 0, 5.7), face: 270 },
    { do: 'prop', id: 'radio', kind: 'radio', at: g(-3.4, 0.5, 5.7), face: 300, song: true },
    { do: 'music', radioSong: true },
    MACE_AT(at([-4.4, 6.45]), 270, { pose: 'crossed', hands: null, look: 'player', mood: 'sad' }),
    // (the curb ahead of the van is kept free of parked cars: it rolls away north along it)
    ...[-16, -26, -36, -46, -56, -66, -76].map((r) => ({ do: 'clear', at: g(r, 0, 11.3), radius: 7 })),
    { do: 'spawn', id: 'van', kind: 'van', at: CURB, face: 0, color: [0.74, 0.72, 0.66], paints: PAINTS, paintFlag: 'van_color', enter: true, limit: 0, curbSide: true,
      type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 } },
    { do: 'prop', id: 'plate', kind: 'plate', text: 'PM 2908', textFlag: 'van_plate', in: 'van', at: { cabinAt: 'back', p: [0, 0, -0.03] }, rot: [0, Math.PI, 0] },
    { do: 'player', inCar: 'van' },
    {
      do: 'cutscene', keep: true,
      shots: [
        // from across the street: the lit door, Mace in it, the van at the curb
        { seconds: 6.4, fade: 'in', fadeSeconds: 2.0, cam: { from: g(-1.6, 1.7, 18.5), to: g(-2.0, 1.68, 18.0), look: g(-4.5, 1.6, 7.5), fov: 40 },
          do: [{ do: 'sound', name: 'door', kind: 'close' }] },
        // in the van
        { seconds: 4.2, cam: { from: { cabin: 'van', at: 'pass', p: [0, 0.02, 0.15] }, look: { cabin: 'van', at: 'eye', p: [0, -0.05, 0.1] }, fov: 44, near: NEAR } },
      ],
    },
    ...WREN_ASK(),
    {
      do: 'cutscene',
      shots: [
        // he drives away. Behind him, the garage door, Mace in it, the light getting smaller. The radio, faintly.
        { seconds: 10.5, cam: { from: { of: 'van', p: [0.3, 1.55, -4.2] }, look: g(-4.5, 1.7, 6.7), fov: 38 },
          do: [{ do: 'autoDrive', gas: 0.3, steer: 0 }] },
        // the street in the rain, the light of the door, the van's tail lights far away. Three seconds of silence.
        { seconds: 7.0, fade: 'out', fadeSeconds: 3.2, cam: { from: g(1.5, 1.5, 9.6), to: g(1.3, 1.48, 9.5), look: g(-60, 1.2, 11.0), fov: 42 },
          do: [{ do: 'music', silence: 3.2 }] },
      ],
    },
    { do: 'autoDrive', off: true },
    { do: 'light' },
    { do: 'wait', seconds: 1.4 },
    { do: 'end', over: 'c6.end.over', title: 'c6.title', lines: ['c6.end.1', 'c6.end.l2', 'c6.end.l3'], locked: 'c6.end.locked' },
  ];
}

export default {
  id: 'chapter06',
  number: 6,
  title: 'c6.title',
  vehicle: null,
  calm: true,                     // no minimap, no stars, no timer: only a small soft hint (engine.js, index.html body.calm)
  // (what a normal game has decided by now; used when a mission is started from the mission list)
  flags: {
    limiter_off: true, ticket_taken: true, mace_kind: true, keystone_found: true, told_mace_video: true, van_color: 0, van_plate: 'PM 2908',
    drone_method: 'quiet', tide_trust: true, lena_code_seen: true, chip_holder: 'lena', chip_to_lena: true,
    mace_gave_car: true, dante_response: 'race', took_shortcut: false, zero_found_race: true, jacket_taken: true,
    rask_stance: 'honest', container_taken: true, rask_mila_seen: true, opened_package: false, mace_payment_seen: true, confront_mace: false,
  },
  preload: { actors: ['Mace_Doyle'], vehicles: ['van'] },

  missions: [
    // =====================================================================
    // 1. RAIN ON THE ROOF - Nate comes down the stairs into the garage at night. Mace at the bench (or, a colder
    //    night, at the car with his back to the stairs). The kettle, the radio. Then the room is Nate's to walk about.
    // =====================================================================
    {
      id: 'c6m0', title: 'c6.m1',
      setup: [
        ...ROOM,
        { do: 'garage', kettle: true },
        MACE(at(SPOT.bench), 180, { pose: 'spanner', hands: g(0.12, 0.96, -0.62), look: g(0.12, 0.96, -0.62), if: { flag: 'confront_mace', is: false } }),
        MACE(at(SPOT.carBack), 0, { pose: 'work', hands: PT.clothRear, look: PT.clothRear, mood: 'sad', if: { flag: 'confront_mace' } }),
        { do: 'prop', id: 'spanner', kind: 'spanner', on: 'mace', bone: 'hand_R', p: [0, -0.07, 0.03], if: { flag: 'confront_mace', is: false } },
        NATE_AT(at(SPOT.stairs), 0, 'idle', { mood: 'tired' }),
      ],
      steps: [
        { do: 'card', over: 'c6.card.over', title: 'c6.title', sub: 'c6.card.sub', seconds: 4.5 },
        {
          do: 'cutscene',
          shots: [
            // the garage at night, as if seen through a rainy window: the car under its cloth in the lamp light
            { seconds: 7.5, fade: 'in', fadeSeconds: 2.6, cam: { from: g(-8.25, 2.55, -0.2), to: g(-8.15, 2.5, -0.6), look: g(-1.6, 1.0, -2.6), fov: 50 },
              do: [{ do: 'garage', pane: true }, { do: 'player', hidden: true }] },
            // the door to the stairs opens; Nate comes in, his hair wet
            { seconds: 4.6, cam: { from: g(-1.9, 1.55, -3.0), to: g(-1.75, 1.55, -3.3), look: g(0.25, 1.45, -5.4), fov: 40 },
              do: [{ do: 'garage', pane: false, stairs: 1, seconds: 1.6 }, { do: 'sound', name: 'door', kind: 'open' }],
              lines: [{ at: 0.9, do: [{ do: 'player', hidden: false }] }] },
            // a warm night: Mace looks up from the bench
            { if: { flag: 'confront_mace', is: false }, seconds: 4.2, cam: { from: g(-0.35, 1.62, -2.7), to: g(-0.38, 1.62, -2.45), look: { of: 'mace', p: [0, 1.6, 0] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'mace', look: 'player', mood: 'neutral' }],
              lines: [{ at: 0.9, who: 'mace', text: 'c6.mace.wet', seconds: 2.4, mood: 'smile' }] },
            { if: { flag: 'confront_mace', is: false }, seconds: 2.8, cam: { from: { of: 'player', p: [0.35, 1.62, 1.25] }, look: { of: 'player', p: [0, 1.6, 0] }, fov: 32 },
              do: [{ do: 'player', look: at(SPOT.bench) }],
              lines: [{ at: 0.7, who: 'nate', text: 'c6.nate.thanks', seconds: 1.6, mood: 'tired' }] },
            { if: { flag: 'confront_mace', is: false }, seconds: 6.6, cam: { from: g(0.25, 1.65, 0.2), to: g(0.1, 1.62, -0.05), look: g(-6.6, 0.9, -3.6), fov: 40 },
              do: [{ do: 'actorSet', id: 'mace', pose: 'idle', hands: null, look: g(-6.6, 1.0, -3.6), mood: 'tired' }, { do: 'remove', ids: ['spanner'] }],
              lines: [{ at: 0.6, who: 'mace', text: 'c6.mace.car', seconds: 2.6 }, { at: 3.7, who: 'mace', text: 'c6.mace.with_you', seconds: 2.6 }] },
            // a cold night: Mace at the car, his back to the stairs. He does not turn round.
            { if: { flag: 'confront_mace' }, seconds: 5.2, cam: { from: g(-4.4, 1.55, -2.6), to: g(-4.55, 1.55, -2.85), look: { of: 'mace', p: [0, 1.4, 0] }, fov: 36 },
              lines: [{ at: 1.4, who: 'mace', text: 'c6.mace.kettle_cold', seconds: 2.0, mood: 'sad' }] },
            { if: { flag: 'confront_mace' }, seconds: 4.4, cam: { from: { of: 'player', p: [0.3, 1.62, 1.2] }, to: { of: 'player', p: [0.26, 1.62, 1.05] }, look: { of: 'player', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'player', look: at(SPOT.carBack), mood: 'sad' }] },
            { if: { flag: 'confront_mace' }, seconds: 4.6, cam: { from: g(-4.6, 1.3, -5.9), look: { of: 'mace', p: [0, 1.0, 0.3] }, fov: 34 },
              lines: [{ at: 0.9, who: 'mace', text: 'c6.mace.car_cold', seconds: 2.4, mood: 'sad' }] },
          ],
        },
        { do: 'player', stage: null, look: null, at: at(SPOT.stairs), face: 0 },
        // (a warm night: Mace goes over to the car and waits there; a cold one: he stays where he is)
        { do: 'actorSet', id: 'mace', walk: at([-5.4, -1.75]), speed: 0.9, then: 0, look: PT.corner, if: { flag: 'confront_mace', is: false } },
        { do: 'explore', text: 'c6.hint.walk', spots: SPOTS, next: { at: at(SPOT.help), label: 'c6.act.help', radius: 1.8 } },
      ],
    },

    // =====================================================================
    // 2. THEO'S CAR - five stations, five stories. Between them the room is Nate's again (the radio, the kettle ...).
    // =====================================================================
    {
      id: 'c6m1', title: 'c6.m2',
      flags: {},
      setup: [
        ...onLoad(ROOM),
        MACE(at([-5.4, -1.75]), 0, { pose: 'crossed', look: PT.corner, onLoad: true }),
        { do: 'player', at: at(SPOT.help), face: 0, onLoad: true },
      ],
      steps: [
        // ---- 1. the cloth ----
        { do: 'garage', lamps: { stand: 1 } }, { do: 'sound', name: 'tick' },
        ...station(1, {
          nate: [-5.7, -1.25], face: [-6.4, -1.9], hands: PT.clothNose,
          mace: [-5.85, -5.45], maceFace: [-6.3, -5.75], maceHands: PT.clothRear,
          hint: 'c6.hint.cloth', dirt: 0.85,
          intro: [
            { who: 'mace', text: 'c6.mace.cloth', gap: 1.2, mood: 'tired', if: { flag: 'confront_mace', is: false } },
            { who: 'mace', text: 'c6.mace.slow', gap: 1.6, mood: 'sad', if: { flag: 'confront_mace' } },
          ],
          cam: { from: g(-8.05, 1.6, -0.25), to: g(-7.9, 1.5, -0.6), look: g(-6.5, 0.85, -3.6), fov: 46, seconds: 45 },
        }),
        { do: 'checkpoint', id: 1, setup: [{ do: 'garage', car: { dirt: 0.85 }, cloth: 1, lamps: { stand: 1 } }, { do: 'actorSet', id: 'mace', at: at([-5.25, -1.65]), face: 0, pose: 'crossed' }] },
        { do: 'explore', text: 'c6.hint.next', spots: SPOTS, next: NEXT },

        // ---- 2. the frame ----
        ...station(2, {
          nate: [-4.72, 0.48], face: [-5.12, 0.06], hands: PT.lever,
          mace: [-6.75, -0.85], maceFace: [-6.5, -1.8], maceHands: g(-6.45, 0.75, -1.85),
          hint: 'c6.hint.frame', dirt: 0.7,
          intro: [{ who: 'mace', text: 'c6.mace.chain', gap: 1.2, mood: 'tired', if: { flag: 'confront_mace', is: false } }],
          cam: { from: g(-5.15, 1.0, -3.35), to: g(-5.25, 0.96, -3.1), look: g(-5.75, 0.5, -1.4), fov: 44, seconds: 45 },
        }),
        { do: 'checkpoint', id: 2, setup: [{ do: 'garage', car: { dirt: 0.7, bend: 0 }, cloth: 1, lamps: { stand: 1 } }, { do: 'actorSet', id: 'mace', at: at([-5.25, -1.65]), face: 0, pose: 'crossed' }] },
        { do: 'explore', text: 'c6.hint.next', spots: SPOTS, next: NEXT },

        // ---- 3. the bumper ----
        ...station(3, {
          nate: [-6.45, -0.9], face: [-6.6, -1.8], hands: g(-6.7, 0.38, -1.7),
          mace: [-7.45, -0.95], maceFace: [-7.3, -1.8], maceHands: g(-7.25, 0.38, -1.72),
          hint: 'c6.hint.bumper', dirt: 0.55,
          before: [{ do: 'sound', name: 'clunk' }],
          intro: [{ who: 'mace', text: 'c6.mace.bumper', gap: 1.2, mood: 'tired', if: { flag: 'confront_mace', is: false } }],
          cam: { from: g(-5.25, 0.5, -2.3), to: g(-5.35, 0.48, -2.15), look: g(-7.2, 0.36, -1.7), fov: 44, seconds: 45 },
        }),
        { do: 'checkpoint', id: 3, setup: [{ do: 'garage', car: { dirt: 0.55, bend: 0, bumper: 'new' }, cloth: 1, lamps: { stand: 1 } }, { do: 'actorSet', id: 'mace', at: at([-5.25, -1.65]), face: 0, pose: 'crossed' }] },
        { do: 'explore', text: 'c6.hint.next', spots: SPOTS, next: NEXT },

        // ---- 4. the engine: the hood goes up, the air cleaner goes on ----
        ...station(4, {
          nate: [-5.72, -3.3], face: [-6.9, -2.82], hands: PT.engine,
          mace: [-5.65, -1.7], maceFace: [-6.3, -2.2], maceHands: g(-6.2, 0.9, -2.2),
          hint: 'c6.hint.engine', hint2: 'c6.hint.engine2', dirt: 0.42,
          before: [{ do: 'garage', car: { hood: 1 } }],
          intro: [{ who: 'mace', text: 'c6.mace.engine', gap: 1.2, mood: 'tired', if: { flag: 'confront_mace', is: false } }],
          cam: { from: g(-5.45, 1.85, -2.45), to: g(-5.6, 1.75, -2.5), look: g(-6.9, 0.7, -2.85), fov: 42, seconds: 45 },
        }),
        { do: 'checkpoint', id: 4, setup: [{ do: 'garage', car: { dirt: 0.42, bend: 0, bumper: 'new', cleaner: 'on', hood: 1 }, cloth: 1, lamps: { stand: 1 } }, { do: 'actorSet', id: 'mace', at: at([-5.25, -1.65]), face: 0, pose: 'crossed' }] },
        { do: 'explore', text: 'c6.hint.next', spots: SPOTS, next: NEXT },

        // ---- 5. the lights: two plugs meet, the headlights catch and light the roller door ----
        ...station(5, {
          nate: [-5.7, -2.4], face: [-6.38, -2.06], hands: PT.wires,
          mace: [-5.62, -3.35], maceFace: [-6.3, -2.9], maceHands: g(-6.25, 0.85, -2.9),
          hint: 'c6.hint.wires', dirt: 0.3,
          before: [{ do: 'garage', car: { hood: 1 } }],
          intro: [{ who: 'mace', text: 'c6.mace.wires', gap: 1.2, mood: 'tired', if: { flag: 'confront_mace', is: false } }],
          cam: { from: g(-5.25, 0.84, -1.0), to: g(-5.45, 0.8, -1.3), look: g(-6.4, 0.58, -1.98), fov: 40, seconds: 45 },
          cleanCam: { from: g(-4.3, 1.25, 2.6), to: g(-4.45, 1.22, 2.2), look: g(-6.9, 0.6, -2.2), fov: 44 },
          then: [
            // (the lights burn a little longer, then Mace switches them off and closes the hood)
            { do: 'wait', seconds: 0.8 },
            { do: 'garage', car: { lights: 0 } }, { do: 'sound', name: 'tick' },
            { do: 'garage', car: { hood: 0 }, seconds: 1.4 }, { do: 'wait', seconds: 1.2 }, { do: 'sound', name: 'thump' },
          ],
        }),
        { do: 'checkpoint', id: 5, setup: [AFTER_FIVE, { do: 'actorSet', id: 'mace', at: at([-5.25, -1.65]), face: 0, pose: 'crossed' }] },
        { do: 'explore', text: 'c6.hint.next', spots: SPOTS, next: NEXT },
      ],
    },

    // =====================================================================
    // 3. THE LAST PART - the deck, where Theo's tape goes. Mace's last story. The deck stops short: Nate puts the
    //    bank record on the bench. No music; slow, steady rain; the radio only hisses. Nobody raises his voice.
    // =====================================================================
    {
      id: 'c6m2', title: 'c6.m3',
      flags: { heard: 5, heard_1: true, heard_2: true, heard_3: true, heard_4: true, heard_5: true },
      setup: [
        ...onLoad(ROOM),
        { ...AFTER_FIVE, onLoad: true },
        MACE(at([-5.25, -1.65]), 0, { pose: 'crossed', look: PT.corner, onLoad: true }),
        { do: 'player', at: at(SPOT.help), face: 0, onLoad: true },
      ],
      steps: [
        ...DIP,
        NATE_AT(at([-5.55, -3.85]), 0, 'work', { hands: PT.deck, look: PT.deck }),
        MACE_AT(at([-5.35, -2.65]), toward([-5.35, -2.65], [-6.4, -3.6]), { pose: 'crossed', hands: null, look: { of: 'player', p: [0, 1.0, 0] }, mood: 'tired' }),
        UNDIP,
        {
          do: 'repair', station: 6, stop: 0.8, again: false, hint: 'c6.hint.deck', dirt: 0.3,
          story: [{ who: 'mace', text: 'c6.mace.deck', gap: 1.4, mood: 'tired', if: { flag: 'confront_mace', is: false } }, ...STORY[6]],
          cam: { from: g(-6.2, 1.06, -4.7), to: g(-6.3, 1.02, -4.5), look: g(-6.9, 0.62, -3.66), fov: 46, near: NEAR, seconds: 45 },
          ...BEAT(null),
          after: [{ do: 'remove', ids: ['rag'] }, { do: 'actorSet', id: 'mace', pose: 'idle', hands: null, look: PT.deck }],
          cleanCam: { from: { of: 'player', p: [0.35, 1.6, 1.15] }, to: { of: 'player', p: [0.3, 1.6, 1.0] }, look: { of: 'player', p: [0, 1.58, 0] }, fov: 30 },
        },
        {
          do: 'cutscene', keep: true,
          shots: [
            // Nate straightens up. The radio between two stations: only its hiss now. The rain.
            { seconds: 4.2, cam: { from: { of: 'player', p: [0.35, 1.6, 1.15] }, to: { of: 'player', p: [0.3, 1.6, 1.0] }, look: { of: 'player', p: [0, 1.58, 0] }, fov: 30 },
              do: [{ do: 'player', stage: { at: at([-5.55, -3.85]), face: 0, pose: 'idle' }, hands: null, look: PT.deck, mood: 'sad' }, { do: 'music', radioSong: false, calm: 0 }, { do: 'sound', name: 'tick' }] },
            // the bank record, on the bench, beside Theo's initials
            { seconds: 5.4, cam: { from: g(-0.55, 1.42, -1.95), to: g(-0.5, 1.38, -1.85), look: g(0.0, 0.93, -1.38), fov: 34 },
              do: [
                NATE_AT(at(SPOT.benchNate), 180, 'putDown', { hands: PT.paper, look: PT.paper, mood: 'sad' }),
                MACE_AT(at(SPOT.benchMace), 180, { pose: 'lean', hands: PT.benchEdgeMace, look: PT.paper, mood: 'tired' }),
              ],
              lines: [{ at: 1.1, do: [{ do: 'prop', id: 'paper', kind: 'bankPaper', at: PT.paper, face: 180 }, { do: 'sound', name: 'paper' }] },
                { at: 3.2, do: [{ do: 'player', pose: 'idle', hands: null }] }] },
            // Mace's face, close. Nate's voice.
            { seconds: 5.6, cam: { from: g(0.42, 1.3, -0.25), to: g(0.4, 1.31, -0.4), look: { of: 'mace', p: [0, 1.46, 0.08] }, fov: 30 },
              lines: [{ at: 1.2, who: 'nate', text: 'c6.nate.paper', seconds: 3.0, mood: 'stern' }] },
            // his hands on the edge of the bench. Nothing.
            { seconds: 4.4, cam: { from: g(0.15, 1.32, -0.05), to: g(0.12, 1.3, -0.15), look: PT.benchEdgeMace, fov: 32 } },
            { seconds: 4.2, cam: { from: g(0.42, 1.3, -0.25), to: g(0.41, 1.31, -0.36), look: { of: 'mace', p: [0, 1.46, 0.08] }, fov: 28 },
              lines: [{ at: 0.9, who: 'mace', text: 'c6.mace.yes', seconds: 1.8, mood: 'sad' }] },
            // through the rainy window: the two of them at the bench, small in the big dark room. One soft pad begins.
            { seconds: 5.2, cam: { from: g(-7.8, 2.4, 2.0), to: g(-7.7, 2.38, 1.6), look: g(-0.45, 1.05, -1.3), fov: 34 },
              do: [{ do: 'garage', pane: true }, { do: 'music', calm: 0.32 }] },
            { seconds: 14.2, cam: { from: g(0.42, 1.3, -0.25), to: g(0.38, 1.32, -0.5), look: { of: 'mace', p: [0, 1.46, 0.08] }, fov: 30 },
              do: [{ do: 'garage', pane: false }],
              lines: [
                { at: 0.6, who: 'mace', text: 'c6.mace.kvi1', seconds: 3.0, mood: 'sad' },
                { at: 4.2, who: 'mace', text: 'c6.mace.kvi2', seconds: 2.8 },
                { at: 7.8, who: 'mace', text: 'c6.mace.kvi3', seconds: 3.0 },
                { at: 11.4, who: 'mace', text: 'c6.mace.kvi4', seconds: 2.4 },
              ] },
            // Nate's face. Nothing.
            { seconds: 4.6, cam: { from: g(-0.12, 1.55, -0.95), to: g(-0.15, 1.56, -1.1), look: { of: 'player', p: [0, 1.58, 0] }, fov: 30 },
              do: [{ do: 'player', look: at(SPOT.benchMace), mood: 'sad' }] },
            { seconds: 8.2, cam: { from: g(0.15, 1.32, -0.05), to: g(0.1, 1.3, -0.2), look: PT.benchEdgeMace, fov: 32 },
              lines: [{ at: 0.6, who: 'mace', text: 'c6.mace.took', seconds: 2.8, mood: 'sad' }, { at: 4.6, who: 'mace', text: 'c6.mace.bill', seconds: 2.8 }] },
            { seconds: 5.0, cam: { from: g(-0.12, 1.55, -0.95), to: g(-0.14, 1.56, -1.05), look: { of: 'player', p: [0, 1.58, 0] }, fov: 28 },
              lines: [{ at: 1.6, who: 'nate', text: 'c6.nate.bill', seconds: 2.0, mood: 'sad' }] },
            { seconds: 6.0, cam: { from: g(0.42, 1.3, -0.25), to: g(0.41, 1.31, -0.38), look: { of: 'mace', p: [0, 1.5, 0.05] }, fov: 28 },
              do: [{ do: 'actorSet', id: 'mace', look: 'player' }],
              lines: [{ at: 1.0, who: 'mace', text: 'c6.mace.saw', seconds: 2.2, mood: 'sad' }] },
            // the kettle on the cart, gone cold; the rain
            { seconds: 4.4, cam: { from: g(-1.25, 1.35, 1.1), to: g(-1.15, 1.32, 1.2), look: g(0.05, 0.9, 1.7), fov: 34 } },
            { seconds: 9.6, cam: { from: g(0.42, 1.3, -0.25), to: g(0.37, 1.33, -0.55), look: { of: 'mace', p: [0, 1.46, 0.08] }, fov: 26 },
              do: [{ do: 'music', calm: 0.5 }],
              lines: [{ at: 0.7, who: 'mace', text: 'c6.mace.again', seconds: 2.2, mood: 'sad' }, { at: 6.0, who: 'mace', text: 'c6.mace.hate', seconds: 3.0 }] },
            // Nate says nothing for a long time. He looks at the cloth on the floor.
            { seconds: 7.4, cam: { from: g(-5.2, 1.1, 0.4), to: g(-5.45, 1.0, 0.0), look: PT.clothFloor, fov: 36 },
              do: [{ do: 'player', look: PT.clothFloor }] },
          ],
        },
        {
          do: 'choice',
          options: [
            { text: 'c6.ch.forgive', set: { mace_forgiven: true, c6_end: 'forgive' } },
            { text: 'c6.ch.leave', set: { mace_forgiven: false, c6_end: 'leave' } },
            // (only for a player who stayed for at least three of Mace's stories)
            { text: 'c6.ch.silent', set: { mace_forgiven: 'neutral', c6_end: 'neutral' }, if: { flag: 'heard', atLeast: 3 } },
          ],
        },
        // (the film bars stay: the next mission goes straight on with what was chosen)
      ],
    },

    // =====================================================================
    // 4. WHAT IS LEFT - the end of the night, as Nate chose it.
    //    forgive: the key, the last part together, the mixtape in the dashboard; the car whole again
    //    neutral: the last part alone, the key from the bench; Mace turns the radio off
    //    leave:   out into the rain; the car unfinished under a work lamp; Mace at the door, the light getting smaller
    // =====================================================================
    {
      id: 'c6m3', title: 'c6.m4',
      flags: { heard: 6, heard_1: true, heard_2: true, heard_3: true, heard_4: true, heard_5: true, heard_6: true, mace_forgiven: true, c6_end: 'forgive' },
      setup: [
        ...onLoad(ROOM),
        { ...AFTER_FIVE, car: { ...AFTER_FIVE.car, deck: 0.8 }, onLoad: true },
        { do: 'music', radioSong: false, onLoad: true },
        { do: 'prop', id: 'paper', kind: 'bankPaper', at: PT.paper, face: 180, onLoad: true },
        MACE(at(SPOT.benchMace), 180, { pose: 'lean', hands: PT.benchEdgeMace, look: PT.paper, mood: 'sad', onLoad: true }),
        { ...NATE_AT(at(SPOT.benchNate), 180, 'idle', { mood: 'sad' }), onLoad: true },
      ],
      steps: [
        { do: 'music', calm: 0 },
        { do: 'if', cond: { flag: 'c6_end', is: 'forgive' }, then: FORGIVE(), else: [{ do: 'if', cond: { flag: 'c6_end', is: 'neutral' }, then: NEUTRAL(), else: LEAVE() }] },
      ],
    },
  ],
};
