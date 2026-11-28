// ---------------------------------------------------------------------------
// geometry.js - helpers to build big 3D meshes with very few draw calls.
//
// MeshBuilder  : glue thousands of quads / boxes into ONE mesh.
// InstancedSet : draw the same small model many times (street lights, cars..)
//                and only draw the copies that are near the player.
// DetailSet    : the same idea for building details (windows, ledges,
//                balconies ...). There are tens of thousands of them, so they
//                are stored in a compact way and sorted into a grid.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class MeshBuilder {
  constructor() {
    this.cap = 2048;       // room for this many vertices (grows by itself)
    this.icap = 4096;
    this.count = 0;        // vertices used
    this.icount = 0;       // indices used
    this.pos = new Float32Array(this.cap * 3);
    this.nor = new Float32Array(this.cap * 3);
    this.uv = new Float32Array(this.cap * 2);
    this.col = new Float32Array(this.cap * 4);
    this.dat = new Float32Array(this.cap * 4);
    this.idx = new Uint32Array(this.icap);
    // "current" color and extra data, used by every vertex added next
    this.c = [1, 1, 1, 1];
    this.d = [0, 0, 0, 0];
    this.usesAlpha = false;
  }

  // Set the color used for the next vertices (alpha is optional).
  color(r, g, b, a = 1) {
    this.c[0] = r; this.c[1] = g; this.c[2] = b; this.c[3] = a;
    if (a < 1) this.usesAlpha = true;
    return this;
  }

  // Set the 4 extra numbers stored on the next vertices (meaning depends on the material).
  data(a = 0, b = 0, c = 0, d = 0) {
    this.d[0] = a; this.d[1] = b; this.d[2] = c; this.d[3] = d;
    return this;
  }

  _grow(needV, needI) {
    if (this.count + needV > this.cap) {
      while (this.count + needV > this.cap) this.cap *= 2;
      const g = (old, size) => { const a = new Float32Array(this.cap * size); a.set(old); return a; };
      this.pos = g(this.pos, 3); this.nor = g(this.nor, 3); this.uv = g(this.uv, 2);
      this.col = g(this.col, 4); this.dat = g(this.dat, 4);
    }
    if (this.icount + needI > this.icap) {
      while (this.icount + needI > this.icap) this.icap *= 2;
      const a = new Uint32Array(this.icap); a.set(this.idx); this.idx = a;
    }
  }

  // Add one vertex. Returns its index.
  vertex(x, y, z, nx, ny, nz, u = 0, v = 0) {
    this._grow(1, 0);
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.nor[i * 3] = nx; this.nor[i * 3 + 1] = ny; this.nor[i * 3 + 2] = nz;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    this.col.set(this.c, i * 4);
    this.dat.set(this.d, i * 4);
    return i;
  }

  tri(a, b, c) {
    this._grow(0, 3);
    this.idx[this.icount++] = a; this.idx[this.icount++] = b; this.idx[this.icount++] = c;
  }

  // Two triangles from four vertex indices (listed counter-clockwise).
  quadIdx(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  // A flat quad from 4 points [x,y,z] listed counter-clockwise (seen from the
  // front), with one normal and 4 texture coordinates [u,v].
  quad(p0, p1, p2, p3, n, uv0, uv1, uv2, uv3) {
    const a = this.vertex(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv0[0], uv0[1]);
    const b = this.vertex(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv1[0], uv1[1]);
    const c = this.vertex(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv2[0], uv2[1]);
    const d = this.vertex(p3[0], p3[1], p3[2], n[0], n[1], n[2], uv3[0], uv3[1]);
    this.quadIdx(a, b, c, d);
    return a;
  }

  // A flat quad from 4 points in any order around the shape. The winding is
  // fixed automatically so the front side looks along the normal "n".
  // Texture coordinates are made from the positions (repeat every "tile" meters).
  quadAuto(p0, p1, p2, p3, n, tile = 1) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const pts = flip ? [p0, p3, p2, p1] : [p0, p1, p2, p3];
    const flat = Math.abs(n[1]) > 0.5;
    const uv = (p) => (flat ? [p[0] / tile, p[2] / tile] : [(p[0] + p[2]) / tile, p[1] / tile]);
    return this.quad(pts[0], pts[1], pts[2], pts[3], n, uv(pts[0]), uv(pts[1]), uv(pts[2]), uv(pts[3]));
  }

  // One triangle from 3 points [x,y,z] with one normal. The winding is fixed
  // automatically. Texture coordinates come from the positions (like quadAuto).
  triAuto(p0, p1, p2, n, tile = 1) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const pts = flip ? [p0, p2, p1] : [p0, p1, p2];
    const flat = Math.abs(n[1]) > 0.5;
    const idx = pts.map((p) => this.vertex(p[0], p[1], p[2], n[0], n[1], n[2],
      flat ? p[0] / tile : (p[0] + p[2]) / tile, flat ? p[2] / tile : p[1] / tile));
    this.tri(idx[0], idx[1], idx[2]);
  }

  // A flat rectangle lying on the ground (facing up) at height y.
  // The texture repeats every "tile" meters, so it is never stretched.
  groundRect(minX, minZ, maxX, maxZ, y, tile = 1, uOff = 0, vOff = 0) {
    const u0 = minX / tile + uOff, u1 = maxX / tile + uOff;
    const v0 = minZ / tile + vOff, v1 = maxZ / tile + vOff;
    // Counter-clockwise when seen from above.
    return this.quad(
      [minX, y, minZ], [minX, y, maxZ], [maxX, y, maxZ], [maxX, y, minZ],
      [0, 1, 0],
      [u0, v0], [u0, v1], [u1, v1], [u1, v0]
    );
  }

  // A flat convex polygon on the ground (list of {x, z}), facing up.
  groundPoly(poly, y, tile = 1, uOff = 0, vOff = 0) {
    const first = this.count;
    for (const p of poly) this.vertex(p.x, y, p.z, 0, 1, 0, p.x / tile + uOff, p.z / tile + vOff);
    // Fan of triangles. The polygon is counter-clockwise in (x, z), which is
    // clockwise when seen from above, so we flip the order.
    for (let i = 1; i < poly.length - 1; i++) this.tri(first, first + i + 1, first + i);
  }

  // A box with its sides lined up with the world axes.
  // faces: which sides to make, e.g. 'nsewtb' (north south east west top bottom).
  // The texture repeats every "tile" meters.
  box(minX, minY, minZ, maxX, maxY, maxZ, tile = 1, faces = 'nsewt') {
    const uX0 = minX / tile, uX1 = maxX / tile, uZ0 = minZ / tile, uZ1 = maxZ / tile;
    const v0 = minY / tile, v1 = maxY / tile;
    if (faces.includes('n')) // +Z side
      this.quad([minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ], [0, 0, 1], [uX0, v0], [uX1, v0], [uX1, v1], [uX0, v1]);
    if (faces.includes('s')) // -Z side
      this.quad([maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ], [0, 0, -1], [-uX1, v0], [-uX0, v0], [-uX0, v1], [-uX1, v1]);
    if (faces.includes('w')) // +X side
      this.quad([maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [1, 0, 0], [-uZ1, v0], [-uZ0, v0], [-uZ0, v1], [-uZ1, v1]);
    if (faces.includes('e')) // -X side
      this.quad([minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ], [-1, 0, 0], [uZ0, v0], [uZ1, v0], [uZ1, v1], [uZ0, v1]);
    if (faces.includes('t')) // top
      this.quad([minX, maxY, minZ], [minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [0, 1, 0], [uX0, uZ0], [uX0, uZ1], [uX1, uZ1], [uX1, uZ0]);
    if (faces.includes('b')) // bottom
      this.quad([minX, minY, maxZ], [minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [0, -1, 0], [uX0, uZ1], [uX0, uZ0], [uX1, uZ0], [uX1, uZ1]);
  }

  // Copy a three.js geometry into this mesh.
  // matrix: where to put it (THREE.Matrix4). Uses the current color and data
  // unless the geometry has its own "color" attribute and keepColor is true.
  addGeometry(geom, matrix = null, keepColor = false) {
    const p = geom.attributes.position;
    const nA = geom.attributes.normal;
    const uvA = geom.attributes.uv;
    const cA = keepColor ? geom.attributes.color : null;
    const dA = keepColor ? geom.attributes.aData : null;
    const index = geom.index;
    const first = this.count;
    this._grow(p.count, index ? index.count : p.count);
    if (matrix) _nm.getNormalMatrix(matrix);
    const save = this.c.slice(), saveD = this.d.slice();
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      if (matrix) _v.applyMatrix4(matrix);
      if (nA) {
        _n.fromBufferAttribute(nA, i);
        if (matrix) _n.applyMatrix3(_nm).normalize();
      } else _n.set(0, 1, 0);
      if (cA) {
        this.c[0] = cA.getX(i); this.c[1] = cA.getY(i); this.c[2] = cA.getZ(i);
        this.c[3] = cA.itemSize > 3 ? cA.getW(i) : 1;
      }
      if (dA) { this.d[0] = dA.getX(i); this.d[1] = dA.getY(i); this.d[2] = dA.getZ(i); this.d[3] = dA.getW(i); }
      this.vertex(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, uvA ? uvA.getX(i) : 0, uvA ? uvA.getY(i) : 0);
    }
    this.c = save; this.d = saveD;
    if (index) {
      for (let i = 0; i < index.count; i++) this.idx[this.icount++] = first + index.getX(i);
    } else {
      for (let i = 0; i < p.count; i++) this.idx[this.icount++] = first + i;
    }
    return this;
  }

  // Shortcut: add a three.js geometry moved / turned / scaled.
  // rot = [rx, ry, rz] in radians, scale = number or [sx, sy, sz].
  add(geom, x = 0, y = 0, z = 0, rot = null, scale = null) {
    const q = new THREE.Quaternion();
    if (rot) q.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
    const s = scale === null ? [1, 1, 1] : typeof scale === 'number' ? [scale, scale, scale] : scale;
    _m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s[0], s[1], s[2]));
    return this.addGeometry(geom, _m);
  }

  // Finish: make the real three.js geometry.
  build(withData = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.count * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, this.count * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.count * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, this.count * 4), 4));
    if (withData) g.setAttribute('aData', new THREE.BufferAttribute(this.dat.slice(0, this.count * 4), 4));
    // Small meshes can use the smaller 16-bit index type.
    const idx = this.idx.slice(0, this.icount);
    g.setIndex(new THREE.BufferAttribute(this.count > 65535 ? idx : new Uint16Array(idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------------------
// InstancedSet - many copies of one model, drawn with ONE draw call.
// Only the copies closer than "maxDistance" to the player are drawn.
// ---------------------------------------------------------------------------
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _eul = new THREE.Euler();

export class InstancedSet {
  // opts: { maxDistance, castShadow, receiveShadow, useColor }
  constructor(name, geometry, material, opts = {}) {
    this.name = name;
    this.geometry = geometry;
    this.material = material;
    this.maxDistance = opts.maxDistance || Infinity;
    this.castShadow = opts.castShadow !== false;
    this.receiveShadow = opts.receiveShadow !== false;
    this.useColor = !!opts.useColor;
    this.renderOrder = opts.renderOrder || 0;
    this.matrices = [];  // 16 numbers per copy
    this.colors = [];    // 3 numbers per copy
    this.total = 0;
    this.mesh = null;
  }

  // Add one copy. rotY = turn around the up axis (radians).
  add(x, y, z, rotY = 0, scale = 1, color = null, rotX = 0, rotZ = 0) {
    _pos.set(x, y, z);
    _eul.set(rotX, rotY, rotZ, 'YXZ');
    _quat.setFromEuler(_eul);
    if (typeof scale === 'number') _scl.set(scale, scale, scale);
    else _scl.set(scale[0], scale[1], scale[2]);
    _mat.compose(_pos, _quat, _scl);
    for (let i = 0; i < 16; i++) this.matrices.push(_mat.elements[i]);
    if (this.useColor) {
      const c = color || [1, 1, 1];
      this.colors.push(c[0], c[1], c[2]);
    }
    return this.total++;
  }

  // Create the mesh and add it to the scene.
  finish(parent) {
    if (this.total === 0) return null;
    this.all = new Float32Array(this.matrices);
    this.allColors = this.useColor ? new Float32Array(this.colors) : null;
    this.matrices = null; this.colors = null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.total);
    mesh.name = this.name;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    mesh.frustumCulled = false; // copies are spread all around the player
    mesh.renderOrder = this.renderOrder;
    mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.useColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.total * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh = mesh;
    this.cull(0, 0, 1, true);
    parent.add(mesh);
    return mesh;
  }

  // Take one copy away, or put it back (the next cull shows the change).
  hide(i, on = true) {
    if (!this.hidden) this.hidden = new Uint8Array(this.total);
    this.hidden[i] = on ? 1 : 0;
  }

  // Keep only the copies near (cx, cz). distMul comes from the quality preset.
  cull(cx, cz, distMul = 1, force = false) {
    const mesh = this.mesh;
    if (!mesh) return;
    const out = mesh.instanceMatrix.array;
    const all = this.all;
    let n = 0;
    if (this.maxDistance === Infinity) {
      if (!force) return;
      out.set(all);
      if (this.useColor) mesh.instanceColor.array.set(this.allColors);
      n = this.total;
    } else {
      const max2 = (this.maxDistance * distMul) ** 2;
      const colOut = this.useColor ? mesh.instanceColor.array : null;
      const hid = this.hidden;
      for (let i = 0; i < this.total; i++) {
        if (hid && hid[i]) continue;                 // (a copy that was taken away: knocked over by a car)
        const o = i * 16;
        const dx = all[o + 12] - cx;
        const dz = all[o + 14] - cz;
        if (dx * dx + dz * dz > max2) continue;
        const t = n * 16;
        for (let k = 0; k < 16; k++) out[t + k] = all[o + k];
        if (colOut) {
          colOut[n * 3] = this.allColors[i * 3];
          colOut[n * 3 + 1] = this.allColors[i * 3 + 1];
          colOut[n * 3 + 2] = this.allColors[i * 3 + 2];
        }
        n++;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, Math.max(n, 1) * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (this.useColor) {
      mesh.instanceColor.clearUpdateRanges();
      mesh.instanceColor.addUpdateRange(0, Math.max(n, 1) * 3);
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------------------
// DetailSet - building details near the player (3D windows, ledges, balconies).
//
// Differences to InstancedSet:
//   * every copy stands upright and is only turned around the up axis, so we
//     store just position + the direction it faces (much less memory)
//   * the copies are sorted into a grid of 64 m cells, so picking the ones
//     near the player is fast even with 50 000 copies
//   * "facing": copies on walls that look away from the player are skipped
//   * up to two extra numbers-of-four per copy (aInst, aInstB) for the shader
//   * "companions": other meshes drawn with exactly the same copies
// ---------------------------------------------------------------------------
const DETAIL_CELL = 64;
const REC = 16; // numbers stored per copy

export class DetailSet {
  // opts: { maxDistance, facing, attrA, attrB, color, castShadow, receiveShadow, renderOrder, group }
  //   group: 'window' sets are switched off on LOW quality
  constructor(name, geometry, material, opts = {}) {
    this.name = name;
    this.baseGeometry = geometry;
    this.material = material;
    this.maxDistance = opts.maxDistance || 120;
    this.facing = !!opts.facing;
    this.attrA = !!opts.attrA;
    this.attrB = !!opts.attrB;
    this.color = !!opts.color;          // per-copy color (uses the first 3 numbers of "b")
    this.castShadow = !!opts.castShadow;
    this.receiveShadow = opts.receiveShadow !== false;
    this.renderOrder = opts.renderOrder || 0;
    this.group = opts.group || 'detail';
    this.enabled = true;
    this.cap = 256;
    this.rec = new Float32Array(this.cap * REC);
    this.total = 0;
    this.mesh = null;
    this.companions = [];
    this.cells = [];
  }

  // Add one copy.
  //   (x, y, z): position,  (nx, nz): the direction its front (+z) looks at
  //   sx, sy, sz: stretch,  a / b: optional arrays of 4 numbers for the shader
  add(x, y, z, nx, nz, sx = 1, sy = 1, sz = 1, a = null, b = null) {
    if (this.total === this.cap) {
      this.cap *= 2;
      const bigger = new Float32Array(this.cap * REC);
      bigger.set(this.rec);
      this.rec = bigger;
    }
    const o = this.total * REC, r = this.rec;
    r[o] = x; r[o + 1] = y; r[o + 2] = z; r[o + 3] = nx; r[o + 4] = nz;
    r[o + 5] = sx; r[o + 6] = sy; r[o + 7] = sz;
    if (a) { r[o + 8] = a[0]; r[o + 9] = a[1]; r[o + 10] = a[2]; r[o + 11] = a[3]; }
    if (b) { r[o + 12] = b[0]; r[o + 13] = b[1]; r[o + 14] = b[2]; r[o + 15] = b.length > 3 ? b[3] : 0; }
    return this.total++;
  }

  // A second mesh that always shows exactly the same copies (it shares the
  // per-copy data). Used for the invisible "window hole" mask.
  addCompanion(name, geometry, material, opts = {}) {
    this.companions.push({ name, geometry, material, opts, mesh: null });
  }

  finish(parent) {
    const total = this.total;
    if (total === 0) return null;
    // ---- sort the copies into grid cells ----
    const src = this.rec;
    const keys = new Array(total);
    for (let i = 0; i < total; i++) {
      keys[i] = [Math.floor(src[i * REC] / DETAIL_CELL) * 4096 + Math.floor(src[i * REC + 2] / DETAIL_CELL), i];
    }
    keys.sort((p, q) => p[0] - q[0]);
    const rec = new Float32Array(total * REC);
    this.cells = [];
    let cell = null;
    for (let k = 0; k < total; k++) {
      const [key, i] = keys[k];
      rec.set(src.subarray(i * REC, i * REC + REC), k * REC);
      if (!cell || cell.key !== key) {
        cell = { key, start: k, end: k, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
        this.cells.push(cell);
      }
      cell.end = k + 1;
      const x = rec[k * REC], z = rec[k * REC + 2];
      if (x < cell.minX) cell.minX = x;
      if (x > cell.maxX) cell.maxX = x;
      if (z < cell.minZ) cell.minZ = z;
      if (z > cell.maxZ) cell.maxZ = z;
    }
    this.rec = rec;

    // ---- the mesh ----
    const withAttrs = (base) => {
      const g = new THREE.BufferGeometry();
      g.index = base.index;
      for (const n of Object.keys(base.attributes)) g.setAttribute(n, base.attributes[n]);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      return g;
    };
    const geo = withAttrs(this.baseGeometry);
    const dyn = (arr, size) => { const a = new THREE.InstancedBufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aA = this.attrA ? dyn(new Float32Array(total * 4), 4) : null;
    this.aB = this.attrB ? dyn(new Float32Array(total * 4), 4) : null;
    if (this.aA) geo.setAttribute('aInst', this.aA);
    if (this.aB) geo.setAttribute('aInstB', this.aB);
    const mesh = new THREE.InstancedMesh(geo, this.material, total);
    mesh.name = this.name;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = this.renderOrder;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.color) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh = mesh;
    parent.add(mesh);
    for (const c of this.companions) {
      const g = withAttrs(c.geometry);
      if (this.aA) g.setAttribute('aInst', this.aA);
      if (this.aB) g.setAttribute('aInstB', this.aB);
      const m = new THREE.InstancedMesh(g, c.material, total);
      m.instanceMatrix = mesh.instanceMatrix; // shared: one upload for both meshes
      m.name = c.name;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      m.matrixAutoUpdate = false;
      m.renderOrder = c.opts.renderOrder || 0;
      c.mesh = m;
      parent.add(m);
    }
    this.cull(0, 0, 1, true);
    return mesh;
  }

  setEnabled(on) {
    this.enabled = on;
  }

  // Keep only the copies near (cx, cz) that can be seen from there.
  cull(cx, cz, distMul = 1) {
    const mesh = this.mesh;
    if (!mesh) return;
    let n = 0;
    if (this.enabled) {
      const rec = this.rec;
      const maxD = this.maxDistance * distMul, max2 = maxD * maxD;
      const out = mesh.instanceMatrix.array;
      const A = this.aA ? this.aA.array : null, B = this.aB ? this.aB.array : null;
      const col = this.color ? mesh.instanceColor.array : null;
      const facing = this.facing;
      for (const c of this.cells) {
        // distance from the player to the nearest point of this cell
        const ex = cx < c.minX ? c.minX - cx : cx > c.maxX ? cx - c.maxX : 0;
        const ez = cz < c.minZ ? c.minZ - cz : cz > c.maxZ ? cz - c.maxZ : 0;
        if (ex * ex + ez * ez > max2) continue;
        for (let i = c.start; i < c.end; i++) {
          const o = i * REC;
          const dx = rec[o] - cx, dz = rec[o + 2] - cz;
          if (dx * dx + dz * dz > max2) continue;
          const nx = rec[o + 3], nz = rec[o + 4];
          // the wall looks away from the player (with some room to spare)
          if (facing && dx * nx + dz * nz > 10) continue;
          const sx = rec[o + 5], sy = rec[o + 6], sz = rec[o + 7];
          const t = n * 16;
          out[t] = nz * sx; out[t + 1] = 0; out[t + 2] = -nx * sx; out[t + 3] = 0;
          out[t + 4] = 0; out[t + 5] = sy; out[t + 6] = 0; out[t + 7] = 0;
          out[t + 8] = nx * sz; out[t + 9] = 0; out[t + 10] = nz * sz; out[t + 11] = 0;
          out[t + 12] = rec[o]; out[t + 13] = rec[o + 1]; out[t + 14] = rec[o + 2]; out[t + 15] = 1;
          if (A) { const q = n * 4; A[q] = rec[o + 8]; A[q + 1] = rec[o + 9]; A[q + 2] = rec[o + 10]; A[q + 3] = rec[o + 11]; }
          if (B) { const q = n * 4; B[q] = rec[o + 12]; B[q + 1] = rec[o + 13]; B[q + 2] = rec[o + 14]; B[q + 3] = rec[o + 15]; }
          if (col) { const q = n * 3; col[q] = rec[o + 12]; col[q + 1] = rec[o + 13]; col[q + 2] = rec[o + 14]; }
          n++;
        }
      }
    }
    mesh.count = n;
    for (const c of this.companions) c.mesh.count = n;
    const send = (attr, size) => {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, Math.max(n, 1) * size);
      attr.needsUpdate = true;
    };
    send(mesh.instanceMatrix, 16);
    if (this.aA) send(this.aA, 4);
    if (this.aB) send(this.aB, 4);
    if (this.color) send(mesh.instanceColor, 3);
  }
}

// Turn a model made of several three.js geometries into one geometry.
// Used for small props. parts = list of { geom, color:[r,g,b], rough, metal, paint, glow, pos, rot, scale }
// ---------------------------------------------------------------------------
// softBox - A BOX WITH SOFT EDGES, for very few triangles.
// A real thing has no razor-sharp edges: a bench leg, a dumpster, a shelter's roof all catch a thin line of light
// along their edges. softBox(w, h, d, r) is a box whose six faces are a little smaller (by r on every side); narrow
// strips join neighbouring faces and a small triangle closes every corner. The points keep the direction of their
// own face, so the light changes smoothly over a strip: the edge looks round. 44 triangles (a plain box has 12, a
// box with truly round edges several hundred).
//   r: the size of the soft edge in meters (left out: chosen from the size of the box). Very small boxes stay plain.
// ---------------------------------------------------------------------------
const _softCache = new Map();
export function softBox(w, h, d, r) {
  const small = Math.min(w, h, d);
  if (r === undefined) r = Math.min(0.045, small * 0.22);
  r = Math.min(r, small * 0.45);
  if (!(r > 0.006)) return new THREE.BoxGeometry(w, h, d);      // (thinner than about 3 cm: a plain box)
  const key = w + '|' + h + '|' + d + '|' + r;
  if (_softCache.has(key)) return _softCache.get(key);
  const H = [w / 2, h / 2, d / 2];
  const pos = [], nor = [], uv = [], idx = [];
  // vert[axis][sign][a][b]: the point of the face (axis, sign) at the corner (a, b) of its two other axes
  const vert = [];
  for (let ax = 0; ax < 3; ax++) {
    vert.push([]);
    const u = (ax + 1) % 3, v = (ax + 2) % 3;
    for (let si = 0; si < 2; si++) {
      const sg = si ? 1 : -1, face = [[0, 0], [0, 0]];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const p = [0, 0, 0];
        p[ax] = sg * H[ax]; p[u] = (a ? 1 : -1) * (H[u] - r); p[v] = (b ? 1 : -1) * (H[v] - r);
        face[a][b] = pos.length / 3;
        pos.push(p[0], p[1], p[2]);
        const n = [0, 0, 0]; n[ax] = sg; nor.push(n[0], n[1], n[2]);
        uv.push(a, b);
      }
      vert[ax].push(face);
    }
  }
  // a triangle whose front looks away from the middle of the box
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const tri = (a, b, c) => {
    const A = P(a), B = P(b), C = P(c);
    const nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    const out = nx * (A[0] + B[0] + C[0]) + ny * (A[1] + B[1] + C[1]) + nz * (A[2] + B[2] + C[2]);
    if (out >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  const quad = (a, b, c, e) => { tri(a, b, c); tri(a, c, e); };     // a-b-c-e go round the quad
  // the six faces
  for (let ax = 0; ax < 3; ax++) for (let si = 0; si < 2; si++) { const f = vert[ax][si]; quad(f[0][0], f[1][0], f[1][1], f[0][1]); }
  // the twelve edges: between the face (ax, s1) and the face (u, s2), along the axis v
  for (let ax = 0; ax < 3; ax++) {
    const u = (ax + 1) % 3;
    for (let s1 = 0; s1 < 2; s1++) for (let s2 = 0; s2 < 2; s2++) {
      // on the face of "ax" its axes are (u, v): the edge is at a = s2, b runs along v
      // on the face of "u" its axes are (v, ax): the edge is at b = s1, a runs along v
      const fa = vert[ax][s1], fb = vert[u][s2];
      quad(fa[s2][0], fa[s2][1], fb[1][s1], fb[0][s1]);
    }
  }
  // the eight corners: one point of each of the three faces that meet there
  for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) for (let sz = 0; sz < 2; sz++) {
    tri(vert[0][sx][sy][sz], vert[1][sy][sz][sx], vert[2][sz][sx][sy]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  _softCache.set(key, g);
  return g;
}

export function mergeParts(parts) {
  const mb = new MeshBuilder();
  for (const p of parts) {
    const c = p.color || [1, 1, 1];
    mb.color(c[0], c[1], c[2], 1);
    // aData for props = (roughness, metalness, paint mask, glow)
    mb.data(p.rough ?? 0.7, p.metal ?? 0, p.paint ?? 0, p.glow ?? 0);
    const pos = p.pos || [0, 0, 0];
    mb.add(p.geom, pos[0], pos[1], pos[2], p.rot || null, p.scale ?? null);
  }
  return mb.build(true);
}
