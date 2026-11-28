// ---------------------------------------------------------------------------
// places.js - THE PLACES OF THE OPEN WORLD: banks and police stations.
//
// The city has a few hundred doors that open into a room (src/interiors/generate.js makes the rooms). This file
// chooses which of them are special:
//
//   3 BANKS             one in the Grid near the start, one in The Crown, one on Neon Mile
//   2 POLICE STATIONS   one in the Grid near the start, one in The Crown
//
// The choice is made from the doors themselves (the nearest fitting door to a wanted point), so it is the same
// every time the game starts.
//
// Outside, each of them has a lit sign over its door (all signs are one mesh: one draw call) and a mark on the map.
// Inside, things can be done (free roam only):
//
//   bank, the cash machine   TAKE OUT 200 CREDITS - your pay, once every five minutes
//   bank, the counter        ROB THE BANK - only with a gun in the hand: 2500 credits, the alarm, four stars
//   police, the front desk   PAY THE FINE - 300 credits for every star: the Guard stops looking for you
//
// The credits of free roam are kept apart from the money of the story (its own place in the phone's storage).
//
//   placeOf(entrance)                         the place behind a door, or null (generate.js asks this)
//   const places = createPlaces({ scene, interiors, layout, hud, sound, police, t });
//   places.update(dt, night)                  the signs glow at night
//   places.list                               [{ kind, x, z, name }] for the map
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { ENTRANCES } from '../city/entrances.js';
import { HOUSES } from '../interiors/rooms.js';

export const PLACE_INFO = {
  bank: { name: 'BANK', sign: 'MERIDIAN SAVINGS', color: '#1f6a4c', letter: '$', dot: '#5fd49a' },
  police: { name: 'POLICE', sign: 'GUARD STATION', color: '#1d3f78', letter: 'P', dot: '#6aa8ff' },
};
const WALLET_KEY = 'pg-wallet';

// ---- which doors ----
let chosen = null;               // Map: entrance id -> { kind, e }
function choose() {
  chosen = new Map();
  if (!ENTRANCES.length) return chosen;
  const taken = new Set();
  for (const h of Object.values(HOUSES)) for (const id of h.doors) taken.add(id);
  // an ordinary door at street level, wide enough, not one of the hand-made houses
  const ok = (e) => e.door !== 1 && e.door !== 3 && !taken.has(e.id) && e.y < 1 && e.w >= 1.2;
  const all = ENTRANCES.filter(ok);
  const mid = (list) => { let x = 0, z = 0; for (const e of list) { x += e.x; z += e.z; } return [x / (list.length || 1), z / (list.length || 1)]; };
  const used = [];
  // the nearest door to (x, z) that is at least "apart" meters from every place chosen before
  const take = (kind, list, x, z, apart, minD = 0) => {
    let best = null, bd = 1e12;
    for (const e of list) {
      if (chosen.has(e.id)) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < minD || d >= bd) continue;
      if (used.some((u) => Math.hypot(u.x - e.x, u.z - e.z) < apart)) continue;
      best = e; bd = d;
    }
    if (best) { chosen.set(best.id, { kind, e: best }); used.push(best); }
  };
  // (the start of the game is at about x = -16, z = 108)
  const grid = all.filter((e) => e.district === 'grid'), crown = all.filter((e) => e.district === 'crown'), neon = all.filter((e) => e.district === 'neon');
  take('police', grid, -16, 108, 60, 45);
  take('bank', grid, -16, 108, 70, 70);
  const [cx, cz] = mid(crown);
  take('bank', crown, cx, cz, 60);
  take('police', crown, cx, cz, 60, 50);
  const [nx, nz] = mid(neon);
  take('bank', neon, nx, nz, 60);
  return chosen;
}
export function placeOf(e) {
  if (!chosen || (!chosen.size && ENTRANCES.length)) choose();
  return chosen.get(e.id) || null;
}

