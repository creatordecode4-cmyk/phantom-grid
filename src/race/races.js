// ---------------------------------------------------------------------------
// races.js - THE RACES (data only; raceManager.js runs them).
//
//   route      points in the middle of the road, in driving order: [x, z, halfWidth?]
//              (halfWidth: how far a car may go to each side - a street is 14 m wide, so 7; one half of
//              Neon Mile next to the palm strip 5.5). The racing line is worked out from it (raceLine.js).
//   laps       1 = a sprint from the start to the finish; more = a lap race (the route is a loop)
//   startS     where the start line is (meters along the route; the grid stands behind it)
//   need       the place the player must reach (default: not last). timeLimit: seconds (0 = none)
//   rivals     the five other drivers: { id, name (text key), kind, or (if that model is missing), color,
//              tint, label, skill 0..1, aggression 0..1, lane (m left of the racing line), nitro, push,
//              type: { topSpeed, accel, grip ... } (a tuned car), dot (color on the minimap) }
//   crowds     spectators: { a: [x, z], b: [x, z], n, face: compass degrees (where they look), clear, go, flare }
//              (clear: they stand ON the road and step back by "go" [dx, dz] when the cars come;
//               flare: a red flare burns at the start of the group, its smoke drifts over the people)
//   jumps      ramps: { at: [x, z], face: compass degrees (the way the cars jump), len, h, w, kick }
//   noGates    stretches without checkpoints: [[x, z], [x, z]] (from, to) - a shortcut is allowed there
//   shortcut   { a: [x, z], b: [x, z], w, damage, event } a risky way round (the final race)
//   lastTurn   the final race: { from, to, line: Theo's line [[x, z] ...], width, minKmh, brakeAt, brakeKmh,
//              restartAt, restartKmh, clock } - the last turn of the last lap is only won on Theo's line
//
// Map: +z north, -z south (the sea), +x WEST, -x east. Neon Mile: north half z -390..-379 (cars going west),
// south half z -405..-394 (going east), a palm strip between with gaps at every street.
// Streets north-south at x = -383, -289, -195, -101, -7, 87, 181, 275, 369; east-west at z = -312, -198, -84, 30.
// Ironhill Highway: x -498..-472, the ramp from z -376 (ground) up to -236 (8 m).
// ---------------------------------------------------------------------------

const NM_N = -384.5, NM_S = -399.5;     // the middle of the north and the south half of Neon Mile

// the cars of the street racers (tuned versions of the cars of the city). Every rival drives one of the model
// cars (small_city_car, tech_patrol_car; Dante the chrome_supercar): they have a light version for when they are
// not right next to the player, so a pack of six stays cheap to draw. 'or' is only used when a model is missing.
const TUNED_CITY = { topSpeed: 176, accel: 8.6, grip: 1.04 };
const TUNED_PATROL = { topSpeed: 204, accel: 9.4, grip: 1.1 };
const WOLF_CAR = { topSpeed: 210, accel: 9.9, grip: 1.12 };

