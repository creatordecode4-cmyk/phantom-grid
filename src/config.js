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
  version: 'Phase 4.3',

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
    turnSpeed: 9.0,    // how quickly the body turns toward the move direction
    acceleration: 9.0, // how quickly the speed changes
  },

  // ----- CAMERA (third person, over the right shoulder) ---------------------
  camera: {
    fov: 55,           // vertical field of view on a wide (landscape) screen
    portraitHFov: 46,  // on a tall (portrait) screen we keep this horizontal view
    maxHFov: 90,       // on a very wide phone the view left-right never gets wider than this (wider = fat people at the edges)
    near: 0.2,
    far: 9000,
    distance: 3.6,     // meters behind the player
    pivotHeight: 1.55, // the camera looks at a point near the shoulders
    shoulder: 0.55,    // sideways offset (meters, to the right)
    minPitch: -0.45,   // radians, looking up
    maxPitch: 1.0,     // radians, looking down
    startPitch: 0.1,
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
  quality: {
    low: {
      label: 'LOW',
      pixelRatio: { scale: 0, min: 0.75, max: 0.75 },
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
      anisotropy: 2,
      envMapSize: 64,
      propDistance: 0.55,   // multiplier for how far props are drawn
      people: 20, traffic: 12, // walking people and driving cars around the player
      buildingDetail: false, // no fins, no plants on facades, no 3D windows (the glass shader paints lines instead)
      fogMultiplier: 1.7,   // thicker fog hides the short draw distance
      cameraFar: 2600,
      rainStreaks: 700,
      skyClouds: true,
    },
    medium: {
      label: 'MEDIUM',
      pixelRatio: { scale: 0.5, min: 1.0, max: 1.3 },
      post: true,           // bloom + film-like color grade
      vignette: false,
      grain: false,
      msaa: 2,
      shadows: true,
      shadowMapSize: 1024,
      shadowRange: 55,      // half size of the sharp shadow area around the player
      farShadows: true,     // low detail shadows for the far city
      farShadowMapSize: 1024,
      normalMaps: true,
      anisotropy: 4,
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
      pixelRatio: { scale: 0.75, min: 1.25, max: 2.0 },
      post: true,
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
