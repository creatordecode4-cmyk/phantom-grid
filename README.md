# PHANTOM GRID

An open-world 3D web game set in **Port Meridian**, a fictional American coastal city in the year 2090.
About 80% believable present-day city, 20% subtle future technology.

This is **Phase 1**: a playable, realistic first area of the city that runs in a phone browser.

- No build step, no npm, no bundler. Plain HTML + JavaScript modules.
- three.js (version 0.170) is loaded from a CDN with an import map.
- Works straight from **GitHub Pages**.

---

## Play

Open the GitHub Pages address of this repository (see "Publish on GitHub Pages" below).

### Controls

| | Phone | Desktop |
|---|---|---|
| Move | Joystick, bottom-left (touch anywhere in that corner) | `W` `A` `S` `D` or arrow keys |
| Look | Drag on the right half of the screen | Mouse (click the game to lock the mouse, `Esc` to free it) |
| Run | `RUN` button (tap = on / off) | Hold `Shift` |
| Time of day | `TIME` button, then Morning / Noon / Sunset / Night | same, or key `T` |
| Rain | `RAIN` button | same, or key `R` |
| Quality | Quality button, then Auto / Low / Medium / High | same |
| FPS + draw calls | `FPS` button | same, or key `F` |
| Full screen | `FULL` button | same |

One game day lasts 12 real minutes. The game starts at golden hour.

### Quality levels

| Level | What you get |
|---|---|
| **Low** | No shadows, no bloom, 0.75 pixel ratio, short draw distance, thicker haze |
| **Medium** | Shadows, light bloom, film-like color grade |
| **High** | Sharper shadows, more detail, subtle vignette and film grain |
| **Auto** | Picks a level for your phone, and goes one level down if the game runs slowly |

### Address options (handy for testing)

Add these to the end of the address, for example `.../index.html?quality=low&time=night&stats=1`

| Option | Meaning |
|---|---|
| `quality=low` / `medium` / `high` / `auto` | start with this quality |
| `time=morning` / `noon` / `sunset` / `night` or an hour like `time=14.5` | start at this time |
| `freeze=1` | time stands still |
| `rain=1` | start with rain |
| `stats=1` | show FPS and draw calls |
| `pos=x,z` | start position in meters, for example `pos=-60,-397` (Neon Mile) |
| `yaw=180` | look direction as a compass angle (0 north, 90 east, 180 south, 270 west) |
| `nohud=1` | hide all buttons (for screenshots) |

---

## Folder structure

```
index.html                 the page: loads three.js, holds the HUD and its styles
src/
  main.js                  starts everything, quality presets, the main loop
  config.js                ALL numbers you may want to tweak (speeds, quality, time ...)
  city/
    layout.js              THE MAP as plain data: streets, blocks, districts, spawn point
    cityBuilder.js         turns the layout into meshes + collision data + lamp light map
    materials.js           loads textures, builds all materials and their shader patches
    textures.js            textures made in code: signs, decals, windows, fallbacks ...
    ground.js              asphalt, sidewalks, curbs, lane markings, stains, beach
    buildings.js           procedural buildings: walls, windows, shops, signs, awnings
    props.js               street lights, trees, cars, traffic lights, drones ... (instanced)
    models.js              the small 3D models, built in code
    backdrop.js            ocean, hills, The Crown skyline, highway, light rail
  world/
    lighting.js            sky, sun, day / night, shadows, haze, reflections, street lamps
    weather.js             rain and wet streets
    postfx.js              bloom, film color grade, vignette, grain
  player/
    player.js              the character: loading, walking, collisions
    camera.js              third-person camera that never goes through walls
  ui/
    touchControls.js       joystick, camera drag, run button, keyboard and mouse
    minimap.js             the round map (drawn from layout.js)
    hud.js                 text, buttons, menus, loading screen
  utils/
    math.js                small math helpers, seeded random numbers, polygons
    geometry.js            MeshBuilder (many shapes -> one mesh), InstancedSet
    noise.js               noise, normal maps made from photos, canvas helpers
assets/
  textures/                the tileable photo textures (see below)
  characters/              put Nate_Calloway.glb here
  buildings/               (for later phases)
  hdri/                    optional sky photo for reflections
  reference/               put PortMeridian_districts.png here (the satellite map)
```

---

## Publish on GitHub Pages (works from a phone)

1. Open this repository on github.com in your browser.
2. Tap **Settings** (use "Desktop site" in the browser menu if you cannot see it).
3. In the left menu tap **Pages**.
4. Under **Build and deployment** set **Source** to `Deploy from a branch`.
5. Set **Branch** to `main` and the folder to `/ (root)`, then tap **Save**.
6. Wait one or two minutes, then reload the page. GitHub shows the address:
   `https://creatordecode4-cmyk.github.io/phantom-grid/`
7. Open that address on your phone. After every new commit to `main`, GitHub
   updates the site by itself (it can take a minute; reload the page).

Tip: if you still see an old version, close the tab and open the address again
(phones keep old files for a while).

