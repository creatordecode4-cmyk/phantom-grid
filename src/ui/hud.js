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
    // Phase 2: driving, missions, map
    btnCar: $('btn-car'), btnMap: $('btn-map'), btnSound: $('btn-sound'), btnExit: $('drv-exit'),
    speedNum: $('speed-num'), speedCar: $('speed-car'),
    mission: $('hud-mission'), missionTitle: $('mission-title'), missionText: $('mission-text'), missionDist: $('mission-dist'),
    arrow: $('gps-arrow'), arrowIcon: $('gps-arrow-icon'), arrowDist: $('gps-dist'),
    marker: $('marker'), markerDist: $('marker-dist'),
    dialog: $('dialog'), dialogName: $('dialog-name'), dialogText: $('dialog-text'),
    btnVeh: $('btn-veh'), btnAssist: $('btn-assist'), menuVeh: $('menu-veh'), menuVehRow: $('menu-veh-row'), menuAssist: $('menu-assist'),
    btnCam: $('drv-cam'), btnLight: $('drv-light'), btnHorn: $('drv-horn'),
    gear: $('gear'), indL: $('ind-l'), indR: $('ind-r'), rpm: $('rpm-bar').firstElementChild, dmg: $('dmg-bar').firstElementChild, nitro: $('nitro-bar').firstElementChild,
    wanted: $('hud-wanted'), tags: $('tags'), windscreen: $('windscreen'),
    // Phase 5: the wanted level
    stars: [...document.querySelectorAll('#hud-stars i')], wstate: $('hud-wstate'), wstateText: $('hud-wstate-text'), wstateBar: $('hud-wstate-bar'),
    edge: $('edge-light'), ticker: $('ticker'), tickerText: $('ticker-text'), tickerFace: $('ticker-face'), btnCover: $('btn-cover'),
    bigmap: $('bigmap'), bigmapClear: $('bigmap-clear'), bigmapClose: $('bigmap-close'), minimap: $('minimap'),
  };

  // main.js fills these in
  const actions = {
    time: () => {}, rain: () => {}, quality: () => {}, stats: () => {},
    camera: () => {}, lights: () => {}, spawn: () => {}, assist: () => {},
    car: () => {}, map: () => {}, mapClose: () => {}, mapClear: () => {}, sound: () => {}, dialog: () => {}, cover: () => {},
  };

  // ---- menus ----
  function closeMenus() {
    el.menuTime.hidden = true;
    el.menuQuality.hidden = true;
    el.menuVeh.hidden = true;
    el.menuAssist.hidden = true;
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
  // the rig test is its own page (character skeleton, poses, self-test)
  press($('btn-rig'), () => { location.href = 'rigtest.html'; });
  press(el.btnVeh, () => toggleMenu(el.menuVeh));
  press(el.btnAssist, () => toggleMenu(el.menuAssist));
  press(el.btnCam, () => actions.camera());
  press(el.btnLight, () => actions.lights());
  for (const b of el.menuAssist.querySelectorAll('[data-assist]')) press(b, () => { closeMenus(); actions.assist(b.dataset.assist); });
  press(el.btnCar, () => actions.car());
  press(el.btnExit, () => actions.car());
  press(el.btnMap, () => { closeMenus(); actions.map(); });
  press(el.minimap, () => { closeMenus(); actions.map(); });   // tapping the small map opens the big one
  press(el.btnSound, () => { closeMenus(); actions.sound(); });
  press(el.btnCover, () => actions.cover());
  press(el.dialog, () => actions.dialog());
  press(el.bigmapClose, () => actions.mapClose());
  press(el.bigmapClear, () => actions.mapClear());
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
  let lastGear = '', lastRpm = -1, lastDmg = -1, lastNitro = -1, lastBlink = 0, lastWanted = -1, lastRole = '';
  let lastState = '', lastBar = -1, lastEdge = -1, tickerOn = false, coverOn = false;
  const tagNodes = [];
  let lastSpeed = -1, lastMission = '', lastDist = '', lastArrowDist = '', carShown = false, arrowShown = false, markerShown = false;
  const meters = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} KM` : `${Math.round(d)} M`);

  return {
    actions,
    // elements the controls need
    dom: {
      zoneLook: $('zone-look'), zoneMove: $('zone-move'),
      joyBase: $('joy-base'), joyKnob: $('joy-knob'), runButton: $('btn-run'),
      minimap: $('minimap'), bigmapCanvas: $('bigmap-canvas'),
      drive: { left: $('drv-left'), right: $('drv-right'), gas: $('drv-gas'), brake: $('drv-brake'), hand: $('drv-hand'), horn: $('drv-horn'), tilt: $('drv-tilt'), nitro: $('drv-nitro'), up: $('drv-up'), down: $('drv-down') },
    },
    // ---- driving ----
    // role: car / police / boat / drone (some buttons only exist for some vehicles)
    setDriving(on, carLabel = '', role = 'car', nitro = false) {
      const c = document.body.classList;
      c.toggle('driving', on);
      if (lastRole) c.remove('role-' + lastRole);
      lastRole = on ? role : '';
      if (on) c.add('role-' + role);
      c.toggle('has-nitro', on && nitro);
      el.btnHorn.textContent = role === 'police' ? 'SIREN' : 'HORN';
      el.speedCar.textContent = carLabel;
      if (on) { carShown = false; el.btnCar.hidden = true; }
    },
    // the dashboard: d = vehicles.hud (gear, rpm 0..1, damage 0..1, nitro 0..1 or null, blink), blinkOn: lamp lit now
    setDash(d, blinkOn) {
      if (d.gear !== lastGear) { lastGear = d.gear; el.gear.textContent = d.gear; }
      const r = Math.round(d.rpm * 50);
      if (r !== lastRpm) { lastRpm = r; el.rpm.style.width = `${r * 2}%`; el.rpm.classList.toggle('red', r > 45); }
      const g = Math.round(d.damage * 50);
      if (g !== lastDmg) { lastDmg = g; el.dmg.style.width = `${g * 2}%`; }
      const n = d.nitro === null ? -1 : Math.round(d.nitro * 50);
      if (n !== lastNitro) { lastNitro = n; el.nitro.style.width = `${Math.max(0, n) * 2}%`; }
      const b = blinkOn ? d.blink : 0;
      if (b !== lastBlink) { lastBlink = b; el.indL.classList.toggle('on', b === -1 || b === 2); el.indR.classList.toggle('on', b === 1 || b === 2); }
    },
    setLightButton(on) { el.btnLight.classList.toggle('on', on); },
    // wanted level: a thin row of five stars (0 hides it). chased: somebody can see the player right now
    setWanted(stars, chased) {
      const key = stars * 2 + (chased ? 1 : 0);
      if (key === lastWanted) return;
      lastWanted = key;
      el.wanted.hidden = stars <= 0;
      el.stars.forEach((n, i) => n.classList.toggle('on', i < stars));
      el.wanted.classList.toggle('chased', chased);
    },
    // what the Guard is doing: w = { stars, mode: 'chase' | 'search' | 'patrol' | 'idle', hidden, progress 0..1, covered, light 0..1 }
    //   SEEN (red) while somebody sees the player, SEARCHING while they look, HIDDEN + a bar while a star goes away
    setWantedState(w) {
      let text = '', kind = '';
      if (w.stars > 0) {
        if (w.mode === 'chase') { text = 'SEEN'; kind = 'seen'; }
        else if (w.hidden) { text = w.covered ? 'COVERED' : 'HIDDEN'; kind = 'hidden'; }
        else { text = 'SEARCHING'; kind = 'search'; }
      }
      const key = text + kind;
      if (key !== lastState) {
        lastState = key;
        el.wstate.hidden = !text;
        el.wstateText.textContent = text;
        el.wstate.className = kind;
      }
      const bar = kind === 'hidden' ? Math.round(w.progress * 100) : 0;
      if (bar !== lastBar) { lastBar = bar; el.wstateBar.style.width = bar + '%'; }
      // red and blue light at the edges of the screen during a chase (soft, it breathes; no hard flashing)
      const e = Math.round((w.light || 0) * 40) / 40;
      if (e !== lastEdge) { lastEdge = e; el.edge.style.opacity = String(e * 0.85); el.edge.hidden = e <= 0; }
    },
    // the news line at the bottom of the screen: text (null = off), face: a picture (data URL) for the left end
    setTicker(text, face = null) {
      const on = !!text;
      if (on && el.tickerText.textContent !== text) el.tickerText.textContent = text;
      if (face && el.tickerFace.dataset.src !== face) { el.tickerFace.src = face; el.tickerFace.dataset.src = face; }
      if (on !== tickerOn) { tickerOn = on; el.ticker.hidden = !on; document.body.classList.toggle('ticker', on); }
    },
    // the COVER button (parked in an alley: pull the car into the shadow)
    showCover(on) { if (on !== coverOn) { coverOn = on; el.btnCover.hidden = !on; } },
    // the test menu: one button per vehicle. list: [[kind, label], ...]
    setVehicleMenu(list) {
      el.menuVehRow.textContent = '';
      for (const [kind, label] of list) {
        const b = document.createElement('button');
        b.className = 'btn'; b.textContent = label; b.dataset.kind = kind;
        press(b, () => { closeMenus(); actions.spawn(kind); });
        el.menuVehRow.appendChild(b);
      }
    },
    setAssist(mode) {
      for (const b of el.menuAssist.querySelectorAll('[data-assist]')) b.classList.toggle('on', b.dataset.assist === mode);
      el.btnAssist.textContent = 'ASSIST ' + mode.toUpperCase();
    },
    // name tags: list of { x, y, text } in screen pixels
    setTags(list) {
      while (tagNodes.length < list.length) { const d = document.createElement('div'); d.className = 'tag'; d.hidden = true; el.tags.appendChild(d); tagNodes.push({ d, text: '' }); }
      for (let i = 0; i < tagNodes.length; i++) {
        const t = tagNodes[i], it = list[i];
        if (!it) { if (!t.d.hidden) t.d.hidden = true; continue; }
        if (t.text !== it.text) { t.text = it.text; t.d.textContent = it.text; }
        t.d.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px) translate(-50%, -100%)`;
        if (t.d.hidden) t.d.hidden = false;
      }
    },
    setWindscreen(on) { if (el.windscreen.hidden === on) el.windscreen.hidden = !on; },
    setSpeed(kmh) {
      const v = Math.round(kmh);
      if (v !== lastSpeed) { lastSpeed = v; el.speedNum.textContent = String(v); }
    },
    showCarButton(on) {
      if (on !== carShown) { carShown = on; el.btnCar.hidden = !on; }
    },
    setSoundButton(on) { el.btnSound.classList.toggle('on', on); },
    // ---- mission text (null hides it) ----
    setMission(m) {
      const key = m ? m.title + '|' + m.text : '';
      if (key !== lastMission) {
        lastMission = key;
        el.mission.hidden = !m;
        if (m) { el.missionTitle.textContent = m.title; el.missionText.textContent = m.text; }
      }
      const dist = m && m.info ? m.info : '';
      if (dist !== lastDist) { lastDist = dist; el.missionDist.textContent = dist; }
    },
    // ---- GPS arrow at the top: angle in radians (0 = straight ahead, + = to the right) ----
    setArrow(angle, dist) {
      const on = angle !== null;
      if (on !== arrowShown) { arrowShown = on; el.arrow.hidden = !on; }
      if (!on) return;
      el.arrowIcon.style.transform = `rotate(${angle.toFixed(3)}rad)`;
      const text = meters(dist);
      if (text !== lastArrowDist) { lastArrowDist = text; el.arrowDist.textContent = text; }
    },
    // ---- floating marker over a place in the world (screen position in CSS pixels) ----
    setMarker(x, y, dist) {
      const on = x !== null;
      if (on !== markerShown) { markerShown = on; el.marker.hidden = !on; }
      if (!on) return;
      el.marker.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      el.markerDist.textContent = meters(dist);
    },
    // ---- dialog box ----
    showDialog(name, text) { el.dialog.hidden = false; el.dialogName.textContent = name; el.dialogText.textContent = text; },
    hideDialog() { el.dialog.hidden = true; },
    showBigMap(on) { el.bigmap.hidden = !on; },
    get bigMapOpen() { return !el.bigmap.hidden; },
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
