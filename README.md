# PHANTOM GRID

An open-world 3D web game set in **Port Meridian**, a fictional American coastal city in the year 2090.
A realistic city of the future: sculpted glass towers, hanging gardens, sky bridges,
electric cars and a maglev line. No cartoon look, no neon-toy look.

This is **Phase 1**: a playable, realistic first area of the city that runs in a phone browser.
Since version 1.2 all buildings are **futuristic** and are put together from a
**kit of parts** (twisted tower bodies, glass curtain walls with fins, ribbon frames,
garden terraces, helipads ...). Eleven **hero buildings** follow the reference pictures
in `assets/reference/buildings/` - see "The buildings" below.
Version 1.3 is a polish pass: natural trees and palms, real-looking asphalt, more
reflecting glass, people on the sidewalks, driving cars and a warm sun with a soft glow -
see "The polish pass" below.

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
| **Low** | No shadows, no bloom, no sun glow, 0.75 pixel ratio, short draw distance, thicker haze, no fins and no plants on the facades, 60 people and 12 driving cars |
| **Medium** | Shadows, light bloom, sun glow, film-like color grade, fins, floor plates, plants and small parts within about 150 m, 130 people and 24 driving cars |
| **High** | Sharper shadows, more detail further away, subtle vignette and film grain, 170 people and 32 driving cars |
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
    buildingKit.js         THE KIT OF PARTS: twisted / tapered tower body, glass curtain wall,
                           fins, ribbon frame, terrace with plants, green wall, solar roof,
                           helipad, drone pad, sky bridge, EV bay ...
    heroBuildings.js       THE HERO BUILDINGS b01 ... b11 (one function each)
    buildingTypes.js       THE FILL TYPES for all other lots (tower, trays, steps, podium,
                           wave, arcade, retrofit, plaza) and the district rules
    buildings.js           cuts every block into lots, places heroes and fill buildings,
                           sky bridges, loads model files (.glb)
    props.js               smart street lights, trees, parked cars, planters, benches, bike racks,
                           EV posts ... (instanced)
    streetLife.js          things that move: people on the sidewalks, cars on the lanes
    models.js              the small 3D models, built in code
    backdrop.js            ocean, hills, far Crown towers, highway, maglev line
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
    geometry.js            MeshBuilder (many shapes -> one mesh), InstancedSet, DetailSet
    noise.js               noise, normal maps made from photos, canvas helpers
assets/
  textures/                the tileable photo textures (see below)
  characters/              put Nate_Calloway.glb here
  buildings/               hero buildings: put .glb model files here (see below)
  hdri/                    optional sky photo for reflections
  reference/               the reference pictures (buildings/b01 ... b11)
docs/
  building_notes.md        notes on every reference building (written before coding)
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

### Hero buildings as model files (`assets/buildings/*.glb`, optional)

The hero buildings are made from code. If you later have real model files, the
game uses them instead - same place, same size.

- **Replace a hero:** upload a file with the same name as its reference picture:

  | File name | Building | Real height |
  |---|---|---|
  | `b01_twist_tower.glb` | twist tower | 160 m |
  | `b02_terrace_tower.glb` | terrace tower | 80 m |
  | `b03_garden_midrise.glb` | garden midrise | 30 m |
  | `b04_office_hub.glb` | office hub | 35 m |
  | `b05_villa_cluster.glb` | villa cluster | 20 m |
  | `b06_beach_hotel.glb` | beach hotel | 50 m |
  | `b07_drone_ev_hub.glb` | drone + EV hub | 55 m with tower |
  | `b08_retrofit_brick_tower.glb` | retrofit brick tower | 55 m |
  | `b09_neon_arcade.glb` | Neon Mile arcade | 12 m |
  | `b10_scurve_tower.glb` | S-curve tower | 180 m |
  | `b11_hourglass_tower.glb` | hourglass tower | 140 m |

  (The exact names are in the `HEROES` table in `src/city/heroBuildings.js`.)
  The model is scaled to the real height, turned to the street and gets a collision box.
- **Extra models:** files named `hero1.glb` ... `hero4.glb`, or a list file
  `assets/buildings/buildings.json`, are put on extra corner lots
  (`modelLots` in `src/city/layout.js`):

  ```json
  [
    { "file": "bank.glb", "height": 32, "rotate": 90 },
    "diner.glb"
  ]
  ```

