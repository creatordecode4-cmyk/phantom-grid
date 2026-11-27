// ---------------------------------------------------------------------------
// flags.js - every saved choice of the story, in one list.
//
// A "flag" is a small thing the story remembers: a choice ("Tell her about Theo"), something that happened (the
// tarp was lifted) or a word (chip_holder is 'lena'). The chapters set flags with { do: 'flag', set: {...} } and
// with the "set" of a choice; they read them in conditions ({ flag: 'mace_kind' }, { flag: 'chip_holder', is:
// 'nate' }, { flag: 'heard', atLeast: 3 }). The save game keeps them (src/story/save.js).
//
// This file is only a list for people (and for the hidden DEBUG FLAGS screen: triple tap on the title). The story
// does not need it to run: a flag that is not set reads as "no". The engine prints a warning in the console when a
// chapter reads a flag that was never set, or a name that is not in this list (a typing mistake).
//
// Each entry:
//   name    the flag's name
//   kind    'bool' (true / false) | 'word' (one of "values") | 'number' | 'text' | 'list' (a list of words)
//   def     what it means when it was never set
//   values  the words a 'word' flag can have (and the numbers a 'number' flag usually has)
//   ch      the chapter that sets it (0 = prologue). 7 = Chapter 7, which is NOT WRITTEN YET: nothing in the game
//           sets these flags; they are here so the later chapters (and this screen) can use them.
//           'side' = a side story that is not in the game yet. 'end' = the endings.
//   note    what it means, in a few plain words
// ---------------------------------------------------------------------------

const B = (name, ch, note, def = false) => ({ name, kind: 'bool', def, ch, note });
const W = (name, ch, values, note, def = null) => ({ name, kind: 'word', def, values, ch, note });
const N = (name, ch, values, note, def = 0) => ({ name, kind: 'number', def, values, ch, note });

