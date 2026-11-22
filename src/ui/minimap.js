// ---------------------------------------------------------------------------
// minimap.js - the small map in the top-right corner.
//
// The whole city is drawn ONCE into a hidden picture, straight from the
// layout data (blocks, roads, beach, ocean, highway, rail line).
// Every few frames we copy the part around the player onto the screen and
// draw the player arrow on top. North is always up.
//
// On top of the map picture we draw: the GPS route, the waypoint, the mission
// marker, dots for the traffic and an arrow (on foot) or a car shape (driving).
//
// The same hidden picture is used for the FULL-SCREEN MAP: it shows the whole
// walkable city with the district names; a tap sets a waypoint.
// ---------------------------------------------------------------------------

import { SUNK, WATER, BUILDINGS, SPECIAL, DECKS, SPANS, PLACES } from '../city/sunkPlan.js';

const SCALE = 0.5;   // pixels per meter in the hidden picture
const VIEW0 = 0.62;  // screen pixels per meter in the minimap (zoom)

export function createMinimap(canvas, layout) {
  const L = layout;
  // area covered by the hidden picture
  // (west: the city, or The Sunk of Chapter 3 - whichever reaches farther)
  const minX = L.city.minX - 60, maxX = Math.max(L.city.maxX, SUNK.maxX) + 60;
  const minZ = L.beach.minZ - 60, maxZ = L.city.maxZ + 60;
  const W = Math.ceil((maxX - minX) * SCALE), H = Math.ceil((maxZ - minZ) * SCALE);
  // world -> picture. East (-x) is on the right, north (+z) is at the top.
  const PX = (x) => (maxX - x) * SCALE;
  const PY = (z) => (maxZ - z) * SCALE;

  const map = document.createElement('canvas');
  map.width = W;
  map.height = H;
  const g = map.getContext('2d');

  // roads: everything starts as "road" color, then we draw the rest on top
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, W, H);
  // ocean and beach
  g.fillStyle = '#1f4254';
  g.fillRect(0, PY(L.beach.minZ), W, H - PY(L.beach.minZ));
  g.fillStyle = '#8a7f66';
  g.fillRect(0, PY(L.beach.maxZ), W, PY(L.beach.minZ) - PY(L.beach.maxZ));
  // beach walk
  g.fillStyle = '#5a5d60';
  g.fillRect(0, PY(L.neon.promenadeMaxZ), W, PY(L.neon.promenadeMinZ) - PY(L.neon.promenadeMaxZ));
  // blocks (the diagonal avenue is simply the gap between the cut blocks)
  for (const b of L.blocks) {
    g.fillStyle = !b.playable ? '#1b1d21' : b.district === 'neon' ? '#2c2531' : '#202327';
    g.beginPath();
    b.poly.forEach((p, i) => (i === 0 ? g.moveTo(PX(p.x), PY(p.z)) : g.lineTo(PX(p.x), PY(p.z))));
    g.closePath();
    g.fill();
  }
  // alleys are narrow roads
  g.fillStyle = '#303338';
  for (const a of L.alleyRects) g.fillRect(PX(a.maxX), PY(a.maxZ), (a.maxX - a.minX) * SCALE, (a.maxZ - a.minZ) * SCALE);
  // median of Neon Mile
  g.fillStyle = '#35523f';
  for (const [x0, x1] of L.medianPieces) g.fillRect(PX(x1), PY(L.median.maxZ), (x1 - x0) * SCALE, Math.max(1.5, (L.median.maxZ - L.median.minZ) * SCALE));
  // light-rail line
  g.strokeStyle = '#3fb8a8';
  g.lineWidth = 1.6;
  g.setLineDash([5, 3]);
  g.beginPath();
  g.moveTo(PX(L.rail.x), PY(L.rail.southEndZ));
  g.lineTo(PX(L.rail.x), PY(maxZ));
  g.stroke();
  g.setLineDash([]);
  // highway
  g.fillStyle = '#6a6e75';
  g.fillRect(PX(L.highway.maxX), 0, L.highway.width * SCALE, PY(L.highway.rampBottomZ));
  g.strokeStyle = '#8d9199';
  g.lineWidth = 1;
  g.strokeRect(PX(L.highway.maxX) + 0.5, -1, L.highway.width * SCALE - 1, PY(L.highway.rampBottomZ) + 1);
  // THE SUNK (Chapter 3): canals, the old buildings standing in them, pontoons, the tunnel, bridges
  {
    const rect = (r, inset = 0) => g.fillRect(PX(r.maxX) + inset, PY(r.maxZ) + inset, (r.maxX - r.minX) * SCALE - inset * 2, (r.maxZ - r.minZ) * SCALE - inset * 2);
    g.fillStyle = '#1b2427';
    rect(SUNK);
    g.fillStyle = '#16464c';
    for (const w of WATER) rect(w);
    for (const b of BUILDINGS) { g.fillStyle = '#23272b'; rect(b); g.fillStyle = '#2a2f34'; rect(b, 1.2); }
    // the story buildings a little brighter: Lena's flat, the Guard post, the pump hall
    g.fillStyle = '#3a3330';
    rect(SPECIAL.lena);
    g.fillStyle = '#2e3640';
    rect(SPECIAL.postA); rect(SPECIAL.postB);
    g.fillStyle = '#30302c';
    rect(SPECIAL.pump); rect(SPECIAL.terrace);
    // pontoons and ramps
    g.fillStyle = '#8a6f4a';
    for (const d of DECKS) if (d.kind !== 'roof' && d.kind !== 'floor') rect(d);
    // the drain under the pump hall (a dashed line: the tunnel)
    const t = PLACES.tunnel;
    g.strokeStyle = '#2d7e86'; g.lineWidth = 3; g.setLineDash([3, 2]);
    g.beginPath(); g.moveTo(PX((t.minX + t.maxX) / 2), PY(t.minZ - 2)); g.lineTo(PX((t.minX + t.maxX) / 2), PY(t.maxZ + 2)); g.stroke();
    g.setLineDash([]);
    // bridges and rope walkways
    g.strokeStyle = 'rgba(150,120,90,0.8)'; g.lineWidth = 1.2;
    for (const [ax, az, bx, bz] of SPANS) { g.beginPath(); g.moveTo(PX(ax), PY(az)); g.lineTo(PX(bx), PY(bz)); g.stroke(); }
  }
  // edge of the play area (the old city, and The Sunk south-west of it)
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1;
  const B = L.bounds, oldX = L.raw.oldWestEdge || B.maxX;
  g.beginPath();
  for (const [x, z] of [[B.minX, B.minZ], [B.maxX, B.minZ], [B.maxX, SUNK.maxZ], [oldX, SUNK.maxZ], [oldX, B.maxZ], [B.minX, B.maxZ]]) g.lineTo(PX(x), PY(z));
  g.closePath();
  g.stroke();

  const ctx = canvas.getContext('2d');
  let size = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth || 120;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  resize();

  // Draw the minimap. heading: the player's angle (0 = north).
  //   extra: { inCar, cars: [{x, z, alive}], waypoint: {x, z}, marker: {x, z}, route: [{x, z}],
  //            wanted: the Guard (see wanted.js mapView: units with view cones, search area, scanner gates, roadblock),
  //            view: screen pixels per meter (smaller = more of the city) }
  let checkSize = 0;
  function draw(x, z, heading, extra = {}) {
    // (the map can change its size on the page: while wanted it is a little bigger)
    if (--checkSize <= 0) { checkSize = 20; if ((canvas.clientWidth || 120) !== size) resize(); }
    const VIEW = extra.view || VIEW0;
    const s = size * dpr;
    const zoom = (VIEW / SCALE) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    // round window
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#16181b';
    ctx.fillRect(0, 0, s, s);
    ctx.imageSmoothingEnabled = true;
    ctx.translate(s / 2, s / 2);
    ctx.scale(zoom, zoom);
    ctx.drawImage(map, -PX(x), -PY(z));
    ctx.restore();

    // world -> minimap pixels (east is on the right, north at the top)
    const k = VIEW * dpr;
    const MX = (wx) => s / 2 + (x - wx) * k, MY = (wz) => s / 2 + (z - wz) * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.clip();
    // GPS route along the roads
    if (extra.route && extra.route.length > 1) {
      ctx.beginPath();
      extra.route.forEach((p, i) => (i === 0 ? ctx.moveTo(MX(p.x), MY(p.z)) : ctx.lineTo(MX(p.x), MY(p.z))));
      ctx.strokeStyle = '#ffc94a';
      ctx.lineWidth = 3 * dpr;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    // the Meridian Guard: where they search, what they see, the scanner gates
    if (extra.wanted) drawWanted(ctx, extra.wanted, MX, MY, k, s, extra.time || 0);
    // the other cars: small dots
    if (extra.cars) {
      ctx.fillStyle = 'rgba(190,215,255,0.9)';
      for (const c of extra.cars) {
        if (!c.alive) continue;
        const cx = MX(c.x), cy = MY(c.z);
        if (cx < 0 || cx > s || cy < 0 || cy > s) continue;
        ctx.fillRect(cx - 1.4 * dpr, cy - 1.4 * dpr, 2.8 * dpr, 2.8 * dpr);
      }
    }
    ctx.restore();
    // waypoint and mission marker: when they are outside the map they stick to its edge
    const pin = (p, color, square) => {
      let px = MX(p.x) - s / 2, py = MY(p.z) - s / 2;
      const len = Math.hypot(px, py), max = s / 2 - 6 * dpr;
      if (len > max) { px *= max / len; py *= max / len; }
      ctx.save();
      ctx.translate(s / 2 + px, s / 2 + py);
      if (square) ctx.rotate(Math.PI / 4);
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.5 * dpr;
      const q = 4.2 * dpr;
      ctx.beginPath();
      if (square) ctx.rect(-q, -q, q * 2, q * 2); else ctx.arc(0, 0, q * 1.15, 0, 7);
      ctx.stroke(); ctx.fill();
      ctx.restore();
    };
    if (extra.marker) pin(extra.marker, '#ffc94a', true);
    if (extra.waypoint) pin(extra.waypoint, '#ff5a4a', false);

    // the player in the middle: an arrow on foot, a car shape when driving
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(-heading);
    const a = 6.5 * dpr;
    ctx.beginPath();
    if (extra.inCar) {
      // small car seen from above, the nose a little narrower
      ctx.moveTo(-a * 0.5, -a * 1.25); ctx.lineTo(a * 0.5, -a * 1.25); ctx.lineTo(a * 0.68, -a * 0.5);
      ctx.lineTo(a * 0.68, a * 1.2); ctx.lineTo(-a * 0.68, a * 1.2); ctx.lineTo(-a * 0.68, -a * 0.5);
    } else {
      ctx.moveTo(0, -a * 1.25);
      ctx.lineTo(a * 0.8, a * 0.9);
      ctx.lineTo(0, a * 0.45);
      ctx.lineTo(-a * 0.8, a * 0.9);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
    ctx.fill();
    if (extra.inCar) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-a * 0.46, -a * 0.5, a * 0.92, a * 0.55); } // windscreen
    ctx.restore();

    // thin ring and a small "N"
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 0.75 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(9 * dpr)}px "Helvetica Neue", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', s / 2, 4 * dpr);
  }

  // The Guard on the map. W = { units: [{ x, z, heading, range, fov, kind: 'car' | 'drone', alert }], search: { x, z, r }, gates, block }
  function drawWanted(c, W, MX, MY, k, s, time) {
    const out = (px, py, m) => px < -m || px > s + m || py < -m || py > s + m;
    // the area they search: a soft circle with a broken edge
    if (W.search) {
      const cx = MX(W.search.x), cy = MY(W.search.z), r = W.search.r * k;
      c.fillStyle = 'rgba(255,170,60,0.1)';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.setLineDash([4 * dpr, 4 * dpr]); c.strokeStyle = 'rgba(255,185,80,0.8)'; c.lineWidth = 1.5 * dpr; c.stroke(); c.setLineDash([]);
    }
    // scanner gates: a short bar across the road (red after it has read a plate)
    for (const g of W.gates || []) {
      const gx = MX(g.x), gy = MY(g.z);
      if (out(gx, gy, 20 * dpr)) continue;
      const half = g.half * k + 2 * dpr;
      c.strokeStyle = g.alarm > 0 ? '#ff5a4a' : '#7fe0b8'; c.lineWidth = 3.2 * dpr; c.lineCap = 'round';
      c.beginPath();
      if (g.axis === 'z') { c.moveTo(gx - half, gy); c.lineTo(gx + half, gy); } else { c.moveTo(gx, gy - half); c.lineTo(gx, gy + half); }
      c.stroke(); c.lineCap = 'butt';
    }
    // what each of them sees. (Never drawn smaller than 26 pixels: on a phone the cones must be easy to read.)
    for (const u of W.units) {
      const ux = MX(u.x), uy = MY(u.z), r = Math.max(u.range * k, 26 * dpr);
      if (out(ux, uy, r)) continue;
      const a = Math.atan2(-Math.cos(u.heading), -Math.sin(u.heading));
      c.beginPath();
      if (u.fov >= Math.PI - 0.01) c.arc(ux, uy, r, 0, Math.PI * 2);
      else { c.moveTo(ux, uy); c.arc(ux, uy, r, a - u.fov, a + u.fov); c.closePath(); }
      c.fillStyle = u.alert ? 'rgba(255,70,55,0.34)' : u.kind === 'drone' ? 'rgba(130,175,255,0.2)' : 'rgba(255,205,95,0.22)';
      c.fill();
      c.strokeStyle = u.alert ? 'rgba(255,95,75,0.85)' : u.kind === 'drone' ? 'rgba(150,190,255,0.55)' : 'rgba(255,215,125,0.55)';
      c.lineWidth = 1 * dpr; c.stroke();
    }
    // the units themselves: Guard cars (red and blue, slowly changing), drones (a small white diamond)
    const red = (time * 1.4) % 1 < 0.5;
    for (const u of W.units) {
      const ux = MX(u.x), uy = MY(u.z);
      if (out(ux, uy, 6)) continue;
      c.save(); c.translate(ux, uy);
      if (u.kind === 'drone') {
        c.rotate(Math.PI / 4); c.fillStyle = '#e8f0ff'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.2 * dpr;
        const q = 3 * dpr; c.beginPath(); c.rect(-q, -q, q * 2, q * 2); c.fill(); c.stroke();
      } else {
        c.rotate(-u.heading); c.fillStyle = red ? '#ff4a3a' : '#4a7aff'; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 1.2 * dpr;
        const w = 2.6 * dpr, h = 4.2 * dpr; c.beginPath(); c.rect(-w, -h, w * 2, h * 2); c.fill(); c.stroke();
      }
      c.restore();
    }
    // a roadblock: a red cross
    if (W.block) {
      const bx = MX(W.block.x), by = MY(W.block.z), q = 5 * dpr;
      if (!out(bx, by, 8)) { c.strokeStyle = '#ff4a3a'; c.lineWidth = 2.6 * dpr; c.beginPath(); c.moveTo(bx - q, by - q); c.lineTo(bx + q, by + q); c.moveTo(bx + q, by - q); c.lineTo(bx - q, by + q); c.stroke(); }
    }
  }

  // =========================================================================
  // THE FULL-SCREEN MAP
  // =========================================================================
  // It shows the walkable city, fitted into the screen. bigToWorld() turns a
  // tap into a place in the world.
  let big = null; // { cx, cy, k } after the last drawBig
  const midX = (B.minX + B.maxX) / 2, midZ = (B.minZ + B.maxZ) / 2;
  const NAMES = [
    { text: 'THE GRID', x: -120, z: 110 },
    { text: 'NEON MILE', x: -20, z: L.neon.centerZ + 40 },
    { text: 'THE CROWN', x: 360, z: 400 },
    { text: 'THE SUNK', x: 640, z: -280 },
  ];
  function drawBig(cv, x, z, heading, extra = {}) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    // leave room for the title (top) and the buttons (bottom)
    const k = Math.min((w - 20 * d) / (B.maxX - B.minX + 40), (h - 120 * d) / (B.maxZ - B.minZ + 40));
    const cx = w / 2, cy = h / 2 - 6 * d;
    big = { cx: cx / d, cy: cy / d, k: k / d };
    const BX = (wx) => cx + (midX - wx) * k, BY = (wz) => cy + (midZ - wz) * k;
    c.save();
    c.beginPath();
    c.rect(BX(B.maxX + 20), BY(B.maxZ + 20), (B.maxX - B.minX + 40) * k, (B.maxZ - B.minZ + 40) * k);
    c.clip();
    c.drawImage(map, BX(maxX), BY(maxZ), (maxX - minX) * k, (maxZ - minZ) * k);
    c.restore();
    // district names
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `${Math.round(Math.max(11, 26 * k / d) * d)}px "Helvetica Neue", Roboto, Arial, sans-serif`;
    for (const n of NAMES) {
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillText(n.text, BX(n.x) + d, BY(n.z) + d);
      c.fillStyle = 'rgba(255,255,255,0.82)';
      c.fillText(n.text, BX(n.x), BY(n.z));
    }
    if (extra.route && extra.route.length > 1) {
      c.beginPath();
      extra.route.forEach((p, i) => (i === 0 ? c.moveTo(BX(p.x), BY(p.z)) : c.lineTo(BX(p.x), BY(p.z))));
      c.strokeStyle = '#ffc94a'; c.lineWidth = 3 * d; c.lineJoin = 'round'; c.stroke();
    }
    if (extra.cars) {
      c.fillStyle = 'rgba(190,215,255,0.85)';
      for (const car of extra.cars) if (car.alive) c.fillRect(BX(car.x) - 1.5 * d, BY(car.z) - 1.5 * d, 3 * d, 3 * d);
    }
    const dot = (p, color, r) => { c.beginPath(); c.arc(BX(p.x), BY(p.z), r * d, 0, 7); c.fillStyle = color; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.5 * d; c.stroke(); c.fill(); };
    if (extra.marker) dot(extra.marker, '#ffc94a', 6);
    if (extra.waypoint) dot(extra.waypoint, '#ff5a4a', 6);
    // the scanner gates and the search area of the Guard (they help to plan a way through side streets)
    if (extra.wanted) {
      const W = extra.wanted;
      if (W.search) { c.fillStyle = 'rgba(255,170,60,0.12)'; c.beginPath(); c.arc(BX(W.search.x), BY(W.search.z), W.search.r * k, 0, Math.PI * 2); c.fill(); }
      for (const g of W.gates || []) {
        const gx = BX(g.x), gy = BY(g.z), half = Math.max(4 * d, g.half * k);
        c.strokeStyle = g.alarm > 0 ? '#ff5a4a' : '#7fe0b8'; c.lineWidth = 3 * d;
        c.beginPath(); if (g.axis === 'z') { c.moveTo(gx - half, gy); c.lineTo(gx + half, gy); } else { c.moveTo(gx, gy - half); c.lineTo(gx, gy + half); } c.stroke();
      }
    }
    // the player
    c.save();
    c.translate(BX(x), BY(z));
    c.rotate(-heading);
    const a = 8 * d;
    c.beginPath(); c.moveTo(0, -a * 1.25); c.lineTo(a * 0.8, a * 0.9); c.lineTo(0, a * 0.45); c.lineTo(-a * 0.8, a * 0.9); c.closePath();
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.5 * d; c.stroke(); c.fill();
    c.restore();
  }
  // screen position of a tap (CSS pixels inside the map canvas) -> place in the world, or null outside the city
  function bigToWorld(px, py) {
    if (!big) return null;
    const wx = midX - (px - big.cx) / big.k, wz = midZ - (py - big.cy) / big.k;
    if (wx < B.minX || wx > B.maxX || wz < B.minZ || wz > B.maxZ) return null;
    return { x: wx, z: wz };
  }

  return { draw, resize, drawBig, bigToWorld };
}
