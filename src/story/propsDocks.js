// ---------------------------------------------------------------------------
// propsDocks.js - the things of Chapter 5 ("Rask").
//
// A child's wristwatch that stopped, a map of the docks on the garage table, a
// small crate to carry, a crate floating in the harbor, floating junk a boat can
// jump from, the gate of the watched yard, the HALO cores in container 77 (one
// of them labelled with a name), a sealed package and the drawing inside it, a
// bank record on Lena's screen, Mace's old armchair.
// Everything is built from simple shapes and pictures drawn in code.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from './strings.js';

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function docksProps(H) {
  const { std, box, tex, textTexture, glowTexture } = H;
  const cyl = (rt, rb, h, seg, mat) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  const glowMat = (color, opacity = 0.6) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow', glowTexture), fog: true });
  const canvas = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; };

  // the dial of the child's watch: big friendly numbers, a little boat at the bottom, the hands stopped at 4:12
  const watchFace = () => tex('watchFace', () => canvas(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#f3efe2'; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
    const cols = ['#d6392f', '#2a6fc9', '#e3a21a', '#3a9a4a'];
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 30px Arial, sans-serif';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = cols[i % 4];
      g.fillText(String(i), c + Math.sin(a) * 92, c - Math.cos(a) * 92);
    }
    // a small sailing boat painted on the dial
    g.fillStyle = '#2a6fc9'; g.beginPath(); g.moveTo(c - 30, c + 42); g.lineTo(c + 30, c + 42); g.lineTo(c + 20, c + 56); g.lineTo(c - 20, c + 56); g.fill();
    g.fillStyle = '#d6392f'; g.beginPath(); g.moveTo(c + 2, c + 40); g.lineTo(c + 2, c + 10); g.lineTo(c + 24, c + 40); g.fill();
    // the hands: stopped (4:12)
    const hand = (ang, len, wdt, col) => { g.save(); g.translate(c, c); g.rotate(ang); g.fillStyle = col; g.fillRect(-wdt / 2, -len, wdt, len + 10); g.restore(); };
    hand(((4 + 12 / 60) / 12) * Math.PI * 2, 56, 9, '#222');
    hand((12 / 60) * Math.PI * 2, 84, 6, '#222');
    g.fillStyle = '#d6392f'; g.beginPath(); g.arc(c, c, 8, 0, Math.PI * 2); g.fill();
  }));

  // A CHILD'S DRAWING OF A SHIP (in the sealed package): wax crayons on cheap paper
  const shipDrawing = () => tex('shipDrawing', () => canvas(512, 360, (g, w, h) => {
    g.fillStyle = '#f1ead8'; g.fillRect(0, 0, w, h);
    const crayon = (col, wdt) => { g.strokeStyle = col; g.lineWidth = wdt; g.lineCap = 'round'; g.lineJoin = 'round'; };
    // the sea: wavy blue lines
    crayon('#2f6fd0', 6);
    for (let r = 0; r < 4; r++) { g.beginPath(); for (let x = 10; x < w - 10; x += 8) g.lineTo(x, 262 + r * 22 + Math.sin(x * 0.07 + r) * 6); g.stroke(); }
    // the hull, red, too big for the paper; a funnel with smoke; round windows
    crayon('#c8322a', 7);
    g.beginPath(); g.moveTo(70, 200); g.lineTo(440, 196); g.lineTo(400, 258); g.lineTo(110, 262); g.closePath(); g.stroke();
    g.fillStyle = 'rgba(200,50,42,0.55)'; g.fill();
    crayon('#3a3a3a', 6); g.strokeRect(250, 140, 50, 58);
    crayon('#8a8a8a', 5); g.beginPath(); g.arc(285, 110, 16, 0, 6.3); g.stroke(); g.beginPath(); g.arc(310, 80, 20, 0, 6.3); g.stroke();
    crayon('#2f6fd0', 5); for (const x of [150, 200, 350]) { g.beginPath(); g.arc(x, 222, 10, 0, 6.3); g.stroke(); }
    // two stick people on the deck: a tall one and a small one, holding hands
    crayon('#222', 5);
    const person = (x, top, s) => { g.beginPath(); g.arc(x, top, 9 * s, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(x, top + 9 * s); g.lineTo(x, top + 40 * s); g.lineTo(x - 10 * s, top + 58 * s); g.moveTo(x, top + 40 * s); g.lineTo(x + 10 * s, top + 58 * s); g.moveTo(x - 14 * s, top + 22 * s); g.lineTo(x + 14 * s, top + 22 * s); g.stroke(); };
    person(170, 120, 1.25); person(205, 148, 0.8);
    // a yellow sun in the corner, and the child's letters
    crayon('#e8b21c', 7); g.beginPath(); g.arc(450, 62, 30, 0, 6.3); g.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; g.beginPath(); g.moveTo(450 + Math.cos(a) * 40, 62 + Math.sin(a) * 40); g.lineTo(450 + Math.cos(a) * 56, 62 + Math.sin(a) * 56); g.stroke(); }
    g.fillStyle = '#2f6fd0'; g.font = '700 34px "Comic Sans MS", "Chalkboard SE", cursive';
    g.fillText(t('c5.drawing.text'), 30, 52);
  }));

  // THE BANK RECORD on Lena's screen (the last scene): plain white text on dark blue, one line marked
  const bankTex = () => tex('bankRecord', () => canvas(640, 400, (g, w, h) => {
    g.fillStyle = '#0b1a2a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#13283f'; g.fillRect(0, 0, w, 56);
    g.fillStyle = '#9fc4e8'; g.font = '700 24px monospace'; g.fillText(t('c5.bank.title'), 22, 36);
    g.font = '18px monospace';
    const rows = [['c5.bank.r1', false], ['c5.bank.r2', false], ['c5.bank.r3', true], ['c5.bank.r4', false], ['c5.bank.r5', false]];
    rows.forEach(([k, mark], i) => {
      const y = 100 + i * 52;
      if (mark) { g.fillStyle = 'rgba(240, 200, 90, 0.18)'; g.fillRect(12, y - 30, w - 24, 46); g.strokeStyle = '#f0c85a'; g.lineWidth = 2; g.strokeRect(12, y - 30, w - 24, 46); }
      g.fillStyle = mark ? '#ffe7a0' : '#7d9bb8';
      g.fillText(t(k), 24, y);
    });
    g.fillStyle = '#5a7896'; g.font = '14px monospace'; g.fillText(t('c5.bank.foot'), 22, h - 20);
  }));

  // THE MAP OF THE DOCKS on the garage table: yards, the channel, a red circle around one yard
  const mapTex = () => tex('docksMap', () => canvas(512, 384, (g, w, h) => {
    g.fillStyle = '#d9d2bd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d9fb4'; g.fillRect(0, h * 0.72, w, h * 0.28);            // the sea
    g.fillStyle = '#7d9fb4'; g.fillRect(w * 0.47, h * 0.5, w * 0.05, h * 0.24); // the channel
    g.strokeStyle = '#3d3a33'; g.lineWidth = 2;
    for (const [x, y, ww, hh] of [[0.06, 0.5, 0.36, 0.2], [0.58, 0.5, 0.34, 0.2], [0.08, 0.12, 0.18, 0.14], [0.32, 0.12, 0.16, 0.14], [0.6, 0.12, 0.12, 0.14], [0.78, 0.12, 0.14, 0.14]]) g.strokeRect(x * w, y * h, ww * w, hh * h);
    g.fillStyle = '#3d3a33';
    for (let r = 0; r < 3; r++) for (const x0 of [0.08, 0.6]) for (let k = 0; k < 4; k++) g.fillRect((x0 + k * 0.08) * w, (0.53 + r * 0.06) * h, 0.065 * w, 0.025 * h);
    g.strokeStyle = '#6b6555'; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(0, h * 0.4); g.lineTo(w, h * 0.4); g.stroke(); g.setLineDash([]);
    // Lena's marks: a red circle on yard B, a route in pencil
    g.strokeStyle = '#c42a22'; g.lineWidth = 4; g.beginPath(); g.ellipse(w * 0.24, h * 0.6, w * 0.2, h * 0.13, 0, 0, 6.3); g.stroke();
    g.fillStyle = '#c42a22'; g.font = '700 26px Arial'; g.fillText('77', w * 0.21, h * 0.47);
    g.strokeStyle = '#4a4a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.5, h * 0.95); g.bezierCurveTo(w * 0.5, h * 0.8, w * 0.45, h * 0.6, w * 0.3, h * 0.6); g.stroke();
  }));

  const M = {
    // ---- THE WATCH: a child's wristwatch, plastic, a red strap with yellow stars. It stopped at 4:12.
    //      o.wrist: the strap closed in a loop (on Rask's wrist); else lying open, face up
    stopWatch(o = {}) {
      const g = new THREE.Group();
      const caseMat = std(0x2a6fc9, 0.45), strapMat = std(0xb8322a, 0.7);
      const body = cyl(0.021, 0.021, 0.009, 24, caseMat); g.add(body);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.0175, 24), new THREE.MeshStandardMaterial({ map: watchFace(), roughness: 0.3 }));
      face.rotation.x = -Math.PI / 2; face.position.y = 0.0048; g.add(face);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0182, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12 }));
      glass.rotation.x = -Math.PI / 2; glass.position.y = 0.0052; g.add(glass);
      const crown = box(0.004, 0.004, 0.004, std(0xc9c9c9, 0.3, 0.8)); crown.position.set(0.023, 0, 0); g.add(crown);
      if (o.wrist) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 24), strapMat);
        loop.scale.set(1, 0.75, 1.6); loop.position.y = -0.02; loop.rotation.x = Math.PI / 2; loop.rotation.y = Math.PI / 2; g.add(loop);
      } else {
        for (const s of [-1, 1]) {
          const strap = box(0.016, 0.0025, 0.075, strapMat); strap.position.set(0, -0.003, s * 0.058); g.add(strap);
          for (let k = 0; k < 3; k++) { const star = box(0.004, 0.003, 0.004, std(0xf2c230, 0.5)); star.position.set(0, -0.0012, s * (0.035 + k * 0.016)); g.add(star); }
        }
      }
      return g;
    },
    // ---- a small wooden crate (one man can carry it): o.size
    crate(o = {}) {
      const s = o.size || 1, g = new THREE.Group();
      g.add(box(0.56 * s, 0.4 * s, 0.44 * s, std(0x6b4a2c, 0.9)));
      for (const y of [-0.17, 0.17]) { const b = box(0.58 * s, 0.05 * s, 0.46 * s, std(0x4a321d, 0.9)); b.position.y = y * s; g.add(b); }
      const st = box(0.04 * s, 0.42 * s, 0.46 * s, std(0xc78a1a, 0.6)); g.add(st);
      const stamp = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * s, 0.12 * s), new THREE.MeshStandardMaterial({ map: tex('crateStamp', () => textTexture(128, 64, null, [{ text: 'R / D', size: 34, color: '#1b1b1b', y: 0.55, weight: 800 }])), transparent: true, roughness: 0.9 }));
      stamp.position.set(0.16 * s, 0, 0.222 * s); g.add(stamp);
      g.children.forEach((m) => { m.castShadow = true; });
      g.userData.solid = [{ c: [0, 0], r: 0.32 * s }];
      return g;
    },
    // ---- a crate floating in the harbor with an orange buoy on a rope (it rocks on the water)
    floatCrate() {
      const g = new THREE.Group(), inner = new THREE.Group();
      inner.add(box(0.9, 0.62, 0.7, std(0x5d3f24, 0.9)));
      const band = box(0.92, 0.1, 0.72, std(0x22262a, 0.6, 0.5)); band.position.y = 0.18; inner.add(band);
      const buoy = cyl(0.16, 0.16, 0.34, 12, std(0xff6a12, 0.5)); buoy.position.set(0.9, -0.05, 0.2); inner.add(buoy);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd08a }));
      lamp.position.set(0.9, 0.16, 0.2); inner.add(lamp);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat(0xffb060, 0.7)); glow.position.copy(lamp.position); inner.add(glow);
      inner.position.y = -0.15;
      g.add(inner);
      g.userData.billboardPart = glow;
      g.userData.anim = (time) => { inner.position.y = -0.15 + Math.sin(time * 1.3) * 0.08; inner.rotation.z = Math.sin(time * 0.9) * 0.07; inner.rotation.x = Math.sin(time * 1.1 + 1) * 0.05; lamp.visible = (time * 1.2) % 1 < 0.6; glow.visible = lamp.visible; };
      return g;
    },
    // ---- FLOATING JUNK a boat can jump from: a raft of pallets and drums with a long plank lying up on it.
    //      userData.boatRamp tells the boat physics where the slope is (o.len, o.w, o.h)
    debrisRamp(o = {}) {
      const len = o.len || 7, w = o.w || 3.2, h = o.h || 1.3, g = new THREE.Group(), inner = new THREE.Group();
      for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) for (let k = 0; k < 3; k++) {
        const d = cyl(0.3, 0.3, 0.9, 12, std([0x23406b, 0x7a2a1e, 0x3c3f42][k], 0.6, 0.3)); d.rotation.x = Math.PI / 2; d.position.set(x, -0.05, -len / 2 + 1 + k * (len - 2) / 2); inner.add(d);
      }
      // the plank: from the water up to h, along +z (the boat comes from -z)
      const slope = Math.atan2(h, len);
      const plank = box(w, 0.12, Math.hypot(len, h), std(0x6a5038, 0.85));
      plank.rotation.x = -slope; plank.position.set(0, h / 2 + 0.05, 0); inner.add(plank);
      for (let k = -2; k <= 2; k++) { const slat = box(w * 1.02, 0.04, 0.12, std(0x4a3524, 0.9)); slat.rotation.x = -slope; slat.position.set(0, h / 2 + 0.12 + (k / 5) * h, (k / 5) * len); inner.add(slat); }
      // yellow and black stripes on the top edge (somebody's warning)
      const stripe = box(w, 0.06, 0.25, std(0xe0b21c, 0.6)); stripe.position.set(0, h + 0.08, len / 2 - 0.12); inner.add(stripe);
      g.add(inner);
      g.userData.boatRamp = { len, w, h };
      g.userData.anim = (time) => { inner.position.y = Math.sin(time * 1.1 + len) * 0.06; inner.rotation.z = Math.sin(time * 0.8) * 0.025; };
      return g;
    },
    // ---- THE GATE of the watched yard: a sliding chain-link gate on wheels, a motor box with a green light.
    //      o.open: slid aside (no longer in the way). Closed it is solid.
    yardGate(o = {}) {
      const w = o.w || 8.4, g = new THREE.Group(), slide = new THREE.Group();
      const frame = std(0x5b5f62, 0.5, 0.7);
      for (const y of [0.15, 1.2, 2.25]) { const b = box(w, 0.06, 0.06, frame); b.position.y = y; slide.add(b); }
      for (const x of [-w / 2, -w / 4, 0, w / 4, w / 2]) { const p = box(0.07, 2.2, 0.07, frame); p.position.set(x, 1.2, 0); slide.add(p); }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.1), new THREE.MeshStandardMaterial({ color: 0x9a9ea0, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      mesh.position.y = 1.2; slide.add(mesh);
      for (const x of [-w / 2 + 0.5, w / 2 - 0.5]) { const wh = cyl(0.12, 0.12, 0.08, 12, std(0x222222, 0.6)); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.12, 0); slide.add(wh); }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({ map: tex('gateSign', () => textTexture(256, 96, '#c9b01c', [{ text: t('c5.sign.gate'), size: 30, color: '#111', y: 0.38, weight: 800 }, { text: t('c5.sign.gate2'), size: 18, color: '#111', y: 0.75 }])), roughness: 0.7 }));
      sign.position.set(0, 1.45, 0.05); slide.add(sign);
      slide.position.x = o.open ? w * 0.95 : 0;
      g.add(slide);
      if (!o.open) g.userData.solid = [{ line: [[-w / 2, 0], [w / 2, 0]], r: 0.3 }];
      return g;
    },
    // ---- THE HALO CORES: rows of small units in a rack inside the container, cold blue light.
    //      One of them carries a paper label: M. RASK (o.label = which one, counted from the doors)
    haloRack(o = {}) {
      const rows = o.rows || 4, cols = o.cols || 6, g = new THREE.Group();
      const rackMat = std(0x15181b, 0.5, 0.6), coreMat = std(0x2a2f36, 0.35, 0.7);
      const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.75, 1.6) });
      const gm = glowMat(0x6fb6ff, 0.35);
      for (const side of [-1, 1]) {
        const rack = box(0.5, rows * 0.42 + 0.1, cols * 0.62 + 0.2, rackMat); rack.position.set(side * 0.82, (rows * 0.42 + 0.1) / 2, 0); g.add(rack);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const y = 0.27 + r * 0.42, z = -((cols - 1) * 0.62) / 2 + c * 0.62;
          const unit = box(0.36, 0.3, 0.5, coreMat); unit.position.set(side * 0.62, y, z); g.add(unit);
          const strip = box(0.01, 0.05, 0.4, lightMat); strip.position.set(side * 0.44, y + 0.08, z); g.add(strip);
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), gm); glow.position.set(side * 0.43, y + 0.08, z); glow.rotation.y = side * Math.PI / 2; g.add(glow);
        }
      }
      // the label: on the left side, second row from the bottom, nearest the doors (label -1: none)
      if ((o.label ?? 0) >= 0) {
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.09), new THREE.MeshStandardMaterial({ map: tex('raskLabel', () => textTexture(256, 88, '#efe9d8', [{ text: t('c5.label.rask'), size: 38, color: '#1d1d1d', y: 0.52, weight: 700, font: '"Courier New", monospace' }], '#9a927c')), roughness: 0.9 }));
      lab.position.set(-0.437, 0.27 + 0.42 - 0.07, -((cols - 1) * 0.62) / 2 + 0.62 * (o.label || 0)); lab.rotation.y = Math.PI / 2;
      g.add(lab);
      }
      // a cold blue light fills the container (glow over everything: there is no lamp, only the cores)
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(2.2, rows * 0.42), glowMat(0x3f7fd0, 0.12)); haze.position.set(0, rows * 0.21 + 0.2, -cols * 0.31 - 0.2); g.add(haze);
      g.userData.anim = (time) => { lightMat.color.setRGB(0.42 + 0.04 * Math.sin(time * 0.7), 0.72, 1.55 + 0.1 * Math.sin(time * 0.7)); };
      return g;
    },
    // ---- CONTAINER 77, OPEN, on its trailer in the back warehouse (the reveal). The origin is the kingpin at the front of
    //      the trailer (like the trailer of cargo.js); the container's doors at the back stand wide open and the racks of
    //      HALO cores inside glow cold blue.
    openContainer(o = {}) {
      const g = new THREE.Group(), L = 6.06, W = 2.44, Hc = 2.59, y0 = 1.25, zc = -3.55;
      const paint = std(0x1b3344, 0.7, 0.35), steel = std(0x141618, 0.6, 0.6), rubber = std(0x0b0b0c, 0.9);
      // the trailer under it: two beams, the deck, wheels
      for (const x of [-0.55, 0.55]) { const b = box(0.22, 0.32, 7.4, steel); b.position.set(x, 1.0, -3.2); g.add(b); }
      const deck = box(2.46, 0.1, 6.7, steel); deck.position.set(0, 1.2, -3.55); g.add(deck);
      for (const z of [-4.9, -5.95]) for (const sx of [-1, 1]) { const w = cyl(0.5, 0.5, 0.48, 16, rubber); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.88, 0.5, z); g.add(w); }
      // the shell: floor, roof, two sides and the front wall (the back is open)
      const t = 0.05;
      for (const [w, h, d, x, y, z] of [[W, t, L, 0, y0, zc], [W, t, L, 0, y0 + Hc, zc], [t, Hc, L, -W / 2, y0 + Hc / 2, zc], [t, Hc, L, W / 2, y0 + Hc / 2, zc], [W, Hc, t, 0, y0 + Hc / 2, zc + L / 2]]) {
        const m = box(w, h, d, paint); m.position.set(x, y, z); g.add(m);
      }
      // ribs outside, the dark inside walls
      const inner = std(0x0e1216, 0.85, 0.2);
      for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) { const m = box(0.01, Hc - 0.1, L - 0.1, inner); m.position.set(x, y0 + Hc / 2, zc); g.add(m); }
      // the two doors swung open against the sides
      for (const sx of [-1, 1]) {
        const door = new THREE.Group(); door.position.set(sx * W / 2, y0 + Hc / 2, zc - L / 2);
        const leaf = box(W / 2, Hc - 0.08, 0.06, paint); leaf.position.set(-sx * W / 4, 0, 0); door.add(leaf);
        for (const k of [0.2, 0.75]) { const bar = box(0.04, Hc - 0.3, 0.04, std(0x8a8a8a, 0.4, 0.8)); bar.position.set(-sx * W / 2 * k, 0, -0.05); door.add(bar); }
        door.rotation.y = sx * -1.85;
        g.add(door);
      }
      // the number on the sides
      const num = new THREE.MeshBasicMaterial({ map: tex('num77', () => textTexture(256, 128, null, [{ text: o.label || '77', size: 92, color: '#e8e8e0', y: 0.55, weight: 800 }])), transparent: true, depthWrite: false });
      for (const sx of [-1, 1]) { const n = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), num); n.position.set(sx * (W / 2 + 0.03), y0 + Hc * 0.6, zc); n.rotation.y = sx * Math.PI / 2; g.add(n); }
      // the racks inside
      const rack = M.haloRack({ rows: 4, cols: 8, label: -1 });
      rack.scale.setScalar(0.92);
      rack.position.set(0, y0 + 0.03, zc);
      g.add(rack);
      g.userData.anim = rack.userData.anim;
      return g;
    },
    // ---- THE HALO CORES pulled out of the container: crates with glass lids on a low steel bench, a core glowing in
    //      each. One crate carries a paper label: M. RASK (the first one on the left, nearest Nate)
    haloCrates(o = {}) {
      const g = new THREE.Group(), rows = o.rows || 2, cols = o.cols || 3;
      const wood = std(0x3c3a36, 0.8, 0.2), glass = new THREE.MeshStandardMaterial({ color: 0x9fc8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
      const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.78, 1.7) }), gm = glowMat(0x6fb6ff, 0.45);
      const bench = box(cols * 0.78 + 0.3, 0.06, rows * 0.66 + 0.2, std(0x22262a, 0.5, 0.6)); bench.position.y = 0.5; g.add(bench);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.06, 0.5, 0.06, std(0x22262a, 0.5, 0.6)); l.position.set(x * (cols * 0.39 + 0.1), 0.25, z * (rows * 0.33 + 0.05)); g.add(l); }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = -((cols - 1) * 0.78) / 2 + c * 0.78, z = -((rows - 1) * 0.66) / 2 + r * 0.66;
        const cr = box(0.62, 0.36, 0.5, wood); cr.position.set(x, 0.71, z); g.add(cr);
        const lid = box(0.6, 0.01, 0.48, glass); lid.position.set(x, 0.895, z); g.add(lid);
        const u = box(0.34, 0.16, 0.26, std(0x2a2f36, 0.35, 0.7)); u.position.set(x, 0.8, z); g.add(u);
        const strip = box(0.3, 0.02, 0.02, core); strip.position.set(x, 0.885, z + 0.08); g.add(strip);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), gm); gl.position.set(x, 0.92, z); gl.rotation.x = -Math.PI / 2; g.add(gl);
      }
      // the label on the front of the first crate (the near row, on the left seen from the front)
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ map: tex('raskLabel', () => textTexture(256, 88, '#efe9d8', [{ text: t('c5.label.rask'), size: 38, color: '#1d1d1d', y: 0.52, weight: 700, font: '"Courier New", monospace' }], '#9a927c')), roughness: 0.9 }));
      lab.position.set(((cols - 1) * 0.78) / 2, 0.72, -((rows - 1) * 0.66) / 2 - 0.252);
      lab.rotation.y = Math.PI;
      g.add(lab);
      g.userData.labelAt = [lab.position.x, lab.position.y, lab.position.z];
      return g;
    },
    // ---- the sealed package: brown paper, string, a red wax seal. o.open: the paper folded back (the drawing shows)
    sealedPackage(o = {}) {
      const g = new THREE.Group();
      if (!o.open) {
        g.add(box(0.36, 0.06, 0.26, std(0x9a7a52, 0.95)));
        for (const [w, d] of [[0.362, 0.012], [0.012, 0.262]]) { const s = box(w, 0.062, d, std(0xd9cfb4, 0.8)); g.add(s); }
        const seal = cyl(0.025, 0.025, 0.008, 14, std(0x8a1410, 0.4)); seal.position.y = 0.034; g.add(seal);
      } else {
        const paper = box(0.48, 0.004, 0.38, std(0x9a7a52, 0.95)); paper.position.y = -0.028; g.add(paper);
        const sg = new THREE.PlaneGeometry(0.34, 0.24); sg.rotateX(-Math.PI / 2); sg.rotateY(Math.PI);   // (lying flat, its top away from the one who holds it)
        const sheet = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: shipDrawing(), roughness: 0.95 }));
        sheet.position.y = -0.024; g.add(sheet);
      }
      return g;
    },
    // ---- the drawing itself, held up (in a hand: a sheet standing up)
    shipDrawing() {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.21), new THREE.MeshStandardMaterial({ map: shipDrawing(), roughness: 0.95, side: THREE.DoubleSide }));
      return m;
    },
    // ---- Lena's laptop with the bank record (the screen glows in the dark garage)
    bankLaptop() {
      const g = new THREE.Group();
      g.add(box(0.34, 0.018, 0.24, std(0x1c1e21, 0.5, 0.4)));
      const lid = new THREE.Group(); lid.position.set(0, 0.009, -0.115); lid.rotation.x = -0.32;
      const back = box(0.34, 0.22, 0.012, std(0x1c1e21, 0.5, 0.4)); back.position.y = 0.11; lid.add(back);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.195), new THREE.MeshBasicMaterial({ map: bankTex(), color: new THREE.Color(1.35, 1.35, 1.35) }));
      screen.position.set(0, 0.11, 0.007); lid.add(screen);
      g.add(lid);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), glowMat(0x7fb0e8, 0.22)); glow.position.set(0, 0.14, 0.05); g.add(glow);
      g.userData.billboardPart = glow;
      return g;
    },
    // ---- the map of the docks on the table
    docksMap() {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshStandardMaterial({ map: mapTex(), roughness: 0.95 }));
      m.rotation.x = -Math.PI / 2;
      const g = new THREE.Group(); g.add(m);
      // two coins hold the corners down
      for (const [x, z] of [[-0.28, -0.2], [0.27, 0.19]]) { const c = cyl(0.012, 0.012, 0.003, 12, std(0xb08d3a, 0.35, 0.8)); c.position.set(x, 0.002, z); g.add(c); }
      return g;
    },
    // ---- an old biscuit tin, lid off, full of folded drawings (the tea stall keeps them)
    tin() {
      const g = new THREE.Group(), metal = std(0x5a7a8a, 0.45, 0.6);
      const base = box(0.26, 0.09, 0.2, metal); base.position.y = 0.045; g.add(base);
      const lid = box(0.27, 0.015, 0.21, std(0x8a3a2a, 0.45, 0.6)); lid.position.set(0.17, 0.008, 0.12); lid.rotation.y = 0.5; g.add(lid);
      for (let i = 0; i < 9; i++) { const p = box(0.22, 0.006, 0.16, std([0xefe8d4, 0xe8dfc6, 0xf2ecdc][i % 3], 0.95)); p.position.set((i % 3 - 1) * 0.004, 0.05 + i * 0.007, (i % 2) * 0.006); p.rotation.y = (i % 4 - 1.5) * 0.04; g.add(p); }
      return g;
    },
    // ---- a guard's torch: a black tube and a bright lens (the light itself is the sentry's cone)
    torch() {
      const g = new THREE.Group();
      const tube = cyl(0.018, 0.016, 0.2, 10, std(0x111214, 0.5, 0.4)); tube.rotation.x = Math.PI / 2; g.add(tube);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c8 })); lens.position.z = 0.101; g.add(lens);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), glowMat(0xffe0a0, 0.55)); glow.position.z = 0.11; g.add(glow);
      g.userData.billboardPart = glow;
      return g;
    },
    // ---- Mace's old armchair (he falls asleep in it with the radio on)
    armchair() {
      const g = new THREE.Group(), cloth = std(0x4a3b2c, 0.95), wood = std(0x2a1d14, 0.8);
      const seat = box(0.74, 0.16, 0.66, cloth); seat.position.y = 0.36; g.add(seat);
      const back = box(0.74, 0.7, 0.16, cloth); back.position.set(0, 0.72, -0.3); back.rotation.x = -0.18; g.add(back);
      for (const s of [-1, 1]) { const arm = box(0.14, 0.22, 0.62, cloth); arm.position.set(s * 0.37, 0.52, 0.0); g.add(arm); }
      for (const [x, z] of [[-0.32, -0.28], [0.32, -0.28], [-0.32, 0.28], [0.32, 0.28]]) { const l = box(0.05, 0.28, 0.05, wood); l.position.set(x, 0.14, z); g.add(l); }
      // a worn patch and a folded blanket on one arm
      const blanket = box(0.18, 0.05, 0.5, std(0x6a2a22, 0.95)); blanket.position.set(0.37, 0.65, 0.02); g.add(blanket);
      g.children.forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
      return g;
    },
  };
  return { makers: M };
}
