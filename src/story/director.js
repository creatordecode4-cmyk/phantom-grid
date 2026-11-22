// ---------------------------------------------------------------------------
// director.js - the camera of the film scenes.
//
// A "shot" says where the camera is, where it looks, and how both change
// while the shot runs:
//   { seconds, from, to, look, lookTo, fov, fovTo, ease, shake, roll, near }
// from / to / look / lookTo are "places" (see engine.js: a fixed point, a
// point next to a car or a person ...). They are worked out again every
// frame, so the camera can follow something that moves.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const TALL_MAX = 86;      // the widest view up-down on an upright screen (degrees)
const TALL_PART = 0.86;   // how much of the middle square of a shot must fit across an upright screen

export function createDirector(camera, resolve) {
  let shot = null, t = 0, baseFov = 50, baseNear = 0.2;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3();
  const ease = (k, kind) => (kind === 'linear' ? k : kind === 'out' ? 1 - (1 - k) * (1 - k) : k * k * (3 - 2 * k));
  const set = (v, p) => v.set(p[0], p[1], p[2]);

  function play(s, fovNow) {
    if (!shot) { baseFov = fovNow || camera.fov; baseNear = camera.near; }
    shot = s; t = 0;
    apply(0);
  }
  function stop() {
    if (!shot) return;
    shot = null;
    camera.fov = baseFov; camera.near = baseNear; camera.updateProjectionMatrix();
  }
  function apply(dt) {
    if (!shot) return;
    t += dt;
    const k = ease(Math.min(1, t / Math.max(0.001, shot.seconds || 1)), shot.ease);
    set(a, resolve(shot.from));
    if (shot.to) { set(b, resolve(shot.to)); a.lerp(b, k); }
    set(la, resolve(shot.look));
    if (shot.lookTo) { set(lb, resolve(shot.lookTo)); la.lerp(lb, k); }
    if (shot.shake) { const s = shot.shake; a.x += (Math.random() - 0.5) * s; a.y += (Math.random() - 0.5) * s; a.z += (Math.random() - 0.5) * s; }
    camera.position.copy(a);
    camera.lookAt(la);
    if (shot.roll) camera.rotateZ(shot.roll);
    let fov = shot.fov ? shot.fov + ((shot.fovTo || shot.fov) - shot.fov) * k : baseFov;
    // A shot is designed for a wide picture. On an upright phone the same view would show only a thin slice of
    // it: faces fill the whole screen or are cut off. So there the view opens up until the middle SQUARE of the
    // designed picture (a little less: TALL_PART) fits across the screen again. The film bars of the page hide
    // what is above and below it.
    if (shot.fov && camera.aspect < 1) fov = Math.min(TALL_MAX, (2 * Math.atan((TALL_PART * Math.tan((fov * Math.PI) / 360)) / camera.aspect) * 180) / Math.PI);
    // (near: how close things may come to the lens before they are cut away - small inside a car)
    const near = shot.near || baseNear;
    if (Math.abs(camera.fov - fov) > 0.02 || camera.near !== near) { camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); }
  }
  return {
    play, stop, apply,
    get active() { return !!shot; },
    get time() { return t; },
    get done() { return !shot || t >= (shot.seconds || 0); },
    // the direction the camera looks at, flat on the ground (for the lighting)
    get position() { return camera.position; },
  };
}
