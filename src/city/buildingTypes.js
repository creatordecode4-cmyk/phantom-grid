// ---------------------------------------------------------------------------
// buildingTypes.js - the CITY FILL: all buildings that are not hero buildings.
//
// They are made from the same kit as the heroes (buildingKit.js), in many
// variations, so no two neighbours look the same:
//
//   tower     stack of rounded floor slabs: straight, tapered, twisted,
//             hourglass or bulging; glass with fins; roof garden / pads
//   trays     thick planted trays every two floors, green wall, ribbon frames
//   steps     floors that step back into garden terraces (glass, wood, graphite)
//   podium    wide glass podium with a slimmer tower on top and a roof wing
//   wave      oval tower with wave balconies (Neon Mile)
//   arcade    low curved shop building under a floating canopy (Neon Mile)
//   retrofit  OLD brick building with new glass and green parts on top
//   plaza     small green square with trees and EV chargers
//
// TO ADD YOUR OWN TYPE: copy an entry of TYPES, change the recipe and give it
// a weight in pickType() at the bottom.
//
// A recipe gets the kit, the lot (lot.rect, lot.front, lot.district ...) and
// "rng" (random numbers that are the same on every start).
// ---------------------------------------------------------------------------

import { FLOOR, LOBBY, GLASS_TINTS, FRAME_COLORS, BRICK_TINTS } from './buildingKit.js';

const ROT = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 };

// Where a building stands on its lot: middle, direction of the front, half sizes.
//   margin = free strip between the lot edge and the building (planters, trees)
function siteOf(lot, margin) {
  const r = lot.rect, wide = lot.front === 'N' || lot.front === 'S';
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  return {
    x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, rot: ROT[lot.front],
    a: (wide ? w : d) / 2 - margin, b: (wide ? d : w) / 2 - margin,
  };
}
// A point given in building coordinates (right, toward the street).
const local = (s, right, front) => [s.x + right * Math.cos(s.rot) + front * Math.sin(s.rot), s.z - right * Math.sin(s.rot) + front * Math.cos(s.rot)];

