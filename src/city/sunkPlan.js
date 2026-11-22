// ---------------------------------------------------------------------------
// sunkPlan.js - THE SUNK as plain data (Chapter 3).
//
// The Sunk is the old south-west quarter of Port Meridian, half under the
// sea. Its streets are canals 2 to 4 m deep; the old buildings stand in the
// water with their lower floors drowned. People (the Tidewalkers) live on the
// upper floors, on rooftops, on pontoons and on boats.
//
// This file only says WHERE things are. src/city/sunk.js builds them.
//
// COMPASS (the same as layout.js): +z north, -z south (the sea), +x WEST, -x east.
//
//   * WATER      canals and the market basin (rectangles). Everything else in the
//                zone is built land: the old blocks.
//   * BLOCKS     the old blocks between the canals; they are cut into buildings.
//   * SPECIAL    buildings of the story (Lena's flat, the Guard post, the pump hall
//                over the tunnel); they are built by hand in sunk.js.
//   * DECKS      where a person can walk: pontoons, gangways, ramps, roofs, the
//                floor of Lena's flat. Everything else in the zone is water or wall.
//   * NODES / EDGES  the canal map for boats: the GPS line and the Guard boats use it.
//   * PLACES     named points for the story (chapter03.js) and the map.
//
// The main canal RING runs around the inner quarter. Three side canals: RUSTWATER
// (from the city's quay, where Rustwater Dock is), the SEA GATE (out to the open
// sea) and the MARKET CUT (the narrow way into the market basin, where the
// Tidewalkers have their base). Under the old pump hall the DRAIN runs on as a
// tunnel down to the ring.
// ---------------------------------------------------------------------------

import { RNG } from '../utils/math.js';

export const SUNK = {
  minX: 476, maxX: 780, minZ: -470, maxZ: -86,   // the whole drowned quarter
  level: -1.0,          // the water (the same height as the sea)
  bed: -4.2,            // the old street, now the bottom of the canals
  floor: 3.5,           // one floor of the old buildings
};

const R = (minX, maxX, minZ, maxZ, more = {}) => ({ minX, maxX, minZ, maxZ, ...more });
const inRect = (r, x, z, m = 0) => x >= r.minX - m && x <= r.maxX + m && z >= r.minZ - m && z <= r.maxZ + m;

// ---- the water ----
export const WATER = [
  R(520, 740, -418, -400, { name: 'ring-south' }),
  R(520, 740, -150, -132, { name: 'ring-north' }),
  R(520, 538, -400, -150, { name: 'ring-east' }),
  R(722, 740, -400, -150, { name: 'ring-west' }),
  R(476, 520, -207, -189, { name: 'rustwater' }),   // side canal 1: from the city's quay
  R(612, 630, -470, -418, { name: 'sea-gate' }),    // side canal 2: out to the sea
  R(616, 628, -246, -150, { name: 'market-cut' }),  // side canal 3: the narrow way into the market
  R(584, 662, -322, -246, { name: 'market' }),      // the Tidewalker market (a wide basin)
  R(619, 627, -400, -322, { name: 'drain' }),       // the old storm drain (a tunnel under the pump hall)
  R(686, 692, -446, -418, { name: 'inlet' }),       // a narrow inlet between the two roofs of the Guard post
];

// ---- the old blocks (the zone minus the water) ----
export const BLOCKS = [
  R(476, 612, -470, -418, { name: 'south-east' }),
  R(630, 686, -470, -418, { name: 'south-mid' }),
  R(686, 692, -470, -446, { name: 'south-inlet' }),
  R(692, 780, -470, -418, { name: 'south-west' }),
  R(476, 520, -418, -207, { name: 'east-south' }),
  R(476, 520, -189, -86, { name: 'east-north' }),
  R(520, 780, -132, -86, { name: 'north' }),
  R(740, 780, -418, -132, { name: 'west' }),
  R(538, 584, -400, -150, { name: 'inner-east' }),
  R(584, 616, -246, -150, { name: 'inner-north-east' }),
  R(628, 662, -246, -150, { name: 'inner-north-west' }),
  R(662, 722, -400, -150, { name: 'inner-west' }),
  R(584, 619, -400, -322, { name: 'inner-south-east' }),
  R(627, 662, -400, -322, { name: 'inner-south-west' }),
].filter((b) => b.maxX > b.minX && b.maxZ > b.minZ);

