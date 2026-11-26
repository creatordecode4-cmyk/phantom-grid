// ---------------------------------------------------------------------------
// propsNight.js - the things of Chapter 8 ("Talk to Zero").
//
//   pilotKey    Lena's PILOT KEY: a small dark block with a soft green light along its edge and a short cable. It sits on
//               her laptop in the safehouse, then in the dash of Nate's car (it is how Zero's radio link is opened).
//               userData.setLink(0..1): how strong the link is (the light breathes faster and brighter)
//   radioDial   the radio of the car: a round dial with an amber scale and a needle, a small speaker grille.
//               userData.tune(0..1): where the needle is; userData.setSignal(0..1): how alive the scale glows
//               (0 = dead: the radio has gone quiet)
//   memoryCase  Solberg's hidden file (the flashback): a small open steel case lined with dark foam, and in it a tiny
//               memory card glowing cold white-green
//   newsTv      a flat TV on a stand that shows the news: a face (a canvas: the portrait of a character, see
//               src/ui/portrait.js), a lower band with the channel and a headline, a line of text running past.
//               userData.setFace(canvas), userData.setText(headline, ticker)
// Everything is built from simple shapes and pictures drawn in code. No real brands.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function nightProps(H) {
  const { std, box, tex, glowTexture } = H;
  const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ map: tex('nightGlow', glowTexture), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  const makers = {
    // ---- THE PILOT KEY ----
    pilotKey() {
      const g = new THREE.Group();
      const body = box(0.085, 0.022, 0.05, std(0x111316, 0.35, 0.6)); body.position.y = 0.011; g.add(body);
      // a brushed top plate, a little lighter
      const top = box(0.07, 0.003, 0.038, std(0x2a2d31, 0.3, 0.8)); top.position.y = 0.0235; g.add(top);
      // the green light: a thin strip round the edge and a small window on top
      const green = std(0x45ff9a, 0.3, 0, 2.4);
      const strip = box(0.087, 0.004, 0.052, green); strip.position.y = 0.006; g.add(strip);
      const win = box(0.018, 0.003, 0.008, green); win.position.set(0.022, 0.0252, 0); g.add(win);
      // the plug and a short cable
      const plug = box(0.016, 0.01, 0.012, std(0x8a9098, 0.35, 0.9)); plug.position.set(-0.05, 0.011, 0); g.add(plug);
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0025, 5, 14, Math.PI * 0.9), std(0x0b0c0d, 0.6));
      cable.position.set(-0.075, 0.011, 0.02); cable.rotation.x = Math.PI / 2; g.add(cable);
      // a soft green glow around it (it faces the camera: props.js turns "billboardPart" every frame)
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), glowMat(0x46ff9c, 0.3));
      halo.position.y = 0.02; halo.renderOrder = 20; g.add(halo);
      g.userData.billboardPart = halo;
      let link = 0.3;
      g.userData.setLink = (v) => { link = Math.max(0, Math.min(1, v)); };
      g.userData.anim = (time) => {
        // a calm breath; faster and brighter while the link is strong
        const b = 0.55 + 0.45 * Math.sin(time * (1.1 + link * 2.6));
        green.emissiveIntensity = 0.9 + 1.6 * link * b + 0.4 * b;
        halo.material.opacity = 0.1 + 0.22 * link * b;
      };
      return g;
    },

    // ---- THE RADIO OF THE CAR ----
    // (o.plate: [width, height, up, depth] - a dark housing behind it, as if an old radio was fitted over the car's own
    //  screen; it covers that screen and reaches back to the dashboard)
    radioDial(o = {}) {
      const g = new THREE.Group();
      const face = box(0.15, 0.06, 0.02, std(0x0d0e10, 0.45, 0.4)); g.add(face);
      if (o.plate) {
        const [w, h, up, d] = o.plate;
        const plate = box(w, h, d, std(0x111214, 0.7, 0.3)); plate.position.set(0, up, 0.01 + d / 2); g.add(plate);
      }
      // the round scale: an amber ring, numbers as small ticks, and the needle
      const amber = std(0xffa640, 0.35, 0, 1.6);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.019, 0.023, 32), amber);
      ring.position.set(-0.035, 0, -0.0105); ring.rotation.y = Math.PI; g.add(ring);
      for (let i = 0; i < 9; i++) {
        const a = -2.2 + (i / 8) * 4.4;
        const tick = box(0.0012, 0.004, 0.001, amber);
        tick.position.set(-0.035 + Math.sin(a) * 0.016, Math.cos(a) * 0.016, -0.011); tick.rotation.z = -a; g.add(tick);
      }
      const needle = new THREE.Group(); needle.position.set(-0.035, 0, -0.0112); g.add(needle);
      const nd = box(0.0014, 0.017, 0.001, std(0xff5a2a, 0.3, 0, 2.2)); nd.position.y = 0.0085; needle.add(nd);
      // the speaker grille: rows of small dark holes
      const grille = new THREE.Group(); grille.position.set(0.035, 0, -0.0105); g.add(grille);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const h = box(0.004, 0.004, 0.001, std(0x050506, 0.9)); h.position.set(-0.012 + c * 0.005, -0.008 + r * 0.0053, 0); grille.add(h); }
      // two small knobs
      for (const x of [-0.064, -0.006]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 12), std(0x2a2c30, 0.4, 0.7)); k.rotation.x = Math.PI / 2; k.position.set(x, -0.02, -0.013); g.add(k); }
      let tune = 0.4, tuneNow = 0.4, sig = 0.6;
      g.userData.tune = (v) => { tune = Math.max(0, Math.min(1, v)); };
      g.userData.setSignal = (v) => { sig = Math.max(0, Math.min(1, v)); };
      g.userData.anim = (time) => {
        tuneNow += (tune - tuneNow) * 0.08;
        // (a weak signal makes the needle tremble a little)
        needle.rotation.z = -(-2.2 + tuneNow * 4.4) + Math.sin(time * 23) * 0.025 * (1 - sig) * (sig > 0.02 ? 1 : 0);
        amber.emissiveIntensity = 0.15 + 1.7 * sig * (0.9 + 0.1 * Math.sin(time * 5.3));
      };
      return g;
    },

    // ---- SOLBERG'S HIDDEN FILE (the flashback) ----
    memoryCase() {
      const g = new THREE.Group(), steel = std(0x8d949b, 0.3, 0.85);
      const base = box(0.16, 0.03, 0.11, steel); base.position.y = 0.015; g.add(base);
      const foam = box(0.145, 0.006, 0.095, std(0x141518, 0.95)); foam.position.y = 0.031; g.add(foam);
      const hinge = new THREE.Group(); hinge.position.set(0, 0.03, -0.055); hinge.rotation.x = -1.95; g.add(hinge);
      const lid = box(0.16, 0.022, 0.11, steel); lid.position.set(0, 0.011, 0.055); hinge.add(lid);
      const lidFoam = box(0.145, 0.005, 0.095, std(0x141518, 0.95)); lidFoam.position.set(0, -0.003, 0.055); hinge.add(lidFoam);
      // the card: tiny, in its cut-out, glowing a cold white-green
      const slot = box(0.03, 0.003, 0.022, std(0x050506, 0.9)); slot.position.set(0, 0.0345, 0.006); g.add(slot);
      const cardMat = std(0xbfffe6, 0.3, 0.2, 1.4);
      const card = box(0.022, 0.0022, 0.016, cardMat); card.position.set(0, 0.0365, 0.006); g.add(card);
      const pins = box(0.008, 0.0024, 0.012, std(0xd4b25a, 0.3, 0.9)); pins.position.set(-0.006, 0.0368, 0.006); g.add(pins);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), glowMat(0xaef8e2, 0.4));
      halo.position.set(0, 0.04, 0.006); halo.renderOrder = 20; g.add(halo);
      g.userData.billboardPart = halo;
      g.userData.anim = (time) => {
        const b = 0.5 + 0.5 * Math.sin(time * 1.7);
        cardMat.emissiveIntensity = 0.9 + 0.9 * b;
        halo.material.opacity = 0.22 + 0.2 * b;
      };
      return g;
    },

    // ---- THE NEWS ON A TV ----
    newsTv(o = {}) {
      const W = 512, Hh = 288;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
      const g2 = cv.getContext('2d');
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      let face = null, headline = o.headline || '', ticker = o.ticker || '', tickX = 0, last = -1;
      // one picture of the news: a blue studio, the face on the left, the band with the channel and the headline
      function draw(time) {
        const gr = g2.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, '#0f2a4a'); gr.addColorStop(1, '#061424');
        g2.fillStyle = gr; g2.fillRect(0, 0, W, Hh);
        // soft lights of a studio behind
        for (let i = 0; i < 5; i++) { g2.fillStyle = `rgba(120, 170, 230, ${0.05 + 0.03 * Math.sin(time * 0.4 + i)})`; g2.beginPath(); g2.arc(300 + i * 50, 70 + (i % 2) * 40, 40, 0, Math.PI * 2); g2.fill(); }
        if (face) {
          // (a slow push in on the face: the news is "playing")
          const k = 1.02 + 0.03 * Math.sin(time * 0.12);
          const fw = 190 * k, fh = 238 * k;
          g2.save(); g2.beginPath(); g2.rect(26, 18, 200, 196); g2.clip();
          g2.drawImage(face, 126 - fw / 2, 116 - fh / 2, fw, fh);
          g2.restore();
          g2.strokeStyle = 'rgba(200, 225, 255, 0.4)'; g2.lineWidth = 2; g2.strokeRect(26, 18, 200, 196);
        }
        // the band at the bottom
        g2.fillStyle = '#c1121f'; g2.fillRect(0, 206, 120, 34);
        g2.fillStyle = '#ffffff'; g2.font = '700 18px Arial, sans-serif'; g2.fillText('LIVE', 34, 229);
        g2.fillStyle = 'rgba(245, 247, 250, 0.95)'; g2.fillRect(120, 206, W - 120, 34);
        g2.fillStyle = '#0c1a2c'; g2.font = '700 17px Arial, sans-serif'; g2.fillText(headline, 132, 229);
        // the running line under it
        g2.fillStyle = '#0b1f36'; g2.fillRect(0, 240, W, 26);
        g2.fillStyle = '#cfe3ff'; g2.font = '15px Arial, sans-serif';
        const tw = g2.measureText(ticker).width + 60;
        tickX = (tickX - 1.1) % tw;
        g2.fillText(ticker, tickX + W, 258); g2.fillText(ticker, tickX + W - tw, 258);
        // the channel's name in the corner (made up)
        g2.fillStyle = 'rgba(255, 255, 255, 0.85)'; g2.font = '700 15px Arial, sans-serif'; g2.fillText('CITY 9', W - 74, 30);
        t.needsUpdate = true;
      }
      const grp = new THREE.Group();
      const frame = box(1.06, 0.62, 0.05, std(0x0a0a0b, 0.35, 0.4)); frame.position.y = 0.31; grp.add(frame);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.99, 0.556), new THREE.MeshBasicMaterial({ map: t, toneMapped: true }));
      screen.position.set(0, 0.31, 0.0262); grp.add(screen);
      const stand = box(0.3, 0.02, 0.16, std(0x141416, 0.4, 0.5)); stand.position.y = -0.02; grp.add(stand);
      const neck = box(0.05, 0.06, 0.03, std(0x141416, 0.4, 0.5)); neck.position.set(0, 0.0, -0.01); grp.add(neck);
      grp.userData.screen = screen;
      grp.userData.setFace = (c) => { face = c; last = -1; };
      grp.userData.setText = (h, tk) => { if (h !== undefined) headline = h; if (tk !== undefined) ticker = tk; last = -1; };
      // (the picture is drawn again a few times a second, not every frame)
      grp.userData.anim = (time) => { if (time - last > 0.1 || last < 0) { last = time; draw(time); } };
      draw(0);
      return grp;
    },
  };
  return { makers };
}
