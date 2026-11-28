// ---------------------------------------------------------------------------
// construction.js - WHAT MOVES ON THE CONSTRUCTION SITE.
//
// The site itself (fence, concrete frame, scaffolding, crane, piles) stands still and is part of the city's big
// meshes (src/city/siteBuilding.js). This file adds the life:
//
//   * THE WORKERS: twelve people in bright vests and hard hats, all drawn with one instanced mesh. Each one has
//     a job - hammering, shovelling sand, carrying, guiding the crane with an arm up, talking at the office,
//     walking their rounds. The arm and body movement of the jobs is done by the graphics card (the crowd shader
//     in materials.js, "PG_WORK"), so it costs almost nothing.
//     A worker hit by a car or a bat falls and gets up again (nobody is hurt).
//   * THE DIGGER: its upper part swings from the heap to the truck place and back, its arm dips and lifts.
//   * THE SITE BOARD on the fence, with the name of the project.
//   * hammer blows and the digger's motor, when the player is near.
//
// Everything here is only shown (and only moved) when the player is within 150 m.
//
//   const site = createConstruction({ scene, city, materials, sound });
//   site.update(dt, time, playerX, playerZ, obstacles);     obstacles: the circles of the player's car (main.js)
//   site.knockAt(x, z, r, dx, dz)                           a hit that is not a car: returns how many fell
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MeshBuilder, softBox } from '../utils/geometry.js';
import { makeHumanFigure, lin } from '../city/models.js';
import { SITE } from '../city/siteBuilding.js';

const WORK = { stand: 0, walk: 0, hammer: 1, dig: 2, carry: 3, wave: 4 };
const VESTS = [[1.0, 0.36, 0.02], [0.85, 0.75, 0.05], [1.0, 0.42, 0.04], [0.85, 0.75, 0.05], [0.95, 0.3, 0.02]];
const SHOW = 150;

