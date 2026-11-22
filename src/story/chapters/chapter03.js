// ---------------------------------------------------------------------------
// CHAPTER 3 - "THE SUNK" (the next night)
//
// This file is ONLY DATA, written like chapter02.js. The story engine
// (src/story/engine.js) explains every word used here at its top. All texts
// are keys of src/story/strings.js. The drowned quarter itself (canals, decks,
// Lena's flat, the Guard post, the drain tunnel) is built by src/city/sunk.js
// from the plan in src/city/sunkPlan.js; the places below come from there.
//
// The night in one line: an old boat, a drowned city, a test with a drone,
// a hacker with a dead company's badge, the truth about the Phantoms, a raid,
// a girl behind the crates, and a debt.
//
// It uses what Chapter 2 left behind: limiter_off, van_color / van_plate (the van),
// keystone_found (the chip). It leaves for Chapter 4:
//   drone_method ('quiet' | 'distraction'), told_lena_theo, lena_code_seen,
//   wren_locked_found, harrow_let_girl_go, chip_holder ('lena' | 'nate').
//
// Places: [x, z] on the ground (on a deck in The Sunk), [x, y, z], { garage: [right, up, toward the street] },
// { of: 'car or person', p: [left, up, forward] }. Directions are compass degrees (0 north, 90 east, 180 south,
// 270 west). Speeds are km/h. Map: +z is north, -z south (the sea), -x east, +x west.
// ---------------------------------------------------------------------------

const NEAR = 0.05;
const PON = -0.62;                                         // the deck of a pontoon (The Sunk)
const NIGHT = { do: 'time', hour: 21.2, rain: true };
const LATE = { do: 'time', hour: 22.6, rain: true };
const MIDNIGHT = { do: 'time', hour: 23.7, rain: true };
const SMALL_HOURS = { do: 'time', hour: 1.2, rain: true };
const DAWN = { do: 'time', hour: 5.75, rain: true };

// ---- places ----
const RUST = { van: [467.5, -195.5], gangway: [479, -191.1], pontoon: [491, -191.1], boat: [496, -198.5] };
const RING_IN = [529, -198];                               // where the Rustwater canal meets the ring
const MARKET = { boat: [638, -257], pier: [640, PON, -249], wick: [655.2, PON + 0.45, -287], wickStand: [652.6, -285.4], platform: [652.5, -281],
  child: [661.4, -262.2], drawing: [661.97, PON + 0.38, -262.2], stall: [658, -275] };
const POST = { boat: [672, -408.5], dock: [672, PON, -415], rampTop: [665.5, 4.5, -417], pad: [706, 4.5, -437], gate: [621, -449] };
const LENA = { boat: [706, -139.5], dock: [706, PON, -134], door: [706, -130.6], room: [705, 1.2, -122], desk: [705, 1.2, -112.4],
  lantern: [700.8, 1.2, -126.3], chair: [705, 1.2, -113.5], reader: [702.2, 2.0, -110.8], screen: [705.2, 2.0, -110.9], wrecked: [705, 1.2, -118],
  roof: [703, -117], w1: [725, -120], w2: [736, -122], escTop: [740, -132.8], escape: [737, -137.4], tideBoat: [737, -144] };
const TUNNEL = { south: [623, -396], north: [623, -326], basin: [623, -300] };
// the cameras at Wick's table: on him (from his right front), on Nate (over Wick's shoulder), both of them
const WICK_CAM = { from: [653.55, 0.85, -288.05], look: [655.2, 0.58, -287.0], fov: 32 };
const NATE_CAM = { from: [655.65, 0.78, -286.45], look: [652.6, 0.98, -285.4], fov: 30 };
const TWO_SHOT = { from: [653.0, 1.7, -290.4], look: [654.1, 0.45, -286.3], fov: 40 };
const GARAGE_IN = { garage: [-4.5, 0, 2.3] };              // the van inside Mace's garage (as in Chapter 2)

// ---- the van (as in Chapter 2: its new color and plate stay; the limiter stays off when it was switched off) ----
const PAINTS = [
  { name: 'c2.paint.blue', color: [0.12, 0.16, 0.25] },
  { name: 'c2.paint.red', color: [0.43, 0.15, 0.1] },
  { name: 'c2.paint.green', color: [0.21, 0.28, 0.2] },
  { name: 'c2.paint.grey', color: [0.37, 0.38, 0.39] },
];
const VAN = (at, face, more = {}) => [
  { do: 'spawn', id: 'van', kind: 'van', at, face, color: [0.74, 0.72, 0.66], paints: PAINTS, paintFlag: 'van_color', enter: true, limit: 0, curbSide: true,
    type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 }, if: { flag: 'limiter_off' }, ...more },
  { do: 'spawn', id: 'van', kind: 'van', at, face, color: [0.74, 0.72, 0.66], paints: PAINTS, paintFlag: 'van_color', enter: true, limit: 80, curbSide: true,
    type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 }, if: { flag: 'limiter_off', is: false }, ...more },
  { do: 'prop', id: 'plate', kind: 'plate', text: 'PM 4471', textFlag: 'van_plate', in: 'van', at: { cabinAt: 'back', p: [0, 0, -0.03] }, rot: [0, Math.PI, 0], replace: true },
  { do: 'prop', id: 'deck', kind: 'deck', in: 'van', at: { cabinAt: 'dash', p: [0, -0.238, -0.137] }, replace: true },
];
// ---- the boats ----
// Mace's old boat: rusty, slow (60 km/h at most), a rough motor
const OLD_BOAT = (at, face, more = {}) => ({ do: 'spawn', id: 'oldBoat', kind: 'patrol_boat', at, face, enter: true, tint: [0.62, 0.42, 0.3], rusty: true, limit: 60,
  type: { label: "MACE'S OLD BOAT", tone: 'rusty' }, ...more });
// the Tidewalkers' boat that waits under the fire escape in the raid
const TIDE_BOAT = (at, face, more = {}) => ({ do: 'spawn', id: 'tideBoat', kind: 'patrol_boat', at, face, enter: true, tint: [0.36, 0.46, 0.4], limit: 66,
  type: { label: 'TIDEWALKER BOAT', tone: 'boat' }, ...more });
const onLoad = (list) => list.map((s) => ({ ...s, onLoad: true }));

// ---- people ----
const MACE = (at, face, more = {}) => ({ do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at, face, pose: 'crossed', fixed: true, mood: 'stern', ...more });
// LENA "STATIC" MARCHETTI (26). Guarded, dry. Her old KVI badge on a cord around her neck.
const LENA_ACTOR = (at, face, more = {}) => ({ do: 'actor', id: 'lena', model: 'Lena_Marchetti', name: 'name.lena', at, face, pose: 'idle', fixed: true, mood: 'stern', ...more });
const BADGE = { do: 'prop', id: 'badge', kind: 'kviBadge', on: 'lena', bone: 'chest', p: [0, 0.06, 0.13] };
// WICK, the old man of the Tidewalkers, at his table on the market platform
const WICK = { do: 'actor', id: 'wick', extra: { pants: [0.08, 0.07, 0.06], coat: [0.22, 0.17, 0.11], patch: [0.12, 0.2, 0.24], scarf: [0.5, 0.36, 0.16], head: [0.36, 0.26, 0.2] },
  name: 'name.wick', at: MARKET.wick, face: 100, pose: 'sit', floorBelow: 0.45, fixed: true, look: 'player', scale: 0.97, mood: 'stern' };
