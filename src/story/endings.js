// ---------------------------------------------------------------------------
// ENDINGS - the end of "Phantom Grid" (after Chapter 10's last choice). Written like a chapter: ONLY DATA, read by the
// story engine (src/story/engine.js loads this file for the chapter id 'endings').
//
//   LET GO    (the true ending)  Nate presses Lena's switch. The Phantoms stop, their lights fade, the rain eases, the
//             sky gets light. A last drive on Ironhill Highway at dawn - the first sunrise of the game. Zero drives
//             beside him, matches his speed, then for the first time slows down: "This time you go ahead." Nate
//             crosses the line alone; Zero stops behind him and goes dark. The mixtape plays to the end of track 6,
//             then track 7 for the first time: Theo's voice. Nate smiles through tears and slows down. Black.
//   KEEP HIM  (the dark ending)  Nate takes the Grid. The rain never stops; the Phantoms fill the streets, in rows,
//             obediently. Last: Nate at Vance's table, in front of a mirror, practising the same handshake with the
//             same small phrase; a faint, blank, polite voice of Theo. Black.
//   NEW BODY  (the secret ending)  After the true ending's slow drive, only when EVERYTHING is true (SECRET below):
//             Mace's garage at dawn, a second of silence, two knocks. A young man in Theo's old jacket: "Excuse me...
//             do I know you?" (When Nate took the jacket in Chapter 4 it hangs over the armchair instead.) Black, and
//             after the credits: TO BE CONTINUED.
// Each ending then shows (step "finale"): one line for each friend (EPILOGUE, by the flags), the numbers of the
// story, the credits (src/ui/credits.js) and PLAY AGAIN (the endings seen and their rewards stay).
// ---------------------------------------------------------------------------

const NEAR = 0.05;
const DECK = 8;
const LN = [-487.1, -491.25, -495.4];      // the northbound lanes of Ironhill Highway (inside .. by the wall)
const tw = (zone, x, y, z) => ({ tower: zone, p: [x, y, z] });
const g = (r, u, f) => ({ garage: [r, u, f] });     // a point of Mace's garage (right, up, toward the street)

// ---- who was there (the same rules as src/story/flags.js) ----
const HAS = {
  dante: { any: [{ flag: 'harrow_switched' }, { not: { flag: 'dante_captured' } }] },
  rask: { flag: 'rask_redeemed' },
  harrow: { flag: 'harrow_switched' },
  mace: { any: [{ flag: 'mace_forgiven', is: true }, { flag: 'mace_forgiven', is: 'neutral' }] },
  juno: { all: [{ flag: 'juno_fate', is: 'spared' }, { flag: 'juno_left_kvi' }] },
};
// THE SECRET ENDING: Mace forgiven; Lena's trust high (Nate told her about Theo, and he holds the chip - or they share
// it); Juno spared and gone from KVI; the three side stories finished. (Chapter 7 and the side stories are not in the
// game yet: today only the DEBUG FLAGS screen can make all of this true.)
const SECRET = {
  all: [
    { flag: 'mace_forgiven', is: true },
    { flag: 'told_lena_theo' },
    { any: [{ flag: 'chip_holder', is: 'nate' }, { flag: 'chip_holder', is: 'shared' }] },
    HAS.juno,
    { flag: 'side_mila_signal' }, { flag: 'side_static_past' }, { flag: 'side_wolf_pack' },
  ],
};
// (an ending played again from the gallery: "new_body" always shows the knock, "let_go" never does)
const KNOCK = { any: [{ all: [SECRET, { not: { flag: 'ending_replay', is: 'let_go' } }] }, { flag: 'ending_replay', is: 'new_body' }] };

