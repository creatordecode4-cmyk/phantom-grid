// ---------------------------------------------------------------------------
// CHAPTER 9 - "HARROW'S LINE" (the night after Chapter 8)
//
// This file is ONLY DATA, written like chapter08.js. The story engine (src/story/engine.js) explains every word used
// here at its top; the new steps of this chapter are "convoy" and "convoyGoal" (the Guard prison convoy on Ironhill
// Highway: the truck with Dante in it, two escorts, a tech car, a drone, the bridge gate - src/story/convoy.js) and
// "forget" (a rule may then fire again). The things of the chapter (the bridge gate, the roadblock, the flares, the
// truck's back doors, Mila's core, the old machine, the desk phone, the master card, the Phantom list) are
// src/story/propsHarrow.js. All texts are keys of src/story/strings.js.
//
// The night in one line: a stopped watch on an old man's wrist, a road he says is safe, a convoy in the rain, a trap,
// a captain who finds her own name on a list, a door that opens, a small machine that says hello, and a TV.
//
// TONE: tense, then quiet. Short plain lines. Nobody gives speeches. Feelings through objects: Rask's stopped watch,
// Harrow's daughter's drawing.
//
// It uses what earlier chapters left behind:
//   rask_stance ('paid': Rask is friendly and sure of himself; 'honest': stiff and brief), mace_forgiven (true: Mace
//   offers to drive the second van; 'neutral': he offers quietly; false: Lena says Mace is not an option),
//   harrow_let_girl_go (a Tidewalker child waves from a roof), jacket_taken (false: Dante still wears Theo's jacket;
//   true: an old Chrome Wolves jacket), dante_captured.
// It leaves for later chapters:
//   trusted_rask (true | false), support_driver ('mace' | 'none'), ambush_style ('gentle' | 'ram' | 'hack'),
//   rask_betrayed_nate, harrow_reply ('silent' | 'thanks' | 'notforme'), harrow_switched, harrow_access_card,
//   rask_redeemed, ascend_announced
//
// Places: [x, z] on the ground (on the highway: on its deck), [x, y, z], { safe: [x, y, z] } (Lena's room),
// { of: 'car or person', p: [left, up, forward] }, { cabin: 'car', at, p }, { roof: [x, z], up }.
// Compass degrees: 0 north, 90 east, 180 south, 270 west. On the map +x is west and -x is east.
// The highway: northbound lanes at x -487.1 (inside), -491.25, -495.4 (by the east wall); southbound lanes at
// x -482.9 (inside), -478.75, -474.6 (by the west wall). The deck is 8 m up; the ramp from the city comes up from
// z -376; the Ironhill tunnel is z 1000 .. 1320; the road ends at z 1470.
// THE CONVOY goes NORTH, away from the city (the camera looks along the long dark road and the tunnel, not at the
// towers: cheap for a phone).
// ---------------------------------------------------------------------------

const NEAR = 0.05;
const NIGHT = { do: 'time', hour: 2.8, rain: true };
const LATE = { do: 'time', hour: 4.2, rain: true };
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));
const LN = [-487.1, -491.25, -495.4];          // northbound lanes (inside .. by the wall)
const LS = [-482.9, -478.75, -474.6];          // southbound lanes
const AMBUSH = [-480.6, 640];                  // where the van waits, lights off, on the southbound side
const GATE_Z = 985;                            // the Guard's bridge gate, just before the tunnel
const TRAP_Z = 560;                            // where the trap closes (the stopped truck is put here at the cut)
const T = (z) => TRAP_Z + z;

// ---- Lena's safehouse (src/story/safehouseSet.js: x to the right of the window, y up, z toward the door) ----
const s = (x, y, z) => ({ safe: [x, y, z] });
const SAFE = {
  nate: [0.45, 1.05],
  lena: s(1.2, 0.5, -1.2), laptop: s(1.22, 0.765, -1.98), table: s(1.0, 0.765, -1.75),
  chair: s(2.25, 0.5, -1.05),       // Dante's chair (empty at the start; he sits in it at the end)
  tv: s(-2.88, 0.82, -0.2),
  rask: s(1.6, 0, 1.75),            // just inside the door, still wet from the rain
  mace: s(-1.9, 0, -1.85),          // by the window, his back to the wall
};
const LENA = (more = {}) => ({ do: 'actor', id: 'lena', model: 'Lena_Marchetti', name: 'name.lena', at: SAFE.lena, face: 180, pose: 'sit', floorBelow: 0.5, fixed: true, mood: 'stern', look: SAFE.laptop, ...more });
// VIKTOR RASK, with the child's watch that stopped at 4:12 on his left wrist (worn right at the wrist joint: a little
// further up the arm it disappears under the knit cuff of his sweater)
const RASK_SAFE = [
  { do: 'actor', id: 'rask', model: 'Viktor_Rask', name: 'name.rask', at: SAFE.rask, face: 172, pose: 'hold', fixed: true, look: null, mood: 'stern' },
  { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_L', p: [0, 0.004, 0], wrist: true, band: 1.4 },
];
const MACE = (at, face, more = {}) => ({ do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at, face, pose: 'crossed', fixed: true, look: null, mood: 'tired', ...more });
// (Mace is here when he was forgiven, or when Nate stayed silent; 'neutral' = the quiet offer)
const MACE_HERE = { flag: 'mace_forgiven' };
const MACE_QUIET = { flag: 'mace_forgiven', is: 'neutral' };
const MACE_FULL = { all: [MACE_HERE, { not: MACE_QUIET }] };
const PAID = { flag: 'rask_stance', is: 'paid' };
const TRUSTED = { flag: 'trusted_rask' };
const WITH_MACE = { flag: 'support_driver', is: 'mace' };

// ---- the van (as in the earlier chapters: its color and its plate stay) ----
const PAINTS = [
  { name: 'c2.paint.blue', color: [0.12, 0.16, 0.25] },
  { name: 'c2.paint.red', color: [0.43, 0.15, 0.1] },
  { name: 'c2.paint.green', color: [0.21, 0.28, 0.2] },
  { name: 'c2.paint.grey', color: [0.37, 0.38, 0.39] },
];
const VAN = (at, face, more = {}) => [
  { do: 'spawn', id: 'van', kind: 'van', at, face, color: [0.74, 0.72, 0.66], paints: PAINTS, paintFlag: 'van_color', arena: 'ironhill', enter: true, lockExit: true, limit: 0, detail: true,
    type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 }, ...more },
  { do: 'prop', id: 'plate', kind: 'plate', text: 'PM 4471', textFlag: 'van_plate', in: 'van', at: { cabinAt: 'back', p: [0, 0, -0.03] }, rot: [0, Math.PI, 0], replace: true },
];
const IN_VAN = [{ do: 'player', inCar: 'van' }, { do: 'allow', enter: ['van'], move: true, drive: true }];

// ---- THE CONVOY (Meridian Guard white; the truck dark steel). Going north. ----
const GUARD_WHITE = [0.85, 0.86, 0.9];
const CONVOY = (z, speed = 94) => [
  { do: 'spawn', id: 'truck', kind: 'armored_van', or: 'small_city_car', at: [LN[1], z], face: 0, scale: 1.18, tint: [0.2, 0.23, 0.26], npc: true, arena: 'ironhill', speed, noDetail: true,
    type: { label: 'GUARD PRISON TRUCK', role: 'car' }, cargo: { kind: 'inside', label: 'DANTE' } },
  { do: 'spawn', id: 'lead', kind: 'tech_patrol_car', or: 'sedan', at: [LN[1], z + 34], face: 0, color: GUARD_WHITE, npc: true, arena: 'ironhill', speed, noDetail: true, type: { label: 'GUARD TECH CAR' } },
  { do: 'spawn', id: 'esc1', kind: 'police_coupe', or: 'sedan', at: [LN[0], z - 11], face: 0, color: GUARD_WHITE, npc: true, arena: 'ironhill', speed, noDetail: true },
  { do: 'spawn', id: 'esc2', kind: 'police_coupe', or: 'sedan', at: [LN[2], z - 11], face: 0, color: GUARD_WHITE, npc: true, arena: 'ironhill', speed, noDetail: true },
];
const CONVOY_START = (more = {}) => ({ do: 'convoy', start: { truck: 'truck', escorts: ['esc1', 'esc2'], lead: 'lead', gate: GATE_Z, support: WITH_MACE, dir: 1, ...more } });
// (when the truck comes out of the tunnel: a dip to black, and the chase is back on the long straight)
const LOOP = { do: 'convoy', autoRewind: { at: 1335, to: 360 } };

// ---- the trap: where everybody stands when it closes (the truck at TRAP_Z, facing north) ----
const KVI_PHANTOM = (id, at, face, more = {}) => ({ do: 'spawn', id, kind: 'tech_patrol_car', or: 'sedan', at, face, color: [1, 1, 1], npc: true, arena: 'ironhill', noDetail: true,
  lights: 'bar', flash: true, type: { label: 'PHANTOM' }, ...more });
