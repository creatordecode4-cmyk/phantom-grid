// ---------------------------------------------------------------------------
// engine.js - THE STORY ENGINE.
//
// It reads a chapter file (src/story/chapters/*.js - only data) and makes it
// happen: it puts cars, people and things into the city, shows the film
// scenes, the talking and the choices, checks the objectives and saves the
// game. A NEW CHAPTER NEEDS NO NEW CODE: only a new data file with the name
// chapter02.js, chapter03.js ... in that folder. The engine finds it by itself.
//
// HOW A CHAPTER IS WRITTEN
//   A chapter has missions. A mission has "setup" (what is in the world) and
//   "steps" (what happens, one after the other). Every step is { do: 'name', ... }.
//
//   PLACES
//     [x, z]                      on the ground
//     [x, y, z]                   a point in the air or on a floor
//     { of: 'id', p: [l, u, f] }  next to a car, a person or 'player': l meters to its left, u up, f in front
//     { cabin: 'car', at, p }     inside a car. at: eye | pass | mid | dash | wheel | seat | passSeat
//     { garage: [r, u, f] }       in Mace's garage (r to its right, u up, f toward the street)
//     { flat: [r, u, f] }         in Nate's flat above it (u = above the flat's floor)
//     { roof: [x, z], up }        on the roof of the building at x, z
//   DIRECTIONS ("face") are compass degrees: 0 north, 90 east, 180 south, 270 west.
//   SPEEDS are km/h.
//
//   STEPS THAT WAIT FOR THE PLAYER (each has "text" = the objective, a marker and a GPS route)
//     goto, driveTo, timer, enter, leave, talk, collect, follow, chase, evade, waitFor, limiter
//   STEPS THAT SHOW SOMETHING
//     cutscene, card, lines, choice, read, fade, wait, end
//   STEPS THAT CHANGE THE WORLD AT ONCE
//     time, world, clear, spawn, actor, prop, remove, player, allow, vehicleSet, actorSet, drive, music,
//     sound, say, tip, flag, light, wanted, mirror, cam, quiet, cine, fire, checkpoint, chapter
//   STEPS THAT HOLD OTHER STEPS
//     if (cond, then, else), seq (steps in order), meanwhile (steps in order, beside the main story)
//
//   Any step can carry  if: { condition }  and is skipped when the condition is not true.
//   CONDITIONS: { zone: { x: [from, to], z: [from, to] } }, { near: place, radius }, { flag, is }, { time },
//     { event }, { inCar }, { speedOver }, { speedUnder }, { limited: seconds }, { carNear | carFar: id, radius },
//     { damageOver: 0..1 }, { all: [...] }, { any: [...] }, { not: {...} }
//   RULES ("on" lists of a mission or of a step): a condition plus what happens when it comes true:
//     { ...condition, hold: seconds it must stay true, do: [steps], fail: 'text key', repeat }
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from './strings.js';
import { makePath, pointOn } from './drivers.js';
import { compassToAngle } from './actors.js';
import { GARAGE } from '../city/heroBuildings.js';
import { lin } from '../city/models.js';

const KMH = 3.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the file of chapter number n: 0 = prologue.js, 1 = chapter01.js, 2 = chapter02.js ...
export const chapterFile = (n) => (n === 0 ? 'prologue' : 'chapter' + String(n).padStart(2, '0'));

