// ---------------------------------------------------------------------------
// looseProps.js - STREET THINGS THAT CAN BE KNOCKED OVER.
//
// A trash bin, a news box, a parking meter, a street sign and a hydrant are bolted down lightly: a car that hits one
// fast enough tears it loose. The copy of the thing in the street is taken away (props.js marked its collider as
// "loose") and a body of its own takes its place, thrown by the car. That body is a real small piece of physics:
//
//   A BOX IN THE AIR AND ON THE GROUND. It has a place, a speed, a turn (a quaternion) and a spin. Gravity pulls it
//   down. Every step its eight corners are looked at: the lowest one that is under the ground gets a push up that
//   stops it (and gives a little of the speed back: a bounce), and a push against its sliding (friction). Both pushes
//   act at that corner - not at the middle - so they also change the spin: the thing tips over, tumbles and rolls
//   by itself. (This is the usual way a rigid body is stopped: an "impulse" at the point of contact.)
//   When it has come to rest for a moment it sleeps: no more work.
//
// A thing that lies still far behind the player is put back upright (the city repairs itself out of sight).
// A knocked hydrant leaves a jet of water for a while.
//
//   const loose = createLooseProps({ scene, city, sound });
//   vehicles.onKnock = (collider, vehicle) => loose.knock(collider, vehicle.vx, vehicle.vz, vehicle);
//   loose.push(x, z, r, dx, dz, power)      a hit from something else (a bat): knocks loose things near (x, z)
//   loose.update(dt, playerX, playerZ);  loose.reset()
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const G = 9.81;
// per kind: the half size of its box (x, up, z), its weight, the speed (m/s) a car needs to tear it loose,
// how much of its speed the car keeps
const KINDS = {
  bin: { half: [0.23, 0.46, 0.23], mass: 14, min: 3.2, slow: 0.97, bounce: 0.32, sound: 'light' },
  newsBox: { half: [0.24, 0.6, 0.21], mass: 34, min: 4.5, slow: 0.94, bounce: 0.22, sound: 'metal' },
  meter: { half: [0.09, 0.7, 0.07], mass: 12, min: 5.5, slow: 0.96, bounce: 0.25, sound: 'metal' },
  streetSign: { half: [0.3, 1.45, 0.05], mass: 16, min: 6.5, slow: 0.95, bounce: 0.2, sound: 'metal' },
  hydrant: { half: [0.13, 0.38, 0.13], mass: 55, min: 8, slow: 0.86, bounce: 0.18, sound: 'heavy', water: true },
};
const MAX_BODIES = 14;

