# Car build tools

These scripts turned the six big car scans (about 60 MB and 1.9 million triangles
each) into the small files that now live in `assets/vehicles/` (they were renamed there:
`hatch` -> `small_city_car`, `luxury` -> `tech_patrol_car`, `police` -> `police_coupe`,
`hyper` -> `chrome_supercar`, `armored` -> `armored_van`, `boat` -> `patrol_boat`, and
`cars.json` -> `vehicles.json`). They are kept here so the steps can be
repeated for new cars. They are NOT needed to play the game.

1. `bake.html` + `bake.mjs` (run in a headless browser): takes six straight-on
   "photos" of the original model (left, right, top, bottom, front, back) and packs
   them into one clean texture, plus a depth picture.
2. `build_cars.mjs` (Node, needs `@gltf-transform/core`, `@gltf-transform/extensions`,
   `meshoptimizer`, `sharp`): welds and simplifies the mesh, maps the photos onto it,
   finds the glass by its color, cuts out the two front doors and the four wheels and
   writes `<name>.glb`, `<name>_lo.glb` and `cars.json`.

The paths at the top of the scripts point to a temporary work folder; change them
before running. The numbers per car (wheel positions, door box, window boxes) are in
the `CARS` table at the top of `build_cars.mjs`.
