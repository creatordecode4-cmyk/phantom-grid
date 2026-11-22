// ---------------------------------------------------------------------------
// rooms.js - the houses you can walk into. Each one is made from the pieces of
// furniture.js, like the four pictures the player sent:
//
//   HALDEN HOUSE (the villas next to the start point)
//     a dining kitchen  (picture 1: ochre walls, wooden ceiling with beams,
//                        blue and cream tiles, an enamel stove, a dresser with
//                        plates, a table with a teapot, a lamp over it)
//     a child's room    (picture 3: wallpaper, wooden floor, a red rug, a bed
//                        with a grey blanket, a desk under a pin board between
//                        two little shutters, books, a globe, an orange curtain)
//   FLAT 3B (the garden building, first corner south of the start)
//     a retro kitchen   (picture 2: a round cream fridge, a mint green stove,
//                        wooden cupboards, cream tiles, thin curtains in the sun)
//
// THE ROOM'S OWN NUMBERS (meters): x and z on the floor, y up. The front door
// is in the wall z = 0 and you walk in toward +z. Careful: looking toward +z,
// +x is on your LEFT (in this game x grows to the west).
//
// Each house returns:
//   rooms    the boxes of the rooms ({ id, label, x0, z0, x1, z1, h })
//   walls    solid boxes for walking and for the camera (the walls themselves)
//   door     the front door from inside: the opening and how its leaf turns
//   entry    where you stand after coming in (face: the way you look, radians; 0 = +z),
//            exit = where the EXIT button shows
//   windows  the windows the sun comes through, and where it should fall by day
//   lamps    the lamps (a real light is put at each one in the evening and at night)
// ---------------------------------------------------------------------------

import { C, frame, shell, casing, windowIn, shutter, table, chair, chairPadded, stove, retroStove, pot, kettle, teapot, plate, cup, mug, bottle, jar, bowl,
  fruitBowl, flowers, bread, hangingPan, utensil, colander, rail, hutch, radio, candle, books, plant, bigPlant, crate, workTable, wallShelf, dishRack,
  sinkCabinet, fridge, cabinets, scale, openShelves, clock, bed, wardrobe, desk, deskLamp, pinBoard, globe, armchair, rug, ball, boardGame, fan,
  pendant, ceilingGlobe, switchPlate, socket, picture, coat } from './furniture.js';

const PI = Math.PI;
const WHITE = C('#f2efe8'), BLUE_RIM = C('#36628f');
// the walls you cannot walk through: a slab outside each wall of each room, with a gap where a doorway joins two rooms
export function wallBoxes(rooms, passes) {
  const t = 0.3, out = [];
  for (const r of rooms) {
    const sides = [
      { axis: 'z', at: r.z0 - t, to: r.z0, a: r.x0 - t, b: r.x1 + t, wall: 'z0' },
      { axis: 'z', at: r.z1, to: r.z1 + t, a: r.x0 - t, b: r.x1 + t, wall: 'z1' },
      { axis: 'x', at: r.x0 - t, to: r.x0, a: r.z0 - t, b: r.z1 + t, wall: 'x0' },
      { axis: 'x', at: r.x1, to: r.x1 + t, a: r.z0 - t, b: r.z1 + t, wall: 'x1' },
    ];
    for (const s of sides) {
      // cut the slab where a doorway to the next room is
      const gaps = passes.filter((p) => p.room === r.id && p.wall === s.wall).map((p) => [p.a, p.b]).sort((p, q) => p[0] - q[0]);
      let from = s.a;
      for (const [g0, g1] of [...gaps, [s.b, s.b]]) {
        if (g0 - from > 0.01) out.push(s.axis === 'z' ? { minX: from, maxX: g0, minZ: s.at, maxZ: s.to, h: r.h } : { minX: s.at, maxX: s.to, minZ: from, maxZ: g0, h: r.h });
        from = g1;
      }
    }
  }
  return out;
}

