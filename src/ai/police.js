// ---------------------------------------------------------------------------
// police.js - kept for old code that still imports it.
//
// The wanted level and the Meridian Guard now live in wanted.js (Phase 5):
// 0 to 5 stars, Guard cars and drones that see and search, hiding, scanner
// gates, roadblocks, disguise and BUSTED. Everything police.js did is still
// there with the same names: update(), stars, heat, chased, chasers,
// setScripted(), sirens(), takeMessage().
//
// createPolice() needs the same things as createWanted():
//   { scene, vehicles, gps, layout, city, props, sound }
// ---------------------------------------------------------------------------

export { createWanted as createPolice } from './wanted.js';
