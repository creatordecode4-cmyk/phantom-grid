// ---------------------------------------------------------------------------
// CHAPTER 10 - "PHANTOM GRID" (the last night: midnight, the night after Chapter 9)
//
// This file is ONLY DATA, written like chapter09.js. The story engine (src/story/engine.js) explains every word used
// here at its top. New here: "tower" (the KVI tower of src/story/towerSet.js: one zone at a time, out at sea - the
// spiral ramp, the lobby, the atrium, the lift, the server floor, the sky garden, the glass room), "countdown" (the
// clock of the last night, top middle), the condition { rampAt } (how far up the spiral ramp the car is), { flag,
// has } (a word in a list flag) and { do: 'flag', add } (ally_help), police { phantom } (up to 8 of KVI's white
// Phantoms and 3 drones), { lose } and { clearRoadblock } (friends helping), the voice kind 'warm' (Theo, clear) and
// the choice layout 'final' (LET GO / KEEP HIM). All texts are keys of src/story/strings.js.
//
// TONE: tense in the assault; intimate and quiet in the truth; very still at the end. Short plain lines. No
// speeches. Silence is a tool: things say what people do not.
//
// THE NIGHT IN ONE LINE: a table with one thing on it from each friend, a clock that runs to midnight, a tower that
// climbs, a dream of the crash night, every Phantom in the city let loose, Zero stepping in, and a quiet room at the
// top where a calm man offers Nate his brother forever.
//
// It uses what earlier chapters left behind (see src/story/flags.js for every flag):
//   WHO IS AT THE TABLE: Lena always; Dante when Harrow let him go (harrow_switched) or he was never caught;
//   Rask when he called (rask_redeemed); Harrow when she changed sides (harrow_switched); Mace when he was forgiven
//   or Nate stayed silent (mace_forgiven true or 'neutral'); Juno when she was spared (juno_fate 'spared') and left
//   KVI (juno_left_kvi) - both from Chapter 7, which is not written yet.
//   jacket_taken (which jacket Dante wears), nate_partial_peace (Chapter 8: Nate nods, or closes his eyes),
//   vance_bar_a / vance_bar_b (Chapter 7, the gala: "You did not recognise me"), theo_car (the car Nate drives).
// It leaves: c10_difficulty, ally_help (what each friend does), nate_innocent_seen, vance_response ('crash' |
//   'mind' | 'silent'), final_choice ('let_go' | 'keep_him') - then the endings (src/story/endings.js).
//
// Places: [x, z] on the ground, [x, y, z], { safe: [x, y, z] } (Lena's room), { tower: zone, p: [x, y, z] } (a zone
// of the tower: x to the right, z forward, y up from its floor), { of: 'car or person', p: [left, up, forward] },
// { cabin: 'car', at, p }. Compass degrees: 0 north, 90 east, 180 south, 270 west. On the map +x is west, -x east.
// ---------------------------------------------------------------------------

const NEAR = 0.05;
const NIGHT = { do: 'time', hour: 23.75, rain: true };
const onLoad = (list) => list.map((q) => ({ ...q, onLoad: true }));

// ---- who is here tonight (the same rules as ALLY_RULES in src/story/flags.js) ----
const HAS = {
  dante: { any: [{ flag: 'harrow_switched' }, { not: { flag: 'dante_captured' } }] },
  rask: { flag: 'rask_redeemed' },
  harrow: { flag: 'harrow_switched' },
  mace: { any: [{ flag: 'mace_forgiven', is: true }, { flag: 'mace_forgiven', is: 'neutral' }] },
  juno: { all: [{ flag: 'juno_fate', is: 'spared' }, { flag: 'juno_left_kvi' }] },
};
const HELP = (w) => ({ flag: 'ally_help', has: w });
const EASY = { flag: 'c10_difficulty', is: 'easy' };
const NORMAL = { not: EASY };