// ---- buildings of the story (built by hand; the normal buildings keep away from them) ----
export const SPECIAL = {
  // LENA'S FLAT: a half-sunk building on the north side of the ring. Its first floor is open to the
  // canal (a broken loading door): the room inside has cables and screens. A pontoon in front of it.
  lena: R(690, 720, -132, -104, { top: 15.5, roomFloor: 1.2, roomTop: 4.4, room: R(692, 718, -128.5, -110), opening: [698, 714] }),
  // THE GUARD POST: two low roofs of an old market hall on the south side of the ring. A ramp up the
  // facade from a pontoon, a rope walkway over the inlet, the drone pad on the second roof.
  postA: R(662, 686, -446, -418, { top: 4.5 }),
  postB: R(692, 718, -452, -418, { top: 4.5 }),
  // THE PUMP HALL over the drain: the tunnel runs under it (a low arch at each end)
  pump: R(584, 662, -380, -340, { top: 9.5, tunnelTop: 2.7 }),
  // a low building beside the market with a roof terrace (a ramp goes up to it from the market platform)
  terrace: R(662, 690, -334, -300, { top: 3.0 }),
  // THE ROOF ROUTE west of Lena's flat (the raid): two lower roofs, stairs between them, a fire escape down to the canal
  w1: R(720, 731, -132, -111, { top: 12.0 }),
  w2: R(731, 742, -132, -113, { top: 8.5 }),
};

// ---- where a person can walk ----
// y = the height of a flat deck; a ramp has y0 at its min side and y1 at its max side (axis 'x' or 'z').
// kind: pontoon (a floating deck at the water), gangway, ramp, roof, floor, rope (a rope walkway), bridge
const PONTOON = SUNK.level + 0.38;
export const DECKS = [
  // RUSTWATER DOCK: a gangway from the end of the street down to a pontoon in the canal
  R(476, 484.5, -193, -189.2, { kind: 'gangway', y0: 0.0, y1: PONTOON, axis: 'x' }),
  R(484, 503, -193, -189.2, { kind: 'pontoon', y: PONTOON }),
  // THE MARKET: pontoons along the basin, a wide platform where the leader sits
  R(589, 613, -251, -246.2, { kind: 'pontoon', y: PONTOON }),
  R(631, 662, -251, -246.2, { kind: 'pontoon', y: PONTOON }),
  R(647, 661.8, -302, -251, { kind: 'pontoon', y: PONTOON, name: 'platform' }),
  R(584.2, 590, -316, -258, { kind: 'pontoon', y: PONTOON }),
  // (a ramp from the platform up to the roof terrace of the low building west of it)
  R(651, 657, -318, -302, { kind: 'ramp', y0: 3.0, y1: PONTOON, axis: 'z' }),
  R(651, 663.5, -322, -318, { kind: 'roof', y: 3.0 }),
  R(662, 690, -334, -300, { kind: 'roof', y: 3.0, name: 'terrace' }),
  // LENA'S FLAT: the pontoon, the steps up through the loading door, the room
  R(690, 720, -135.3, -132, { kind: 'pontoon', y: PONTOON, name: 'lenaDock' }),
  R(700, 712, -132, -128.5, { kind: 'ramp', y0: PONTOON, y1: 1.2, axis: 'z' }),
  R(692.2, 717.8, -128.5, -110.2, { kind: 'floor', y: 1.2, name: 'lenaRoom' }),
  // THE ROOF ROUTE (the raid): Lena's roof, steel stairs down to the next roofs, a fire escape, a pontoon
  R(690.3, 719.7, -131.7, -104.3, { kind: 'roof', y: 15.5, name: 'lenaRoof' }),
  R(719.4, 727.0, -124.8, -122.8, { kind: 'stair', y0: 15.5, y1: 12.0, axis: 'x' }),
  R(720.3, 730.7, -131.7, -111.3, { kind: 'roof', y: 12.0, name: 'w1Roof' }),
  R(729.8, 737.0, -127.8, -125.8, { kind: 'stair', y0: 12.0, y1: 8.5, axis: 'x' }),
  R(731.3, 741.7, -131.7, -113.3, { kind: 'roof', y: 8.5, name: 'w2Roof' }),
  R(738.0, 741.6, -134.0, -131.6, { kind: 'landing', y: 8.5 }),
  R(729.0, 738.2, -134.0, -132.2, { kind: 'stair', y0: 4.0, y1: 8.5, axis: 'x' }),
  R(726.8, 729.2, -134.0, -132.2, { kind: 'landing', y: 4.0 }),
  R(726.8, 736.0, -135.8, -133.9, { kind: 'stair', y0: 4.0, y1: PONTOON, axis: 'x' }),
  R(733.0, 741.5, -139.5, -135.6, { kind: 'pontoon', y: PONTOON, name: 'escapeDock' }),
  // THE GUARD POST: a pontoon, a ramp up the facade, roof A, the rope walkway, roof B with the drone pad
  R(662, 686, -418, -413.6, { kind: 'pontoon', y: PONTOON, name: 'postDock' }),
  R(666, 685, -418.3, -415.6, { kind: 'ramp', y0: 4.5, y1: PONTOON, axis: 'x' }),   // (it runs along the wall: the high end is at the east)
  R(662.2, 685.8, -445.8, -418.1, { kind: 'roof', y: 4.5, name: 'postRoofA' }),
  R(685.6, 692.4, -436, -433.6, { kind: 'rope', y: 4.5 }),
  R(692.2, 717.8, -451.8, -418.1, { kind: 'roof', y: 4.5, name: 'postRoofB' }),
];

