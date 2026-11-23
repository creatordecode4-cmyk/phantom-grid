// ---------------------------------------------------------------------------
// speech.js - the mouth follows the WORDS of a line.
//
// The game has no recorded voices: a line is a subtitle that stays on screen
// for some seconds. To make the speaker's mouth look like it says exactly
// these words, the text is turned into a row of MOUTH SHAPES (a "viseme" is
// the shape of the mouth for a sound), each with its own short time:
//
//   AA  "a" as in father, cat - the jaw wide open
//   EH  "e" as in bed         - open, the lips a little wide
//   II  "ee", "i", "y"        - nearly closed, the lips wide (a smile shape)
//   OH  "o" as in go          - open and round
//   UH  "u" as in but         - half open, relaxed
//   WU  "oo", "w"             - small and round, the lips forward
//   PP  p, b, m               - the lips closed, pressed together
//   FF  f, v                  - the lower lip up to the teeth
//   TH  th                    - a little open, the tongue between the teeth
//   DD  t, d, n, l            - a little open
//   SS  s, z                  - the teeth together, the lips spread
//   CH  ch, sh, j             - the lips forward and round
//   RR  r                     - a little round
//   KK  k, g, ng, h           - open at the back
//
// Words have a short gap; a comma is a short pause with the mouth closed; the
// end of a sentence a longer one. The whole row is stretched or squeezed to
// the time the line is spoken (a little shorter than the subtitle stays).
//
// The row also marks STRESS (the first word of a sentence, long words, words
// before "!", words in capitals) and QUESTIONS: there the head nods a little,
// the eyebrows go up, a hand beats with the word (proceduralAnim.js), and the
// eyes blink at the end of a sentence (faceAnim.js).
// ---------------------------------------------------------------------------

// the mouth for each sound: jaw (millimeters open at the lips), wide (+1 wide .. -1 round), press (1 = lips pressed)
export const VISEMES = {
  rest: { jaw: 0, wide: 0, press: 0 },
  AA: { jaw: 11, wide: 0.35, press: 0 },
  EH: { jaw: 7, wide: 0.7, press: 0 },
  II: { jaw: 3.8, wide: 1, press: 0 },
  OH: { jaw: 8.5, wide: -0.85, press: 0 },
  UH: { jaw: 5.5, wide: 0.05, press: 0 },
  WU: { jaw: 2.4, wide: -1, press: 0 },
  PP: { jaw: 0, wide: -0.15, press: 1 },
  FF: { jaw: 1.5, wide: 0.25, press: 0.35 },
  TH: { jaw: 2.6, wide: 0.15, press: 0 },
  DD: { jaw: 3.2, wide: 0.3, press: 0 },
  SS: { jaw: 1.6, wide: 0.55, press: 0 },
  CH: { jaw: 2.8, wide: -0.7, press: 0 },
  RR: { jaw: 2.8, wide: -0.5, press: 0 },
  KK: { jaw: 4.6, wide: 0.15, press: 0 },
};
// how long each sound takes in normal speech (seconds)
const LEN = { AA: 0.13, EH: 0.12, II: 0.11, OH: 0.13, UH: 0.1, WU: 0.12, PP: 0.085, FF: 0.085, TH: 0.075, DD: 0.065, SS: 0.085, CH: 0.085, RR: 0.07, KK: 0.07 };
const VOWEL = new Set(['AA', 'EH', 'II', 'OH', 'UH', 'WU']);

// letters (and groups of letters) of English to sounds. The longest group that fits is taken first.
const GROUPS = [
  ['tch', ['CH']], ['igh', ['AA', 'II']], ['ough', ['OH']],
  ['th', ['TH']], ['sh', ['CH']], ['ch', ['CH']], ['ph', ['FF']], ['ng', ['KK']], ['ck', ['KK']], ['qu', ['KK', 'WU']], ['wh', ['WU']],
  ['oo', ['WU']], ['ee', ['II']], ['ea', ['II']], ['ie', ['II']], ['ei', ['EH']], ['ai', ['EH']], ['ay', ['EH', 'II']],
  ['ou', ['AA', 'WU']], ['ow', ['OH', 'WU']], ['oa', ['OH']], ['oi', ['OH', 'II']], ['oy', ['OH', 'II']], ['au', ['OH']], ['aw', ['OH']],
  ['er', ['UH', 'RR']], ['ir', ['UH', 'RR']], ['ur', ['UH', 'RR']], ['ar', ['AA', 'RR']], ['or', ['OH', 'RR']],
];
const ONE = {
  a: ['AA'], e: ['EH'], i: ['II'], o: ['OH'], u: ['UH'], y: ['II'],
  b: ['PP'], p: ['PP'], m: ['PP'], f: ['FF'], v: ['FF'],
  t: ['DD'], d: ['DD'], n: ['DD'], l: ['DD'],
  s: ['SS'], z: ['SS'], c: ['KK'], k: ['KK'], g: ['KK'], q: ['KK'], h: ['KK'], x: ['KK', 'SS'],
  j: ['CH'], r: ['RR'], w: ['WU'],
};
// (a few short words are said differently from how they are written)
const WORDS = { the: ['TH', 'UH'], a: ['UH'], i: ['AA', 'II'], you: ['II', 'WU'], to: ['DD', 'WU'], do: ['DD', 'WU'], of: ['UH', 'FF'], one: ['WU', 'UH', 'DD'], are: ['AA', 'RR'], was: ['WU', 'UH', 'SS'] };
const DIGITS = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };

