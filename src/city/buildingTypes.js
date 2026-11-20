// ---------------------------------------------------------------------------
// buildingTypes.js - the BUILDING TYPES of Port Meridian.
//
// Every type is a small recipe that puts parts from buildingKit.js together:
//
//   walkup     old brick walk-up apartment house, stoop stairs, fire escape
//   stucco     plaster apartment block with balconies (box, L, U, setback top)
//   corner     corner building with a cut corner and the entrance on it
//   shoprow    low row of shops with a long awning and signs
//   office     small office building, stripes of glass and concrete
//   warehouse  warehouse / garage, sawtooth or curved metal roof, big doors
//   house      small old house with a sloped roof and a front yard
//   station    fuel + charging station with a canopy
//   parking    small parking lot with painted lines
//   emptylot   empty lot with a fence, weeds and rubble
//   neonshop   Neon Mile shop house: glass fronts, awnings, lit signs
//
// TO ADD YOUR OWN TYPE: copy one of the entries in TYPES, give it a new name,
// change the recipe, and give it a weight in pickType() at the bottom.
//
// A recipe gets:
//   kit  = the parts (see buildingKit.js)
//   lot  = the piece of land: lot.rect, lot.front, lot.corner, lot.prev ...
//   rng  = random numbers (the same every time, so the city never changes)
// Lot coordinates used below: u runs along the street (0 .. w), v goes back
// into the lot (0 .. d). Outlines are lists of [u, v] points.
// ---------------------------------------------------------------------------

import { FLOOR_H, GROUND_H, BRICK_TINTS, PLASTER_TINTS, NEON_TINTS, METAL_TINTS, varyTint } from './buildingKit.js';

const CONCRETE_TINTS = [[0.74, 0.78, 0.86], [1.12, 1.12, 1.14], [0.95, 0.92, 0.84], [0.6, 0.63, 0.68], [0.86, 0.9, 0.94]];

// A number of floors that is different from the house next door.
function floorsBetween(rng, lo, hi, lot) {
  let f = rng.int(lo, hi);
  if (lot.prev && lot.prev.floors === f) f = f < hi ? f + 1 : Math.max(lo, f - 1);
  return f;
}
// A wall color that is different from the house next door.
function pickTint(rng, lot, palette) {
  let idx = rng.int(0, palette.length - 1);
  if (lot.prev && lot.prev.palette === palette && lot.prev.tintIdx === idx) idx = (idx + 1 + rng.int(0, palette.length - 2)) % palette.length;
  return { tint: varyTint(palette[idx], rng), idx, palette };
}
// How old a building looks: 0 = new and clean, 1 = old and worn.
function pickAge(rng, lo = 0, hi = 1) {
  const r = rng.next();
  const a = r < 0.2 ? rng.range(0, 0.25) : r < 0.65 ? rng.range(0.3, 0.6) : rng.range(0.65, 1);
  return Math.min(hi, Math.max(lo, a));
}
const summary = (floors, mat, lk) => ({ floors, mat, tintIdx: lk ? lk.idx : -1, palette: lk ? lk.palette : null });

// Small front yard between the sidewalk and a house that stands back:
// iron fence with a gap at the door, a few bushes.
function frontYard(kit, B, depth, rng) {
  const { w } = B.loc;
  const door = B.door ?? w / 2;
  const P = (u, v) => B.loc.pt(u, v);
  const run = (ua, va, ub, vb) => {
    if (Math.hypot(ub - ua, vb - va) < 0.6) return;
    const a = P(ua, va), b = P(ub, vb);
    kit.fence(a[0], a[1], b[0], b[1], kit.curb, 1.05, 'picket');
  };
  run(0.1, 0.12, door - 1.25, 0.12);
  run(door + 1.25, 0.12, w - 0.1, 0.12);
  if (B.side.left !== 'front') run(0.08, 0.12, 0.08, depth);
  if (B.side.right !== 'front') run(w - 0.08, 0.12, w - 0.08, depth);
  for (let u = 0.9; u < w - 0.7; u += rng.range(1.3, 2.3)) {
    if (Math.abs(u - door) < 1.5 || !rng.chance(0.6)) continue;
    const p = P(u, depth - 0.6), s = rng.range(0.8, 1.3);
    kit.parts.shrub.add(p[0], kit.curb, p[1], 0, 1, s, s, s);
  }
  kit.lotDecal(B, 'dirt', w / 2, depth / 2, w - 0.8, Math.max(0.6, depth - 0.5), 0.55);
}

// Chain-link fence along the sides of an open lot that are not closed by a neighbour's wall.
function fenceOpenSides(kit, B, kind = 'chain', h = 2.0) {
  const { w, d } = B.loc;
  const P = (u, v) => B.loc.pt(u, v);
  const run = (ua, va, ub, vb) => { const a = P(ua, va), b = P(ub, vb); kit.fence(a[0], a[1], b[0], b[1], kit.curb, h, kind); };
  if (B.side.left === 'back' || B.side.left === 'gap') run(0.1, 0.1, 0.1, d - 0.1);
  if (B.side.right === 'back' || B.side.right === 'gap') run(w - 0.1, 0.1, w - 0.1, d - 0.1);
  if (B.side.back === 'back' || B.side.back === 'gap') run(0.1, d - 0.1, w - 0.1, d - 0.1);
}