// THE TIDEWALKERS: quiet people in salvaged clothes on the pontoons and roofs. They watch him go by.
const T = (id, at, face, outfit, more = {}) => ({ do: 'actor', id, extra: outfit, name: 'name.tidewalker', at, face, pose: 'idle', fixed: true, look: 'player', mood: 'stern', ...more });
const CLOTH = [
  { pants: [0.1, 0.1, 0.11], coat: [0.14, 0.2, 0.22], patch: [0.3, 0.12, 0.08], scarf: [0.4, 0.38, 0.32], head: [0.1, 0.12, 0.13] },
  { pants: [0.16, 0.12, 0.08], coat: [0.3, 0.22, 0.12], patch: [0.1, 0.12, 0.2], scarf: [0.12, 0.3, 0.28], head: [0.3, 0.22, 0.17] },
  { pants: [0.06, 0.07, 0.08], coat: [0.12, 0.16, 0.1], patch: [0.36, 0.3, 0.2], scarf: [0.42, 0.1, 0.08], head: [0.14, 0.14, 0.12] },
  { pants: [0.12, 0.13, 0.16], coat: [0.28, 0.28, 0.26], patch: [0.08, 0.16, 0.24], scarf: [0.2, 0.2, 0.22], head: [0.32, 0.24, 0.19] },
];
const TIDEWALKERS = [
  T('tw1', [587.2, PON, -282], 270, CLOTH[0], { pose: 'crossed' }),
  T('tw2', [587.6, PON, -300.5], 250, CLOTH[1], { pose: 'hips', scale: 0.95 }),
  T('tw3', [648.8, PON, -293], 80, CLOTH[2], { pose: 'crossed', scale: 1.03 }),
  T('tw4', [600.5, 7.72, -238.5], 200, CLOTH[3], { pose: 'idle' }),
  T('tw5', [641, 7.68, -239.5], 160, CLOTH[0], { pose: 'crossed', scale: 0.98 }),
  T('tw6', [575.5, 8.13, -296], 270, CLOTH[1], { pose: 'idle' }),
  T('tw7', [657.5, PON, -268.5], 90, CLOTH[3], { pose: 'hold', look: null, scale: 0.94 }),
];
// THE CHILD who draws on the wall of the market (a quiet moment), and her drawing
const GIRL = (at, face, more = {}) => ({ do: 'actor', id: 'girl', extra: { pants: [0.12, 0.14, 0.2], coat: [0.45, 0.32, 0.12], patch: [0.15, 0.3, 0.32], scarf: [0.5, 0.15, 0.12], head: [0.18, 0.13, 0.1] },
  name: 'name.girl', at, face, pose: 'flag', fixed: true, look: null, scale: 0.6, ...more });
const MARKET_LIFE = [
  ...TIDEWALKERS,
  WICK,
  GIRL(MARKET.child, 270),
  { do: 'prop', id: 'drawing', kind: 'chalkDrawing', at: MARKET.drawing, face: 90, w: 1.6 },
  // the floating market boat goes slowly up and down the basin
  { do: 'prop', id: 'marketBoat', kind: 'marketBoat', at: [600, -1.05, -300], fly: { path: [[598, -304], [640, -304], [645, -292], [604, -276]], y: -1.05, speed: 0.9 } },
];
// a Guard that knows his face; in The Sunk it comes by boat
const GUARD = { do: 'police', real: true, known: true, disguised: false, gates: false, roadblocks: false, cars: 2, drones: 1, boats: 2, startStars: 2, ram: false, stealth: false, hear: true };
// the Guard post on the south ring: two sentries fly over the roofs, one boat on patrol in front of it
const POST_SENTRIES = [
  { path: [[663.5, -423.5], [684.5, -423.5], [684.5, -443], [663.5, -443]], y: 11.5, speed: 2.4, range: 15, fov: 0.52, sweep: 0.55, stop: 1.2 },
  { path: [[694, -449.5], [716, -449.5], [716, -421], [694, -421]], y: 11.5, speed: 2.1, range: 15, fov: 0.52, sweep: 0.5, stop: 1.6 },
];
// (the distraction: both sentries go and look at the flares at the sea gate)
const GATE_SENTRIES = [
  { path: [[613, -441], [629, -452]], y: 10, speed: 1.6, range: 15, fov: 0.6, sweep: 0.7, stop: 2 },
  { path: [[628, -440], [614, -456]], y: 12, speed: 1.4, range: 15, fov: 0.6, sweep: 0.7, stop: 2 },
];