// ---- Lena's safehouse (src/story/safehouseSet.js: x to the right of the window, y up, z toward the door) ----
const s = (x, y, z) => ({ safe: [x, y, z] });
const SAFE = {
  nate: s(0.45, 0, 1.05), lena: s(1.2, 0.5, -1.2), laptop: s(1.22, 0.765, -1.98),
  mace: s(-1.9, 0, -1.85), rask: s(1.6, 0, 1.75), dante: s(2.55, 0, -0.35), harrow: s(2.45, 0, 0.75),
  door: s(2.05, 0, 2.3), juno: s(0.32, 0, -1.85),
  // the things on the table (its top is 0.765 m up)
  key: s(1.74, 0.772, -1.62), badge: s(1.44, 0.772, -1.56), drawing: s(2.02, 0.768, -1.98), palm: s(0.86, 0.77, -1.84),
};
const THEO_JACKET = { color: [0.11, 0.42, 0.78], cuff: 0.83, hem: 0.07 };
const WOLVES_JACKET = { color: [0.16, 0.16, 0.18], cuff: 0.86, hem: 0.06, trim: [0.6, 0.62, 0.66] };
const LENA = { do: 'actor', id: 'lena', model: 'Lena_Marchetti', name: 'name.lena', at: SAFE.lena, face: 180, pose: 'sit', floorBelow: 0.5, fixed: true, mood: 'stern', look: SAFE.laptop };
const ROOM = [
  LENA,
  { do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at: SAFE.mace, face: 321, pose: 'crossed', fixed: true, look: null, mood: 'tired', if: HAS.mace },
  { do: 'actor', id: 'rask', model: 'Viktor_Rask', name: 'name.rask', at: SAFE.rask, face: 172, pose: 'hold', fixed: true, look: null, mood: 'stern', if: HAS.rask },
  { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_L', p: [0, 0.004, 0], wrist: true, band: 1.4, if: HAS.rask },
  // (Dante: Theo's old blue jacket if Nate left it with him in Chapter 4, else an old Chrome Wolves jacket)
  { do: 'actor', id: 'dante', model: 'Dante_Rios', name: 'name.dante', at: SAFE.dante, face: 230, pose: 'hips', fixed: true, look: null, mood: 'stern', jacket: THEO_JACKET, if: { all: [HAS.dante, { flag: 'jacket_taken', is: false }] } },
  { do: 'actor', id: 'dante', model: 'Dante_Rios', name: 'name.dante', at: SAFE.dante, face: 230, pose: 'hips', fixed: true, look: null, mood: 'stern', jacket: WOLVES_JACKET, if: { all: [HAS.dante, { flag: 'jacket_taken' }] } },
  { do: 'actor', id: 'harrow', model: 'Sloane_Harrow', name: 'name.harrow', at: SAFE.harrow, face: 262, pose: 'crossed', fixed: true, look: null, mood: 'tired', if: HAS.harrow },
  { do: 'prop', id: 'laptop', kind: 'laptop', at: SAFE.laptop, face: 0 },
];
const BYE = ['lena', 'mace', 'rask', 'wwatch', 'dante', 'harrow', 'juno', 'laptop', 'key', 'badge', 'drawing', 'pkey', 'macekey'];

// ---- Nate's car: Theo's car when it runs, else Mace's old street car (as in Chapter 8) ----
const THEO_CAR = { flag: 'theo_car' };
const RUN_CAR = (at, face, more = {}) => [
  { do: 'spawn', id: 'run', kind: 'theo_coupe', or: 'coupe', at, face, enter: true, lockExit: true, detail: true, if: THEO_CAR, ...more },
  { do: 'spawn', id: 'run', kind: 'tech_patrol_car', or: 'sedan', at, face, enter: true, lockExit: true, detail: true, color: [0.42, 0.27, 0.12], lights: 'normal',
    type: { label: "MACE'S STREET CAR", topSpeed: 204, accel: 9.4, grip: 1.1, nitro: true, role: 'car' }, if: { not: THEO_CAR }, ...more },
];
const IN_CAR = [{ do: 'player', inCar: 'run' }, { do: 'allow', enter: ['run'], move: true, drive: true }];

// ---- THE CITY: where the night happens ----
const START = [-101, -168];                // a street of The Grid, near the room above the closed shop
const DIAG = [87, 72];                     // the Calloway Diagonal crosses the 87th street here
const GATE = [463, 470];                   // the gate of KVI's private road, at the north end of The Crown
const OUT = [463, 452];                    // just south of the gate, facing south: where the car comes out
const GRID_A = [181, 144], GRID_B = [-101, -84];          // the chase through The Grid
const NEON = [-420, -390];                 // Neon Mile, west of the docks gate
const RAMP_FOOT = [-487, -392];            // the foot of the Ironhill ramp
const LN = [-487.1, -491.25, -495.4];      // the northbound lanes of the highway (inside .. by the wall)
const DECK = 8;

// ---- THE TOWER (src/story/towerSet.js): a point of a zone ----
const tw = (zone, x, y, z) => ({ tower: zone, p: [x, y, z] });
// (the same numbers as towerSet.js - the zones lie in a row out at sea - for the paths of the guards, which are plain
//  [x, z] places)
const TZ = { ramp: 0, lobby: 1, atrium: 2, shaft: 3, server: 4, terrace: 5, glass: 6 };
const TXZ = (zone, x, z) => [-1700 + TZ[zone] * 140 + x, -2700 + z];
const GUARD = (id, zone, path, more = {}) => ({ actor: id, path: path.map(([x, z]) => TXZ(zone, x, z)), range: 9.5, fov: 0.62, speed: 1.15, stop: 1.6, ...more });
// THE LOBBY: one guard walks across the hall in front of the desk, one up and down the right side. (When a friend
// calls one away, the one who walks across goes.) The staff gate and the doors at the back lie outside both their
// cones while they walk their lines, so the hack at the gate is fair.
const LOBBY_SIDE = GUARD('g2', 'lobby', [[12.5, 5.0], [12.5, -9.5]]);
const LOBBY_CROSS = GUARD('g1', 'lobby', [[-10.5, -4.2], [10.5, -4.2]], { stop: 2.2 });
// THE SERVER FLOOR: one walks the aisle between the first two rows of racks, one up and down the east side. (Juno,
// over the roof, has already taken the one in the aisle.)
const SERVER_CROSS = GUARD('g3', 'server', [[-14.2, -5.6], [14.2, -5.6]], { range: 8.5, stop: 2.0 });
const SERVER_SIDE = GUARD('g4', 'server', [[12.2, 4.6], [12.2, -10.6]], { range: 8.5 });
const STEALTH = { do: 'police', real: true, known: true, stealth: true, cars: 0, drones: 0, gates: false, roadblocks: false, hear: false };
const LOBBY_WATCH = [
  { ...STEALTH, sentries: [LOBBY_CROSS, LOBBY_SIDE], if: { not: { any: [HELP('dante_tower'), HELP('rask_tower')] } } },
  { ...STEALTH, sentries: [LOBBY_SIDE], if: { any: [HELP('dante_tower'), HELP('rask_tower')] } },
];
const SERVER_WATCH = [
  { ...STEALTH, sentries: [SERVER_CROSS, SERVER_SIDE], if: { not: HELP('juno_roof') } },
  { ...STEALTH, sentries: [SERVER_SIDE], if: HELP('juno_roof') },
];
// (the drone of the sky garden flies a slow loop; it starts away from Nate, so who follows it at once - running behind
// its light, as the tip says - reaches the service lift before it turns back. On Easy it flies slower.)
const TERRACE_DRONE = (speed) => ({ path: [TXZ('terrace', 12, -3), TXZ('terrace', -12, -3), TXZ('terrace', -12, 3.5), TXZ('terrace', 12, 3.5)], y: 6.5, speed, range: 13, fov: 0.42, tilt: 0.75 });
const TERRACE_WATCH = [
  { ...STEALTH, sentries: [TERRACE_DRONE(2.1)], if: NORMAL },
  { ...STEALTH, sentries: [TERRACE_DRONE(1.6)], if: EASY },
];
// (a restart inside the tower: the car of the ramp is not needed any more)
const ON_FOOT = [{ do: 'player', leaveNow: true }, { do: 'remove', ids: ['run'] }, { do: 'allow', enter: 'none', move: true }];
// THE PHANTOMS let loose (the chase of mission 4): up to 8 cars and 3 drones on normal, 4 and 2 on easy
const LOOSE = [
  { do: 'police', real: true, known: true, phantom: true, cars: 8, drones: 3, gates: false, roadblocks: true, startStars: 4, ram: true, if: NORMAL },
  { do: 'police', real: true, known: true, phantom: true, cars: 4, drones: 2, gates: false, roadblocks: false, startStars: 3, ram: false, if: EASY },
  { do: 'police', stars: 4, seen: true, if: NORMAL },
  { do: 'police', stars: 3, seen: true, if: EASY },
];

export default {
  id: 'chapter10',
  number: 10,
  title: 'c10.title',
  vehicle: 'run',
  getIn: 'c10.get_in',
  // (what a normal game has decided by now; used when a mission is started from the mission list. Chapter 7 and the
  //  side stories are not written yet: Juno does not come and the secret ending cannot happen without the DEBUG
  //  FLAGS screen - triple tap on the title - or the address option "flags")
  flags: {
    limiter_off: true, ticket_taken: true, keystone_found: true, chip_holder: 'lena', chip_to_lena: true, told_lena_theo: true, van_color: 0, van_plate: 'PM 2908',
    harrow_ivy_seen: true, harrow_let_girl_go: true, mace_gave_car: true, zero_found_race: true, jacket_taken: true,
    rask_stance: 'honest', rask_mila_seen: true, opened_package: false, mace_forgiven: true, c6_end: 'forgive',
    theo_car: true, theo_key: true, garage_open: true, upgrades_at: 'garage', dante_captured: true,
    pilot_key_ready: true, theo_running_confirmed: true, wren_fragment_unlocked: true, nate_partial_peace: true,
    trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle', rask_betrayed_nate: true, harrow_reply: 'silent',
    harrow_switched: true, harrow_access_card: true, rask_redeemed: true, ascend_announced: true,
  },
  preload: { actors: ['Lena_Marchetti', 'Dante_Rios', 'Viktor_Rask', 'Sloane_Harrow', 'Mace_Doyle', 'Adrian_Vance'], vehicles: ['tech_patrol_car'] },
  // caught by a Phantom: KVI's words, not the Guard's (then the last checkpoint, as always)
  busted: { who: 'pa', lines: ['c10.busted.1', 'c10.busted.2', 'c10.busted.3'], after: 'c10.busted.after' },

  missions: [
    // =====================================================================
    // 1. THE TABLE - Lena's room, an hour before midnight. One thing each. Then the plan.
    // =====================================================================
    {
      id: 'c10m0', title: 'c10.m0',
      setup: [
        { do: 'time', hour: 22.9, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'safehouse', set: true },
        { do: 'safehouse', tvOn: false, lamp: 0.75 },
        ...ROOM,
        { do: 'player', stage: { at: SAFE.nate, face: 200, pose: 'idle' }, mood: 'tired' },
        { do: 'allow', enter: 'none', move: false },
        { do: 'wanted', stars: 0 },
        { do: 'flag', set: { ally_help: [] } },
      ],
      steps: [
        { do: 'card', over: 'c10.card.over', title: 'c10.title', sub: 'c10.card.sub', seconds: 4.5 },
        // how hard tonight is (the Phantoms, the time): asked once, on the black card
        { do: 'choice', prompt: 'c10.diff.prompt', options: [{ text: 'c10.diff.normal', set: { c10_difficulty: 'normal' } }, { text: 'c10.diff.easy', set: { c10_difficulty: 'easy' } }] },
        { do: 'music', calm: 0.25 },
        {
          do: 'cutscene', keep: true, shots: [
            // the room: rain on the window, everybody quiet; the clock on Lena's screen
            { seconds: 5.2, fade: 'in', cam: { from: s(-2.55, 1.75, 2.35), to: s(-2.3, 1.72, 2.12), look: s(0.9, 1.0, -0.8), fov: 54 },
              lines: [{ at: 1.4, who: 'lena', text: 'c10.lena.midnight', mood: 'stern', seconds: 2.0 }] },
            // JUNO: a knock-less door. She comes in without a word and puts her blank palm on the table.
            { seconds: 4.4, if: HAS.juno, cam: { from: s(0.2, 1.62, -0.3), look: s(2.05, 1.4, 2.3), fov: 40 },
              do: [{ do: 'sound', name: 'door', kind: 'open' }, { do: 'actor', id: 'juno', model: 'Juno_Kade', name: 'name.juno', at: SAFE.door, face: 0, pose: 'idle', mood: 'stern', look: null },
                { do: 'actorSet', id: 'juno', walk: SAFE.juno, speed: 1.0, look: SAFE.palm }, { do: 'player', look: SAFE.door }] },
            { seconds: 3.4, if: HAS.juno, cam: { from: s(-0.2, 1.5, -0.6), look: s(0.6, 1.2, -1.85), fov: 34 },
              do: [{ do: 'actorSet', id: 'lena', look: { of: 'juno', p: [0, 1.6, 0] } }] },
            { seconds: 4.2, if: HAS.juno, cam: { from: s(0.62, 1.12, -1.3), to: s(0.66, 1.08, -1.36), look: SAFE.palm, fov: 26, near: NEAR },
              do: [{ do: 'actorSet', id: 'juno', pose: 'putDown', hands: SAFE.palm }, { do: 'music', silence: 1.6 }] },
            // MACE'S KEY: the key of the garage, on the table
            { seconds: 4.0, if: HAS.mace, cam: { from: s(-0.9, 1.62, -0.9), look: { of: 'mace', p: [0, 1.5, 0] }, fov: 36 },
              do: [{ do: 'prop', id: 'macekey', kind: 'carKey', on: 'mace', bone: 'hand_R', p: [0, -0.07, 0.035] }, { do: 'actorSet', id: 'mace', pose: 'give' }],
              lines: [{ at: 0.8, who: 'mace', text: 'c10.mace.key', mood: 'tired', seconds: 2.6 }] },
            { seconds: 3.2, if: HAS.mace, cam: { from: s(1.3, 1.12, -1.15), to: s(1.34, 1.1, -1.2), look: SAFE.key, fov: 26, near: NEAR },
              do: [{ do: 'remove', ids: ['macekey'] }, { do: 'prop', id: 'key', kind: 'carKey', at: SAFE.key, face: 200 }, { do: 'sound', name: 'keys' }, { do: 'actorSet', id: 'mace', pose: 'crossed' }] },
            // LENA'S BADGE: her old KVI badge, face down
            { seconds: 4.6, cam: { from: s(1.0, 1.25, -0.55), to: s(1.04, 1.22, -0.62), look: SAFE.badge, fov: 28, near: NEAR },
              do: [{ do: 'prop', id: 'badge', kind: 'kviBadge', at: SAFE.badge, face: 160 }, { do: 'actorSet', id: 'lena', look: SAFE.badge }],
              lines: [{ at: 0.9, who: 'lena', text: 'c10.lena.badge', mood: 'stern', seconds: 3.0 }] },
            // DANTE'S JACKET: he pulls it straight, the way he does before a race
            { seconds: 3.8, if: HAS.dante, cam: { from: { of: 'dante', p: [0.25, 1.38, 1.1] }, look: { of: 'dante', p: [0, 1.22, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'dante', pose: 'idle', mood: 'smirk' }],
              lines: [{ at: 0.9, who: 'dante', text: 'c10.dante.jacket', seconds: 2.2 }] },
            // RASK'S WATCH: the child's watch comes off his wrist and goes into his pocket. Nothing is said.
            { seconds: 3.6, if: HAS.rask, cam: { from: { of: 'rask', p: [0.42, 1.22, 0.62] }, to: { of: 'rask', p: [0.4, 1.2, 0.56] }, look: { of: 'rask', p: [0.04, 1.02, 0.22] }, fov: 26, near: NEAR },
              do: [{ do: 'actorSet', id: 'rask', pose: 'hold', mood: 'sad' }] },
            { seconds: 3.4, if: HAS.rask, cam: { from: { of: 'rask', p: [0.5, 1.3, 0.9] }, look: { of: 'rask', p: [0, 1.0, 0.1] }, fov: 32 },
              do: [{ do: 'remove', ids: ['wwatch'] }, { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_R', p: [0, -0.05, 0.03] }],
              lines: [{ at: 2.2, do: [{ do: 'remove', ids: ['wwatch'] }, { do: 'actorSet', id: 'rask', pose: 'idle' }, { do: 'sound', name: 'cloth' }] }] },
            // HARROW'S DRAWING: Ivy's drawing, unfolded on the table
            { seconds: 4.8, if: HAS.harrow, cam: { from: s(1.6, 1.3, -1.05), to: s(1.64, 1.26, -1.12), look: SAFE.drawing, fov: 28, near: NEAR },
              do: [{ do: 'prop', id: 'drawing', kind: 'drawing', at: SAFE.drawing, rot: [-Math.PI / 2, 0.35, 0] }, { do: 'sound', name: 'cloth' }],
              lines: [{ at: 1.1, who: 'harrow', text: 'c10.harrow.drawing', mood: 'sad', seconds: 3.2 }] },
            // the table, everything on it
            { seconds: 3.6, cam: { from: s(1.55, 2.05, -0.55), to: s(1.55, 2.0, -0.7), look: s(1.5, 0.77, -1.8), fov: 40 },
              do: [{ do: 'music', calm: 0.4 }] },
          ],
        },
        // ---- THE PLAN: Lena takes the Grid; the others choose where they go ----
        {
          do: 'cutscene', keep: true, shots: [
            { seconds: 3.6, cam: { from: s(0.62, 1.68, 1.72), to: s(0.66, 1.66, 1.62), look: s(1.2, 1.18, -1.2), fov: 38 },
              do: [{ do: 'actorSet', id: 'lena', look: 'player' }, { do: 'player', look: s(1.2, 1.2, -1.2) }],
              lines: [{ at: 0.4, who: 'lena', text: 'c10.lena.grid', mood: 'stern', seconds: 3.0 }] },
          ],
        },
        { do: 'flag', add: { ally_help: 'lena_grid' } },
        // THE STREETS: Dante and Rask (when both are here, one of them can come with Nate instead)
        { do: 'choice', if: { all: [HAS.dante, HAS.rask] }, prompt: 'c10.ch.streets', options: [
          { text: 'c10.ch.both_streets', do: [{ do: 'flag', add: { ally_help: ['dante_street', 'rask_street'] } }] },
          { text: 'c10.ch.dante_streets', do: [{ do: 'flag', add: { ally_help: ['dante_street', 'rask_tower'] } }] },
          { text: 'c10.ch.rask_streets', do: [{ do: 'flag', add: { ally_help: ['rask_street', 'dante_tower'] } }] },
        ] },
        { do: 'flag', add: { ally_help: 'dante_street' }, if: { all: [HAS.dante, { not: HAS.rask }] } },
        { do: 'flag', add: { ally_help: 'rask_street' }, if: { all: [HAS.rask, { not: HAS.dante }] } },
        // THE DOOR: Harrow's master card, or Juno over the roof (when both are here: one or the other)
        { do: 'choice', if: { all: [HAS.harrow, HAS.juno] }, prompt: 'c10.ch.door', options: [
          { text: 'c10.ch.harrow_door', do: [{ do: 'flag', add: { ally_help: 'harrow_door' } }] },
          { text: 'c10.ch.juno_roof', do: [{ do: 'flag', add: { ally_help: 'juno_roof' } }] },
        ] },
        { do: 'flag', add: { ally_help: 'harrow_door' }, if: { all: [HAS.harrow, { not: HAS.juno }] } },
        { do: 'flag', add: { ally_help: 'juno_roof' }, if: { all: [HAS.juno, { not: HAS.harrow }] } },
        { do: 'flag', add: { ally_help: 'mace_car' }, if: HAS.mace },
        {
          do: 'cutscene', shots: [
            // what each one says about it (one line, no more)
            { seconds: 2.8, if: HELP('dante_street'), cam: { from: { of: 'dante', p: [0.3, 1.6, 1.3] }, look: { of: 'dante', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'dante', text: 'c10.dante.streets', seconds: 2.2 }] },
            { seconds: 2.8, if: HELP('rask_street'), cam: { from: { of: 'rask', p: [0.3, 1.6, 1.3] }, look: { of: 'rask', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'rask', text: 'c10.rask.streets', seconds: 2.3 }] },
            { seconds: 2.8, if: { any: [HELP('dante_tower'), HELP('rask_tower')] }, cam: { from: s(0.62, 1.68, 1.72), look: s(1.6, 1.4, 0.4), fov: 38 },
              lines: [{ at: 0.4, who: 'nate', text: 'c10.nate.with_me', seconds: 2.0 }] },
            { seconds: 3.0, if: HELP('harrow_door'), cam: { from: { of: 'harrow', p: [0.3, 1.6, 1.3] }, look: { of: 'harrow', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'harrow', text: 'c10.harrow.door', seconds: 2.4 }] },
            { seconds: 2.6, if: HELP('juno_roof'), cam: { from: s(0.2, 1.5, -0.9), look: { of: 'juno', p: [0, 1.55, 0] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'juno', look: 'player' }] },
            { seconds: 3.4, if: { not: { any: [HELP('harrow_door'), HELP('juno_roof')] } }, cam: { from: s(1.0, 1.22, -2.42), look: s(1.2, 1.2, -1.25), fov: 36, near: NEAR },
              lines: [{ at: 0.4, who: 'lena', text: 'c10.lena.no_door', mood: 'stern', seconds: 2.8 }] },
            { seconds: 3.0, if: HELP('mace_car'), cam: { from: s(-0.6, 1.62, 0.2), look: { of: 'mace', p: [0, 1.62, 0] }, fov: 34 },
              lines: [{ at: 0.4, who: 'mace', text: 'c10.mace.car', mood: 'tired', seconds: 2.5 }] },
            // THE KEY: Lena gives Nate the pilot key. Only he can carry it in.
            { seconds: 4.4, cam: { from: s(1.95, 1.08, -1.35), to: s(1.85, 1.05, -1.4), look: s(1.0, 1.0, -0.6), fov: 34 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'give', look: 'player' }, { do: 'prop', id: 'pkey', kind: 'pilotKey', on: 'lena', bone: 'hand_R', p: [0, -0.06, 0.04] }],
              lines: [{ at: 0.6, who: 'lena', text: 'c10.lena.key', mood: 'stern', seconds: 3.0 }],
              end: [{ do: 'remove', ids: ['pkey'] }, { do: 'prop', id: 'pkey', kind: 'pilotKey', on: 'player', bone: 'hand_R', p: [0, -0.06, 0.04] }, { do: 'actorSet', id: 'lena', pose: 'sit' }] },
            { seconds: 3.2, cam: { from: s(-0.4, 1.66, 1.6), look: s(1.2, 1.3, -0.6), fov: 46 }, fade: 'out', fadeSeconds: 2.0,
              lines: [{ at: 0.3, who: 'lena', text: 'c10.lena.go', seconds: 1.4 }] },
          ],
        },
        { do: 'safehouse', set: false },
        { do: 'remove', ids: BYE },
        { do: 'music', calm: 0 },
      ],
      flags: { c10_difficulty: 'normal', ally_help: ['lena_grid', 'dante_street', 'rask_tower', 'harrow_door', 'mace_car'] },
    },

    // =====================================================================
    // 2. COUNTDOWN - the city on edge. The sky glows over The Crown, KVI drones everywhere, a clock to midnight.
    // =====================================================================
    {
      id: 'c10m1', title: 'c10.m1',
      setup: [
        NIGHT,
        { do: 'world', traffic: 6, people: 2, indoors: false, now: true },
        ...RUN_CAR(START, 0),
        ...IN_CAR,
        { do: 'wanted', stars: 0 },
        { do: 'cam', mode: 'chase' },
        // the gate of KVI's road (it opens at the end of the mission)
        { do: 'prop', id: 'gate', kind: 'bridgeGate', width: 13.2, at: [GATE[0], 0, GATE[1]], face: 180 },
        { do: 'propSet', id: 'gate', call: { setClosed: 1 } },
        // THE DRONES: KVI's drones over the streets; seen by one, the Phantoms come (stars)
        { do: 'police', real: true, known: true, phantom: true, cars: 4, drones: 3, gates: false, roadblocks: false, startStars: 2, patrol: { at: [180, 160], r: 420, drones: 3, cars: 0 }, if: NORMAL },
        { do: 'police', real: true, known: true, phantom: true, cars: 2, drones: 2, gates: false, roadblocks: false, startStars: 1, patrol: { at: [180, 160], r: 420, drones: 2, cars: 0 }, if: EASY },
        { do: 'news', text: 'c10.news.ascend' },
        { do: 'music', tension: 0.45 },
        { do: 'sound', name: 'heli', level: 0.5 },
      ],
      on: [
        // the diversion: Dante's Wolves, or a fire at Rask's docks, pulls the drones away
        { near: DIAG, radius: 70, do: [
          { do: 'say', who: 'dante', kind: 'radio', text: 'c10.dante.now', if: HELP('dante_street') },
          { do: 'say', who: 'rask', kind: 'radio', text: 'c10.rask.now', if: { all: [HELP('rask_street'), { not: HELP('dante_street') }] } },
          { do: 'police', patrol: { at: [-300, -250], r: 300, drones: 1, cars: 0 }, if: { any: [HELP('dante_street'), HELP('rask_street')] } },
        ] },
      ],
      steps: [
        { do: 'countdown', seconds: 300, failText: 'c10.fail.midnight', if: NORMAL },
        { do: 'countdown', seconds: 420, failText: 'c10.fail.midnight', if: EASY },
        {
          do: 'cutscene', shots: [
            // the city: rain, the white glow over The Crown, the drones' lights crossing the sky
            { seconds: 5.0, fade: 'in', cam: { from: { of: 'run', p: [3.2, 4.2, -10] }, to: { of: 'run', p: [3.0, 4.6, -9] }, look: { of: 'run', p: [0, 6, 40] }, fov: 50 },
              lines: [{ at: 1.0, who: 'lena', kind: 'radio', text: 'c10.lena.drones', seconds: 3.6 }] },
          ],
        },
        { do: 'checkpoint', id: 1, setup: [{ do: 'countdown', seconds: 300, failText: 'c10.fail.midnight', if: NORMAL }, { do: 'countdown', seconds: 420, failText: 'c10.fail.midnight', if: EASY }] },
        { do: 'driveTo', at: DIAG, radius: 22, text: 'c10.obj.diagonal', tip: 'c10.tip.drones', tipSeconds: 7 },
        { do: 'checkpoint', id: 2, setup: [{ do: 'countdown', seconds: 220, failText: 'c10.fail.midnight', if: NORMAL }, { do: 'countdown', seconds: 320, failText: 'c10.fail.midnight', if: EASY },
          { do: 'vehicleSet', id: 'run', place: DIAG, face: 318, stop: true }] },
        { do: 'driveTo', at: [GATE[0], GATE[1] - 14], radius: 12, text: 'c10.obj.gate' },
        // THE GATE: Harrow's card, Juno from the roof, or Lena's hack
        { do: 'police', stars: 0, cars: 0, drones: 0, patrol: null },
        { do: 'allow', drive: false },
        {
          do: 'cutscene', keep: true, shots: [
            { seconds: 3.6, cam: { from: { of: 'run', p: [-3.6, 1.6, 6] }, look: [GATE[0], 2.2, GATE[1]], fov: 42 },
              lines: [{ at: 0.5, who: 'lena', kind: 'radio', text: 'c10.lena.gate', seconds: 2.6 }] },
            { seconds: 3.4, if: HELP('harrow_door'), cam: { from: [GATE[0] + 5, 1.4, GATE[1] - 4], look: [GATE[0], 1.6, GATE[1]], fov: 36 },
              lines: [{ at: 0.4, who: 'harrow', kind: 'radio', text: 'c10.harrow.card', seconds: 2.6 }] },
            { seconds: 3.6, if: HELP('juno_roof'), cam: { from: [GATE[0] - 6, 22, GATE[1] - 18], look: [GATE[0], 3, GATE[1]], fov: 40 },
              lines: [{ at: 1.2, who: 'lena', kind: 'radio', text: 'c10.lena.juno', seconds: 2.2 }] },
          ],
        },
        { do: 'checkpoint', id: 3, setup: [{ do: 'countdown', seconds: 120, failText: 'c10.fail.midnight' }, { do: 'vehicleSet', id: 'run', place: [GATE[0], GATE[1] - 14], face: 0, stop: true }] },
        { do: 'hack', title: 'c10.hack.gate', sub: 'c10.hack.gate_sub', seconds: 16, length: 5, if: { not: { any: [HELP('harrow_door'), HELP('juno_roof')] } },
          fail: [{ do: 'fail', text: 'c10.fail.hack' }] },
        { do: 'propSet', id: 'gate', call: { setClosed: 0 } },
        { do: 'sound', name: 'clunk' },
        {
          do: 'cutscene', shots: [
            { seconds: 3.4, cam: { from: { of: 'run', p: [2.4, 1.2, -5] }, look: { of: 'run', p: [0, 1.2, 30] }, fov: 46 }, fade: 'out', fadeSeconds: 2.4,
              do: [{ do: 'autoDrive', gas: 0.35, brake: 0, steer: 0 }],
              end: [{ do: 'autoDrive', off: true }] },
          ],
        },
        { do: 'countdown', stop: true },
        { do: 'sound', name: 'heli', level: 0 },
        { do: 'police', real: false },
        { do: 'news', text: null },
      ],
      flags: {},
    },

    // =====================================================================
    // 3. THE TOWER - up the spiral ramp; the lobby; the atrium; the lift and THE TRUTH; the server floor; the key;
    //    the alarm; the sky garden; the last lift down.
    // =====================================================================
    {
      id: 'c10m2', title: 'c10.m2',
      setup: [
        { do: 'time', hour: 23.9, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
        ...onLoad(RUN_CAR(START, 0)),
        ...onLoad(IN_CAR),
        { do: 'tower', show: 'ramp' },
        { do: 'tower', rampCar: 'run' },
        { do: 'allow', enter: ['run'], drive: true },
        { do: 'wanted', stars: 0 },
        { do: 'cam', mode: 'chase' },
        { do: 'music', tension: 0.55 },
      ],
      steps: [
        { do: 'fade', to: 'clear', seconds: 1.2 },
        { do: 'say', who: 'lena', kind: 'radio', text: 'c10.lena.ramp' },
        { do: 'checkpoint', id: 1, setup: [{ do: 'tower', show: 'ramp' }, { do: 'tower', rampCar: 'run' }] },
        { do: 'waitFor', until: { rampAt: 0.96 }, text: 'c10.obj.ramp' },
        // the doors at the top: out of the car, into the lobby
        { do: 'allow', drive: false },
        { do: 'fade', to: 'black', seconds: 0.8 },
        { do: 'wait', seconds: 0.8 },
        { do: 'player', leaveNow: true },
        { do: 'tower', show: 'lobby' },
        { do: 'remove', ids: ['run'] },
        { do: 'player', at: tw('lobby', 0, 0, -11.4), face: 0 },
        { do: 'allow', enter: 'none', move: true },
        // THE LOBBY: two night guards with torches; a friend calls one of them away
        ...LOBBY_WATCH,
        { do: 'fade', to: 'clear', seconds: 1.0 },
        { do: 'say', who: 'dante', kind: 'radio', text: 'c10.dante.lobby', if: HELP('dante_tower') },
        { do: 'say', who: 'rask', kind: 'radio', text: 'c10.rask.lobby', if: HELP('rask_tower') },
        { do: 'checkpoint', id: 2, setup: [...ON_FOOT, { do: 'tower', show: 'lobby' }, { do: 'player', at: tw('lobby', 0, 0, -11.4), face: 0 }, ...LOBBY_WATCH] },
        { do: 'goto', at: tw('lobby', 0, 0, 6.6), radius: 1.6, text: 'c10.obj.lobby', tip: 'c10.tip.stealth', tipSeconds: 7, on: [{ spotted: true, fail: 'c10.fail.seen' }] },
        // the staff gate: Harrow's card opens it, else Lena's hack
        { do: 'say', who: 'harrow', kind: 'radio', text: 'c10.harrow.lobby', if: HELP('harrow_door') },
        { do: 'hack', title: 'c10.hack.lobby', sub: 'c10.hack.lobby_sub', seconds: 15, length: 5, if: { not: HELP('harrow_door') }, fail: [{ do: 'fail', text: 'c10.fail.hack' }] },
        { do: 'tower', door: { name: 'gate', open: true } },
        { do: 'sound', name: 'beep' },
        { do: 'goto', at: tw('lobby', 0, 0, 12.0), radius: 1.5, text: 'c10.obj.atrium_door', on: [{ spotted: true, fail: 'c10.fail.seen' }] },
        { do: 'tower', door: { name: 'atrium', open: true } },
        { do: 'police', sentries: [], stealth: false },
        { do: 'fade', to: 'black', seconds: 0.7 },
        { do: 'tower', show: 'atrium' },
        { do: 'player', at: tw('atrium', 0, 0, -9.6), face: 0 },
        { do: 'fade', to: 'clear', seconds: 1.0 },
        // THE ATRIUM: the security door to the lifts, and its terminal
        { do: 'checkpoint', id: 3, setup: [...ON_FOOT, { do: 'tower', show: 'atrium' }, { do: 'player', at: tw('atrium', 0, 0, -9.6), face: 0 }] },
        { do: 'say', who: 'lena', kind: 'radio', text: 'c10.lena.atrium' },
        { do: 'goto', at: tw('atrium', 2.9, 0, 8.6), radius: 1.2, text: 'c10.obj.terminal' },
        { do: 'hack', title: 'c10.hack.door', sub: 'c10.hack.door_sub', seconds: 16, length: 6, fail: [{ do: 'fail', text: 'c10.fail.hack' }] },
        { do: 'tower', door: { name: 'atrium', open: true } },
        { do: 'sound', name: 'heavyDoor' },
        { do: 'goto', at: tw('atrium', 0, 0, 11.9), radius: 1.2, text: 'c10.obj.lift' },
        // ---- THE LIFT, and THE TRUTH ----
        { do: 'allow', move: false },
        { do: 'fade', to: 'black', seconds: 0.6 },
        { do: 'tower', show: 'shaft' },
        { do: 'tower', view: 'walls', floor: 3, ride: 0 },
        { do: 'player', stage: { at: tw('shaft', 0.2, 0, -0.35), face: 0, pose: 'idle' }, mood: 'tired' },
        { do: 'checkpoint', id: 4, setup: [...ON_FOOT, { do: 'tower', show: 'shaft' }, { do: 'tower', view: 'walls', floor: 3, ride: 0 }, { do: 'allow', move: false }, { do: 'player', stage: { at: tw('shaft', 0.2, 0, -0.35), face: 0, pose: 'idle' }, mood: 'tired' }] },
        { do: 'music', tension: 0.2 },
        {
          do: 'cutscene', shots: [
            // the doors close; the cab starts to climb; the light strips run past faster
            { seconds: 4.0, fade: 'in', cam: { from: tw('shaft', -0.9, 1.65, 0.95), to: tw('shaft', -0.85, 1.62, 0.9), look: tw('shaft', 0.2, 1.5, -0.35), fov: 40 },
              do: [{ do: 'sound', name: 'heavyDoor' }, { do: 'tower', ride: 3 }, { do: 'player', look: tw('shaft', 0, 1.6, 2) }],
              lines: [{ at: 1.4, do: [{ do: 'tower', ride: 7, floor: 12 }] }, { at: 2.6, do: [{ do: 'tower', floor: 21 }] }] },
            { seconds: 4.2, cam: { from: tw('shaft', 0.85, 1.55, 0.6), look: { of: 'player', p: [0, 1.62, 0] }, fov: 30 },
              do: [{ do: 'tower', floor: 34 }, { do: 'player', mood: 'afraid' }, { do: 'music', heart: 64 }, { do: 'sound', name: 'breath' }],
              lines: [{ at: 1.0, who: 'lena', kind: 'radio', text: 'c10.lena.breathe', seconds: 2.4 }, { at: 3.0, do: [{ do: 'tower', floor: 47 }] }] },
            // THE TRUTH: the white comes in ...
            { seconds: 2.0, cam: { from: tw('shaft', 0.6, 1.62, 0.7), to: tw('shaft', 0.45, 1.62, 0.5), look: { of: 'player', p: [0, 1.64, 0] }, fov: 24 }, fade: 'out', fadeSeconds: 1.8,
              do: [{ do: 'fade', to: 'white', seconds: 1.8 }, { do: 'music', silence: 2.2 }] },
          ],
        },
        // ... and it is THE CRASH NIGHT, four years ago, seen through Theo's eyes: Nate at the wheel, the mixtape on,
        // the rain. In the mirror: a white KVI Phantom. "Don't slow down, Nate." Then the black one, in front.
        { do: 'tower', show: null },
        // (a memory: no Guard and no Phantom of tonight can see it - the crash at its end must not raise the stars)
        { do: 'police', sentries: [], stealth: false, real: false },
        // (the hour of the crash night in the prologue)
        { do: 'time', hour: 2.6, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
        { do: 'spawn', id: 'ride', kind: 'chrome_supercar', or: 'coupe', color: [0.6, 0.62, 0.66], at: [LN[1], 120], face: 0, arena: 'ironhill', lockExit: true },
        { do: 'actor', id: 'theo', model: 'Theo_Calloway', name: 'name.theo', seat: 'ride', mood: 'worried' },
        { do: 'player', inCar: 'ride' },
        { do: 'remove', ids: ['pkey'] },
        { do: 'spawn', id: 'phw', kind: 'tech_patrol_car', or: 'sedan', color: [1, 1, 1], at: [LN[1], 92], face: 0, arena: 'ironhill', npc: true, noDetail: true, lights: 'bar', flash: true, type: { label: 'PHANTOM' } },
        { do: 'spawn', id: 'phb', kind: 'tech_patrol_car', or: 'sedan', color: [0.02, 0.02, 0.025], tint: [0.07, 0.075, 0.085], at: [LN[0], 805], face: 0, arena: 'ironhill', npc: true, noDetail: true, lights: 'bar' },
        { do: 'memory', on: true },
        // (a memory: the faces a little lit, as by the glow of the dashboard)
        { do: 'fill', power: 0.6 },
        { do: 'flag', set: { nate_innocent_seen: true } },
        {
          do: 'cutscene', skippable: false, shots: [
            // from the passenger seat: Nate's hands on the wheel, the wipers, the wet road in the lights; the tape plays
            { seconds: 5.6, fade: 'fromWhite', cam: { from: { cabin: 'ride', at: 'pass', p: [0, 0.02, 0] }, look: { cabin: 'ride', at: 'pass', p: [-0.5, -0.08, 2.4] }, fov: 56, near: NEAR },
              do: [{ do: 'vehicleSet', id: 'ride', speed: 150, beam: 1 }, { do: 'autoDrive', gas: 0.6, brake: 0, steer: 0 }, { do: 'music', tape: 6, fromEnd: 30, hud: false, calm: 0.35 },
                { do: 'drive', id: 'phw', mode: 'shadow', gap: 14 }, { do: 'player', mood: 'smile' }] },
            // Nate, young, laughing at the road
            { seconds: 3.4, cam: { from: { cabin: 'ride', at: 'pass', p: [0.05, 0.02, 0.1] }, look: { cabin: 'ride', at: 'eye', p: [0, -0.02, 0] }, fov: 40, near: NEAR } },
            // behind them: the white car, its lights flashing, closing in (seen past the back of their car)
            { seconds: 2.4, cam: { from: { of: 'ride', p: [2.4, 1.05, -5.5] }, to: { of: 'ride', p: [2.3, 1.1, -6.2] }, look: { of: 'phw', p: [0, 0.9, 0] }, fov: 40 },
              do: [{ do: 'actorSet', id: 'theo', mood: 'afraid' }] },
            // Theo's eyes again: Nate. "Don't slow down, Nate." (they are behind us)
            { seconds: 3.0, cam: { from: { cabin: 'ride', at: 'pass', p: [0.05, 0.02, 0.1] }, look: { cabin: 'ride', at: 'eye', p: [0, -0.02, 0] }, fov: 38, near: NEAR },
              // (meanwhile, far ahead, the black one starts to swing across into their lane)
              do: [{ do: 'drive', id: 'phb', path: [[LN[0], 805], [LN[1], 850]], speed: 40 }],
              lines: [{ at: 0.3, who: 'theo', kind: 'warm', text: 'c10.theo.dont_slow', seconds: 2.4 }] },
            // and in front: the black one, slowing, across the lane - seen from the roadside ahead, black against
            // their headlights rushing at it
            { seconds: 2.6, cam: { from: [-498.6, DECK + 1.5, 872], to: [-498.4, DECK + 1.45, 867], look: [-490, DECK + 0.9, 832], fov: 40 },
              do: [{ do: 'rearView', off: true }] },
            // white
            { seconds: 1.6, cam: { from: { cabin: 'ride', at: 'pass', p: [0, 0.02, 0] }, look: { cabin: 'ride', at: 'pass', p: [-0.3, -0.1, 4] }, fov: 70, near: NEAR },
              do: [{ do: 'sound', name: 'crash' }, { do: 'fade', to: 'white', seconds: 0.25 }, { do: 'music', stop: true }] },
          ],
        },
        { do: 'autoDrive', off: true },
        { do: 'memory', on: false },
        { do: 'fill' },
        { do: 'player', leaveNow: true },
        { do: 'remove', ids: ['ride', 'theo', 'phw', 'phb'] },
        { do: 'time', hour: 23.92, rain: true },
        { do: 'wanted', stars: 0 },
        { do: 'tower', show: 'shaft' },
        { do: 'tower', view: 'city', floor: 58, ride: 2 },
        { do: 'player', stage: { at: tw('shaft', 0.2, 0, -0.35), face: 0, pose: 'idle' }, mood: 'sad' },
        {
          do: 'cutscene', shots: [
            // the present: the lift; the city far below through the glass; Nate breathing
            { seconds: 5.0, fade: 'fromWhite', cam: { from: tw('shaft', 0.7, 1.6, 0.85), to: tw('shaft', 0.6, 1.62, 0.75), look: { of: 'player', p: [0, 1.6, 0] }, fov: 28 },
              do: [{ do: 'music', heart: 52, calm: 0.3 }] },
            // Theo's voice, from nowhere: it was never you. Nate says nothing.
            { seconds: 4.6, cam: { from: tw('shaft', 0.55, 1.62, 0.55), look: { of: 'player', p: [0, 1.64, 0] }, fov: 22 },
              lines: [{ at: 1.2, who: 'theo', kind: 'warm', text: 'c10.theo.never_you', seconds: 2.8 }] },
            // (Chapter 8 gave him a little peace: he nods, slowly. Else he closes his eyes.)
            { seconds: 4.0, if: { flag: 'nate_partial_peace' }, cam: { from: tw('shaft', 0.5, 1.6, 0.5), look: { of: 'player', p: [0, 1.62, 0] }, fov: 22 },
              do: [{ do: 'player', mood: 'sad', look: tw('shaft', 0, 1.2, 2) }] },
            { seconds: 4.0, if: { not: { flag: 'nate_partial_peace' } }, cam: { from: tw('shaft', 0.5, 1.6, 0.5), look: { of: 'player', p: [0, 1.62, 0] }, fov: 22 },
              do: [{ do: 'player', mood: 'asleep' }] },
            { seconds: 3.2, cam: { from: tw('shaft', -0.9, 1.65, 0.95), look: tw('shaft', 0.2, 1.4, -0.35), fov: 42 },
              do: [{ do: 'tower', floor: 88, ride: 0 }, { do: 'sound', name: 'chime' }, { do: 'music', heart: 0, calm: 0, tension: 0.4 }] },
          ],
        },
        // ---- THE SERVER FLOOR ----
        { do: 'fade', to: 'black', seconds: 0.6 },
        { do: 'tower', show: 'server' },
        { do: 'player', at: tw('server', -15.4, 0, -11.2), face: 320 },
        { do: 'allow', enter: 'none', move: true },
        ...SERVER_WATCH,
        { do: 'fade', to: 'clear', seconds: 1.0 },
        { do: 'checkpoint', id: 5, setup: [...ON_FOOT, { do: 'tower', show: 'server' }, { do: 'tower', alarm: false }, { do: 'player', at: tw('server', -15.4, 0, -11.2), face: 320 }, ...SERVER_WATCH] },
        { do: 'say', who: 'lena', kind: 'radio', text: 'c10.lena.server' },
        { do: 'tip', text: 'c10.tip.juno', seconds: 6, if: HELP('juno_roof') },
        { do: 'goto', at: tw('server', 0, 0, 6.3), radius: 1.2, text: 'c10.obj.core', on: [{ spotted: true, fail: 'c10.fail.seen' }] },
        // THE KEY: the pilot key into the core; Lena copies the master key of the Grid
        { do: 'police', sentries: [], stealth: false },
        { do: 'hack', title: 'c10.hack.key', sub: 'c10.hack.key_sub', seconds: 18, length: 6, fail: [{ do: 'fail', text: 'c10.fail.hack' }] },
        {
          do: 'cutscene', shots: [
            { seconds: 3.6, cam: { from: tw('server', 1.6, 1.7, 5.0), look: tw('server', 0, 1.5, 8.6), fov: 38 },
              lines: [{ at: 0.4, who: 'lena', kind: 'radio', text: 'c10.lena.copying', seconds: 2.4 }] },
            // THE ALARM: red light, the voice of the building - all Phantoms are let loose
            { seconds: 4.2, cam: { from: tw('server', -6, 3.4, -2), look: tw('server', 0, 1.2, 6), fov: 52 },
              do: [{ do: 'tower', alarm: true }, { do: 'sound', name: 'scan' }, { do: 'music', tension: 0.9 }],
              lines: [{ at: 0.6, who: 'pa', kind: 'tv', text: 'c10.pa.release', seconds: 3.0 }] },
            { seconds: 2.8, cam: { from: { of: 'player', p: [0.4, 1.7, 1.3] }, look: { of: 'player', p: [0, 1.6, 0] }, fov: 34 },
              do: [{ do: 'player', mood: 'afraid' }],
              lines: [{ at: 0.3, who: 'lena', kind: 'radio', text: 'c10.lena.run', seconds: 2.2 }] },
          ],
        },
        { do: 'checkpoint', id: 6, setup: [...ON_FOOT, { do: 'tower', show: 'server' }, { do: 'tower', alarm: true }, { do: 'player', at: tw('server', 0, 0, 6.3), face: 90 }] },
        { do: 'goto', at: tw('server', 17.4, 0, 0), radius: 1.4, text: 'c10.obj.terrace_door' },
        // ---- THE SKY GARDEN: the rain, the city far below, a KVI drone sweeping the terrace ----
        { do: 'fade', to: 'black', seconds: 0.5 },
        { do: 'tower', show: 'terrace' },
        { do: 'player', at: tw('terrace', 14.8, 0, 0), face: 90 },
        ...TERRACE_WATCH,
        { do: 'fade', to: 'clear', seconds: 0.8 },
        { do: 'checkpoint', id: 7, setup: [...ON_FOOT, { do: 'tower', show: 'terrace' }, { do: 'player', at: tw('terrace', 14.8, 0, 0), face: 90 }, ...TERRACE_WATCH] },
        { do: 'goto', at: tw('terrace', -14.9, 0, 1.5), radius: 1.3, text: 'c10.obj.service_lift', tip: 'c10.tip.drone', tipSeconds: 6, on: [{ spotted: true, fail: 'c10.fail.seen' }] },
        { do: 'police', sentries: [], stealth: false, real: false },
        // THE LAST LIFT DOWN: glass, the city coming up to meet him
        { do: 'allow', move: false },
        { do: 'fade', to: 'black', seconds: 0.5 },
        { do: 'tower', show: 'shaft' },
        { do: 'tower', view: 'city', floor: 61, ride: -9 },
        { do: 'player', stage: { at: tw('shaft', 0.2, 0, -0.35), face: 0, pose: 'idle' }, mood: 'stern' },
        {
          do: 'cutscene', shots: [
            { seconds: 4.4, fade: 'in', cam: { from: tw('shaft', 0.9, 1.4, 1.0), look: tw('shaft', -0.4, 1.7, -0.8), fov: 46 },
              lines: [{ at: 0.6, who: 'mace', kind: 'radio', text: 'c10.mace.down', seconds: 2.6, if: HELP('mace_car') },
                { at: 0.6, who: 'lena', kind: 'radio', text: 'c10.lena.down', seconds: 2.6, if: { not: HELP('mace_car') } },
                { at: 2.6, do: [{ do: 'tower', floor: 30 }] }] },
            { seconds: 2.6, cam: { from: tw('shaft', -0.9, 1.65, 0.95), look: tw('shaft', 0.2, 1.4, -0.35), fov: 42 }, fade: 'out', fadeSeconds: 1.8,
              do: [{ do: 'tower', floor: 1 }] },
          ],
        },
        { do: 'tower', show: null, ride: 0 },
      ],
      flags: { nate_innocent_seen: true },
    },

    // =====================================================================
    // 4. ALL PHANTOMS - the key is taken. Every Phantom in the city is let loose. Keep moving while Lena builds the
    //    switch: The Crown, The Grid, Neon Mile, Ironhill Highway. Friends help on the way. Zero steps in.
    // =====================================================================
    {
      id: 'c10m3', title: 'c10.m3',
      setup: [
        { do: 'time', hour: 23.95, rain: true },
        { do: 'world', traffic: 4, people: 0, indoors: false, now: true },
        ...RUN_CAR(OUT, 180),
        ...IN_CAR,
        { do: 'prop', id: 'gate', kind: 'bridgeGate', width: 13.2, at: [GATE[0], 0, GATE[1]], face: 180 },
        { do: 'cam', mode: 'chase' },
        { do: 'news', text: 'c10.news.phantoms' },
        { do: 'sound', name: 'heli', level: 0.7 },
        ...LOOSE,
      ],
      on: [
        // caught on the highway: he slowed right down with a Phantom on him
        { event: 'run:caught', fail: 'c10.fail.caught' },
        // Zero's move: the nearest Phantom spins into the wall
        { event: 'run:blocked', do: [{ do: 'music', tension: 0.5 }] },
      ],
      steps: [
        { do: 'music', tension: 0.95 },
        {
          do: 'cutscene', shots: [
            // out through the gate, into the rain; over The Crown the white lights of the Phantoms come on, one by one
            { seconds: 4.6, fade: 'in', cam: { from: [OUT[0] - 6, 3.2, OUT[1] - 26], to: [OUT[0] - 5, 3.0, OUT[1] - 22], look: { of: 'run', p: [0, 1.0, 0] }, fov: 46 },
              do: [{ do: 'vehicleSet', id: 'run', speed: 40 }, { do: 'autoDrive', gas: 0.6, brake: 0, steer: 0 }],
              lines: [{ at: 0.8, who: 'lena', kind: 'radio', text: 'c10.lena.loose', seconds: 3.4 }],
              end: [{ do: 'autoDrive', off: true }] },
          ],
        },
        { do: 'checkpoint', id: 1, setup: [{ do: 'police', stars: 4, seen: true, if: NORMAL }, { do: 'police', stars: 3, seen: true, if: EASY }] },
        { do: 'driveTo', at: GRID_A, radius: 26, text: 'c10.obj.grid', tip: 'c10.tip.chase', tipSeconds: 7,
          on: [{ time: 14, do: [{ do: 'say', who: 'harrow', kind: 'radio', text: 'c10.harrow.block', if: HAS.harrow }, { do: 'police', clearRoadblock: 45, if: HAS.harrow }] }] },
        { do: 'checkpoint', id: 2, setup: [{ do: 'vehicleSet', id: 'run', place: GRID_A, face: 180, stop: true }, { do: 'police', stars: 4, seen: true, if: NORMAL }, { do: 'police', stars: 3, seen: true, if: EASY }] },
        { do: 'driveTo', at: GRID_B, radius: 26, text: 'c10.obj.grid2',
          on: [{ time: 10, do: [{ do: 'say', who: 'dante', kind: 'radio', text: 'c10.dante.block', if: HELP('dante_street') }, { do: 'police', lose: 3, calm: 9, if: HELP('dante_street') },
            // (two Chrome Wolves cars swing across the street behind him)
            { do: 'spawn', id: 'wolf1', kind: 'coupe', at: { of: 'run', p: [-2.6, 0, -30] }, face: 90, color: [0.1, 0.1, 0.11], npc: true, simple: true, lights: 'normal', if: HELP('dante_street') },
            { do: 'spawn', id: 'wolf2', kind: 'coupe', at: { of: 'run', p: [2.6, 0, -34] }, face: 270, color: [0.16, 0.16, 0.18], npc: true, simple: true, lights: 'normal', if: HELP('dante_street') },
            { do: 'sound', name: 'honkTwice', if: HELP('dante_street') }] }] },
        { do: 'remove', ids: ['wolf1', 'wolf2'] },
        { do: 'checkpoint', id: 3, setup: [{ do: 'vehicleSet', id: 'run', place: GRID_B, face: 180, stop: true }, { do: 'police', stars: 4, seen: true, if: NORMAL }, { do: 'police', stars: 3, seen: true, if: EASY }] },
        { do: 'driveTo', at: NEON, radius: 26, text: 'c10.obj.neon',
          on: [{ time: 12, do: [{ do: 'say', who: 'rask', kind: 'radio', text: 'c10.rask.container', if: HELP('rask_street') }, { do: 'police', lose: 2, calm: 8, if: HELP('rask_street') },
            // (a container falls into the street behind him, from a crane of the docks)
            { do: 'prop', id: 'box', kind: 'container', at: { of: 'run', p: [0, 0, -26] }, face: 80, drop: 16, if: HELP('rask_street') }] }] },
        { do: 'remove', ids: ['box'] },
        { do: 'checkpoint', id: 4, setup: [{ do: 'vehicleSet', id: 'run', place: NEON, face: 90, stop: true }, { do: 'police', stars: 4, seen: true, if: NORMAL }, { do: 'police', stars: 3, seen: true, if: EASY }] },
        { do: 'driveTo', at: RAMP_FOOT, radius: 18, text: 'c10.obj.ramp_up' },
        // up the ramp (a cut): the city's Phantoms stay below; two follow him onto the highway
        { do: 'police', stars: 0, real: false, phantom: false },
        { do: 'sound', name: 'heli', level: 0 },
        { do: 'allow', drive: false },
        { do: 'fade', to: 'black', seconds: 0.5 },
        { do: 'vehicleSet', id: 'run', place: [LN[1], -150], face: 0, arena: 'ironhill', speed: 120 },
        { do: 'run', start: true },
        { do: 'run', autoRewind: { at: 1385, to: 60 } },
        { do: 'run', phantoms: 2, back: 70, if: NORMAL },
        { do: 'run', phantoms: 1, back: 80, if: EASY },
        { do: 'run', drones: 2 },
        { do: 'allow', drive: true },
        { do: 'fade', to: 'clear', seconds: 0.6 },
        { do: 'checkpoint', id: 5, setup: [{ do: 'vehicleSet', id: 'run', place: [LN[1], -150], face: 0, arena: 'ironhill', speed: 120 }, { do: 'run', start: true }, { do: 'run', autoRewind: { at: 1385, to: 60 } },
          { do: 'run', phantoms: 2, back: 70, if: NORMAL }, { do: 'run', phantoms: 1, back: 80, if: EASY }, { do: 'run', drones: 2 }] },
        { do: 'say', who: 'lena', kind: 'radio', text: 'c10.lena.highway' },
        { do: 'waitFor', until: { time: 9 }, text: 'c10.obj.highway' },
        // ZERO: out of the dark behind him; it drops between him and the Phantoms; then one quiet touch
        { do: 'run', zero: 'appear' },
        { do: 'music', zero: 0.6 },
        { do: 'waitFor', event: 'run:zeroHere', text: 'c10.obj.highway' },
        { do: 'run', zero: 'guard' },
        { do: 'say', who: 'lena', kind: 'radio', text: 'c10.lena.zero' },
        { do: 'waitFor', until: { time: 6 }, text: 'c10.obj.highway' },
        { do: 'run', zero: 'block' },
        { do: 'waitFor', event: 'run:blocked', text: 'c10.obj.highway', timeout: 20 },
        {
          do: 'cutscene', shots: [
            // Zero beside him for a moment, between him and what is left behind
            { seconds: 4.0, cam: { from: { of: 'run', p: [-3.4, 2.0, -7] }, look: { of: 'run', p: [2.2, 1.0, 6] }, fov: 48 },
              do: [{ do: 'run', zero: 'cruise' }, { do: 'run', cruise: { lane: 1, speed: 130 / 3.6 } }, { do: 'run', phantoms: 0 }],
              lines: [{ at: 0.6, who: 'lena', kind: 'radio', text: 'c10.lena.ready', seconds: 3.0 }] },
            { seconds: 4.2, cam: { from: { cabin: 'run', at: 'pass', p: [0, 0.04, 0] }, look: { of: 'zero', p: [0, 0.9, 0] }, fov: 44, near: NEAR },
              lines: [{ at: 0.4, who: 'lena', kind: 'radio', text: 'c10.lena.top', seconds: 3.2 }] },
            { seconds: 3.0, cam: { from: { of: 'run', p: [0, 6, -18] }, look: { of: 'run', p: [0, 1, 30] }, fov: 50 }, fade: 'out', fadeSeconds: 2.4 },
          ],
        },
        { do: 'run', stop: true },
        { do: 'music', zero: 0, tension: 0 },
        { do: 'news', text: null },
      ],
      flags: {},
    },

    // =====================================================================
    // 5. THE GLASS ROOM - the top floor. Rain on the windows, a long table, Vance in his new body. No guards, no
    //    fight. Then the switch, and the last choice: LET GO or KEEP HIM.
    // =====================================================================
    {
      id: 'c10m4', title: 'c10.m4',
      setup: [
        { do: 'time', hour: 23.98, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'wanted', stars: 0 },
        { do: 'tower', show: 'shaft' },
        { do: 'tower', view: 'city', floor: 96, ride: 4 },
        { do: 'player', stage: { at: tw('shaft', 0.2, 0, -0.35), face: 0, pose: 'idle' }, mood: 'stern' },
        { do: 'allow', enter: 'none', move: false },
      ],
      steps: [
        {
          do: 'cutscene', shots: [
            // the last lift up: quiet; the city far below in the rain
            { seconds: 4.6, fade: 'in', cam: { from: tw('shaft', 0.85, 1.5, 0.95), look: tw('shaft', -0.9, 1.9, -1.4), fov: 46 },
              do: [{ do: 'music', silence: 1.0 }],
              lines: [{ at: 1.0, who: 'lena', kind: 'radio', text: 'c10.lena.alone', seconds: 3.0 }, { at: 3.4, do: [{ do: 'tower', floor: 118 }] }] },
            { seconds: 2.8, cam: { from: tw('shaft', -0.9, 1.65, 0.95), look: tw('shaft', 0.2, 1.4, -0.35), fov: 42 }, fade: 'out', fadeSeconds: 1.2,
              do: [{ do: 'tower', floor: 120, ride: 0 }, { do: 'sound', name: 'chime' }] },
          ],
        },
        // ---- THE GLASS ROOM ----
        { do: 'tower', show: 'glass' },
        { do: 'player', stage: { at: tw('glass', 0, 0, -6.6), face: 0, pose: 'idle' }, mood: 'stern' },
        { do: 'actor', id: 'vance', model: 'Adrian_Vance', name: 'name.vance', at: tw('glass', 1.2, 0, 6.6), face: 0, pose: 'idle', fixed: true, look: null, mood: 'neutral' },
        { do: 'checkpoint', id: 1, setup: [{ do: 'tower', show: 'glass' }, { do: 'player', stage: { at: tw('glass', 0, 0, -6.6), face: 0, pose: 'idle' } },
          { do: 'actor', id: 'vance', model: 'Adrian_Vance', name: 'name.vance', at: tw('glass', 1.2, 0, 6.6), face: 0, pose: 'idle', fixed: true, look: null, mood: 'neutral' }] },
        {
          do: 'cutscene', keep: true, shots: [
            // the long room; a man at the far window, his back to the door; rain on the glass
            { seconds: 5.4, fade: 'in', cam: { from: tw('glass', -0.6, 1.66, -7.2), to: tw('glass', -0.5, 1.64, -6.8), look: tw('glass', 1.0, 1.5, 6.4), fov: 44 },
              do: [{ do: 'music', calm: 0.2 }] },
            // he practises his handshake once, to nobody: the hand, the small phrase
            { seconds: 4.4, cam: { from: { of: 'vance', p: [0.9, 1.4, 1.6] }, look: { of: 'vance', p: [0, 1.25, 0.3] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'vance', pose: 'give' }],
              lines: [{ at: 1.2, who: 'vance', text: 'c10.vance.safety', mood: 'smile', seconds: 2.0 }],
              end: [{ do: 'actorSet', id: 'vance', pose: 'idle' }] },
            // he turns
            { seconds: 3.6, cam: { from: { of: 'player', p: [-0.35, 1.7, -0.5] }, look: { of: 'vance', p: [0, 1.6, 0] }, fov: 34 },
              do: [{ do: 'actorSet', id: 'vance', face: 180, look: 'player' }],
              lines: [{ at: 1.2, who: 'vance', text: 'c10.vance.nate', mood: 'neutral', seconds: 1.4 }] },
            { seconds: 3.4, cam: { from: { of: 'vance', p: [0.3, 1.62, 1.2] }, look: { of: 'vance', p: [0, 1.6, 0] }, fov: 28 },
              lines: [{ at: 0.6, who: 'lena', kind: 'radio', text: 'c10.lena.body', seconds: 2.6 }] },
            // the gala (Chapter 7): the old man at the bar was him
            { seconds: 4.2, if: { any: [{ flag: 'vance_bar_a' }, { flag: 'vance_bar_b' }] }, cam: { from: { of: 'vance', p: [0.25, 1.64, 1.05] }, look: { of: 'vance', p: [0, 1.62, 0] }, fov: 26 },
              lines: [{ at: 0.6, who: 'vance', text: 'c10.vance.bar', mood: 'smile', seconds: 3.0 }] },
            { seconds: 5.4, cam: { from: { of: 'player', p: [-0.4, 1.68, -0.55] }, look: { of: 'vance', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.6, who: 'vance', text: 'c10.vance.slow', mood: 'neutral', seconds: 4.2 }] },
          ],
        },
        // what Nate does with that
        { do: 'choice', options: [
          { text: 'c10.ch.crash', set: { vance_response: 'crash' } },
          { text: 'c10.ch.mind', set: { vance_response: 'mind' } },
          { text: 'c10.ch.silent', set: { vance_response: 'silent' } },
        ] },
        {
          do: 'cutscene', keep: true, shots: [
            { seconds: 2.8, if: { flag: 'vance_response', is: 'crash' }, cam: { from: { of: 'vance', p: [-0.4, 1.68, -0.55] }, look: { of: 'player', p: [0, 1.62, 0] }, fov: 30 },
              lines: [{ at: 0.3, who: 'nate', text: 'c10.ch.crash', mood: 'stern', seconds: 2.2 }] },
            { seconds: 5.0, if: { flag: 'vance_response', is: 'crash' }, cam: { from: { of: 'vance', p: [0.25, 1.64, 1.05] }, look: { of: 'vance', p: [0, 1.62, 0] }, fov: 26 },
              lines: [{ at: 0.4, who: 'vance', text: 'c10.vance.crash', mood: 'neutral', seconds: 4.2 }] },
            { seconds: 2.8, if: { flag: 'vance_response', is: 'mind' }, cam: { from: { of: 'vance', p: [-0.4, 1.68, -0.55] }, look: { of: 'player', p: [0, 1.62, 0] }, fov: 30 },
              lines: [{ at: 0.3, who: 'nate', text: 'c10.ch.mind', mood: 'stern', seconds: 2.2 }] },
            { seconds: 5.0, if: { flag: 'vance_response', is: 'mind' }, cam: { from: { of: 'vance', p: [0.25, 1.64, 1.05] }, look: { of: 'vance', p: [0, 1.62, 0] }, fov: 26 },
              lines: [{ at: 0.4, who: 'vance', text: 'c10.vance.mind', mood: 'smile', seconds: 4.2 }] },
            // silence: he lets it stand, then speaks into it
            { seconds: 4.4, if: { flag: 'vance_response', is: 'silent' }, cam: { from: { of: 'vance', p: [0.25, 1.64, 1.05] }, look: { of: 'vance', p: [0, 1.62, 0] }, fov: 26 },
              do: [{ do: 'music', silence: 2.4 }],
              lines: [{ at: 2.6, who: 'vance', text: 'c10.vance.silent', mood: 'neutral', seconds: 1.8 }] },
            // THE OFFER: the console at the end of the table
            { seconds: 5.2, cam: { from: tw('glass', 2.6, 1.7, -2.4), look: tw('glass', -6.1, 1.1, 1), fov: 40 },
              do: [{ do: 'actorSet', id: 'vance', look: tw('glass', -6.1, 1.1, 1) }],
              lines: [{ at: 0.6, who: 'vance', text: 'c10.vance.offer', mood: 'neutral', seconds: 4.0 }] },
            // LENA, in his ear: the switch
            { seconds: 3.8, cam: { from: { of: 'player', p: [0.35, 1.66, 0.9] }, look: { of: 'player', p: [0, 1.62, 0] }, fov: 28 },
              lines: [{ at: 0.4, who: 'lena', kind: 'radio', text: 'c10.lena.switch', seconds: 3.2 }] },
            { seconds: 3.4, cam: { from: { of: 'player', p: [0.3, 1.64, 0.8] }, look: { of: 'player', p: [0, 1.62, 0] }, fov: 24 },
              lines: [{ at: 0.3, who: 'lena', kind: 'radio', text: 'c10.lena.zero_too', seconds: 2.8 }] },
            { seconds: 3.2, cam: { from: tw('glass', -4.6, 1.5, -0.2), look: tw('glass', -6.1, 1.05, 1), fov: 34 },
              lines: [{ at: 0.3, who: 'lena', kind: 'radio', text: 'c10.lena.only_you', seconds: 2.6 }] },
          ],
        },
        // he walks to the console; the room holds still
        // (face is a compass bearing, as everywhere in the story: 0 = north (+z), 90 = east (-x) - the console is east of him)
        { do: 'player', stage: { at: tw('glass', -5.45, 0, 1), face: 90, pose: 'idle' }, mood: 'sad', look: tw('glass', -6.1, 1.05, 1) },
        { do: 'actorSet', id: 'vance', at: tw('glass', 5.6, 0, 1), face: 90, look: 'player' },
        { do: 'checkpoint', id: 2, setup: [{ do: 'tower', show: 'glass' }, { do: 'player', stage: { at: tw('glass', -5.45, 0, 1), face: 90, pose: 'idle' }, mood: 'sad' },
          { do: 'actor', id: 'vance', model: 'Adrian_Vance', name: 'name.vance', at: tw('glass', 5.6, 0, 1), face: 90, pose: 'idle', fixed: true, look: 'player', mood: 'neutral' }] },
        // THE DECISION: the world stops. Only the rain and a heartbeat. A long silence before the two buttons.
        { do: 'music', stop: true },
        { do: 'music', calm: 0, tension: 0, silence: 2.0 },
        {
          do: 'cutscene', keep: true, skippable: false, shots: [
            { seconds: 5.5, cam: { from: tw('glass', -3.2, 1.55, 3.4), to: tw('glass', -3.5, 1.56, 3.0), look: { of: 'player', p: [0, 1.5, 0] }, fov: 36 },
              lines: [{ at: 1.5, do: [{ do: 'music', heart: 46 }] }] },
            { seconds: 4.0, hold: true, cam: { from: tw('glass', -7.6, 1.45, 2.3), look: tw('glass', -5.4, 1.35, 0.95), fov: 38 } },
          ],
        },
        { do: 'choice', layout: 'final', options: [
          { text: 'c10.choice.let_go', set: { final_choice: 'let_go' } },
          { text: 'c10.choice.keep_him', set: { final_choice: 'keep_him' } },
        ] },
        { do: 'music', heart: 0 },
        { do: 'remove', ids: ['vance'] },
        { do: 'tower', show: null },
        // the ending that was chosen (src/story/endings.js)
        { do: 'chapter', id: 'endings', mission: 0, if: { flag: 'final_choice', is: 'let_go' } },
        { do: 'chapter', id: 'endings', mission: 1, if: { flag: 'final_choice', is: 'keep_him' } },
      ],
      flags: { vance_response: 'silent' },
    },
  ],
};
