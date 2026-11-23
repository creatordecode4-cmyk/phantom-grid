// ---------------------------------------------------------------------------
// roadSense.js - what a computer driver (a Guard car, a pursuer of the story) sees on the road.
//
// The GPS line runs down the MIDDLE of every street, and the traffic drives
// 1.75 m to each side of it. A car that followed the GPS line exactly would
// scrape every car coming the other way and every car in front - now that cars
// really hit each other. So these drivers:
//   * keep to the right half of the street (keepRight), like everybody else;
//   * look at the road in front (roadAhead): the traffic, the police, the story
//     cars, parked cars - and slow down behind what is there. With the siren on,
//     the traffic pulls over to the right (traffic.js) and the way gets free;
//   * stop a few meters behind a car that stands still (stopGap), and drive
//     round it (goRound) on the other side of the street, instead of waiting
//     behind it for ever.
// ---------------------------------------------------------------------------

// A place to drive to (ax, az), seen from (x, z): moved "lane" meters to the right of that direction.
// (In the game a car facing +z has its right side toward -x: the right of a direction (dx, dz) is (-dz, dx).)
export function keepRight(x, z, ax, az, lane = 1.75) {
  const dx = ax - x, dz = az - z, l = Math.hypot(dx, dz) || 1;
  return { x: ax - (dz / l) * lane, z: az + (dx / l) * lane };
}

// How far the right lane is from the GPS line at (x, z): 1.75 m on the streets; on the Neon Mile the palm strip is
// in the middle, its lanes lie further out. layout: from layout.js (its "traffic" part has the lanes).
export function laneOffset(layout, x, z) {
  const T = layout && layout.traffic;
  if (!T) return 1.75;
  const N = T.neon;
  if (N && Math.abs(z - N.center) < 8) return Math.abs(N.laneWest - N.center);
  // (the street under the raised rail line has the pillars in its middle: a car keeps a little further out, it
  //  does not scrape them - and still passes a car pulled over to the curb for a siren: 20 cm on both sides)
  const R = layout.rail;
  if (R && Math.abs(x - R.x) < 6 && z > R.southEndZ - 6 && z < R.northEndZ + 6) return (T.laneOffset || 1.75) + 0.2;
  return T.laneOffset || 1.75;
}

// What is in front of "car" on its line, up to "range" meters: { gap: free meters to it (Infinity: nothing),
// speed: how fast it goes the same way (m/s), obj: the thing itself (a traffic car or a vehicle), lat: how far it
// stands to the left of the line (meters, below 0: to the right), traffic: true for a traffic car }.
// traffic: the traffic cars (traffic.js), live: the real vehicles. skip: a vehicle not to count, or a list of them
// (the player's car in a chase - the chase itself decides about it - and the car being driven round).
const out = { gap: Infinity, speed: 0, obj: null, lat: 0, traffic: false };
export function roadAhead(car, traffic, live, range = 32, skip = null) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading), half = car.info && car.info.length ? car.info.length / 2 : 2.4;
  const many = Array.isArray(skip);
  const skipped = (q) => (many ? skip.includes(q) : q === skip);
  out.gap = Infinity; out.speed = 0; out.obj = null; out.lat = 0; out.traffic = false;
  const look = (obj, isTraffic, x, z, len, vx, vz) => {
    const ax = x - car.x, az = z - car.z, along = ax * fx + az * fz;
    if (along <= 0 || along > range) return;
    const lat = ax * fz - az * fx;                                   // (+: to the left of my line)
    if (Math.abs(lat) > 1.9) return;                                 // (not on my line: it can be passed)
    const gap = along - half - len;
    if (gap < out.gap) { out.gap = gap; out.speed = Math.max(0, vx * fx + vz * fz); out.obj = obj; out.lat = lat; out.traffic = isTraffic; }
  };
  if (traffic) for (const t of traffic) if (t.alive && !skipped(t)) look(t, true, t.wx, t.wz, 2.45, Math.sin(t.heading) * t.v, Math.cos(t.heading) * t.v);
  if (live) for (const q of live) {
    if (q === car || skipped(q) || q.away || q.ghost || q.role === 'boat' || q.role === 'drone' || !q.circles) continue;
    look(q, false, q.x, q.z, q.info && q.info.length ? q.info.length / 2 : 2.3, q.vx || 0, q.vz || 0);
  }
  return out;
}