export const TYPES = {
  // =========================================================================
  // a) OLD BRICK WALK-UP: 3 to 5 floors, stoop, fire escape, stone trim
  // =========================================================================
  walkup: {
    w: [6.5, 12], d: [11, 16],
    build(kit, lot, rng) {
      const floors = floorsBetween(rng, 3, lot.low ? 4 : 5, lot);
      const lk = pickTint(rng, lot, BRICK_TINTS);
      const B = kit.begin(lot, { mat: 'brick', tint: lk.tint, age: pickAge(rng, 0.35), rng });
      const { w, d } = B.loc;
      const street = B.side.front === 'front';
      // most walk-ups stand back a little: room for the stoop and a tiny yard
      const yard = street && lot.edgeType === 'street' && d > 12.5 && rng.chance(0.75) ? 2.3 : 0;
      const sloped = floors <= 3 && rng.chance(0.3);
      const o = {
        groundH: yard ? 0.9 + FLOOR_H : 0.4 + FLOOR_H, floors: floors - 1, style: 2, bayW: rng.range(2.25, 2.7), ground: 'res',
        parapet: sloped ? 0 : rng.range(0.6, 1.1), cornice: sloped ? false : rng.chance(0.65) ? 'big' : true,
        bands: rng.chance(0.45), quoins: rng.chance(0.5), sill: true, lintel: true,
        fireEscape: street && (floors >= 4 ? rng.chance(0.7) : rng.chance(0.3)), ac: 0.1,
      };
      // some walk-ups have a bay window that sticks out over the street
      const bay = street && w > 7.5 && rng.chance(0.3);
      if (bay) o.fireEscape = false;
      const r = kit.volume(B, [[0, yard], [w, yard], [w, d], [0, d]], o);
      if (bay) {
        const bw = 2.7, bu = rng.chance(0.5) ? 0.7 : w - bw - 0.7;
        kit.bayWindow(B, bu, bu + bw, yard, o.groundH, floors - 1, o);
      }
      kit.collide(B, 0, yard, w, d, r.top + o.parapet);
      if (sloped) kit.roofGable(B, [0, yard, w, d], r.top, { ridgeAlong: 'u' });
      else {
        kit.roofFlat(B, [r], r.top);
        kit.roofStuff(B, r, r.top, { old: true, hut: true });
      }
      if (yard) frontYard(kit, B, yard, rng);
      kit.finish(B, r, r.top + o.parapet);
      return summary(floors, 'brick', lk);
    },
  },

  // =========================================================================
  // b) PLASTER APARTMENT BLOCK: 4 to 8 floors, balconies, several shapes
  // =========================================================================
  stucco: {
    w: [10, 26], d: [12, 19],
    build(kit, lot, rng) {
      const neon = lot.district === 'neon';
      const floors = floorsBetween(rng, lot.low ? 3 : 4, lot.low ? 4 : neon ? 6 : 8, lot);
      const lk = pickTint(rng, lot, neon ? NEON_TINTS : PLASTER_TINTS);
      const B = kit.begin(lot, { mat: 'plaster', tint: lk.tint, age: pickAge(rng), rng });
      const { w, d } = B.loc;
      const street = B.side.front === 'front';
      const shops = street && rng.chance(neon ? 0.85 : 0.55);
      // which window bays have balconies: none, all, every second one, or the two outer ones
      const pat = rng.int(0, 3);
      const cols = pat === 1 ? () => true : pat === 2 ? (i) => i % 2 === 0 : (i, n) => i === 0 || i === n - 1;
      const parapet = rng.range(0.5, 1.0);
      const o = {
        groundH: shops ? GROUND_H : 0.4 + FLOOR_H, floors: floors - 1, style: 1, bayW: rng.range(3.2, 3.9),
        ground: shops ? 'shops' : 'res', neon: neon && lot.edgeType === 'neon', parapet, bands: rng.chance(0.6), sill: true, surround: rng.chance(0.35),
        balcony: pat ? { cols, kind: rng.chance(0.5) ? 'solid' : 'rail', from: rng.chance(0.3) ? 1 : 0 } : null, ac: 0.07,
      };
      const shape = w >= 22 && d >= 15 && street && rng.chance(0.55) ? 'U'
        : w >= 16 && d >= 15.5 && rng.chance(0.5) ? 'L'
          : floors >= 6 && d >= 13 && rng.chance(0.55) ? 'setback' : 'box';
      let top, rects, r;
      if (shape === 'U') {
        // two wings and a courtyard that opens to the street
        const a = rng.range(6, 7.5), c = Math.min(d - 6, rng.range(5, 7));
        const inner = { ground: 'plainwall', balcony: null, fireEscape: false };
        r = kit.volume(B, [[0, 0], [a, 0], [a, c], [w - a, c], [w - a, 0], [w, 0], [w, d], [0, d]],
          { ...o, kinds: [null, 'front', null, 'front'], per: { 1: inner, 3: inner } });
        rects = [B.loc.rect(0, 0, a, d), B.loc.rect(w - a, 0, w, d), B.loc.rect(a, c, w - a, d)];
        kit.collide(B, 0, 0, a, d, r.top);
        kit.collide(B, w - a, 0, w, d, r.top);
        kit.collide(B, a, c, w - a, d, r.top);
        // the courtyard: planters with bushes, a low railing with a gate gap
        for (let u = a + 1.2; u < w - a - 1; u += 2.6) {
          if (Math.abs(u - w / 2) < 1.6) continue;
          const p = B.loc.pt(u, c - 1.1), s = rng.range(1.0, 1.5);
          kit.parts.planter.add(p[0], kit.curb, p[1], B.loc.f.nx, B.loc.f.nz);
          kit.parts.shrub.add(p[0], kit.curb + 0.5, p[1], 0, 1, s, s, s);
          kit.collide(B, u - 0.7, c - 1.4, u + 0.7, c - 0.8, 1);
        }
        for (const [ua, ub] of [[a + 0.2, w / 2 - 1.1], [w / 2 + 1.1, w - a - 0.2]]) {
          const p = B.loc.pt(ua, 0.15), q = B.loc.pt(ub, 0.15);
          kit.fence(p[0], p[1], q[0], q[1], kit.curb, 1.0, 'bars');
        }
        top = r.top;
      } else if (shape === 'L') {
        // a wing at the street and a second wing going back
        const a = rng.range(w * 0.4, w * 0.55), c = rng.range(8, 10);
        const right = rng.chance(0.5);
        r = kit.volume(B, right ? [[0, 0], [w, 0], [w, d], [a, d], [a, c], [0, c]] : [[0, 0], [w, 0], [w, c], [w - a, c], [w - a, d], [0, d]], o);
        rects = [B.loc.rect(0, 0, w, c), right ? B.loc.rect(a, c, w, d) : B.loc.rect(0, c, w - a, d)];
        kit.collide(B, 0, 0, w, c, r.top);
        if (right) kit.collide(B, a, c, w, d, r.top); else kit.collide(B, 0, c, w - a, d, r.top);
        top = r.top;
      } else if (shape === 'setback') {
        // the top floors stand back behind a roof terrace
        const k = rng.int(1, 2), sb = rng.range(2.4, 3.2);
        const low = kit.volume(B, [[0, 0], [w, 0], [w, d], [0, d]], { ...o, floors: floors - 1 - k, parapet: 0, per: { 0: { parapet: 1.0 } }, roof: 'none' });
        kit.roofFlat(B, [B.loc.rect(0, 0, w, sb)], low.top);
        r = kit.volume(B, [[0, sb], [w, sb], [w, d], [0, d]], { ...o, y0: low.top, groundH: 0, floors: k, balcony: null, bands: false });
        rects = [B.loc.rect(0, sb, w, d)];
        kit.collide(B, 0, 0, w, d, r.top);
        top = r.top;
        r = { ...r, ...B.loc.rect(0, 0, w, d) };
      } else {
        r = kit.volume(B, [[0, 0], [w, 0], [w, d], [0, d]], o);
        rects = [r];
        kit.collide(B, 0, 0, w, d, r.top);
        top = r.top;
      }
      kit.roofFlat(B, rects, top);
      for (const rc of rects) kit.roofStuff(B, rc, top, { old: B.age > 0.6, hut: floors < 5, shops });
      // tall blocks: a stair and lift tower that rises above the roof
      if (floors >= 5 && shape !== 'U' && rng.chance(0.6)) {
        const t = kit.volume(B, [[w - 4.2, d - 4.6], [w - 0.5, d - 4.6], [w - 0.5, d - 0.5], [w - 4.2, d - 0.5]],
          { y0: top, groundH: 0, floors: 1, style: 0, parapet: 0.3, kinds: ['back', 'back', 'back', 'back'] });
        kit.roofFlat(B, [t], t.top);
      }
      // Neon Mile: a glowing name or a hologram on the roof
      if (lot.edgeType === 'neon' && shape === 'box' && w > 9) {
        const roll = rng.next();
        if (roll < 0.4) kit.roofSign(B, B.loc.frame(0, 0, w, 0), top + parapet, rng);
        else if (roll < 0.55) kit.hologram(B, B.loc.frame(0, 0, w, 0), top + parapet, rng);
      }
      kit.finish(B, r, top + parapet);
      return summary(floors, 'plaster', lk);
    },
  },

  // =========================================================================
  // c) CORNER BUILDING: the corner is cut off, the entrance is on the cut
  // =========================================================================
  corner: {
    w: [11, 18], d: [11, 16],
    build(kit, lot, rng) {
      const brick = rng.chance(0.55);
      const neon = lot.district === 'neon';
      const floors = floorsBetween(rng, lot.low ? 3 : 4, lot.low ? 4 : 6, lot);
      const lk = pickTint(rng, lot, brick ? BRICK_TINTS : neon ? NEON_TINTS : PLASTER_TINTS);
      const B = kit.begin(lot, { mat: brick ? 'brick' : 'plaster', tint: lk.tint, age: pickAge(rng, 0.2), rng });
      const { w, d } = B.loc;
      const c = 3.0, left = lot.cornerSide === 'left';
      const pts = left ? [[c, 0], [w, 0], [w, d], [0, d], [0, c]] : [[0, 0], [w - c, 0], [w, c], [w, d], [0, d]];
      const cut = left ? 4 : 1; // number of the cut-corner edge in the outline
      const parapet = rng.range(0.7, 1.2);
      const o = {
        groundH: GROUND_H, floors: floors - 1, style: brick ? 2 : 1, bayW: brick ? rng.range(2.3, 2.7) : rng.range(3.2, 3.8),
        ground: 'shops', neon: neon && lot.edgeType === 'neon', parapet, cornice: brick || rng.chance(0.5) ? 'big' : false, bands: rng.chance(0.6),
        sill: true, lintel: brick, surround: !brick && rng.chance(0.4), ac: 0.06,
        per: { [cut]: { ground: 'entry', bayW: brick ? 2.0 : 3.4 } },
      };
      const r = kit.volume(B, pts, o);
      // collision: two boxes and a row of circles along the cut corner
      if (left) {
        kit.collide(B, c, 0, w, d, r.top);
        kit.collide(B, 0, c, c, d, r.top);
        kit.collideSlant(B, 0, c, c, 0);
      } else {
        kit.collide(B, 0, 0, w - c, d, r.top);
        kit.collide(B, w - c, c, w, d, r.top);
        kit.collideSlant(B, w - c, 0, w, c);
      }
      kit.roofPoly(B, pts, r.top);
      kit.roofStuff(B, left ? B.loc.rect(c, 1, w, d) : B.loc.rect(0, 1, w - c, d), r.top, { old: B.age > 0.55, hut: true, shops: true });
      kit.finish(B, r, r.top + parapet);
      return summary(floors, B.mat, lk);
    },
  },

  // =========================================================================
  // d) LOW SHOP ROW: 1 or 2 floors, long awning, signs
  // =========================================================================
  shoprow: {
    w: [13, 30], d: [9, 13],
    build(kit, lot, rng) {
      const neon = lot.district === 'neon';
      const floors = rng.chance(0.6) ? 1 : 2;
      const brick = !neon && rng.chance(0.4);
      const lk = pickTint(rng, lot, brick ? BRICK_TINTS : neon ? NEON_TINTS : PLASTER_TINTS);
      const B = kit.begin(lot, { mat: brick ? 'brick' : 'plaster', tint: lk.tint, age: pickAge(rng), rng });
      const { w, d } = B.loc;
      const parapet = rng.range(1.0, 1.6);
      const o = {
        groundH: GROUND_H, floors: floors - 1, style: brick ? 2 : 1, bayW: brick ? rng.range(2.4, 2.8) : rng.range(3.3, 3.9),
        ground: 'shops', neon: neon && lot.edgeType === 'neon', longAwning: rng.chance(0.6), upperDoor: floors > 1,
        parapet, bands: floors > 1, sill: true, lintel: brick, cornice: brick && rng.chance(0.4),
      };
      const r = kit.volume(B, [[0, 0], [w, 0], [w, d], [0, d]], o);
      kit.collide(B, 0, 0, w, d, r.top + parapet);
      kit.roofFlat(B, [r], r.top);
      kit.roofStuff(B, r, r.top, { shops: true });
      if (lot.edgeType === 'neon' && rng.chance(0.45)) kit.roofSign(B, B.loc.frame(0, 0, w, 0), r.top + parapet, rng);
      kit.finish(B, r, r.top + parapet);
      return summary(floors, B.mat, lk);
    },
  },

  // =========================================================================
  // e) SMALL OFFICE BUILDING: upright stripes of glass and concrete
  // =========================================================================
  office: {
    w: [12, 24], d: [13, 20],
    build(kit, lot, rng) {
      const floors = floorsBetween(rng, 4, lot.low ? 5 : 8, lot);
      const lk = pickTint(rng, lot, CONCRETE_TINTS);
      const B = kit.begin(lot, { mat: 'plaster', tint: lk.tint, age: pickAge(rng, 0, 0.6), rng });
      const { w, d } = B.loc;
      const fins = rng.chance(0.7);
      const o = {
        groundH: GROUND_H, floors: floors - 1, style: 3, bayW: rng.range(2.8, 3.3), ground: 'office',
        parapet: 0.5, fins, bands: !fins && rng.chance(0.6),
      };
      const r = kit.volume(B, [[0, 0], [w, 0], [w, d], [0, d]], o);
      kit.collide(B, 0, 0, w, d, r.top + 0.5);
      kit.roofFlat(B, [r], r.top);
      // machine room on the roof, set back from the edges
      if (w > 10 && d > 10) {
        const m = kit.volume(B, [[2.6, 3], [w - 2.6, 3], [w - 2.6, d - 3], [2.6, d - 3]],
          { y0: r.top, groundH: 0, floors: 1, style: 0, parapet: 0.2, kinds: ['back', 'back', 'back', 'back'] });
        kit.roofFlat(B, [m], m.top);
        const p = B.loc.pt(w / 2, d / 2);
        kit.parts.antenna.add(p[0], m.top, p[1], 0, 1);
        kit.parts.dish.add(p[0] + 1.5, m.top, p[1] + 1, 0, 1);
      } else kit.roofStuff(B, r, r.top, {});
      kit.finish(B, r, r.top + 0.5);
      return summary(floors, 'plaster', lk);
    },
  },

  // =========================================================================
  // f) WAREHOUSE / GARAGE: big roll-up doors, sawtooth or curved metal roof
  // =========================================================================
  warehouse: {
    w: [15, 28], d: [13, 22],
    build(kit, lot, rng) {
      const metal = rng.chance(0.55);
      const lk = pickTint(rng, lot, metal ? METAL_TINTS : BRICK_TINTS);
      const B = kit.begin(lot, { mat: metal ? 'metal' : 'brick', tint: lk.tint, age: pickAge(rng, 0.35), rng });
      const { w, d } = B.loc;
      const roof = rng.pick(w <= 26 ? ['saw', 'barrel', 'flat'] : ['saw', 'flat']);
      const upper = !metal && roof === 'flat' && rng.chance(0.6); // brick warehouses can have an office floor on top
      const parapet = roof === 'flat' ? rng.range(0.5, 0.9) : 0;
      const o = {
        groundH: upper ? 5.0 : rng.range(5.6, 7.2), floors: upper ? 1 : 0, style: upper ? 2 : 0, bayW: 3.2, ground: 'garage',
        parapet, sill: true, lintel: true, cornice: !metal && roof === 'flat' && rng.chance(0.4),
      };
      const r = kit.volume(B, [[0, 0], [w, 0], [w, d], [0, d]], o);
      let top = r.top + parapet;
      const sheet = metal ? lk.tint.map((c) => c * 0.8) : [0.3, 0.31, 0.32];
      if (roof === 'saw') top = r.top + kit.roofSaw(B, [0, 0, w, d], r.top, { tint: sheet });
      else if (roof === 'barrel') top = r.top + kit.roofBarrel(B, [0, 0, w, d], r.top, { tint: sheet });
      else {
        kit.roofFlat(B, [r], r.top);
        kit.roofStuff(B, r, r.top, { old: true });
      }
      kit.collide(B, 0, 0, w, d, top);
      kit.finish(B, r, top);
      return summary(upper ? 2 : 1.5, B.mat, lk);
    },
  },

  // =========================================================================
  // OLD HOUSE: 2 or 3 floors, sloped roof, chimney, front yard
  // =========================================================================
  house: {
    w: [7, 10.5], d: [9.5, 13],
    build(kit, lot, rng) {
      const floors = rng.int(2, 3);
      const brick = rng.chance(0.5);
      const lk = pickTint(rng, lot, brick ? BRICK_TINTS : PLASTER_TINTS);
      const B = kit.begin(lot, { mat: brick ? 'brick' : 'plaster', tint: lk.tint, age: pickAge(rng, 0.3), rng });
      const { w, d } = B.loc;
      const street = B.side.front === 'front';
      const yard = street && d > 11 ? 2.3 : 0;
      const o = {
        groundH: yard ? 0.9 + FLOOR_H : 0.4 + FLOOR_H, floors: floors - 1, style: 2, bayW: rng.range(2.4, 2.8), ground: 'res',
        parapet: 0, sill: true, lintel: brick, surround: !brick, ac: 0.08,
      };
      const r = kit.volume(B, [[0, yard], [w, yard], [w, d], [0, d]], o);
      // a bay window over the front door side
      if (street && rng.chance(0.35)) kit.bayWindow(B, w / 2 - 1.35, w / 2 + 1.35, yard, o.groundH, floors - 1, o);
      const rise = kit.roofGable(B, [0, yard, w, d], r.top, { ridgeAlong: rng.chance(0.55) ? 'v' : 'u' });
      // brick chimney
      const cu = rng.range(1, w - 1.8), cv = (yard + d) / 2 + rng.range(-1, 1);
      kit.boxUp(B, cu, cv, cu + 0.7, cv + 0.7, r.top, r.top + rise + 0.8, 0.8);
      kit.collide(B, 0, yard, w, d, r.top + rise);
      if (yard) frontYard(kit, B, yard, rng);
      kit.finish(B, r, r.top + rise);
      return summary(floors, B.mat, lk);
    },
  },

  // =========================================================================
  // g) FUEL + CHARGING STATION: canopy, charger islands, small shop
  // =========================================================================
  station: {
    w: [20, 28], d: [16, 22], open: true,
    build(kit, lot, rng) {
      const lk = pickTint(rng, lot, PLASTER_TINTS);
      const B = kit.begin(lot, { mat: 'plaster', tint: lk.tint, age: pickAge(rng, 0, 0.5), rng });
      const { w, d } = B.loc;
      const ctx = kit.ctx, ps = ctx.mb.propStatic, curb = kit.curb;
      kit.lotGround(B, 0, 0, w, d, 0.72);
      const band = rng.pick([[0.05, 0.42, 0.4], [0.5, 0.12, 0.08], [0.1, 0.22, 0.5], [0.55, 0.4, 0.06]]); // company color
      // ---- canopy on four posts ----
      const cw = Math.min(w - 7, 12), u0 = (w - cw) / 2, u1 = u0 + cw, v0 = 2.2, v1 = 9.4, top = 5.2;
      const c = B.loc.rect(u0, v0, u1, v1);
      ps.color(0.62, 0.63, 0.63, 1).data(0.5, 0.1, 0, 0);
      ps.box(c.minX, top, c.minZ, c.maxX, top + 0.55, c.maxZ, 1, 'nsewtb');
      // colored band around the canopy edge (glows a little at night)
      ps.color(band[0], band[1], band[2], 1).data(0.4, 0, 0, 0.5);
      ps.box(c.minX - 0.04, top + 0.1, c.minZ - 0.04, c.maxX + 0.04, top + 0.42, c.maxZ + 0.04, 1, 'nsew');
      // light panels under the canopy
      ps.color(1, 0.96, 0.88, 1).data(0.3, 0, 0, 0.9);
      for (const fu of [0.25, 0.75]) for (const fv of [0.3, 0.7]) {
        const p = B.loc.pt(u0 + cw * fu, v0 + (v1 - v0) * fv);
        ps.box(p[0] - 0.7, top - 0.03, p[1] - 0.35, p[0] + 0.7, top, p[1] + 0.35, 1, 'nsewb');
      }
      const mid = B.loc.pt(w / 2, (v0 + v1) / 2);
      ctx.shopLights.push({ x: mid[0], z: mid[1], r: 11, power: 0.55 });
      for (const pu of [u0 + 0.6, u1 - 0.6]) for (const pv of [v0 + 1.2, v1 - 1.2]) {
        const p = B.loc.pt(pu, pv);
        ps.color(0.5, 0.51, 0.52, 1).data(0.5, 0.4, 0, 0);
        ps.box(p[0] - 0.18, curb, p[1] - 0.18, p[0] + 0.18, top, p[1] + 0.18, 1, 'nsew');
        ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.35 });
      }
      // ---- two islands with chargers, painted bays ----
      const paint = [band[0] * 1.2 + 0.05, band[1] * 1.2 + 0.05, band[2] * 1.2 + 0.05];
      for (const iv of [v0 + 2.0, v1 - 2.0]) {
        const isl = B.loc.rect(u0 + 1.6, iv - 0.45, u1 - 1.6, iv + 0.45);
        B.mb.color(0.78, 0.8, 0.84, 1).data(0, 0, 0, 0.4);
        B.mb.box(isl.minX, curb, isl.minZ, isl.maxX, curb + 0.2, isl.maxZ, 3.4, 'nsewt');
        ctx.colliders.boxes.push({ ...isl, h: 1.9 });
        for (const fu of [0.3, 0.7]) {
          const p = B.loc.pt(u0 + cw * fu, iv);
          kit.parts.charger.add(p[0], curb + 0.2, p[1], B.loc.f.nx, B.loc.f.nz, 1, 1, 1, null, paint);
        }
        for (let u = u0 + 1; u <= u1 - 0.9; u += (cw - 2) / 3) {
          kit.paintLine(B, u, iv - 2.3, u, iv - 0.6);
          kit.paintLine(B, u, iv + 0.6, u, iv + 2.3);
        }
      }
      kit.lotDecal(B, 'oil1', w / 2 - 2, (v0 + v1) / 2, 2.4, 2.0, 0.6, 1, 0.04);
      kit.lotDecal(B, 'oil2', w / 2 + 3, v0 + 1.5, 1.6, 1.6, 0.6, 2, 0.04);
      // ---- small shop at the back ----
      const kw = Math.min(11, w - 6), ku = rng.chance(0.5) ? 1 : w - kw - 1, kd = 6.2;
      const r = kit.volume(B, [[ku, d - kd], [ku + kw, d - kd], [ku + kw, d - 0.4], [ku, d - 0.4]],
        { groundH: 4.2, floors: 0, style: 0, ground: 'shops', upperDoor: false, parapet: 0.7, kinds: ['front', 'back', 'back', 'back'] });
      kit.collide(B, ku, d - kd, ku + kw, d - 0.4, r.top);
      kit.roofFlat(B, [r], r.top);
      kit.roofStuff(B, r, r.top, { shops: true });
      // ---- tall price sign near the street ----
      const su = ku > w / 2 ? 1.6 : w - 1.6;
      const sp = B.loc.pt(su, 1.4);
      ps.color(0.5, 0.51, 0.52, 1).data(0.5, 0.4, 0, 0);
      ps.box(sp[0] - 0.14, curb, sp[1] - 0.14, sp[0] + 0.14, 6.6, sp[1] + 0.14, 1, 'nsew');
      ctx.colliders.circles.push({ x: sp[0], z: sp[1], r: 0.3 });
      const sf = B.loc.frame(su - 1.2, 1.25, su + 1.2, 1.25);
      kit.sign(sf, 1.2, 5.3, 2.4, 0.6, kit.paintedSign(rng), 0.7, 0);
      const sb = B.loc.frame(su + 1.2, 1.55, su - 1.2, 1.55);
      kit.sign(sb, 1.2, 5.3, 2.4, 0.6, kit.paintedSign(rng), 0.7, 0);
      ps.color(band[0], band[1], band[2], 1).data(0.4, 0, 0, 0.6);
      ps.box(Math.min(sp[0] - 1.25, sp[0] + 1.25), 6.0, sp[1] - 0.16, Math.max(sp[0] - 1.25, sp[0] + 1.25), 6.5, sp[1] + 0.16, 1, 'nsewtb');
      fenceOpenSides(kit, B, 'chain', 2.0);
      kit.finish(B, B.loc.rect(ku, d - kd, ku + kw, d - 0.4), r.top);
      return summary(1, 'plaster', lk);
    },
  },

  // =========================================================================
  // g) SMALL PARKING LOT with painted lines
  // =========================================================================
  parking: {
    w: [15, 24], d: [15, 24], open: true,
    build(kit, lot, rng) {
      const B = kit.begin(lot, { mat: 'plaster', tint: [0.8, 0.82, 0.86], age: 0.6, rng });
      const { w, d } = B.loc;
      const ctx = kit.ctx, curb = kit.curb, ff = B.loc.f;
      kit.lotGround(B, 0, 0, w, d, 0.76);
      // parking rows along the left and the right side, cars stand nose to the fence
      const rows = [[0.5, 5.3, 1], [w - 5.3, w - 0.5, -1]];
      for (const [ua, ub, dir] of rows) {
        for (let v = 1.2; v + 2.6 <= d - 0.8; v += 2.6) {
          kit.paintLine(B, ua, v, ub, v);
          if (v + 5.2 > d - 0.8) kit.paintLine(B, ua, v + 2.6, ub, v + 2.6);
          const um = (ua + ub) / 2, vm = v + 1.3;
          // concrete wheel stop at the far end of each bay
          const ws = B.loc.pt(dir > 0 ? ua + 0.5 : ub - 0.5, vm);
          kit.parts.block.add(ws[0], curb + 0.03, ws[1], ff.dx, ff.dz, 1.8, 0.13, 0.22, null, kit.STONE);
          if (rng.chance(0.5)) {
            const p = B.loc.pt(um + dir * 0.2, vm);
            ctx.parked.push({ x: p[0], z: p[1], rot: Math.atan2(-dir * ff.dx, -dir * ff.dz) + rng.range(-0.04, 0.04) });
          }
          if (rng.chance(0.3)) kit.lotDecal(B, 'oil2', um, vm, 1.1, 1.1, 0.7, rng.range(0, 6), 0.04);
        }
      }
      // small booth at the entrance
      const bu = rng.chance(0.5) ? 5.9 : w - 7.5;
      const booth = kit.boxUp(B, bu, 0.6, bu + 1.6, 2.2, curb, curb + 2.5, 1.0);
      ctx.colliders.boxes.push({ ...booth, h: 2.6 });
      const bf = B.loc.frame(bu, 0.6, bu + 1.6, 0.6);
      kit.opening(B, bf, 0.25, 1.35, curb + 1.0, 1.1, 0.05, 0, rng.int(1, 60) + 0.3);
      // one tall lamp in the middle
      const lp = B.loc.pt(w / 2, d / 2);
      ctx.lotLamps.push({ x: lp[0], z: lp[1], rot: Math.atan2(ff.dx, ff.dz) });
      fenceOpenSides(kit, B, 'chain', 2.0);
      kit.finish(B, B.loc.rect(0, 0, w, d), 0);
      return summary(0, 'open', null);
    },
  },

  // =========================================================================
  // h) EMPTY LOT: fence, weeds, rubble
  // =========================================================================
  emptylot: {
    w: [8, 18], d: [10, 18], open: true,
    build(kit, lot, rng) {
      const B = kit.begin(lot, { mat: 'plaster', tint: [1, 1, 1], age: 1, rng });
      const { w, d } = B.loc;
      const ctx = kit.ctx, curb = kit.curb;
      // trodden earth instead of paving
      kit.lotDecal(B, 'patch', w / 2, d / 2, w - 0.3, d - 0.3, 1.0, Math.atan2(B.loc.f.nx, B.loc.f.nz));
      for (let k = 0; k < (w * d) / 22; k++) {
        kit.lotDecal(B, rng.pick(['dirt', 'dirt', 'leak', 'oil1', 'crack1']), rng.range(1.5, w - 1.5), rng.range(1.5, d - 1.5), rng.range(2, 5), rng.range(2, 5), rng.range(0.5, 0.95), rng.range(0, 6.28), 0.014);
      }
      // fence along the street: old boards or chain-link, often with a gap you can walk through
      const planks = rng.chance(0.55), fh = planks ? 2.0 : 2.1;
      const gap = rng.chance(0.6) ? rng.range(1.5, w - 3) : -9;
      const run = (ua, ub) => {
        if (ub - ua < 0.5) return;
        const a = B.loc.pt(ua, 0.15), b = B.loc.pt(ub, 0.15);
        kit.fence(a[0], a[1], b[0], b[1], curb, fh, planks ? 'planks' : 'chain', true, planks ? rng.range(0.7, 1) : 1);
      };
      run(0.05, gap > 0 ? gap : w - 0.05);
      if (gap > 0) run(gap + 1.5, w - 0.05);
      if (planks && B.playable) {
        const f = B.loc.frame(0, 0.15, w, 0.15);
        for (let s = 1.6; s < w - 1.6; s += rng.range(2.6, 5)) {
          if (gap > 0 && s > gap - 1.4 && s < gap + 2.9) continue;
          if (rng.chance(0.7)) kit.graffiti(B, f, s, curb + rng.range(0.3, 0.6), rng.range(1.5, 2.3), rng.range(1.0, 1.4), 0.02);
        }
      }
      fenceOpenSides(kit, B, 'chain', 2.0);
      // weeds everywhere, thicker along the edges
      for (let k = 0; k < (w * d) / 5; k++) {
        let u = rng.range(0.4, w - 0.4), v = rng.range(0.5, d - 0.4);
        if (rng.chance(0.4)) { if (rng.chance(0.5)) u = rng.chance(0.5) ? rng.range(0.3, 1.2) : w - rng.range(0.3, 1.2); else v = d - rng.range(0.3, 1.4); }
        const p = B.loc.pt(u, v), a = rng.range(0, 6.28), s = rng.range(0.6, 1.5);
        kit.parts.weed.add(p[0], curb, p[1], Math.sin(a), Math.cos(a), s, s * rng.range(0.8, 1.3), s);
      }
      // heaps of rubble
      for (let k = rng.int(2, 5); k > 0; k--) {
        const p = B.loc.pt(rng.range(2, w - 2), rng.range(3, d - 2)), a = rng.range(0, 6.28), s = rng.range(0.8, 1.5);
        kit.parts.rubble.add(p[0], curb, p[1], Math.sin(a), Math.cos(a), s, s, s);
        ctx.colliders.circles.push({ x: p[0], z: p[1], r: 0.8 * s });
        if (B.playable) kit.groundShadow(p[0], p[1], 2.4 * s);
      }
      kit.finish(B, B.loc.rect(0, 0, w, d), 0);
      return summary(0, 'open', null);
    },
  },

  // =========================================================================
  // NEON MILE SHOP HOUSE: 2 to 4 floors, glass fronts, awnings, lit signs
  // =========================================================================
  neonshop: {
    w: [8, 18], d: [13, 20],
    build(kit, lot, rng) {
      const floors = floorsBetween(rng, 2, 4, lot);
      const lk = pickTint(rng, lot, NEON_TINTS);
      const B = kit.begin(lot, { mat: 'plaster', tint: lk.tint, age: pickAge(rng, 0, 0.65), rng });
      const { w, d } = B.loc;
      const parapet = rng.range(0.7, 1.1);
      const all = rng.chance(0.5);
      const o = {
        groundH: GROUND_H, floors: floors - 1, style: 1, bayW: rng.range(3.3, 3.9), ground: 'shops', neon: true,
        parapet, bands: rng.chance(0.5), sill: true, surround: rng.chance(0.5),
        balcony: rng.chance(0.4) ? { cols: all ? () => true : (i) => i % 2 === 0, kind: 'rail' } : null,
      };
      const r = kit.volume(B, [[0, 0], [w, 0], [w, d], [0, d]], o);
      kit.collide(B, 0, 0, w, d, r.top + parapet);
      kit.roofFlat(B, [r], r.top);
      kit.roofStuff(B, r, r.top, { shops: true, garden: rng.chance(0.12) });
      if (B.side.front === 'front' && lot.edgeType === 'neon' && w > 7) {
        const roll = rng.next();
        if (roll < 0.34 && w > 9) kit.roofSign(B, B.loc.frame(0, 0, w, 0), r.top + parapet, rng);
        else if (roll < 0.52) kit.hologram(B, B.loc.frame(0, 0, w, 0), r.top + parapet, rng);
      }
      kit.finish(B, r, r.top + parapet);
      return summary(floors, 'plaster', lk);
    },
  },
};

