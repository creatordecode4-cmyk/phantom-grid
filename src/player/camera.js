// ---------------------------------------------------------------------------
// camera.js - third-person camera that looks over the player's right shoulder.
//
//   * drag (touch) or move the mouse to turn it
//   * it follows the player smoothly
//   * it never goes through buildings: if a wall is in the way, the camera
//     moves closer to the player
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, angleDelta } from '../utils/math.js';

export function createCameraRig(camera, city) {
  const C = CONFIG.camera;
  // yaw: compass-like angle of the view direction (0 = looking north, +z)
  // pitch: positive = looking down
  let yaw = 0;
  let pitch = C.startPitch;
  let dist = C.distance;        // current distance behind the player
  let shoulder = C.shoulder;    // current sideways offset
  let idle = 10;                // seconds since the player last turned the camera
  const pivot = new THREE.Vector3();
  const look = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let first = true;

  // How far can we go from (ox,oy,oz) along (dx,dy,dz) before hitting a box?
  // Boxes are made a bit bigger, so the camera keeps a small distance to walls.
  function castRay(ox, oy, oz, dx, dy, dz, maxDist) {
    const pad = C.collisionRadius;
    let best = maxDist;
    const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
    // look in the grid cells at the start, the middle and the end of the ray
    const seen = new Set();
    for (const t of [0, 0.5, 1]) {
      const cell = city.colliders.near(ox + (ex - ox) * t, oz + (ez - oz) * t);
      for (const b of cell.boxes) {
        if (seen.has(b)) continue;
        seen.add(b);
        // "slab" test against the padded box (x, z and height)
        let t0 = 0, t1 = best;
        const lo = [b.minX - pad, -100, b.minZ - pad], hi = [b.maxX + pad, b.h + pad, b.maxZ + pad];
        const o = [ox, oy, oz], d = [dx, dy, dz];
        let miss = false;
        for (let a = 0; a < 3; a++) {
          if (Math.abs(d[a]) < 1e-7) {
            if (o[a] < lo[a] || o[a] > hi[a]) { miss = true; break; }
          } else {
            let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
            if (ta > tb) { const s = ta; ta = tb; tb = s; }
            t0 = Math.max(t0, ta);
            t1 = Math.min(t1, tb);
            if (t0 > t1) { miss = true; break; }
          }
        }
        if (!miss && t0 < best) best = t0;
      }
    }
    return best;
  }

  // Turn the camera. dx, dy are already in radians.
  function rotate(dx, dy) {
    if (dx === 0 && dy === 0) return;
    yaw -= dx;
    pitch = clamp(pitch + dy, C.minPitch, C.maxPitch);
    idle = 0;
  }

  function update(dt, player) {
    idle += dt;
    // when the player walks and does not touch the camera for a moment,
    // the camera slowly swings behind the walking direction
    if (idle > 1.4 && player.speed > 0.6) {
      const d = angleDelta(yaw, player.heading);
      if (Math.abs(d) < 2.3) yaw += d * (1 - Math.exp(-0.9 * dt));
    }

    // the point the camera turns around: the player's shoulders (follows smoothly)
    const tx = player.position.x, ty = player.position.y + C.pivotHeight, tz = player.position.z;
    if (first) { pivot.set(tx, ty, tz); first = false; }
    pivot.x = damp(pivot.x, tx, 22, dt);
    pivot.y = damp(pivot.y, ty, 12, dt);
    pivot.z = damp(pivot.z, tz, 22, dt);

    // view direction and "right" direction
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    dir.set(Math.sin(yaw) * cp, -sp, Math.cos(yaw) * cp);
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);

    // 1. shoulder offset: step to the right, unless a wall is there
    const sideFree = castRay(pivot.x, pivot.y, pivot.z, rx, 0, rz, C.shoulder + 0.05);
    const wantSide = Math.max(0, Math.min(C.shoulder, sideFree - 0.05));
    shoulder = wantSide < shoulder ? wantSide : damp(shoulder, wantSide, 5, dt);
    const sx = pivot.x + rx * shoulder, sz = pivot.z + rz * shoulder;

    // 2. pull back from the shoulder point, stop before any wall
    const free = castRay(sx, pivot.y, sz, -dir.x, -dir.y, -dir.z, C.distance);
    const want = Math.max(0.45, free);
    dist = want < dist ? want : damp(dist, want, 4, dt); // go in at once, come out slowly

    let cx = sx - dir.x * dist, cy = pivot.y - dir.y * dist, cz = sz - dir.z * dist;
    // never below the ground
    cy = Math.max(cy, city.groundHeight(cx, cz) + 0.28);
    camera.position.set(cx, cy, cz);
    look.set(sx + dir.x * 12, pivot.y + dir.y * 12, sz + dir.z * 12);
    camera.lookAt(look);
  }

  // ---- CHASE CAMERA (driving): behind the car, further back the faster it goes ----
  // Dragging looks around the car; a moment later the camera swings back behind it.
  let lookAround = 0;      // extra angle from dragging
  let chaseDist = 6.5;
  let chaseFirst = true;
  function updateChase(dt, car, shake = 0) {
    idle += dt;
    const speed = Math.hypot(car.vx, car.vz);
    // "yaw" was changed by rotate(): keep it as an offset to the car's direction
    if (chaseFirst) { lookAround = 0; chaseFirst = false; chaseDist = 6.5; pivot.set(car.x, car.y + 1.25, car.z); }
    else lookAround = angleDelta(car.heading, yaw);
    if (idle > 1.1) lookAround *= Math.exp(-3.2 * dt);
    // when reversing for a while the camera stays behind the car (no flipping)
    yaw = car.heading + lookAround;
    pitch = idle > 1.1 ? damp(pitch, 0.2, 2.5, dt) : clamp(pitch, -0.1, 0.9);

    pivot.x = damp(pivot.x, car.x, 14, dt);
    pivot.y = damp(pivot.y, car.y + 1.25, 8, dt);
    pivot.z = damp(pivot.z, car.z, 14, dt);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    dir.set(Math.sin(yaw) * cp, -sp, Math.cos(yaw) * cp);
    const wantDist = 6.3 + Math.min(4.8, speed * 0.085);
    const free = castRay(pivot.x, pivot.y, pivot.z, -dir.x, -dir.y, -dir.z, wantDist);
    const want = Math.max(1.6, free);
    chaseDist = want < chaseDist ? want : damp(chaseDist, want, 3, dt);
    let cx = pivot.x - dir.x * chaseDist, cy = pivot.y - dir.y * chaseDist + 0.55, cz = pivot.z - dir.z * chaseDist;
    // a crash shakes the camera for a moment
    if (shake > 0.001) { cx += (Math.random() - 0.5) * shake * 0.5; cy += (Math.random() - 0.5) * shake * 0.4; cz += (Math.random() - 0.5) * shake * 0.5; }
    cy = Math.max(cy, city.groundHeight(cx, cz) + 0.5);
    camera.position.set(cx, cy, cz);
    look.set(pivot.x + dir.x * 6, pivot.y + 0.2 + dir.y * 6, pivot.z + dir.z * 6);
    camera.lookAt(look);
  }

  return {
    update,
    updateChase,
    // call when the player gets into / out of a car
    startChase() { chaseFirst = true; idle = 10; },
    endChase() { first = true; idle = 10; pitch = C.startPitch; },
    rotate,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    // direction the camera looks at, flat on the ground (x, z)
    forwardXZ(out) { return out.set(Math.sin(yaw), 0, Math.cos(yaw)); },
    set(yawRad, pitchRad) { yaw = yawRad; pitch = clamp(pitchRad, C.minPitch, C.maxPitch); first = true; idle = 10; },
  };
}