export const FLAGS = [
  // ---- the prologue ----
  B('phone_read', 0, 'Nate read the message on his phone.'),

  // ---- Chapter 1 ----
  B('limiter_off', 1, 'The van\'s speed limiter was switched off (it stays off).'),
  B('voicemail_played', 1, 'Nate played Theo\'s old voicemail.'),
  B('mace_kind', 1, 'Nate was kind to Mace (a hot drink, not only a nod).'),
  B('nate_name_known', 1, 'The city knows Nate\'s name.'),
  B('ticket_found', 1, 'Nate found the race ticket.'),
  B('ticket_taken', 1, 'Nate took the race ticket with him.'),
  B('wren_tracks_zero', 1, 'WREN keeps watching for the black car (Zero).'),

  // ---- Chapter 2 ----
  B('harrow_ivy_seen', 2, 'Nate saw Captain Harrow with her daughter Ivy.'),
  B('nate_denied', 2, 'Nate said "No" when Mace asked if it was him on the news.'),
  B('keystone_found', 2, 'Nate found the KEYSTONE chip.'),
  B('told_mace_video', 2, 'Nate told Mace about the video on the chip.'),
  B('mace_story_heard', 2, 'Nate listened to Mace\'s story about Theo.'),
  B('lifted_tarp', 2, 'Nate lifted the tarp off Theo\'s car.'),
  N('van_color', 2, [-1, 0, 1, 2, 3], 'The van\'s new paint (-1 = never painted, 0..3 = the four colors).', -1),
  { name: 'van_plate', kind: 'text', def: '', ch: 2, note: 'The van\'s new number plate.' },

  // ---- Chapter 3 ----
  W('drone_method', 3, ['quiet', 'distraction'], 'How Nate got past the drones in The Sunk.'),
  B('drone_distract', 3, 'Wick made a distraction for the drones.'),
  B('drone_link_cut', 3, 'Nate cut the drone link (the optional hack).'),
  B('test_chased', 3, 'The Guard chased Nate in The Sunk.'),
  B('tide_trust', 3, 'The Tidewalkers trust Nate.'),
  B('lena_code_seen', 3, 'Nate saw Lena\'s code on her screen.'),
  B('told_lena_theo', 3, 'Nate told Lena about Theo (one half of "Lena\'s trust").'),
  B('wren_locked_found', 3, 'Nate found the locked part of WREN.'),
  B('harrow_let_girl_go', 3, 'Harrow let the Tidewalker girl go.'),
  B('tracker_cut', 3, 'Nate cut the Guard tracker (the hack worked).'),
  W('chip_holder', 3, ['lena', 'nate', 'shared'], 'Who holds the KEYSTONE chip. (\'shared\' is not set by any chapter yet.)'),
  B('chip_to_lena', 3, 'Nate gave the chip to Lena.'),

  // ---- Chapter 4 ----
  B('mace_gave_car', 4, 'Mace gave Nate a street car.'),
  B('shortcut_told', 4, 'Somebody told Nate about the shortcut of the race.'),
  B('took_shortcut', 4, 'Nate took the shortcut in the race.'),
  W('dante_response', 4, ['silence', 'sorry', 'race'], 'What Nate said to Dante after the race.'),
  B('zero_found_race', 4, 'Zero found Nate in the race (from now on Zero can follow him).'),
  B('jacket_taken', 4, 'Nate took Theo\'s jacket (it is on his car seat; Dante wears his own).'),

  // ---- Chapter 5 ----
  W('rask_stance', 5, ['honest', 'paid'], 'How Nate talked to Rask: honest, or only for the money.'),
  B('rask_mila_seen', 5, 'Nate saw the photo of Rask\'s daughter Mila.'),
  B('cutter_saw', 5, 'The Guard boat saw Nate in the docks.'),
  B('gate_hacked', 5, 'Nate hacked the dock gate.'),
  B('container_taken', 5, 'Nate took the container out of the docks.'),
  B('opened_package', 5, 'Nate opened the package.'),
  B('mace_payment_seen', 5, 'Nate saw that KVI paid Mace.'),
  B('confront_mace', 5, 'Nate wanted to face Mace about the payment right away.'),

  // ---- Chapter 6 ----
  { name: 'mace_forgiven', kind: 'word', def: null, values: [true, false, 'neutral'], ch: 6, note: 'true = Nate forgave Mace, false = he left, \'neutral\' = he stayed silent.' },
  W('c6_end', 6, ['forgive', 'leave', 'neutral'], 'The same choice as a word.'),
  B('wren_muted', 6, 'WREN stays silent until Chapter 8.'),
  N('heard', 6, [0, 1, 2, 3, 4, 5, 6], 'How many of Mace\'s six stories Nate heard to the end.'),
  B('heard_1', 6, 'Mace\'s story 1 was heard.'),
  B('heard_2', 6, 'Mace\'s story 2 was heard.'),
  B('heard_3', 6, 'Mace\'s story 3 was heard.'),
  B('heard_4', 6, 'Mace\'s story 4 was heard.'),
  B('heard_5', 6, 'Mace\'s story 5 was heard.'),
  B('heard_6', 6, 'Mace\'s story 6 was heard.'),
  B('garage_open', 6, 'Mace\'s garage stays open (false after "Leave").', true),
  B('theo_car', 6, 'Theo\'s car can be driven (after forgive or silence).'),
  B('theo_key', 6, 'Nate has the key of Theo\'s car.'),
  W('upgrades_at', 6, ['garage', 'lena'], 'Where the car upgrades are: Mace\'s garage or Lena\'s place.'),
  N('mace_back', 6, [0, 9], 'The chapter in which Mace comes back after "Leave".'),

  // ---- Chapter 7 (NOT WRITTEN YET: only this screen or the address option "flags" can set these) ----
  B('dante_captured', 7, 'The Guard caught Dante (he is in the convoy of Chapter 9).'),
  W('juno_fate', 7, ['spared', 'caught'], 'What happened to Juno Kade.'),
  B('juno_left_kvi', 7, 'Juno chose to leave KVI (she can come to the safehouse in Chapter 10).'),
  B('vance_bar_a', 7, 'At the gala, Nate talked to the old man at the bar (it was Vance).'),
  B('vance_bar_b', 7, 'At the gala, Nate helped the old man at the bar (it was Vance).'),

  // ---- Chapter 8 ----
  B('pilot_key_ready', 8, 'The pilot key is ready.'),
  B('theo_running_confirmed', 8, 'Nate knows that Theo\'s mind runs inside Zero.'),
  B('wren_fragment_unlocked', 8, 'WREN\'s hidden fragment spoke.'),
  W('theo_reply_a', 8, ['why', 'scared', 'sorry', 'silence'], 'Nate\'s first reply to Theo on the radio.'),
  W('theo_reply_b', 8, ['why', 'scared', 'sorry', 'silence'], 'Nate\'s second reply to Theo on the radio.'),
  B('asked_crash_question', 8, 'Nate asked Theo about the crash.'),
  B('radio_off', 8, 'Nate switched the radio off on the way back.'),
  B('nate_partial_peace', 8, 'Nate found a little peace (his last reply was "I am sorry" or silence).'),

  // ---- Chapter 9 ----
  B('trusted_rask', 9, 'Nate trusted Rask\'s route.'),
  W('support_driver', 9, ['mace', 'none'], 'Who drove the second van: Mace or nobody.'),
  W('ambush_style', 9, ['gentle', 'ram', 'hack'], 'How the convoy was stopped.'),
  B('rask_betrayed_nate', 9, 'Rask\'s route was a trap.'),
  W('harrow_reply', 9, ['silent', 'thanks', 'notforme'], 'What Nate said to Harrow after she let Dante go.'),
  B('harrow_switched', 9, 'Harrow changed sides and let Dante go.'),
  B('harrow_access_card', 9, 'Harrow gave Nate her master card.'),
  B('rask_redeemed', 9, 'Rask called and asked where to come.'),
  B('ascend_announced', 9, 'Vance announced Project Ascend on TV.'),

  // ---- side stories (NOT IN THE GAME YET) ----
  B('side_mila_signal', 'side', 'Side story "Mila\'s Signal" was finished.'),
  B('side_static_past', 'side', 'Side story "Static\'s Past" (Lena) was finished.'),
  B('side_wolf_pack', 'side', 'Side story "Wolf Pack" (the Chrome Wolves) was finished.'),

  // ---- Chapter 10 ----
  W('c10_difficulty', 10, ['easy', 'normal'], 'How hard the assault is (easy: fewer Phantoms, more time).', 'normal'),
  { name: 'ally_help', kind: 'list', def: [], ch: 10, values: ['lena_grid', 'dante_street', 'dante_tower', 'rask_street', 'rask_tower', 'harrow_door', 'juno_roof', 'mace_car'], note: 'What each friend does tonight (the plan at the safehouse).' },
  B('nate_innocent_seen', 10, 'Nate saw the truth of the crash night: it was never him.'),
  W('vance_response', 10, ['crash', 'mind', 'silent'], 'What Nate did when Vance spoke: asked about the crash, about Theo\'s mind, or stayed silent.'),
  W('final_choice', 10, ['let_go', 'keep_him'], 'LET GO (the kill-switch) or KEEP HIM (take the Grid).'),

  // ---- the endings ----
  W('ending', 'end', ['let_go', 'keep_him', 'new_body'], 'The ending that was seen last.'),
  B('ending_replay', 'end', 'Set only while an ending is played again from the Ending gallery (nothing is saved then; NEW BODY always shows the knock).'),
];