// Where a traffic car (wx, wz) or a vehicle (x, z) is, and how fast it moves (m/s).
const posX = (o) => (o.wx !== undefined ? o.wx : o.x);
const posZ = (o) => (o.wz !== undefined ? o.wz : o.z);
const speedOf = (o) => (o.wx !== undefined ? Math.abs(o.v || 0) : Math.hypot(o.vx || 0, o.vz || 0));

// How far behind a car a computer driver stops (free meters between the two): behind a car that stands still a
// few meters - room to go round it, like a real driver leaves - and behind a moving one close.
export const stopGap = (ra) => (ra.speed < 1 ? 4.5 : 1.2);

// A car standing still in the way - a parked car, a car left on the road, the player's car while the Guard only
// searches - is driven round on the other side of the street, the way a real driver does it, instead of waiting
// behind it for ever (now that cars do not pass through each other). A traffic car standing in a queue is waited
// for 3 seconds first. The way round is a smooth curve: out to the side before the noses meet, along the car,
// then back to the lane; a driver that stands too close behind it first backs up a little. Like a real driver it
// only goes when the way round is free: no post, wall or tree on it (the pillars in the middle of the street under
// the raised line), no car on it or coming along it - else it tries the other side, or waits and looks again.
// pass: the driver's own memory of it (start with {}); ra: what roadAhead saw this frame; colliders: the city's
// collision shapes (city.colliders), traffic and live: the traffic cars and the real vehicles. Returns the place to
// aim at while going round, or null (drive on as usual); pass.speed is the speed for it (below 0: back up). While
// pass.obj is set, that car is not counted by roadAhead (give it in the skip list).
const CLEAR = 3.4;          // meters from the middle line of the standing car to the middle of the one going round it
const LOOK = 4;             // the driver aims this far ahead on the curve
const R_WAY = 1.25;         // half the width of the way that must be free (half a car and a little)

// how far to the side the way round is at "a" (meters along it from the standing car's middle; below 0: behind it)
function sideAt(pass, a) {
  if (a < pass.aFull) {
    const u = Math.min(1, Math.max(0, (a - pass.a0) / Math.max(1, pass.aFull - pass.a0)));
    return pass.s0 + (CLEAR - pass.s0) * u * u * (3 - 2 * u);
  }
  if (a <= pass.aEnd) return CLEAR;
  return CLEAR + (pass.s0 - CLEAR) * Math.min(1, (a - pass.aEnd) / 12);    // (back to the lane)
}

// half the length of a traffic car or a vehicle
const halfLen = (o) => (o.wx !== undefined ? 2.45 : o.info && o.info.length ? o.info.length / 2 : 2.3);

// the plan for going round "o" on side sd (+1: its left, -1: its right) - see goRound. Cars that stand in a row in
// front of it (a queue, a car parked right in front of another) are gone round in the same go: the way back to the
// lane starts after the last of them.
function plan(pass, car, o, sd, traffic, live) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const half = car.info && car.info.length ? car.info.length / 2 : 2.4;
  const ox = posX(o), oz = posZ(o), dx = car.x - ox, dz = car.z - oz;
  pass.fx = fx; pass.fz = fz; pass.lx = fz * sd; pass.lz = -fx * sd;
  pass.aFull = -(halfLen(o) + half + 0.3);             // (out at the side when its nose reaches the other's back)
  pass.aEnd = halfLen(o) + half + 1.5;                 // (past it: back to the lane)
  const inRow = (q, qx, qz) => {
    if (q === o || q === car || speedOf(q) > 1) return;
    const qa = (qx - ox) * fx + (qz - oz) * fz, ql = (qx - ox) * pass.lx + (qz - oz) * pass.lz;
    if (qa > 0 && qa < pass.aEnd + 10 && Math.abs(ql) < 1.9) pass.aEnd = Math.max(pass.aEnd, qa + halfLen(q) + half + 1.5);
  };
  for (let k = 0, before = -1; k < 4 && pass.aEnd !== before; k++) {
    before = pass.aEnd;
    if (traffic) for (const t of traffic) if (t.alive) inRow(t, t.wx, t.wz);
    if (live) for (const q of live) if (!q.away && !q.ghost && q.circles && q.role !== 'boat' && q.role !== 'drone') inRow(q, q.x, q.z);
  }
  const a = dx * fx + dz * fz;
  pass.rev = Math.max(0, 4 - (pass.aFull - a));        // (meters to back up first: 4 m of curve at least)
  pass.a0 = a - pass.rev;                              // (where the curve starts)
  pass.s0 = Math.min(CLEAR, Math.max(0, dx * pass.lx + dz * pass.lz));
}