const TRAP_PLACES = [
  { do: 'vehicleSet', id: 'truck', place: [LN[0], T(0)], face: 0, stop: true },
  { do: 'vehicleSet', id: 'van', place: [LN[0], T(11.5)], face: 0, stop: true, lights: 'normal' },
  { do: 'vehicleSet', id: 'maceVan', place: [LN[1] - 0.3, T(9)], face: 355, stop: true },
  { do: 'remove', ids: ['esc1', 'esc2', 'lead'] },
];
// (people on the highway are placed with the deck's height, 8 m: a place of only [x, z] would put them on the city's
//  ground under the deck)
const DECK = 8;
const NATE_SPOT = [-486.4, DECK, T(6.2)];      // between the truck's nose and the van, facing west (compass 270)
const HARROW_SPOT = [-484.55, DECK, T(6.0)];   // just outside her open door (her car is across the middle line), facing him
// cameras of the face-off, from the two of them (Nate faces west, Harrow east: his right is north, hers south)
const OVER_NATE = { from: { of: 'player', p: [-0.42, 1.72, -0.6] }, look: { of: 'harrow', p: [0, 1.6, 0] }, fov: 30 };
const OVER_HARROW = { from: { of: 'harrow', p: [-0.42, 1.68, -0.6] }, look: { of: 'player', p: [0, 1.62, 0] }, fov: 30 };
const HARROW_FACE = { from: { of: 'harrow', p: [0.22, 1.64, 1.05] }, look: { of: 'harrow', p: [0, 1.6, 0] }, fov: 28 };
// THE KVI PHANTOMS close in: two from behind, one beyond the roadblock
const PHANTOMS_IN = [
  KVI_PHANTOM('ph1', [LN[0], T(-170)], 0, { speed: 110 }),
  KVI_PHANTOM('ph2', [LN[2], T(-195)], 0, { speed: 110 }),
  { do: 'drive', id: 'ph1', path: [[LN[0], T(-170)], [LN[0] + 0.4, T(-60)], [LN[0] + 0.6, T(-24)]], speed: 95, end: 'stop' },
  { do: 'drive', id: 'ph2', path: [[LN[2], T(-195)], [LN[2] + 0.5, T(-70)], [LN[2] + 0.8, T(-19)]], speed: 95, end: 'stop' },
];
const PHANTOM_AHEAD = [
  KVI_PHANTOM('ph3', [LN[1], T(210)], 180, { speed: 95 }),
  { do: 'drive', id: 'ph3', path: [[LN[1], T(210)], [LN[1], T(90)], [LN[1] - 0.4, T(57)]], speed: 85, end: 'stop' },
];
const ROADBLOCK = { do: 'prop', id: 'roadblock', kind: 'roadblock', count: 6, span: 12.6, at: [-491.6, 8, T(46)], face: 0 };
// the second drone over the trap (the first is the convoy's own, over the truck)
const DRONE2 = { do: 'prop', id: 'drone2', kind: 'policeDrone', at: [-490, 30, T(26)], fly: { path: [[-489, T(34)], [-492, T(14)]], y: 23, speed: 2.2 } };
// the flares the drones drop on the road (one draw for all of them: instancing)
const FLARES = { do: 'prop', id: 'flares', kind: 'flareSet', drop: 15, size: 6.5, list: [
  { at: [-484.2, 8, T(21)], face: 30 }, { at: [-492.6, 8, T(25)], face: 140 }, { at: [-489.4, 8, T(34)], face: 80 },
  { at: [-484.6, 8, T(-12)], face: 200 }, { at: [-493.2, 8, T(-7)], face: 300 }, { at: [-488.6, 8, T(-31)], face: 10 },
] };
// the light of the trap: the red of the flares and the Phantoms' lights on the wet road around the truck
const TRAP_LIGHT = { do: 'light', at: [-485.8, 12.0, T(5)], color: 0xff6a52, power: 26, range: 26 };

// ---- HARROW ----
const HARROW_CAR = [
  { do: 'spawn', id: 'harrowCar', kind: 'police_coupe', or: 'sedan', color: GUARD_WHITE, at: [LS[1], T(230)], face: 180, npc: true, arena: 'ironhill', detail: true, speed: 80, flash: true },
  // IVY'S DRAWING on her dashboard (the same drawing as in Chapter 2: a house in the rain, a Guard car, MAMA and me)
  { do: 'prop', id: 'drawing', kind: 'drawing', in: 'harrowCar', at: { cabinAt: 'dash', p: [0.12, 0.02, 0.04] }, rot: [0.0, Math.PI + 0.35, 0] },
  { do: 'actor', id: 'harrow', model: 'Sloane_Harrow', name: 'name.harrow', seat: 'harrowCar', pose: 'sit', fixed: true, look: null, mood: 'stern' },
  { do: 'drive', id: 'harrowCar', path: [[LS[1], T(230)], [LS[1], T(60)], [LS[0], T(20)], [LS[0], T(5.6)]], speed: 70, end: 'stop' },
];
// a Guard officer in rain gear: the truck's driver, out by his door
const GUARD_CLOTH = { pants: [0.05, 0.05, 0.06], coat: [0.06, 0.08, 0.11], patch: [0.55, 0.6, 0.12], scarf: [0.05, 0.05, 0.06], head: [0.04, 0.04, 0.05] };
const OFFICER = { do: 'actor', id: 'officer', extra: GUARD_CLOTH, name: 'name.officer', at: [-489.2, DECK, T(2.2)], face: 280, pose: 'idle', fixed: true, look: null, mood: 'stern' };
// the girl Harrow let go in Chapter 3, on a roof by the highway, in the rain
const GIRL = { do: 'actor', id: 'girl', extra: { pants: [0.12, 0.14, 0.2], coat: [0.45, 0.32, 0.12], patch: [0.15, 0.3, 0.32], scarf: [0.5, 0.15, 0.12], head: [0.18, 0.13, 0.1] },
  name: 'name.girl', at: { roof: [-452.6, 444] }, face: 60, pose: 'wave', fixed: true, look: null, scale: 0.6 };
const GIRL_LET_GO = { flag: 'harrow_let_girl_go' };

// ---- DANTE: Theo's old blue jacket if Nate left it with him, else an old Chrome Wolves jacket ----
const THEO_JACKET = { color: [0.11, 0.42, 0.78], cuff: 0.83, hem: 0.07 };
const WOLVES_JACKET = { color: [0.16, 0.16, 0.18], cuff: 0.86, hem: 0.06, trim: [0.6, 0.62, 0.66] };
const DANTE = (at, face, more = {}) => [
  { do: 'actor', id: 'dante', model: 'Dante_Rios', name: 'name.dante', at, face, pose: 'idle', fixed: true, mood: 'tired', look: null, jacket: THEO_JACKET, if: { flag: 'jacket_taken', is: false }, ...more },
  { do: 'actor', id: 'dante', model: 'Dante_Rios', name: 'name.dante', at, face, pose: 'idle', fixed: true, mood: 'tired', look: null, jacket: WOLVES_JACKET, if: { flag: 'jacket_taken' }, ...more },
];
// the truck's heavy back doors (on the truck: they swing open)
const REAR_DOORS = { do: 'prop', id: 'rear', kind: 'rearDoors', w: 1.72, h: 1.62, in: 'truck', at: { cabinAt: 'back', p: [0, -0.18, 0.06] } };
// behind the truck (the middle line is to the west, +x; Harrow's car beyond it)
const BACK = {
  nate: [-485.0, DECK, T(-7.8)],               // facing the back doors (compass 26)
  harrowDoor: [-486.9, DECK, T(-5.0)],         // at the doors, pulling them open
  harrowAside: [-485.4, DECK, T(-5.2)],        // a step to the side, toward Nate (compass 189)
  danteIn: [LN[0], 8.85, T(-4.3)],             // in the doorway, on the sill (just outside the dark inside)
  danteDown: [LN[0] + 0.1, DECK, T(-4.7)],
  danteStop: [-486.2, DECK, T(-6.6)],          // in front of Nate (compass 225)
};