- The front of a model should look toward **+Z**.
- Without files nothing changes.
- Keep models small (under about 20k triangles and 2 MB each) so phones stay fast.

### Sky photo for reflections (`assets/hdri`, optional)

Put a file named `environment.hdr` (or `environment.jpg`, an equirectangular panorama)
into `assets/hdri`. If it exists, shiny surfaces reflect it. If not, reflections are
made from the game's own sky and change with the time of day.

### Reference pictures (`assets/reference/buildings`)

Ten pictures (b01 ... b08, b10, b11), each showing one building from four sides.
`docs/building_notes.md` describes what was read from them. The street map itself
is defined in `src/city/layout.js`.

---

## The city (Phase 1)

World rules: 1 unit = 1 meter. **North is +Z**, south is -Z, east is -X, west is +X
(three.js is right-handed, so with north on +Z, east has to be -X; the minimap shows
north up and east on the right, like a normal map).

- **The Grid** - mid-rise living district (6 to 12 floors). Blocks of 80 x 100 m, streets
  14 m wide, 3 m sidewalks with trees and planters, a few alleys, and the
  *Calloway Diagonal* avenue. About 15% of the houses are old brick buildings with
  new glass parts (retrofits).
- **Neon Mile** - 26 m boulevard along the coast with palm trees, glass arcades with
  softly lit shop signs, a beach hotel and subtle holograms.
  South of it: promenade, 60 m of beach, then the ocean.
- **The Crown** - the tower district in the north-west (60 to 180 m towers, sky
  bridges, helipads). Its near corner is walkable; further out stand the far towers
  and the 260 m Kessler-Vance (KVI) headquarters.
- **Ironhill Highway** - raised concrete freeway on pillars along the east edge.
- **Meridian Maglev** - raised maglev track on thin pillars with a station and a train.
- Dry brown hills close the horizon in the north and east.

Everything is generated from `src/city/layout.js` with a fixed random seed, so the city
is the same every time. Change `seed` in that file to get a different city.

### The buildings

**Hero buildings** (`src/city/heroBuildings.js`) and where to stand to see them.
Add the text in the last column to the game address.

| Building | District | Stand here |
|---|---|---|
| b05 villa cluster (20 m) | The Grid | the start point - it is on your left; or `?pos=1.6,112&yaw=90` |
| b03 garden midrise (30 m) | The Grid | first corner south of the start: `?pos=1.6,34&yaw=60` |
| b08 retrofit brick tower (55 m) | The Grid | first corner north of the start: `?pos=-15.8,140&yaw=315` |
| b04 office hub (35 m) and b07 drone + EV hub | Neon Mile | south end of the start street: `?pos=-7,-407&yaw=0` (b04 on the right, b07 on the left) |
| b09 arcade (3 floors) | Neon Mile | `?pos=134,-407&yaw=0` |
| b06 beach hotel (50 m) | Neon Mile | `?pos=-148,-407&yaw=0` |
| b11 hourglass tower (140 m) | Neon Mile | `?pos=228,-407&yaw=0` |
| b01 twist tower (160 m) | The Crown | `?pos=369,250&yaw=300` and look up |
| b10 S-curve tower (180 m) | The Crown | `?pos=369,150&yaw=300` and look up |
| b02 terrace tower (80 m) | The Crown | `?pos=244,372&yaw=0` |
| b11 hourglass tower (140 m) | The Crown | `?pos=181,458&yaw=270` |
| Kessler-Vance HQ (260 m twist tower) | far Crown | `?pos=440,480&yaw=343` (it stands outside the walkable area) |

**Fill buildings** (`src/city/buildingTypes.js`) use the same kit in many variations:

| Type | What it is |
|---|---|
| `tower` | glass tower: straight, twisted, tapered or hourglass, with ribbons, sky gardens, helipad |
| `trays` | mid-rise with deep planted terrace rings every second floor |
| `steps` | floors that step back, a garden terrace on each step |
| `podium` | rounded block on a glass podium with a roof wing |
| `wave` | oval house with wave-shaped balcony bands |
| `arcade` | low glass shop arcade with a floating canopy and lit signs |
| `retrofit` | old brick house with a new glass volume, bronze frame and green wall |
| `plaza` | small open square with trees |

District rules: The Crown gets towers of 60 m and more with sky bridges and helipads,
Neon Mile gets 15 to 50 m buildings with shops, The Grid gets 6 to 12 floors and the
brick retrofits. Two neighbours never get the same type and look.

