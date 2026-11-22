// ---------------------------------------------------------------------------
// water.js - where is there water, and how deep is it? (for swimming)
//
//   at(x, z) -> { surface, bottom } or null (no water: a street, a block, the sand above the water line)
//     * THE SUNK: the canals and the market basin. The old street lies 3.2 m under the surface.
//       (The decks over the water - pontoons, ramps - are not checked here: who asks knows whether he
//       stands on one. See deckOr() below.)
//     * THE SEA: south of the beach the sand keeps sloping down under the water. South of The Sunk
//       the sea is as deep as its canals.
//   depth(x, z) -> meters of water there (0 = dry)
//
//   SWIM: from this depth on a person swims (the water reaches the chest)
//   WADE: from this depth on walking is slower (the water pulls at the legs)
//
// The player (src/player/player.js) and every story character and NPC (src/story/actors.js) use it:
// whoever is in deep water swims - nobody stands on the water.
// ---------------------------------------------------------------------------

import { SUNK, inSunk, inWater } from '../city/sunkPlan.js';

export const SWIM = 1.3;
export const WADE = 0.45;

export function createWater(layout) {
  const level = layout.ocean.level;
  const hit = { surface: 0, bottom: 0 };
  function at(x, z) {
    if (inSunk(x, z)) {
      if (!inWater(x, z)) return null;
      hit.surface = SUNK.level; hit.bottom = SUNK.bed;
      return hit;
    }
    const g = layout.groundHeight(x, z);
    if (g >= level) return null;
    hit.surface = level;
    // (south of The Sunk: the open sea, as deep as the canals that run into it)
    hit.bottom = z < SUNK.minZ && x > SUNK.minX && x < SUNK.maxX ? Math.min(g, SUNK.bed) : g;
    return hit;
  }
  function depth(x, z) { const w = at(x, z); return w ? w.surface - w.bottom : 0; }
  return { level, at, depth, SWIM, WADE };
}