// the sounds of one word (lower case letters only)
function wordSounds(w) {
  if (WORDS[w]) return WORDS[w].slice();
  // a silent "e" at the end (make, gone, there), but not in short words (he, me, the)
  if (w.length > 3 && w.endsWith('e') && !/[aeiou]e$/.test(w)) w = w.slice(0, -1);
  const out = [];
  let i = 0;
  while (i < w.length) {
    // (the same letter twice is one sound: little, all, butter)
    if (i > 0 && w[i] === w[i - 1] && !/[aeiou]/.test(w[i])) { i++; continue; }
    let hit = null;
    for (const [g, s] of GROUPS) if (w.startsWith(g, i)) { hit = [g, s]; break; }
    if (hit) { out.push(...hit[1]); i += hit[0].length; continue; }
    const ch = w[i];
    // "c" and "g" are soft before e, i, y (city, gem)
    if (ch === 'c' && /[eiy]/.test(w[i + 1] || '')) out.push('SS');
    else if (ch === 'g' && /[eiy]/.test(w[i + 1] || '') && i > 0) out.push('CH');
    else if (ch === 'y' && i === 0) out.push('II');
    else if (ONE[ch]) out.push(...ONE[ch]);
    i++;
  }
  return out;
}

// text: the line as it is shown. seconds: how long it stays on screen.
// Returns { len (seconds of speaking), seg: [{ t0, t1, v (a VISEMES name) }], marks: [{ t, kind: 'stress' | 'question' | 'end' }] }
export function buildSpeech(text, seconds) {
  const seg = [], marks = [];
  let t = 0;
  const add = (v, len) => { seg.push({ t0: t, t1: t + len, v }); t += len; };
  // words and the marks between them, in order
  const tokens = String(text || '').replace(/[0-9]/g, (d) => ' ' + DIGITS[d] + ' ').match(/[A-Za-z']+|[.!?]+|[,;:]|…|—|-{2,}/g) || [];
  let sentenceStart = true;
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (/^[.!?…]+$/.test(tok) || tok === '—' || /^-+$/.test(tok)) {
      // the end of a sentence (or a broken-off one): the mouth closes, a breath
      const q = tok.includes('?');
      if (q) marks.push({ t: Math.max(0, t - 0.25), kind: 'question' });
      marks.push({ t, kind: 'end' });
      add('rest', tok === '—' || /^-+$/.test(tok) ? 0.2 : 0.34);
      sentenceStart = true;
      continue;
    }
    if (/^[,;:]$/.test(tok)) { add('rest', 0.2); continue; }
    const word = tok.toLowerCase().replace(/'/g, '');
    const sounds = wordSounds(word);
    if (!sounds.length) continue;
    // stressed: the first word of a sentence, a long word, a word in capitals, the word before "!"
    const next = tokens[k + 1] || '';
    const stressed = sentenceStart || word.length >= 7 || (tok.length > 1 && tok === tok.toUpperCase()) || next.includes('!');
    sentenceStart = false;
    let firstVowel = true;
    for (const v of sounds) {
      if (stressed && firstVowel && VOWEL.has(v)) { marks.push({ t, kind: 'stress' }); firstVowel = false; }
      // (a stressed vowel is said a little longer and more open)
      add(v, LEN[v] * (stressed && VOWEL.has(v) ? 1.25 : 1));
    }
    // (between words the mouth does not close: in fluent speech one word runs into the next. The last sound of the
    //  word only lasts a little longer)
    seg[seg.length - 1].t1 += 0.035; t += 0.035;
  }
  // the end: the mouth closes
  if (!seg.length) return { len: 0, seg: [], marks: [] };
  // stretch or squeeze to the time of the line: about the natural length, but never longer than the line stays
  const natural = t, want = seconds > 0 ? Math.min(seconds * 0.92, Math.max(natural, seconds * 0.55)) : natural;
  const k = want / natural;
  for (const s of seg) { s.t0 *= k; s.t1 *= k; }
  for (const m of marks) m.t *= k;
  return { len: want, seg, marks };
}

// The mouth at time t of a speech: fills "out" with { jaw, wide, press }. The shapes flow into each other: in the
// last part of a sound the mouth is already on its way to the next one, and the next one starts from half way
// (people move their lips ahead of the sound - it never jumps like a robot).
// i: where to start looking (the index of the sound found last time); returns the index for next time.
const smooth01 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function sampleSpeech(sp, t, out, i = 0) {
  const seg = sp.seg;
  if (!seg.length || t >= sp.len) { out.jaw = 0; out.wide = 0; out.press = 0; return seg.length; }
  if (i >= seg.length || seg[i].t0 > t) i = 0;
  while (i < seg.length - 1 && seg[i].t1 <= t) i++;
  const s = seg[i], cur = VISEMES[s.v];
  const prev = VISEMES[(seg[i - 1] || { v: 'rest' }).v], next = VISEMES[(seg[i + 1] || { v: 'rest' }).v];
  const u = (t - s.t0) / Math.max(1e-4, s.t1 - s.t0);
  // from the middle between the last shape and this one, to this one, and on to the middle toward the next one
  // (lips that close - m, b, p - close quickly: the start of that sound is short)
  let A = cur, B = cur, w = 0;
  const into = cur.press > 0.5 ? 0.18 : 0.35;
  if (u < into) { A = prev; B = cur; w = 0.5 + 0.5 * smooth01(u / into); }
  else if (u > 0.55) { A = cur; B = next; w = 0.5 * smooth01((u - 0.55) / 0.45); }
  out.jaw = A.jaw + (B.jaw - A.jaw) * w;
  out.wide = A.wide + (B.wide - A.wide) * w;
  out.press = A.press + (B.press - A.press) * w;
  return i;
}