// ---- named places for the story and the map ----
export const PLACES = {
  rustwater: { street: [462, -198], van: [467.5, -195.5], dock: [494, -191], boat: [496, -198.5], quay: [476, -198] },
  seaGate: [621, -446],
  ring: { ne: [529, -143], nw: [731, -143], sw: [731, -409], se: [529, -409] },
  market: { entry: [622, -240], center: [623, -284], dock: [640, -255], leader: [655, PONTOON, -287], platform: [654, PONTOON, -276], child: [661.6, -262], boat: [636, -258] },
  lena: { dock: [706, PONTOON, -133.6], boat: [706, -139.5], door: [706, -131], room: [705, 1.2, -119], desk: [705, 1.2, -112.5], lantern: [700.5, 1.2, -126.5],
    roof: [704, 15.5, -118], w1: [725, 12, -120], w2: [736, 8.5, -122], escapeTop: [740, 8.5, -132.8], escape: [737, PONTOON, -137.5], escapeBoat: [737, -144] },
  post: { dock: [672, PONTOON, -415], boat: [672, -408.5], rampTop: [665, 4.5, -416.8], roofA: [674, 4.5, -432], rope: [689, 4.5, -434.8], pad: [706, 4.5, -437], drone: [706, 4.5, -437] },
  tunnel: { north: [623, -332], south: [623, -392], minX: 617, maxX: 629, minZ: -382, maxZ: -338 },
};

// ---- the canal map for boats (the middle line of every canal) ----
export const NODES = {
  dock: [489, -198], rust: [529, -198],
  ne: [529, -143], cut: [622, -143], lena: [706, -143], nw: [731, -143],
  sw: [731, -409], post: [674, -409], gate: [621, -409], se: [529, -409],
  hubN: [622, -244], hub: [623, -284], hubS: [623, -324],
  sea: [621, -462], out: [621, -520],
};
export const EDGES = [
  ['dock', 'rust'], ['rust', 'ne'], ['rust', 'se'],
  ['ne', 'cut'], ['cut', 'lena'], ['lena', 'nw'], ['nw', 'sw'], ['sw', 'post'], ['post', 'gate'], ['gate', 'se'],
  ['cut', 'hubN'], ['hubN', 'hub'], ['hub', 'hubS'], ['hubS', 'gate'],
  ['gate', 'sea'], ['sea', 'out'],
];

