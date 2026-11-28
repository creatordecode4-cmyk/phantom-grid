// ---------------------------------------------------------------------------
// online.js - PLAYING FREE ROAM WITH OTHER PEOPLE.
//
// FOR THE PLAYER
//   Title screen > ONLINE:
//     JOIN THE MAIN WORLD    everybody who chooses this is in the same city
//     MAKE MY OWN WORLD      a world of your own with a code of six letters - give the code to your friends
//     JOIN WITH A CODE       type a friend's code
//   In the city the other players walk, drive and ride around as themselves, with their names over their heads.
//   You see their shots and hear them. CHAT sends a short line to everybody in your world.
//
// WHAT IS SHARED AND WHAT IS NOT
//   Shared: where every player is, what they drive, which weapon they hold, shots, chat.
//   Not shared: the traffic, the people on the sidewalks and the Guard - every player has their own (the world
//   server only passes the players' places on; it does not run the city).
//
// THE WORLD SERVER
//   A small program (server/server.js in this project) that somebody has to run on a computer the players can
//   reach. Its address is typed once into the ONLINE screen (it is kept on the phone), or set for everybody in
//   CONFIG.online.server (src/config.js). A page that was opened with https needs an address that starts with wss://
//
// INSIDE THE GAME
//   * own state goes out ten times a second; the others' states come in ten times a second and are smoothed
//   * the others on foot are ONE instanced mesh (the same figure as the people of the city, walking by shader)
//   * another player's car is a real vehicle of the game, moved along by the network instead of by a driver
//
//   const online = createOnline({ scene, player, vehicles, materials, hud, sound, t });
//   online.openMenu({ onBack, onJoined })       the ONLINE screen
//   online.update(dt, { car, inside, weapon })  every frame
//   online.event('shot', { x, z, dx, dz, d, w }) something others should see
//   online.leave()
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makeHumanFigure, lin } from '../city/models.js';

const KEY = 'pg-online', MAX = 24, SEND_EVERY = 0.1;
const SHIRTS = [[0.82, 0.2, 0.16], [0.16, 0.4, 0.8], [0.92, 0.72, 0.1], [0.2, 0.62, 0.36], [0.6, 0.3, 0.75], [0.95, 0.5, 0.15], [0.15, 0.65, 0.7], [0.85, 0.35, 0.55]];

