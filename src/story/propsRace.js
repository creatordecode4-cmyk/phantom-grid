// ---------------------------------------------------------------------------
// propsRace.js - the things of Chapter 4 ("Chrome Wolves").
//
// Theo's blue jacket (folded on a seat, or hanging from a hand), the wolf
// engraved on the hood of Dante's car, the night market of Neon Mile (food
// stalls, soft holographic signs with their streak of light on the wet road),
// the steel guardrail of the last turn, the jump ramp over the road works, the
// finish arch, a water bottle (Dante pours a little on the ground), a rag (Nate
// cleans the windshield) and a column of smoke (the wreck below the roof).
//
// Few draw calls: every prop is a handful of meshes at most, parts of one
// color are merged into one mesh with vertex colors.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shared } from '../city/materials.js';
import { t } from './strings.js';

// THEO'S JACKET: a blue bomber with white stripes at the cuffs and the hem (as in his model)
const JACKET_BLUE = 0x1f6fc8, JACKET_TRIM = 0xe4e8ec;

// the graphics level: on LOW the signs make no streaks of light on the road (main.js sets this)
export const raceLook = { reflections: true };

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function raceProps(H) {
  const { std, box, tex, textTexture, glowTexture } = H;

  // ---- merging boxes of different colors into one mesh (one draw call) ----
  // parts: [{ g: geometry (already moved into place), c: color }]
  function merged(parts, mat) {
    const list = parts.map(({ g, c }) => {
      const q = g.index ? g.toNonIndexed() : g;
      const col = new THREE.Color(c), n = q.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
      q.setAttribute('color', new THREE.BufferAttribute(a, 3));
      for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
      return q;
    });
    const m = new THREE.Mesh(mergeGeometries(list), mat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  // a box geometry moved and turned into place
  const B = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
    g.translate(x, y, z);
    return g;
  };
  const C = (rt, rb, h, seg, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
    g.translate(x, y, z);
    return g;
  };
  const glowMat = (color, opacity = 0.7) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow', glowTexture), fog: true });

  // ---- a streak of light on the wet road under a bright sign (the same idea as the city's lamps) ----
  // It lies on the ground at the prop's own foot and stretches toward the camera; only at night and in rain.
  function wetStreak(color, height, strength = 1) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(strength) }, uH: { value: height }, uWet: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
        uniform float uH;
        varying vec2 vUv;
        varying float vLen, vFade;
        void main() {
          vUv = uv;
          vec3 foot = ( modelMatrix * vec4( 0.0, 0.03, 0.0, 1.0 ) ).xyz;
          vec2 toCam = cameraPosition.xz - foot.xz;
          float d = length( toCam );
          vec2 dir = d > 0.01 ? toCam / d : vec2( 0.0, 1.0 );
          vec2 side = vec2( -dir.y, dir.x );
          float hc = max( cameraPosition.y - foot.y, 0.3 );
          float mirror = d * uH / ( uH + hc );
          float len = clamp( mirror * 1.5, 2.5, 14.0 );
          float along = mirror + position.y * len;
          float across = position.x * ( 1.4 + 0.012 * d );
          vec3 p = foot + vec3( dir.x * along + side.x * across, 0.0, dir.y * along + side.y * across );
          gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
          vLen = len;
          vFade = 1.0 - smoothstep( 35.0, 90.0, d );
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uWet, uNight, uTime;
        varying vec2 vUv;
        varying float vLen, vFade;
        void main() {
          float across = ( vUv.x - 0.5 ) * 2.0, along = ( vUv.y - 0.5 ) * 2.0;
          float a = exp( - across * across * 4.0 ) * ( 1.0 - along * along );
          a *= 0.72 + 0.28 * sin( vUv.y * vLen * 5.0 + uTime * 2.3 + vUv.x * 3.0 );
          gl_FragColor = vec4( uColor * a * uWet * uNight * vFade * 0.6, 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = 3;
    return m;
  }

  const makers = {
    // THEO'S JACKET. { folded: true } folded on a seat (about 42 x 32 cm), else hanging from a hand by the collar
    // (the hand holds the top of the collar: the jacket hangs down from 0, 0, 0)
    theoJacket(o = {}) {
      const g = new THREE.Group();
      const blue = std(JACKET_BLUE, 0.55, 0.05), trim = std(JACKET_TRIM, 0.7);
      if (o.folded) {
        const body = box(0.42, 0.07, 0.32, blue); body.position.y = 0.035; g.add(body);
        // the folded sleeve on top, its white cuff, the collar along the back edge, the stripe of the hem
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.36, 10), blue);
        sleeve.rotation.z = Math.PI / 2; sleeve.position.set(0.0, 0.085, 0.06); g.add(sleeve);
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.035, 10), trim);
        cuff.rotation.z = Math.PI / 2; cuff.position.set(0.19, 0.085, 0.06); g.add(cuff);
        const collar = box(0.36, 0.035, 0.05, blue); collar.position.set(0, 0.085, -0.13); g.add(collar);
        const hem = box(0.425, 0.012, 0.3, trim); hem.position.set(0, 0.066, 0.0); hem.scale.z = 0.08; hem.position.z = 0.14; g.add(hem);
        // the round patch on the chest
        const patch = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), std(0xd8d2c4, 0.8));
        patch.rotation.x = -Math.PI / 2; patch.position.set(-0.11, 0.0715, -0.04); g.add(patch);
        return g;
      }
      // hanging: the body of the jacket, open in front; the sleeves hang at the sides
      const body = box(0.5, 0.6, 0.07, blue); body.position.y = -0.36; g.add(body);
      const open = box(0.07, 0.56, 0.072, std(0x0e2f58, 0.7)); open.position.set(0, -0.37, 0.002); g.add(open);
      const collar = box(0.3, 0.07, 0.09, blue); collar.position.y = -0.04; g.add(collar);
      const hem = box(0.51, 0.04, 0.075, trim); hem.position.y = -0.64; g.add(hem);
      for (const s of [-1, 1]) {
        const sl = box(0.12, 0.56, 0.11, blue); sl.position.set(s * 0.29, -0.38, 0); sl.rotation.z = s * 0.06; g.add(sl);
        const cf = box(0.125, 0.04, 0.115, trim); cf.position.set(s * 0.305, -0.65, 0); g.add(cf);
      }
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), std(0xd8d2c4, 0.8));
      patch.position.set(-0.13, -0.2, 0.037); g.add(patch);
      return g;
    },

    // THE WOLF engraved in the chrome of Dante's hood: lines cut into the metal (an original drawing: a calm wolf's
    // head from the front, made of a few straight cuts). The story lays it on the hood ({ in: 'dante', hood: true }).
    wolfDecal(o = {}) {
      const map = tex('wolf', () => {
        const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
        const c = cv.getContext('2d');
        const P = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * S, y * S) : c.moveTo(x * S, y * S))); };
        const head = [[0.5, 0.88], [0.36, 0.7], [0.26, 0.48], [0.22, 0.2], [0.36, 0.34], [0.5, 0.3], [0.64, 0.34], [0.78, 0.2], [0.74, 0.48], [0.64, 0.7], [0.5, 0.88]];
        const draw = (dark) => {
          c.lineJoin = 'round'; c.lineCap = 'round';
          c.strokeStyle = dark ? 'rgba(20,22,26,0.95)' : 'rgba(255,255,255,0.75)';
          c.lineWidth = dark ? 10 : 4;
          P(head); c.stroke();
          // the inside of the ears, the brow, the eyes (narrow, calm), the line of the nose, the jaw
          P([[0.27, 0.27], [0.33, 0.4]]); c.stroke(); P([[0.73, 0.27], [0.67, 0.4]]); c.stroke();
          P([[0.35, 0.47], [0.44, 0.5]]); c.stroke(); P([[0.65, 0.47], [0.56, 0.5]]); c.stroke();
          P([[0.5, 0.36], [0.5, 0.74]]); c.stroke();
          P([[0.44, 0.74], [0.5, 0.79], [0.56, 0.74]]); c.stroke();
          P([[0.33, 0.58], [0.42, 0.66]]); c.stroke(); P([[0.67, 0.58], [0.58, 0.66]]); c.stroke();
        };
        c.translate(3, 3); draw(false); c.setTransform(1, 0, 0, 1, 0, 0); draw(true);
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
        return tt;
      });
      const s = o.size || 0.62;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.32, metalness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.renderOrder = 2;
      return m;
    },

    // A FOOD STALL of the night market: a steel counter, a cloth roof, things on the counter, one warm bulb.
    // { cloth: color of the roof }
    vendorStall(o = {}) {
      const g = new THREE.Group();
      const cloth = o.cloth || 0x6a2a22;
      const parts = [
        { g: B(1.8, 0.95, 0.75, 0, 0.475, 0), c: 0x2b2e33 },               // the counter
        { g: B(1.9, 0.05, 0.85, 0, 0.975, 0.02), c: 0x8c9196 },             // its steel top
        { g: B(1.82, 0.08, 0.02, 0, 0.6, 0.38), c: 0x9a6a2a },              // a warm strip on the front
        { g: B(2.2, 0.04, 1.3, 0, 2.18, 0.12, -0.16), c: cloth },           // the cloth roof (tilted toward the street)
        { g: B(2.2, 0.16, 0.02, 0, 2.06, 0.76), c: cloth },                 // its front edge
        // four thin posts
        { g: B(0.05, 2.2, 0.05, -0.92, 1.1, -0.32), c: 0x3a3d42 }, { g: B(0.05, 2.2, 0.05, 0.92, 1.1, -0.32), c: 0x3a3d42 },
        { g: B(0.05, 2.05, 0.05, -0.92, 1.02, 0.5), c: 0x3a3d42 }, { g: B(0.05, 2.05, 0.05, 0.92, 1.02, 0.5), c: 0x3a3d42 },
        // pots, boxes and bowls on the counter
        { g: C(0.16, 0.14, 0.24, 10, -0.5, 1.12, -0.05), c: 0x6b6e72 },
        { g: C(0.12, 0.12, 0.18, 10, -0.15, 1.09, -0.12), c: 0x55595e },
        { g: B(0.36, 0.1, 0.24, 0.35, 1.05, -0.02), c: 0xa67c3d },
        { g: B(0.18, 0.18, 0.18, 0.72, 1.09, -0.15), c: 0x3f5f4a },
        // a stool in front
        { g: C(0.16, 0.16, 0.05, 10, 0.4, 0.62, 0.75), c: 0x7a3d2a }, { g: C(0.03, 0.03, 0.6, 6, 0.4, 0.3, 0.75), c: 0x2a2c30 },
      ];
      g.add(merged(parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.25 })));
      // the warm bulb under the roof, and its glow
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc27a }));
      bulb.position.set(0, 1.92, 0.05); g.add(bulb);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowMat(0xff9a4a, 0.55));
      glow.position.copy(bulb.position); g.add(glow);
      g.userData.billboardPart = glow;
      g.userData.solid = [{ line: [[-0.9, 0], [0.9, 0]], r: 0.45 }];   // (the counter stops cars and people)
      return g;
    },

    // A SOFT HOLOGRAPHIC SIGN: a thin projected panel above a small post (not a cartoon neon tube: soft light, fine
    // lines, a slow shimmer), and its streak of light on the wet road. { text, sub, color, w, h, y (height of the
    // panel's middle) }
    holoSign(o = {}) {
      const g = new THREE.Group();
      const w = o.w || 2.4, h = o.h || 1.1, y = o.y || 3.4, color = o.color || 0x9fe6ff;
      const col = new THREE.Color(color), css = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
      const key = 'holo:' + (o.text || '') + '|' + (o.sub || '') + '|' + color;
      const map = tex(key, () => {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
        const c = cv.getContext('2d'), W = cv.width, Hh = cv.height;
        c.clearRect(0, 0, W, Hh);
        // a thin frame, faint scan lines, the words with a soft glow
        c.strokeStyle = css; c.globalAlpha = 0.5; c.lineWidth = 3; c.strokeRect(6, 6, W - 12, Hh - 12);
        c.globalAlpha = 0.12; for (let yy = 0; yy < Hh; yy += 4) { c.fillStyle = css; c.fillRect(0, yy, W, 1); }
        c.globalAlpha = 1; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = css;
        c.shadowColor = css; c.shadowBlur = 18;
        c.font = `600 ${Math.round(Hh * 0.34)}px Arial, Helvetica, sans-serif`;
        c.fillText(t(o.text || ''), W / 2, o.sub ? Hh * 0.42 : Hh * 0.52);
        if (o.sub) { c.shadowBlur = 8; c.font = `400 ${Math.round(Hh * 0.16)}px Arial, Helvetica, sans-serif`; c.fillText(t(o.sub), W / 2, Hh * 0.75); }
        // (named tt: the name t is the text function used just above)
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 4;
        return tt;
      });
      const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      panel.position.y = y; g.add(panel);
      // the post with the little projector on top
      g.add(merged([
        { g: C(0.05, 0.06, y - h / 2 - 0.1, 8, 0, (y - h / 2 - 0.1) / 2, 0), c: 0x2a2d31 },
        { g: B(0.22, 0.1, 0.16, 0, y - h / 2 - 0.08, 0), c: 0x3a3e44 },
      ]));
      const streak = wetStreak(color, y, 0.9);
      g.add(streak);
      g.userData.anim = (time) => {
        // a slow shimmer, now and then a short flicker (it is projected light)
        const f = Math.sin(time * 37 + panel.id) > 0.985 ? 0.55 : 1;
        mat.opacity = (0.7 + 0.08 * Math.sin(time * 2.1 + panel.id)) * f;
        streak.visible = raceLook.reflections;
        const u = streak.material.uniforms;
        u.uTime.value = time; u.uWet.value = shared.uPgWet.value; u.uNight.value = shared.uPgNight.value;
      };
      g.userData.solid = [{ c: [0, 0], r: 0.16 }];                     // (the post)
      return g;
    },

    // THE GUARDRAIL of the last turn (the same one in the prologue and in Chapter 4): a steel W-beam on posts along
    // a line of points { points: [[x, z], ...] relative to the prop, every: meters between posts }
    guardrail(o = {}) {
      const pts = (o.points || [[0, 0], [10, 0]]).map((p) => new THREE.Vector2(p[0], p[1]));
      const parts = [];
      const every = o.every || 2.0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.y - a.y, L = Math.hypot(dx, dz);
        if (L < 0.01) continue;
        const ry = Math.atan2(dx, dz), mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
        // the beam: two rounded ridges (a W seen from the side), a little longer than the piece so the corners close
        parts.push({ g: B(0.05, 0.16, L + 0.06, mx, 0.62, mz, 0, ry), c: 0xb7bcc0 });
        parts.push({ g: B(0.06, 0.04, L + 0.06, mx, 0.58, mz, 0, ry), c: 0x8d9296 });
        parts.push({ g: B(0.06, 0.04, L + 0.06, mx, 0.68, mz, 0, ry), c: 0x8d9296 });
        const n = Math.max(1, Math.round(L / every));
        for (let k = 0; k <= n; k++) {
          if (i > 0 && k === 0) continue;
          const f = k / n, x = a.x + dx * f, z = a.y + dz * f;
          parts.push({ g: B(0.1, 0.75, 0.1, x, 0.375, z), c: 0x6f7478 });
        }
      }
      const m = merged(parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.75 }));
      const g = new THREE.Group(); g.add(m);
      // it is solid: a car that runs wide hits the rail instead of driving through it
      g.userData.solid = [{ line: pts.map((q) => [q.x, q.y]), r: 0.3 }];
      return g;
    },

    // THE JUMP RAMP over the road works (Neon Mile qualifier 2): a steel ramp with yellow and black stripes, the
    // dark ditch behind it, orange barriers at both sides. { w (width), len (ramp length), h (height of the lip),
    // gap (length of the ditch) }. Its lip is at 0, 0, 0; the ramp comes from -z.
    jumpRamp(o = {}) {
      const w = o.w || 6.6, len = o.len || 6, hh = o.h || 0.75, gap = o.gap || 7;
      const g = new THREE.Group();
      const slope = Math.atan2(hh, len), L = Math.hypot(hh, len);
      const stripes = tex('rampStripes', () => {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
        const c = cv.getContext('2d');
        c.fillStyle = '#d8a520'; c.fillRect(0, 0, 256, 32);
        c.fillStyle = '#16171a'; for (let x = -32; x < 256; x += 32) { c.beginPath(); c.moveTo(x, 32); c.lineTo(x + 16, 0); c.lineTo(x + 32, 0); c.lineTo(x + 16, 32); c.fill(); }
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapS = THREE.RepeatWrapping; tt.repeat.set(w / 2, 1);
        return tt;
      });
      g.add(merged([
        // the steel plate and its frame underneath
        { g: B(w, 0.06, L, 0, hh / 2, -len / 2, -slope), c: 0x5c6166 },
        { g: B(0.12, hh, 0.12, -w / 2 + 0.1, hh / 2, -0.06), c: 0x34383c }, { g: B(0.12, hh, 0.12, w / 2 - 0.1, hh / 2, -0.06), c: 0x34383c },
        { g: B(0.12, hh * 0.5, 0.12, -w / 2 + 0.1, hh * 0.25, -len * 0.5), c: 0x34383c }, { g: B(0.12, hh * 0.5, 0.12, w / 2 - 0.1, hh * 0.25, -len * 0.5), c: 0x34383c },
        // side rails
        { g: B(0.08, 0.12, L, -w / 2, hh / 2 + 0.08, -len / 2, -slope), c: 0x2e3135 }, { g: B(0.08, 0.12, L, w / 2, hh / 2 + 0.08, -len / 2, -slope), c: 0x2e3135 },
        // the ditch: a dark sunken patch with a little mud at its edges
        { g: B(w + 1.2, 0.02, gap, 0, 0.012, gap / 2 + 0.3), c: 0x0b0c0d },
        { g: B(w + 1.4, 0.03, 0.35, 0, 0.016, 0.25), c: 0x3a2f24 }, { g: B(w + 1.4, 0.03, 0.35, 0, 0.016, gap + 0.35), c: 0x3a2f24 },
      ], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.5 })));
      // the warning stripes on the lip
      const lip = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.22), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 }));
      lip.position.set(0, hh - 0.02, -0.12); lip.rotation.x = -Math.PI / 2 + slope; g.add(lip);
      // the orange road-works barriers along both sides of the ditch, with a blinking lamp each
      const barriers = [];
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const z = 0.8 + k * (gap / 2.2), x = s * (w / 2 + 0.9);
        barriers.push({ g: B(0.12, 0.8, 1.6, x, 0.4, z), c: 0xd45a1c }, { g: B(0.13, 0.12, 1.62, x, 0.62, z), c: 0xe8e6df }, { g: B(0.5, 0.06, 0.4, x, 0.03, z), c: 0x2a2c2f });
      }
      g.add(merged(barriers, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 })));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffa020 }));
      lamp.position.set(-(w / 2 + 0.9), 0.95, 0.8); g.add(lamp);
      const lamp2 = lamp.clone(); lamp2.position.x = w / 2 + 0.9; g.add(lamp2);
      g.userData.anim = (time) => { const on = (time * 1.4) % 1 < 0.5; lamp.visible = on; lamp2.visible = !on; };
      g.userData.solid = [-1, 1].map((s) => ({ line: [[s * (w / 2 + 0.9), 0], [s * (w / 2 + 0.9), 0.8 + gap / 1.1 + 0.8]], r: 0.3 }));
      return g;
    },

    // THE FINISH ARCH of the Neon Mile races: two steel posts, a banner across, a row of small white lamps.
    // { w (width between the posts), title, sub }
    raceArch(o = {}) {
      const w = o.w || 15, hgt = o.h || 5.6;
      const g = new THREE.Group();
      g.add(merged([
        { g: B(0.35, hgt, 0.35, -w / 2, hgt / 2, 0), c: 0x2b2e32 }, { g: B(0.35, hgt, 0.35, w / 2, hgt / 2, 0), c: 0x2b2e32 },
        { g: B(w + 0.4, 0.22, 0.3, 0, hgt + 0.05, 0), c: 0x3a3e43 },
        { g: B(0.9, 0.5, 0.9, -w / 2, 0.25, 0), c: 0x1e2024 }, { g: B(0.9, 0.5, 0.9, w / 2, 0.25, 0), c: 0x1e2024 },
      ], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 })));
      const banner = tex('arch:' + (o.title || '') + (o.sub || ''), () => textTexture(1024, 128, '#101216', [
        { text: t(o.title || 'c4.sign.mile'), size: 64, color: '#e8eaee', y: 0.42, weight: 700 },
        { text: t(o.sub || ''), size: 26, color: '#9aa3ad', y: 0.82, weight: 400 },
      ], '#2c3036'));
      // (two banners back to back in one mesh: the words read the right way from both sides)
      const banMat = new THREE.MeshStandardMaterial({ map: banner, roughness: 0.8, emissive: 0xffffff, emissiveMap: banner, emissiveIntensity: 0.35 });
      const front = new THREE.PlaneGeometry(w * 0.86, w * 0.86 / 8), back = new THREE.PlaneGeometry(w * 0.86, w * 0.86 / 8);
      front.translate(0, 0, 0.02); back.rotateY(Math.PI); back.translate(0, 0, -0.02);
      const ban = new THREE.Mesh(mergeGeometries([front, back]), banMat);
      ban.position.set(0, hgt - w * 0.86 / 16 - 0.1, 0);
      g.add(ban);
      // the lamps: one row of little lights under the beam (they flash at the start)
      const n = 14, lampGeo = [];
      for (let i = 0; i < n; i++) lampGeo.push(C(0.07, 0.07, 0.05, 8, -w / 2 + 0.6 + (i * (w - 1.2)) / (n - 1), hgt - 0.1, 0.18, Math.PI / 2));
      const lamps = new THREE.Mesh(mergeGeometries(lampGeo), new THREE.MeshBasicMaterial({ color: 0xf2f5ff }));
      g.add(lamps);
      g.userData.solid = [{ c: [-w / 2, 0], r: 0.5 }, { c: [w / 2, 0], r: 0.5 }];   // (the two posts with their feet)
      return g;
    },

    // a plastic bottle of water. { pour: true } = a thin stream runs out of it (the bottle is held upside down)
    bottle(o = {}) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xbfd9e6, transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0 }));
      shell.position.y = 0.1; g.add(shell);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.13, 10), new THREE.MeshStandardMaterial({ color: 0x8fb8cc, transparent: true, opacity: 0.6, roughness: 0.1 }));
      water.position.y = 0.07; g.add(water);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 0.04, 10), shell.material); neck.position.y = 0.22; g.add(neck);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 10), std(0x2f6fb8, 0.5)); cap.position.y = 0.245; g.add(cap);
      if (o.pour) {
        cap.visible = false;
        // the stream: a thin wavering line of water from the open neck down to the ground
        const sm = new THREE.MeshBasicMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.55, depthWrite: false });
        const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 1.0, 6, 1, true), sm);
        stream.position.y = 0.25 + 0.5; g.add(stream);
        g.userData.anim = (time) => { sm.opacity = 0.42 + 0.18 * Math.sin(time * 31); stream.scale.x = stream.scale.z = 0.8 + 0.3 * Math.sin(time * 17); };
      }
      return g;
    },

    // Lena's laptop, open: a dark keyboard half, a screen with lines of a map and a list of names (soft glow)
    laptop() {
      const g = new THREE.Group();
      const base = box(0.33, 0.018, 0.23, std(0x222428, 0.5, 0.4)); base.position.y = 0.009; g.add(base);
      const keys = box(0.29, 0.002, 0.12, std(0x111214, 0.8)); keys.position.set(0, 0.019, 0.02); g.add(keys);
      const lid = new THREE.Group(); lid.position.set(0, 0.018, -0.112); lid.rotation.x = -0.32; g.add(lid);
      const back = box(0.33, 0.21, 0.01, std(0x2a2c30, 0.45, 0.5)); back.position.y = 0.105; lid.add(back);
      const scr = tex('laptopScreen', () => textTexture(256, 160, '#06110f', [
        { text: t('c4.screen.1'), size: 15, color: '#e9b04c', y: 0.13, font: 'monospace', weight: 700 },
        { text: t('c4.screen.2'), size: 11, color: '#7ff0cc', y: 0.3, font: 'monospace' },
        { text: t('c4.screen.3'), size: 11, color: '#7ff0cc', y: 0.44, font: 'monospace' },
        { text: t('c4.screen.4'), size: 11, color: '#ff8a6a', y: 0.58, font: 'monospace' },
        { text: '..........................', size: 11, color: '#237a66', y: 0.72, font: 'monospace' },
        { text: '.................', size: 11, color: '#237a66', y: 0.84, font: 'monospace' },
      ]));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.185), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false }));
      screen.position.set(0, 0.105, 0.0056); lid.add(screen);
      return g;
    },
    // a workshop stool: a round seat on three legs (the seat at 0.66 m)
    stool() {
      const g = new THREE.Group();
      g.add(merged([
        { g: C(0.19, 0.19, 0.05, 14, 0, 0.64, 0), c: 0x5a3a26 },
        { g: C(0.018, 0.022, 0.66, 6, 0.12, 0.31, 0, 0, 0.18), c: 0x2a2c30 },
        { g: C(0.018, 0.022, 0.66, 6, -0.06, 0.31, 0.1, 0.16, -0.09), c: 0x2a2c30 },
        { g: C(0.018, 0.022, 0.66, 6, -0.06, 0.31, -0.1, -0.16, -0.09), c: 0x2a2c30 },
        { g: C(0.14, 0.14, 0.02, 12, 0, 0.24, 0), c: 0x3a3c40 },
      ]));
      return g;
    },

    // a rag (Nate wipes the rain off the windshield)
    rag() {
      const g = new THREE.Group();
      const m = box(0.22, 0.012, 0.17, std(0x5d6670, 0.95)); m.rotation.z = 0.25; g.add(m);
      const f = box(0.12, 0.01, 0.17, std(0x4e565f, 0.95)); f.position.set(0.1, 0.02, 0); f.rotation.z = -0.5; g.add(f);
      return g;
    },

    // A COLUMN OF SMOKE (the wrecked car below the roof): soft grey puffs rising and spreading, in one draw call.
    // { height, n (puffs), dark (0..1) }
    smokeColumn(o = {}) {
      const n = o.n || 26, H = o.height || 14;
      const geo = new THREE.BufferGeometry();
      const seed = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { seed[i * 3] = i / n; seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); }
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uH: { value: H }, uDark: { value: o.dark === undefined ? 0.35 : o.dark }, uMap: { value: tex('glow', glowTexture) }, uScale: { value: 380 } }]),
        vertexShader: `
          attribute vec3 aSeed;
          uniform float uTime, uH, uScale;
          varying float vA;
          #include <fog_pars_vertex>
          void main() {
            float life = fract( aSeed.x + uTime * 0.07 );
            vec3 p = vec3( ( aSeed.y - 0.5 ) * 0.8 + sin( uTime * 0.4 + aSeed.z * 6.0 ) * life * 1.6 + life * life * 2.5, life * uH, ( aSeed.z - 0.5 ) * 0.8 + cos( uTime * 0.3 + aSeed.y * 6.0 ) * life * 1.2 );
            vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = ( 1.2 + life * 5.5 ) * uScale / -mvPosition.z;
            vA = smoothstep( 0.0, 0.08, life ) * ( 1.0 - life ) * 0.55;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uDark;
          varying float vA;
          #include <fog_pars_fragment>
          void main() {
            float a = texture2D( uMap, gl_PointCoord ).a * vA;
            gl_FragColor = vec4( vec3( 0.42 - uDark * 0.25 ), a );
            #include <fog_fragment>
          }`,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      const g = new THREE.Group(); g.add(pts);
      g.userData.anim = (time) => { mat.uniforms.uTime.value = time; };
      return g;
    },
  };
  return { makers };
}