**Level of detail.** The body of a building and its ribbons are always drawn.
Fins, floor plates, plants, helipads and other small parts are instanced and only
drawn within about 150 m. The far towers use only the simplest body with the glass
shader. On Low the facade plants are removed and the fins are switched off.
Every building has a collision box.

To add a type: copy an entry in `TYPES` in `src/city/buildingTypes.js`, change
the recipe, and give it a weight in `pickType()` at the bottom of that file.

### The polish pass (version 1.3) and where to look at it

| What | Where to stand (add to the game address) |
|---|---|
| **Trees**: natural greens from yellow-green to deep green, full leaf clusters, light bark, every tree with its own size and lean, sunlight shining through the leaves | the start point, or `?pos=-15.8,100&yaw=180&time=15` (the start street, The Grid) |
| **Palms**: wide drooping fronds, trunk with ring marks | Neon Mile: `?pos=-60,-384&yaw=270&time=15` |
| **Roads**: asphalt without a tile pattern, wheel paths, cracks, repairs, oil, tire marks, worn lines, lane arrows, stop lines, crosswalks | stand in the middle of the street: `?pos=-7,60&yaw=180&time=15`, the crossing is 30 m in front of you |
| **Curbs and sidewalk joints** (one joint every 2 m, iron tree grates) | `?pos=-15.8,100&yaw=180` and look down |
| **Glass**: stronger reflections, a different tint on every building, floor lines, dust and rain streaks | `?pos=-7,20&yaw=180&time=15` (look up at the towers) |
| **Lit windows** (about one in four) | the same place at dusk or night: `?pos=-7,20&yaw=180&time=19.4` or `&time=night` |
| **Street life**: people, benches, bins, bus shelters, bike racks, planters, signs, EV chargers | `?pos=-15.8,100&yaw=180` and walk south |
| **Traffic**: cars drive on the right, stop at red lights and brake for you; delivery drones fly above | `?pos=-15.8,36&yaw=180` (the crossing of the start street), wait for one light cycle |
| **Sun glow and long warm shadows** | Neon Mile at sunset, looking west: `?pos=-60,-384&yaw=250&time=18.3` |
| **Haze in the distance, soft shadow at building bases** | `?pos=-7,-200&yaw=0&time=15` (look north along the street) |

### Things you can safely edit

- `src/city/layout.js`: block sizes, street width, alleys, the diagonal avenue,
  highway, maglev line, where the hero buildings stand (`heroSites`), spawn point.
- `src/config.js`: time of day, player and camera speeds, quality presets, fog,
  street light settings, texture sizes.
- `src/city/textures.js`: the made-up shop names (`SIGN_NAMES`, `NEON_NAMES`) and
  the graffiti tags (`makeGraffitiTexture`).
- `src/city/buildingTypes.js`: sizes, floors, colors and how often each building
  type appears.

---

## How it stays fast on a phone

- Almost all of the city is drawn with a handful of big merged meshes and
  instanced meshes. A whole frame uses well under 200 draw calls
  (about 65 on Low, about 125 on Medium, at most about 170; tap `FPS` to see it).
- All glass of all buildings is ONE mesh with one glass shader that paints floor
  lines, mullions and lit rooms. All panels (concrete, metal, wood, solar) are one more.
- Fins, floor plates and plants are instanced copies of a few small models, drawn
  only near the player.
- Props are only drawn near the player (bins 105 m, cars 150 m, trees 290 m ...).
- All people are ONE instanced mesh; arms and legs swing in the shader. Only the
  people and cars near the player exist - far ones are moved to a new place nearby.
- One sun casts shadows: a sharp shadow map follows the player, a second soft one
  covers the far city and is only redrawn when the sun has moved.
- At night only the 6 street lamps nearest to the player are real lights. All the
  others light the ground through one top-down "lamp light map".
- Reflections come from one small environment map that is updated when the sky changes.

---

## Known limits of Phase 1

- No missions yet. People and cars are simple: people walk around the blocks and never cross the street, cars only turn right. The highway and the maglev are scenery.
- Tested with a software renderer only; real phone frame rates still have to be checked on a device.
- The player has no animation (the model has no skeleton yet).
- Buildings cannot be entered.
- Shop names, signs and adverts are invented. No real brands are used.
