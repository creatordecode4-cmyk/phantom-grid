// ---------------------------------------------------------------------------
// layout.js - the MAP of Port Meridian as plain data.
//
// Everything about where streets, blocks and districts are is written here,
// so you can edit the city without touching the 3D code.
//
// COMPASS (top-down view, like the satellite map):
//
//                 NORTH (+Z)
//                     ^
//     WEST (+X)  <----+---->  EAST (-X)
//                     v
//                 SOUTH (-Z)   <- the ocean is here
//
// All sizes are in meters.
// ---------------------------------------------------------------------------

import { clipConvex, polygonArea, polygonBounds, pointInConvex } from '../utils/math.js';
import { SUNK, inSunk, topAt } from './sunkPlan.js';

export const LAYOUT = {
  seed: 2090, // change this number to get different (but still repeatable) buildings

  // The player cannot walk outside this rectangle (about 1000 m x 1000 m).
  // (Chapter 3: the play area reaches west over The Sunk, the drowned quarter - only south of z = -86;
  //  north of it an invisible wall keeps the old edge at x = 472.4, see src/city/sunk.js)
  bounds: { minX: -497, maxX: 780, minZ: -476, maxZ: 495.4 },
  oldWestEdge: 472.4,

  // ----- TRAFFIC ---------------------------------------------------------------
  // Cars drive on the right, in the inner lane of every street.
  traffic: {
    laneOffset: 1.75,      // the inner lane is this far from the middle of a street
    neonLaneOffset: 1.9,   // on Neon Mile: this far from the edge of the palm strip
    turnRight: 4.5,        // radius of a right turn (meters)
    turnLeft: 8.0,         // radius of a left turn
  },

  // ----- THE GRID: street grid ------------------------------------------------
  street: {
    width: 14,        // curb to curb (2 lanes each way, 3.5 m per lane)
    sidewalk: 3,      // sidewalk width
    curbHeight: 0.15, // sidewalks are this much higher than the road
  },
  block: {
    width: 80,        // east-west size of one block (sidewalks included)
    depth: 100,       // north-south size of one block
  },
  // Blocks are made in columns (east -> west) and rows (south -> north).
  columns: {
    firstBlockMinX: -470, // east edge of the first column of blocks
    playable: 10,         // columns the player can reach
    backdrop: 2,          // extra columns outside the play area (just scenery)
  },
  rows: {
    firstGridRowMinZ: -305, // south edge of the first row of The Grid
    playable: 7,
    backdrop: 2,
  },

  // A few blocks are split in two by a narrow alley.
  //   col / row: which block (row 1 is the first Grid row)
  //   axis 'x': the alley runs east-west.  axis 'z': it runs north-south.
  alleyWidth: 5,
  alleys: [
    { col: 1, row: 1, axis: 'z' },
    { col: 6, row: 1, axis: 'x', clear: true },   // story: the backstreet of the pickup (kept free of dumpsters)
    { col: 3, row: 2, axis: 'x' },
    { col: 8, row: 2, axis: 'z' },
    { col: 0, row: 3, axis: 'x' },
    { col: 5, row: 4, axis: 'z' },
    { col: 2, row: 5, axis: 'x' },
    { col: 7, row: 5, axis: 'z' },
    { col: 4, row: 6, axis: 'x', clear: true },   // story: the alley where chapter 1 ends
    { col: 1, row: 7, axis: 'z' },
    { col: 6, row: 7, axis: 'x' },
  ],

  // ----- The diagonal avenue (north-west -> south-east) -----------------------
  avenue: {
    name: 'Calloway Diagonal',
    from: { x: 500, z: 520 },   // north-west end
    to: { x: -342, z: -392 },   // south-east end (joins Neon Mile)
    width: 18,                  // curb to curb
    sidewalk: 3.5,
  },

  // ----- NEON MILE (south edge) ------------------------------------------------
  neonMile: {
    name: 'Neon Mile',
    centerZ: -392,
    width: 26,          // curb to curb
    medianWidth: 4,     // strip of palm trees in the middle
    blockDepth: 60,     // the row of shops north of the boulevard
    sidewalk: 5,        // wide sidewalk in front of the shops
    promenade: 5,       // paved walk between the road and the beach
  },

  // ----- BEACH + OCEAN ----------------------------------------------------------
  beach: {
    width: 60,          // sand between the promenade and the water
  },
  ocean: {
    level: -1.0,        // water height (the beach slopes down to this)
  },

  // ----- IRONHILL HIGHWAY (east edge, raised on pillars) ------------------------
  highway: {
    name: 'Ironhill Highway',
    centerX: -485,
    width: 26,
    height: 8,          // road surface height
    pillarSpacing: 40,
    northEndZ: 950,
    rampTopZ: -236,     // south of here the road slopes down ...
    rampBottomZ: -376,  // ... and reaches the ground at Neon Mile
  },

  // ----- Raised light-rail line (near-future touch) ------------------------------
  rail: {
    name: 'Meridian Maglev',
    streetIndex: 5,     // runs above this north-south street (0 = most eastern)
    height: 7.2,        // top of the track
    pillarSpacing: 28,
    southEndZ: -296,
    northEndZ: 760,
    stationZ: 88,       // middle of the raised station
  },

  // ----- THE CROWN (downtown skyline, north-west, outside the play area) ---------
  crown: {
    centerX: 600,
    centerZ: 900,
    radius: 300,
    towers: 34,
    minHeight: 60,
    maxHeight: 220,
    kvi: { x: 540, z: 800, height: 260 }, // Kessler-Vance (KVI) headquarters
  },

  // ----- Dry hills on the horizon -------------------------------------------------
  hills: {
    northZ: 1500,   // where the north hills start
    eastX: -1350,   // where the east hills start
  },

  // ----- Hero buildings ------------------------------------------------------------
  // The hand-made hero buildings (src/city/heroBuildings.js) stand on these lots.
  //   id: which hero,  col / row: which block,  front: which way it looks
  //   at: 'sw' 'se' 'nw' 'ne' = a corner of the block (s = south, w = west ...),
  //       's' 'n' 'e' 'w' = middle of that side
  heroSites: [
    { id: 'b05', col: 4, row: 4, at: 'nw', front: 'W' },   // villa cluster: right beside the start point
    { id: 'b03', col: 4, row: 4, at: 'sw', front: 'W' },   // garden midrise: first corner south of the start
    { id: 'g01', col: 4, row: 4, at: 'w', front: 'W', shift: -8 },  // Mace's garage (story): between the two, at the start street
    { id: 'g02', col: 4, row: 7, at: 'w', front: 'W' },    // the old car park with the flooded floor (story, Chapter 2)
    { id: 'b08', col: 5, row: 5, at: 'se', front: 'E' },   // retrofit brick tower: first corner north of the start
    { id: 'b04', col: 4, row: 0, at: 'sw', front: 'S' },   // office hub: where the start street meets Neon Mile
    { id: 'b07', col: 5, row: 0, at: 'se', front: 'S' },   // drone + EV hub: the other side of that junction
    { id: 'b09', col: 6, row: 0, at: 's', front: 'S' },    // arcade, Neon Mile
    { id: 'b06', col: 3, row: 0, at: 's', front: 'S' },    // beach hotel, Neon Mile
    { id: 'b11', col: 7, row: 0, at: 's', front: 'S' },    // hourglass tower, Neon Mile
    { id: 'b01', col: 9, row: 6, at: 'e', front: 'E' },    // twist tower, The Crown
    { id: 'b10', col: 9, row: 5, at: 'e', front: 'E' },    // S-curve tower, The Crown
    { id: 'b02', col: 7, row: 7, at: 'sw', front: 'S' },   // terrace tower, The Crown
    { id: 'b11', col: 7, row: 7, at: 'ne', front: 'E' },   // second hourglass tower, The Crown
  ],
  // Extra model files (hero1.glb ... hero4.glb or buildings.json) stand on these lots.
  modelLots: [
    { col: 2, row: 3, at: 'sw', front: 'S', width: 24, depth: 24 },
    { col: 6, row: 2, at: 'ne', front: 'N', width: 24, depth: 24 },
    { col: 3, row: 5, at: 'se', front: 'E', width: 24, depth: 24 },
    { col: 1, row: 4, at: 'nw', front: 'N', width: 24, depth: 24 },
  ],
  // The north-west corner of the map belongs to The Crown: blocks where
  // (column + row) is at least this number get tall towers.
  crownFrom: 14,

  // ----- Scanner gates of the Meridian Guard (src/ai/wanted.js) ----------------------
  // Frames over the road that read plates and faces. A wanted driver who passes
  // under one is seen at once. They stand on the main roads; side streets have none.
  //   road: 'ns' (c = the street's x) | 'ew' (c = the street's z) | 'neon' (Neon Mile),  at: where along it
  scanGates: [
    { road: 'ew', c: 144, at: -148 },   // the two blocks between the start street and the old market
    { road: 'ew', c: 144, at: -54 },
    { road: 'ns', c: -195, at: 87 },
    { road: 'ns', c: -101, at: 87 },
    { road: 'ns', c: -7, at: 201 },     // the start street, north of Mace's garage
    { road: 'ns', c: -7, at: -141 },    // the start street, toward the ocean
    { road: 'neon', at: -150 },         // Neon Mile
    { road: 'ns', c: 181, at: -141 },
    { road: 'ew', c: 372, at: 275 },    // The Crown
  ],

  // ----- Where the player starts ----------------------------------------------------
  spawn: {
    x: -15.8,          // on the sidewalk on the east side of the street
    z: 108,
    facingDeg: 180,    // compass direction: 180 = south (toward the ocean)
  },
};