export function createConstruction({ scene, city, materials, sound }) {
  if (!SITE.ready) return { update() {}, knockAt() { return 0; }, get ready() { return false; }, site: SITE };
  const group = new THREE.Group();
  group.name = 'constructionSite';
  group.visible = false;
  scene.add(group);

  // ======================================================================= the workers
  const W = SITE.workers, n = W.length;
  const geo = makeHumanFigure('worker', 1);
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  phase.setUsage(THREE.DynamicDrawUsage);
  const work = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
  work.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPhase', phase);
  geo.setAttribute('aWork', work);
  const mesh = new THREE.InstancedMesh(geo, materials.mats.worker, n);
  mesh.name = 'siteWorkers';
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const crew = W.map((w, i) => {
    const c = VESTS[i % VESTS.length];
    mesh.instanceColor.setXYZ(i, c[0], c[1], c[2]);
    const walks = w.work === 'walk' || w.work === 'carry';
    work.setXY(i, WORK[w.work] || 0, i * 1.7);
    return { ...w, ax: w.x, az: w.z, walks, len: walks ? Math.hypot(w.x2 - w.x, w.z2 - w.z) : 0, t: (i * 0.37) % 1, dir: 1, ph: i, size: 0.94 + ((i * 7) % 5) * 0.03, idle: i * 1.3, fall: 0, fallDir: 0, wait: 0, kind: WORK[w.work] || 0 };
  });
  group.add(mesh);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const UPV = new THREE.Vector3(0, 1, 0), XV = new THREE.Vector3(1, 0, 0);

  // ======================================================================= the digger
  // (the tracks stand still; the upper part turns on them, the arm moves on the upper part)
  const YEL = lin([0.92, 0.66, 0.06]), DRK = lin([0.14, 0.14, 0.15]), GLS = lin([0.07, 0.12, 0.17]), STL = lin([0.62, 0.64, 0.66]);
  const part = (fill) => {
    const mb = new MeshBuilder();
    const put = (g, c, x, y, z, rot = null, scale = null, rough = 0.6, metal = 0.2) => { mb.color(c[0], c[1], c[2], 1); mb.data(rough, metal, 0, 0); mb.add(g, x, y, z, rot, scale); };
    // a bar from a to b
    const bar = (c, a, b, w, d = w, rough = 0.6, metal = 0.2) => {
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(UPV, dir.normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(w, len, d));
      mb.color(c[0], c[1], c[2], 1); mb.data(rough, metal, 0, 0);
      mb.addGeometry(BOX, m);
    };
    fill(put, bar);
    const m = new THREE.InstancedMesh(mb.build(), materials.mats.prop, 1);
    m.setMatrixAt(0, new THREE.Matrix4());
    m.frustumCulled = false;
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
  const D = SITE.digger;
  const digger = new THREE.Group();
  digger.position.set(D.x, D.y, D.z);
  digger.rotation.y = D.rot;
  const base = part((put) => {
    for (const sx of [-1.05, 1.05]) {
      put(softBox(0.55, 0.72, 3.7, 0.16), DRK, sx, 0.36, 0, null, null, 0.9, 0);
      for (let i = 0; i < 5; i++) put(CYL, STL, sx + Math.sign(sx) * 0.285, 0.3, -1.3 + i * 0.65, [0, 0, Math.PI / 2], [0.2, 0.02, 0.2], 0.5, 0.6);
    }
    put(softBox(1.7, 0.36, 1.8, 0.06), DRK, 0, 0.5, 0);
    put(CYL, DRK, 0, 0.8, 0, null, [0.8, 0.26, 0.8]);
  });
  const upper = new THREE.Group();
  upper.position.y = 0.93;
  upper.add(part((put, bar) => {
    put(softBox(2.5, 1.0, 3.0, 0.1), YEL, 0, 0.55, -0.55);                       // the motor house
    put(softBox(2.56, 0.95, 0.75, 0.16), DRK, 0, 0.5, -2.2, null, null, 0.7, 0.1); // the counter weight
    put(softBox(1.0, 1.55, 1.5, 0.1), YEL, 0.74, 1.3, 0.7);                       // the cab
    put(BOX, GLS, 0.74, 1.45, 1.46, null, [0.84, 0.95, 0.02], 0.15, 0.4);         // its glass: front, side
    put(BOX, GLS, 1.245, 1.45, 0.7, null, [0.02, 0.95, 1.2], 0.15, 0.4);
    put(BOX, GLS, 0.235, 1.45, 0.7, null, [0.02, 0.95, 1.2], 0.15, 0.4);
    put(BOX, DRK, -0.5, 0.75, -1.2, null, [0.9, 0.5, 0.02], 0.8, 0);              // a grille
    put(CYL, DRK, -0.9, 1.4, -1.4, null, [0.06, 0.7, 0.06], 0.6, 0.6);            // the exhaust
    bar(DRK, [-0.55, 0.9, 0.5], [-0.55, 0.9, 1.3], 0.5, 0.3);                     // the foot of the arm
  }));
  const arm = new THREE.Group();
  arm.position.set(-0.3, 1.05, 0.95);
  arm.add(part((put, bar) => {
    // the boom (bent like a banana), the stick, the bucket, the shiny rods of the rams
    bar(YEL, [0, 0, 0], [0, 2.5, 2.0], 0.36, 0.5); bar(YEL, [0, 2.5, 2.0], [0, 2.75, 4.4], 0.34, 0.44);
    put(softBox(0.4, 0.5, 0.5, 0.08), YEL, 0, 2.5, 2.0);
    bar(YEL, [0, 2.9, 4.2], [0, 0.75, 5.9], 0.28, 0.36);
    bar(DRK, [0, 0.2, 0.9], [0, 1.6, 1.2], 0.16); bar(STL, [0, 1.6, 1.2], [0, 2.3, 1.75], 0.09, 0.09, 0.2, 0.9);
    bar(DRK, [0, 3.05, 2.6], [0, 3.3, 3.6], 0.15); bar(STL, [0, 3.3, 3.6], [0, 3.15, 4.3], 0.08, 0.08, 0.2, 0.9);
    // the bucket: a curved scoop from five plates, with teeth
    const B = [0, 0.7, 5.95];
    put(BOX, DRK, B[0], B[1] - 0.1, B[2] + 0.15, [0.5, 0, 0], [0.95, 0.06, 0.7], 0.7, 0.4);
    put(BOX, DRK, B[0], B[1] - 0.5, B[2] + 0.2, [-0.5, 0, 0], [0.95, 0.06, 0.75], 0.7, 0.4);
    put(BOX, DRK, B[0], B[1] - 0.72, B[2] - 0.25, [-1.35, 0, 0], [0.95, 0.06, 0.5], 0.7, 0.4);
    for (const sx of [-0.475, 0.475]) put(BOX, DRK, B[0] + sx, B[1] - 0.4, B[2] + 0.02, null, [0.05, 0.8, 0.85], 0.7, 0.4);
    for (let i = 0; i < 4; i++) put(BOX, STL, B[0] - 0.33 + i * 0.22, B[1] - 0.86, B[2] - 0.52, [-1.2, 0, 0], [0.08, 0.05, 0.22], 0.4, 0.8);
  }));
  upper.add(arm);
  digger.add(base, upper);
  group.add(digger);

  // ======================================================================= the board on the fence
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#1d4a7c'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#ffffff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HALDEN YARD', 256, 34);
    g.fillStyle = '#20242a'; g.font = 'bold 30px sans-serif'; g.fillText('64 NEW HOMES · OPENING 2032', 256, 104);
    g.font = '22px sans-serif'; g.fillStyle = '#4a4f56'; g.fillText('Built by Rook & Daughters, Meridian', 256, 144);
    g.fillStyle = '#f2b20c'; g.fillRect(0, 180, 512, 76);
    g.fillStyle = '#16181a'; g.font = 'bold 32px sans-serif'; g.fillText('DANGER · HARD HATS ONLY', 256, 220);
    // (black and yellow stripes at both ends of the yellow band)
    for (let i = 0; i < 3; i++) { g.fillStyle = '#16181a'; g.beginPath(); g.moveTo(8 + i * 14, 256); g.lineTo(22 + i * 14, 180); g.lineTo(29 + i * 14, 180); g.lineTo(15 + i * 14, 256); g.fill(); g.beginPath(); g.moveTo(470 + i * 14, 256); g.lineTo(484 + i * 14, 180); g.lineTo(491 + i * 14, 180); g.lineTo(477 + i * 14, 256); g.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    // (the printed face is one flat piece; its back plate and the two legs are one more piece)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    const S = SITE.sign;
    board.position.set(S.x + Math.sin(S.rot) * 0.035, S.y, S.z + Math.cos(S.rot) * 0.035);
    board.rotation.y = S.rot;
    group.add(board);
    const back = part((put) => {
      put(BOX, lin([0.5, 0.52, 0.54]), 0, 0, 0, null, [4.5, 2.3, 0.06], 0.7, 0.3);
      for (const dx of [-1.8, 1.8]) put(BOX, lin([0.4, 0.42, 0.44]), dx, -0.75, -0.08, null, [0.1, 3.9, 0.1], 0.6, 0.5);
    });
    back.position.set(S.x, S.y, S.z);
    back.rotation.y = S.rot;
    group.add(back);
  }

  // ======================================================================= run time
  let near = false, hammerT = 0, motorT = 0, swing = 0;
  function update(dt, time, px, pz, obstacles = null) {
    const d = Math.hypot(SITE.center.x - px, SITE.center.z - pz);
    near = d < SHOW;
    group.visible = near;
    if (!near) return;
    // ---- the digger: turn to the heap, dip, lift, turn to the tip place, lower, and again (16 seconds) ----
    swing = (time % 16) / 16;
    const k = swing < 0.25 ? 0 : swing < 0.45 ? (swing - 0.25) / 0.2 : swing < 0.7 ? 1 : swing < 0.9 ? 1 - (swing - 0.7) / 0.2 : 0;
    const e = k * k * (3 - 2 * k);
    upper.rotation.y = -0.2 + e * 1.5;
    const dig = swing < 0.25 ? Math.sin((swing / 0.25) * Math.PI) : swing > 0.45 && swing < 0.7 ? Math.sin(((swing - 0.45) / 0.25) * Math.PI) * 0.5 : 0;
    arm.rotation.x = 0.06 + dig * 0.2;
    // ---- the workers ----
    for (let i = 0; i < n; i++) {
      const w = crew[i];
      // hit by the player's car: fall, lie a moment, get up
      if (obstacles && w.fall <= 0 && w.y - SITE.curb < 1) {
        for (const ob of obstacles) {
          if (!(ob.speed > 3.5)) continue;
          if (Math.hypot(w.x - ob.x, w.z - ob.z) < ob.r + 0.5) { w.fall = 3.6; w.fallDir = Math.atan2(-ob.dx, -ob.dz); w.px = ob.dx * Math.min(8, ob.speed * 0.5); w.pz = ob.dz * Math.min(8, ob.speed * 0.5); if (sound && sound.thump) sound.thump(1); break; }
        }
      }
      if (w.fall > 0) {
        w.fall -= dt;
        // pushed along, sliding to a stop
        if (w.px || w.pz) { w.x += w.px * dt; w.z += w.pz * dt; const f = Math.exp(-4 * dt); w.px *= f; w.pz *= f; w.ax = w.x; w.az = w.z; if (w.walks) { w.x2 += w.px * dt; w.z2 += w.pz * dt; } }
      } else if (w.walks) {
        // walk to the other end, stop a moment, walk back
        if (w.wait > 0) w.wait -= dt;
        else {
          w.t += (w.dir * 1.15 * dt) / w.len;
          if (w.t > 1) { w.t = 1; w.dir = -1; w.wait = 1.5; } else if (w.t < 0) { w.t = 0; w.dir = 1; w.wait = 1.5; }
          w.ph += 1.15 * dt * 4.4;
        }
        w.x = w.ax + (w.x2 - w.ax) * w.t; w.z = w.az + (w.z2 - w.az) * w.t;
        w.heading = Math.atan2((w.x2 - w.ax) * w.dir, (w.z2 - w.az) * w.dir);
      } else w.idle += dt;
      const lying = w.fall > 0;
      let lean = 0;
      if (lying) { const t = 3.6 - w.fall; lean = 1.45 * (t < 0.3 ? t / 0.3 : w.fall < 0.8 ? w.fall / 0.8 : 1); }
      const turn = w.walks || lying ? 0 : Math.sin(w.idle * 0.3 + i) * (w.kind ? 0.08 : 0.3);
      _q.setFromAxisAngle(UPV, lying ? w.fallDir : w.heading + turn);
      if (lean) _q.multiply(_q2.setFromAxisAngle(XV, -lean));
      _m.compose(_p.set(w.x, w.y + (lean ? Math.sin(lean) * 0.12 : 0), w.z), _q, _s.set(w.size, w.size, w.size));
      mesh.setMatrixAt(i, _m);
      phase.array[i] = w.walks && !lying && w.wait <= 0 ? w.ph : 0;
      // (somebody lying on the ground does not go on hammering)
      const kind = lying ? 0 : w.kind;
      if (work.array[i * 2] !== kind) { work.array[i * 2] = kind; work.needsUpdate = true; }
    }
    mesh.instanceMatrix.needsUpdate = true;
    phase.needsUpdate = true;
    // ---- sounds, when close: hammer blows, the digger's motor ----
    if (sound && d < 60) {
      const vol = Math.max(0, 1 - d / 60);
      hammerT -= dt;
      if (hammerT <= 0) { hammerT = 0.24 + Math.random() * (Math.random() < 0.2 ? 1.6 : 0.12); if (sound.hammer) sound.hammer(vol * 0.5); }
      motorT -= dt;
      if (motorT <= 0) { motorT = 0.5; if (sound.motorPuff) sound.motorPuff(vol * (0.25 + e * 0.2)); }
    }
  }

  return {
    update, site: SITE, group, workers: crew,
    get ready() { return true; },
    get near() { return near; },
    // a hit that is not a car (a bat): the workers within r of (x, z) fall, pushed along (dx, dz)
    knockAt(x, z, r, dx, dz, power = 3) {
      let c = 0;
      for (const w of crew) {
        if (w.fall > 0 || Math.hypot(w.x - x, w.z - z) > r) continue;
        w.fall = 3.6; w.fallDir = Math.atan2(-dx, -dz); w.px = dx * power; w.pz = dz * power; c++;
      }
      return c;
    },
  };
}