// name -> entry
export const FLAG_INFO = new Map(FLAGS.map((f) => [f.name, f]));
export const isKnownFlag = (name) => FLAG_INFO.has(name) || /^heard_\d$/.test(name);

// the groups of the DEBUG FLAGS screen, in story order
export const FLAG_GROUPS = [
  [0, 'PROLOGUE'], [1, 'CHAPTER 1'], [2, 'CHAPTER 2'], [3, 'CHAPTER 3'], [4, 'CHAPTER 4'], [5, 'CHAPTER 5'],
  [6, 'CHAPTER 6'], [7, 'CHAPTER 7 (NOT WRITTEN YET)'], [8, 'CHAPTER 8'], [9, 'CHAPTER 9'],
  ['side', 'SIDE STORIES (NOT IN THE GAME YET)'], [10, 'CHAPTER 10'], ['end', 'ENDINGS'],
];

// ---------------------------------------------------------------------------
// PRESETS: whole sets of flags as a game could have left them at the start of Chapter 10. The DEBUG FLAGS screen
// puts one in place before jumping to a chapter (for an earlier chapter, that chapter's own flags come first).
// ---------------------------------------------------------------------------
const BASE = {
  phone_read: true,
  limiter_off: true, voicemail_played: true, mace_kind: true, nate_name_known: true, ticket_found: true, ticket_taken: true, wren_tracks_zero: true,
  harrow_ivy_seen: true, nate_denied: false, keystone_found: true, told_mace_video: true, mace_story_heard: true, lifted_tarp: true, van_color: 0, van_plate: 'PM 2908',
  drone_method: 'quiet', drone_distract: false, drone_link_cut: true, test_chased: false, tide_trust: true, lena_code_seen: true, wren_locked_found: true, harrow_let_girl_go: true, tracker_cut: true,
  mace_gave_car: true, shortcut_told: true, took_shortcut: false, zero_found_race: true,
  rask_mila_seen: true, cutter_saw: false, gate_hacked: true, container_taken: true, opened_package: false, mace_payment_seen: true,
  pilot_key_ready: true, theo_running_confirmed: true, wren_fragment_unlocked: true,
  rask_betrayed_nate: true, ascend_announced: true,
  dante_captured: true,
};
const ALL_STORIES = { heard: 6, heard_1: true, heard_2: true, heard_3: true, heard_4: true, heard_5: true, heard_6: true };