export default {
  id: 'chapter03',
  number: 3,
  title: 'c3.title',
  // (what a normal game has decided by now; used when a mission is started from the mission list)
  flags: { limiter_off: true, ticket_taken: true, mace_kind: true, keystone_found: true, told_mace_video: true, van_color: 0, van_plate: 'PM 2908' },
  preload: { actors: ['Mace_Doyle', 'Lena_Marchetti', 'Sloane_Harrow'], vehicles: [] },

  missions: [
    // =====================================================================
    // 1. INTO THE SUNK - Mace's plan, the drive to Rustwater, the old boat, the drowned city
    // =====================================================================
    {
      id: 'c3m0', title: 'c3.m0',
      setup: [
        NIGHT,
        { do: 'world', traffic: 14, people: 8, indoors: true, now: true },
        ...VAN(GARAGE_IN, 90),
        { do: 'player', at: { garage: [-2.2, 0, 3.0] }, face: 280 },
        { do: 'allow', enter: ['van'] },
        { do: 'shutter', open: 1, seconds: 0 },
        { do: 'light', at: { garage: [-3.0, 2.6, 4.6] }, color: 0xffc890, power: 22, range: 9 },
        MACE({ garage: [-2.6, 0, 5.2] }, 100, { look: 'player' }),
        // (the van has its new paint and plate from Chapter 2: the Guard does not look twice at it)
        { ...GUARD, stars: 0, cars: 1, drones: 0, disguised: true },
        OLD_BOAT(RUST.boat, 270),
        ...MARKET_LIFE,
      ],
      steps: [
        { do: 'card', over: 'c3.card.over', title: 'c3.title', sub: 'c3.card.sub', seconds: 4.5 },
        {
          do: 'cutscene',
          shots: [
            // the garage at night. Rain on the roof. Mace by the door, Nate with the chip.
            { seconds: 6.2, fade: 'in', fadeSeconds: 2, cam: { from: { garage: [0.4, 1.9, 1.2] }, to: { garage: [0.2, 1.85, 1.6] }, look: { garage: [-2.5, 1.4, 4.4] }, fov: 42 },
              do: [{ do: 'player', stage: { at: { garage: [-2.2, 0, 3.0] }, face: 280, pose: 'idle' }, mood: 'tired' }],
              lines: [{ at: 1.6, who: 'mace', text: 'c3.mace.plan.1', mood: 'stern' }] },
            { seconds: 5.4, cam: { from: { garage: [-1.3, 1.5, 3.3] }, to: { garage: [-1.45, 1.5, 3.55] }, look: { garage: [-2.6, 1.55, 5.2] }, fov: 30 },
              lines: [{ at: 0.3, who: 'mace', text: 'c3.mace.plan.2', seconds: 4.4, mood: 'neutral' }] },
            { seconds: 5.2, cam: { from: { garage: [-2.85, 1.62, 4.55] }, look: { garage: [-2.2, 1.55, 3.0] }, fov: 32 },
              lines: [{ at: 0.3, who: 'nate', text: 'c3.nate.where', seconds: 1.6, mood: 'stern' }, { at: 2.1, who: 'mace', text: 'c3.mace.sunk', seconds: 3.0, mood: 'stern' }] },
            // the key on a cork float, in Mace's open hand
            { seconds: 5.4, cam: { from: { garage: [-1.6, 1.4, 3.6] }, look: { garage: [-2.45, 1.1, 4.3] }, fov: 28 },
              do: [{ do: 'actorSet', id: 'mace', pose: 'hold', look: 'player' }, { do: 'prop', id: 'key', kind: 'boatKey', on: 'mace', bone: 'hand_R', p: [0, -0.06, 0.03] }],
              lines: [{ at: 0.4, who: 'mace', text: 'c3.mace.key', seconds: 3.6, mood: 'smile' }],
              end: [{ do: 'remove', ids: ['key'] }, { do: 'prop', id: 'key', kind: 'boatKey', on: 'player', bone: 'hand_R', p: [0, -0.06, 0.03] }, { do: 'actorSet', id: 'mace', pose: 'crossed' }] },
            { seconds: 3.8, cam: { from: { garage: [-0.6, 1.55, 2.0] }, look: { garage: [-2.4, 1.5, 4.1] }, fov: 36 },
              lines: [{ at: 0.3, who: 'nate', text: 'c3.nate.thanks', seconds: 1.2, mood: 'tired' }, { at: 1.7, who: 'mace', text: 'c3.mace.go', seconds: 1.8, mood: 'stern' }] },
          ],
        },
        { do: 'remove', ids: ['key'] },
        { do: 'player', stage: null, at: { garage: [-3.2, 0, 2.4] }, face: 180 },
        { do: 'world', indoors: false },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: { garage: [-3.2, 0, 2.4] }, face: 180 }] },
        // ---- the drive to Rustwater ----
        { do: 'say', who: 'wren', text: 'c3.wren.route' },
        { do: 'driveTo', text: 'c3.obj.dock', vehicle: 'van', at: RUST.van, radius: 8, stop: true },
        // A QUIET MOMENT: Theo's tape. He takes it out of the deck, looks at it, and puts it away.
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.6, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.02, 0.32] }, look: { cabin: 'van', at: 'wheel', p: [0.05, -0.12, 0.05] }, fov: 38, near: NEAR },
              do: [{ do: 'vehicleSet', id: 'van', stop: true }, { do: 'mood', set: { nate: 'sad' } },
                { do: 'prop', id: 'tape', kind: 'tape', on: 'player', bone: 'hand_R', p: [0.02, -0.08, 0.05], rot: [0.3, 0.4, 0.2] }] },
            { seconds: 3.2, cam: { from: { cabin: 'van', at: 'pass', p: [0.2, 0.06, 0.1] }, look: { cabin: 'van', at: 'eye', p: [0, -0.1, 0.1] }, fov: 34, near: NEAR },
              end: [{ do: 'remove', ids: ['tape'] }, { do: 'mood', set: { nate: 'stern' } }] },
          ],
        },
        { do: 'leave', text: 'c3.obj.walk_dock', marker: RUST.gangway },
        { do: 'allow', enter: ['van', 'oldBoat'] },
        { do: 'checkpoint', id: 2, setup: [...VAN(RUST.van, 270, { replace: true }), { do: 'player', at: [470.5, -193], face: 270 }] },
        // ---- the old boat ----
        { do: 'goto', text: 'c3.obj.walk_dock', at: [RUST.pontoon[0], RUST.pontoon[1]], radius: 3 },
        { do: 'enter', text: 'c3.obj.boat', vehicle: 'oldBoat', tip: 'c3.tip.boat', tipSeconds: 9 },
        { do: 'police', disguised: false },
        { do: 'driveTo', text: 'c3.obj.sunk', vehicle: 'oldBoat', at: RING_IN, radius: 13 },
        // ---- THE FIRST SIGHT: slow, quiet, the drowned city ----
        { do: 'actor', id: 'watcher', extra: CLOTH[2], name: 'name.tidewalker', at: [544.5, 4.29, -226], face: 270, pose: 'crossed', fixed: true, look: 'player' },
        {
          do: 'cutscene',
          shots: [
            // low over the water, the canal opens up to the north: walls, lanterns, mist
            { seconds: 8.5, cam: { from: [528, 0.25, -222], to: [529, 2.6, -218], look: [529, 5, -160], fov: 52 },
              do: [{ do: 'music', calm: 1, volume: 0 }, { do: 'vehicleSet', id: 'oldBoat', stop: true }],
              lines: [{ at: 3.4, who: 'wren', text: 'c3.wren.sunk', seconds: 3.6, moods: { nate: 'tired' } }] },
            // high and slow over the roofs, toward the lanterns of the market
            { seconds: 8, cam: { from: [540, 21, -206], to: [552, 23, -214], look: [630, 2, -282], fov: 48 } },
            // somebody stands on a roof and watches the boat
            { seconds: 5.5, cam: { from: [531, 1.4, -232], to: [531.5, 1.6, -231], look: [544.5, 5.6, -226], fov: 34 },
              lines: [{ at: 1.2, who: 'wren', text: 'c3.wren.people', seconds: 2.6 }],
              end: [{ do: 'music', calm: 0 }] },
          ],
        },
        { do: 'checkpoint', id: 3, setup: [OLD_BOAT(RING_IN, 0, { replace: true }), { do: 'player', inCar: 'oldBoat' }, { do: 'allow', enter: ['oldBoat'] }] },
        // ---- to the market (follow the lanterns) ----
        { do: 'driveTo', text: 'c3.obj.market', vehicle: 'oldBoat', at: MARKET.boat, radius: 9, stop: true },
        { do: 'leave', text: 'c3.obj.tie', marker: MARKET.pier },
        { do: 'talk', actor: 'wick', text: 'c3.obj.wick', radius: 3.4 },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.8, cam: TWO_SHOT,
              do: [{ do: 'player', stage: { at: MARKET.wickStand, face: 270, pose: 'idle' }, mood: 'stern' }, { do: 'actorSet', id: 'wick', look: 'player' }],
              lines: [{ at: 0.6, who: 'wick', text: 'c3.wick.1', seconds: 2.2, mood: 'stern' }] },
            { seconds: 3.4, cam: NATE_CAM,
              lines: [{ at: 0.2, who: 'nate', text: 'c3.nate.static', seconds: 1.8, mood: 'stern' }] },
            { seconds: 9.2, cam: WICK_CAM,
              lines: [{ at: 0.4, who: 'wick', text: 'c3.wick.2', seconds: 2.4 }, { at: 3.0, who: 'wick', text: 'c3.wick.test', seconds: 4.2 }, { at: 7.4, who: 'wick', text: 'c3.wick.test2', seconds: 1.8 }] },
          ],
        },
        { do: 'player', stage: null, at: MARKET.wickStand, face: 270 },
      ],
    },

    // =====================================================================
    // 2. THE TIDEWALKER TEST - steal a Guard drone from the post on the south ring
    // =====================================================================
    {
      id: 'c3m1', title: 'c3.m1',
      setup: [
        LATE,
        { do: 'world', traffic: 8, people: 4, indoors: false },
        ...onLoad([OLD_BOAT(MARKET.boat, 0), ...MARKET_LIFE, { do: 'player', at: MARKET.wickStand, face: 270 }]),
        { do: 'allow', enter: ['oldBoat'] },
        { ...GUARD, stars: 0, cars: 0, drones: 0, boats: 2, stealth: true, startStars: 2, patrol: { at: [688, -409], r: 22, boats: 1 }, sentries: POST_SENTRIES },
        { do: 'prop', id: 'drone', kind: 'surveyDrone', at: [POST.pad[0], POST.pad[1] + 0.12, POST.pad[2]], face: 0 },
      ],
      on: [
        // the stealth: what WREN says when it goes wrong, and a note for Wick's answer
        { spotted: true, do: [{ do: 'say', who: 'wren', text: 'c3.wren.spotted' }, { do: 'flag', set: { test_chased: true } }] },
        { starsOver: 0, do: [{ do: 'flag', set: { test_chased: true } }] },
      ],
      steps: [
        {
          do: 'cutscene', keep: true,
          shots: [
            { seconds: 4.2, cam: WICK_CAM,
              do: [{ do: 'player', stage: { at: MARKET.wickStand, face: 270, pose: 'idle' } }],
              lines: [{ at: 0.4, who: 'wick', text: 'c3.wick.test', seconds: 3.6, mood: 'stern' }] },
          ],
        },
        // CHOICE (Wick remembers): quietly, or with the Tidewalkers' flares at the sea gate
        { do: 'choice', options: [
          { text: 'c3.ch.quiet', set: { drone_method: 'quiet', drone_distract: false } },
          { text: 'c3.ch.distract', set: { drone_method: 'distraction', drone_distract: true } },
        ] },
        {
          do: 'cutscene',
          shots: [
            { seconds: 4.6, cam: TWO_SHOT,
              lines: [
                { at: 0.3, if: { flag: 'drone_distract', is: false }, who: 'wick', text: 'c3.wick.quiet', seconds: 3.8 },
                { at: 0.3, if: { flag: 'drone_distract' }, who: 'wick', text: 'c3.wick.flares', seconds: 4.0 },
              ] },
          ],
        },
        { do: 'player', stage: null, at: MARKET.wickStand, face: 0 },
        { do: 'checkpoint', id: 1 },
        { do: 'enter', text: 'c3.obj.boat', vehicle: 'oldBoat' },
        // the way to the post (the flares are lit when he comes near)
        { do: 'driveTo', text: 'c3.obj.post', vehicle: 'oldBoat', at: POST.boat, radius: 7, stop: true, tip: 'c3.tip.quiet', tipSeconds: 9,
          on: [{ near: POST.boat, radius: 75, if: { flag: 'drone_distract' }, do: [
            { do: 'prop', id: 'flare1', kind: 'redFlare', at: [617, -1.0, -449], face: 30, size: 10 },
            { do: 'prop', id: 'flare2', kind: 'redFlare', at: [625, -1.0, -456], face: 200, size: 10 },
            { do: 'police', sentries: GATE_SENTRIES, patrol: { at: POST.gate, r: 14, boats: 1 }, stealth: true },
            { do: 'say', who: 'wren', text: 'c3.wren.flares' },
          ] }] },
        { do: 'leave', text: 'c3.obj.post_dock', marker: POST.dock },
        { do: 'goto', text: 'c3.obj.climb', at: POST.rampTop, radius: 2.4 },
        { do: 'collect', text: 'c3.obj.take', prop: 'drone', label: 'c3.ui.take_drone', radius: 2.4 },
        { do: 'player', carry: { kind: 'surveyDrone' } },
        // THE HACK: cut the drone's link before it calls home (SKIP = it calls home)
        { do: 'hack', title: 'c3.hack.lock', sub: 'c3.hack.lock_sub', seconds: 12, length: 4, optional: true, flag: 'drone_link_cut',
          ok: [{ do: 'say', who: 'wren', text: 'c3.wren.lock_ok' }],
          fail: [{ do: 'say', who: 'wren', text: 'c3.wren.lock_fail' }, { do: 'police', stars: 2, search: POST.pad, radius: 30 }, { do: 'flag', set: { test_chased: true } }] },
        { do: 'checkpoint', id: 2, setup: [{ do: 'player', at: [706, -435], face: 0, carry: { kind: 'surveyDrone' } }, { do: 'remove', ids: ['drone'] }] },
        { do: 'enter', text: 'c3.obj.back_boat', vehicle: 'oldBoat' },
        { do: 'driveTo', text: 'c3.obj.away', vehicle: 'oldBoat', at: [621, -409], radius: 16 },
        // (with the Guard behind him he may not lead them to the market)
        { do: 'waitFor', text: 'c3.obj.lose', until: { stars: 0 }, if: { starsOver: 0 } },
        { do: 'police', stealth: false, sentries: [], patrol: null },
        { do: 'driveTo', text: 'c3.obj.return', vehicle: 'oldBoat', at: MARKET.boat, radius: 9, stop: true },
        { do: 'leave', text: 'c3.obj.tie', marker: MARKET.pier },
        { do: 'talk', actor: 'wick', text: 'c3.obj.wick', radius: 3.4 },
        { do: 'player', carry: null },
        {
          do: 'cutscene',
          shots: [
            { seconds: 5.6, cam: TWO_SHOT,
              do: [{ do: 'player', stage: { at: MARKET.wickStand, face: 270, pose: 'idle' } }, { do: 'prop', id: 'droneOnTable', kind: 'surveyDrone', at: [653.8, 0.02, -287.2], face: 120 }],
              lines: [
                { at: 0.5, if: { flag: 'test_chased' }, who: 'wick', text: 'c3.wick.end_chased', seconds: 3.6, mood: 'angry' },
                { at: 0.5, if: { all: [{ flag: 'test_chased', is: false }, { flag: 'drone_distract' }] }, who: 'wick', text: 'c3.wick.end_distract', seconds: 4.0, mood: 'smile' },
                { at: 0.5, if: { all: [{ flag: 'test_chased', is: false }, { flag: 'drone_distract', is: false }] }, who: 'wick', text: 'c3.wick.end_quiet', seconds: 3.6, mood: 'neutral' },
              ] },
            { seconds: 5.2, cam: WICK_CAM,
              lines: [{ at: 0.3, who: 'wick', text: 'c3.wick.static', seconds: 4.4, mood: 'neutral' }] },
          ],
        },
        { do: 'flag', set: { tide_trust: true } },
        { do: 'remove', ids: ['flare1', 'flare2'] },
        { do: 'player', stage: null, at: MARKET.wickStand, face: 0 },
      ],
    },

    // =====================================================================
    // 3. STATIC - Lena's flat. A lantern. The chip. What the Phantoms are.
    // =====================================================================
    {
      id: 'c3m2', title: 'c3.m2',
      flags: { drone_method: 'quiet', drone_distract: false, tide_trust: true },
      setup: [
        MIDNIGHT,
        { do: 'world', traffic: 6, people: 4, indoors: false },
        ...onLoad([OLD_BOAT(MARKET.boat, 0), ...MARKET_LIFE, { do: 'player', at: MARKET.wickStand, face: 0 }]),
        { do: 'allow', enter: ['oldBoat'] },
        { ...GUARD, stars: 0, cars: 0, drones: 0, boats: 1, stealth: false, sentries: [], patrol: null },
        // Lena in the dark of her flat; the lantern is not lit yet
        LENA_ACTOR([700.3, 1.2, -125.2], 200, { mood: 'stern', look: null }),
        BADGE,
        { do: 'prop', id: 'lanternOff', kind: 'lantern', at: LENA.lantern, face: 0 },
        { do: 'prop', id: 'reader', kind: 'chipReader', at: LENA.reader, face: 180, chip: false },
      ],
      steps: [
        { do: 'enter', text: 'c3.obj.boat', vehicle: 'oldBoat' },
        { do: 'driveTo', text: 'c3.obj.lena', vehicle: 'oldBoat', at: LENA.boat, radius: 7, stop: true },
        { do: 'leave', text: 'c3.obj.tie', marker: LENA.dock },
        { do: 'goto', text: 'c3.obj.inside', at: LENA.room, radius: 2.2 },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: [705, 1.2, -121], face: 0 }] },
        {
          do: 'cutscene', skippable: true,
          shots: [
            // the dark room. Screens. A match. The lantern.
            { seconds: 6, cam: { from: [708.6, 2.2, -121.6], to: [708.2, 2.1, -121.9], look: [700.9, 1.4, -126], fov: 38 },
              do: [{ do: 'player', stage: { at: [705.4, 1.2, -121.4], face: 230, pose: 'idle' }, mood: 'stern' },
                { do: 'actorSet', id: 'lena', at: [701.6, 1.2, -125.6], face: 225, pose: 'hold', look: { yaw: 0, pitch: 0.5 } }, { do: 'music', calm: 0 }],
              lines: [{ at: 2.6, do: [{ do: 'remove', ids: ['lanternOff'] }, { do: 'prop', id: 'lantern', kind: 'lantern', at: LENA.lantern, lit: true },
                { do: 'light', at: [700.8, 1.75, -126.1], color: 0xffb070, power: 26, range: 11 }, { do: 'sound', name: 'tick' }] }] },
            // she looks up at him
            { seconds: 7.4, cam: { from: [703.6, 1.85, -122.6], look: [701.6, 1.6, -125.4], fov: 32 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'idle', look: 'player' }],
              lines: [{ at: 0.6, who: 'lena', text: 'c3.lena.hi', seconds: 2.4, mood: 'smirk' }, { at: 3.3, who: 'nate', text: 'c3.nate.mace', seconds: 1.4 }, { at: 5.0, who: 'lena', text: 'c3.lena.mace', seconds: 2.2, mood: 'neutral' }] },
            { seconds: 3.4, cam: { from: [702.6, 1.7, -124.8], look: [705.4, 1.55, -121.4], fov: 34 },
              lines: [{ at: 0.4, who: 'lena', text: 'c3.lena.chip', seconds: 1.5, mood: 'stern' }],
              end: [{ do: 'actorSet', id: 'lena', at: [705.2, 1.2, -112.6], face: 0, pose: 'hold', look: { x: 702.2, y: 2.05, z: -110.8 } },
                { do: 'player', stage: { at: [706.9, 1.2, -114.6], face: 330, pose: 'idle' } },
                { do: 'remove', ids: ['reader'] }, { do: 'prop', id: 'reader', kind: 'chipReader', at: LENA.reader, face: 180 }] },
            // the chip goes into the reader
            { seconds: 5, cam: { from: [703.4, 2.5, -112.4], look: [702.2, 2.0, -110.9], fov: 30 },
              lines: [{ at: 0.4, do: [{ do: 'sound', name: 'clunk' }] }, { at: 1.4, who: 'lena', text: 'c3.lena.reading', seconds: 3.2, mood: 'neutral' }],
              end: [{ do: 'prop', id: 'reveal', kind: 'codeScreen', at: [705.2, 2.0, -110.95], face: 180, w: 1.1, title: 'c3.screen.title', lines: ['c3.screen.1', 'c3.screen.2', 'c3.screen.3', '!c3.screen.4'] }] },
            // THE REVEAL: nothing is said. A long hold on the screen. The rain.
            { seconds: 9, cam: { from: [705.2, 2.38, -112.7], to: [705.2, 2.35, -112.2], look: [705.2, 2.38, -110.9], fov: 30 },
              do: [{ do: 'music', silence: 14 }] },
            { seconds: 6.8, cam: { from: [706.4, 1.8, -114.0], look: [705.2, 1.75, -112.4], fov: 30 },
              lines: [{ at: 0.5, who: 'lena', text: 'c3.lena.notai', seconds: 1.8, mood: 'worried' }, { at: 2.8, who: 'lena', text: 'c3.lena.minds', seconds: 3.6 }] },
            { seconds: 6.8, cam: { from: [704.2, 1.8, -113.0], look: [706.9, 1.65, -114.6], fov: 30 },
              lines: [{ at: 0.3, who: 'nate', text: 'c3.nate.racers', seconds: 2.0, mood: 'stern' }, { at: 2.7, who: 'lena', text: 'c3.lena.fast', seconds: 3.4, mood: 'sad' }] },
            // Nate, alone with it
            { seconds: 5.4, cam: { from: [705.6, 1.7, -113.4], look: [706.9, 1.66, -114.6], fov: 26 },
              do: [{ do: 'mood', set: { nate: 'pain' } }],
              lines: [{ at: 1.4, who: 'nate', text: 'c3.nate.theo', seconds: 2.6, mood: 'sad' }] },
            // Lena reads the driving code. She goes still. She looks down at her old badge. She does not say why.
            { seconds: 7.4, cam: { from: [704.0, 2.1, -111.9], to: [704.1, 2.05, -112.1], look: [705.2, 1.6, -112.6], fov: 28 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'hold', look: { yaw: 0, pitch: 0.62 }, mood: 'worried' }, { do: 'flag', set: { lena_code_seen: true } }],
              lines: [{ at: 5.0, who: 'lena', text: 'c3.lena.minute', seconds: 1.8, mood: 'sad' }] },
          ],
        },
        // CHOICE (she remembers): tell her about Theo, or not
        { do: 'choice', options: [{ text: 'c3.ch.tell', set: { told_lena_theo: true } }, { text: 'c3.ch.hide', set: { told_lena_theo: false } }] },
        {
          do: 'cutscene',
          shots: [
            { if: { flag: 'told_lena_theo' }, seconds: 7.8, cam: { from: [704.2, 1.8, -113.0], look: [706.9, 1.65, -114.6], fov: 30 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'idle', look: 'player' }],
              lines: [{ at: 0.4, who: 'nate', text: 'c3.nate.tell', seconds: 4.4, mood: 'sad' }, { at: 5.2, who: 'lena', text: 'c3.lena.tell', seconds: 2.4, mood: 'sad' }] },
            { if: { flag: 'told_lena_theo', is: false }, seconds: 5.2, cam: { from: [706.4, 1.8, -114.0], look: [705.2, 1.75, -112.4], fov: 30 },
              do: [{ do: 'actorSet', id: 'lena', pose: 'idle', look: 'player' }],
              lines: [{ at: 0.3, who: 'lena', text: 'c3.lena.where', seconds: 1.8, mood: 'stern' }, { at: 2.4, who: 'nate', text: 'c3.nate.nothing', seconds: 1.2 }, { at: 3.9, who: 'lena', text: 'c3.lena.sure', seconds: 1.0, mood: 'neutral' }] },
            // she listens to WREN
            { seconds: 10.4, cam: { from: [705.9, 1.85, -113.3], to: [705.7, 1.8, -113.6], look: [706.9, 1.66, -114.6], fov: 28 },
              do: [{ do: 'actorSet', id: 'lena', look: 'player', pose: 'hold' }],
              lines: [{ at: 0.4, who: 'lena', text: 'c3.lena.scan', seconds: 2.4, mood: 'neutral' }, { at: 3.4, do: [{ do: 'sound', name: 'beep' }] },
                { at: 4.0, who: 'lena', text: 'c3.lena.locked', seconds: 3.0, mood: 'worried' }, { at: 7.4, who: 'wren', text: 'c3.wren.notmine', seconds: 2.6 }] },
            { seconds: 3.4, cam: { from: [704.2, 1.8, -113.0], look: [706.9, 1.65, -114.6], fov: 28 },
              do: [{ do: 'flag', set: { wren_locked_found: true } }],
              lines: [{ at: 0.6, who: 'nate', text: 'c3.nate.wren', seconds: 1.4, mood: 'worried' }] },
          ],
        },
        { do: 'player', stage: null, at: [706.9, 1.2, -115], face: 0 },
      ],
    },

    // =====================================================================
    // 4. THE RAID - the Guard comes for his HALO. A hack, the roofs, a girl, the tunnel.
    // =====================================================================
    {
      id: 'c3m3', title: 'c3.m3',
      flags: { drone_method: 'quiet', drone_distract: false, tide_trust: true, lena_code_seen: true, told_lena_theo: true, wren_locked_found: true },
      setup: [
        SMALL_HOURS,
        { do: 'world', traffic: 4, people: 0, indoors: false },
        ...onLoad([OLD_BOAT(LENA.boat, 90), LENA_ACTOR([705.2, 1.2, -112.6], 0), BADGE,
          { do: 'prop', id: 'lantern', kind: 'lantern', at: LENA.lantern, lit: true }, { do: 'prop', id: 'reader', kind: 'chipReader', at: LENA.reader, face: 180 },
          { do: 'prop', id: 'reveal', kind: 'codeScreen', at: [705.2, 2.0, -110.95], face: 180, w: 1.1, title: 'c3.screen.title', lines: ['c3.screen.1', 'c3.screen.2', 'c3.screen.3', '!c3.screen.4'] },
          { do: 'player', at: [706.9, 1.2, -115], face: 0 }]),
        { do: 'light', at: [700.8, 1.75, -126.1], color: 0xffb070, power: 26, range: 11 },
        { do: 'allow', enter: ['tideBoat'] },
        { ...GUARD, stars: 0, cars: 0, drones: 2, boats: 2, stealth: false, sentries: [], patrol: null, ram: true },
        TIDE_BOAT(LENA.tideBoat, 90),
        // Harrow's boat at Lena's pontoon, and the girl hiding behind the crates there
        { do: 'prop', id: 'crates', kind: 'crates', at: [715.2, PON, -133.4], face: 180, tall: true },
        GIRL([716.6, PON + 0.22, -133.0], 0, { pose: 'sitEdge', floorBelow: 0.24, hidden: true, replace: true }),
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            // a hum outside. White light moves across the windows.
            { seconds: 5.6, cam: { from: [710.6, 2.4, -120.4], look: [704.4, 1.7, -113.6], fov: 40 },
              do: [{ do: 'player', stage: { at: [706.9, 1.2, -115], face: 330, pose: 'idle' }, mood: 'worried' }, { do: 'music', tension: 0.75 },
                { do: 'light', at: [712, 3.6, -126], color: 0xdde8ff, power: 40, range: 16 }, { do: 'actorSet', id: 'lena', look: { x: 712, y: 3.2, z: -130 }, mood: 'afraid' }],
              lines: [{ at: 2.4, who: 'lena', text: 'c3.lena.track', seconds: 3.0, mood: 'afraid' }] },
          ],
        },
        // THE HACK: Lena cuts the tracker; Nate holds the line. Failing it costs a star more.
        { do: 'hack', title: 'c3.hack.tracker', sub: 'c3.hack.tracker_sub', seconds: 15, length: 6, flag: 'tracker_cut',
          ok: [{ do: 'say', who: 'lena', text: 'c3.lena.cut' }],
          fail: [{ do: 'say', who: 'lena', text: 'c3.lena.cut_late' }] },
        {
          do: 'cutscene',
          shots: [
            // the Guard at her door: a boat with its lights, Harrow on the pontoon
            { seconds: 6.4, cam: { from: [699, 0.9, -146], look: [707, 0.8, -134.5], fov: 40 },
              do: [{ do: 'spawn', id: 'harrowBoat', kind: 'patrol_boat', at: [703, -140.5], face: 90, tint: [0.24, 0.27, 0.34], npc: true, flash: true },
                { do: 'actor', id: 'harrow', model: 'Sloane_Harrow', name: 'name.harrow', at: [704.2, PON, -134.2], face: 0, pose: 'hips', fixed: true, look: null, mood: 'stern' }],
              lines: [{ at: 1.0, who: 'harrow', text: 'c3.harrow.pa', seconds: 4.2, kind: 'thought', mood: 'stern' }] },
            { seconds: 3.0, cam: { from: [703.6, 1.9, -114.4], look: [705.4, 1.55, -112.8], fov: 34 },
              do: [{ do: 'actorSet', id: 'lena', look: 'player', pose: 'idle' }],
              lines: [{ at: 0.4, who: 'lena', text: 'c3.lena.roof', seconds: 1.4, mood: 'stern' }] },
            // up the inner stairs to the roof
            { seconds: 1.4, fade: 'out', fadeSeconds: 1.0, cam: { from: [703.6, 1.9, -114.4], look: [702.5, 2.4, -113.5], fov: 34 },
              end: [{ do: 'player', stage: null, at: LENA.roof, face: 270 }, { do: 'actorSet', id: 'lena', at: [705.5, -115.6], face: 270, pose: 'idle', look: null },
                { do: 'light' }, { do: 'remove', ids: ['reveal'] }] },
          ],
        },
        { do: 'fade', to: 'clear', seconds: 0.8 },
        // the Guard is out: stars, boats, drones (a fix on him if the hack failed)
        { do: 'police', stars: 2, search: LENA.door, radius: 40, if: { flag: 'tracker_cut' } },
        { do: 'police', stars: 3, seen: true, if: { flag: 'tracker_cut', is: false } },
        { do: 'checkpoint', id: 1, setup: [{ do: 'player', at: LENA.roof, face: 270 }, { do: 'actor', id: 'lena', replace: true, model: 'Lena_Marchetti', name: 'name.lena', at: [705.5, -115.6], face: 270, pose: 'idle', fixed: true, mood: 'stern' }, BADGE,
          { do: 'police', stars: 2, search: LENA.door, radius: 40 }] },
        // ---- over the roofs: Lena leads ----
        { do: 'actorSet', id: 'lena', walk: [721.5, -123.8], speed: 3.0 },
        { do: 'goto', text: 'c3.obj.roof', at: LENA.w1, radius: 3.2, tip: 'c3.tip.tunnel', tipSeconds: 8,
          on: [{ near: [719, -123.8], radius: 3, do: [{ do: 'actorSet', id: 'lena', walk: [734.5, -126.8], speed: 3.0 }] }] },
        { do: 'actorSet', id: 'lena', walk: [739.6, -129.5], speed: 3.0 },
        { do: 'goto', text: 'c3.obj.roof', at: LENA.w2, radius: 3.2 },
        // THE GIRL: Harrow sees her behind the crates, and looks away. (Four seconds. Nobody can do anything.)
        {
          do: 'cutscene', skippable: false,
          shots: [
            { seconds: 4.2, cam: { from: [721.6, 12.9, -129.4], to: [721.4, 12.85, -129.8], look: [712.5, 0.2, -133.6], fov: 34 },
              do: [{ do: 'actorSet', id: 'girl', hidden: false }, { do: 'actorSet', id: 'harrow', at: [710.6, PON, -134.0], face: 270, pose: 'idle', look: { x: 716.6, y: 0.3, z: -133 } },
                { do: 'light', at: [711, 1.6, -134.2], color: 0xe8f0ff, power: 18, range: 7 }, { do: 'flag', set: { harrow_let_girl_go: true } }],
              lines: [{ at: 2.3, do: [{ do: 'actorSet', id: 'harrow', faceAway: { of: 'girl' }, look: null }] }, { at: 2.6, who: 'harrow', text: 'c3.harrow.clear', seconds: 1.4, mood: 'stern' }],
              end: [{ do: 'light' }] },
          ],
        },
        // (Lena goes first, down the fire escape: landing, flight, landing, flight, the pontoon)
        { do: 'meanwhile', steps: [
          { do: 'actorSet', id: 'lena', walk: [739.8, -132.8], speed: 2.6 }, { do: 'wait', seconds: 1.6 },
          { do: 'actorSet', id: 'lena', walk: [729.6, -133.1], speed: 2.4 }, { do: 'wait', seconds: 4.4 },
          { do: 'actorSet', id: 'lena', walk: [727.9, -133.1], speed: 2.0 }, { do: 'wait', seconds: 1.0 },
          { do: 'actorSet', id: 'lena', walk: [727.9, -134.9], speed: 2.0 }, { do: 'wait', seconds: 1.0 },
          { do: 'actorSet', id: 'lena', walk: [735.4, -134.9], speed: 2.4 }, { do: 'wait', seconds: 3.4 },
          { do: 'actorSet', id: 'lena', walk: [738.4, -137.2], speed: 2.4, then: 180 },
        ] },
        { do: 'goto', text: 'c3.obj.fire_escape', at: LENA.escape, radius: 2.4 },
        { do: 'checkpoint', id: 2, setup: [{ do: 'player', at: LENA.escape, face: 180 }, { do: 'actor', id: 'lena', replace: true, model: 'Lena_Marchetti', name: 'name.lena', at: [738.5, -136.8], face: 180, pose: 'idle', fixed: true, mood: 'stern' }, BADGE,
          { do: 'police', stars: 2, search: LENA.door, radius: 40 }] },
        { do: 'enter', text: 'c3.obj.tide_boat', vehicle: 'tideBoat' },
        { do: 'actorSet', id: 'lena', seat: 'tideBoat', pose: 'sit' },
        // ---- the chase on the canals, to the drain tunnel under the pump hall ----
        { do: 'driveTo', text: 'c3.obj.tunnel', vehicle: 'tideBoat', at: TUNNEL.south, radius: 9 },
        { do: 'waitFor', text: 'c3.obj.tunnel', until: { tunnel: true } },
        { do: 'say', who: 'wren', text: 'c3.wren.dark' },
        { do: 'driveTo', text: 'c3.obj.through', vehicle: 'tideBoat', at: TUNNEL.north, radius: 6,
          on: [{ tunnel: true, hold: 2.5, do: [{ do: 'police', stars: 0 }, { do: 'music', tension: 0.2 }] }] },
        { do: 'police', stars: 0 },
        { do: 'say', who: 'wren', text: 'c3.wren.lost' },
        { do: 'driveTo', text: 'c3.obj.through', vehicle: 'tideBoat', at: TUNNEL.basin, radius: 9, stop: true },
        {
          do: 'cutscene',
          shots: [
            // out into the quiet of the market basin. The lanterns. Nobody says a word.
            { seconds: 6.4, fade: 'out', fadeSeconds: 2.4, cam: { from: [616, 2.0, -296], look: { of: 'tideBoat', p: [0, 2.0, 0] }, fov: 40 },
              do: [{ do: 'music', tension: 0 }, { do: 'sound', name: 'clunk' }],
              lines: [{ at: 1.2, who: 'lena', text: 'c3.lena.wick', seconds: 3.0, mood: 'tired' }] },
          ],
        },
        { do: 'remove', ids: ['harrowBoat', 'harrow', 'girl', 'crates'] },
      ],
    },

    // =====================================================================
    // 5. THE COST - morning. What is left of her flat. A debt.
    // =====================================================================
    {
      id: 'c3m4', title: 'c3.m4',
      flags: { drone_method: 'quiet', drone_distract: false, tide_trust: true, lena_code_seen: true, told_lena_theo: true, wren_locked_found: true, harrow_let_girl_go: true, tracker_cut: true },
      setup: [
        DAWN,
        { do: 'world', traffic: 4, people: 0, indoors: false },
        { ...GUARD, stars: 0, cars: 0, drones: 0, boats: 0, stealth: false, sentries: [], patrol: null },
        { do: 'police', stars: 0 },
        TIDE_BOAT([623, -296], 0, { replace: true }),
        { do: 'player', inCar: 'tideBoat' },
        { do: 'allow', enter: ['tideBoat'] },
        { do: 'actor', id: 'lena', replace: true, model: 'Lena_Marchetti', name: 'name.lena', at: [623, -296], face: 0, pose: 'sit', fixed: true, mood: 'tired', seat: 'tideBoat' },
        BADGE,
        { do: 'sunk', lena: 'wrecked' },
        { do: 'prop', id: 'wreck', kind: 'debris', at: LENA.wrecked, face: 10 },
        { do: 'remove', ids: ['lantern', 'lanternOff', 'reader', 'reveal', 'oldBoat'] },
      ],
      steps: [
        { do: 'driveTo', text: 'c3.obj.home', vehicle: 'tideBoat', at: LENA.boat, radius: 7, stop: true, quiet: false },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the loading door, the ceiling down inside, the screens dark. Grey light.
            // (from the water behind the boat: Lena small at the left, her back to us, the broken door ahead)
            { seconds: 7, cam: { from: [699.6, 3.1, -142.8], to: [699.9, 3.2, -142.2], look: [705.2, 0.9, -128.2], fov: 42 },
              do: [{ do: 'vehicleSet', id: 'tideBoat', place: [706, -1.5, -139.5], face: 270, stop: true }, { do: 'music', calm: 0.6 }] },
            // Lena in the boat, soaked. She does not look at him.
            { seconds: 8.6, cam: { from: { of: 'tideBoat', p: [-3.8, 2.75, -1.2] }, look: { of: 'lena', p: [0, 0.6, 0.12] }, fov: 32 },
              lines: [{ at: 1.2, who: 'lena', text: 'c3.lena.cost', seconds: 2.4, mood: 'sad' }, { at: 5.0, who: 'lena', text: 'c3.lena.pay', seconds: 2.6, mood: 'stern' }] },
          ],
        },
        // CHOICE (it matters in Chapter 4): who keeps the KEYSTONE chip
        { do: 'choice', options: [{ text: 'c3.ch.give', set: { chip_holder: 'lena', chip_to_lena: true } }, { text: 'c3.ch.keep', set: { chip_holder: 'nate', chip_to_lena: false } }] },
        {
          do: 'cutscene',
          shots: [
            { if: { flag: 'chip_to_lena' }, seconds: 5.6, cam: { from: { of: 'tideBoat', p: [-1.25, 3.3, -1.3] }, look: { of: 'lena', p: [0, 0.55, 0.15] }, fov: 32 },
              lines: [{ at: 0.4, who: 'nate', text: 'c3.nate.give', seconds: 2.4, mood: 'stern' }, { at: 3.3, who: 'lena', text: 'c3.lena.give', seconds: 1.8, mood: 'neutral' }] },
            { if: { flag: 'chip_to_lena', is: false }, seconds: 5.8, cam: { from: { of: 'tideBoat', p: [-1.25, 3.3, -1.3] }, look: { of: 'lena', p: [0, 0.55, 0.15] }, fov: 32 },
              lines: [{ at: 0.4, who: 'nate', text: 'c3.nate.keep', seconds: 2.4, mood: 'stern' }, { at: 3.3, who: 'lena', text: 'c3.lena.keep', seconds: 2.2, mood: 'smirk' }] },
          ],
        },
        { do: 'music', calm: 0 },
      ],
    },

    // =====================================================================
    // 6. INTO THE MIST - the boat goes away along the canal. Lena and the code.
    // =====================================================================
    {
      id: 'c3m5', title: 'c3.m5',
      flags: { drone_method: 'quiet', drone_distract: false, tide_trust: true, lena_code_seen: true, told_lena_theo: true, wren_locked_found: true, harrow_let_girl_go: true, tracker_cut: true, chip_holder: 'lena', chip_to_lena: true },
      setup: [
        { do: 'time', hour: 6.05, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: false },
        { ...GUARD, stars: 0, cars: 0, drones: 0, boats: 0, stealth: false, sentries: [], patrol: null },
        { do: 'police', stars: 0 },
        { do: 'sunk', lena: 'wrecked' },
        TIDE_BOAT(LENA.boat, 270, { replace: true }),
        { do: 'actor', id: 'lena', replace: true, model: 'Lena_Marchetti', name: 'name.lena', at: [706, -139.5], face: 0, pose: 'sit', fixed: true, mood: 'tired', seat: 'tideBoat', look: { yaw: 0, pitch: 0.5 } },
        BADGE,
        { do: 'prop', id: 'tablet', kind: 'tablet', on: 'lena', bone: 'hand_R', p: [0.02, 0.05, 0.08], rot: [0.5, 0, 0] },
        { do: 'player', hidden: true },
      ],
      steps: [
        { do: 'drive', id: 'tideBoat', mode: 'boat', path: [[720, -141], [731, -150], [731, -260], [731, -400]], speed: 12, event: 'gone' },
        {
          do: 'cutscene', skippable: true,
          shots: [
            // the glow of the tablet on her face; the old badge swinging on its cord
            { seconds: 7, fade: 'in', fadeSeconds: 2, cam: { from: { of: 'tideBoat', p: [-3.1, 2.3, -2.2] }, look: { of: 'lena', p: [0, 0.45, 0.25] }, fov: 30 },
              do: [{ do: 'music', calm: 0.9 }, { do: 'fill', power: 0.5 }] },
            { seconds: 6.4, cam: { from: { of: 'tideBoat', p: [-2.55, 2.2, -2.75] }, look: { of: 'lena', p: [0, 0.38, 0.22] }, fov: 24 } },
            // and the boat goes away down the canal, into the mist
            // (from the corner of the canal, behind the boat: it is 30 m away when this starts, 75 m at the end)
            { seconds: 14, fade: 'out', fadeSeconds: 5, cam: { from: [731.8, 1.25, -137.5], to: [731.6, 1.45, -139.5], look: { of: 'tideBoat', p: [0, 2.0, 0] }, fov: 30 } },
          ],
        },
        { do: 'wait', seconds: 1.2 },
        { do: 'music', calm: 0 },
        { do: 'end', over: 'c3.card.sub', title: 'c3.title', lines: ['c3.end.1', 'c3.end.2', 'c3.end.3'], locked: 'c3.end.locked' },
      ],
    },
  ],
};
