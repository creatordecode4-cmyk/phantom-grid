// ---------------------------------------------------------------------------
// cargo.js - A LOAD ON A VEHICLE (Chapter 5, the docks).
//
// Two kinds of load:
//   'crate'    a wooden crate strapped on the back of a van or truck
//   'inside'   people inside a truck (Chapter 9: Dante in the prison truck) - nothing to see, only the integrity
//   'trailer'  a flat trailer behind the truck with a 20-foot shipping container on it
//              (container 77). The trailer swings behind on its hitch like a real one:
//              in a turn it cuts the corner, and it can hit walls on its own.
//
// What a load does:
//   * HEAVY (0..1): the engine pulls less and the brakes need longer (physics.js reads v.heavy).
//   * INTEGRITY (1 = whole .. 0 = ruined): hard hits of the vehicle, and the trailer scraping
//     along walls and containers, break it a little each time. The story shows it as a thin bar
//     and can fail the mission when it is gone (event 'cargo:broken').
//
// The story attaches it with { do: 'cargo', vehicle, kind, label, heavy } and takes it off with
// { do: 'cargo', vehicle, off: true }. Condition: { cargoUnder: 0.5 }.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { mergeParts } from '../utils/geometry.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CH = 2.59, CW = 2.44, L20 = 6.06;            // a 20-foot container
const KING = 5.3;                                   // meters from the kingpin (front of the trailer) to its axles

