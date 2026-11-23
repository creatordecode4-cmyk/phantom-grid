// ---------------------------------------------------------------------------
// sound.js - all sounds are MADE IN CODE with the Web Audio API.
// There are no sound files (and so nothing with a copyright).
//
// RUNNING SOUNDS (always there, their volume and pitch change):
//   engine   two tones + a filter; pitch and volume follow the engine speed
//            and the gas pedal. Every vehicle has its own "tone".
//   screech  tire hiss while sliding        wind   grows with speed
//   road     rumble that changes with the ground   siren, horn, scrape, squeal
// SHORT SOUNDS: gear click, turbo whoosh, crash (light scrape or heavy hit),
//   suspension thump, indicator tick, door, footsteps, engine start, chime
// CHAPTER 2: the beep of a scanner gate (and its alarm), a phone ringing,
//   a paint spray can, a roller shutter going up or down
// CHAPTER 4 (races): the murmur of a crowd and its cheers (many voices = noise in a few bands that swell,
//   and whistles), the engines of the two nearest other cars (each with its own tone; the pitch rises as
//   one comes closer and falls as it goes away)
// INSIDE THE CAR everything is muffled: more engine, less wind and tires.
//
// Browsers only allow sound after the first tap or key press, so nothing
// plays before "unlock()" was called from such an event.
// ---------------------------------------------------------------------------

// how each engine sounds: base pitch (Hz), how much it rises, wave shapes, filter, loudness
const TONES = {
  light: { f0: 62, f1: 190, w1: 'sawtooth', w2: 'triangle', mix: 0.35, lp: 1500, vol: 0.8 },
  smooth: { f0: 50, f1: 150, w1: 'sawtooth', w2: 'triangle', mix: 0.5, lp: 1300, vol: 0.9 },
  muscle: { f0: 42, f1: 140, w1: 'sawtooth', w2: 'square', mix: 0.45, lp: 1250, vol: 1.05 },
  rumble: { f0: 30, f1: 85, w1: 'sawtooth', w2: 'square', mix: 0.6, lp: 700, vol: 1.2 },
  sharp: { f0: 46, f1: 215, w1: 'sawtooth', w2: 'sawtooth', mix: 0.55, lp: 2600, vol: 1.1 },
  boat: { f0: 34, f1: 70, w1: 'sawtooth', w2: 'square', mix: 0.7, lp: 520, vol: 1.2 },
  // Mace's old boat (Chapter 3): a rough, knocking outboard motor
  rusty: { f0: 27, f1: 58, w1: 'square', w2: 'sawtooth', mix: 0.9, lp: 760, vol: 1.4, rough: 0.07 },
  drone: { f0: 150, f1: 210, w1: 'triangle', w2: 'sawtooth', mix: 0.3, lp: 2200, vol: 0.55 },
};

