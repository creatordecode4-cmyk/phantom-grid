// ---------------------------------------------------------------------------
// textures.js - makes all the textures the game draws by itself:
//   * fallback surfaces (if a file in assets/textures is missing)
//   * single windows cut out of the two window pictures
//   * road markings, stains, manholes (decals)
//   * shop signs with made-up names
//   * leaves, palm fronds, glow sprites, water waves ...
//
// Everything is drawn on hidden 2D canvases when the game starts.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { RNG, clamp, smoothstep } from '../utils/math.js';
import { makeFbm, makeCanvas, grain, canvasTexture, canvasToAlphaTexture, readPixels } from '../utils/noise.js';

// Load a picture. Gives null (instead of an error) when the file is missing.
export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ===========================================================================
// 1. FALLBACK SURFACES (used only when a texture file is missing)
// ===========================================================================

// Draw a wobbly dark crack line.
function crack(ctx, rng, x, y, length, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let ang = rng.range(0, Math.PI * 2);
  for (let i = 0; i < length; i += 6) {
    ang += rng.range(-0.6, 0.6);
    x += Math.cos(ang) * 6;
    y += Math.sin(ang) * 6;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function fallbackAsphalt() {
  const S = 512;
  const [cv, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#4b4a48';
  ctx.fillRect(0, 0, S, S);
  const rng = new RNG(5);
  // small stones
  for (let i = 0; i < 9000; i++) {
    const g = rng.int(50, 120);
    ctx.fillStyle = `rgba(${g},${g},${g - 4},${rng.range(0.25, 0.7)})`;
    const s = rng.range(0.8, 2.6);
    ctx.fillRect(rng.range(0, S), rng.range(0, S), s, s);
  }
  // darker patches
  for (let i = 0; i < 14; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(20, 60);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(25,25,26,0.5)');
    gr.addColorStop(1, 'rgba(25,25,26,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 6; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.range(60, 200), 'rgba(20,20,20,0.6)');
  grain(ctx, S, S, 26, 9, makeFbm(4, 4, 3), 30);
  return cv;
}

export function fallbackSidewalk() {
  const S = 512;
  const [cv, ctx] = makeCanvas(S, S);
  const rng = new RNG(7);
  const n = 4, cs = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const g = rng.int(138, 160);
      ctx.fillStyle = `rgb(${g},${g - 2},${g - 7})`;
      ctx.fillRect(i * cs, j * cs, cs, cs);
    }
  }
  // stains
  for (let i = 0; i < 20; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(15, 50);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(70,66,58,0.35)');
    gr.addColorStop(1, 'rgba(70,66,58,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // joints between the slabs
  ctx.fillStyle = 'rgba(55,54,50,0.9)';
  for (let i = 0; i < n; i++) {
    ctx.fillRect(i * cs - 1, 0, 3, S);
    ctx.fillRect(0, i * cs - 1, S, 3);
  }
  for (let i = 0; i < 8; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.range(40, 140), 'rgba(40,40,38,0.7)');
  // old chewing gum spots
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(50,48,46,0.6)';
    ctx.beginPath();
    ctx.ellipse(rng.range(0, S), rng.range(0, S), rng.range(2, 4), rng.range(2, 4), 0, 0, 7);
    ctx.fill();
  }
  grain(ctx, S, S, 22, 3, makeFbm(6, 4, 8), 26);
  return cv;
}

export function fallbackBrick() {
  const S = 512;
  const [cv, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#9c988d';
  ctx.fillRect(0, 0, S, S);
  const rng = new RNG(21);
  const rowsN = 20, colsN = 6;
  const bh = S / rowsN, bw = S / colsN;
  for (let r = 0; r < rowsN; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let c = -1; c < colsN + 1; c++) {
      const hue = rng.range(6, 20), sat = rng.range(38, 58), lig = rng.range(26, 40);
      ctx.fillStyle = `hsl(${hue},${sat}%,${lig}%)`;
      const x = c * bw + off + 2, y = r * bh + 2;
      ctx.fillRect(x, y, bw - 4, bh - 4);
      // light worn top edge and dark bottom edge
      ctx.fillStyle = 'rgba(255,240,220,0.08)';
      ctx.fillRect(x, y, bw - 4, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + bh - 6, bw - 4, 2);
      // wrap the half bricks around the edge so the texture tiles
      if (x + bw > S) { ctx.fillStyle = `hsl(${hue},${sat}%,${lig}%)`; ctx.fillRect(x - S, y, bw - 4, bh - 4); }
    }
  }
  grain(ctx, S, S, 30, 4, makeFbm(5, 4, 12), 34);
  return cv;
}

export function fallbackPlaster() {
  const S = 512;
  const [cv, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#d4c8ad';
  ctx.fillRect(0, 0, S, S);
  const rng = new RNG(31);
  // dirty streaks running down
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), h = rng.range(60, 220), w = rng.range(3, 14);
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(90,80,62,0.22)');
    gr.addColorStop(1, 'rgba(90,80,62,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x, y - S, w, h);
  }
  for (let i = 0; i < 14; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.range(60, 220), 'rgba(70,62,50,0.5)');
  grain(ctx, S, S, 16, 5, makeFbm(4, 5, 14), 40);
  return cv;
}

export function fallbackSand() {
  const S = 512;
  const [cv, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#d6c4a0';
  ctx.fillRect(0, 0, S, S);
  const rng = new RNG(41);
  // soft dents (footprints)
  for (let i = 0; i < 70; i++) {
    const x = rng.range(0, S), y = rng.range(0, S);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(0, 6.28));
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    gr.addColorStop(0, 'rgba(120,100,70,0.3)');
    gr.addColorStop(1, 'rgba(120,100,70,0)');
    ctx.fillStyle = gr;
    ctx.scale(1, 2.2);
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
  }
  grain(ctx, S, S, 20, 6, makeFbm(8, 4, 15), 22);
  return cv;
}

export function fallbackGlassTower() {
  const S = 512;
  const [cv, ctx] = makeCanvas(S, S);
  const rng = new RNG(51);
  const n = 10, cs = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const l = 52 + rng.range(-6, 6) + (j % 3 === 2 ? -10 : 0);
      ctx.fillStyle = `hsl(205,24%,${l}%)`;
      ctx.fillRect(i * cs, j * cs, cs, cs);
    }
  }
  // soft cloud reflections
  const f = makeFbm(3, 4, 5);
  const img = ctx.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = (f(x / S, y / S) - 0.5) * 50;
    const i = (y * S + x) * 4;
    img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k;
  }
  ctx.putImageData(img, 0, 0);
  // frames between the glass panels
  ctx.fillStyle = '#3d4348';
  for (let i = 0; i < n; i++) {
    ctx.fillRect(i * cs - 1, 0, 2, S);
    ctx.fillRect(0, i * cs - 1, S, 2);
  }
  return cv;
}

// One made-up window (frame, glass, curtains). lit = glowing at night.
function drawWindow(ctx, x, y, w, h, rng, lit) {
  ctx.fillStyle = lit ? '#2a2320' : '#b9b4a6';
  ctx.fillRect(x, y, w, h); // wall around the window
  const fx = x + w * 0.04, fy = y + h * 0.05, fw = w * 0.92, fh = h * 0.86;
  ctx.fillStyle = lit ? '#1a1512' : '#e6e3da';
  ctx.fillRect(fx, fy, fw, fh); // frame
  const panes = 3;
  for (let i = 0; i < panes; i++) {
    const px = fx + 3 + (i * (fw - 3)) / panes, pw = (fw - 3) / panes - 3;
    const py = fy + 3, ph = fh - 6;
    if (lit) {
      const g = ctx.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, '#ffe0a0');
      g.addColorStop(1, '#f0b060');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = `hsl(${rng.int(195, 215)},${rng.int(12, 26)}%,${rng.int(24, 42)}%)`;
    }
    ctx.fillRect(px, py, pw, ph);
    // curtain
    if (rng.chance(0.6)) {
      ctx.fillStyle = lit ? 'rgba(255,235,190,0.55)' : `rgba(${rng.int(170, 225)},${rng.int(170, 220)},${rng.int(160, 210)},0.8)`;
      const cw = pw * rng.range(0.3, 1);
      ctx.fillRect(rng.chance(0.5) ? px : px + pw - cw, py, cw, ph);
    }
  }
  ctx.fillStyle = lit ? '#15110f' : '#cfccc2';
  ctx.fillRect(x + w * 0.02, y + h * 0.91, w * 0.96, h * 0.05); // sill
}

