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
  drone: { f0: 150, f1: 210, w1: 'triangle', w2: 'sawtooth', mix: 0.3, lp: 2200, vol: 0.55 },
};

export function createSound() {
  let ctx = null, master = null, out = null, inside = null, noiseBuf = null;
  let engine = null, screech = null, horn = null, wind = null, road = null, siren = null, scrape = null, squeal = null;
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
    // ---- brake squeal: a thin high tone ----
    {
      const g = ctx.createGain(); g.gain.value = 0;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
      o.connect(g); g.connect(master); o.start();
      squeal = { g };
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
    // rev: 0..1 engine speed, load: 0..1 how hard the driver pushes, on: is the engine running
    setEngine(on, rev = 0, load = 0) {
      if (!engine) return;
      const f = tone.f0 + rev * (tone.f1 - tone.f0);
      glide(engine.o1.frequency, f, 0.04);
      glide(engine.o2.frequency, f * 2.01, 0.04);
      glide(engine.lp.frequency, tone.lp * (0.25 + rev * 0.75 + load * 0.45), 0.07);
      glide(engine.g.gain, on ? (0.055 + 0.085 * load + 0.05 * rev) * tone.vol * (isInside ? 1.25 : 1) : 0, 0.1);
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
      else { burst(1900 + Math.random() * 500, 1.6, 0.075 * k, 0.002, 0.045); burst(240, 0.8, 0.09 * k, 0.003, 0.06, 'lowpass'); }
    },
    // door: 'open' = a click and a soft creak, 'close' = a dull slam
    doorClick(kind = 'close') {
      if (kind === 'open') { burst(1400, 1.5, 0.14, 0.002, 0.05); burst(500, 3, 0.05, 0.03, 0.18); }
      else { burst(900, 1.0, 0.16, 0.002, 0.07); burst(150, 0.8, 0.3, 0.003, 0.12, 'lowpass'); }
    },
    chime() { blip('sine', 660, 660, 0.12, 0.4); setTimeout(() => blip('sine', 880, 880, 0.12, 0.4), 120); },
    // everything that runs all the time goes quiet (when the player leaves the vehicle)
    quiet() {
      this.setEngine(false); this.setScreech(0); this.setWind(0); this.setRoad(0); this.setScrape(false); this.setSqueal(false); this.setHorn(false); this.setSiren(false); this.setInside(false);
    },
  };
}
