// ---------------------------------------------------------------------------
// minimap.js - the small map in the top-right corner.
//
// The whole city is drawn ONCE into a hidden picture, straight from the
// layout data (blocks, roads, beach, ocean, highway, rail line).
// Every few frames we copy the part around the player onto the screen and
// draw the player arrow on top. North is always up.
// ---------------------------------------------------------------------------

const SCALE = 0.5;   // pixels per meter in the hidden picture
const VIEW = 0.62;   // screen pixels per meter in the minimap (zoom)

export function createMinimap(canvas, layout) {
  const L = layout;
  // area covered by the hidden picture
  const minX = L.city.minX - 60, maxX = L.city.maxX + 60;
  const minZ = L.beach.minZ - 60, maxZ = L.city.maxZ + 60;
  const W = Math.ceil((maxX - minX) * SCALE), H = Math.ceil((maxZ - minZ) * SCALE);
  // world -> picture. East (-x) is on the right, north (+z) is at the top.
  const PX = (x) => (maxX - x) * SCALE;
  const PY = (z) => (maxZ - z) * SCALE;

  const map = document.createElement('canvas');
  map.width = W;
  map.height = H;
  const g = map.getContext('2d');

  // roads: everything starts as "road" color, then we draw the rest on top
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, W, H);
  // ocean and beach
  g.fillStyle = '#1f4254';
  g.fillRect(0, PY(L.beach.minZ), W, H - PY(L.beach.minZ));
  g.fillStyle = '#8a7f66';
  g.fillRect(0, PY(L.beach.maxZ), W, PY(L.beach.minZ) - PY(L.beach.maxZ));
  // beach walk
  g.fillStyle = '#5a5d60';
  g.fillRect(0, PY(L.neon.promenadeMaxZ), W, PY(L.neon.promenadeMinZ) - PY(L.neon.promenadeMaxZ));
  // blocks (the diagonal avenue is simply the gap between the cut blocks)
  for (const b of L.blocks) {
    g.fillStyle = !b.playable ? '#1b1d21' : b.district === 'neon' ? '#2c2531' : '#202327';
    g.beginPath();
    b.poly.forEach((p, i) => (i === 0 ? g.moveTo(PX(p.x), PY(p.z)) : g.lineTo(PX(p.x), PY(p.z))));
    g.closePath();
    g.fill();
  }
  // alleys are narrow roads
  g.fillStyle = '#303338';
  for (const a of L.alleyRects) g.fillRect(PX(a.maxX), PY(a.maxZ), (a.maxX - a.minX) * SCALE, (a.maxZ - a.minZ) * SCALE);
  // median of Neon Mile
  g.fillStyle = '#35523f';
  for (const [x0, x1] of L.medianPieces) g.fillRect(PX(x1), PY(L.median.maxZ), (x1 - x0) * SCALE, Math.max(1.5, (L.median.maxZ - L.median.minZ) * SCALE));
  // light-rail line
  g.strokeStyle = '#3fb8a8';
  g.lineWidth = 1.6;
  g.setLineDash([5, 3]);
  g.beginPath();
  g.moveTo(PX(L.rail.x), PY(L.rail.southEndZ));
  g.lineTo(PX(L.rail.x), PY(maxZ));
  g.stroke();
  g.setLineDash([]);
  // highway
  g.fillStyle = '#6a6e75';
  g.fillRect(PX(L.highway.maxX), 0, L.highway.width * SCALE, PY(L.highway.rampBottomZ));
  g.strokeStyle = '#8d9199';
  g.lineWidth = 1;
  g.strokeRect(PX(L.highway.maxX) + 0.5, -1, L.highway.width * SCALE - 1, PY(L.highway.rampBottomZ) + 1);
  // edge of the play area
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1;
  const B = L.bounds;
  g.strokeRect(PX(B.maxX), PY(B.maxZ), (B.maxX - B.minX) * SCALE, (B.maxZ - B.minZ) * SCALE);

  const ctx = canvas.getContext('2d');
  let size = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth || 120;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  resize();

  // Draw the minimap. heading: the player's angle (0 = north).
  function draw(x, z, heading) {
    const s = size * dpr;
    const zoom = (VIEW / SCALE) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    // round window
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#16181b';
    ctx.fillRect(0, 0, s, s);
    ctx.imageSmoothingEnabled = true;
    ctx.translate(s / 2, s / 2);
    ctx.scale(zoom, zoom);
    ctx.drawImage(map, -PX(x), -PY(z));
    ctx.restore();

    // player arrow in the middle (turned to the walking direction)
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(-heading);
    const a = 6.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, -a * 1.25);
    ctx.lineTo(a * 0.8, a * 0.9);
    ctx.lineTo(0, a * 0.45);
    ctx.lineTo(-a * 0.8, a * 0.9);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
    ctx.fill();
    ctx.restore();

    // thin ring and a small "N"
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 0.75 * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(9 * dpr)}px "Helvetica Neue", Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', s / 2, 4 * dpr);
  }

  return { draw, resize };
}
