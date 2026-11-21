// ---------------------------------------------------------------------------
// missionManager.js - runs the missions from missions.js.
//
// It only knows the step types (goto, enterCar, driveTo, wait, timer,
// dialog). Everything about the story lives in the data file.
// Every frame main.js tells it where the player is; it answers with what the
// HUD should show: the objective text, the marker and the distance.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { MISSIONS } from './missions.js';
import { lin } from '../city/models.js';
import { DEG } from '../utils/math.js';

export function createMissions({ scene, city, vehicles, hud, sound }) {
  let mission = null;      // the running mission (data)
  let index = 0;           // which step
  let stepTime = 0;        // seconds in this step
  let line = 0;            // which dialog line
  let waited = 0;
  const cars = {};         // mission cars by name
  const state = { title: '', text: '', info: '', marker: null, active: false, completed: [] };

  // ---- the marker in the world: a thin beam of light you can see from far away ----
  const beamGeo = new THREE.CylinderGeometry(0.28, 0.28, 60, 10, 1, true);
  beamGeo.translate(0, 30, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.visible = false;
  beam.renderOrder = 19;
  scene.add(beam);

  const compassToAngle = (deg) => Math.atan2(-Math.sin(deg * DEG), Math.cos(deg * DEG));
  // a target is a place { x, z } or a mission car { car: 'name' }
  function place(target) {
    if (!target) return null;
    if (target.car) { const v = cars[target.car]; return v ? { x: v.x, z: v.z } : null; }
    return target;
  }

  function start(id) {
    const m = MISSIONS.find((q) => q.id === id) || MISSIONS[0];
    if (!m) return false;
    mission = m; index = 0; stepTime = 0; line = 0; waited = 0;
    for (const c of m.cars || []) {
      if (cars[c.name]) continue;
      // make room: a parked car that stands at this spot goes away
      for (const rec of city.parkedCars) {
        // (also the cars parked right in front of and behind it, so the player can drive off at once)
        if (!rec.taken && Math.hypot(rec.x - c.x, rec.z - c.z) < 30 && Math.abs(rec.x - c.x) < 3) {
          rec.taken = true;
          city.props.sets[rec.kind].all.fill(0, rec.index * 16, rec.index * 16 + 16);
          city.props.sets.carShadow.all.fill(0, rec.shadow * 16, rec.shadow * 16 + 16);
          for (const q of rec.circles) q.x = 1e7;
        }
      }
      cars[c.name] = vehicles.spawn(c.kind, c.x, c.z, compassToAngle(c.facing), lin(c.color));
    }
    city.props.recull();
    state.active = true;
    enterStep();
    return true;
  }

  function enterStep() {
    stepTime = 0; waited = 0; line = 0;
    const step = mission.steps[index];
    if (step.type === 'dialog') hud.showDialog(step.name, step.lines[0]);
  }
  function next() {
    hud.hideDialog();
    index++;
    if (index >= mission.steps.length) {
      // finished
      hud.toast(mission.done || 'MISSION COMPLETE', 4000);
      sound.chime();
      state.completed.push(mission.id);
      mission = null; state.active = false; state.marker = null; beam.visible = false;
      return;
    }
    sound.chime();
    enterStep();
  }
  // a tap on the dialog box: next line, or the next step after the last line
  function advanceDialog() {
    if (!mission) return;
    const step = mission.steps[index];
    if (step.type !== 'dialog') return;
    line++;
    if (line < step.lines.length) hud.showDialog(step.name, step.lines[line]);
    else next();
  }

  // who: { x, z, inCar (bool), car (the vehicle or null), speed (m/s) }
  function update(dt, who) {
    if (!mission) { state.marker = null; beam.visible = false; return state; }
    const step = mission.steps[index];
    stepTime += dt;
    let marker = null, info = '';
    const reached = (target, radius) => {
      const p = place(target);
      if (!p) return false;
      marker = p;
      return Math.hypot(p.x - who.x, p.z - who.z) < (radius || 6);
    };
    if (step.type === 'goto') { if (reached(step.target, step.radius)) next(); }
    else if (step.type === 'enterCar') {
      marker = step.car ? place({ car: step.car }) : null;
      if (who.inCar && (!step.car || who.car === cars[step.car])) next();
    } else if (step.type === 'driveTo') {
      const there = reached(step.target, step.radius);
      if (!who.inCar) info = 'GET BACK IN THE CAR';
      else if (there) next();
    } else if (step.type === 'wait') {
      // in a car the clock only runs while the car stands still
      if (!who.inCar || who.speed < 1) waited += dt;
      info = `${Math.max(0, step.seconds - waited).toFixed(0)} S`;
      if (waited >= step.seconds) next();
    } else if (step.type === 'timer') {
      const left = step.seconds - stepTime;
      info = `TIME ${Math.max(0, left).toFixed(0)} S`;
      if (reached(step.target, step.radius)) next();
      else if (left <= 0) { hud.toast('TOO LATE - TRY AGAIN', 2500); index = step.failTo || 0; enterStep(); }
    }
    if (!mission) return state;
    const now = mission.steps[index];
    state.title = mission.title;
    state.text = now.type === 'dialog' ? 'Listen' : now.text || '';
    state.marker = now === step ? marker : null;
    if (state.marker && !info) info = '';
    state.info = info;
    beam.visible = !!state.marker;
    if (state.marker) beam.position.set(state.marker.x, city.groundHeight(state.marker.x, state.marker.z), state.marker.z);
    return state;
  }

  return { start, update, advanceDialog, state, cars, get running() { return !!mission; }, get step() { return index; } };
}
