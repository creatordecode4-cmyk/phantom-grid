// ---------------------------------------------------------------------------
// CHAPTER 2 - "WANTED" (the morning after Chapter 1)
//
// This file is ONLY DATA, written like chapter01.js. The story engine
// (src/story/engine.js) explains every word used here at its top. All texts
// are keys of src/story/strings.js. The Meridian Guard of this chapter is the
// real wanted system of src/ai/wanted.js ({ do: 'police' }).
//
// The day in one line: the whole city has his face, a captain who is also a
// mother, a garage with a new color for the van, a cloth nobody may touch,
// and a dead brother who speaks from a white room.
//
// It uses what Chapter 1 left behind: limiter_off (the van stays free),
// ticket_taken (who has the race ticket), mace_kind (a hot drink, or only a
// nod), wren_tracks_zero (WREN is still watching for the black car).
//
// Places: [x, z] on the ground, [x, y, z], { garage: [right, up, toward the street] } (Mace's garage),
// { parking: [right, up, toward the street] } (the old car park), { of: 'car or person', p: [left, up, forward] },
// { cabin: 'car', at, p }. Directions are compass degrees (0 north, 90 east, 180 south, 270 west). Speeds are km/h.
// Map: +z is north, -z south (the ocean), -x east, +x west.
// ---------------------------------------------------------------------------

const NEAR = 0.05;                                         // a lens that can sit inside a car or a small room
const MORNING = { do: 'time', hour: 7.5, rain: true };
const LATER = { do: 'time', hour: 9.1, rain: true };
const AFTERNOON = { do: 'time', hour: 16.6, rain: true };
const EVENING = { do: 'time', hour: 20.9, rain: true };
const LATE = { do: 'time', hour: 22.3, rain: true };
const NIGHT = { do: 'time', hour: 23.6, rain: true };

// ---- where things are ----
const VAN_BAY = { parking: [6.83, 0, -8.6] };             // the van's bay in the flooded car park (nose to the street)
const ALLEY = { mouth: [-199, 201], park: [-228, 201] };   // the alley between Corlett Street and the market
const GARAGE_FRONT = { garage: [-4.5, 0, 11.3] };          // the street in front of Mace's big door
const GARAGE_IN = { garage: [-4.5, 0, 2.3] };              // the van inside, in the repair bay
const BENCH = { garage: [0.22, 0.995, -1.8] };             // on the work bench
const TARP_NOSE = { garage: [-6.0, 0, -0.75] };            // in front of the covered car, on its left side
const ROOM = [600, 30, 600];                               // the white room of the video (far away from everything)
// the press conference: on the wide sidewalk in front of the twist tower, The Crown (the street is closed for it)
const PRESS = { podium: [378.7, 315], harrow: [379.5, 315], wall: [380.95, 315], car: [373.6, 303.5] };

// ---- the van (as in Chapter 1, now with a number plate; after Mace's paint shop it keeps its new color) ----
const PAINTS = [
  { name: 'c2.paint.blue', color: [0.12, 0.16, 0.25] },
  { name: 'c2.paint.red', color: [0.43, 0.15, 0.1] },
  { name: 'c2.paint.green', color: [0.21, 0.28, 0.2] },
  { name: 'c2.paint.grey', color: [0.37, 0.38, 0.39] },
];
const OLD_PLATE = 'PM 4471', NEW_PLATE = 'PM 2908';
const VAN = (at, face, more = {}) => [
  // (the limiter stays off when it was switched off in Chapter 1)
  { do: 'spawn', id: 'van', kind: 'van', at, face, color: [0.74, 0.72, 0.66], paints: PAINTS, paintFlag: 'van_color', enter: true, limit: 0, curbSide: true,
    type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 }, if: { flag: 'limiter_off' }, ...more },
  { do: 'spawn', id: 'van', kind: 'van', at, face, color: [0.74, 0.72, 0.66], paints: PAINTS, paintFlag: 'van_color', enter: true, limit: 80, curbSide: true,
    type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 }, if: { flag: 'limiter_off', is: false }, ...more },
  { do: 'prop', id: 'sticker', kind: 'sticker80', in: 'van', at: { cabinAt: 'dash', p: [-0.27, -0.1, -0.125] }, rot: [1.15, Math.PI, 0] },
  { do: 'prop', id: 'deck', kind: 'deck', in: 'van', at: { cabinAt: 'dash', p: [0, -0.238, -0.137] } },
  { do: 'prop', id: 'plate', kind: 'plate', text: OLD_PLATE, textFlag: 'van_plate', in: 'van', at: { cabinAt: 'back', p: [0, 0, -0.03] }, rot: [0, Math.PI, 0] },
];
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));

// ---- the city knows his face ----
const NEWS = [
  // across the street from the car park, and one on the way to the alley
  { do: 'prop', id: 'news1', kind: 'newsScreen', at: [1.7, 4.4, 437.5], face: 90, w: 6, legs: 4.4, if: { flag: 'ticket_taken', is: false }, line3: 'A race ticket was found at the scene' },
  { do: 'prop', id: 'news1', kind: 'newsScreen', at: [1.7, 4.4, 437.5], face: 90, w: 6, legs: 4.4, if: { flag: 'ticket_taken' } },
  { do: 'prop', id: 'news2', kind: 'newsScreen', at: [-186.6, 3.4, 214], face: 90, w: 4.6, legs: 3.4 },
];
const POSTERS = { do: 'prop', id: 'posters', kind: 'posters', at: [0, 0, 0], list: [
  { at: [-16.97, 1.1, 418.1], face: 270 }, { at: [-16.97, 1.1, 415.3], face: 270 },      // the stair tower of the car park
  { at: [-235.0, 1.2, 198.58], face: 0 }, { at: [-219.5, 1.2, 203.42], face: 180 },     // the alley
  { at: { garage: [0.45, 1.1, 7.03] }, face: 270 },                                       // beside Mace's door
] };
// the Guard as it is for most of the day: it knows his face; gates on the main roads; drones that speak
const GUARD_DAY = { do: 'police', real: true, known: true, gates: true, roadblocks: true, startStars: 2, announce: true, ram: true };