export const RACES = {
  // ======================================================================= 1. a sprint (3 minutes on the clock)
  q1: {
    title: 'race.q1', laps: 1, timeLimit: 180, startS: 0, need: 5,
    route: [
      [-360, NM_N, 5.5], [-30, NM_N, 5.5], [-7, NM_N, 7], [-7, 30, 7], [275, 30, 7], [275, -198, 7], [369, -198, 7], [369, NM_S, 7], [340, NM_S, 5.5], [200, NM_S, 5.5],
    ],
    rivals: [
      { id: 'q1a', name: 'race.r.vee', kind: 'small_city_car', or: 'sedan', color: [0.78, 0.36, 0.08], skill: 0.55, aggression: 0.2, lane: 1.2, type: TUNED_CITY, dot: '#ff9a4a' },
      { id: 'q1b', name: 'race.r.oslo', kind: 'tech_patrol_car', or: 'sedan', color: [0.16, 0.2, 0.26], skill: 0.62, aggression: 0.3, lane: -1.2, type: TUNED_PATROL, nitro: true, dot: '#7fb4ff' },
      { id: 'q1c', name: 'race.r.marisol', kind: 'tech_patrol_car', or: 'sedan', color: [0.55, 0.06, 0.08], skill: 0.58, aggression: 0.35, lane: 0.6, type: { topSpeed: 190, accel: 9.0, grip: 1.08 }, dot: '#ff6b5a' },
      { id: 'q1d', name: 'race.r.tam', kind: 'small_city_car', or: 'sedan', color: [0.82, 0.82, 0.8], skill: 0.5, aggression: 0.15, lane: -0.6, type: { topSpeed: 182, accel: 8.4, grip: 1.02 }, dot: '#e8e8e8' },
      { id: 'q1e', name: 'race.r.kuro', kind: 'small_city_car', or: 'sedan', color: [0.08, 0.3, 0.22], skill: 0.6, aggression: 0.25, lane: 1.8, type: TUNED_CITY, dot: '#5fe0a0' },
    ],
    crowds: [
      { a: [-372, -376.5], b: [-330, -376.5], n: 34, face: 180, flare: true },
      { a: [150, -407.5], b: [240, -407.5], n: 46, face: 0, flare: true },
      { a: [-12, -368], b: [-12, -340], n: 14, face: 270 },
      { a: [262, 37.5], b: [290, 37.5], n: 12, face: 180 },
    ],
  },

  // ======================================================================= 2. laps in the rain: a hairpin, a bridge jump
  q2: {
    title: 'race.q2', laps: 3, startS: 0, need: 5,
    route: [
      // (not down the street of the maglev line, x 87: its pillars stand in the middle of that road)
      [150, NM_S, 5.5], [-90, NM_S, 5.5], [-101, NM_S, 7], [-101, -198, 7], [181, -198, 7], [181, NM_N, 7],
      [262, NM_N, 5.5], [277, -386.5, 6], [280.5, -392, 5], [277, -397.5, 6], [262, NM_S, 5.5],
    ],
    // the bridge: steel ramps over the old drain cut on the street north of Neon Mile
    jumps: [{ at: [-101, -282], face: 0, len: 6, h: 0.75, w: 6.6, kick: 0.2 }],
    rivals: [
      { id: 'q2a', name: 'race.r.oslo', kind: 'tech_patrol_car', or: 'sedan', color: [0.16, 0.2, 0.26], skill: 0.66, aggression: 0.35, lane: -1.2, type: TUNED_PATROL, nitro: true, dot: '#7fb4ff' },
      { id: 'q2b', name: 'race.r.marisol', kind: 'tech_patrol_car', or: 'sedan', color: [0.55, 0.06, 0.08], skill: 0.64, aggression: 0.4, lane: 0.8, type: { topSpeed: 192, accel: 9.2, grip: 1.08 }, dot: '#ff6b5a' },
      { id: 'q2c', name: 'race.r.vee', kind: 'small_city_car', or: 'sedan', color: [0.78, 0.36, 0.08], skill: 0.6, aggression: 0.25, lane: 1.5, type: TUNED_CITY, dot: '#ff9a4a' },
      { id: 'q2d', name: 'race.r.kuro', kind: 'small_city_car', or: 'sedan', color: [0.08, 0.3, 0.22], skill: 0.62, aggression: 0.3, lane: -1.8, type: TUNED_CITY, dot: '#5fe0a0' },
      { id: 'q2e', name: 'race.r.ash', kind: 'small_city_car', or: 'sedan', color: [0.3, 0.3, 0.33], skill: 0.58, aggression: 0.2, lane: 0, type: { topSpeed: 184, accel: 8.6, grip: 1.03 }, dot: '#b8b8c0' },
    ],
    crowds: [
      { a: [110, -407.5], b: [200, -407.5], n: 40, face: 0, flare: true },
      { a: [258, -376.5], b: [292, -376.5], n: 18, face: 180, flare: true },
      { a: [-109.5, -300], b: [-109.5, -262], n: 18, face: 270 },
      { a: [-92.5, -300], b: [-92.5, -262], n: 14, face: 90 },
    ],
  },

  // ======================================================================= 3. the night market: people on the road, a crew car that pushes
  q3: {
    title: 'race.q3', laps: 4, startS: 0, need: 1, people: 60,     // (a short loop of 600 m: four laps)
    route: [
      // (the loop turns south at x -7: the street at x 87 has the pillars of the maglev line in the middle)
      [-195, -150, 7], [-195, -84, 7], [-7, -84, 7], [-7, -198, 7], [-195, -198, 7],
    ],
    rivals: [
      { id: 'crew', name: 'race.r.crew', kind: 'tech_patrol_car', or: 'sedan', color: [0.06, 0.065, 0.075], tint: null, skill: 0.74, aggression: 0.95, push: true, lane: 0.5, type: WOLF_CAR, nitro: true, dot: '#c9d2dc' },
      { id: 'q3b', name: 'race.r.oslo', kind: 'tech_patrol_car', or: 'sedan', color: [0.16, 0.2, 0.26], skill: 0.68, aggression: 0.35, lane: -1.2, type: TUNED_PATROL, nitro: true, dot: '#7fb4ff' },
      { id: 'q3c', name: 'race.r.marisol', kind: 'tech_patrol_car', or: 'sedan', color: [0.55, 0.06, 0.08], skill: 0.66, aggression: 0.45, lane: 1.0, type: { topSpeed: 194, accel: 9.3, grip: 1.09 }, dot: '#ff6b5a' },
      { id: 'q3d', name: 'race.r.vee', kind: 'small_city_car', or: 'sedan', color: [0.78, 0.36, 0.08], skill: 0.62, aggression: 0.25, lane: 1.8, type: TUNED_CITY, dot: '#ff9a4a' },
      { id: 'q3e', name: 'race.r.kuro', kind: 'small_city_car', or: 'sedan', color: [0.08, 0.3, 0.22], skill: 0.64, aggression: 0.3, lane: -1.8, type: TUNED_CITY, dot: '#5fe0a0' },
    ],
    crowds: [
      // the market: people on both sidewalks, and small groups ON the road that step back when the cars come
      { a: [-170, -74.5], b: [20, -74.5], n: 56, face: 180, flare: true },
      { a: [-170, -93.5], b: [-16, -93.5], n: 46, face: 0 },
      // (z -91..-77 is the road: these step back onto the sidewalks, north or south)
      { a: [-120, -86], b: [-110, -82], n: 6, clear: true, go: [0, 9.5], face: 90 },
      { a: [-50, -82], b: [-40, -86], n: 6, clear: true, go: [0, -9.5], face: 270 },
      { a: [-82, -86], b: [-74, -82], n: 5, clear: true, go: [0, 9.5], face: 90 },
      { a: [-203.5, -165], b: [-203.5, -130], n: 16, face: 270 },
    ],
  },

  // ======================================================================= THE FINAL: Ironhill Night Run (2 laps)
  // north up the street at the lights, east, south, onto Neon Mile, UP the ramp, north on the highway, round
  // at the top, south again, DOWN the ramp, west on Neon Mile ... and right at the lights: the turn of the
  // prologue (the same rain, the same rail, the same half second).
  final: {
    title: 'race.final', laps: 2, startS: 0, need: 1, gateEvery: 100,
    route: [
      [-7, -330, 7], [-7, -198, 7], [-383, -198, 7], [-383, NM_S, 7], [-470, NM_S, 5.5], [-488, NM_S, 6],
      [-491.5, -378, 6], [-491.5, -236, 6], [-491.5, 318, 6],
      // the hairpin at the top of the highway (the whole width)
      [-490, 334, 6], [-485, 339, 6.5], [-480, 334, 6], [-478.5, 318, 6],
      [-478.5, -236, 6], [-478.5, -366, 6], [-475.5, -378, 6], [-468, -385, 5.5], [-450, -386, 5],
      [-60, -386, 5], [-30, -385.5, 5.5], [-17, -381, 7], [-10, -371, 7], [-7, -356, 7],
    ],
    // the risky way: the old diagonal avenue from the street to Neon Mile (no checkpoints between)
    // (from where the diagonal leaves the street to just past the corner where it meets the route again on the
    //  south half of Neon Mile - the end point must lie on that part of the route, not on the way back)
    noGates: [[[-163, -198], [-400, NM_S]]],
    shortcut: { a: [-170, -205], b: [-336, -386], w: 10, damage: 0.18, event: 'shortcut' },
    lastTurn: {
      from: [-120, -386], to: [-7, -342],
      // THEO'S LINE: wide by the palm strip, brake late, turn in late, the inside corner, out wide
      line: [[-120, -388.6], [-60, -388.6], [-34, -388.2], [-23, -386.4], [-15.5, -381.4], [-11.2, -374.4], [-7.6, -365], [-5.2, -352], [-5, -342]],
      // (in the rain the car stops about 7 m/s every second at best: braking at the mark with 75 km/h still makes
      //  the corner on this line; braking earlier or slower is "too careful", missing the line is "too wide")
      width: 2.4, minKmh: 100, brakeAt: [-55, -388.6], brakeKmh: 75, minApexKmh: 26,
      restartAt: [-330, -386], restartKmh: 112, clock: 138,
    },
    replaySide: -1,
    rivals: [
      { id: 'dante', name: 'name.dante', kind: 'chrome_supercar', or: 'coupe', color: [0.6, 0.62, 0.66], skill: 0.93, aggression: 0.55, lane: 1.0, nitro: true, type: { topSpeed: 226, accel: 11.4, grip: 1.2 }, dot: '#ffd36a' },
      { id: 'wolf1', name: 'race.r.wolf1', kind: 'tech_patrol_car', or: 'sedan', color: [0.06, 0.065, 0.075], skill: 0.8, aggression: 0.65, lane: -1.4, type: WOLF_CAR, nitro: true, dot: '#c9d2dc' },
      { id: 'wolf2', name: 'race.r.wolf2', kind: 'tech_patrol_car', or: 'sedan', color: [0.22, 0.23, 0.25], skill: 0.78, aggression: 0.6, lane: 1.6, type: WOLF_CAR, nitro: true, dot: '#c9d2dc' },
      { id: 'wolf3', name: 'race.r.wolf3', kind: 'small_city_car', or: 'sedan', color: [0.1, 0.1, 0.11], skill: 0.76, aggression: 0.55, lane: -0.5, type: { topSpeed: 208, accel: 9.8, grip: 1.12 }, nitro: true, dot: '#c9d2dc' },
      { id: 'f5', name: 'race.r.marisol', kind: 'tech_patrol_car', or: 'sedan', color: [0.55, 0.06, 0.08], skill: 0.72, aggression: 0.35, lane: 0.4, type: { topSpeed: 200, accel: 9.6, grip: 1.1 }, nitro: true, dot: '#ff6b5a' },
    ],
    crowds: [
      // the start and finish: both sidewalks of the street at the lights (behind the guardrail on the west side)
      { a: [1.8, -350], b: [1.8, -318], n: 30, face: 90, flare: true },
      { a: [-15.5, -350], b: [-15.5, -320], n: 22, face: 270 },
      { a: [-120, -376.5], b: [-30, -376.5], n: 40, face: 180, flare: true },
      { a: [-390.5, -260], b: [-390.5, -215], n: 16, face: 90 },
    ],
  },
};