// ---- the cars ----
const THEO_JACKET = { color: [0.11, 0.42, 0.78], cuff: 0.83, hem: 0.07 };
const RUN_CAR = (at, face, more = {}) => [
  { do: 'spawn', id: 'run', kind: 'theo_coupe', or: 'coupe', at, face, enter: true, lockExit: true, detail: true, if: { flag: 'theo_car' }, ...more },
  { do: 'spawn', id: 'run', kind: 'tech_patrol_car', or: 'sedan', at, face, enter: true, lockExit: true, detail: true, color: [0.42, 0.27, 0.12], lights: 'normal',
    type: { label: "MACE'S STREET CAR", topSpeed: 204, accel: 9.4, grip: 1.1, nitro: true, role: 'car' }, if: { not: { flag: 'theo_car' } }, ...more },
];
const PHANTOM = (id, at, face, more = {}) => ({ do: 'spawn', id, kind: 'tech_patrol_car', or: 'sedan', at, face, color: [1, 1, 1], npc: true, noDetail: true, lights: 'bar', flash: true, type: { label: 'PHANTOM' }, ...more });

export default {
  id: 'endings',
  number: 11,
  title: 'end.title',
  vehicle: 'run',
  getIn: 'c10.get_in',
  // (started from the DEBUG FLAGS screen or the address option: what a normal game has decided by then)
  flags: {
    theo_car: true, mace_forgiven: true, c6_end: 'forgive', told_lena_theo: true, chip_holder: 'lena', jacket_taken: true,
    harrow_switched: true, rask_redeemed: true, dante_captured: true, nate_innocent_seen: true,
  },
  preload: { actors: ['Adrian_Vance', 'Theo_Calloway'], vehicles: ['tech_patrol_car'] },
  // THE ENDING GALLERY of the title screen (the secret ending starts like the true one)
  gallery: [
    { key: 'let_go', mission: 'e_letgo', title: 'end.let_go', line: 'end.let_go_line' },
    { key: 'keep_him', mission: 'e_keep', title: 'end.keep_him', line: 'end.keep_him_line' },
    { key: 'new_body', mission: 'e_letgo', title: 'end.new_body', line: 'end.new_body_line' },
  ],
  // what an ending leaves for every next game (PLAY AGAIN keeps them): the title screen in the morning, a line under
  // the game's name, KVI's words as the tagline
  rewards: { let_go: ['dawn_title'], new_body: ['dawn_title', 'continued_note'], keep_him: ['kvi_title'] },
  // ONE LINE FOR EACH FRIEND (who: the name shown over it). A line is shown when its "if" is true.
  epilogue: {
    let_go: [
      { who: 'lena', text: 'end.lg.lena' },
      { who: 'mace', text: 'end.lg.mace', if: HAS.mace },
      { who: 'mace', text: 'end.lg.mace_gone', if: { not: HAS.mace } },
      { who: 'dante', text: 'end.lg.dante', if: HAS.dante },
      { who: 'dante', text: 'end.lg.dante_gone', if: { not: HAS.dante } },
      { who: 'rask', text: 'end.lg.rask', if: HAS.rask },
      { who: 'rask', text: 'end.lg.rask_gone', if: { not: HAS.rask } },
      { who: 'harrow', text: 'end.lg.harrow', if: HAS.harrow },
      { who: 'harrow', text: 'end.lg.harrow_gone', if: { not: HAS.harrow } },
      { who: 'juno', text: 'end.lg.juno', if: HAS.juno },
      { who: 'juno', text: 'end.lg.juno_gone', if: { flag: 'juno_fate', is: 'caught' } },
      { who: 'zero', text: 'end.lg.zero' },
      { who: 'nate', text: 'end.lg.nate' },
    ],
    keep_him: [
      { who: 'lena', text: 'end.kh.lena' },
      { who: 'mace', text: 'end.kh.mace', if: HAS.mace },
      { who: 'mace', text: 'end.kh.mace_gone', if: { not: HAS.mace } },
      { who: 'dante', text: 'end.kh.dante', if: HAS.dante },
      { who: 'dante', text: 'end.kh.dante_gone', if: { not: HAS.dante } },
      { who: 'rask', text: 'end.kh.rask', if: HAS.rask },
      { who: 'rask', text: 'end.kh.rask_gone', if: { not: HAS.rask } },
      { who: 'harrow', text: 'end.kh.harrow', if: HAS.harrow },
      { who: 'harrow', text: 'end.kh.harrow_gone', if: { not: HAS.harrow } },
      { who: 'juno', text: 'end.kh.juno', if: HAS.juno },
      { who: 'zero', text: 'end.kh.zero' },
      { who: 'nate', text: 'end.kh.nate' },
    ],
  },

  missions: [
    // =====================================================================
    // LET GO (and, when everything is true, NEW BODY after it)
    // =====================================================================
    {
      id: 'e_letgo', title: 'end.let_go',
      setup: [
        { do: 'time', hour: 5.25, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'wanted', stars: 0 },
        { do: 'tower', show: 'glass' },
        { do: 'player', stage: { at: tw('glass', -5.45, 0, 1), face: 90, pose: 'idle' }, mood: 'sad' },
        { do: 'allow', enter: 'none', move: false },
      ],
      steps: [
        // THE SWITCH: his hand on Lena's console. White.
        {
          do: 'cutscene', skippable: false, shots: [
            // (from beyond the console: his face over the blue light, and his hand coming down on it)
            { seconds: 3.6, fade: 'in', cam: { from: tw('glass', -7.3, 1.5, 1.95), to: tw('glass', -7.2, 1.46, 1.8), look: tw('glass', -5.85, 1.2, 0.95), fov: 34 },
              do: [{ do: 'player', pose: 'putDown', hands: tw('glass', -6.0, 1.07, 1) }, { do: 'music', heart: 44 }],
              lines: [{ at: 2.6, do: [{ do: 'sound', name: 'clunk' }, { do: 'music', heart: 0 }] }] },
            { seconds: 1.6, cam: { from: tw('glass', -7.2, 1.46, 1.8), look: tw('glass', -5.95, 1.1, 1.0), fov: 26 },
              do: [{ do: 'fade', to: 'white', seconds: 1.2 }, { do: 'music', silence: 2.0 }] },
          ],
        },
        // THE PHANTOMS STOP: in the street their lights go out, one by one. The rain eases. The sky gets light.
        { do: 'tower', show: null },
        { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
        PHANTOM('p1', [181, 126], 0), PHANTOM('p2', [176.4, 149], 270), PHANTOM('p3', [191, 158], 205),
        {
          do: 'cutscene', skippable: false, shots: [
            { seconds: 5.6, fade: 'fromWhite', cam: { from: [174, 2.3, 113], to: [175, 2.45, 116], look: [183, 1.0, 141], fov: 46 },
              do: [{ do: 'time', to: 5.75, seconds: 16 }, { do: 'time', rain: 'ease' }, { do: 'sound', name: 'wind' }],
              lines: [{ at: 1.3, do: [{ do: 'vehicleSet', id: 'p1', flash: false, lights: 'off' }] }, { at: 2.6, do: [{ do: 'vehicleSet', id: 'p2', flash: false, lights: 'off' }] },
                { at: 3.8, do: [{ do: 'vehicleSet', id: 'p3', flash: false, lights: 'off' }] }] },
            // the towers of The Crown, the sky over them going pale
            { seconds: 6.0, cam: { from: [300, 1.6, 236], to: [300, 1.8, 232], look: [430, 70, 470], fov: 52 },
              do: [{ do: 'sound', name: 'birds' }] },
          ],
        },
        { do: 'remove', ids: ['p1', 'p2', 'p3'] },
        // THE LAST DRIVE: Ironhill Highway at dawn, the first sunrise of the game. Zero beside him.
        { do: 'fade', to: 'black', seconds: 0.6 },
        { do: 'time', hour: 5.95, rain: false },
        ...RUN_CAR([LN[1], 300], 0, { arena: 'ironhill' }),
        { do: 'player', inCar: 'run' },
        { do: 'allow', enter: ['run'], move: true, drive: true },
        { do: 'vehicleSet', id: 'run', speed: 100 },
        { do: 'cam', mode: 'chase' },
        { do: 'run', start: true },
        { do: 'run', autoRewind: { at: 1385, to: 60 } },
        // the old finish line, painted across the northbound lanes, two flares
        { do: 'prop', id: 'line', kind: 'startLine', at: [LN[1], DECK, 760], width: 13 },
        { do: 'prop', id: 'fl1', kind: 'flare', at: [-497.9, DECK, 760] },
        { do: 'prop', id: 'fl2', kind: 'flare', at: [-484.6, DECK, 760] },
        { do: 'run', zero: 'beside', speed: 108 },
        { do: 'music', tape: 6, fromEnd: 21 },
        { do: 'time', to: 6.4, seconds: 45 },
        { do: 'fade', to: 'clear', seconds: 1.4 },
        { do: 'driveTo', at: [LN[1], 762], radius: 18, text: 'end.obj.drive',
          on: [
            // for the first time, Zero slows down. Theo on the radio: this time you go ahead.
            { zone: { z: [500, 3000] }, do: [{ do: 'run', zero: 'rest' }, { do: 'say', who: 'theo', kind: 'warm', text: 'end.theo.ahead', seconds: 2.8 }] },
          ] },
        // over the line, alone. The story takes the wheel gently. Behind him Zero has stopped; its lights go out.
        {
          do: 'cutscene', skippable: false, shots: [
            { seconds: 5.0, cam: { from: { of: 'run', p: [-1.8, 1.9, -7] }, to: { of: 'run', p: [-1.6, 2.0, -8] }, look: { of: 'run', p: [0.6, 0.9, -60] }, fov: 34 },
              do: [{ do: 'autoDrive', gas: 0.22, brake: 0, steer: 0 }] },
          ],
        },
        // the tape runs out, and track 7 plays for the first time: Theo's voice
        { do: 'music', tape: 7 },
        {
          do: 'cutscene', skippable: false, shots: [
            { seconds: 7.0, cam: { from: { cabin: 'run', at: 'pass', p: [0.05, 0.03, 0.05] }, look: { cabin: 'run', at: 'eye', p: [0, -0.02, 0] }, fov: 38, near: NEAR },
              do: [{ do: 'autoDrive', gas: 0, brake: 0.08, steer: 0 }, { do: 'player', mood: 'sad', look: { cabin: 'run', at: 'eye', p: [0, 0, 6] } }],
              lines: [{ at: 1.8, who: 'theo', kind: 'warm', text: 'end.theo.tape7', seconds: 4.6 }, { at: 5.8, do: [{ do: 'player', mood: 'smile' }] }] },
            { seconds: 5.0, cam: { from: { of: 'run', p: [-2.6, 1.6, 12] }, to: { of: 'run', p: [-2.2, 1.7, 14] }, look: { of: 'run', p: [0, 0.9, 0] }, fov: 40 }, fade: 'out', fadeSeconds: 4.2,
              do: [{ do: 'autoDrive', gas: 0, brake: 0.18, steer: 0 }] },
          ],
        },
        { do: 'autoDrive', off: true },
        { do: 'run', stop: true },
        { do: 'remove', ids: ['line', 'fl1', 'fl2'] },
        // NEW BODY, or the end
        {
          do: 'if', cond: KNOCK,
          then: [
            { do: 'player', leaveNow: true },
            { do: 'remove', ids: ['run'] },
            { do: 'music', stop: true },
            { do: 'time', hour: 6.5, rain: false },
            { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
            { do: 'shutter', open: 0, seconds: 0 },
            { do: 'player', stage: { at: g(-3.2, 0, 3.7), face: 270, pose: 'idle' }, mood: 'tired' },
            { do: 'prop', id: 'njacket', kind: 'theoJacket', folded: true, at: g(-4.15, 0.62, 5.4), face: 300, if: { flag: 'jacket_taken' } },
            { do: 'actor', id: 'stranger', model: 'Theo_Calloway', name: 'name.stranger', at: g(-3.4, 0, 8.7), face: 90, pose: 'idle', fixed: true, look: null, mood: 'worried', jacket: THEO_JACKET, if: { flag: 'jacket_taken', is: false } },
            { do: 'actor', id: 'stranger', model: 'Theo_Calloway', name: 'name.stranger', at: g(-3.4, 0, 8.7), face: 90, pose: 'idle', fixed: true, look: null, mood: 'worried', if: { flag: 'jacket_taken' } },
            {
              do: 'cutscene', skippable: false, shots: [
                // the garage at dawn: grey light at the edges of the door; one second of nothing
                { seconds: 4.2, fade: 'in', cam: { from: g(-6.3, 1.5, -1.2), to: g(-6.2, 1.5, -1.0), look: g(-3.4, 1.25, 4.8), fov: 44 },
                  do: [{ do: 'music', silence: 1.4 }] },
                // two knocks
                { seconds: 2.8, cam: { from: g(-6.3, 1.5, -1.0), look: g(-3.4, 1.4, 6.6), fov: 38 },
                  lines: [{ at: 1.0, do: [{ do: 'sound', name: 'knock' }] }] },
                // he opens it
                { seconds: 3.8, cam: { from: g(-1.8, 1.6, 2.2), look: g(-3.5, 1.5, 7.2), fov: 40 },
                  do: [{ do: 'player', look: g(-3.4, 1.6, 8.7) }, { do: 'shutter', open: 1, seconds: 2.8 }] },
                // a young man on the sidewalk, unsure
                { seconds: 5.2, cam: { from: g(-3.0, 1.66, 4.4), look: { of: 'stranger', p: [0, 1.6, 0] }, fov: 30 },
                  do: [{ do: 'actorSet', id: 'stranger', look: 'player' }],
                  lines: [{ at: 1.6, who: 'stranger', text: 'end.stranger.knock', mood: 'worried', seconds: 2.8 }] },
                // (Nate took Theo's jacket in Chapter 4: it lies over the armchair)
                { seconds: 3.2, if: { flag: 'jacket_taken' }, cam: { from: g(-3.0, 1.3, 4.3), look: g(-4.15, 0.7, 5.4), fov: 32 } },
                // Nate. Nothing. Black.
                { seconds: 3.6, cam: { from: { of: 'player', p: [0.3, 1.66, 0.95] }, look: { of: 'player', p: [0, 1.62, 0] }, fov: 26 }, fade: 'out', fadeSeconds: 3.0,
                  do: [{ do: 'player', mood: 'surprised' }] },
              ],
            },
            { do: 'remove', ids: ['stranger', 'njacket'] },
            { do: 'finale', ending: 'new_body', continued: true },
          ],
          else: [{ do: 'finale', ending: 'let_go' }],
        },
      ],
      flags: {},
    },

    // =====================================================================
    // KEEP HIM
    // =====================================================================
    {
      id: 'e_keep', title: 'end.keep_him',
      setup: [
        { do: 'time', hour: 0.05, rain: true },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'wanted', stars: 0 },
        { do: 'tower', show: 'glass' },
        { do: 'player', stage: { at: tw('glass', -5.45, 0, 1), face: 90, pose: 'idle' }, mood: 'stern' },
        { do: 'actor', id: 'vance', model: 'Adrian_Vance', name: 'name.vance', at: tw('glass', 5.6, 0, 1), face: 90, pose: 'idle', fixed: true, look: 'player', mood: 'neutral' },
        { do: 'allow', enter: 'none', move: false },
      ],
      steps: [
        // his hand on the console; the screen goes white; a cold low hum fills the room
        {
          do: 'cutscene', skippable: false, shots: [
            { seconds: 3.8, fade: 'in', cam: { from: tw('glass', -7.3, 1.5, 0.05), look: tw('glass', -5.85, 1.2, 1.0), fov: 34 },
              do: [{ do: 'player', pose: 'putDown', hands: tw('glass', -6.0, 1.07, 1) }],
              lines: [{ at: 2.4, do: [{ do: 'sound', name: 'hum' }] }] },
            // at the far end of the table: the smallest smile
            { seconds: 3.6, cam: { from: { of: 'vance', p: [0.3, 1.62, 1.1] }, look: { of: 'vance', p: [0, 1.6, 0] }, fov: 28 },
              do: [{ do: 'actorSet', id: 'vance', mood: 'smile' }] },
          ],
        },
        { do: 'remove', ids: ['vance'] },
        { do: 'tower', show: null },
        { do: 'world', traffic: 0, people: 0, indoors: false, now: true },
        // THE CITY: the rain does not stop. The Phantoms fill the streets, in rows, obediently.
        { do: 'news', text: 'end.news.keep' },
        PHANTOM('k1', [60, 44], 222), PHANTOM('k2', [66, 50.5], 222), PHANTOM('k3', [72, 57], 222), PHANTOM('k4', [78, 63.5], 222), PHANTOM('k5', [84, 70], 222),
        {
          do: 'cutscene', skippable: false, shots: [
            { seconds: 6.2, fade: 'in', cam: { from: [20, 26, 30], to: [24, 25, 26], look: [70, 1, 56], fov: 46 },
              do: [{ do: 'drive', id: 'k1', path: [[60, 44], [-120, -150]], speed: 34 }, { do: 'drive', id: 'k2', path: [[66, 50.5], [-114, -143]], speed: 34 },
                { do: 'drive', id: 'k3', path: [[72, 57], [-108, -137]], speed: 34 }, { do: 'drive', id: 'k4', path: [[78, 63.5], [-102, -130]], speed: 34 },
                { do: 'drive', id: 'k5', path: [[84, 70], [-96, -124]], speed: 34 }, { do: 'sound', name: 'hum' }] },
            { seconds: 5.0, cam: { from: [-2, 1.2, 8], look: [30, 1.0, 30], fov: 40 } },
          ],
        },
        { do: 'news', text: null },
        { do: 'remove', ids: ['k1', 'k2', 'k3', 'k4', 'k5'] },
        // THE MIRROR: Nate at Vance's table, practising the handshake, the same small phrase
        { do: 'tower', show: 'glass' },
        { do: 'world', traffic: 0, people: 0, indoors: true, now: true },
        { do: 'tower', mirror: true },
        { do: 'player', stage: { at: tw('glass', -9.6, 0, -6.75), face: 180, pose: 'idle' }, mood: 'neutral' },
        {
          do: 'cutscene', skippable: false, shots: [
            // over his shoulder: his face in the mirror
            { seconds: 5.6, fade: 'in', cam: { from: tw('glass', -9.25, 1.72, -5.55), to: tw('glass', -9.3, 1.72, -5.7), look: tw('glass', -9.6, 1.55, -7.95), fov: 32 },
              do: [{ do: 'player', pose: 'give' }],
              lines: [{ at: 2.2, who: 'nate', text: 'end.nate.safety', mood: 'smile', seconds: 2.0 }] },
            // closer: only the mirror. A faint voice, polite, empty.
            { seconds: 5.4, cam: { from: tw('glass', -9.45, 1.66, -6.1), look: tw('glass', -9.6, 1.6, -7.95), fov: 26 },
              do: [{ do: 'player', pose: 'idle' }],
              lines: [{ at: 1.6, who: 'theo', kind: 'signal', text: 'end.theo.blank', seconds: 3.0 }] },
            { seconds: 3.0, cam: { from: tw('glass', -9.45, 1.66, -6.1), look: tw('glass', -9.6, 1.6, -7.95), fov: 24 }, fade: 'out', fadeSeconds: 2.8 },
          ],
        },
        { do: 'tower', mirror: false },
        { do: 'tower', show: null },
        { do: 'finale', ending: 'keep_him' },
      ],
      flags: {},
    },
  ],
};
