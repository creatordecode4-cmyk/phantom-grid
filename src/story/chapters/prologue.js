// ---------------------------------------------------------------------------
// PROLOGUE - "LAST LAP" (four years ago)
//
// This file is ONLY DATA. The story engine (src/story/engine.js) reads it and
// explains every word used here at its top. All texts are keys of
// src/story/strings.js.
//
// SHORT GUIDE
//   missions: the parts of the chapter. The game saves at the start of each.
//     setup:  puts the scene in place (cars, people, weather). Steps with
//             "onLoad: true" only run when the game STARTS at this mission.
//     steps:  what happens, one after the other.
//   A place is [x, z] (on the ground), [x, y, z], { of: 'car or person',
//   p: [left, up, forward] } (a point next to something) or { cabin: 'car',
//   at: 'eye' | 'pass' | 'mid' | 'dash' | 'seat' | 'passSeat', p } (inside a car).
//   Directions ("face") are compass degrees: 0 north, 90 east, 180 south, 270 west.
//   Speeds are km/h. Map: +z is north, -z south (the ocean), -x east, +x west.
// ---------------------------------------------------------------------------

const DECK = 8;                        // height of the raised highway
const DARK = [0.07, 0.075, 0.085];     // the paint of the black Phantom
const NEAR = 0.05;                     // a lens that can sit inside a car

// Nate's car, with Theo in the seat next to him
const RIDE = (at, face) => ({ do: 'spawn', id: 'ride', kind: 'chrome_supercar', or: 'coupe', color: [0.6, 0.62, 0.66], at, face, arena: 'highway', lockExit: true });
const THEO = { do: 'actor', id: 'theo', model: 'Theo_Calloway', name: 'name.theo', seat: 'ride' };
// the tape deck in the dashboard, with the mixtape "DON'T SKIP" in it
const DECK_PROP = { do: 'prop', id: 'deck', kind: 'deck', in: 'ride', at: { cabinAt: 'dash', p: [0, 0.03, -0.06] } };

// the cars and people on the start line (used by two missions)
const GRID = [
  { do: 'spawn', id: 'r1', kind: 'coupe', at: [-482.9, 692], face: 180, color: [0.5, 0.05, 0.04], arena: 'highway', simple: true, npc: true },
  { do: 'spawn', id: 'r2', kind: 'sedan', at: [-478.7, 692], face: 180, color: [0.1, 0.12, 0.2], arena: 'highway', simple: true, npc: true },
  { do: 'spawn', id: 'r3', kind: 'coupe', at: [-482.9, 700], face: 180, color: [0.8, 0.8, 0.78], arena: 'highway', simple: true, npc: true },
  // people who came to watch: cars on the shoulder with their lights on
  { do: 'spawn', id: 'sp1', kind: 'suv', at: [-474.8, 716], face: 196, color: [0.3, 0.31, 0.33], arena: 'highway', simple: true, npc: true },
  { do: 'spawn', id: 'sp2', kind: 'sedan', at: [-494.6, 724], face: 160, color: [0.42, 0.52, 0.6], arena: 'highway', simple: true, npc: true },
  { do: 'spawn', id: 'sp3', kind: 'coupe', at: [-474.7, 735], face: 185, color: [0.05, 0.05, 0.055], arena: 'highway', simple: true, npc: true },
  // DANTE RIOS, the host. What he wants: a clean race and no Guard. In his hand: a scanner he keeps checking.
  { do: 'actor', id: 'dante', model: 'Dante_Rios', name: 'name.dante', at: [-473.5, DECK, 696.5], face: 90, fixed: true },
  { do: 'prop', id: 'line', kind: 'startLine', at: [-479, DECK, 689.5], width: 13 },
  { do: 'prop', id: 'fl1', kind: 'flare', at: [-486, DECK, 689.5] },
  { do: 'prop', id: 'fl2', kind: 'flare', at: [-472.9, DECK, 689.5] },
  { do: 'prop', id: 'fl3', kind: 'flare', at: [-474.2, DECK, 708] },
  { do: 'prop', id: 'co1', kind: 'cone', at: [-476.7, DECK, 730] },
  { do: 'prop', id: 'co2', kind: 'cone', at: [-480.7, DECK, 720] },
  { do: 'prop', id: 'co3', kind: 'cone', at: [-476.7, DECK, 710] },
];
// the black car that ends the race
const PHANTOM = (at, face) => ({ do: 'spawn', id: 'phantom', kind: 'tech_patrol_car', or: 'sedan', color: [0.02, 0.02, 0.025], at, face, tint: DARK, lights: 'bar', npc: true, noDetail: true });

