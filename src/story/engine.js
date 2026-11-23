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
//     { parking: [r, u, f] }      in the old car park of Chapter 2 (the same directions as the garage)
//   DIRECTIONS ("face") are compass degrees: 0 north, 90 east, 180 south, 270 west.
//   SPEEDS are km/h.
//
//   STEPS THAT WAIT FOR THE PLAYER (each has "text" = the objective, a marker and a GPS route)
//     goto, driveTo, timer, enter, leave, talk, collect, follow, chase, evade, waitFor, limiter
//   STEPS THAT SHOW SOMETHING
//     cutscene, card, lines, choice, read, fade, wait, end
//   STEPS THAT CHANGE THE WORLD AT ONCE
//     time, world, clear, spawn, actor, prop, remove, player, allow, vehicleSet, actorSet, drive, music,
//     sound, say, tip, flag, light, wanted, mirror, cam, quiet, cine, fire, checkpoint, chapter,
//     police (the real wanted system of src/ai/wanted.js), news (the news line on the screen), video (the
//     look of a recording), tarp (the cloth over Theo's car), shutter (Mace's door), fill (light on faces)
//   CHAPTER 2 STEPS THAT WAIT: paint (the paint shop: a color, hold to spray, a new number plate)
//   CHAPTER 3: hack (the mini-game of src/story/hack.js: { title, sub, seconds, length, optional, ok: [steps],
//     fail: [steps], flag }), sunk ({ lena: 'wrecked' | 'intact' }: Lena's flat in The Sunk).
//     police also takes: boats, stealth (a meter fills before he is spotted), hear (a loud boat motor is heard),
//     sentries: [{ path: [[x, z], ...], y, speed, range, fov, sweep, stop }] (drones on a fixed path that look forward),
//     patrol: { at, r, cars, drones, boats }
//     More conditions: { spotted } (the stealth meter was full), { tunnel } (in the drain tunnel), { boat } (in a boat)
//   CHAPTER 4: race ({ race: name in src/race/races.js, vehicle, as: { raceId: storyId }, keep, react: { event: [steps] },
//     shortcutFlag, stop: false } - waits until the race is won, skipped, or handed over on Theo's line; every race event
//     is also a story event 'race:<event>'), raceEnd, slowmo ({ scale, seconds }), autoDrive ({ brake, steer, gas } |
//     { off: true }: the story drives the player's car for a moment), zero ({ strike: {...} } | { stare: true } | { stop:
//     true }: the black car of src/ai/zero.js; its moments are events 'zero:pass', 'zero:hit', 'zero:dark', 'zero:stare',
//     'zero:away', 'zero:gone'), jacket ({ on: true }: Theo's jacket in the car and on the screen)
//   CHAPTER 5: cargo ({ vehicle, kind: 'crate' | 'trailer', label, heavy, fragile } | { vehicle, off: true }: a load
//     that makes the vehicle slow and that breaks a little with every hard hit - events 'cargo:hit', 'cargo:scrape',
//     'cargo:broken'; condition { cargoUnder: 0..1 }), spawn takes scale (a bigger copy: the armored van as a truck) and
//     cargo, carryTo ({ prop (a crate on the ground), at, radius }: pick it up, carry it there - slower - and put it down;
//     it can be put down anywhere and picked up again), pickup ({ prop, radius }: drive the boat or the car to it),
//     docks ({ crew: false }: the dock workers go home). A prop with userData.boatRamp (debrisRamp) is a jump for boats.
//   CHAPTER 6: garage ({ set: true | false, car: 'wreck' | 'whole' | { dirt, bend, hood, bumper, cleaner, wires, lights,
//     deck }, cloth: 0..1 | 'aside', lamps: { car, bench, stand }, radio, kettle, pane, seconds } - Mace's garage of
//     src/story/garageSet.js instead of the city: the city is not drawn, no traffic, nobody in the street, the camera
//     stays in the bay), explore ({ spots: [{ id, at, label, note, radius, do }], next: { at, label, radius }, hint }:
//     walk about, LOOK / TOUCH / LISTEN at things - each one gives a line from Nate - until the next action is
//     pressed; events 'look:<id>'), repair ({ station: 1..6, story: [lines], beat: [steps], after: [steps], cam, dirt,
//     stop, again } - one calm station of src/story/repair.js while Mace tells a story; the story counts as heard
//     (flag heard_<n>, and heard = how many) when it was not skipped). A choice option may carry "if" (it is only
//     shown when the condition is true). Conditions: { flag, atLeast: n } (a number flag of at least n).
//     A chapter with calm: true has no minimap, no stars, no timer, only a small soft hint; WREN says nothing while
//     wren_muted is set (until Chapter 8). People and the player take hands: place (their hands go there: work,
//     spanner, putDown, roof, lean, give).
//   HANDS ON THINGS: prop with { on: actor, carry: true } = a box held in front with both hands (a palm on each side,
//     the arms solved to it, like player carry); a prop in a hand (bone 'hand_R') with grip (degrees, or the maker's
//     userData.grip, e.g. the case's handle) closes the fingers of that hand around it.
//   BUSTED: when the real Guard catches the player, a short line, a fine, and the last checkpoint again.
//   STEPS THAT HOLD OTHER STEPS
//     if (cond, then, else), seq (steps in order), meanwhile (steps in order, beside the main story)
//
//   Any step can carry  if: { condition }  and is skipped when the condition is not true.
//   CONDITIONS: { zone: { x: [from, to], z: [from, to] } }, { near: place, radius }, { flag, is (true, false or a word) }, { time },
//     { event }, { inCar }, { speedOver }, { speedUnder }, { limited: seconds }, { carNear | carFar: id, radius },
//     { damageOver: 0..1 }, { stars: n }, { starsOver: n }, { starsUnder: n }, { seen }, { hidden }, { searching },
//     { droneOver: 0..1 (how close a Guard drone is) },
//     { all: [...] }, { any: [...] }, { not: {...} }
//   EVENTS the world fires: 'seen' (the Guard has seen the player), 'starLost', 'gate' (a scanner gate read the plate),
//     'tape:N' (the tape player started track N)
//   RULES ("on" lists of a mission or of a step): a condition plus what happens when it comes true:
//     { ...condition, hold: seconds it must stay true, do: [steps], fail: 'text key', repeat }
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from './strings.js';
import { makePath, pointOn } from './drivers.js';
import { compassToAngle } from './actors.js';
import { GARAGE, PARKING } from '../city/heroBuildings.js';
import { FINE } from '../ai/wanted.js';
import { lin } from '../city/models.js';
import { createHack } from './hack.js';
import { createRepair } from './repair.js';
import { stepBoat } from '../vehicles/physics.js';

const KMH = 3.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the file of chapter number n: 0 = prologue.js, 1 = chapter01.js, 2 = chapter02.js ...
export const chapterFile = (n) => (n === 0 ? 'prologue' : 'chapter' + String(n).padStart(2, '0'));

