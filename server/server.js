// ---------------------------------------------------------------------------
// server.js - THE WORLD SERVER of Phantom Grid (online free roam).
//
// WHAT IT DOES
//   Players who press ONLINE in the game connect to this program. It puts them into a WORLD and passes on, ten
//   times a second, where everybody in that world is - so each player sees the others walk, drive and ride.
//
//   * THE MAIN WORLD ("MAIN"): everybody who chooses "JOIN THE MAIN WORLD" meets here. When it is full a second
//     main world is opened by itself (MAIN-2, MAIN-3 ...).
//   * YOUR OWN WORLD: "MAKE MY OWN WORLD" gives a code of six letters (like K7QP2M). Whoever types that code joins
//     the same world; nobody else can come in. The world is closed when its last player leaves.
//
// The server only passes messages on. It keeps no accounts, no passwords and nothing on a disk.
//
// HOW TO RUN IT
//   node server.js              (needs Node.js 18 or newer; no "npm install" - it uses nothing but Node itself)
//   The port comes from the PORT setting of the host (default 8080).
//   In the game: ONLINE > SERVER ADDRESS, for example  wss://my-world.example.com   (ws://192.168.1.20:8080 at home)
//   See README.md in this folder for the steps on a free host.
//
// THE MESSAGES (text, JSON)
//   game -> server   { t: 'join', world: 'MAIN' | 'NEW' | 'K7QP2M', name }
//                    { t: 's', x, y, z, h, k, sp, w }        my state: place, heading, vehicle kind ('' on foot),
//                                                             speed, weapon in the hand
//                    { t: 'e', k: 'shot' | 'bat' | 'say', ... }   something that happened (passed on as it is)
//   server -> game   { t: 'joined', id, world, own, players: [{ id, name }], max }
//                    { t: 'in', id, name }   { t: 'out', id }
//                    { t: 'u', p: [[id, x, y, z, h, k, sp, w], ...] }     everybody else, ten times a second
//                    { t: 'e', id, k, ... }                      an event of another player
//                    { t: 'no', why }                            could not join (a wrong code, the world is full)
// ---------------------------------------------------------------------------

'use strict';
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const MAX_PER_WORLD = Number(process.env.MAX_PLAYERS) || 16;     // players in one world
const MAX_TOTAL = Number(process.env.MAX_TOTAL) || 400;          // connections in all
const TICK_MS = 100;                                             // the state goes out ten times a second
const MAX_MESSAGE = 2048;                                        // bytes: bigger messages close the connection
const IDLE_MS = 45000;                                           // nothing heard for this long: gone
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';             // (the fixed text of the WebSocket handshake)

const worlds = new Map();          // name -> { name, own, players: Map(id -> player) }
let nextId = 1, total = 0;

const now = () => Date.now();
const clean = (s, n) => String(s || '').replace(/[^\w .\-]/g, '').trim().slice(0, n);
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0; };
const round = (v, k) => Math.round(v * k) / k;

// ---- worlds ----
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';            // (no 0/O, 1/I: easy to read out to a friend)
  for (;;) { let c = ''; const b = crypto.randomBytes(6); for (let i = 0; i < 6; i++) c += A[b[i] % A.length]; if (!worlds.has(c)) return c; }
}
function world(name, own) {
  let w = worlds.get(name);
  if (!w) { w = { name, own, players: new Map() }; worlds.set(name, w); }
  return w;
}
// the main world with room in it (MAIN, MAIN-2 ...)
function mainWorld() {
  for (let i = 1; i < 100; i++) { const w = world(i === 1 ? 'MAIN' : 'MAIN-' + i, false); if (w.players.size < MAX_PER_WORLD) return w; }
  return null;
}
function leave(p) {
  const w = p.world;
  if (!w) return;
  p.world = null;
  w.players.delete(p.id);
  for (const q of w.players.values()) send(q, { t: 'out', id: p.id });
  if (!w.players.size && w.name !== 'MAIN') worlds.delete(w.name);
}
function join(p, m) {
  if (p.world) leave(p);
  const want = clean(m.world, 12).toUpperCase() || 'MAIN';
  let w = null;
  if (want === 'MAIN') w = mainWorld();
  else if (want === 'NEW') w = world(newCode(), true);
  else { w = worlds.get(want); if (!w || !w.own) return send(p, { t: 'no', why: 'code' }); }
  if (!w || w.players.size >= MAX_PER_WORLD) return send(p, { t: 'no', why: 'full' });
  p.name = clean(m.name, 14) || 'PLAYER ' + p.id;
  p.world = w; p.state = null;
  send(p, { t: 'joined', id: p.id, world: w.name, own: w.own, max: MAX_PER_WORLD, players: [...w.players.values()].map((q) => ({ id: q.id, name: q.name })) });
  for (const q of w.players.values()) send(q, { t: 'in', id: p.id, name: p.name });
  w.players.set(p.id, p);
}