// ============================================================================ HALDEN HOUSE
export function buildHalden(b) {
  const K = { id: 'kitchen', label: 'KITCHEN', x0: 0, z0: 0, x1: 4.6, z1: 4.4, h: 2.8 };
  const B = { id: 'bedroom', label: "CHILD'S ROOM", x0: 4.75, z0: 0, x1: 8.55, z1: 4.4, h: 2.8 };
  const RF = frame(b, 0, 0, 0);
  const WOOD_D = C('#5e3a22'), WOOD_M = C('#80522f'), DARK_TRIM = C('#5a3a22');

  // ------------------------------------------------------------ the kitchen (picture 1)
  const kh = shell(b, {
    ...K, floor: 'tiles', floorTile: 0.5, wall: 'plaster', wallTile: 2.2, wallColor: C('#ecc08a'),
    ceiling: { boards: true, color: C('#8a5a36'), beams: [0.95, 1.95, 2.95, 3.95] },
    skirting: DARK_TRIM,
    holes: [
      { wall: 'z0', a: 3.2, b: 4.1, y0: 0, y1: 2.15, kind: 'door', depth: 0.25 },
      { wall: 'z1', a: 0.55, b: 1.45, y0: 1.05, y1: 2.15, kind: 'window', depth: 0.3 },
      { wall: 'x1', a: 0.45, b: 1.35, y0: 0, y1: 2.1, kind: 'pass', depth: 0.15 },
    ],
  });
  const kDoor = kh.find((o) => o.kind === 'door'), kWin = kh.find((o) => o.kind === 'window'), kPass = kh.find((o) => o.kind === 'pass');
  for (const o of kh) casing(b, o, DARK_TRIM);
  windowIn(b, kWin, { color: C('#6e4a2c'), panes: [2, 3] });
  plant(RF, 1.18, 1.055, 4.47, 0.7, { n: 7 });
  bottle(RF, 0.78, 1.055, 4.47, C('#4a7a8a'), 0.7);

  // the back wall: the sink under the window, the stove in the middle, a cupboard with copper pans over it
  sinkCabinet(frame(b, 1.0, 4.1, PI), { w: 1.5, color: WOOD_M, top: C('#b9a17e') });
  dishRack(RF, 1.53, 0.88, 4.16, 0);
  bottle(RF, 0.38, 0.88, 4.22, C('#d8e0c0'), 0.75);
  bowl(RF, 0.5, 0.88, 3.98, C('#e4d8bf'), 1.2);
  const ST = frame(b, 2.5, 4.07, PI);
  stove(ST, { w: 0.78 });
  pot(ST, -0.19, 0.9, 0.13, C('#b3271e'));
  kettle(ST, 0.19, 0.9, -0.12);
  RF.box('backsplash', 2.5, 0.88, 4.392, 1.1, 0.74, 0.012, [1, 1, 1], { r: 0.002, uv: [1.83, 1.23] });
  const SW = frame(b, 2.5, 4.4, PI);
  const spice = wallShelf(SW, 0, 1.74, 0, 1.0, 0.16, WOOD_D);
  const fills = [C('#b84a1c'), C('#d8b04a'), C('#6a8a3a'), C('#e8dcc0'), C('#8a4a2a'), C('#c8c0a8')];
  for (let i = 0; i < 6; i++) jar(SW, -0.4 + i * 0.16, spice, 0.08, fills[i], 0.6);
  const CB = frame(b, 3.7, 4.1, PI);
  cabinets(CB, { w: 1.5, color: WOOD_M, top: C('#a0703f'), topMat: 'wood' });
  bread(RF, 3.25, 0.9, 4.08, 0.25);
  fruitBowl(RF, 3.78, 0.9, 4.02);
  jar(RF, 4.18, 0.9, 4.22, C('#efe6d0'), 1.4);
  jar(RF, 4.34, 0.9, 4.0, C('#d9b878'), 1.2);
  const PW = frame(b, 3.72, 4.4, PI);
  rail(PW, -0.6, 0.6, 1.68);
  hangingPan(PW, -0.38, 1.47, 0, 0.13);
  hangingPan(PW, -0.02, 1.47, 0, 0.105);
  hangingPan(PW, 0.36, 1.47, 0, 0.15);
  utensil(PW, 0.56, 1.67, 0.02, 'ladle');
  const high = wallShelf(PW, 0, 2.1, 0, 1.25, 0.24, WOOD_D);
  for (let i = 0; i < 4; i++) jar(PW, -0.48 + i * 0.22, high, 0.11, fills[(i + 2) % 6], 1.15);
  bowl(PW, 0.42, high, 0.12, C('#d0c4a8'), 1.4);

  // the left wall (looking in): a work table with crates, papers pinned above it, a shelf, spoons on hooks
  const WT = frame(b, 4.3, 2.75, -PI / 2);
  const wt = workTable(WT, { w: 1.4, d: 0.6, color: C('#a8784a') });
  crate(WT, -0.36, 0.185, 0.0, 0.08, 'onion');
  crate(WT, 0.36, 0.185, 0.02, -0.06, 'potato');
  bread(WT, -0.38, wt, 0.06, 0.1);
  bowl(WT, 0.18, wt, 0.1, C('#d9cdb4'), 1.35);
  bottle(WT, 0.5, wt, -0.15, C('#7a2a24'), 0.85);
  jar(WT, 0.36, wt, -0.18, C('#e8d8a8'), 1.1);
  const LW = frame(b, 4.6, 2.75, -PI / 2);
  LW.paper(-0.42, 1.62, 0.006, 0.42, 0.56, 0);
  LW.paper(0.06, 1.47, 0.006, 0.22, 0.3, 1, 0, 0);
  LW.paper(0.42, 1.58, 0.006, 0.3, 0.42, 2);
  LW.paper(0.1, 1.84, 0.006, 0.18, 0.13, 5);
  const ls = wallShelf(LW, 0, 2.06, 0, 1.3, 0.22, WOOD_D);
  for (let i = 0; i < 3; i++) jar(LW, -0.5 + i * 0.17, ls, 0.11, fills[i + 1], 1.1);
  bottle(LW, 0.05, ls, 0.1, C('#2f6b3a'), 0.9);
  books(LW, 0.22, ls, 0.1, 6, { h: 0.22, d: 0.16, lean: true });
  rail(LW, -1.3, -0.84, 1.66);
  colander(LW, -1.18, 1.42, 0.04);
  utensil(LW, -0.98, 1.65, 0.02, 'ladle');
  utensil(LW, -0.9, 1.65, 0.02, 'spoon');

  // the right wall: the big dresser with plates (picture 1), a framed drawing, a plant in the corner
  const H = frame(b, 0.24, 2.6, PI / 2);
  const hu = hutch(H, { w: 1.2, color: C('#6b4024') });
  radio(H, 0.3, hu.top + 0.035, 0.02);
  candle(H, -0.4, hu.top + 0.035, 0.1);
  books(H, -0.16, hu.top + 0.035, 0.02, 3, { lying: true });
  picture(frame(b, 0, 1.25, PI / 2), 0, 1.7, 0, 0.34, 0.26, 4);
  bigPlant(RF, 0.42, 0.45);
  socket(frame(b, 0, 1.7, PI / 2), 0, 0.3, 0);

  // the front wall: a coat on a hook, the light switch next to the door
  coat(frame(b, 2.45, 0, 0), 0, 1.82, 0, C('#46586a'));
  switchPlate(frame(b, 2.98, 0, 0), 0, 1.15, 0);

  // the table in the middle: plates with a blue rim, cups, a teapot, a green bottle, flowers, books
  table(frame(b, 2.3, 2.25, 0.02), { w: 1.3, d: 0.82, color: C('#8a5a34') });
  chair(frame(b, 2.0, 1.6, 0.08));
  chair(frame(b, 2.62, 2.92, PI - 0.12));
  chair(frame(b, 1.38, 2.32, PI / 2 + 0.1));
  const TY = 0.76;
  plate(RF, 2.0, TY, 1.98, WHITE, BLUE_RIM);
  plate(RF, 2.62, TY, 2.52, WHITE, BLUE_RIM);
  plate(RF, 1.8, TY, 2.3, WHITE, BLUE_RIM);
  cup(RF, 2.25, TY, 1.94, C('#e9e2d0'), 0.3);
  cup(RF, 2.4, TY, 2.58, C('#dfe8ee'), 2.6);
  cup(RF, 1.82, TY, 2.06, C('#e9e2d0'), 1.4);
  teapot(RF, 2.34, TY, 2.24, C('#e9e2d0'));
  bottle(RF, 2.74, TY, 2.08, C('#2f6b3a'));
  flowers(RF, 2.06, TY, 2.5);
  books(RF, 2.86, TY, 2.42, 3, { lying: true, h: 0.24, d: 0.17 });
  const kLamp = pendant(RF, 2.3, 2.25, K.h, 0.98, C('#2f4a3c'));

  // ------------------------------------------------------------ the child's room (picture 3)
  const bh = shell(b, {
    ...B, floor: 'planks', floorTile: 1.2, wall: 'wallpaper', wallTile: 0.5, wallColor: C('#fff6ea'),
    ceiling: { color: C('#f2ede4') }, skirting: C('#ece6d8'),
    holes: [
      { wall: 'x0', a: 0.45, b: 1.35, y0: 0, y1: 2.1, kind: 'pass', depth: 0 },
      { wall: 'z1', a: 6.2, b: 7.2, y0: 0.95, y1: 2.15, kind: 'window', depth: 0.3 },
    ],
  });
  const bWin = bh.find((o) => o.kind === 'window');
  for (const o of bh) casing(b, o, C('#e8e0d0'));
  windowIn(b, bWin, { color: C('#f2ece0'), panes: [2, 2], curtains: { color: C('#e0782c'), width: 0.46 } });
  plant(RF, 6.95, 0.955, 4.47, 0.6, { n: 6 });
  RF.box('paint', 6.45, 0.955, 4.47, 0.12, 0.05, 0.07, C('#2f6fb0'), { r: 0.02 });            // a toy car on the sill
  // the bed against the far wall, a drawing over it
  bed(frame(b, 5.3, 3.34, PI), { w: 0.98, l: 2.0, color: C('#8a5c36'), blanket: C('#7c8288') });
  picture(frame(b, 4.75, 3.3, PI / 2), 0, 1.6, 0, 0.36, 0.28, 4, C('#e0d8c8'));
  // the desk under the pin board, with shutters on both sides and shelves above (picture 3)
  const D = frame(b, 8.25, 2.3, -PI / 2);
  const dt = desk(D, { w: 1.2, color: C('#9a6b40') });
  const deskBulb = deskLamp(D, -0.42, dt, -0.12, 0.55);
  D.paper(0.02, dt + 0.002, 0.06, 0.21, 0.28, 5, 0.2, -PI / 2);
  D.paper(-0.12, dt + 0.003, 0.0, 0.21, 0.28, 3, -0.3, -PI / 2);
  books(D, 0.18, dt, -0.12, 2, { lying: true });
  D.cyl('paint', 0.44, dt, -0.16, 0.035, 0.035, 0.1, C('#c8a040'), 14);
  for (let i = 0; i < 4; i++) D.cyl('paint', 0.44 + (i - 1.5) * 0.012, dt + 0.12, -0.16 + (i % 2) * 0.01, 0.004, 0.004, 0.16, [C('#d23c2c'), C('#2a5ad0'), C('#e8c030'), C('#3a9a4a')][i], 6, [0.08 * (i - 1.5), 0, 0.06]);
  chair(frame(b, 7.72, 2.42, PI / 2 + 0.25), { color: C('#8a5a34') });
  const WB = frame(b, 8.55, 2.3, -PI / 2);
  pinBoard(WB, 0, 1.08, 0, 0.92, 0.62);
  shutter(WB, -0.68, 1.06, 0.02, 0.3, 0.7, C('#5f8a9a'));
  shutter(WB, 0.68, 1.06, 0.02, 0.3, 0.7, C('#5f8a9a'));
  const s1 = wallShelf(WB, 0, 1.98, 0, 1.3, 0.2, C('#b48452'));
  const after = books(WB, -0.6, s1, 0.1, 9, { h: 0.21, d: 0.15, lean: true });
  globe(WB, Math.max(after + 0.18, 0.38), s1, 0.1);
  const s2 = wallShelf(WB, -0.25, 2.33, 0, 0.8, 0.18, C('#b48452'));
  books(WB, -0.6, s2, 0.09, 5, { h: 0.18, d: 0.13 });
  WB.box('paint', 0.0, s2, 0.09, 0.14, 0.1, 0.1, C('#d0402a'), { r: 0.02 });
  WB.sphere('cloth', -0.05 + 0.18, s2 + 0.07, 0.09, 0.065, C('#a87a4a'), 10);           // a teddy bear (a very simple one)
  WB.sphere('cloth', -0.05 + 0.18, s2 + 0.16, 0.09, 0.045, C('#a87a4a'), 10);
  // the wardrobe, the armchair by the window, the rug with a ball and a board game, a fan
  wardrobe(frame(b, 7.85, 0.29, 0), { w: 1.0, h: 2.0, color: C('#7a5130') });
  armchair(frame(b, 8.0, 3.75, -2.45), { color: C('#c08a3e') });
  RF.box('cloth', 7.95, 0.52, 3.72, 0.34, 0.1, 0.3, C('#e8e0d0'), { r: 0.04, rot: 0.4 });  // a cushion
  rug(RF, 6.75, 2.15, 1.9, 1.35, 0.06);
  ball(RF, 6.05, 1.35);
  boardGame(RF, 7.0, 2.35, 0.3);
  fan(RF, 6.85, 0.32, 0);
  RF.box('paint', 5.3, 0, 0.3, 0.6, 0.36, 0.4, C('#3a6ea5'), { r: 0.025 });                // a toy box
  RF.box('paint', 5.3, 0.36, 0.3, 0.62, 0.03, 0.42, C('#e8c030'), { r: 0.012 });
  b.solid(5.0, 0.1, 5.6, 0.5, 0.4);
  picture(frame(b, 5.75, 0, 0), 0, 1.62, 0, 0.42, 0.56, 7, C('#2a2a2a'));
  RF.paper(6.4, 1.6, 0.006, 0.4, 0.5, 6);
  const bLamp = ceilingGlobe(RF, 6.65, 2.2, B.h);

  const rooms = [K, B];
  const passes = [{ room: 'kitchen', wall: 'x1', a: kPass.a + 0.02, b: kPass.b - 0.02 }, { room: 'bedroom', wall: 'x0', a: kPass.a + 0.02, b: kPass.b - 0.02 }];
  return {
    name: 'HALDEN HOUSE', rooms, walls: wallBoxes(rooms, passes),
    // the room's colours for the soft corner shade, and the fill light of each room
    door: { hole: kDoor, hinge: [4.1, -0.075], width: 0.9, height: 2.15, closed: PI, color: C('#6b4024') },
    entry: { x: 3.55, z: 1.25, face: -0.45 }, exit: { x: 3.65, z: 0.35, r: 0.95 },
    windows: [
      { hole: kWin, room: 'kitchen', aim: [1.55, 0, 2.85] },
      { hole: bWin, room: 'bedroom', aim: [6.45, 0, 2.55] },
    ],
    lamps: [
      { at: kLamp, room: 'kitchen', color: [1.0, 0.7, 0.42], power: 6, range: 6, kind: 'pendant' },
      { at: deskBulb, room: 'bedroom', color: [1.0, 0.74, 0.46], power: 2.6, range: 4, kind: 'desk' },
      { at: bLamp, room: 'bedroom', color: [1.0, 0.82, 0.6], power: 3.2, range: 6.5, kind: 'ceiling', nightOnly: true },
    ],
    // the warm light that bounces back from the floor and the walls (one per room)
    fill: { kitchen: [1.0, 0.82, 0.6], bedroom: [1.0, 0.9, 0.78] },
  };
}