// the number painted on the container: white on the paint, a little worn
function numberTexture(label) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#fff';
  g.font = 'bold 92px Arial, Helvetica, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, 128, 70);
  // wear: small scratches take the paint off the number
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 140; i++) { g.fillRect(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 5, 1); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCargo({ scene, city, mats }) {
  const loads = new Map();          // vehicle -> load
  const events = [];                // 'hit' | 'scrape' | 'broken' (the story reads them)

  // ---------------------------------------------------------------- models
  function crateMesh() {
    const wood = [0.36, 0.25, 0.15], dark = [0.2, 0.14, 0.08], strap = [0.75, 0.5, 0.08];
    const parts = [{ geom: new THREE.BoxGeometry(1.2, 0.9, 1.0), pos: [0, 0.45, 0], color: wood, rough: 0.85 }];
    // planks and the frame around the edges
    for (const y of [0.06, 0.84]) for (const z of [-0.51, 0.51]) parts.push({ geom: new THREE.BoxGeometry(1.24, 0.1, 0.04), pos: [0, y, z], color: dark, rough: 0.9 });
    for (const x of [-0.6, 0.6]) for (const z of [-0.51, 0.51]) parts.push({ geom: new THREE.BoxGeometry(0.1, 0.9, 0.05), pos: [x, 0.45, z], color: dark, rough: 0.9 });
    // two orange straps over it
    for (const x of [-0.32, 0.32]) parts.push({ geom: new THREE.BoxGeometry(0.06, 0.94, 1.04), pos: [x, 0.45, 0], color: strap, rough: 0.6 });
    const m = new THREE.Mesh(mergeParts(parts), mats.prop);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function trailerMesh(label, color) {
    const steel = [0.08, 0.085, 0.09], rubber = [0.025, 0.025, 0.028], rim = [0.4, 0.41, 0.42];
    const parts = [
      // the frame: two long beams, cross members, the deck plate, the gooseneck at the front
      { geom: new THREE.BoxGeometry(0.22, 0.32, 7.4), pos: [-0.55, 1.0, -3.2], color: steel, rough: 0.6, metal: 0.6 },
      { geom: new THREE.BoxGeometry(0.22, 0.32, 7.4), pos: [0.55, 1.0, -3.2], color: steel, rough: 0.6, metal: 0.6 },
      { geom: new THREE.BoxGeometry(2.46, 0.1, 6.7), pos: [0, 1.2, -3.55], color: [0.12, 0.12, 0.13], rough: 0.7, metal: 0.5 },
      { geom: new THREE.BoxGeometry(2.3, 0.22, 1.1), pos: [0, 1.12, 0.05], color: steel, rough: 0.6, metal: 0.6 },
      // landing legs (folded up)
      { geom: new THREE.BoxGeometry(0.14, 0.7, 0.14), pos: [-0.95, 0.65, -1.6], color: [0.3, 0.31, 0.32], rough: 0.5, metal: 0.6 },
      { geom: new THREE.BoxGeometry(0.14, 0.7, 0.14), pos: [0.95, 0.65, -1.6], color: [0.3, 0.31, 0.32], rough: 0.5, metal: 0.6 },
      // mud flaps and the rear bumper with its red lamps
      { geom: new THREE.BoxGeometry(2.4, 0.16, 0.14), pos: [0, 0.62, -6.85], color: steel, rough: 0.6, metal: 0.6 },
      { geom: new THREE.BoxGeometry(0.3, 0.12, 0.04), pos: [-1.0, 0.75, -6.93], color: [1, 0.08, 0.04], rough: 0.4, glow: 1.4 },
      { geom: new THREE.BoxGeometry(0.3, 0.12, 0.04), pos: [1.0, 0.75, -6.93], color: [1, 0.08, 0.04], rough: 0.4, glow: 1.4 },
      { geom: new THREE.BoxGeometry(0.62, 0.55, 0.02), pos: [-0.9, 0.5, -6.6], color: rubber, rough: 0.9 },
      { geom: new THREE.BoxGeometry(0.62, 0.55, 0.02), pos: [0.9, 0.5, -6.6], color: rubber, rough: 0.9 },
      // amber side markers
      { geom: new THREE.BoxGeometry(0.03, 0.06, 0.12), pos: [1.24, 1.1, -3.4], color: [1, 0.55, 0.05], rough: 0.4, glow: 1.2 },
      { geom: new THREE.BoxGeometry(0.03, 0.06, 0.12), pos: [-1.24, 1.1, -3.4], color: [1, 0.55, 0.05], rough: 0.4, glow: 1.2 },
    ];
    // two axles: twin wheels on each side
    for (const z of [-4.9, -5.95]) for (const s of [-1, 1]) {
      parts.push({ geom: new THREE.CylinderGeometry(0.5, 0.5, 0.48, 16), pos: [s * 0.88, 0.5, z], rot: [0, 0, Math.PI / 2], color: rubber, rough: 0.9 });
      parts.push({ geom: new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12), pos: [s * 0.89, 0.5, z], rot: [0, 0, Math.PI / 2], color: rim, rough: 0.4, metal: 0.7 });
    }
    const frame = new THREE.Mesh(mergeParts(parts), mats.prop);
    frame.castShadow = true; frame.receiveShadow = true;
    // the container: its paint, corrugated sides, doors at the back
    const box = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, L20), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(color[0], color[1], color[2]), roughness: 0.7, metalness: 0.35 }));
    box.position.set(0, 1.25 + CH / 2, -3.55);
    box.castShadow = true; box.receiveShadow = true;
    const ribs = [];
    for (let z = -L20 / 2 + 0.2; z < L20 / 2 - 0.1; z += 0.3) for (const s of [-1, 1]) ribs.push({ geom: new THREE.BoxGeometry(0.04, CH - 0.25, 0.1), pos: [s * (CW / 2 + 0.015), 0, z], color: [color[0] * 0.8, color[1] * 0.8, color[2] * 0.8], rough: 0.7, metal: 0.35 });
    for (const x of [-0.85, -0.3, 0.3, 0.85]) ribs.push({ geom: new THREE.BoxGeometry(0.05, CH - 0.3, 0.05), pos: [x, 0, -L20 / 2 - 0.03], color: [0.55, 0.55, 0.55], rough: 0.5, metal: 0.7 });
    const ribMesh = new THREE.Mesh(mergeParts(ribs), mats.prop);
    ribMesh.position.copy(box.position);
    // the number on both sides and on the doors
    const numMat = new THREE.MeshBasicMaterial({ map: numberTexture(label), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: 0xe8e8e0 });
    const g = new THREE.Group();
    g.add(frame, box, ribMesh);
    for (const [x, ry] of [[CW / 2 + 0.045, Math.PI / 2], [-CW / 2 - 0.045, -Math.PI / 2]]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), numMat);
      n.position.set(x, 1.25 + CH * 0.6, -3.55); n.rotation.y = ry;
      g.add(n);
    }
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), numMat);
    nb.position.set(0, 1.25 + CH * 0.72, -3.55 - L20 / 2 - 0.07); nb.rotation.y = Math.PI;
    g.add(nb);
    return g;
  }

  // ---------------------------------------------------------------- attach / detach
  // spec: { kind: 'crate' | 'trailer', label, color, heavy (0..1), integrity }
  function attach(v, spec = {}) {
    detach(v);
    const kind = spec.kind || 'crate';
    const load = { kind, integrity: spec.integrity === undefined ? 1 : spec.integrity, heavy: spec.heavy === undefined ? (kind === 'trailer' ? 0.6 : 0.25) : spec.heavy,
      label: spec.label || '', mesh: null, ax: 0, az: 0, heading: v.heading, cool: 0, scrape: 0, broken: false, fragile: spec.fragile === undefined ? 1 : spec.fragile };
    if (kind === 'inside') {
      // (Chapter 9: people inside a truck - nothing to see, only how they are: hard hits hurt them)
    } else if (kind === 'trailer') {
      load.mesh = trailerMesh(load.label || '77', spec.color || [0.12, 0.2, 0.26]);
      scene.add(load.mesh);
      const h = hitch(v);
      load.ax = h.x - Math.sin(v.heading) * KING; load.az = h.z - Math.cos(v.heading) * KING;
      load.heading = v.heading;
      place(v, load);
    } else {
      load.mesh = crateMesh();
      // on the back of the roof (a van) or the back of a bed
      const s = v.group.scale.x || 1;
      load.mesh.position.set(0, (v.info.roof || 1.8) / s + 0.02, (v.info.backZ || -2) / s + 0.85);
      load.mesh.scale.setScalar(1 / s);
      v.tilt.add(load.mesh);
    }
    v.heavy = load.heavy;
    loads.set(v, load);
    return load;
  }
  function detach(v) {
    const load = loads.get(v);
    if (!load) return;
    if (load.mesh) { if (load.kind === 'trailer') scene.remove(load.mesh); else v.tilt.remove(load.mesh); }
    loads.delete(v);
    v.heavy = 0;
  }
  // the hitch: a little behind the truck's back bumper
  function hitch(v) {
    const b = (v.info.backZ || -2.5) + 0.2;
    return { x: v.x + Math.sin(v.heading) * b, z: v.z + Math.cos(v.heading) * b };
  }
  const _e = new THREE.Euler();
  function place(v, load) {
    // (drawn at the truck's smooth pose, the one we see - vehicle.js)
    const b = (v.info.backZ || -2.5) + 0.2, H = v.rh ?? v.heading;
    const h = { x: (v.rx ?? v.x) + Math.sin(H) * b, z: (v.rz ?? v.z) + Math.cos(H) * b };
    load.mesh.position.set(h.x, city.groundHeight(h.x, h.z), h.z);
    _e.set(0, load.heading, 0);
    load.mesh.rotation.copy(_e);
  }

  // ---------------------------------------------------------------- every frame
  // the trailer's circles bump into the world: walls, containers, posts, cars
  function trailerHits(v, load) {
    const fx = Math.sin(load.heading), fz = Math.cos(load.heading), h = hitch(v), R = 1.25;
    let push = 0;
    for (const off of [-1.3, -3.4, -5.6]) {
      const cx = h.x + fx * off, cz = h.z + fz * off;
      const cell = city.colliders.near(cx, cz);
      let px = 0, pz = 0;
      for (const b of cell.boxes) {
        if (b.h < 0.3 || b.boatOnly) continue;
        const qx = clamp(cx, b.minX, b.maxX), qz = clamp(cz, b.minZ, b.maxZ);
        const dx = cx - qx, dz = cz - qz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R || d2 < 1e-8) continue;
        const d = Math.sqrt(d2); px += (dx / d) * (R - d); pz += (dz / d) * (R - d);
      }
      const circ = (c) => {
        if (c.veh === v) return;
        const dx = cx - c.x, dz = cz - c.z, min = R + c.r, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-8) return;
        const d = Math.sqrt(d2); px += (dx / d) * (min - d); pz += (dz / d) * (min - d);
      };
      for (const c of cell.circles) circ(c);
      for (const c of city.colliders.dynamic || []) circ(c);
      const len = Math.hypot(px, pz);
      if (len < 0.02) continue;
      // the wall moves the back of the trailer (the axles): weighted by how far back the circle is
      const k = clamp(-off / 5.6, 0.25, 1);
      load.ax += px * k; load.az += pz * k;
      push = Math.max(push, len);
    }
    return push;
  }

  function update(dt) {
    events.length = 0;
    for (const [v, load] of loads) {
      if (!v.group.parent) { detach(v); continue; }      // (the vehicle was removed)
      const speed = Math.hypot(v.vx || 0, v.vz || 0);
      load.cool -= dt;
      // hard hits of the vehicle itself (fx.impact is m/s into the obstacle; a car the computer drives keeps what it
      // felt from other cars in hitFelt - vehicle.js)
      const imp = Math.max((v.fx && v.fx.impact) || 0, v.hitFelt || 0);
      if (imp > 2.4 && load.cool <= 0) {
        load.cool = 0.45;
        load.integrity -= (imp - 1.8) * 0.032 * load.fragile;
        events.push('hit');
      }
      if (load.kind === 'trailer') {
        // the axles are dragged toward the hitch (the trailer follows the truck's path)
        const h = hitch(v);
        let dx = h.x - load.ax, dz = h.z - load.az;
        let d = Math.hypot(dx, dz) || 1;
        load.ax = h.x - (dx / d) * KING; load.az = h.z - (dz / d) * KING;
        load.heading = Math.atan2(h.x - load.ax, h.z - load.az);
        // ... and stopped by what it hits
        const push = trailerHits(v, load);
        if (push > 0.02) {
          dx = h.x - load.ax; dz = h.z - load.az; d = Math.hypot(dx, dz) || 1;
          load.ax = h.x - (dx / d) * KING; load.az = h.z - (dz / d) * KING;
          load.heading = Math.atan2(h.x - load.ax, h.z - load.az);
          if (speed > 1.2) {
            load.integrity -= (0.035 + speed * 0.006) * dt * load.fragile;
            load.scrape += dt;
            if (load.scrape > 0.25) { load.scrape = 0; events.push('scrape'); }
            // a trailer stuck on a wall holds the truck back a little
            v.vx *= 1 - Math.min(0.5, dt * 2.2); v.vz *= 1 - Math.min(0.5, dt * 2.2);
          }
        }
        // jackknife: the trailer may not fold more than about 75 degrees
        let rel = Math.atan2(Math.sin(load.heading - v.heading), Math.cos(load.heading - v.heading));
        if (Math.abs(rel) > 1.3) {
          rel = Math.sign(rel) * 1.3;
          load.heading = v.heading + rel;
          load.ax = h.x - Math.sin(load.heading) * KING; load.az = h.z - Math.cos(load.heading) * KING;
        }
        place(v, load);
      }
      load.integrity = clamp(load.integrity, 0, 1);
      if (load.integrity <= 0 && !load.broken) { load.broken = true; events.push('broken'); }
    }
  }

  return {
    attach, detach, update, events,
    get: (v) => loads.get(v) || null,
    // the load of a vehicle that is being driven (for the screen): { integrity, label } or null
    info(v) { const l = v ? loads.get(v) : null; return l ? { integrity: l.integrity, label: l.label, kind: l.kind } : null; },
    // the trailer of a vehicle: where its back is (the story checks it is inside the back warehouse)
    tail(v) { const l = loads.get(v); return l && l.kind === 'trailer' ? { x: l.ax, z: l.az } : null; },
    // the circles of every trailer: cb(x, z, r) (the traffic must not drive through a trailer either)
    circles(cb) {
      for (const [v, l] of loads) {
        if (l.kind !== 'trailer' || v.away) continue;
        const fx = Math.sin(l.heading), fz = Math.cos(l.heading), h = hitch(v);
        for (const off of [-1.3, -3.4, -5.6]) cb(h.x + fx * off, h.z + fz * off, 1.25);
      }
    },
    clear() { for (const v of [...loads.keys()]) detach(v); },
  };
}