export function createOnline({ scene, player, vehicles, materials, hud, sound, t }) {
  let ws = null, state = 'off', me = 0, world = '', own = false, sendT = 0, onShot = null;
  const others = new Map();          // id -> remote player
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } })();
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* private mode */ } };
  const urlServer = (() => { try { return new URLSearchParams(location.search).get('server') || ''; } catch (e) { return ''; } })();
  const serverAddress = () => urlServer || saved.server || (CONFIG.online && CONFIG.online.server) || '';

  // ======================================================================= the others, drawn
  const geo = makeHumanFigure('street', 1);
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  phase.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPhase', phase);
  // THE ANIMATION STATE of each other player: the crowd shader of the building site's workers ("PG_WORK" in
  // materials.js) moves the arms and bends the body - 1 a strike, 2 bending down and reaching, 3 the arms held in
  // front; the whole figure is lowered, leaned and lifted here (crouch, being hit, a jump)
  const work = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  work.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aWork', work);
  const mesh = new THREE.InstancedMesh(geo, materials.mats.worker || materials.mats.ped, MAX);
  mesh.name = 'onlinePlayers';
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0; mesh.visible = false;
  scene.add(mesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), XV = new THREE.Vector3(1, 0, 0);

  // a name over a head: a small picture of the text that always faces the camera
  function tag(text, color = '#ffffff') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    const draw = (txt, bubble) => {
      g.clearRect(0, 0, 256, 64);
      g.font = `600 ${bubble ? 22 : 26}px "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = Math.min(248, g.measureText(txt).width + 24);
      g.fillStyle = bubble ? 'rgba(255,255,255,0.92)' : 'rgba(8,10,14,0.62)';
      g.beginPath(); g.roundRect ? g.roundRect(128 - w / 2, 12, w, 40, 12) : g.rect(128 - w / 2, 12, w, 40); g.fill();
      g.fillStyle = bubble ? '#10141a' : color; g.fillText(txt, 128, 33, 236);
    };
    draw(text, false);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(1.9, 0.475, 1); sp.renderOrder = 20;
    scene.add(sp);
    return { sp, redraw(txt, bubble) { draw(txt, bubble); tex.needsUpdate = true; }, dispose() { scene.remove(sp); tex.dispose(); sp.material.dispose(); } };
  }
  function addOther(id, name) {
    if (others.has(id) || others.size >= MAX) return;
    const shirt = lin(SHIRTS[id % SHIRTS.length]);
    others.set(id, { id, name, shirt, tag: tag(name), x: 0, y: 0, z: 0, h: 0, tx: 0, ty: 0, tz: 0, th: 0, sp: 0, k: '', w: '', seen: false, car: null, ph: 0, sayT: 0 });
    hud.toast(t('ui.online.came').replace('{name}', name), 2200);
    chip();
  }
  function dropCar(o) { if (o.car) { if (vehicles.live.includes(o.car)) vehicles.removeVehicle(o.car); o.car = null; } }
  function removeOther(id, quiet = false) {
    const o = others.get(id);
    if (!o) return;
    dropCar(o);
    o.tag.dispose();
    others.delete(id);
    if (!quiet) hud.toast(t('ui.online.left').replace('{name}', o.name), 2200);
    chip();
  }
  // another player's vehicle: a real vehicle of the game that follows what the network says
  function carFor(o) {
    if (o.car && o.car.kind === o.k && vehicles.live.includes(o.car)) return o.car;
    dropCar(o);
    const v = vehicles.spawn(o.k, o.tx, o.tz, o.th, o.shirt, { keep: true, npc: true });
    if (!v) return null;
    v.kin = true; v.remote = o.id; v.label = o.name;
    v.ai = (car, dt) => {
      // glide to where the network says the car is (and keep a speed, so the wheels turn and other cars see it move)
      const k = 1 - Math.exp(-9 * dt), ox = car.x, oz = car.z;
      car.x += (o.tx - car.x) * k; car.z += (o.tz - car.z) * k;
      let dh = o.th - car.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      car.heading += dh * k;
      car.vx = (car.x - ox) / dt; car.vz = (car.z - oz) / dt;
      car.forward = car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading);
      if (car.spin !== undefined && car.info) car.spin += (car.forward * dt) / car.info.wheelR;
    };
    o.car = v;
    return v;
  }

  // ======================================================================= the connection
  const send = (obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
  function onMessage(m) {
    if (m.t === 'u') {
      for (const s of m.p) {
        const o = others.get(s[0]);
        if (!o) continue;
        // (the speed between the last two messages: the figure keeps going between them instead of stopping and
        //  starting ten times a second - it is drawn a little behind, where it already was, never where it jumps)
        const now = performance.now() / 1000, gap = o.at ? Math.min(0.5, Math.max(0.05, now - o.at)) : 0.1;
        if (o.at) { o.vx = (s[1] - o.tx) / gap; o.vz = (s[3] - o.tz) / gap; if (Math.hypot(o.vx, o.vz) > 40) o.vx = o.vz = 0; }
        o.at = now;
        o.tx = s[1]; o.ty = s[2]; o.tz = s[3]; o.th = s[4]; o.k = s[5]; o.sp = s[6]; o.w = s[7];
        if ((s[8] || '') !== o.a) { o.a = s[8] || ''; o.aT = 0; }
        // (first news of them, or a jump - they came out of a house far away: no gliding across the city)
        if (!o.seen || Math.hypot(o.tx - o.x, o.tz - o.z) > 30) { o.x = o.tx; o.y = o.ty; o.z = o.tz; o.h = o.th; o.seen = true; }
      }
    } else if (m.t === 'in') addOther(m.id, m.name);
    else if (m.t === 'out') removeOther(m.id);
    else if (m.t === 'e') {
      const o = others.get(m.id);
      if (!o) return;
      if (m.k === 'say') { o.sayT = 5; o.tag.redraw(m.m, true); hud.toast(`${o.name}: ${m.m}`, 4200); }
      else if (m.k === 'shot' && onShot) onShot(m, o);
      else if (m.k === 'bat') {
        const ex = player.position.x - m.x, ez = player.position.z - m.z, d = Math.hypot(ex, ez);
        if (d < 30 && sound.batSwing) sound.batSwing();
        // right in front of their swing: Nate is hit - he jerks back (nobody gets hurt; players cannot harm each other)
        if (d < 1.5 && d > 0.05 && player.actions && (ex * (m.dx || 0) + ez * (m.dz || 0)) / d > 0.5) {
          const side = Math.sign(-ex * Math.cos(player.heading) + ez * Math.sin(player.heading)) || 0;
          player.actions.play('getHit', { side });
        }
      }
    }
  }
  // world: 'MAIN' | 'NEW' | a code. Answers { ok, world, own } or { ok: false, why }
  async function connect(wantWorld, name) {
    const url = serverAddress();
    if (!url) return { ok: false, why: 'noServer' };
    if (!/^wss?:\/\/[^\s]+$/i.test(url)) return { ok: false, why: 'badAddress' };
    // (a page opened with https may only talk to a server whose address starts with wss://)
    if (location.protocol === 'https:' && /^ws:\/\//i.test(url)) return { ok: false, why: 'needWss' };
    leave(true);
    state = 'connecting';
    // A server on a free host sleeps when nobody plays and needs about a minute to wake up: a plain web request
    // wakes it (and waits for it), then the real connection is made.
    try {
      await Promise.race([fetch(url.replace(/^ws/i, 'http'), { cache: 'no-store' }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 80000))]);
    } catch (e) { /* (no answer to the web request: the connection below still tries, and reports) */ }
    if (state !== 'connecting') return { ok: false, why: 'noAnswer' };
    return new Promise((done) => {
      let answered = false;
      const finish = (r) => { if (!answered) { answered = true; done(r); } };
      let sock;
      try { sock = new WebSocket(url); } catch (e) { state = 'off'; return finish({ ok: false, why: 'badAddress' }); }
      ws = sock;
      const timer = setTimeout(() => { if (state === 'connecting') { try { sock.close(); } catch (e) { /* gone */ } state = 'off'; finish({ ok: false, why: 'noAnswer' }); } }, 12000);
      sock.onopen = () => send({ t: 'join', world: wantWorld, name });
      sock.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'joined') {
          clearTimeout(timer);
          me = m.id; world = m.world; own = !!m.own; state = 'on';
          for (const o of [...others.keys()]) removeOther(o, true);
          for (const p of m.players) addOther(p.id, p.name);
          chip();
          finish({ ok: true, world, own });
        } else if (m.t === 'no') { clearTimeout(timer); state = 'off'; try { sock.close(); } catch (err) { /* gone */ } finish({ ok: false, why: m.why }); }
        else if (state === 'on') onMessage(m);
      };
      sock.onclose = () => {
        clearTimeout(timer);
        if (ws !== sock) return;
        const was = state;
        ws = null; state = 'off';
        for (const o of [...others.keys()]) removeOther(o, true);
        chip();
        if (was === 'on') hud.toast(t('ui.online.lost'), 3600);
        finish({ ok: false, why: 'noAnswer' });
      };
      sock.onerror = () => { /* onclose follows */ };
    });
  }
  function leave(quiet = false) {
    if (ws) { const s = ws; ws = null; try { s.close(); } catch (e) { /* gone */ } }
    state = 'off';
    for (const o of [...others.keys()]) removeOther(o, true);
    mesh.visible = false; mesh.count = 0;
    chip();
    if (!quiet) hud.toast(t('ui.online.off'), 2000);
  }

  // ======================================================================= the small sign in the game, the chat
  const css = document.createElement('style');
  css.textContent = `
    #online-chip { position: absolute; left: calc(12px + env(safe-area-inset-left)); top: calc(58px + env(safe-area-inset-top)); z-index: 5; display: flex; gap: 8px; align-items: center;
      font-size: 10px; letter-spacing: 0.16em; color: #dff; background: rgba(8, 14, 20, 0.5); border: 1px solid rgba(120, 220, 255, 0.35); border-radius: 14px; padding: 5px 6px 5px 11px; }
    #online-chip[hidden] { display: none; }
    #online-chip b { font-weight: 600; color: #8fe6ff; }
    #online-chip button { height: 24px; min-width: 0; padding: 0 9px; font-size: 9px; letter-spacing: 0.14em; border-radius: 11px; }
    body.cine #online-chip, body.title #online-chip { display: none; }
    #online { background: rgba(7, 9, 12, 0.94); z-index: 40; justify-content: flex-start; padding-top: max(18px, env(safe-area-inset-top)); }
    #online .menu-col { width: min(340px, 86vw); margin-top: 18px; }
    #online input { height: 44px; border-radius: 22px; border: 1px solid rgba(255, 255, 255, 0.28); background: rgba(255, 255, 255, 0.07); color: #fff; font: inherit; font-size: 13px;
      letter-spacing: 0.08em; text-align: center; padding: 0 14px; outline: none; width: 100%; box-sizing: border-box; }
    #online input::placeholder { color: rgba(255, 255, 255, 0.38); }
    #online label { font-size: 9px; letter-spacing: 0.22em; opacity: 0.6; margin: 6px 0 -4px; }
    #online .status { min-height: 30px; font-size: 11px; letter-spacing: 0.06em; line-height: 1.45; color: #ffd9a0; margin-top: 4px; }
    #online .row { display: flex; gap: 8px; } #online .row input { flex: 1 1 auto; width: auto; min-width: 0; text-transform: uppercase; } #online .row .btn { flex: 0 0 104px; width: 104px; min-width: 0; }
    #online .small { font-size: 10px; letter-spacing: 0.04em; opacity: 0.55; line-height: 1.5; }`;
  document.head.appendChild(css);
  const root = document.getElementById('ui') || document.body;
  const chipEl = document.createElement('div');
  chipEl.id = 'online-chip'; chipEl.hidden = true;
  root.appendChild(chipEl);
  function chip() {
    if (state !== 'on') { chipEl.hidden = true; return; }
    chipEl.hidden = false;
    chipEl.innerHTML = `<span>${t('ui.online.chip')} · <b>${world}</b> · ${others.size + 1}</span>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = t('ui.online.chat');
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const m = window.prompt(t('ui.online.chatAsk'), ''); if (m && m.trim()) say(m.trim()); });
    chipEl.appendChild(b);
  }
  function say(text) { const m = String(text).slice(0, 80); send({ t: 'e', k: 'say', m }); hud.toast(`${saved.name || 'YOU'}: ${m}`, 3000); }

  // ======================================================================= the ONLINE screen
  const scr = document.createElement('div');
  scr.className = 'screen'; scr.id = 'online'; scr.hidden = true;
  (document.getElementById('title') ? document.getElementById('title').parentNode : root).appendChild(scr);
  const WHY = { noServer: 'ui.online.noServer', needWss: 'ui.online.needWss', badAddress: 'ui.online.badAddress', noAnswer: 'ui.online.noAnswer', code: 'ui.online.badCode', full: 'ui.online.full' };
  function openMenu({ onBack, onJoined }) {
    scr.hidden = false;
    scr.innerHTML = `<h2>${t('ui.online')}</h2><div class="menu-col">
      <label>${t('ui.online.name')}</label><input id="on-name" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="NATE">
      <button class="btn main" id="on-main">${t('ui.online.main')}</button>
      <button class="btn" id="on-new">${t('ui.online.new')}</button>
      <div class="row"><input id="on-code" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="${t('ui.online.code')}"><button class="btn" id="on-join">${t('ui.online.join')}</button></div>
      <div class="status" id="on-status"></div>
      <label>${t('ui.online.server')}</label><input id="on-server" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="wss://your-world-server">
      <div class="small">${t('ui.online.about')}</div>
      <button class="btn" id="on-back">${t('ui.back')}</button></div>`;
    const $ = (id) => scr.querySelector('#' + id);
    $('on-name').value = saved.name || '';
    $('on-server').value = serverAddress();
    const status = (key, extra = '') => { $('on-status').textContent = key ? t(key) + extra : ''; };
    if (!serverAddress()) status('ui.online.noServer');
    let busy = false;
    const go = async (wantWorld) => {
      if (busy) return;
      saved.name = ($('on-name').value || '').replace(/[^\w .\-]/g, '').trim().slice(0, 14).toUpperCase();
      const addr = ($('on-server').value || '').trim();
      if (addr !== (urlServer || '')) saved.server = addr;
      store();
      busy = true; status('ui.online.connecting');
      // (after a few seconds without an answer: the server is probably waking up - say so, the player waits)
      const slow = setTimeout(() => { if (busy) status('ui.online.waking'); }, 4000);
      const r = await connect(wantWorld, saved.name || 'PLAYER');
      clearTimeout(slow);
      busy = false;
      if (!r.ok) { status(WHY[r.why] || 'ui.online.noAnswer'); return; }
      scr.hidden = true;
      onJoined(r);
      hud.toast(r.own ? t('ui.online.ownWorld').replace('{code}', r.world) : t('ui.online.inMain').replace('{world}', r.world), r.own ? 9000 : 3600);
    };
    const press = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    press('on-main', () => go('MAIN'));
    press('on-new', () => go('NEW'));
    press('on-join', () => { const c = ($('on-code').value || '').trim().toUpperCase(); if (c.length < 4) status('ui.online.badCode'); else go(c); });
    press('on-back', () => { scr.hidden = true; onBack(); });
    // (a tap on a field must reach the field: the game's own touch handling must not take it)
    for (const el of scr.querySelectorAll('input')) for (const ev of ['pointerdown', 'touchstart', 'keydown', 'keyup']) el.addEventListener(ev, (e) => e.stopPropagation());
  }

  // ======================================================================= every frame
  function update(dt, ctx = {}) {
    if (state !== 'on') { if (mesh.visible) { mesh.visible = false; mesh.count = 0; } return; }
    // ---- my own state, ten times a second ----
    sendT -= dt;
    if (sendT <= 0) {
      sendT = SEND_EVERY;
      const c = ctx.car;
      if (c) send({ t: 's', x: c.x, y: c.y, z: c.z, h: c.heading, k: c.kind || '', sp: c.forward || 0, w: '' });
      else if (ctx.inside) send({ t: 's', x: ctx.inside.x, y: 0, z: ctx.inside.z, h: 0, k: 'inside', sp: 0, w: '' });
      else send({ t: 's', x: player.position.x, y: player.position.y, z: player.position.z, h: player.heading, k: '', sp: player.speed || 0, w: ctx.weapon || '',
        a: player.actions ? player.actions.stateName : '' });
    }
    // ---- the others ----
    let n = 0;
    const k = 1 - Math.exp(-10 * dt);
    for (const o of others.values()) {
      if (!o.seen) { o.tag.sp.visible = false; continue; }
      const onFoot = o.k === '' , hidden = o.k === 'inside';
      let hx = o.x, hy = o.y, hz = o.z, top = 2.0;
      if (!onFoot && !hidden) {
        const v = carFor(o);
        if (v) { hx = v.x; hy = v.y; hz = v.z; top = (v.info.roof || 1.4) + 0.75; o.x = v.x; o.z = v.z; o.y = v.y; o.h = v.heading; }
      } else dropCar(o);
      if (onFoot || (!hidden && !o.car)) {
        // glide to the place the network gave; the legs walk as fast as they move
        const ox = o.x, oz = o.z;
        // INTERPOLATION: where the last message said, moved on by its speed for the time since (at most 0.15 s)
        const ahead = o.at ? Math.min(0.15, performance.now() / 1000 - o.at) : 0;
        const gx = o.tx + (o.vx || 0) * ahead, gz = o.tz + (o.vz || 0) * ahead;
        o.x += (gx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (gz - o.z) * k;
        let dh = o.th - o.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); o.h += dh * k;
        const sp = Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-4);
        o.ph = sp > 0.35 ? o.ph + Math.max(sp, 1.2) * dt * 4.4 * (sp > 3 ? 1.5 : 1) : 0;
        if (n < MAX) {
          // the animation state (the same names as src/characters/animStates.js), blended in over 0.15 s
          o.aT = (o.aT || 0) + dt;
          const a = o.a || '', bl = Math.min(1, o.aT / 0.15);
          o.crouchK = (o.crouchK || 0) + (((a === 'crouch' || a === 'enterCar' || a === 'exitCar') ? 1 : 0) - (o.crouchK || 0)) * Math.min(1, dt * 12);
          const hitBack = a === 'getHit' ? Math.sin(Math.PI * Math.min(1, o.aT / 0.45)) : 0;
          // the arms and the bend (the worker shader): a strike, bending down to pick up, arms in front
          const kind = a === 'attack' ? 1 : a === 'pickup' ? 2 : o.crouchK > 0.5 || a === 'getHit' ? 3 : 0;
          work.setXY(n, bl > 0.3 || kind === 3 ? kind : 0, o.id * 1.3);
          // the whole figure: lower and bent forward when crouching, leaned back when hit
          _q.setFromAxisAngle(UP, o.h);
          const pitch = 0.2 * o.crouchK - 0.28 * hitBack;
          if (pitch) _q.multiply(_q2.setFromAxisAngle(XV, pitch));
          _s.set(1, 1 - 0.14 * o.crouchK, 1);
          _m.compose(_p.set(o.x, o.y, o.z), _q, _s);
          _s.set(1, 1, 1);
          mesh.setMatrixAt(n, _m);
          mesh.instanceColor.setXYZ(n, o.shirt[0], o.shirt[1], o.shirt[2]);
          phase.array[n] = o.ph;
          n++;
        }
        hx = o.x; hy = o.y; hz = o.z;
      }
      // the name (or, for five seconds, what they said)
      if (o.sayT > 0) { o.sayT -= dt; if (o.sayT <= 0) o.tag.redraw(o.name, false); }
      const d = Math.hypot(hx - player.position.x, hz - player.position.z);
      o.tag.sp.visible = !hidden && d < 90;
      o.tag.sp.position.set(hx, hy + top, hz);
      const sc = Math.max(1, Math.min(3.2, d / 14));
      o.tag.sp.scale.set(1.9 * sc, 0.475 * sc, 1);
    }
    mesh.count = n; mesh.visible = n > 0;
    if (n) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; phase.needsUpdate = true; work.needsUpdate = true; }
  }

  return {
    openMenu, update, leave, say, connect,
    get on() { return state === 'on'; },
    get state() { return state; },
    get world() { return world; },
    get own() { return own; },
    get count() { return others.size + (state === 'on' ? 1 : 0); },
    get others() { return [...others.values()].map((o) => ({ id: o.id, name: o.name, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), k: o.k, w: o.w, a: o.a || '', car: !!o.car })); },
    get serverAddress() { return serverAddress(); },
    set serverAddress(v) { saved.server = v; store(); },
    // something that happened here and the others should see (a shot, a swing)
    event(kind, data = {}) { if (state === 'on') send({ t: 'e', k: kind, ...data }); },
    // main.js gives the way to show another player's shot (the weapons draw it)
    set onShot(f) { onShot = f; },
  };
}
