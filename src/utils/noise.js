// ---------------------------------------------------------------------------
// noise.js - "noise" is the cloudy random pattern we use everywhere to make
// surfaces look dirty, worn and less repeated.
//
// All noise here is TILEABLE: the left edge matches the right edge and the
// top matches the bottom, so textures made from it repeat without seams.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RNG } from './math.js';

// One layer of smooth noise on a small grid of random values.
export class TileNoise {
  // period: how many random cells fit across the texture.
  constructor(period, seed) {
    this.p = period;
    const rng = new RNG(seed);
    this.v = new Float32Array(period * period);
    for (let i = 0; i < this.v.length; i++) this.v[i] = rng.next();
  }
  // u, v from 0 to 1 (wraps around). Returns 0..1.
  sample(u, v) {
    const p = this.p;
    let x = (u - Math.floor(u)) * p;
    let y = (v - Math.floor(v)) * p;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    let fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const a = this.v[y0 * p + x0], b = this.v[y0 * p + x1];
    const c = this.v[y1 * p + x0], d = this.v[y1 * p + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
}

// Several layers of noise added together ("fractal noise"): big soft shapes
// plus smaller and smaller detail. Returns a function (u, v) -> 0..1.
export function makeFbm(basePeriod, octaves, seed, gain = 0.5) {
  const layers = [];
  let amp = 1, total = 0, period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    layers.push({ n: new TileNoise(period, seed + o * 101), amp });
    total += amp;
    amp *= gain;
    period *= 2;
  }
  return (u, v) => {
    let s = 0;
    for (const l of layers) s += l.n.sample(u, v) * l.amp;
    return s / total;
  };
}

// The shared noise texture used by the shaders (256 x 256).
//   red   = big soft blotches
//   green = medium detail
//   blue  = another blotch pattern
//   alpha = vertical streaks (rain / dirt running down walls)
export function makeNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const r = makeFbm(4, 4, 11);
  const g = makeFbm(16, 3, 23);
  const b = makeFbm(6, 4, 37);
  const a1 = makeFbm(32, 2, 51);
  const a2 = makeFbm(3, 2, 67);
  // Stretch the contrast a little so the values use the whole 0..1 range.
  const st = (x) => Math.min(1, Math.max(0, (x - 0.5) * 1.9 + 0.5));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const i = (y * size + x) * 4;
      data[i] = st(r(u, v)) * 255;
      data[i + 1] = st(g(u, v)) * 255;
      data[i + 2] = st(b(u, v)) * 255;
      // streaks: fast change across (u), slow change down (v)
      data[i + 3] = st(a1(u, v * 0.06) * 0.6 + a2(u, v) * 0.4) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Read the pixels of an image (or canvas) at a chosen size.
// Returns { data (RGBA bytes, top row first), width, height }.
// ---------------------------------------------------------------------------
export function readPixels(image, width, height) {
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// Blur a single-channel float image with a box filter that wraps around.
function boxBlurWrap(src, w, h, radius) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const win = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[y * w + ((k + w) % w)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / win;
      sum += src[y * w + ((x + radius + 1) % w)] - src[y * w + ((x - radius + w) % w)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += tmp[((k + h) % h) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      sum += tmp[((y + radius + 1) % h) * w + x] - tmp[((y - radius + h) % h) * w + x];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Make a NORMAL map (fake small bumps) and a ROUGHNESS value from a color
// picture. We guess the height of the surface from how bright each pixel
// is: dark cracks are low, bright stones are high.
//
// The result is one texture:  RGB = normal,  A = roughness.
//
// opts:
//   size      : size of the result (512 is plenty)
//   strength  : how deep the bumps look
//   mode      : 'luma' (bright = high) or 'saturation' (colorful = high, used
//               for brick where the grey mortar is lower than the red brick)
//   roughness : average roughness; darker spots become a bit rougher
// ---------------------------------------------------------------------------
export function makeNormalRoughTexture(image, opts = {}) {
  const size = opts.size || 512;
  const strength = opts.strength ?? 2;
  const baseRough = opts.roughness ?? 0.9;
  const img = readPixels(image, size, size);
  const px = img.data;
  const n = size * size;
  const h = new Float32Array(n);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l;
    if (opts.mode === 'saturation') {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      h[i] = (mx - mn) * 1.1 + l * 0.45;
    } else {
      h[i] = l;
    }
  }
  // Remove slow brightness changes (stains are not bumps), keep fine detail.
  const low = boxBlurWrap(h, size, size, opts.detailRadius || 10);
  const lowLum = boxBlurWrap(lum, size, size, 12);
  for (let i = 0; i < n; i++) h[i] -= low[i];

  const out = new Uint8Array(n * 4);
  for (let y = 0; y < size; y++) {
    const yu = (y - 1 + size) % size, yd = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size, xr = (x + 1) % size;
      // Sobel filter = slope of the height in x and y.
      const tl = h[yu * size + xl], tc = h[yu * size + x], tr = h[yu * size + xr];
      const ml = h[y * size + xl], mr = h[y * size + xr];
      const bl = h[yd * size + xl], bc = h[yd * size + x], br = h[yd * size + xr];
      const dx = (tr + 2 * mr + br - tl - 2 * ml - bl) * strength;
      const dy = (bl + 2 * bc + br - tl - 2 * tc - tr) * strength; // image rows go down
      let nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      // Write rows upside down so the texture matches the color picture.
      const o = ((size - 1 - y) * size + x) * 4;
      out[o] = (nx * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * 0.5 + 0.5) * 255;
      out[o + 2] = (nz * 0.5 + 0.5) * 255;
      // Roughness: darker than the surroundings = rougher (dirt, pits).
      const i = y * size + x;
      const rough = baseRough + (lowLum[i] - lum[i]) * 0.5;
      out[o + 3] = Math.min(1, Math.max(0.25, rough)) * 255;
    }
  }
  const tex = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Turn a canvas with see-through parts into a texture WITHOUT dark edges.
// Fully transparent pixels get the color "bleed" so that when the GPU blends
// pixels at the border of a shape, no black leaks in.
// ---------------------------------------------------------------------------
export function canvasToAlphaTexture(canvas, bleed = null, opts = {}) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  // Average color of the visible pixels (used when no bleed color is given).
  let br = 0, bg = 0, bb = 0, bw = 0;
  if (!bleed) {
    for (let i = 0; i < w * h; i++) {
      const a = src[i * 4 + 3];
      if (a > 128) { br += src[i * 4]; bg += src[i * 4 + 1]; bb += src[i * 4 + 2]; bw++; }
    }
    bleed = bw ? [br / bw, bg / bw, bb / bw] : [128, 128, 128];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const o = ((h - 1 - y) * w + x) * 4; // flip rows: v = 0 is the bottom
      const a = src[s + 3];
      if (a < 8) {
        out[o] = bleed[0]; out[o + 1] = bleed[1]; out[o + 2] = bleed[2]; out[o + 3] = 0;
      } else {
        out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2]; out[o + 3] = a;
      }
    }
  }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = opts.wrapS || THREE.ClampToEdgeWrapping;
  tex.wrapT = opts.wrapT || THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// A normal three.js texture from a canvas (no transparency tricks).
export function canvasTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = opts.wrapS || THREE.RepeatWrapping;
  tex.wrapT = opts.wrapT || THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (opts.anisotropy) tex.anisotropy = opts.anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// New blank canvas + its 2D drawing context.
export function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d', { willReadFrequently: true })];
}

// Sprinkle noise over a canvas to make flat colors look like a real surface.
// amount: how strong (0..255), fbm: optional noise function for soft blotches.
export function grain(ctx, w, h, amount, seed = 1, fbm = null, fbmAmount = 0) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rng = new RNG(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let n = (rng.next() - 0.5) * amount;
      if (fbm) n += (fbm(x / w, y / h) - 0.5) * fbmAmount;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
  }
  ctx.putImageData(img, 0, 0);
}