// How many floors? Depends on the district. Never the same as the neighbour.
function pickFloors(rng, lot, lo, hi) {
  if (lot.district === 'crown') { lo = Math.round(lo * 2.3); hi = Math.round(hi * 2.6); } // the hero towers stay the tallest
  else if (lot.district === 'neon') { lo = Math.max(3, lo - 2); hi = Math.min(11, hi); }
  let f = rng.int(lo, hi);
  if (lot.prev && lot.prev.floors === f) f = f < hi ? f + 1 : f - 1;
  return f;
}
// Frame color and glass tint that differ from the neighbour.
function pickLook(rng, lot) {
  let ci = rng.int(0, FRAME_COLORS.length - 1), gi = rng.int(0, GLASS_TINTS.length - 1);
  if (lot.prev && lot.prev.ci === ci) ci = (ci + 2) % FRAME_COLORS.length;
  if (lot.prev && lot.prev.gi === gi) gi = (gi + 1) % GLASS_TINTS.length;
  const v = 1 + rng.range(-0.08, 0.08);
  return { ci, gi, frame: FRAME_COLORS[ci].map((c) => c * v), glass: GLASS_TINTS[gi].map((c) => c * (1 + rng.range(-0.1, 0.1))) };
}
// The shape of a body over its height (see "levels" in buildingKit.js).
function pickProfile(rng, tall) {
  const r = rng.next();
  if (r < 0.3) return { name: 'straight', levels: null };
  if (r < 0.48) return { name: 'taper', levels: [[0, 1, 0], [0.5, rng.range(0.9, 0.97), 0], [1, rng.range(0.72, 0.86), 0]] };
  if (r < 0.7) { const t = rng.range(0.35, tall ? 1.2 : 0.8) * (rng.chance(0.5) ? 1 : -1); return { name: 'twist', levels: [[0, 1, 0], [0.5, rng.range(0.9, 1), t * 0.5], [1, rng.range(0.9, 1), t]] }; }
  if (r < 0.86) { const w = rng.range(0.74, 0.86); return { name: 'hourglass', levels: [[0, 1, 0], [0.5, w, 0], [1, rng.range(0.94, 1.02), 0]] }; }
  return { name: 'bulge', levels: [[0, 0.86, 0], [0.45, 1, 0], [1, rng.range(0.78, 0.9), 0]] };
}
// Ground floor: glass lobby with doors, soft lit shop signs, sometimes EV bays.
function groundFloor(kit, lot, s, plan, look, rng, o = {}) {
  const neon = lot.district === 'neon';
  const lobby = kit.body({ x: s.x, z: s.z, rot: s.rot, plan, a: s.a - 0.5, b: s.b - 0.5, y0: kit.curb, y1: kit.curb + LOBBY, kind: 1, bay: 3, floorH: LOBBY, tint: look.glass, lo: true });
  if (lot.playable) {
    const shops = neon || rng.chance(0.6);
    if (shops && plan !== 'circle') {
      // signs sit on the flat part of the front, between the round corners
      const span = (2 * s.a * (plan === 'soft' ? 0.72 : 0.42)) / lobby.per;
      const n = Math.max(1, Math.min(4, Math.round((span * lobby.per) / 4.5)));
      for (let i = 0; i < n; i++) {
        if (rng.chance(0.8)) kit.signOn(lobby, ((i + 0.5) / n - 0.5) * span, kit.curb + 3.6, Math.min(3.8, (span * lobby.per) / n - 0.5), 0.85, rng.range(0.3, 0.5), neon && rng.chance(0.4));
      }
      kit.ctx.shopLights.push({ x: local(s, 0, s.b + 1.2)[0], z: local(s, 0, s.b + 1.2)[1], r: s.a * 0.8 + 3, power: neon ? 0.45 : 0.3 });
    }
    kit.doorOn(lobby, plan === 'circle' ? 0 : rng.range(-0.04, 0.04), 2.2, 2.9, 0);
    if (!o.noEv && rng.chance(0.3)) kit.evBays(lobby, 0.44, 0.56, s.a > 9 ? 2 : 1);
    kit.contactShadow(lobby);
  }
  return lobby;
}
// What stands on the roof.
function roofOf(kit, lot, sf, rng, o = {}) {
  const crown = lot.district === 'crown';
  const big = Math.min(sf.frameAt(sf.y1).a, sf.frameAt(sf.y1).b) > 7.5;
  const pad = big && rng.chance(crown ? 0.6 : 0.12);
  kit.roof(sf, {
    hedge: lot.playable && rng.chance(0.6), trees: lot.playable ? rng.int(0, big ? 4 : 2) : 0, far: !lot.playable,
    helipad: pad, dronePad: !pad && lot.playable && rng.chance(0.3), solar: rng.chance(0.5) ? rng.range(0.2, 0.5) : 0,
    plate: o.plate || (rng.chance(0.3) ? rng.range(1.06, 1.16) : 0), plateColor: o.color, ac: rng.int(0, 1),
  });
}
const summary = (type, floors, look, sf, top) => ({ type, floors, ci: look ? look.ci : -1, gi: look ? look.gi : -1, rect: sf ? sf.aabb() : null, top });