// ---------------------------------------------------------------------------
// The normal buildings: every block is cut into lots (one old building each).
// Long blocks are cut along their length; deep ones also across. The story
// buildings (SPECIAL) are left out. Heights are above the water.
// ---------------------------------------------------------------------------
function makeBuildings() {
  const rng = new RNG(31);
  const out = [];
  const specials = Object.values(SPECIAL);
  const hitsSpecial = (r) => specials.some((s) => r.minX < s.maxX - 0.01 && r.maxX > s.minX + 0.01 && r.minZ < s.maxZ - 0.01 && r.maxZ > s.minZ + 0.01);
  for (const b of BLOCKS) {
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const alongX = w >= d;
    const len = alongX ? w : d, depth = alongX ? d : w;
    const rows = depth > 40 ? 2 : 1;
    for (let row = 0; row < rows; row++) {
      let s = 0;
      while (s < len - 0.5) {
        let piece = Math.min(len - s, rng.range(12, 26));
        if (len - s - piece < 9) piece = len - s;          // (no thin slivers at the end)
        const a = s, c = s + piece;
        const r0 = row / rows, r1 = (row + 1) / rows;
        const r = alongX
          ? R(b.minX + a, b.minX + c, b.minZ + d * r0, b.minZ + d * r1)
          : R(b.minX + w * r0, b.minX + w * r1, b.minZ + a, b.minZ + c);
        s = c;
        if (hitsSpecial(r)) {
          // cut the lot around the story building: keep the parts that are free
          for (const sp of specials) {
            if (!(r.minX < sp.maxX && r.maxX > sp.minX && r.minZ < sp.maxZ && r.maxZ > sp.minZ)) continue;
            const parts = [
              R(r.minX, sp.minX, r.minZ, r.maxZ), R(sp.maxX, r.maxX, r.minZ, r.maxZ),
              R(Math.max(r.minX, sp.minX), Math.min(r.maxX, sp.maxX), r.minZ, sp.minZ), R(Math.max(r.minX, sp.minX), Math.min(r.maxX, sp.maxX), sp.maxZ, r.maxZ),
            ];
            for (const p of parts) if (p.maxX - p.minX > 4 && p.maxZ - p.minZ > 4 && !hitsSpecial(p)) out.push(p);
          }
          continue;
        }
        out.push(r);
      }
    }
  }
  // heights, looks and roofs
  for (const r of out) {
    const big = (r.maxX - r.minX) * (r.maxZ - r.minZ);
    const roll = rng.next();
    // most are 2 to 5 floors above the water; now and then an old tower (half drowned)
    const floors = roll < 0.07 && big > 300 ? rng.int(8, 12) : roll < 0.3 ? rng.int(4, 6) : rng.int(1, 4);
    r.top = floors * SUNK.floor + rng.range(0.6, 1.4);
    r.mat = rng.chance(0.6) ? 'brick' : 'plaster';
    r.tint = rng.int(0, 5);
    r.seed = rng.int(1, 100000);
    r.shack = rng.chance(0.32);          // a hut of salvaged sheets on the roof
    r.solar = rng.chance(0.45);          // patched solar sheets
    r.antenna = rng.chance(0.4);         // a cluster of antennas
    r.tank = rng.chance(0.25);           // an old water tank
    r.balcony = rng.chance(0.35);        // rusty balconies on one side
  }
  return out;
}
export const BUILDINGS = makeBuildings();

