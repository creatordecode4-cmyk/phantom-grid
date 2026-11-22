// ---------------------------------------------------------------------------
// CHAPTER 4 - "CHROME WOLVES" (two nights later)
//
// This file is ONLY DATA, written like chapter03.js. The story engine (src/story/engine.js) explains every word
// used here at its top; the races themselves (routes, rivals, crowds, the last turn) are in src/race/races.js and
// are run by src/race/raceManager.js. Zero's part is src/ai/zero.js. All texts are keys of src/story/strings.js.
//
// The night in one line: a race ticket under a lamp, a borrowed car, three qualifiers on Neon Mile, a man in
// Theo's jacket, a race on the road where Theo died, a black car that lets Nate go, and a jacket on a roof.
//
// It uses what earlier chapters left behind: chip_holder (Lena is in the garage when she holds the chip),
// limiter_off. It leaves for later chapters:
//   mace_gave_car, dante_response ('silence' | 'sorry' | 'race'), took_shortcut, zero_found_race (from now on
//   Zero can follow Nate in free roam), jacket_taken (Nate has Theo's jacket: on the seat and on the screen).
//
// Places: [x, z] on the ground, [x, y, z], { garage: [right, up, toward the street] }, { roof: [x, z] } (on the roof
// of the building there), { of: 'car or person', p: [left, up, forward] }, { cabin: 'car', at, p }.
// Directions are compass degrees (0 north, 90 east, 180 south, 270 west). Speeds are km/h.
// Map: +z is north, -z south (the sea), -x east, +x west. Neon Mile: north half z -390..-379 (cars go west),
// south half z -405..-394 (cars go east).
// ---------------------------------------------------------------------------

const NEAR = 0.05;
const NM_N = -384.5, NM_S = -399.5;
const NIGHT = { do: 'time', hour: 23.2, rain: false };
const RAIN = { do: 'time', hour: 23.7, rain: true };
const LATE = { do: 'time', hour: 0.5, rain: true };
// the Ironhill run: the same hour and the same rain as the night Theo died (the prologue)
const RUN_NIGHT = { do: 'time', hour: 2.6, rain: true };
const ROOF_NIGHT = { do: 'time', hour: 3.1, rain: true };
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));

// ---- Mace's garage (the repair bay: right -8.7 .. 0.7, toward the street -6.7 .. 6.7; the work bench along the right
// wall, Theo's car under its cloth at the back on the left) ----
const G = {
  nate: { garage: [-3.6, 0, 3.4] },                 // under the lamp, by the door
  mace: { garage: [-0.9, 0, 1.9] },                 // by the right wall, between the bench and the door
  stool: { garage: [-0.8, 0, -2.4] },
  lena: { garage: [-0.8, 0.66, -2.4] },             // on the stool, at the bench
  laptop: { garage: [0.18, 0.94, -2.4] },
  tarp: { garage: [-6.9, 1.0, -3.6] },              // Theo's car under the cloth
};
const GARAGE_LAMP = { do: 'light', at: { garage: [-3.6, 2.7, 3.8] }, color: 0xffc890, power: 24, range: 9 };
const STREET_SPOT = [-11.9, 72.5];                  // the curb in front of the garage

// ---- MACE'S CAR: old, quick, a Phantom body in worn bronze (not black, normal lights: nothing like Zero) ----
const MACE_CAR = (at, face, more = {}) => ({
  do: 'spawn', id: 'maceCar', kind: 'tech_patrol_car', or: 'sedan', at, face, color: [0.42, 0.27, 0.12], enter: true, lights: 'normal', curbSide: true,
  type: { label: "MACE'S STREET CAR", topSpeed: 204, accel: 9.4, grip: 1.1, nitro: true, role: 'car' }, ...more,
});

// ---- people ----
const MACE = (at, face, more = {}) => ({ do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at, face, pose: 'crossed', fixed: true, mood: 'stern', ...more });
const LENA = (at, face, more = {}) => ({ do: 'actor', id: 'lena', model: 'Lena_Marchetti', name: 'name.lena', at, face, pose: 'sitEdge', floorBelow: 0.66, fixed: true, mood: 'stern', ...more });
// DANTE RIOS (30), the leader of the Chrome Wolves. Tonight he wears Theo's old blue jacket. It is a little small on him.
const THEO_JACKET = { color: [0.11, 0.42, 0.78], cuff: 0.83, hem: 0.07 };
const DANTE = (at, face, more = {}) => ({ do: 'actor', id: 'dante', model: 'Dante_Rios', name: 'name.dante', at, face, pose: 'idle', fixed: true, mood: 'stern', jacket: THEO_JACKET, ...more });
// THE CHROME WOLVES: his crew. Dark clothes, grey and silver, one red scarf.
const WOLF_CLOTH = [
  { pants: [0.06, 0.06, 0.07], coat: [0.33, 0.34, 0.36], patch: [0.18, 0.19, 0.21], scarf: [0.1, 0.1, 0.11], head: [0.08, 0.08, 0.09] },
  { pants: [0.1, 0.1, 0.11], coat: [0.12, 0.12, 0.13], patch: [0.45, 0.46, 0.48], scarf: [0.55, 0.08, 0.06], head: [0.2, 0.15, 0.11] },
  { pants: [0.05, 0.05, 0.06], coat: [0.22, 0.23, 0.26], patch: [0.08, 0.09, 0.1], scarf: [0.4, 0.41, 0.43], head: [0.06, 0.06, 0.07] },
];
const WOLF = (id, name, at, face, cloth, more = {}) => ({ do: 'actor', id, extra: WOLF_CLOTH[cloth], name, at, face, pose: 'crossed', fixed: true, look: 'player', mood: 'stern', ...more });
const MARSHAL = (at, face) => ({ do: 'actor', id: 'marshal', extra: { pants: [0.08, 0.08, 0.09], coat: [0.62, 0.3, 0.08], patch: [0.7, 0.68, 0.62], scarf: [0.1, 0.1, 0.1], head: [0.1, 0.1, 0.1] }, name: 'name.marshal', at, face, pose: 'flag', fixed: true, look: 'player', mood: 'neutral' });

