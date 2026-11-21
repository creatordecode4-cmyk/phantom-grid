// ---------------------------------------------------------------------------
// CHAPTER 1 - "RAIN DELIVERY" (four years later)
//
// This file is ONLY DATA. The story engine (src/story/engine.js) reads it and
// explains every word used here at its top. All texts are keys of
// src/story/strings.js.
//
// The night in one line: three slow deliveries, a job with Nate's name on it,
// a woman who knew his face, and a black car that honks twice.
//
// Places: [x, z] on the ground, [x, y, z], { garage: [right, up, toward the street] },
// { flat: [right, up, toward the street] } (Nate's room), { of: 'car or person',
// p: [left, up, forward] }, { cabin: 'car', at, p }, { roof: [x, z] }.
// Directions are compass degrees (0 north, 90 east, 180 south, 270 west). Speeds are km/h.
// Map: +z is north, -z south (the ocean), -x east, +x west.
// ---------------------------------------------------------------------------

const DARK = [0.07, 0.075, 0.085];       // the paint of the black Phantom ("Zero")
const NEAR = 0.05;                       // a lens that can sit inside a car or a small room
const NIGHT = { do: 'time', hour: 21.67, rain: true };

// ---- where things are ----
const VAN_HOME = { garage: [-4.5, 0, 11.3] };            // at the curb in front of the garage door
const D1 = { stop: [-245, 140.5], door: [-245, 135.3] };  // Halden Row
const D2 = { stop: [-292.5, 290], door: [-297.4, 291.4] }; // Vance Street
const DEPOT = { stop: [-262, -382.5], door: [-262, -376.3] };
const D3 = { stop: [150, -382.5], door: [150, -376.3] };
const ALLEY = { mouth: [178, -255], park: [146, -255], exit: [89, -255] };   // the backstreet behind Neon Mile
const HIDE = [-50, 315];                                   // the alley where the night ends

// ---- things used by several missions ----
// NATE'S VAN: a tired courier van. The company fitted a limiter: it will not go faster than 80.
const VAN = (at, face, more = {}) => ({
  do: 'spawn', id: 'van', kind: 'van', at, face, color: [0.74, 0.72, 0.66], enter: true, limit: 80, curbSide: true,
  type: { label: 'COURIER VAN', topSpeed: 152, accel: 6.4 }, ...more,
});
// in the van: the sticker that says 80, and the tape deck with Theo's mixtape in it
const VAN_THINGS = [
  // (both sit on the face of the dashboard that looks at the driver: the sticker beside the screen, the deck under it)
  { do: 'prop', id: 'sticker', kind: 'sticker80', in: 'van', at: { cabinAt: 'dash', p: [-0.27, -0.1, -0.125] }, rot: [1.15, Math.PI, 0] },
  { do: 'prop', id: 'deck', kind: 'deck', in: 'van', at: { cabinAt: 'dash', p: [0, -0.238, -0.137] } },
];
// MACE (Marcus Doyle, 54). What he wants: that Nate eats, sleeps, stops punishing himself. What he fears: the car
// under the tarp. His object: a sandwich in paper that he pretends is nothing.
const MACE = { do: 'actor', id: 'mace', model: 'Mace_Doyle', name: 'name.mace', at: { garage: [-2.5, 0, 5.6] }, face: 290, pose: 'crossed', fixed: true };
// ZERO: the black Phantom. No name tag, no siren. A thin bar of cold light.
const ZERO = (at, face) => ({ do: 'spawn', id: 'zero', kind: 'tech_patrol_car', or: 'sedan', color: [0.02, 0.02, 0.025], at, face, tint: DARK, lights: 'bar', npc: true, noDetail: true, mirror: 'zero' });
const GUARD = (id, at, face) => ({ do: 'spawn', id, kind: 'police_coupe', or: 'sedan', color: [0.85, 0.86, 0.9], at, face, npc: true, noDetail: true, flash: true, mirror: 'guard' });
// DR. INGRID SOLBERG. What she wants: to put something right. What she fears: the roofs. Her object: a race ticket
// she has kept for four years.
const SOLBERG = { do: 'actor', id: 'solberg', model: 'Ingrid_Solberg', name: 'name.solberg', at: [132, -253.4], face: 270, fixed: true, look: 'player' };
const CASE = { do: 'prop', id: 'case', kind: 'case', on: 'solberg', bone: 'hand_R', p: [0, 0.24, 0.02], rot: [0, Math.PI / 2, Math.PI] };
// JUNO KADE: only ever a shape on a roof.
const JUNO = { do: 'actor', id: 'juno', model: 'Juno_Kade', at: { roof: [73.4, -257.4] }, face: 270, pose: 'aim', hidden: true, ghost: true, fixed: true, look: null };
const RIFLE = { do: 'prop', id: 'rifle', kind: 'rifle', on: 'juno', bone: 'hand_R', p: [0.02, 0.1, 0.1], rot: [0, 0, 0] };

// an impatient car that comes up behind the van on Neon Mile, passes it and is gone
const OVERTAKER = (id, kind, color, speed) => [
  { do: 'spawn', id, kind, color, at: { of: 'van', p: [0.4, 0, -46] }, face: 270, speed: 95, simple: true, npc: true },
  { do: 'drive', id, mode: 'overtake', dir: [1, 0], axis: 'x', lanes: [-388.1, -384.6], speed },
];

// one delivery on foot: get out, carry the parcel to the door, come back
const HAND_OVER = (door, more = []) => [
  { do: 'waitFor', until: { inCar: false }, text: 'c1.obj.door', marker: door, tip: 'ui.exit_tip', tipSeconds: 5 },
  { do: 'player', carry: { kind: 'parcel' } },
  ...more,
];

