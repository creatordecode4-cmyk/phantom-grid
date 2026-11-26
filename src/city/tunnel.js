// ---------------------------------------------------------------------------
// tunnel.js - THE IRONHILL TUNNEL (Chapter 8, "Talk to Zero").
//
// North of the city the raised Ironhill Highway goes under a long concrete roof: a covered stretch of the road
// (layout.js: highway.tunnel, z 1000..1320). Inside:
//   * a pale tiled band on the lower walls, dark painted concrete above it, a dark ceiling
//   * two rows of orange lamps under the ceiling, one every 8 m (they glow by themselves; the light they throw
//     on the road, the walls and the cars is worked out in the city shaders - materials.js, pgTunLight - so the
//     tunnel needs no real lamps and no extra draw calls)
//   * small white guide lights along the crash walls (they stream past at speed), green exit signs, orange SOS
//     boxes, cable trays, pairs of big fans under the roof
//   * at both mouths a heavy portal frame with lane signals (green arrows in, red crosses out)
// Outside: ribbed walls and a flat roof on the same pillars as the rest of the road.
// The road itself (asphalt, paint, crash walls) is the highway's own (backdrop.js).
// No rain falls inside it (main.js tells the rain), and its air is a warmer, darker haze (lighting.js zone).
//
// Everything is added to the city's big shared meshes (ctx.mb: plaster, propStatic): it costs no draw calls.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

// the city's concrete color (the same as the highway's in backdrop.js: it turns the warm plaster picture grey)
const CONCRETE = [0.74, 0.78, 0.86];

// where the inside of the tunnel is and where its lamps are (main.js, the shaders and the story read this)
export function tunnelInfo(H) {
  const T = H.tunnel;
  const deck = H.height, ceil = deck + T.clear;
  return {
    minX: H.minX + 0.4, maxX: H.maxX - 0.4, minZ: T.z0, maxZ: T.z1, floor: deck, ceil,
    every: T.lampEvery, first: T.z0 + T.lampEvery / 2, rows: [H.centerX - T.rowOffset, H.centerX + T.rowOffset],
  };
}

