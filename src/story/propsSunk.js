// ---------------------------------------------------------------------------
// propsSunk.js - the things of Chapter 3 ("The Sunk").
//
// A key on a cork float, a storm lantern that Lena lights, her old KVI badge
// on a cord, a chip reader, screens full of a dead company's code, a tablet,
// the Guard's surveillance drone, crates to hide behind, a child's chalk
// drawing, the floating market boat, and what is left of a flat after a raid.
// Everything is built from simple shapes and pictures drawn in code.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from './strings.js';
import { makeDrone } from '../city/models.js';

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function sunkProps(H) {
  const { std, box, tex, glowTexture } = H;
  const glowMat = (color, opacity = 0.7, size = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow', glowTexture), fog: true });
  const cyl = (rt, rb, h, seg, mat) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

  // lines of "code" on a dark screen (a canvas); key: the cache name, o: { title, lines (text keys or text), color, seed, w, h }
  function codeTex(key, o = {}) {
    return tex(key, () => {
      const w = o.w || 512, h = o.h || 320;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      g.fillStyle = '#030a09'; g.fillRect(0, 0, w, h);
      let seed = o.seed || 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      g.textBaseline = 'top';
      let y = 14;
      if (o.title) {
        g.fillStyle = '#e9b04c'; g.font = `700 ${Math.round(h * 0.06)}px monospace`;
        g.fillText(o.title, 16, y); y += h * 0.1;
      }
      // the readable lines (the reveal), then the code around them
      g.font = `600 ${Math.round(h * 0.052)}px monospace`;
      for (const l of o.lines || []) { g.fillStyle = l.startsWith('!') ? '#ff8a6a' : '#7ff0cc'; g.fillText(t(l.replace(/^!/, '')), 16, y); y += h * 0.075; }
      g.font = `${Math.round(h * 0.036)}px monospace`;
      while (y < h - 14) {
        g.fillStyle = rnd() < 0.12 ? '#c79a3e' : rnd() < 0.5 ? '#3fcfa4' : '#237a66';
        let s = '';
        const n = 10 + Math.floor(rnd() * 46);
        for (let k = 0; k < n; k++) s += rnd() < 0.16 ? ' ' : '0123456789abcdef{}()=<>;:_.'.charAt(Math.floor(rnd() * 27));
        g.fillText(s, 16 + Math.floor(rnd() * 4) * 12, y);
        y += h * 0.045;
      }
      const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 4;
      return tt;
    });
  }

  const makers = {
    // MACE'S KEY: an old boat key on a ring, a cork float so it does not sink, a paper tag
    boatKey() {
      const g = new THREE.Group();
      const metal = std(0x9b8a62, 0.35, 0.85);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0035, 6, 12), metal); bow.rotation.x = Math.PI / 2; g.add(bow);
      const blade = box(0.05, 0.003, 0.008, metal); blade.position.set(0.035, 0, 0); g.add(blade);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0018, 5, 12), std(0x8a8d90, 0.4, 0.9)); ring.position.set(-0.022, 0, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      const cork = cyl(0.014, 0.014, 0.05, 8, std(0xb98d55, 0.95)); cork.rotation.z = Math.PI / 2; cork.position.set(-0.07, 0, 0); g.add(cork);
      const band = cyl(0.0145, 0.0145, 0.01, 8, std(0xc8281f, 0.7)); band.rotation.z = Math.PI / 2; band.position.set(-0.07, 0, 0); g.add(band);
      const tag = box(0.03, 0.001, 0.02, std(0xe8dfc8, 0.95)); tag.position.set(-0.03, -0.004, 0.018); tag.rotation.y = 0.4; g.add(tag);
      return g;
    },
    // A STORM LANTERN (o.lit: the flame burns, the glass glows)
    lantern(o = {}) {
      const g = new THREE.Group();
      const metal = std(0x3b2e22, 0.55, 0.6);
      const base = cyl(0.075, 0.085, 0.06, 12, metal); base.position.y = 0.03; g.add(base);
      const glassMat = o.lit ? new THREE.MeshStandardMaterial({ color: 0xffc879, roughness: 0.2, emissive: 0xffa040, emissiveIntensity: 1.6, transparent: true, opacity: 0.85 })
        : new THREE.MeshStandardMaterial({ color: 0x9aa09a, roughness: 0.15, transparent: true, opacity: 0.45 });
      const glass = cyl(0.055, 0.06, 0.13, 12, glassMat); glass.position.y = 0.125; g.add(glass);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 12), metal); top.position.y = 0.22; g.add(top);
      for (const a of [0, 1.57, 3.14, 4.71]) { const bar = box(0.006, 0.15, 0.006, metal); bar.position.set(Math.sin(a) * 0.062, 0.13, Math.cos(a) * 0.062); g.add(bar); }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 5, 14, Math.PI), metal); handle.position.y = 0.25; g.add(handle);
      if (o.lit) {
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0 })); flame.scale.y = 1.8; flame.position.y = 0.12; g.add(flame);
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat(0xffb060, 0.55)); halo.position.y = 0.13; halo.renderOrder = 16; g.add(halo);
        g.userData.billboardPart = halo;
        g.userData.flicker = halo.material;
      }
      return g;
    },
    // LENA'S OLD BADGE on a cord (worn on the chest: it hangs from the neck bone)
    kviBadge() {
      const g = new THREE.Group();
      const t2 = tex('kvi', () => {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192;
        const c = cv.getContext('2d');
        c.fillStyle = '#e9ecef'; c.fillRect(0, 0, 128, 192);
        c.fillStyle = '#1d3b5c'; c.fillRect(0, 0, 128, 40);
        c.fillStyle = '#e9ecef'; c.font = '700 26px Arial'; c.textAlign = 'center'; c.fillText('KVI', 64, 30);
        c.fillStyle = '#9aa3ab'; c.fillRect(30, 52, 68, 76);                       // the photo (faded)
        c.fillStyle = '#6f7880'; c.beginPath(); c.arc(64, 82, 16, 0, 6.3); c.fill(); c.fillRect(42, 100, 44, 28);
        c.fillStyle = '#26323d'; c.font = '600 14px Arial'; c.fillText('MARCHETTI L.', 64, 148);
        c.fillStyle = '#6a7580'; c.font = '11px Arial'; c.fillText('SYSTEMS  ·  LVL 4', 64, 166);
        c.strokeStyle = '#c8281f'; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 184); c.lineTo(120, 184); c.stroke();
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; return tt;
      });
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.082, 0.002), [std(0xe9ecef, 0.6), std(0xe9ecef, 0.6), std(0xe9ecef, 0.6), std(0xe9ecef, 0.6), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.55 }), std(0xd8dbe0, 0.7)]);
      card.position.y = -0.2; g.add(card);
      // the cord: two lines from the neck down to the clip
      const cord = std(0x1c2c40, 0.8);
      for (const s of [-1, 1]) { const c = box(0.006, 0.2, 0.003, cord); c.position.set(s * 0.022, -0.1, 0); c.rotation.z = s * 0.12; g.add(c); }
      const clip = box(0.012, 0.012, 0.004, std(0x9aa1a8, 0.4, 0.9)); clip.position.y = -0.155; g.add(clip);
      g.userData.swing = card;
      g.userData.anim = (time) => { card.rotation.z = Math.sin(time * 1.7) * 0.08; card.rotation.y = Math.sin(time * 1.1) * 0.15; };
      return g;
    },
    // THE CHIP READER on Lena's desk: a block with a slot (the KEYSTONE chip sits in it), a status light, a cable
    chipReader(o = {}) {
      const g = new THREE.Group();
      g.add(box(0.16, 0.04, 0.11, std(0x1b1d20, 0.5, 0.4)));
      const slot = box(0.06, 0.006, 0.02, std(0x050505, 0.9)); slot.position.set(0, 0.021, 0.02); g.add(slot);
      if (o.chip !== false) { const chip = box(0.05, 0.004, 0.026, std(0x101215, 0.35, 0.5)); chip.position.set(0, 0.026, 0.035); chip.rotation.x = -0.25; g.add(chip); const gold = box(0.014, 0.0042, 0.02, std(0xc9a24a, 0.3, 0.9)); gold.position.set(-0.014, 0.027, 0.04); gold.rotation.x = -0.25; g.add(gold); }
      const led = box(0.012, 0.004, 0.012, std(0x7ff0cc, 0.4, 0, 2.2)); led.position.set(0.06, 0.022, -0.035); g.add(led);
      const cable = cyl(0.005, 0.005, 0.5, 5, std(0x111111, 0.7)); cable.rotation.x = Math.PI / 2; cable.position.set(-0.05, 0.01, -0.3); g.add(cable);
      g.userData.anim = (time) => { led.visible = (time * 4) % 1 < 0.7; };
      return g;
    },
    // A SCREEN with readable lines in it (the reveal): o.lines = text keys (a "!" in front: red), o.title, o.w (meters)
    codeScreen(o = {}) {
      const g = new THREE.Group();
      const w = o.w || 0.9, h = w * 0.62;
      const map = codeTex('code:' + (o.title || '') + (o.lines || []).join('|'), { title: o.title ? t(o.title) : '', lines: o.lines || [], seed: o.seed || 11 });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.5, 1.5, 1.5) }));
      screen.position.set(0, h / 2 + 0.06, 0.026); g.add(screen);
      const frame = box(w + 0.05, h + 0.05, 0.04, std(0x0b0c0d, 0.5, 0.4)); frame.position.set(0, h / 2 + 0.06, 0); g.add(frame);
      const foot = box(0.18, 0.06, 0.12, std(0x0b0c0d, 0.5, 0.4)); foot.position.y = 0.03; g.add(foot);
      return g;
    },
    // LENA'S TABLET: the Phantom code glows on it
    tablet() {
      const g = new THREE.Group();
      g.add(box(0.2, 0.008, 0.14, std(0x101113, 0.4, 0.5)));
      const map = codeTex('tablet', { seed: 31, w: 384, h: 256, title: t('c3.screen.tablet') });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.184, 0.124), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.4, 1.4, 1.4) }));
      s.rotation.x = -Math.PI / 2; s.position.y = 0.0045; g.add(s);
      return g;
    },
    // THE GUARD'S SURVEILLANCE DRONE: compact, a camera ball under it, the Guard's green line, a blinking light
    surveyDrone(o = {}) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(makeDrone(), std(0x15181c, 0.45, 0.55)); body.scale.setScalar(o.scale || 1.05); g.add(body);
      const line = box(0.42, 0.03, 0.2, std(0x1e9e78, 0.5, 0.1, 0.6)); line.position.y = 0.06; g.add(line);
      const cam = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std(0x0a0a0b, 0.2, 0.6)); cam.position.set(0, -0.06, 0.1); g.add(cam);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0x2a6bff, 0.1, 0.2, 1.2)); lens.position.set(0, -0.07, 0.16); g.add(lens);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3020 })); led.position.set(0, 0.08, -0.12); g.add(led);
      g.userData.blink = led;
      return g;
    },
    // CRATES: a small stack of old fish crates (somebody can hide behind them)
    crates(o = {}) {
      const g = new THREE.Group(), wood = std(0x5a4430, 0.9), blue = std(0x1d3a52, 0.8);
      const add = (x, y, z, m, r = 0) => { const b = box(0.62, 0.42, 0.42, m); b.position.set(x, y + 0.21, z); b.rotation.y = r; g.add(b); };
      add(0, 0, 0, wood); add(0.66, 0, 0.05, blue, 0.08); add(0.32, 0.42, 0.02, wood, -0.1);
      if (o.tall) add(0.33, 0.84, 0.0, blue, 0.15);
      return g;
    },
    // A CHILD'S CHALK DRAWING on a wall: a boat, the sun behind clouds, waves, three stick people
    chalkDrawing(o = {}) {
      const map = tex('chalk', () => {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
        const c = cv.getContext('2d');
        c.lineCap = 'round'; c.lineJoin = 'round';
        const line = (pts, color, w = 5) => { c.strokeStyle = color; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
        // waves
        for (let k = 0; k < 3; k++) { const y = 200 + k * 16; const pts = []; for (let x = 20; x < 500; x += 10) pts.push([x, y + Math.sin(x * 0.08 + k) * 6]); line(pts, 'rgba(120,200,230,0.85)', 4); }
        // the boat
        line([[150, 180], [330, 180], [300, 210], [180, 210], [150, 180]], 'rgba(240,235,220,0.9)', 5);
        line([[240, 180], [240, 90]], 'rgba(240,235,220,0.9)', 4);
        line([[240, 95], [300, 165], [240, 165]], 'rgba(255,190,120,0.9)', 4);
        // the sun behind a cloud
        c.strokeStyle = 'rgba(255,215,90,0.9)'; c.lineWidth = 5; c.beginPath(); c.arc(420, 70, 30, 0, 6.3); c.stroke();
        for (let a = 0; a < 6.28; a += 0.8) line([[420 + Math.cos(a) * 40, 70 + Math.sin(a) * 40], [420 + Math.cos(a) * 54, 70 + Math.sin(a) * 54]], 'rgba(255,215,90,0.9)', 4);
        line([[360, 100], [380, 85], [405, 92], [425, 80], [450, 96], [440, 110], [370, 112], [360, 100]], 'rgba(230,230,235,0.85)', 4);
        // three people in the boat (a big one, a small one, a smaller one)
        for (const [x, s] of [[200, 1], [228, 0.8], [272, 0.65]]) { c.strokeStyle = 'rgba(250,250,245,0.9)'; c.lineWidth = 4; c.beginPath(); c.arc(x, 150 - 18 * s, 8 * s, 0, 6.3); c.stroke(); line([[x, 158 - 18 * s + 8 * s], [x, 178]], 'rgba(250,250,245,0.9)', 4); }
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; return tt;
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1.7, (o.w || 1.7) / 2), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.y = (o.w || 1.7) / 4;
      return m;
    },
    // THE FLOATING MARKET BOAT: a long skiff under a patched awning, goods, a lantern on a pole, the old seller
    marketBoat() {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 5.6), std(0x3a2a1c, 0.85)); hull.position.y = 0.12; g.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.2, 4, 1), std(0x3a2a1c, 0.85)); bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.42); bow.position.set(0, 0.12, 3.35); g.add(bow);
      const deck = box(1.7, 0.04, 5.2, std(0x5c4632, 0.9)); deck.position.y = 0.4; g.add(deck);
      for (const [x, z] of [[-0.8, -2], [0.8, -2], [-0.8, 1.2], [0.8, 1.2]]) { const p = box(0.06, 1.7, 0.06, std(0x4a3a2a, 0.9)); p.position.set(x, 1.25, z); g.add(p); }
      const awn = box(1.95, 0.03, 3.6, std(0x8a3d1a, 0.95)); awn.position.set(0, 2.1, -0.4); awn.rotation.x = 0.05; g.add(awn);
      const patch = box(0.7, 0.032, 0.9, std(0x1e4a5a, 0.95)); patch.position.set(0.4, 2.12, 0.3); g.add(patch);
      // goods: crates of fish, jars, a pile of cables, bundles of greens
      const goods = [[0x2a5a6a, -0.45, -1.4], [0x7a5a2a, 0.4, -1.1], [0x3a6a2a, -0.3, 0.2], [0x9a9a8a, 0.45, 0.5], [0x5a2a1a, 0, 1.6]];
      for (const [c, x, z] of goods) { const b = box(0.55, 0.32, 0.5, std(c, 0.85)); b.position.set(x, 0.58, z); g.add(b); }
      // the seller: a seated figure in a hooded coat
      const coat = std(0x2c2a26, 0.95);
      const body = box(0.46, 0.62, 0.36, coat); body.position.set(0, 0.73, -2.2); g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), std(0x2a2622, 0.95)); head.position.set(0, 1.2, -2.18); g.add(head);
      // the lantern on its pole (it glows at night)
      const pole = box(0.04, 1.6, 0.04, std(0x2a2a2a, 0.7, 0.5)); pole.position.set(0.7, 1.2, 2.3); g.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb060 })); lamp.position.set(0.7, 1.95, 2.3); g.add(lamp);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMat(0xffa850, 0.5)); halo.position.set(0.7, 1.95, 2.3); halo.renderOrder = 16; g.add(halo);
      g.userData.billboardPart = halo;
      g.userData.flicker = halo.material;
      return g;
    },
    // WHAT IS LEFT after the raid: a piece of ceiling down at an angle, broken screens, papers, a fallen shelf
    debris(o = {}) {
      const g = new THREE.Group();
      const conc = std(0x5a5854, 0.95), dark = std(0x111213, 0.6, 0.4), paper = std(0xd8d4c8, 0.95);
      if (o.slab !== false) {
        const slab = box(4.2, 0.22, 3.0, conc); slab.position.set(0, 1.25, 0); slab.rotation.set(0.05, 0.2, 0.5); g.add(slab);
        for (let k = 0; k < 5; k++) { const r = cyl(0.012, 0.012, 1.1, 4, std(0x5a3a22, 0.7, 0.7)); r.position.set(-1.6 + k * 0.7, 2.05, -0.6 + k * 0.2); r.rotation.set(0.3, 0, 0.9 - k * 0.1); g.add(r); }
        for (let k = 0; k < 9; k++) { const c = box(0.3 + (k % 3) * 0.2, 0.18, 0.25 + (k % 2) * 0.2, conc); c.position.set(-2 + k * 0.5, 0.09, 1.6 + Math.sin(k * 7) * 0.6); c.rotation.y = k; g.add(c); }
      }
      for (let k = 0; k < 4; k++) { const s = box(0.9, 0.55, 0.05, dark); s.position.set(2.3 + k * 0.35, 0.03, -1 + k * 0.6); s.rotation.set(-Math.PI / 2 + 0.1, k * 0.7, 0); g.add(s); }
      for (let k = 0; k < 16; k++) { const p = box(0.21, 0.002, 0.3, paper); p.position.set(Math.sin(k * 3.1) * 3, 0.01, Math.cos(k * 2.3) * 2.2); p.rotation.y = k * 1.3; g.add(p); }
      const shelf = box(1.3, 2.4, 0.4, std(0x1e1f21, 0.6, 0.6)); shelf.position.set(-3.2, 0.25, -1.4); shelf.rotation.set(0, 0.3, 1.45); g.add(shelf);
      return g;
    },
    // a red distress flare that burns on a pontoon or a roof (the Tidewalkers' distraction): a bright core, a big red glow
    redFlare(o = {}) {
      const g = new THREE.Group();
      const stick = box(0.035, 0.035, 0.26, std(0x7a1410, 0.6)); stick.position.y = 0.02; g.add(stick);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd0b0 })); core.position.set(0, 0.08, 0.13); g.add(core);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(o.size || 9, o.size || 9), glowMat(0xff3a1a, 0.85)); halo.position.set(0, 0.6, 0.13); halo.renderOrder = 16; g.add(halo);
      g.userData.billboardPart = halo;
      g.userData.flicker = halo.material;
      return g;
    },
  };
  return { makers };
}
