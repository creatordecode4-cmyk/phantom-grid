// ---------------------------------------------------------------------------
// music.js - music and background sound for the story, all made in code.
//
//   * THE MIXTAPE "DON'T SKIP": six short lo-fi tracks (soft drums, warm
//     keys, a bass, a few melody notes, tape hiss and a slow wobble).
//     Track 7 is empty: only the hiss of the tape. That is on purpose.
//   * TENSION: a quiet low pad with a slow pulse, for the chase.
//   * HEARTBEAT: two low thumps, again and again, before the limiter moment.
//   * AMBIENCE: rain, the hum of traffic, far sirens, waves near the beach.
//   * WANTED (Chapter 2): a faint low pulse that grows with the stars and goes
//     away while the player is hidden; the buzz of Guard drones overhead.
//   * VOICES WITHOUT WORDS: news speakers in the street, an old radio, the
//     loudspeaker of a drone. A voice is made of short syllables (a buzzing
//     tone through two moving filters), so it sounds like far-away speech.
//     What is said is shown as a subtitle.
//   * CALM: a soft, warm pad for the very last scene of Chapter 2.
//   * THE SUNK (Chapter 3): rain on tin roofs and old boats, water dripping,
//     water slapping against hulls, the murmur of the Tidewalker market far
//     away (it goes quiet when Nate comes close), and a low hum of old pumps.
//   * SILENCE: everything here can be cut to nothing for a moment.
//
// No sound files. Everything uses the audio system of sound.js and only
// starts after the player's first tap (browsers do not allow sound earlier).
// ---------------------------------------------------------------------------

