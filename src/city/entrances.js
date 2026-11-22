// ---------------------------------------------------------------------------
// entrances.js - every door of the city that can be opened (src/interiors).
//
// It is filled while the city is built: every door drawn on a building at
// street level (buildingKit.doorOn) is written here, with what kind of
// building it belongs to, so the house behind it can be made to fit:
//   { id, x, z      the middle of the door at the bottom, a little in front of the wall
//     nx, nz        the direction out of the building (toward the street)
//     w, h, y       width, height, the floor height (the curb)
//     door          0 glass shop / lobby door, 1 shutter, 2 door, 3 garage door
//     district      'grid' | 'neon' | 'crown'
//     building }    the building type ('tower', 'arcade' ...) or the hero id ('b05' ...)
// A few doors get a name (heroBuildings.js, markEntrance): those lead into the
// rooms made by hand (rooms.js). All others get a room made for them.
// ---------------------------------------------------------------------------
export const ENTRANCES = [];