export const PRESETS = {
  // GOOD RUN: Nate was honest and kind; every friend is with him (Juno too); the true ending is the natural one
  good: {
    label: 'GOOD RUN',
    note: 'Every friend is there (Juno too). Mace forgiven. The side stories are not done, so no secret ending.',
    flags: {
      ...BASE, ...ALL_STORIES,
      told_lena_theo: true, chip_holder: 'lena', chip_to_lena: true,
      dante_response: 'sorry', jacket_taken: true,
      rask_stance: 'honest', confront_mace: false,
      mace_forgiven: true, c6_end: 'forgive', wren_muted: false, garage_open: true, theo_car: true, theo_key: true, upgrades_at: 'garage',
      juno_fate: 'spared', juno_left_kvi: true, vance_bar_a: true, vance_bar_b: false,
      theo_reply_a: 'why', theo_reply_b: 'sorry', asked_crash_question: true, radio_off: false, nate_partial_peace: true,
      trusted_rask: true, support_driver: 'mace', ambush_style: 'gentle', harrow_reply: 'thanks',
      harrow_switched: true, harrow_access_card: true, rask_redeemed: true,
      side_mila_signal: false, side_static_past: false, side_wolf_pack: false,
    },
  },
  // DARK RUN: Nate kept everything to himself and walked away from people; only Lena is left at the table
  dark: {
    label: 'DARK RUN',
    note: 'Only Lena is left. Mace was left behind, Harrow did not switch, Rask did not call, Juno was caught.',
    flags: {
      ...BASE, heard: 1, heard_1: true,
      told_lena_theo: false, chip_holder: 'lena', chip_to_lena: true,
      dante_response: 'race', jacket_taken: false,
      rask_stance: 'paid', confront_mace: true,
      mace_forgiven: false, c6_end: 'leave', wren_muted: true, garage_open: false, theo_car: false, theo_key: false, upgrades_at: 'lena', mace_back: 9,
      juno_fate: 'caught', juno_left_kvi: false, vance_bar_a: false, vance_bar_b: false,
      theo_reply_a: 'scared', theo_reply_b: 'why', asked_crash_question: false, radio_off: true, nate_partial_peace: false,
      trusted_rask: false, support_driver: 'none', ambush_style: 'ram', harrow_reply: 'notforme',
      harrow_switched: false, harrow_access_card: false, rask_redeemed: false,
      side_mila_signal: false, side_static_past: false, side_wolf_pack: false,
    },
  },
  // SECRET RUN: everything the "New Body" ending asks for
  secret: {
    label: 'SECRET RUN',
    note: 'Everything the secret ending needs: Mace forgiven, Lena\'s trust high, Juno spared and free, all side stories.',
    flags: {
      ...BASE, ...ALL_STORIES,
      told_lena_theo: true, chip_holder: 'nate', chip_to_lena: false,
      dante_response: 'sorry', jacket_taken: false,
      rask_stance: 'honest', confront_mace: false,
      mace_forgiven: true, c6_end: 'forgive', wren_muted: false, garage_open: true, theo_car: true, theo_key: true, upgrades_at: 'garage',
      juno_fate: 'spared', juno_left_kvi: true, vance_bar_a: false, vance_bar_b: true,
      theo_reply_a: 'why', theo_reply_b: 'silence', asked_crash_question: true, radio_off: false, nate_partial_peace: true,
      trusted_rask: true, support_driver: 'mace', ambush_style: 'hack', harrow_reply: 'silent',
      harrow_switched: true, harrow_access_card: true, rask_redeemed: true,
      side_mila_signal: true, side_static_past: true, side_wolf_pack: true,
    },
  },
};

