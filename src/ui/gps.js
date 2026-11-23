// ---------------------------------------------------------------------------
// gps.js - finds a way along the roads from one place to another.
//
// The road network is simple: north-south streets, east-west streets and
// Neon Mile. Where two of them meet there is a "node". The route is the
// shortest chain of nodes (found with Dijkstra's method), with a first piece
// from where you are to the nearest road, and a last piece to the goal.
//
// AVOID: some places can be marked "go around if you can" (the scanner gates
// of the Meridian Guard, Chapter 2). A piece of road with such a place on it
// counts as much longer, so the route takes the side streets instead.
// ---------------------------------------------------------------------------

export function createGPS(layout) {
  const T = layout.traffic;
  const zSouth = T.neon.center;
  // every road as a straight line: { axis, c (its fixed coordinate), nodes sorted along it }
  const roads = [];
  const nodes = [];
  const node = (x, z) => { const n = { x, z, id: nodes.length, links: [] }; nodes.push(n); return n; };
  const grid = T.ns.map((ns) => [node(ns.center, zSouth), ...T.ew.map((ew) => node(ns.center, ew.center))]);
  T.ns.forEach((ns, i) => roads.push({ axis: 'ns', c: ns.center, nodes: grid[i] }));
  T.ew.forEach((ew, j) => roads.push({ axis: 'ew', c: ew.center, nodes: grid.map((col) => col[j + 1]) }));
  roads.push({ axis: 'ew', c: zSouth, nodes: grid.map((col) => col[0]) });
  // Chapter 5: Neon Mile goes on east as Dock Road, into Rustwater Docks (one more node at its far end)
  if (layout.docks) roads[roads.length - 1].nodes.push(node(layout.docks.road.minX + 8, zSouth));
  const along = (road, n) => (road.axis === 'ns' ? n.z : n.x);
  for (const road of roads) {
    road.nodes.sort((a, b) => along(road, a) - along(road, b));
    for (let i = 0; i < road.nodes.length - 1; i++) {
      const a = road.nodes[i], b = road.nodes[i + 1], d = Math.hypot(a.x - b.x, a.z - b.z);
      a.links.push({ to: b, d }); b.links.push({ to: a, d });
    }
  }

  // the nearest point on any road, and the two nodes next to it
  function snap(x, z) {
    let best = null;
    for (const road of roads) {
      const t = road.axis === 'ns' ? z : x, first = along(road, road.nodes[0]), last = along(road, road.nodes[road.nodes.length - 1]);
      const tc = Math.min(last, Math.max(first, t));
      const px = road.axis === 'ns' ? road.c : tc, pz = road.axis === 'ns' ? tc : road.c;
      const d = Math.hypot(px - x, pz - z);
      if (best && d >= best.d) continue;
      let i = 0;
      while (i < road.nodes.length - 2 && along(road, road.nodes[i + 1]) < tc) i++;
      best = { d, x: px, z: pz, road, a: road.nodes[i], b: road.nodes[i + 1] };
    }
    return best;
  }

  // ---- places to go around: every link with such a place on it gets a penalty ----
  const AVOID_COST = 900;                  // meters added to a link with a scanner gate on it
  function setAvoid(points) {
    for (const n of nodes) for (const l of n.links) l.avoid = false;
    for (const p of points || []) {
      for (const n of nodes) for (const l of n.links) {
        const a = n, b = l.to;
        // is p on the straight piece of road from a to b?
        const onNS = a.x === b.x && Math.abs(p.x - a.x) < 4 && p.z > Math.min(a.z, b.z) && p.z < Math.max(a.z, b.z);
        const onEW = a.z === b.z && Math.abs(p.z - a.z) < 4 && p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x);
        if (onNS || onEW) l.avoid = true;
      }
    }
  }

  // an AREA to go around (where the Guard is searching): { x, z, r } or null. A link that runs through it counts
  // as longer, the deeper it goes in: the yellow line leaves the area the short way and then goes around it.
  let area = null;
  function setAvoidArea(a) { area = a ? { x: a.x, z: a.z, r: a.r } : null; }
  function areaCost(a, b) {
    if (!area) return 0;
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((area.x - a.x) * dx + (area.z - a.z) * dz) / L2));
    const d = Math.hypot(a.x + dx * t - area.x, a.z + dz * t - area.z);
    return d < area.r ? 420 * (1 - d / area.r) : 0;
  }

  // Returns a list of points [{x, z}, ...] from (x0, z0) to (x1, z1).
  // opts.ignoreAvoid: take the shortest way even through the places to avoid (the Guard does not hide from its own gates)
  function route(x0, z0, x1, z1, opts = {}) {
    const avoid = !opts.ignoreAvoid;
    const S = snap(x0, z0), E = snap(x1, z1);
    const startPts = [{ x: x0, z: z0 }, { x: S.x, z: S.z }], endPts = [{ x: E.x, z: E.z }, { x: x1, z: z1 }];
    // both on the same piece of road: just go there
    if (S.road === E.road && ((S.a === E.a && S.b === E.b))) return [...startPts, ...endPts];
    const dist = new Array(nodes.length).fill(Infinity), prev = new Array(nodes.length).fill(null), done = new Array(nodes.length).fill(false);
    for (const n of [S.a, S.b]) dist[n.id] = Math.hypot(n.x - S.x, n.z - S.z);
    for (;;) {
      let u = null;
      for (const n of nodes) if (!done[n.id] && dist[n.id] < Infinity && (!u || dist[n.id] < dist[u.id])) u = n;
      if (!u) break;
      done[u.id] = true;
      for (const l of u.links) {
        const nd = dist[u.id] + l.d + (avoid ? (l.avoid ? AVOID_COST : 0) + areaCost(u, l.to) : 0);
        if (nd < dist[l.to.id]) { dist[l.to.id] = nd; prev[l.to.id] = u; }
      }
    }
    const endA = dist[E.a.id] + Math.hypot(E.a.x - E.x, E.a.z - E.z), endB = dist[E.b.id] + Math.hypot(E.b.x - E.x, E.b.z - E.z);
    const mid = [];
    for (let n = endA <= endB ? E.a : E.b; n; n = prev[n.id]) mid.unshift({ x: n.x, z: n.z });
    return [...startPts, ...mid, ...endPts];
  }

  // total length of a route in meters
  const length = (pts) => { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return d; };
  // the point "ahead" meters along the route (where the arrow at the top points to)
  function pointAhead(pts, ahead) {
    let left = ahead;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      if (d >= left && d > 0) { const t = left / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t }; }
      left -= d;
    }
    return pts[pts.length - 1];
  }

  return { route, length, pointAhead, snap, setAvoid, setAvoidArea };
}