// ---------------------------------------------------------------------------
// buildLayout() turns the numbers above into lists that the rest of the game
// uses: streets, blocks (as polygons), intersections and so on.
// ---------------------------------------------------------------------------
export function buildLayout(L = LAYOUT) {
  const S = L.street;
  const pitchX = L.block.width + S.width;   // distance from one block to the next
  const pitchZ = L.block.depth + S.width;
  const totalCols = L.columns.playable + L.columns.backdrop;
  const totalRows = 1 + L.rows.playable + L.rows.backdrop; // row 0 = Neon Mile row

  // ---- Neon Mile, beach and ocean lines (all measured from the boulevard) ----
  const nm = L.neonMile;
  const neon = {
    name: nm.name,
    centerZ: nm.centerZ,
    width: nm.width,
    medianWidth: nm.medianWidth,
    roadMinZ: nm.centerZ - nm.width / 2,      // south curb
    roadMaxZ: nm.centerZ + nm.width / 2,      // north curb
    sidewalk: nm.sidewalk,
  };
  neon.promenadeMinZ = neon.roadMinZ - nm.promenade;
  neon.promenadeMaxZ = neon.roadMinZ;
  const beach = {
    maxZ: neon.promenadeMinZ,                 // top of the sand
    minZ: neon.promenadeMinZ - L.beach.width, // water line
  };

  // ---- Block columns and rows ---------------------------------------------------
  const cols = [];
  for (let c = 0; c < totalCols; c++) {
    const minX = L.columns.firstBlockMinX + c * pitchX;
    cols.push({ index: c, minX, maxX: minX + L.block.width, playable: c < L.columns.playable });
  }
  const rows = [];
  rows.push({ index: 0, minZ: neon.roadMaxZ, maxZ: neon.roadMaxZ + nm.blockDepth, playable: true, neon: true });
  for (let r = 0; r < L.rows.playable + L.rows.backdrop; r++) {
    const minZ = L.rows.firstGridRowMinZ + r * pitchZ;
    rows.push({ index: r + 1, minZ, maxZ: minZ + L.block.depth, playable: r < L.rows.playable, neon: false });
  }

  // City limits (where the generated blocks end).
  const cityMinX = cols[0].minX;
  const cityMaxX = cols[totalCols - 1].maxX;
  const cityMinZ = rows[0].minZ;
  const cityMaxZ = rows[totalRows - 1].maxZ;

  // ---- Streets --------------------------------------------------------------------
  // North-south streets sit just WEST (+X) of each block column.
  const streetsNS = [];
  for (let c = 0; c < totalCols - 1; c++) {
    streetsNS.push({
      index: c,
      axis: 'ns',
      center: cols[c].maxX + S.width / 2,
      width: S.width,
      start: neon.roadMaxZ,   // south end (meets Neon Mile)
      end: cityMaxZ,          // north end
      playable: c < L.columns.playable,
    });
  }
  // East-west streets sit just NORTH (+Z) of each block row.
  const streetsEW = [];
  for (let r = 0; r < totalRows - 1; r++) {
    streetsEW.push({
      index: r,
      axis: 'ew',
      center: rows[r].maxZ + S.width / 2,
      width: S.width,
      start: cityMinX,        // east end
      end: cityMaxX,          // west end
      playable: r < 1 + L.rows.playable,
    });
  }

  // ---- The diagonal avenue ------------------------------------------------------------
  const av = L.avenue;
  const adx = av.to.x - av.from.x;
  const adz = av.to.z - av.from.z;
  const alen = Math.hypot(adx, adz);
  const avenue = {
    name: av.name,
    ax: av.from.x, az: av.from.z, bx: av.to.x, bz: av.to.z,
    dirX: adx / alen, dirZ: adz / alen,       // direction along the avenue
    nx: -adz / alen, nz: adx / alen,          // sideways direction
    halfWidth: av.width / 2,
    width: av.width,
    sidewalk: av.sidewalk,
    length: alen,
  };
  // Signed sideways distance from the avenue center line.
  avenue.sideDist = (x, z) => (x - avenue.ax) * avenue.nx + (z - avenue.az) * avenue.nz;
  // Distance along the avenue from its north-west end.
  avenue.alongDist = (x, z) => (x - avenue.ax) * avenue.dirX + (z - avenue.az) * avenue.dirZ;

  // ---- Blocks ---------------------------------------------------------------------------
  // A block is a convex polygon. Each corner point also stores info about the
  // edge that starts there:  { type, sidewalk }
  //   type 'street' | 'neon' | 'avenue' | 'alley'
  const blocks = [];
  const alleyFor = (c, r) => L.alleys.find((a) => a.col === c && a.row === r) || null;

  function addBlock(rect, c, r, edgeInfo, extra = {}) {
    // Corner order: counter-clockwise in the (x, z) plane.
    //   edge 0 = south side, edge 1 = west side (+X), edge 2 = north side, edge 3 = east side (-X)
    let poly = [
      { x: rect.minX, z: rect.minZ, edge: edgeInfo.s },
      { x: rect.maxX, z: rect.minZ, edge: edgeInfo.w },
      { x: rect.maxX, z: rect.maxZ, edge: edgeInfo.n },
      { x: rect.minX, z: rect.maxZ, edge: edgeInfo.e },
    ];
    const avEdge = { type: 'avenue', sidewalk: av.sidewalk };
    // Is the block touched by the avenue? Then cut it into the two leftover pieces.
    let minD = Infinity, maxD = -Infinity;
    for (const p of poly) {
      const d = avenue.sideDist(p.x, p.z);
      minD = Math.min(minD, d);
      maxD = Math.max(maxD, d);
    }
    const hw = avenue.halfWidth;
    const pieces = [];
    if (minD >= hw || maxD <= -hw) {
      pieces.push({ poly, isRect: true });
    } else {
      // Piece on the +n side of the avenue, and piece on the -n side.
      const cA = -(avenue.nx * avenue.ax + avenue.nz * avenue.az);
      const p1 = clipConvex(poly, avenue.nx, avenue.nz, cA - hw, avEdge);
      const p2 = clipConvex(poly, -avenue.nx, -avenue.nz, -cA - hw, avEdge);
      for (const p of [p1, p2]) {
        if (p.length >= 3 && polygonArea(p) > 30) pieces.push({ poly: p, isRect: false });
      }
    }
    for (const piece of pieces) {
      const b = polygonBounds(piece.poly);
      blocks.push({
        id: blocks.length,
        col: c,
        row: r,
        district: rows[r].neon ? 'neon' : c + r >= L.crownFrom ? 'crown' : 'grid',
        playable: cols[c].playable && rows[r].playable,
        poly: piece.poly,
        isRect: piece.isRect,
        bounds: b,
        area: polygonArea(piece.poly),
        ...extra,
      });
    }
  }

  const streetEdge = { type: 'street', sidewalk: S.sidewalk };
  const alleyEdge = { type: 'alley', sidewalk: 0.6 };
  const alleyRects = []; // the asphalt strips between two half blocks

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const rect = { minX: cols[c].minX, maxX: cols[c].maxX, minZ: rows[r].minZ, maxZ: rows[r].maxZ };
      const edges = { s: streetEdge, w: streetEdge, n: streetEdge, e: streetEdge };
      if (rows[r].neon) edges.s = { type: 'neon', sidewalk: nm.sidewalk };

      // Would the avenue cut this block? (alleys are only made in whole blocks)
      let touched = false;
      {
        let minD = Infinity, maxD = -Infinity;
        for (const [x, z] of [[rect.minX, rect.minZ], [rect.maxX, rect.minZ], [rect.maxX, rect.maxZ], [rect.minX, rect.maxZ]]) {
          const d = avenue.sideDist(x, z);
          minD = Math.min(minD, d);
          maxD = Math.max(maxD, d);
        }
        touched = !(minD >= avenue.halfWidth || maxD <= -avenue.halfWidth);
      }

      const alley = cols[c].playable && rows[r].playable && !rows[r].neon && !touched ? alleyFor(c, r) : null;
      if (!alley) {
        addBlock(rect, c, r, edges);
      } else if (alley.axis === 'x') {
        // Alley runs east-west: a south half and a north half.
        const mid = (rect.minZ + rect.maxZ) / 2;
        const h = L.alleyWidth / 2;
        addBlock({ ...rect, maxZ: mid - h }, c, r, { ...edges, n: alleyEdge }, { half: 's' });
        addBlock({ ...rect, minZ: mid + h }, c, r, { ...edges, s: alleyEdge }, { half: 'n' });
        alleyRects.push({ minX: rect.minX, maxX: rect.maxX, minZ: mid - h, maxZ: mid + h, axis: 'x', clear: !!alley.clear });
      } else {
        // Alley runs north-south: an east half and a west half.
        const mid = (rect.minX + rect.maxX) / 2;
        const h = L.alleyWidth / 2;
        addBlock({ ...rect, maxX: mid - h }, c, r, { ...edges, w: alleyEdge }, { half: 'e' });
        addBlock({ ...rect, minX: mid + h }, c, r, { ...edges, e: alleyEdge }, { half: 'w' });
        alleyRects.push({ minX: mid - h, maxX: mid + h, minZ: rect.minZ, maxZ: rect.maxZ, axis: 'z', clear: !!alley.clear });
      }
    }
  }

  // ---- THE SUNK (Chapter 3): the old blocks of the south-west corner are under water now ----
  // (src/city/sunkPlan.js has the canals and the drowned buildings that stand there instead)
  for (let i = blocks.length - 1; i >= 0; i--) {
    const bb = blocks[i].bounds;
    if (bb.maxX > SUNK.minX + 0.5 && bb.minZ < SUNK.maxZ - 0.5) blocks.splice(i, 1);
  }

  // ---- Intersections (where a north-south street crosses an east-west street) ------
  const intersections = [];
  for (const ns of streetsNS) {
    for (const ew of streetsEW) {
      const x = ns.center, z = ew.center;
      // Skip crossings that the avenue runs through (they are irregular).
      const nearAvenue = Math.abs(avenue.sideDist(x, z)) < avenue.halfWidth + S.width * 1.2;
      intersections.push({
        x, z, ns: ns.index, ew: ew.index,
        playable: ns.playable && ew.playable,
        nearAvenue,
        signals: ns.playable && ew.playable && !nearAvenue,
      });
    }
  }

  // ---- Helper: which parts of a street are NOT crossed by the avenue ----------------
  // Returns the allowed [from, to] pieces along the street between a and b.
  function cutByAvenue(street, a, b) {
    const half = street.width / 2 + 2;
    const hw = avenue.halfWidth + 3;
    // The avenue covers an interval along the street. Find it by solving
    // sideDist = +hw and -hw on both edges of the street.
    const ts = [];
    for (const off of [-half, half]) {
      for (const side of [-hw, hw]) {
        if (street.axis === 'ns') {
          // point = (center + off, t)
          if (Math.abs(avenue.nz) > 1e-6) ts.push(avenue.az + (side - (street.center + off - avenue.ax) * avenue.nx) / avenue.nz);
        } else {
          // point = (t, center + off)
          if (Math.abs(avenue.nx) > 1e-6) ts.push(avenue.ax + (side - (street.center + off - avenue.az) * avenue.nz) / avenue.nx);
        }
      }
    }
    if (ts.length === 0) return [[a, b]];
    const cutA = Math.min(...ts), cutB = Math.max(...ts);
    const out = [];
    if (cutA > a) out.push([a, Math.min(b, cutA)]);
    if (cutB < b) out.push([Math.max(a, cutB), b]);
    return out.filter((s) => s[1] - s[0] > 0.5);
  }

  // ---- Highway, rail, crown: copy and add a few useful numbers ------------------------
  const hw = L.highway;
  const highway = {
    ...hw,
    minX: hw.centerX - hw.width / 2,
    maxX: hw.centerX + hw.width / 2,
    // Height of the road surface at a given z (it slopes down at the south end).
    heightAt(z) {
      if (z >= hw.rampTopZ) return hw.height;
      if (z <= hw.rampBottomZ) return 0;
      return (hw.height * (z - hw.rampBottomZ)) / (hw.rampTopZ - hw.rampBottomZ);
    },
  };
  const railStreet = streetsNS[L.rail.streetIndex];
  const rail = { ...L.rail, x: railStreet.center };

  // ---- Ground height: sidewalks are raised, the beach slopes to the water -------------
  const curb = S.curbHeight;
  const median = {
    minZ: neon.centerZ - nm.medianWidth / 2,
    maxZ: neon.centerZ + nm.medianWidth / 2,
    minX: cityMinX - 20,
    maxX: Math.min(cityMaxX, SUNK.minX),   // (it ends where The Sunk begins)
  };
  function beachHeight(z) {
    // 0.1 m at the promenade, down to the water level at the water line,
    // and it keeps going down under the water.
    const t = (beach.maxZ - z) / (beach.maxZ - beach.minZ);
    return 0.1 + (L.ocean.level - 0.1) * Math.min(t, 1) - Math.max(0, t - 1) * 3.5;
  }
  function groundHeight(x, z) {
    if (inSunk(x, z)) return topAt(x, z);               // The Sunk: a pontoon, a roof ... or the water
    if (z < beach.maxZ) return beachHeight(z);
    if (z < neon.promenadeMaxZ) return curb; // promenade
    if (z < neon.roadMaxZ) {
      // Neon Mile road, with the raised median in the middle.
      if (z > median.minZ && z < median.maxZ && medianHasGround(x)) return curb;
      return 0;
    }
    for (const b of blocks) {
      const bb = b.bounds;
      if (x < bb.minX || x > bb.maxX || z < bb.minZ || z > bb.maxZ) continue;
      if (b.isRect || pointInConvex(b.poly, x, z)) return curb;
    }
    return 0;
  }
  // The median is cut where the north-south streets (and the avenue) meet Neon Mile.
  const medianGaps = [];
  for (const ns of streetsNS) medianGaps.push([ns.center - ns.width / 2 - 2, ns.center + ns.width / 2 + 2]);
  {
    // where the avenue center line reaches the boulevard
    const t = (neon.centerZ - avenue.az) / avenue.dirZ;
    const x = avenue.ax + avenue.dirX * t;
    medianGaps.push([x - 16, x + 16]);
  }
  medianGaps.push([highway.minX - 4, highway.maxX + 4]);
  function medianHasGround(x) {
    if (x < median.minX || x > median.maxX) return false;
    for (const g of medianGaps) if (x > g[0] && x < g[1]) return false;
    return true;
  }
  // Pieces of the median between the gaps: [minX, maxX] list.
  const medianPieces = [];
  {
    const sorted = medianGaps.slice().sort((p, q) => p[0] - q[0]);
    let cur = median.minX;
    for (const g of sorted) {
      if (g[0] - cur > 6) medianPieces.push([cur, g[0]]);
      cur = Math.max(cur, g[1]);
    }
    if (median.maxX - cur > 6) medianPieces.push([cur, median.maxX]);
  }

  // ---- District name at a position (for the HUD) -----------------------------------------
  function districtAt(x, z) {
    if (inSunk(x, z)) return 'THE SUNK';
    if (x > 456 && z < SUNK.maxZ) return 'RUSTWATER';
    if (z < beach.maxZ) return 'MERIDIAN BEACH';
    if (z < rows[0].maxZ + S.width / 2) return 'NEON MILE';
    if (x < cols[0].minX) return 'IRONHILL UNDERPASS';
    // which block column and row is this? The north-west corner is The Crown.
    const c = Math.floor((x - cols[0].minX) / pitchX), r = 1 + Math.floor((z - L.rows.firstGridRowMinZ) / pitchZ);
    if (c + r >= L.crownFrom) return 'THE CROWN';
    return 'THE GRID';
  }

  // ---- Driving lanes (used by src/ai/traffic.js and the GPS) -----------------------
  // "roads" = the streets cars may use. Each road has two lanes (one per direction):
  //   north-south road: north-bound cars drive on the east side (x = center - laneOffset)
  //   east-west road:   cars going west (+x) drive on the north side (z = center + laneOffset)
  //   Neon Mile:        the north half goes west, the half next to the beach goes east
  const TR = L.traffic;
  const traffic = {
    ...TR,
    ns: streetsNS.filter((s) => s.playable).map((s) => ({ axis: 'ns', index: s.index, center: s.center, neon: false })),
    ew: streetsEW.filter((s) => s.playable).map((s) => ({ axis: 'ew', index: s.index, center: s.center, neon: false })),
    neon: {
      axis: 'ew', index: -1, center: neon.centerZ, neon: true,
      laneWest: neon.centerZ + nm.medianWidth / 2 + TR.neonLaneOffset,
      laneEast: neon.centerZ - nm.medianWidth / 2 - TR.neonLaneOffset,
    },
  };

  return {
    raw: L,
    traffic,
    seed: L.seed,
    bounds: L.bounds,
    street: S,
    cols, rows,
    city: { minX: cityMinX, maxX: cityMaxX, minZ: cityMinZ, maxZ: cityMaxZ },
    streetsNS, streetsEW,
    avenue,
    blocks,
    alleyRects,
    intersections,
    neon, beach, median, medianPieces,
    ocean: L.ocean,
    highway, rail,
    crown: L.crown,
    hills: L.hills,
    spawn: L.spawn,
    cutByAvenue,
    groundHeight,
    beachHeight,
    districtAt,
  };
}