export function createStory(G) {
  const { scene, camera, city, layout, vehicles, player, actors, drivers, director, props, ui, music, sound, save, police, lighting, weather, hud, rig, carLib } = G;
  const angle = compassToAngle;
  const _v = new THREE.Vector3(), P = {}, _bq = new THREE.Quaternion();

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
  let fadeColor = 'black', fadeTouched = false, limitedFor = 0, clock = 0, frame = 0, held = false, jacketOn = false;
  // chapter 2: the real Guard is on, the drones speak, the news line, the light on faces
  let realPolice = false, announce = false, paNext = 0, paCount = 0, newsText = null, fillPower = null, starsWas = 0, seenWas = false;
  const ambient = { radio: 0, street: 0, drone: 0 };
  const world = G.world || {};
  const hack = createHack();                                 // the hacking mini-game of Chapter 3
  const repair = createRepair();                             // the repair stations of Chapter 6
  let garageOn = false, calmOn = false;                      // Chapter 6: Mace's garage instead of the city; the calm screen
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
    // ('back' / 'front': the middle of the car's tail / nose, at the height of a number plate)
    const plateY = v.info.plateY || v.info.wheelR * 1.55;
    const b = at === 'eye' ? c.eye : at === 'pass' ? [-c.eye[0], c.eye[1], c.eye[2]] : at === 'mid' ? [0, c.eye[1], c.eye[2]] : at === 'dash' ? c.dash
      : at === 'wheel' ? c.wheel : at === 'passSeat' ? [-s.x, s.y, s.z] : at === 'back' ? [0, plateY, v.info.backZ] : at === 'front' ? [0, plateY, v.info.frontZ] : [s.x, s.y, s.z];
    return [b[0] + p[0], b[1] + p[1], b[2] + p[2]];
  }
  // any "place" of the data -> [x, y, z] in the world
  function pt(a) {
    if (!a) return [0, 0, 0];
    if (Array.isArray(a)) return a.length === 2 ? [a[0], groundAt(a[0], a[1]), a[1]] : a;
    if (a.garage) return GARAGE.at(a.garage[0], GARAGE.curb + a.garage[1], a.garage[2]);
    if (a.flat) return GARAGE.at(a.flat[0], GARAGE.flat.floor + a.flat[1], a.flat[2]);
    if (a.parking) return PARKING.ready ? PARKING.at(a.parking[0], PARKING.curb + a.parking[1], a.parking[2]) : [0, 0, 0];
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
      if (v) { x = v.rx ?? v.x; y = v.ry ?? v.y; z = v.rz ?? v.z; h = v.rh ?? v.heading; }     // (a car: its smooth pose, the film camera glides)
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
    // (is: a word compares the word - chip_holder is 'lena'; atLeast: a number - stories heard; else true / false)
    if (c.flag && c.atLeast !== undefined) { if (!((Number(flags[c.flag]) || 0) >= c.atLeast)) return false; }
    else if (c.flag && (typeof c.is === 'string' ? flags[c.flag] !== c.is : !!flags[c.flag] !== (c.is === undefined ? true : !!c.is))) return false;
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
    // the Guard (Chapter 2)
    if (c.stars !== undefined && police.stars !== c.stars) return false;
    if (c.starsOver !== undefined && !(police.stars > c.starsOver)) return false;
    if (c.starsUnder !== undefined && !(police.stars < c.starsUnder)) return false;
    if (c.seen !== undefined && (police.stars > 0 && police.mode === 'chase') !== !!c.seen) return false;
    if (c.hidden !== undefined && police.hidden !== !!c.hidden) return false;
    if (c.searching !== undefined && (police.stars > 0 && police.mode === 'search') !== !!c.searching) return false;
    if (c.droneOver !== undefined && !(police.droneNear > c.droneOver)) return false;
    // The Sunk (Chapter 3)
    if (c.spotted !== undefined && !!police.spotted !== !!c.spotted) return false;
    if (c.tunnel !== undefined && !!(city.sunk && city.sunk.inTunnel(p.x, p.z)) !== !!c.tunnel) return false;
    if (c.boat !== undefined && (vehicles.state === 'driving' && !!vehicles.active && vehicles.active.role === 'boat') !== !!c.boat) return false;
    // The docks (Chapter 5): how whole the load still is; the crate in the hands
    if (c.cargoUnder !== undefined) { const l = vehicles.cargo.info(c.cargoOf ? car(c.cargoOf) : vehicles.active); if (!l || !(l.integrity < c.cargoUnder)) return false; }
    if (c.carrying !== undefined && (held === '_carry') !== !!c.carrying) return false;
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
  // (WREN keeps quiet when Nate asked her to stop listening in Chapter 6 - until Chapter 8)
  const wrenQuiet = () => !!flags.wren_muted && (!chapter || chapter.number < 8);
  function speak(l, now = false) {
    const who = l.who || '', kind = l.kind || (who === 'wren' ? 'wren' : '');
    if ((who === 'wren' || kind === 'wren') && wrenQuiet() && !l.always) return 0;
    const a = who && who !== 'nate' ? actors.get(l.actor || who) : null;
    const text = t(l.text);
    // (a thought is not said out loud: no mouth moves)
    const aloud = kind !== 'thought';
    return ui.say(who ? t('name.' + who) : '', text, {
      seconds: l.seconds, kind, now, hold: !!l.hold,
      // the speaker's mouth says the words of the line (speech.js), a hand moves with them; WREN has her own soft sound
      onShow: (seconds) => {
        quietTalk(); lineMoods(l); if (kind === 'wren') sound.wren();
        if (!aloud) return;
        if (a) { a.talking = 1; if (a.anim) a.anim.say(text, seconds); } else if (who === 'nate') { player.talk = 1; player.say(text, seconds); }
      },
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
    if (o.carrier) actors.carry(o.carrier, null);          // (out of an actor's hands)
    if (o.grip) actors.grip(o.grip.a, o.grip.tag, 0);
    if (o.holder.parent) o.holder.parent.remove(o.holder);
    for (const c of o.solid || []) city.colliders.removeCircle(c);   // (its posts no longer stop cars)
    if (o.ramp) { const R = vehicles.seaWorld.ramps, i = R.indexOf(o.ramp); if (i >= 0) R.splice(i, 1); }
    // (pictures are shared between props and stay; shapes and materials are freed)
    // (a mesh can have a list of materials: one for each side of a box)
    o.inner.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); for (const q of Array.isArray(m.material) ? m.material : [m.material]) if (q && q.dispose) q.dispose(); } });
  }
  // how big a thing is and where its middle is, in the frame of the one who holds it: { w, h, d, cx, cy, cz }
  const _bb = new THREE.Box3(), _bc = new THREE.Vector3();
  function boxOf(holder) {
    holder.position.set(0, 0, 0);
    holder.updateMatrixWorld(true);
    _bb.setFromObject(holder);
    _bb.getCenter(_bc);
    return { w: _bb.max.x - _bb.min.x, h: _bb.max.y - _bb.min.y, d: _bb.max.z - _bb.min.z, cx: _bc.x, cy: _bc.y, cz: _bc.z };
  }
  // a parcel in the player's arms. what: { kind, size } or null
  function carry(what) {
    if (held) removeThing(held);
    if (player.setBurden) player.setBurden(0);
    if (!what) return;
    STEP.prop({ ...what, id: '_carry', kind: what.kind || 'parcel', at: [0, 0, 0] });
    const o = things.get('_carry');
    // (in the hands it is not an obstacle: take away the circles it put into the collision grid)
    for (const c of o.solid || []) city.colliders.removeCircle(c);
    o.solid = null;
    scene.remove(o.holder);
    // (its size: the hands go on its sides; without a skeleton it simply sits in front of the body)
    const size = boxOf(o.holder);
    o.holder.position.set(0, what.kind === 'crate' ? 1.0 : 1.02, what.kind === 'crate' ? 0.4 : 0.36);
    o.holder.userData.solid = null;
    player.hold(o.holder, size); held = '_carry'; player.setPose('carry');
    // a heavy thing in the arms: he walks slower and cannot run (the crate of Chapter 5)
    if (player.setBurden) player.setBurden(what.heavy === undefined ? (what.kind === 'crate' ? 0.6 : 0) : what.heavy);
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
      if (v && !(vehicles.state === 'driving' && vehicles.active === v)) { st.text = t((chapter && chapter.getIn) || 'ui.get_in'); st.marker = { car: id }; return false; }
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
    // (a car that was painted in the story keeps its new paint: paints = the list of colors, paintFlag = the flag with the choice)
    if (s.paints && s.paintFlag && flags[s.paintFlag] >= 0 && s.paints[flags[s.paintFlag]]) s = { ...s, color: s.paints[flags[s.paintFlag]].color };
    // ("or": the car to use when the wanted model file is missing in this copy of the game)
    const v = vehicles.spawn(s.kind, p[0], p[2], face, s.color ? lin(s.color) : null, opts) || (s.or ? vehicles.spawn(s.or, p[0], p[2], face, s.color ? lin(s.color) : lin([0.1, 0.1, 0.11]), opts) : null);
    if (!v) { console.warn('[story] no such vehicle:', s.kind); return; }
    v.storyId = s.id;
    cars.set(s.id, v);
    if (s.enter) enterable.add(s.id);
    if (s.mirror) v.mirrorKind = s.mirror;
    if (s.type) { v.type = { ...v.type, ...s.type }; if (s.type.label) v.label = s.type.label; if (s.type.role && v.isCar) v.role = s.type.role; }   // (a Phantom body as a street car: not a police car)
    if (s.speed) { v.forward = s.speed / KMH; v.vx = Math.sin(face) * v.forward; v.vz = Math.cos(face) * v.forward; }   // (it is already rolling)
    if (s.detail && v.needDetail) v.needDetail();              // (the detailed model now: glass you can see through, the inside)
    if (s.rusty) v.rusty = true;                               // an old boat: slower to pick up, a rough motor (Chapter 3)
    if (s.scale) vehicles.rescale(v, s.scale);                 // a bigger copy (Chapter 5: the armored van as the big truck)
    if (s.cargo) vehicles.cargo.attach(v, s.cargo);            // a load on it: a crate, or a trailer with a container
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
    if (s.door !== undefined) v.doorOpen = s.door;             // the driver's door stands open (0..1)
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
    // A BOAT (Chapter 3): it steers along a list of places on the water (path), at "speed" km/h; event when it is there
    if (v.role === 'boat') {
      if (mode === 'stop' || !s.path) { v.ai = null; v.forward = 0; return; }
      const pts = s.path.map((q) => { const w = pt(q); return { x: w[0], z: w[2] }; });
      const want = (s.speed || 18) / KMH, inp = { steer: 0, gas: 0, brake: 0, handbrake: false };
      let i = 0;
      v.ai = (b, dt) => {
        let aim = pts[Math.min(i, pts.length - 1)];
        if (i < pts.length && Math.hypot(aim.x - b.x, aim.z - b.z) < (i === pts.length - 1 ? 3 : 7)) { i++; if (i >= pts.length) fire(s.event); aim = pts[Math.min(i, pts.length - 1)]; }
        const end = i >= pts.length;
        const d = Math.atan2(Math.sin(Math.atan2(aim.x - b.x, aim.z - b.z) - b.heading), Math.cos(Math.atan2(aim.x - b.x, aim.z - b.z) - b.heading));
        const w = end ? 0 : Math.abs(d) > 0.7 ? Math.min(want, 4) : want, fwd = b.forward || 0;
        inp.steer = end ? 0 : clamp(-d * 2.4, -1, 1);
        inp.gas = fwd < w ? clamp((w - fwd) / 3, 0.1, 1) : 0;
        inp.brake = fwd > w + 0.8 ? 1 : 0;
        stepBoat(b, inp, dt, vehicles.seaWorld);
      };
      return;
    }
    v.kin = false;                                             // (only a "kin" path moves a car exactly, see drivers.js)
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
      tag: !!s.tag, fixed: !!s.fixed, hidden: !!s.hidden, ghost: !!s.ghost, floorBelow: s.floorBelow, look: s.look === undefined ? 'auto' : lookOf(s.look), mood: s.mood, jacket: s.jacket || null,
      gait: s.gait || null,                                    // how this person walks (a WALK_STYLES name; left out: by who it is)
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
    // (a plain [x, z] place: from now on the person follows the ground, the decks, the stairs; a point with a height is a floor)
    if (s.at) { const p = pt(s.at); actors.place(a, p[0], p[1], p[2], s.face === undefined ? null : angle(s.face)); a.root.position.set(p[0], p[1], p[2]); a.keepY = !(Array.isArray(s.at) && s.at.length === 2); }
    else if (s.face !== undefined) a.heading = angle(s.face);
    // turn the back to somebody (people who do not want to meet Nate's eyes)
    if (s.faceAway) { const q = s.faceAway === 'player' ? player.position : (() => { const w = pt(s.faceAway); return { x: w[0], z: w[2] }; })(); a.heading = Math.atan2(a.x - q.x, a.z - q.z); }
    if (s.walk) { const p = pt(s.walk); actors.walkTo(a, p[0], p[2], s.speed || 1.4, s.then === undefined ? null : angle(s.then)); }
    if ('hidden' in s) a.hidden = !!s.hidden;
    if ('seat' in s) actors.sitIn(a, s.seat ? car(s.seat) : null);
    if ('fixed' in s) a.fixed = !!s.fixed;
    if (s.mood) actors.setMood(a, s.mood, s.moodSeconds === undefined ? 0.45 : s.moodSeconds);
    if ('jacket' in s) actors.setJacket(a, s.jacket);                // somebody else's jacket on (Chapter 4) or off (null)
    if (s.gait) actors.setWalk(a, s.gait);                           // another way of walking (WALK_STYLES)
    if ('hands' in s) a.workAt = s.hands ? pt(s.hands) : null;       // where the hands work (poses work, spanner, putDown, roof, lean, give)
  };
  // the faces of several people at once: { do: 'mood', set: { theo: 'sad', nate: 'tired' }, seconds }
  STEP.mood = (s) => { for (const id in s.set || {}) setMood(id, s.set[id], s.seconds === undefined ? 0.45 : s.seconds); };

  // ---------------------------------------------------------------- things
  // where: at (a place) + face, or in: 'car' with at: { cabinAt, p }, or on: 'person' with bone + p + rot (in the hand)
  STEP.prop = (s) => {
    if (things.has(s.id)) { if (!s.replace) return; removeThing(s.id); }
    if (s.textFlag && flags[s.textFlag]) s = { ...s, text: flags[s.textFlag] };      // (a number plate that was changed in the story)
    // (many copies in one draw: list = [{ at: place, face }])
    if (s.list) s = { ...s, list: s.list.map((e) => { const q = pt(e.at); return [q[0], q[1], q[2], e.face || 0]; }) };
    const inner = props.make(s.kind, s), holder = new THREE.Group();
    if (s.song) inner.userData.song = true;              // (a radio that plays an old song: Chapter 6)
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
      if (s.hood) layOnHood(v, holder, s.hood);
    } else if (s.on === 'player') {
      // in Nate's own hand (the player character)
      const b = player.rig && player.rig.bones[s.bone || 'hand_R'];
      if (!b) return;
      if (s.p) holder.position.set(s.p[0], s.p[1], s.p[2]);
      b.add(holder);
    } else if (s.on && s.carry) {
      // a box held in front with both hands (Rask holds out the package): the hands go on its sides
      const a = actors.get(s.on);
      if (!a) return;
      actors.carry(a, holder, boxOf(holder));
      o.carrier = a;
    } else if (s.on) {
      const a = actors.get(s.on);
      if (!a) return;
      if (s.p) holder.position.set(s.p[0], s.p[1], s.p[2]);
      actors.attach(a, s.bone || 'hand_R', holder);
      // something held by a handle (a case): the fingers of that hand close around it
      const curl = s.grip ?? inner.userData.grip;
      if (curl && /^hand_[LR]$/.test(s.bone || 'hand_R')) { const tag = (s.bone || 'hand_R').slice(-1); actors.grip(a, tag, curl); o.grip = { a, tag }; }
      // along: the name of the next bone (a bandage around a forearm: it lies along the bone, near its end)
      if (s.along && a.rig && a.rig.bones[s.along]) {
        const d = a.rig.bones[s.along].position.clone();
        holder.position.copy(d).multiplyScalar(s.t === undefined ? 0.86 : s.t);
        holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      }
    } else {
      const p = pt(s.at);
      holder.position.set(p[0], p[1], p[2]);
      if (s.face !== undefined) holder.rotation.y = angle(s.face);
      scene.add(holder);
      // A SOLID THING (a guardrail, a food stall, the posts of an arch): its maker says where it is solid, as
      // circles in its own frame (userData.solid: { c: [x, z], r } or { line: [[x, z], ...], r }). They go into the
      // city's collision grid, so cars, the player and the people stop at it instead of passing through.
      const sol = inner.userData.solid;
      if (sol && sol.length) {
        holder.updateMatrixWorld(true);
        const k = holder.scale.x, v = new THREE.Vector3();
        o.solid = [];
        const put = (x, z, r) => { v.set(x, 0, z).applyMatrix4(inner.matrixWorld); const c = { x: v.x, z: v.z, r: r * k, prop: true }; city.colliders.addCircle(c); o.solid.push(c); };
        for (const e of sol) {
          if (e.c) { put(e.c[0], e.c[1], e.r); continue; }
          // a line: circles along it, close enough that nothing slips between them
          for (let i = 0; i < e.line.length - 1; i++) {
            const a = e.line[i], b = e.line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / (e.r * 1.2)));
            for (let q = i ? 1 : 0; q <= n; q++) put(a[0] + ((b[0] - a[0]) * q) / n, a[1] + ((b[1] - a[1]) * q) / n, e.r);
          }
        }
      }
    }
    // (floating junk with a plank: a jump for boats - the boat physics finds it in seaWorld.ramps)
    const br = inner.userData.boatRamp;
    if (br && !s.in && !s.on) {
      const p = holder.position;
      o.ramp = { x: p.x, z: p.z, heading: holder.rotation.y, len: br.len * (s.scale || 1), w: br.w * (s.scale || 1), h: br.h * (s.scale || 1) };
      vehicles.seaWorld.ramps.push(o.ramp);
    }
    // (a delivery drone: it flies up and down a line of points)
    if (s.fly) o.fly = { path: makePath(s.fly.path), y: s.fly.y || 9, speed: s.fly.speed || 7, s: 0 };
    if (s.hidden) holder.visible = false;
    things.set(s.id, o);
  };
  // a flat thing laid on the hood of a car (the wolf engraved on Dante's hood): a ray from above finds the metal
  // in the middle of the hood (hood: meters back from the nose, default 0.8); the thing lies on it, its top toward
  // the windshield
  const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
  function layOnHood(v, holder, back) {
    const b = typeof back === 'number' ? back : 0.8;
    v.tilt.updateWorldMatrix(true, true);
    holder.visible = false;
    _o.set(0, v.info.roof + 1.5, v.info.frontZ - b); v.tilt.localToWorld(_o);
    _d.set(0, -1, 0).transformDirection(v.tilt.matrixWorld);
    _ray.set(_o, _d); _ray.far = v.info.roof + 3;
    const hits = _ray.intersectObject(v.tilt, true).filter((h) => h.object.visible && h.face && !(h.object.material && h.object.material.transparent));
    holder.visible = true;
    if (!hits.length) return;
    const h = hits[0];
    _n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
    // into the car's own space
    const inv = new THREE.Matrix4().copy(v.tilt.matrixWorld).invert();
    const p = h.point.clone().applyMatrix4(inv), n = _n.clone().transformDirection(inv);
    holder.position.copy(p).addScaledVector(n, 0.006);
    // the plane faces up along the normal; its top points back to the windshield (-z of the car)
    const up = new THREE.Vector3(0, 0, -1).projectOnPlane(n).normalize();
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, n).normalize(), up, n);
    holder.quaternion.setFromRotationMatrix(m);
  }
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
      // (the height of the place goes along: in The Sunk a roof and the room under it share x and z)
      const p = pt(s.at), h = s.face === undefined ? player.heading : angle(s.face);
      player.unstage();
      if (vehicles.state !== 'none') vehicles.leaveNow(player, p[0], p[2], h, p[1]); else player.place(p[0], p[2], h, p[1]);
      rig.set(h, 0.1);
    }
    if (s.pose) player.setPose(s.pose);
    if ('carry' in s) carry(s.carry);
    if ('hidden' in s) player.setHidden(!!s.hidden);
    // (look: a place - turned into "how far left / up" from where he stands now - or { yaw, pitch }, or null)
    if ('look' in s) player.look = lookFromPlayer(s.look);
    if (s.mood) player.mood = s.mood;
    if ('hands' in s) player.workAt = s.hands ? pt(s.hands) : null;
  };
  function lookFromPlayer(l) {
    if (!l || (typeof l === 'object' && 'yaw' in l)) return l || null;
    const q = pt(l), p = player.position;
    const dx = q[0] - p.x, dz = q[2] - p.z;
    let yaw = Math.atan2(dx, dz) - player.heading;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    return { yaw: clamp(yaw, -1.3, 1.3), pitch: -Math.atan2(q[1] - (p.y + 1.62), Math.max(0.4, Math.hypot(dx, dz))) };
  }
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
    if (s.calm !== undefined) music.setCalm(s.calm);                 // the soft pad of the last scene of Chapter 2
    if (s.zero !== undefined) music.setZero(s.zero);                 // the deep slow heartbeat when Zero is near (Chapter 4)
    if ('radioSong' in s) music.setRadioSong(!!s.radioSong);         // the old radio: its song, or only its hiss (Chapter 6)
    if (s.motif) music.motif(s.motif);                               // the short motif after the choice (Chapter 6)
    if (s.silence) { music.silence(s.silence); sound.duck(s.silence); }
    if ('hud' in s) tapeShown = !!s.hud;
  };
  const SOUNDS = {
    honkTwice: (s) => sound.honkTwice(s.volume || 0.8), shot: () => sound.shot(), crash: () => sound.crash('heavy', 1), go: () => sound.chime(), chime: () => sound.chime(),
    door: (s) => sound.doorClick(s.kind || 'close'), wren: () => sound.wren(), tick: () => sound.tick(), clunk: () => sound.burst(700, 1.2, 0.14, 0.002, 0.07),
    beep: () => sound.blip('sine', 880, 880, 0.07, 0.3), thump: () => sound.thump(1), cloth: () => sound.burst(1200, 0.5, 0.05, 0.03, 0.22),
    ring: (s) => sound.ring(s.times || 2), scan: () => sound.scanAlarm(), announce: (s) => music.announce(s.seconds || 3.6),
    // Chapter 6: the garage
    clink: () => sound.toolClink(), ratchet: (s) => sound.ratchet(s.times || 4), creak: () => sound.metalCreak(), keys: () => sound.keys(),
    paper: () => sound.paper(), spark: () => sound.spark(), rattle: () => sound.shutter(false), slide: () => sound.clothSlide(),
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
  STEP.say = (s) => { if (s.texts) s = { ...s, text: s.texts[Math.floor(Math.random() * s.texts.length)] }; speak(s, !!s.now); };   // (texts: one of them, at random)
  STEP.flag = (s) => { Object.assign(flags, s.set); };
  STEP.fire = (s) => { fire(s.event); };
  STEP.light = (s) => { light = s.at ? { at: s.at, color: s.color || 0xffc890, power: s.power || 30, range: s.range || 12 } : null; };
  STEP.wanted = (s) => { police.setScripted({ stars: s.stars || 0 }); };
  // THE REAL GUARD (Chapter 2): { real, known, disguised, stars, search: place, seen, radius, cars, drones, gates,
  //   roadblocks, ram (false: they chase but do not ram), patrol: { at, r, cars, drones } | null, startStars, announce (the drones speak) }
  const xz = (place) => { const q = pt(place); return [q[0], q[2]]; };
  STEP.police = (s) => {
    if (s.real !== undefined) { realPolice = !!s.real; police.setScripted(realPolice ? null : { stars: 0 }); }
    const o = {};
    for (const k of ['known', 'disguised', 'cars', 'drones', 'gates', 'roadblocks', 'startStars', 'ram', 'boats', 'stealth', 'hear']) if (k in s) o[k] = s[k];
    if ('patrol' in s) o.patrol = s.patrol ? (() => { const q = xz(s.patrol.at); return { x: q[0], z: q[1], r: s.patrol.r || 120, cars: s.patrol.cars || 0, drones: s.patrol.drones || 0, boats: s.patrol.boats || 0 }; })() : null;
    // (a sentry with an actor: a guard on foot - Chapter 5. His figure walks where the sentry goes, a torch in his hand)
    if ('sentries' in s) o.sentries = (s.sentries || []).map((sp) => (sp.actor ? { ...sp, kind: sp.kind || 'guard', body: guardBody(sp) } : sp));
    if (realPolice) o.freeRoam = false;
    if (Object.keys(o).length) police.configure(o);
    if (s.stars !== undefined) police.setStars(s.stars, { search: s.search ? xz(s.search) : null, seen: !!s.seen, radius: s.radius });
    if ('announce' in s) { announce = !!s.announce; paNext = clock + (s.announceIn || 12); }
  };
  // the figure of a guard on foot (a sentry of wanted.js moves it): a crowd character in rain gear with a torch
  const GUARD_CLOTH = { pants: [0.05, 0.05, 0.06], coat: [0.06, 0.08, 0.11], patch: [0.55, 0.6, 0.12], scarf: [0.05, 0.05, 0.06], head: [0.04, 0.04, 0.05] };
  function guardBody(sp) {
    const id = sp.actor;
    if (!actors.get(id)) {
      STEP.actor({ id, extra: sp.extra || GUARD_CLOTH, name: sp.name || 'name.guard', at: sp.path[0], face: sp.face || 0, pose: 'idle', look: null, mood: 'stern' });
      STEP.prop({ id: id + '_torch', kind: 'torch', on: id, bone: 'hand_R', p: [0, -0.08, 0.04] });
    }
    return (x, z, heading, speed) => {
      const a = actors.get(id);
      if (!a) return;
      if (speed > 0) actors.walkTo(a, x, z, speed * 1.15, null);
      else actors.walkTo(a, x, z, 1.3, heading);
    };
  }
  // the news line at the bottom of the screen: { text: key } or { text: null }
  STEP.news = (s) => { newsText = s.text ? t(s.text) : null; };
  // the look of a recording: { state: 'on' | 'glitch' | 'locked' | 'off', date, file, lock (keys) }
  STEP.video = (s) => { ui.video(s.state, { date: s.date ? t(s.date) : undefined, file: s.file ? t(s.file) : undefined, lock: s.lock ? t(s.lock) : undefined }); };
  // the light that characters carry for the camera: { power } (null = as the time of day wants it)
  STEP.fill = (s) => { fillPower = s.power === undefined ? null : s.power; };
  // something that moves from one value to another over some seconds (a corner of cloth, a door)
  const ease = (get, set, to, seconds) => {
    const from = get();
    if (!seconds) { set(to); return null; }
    let k = 0;
    return { update(dt) { k = Math.min(1, k + dt / seconds); const e = k * k * (3 - 2 * k); set(from + (to - from) * e); return k >= 1; } };
  };
  // THE TARP over Theo's car: { lift: 0..1, seconds, fit: 'car' (the cloth takes the size of that car), hidden }
  STEP.tarp = (s) => {
    const T = world.tarp;
    if (!T) return null;
    if ('hidden' in s) T.visible = !s.hidden;
    if (s.fit) { const v = car(s.fit); if (v) T.userData.resize(v.info.length + 0.25, v.info.halfWidth * 2 + 0.18, v.info.roof + 0.06); }
    if (s.lift === undefined) return null;
    const task = ease(T.userData.lift, T.userData.setLift, s.lift, s.seconds || 0);
    if (task && !s.wait) { bg.push(task); return null; }
    return task;
  };
  // MACE'S DOOR: { open: 0 (down) .. 1 (rolled up), seconds }
  STEP.shutter = (s) => {
    const D = world.shutter;
    if (!D) return null;
    if (s.seconds !== 0) sound.shutter(s.open < D.userData.open());
    const task = ease(D.userData.open, D.userData.setOpen, s.open, s.seconds === undefined ? 2.4 : s.seconds);
    if (task && !s.wait) { bg.push(task); return null; }
    return task;
  };
  // THE PAINT SHOP: { vehicle, colors: [{ name: key, color: [r, g, b] }], plate: 'NEW TEXT', mist: place,
  //   title, sprayText, plateTitle, plateText (keys), sprayTime (seconds of spraying) }
  // The choice is saved: van_color (0..3) and van_plate.
  STEP.paint = (s) => {
    const id = s.vehicle || 'van', v = car(id);
    if (!v) return null;
    const from = v.color.slice();
    let stage = '', pick = -1, holding = false, progress = 0, to = null, done = false, again = 0;
    STEP.prop({ id: '_mist', kind: 'sprayMist', at: s.mist || { of: id, p: [1.7, 1.1, 0] }, hidden: true });
    const mist = () => things.get('_mist');
    const css = (c) => `rgb(${c.map((x) => Math.round(Math.min(1, x) * 255)).join(',')})`;
    const show = (next) => {
      stage = next;
      if (next === 'colors') ui.paint('colors', { title: t(s.title || 'c2.paint.title'), options: s.colors.map((c) => ({ name: t(c.name), css: css(c.color) })) }, (i) => {
        pick = i; to = lin(s.colors[i].color);
        const m = mist(); if (m) m.inner.userData.setColor(s.colors[i].color);
        sound.tick(); show('spray');
      });
      else if (next === 'spray') ui.paint('spray', { title: t(s.colors[pick].name), label: t(s.sprayText || 'c2.paint.spray') }, (on) => { holding = on; });
      else if (next === 'plate') ui.paint('plate', { title: t(s.plateTitle || 'c2.paint.plate_title'), old: flags.van_plate || s.oldPlate || '', plate: s.plate, label: t(s.plateText || 'c2.paint.plate') }, () => {
        STEP.prop({ id: s.plateId || 'plate', kind: 'plate', text: s.plate, in: id, at: { cabinAt: 'back', p: [0, 0, -0.03] }, rot: [0, Math.PI, 0], replace: true });
        sound.doorClick('close');
        flags.van_color = pick; flags.van_plate = s.plate;
        done = true;
      });
    };
    show('colors');
    // (a fixed shot of the van while the player chooses and sprays)
    // (nobody sits in the van while it is painted: no stand-in driver)
    if (s.cam) { cine = true; ui.cine(true); director.play({ seconds: 3600, ...s.cam }); vehicles.forceDriver = false; }
    return goal(s, null, (dt) => {
      if (stage === 'spray') {
        if (holding) progress = Math.min(1, progress + dt / (s.sprayTime || 3.2));
        sound.setSpray(holding);
        const m = mist(); if (m) m.holder.visible = holding;
        ui.paintProgress(progress);
        again -= dt;
        // the new color comes over the old one while the spray is held
        if (holding && again <= 0) { again = 0.08; const e = progress * progress * (3 - 2 * progress); vehicles.repaint(v, from.map((c, i) => c + (to[i] - c) * e)); }
        if (progress >= 1) { holding = false; sound.setSpray(false); vehicles.repaint(v, to); if (m) m.holder.visible = false; sound.chime(); show('plate'); }
      }
      return done;
    }, () => { ui.paint(null); sound.setSpray(false); removeThing('_mist'); if (s.cam && !s.keep) leaveCine(); });
  };
  STEP.mirror = (s) => { mirrorOn = !!s.on; };
  // the film's rear-view mirror (src/story/rearView.js): { car: id } shows what is behind that car, { off: true } ends it
  STEP.rearView = (s) => { if (world.rearView) world.rearView.set(s.off ? null : car(s.car)); };
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
  // up to three answers: { prompt, line, options: [{ text, set: { flag: value }, do: [steps] }], seconds, default }
  STEP.choice = (s) => {
    let done = false;
    choosing = true;
    // (the question stays on the screen until it is answered)
    if (s.line) speak({ ...s.line, hold: true }, true);
    // (an option with "if" is only there when its condition is true: "Stay silent" after three of Mace's stories)
    const shown = s.options.filter((o) => !o.if || test(o.if));
    ui.choice(s.prompt ? t(s.prompt) : '', shown.map((o) => t(o.text)), (i) => {
      const o = shown[i];
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
  // CARRY A CRATE THERE (Chapter 5): { prop: the crate lying somewhere, at: where it must go, radius, size, heavy }
  // PICK UP near the crate, DROP anywhere (it lies there and can be picked up again); done when it is put down
  // at the place (or carried into it with drop: false)
  STEP.carryTo = (s) => {
    let lying = s.prop || null, act = null, n = 0;
    const size = s.size || 1;
    const goalAt = pt(s.at);
    return goal(s, s.at, (dt, st) => {
      const q = player.position;
      const there = Math.hypot(q.x - goalAt[0], q.z - goalAt[2]) < (s.radius || 2.5);
      if (held === '_carry') {
        st.marker = null; st.text = null;
        if (there && s.drop === false) { carry(null); return true; }
        ui.prompt(t(there ? 'ui.put_down' : 'ui.set_down'), () => { act = 'drop'; });
        if (act === 'drop') {
          act = null;
          carry(null);
          if (there) return true;
          // it lies at his feet now
          lying = '_crate' + (n++);
          const f = [q.x + Math.sin(player.heading) * 0.7, q.z + Math.cos(player.heading) * 0.7];
          STEP.prop({ id: lying, kind: 'crate', size, at: f, face: Math.round((player.heading * 180) / Math.PI) });
          sound.thump(0.6);
        }
        return false;
      }
      // not carrying: go to the crate and pick it up
      const o = lying && things.get(lying);
      if (!o) { carry({ kind: 'crate', size, heavy: s.heavy }); return false; }      // (no crate in the world: he has it)
      o.holder.getWorldPosition(_v);
      st.marker = { prop: lying }; st.text = t(s.pickText || 'c5.obj.pick_crate');
      const near = vehicles.state === 'none' && Math.hypot(_v.x - q.x, _v.z - q.z) < 1.9;
      ui.prompt(near ? t('ui.pick_up') : null, () => { act = 'pick'; });
      if (act === 'pick') { act = null; removeThing(lying); lying = null; carry({ kind: 'crate', size, heavy: s.heavy }); sound.burst(900, 0.6, 0.05, 0.01, 0.12); }
      return false;
    }, () => { if (held === '_carry' && s.keepHeld === false) carry(null); });
  };
  // drive the boat (or the car) to a thing and take it: { prop, radius, keep }
  STEP.pickup = (s) => goal(s, { prop: s.prop }, () => {
    const o = things.get(s.prop);
    if (!o) return true;
    o.holder.getWorldPosition(_v);
    const v = vehicles.state === 'driving' ? vehicles.active : null, p = v || player.position;
    if (Math.hypot(_v.x - p.x, _v.z - p.z) > (s.radius || 4)) return false;
    if (!s.keep) removeThing(s.prop);
    fire(s.event);
    return true;
  });
  // the docks themselves: { crew: false } sends the dock workers home (a quiet night, the stealth mission)
  STEP.docks = (s) => { if (city.docks && 'crew' in s) city.docks.setCrew(!!s.crew); };
  // a load on a vehicle (see the top of this file)
  STEP.cargo = (s) => {
    const v = car(s.vehicle);
    if (!v) return;
    if (s.off) vehicles.cargo.detach(v); else vehicles.cargo.attach(v, s);
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

  // ---------------------------------------------------------------- Chapter 6: Mace's garage
  // THE GARAGE SET (src/story/garageSet.js) instead of the city:
  //   { set: true | false, car: 'wreck' | 'whole' | { dirt, bend, hood, bumper, cleaner, wires, lights, deck, lit },
  //     cloth: 0..1 | 'aside', lamps: { car, bench, stand }, stairs (the door to the stairs, 0..1), radio, kettle, pane,
  //     seconds (numbers glide), wait }
  const GSET = () => world.garageSet || null;
  function garageShow(on) {
    const GS = GSET();
    if (!GS || on === garageOn) return;
    garageOn = on;
    GS.show(on);
    if (on) {
      // (only this room: no cars and nobody in the street, the rain on the roof, the camera stays in the bay)
      city.traffic.setCap(0); city.people.setCap(0, true); indoors = true;
      rig.setRoom(GS.room);
    } else {
      city.traffic.setCap(Infinity); city.people.setCap(Infinity);
      rig.setRoom(null);
    }
  }
  STEP.garage = (s) => {
    const GS = GSET();
    if (!GS) return null;
    if (s.set === true) garageShow(true);
    if (s.set === false) { garageShow(false); return null; }
    const C = GS.car, sec = s.seconds || 0, tasks = [];
    const glide = (get, put, to) => { const k = ease(get, put, to, sec); if (k) tasks.push(k); };
    if (C && s.car) {
      if (typeof s.car === 'string') C.set.all(s.car);
      else for (const k of Object.keys(s.car)) {
        const v = s.car[k];
        if (typeof v === 'number' && sec && typeof C.state[k] === 'number') glide(() => C.state[k], (x) => C.set[k](x), v);
        else C.set[k](v);
      }
    }
    if ('cloth' in s) { if (typeof s.cloth === 'number' && sec && typeof GS.clothAt === 'number') glide(() => GS.clothAt, (x) => GS.cloth(x), s.cloth); else GS.cloth(s.cloth); }
    if (s.lamps) for (const id of Object.keys(s.lamps)) { if (sec) glide(() => GS.lampsOn[id], (x) => GS.lamps({ [id]: x }), s.lamps[id]); else GS.lamps({ [id]: s.lamps[id] }); }
    if ('stairs' in s) { if (sec) glide(() => GS.stairsAt, (x) => GS.stairsDoor(x), s.stairs); else GS.stairsDoor(s.stairs); }
    if ('radio' in s) GS.radio(s.radio === 'toggle' ? !GS.radioOn : !!s.radio);
    if ('kettle' in s) GS.kettle(!!s.kettle);
    if ('pane' in s) GS.pane(!!s.pane);
    if (!tasks.length) return null;
    const all = { update(dt) { let done = true; for (const k of tasks) if (!k.over) { k.over = k.update(dt); done = done && k.over; } return done; } };
    if (s.wait) return all;
    bg.push(all);
    return null;
  };
  // WALK ABOUT, LOOK AND TOUCH: { spots: [{ id, at, label, note, radius, do, if }], next: { at, label, radius, do }, text }
  //   Near a spot a soft button (LOOK / TOUCH / LISTEN): Nate says what he thinks (one short line), the spot's steps run
  //   (the radio goes on, the kettle clicks) and 'look:<id>' happens. A spot can be used again. The step ends when the
  //   "next" button is pressed (the next thing to do: HELP MACE at the car).
  STEP.explore = (s) => {
    let pressed = false, cool = 0, best = null;
    const spots = (s.spots || []).filter((q) => !q.if || test(q.if));
    const all = s.next ? [...spots, { ...s.next, isNext: true }] : spots;
    const at = all.map((q) => pt(q.at));
    const press = () => {
      if (cool > 0 || !best) return;
      cool = 0.7;
      if (best.isNext) { pressed = true; ui.prompt(null); return; }
      if (best.note) speak({ who: 'nate', text: best.note, kind: best.kind || 'thought', seconds: best.seconds }, true);
      fire('look:' + best.id);
      flags.c6_looked = Math.max(Number(flags.c6_looked) || 0, 0) + (events.has('first:' + best.id) ? 0 : 1);
      events.add('first:' + best.id);
      run(best.do);
    };
    return goal(s, null, (dt) => {
      cool -= dt;
      if (vehicles.state !== 'none') { ui.prompt(null); return pressed; }
      const q = player.position;
      let bd = 1e9; best = null;
      all.forEach((sp, i) => { const d = Math.hypot(at[i][0] - q.x, at[i][2] - q.z); if (d < (sp.radius || 1.5) && d < bd) { bd = d; best = sp; } });
      ui.prompt(best ? t(best.label || 'c6.act.look') : null, press);
      return pressed;
    }, () => { if (pressed && s.next) run(s.next.do); });
  };
  // ONE REPAIR STATION (src/story/repair.js), while Mace tells a story over a slow close-up of the part:
  //   { station: 1..6, story: [lines, like the "lines" step], hint, hint2, cam: { from, to, look, fov, seconds },
  //     beat: [steps] (the silent moment after the story: Mace stops, wipes his hands), beatSeconds, beatCam, cleanCam
  //     (the film camera during the silent moment / while the dust goes), after: [steps]
  //     (back to work), dirt (the car gets cleaner: the dust after this part), stop / from (station 6: the deck stops
  //     short, and later goes in), again: false (no AGAIN button), heard: false (this story does not count) }
  //   Hold to skip: the part is in its place at once, the story is not counted as heard.
  STEP.repair = (s) => {
    const GS = GSET(), C = GS && GS.car;
    if (!C) return null;
    const my = gen;
    let phase = 'work', worked = false, told = false, skipped = false, left = 0, clean = null, picked = -1, story = null;
    choosing = true;
    cine = true; ui.cine(true); hud.showBigMap(false);
    const station = () => {
      phase = 'work'; worked = false; told = false;
      if (s.cam) director.play({ seconds: s.cam.seconds || 40, ...s.cam });
      story = STEP.lines({ lines: s.story || [] });
      ui.skip(() => { skipped = true; });
      repair.start({
        station: s.station, car: C, garage: GS, stop: s.stop, from: s.from,
        hint: s.hint ? t(s.hint) : '', hint2: s.hint2 ? t(s.hint2) : '',
        sound: { clink: () => sound.toolClink(), ratchet: (n) => sound.ratchet(n || 4), creak: () => sound.metalCreak(), clunk: () => sound.thump(0.5), click: () => sound.tick(), slide: () => sound.clothSlide(), spark: () => sound.spark() },
      }).then(() => { if (my === gen) worked = true; });
    };
    station();
    return {
      update(dt) {
        if (skipped && (phase === 'work' || phase === 'beat')) {
          // (the rest at once: the part in place, the silence, back to work, the dust)
          skipped = false;
          repair.complete(); ui.clearSubs(); quietTalk();
          if (phase === 'work') run(s.beat);
          run(s.after);
          if (s.dirt !== undefined) C.set.dirt(s.dirt);
          ui.skip(null);
          phase = 'ask'; picked = -1; ask();
          return false;
        }
        if (phase === 'work') {
          if (!told) told = story.update(dt);
          if (!(worked && told)) return false;
          // the story was told to its end: it counts
          if (s.heard !== false) { flags['heard_' + s.station] = true; let n = 0; for (let i = 1; i <= 6; i++) if (flags['heard_' + i]) n++; flags.heard = n; }
          ui.skip(null);
          phase = 'beat'; left = s.beatSeconds === undefined ? 3.4 : s.beatSeconds;
          run(s.beat);
          if (s.beatCam && left > 0) director.play({ seconds: 30, ...s.beatCam });    // (Mace's hands, wiping)
          return false;
        }
        if (phase === 'beat') {
          left -= dt;
          if (left > 0) return false;
          run(s.after);
          phase = 'clean';
          clean = s.dirt !== undefined ? ease(() => C.state.dirt, (x) => C.set.dirt(x), s.dirt, 2.6) : null;
          if (s.cleanCam) director.play({ seconds: 30, ...s.cleanCam });              // (the car, a little more itself)
          return false;
        }
        if (phase === 'clean') {
          if (clean && !clean.update(dt)) return false;
          phase = 'ask'; picked = -1; ask();
          return false;
        }
        if (phase === 'ask') {
          if (picked < 0) return false;
          if (picked === 1) { station(); return false; }     // AGAIN: the part comes off, the story again
          return true;
        }
        return true;
      },
      end() { choosing = false; repair.cancel(); ui.skip(null); ui.choice(null); if (!s.keep) leaveCine(); },
    };
    // AGAIN or GO ON (no clock: the player decides)
    function ask() {
      if (s.again === false) { picked = 0; return; }
      ui.choice('', [t('c6.go_on'), t('c6.again')], (i) => { if (my === gen) picked = i; }, 0, 0);
    }
  };

  // ---------------------------------------------------------------- Chapter 3
  // THE HACK (src/story/hack.js): a grid of nodes, one swipe through the path before the time runs out.
  //   { title, sub, hint (keys), seconds (max 20), length, optional (a SKIP button), ok: [steps], fail: [steps], flag }
  //   (failing is never the end: the "fail" steps give a short penalty and the story goes on)
  STEP.hack = (s) => {
    let done = false, result = null;
    const my = gen;
    choosing = true;                                      // (hands off the car and the stick while the fingers draw)
    hack.start({
      title: s.title ? t(s.title) : '', sub: s.sub ? t(s.sub) : '', hint: s.hint ? t(s.hint) : t('c3.hack.hint'),
      seconds: s.seconds || 14, length: s.length || 5, optional: !!s.optional,
      labels: { ok: t('c3.hack.ok'), fail: t('c3.hack.fail'), skip: t('c3.hack.skip') },
    }).then((ok) => {
      if (my !== gen) return;
      result = ok; done = true;
    });
    return {
      update() {
        if (!done) return false;
        if (s.flag) flags[s.flag] = !!result;
        fire(result ? 'hack:ok' : 'hack:fail');
        run(result ? s.ok : s.fail);
        return true;
      },
      end() { choosing = false; if (!done) hack.cancel(); },
    };
  };
  // Lena's flat in The Sunk: { lena: 'wrecked' | 'intact' } (the screens go dark)
  STEP.sunk = (s) => { if (city.sunk && s.lena) city.sunk.setLena(s.lena); };

  // ---------------------------------------------------------------- Chapter 4
  // A RACE of src/race/races.js. The player's car is the mission's car (or "vehicle"). The five others are spawned on the
  // grid by the race; "as" gives them story names (so a film shot can look at { of: 'dante' }).
  //   react: { go: [steps], lastTurn: [steps], push: [steps], ... }: steps that run EVERY time that race event happens
  //   (a line of the crew when they push him; Theo's voice and the slow motion in the last turn). Not more often than
  //   every few seconds for the same event.
  //   The step ends when the race is won (or skipped after two fails, or handed over on Theo's line in the final race).
  //   shortcutFlag: the flag that remembers whether the risky shortcut was taken. stop: false = the race stays (its cars
  //   go on standing there) until raceEnd.
  let raceOn = false;
  function endRace(keep) {
    if (world.races) world.races.stop(true);
    for (const [id, v] of [...cars.entries()]) if (!vehicles.live.includes(v)) { cars.delete(id); enterable.delete(id); }
    raceOn = false;
  }
  STEP.race = (s) => {
    const races = world.races, v = car(s.vehicle || missionCar(s));
    if (!races || !v) { console.warn('[story] a race needs a car'); return null; }
    if (!(vehicles.state === 'driving' && vehicles.active === v)) { player.unstage(); if (vehicles.state !== 'none') vehicles.leaveNow(player); vehicles.enterNow(v, player); }
    const last = {}, my = gen;
    const handle = races.start(s.race, {
      car: v, keep: s.keep,
      onSpawn: (id, rv) => { const sid = (s.as && s.as[id]) || id; cars.set(sid, rv); rv.storyId = sid; },
      onEvent: (e) => {
        if (my !== gen) return;
        fire('race:' + e);
        const list = s.react && s.react[e];
        if (list && (clock - (last[e] ?? -99)) > (s.reactEvery || 5)) { last[e] = clock; run(list); }
      },
    });
    raceOn = true;
    return goal({ ...s, text: null }, null, () => {
      if (!handle.done) return false;
      if (s.shortcutFlag) flags[s.shortcutFlag] = !!handle.shortcut;
      fire('race:result:' + handle.result);
      return true;
    }, () => { if (s.stop !== false) endRace(); });
  };
  STEP.raceEnd = () => { endRace(); };
  // SLOW MOTION for a moment: scale = how fast the game runs (0.4 = slow), seconds = real seconds
  STEP.slowmo = (s) => { if (world.slow) world.slow.set(s.scale === undefined ? 0.4 : s.scale, s.seconds === undefined ? 1.25 : s.seconds); };
  // the story drives the player's car for a moment (brakes it to a stop in a film scene): { brake, steer, gas } or { off: true }
  STEP.autoDrive = (s) => { vehicles.autoDrive = s.off ? null : { steer: s.steer || 0, gas: s.gas || 0, brake: s.brake === undefined ? 1 : s.brake, handbrake: !!s.handbrake, nitro: false, up: false, down: false, horn: false }; };
  // ZERO (src/ai/zero.js). strike: { speed, ahead, side, stopAhead, stareFor } - it goes through the field of the race
  // that is running; stare: it stands in front of Nate, lights on; stop: it is taken away.
  STEP.zero = (s) => {
    const Z = world.zero, races = world.races;
    if (!Z) { fire('zero:gone'); return null; }
    if (s.strike) {
      const ok = Z.strike({ ...s.strike, line: races && races.line, field: races ? races.field : [], playerCar: (races && races.playerCar) || vehicles.active });
      if (!ok) fire('zero:gone');
      else if (Z.car) { cars.set('zero', Z.car); Z.car.storyId = 'zero'; }
    }
    if (s.stare) Z.stare();
    if (s.stop) { Z.stopStrike(); cars.delete('zero'); }
    return null;
  };
  // THEO'S JACKET (Chapter 4, when Nate took it): it lies on the seat next to him, and a small sign on the screen
  STEP.jacket = (s) => { jacketOn = !!s.on; if (world.jacket) world.jacket(jacketOn); };

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
    ui.clearSubs(); quietTalk(); ui.limiter(null); ui.prompt(null); ui.tip(null); hack.cancel(); repair.cancel();
    music.setHeartbeat(0);
    ui.failCard(t(key), (a) => { ui.hideMenus(); failed = false; if (a === 'retry') restart(); else G.onExit('title'); });
  }

  // BUSTED: the real Guard caught the player. No game over: a short line, a fine, the last checkpoint again.
  function busted(stars) {
    if (failed || !active || loading) return;
    failed = true; gen++;
    const my = gen;
    ui.clearSubs(); quietTalk(); ui.limiter(null); ui.prompt(null); ui.tip(null); ui.paint(null); hack.cancel();
    music.setHeartbeat(0); sound.setSpray(false);
    const left = save.pay(FINE);
    const n = 1 + Math.floor(Math.random() * 3);
    ui.say(t('name.guard'), t('c2.busted.' + n), { now: true, seconds: 2.4 });
    if (navigator.vibrate) { try { navigator.vibrate([60, 60, 60]); } catch (e) { /* not allowed */ } }
    setTimeout(() => {
      if (my !== gen) return;
      ui.fade('black', 0.6, 0.6);
      ui.bustCard({ title: t('ui.busted'), line: t('c2.busted.after'), fine: `${t('ui.fine')}   -${FINE} CR`, left: `${t('ui.money_left')}   ${left} CR`, label: t('ui.continue') }, () => {
        ui.hideMenus(); failed = false;
        if (my === gen) restart();
      });
    }, 2300);
  }
  police.onBusted = (stars) => { if (active && realPolice) busted(stars); else if (!active) G.onFreeBusted && G.onFreeBusted(stars); };

  // everything of the story out of the world
  function halt() {
    gen++;
    runner = null; bg.length = 0; rules = []; events.clear();
    failed = false; modal = 0; choosing = false; cine = false; quietOn = false;
    director.stop(); vehicles.forceDriver = null;
    ui.reset(); ui.hideMenus();
    quietTalk();
    carry(null); player.unstage(); player.setPose('idle'); player.look = null; player.workAt = null;
    if (vehicles.state !== 'none') vehicles.leaveNow(player);
    for (const id of [...cars.keys()]) removeCar(id);
    actors.clear();
    for (const id of [...things.keys()]) removeThing(id);
    // (the race of Chapter 4 first: it removes its own cars)
    if (world.races) world.races.stop(true);
    if (world.zero) world.zero.stopStrike();
    if (world.slow) world.slow.set(1, 0);
    if (world.rearView) world.rearView.set(null);
    vehicles.autoDrive = null; raceOn = false;
    if (jacketOn && world.jacket) world.jacket(false);
    jacketOn = false;
    drivers.reset(); enterable.clear();
    music.reset(); music.setTapeVolume(1);
    police.reset(); police.setScripted({ stars: 0 });
    realPolice = false; announce = false; newsText = null; fillPower = null; starsWas = 0; seenWas = false;
    if (world.tarp) { world.tarp.userData.setLift(0); world.tarp.visible = true; }
    if (world.shutter) world.shutter.userData.setOpen(1);
    sound.setSpray(false);
    hack.cancel(); repair.cancel();
    if (garageOn) garageShow(false);
    if (calmOn) { calmOn = false; ui.calm(false); }
    if (city.sunk) city.sunk.setLena('intact');
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
    // a calm chapter (Chapter 6): no minimap, no stars, no timer - only a small soft hint
    calmOn = !!ch.calm; ui.calm(calmOn);
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
    police.reset(); police.setScripted(null);
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
    // ---- Zero's moments (Chapter 4) ----
    if (world.zero) for (const e of world.zero.takeEvents()) fire('zero:' + e);
    // ---- the load on a vehicle (Chapter 5): its hits and scrapes, and when it is broken ----
    for (const e of vehicles.cargo.events) fire('cargo:' + e);
    // ---- the Guard: what happened (for rules and waits), and the drones' loudspeakers ----
    if (realPolice) {
      const st = police.stars, seenNow = st > 0 && police.mode === 'chase';
      if (seenNow && !seenWas) fire('seen');
      if (st < starsWas) fire('starLost');
      starsWas = st; seenWas = seenNow;
      if (police.takeGate() !== null) fire('gate');
      if (announce && !cine && police.droneNear > 0.3 && clock > paNext && !ui.subsBusy) {
        paNext = clock + 34;
        music.announce(3.4);
        const my = gen;
        setTimeout(() => { if (my === gen && !cine) ui.say(t('name.drone'), t('c2.pa.' + (1 + (paCount++ % 3))), { kind: 'thought', seconds: 3.4 }); }, 800);
      }
    }
    // ---- the voices around: an old radio, the news screens of the street (for music.js) ----
    ambient.radio = 0; ambient.street = 0; ambient.drone = 0;
    {
      const cx = camera.position.x, cz = camera.position.z;
      for (const o of things.values()) {
        const k = o.inner.userData.kind;
        if (k === 'policeDrone') { o.holder.getWorldPosition(_v); ambient.drone = Math.max(ambient.drone, clamp(1 - Math.hypot(_v.x - cx, _v.z - cz) / 70, 0, 1)); continue; }
        if (k !== 'radio' && k !== 'newsScreen') continue;
        o.holder.getWorldPosition(_v);
        const d = Math.hypot(_v.x - cx, _v.z - cz);
        if (k === 'radio' && o.holder.visible && !o.inner.userData.off) ambient.radio = Math.max(ambient.radio, clamp(1 - d / 11, 0, 1));
        else if (k === 'newsScreen') ambient.street = Math.max(ambient.street, clamp(1 - d / 48, 0, 1));
      }
    }
    // ---- Chapter 6: the radio on the garage shelf (its old song is heard further than a voice) ----
    ambient.song = 0;
    {
      const GS = GSET();
      if (garageOn && GS && GS.radioOn) {
        const r = GS.radioAt, d = Math.hypot(r[0] - camera.position.x, r[1] - camera.position.y, r[2] - camera.position.z);
        ambient.song = clamp(1 - d / 26, 0.12, 1);
      }
      for (const o of things.values()) if (o.inner.userData.kind === 'radio' && o.inner.userData.song && o.holder.visible) {
        o.holder.getWorldPosition(_v);
        ambient.song = Math.max(ambient.song, clamp(1 - Math.hypot(_v.x - camera.position.x, _v.z - camera.position.z) / 40, 0, 1));
      }
      if (ambient.song > 0) ambient.radio = 0;          // (a song, not a voice)
    }
    // ---- things that move by themselves ----
    for (const o of things.values()) {
      props.animate(o.inner, time);
      if (o.inner.userData.billboard) o.inner.quaternion.copy(camera.quaternion);
      // (a glow inside a prop always faces the camera)
      const bp = o.inner.userData.billboardPart;
      if (bp && bp.parent) { bp.parent.getWorldQuaternion(_bq); bp.quaternion.copy(_bq.invert().multiply(camera.quaternion)); }
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
    ui.cargo(c && !cine ? vehicles.cargo.info(c) : null);
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
    get news() { return active && !cine ? newsText : null; },     // the news line (Chapter 2)
    get fill() { return active ? fillPower : null; },             // light on faces chosen by the story (null = by the time of day)
    get ambient() { return ambient; },                            // how near an old radio / a news screen is (0..1)
    get realPolice() { return active && realPolice; },
    get indoors() { return indoors; },     // true: rain is heard on a roof
    get garage() { return active && garageOn; },   // Chapter 6: Mace's garage is shown instead of the city
    get calm() { return active && calmOn; },       // Chapter 6: the calm screen
    repair,
    get racing() { return active && raceOn; },     // a race of Chapter 4 runs (its own HUD is on the screen)
    get flags() { return flags; },
    // ---- for tests ----
    cars, things, fire, test, pt, hack,
    get where() { return { chapter: chapter ? chapter.id : null, mission: mi, missionId: mission ? mission.id : null, step: runner ? runner.i - 1 : -1, stepDo: runner && runner.i > 0 && runner.steps[runner.i - 1] ? runner.steps[runner.i - 1].do : null, cine, modal, checkpoint: cpIndex, failed, text: objective.text }; },
    // finish the step that is waiting right now
    skipStep() { if (runner && runner.cur) { if (runner.cur.end) runner.cur.end(); runner.cur = null; } },
  };
}