export default {
  id: 'chapter01',
  number: 1,
  title: 'c1.title',
  vehicle: 'van',
  preload: { actors: ['Mace_Doyle', 'Ingrid_Solberg', 'Juno_Kade'] },
  paths: {
    // Zero turns into the backstreet behind the van, without a sound
    zeroIn: [[182.75, -224], [182.75, -246], [179, -253.5], [172, -255], [167, -255]],
  },

  missions: [
    // =====================================================================
    // 0. HOME - the flat above the garage, Mace, the van          (quiet, about 2 minutes)
    // =====================================================================
    {
      id: 'c1m0', title: 'c1.m0',
      setup: [
        NIGHT,
        { do: 'world', traffic: null, people: null, indoors: true },
        VAN(VAN_HOME, 0), ...VAN_THINGS,
        MACE,
        // the things in Nate's room: the tape he does not play, the photo he does not look at, his jacket
        { do: 'prop', id: 'tape', kind: 'tape', at: { flat: [8.33, 1.3, 3.28] }, face: 8 },
        { do: 'prop', id: 'photo', kind: 'photo', at: { flat: [8.33, 1.3, 3.72] }, face: 340 },
        { do: 'prop', id: 'jacket', kind: 'jacket', at: { flat: [2.12, 1.58, 2.82] }, face: 270 },
        // (asleep on his side on top of the blanket, the head on the pillow, the face to the room)
        { do: 'player', stage: { at: { flat: [8.05, 0.555, 1.75] }, face: 270, pose: 'lie' } },
        { do: 'light', at: { flat: [3.4, 1.7, 4.9] }, color: 0xffb070, power: 26, range: 11 },
        { do: 'allow', enter: ['van'] },
      ],
      steps: [
        { do: 'card', over: 'c1.card.over', title: 'c1.title', sub: 'c1.card.sub', seconds: 4.5 },
        {
          do: 'cutscene', keep: true,
          shots: [
            // rain on the window
            { seconds: 6, fade: 'in', fadeSeconds: 2.6, cam: { from: { flat: [4.3, 1.5, 2.5] }, to: { flat: [4.7, 1.5, 3.0] }, look: { flat: [5.2, 1.5, 6.6] }, fov: 42, near: NEAR } },
            // QUIET MOMENT (an object): the mixtape, and a photo that lies face down. No words.
            { seconds: 6.5, cam: { from: { flat: [7.32, 1.74, 3.18] }, to: { flat: [7.46, 1.68, 3.42] }, look: { flat: [8.33, 1.3, 3.5] }, fov: 28, near: NEAR } },
            // Nate, asleep in his clothes
            { seconds: 6.5, cam: { from: { flat: [5.5, 1.55, 3.6] }, to: { flat: [5.8, 1.45, 3.4] }, look: { flat: [7.85, 0.8, 1.55] }, fov: 34, near: NEAR },
              lines: [{ at: 1.2, who: 'wren', text: 'c1.wren.wake' }] },
            // sitting on the edge of the bed, head down
            { seconds: 8, cam: { from: { flat: [4.3, 1.15, 3.7] }, to: { flat: [4.5, 1.15, 3.5] }, look: { flat: [6.5, 1.05, 2.0] }, fov: 34, near: NEAR },
              do: [{ do: 'player', stage: { at: { flat: [6.62, 0.555, 2.0] }, face: 0, pose: 'sitEdge', floorBelow: 0.555 } }],
              lines: [{ at: 0.9, who: 'wren', text: 'c1.wren.jobs' }, { at: 4.4, who: 'nate', text: 'c1.always_rain' }] },
            { seconds: 5, cam: { from: { flat: [4.9, 1.28, 2.95] }, look: { flat: [6.55, 1.18, 2.0] }, fov: 30, near: NEAR },
              lines: [{ at: 0.6, who: 'wren', text: 'c1.wren.message', seconds: 4.2 }] },
          ],
        },
        // CHOICE (it is remembered): listen to the start of Theo's last message, or not today
        { do: 'choice', options: [{ text: 'c1.ch.play', set: { voicemail_played: true } }, { text: 'c1.ch.not_today', set: { voicemail_played: false } }] },
        {
          do: 'cutscene', keep: true,
          shots: [
            // QUIET MOMENT (the unfinished voicemail): four seconds, then he stops it. He always stops it.
            { if: { flag: 'voicemail_played' }, seconds: 11, cam: { from: { flat: [4.7, 0.7, 2.85] }, to: { flat: [4.95, 0.72, 2.7] }, look: { flat: [6.5, 1.12, 2.0] }, fov: 30, near: NEAR },
              lines: [
                { at: 0.4, do: [{ do: 'sound', name: 'beep' }] },
                { at: 1.0, who: 'voicemail', kind: 'thought', text: 'c1.voicemail', seconds: 4.3 },
                { at: 5.3, who: 'nate', text: 'c1.stop', seconds: 1.5 },
                { at: 5.4, do: [{ do: 'sound', name: 'tick' }] },
                { at: 7.6, who: 'wren', text: 'c1.wren.stopped' },
              ] },
            { if: { flag: 'voicemail_played', is: false }, seconds: 4.2, cam: { from: { flat: [4.7, 0.7, 2.85] }, look: { flat: [6.5, 1.06, 2.0] }, fov: 30, near: NEAR },
              lines: [{ at: 0.7, who: 'wren', text: 'c1.wren.saved' }] },
          ],
        },
        {
          do: 'cutscene',
          shots: [
            // the courier jacket on its hook. He takes it, and the night starts.
            { seconds: 4.6, fade: 'out', fadeSeconds: 1.4, cam: { from: { flat: [4.4, 1.5, 4.2] }, to: { flat: [4.1, 1.5, 3.9] }, look: { flat: [2.1, 1.25, 2.82] }, fov: 32, near: NEAR },
              do: [{ do: 'player', stage: { at: { flat: [2.95, 0, 2.86] }, face: 0, pose: 'idle' } }],
              end: [{ do: 'remove', ids: ['jacket'] }, { do: 'sound', name: 'cloth' }] },
          ],
        },
        // ---- downstairs: the repair bay. Theo's car is still under its tarp. ----
        // (a work lamp in the bay, so the two faces can be read in the doorway)
        { do: 'light', at: { garage: [-3.3, 2.7, 3.7] }, color: 0xffdcaa, power: 34, range: 10 },
        { do: 'player', stage: null, at: { garage: [-0.5, 0, -5.3] }, face: 285 },
        { do: 'sound', name: 'door' },
        { do: 'fade', to: 'clear', seconds: 1.6 },
        { do: 'talk', actor: 'mace', text: 'c1.obj.mace', radius: 3 },
        {
          do: 'cutscene', keep: true,
          shots: [
            // the two of them in the open door, the rain and the van behind
            { seconds: 9.4, cam: { from: { garage: [-3.2, 1.55, 1.9] }, to: { garage: [-3.2, 1.5, 2.5] }, look: { garage: [-3.2, 1.3, 5.6] }, fov: 44 },
              do: [
                { do: 'player', stage: { at: { garage: [-3.95, 0, 5.5] }, face: 180, pose: 'idle' } },
                { do: 'actorSet', id: 'mace', at: { garage: [-2.5, 0, 5.6] }, face: 0, look: 'player' },
              ],
              lines: [{ at: 0.7, who: 'mace', text: 'c1.mace.van' }, { at: 4.4, who: 'nate', text: 'c1.thanks', seconds: 1.4 }, { at: 6.0, who: 'mace', text: 'c1.mace.eat', seconds: 1.5 }, { at: 7.7, who: 'nate', text: 'c1.later', seconds: 1.5 }] },
            // Mace holds out a sandwich wrapped in paper
            { seconds: 3.6, cam: { from: { garage: [-4.5, 1.62, 4.9] }, look: { garage: [-2.5, 1.42, 5.6] }, fov: 32 },
              do: [{ do: 'actorSet', id: 'mace', pose: 'hold' }, { do: 'prop', id: 'sandwich', kind: 'sandwich', on: 'mace', bone: 'hand_R', p: [0, 0.11, 0.05] }],
              lines: [{ at: 0.6, who: 'mace', text: 'c1.mace.eat2', seconds: 2.4 }] },
          ],
        },
        // CHOICE (it is remembered): be kind to Mace, or say nothing
        { do: 'choice', options: [{ text: 'c1.ch.kind', set: { mace_kind: true } }, { text: 'c1.ch.ignore', set: { mace_kind: false } }] },
        {
          do: 'cutscene',
          shots: [
            { seconds: 3.6, cam: { from: { garage: [-4.5, 1.62, 4.9] }, look: { garage: [-2.5, 1.42, 5.6] }, fov: 32 },
              lines: [
                { at: 0.4, if: { flag: 'mace_kind' }, who: 'mace', text: 'c1.mace.kind' },
                { at: 0.4, if: { flag: 'mace_kind', is: false }, who: 'mace', text: 'c1.mace.ignored', seconds: 1.6 },
              ],
              // (kind: Nate takes it. Not kind: Mace keeps holding it, then puts his arms down.)
              end: [{ do: 'remove', ids: ['sandwich'] }, { do: 'actorSet', id: 'mace', pose: 'crossed' }] },
            // QUIET MOMENT (an object): Theo's car under the tarp
            { seconds: 8.2, cam: { from: { garage: [-3.2, 1.35, 0.9] }, to: { garage: [-3.7, 1.3, 0.2] }, look: { garage: [-6.9, 0.75, -3.9] }, fov: 40 },
              lines: [{ at: 1.3, who: 'mace', text: 'c1.mace.tarp' }, { at: 5.2, who: 'nate', text: 'c1.leave_it', seconds: 2 }] },
            // from the sidewalk, in the rain: two men in a lit doorway
            { seconds: 8.2, cam: { from: { garage: [-3.2, 1.5, 9.2] }, to: { garage: [-3.2, 1.5, 8.7] }, look: { garage: [-3.2, 1.35, 5.5] }, fov: 38 },
              lines: [{ at: 0.6, who: 'mace', text: 'c1.mace.careful', seconds: 1.8 }, { at: 2.8, who: 'nate', text: 'c1.only_eighty', seconds: 2 }, { at: 5.3, who: 'mace', text: 'c1.mace.not_said' }],
              end: [{ do: 'player', stage: null, at: { garage: [-3.95, 0, 5.5] }, face: 270 }, { do: 'actorSet', id: 'mace', look: 'auto' }] },
          ],
        },
        { do: 'enter', vehicle: 'van', text: 'c1.obj.van' },
        { do: 'world', indoors: false }, { do: 'light', at: null },
        {
          do: 'cutscene',
          shots: [
            // the sticker on the dashboard: 80. And the tape deck. He pushes the tape in.
            { seconds: 7.5, pov: true, cam: { from: { cabin: 'van', at: 'eye', p: [0, 0.02, 0.02] }, look: { cabin: 'van', at: 'dash', p: [-0.27, -0.1, -0.125] }, lookTo: { cabin: 'van', at: 'dash', p: [0, -0.238, -0.137] }, fov: 30, near: NEAR },
              lines: [{ at: 0.8, who: 'wren', text: 'c1.wren.limiter' }, { at: 4.4, do: [{ do: 'sound', name: 'clunk' }, { do: 'music', tape: 1, hud: true }] }] },
          ],
        },
      ],
    },

    // =====================================================================
    // 1. THREE DELIVERIES - driving, the map, traffic, people. And the limiter.   (about 5 minutes)
    // =====================================================================
    {
      id: 'c1m1', title: 'c1.m1',
      flags: { mace_kind: true },
      setup: [
        { ...NIGHT, onLoad: true },
        { do: 'world', traffic: null, people: null, indoors: false },
        { ...VAN(VAN_HOME, 0), onLoad: true }, ...VAN_THINGS.map((s) => ({ ...s, onLoad: true })),
        { ...MACE, onLoad: true },
        { do: 'player', inCar: 'van', onLoad: true },
        { do: 'allow', enter: ['van'], onLoad: true },
        { do: 'music', tape: 1, hud: true, onLoad: true },
        // the curb is kept free where the van has to stop
        { do: 'clear', at: D1.stop, radius: 10 }, { do: 'clear', at: D2.stop, radius: 10 }, { do: 'clear', at: DEPOT.stop, radius: 11 }, { do: 'clear', at: D3.stop, radius: 11 },
        // ---- THE CITY LIVES (three small things that have nothing to do with Nate) ----
        // 1. two people arguing under an awning, next to the first door
        { do: 'prop', id: 'awning', kind: 'awning', at: [-238, 134.1], face: 0 },
        { do: 'actor', id: 'argA', extra: [0.1, 0.11, 0.14], name: 'name.stranger1', at: [-238.75, 135.25], face: 270, pose: 'hips', scale: 1.02 },
        { do: 'actor', id: 'argB', extra: [0.16, 0.1, 0.1], name: 'name.stranger2', at: [-237.35, 135.45], face: 90, pose: 'crossed', scale: 0.93 },
        // 2. a Meridian Guard car that has stopped somebody. Its lights turn in the rain. Nobody looks.
        { do: 'clear', at: [-294.3, 204], radius: 13 },
        { do: 'spawn', id: 'stopG', kind: 'police_coupe', or: 'sedan', color: [0.85, 0.86, 0.9], at: [-294.3, 199.5], face: 0, npc: true, noDetail: true, flash: true },
        { do: 'spawn', id: 'stopC', kind: 'sedan', color: [0.25, 0.12, 0.1], at: [-294.3, 207.6], face: 0, npc: true, simple: true, lights: 'off' },
        { do: 'actor', id: 'officer', extra: [0.05, 0.06, 0.09], name: 'name.guard', at: [-292.75, 206.9], face: 90, pose: 'hips', scale: 1.04 },
        // 3. a delivery drone. It is faster than Nate, and it never gets wet.
        { do: 'prop', id: 'drone', kind: 'cargoDrone', at: [-289, 9, 160], fly: { path: [[-287.5, 150], [-287.5, 345]], y: 9.5, speed: 9 } },
        // the customer of the second delivery, waiting in a doorway
        { do: 'actor', id: 'customer', extra: [0.2, 0.17, 0.12], name: 'name.customer', at: [-297.7, 292.4], face: 270, pose: 'crossed', scale: 0.97, look: 'player' },
      ],
      // the limiter has been holding the van back for a while: WREN says the thing that Nate will not do
      on: [{ limited: 10, do: [{ do: 'say', who: 'wren', text: 'c1.wren.turn_off' }, { do: 'say', who: 'nate', text: 'c1.i_could' }] }],
      steps: [
        { do: 'say', who: 'wren', text: 'c1.wren.route' },
        // ---- 1 of 3 ----
        { do: 'driveTo', text: 'c1.obj.d1', at: D1.stop, radius: 7, stop: true, tip: 'c1.tip.gps', tipSeconds: 8 },
        ...HAND_OVER(D1.door),
        {
          do: 'goto', text: 'c1.obj.door', at: D1.door, radius: 1.5,
          // the two under the awning: everyone in this city is lying to somebody
          on: [{ near: [-238, 135.4], radius: 9, do: [
            { do: 'say', who: 'stranger1', actor: 'argA', text: 'c1.argue.1' }, { do: 'say', who: 'stranger2', actor: 'argB', text: 'c1.argue.2' }, { do: 'say', who: 'stranger1', actor: 'argA', text: 'c1.argue.3' },
          ] }],
        },
        { do: 'player', carry: null }, { do: 'sound', name: 'chime' },
        { do: 'say', who: 'wren', text: 'c1.wren.one' },
        { do: 'enter', vehicle: 'van', text: 'c1.obj.back' },
        // ---- 2 of 3 ----
        { do: 'driveTo', text: 'c1.obj.d2', at: D2.stop, radius: 7, stop: true },
        ...HAND_OVER({ actor: 'customer' }),
        { do: 'talk', actor: 'customer', text: 'c1.obj.door', label: 'ui.drop', radius: 2.6 },
        { do: 'player', carry: null }, { do: 'sound', name: 'chime' },
        { do: 'lines', lines: [{ who: 'customer', text: 'c1.cust.late' }, { who: 'nate', text: 'c1.on_time', seconds: 1.8 }, { who: 'customer', text: 'c1.cust.other' }] },
        { do: 'say', who: 'wren', text: 'c1.wren.two' },
        { do: 'enter', vehicle: 'van', text: 'c1.obj.back' },
        // ---- 3 of 3: a late pick-up, then a straight run down the Mile against the clock ----
        { do: 'driveTo', text: 'c1.obj.depot', at: DEPOT.stop, radius: 8, stop: true },
        { do: 'waitFor', until: { inCar: false }, text: 'c1.obj.take', marker: DEPOT.door },
        { do: 'collect', text: 'c1.obj.take', at: DEPOT.door, label: 'ui.take', radius: 1.9 },
        { do: 'player', carry: { kind: 'parcel', size: 0.8 } }, { do: 'sound', name: 'door', kind: 'open' },
        { do: 'say', who: 'wren', text: 'c1.wren.closing' },
        { do: 'enter', vehicle: 'van', text: 'c1.obj.back' },
        { do: 'player', carry: null },
        // (the game saves here: if the shop closes, the player starts again at the depot)
        { do: 'checkpoint', id: 1, setup: [{ do: 'vehicleSet', id: 'van', place: DEPOT.stop, face: 270 }] },
        {
          do: 'timer', seconds: 44, failText: 'c1.fail.late', text: 'c1.obj.d3', at: D3.stop, radius: 8, stop: true,
          // eighty. Everybody else is in a hurry and nobody is held back.
          on: [
            { zone: { x: [-225, 1e9] }, do: OVERTAKER('o1', 'coupe', [0.45, 0.05, 0.05], 132) },
            { zone: { x: [-120, 1e9] }, do: OVERTAKER('o2', 'sedan', [0.12, 0.14, 0.2], 118) },
            { zone: { x: [-10, 1e9] }, do: OVERTAKER('o3', 'suv', [0.5, 0.5, 0.48], 124) },
          ],
        },
        ...HAND_OVER(D3.door),
        { do: 'goto', text: 'c1.obj.door', at: D3.door, radius: 1.5 },
        { do: 'player', carry: null }, { do: 'sound', name: 'chime' },
        { do: 'lines', lines: [{ who: 'wren', text: 'c1.wren.done' }, { wait: 0.6 }] },
      ],
    },

    // =====================================================================
    // 2. N. CALLOWAY - a job with his name on it. QUIET MOMENT: the silent drive.
    // =====================================================================
    {
      id: 'c1m2', title: 'c1.m2',
      setup: [
        { ...NIGHT, onLoad: true },
        { ...VAN(D3.stop, 270), onLoad: true }, ...VAN_THINGS.map((s) => ({ ...s, onLoad: true })),
        { do: 'player', at: [150, -377.2], face: 180, onLoad: true },
        { do: 'allow', enter: ['van'], onLoad: true },
        { do: 'remove', ids: ['awning', 'argA', 'argB', 'stopG', 'stopC', 'officer', 'customer', 'drone', 'o1', 'o2', 'o3', 'mace'] },
        { do: 'clear', at: ALLEY.park, radius: 16 },
        // she is already waiting. (She does not look at the roofs. She should.)
        SOLBERG, CASE, JUNO, RIFLE,
      ],
      steps: [
        { do: 'lines', lines: [
          { who: 'wren', text: 'c1.wren.priority' }, { who: 'wren', text: 'c1.wren.name' },
          { who: 'nate', text: 'c1.nobody', seconds: 2.2 }, { who: 'wren', text: 'c1.wren.somebody', seconds: 1.8 }, { who: 'wren', text: 'c1.wren.where' },
        ] },
        { do: 'flag', set: { nate_name_known: true } },
        { do: 'enter', vehicle: 'van', text: 'c1.obj.back' },
        // he switches the tape off. Only the rain, the wipers and the engine. No objective on the screen: just the map.
        { do: 'sound', name: 'clunk' }, { do: 'music', stop: true },
        // (the streets empty out behind him: nobody is in the backstreet when he gets there)
        { do: 'world', people: 0 },
        { do: 'driveTo', text: 'c1.obj.pickup', quiet: true, at: ALLEY.mouth, radius: 11 },
        { do: 'driveTo', text: 'c1.obj.alley', at: ALLEY.park, radius: 5.5, stop: true },
      ],
    },

    // =====================================================================
    // 3. THE PICK-UP - Dr. Solberg, one shot, a race ticket
    // =====================================================================
    {
      id: 'c1m3', title: 'c1.m3',
      flags: { nate_name_known: true },
      setup: [
        { ...NIGHT, onLoad: true },
        { ...VAN(ALLEY.park, 90), onLoad: true }, ...VAN_THINGS.map((s) => ({ ...s, onLoad: true })),
        { do: 'player', inCar: 'van', onLoad: true },
        { do: 'allow', enter: ['van'], onLoad: true },
        { do: 'clear', at: ALLEY.park, radius: 16, onLoad: true },
        { do: 'world', people: 0, now: true, onLoad: true },
        { ...SOLBERG, onLoad: true }, { ...CASE, onLoad: true }, { ...JUNO, onLoad: true }, { ...RIFLE, onLoad: true },
      ],
      steps: [
        { do: 'waitFor', until: { inCar: false }, text: 'c1.obj.client', marker: { actor: 'solberg' }, tip: 'ui.exit_tip', tipSeconds: 5 },
        { do: 'talk', actor: 'solberg', text: 'c1.obj.client', radius: 3.4 },
        {
          do: 'cutscene', keep: true,
          shots: [
            // she looks at him for a long moment before she says it
            { seconds: 7, cam: { from: { of: 'solberg', p: [-0.6, 1.62, 2.5] }, to: { of: 'solberg', p: [-0.5, 1.62, 2.2] }, look: { of: 'solberg', p: [0, 1.56, 0] }, fov: 30 },
              do: [{ do: 'player', stage: { at: [134.7, -254.0], face: 90, pose: 'idle' } }, { do: 'music', silence: 0.4 }],
              lines: [{ at: 2.2, who: 'solberg', text: 'c1.solberg.look', seconds: 2.6 }, { at: 5.2, who: 'nate', text: 'c1.like_who', seconds: 1.7 }] },
            // Nate. He does not get his answer.
            { seconds: 2.4, cam: { from: { of: 'solberg', p: [0.55, 1.6, 0.5] }, look: [134.7, 1.62, -254.0], fov: 28 },
              end: [{ do: 'sound', name: 'shot', buzz: [200] }] },
            // the roof at the end of the street: a flash, and for a second somebody is there
            { seconds: 2.3, cam: { from: [135.5, 1.75, -254.4], look: { of: 'juno', p: [0, 1.25, 0.2] }, fov: 8.5 },
              do: [
                { do: 'actorSet', id: 'juno', hidden: false },
                { do: 'prop', id: 'flash', kind: 'flash', at: { of: 'juno', p: [0, 1.42, 1.25] } },
                { do: 'light', at: { of: 'juno', p: [0.9, 2.4, 1.6] }, color: 0xbfd8ff, power: 55, range: 9 },
              ],
              lines: [{ at: 0.14, do: [{ do: 'remove', ids: ['flash'] }] }] },
            // she is on the ground. The rain does not stop. In her open hand: a small worn card.
            { seconds: 5.5, cam: { from: [134.3, 0.55, -255.6], to: [134.0, 0.6, -255.4], look: { of: 'solberg', p: [0.2, 0.25, 0] }, fov: 40 },
              do: [
                { do: 'actorSet', id: 'solberg', pose: 'fallen', seconds: 0.3, look: null },
                { do: 'actorSet', id: 'juno', hidden: true }, { do: 'light', at: null },
                { do: 'remove', ids: ['case'] },
                { do: 'prop', id: 'case2', kind: 'case', at: { of: 'solberg', p: [-0.75, 0.06, 0.55] }, rot: [0.6, 1.57, 0] },
                { do: 'prop', id: 'ticket', kind: 'ticket', at: { of: 'solberg', p: [0.74, 0.03, -0.5] }, face: 200 },
                { do: 'music', silence: 3 },
              ] },
            { seconds: 4.5, cam: { from: { of: 'solberg', p: [1.5, 0.55, 0.35] }, to: { of: 'solberg', p: [1.35, 0.45, 0.2] }, look: { of: 'solberg', p: [0.72, 0.03, -0.44] }, fov: 26 } },
          ],
        },
        // CHOICE (it is remembered): take the ticket, or leave it for the people who will find her
        {
          do: 'read', kind: 'ticket', t1: 'c1.ticket.t1', t2: 'c1.ticket.t2', t3: 'c1.ticket.t3',
          buttons: [
            { text: 'c1.ch.take', set: { ticket_found: true, ticket_taken: true }, do: [{ do: 'remove', ids: ['ticket'] }] },
            { text: 'c1.ch.leave', set: { ticket_found: true, ticket_taken: false } },
          ],
        },
        { do: 'cine', on: false },
        { do: 'player', stage: null, at: [134.7, -254.0], face: 270 },
        { do: 'say', who: 'wren', text: 'c1.wren.leave_now' },
        { do: 'enter', vehicle: 'van', text: 'c1.obj.backvan' },
      ],
    },

    // =====================================================================
    // 4. TWO HONKS - something black, the limiter, the button
    // =====================================================================
    {
      id: 'c1m4', title: 'c1.m4',
      flags: { ticket_found: true, ticket_taken: true },
      setup: [
        { ...NIGHT, onLoad: true },
        { ...VAN(ALLEY.park, 90), onLoad: true }, ...VAN_THINGS.map((s) => ({ ...s, onLoad: true })),
        { do: 'player', inCar: 'van', onLoad: true },
        { do: 'clear', at: ALLEY.park, radius: 16, onLoad: true },
        { ...SOLBERG, pose: 'fallen', look: null, onLoad: true },
        { do: 'world', people: 0, now: true, onLoad: true },
        { do: 'allow', enter: 'none' },
        { do: 'vehicleSet', id: 'van', lockExit: true },
        { do: 'remove', ids: ['juno', 'rifle'] },
        ZERO([182.75, -224], 180),
      ],
      steps: [
        {
          do: 'cutscene',
          shots: [
            // behind the van, looking back at the mouth of the backstreet. It turns in without a sound.
            { seconds: 8.6, cam: { from: [151, 1.15, -253.5], to: [151.6, 1.1, -253.6], look: [178, 0.85, -255], fov: 30 },
              do: [{ do: 'music', silence: 2 }, { do: 'drive', id: 'zero', mode: 'path', path: 'zeroIn', kin: true, speed: 23 }] },
            // it stops. And then it does the one thing only one person ever did.
            { seconds: 4.4, cam: { from: { of: 'zero', p: [1.0, 0.75, 5.6] }, to: { of: 'zero', p: [0.8, 0.72, 5.0] }, look: { of: 'zero', p: [0, 0.62, 2.2] }, fov: 28 },
              lines: [{ at: 1.5, do: [{ do: 'sound', name: 'honkTwice', volume: 1, buzz: [90, 210, 90] }] }] },
            // Nate does not move
            { seconds: 4.6, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.3] }, look: { cabin: 'van', at: 'eye', p: [0, -0.04, 0] }, fov: 42, near: NEAR },
              do: [{ do: 'music', heart: 96 }],
              lines: [{ at: 2.2, who: 'wren', text: 'c1.wren.go', seconds: 2 }] },
          ],
        },
        { do: 'mirror', on: true },
        // THE LIMITER MOMENT: a heartbeat and one big button. Then a second of nothing. Then the engine is free.
        { do: 'limiter', vehicle: 'van', text: 'c1.obj.limiter', heart: 108, nag: { who: 'wren', text: 'c1.wren.go' }, nagEvery: 6 },
        { do: 'music', tension: 0.8 },
        { do: 'drive', id: 'zero', mode: 'shadow', gap: 15 },
        { do: 'driveTo', text: 'c1.obj.go', at: ALLEY.exit, radius: 8 },
      ],
    },

    // =====================================================================
    // 5. THE CHASE - Zero in the mirror, two Guard cars, the beach road, the rail line
    // =====================================================================
    {
      id: 'c1m5', title: 'c1.m5',
      flags: { limiter_off: true },
      setup: [
        { ...NIGHT, onLoad: true },
        // (starting here: the van is already out of the backstreet and heading south, Zero is coming out behind it)
        { ...VAN([88.75, -266], 180, { speed: 30 }), onLoad: true }, ...VAN_THINGS.map((s) => ({ ...s, onLoad: true })),
        { do: 'player', inCar: 'van', onLoad: true },
        { ...ZERO([103, -255], 90), onLoad: true },
        { do: 'drive', id: 'zero', mode: 'shadow', gap: 15, onLoad: true },
        { do: 'vehicleSet', id: 'van', limit: 0, lockExit: true },
        { do: 'allow', enter: 'none' },
        { do: 'world', traffic: 15, people: 16 },          // (the chase stays light for the phone)
        { do: 'mirror', on: true }, { do: 'cam', widen: 1 }, { do: 'music', tension: 0.8 },
        { do: 'remove', ids: ['solberg', 'case2', 'ticket'] },
      ],
      // how the chase is lost
      on: [
        { damageOver: 0.97, fail: 'c1.fail.wrecked' },
        { any: [{ carNear: 'g1', radius: 8 }, { carNear: 'g2', radius: 8 }], speedUnder: 7, hold: 3.5, fail: 'c1.fail.busted' },
      ],
      steps: [
        {
          do: 'driveTo', text: 'c1.obj.coast', at: [88.75, -366], radius: 13,
          on: [{ zone: { z: [-1e9, -292] }, do: [
            GUARD('g1', [215, -395.9], 90), { do: 'drive', id: 'g1', mode: 'pursue', pace: 0.74, hold: 5 },
            { do: 'wanted', stars: 1 }, { do: 'say', who: 'wren', text: 'c1.wren.guard' },
          ] }],
        },
        {
          do: 'driveTo', text: 'c1.obj.beach', at: [4, -395.9], radius: 15,
          on: [{ zone: { x: [-1e9, 62] }, do: [{ do: 'say', who: 'wren', text: 'c1.wren.behind' }, { do: 'vehicleSet', id: 'zero', gap: 8 }] }],
        },
        {
          do: 'driveTo', text: 'c1.obj.north', at: [-8.75, -215], radius: 13,
          on: [{ zone: { z: [-345, 1e9] }, do: [
            // it could have had him at the corner. It did not take him.
            { do: 'say', who: 'wren', text: 'c1.wren.holding' }, { do: 'vehicleSet', id: 'zero', gap: 26 },
            GUARD('g2', [-5.25, -120], 180), { do: 'drive', id: 'g2', mode: 'pursue', pace: 0.78, hold: 4 },
            { do: 'wanted', stars: 2 },
          ] }],
        },
        {
          do: 'driveTo', text: 'c1.obj.west', at: [76, -196.25], radius: 13,
          on: [{ zone: { x: [18, 1e9] }, do: [{ do: 'say', who: 'wren', text: 'c1.wren.lines' }, { do: 'vehicleSet', id: 'zero', gap: 14 }] }],
        },
        // (the game saves here: half way)
        { do: 'checkpoint', id: 1, setup: [
          { do: 'vehicleSet', id: 'van', place: [80, -196.25], face: 270 },
          { do: 'vehicleSet', id: 'zero', place: [56, -196.25], face: 270 }, { do: 'drive', id: 'zero', mode: 'shadow', gap: 14 },
          GUARD('g1', [20, -196.25], 270), { do: 'drive', id: 'g1', mode: 'pursue', pace: 0.74, hold: 5 },
          GUARD('g2', [-4, -196.25], 270), { do: 'drive', id: 'g2', mode: 'pursue', pace: 0.78, hold: 4 },
          { do: 'wanted', stars: 2 },
        ] },
        {
          do: 'driveTo', text: 'c1.obj.rail', at: [85.25, 70], radius: 14,
          on: [{ zone: { z: [-70, 1e9] }, do: [{ do: 'drive', id: 'g1', mode: 'stop' }, { do: 'vehicleSet', id: 'g1', flash: false }, { do: 'say', who: 'wren', text: 'c1.wren.one_down' }] }],
        },
        {
          do: 'driveTo', text: 'c1.obj.lose', at: [85.25, 246], radius: 14,
          on: [{ zone: { z: [140, 1e9] }, do: [{ do: 'vehicleSet', id: 'g2', hold: 70 }] }],
        },
        {
          do: 'driveTo', text: 'c1.obj.lose', at: [4, 256.25], radius: 14,
          on: [{ zone: { x: [-1e9, 52] }, do: [{ do: 'drive', id: 'g2', mode: 'stop' }, { do: 'say', who: 'wren', text: 'c1.wren.lost' }, { do: 'vehicleSet', id: 'zero', gap: 30 }] }],
        },
      ],
    },

    // =====================================================================
    // 6. IT LET YOU GO - an alley, a black car at the end of the street, a question
    // =====================================================================
    {
      id: 'c1m6', title: 'c1.m6',
      setup: [
        { ...NIGHT, onLoad: true },
        { ...VAN([-8.75, 262], 0, { speed: 40 }), onLoad: true }, ...VAN_THINGS.map((s) => ({ ...s, onLoad: true })),
        { do: 'player', inCar: 'van', onLoad: true },
        { ...ZERO([-8.75, 232], 0), onLoad: true },
        { do: 'drive', id: 'zero', mode: 'shadow', gap: 30, onLoad: true },
        { do: 'vehicleSet', id: 'van', limit: 0, lockExit: true },
        { do: 'allow', enter: 'none' },
        { do: 'world', traffic: 15, people: 0 },
        { do: 'mirror', on: true, onLoad: true }, { do: 'cam', widen: 1, onLoad: true },
        { do: 'clear', at: HIDE, radius: 30 },
        { do: 'remove', ids: ['g1', 'g2'] },
        { do: 'wanted', stars: 0 },                        // the stars go out
        { do: 'music', tension: 0.3 },
      ],
      on: [{ damageOver: 0.97, fail: 'c1.fail.wrecked' }],
      steps: [
        { do: 'driveTo', text: 'c1.obj.hide', at: HIDE, radius: 6.5, stop: true },
        { do: 'mirror', on: false }, { do: 'cam', widen: 0 },
        { do: 'music', tension: 0, silence: 1.5 },
        {
          do: 'cutscene', keep: true,
          shots: [
            // looking back down the alley at the street. It comes. It stops at the end of the street.
            { seconds: 8.5, cam: { from: [-45.5, 1.3, 313.5], to: [-45, 1.25, 313.6], look: [-12, 0.9, 315], fov: 30 },
              do: [
                { do: 'vehicleSet', id: 'zero', place: [-8.75, 276], face: 0 },
                { do: 'drive', id: 'zero', mode: 'path', path: [[-8.75, 276], [-8.75, 307], [-9.9, 314.4]], kin: true, speed: 26 },
              ] },
            // it waits there. It only looks.
            { seconds: 6.2, cam: { from: [-19.5, 0.85, 316.6], to: [-18.8, 0.85, 316.5], look: { of: 'zero', p: [0, 0.62, 1.4] }, fov: 30 },
              lines: [{ at: 4.2, do: [{ do: 'drive', id: 'zero', mode: 'path', path: [{ of: 'zero', p: [0, 0, 0] }, [-8.75, 324], [-8.75, 470]], kin: true, speed: 64, end: 'remove' }] }] },
            // the end of the street is empty
            { seconds: 3.4, cam: { from: [-45, 1.25, 313.6], look: [-12, 0.9, 315], fov: 30 } },
            { seconds: 7, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.3] }, look: { cabin: 'van', at: 'eye', p: [0, -0.04, 0] }, fov: 42, near: NEAR },
              lines: [{ at: 1.0, who: 'wren', text: 'c1.wren.let_go', seconds: 2.4 }, { at: 4.2, who: 'nate', text: 'c1.why', seconds: 2.2 }] },
          ],
        },
        // CHOICE (it is remembered): does WREN keep looking for it?
        { do: 'choice', options: [{ text: 'c1.ch.stop_tracking', set: { wren_tracks_zero: false } }, { text: 'c1.ch.mirror', set: { wren_tracks_zero: true } }] },
        {
          do: 'cutscene', skippable: false,
          shots: [
            { seconds: 3.6, cam: { from: { cabin: 'van', at: 'pass', p: [0.12, 0.0, 0.3] }, look: { cabin: 'van', at: 'eye', p: [0, -0.04, 0] }, fov: 42, near: NEAR },
              lines: [
                { at: 0.5, if: { flag: 'wren_tracks_zero', is: false }, who: 'wren', text: 'c1.wren.understood', seconds: 2 },
                { at: 0.5, if: { flag: 'wren_tracks_zero' }, who: 'wren', text: 'c1.wren.watch', seconds: 2 },
              ] },
            // he left the ticket with her: the news finds it for him
            { if: { flag: 'ticket_taken', is: false }, seconds: 8.4, pov: true, cam: { from: { cabin: 'van', at: 'eye', p: [0, 0.02, 0.02] }, look: { cabin: 'van', at: 'dash', p: [0.05, -0.05, 0.1] }, lookTo: { cabin: 'van', at: 'dash', p: [0, -0.2, -0.13] }, fov: 40, near: NEAR },
              lines: [{ at: 0.4, do: [{ do: 'sound', name: 'tick' }] }, { at: 0.8, who: 'radio', kind: 'thought', text: 'c1.radio.news', seconds: 7 }] },
            // THE LAST PICTURE, part 1: he took it. IRONHILL NIGHT RUN. DRIVER T. CALLOWAY.
            { if: { flag: 'ticket_taken' }, seconds: 6.5, pov: true, cam: { from: { cabin: 'van', at: 'eye', p: [0, 0.02, 0.04] }, to: { cabin: 'van', at: 'eye', p: [0.03, 0.0, 0.1] }, look: { cabin: 'van', at: 'dash', p: [0.02, 0.012, 0.02] }, fov: 24, near: NEAR },
              do: [{ do: 'prop', id: 'ticket2', kind: 'ticket', in: 'van', at: { cabinAt: 'dash', p: [0.02, 0.012, 0.02] }, rot: [0, Math.PI + 0.22, 0] }] },
            // THE LAST PICTURE, part 2: the tape. DON'T SKIP. He pushes it in, very quietly.
            { seconds: 10, pov: true, fade: 'out', fadeSeconds: 3.2, cam: { from: { cabin: 'van', at: 'eye', p: [0, 0.02, 0.04] }, to: { cabin: 'van', at: 'eye', p: [-0.03, 0.0, 0.12] }, look: { cabin: 'van', at: 'dash', p: [-0.03, -0.238, -0.137] }, fov: 24, fovTo: 15, near: NEAR },
              lines: [{ at: 2.4, do: [{ do: 'sound', name: 'clunk' }, { do: 'music', tape: 1, volume: 0.6 }] }] },
          ],
        },
        { do: 'wait', seconds: 1.2 },
        { do: 'music', stop: true },
        { do: 'end', over: 'c1.card.sub', title: 'c1.title', lines: ['c1.end.1', 'c1.end.2', 'c1.end.3'], locked: 'c1.end.locked' },
      ],
    },
  ],
};