// ---- Rask's office over the docks (Chapter 5: the desk by the window, floor 6.4 m up) ----
// (everything he touches is within an old man's reach: the desk's near edge is at z -350.05, its top 7.18 m up)
const OFF = {
  rask: [-838, 6.4, -349.97],                  // standing close at the desk, on its north side, facing the window
  hands: [-838.24, 7.2, -350.1],               // his left hand flat on the desk (the watch on that wrist)
  machine: [-837.74, 7.18, -350.36],           // in front of him, to his right
  slot: [-837.66, 7.392, -350.38],             // the core in the machine's socket
  phone: [-837.26, 7.18, -350.2],
  watchDesk: [-838.0, 7.188, -350.16],        // the watch laid down: in front of him, by his left hand (his right hand reaches it)
  nate: [-832, 6.4, -347],                     // (Nate is not in this scene: he stays out of sight)
};
const RASK_OFFICE = [
  { do: 'actor', id: 'rask', model: 'Viktor_Rask', name: 'name.rask', at: OFF.rask, face: 180, pose: 'phone', fixed: true, look: null, mood: 'sad' },
  { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_L', p: [0, 0.004, 0], wrist: true, band: 1.4 },
  // (in the hand: +y of a hand bone runs toward the fingers, the palm is on the -x side of a right hand)
  { do: 'prop', id: 'core', kind: 'haloCore', on: 'rask', bone: 'hand_R', p: [-0.025, 0.075, 0.0] },
  { do: 'prop', id: 'machine', kind: 'oldMachine', at: OFF.machine, face: 0 },
  { do: 'prop', id: 'deskPhone', kind: 'deskPhone', at: OFF.phone, face: 0 },
  // the room: the docks map on the wall (as in Chapter 5), the old armchair he sat in all night (a blanket on its
  // arm), a cold mug at the end of the desk
  { do: 'prop', id: 'wallMap', kind: 'docksMap', at: [-838, 8.4, -342.25], rot: [-Math.PI / 2, 0, 0], scale: 2.6 },
  { do: 'prop', id: 'armchair', kind: 'armchair', at: [-844.6, 6.4, -349.2], face: 200 },
  { do: 'prop', id: 'mug', kind: 'mug', cold: true, at: [-838.95, 7.18, -350.78], face: 30 },
];
// (soft: a light that is too strong this close burns the hands and the desk to white)
const OFFICE_LAMP = { do: 'light', at: [-837.5, 8.6, -349.9], color: 0xffc890, power: 4.2, range: 6 };
const MACHINE_LIGHT = { do: 'light', at: [-837.78, 7.56, -350.1], color: 0xffd6a0, power: 0.85, range: 2.2 };
// the hand on the desk and the watch on its wrist; the watch set down on the desk (camera places for the close-ups)
const AT_WRIST = [-838.2, 7.25, -350.06];
// (low beside the desk, at his left: his hand on the desk, the watch on its wrist - later the watch lying by it)
const CAM_WATCH = { from: [-838.9, 7.55, -350.32], to: [-838.88, 7.54, -350.3], look: [-838.14, 7.22, -350.12], fov: 30, near: 0.03 };
// (from above, in front of his left side: the back of his hand on the desk, and the stopped watch on its wrist)
const CAM_WRIST = { from: [-838.75, 7.8, -350.4], to: [-838.73, 7.78, -350.38], look: [-838.2, 7.24, -350.06], fov: 28, near: 0.03 };

export default {
  id: 'chapter09',
  number: 9,
  title: 'c9.title',
  vehicle: 'van',
  getIn: 'c9.get_in',
  // (what a normal game has decided by now; used when a mission is started from the mission list. The address option
  //  "flags" can change any of them for a test: flags=rask_stance:paid,jacket_taken:false)
  flags: {
    limiter_off: true, ticket_taken: true, keystone_found: true, chip_holder: 'lena', chip_to_lena: true, van_color: 0, van_plate: 'PM 2908',
    harrow_ivy_seen: true, harrow_let_girl_go: true, mace_gave_car: true, zero_found_race: true, jacket_taken: true,
    rask_stance: 'honest', rask_mila_seen: true, opened_package: false, mace_forgiven: true, c6_end: 'forgive',
    theo_car: true, theo_key: true, garage_open: true, upgrades_at: 'garage', dante_captured: true,
    pilot_key_ready: true, theo_running_confirmed: true, wren_fragment_unlocked: true,
  },
  preload: { actors: ['Lena_Marchetti', 'Viktor_Rask', 'Mace_Doyle', 'Sloane_Harrow', 'Dante_Rios', 'Adrian_Vance'], vehicles: ['armored_van', 'police_coupe', 'tech_patrol_car'] },

  missions: [
    // =====================================================================
    // 1. THE ROUTE - Lena's safehouse. Short. Dante is in a Guard convoy. Lena has no route; Rask has one.
    // =====================================================================
    {
      id: 'c9m0', title: 'c9.m0',
      setup: [
        { do: 'time', hour: 1.7, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'safehouse', set: true },
        { do: 'safehouse', tvOn: false, lamp: 0.85 },
        LENA(),
        ...RASK_SAFE,
        MACE(SAFE.mace, 321, { if: MACE_HERE }),
        { do: 'prop', id: 'laptop', kind: 'laptop', at: SAFE.laptop, face: 0 },
        { do: 'player', stage: { at: s(SAFE.nate[0], 0, SAFE.nate[1]), face: 200, pose: 'idle' }, mood: 'tired' },
        { do: 'allow', enter: 'none', move: false },
        { do: 'wanted', stars: 0 },
      ],
      steps: [
        { do: 'card', over: 'c9.card.over', title: 'c9.title', sub: 'c9.card.sub', seconds: 4.5 },
        {
          do: 'cutscene', keep: true, shots: [
            // the room: rain on the window, Lena at her laptop, an old man by the door in a wet coat
            { seconds: 5.6, fade: 'in', cam: { from: s(-2.55, 1.75, 2.35), to: s(-2.3, 1.7, 2.1), look: s(0.6, 1.0, -0.9), fov: 52 },
              lines: [{ at: 1.2, who: 'lena', text: 'c9.lena.convoy', mood: 'worried' }] },
            // Dante's chair, empty
            { seconds: 4.4, cam: { from: s(0.6, 1.72, 2.02), to: s(0.66, 1.7, 1.9), look: SAFE.chair, fov: 36 },
              do: [{ do: 'player', look: SAFE.chair, mood: 'sad' }],
              lines: [{ at: 0.6, who: 'lena', text: 'c9.lena.noroute', mood: 'tired' }] },
            // Rask
            { seconds: 4.6, cam: { from: s(0.7, 1.58, -0.2), to: s(0.62, 1.58, -0.12), look: { of: 'rask', p: [0, 1.6, 0] }, fov: 34 },
              do: [{ do: 'player', look: { of: 'rask', p: [0, 1.6, 0] }, mood: 'stern' }, { do: 'actorSet', id: 'rask', look: 'player' }],
              lines: [{ at: 0.7, who: 'rask', text: 'c9.rask.route', mood: 'stern' }] },
            // the watch on his wrist: a child's watch, stopped at 4:12
            { seconds: 4.2, cam: { from: { of: 'rask', p: [0.42, 1.22, 0.62] }, to: { of: 'rask', p: [0.4, 1.2, 0.56] }, look: { of: 'rask', p: [0.04, 1.02, 0.22] }, fov: 26, near: NEAR } },
            // what he asks for it: nothing (paid - friendly, sure of himself) or the bare words (honest - stiff)
            { seconds: 5.0, if: PAID, cam: { from: s(0.7, 1.58, -0.2), look: { of: 'rask', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'rask', pose: 'idle', mood: 'smile' }],
              lines: [{ at: 0.5, who: 'rask', text: 'c9.rask.paid', mood: 'smile', seconds: 3.6 }] },
            { seconds: 3.8, if: { not: PAID }, cam: { from: s(0.7, 1.58, -0.2), look: { of: 'rask', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'rask', look: SAFE.tv }],
              lines: [{ at: 0.5, who: 'rask', text: 'c9.rask.honest', mood: 'stern', seconds: 2.6 }] },
            // Lena, over Nate's shoulder
            { seconds: 3.4, cam: { from: s(0.62, 1.68, 1.72), to: s(0.66, 1.66, 1.62), look: s(1.2, 1.18, -1.2), fov: 38 },
              do: [{ do: 'actorSet', id: 'lena', look: 'player' }, { do: 'player', look: s(1.2, 1.2, -1.2) }],
              lines: [{ at: 0.4, who: 'lena', text: 'c9.lena.call', mood: 'worried' }] },
          ],
        },
        // CHOICE: trust the old man's road, or not (it is the only road either way)
        { do: 'choice', prompt: 'c9.ch.prompt', options: [{ text: 'c9.ch.trust', set: { trusted_rask: true } }, { text: 'c9.ch.doubt', set: { trusted_rask: false } }] },
        {
          do: 'cutscene', keep: true, shots: [
            { seconds: 3.2, if: TRUSTED, cam: { from: s(1.62, 1.48, -0.98), look: s(0.45, 1.55, 1.05), fov: 38 },
              do: [{ do: 'player', look: { of: 'rask', p: [0, 1.6, 0] } }],
              lines: [{ at: 0.3, who: 'nate', text: 'c9.nate.trust', mood: 'stern' }] },
            { seconds: 3.4, if: { all: [TRUSTED, PAID] }, cam: { from: s(0.7, 1.58, -0.2), look: { of: 'rask', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'rask', text: 'c9.rask.partners', mood: 'smile' }] },
            { seconds: 2.6, if: { all: [TRUSTED, { not: PAID }] }, cam: { from: s(0.7, 1.58, -0.2), look: { of: 'rask', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'rask', text: 'c9.rask.good', mood: 'stern' }] },
            { seconds: 4.2, if: { not: TRUSTED }, cam: { from: s(1.62, 1.48, -0.98), look: s(0.45, 1.55, 1.05), fov: 38 },
              do: [{ do: 'player', look: { of: 'rask', p: [0, 1.6, 0] } }],
              lines: [{ at: 0.3, who: 'nate', text: 'c9.nate.doubt', mood: 'stern', seconds: 3.4 }] },
            { seconds: 4.0, if: { not: TRUSTED }, cam: { from: s(0.7, 1.58, -0.2), look: { of: 'rask', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'rask', look: 'player', mood: 'stern' }],
              lines: [{ at: 0.5, who: 'rask', text: 'c9.rask.doubted', seconds: 3.0 }] },
            // MACE: the second van (or Lena says no)
            { seconds: 4.6, if: MACE_FULL, cam: { from: s(-0.6, 1.62, 0.2), to: s(-0.65, 1.62, 0.1), look: { of: 'mace', p: [0, 1.62, 0] }, fov: 34 },
              do: [{ do: 'actorSet', id: 'mace', look: 'player', mood: 'stern' }, { do: 'player', look: { of: 'mace', p: [0, 1.6, 0] } }],
              lines: [{ at: 0.5, who: 'mace', text: 'c9.mace.offer', seconds: 3.6 }] },
            { seconds: 4.4, if: MACE_QUIET, cam: { from: s(-0.6, 1.62, 0.2), to: s(-0.65, 1.62, 0.1), look: { of: 'mace', p: [0, 1.62, 0] }, fov: 34 },
              do: [{ do: 'actorSet', id: 'mace', look: s(0.45, 1.0, 1.05), mood: 'sad' }, { do: 'player', look: { of: 'mace', p: [0, 1.6, 0] } }],
              lines: [{ at: 0.8, who: 'mace', text: 'c9.mace.offer_quiet', seconds: 3.4 }] },
            { seconds: 4.2, if: { not: MACE_HERE }, cam: { from: s(1.0, 1.22, -2.42), look: s(1.2, 1.2, -1.25), fov: 36, near: NEAR },
              lines: [{ at: 0.5, who: 'lena', text: 'c9.lena.no_mace', mood: 'stern', seconds: 3.2 }] },
          ],
        },
        // CHOICE (only when Mace is here): the second van
        { do: 'choice', if: MACE_HERE, prompt: 'c9.ch.mace_prompt', options: [{ text: 'c9.ch.mace_yes', set: { support_driver: 'mace' } }, { text: 'c9.ch.mace_no', set: { support_driver: 'none' } }] },
        { do: 'flag', set: { support_driver: 'none' }, if: { not: MACE_HERE } },
        {
          do: 'cutscene', shots: [
            { seconds: 2.6, if: { all: [MACE_HERE, WITH_MACE] }, cam: { from: s(1.62, 1.48, -0.98), look: s(0.45, 1.55, 1.05), fov: 38 },
              lines: [{ at: 0.3, who: 'nate', text: 'c9.nate.mace' }] },
            { seconds: 3.4, if: { all: [MACE_HERE, WITH_MACE] }, cam: { from: s(-0.6, 1.62, 0.2), look: { of: 'mace', p: [0, 1.62, 0] }, fov: 32 },
              lines: [{ at: 0.4, who: 'mace', text: 'c9.mace.yes', mood: 'stern' }] },
            { seconds: 3.6, if: { all: [MACE_HERE, { not: WITH_MACE }] }, cam: { from: s(1.62, 1.48, -0.98), look: s(0.45, 1.55, 1.05), fov: 38 },
              lines: [{ at: 0.3, who: 'nate', text: 'c9.nate.alone', seconds: 3.0 }] },
            { seconds: 3.0, if: { all: [MACE_HERE, { not: WITH_MACE }] }, cam: { from: s(-0.6, 1.62, 0.2), look: { of: 'mace', p: [0, 1.62, 0] }, fov: 32 },
              lines: [{ at: 0.4, who: 'mace', text: 'c9.mace.ok', mood: 'tired' }] },
            // Lena closes the laptop. The rain on the window.
            { seconds: 3.6, cam: { from: s(1.95, 1.08, -1.35), to: s(1.85, 1.02, -1.45), look: SAFE.laptop, fov: 32, near: NEAR }, fade: 'out', fadeSeconds: 1.4,
              do: [{ do: 'actorSet', id: 'lena', look: SAFE.laptop }] },
          ],
        },
        { do: 'safehouse', set: false },
        { do: 'remove', ids: ['lena', 'rask', 'wwatch', 'mace', 'laptop'] },
      ],
      flags: {},
    },

    // =====================================================================
    // 2. TAKE THE ROUTE - up the ramp onto Ironhill Highway, north, in the rain, to the place Rask gave them.
    // =====================================================================
    {
      id: 'c9m1', title: 'c9.m1',
      setup: [
        NIGHT,
        { do: 'world', traffic: 6, people: 0, indoors: false, now: true },
        ...VAN([LN[1], -352], 0),
        ...IN_VAN,
        // a few cars on the highway at this hour (simple ones: they are only passed)
        { do: 'spawn', id: 't1', kind: 'sedan', at: [LN[0], -120], face: 0, color: [0.32, 0.33, 0.35], arena: 'ironhill', simple: true, npc: true, speed: 76 },
        { do: 'spawn', id: 't2', kind: 'van', at: [LN[2], 190], face: 0, color: [0.62, 0.58, 0.46], arena: 'ironhill', simple: true, npc: true, speed: 70 },
        { do: 'spawn', id: 't3', kind: 'sedan', at: [LS[1], 860], face: 180, color: [0.18, 0.2, 0.26], arena: 'ironhill', simple: true, npc: true, speed: 88 },
        { do: 'drive', id: 't1', path: [[LN[0], -120], [LN[0], 1420]], speed: 76, end: 'remove' },
        { do: 'drive', id: 't2', path: [[LN[2], 190], [LN[2], 1420]], speed: 70, end: 'remove' },
        { do: 'drive', id: 't3', path: [[LS[1], 860], [LS[1], -330]], speed: 88, end: 'remove' },
        // the Guard's gate over the northbound road, before the tunnel (it is the convoy's gate in the next mission)
        { do: 'prop', id: 'gate', kind: 'bridgeGate', width: 13.6, at: [-491.8, 8, GATE_Z], face: 180 },
        { do: 'wanted', stars: 0 },
        { do: 'cam', mode: 'chase' },
      ],
      on: [
        // (the Zero proximity system is off in the story: only free roam has it)
        // two KVI Phantoms come out of the tunnel the other way, lights flashing, and go past him
        { zone: { z: [20, 2000] }, do: [
          KVI_PHANTOM('pha', [LS[0], 1150], 180, { speed: 112 }), KVI_PHANTOM('phb', [LS[2], 1185], 180, { speed: 112 }),
          { do: 'drive', id: 'pha', path: [[LS[0], 1150], [LS[0], -330]], speed: 118, end: 'remove' },
          { do: 'drive', id: 'phb', path: [[LS[2], 1185], [LS[2], -330]], speed: 116, end: 'remove' },
        ] },
        { carNear: 'pha', radius: 170, do: [{ do: 'say', who: 'lena', kind: 'radio', text: 'c9.lena.phantoms' }, { do: 'music', tension: 0.35 }] },
      ],
      steps: [
        { do: 'fade', to: 'clear', seconds: 1.4 },
        {
          do: 'cutscene', shots: [
            // up the ramp in the rain, the city behind, the long dark road ahead
            { seconds: 5.2, fade: 'in', cam: { from: { of: 'van', p: [2.2, 3.2, -9] }, to: { of: 'van', p: [2.0, 3.0, -7.5] }, look: { of: 'van', p: [0, 1.4, 30] }, fov: 46 },
              do: [{ do: 'vehicleSet', id: 'van', speed: 30 }, { do: 'autoDrive', gas: 0.45, brake: 0 }],
              lines: [{ at: 1.0, who: 'lena', kind: 'radio', text: 'c9.lena.ramp', seconds: 3.8 }],
              end: [{ do: 'autoDrive', off: true }] },
          ],
        },
        { do: 'checkpoint', id: 1 },
        { do: 'driveTo', at: [LN[1], 250], radius: 26, text: 'c9.obj.route1' },
        { do: 'driveTo', at: [LN[1], 470], radius: 26, text: 'c9.obj.route2' },
        { do: 'driveTo', at: AMBUSH, radius: 9, stop: true, text: 'c9.obj.wait' },
        { do: 'music', tension: 0 },
        {
          do: 'cutscene', shots: [
            // he pulls over by the middle line, facing north. Lights off.
            { seconds: 4.6, cam: { from: [AMBUSH[0] + 6.5, 10.2, AMBUSH[1] + 12], to: [AMBUSH[0] + 6.0, 10.0, AMBUSH[1] + 10.5], look: { of: 'van', p: [0, 0.9, 0] }, fov: 44 },
              do: [{ do: 'vehicleSet', id: 'van', place: AMBUSH, face: 0, stop: true }, { do: 'remove', ids: ['t1', 't2', 't3', 'pha', 'phb'] }, { do: 'world', traffic: 0 }],
              lines: [{ at: 0.6, who: 'lena', kind: 'radio', text: 'c9.lena.there' }, { at: 2.8, do: [{ do: 'vehicleSet', id: 'van', lights: 'off' }, { do: 'sound', name: 'radioClick' }] }] },
            // over the van's roof: the long road north, the gate's amber lamps far off before the tunnel
            { seconds: 5.6, cam: { from: { of: 'van', p: [0.7, 2.7, -3.2] }, to: { of: 'van', p: [0.6, 2.65, -2.6] }, look: [LN[1], 13, GATE_Z], fov: 30 },
              lines: [{ at: 0.8, who: 'lena', kind: 'radio', text: 'c9.lena.gatehere', seconds: 4.4 }] },
            // the rain on the glass. Waiting. His hands on the wheel.
            { seconds: 4.0, cam: { from: { cabin: 'van', at: 'pass', p: [0.08, 0.05, 0.15] }, look: { cabin: 'van', at: 'wheel', p: [0, 0, 0] }, fov: 38, near: NEAR },
              do: [{ do: 'player', mood: 'afraid' }, { do: 'music', heart: 72 }] },
            // headlights behind him on the long road, coming up out of the rain
            { seconds: 5.4, cam: { from: [AMBUSH[0] - 3.4, 9.0, AMBUSH[1] + 1.5], to: [AMBUSH[0] - 3.5, 9.0, AMBUSH[1] + 0.5], look: [LN[1], 8.8, AMBUSH[1] - 120], fov: 30 },
              do: [...CONVOY(AMBUSH[1] - 205), CONVOY_START({ passive: true }), { do: 'remove', ids: ['gate'] }],
              lines: [{ at: 1.6, who: 'lena', kind: 'radio', text: 'c9.lena.coming' }] },
            // they go past him, close: the tech car, the big truck, the two escorts; the drone over them
            { seconds: 6.4, cam: { from: { of: 'van', p: [-1.6, 0.85, 2.2] }, to: { of: 'van', p: [-1.6, 0.9, 1.8] }, look: [LN[1], 9.4, AMBUSH[1] - 8], lookTo: [LN[1], 9.6, AMBUSH[1] + 26], fov: 50 },
              do: [{ do: 'player', mood: 'stern' }],
              lines: [{ at: 2.6, who: 'nate', text: 'c9.nate.count', seconds: 3.4 }] },
          ],
        },
      ],
      flags: { trusted_rask: true, support_driver: 'mace' },
    },

    // =====================================================================
    // 3. HIT THE CONVOY - take out the two escorts (ram, spin, block, or trap them behind the bridge gate), then stop
    //    the truck without hurting Dante. Nobody is killed: only driving.
    // =====================================================================
    {
      id: 'c9m2', title: 'c9.m2',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
          ...VAN(AMBUSH, 0),
          ...IN_VAN,
          ...CONVOY(AMBUSH[1] - 46),
          CONVOY_START(),
          { do: 'wanted', stars: 0 },
          { do: 'cam', mode: 'chase' },
        ]),
        LOOP,
        { do: 'music', tension: 0.75, heart: 0 },
      ],
      on: [
        // Dante is in the truck: hit it too hard and he is hurt
        { event: 'cargo:broken', fail: 'c9.fail.dante' },
        { event: 'convoy:escortOut', do: [{ do: 'say', who: 'lena', kind: 'radio', text: 'c9.lena.out1' }] },
        { event: 'convoy:escortsDown', do: [{ do: 'say', who: 'lena', kind: 'radio', text: 'c9.lena.out2' }, { do: 'tip', text: 'c9.tip.truck', seconds: 8 }, { do: 'music', tension: 0.55 }] },
        { event: 'convoy:truckHit', repeat: true, do: [{ do: 'forget', event: 'convoy:truckHit' }, { do: 'say', who: 'lena', kind: 'radio', text: 'c9.lena.hit' }] },
        { event: 'convoy:support', do: [{ do: 'say', who: 'mace', kind: 'radio', text: 'c9.mace.coming' }] },
        { event: 'convoy:supportAhead', do: [{ do: 'say', who: 'mace', kind: 'radio', text: 'c9.mace.ahead' }] },
        { event: 'convoy:alert', do: [{ do: 'music', tension: 0.95 }] },
        // the tech car: leave it, or put it out
        { time: 16, do: [{ do: 'say', who: 'lena', kind: 'radio', text: 'c9.lena.tech', seconds: 3.6 }] },
        // coming up to the gate: how to use it
        { zone: { z: [700, 960] }, do: [{ do: 'tip', text: 'c9.tip.gate', seconds: 8 }] },
      ],
      steps: [
        // (the film is over: he drives)
        { do: 'cine', on: false },
        { do: 'vehicleSet', id: 'van', lights: 'normal' },
        { do: 'convoy', engage: true },
        { do: 'tip', text: 'c9.tip.convoy', seconds: 9 },
        { do: 'convoyGoal', text: 'c9.obj.escorts', truckText: 'c9.obj.truck',
          gateOk: [{ do: 'say', who: 'lena', kind: 'radio', text: 'c9.lena.gate' }] },
        // how it was done: the tech car rammed, the gate hacked, or the tech car left alone
        { do: 'convoy', styleFlag: 'ambush_style' },
        { do: 'convoy', halt: true },
        { do: 'convoy', autoRewind: null },
        { do: 'music', tension: 0.25 },
      ],
      flags: { trusted_rask: true, support_driver: 'mace' },
    },

    // =====================================================================
    // 4. THE TRAP - the road was a lie. KVI Phantoms on both sides, drones drop flares, a roadblock. Rask's line is dead.
    // =====================================================================
    {
      id: 'c9m3', title: 'c9.m3',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
          ...VAN([LN[0], T(11.5)], 0),
          { do: 'player', inCar: 'van' },
          { do: 'allow', enter: ['van'] },
          { do: 'spawn', id: 'truck', kind: 'armored_van', or: 'small_city_car', at: [LN[0], T(0)], face: 0, scale: 1.18, tint: [0.2, 0.23, 0.26], npc: true, arena: 'ironhill', noDetail: true,
            type: { label: 'GUARD PRISON TRUCK', role: 'car' }, cargo: { kind: 'inside', label: 'DANTE' } },
          { do: 'convoy', start: { truck: 'truck', escorts: [], dir: 1 } },
          { do: 'convoy', halt: true },
        ]),
        { do: 'wanted', stars: 0 },
      ],
      steps: [
        { do: 'hush' },
        {
          do: 'cutscene', shots: [
            // the truck stands in the rain, the van across its nose. The engines tick.
            { seconds: 4.6, cam: { from: [-481.4, 11.4, T(-11)], to: [-481.6, 11.2, T(-9.8)], look: [-488.2, 8.9, T(6.5)], fov: 42 },
              do: [...TRAP_PLACES, { do: 'music', tension: 0.2 }],
              lines: [{ at: 0.8, who: 'lena', kind: 'radio', text: 'c9.lena.stopped' }] },
            // behind them: lights, coming fast. Then ahead: lights.
            { seconds: 4.4, cam: { from: [-484.3, 9.0, T(9)], to: [-484.4, 9.05, T(8.4)], look: [-489.8, 8.9, T(-70)], fov: 30 },
              do: [...PHANTOMS_IN, { do: 'sound', name: 'sirenBurst', seconds: 0.9 }, { do: 'music', tension: 0.7 }] },
            { seconds: 5.2, cam: { from: [-484.0, 10.6, T(4)], to: [-484.3, 10.9, T(6)], look: [-490.5, 9.6, T(52)], fov: 44 },
              do: [...PHANTOM_AHEAD, ROADBLOCK, DRONE2, FLARES, TRAP_LIGHT],
              lines: [{ at: 2.6, who: 'lena', kind: 'radio', text: 'c9.lena.both' }] },
            // his face in the dark van. The radio.
            { seconds: 4.4, cam: { from: { cabin: 'van', at: 'pass', p: [0.05, 0.02, 0.25] }, look: { cabin: 'van', at: 'eye', p: [0, -0.02, 0] }, fov: 40, near: NEAR },
              do: [{ do: 'player', mood: 'afraid' }, { do: 'music', tension: 0, radio: 0.5 }],
              lines: [{ at: 0.8, who: 'nate', kind: 'radio', text: 'c9.nate.rask', mood: 'afraid', seconds: 2.8 }] },
            // nothing. Static, and then not even that.
            { seconds: 3.8, cam: { from: { cabin: 'van', at: 'pass', p: [0.08, 0.05, 0.15] }, look: { cabin: 'van', at: 'wheel', p: [0, 0, 0] }, fov: 38, near: NEAR },
              lines: [{ at: 0.5, do: [{ do: 'music', radioStatic: 1.6 }] }, { at: 2.4, do: [{ do: 'music', radio: 0 }, { do: 'sound', name: 'radioClick' }] }] },
            { seconds: 3.6, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.38] }, to: { cabin: 'van', at: 'pass', p: [0.15, 0.0, 0.3] }, look: { cabin: 'van', at: 'eye', p: [0, -0.03, 0] }, fov: 30, near: NEAR },
              lines: [{ at: 0.9, who: 'nate', kind: 'radio', text: 'c9.nate.rask2', mood: 'afraid', seconds: 1.6 }] },
            // he understands. Silence: only the rain on the roof and the flares hissing.
            { seconds: 6.0, cam: { from: { cabin: 'van', at: 'pass', p: [0.1, 0.0, 0.34] }, to: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.28] }, look: { cabin: 'van', at: 'eye', p: [0, -0.03, 0] }, fov: 28, near: NEAR },
              do: [{ do: 'music', silence: 6 }],
              lines: [{ at: 1.4, do: [{ do: 'player', mood: 'sad' }] }, { at: 3.6, do: [{ do: 'sound', name: 'breath' }] }] },
            // the trap from above: the lights going round, silent
            { seconds: 4.4, cam: { from: [-480.5, 21, T(-26)], to: [-480.8, 22, T(-22)], look: [LN[0], 8, T(14)], fov: 46 } },
          ],
        },
        { do: 'flag', set: { rask_betrayed_nate: true } },
      ],
      flags: { trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle' },
    },

    // =====================================================================
    // 5. HARROW - she comes in her own car. Her daughter's drawing on the dash. Her orders. Her name on a list.
    // =====================================================================
    {
      id: 'c9m4', title: 'c9.m4',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
          ...VAN([LN[0], T(11.5)], 0),
          { do: 'player', inCar: 'van' },
          { do: 'allow', enter: ['van'] },
          { do: 'spawn', id: 'truck', kind: 'armored_van', or: 'small_city_car', at: [LN[0], T(0)], face: 0, scale: 1.18, tint: [0.2, 0.23, 0.26], npc: true, arena: 'ironhill', noDetail: true,
            type: { label: 'GUARD PRISON TRUCK', role: 'car' }, cargo: { kind: 'inside', label: 'DANTE' } },
          { do: 'convoy', start: { truck: 'truck', escorts: [], dir: 1 } },
          { do: 'convoy', halt: true },
          KVI_PHANTOM('ph1', [LN[0] + 0.6, T(-24)], 0), KVI_PHANTOM('ph2', [LN[2] + 0.8, T(-19)], 0), KVI_PHANTOM('ph3', [LN[1] - 0.4, T(57)], 180),
          ROADBLOCK, DRONE2, { ...FLARES, drop: 0 }, TRAP_LIGHT,
          { do: 'flag', set: { rask_betrayed_nate: true } },
        ]),
        { do: 'wanted', stars: 0 },
      ],
      steps: [
        {
          do: 'cutscene', keep: true, shots: [
            // headlights from the north, on the other side of the road: one car, slow. Guard lights, no siren.
            { seconds: 5.6, cam: { from: [-484.6, 9.3, T(-2)], to: [-484.4, 9.35, T(0)], look: [LS[0], 8.9, T(60)], lookTo: [LS[0], 8.8, T(12)], fov: 40 },
              do: [...HARROW_CAR, OFFICER] },
            // inside her car: her hands on the wheel, and on the dash a child's drawing
            { seconds: 4.8, cam: { from: { cabin: 'harrowCar', at: 'pass', p: [0.08, 0.02, 0.12] }, to: { cabin: 'harrowCar', at: 'pass', p: [0.05, 0.0, 0.2] }, look: { cabin: 'harrowCar', at: 'dash', p: [0.12, 0.02, 0.04] }, fov: 40, near: NEAR },
              do: [{ do: 'drive', id: 'harrowCar', mode: 'stop' }, { do: 'vehicleSet', id: 'harrowCar', place: [LS[0], T(5.6)], face: 180, stop: true, flash: false }] },
            // she gets out into the rain. Nate gets out of the van. They face each other.
            { seconds: 5.2, cam: { from: { of: 'player', p: [-1.0, 1.8, -2.4] }, to: { of: 'player', p: [-0.9, 1.78, -2.1] }, look: { of: 'harrow', p: [0, 1.35, 0] }, fov: 36 },
              do: [{ do: 'vehicleSet', id: 'harrowCar', door: 1 },
                { do: 'actorSet', id: 'harrow', seat: null, at: HARROW_SPOT, face: 90, pose: 'idle', look: 'player', mood: 'stern' },
                { do: 'player', stage: { at: NATE_SPOT, face: 270, pose: 'idle' }, mood: 'stern', look: { of: 'harrow', p: [0, 1.62, 0] } },
                { do: 'actorSet', id: 'officer', look: { of: 'harrow', p: [0, 1.6, 0] } }],
              lines: [{ at: 2.2, who: 'harrow', text: 'c9.harrow.name', seconds: 1.8 }] },
            { seconds: 4.6, cam: HARROW_FACE,
              lines: [{ at: 0.6, who: 'harrow', text: 'c9.harrow.orders', seconds: 3.2 }] },
            // she looks down at the tablet in her hand
            { seconds: 4.4, cam: { from: { of: 'harrow', p: [0.6, 1.5, 0.95] }, to: { of: 'harrow', p: [0.55, 1.5, 0.9] }, look: { of: 'harrow', p: [-0.05, 1.32, 0.3] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'harrow', pose: 'phone', look: null, mood: 'neutral' },
                { do: 'prop', id: 'tablet', kind: 'phantomTablet', at: { of: 'harrow', p: [-0.07, 1.27, 0.33] }, face: 270, rot: [0.85, 0, 0] }] },
            // KVI's Phantom list. One line is red.
            { seconds: 5.6, cam: { from: { of: 'harrow', p: [0.04, 1.7, 0.04] }, to: { of: 'harrow', p: [0.03, 1.64, 0.1] }, look: { of: 'harrow', p: [-0.07, 1.27, 0.33] }, fov: 30, near: 0.03 } },
            // she understands
            { seconds: 5.4, cam: { from: { of: 'harrow', p: [0.2, 1.62, 1.0] }, to: { of: 'harrow', p: [0.19, 1.62, 0.93] }, look: { of: 'harrow', p: [0, 1.6, 0] }, fov: 26 },
              do: [{ do: 'actorSet', id: 'harrow', mood: 'sad' }],
              lines: [{ at: 2.6, who: 'harrow', text: 'c9.harrow.list', seconds: 2.4, mood: 'sad' }] },
            // the order
            { seconds: 4.4, cam: OVER_NATE,
              do: [{ do: 'remove', ids: ['tablet'] }, { do: 'actorSet', id: 'harrow', pose: 'idle', look: { of: 'officer', p: [0, 1.6, 0] }, mood: 'stern' }],
              lines: [{ at: 0.8, who: 'harrow', text: 'c9.harrow.stand', seconds: 2.4 }] },
            { seconds: 3.2, cam: { from: { of: 'harrow', p: [-0.45, 1.7, -0.7] }, look: { of: 'officer', p: [0, 1.6, 0] }, fov: 30 },
              lines: [{ at: 0.5, who: 'officer', text: 'c9.officer.sure', seconds: 1.4 }] },
            { seconds: 3.4, cam: HARROW_FACE,
              lines: [{ at: 0.4, who: 'harrow', text: 'c9.harrow.again', seconds: 2.0 }] },
            // the Phantoms' lights go out one by one; the drones turn away
            { seconds: 5.6, cam: { from: [-480.5, 12.5, T(-30)], to: [-480.6, 12.8, T(-26)], look: [LN[0], 8.6, T(12)], fov: 44 },
              do: [{ do: 'actorSet', id: 'officer', pose: 'idle', look: null }],
              lines: [
                { at: 0.8, do: [{ do: 'vehicleSet', id: 'ph1', flash: false, lights: 'off' }] },
                { at: 1.6, do: [{ do: 'vehicleSet', id: 'ph2', flash: false, lights: 'off' }] },
                { at: 2.4, do: [{ do: 'vehicleSet', id: 'ph3', flash: false, lights: 'off' }] },
                { at: 3.2, do: [{ do: 'remove', ids: ['drone2'] }, { do: 'convoy', drone: false }, { do: 'light', at: [-487.5, 10.5, T(8)], color: 0xff6a50, power: 9, range: 18 }] },
              ] },
            // the girl she let go in the Sunk: on a roof by the highway, in the rain. She waves.
            { seconds: 3.4, if: GIRL_LET_GO, cam: OVER_NATE,
              do: [GIRL, { do: 'actorSet', id: 'harrow', look: { of: 'girl', p: [0, 0.9, 0] } }] },
            { seconds: 4.0, if: GIRL_LET_GO, cam: { from: { of: 'girl', p: [-1.4, 0.95, 4.2] }, to: { of: 'girl', p: [-1.5, 0.95, 3.8] }, look: { of: 'girl', p: [0, 0.85, 0] }, fov: 30 } },
            { seconds: 3.6, if: GIRL_LET_GO, cam: { from: { of: 'harrow', p: [0.2, 1.62, 0.98] }, look: { of: 'harrow', p: [0, 1.6, 0] }, fov: 26 },
              do: [{ do: 'actorSet', id: 'harrow', mood: 'smile' }],
              end: [{ do: 'remove', ids: ['girl'] }] },
            // she looks back at Nate
            { seconds: 2.6, cam: OVER_NATE,
              do: [{ do: 'actorSet', id: 'harrow', look: 'player', mood: 'stern' }] },
          ],
        },
        // CHOICE: what Nate says to her (saying nothing is an answer too)
        { do: 'choice', prompt: 'c9.ch.harrow', seconds: 12, default: 0, options: [
          { text: 'c9.ch.silent', set: { harrow_reply: 'silent' } },
          { text: 'c9.ch.thanks', set: { harrow_reply: 'thanks' } },
          { text: 'c9.ch.notforme', set: { harrow_reply: 'notforme' } },
        ] },
        {
          do: 'cutscene', shots: [
            { seconds: 2.6, if: { flag: 'harrow_reply', is: 'thanks' }, cam: OVER_HARROW,
              lines: [{ at: 0.4, who: 'nate', text: 'c9.nate.thanks' }] },
            { seconds: 3.0, if: { flag: 'harrow_reply', is: 'thanks' }, cam: HARROW_FACE,
              lines: [{ at: 0.4, who: 'harrow', text: 'c9.harrow.r_thanks' }] },
            { seconds: 2.8, if: { flag: 'harrow_reply', is: 'notforme' }, cam: OVER_HARROW,
              lines: [{ at: 0.4, who: 'nate', text: 'c9.nate.notforme' }] },
            { seconds: 3.0, if: { flag: 'harrow_reply', is: 'notforme' }, cam: HARROW_FACE,
              lines: [{ at: 0.8, who: 'harrow', text: 'c9.harrow.r_notforme' }] },
            // (silence: she looks at him a moment longer)
            { seconds: 3.4, if: { flag: 'harrow_reply', is: 'silent' }, cam: OVER_NATE },
          ],
        },
      ],
      flags: { trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle', rask_betrayed_nate: true },
    },

    // =====================================================================
    // 6. DANTE FREE - Harrow opens the truck herself. Dante steps out. She gives Nate a card, and drives away.
    // =====================================================================
    {
      id: 'c9m5', title: 'c9.m5',
      setup: [
        ...onLoad([
          NIGHT,
          { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
          ...VAN([LN[0], T(11.5)], 0),
          { do: 'spawn', id: 'truck', kind: 'armored_van', or: 'small_city_car', at: [LN[0], T(0)], face: 0, scale: 1.18, tint: [0.2, 0.23, 0.26], npc: true, arena: 'ironhill', noDetail: true,
            type: { label: 'GUARD PRISON TRUCK', role: 'car' } },
          { do: 'spawn', id: 'harrowCar', kind: 'police_coupe', or: 'sedan', color: GUARD_WHITE, at: [LS[0], T(5.6)], face: 180, npc: true, arena: 'ironhill', detail: true, door: 1 },
          { do: 'prop', id: 'drawing', kind: 'drawing', in: 'harrowCar', at: { cabinAt: 'dash', p: [0.12, 0.02, 0.04] }, rot: [0.0, Math.PI + 0.35, 0] },
          { do: 'actor', id: 'harrow', model: 'Sloane_Harrow', name: 'name.harrow', at: HARROW_SPOT, face: 90, pose: 'idle', fixed: true, look: 'player', mood: 'stern' },
          { do: 'player', stage: { at: NATE_SPOT, face: 270, pose: 'idle' }, mood: 'stern' },
          OFFICER,
          KVI_PHANTOM('ph1', [LN[0] + 0.6, T(-24)], 0, { lights: 'off', flash: false }), KVI_PHANTOM('ph2', [LN[2] + 0.8, T(-19)], 0, { lights: 'off', flash: false }),
          KVI_PHANTOM('ph3', [LN[1] - 0.4, T(57)], 180, { lights: 'off', flash: false }),
          ROADBLOCK, { ...FLARES, drop: 0 }, { do: 'light', at: [-487.5, 10.5, T(8)], color: 0xff6a50, power: 9, range: 18 },
          { do: 'flag', set: { rask_betrayed_nate: true } },
        ]),
        REAR_DOORS,
        { do: 'wanted', stars: 0 },
      ],
      steps: [
        {
          do: 'cutscene', shots: [
            // she walks past the truck to its back doors, Nate behind her
            { seconds: 5.0, cam: { from: [-482.5, 9.8, T(-10.5)], to: [-482.7, 9.8, T(-9.6)], look: [-486.6, 9.4, T(-2)], fov: 40 },
              do: [{ do: 'actorSet', id: 'harrow', walk: BACK.harrowDoor, speed: 1.25, then: 0, look: null },
                { do: 'player', stage: { at: BACK.nate, face: 26, pose: 'idle' }, look: { of: 'harrow', p: [0, 1.5, 0] } },
                { do: 'actorSet', id: 'officer', look: { of: 'harrow', p: [0, 1.6, 0] } }] },
            // the heavy doors: she pulls them open herself
            { seconds: 4.6, cam: { from: [-484.2, 9.45, T(-9.6)], look: [LN[0], 9.2, T(-3.6)], fov: 36 },
              do: [{ do: 'actorSet', id: 'harrow', at: BACK.harrowDoor, face: 0, pose: 'work', hands: [-486.95, 9.25, T(-3.9)] }],
              lines: [{ at: 1.0, do: [{ do: 'propSet', id: 'rear', call: { setOpen: 1 } }, { do: 'sound', name: 'heavyDoor' }] },
                { at: 2.4, do: [{ do: 'actorSet', id: 'harrow', pose: 'idle', hands: null }, { do: 'actorSet', id: 'harrow', walk: BACK.harrowAside, speed: 0.9, then: 189 }] }] },
            // the dark inside. Someone stands up in it.
            { seconds: 4.4, cam: { from: [-487.3, 9.4, T(-10.2)], to: [-487.3, 9.4, T(-9.6)], look: [LN[0], 9.6, T(-3.6)], fov: 32 },
              do: [{ do: 'actorSet', id: 'harrow', at: BACK.harrowAside, face: 189 }, { do: 'light', at: [-487.1, 10.6, T(-5.5)], color: 0xdfe8ff, power: 7, range: 7 },
                ...DANTE(BACK.danteIn, 180, { pose: 'idle' })] },
            // DANTE: thinner, slower. He steps down and comes to Nate.
            { seconds: 4.8, cam: { from: [-483.4, 9.55, T(-10.4)], to: [-483.6, 9.55, T(-10.1)], look: { of: 'dante', p: [0, 1.4, 0] }, fov: 34 },
              do: [{ do: 'actorSet', id: 'dante', at: BACK.danteDown, face: 200 }, { do: 'actorSet', id: 'dante', walk: BACK.danteStop, speed: 0.85, then: 225, look: 'player' },
                { do: 'player', stage: { at: BACK.nate, face: 45, pose: 'idle' } }] },
            { seconds: 4.6, cam: { from: { of: 'player', p: [0.4, 1.68, -0.5] }, look: { of: 'dante', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'dante', at: BACK.danteStop, face: 225 }, { do: 'player', look: { of: 'dante', p: [0, 1.6, 0] }, mood: 'sad' }],
              lines: [{ at: 1.4, who: 'dante', text: 'c9.dante.came', seconds: 1.8, mood: 'tired' }] },
            { seconds: 3.0, cam: { from: { of: 'dante', p: [-0.4, 1.68, -0.5] }, look: { of: 'player', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'player', mood: 'smile' }] },
            // Harrow holds out a small glowing card
            { seconds: 4.4, cam: { from: { of: 'harrow', p: [0.6, 1.45, 1.15] }, look: { of: 'harrow', p: [-0.12, 1.12, 0.45] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'harrow', face: 189, look: 'player', pose: 'give' }, { do: 'player', look: { of: 'harrow', p: [0, 1.6, 0] } },
                { do: 'prop', id: 'card', kind: 'accessCard', on: 'harrow', bone: 'hand_R', p: [0.0, -0.08, 0.03], rot: [0, 0, Math.PI / 2] }],
              lines: [{ at: 1.2, who: 'harrow', text: 'c9.harrow.card', seconds: 2.4 }] },
            // it is in Nate's hand now
            { seconds: 3.6, cam: { from: { of: 'player', p: [0.25, 1.62, 0.12] }, look: { of: 'player', p: [-0.07, 1.27, 0.32] }, fov: 26, near: 0.03 },
              do: [{ do: 'remove', ids: ['card'] }, { do: 'actorSet', id: 'harrow', pose: 'idle' }, { do: 'player', pose: 'phone', look: null },
                { do: 'prop', id: 'card', kind: 'accessCard', on: 'player', bone: 'hand_R', p: [0.0, -0.07, 0.03] }] },
            { seconds: 3.8, cam: { from: { of: 'player', p: [0.45, 1.7, -0.45] }, look: { of: 'harrow', p: [0, 1.62, 0] }, fov: 28 },
              do: [{ do: 'player', pose: 'idle', look: { of: 'harrow', p: [0, 1.62, 0] } }],
              lines: [{ at: 0.6, who: 'harrow', text: 'c9.harrow.regret', seconds: 2.6 }] },
            // she turns and goes back to her car
            { seconds: 4.0, cam: { from: { of: 'dante', p: [-0.6, 1.6, 1.6] }, look: { of: 'harrow', p: [0, 1.4, 0] }, fov: 36 },
              do: [{ do: 'actorSet', id: 'harrow', walk: [-484.1, DECK, T(5.0)], speed: 1.5, look: null }, { do: 'actorSet', id: 'dante', look: { of: 'harrow', p: [0, 1.5, 0] } }],
              end: [{ do: 'actorSet', id: 'harrow', seat: 'harrowCar' }, { do: 'vehicleSet', id: 'harrowCar', door: 0 }] },
            // her car pulls away, south, into the rain
            { seconds: 6.0, cam: { from: [-488.2, 9.9, T(-11.5)], to: [-488.0, 10.0, T(-11)], look: [LS[0], 8.9, T(-2)], lookTo: [LS[0], 8.7, T(-55)], fov: 44 },
              do: [{ do: 'sound', name: 'door', kind: 'close' }, { do: 'actorSet', id: 'dante', look: { of: 'harrowCar', p: [0, 1, 0] } }],
              lines: [{ at: 0.6, do: [{ do: 'drive', id: 'harrowCar', path: [[LS[0], T(4)], [LS[0], T(-60)], [LS[1], T(-160)], [LS[1], -300]], speed: 60, end: 'remove' }] }] },
            { seconds: 3.6, cam: { from: { of: 'player', p: [0.5, 1.6, -0.8] }, look: { of: 'dante', p: [0, 1.5, 0] }, fov: 34 }, fade: 'out', fadeSeconds: 2.2,
              do: [{ do: 'actorSet', id: 'dante', look: 'player' }, { do: 'player', look: { of: 'dante', p: [0, 1.6, 0] } }] },
          ],
        },
        { do: 'flag', set: { harrow_switched: true, harrow_access_card: true } },
        { do: 'remove', ids: ['card', 'harrow', 'harrowCar', 'drawing', 'officer', 'dante', 'ph1', 'ph2', 'ph3', 'roadblock', 'flares', 'rear'] },
        { do: 'convoy', stop: true },
        { do: 'light' },
      ],
      flags: { trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle', rask_betrayed_nate: true, harrow_reply: 'silent' },
    },

    // =====================================================================
    // 7. RASK AND MILA - the docks, before dawn. No gameplay. The quiet heart of the chapter.
    // =====================================================================
    {
      id: 'c9m6', title: 'c9.m6',
      setup: [
        LATE,
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'docks', crew: false },
        { do: 'player', at: [OFF.nate[0], OFF.nate[2]], face: 0 },
        { do: 'player', hidden: true },
        { do: 'allow', enter: 'none', move: false },
        ...RASK_OFFICE,
        OFFICE_LAMP,
        { do: 'wanted', stars: 0 },
        { do: 'music', tension: 0, calm: 0, radio: 0 },
      ],
      steps: [
        { do: 'card', over: 'c9.card.docks_over', title: 'c9.card.docks', sub: 'c9.card.docks_sub', seconds: 3.6 },
        {
          do: 'cutscene', shots: [
            // the office over the yards: the rain on the big window, the floodlights outside, an old man at his desk
            { seconds: 6.0, fade: 'in', fadeSeconds: 2.0, cam: { from: [-833.2, 8.25, -345.9], to: [-833.6, 8.2, -346.3], look: [-838, 7.55, -350.1], fov: 42 } },
            // in his hand: Mila's core, its small blue light (over his shoulder)
            { seconds: 5.2, cam: { from: { of: 'rask', p: [-0.62, 1.86, -0.12] }, to: { of: 'rask', p: [-0.6, 1.82, -0.08] }, look: { of: 'rask', p: [-0.05, 1.27, 0.16] }, fov: 28, near: NEAR } },
            // he puts it into the little old machine
            { seconds: 4.6, cam: { from: [-837.66, 7.74, -350.8], to: [-837.7, 7.72, -350.76], look: OFF.slot, fov: 32, near: 0.03 },
              do: [{ do: 'actorSet', id: 'rask', pose: 'putDown', hands: [OFF.slot[0], OFF.slot[1] + 0.07, OFF.slot[2]] }],
              lines: [{ at: 2.4, do: [{ do: 'remove', ids: ['core'] }, { do: 'prop', id: 'core', kind: 'haloCore', at: OFF.slot, face: 0 }, { do: 'sound', name: 'coreClick' }] }] },
            // a soft light wakes on the little round screen; it lights his face
            { seconds: 5.4, cam: { from: [-838.25, 7.62, -350.95], to: [-838.24, 7.62, -350.92], look: { of: 'rask', p: [0, 1.5, 0] }, fov: 32, near: NEAR },
              do: [{ do: 'actorSet', id: 'rask', pose: 'roof', hands: OFF.hands }],
              lines: [{ at: 0.8, do: [{ do: 'propSet', id: 'machine', call: { setOn: 1 } }, MACHINE_LIGHT] }] },
            // a girl's voice. She does not know him.
            { seconds: 4.2, cam: { from: [-837.42, 7.5, -349.98], look: [OFF.machine[0] - 0.05, 7.31, OFF.machine[2] + 0.14], fov: 30, near: NEAR },
              lines: [{ at: 0.6, who: 'mila', kind: 'machine', text: 'c9.mila.hello', seconds: 1.4 }] },
            { seconds: 4.4, cam: { from: [-838.25, 7.62, -350.95], look: { of: 'rask', p: [0, 1.5, 0] }, fov: 28, near: NEAR },
              lines: [{ at: 1.6, who: 'mila', kind: 'machine', text: 'c9.mila.who', seconds: 1.8 }] },
            // he keeps his hand on the desk. A long silence. (The watch on his wrist, stopped at 4:12.)
            { seconds: 7.0, cam: CAM_WRIST, do: [{ do: 'music', silence: 16 }] },
            { seconds: 4.6, cam: { from: [-838.25, 7.62, -350.95], look: { of: 'rask', p: [0, 1.48, 0] }, fov: 24, near: NEAR },
              do: [{ do: 'actorSet', id: 'rask', look: AT_WRIST }] },
            // he takes off the watch
            { seconds: 4.6, cam: { from: [-838.45, 7.5, -350.55], look: [-838.1, 7.38, -350.02], fov: 34, near: NEAR },
              do: [{ do: 'actorSet', id: 'rask', pose: 'work', hands: [-838.1, 7.38, -350.04] }] },
            // and sets it down, gently, face up
            { seconds: 5.0, cam: { from: [-838.58, 7.64, -350.62], look: OFF.watchDesk, fov: 32, near: NEAR },
              do: [{ do: 'remove', ids: ['wwatch'] }, { do: 'actorSet', id: 'rask', pose: 'putDown', hands: [OFF.watchDesk[0], OFF.watchDesk[1] + 0.035, OFF.watchDesk[2]] },
                { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_R', p: [-0.02, 0.07, 0.0] }],
              lines: [{ at: 2.6, do: [{ do: 'remove', ids: ['wwatch'] }, { do: 'prop', id: 'watch', kind: 'stopWatch', at: OFF.watchDesk, face: 200 }] },
                { at: 3.4, do: [{ do: 'actorSet', id: 'rask', pose: 'roof', hands: OFF.hands }] }] },
            // the watch on the desk, and his hand beside it
            { seconds: 6.0, cam: CAM_WATCH },
            // the phone
            { seconds: 4.4, cam: { from: [-839.2, 7.95, -351.2], look: { of: 'rask', p: [0, 1.25, 0] }, fov: 36 },
              do: [{ do: 'actorSet', id: 'rask', pose: 'call', hands: null }, { do: 'propSet', id: 'deskPhone', call: { setHandset: false } },
                { do: 'prop', id: 'handset', kind: 'handset', on: 'rask', bone: 'hand_R', p: [-0.03, 0.06, 0.0], rot: [-1.5708, 3.1416, 0] }, { do: 'sound', name: 'phoneLift' }],
              lines: [{ at: 1.6, do: [{ do: 'sound', name: 'phoneDial' }] }] },
            // "Tell me where to come." - the camera stays on the watch and his hand (the other hand holds the phone at his
            // ear). A soft pad starts with his words.
            { seconds: 6.6, cam: CAM_WATCH,
              do: [{ do: 'actorSet', id: 'rask', pose: 'callDesk', hands: OFF.hands }],
              lines: [
                { at: 1.2, do: [{ do: 'music', calm: 0.4 }] },
                { at: 1.2, who: 'rask', text: 'c9.rask.come', seconds: 2.6, mood: 'sad' },
                { at: 4.2, if: { not: TRUSTED }, who: 'rask', text: 'c9.rask.knew', seconds: 2.4, mood: 'sad' },
              ] },
            { seconds: 4.4, cam: { from: [-833.2, 8.25, -345.9], to: [-833.8, 8.2, -346.4], look: [-838, 7.5, -350.1], fov: 40 }, fade: 'out', fadeSeconds: 3.0 },
          ],
        },
        { do: 'flag', set: { rask_redeemed: true } },
        { do: 'remove', ids: ['rask', 'handset', 'core', 'machine', 'deskPhone', 'watch', 'wwatch', 'wallMap', 'armchair', 'mug'] },
        { do: 'light' },
        { do: 'music', calm: 0 },
        { do: 'player', hidden: false },
      ],
      flags: { trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle', rask_betrayed_nate: true, harrow_reply: 'silent', harrow_switched: true, harrow_access_card: true },
    },

    // =====================================================================
    // 8. ASCEND - back at the safehouse. The TV. Nobody says much.
    // =====================================================================
    {
      id: 'c9m7', title: 'c9.m7',
      setup: [
        { do: 'time', hour: 5.1, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'safehouse', set: true },
        { do: 'safehouse', tvOn: true, lamp: 0.5 },
        // (Lena has turned her chair round to the TV)
        LENA({ face: 115, look: SAFE.tv, mood: 'tired' }),
        ...DANTE(s(2.22, 0.5, -1.0), 149, { pose: 'sit', floorBelow: 0.5, look: SAFE.tv }),
        MACE(s(-1.5, 0, 1.6), 140, { if: MACE_HERE, look: SAFE.tv, mood: 'stern' }),
        { do: 'actor', id: 'vance', model: 'Adrian_Vance', name: 'name.vance', at: s(0, 0, -14), face: 0, fixed: true, mood: 'smirk', look: null },
        { do: 'prop', id: 'laptop', kind: 'laptop', at: SAFE.laptop, face: 0 },
        // on the work table: Harrow's master card, and Theo's mixtape
        // (turned so their words read the right way up from where Nate stands and the camera looks)
        { do: 'prop', id: 'card', kind: 'accessCard', at: s(0.98, 0.768, -1.62), face: 20 },
        { do: 'prop', id: 'tape', kind: 'tape', at: s(1.5, 0.768, -1.56), face: 340 },
        { do: 'player', stage: { at: s(SAFE.nate[0], 0, SAFE.nate[1]), face: 110, pose: 'idle' }, mood: 'tired', look: SAFE.tv },
        { do: 'allow', enter: 'none', move: false },
        { do: 'wanted', stars: 0 },
      ],
      steps: [
        // (black while the TV takes the picture of Vance's face from his model)
        { do: 'fade', to: 'black', seconds: 0 },
        { do: 'safehouse', tv: 'vance', headline: 'c9.tv.headline', ticker: 'c9.tv.ticker' },
        { do: 'remove', ids: ['vance'] },
        {
          do: 'cutscene', shots: [
            // the room before dawn. Everybody looks at the screen.
            { seconds: 5.6, fade: 'in', fadeSeconds: 2.0, cam: { from: s(2.7, 1.72, 2.2), to: s(2.5, 1.7, 2.0), look: s(-1.6, 1.0, -0.4), fov: 52 } },
            // the announcement, low, through the glass of the TV
            { seconds: 8.4, cam: { from: s(-1.2, 1.05, -0.25), to: s(-1.5, 1.02, -0.22), look: SAFE.tv, fov: 34 },
              lines: [{ at: 0.6, who: 'tvVance', kind: 'tv', text: 'c9.vance.ascend', seconds: 7.0 }] },
            // their faces in the blue of the screen
            { seconds: 3.6, cam: { from: s(-0.6, 1.3, -1.2), look: { of: 'dante', p: [0, 0.72, 0] }, fov: 34 } },
            { seconds: 4.2, cam: { from: s(0.2, 1.3, -1.9), to: s(0.25, 1.3, -1.85), look: { of: 'lena', p: [0, 0.72, 0] }, fov: 34, near: NEAR },
              lines: [{ at: 0.9, who: 'lena', text: 'c9.lena.belongs', seconds: 3.0, mood: 'afraid' }] },
            // Nate at the table: he looks at the master card, then at the mixtape
            { seconds: 4.2, cam: { from: s(1.12, 1.06, -1.22), to: s(1.1, 1.03, -1.27), look: s(0.98, 0.77, -1.62), fov: 28, near: NEAR },
              do: [{ do: 'player', stage: { at: s(0.55, 0, -1.02), face: 215, pose: 'idle' }, look: s(0.98, 0.77, -1.62), mood: 'stern' }] },
            { seconds: 4.0, cam: { from: s(1.58, 1.04, -1.2), to: s(1.57, 1.02, -1.24), look: s(1.5, 0.77, -1.56), fov: 26, near: NEAR },
              do: [{ do: 'player', look: s(1.5, 0.77, -1.56), mood: 'sad' }] },
            { seconds: 3.6, cam: { from: s(1.25, 1.55, 0.35), to: s(1.22, 1.55, 0.25), look: s(0.55, 1.55, -1.02), fov: 34 },
              do: [{ do: 'player', look: SAFE.tv, mood: 'stern' }] },
          ],
        },
        // cut to black
        { do: 'fade', to: 'black', seconds: 0.15, wait: true },
        { do: 'flag', set: { ascend_announced: true } },
        { do: 'wait', seconds: 1.6 },
        { do: 'end', over: 'c9.end.over', title: 'c9.title', lines: ['c9.end.1', 'c9.end.2', 'c9.end.3'], locked: 'c9.end.locked' },
      ],
      flags: { trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle', rask_betrayed_nate: true, harrow_reply: 'silent', harrow_switched: true, harrow_access_card: true, rask_redeemed: true },
    },
  ],
};
