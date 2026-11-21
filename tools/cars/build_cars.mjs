// ---------------------------------------------------------------------------
// build_cars.mjs - turns the big car scans into small game models.
//
// For every car it reads the original file (about 1.9 million triangles) and
// the baked pictures (six photos of the car, made by bake.html) and writes:
//   <name>.glb     the car you drive: about 20 000 triangles, cut into parts
//                  body, glass, door_l, door_r (+ their glass), four wheels
//   <name>_lo.glb  a very light version (about 3 000 triangles, colors stored
//                  in the vertices) for parked cars and traffic
//   cars.json      sizes: wheels, doors, seat
// ---------------------------------------------------------------------------
import { NodeIO, Document } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const S = process.env.SCRATCH;
const OUT = process.env.OUT;
const only = process.argv.slice(2);

// Per car: where things are (meters; z = along the car, + is the nose; y = up; the car's left side is +x)
//   wheels: z of the rear and front axle, r = wheel radius, xi = wheels are outside this |x|
//   door:   the front doors as a box  z0..z1, y0..y1, outside |x| > x
//   glass:  where the windows are (boxes [z0, z1, y0, y1]) and how dark window pixels are (0..1)
const CARS = {
  // codeWheels: this scan has its tires grown into the body, so the game mounts clean wheels made in code
  police: { src: 'car1', label: 'POLICE CRUISER', L: 4.95, trim: 1.1, hi: 24000, lo: 3000, codeWheels: true,
    wheels: { zr: -1.42, zf: 1.33, r: 0.40, xi: 0.62 }, door: { z0: -0.72, z1: 0.58, y0: 0.33, y1: 1.45, x: 0.5 },
    glass: { boxes: [[-1.7, 1.05, 1.03, 1.47]], lum: [0, 0.2] }, type: { topSpeed: 190, accel: 9.5, grip: 1.08, roll: 0.9, mass: 1.1 } },
  luxury: { src: 'car3', label: 'LUXURY COUPE', L: 5.0, hi: 24000, lo: 3000,
    wheels: { zr: -1.55, zf: 1.48, r: 0.41, xi: 0.6 }, door: { z0: -0.3, z1: 0.75, y0: 0.3, y1: 1.33, x: 0.5 },
    glass: { boxes: [[-1.65, 1.15, 0.99, 1.36]], lum: [0, 0.33] }, type: { topSpeed: 175, accel: 8.2, grip: 1.0, roll: 1.0, mass: 1.15 } },
  hyper: { src: 'car4', label: 'HYPERCAR', L: 4.7, hi: 24000, lo: 3000,
    wheels: { zr: -1.38, zf: 1.25, r: 0.385, xi: 0.62 }, door: { z0: -0.6, z1: 0.62, y0: 0.25, y1: 1.2, x: 0.5 },
    glass: { boxes: [[-1.05, 0.95, 0.9, 1.26]], lum: [0, 0.3] }, type: { topSpeed: 215, accel: 12.5, grip: 1.25, roll: 0.6, mass: 0.85 } },
  hatch: { src: 'car6', label: 'CITY HATCHBACK', L: 4.05, hi: 22000, lo: 2800,
    wheels: { zr: -1.37, zf: 1.22, r: 0.335, xi: 0.58 }, door: { z0: -0.63, z1: 0.72, y0: 0.33, y1: 1.62, x: 0.5 },
    glass: { boxes: [[-1.95, 1.05, 1.16, 1.63]], lum: [0, 0.47] }, type: { topSpeed: 150, accel: 6.8, grip: 0.95, roll: 1.2, mass: 0.95 } },
  armored: { src: 'car2', label: 'ARMORED TRUCK', L: 5.4, hi: 26000, lo: 3400,
    wheels: { zr: -1.67, zf: 1.45, r: 0.48, xi: 0.72 }, door: { z0: 0.27, z1: 0.94, y0: 0.78, y1: 2.12, x: 0.6 },
    glass: { boxes: [[0.3, 1.75, 1.74, 2.14]], lum: [0.1, 0.55] }, type: { topSpeed: 120, accel: 4.2, grip: 0.8, roll: 1.7, mass: 2.4 } },
  boat: { src: 'car5', label: 'BOAT', L: 9.0, lo: 3600, boat: true },
};