export const TYPES = {
  // =========================================================================
  // TOWER: a stack of rounded slabs (straight, tapered, twisted, hourglass, bulge)
  // =========================================================================
  tower: {
    w: [18, 32], d: [18, 30],
    build(kit, lot, rng) {
      const s = siteOf(lot, rng.range(1.6, 3.2));
      const crown = lot.district === 'crown';
      const floors = pickFloors(rng, lot, 6, 12);
      const look = pickLook(rng, lot);
      const plan = lot.diag ? rng.pick(['circle', 'round']) : rng.pick(['soft', 'round', 'round', 'circle']);
      if (plan === 'circle') { const m = Math.min(s.a, s.b * 1.3); s.a = m; s.b = Math.min(s.b, m); }
      const prof = pickProfile(rng, floors > 14);
      const lobby = groundFloor(kit, lot, s, plan, look, rng);
      const y0 = kit.curb + LOBBY, y1 = y0 + floors * FLOOR;
      const sf = kit.body({ x: s.x, z: s.z, rot: s.rot, plan, a: s.a, b: s.b, y0, y1, levels: prof.levels, tint: look.glass, bay: rng.range(1.4, 2.0), lo: true, steps: prof.levels ? Math.max(3, Math.round(floors / 2.2)) : 1 });
      if (lot.playable) {
        // floor slabs: thin lines on some towers, deep white balcony trays on others
        const deep = rng.chance(0.45);
        const wave = plan === 'circle' && rng.chance(0.4);
        kit.slabs(sf, { y0, y1, thick: wave ? 1.1 : deep ? rng.range(0.4, 0.6) : 0.32, grow: wave ? 1 : deep ? rng.range(1.04, 1.09) : 1.012, color: look.frame, wave, rail: deep && !wave && plan !== 'soft' && rng.chance(0.5) });
        if (!wave && rng.chance(0.6)) kit.fins(sf, { every: rng.int(1, 2), depth: rng.range(0.25, 0.45), color: look.frame, y0: y0 + 0.4 });
        // ribbon frames on straight sides
        if (!prof.levels && plan !== 'circle' && rng.chance(0.6)) {
          const kind = rng.pick(['S', 'sweep', 'portal']);
          kit.faceRibbon(sf, 0, kind, { color: look.frame });
          if (rng.chance(0.5)) kit.faceRibbon(sf, rng.pick([1, 2, 3]), rng.pick(['S', 'sweep']), { color: look.frame });
        }
        // one to three planted floors (hanging gardens)
        for (let k = rng.int(0, crown ? 4 : 2); k > 0; k--) kit.planted(sf, y0 + rng.int(1, floors - 1) * FLOOR, { grow: deep ? 1.06 : 1.02, share: 0.7, hang: deep ? 0.9 : 0.3 });
      }
      roofOf(kit, lot, sf, rng, { color: look.frame });
      kit.collide(lobby.aabb(), y1);
      return summary('tower', floors, look, sf, y1);
    },
  },

  // =========================================================================
  // TRAYS: thick planted trays every two floors, green wall, ribbons (like b03)
  // =========================================================================
  trays: {
    w: [18, 30], d: [18, 28],
    build(kit, lot, rng) {
      const s = siteOf(lot, rng.range(2.4, 3.6));
      const tiers = lot.district === 'crown' ? rng.int(6, 12) : rng.int(2, 5);
      const look = pickLook(rng, lot);
      const plan = rng.pick(['round', 'round', 'soft']);
      const lobby = groundFloor(kit, lot, s, plan, look, rng);
      const y0 = kit.curb + LOBBY, y1 = y0 + tiers * 2 * FLOOR;
      const sf = kit.body({ x: s.x, z: s.z, rot: s.rot, plan, a: s.a, b: s.b, y0, y1, tint: look.glass, bay: 1.4, lo: true });
      const col = rng.chance(0.6) ? kit.C.concrete : look.frame;
      if (lot.playable) {
        kit.slabs(sf, { y0, y1: y1 - 1, step: 2 * FLOOR, thick: 0.9, grow: rng.range(1.08, 1.13), color: col });
        for (let t = 0; t < tiers; t++) {
          kit.planted(sf, y0 + t * 2 * FLOOR, { grow: 1.07, vines: 0.55, hang: 1.2 });
          if (plan !== 'circle' && rng.chance(0.7)) kit.faceRibbon(sf, t % 4, 'sweep', { y0: y0 + t * 2 * FLOOR + 0.6, y1: y0 + (t + 1) * 2 * FLOOR - 0.9, color: col });
        }
        kit.fins(sf, { depth: 0.34, width: 0.07, color: look.frame });
        // a green wall on one side
        const u = rng.pick([0.2, 0.45, 0.7]);
        kit.patch(sf, u, u + 0.14, y0 + 1, y0 + Math.min(tiers, 3) * 2 * FLOOR - 1, { mat: 'green', out: 0.3, cols: 3 });
      }
      roofOf(kit, lot, sf, rng, { plate: rng.range(1.12, 1.18), color: col });
      kit.collide(lobby.aabb(), y1);
      return summary('trays', tiers * 2, look, sf, y1);
    },
  },

  // =========================================================================
  // STEPS: floors that step back into garden terraces (like b05, but one house)
  // =========================================================================
  steps: {
    w: [18, 30], d: [18, 28],
    build(kit, lot, rng) {
      const s = siteOf(lot, rng.range(1.8, 3));
      const n = lot.district === 'crown' ? rng.int(5, 8) : rng.int(3, 5);
      const look = pickLook(rng, lot);
      const plan = rng.pick(['round', 'soft']);
      const warm = rng.chance(0.5);
      const each = lot.district === 'crown' ? 3 : rng.int(1, 2); // floors per step
      const lobby = groundFloor(kit, lot, s, plan, look, rng);
      let y = kit.curb + LOBBY, sf = null;
      const shrink = Math.min(1.5, (Math.min(s.a, s.b) - 5) / n);
      for (let i = 0; i < n; i++) {
        const solid = rng.chance(0.3);
        sf = kit.body({
          x: s.x, z: s.z, rot: s.rot, plan, a: s.a - i * shrink, b: s.b - i * shrink * 0.8, y0: y, y1: y + each * FLOOR,
          levels: [[0, 1, 0, 0, -i * shrink * 0.7], [1, 1, 0, 0, -i * shrink * 0.7]], steps: 1, lo: true,
          ...(solid ? { mat: 'panel', tint: warm ? kit.C.wood : kit.C.graphite, kind: 2 } : { tint: look.glass, bay: 1.6 }),
        });
        if (lot.playable) {
          kit.slabs(sf, { y0: y + 0.02, y1: y + each * FLOOR, thick: 0.42, grow: 1.07, color: warm ? kit.C.graphite : look.frame });
          if (i > 0) kit.planted(sf, y, { grow: 1.1, vines: 0.6, hang: 0.4 });
        }
        y += each * FLOOR;
      }
      roofOf(kit, lot, sf, rng, { color: look.frame });
      kit.collide(lobby.aabb(), y);
      return summary('steps', n * each, look, lobby, y);
    },
  },

  // =========================================================================
  // PODIUM: wide glass podium, slimmer tower on top, thin roof wing (like b04)
  // =========================================================================
  podium: {
    w: [22, 34], d: [20, 30],
    build(kit, lot, rng) {
      const s = siteOf(lot, rng.range(1.6, 2.6));
      const floors = pickFloors(rng, lot, 6, 11);
      const look = pickLook(rng, lot);
      const plan = rng.pick(['round', 'soft']);
      const lobby = groundFloor(kit, lot, s, plan, look, rng);
      const y0 = kit.curb + LOBBY, yp = y0 + rng.int(2, 3) * FLOOR, y1 = y0 + floors * FLOOR;
      const pod = kit.body({ x: s.x, z: s.z, rot: s.rot, plan, a: s.a, b: s.b, y0, y1: yp, tint: look.glass, bay: 2.2, lo: true, levels: [[0, 0.96, 0], [0.5, 1.02, 0], [1, 0.96, 0]], steps: 3 });
      const prof = pickProfile(rng, floors > 14);
      const k = rng.range(0.62, 0.78);
      const sf = kit.body({ x: s.x, z: s.z, rot: s.rot, plan: rng.pick([plan, 'round', 'circle']), a: s.a * k, b: s.b * k, y0: yp, y1, levels: prof.levels, tint: look.glass, bay: 1.6, lo: true, steps: prof.levels ? Math.max(3, Math.round(floors / 2.5)) : 1 });
      kit.cap(pod, yp, { color: kit.C.roof });
      if (lot.playable) {
        kit.slabs(pod, { y0, y1: yp, step: yp - y0, thick: 0.8, grow: 1.03, color: look.frame });
        if (plan !== 'circle') kit.faceRibbon(pod, 0, 'portal', { color: look.frame, wide: 0.9, depth: 0.5 });
        kit.planted(pod, yp, { grow: 0.97, vines: 0.3, hang: 0.5 });
        kit.slabs(sf, { y0: yp + FLOOR, y1, thick: 0.32, grow: 1.012, color: look.frame });
        if (rng.chance(0.6)) kit.fins(sf, { every: 2, depth: 0.35, color: look.frame });
      }
      roofOf(kit, lot, sf, rng, { plate: rng.range(1.15, 1.25), color: look.frame });
      kit.collide(lobby.aabb(), y1);
      return summary('podium', floors, look, pod, y1);
    },
  },

  // =========================================================================
  // WAVE: oval tower with a wave balcony on every floor (like b06)
  // =========================================================================
  wave: {
    w: [22, 34], d: [20, 28],
    build(kit, lot, rng) {
      const s = siteOf(lot, rng.range(2.4, 3.4));
      const floors = pickFloors(rng, lot, 6, 11);
      const look = pickLook(rng, lot);
      const lobby = groundFloor(kit, lot, { ...s, a: s.a - 1.5, b: s.b - 1.5 }, 'circle', look, rng);
      const y0 = kit.curb + LOBBY, y1 = y0 + floors * FLOOR;
      const sf = kit.body({ x: s.x, z: s.z, rot: s.rot, plan: 'circle', a: s.a, b: s.b, y0, y1, tint: look.glass, bay: 1.6, lo: true });
      if (lot.playable) {
        kit.slabs(sf, { y0: y0 + 0.4, y1, thick: 1.12, grow: 1, wave: true, color: rng.chance(0.75) ? kit.C.white : look.frame });
        kit.parts.slab.circle.add(s.x, y0 - 0.1, s.z, Math.sin(s.rot), Math.cos(s.rot), s.a * 1.22, 0.45, s.b * 1.22, null, kit.C.white);
        kit.planted(sf, y0 + 0.45, { grow: 1.05, share: 0.6, vines: 0.5 });
        if (rng.chance(0.5)) kit.patch(sf, 0.44, 0.56, y0 + 2, y1 - 3, { mat: 'green', out: 1.6, cols: 3 });
      }
      roofOf(kit, lot, sf, rng, { color: kit.C.white });
      kit.collide(lobby.aabb(), y1);
      return summary('wave', floors, look, sf, y1);
    },
  },

  // =========================================================================
  // ARCADE: low curved shop building under a floating canopy (like b09)
  // =========================================================================
  arcade: {
    w: [26, 44], d: [15, 21],
    build(kit, lot, rng) {
      const s = siteOf(lot, 2.2);
      const look = pickLook(rng, lot);
      const floors = rng.int(1, 2);
      const base = { x: s.x, z: s.z, rot: s.rot, plan: 'round', a: s.a, b: s.b, tint: look.glass, lo: true };
      const shops = kit.body({ ...base, y0: kit.curb, y1: kit.curb + LOBBY, kind: 1, bay: 3.2, floorH: LOBBY });
      const y1 = kit.curb + LOBBY + floors * 3.8;
      const up = kit.body({ ...base, y0: kit.curb + LOBBY, y1, bay: 1.6, floorH: 3.8 });
      if (lot.playable) {
        kit.slabs(up, { y0: kit.curb + LOBBY, y1, step: 3.8, thick: 0.4, grow: 1.04, color: look.frame });
        const span = (2 * s.a * 0.42) / shops.per, n = Math.max(2, Math.round((span * shops.per) / 4.2));
        for (let i = 0; i < n; i++) {
          const u = ((i + 0.5) / n - 0.5) * span;
          kit.signOn(shops, u, kit.curb + 3.7, Math.min(3.4, (span * shops.per) / n - 0.5), 0.82, rng.range(0.35, 0.5), rng.chance(0.3));
          if (i % 2 === 0) kit.doorOn(shops, u + 0.008, 1.9, 2.8, 0);
        }
        // floating canopy on slim columns
        const posts = [];
        for (let i = 0; i < 8; i++) { const p = up.at((i + 0.5) / 8, 0); posts.push([p.x + p.nx * 1.4, p.z + p.nz * 1.4]); }
        kit.columns(posts, kit.curb, y1 + 2.6, 0.16, kit.C.white);
        kit.parts.slab.round.add(s.x, y1 + 2.6, s.z, Math.sin(s.rot), Math.cos(s.rot), s.a * 1.14, 0.35, s.b * 1.3, null, kit.C.white);
        kit.cap(up, y1 + 2.9, { grow: 1.1, color: kit.C.light });
        kit.cap(up, y1 + 2.62, { grow: 1.1, down: true, color: kit.C.white });
        if (rng.chance(0.6)) kit.patch(up, 0.2, 0.3, kit.curb + 0.5, y1 - 0.2, { mat: 'green', out: 0.3, cols: 3 });
        kit.ctx.shopLights.push({ x: local(s, 0, s.b + 2)[0], z: local(s, 0, s.b + 2)[1], r: s.a * 0.7 + 4, power: 0.5 });
        kit.contactShadow(shops);
      }
      kit.roof(up, { hedge: lot.playable, trees: lot.playable ? rng.int(1, 3) : 0, far: !lot.playable });
      kit.collide(shops.aabb(), y1);
      return summary('arcade', floors + 1, look, shops, y1 + 3);
    },
  },

  // =========================================================================
  // RETROFIT: an old brick house that got a new glass top, green walls, bronze trim
  // =========================================================================
  retrofit: {
    w: [16, 26], d: [16, 24],
    build(kit, lot, rng) {
      const m = rng.range(1.2, 2.4), r = lot.rect;
      const box = { minX: r.minX + m, maxX: r.maxX - m, minZ: r.minZ + m, maxZ: r.maxZ - m };
      const old = rng.int(3, 6), add = rng.int(2, 5);
      const look = pickLook(rng, lot);
      const brick = kit.brickBox(box, old, { tint: rng.pick(BRICK_TINTS), rng });
      const s = siteOf(lot, m);
      // the new part: a rounded glass body on the old roof, set back a little
      const k = rng.range(0.6, 0.86);
      const dx = rng.range(-1, 1) * s.a * (1 - k) * 0.8, dz = rng.range(-1, 1) * s.b * (1 - k) * 0.8;
      const top = brick.top + add * FLOOR;
      const sf = kit.body({
        x: s.x, z: s.z, rot: s.rot, plan: rng.pick(['round', 'round', 'circle']), a: s.a * k, b: s.b * k, y0: brick.top, y1: top,
        levels: [[0, 1, 0, dx, dz], [1, rng.range(0.85, 1), rng.range(-0.3, 0.3), dx, dz]], steps: 2, tint: look.glass, bay: 1.5, lo: true,
      });
      const trim = rng.chance(0.6) ? kit.C.bronze : look.frame;
      if (lot.playable) {
        kit.slabs(sf, { y0: brick.top + 0.02, y1: top, thick: 0.38, grow: 1.08, color: trim, rail: rng.chance(0.5) });
        kit.planted(sf, brick.top + 0.05, { grow: 1.12, vines: 0.7, hang: 1.5 });
        if (rng.chance(0.5)) kit.planted(sf, brick.top + rng.int(1, add - 1) * FLOOR, { grow: 1.1, share: 0.6, vines: 0.5 });
      }
      roofOf(kit, lot, sf, rng, { color: trim });
      kit.collide(box, top);
      return { type: 'retrofit', floors: old + add + 1, ci: look.ci, gi: look.gi, rect: box, top };
    },
  },

  // =========================================================================
  // PLAZA: a small green square with trees, planters and EV chargers
  // =========================================================================
  plaza: {
    w: [16, 26], d: [16, 24], open: true,
    build(kit, lot, rng) {
      const s = siteOf(lot, 2), ctx = kit.ctx;
      for (let i = 0; i < Math.round((s.a * s.b) / 22); i++) {
        const p = local(s, rng.range(-s.a, s.a), rng.range(-s.b, s.b * 0.6));
        ctx.roofTrees.push({ x: p[0], y: kit.curb, z: p[1], s: rng.range(0.85, 1.3), trunk: true, pit: true });
        ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.28 });
      }
      for (let i = 0; i < 4; i++) {
        const p = local(s, (i - 1.5) * (s.a / 2.2), s.b - 0.8), sc = rng.range(1.0, 1.5);
        kit.parts.planter.add(p[0], kit.curb, p[1], Math.sin(s.rot), Math.cos(s.rot));
        kit.parts.shrub.add(p[0], kit.curb + 0.5, p[1], 0, 1, sc, sc, sc);
        ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.7 });
      }
      // a row of fast chargers at the back, under a thin solar canopy
      const n = Math.max(2, Math.round(s.a / 3));
      const posts = [];
      for (let i = 0; i < n; i++) {
        const p = local(s, (i - (n - 1) / 2) * 3, -s.b + 1.6);
        kit.parts.charger.add(p[0], kit.curb, p[1], Math.sin(s.rot), Math.cos(s.rot), 1, 1, 1, null, [0.1, 0.5, 0.45]);
        ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.5 });
        if (i === 0 || i === n - 1) posts.push(local(s, (i - (n - 1) / 2) * 3 + (i === 0 ? -1.2 : 1.2), -s.b + 0.8));
      }
      kit.columns(posts, kit.curb, kit.curb + 3.6, 0.12, kit.C.light);
      const c = local(s, 0, -s.b + 1.8);
      kit.parts.solar.add(c[0], kit.curb + 3.6, c[1], Math.sin(s.rot), Math.cos(s.rot), n * 3 + 2.4, 0.14, 4.2);
      ctx.lotLamps.push({ x: local(s, 0, 0)[0], z: local(s, 0, 0)[1], rot: s.rot });
      return { type: 'plaza', floors: 0, ci: -1, gi: -1, rect: null, top: 0 };
    },
  },
};

