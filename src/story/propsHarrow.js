// ---------------------------------------------------------------------------
// propsHarrow.js - the things of Chapter 9 ("Harrow's Line").
//
//   bridgeGate     the Guard gate over the southbound half of Ironhill Highway: two steel posts, a beam with a sign
//                  and amber lamps, and a long striped boom that swings down across the lanes.
//                  userData.setClosed(0..1): 0 = the boom stands up, 1 = it lies across the road (the lamps go red)
//   roadblock      a line of concrete barriers across the road with warning lamps on them. One draw for all the
//                  barriers, one for their red stripes, one for all the lamps (instancing). o: { count, span }
//   haloCore       MILA'S CORE: a small glass cylinder with steel caps; inside it a soft blue light.
//                  userData.setGlow(0..1)
//   oldMachine     a small old machine on Rask's desk: a boxy case, a round little screen, a slot on top for the core,
//                  two knobs, a speaker grille. userData.setOn(0..1): the screen wakes with a soft warm light
//   deskPhone      an old desk phone: the base with its dial, the handset on its cradle. userData.lift(0..1)
//   accessCard     the KVI TOWER MASTER CARD: a small dark card with a chip and a glowing cyan edge
//   phantomTablet  Harrow's tablet: KVI's list of the people whose minds go into Phantoms. One line is red: her name
//   rearDoors      the two heavy back doors of the prison truck, put on the truck's own back: they swing open, and
//                  behind them it is dark. o: { w, h }. userData.setOpen(0..1) (the doors glide there)
//   flareSet       road flares dropped by the drones: one draw for all the sticks, one for the bright tips, one for
//                  the red pools of light (instancing). o: { list: [[x, y, z, face], ...] (where they land), drop:
//                  meters they fall from (0 = already lying), size }. They fall one after the other, spinning
//   handset        the handset of the desk phone, to hold at the ear (the phone's own one is hidden meanwhile)
// Everything is built from simple shapes and pictures drawn in code. No real brands. The words are in strings.js.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from './strings.js';

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function harrowProps(H) {
  const { std, box, tex, textTexture, glowTexture } = H;
  const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ map: tex('harrowGlow', glowTexture), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const cyl = (r0, r1, h, seg, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  // AN OLD PHONE'S HANDSET: a rounded handle along y, the two round cups (the ear one at +y, the mouth one at -y) on
  // its +x side, each turned a little toward the other, like the real ones. Three draws.
  const handsetShape = () => {
    const g = new THREE.Group(), plastic = std(0x1e1f21, 0.42, 0.1);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.0135, 0.15, 4, 10), plastic);
    handle.scale.set(1, 1, 0.8); g.add(handle);
    for (const sy of [-1, 1]) {
      const cup = cyl(0.027, 0.021, 0.034, 18, plastic);
      cup.rotation.z = -Math.PI / 2 - sy * 0.15;           // (its wide round face toward +x)
      cup.position.set(0.016, sy * 0.088, 0); g.add(cup);
    }
    return g;
  };

  // red and white stripes (the boom, the barriers)
  const stripes = () => tex('harrowStripes', () => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16;
    const g = cv.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f0ea' : '#c8261c'; g.fillRect(i * 32, 0, 32, 16); }
    const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapS = THREE.RepeatWrapping; return tt;
  });

  const makers = {
    // ---- THE BRIDGE GATE ----
    bridgeGate(o = {}) {
      const g = new THREE.Group(), w = o.width || 13.6, hi = 6.2;
      const steel = std(0x3a4046, 0.45, 0.7), dark = std(0x1b1f23, 0.6, 0.4);
      // the two posts and the beam over the lanes
      for (const sx of [-1, 1]) {
        const post = box(0.42, hi, 0.42, steel); post.position.set(sx * (w / 2), hi / 2, 0); g.add(post);
        const foot = box(0.9, 0.3, 0.9, dark); foot.position.set(sx * (w / 2), 0.15, 0); g.add(foot);
      }
      const beam = box(w + 0.42, 0.62, 0.5, steel); beam.position.set(0, hi - 0.31, 0); g.add(beam);
      // the sign on the beam (both faces)
      const sign = new THREE.MeshBasicMaterial({ map: tex('gateSign', () => textTexture(1024, 96, '#0d2a20', [
        { text: t('c9.gate.sign'), size: 46, color: '#e6f4ec', y: 0.52, weight: 700 },
      ], '#8fd6b4')), color: new THREE.Color(0.9, 0.9, 0.9) });
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(8, w * 0.6), 0.6), sign);
        p.position.set(0, hi - 0.31, sz * 0.26); if (sz < 0) p.rotation.y = Math.PI; g.add(p);
      }
      // the lamps on the beam: amber while open, red when closed
      const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.25) });
      const lamps = [];
      for (let i = -2; i <= 2; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lampMat);
        l.position.set(i * (w / 5.2), hi - 0.72, 0.18); g.add(l); lamps.push(l);
      }
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.6), glowMat(0xffa23a, 0.22));
      halo.position.set(0, hi - 0.75, 0.3); halo.renderOrder = 20; g.add(halo);
      // the boom: hinged at the left post, as long as the road is wide
      const hinge = new THREE.Group(); hinge.position.set(-w / 2 + 0.3, 1.05, 0); g.add(hinge);
      const boomMat = new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.5 });
      boomMat.map.repeat.set(w / 2.4, 1);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.22, 0.16), boomMat); boom.position.set((w - 0.6) / 2, 0, 0); hinge.add(boom);
      const motor = box(0.7, 0.9, 0.7, std(0xc9a12a, 0.5, 0.3)); motor.position.set(-w / 2 + 0.3, 0.75, 0.55); g.add(motor);
      let k = 0;
      const set = (v) => {
        k = Math.max(0, Math.min(1, v));
        // (up: the boom points to the sky; closed: it lies across the lanes)
        hinge.rotation.z = (1 - k) * (Math.PI / 2 - 0.02);
        lampMat.color.setRGB(k > 0.5 ? 2.4 : 2.2, k > 0.5 ? 0.25 : 1.3, k > 0.5 ? 0.15 : 0.25);
        halo.material.color.set(k > 0.5 ? 0xff3a2a : 0xffa23a);
      };
      set(0);
      g.userData.setClosed = set;
      g.userData.anim = (time) => { if (k > 0.5) for (let i = 0; i < lamps.length; i++) lamps[i].visible = (time * 2 + i * 0.5) % 1 < 0.6; else for (const l of lamps) l.visible = true; };
      return g;
    },

    // ---- THE ROADBLOCK (instanced) ----
    roadblock(o = {}) {
      const g = new THREE.Group(), n = o.count || 6, span = o.span || 13;
      const step = span / n;
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(step * 0.86, 0.82, 0.55), std(0xd9d6cf, 0.75), n);
      const stripe = new THREE.InstancedMesh(new THREE.BoxGeometry(step * 0.88, 0.14, 0.57), new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.6 }), n);
      const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.3, 0.2) });
      const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), lampMat, n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const x = -span / 2 + step * (i + 0.5), r = ((i * 37) % 7 - 3) * 0.02;
        m.makeRotationY(r).setPosition(x, 0.41, ((i % 2) - 0.5) * 0.25); body.setMatrixAt(i, m);
        m.makeRotationY(r).setPosition(x, 0.66, ((i % 2) - 0.5) * 0.25); stripe.setMatrixAt(i, m);
        m.makeRotationY(0).setPosition(x, 0.92, ((i % 2) - 0.5) * 0.25); lamps.setMatrixAt(i, m);
      }
      body.castShadow = true; body.receiveShadow = true;
      g.add(body, stripe, lamps);
      // (the lamps blink together)
      g.userData.anim = (time) => { const on = (time * 1.7) % 1 < 0.55; lampMat.color.setRGB(on ? 2.6 : 0.25, on ? 0.3 : 0.03, on ? 0.2 : 0.02); };
      g.userData.solid = [{ line: [[-span / 2, 0], [span / 2, 0]], r: 0.35 }];
      return g;
    },

    // ---- MILA'S CORE ----
    haloCore() {
      const g = new THREE.Group(), steel = std(0xb8bfc6, 0.25, 0.9);
      const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
      const shell = cyl(0.036, 0.036, 0.11, 24, glass); shell.position.y = 0.065; g.add(shell);
      for (const y of [0.006, 0.124]) { const cap = cyl(0.04, 0.04, 0.012, 24, steel); cap.position.y = y; g.add(cap); }
      // the light inside: a thin bright column
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.85, 1.8) });
      const core = cyl(0.011, 0.011, 0.09, 12, coreMat); core.position.y = 0.065; g.add(core);
      // a few contacts at the bottom (where it goes into the machine)
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = box(0.006, 0.01, 0.006, std(0xd4b25a, 0.3, 0.9)); p.position.set(Math.cos(a) * 0.026, -0.002, Math.sin(a) * 0.026); g.add(p); }
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), glowMat(0x7cc4ff, 0.35));
      halo.position.y = 0.065; halo.renderOrder = 20; g.add(halo);
      g.userData.billboardPart = halo;
      let glow = 1;
      g.userData.setGlow = (v) => { glow = Math.max(0, Math.min(1, v)); };
      g.userData.anim = (time) => {
        const b = 0.85 + 0.15 * Math.sin(time * 1.3);
        coreMat.color.setRGB(0.5 * glow * b + 0.05, 0.85 * glow * b + 0.06, 1.8 * glow * b + 0.08);
        halo.material.opacity = 0.35 * glow * b;
      };
      return g;
    },

    // ---- THE OLD MACHINE on Rask's desk ----
    oldMachine() {
      const g = new THREE.Group();
      const shell = std(0xb9b19c, 0.7, 0.05), dark = std(0x1c1d1f, 0.6, 0.2), metal = std(0x8d939a, 0.35, 0.8);
      const body = box(0.34, 0.24, 0.28, shell); body.position.y = 0.12; g.add(body);
      const top = box(0.32, 0.02, 0.26, std(0xa69f8b, 0.7)); top.position.y = 0.25; g.add(top);
      // the round little screen, set into the front (+z)
      const bezel = cyl(0.085, 0.085, 0.02, 32, dark); bezel.rotation.x = Math.PI / 2; bezel.position.set(-0.05, 0.13, 0.141); g.add(bezel);
      const screenMat = new THREE.MeshBasicMaterial({ map: tex('milaScreen', () => textTexture(256, 256, '#0a0806', [
        { text: t('c9.mila.screen'), size: 40, color: '#ffe2b0', y: 0.5, weight: 500 },
      ])), color: new THREE.Color(0.02, 0.02, 0.02) });
      const screen = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), screenMat); screen.position.set(-0.05, 0.13, 0.152); g.add(screen);
      // the slot on top where the core goes, a ring of steel round it
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), metal); ring.rotation.x = Math.PI / 2; ring.position.set(0.08, 0.262, -0.02); g.add(ring);
      const hole = cyl(0.04, 0.04, 0.006, 20, std(0x050506, 0.9)); hole.position.set(0.08, 0.259, -0.02); g.add(hole);
      // two knobs and a speaker grille on the right of the front
      for (const y of [0.17, 0.09]) { const kn = cyl(0.016, 0.016, 0.02, 14, dark); kn.rotation.x = Math.PI / 2; kn.position.set(0.1, y, 0.148); g.add(kn); }
      for (let r = 0; r < 4; r++) { const sl = box(0.06, 0.006, 0.004, dark); sl.position.set(0.1, 0.045 + r * 0.012, 0.141); g.add(sl); }
      // a little power lamp
      const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.05, 0.02) });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), ledMat); led.position.set(0.14, 0.215, 0.142); g.add(led);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), glowMat(0xffc888, 0));
      halo.position.set(-0.05, 0.13, 0.16); halo.renderOrder = 20; g.add(halo);
      let on = 0, want = 0;
      g.userData.setOn = (v) => { want = Math.max(0, Math.min(1, v)); };
      g.userData.anim = (time) => {
        on += (want - on) * 0.03;
        const f = on * (0.92 + 0.08 * Math.sin(time * 9.0) * Math.sin(time * 2.3));
        screenMat.color.setRGB(0.02 + 1.3 * f, 0.02 + 1.15 * f, 0.02 + 0.9 * f);
        ledMat.color.setRGB(0.1 + 2.0 * Math.min(1, on * 3), 0.05 + 0.9 * Math.min(1, on * 3), 0.02);
        halo.material.opacity = 0.28 * f;
      };
      return g;
    },

    // ---- AN OLD DESK PHONE ----
    deskPhone() {
      const g = new THREE.Group(), plastic = std(0x1e1f21, 0.45, 0.1), dial = std(0xd9d4c6, 0.5);
      const base = box(0.2, 0.06, 0.16, plastic); base.position.y = 0.03; g.add(base);
      const slope = box(0.2, 0.04, 0.08, plastic); slope.position.set(0, 0.065, 0.03); slope.rotation.x = -0.3; g.add(slope);
      const plate = cyl(0.04, 0.04, 0.006, 24, dial); plate.position.set(0, 0.088, 0.04); plate.rotation.x = -0.3; g.add(plate);
      // the handset on its cradle: a group, so it can be lifted (the same handset as the one held at the ear, lying
      // along x with its cups down)
      const hs = new THREE.Group(); hs.position.set(0, 0.112, -0.03); g.add(hs);
      const lying = handsetShape(); lying.rotation.z = -Math.PI / 2; hs.add(lying);
      // the coiled cord (a few loops)
      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 10), plastic); cord.position.set(-0.11, 0.04, -0.03); cord.rotation.y = Math.PI / 2; g.add(cord);
      g.userData.lift = (k) => { hs.position.set(0, 0.11 + k * 0.18, -0.03 + k * 0.08); hs.rotation.set(k * 0.6, 0, k * -0.5); };
      // (the handset is in a hand now: the one on the cradle is not there)
      g.userData.setHandset = (on) => { hs.visible = !!on; };
      return g;
    },
    // the handset alone (held at the ear: its middle is where the hand holds it)
    handset() { return handsetShape(); },

    // ---- THE BACK DOORS OF THE PRISON TRUCK ----
    // (built on the truck's back face: the doors' bottom edge in the middle, x across, y up, -z out behind the truck)
    rearDoors(o = {}) {
      const g = new THREE.Group(), w = o.w || 1.9, h = o.h || 1.8;
      const steel = std(0x2b3137, 0.5, 0.65), bars = std(0x15181b, 0.5, 0.7);
      // the dark inside: it covers the closed doors of the model itself
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.02), new THREE.MeshBasicMaterial({ color: 0x040506 }));
      inside.position.set(0, h / 2, -0.012); inside.rotation.y = Math.PI; g.add(inside);
      // a bench along one side inside, just seen when the doors are open
      const bench = box(0.34, 0.06, 1.0, std(0x1c1f22, 0.8)); bench.position.set(w / 2 - 0.3, 0.42, 0.55); g.add(bench);
      const doors = [];
      for (const sx of [-1, 1]) {
        // (hinged at its own side; it swings out behind the truck)
        const hinge = new THREE.Group(); hinge.position.set(sx * (w / 2), 0, -0.035); g.add(hinge);
        const d = box(w / 2 - 0.012, h, 0.05, steel); d.position.set(-sx * (w / 4), h / 2, -0.025); hinge.add(d);
        // a small window with bars, a long handle, three hinges
        const win = box(w * 0.24, 0.22, 0.012, std(0x0b0d0f, 0.2, 0.3)); win.position.set(-sx * (w / 4), h * 0.74, -0.054); hinge.add(win);
        for (let i = 0; i < 3; i++) { const b = box(0.012, 0.22, 0.016, bars); b.position.set(-sx * (w / 4) + (i - 1) * w * 0.07, h * 0.74, -0.058); hinge.add(b); }
        const handle = box(0.03, 0.34, 0.035, bars); handle.position.set(-sx * (w / 2 - 0.09), h * 0.48, -0.07); hinge.add(handle);
        for (const y of [0.18, 0.5, 0.82]) { const hg = box(0.05, 0.1, 0.06, bars); hg.position.set(-sx * 0.02, h * y, -0.03); hinge.add(hg); }
        doors.push({ hinge, sx });
      }
      let k = 0, want = 0;
      const set = (v) => { k = v; for (const d of doors) d.hinge.rotation.y = -d.sx * k * 1.85; };
      g.userData.setOpen = (v) => { want = Math.max(0, Math.min(1, v)); };
      // (heavy doors: they swing slowly, the last part a little faster)
      g.userData.anim = () => { if (Math.abs(want - k) > 0.001) set(k + Math.sign(want - k) * Math.min(Math.abs(want - k), 0.012 + Math.abs(want - k) * 0.03)); };
      return g;
    },

    // ---- ROAD FLARES DROPPED BY THE DRONES (instanced) ----
    flareSet(o = {}) {
      const list = o.list || [], n = Math.max(1, list.length), H = o.drop || 0, size = o.size || 6.5;
      const g = new THREE.Group();
      const stick = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.24), std(0x7a1410, 0.6), n);
      const tipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.72) });
      const tip = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), tipMat, n);
      const poolGeo = new THREE.PlaneGeometry(size, size); poolGeo.rotateX(-Math.PI / 2);
      const poolMat = new THREE.MeshBasicMaterial({ map: tex('harrowGlow', glowTexture), color: o.color || 0xff3b20, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const pool = new THREE.InstancedMesh(poolGeo, poolMat, n);
      pool.renderOrder = 14;
      for (const m of [stick, tip, pool]) { m.count = list.length; m.frustumCulled = false; g.add(m); }
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), q0 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      const p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), sv = new THREE.Vector3(), off = new THREE.Vector3();
      let t0 = null, landed = false;
      // where every flare is at this time (false while one is still falling)
      const place = (time) => {
        let all = true;
        list.forEach((e, i) => {
          const tt = t0 === null ? 0 : time - t0 - i * 0.28;
          const fall = H > 0 ? (tt <= 0 ? H : Math.max(0, H - 4.9 * tt * tt)) : 0;
          if (fall > 0) all = false;
          q.setFromAxisAngle(up, -(e[3] || 0) * Math.PI / 180 + (fall > 0 ? tt * 7 : 0));
          M.compose(p.set(e[0], e[1] + 0.02 + fall, e[2]), q, one); stick.setMatrixAt(i, M);
          off.set(0, 0, 0.12).applyQuaternion(q);
          M.compose(p.set(e[0] + off.x, e[1] + 0.03 + fall, e[2] + off.z), q, one); tip.setMatrixAt(i, M);
          // (the pool of light is on the road; it is small while the flare is still in the air)
          const k = fall > 0 ? 0.25 + 0.75 * (1 - fall / Math.max(H, 0.01)) * 0.4 : 1;
          M.compose(p.set(e[0], e[1] + 0.035, e[2]), q0, sv.set(k, 1, k)); pool.setMatrixAt(i, M);
        });
        stick.instanceMatrix.needsUpdate = true; tip.instanceMatrix.needsUpdate = true; pool.instanceMatrix.needsUpdate = true;
        return all;
      };
      place(0);
      g.userData.anim = (time) => {
        if (t0 === null) t0 = time;
        if (!landed) landed = place(time);
        poolMat.opacity = 0.62 + 0.25 * Math.sin(time * 23) + 0.13 * Math.sin(time * 57);
      };
      return g;
    },

    // ---- THE KVI TOWER MASTER CARD ----
    accessCard() {
      const g = new THREE.Group();
      const face = new THREE.MeshStandardMaterial({ map: tex('masterCard', () => textTexture(512, 320, '#0b1016', [
        { text: t('c9.card.top'), size: 34, color: '#7fe8ff', y: 0.2, weight: 700 },
        { text: t('c9.card.name'), size: 58, color: '#e9f6ff', y: 0.52, weight: 800 },
        { text: t('c9.card.small'), size: 24, color: '#6d8796', y: 0.82, weight: 500 },
      ], '#3fd8ff')), roughness: 0.3, metalness: 0.2, emissive: 0x1a5566, emissiveIntensity: 0.6 });
      g.add(box(0.086, 0.0012, 0.054, std(0x0b1016, 0.3, 0.3)));
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.084, 0.052), face); top.rotation.x = -Math.PI / 2; top.position.y = 0.00065; g.add(top);
      // the chip
      const chip = box(0.012, 0.0004, 0.01, std(0xd4b25a, 0.25, 0.9)); chip.position.set(-0.026, 0.0008, 0.004); g.add(chip);
      // the glowing edge
      const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.0) });
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.0875, 0.0006, 0.0555), edgeMat); edge.position.y = -0.0004; g.add(edge);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), glowMat(0x46d8ff, 0.3));
      halo.position.y = 0.004; halo.renderOrder = 20; g.add(halo);
      g.userData.billboardPart = halo;
      g.userData.anim = (time) => { const b = 0.75 + 0.25 * Math.sin(time * 2.1); edgeMat.color.setRGB(0.4 * b, 1.6 * b, 2.0 * b); halo.material.opacity = 0.3 * b; };
      return g;
    },

    // ---- HARROW'S TABLET: THE PHANTOM LIST ----
    phantomTablet() {
      const g = new THREE.Group();
      g.add(box(0.21, 0.008, 0.145, std(0x101113, 0.4, 0.5)));
      const map = tex('phantomList', () => {
        const cv = document.createElement('canvas'); cv.width = 640; cv.height = 440;
        const c = cv.getContext('2d');
        c.fillStyle = '#05080b'; c.fillRect(0, 0, 640, 440);
        c.fillStyle = '#0f1c24'; c.fillRect(0, 0, 640, 64);
        c.fillStyle = '#7fe8ff'; c.font = '700 26px Arial, Helvetica, sans-serif'; c.fillText(t('c9.tablet.title'), 22, 42);
        c.fillStyle = '#5c7380'; c.font = '500 16px Arial, Helvetica, sans-serif'; c.fillText(t('c9.tablet.sub'), 22, 92);
        const rows = t('c9.tablet.rows').split('|');
        rows.forEach((r, i) => {
          const y = 128 + i * 40, mine = i === rows.length - 2;
          if (mine) { c.fillStyle = 'rgba(200, 30, 24, 0.85)'; c.fillRect(14, y - 26, 612, 36); }
          c.fillStyle = mine ? '#ffffff' : '#9fb3bf'; c.font = `${mine ? 700 : 500} 20px Arial, Helvetica, sans-serif`;
          c.fillText(r, 24, y);
          c.fillStyle = mine ? '#ffd7d2' : '#4c626e'; c.textAlign = 'right'; c.fillText(t(mine ? 'c9.tablet.scheduled' : 'c9.tablet.done'), 616, y); c.textAlign = 'left';
        });
        const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 4; return tt;
      });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.194, 0.13), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.25, 1.25, 1.25) }));
      s.rotation.x = -Math.PI / 2; s.position.y = 0.0045; g.add(s);
      return g;
    },
  };
  return { makers };
}