const io = new NodeIO().registerExtensions([EXTTextureWebP]);
await MeshoptSimplifier.ready;
const srgbToLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

async function loadPixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
// grow the photos outward into the empty part of the picture, so no background shows at their edges
function dilate(img, passes) {
  const { data, w, h } = img;
  for (let pass = 0; pass < passes; pass++) {
    const src = Buffer.from(data);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 0) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        if (src[j + 3] > 0) { r += src[j]; g += src[j + 1]; b += src[j + 2]; n++; }
      }
      if (n) { data[i] = r / n; data[i + 1] = g / n; data[i + 2] = b / n; data[i + 3] = 255; }
    }
  }
}

async function build(name) {
  const C = CARS[name];
  const t0 = Date.now();
  // ---------------------------------------------------------------- read
  const doc = await io.read(`${S}/car_dl/${C.src}.glb`);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const rawPos = prim.getAttribute('POSITION').getArray();
  const rawIdx = prim.getIndices().getArray();
  const lay = JSON.parse(fs.readFileSync(`${S}/car_bake/${name}_layout.json`));
  const base = await loadPixels(`${S}/car_bake/${name}_base.png`);
  const mr = await loadPixels(`${S}/car_bake/${name}_mr.png`);
  const depth = await loadPixels(`${S}/car_bake/${name}_depth.png`);
  const SIZE = lay.size, min = lay.min, dims = lay.dims;

  // ---------------------------------------------------------------- weld (same place = same vertex)
  const nV = rawPos.length / 3;
  const map = new Map(), remap = new Uint32Array(nV), pos = [];
  for (let i = 0; i < nV; i++) {
    const key = `${Math.round(rawPos[i * 3] * 20000)},${Math.round(rawPos[i * 3 + 1] * 20000)},${Math.round(rawPos[i * 3 + 2] * 20000)}`;
    let id = map.get(key);
    if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(rawPos[i * 3], rawPos[i * 3 + 1], rawPos[i * 3 + 2]); }
    remap[i] = id;
  }
  map.clear();
  let idx = [];
  for (let t = 0; t < rawIdx.length; t += 3) {
    const a = remap[rawIdx[t]], b = remap[rawIdx[t + 1]], c = remap[rawIdx[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  const P = new Float32Array(pos);
  // ---------------------------------------------------------------- real size: meters, on the ground, centered
  const s = C.L / dims[2];
  const xs = []; for (let i = 0; i < P.length; i += 3 * 7) xs.push(P[i]);
  xs.sort((a, b) => a - b);
  const cxRaw = (xs[Math.floor(xs.length * 0.004)] + xs[Math.floor(xs.length * 0.996)]) / 2; // ignores a few stray parts on one side
  const czRaw = min[2] + dims[2] / 2;
  const toCar = (x, y, z) => [(x - cxRaw) * s, (y - min[1]) * s, (z - czRaw) * s];
  const toRawN = (p) => [(p[0] / s + cxRaw - min[0]) / dims[0], (p[1] / s) / dims[1], (p[2] / s + czRaw - min[2]) / dims[2]];
  // throw away loose parts sticking out sideways (one scan has a half-open door)
  if (C.trim) {
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      let ok = true;
      for (let k = 0; k < 3; k++) if (Math.abs((P[idx[t + k] * 3] - cxRaw) * s) > C.trim) ok = false;
      if (ok) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    idx = keep;
  }
  let I = new Uint32Array(idx);
  console.log(name, 'welded', P.length / 3, 'verts', I.length / 3, 'tris', ((Date.now() - t0) / 1000).toFixed(1) + 's');

  // ---------------------------------------------------------------- fewer triangles
  const simplify = (indices, target) => MeshoptSimplifier.simplify(indices, P, 3, target * 3, 0.02, [])[0];
  const hiI = C.hi ? simplify(I, C.hi) : null;
  const loI = simplify(hiI || I, C.lo);

  // smooth normals for an indexed mesh (in car space)
  function normalsFor(indices) {
    const N = new Float32Array(P.length);
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    return N;
  }

  // ---------------------------------------------------------------- the photos
  dilate(base, 14); dilate(mr, 14);
  const tiles = lay.tiles;
  const DARK = [SIZE - 6, SIZE - 6];
  for (let y = SIZE - 12; y < SIZE; y++) for (let x = SIZE - 12; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    base.data[i] = 14; base.data[i + 1] = 14; base.data[i + 2] = 16; base.data[i + 3] = 255;
    mr.data[i] = 255; mr.data[i + 1] = 220; mr.data[i + 2] = 0; mr.data[i + 3] = 255;
  }
  // where a point (n = 0..1 inside the box of the model) lands in the photo of one side
  const pix = (t, n) => [t.rect[0] + n[t.u] * t.rect[2], t.rect[1] + (1 - n[t.v]) * t.rect[3]];
  const sample = (img, px, py) => { const x = Math.min(img.w - 1, Math.max(0, Math.round(px))), y = Math.min(img.h - 1, Math.max(0, Math.round(py))), i = (y * img.w + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]; };
  // can this side's photo see the point? (compare with the depth photo)
  function visible(t, n) {
    const [px, py] = pix(t, n);
    const d = sample(depth, px, py);
    if (d[3] === 0) return false;
    const seen = (d[0] * 256 + d[1]) / 65535 - 0.5, mine = (n[t.d] - 0.5) * t.s;
    return mine > seen - 0.035;
  }
  // best photo for a surface that looks along "normal" at point n
  function pickTile(normal, n) {
    const order = tiles.map((t) => ({ t, w: normal[t.d] * t.s })).sort((a, b) => b.w - a.w);
    for (const o of order) { if (o.w < 0.15) break; if (visible(o.t, n)) return o.t; }
    return null;
  }

  // ---------------------------------------------------------------- triangle soup with texture coordinates
  function soupFrom(indices) {
    const N = normalsFor(indices);
    const tris = [];
    for (let t = 0; t < indices.length; t += 3) {
      const v = [0, 1, 2].map((k) => { const i = indices[t + k] * 3; return { raw: [P[i], P[i + 1], P[i + 2]], n: [N[i], N[i + 1], N[i + 2]] }; });
      const p = v.map((q) => toCar(...q.raw));
      const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      let fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const fl = Math.hypot(...fn); if (fl < 1e-10) continue; fn = fn.map((q) => q / fl);
      const nn = v.map((q) => [(q.raw[0] - min[0]) / dims[0], (q.raw[1] - min[1]) / dims[1], (q.raw[2] - min[2]) / dims[2]]);
      const cn = [0, 1, 2].map((k) => (nn[0][k] + nn[1][k] + nn[2][k]) / 3);
      const tile = pickTile(fn, cn);
      const uv = tile ? nn.map((q) => { const [px, py] = pix(tile, q); return [px / SIZE, py / SIZE]; }) : [0, 1, 2].map(() => [DARK[0] / SIZE, DARK[1] / SIZE]);
      const cu = (uv[0][0] + uv[1][0] + uv[2][0]) / 3 * SIZE, cv = (uv[0][1] + uv[1][1] + uv[2][1]) / 3 * SIZE;
      const col = sample(base, cu, cv), m = sample(mr, cu, cv);
      tris.push({ v: [0, 1, 2].map((k) => ({ p: p[k], n: v[k].n, uv: uv[k] })), tile: tile ? tile.name : 'dark', col, mr: m, c: [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3], fn });
    }
    return tris;
  }
  const isGlass = (t) => {
    if (!C.glass || t.tile === 'dark' || t.tile === 'ny') return false;
    const lum = (0.299 * t.col[0] + 0.587 * t.col[1] + 0.114 * t.col[2]) / 255;
    if (lum < C.glass.lum[0] || lum > C.glass.lum[1]) return false;
    return C.glass.boxes.some(([z0, z1, y0, y1]) => t.c[2] > z0 && t.c[2] < z1 && t.c[1] > y0 && t.c[1] < y1);
  };

  // cut a triangle with a flat plane (axis = 0 x, 1 y, 2 z). Returns the pieces on both sides.
  const lerpV = (a, b, k) => ({ p: a.p.map((q, i) => q + (b.p[i] - q) * k), n: a.n.map((q, i) => q + (b.n[i] - q) * k), uv: a.uv.map((q, i) => q + (b.uv[i] - q) * k) });
  function split(tri, axis, value) {
    const d = tri.v.map((q) => q.p[axis] - value);
    if (d.every((q) => q >= 0)) return { hi: [tri], lo: [] };
    if (d.every((q) => q <= 0)) return { hi: [], lo: [tri] };
    const hi = [], lo = [];
    for (let i = 0; i < 3; i++) {
      const a = tri.v[i], b = tri.v[(i + 1) % 3], da = d[i], db = d[(i + 1) % 3];
      if (da >= 0) hi.push(a); if (da <= 0) lo.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const m = lerpV(a, b, da / (da - db)); hi.push(m); lo.push(m); }
    }
    const fan = (poly) => { const out = []; for (let i = 1; i < poly.length - 1; i++) out.push({ ...tri, v: [poly[0], poly[i], poly[i + 1]] }); return out; };
    return { hi: fan(hi), lo: fan(lo) };
  }

  // turn a list of triangles into arrays for a mesh (same corner = same vertex), positions relative to "origin"
  function meshArrays(tris, origin = [0, 0, 0]) {
    const key = new Map(), pos = [], nor = [], uv = [], index = [];
    for (const t of tris) for (const q of t.v) {
      const k = q.p.map((x) => Math.round(x * 5000)).join(',') + '|' + q.uv.map((x) => Math.round(x * 8192)).join(',');
      let id = key.get(k);
      if (id === undefined) {
        id = pos.length / 3; key.set(k, id);
        pos.push(q.p[0] - origin[0], q.p[1] - origin[1], q.p[2] - origin[2]);
        const l = Math.hypot(...q.n) || 1; nor.push(q.n[0] / l, q.n[1] / l, q.n[2] / l); uv.push(q.uv[0], q.uv[1]);
      }
      index.push(id);
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), index: new Uint32Array(index) };
  }

  const info = { label: C.label, length: +C.L.toFixed(2), type: C.type || null };
  // ================================================================= THE CAR YOU DRIVE
  if (C.hi) {
    const soup = soupFrom(hiI);
    let hw = 0; for (const t of soup) if (t.c[1] > 0.4 && t.c[1] < 0.9 && Math.abs(t.c[2]) < 0.6) hw = Math.max(hw, Math.abs(t.c[0]));
    const W = C.wheels, D = C.door;
    // ---- wheels: everything inside a cylinder around each axle ----
    const wheelDefs = [['wheel_fl', W.zf, 1], ['wheel_fr', W.zf, -1], ['wheel_rl', W.zr, 1], ['wheel_rr', W.zr, -1]];
    const parts = { body: [], glass: [], door_l: [], door_l_glass: [], door_r: [], door_r_glass: [] };
    for (const [n] of wheelDefs) parts[n] = [];
    const rest = [];
    for (const t of soup) {
      let w = null;
      for (const [n, z, sx] of wheelDefs) {
        const inside = (q) => q.p[0] * sx > W.xi && Math.hypot(q.p[1] - W.r, q.p[2] - z) < W.r * 1.05;
        // (with wheels made in code: also take away triangles that only partly belong to the old wheel)
        if (C.codeWheels ? t.v.some(inside) || (t.c[0] * sx > W.xi && Math.hypot(t.c[1] - W.r, t.c[2] - z) < W.r * 1.08) : t.v.every(inside)) { w = n; break; }
      }
      if (w) parts[w].push(t); else rest.push(t);
    }
    // ---- doors: cut the body with the six sides of the door box ----
    for (const t of rest) {
      let pieces = [t];
      for (const [side, sx] of [['door_l', 1], ['door_r', -1]]) {
        const next = [];
        for (const q of pieces) {
          if (q.c[0] * sx < 0) { next.push(q); continue; }
          // inside = x beyond D.x, z between z0 and z1, y between y0 and y1
          let ins = [q], out = [];
          const cut = (axis, value, keepHi) => { const a = []; for (const tri of ins) { const r = split(tri, axis, value); a.push(...(keepHi ? r.hi : r.lo)); out.push(...(keepHi ? r.lo : r.hi)); } ins = a; };
          cut(0, D.x * sx, sx > 0); cut(2, D.z0, true); cut(2, D.z1, false); cut(1, D.y0, true); cut(1, D.y1, false);
          for (const tri of ins) (isGlass(tri) ? parts[side + '_glass'] : parts[side]).push(tri);
          next.push(...out);
        }
        pieces = next;
      }
      for (const tri of pieces) (isGlass(tri) ? parts.glass : parts.body).push(tri);
    }
    // ---- write the model file ----
    const out = new Document();
    const buf = out.createBuffer();
    const baseWebp = await sharp(base.data, { raw: { width: SIZE, height: SIZE, channels: 4 } }).removeAlpha().webp({ quality: 84 }).toBuffer();
    const mrWebp = await sharp(mr.data, { raw: { width: SIZE, height: SIZE, channels: 4 } }).removeAlpha().resize(1024, 1024).webp({ quality: 80 }).toBuffer();
    const texB = out.createTexture('base').setImage(baseWebp).setMimeType('image/webp');
    const texM = out.createTexture('mr').setImage(mrWebp).setMimeType('image/webp');
    const paint = out.createMaterial('paint').setBaseColorTexture(texB).setMetallicRoughnessTexture(texM).setMetallicFactor(1).setRoughnessFactor(1);
    const glass = out.createMaterial('glass').setBaseColorTexture(texB).setBaseColorFactor([1, 1, 1, 0.4]).setAlphaMode('BLEND').setMetallicFactor(0.2).setRoughnessFactor(0.08);
    const scene = out.createScene('car');
    const node = (nm, tris, origin, mat, parent) => {
      const n = out.createNode(nm).setTranslation(parent ? [0, 0, 0] : origin);
      if (tris.length) {
        const a = meshArrays(tris, origin);
        const pr = out.createPrimitive().setIndices(out.createAccessor().setType('SCALAR').setArray(a.index).setBuffer(buf))
          .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(a.pos).setBuffer(buf))
          .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(a.nor).setBuffer(buf))
          .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(a.uv).setBuffer(buf)).setMaterial(mat);
        n.setMesh(out.createMesh(nm).addPrimitive(pr));
      }
      if (parent) parent.addChild(n); else scene.addChild(n);
      return n;
    };
    node('body', parts.body, [0, 0, 0], paint);
    node('glass', parts.glass, [0, 0, 0], glass);
    const wheelInfo = {};
    for (const [n, z, sx] of wheelDefs) {
      // the middle of the wheel = the middle of its own box (more exact than the numbers typed above)
      let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, x0 = 1e9, x1 = -1e9;
      for (const t of parts[n]) for (const q of t.v) { y0 = Math.min(y0, q.p[1]); y1 = Math.max(y1, q.p[1]); z0 = Math.min(z0, q.p[2]); z1 = Math.max(z1, q.p[2]); x0 = Math.min(x0, q.p[0]); x1 = Math.max(x1, q.p[0]); }
      // ... measured on the outside face of the tire only (inner bits of the wheel well would shift it)
      const outer = sx > 0 ? x1 : x0;
      let ry0 = 1e9, ry1 = -1e9, rz0 = 1e9, rz1 = -1e9;
      for (const t of parts[n]) for (const q of t.v) if (Math.abs(q.p[0] - outer) < 0.09) { ry0 = Math.min(ry0, q.p[1]); ry1 = Math.max(ry1, q.p[1]); rz0 = Math.min(rz0, q.p[2]); rz1 = Math.max(rz1, q.p[2]); }
      const o = parts[n].length ? [(x0 + x1) / 2, (ry0 + ry1) / 2, (rz0 + rz1) / 2] : [sx * 0.8, W.r, z];
      if (C.codeWheels) { o[1] = W.r; o[2] = z; o[0] = sx * (Math.max(Math.abs(x0), Math.abs(x1)) - 0.13); }
      else node(n, parts[n], o, paint);
      wheelInfo[n] = o.map((q) => +q.toFixed(3));
    }
    for (const [side, sx] of [['door_l', 1], ['door_r', -1]]) {
      // the hinge: the front edge of the door, at the outside of the body
      let hx = 0; for (const t of parts[side]) for (const q of t.v) if (q.p[2] > D.z1 - 0.12 && q.p[1] < (D.y0 + D.y1) / 2) hx = Math.max(hx, q.p[0] * sx);
      const o = [sx * (hx || hw), 0, D.z1];
      const dn = node(side, parts[side], o, paint);
      node(side + '_glass', parts[side + '_glass'], o, glass, dn);
    }
    fs.writeFileSync(`${OUT}/${name}.glb`, await io.writeBinary(out));
    const count = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length]));
    Object.assign(info, {
      halfWidth: +hw.toFixed(3), roof: +(dims[1] * s).toFixed(2), wheelR: +((wheelInfo.wheel_fl[1] + wheelInfo.wheel_rl[1]) / 2).toFixed(3),
      wheelX: +Math.abs(wheelInfo.wheel_fl[0]).toFixed(3), wheelZ: [wheelInfo.wheel_rl[2], wheelInfo.wheel_fl[2]], wheels: wheelInfo,
      door: { z0: D.z0, z1: D.z1, y0: D.y0, y1: D.y1 }, seat: { x: +(hw * 0.42).toFixed(2), y: +(D.y0 + 0.02).toFixed(2), z: +((D.z0 + D.z1) / 2 - 0.12).toFixed(2) },
      backZ: -C.L / 2, frontZ: C.L / 2, codeWheels: !!C.codeWheels,
    });
    console.log(name, 'hi parts', JSON.stringify(count), 'file', (fs.statSync(`${OUT}/${name}.glb`).size / 1024).toFixed(0) + ' KB');
  }
  // ================================================================= THE LIGHT VERSION (colors in the vertices)
  {
    const soup = soupFrom(loI);
    // one vertex per place; its color is the average of the triangles around it
    const key = new Map(), pos = [], nor = [], acc = [], index = [];
    for (const t of soup) {
      const g = isGlass(t);
      // color (the game works with "linear" color), roughness and metal from the photos
      const c = g ? [0.012, 0.014, 0.018] : t.col.slice(0, 3).map((q) => srgbToLin(q / 255));
      const rough = g ? 0.06 : Math.max(0.12, t.mr[1] / 255), metal = g ? 0.9 : t.mr[2] / 255;
      for (const q of t.v) {
        const k = q.p.map((x) => Math.round(x * 2000)).join(',');
        let id = key.get(k);
        if (id === undefined) { id = pos.length / 3; key.set(k, id); pos.push(...q.p); nor.push(...q.n); acc.push([0, 0, 0, 0, 0, 0]); }
        const a = acc[id]; a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; a[3] += rough; a[4] += metal; a[5]++;
        index.push(id);
      }
    }
    const col = [], dat = [];
    for (const a of acc) { col.push(a[0] / a[5], a[1] / a[5], a[2] / a[5]); dat.push(a[3] / a[5], a[4] / a[5], 0, 0); }
    const out = new Document(), buf = out.createBuffer();
    const pr = out.createPrimitive().setIndices(out.createAccessor().setType('SCALAR').setArray(pos.length / 3 < 65536 ? new Uint16Array(index) : new Uint32Array(index)).setBuffer(buf))
      .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
      .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buf))
      .setAttribute('COLOR_0', out.createAccessor().setType('VEC3').setArray(new Float32Array(col)).setBuffer(buf))
      .setAttribute('_DATA', out.createAccessor().setType('VEC4').setArray(new Float32Array(dat)).setBuffer(buf));
    out.createScene('car').addChild(out.createNode('car').setMesh(out.createMesh('car').addPrimitive(pr)));
    fs.writeFileSync(`${OUT}/${name}_lo.glb`, await io.writeBinary(out));
    info.loTriangles = index.length / 3;
    console.log(name, 'lo', index.length / 3, 'tris', (fs.statSync(`${OUT}/${name}_lo.glb`).size / 1024).toFixed(0) + ' KB', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  return info;
}

const all = fs.existsSync(`${OUT}/cars.json`) ? JSON.parse(fs.readFileSync(`${OUT}/cars.json`)) : {};
for (const name of Object.keys(CARS)) {
  if (only.length && !only.includes(name)) continue;
  all[name] = await build(name);
}
fs.writeFileSync(`${OUT}/cars.json`, JSON.stringify(all, null, 1));