### Run on a computer (optional)

The game must be served by a web server (opening `index.html` as a file does not work
because browsers block modules and textures from `file://`). Any simple server is fine:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

---

## Assets

### Textures (`assets/textures`)

| File | Used for | Real size of one tile |
|---|---|---|
| `asphalt.png` | roads, flat roofs | 2.6 m |
| `sidewalk.png` | sidewalks, curbs, promenade | 3 m (4 slabs across) |
| `brick.png` | brick walls | 1.5 m (1 brick is about 25 cm) |
| `plaster.png` | plaster walls, concrete, hills | 3.4 m |
| `sand.png` | beach | 4.8 m |
| `glass_tower.png` | towers of The Crown | 18 m |
| `windows_day.png` | windows in daylight (grid of windows) | cut into single windows |
| `windows_night.png` | glowing windows at night | cut into single windows |

- Textures use world-space sizes, so they never stretch.
- The game makes **normal maps and roughness** from the color pictures by itself.
- Big stains in the photos are evened out when the game loads, and new non-repeating
  variation, dirt near the ground and rain streaks are added by the shaders. That is
  why walls and roads do not show an obvious repeating pattern.
- **If a file is missing**, the game draws a procedural replacement (never plain grey).
- To change a texture: upload a new picture with the **same file name**.
  If you change the window pictures to a different layout, update the grid numbers in
  `src/config.js` (`windowsDay` / `windowsNight`).

> Note: the two road pictures were uploaded with swapped names. The picture of
> paving slabs was called `asphalt.png` and the real asphalt was called
> `Asphalt road.png`. They were renamed to `sidewalk.png` and `asphalt.png`
> so the names match what the pictures show.

### Character (`assets/characters/Nate_Calloway.glb`)

- If the file exists it is loaded (GLTFLoader + MeshoptDecoder, WebP textures are fine),
  scaled to 1.8 m and placed with the feet on the ground.
- The model has no skeleton yet, so it is only moved and turned.
- If the file is missing, a simple mannequin with real human proportions is used.

### Sky photo for reflections (`assets/hdri`, optional)

Put a file named `environment.hdr` (or `environment.jpg`, an equirectangular panorama)
into `assets/hdri`. If it exists, shiny surfaces reflect it. If not, reflections are
made from the game's own sky and change with the time of day.

### Reference map (`assets/reference/PortMeridian_districts.png`)

This file was not in the repository yet, so Phase 1 follows the written description.
The map is defined in `src/city/layout.js` and is easy to adjust once the picture is added.

---

## The city (Phase 1)

World rules: 1 unit = 1 meter. **North is +Z**, south is -Z, east is -X, west is +X
(three.js is right-handed, so with north on +Z, east has to be -X; the minimap shows
north up and east on the right, like a normal map).

- **The Grid** - older working-class district. Blocks of 80 x 100 m, streets 14 m wide
  (2 lanes each way), 3 m sidewalks with curbs, a few narrow alleys, and the
  *Calloway Diagonal* avenue cutting from north-west to south-east.
- **Neon Mile** - 26 m boulevard along the coast with a median of palm trees,
  shops with glass fronts, awnings, lit signs and hologram billboards.
  South of it: promenade, 60 m of beach, then the ocean.
- **The Crown** - downtown skyline in the north-west (outside the play area) with the
  260 m Kessler-Vance (KVI) headquarters.
- **Ironhill Highway** - raised concrete freeway on pillars along the east edge.
  It ends in a ramp down to Neon Mile (closed for now).
- **Meridian Line** - raised light-rail track on thin pillars with a station and a train.
- Dry brown hills close the horizon in the north and east.

Everything is generated from `src/city/layout.js` with a fixed random seed, so the city
is the same every time. Change `seed` in that file to get a different city.

### Things you can safely edit

- `src/city/layout.js`: block sizes, street width, alleys, the diagonal avenue,
  highway, rail line, skyline, spawn point.
- `src/config.js`: time of day, player and camera speeds, quality presets, fog,
  street light settings, texture sizes.
- `src/city/textures.js`: the made-up shop names (`SIGN_NAMES`, `NEON_NAMES`).

---

## How it stays fast on a phone

- Almost all of the city is drawn with a handful of big merged meshes and
  instanced meshes. A whole frame uses well under 150 draw calls
  (about 40 on Low, about 80 on Medium / High; tap `FPS` to see it).
- Props are only drawn near the player (bins 105 m, cars 200 m, trees 400 m ...).
- One sun casts shadows: a sharp shadow map follows the player, a second soft one
  covers the far city and is only redrawn when the sun has moved.
- At night only the 6 street lamps nearest to the player are real lights. All the
  others light the ground through one top-down "lamp light map".
- Reflections come from one small environment map that is updated when the sky changes.

---

## Known limits of Phase 1

- No traffic, no pedestrians, no missions yet. The highway and the light rail are scenery.
- The player has no animation (the model has no skeleton yet).
- Buildings cannot be entered.
- Shop names, signs and adverts are invented. No real brands are used.
