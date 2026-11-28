// ---------------------------------------------------------------------------
// stability.js - KEEPING THE GAME RUNNING ON A PHONE.
//
// A phone closes a browser tab that uses too much memory, and the player only sees the game "crash". Three things
// are done about it here:
//
// 1. THE CRASH GUARD. When the game starts it writes "open" into the phone's storage; when the page is closed or
//    put in the background it writes "closed". If the game starts and finds "open", the last session died while it
//    was on the screen: the graphics level starts one step lower than it was (and the player is told).
//    Three good minutes of play forget the old crashes.
//
// 2. THE TEXTURE BUDGET. The pictures on walls, roads and people are most of the memory on the graphics chip. Every
//    graphics level has a largest picture size (config.js: textureCap). three.js makes bigger pictures smaller when
//    it sends them to the chip - so LOW uses about a quarter of the picture memory of HIGH.
//
// 3. OWN GRAPHICS OPTIONS. The player can change single things of a level (sharpness, shadows, effects, how far the
//    world is drawn, how many people and cars, 30 or 60 pictures a second): makeQuality() puts them over the level.
// ---------------------------------------------------------------------------

export const LEVELS = ['verylow', 'low', 'medium', 'high'];
const RUN_KEY = 'pg-run', GFX_KEY = 'pg-gfx';
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } };

// one step down (never below the lowest level)
export const lowerLevel = (name) => LEVELS[Math.max(0, LEVELS.indexOf(name) - 1)] || 'verylow';

// ---- the player's own options: 'auto' = as the level says ----
export const GFX_DEFAULT = { sharp: 'auto', shadows: 'auto', effects: 'auto', distance: 'auto', people: 'auto', traffic: 'auto', fps: 60 };
export function loadGfx() { return { ...GFX_DEFAULT, ...(read(GFX_KEY) || {}) }; }
export function saveGfx(g) { write(GFX_KEY, g); }

// the level's numbers with the player's options over them (a new object: the presets in config.js stay as they are)
export function makeQuality(preset, g) {
  const q = { ...preset, pixelRatio: { ...preset.pixelRatio } };
  if (g.sharp === 'low') q.pixelRatio = { scale: 0, min: 0.55, max: 0.55, dynMax: 0.7 };
  else if (g.sharp === 'medium') q.pixelRatio = { scale: 0, min: 0.85, max: 0.85, dynMax: 1.0 };
  else if (g.sharp === 'high') q.pixelRatio = { scale: 0.5, min: 1.0, max: 1.4, dynMax: 2.0 };
  if (g.shadows === 'off') { q.shadows = false; q.farShadows = false; }
  else if (g.shadows === 'on') { q.shadows = true; }
  if (g.effects === 'off') { q.post = false; q.vignette = false; q.grain = false; }
  else if (g.effects === 'on') { q.post = true; if (!q.sharpen) q.sharpen = 0.5; }
  if (g.distance === 'near') { q.cameraFar = Math.min(q.cameraFar, 1500); q.fogMultiplier = Math.max(q.fogMultiplier, 2.1); q.propDistance = Math.min(q.propDistance, 0.5); }
  else if (g.distance === 'far') { q.cameraFar = 9000; q.fogMultiplier = 1.0; q.propDistance = Math.max(q.propDistance, 1.0); }
  if (g.people === 'few') q.people = 8; else if (g.people === 'normal') q.people = 30; else if (g.people === 'many') q.people = 70;
  if (g.traffic === 'few') q.traffic = 6; else if (g.traffic === 'normal') q.traffic = 18; else if (g.traffic === 'many') q.traffic = 36;
  q.fpsCap = g.fps === 30 ? 30 : 0;
  return q;
}

// ---- the largest picture the graphics chip gets (see the top of this file) ----
// renderer.capabilities.maxTextureSize is what three.js asks before it sends a picture to the chip: a smaller number
// here makes it shrink every bigger picture on the way (the picture itself stays whole in memory, so a later change
// to a higher level can send it again in full size).
export function createTextureBudget(renderer) {
  const real = renderer.capabilities.maxTextureSize;
  let cap = real, scene = null;
  // (three.js writes a warning for every picture it makes smaller: these are wanted, so they are not shown)
  const warn = console.warn;
  // (and one for every picture of plain numbers that is bigger than the size and stays as it is)
  console.warn = (...a) => { if (typeof a[0] === 'string' && (a[0].indexOf('Texture has been resized') >= 0 || a[0].indexOf('DataTexture is too big') >= 0)) return; warn.apply(console, a); };
  return {
    get cap() { return cap; },
    // (the world whose pictures are sent again when the size changes in play)
    setScene(sc) { scene = sc; },
    // set the size; "again" = pictures already on the chip are sent again in the new size (a change of level in play)
    set(size, again) {
      const next = Math.max(64, Math.min(real, size || real));
      if (next === cap) return false;
      cap = next;
      renderer.capabilities.maxTextureSize = cap;
      if (again && scene) {
        const seen = new Set();
        const drop = (t) => {
          if (!t || !t.isTexture || seen.has(t) || t.isRenderTargetTexture || t.isDataTexture || t.isCubeTexture || t.isDepthTexture || t.isCompressedTexture) return;
          const im = t.image;
          if (!im || !(im.width > 0) || im.data) return;
          seen.add(t);
          t.dispose();                 // (the chip's copy goes; the next picture drawn with it sends it again)
        };
        scene.traverse((o) => {
          for (const m of [].concat(o.material || [])) {
            if (!m) continue;
            for (const k of Object.keys(m)) drop(m[k]);
            if (m.uniforms) for (const u of Object.keys(m.uniforms)) drop(m.uniforms[u] && m.uniforms[u].value);
          }
        });
      }
      return true;
    },
  };
}

// ---- the crash guard ----
export function createCrashGuard() {
  const prev = read(RUN_KEY);
  const crashed = !!(prev && prev.open);                       // the last session never said "closed"
  const state = { open: true, crashes: crashed ? (prev.crashes || 0) + 1 : 0, level: prev ? prev.level || null : null, t: Date.now() };
  const lastLevel = prev ? prev.level || null : null;
  write(RUN_KEY, state);
  // (after the graphics chip was taken away the session stays "open", whatever happens next: it counts as a crash)
  const close = () => { if (state.broken) return; state.open = false; write(RUN_KEY, state); };
  const open = () => { state.open = true; write(RUN_KEY, state); };
  window.addEventListener('pagehide', close);
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); else open(); });
  // three good minutes: the old crashes are forgotten
  let good = 0;
  return {
    crashed, crashes: state.crashes,
    lastLevel,                                                  // the level that was running when it died
    // the level to start with: after a crash one step under the level that died
    startLevel(wanted) {
      if (!crashed || !lastLevel || LEVELS.indexOf(lastLevel) < 0) return wanted;
      const safe = lowerLevel(lastLevel);
      return LEVELS.indexOf(wanted) > LEVELS.indexOf(safe) ? safe : wanted;
    },
    setLevel(name) { state.level = name; write(RUN_KEY, state); },
    // the graphics chip was taken away (context lost): the next start counts as a crash
    markBroken() { state.open = true; state.broken = true; write(RUN_KEY, state); },
    update(dt) {
      if (state.crashes === 0) return;
      good += dt;
      if (good > 180) { state.crashes = 0; write(RUN_KEY, state); }
    },
  };
}
