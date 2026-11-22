# Interior notes (Phase 6)

Written before coding, from the four reference pictures the user sent
(a dining kitchen in three lights, a retro kitchen, a child's bedroom, and a
wet foggy street at night). They are pictures made with an offline renderer;
the game runs live in a phone browser, so the aim is the *look*, made with
tricks that cost little.

## What the pictures have in common

1. **Warm, layered light.** One strong key light (sun through a small window,
   or a lamp over the table) and a lot of soft fill. The light can be *seen*:
   a beam of sun with dust in it, a pool of light on the floor and the table.
2. **Corners are darker.** Where a wall meets the floor or the ceiling, under
   a table, behind a cupboard: soft darkness (ambient occlusion).
3. **Materials that read.** Wood grain, patterned floor tiles, enamel on the
   stove, glass bottles, paper on the walls, a patterned rug. Nothing is one
   flat color.
4. **Clutter with a story.** Plates in a rack, pots on hooks, papers pinned to
   the wall, a teapot on the table, books, a ball on the rug.
5. **Rounded edges.** Every box has soft edges that catch a thin line of light.
6. **The same room at three times of day** (picture 1): sunny day, evening with
   the lamp on, night with only cold moonlight through the window.

## Picture 1 - the dining kitchen (about 4.6 x 4.2 m, 2.8 m high)
- dark wooden ceiling boards with beams, warm ochre plaster walls
- floor of patterned tiles (blue and cream circles)
- left: a wooden work table with crates under it, papers pinned to the wall,
  a shelf with jars, a colander and ladles on hooks
- back: an enamel stove with an oven, a red pot, a patterned tile panel behind
  it, a dish rack with plates, a spice shelf, copper pans on the wall
- back right: a small window with a wooden frame - the light comes from here
- right: a tall wooden dresser with plates, a little radio, a candle
- middle: a table with plates, cups and a teapot, three spindle-back chairs
- a metal pendant lamp over the table, a green glass bottle, stacked books

## Picture 2 - the retro kitchen
- a rounded cream fridge with chrome handles and notes on it (no brand name in
  the game), a mint-green stove with knobs, wooden cabinets with drawers
- a counter with jars, bowls, a scale, plants; cream wall tiles with a border
- open shelves with mugs, hanging utensils, a window with thin curtains
  glowing in the sun

## Picture 3 - the child's bedroom
- light wallpaper, a wooden plank floor, a red patterned rug
- a single bed with a grey blanket, a tall wooden wardrobe
- a desk with drawers, a lamp and papers; a cork board with notes and a map
  between two little shutters; wall shelves with books and a globe
- a window with an orange curtain, a fan, an armchair, a ball, a board game

## Picture 4 - the street at night
- wet ground with puddles that mirror the lamps
- fog that glows around every lamp (a halo), orange sodium light
- railings, a lit stair entrance

## How the game does it

| In the pictures | In the game |
|---|---|
| sun through the window | a spot light with a shadow, shining in through the window; a visible beam (a soft additive shape) with slow dust in it |
| the lamp over the table | a point light under a shade, on in the evening and at night |
| soft fill and dark corners | a weak warm "bounce" light, and darkness baked into the colors of the walls, floor and furniture near corners |
| contact shadows | soft dark patches under furniture (one texture, many copies) |
| materials | textures drawn in code: wood grain, tiles, wallpaper, rug, posters, labels; real metal and glass settings |
| rounded edges | every piece of furniture is made of boxes with cut edges |
| three times of day | the room asks the game for the hour: day sun, evening lamp, night moonlight |
| halos and reflections outside | glowing sprites around the street lamps and streaks of light on the wet road under them |

## How you get in

- Every door at street level opens (559 in the whole city). Walk up to one:
  the **ENTER** button appears, the screen goes dark for a moment, and you are
  inside. Three houses were made by hand after the pictures (two villas and the
  garden building next to the start point): their doors are real wooden doors
  with a small lamp over them, and they swing open.
- Behind all the other doors the game makes a room the first time you open it
  (src/interiors/generate.js): a flat, a café, a corner shop, an office, a lobby
  or a garage, chosen by the building and the part of town. The same door
  always opens into the same room.
- The rooms are not inside the city's buildings: they are built far away from
  the city (so the city costs nothing while you are inside).
- Inside, the door you came through shows **EXIT**.
- The camera stays inside the room's walls. The Guard cannot see you indoors.
