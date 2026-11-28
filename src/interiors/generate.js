// ---------------------------------------------------------------------------
// generate.js - a room for EVERY other door of the city.
//
// The three houses of rooms.js are made by hand. Every other door at street
// level (a few hundred: lobbies, shops, garages ...) gets a room made by the
// game itself, the first time you open it:
//
//   kindOf(door)   what is behind it, from the building and the part of town:
//                  the Grid      flats (a living room with a small kitchen),
//                                corner shops, cafés
//                  Neon Mile     cafés and shops (and a few flats)
//                  The Crown     offices and building lobbies
//                  garage doors  a garage with a work bench and tools
//                  shutters      a store room
//   generate(b, door)  builds it with the pieces of furniture.js and
//                  furniture2.js. The random numbers come from the door's own
//                  number, so the same door always opens into the same room.
//
// Every room has one window (the sun or the moon comes through it) and one real
// lamp - the same set of lights as the flat of rooms.js, so the graphics card
// can use the materials it already prepared while the game was loading.
// ---------------------------------------------------------------------------

import { rng } from './kit.js';
import { C, frame, shell, casing, windowIn, table, chair, chairPadded, plant, bigPlant, books, bottle, jar, bowl, fruitBowl, flowers, kettle, bread,
  cabinets, fridge, rug, picture, coat, switchPlate, socket, wallShelf, armchair, ceilingGlobe, clock, mug, cup, crate } from './furniture.js';
import { sofa, coffeeTable, tvUnit, bookcase, floorLamp, roundTable, bistroChair, gondola, shopCounter, drinksFridge, cafeCounter, menuBoard,
  officeDesk, officeChair, filingCabinet, waterCooler, whiteboard, mailboxes, liftDoors, receptionDesk, bench, workbench, pegboard, tires, drum,
  boxes, ceilingPanel, rack } from './furniture2.js';
import { person, tellerCounter, atm, vaultDoor, ropePosts, standDesk, frontDesk, cellBars, lockers, noticeBoard, waitingSeats } from './furniture3.js';
import { wallBoxes } from './rooms.js';
import { placeOf } from '../world/places.js';

const PI = Math.PI;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------------------------------------------------------------- what is behind a door
export function kindOf(e) {
  // (a few doors of the city are a bank or a police station: src/world/places.js chooses them)
  const place = placeOf(e);
  if (place) return place.kind;
  const R = rng(hash(e.id + 'k'));
  if (e.door === 3) return 'garage';
  if (e.door === 1) return 'store';
  const b = e.building || '', d = e.district;
  if (b === 'arcade' || b === 'b09' || b === 'b07') return R() < 0.5 ? 'cafe' : 'shop';
  if (b === 'b04' || b === 'b01' || b === 'b10' || b === 'b11') return R() < 0.65 ? 'office' : 'lobby';
  if (b === 'b06') return 'lobby';
  if (d === 'crown') return R() < 0.6 ? 'office' : 'lobby';
  if (d === 'neon') { const r = R(); return r < 0.4 ? 'cafe' : r < 0.8 ? 'shop' : 'home'; }
  const r = R();
  return r < 0.55 ? 'home' : r < 0.72 ? 'shop' : r < 0.86 ? 'cafe' : 'lobby';
}
const NAMES = {
  home: ['FLAT 2B', 'FLAT 4C', 'FLAT 7', 'APARTMENT 3A', 'FLAT 11', 'FLAT 5D', 'APARTMENT 9', 'FLAT 1E'],
  shop: ['CORNER SHOP', 'GRID MARKET', 'NIGHT STORE', 'MINI MART', 'THE LITTLE SHOP', 'OPEN LATE'],
  cafe: ['RAIN CAFÉ', 'THE LAST CUP', 'CAFÉ LUNA', 'SLOW MORNING', 'TWO SUGARS', 'THE CORNER CAFÉ'],
  office: ['OFFICE', 'STUDIO', 'DESIGN OFFICE', 'SMALL OFFICE'],
  lobby: ['LOBBY', 'ENTRANCE HALL', 'HOTEL LOBBY'],
  garage: ['GARAGE', 'WORKSHOP', 'LOCK-UP GARAGE'],
  store: ['STORE ROOM', 'STORAGE'],
  bank: ['MERIDIAN SAVINGS BANK'],
  police: ['MERIDIAN GUARD · STATION'],
};

// ---------------------------------------------------------------- one room
export function generate(b, e) {
  const kind = kindOf(e);
  const R = rng(hash(e.id));
  const name = NAMES[kind][Math.floor(R() * NAMES[kind].length)];
  const T = TEMPLATES[kind];
  // half of the rooms are built the other way round (the door on the left, the kitchen on the right ...)
  const mirror = R() < 0.5;
  return { ...T(b, R, mirror), name, kind };
}

