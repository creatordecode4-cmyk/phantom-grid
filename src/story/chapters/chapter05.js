// ---------------------------------------------------------------------------
// CHAPTER 5 - "RASK" (the next night)
//
// This file is ONLY DATA, written like chapter04.js. The story engine (src/story/engine.js) explains every word
// used here at its top. The docks themselves (yards, cranes, the channel, Rask's office) are src/city/docks.js and
// their plan is "docks" in src/city/layout.js. All texts are keys of src/story/strings.js.
//
// The night in one line: a map on the garage table, an old man and a stopped watch, a crate past a Guard torch,
// a boat chase in the harbor, a container stolen from a watched yard, a name on a box of minds, a package with a
// drawing inside, and a bank record in the dark.
//
// It uses what earlier chapters left behind: dante_response / jacket_taken (the Chrome Wolves trust Nate now:
// Lena says so). It leaves for later chapters:
//   rask_stance ('honest' | 'paid'), rask_mila_seen, opened_package, mace_payment_seen, confront_mace.
//
// Places: [x, z] on the ground, [x, y, z], { garage: [right, up, toward the street] }, { of: 'car or person',
// p: [left, up, forward] }. Directions are compass degrees (0 north, 90 east, 180 south, 270 west). Speeds are km/h.
// Map: +z is north, -z south (the sea), -x east, +x west. The docks: x -900 .. -499 (east of Neon Mile), z -470 ..
// -300. Dock Road z -403 .. -381. Yard A (west) x -684 .. -522, yard B (east, watched) x -884 .. -728, both z -452
// .. -416 (rows of stacks at z -447.5, -435.5, -423.5; aisles at -441.5 and -429.5). The channel x -714 .. -692.
// Rask's building x -868 .. -808, z -356 .. -318 (the back warehouse below, his office above at 6.4 m).
// ---------------------------------------------------------------------------

const NIGHT = { do: 'time', hour: 23.4, rain: true };
const LATE = { do: 'time', hour: 0.6, rain: true };
const DEEP = { do: 'time', hour: 1.8, rain: true };
const DARK = { do: 'time', hour: 3.2, rain: true };
const DAWN = { do: 'time', hour: 5.5, rain: false };
const HOME = { do: 'time', hour: 23.8, rain: true };
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));
const NEAR = 0.05;

// ---- Mace's garage (the same places as chapter04.js) ----
const G = {
  door: { garage: [-3.6, 0, 3.4] },                 // under the lamp, by the door
  lena: { garage: [-0.55, 0, -1.6] },              // standing at the bench (the opening)
  nate: { garage: [-1.45, 0, -0.75] },             // beside her
  mace: { garage: [-5.6, 0, -2.2] },               // at the back, by Theo's car under its cloth
  map: { garage: [0.25, 0.952, -1.75] },
  stool: { garage: [-0.8, 0, -2.4] },
  lenaSit: { garage: [-0.8, 0.66, -2.4] },          // on the stool at the bench (the last scene)
  laptop: { garage: [0.18, 0.94, -2.4] },
  nateRead: { garage: [-1.35, 0, -1.95] },          // beside her, reading the screen
  chair: { garage: [-4.3, 0, 5.55] },               // Mace's armchair just inside the open door
  maceSit: { garage: [-4.3, 0.42, 5.5] },
  radioBox: { garage: [-3.45, 0, 5.6] },
  radio: { garage: [-3.45, 0.5, 5.6] },
  tarp: { garage: [-6.9, 1.0, -3.6] },
};
const GARAGE_LAMP = { do: 'light', at: { garage: [-3.6, 2.7, 3.8] }, color: 0xffc890, power: 24, range: 9 };
const STREET_SPOT = [-11.9, 72.5];                  // the curb in front of the garage

// ---- the docks ----
const D = {
  gate: [-526, -392],                               // Dock Road, just past the gate of the port
  park: [-799, -361],                               // the apron by Rask's building, between the rails and the wall
  stairs: [-806.8, -355.8],                         // the foot of the steel stairs up to the office
  hallDoor: [-838, -359.6],                         // outside the big door of the back warehouse
  hallIn: [-838, -331],                             // deep inside it
  // the office (its floor is 6.4 m up)
  desk: [-838, 7.19, -350.35],
  raskSit: [-838, 6.88, -351.55],
  nateDesk: [-838, 6.4, -348.95],
  nateDoor: [-828.2, 6.4, -343.3],
  // the test: a crate from the warehouse door to a grey van by the gate of yard B, past a Guard on foot
  crate: [-834.2, -359.2],
  van: [-791.5, -398.5],
  vanBack: [-787.6, -398.5],
  guardCar: [-852, -387.2],
  // the harbor
  berth: [-670.2, -541],                            // Rask's launch at the pier (east side)
  pier: [-666.6, 0.15, -537.5],
  ivo: [-665.6, 0.15, -539.4],
  drop: [-772, -598],                               // where the crate floats
  slip: [-703, -422],                               // the end of the channel: the slip
  slipMan: [-703, -413.2],
  // yard B
  holeOut: [-719, -462], holeIn: [-727.5, -462],
  gateBox: [-806.5, -417.3], gateMid: [-800, -413],
  truck: [-852, -441.5], out: [-800, -398],
  // the back warehouse (the reveal)
  parkTruck: [-838, -325.5], kingpin: [-838, -329.4], crates: [-838, -340.2],
  label: [-837.22, 0.72, -340.79],                  // the paper label on the near crate (the end toward the west)
  nateCrates: [-837.4, -341.9], raskIn: [-829.5, -338.6], raskCrates: [-836.4, -340.55],     // (Rask at the west end of the labelled crate, facing east)
  // the market at dawn
  half: [-690, -377],
  teaWoman: [-531.2, -354.3], teaFront: [-531.2, -349.6],
};

// ---- vehicles ----
const MACE_CAR = (at, face, more = {}) => ({
  do: 'spawn', id: 'maceCar', kind: 'tech_patrol_car', or: 'sedan', at, face, color: [0.42, 0.27, 0.12], enter: true, lights: 'normal', curbSide: true,
  type: { label: "MACE'S STREET CAR", topSpeed: 204, accel: 9.4, grip: 1.1, nitro: true, role: 'car' }, ...more,
});
// Rask's launch: a dark grey-green boat with his crew's white stripe
const LAUNCH = (at, face, more = {}) => ({ do: 'spawn', id: 'launch', kind: 'patrol_boat', at, face, enter: true, tint: [0.2, 0.26, 0.24], limit: 78,
  type: { label: "RASK'S LAUNCH", tone: 'boat' }, ...more });
