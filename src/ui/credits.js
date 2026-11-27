// ---------------------------------------------------------------------------
// credits.js - THE CREDITS at the end of the story: a simple list that scrolls up the screen.
//
// EDIT THIS LIST FREELY: put your own name, the people who helped, the people who played it first. Every entry is
// one of:
//   { big: 'TEXT' }            the game's name, large
//   { head: 'TEXT' }           a small heading (letter-spaced, gold)
//   { line: 'TEXT' }           a line of text
//   { gap: true }              some empty space
// No recorded music is in the game: the mixtape and every sound are made in code (src/audio/music.js, sound.js).
// ---------------------------------------------------------------------------

export const CREDITS = [
  { big: 'PHANTOM GRID' },
  { line: 'Made with love' },
  { gap: true },
  { head: 'STORY, CITY AND CODE' },
  { line: 'The Phantom Grid team' },
  { gap: true },
  { head: 'THE PEOPLE OF PORT MERIDIAN' },
  { line: 'Nate Calloway' },
  { line: 'Theo Calloway' },
  { line: 'Lena Marchetti' },
  { line: 'Mace Doyle' },
  { line: 'Dante Rios' },
  { line: 'Viktor Rask' },
  { line: 'Sloane Harrow' },
  { line: 'Juno Kade' },
  { line: 'Adrian Vance' },
  { gap: true },
  { head: 'THE MIXTAPE "DON\'T SKIP"' },
  { line: 'Six tracks and one empty one, made in code, note by note' },
  { line: 'No recorded music was used' },
  { gap: true },
  { head: 'BUILT WITH' },
  { line: 'three.js and a lot of rain' },
  { gap: true },
  { head: 'TESTED ON' },
  { line: 'Phones, in the dark, late at night' },
  { gap: true },
  { gap: true },
  { line: 'Thank you for playing.' },
  { line: 'Drive slow.' },
];

// Fill a node with the list and let it scroll from the bottom of the screen to above the top.
// seconds: how long the roll takes. onDone() when it is over (or when it was tapped twice).
export function rollCredits(node, list = CREDITS, seconds = 34, onDone = null) {
  node.textContent = '';
  const roll = document.createElement('div');
  roll.className = 'roll';
  for (const c of list) {
    const d = document.createElement('div');
    if (c.big) { d.className = 'c-big'; d.textContent = c.big; }
    else if (c.head) { d.className = 'c-head'; d.textContent = c.head; }
    else if (c.gap) d.className = 'c-gap';
    else { d.className = 'c-line'; d.textContent = c.line || ''; }
    roll.appendChild(d);
  }
  node.appendChild(roll);
  let done = false, taps = 0;
  const finish = () => { if (done) return; done = true; if (onDone) onDone(); };
  // (the roll moves by a CSS animation: smooth on a phone, no work for the game)
  roll.style.animation = `creditsUp ${seconds}s linear forwards`;
  roll.addEventListener('animationend', finish);
  // two taps: skip to the end
  node.addEventListener('pointerdown', () => { if (++taps >= 2) finish(); });
  return { stop: finish };
}
