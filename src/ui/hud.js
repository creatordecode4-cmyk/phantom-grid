// ---------------------------------------------------------------------------
// hud.js - the thin text and the buttons on top of the game.
//
// This file only talks to the web page (HTML). It knows nothing about 3D.
// main.js gives it functions to call when a button is pressed.
// ---------------------------------------------------------------------------

export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const el = {
    location: $('hud-location'), clock: $('hud-clock'), weather: $('hud-weather'), stats: $('hud-stats'),
    btnTime: $('btn-time'), btnRain: $('btn-rain'), btnQuality: $('btn-quality'), btnStats: $('btn-stats'), btnFull: $('btn-full'),
    menuTime: $('menu-time'), menuQuality: $('menu-quality'),
    toast: $('toast'), hint: $('hint'),
    loading: $('loading'), bar: $('bar-fill'), loadText: $('load-text'), loadError: $('load-error'),
  };

  // main.js fills these in
  const actions = { time: () => {}, rain: () => {}, quality: () => {}, stats: () => {} };

  // ---- menus ----
  function closeMenus() {
    el.menuTime.hidden = true;
    el.menuQuality.hidden = true;
  }
  function toggleMenu(menu) {
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
  }
  // a button reacts as soon as the finger goes down (feels faster on phones)
  const press = (node, fn) => node.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });

  press(el.btnTime, () => toggleMenu(el.menuTime));
  press(el.btnQuality, () => toggleMenu(el.menuQuality));
  press(el.btnRain, () => { closeMenus(); actions.rain(); });
  press(el.btnStats, () => { closeMenus(); actions.stats(); });
  press(el.btnFull, () => {
    closeMenus();
    // full screen hides the browser bars (not every phone browser allows it)
    const d = document, root = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) (root.requestFullscreen || root.webkitRequestFullscreen || (() => {})).call(root);
      else (d.exitFullscreen || d.webkitExitFullscreen || (() => {})).call(d);
    } catch (err) { /* not allowed - ignore */ }
  });
  for (const b of el.menuTime.querySelectorAll('[data-time]')) press(b, () => { closeMenus(); actions.time(b.dataset.time); });
  for (const b of el.menuQuality.querySelectorAll('[data-quality]')) press(b, () => { closeMenus(); actions.quality(b.dataset.quality); });
  // touching the game closes an open menu
  for (const id of ['zone-look', 'zone-move']) $(id).addEventListener('pointerdown', closeMenus);
  // no long-press menu, no pinch zoom
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // the keyboard hint fades away after a while
  setTimeout(() => el.hint.classList.add('gone'), 9000);

  let toastTimer = 0;
  let lastLocation = '', lastClock = '', lastWeather = '';

  return {
    actions,
    // elements the controls need
    dom: {
      zoneLook: $('zone-look'), zoneMove: $('zone-move'),
      joyBase: $('joy-base'), joyKnob: $('joy-knob'), runButton: $('btn-run'),
      minimap: $('minimap'),
    },
    setLocation(name) {
      if (name !== lastLocation) { lastLocation = name; el.location.textContent = name; }
    },
    // hour: 0..24  ->  "18:09"
    setClock(hour) {
      const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
      const text = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (text !== lastClock) { lastClock = text; el.clock.textContent = text; }
    },
    setWeather(text) {
      if (text !== lastWeather) { lastWeather = text; el.weather.textContent = text; }
    },
    setRainButton(on) { el.btnRain.classList.toggle('on', on); },
    setQualityButtons(mode, activeLabel) {
      for (const b of el.menuQuality.querySelectorAll('[data-quality]')) b.classList.toggle('on', b.dataset.quality === mode);
      el.btnQuality.textContent = mode === 'auto' ? `AUTO · ${activeLabel}` : activeLabel;
    },
    showStats(on) {
      el.stats.hidden = !on;
      el.btnStats.classList.toggle('on', on);
    },
    setStats(text) { el.stats.textContent = text; },
    toast(text, ms = 1800) {
      el.toast.textContent = text;
      el.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
    },
    // ---- loading screen ----
    setProgress(fraction, text) {
      el.bar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
      if (text) el.loadText.textContent = text.toUpperCase();
    },
    hideLoading() {
      el.loading.classList.add('done');
      setTimeout(() => { el.loading.style.display = 'none'; }, 1000);
    },
    showError(message) {
      el.loadError.style.display = 'block';
      el.loadError.textContent = message;
      el.loadText.textContent = 'COULD NOT START';
    },
  };
}
