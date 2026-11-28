// ---------------------------------------------------------------------------
// config.js - every number you may want to tweak lives here.
//
// WORLD RULES
//   1 unit = 1 meter.
//   +Y is up.
//   +Z is NORTH, -Z is SOUTH.
//   -X is EAST,  +X is WEST.   (three.js is "right-handed", so when north is
//                               +Z, east has to be -X. The minimap already
//                               takes care of this.)
// ---------------------------------------------------------------------------

export const CONFIG = {
  version: 'Phase 8.2',

  // ----- TIME OF DAY -------------------------------------------------------
  time: {
    dayLengthSeconds: 720,   // 1 game day = 12 real minutes
    sunriseHour: 6.0,
    sunsetHour: 19.0,
    startHour: 18.15,        // the game starts at golden hour
    // The four buttons in the HUD jump to these hours.
    presets: { morning: 7.6, noon: 12.5, sunset: 18.35, night: 23.0 },
  },

  // Path of the sun in the sky (degrees). Compass: 0 = north, 90 = east,
  // 180 = south, 270 = west. The sun rises in the east-south-east, is in
  // the south at noon and sets in the west-south-west, over the ocean side.
  sun: {
    maxElevation: 58,
    azimuthAtSunrise: 115,
    azimuthAtSunset: 245,
  },

  // ----- PLAYER ------------------------------------------------------------
  player: {
    model: 'assets/characters/Nate_Calloway.glb',
    // if this file exists it is used instead: a model with a skeleton and the
    // animations "idle", "walk" and "run"
    riggedModel: 'assets/characters/Nate_Calloway_rigged.glb',
    autoRig: true,          // no skeleton in the model file: build one automatically (src/characters/autoRig.js)
    faceClean: 1,           // cleans the painted shadows and dark smudges on the faces: 0 = off, 1 = normal, up to 1.4 = strong
    fillNight: 0.3,         // the characters' own soft light at night (0 = off: faces go black in dark streets)
    fillDay: 0.02,          // ... and in daylight
    height: 1.8,       // the model is scaled to this height (meters)
    radius: 0.35,      // body radius used for collisions
    walkSpeed: 1.6,    // meters per second
    runSpeed: 5.0,
    swimSpeed: 1.2,    // swimming (deep water), and with the RUN button held
    swimFast: 2.0,
    turnSpeed: 9.0,    // how quickly the body turns toward the move direction
    acceleration: 9.0, // how quickly the speed changes
  },

  // ----- CAMERA (third person, over the right shoulder) ---------------------
  // Like the big open-world games: the camera is about as high as the eyes and looks a little down, so
  // people keep their real proportions (a camera high above the head makes everybody look short and squat).
  camera: {
    fov: 50,           // vertical field of view on a wide (landscape) screen
    portraitHFov: 46,  // on a tall (portrait) screen we keep this horizontal view
    maxHFov: 82,       // on a very wide phone the view left-right never gets wider than this (wider = stretched people at the edges)
    near: 0.2,
    far: 9000,
    distance: 3.5,     // meters behind the player
    pivotHeight: 1.32, // the camera turns around a point at the chest, its own height is then about 1.55 m
    shoulder: 0.52,    // sideways offset (meters, to the right)
    minPitch: -0.4,    // radians, looking up
    maxPitch: 0.85,    // radians, looking down
    startPitch: 0.07,
    recenter: 2.2,     // walking without touching the camera for this many seconds: it comes back to the normal height
    minDistance: 0.85, // a wall behind the player: the camera comes no closer than this (it rises a little instead)
    touchSensitivity: 0.0052, // radians per pixel of finger drag
    mouseSensitivity: 0.0026,
    collisionRadius: 0.3,     // keeps the camera this far from walls
  },

  // ----- FOG / HAZE ----------------------------------------------------------
  fog: {
    density: 0.0023,   // thicker = shorter view distance (a slightly hazy far city)
    rainDensity: 0.0032,
    height: 70,        // the haze is thick near the ground and thin above this
  },

  // ----- STREET LIGHTS -------------------------------------------------------
  streetLights: {
    realLights: 6,          // only the nearest lights are real point lights
    range: 34,              // meters
    intensity: 380,         // candela (three.js physical light units)
    sodiumColor: 0xe6eeff,  // smart street lights in The Grid: thin, cool white light
    ledColor: 0xffe2c0,     // warm white lights on Neon Mile
  },

  // ----- QUALITY PRESETS -------------------------------------------------------
  // pixelRatio: how many screen pixels we render per CSS pixel.
  //   "scale" multiplies the phone's own pixel ratio, then min/max clamp it.
  //   textureCap: the largest picture (in points along a side) that is sent to the graphics chip. Bigger pictures
  //   are made smaller on the way (src/world/stability.js). This is most of the memory a phone needs for the game:
  //   512 uses about a quarter of the memory of 1024.
  quality: {
    // VERY LOW: for phones that close the game because it needs too much memory, or get hot. Small pictures, a
    // soft image, few people and cars, a short view in thick haze. It still is the whole game.
    verylow: {
      label: 'VERY LOW',
      textureCap: 384,
      cityCells: true,      // the big city meshes are drawn square by square: only what the camera sees
      spectators: 0.3,
      pixelRatio: { scale: 0, min: 0.6, max: 0.6, dynMax: 0.8 },
      film: { pixelRatio: 0.8, msaa: 0, sharpen: 0 },
      post: false,
      vignette: false,
      grain: false,
      msaa: 0,
      shadows: false,
      shadowMapSize: 512,
      shadowRange: 40,
      farShadows: false,
      farShadowMapSize: 512,
      normalMaps: false,
      anisotropy: 1,
      envMapSize: 32,
      propDistance: 0.4,
      people: 8, traffic: 6,
      buildingDetail: false,
      fogMultiplier: 2.1,
      cameraFar: 1700,
      rainStreaks: 350,
      wetReflections: 0.3,
      skyClouds: true,
      water: 'simple',
      sunkMist: false,
    },
    low: {
      label: 'LOW',
      textureCap: 512,
      cityCells: true,
      spectators: 0.5,      // races: half of the crowd
      pixelRatio: { scale: 0, min: 0.75, max: 0.75, dynMax: 1.25 },  // dynMax: how sharp it may get when the phone keeps up
      // film scenes: the people are close to the camera - more pixels, finer edges, less sharpening (main.js)
      film: { pixelRatio: 0.95, msaa: 0, sharpen: 0 },
      post: false,          // no bloom, no color grade (render straight to screen)
      vignette: false,
      grain: false,
      msaa: 0,
      shadows: false,
      shadowMapSize: 1024,
      shadowRange: 55,
      farShadows: false,
      farShadowMapSize: 1024,
      normalMaps: false,
      anisotropy: 4,
      envMapSize: 64,
      propDistance: 0.55,   // multiplier for how far props are drawn
      people: 20, traffic: 12, // walking people and driving cars around the player
      buildingDetail: false, // no fins, no plants on facades, no 3D windows (the glass shader paints lines instead)
      fogMultiplier: 1.7,   // thicker fog hides the short draw distance
      cameraFar: 2600,
      rainStreaks: 700,
      wetReflections: 0.45, // the lamps' light on the wet road: a little more than half as strong
      skyClouds: true,
      water: 'simple',      // The Sunk: canal water without rain rings and boat waves
      sunkMist: false,      // The Sunk: no drifting mist sheets
    },
    medium: {
      label: 'MEDIUM',
      textureCap: 1024,
      pixelRatio: { scale: 0.5, min: 1.0, max: 1.3, dynMax: 2.0 },
      film: { pixelRatio: 1.65, msaa: 4, sharpen: 0.3 },
      post: true,           // bloom + film-like color grade
      sharpen: 0.55,        // the picture is drawn smaller than the screen: sharpened back (postfx.js)
      vignette: false,
      grain: false,
      msaa: 2,
      shadows: true,
      shadowMapSize: 1024,
      shadowRange: 44,      // half size of the sharp shadow area around the player
      farShadows: true,     // low detail shadows for the far city
      farShadowMapSize: 1024,
      normalMaps: true,
      anisotropy: 8,     // (sharp roads far away)
      envMapSize: 64,
      propDistance: 1.0,
      people: 60, traffic: 30,
      buildingDetail: true, // fins, floor slabs, plants near the player (about 150 m)
      fogMultiplier: 1.0,
      cameraFar: 9000,
      rainStreaks: 1400,
      skyClouds: true,
    },
    high: {
      label: 'HIGH',
      textureCap: 2048,
      pixelRatio: { scale: 0.75, min: 1.25, max: 2.0, dynMax: 2.4 },
      film: { pixelRatio: 2.3, msaa: 4, sharpen: 0.2 },
      post: true,
      sharpen: 0.35,
      vignette: true,       // subtle dark corners
      grain: true,          // subtle film grain
      msaa: 4,
      shadows: true,
      shadowMapSize: 2048,
      shadowRange: 70,
      farShadows: true,
      farShadowMapSize: 2048,
      normalMaps: true,
      anisotropy: 8,
      envMapSize: 128,
      propDistance: 1.35,
      people: 80, traffic: 40,
      buildingDetail: true,
      fogMultiplier: 1.0,
      cameraFar: 9000,
      rainStreaks: 2600,
      skyClouds: true,
    },
  },

  // ----- TEXTURES ------------------------------------------------------------
  // "size" = how many meters one copy of the picture covers in the world.
  // normal: how strong the fake surface bumps are (made from the picture).
  textures: {
    path: 'assets/textures/',
    asphalt:    { file: 'asphalt.png',       size: 10, fine: 4, normal: 0.7, roughness: 0.94 },  // one copy = 10 m: no tile pattern. fine = the grain repeats 4x more often
    sidewalk:   { file: 'sidewalk.png',      size: 8.0, normal: 1.3, roughness: 0.88 },  // 4 slabs across -> a joint every 2 m
    brick:      { file: 'brick.png',         size: 1.5, normal: 2.4, roughness: 0.9 },   // 6 bricks across -> 1 brick = 25 cm
    plaster:    { file: 'plaster.png',       size: 3.4, normal: 1.2, roughness: 0.93 },
    sand:       { file: 'sand.png',          size: 4.8, normal: 1.8, roughness: 0.96 },
    glassTower: { file: 'glass_tower.png',   size: 18 },
    // The window pictures are grids of windows. These numbers describe the
    // grid so the game can cut out single windows. If you replace the
    // pictures with a different layout, change the numbers here.
    windowsDay: {
      file: 'windows_day.png',
      cols: 8, rows: 10,
      offsetX: 0, offsetY: 5,                  // pixels (for a 1024 px picture)
      crop: { x: 20, y: 8, w: 84, h: 68 },     // window rectangle inside one cell
      skipCols: [2, 6],                        // columns with balconies (not used)
    },
    windowsNight: {
      file: 'windows_night.png',
      cols: 10, rows: 10,
      offsetX: 0, offsetY: 35,
      cellH: 98.9,
      crop: { x: 16, y: 12, w: 68, h: 58 },
      litThreshold: 80,                        // cells brighter than this count as "lit"
    },
  },

  // Optional sky photo for reflections. If the file exists it is used,
  // if not the game builds the reflections from its own sky.
  hdri: ['assets/hdri/environment.hdr', 'assets/hdri/environment.jpg'],

  // ----- DEBUG ----------------------------------------------------------------
  showStats: false,   // FPS / draw calls panel visible at start?
};

// Small helper: read "?name=value" options from the page address.
// Example:  index.html?quality=low&time=12&rain=1&stats=1
export function urlOption(name, fallback = null) {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