// ---------------------------------------------------------------------------
// Which type goes on the next lot? "c" describes the place:
//   c.district 'grid' | 'neon',  c.edgeType 'street' | 'avenue' | 'neon' | 'alley'
//   c.corner   the lot has streets on two sides
//   c.space    meters of street front that are still free
//   c.prevType type of the lot before (never the same type twice in a row)
//   c.openUsed this block already has an open lot (station, parking, empty)
// The numbers are weights: a higher number is picked more often.
// ---------------------------------------------------------------------------
export function pickType(rng, c) {
  const list = [];
  const add = (id, weight) => {
    const t = TYPES[id];
    if (weight <= 0 || t.w[0] > c.space + 0.01 || id === c.prevType) return;
    if (t.open && (c.openUsed || !c.playable)) return;
    list.push([id, weight]);
  };
  if (c.edgeType === 'alley') {
    add('walkup', 4); add('stucco', 3); add('warehouse', 3); add('shoprow', 1);
  } else if (c.edgeType === 'neon') {
    if (c.corner) add('corner', 5);
    add('neonshop', 10); add('shoprow', 3); add('stucco', 3); add('office', 1.2);
    add('parking', 0.8); if (c.corner) add('station', 1.5);
  } else if (c.district === 'neon') {
    if (c.corner) add('corner', 5);
    add('walkup', 4); add('stucco', 4); add('shoprow', 4); add('house', 2.5); add('warehouse', 2); add('office', 1.2);
    add('parking', 1.2); add('emptylot', 1);
  } else {
    if (c.corner) { add('corner', 11); add('station', 1.3); }
    add('walkup', 6); add('stucco', 5); add('shoprow', 2.2); add('office', 1.8); add('warehouse', 1.8); add('house', 1.7);
    add('emptylot', 1.0); add('parking', 0.8);
  }
  if (!list.length) {
    // nothing fits the rules: take any type that is narrow enough
    for (const id of ['walkup', 'house', 'neonshop']) if (TYPES[id].w[0] <= c.space + 0.01) return id;
    return null;
  }
  let total = 0;
  for (const [, wgt] of list) total += wgt;
  let r = rng.next() * total;
  for (const [id, wgt] of list) { r -= wgt; if (r <= 0) return id; }
  return list[list.length - 1][0];
}
