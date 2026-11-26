// ---------------------------------------------------------------------------
// propsWanted.js - the things of Chapter 2 ("Wanted").
//
// A city that has turned against one man: posters and news screens with his
// face, Guard drones with searchlights. And the quiet things of Mace's garage:
// a covered car, an old radio, a hot drink, a data chip, a new number plate.
// Everything is built from simple shapes and pictures drawn in code.
//
// NATE'S FACE: main.js takes a picture of the player character's head
// (src/ui/portrait.js) and gives it to setPortrait(). Until then (or when there
// is no model) a plain drawn outline of a head and shoulders is used.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { makeDrone } from '../city/models.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function wantedProps(H) {
  const { std, box, tex, glowTexture } = H;
  let portrait = null;                 // a canvas with Nate's face, or null
  const redraws = [];                  // pictures with his face: drawn again when the portrait arrives

  // ---- a canvas texture that can be drawn again ----
  function canvasTex(w, h, draw, key) {
    return tex(key, () => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const redraw = () => { draw(cv.getContext('2d'), w, h); t.needsUpdate = true; };
      redraw();
      redraws.push(redraw);
      return t;
    });
  }
  // Nate's face in a box (x, y, w, h). gray: a print on paper
  function face(g, x, y, w, h, gray = false) {
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (portrait) {
      // (fill the box, cut from the middle of the picture)
      const s = Math.max(w / portrait.width, h / portrait.height), pw = portrait.width * s, ph = portrait.height * s;
      if (gray) g.filter = 'grayscale(1) contrast(1.25) brightness(1.05)';
      g.drawImage(portrait, x + (w - pw) / 2, y + (h - ph) / 2, pw, ph);
      g.filter = 'none';
    } else {
      // a plain outline of a head and shoulders (no real person)
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, gray ? '#9a9a96' : '#3a4654'); gr.addColorStop(1, gray ? '#5d5d5a' : '#1c232c');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = gray ? '#2c2c2a' : '#0e1217';
      g.beginPath(); g.ellipse(x + w / 2, y + h * 1.02, w * 0.46, h * 0.36, 0, Math.PI, 0); g.fill();
      g.fillRect(x + w * 0.42, y + h * 0.55, w * 0.16, h * 0.14);
      g.beginPath(); g.ellipse(x + w / 2, y + h * 0.42, w * 0.21, h * 0.25, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // the Guard's sign: a shield with "MG" (made up for this game)
  function shield(g, cx, cy, s, fill = '#d8dde4', ink = '#1d2a3a') {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.fillStyle = fill;
    g.beginPath(); g.moveTo(-40, -46); g.lineTo(40, -46); g.lineTo(40, 6); g.quadraticCurveTo(40, 38, 0, 54); g.quadraticCurveTo(-40, 38, -40, 6); g.closePath(); g.fill();
    g.fillStyle = ink; g.font = '700 38px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MG', 0, -2);
    g.restore();
  }

  // ---- the WANTED poster ----
  function drawPoster(g, w, h) {
    g.fillStyle = '#e6e1d4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2a3a'; g.fillRect(0, 0, w, 92);
    shield(g, 58, 46, 0.66);
    g.fillStyle = '#e8ecf1'; g.font = '700 34px Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('MERIDIAN GUARD', 104, 38);
    g.font = '400 18px Arial, sans-serif'; g.fillText('PUBLIC NOTICE  ·  PORT MERIDIAN', 106, 68);
    face(g, 96, 118, 320, 330, true);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.strokeRect(96, 118, 320, 330);
    g.textAlign = 'center';
    g.fillStyle = '#121212'; g.font = '800 76px "Arial Black", Arial, sans-serif'; g.fillText('WANTED', w / 2, 504);
    g.font = '700 40px Arial, sans-serif'; g.fillText('NATE CALLOWAY', w / 2, 566);
    g.fillStyle = '#a51d16'; g.font = '700 32px Arial, sans-serif'; g.fillText('WANTED FOR MURDER', w / 2, 610);
    g.fillStyle = '#333'; g.font = '400 17px Arial, sans-serif';
    g.fillText('DO NOT APPROACH. CALL THE GUARD ON 0-110.', w / 2, 656);
    g.fillText('A REWARD IS OFFERED.', w / 2, 680);
    // rain stains and wear
    let k = 7;
    const rnd = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(70,60,40,${0.03 + rnd() * 0.06})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 8 + rnd() * 40, 20 + rnd() * 70, 0, 0, 7); g.fill(); }
  }
  // ---- the picture on a news screen ----
  function drawNews(o) {
    return (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b1724'); gr.addColorStop(1, '#162a40');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8ecf1'; g.font = '700 34px Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(o.channel || 'MERIDIAN NOW', 40, 46);
      g.fillStyle = '#d0261c'; g.fillRect(w - 150, 22, 110, 48);
      g.fillStyle = '#fff'; g.font = '700 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('LIVE', w - 95, 47);
      if (o.face !== false) {
        face(g, 40, 100, 300, 330, false);
        g.strokeStyle = '#d0261c'; g.lineWidth = 6; g.strokeRect(40, 100, 300, 330);
      } else shield(g, 190, 265, 2.2);
      g.textAlign = 'left';
      g.fillStyle = '#d0261c'; g.fillRect(380, 110, 250, 52);
      g.fillStyle = '#fff'; g.font = '700 32px Arial, sans-serif'; g.fillText(o.tag || 'BREAKING', 396, 137);
      g.fillStyle = '#ffffff'; g.font = '800 64px Arial, sans-serif'; g.fillText(o.line1 || 'NATE CALLOWAY', 380, 222);
      g.fillStyle = '#ff6a5a'; g.font = '700 50px Arial, sans-serif'; g.fillText(o.line2 || 'WANTED FOR MURDER', 380, 292);
      g.fillStyle = '#b8c6d6'; g.font = '400 28px Arial, sans-serif';
      g.fillText(o.line3 || 'Doctor found dead in a Grid backstreet', 380, 356);
      g.fillText(o.line4 || 'The Guard asks the city for calm', 380, 398);
    };
  }
  // a long strip of headlines that scrolls along under a news screen
  function tickerTex(text, key) {
    return tex(key, () => {
      const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64;
      const g = cv.getContext('2d');
      g.fillStyle = '#d0261c'; g.fillRect(0, 0, 2048, 64);
      g.fillStyle = '#fff'; g.font = '700 34px Arial, sans-serif'; g.textBaseline = 'middle';
      let x = 10;
      while (x < 2048) { g.fillText(text, x, 34); x += g.measureText(text).width; }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
      return t;
    });
  }
  const TICKER = 'NATE CALLOWAY, WANTED FOR MURDER   ·   THE GUARD HAS CLOSED THE GRID GATES   ·   RAIN UNTIL THE WEEKEND   ·   ';

  // ---- the cloth over Theo's car: one corner can be lifted (setLift 0..1) ----
  // len, wid, height: the size of the car under it (meters). The nose is at +z, the car's left side at +x.
  function tarpGeometry(len, wid, height) {
    const prof = [[0, 0.02, 0.9], [0.06, 0.62, 0.96], [0.2, 0.86, 1.0], [0.34, 1.26, 0.9], [0.52, 1.3, 0.88], [0.66, 0.98, 0.98], [0.86, 0.78, 1.0], [0.96, 0.52, 0.94], [1, 0.02, 0.88]];
    const NL = 25, NA = 15, hk = height / 1.3;
    const pos = [], uv = [];
    const at = (t) => {        // the profile at t (0 = back, 1 = nose)
      let i = 0;
      while (i < prof.length - 2 && prof[i + 1][0] < t) i++;
      const a = prof[i], b = prof[i + 1], u = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    };
    for (let i = 0; i < NL; i++) {
      const t = i / (NL - 1), [h0, w0] = at(t), h = h0 * hk, hw = (wid / 2) * w0, z = -len / 2 + t * len;
      // across: skirt, side, shoulder, top, shoulder, side, skirt (left = +x)
      const ring = [[hw + 0.14, 0.01], [hw, h * 0.5], [hw * 0.72, h], [0, h * 1.03], [-hw * 0.72, h], [-hw, h * 0.5], [-hw - 0.14, 0.01]];
      for (let j = 0; j < NA; j++) {
        const u = (j / (NA - 1)) * (ring.length - 1), k = Math.min(ring.length - 2, Math.floor(u)), f = u - k;
        const x = ring[k][0] + (ring[k + 1][0] - ring[k][0]) * f, y = ring[k][1] + (ring[k + 1][1] - ring[k][1]) * f;
        const fold = Math.sin(i * 1.9 + j * 2.7) * 0.03 * Math.min(1, y * 3);    // small folds in the cloth
        pos.push(x + fold * 0.6, Math.max(0.005, y + fold), z + fold * 0.4);
        uv.push(j / (NA - 1), t);
      }
    }
    const idx = [];
    for (let i = 0; i < NL - 1; i++) for (let j = 0; j < NA - 1; j++) {
      const a = i * NA + j, b = a + 1, c = a + NA, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function makeTarp(o = {}) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x343a33, roughness: 0.97, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(tarpGeometry(o.len || 4.5, o.wid || 2.0, o.height || 1.3), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    let rest = null, hinge = null, lift = 0;
    const prepare = () => {
      const p = mesh.geometry.attributes.position;
      rest = p.array.slice();
      // the fold line runs across the front left corner (the driver's side)
      let len = 0, wid = 0, top = 0;
      for (let i = 0; i < p.count; i++) { len = Math.max(len, Math.abs(p.getZ(i)) * 2); wid = Math.max(wid, Math.abs(p.getX(i)) * 2); top = Math.max(top, p.getY(i)); }
      const A = new THREE.Vector3(0.12, top * 0.92, len / 2 - 1.75), B = new THREE.Vector3(wid / 2 + 0.2, top * 0.5, len / 2 - 0.25);
      const axis = B.clone().sub(A).normalize();
      // (the side of the line where the corner is; the turn that lifts the corner up, not down)
      const n2 = new THREE.Vector2(axis.z, -axis.x); const side = Math.sign(n2.x * (wid / 2 - A.x) + n2.y * (len / 2 - A.z)) || 1;
      const test = new THREE.Vector3(wid / 2, 0.05, len / 2).sub(A).applyAxisAngle(axis, 0.3).add(A);
      hinge = { A, axis, n2, side, sign: test.y > 0.05 ? 1 : -1 };
    };
    const v = new THREE.Vector3();
    function setLift(t) {
      t = Math.max(0, Math.min(1, t));
      if (Math.abs(t - lift) < 1e-4 && rest) return;
      if (!rest) prepare();
      lift = t;
      const p = mesh.geometry.attributes.position, H2 = hinge;
      for (let i = 0; i < p.count; i++) {
        v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
        const d = H2.side * (H2.n2.x * (v.x - H2.A.x) + H2.n2.y * (v.z - H2.A.z));
        const w = smooth(0, 1.1, d);
        if (w > 0 && t > 0) v.sub(H2.A).applyAxisAngle(H2.axis, H2.sign * t * 2.5 * Math.pow(w, 0.7)).add(H2.A);
        p.setXYZ(i, v.x, Math.max(0.005, v.y), v.z);
      }
      p.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    g.userData.setLift = setLift;
    g.userData.lift = () => lift;
    // a new size (the car that is under it now)
    g.userData.resize = (len, wid, height) => { mesh.geometry.dispose(); mesh.geometry = tarpGeometry(len, wid, height); rest = null; const was = lift; lift = -1; setLift(was); };
    return g;
  }

  const makers = {
    // ================================================================ the Guard and the news
    // a Meridian Guard drone: dark body with a white band, red and blue lamps, a searchlight down to the street
    policeDrone() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(makeDrone(), std(0x161a20, 0.45, 0.5)); body.scale.setScalar(2.2); g.add(body);
      const band = box(1.15, 0.07, 0.42, std(0xd8dde4, 0.5, 0.1)); band.position.y = 0.1; g.add(band);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      const blue = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2a5cff }));
      red.position.set(0.4, 0.02, 0.2); blue.position.set(-0.4, 0.02, 0.2); g.add(red, blue);
      // the searchlight: a faint cone of light in the rain, and a pool of light on the street
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 4.2, 22, 18, 1, true), beamMat);
      beam.position.y = -11.2; beam.renderOrder = 18; g.add(beam);
      const spotMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow', glowTexture) });
      const spot = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), spotMat); spot.rotation.x = -Math.PI / 2; spot.position.y = -22; spot.renderOrder = 15; g.add(spot);
      g.userData.beam = beam; g.userData.spot = spot;
      g.userData.anim = (time) => { const on = (time * 1.4) % 1 < 0.5; red.visible = on; blue.visible = !on; };
      return g;
    },
    // one WANTED poster on a wall
    poster() {
      const t = canvasTex(512, 720, drawPoster, 'poster');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.87), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }));
      m.position.y = 0.435;
      const g = new THREE.Group(); g.add(m);
      return g;
    },
    // many posters in one draw: o.list = [[x, y, z, compass degrees], ...] (the prop itself stands at 0, 0, 0)
    posters(o = {}) {
      const t = canvasTex(512, 720, drawPoster, 'poster');
      const list = o.list || [];
      const geo = new THREE.PlaneGeometry(0.62, 0.87);
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }), Math.max(1, list.length));
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      list.forEach((e, i) => {
        // (compass degrees: the way the poster looks - the same turn as everything else in the story)
        q.setFromAxisAngle(up, -(e[3] || 0) * Math.PI / 180);
        M.compose(p.set(e[0], e[1] + 0.435, e[2]), q, s);
        m.setMatrixAt(i, M);
      });
      m.count = list.length;
      m.frustumCulled = false;
      return m;
    },
    // a big street screen with the news (and a strip of headlines scrolling under it)
    //   o.w (meters), o.channel, o.tag, o.line1 ... o.line4, o.face: false (the Guard's sign instead of Nate)
    newsScreen(o = {}) {
      const w = o.w || 6, h = w * 0.5, g = new THREE.Group();
      const frame = box(w + 0.3, h + 0.6, 0.25, std(0x15171a, 0.5, 0.6)); frame.position.set(0, -0.15, -0.14); g.add(frame);
      const key = 'news:' + [o.channel, o.tag, o.line1, o.line2, o.line3, o.line4, o.face].join('|');
      const pic = canvasTex(1024, 512, drawNews(o), key);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: pic, color: 0xd8d8d8 }));
      g.add(screen);
      const strip = tickerTex(o.ticker || TICKER, 'ticker:' + (o.ticker || ''));
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.32), new THREE.MeshBasicMaterial({ map: strip, color: 0xe0e0e0 }));
      tick.position.y = -h / 2 - 0.2; g.add(tick);
      // standing on the sidewalk: two legs down to the ground (o.legs = how high the screen's middle is)
      if (o.legs) for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) { const leg = box(0.22, o.legs, 0.22, std(0x15171a, 0.5, 0.6)); leg.position.set(x, -o.legs / 2, -0.14); g.add(leg); }
      // (each screen scrolls its own copy of the strip)
      tick.material.map = strip.clone(); tick.material.map.needsUpdate = true;
      const off = Math.random();
      g.userData.anim = (time) => { tick.material.map.offset.x = (off + time * 0.045) % 1; };
      return g;
    },

    // ================================================================ Mace's garage
    // the cloth over Theo's car (see makeTarp)
    tarp: makeTarp,
    // a roller shutter for the big door: setOpen(1) = rolled up, setOpen(0) = down
    shutter(o = {}) {
      const w = o.width || 5.8, h = o.height || 3.5;
      const t = tex('shutter', () => {
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
        const g = cv.getContext('2d');
        for (let y = 0; y < 256; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#8b9096'); gr.addColorStop(0.5, '#5d6268'); gr.addColorStop(1, '#3a3e43'); g.fillStyle = gr; g.fillRect(0, y, 64, 16); }
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapT = THREE.RepeatWrapping; return tt;
      });
      const map = t.clone(); map.needsUpdate = true; map.repeat.set(1, h / 1.1);
      const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide }));
      m.castShadow = true;
      const g = new THREE.Group(); g.add(m);
      let open = o.open === undefined ? 1 : o.open;
      const set = (v) => { open = Math.max(0, Math.min(1, v)); m.scale.y = Math.max(0.02, 1 - open); m.visible = open < 0.985; };
      set(open);
      g.userData.setOpen = set; g.userData.open = () => open;
      return g;
    },
    // an old radio on a shelf, its dial glowing warm
    radio() {
      const g = new THREE.Group();
      g.add(box(0.42, 0.24, 0.16, std(0x4a2f1c, 0.7)));
      const grille = box(0.2, 0.16, 0.005, std(0x1a1410, 0.95)); grille.position.set(-0.08, 0, 0.082); g.add(grille);
      const dial = box(0.13, 0.05, 0.005, std(0xffb35a, 0.4, 0, 1.4)); dial.position.set(0.12, 0.04, 0.082); g.add(dial);
      for (const x of [0.07, 0.17]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), std(0x111, 0.5, 0.4)); k.rotation.x = Math.PI / 2; k.position.set(x, -0.05, 0.09); g.add(k); }
      g.userData.anim = (time) => { dial.material.emissiveIntensity = 1.25 + 0.15 * Math.sin(time * 9.1) * Math.sin(time * 3.3); };
      return g;
    },
    // a hot drink in a chipped mug, steam rising from it
    // (o.cold: tea gone cold - no steam, the tea lower)
    mug(o = {}) {
      const g = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 14), std(0xd9d4c8, 0.6)); cup.position.y = 0.05; g.add(cup);
      const tea = new THREE.Mesh(new THREE.CircleGeometry(0.038, 14), std(0x3a2414, 0.25)); tea.rotation.x = -Math.PI / 2; tea.position.y = o.cold ? 0.07 : 0.092; g.add(tea);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 6, 12), std(0xd9d4c8, 0.6)); handle.position.set(0.05, 0.05, 0); g.add(handle);
      if (o.cold) return g;
      const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, map: tex('glow', glowTexture), side: THREE.DoubleSide });
      const steam = [];
      for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), sm.clone()); s.rotation.y = i * 1.05; g.add(s); steam.push(s); }
      g.userData.anim = (time) => steam.forEach((s, i) => { const p = (time * 0.35 + i / 3) % 1; s.position.y = 0.12 + p * 0.16; s.material.opacity = 0.18 * Math.sin(p * Math.PI); s.scale.setScalar(0.7 + p * 0.8); });
      return g;
    },
    // Dr. Solberg's case, open: the lid stands up, dark foam inside with a slot for something small
    caseOpen() {
      const g = new THREE.Group(), metal = std(0x9aa1a8, 0.35, 0.8);
      const base = box(0.36, 0.055, 0.26, metal); base.position.y = 0.0275; g.add(base);
      const foam = box(0.33, 0.012, 0.23, std(0x1c1d20, 0.95)); foam.position.y = 0.056; g.add(foam);
      const slot = box(0.06, 0.004, 0.045, std(0x08090a, 0.9)); slot.position.set(0.02, 0.0625, 0.01); g.add(slot);
      const hinge = new THREE.Group(); hinge.position.set(0, 0.055, -0.13); hinge.rotation.x = -1.75; g.add(hinge);
      const lid = box(0.36, 0.045, 0.26, metal); lid.position.set(0, 0.0225, 0.13); hinge.add(lid);
      const lidFoam = box(0.33, 0.01, 0.23, std(0x1c1d20, 0.95)); lidFoam.position.set(0, -0.004, 0.13); hinge.add(lidFoam);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), std(0x1a1b1d, 0.6)); handle.position.set(0, 0.03, 0.135); handle.rotation.x = Math.PI / 2; g.add(handle);
      return g;
    },
    // the KEYSTONE chip: a small dark card with gold contacts
    chip() {
      const g = new THREE.Group();
      g.add(box(0.05, 0.004, 0.034, std(0x101215, 0.35, 0.5)));
      const gold = box(0.014, 0.0045, 0.022, std(0xc9a24a, 0.3, 0.9)); gold.position.x = -0.014; g.add(gold);
      const t = tex('chip', () => H.textTexture(256, 128, '#101215', [{ text: 'KEYSTONE', size: 40, color: '#b9c3cc', y: 0.5, weight: 700 }]));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.013), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }));
      label.rotation.x = -Math.PI / 2; label.position.set(0.01, 0.0026, 0); g.add(label);
      // (a thin cool light: WREN is reading it)
      const led = box(0.004, 0.003, 0.004, std(0x8fd8ff, 0.4, 0, 2)); led.position.set(0.021, 0.003, 0.012); g.add(led);
      g.userData.anim = (time) => { led.visible = (time * 3) % 1 < 0.6; };
      return g;
    },
    // a number plate: o.text. (Its front looks toward +z: on the back of a car, turn it around.)
    plate(o = {}) {
      const text = o.text || 'PM 4471';
      const t = tex('plate:' + text, () => {
        const tt = H.textTexture(512, 112, '#e4e6e2', [{ text, size: 74, color: '#15181c', y: 0.54, weight: 700, font: '"Arial Narrow", Arial, sans-serif', x: 18 }], '#15181c');
        const g = tt.image.getContext('2d'); g.fillStyle = '#23468f'; g.fillRect(8, 8, 56, 96); g.fillStyle = '#fff'; g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText('PM', 36, 58); tt.needsUpdate = true;
        return tt;
      });
      return new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.114), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.2 }));
    },
    // a paint spray gun (Mace's): grip, can, nozzle
    sprayGun() {
      const g = new THREE.Group();
      const grip = box(0.03, 0.12, 0.04, std(0x1a1b1d, 0.6)); grip.position.set(0, -0.06, 0); g.add(grip);
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10), std(0x8a8f96, 0.4, 0.7)); can.position.set(0, 0.04, 0.02); g.add(can);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.09, 6), std(0x222, 0.5, 0.5)); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0, 0.01, 0.09); g.add(nozzle);
      return g;
    },
    // the spray of paint: a soft cloud in the color of the paint (o.color)
    sprayMist(o = {}) {
      const g = new THREE.Group();
      const mats = [];
      for (let i = 0; i < 4; i++) {
        const m = new THREE.MeshBasicMaterial({ color: o.color || 0x8090a0, transparent: true, opacity: 0.45, depthWrite: false, map: tex('glow', glowTexture), side: THREE.DoubleSide });
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), m); p.rotation.y = i * 0.8; p.position.set((i - 1.5) * 0.35, 0, 0); g.add(p); mats.push(p);
      }
      g.userData.anim = (time) => mats.forEach((p, i) => { const k = (time * 1.7 + i * 0.27) % 1; p.material.opacity = 0.55 * Math.sin(k * Math.PI); p.scale.setScalar(0.6 + k * 0.9); });
      // (a little lighter than the paint itself: a fine cloud catches the light)
      g.userData.setColor = (c) => mats.forEach((p) => p.material.color.setRGB(0.35 + c[0] * 0.65, 0.35 + c[1] * 0.65, 0.35 + c[2] * 0.65, THREE.SRGBColorSpace));
      return g;
    },

    // ================================================================ the press conference
    // a lectern with the Guard's sign and two microphones
    podium() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.12, 4, 1), std(0x1d2a3a, 0.55, 0.2)); body.rotation.y = Math.PI / 4; body.position.y = 0.56; body.scale.set(1.2, 1, 0.75); g.add(body);
      const top = box(0.72, 0.04, 0.5, std(0x121a24, 0.5, 0.3)); top.position.set(0, 1.14, -0.02); top.rotation.x = -0.18; g.add(top);
      const t = tex('mgsign', () => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; shield(cv.getContext('2d'), 64, 60, 1.05); const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; return tt; });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.5 }));
      sign.position.set(0, 0.72, 0.335); g.add(sign);
      for (const x of [-0.08, 0.08]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 6), std(0x111, 0.4, 0.6)); stem.position.set(x, 1.3, 0.12); stem.rotation.x = 0.5; g.add(stem);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0x222, 0.8)); head.position.set(x, 1.44, 0.2); g.add(head);
      }
      return g;
    },
    // the wall behind the podium: the Guard's sign again and again
    pressWall(o = {}) {
      const w = o.width || 6.5, h = o.height || 2.8;
      const t = tex('presswall', () => {
        const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 448;
        const g = cv.getContext('2d');
        g.fillStyle = '#1d2a3a'; g.fillRect(0, 0, 1024, 448);
        for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
          const cx = 90 + x * 170 + (y % 2) * 85, cy = 60 + y * 110;
          shield(g, cx, cy, 0.42, '#3b4e66', '#1d2a3a');
          g.fillStyle = '#8fa2b8'; g.font = '700 15px Arial'; g.textAlign = 'center'; g.fillText('MERIDIAN GUARD', cx, cy + 36);
        }
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; return tt;
      });
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
      wall.position.y = h / 2 + 0.05; g.add(wall);
      for (const x of [-w / 2, w / 2]) { const leg = box(0.06, h + 0.1, 0.5, std(0x222428, 0.6, 0.5)); leg.position.set(x, (h + 0.1) / 2, -0.2); g.add(leg); }
      return g;
    },
    // a news camera on a tripod (a small red light on top: it is recording)
    newsCamera() {
      const g = new THREE.Group(), m = std(0x18191c, 0.5, 0.5);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 1.45, 6), m); leg.position.set(Math.sin(a) * 0.22, 0.7, Math.cos(a) * 0.22); leg.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); g.add(leg); }
      const cam = box(0.16, 0.2, 0.42, std(0x222428, 0.45, 0.4)); cam.position.y = 1.5; g.add(cam);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.16, 12), std(0x0a0a0c, 0.3, 0.6)); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.5, 0.28); g.add(lens);
      const tally = box(0.025, 0.02, 0.02, std(0xff2020, 0.4, 0, 2)); tally.position.set(0, 1.62, 0.1); g.add(tally);
      return g;
    },
    // a lamp on a stand with a soft white box (lights the faces at the press conference)
    lightStand() {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 2.1, 6), std(0x18191c, 0.5, 0.5)); pole.position.y = 1.05; g.add(pole);
      const soft = box(0.6, 0.45, 0.12, std(0xffffff, 0.5, 0, 1.6)); soft.position.set(0, 2.1, 0.06); soft.rotation.x = 0.25; g.add(soft);
      return g;
    },
    // Captain Harrow's phone: a call from IVY, with her picture
    phoneIvy() {
      const g = new THREE.Group();
      g.add(box(0.075, 0.009, 0.15, std(0x0b0c0e, 0.3, 0.4)));
      const t = tex('ivycall', () => {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
        const c = cv.getContext('2d');
        const gr = c.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#2b3d55'); gr.addColorStop(1, '#101722'); c.fillStyle = gr; c.fillRect(0, 0, 256, 512);
        // her picture: a drawn little girl with two plaits and a big smile (made up, not a real person)
        c.save(); c.beginPath(); c.arc(128, 170, 82, 0, 7); c.clip();
        c.fillStyle = '#f2c84b'; c.fillRect(40, 80, 180, 190);
        c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(128, 160, 52, Math.PI, 0); c.fill();
        c.fillStyle = '#f0c4a0'; c.beginPath(); c.arc(128, 172, 44, 0, 7); c.fill();
        c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(78, 186, 16, 0, 7); c.arc(178, 186, 16, 0, 7); c.fill();
        c.fillStyle = '#2a1d14'; c.beginPath(); c.arc(112, 166, 5, 0, 7); c.arc(144, 166, 5, 0, 7); c.fill();
        c.strokeStyle = '#8a3b2c'; c.lineWidth = 4; c.beginPath(); c.arc(128, 182, 16, 0.2, Math.PI - 0.2); c.stroke();
        c.fillStyle = '#e46a8c'; c.fillRect(70, 226, 116, 60);
        c.restore();
        c.fillStyle = '#fff'; c.font = '600 34px Arial'; c.textAlign = 'center'; c.fillText('IVY', 128, 300);
        c.font = '400 18px Arial'; c.fillStyle = '#b8c6d6'; c.fillText('calling...', 128, 330);
        c.fillStyle = '#d0352c'; c.beginPath(); c.arc(78, 440, 30, 0, 7); c.fill();
        c.fillStyle = '#2fae5a'; c.beginPath(); c.arc(178, 440, 30, 0, 7); c.fill();
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; return tt;
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshBasicMaterial({ map: t }));
      screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0052; g.add(screen);
      return g;
    },
    // a child's drawing: a house in the rain, a Guard car with its lights, MAMA and me
    drawing() {
      const t = tex('ivydrawing', () => {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 360;
        const c = cv.getContext('2d');
        c.fillStyle = '#f4f1e6'; c.fillRect(0, 0, 512, 360);
        c.lineCap = 'round'; c.lineJoin = 'round';
        const crayon = (color, wdt, pts) => { c.strokeStyle = color; c.lineWidth = wdt; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] + Math.sin(i * 7.1) * 2, p[1] + Math.cos(i * 5.3) * 2) : c.moveTo(p[0], p[1]))); c.stroke(); };
        crayon('#4a7bd0', 5, [[30, 60], [80, 30], [140, 55], [200, 28], [260, 50]]);          // a cloud
        for (let i = 0; i < 9; i++) crayon('#6a9be0', 3, [[40 + i * 25, 80 + (i % 3) * 8], [34 + i * 25, 104 + (i % 3) * 8]]);   // rain
        crayon('#f0b030', 6, [[430, 40], [470, 40], [470, 80], [430, 80], [430, 40]]);       // the sun (a square one)
        crayon('#c0392b', 6, [[60, 200], [130, 140], [200, 200]]);                           // the roof
        crayon('#8a5a2b', 6, [[70, 200], [70, 290], [190, 290], [190, 200]]);                // the house
        crayon('#2c3e50', 5, [[110, 290], [110, 245], [140, 245], [140, 290]]);
        crayon('#2c3e50', 6, [[250, 290], [250, 255], [380, 255], [380, 290], [250, 290]]);  // the Guard car
        crayon('#d0352c', 8, [[290, 248], [305, 248]]); crayon('#3060d0', 8, [[325, 248], [340, 248]]);
        crayon('#222', 7, [[275, 300], [276, 301]]); crayon('#222', 7, [[355, 300], [356, 301]]);
        crayon('#1d2a3a', 4, [[420, 200], [420, 270]]); crayon('#1d2a3a', 4, [[420, 270], [405, 300]]); crayon('#1d2a3a', 4, [[420, 270], [435, 300]]); crayon('#1d2a3a', 4, [[398, 225], [442, 225]]);
        c.strokeStyle = '#1d2a3a'; c.lineWidth = 4; c.beginPath(); c.arc(420, 188, 13, 0, 7); c.stroke();
        crayon('#1d2a3a', 6, [[404, 174], [436, 174]]);                                      // her Guard cap
        crayon('#e46a8c', 4, [[470, 240], [470, 280]]); crayon('#e46a8c', 4, [[470, 280], [460, 300]]); crayon('#e46a8c', 4, [[470, 280], [480, 300]]);
        c.strokeStyle = '#e46a8c'; c.beginPath(); c.arc(470, 228, 10, 0, 7); c.stroke();
        c.fillStyle = '#1d2a3a'; c.font = '700 30px "Comic Sans MS", "Chalkboard SE", cursive'; c.fillText('MAMA', 380, 340);
        c.fillStyle = '#c0407a'; c.fillText('ME', 452, 340);
        c.fillStyle = '#d0352c'; c.font = '700 36px "Comic Sans MS", cursive'; c.fillText('♥', 222, 120);
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; return tt;
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.148), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 }));
      m.rotation.x = -Math.PI / 2;
      return m;
    },

    // ================================================================ the video on the chip
    // a white room: walls, a floor and one white chair (o.size: [width, height, depth])
    whiteRoom(o = {}) {
      const [w, h, d] = o.size || [5, 2.9, 5];
      const g = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0xe9e9e4, side: THREE.BackSide }));
      walls.position.y = h / 2; g.add(walls);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xcfcfca, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; g.add(floor);
      const cm = std(0xf2f2ee, 0.6);
      const seat = box(0.46, 0.05, 0.44, cm); seat.position.set(0, 0.45, 0); g.add(seat);
      const back = box(0.46, 0.5, 0.04, cm); back.position.set(0, 0.72, -0.21); g.add(back);
      for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) { const leg = box(0.03, 0.45, 0.03, cm); leg.position.set(x, 0.225, z); g.add(leg); }
      return g;
    },
    // the cloth over a windshield, seen from inside the covered car (a little light comes through it)
    veil(o = {}) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1.9, o.h || 1.15, 6, 4), new THREE.MeshStandardMaterial({ color: 0x3b4139, roughness: 1, side: THREE.DoubleSide, emissive: 0x1a1d19, emissiveIntensity: 0.6 }));
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.7) * 0.025);   // (soft folds)
      m.geometry.computeVertexNormals();
      return m;
    },
    // something dark and flat that hides a glowing screen (a car that has been dead for four years)
    blank(o = {}) { return box(o.w || 0.37, o.h || 0.17, 0.006, std(0x0b0c0d, 0.6, 0.2)); },
    // a bandage around a wrist (put "on" a person's forearm bone with along: 'hand_L')
    bandage() {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.04, 0.075, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.95, side: THREE.DoubleSide }));
      return m;
    },
  };

  return {
    makers,
    // main.js: the picture of Nate's face is ready
    setPortrait(cv) { portrait = cv; for (const f of redraws) f(); },
    get portrait() { return portrait; },
  };
}