export default {
  id: 'prologue',
  number: 0,
  title: 'p.title',
  vehicle: 'ride',
  // loaded before the chapter starts (while its title card is shown)
  preload: { actors: ['Theo_Calloway', 'Dante_Rios'], vehicles: ['chrome_supercar'] },
  paths: {
    // the racing line: down the highway and its ramp, right onto Neon Mile, west, right at the lights
    race: [[-478.7, 720], [-478.7, -236], [-478.7, -366], [-476.4, -378], [-470, -385.2], [-458, -388.1], [-62, -388.1], [-30, -387], [-17, -382], [-10.5, -372], [-8.75, -356], [-8.75, -250]],
  },

  missions: [
    // =====================================================================
    // 1. ON THE GRID - the car, the tape, the two brothers
    // =====================================================================
    {
      id: 'p1', title: 'p.m1',
      setup: [
        { do: 'time', hour: 2.6, rain: true },
        { do: 'world', traffic: 0, people: 0 },           // 3 in the morning: the roads are empty
        RIDE([-478.7, 746], 180),
        THEO, DECK_PROP,
        ...GRID,
        { do: 'player', inCar: 'ride' },
        { do: 'allow', enter: 'none' },
        { do: 'music', tape: 2, hud: true },
      ],
      steps: [
        { do: 'card', over: 'p.card.over', title: 'p.title', sub: 'p.card.sub', seconds: 4.5 },
        {
          do: 'cutscene',
          shots: [
            // outside: the camera comes slowly toward the car. Rain, the engine, a tape playing inside.
            { seconds: 7, fade: 'in', fadeSeconds: 2.2, cam: { from: { of: 'ride', p: [2.7, 1.0, 7.6] }, to: { of: 'ride', p: [1.9, 1.05, 5.3] }, look: { of: 'ride', p: [0, 0.85, 0] }, fov: 32 } },
            // inside, seen from the back: Theo changes the track. QUIET MOMENT.
            {
              seconds: 10.5, cam: { from: { cabin: 'ride', at: 'mid', p: [0, 0.03, -0.62] }, to: { cabin: 'ride', at: 'mid', p: [0, 0.04, -0.5] }, look: { cabin: 'ride', at: 'dash', p: [-0.1, 0.08, 0] }, fov: 62, near: NEAR },
              do: [{ do: 'actorSet', id: 'theo', look: { yaw: 0.45, pitch: 0.3 } }],
              lines: [
                { at: 1.6, do: [{ do: 'music', tape: 3 }] },
                { at: 2.9, who: 'nate', text: 'p.leave_it' },
                { at: 4.9, who: 'theo', text: 'p.bad_song' },
                { at: 6.7, who: 'nate', text: 'p.your_tape' },
                { at: 8.6, who: 'theo', text: 'p.yeah' },
              ],
            },
            // Theo looks at the mirror again. His phone lights up; he turns it over.
            {
              seconds: 8, pov: true, cam: { from: { cabin: 'ride', at: 'eye', p: [-0.02, 0, 0.5] }, look: { cabin: 'ride', at: 'pass', p: [0, -0.04, 0] }, fov: 44, near: NEAR },
              do: [{ do: 'actorSet', id: 'theo', look: { yaw: 0.6, pitch: -0.12 } }, { do: 'prop', id: 'phone', kind: 'phone', in: 'ride', at: { cabinAt: 'passSeat', p: [0.0, 0.3, 0.32] }, rot: [0.9, 0, 0] }],
              lines: [
                { at: 1.0, who: 'nate', text: 'p.quiet' },
                { at: 3.3, do: [{ do: 'remove', ids: ['phone'] }, { do: 'actorSet', id: 'theo', look: { yaw: -0.5, pitch: 0.15 } }] },
                { at: 3.9, who: 'theo', text: 'p.tired' },
              ],
            },
            // Dante, the host: he checks his scanner, then waves them on
            {
              seconds: 5.2, cam: { from: { of: 'dante', p: [-1.3, 1.5, 3.5] }, to: { of: 'dante', p: [-1.0, 1.55, 2.7] }, look: { of: 'dante', p: [0, 1.5, 0] }, fov: 36 },
              do: [{ do: 'actorSet', id: 'dante', pose: 'phone', look: null }],
              lines: [{ at: 1.1, do: [{ do: 'actorSet', id: 'dante', pose: 'idle', look: 'player' }] }, { at: 1.4, who: 'dante', text: 'p.dante.grid' }],
            },
          ],
        },
        // ---- play: drive to the second row (steering) ----
        { do: 'driveTo', text: 'p.obj.grid', at: [-478.7, 700.5], radius: 3.4, stop: true, tip: 'p.tip.steer' },
        // Theo reaches over and honks twice. He always does that when they arrive.
        { do: 'sound', name: 'honkTwice' },
        { do: 'lines', lines: [{ wait: 1.0 }, { who: 'nate', text: 'p.every_time' }, { who: 'theo', text: 'p.know_its_us' }] },
      ],
    },

    // =====================================================================
    // 2. IRONHILL NIGHT RUN - the race (steer, nitro, drift) and the last turn
    // =====================================================================
    {
      id: 'p2', title: 'p.m2',
      setup: [
        { do: 'time', hour: 2.6, rain: true, onLoad: true },
        { do: 'world', traffic: 0, people: 0, onLoad: true },
        { ...RIDE([-478.7, 700.5], 180), onLoad: true },
        { ...THEO, onLoad: true }, { ...DECK_PROP, onLoad: true },
        ...GRID.map((s) => ({ ...s, onLoad: true })),
        { do: 'player', inCar: 'ride', onLoad: true },
        { do: 'allow', enter: 'none', onLoad: true },
        { do: 'music', tape: 3, hud: true, onLoad: true },
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            { seconds: 5, cam: { from: [-485.5, DECK + 1.5, 681], to: [-484.6, DECK + 1.5, 683], look: [-478.6, DECK + 0.9, 698], fov: 38 },
              do: [{ do: 'actorSet', id: 'dante', pose: 'flag', look: null }],
              lines: [{ at: 0.4, who: 'dante', text: 'p.dante.rules' }, { at: 2.9, who: 'dante', text: 'p.dante.guard' }] },
            { seconds: 2.4, cam: { from: { of: 'dante', p: [0.4, 1.3, 2.4] }, look: { of: 'dante', p: [0, 1.85, 0] }, fov: 34 },
              lines: [{ at: 1.7, do: [{ do: 'actorSet', id: 'dante', pose: 'idle' }, { do: 'sound', name: 'go' }] }] },
          ],
        },
        // the others drive the racing line; how far ahead they want to be keeps the race close
        { do: 'drive', id: 'r1', mode: 'race', path: 'race', lead: 60, min: 110, max: 205, offset: 4.2 },
        { do: 'drive', id: 'r2', mode: 'race', path: 'race', lead: 32, min: 100, max: 195 },
        { do: 'drive', id: 'r3', mode: 'race', path: 'race', lead: 10, min: 95, max: 188, offset: 4.2 },
        {
          do: 'follow', vehicle: 'r2', text: 'p.obj.pack', tip: 'p.tip.gas', far: 95, farLine: { who: 'theo', text: 'p.falling_back' },
          until: { zone: { z: [-1e9, 380] } },
          on: [
            // two slow trucks in the way: steer around them
            { zone: { z: [-1e9, 610] }, do: [
              { do: 'spawn', id: 't1', kind: 'van', at: [-478.7, 500], face: 180, color: [0.6, 0.61, 0.62], arena: 'highway', simple: true, npc: true },
              { do: 'spawn', id: 't2', kind: 'van', at: [-474.6, 448], face: 180, color: [0.7, 0.66, 0.5], arena: 'highway', simple: true, npc: true },
              { do: 'drive', id: 't1', mode: 'path', path: 'race', speed: 60, end: 'remove' },
              { do: 'drive', id: 't2', mode: 'path', path: 'race', speed: 55, offset: -4.1, end: 'remove' },
              { do: 'tip', text: 'p.tip.traffic', seconds: 5 },
            ] },
            { zone: { z: [-1e9, 480] }, do: [{ do: 'say', who: 'nate', text: 'p.looking' }, { do: 'say', who: 'theo', text: 'p.headlights' }] },
          ],
        },
        // the leader lets himself be caught (he now wants to be a little behind the player)
        { do: 'drive', id: 'r1', mode: 'race', path: 'race', lead: -14, min: 105, max: 215, offset: 4.2 },
        { do: 'chase', vehicle: 'r1', text: 'p.obj.leader', tip: 'p.tip.nitro', catch: 10, until: { zone: { z: [-1e9, -170] } } },
        {
          do: 'driveTo', text: 'p.obj.ramp', at: [-450, -388], radius: 16,
          on: [{ zone: { z: [-1e9, -40] }, do: [{ do: 'say', who: 'theo', text: 'p.late_brakes' }, { do: 'tip', text: 'p.tip.drift', seconds: 8 }] }],
        },
        {
          do: 'driveTo', text: 'p.obj.mile', at: [-72, -388], radius: 18,
          on: [
            { zone: { x: [-350, 1e9] }, do: [{ do: 'tip', text: 'p.tip.nitro', seconds: 4 }] },
            { zone: { x: [-170, 1e9] }, do: [{ do: 'say', who: 'theo', text: 'p.dont_slow', seconds: 3.4 }] },
          ],
        },
        // THE LAST TURN: a black Phantom comes down the street. Whatever the player does, it hits.
        {
          do: 'waitFor', event: 'crash', text: 'p.obj.last', marker: [-9, -366], timeout: 20,
          on: [{ zone: { x: [-27, 1e9] }, do: [PHANTOM([-8.75, -322], 180), { do: 'drive', id: 'phantom', mode: 'ram', speed: 130, event: 'crash' }] }],
          // (the player stopped and never reached the turn: it comes for them anyway)
          onTimeout: [PHANTOM({ of: 'ride', p: [0, 0, 60] }, 90), { do: 'drive', id: 'phantom', mode: 'ram', speed: 130, event: 'crash' }],
        },
        // white. The crash is only heard.
        { do: 'fade', to: 'white', seconds: 0.05 },
        { do: 'sound', name: 'crash', buzz: [120, 40, 200] },
        { do: 'allow', drive: false },
        { do: 'remove', ids: ['phantom', 'r1', 'r2', 'r3', 't1', 't2', 'theo', 'dante'] },
        { do: 'music', tape: 6, fromEnd: 24, then: 7, hud: false },
      ],
    },

    // =====================================================================
    // 3. TRACK 7 - the last picture. QUIET MOMENT. Nothing to do but look.
    // =====================================================================
    {
      id: 'p3', title: 'p.m3',
      setup: [
        { do: 'time', hour: 2.6, rain: true, onLoad: true },
        { do: 'world', traffic: 0, people: 0, onLoad: true },
        { do: 'spawn', id: 'ride', kind: 'chrome_supercar', or: 'coupe', color: [0.6, 0.62, 0.66], at: [-10, -372], face: 20, lockExit: true, onLoad: true },
        { do: 'player', inCar: 'ride', onLoad: true },
        { do: 'allow', enter: 'none', drive: false },
        { do: 'fade', to: 'white', seconds: 0, onLoad: true },
        { do: 'music', tape: 6, fromEnd: 24, then: 7, hud: false, onLoad: true },
        { do: 'world', indoors: true },                     // rain on the roof
        // the wreck: dark, silent, the glass cracked
        { do: 'vehicleSet', id: 'ride', damage: 0.95, stop: true, lights: 'off', dead: true },
        DECK_PROP,
        { do: 'prop', id: 'phone', kind: 'phone', in: 'ride', at: { cabinAt: 'passSeat', p: [0.02, 0.125, 0.08] }, rot: [0, 0.5, 0] },
      ],
      steps: [
        { do: 'wait', seconds: 3.6 },                       // white, and the tape still playing
        {
          do: 'cutscene', skippable: false,
          shots: [
            // the broken dashboard
            { seconds: 8, pov: true, fade: 'fromWhite', fadeSeconds: 3.5, cam: { from: { cabin: 'ride', at: 'eye', p: [0.04, 0.02, -0.1] }, to: { cabin: 'ride', at: 'eye', p: [-0.08, 0, -0.04] }, look: { cabin: 'ride', at: 'dash', p: [0.25, 0.1, 0.3] }, lookTo: { cabin: 'ride', at: 'dash', p: [-0.2, 0.05, 0.3] }, fov: 50, roll: 0.07, near: NEAR } },
            // the empty seat. Theo's phone is still lit. The player MAY read it (it is never asked for).
            {
              seconds: 9, pov: true, cam: { from: { cabin: 'ride', at: 'eye', p: [-0.04, 0.05, 0] }, to: { cabin: 'ride', at: 'eye', p: [-0.1, 0.04, 0.03] }, look: { cabin: 'ride', at: 'passSeat', p: [0.02, 0.16, 0.1] }, fov: 46, roll: 0.07, near: NEAR },
              act: { label: 'ui.read', do: [{ do: 'read', kind: 'phone', from: 'p.phone.from', text: 'p.phone.text', when: 'p.phone.when' }, { do: 'flag', set: { phone_read: true } }] },
            },
            // back to the tape. Track 6 runs out. Track 7 is silence: the shot stays ten seconds after it starts.
            { seconds: 6, pov: true, hold: { event: 'tape:7', seconds: 10, max: 22 }, cam: { from: { cabin: 'ride', at: 'eye', p: [-0.08, 0, -0.04] }, to: { cabin: 'ride', at: 'eye', p: [-0.04, 0, 0.06] }, look: { cabin: 'ride', at: 'dash', p: [-0.03, 0.03, -0.06] }, fov: 26, fovTo: 15, roll: 0.07, near: NEAR } },
          ],
        },
        { do: 'fade', to: 'black', seconds: 2.6, wait: true },
        { do: 'music', stop: true },
        { do: 'card', title: 'p.card2.title', seconds: 4.2 },
        { do: 'chapter' },
      ],
    },
  ],
};