// ctx: the city builder's context. tile: the size of the plaster texture (meters).
export function buildTunnel(ctx, tile) {
  const H = ctx.layout.highway, T = H.tunnel;
  if (!T) return null;
  const pm = ctx.mb.plaster, ps = ctx.mb.propStatic;
  const x0 = H.minX, x1 = H.maxX, cx = H.centerX, deck = H.height;
  const z0 = T.z0, z1 = T.z1;
  const yC = deck + T.clear;        // the ceiling (its underside)
  const yR = yC + 1.1;              // the top of the roof
  const xi0 = x0 + 0.4, xi1 = x1 - 0.4;   // the inner faces of the walls (= the crash walls' inner faces)
  const con = (k = 1) => pm.color(CONCRETE[0] * k, CONCRETE[1] * k, CONCRETE[2] * k, 1).data(0, 0, 0, 0);
  // (propStatic data: roughness, metal, -, glow: 0..1 glows only at night, 1..2 glows always)
  const prop = (r, g, b, rough = 0.6, metal = 0, glow = 0) => ps.color(r, g, b, 1).data(rough, metal, 0, glow);

  // ---------------------------------------------------------------- the walls
  // the upper walls, from the top of the crash walls to the ceiling (inner face and outer face)
  con(0.46);
  pm.box(x0 - 0.5, deck + 0.95, z0, xi0, yC, z1, tile, 'w');            // (+x side: the inside of the east wall)
  pm.box(xi1, deck + 0.95, z0, x1 + 0.5, yC, z1, tile, 'e');             // (-x side: the inside of the west wall)
  con(0.86);
  pm.box(x0 - 0.5, deck - 1.65, z0, xi0, yR, z1, tile, 'eb');            // the outside of the east wall
  pm.box(xi1, deck - 1.65, z0, x1 + 0.5, yR, z1, tile, 'wb');            // the outside of the west wall
  // the pale tiled band on the lower walls, and the thin dark line along its top
  pm.color(0.92, 0.88, 0.78, 1).data(0, 0, 0, 0);
  pm.quadAuto([xi0 + 0.006, deck + 0.95, z0], [xi0 + 0.006, deck + 0.95, z1], [xi0 + 0.006, deck + 3.3, z1], [xi0 + 0.006, deck + 3.3, z0], [1, 0, 0], tile * 0.5);
  pm.quadAuto([xi1 - 0.006, deck + 0.95, z0], [xi1 - 0.006, deck + 0.95, z1], [xi1 - 0.006, deck + 3.3, z1], [xi1 - 0.006, deck + 3.3, z0], [-1, 0, 0], tile * 0.5);
  pm.color(0.1, 0.1, 0.11, 1);
  pm.quadAuto([xi0 + 0.008, deck + 3.3, z0], [xi0 + 0.008, deck + 3.3, z1], [xi0 + 0.008, deck + 3.45, z1], [xi0 + 0.008, deck + 3.45, z0], [1, 0, 0], tile);
  pm.quadAuto([xi1 - 0.008, deck + 3.3, z0], [xi1 - 0.008, deck + 3.3, z1], [xi1 - 0.008, deck + 3.45, z1], [xi1 - 0.008, deck + 3.45, z0], [-1, 0, 0], tile);

  // ---------------------------------------------------------------- the roof
  // the ceiling (dark), the roof slab's top and its edges
  pm.color(0.24, 0.245, 0.26, 1).data(0, 0, 0, 0);
  pm.quadAuto([xi0, yC, z0], [xi0, yC, z1], [xi1, yC, z1], [xi1, yC, z0], [0, -1, 0], tile);
  con(0.78);
  pm.box(x0 - 0.5, yC, z0, x1 + 0.5, yR, z1, tile, 'tew');
  // a low parapet along both edges of the roof
  con(0.9);
  pm.box(x0 - 0.5, yR, z0, x0 - 0.1, yR + 0.45, z1, tile, 'tew');
  pm.box(x1 + 0.1, yR, z0, x1 + 0.5, yR + 0.45, z1, tile, 'tew');
  // ribs down the outside walls, one every 8 m (they line up with the lamps inside)
  con(0.8);
  for (let z = z0 + 8; z < z1 - 4; z += 8) {
    pm.box(x0 - 0.78, deck - 1.65, z - 0.2, x0 - 0.5, yR + 0.25, z + 0.2, tile, 'nset');
    pm.box(x1 + 0.5, deck - 1.65, z - 0.2, x1 + 0.78, yR + 0.25, z + 0.2, tile, 'nswt');
  }

  // ---------------------------------------------------------------- the two mouths (portal frames)
  for (const [zp, dir] of [[z0, -1], [z1, 1]]) {
    const za = dir < 0 ? zp - 1.6 : zp, zb = dir < 0 ? zp : zp + 1.6;
    con(0.95);
    // the beam over the mouth (a little lower than the ceiling) and the two side columns
    pm.box(x0 - 1.4, yC - 0.5, za, x1 + 1.4, yR + 0.6, zb, tile, 'nsewtb');
    pm.box(x0 - 1.4, deck - 1.8, za, xi0 + 0.05, yC - 0.5, zb, tile, 'nsewb');
    pm.box(xi1 - 0.05, deck - 1.8, za, x1 + 1.4, yC - 0.5, zb, tile, 'nsewb');
    // a dark recessed band across the beam (where a name would go) with a thin light line under it
    const zf = dir < 0 ? za - 0.01 : zb + 0.01, nz = dir;
    pm.color(0.16, 0.17, 0.18, 1).data(0, 0, 0, 0);
    pm.quadAuto([x0 + 2, yC + 0.25, zf], [x1 - 2, yC + 0.25, zf], [x1 - 2, yR + 0.25, zf], [x0 + 2, yR + 0.25, zf], [0, 0, nz], tile);
    prop(1.0, 0.62, 0.3, 0.4, 0, 1.25);
    ps.box(x0 + 2, yC + 0.12, Math.min(zf, zf + nz * 0.04), x1 - 2, yC + 0.17, Math.max(zf, zf + nz * 0.04), 1, 'nsewtb');
    // LANE SIGNALS over each lane, on the face toward the cars coming in (green arrow) or going out (red cross)
    // (cars keep to the right: going north they use the lanes on the -x side)
    for (const lane of [2.1, 6.3, 10.4]) {
      for (const side of [-1, 1]) {
        const x = cx + side * lane;
        const comingIn = dir < 0 ? side < 0 : side > 0;        // (south mouth: the northbound lanes come in)
        const y = yC - 0.95;
        // the dark box of the signal hangs from the beam
        prop(0.05, 0.05, 0.055, 0.5, 0.3, 0);
        const zs0 = dir < 0 ? za - 0.35 : zb, zs1 = dir < 0 ? za : zb + 0.35;
        ps.box(x - 0.42, y - 0.42, zs0, x + 0.42, y + 0.45, zs1, 1, 'nsewtb');
        // the lit face: a green arrow (a small down-pointing wedge) or a red cross (two thin bars)
        const zl = dir < 0 ? zs0 - 0.012 : zs1 + 0.012;
        if (comingIn) {
          prop(0.25, 1.0, 0.45, 0.3, 0, 1.75);
          ps.triAuto([x - 0.22, y + 0.2, zl], [x + 0.22, y + 0.2, zl], [x, y - 0.24, zl], [0, 0, nz], 1);
          ps.quadAuto([x - 0.06, y + 0.2, zl], [x + 0.06, y + 0.2, zl], [x + 0.06, y + 0.34, zl], [x - 0.06, y + 0.34, zl], [0, 0, nz], 1);
        } else {
          prop(1.0, 0.18, 0.12, 0.3, 0, 1.7);
          const k = 0.24, w = 0.05;
          ps.quadAuto([x - k, y - k + w, zl], [x - k + w, y - k, zl], [x + k, y + k - w, zl], [x + k - w, y + k, zl], [0, 0, nz], 1);
          ps.quadAuto([x - k, y + k - w, zl], [x - k + w, y + k, zl], [x + k, y - k + w, zl], [x + k - w, y - k, zl], [0, 0, nz], 1);
        }
      }
    }
  }

  // ---------------------------------------------------------------- the lamps
  // two rows under the ceiling, one lamp every 8 m: a dark housing and a long glowing orange lens under it
  const info = tunnelInfo(H);
  for (let z = info.first; z < z1; z += T.lampEvery) {
    for (const lx of info.rows) {
      prop(0.07, 0.07, 0.075, 0.5, 0.5, 0);
      ps.box(lx - 0.22, yC - 0.17, z - 0.9, lx + 0.22, yC, z + 0.9, 1, 'nsewb');
      prop(1.0, 0.52, 0.16, 0.25, 0, 1.92);
      ps.box(lx - 0.16, yC - 0.205, z - 0.8, lx + 0.16, yC - 0.17, z + 0.8, 1, 'nsewb');
    }
  }
  // cable trays along both walls, just under the ceiling
  prop(0.32, 0.33, 0.35, 0.5, 0.7, 0);
  ps.box(xi0, yC - 0.62, z0, xi0 + 0.38, yC - 0.5, z1, 1, 'tbw');
  ps.box(xi1 - 0.38, yC - 0.62, z0, xi1, yC - 0.5, z1, 1, 'tbe');
  // big fans in pairs under the roof (they push the air out of the tunnel), one pair every 96 m
  const fan = new THREE.CylinderGeometry(0.52, 0.52, 3.4, 14, 1, false);
  const ring = new THREE.TorusGeometry(0.53, 0.06, 6, 16);
  for (let z = z0 + 48; z < z1 - 30; z += 96) {
    for (const s of [-1, 1]) {
      const fx = cx + s * 2.6, fy = yC - 0.78;
      prop(0.34, 0.35, 0.37, 0.45, 0.65, 0);
      ps.add(fan, fx, fy, z, [Math.PI / 2, 0, 0]);
      prop(0.1, 0.1, 0.11, 0.5, 0.6, 0);
      for (const e of [-1.72, 1.72]) ps.add(ring, fx, fy, z + e, [0, 0, 0]);
      // the hangers
      prop(0.25, 0.25, 0.27, 0.5, 0.7, 0);
      ps.box(fx - 0.05, fy + 0.45, z - 1.0, fx + 0.05, yC, z - 0.9, 1, 'nsew');
      ps.box(fx - 0.05, fy + 0.45, z + 0.9, fx + 0.05, yC, z + 1.0, 1, 'nsew');
    }
  }
  // small white guide lights along both crash walls, one every 5 m (at speed they stream past)
  for (let z = z0 + 2.5; z < z1; z += 5) {
    prop(1.0, 0.94, 0.82, 0.3, 0, 1.55);
    ps.box(xi0, deck + 0.68, z - 0.11, xi0 + 0.03, deck + 0.76, z + 0.11, 1, 'wtb');
    ps.box(xi1 - 0.03, deck + 0.68, z - 0.11, xi1, deck + 0.76, z + 0.11, 1, 'etb');
  }
  // every 80 m on both walls: a green EXIT sign and an orange SOS box
  for (let z = z0 + 40; z < z1 - 20; z += 80) {
    for (const [xw, n] of [[xi0, 1], [xi1, -1]]) {
      const out = xw + n * 0.05;
      prop(0.18, 0.95, 0.45, 0.35, 0, 1.6);
      ps.box(Math.min(xw, out), deck + 2.55, z - 0.5, Math.max(xw, out), deck + 2.9, z + 0.5, 1, n > 0 ? 'wnst' : 'enst');
      prop(1.0, 0.42, 0.06, 0.5, 0, 1.12);
      const out2 = xw + n * 0.22;
      ps.box(Math.min(xw, out2), deck + 1.15, z + 1.4, Math.max(xw, out2), deck + 2.05, z + 1.95, 1, n > 0 ? 'wnstb' : 'enstb');
    }
  }
  return info;
}

