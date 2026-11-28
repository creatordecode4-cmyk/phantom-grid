// ---------------------------------------------------------------------------
// pickups.js - SMALL THINGS LYING ON THE SIDEWALK that Nate can pick up (free roam).
//
// A few lost wallets lie in the streets around the start. Walk near one: a soft ring shows it, the head turns to it
// (the look of animStates.js) and the PICK UP button shows. Press it: Nate walks up to it by himself, bends his
// knees and hips, reaches for it with the right hand (arm IK), holds it, stands up - the wallet is in his hand.
// A moment later it goes into his pocket: 50 credits. A wallet comes back somewhere else after three minutes.
//
// All wallets are one instanced mesh, all rings another (two draw calls).
//
//   const pickups = createPickups({ scene, player, ui, hud, sound, places, t });
//   pickups.update(dt, { can })     can: on foot in free roam
//   pickups.nearest(x, z, r)        the nearest wallet within r (for the head to look at), or null
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { softBox } from '../utils/geometry.js';
import { ENTRANCES } from '../city/entrances.js';

const COUNT = 8, CREDITS = 50, BACK_AFTER = 180;

export function createPickups({ scene, player, ui, hud, sound, places, t, layout }) {
  // ---- where: in front of shop doors of the Grid, around the start (the same places every time) ----
  const sx = layout.spawn.x, sz = layout.spawn.z;
  const spots = ENTRANCES.filter((e) => e.district === 'grid' && e.y < 1 && Math.hypot(e.x - sx, e.z - sz) < 230)
    .sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz))
    .filter((_, i) => i % 5 === 1)
    .map((e) => ({ x: e.x + e.nx * 2.4 + e.nz * 0.9, z: e.z + e.nz * 2.4 - e.nx * 0.9, y: e.y, rot: (e.x * 7.3 + e.z) % 6.28 }));
  const items = [];
  for (let i = 0; i < Math.min(COUNT, spots.length); i++) items.push({ spot: i, here: true, back: 0 });
  let nextSpot = items.length;

  // ---- the look: a brown leather wallet, and a soft gold ring on the ground around it ----
  const walletGeo = softBox(0.11, 0.024, 0.09, 0.008);
  const walletMat = new THREE.MeshStandardMaterial({ color: 0x5a3420, roughness: 0.55, metalness: 0.05 });
  const wallets = new THREE.InstancedMesh(walletGeo, walletMat, COUNT);
  wallets.name = 'pickups'; wallets.castShadow = true; wallets.frustumCulled = false;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.22, 0.3, 24).rotateX(-Math.PI / 2), ringMat, COUNT);
  rings.name = 'pickupRings'; rings.frustumCulled = false; rings.renderOrder = 5;
  scene.add(wallets, rings);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  // the one in his hand (a copy of the shape)
  const inHand = new THREE.Mesh(walletGeo, walletMat);
  inHand.visible = false;
  inHand.layers.enable(4);
  const hand = player.rig && player.rig.bones ? player.rig.bones.hand_R : null;
  if (hand) { hand.add(inHand); inHand.position.set(-0.035, 0.085, 0.02); inHand.rotation.set(0, 0, Math.PI / 2); }

  function draw(time) {
    let n = 0;
    for (const it of items) {
      if (!it.here) continue;
      const s = spots[it.spot];
      _m.compose(_p.set(s.x, s.y + 0.012, s.z), _q.setFromAxisAngle(UP, s.rot), _s.set(1, 1, 1));
      wallets.setMatrixAt(n, _m);
      const k = 1 + Math.sin(time * 3 + it.spot) * 0.08;
      _m.compose(_p.set(s.x, s.y + 0.02, s.z), _q.identity(), _s.set(k, 1, k));
      rings.setMatrixAt(n, _m);
      n++;
    }
    wallets.count = rings.count = n;
    wallets.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;
  }

  // ---- the button (shared with the doors and the bank: only when nothing else shows it) ----
  let ownPrompt = null;
  function setPrompt(label, cb) {
    if (label) { if (!ui.actShown || ui.actLabel === label) { ui.prompt(label, cb); ownPrompt = label; } }
    else if (ownPrompt) { if (ui.actShown && ui.actLabel === ownPrompt) ui.prompt(null); ownPrompt = null; }
  }

  let busy = null, clock = 0;
  function pickUp(it) {
    if (busy || !player.actions) return;
    const s = spots[it.spot];
    busy = it;
    setPrompt(null);
    // walk up to it (a little short of it, on the side he comes from), then bend down for it
    const dx = player.position.x - s.x, dz = player.position.z - s.z, d = Math.hypot(dx, dz) || 1;
    const stand = [s.x + (dx / d) * 0.42, s.z + (dz / d) * 0.42];
    const go = () => {
      player.actions.play('pickup', {
        at: [s.x, s.y + 0.02, s.z],
        onGrab: () => { it.here = false; it.back = BACK_AFTER; inHand.visible = true; if (sound.tick) sound.tick(); },
        onEnd: () => {
          // into the pocket a moment later
          setTimeout(() => {
            inHand.visible = false;
            if (!it.here) { places.add(CREDITS); hud.toast(t('ui.pickup.wallet').replace('{n}', CREDITS).replace('{all}', places.credits), 2600); if (sound.cash) sound.cash(); }
          }, 450);
          busy = null;
        },
      });
      player.faceTo(s.x, s.z);
    };
    if (d > 0.62) player.walkTo(stand[0], stand[1], go); else go();
  }

  function nearest(x, z, r) {
    let best = null, bd = r;
    for (const it of items) {
      if (!it.here) continue;
      const s = spots[it.spot], d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = { it, x: s.x, y: s.y, z: s.z, d }; }
    }
    return best;
  }

  return {
    nearest,
    get count() { return items.filter((i) => i.here).length; },
    // (tests) the places of the wallets
    get spots() { return items.filter((i) => i.here).map((i) => spots[i.spot]); },
    pickUp(index = 0) { const it = items.filter((i) => i.here)[index]; if (it) pickUp(it); return !!it; },
    update(dt, { can }) {
      clock += dt;
      // a wallet that was taken comes back three minutes later, at the next place in the list
      for (const it of items) if (!it.here && it !== busy) { it.back -= dt; if (it.back <= 0) { it.spot = nextSpot++ % spots.length; it.here = true; } }
      draw(clock);
      if (!can || busy) { if (!busy) setPrompt(null); return; }
      const n = nearest(player.position.x, player.position.z, 1.4);
      if (n) setPrompt(t('ui.pickup'), () => pickUp(n.it)); else setPrompt(null);
    },
  };
}
