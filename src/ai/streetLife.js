// ---------------------------------------------------------------------------
// streetLife.js - small moments in the streets of free roam.
//
// A city feels alive when people have their own business: two people argue
// under an awning, a Guard car has stopped somebody, somebody stands in a
// doorway and talks into a phone, a delivery drone goes by. None of it is
// about the player. Walk past and you overhear a line or two.
//
// Every moment is DATA (the list MOMENTS below): a place, the people (dark
// figures made from the player's body, so they cost almost nothing), things, a
// car, and the lines (keys of src/story/strings.js, so they can be translated).
// A moment is only built while the player is near, and at most two exist at
// the same time. To add one: add an entry to the list.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { t } from '../story/strings.js';
import { compassToAngle } from '../story/actors.js';
import { makePath, pointOn } from '../story/drivers.js';
import { lin } from '../city/models.js';

// people: [x, z, face (compass degrees), pose, name key, shade, size]
// lines:  [index of the speaker, text key]
const MOMENTS = [
  {
    id: 'argue', at: [-238, 135.4],
    props: [{ kind: 'awning', at: [-238, 134.1], face: 0 }],
    people: [[-238.75, 135.25, 270, 'hips', 'name.stranger1', [0.1, 0.11, 0.14], 1.02], [-237.35, 135.45, 90, 'crossed', 'name.stranger2', [0.16, 0.1, 0.1], 0.93]],
    lines: [[0, 'c1.argue.1'], [1, 'c1.argue.2'], [0, 'c1.argue.3']],
  },
  {
    id: 'stop', at: [-294.3, 203.5],
    cars: [{ kind: 'police_coupe', or: 'sedan', at: [-294.3, 199.5], face: 0, color: [0.85, 0.86, 0.9], flash: true }, { kind: 'sedan', at: [-294.3, 207.6], face: 0, color: [0.25, 0.12, 0.1], simple: true, dark: true }],
    people: [[-292.75, 206.9, 90, 'hips', 'name.guard', [0.05, 0.06, 0.09], 1.04]],
    lines: [[0, 'life.stop.1'], [0, 'life.stop.2']],
  },
  {
    id: 'phone', at: [-262, -376.3],
    people: [[-263.4, -376.2, 200, 'phone', 'name.stranger2', [0.12, 0.1, 0.16], 0.95]],
    lines: [[0, 'life.phone.1'], [0, 'life.phone.2']],
  },
  {
    id: 'wall', at: [150, -376.3],
    people: [[149.2, -376.1, 250, 'crossed', 'name.stranger1', [0.13, 0.12, 0.1], 1.0], [150.7, -376.5, 110, 'hips', 'name.stranger2', [0.08, 0.11, 0.13], 0.96]],
    lines: [[0, 'life.wall.1'], [1, 'life.wall.2'], [0, 'life.wall.3']],
  },
  {
    id: 'drone', at: [-287.5, 250], reach: 130,
    drone: { path: [[-287.5, 150], [-287.5, 345]], y: 9.5, speed: 9 },
  },
];

export function createStreetLife({ actors, props, vehicles, ui, scene, player, city }) {
  const live = new Map();      // id of a moment -> what was built for it
  const P = {};
  let timer = 0;

  function build(m) {
    const made = { people: [], things: [], cars: [], said: -1e9, drone: null };
    for (const c of m.cars || []) {
      vehicles.clearParked((rec) => Math.hypot(rec.x - c.at[0], rec.z - c.at[1]) < 6.5);
      const opts = { keep: true, npc: true, simple: !!c.simple, noDetail: true, lights: c.dark ? 'off' : 'normal' };
      const v = vehicles.spawn(c.kind, c.at[0], c.at[1], compassToAngle(c.face), lin(c.color), opts) || (c.or ? vehicles.spawn(c.or, c.at[0], c.at[1], compassToAngle(c.face), lin(c.color), opts) : null);
      if (!v) continue;
      if (c.flash) v.siren = true;                 // the lights turn, without the siren
      made.cars.push(v);
    }
    (m.people || []).forEach(([x, z, face, pose, name, shade, size], i) => {
      const id = `life:${m.id}:${i}`;
      actors.spawn(id, { extra: shade, name: t(name), at: [x, city.groundHeight(x, z), z], heading: compassToAngle(face), pose, scale: size });
      made.people.push(id);
    });
    for (const p of m.props || []) {
      const o = props.make(p.kind, p);
      o.position.set(p.at[0], city.groundHeight(p.at[0], p.at[1]), p.at[1]);
      o.rotation.y = compassToAngle(p.face || 0);
      scene.add(o);
      made.things.push(o);
    }
    if (m.drone) {
      const o = props.make('cargoDrone');
      scene.add(o);
      made.things.push(o);
      made.drone = { o, path: makePath(m.drone.path), y: m.drone.y, speed: m.drone.speed, s: 0 };
    }
    live.set(m.id, made);
  }
  function remove(id) {
    const made = live.get(id);
    if (!made) return;
    live.delete(id);
    for (const a of made.people) actors.remove(a);
    for (const o of made.things) { scene.remove(o); o.traverse((q) => { if (q.isMesh) { q.geometry.dispose(); q.material.dispose(); } }); }
    for (const v of made.cars) if (vehicles.live.includes(v) && v !== vehicles.active) vehicles.removeVehicle(v);
  }
  function clear() { for (const id of [...live.keys()]) remove(id); }

  // on: false while the story or the title screen runs (the streets then belong to them)
  function update(dt, time, on) {
    if (!on) { if (live.size) clear(); return; }
    const px = player.position.x, pz = player.position.z;
    // ---- which moments exist (checked a few times a second) ----
    timer -= dt;
    if (timer <= 0) {
      timer = 0.4;
      for (const m of MOMENTS) {
        const d = Math.hypot(m.at[0] - px, m.at[1] - pz), reach = m.reach || 75;
        if (live.has(m.id)) { if (d > reach + 35) remove(m.id); }
        else if (d < reach && live.size < 2) build(m);
      }
    }
    for (const [id, made] of live) {
      const m = MOMENTS.find((q) => q.id === id);
      // ---- walk past: the lines are overheard (not again for a while) ----
      if (m.lines && time - made.said > 75 && Math.hypot(m.at[0] - px, m.at[1] - pz) < 9 && !ui.subsBusy) {
        made.said = time;
        for (const [who, key] of m.lines) {
          const a = actors.get(made.people[who]);
          ui.say(a ? a.name : '', t(key), { onShow: () => { if (a) a.talking = 1; }, onDone: () => { if (a) a.talking = 0; } });
        }
      }
      for (const o of made.things) props.animate(o, time);
      // ---- the drone flies up and down its street ----
      if (made.drone) {
        const f = made.drone, L2 = f.path.total * 2;
        f.s = (f.s + f.speed * dt) % L2;
        const back = f.s > f.path.total;
        pointOn(f.path, back ? L2 - f.s : f.s, P);
        f.o.position.set(P.x, f.y + Math.sin(time * 1.3) * 0.3, P.z);
        f.o.rotation.y = Math.atan2(back ? -P.dx : P.dx, back ? -P.dz : P.dz);
      }
    }
  }
  return { update, clear, MOMENTS, get count() { return live.size; } };
}
