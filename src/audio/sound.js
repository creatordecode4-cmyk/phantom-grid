// ---------------------------------------------------------------------------
// sound.js - all sounds are MADE IN CODE with the Web Audio API.
// There are no sound files (and so nothing with a copyright).
//
//   engine    two tones through a filter, the pitch follows the engine speed
//   screech   filtered hiss while the tires slide
//   horn      two tones at once
//   thud      a short low bump when the car hits something
//   footstep  a short tick (concrete) or a soft "shff" (sand)
//
// Browsers only allow sound after the first tap or key press, so nothing
// plays before "unlock()" was called from such an event.
// ---------------------------------------------------------------------------

export function createSound() {
  let ctx = null, master = null, noiseBuf = null;
  let engine = null, screech = null, horn = null;
  let muted = false;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    // one second of random noise, used by the screech, the thud and the footsteps
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // ---- engine: a low saw tone + a higher hum, through a low-pass filter ----
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.2;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 110;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(); o2.start();
    engine = { g, lp, o1, o2 };

    // ---- tire screech: looping noise through a narrow filter ----
    const sg = ctx.createGain(); sg.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 5;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    src.connect(bp); bp.connect(sg); sg.connect(master); src.start();
    screech = { g: sg, bp };

    // ---- horn: two tones a little apart ----
    const hg = ctx.createGain(); hg.gain.value = 0;
    const h1 = ctx.createOscillator(); h1.type = 'square'; h1.frequency.value = 415;
    const h2 = ctx.createOscillator(); h2.type = 'square'; h2.frequency.value = 520;
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 2200;
    h1.connect(hlp); h2.connect(hlp); hlp.connect(hg); hg.connect(master); h1.start(); h2.start();
    horn = { g: hg };
  }
  // change a value smoothly (no clicks)
  const glide = (param, value, time = 0.06) => { if (ctx) param.setTargetAtTime(value, ctx.currentTime, time); };

  // one short burst of filtered noise
  function burst(freq, q, gain, attack, decay, type = 'bandpass') {
    if (!ctx || ctx.state !== 'running') return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + attack + decay);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.8, attack + decay + 0.05);
  }

  return {
    unlock,
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = m; if (master) glide(master.gain, m ? 0 : 0.8, 0.05); },
    get muted() { return muted; },
    // rev: 0..1 engine speed, load: 0..1 how hard the driver pushes, on: is the engine running
    setEngine(on, rev = 0, load = 0) {
      if (!engine) return;
      const f = 48 + rev * 150;
      glide(engine.o1.frequency, f, 0.05);
      glide(engine.o2.frequency, f * 2.01, 0.05);
      glide(engine.lp.frequency, 260 + rev * 1500 + load * 700, 0.08);
      glide(engine.g.gain, on ? 0.07 + 0.09 * load + 0.05 * rev : 0, 0.12);
    },
    // amount: 0..1 how much the tires slide
    setScreech(amount) {
      if (!screech) return;
      glide(screech.g.gain, Math.min(0.28, amount * 0.3), 0.07);
      glide(screech.bp.frequency, 1250 + amount * 700, 0.1);
    },
    setHorn(on) { if (horn) glide(horn.g.gain, on ? 0.16 : 0, 0.015); },
    // strength: 0..1
    thud(strength) {
      if (!ctx || ctx.state !== 'running') return;
      const s = Math.min(1, Math.max(0.15, strength));
      burst(160, 0.7, 0.9 * s, 0.004, 0.22, 'lowpass');
      burst(2400, 1.2, 0.25 * s, 0.002, 0.07);
      // a short falling low tone = the weight of the car
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
      g.gain.setValueAtTime(0.5 * s, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
    },
    // surface: 'concrete' or 'sand'
    footstep(surface, running = false) {
      const k = running ? 1.25 : 1;
      if (surface === 'sand') burst(650, 0.5, 0.11 * k, 0.012, 0.16, 'lowpass');
      else { burst(1900 + Math.random() * 500, 1.6, 0.075 * k, 0.002, 0.045); burst(240, 0.8, 0.09 * k, 0.003, 0.06, 'lowpass'); }
    },
    doorClick() { burst(900, 1.0, 0.16, 0.002, 0.07); burst(180, 0.8, 0.22, 0.003, 0.1, 'lowpass'); },
    chime() {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      for (const [f, at] of [[660, 0], [880, 0.12]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(0.12, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.4);
        o.connect(g); g.connect(master); o.start(t + at); o.stop(t + at + 0.45);
      }
    },
  };
}