// ---------------------------------------------------------------------------
// Which type goes on the next lot? "c" describes the place:
//   c.district 'grid' | 'neon' | 'crown',  c.edgeType 'street' | 'avenue' | 'neon' | 'alley'
//   c.space    meters of street front that are still free
//   c.prevType type of the lot before (never the same type twice in a row)
//   c.openUsed this block already has a plaza
// The numbers are weights: a higher number is picked more often.
// In The Grid about 15% of the buildings are old brick retrofits.
// ---------------------------------------------------------------------------
export function pickType(rng, c) {
  const list = [];
  const add = (id, weight) => {
    const t = TYPES[id];
    if (weight <= 0 || t.w[0] > c.space + 0.01 || id === c.prevType) return;
    if (t.open && (c.openUsed || !c.playable || c.edgeType === 'alley')) return;
    list.push([id, weight]);
  };
  if (c.district === 'crown') {
    add('tower', 8); add('podium', 3); add('trays', 1.5); add('steps', 1.5);
  } else if (c.district === 'neon') {
    add('wave', 3); add('arcade', c.edgeType === 'neon' ? 3 : 1); add('tower', 3); add('podium', 2); add('trays', 2); add('steps', 1.5); add('plaza', 0.5);
  } else {
    add('tower', 4.4); add('trays', 2.6); add('steps', 2.6); add('podium', 1.8); add('retrofit', 2.3); add('plaza', 0.6);
  }
  if (!list.length) {
    for (const id of ['retrofit', 'tower', 'steps']) if (TYPES[id].w[0] <= c.space + 0.01) return id;
    return null;
  }
  let total = 0;
  for (const [, w] of list) total += w;
  let r = rng.next() * total;
  for (const [id, w] of list) { r -= w; if (r <= 0) return id; }
  return list[list.length - 1][0];
}