// A helper that builds a room in its plain layout, or mirrored left to right.
//   X(x) the place across the room, ROT(r) the turn, side(name) which wall
function room(b, R, mirror, W, D, H, o) {
  const X = (x) => (mirror ? W - x : x), ROT = (r) => (mirror ? -r : r);
  const side = (w) => (!mirror ? w : w === 'x0' ? 'x1' : w === 'x1' ? 'x0' : w);
  const holes = o.holes.map((h) => {
    const along = h.wall === 'z0' || h.wall === 'z1';
    const a = along ? Math.min(X(h.a), X(h.b)) : h.a, bb = along ? Math.max(X(h.a), X(h.b)) : h.b;
    return { ...h, wall: side(h.wall), a, b: bb };
  });
  const Rm = { id: 'main', label: o.label, x0: 0, z0: 0, x1: W, z1: D, h: H };
  const out = shell(b, { ...Rm, ...o.shell, holes });
  for (const hh of out) casing(b, hh, o.trim || C('#e8e2d4'));
  const F = (x, z, r = 0, y = 0) => frame(b, X(x), z, ROT(r), y);
  const RF = frame(b, 0, 0, 0);
  return { X, ROT, F, RF, Rm, out, door: out.find((h) => h.kind === 'door'), win: out.find((h) => h.kind === 'window') };
}
// what every made room returns (the same shape as the houses of rooms.js)
function result(r, o) {
  const d = r.door, cx = (d.a + d.b) / 2;
  return {
    rooms: [r.Rm], walls: wallBoxes([r.Rm], []),
    door: { hole: d, hinge: [d.b, -0.075], width: d.b - d.a, height: d.y1, closed: PI, color: o.doorColor || C('#6b4024'), glass: !!o.glassDoor, shutter: !!o.shutter },
    entry: { x: cx, z: 1.2, face: 0 }, exit: { x: cx, z: 0.35, r: 0.95 },
    windows: [{ hole: r.win, room: 'main', aim: o.aim }],
    lamps: [{ at: o.lamp, room: 'main', color: o.lampColor || [1.0, 0.8, 0.58], power: o.lampPower || 5, range: o.lampRange || 8, kind: 'ceiling' }],
    fill: { main: o.fill || [1, 0.9, 0.78] },
    // places where something can be done (a cash machine, a counter): [{ id, x, z, r }] - src/world/places.js
    spots: o.spots || [],
  };
}
const PASTEL = ['#f0dcc0', '#d8e6d8', '#ecd2c4', '#d4dfec', '#f2e4c4', '#e2d6ea', '#e8e4dc'].map(C);
const pick = (R, list) => list[Math.floor(R() * list.length)];