// ---- people ----
// MACE (Marcus Doyle, 54). Opens the door without a single question. Asks only one.
const MACE = (at, face, more = {}) => ({ do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at, face, pose: 'crossed', fixed: true, mood: 'stern', ...more });
// two men who work for Mace. They do not look at Nate.
const MECHANICS = [
  { do: 'actor', id: 'mech1', extra: [0.2, 0.22, 0.25], name: 'name.mechanic', at: { garage: [-0.62, 0, -3.7] }, face: 180, pose: 'hold', fixed: true, look: null, scale: 1.01 },
  { do: 'actor', id: 'mech2', extra: [0.32, 0.18, 0.1], name: 'name.mechanic', at: { garage: [-7.4, 0, 4.7] }, face: 0, pose: 'hips', fixed: true, look: null, scale: 0.96 },
];
const AVOID_EYES = [
  { near: { of: 'mech1' }, radius: 3.2, repeat: true, hold: 0.4, do: [{ do: 'actorSet', id: 'mech1', faceAway: 'player' }] },
  { near: { of: 'mech2' }, radius: 3.2, repeat: true, hold: 0.4, do: [{ do: 'actorSet', id: 'mech2', faceAway: 'player' }] },
];
// the old radio on the shelf: the news, all day
const RADIO = { do: 'prop', id: 'radio', kind: 'radio', at: { garage: [-1.25, 2.06, -6.32] }, face: 270 };
const SHUTTER_DOWN = { do: 'shutter', open: 0, seconds: 0 };
const WORK_LAMP = { do: 'light', at: { garage: [-2.2, 2.8, -1.6] }, color: 0xffd8a8, power: 30, range: 10 };