// ============================================================================ FLAT 3B
export function buildFlat(b) {
  const F = { id: 'kitchen', label: 'KITCHEN', x0: 0, z0: 0, x1: 4.2, z1: 3.8, h: 2.7 };
  const RF = frame(b, 0, 0, 0);
  const WOOD = C('#b07a45'), MINT = C('#7fbf9f');
  const fh = shell(b, {
    ...F, floor: 'checker', floorTile: 0.6, wall: 'plaster', wallTile: 2.2, wallColor: C('#fff0cc'),
    dado: { mat: 'walltile', h: 1.4, tile: 0.6, color: [1, 1, 1], border: MINT },
    reveal: 'plaster', ceiling: { color: C('#f4efe4') },
    holes: [
      { wall: 'z0', a: 2.9, b: 3.8, y0: 0, y1: 2.15, kind: 'door', depth: 0.25 },
      { wall: 'z1', a: 1.65, b: 2.65, y0: 1.15, y1: 2.15, kind: 'window', depth: 0.28 },
    ],
  });
  const fDoor = fh.find((o) => o.kind === 'door'), fWin = fh.find((o) => o.kind === 'window');
  for (const o of fh) casing(b, o, C('#f2efe6'));
  windowIn(b, fWin, { color: C('#f2efe6'), panes: [2, 2], curtains: { color: C('#f6f0e2'), width: 0.4 } });
  plant(RF, 2.45, 1.155, 3.9, 0.55, { n: 6, leaf: C('#5a8a3a') });
  plant(RF, 1.85, 1.155, 3.9, 0.5, { n: 5, pot: C('#d8d0c0') });

  // the back wall: cupboards with drawers and the sink under the window, open shelves on both sides
  const CB = frame(b, 2.25, 3.5, PI);
  const top = cabinets(CB, { w: 2.6, color: WOOD, top: C('#e9dfc8'), sinkAt: 0.1 });
  scale(RF, 1.18, top, 3.52);
  jar(RF, 3.05, top, 3.6, C('#efe6d0'), 1.5);
  jar(RF, 3.22, top, 3.62, C('#c89a5a'), 1.3);
  jar(RF, 3.37, top, 3.6, C('#8a5a3a'), 1.1);
  fruitBowl(RF, 2.88, top, 3.4);
  bowl(RF, 1.42, top, 3.32, C('#e8b8a0'), 1.3);
  bowl(RF, 1.42, top + 0.05, 3.32, C('#f2e8d8'), 1.05);
  plant(RF, 0.98, top, 3.6, 0.8, { n: 9, tall: 0.3 });
  kettle(RF, 3.42, top, 3.32, C('#d8d0c0'));
  const SL = frame(b, 1.25, 3.8, PI), SR = frame(b, 3.1, 3.8, PI);
  const tl = openShelves(SL, 0, 1.52, 0, 0.62, 2, 0.36, WOOD);
  const tr = openShelves(SR, 0, 1.52, 0, 0.72, 2, 0.36, WOOD);
  const mugC = [C('#d84a3a'), C('#3a7ad2'), C('#e8c030'), C('#7fbf9f'), C('#f2efe8')];
  for (let i = 0; i < 3; i++) mug(SL, -0.2 + i * 0.2, tl[0], 0.1, mugC[i], 0.4 + i);
  for (let i = 0; i < 3; i++) jar(SL, -0.2 + i * 0.2, tl[1], 0.1, [C('#e8d8a8'), C('#b84a1c'), C('#6a8a3a')][i], 0.85);
  for (let i = 0; i < 4; i++) mug(SR, -0.27 + i * 0.18, tr[0], 0.1, mugC[(i + 2) % 5], 1 + i);
  teapot(SR, -0.12, tr[1], 0.1, C('#7fbf9f'));
  books(SR, 0.08, tr[1], 0.1, 5, { h: 0.2, d: 0.14 });
  rail(SR, -0.3, 0.3, 1.3);
  utensil(SR, -0.2, 1.29, 0.02, 'ladle');
  utensil(SR, 0.0, 1.29, 0.02, 'whisk');
  utensil(SR, 0.18, 1.29, 0.02, 'spoon');

  // the round fridge in the corner, the mint stove on the right wall with pots over it
  fridge(frame(b, 0.43, 3.42, PI));
  const STV = frame(b, 0.33, 2.15, PI / 2);
  retroStove(STV);
  pot(STV, 0.19, 0.9, 0.13, C('#e8e2d4'), 0.9);
  kettle(STV, -0.19, 0.9, -0.12, C('#d84a3a'));
  STV.box('cloth', -0.12, 0.42, 0.37, 0.24, 0.3, 0.02, C('#d8e4ec'), { r: 0.01 });          // a tea towel on the oven bar
  const RW = frame(b, 0, 2.15, PI / 2);
  const ps = wallShelf(RW, 0, 1.78, 0, 0.9, 0.22, WOOD);
  pot(RW, -0.25, ps, 0.12, C('#d84a3a'), 0.8);
  pot(RW, 0.15, ps, 0.12, C('#7fbf9f'), 0.7);
  rail(RW, -0.35, 0.35, 1.55);
  for (let i = 0; i < 4; i++) utensil(RW, -0.27 + i * 0.18, 1.54, 0.02, ['ladle', 'spoon', 'whisk', 'ladle'][i]);

  // the small table by the left wall, two chairs, a clock and a calendar
  table(frame(b, 3.82, 2.0, PI / 2), { w: 0.9, d: 0.65, h: 0.74, color: C('#c8a070') });
  chairPadded(frame(b, 3.82, 1.38, 0.1));
  chairPadded(frame(b, 3.78, 2.64, PI - 0.15));
  flowers(RF, 3.86, 0.74, 2.12, C('#7fbf9f'), C('#e85a3a'));
  cup(RF, 3.74, 0.74, 1.82, WHITE, 0.6);
  RF.paper(3.9, 0.742, 1.9, 0.3, 0.22, 5, 0.3, -PI / 2);
  const LWl = frame(b, 4.2, 2.0, -PI / 2);
  clock(LWl, 0, 2.02, 0);
  LWl.paper(0.72, 1.7, 0.006, 0.3, 0.42, 2);
  switchPlate(frame(b, 2.7, 0, 0), 0, 1.15, 0);
  coat(frame(b, 1.9, 0, 0), 0, 1.82, 0, C('#8a4a3a'));
  const fLamp = ceilingGlobe(RF, 2.1, 1.9, F.h);

  const rooms = [F];
  return {
    name: 'FLAT 3B', rooms, walls: wallBoxes(rooms, []),
    door: { hole: fDoor, hinge: [3.8, -0.075], width: 0.9, height: 2.15, closed: PI, color: C('#3f6a5a') },
    entry: { x: 3.25, z: 1.25, face: -0.45 }, exit: { x: 3.35, z: 0.35, r: 0.95 },
    windows: [{ hole: fWin, room: 'kitchen', aim: [2.6, 0, 2.15] }],
    lamps: [{ at: fLamp, room: 'kitchen', color: [1.0, 0.82, 0.62], power: 5, range: 8, kind: 'ceiling' }],
    fill: { kitchen: [1.0, 0.9, 0.74] },
  };
}

// which door of the city leads into which house
export const HOUSES = {
  halden: { build: buildHalden, doors: ['villa0', 'villa1'] },
  flat: { build: buildFlat, doors: ['garden'] },
};
