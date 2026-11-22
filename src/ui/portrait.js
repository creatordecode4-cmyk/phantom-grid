// ---------------------------------------------------------------------------
// portrait.js - a picture of Nate's face, taken from the game's own model.
//
// The WANTED posters, the news screens and the news line on the HUD show the
// face of the player character. Nobody draws it: once the character is ready,
// a small camera looks at its head (only the character is drawn, on a plain
// grey background, with a soft light from the front) and the picture is
// copied into a canvas. Then it is made to look like a police photo: a little
// colder, harder contrast, fine lines.
//
// If something goes wrong (no model, no skeleton) null is returned and the
// posters keep their drawn outline of a head.
// ---------------------------------------------------------------------------

import * as THREE from 'three';

const LAYER = 7;                // a layer that nothing else of the game uses

// renderer, scene: the game's. who: { root (the character's object), head (its head bone), heading }
// Returns a canvas (256 x 320) or null.
export function takePortrait(renderer, scene, who, setFill = null) {
  if (!who || !who.root || !who.head) return null;
  const W = 256, H = 320;
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 0 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const meshes = [];
  const keep = { bg: scene.background, fog: scene.fog, target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  const cam = new THREE.PerspectiveCamera(20, W / H, 0.05, 10);
  const key = new THREE.DirectionalLight(0xffffff, 2.2), rim = new THREE.DirectionalLight(0xbcd2ff, 1.1), amb = new THREE.AmbientLight(0xffffff, 0.55);
  try {
    who.root.updateMatrixWorld(true);
    const head = new THREE.Vector3();
    who.head.getWorldPosition(head);
    // the face looks the way the character looks
    const fx = Math.sin(who.heading), fz = Math.cos(who.heading);
    const look = head.clone().add(new THREE.Vector3(0, 0.035, 0));
    cam.position.set(look.x + fx * 1.05, look.y + 0.02, look.z + fz * 1.05);
    cam.lookAt(look);
    cam.layers.set(LAYER);
    for (const l of [key, rim, amb]) { l.layers.set(LAYER); scene.add(l); }
    key.position.set(look.x + fx * 2 + fz * 1.2, look.y + 1.4, look.z + fz * 2 - fx * 1.2); key.target.position.copy(look); scene.add(key.target);
    rim.position.set(look.x - fx * 2 - fz * 1.5, look.y + 0.8, look.z - fz * 2 + fx * 1.5); rim.target.position.copy(look); scene.add(rim.target);
    who.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { meshes.push(o); o.layers.enable(LAYER); } });
    scene.background = null; scene.fog = null;
    if (setFill) setFill(0.12);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x6b7178, 1);
    renderer.clear();
    renderer.render(scene, cam);
    const px = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    // ---- into a canvas, upside up, made to look like an ID photo ----
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4;
        let r = px[i], gg = px[i + 1], b = px[i + 2];
        const l = 0.3 * r + 0.59 * gg + 0.11 * b;
        // (a little less color, a little more contrast, a cold tint)
        r = l + (r - l) * 0.55; gg = l + (gg - l) * 0.55; b = l + (b - l) * 0.55 + 8;
        const c = (v) => Math.max(0, Math.min(255, (v - 128) * 1.18 + 128));
        const line = y % 3 === 0 ? 0.93 : 1;
        img.data[o] = c(r) * line; img.data[o + 1] = c(gg) * line; img.data[o + 2] = c(b) * line; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // a soft dark edge
    const v = g.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H * 0.45, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // (a picture that is nearly all background means the head was not in it)
    let filled = 0;
    for (let i = 0; i < px.length; i += 4 * 37) if (Math.abs(px[i] - 0x6b) > 14 || Math.abs(px[i + 2] - 0x78) > 14) filled++;
    return filled > (W * H) / 37 * 0.08 ? cv : null;
  } catch (e) {
    console.warn('[portrait] no picture of the face:', e);
    return null;
  } finally {
    for (const o of meshes) o.layers.disable(LAYER);
    for (const l of [key, rim, amb]) scene.remove(l);
    scene.remove(key.target, rim.target);
    scene.background = keep.bg; scene.fog = keep.fog;
    renderer.setRenderTarget(keep.target);
    renderer.setClearColor(keep.clear, keep.alpha);
    rt.dispose();
  }
}
