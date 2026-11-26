// ---------------------------------------------------------------------------
// characterDetail.js - the story characters close up.
//
// Every character model carries ONE picture for its whole body: 1024 x 1024
// points, saved small (strongly compressed). A face gets about 150 x 150 of
// those points, a hand about 50 - close up they look soft. Nothing is added
// to the people here; their own picture is shown as clearly as it can be.
// This file prepares a character once, when its model has been rigged
// (autoRig.js):
//
//   1. SHARPER PICTURE   the picture is sharpened (an unsharp mask on the
//                        brightness only, so there are no colored fringes): the
//                        eyes, brows, lips, seams and folds come out. Only the
//                        parts of the picture that belong to the model are used
//                        (the empty space between them does not bleed in), very
//                        small differences are left alone (the noise of the
//                        compression does not grow), and next to the edge of a
//                        part it sharpens less, so seams do not stand out.
//   2. CLEAN EDGES       the empty space around each part of the picture is
//                        filled with the part's edge colors: without that, the
//                        dark space bleeds into the edges when the GPU blends
//                        neighboring points - thin dark lines along the seams.
//   3. FILTERING         the pictures are read with anisotropic filtering: sharp
//                        also at a slant (arms, the sides of the body).
//   4. EYES              where the two eyes are and how deep they lie: the
//                        shader (characterLook.js) makes them wet.
//
// The result goes to applyCharacterLook (characterLook.js) as "detail".
// It needs a browser (a canvas). Nothing here imports three.js.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THREE: the three.js module. A: the analysis of autoRig.js (bones, skin weights). geo: the finished geometry
// (with skinIndex / skinWeight). material: the character's material. face: what readFace found (or null).
// opts: { sharpen: 0..1.5 (0 = off) }. Returns (a promise of) the detail for applyCharacterLook, or null. The work on
// the picture is done in three steps with a short break between them (the game draws a picture meanwhile), so the
// game never stops for long while a character is prepared.
// ---------------------------------------------------------------------------
export async function prepareCharacter(THREE, A, geo, material, face, opts = {}) {
  if (!A || !geo || !geo.attributes.position || !geo.attributes.skinIndex) return null;
  const pos = geo.attributes.position.array, count = pos.length / 3;
  const si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array;

  // ---- 4. the eyes (where the eyelid bones of faceRig.js sit) ----
  const k = (A.height || 1.8) / 1.8;
  let eyes = null;
  if (face && face.eyeX > 0) {
    const at = (x, y, z) => [x * k, face.chin + y * k, face.zFace + z * k];
    eyes = {
      l: at(face.noseX + face.eyeX, face.eyeY, -0.02), r: at(face.noseX - face.eyeX, face.eyeY, -0.02),
      size: [0.0125 * k, 0.0062 * k, face.eyesFound ? 1 : 0.6],
    };
    // (the eye lies deeper in its socket than the eyelid bone: its front is where the points of the model in front of
    //  the eye are - the middle depth of them. A model with too few points there gets no wet eyes.)
    const headBone = A.boneIndex ? A.boneIndex.head : undefined;
    for (const c of [eyes.l, eyes.r]) {
      // (a face with few points around the eyes: the lids and the skin right around the eye tell the depth as well)
      let zs = [];
      for (const reach of [1, 1.8]) {
        zs = [];
        for (let v = 0; v < count; v++) {
          if (headBone !== undefined && si[v * 4] !== headBone && sw[v * 4] > 0.5) continue;
          const dx = (pos[v * 3] - c[0]) / (eyes.size[0] * reach), dy = (pos[v * 3 + 1] - c[1]) / (eyes.size[1] * reach), dz = pos[v * 3 + 2] - c[2];
          if (dx * dx + dy * dy < 1 && dz > -0.06 * k && dz < 0.02 * k) zs.push(pos[v * 3 + 2]);
        }
        if (zs.length >= 3) break;
      }
      if (zs.length >= 3) { zs.sort((a, b) => a - b); c[2] = zs[zs.length >> 1]; }
      else eyes.size[2] = 0;
    }
  }

  // ---- the picture: sharpened, its edges cleaned ----
  const map = material && material.map, img = map && map.image;
  let sharpened = false;
  const W = img && img.width, H = img && img.height;
  if (img && W && H && W * H <= 4200000 && typeof document !== 'undefined' && geo.attributes.uv && geo.index) {
    let cv = null, g2 = null, data = null;
    try {
      if (map.isCanvasTexture && img.getContext) { cv = img; g2 = cv.getContext('2d', { willReadFrequently: true }); }
      else { cv = document.createElement('canvas'); cv.width = W; cv.height = H; g2 = cv.getContext('2d', { willReadFrequently: true }); g2.drawImage(img, 0, 0, W, H); }
      data = g2.getImageData(0, 0, W, H);
    } catch (e) { data = null; }     // (a picture that may not be read: leave it)
    if (data) {
      const px = data.data, uv = geo.attributes.uv.array, idx = geo.index.array;
      map.updateMatrix();
      const e = map.matrix.elements, flip = map.flipY;
      const U = (i) => (e[0] * uv[i * 2] + e[3] * uv[i * 2 + 1] + e[6]) * W;
      const V = (i) => { const v = e[1] * uv[i * 2] + e[4] * uv[i * 2 + 1] + e[7]; return (flip ? 1 - v : v) * H; };

      // 1. sharpen, only inside the pieces of the picture that the model uses
      const amount = opts.sharpen === undefined ? 0.85 : opts.sharpen;
      if (amount > 0 && !(map.userData && map.userData.pgSharp)) {
        const inside = new Uint8Array(W * H);
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t], b = idx[t + 1], c = idx[t + 2];
          const x0 = U(a), y0 = V(a), x1 = U(b), y1 = V(b), x2 = U(c), y2 = V(c);
          const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
          if (Math.abs(area) < 1e-9) continue;
          const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 0.5)), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2) + 0.5));
          const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 0.5)), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2) + 0.5));
          // (a point counts when its middle is inside the triangle or less than half a point outside an edge:
          //  the edge values are distance x edge length)
          const s = area > 0 ? 1 : -1;
          const e0 = -0.5 * Math.hypot(x2 - x1, y2 - y1), e1 = -0.5 * Math.hypot(x0 - x2, y0 - y2), e2 = -0.5 * Math.hypot(x1 - x0, y1 - y0);
          for (let y = minY; y <= maxY; y++) {
            const cy = y + 0.5;
            for (let x = minX; x <= maxX; x++) {
              const cx = x + 0.5;
              const w0 = s * ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy));
              const w1 = s * ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy));
              const w2 = s * ((x0 - cx) * (y1 - cy) - (x1 - cx) * (y0 - cy));
              if (w0 >= e0 && w1 >= e1 && w2 >= e2) inside[y * W + x] = 1;
            }
          }
        }
        await breath();
        sharpenInside(px, W, H, inside, amount);
        await breath();
        padPieces(px, W, H, inside, 6);
        g2.putImageData(data, 0, 0);
        sharpened = true;
        if (map.isCanvasTexture && map.image === cv) {
          map.needsUpdate = true;
          map.userData.pgSharp = true;
        } else {
          // the sharpened picture takes the place of the old one (same settings)
          const tex = new THREE.CanvasTexture(cv);
          tex.colorSpace = map.colorSpace; tex.flipY = map.flipY;
          tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
          tex.minFilter = map.minFilter; tex.magFilter = map.magFilter; tex.generateMipmaps = map.generateMipmaps;
          tex.channel = map.channel;
          tex.offset.copy(map.offset); tex.repeat.copy(map.repeat); tex.rotation = map.rotation; tex.center.copy(map.center);
          tex.name = map.name;
          tex.userData = { ...map.userData, pgSharp: true };
          tex.needsUpdate = true;
          material.map = tex;
          material.needsUpdate = true;
          map.dispose();
        }
      }
    }
  }
  // 2. anisotropic filtering for all of the character's pictures (three.js keeps it within what the phone can do)
  for (const t of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
    if (t && t.anisotropy < 8) { t.anisotropy = 8; t.needsUpdate = true; }
  }

  return { eyes, sharpened };
}

