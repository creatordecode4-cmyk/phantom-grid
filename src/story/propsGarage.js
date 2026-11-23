// ---------------------------------------------------------------------------
// propsGarage.js - the things of Chapter 6 ("Old Debts").
//
// Small things that carry the chapter: the bank record Lena printed (a sheet of
// paper, folded once, the one line marked by hand), a spanner in a hand, the
// key of Theo's car on a worn ring with a small tag, and a rag for oily hands.
// Everything is built from simple shapes and pictures drawn in code.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from './strings.js';

// H: helpers of props.js { std, box, tex, textTexture, glowTexture }
export function garageProps(H) {
  const { std, box, tex } = H;
  const canvas = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; };

  // THE BANK RECORD on paper: the same lines as Lena's screen in Chapter 5, printed in grey on white, a fold across
  // the middle, and one line ringed by hand with a pen (Lena's)
  const recordTex = () => tex('bankPaper', () => canvas(512, 704, (g, w, h) => {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
    // the paper's grain, and the shadow of the fold
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80, 70, 50, ${Math.random() * 0.035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const fold = g.createLinearGradient(0, h * 0.47, 0, h * 0.53);
    fold.addColorStop(0, 'rgba(0,0,0,0)'); fold.addColorStop(0.5, 'rgba(60, 50, 40, 0.12)'); fold.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fold; g.fillRect(0, h * 0.47, w, h * 0.06);
    g.fillStyle = '#2a2a2c'; g.font = '700 21px monospace'; g.fillText(t('c5.bank.title'), 30, 64);
    g.fillRect(30, 78, w - 60, 2);
    g.font = '17px monospace';
    ['c5.bank.r1', 'c5.bank.r2', 'c5.bank.r3', 'c5.bank.r4', 'c5.bank.r5'].forEach((k, i) => { g.fillStyle = i === 2 ? '#141416' : '#56565a'; g.fillText(t(k), 30, 130 + i * 42); });
    // the ring around the third line, drawn with a blue pen, twice round and not quite closed
    g.strokeStyle = 'rgba(30, 50, 130, 0.85)'; g.lineWidth = 3;
    for (const k of [0, 1]) { g.beginPath(); g.ellipse(w / 2 + k * 4, 130 + 2 * 42 - 6 + k * 2, w / 2 - 14 - k * 3, 26 + k * 2, -0.02 + k * 0.03, 0.2, Math.PI * 2 - 0.1); g.stroke(); }
    g.fillStyle = '#6a6a6e'; g.font = '13px monospace'; g.fillText(t('c5.bank.foot'), 30, h - 40);
  }));
  const tagTex = () => tex('keyTag', () => canvas(64, 96, (g, w, h) => {
    g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#20202a'; g.font = '700 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', w / 2, h / 2 + 4);
  }));

  const makers = {
    // a sheet of paper lying flat, folded once (a little open along the fold)
    bankPaper() {
      const geo = new THREE.PlaneGeometry(0.21, 0.29, 1, 8);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.max(0, 0.012 - Math.abs(y) * 0.09)); }
      geo.computeVertexNormals();
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: recordTex(), roughness: 0.92, side: THREE.DoubleSide }));
      m.position.y = 0.002;
      m.castShadow = true; m.receiveShadow = true;
      const g = new THREE.Group(); g.add(m);
      return g;
    },
    // a combination spanner (held in a hand: the handle along the fingers)
    spanner() {
      const g = new THREE.Group(), steel = std(0xc4c6c8, 0.28, 0.95);
      const shaft = box(0.016, 0.2, 0.006, steel); g.add(shaft);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 6, 14), steel); ring.position.y = 0.108; g.add(ring);
      const jaw = box(0.032, 0.018, 0.006, steel); jaw.position.y = -0.106; g.add(jaw);
      g.userData.grip = 80;
      return g;
    },
    // Theo's car key: a worn key, a steel ring, a cardboard tag with a 7
    carKey() {
      const g = new THREE.Group(), brass = std(0xb39a5a, 0.35, 0.85);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 14), std(0x1b1b1d, 0.5, 0.2)); head.rotation.x = Math.PI / 2; g.add(head);
      const blade = box(0.006, 0.045, 0.003, brass); blade.position.y = -0.034; g.add(blade);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0016, 5, 16), std(0xb8b8b8, 0.3, 0.9)); ring.position.y = 0.022; g.add(ring);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.033), new THREE.MeshStandardMaterial({ map: tagTex(), roughness: 0.9, side: THREE.DoubleSide }));
      tag.position.set(0.006, 0.045, 0.002); tag.rotation.z = 0.25; g.add(tag);
      g.userData.grip = 55;
      return g;
    },
    // an oily rag, bunched (in a hand or on the bench)
    oilRag() {
      const geo = new THREE.IcosahedronGeometry(0.055, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + Math.sin(x * 61 + y * 37) * 0.18 + Math.sin(z * 53) * 0.12; p.setXYZ(i, x * k * 1.3, y * k * 0.55, z * k); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, std(0x6e5a44, 0.97));
      m.castShadow = true;
      const g = new THREE.Group(); g.add(m);
      g.userData.grip = 45;
      return g;
    },
  };
  return { makers };
}