// ---------------------------------------------------------------------------
// Bridges and rope walkways over the canals, only to look at: they hang between
// the roofs on both sides. [ax, az, bx, bz, kind] (both ends inside a building)
// ---------------------------------------------------------------------------
export const SPANS = [
  // steel bridges over the ring (between two roofs; sunk.js hangs them a little below the lower roof)
  [512, -300, 546, -300, 'steel'],
  [600, -126, 600, -156, 'steel'],
  [714, -200, 748, -200, 'steel'],
  [560, -392, 560, -426, 'steel'],
  // rope walkways (planks between two ropes, sagging in the middle)
  [608, -196, 636, -196, 'rope'],
  [714, -330, 748, -330, 'rope'],
  [512, -250, 546, -250, 'rope'],
  [652, -126, 652, -156, 'rope'],
];

// strings of lanterns over the water: [ax, az, bx, bz, y]
// (the lines below are drawn by hand; more lines across the ring are added further down)
export const LANTERN_LINES = [
  [590, -248, 590, -320, 4.2], [656, -248, 656, -320, 4.2], [600, -262, 646, -262, 5.0], [600, -306, 646, -306, 5.0],
  [480, -192, 516, -192, 3.6], [700, -133, 718, -133, 3.8], [622, -160, 622, -238, 4.6],
  [534, -180, 534, -230, 4.0], [731, -260, 731, -300, 4.4],
];

// more lanterns: a string across the ring canals every 40-50 m, hung between two facades, a little below
// the lower of the two roofs (never lower than 5 m over the street: the boats' antennas pass under them)
{
  const top = (x, z) => { const b = BUILDINGS.find((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ); return b ? b.top : null; };
  const across = [];
  for (let x = 548; x < 716; x += 46) across.push([x, -150.6, x, -131.4], [x + 9, -418.6, x + 9, -399.4]);
  for (let z = -372; z < -170; z += 48) across.push([519.4, z, 538.6, z], [721.4, z + 14, 740.6, z + 14]);
  across.push([611.4, -432, 630.6, -432]);
  for (const [ax, az, bx, bz] of across) {
    const ta = top(ax, az), tb = top(bx, bz);
    if (ta === null || tb === null) continue;
    const y = Math.min(ta, tb) - 0.7;
    if (y >= 5) LANTERN_LINES.push([ax, az, bx, bz, Math.min(y, 7.5)]);
  }
}

// ---------------------------------------------------------------------------
// helpers for the rest of the game
// ---------------------------------------------------------------------------
export const inSunk = (x, z, m = 0) => x >= SUNK.minX - m && x <= SUNK.maxX + m && z >= SUNK.minZ - m && z <= SUNK.maxZ + m;
export function inWater(x, z, m = 0) {
  for (const w of WATER) if (inRect(w, x, z, m)) return true;
  // south of the zone: the open sea
  return z < SUNK.minZ && x > SUNK.minX && x < SUNK.maxX;
}
// the height of a deck under (x, z) - the one nearest to the height y (null = no deck: water or wall)
export function deckHeight(x, z, y = 0, reach = 0.8) {
  let best = null, bd = 1e9;
  for (const d of DECKS) {
    if (!inRect(d, x, z)) continue;
    const h = deckAt(d, x, z), dd = Math.abs(h - y);
    if (dd < bd) { bd = dd; best = h; }
  }
  return best !== null && bd <= reach ? best : null;
}
// the height of one deck at (x, z) (a ramp rises along its axis)
export function deckAt(d, x, z) {
  if (d.y !== undefined) return d.y;
  const t = d.axis === 'x' ? (x - d.minX) / (d.maxX - d.minX) : (z - d.minZ) / (d.maxZ - d.minZ);
  return d.y0 + (d.y1 - d.y0) * Math.max(0, Math.min(1, t));
}
// the highest deck under (x, z), else the water (for things put on [x, z] by the story)
export function topAt(x, z) {
  let h = null;
  for (const d of DECKS) if (inRect(d, x, z)) { const y = deckAt(d, x, z); if (h === null || y > h) h = y; }
  return h === null ? SUNK.level : h;
}
// is the point inside the tunnel under the pump hall?
export const inTunnel = (x, z, m = 0) => inRect(PLACES.tunnel, x, z, m);
export { inRect };