// ---- one message of a player ----
function onMessage(p, text) {
  let m;
  try { m = JSON.parse(text); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  p.heard = now();
  if (m.t === 'join') return join(p, m);
  if (!p.world) return;
  if (m.t === 's') {
    // (only numbers in sensible ranges are kept: nothing a player sends is trusted)
    p.state = [p.id, round(num(m.x, -5000, 5000), 100), round(num(m.y, -100, 500), 100), round(num(m.z, -5000, 5000), 100), round(num(m.h, -7, 7), 1000),
      clean(m.k, 20), round(num(m.sp, -100, 100), 10), clean(m.w, 8)];
  } else if (m.t === 'e') {
    // not more than twelve events a second from one player
    const t = now();
    if (t - p.evAt > 1000) { p.evAt = t; p.evN = 0; }
    if (++p.evN > 12) return;
    const k = clean(m.k, 8);
    if (!k) return;
    const out = { t: 'e', id: p.id, k };
    if (k === 'say') out.m = String(m.m || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 80);
    else { out.x = round(num(m.x, -5000, 5000), 10); out.z = round(num(m.z, -5000, 5000), 10); out.dx = round(num(m.dx, -1, 1), 100); out.dz = round(num(m.dz, -1, 1), 100); out.d = round(num(m.d, 0, 200), 10); out.w = clean(m.w, 8); }
    for (const q of p.world.players.values()) if (q !== p) send(q, out);
  }
}

// ---- ten times a second: everybody's state to everybody else in the same world ----
setInterval(() => {
  const t = now();
  for (const w of worlds.values()) {
    if (w.players.size < 1) continue;
    const all = [];
    for (const p of w.players.values()) {
      if (t - p.heard > IDLE_MS) { close(p); continue; }
      if (p.state) all.push(p.state);
    }
    if (w.players.size < 2) continue;
    for (const p of w.players.values()) {
      const list = all.filter((s) => s[0] !== p.id);
      if (list.length) send(p, { t: 'u', p: list });
    }
  }
}, TICK_MS);

// ===========================================================================
// THE WEBSOCKET PART (the standard "RFC 6455", written out here so that nothing has to be installed)
// ===========================================================================
function frame(text) {
  const data = Buffer.from(text, 'utf8'), n = data.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : null;
  return head ? Buffer.concat([head, data]) : null;                // (the server never sends more than 64 kB at once)
}
function send(p, obj) {
  if (p.dead || !p.socket.writable) return;
  const f = frame(JSON.stringify(obj));
  if (!f) return;
  // (a player whose connection is too slow to take the messages is dropped, not queued without end)
  if (p.socket.writableLength > 256 * 1024) return close(p);
  p.socket.write(f);
}
function close(p) {
  if (p.dead) return;
  p.dead = true;
  total--;
  leave(p);
  try { p.socket.end(Buffer.from([0x88, 0])); } catch (e) { /* already gone */ }
  setTimeout(() => { try { p.socket.destroy(); } catch (e) { /* gone */ } }, 500);
}
// the bytes that came in: cut into frames, each frame's text handed on
function onData(p, chunk) {
  p.buf = p.buf.length ? Buffer.concat([p.buf, chunk]) : chunk;
  for (;;) {
    const b = p.buf;
    if (b.length < 2) return;
    const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, at = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); at = 4; }
    else if (len === 127) return close(p);                         // (nothing that long is ever sent by the game)
    if (!masked || len > MAX_MESSAGE) return close(p);             // (a browser always masks what it sends)
    if (b.length < at + 4 + len) return;
    const mask = b.subarray(at, at + 4), data = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) data[i] = b[at + 4 + i] ^ mask[i & 3];
    p.buf = b.subarray(at + 4 + len);
    if (op === 0x8) return close(p);                               // close
    if (op === 0x9) { p.socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }   // ping -> pong
    if (op === 0xa) { p.heard = now(); continue; }                 // pong
    if (op !== 0x1 || !fin) return close(p);                       // (only whole text messages)
    onMessage(p, data.toString('utf8'));
    if (p.dead) return;
  }
}

const server = http.createServer((req, res) => {
  // a plain web request: a small status page (a host uses it to see that the server is alive)
  let players = 0;
  for (const w of worlds.values()) players += w.players.size;
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(`Phantom Grid world server\nplayers online: ${players}\nworlds open: ${[...worlds.values()].filter((w) => w.players.size).length}\n`);
});
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket' || total >= MAX_TOTAL) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const p = { id: nextId++, socket, buf: Buffer.alloc(0), world: null, name: '', state: null, heard: now(), evAt: 0, evN: 0, dead: false };
  total++;
  socket.on('data', (chunk) => { if (!p.dead) onData(p, chunk); });
  socket.on('close', () => close(p));
  socket.on('error', () => close(p));
});
server.listen(PORT, () => console.log(`Phantom Grid world server: listening on port ${PORT} (up to ${MAX_PER_WORLD} players in a world)`));