// Is that way round free? No box or post a car would hit on it, no other car on it now or in 2 or 4 seconds.
function wayFree(pass, o, car, colliders, traffic, live) {
  const ox = posX(o), oz = posZ(o);
  if (colliders) for (let a = pass.a0 + 2; a <= pass.aEnd + 12; a += 1.5) {
    const s = sideAt(pass, a), x = ox + pass.fx * a + pass.lx * s, z = oz + pass.fz * a + pass.lz * s;
    const cell = colliders.near(x, z);
    for (const b of cell.boxes) if (b.h >= 0.3 && x > b.minX - R_WAY && x < b.maxX + R_WAY && z > b.minZ - R_WAY && z < b.maxZ + R_WAY) return false;
    for (const c of cell.circles) if (!c.veh && !c.car && Math.hypot(c.x - x, c.z - z) < c.r + R_WAY) return false;
    for (const c of colliders.dynamic || []) if (!c.veh && !c.car && Math.hypot(c.x - x, c.z - z) < c.r + R_WAY) return false;
  }
  const onWay = (x, z, vx, vz) => {
    for (let k = 0; k <= 4; k += 2) {
      const px = x + vx * k - ox, pz = z + vz * k - oz, a = px * pass.fx + pz * pass.fz;
      if (a > pass.a0 - 2 && a < pass.aEnd + 12 && Math.abs(px * pass.lx + pz * pass.lz - sideAt(pass, a)) < 2.6) return true;
    }
    return false;
  };
  if (traffic) for (const t of traffic) if (t.alive && t !== o && onWay(t.wx, t.wz, Math.sin(t.heading) * t.v, Math.cos(t.heading) * t.v)) return false;
  if (live) for (const q of live) {
    if (q === o || q === car || q.away || q.ghost || !q.circles || q.role === 'boat' || q.role === 'drone') continue;
    if (onWay(q.x, q.z, q.vx || 0, q.vz || 0)) return false;
  }
  return true;
}

export function goRound(pass, car, ra, dt, colliders = null, traffic = null, live = null) {
  if (pass.obj) {
    const o = pass.obj, ox = posX(o), oz = posZ(o);
    const a = (car.x - ox) * pass.fx + (car.z - oz) * pass.fz;      // where the car is along the way (below 0: behind it)
    pass.t -= dt;
    // (done: back in the lane past it - or it drives off, is gone, or this takes too long)
    if (a > pass.aEnd + 8 || pass.t <= 0 || o.alive === false || o.away || (o.group && !o.group.parent) || speedOf(o) > 3) pass.obj = null;
    else {
      if (pass.rev > 0) {
        // too close behind it to swing out: back up a little first, straight
        pass.rev -= dt * 3; pass.a0 = a; pass.speed = -3;
        return { x: car.x + pass.fx * 8, z: car.z + pass.fz * 8 };
      }
      // along the way round: out to the side (CLEAR) just before the noses meet, along the car, back to the lane
      const side = sideAt(pass, a + LOOK);
      pass.speed = a < pass.aFull ? (pass.aFull - pass.a0 < 8 ? 4 : 7) : 8;
      return { x: ox + pass.fx * (a + LOOK) + pass.lx * side, z: oz + pass.fz * (a + LOOK) + pass.lz * side };
    }
  }
  if (ra.obj && ra.gap < 14 && ra.speed < 1 && speedOf(ra.obj) < 1) {
    pass.wait = (pass.wait || 0) + dt;
    pass.look = (pass.look || 0) - dt;
    if ((!ra.traffic || pass.wait > 3) && pass.look <= 0) {
      // round its left side (where the other lane is) - unless it stands to the left of my line; else the other side
      const o = ra.obj, first = ra.lat > 0.5 ? -1 : 1;
      for (const sd of [first, -first]) {
        plan(pass, car, o, sd, traffic, live);
        if (wayFree(pass, o, car, colliders, traffic, live)) { pass.obj = o; pass.t = 8; pass.wait = 0; return goRound(pass, car, ra, 0); }
      }
      pass.look = 0.5;              // (no way round just now - a post, a wall, a car coming: look again in a moment)
    }
  } else { pass.wait = 0; pass.look = 0; }
  return null;
}