// The six tracks. bpm: speed, root: lowest note (MIDI number), prog: the chords
// as [steps above the root, kind], seed: makes drums and melody different.
const TRACKS = [
  { name: 'SIDE A - 1', bpm: 74, root: 45, prog: [[0, 'm7'], [5, 'm7'], [8, 'M7'], [7, '7']], bars: 14, seed: 3 },
  { name: 'SIDE A - 2', bpm: 82, root: 48, prog: [[0, 'M7'], [9, 'm7'], [5, 'M7'], [7, '7']], bars: 14, seed: 11 },
  { name: 'SIDE A - 3', bpm: 68, root: 43, prog: [[0, 'm7'], [3, 'M7'], [10, 'M7'], [5, 'm7']], bars: 12, seed: 29 },
  { name: 'SIDE B - 4', bpm: 86, root: 50, prog: [[0, 'm7'], [7, 'm7'], [3, 'M7'], [10, '7']], bars: 16, seed: 41 },
  { name: 'SIDE B - 5', bpm: 78, root: 46, prog: [[0, 'M7'], [4, 'm7'], [9, 'm7'], [5, 'M7']], bars: 14, seed: 57 },
  { name: 'SIDE B - 6', bpm: 70, root: 41, prog: [[0, 'M7'], [9, 'm7'], [5, 'M7'], [0, 'M7']], bars: 12, seed: 73 },
];
const CHORD = { m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], 7: [0, 4, 7, 10] };
const PENTA = [0, 3, 5, 7, 10, 12, 15];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// a small repeatable random number: the same track always sounds the same
const rnd = (a, b, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

export function createMusic(sound) {
  let A = null;                 // { ctx, out, noiseBuf } from sound.js
  let tapeBus = null, tapeLp = null, hiss = null, padBus = null, pad = null, ambBus = null, amb = null;
  let wantBus = null, droneHum = null, voice = null, calmBus = null;
  const want = { track: 0, tension: 0, heart: 0, inCar: false, tapeVol: 1, stars: 0, hidden: false, chase: false, calm: 0, zero: 0 };
  let zeroNext = 0;
  let wantedNext = 0, voiceNext = 0, voiceLeft = 0, announceUntil = 0;
  const tape = { track: 0, bar: 0, step: 0, next: 0, startBar: 0, onEnd: null, ended: false };
  let heartNext = 0, pulseNext = 0, sirenNext = 20, silentUntil = 0, time = 0;
  const env = { rain: 0, city: 0.5, beach: 0, inCar: false, drone: 0, street: 0, radio: 0, sunk: 0, market: 0, tunnel: 0 };
  let sunkAmb = null, dripNext = 0, slapNext = 0, tinkNext = 0, crowdNext = 0;

  function ready() {
    if (A) return A.ctx.state === 'running';
    A = sound.audio;
    if (!A) return false;
    const c = A.ctx;
    // ---- tape player: everything goes through a low-pass (old cassette) ----
    tapeBus = c.createGain(); tapeBus.gain.value = 0;
    tapeLp = c.createBiquadFilter(); tapeLp.type = 'lowpass'; tapeLp.frequency.value = 3300; tapeLp.Q.value = 0.4;
    tapeLp.connect(tapeBus); tapeBus.connect(A.out);
    hiss = loopNoise('highpass', 3800, 0.3, tapeBus, 0);
    // ---- tension pad: three low tones through a slow moving filter ----
    padBus = c.createGain(); padBus.gain.value = 0; padBus.connect(A.out);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 3;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09; const depth = c.createGain(); depth.gain.value = 90;
    lfo.connect(depth); depth.connect(lp.frequency); lfo.start();
    for (const [f, type, g] of [[55, 'sawtooth', 0.5], [55.45, 'sawtooth', 0.5], [82.6, 'triangle', 0.35], [110.2, 'sine', 0.25]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const og = c.createGain(); og.gain.value = g; o.connect(og); og.connect(lp); o.start();
    }
    lp.connect(padBus);
    pad = { lp };
    // ---- ambience ----
    ambBus = c.createGain(); ambBus.gain.value = 1; ambBus.connect(A.out);
    amb = {
      rain: loopNoise('bandpass', 2600, 0.35, ambBus, 0), roof: loopNoise('lowpass', 420, 0.5, ambBus, 0),
      hum: loopNoise('lowpass', 110, 0.6, ambBus, 0), waves: loopNoise('bandpass', 520, 0.5, ambBus, 0),
    };
    // ---- wanted: the bus of the low pulse ----
    wantBus = c.createGain(); wantBus.gain.value = 0; wantBus.connect(A.out);
    // ---- the buzz of a drone: two tones a little apart, and the wind of its rotors ----
    {
      const g = c.createGain(); g.gain.value = 0; g.connect(ambBus);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 760; f.Q.value = 0.8; f.connect(g);
      for (const fr of [182, 187.5, 364]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const og = c.createGain(); og.gain.value = fr > 300 ? 0.25 : 0.5; o.connect(og); og.connect(f); o.start(); }
      const wash = loopNoise('bandpass', 420, 0.6, g, 0.6);
      droneHum = { g, wash };
    }
    // ---- a voice: a buzzing tone (the vocal cords) through two filters (the mouth) ----
    {
      const out = c.createGain(); out.gain.value = 0; out.connect(ambBus);
      const color = c.createBiquadFilter(); color.type = 'bandpass'; color.frequency.value = 1300; color.Q.value = 0.9; color.connect(out);
      const env2 = c.createGain(); env2.gain.value = 0; env2.connect(color);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.value = 600;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7; f2.frequency.value = 1500;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 135;
      o.connect(f1); o.connect(f2); f1.connect(env2); f2.connect(env2); o.start();
      const crackle = loopNoise('highpass', 5000, 0.4, out, 0);     // an old radio crackles a little
      voice = { out, color, env: env2, f1, f2, o, crackle };
    }
    // ---- THE SUNK: tin roofs in the rain, the crowd of the market, the hum of old pumps ----
    {
      const tin = loopNoise('bandpass', 4300, 2.2, ambBus, 0);
      const crowdG = c.createGain(); crowdG.gain.value = 0; crowdG.connect(ambBus);
      const crowdEnv = c.createGain(); crowdEnv.gain.value = 0.3; crowdEnv.connect(crowdG);
      const crowd = [loopNoise('bandpass', 650, 2.4, crowdEnv, 1), loopNoise('bandpass', 1450, 3, crowdEnv, 0.6)];
      const humG = c.createGain(); humG.gain.value = 0; humG.connect(ambBus);
      for (const [f, g] of [[46, 0.5], [46.6, 0.5], [92.3, 0.18]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = c.createGain(); og.gain.value = g; o.connect(og); og.connect(humG); o.start(); }
      sunkAmb = { tin, crowdG, crowdEnv, crowd, humG };
    }
    // ---- calm pad: a warm chord that breathes slowly ----
    {
      calmBus = c.createGain(); calmBus.gain.value = 0; calmBus.connect(A.out);
      const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 900; lp2.Q.value = 0.5; lp2.connect(calmBus);
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.06; const d2 = c.createGain(); d2.gain.value = 300; lfo2.connect(d2); d2.connect(lp2.frequency); lfo2.start();
      for (const m of [53, 57, 60, 64, 69]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m); o.detune.value = (m % 3) * 3; const og = c.createGain(); og.gain.value = 0.12; o.connect(og); og.connect(lp2); o.start(); }
    }
    return c.state === 'running';
  }
  // noise that never stops, through one filter, with its own volume
  function loopNoise(type, freq, q, dest, gain) {
    const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(dest); src.start(0, Math.random());
    return { g, f };
  }
  const glide = (p, v, t = 0.2) => p.setTargetAtTime(v, A.ctx.currentTime, t);

  // ---------------------------------------------------------------- single sounds
  // one tone with a soft start and end. wave: sine / triangle / sawtooth / square
  function tone(wave, freq, t, dur, gain, dest, attack = 0.01, wobble = 0) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = wave; o.frequency.value = freq;
    if (wobble) o.detune.value = Math.sin(t * 2.3) * wobble;         // the tape runs a tiny bit unevenly
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.35), t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(kind, t, gain, dest) {
    const c = A.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25);
      return;
    }
    const src = c.createBufferSource(); src.buffer = A.noiseBuf;
    const f = c.createBiquadFilter(), g = c.createGain();
    if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.7; } else { f.type = 'highpass'; f.frequency.value = 6500; }
    const len = kind === 'snare' ? 0.13 : 0.035;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, rnd(t, 1) * 0.8, len + 0.02);
  }

  // ---------------------------------------------------------------- the mixtape
  // One 16th-note step of a track is written into the audio clock a little ahead of time.
  function scheduleStep(T, bar, step, t) {
    const beat = 60 / T.bpm, s16 = beat / 4, d = tapeLp;
    const [off, kind] = T.prog[bar % T.prog.length], chord = CHORD[kind], root = T.root + off;
    const last = bar >= T.bars - 1;                       // the last bar of a track thins out
    // drums: kick on 1 and somewhere before 3, snare on 2 and 4, soft hats
    if (step === 0 || (step === 10 && rnd(T.seed, bar) > 0.35) || (step === 7 && rnd(T.seed, bar, 2) > 0.7)) drum('kick', t, 0.55, d);
    if ((step === 4 || step === 12) && !last) drum('snare', t + 0.012, 0.2, d);
    if (step % 2 === 0 && !last) drum('hat', t + (step % 4 === 2 ? s16 * 0.3 : 0), 0.05 + 0.03 * rnd(T.seed, bar, step), d);
    // keys: the chord at the start of the bar, sometimes again on the "and" of 2
    if (step === 0 || (step === 6 && rnd(T.seed, bar, 5) > 0.5 && !last)) {
      const long = step === 0 ? beat * 3.2 : beat * 1.4;
      chord.forEach((n, i) => { tone('triangle', hz(root + 12 + n), t + i * 0.012, long, 0.05, d, 0.02, 7); tone('sine', hz(root + 24 + n), t + i * 0.012, long * 0.7, 0.018, d, 0.02, 7); });
    }
    // bass: the root on 1, a short note before 3
    if (step === 0) tone('sine', hz(root), t, beat * 1.6, 0.26, d, 0.015);
    if (step === 10 && !last) tone('sine', hz(root + (rnd(T.seed, bar, 9) > 0.5 ? 7 : 0)), t, beat * 0.8, 0.2, d, 0.015);
    // melody: a few notes of the scale, different in every bar but always the same for this track
    if (step % 2 === 0 && rnd(T.seed, bar * 16 + step, 3) > 0.74 && !last) {
      const n = PENTA[Math.floor(rnd(T.seed, bar * 16 + step, 4) * PENTA.length)];
      tone('triangle', hz(T.root + 24 + n), t, beat * (0.8 + rnd(T.seed, step, bar)), 0.045, d, 0.03, 9);
    }
  }
  function runTape(now) {
    if (tape.track !== want.track) {
      // another track: a short "clunk" and a tiny pause, like pressing the button of a tape deck
      if (tape.track > 0 || want.track > 0) sound.burst(700, 1.2, 0.12, 0.002, 0.06);
      tape.track = want.track; tape.bar = tape.startBar; tape.step = 0; tape.next = now + 0.35; tape.ended = false;
      tape.startBar = 0;
    }
    const T = TRACKS[tape.track - 1];
    if (!T || tape.ended) return;           // track 7 (and "off"): nothing is played
    const s16 = 60 / T.bpm / 4;
    while (tape.next < now + 0.25) {
      // swing: every second 16th comes a little late
      scheduleStep(T, tape.bar, tape.step, tape.next + (tape.step % 2 ? s16 * 0.16 : 0));
      tape.next += s16;
      if (++tape.step >= 16) {
        tape.step = 0;
        if (++tape.bar >= T.bars) { tape.ended = true; const cb = tape.onEnd; if (cb) setTimeout(() => cb(tape.track), Math.max(0, (tape.next - now) * 1000 + 900)); break; }
      }
    }
  }

  // ---------------------------------------------------------------- every frame
  // e: { rain 0..1, city 0..1 (how much traffic is around), beach 0..1 (how near the sea), inCar }
  function update(dt, e = null) {
    time += dt;
    if (e) Object.assign(env, e);
    if (!ready()) return;
    const c = A.ctx, now = c.currentTime;
    const quiet = now < silentUntil ? 0 : 1;
    // the tape: quieter and duller when you are not in the car with it
    glide(tapeBus.gain, want.track > 0 ? 0.5 * want.tapeVol * quiet * (want.inCar ? 1 : 0.35) : 0, 0.12);
    glide(tapeLp.frequency, want.inCar ? 3300 : 900, 0.2);
    glide(hiss.g.gain, want.track > 0 ? 0.02 : 0, 0.3);
    runTape(now);
    // tension pad and its slow pulse
    glide(padBus.gain, want.tension * 0.11 * quiet, 0.6);
    if (want.tension > 0.45 && quiet && now > pulseNext) { pulseNext = now + 0.62; drumLow(now + 0.02, 0.1 * want.tension); }
    // heartbeat: lub - dub
    if (want.heart > 0 && quiet && now > heartNext) {
      heartNext = now + 60 / want.heart;
      drumLow(now + 0.02, 0.5); drumLow(now + 0.26, 0.3);
    }
    // ZERO is near (Chapter 4): a faint, deep heartbeat under everything - slow, calm, never stopping
    if (want.zero > 0.02 && quiet && now > zeroNext) {
      zeroNext = now + 60 / 52;
      drumLow(now + 0.02, 0.22 * want.zero); drumLow(now + 0.3, 0.13 * want.zero);
    }
    // ambience
    const inCar = env.inCar ? 1 : 0;
    glide(amb.rain.g.gain, env.rain * (inCar ? 0.02 : 0.05) * quiet, 0.4);
    glide(amb.roof.g.gain, env.rain * inCar * 0.09 * quiet, 0.4);
    glide(amb.hum.g.gain, env.city * 0.1 * quiet, 0.8);
    glide(amb.waves.g.gain, env.beach * (0.035 + 0.03 * Math.sin(time * 0.75) + 0.012 * Math.sin(time * 0.31)) * quiet, 0.25);
    // ---- wanted: a low pulse, faster and a little louder with every star, gone while hidden ----
    const wantLevel = want.stars > 0 && !want.hidden ? 0.35 + want.stars * 0.13 + (want.chase ? 0.15 : 0) : 0;
    glide(wantBus.gain, wantLevel * quiet, want.hidden ? 1.2 : 0.5);
    if (wantLevel > 0 && quiet && now > wantedNext) {
      const bpm = 64 + want.stars * 9 + (want.chase ? 10 : 0);
      wantedNext = now + 60 / bpm;
      pulseTo(now + 0.02, 0.16, wantBus);
      if (want.stars >= 3) tone('sine', hz(31 + (want.stars >= 4 ? 1 : 0)), now + 0.02, 0.5, 0.05, wantBus, 0.03);
    }
    // ---- a drone overhead ----
    glide(droneHum.g.gain, env.drone * 0.03 * quiet, 0.3);
    // ---- voices: the drone's loudspeaker first, then a radio close by, then the news speakers of the street ----
    const pa = now < announceUntil;
    const vLevel = pa ? 0.11 : env.radio > 0.02 ? env.radio * 0.05 : env.street * 0.022;
    glide(voice.out.gain, vLevel * quiet, 0.25);
    glide(voice.color.frequency, pa ? 1500 : env.radio > 0.02 ? 1100 : 1300, 0.2);
    glide(voice.color.Q, pa ? 2.2 : 0.9, 0.2);
    glide(voice.crackle.g.gain, env.radio > 0.02 && !pa ? env.radio * 0.004 : 0, 0.3);
    if (vLevel > 0.001) runVoice(now, pa);
    // ---- THE SUNK ----
    if (sunkAmb) {
      const k = env.sunk * quiet, out = inCar ? 0.6 : 1;
      glide(sunkAmb.tin.g.gain, env.rain * k * 0.03 * out, 0.5);
      glide(sunkAmb.humG.gain, (k * 0.012 + env.tunnel * 0.02) * quiet, 1.2);
      glide(sunkAmb.crowdG.gain, env.market * 0.05 * quiet, 1.6);
      // the crowd: syllables of many people, no words (louder and softer in turns)
      if (env.market > 0.01 && now > crowdNext) {
        crowdNext = now + 0.12 + Math.random() * 0.2;
        sunkAmb.crowdEnv.gain.setTargetAtTime(0.25 + Math.random() * 0.75, now, 0.06);
        sunkAmb.crowd[0].f.frequency.setTargetAtTime(480 + Math.random() * 420, now, 0.05);
        sunkAmb.crowd[1].f.frequency.setTargetAtTime(1100 + Math.random() * 900, now, 0.05);
      }
      // water dripping (much more in the tunnel), a hollow tink of rain on a can, water slapping a hull
      if ((k > 0.05 || env.tunnel > 0.05) && now > dripNext) {
        dripNext = now + (env.tunnel > 0.3 ? 0.25 : 0.9) + Math.random() * (env.tunnel > 0.3 ? 0.9 : 2.6);
        const f = 900 + Math.random() * 1100;
        const c2 = A.ctx, o = c2.createOscillator(), g = c2.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * 1.9, now + 0.05);
        g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime((0.012 + env.tunnel * 0.02) * out, now + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16 + env.tunnel * 0.3);
        o.connect(g); g.connect(ambBus); o.start(now); o.stop(now + 0.5);
      }
      if (k > 0.05 && env.rain > 0.2 && now > tinkNext) {
        tinkNext = now + 0.08 + Math.random() * 0.5;
        tone('triangle', 2600 + Math.random() * 1800, now, 0.05, 0.004 * k * out, ambBus, 0.002);
      }
      if (k > 0.05 && now > slapNext) {
        slapNext = now + 1.1 + Math.random() * 2.8;
        const c2 = A.ctx, src = c2.createBufferSource(), f = c2.createBiquadFilter(), g = c2.createGain();
        src.buffer = A.noiseBuf; f.type = 'lowpass'; f.frequency.value = 260 + Math.random() * 260; f.Q.value = 1.4;
        g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.05 * k * out, now + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        src.connect(f); f.connect(g); g.connect(ambBus); src.start(now, Math.random()); src.stop(now + 0.4);
      }
    }
    // ---- the calm pad of the last scene ----
    glide(calmBus.gain, want.calm * 0.05 * quiet, 2.5);
    // a siren far away, now and then (never while a real one is close: that is sound.js)
    sirenNext -= dt;
    if (sirenNext <= 0 && env.city > 0.2 && quiet) {
      sirenNext = 28 + Math.random() * 40;
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 900;
      for (let i = 0; i < 5; i++) { o.frequency.setValueAtTime(620, now + i); o.frequency.linearRampToValueAtTime(880, now + i + 0.5); o.frequency.linearRampToValueAtTime(620, now + i + 1); }
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.012, now + 1.2); g.gain.linearRampToValueAtTime(0.0001, now + 5);
      o.connect(f); f.connect(g); g.connect(ambBus); o.start(now); o.stop(now + 5.1);
    }
  }
  // the syllables of a voice, written into the audio clock a little ahead of time
  function runVoice(now, pa) {
    if (voiceNext < now) voiceNext = now + 0.05;
    while (voiceNext < now + 0.3) {
      const t = voiceNext;
      if (voiceLeft <= 0) {
        // a pause between two sentences, then a new sentence of 5 .. 14 syllables
        voiceLeft = 5 + Math.floor(Math.random() * 10);
        voiceNext += 0.35 + Math.random() * 0.6;
        continue;
      }
      voiceLeft--;
      const len = 0.08 + Math.random() * 0.12, open = 0.55 + Math.random() * 0.45;
      // (each syllable is a different vowel: the two filters move; the pitch falls a little toward the end of a sentence)
      voice.f1.frequency.setValueAtTime(350 + Math.random() * 450, t);
      voice.f2.frequency.setValueAtTime(1000 + Math.random() * 1300, t);
      voice.o.frequency.setValueAtTime((pa ? 150 : 128) + Math.random() * 18 - (voiceLeft < 2 ? 12 : 0), t);
      voice.env.gain.setValueAtTime(0.0001, t);
      voice.env.gain.linearRampToValueAtTime(open, t + len * 0.25);
      voice.env.gain.linearRampToValueAtTime(0.0001, t + len);
      voiceNext += len + 0.015 + (Math.random() < 0.18 ? 0.09 : 0);
    }
  }
  // one beat of the wanted pulse: a soft low thump into the given bus
  function pulseTo(t, gain, dest) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
  }
  // a soft, very low thump
  function drumLow(t, gain) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(64, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(A.out); o.start(t); o.stop(t + 0.22);
  }

  return {
    update, TRACKS,
    // ---- the mixtape ----
    // n: 1..6 = a track, 7 = the empty track (only tape hiss), 0 = stop. fromEnd: start this many seconds before the end.
    playTape(n, opts = {}) {
      want.track = n;
      const T = TRACKS[n - 1];
      tape.startBar = T && opts.fromEnd ? Math.max(0, T.bars - Math.ceil(opts.fromEnd / (240 / T.bpm))) : 0;
      tape.onEnd = opts.onEnd || null;
      if (tape.track === n) tape.track = -1;     // (asked for the same track again: start it again)
    },
    stopTape() { want.track = 0; tape.onEnd = null; },
    get track() { return want.track; },
    get trackName() { return want.track === 7 ? 'SIDE B - 7' : TRACKS[want.track - 1] ? TRACKS[want.track - 1].name : ''; },
    // how far the playing track is (0..1), for the little tape display
    get progress() { const T = TRACKS[tape.track - 1]; return T ? Math.min(1, (tape.bar + tape.step / 16) / T.bars) : 0; },
    setInCar(v) { want.inCar = !!v; },
    setTapeVolume(v) { want.tapeVol = v; },
    // ---- chase pad (0..1) and heartbeat (beats per minute, 0 = off) ----
    setTension(v) { want.tension = v; },
    setHeartbeat(bpm) { want.heart = bpm; },
    // Zero behind the player (src/ai/zero.js): 0 = gone .. 1 = close
    setZero(v) { want.zero = Math.max(0, Math.min(1, v)); },
    // ---- wanted (Chapter 2): stars 0..5, hidden: the pulse fades away, chase: somebody sees the player ----
    setWanted(stars, hidden = false, chase = false) { want.stars = stars; want.hidden = !!hidden; want.chase = !!chase; },
    // the loudspeaker of a drone: a two-tone call, then a few seconds of speech
    announce(seconds = 3.6) {
      if (!ready()) return;
      const now = A.ctx.currentTime;
      tone('sine', 988, now, 0.35, 0.05, ambBus, 0.01); tone('sine', 784, now + 0.32, 0.5, 0.05, ambBus, 0.01);
      announceUntil = now + 0.8 + seconds; voiceNext = now + 0.85; voiceLeft = 0;
    },
    // the soft pad of the last scene (0 = off .. 1)
    setCalm(v) { want.calm = v; },
    // ---- everything silent for a moment (seconds) ----
    silence(seconds) { if (ready()) { silentUntil = A.ctx.currentTime + seconds; for (const b of [tapeBus, padBus]) b.gain.setTargetAtTime(0, A.ctx.currentTime, 0.015); } },
    // stop all story sound (leaving the story)
    reset() { want.track = 0; want.tension = 0; want.heart = 0; want.stars = 0; want.calm = 0; want.zero = 0; tape.onEnd = null; },
  };
}
