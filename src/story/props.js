// ---------------------------------------------------------------------------
// props.js - the small things of the story.
//
// The story tells feelings through objects: a mixtape, a photo turned face
// down, a sticker that says "80", a race ticket, a phone. They are all built
// here from a few simple shapes (and pictures drawn in code).
//
// make(kind, opts) returns a three.js object. Where it goes (on a shelf, in a
// car, in a hand, on the street) is decided by the story engine.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { makeDrone } from '../city/models.js';

// a picture with text, drawn in code. lines: [{ text, size, color, y (0..1), font, weight }]
function textTexture(w, h, bg, lines, border = null) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, w * 0.03); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const l of lines) {
    g.font = `${l.weight || 600} ${l.size}px ${l.font || 'Arial, Helvetica, sans-serif'}`;
    g.fillStyle = l.color || '#111';
    g.save(); g.translate(w / 2 + (l.x || 0), h * l.y); if (l.rot) g.rotate(l.rot); g.fillText(l.text, 0, 0); g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createProps() {
  const cache = {};
  const std = (color, rough = 0.7, metal = 0, emissive = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive });
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const tex = (key, fn) => (cache[key] = cache[key] || fn());
  // the label of the mixtape (hand-written: "DON'T SKIP")
  const tapeLabel = () => tex('tape', () => textTexture(256, 128, '#e9e2cf', [{ text: "DON'T SKIP", size: 40, color: '#1b2a6b', y: 0.4, font: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive', rot: -0.04 }, { text: 'for the car  -  T.', size: 18, color: '#1b2a6b', y: 0.78, font: '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive' }]));

  const MAKERS = {
    // a cassette: dark shell, paper label on top, two little windows
    tape() {
      const g = new THREE.Group();
      g.add(box(0.1, 0.012, 0.064, std(0x16171a, 0.5)));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.04), new THREE.MeshStandardMaterial({ map: tapeLabel(), roughness: 0.9 }));
      label.rotation.x = -Math.PI / 2; label.position.set(0, 0.0065, -0.008);
      g.add(label);
      return g;
    },
    // a photo frame lying face down: only its grey back and the little stand can be seen
    photo() {
      const g = new THREE.Group();
      g.add(box(0.19, 0.012, 0.14, std(0x3b3023, 0.8)));
      const back = box(0.17, 0.004, 0.12, std(0x6d6a63, 0.95)); back.position.y = 0.008; g.add(back);
      const stand = box(0.03, 0.004, 0.09, std(0x4a4640, 0.9)); stand.position.set(0, 0.012, 0.01); stand.rotation.y = 0.3; g.add(stand);
      return g;
    },
    // Nate's courier jacket on its hook
    jacket() {
      const g = new THREE.Group(), m = std(0x2a3540, 0.85);
      const b = box(0.07, 0.62, 0.44, m); b.position.y = -0.33; g.add(b);
      const stripe = box(0.074, 0.05, 0.445, std(0xd9a441, 0.6, 0, 0.25)); stripe.position.y = -0.2; g.add(stripe);
      for (const s of [-1, 1]) { const arm = box(0.065, 0.5, 0.11, m); arm.position.set(0.005, -0.3, s * 0.26); arm.rotation.x = s * 0.1; g.add(arm); }
      return g;
    },
    // the sticker on the van's dashboard: a red ring with "80"
    sticker80() {
      const t = tex('s80', () => { const tt = textTexture(128, 128, null, [{ text: '80', size: 62, color: '#111', y: 0.53, weight: 700 }]); const g = tt.image.getContext('2d'); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(64, 64, 58, 0, 6.3); g.fill(); g.fillStyle = '#c8281f'; g.beginPath(); g.arc(64, 64, 63, 0, 6.3); g.fill(); tt.needsUpdate = true; return tt; });
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.32 }));
      m.rotation.x = -1.15;
      return m;
    },
    // the tape deck of a car. The cassette can be seen in its window: the hand-written label "DON'T SKIP".
    // (its front looks toward -z: in a car that is toward the driver)
    deck() {
      const g = new THREE.Group();
      g.add(box(0.21, 0.078, 0.03, std(0x0c0d0f, 0.4, 0.3)));
      const frame = box(0.118, 0.062, 0.006, std(0x1c1e22, 0.5, 0.4)); frame.position.set(-0.034, 0.002, -0.0135); g.add(frame);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.106, 0.053), new THREE.MeshStandardMaterial({ map: tapeLabel(), roughness: 0.9, emissive: 0xffffff, emissiveMap: tapeLabel(), emissiveIntensity: 0.3 }));
      label.position.set(-0.034, 0.002, -0.0172); label.rotation.y = Math.PI; g.add(label);
      // a small warm lamp and three buttons
      const led = box(0.012, 0.007, 0.004, std(0xffb347, 0.4, 0, 1.8)); led.position.set(0.074, 0.022, -0.016); g.add(led);
      for (let i = 0; i < 3; i++) { const b = box(0.016, 0.012, 0.006, std(0x2a2c30, 0.5, 0.5)); b.position.set(0.05 + i * 0.022, -0.016, -0.0165); g.add(b); }
      return g;
    },
    // a phone with its screen on
    phone() {
      const g = new THREE.Group();
      g.add(box(0.075, 0.009, 0.15, std(0x0b0c0e, 0.3, 0.4)));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshBasicMaterial({ color: 0x9fd0ff }));
      screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0052; g.add(screen);
      g.userData.glow = screen.material;
      return g;
    },
    // Dr. Solberg's small case (aluminium, with a handle)
    case() {
      const g = new THREE.Group();
      g.add(box(0.36, 0.26, 0.11, std(0x9aa1a8, 0.35, 0.8)));
      for (const y of [-0.06, 0.06]) { const rib = box(0.365, 0.012, 0.115, std(0x5c6268, 0.4, 0.8)); rib.position.y = y; g.add(rib); }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), std(0x1a1b1d, 0.6)); handle.position.y = 0.13; g.add(handle);
      return g;
    },
    // the race ticket: a small worn card
    ticket() {
      const t = tex('ticket', () => textTexture(256, 128, '#d9cfb8', [{ text: 'IRONHILL NIGHT RUN', size: 21, y: 0.26, font: '"Courier New", monospace', weight: 700 }, { text: 'DRIVER  T. CALLOWAY', size: 15, y: 0.56, font: '"Courier New", monospace' }, { text: 'HOST  D. RIOS', size: 15, y: 0.78, font: '"Courier New", monospace' }], '#1a1612'));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x3a3428, emissiveIntensity: 0.5 }));
      m.rotation.x = -Math.PI / 2;
      return m;
    },
    // a parcel
    parcel(o = {}) {
      const s = o.size || 1;
      const g = new THREE.Group();
      g.add(box(0.38 * s, 0.26 * s, 0.3 * s, std(0x8a6a48, 0.9)));
      const tape = box(0.385 * s, 0.262 * s, 0.05 * s, std(0xc9c1ae, 0.7)); g.add(tape);
      return g;
    },
    // a sandwich in paper (Mace)
    sandwich() { const g = new THREE.Group(); g.add(box(0.16, 0.05, 0.1, std(0xd8d2c4, 0.9))); return g; },
    // a road flare: a short stick with a red glow (the light itself is a flat picture, always facing up)
    flare(o = {}) {
      const g = new THREE.Group();
      const stick = box(0.03, 0.03, 0.22, std(0x7a1410, 0.6)); stick.position.y = 0.02; g.add(stick);
      const mat = new THREE.MeshBasicMaterial({ color: o.color || 0xff3b20, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow', glowTexture) });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(o.size || 7, o.size || 7), mat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.035; pool.renderOrder = 14; g.add(pool);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0c0 })); core.position.set(0, 0.07, 0.11); g.add(core);
      g.userData.flicker = mat;
      return g;
    },
    cone() {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 10), std(0xe2581a, 0.6)); c.position.y = 0.33; g.add(c);
      const b = box(0.4, 0.035, 0.4, std(0x18181a, 0.8)); b.position.y = 0.018; g.add(b);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.1, 10), std(0xf2f2ee, 0.5, 0, 0.3)); band.position.y = 0.36; g.add(band);
      return g;
    },
    // a line of light across the road (start line of the race)
    startLine(o = {}) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.width || 22, 0.5), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.renderOrder = 14;
      return m;
    },
    // a rifle (only ever seen as a dark shape on a roof)
    rifle() {
      const g = new THREE.Group(), m = std(0x0c0d0f, 0.5, 0.5);
      const barrel = box(0.035, 0.035, 1.05, m); barrel.position.z = 0.42; g.add(barrel);
      const stock = box(0.05, 0.12, 0.34, m); stock.position.set(0, -0.03, -0.16); g.add(stock);
      const scope = box(0.04, 0.05, 0.26, m); scope.position.set(0, 0.06, 0.2); g.add(scope);
      return g;
    },
    // the flash of a shot: bright for a moment (the story switches it on and off)
    flash() {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, map: tex('glow', glowTexture) }));
      m.userData.billboard = true; m.renderOrder = 40;
      return m;
    },
    // the name on the garage's sign board
    garageSign(o = {}) {
      const t = tex('gsign', () => textTexture(1024, 128, '#101214', [{ text: "MACE'S  ·  REPAIRS + CHARGE", size: 64, color: '#e8dfc8', y: 0.54, weight: 700, font: '"Arial Narrow", Arial, sans-serif' }]));
      return new THREE.Mesh(new THREE.PlaneGeometry(o.width || 5, o.height || 0.62), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }));
    },
    // an awning over a doorway with a warm light under it (the two strangers argue here)
    awning() {
      const g = new THREE.Group();
      const top = box(4.2, 0.08, 1.7, std(0x5a1f1b, 0.8)); top.position.set(0, 2.75, 0.85); top.rotation.x = 0.16; g.add(top);
      const lamp = box(1.6, 0.03, 0.08, std(0xffd9a0, 0.4, 0, 2.2)); lamp.position.set(0, 2.6, 0.5); g.add(lamp);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow', glowTexture) });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.5), mat); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 1.1); pool.renderOrder = 14; g.add(pool);
      return g;
    },
    // a delivery drone with a parcel under it and a blinking lamp
    cargoDrone() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(makeDrone(), std(0x1b1d21, 0.5, 0.4)); g.add(body);
      const p = MAKERS.parcel({ size: 0.8 }); p.position.y = -0.22; g.add(p);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x66ff9a })); lamp.position.y = -0.05; lamp.position.z = 0.3; g.add(lamp);
      g.userData.blink = lamp;
      return g;
    },
  };
  // a soft round glow (white in the middle, clear at the edge)
  function glowTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  function make(kind, opts = {}) {
    const f = MAKERS[kind];
    if (!f) { console.warn('[props] unknown prop:', kind); return new THREE.Group(); }
    const o = f(opts);
    o.userData.kind = kind;
    return o;
  }
  // things that move a little by themselves: flares flicker, lamps blink
  function animate(obj, time) {
    const u = obj.userData;
    if (u.flicker) u.flicker.opacity = 0.62 + 0.25 * Math.sin(time * 23 + obj.id) + 0.13 * Math.sin(time * 57 + obj.id * 2);
    if (u.blink) u.blink.visible = (time * 1.6 + obj.id * 0.37) % 1 < 0.5;
    if (u.glow) u.glow.color.setScalar(0.75 + 0.25 * Math.sin(time * 2.2));
  }
  return { make, animate, kinds: Object.keys(MAKERS) };
}