export function createLooseProps({ scene, city, sound }) {
  const bodies = [];              // the things that were knocked loose
  const jets = [];                // water jets of knocked hydrants
  const pending = [];             // colliders to take out of the collision grid (not while the grid is being read)
  const out = new Set();          // the colliders that are out of the grid right now
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix3(), _mi = new THREE.Matrix3(), _mt = new THREE.Matrix3();
  const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0);
  const ground = (x, z) => city.groundHeight(x, z);

  // (the collider carries the speed needed and what the car keeps: vehicle.js reads them)
  for (const c of city.colliders.circles) if (c.loose && KINDS[c.loose.set]) { c.loose.min = KINDS[c.loose.set].min; c.loose.slow = KINDS[c.loose.set].slow; }

  function makeBody(setName, index, vx, vz, spread) {
    const set = city.props.sets[setName], K = KINDS[setName];
    if (!set || !set.all || !K) return null;
    const o = index * 16, all = set.all;
    // one copy of the thing as its own mesh (the same shape and material as in the street)
    const mesh = new THREE.InstancedMesh(set.geometry, set.material, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    if (set.useColor && set.allColors) mesh.setColorAt(0, new THREE.Color(set.allColors[index * 3], set.allColors[index * 3 + 1], set.allColors[index * 3 + 2]));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.name = 'loose_' + setName;
    scene.add(mesh);
    // where it stood, and how it was turned
    const mat = new THREE.Matrix4().fromArray(all, o);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    mat.decompose(pos, quat, scl);
    const h = K.half, m = K.mass;
    const B = {
      set, index, K, mesh, scale: scl.x,
      c: new THREE.Vector3(pos.x, pos.y + h[1], pos.z),            // the middle of its box
      q: quat.clone(),
      v: new THREE.Vector3(vx, 0, vz),
      w: new THREE.Vector3(),
      // how hard it is to spin round each of its own axes (a box): small = spins easily
      inv: new THREE.Vector3(3 / (m * (h[1] * h[1] + h[2] * h[2])), 3 / (m * (h[0] * h[0] + h[2] * h[2])), 3 / (m * (h[0] * h[0] + h[1] * h[1]))),
      rest: 0, asleep: false, age: 0, home: pos.clone(),
    };
    // thrown up and a little to the side, and spinning: the car hit it low
    const sp = Math.hypot(vx, vz);
    // (a light thing leaves faster than the car came, a heavy one slower - never faster than 11 m/s)
    const out = Math.min(11, sp * (K.mass < 20 ? 0.85 : 0.6)) / (sp || 1);
    B.v.multiplyScalar(out).add(_v.set((Math.random() - 0.5) * spread, 1.4 + sp * 0.14 + Math.random() * 0.9, (Math.random() - 0.5) * spread));
    // (it tips away from the car: the spin axis lies across the push)
    const k = Math.min(7, 2 + sp * 0.4);
    B.w.set(vz / (sp || 1) * k, (Math.random() - 0.5) * 4, -vx / (sp || 1) * k);
    place(B);
    return B;
  }
  function place(B) {
    // the mesh's own origin is at the thing's foot: the middle of the box minus half its height along its own up
    _v.set(0, -B.K.half[1], 0).applyQuaternion(B.q);
    B.mesh.position.copy(B.c).add(_v);
    B.mesh.quaternion.copy(B.q);
    B.mesh.scale.setScalar(B.scale);
  }
  // the world's "1 / inertia" times a vector (the body's own numbers, turned into the world)
  function invInertia(B, vec, out) {
    _q.copy(B.q).invert();
    out.copy(vec).applyQuaternion(_q);
    out.set(out.x * B.inv.x, out.y * B.inv.y, out.z * B.inv.z);
    return out.applyQuaternion(B.q);
  }

  function stepBody(B, dt) {
    const K = B.K, h = K.half, m = K.mass;
    B.v.y -= G * dt;
    B.c.addScaledVector(B.v, dt);
    // turn by the spin
    const wl = B.w.length();
    if (wl > 1e-5) { _q.setFromAxisAngle(_v.copy(B.w).multiplyScalar(1 / wl), wl * dt); B.q.premultiply(_q).normalize(); }
    // the corners against the ground: the deepest one first, up to three in one step
    let touching = false;
    for (let it = 0; it < 3; it++) {
      let deep = 0, hit = null;
      for (let i = 0; i < 8; i++) {
        _r.set(i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]).applyQuaternion(B.q);
        const d = ground(B.c.x + _r.x, B.c.z + _r.z) - (B.c.y + _r.y);
        if (d > deep) { deep = d; hit = hit || new THREE.Vector3(); hit.copy(_r); }
      }
      if (!hit) break;
      touching = true;
      B.c.y += deep * 0.8;
      // the speed of that corner
      _v.copy(B.w).cross(hit).add(B.v);
      const vn = _v.y;
      if (vn < 0) {
        // the push up at the corner: stops it, gives a little back
        _a.copy(hit).cross(_n);                                   // r x n
        invInertia(B, _a, _b).cross(hit);                         // (Iinv (r x n)) x r
        const kN = 1 / m + _b.y;
        const e = -vn > 1.2 ? K.bounce : 0;                       // (slow touches do not bounce: it comes to rest)
        const j = (-(1 + e) * vn) / kN;
        B.v.y += j / m;
        B.w.add(invInertia(B, _a.copy(hit).cross(_v.set(0, j, 0)), _b));
        // friction: against the sliding of the corner along the ground
        _v.copy(B.w).cross(hit).add(B.v); _v.y = 0;
        const tl = _v.length();
        if (tl > 1e-4) {
          _v.multiplyScalar(1 / tl);
          _a.copy(hit).cross(_v);
          const kT = 1 / m + invInertia(B, _a, _b).cross(hit).dot(_v);
          const jt = Math.min(0.62 * j, tl / kT);
          B.v.addScaledVector(_v, -jt / m);
          B.w.sub(invInertia(B, _a.copy(hit).cross(_v.multiplyScalar(jt)), _b));
        }
      }
    }
    // walls: a house in the way throws it back
    const cell = city.colliders.near(B.c.x, B.c.z);
    for (const b of cell.boxes) {
      if (b.h < 0.9) continue;
      const R = 0.25;
      if (B.c.x < b.minX - R || B.c.x > b.maxX + R || B.c.z < b.minZ - R || B.c.z > b.maxZ + R) continue;
      const l = B.c.x - (b.minX - R), r = b.maxX + R - B.c.x, n = B.c.z - (b.minZ - R), f = b.maxZ + R - B.c.z, mn = Math.min(l, r, n, f);
      if (mn === l) { B.c.x = b.minX - R; if (B.v.x > 0) B.v.x *= -0.35; } else if (mn === r) { B.c.x = b.maxX + R; if (B.v.x < 0) B.v.x *= -0.35; }
      else if (mn === n) { B.c.z = b.minZ - R; if (B.v.z > 0) B.v.z *= -0.35; } else { B.c.z = b.maxZ + R; if (B.v.z < 0) B.v.z *= -0.35; }
      B.w.multiplyScalar(0.6);
    }
    // air and rolling take the energy away. Once it is slow on the ground it settles quickly (a real bin does
    // not rock on its corners for ever)
    const slow = touching && B.v.lengthSq() < 2.2 && B.w.lengthSq() < 9;
    const damp = touching ? (slow ? 7 : 3.2) : 0.25, drag = touching ? (slow ? 5 : 2.2) : 0.05;
    B.w.multiplyScalar(Math.exp(-damp * dt));
    B.v.x *= Math.exp(-drag * dt); B.v.z *= Math.exp(-drag * dt);
    // at rest? (also: nothing lies awake for more than eight seconds)
    if (touching && B.v.lengthSq() < 0.3 && B.w.lengthSq() < 1.2) { B.rest += dt; if (B.rest > 0.35) B.asleep = true; }
    else B.rest = 0;
    if (B.age > 8 && touching) B.asleep = true;
    if (B.asleep) { B.v.set(0, 0, 0); B.w.set(0, 0, 0); }
    place(B);
  }

  // a jet of water where a hydrant stood: a tall soft cone and a flat ring of spray on the ground
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
  const jetGeo = new THREE.CylinderGeometry(0.42, 0.07, 1, 10, 1, true), ringGeo = new THREE.RingGeometry(0.2, 1.5, 16);
  function makeJet(x, y, z) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(jetGeo, jetMat), b = new THREE.Mesh(jetGeo, jetMat), ring = new THREE.Mesh(ringGeo, jetMat);
    b.scale.set(0.5, 1, 0.5); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    g.add(a, b, ring);
    g.position.set(x, y, z);
    g.renderOrder = 15;
    scene.add(g);
    jets.push({ g, a, b, ring, t: 0, life: 26 });
  }

  // take the collider's things out of the street and throw them
  function knock(c, vx, vz) {
    if (!c.loose || !KINDS[c.loose.set]) return 0;
    c.gone = true;
    pending.push(c);
    out.add(c);
    const K = KINDS[c.loose.set];
    let n = 0;
    for (const index of c.loose.list) {
      const set = city.props.sets[c.loose.set];
      if (!set) continue;
      // (room for one more: the oldest sleeping one is put back out of the way)
      if (bodies.length >= MAX_BODIES) { const old = bodies.find((b) => b.asleep) || bodies[0]; restore(old, true); }
      set.hide(index, true);
      const B = makeBody(c.loose.set, index, vx, vz, c.loose.list.length > 1 ? 3 : 1.2);
      if (B) { B.collider = n === 0 ? c : null; B.owner = c; bodies.push(B); n++; }
    }
    city.props.recull();
    if (sound) {
      const sp = Math.hypot(vx, vz);
      if (sound.crash) sound.crash(K.sound === 'heavy' ? 'heavy' : 'light', Math.min(1, 0.35 + sp / 30));
    }
    if (K.water) { const set = city.props.sets[c.loose.set], o = c.loose.list[0] * 16; makeJet(set.all[o + 12], set.all[o + 13], set.all[o + 14]); }
    return n;
  }

  // put a thing back where it stood (keepGone: only take its loose body away - the place stays empty for now)
  function restore(B, keepGone) {
    const i = bodies.indexOf(B);
    if (i >= 0) bodies.splice(i, 1);
    scene.remove(B.mesh);
    B.mesh.dispose();
    if (keepGone) { B.owner.loose.left = (B.owner.loose.left || []).concat([B.index]); return; }
    B.set.hide(B.index, false);
    backIfWhole(B.owner);
  }
  // the collider comes back when none of its things is lying around any more
  function backIfWhole(c) {
    if (bodies.some((b) => b.owner === c)) return;
    for (const index of c.loose.left || []) city.props.sets[c.loose.set].hide(index, false);
    c.loose.left = null;
    if (c.gone) { c.gone = false; if (!pending.includes(c)) city.colliders.addCircle(c); else pending.splice(pending.indexOf(c), 1); }
    out.delete(c);
    city.props.recull();
  }

  return {
    knock,
    // a hit that is not a car (a bat, a shot): every loose thing within r of (x, z) is thrown along (dx, dz)
    push(x, z, r, dx, dz, power = 6) {
      let n = 0;
      const cell = city.colliders.near(x, z);
      for (const c of cell.circles.slice()) {
        if (!c.loose || c.gone || !KINDS[c.loose.set]) continue;
        if (Math.hypot(c.x - x, c.z - z) > r + c.r) continue;
        n += knock(c, dx * power, dz * power);
      }
      // things already lying there get a shove
      for (const B of bodies) if (Math.hypot(B.c.x - x, B.c.z - z) < r + 0.5) { B.asleep = false; B.rest = 0; B.v.x += dx * power * 0.7; B.v.z += dz * power * 0.7; B.v.y += 2; B.w.set(dz * 5, 2, -dx * 5); n++; }
      return n;
    },
    update(dt, px, pz) {
      // (colliders knocked this frame leave the grid now, not while a car was reading it)
      while (pending.length) city.colliders.removeCircle(pending.pop());
      const step = Math.min(dt, 1 / 30);
      for (let i = bodies.length - 1; i >= 0; i--) {
        const B = bodies[i];
        B.age += dt;
        if (!B.asleep) { stepBody(B, step); if (B.c.y < -30) { restore(B, false); continue; } }
        // far behind the player and still: the city puts it back
        const d2 = (B.c.x - px) ** 2 + (B.c.z - pz) ** 2, h2 = (B.home.x - px) ** 2 + (B.home.z - pz) ** 2;
        if (B.asleep && B.age > 12 && d2 > 85 * 85 && h2 > 85 * 85) restore(B, false);
      }
      // (a place whose loose body had to make room for a newer one: it is filled again once the player is far away)
      for (const c of out) if ((c.x - px) ** 2 + (c.z - pz) ** 2 > 85 * 85 && !bodies.some((b) => b.owner === c)) { backIfWhole(c); break; }
      for (let i = jets.length - 1; i >= 0; i--) {
        const J = jets[i];
        J.t += dt;
        const k = Math.min(1, J.t / 0.5) * Math.min(1, (J.life - J.t) / 3);          // comes up fast, dies slowly
        const hgt = (4.2 + Math.sin(J.t * 9) * 0.35 + Math.sin(J.t * 23) * 0.15) * k;
        J.a.scale.set(1, Math.max(0.01, hgt), 1); J.a.position.y = hgt / 2;
        J.b.scale.set(0.5, Math.max(0.01, hgt * 1.25), 0.5); J.b.position.y = hgt * 0.625;
        J.ring.scale.setScalar(0.6 + 0.5 * k + Math.sin(J.t * 6) * 0.05);
        if (J.t >= J.life) { scene.remove(J.g); jets.splice(i, 1); }
      }
    },
    // everything back in its place (a new game, a story chapter starts)
    reset() {
      while (pending.length) city.colliders.removeCircle(pending.pop());
      for (const B of bodies.slice()) restore(B, false);
      for (const c of [...out]) backIfWhole(c);
      for (const J of jets) scene.remove(J.g);
      jets.length = 0;
    },
    get count() { return bodies.length; },
    get out() { return out.size; },
    get awake() { return bodies.filter((b) => !b.asleep).length; },
    bodies,
  };
}