export function createPlaces({ scene, interiors, hud, sound, police, t: text, armed = () => false, canAct = () => true }) {
  choose();
  // a text of strings.js with its numbers put in: t('ui.place.fine', { n: 600 })
  const t = (key, vars = null) => { let s = text(key); if (vars) for (const k of Object.keys(vars)) s = s.replace('{' + k + '}', String(vars[k])); return s; };
  const list = [...chosen.values()].map((p) => ({ kind: p.kind, x: p.e.x + p.e.nx * 1.2, z: p.e.z + p.e.nz * 1.2, name: PLACE_INFO[p.kind].name, id: p.e.id, e: p.e }));

  // ======================================================================= the signs over the doors
  // one picture with both signs (top half: the bank, bottom half: the police), one mesh for all of them
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  Object.values(PLACE_INFO).forEach((info, i) => {
    g.fillStyle = info.color; g.fillRect(0, i * 128, 512, 128);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, i * 128, 512, 6); g.fillRect(0, i * 128 + 122, 512, 6);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px "Helvetica Neue", Arial, sans-serif'; g.fillText(info.name, 256, i * 128 + 50);
    g.font = '26px "Helvetica Neue", Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.86)'; g.fillText(info.sign, 256, i * 128 + 100);
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [], idx = [];
  const kinds = Object.keys(PLACE_INFO);
  for (const p of list) {
    const e = p.e, w = 3.0, h = 0.75, y0 = e.y + e.h + 0.28, out = 0.16;
    // the board: across the door (the door's own "right" is (nz, -nx)), a little out from the wall
    const rx = e.nz, rz = -e.nx, cx = e.x + e.nx * out, cz = e.z + e.nz * out;
    const v0 = 1 - (kinds.indexOf(p.kind) + 1) / kinds.length, v1 = v0 + 1 / kinds.length, n = pos.length / 3;
    pos.push(cx - rx * w / 2, y0, cz - rz * w / 2, cx + rx * w / 2, y0, cz + rz * w / 2, cx + rx * w / 2, y0 + h, cz + rz * w / 2, cx - rx * w / 2, y0 + h, cz - rz * w / 2);
    uv.push(0, v0, 1, v0, 1, v1, 0, v1);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  // (a sign that lights itself: by day it is a painted board, at night it glows)
  const signMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: true });
  const signs = new THREE.Mesh(geo, signMat);
  signs.name = 'placeSigns';
  signs.matrixAutoUpdate = false;
  scene.add(signs);

  // ======================================================================= credits (free roam)
  let wallet = 0, lastPay = -1e9, lastRob = -1e9, clock = 0;
  try { const w = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null'); if (w && isFinite(w.credits)) wallet = Math.max(0, Math.round(w.credits)); } catch (e) { /* private mode */ }
  const store = () => { try { localStorage.setItem(WALLET_KEY, JSON.stringify({ credits: wallet })); } catch (e) { /* private mode */ } };
  const add = (n) => { wallet = Math.max(0, Math.round(wallet + n)); store(); if (hud.setCredits) hud.setCredits(wallet); return wallet; };

  // ======================================================================= what can be done inside
  // interiors.js asks for the button of a spot, and tells when it was pressed
  const LABEL = {
    atm: () => t('ui.place.atm'),
    teller: () => t('ui.place.rob'),
    desk: () => (police.stars > 0 ? t('ui.place.fine', { n: 300 * police.stars }) : t('ui.place.askDesk')),
  };
  function act(spot) {
    if (!canAct()) return;
    if (spot.id === 'atm') {
      if (clock - lastPay < 300) { hud.toast(t('ui.place.atmWait', { n: Math.ceil((300 - (clock - lastPay)) / 60) }), 2600); if (sound.tick) sound.tick(); return; }
      lastPay = clock; add(200);
      if (sound.cash) sound.cash();
      hud.toast(t('ui.place.atmPaid', { n: wallet }), 2600);
    } else if (spot.id === 'teller') {
      if (!armed()) { hud.toast(t('ui.place.robNoGun'), 2800); return; }
      if (clock - lastRob < 240) { hud.toast(t('ui.place.robEmpty'), 2600); return; }
      lastRob = clock; add(2500);
      if (sound.alarm) sound.alarm(6);
      if (sound.cash) sound.cash();
      hud.toast(t('ui.place.robbed', { n: wallet }), 3600);
      // the Guard knows at once where: four stars, they come to the door
      police.setStars(Math.max(police.stars, 4), { search: [interiors.anchor.x, interiors.anchor.z], radius: 60 });
    } else if (spot.id === 'desk') {
      const stars = police.stars;
      if (stars <= 0) { hud.toast(t('ui.place.deskCalm'), 2600); return; }
      const cost = 300 * stars;
      if (wallet < cost) { hud.toast(t('ui.place.fineNoMoney', { n: cost, have: wallet }), 3200); return; }
      add(-cost);
      police.setStars(0);
      if (sound.cash) sound.cash();
      hud.toast(t('ui.place.finePaid', { n: wallet }), 3000);
    }
  }
  interiors.spotLabel = (spot) => (LABEL[spot.id] ? LABEL[spot.id]() : null);
  interiors.onSpot = act;

  return {
    list,
    get credits() { return wallet; },
    add,
    // tests: do what a spot does, without walking to it
    act(id) { act({ id }); },
    update(dt, night) {
      clock += dt;
      // by day the board is lit by... nothing: it is drawn a little darker; at night it glows
      const k = 0.62 + 0.75 * night;
      signMat.color.setRGB(k, k, k);
    },
  };
}