// a short break: the game goes on for a moment (draws a picture) before the next step
const breath = () => new Promise((r) => setTimeout(r, 0));

// Unsharp mask on the brightness: px (RGBA bytes) is changed in place where inside[i] is 1. The blur only uses
// inside points (normalized), so the edges of the pieces of the picture get no halo from the empty space.
function sharpenInside(px, W, H, inside, amount) {
  const N = W * H, Y = new Float32Array(N), sum = new Float32Array(N), wt = new Float32Array(N);
  for (let i = 0; i < N; i++) if (inside[i]) Y[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
  // blur across (1 2 1), then down (1 2 1): weights sum up only where the points are inside
  const hs = new Float32Array(N), hw = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      if (!inside[i]) continue;
      let s = 2 * Y[i], w = 2;
      if (x > 0 && inside[i - 1]) { s += Y[i - 1]; w += 1; }
      if (x < W - 1 && inside[i + 1]) { s += Y[i + 1]; w += 1; }
      hs[i] = s; hw[i] = w;
    }
  }
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      if (!inside[i]) continue;
      let s = 2 * hs[i], w = 2 * hw[i];
      if (y > 0 && inside[i - W]) { s += hs[i - W]; w += hw[i - W]; }
      if (y < H - 1 && inside[i + W]) { s += hs[i + W]; w += hw[i + W]; }
      sum[i] = s; wt[i] = w;
    }
  }
  // (differences under 1.5 of 255 are compression noise: left alone; the change is limited, no harsh halos.
  //  Next to the edge of a piece - where the two sides of a seam meet on the model - it sharpens less, so seams
  //  do not stand out. A STRONG edge - a dark collar against the skin, the edge of a shirt - is sharp already: there
  //  the small picture's steps of single points would come out as a saw-tooth rim, bright on one side and dark on the
  //  other, that looks like a cut on the neck in a close-up. So strong edges get only a quarter of it.)
  const T = 1.5, LIM = 28;
  for (let i = 0; i < N; i++) {
    if (!inside[i] || !(wt[i] > 0)) continue;
    let d = Y[i] - sum[i] / wt[i];
    d = d > T ? d - T : d < -T ? d + T : 0;
    if (d === 0) continue;
    const full = wt[i] / 16, ad = d < 0 ? -d : d;
    const soft = ad <= 12 ? 1 : ad >= 40 ? 0.25 : 1 - 0.75 * ((ad - 12) / 28);
    let c = amount * d * full * full * soft;
    c = c > LIM ? LIM : c < -LIM ? -LIM : c;
    const o = i * 4;
    const r = px[o] + c, g = px[o + 1] + c, b = px[o + 2] + c;
    px[o] = r < 0 ? 0 : r > 255 ? 255 : r;
    px[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    px[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

// The empty space around each piece of the picture is filled with the colors of the piece's edge, a few points wide
// (rounds). The GPU blends neighboring points when it draws, and its smaller copies of the picture (for things far
// away) blend whole areas: without this, the dark empty space bleeds into the edges - thin dark lines along the seams
// of a model.
function padPieces(px, W, H, inside, rounds) {
  const filled = inside.slice();
  let front = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) continue;
      if ((x > 0 && filled[i - 1]) || (x < W - 1 && filled[i + 1]) || (y > 0 && filled[i - W]) || (y < H - 1 && filled[i + W])) front.push(i);
    }
  }
  for (let r = 0; r < rounds && front.length; r++) {
    const done = [];
    for (const i of front) {
      if (filled[i]) continue;
      const x = i % W, y = (i - x) / W;
      let n = 0, sr = 0, sg = 0, sb = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W || (!dx && !dy)) continue;
          const j = yy * W + xx;
          if (!filled[j]) continue;
          sr += px[j * 4]; sg += px[j * 4 + 1]; sb += px[j * 4 + 2]; n++;
        }
      }
      if (!n) continue;
      px[i * 4] = sr / n; px[i * 4 + 1] = sg / n; px[i * 4 + 2] = sb / n;
      done.push(i);
    }
    // (filled only after the round: the colors spread one point per round, evenly)
    for (const i of done) filled[i] = 1;
    const next = [];
    for (const i of done) {
      const x = i % W, y = (i - x) / W;
      if (x > 0 && !filled[i - 1]) next.push(i - 1);
      if (x < W - 1 && !filled[i + 1]) next.push(i + 1);
      if (y > 0 && !filled[i - W]) next.push(i - W);
      if (y < H - 1 && !filled[i + W]) next.push(i + W);
    }
    front = next;
  }
}