// ---- the night market of Neon Mile: stalls, soft holographic signs, the finish arches ----
const NEON_MILE = [
  { do: 'prop', id: 'stall1', kind: 'vendorStall', at: [140, -410.2], face: 0, cloth: 0x6a2a22 },
  { do: 'prop', id: 'stall2', kind: 'vendorStall', at: [252, -410.2], face: 0, cloth: 0x1f4a4f },
  { do: 'prop', id: 'stall3', kind: 'vendorStall', at: [-318, -373.8], face: 180, cloth: 0x5a4a1e },
  { do: 'prop', id: 'holo1', kind: 'holoSign', at: [175, -411.5], face: 0, text: 'c4.sign.noodles', sub: 'c4.sign.kitchen', color: 0xffc98a, w: 2.6, h: 1.0, y: 3.6 },
  { do: 'prop', id: 'holo2', kind: 'holoSign', at: [228, -411.5], face: 0, text: 'c4.sign.charge', sub: 'c4.sign.service', color: 0xa8e8ff, w: 2.6, h: 1.0, y: 3.8 },
  { do: 'prop', id: 'holo3', kind: 'holoSign', at: [-340, -372.5], face: 180, text: 'c4.sign.mile', sub: 'c4.sign.no_racing', color: 0xd8f0ff, w: 3.0, h: 1.1, y: 4.2 },
  { do: 'prop', id: 'holo4', kind: 'holoSign', at: [-292, -372.5], face: 180, text: 'c4.sign.tea', sub: '', color: 0xffb880, w: 2.4, h: 0.9, y: 3.5 },
];
const ARCH = (id, at, face, w, sub) => ({ do: 'prop', id, kind: 'raceArch', at, face, w, title: 'c4.sign.mile', sub });
// the market streets of qualifier 3
const MARKET = [
  { do: 'prop', id: 'mstall1', kind: 'vendorStall', at: [-150, -72.2], face: 180, cloth: 0x6a2a22 },
  { do: 'prop', id: 'mstall2', kind: 'vendorStall', at: [-68, -72.2], face: 180, cloth: 0x2a3f5a },
  { do: 'prop', id: 'mstall3', kind: 'vendorStall', at: [14, -72.2], face: 180, cloth: 0x5a4a1e },
  { do: 'prop', id: 'mstall4', kind: 'vendorStall', at: [-108, -95.8], face: 0, cloth: 0x1f4a4f },
  { do: 'prop', id: 'mstall5', kind: 'vendorStall', at: [-28, -95.8], face: 0, cloth: 0x6a2a22 },
  { do: 'prop', id: 'mholo1', kind: 'holoSign', at: [-128, -71], face: 180, text: 'c4.sign.market', sub: 'c4.sign.open', color: 0xffd9a0, w: 3.0, h: 1.1, y: 4.0 },
  { do: 'prop', id: 'mholo2', kind: 'holoSign', at: [32, -97], face: 0, text: 'c4.sign.repairs', sub: '', color: 0xa8f0e0, w: 3.0, h: 0.9, y: 3.6 },
];
// THE ROOF of the last scene: the low building with the round roof on Neon Mile, east of the turn
const ROOF = { dante: { roof: [-81.0, -369.6] }, nate: { roof: [-83.2, -368.0] }, wreck: [-62, -386.5] };
// the start of the Ironhill run (the street at the lights, north of the turn) and THE GUARDRAIL of the last turn:
// the same rail as in the prologue (prologue.js has the same line)
const IRONHILL = [
  { do: 'prop', id: 'archF', kind: 'raceArch', at: [-7, -330], face: 0, w: 15.4, title: 'c4.sign.ironhill', sub: 'c4.sign.two_laps' },
  { do: 'prop', id: 'lineF', kind: 'startLine', at: [-7, -330], width: 13 },
  { do: 'prop', id: 'rail', kind: 'guardrail', at: [0.6, -336], points: [[0, 0], [0, -41.2], [1.2, -42.4], [29.4, -42.4]] },
  { do: 'prop', id: 'fholo1', kind: 'holoSign', at: [3.4, -326], face: 270, text: 'c4.sign.ironhill_short', sub: 'c4.sign.old_road', color: 0xd8f0ff, w: 2.6, h: 1.0, y: 4.4 },
  { do: 'prop', id: 'fholo2', kind: 'holoSign', at: [-17.6, -360], face: 90, text: 'c4.sign.no_entry', sub: 'c4.sign.diagonal', color: 0xffc070, w: 2.8, h: 0.9, y: 3.8 },
];

