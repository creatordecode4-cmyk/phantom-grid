// ---------------------------------------------------------------------------
// ground.js - everything flat: asphalt, sidewalks with curbs, lane markings,
// crosswalks, manholes, stains, the beach and the promenade.
//
// Nothing here creates a mesh directly. We add quads to the shared builders
// in "ctx.mb"; cityBuilder.js turns each builder into ONE mesh at the end.
// ---------------------------------------------------------------------------

import { CONFIG } from '../config.js';
import { SUNK } from './sunkPlan.js';
import { MARK, decalUV } from './textures.js';

const T = CONFIG.textures;

// ---------------------------------------------------------------------------
// Helpers used by the other city files too
// ---------------------------------------------------------------------------

// List the edges of a block polygon with useful extra numbers.
export function blockEdges(block) {
  const out = [];
  const poly = block.poly;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const dirX = dx / len, dirZ = dz / len;
    out.push({
      a, b, len, dirX, dirZ,
      inX: -dirZ, inZ: dirX,              // points into the block
      type: a.edge.type,
      sidewalk: a.edge.sidewalk,
      axis: Math.abs(dirX) > 0.999 ? 'x' : Math.abs(dirZ) > 0.999 ? 'z' : null, // null = diagonal
    });
  }
  return out;
}

// Flat see-through quad on the ground using one cell of the decal picture.
//   sx = size along the quad's own x axis, sz = size along its z axis
//   rot = turn around the up axis (radians)
export function addDecal(mb, name, cx, cz, sx, sz, rot = 0, y = 0.02, alpha = 1, tint = 1) {
  const uv = decalUV(name);
  const c = Math.cos(rot), s = Math.sin(rot);
  const hx = sx / 2, hz = sz / 2;
  // corners in local space, counter-clockwise seen from above
  const pts = [[-hx, -hz], [-hx, hz], [hx, hz], [hx, -hz]].map(([lx, lz]) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c]);
  mb.color(tint, tint, tint, alpha);
  mb.quad(pts[0], pts[1], pts[2], pts[3], [0, 1, 0], [uv.u0, uv.v0], [uv.u0, uv.v1], [uv.u1, uv.v1], [uv.u1, uv.v0]);
}

// A painted line from (x0,z0) to (x1,z1).
//   row = one of MARK.dashed / solid / double / bars
//   uLen = meters covered by one repeat of the texture along the line
export function addMark(mb, x0, z0, x1, z1, width, row, uLen, color, alpha, y = 0.012) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return;
  const hw = width / 2;
  const sx = (-dz / len) * hw, sz = (dx / len) * hw;
  const u1 = len / uLen;
  mb.color(color[0], color[1], color[2], alpha);
  mb.quad(
    [x0 - sx, y, z0 - sz], [x0 + sx, y, z0 + sz], [x1 + sx, y, z1 + sz], [x1 - sx, y, z1 - sz],
    [0, 1, 0],
    [0, row[0]], [0, row[1]], [u1, row[1]], [u1, row[0]]
  );
}

const WHITE = [0.95, 0.95, 0.93];
const YELLOW = [0.92, 0.7, 0.18];