export function createSound() {
  let ctx = null, master = null, out = null, inside = null, noiseBuf = null;
  let engine = null, screech = null, horn = null, wind = null, road = null, siren = null, scrape = null, squeal = null, spray = null;
  let crowdN = null, crowdHi = null;
  const rivalV = [];
  let muted = false, tone = TONES.smooth, isInside = false;
  let volume = 1;           // 0..1, the volume slider in the settings
  let held = false;         // true while the game is paused: all sound stands still

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended' && !held) ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 0.8 * volume;
    out.connect(ctx.destination);
    // "inside the car" filter: everything outside passes through it
    inside = ctx.createBiquadFilter(); inside.type = 'lowpass'; inside.frequency.value = 20000;
    inside.connect(out);
    master = inside;
    // one second of random noise, used by many sounds
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (type, freq, q, dest = master) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(dest); src.start();
      return { g, f };
    };

    // ---- engine: two tones through a low-pass filter (goes straight to the output: inside it stays loud) ----
    {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.2;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 110;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
      o1.start(); o2.start();
      engine = { g, lp, o1, o2, g2 };
    }
    screech = noise('bandpass', 1500, 5);
    wind = noise('lowpass', 500, 0.4);
    road = noise('lowpass', 160, 0.7);
    scrape = noise('bandpass', 2600, 2.5);
    // ---- horn: two tones a little apart ----
    {
      const hg = ctx.createGain(); hg.gain.value = 0;
      const h1 = ctx.createOscillator(); h1.type = 'square'; h1.frequency.value = 415;
      const h2 = ctx.createOscillator(); h2.type = 'square'; h2.frequency.value = 520;
      const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 2200;
      h1.connect(hlp); h2.connect(hlp); hlp.connect(hg); hg.connect(master); h1.start(); h2.start();
      horn = { g: hg };
    }
    // ---- siren: one tone that sweeps up and down (a slow wave moves its pitch) ----
    {
      const g = ctx.createGain(); g.gain.value = 0;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55;
      const depth = ctx.createGain(); depth.gain.value = 330;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      lfo.connect(depth); depth.connect(o.frequency); o.connect(lp); lp.connect(g); g.connect(master); o.start(); lfo.start();
      siren = { g };
    }
    // ---- a can of paint: a steady hiss while the button is held ----
    spray = noise('highpass', 3400, 0.6);
    // ---- brake squeal: a thin high tone ----
    {
      const g = ctx.createGain(); g.gain.value = 0;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
      o.connect(g); g.connect(master); o.start();
      squeal = { g };
    }
    // ---- a crowd: a low murmur of many voices, and a brighter layer for the excitement ----
    crowdN = noise('bandpass', 620, 0.7);
    crowdHi = noise('bandpass', 1650, 1.4);
    // ---- the engines of two other cars (races): two tones + a filter each, like the player's engine ----
    for (let i = 0; i < 2; i++) {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 1;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 120;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
      o1.start(); o2.start();
      rivalV.push({ g, lp, o1, o2, g2, tone: '' });
    }
  }
  // change a value smoothly (no clicks)
  const glide = (param, value, time = 0.06) => { if (ctx) param.setTargetAtTime(value, ctx.currentTime, time); };
  const live = () => ctx && ctx.state === 'running';

  // one short burst of filtered noise
  function burst(freq, q, gain, attack, decay, type = 'bandpass', dest = master) {
    if (!live()) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + attack + decay);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.8, attack + decay + 0.05);
  }
  // one short tone that glides from f0 to f1
  function blip(type, f0, f1, gain, time, dest = master) {
    if (!live()) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + time);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + time);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + time + 0.05);
  }

  return {
    unlock,
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = m; if (out) glide(out.gain, m ? 0 : 0.8 * volume, 0.05); },
    // the volume slider: 0 = silent .. 1 = full
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (out && !muted) glide(out.gain, 0.8 * volume, 0.05); },
    get volume() { return volume; },
    // the game is paused: every sound stops where it is, and goes on later
    pause(on) {
      held = !!on;
      if (!ctx) return;
      if (held && ctx.state === 'running') ctx.suspend().catch(() => {});
      else if (!held && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    // everything silent for a moment, then back (story: the second after the limiter is switched off)
    duck(seconds = 1) {
      if (!out || muted) return;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0.0001, t, 0.02);
      out.gain.setTargetAtTime(0.8 * volume, t + seconds, 0.1);
    },
    // for music.js: the audio system itself (null until the first tap has switched the sound on)
    get audio() { return ctx ? { ctx, out, master, noiseBuf } : null; },
    burst, blip,
    // two short honks, one right after the other (story: the way Theo always honked)
    honkTwice(vol = 0.7) { this.honk(vol); setTimeout(() => this.honk(vol), 300); },
    // a rifle shot far away: a sharp crack, a low thump and an echo
    shot() { burst(2600, 0.5, 0.5, 0.001, 0.09, 'highpass'); burst(180, 0.7, 0.6, 0.002, 0.3, 'lowpass'); setTimeout(() => burst(900, 0.6, 0.12, 0.01, 0.5), 260); setTimeout(() => burst(600, 0.6, 0.05, 0.02, 0.7), 620); },
    // WREN speaks: two very soft high notes
    wren() { blip('sine', 1320, 1320, 0.035, 0.22); setTimeout(() => blip('sine', 1760, 1760, 0.03, 0.3), 110); },
    get muted() { return muted; },
    // which engine: light | smooth | muscle | rumble | sharp | boat | drone
    setTone(name) {
      tone = TONES[name] || TONES.smooth;
      if (!engine) return;
      engine.o1.type = tone.w1; engine.o2.type = tone.w2;
      glide(engine.g2.gain, tone.mix, 0.05);
    },
    // rev: 0..1 engine speed, load: 0..1 how hard the driver pushes, on: is the engine running,
    // loud: 1 = normal (the quiet motor of a boat: less)
    setEngine(on, rev = 0, load = 0, loud = 1) {
      if (!engine) return;
      // (an old motor does not run evenly: its pitch shakes a little)
      const f = (tone.f0 + rev * (tone.f1 - tone.f0)) * (tone.rough ? 1 + (Math.random() - 0.5) * tone.rough : 1);
      glide(engine.o1.frequency, f, 0.04);
      glide(engine.o2.frequency, f * 2.01, 0.04);
      glide(engine.lp.frequency, tone.lp * (0.25 + rev * 0.75 + load * 0.45), 0.07);
      glide(engine.g.gain, on ? (0.055 + 0.085 * load + 0.05 * rev) * tone.vol * loud * (isInside ? 1.25 : 1) : 0, 0.1);
    },
    // amount: 0..1 how much the tires slide
    setScreech(amount) {
      if (!screech) return;
      glide(screech.g.gain, Math.min(0.26, amount * 0.3), 0.07);
      glide(screech.f.frequency, 1250 + amount * 700, 0.1);
    },
    // speed: 0..1 of a fast car
    setWind(speed) { if (wind) { glide(wind.g.gain, speed * speed * 0.22, 0.2); glide(wind.f.frequency, 300 + speed * 900, 0.2); } },
    // amount 0..1, surface: road | wet | sand | walk
    setRoad(amount, surface = 'road') {
      if (!road) return;
      const f = surface === 'sand' ? 420 : surface === 'wet' ? 900 : surface === 'walk' ? 260 : 150;
      glide(road.f.frequency, f, 0.15);
      glide(road.g.gain, amount * (surface === 'road' ? 0.2 : 0.3), 0.12);
    },
    setScrape(on) { if (scrape) glide(scrape.g.gain, on ? 0.16 : 0, 0.04); },
    setSqueal(on) { if (squeal) glide(squeal.g.gain, on ? 0.018 : 0, 0.08); },
    setHorn(on) { if (horn) glide(horn.g.gain, on ? 0.16 : 0, 0.015); },
    setSiren(on) { if (siren) glide(siren.g.gain, on ? 0.07 : 0, 0.08); },
    // inside the car: outside sounds are muffled
    setInside(v) { isInside = v; if (inside) glide(inside.frequency, v ? 850 : 20000, 0.15); },
    // a horn of another car somewhere near (volume 0..1 by distance)
    honk(volume = 0.5) { blip('square', 440, 430, 0.07 * volume, 0.35); blip('square', 550, 540, 0.06 * volume, 0.35); },
    shiftClick() { burst(1800, 2, 0.1, 0.002, 0.04); blip('sine', 120, 70, 0.1, 0.08); },
    turbo() { burst(3200, 1.2, 0.09, 0.02, 0.32, 'highpass'); },
    nitro() { burst(900, 0.6, 0.25, 0.03, 0.6, 'bandpass'); },
    tick() { burst(2400, 4, 0.07, 0.001, 0.025); },
    // suspension bump, strength 0..1
    thump(strength) { blip('sine', 80, 40, 0.3 * Math.min(1, Math.max(0.2, strength)), 0.16); burst(200, 0.8, 0.2 * strength, 0.004, 0.1, 'lowpass'); },
    // a crash. kind 'scrape' = light touch, 'heavy' = hard hit. strength 0..1
    crash(kind, strength) {
      if (!live()) return;
      const s = Math.min(1, Math.max(0.15, strength));
      if (kind === 'scrape') { burst(2600, 2.5, 0.22 * s, 0.005, 0.2); burst(300, 0.8, 0.25 * s, 0.004, 0.12, 'lowpass'); return; }
      burst(160, 0.7, 1.0 * s, 0.004, 0.3, 'lowpass');
      burst(2400, 1.2, 0.4 * s, 0.002, 0.14);
      burst(5200, 1.5, 0.22 * s, 0.01, 0.45, 'highpass');       // glass and small bits
      blip('sine', 95, 34, 0.6 * s, 0.3);
    },
    thud(strength) { this.crash('heavy', strength); },
    // engine start: starter whine, then the engine catches
    startEngine() { blip('sawtooth', 190, 320, 0.07, 0.45, out || master); setTimeout(() => burst(220, 0.9, 0.3, 0.02, 0.35, 'lowpass', out || master), 380); },
    // surface: 'concrete' or 'sand'
    footstep(surface, running = false) {
      const k = running ? 1.25 : 1;
      if (surface === 'sand') burst(650, 0.5, 0.11 * k, 0.012, 0.16, 'lowpass');
      // wading: the leg pushing through the water
      else if (surface === 'water') { burst(700 + Math.random() * 200, 1, 0.08 * k, 0.02, 0.2); burst(2200, 1.2, 0.025 * k, 0.03, 0.18); }
      // wet boards of a pontoon (The Sunk): a hollow knock and a little splash
      else if (surface === 'wood') { burst(420 + Math.random() * 80, 2.5, 0.1 * k, 0.002, 0.07, 'lowpass'); burst(2400, 1.2, 0.025 * k, 0.004, 0.08); }
      else { burst(1900 + Math.random() * 500, 1.6, 0.075 * k, 0.002, 0.045); burst(240, 0.8, 0.09 * k, 0.003, 0.06, 'lowpass'); }
    },
    // ---- races (Chapter 4) ----
    // the murmur of a crowd: 0 = nobody .. 1 = right among them
    crowd(level) {
      if (!crowdN) return;
      const k = Math.max(0, Math.min(1, level));
      glide(crowdN.g.gain, k * 0.1, 0.3); glide(crowdN.f.frequency, 520 + k * 300, 0.4);
      glide(crowdHi.g.gain, k * k * 0.03, 0.3);
    },
    // a cheer: the voices swell and fall in a second and a half, a few whistles on top
    cheer(k = 1) {
      if (!live()) return;
      const v = Math.max(0.2, Math.min(1, k));
      burst(700, 0.6, 0.16 * v, 0.25, 1.3);
      burst(1400, 0.9, 0.08 * v, 0.3, 1.1);
      burst(2600, 1.3, 0.035 * v, 0.35, 0.9);
      for (let i = 0; i < 3; i++) if (Math.random() < 0.6) setTimeout(() => blip('sine', 1800 + Math.random() * 900, 2400 + Math.random() * 900, 0.025 * v, 0.35), 120 + Math.random() * 700);
    },
    // the engines of the nearest other cars: [{ d (meters), rpm, gas, tone, closing (m/s, + = coming nearer) }]
    rivals(list) {
      for (let i = 0; i < rivalV.length; i++) {
        const R = rivalV[i], r = list[i];
        if (!r) { glide(R.g.gain, 0, 0.25); continue; }
        const T = TONES[r.tone] || TONES.smooth;
        if (R.tone !== r.tone) { R.tone = r.tone; R.o1.type = T.w1; R.o2.type = T.w2; R.g2.gain.value = T.mix; }
        const n = Math.max(0, Math.min(1, (r.rpm - 900) / 6300));
        // (a car coming closer sounds higher, one going away lower - like on a real roadside)
        const dop = Math.max(0.82, Math.min(1.2, 1 + (r.closing || 0) / 120));
        const f = (T.f0 + (T.f1 - T.f0) * n) * dop;
        glide(R.o1.frequency, f, 0.05); glide(R.o2.frequency, f * 2, 0.05);
        glide(R.lp.frequency, T.lp * (0.45 + 0.55 * (r.gas || 0)) * (0.6 + 0.4 * n), 0.08);
        const vol = 0.11 * T.vol * (0.45 + 0.55 * (r.gas || 0)) / (1 + (r.d * r.d) / 220);
        glide(R.g.gain, vol, 0.08);
      }
    },
    // ---- water (swimming) ----
    // one stroke of an arm: a soft slap and the water running off it (treading water: only a little lap)
    stroke(strong = true) {
      const k = strong ? 1 : 0.45;
      burst(900 + Math.random() * 300, 1.1, 0.07 * k, 0.006, 0.14);
      burst(2600 + Math.random() * 600, 1.4, 0.03 * k, 0.02, 0.22);
    },
    // into the water (or out of it): a heavy splash. big: a jump in; small: standing up or climbing out
    splash(big = true) {
      const k = big ? 1 : 0.5;
      burst(420, 0.9, 0.26 * k, 0.004, 0.32, 'lowpass');
      burst(1500, 0.9, 0.12 * k, 0.01, 0.45);
      burst(4200, 1.2, 0.05 * k, 0.03, 0.6, 'highpass');
    },
    // door: 'open' = a click and a soft creak, 'close' = a dull slam
    doorClick(kind = 'close') {
      if (kind === 'open') { burst(1400, 1.5, 0.14, 0.002, 0.05); burst(500, 3, 0.05, 0.03, 0.18); }
      else { burst(900, 1.0, 0.16, 0.002, 0.07); burst(150, 0.8, 0.3, 0.003, 0.12, 'lowpass'); }
    },
    chime() { blip('sine', 660, 660, 0.12, 0.4); setTimeout(() => blip('sine', 880, 880, 0.12, 0.4), 120); },
    // ---- Chapter 2 ----
    // a scanner gate reads a plate that is not wanted: two quiet beeps
    scanBeep() { blip('sine', 1500, 1500, 0.03, 0.06); setTimeout(() => blip('sine', 1900, 1900, 0.03, 0.08), 90); },
    // ... and one that IS wanted: a hard two-tone alarm
    scanAlarm() { for (let i = 0; i < 4; i++) setTimeout(() => { blip('square', 720, 720, 0.045, 0.16); setTimeout(() => blip('square', 960, 960, 0.045, 0.16), 170); }, i * 340); },
    // a phone ringing (a soft, modern trill), "times" rings
    ring(times = 2) { for (let r = 0; r < times; r++) for (let i = 0; i < 6; i++) setTimeout(() => { blip('sine', 1175, 1175, 0.05, 0.07); blip('sine', 1568, 1568, 0.03, 0.07); }, r * 1400 + i * 85); },
    // the spray can (on while the button is held)
    setSpray(on) { if (spray) glide(spray.g.gain, on ? 0.09 : 0, 0.05); },
    // a roller shutter: a long metal rattle, and a clang at the end when it comes down
    shutter(down = false) {
      if (!live()) return;
      const steps = 34;
      for (let i = 0; i < steps; i++) setTimeout(() => { burst(1100 + Math.random() * 500, 3, 0.05, 0.001, 0.035); if (i % 3 === 0) burst(240, 1, 0.07, 0.002, 0.05, 'lowpass'); }, i * 70);
      if (down) setTimeout(() => { burst(170, 0.7, 0.5, 0.003, 0.35, 'lowpass'); burst(2200, 2, 0.12, 0.002, 0.25); }, steps * 70 + 40);
    },
    // ---- Chapter 6: the garage ----
    // a tool touching steel: a small bright ring
    toolClink() { blip('triangle', 2600 + Math.random() * 900, 2500, 0.03, 0.18); burst(5200, 3, 0.018, 0.001, 0.05, 'highpass'); },
    // a ratchet: quick small clicks (n of them)
    ratchet(n = 4) { for (let i = 0; i < n; i++) setTimeout(() => { burst(3200 + Math.random() * 600, 6, 0.05, 0.001, 0.018); burst(900, 3, 0.02, 0.001, 0.03); }, i * 55); },
    // steel under strain: a low groan that bends, and a tick
    metalCreak() {
      if (!live()) return;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime, f0 = 70 + Math.random() * 40;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (1.4 + Math.random() * 0.4), t + 0.7);
      f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.8);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.85);
      setTimeout(() => burst(1900, 5, 0.035, 0.001, 0.03), 520);
    },
    // heavy canvas sliding over a car
    clothSlide() { burst(900, 0.6, 0.05, 0.12, 0.5); burst(2600, 0.8, 0.02, 0.1, 0.4); },
    // two wires meet: a crackle
    spark() { for (let i = 0; i < 7; i++) setTimeout(() => burst(4000 + Math.random() * 3000, 2, 0.05 * (1 - i / 8), 0.001, 0.02, 'highpass'), i * 28 + Math.random() * 20); },
    // the kettle's switch: a firm plastic click (on) / a softer one (off, when it boils)
    kettleClick(on = true) { burst(on ? 2100 : 1600, 3, on ? 0.09 : 0.06, 0.001, 0.03); burst(300, 1, 0.05, 0.002, 0.04, 'lowpass'); },
    // a key taken from a pocket: a small jingle
    keys() { for (let i = 0; i < 4; i++) setTimeout(() => blip('triangle', 3800 + Math.random() * 1400, 3600, 0.012, 0.09), i * 70 + Math.random() * 30); },
    // a sheet of paper put down on wood
    paper() { burst(3400, 0.7, 0.035, 0.01, 0.12, 'highpass'); burst(600, 0.8, 0.02, 0.005, 0.08); },
    // everything that runs all the time goes quiet (when the player leaves the vehicle)
    quiet() {
      this.setEngine(false); this.setScreech(0); this.setWind(0); this.setRoad(0); this.setScrape(false); this.setSqueal(false); this.setHorn(false); this.setSiren(false); this.setInside(false); this.setSpray(false);
    },
  };
}