// ---------------------------------------------------------------------------
// The rules of Chapter 10 and the endings, written once so the chapter, the endings and this screen agree.
// (conditions in the story engine's own words: { flag, is }, { all }, { any }, { not })
// ---------------------------------------------------------------------------
export const ALLY_RULES = {
  // Lena is always there
  lena: null,
  // Dante: the Guard caught him (Chapter 7) and Harrow let him go (Chapter 9) - or he was never caught
  dante: { any: [{ flag: 'harrow_switched' }, { not: { flag: 'dante_captured' } }] },
  rask: { flag: 'rask_redeemed' },
  harrow: { flag: 'harrow_switched' },
  // Mace: forgiven, or Nate stayed silent ('neutral'); not after "Leave"
  mace: { any: [{ flag: 'mace_forgiven', is: true }, { flag: 'mace_forgiven', is: 'neutral' }] },
  // Juno: spared in Chapter 7, and she chose to leave KVI
  juno: { all: [{ flag: 'juno_fate', is: 'spared' }, { flag: 'juno_left_kvi' }] },
};
// THE SECRET ENDING ("New Body"): all of these must be true
export const SECRET_RULE = {
  all: [
    { flag: 'mace_forgiven', is: true },
    { flag: 'told_lena_theo' },
    { any: [{ flag: 'chip_holder', is: 'nate' }, { flag: 'chip_holder', is: 'shared' }] },
    { flag: 'juno_fate', is: 'spared' }, { flag: 'juno_left_kvi' },
    { flag: 'side_mila_signal' }, { flag: 'side_static_past' }, { flag: 'side_wolf_pack' },
  ],
};

// what a flag reads as when it was never set (the default of the list, else "no")
export function flagDefault(name) {
  const f = FLAG_INFO.get(name);
  if (!f) return undefined;
  return Array.isArray(f.def) ? [...f.def] : f.def;
}