// ===========================================================================
// 2. WINDOWS: cut single windows out of windows_day.png / windows_night.png
// ===========================================================================
// Returns two "atlases" (one picture holding many small pictures):
//   day : 8 x 8 windows, alpha = how glassy (shiny) each pixel is
//   lit : 4 x 4 glowing windows used as light at night
export function buildWindowAtlases(dayImg, nightImg, cfgDay, cfgNight) {
  const CELL = 128;
  const rng = new RNG(808);

  // ---- day atlas ----------------------------------------------------------
  const [dcv, dctx] = makeCanvas(CELL * 8, CELL * 8);
  if (dayImg) {
    const sx = dayImg.width / 1024, sy = dayImg.height / 1024; // config numbers are for 1024 px
    const cw = 1024 / cfgDay.cols, ch = 1024 / cfgDay.rows;
    const cells = [];
    for (let r = 0; r < cfgDay.rows; r++) {
      for (let c = 0; c < cfgDay.cols; c++) {
        if (cfgDay.skipCols && cfgDay.skipCols.includes(c)) continue;
        cells.push([c, r]);
      }
    }
    // shuffle so neighbours in the atlas are not neighbours in the photo
    for (let i = cells.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (let k = 0; k < 64; k++) {
      const [c, r] = cells[k % cells.length];
      const x = (cfgDay.offsetX + c * cw + cfgDay.crop.x) * sx;
      const y = (cfgDay.offsetY + r * ch + cfgDay.crop.y) * sy;
      const w = cfgDay.crop.w * sx, h = cfgDay.crop.h * sy;
      if (y + h > dayImg.height) continue;
      dctx.drawImage(dayImg, x, y, w, h, (k % 8) * CELL, Math.floor(k / 8) * CELL, CELL, CELL);
    }
  } else {
    for (let k = 0; k < 64; k++) drawWindow(dctx, (k % 8) * CELL, Math.floor(k / 8) * CELL, CELL, CELL, rng, false);
    grain(dctx, CELL * 8, CELL * 8, 12, 2);
  }
  // alpha = glass mask: dark pixels are glass, bright frames are not shiny
  const dimg = dctx.getImageData(0, 0, CELL * 8, CELL * 8);
  const W = CELL * 8;
  const dout = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4, o = ((W - 1 - y) * W + x) * 4;
      const r = dimg.data[s], g = dimg.data[s + 1], b = dimg.data[s + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      dout[o] = r; dout[o + 1] = g; dout[o + 2] = b;
      dout[o + 3] = (1 - smoothstep(0.5, 0.82, lum)) * 255;
    }
  }
  const day = new THREE.DataTexture(dout, W, W, THREE.RGBAFormat);
  day.colorSpace = THREE.SRGBColorSpace;
  day.magFilter = THREE.LinearFilter;
  day.minFilter = THREE.LinearMipmapLinearFilter;
  day.generateMipmaps = true;
  day.needsUpdate = true;

  // ---- lit atlas ------------------------------------------------------------
  const [lcv, lctx] = makeCanvas(CELL * 4, CELL * 4);
  let litCells = [];
  if (nightImg) {
    const sx = nightImg.width / 1024, sy = nightImg.height / 1024;
    const cw = 1024 / cfgNight.cols;
    const ch = cfgNight.cellH || (1024 - cfgNight.offsetY) / cfgNight.rows;
    // find the windows that are glowing: measure their brightness
    const small = readPixels(nightImg, 256, 256).data;
    for (let r = 0; r < cfgNight.rows; r++) {
      for (let c = 0; c < cfgNight.cols; c++) {
        const x0 = cfgNight.offsetX + c * cw + cfgNight.crop.x;
        const y0 = cfgNight.offsetY + r * ch + cfgNight.crop.y;
        let sum = 0, n = 0;
        for (let y = Math.floor(y0 / 4); y < Math.floor((y0 + cfgNight.crop.h) / 4); y++) {
          for (let x = Math.floor(x0 / 4); x < Math.floor((x0 + cfgNight.crop.w) / 4); x++) {
            if (y >= 256) continue;
            const i = (y * 256 + x) * 4;
            sum += Math.max(small[i], small[i + 1], small[i + 2]);
            n++;
          }
        }
        const mean = n ? sum / n : 0;
        if (mean >= cfgNight.litThreshold) litCells.push({ c, r, mean, x0, y0 });
      }
    }
    litCells.sort((a, b) => b.mean - a.mean);
    if (litCells.length > 0) {
      for (let k = 0; k < 16; k++) {
        const cell = litCells[k % litCells.length];
        lctx.drawImage(nightImg, cell.x0 * sx, cell.y0 * sy, cfgNight.crop.w * sx, cfgNight.crop.h * sy,
          (k % 4) * CELL, Math.floor(k / 4) * CELL, CELL, CELL);
      }
    }
  }
  if (!nightImg || litCells.length === 0) {
    for (let k = 0; k < 16; k++) drawWindow(lctx, (k % 4) * CELL, Math.floor(k / 4) * CELL, CELL, CELL, rng, true);
  }
  // remove the dark blue "night wall" so only the glow is left
  const limg = lctx.getImageData(0, 0, CELL * 4, CELL * 4);
  for (let i = 0; i < limg.data.length; i += 4) {
    for (let k = 0; k < 3; k++) limg.data[i + k] = clamp((limg.data[i + k] - 46) * 1.22, 0, 255);
  }
  lctx.putImageData(limg, 0, 0);
  const lit = canvasTexture(lcv, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });

  return { day, lit };
}