export default {
  id: 'chapter04',
  number: 4,
  title: 'c4.title',
  vehicle: 'maceCar',
  getIn: 'c4.get_in',
  // (what a normal game has decided by now; used when a mission is started from the mission list)
  flags: {
    limiter_off: true, ticket_taken: true, mace_kind: true, keystone_found: true, told_mace_video: true, van_color: 0, van_plate: 'PM 2908',
    drone_method: 'quiet', drone_distract: false, tide_trust: true, lena_code_seen: true, told_lena_theo: true, wren_locked_found: true,
    harrow_let_girl_go: true, tracker_cut: true, chip_holder: 'lena', chip_to_lena: true,
  },
  preload: { actors: ['Mace_Doyle', 'Lena_Marchetti', 'Dante_Rios'], vehicles: ['chrome_supercar', 'tech_patrol_car'] },

  missions: [
    // =====================================================================
    // 1. THE TICKET - the garage at night. Quiet. A ticket under a lamp, and a car that is not Theo's.
    // =====================================================================
    {
      id: 'c4m0', title: 'c4.m0',
      setup: [
        NIGHT,
        { do: 'world', traffic: 10, people: 6, indoors: true, now: true },
        { do: 'shutter', open: 0.35, seconds: 0 },
        GARAGE_LAMP,
        MACE(G.mace, 331, { look: null }),
        { do: 'prop', id: 'stool', kind: 'stool', at: G.stool, if: { flag: 'chip_holder', is: 'lena' } },
        { do: 'prop', id: 'laptop', kind: 'laptop', at: G.laptop, face: 0, if: { flag: 'chip_holder', is: 'lena' } },
        LENA(G.lena, 180, { look: null, if: { flag: 'chip_holder', is: 'lena' } }),
        MACE_CAR(STREET_SPOT, 0),
        { do: 'player', at: G.nate, face: 90 },
        { do: 'allow', enter: 'none' },
      ],
      steps: [
        { do: 'card', over: 'c4.card.over', title: 'c4.title', sub: 'c4.card.sub', seconds: 4.5 },
        {
          do: 'cutscene',
          shots: [
            // the garage at night, rain on the roof. Nate under the lamp by the door, the race ticket in his hand.
            { seconds: 6.5, fade: 'in', fadeSeconds: 2.2, cam: { from: { garage: [-0.9, 2.3, -3.4] }, to: { garage: [-1.1, 2.2, -2.8] }, look: { of: 'player', p: [0, 1.25, 0] }, fov: 36 },
              do: [{ do: 'player', stage: { at: G.nate, face: 90, pose: 'phone' }, mood: 'tired' },
                { do: 'prop', id: 'ticket', kind: 'ticket', at: { of: 'player', p: [-0.05, 1.24, 0.31] }, face: 270, scale: 1.6 },
                { do: 'music', calm: 0.5 }] },
            // close: IRONHILL NIGHT RUN - DRIVER T. CALLOWAY - HOST D. RIOS
            { seconds: 3.6, cam: { from: { of: 'player', p: [-0.22, 1.72, -0.2] }, look: { of: 'player', p: [-0.05, 1.24, 0.31] }, fov: 24, near: NEAR } },
            // Mace sees it. He says nothing.
            { seconds: 4.2, cam: { from: { of: 'player', p: [0.95, 1.8, -0.8] }, to: { of: 'player', p: [0.9, 1.8, -0.7] }, look: { of: 'mace', p: [0, 1.55, 0] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'mace', look: 'player', mood: 'sad' }],
              lines: [{ at: 2.6, do: [{ do: 'actorSet', id: 'mace', look: null, mood: 'stern' }] }] },
            // Lena is already here, at the bench, her laptop open. She does not look up.
            { if: { flag: 'chip_holder', is: 'lena' }, seconds: 5.6, cam: { from: { garage: [0.02, 1.06, -3.05] }, look: { of: 'lena', p: [0, 0.68, 0.02] }, fov: 36 },
              lines: [{ at: 1.0, who: 'lena', text: 'c4.lena.race', seconds: 3.4, mood: 'stern' }] },
            { if: { flag: 'chip_holder', is: 'nate' }, seconds: 4.6, cam: { from: { garage: [-1.6, 1.6, 1.4] }, look: { of: 'player', p: [0, 1.5, 0] }, fov: 30 },
              lines: [{ at: 0.5, who: 'wren', text: 'c4.wren.race', seconds: 3.6 }] },
            { seconds: 3.4, cam: { from: { garage: [-1.7, 1.6, 1.4] }, look: { of: 'player', p: [0, 1.55, 0] }, fov: 30 },
              do: [{ do: 'player', stage: { at: G.nate, face: 110, pose: 'idle' }, mood: 'stern' }, { do: 'remove', ids: ['ticket'] }],
              lines: [{ at: 0.4, who: 'nate', text: 'c4.nate.car', seconds: 2.2, mood: 'stern' }] },
            // Mace nods at the cloth over Theo's car
            { seconds: 4.6, cam: { from: { garage: [-4.6, 1.5, 1.7] }, to: { garage: [-4.8, 1.45, 1.3] }, look: { garage: [-6.6, 0.7, -3.0] }, fov: 40 },
              do: [{ do: 'actorSet', id: 'mace', look: G.tarp }],
              lines: [{ at: 1.6, who: 'mace', text: 'c4.mace.not_that', seconds: 1.8, mood: 'sad' }] },
            { seconds: 5.2, cam: { from: { of: 'player', p: [0.85, 1.8, -0.85] }, look: { of: 'mace', p: [0, 1.58, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'mace', look: 'player', pose: 'hips', face: 331 }, { do: 'player', stage: { at: G.nate, face: 151, pose: 'idle' } }],
              lines: [{ at: 0.4, who: 'mace', text: 'c4.mace.old', seconds: 3.6, mood: 'stern' }] },
            { if: { flag: 'chip_holder', is: 'lena' }, seconds: 3.8, cam: { from: { garage: [0.02, 1.06, -3.05] }, look: { of: 'lena', p: [0, 0.68, 0.02] }, fov: 36 },
              lines: [{ at: 0.3, who: 'lena', text: 'c4.lena.go', seconds: 3.0, mood: 'neutral' }] },
          ],
        },
        { do: 'flag', set: { mace_gave_car: true } },
        { do: 'music', calm: 0 },
        { do: 'player', stage: null, at: G.nate, face: 270 },
        { do: 'world', indoors: false },
        { do: 'shutter', open: 1, seconds: 2.2 },
        { do: 'allow', enter: ['maceCar'] },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: G.nate, face: 270 }, { do: 'shutter', open: 1, seconds: 0 }, { do: 'allow', enter: ['maceCar'] }] },
        { do: 'enter', text: 'c4.obj.car', vehicle: 'maceCar', tip: 'c4.tip.nitro', tipSeconds: 6 },
        { do: 'music', tape: 4, hud: true },
        { do: 'driveTo', text: 'c4.obj.mile', vehicle: 'maceCar', at: [-388, -383.5], radius: 14 },
      ],
    },

    // =====================================================================
    // 2. NEON MILE QUALIFIER 1 - a sprint. Learn the race screen and the drift boost.
    // =====================================================================
    {
      id: 'c4m1', title: 'c4.m1',
      flags: { mace_gave_car: true },
      setup: [
        NIGHT,
        { do: 'world', traffic: 8, people: 20 },
        ...onLoad([MACE_CAR([-420, NM_N], 270), { do: 'player', inCar: 'maceCar' }, { do: 'allow', enter: ['maceCar'] }, { do: 'music', tape: 4, hud: true }]),
        ...NEON_MILE,
        ARCH('archQ1', [-360, NM_N], 90, 12.2, 'c4.sign.q_start'),
        ARCH('archQ1f', [200, NM_S], 90, 12.2, 'c4.sign.finish'),
        { do: 'prop', id: 'lineQ1', kind: 'startLine', at: [-360, NM_N], face: 90, width: 11 },
        MARSHAL([-358, -392.2], 0),
      ],
      steps: [
        { do: 'driveTo', text: 'c4.obj.grid', at: [-388, -383.5], radius: 14 },
        {
          do: 'cutscene',
          shots: [
            // the crowd on the sidewalk, phones up, a red flare. The marshal on the palm strip.
            { seconds: 4.6, cam: { from: [-348, 2.2, -393.5], to: [-350, 2.4, -393.0], look: [-362, 1.5, -378], fov: 46 },
              do: [{ do: 'music', stop: true }, { do: 'music', tension: 0.35 }],
              lines: [{ at: 0.8, who: 'marshal', text: 'c4.marshal.q1', seconds: 3.2 }] },
            { seconds: 3.6, cam: { from: { of: 'marshal', p: [0.4, 1.5, 3.2] }, look: { of: 'marshal', p: [0, 1.6, 0] }, fov: 34 },
              lines: [{ at: 0.3, who: 'marshal', text: 'c4.marshal.rules', seconds: 2.8 }] },
          ],
        },
        { do: 'remove', ids: ['marshal'] },
        {
          do: 'race', race: 'q1',
          react: {
            go: [{ do: 'tip', text: 'c4.tip.hud', seconds: 6 }, { do: 'meanwhile', steps: [{ do: 'wait', seconds: 10 }, { do: 'tip', text: 'c4.tip.drift', seconds: 7 }] }],
          },
        },
        { do: 'music', tension: 0 },
        { do: 'say', who: 'lena', text: 'c4.q1.done', if: { flag: 'chip_holder', is: 'lena' } },
        { do: 'say', who: 'wren', text: 'c4.q1.done', if: { flag: 'chip_holder', is: 'nate' } },
        { do: 'driveTo', text: 'c4.obj.grid', at: [178, -400.5], radius: 14 },
      ],
    },

    // =====================================================================
    // 3. NEON MILE QUALIFIER 2 - three laps in the rain: the hairpin by the sea, the ramp on the hill
    // =====================================================================
    {
      id: 'c4m2', title: 'c4.m2',
      flags: { mace_gave_car: true },
      setup: [
        RAIN,
        { do: 'world', traffic: 8, people: 20 },
        ...onLoad([MACE_CAR([205, NM_S], 90), { do: 'player', inCar: 'maceCar' }, { do: 'allow', enter: ['maceCar'] }]),
        ...NEON_MILE,
        ARCH('archQ2', [150, NM_S], 90, 12.2, 'c4.sign.q_laps'),
        { do: 'prop', id: 'lineQ2', kind: 'startLine', at: [150, NM_S], face: 90, width: 11 },
        // the bridge: a steel ramp over the road works on the street up the hill
        { do: 'prop', id: 'ramp', kind: 'jumpRamp', at: [-101, -282], face: 0, w: 6.6, len: 6, h: 0.75, gap: 7 },
        MARSHAL([152, -392.2], 180),
      ],
      steps: [
        { do: 'driveTo', text: 'c4.obj.grid', at: [178, -400.5], radius: 14, if: { not: { near: [178, -400.5], radius: 30 } } },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.6, cam: { from: [165, 2.0, -392.5], to: [163, 2.2, -392.8], look: [148, 1.2, -404], fov: 46 },
              lines: [{ at: 0.6, who: 'marshal', text: 'c4.marshal.q2', seconds: 3.4 }] },
            { seconds: 4.2, cam: { from: { of: 'maceCar', p: [-2.6, 1.3, 4.5] }, look: { of: 'maceCar', p: [0, 0.9, 0] }, fov: 38 },
              do: [{ do: 'music', tension: 0.4 }],
              lines: [{ at: 0.4, who: 'wren', text: 'c4.wren.rain', seconds: 3.4 }] },
          ],
        },
        { do: 'remove', ids: ['marshal'] },
        {
          do: 'race', race: 'q2',
          react: { go: [{ do: 'meanwhile', steps: [{ do: 'wait', seconds: 14 }, { do: 'tip', text: 'c4.tip.jump', seconds: 6 }] }] },
        },
        { do: 'music', tension: 0 },
        { do: 'say', who: 'lena', text: 'c4.q2.done', if: { flag: 'chip_holder', is: 'lena' } },
        { do: 'say', who: 'wren', text: 'c4.q2.done', if: { flag: 'chip_holder', is: 'nate' } },
        { do: 'driveTo', text: 'c4.obj.grid', at: [-196, -173], radius: 14 },
      ],
    },

    // =====================================================================
    // 4. NEON MILE QUALIFIER 3 - the night market: people on the road, a Chrome Wolf who pushes. Only a win counts.
    // =====================================================================
    {
      id: 'c4m3', title: 'c4.m3',
      flags: { mace_gave_car: true },
      setup: [
        LATE,
        { do: 'world', traffic: 6, people: 60 },
        ...onLoad([MACE_CAR([-195, -215], 0), { do: 'player', inCar: 'maceCar' }, { do: 'allow', enter: ['maceCar'] }]),
        ...MARKET,
        { do: 'prop', id: 'archQ3', kind: 'raceArch', at: [-195, -150], face: 0, w: 15.4, title: 'c4.sign.market', sub: 'c4.sign.q_winner' },
        { do: 'prop', id: 'lineQ3', kind: 'startLine', at: [-195, -150], width: 13 },
        MARSHAL([-186.4, -151], 90),
      ],
      steps: [
        { do: 'driveTo', text: 'c4.obj.grid', at: [-196, -173], radius: 14, if: { not: { near: [-196, -173], radius: 30 } } },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.4, cam: { from: [-184.5, 2.4, -160], to: [-185, 2.5, -158], look: [-196, 1.0, -150], fov: 44 },
              lines: [{ at: 0.5, who: 'marshal', text: 'c4.marshal.q3', seconds: 3.6 }] },
            { seconds: 4.0, cam: { from: { of: 'maceCar', p: [-2.2, 1.2, 3.8] }, look: { of: 'maceCar', p: [0, 1.0, 0] }, fov: 36 },
              do: [{ do: 'music', tension: 0.5 }],
              lines: [{ at: 0.3, who: 'lena', text: 'c4.rigg.warn', seconds: 3.2, if: { flag: 'chip_holder', is: 'lena' } }, { at: 0.3, who: 'wren', text: 'c4.rigg.warn', seconds: 3.2, if: { flag: 'chip_holder', is: 'nate' } }] },
          ],
        },
        { do: 'remove', ids: ['marshal'] },
        {
          do: 'race', race: 'q3', tip: 'c4.tip.win',
          // the crew car leans into him: RIGG says something (not every time)
          react: { push: [{ do: 'say', who: 'rigg', texts: ['c4.rigg.push.1', 'c4.rigg.push.2', 'c4.rigg.push.3'], seconds: 1.8 }] }, reactEvery: 9,
        },
        { do: 'music', tension: 0 },
      ],
    },

    // =====================================================================
    // 5. FACE TO FACE - quiet. Dante arrives in Theo's jacket. What Nate says is a choice; so is saying nothing.
    // =====================================================================
    {
      id: 'c4m4', title: 'c4.m4',
      flags: { mace_gave_car: true },
      setup: [
        LATE,
        { do: 'world', traffic: 0, people: 12, now: true },
        ...MARKET,
        MACE_CAR([-195, -140], 0, { replace: true }),
        { do: 'vehicleSet', id: 'maceCar', stop: true },
        { do: 'allow', enter: 'none' },
        // the Chrome Wolves' cars wait up the street; Dante's comes down it
        { do: 'spawn', id: 'wcar1', kind: 'tech_patrol_car', or: 'sedan', at: [-191.4, -101], face: 180, color: [0.06, 0.065, 0.075], npc: true, noDetail: true, type: { role: 'car' } },
        { do: 'spawn', id: 'wcar2', kind: 'tech_patrol_car', or: 'sedan', at: [-198.6, -97], face: 180, color: [0.22, 0.23, 0.25], npc: true, noDetail: true, type: { role: 'car' } },
        { do: 'spawn', id: 'dante', kind: 'chrome_supercar', or: 'coupe', at: [-195, -40], face: 180, color: [0.6, 0.62, 0.66], npc: true, detail: true, type: { role: 'car' } },
        WOLF('wolf1', 'name.rigg', [-197.6, -114.5], 180, 0),
        WOLF('wolf2', 'name.sable', [-195.0, -112.2], 180, 1, { pose: 'hips' }),
        WOLF('wolf3', 'name.novak', [-192.3, -114.8], 180, 2),
        { do: 'player', stage: { at: [-193.2, -141.5], face: 0, pose: 'idle' } },
      ],
      steps: [
        { do: 'drive', id: 'dante', mode: 'path', kin: true, path: [[-195, -40], [-195, -121]], speed: 42, end: 'stop', event: 'danteHere' },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the rain, the market lights, and a chrome car coming down the street
            { seconds: 6.2, fade: 'in', fadeSeconds: 1.8, cam: { from: [-191.5, 1.55, -147.5], look: [-195, 1.0, -105], fov: 40 },
              do: [{ do: 'music', silence: 1.2 }, { do: 'mood', set: { nate: 'stern' } }],
              hold: { event: 'danteHere', seconds: 0.6, max: 9 } },
            // the wolf on the hood: lines cut into the chrome
            { seconds: 3.2, cam: { from: { of: 'dante', p: [0.0, 1.8, 4.2] }, look: { of: 'dante', p: [0, 0.75, 1.3] }, fov: 28 },
              do: [{ do: 'prop', id: 'wolf', kind: 'wolfDecal', in: 'dante', at: { cabinAt: 'front' }, hood: 0.85, size: 0.62 }] },
            // DANTE gets out. He wears Theo's jacket. It is a little small on him.
            { seconds: 5.4, cam: { from: [-192.2, 1.5, -131.2], to: [-192.6, 1.5, -130.2], look: [-194.2, 1.2, -123.0], fov: 32 },
              do: [{ do: 'vehicleSet', id: 'dante', door: 1 }, DANTE([-193.6, -123.4], 180, { look: 'player' })],
              lines: [{ at: 1.6, do: [{ do: 'vehicleSet', id: 'dante', door: 0 }, { do: 'sound', name: 'door' }] }] },
            // Nate sees the jacket
            { seconds: 3.4, cam: { from: { of: 'player', p: [0.35, 1.62, 1.15] }, look: { of: 'player', p: [0, 1.6, 0] }, fov: 26 },
              do: [{ do: 'mood', set: { nate: 'sad' } }] },
            { seconds: 5.4, cam: { from: [-193.0, 1.64, -129.4], look: [-193.6, 1.58, -123.4], fov: 26 },
              lines: [{ at: 0.6, who: 'dante', text: 'c4.dante.eyes', seconds: 3.6, mood: 'stern' }] },
            // Nate does not answer
            { seconds: 3.6, cam: { from: { of: 'player', p: [0.5, 1.6, 1.4] }, look: { of: 'player', p: [0, 1.58, 0] }, fov: 24 },
              do: [{ do: 'mood', set: { nate: 'tired' } }] },
            { seconds: 6.4, cam: { from: [-194.6, 1.5, -134.4], to: [-194.5, 1.52, -133.6], look: [-193.6, 1.45, -123.4], fov: 30 },
              lines: [{ at: 0.5, who: 'dante', text: 'c4.dante.race', seconds: 5.0, mood: 'stern' }] },
          ],
        },
        // CHOICE (it matters later): say nothing, "I am sorry", or "Race me." Waiting too long is saying nothing.
        {
          do: 'choice', seconds: 9, default: 0,
          options: [
            { text: 'c4.ch.silence', set: { dante_response: 'silence' } },
            { text: 'c4.ch.sorry', set: { dante_response: 'sorry' } },
            { text: 'c4.ch.race', set: { dante_response: 'race' } },
          ],
        },
        {
          do: 'cutscene',
          shots: [
            { if: { flag: 'dante_response', is: 'sorry' }, seconds: 3.0, cam: { from: { of: 'player', p: [0.4, 1.6, 1.3] }, look: { of: 'player', p: [0, 1.58, 0] }, fov: 26 },
              lines: [{ at: 0.3, who: 'nate', text: 'c4.nate.sorry', seconds: 2.0, mood: 'sad' }] },
            { if: { flag: 'dante_response', is: 'race' }, seconds: 2.6, cam: { from: { of: 'player', p: [0.4, 1.6, 1.3] }, look: { of: 'player', p: [0, 1.58, 0] }, fov: 26 },
              lines: [{ at: 0.3, who: 'nate', text: 'c4.nate.race', seconds: 1.8, mood: 'stern' }] },
            { seconds: 4.2, cam: { from: [-193.0, 1.64, -129.4], look: [-193.6, 1.58, -123.4], fov: 26 },
              lines: [
                { at: 0.4, who: 'dante', text: 'c4.dante.after_silence', seconds: 3.2, if: { flag: 'dante_response', is: 'silence' } },
                { at: 0.4, who: 'dante', text: 'c4.dante.after_sorry', seconds: 2.6, mood: 'sad', if: { flag: 'dante_response', is: 'sorry' } },
                { at: 0.4, who: 'dante', text: 'c4.dante.after_race', seconds: 2.2, if: { flag: 'dante_response', is: 'race' } },
              ] },
            // the Chrome Wolves behind him: what they say follows what Nate said
            { seconds: 5.6, cam: { from: [-194.2, 1.7, -127.5], look: [-195, 1.55, -113.5], fov: 34 },
              lines: [
                { at: 0.4, who: 'rigg', actor: 'wolf1', text: 'c4.wolf.silence', seconds: 2.4, if: { flag: 'dante_response', is: 'silence' } },
                { at: 0.4, who: 'rigg', actor: 'wolf1', text: 'c4.wolf.sorry', seconds: 2.4, if: { flag: 'dante_response', is: 'sorry' } },
                { at: 0.4, who: 'rigg', actor: 'wolf1', text: 'c4.wolf.race', seconds: 2.4, if: { flag: 'dante_response', is: 'race' } },
                { at: 3.0, who: 'sable', actor: 'wolf2', text: 'c4.wolf2.silence', seconds: 2.4, if: { flag: 'dante_response', is: 'silence' } },
                { at: 3.0, who: 'sable', actor: 'wolf2', text: 'c4.wolf2.sorry', seconds: 2.4, if: { flag: 'dante_response', is: 'sorry' } },
                { at: 3.0, who: 'sable', actor: 'wolf2', text: 'c4.wolf2.race', seconds: 2.4, if: { flag: 'dante_response', is: 'race' } },
              ] },
            { seconds: 4.0, cam: { from: [-192.2, 1.5, -131.2], look: [-193.6, 1.5, -123.4], fov: 30 },
              lines: [{ at: 0.3, who: 'dante', text: 'c4.dante.where', seconds: 3.0 }] },
          ],
        },
        { do: 'player', stage: null, at: [-193.2, -141.5], face: 0 },
        { do: 'allow', enter: ['maceCar'] },
      ],
    },

    // =====================================================================
    // 6. THE FINAL RACE: IRONHILL NIGHT RUN - two laps. The last turn is the turn of the prologue.
    // =====================================================================
    {
      id: 'c4m5', title: 'c4.m5',
      flags: { mace_gave_car: true, dante_response: 'silence' },
      setup: [
        RUN_NIGHT,
        { do: 'world', traffic: 0, people: 0, now: true },
        ...onLoad([MACE_CAR([-188.5, -142], 0), { do: 'player', at: [-186.2, -143], face: 270 }, { do: 'allow', enter: ['maceCar'] }]),
        ...IRONHILL,
        { do: 'remove', ids: ['dante', 'wcar1', 'wcar2', 'wolf1', 'wolf2', 'wolf3'] },
      ],
      steps: [
        { do: 'driveTo', text: 'c4.obj.start', vehicle: 'maceCar', at: [-8, -352], radius: 14 },
        { do: 'checkpoint', id: 1, setup: [MACE_CAR([-9.3, -354], 0, { replace: true }), { do: 'player', inCar: 'maceCar' }, { do: 'allow', enter: ['maceCar'] }] },
        // ---- QUIET MOMENTS on the grid: Nate wipes the rain off the windshield; Dante pours a little water on the road ----
        { do: 'vehicleSet', id: 'maceCar', place: [-9.3, -354], face: 0, stop: true },
        { do: 'spawn', id: 'danteGrid', kind: 'chrome_supercar', or: 'coupe', at: [-4.7, -337], face: 0, color: [0.6, 0.62, 0.66], npc: true, detail: true, type: { role: 'car' } },
        { do: 'prop', id: 'wolfG', kind: 'wolfDecal', in: 'danteGrid', at: { cabinAt: 'front' }, hood: 0.85, size: 0.62 },
        DANTE([-2.5, -339.2], 120, { look: null, replace: true }),
        { do: 'prop', id: 'bottle', kind: 'bottle', pour: true, on: 'dante', bone: 'hand_R', p: [0.0, -0.05, 0.05], rot: [Math.PI * 0.92, 0, 0] },
        WOLF('wolf1', 'name.rigg', [-13.2, -343.5], 230, 0, { replace: true }),
        WOLF('wolf2', 'name.sable', [-1.6, -347], 160, 1, { replace: true, pose: 'hips' }),
        {
          do: 'cutscene',
          shots: [
            // from the driver's seat: the rain on the glass, and Nate outside wiping it with a rag
            { seconds: 5.6, fade: 'in', fadeSeconds: 1.6, pov: true, cam: { from: { cabin: 'maceCar', at: 'eye', p: [0, 0.02, -0.05] }, look: { cabin: 'maceCar', at: 'eye', p: [0.3, -0.15, 4] }, fov: 50, near: NEAR },
              do: [{ do: 'player', stage: { at: { of: 'maceCar', p: [0.55, 0, 2.75] }, face: 180, pose: 'hold' }, mood: 'tired' },
                { do: 'prop', id: 'rag', kind: 'rag', on: 'player', bone: 'hand_R', p: [0.0, -0.06, 0.08] },
                { do: 'music', silence: 0.8 }, { do: 'music', calm: 0.4 }] },
            { seconds: 3.6, cam: { from: { of: 'maceCar', p: [3.2, 1.4, 4.4] }, look: { of: 'player', p: [0, 1.2, 0] }, fov: 34 } },
            // Dante pours a little water on the road. A habit. Respect, for the ones who are not here.
            { seconds: 5.4, cam: { from: [-3.6, 0.45, -341.6], to: [-3.4, 0.5, -341.3], look: [-2.2, 0.9, -338.8], fov: 38 },
              do: [{ do: 'actorSet', id: 'dante', pose: 'phone' }],
              lines: [
                { at: 2.0, who: 'rigg', actor: 'wolf1', text: 'c4.wolf.final_silence', seconds: 2.4, if: { flag: 'dante_response', is: 'silence' } },
                { at: 2.0, who: 'rigg', actor: 'wolf1', text: 'c4.wolf.final_sorry', seconds: 2.4, if: { flag: 'dante_response', is: 'sorry' } },
                { at: 2.0, who: 'rigg', actor: 'wolf1', text: 'c4.wolf.final_race', seconds: 2.4, if: { flag: 'dante_response', is: 'race' } },
              ] },
            // they look at each other once, then go to their cars
            { seconds: 3.6, cam: { from: [-11.5, 1.6, -349.8], look: [-2.6, 1.5, -339.2], fov: 30 },
              do: [{ do: 'remove', ids: ['bottle'] }, { do: 'actorSet', id: 'dante', pose: 'idle', look: 'player' }, { do: 'player', stage: { at: { of: 'maceCar', p: [1.6, 0, 1.0] }, face: 40, pose: 'idle' }, mood: 'stern' }] },
          ],
        },
        { do: 'remove', ids: ['rag', 'dante', 'danteGrid', 'wolfG', 'wolf1', 'wolf2'] },
        { do: 'player', stage: null },
        { do: 'player', inCar: 'maceCar' },
        { do: 'music', calm: 0 },
        { do: 'music', tension: 0.45 },
        // ---- THE RACE ----
        {
          do: 'race', race: 'final', as: { dante: 'dante', wolf1: 'rcar1', wolf2: 'rcar2', wolf3: 'rcar3', f5: 'rcar4' }, shortcutFlag: 'took_shortcut', stop: false,
          react: {
            // the wolf on the hood of Dante's race car
            start: [{ do: 'prop', id: 'wolfR', kind: 'wolfDecal', in: 'dante', at: { cabinAt: 'front' }, hood: 0.85, size: 0.62 }],
            // somebody tells him about the old diagonal (the risky shortcut), once at the start
            go: [
              { do: 'say', who: 'lena', text: 'c4.lena.shortcut', seconds: 5, if: { all: [{ flag: 'chip_holder', is: 'lena' }, { flag: 'shortcut_told', is: false }] } },
              { do: 'say', who: 'wren', text: 'c4.wren.shortcut', seconds: 5, if: { all: [{ flag: 'chip_holder', is: 'nate' }, { flag: 'shortcut_told', is: false }] } },
              { do: 'flag', set: { shortcut_told: true } },        // (once: not again after a retry)
            ],
            finalLap: [{ do: 'music', tension: 0.7 }],
            // THE LAST TURN: the music stops. Theo, in the car, for one sentence.
            lastTurn: [{ do: 'music', silence: 4 }, { do: 'say', who: 'theo', text: 'c4.theo.voice', kind: 'thought', seconds: 2.4, now: true }],
            // the same half second of slow motion as in the prologue, at the brake point
            lastBrake: [{ do: 'slowmo', scale: 0.4, seconds: 1.25 }],
          },
          reactEvery: 2,
        },
        // ---- ZERO: it comes out of the dark, passes him, and stops every other car of the race ----
        { do: 'music', tension: 0 },
        { do: 'autoDrive', brake: 1 },
        { do: 'slowmo', scale: 0.5, seconds: 40 },
        { do: 'zero', strike: { speed: 150, ahead: 115, side: 3.6, stopAhead: 17, stareFor: 3.6, reach: 170 } },
        {
          do: 'cutscene', skippable: false,
          shots: [
            // behind Nate's car, low: the street ahead is dark. A thin cold bar of light comes out of it.
            { seconds: 3.5, cam: { from: { of: 'maceCar', p: [-1.6, 1.25, -6.2] }, look: { of: 'maceCar', p: [1.4, 1.1, 30] }, fov: 42 },
              do: [{ do: 'music', zero: 0.6 }],
              hold: { event: 'zero:pass', seconds: 0.9, max: 9 } },
            // behind him, over Dante's shoulder: it goes through the cars of the race. They spin and stop. Nobody is hurt.
            { seconds: 3.0, cam: { from: { of: 'dante', p: [5.0, 3.0, -9.5] }, look: { of: 'dante', p: [0, 0.9, 7] }, fov: 48 },
              hold: { event: 'zero:dark', seconds: 1.6, max: 9 } },
            // the drivers climb out of their cars, slowly
            { seconds: 4.6, cam: { from: { of: 'dante', p: [4.2, 1.4, 5.4] }, look: { of: 'dante', p: [0, 0.9, 0] }, fov: 36 },
              do: [
                { do: 'vehicleSet', id: 'dante', door: 1, dead: true },
                DANTE({ of: 'dante', p: [1.9, 0, 0.4] }, 0, { look: null, replace: true, mood: 'afraid' }),
                WOLF('wolf1', 'name.rigg', { of: 'rcar1', p: [1.8, 0, 0.3] }, 0, 0, { replace: true, pose: 'idle', look: null, mood: 'afraid' }),
                WOLF('wolf2', 'name.sable', { of: 'rcar2', p: [1.8, 0, 0.3] }, 0, 1, { replace: true, pose: 'idle', look: null, mood: 'afraid' }),
                { do: 'music', zero: 0.8 },
              ] },
            // ZERO stands in front of Nate. Headlights on. It does nothing.
            { seconds: 3.0, pov: true, cam: { from: { cabin: 'maceCar', at: 'eye', p: [0, 0.03, 0.05] }, look: { of: 'zero', p: [0, 0.75, 0] }, fov: 40, near: NEAR },
              do: [{ do: 'zero', stare: true }, { do: 'music', zero: 1 }, { do: 'mood', set: { nate: 'afraid' } }],
              hold: { event: 'zero:away', seconds: 1.2, max: 9 } },
            // and it drives away into the dark
            { seconds: 3.0, cam: { from: { of: 'maceCar', p: [-1.4, 1.5, -5.5] }, look: { of: 'maceCar', p: [0.2, 1.2, 40] }, fov: 38 },
              hold: { event: 'zero:gone', seconds: 0.6, max: 8 } },
          ],
        },
        { do: 'slowmo', scale: 1, seconds: 0 },
        { do: 'autoDrive', off: true },
        { do: 'music', zero: 0 },
        { do: 'flag', set: { zero_found_race: true } },
        { do: 'lines', lines: [{ wait: 0.8 }, { who: 'wren', text: 'c4.wren.zero', seconds: 3.4 }, { who: 'nate', text: 'c4.nate.zero', seconds: 2.2, mood: 'tired' }] },
        { do: 'zero', stop: true },
        { do: 'raceEnd' },
        { do: 'fade', to: 'black', seconds: 2.2, wait: true },
      ],
    },

    // =====================================================================
    // 7. THE ROOF - quiet. Dante's car smokes below on Neon Mile. The jacket.
    // =====================================================================
    {
      id: 'c4m6', title: 'c4.m6',
      flags: { mace_gave_car: true, dante_response: 'silence', took_shortcut: false, zero_found_race: true },
      setup: [
        ROOF_NIGHT,
        { do: 'world', traffic: 0, people: 0, now: true },
        { do: 'fade', to: 'black', seconds: 0, onLoad: true },
        // below on Neon Mile: the wrecks where Zero left them, Dante's car smoking; the drivers stand by them
        { do: 'spawn', id: 'danteWreck', kind: 'chrome_supercar', or: 'coupe', at: ROOF.wreck, face: 115, color: [0.6, 0.62, 0.66], npc: true, type: { role: 'car' } },
        { do: 'vehicleSet', id: 'danteWreck', damage: 0.9, stop: true, lights: 'off', dead: true, door: 1 },
        { do: 'prop', id: 'wolfW', kind: 'wolfDecal', in: 'danteWreck', at: { cabinAt: 'front' }, hood: 0.85, size: 0.62 },
        { do: 'prop', id: 'smoke', kind: 'smokeColumn', at: [ROOF.wreck[0] + 0.3, ROOF.wreck[1] + 0.4], height: 16, dark: 0.45 },
        { do: 'spawn', id: 'wreck1', kind: 'tech_patrol_car', or: 'sedan', at: [-97, -388.2], face: 300, color: [0.06, 0.065, 0.075], npc: true, noDetail: true, type: { role: 'car' } },
        { do: 'vehicleSet', id: 'wreck1', damage: 0.6, stop: true, lights: 'off', dead: true },
        { do: 'spawn', id: 'wreck2', kind: 'tech_patrol_car', or: 'sedan', at: [-39, -387.6], face: 75, color: [0.22, 0.23, 0.25], npc: true, noDetail: true, type: { role: 'car' } },
        { do: 'vehicleSet', id: 'wreck2', damage: 0.6, stop: true, lights: 'off', dead: true },
        MACE_CAR([-5.6, -346], 5, { replace: true }),
        { do: 'vehicleSet', id: 'maceCar', stop: true, damage: 0.15 },
        { do: 'vehicleSet', id: 'maceCar', damage: 0.4, if: { flag: 'took_shortcut' } },
        { do: 'prop', id: 'smokeM', kind: 'smokeColumn', at: [-5.6, -343.8], height: 6, dark: 0.2, if: { flag: 'took_shortcut' } },
        ...IRONHILL,
        WOLF('wolf1', 'name.rigg', { of: 'wreck1', p: [2.2, 0, 0.6] }, 250, 0, { replace: true, pose: 'crossed', look: null }),
        WOLF('wolf2', 'name.sable', { of: 'wreck2', p: [2.2, 0, 0.6] }, 100, 1, { replace: true, pose: 'idle', look: null }),
        // on the flat roof of the low building on Neon Mile: Dante in Theo's jacket, Nate beside him
        DANTE(ROOF.dante, 225, { look: null, replace: true, mood: 'tired' }),
        { do: 'player', stage: { at: ROOF.nate, face: 215, pose: 'idle' }, mood: 'tired' },
        { do: 'allow', enter: 'none', drive: false },
      ],
      steps: [
        {
          do: 'cutscene', keep: true,
          shots: [
            // the roof in the rain; below, Neon Mile, and Dante's car smoking
            { seconds: 8, fade: 'in', fadeSeconds: 3, cam: { from: { roof: [-85.6, -362.6], up: 2.3 }, to: { roof: [-85.0, -363.3], up: 2.2 }, look: [ROOF.wreck[0], 0.8, ROOF.wreck[1]], fov: 46 },
              do: [{ do: 'music', silence: 30 }, { do: 'fill', power: 0.35 }] },
            // he takes off Theo's jacket and holds it up in front of him, by the collar
            { seconds: 6, cam: { from: { roof: [-78.8, -370.6], up: 1.55 }, look: { of: 'dante', p: [0, 1.2, 0] }, fov: 36 },
              lines: [{ at: 1.4, do: [{ do: 'actorSet', id: 'dante', jacket: null, pose: 'hold' },
                { do: 'prop', id: 'jacketH', kind: 'theoJacket', folded: true, at: { of: 'dante', p: [0, 1.0, 0.38] }, face: 225 }] }] },
            { seconds: 6.4, cam: { from: { roof: [-79.3, -370.3], up: 1.62 }, look: { of: 'dante', p: [0, 1.58, 0] }, fov: 28 },
              lines: [{ at: 0.6, who: 'dante', text: 'c4.dante.running', seconds: 5.0, mood: 'sad' }] },
            { if: { flag: 'took_shortcut' }, seconds: 4.4, cam: { from: { roof: [-80.4, -370.1], up: 1.62 }, look: { of: 'player', p: [0, 1.55, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'dante', text: 'c4.dante.shortcut', seconds: 3.6, mood: 'stern' }] },
            { if: { flag: 'took_shortcut', is: false }, seconds: 4.0, cam: { from: { roof: [-80.4, -370.1], up: 1.62 }, look: { of: 'player', p: [0, 1.55, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'dante', text: 'c4.dante.stayed', seconds: 3.0, mood: 'sad' }] },
            { if: { flag: 'dante_response', is: 'sorry' }, seconds: 4.2, cam: { from: { roof: [-79.3, -370.3], up: 1.62 }, look: { of: 'dante', p: [0, 1.58, 0] }, fov: 28 },
              lines: [{ at: 0.4, who: 'dante', text: 'c4.dante.sorry2', seconds: 3.4 }] },
            { seconds: 3.8, cam: { from: { roof: [-79.3, -370.3], up: 1.62 }, look: { of: 'dante', p: [0, 1.5, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'dante', text: 'c4.dante.car', seconds: 3.0, mood: 'stern' }] },
          ],
        },
        // CHOICE: take Theo's jacket, or let Dante keep it
        { do: 'choice', options: [{ text: 'c4.ch.take', set: { jacket_taken: true } }, { text: 'c4.ch.leave', set: { jacket_taken: false } }] },
        {
          do: 'cutscene', keep: true,
          shots: [
            // Nate holds out his hands. Dante gives him the jacket.
            { if: { flag: 'jacket_taken' }, seconds: 5.4, cam: { from: { roof: [-78.0, -366.6], up: 1.5 }, look: { roof: [-82.1, -368.8], up: 1.15 }, fov: 36 },
              do: [{ do: 'player', stage: { at: ROOF.nate, face: 135, pose: 'hold' } }, { do: 'actorSet', id: 'dante', face: 315 }],
              lines: [{ at: 1.8, do: [{ do: 'remove', ids: ['jacketH'] }, { do: 'prop', id: 'jacketN', kind: 'theoJacket', folded: true, at: { of: 'player', p: [0, 1.0, 0.36] }, face: 135 }, { do: 'actorSet', id: 'dante', pose: 'idle' }, { do: 'sound', name: 'cloth' }] },
                { at: 2.8, who: 'dante', text: 'c4.dante.take', seconds: 2.4, mood: 'sad' }] },
            { if: { flag: 'jacket_taken', is: false }, seconds: 5.0, cam: { from: { roof: [-78.0, -366.6], up: 1.5 }, look: { roof: [-82.1, -368.8], up: 1.4 }, fov: 36 },
              lines: [{ at: 0.6, who: 'nate', text: 'c4.nate.leave', seconds: 2.4, mood: 'sad' }, { at: 3.4, do: [{ do: 'actorSet', id: 'dante', mood: 'sad' }] }] },
            // the rain over Neon Mile. A long, slow fade.
            { seconds: 11, fade: 'out', fadeSeconds: 7, cam: { from: { roof: [-84.0, -360.2], up: 3.0 }, to: { roof: [-84.6, -358.8], up: 3.4 }, look: [ROOF.wreck[0], 0.8, ROOF.wreck[1]], fov: 44 } },
          ],
        },
        { do: 'remove', ids: ['jacketN', 'jacketH'] },
        { do: 'wait', seconds: 1.2 },
        { do: 'end', over: 'c4.card.sub', title: 'c4.title', lines: ['c4.end.1', 'c4.end.2', 'c4.end.3'], locked: 'c4.end.locked' },
      ],
    },
  ],
};