const TEMPLATES = {
  // ============================================================ A FLAT: a living room with a small kitchen and a table
  home(b, R, mirror) {
    const W = 4.8 + R() * 0.9, D = 4.5 + R() * 0.7, H = 2.7;
    const wallpaper = R() < 0.35;
    const wx = 1.3 + R() * 0.2;
    const r = room(b, R, mirror, W, D, H, {
      label: 'LIVING ROOM',
      shell: { floor: R() < 0.75 ? 'planks' : 'tiles', floorTile: R() < 0.75 ? 1.2 : 0.5, wall: wallpaper ? 'wallpaper' : 'wallpaint', wallTile: wallpaper ? 0.5 : 2.0, wallColor: wallpaper ? C('#fff6ea') : pick(R, PASTEL), skirting: C('#e8e2d4'), ceiling: { color: C('#f2ede4') } },
      holes: [
        { wall: 'z0', a: 0.55, b: 1.45, y0: 0, y1: 2.15, kind: 'door', depth: 0.25 },
        { wall: 'z1', a: wx, b: wx + 1.1, y0: 0.95, y1: 2.15, kind: 'window', depth: 0.28 },
      ],
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#f2efe6'), panes: [2, 2], curtains: { color: pick(R, [C('#e0782c'), C('#7a9ab8'), C('#d8c8a8'), C('#b85a5a')]), width: 0.42 } });
    // the small kitchen along the right wall (looking in): cupboards with a sink, a fridge in the corner
    const cw = D - 2.75;
    const K = F(0.3, 1.85 + cw / 2, PI / 2);
    const top = cabinets(K, { w: cw, color: pick(R, [C('#b07a45'), C('#e8e2d4'), C('#7f9f8f')]), top: C('#e9dfc8'), sinkAt: 0 });
    kettle(K, -cw / 2 + 0.2, top, -0.05);
    fruitBowl(K, cw / 2 - 0.25, top, 0.0);
    const ks = wallShelf(F(0, 1.85 + cw / 2, PI / 2), 0, 1.6, 0, Math.min(1.2, cw), 0.2, C('#8a5a34'));
    for (let i = 0; i < 4; i++) jar(F(0, 1.85 + cw / 2, PI / 2), -0.42 + i * 0.28, ks, 0.1, pick(R, [C('#e8d8a8'), C('#b84a1c'), C('#6a8a3a'), C('#c8c0a8')]), 0.8);
    fridge(F(0.42, D - 0.42, PI / 2));
    // a little table by the window for two
    table(F(1.85, D * 0.52, PI / 2 + 0.05), { w: 0.85, d: 0.7, h: 0.74, color: C('#c8a070') });
    chairPadded(F(1.85, D * 0.52 - 0.62, 0.15), { pad: pick(R, [C('#b8463a'), C('#3a6ea5'), C('#5a8a4a')]) });
    chairPadded(F(1.85, D * 0.52 + 0.62, PI - 0.1), { pad: pick(R, [C('#b8463a'), C('#3a6ea5'), C('#5a8a4a')]) });
    flowers(F(1.85, D * 0.52, 0), 0, 0.74, 0);
    // the sofa against the front wall, the television across from it, a low table between, a rug
    const sx = W - 1.25;
    sofa(F(sx, 0.47, 0), { w: 2.0, color: pick(R, [C('#5a6e7a'), C('#8a5a4a'), C('#6a7a5a'), C('#c8b89a'), C('#3f4a5a')]), pillow: pick(R, [C('#d9a441'), C('#e0782c'), C('#f2efe8')]) });
    tvUnit(F(sx, D - 0.22, PI), { w: 1.5 });
    rug(r.RF, X(sx), (0.95 + D - 0.45) / 2, 2.1, 1.5, r.ROT(0));
    coffeeTable(F(sx, (0.95 + D - 0.45) / 2, 0.04));
    bookcase(F(W - 0.17, 1.65, -PI / 2), { w: 0.85, h: 1.9 });
    armchair(F(W - 0.55, D - 1.35, -PI / 2 - 0.5), { color: pick(R, [C('#c08a3e'), C('#7a8a9a'), C('#a84a3a')]) });
    plant(r.RF, X(W - 0.33), 0, D - 0.33, 1.3, { n: 12, tall: 0.5 });
    const lampAt = floorLamp(r.RF, X(W - 2.45), 0.35);
    picture(F(sx, 0, 0), -0.45, 1.75, 0, 0.42, 0.32, pick(R, [0, 7, 4]));
    picture(F(sx, 0, 0), 0.4, 1.8, 0, 0.3, 0.4, pick(R, [6, 3, 2]));
    picture(F(W, D - 1.35, -PI / 2), 0, 1.7, 0, 0.5, 0.36, pick(R, [0, 4, 7]));
    coat(F(1.85, 0, 0), 0, 1.82, 0, pick(R, [C('#46586a'), C('#8a4a3a'), C('#3a3a3a')]));
    switchPlate(F(1.6, 0, 0), 0, 1.15, 0);
    ceilingGlobe(r.RF, X(W / 2), D / 2, H);
    return result(r, { aim: [X(wx + 0.6 + 0.4), 0, D - 2.4], lamp: lampAt, lampPower: 3.2, lampRange: 7, fill: [1, 0.88, 0.74] });
  },

  // ============================================================ A CORNER SHOP: shelves, drinks fridges, a counter with a till
  shop(b, R, mirror) {
    const W = 5.6 + R() * 1.0, D = 5.4 + R() * 0.8, H = 3.0;
    const r = room(b, R, mirror, W, D, H, {
      label: 'SHOP',
      shell: { floor: 'walltile', floorTile: 0.8, floorColor: C('#d8dadc'), wall: 'wallpaint', wallTile: 2.0, wallColor: pick(R, [C('#f2f2ee'), C('#eef0e8'), C('#f4ece0')]), skirting: C('#8a9096'), ceiling: { color: C('#f4f4f2') } },
      holes: [
        { wall: 'z0', a: 0.6, b: 1.55, y0: 0, y1: 2.2, kind: 'door', depth: 0.25 },
        { wall: 'z0', a: 2.1, b: W - 0.6, y0: 0.7, y1: 2.35, kind: 'window', depth: 0.25 },
      ],
      trim: C('#5a6066'),
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#5a6066'), panes: [3, 1] });
    // (the shopkeeper sits between the wall and the counter)
    shopCounter(F(1.0, 2.5, PI / 2), { w: 1.6 });
    officeChair(F(0.38, 2.5, PI / 2), {});
    const L = Math.min(2.8, D - 3.3);
    gondola(F(W * 0.44, 2.0 + L / 2, PI / 2), { l: L });
    gondola(F(W * 0.74, 2.0 + L / 2, PI / 2), { l: L });
    const nf = Math.max(2, Math.floor((W - 1.4) / 0.8));
    for (let i = 0; i < nf; i++) drinksFridge(F(0.9 + i * 0.8, D - 0.36, PI));
    rack(F(W - 0.26, (2.0 + D - 1.0) / 2, -PI / 2), { w: Math.min(2.6, D - 3.0), h: 1.9 });
    for (let i = 0; i < 3; i++) ceilingPanel(r.RF, X(W * (0.25 + i * 0.25)), D / 2, H, 1.2, 0.3);
    plant(r.RF, X(1.85), 0, 0.4, 1.4, { n: 10 });
    boxes(r.RF, X(W - 0.5), 1.2, 2);
    const lamp = [X(W / 2), H - 0.3, D / 2];
    return result(r, { aim: [X(W * 0.6), 0, 2.2], lamp, lampPower: 9, lampRange: 9, lampColor: [0.95, 0.97, 1.0], glassDoor: true, doorColor: C('#4a5056'), fill: [0.96, 0.97, 1.0] });
  },

  // ============================================================ A CAFÉ: a counter with a coffee machine and cakes, small round tables
  cafe(b, R, mirror) {
    const W = 5.8 + R() * 0.9, D = 5.2 + R() * 0.8, H = 3.0;
    const dado = pick(R, [C('#3f5a4a'), C('#7a2a2a'), C('#2f4a5a')]);
    const r = room(b, R, mirror, W, D, H, {
      label: 'CAFÉ',
      shell: { floor: R() < 0.5 ? 'planks' : 'checker', floorTile: R() < 0.5 ? 1.2 : 0.6, wall: 'wallpaint', wallTile: 2.0, wallColor: pick(R, [C('#f4e6c8'), C('#f2e8dc'), C('#e8e0d0')]),
        dado: { mat: 'walltile', h: 1.1, tile: 0.6, color: [1, 1, 1], border: dado }, ceiling: { color: C('#efe8dc') } },
      holes: [
        { wall: 'z0', a: 0.6, b: 1.55, y0: 0, y1: 2.2, kind: 'door', depth: 0.25 },
        { wall: 'z0', a: 2.2, b: W - 0.6, y0: 0.75, y1: 2.35, kind: 'window', depth: 0.25 },
      ],
      trim: C('#3a2a1e'),
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#3a2a1e'), panes: [3, 2], curtains: null });
    const cw = Math.min(3.0, W - 1.8);
    cafeCounter(F(W / 2 + 0.3, D - 0.34, PI), { w: cw, color: dado });
    menuBoard(F(W / 2 + 0.3, D, PI), 0, 1.72, 0, Math.min(1.8, cw - 0.4), 0.75);
    const shelf = wallShelf(F(W / 2 + 0.3, D, PI), 0, 2.55, 0, cw, 0.18, C('#8a5a34'));
    for (let i = 0; i < 6; i++) mug(F(W / 2 + 0.3, D, PI), -cw / 2 + 0.25 + i * ((cw - 0.5) / 5), shelf, 0.09, pick(R, [C('#f2efe8'), C('#d84a3a'), C('#3a7ad2'), C('#e8c030')]), i);
    // the tables (each with two chairs), away from the door
    const spots = [[2.6, 1.6], [4.2, 1.6], [2.6, 3.0], [4.2, 3.0], [W - 0.8, 2.3]];
    const used = [];
    for (const [tx, tz] of spots) {
      if (tx > W - 0.7 || tz > D - 1.6 || used.some(([ux, uz]) => Math.hypot(ux - tx, uz - tz) < 1.5)) continue;
      used.push([tx, tz]);
      roundTable(F(tx, tz, 0), { color: C('#e8e2d4') });
      bistroChair(F(tx - 0.52, tz, PI / 2 + (R() - 0.5) * 0.4));
      bistroChair(F(tx + 0.52, tz, -PI / 2 + (R() - 0.5) * 0.4));
      if (R() < 0.6) cup(F(tx, tz, 0), (R() - 0.5) * 0.2, 0.74, (R() - 0.5) * 0.2, C('#f2efe8'), R() * 6);
      if (R() < 0.4) flowers(F(tx, tz, 0), 0.08, 0.74, -0.05);
    }
    plant(r.RF, X(0.4), 0, D - 0.4, 1.6, { n: 12, tall: 0.5 });
    plant(r.RF, X(W - 0.35), 0, 0.45, 1.3, { n: 10 });
    for (let i = 0; i < 3; i++) ceilingGlobe(r.RF, X(2.2 + i * 1.3), 2.3, H);
    picture(F(0, 2.6, PI / 2), 0, 1.75, 0, 0.5, 0.36, pick(R, [0, 6, 7]));
    const lamp = [X(W / 2), H - 0.4, 2.5];
    return result(r, { aim: [X(W * 0.55), 0, 2.4], lamp, lampPower: 6, lampRange: 9, lampColor: [1.0, 0.76, 0.5], glassDoor: true, doorColor: C('#3a2a1e'), fill: [1, 0.86, 0.68] });
  },

  // ============================================================ AN OFFICE: desks with screens, cabinets, a whiteboard
  office(b, R, mirror) {
    const W = 6.2 + R() * 0.9, D = 5.4 + R() * 0.8, H = 2.9;
    const wx = W * 0.32;
    const r = room(b, R, mirror, W, D, H, {
      label: 'OFFICE',
      shell: { floor: 'planks', floorTile: 1.2, floorColor: C('#b8b4ae'), wall: 'wallpaint', wallTile: 2.0, wallColor: pick(R, [C('#f2f2f0'), C('#eef0f2'), C('#f0ece6')]), skirting: C('#8a9096'), ceiling: { color: C('#f6f6f4') } },
      holes: [
        { wall: 'z0', a: 0.6, b: 1.55, y0: 0, y1: 2.2, kind: 'door', depth: 0.25 },
        { wall: 'z1', a: wx, b: wx + 2.0, y0: 0.85, y1: 2.3, kind: 'window', depth: 0.3 },
      ],
      trim: C('#8a9096'),
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#8a9096'), panes: [3, 2] });
    const desks = [[2.6, 2.0], [4.3, 2.0], [2.6, 3.7], [4.3, 3.7]];
    for (const [dx, dz] of desks) {
      if (dx > W - 1.0 || dz > D - 0.9) continue;
      officeDesk(F(dx, dz, PI), { screen: [0.3 + R() * 0.3, 0.45 + R() * 0.2, 0.7] });
      officeChair(F(dx + (R() - 0.5) * 0.2, dz - 0.62, (R() - 0.5) * 0.6), {});
    }
    for (let i = 0; i < 3; i++) filingCabinet(F(0.32, 2.0 + i * 0.5, PI / 2));
    waterCooler(r.RF, X(W - 0.35), 0.6);
    whiteboard(F(W, D / 2 + 0.3, -PI / 2), 0, 1.0, 0, 1.6, 0.95);
    bigPlant(r.RF, X(0.45), D - 0.45);
    plant(r.RF, X(W - 0.4), 0, D - 0.4, 1.3, { n: 10 });
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ceilingPanel(r.RF, X(W * (0.33 + i * 0.34)), D * (0.33 + j * 0.34), H, 1.2, 0.3);
    clock(F(0, 1.2, PI / 2), 0, 2.1, 0);
    const lamp = [X(W / 2), H - 0.3, D / 2];
    return result(r, { aim: [X(wx + 1.0), 0, D - 2.3], lamp, lampPower: 8, lampRange: 9, lampColor: [0.95, 0.97, 1.0], glassDoor: true, doorColor: C('#4a5056'), fill: [0.97, 0.98, 1.0] });
  },

  // ============================================================ A LOBBY: letter boxes, two lifts, a desk, a bench, plants
  lobby(b, R, mirror) {
    const W = 6.0 + R() * 0.8, D = 5.2 + R() * 0.8, H = 3.2;
    const r = room(b, R, mirror, W, D, H, {
      label: 'LOBBY',
      shell: { floor: 'walltile', floorTile: 1.0, floorColor: C('#e8e0d4'), wall: 'wallpaint', wallTile: 2.0, wallColor: pick(R, [C('#efe6d6'), C('#e6e8ea'), C('#f0e8e0')]), skirting: C('#5a4a3a'), ceiling: { color: C('#f2efe8') } },
      holes: [
        { wall: 'z0', a: 0.6, b: 1.6, y0: 0, y1: 2.3, kind: 'door', depth: 0.25 },
        { wall: 'z0', a: W - 2.2, b: W - 0.6, y0: 0.8, y1: 2.5, kind: 'window', depth: 0.25 },
      ],
      trim: C('#5a4a3a'),
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#4a4f54'), panes: [2, 2] });
    mailboxes(F(0, D / 2 + 0.4, PI / 2), 0, 0.9, 0, 5, 4);
    liftDoors(F(W / 2 - 0.85, D, PI), 0, 0);
    liftDoors(F(W / 2 + 0.85, D, PI), 0, 0);
    receptionDesk(F(W - 0.75, D / 2 + 0.2, -PI / 2), { w: 1.6 });
    bench(F((1.6 + W - 2.2) / 2, 0.32, 0), { w: Math.min(1.4, W - 4.0) });
    bigPlant(r.RF, X(0.45), D - 0.45);
    bigPlant(r.RF, X(W - 0.45), 0.6);
    rug(r.RF, X(W / 2), D / 2 - 0.2, 2.4, 1.6, 0);
    picture(F(W, 1.4, -PI / 2), 0, 1.75, 0, 0.6, 0.45, pick(R, [0, 7, 3]));
    for (let i = 0; i < 2; i++) ceilingGlobe(r.RF, X(W / 2 - 1.2 + i * 2.4), D / 2, H);
    const lamp = [X(W / 2), H - 0.3, D / 2];
    return result(r, { aim: [X(W - 1.6), 0, 2.6], lamp, lampPower: 7, lampRange: 9, lampColor: [1.0, 0.86, 0.66], glassDoor: true, doorColor: C('#3a3f44'), fill: [1, 0.92, 0.82] });
  },

  // ============================================================ A GARAGE: a work bench, tools on the wall, tires, a drum, shelves
  garage(b, R, mirror) {
    const W = 5.6 + R() * 0.8, D = 6.0 + R() * 0.8, H = 3.2;
    const r = room(b, R, mirror, W, D, H, {
      label: 'GARAGE',
      shell: { floor: 'plaster', floorTile: 2.5, floorColor: C('#9a9894'), wall: 'plaster', wallTile: 2.2, wallColor: C('#b8b4ac'), ceiling: { color: C('#c8c4bc') } },
      holes: [
        { wall: 'z0', a: W / 2 - 1.4, b: W / 2 + 1.4, y0: 0, y1: 2.6, kind: 'door', depth: 0.25 },
        { wall: 'z1', a: W / 2 - 0.55, b: W / 2 + 0.55, y0: 2.0, y1: 2.65, kind: 'window', depth: 0.25 },
      ],
      trim: C('#5a5a5a'),
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#5a5a5a'), panes: [3, 1] });
    workbench(F(W - 1.3, D - 0.38, PI), { w: 2.0 });
    pegboard(F(W - 1.3, D, PI), 0, 1.15, 0, 1.8, 0.85);
    rack(F(0.28, D / 2, PI / 2), { w: Math.min(2.6, D - 2.4), h: 2.1 });
    tires(r.RF, X(W - 0.5), 1.0, 3);
    tires(r.RF, X(W - 0.55), 1.75, 2);
    drum(r.RF, X(0.45), D - 0.45, pick(R, [C('#2a5a8a'), C('#8a2a2a'), C('#3a6a3a')]));
    boxes(r.RF, X(0.45), 1.2, 3);
    for (let i = 0; i < 2; i++) ceilingPanel(r.RF, X(W / 2), D * (0.33 + i * 0.34), H, 1.3, 0.25);
    const lamp = [X(W / 2), H - 0.3, D / 2];
    return result(r, { aim: [X(W / 2), 0, D - 2.0], lamp, lampPower: 7, lampRange: 9, lampColor: [0.95, 0.97, 1.0], shutter: true, doorColor: C('#7a7f84'), fill: [0.96, 0.96, 0.98] });
  },

  // ============================================================ A BANK: a long counter behind glass with three tellers,
  //   cash machines, a rope lane to wait in, the round door of the vault behind the counter, a guard at the door
  bank(b, R, mirror) {
    const W = 9.2, D = 7.8, H = 3.4;
    const green = C('#2f4a3f');
    const r = room(b, R, mirror, W, D, H, {
      label: 'BANK',
      shell: { floor: 'walltile', floorTile: 1.0, floorColor: C('#cfc6b4'), wall: 'wallpaint', wallTile: 2.0, wallColor: C('#efe8da'),
        dado: { mat: 'walltile', h: 1.15, tile: 0.6, color: C('#e4dccb'), border: green }, skirting: green, ceiling: { color: C('#f2efe8') } },
      holes: [
        { wall: 'z0', a: 0.7, b: 1.9, y0: 0, y1: 2.35, kind: 'door', depth: 0.25 },
        { wall: 'z0', a: 2.7, b: W - 0.8, y0: 0.8, y1: 2.6, kind: 'window', depth: 0.25 },
      ],
      trim: green,
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: green, panes: [4, 2] });
    // the counter from wall to wall, the three tellers behind it
    const cz = D - 2.5;
    tellerCounter(F(W / 2, cz, PI), { w: W - 0.04, windows: 3 });
    const shirts = [C('#e8eaee'), C('#dfe6f2'), C('#f2ece0')], ties = [green, C('#7a2a2a'), C('#22344e')];
    for (let i = 0; i < 3; i++) person(F(W * (i + 0.5) / 3 + 0.1, cz + 0.75, PI + (R() - 0.5) * 0.3), { shirt: shirts[i], tie: ties[i], trousers: C('#2a2f38') });
    // behind them: the vault, cabinets, a desk with a screen
    vaultDoor(F(W - 2.1, D, PI), 0, 0);
    for (let i = 0; i < 3; i++) filingCabinet(F(0.9 + i * 0.5, D - 0.32, PI), { color: C('#7d858c') });
    officeDesk(F(3.7, D - 0.45, PI), { screen: [0.3, 0.6, 0.4] });
    clock(F(W / 2 - 0.6, D, PI), 0, 2.6, 0);
    // two cash machines on the side wall, a desk to write at across the room
    atm(F(0, 3.0, PI / 2));
    atm(F(0, 4.05, PI / 2));
    standDesk(F(W - 0.3, 3.4, -PI / 2), { w: 1.4 });
    // a lane of rope to wait in, in front of the middle teller
    ropePosts(r.RF, [[X(3.3), cz - 1.1], [X(3.3), cz - 2.6], [X(5.9), cz - 2.6]].map(([x, z]) => [x, z]));
    ropePosts(r.RF, [[X(5.9), cz - 1.1], [X(5.9), cz - 1.8]]);
    // somebody waiting, the guard beside the door, seats under the window, plants
    person(F(4.6, cz - 1.05, PI + 0.1), { shirt: pick(R, [C('#7a4a3a'), C('#3a5a7a'), C('#c8b89a')]), trousers: C('#3a3a40') });
    person(F(2.55, 0.75, 0.5), { shirt: C('#22344e'), trousers: C('#1c222c'), cap: C('#1c2a40'), badge: true, size: 1.03 });
    waitingSeats(F((2.9 + W - 1.0) / 2 + 0.6, 0.36, 0), { n: 4, color: green });
    bigPlant(r.RF, X(W - 0.45), 0.6);
    bigPlant(r.RF, X(0.45), D - 3.4 - 0.3 > 4.9 ? 5.2 : 5.2);
    picture(F(W, 1.7, -PI / 2), 0, 1.8, 0, 0.7, 0.5, pick(R, [0, 7, 3]));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ceilingPanel(r.RF, X(W * (0.2 + i * 0.3)), 1.8 + j * 2.6, H, 1.4, 0.35);
    for (let i = 0; i < 2; i++) ceilingPanel(r.RF, X(W * (0.3 + i * 0.4)), D - 1.2, H, 1.2, 0.3);
    const lamp = [X(W / 2), H - 0.35, D / 2 - 0.6];
    return result(r, { aim: [X(W * 0.6), 0, 2.6], lamp, lampPower: 11, lampRange: 12, lampColor: [1.0, 0.93, 0.8], glassDoor: true, doorColor: green, fill: [1, 0.95, 0.86],
      spots: [{ id: 'atm', x: X(1.05), z: 3.5, r: 1.0 }, { id: 'teller', x: X(W / 2 + 0.1), z: cz - 1.0, r: 1.1 }] });
  },

  // ============================================================ A POLICE STATION: the front desk, seats to wait on,
  //   a board of notices, a holding cell behind bars, lockers and two desks at the back
  police(b, R, mirror) {
    const W = 8.8, D = 7.4, H = 3.0;
    const navy = C('#22344e');
    const r = room(b, R, mirror, W, D, H, {
      label: 'STATION',
      shell: { floor: 'walltile', floorTile: 0.8, floorColor: C('#9da3aa'), wall: 'wallpaint', wallTile: 2.0, wallColor: C('#e6eaee'),
        dado: { mat: 'walltile', h: 1.1, tile: 0.6, color: C('#d5dbe2'), border: navy }, skirting: navy, ceiling: { color: C('#f2f4f5') } },
      holes: [
        { wall: 'z0', a: 0.7, b: 1.8, y0: 0, y1: 2.3, kind: 'door', depth: 0.25 },
        { wall: 'z0', a: 2.6, b: W - 0.8, y0: 0.9, y1: 2.4, kind: 'window', depth: 0.25 },
      ],
      trim: navy,
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#4a5560'), panes: [4, 2] });
    // the front desk, an officer behind it
    frontDesk(F(W / 2 + 1.0, 3.1, PI), { w: 2.8 });
    person(F(W / 2 + 1.0, 3.85, PI + 0.15), { shirt: C('#2c4468'), trousers: C('#1c222c'), cap: C('#1c2a40'), badge: true, tie: C('#141a24') });
    // seats under the window, somebody waiting on their feet beside them, the notice board
    waitingSeats(F((2.7 + W - 0.9) / 2, 0.36, 0), { n: 4, color: C('#3f5a78') });
    person(F(W - 1.0, 1.25, -1.9), { shirt: pick(R, [C('#8a5a3a'), C('#5a6a5a'), C('#b8a070')]), trousers: C('#3a3a40') });
    noticeBoard(F(W, 2.2, -PI / 2), 0, 1.1, 0, 2.0, 1.0);
    clock(F(W, 4.2, -PI / 2), 0, 2.3, 0);
    // the holding cell in the back corner: bars on two sides, a bench, somebody inside
    const cellW = 3.0, cellZ = D - 2.5;
    cellBars(F(cellW / 2, cellZ, 0), { w: cellW, h: H, doorAt: 0.75 });
    cellBars(F(cellW, (cellZ + D) / 2, PI / 2), { w: D - cellZ, h: H, door: false });
    bench(F(cellW / 2 - 0.2, D - 0.3, PI), { w: 1.8 });
    person(F(0.7, D - 1.1, 2.4), { shirt: pick(R, [C('#6a6a6a'), C('#8a3a2a'), C('#2f4a3f')]), trousers: C('#30343a') });
    // at the back: lockers, two desks with screens, cabinets, water
    lockers(F(cellW + 1.25, D - 0.26, PI), { n: 5 });
    officeDesk(F(W - 1.9, D - 1.3, PI), { screen: [0.25, 0.4, 0.7] });
    officeChair(F(W - 1.9, D - 0.62, PI + 0.3), {});
    officeDesk(F(W - 1.9, D - 3.0, PI), { screen: [0.3, 0.5, 0.75] });
    person(F(W - 2.0, D - 2.3, PI - 0.2), { shirt: C('#2c4468'), trousers: C('#1c222c'), badge: true });
    filingCabinet(F(W - 0.32, D - 0.9, -PI / 2), {});
    filingCabinet(F(W - 0.32, D - 1.4, -PI / 2), {});
    waterCooler(r.RF, X(0.4), 2.4);
    bigPlant(r.RF, X(0.45), 3.6);
    whiteboard(F(cellW + 3.2, D, PI), 0, 1.05, 0, 1.5, 0.9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ceilingPanel(r.RF, X(W * (0.2 + i * 0.3)), 1.9 + j * 3.2, H, 1.4, 0.3);
    const lamp = [X(W / 2), H - 0.3, D / 2 - 0.4];
    return result(r, { aim: [X(W * 0.6), 0, 2.4], lamp, lampPower: 10, lampRange: 11, lampColor: [0.92, 0.96, 1.0], glassDoor: true, doorColor: navy, fill: [0.94, 0.97, 1.0],
      spots: [{ id: 'desk', x: X(W / 2 + 1.0), z: 2.1, r: 1.15 }] });
  },

  // ============================================================ A STORE ROOM: shelves and boxes
  store(b, R, mirror) {
    const W = 4.6 + R() * 0.8, D = 4.6 + R() * 0.8, H = 2.9;
    const r = room(b, R, mirror, W, D, H, {
      label: 'STORE ROOM',
      shell: { floor: 'plaster', floorTile: 2.5, floorColor: C('#a09c96'), wall: 'plaster', wallTile: 2.2, wallColor: C('#c4c0b8'), ceiling: { color: C('#d0ccc4') } },
      holes: [
        { wall: 'z0', a: W / 2 - 1.1, b: W / 2 + 1.1, y0: 0, y1: 2.4, kind: 'door', depth: 0.25 },
        { wall: 'z1', a: W / 2 - 0.5, b: W / 2 + 0.5, y0: 1.9, y1: 2.5, kind: 'window', depth: 0.25 },
      ],
      trim: C('#5a5a5a'),
    });
    const { F, X } = r;
    windowIn(b, r.win, { color: C('#5a5a5a'), panes: [2, 1] });
    rack(F(0.28, D / 2 + 0.3, PI / 2), { w: Math.min(2.4, D - 1.8), h: 2.0 });
    rack(F(W - 0.28, D / 2 + 0.3, -PI / 2), { w: Math.min(2.4, D - 1.8), h: 2.0 });
    rack(F(W / 2, D - 0.28, PI), { w: Math.min(2.2, W - 1.6), h: 2.0 });
    boxes(r.RF, X(W / 2 - 0.5), D / 2, 3);
    boxes(r.RF, X(W / 2 + 0.6), D / 2 + 0.4, 2);
    crate(r.RF, X(W / 2), 0, 1.5, 0.3, 'potato');
    ceilingPanel(r.RF, X(W / 2), D / 2, H, 1.2, 0.25);
    const lamp = [X(W / 2), H - 0.3, D / 2];
    return result(r, { aim: [X(W / 2), 0, D - 1.8], lamp, lampPower: 5, lampRange: 8, lampColor: [0.95, 0.97, 1.0], shutter: true, doorColor: C('#7a7f84'), fill: [0.95, 0.95, 0.97] });
  },
};