// THE TRUCK of yard B: the armored van, made bigger, with container 77 on its trailer
const TRUCK = (at, face, more = {}) => ({ do: 'spawn', id: 'truck', kind: 'armored_van', or: 'small_city_car', at, face, scale: 1.18, tint: [0.16, 0.2, 0.24], enter: true,
  type: { label: 'CONTAINER TRUCK', topSpeed: 104, accel: 4.2, grip: 0.9, role: 'car' }, ...more });

// ---- people ----
// VIKTOR RASK (61): the Docks are his. A heavy coat, an old man's slowness, and a child's watch that stopped.
const RASK = (at, face, more = {}) => ({ do: 'actor', id: 'rask', model: 'Viktor_Rask', name: 'name.rask', at, face, pose: 'idle', fixed: true, look: null, mood: 'stern', ...more });
const LENA = (at, face, more = {}) => ({ do: 'actor', id: 'lena', model: 'Lena_Marchetti', name: 'name.lena', at, face, pose: 'idle', fixed: true, look: null, mood: 'stern', ...more });
const MACE = (at, face, more = {}) => ({ do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at, face, pose: 'crossed', fixed: true, look: null, mood: 'stern', ...more });
// the dock crews: orange vests or rain gear (crowd characters)
const VEST = { pants: [0.08, 0.08, 0.09], coat: [0.9, 0.36, 0.04], patch: [0.78, 0.8, 0.74], scarf: [0.1, 0.1, 0.1], head: [0.78, 0.64, 0.08] };
const RAIN_GEAR = { pants: [0.06, 0.06, 0.07], coat: [0.62, 0.52, 0.1], patch: [0.2, 0.2, 0.18], scarf: [0.08, 0.08, 0.08], head: [0.1, 0.1, 0.1] };
const CREW = (id, name, at, face, cloth = VEST, more = {}) => ({ do: 'actor', id, extra: cloth, name, at, face, pose: 'crossed', fixed: true, look: 'player', mood: 'stern', ...more });
// the old woman at the tea stall of the market
const TEA = { pants: [0.12, 0.1, 0.12], coat: [0.28, 0.12, 0.1], patch: [0.6, 0.55, 0.45], scarf: [0.42, 0.36, 0.3], head: [0.62, 0.6, 0.58] };

// ---- the Guard ----
// the test: one officer walks up and down Dock Road with a torch; his car stands at the curb
const TEST_GUARD = [
  { actor: 'officer', name: 'name.guard', path: [[-846, -385.2], [-810, -385.2]], speed: 1.1, stop: 3.2, range: 15, fov: 0.58, sweep: 0.8 },
];
// YARD B at night: three guards on foot, two floodlights on the masts, a drone over the stacks
const YARD_B = [
  { actor: 'g1', name: 'name.guard', path: [[-736, -441.5], [-878, -441.5]], speed: 1.15, stop: 2.6, range: 16, fov: 0.55 },
  { actor: 'g2', name: 'name.guard', path: [[-878, -429.5], [-736, -429.5]], speed: 1.1, stop: 2.2, range: 16, fov: 0.55 },
  { actor: 'g3', name: 'name.guard', path: [[-800, -450.5], [-800, -418.6], [-842, -418.6], [-842, -450.5]], speed: 1.0, stop: 2, range: 15, fov: 0.55 },
  { kind: 'flood', path: [[-804.3, -447.5]], y: 22, face: 0, range: 34, fov: 0.3, sweep: 1.05, sweepSpeed: 0.26 },
  { kind: 'flood', path: [[-846.3, -423.5]], y: 22, face: Math.PI, range: 34, fov: 0.3, sweep: 1.05, sweepSpeed: 0.3 },
  { path: [[-760, -436], [-870, -436]], y: 14, speed: 2.2, range: 16, fov: 0.5, sweep: 0.5, stop: 2.5 },
];
const GUARD_OFF = { do: 'police', real: false, sentries: [], stealth: false, patrol: null };