// ---------------------------------------------------------------------------
// Sidewalk slab with a curb for one convex polygon (block, median, island).
// ---------------------------------------------------------------------------
function addSlab(ctx, poly, y, tintTop = 1, uOff = 0, vOff = 0) {
  const mb = ctx.mb.sidewalk;
  const tile = T.sidewalk.size;
  const n = poly.length;
  const CW = 0.18; // width of the curb stone
  // inner corner points: each corner moved inward along both of its edges
  const inner = [];
  for (let i = 0; i < n; i++) {
    const p = poly[(i - 1 + n) % n], c = poly[i], q = poly[(i + 1) % n];
    let e1x = c.x - p.x, e1z = c.z - p.z, e2x = q.x - c.x, e2z = q.z - c.z;
    const l1 = Math.hypot(e1x, e1z), l2 = Math.hypot(e2x, e2z);
    e1x /= l1; e1z /= l1; e2x /= l2; e2z /= l2;
    const n1x = -e1z, n1z = e1x, n2x = -e2z, n2z = e2x; // inward normals
    const k = CW / (1 + n1x * n2x + n1z * n2z);
    inner.push({ x: c.x + (n1x + n2x) * k, z: c.z + (n1z + n2z) * k });
  }
  // top surface
  mb.color(tintTop, tintTop, tintTop, 1);
  mb.groundPoly(inner, y, tile, uOff, vOff);
  // curb: a lighter stone strip on top + the vertical face
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ia = inner[i], ib = inner[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const u0 = uOff + i * 0.37, u1 = u0 + len / tile;
    // top strip (counter-clockwise seen from above: a, ia, ib, b)
    mb.color(1.3, 1.29, 1.27, 1);
    mb.quad([a.x, y, a.z], [ia.x, y, ia.z], [ib.x, y, ib.z], [b.x, y, b.z], [0, 1, 0], [u0, 0.31], [u0, 0.37], [u1, 0.37], [u1, 0.31]);
    // a dark seam between the curb stone and the slabs: the curb reads as its own stone
    mb.color(0.5, 0.5, 0.5, 1);
    const k = 0.035 / CW;
    mb.quad([ia.x, y + 0.002, ia.z], [ia.x + (ia.x - a.x) * k, y + 0.002, ia.z + (ia.z - a.z) * k], [ib.x + (ib.x - b.x) * k, y + 0.002, ib.z + (ib.z - b.z) * k], [ib.x, y + 0.002, ib.z],
      [0, 1, 0], [u0, 0.33], [u0, 0.34], [u1, 0.34], [u1, 0.33]);
    // vertical face, pointing away from the block
    const ox = (b.z - a.z) / len, oz = -(b.x - a.x) / len;
    mb.color(1.02, 1.01, 0.99, 1);
    mb.quad([b.x, 0, b.z], [a.x, 0, a.z], [a.x, y, a.z], [b.x, y, b.z], [ox, 0, oz], [u1, 0.31], [u0, 0.31], [u0, 0.36], [u1, 0.36]);
    // gutter: a soft dark strip on the road along the curb (dirt collects there,
    // and it makes the curb edge clear)
    if (len > 1.5 && Math.abs(a.x) < 700 && Math.abs(b.x) < 700) {
      const mx = (a.x + b.x) / 2 + ox * 0.42, mz = (a.z + b.z) / 2 + oz * 0.42;
      addDecal(ctx.mb.decal, 'ao', mx, mz, len, 0.84, Math.atan2(ox, oz), 0.0125, 0.8);
    }
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export function buildGround(ctx) {
  const L = ctx.layout;
  const rng = ctx.rng.fork();
  const curb = L.street.curbHeight;
  const half = L.street.width / 2;

  // ---- 1. asphalt everywhere north of the beach walk --------------------------------
  ctx.mb.asphalt.color(1, 1, 1, 1);
  // (not where The Sunk is: the old streets there are under water)
  // (and not over Rustwater Docks, east of the highway: the port has its own ground, see docks.js)
  ctx.mb.asphalt.groundRect(-1500, L.docks.maxZ, SUNK.minX, 1700, 0, T.asphalt.size);
  ctx.mb.asphalt.groundRect(L.docks.maxX, L.neon.roadMinZ, SUNK.minX, L.docks.maxZ, 0, T.asphalt.size);
  ctx.mb.asphalt.groundRect(SUNK.minX, SUNK.maxZ, 1800, 1700, 0, T.asphalt.size);
  ctx.mb.asphalt.groundRect(SUNK.maxX, L.neon.roadMinZ, 1800, SUNK.maxZ, 0, T.asphalt.size);

  // ---- 2. sidewalk slabs (one per block) ----------------------------------------------
  for (const b of L.blocks) {
    addSlab(ctx, b.poly, curb, 1, rng.int(0, 3) * 0.25, rng.int(0, 3) * 0.25);
  }
  // beach promenade
  for (const [x0, x1] of [[L.docks.maxX, SUNK.minX], [SUNK.maxX, 1800]]) {
    addSlab(ctx, [
      { x: x0, z: L.neon.promenadeMinZ }, { x: x1, z: L.neon.promenadeMinZ },
      { x: x1, z: L.neon.promenadeMaxZ }, { x: x0, z: L.neon.promenadeMaxZ },
    ], curb, 1.04);
  }
  // median of Neon Mile (a little darker: packed earth between the palms)
  for (const [x0, x1] of L.medianPieces) {
    addSlab(ctx, [
      { x: x0, z: L.median.minZ }, { x: x1, z: L.median.minZ },
      { x: x1, z: L.median.maxZ }, { x: x0, z: L.median.maxZ },
    ], curb, 0.78, 0.13, 0.4);
  }

  // ---- 3. beach sand: slopes from the walk down into the sea ---------------------------
  {
    const mb = ctx.mb.sand;
    const tile = T.sand.size;
    const zs = [L.beach.maxZ, (L.beach.maxZ + L.beach.minZ) / 2, L.beach.minZ, L.beach.minZ - 60];
    mb.color(1, 1, 1, 1);
    for (let i = 0; i < zs.length - 1; i++) for (const [x0, x1] of [[L.docks.maxX, SUNK.minX], [SUNK.maxX, 1800]]) {
      const zN = zs[i], zS = zs[i + 1];
      const yN = L.beachHeight(zN), yS = L.beachHeight(zS);
      mb.quad(
        [x0, yS, zS], [x0, yN, zN], [x1, yN, zN], [x1, yS, zS],
        [0, 1, 0],
        [x0 / tile, zS / tile], [x0 / tile, zN / tile], [x1 / tile, zN / tile], [x1 / tile, zS / tile]
      );
    }
  }

  // ---- 4. lane markings on the grid streets ----------------------------------------------
  const mk = ctx.mb.marking;
  const dc = ctx.mb.decal;

  // Paint one straight piece of street between two crossings.
  //   street: the street,  a..b: the piece along the street
  //   endA / endB: true when that end touches a real intersection
  function paintPiece(street, a, b, endA, endB) {
    const len = b - a;
    if (len < 8) return;
    const ns = street.axis === 'ns';
    const c = street.center;
    // point on the street: "t" along it, "o" sideways from the center line
    // (for north-south streets +o is west, for east-west streets +o is north)
    const P = (t, o) => (ns ? [c + o, t] : [t, c + o]);
    const fade = rng.range(0.55, 1.0); // how worn this street's paint is
    const la = a + (endA ? 5.0 : 0.5), lb = b - (endB ? 5.0 : 0.5);
    if (lb - la > 3) {
      // double yellow center line
      let p0 = P(la, 0), p1 = P(lb, 0);
      addMark(mk, p0[0], p0[1], p1[0], p1[1], 0.36, MARK.double, 6, YELLOW, fade);
      // dashed white lane lines
      for (const o of [-3.5, 3.5]) {
        p0 = P(la, o); p1 = P(lb, o);
        addMark(mk, p0[0], p0[1], p1[0], p1[1], 0.13, MARK.dashed, 12, WHITE, fade * 0.95);
      }
    }
    // stop lines (cars drive on the right) and crosswalks at real intersections
    //   north-south street: north-bound cars use the east half (-o)
    //   east-west street:  east-bound cars (toward -X) use the south half (-o)
    if (endB) {
      const t = b - 4.4;
      const s0 = ns ? P(t, -half + 0.3) : P(t, 0.3), s1 = ns ? P(t, -0.3) : P(t, half - 0.3);
      addMark(mk, s0[0], s0[1], s1[0], s1[1], 0.45, MARK.solid, 5, WHITE, fade);
      const c0 = P(b - 2.1, -half + 0.3), c1 = P(b - 2.1, half - 0.3);
      addMark(mk, c0[0], c0[1], c1[0], c1[1], 3.0, MARK.bars, 4.8, WHITE, fade);
    }
    if (endA) {
      const t = a + 4.4;
      const s0 = ns ? P(t, 0.3) : P(t, -half + 0.3), s1 = ns ? P(t, half - 0.3) : P(t, -0.3);
      addMark(mk, s0[0], s0[1], s1[0], s1[1], 0.45, MARK.solid, 5, WHITE, fade);
      const c0 = P(a + 2.1, -half + 0.3), c1 = P(a + 2.1, half - 0.3);
      addMark(mk, c0[0], c0[1], c1[0], c1[1], 3.0, MARK.bars, 4.8, WHITE, fade);
    }

    // ---- dirt and damage on this piece ----
    const rot = ns ? 0 : Math.PI / 2; // decals are drawn "long along z", turn them for east-west streets
    // newer asphalt patches
    // (lane-wide strips where the road was dug up and closed again)
    for (let k = 0; k < 2; k++) {
      if (!rng.chance(0.6) || len < 24) continue;
      const t = rng.range(a + 8, b - 8), o = rng.pick([-5.2, -1.8, 1.8, 5.2]);
      const p = P(t, o);
      addDecal(dc, 'patch', p[0], p[1], rng.range(2.4, 3.4), rng.range(4, 12), rot, 0.014, rng.range(0.5, 0.9));
    }
    // darker, polished wheel paths in all four lanes (weaker where cars park)
    for (const o of [-5.25, -1.75, 1.75, 5.25]) {
      const p = P((a + b) / 2, o);
      addDecal(dc, 'wheel', p[0], p[1], 3.3, len - 1, rot, 0.0135, (Math.abs(o) > 3 ? 0.45 : 0.85) * rng.range(0.8, 1.0));
    }
    // oil drips in the middle of the two inner lanes
    for (const o of [-1.75, 1.75]) {
      const p = P((a + b) / 2, o);
      addDecal(dc, 'streak', p[0], p[1], len - 2, 0.9, rot + Math.PI / 2, 0.015, rng.range(0.25, 0.55));
    }
    // lane arrows in front of the stop lines (inner lane: straight, outer lane: straight or turn)
    if (len > 34) {
      const arrows = (t, sideSign, dirRot) => {
        for (const [o, name] of [[1.75, 'arrow'], [5.25, 'arrowTurn']]) {
          const p = P(t, sideSign * o);
          addDecal(dc, name, p[0], p[1], 1.5, 4.2, dirRot, 0.0145, fade * 0.9);
        }
      };
      if (endB) arrows(b - 13, ns ? -1 : 1, ns ? 0 : Math.PI / 2);
      if (endA) arrows(a + 13, ns ? 1 : -1, ns ? Math.PI : -Math.PI / 2);
    }
    // cracks, tar repairs, oil spots, skid marks
    const count = Math.floor(len / 7);
    for (let i = 0; i < count; i++) {
      const t = rng.range(a + 2, b - 2);
      const r = rng.next();
      if (r < 0.3) {
        const p = P(t, rng.range(-6, 6));
        addDecal(dc, rng.chance(0.5) ? 'crack1' : 'crack2', p[0], p[1], rng.range(2.5, 5.5), rng.range(2.5, 5.5), rng.range(0, 6.28), 0.016, rng.range(0.5, 0.95));
      } else if (r < 0.62) {
        // oil spots where cars park and wait
        const p = P(t, rng.pick([-5.6, 5.6]) + rng.range(-0.5, 0.5));
        addDecal(dc, rng.chance(0.5) ? 'oil1' : 'oil2', p[0], p[1], rng.range(0.9, 2.2), rng.range(0.9, 2.2), rng.range(0, 6.28), 0.016, rng.range(0.4, 0.9));
      } else if (r < 0.74) {
        const p = P(t, rng.range(-4.5, 4.5));
        addDecal(dc, 'tar', p[0], p[1], rng.range(1, 2.4), rng.range(1, 2.8), rot, 0.016, rng.range(0.5, 0.9));
      } else if (r < 0.86) {
        // tire marks along the lanes
        const p = P(t, rng.pick([-1.75, 1.75, -5.2, 5.2]) + rng.range(-0.4, 0.4));
        addDecal(dc, 'skid', p[0], p[1], rng.range(6, 14), 2.0, rot + Math.PI / 2, 0.016, rng.range(0.35, 0.8));
      } else if (r < 0.93) {
        const p = P(t, rng.range(-6.2, 6.2));
        addDecal(dc, 'dirt', p[0], p[1], rng.range(1.5, 3.5), rng.range(1.5, 3.5), rng.range(0, 6.28), 0.016, rng.range(0.4, 0.8));
      }
    }
    // manhole covers in the lanes, drain grates at the curb
    for (let t = a + rng.range(8, 30); t < b - 6; t += rng.range(34, 60)) {
      const p = P(t, rng.pick([-1.75, 1.75, -5.2, 5.2]) + rng.range(-0.3, 0.3));
      addDecal(dc, 'manhole', p[0], p[1], 0.95, 0.95, rng.range(0, 6.28), 0.018, 1);
    }
    if (endA) {
      for (const o of [-half + 0.42, half - 0.42]) {
        const p = P(a + 6.5, o);
        addDecal(dc, 'drain', p[0], p[1], 0.9, 0.9, rot + Math.PI / 2, 0.018, 1);
      }
    }
  }

  // Go along every street and split it at the crossings.
  function paintStreet(street, crossings) {
    // crossings: list of [from, to] ranges taken by intersections, sorted
    let cur = street.start, end = street.end;
    // (The Sunk: a north-south street there starts north of it; an east-west street south of its edge ends at it)
    if (street.axis === 'ns' && street.center > SUNK.minX && street.center < SUNK.maxX) cur = Math.max(cur, SUNK.maxZ + half);
    if (street.axis === 'ew' && street.center < SUNK.maxZ) end = Math.min(end, SUNK.minX - 0.5);
    crossings = crossings.filter((c) => c[1] <= end + 0.01 && c[0] >= cur - 0.01);
    let curIsCross = true; // the street begins at a crossing (Neon Mile / frontage road)
    const stops = crossings.concat([[end, end]]);
    for (const [c0, c1] of stops) {
      const a = cur, b = c0;
      if (b - a > 4) {
        const parts = L.cutByAvenue(street, a, b);
        for (const [pa, pb] of parts) {
          paintPiece(street, pa, pb, pa === a && curIsCross, pb === b && c1 > c0);
        }
      }
      cur = c1;
      curIsCross = true;
    }
  }
  for (const ns of L.streetsNS) {
    paintStreet(ns, L.streetsEW.map((e) => [e.center - half, e.center + half]));
  }
  for (const ew of L.streetsEW) {
    paintStreet(ew, L.streetsNS.map((s) => [s.center - half, s.center + half]));
  }

  // ---- 5. the diagonal avenue ----------------------------------------------------------------
  {
    const A = L.avenue;
    // walk along the avenue and find the parts that are not inside a grid street
    const inStreet = (x, z) => {
      for (const s of L.streetsNS) if (Math.abs(x - s.center) < half + 5 && z > s.start - 5) return true;
      for (const s of L.streetsEW) if (Math.abs(z - s.center) < half + 5) return true;
      return false;
    };
    const tStart = (L.city.maxZ - A.az) / A.dirZ;         // from the far north-west
    const tEnd = (L.neon.roadMaxZ + 2 - A.az) / A.dirZ;   // to Neon Mile
    let runStart = null;
    const fade = 0.85;
    for (let t = tStart; t <= tEnd + 1; t += 1) {
      const x = A.ax + A.dirX * t, z = A.az + A.dirZ * t;
      const free = t <= tEnd && !inStreet(x, z);
      if (free && runStart === null) runStart = t;
      if (!free && runStart !== null) {
        const t0 = runStart + 1.5, t1 = t - 2.5;
        runStart = null;
        if (t1 - t0 < 6) continue;
        const line = (o, w, row, uLen, col) => {
          addMark(mk, A.ax + A.dirX * t0 + A.nx * o, A.az + A.dirZ * t0 + A.nz * o,
            A.ax + A.dirX * t1 + A.nx * o, A.az + A.dirZ * t1 + A.nz * o, w, row, uLen, col, fade);
        };
        line(0, 0.36, MARK.double, 6, YELLOW);
        line(-4.6, 0.13, MARK.dashed, 12, WHITE);
        line(4.6, 0.13, MARK.dashed, 12, WHITE);
        // wear on the avenue too
        const rot = Math.atan2(A.dirX, A.dirZ);
        for (let k = 0; k < (t1 - t0) / 16; k++) {
          const tt = rng.range(t0, t1), o = rng.range(-7.5, 7.5);
          const name = rng.pick(['crack1', 'crack2', 'oil1', 'tar', 'dirt', 'patch']);
          addDecal(dc, name, A.ax + A.dirX * tt + A.nx * o, A.az + A.dirZ * tt + A.nz * o,
            rng.range(1.5, 4), rng.range(1.5, 5), name === 'patch' || name === 'tar' ? rot : rng.range(0, 6.28), 0.016, rng.range(0.45, 0.9));
        }
        if (rng.chance(0.8)) {
          const tt = rng.range(t0, t1);
          addDecal(dc, 'manhole', A.ax + A.dirX * tt + A.nx * 2.3, A.az + A.dirZ * tt + A.nz * 2.3, 0.95, 0.95, 0, 0.018, 1);
        }
      }
    }
  }

  // ---- 6. Neon Mile: two roads with a median --------------------------------------------------
  {
    const N = L.neon;
    const x0 = L.highway.maxX + 6, x1 = SUNK.minX - 0.5;          // (it ends at The Sunk)
    for (const side of [-1, 1]) {
      const inner = N.centerZ + side * (N.medianWidth / 2); // median curb
      const z = (o) => inner + side * o;
      addMark(mk, x0, z(0.35), x1, z(0.35), 0.13, MARK.solid, 6, YELLOW, 0.9);
      addMark(mk, x0, z(3.8), x1, z(3.8), 0.13, MARK.dashed, 12, WHITE, 0.9);
      addMark(mk, x0, z(7.4), x1, z(7.4), 0.13, MARK.solid, 6, WHITE, 0.85);
      // oil streaks and random wear
      for (const o of [1.9, 5.6]) addDecal(dc, 'streak', (x0 + x1) / 2, z(o), x1 - x0, 1.5, 0, 0.015, 0.5);
      for (let k = 0; k < 150; k++) {
        const name = rng.pick(['crack1', 'crack2', 'oil1', 'oil2', 'tar', 'dirt', 'patch', 'skid']);
        const long = name === 'patch' || name === 'skid';
        addDecal(dc, name, rng.range(x0, x1), z(rng.range(1, 10)), long ? rng.range(5, 11) : rng.range(1.2, 4), rng.range(1.2, 3.2),
          long ? 0 : rng.range(0, 6.28), 0.016, rng.range(0.4, 0.9));
      }
      for (let x = x0 + 20; x < x1; x += rng.range(40, 70)) addDecal(dc, 'manhole', x, z(rng.pick([1.9, 5.6])), 0.95, 0.95, 0, 0.018, 1);
    }
    // crosswalks over the boulevard where the grid streets arrive
    for (const s of L.streetsNS) {
      if (s.center > SUNK.minX) continue;               // (no street mouth where The Sunk is)
      const cx = s.center + half + 2.6; // on the west side of each street mouth
      for (const side of [-1, 1]) {
        const zA = N.centerZ + side * (N.medianWidth / 2 + 0.4), zB = N.centerZ + side * (N.width / 2 - 0.3);
        addMark(mk, cx, zA, cx, zB, 3.0, MARK.bars, 4.8, WHITE, 0.9);
      }
    }
  }

  // ---- 7. alleys: dirty asphalt between two half blocks -----------------------------------------
  for (const al of L.alleyRects) {
    const cx = (al.minX + al.maxX) / 2, cz = (al.minZ + al.maxZ) / 2;
    const long = al.axis === 'x' ? al.maxX - al.minX : al.maxZ - al.minZ;
    const rot = al.axis === 'x' ? Math.PI / 2 : 0;
    addDecal(dc, 'streak', cx, cz, long, 3.2, rot + Math.PI / 2, 0.015, 0.9);
    for (let k = 0; k < long / 7; k++) {
      const t = rng.range(-long / 2 + 2, long / 2 - 2), o = rng.range(-1.6, 1.6);
      const px = al.axis === 'x' ? cx + t : cx + o, pz = al.axis === 'x' ? cz + o : cz + t;
      addDecal(dc, rng.pick(['leak', 'oil1', 'dirt', 'crack1', 'tar', 'dirt']), px, pz, rng.range(1.2, 3), rng.range(1.2, 3), rng.range(0, 6.28), 0.016, rng.range(0.5, 0.95));
    }
  }

  // ---- 8. back yards: the middle of every block is darker, used ground ---------------------------
  for (const b of L.blocks) {
    if (!b.isRect) continue;
    const bb = b.bounds, w = bb.maxX - bb.minX, d = bb.maxZ - bb.minZ;
    if (w < 40 || d < 40) continue;
    addDecal(dc, 'patch', (bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2, w - 22, d - 22, 0, curb + 0.01, 1.0, 0.8);
    for (let k = 0; k < 5; k++) {
      addDecal(dc, rng.pick(['oil1', 'dirt', 'leak', 'crack1']), rng.range(bb.minX + 16, bb.maxX - 16), rng.range(bb.minZ + 16, bb.maxZ - 16),
        rng.range(3, 8), rng.range(3, 8), rng.range(0, 6.28), curb + 0.012, rng.range(0.4, 0.8));
    }
  }

  // ---- 9. stains on the sidewalks ---------------------------------------------------------------
  for (const b of L.blocks) {
    if (!b.playable) continue;
    for (const e of blockEdges(b)) {
      if (e.type === 'alley') continue;
      for (let k = 0; k < e.len / 16; k++) {
        const t = rng.range(2, e.len - 2), o = rng.range(0.5, e.sidewalk - 0.4);
        const x = e.a.x + e.dirX * t + e.inX * o, z = e.a.z + e.dirZ * t + e.inZ * o;
        addDecal(dc, rng.pick(['dirt', 'leak', 'oil2', 'dirt', 'crack1']), x, z, rng.range(0.8, 2.2), rng.range(0.8, 2.2), rng.range(0, 6.28), curb + 0.012, rng.range(0.3, 0.75));
      }
      // cracked slabs, and slabs that were replaced with fresh, lighter (or tar-dark) concrete
      const along = Math.atan2(e.dirX, e.dirZ);
      for (let k = 0; k < e.len / 22; k++) {
        const t = rng.range(3, e.len - 3), o = rng.range(0.8, Math.max(0.9, e.sidewalk - 0.8));
        const x = e.a.x + e.dirX * t + e.inX * o, z = e.a.z + e.dirZ * t + e.inZ * o;
        if (rng.chance(0.55)) addDecal(dc, rng.chance(0.5) ? 'crack1' : 'crack2', x, z, rng.range(1.2, 2.6), rng.range(1.2, 2.6), rng.range(0, 6.28), curb + 0.012, rng.range(0.45, 0.85));
        else addDecal(dc, 'patch', x, z, 0.75 * rng.int(1, 2), 0.75 * rng.int(1, 3), along, curb + 0.0125, rng.range(0.5, 0.9), rng.chance(0.6) ? rng.range(14, 26) : 1);
      }
    }
  }
}