// THE CLOSED END of the road (z = highway.northEndZ): a row of heavy barriers with reflective stripes, a sign
// board on legs, and the end face of the deck. Beyond it: the dark hills.
export function buildRoadEnd(ctx, tile) {
  const H = ctx.layout.highway;
  const pm = ctx.mb.plaster, ps = ctx.mb.propStatic;
  const x0 = H.minX, x1 = H.maxX, deck = H.height, zE = H.northEndZ;
  pm.color(0.55, 0.55, 0.55, 1).data(0, 0, 0, 0);
  // the end faces of the deck and of the crash walls
  pm.box(x0, deck - 1.4, zE - 0.1, x1, deck + 0.95, zE, tile, 'n');
  // jersey barriers across the road, 8 m before the end, white and red stripes that shine in the headlights
  const zb = zE - 8;
  for (let x = x0 + 0.6; x < x1 - 0.6; x += 2.05) {
    pm.color(0.78, 0.78, 0.76, 1);
    pm.box(x, deck, zb - 0.35, x + 1.95, deck + 0.35, zb + 0.35, tile, 'nsewt');
    pm.box(x + 0.12, deck + 0.35, zb - 0.16, x + 1.83, deck + 0.9, zb + 0.16, tile, 'nsewt');
    ps.color(0.85, 0.08, 0.06, 1).data(0.3, 0, 0, 0.55);
    ps.box(x + 0.25, deck + 0.5, zb - 0.172, x + 0.75, deck + 0.75, zb - 0.16, 1, 's');
    ps.box(x + 1.2, deck + 0.5, zb - 0.172, x + 1.7, deck + 0.75, zb - 0.16, 1, 's');
  }
  // a wide sign board on two legs behind the barriers (red and white chevrons, faintly lit at night)
  const sy = deck + 1.6;
  ps.color(0.2, 0.2, 0.22, 1).data(0.5, 0.6, 0, 0);
  ps.box(H.centerX - 6.2, deck, zb + 1.9, H.centerX - 6.0, sy + 2.0, zb + 2.1, 1, 'nsew');
  ps.box(H.centerX + 6.0, deck, zb + 1.9, H.centerX + 6.2, sy + 2.0, zb + 2.1, 1, 'nsew');
  ps.color(0.9, 0.9, 0.88, 1).data(0.4, 0, 0, 0.3);
  ps.box(H.centerX - 7, sy, zb + 1.8, H.centerX + 7, sy + 1.9, zb + 1.9, 1, 'nsewt');
  ps.color(0.86, 0.06, 0.05, 1).data(0.35, 0, 0, 0.6);
  for (let i = 0; i < 7; i++) {
    const x = H.centerX - 6.4 + i * 2.05;
    ps.quadAuto([x, sy + 0.2, zb + 1.79], [x + 0.7, sy + 0.95, zb + 1.79], [x + 1.15, sy + 0.95, zb + 1.79], [x + 0.45, sy + 0.2, zb + 1.79], [0, 0, -1], 1);
    ps.quadAuto([x + 0.45, sy + 1.7, zb + 1.79], [x + 1.15, sy + 0.95, zb + 1.79], [x + 0.7, sy + 0.95, zb + 1.79], [x, sy + 1.7, zb + 1.79], [0, 0, -1], 1);
  }
}