export default {
  id: 'chapter02',
  number: 2,
  title: 'c2.title',
  vehicle: 'van',
  // (what a normal game has decided by now; used when a mission is started from the mission list)
  flags: { limiter_off: true, ticket_found: true, ticket_taken: true, mace_kind: true, wren_tracks_zero: true, nate_name_known: true },
  preload: { actors: ['Mace_Doyle', 'Sloane_Harrow', 'Theo_Calloway'], vehicles: ['chrome_supercar', 'police_coupe'] },

  missions: [
    // =====================================================================
    // 1. LEARN THE RULES - the flooded car park, three stars, the first drone       (tutorial, 4-6 minutes)
    // =====================================================================
    {
      id: 'c2m0', title: 'c2.m0',
      setup: [
        MORNING,
        { do: 'world', traffic: 12, people: 10, indoors: false },
        { do: 'clear', at: [-9, 429], radius: 16 },
        ...VAN(VAN_BAY, 270),
        { do: 'player', inCar: 'van' },
        { do: 'allow', enter: ['van'] },
        { do: 'vehicleSet', id: 'van', lockExit: true },
        ...NEWS, POSTERS,
        // (the Guard knows him, but nobody is out yet: the opening is a film scene)
        { ...GUARD_DAY, stars: 0, cars: 0, drones: 0, ram: false },
        { do: 'news', text: 'c2.news.1' },
      ],
      on: [
        { damageOver: 0.97, fail: 'c2.fail.wrecked' },
        // WREN's soft hints: the rules, the first time each thing happens
        { event: 'seen', do: [{ do: 'say', who: 'wren', text: 'c2.wren.seen' }] },
        { searching: true, hold: 5, do: [{ do: 'say', who: 'wren', text: 'c2.wren.searching' }] },
        { droneOver: 0.5, do: [{ do: 'say', who: 'wren', text: 'c2.wren.drone' }] },
        { event: 'gate', do: [{ do: 'say', who: 'wren', text: 'c2.wren.gate' }] },
      ],
      steps: [
        { do: 'card', over: 'c2.card.over', title: 'c2.title', sub: 'c2.card.sub', seconds: 4.5 },
        {
          do: 'cutscene',
          shots: [
            // rain in the open side of the car park. Black water between the columns. The van.
            { seconds: 7, fade: 'in', fadeSeconds: 2.4, cam: { from: { parking: [12.4, 1.45, -10.9] }, to: { parking: [12.0, 1.4, -10.1] }, look: { parking: [2.6, 1.2, 12] }, fov: 46 },
              lines: [{ at: 2.0, who: 'wren', text: 'c2.wren.morning', moods: { nate: 'tired' } }] },
            // Nate, awake. He has not slept.
            { seconds: 5.4, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.3] }, look: { cabin: 'van', at: 'eye', p: [0, -0.04, 0] }, fov: 42, near: NEAR },
              lines: [{ at: 0.6, who: 'wren', text: 'c2.wren.murder', moods: { nate: 'stern' } }] },
            // across the street: his own face on a screen. The same face as in the rain on the glass.
            { seconds: 6, cam: { from: { parking: [-1.4, 1.35, 10.6] }, to: { parking: [-1.4, 1.38, 10.9] }, look: [1.7, 4.3, 437.5], fov: 30 },
              lines: [
                { at: 1.2, if: { flag: 'ticket_taken', is: false }, who: 'wren', text: 'c2.wren.ticket_left' },
                { at: 1.2, if: { flag: 'ticket_taken' }, who: 'wren', text: 'c2.wren.ticket_taken' },
              ] },
            // a Guard drone comes down the street. Its light moves over the wet road.
            { seconds: 6.5, cam: { from: [-12.6, 1.25, 433.5], to: [-12.4, 1.2, 433.0], look: [-7, 13.5, 452], fov: 46 },
              do: [{ do: 'prop', id: 'pdrone', kind: 'policeDrone', at: [-7, 19, 472], fly: { path: [[-7, 472], [-7, 380]], y: 18, speed: 8 } }],
              lines: [{ at: 3.6, who: 'wren', text: 'c2.wren.drone_wait' }] },
          ],
        },
        { do: 'vehicleSet', id: 'van', lockExit: false },
        // (a few seconds under the roof, while the drone goes; WREN says what Chapter 1 left behind)
        { do: 'lines', lines: [
          { wait: 0.8 },
          { if: { flag: 'wren_tracks_zero' }, who: 'wren', text: 'c2.wren.zero' },
          { if: { flag: 'limiter_off' }, who: 'wren', text: 'c2.wren.limiter' },
          { if: { flag: 'limiter_off' }, who: 'nate', text: 'c2.leave_off', seconds: 1.6, mood: 'stern' },
          { wait: 1.0 },
        ] },
        { do: 'remove', ids: ['pdrone'] },
        // THE RULES START: three stars, they search the street south of the car park.
        // (a lesson, not a trap: in this mission they chase, but they do not ram)
        { do: 'police', stars: 3, search: [-7, 392], radius: 40, cars: 2, drones: 1, ram: false },
        { do: 'say', who: 'wren', text: 'c2.wren.now' },
        { do: 'driveTo', text: 'c2.obj.leave', at: ALLEY.mouth, radius: 14, tip: 'c2.tip.cones', tipSeconds: 8 },
        { do: 'driveTo', text: 'c2.obj.alley', at: ALLEY.park, radius: 6.5, stop: true },
        // (the game saves here: the alley)
        { do: 'checkpoint', id: 1, setup: [
          { do: 'vehicleSet', id: 'van', place: ALLEY.park, face: 90, lockExit: false },
          { do: 'police', stars: 3, search: [-150, 330], radius: 60, cars: 2, drones: 1, ram: false },
        ] },
        {
          do: 'waitFor', until: { starsUnder: 3 }, text: 'c2.obj.hide', tip: 'c2.tip.hide', tipSeconds: 9,
          on: [
            { seen: true, hold: 1.2, do: [{ do: 'say', who: 'wren', text: 'c2.wren.not_yet' }] },
            { hidden: true, hold: 1.5, do: [{ do: 'say', who: 'wren', text: 'c2.wren.hidden' }] },
          ],
        },
        { do: 'lines', lines: [{ who: 'wren', text: 'c2.wren.two' }, { wait: 0.8 }] },
      ],
    },

    // =====================================================================
    // 2. PRESS CONFERENCE - a captain at a podium, a call she does not take       (a short film scene)
    // =====================================================================
    {
      id: 'c2m1', title: 'c2.m1',
      setup: [
        { ...LATER, onLoad: true },
        { do: 'world', traffic: 12, people: 10, indoors: false, onLoad: true },
        ...onLoad(VAN(ALLEY.park, 90)),
        { do: 'player', inCar: 'van', onLoad: true },
        { do: 'allow', enter: ['van'], onLoad: true },
        { ...GUARD_DAY, stars: 2, search: [-120, 330], radius: 80, cars: 2, drones: 1, onLoad: true },
        { do: 'news', text: 'c2.news.2' },
        // THE CROWN: the plaza in front of the twist tower, the Guard's wall, cameras, a few reporters
        { do: 'clear', at: PRESS.car, radius: 12 },
        { do: 'prop', id: 'pwall', kind: 'pressWall', at: PRESS.wall, face: 90, width: 6.4 },
        { do: 'prop', id: 'podium', kind: 'podium', at: PRESS.podium, face: 90 },
        { do: 'prop', id: 'cam1', kind: 'newsCamera', at: [374.6, 312.6], face: 285 },
        { do: 'prop', id: 'cam2', kind: 'newsCamera', at: [374.4, 317.7], face: 255 },
        { do: 'prop', id: 'lamp1', kind: 'lightStand', at: [376.1, 309.6], face: 300 },
        { do: 'prop', id: 'pscreen', kind: 'newsScreen', at: [380.6, 4.6, 325.2], face: 90, w: 4.4, legs: 4.6, tag: 'LIVE', line1: 'CAPT. S. HARROW', line2: 'THE GUARD SPEAKS', line3: 'The Crown, this morning', line4: 'Questions after the statement', face: false },
        { do: 'actor', id: 'rep1', extra: [0.15, 0.17, 0.2], name: 'name.reporter', at: [375.6, 314.0], face: 270, pose: 'phone', fixed: true, look: null },
        { do: 'actor', id: 'rep2', extra: [0.35, 0.3, 0.26], name: 'name.reporter', at: [375.1, 316.4], face: 265, pose: 'crossed', fixed: true, look: null, scale: 0.95 },
        { do: 'actor', id: 'rep3', extra: [0.1, 0.1, 0.12], name: 'name.reporter', at: [374.0, 313.3], face: 280, pose: 'idle', fixed: true, look: null, scale: 1.03 },
        // CAPTAIN SLOANE HARROW. What she wants: order. What she fears: the call she is about to miss.
        { do: 'actor', id: 'harrow', model: 'Sloane_Harrow', name: 'name.harrow', at: PRESS.harrow, face: 90, pose: 'idle', fixed: true, look: null, mood: 'stern' },
        // her patrol car at the curb. On its dashboard: a child's drawing.
        { do: 'spawn', id: 'harrowCar', kind: 'police_coupe', or: 'sedan', color: [0.85, 0.86, 0.9], at: PRESS.car, face: 0, npc: true, detail: true },
        { do: 'prop', id: 'drawing', kind: 'drawing', in: 'harrowCar', at: { cabinAt: 'dash', p: [0.12, 0.02, 0.04] }, rot: [0.0, Math.PI + 0.35, 0] },
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            // at the podium. Flashes. The voice of the city.
            { seconds: 3.4, fade: 'in', fadeSeconds: 0.8, cam: { from: [373.3, 1.62, 312.3], to: [373.5, 1.62, 312.6], look: [379.5, 1.6, 315], fov: 30 },
              do: [{ do: 'music', silence: 0.2 }],
              lines: [{ at: 0.3, who: 'harrow', text: 'c2.harrow.1', seconds: 2.6, mood: 'stern' }, { at: 0.6, do: [{ do: 'prop', id: 'pflash', kind: 'flash', at: [374.9, 1.75, 312.1] }] }, { at: 0.72, do: [{ do: 'remove', ids: ['pflash'] }] }] },
            // her phone, in the middle of the sentence. IVY.
            // (the phone lies in her right hand, the screen turned up to her face)
            { seconds: 2.2, cam: { from: { of: 'harrow', p: [-0.24, 1.74, -0.1] }, look: { of: 'harrow', p: [-0.06, 1.3, 0.3] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'harrow', pose: 'phone', seconds: 0.25 }, { do: 'prop', id: 'ivyPhone', kind: 'phoneIvy', at: { of: 'harrow', p: [-0.07, 1.3, 0.31] }, face: 90, rot: [0.75, 0, 0] }, { do: 'sound', name: 'ring', times: 1 }] },
            // she turns from the microphones and whispers. Then she cuts the call.
            { seconds: 3.2, cam: { from: { of: 'harrow', p: [0.75, 1.6, 1.25] }, look: { of: 'harrow', p: [0, 1.55, 0] }, fov: 24 },
              do: [{ do: 'actorSet', id: 'harrow', face: 60 }, { do: 'remove', ids: ['ivyPhone'] }, { do: 'prop', id: 'ivyPhone', kind: 'phoneIvy', at: { of: 'harrow', p: [-0.07, 1.3, 0.31] }, face: 60, rot: [0.75, 0, 0] }],
              lines: [{ at: 0.4, who: 'harrow', kind: 'thought', text: 'c2.harrow.ivy', seconds: 2.2, mood: 'sad' }],
              end: [{ do: 'remove', ids: ['ivyPhone'] }, { do: 'actorSet', id: 'harrow', pose: 'idle', face: 90 }] },
            // her car at the curb. On the dashboard, behind the glass: MAMA and ME.
            { seconds: 2.4, cam: { from: { cabin: 'harrowCar', at: 'pass', p: [0.08, 0.02, 0.12] }, to: { cabin: 'harrowCar', at: 'pass', p: [0.05, 0.0, 0.2] }, look: { cabin: 'harrowCar', at: 'dash', p: [0.12, 0.02, 0.04] }, fov: 40, near: NEAR },
              lines: [{ at: 0.2, who: 'harrow', text: 'c2.harrow.2', seconds: 2.0, mood: 'stern' }] },
            // back in the alley. The same voice comes out of the van's radio.
            { seconds: 4.2, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.3] }, look: { cabin: 'van', at: 'eye', p: [0, -0.04, 0] }, fov: 42, near: NEAR },
              lines: [{ at: 0.9, who: 'wren', text: 'c2.wren.harrow', moods: { nate: 'tired' } }] },
          ],
        },
        { do: 'flag', set: { harrow_ivy_seen: true } },
        { do: 'remove', ids: ['pwall', 'podium', 'cam1', 'cam2', 'lamp1', 'pscreen', 'rep1', 'rep2', 'rep3', 'harrow', 'ivyPhone', 'harrowCar', 'drawing'] },
      ],
    },

    // =====================================================================
    // 3. MACE'S GARAGE - side streets, no questions, a new color for the van
    // =====================================================================
    {
      id: 'c2m2', title: 'c2.m2',
      flags: { harrow_ivy_seen: true },
      setup: [
        { ...LATER, onLoad: true },
        { do: 'world', traffic: 12, people: 10, indoors: false, onLoad: true },
        ...onLoad(VAN(ALLEY.park, 90)),
        { do: 'player', inCar: 'van', onLoad: true },
        { do: 'allow', enter: ['van'], onLoad: true },
        { do: 'news', text: 'c2.news.2', onLoad: true },
        // (the Guard is still searching the streets around the car park, far to the north)
        { ...GUARD_DAY, stars: 2, search: [-60, 360], radius: 90, cars: 3, drones: 1 },
        { do: 'clear', at: GARAGE_FRONT, radius: 11 },
        POSTERS,
        SHUTTER_DOWN, RADIO, ...MECHANICS,
        MACE({ garage: [-3.6, 0, 5.4] }, 270),
      ],
      on: [{ damageOver: 0.97, fail: 'c2.fail.wrecked' }, ...AVOID_EYES],
      steps: [
        { do: 'say', who: 'wren', text: 'c2.wren.mace' },
        // the yellow line already goes around the gates: the side streets
        {
          do: 'waitFor', text: 'c2.obj.garage', marker: GARAGE_FRONT, tip: 'c2.tip.gates', tipSeconds: 8,
          until: { all: [{ near: GARAGE_FRONT, radius: 9 }, { inCar: 'van' }, { seen: false }, { speedUnder: 12 }] },
          on: [
            { all: [{ near: GARAGE_FRONT, radius: 26 }, { seen: true }], hold: 1, do: [{ do: 'say', who: 'wren', text: 'c2.wren.not_yet' }] },
            { event: 'seen', do: [{ do: 'say', who: 'wren', text: 'c2.wren.seen' }] },
            { event: 'gate', do: [{ do: 'say', who: 'wren', text: 'c2.wren.gate' }] },
          ],
        },
        // (the game saves here: in front of the garage)
        { do: 'checkpoint', id: 1, setup: [{ do: 'vehicleSet', id: 'van', place: GARAGE_FRONT, face: 180 }, { do: 'police', stars: 0 }] },
        // the door goes up. He does not ask. He steps aside.
        {
          do: 'cutscene',
          shots: [
            { seconds: 5.2, cam: { from: { garage: [-9.6, 1.35, 15.8] }, to: { garage: [-9.3, 1.35, 15.4] }, look: { garage: [-4.4, 1.7, 6.6] }, fov: 38 },
              do: [{ do: 'shutter', open: 1, seconds: 3.2 }, { do: 'music', silence: 1.5 }],
              lines: [{ at: 3.1, do: [{ do: 'actorSet', id: 'mace', walk: { garage: [-1.0, 0, 5.4] }, speed: 1.1, then: 270, look: 'player' }] }] },
          ],
        },
        { do: 'driveTo', text: 'c2.obj.drive_in', at: GARAGE_IN, radius: 2.4, stop: true },
        { do: 'police', stars: 0 },
        { do: 'world', indoors: true, people: 0 },
        WORK_LAMP,
        { do: 'allow', enter: 'none' },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the door comes down behind the van. The street is gone. Only the rain on the roof.
            { seconds: 4.4, cam: { from: { garage: [-0.6, 1.7, 2.0] }, to: { garage: [-0.65, 1.68, 2.3] }, look: { garage: [-4.2, 1.7, 6.8] }, fov: 48 },
              do: [{ do: 'vehicleSet', id: 'van', place: GARAGE_IN, face: 90, stop: true }, { do: 'shutter', open: 0, seconds: 2.8 }, { do: 'actorSet', id: 'mace', at: { garage: [-1.6, 0, 5.9] }, face: 270, look: null }],
              end: [{ do: 'player', stage: { at: { garage: [-2.2, 0, 2.6] }, face: 249, pose: 'idle' }, mood: 'tired' }, { do: 'actorSet', id: 'mace', at: { garage: [-1.5, 0, 4.4] }, face: 69, look: 'player' }] },
            // (kind in Chapter 1: a hot drink, pushed into his hand. Not kind: a nod, nothing more.)
            { if: { flag: 'mace_kind' }, seconds: 4.2, cam: { from: { garage: [-0.2, 1.6, 1.2] }, look: { garage: [-1.85, 1.45, 3.5] }, fov: 36 },
              do: [{ do: 'actorSet', id: 'mace', pose: 'hold', look: 'player' }, { do: 'prop', id: 'mug', kind: 'mug', on: 'mace', bone: 'hand_R', p: [0, 0.08, 0.04] }],
              lines: [{ at: 0.8, who: 'mace', text: 'c2.mace.drink', seconds: 1.8, mood: 'neutral', moods: { nate: 'tired' } }],
              end: [{ do: 'remove', ids: ['mug'] }, { do: 'prop', id: 'mug2', kind: 'mug', on: 'player', bone: 'hand_R', p: [0, 0.08, 0.04] }, { do: 'actorSet', id: 'mace', pose: 'crossed' }] },
            { if: { flag: 'mace_kind', is: false }, seconds: 3.0, cam: { from: { garage: [-0.2, 1.6, 1.2] }, look: { garage: [-1.6, 1.55, 4.3] }, fov: 34 },
              do: [{ do: 'actorSet', id: 'mace', look: { yaw: 0, pitch: 0.35 } }],
              lines: [{ at: 1.4, do: [{ do: 'actorSet', id: 'mace', look: 'player' }] }] },
            // the one question
            { seconds: 3.6, cam: { from: { garage: [-2.95, 1.62, 2.1] }, to: { garage: [-2.9, 1.62, 2.25] }, look: { garage: [-1.5, 1.58, 4.4] }, fov: 28 },
              lines: [{ at: 1.2, who: 'mace', text: 'c2.mace.did_you', seconds: 2.2, mood: 'stern', moods: { nate: 'tired' } }] },
          ],
        },
        // CHOICE (it is remembered): what Nate answers
        { do: 'choice', options: [{ text: 'c2.ch.no', set: { nate_denied: true } }, { text: 'c2.ch.dont_know', set: { nate_denied: false } }] },
        {
          do: 'cutscene',
          shots: [
            { seconds: 3.8, cam: { from: { garage: [-2.95, 1.62, 2.1] }, look: { garage: [-1.5, 1.58, 4.4] }, fov: 28 },
              lines: [
                { at: 0.3, if: { flag: 'nate_denied' }, who: 'nate', text: 'c2.ch.no', seconds: 1.2, mood: 'stern' },
                { at: 1.8, if: { flag: 'nate_denied' }, who: 'mace', text: 'c2.mace.ok', seconds: 1.6, mood: 'neutral' },
                { at: 0.3, if: { flag: 'nate_denied', is: false }, who: 'nate', text: 'c2.ch.dont_know', seconds: 1.6, mood: 'sad' },
                { at: 2.3, if: { flag: 'nate_denied', is: false }, who: 'mace', text: 'c2.mace.find_out', seconds: 1.4, mood: 'stern' },
              ] },
            // the van in the work lamp: Mace looks at it like a problem he can fix
            { seconds: 4.4, cam: { from: { garage: [-0.6, 1.75, 5.2] }, look: { garage: [-4.4, 1.1, 2.0] }, fov: 42 },
              do: [{ do: 'remove', ids: ['mug2'] }, { do: 'actorSet', id: 'mace', at: { garage: [-2.4, 0, 3.6] }, face: 0, pose: 'crossed', look: { garage: [-4.5, 1.2, 2.2] } }, { do: 'player', stage: { at: { garage: [-1.4, 0, 0.6] }, face: 300, pose: 'crossed' } }],
              lines: [{ at: 0.5, who: 'mace', text: 'c2.mace.paint', mood: 'stern' }],
              end: [{ do: 'actorSet', id: 'mace', at: { garage: [-2.05, 0, 2.2] }, face: 0, pose: 'aim', look: { garage: [-4.5, 1.2, 2.2] } }, { do: 'prop', id: 'gun', kind: 'sprayGun', on: 'mace', bone: 'hand_R', p: [0, 0.09, 0.02] }] },
          ],
        },
        // THE PAINT SHOP: choose one of four colors, hold to spray, a new plate
        {
          do: 'paint', vehicle: 'van', text: 'c2.obj.paint', colors: PAINTS, plate: NEW_PLATE, oldPlate: OLD_PLATE,
          mist: { garage: [-3.2, 1.2, 2.2] },
          cam: { from: { garage: [-0.5, 1.95, 5.4] }, look: { garage: [-4.4, 1.0, 2.0] }, fov: 48 },
        },
        { do: 'remove', ids: ['gun'] },
        { do: 'actorSet', id: 'mace', pose: 'crossed', look: 'player' },
        { do: 'police', disguised: true },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.6, cam: { from: { of: 'van', p: [0.55, 0.98, -4.1] }, look: { cabin: 'van', at: 'back', p: [0, -0.02, 0] }, fov: 40 },
              lines: [{ at: 0.6, who: 'mace', text: 'c2.mace.plate', mood: 'neutral' }, { at: 2.8, who: 'wren', text: 'c2.wren.disguise' }] },
          ],
        },
        { do: 'cine', on: false },
        { do: 'player', stage: null, at: { garage: [-1.4, 0, 0.6] }, face: 300 },
      ],
    },

    // =====================================================================
    // 4. THE CORNER OF THE GARAGE - a covered car. "Don't touch that."        (quiet moment)
    // =====================================================================
    {
      id: 'c2m3', title: 'c2.m3',
      flags: { harrow_ivy_seen: true, nate_denied: true, van_color: 0, van_plate: NEW_PLATE },
      setup: [
        AFTERNOON,
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        ...onLoad(VAN(GARAGE_IN, 90)),
        { do: 'player', at: { garage: [-2.0, 0, 3.6] }, face: 120, onLoad: true },
        { do: 'allow', enter: 'none' },
        { ...GUARD_DAY, stars: 0, disguised: true, announce: false, onLoad: true },
        { do: 'news', text: null },
        SHUTTER_DOWN, RADIO, ...MECHANICS, WORK_LAMP,
        MACE({ garage: [-0.3, 0, -0.6] }, 180, { pose: 'hold', look: null, replace: true }),
      ],
      on: [
        ...AVOID_EYES,
        // the radio says it all again, every hour
        { time: 3, do: [{ do: 'say', who: 'radio', kind: 'thought', text: 'c2.radio.1', seconds: 6 }] },
      ],
      steps: [
        { do: 'goto', text: 'c2.obj.look', at: TARP_NOSE, radius: 1.5 },
        { do: 'music', silence: 30 },
        {
          do: 'cutscene', skippable: false,
          shots: [
            // he reaches for the cloth
            { seconds: 3.2, cam: { from: { garage: [-2.6, 1.45, -2.9] }, look: { garage: [-6.2, 0.95, -1.4] }, fov: 38 },
              do: [{ do: 'player', stage: { at: TARP_NOSE, face: 52, pose: 'hold' }, mood: 'sad' }, { do: 'actorSet', id: 'mace', look: 'player' }],
              lines: [{ at: 1.6, who: 'mace', text: 'c2.mace.dont', seconds: 1.6, mood: 'stern' }] },
            // he stops
            { seconds: 2.6, cam: { from: { garage: [-4.4, 1.6, -2.6] }, look: { garage: [-6.0, 1.56, -0.75] }, fov: 30 },
              do: [{ do: 'player', stage: { at: TARP_NOSE, face: 52, pose: 'idle' }, mood: 'pain' }] },
            // the camera stays on the cloth. No music. Rain on the roof.
            { seconds: 7, fade: 'out', fadeSeconds: 2.2, cam: { from: { garage: [-0.8, 1.35, -3.6] }, to: { garage: [-1.6, 1.3, -3.7] }, look: { garage: [-6.9, 0.7, -3.9] }, fov: 32 } },
          ],
        },
        { do: 'player', stage: null, at: { garage: [-3.0, 0, 1.0] }, face: 90 },
        { do: 'fade', to: 'clear', seconds: 1.2 },
      ],
    },

    // =====================================================================
    // 5. THE CASE - KEYSTONE. A white room. A dead brother speaks.
    // =====================================================================
    {
      id: 'c2m4', title: 'c2.m4',
      flags: { harrow_ivy_seen: true, nate_denied: true, van_color: 0, van_plate: NEW_PLATE },
      setup: [
        EVENING,
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        ...onLoad(VAN(GARAGE_IN, 90)),
        { do: 'player', at: { garage: [-2.0, 0, 1.0] }, face: 120, onLoad: true },
        { do: 'allow', enter: 'none' },
        { ...GUARD_DAY, stars: 0, disguised: true, announce: false, onLoad: true },
        { do: 'news', text: null },
        SHUTTER_DOWN, RADIO, WORK_LAMP,
        { do: 'remove', ids: ['mech1', 'mech2'] },
        MACE({ garage: [-1.9, 0, -3.6] }, 235, { look: 'player', replace: true }),
        // Dr. Solberg's case, on the work bench
        { do: 'prop', id: 'case', kind: 'case', at: BENCH, face: 0, rot: [Math.PI / 2, 0, 0] },
        // the white room of the video (far out of town: nothing else can be seen from inside it)
        { do: 'prop', id: 'room', kind: 'whiteRoom', at: ROOM, face: 0 },
        { do: 'actor', id: 'theo', model: 'Theo_Calloway', name: 'name.theo', at: [ROOM[0], ROOM[1] + 0.47, ROOM[2]], face: 0, pose: 'sit', floorBelow: 0.47, fixed: true, look: [ROOM[0], ROOM[1] + 1.3, ROOM[2] + 2.4], mood: 'tired' },
        { do: 'prop', id: 'bandage', kind: 'bandage', on: 'theo', bone: 'foreArm_L', along: 'hand_L', t: 0.9 },
      ],
      steps: [
        { do: 'collect', text: 'c2.obj.case', prop: 'case', label: 'ui.open', radius: 1.6, keep: true },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the case is open. Foam, and in it a small dark chip.
            { seconds: 4.4, cam: { from: { garage: [-0.55, 1.62, -1.05] }, look: { garage: [0.2, 1.0, -1.8] }, fov: 30 },
              do: [
                { do: 'player', stage: { at: { garage: [-0.62, 0, -1.8] }, face: 180, pose: 'idle' }, mood: 'stern' },
                { do: 'remove', ids: ['case'] },
                { do: 'prop', id: 'caseOpen', kind: 'caseOpen', at: { garage: [0.22, 0.94, -1.8] }, face: 0 },
                { do: 'prop', id: 'chip', kind: 'chip', at: { garage: [0.21, 1.0055, -1.82] }, face: 270 },
              ],
              lines: [{ at: 0.8, who: 'wren', text: 'c2.wren.chip' }] },
            { seconds: 4.2, cam: { from: { garage: [0.2, 1.55, -0.6] }, look: { garage: [-0.62, 1.58, -1.8] }, fov: 30 },
              lines: [{ at: 0.4, who: 'wren', text: 'c2.wren.reading', moods: { nate: 'worried' } }] },
            // THE VIDEO. A white room. Theo, younger than Nate remembers him. A bandage on his wrist.
            { seconds: 7.4, cam: { from: [ROOM[0] + 0.12, ROOM[1] + 1.3, ROOM[2] + 2.45], to: [ROOM[0] + 0.1, ROOM[1] + 1.28, ROOM[2] + 2.2], look: [ROOM[0], ROOM[1] + 1.1, ROOM[2]], fov: 32 },
              do: [
                { do: 'time', rain: false }, { do: 'music', silence: 14 },
                { do: 'video', state: 'on', date: 'c2.video.date', file: 'c2.video.file' },
                { do: 'fill', power: 0.22 },
                { do: 'light', at: [ROOM[0] + 0.4, ROOM[1] + 2.4, ROOM[2] + 1.6], color: 0xffffff, power: 36, range: 8 },
              ],
              lines: [{ at: 1.4, who: 'theo', text: 'c2.theo.video', seconds: 4.6, mood: 'tired' }] },
            // it breaks up
            { seconds: 0.9, cam: { from: [ROOM[0] + 0.1, ROOM[1] + 1.28, ROOM[2] + 2.2], look: [ROOM[0], ROOM[1] + 1.1, ROOM[2]], fov: 32, shake: 0.2 },
              do: [{ do: 'video', state: 'glitch' }, { do: 'sound', name: 'tick' }] },
            // and the rest is locked
            { seconds: 3.2, cam: { from: [ROOM[0] + 0.1, ROOM[1] + 1.28, ROOM[2] + 2.2], look: [ROOM[0], ROOM[1] + 1.1, ROOM[2]], fov: 32 },
              do: [{ do: 'video', state: 'locked', lock: 'c2.video.lock' }],
              end: [{ do: 'video', state: 'off' }, { do: 'time', rain: true }, { do: 'fill' }, WORK_LAMP] },
            // Nate says nothing. Mace turns away.
            { seconds: 5.6, cam: { from: { garage: [0.25, 1.55, -0.4] }, to: { garage: [0.2, 1.55, -0.55] }, look: { garage: [-0.62, 1.55, -1.8] }, fov: 34 },
              do: [{ do: 'mood', set: { nate: 'pain' } }, { do: 'actorSet', id: 'mace', faceAway: 'player', pose: 'crossed', look: null }],
              lines: [{ at: 2.6, who: 'wren', text: 'c2.wren.date', moods: { nate: 'sad' } }] },
          ],
        },
        { do: 'flag', set: { keystone_found: true } },
        // CHOICE (it is remembered, and Mace knows more than he says): tell him, or keep it
        { do: 'choice', options: [{ text: 'c2.ch.tell', set: { told_mace_video: true } }, { text: 'c2.ch.keep', set: { told_mace_video: false } }] },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.6, cam: { from: { garage: [-0.9, 1.6, -0.9] }, look: { garage: [-1.9, 1.55, -3.6] }, fov: 32 },
              lines: [
                { at: 0.3, if: { flag: 'told_mace_video' }, who: 'nate', text: 'c2.tell', seconds: 2.0, mood: 'sad' },
                { at: 2.6, if: { flag: 'told_mace_video' }, who: 'mace', text: 'c2.mace.where', seconds: 1.8, mood: 'worried' },
                { at: 0.3, if: { flag: 'told_mace_video', is: false }, who: 'mace', text: 'c2.mace.anything', seconds: 1.6, mood: 'stern' },
                { at: 2.2, if: { flag: 'told_mace_video', is: false }, who: 'nate', text: 'c2.nothing', seconds: 1.4, mood: 'stern' },
              ] },
          ],
        },
        { do: 'cine', on: false },
        { do: 'player', stage: null, at: { garage: [-0.9, 0, -1.2] }, face: 90 },
        { do: 'remove', ids: ['room', 'theo', 'bandage', 'chip', 'caseOpen'] },
      ],
    },

    // =====================================================================
    // 6. TWO HONKS - Mace has a story. Stay for it, or not.                  (optional)
    // =====================================================================
    {
      id: 'c2m5', title: 'c2.m5',
      flags: { harrow_ivy_seen: true, nate_denied: true, van_color: 0, van_plate: NEW_PLATE, keystone_found: true },
      setup: [
        LATE,
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        ...onLoad(VAN(GARAGE_IN, 90)),
        { do: 'player', at: { garage: [-0.9, 0, -1.2] }, face: 90, onLoad: true },
        { do: 'allow', enter: 'none' },
        { ...GUARD_DAY, stars: 0, disguised: true, announce: false, onLoad: true },
        { do: 'news', text: null },
        SHUTTER_DOWN, { ...RADIO, onLoad: true },
        { do: 'remove', ids: ['mech1', 'mech2', 'case', 'caseOpen', 'chip'] },
        { do: 'light', at: { garage: [-3.0, 2.6, 4.6] }, color: 0xffc890, power: 22, range: 9 },
        MACE({ garage: [-2.6, 0, 5.2] }, 100, { look: 'player', replace: true, mood: 'tired' }),
      ],
      steps: [
        { do: 'talk', actor: 'mace', text: 'c2.obj.mace', radius: 3.2 },
        {
          do: 'cutscene', keep: true,
          shots: [
            { seconds: 4.2, cam: { from: { garage: [-0.6, 1.55, 2.0] }, look: { garage: [-2.4, 1.5, 4.1] }, fov: 36 },
              do: [{ do: 'player', stage: { at: { garage: [-2.2, 0, 3.0] }, face: 280, pose: 'idle' }, mood: 'tired' }],
              lines: [{ at: 0.6, who: 'mace', text: 'c2.mace.story_ask', mood: 'tired' }] },
          ],
        },
        // CHOICE (it is remembered): listen, or go
        { do: 'choice', options: [{ text: 'c2.ch.listen', set: { mace_story_heard: true } }, { text: 'c2.ch.not_tonight', set: { mace_story_heard: false } }] },
        {
          do: 'cutscene',
          shots: [
            // (listening) Mace looks at the door, not at Nate
            { if: { flag: 'mace_story_heard' }, seconds: 19, cam: { from: { garage: [-1.3, 1.5, 3.3] }, to: { garage: [-1.45, 1.5, 3.55] }, look: { garage: [-2.6, 1.55, 5.2] }, fov: 30 },
              do: [{ do: 'actorSet', id: 'mace', face: 320, look: { garage: [-4.5, 1.6, 7] } }],
              lines: [
                { at: 0.5, who: 'mace', text: 'c2.mace.story.1', seconds: 5.2, mood: 'tired' },
                { at: 6.2, who: 'mace', text: 'c2.mace.story.2', seconds: 4.2, mood: 'smile' },
                { at: 11.0, who: 'mace', text: 'c2.mace.story.3', seconds: 4.6, mood: 'sad', moods: { nate: 'sad' } },
                { at: 16.2, who: 'mace', text: 'c2.mace.story.4', seconds: 2.4, mood: 'tired' },
              ] },
            { if: { flag: 'mace_story_heard', is: false }, seconds: 3.6, cam: { from: { garage: [-0.6, 1.55, 2.0] }, look: { garage: [-2.4, 1.5, 4.1] }, fov: 36 },
              lines: [{ at: 0.3, who: 'nate', text: 'c2.ch.not_tonight', seconds: 1.4, mood: 'tired' }, { at: 1.9, who: 'mace', text: 'c2.mace.goodnight', seconds: 1.5, mood: 'neutral' }] },
          ],
        },
        { do: 'cine', on: false },
        { do: 'player', stage: null, at: { garage: [-2.2, 0, 3.0] }, face: 200 },
      ],
    },

    // =====================================================================
    // 7. TRACK 7 - the end. Night. A covered car. A tape. Rain on the roof.
    // =====================================================================
    {
      id: 'c2m6', title: 'c2.m6',
      flags: { harrow_ivy_seen: true, nate_denied: true, van_color: 0, van_plate: NEW_PLATE, keystone_found: true },
      setup: [
        NIGHT,
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        ...onLoad(VAN(GARAGE_IN, 90)),
        { do: 'player', at: { garage: [-2.2, 0, 3.0] }, face: 200, onLoad: true },
        { do: 'allow', enter: 'none' },
        { ...GUARD_DAY, stars: 0, disguised: true, announce: false, onLoad: true },
        { do: 'news', text: null },
        SHUTTER_DOWN,
        { do: 'remove', ids: ['mace', 'mech1', 'mech2', 'radio', 'case', 'caseOpen', 'chip'] },
        // only one small lamp is still on, at the back
        { do: 'light', at: { garage: [-4.2, 2.3, -5.6] }, color: 0xffb070, power: 14, range: 8 },
        // under the cloth: the silver car from the night of the crash, never repaired
        { do: 'spawn', id: 'theoCar', kind: 'chrome_supercar', or: 'coupe', color: [0.6, 0.62, 0.66], at: { garage: [-6.9, 0, -3.9] }, face: 270, dead: true, damage: 0.7, detail: true },
        { do: 'tarp', fit: 'theoCar' },
        { do: 'prop', id: 'deck2', kind: 'deck', in: 'theoCar', at: { cabinAt: 'dash', p: [0, 0.03, -0.06] } },
        // (seen from inside: the cloth lies on the windshield, and the dead car's screen is dark)
        { do: 'prop', id: 'veil', kind: 'veil', in: 'theoCar', at: { cabinAt: 'dash', p: [0, 0.34, 0.42] }, rot: [-1.05, 0, 0] },
        { do: 'prop', id: 'blank', kind: 'blank', in: 'theoCar', at: { cabinAt: 'dash', p: [0, -0.082, -0.143] }, rot: [0, Math.PI, 0] },
        { do: 'music', calm: 1 },
      ],
      steps: [
        { do: 'goto', text: 'c2.obj.car', at: TARP_NOSE, radius: 1.4, quiet: true },
        { do: 'player', stage: { at: TARP_NOSE, face: 52, pose: 'idle' }, mood: 'sad' },
        // CHOICE (it is remembered): look, or leave it covered
        { do: 'choice', options: [{ text: 'c2.ch.lift', set: { lifted_tarp: true } }, { text: 'c2.ch.covered', set: { lifted_tarp: false } }] },
        {
          do: 'cutscene', skippable: false,
          shots: [
            // (he lifts one corner: a headlight, a long scrape along the silver)
            // (a wide, high shot from the car's left side, so Nate, the cloth and the bare corner are all in it;
            //  the one lamp moves close, so the silver under the cloth catches it)
            { if: { flag: 'lifted_tarp' }, seconds: 6.2, cam: { from: { garage: [-3.3, 1.62, -2.75] }, to: { garage: [-3.45, 1.58, -2.6] }, look: { garage: [-6.05, 0.8, -1.35] }, fov: 42 },
              do: [{ do: 'light', at: { garage: [-4.8, 2.2, -1.6] }, color: 0xffc890, power: 9, range: 5 },
                { do: 'tarp', lift: 1, seconds: 2.6 }, { do: 'sound', name: 'cloth' }, { do: 'player', stage: { at: TARP_NOSE, face: 52, pose: 'hold' } }] },
            // (he leaves it. A hand on the cloth, and that is all.)
            { if: { flag: 'lifted_tarp', is: false }, seconds: 4.2, cam: { from: { garage: [-3.3, 1.62, -2.75] }, look: { garage: [-6.0, 1.05, -1.0] }, fov: 40 },
              do: [{ do: 'light', at: { garage: [-4.8, 2.2, -1.6] }, color: 0xffc890, power: 9, range: 5 },
                { do: 'player', stage: { at: TARP_NOSE, face: 52, pose: 'hold' } }] },
            // he goes around to the driver's door, under the cloth
            { seconds: 3.4, fade: 'out', fadeSeconds: 1.2, cam: { from: { garage: [-3.6, 1.5, -3.2] }, look: { garage: [-5.8, 1.0, -3.6] }, fov: 40 },
              do: [{ do: 'player', stage: { at: { garage: [-5.45, 0, -3.3] }, face: 0, pose: 'idle' } }, { do: 'music', calm: 0 }],
              end: [{ do: 'sound', name: 'cloth' }, { do: 'sound', name: 'door', kind: 'close' }, { do: 'player', stage: null }, { do: 'player', inCar: 'theoCar' }, { do: 'vehicleSet', id: 'theoCar', lockExit: true }] },
            // inside. The cloth over the glass. The tape deck. He pushes the tape in.
            { seconds: 9, fade: 'in', fadeSeconds: 1.6, pov: true, cam: { from: { cabin: 'theoCar', at: 'eye', p: [0, 0.02, 0.02] }, to: { cabin: 'theoCar', at: 'eye', p: [0, 0.0, 0.08] }, look: { cabin: 'theoCar', at: 'dash', p: [0, 0.06, -0.06] }, fov: 30, near: NEAR },
              do: [{ do: 'light', at: { cabin: 'theoCar', at: 'dash', p: [0, 0.25, 0.1] }, color: 0xffb070, power: 2.2, range: 2.5 }],
              lines: [{ at: 2.6, do: [{ do: 'sound', name: 'clunk' }, { do: 'music', tape: 6, fromEnd: 14, then: 7, volume: 0.75 }] }] },
            // the covered car in the dark garage. Track 6 to its end. Then track 7: nothing. Rain on the roof.
            { seconds: 24, fade: 'out', fadeSeconds: 4.5, cam: { from: { garage: [-1.0, 1.5, -0.2] }, to: { garage: [-1.4, 1.45, -0.9] }, look: { garage: [-6.9, 0.75, -3.9] }, fov: 40 },
              do: [{ do: 'light', at: { garage: [-4.2, 2.3, -5.6] }, color: 0xffb070, power: 10, range: 8 }] },
          ],
        },
        { do: 'wait', seconds: 1.5 },
        { do: 'music', stop: true },
        { do: 'end', over: 'c2.card.sub', title: 'c2.title', lines: ['c2.end.1', 'c2.end.2', 'c2.end.3'], locked: 'c2.end.locked' },
      ],
    },
  ],
};