export default {
  id: 'chapter05',
  number: 5,
  title: 'c5.title',
  vehicle: null,
  getIn: 'c5.get_in',
  // (what a normal game has decided by now; used when a mission is started from the mission list)
  flags: {
    limiter_off: true, ticket_taken: true, mace_kind: true, keystone_found: true, told_mace_video: true, van_color: 0, van_plate: 'PM 2908',
    drone_method: 'quiet', tide_trust: true, lena_code_seen: true, chip_holder: 'lena', chip_to_lena: true,
    mace_gave_car: true, dante_response: 'race', took_shortcut: false, zero_found_race: true, jacket_taken: true,
  },
  preload: { actors: ['Viktor_Rask', 'Lena_Marchetti', 'Mace_Doyle'], vehicles: ['armored_van', 'tech_patrol_car', 'police_coupe'] },

  missions: [
    // =====================================================================
    // 1. MEETING VIKTOR RASK - the map on the garage table, the drive to the docks, an old man who does not offer a
    //    seat, a choice, and a short test: one crate past a Guard's torch.
    // =====================================================================
    {
      id: 'c5m0', title: 'c5.m0',
      setup: [
        NIGHT,
        { do: 'world', traffic: 10, people: 6, indoors: true, now: true },
        { do: 'docks', crew: true },
        { do: 'shutter', open: 0.35, seconds: 0 },
        GARAGE_LAMP,
        { do: 'prop', id: 'map', kind: 'docksMap', at: G.map, face: 0 },
        LENA(G.lena, 180),
        MACE(G.mace, 205, { look: G.tarp }),
        MACE_CAR(STREET_SPOT, 0),
        { do: 'player', at: G.door, face: 90 },
        { do: 'allow', enter: 'none' },
      ],
      steps: [
        { do: 'card', over: 'c5.card.over', title: 'c5.title', sub: 'c5.card.sub', seconds: 4.5 },
        {
          do: 'cutscene',
          shots: [
            // the garage at night, rain on the roof. Lena at the bench with a map of the docks. Mace at the back.
            { seconds: 5.5, fade: 'in', fadeSeconds: 2.2, cam: { from: { garage: [-0.35, 1.75, 1.7] }, to: { garage: [-0.45, 1.72, 1.3] }, look: { garage: [-0.9, 1.25, -1.4] }, fov: 42 },
              do: [{ do: 'player', stage: { at: G.nate, face: 180, pose: 'idle' }, mood: 'tired' }, { do: 'music', calm: 0.4 }] },
            // she points at the sea on the map
            { seconds: 4.4, cam: { from: { garage: [0.35, 1.55, -0.2] }, look: { of: 'lena', p: [0, 1.5, 0] }, fov: 34 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'aim', look: G.map }],
              lines: [{ at: 0.6, who: 'lena', text: 'c5.lena.sea', seconds: 3.2, mood: 'stern' }] },
            { seconds: 3.6, cam: { from: { garage: [-0.2, 1.6, -0.6] }, look: G.map, fov: 30 },
              lines: [{ at: 0.4, who: 'lena', text: 'c5.lena.rask', seconds: 2.8 }] },
            // Mace stops working when she says the name. He looks at the map, then back at the car.
            { seconds: 3.4, cam: { from: { garage: [-3.4, 1.7, -0.2] }, look: { of: 'mace', p: [0, 1.55, 0] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'mace', look: G.map, mood: 'sad' }, { do: 'sound', name: 'clunk' }],
              lines: [{ at: 2.2, do: [{ do: 'actorSet', id: 'mace', look: G.tarp, mood: 'stern' }] }] },
            { seconds: 4.4, cam: { from: { garage: [0.35, 1.55, -0.2] }, look: { of: 'lena', p: [0, 1.5, 0] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'idle', look: 'player' }],
              lines: [{ at: 0.4, who: 'lena', text: 'c5.lena.route', seconds: 3.6, mood: 'stern' }] },
            // (the Chrome Wolves: if Nate raced Dante, or took Theo's jacket, the docks have heard)
            { if: { any: [{ flag: 'dante_response', is: 'race' }, { flag: 'jacket_taken' }] }, seconds: 4.4, cam: { from: { garage: [0.35, 1.55, -0.2] }, look: { of: 'lena', p: [0, 1.5, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'lena', text: 'c5.lena.wolves', seconds: 3.6, mood: 'neutral' }] },
            { seconds: 3.6, cam: { from: { of: 'lena', p: [-0.4, 1.6, 0.9] }, look: { of: 'player', p: [0, 1.55, 0] }, fov: 30 },
              lines: [{ at: 0.3, who: 'nate', text: 'c5.nate.tonight', seconds: 1.6, mood: 'stern' }, { at: 1.9, who: 'lena', text: 'c5.lena.waiting', seconds: 1.6 }] },
          ],
        },
        { do: 'music', calm: 0 },
        { do: 'player', stage: null, at: G.door, face: 270 },
        { do: 'world', indoors: false },
        { do: 'shutter', open: 1, seconds: 2.2 },
        { do: 'allow', enter: ['maceCar'] },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: G.door, face: 270 }, { do: 'shutter', open: 1, seconds: 0 }, { do: 'allow', enter: ['maceCar'] }] },
        { do: 'enter', text: 'c5.obj.car', vehicle: 'maceCar' },
        { do: 'driveTo', text: 'c5.obj.docks', vehicle: 'maceCar', at: D.gate, radius: 16 },
        // the man at the gate knows who is coming
        CREW('gateman', 'name.docker', [-517.2, -379.4], 135, RAIN_GEAR),
        { do: 'say', who: 'docker', actor: 'gateman', text: 'c5.gate.up' },
        { do: 'driveTo', text: 'c5.obj.office', vehicle: 'maceCar', at: D.park, radius: 9, stop: true },
        { do: 'leave', text: 'c5.obj.leave' },
        { do: 'goto', text: 'c5.obj.stairs', at: D.stairs, radius: 1.8 },

        // ---- the office ----
        { do: 'fade', to: 'black', seconds: 0.8, wait: true },
        { do: 'world', indoors: true },
        { do: 'light', at: [-837.6, 9.3, -349.8], color: 0xffc890, power: 9, range: 8 },
        { do: 'prop', id: 'wallMap', kind: 'docksMap', at: [-838, 8.4, -342.25], rot: [-Math.PI / 2, 0, 0], scale: 2.6 },
        RASK(D.raskSit, 0, { pose: 'sit', floorBelow: 0.48 }),
        { do: 'prop', id: 'watch', kind: 'stopWatch', at: D.desk, face: 20 },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the office over the yard: the window full of floodlights and containers, an old man behind a desk. He does
            // not look up. On the desk, face up, a child's wristwatch.
            { seconds: 6, fade: 'in', fadeSeconds: 1.6, cam: { from: [-827.4, 8.35, -342.9], to: [-827.8, 8.3, -343.3], look: [-838, 7.5, -351.2], fov: 44 },
              do: [{ do: 'player', stage: { at: D.nateDoor, face: 270, pose: 'idle' }, mood: 'stern' }, { do: 'music', silence: 14 }] },
            { seconds: 4.2, cam: { from: [-838.0, 7.38, -350.08], look: [-838.0, 7.19, -350.35], fov: 22, near: NEAR } },
            // Nate in front of the desk. There is no chair for him.
            { seconds: 3.6, cam: { from: [-836.9, 7.85, -352.2], look: [-838, 7.95, -348.95], fov: 34 },
              do: [{ do: 'player', stage: { at: D.nateDesk, face: 180, pose: 'idle' } }] },
            { seconds: 5.2, cam: { from: [-838.55, 8.05, -348.0], look: [-838, 7.65, -351.55], fov: 30 },
              do: [{ do: 'actorSet', id: 'rask', look: 'player' }],
              lines: [{ at: 0.8, who: 'rask', text: 'c5.rask.carry', seconds: 4.0, mood: 'stern' }] },
          ],
        },
        // CHOICE: what kind of man stands in front of him
        { do: 'choice', options: [{ text: 'c5.ch.crooks', set: { rask_stance: 'honest' } }, { text: 'c5.ch.pay', set: { rask_stance: 'paid' } }] },
        {
          do: 'cutscene',
          shots: [
            { if: { flag: 'rask_stance', is: 'honest' }, seconds: 4.8, cam: { from: [-836.9, 7.85, -352.2], look: [-838, 7.95, -348.95], fov: 30 },
              lines: [{ at: 0.3, who: 'nate', text: 'c5.nate.crooks', seconds: 2.4, mood: 'stern' }] },
            { if: { flag: 'rask_stance', is: 'honest' }, seconds: 5.2, cam: { from: [-838.55, 8.05, -348.0], look: [-838, 7.65, -351.55], fov: 28 },
              lines: [{ at: 0.6, who: 'rask', text: 'c5.rask.honest', seconds: 4.0, mood: 'stern' }] },
            { if: { flag: 'rask_stance', is: 'paid' }, seconds: 4.4, cam: { from: [-836.9, 7.85, -352.2], look: [-838, 7.95, -348.95], fov: 30 },
              lines: [{ at: 0.3, who: 'nate', text: 'c5.nate.pay', seconds: 2.4, mood: 'stern' }] },
            { if: { flag: 'rask_stance', is: 'paid' }, seconds: 4.6, cam: { from: [-838.55, 8.05, -348.0], look: [-838, 7.65, -351.55], fov: 28 },
              lines: [{ at: 0.6, who: 'rask', text: 'c5.rask.paid', seconds: 3.4, mood: 'neutral' }] },
            // the job: one crate, past the Guard
            { seconds: 6.4, cam: { from: [-840.2, 8.4, -347.6], look: [-838, 7.4, -351.4], fov: 36 },
              lines: [{ at: 0.4, who: 'rask', text: 'c5.rask.test', seconds: 3.4 }, { at: 3.9, who: 'rask', text: 'c5.rask.slow', seconds: 2.4 }] },
            // he looks at the watch, not at Nate, when he sends him away
            { seconds: 3.6, cam: { from: [-838.0, 7.42, -350.0], look: [-838.0, 7.19, -350.35], fov: 26, near: NEAR },
              do: [{ do: 'actorSet', id: 'rask', look: D.desk }] },
          ],
        },
        { do: 'remove', ids: ['rask', 'watch', 'wallMap'] },
        { do: 'light' },
        { do: 'world', indoors: false },
        // ---- THE TEST: a crate from the warehouse door to the grey van by the gate of yard B ----
        { do: 'spawn', id: 'van', kind: 'armored_van', or: 'small_city_car', at: D.van, face: 90, tint: [0.3, 0.31, 0.32], type: { label: 'GREY VAN', role: 'car' } },
        { do: 'spawn', id: 'guardCar', kind: 'police_coupe', or: 'tech_patrol_car', at: D.guardCar, face: 270, npc: true, flash: true },
        { do: 'prop', id: 'testCrate', kind: 'crate', at: D.crate, face: 10 },
        { do: 'player', stage: null, at: [-836.6, -360.6], face: 180 },
        { do: 'fade', to: 'clear', seconds: 0.9 },
        { do: 'police', real: true, known: false, cars: 0, drones: 0, boats: 0, gates: false, roadblocks: false, stealth: true, startStars: 1, sentries: TEST_GUARD },
        { do: 'checkpoint', id: 2, setup: [{ do: 'player', at: [-836.6, -360.6], face: 180 }, { do: 'prop', id: 'testCrate', kind: 'crate', at: D.crate, face: 10, replace: true },
          { do: 'police', real: true, known: false, cars: 0, drones: 0, boats: 0, stealth: true, startStars: 1, sentries: TEST_GUARD }] },
        { do: 'tip', text: 'c5.tip.carry', seconds: 8 },
        { do: 'music', tension: 0.3 },
        { do: 'carryTo', prop: 'testCrate', at: D.vanBack, radius: 2.4, text: 'c5.obj.crate', pickText: 'c5.obj.pick_crate', heavy: 0.6,
          on: [{ spotted: true, fail: 'c5.fail.crate' }] },
        { do: 'music', tension: 0 },
        { do: 'sound', name: 'thump' },
        GUARD_OFF,
        { do: 'remove', ids: ['officer', 'officer_torch'] },
        { do: 'say', who: 'rask', text: 'c5.rask.can_carry', kind: 'radio' },
        { do: 'wait', seconds: 2 },
      ],
    },

    // =====================================================================
    // 2. BOAT CHASE: THE LATE SHIPMENT - Rask's boat was stopped at sea; its crate went over the side. Tail the Guard
    //    cutter that looks for it, take the crate first, and get away through Rask's channel.
    // =====================================================================
    {
      id: 'c5m1', title: 'c5.m1',
      flags: { rask_stance: 'honest' },
      setup: [
        LATE,
        { do: 'world', traffic: 6, people: 4 },
        { do: 'docks', crew: true },
        LAUNCH(D.berth, 180),
        CREW('ivo', 'name.ivo', D.ivo, 90, RAIN_GEAR, { look: 'player' }),
        { do: 'spawn', id: 'cutter', kind: 'patrol_boat', at: [-610, -632], face: 90, npc: true, flash: true, tint: [0.24, 0.27, 0.34], type: { label: 'GUARD CUTTER', tone: 'boat' } },
        { do: 'player', at: D.pier, face: 90 },
        { do: 'allow', enter: ['launch'] },
        // floating junk between the drop and the channel: planks to jump from
        { do: 'prop', id: 'ramp1', kind: 'debrisRamp', at: [-760, -566], face: 331, len: 7, w: 3.4, h: 1.3 },
        { do: 'prop', id: 'ramp2', kind: 'debrisRamp', at: [-731, -523], face: 331, len: 6.5, w: 3.2, h: 1.2 },
        { do: 'prop', id: 'ramp3', kind: 'debrisRamp', at: [-792, -530], face: 18, len: 7, w: 3.4, h: 1.4 },
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            // the pier at night. Rain on the water. A man in rain gear with a radio.
            { seconds: 4.6, fade: 'in', fadeSeconds: 1.8, cam: { from: [-664.0, 2.0, -531.0], look: [-667.4, 0.9, -541.5], fov: 44 },
              lines: [{ at: 0.8, who: 'ivo', text: 'c5.ivo.late', seconds: 3.4 }] },
            { seconds: 4.4, cam: { from: { of: 'ivo', p: [0.5, 1.6, 2.6] }, look: { of: 'ivo', p: [0, 1.55, 0] }, fov: 34 },
              lines: [{ at: 0.3, who: 'ivo', text: 'c5.ivo.dumped', seconds: 3.6 }] },
            { if: { flag: 'rask_stance', is: 'paid' }, seconds: 3.4, cam: { from: { of: 'ivo', p: [0.5, 1.6, 2.6] }, look: { of: 'ivo', p: [0, 1.55, 0] }, fov: 32 },
              lines: [{ at: 0.3, who: 'ivo', text: 'c5.ivo.paid', seconds: 2.8 }] },
            { if: { flag: 'rask_stance', is: 'honest' }, seconds: 3.4, cam: { from: { of: 'ivo', p: [0.5, 1.6, 2.6] }, look: { of: 'ivo', p: [0, 1.55, 0] }, fov: 32 },
              lines: [{ at: 0.3, who: 'ivo', text: 'c5.ivo.honest', seconds: 2.8 }] },
            // the Guard cutter out at sea, its searchlight on the water
            { seconds: 4.8, cam: { from: [-664, 4.5, -546], look: [-610, 0, -632], fov: 30 },
              lines: [{ at: 0.5, who: 'rask', text: 'c5.rask.follow', seconds: 3.8, kind: 'radio' }] },
          ],
        },
        { do: 'drive', id: 'cutter', path: [[-650, -640], [-700, -652], [-752, -646], [-790, -626], [-800, -604], [-786, -588]], speed: 24, event: 'cutter:turn' },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: D.pier, face: 90 }, { do: 'allow', enter: ['launch'] }] },
        { do: 'enter', text: 'c5.obj.boat', vehicle: 'launch', tip: 'c5.tip.boat', tipSeconds: 8 },
        { do: 'music', tension: 0.35 },
        { do: 'follow', vehicle: 'cutter', text: 'c5.obj.tail', far: 115, farLine: { who: 'rask', text: 'c5.rask.far', kind: 'radio' }, failFar: 230, failText: 'c5.fail.lost',
          until: { event: 'cutter:turn' },
          on: [{ carNear: 'cutter', radius: 28, hold: 2.4, do: [{ do: 'flag', set: { cutter_saw: true } }, { do: 'fire', event: 'cutter:turn' }] }] },
        // the cutter gives up and turns away; a small light blinks on the water
        { do: 'drive', id: 'cutter', path: [[-740, -650], [-620, -720], [-480, -800]], speed: 34 },
        { do: 'prop', id: 'fcrate', kind: 'floatCrate', at: [D.drop[0], -1.0, D.drop[1]], face: 30 },
        { do: 'say', who: 'rask', text: 'c5.rask.light', kind: 'radio' },
        { do: 'pickup', prop: 'fcrate', radius: 5.5, text: 'c5.obj.crate_water' },
        { do: 'sound', name: 'thump' },
        // ---- THE CHASE: two Guard boats; out through Rask's channel ----
        { do: 'remove', ids: ['cutter'] },
        { do: 'police', real: true, known: false, cars: 0, drones: 0, boats: 2, gates: false, roadblocks: false, stealth: false, ram: true, startStars: 2 },
        { do: 'police', stars: 2, seen: true },
        { do: 'music', tension: 0.75 },
        { do: 'checkpoint', id: 2, setup: [LAUNCH([-770, -592], 330, { replace: true }), { do: 'player', inCar: 'launch' }, { do: 'allow', enter: ['launch'] },
          { do: 'police', real: true, known: false, cars: 0, drones: 0, boats: 2, stealth: false, ram: true, startStars: 2 }, { do: 'police', stars: 2, seen: true }, { do: 'music', tension: 0.75 }] },
        { do: 'tip', text: 'c5.tip.ram', seconds: 9 },
        { do: 'driveTo', text: 'c5.obj.channel', vehicle: 'launch', at: D.slip, radius: 7,
          on: [{ zone: { x: [-716, -690], z: [-470, -414] }, do: [{ do: 'say', who: 'rask', text: 'c5.rask.channel', kind: 'radio' }] }] },
        // the Guard does not come into Rask's channel
        { do: 'police', stars: 0 },
        GUARD_OFF,
        { do: 'music', tension: 0 },
        CREW('ivo2', 'name.ivo', [D.slipMan[0], D.slipMan[1]], 180, RAIN_GEAR),
        { do: 'say', who: 'ivo', actor: 'ivo2', text: 'c5.ivo.dry' },
        { do: 'leave', text: 'c5.obj.leave_boat' },
        { do: 'wait', seconds: 1.5 },
      ],
    },

    // =====================================================================
    // 3. CARGO THEFT: CONTAINER 77 - into the watched yard through a cut in the fence, the gate box (hack), the truck
    //    with container 77 on its trailer, and out. Being seen is not the end: then it is a chase.
    // =====================================================================
    {
      id: 'c5m2', title: 'c5.m2',
      flags: { rask_stance: 'honest' },
      setup: [
        DEEP,
        { do: 'world', traffic: 4, people: 0 },
        { do: 'docks', crew: false },
        TRUCK(D.truck, 270, { cargo: { kind: 'trailer', label: '77', heavy: 0.6, color: [0.11, 0.2, 0.27] } }),
        { do: 'prop', id: 'gateB', kind: 'yardGate', at: D.gateMid, face: 0, w: 8.4 },
        { do: 'player', at: [-716.5, -455], face: 180 },
        { do: 'allow', enter: 'none' },
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            // yard B from the quay: floodlights, guards with torches, the gantry crane moving over the stacks
            { seconds: 5.4, fade: 'in', fadeSeconds: 2, cam: { from: [-718, 14, -452], to: [-719, 14, -448], look: [-805, 0, -432], fov: 46 },
              do: [{ do: 'police', real: true, known: false, cars: 2, drones: 0, boats: 0, gates: false, roadblocks: false, stealth: true, startStars: 2, sentries: YARD_B }],
              lines: [{ at: 0.8, who: 'rask', text: 'c5.rask.77', seconds: 4.2, kind: 'radio' }] },
            { seconds: 4.4, cam: { from: [-719.5, 1.7, -467.5], look: [-724, 1.0, -462], fov: 40 },
              lines: [{ at: 0.4, who: 'rask', text: 'c5.rask.why', seconds: 3.8, kind: 'radio' }] },
          ],
        },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: [-716.5, -455], face: 180 },
          { do: 'police', real: true, known: false, cars: 2, drones: 0, boats: 0, stealth: true, startStars: 2, sentries: YARD_B }] },
        { do: 'music', tension: 0.45 },
        { do: 'goto', text: 'c5.obj.hole', at: D.holeIn, radius: 2.2, tip: 'c5.tip.sneak', tipSeconds: 8 },
        // ---- the gate box ----
        { do: 'waitFor', text: 'c5.obj.gatebox', marker: D.gateBox, until: { any: [{ near: D.gateBox, radius: 1.7 }, { spotted: true }] } },
        { do: 'hack', title: 'c5.hack.gate', sub: 'c5.hack.gate_sub', seconds: 16, length: 6, flag: 'gate_hacked', if: { not: { spotted: true } },
          ok: [{ do: 'sound', name: 'beep' }], fail: [{ do: 'police', stars: 2, seen: true }] },
        // the gate slides open (after the hack; or the alarm opens it for the Guard's cars)
        { do: 'remove', ids: ['gateB'] },
        { do: 'prop', id: 'gateBopen', kind: 'yardGate', at: D.gateMid, face: 0, w: 8.4, open: true },
        { do: 'sound', name: 'clunk' },
        { do: 'allow', enter: ['truck'] },
        { do: 'say', who: 'rask', text: 'c5.rask.gate', kind: 'radio', if: { not: { spotted: true } } },
        { do: 'checkpoint', id: 2, setup: [{ do: 'remove', ids: ['gateB'] }, { do: 'prop', id: 'gateBopen', kind: 'yardGate', at: D.gateMid, face: 0, w: 8.4, open: true, replace: true },
          { do: 'player', at: [-808.5, -419.6], face: 180 }, { do: 'allow', enter: ['truck'] },
          { do: 'police', real: true, known: false, cars: 2, drones: 0, boats: 0, stealth: true, startStars: 2, sentries: YARD_B }] },
        // ---- the truck ----
        { do: 'enter', text: 'c5.obj.truck', vehicle: 'truck', tip: 'c5.tip.truck', tipSeconds: 9 },
        { do: 'music', tension: 0.6 },
        { do: 'driveTo', text: 'c5.obj.out', vehicle: 'truck', at: D.out, radius: 7, on: [{ event: 'cargo:broken', fail: 'c5.fail.cargo' }] },
        // out of the yard: the guards on foot stay behind
        { do: 'police', sentries: [], stealth: false },
        { do: 'remove', ids: ['g1', 'g1_torch', 'g2', 'g2_torch', 'g3', 'g3_torch'] },
        // a chase? then lose them first - never lead the Guard to Rask's door
        { do: 'waitFor', text: 'c5.obj.lose', until: { starsUnder: 1 }, if: { starsOver: 0 }, on: [{ event: 'cargo:broken', fail: 'c5.fail.cargo' }] },
        { do: 'say', who: 'rask', text: 'c5.rask.come', kind: 'radio' },
        { do: 'driveTo', text: 'c5.obj.warehouse', vehicle: 'truck', at: D.hallIn, radius: 7, stop: true,
          on: [{ event: 'cargo:broken', fail: 'c5.fail.cargo' }, { starsOver: 0, hold: 0.5, fail: 'c5.fail.followed' }] },
        { do: 'music', tension: 0 },
        GUARD_OFF,
        { do: 'flag', set: { container_taken: true } },
        { do: 'wait', seconds: 1.2 },
      ],
    },

    // =====================================================================
    // 4. REVEAL - the container is opened in the back warehouse. HALO cores in rows, cold blue light. A name on one
    //    of them. An old man's hand on a box, a stopped watch. No music.
    // =====================================================================
    {
      id: 'c5m3', title: 'c5.m3',
      flags: { rask_stance: 'honest', container_taken: true },
      setup: [
        DARK,
        { do: 'world', traffic: 2, people: 0, indoors: true, now: true },
        { do: 'docks', crew: false },
        TRUCK(D.parkTruck, 0, { enter: false }),
        { do: 'prop', id: 'box77', kind: 'openContainer', at: D.kingpin, face: 0, label: '77' },
        { do: 'prop', id: 'crates', kind: 'haloCrates', at: D.crates, face: 0, rows: 2, cols: 3 },
        { do: 'player', at: [-838.6, -347.6], face: 0 },
        { do: 'allow', enter: 'none' },
      ],
      steps: [
        { do: 'music', silence: 60 },
        { do: 'light', at: [-838, 1.6, -339.2], color: 0x7fb4ff, power: 10, range: 9 },
        {
          do: 'cutscene', skippable: true,
          shots: [
            // the dark hall. The container's doors stand open; cold blue light falls out of it.
            { seconds: 6, fade: 'in', fadeSeconds: 2.4, cam: { from: [-842.6, 2.6, -350.5], to: [-842.2, 2.5, -349.8], look: [-838, 1.8, -336.5], fov: 46 },
              do: [{ do: 'player', stage: { at: [-838.6, -347.6], face: 0, pose: 'idle' }, mood: 'stern' }] },
            // inside: rows of small units, each with a thin blue light
            { seconds: 5.2, cam: { from: [-838.0, 2.85, -337.8], to: [-838.0, 2.85, -336.9], look: [-838, 2.3, -330.5], fov: 50, near: NEAR } },
            // the crates in front of the doors, glass lids, a core in each
            { seconds: 4.4, cam: { from: [-839.8, 1.7, -342.6], look: [-838, 0.85, -340.2], fov: 40 },
              do: [{ do: 'player', stage: { at: D.nateCrates, face: 0, pose: 'idle' } }] },
            // a paper label on one of them
            { seconds: 4.4, cam: { from: [-836.75, 0.94, -341.45], look: D.label, fov: 22, near: NEAR } },
            // Nate stops.
            { seconds: 4.6, cam: { from: [-837.0, 1.15, -339.0], look: [-837.25, 1.6, -341.5], fov: 30 },
              do: [{ do: 'player', mood: 'sad' }] },
            // Rask has come in without a sound. He puts his hand flat on the crate and looks at his watch.
            { seconds: 6.4, cam: { from: [-843.2, 1.8, -342.2], look: [-836.5, 1.3, -340.6], fov: 38 },
              do: [{ do: 'actor', id: 'rask', model: 'Viktor_Rask', name: 'name.rask', at: D.raskIn, face: 270, pose: 'idle', fixed: true, look: null, mood: 'sad' },
                { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_L', p: [0, 0.004, 0], wrist: true, band: 1.4 },
                { do: 'actorSet', id: 'rask', walk: D.raskCrates, speed: 1.0, then: 90 }] },
            { seconds: 5.0, cam: { from: [-840.0, 1.7, -343.6], look: [-836.6, 1.15, -340.7], fov: 40 },
              do: [{ do: 'actorSet', id: 'rask', at: D.raskCrates, face: 90, pose: 'hold', look: D.label }] },
            // the watch on his wrist: stopped. Hold it. Nothing is said. (He looks at it: the back of the wrist turned up.)
            { seconds: 7.5, cam: { from: { of: 'rask', p: [0.34, 1.64, -0.06] }, look: { of: 'rask', p: [0.02, 1.22, 0.2] }, fov: 24, near: NEAR },
              do: [{ do: 'actorSet', id: 'rask', pose: 'watch', look: { of: 'rask', p: [0.02, 1.2, 0.32] } }] },
            { seconds: 6.5, cam: { from: { of: 'rask', p: [-0.35, 1.7, 1.25] }, look: { of: 'rask', p: [0, 1.62, 0] }, fov: 28 },
              do: [{ do: 'actorSet', id: 'rask', pose: 'hold', look: null }] },
            // then, quietly
            { seconds: 6.2, cam: { from: { of: 'rask', p: [-0.35, 1.7, 1.25] }, look: { of: 'rask', p: [0, 1.62, 0] }, fov: 26 },
              lines: [{ at: 1.4, who: 'rask', text: 'c5.rask.mila', seconds: 4.2, mood: 'sad' }] },
            { seconds: 4.6, fade: 'out', fadeSeconds: 3, cam: { from: [-837.0, 1.15, -339.0], look: [-837.25, 1.6, -341.5], fov: 30 } },
          ],
        },
        { do: 'flag', set: { rask_mila_seen: true } },
        { do: 'light' },
        { do: 'world', indoors: false },
        { do: 'player', stage: null },
        { do: 'wait', seconds: 0.5 },
      ],
    },

    // =====================================================================
    // 5. TRUST - dawn. A sealed package to the tea stall of the market. Open it or not.
    // =====================================================================
    {
      id: 'c5m4', title: 'c5.m4',
      flags: { rask_stance: 'honest', container_taken: true, rask_mila_seen: true },
      setup: [
        DAWN,
        { do: 'world', traffic: 6, people: 0 },
        { do: 'docks', crew: true },
        RASK([-838, -357.4], 180, { look: 'player' }),
        { do: 'prop', id: 'wwatch', kind: 'stopWatch', on: 'rask', bone: 'hand_L', p: [0, 0.004, 0], wrist: true, band: 1.4 },
        { do: 'actor', id: 'tea', extra: TEA, name: 'name.tea', at: D.teaWoman, face: 0, pose: 'crossed', fixed: true, look: 'player', mood: 'neutral' },
        { do: 'prop', id: 'tin', kind: 'tin', at: [-530.3, 0.9, -352.3], face: 15 },
        { do: 'player', at: [-838, -359.6], face: 0 },
        { do: 'allow', enter: 'none' },
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            // grey morning light at the big door. Gulls. Rask holds out a small package.
            { seconds: 5, fade: 'in', fadeSeconds: 2, cam: { from: [-833.4, 1.7, -362.4], look: [-838.4, 1.4, -358.4], fov: 40 },
              do: [{ do: 'prop', id: 'pkg', kind: 'sealedPackage', on: 'rask', carry: true }],
              lines: [{ at: 0.9, who: 'rask', text: 'c5.rask.package', seconds: 3.6 }] },
            { if: { flag: 'rask_stance', is: 'honest' }, seconds: 4.2, cam: { from: { of: 'player', p: [0.4, 1.75, -0.6] }, look: { of: 'rask', p: [0, 1.62, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'rask', text: 'c5.rask.honest2', seconds: 3.4 }] },
            { if: { flag: 'rask_stance', is: 'paid' }, seconds: 4.2, cam: { from: { of: 'player', p: [0.4, 1.75, -0.6] }, look: { of: 'rask', p: [0, 1.62, 0] }, fov: 30 },
              lines: [{ at: 0.4, who: 'rask', text: 'c5.rask.paid2', seconds: 3.4 }] },
          ],
        },
        { do: 'remove', ids: ['pkg'] },
        { do: 'actorSet', id: 'rask', pose: 'crossed' },
        { do: 'player', carry: { kind: 'sealedPackage', heavy: 0 } },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: [-838, -359.6], face: 180 }, { do: 'player', carry: { kind: 'sealedPackage', heavy: 0 } }] },
        { do: 'goto', text: 'c5.obj.market', at: D.half, radius: 4 },
        // halfway: he stops under a lamp and looks at it
        {
          do: 'cutscene', keep: true,
          shots: [
            { seconds: 4.2, cam: { from: { of: 'player', p: [0.7, 1.6, 1.4] }, look: { of: 'player', p: [0, 1.05, 0.35] }, fov: 34 },
              do: [{ do: 'player', stage: { at: D.half, face: 270, pose: 'carry' } }] },
          ],
        },
        // CHOICE: open the package, or leave it sealed
        { do: 'choice', options: [{ text: 'c5.ch.open', set: { opened_package: true } }, { text: 'c5.ch.sealed', set: { opened_package: false } }] },
        {
          do: 'cutscene',
          shots: [
            // the seal breaks. Inside, a child's drawing of a ship: a red ship, two people on its deck, a yellow sun.
            { if: { flag: 'opened_package' }, seconds: 3.2, cam: { from: { of: 'player', p: [0.3, 1.58, 0.2] }, look: { of: 'player', p: [0, 1.06, 0.33] }, fov: 32, near: NEAR },
              do: [{ do: 'sound', name: 'cloth' }] },
            { if: { flag: 'opened_package' }, seconds: 6.4, cam: { from: { of: 'player', p: [0, 1.53, 0.27] }, look: { of: 'player', p: [0, 1.06, 0.3] }, fov: 36, near: NEAR },
              do: [{ do: 'player', carry: { kind: 'sealedPackage', heavy: 0, open: true } }] },
            { if: { flag: 'opened_package' }, seconds: 3.4, cam: { from: { of: 'player', p: [0.7, 1.6, 1.4] }, look: { of: 'player', p: [0, 1.5, 0] }, fov: 32 },
              do: [{ do: 'player', mood: 'sad' }] },
            { if: { flag: 'opened_package', is: false }, seconds: 3.4, cam: { from: { of: 'player', p: [0.7, 1.6, 1.4] }, look: { of: 'player', p: [0, 1.5, 0] }, fov: 32 } },
          ],
        },
        { do: 'player', stage: null, at: D.half, face: 270 },
        { do: 'player', carry: { kind: 'sealedPackage', heavy: 0 } },
        { do: 'talk', text: 'c5.obj.tea', actor: 'tea', radius: 2.8, label: 'ui.give' },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.4, cam: { from: { of: 'tea', p: [-0.6, 1.5, 1.8] }, look: { of: 'tea', p: [0, 1.3, 0] }, fov: 32 },
              do: [{ do: 'player', stage: { at: D.teaFront, face: 180, pose: 'carry' } }, { do: 'actorSet', id: 'tea', pose: 'hold' }],
              lines: [{ at: 1.4, do: [{ do: 'player', carry: null }, { do: 'prop', id: 'pkgT', kind: 'sealedPackage', on: 'tea', carry: true }] }] },
            { if: { flag: 'opened_package' }, seconds: 4.4, cam: { from: { of: 'tea', p: [-0.6, 1.5, 1.8] }, look: { of: 'tea', p: [0, 1.3, 0] }, fov: 28 },
              lines: [{ at: 0.6, who: 'tea', text: 'c5.tea.opened', seconds: 2.8, mood: 'sad' }] },
            { if: { flag: 'opened_package', is: false }, seconds: 4.0, cam: { from: { of: 'tea', p: [-0.6, 1.5, 1.8] }, look: { of: 'tea', p: [0, 1.3, 0] }, fov: 28 },
              lines: [{ at: 0.6, who: 'tea', text: 'c5.tea.sealed', seconds: 2.6 }] },
            // she puts it in a tin with the others
            { seconds: 4.6, cam: { from: [-531.6, 1.55, -351.2], look: [-530.4, 0.95, -352.3], fov: 32 },
              do: [{ do: 'actorSet', id: 'tea', look: [-530.3, 0.95, -352.3] }],
              lines: [{ at: 0.6, do: [{ do: 'remove', ids: ['pkgT'] }] }, { at: 0.8, who: 'tea', text: 'c5.tea.keep', seconds: 3.2, mood: 'sad' }] },
          ],
        },
        { do: 'remove', ids: ['pkgT'] },
        { do: 'player', stage: null, at: D.teaFront, face: 0 },
        { do: 'say', who: 'rask', text: 'c5.rask.trust', kind: 'radio', if: { flag: 'opened_package', is: false } },
        { do: 'say', who: 'rask', text: 'c5.rask.looked', kind: 'radio', if: { flag: 'opened_package' } },
        { do: 'wait', seconds: 2.5 },
      ],
    },

    // =====================================================================
    // 6. THE END OF ACT ONE - Mace's garage at night. Lena in the dark with a bank record on her screen. Mace asleep in
    //    his chair by the door, the radio on. A choice, and the rain.
    // =====================================================================
    {
      id: 'c5m5', title: 'c5.m5',
      flags: { rask_stance: 'honest', container_taken: true, rask_mila_seen: true, opened_package: false },
      setup: [
        HOME,
        { do: 'world', traffic: 6, people: 2, indoors: true, now: true },
        { do: 'shutter', open: 1, seconds: 0 },
        { do: 'prop', id: 'stool', kind: 'stool', at: G.stool },
        { do: 'prop', id: 'bank', kind: 'bankLaptop', at: G.laptop, face: 0 },
        LENA(G.lenaSit, 180, { pose: 'sitEdge', floorBelow: 0.66, look: G.laptop }),
        { do: 'prop', id: 'chair', kind: 'armchair', at: G.chair, face: 270 },
        MACE(G.maceSit, 270, { pose: 'sit', floorBelow: 0.42, mood: 'asleep' }),
        { do: 'prop', id: 'rbox', kind: 'crate', at: G.radioBox, face: 270 },
        { do: 'prop', id: 'radio', kind: 'radio', at: G.radio, face: 300 },
        { do: 'player', at: STREET_SPOT, face: 90 },
        { do: 'allow', enter: 'none' },
      ],
      steps: [
        { do: 'goto', text: 'c5.obj.garage', at: G.door, radius: 1.8 },
        { do: 'light', at: { garage: [0.1, 1.2, -2.0] }, color: 0x8fb6e8, power: 6, range: 5 },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the garage without its lamp. Only her screen. Mace asleep by the door, the radio low.
            { seconds: 5.2, cam: { from: { garage: [-5.5, 2.0, -1.0] }, to: { garage: [-5.3, 1.95, -0.6] }, look: { garage: [-0.8, 1.0, -2.2] }, fov: 38 },
              do: [{ do: 'player', stage: { at: G.nateRead, face: 180, pose: 'idle' }, mood: 'tired' }, { do: 'music', calm: 0.3 }] },
            { seconds: 4.0, cam: { from: { garage: [0.3, 1.02, -1.75] }, look: { of: 'lena', p: [0, 0.72, 0.1] }, fov: 34 },
              lines: [{ at: 0.6, who: 'lena', text: 'c5.lena.come', seconds: 2.4, mood: 'sad' }] },
            // the screen
            { seconds: 4.0, cam: { from: { garage: [-0.25, 1.3, -1.7] }, look: { garage: [0.17, 1.06, -2.4] }, fov: 28, near: NEAR } },
          ],
        },
        { do: 'read', kind: 'phone', from: 'c5.bank.from', text: 'c5.bank.text', when: 'c5.bank.when', buttons: [{ text: 'c5.read.again' }] },
        {
          do: 'cutscene', keep: true,
          shots: [
            // he reads it again
            { seconds: 3.2, cam: { from: { garage: [0.15, 1.3, -1.6] }, look: { of: 'player', p: [0, 1.6, 0] }, fov: 30 },
              do: [{ do: 'player', mood: 'sad' }] },
          ],
        },
        { do: 'read', kind: 'phone', from: 'c5.bank.from', text: 'c5.bank.text', when: 'c5.bank.when' },
        {
          do: 'cutscene', keep: true,
          shots: [
            { seconds: 4.6, cam: { from: { garage: [0.3, 1.02, -1.75] }, look: { of: 'lena', p: [0, 0.72, 0.1] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'lena', look: 'player' }],
              lines: [{ at: 0.8, who: 'lena', text: 'c5.lena.front', seconds: 3.2, mood: 'sad' }] },
            // he turns, and looks through the open door at Mace asleep in his chair, the radio on
            { seconds: 4.0, cam: { from: { garage: [-0.7, 1.55, -0.6] }, look: { of: 'player', p: [0, 1.58, 0] }, fov: 30 },
              do: [{ do: 'player', stage: { at: G.nateRead, face: 300, pose: 'idle' }, mood: 'sad' }] },
            // what he sees: the old man asleep in his chair by the open door, the radio low, the rain on the street
            { seconds: 6.8, cam: { from: { garage: [-1.4, 1.62, -1.85] }, to: { garage: [-1.5, 1.6, -1.4] }, look: { garage: [-4.3, 1.0, 5.5] }, fov: 30 } },
            { seconds: 4.4, cam: { from: { garage: [-5.0, 1.3, 3.6] }, look: { garage: [-4.3, 1.05, 5.5] }, fov: 34 } },
          ],
        },
        // CHOICE: wake him now, or wait for the right moment
        { do: 'choice', options: [{ text: 'c5.ch.confront', set: { confront_mace: true } }, { text: 'c5.ch.wait', set: { confront_mace: false } }] },
        { do: 'flag', set: { mace_payment_seen: true } },
        {
          do: 'cutscene',
          shots: [
            // confront: he takes a step toward the door. Lena gets up.
            { if: { flag: 'confront_mace' }, seconds: 4.4, cam: { from: { garage: [-1.4, 1.62, -1.85] }, look: { garage: [-4.3, 1.0, 5.6] }, fov: 36 },
              do: [{ do: 'player', stage: { at: { garage: [-2.9, 0, 1.6] }, face: 270, pose: 'idle' }, mood: 'angry' }, { do: 'actorSet', id: 'lena', pose: 'idle', at: { garage: [-0.8, 0, -1.7] }, look: 'player' }],
              lines: [{ at: 1.2, who: 'nate', text: 'c5.nate.mace', seconds: 1.8, mood: 'angry' }] },
            // wait: he turns the radio down and lays the blanket over the old man's knees
            { if: { flag: 'confront_mace', is: false }, seconds: 5.2, cam: { from: { garage: [-5.1, 1.3, 3.6] }, look: { garage: [-4.3, 1.0, 5.5] }, fov: 34 },
              do: [{ do: 'player', stage: { at: { garage: [-3.6, 0, 4.7] }, face: 270, pose: 'hold' } }, { do: 'sound', name: 'tick' }, { do: 'sound', name: 'cloth' }] },
            // the rain. A long, slow fade.
            { seconds: 10, fade: 'out', fadeSeconds: 8, cam: { from: { garage: [-4.4, 2.6, -4.5] }, to: { garage: [-4.4, 2.7, -3.8] }, look: { garage: [-4.2, 1.0, 6.5] }, fov: 46 },
              do: [{ do: 'music', silence: 30 }, { do: 'music', calm: 0 }] },
          ],
        },
        { do: 'light' },
        { do: 'remove', ids: ['bank', 'radio', 'rbox'] },
        { do: 'wait', seconds: 1.4 },
        { do: 'end', over: 'c5.end.over', title: 'c5.title', lines: ['c5.end.1', 'c5.end.2', 'c5.end.3'], locked: 'c5.end.locked' },
      ],
    },
  ],
};