// ===========================================================================
// 3. ROAD MARKINGS (white paint with wear). Repeats along U.
//    4 rows (from the bottom up):  dashed line | solid line | double line | crosswalk bars
// ===========================================================================
export function makeMarkingsTexture() {
  const W = 512, H = 256, ROW = 64;
  const data = new Uint8Array(W * H * 4);
  const wear = makeFbm(8, 4, 91);
  const chips = makeFbm(64, 2, 92);
  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / ROW);
    const v = (y % ROW) / ROW; // 0..1 across the line
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let a = 0;
      if (row === 0) a = u < 0.25 ? 1 : 0;                       // dash 3 m, gap 9 m
      else if (row === 1) a = 1;                                 // solid
      else if (row === 2) a = v < 0.33 || v > 0.67 ? 1 : 0;      // two lines
      else a = ((u * 4) % 1) < 0.5 ? 1 : 0;                      // bars
      // soft, slightly ragged edges
      const edge = Math.min(v, 1 - v);
      if (row !== 2) a *= smoothstep(0.02, 0.1, edge + (chips(u * 3, v) - 0.5) * 0.08);
      // worn paint: big faded areas + small chips
      const w1 = wear(u, y / H);
      const w2 = chips(u, y / H);
      a *= smoothstep(0.18, 0.5, w1 * 0.75 + w2 * 0.45);
      a *= 0.78 + 0.22 * w2;
      const i = (y * W + x) * 4;
      data[i] = 232; data[i + 1] = 231; data[i + 2] = 224;
      data[i + 3] = clamp(a, 0, 1) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
