// ---------------------------------------------------------------------------
// touchControls.js - reads the player's input.
//
// PHONE:   left thumb  = virtual joystick (bottom-left) to move
//          right thumb = drag anywhere on the right half to turn the camera
//          RUN button  = tap to switch running on / off
// DESKTOP: W A S D or arrow keys to move, mouse to look (click the game to
//          lock the mouse, Esc to free it), hold Shift to run.
//
// The rest of the game only reads "controls.input".
// ---------------------------------------------------------------------------

import { CONFIG } from '../config.js';
import { clamp } from '../utils/math.js';

export function createControls(dom) {
  const C = CONFIG.camera;
  const input = {
    moveX: 0, moveY: 0,   // -1..1 (x: left/right, y: back/forward)
    run: false,
    lookX: 0, lookY: 0,   // how far the camera should turn this frame (radians)
  };

  // ------------------------------------------------------------------ joystick
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const JOY_RADIUS = 52; // pixels the knob can travel
  const base = dom.joyBase, knob = dom.joyKnob;

  function joyStart(e) {
    if (joy.id !== null) return;
    joy.id = e.pointerId;
    joy.ox = e.clientX; joy.oy = e.clientY;
    joy.x = 0; joy.y = 0;
    // the stick appears where the thumb touches the screen
    base.style.left = `${e.clientX}px`;
    base.style.top = `${e.clientY}px`;
    base.classList.add('active');
    knob.style.transform = 'translate(-50%, -50%)';
    dom.zoneMove.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function joyMove(e) {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) { dx *= JOY_RADIUS / len; dy *= JOY_RADIUS / len; }
    joy.x = dx / JOY_RADIUS;
    joy.y = -dy / JOY_RADIUS; // up on the screen = forward
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    e.preventDefault();
  }
  function joyEnd(e) {
    if (e.pointerId !== joy.id) return;
    joy.id = null;
    joy.x = 0; joy.y = 0;
    base.classList.remove('active');
    base.style.left = '';
    base.style.top = '';
    knob.style.transform = 'translate(-50%, -50%)';
  }
  dom.zoneMove.addEventListener('pointerdown', joyStart);
  dom.zoneMove.addEventListener('pointermove', joyMove);
  dom.zoneMove.addEventListener('pointerup', joyEnd);
  dom.zoneMove.addEventListener('pointercancel', joyEnd);

  // ------------------------------------------------------------- camera drag
  const lookPointers = new Map(); // pointer id -> last position
  let lookDX = 0, lookDY = 0;     // pixels dragged since the last frame
  function lookStart(e) {
    if (e.pointerType === 'mouse' && document.pointerLockElement) return;
    lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dom.zoneLook.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function lookMove(e) {
    const p = lookPointers.get(e.pointerId);
    if (!p) return;
    lookDX += e.clientX - p.x;
    lookDY += e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    e.preventDefault();
  }
  function lookEnd(e) { lookPointers.delete(e.pointerId); }
  dom.zoneLook.addEventListener('pointerdown', lookStart);
  dom.zoneLook.addEventListener('pointermove', lookMove);
  dom.zoneLook.addEventListener('pointerup', lookEnd);
  dom.zoneLook.addEventListener('pointercancel', lookEnd);

  // ----------------------------------------------------------------- run button
  let runToggle = false;
  dom.runButton.addEventListener('pointerdown', (e) => {
    runToggle = !runToggle;
    dom.runButton.classList.toggle('on', runToggle);
    e.preventDefault();
    e.stopPropagation();
  });

  // -------------------------------------------------------------------- keyboard
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ----------------------------------------------------------------------- mouse
  // On a desktop, clicking the game locks the mouse so you can look around freely.
  let mouseDX = 0, mouseDY = 0;
  const fineMouse = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (fineMouse && dom.zoneLook.requestPointerLock) {
    dom.zoneLook.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        const r = dom.zoneLook.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      }
    });
    dom.zoneMove.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        const r = dom.zoneLook.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { mouseDX += e.movementX; mouseDY += e.movementY; }
    });
  }

  // Called once per frame: turn the raw input into "input".
  function update() {
    let x = joy.x, y = joy.y;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    // small dead zone so a resting thumb does not make the player creep
    const len = Math.hypot(x, y);
    if (len < 0.12) { x = 0; y = 0; }
    else if (len > 1) { x /= len; y /= len; }
    input.moveX = clamp(x, -1, 1);
    input.moveY = clamp(y, -1, 1);
    input.run = runToggle || keys.has('ShiftLeft') || keys.has('ShiftRight');

    input.lookX = lookDX * C.touchSensitivity + mouseDX * C.mouseSensitivity;
    input.lookY = lookDY * C.touchSensitivity + mouseDY * C.mouseSensitivity;
    lookDX = lookDY = mouseDX = mouseDY = 0;
    return input;
  }

  return { input, update, keys };
}
