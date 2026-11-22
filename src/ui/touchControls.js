// ---------------------------------------------------------------------------
// touchControls.js - reads the player's input.
//
// PHONE:   left thumb  = virtual joystick (bottom-left) to move
//          right thumb = drag anywhere on the right half to turn the camera
//          RUN button  = tap to switch running on / off
// DESKTOP: W A S D or arrow keys to move, mouse to look (click the game to
//          lock the mouse, Esc to free it), hold Shift to run.
//
// DRIVING (phone): steering buttons or TILT, GAS and BRAKE are analog (slide the
//          finger up on the pedal for more), HANDBRAKE, HORN, NITRO, UP / DOWN (drone).
// DRIVING (keys):  W A S D, Space handbrake, H horn, N nitro, C camera, L lights,
//          U / J drone up / down, Q (hold) the quiet motor of a boat.
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
    action: false,        // true for one frame when E was pressed (get into / out of a car)
    map: false,           // true for one frame when M was pressed
    // driving: steer -1 (left) .. 1 (right), gas / brake 0..1
    //          nitro: boost (supercar), up / down: the drone
    drive: { steer: 0, gas: 0, brake: 0, handbrake: false, horn: false, nitro: false, up: false, down: false, quiet: false },
    camera: false,        // true for one frame: next camera view
    lights: false,        // true for one frame: high beam on / off
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
    try { dom.zoneMove.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
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
    try { dom.zoneLook.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
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

  // ------------------------------------------------------- driving buttons (phone)
  // a button is "down" while at least one finger is on it
  const held = { left: false, right: false, gas: false, brake: false, hand: false, horn: false, nitro: false, up: false, down: false, quiet: false };
  // GAS and BRAKE are analog: a finger low on the pedal presses it a little, sliding up presses it fully
  const pedal = { gas: 1, brake: 1 };
  const pedalAmount = (node, e) => { const r = node.getBoundingClientRect(); return clamp(0.4 + (0.9 * (r.bottom - e.clientY)) / Math.max(r.height, 1), 0.35, 1); };
  if (dom.drive) {
    for (const name of Object.keys(held)) {
      const node = dom.drive[name];
      if (!node) continue;
      const set = (v) => (e) => { held[name] = v; node.classList.toggle('on', v); e.preventDefault(); e.stopPropagation(); };
      node.addEventListener('pointerdown', (e) => { try { node.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } if (name in pedal) pedal[name] = pedalAmount(node, e); set(true)(e); });
      if (name in pedal) node.addEventListener('pointermove', (e) => { if (held[name]) { pedal[name] = pedalAmount(node, e); node.style.setProperty('--press', pedal[name].toFixed(2)); } });
      node.addEventListener('pointerup', set(false));
      node.addEventListener('pointercancel', set(false));
      node.addEventListener('lostpointercapture', () => { held[name] = false; node.classList.remove('on'); });
    }
  }
  // ---- TILT: steer by tilting the phone like a steering wheel ----
  let tiltOn = false, tiltSteer = 0;
  function onTilt(e) {
    if (e.beta === null || e.gamma === null) return;
    // which way is the screen turned? (0 = upright, 90 / -90 = on its side)
    const a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    const lean = a === 90 ? e.beta : a === 270 || a === -90 ? -e.beta : e.gamma;
    tiltSteer = clamp(lean / 28, -1, 1);
  }
  let onTiltChange = null;   // main.js: remember the choice in the settings
  // switch tilt steering on or off (must be called from a tap: iPhones ask for permission)
  function setTilt(on) {
    const mark = (v) => { if (dom.drive && dom.drive.tilt) dom.drive.tilt.classList.toggle('on', v); };
    if (!on) { if (tiltOn) window.removeEventListener('deviceorientation', onTilt); tiltOn = false; tiltSteer = 0; mark(false); return; }
    if (tiltOn) return;
    const turnOn = () => { tiltOn = true; window.addEventListener('deviceorientation', onTilt); mark(true); };
    // iPhones ask the user for permission first
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().then((r) => { if (r === 'granted') turnOn(); }).catch(() => {});
    else if (D) turnOn();
  }
  if (dom.drive && dom.drive.tilt) {
    dom.drive.tilt.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const want = !tiltOn;
      setTilt(want);
      if (onTiltChange) onTiltChange(want);
    });
  }

  // -------------------------------------------------------------------- keyboard
  const keys = new Set();
  let actionPressed = false, mapPressed = false, camPressed = false, lightPressed = false;
  let steerKey = 0; // keyboard steering moves smoothly, like a hand on a wheel
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) actionPressed = true;
    if (e.code === 'KeyM' && !e.repeat) mapPressed = true;
    if (e.code === 'KeyC' && !e.repeat) camPressed = true;
    if (e.code === 'KeyL' && !e.repeat) lightPressed = true;
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

    input.action = actionPressed; actionPressed = false;
    input.map = mapPressed; mapPressed = false;
    input.camera = camPressed; camPressed = false;
    input.lights = lightPressed; lightPressed = false;
    // ---- driving: keys and buttons together ----
    const d = input.drive;
    const kl = keys.has('KeyA') || keys.has('ArrowLeft') || held.left, kr = keys.has('KeyD') || keys.has('ArrowRight') || held.right;
    // (the steering itself is smoothed in physics.js: the wheel never jumps)
    d.steer = tiltOn ? tiltSteer : (kr ? 1 : 0) - (kl ? 1 : 0);
    d.gas = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : held.gas ? pedal.gas : 0;
    d.brake = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : held.brake ? pedal.brake : 0;
    d.nitro = keys.has('KeyN') || held.nitro;
    d.up = keys.has('KeyU') || held.up;
    d.down = keys.has('KeyJ') || held.down;
    d.quiet = keys.has('KeyQ') || held.quiet;          // the boat's quiet motor (hold)
    d.handbrake = keys.has('Space') || held.hand;
    d.horn = keys.has('KeyH') || held.horn;
    return input;
  }

  return { input, update, keys, setTilt, get tilt() { return tiltOn; }, set onTiltChange(fn) { onTiltChange = fn; } };
}