// V range of each marking row (a little inside the row so rows do not mix).
// The data rows are stored bottom-up, so row 0 is at the BOTTOM of the texture.
export const MARK = {
  dashed: [0.02, 0.23],
  solid: [0.27, 0.48],
  double: [0.52, 0.73],
  bars: [0.77, 0.98],
};

// ===========================================================================
// 4. DECALS: manholes, stains, cracks, soft shadows. 4 x 4 cells.
// ===========================================================================
// Cell positions (column, row). Row 0 is the TOP row of the canvas.
export const DECAL = {
  manhole: [0, 0], drain: [1, 0], oil1: [2, 0], oil2: [3, 0],
  crack1: [0, 1], crack2: [1, 1], tar: [2, 1], skid: [3, 1],
  ao: [0, 2], leak: [1, 2], dirt: [2, 2], treePit: [3, 2],
  patch: [0, 3], streak: [1, 3], blob: [2, 3], blobRect: [3, 3],
};
// Texture coordinates of a decal cell: { u0, v0, u1, v1 } (v goes up).
export function decalUV(name, inset = 0.004) {
  const [c, r] = DECAL[name];
  return { u0: c / 4 + inset, u1: (c + 1) / 4 - inset, v0: 1 - (r + 1) / 4 + inset, v1: 1 - r / 4 - inset };
}