export function createStory(G) {
  const { scene, camera, city, layout, vehicles, player, actors, drivers, director, props, ui, music, sound, save, police, lighting, weather, hud, rig, carLib } = G;
  const angle = compassToAngle;
  const _v = new THREE.Vector3(), P = {};

  // ------------------------------------------------------------------ state
  let active = false, loading = false, failed = false;
  let gen = 0;                        // goes up whenever the story is stopped or restarted: old steps notice and give up
  let chapter = null, mission = null, mi = 0, cpIndex = 0, runner = null;
  let flags = {}, paths = {}, rules = [];
  const cars = new Map();             // story vehicles by name
  const things = new Map();           // story props by name: { holder, inner, fly }
  const enterable = new Set();        // names of the vehicles the player may get into
  const met = new Set();              // characters the player has met (saved as "unlocked")
  const events = new Set();           // things that happened and that a step may wait for ('crash', 'tape:7' ...)
  const bg = [];                      // steps that run beside the main story
  let cine = false, modal = 0, choosing = false, quietOn = false;
  let allowDrive = true, allowMove = true;
  let light = null, mirrorOn = false, tapeShown = false, indoors = false, fovWant = 0, fovNow = 0;
  let fadeColor = 'black', fadeTouched = false, limitedFor = 0, clock = 0, frame = 0, held = false;
  const objective = { text: '', info: '' };
  let marker = null;
  // what main.js reads every frame
  const hudState = { active: false, title: '', text: '', info: '', marker: null };
  const markOut = { x: 0, y: 0, z: 0 }, lightOut = { pos: [0, 0, 0], color: 0xffffff, power: 0, range: 10 };
  const locks = { move: false, drive: false, look: false, action: false };

  // the marker in the world: a thin beam of light that can be seen from far away
  const beamGeo = new THREE.CylinderGeometry(0.28, 0.28, 60, 10, 1, true);
  beamGeo.translate(0, 30, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.visible = false; beam.renderOrder = 19;
  scene.add(beam);

  // ------------------------------------------------------------------ chapter files
  const files = new Map();
  // (a chapter that does not exist gives null: that is how the engine knows where the story ends for now)
  function loadChapter(id) {
    if (!files.has(id)) files.set(id, import(`./chapters/${id}.js`).then((m) => m.default).catch(() => null));
    return files.get(id);
  }

  // ------------------------------------------------------------------ places
  const H = layout.highway;
  // the raised highway is not part of the city's ground: cars on it drive in this "arena"
  const ARENAS = { highway: { minX: H.minX + 0.45, maxX: H.maxX - 0.45, minZ: H.rampBottomZ - 4, maxZ: 760, ground: (x, z) => H.heightAt(z) } };
  function groundAt(x, z) {
    const g = city.groundHeight(x, z);
    return x > H.minX && x < H.maxX && z > H.rampBottomZ ? Math.max(g, H.heightAt(z)) : g;
  }
  function roofAt(x, z) {
    let h = 0;
    for (const b of city.colliders.near(x, z).boxes) if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) h = Math.max(h, b.h);
    return h;
  }
  function car(id) {
    const v = cars.get(id);
    if (v && !vehicles.live.includes(v)) { cars.delete(id); return null; }   // (it drove away and was removed)
    return v || null;
  }
  // a point inside a car, in the car's own directions (+x = its left, +z = its nose)
  function cabinLocal(v, at, p = [0, 0, 0]) {
    const c = vehicles.cabin(v), s = c.seat;
    const b = at === 'eye' ? c.eye : at === 'pass' ? [-c.eye[0], c.eye[1], c.eye[2]] : at === 'mid' ? [0, c.eye[1], c.eye[2]] : at === 'dash' ? c.dash
      : at === 'wheel' ? c.wheel : at === 'passSeat' ? [-s.x, s.y, s.z] : [s.x, s.y, s.z];
    return [b[0] + p[0], b[1] + p[1], b[2] + p[2]];
  }
  // any "place" of the data -> [x, y, z] in the world
  function pt(a) {
    if (!a) return [0, 0, 0];
    if (Array.isArray(a)) return a.length === 2 ? [a[0], groundAt(a[0], a[1]), a[1]] : a;
    if (a.garage) return GARAGE.at(a.garage[0], GARAGE.curb + a.garage[1], a.garage[2]);
    if (a.flat) return GARAGE.at(a.flat[0], GARAGE.flat.floor + a.flat[1], a.flat[2]);
    if (a.roof) return [a.roof[0], roofAt(a.roof[0], a.roof[1]) + (a.up || 0), a.roof[1]];
    if (a.cabin) {
      const v = car(a.cabin);
      if (!v) return [0, 0, 0];
      v.tilt.updateWorldMatrix(true, false);
      _v.fromArray(cabinLocal(v, a.at, a.p)).applyMatrix4(v.tilt.matrixWorld);
      return [_v.x, _v.y, _v.z];
    }
    if (a.of !== undefined || a.player) {
      const p = a.p || a.player || [0, 0, 0];
      let x, y, z, h;
      const v = a.of && a.of !== 'player' ? car(a.of) : null, who = !v && a.of && a.of !== 'player' ? actors.get(a.of) : null;
      if (v) { x = v.x; y = v.y; z = v.z; h = v.heading; }
      else if (who) { x = who.x; y = who.y; z = who.z; h = who.heading; }
      else { x = player.position.x; y = player.position.y; z = player.position.z; h = player.heading; }
      const s = Math.sin(h), c = Math.cos(h);
      return [x + c * p[0] + s * p[2], y + p[1], z - s * p[0] + c * p[2]];
    }
    return [0, 0, 0];
  }
  // where a marker points: a place, { car }, { actor } or { prop }
  function markPoint(m) {
    if (m.car) { const v = car(m.car); return v ? [v.x, v.y, v.z] : null; }
    if (m.actor) { const a = actors.get(m.actor); return a ? [a.x, a.y, a.z] : null; }
    if (m.prop) { const o = things.get(m.prop); if (!o) return null; o.holder.getWorldPosition(_v); return [_v.x, _v.y, _v.z]; }
    return pt(m);
  }
  const distTo = (v) => Math.hypot(v.x - player.position.x, v.z - player.position.z);
  const inRange = (v, r) => !r || (v >= r[0] && v <= r[1]);

  // ------------------------------------------------------------------ conditions
  function test(c, time = 0) {
    if (!c) return true;
    if (c.all && !c.all.every((q) => test(q, time))) return false;
    if (c.any && !c.any.some((q) => test(q, time))) return false;
    if (c.not && test(c.not, time)) return false;
    const p = player.position;
    if (c.zone && !(inRange(p.x, c.zone.x) && inRange(p.z, c.zone.z))) return false;
    if (c.near) { const q = pt(c.near); if (Math.hypot(p.x - q[0], p.z - q[2]) > (c.radius || 6)) return false; }
    if (c.flag && !!flags[c.flag] !== (c.is === undefined ? true : !!c.is)) return false;
    if (c.time !== undefined && time < c.time) return false;
    if (c.event && !events.has(c.event)) return false;
    if (c.inCar !== undefined) {
      const driving = vehicles.state === 'driving';
      if (c.inCar === false ? vehicles.state !== 'none' : !(driving && (c.inCar === true || vehicles.active === car(c.inCar)))) return false;
    }
    if (c.speedOver !== undefined && !(vehicles.speedKmh > c.speedOver)) return false;
    if (c.speedUnder !== undefined && !(vehicles.speedKmh < c.speedUnder)) return false;
    if (c.limited !== undefined && limitedFor < c.limited) return false;
    if (c.carNear) { const v = car(c.carNear); if (!v || distTo(v) > (c.radius || 10)) return false; }
    if (c.carFar) { const v = car(c.carFar); if (v && distTo(v) < (c.radius || 60)) return false; }
    if (c.damageOver !== undefined) { const v = vehicles.active; if (!v || !(v.damage > c.damageOver)) return false; }
    return true;
  }
  // rules: conditions with something to do. Returns the text key of a rule that fails the mission (or null).
  const wrap = (list) => (list || []).map((x) => ({ x, fired: false, t: 0 }));
  function runRules(list, dt, time) {
    for (const q of list) {
      if (q.fired && !q.x.repeat) continue;
      const ok = test(q.x, time);
      q.t = ok ? q.t + dt : 0;
      if (!ok || q.t < (q.x.hold || 0)) continue;
      q.fired = true; q.t = 0;
      run(q.x.do);
      if (q.x.fail) return q.x.fail;
    }
    return null;
  }
  const fire = (name) => { if (name) events.add(name); };
  const took = (name) => (events.has(name) ? (events.delete(name), true) : false);

  // ------------------------------------------------------------------ running steps
  // A runner goes through a list of steps. A step that needs time returns { update(dt) -> true when done, end() }.
  const makeRunner = (steps, onDone = null) => ({ steps: steps || [], i: 0, cur: null, done: false, onDone });
  function tickRunner(R, dt) {
    const my = gen;
    for (let guard = 0; guard < 400 && !R.done; guard++) {
      if (!R.cur) {
        if (R.i >= R.steps.length) { R.done = true; if (R.onDone) R.onDone(); break; }
        const s = R.steps[R.i++];
        if (s.if && !test(s.if)) continue;
        const task = begin(s);
        if (my !== gen) return true;
        if (!task) continue;
        R.cur = task;
      }
      const finished = R.cur.update(dt);
      if (my !== gen) return true;
      if (!finished) return false;
      if (R.cur.end) R.cur.end();
      R.cur = null;
      dt = 0;                           // (the next steps start in the same frame, without time passing twice)
    }
    return R.done;
  }
  function begin(s) {
    const h = STEP[s.do];
    if (!h) { console.warn('[story] unknown step:', s.do, s); return null; }
    // a mistake in the data must not stop the game: the step is skipped
    try { return h(s) || null; } catch (e) { console.error('[story] step failed:', s, e); return null; }
  }
  // steps that happen "at once" (setup lists, rules, film scenes). One that needs time runs beside the story.
  function run(list) {
    if (!list) return;
    for (const s of list) {
      if (s.if && !test(s.if)) continue;
      const task = begin(s);
      if (task) bg.push(task);
    }
  }
  const timer = (seconds) => { let left = seconds; return { update(dt) { left -= dt; return left <= 0; } }; };

  // ------------------------------------------------------------------ faces
  // who: 'nate' (the player) or the id of an actor. mood: a name from FACES in src/characters/faceAnim.js
  // ('smile', 'sad', 'angry', 'afraid', 'tired' ...). A face keeps its mood until the story changes it.
  function setMood(who, mood, seconds = 0.45) {
    if (!who || !mood) return;
    if (who === 'nate' || who === 'player') player.mood = mood;
    else { const a = actors.get(who); if (a) actors.setMood(a, mood, seconds); }
  }
  // a line changes the face of its speaker (mood) and of the others in the scene (moods: { theo: 'sad', nate: 'tired' })
  function lineMoods(l) {
    if (l.mood) setMood(l.who === 'nate' ? 'nate' : l.actor || l.who, l.mood);
    if (l.moods) for (const id in l.moods) setMood(id, l.moods[id]);
  }

  // ------------------------------------------------------------------ speaking
  function quietTalk() { for (const a of actors.list) a.talking = 0; player.talk = 0; }
  // l: { who: 'nate' | 'theo' | 'wren' ..., text: key, seconds, kind, mood, moods }. Returns how long the line stays.
  function speak(l, now = false) {
    const who = l.who || '', kind = l.kind || (who === 'wren' ? 'wren' : '');
    const a = who && who !== 'nate' ? actors.get(l.actor || who) : null;
    return ui.say(who ? t('name.' + who) : '', t(l.text), {
      seconds: l.seconds, kind, now,
      // the speaker moves a hand with the words; WREN has her own soft sound
      onShow: () => { quietTalk(); lineMoods(l); if (kind === 'wren') sound.wren(); if (a) a.talking = 1; else if (who === 'nate') player.talk = 1; },
      onDone: () => { if (a) a.talking = 0; else if (who === 'nate') player.talk = 0; },
    });
  }

  // ------------------------------------------------------------------ things the story owns
  function removeCar(id) {
    const v = cars.get(id);
    cars.delete(id); enterable.delete(id);
    if (!v) return;
    if (vehicles.active === v) vehicles.leaveNow(player);
    if (vehicles.live.includes(v)) vehicles.removeVehicle(v);
  }
  function removeThing(id) {
    const o = things.get(id);
    if (!o) return;
    things.delete(id);
    if (held === id) { player.hold(null); held = false; player.setPose('idle'); }
    if (o.holder.parent) o.holder.parent.remove(o.holder);
    // (pictures are shared between props and stay; shapes and materials are freed)
    o.inner.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
  }
  // a parcel in the player's arms. what: { kind, size } or null
  function carry(what) {
    if (held) removeThing(held);
    if (!what) return;
    STEP.prop({ id: '_carry', kind: what.kind || 'parcel', size: what.size, at: [0, 0, 0] });
    const o = things.get('_carry');
    scene.remove(o.holder);
    o.holder.position.set(0, 1.02, 0.36);
    player.hold(o.holder); held = '_carry'; player.setPose('carry');
  }
  function playTape(n, s = {}) {
    const my = gen, auto = s.then === undefined && s.auto !== false;
    music.playTape(n, {
      fromEnd: s.fromEnd,
      // a tape player keeps playing: the next track starts by itself (after track 6 comes the empty track 7)
      onEnd: (was) => {
        if (my !== gen) return;
        const next = s.then !== undefined ? s.then : auto ? (was % 6) + 1 : 0;
        fire('tape:' + next);
        if (next) playTape(next, { auto: s.then === undefined && auto }); else music.stopTape();
      },
    });
  }
  // who is behind the player's car (for the rear-view mirror)
  const items = [];
  function mirrorItems() {
    items.length = 0;
    const c = vehicles.active;
    if (!c) return items;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    for (const v of cars.values()) {
      if (!v.mirrorKind || v.away || v === c) continue;
      const dx = v.x - c.x, dz = v.z - c.z, back = -(dx * fx + dz * fz), left = dx * fz - dz * fx;
      if (back < 2 || back > 150) continue;
      items.push({ side: clamp(-left / Math.max(5, back * 0.4), -1, 1), dist: back, kind: v.mirrorKind });
    }
    return items;
  }

  // ------------------------------------------------------------------ film scenes
  function leaveCine() {
    if (!cine) return;
    cine = false;
    director.stop(); ui.cine(false); ui.skip(null); ui.prompt(null);
    vehicles.forceDriver = null;
    // the game camera starts again behind the car or the player
    if (vehicles.state === 'driving') rig.startChase(); else rig.set(player.heading, 0.1);
  }

  // ------------------------------------------------------------------ objectives
  // What every "do this" step shares: the text, the marker, a hint, its own rules, a time limit.
  //   check(dt, st) says when the step is done. It may set st.text / st.marker to show something else for a while.
  function goal(s, defMarker, check, onEnd = null) {
    const st = { time: 0, text: null, marker: null, timedOut: false };
    const mine = wrap(s.on), base = s.text ? t(s.text) : '';
    const baseMark = s.marker === false ? null : s.marker || defMarker || null;
    if (s.tip) ui.tip(t(s.tip), s.tipSeconds || 7);
    if (s.quiet) { quietOn = true; ui.quiet(true); }       // a quiet moment: no objective on the screen
    return {
      update(dt) {
        st.time += dt;
        const bad = runRules(mine, dt, st.time);
        if (bad) { fail(bad); return false; }
        if (s.timeout && st.time >= s.timeout && !st.timedOut) { st.timedOut = true; if (s.onTimeout) run(s.onTimeout); else return true; }
        const done = check(dt, st);
        objective.text = st.text !== null ? st.text : base;
        marker = st.marker || baseMark;
        return done;
      },
      end() {
        objective.text = ''; objective.info = ''; marker = null; ui.prompt(null);
        if (s.quiet) { quietOn = false; ui.quiet(false); }
        if (onEnd) onEnd();
      },
    };
  }
  // the vehicle the mission is driven with (the player is sent back to it when they are outside)
  const missionCar = (s) => s.vehicle || (mission && mission.vehicle) || (chapter && chapter.vehicle) || null;
  function driveCheck(s) {
    const id = missionCar(s);
    return (dt, st) => {
      const v = id ? car(id) : null;
      if (v && !(vehicles.state === 'driving' && vehicles.active === v)) { st.text = t('ui.get_in'); st.marker = { car: id }; return false; }
      st.text = null; st.marker = null;
      const p = pt(s.at), q = player.position;
      if (Math.hypot(q.x - p[0], q.z - p[2]) > (s.radius || 8)) return false;
      return !s.stop || vehicles.speedKmh < 7;
    };
  }

  // ==================================================================== THE STEPS
  const STEP = {};

  // ---------------------------------------------------------------- the world
  STEP.time = (s) => {
    if (s.hour !== undefined) lighting.setHour(s.hour);
    lighting.setRunning(!!s.run);                           // (the story keeps its hour: the night does not end in the middle of a scene)
    if (s.rain !== undefined) { weather.setInstant(!!s.rain); hud.setRainButton(!!s.rain); }
  };
  STEP.world = (s) => {
    if ('traffic' in s) city.traffic.setCap(s.traffic === null ? Infinity : s.traffic);
    // (now: true = people over the number vanish at once, for scenes that start behind a black screen;
    //  without it they only go once they are out of sight)
    if ('people' in s) city.people.setCap(s.people === null ? Infinity : s.people, !!s.now);
    if ('indoors' in s) indoors = !!s.indoors;
  };
  // take the parked cars away from a place (so the player can stop there)
  STEP.clear = (s) => { const p = pt(s.at), r = s.radius || 9; vehicles.clearParked((rec) => Math.hypot(rec.x - p[0], rec.z - p[2]) < r); };

  // ---------------------------------------------------------------- vehicles
  STEP.spawn = (s) => {
    if (car(s.id)) { if (!s.replace) return; removeCar(s.id); }
    const p = pt(s.at), arena = s.arena ? ARENAS[s.arena] : null;
    const face = s.face && s.face.like ? (car(s.face.like) || { heading: 0 }).heading : angle(s.face || 0);
    if (!arena) vehicles.clearParked((rec) => Math.hypot(rec.x - p[0], rec.z - p[2]) < 6.5);
    const opts = { keep: true, npc: !!s.npc, simple: !!s.simple, arena, tint: s.tint || null, lights: s.lights || 'normal', noDetail: !!s.noDetail };
    // ("or": the car to use when the wanted model file is missing in this copy of the game)
    const v = vehicles.spawn(s.kind, p[0], p[2], face, s.color ? lin(s.color) : null, opts) || (s.or ? vehicles.spawn(s.or, p[0], p[2], face, s.color ? lin(s.color) : lin([0.1, 0.1, 0.11]), opts) : null);
    if (!v) { console.warn('[story] no such vehicle:', s.kind); return; }
    v.storyId = s.id;
    cars.set(s.id, v);
    if (s.enter) enterable.add(s.id);
    if (s.mirror) v.mirrorKind = s.mirror;
    if (s.type) { v.type = { ...v.type, ...s.type }; if (s.type.label) v.label = s.type.label; }
    if (s.speed) { v.forward = s.speed / KMH; v.vx = Math.sin(face) * v.forward; v.vz = Math.cos(face) * v.forward; }   // (it is already rolling)
    STEP.vehicleSet(s);
  };
  STEP.vehicleSet = (s) => {
    const v = car(s.id);
    if (!v) return;
    if (s.limit !== undefined) v.limit = s.limit / KMH;
    if (s.lockExit !== undefined) v.lockExit = s.lockExit;
    if (s.flash !== undefined) v.siren = !!s.flash;            // Guard lights without the siren
    if (s.lights && s.do === 'vehicleSet') v.lights = s.lights;
    if (s.place) { const p = pt(s.place); v.x = p[0]; v.z = p[2]; v.y = p[1]; if (s.face !== undefined) v.heading = angle(s.face); v.vx = v.vz = 0; v.forward = 0; }
    if (s.stop) { v.vx = v.vz = 0; v.forward = 0; }
    if (s.dead !== undefined) v.dead = !!s.dead;               // a wreck: the engine is silent
    if (s.curbSide !== undefined) v.curbSide = !!s.curbSide;   // the driver gets out on the sidewalk side
    if (s.damage !== undefined && v.isCar) { v.damage = s.damage; vehicles.showDamage(v); }
    if (s.gap !== undefined && v.aiInfo) v.aiInfo.gap = s.gap;   // Zero: how far behind the player it stays
    if (s.hold !== undefined && v.aiInfo) v.aiInfo.hold = s.hold; // a Guard car: how far it hangs back
    if (s.enter !== undefined && s.do === 'vehicleSet') { if (s.enter) enterable.add(s.id); else enterable.delete(s.id); }
  };
  // how a computer driver drives (see drivers.js)
  STEP.drive = (s) => {
    const v = car(s.id);
    if (!v) return;
    const mode = s.mode || 'path';
    if (mode === 'stop') drivers.stopCar(v);
    else if (mode === 'path' || mode === 'race') {
      drivers.path(v, {
        // (a path is the name of one of the chapter's paths, or a list of places)
        path: typeof s.path === 'string' ? paths[s.path] : makePath(s.path.map((q) => { const w = pt(q); return [w[0], w[2]]; })), speed: (s.speed || 50) / KMH, kin: !!s.kin, end: s.end || 'stop', offset: s.offset || 0,
        race: mode === 'race' ? { lead: s.lead || 0, min: (s.min || 60) / KMH, max: (s.max || 180) / KMH } : null,
        onEnd: () => { fire(s.event); if (s.end === 'remove') cars.delete(s.id); },
      });
    } else if (mode === 'shadow') drivers.shadow(v, { gap: s.gap || 16 });
    else if (mode === 'pursue') drivers.pursue(v, { hold: s.hold || 0, pace: s.pace || 0.8 });
    else if (mode === 'overtake') drivers.overtake(v, { dir: s.dir, lanes: s.lanes, axis: s.axis, speed: (s.speed || 110) / KMH, onPass: () => fire(s.event) });
    else if (mode === 'ram') drivers.ram(v, { speed: (s.speed || 120) / KMH, hitAt: s.hitAt, onHit: () => fire(s.event || 'crash') });
  };

  // ---------------------------------------------------------------- people
  const lookOf = (l) => (l && typeof l === 'object' && !('yaw' in l) ? (() => { const p = pt(l); return { x: p[0], y: p[1], z: p[2] }; })() : l);
  STEP.actor = (s) => {
    if (actors.get(s.id)) { if (!s.replace) return; actors.remove(s.id); }
    const seat = s.seat ? car(s.seat) : null;
    const p = s.at ? pt(s.at) : seat ? [seat.x, seat.y, seat.z] : [0, 0, 0];
    const a = actors.spawn(s.id, {
      model: s.model || null, extra: s.extra || null, name: s.name ? t(s.name) : '', at: p, heading: angle(s.face || 0), pose: s.pose || 'idle', scale: s.scale || 1,
      tag: !!s.tag, fixed: !!s.fixed, hidden: !!s.hidden, ghost: !!s.ghost, floorBelow: s.floorBelow, look: s.look === undefined ? 'auto' : lookOf(s.look), mood: s.mood,
      // (only a plain [x, z] place follows the street; a point with a height is a floor, a roof, the highway)
      keepY: !(Array.isArray(s.at) && s.at.length === 2),
    });
    if (seat) actors.sitIn(a, seat);
    if (s.model) met.add(s.id);
  };
  STEP.actorSet = (s) => {
    const a = actors.get(s.id);
    if (!a) return;
    if (s.pose) actors.setPose(a, s.pose, s.seconds === undefined ? 0.4 : s.seconds);
    if ('look' in s) a.look = lookOf(s.look);
    if (s.at) { const p = pt(s.at); actors.place(a, p[0], p[1], p[2], s.face === undefined ? null : angle(s.face)); a.root.position.set(p[0], p[1], p[2]); }
    else if (s.face !== undefined) a.heading = angle(s.face);
    if (s.walk) { const p = pt(s.walk); actors.walkTo(a, p[0], p[2], s.speed || 1.4, s.then === undefined ? null : angle(s.then)); }
    if ('hidden' in s) a.hidden = !!s.hidden;
    if ('seat' in s) actors.sitIn(a, s.seat ? car(s.seat) : null);
    if ('fixed' in s) a.fixed = !!s.fixed;
    if (s.mood) actors.setMood(a, s.mood, s.moodSeconds === undefined ? 0.45 : s.moodSeconds);
  };
  // the faces of several people at once: { do: 'mood', set: { theo: 'sad', nate: 'tired' }, seconds }
  STEP.mood = (s) => { for (const id in s.set || {}) setMood(id, s.set[id], s.seconds === undefined ? 0.45 : s.seconds); };

  // ---------------------------------------------------------------- things
  // where: at (a place) + face, or in: 'car' with at: { cabinAt, p }, or on: 'person' with bone + p + rot (in the hand)
  STEP.prop = (s) => {
    if (things.has(s.id)) { if (!s.replace) return; removeThing(s.id); }
    const inner = props.make(s.kind, s), holder = new THREE.Group();
    holder.add(inner);
    if (s.scale) holder.scale.setScalar(s.scale);
    if (s.rot) holder.rotation.set(s.rot[0], s.rot[1], s.rot[2], 'YXZ');
    const o = { holder, inner, fly: null };
    if (s.in) {
      const v = car(s.in);
      if (!v) return;
      const c = cabinLocal(v, s.at.cabinAt || 'dash', s.at.p);
      holder.position.set(c[0], c[1], c[2]);
      v.tilt.add(holder);                                   // it travels with the car
    } else if (s.on) {
      const a = actors.get(s.on);
      if (!a) return;
      if (s.p) holder.position.set(s.p[0], s.p[1], s.p[2]);
      actors.attach(a, s.bone || 'hand_R', holder);
    } else {
      const p = pt(s.at);
      holder.position.set(p[0], p[1], p[2]);
      if (s.face !== undefined) holder.rotation.y = angle(s.face);
      scene.add(holder);
    }
    // (a delivery drone: it flies up and down a line of points)
    if (s.fly) o.fly = { path: makePath(s.fly.path), y: s.fly.y || 9, speed: s.fly.speed || 7, s: 0 };
    if (s.hidden) holder.visible = false;
    things.set(s.id, o);
  };
  STEP.propSet = (s) => { const o = things.get(s.id); if (o && 'hidden' in s) o.holder.visible = !s.hidden; };
  STEP.remove = (s) => {
    for (const id of s.ids) {
      if (cars.has(id)) removeCar(id);
      if (actors.get(id)) actors.remove(id);
      if (things.has(id)) removeThing(id);
    }
  };

  // ---------------------------------------------------------------- the player
  STEP.player = (s) => {
    if (s.stage) {
      const p = pt(s.stage.at);
      if (vehicles.state !== 'none') vehicles.leaveNow(player, p[0], p[2]);
      player.stage(p[0], p[1], p[2], angle(s.stage.face || 0), s.stage.pose || 'idle', s.stage.floorBelow);
    } else if (s.stage === null) player.unstage();
    if (s.inCar) {
      const v = car(s.inCar);
      if (v && vehicles.active !== v) { if (vehicles.state !== 'none') vehicles.leaveNow(player); player.unstage(); vehicles.enterNow(v, player); }
    }
    if (s.at) {
      const p = pt(s.at), h = s.face === undefined ? player.heading : angle(s.face);
      player.unstage();
      if (vehicles.state !== 'none') vehicles.leaveNow(player, p[0], p[2], h); else player.place(p[0], p[2], h);
      rig.set(h, 0.1);
    }
    if (s.pose) player.setPose(s.pose);
    if ('carry' in s) carry(s.carry);
    if ('hidden' in s) player.setHidden(!!s.hidden);
    if ('look' in s) player.look = s.look;
    if (s.mood) player.mood = s.mood;
  };
  // what the player may do: enter: 'none' | [vehicle names], drive, move
  STEP.allow = (s) => {
    if ('enter' in s) { enterable.clear(); if (Array.isArray(s.enter)) for (const id of s.enter) enterable.add(id); }
    if ('drive' in s) allowDrive = !!s.drive;
    if ('move' in s) allowMove = !!s.move;
  };

  // ---------------------------------------------------------------- sound and picture
  STEP.music = (s) => {
    if (s.stop) { music.stopTape(); tapeShown = false; }
    if (s.tape !== undefined) playTape(s.tape, s);
    if (s.tension !== undefined) music.setTension(s.tension);
    if (s.heart !== undefined) music.setHeartbeat(s.heart);
    if (s.volume !== undefined) music.setTapeVolume(s.volume);
    if (s.silence) { music.silence(s.silence); sound.duck(s.silence); }
    if ('hud' in s) tapeShown = !!s.hud;
  };
  const SOUNDS = {
    honkTwice: (s) => sound.honkTwice(s.volume || 0.8), shot: () => sound.shot(), crash: () => sound.crash('heavy', 1), go: () => sound.chime(), chime: () => sound.chime(),
    door: (s) => sound.doorClick(s.kind || 'close'), wren: () => sound.wren(), tick: () => sound.tick(), clunk: () => sound.burst(700, 1.2, 0.14, 0.002, 0.07),
    beep: () => sound.blip('sine', 880, 880, 0.07, 0.3), thump: () => sound.thump(1), cloth: () => sound.burst(1200, 0.5, 0.05, 0.03, 0.22),
  };
  STEP.sound = (s) => {
    if (SOUNDS[s.name]) SOUNDS[s.name](s);
    if (s.buzz && navigator.vibrate) { try { navigator.vibrate(s.buzz); } catch (e) { /* not allowed */ } }
  };
  STEP.fade = (s) => {
    const seconds = s.seconds === undefined ? 1 : s.seconds;
    fadeTouched = true;
    if (!s.to || s.to === 'clear') ui.fade(fadeColor, 0, seconds); else { fadeColor = s.to; ui.fade(s.to, 1, seconds); }
    return s.wait ? timer(seconds) : null;
  };
  // a title card on black (or white): { over, title, sub, seconds }
  STEP.card = (s) => {
    fadeColor = s.white ? 'white' : 'black';
    ui.fade(fadeColor, 1, s.fadeSeconds || 0);
    ui.card({ over: t(s.over), title: t(s.title), sub: t(s.sub), dark: !!s.white });
    let left = s.seconds || 4, out = false;
    return { update(dt) { left -= dt; if (left <= 0 && !out) { out = true; ui.card(null); } return left <= -0.9; }, end() { ui.card(null); } };
  };
  STEP.tip = (s) => { ui.tip(s.text ? t(s.text) : null, s.seconds || 5); };
  STEP.say = (s) => { speak(s, !!s.now); };
  STEP.flag = (s) => { Object.assign(flags, s.set); };
  STEP.fire = (s) => { fire(s.event); };
  STEP.light = (s) => { light = s.at ? { at: s.at, color: s.color || 0xffc890, power: s.power || 30, range: s.range || 12 } : null; };
  STEP.wanted = (s) => { police.setScripted({ stars: s.stars || 0 }); };
  STEP.mirror = (s) => { mirrorOn = !!s.on; };
  STEP.quiet = (s) => { quietOn = !!s.on; ui.quiet(quietOn); };
  STEP.cine = (s) => { if (s.on === false) leaveCine(); else { cine = true; ui.cine(true); } };
  STEP.cam = (s) => {
    if ('widen' in s) fovWant = s.widen;
    if (s.yaw !== undefined) rig.set(angle(s.yaw), s.pitch === undefined ? 0.1 : s.pitch);
    if (s.mode) vehicles.camMode = s.mode;
  };

  // ---------------------------------------------------------------- talking
  // lines one after the other: [{ who, text }, { wait: seconds }, { do: [steps] }]
  STEP.lines = (s) => {
    let i = 0, left = 0;
    return {
      update(dt) {
        left -= dt;
        while (left <= 0) {
          if (i >= s.lines.length) return true;
          const l = s.lines[i++];
          if (l.if && !test(l.if)) continue;
          run(l.do);
          if (!l.text) lineMoods(l);
          if (l.wait) left += l.wait;
          else if (l.text) left = speak(l, true) + (l.gap === undefined ? 0.25 : l.gap);
        }
        return false;
      },
    };
  };
  // up to two answers: { prompt, line, options: [{ text, set: { flag: value }, do: [steps] }], seconds, default }
  STEP.choice = (s) => {
    let done = false;
    choosing = true;
    if (s.line) speak(s.line, true);
    ui.choice(s.prompt ? t(s.prompt) : '', s.options.map((o) => t(o.text)), (i) => {
      const o = s.options[i];
      if (o.set) Object.assign(flags, o.set);       // choices leave traces: they are saved with the next checkpoint
      run(o.do);
      done = true;
    }, s.seconds || 0, s.default || 0);
    return { update: () => done, end() { choosing = false; } };
  };
  // something to read: a phone ({ from, text, when }) or the ticket ({ t1, t2, t3 }), with buttons like a choice
  STEP.read = (s) => {
    let done = false;
    modal++;
    const data = s.kind === 'phone' ? { from: t(s.from), text: t(s.text), when: t(s.when) } : { t1: t(s.t1), t2: t(s.t2), t3: t(s.t3) };
    const buttons = s.buttons || [{ text: 'ui.close' }], my = gen;
    ui.reader(s.kind, data, buttons.map((b) => t(b.text)), (i) => {
      if (my !== gen) return;
      modal = Math.max(0, modal - 1);
      if (buttons[i].set) Object.assign(flags, buttons[i].set);
      run(buttons[i].do);
      done = true;
    });
    return { update: () => done };
  };

  // ---------------------------------------------------------------- film scenes
  // shots: [{ seconds, cam: { from, to, look, lookTo, fov, fovTo, roll, near, shake, ease }, fade: 'in' | 'fromWhite' | 'out',
  //           pov (the camera is in the driver's eyes: their body is hidden), do: [steps at the start],
  //           lines: [{ at: seconds, who, text } | { at, do: [steps] }], end: [steps], act: { label, do } (a button),
  //           hold: { event, seconds, max } (stay until that long after something happened) }]
  // skippable: false = no "hold to skip". keep: true = the film bars stay after the scene (a choice follows).
  STEP.cutscene = (s) => {
    const shots = s.shots;
    let k = -1, time = 0, fired = [], faded = false, holdAt = null, skipped = false, acted = false;
    cine = true; ui.cine(true); hud.showBigMap(false);
    ui.skip(s.skippable === false ? null : () => { skipped = true; });
    const open = () => {
      // (a shot with a condition that is not true is left out)
      while (k < shots.length && shots[k].if && !test(shots[k].if)) k++;
      if (k >= shots.length) return false;
      const sh = shots[k];
      time = 0; faded = false; holdAt = null; acted = false;
      fired = (sh.lines || []).map(() => false);
      run(sh.do);
      director.play({ seconds: sh.seconds, ...sh.cam });
      vehicles.forceDriver = !sh.pov;
      if (sh.fade === 'in') { ui.fade('black', 1, 0); ui.fade('black', 0, sh.fadeSeconds || 1.6); }
      else if (sh.fade === 'fromWhite') { ui.fade('white', 1, 0); ui.fade('white', 0, sh.fadeSeconds || 3); }
      ui.prompt(sh.act ? t(sh.act.label) : null, sh.act ? () => { if (acted) return; acted = true; ui.prompt(null); run(sh.act.do); } : null);
      return true;
    };
    // what a shot would still have done (when the scene is skipped, the world must end up the same)
    const rest = (sh, all) => { (sh.lines || []).forEach((l, i) => { if ((all || !fired[i]) && (!l.if || test(l.if))) { lineMoods(l); if (l.do) run(l.do); } }); run(sh.end); };
    return {
      update(dt) {
        if (skipped) {
          ui.clearSubs(); quietTalk();
          if (k >= 0) rest(shots[k], false);
          for (let j = k + 1; j < shots.length; j++) { if (shots[j].if && !test(shots[j].if)) continue; run(shots[j].do); rest(shots[j], true); }
          if (shots[shots.length - 1].fade === 'out') { fadeColor = 'black'; ui.fade('black', 1, 0.3); } else ui.fade(fadeColor, 0, 0.3);
          return true;
        }
        if (k < 0) { k = 0; if (!open()) return true; }
        time += dt;
        const sh = shots[k];
        (sh.lines || []).forEach((l, i) => { if (!fired[i] && time >= l.at) { fired[i] = true; if (l.if && !test(l.if)) return; if (l.text) speak(l, true); else lineMoods(l); run(l.do); } });
        let end = sh.seconds;
        if (sh.hold) {
          if (events.has(sh.hold.event)) { if (holdAt === null) holdAt = time; end = Math.max(end, holdAt + sh.hold.seconds); }
          else end = sh.hold.max || end * 3;
        }
        const fs = sh.fadeSeconds || 1.2;
        if (sh.fade === 'out' && !faded && time >= end - fs) { faded = true; fadeColor = 'black'; ui.fade('black', 1, fs); }
        if (time < end) return false;
        run(sh.end);
        k++;
        return !open();
      },
      end() { ui.skip(null); ui.prompt(null); if (!s.keep) leaveCine(); },
    };
  };

  // ---------------------------------------------------------------- waiting for the player
  STEP.wait = (s) => timer(s.seconds || 1);
  // walk to a place
  STEP.goto = (s) => goal(s, s.at, () => {
    if (vehicles.state !== 'none') return false;
    const p = pt(s.at), q = player.position;
    return Math.hypot(q.x - p[0], q.z - p[2]) < (s.radius || 1.8);
  });
  // drive to a place (stop: true = and stand still there)
  STEP.driveTo = (s) => goal(s, s.at, driveCheck(s));
  // ... against the clock: { seconds, failText }
  STEP.timer = (s) => {
    const inner = goal(s, s.at, driveCheck(s));
    let left = s.seconds;
    return {
      update(dt) {
        left -= dt;
        if (left <= 0) { fail(s.failText); return false; }
        const done = inner.update(dt);
        const sec = Math.ceil(left);
        objective.info = `${t('ui.time_left')}  ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        return done;
      },
      end() { inner.end(); },
    };
  };
  STEP.enter = (s) => goal(s, { car: s.vehicle }, () => vehicles.state === 'driving' && vehicles.active === car(s.vehicle));
  STEP.leave = (s) => goal(s, s.marker || null, () => vehicles.state === 'none');
  // wait until something happened: { event } or { until: condition }
  STEP.waitFor = (s) => goal(s, null, (dt, st) => (s.event ? took(s.event) : test(s.until, st.time)));
  // stay with another car: { vehicle, far (say farLine beyond this), failFar + failText, until }
  STEP.follow = (s) => {
    let cool = 0;
    return goal(s, { car: s.vehicle }, (dt, st) => {
      const v = car(s.vehicle);
      cool -= dt;
      if (v) {
        const d = distTo(v);
        if (s.failFar && d > s.failFar) { fail(s.failText); return false; }
        if (s.far && d > s.far && cool <= 0 && s.farLine) { cool = 14; speak(s.farLine); }
      }
      return !!s.until && test(s.until, st.time);
    });
  };
  // catch up with another car: { vehicle, catch: meters, until }
  STEP.chase = (s) => goal(s, { car: s.vehicle }, (dt, st) => {
    const v = car(s.vehicle);
    if (!v || distTo(v) < (s.catch || 8)) return true;
    return !!s.until && test(s.until, st.time);
  });
  // get away: done when every car in "from" has been further than "away" meters for "seconds"
  STEP.evade = (s) => {
    let clear = 0;
    return goal(s, s.marker || null, (dt, st) => {
      let near = false;
      for (const id of s.from) { const v = car(id); if (v && distTo(v) < (s.away || 70)) near = true; }
      clear = near ? 0 : clear + dt;
      return clear >= (s.seconds || 3) || (!!s.until && test(s.until, st.time));
    });
  };
  // walk up to a person and press TALK
  STEP.talk = (s) => {
    let pressed = false;
    return goal(s, { actor: s.actor }, () => {
      const a = actors.get(s.actor);
      if (!a) return true;
      const near = vehicles.state === 'none' && Math.hypot(a.x - player.position.x, a.z - player.position.z) < (s.radius || 2.8);
      ui.prompt(near ? t(s.label || 'ui.talk') : null, () => { pressed = true; });
      return pressed;
    });
  };
  // walk up to a thing (prop) or a place (at) and press the button: { label, radius, keep }
  STEP.collect = (s) => {
    let pressed = false;
    return goal(s, s.at || { prop: s.prop }, () => {
      const p = markPoint(s.at || { prop: s.prop });
      if (!p) return true;
      const near = vehicles.state === 'none' && Math.hypot(p[0] - player.position.x, p[2] - player.position.z) < (s.radius || 2.2);
      ui.prompt(near ? t(s.label || 'ui.take') : null, () => { pressed = true; });
      if (pressed && s.prop && !s.keep) removeThing(s.prop);
      return pressed;
    });
  };
  // THE LIMITER MOMENT: a heartbeat, one big button. Pressing it: a second of nothing, then the engine is free.
  //   { vehicle, heart: beats per minute, nag: a line that is said again while the player waits, nagEvery }
  STEP.limiter = (s) => {
    let pressed = false, nag = 0;
    allowDrive = false;                                   // Nate is frozen until the button is pressed
    music.setHeartbeat(s.heart || 104);
    ui.limiter(() => { pressed = true; });
    return goal(s, null, (dt) => {
      if (!pressed) {
        nag += dt;
        if (s.nag && nag > (s.nagEvery || 7)) { nag = 0; speak(s.nag, true); }
        return false;
      }
      const v = car(s.vehicle);
      if (v) v.limit = 0;
      flags.limiter_off = true;
      music.setHeartbeat(0); music.silence(1.0); sound.duck(1.0);
      const my = gen;
      setTimeout(() => { if (my === gen) sound.nitro(); }, 1000);     // the engine opens up
      if (navigator.vibrate) { try { navigator.vibrate([40, 80, 160]); } catch (e) { /* not allowed */ } }
      fovWant = s.widen === undefined ? 1 : s.widen;                  // the view opens up with it
      return true;
    }, () => { ui.limiter(null); music.setHeartbeat(0); allowDrive = true; });
  };

  // ---------------------------------------------------------------- the story itself
  // the game saves here. id: a number > 0. setup: steps that put the world right when the game STARTS at this point.
  STEP.checkpoint = (s) => { checkpoint(s.id, true); };
  STEP.if = (s) => { const R = makeRunner(test(s.cond) ? s.then : s.else); return { update: (dt) => tickRunner(R, dt) }; };
  STEP.seq = (s) => { const R = makeRunner(s.steps); return { update: (dt) => tickRunner(R, dt) }; };
  STEP.meanwhile = (s) => { const R = makeRunner(s.steps); bg.push({ update: (dt) => tickRunner(R, dt) }); };
  STEP.fail = (s) => { fail(s.text); return { update: () => false }; };
  // go on with another chapter
  STEP.chapter = (s) => {
    save.setFlags(flags); save.chapterDone(chapter.id);
    // (if that chapter does not exist, the story is over for now: back to the title screen)
    load(s.id || chapterFile(chapter.number + 1), 0, 0).then((ok) => { if (!ok) G.onExit('title'); });
    return { update: () => false };
  };
  // the end card of a chapter: { over, title, lines: [keys], locked: key }
  STEP.end = (s) => {
    const my = gen, done = chapter;
    save.setFlags(flags); if (met.size) save.unlock([...met]);
    save.chapterDone(done.id); save.finish(done.number);
    loadChapter(chapterFile(done.number + 1)).then((next) => {
      if (my !== gen) return;
      const buttons = next ? [[t('ui.next_chapter'), 'next'], [t('ui.title'), 'title']] : [[t('ui.title'), 'title']];
      ui.endCard({ over: t(s.over), title: t(s.title || done.title), lines: (s.lines || []).map(t), locked: next ? '' : t(s.locked || 'ui.locked') }, buttons, (a) => {
        ui.hideMenus();
        if (a === 'next') load(next.id, 0, 0).then((ok) => { if (!ok) G.onExit('title'); }); else G.onExit('title');
      });
    });
    return { update: () => false };
  };

  // ==================================================================== missions, saving, failing
  function checkpoint(id, note) {
    cpIndex = id;
    save.setFlags(flags);
    if (met.size) save.unlock([...met]);
    save.checkpoint(chapter.id, mi, id);
    if (note && !cine) hud.toast(t('ui.saved'), 1100);
  }
  function setup(list, loaded) {
    for (const s of list || []) {
      if (s.onLoad && !loaded) continue;          // (only when the game starts here: the mission before left it in place)
      if (s.if && !test(s.if)) continue;
      const task = begin(s);
      if (task) bg.push(task);
    }
  }
  // loaded: true = the game starts at this mission (from the menu, after a fail): everything is put in place from nothing
  function beginMission(loaded) {
    mission = chapter.missions[mi];
    rules = wrap(mission.on);
    clock = 0;
    let from = 0;
    if (loaded) {
      setup(mission.setup, true);
      if (cpIndex > 0) {
        const k = mission.steps.findIndex((s) => s.do === 'checkpoint' && s.id === cpIndex);
        if (k >= 0) { run(mission.steps[k].setup); from = k + 1; } else cpIndex = 0;
      }
    } else { cpIndex = 0; setup(mission.setup, false); }
    runner = makeRunner(mission.steps, nextMission);
    runner.i = from;
    if (!loaded) checkpoint(0, mi > 0);           // the game saves itself at the start of every mission
    else if (cpIndex === 0) checkpoint(0, false);
  }
  function nextMission() {
    if (mi + 1 < chapter.missions.length) { mi++; beginMission(false); return; }
    // (the data did not say how the chapter ends)
    const task = STEP.end({});
    runner = makeRunner([]); runner.cur = task;
  }
  function fail(key) {
    if (failed) return;
    failed = true; gen++;
    ui.clearSubs(); quietTalk(); ui.limiter(null); ui.prompt(null); ui.tip(null);
    music.setHeartbeat(0);
    ui.failCard(t(key), (a) => { ui.hideMenus(); failed = false; if (a === 'retry') restart(); else G.onExit('title'); });
  }

  // everything of the story out of the world
  function halt() {
    gen++;
    runner = null; bg.length = 0; rules = []; events.clear();
    failed = false; modal = 0; choosing = false; cine = false; quietOn = false;
    director.stop(); vehicles.forceDriver = null;
    ui.reset(); ui.hideMenus();
    quietTalk();
    carry(null); player.unstage(); player.setPose('idle'); player.look = null;
    if (vehicles.state !== 'none') vehicles.leaveNow(player);
    for (const id of [...cars.keys()]) removeCar(id);
    actors.clear();
    for (const id of [...things.keys()]) removeThing(id);
    drivers.reset(); enterable.clear();
    music.reset(); music.setTapeVolume(1);
    police.setScripted({ stars: 0 });
    city.traffic.setCap(Infinity); city.people.setCap(Infinity);
    allowDrive = allowMove = true; light = null; mirrorOn = false; tapeShown = false; indoors = false; fovWant = 0; limitedFor = 0;
    player.mood = 'neutral';
    objective.text = ''; objective.info = ''; marker = null; beam.visible = false;
    hudState.active = false; hudState.marker = null;
    player.setHidden(false);
  }
  async function preload(ch) {
    const jobs = [], pre = ch.preload || {};
    if (pre.actors) jobs.push(actors.preload(pre.actors));
    if (pre.vehicles && carLib) for (const k of pre.vehicles) if (carLib.geo[k]) jobs.push(Promise.resolve(carLib.loadHi(k)).catch(() => null));
    // (a model that does not arrive must not keep the story from starting)
    await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 25000))]);
  }
  // Start a chapter at a mission and a checkpoint. Loads the chapter's people and cars first.
  async function load(id, m = 0, cp = 0) {
    halt();
    const my = gen;
    active = true; loading = true;
    ui.storyMode(true);
    fadeColor = 'black'; ui.fade('black', 1, 0);
    const ch = await loadChapter(id);
    if (my !== gen) return false;
    if (!ch || !ch.missions || !ch.missions.length) { loading = false; active = false; ui.fade('black', 0, 0.3); ui.storyMode(false); return false; }
    const note = setTimeout(() => { if (my === gen && loading) ui.card({ sub: t('ui.loading_story') }); }, 600);
    await preload(ch);
    clearTimeout(note);
    if (my !== gen) return false;
    ui.card(null);
    chapter = ch; mi = clamp(m, 0, ch.missions.length - 1); cpIndex = cp;
    paths = {};
    for (const k of Object.keys(ch.paths || {})) paths[k] = makePath(ch.paths[k]);
    flags = { ...save.data.flags };
    police.setScripted({ stars: 0 });
    vehicles.enterFilter = (v) => !!v.storyId && enterable.has(v.storyId);
    loading = false;
    fadeTouched = false;
    beginMission(true);
    // the picture comes up from black, unless the mission opens with its own card or fade
    const first = mission.steps[runner.i];
    const own = fadeTouched || (first && (first.do === 'card' || first.do === 'fade' || (first.do === 'cutscene' && (first.shots[0].fade === 'in' || first.shots[0].fade === 'fromWhite'))));
    if (!own) ui.fade('black', 0, 1.2);
    return true;
  }
  const restart = () => load(chapter.id, mi, cpIndex);
  function newGame() { save.reset(); return load(chapterFile(0), 0, 0); }
  // CONTINUE on the title screen. Gives 'locked' when the last chapter was finished and there is no next one yet.
  async function resume() {
    const d = save.data;
    if (d.ended !== null && d.ended !== undefined) {
      const next = await loadChapter(chapterFile(d.ended + 1));
      return next ? load(next.id, 0, 0) : 'locked';
    }
    return load(d.chapter, d.mission, d.checkpoint);
  }
  // the mission list: start anywhere, with the choices a normal game would have made by then ("flags" in the data)
  async function startAt(id, m) {
    const ch = await loadChapter(id);
    if (!ch) return false;
    const fl = { ...(ch.flags || {}) };
    for (let i = 0; i <= m && i < ch.missions.length; i++) Object.assign(fl, ch.missions[i].flags || {});
    save.replaceFlags(fl);
    save.checkpoint(id, m, 0);
    return load(id, m, 0);
  }
  async function missionList() {
    const out = [];
    for (let n = 0; n < 40; n++) {
      const ch = await loadChapter(chapterFile(n));
      if (!ch) break;
      out.push({ head: n ? `${t('ui.chapter')} ${n}  ·  ${t(ch.title)}` : t(ch.title) });
      ch.missions.forEach((q, i) => out.push({ label: t(q.title), id: { chapter: ch.id, mission: i } }));
    }
    return out;
  }
  // what the title screen writes under CONTINUE
  async function saveInfo() {
    const d = save.data;
    const ch = d.chapter ? await loadChapter(d.chapter) : null;
    if (!ch) return { canContinue: false, where: '' };
    const head = ch.number ? `${t('ui.chapter')} ${ch.number}` : t(ch.title);
    const q = ch.missions[clamp(d.mission, 0, ch.missions.length - 1)];
    return { canContinue: true, where: d.ended !== null && d.ended !== undefined ? `${head}  ·  ${t('ui.complete')}` : `${head}  ·  ${t(q.title)}` };
  }
  // leave the story (title screen, free roam)
  function stop() {
    halt();
    active = false; loading = false;
    ui.storyMode(false); ui.fade(fadeColor, 0, 0.4);
    police.setScripted(null);
    vehicles.enterFilter = null;
    lighting.setRunning(true);
  }

  // ==================================================================== every frame
  function update(dt, time) {
    if (!active || loading || failed) return;
    clock += dt; frame++;
    const c = vehicles.state === 'driving' ? vehicles.active : null;
    // how long the limiter has been holding the van back (WREN notices)
    limitedFor = c && c.fx && c.fx.limited ? limitedFor + dt : Math.max(0, limitedFor - dt);
    if (!modal) {                                  // (while something is being read, the story waits)
      const my = gen;
      for (let i = bg.length - 1; i >= 0; i--) {
        const done = bg[i].update(dt);
        if (my !== gen) return;
        if (done) { if (bg[i].end) bg[i].end(); bg.splice(i, 1); }
      }
      const bad = runRules(rules, dt, clock);
      if (my !== gen) return;
      if (bad) { fail(bad); return; }
      if (runner) tickRunner(runner, dt);
      if (my !== gen) return;
    }
    drivers.update();
    // ---- things that move by themselves ----
    for (const o of things.values()) {
      props.animate(o.inner, time);
      if (o.inner.userData.billboard) o.inner.quaternion.copy(camera.quaternion);
      if (o.fly) {
        const f = o.fly, L2 = f.path.total * 2;
        f.s = (f.s + f.speed * dt) % L2;
        const back = f.s > f.path.total;
        pointOn(f.path, back ? L2 - f.s : f.s, P);
        o.holder.position.set(P.x, f.y + Math.sin(time * 1.3) * 0.3, P.z);
        o.holder.rotation.y = Math.atan2(back ? -P.dx : P.dx, back ? -P.dz : P.dz);
      }
    }
    // ---- the small displays ----
    const d = c ? vehicles.hud : null;
    ui.limitBadge(d ? d.limit : 0, !!(d && d.limited));
    music.setInCar(!!c || indoors);
    if (frame % 4 === 0) {
      ui.tape(tapeShown && !!c && !cine, music.trackName, music.progress);
      ui.mirror(mirrorOn && !!c && !cine);
      if (mirrorOn && c && !cine) ui.drawMirror(mirrorItems(), time);
    }
    fovNow += (fovWant - fovNow) * Math.min(1, dt * 1.3);
    // ---- objective, marker, beam ----
    const m = marker && !cine ? markPoint(marker) : null;
    if (m) { markOut.x = m[0]; markOut.y = m[1]; markOut.z = m[2]; }
    hudState.marker = m ? markOut : null;
    hudState.title = mission ? t(mission.title) : '';
    hudState.text = objective.text; hudState.info = objective.info;
    hudState.active = !!objective.text && !cine;
    beam.visible = !!m && !quietOn && !marker.car;
    if (m) beam.position.set(m[0], m[1], m[2]);
  }

  return {
    update, load, resume, restart, newGame, startAt, stop, missionList, saveInfo,
    // the film camera (main.js calls this after its own camera)
    applyCamera(dt) { director.apply(dt); },
    get active() { return active; },
    get loading() { return loading; },
    get cameraActive() { return cine && director.active; },
    // what the player's hands may do right now
    get locks() {
      const all = cine || modal > 0 || choosing || loading || failed;
      locks.move = all || !allowMove; locks.drive = all || !allowDrive; locks.look = cine || modal > 0; locks.action = all;
      return locks;
    },
    get hud() { return hudState; },
    // one small lamp the story may place (a room, a face): null = none
    get light() {
      if (!light) return null;
      lightOut.pos = pt(light.at); lightOut.color = light.color; lightOut.power = light.power; lightOut.range = light.range;
      return lightOut;
    },
    get fovBoost() { return fovNow; },     // 0..1: the view opens up after the limiter is off
    get indoors() { return indoors; },     // true: rain is heard on a roof
    get flags() { return flags; },
    // ---- for tests ----
    cars, things, fire, test, pt,
    get where() { return { chapter: chapter ? chapter.id : null, mission: mi, missionId: mission ? mission.id : null, step: runner ? runner.i - 1 : -1, stepDo: runner && runner.i > 0 && runner.steps[runner.i - 1] ? runner.steps[runner.i - 1].do : null, cine, modal, checkpoint: cpIndex, failed, text: objective.text }; },
    // finish the step that is waiting right now
    skipStep() { if (runner && runner.cur) { if (runner.cur.end) runner.cur.end(); runner.cur = null; } },
  };
}