export function makeDecalTexture() {
  const S = 1024, C = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const rng = new RNG(404);
  const cell = (name) => { const [c, r] = DECAL[name]; return [c * C, r * C]; };

  // --- manhole cover (cast iron) ---
  {
    const [x, y] = cell('manhole');
    const cx = x + C / 2, cy = y + C / 2;
    ctx.fillStyle = '#2a2927';
    ctx.beginPath(); ctx.arc(cx, cy, 120, 0, 7); ctx.fill();   // dark ring / gap
    ctx.fillStyle = '#4a4744';
    ctx.beginPath(); ctx.arc(cx, cy, 108, 0, 7); ctx.fill();   // lid
    ctx.strokeStyle = '#35332f'; ctx.lineWidth = 5;
    for (const r of [96, 70, 40]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
    ctx.lineWidth = 4;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
      ctx.lineTo(cx + Math.cos(a) * 94, cy + Math.sin(a) * 94);
      ctx.stroke();
    }
    // small raised squares (grip pattern)
    ctx.fillStyle = '#5a5753';
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      if (i * i + j * j > 6) continue;
      ctx.fillRect(cx + i * 10 - 3, cy + j * 10 - 3, 6, 6);
    }
    // two pick holes
    ctx.fillStyle = '#151413';
    ctx.fillRect(cx - 84, cy - 4, 12, 8);
    ctx.fillRect(cx + 72, cy - 4, 12, 8);
  }
  // --- storm drain grate ---
  {
    const [x, y] = cell('drain');
    ctx.fillStyle = '#2b2a28';
    ctx.fillRect(x + 28, y + 68, 200, 120);
    ctx.fillStyle = '#4c4946';
    ctx.fillRect(x + 36, y + 76, 184, 104);
    ctx.fillStyle = '#121211';
    for (let i = 0; i < 9; i++) ctx.fillRect(x + 46 + i * 19, y + 84, 10, 88);
  }
  // --- oil stains ---
  for (const name of ['oil1', 'oil2']) {
    const [x, y] = cell(name);
    for (let i = 0; i < (name === 'oil1' ? 9 : 16); i++) {
      const px = x + C / 2 + rng.range(-60, 60), py = y + C / 2 + rng.range(-60, 60);
      const r = rng.range(14, name === 'oil1' ? 60 : 34);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(14,13,12,0.75)');
      g.addColorStop(0.6, 'rgba(14,13,12,0.45)');
      g.addColorStop(1, 'rgba(14,13,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
  // --- cracks (dark, with a tar-sealed look on the second one) ---
  {
    const [x, y] = cell('crack1');
    ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 4, C - 8, C - 8); ctx.clip();
    for (let i = 0; i < 7; i++) crack(ctx, rng, x + rng.range(40, 216), y + rng.range(40, 216), rng.range(80, 190), 'rgba(15,15,15,0.85)', rng.range(1, 2.4));
    ctx.restore();
    const [x2, y2] = cell('crack2');
    ctx.save(); ctx.beginPath(); ctx.rect(x2 + 4, y2 + 4, C - 8, C - 8); ctx.clip();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) crack(ctx, rng, x2 + rng.range(20, 60), y2 + rng.range(40, 216), 230, 'rgba(12,12,13,0.9)', rng.range(4, 7));
    ctx.restore();
  }
  // --- square tar patch ---
  {
    const [x, y] = cell('tar');
    ctx.fillStyle = 'rgba(22,22,23,0.82)';
    ctx.fillRect(x + 30, y + 44, 196, 168);
    ctx.strokeStyle = 'rgba(8,8,8,0.9)'; ctx.lineWidth = 5;
    ctx.strokeRect(x + 30, y + 44, 196, 168);
  }
  // --- tire skid marks ---
  {
    const [x, y] = cell('skid');
    for (const off of [70, 170]) {
      const g = ctx.createLinearGradient(x, 0, x + C, 0);
      g.addColorStop(0, 'rgba(10,10,10,0)');
      g.addColorStop(0.3, 'rgba(10,10,10,0.6)');
      g.addColorStop(1, 'rgba(10,10,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 8, y + off, C - 16, 16);
    }
  }
  // --- soft dark strip (fake shadow where walls meet the ground) ---
  {
    const [x, y] = cell('ao');
    const g = ctx.createLinearGradient(0, y + C, 0, y);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.26)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, C, C);
  }
  // --- leak / water stain ---
  {
    const [x, y] = cell('leak');
    for (let i = 0; i < 8; i++) {
      const px = x + rng.range(70, 186), w = rng.range(18, 50);
      const g = ctx.createLinearGradient(0, y + 20, 0, y + 236);
      g.addColorStop(0, 'rgba(20,18,15,0.5)');
      g.addColorStop(1, 'rgba(20,18,15,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(px, y + 128, w / 2, 108, 0, 0, 7); ctx.fill();
    }
  }
  // --- dirt and small litter specks ---
  {
    const [x, y] = cell('dirt');
    for (let i = 0; i < 260; i++) {
      const a = rng.range(0, 6.28), d = rng.range(0, 110) * rng.next();
      ctx.fillStyle = `rgba(${rng.int(20, 60)},${rng.int(18, 50)},${rng.int(14, 40)},${rng.range(0.3, 0.8)})`;
      ctx.fillRect(x + 128 + Math.cos(a) * d, y + 128 + Math.sin(a) * d, rng.range(1, 5), rng.range(1, 4));
    }
  }
  // --- tree pit (square of dark soil with an iron edge) ---
  {
    const [x, y] = cell('treePit');
    ctx.fillStyle = '#2c2b29';
    ctx.fillRect(x + 8, y + 8, 240, 240);
    ctx.fillStyle = '#3b3126';
    ctx.fillRect(x + 20, y + 20, 216, 216);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${rng.int(30, 90)},${rng.int(24, 70)},${rng.int(16, 46)},0.7)`;
      ctx.fillRect(x + rng.range(20, 232), y + rng.range(20, 232), rng.range(1, 5), rng.range(1, 4));
    }
  }
  // --- big repaving patch (newer, darker asphalt) ---
  {
    const [x, y] = cell('patch');
    ctx.fillStyle = 'rgba(24,24,26,0.5)';
    ctx.fillRect(x + 6, y + 6, C - 12, C - 12);
    ctx.strokeStyle = 'rgba(10,10,10,0.55)'; ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, y + 6, C - 12, C - 12);
  }
  // --- long oil streak along a lane (repeats along U) ---
  {
    const [x, y] = cell('streak');
    const g = ctx.createLinearGradient(0, y + 40, 0, y + 216);
    g.addColorStop(0, 'rgba(12,12,12,0)');
    g.addColorStop(0.5, 'rgba(12,12,12,0.34)');
    g.addColorStop(1, 'rgba(12,12,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y + 40, C, 176);
  }
  // --- round soft shadow blob ---
  {
    const [x, y] = cell('blob');
    const g = ctx.createRadialGradient(x + 128, y + 128, 0, x + 128, y + 128, 124);
    g.addColorStop(0, 'rgba(0,0,0,0.78)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, C, C);
  }
  // --- rounded rectangle shadow (under cars) ---
  {
    const [x, y] = cell('blobRect');
    // many see-through layers, each a bit smaller = a soft edge
    ctx.fillStyle = 'rgba(0,0,0,0.085)';
    for (let i = 0; i < 16; i++) {
      const inset = 14 + i * 4;
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, C - inset * 2, C - inset * 2, 34);
      ctx.fill();
    }
  }

  // Break up the clean shapes with noise in the see-through channel.
  const img = ctx.getImageData(0, 0, S, S);
  const f = makeFbm(48, 3, 77);
  for (let yy = 0; yy < S; yy++) {
    const row = Math.floor(yy / C);
    for (let xx = 0; xx < S; xx++) {
      const col = Math.floor(xx / C);
      // keep the soft shadows and the manhole clean
      if (row === 3 && col >= 2) continue;
      if (row === 2 && (col === 0 || col === 3)) continue;
      if (row === 0 && col <= 1) continue;
      const i = (yy * S + xx) * 4;
      img.data[i + 3] *= 0.55 + 0.6 * f(xx / S, yy / S);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasToAlphaTexture(cv, [30, 29, 28]);
}

// ===========================================================================
// 5. SHOP SIGNS (made-up names only). 4 columns x 8 rows of 512 x 128 signs.
//    Rows 0-5: painted / backlit signs.  Rows 6-7: neon signs.
// ===========================================================================
export const SIGN_NAMES = [
  'ALVAREZ & SONS HARDWARE', 'MERIDIAN LIQUOR', 'LUCKY PELICAN LAUNDROMAT', 'IRONHILL PAWN & LOAN',
  'GRID CITY TACOS', 'PHO 2090', "NADIA'S BAKERY", 'OKONKWO PHARMACY',
  'BLUE HERON DINER', 'TIDEWATER TATTOO', 'VOLT & BOLT REPAIRS', 'SILVERFIN FISH MARKET',
  'HALCYON BOOKS', 'DEPOT STREET BARBERS', 'NIGHT HERON COFFEE', "MAMA ODESSA'S KITCHEN",
  'HARBOR CHECK CASHING', 'KESTREL CYCLE WORKS', 'KASIMIR TAILOR', 'SUNDOWN SMOKE SHOP',
  'GASKET KING AUTO PARTS', 'GOLDEN CRANE NOODLE HOUSE', 'BODEGA LA ESTRELLA', 'CALLOWAY GROCERY',
];
export const NEON_NAMES = [
  'THE VELVET PARROT', 'NEON MILE ARCADE', 'CLUB HALOGEN', 'MOONTIDE MOTEL',
  'DRIFTLINE SURF CO', 'ELECTRIC LOTUS', 'STARFISH DINER', 'BAYGLOW CINEMA',
];
const SIGN_SUB = ['EST. 2061', 'OPEN 24 HRS', 'SINCE 2048', 'FAMILY OWNED', 'OPEN LATE', 'WE DELIVER', 'CASH ONLY', 'EST. 2077'];
export const SIGN_COLS = 4, SIGN_ROWS = 8, NEON_FIRST_ROW = 6;
// UV rectangle of sign number i (0..31).
export function signUV(i) {
  const c = i % SIGN_COLS, r = Math.floor(i / SIGN_COLS);
  return { u0: c / SIGN_COLS, u1: (c + 1) / SIGN_COLS, v0: 1 - (r + 1) / SIGN_ROWS, v1: 1 - r / SIGN_ROWS };
}

// Fit a text into a box by shrinking the font until it fits.
function fitText(ctx, text, maxW, startPx, fontTail, weight = '700', style = '') {
  let px = startPx;
  do {
    ctx.font = `${style} ${weight} ${px}px ${fontTail}`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  } while (px > 10);
  return px;
}

export function makeSignTexture() {
  const CW = 512, CH = 128;
  const [cv, ctx] = makeCanvas(CW * SIGN_COLS, CH * SIGN_ROWS);
  const rng = new RNG(606);
  const sans = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
  const wide = '"Arial Black", "Roboto", "Helvetica Neue", Arial, sans-serif';
  const serif = 'Georgia, "Noto Serif", "Times New Roman", serif';
  const mono = '"Courier New", "Cutive Mono", monospace';
  // muted, slightly faded sign colors: [background, text]
  const schemes = [
    ['#7a1f1a', '#efe6cf'], ['#1e3a52', '#e9e4d4'], ['#e7dfc8', '#3b2a22'], ['#23382b', '#e8d9a8'],
    ['#d7c8a0', '#6b1d16'], ['#2b2b2e', '#e2c15a'], ['#c9d2cf', '#1f3148'], ['#5a2f44', '#f0e2d0'],
    ['#b55a26', '#f5ecd8'], ['#e9e6dc', '#1d5a57'], ['#3a3f4a', '#e7e7e2'], ['#84732f', '#f2ecd6'],
  ];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < SIGN_COLS * NEON_FIRST_ROW; i++) {
    const x = (i % SIGN_COLS) * CW, y = Math.floor(i / SIGN_COLS) * CH;
    const name = SIGN_NAMES[i % SIGN_NAMES.length];
    const [bg, fg] = schemes[rng.int(0, schemes.length - 1)];
    const style = rng.int(0, 3);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, CW, CH);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, CW, CH); ctx.clip();
    if (style === 0) {
      // big bold text
      fitText(ctx, name, CW - 60, 62, wide, '900');
      ctx.fillStyle = fg;
      ctx.fillText(name, x + CW / 2, y + CH / 2 + 2);
    } else if (style === 1) {
      // serif text with a thin frame and a small second line
      ctx.strokeStyle = fg; ctx.lineWidth = 3;
      ctx.strokeRect(x + 10, y + 10, CW - 20, CH - 20);
      fitText(ctx, name, CW - 80, 50, serif, '700');
      ctx.fillStyle = fg;
      ctx.fillText(name, x + CW / 2, y + CH / 2 - 10);
      ctx.font = `400 17px ${sans}`;
      ctx.fillText(rng.pick(SIGN_SUB), x + CW / 2, y + CH - 28);
    } else if (style === 2) {
      // color band on the left, tall narrow letters
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, 26, CH);
      ctx.save();
      ctx.translate(x + CW / 2 + 13, y + CH / 2);
      ctx.scale(0.8, 1.25);
      fitText(ctx, name, (CW - 80) / 0.8, 60, sans, '700');
      ctx.fillText(name, 0, 2);
      ctx.restore();
    } else {
      // typewriter style with a line above and below
      ctx.fillStyle = fg;
      ctx.fillRect(x + 24, y + 22, CW - 48, 4);
      ctx.fillRect(x + 24, y + CH - 26, CW - 48, 4);
      fitText(ctx, name, CW - 70, 46, mono, '700');
      ctx.fillText(name, x + CW / 2, y + CH / 2 + 1);
    }
    ctx.restore();
    // weathering: dirt running down from the top
    const g = ctx.createLinearGradient(0, y, 0, y + CH);
    g.addColorStop(0, 'rgba(40,34,26,0.28)');
    g.addColorStop(0.4, 'rgba(40,34,26,0.05)');
    g.addColorStop(1, 'rgba(40,34,26,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, CW, CH);
  }
  // neon signs: dark board, glowing tube letters
  const neonColors = ['#ff4f8a', '#5ad8ff', '#ffb347', '#9dff7a', '#c58bff', '#ff6b5a', '#59ffd0', '#ffe066'];
  for (let k = 0; k < SIGN_COLS * (SIGN_ROWS - NEON_FIRST_ROW); k++) {
    const i = SIGN_COLS * NEON_FIRST_ROW + k;
    const x = (i % SIGN_COLS) * CW, y = Math.floor(i / SIGN_COLS) * CH;
    const name = NEON_NAMES[k % NEON_NAMES.length];
    const col = neonColors[k % neonColors.length];
    ctx.fillStyle = '#0d0d10';
    ctx.fillRect(x, y, CW, CH);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, CW, CH); ctx.clip();
    const fontTail = k % 2 === 0 ? `"Brush Script MT", "Dancing Script", cursive, ${serif}` : sans;
    fitText(ctx, name, CW - 70, k % 2 === 0 ? 76 : 64, fontTail, k % 2 === 0 ? '400' : '700', k % 2 === 0 ? 'italic' : '');
    ctx.shadowColor = col;
    ctx.shadowBlur = 22;
    ctx.fillStyle = col;
    ctx.fillText(name, x + CW / 2, y + CH / 2);
    ctx.shadowBlur = 8;
    ctx.fillText(name, x + CW / 2, y + CH / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(name, x + CW / 2, y + CH / 2);
    // a glowing tube line under the name
    ctx.strokeStyle = neonColors[(k + 3) % neonColors.length];
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 60, y + CH - 20); ctx.lineTo(x + CW - 60, y + CH - 20); ctx.stroke();
    ctx.restore();
  }
  // faint noise over the painted signs so they do not look brand new
  const img = ctx.getImageData(0, 0, cv.width, CH * NEON_FIRST_ROW);
  const f = makeFbm(24, 3, 61);
  const r2 = new RNG(62);
  for (let yy = 0; yy < CH * NEON_FIRST_ROW; yy++) {
    for (let xx = 0; xx < cv.width; xx++) {
      const i = (yy * cv.width + xx) * 4;
      const n = (f(xx / cv.width, yy / cv.height) - 0.5) * 38 + (r2.next() - 0.5) * 14;
      img.data[i] = clamp(img.data[i] + n, 0, 255);
      img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
      img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(cv, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, anisotropy: 4 });
}

// ===========================================================================
// 6. HOLOGRAM BILLBOARDS for Neon Mile. 4 tall panels side by side.
// ===========================================================================
export const HOLO_COUNT = 4;
export function makeHoloTexture() {
  const PW = 256, PH = 512;
  const [cv, ctx] = makeCanvas(PW * HOLO_COUNT, PH);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const ads = [
    { a: '#39e6ff', b: '#1458ff', title: 'KVI', lines: ['KESSLER-VANCE', 'TOMORROW,', 'DELIVERED'] },
    { a: '#ff5fa8', b: '#ff9b3d', title: 'NEON', lines: ['MILE', 'OPEN ALL', 'NIGHT'] },
    { a: '#7dffb0', b: '#2bd4c6', title: 'M-LINE', lines: ['MERIDIAN LINE', 'EVERY 4', 'MINUTES'] },
    { a: '#c9a2ff', b: '#6a5cff', title: 'HALO', lines: ['SKYLOFTS', 'THE CROWN', 'FROM 2091'] },
  ];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sans = '"Helvetica Neue", Roboto, Arial, sans-serif';
  ads.forEach((ad, k) => {
    const x = k * PW;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, 0, PW, PH); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + PW, PH);
    g.addColorStop(0, ad.a); g.addColorStop(1, ad.b);
    // glowing shapes
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = g;
    ctx.fillRect(x + 14, 14, PW - 28, PH - 28);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = g; ctx.lineWidth = 3;
    ctx.strokeRect(x + 14, 14, PW - 28, PH - 28);
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.5 - i * 0.08;
      ctx.beginPath(); ctx.arc(x + PW / 2, 170, 40 + i * 18, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    fitText(ctx, ad.title, PW - 60, 62, sans, '200');
    ctx.fillText(ad.title, x + PW / 2, 170);
    ctx.fillStyle = ad.a;
    ctx.font = `600 22px ${sans}`;
    ctx.fillText(ad.lines[0], x + PW / 2, 318);
    ctx.fillStyle = '#ffffff';
    ctx.font = `200 34px ${sans}`;
    ctx.fillText(ad.lines[1], x + PW / 2, 372);
    ctx.fillText(ad.lines[2], x + PW / 2, 414);
    ctx.fillStyle = ad.b;
    ctx.fillRect(x + 60, 452, PW - 120, 3);
    ctx.restore();
  });
  return canvasTexture(cv, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
}

// ===========================================================================
// 7. PLANTS
// ===========================================================================
// A clump of leaves (used on flat cards to build tree crowns).
export function makeLeafTexture() {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const rng = new RNG(71);
  for (let i = 0; i < 520; i++) {
    // leaves are thicker in the middle of the clump
    const a = rng.range(0, 6.283), d = Math.pow(rng.next(), 0.75) * 112;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.92;
    const depth = i / 520; // later leaves are in front = lighter
    const l = 13 + depth * 20 + rng.range(-4, 5);
    ctx.fillStyle = `hsl(${rng.int(74, 104)},${rng.int(22, 40)}%,${l}%)`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(0, 6.283));
    ctx.beginPath();
    ctx.ellipse(0, 0, rng.range(6, 11), rng.range(2.6, 4.6), 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  return canvasToAlphaTexture(cv, [52, 62, 34]);
}

// A palm frond: a stem with thin leaflets on both sides.
export function makeFrondTexture() {
  const W = 128, H = 512;
  const [cv, ctx] = makeCanvas(W, H);
  const rng = new RNG(72);
  ctx.lineCap = 'round';
  for (let i = 0; i < 74; i++) {
    const t = i / 73;            // 0 at the base, 1 at the tip
    const y = H - 10 - t * (H - 24);
    const len = (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08))) * 56;
    for (const side of [-1, 1]) {
      const l = len * rng.range(0.82, 1.05);
      ctx.strokeStyle = `hsl(${rng.int(72, 96)},${rng.int(26, 42)}%,${rng.int(20, 34)}%)`;
      ctx.lineWidth = rng.range(2.2, 3.6);
      ctx.beginPath();
      ctx.moveTo(W / 2, y);
      ctx.quadraticCurveTo(W / 2 + side * l * 0.6, y - 4, W / 2 + side * l, y + 14 + rng.range(-3, 6));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#6a6a3a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2, H); ctx.lineTo(W / 2, 8); ctx.stroke();
  return canvasToAlphaTexture(cv, [58, 70, 36]);
}

// ===========================================================================
// 8. SMALL HELPERS: glow sprite, awning cloth, water waves, skyline
// ===========================================================================
// Soft round glow (drawn additively around light bulbs).
export function makeGlowTexture() {
  const S = 64;
  const [cv, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.24)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTexture(cv, { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
}

// Striped cloth for shop awnings (tinted per shop with vertex colors).
export function makeAwningTexture() {
  const S = 128;
  const [cv, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#8f8c86';
  for (let i = 0; i < 4; i++) ctx.fillRect(i * 32, 0, 16, S);
  // dirt from rain: darker toward the lower edge
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(60,50,40,0.0)');
  g.addColorStop(1, 'rgba(60,50,40,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  grain(ctx, S, S, 18, 12, makeFbm(6, 3, 13), 30);
  return canvasTexture(cv);
}

// Normal map of small water waves (tileable).
export function makeWaterNormalTexture() {
  const S = 256;
  const f1 = makeFbm(6, 4, 201, 0.55);
  const f2 = makeFbm(14, 3, 202, 0.5);
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    hgt[y * S + x] = f1(x / S, y / S) * 0.7 + f2(x / S, y / S) * 0.3;
  }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x - 1 + S) % S)]) * 9;
    const dy = (hgt[((y + 1) % S) * S + x] - hgt[((y - 1 + S) % S) * S + x]) * 9;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * S + x) * 4;
    data[i] = (-dx / len * 0.5 + 0.5) * 255;
    data[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
    data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// A strip of building shapes used in the reflection map, so shiny things
// (cars, windows, puddles) reflect "a city" and not only empty sky.
// Returns { shape, lights }: dark building shapes and their lit windows.
export function makeSkylineTextures() {
  const W = 1024, H = 128;
  const [cv, ctx] = makeCanvas(W, H);
  const [lv, lctx] = makeCanvas(W, H);
  lctx.fillStyle = '#000';
  lctx.fillRect(0, 0, W, H);
  const rng = new RNG(88);
  let x = 0;
  while (x < W) {
    const w = rng.int(14, 46);
    const h = rng.int(26, 96) * (rng.chance(0.15) ? 1.25 : 1);
    const g = rng.int(96, 150);
    ctx.fillStyle = `rgb(${g},${g - 3},${g - 8})`;
    ctx.fillRect(x, H - h, w, h);
    for (let wy = H - h + 4; wy < H - 4; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (rng.chance(0.5)) { ctx.fillStyle = 'rgba(40,48,58,0.8)'; ctx.fillRect(wx, wy, 3, 3); }
        if (rng.chance(0.16)) { lctx.fillStyle = rng.chance(0.8) ? '#ffcf8a' : '#cfe4ff'; lctx.fillRect(wx, wy, 3, 3); }
      }
    }
    x += w;
  }
  return {
    shape: canvasToAlphaTexture(cv, [120, 118, 112], { wrapS: THREE.RepeatWrapping }),
    lights: canvasTexture(lv, { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping }),
  };
}
